var pkgInfo = require('./package.json');
var Service = require('webos-service');
var dgram = require('dgram');
var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');

var service = new Service(pkgInfo.name);

var JELLYFIN_DISCOVERY_PORT = 7359;
var JELLYFIN_DISCOVERY_MESSAGE = 'who is JellyfinServer?';
var SCAN_INTERVAL = 15000;
var COOKIE_FILE = '/tmp/moonfin-cookies.json';

var scanResult = {};
var subscriptions = {};
var interval = null;
var client4 = null;
var cookieJars = {};

function loadCookiesSync() {
	try {
		if (fs.existsSync(COOKIE_FILE)) {
			var data = fs.readFileSync(COOKIE_FILE, 'utf8');
			var loaded = JSON.parse(data);
			for (var id in loaded) {
				if (loaded[id]) {
					loaded[id].forEach(function(cookie) {
						if (cookie.expires) {
							cookie.expires = new Date(cookie.expires);
						}
					});
				}
			}
			cookieJars = loaded;
			return true;
		}
	} catch (e) {}
	return false;
}

function saveCookiesSync() {
	try {
		fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookieJars), 'utf8');
		return true;
	} catch (e) {
		return false;
	}
}

// Load cookies on startup
loadCookiesSync();

try {
	client4 = dgram.createSocket('udp4');
	client4.on('error', function() {});
	client4.on('message', handleDiscoveryResponse);
	client4.bind({port: JELLYFIN_DISCOVERY_PORT}, function() {
		client4.setBroadcast(true);
	});
} catch (e) {
	console.error('[Service] Failed to create UDP socket:', e.message);
}

function handleDiscoveryResponse(message, remote) {
	try {
		var msg = JSON.parse(message.toString('utf-8'));
		if (msg && msg.Id && msg.Name && msg.Address) {
			scanResult[msg.Id] = msg;
			scanResult[msg.Id].source = {address: remote.address, port: remote.port};
			sendScanResults(msg.Id);
		}
	} catch (e) {}
}

function sendScanResults(serverId) {
	for (var token in subscriptions) {
		if (subscriptions.hasOwnProperty(token)) {
			var s = subscriptions[token];
			if (serverId) {
				var res = {};
				res[serverId] = scanResult[serverId];
				s.respond({results: res});
			} else {
				s.respond({results: scanResult});
			}
		}
	}
}

function sendJellyfinDiscovery() {
	if (!client4) return;
	var msg = Buffer.from(JELLYFIN_DISCOVERY_MESSAGE);
	try {
		client4.send(msg, 0, msg.length, JELLYFIN_DISCOVERY_PORT, '255.255.255.255');
	} catch (e) {}
}

function createInterval() {
	if (interval) return;
	interval = setInterval(sendJellyfinDiscovery, SCAN_INTERVAL);
}

var discover = service.register('discover');
discover.on('request', function(message) {
	sendScanResults();
	sendJellyfinDiscovery();
	if (message.isSubscription) {
		subscriptions[message.uniqueToken] = message;
		createInterval();
	}
});
discover.on('cancel', function(message) {
	delete subscriptions[message.uniqueToken];
	if (Object.keys(subscriptions).length === 0 && interval) {
		clearInterval(interval);
		interval = null;
	}
});

function parseCookie(cookieStr) {
	var parts = cookieStr.split(';');
	if (parts.length === 0) return null;
	var nameValue = parts[0].trim().split('=');
	if (nameValue.length < 2) return null;
	var cookie = {
		name: nameValue[0],
		value: nameValue.slice(1).join('='),
		expires: null,
		path: '/'
	};
	for (var i = 1; i < parts.length; i++) {
		var part = parts[i].trim().toLowerCase();
		if (part.startsWith('expires=')) {
			cookie.expires = new Date(part.substring(8));
		} else if (part.startsWith('max-age=')) {
			cookie.expires = new Date(Date.now() + parseInt(part.substring(8)) * 1000);
		}
	}
	return cookie;
}

function storeCookies(userId, headers, requestUrl) {
	if (!headers || !headers['set-cookie']) return;
	loadCookiesSync();
	if (!cookieJars[userId]) cookieJars[userId] = [];
	var setCookieHeaders = Array.isArray(headers['set-cookie']) ? headers['set-cookie'] : [headers['set-cookie']];
	var domain = url.parse(requestUrl).hostname;
	setCookieHeaders.forEach(function(cookieStr) {
		var cookie = parseCookie(cookieStr);
		if (cookie) {
			cookie.domain = domain;
			cookieJars[userId] = cookieJars[userId].filter(function(c) {
				return c.name !== cookie.name || c.domain !== cookie.domain;
			});
			cookieJars[userId].push(cookie);
		}
	});
	saveCookiesSync();
}

function getCookies(userId, requestUrl) {
	loadCookiesSync();
	if (!cookieJars[userId] || cookieJars[userId].length === 0) return '';
	var domain = url.parse(requestUrl).hostname;
	var now = new Date();
	cookieJars[userId] = cookieJars[userId].filter(function(cookie) {
		return !cookie.expires || cookie.expires > now;
	});
	return cookieJars[userId]
		.filter(function(cookie) { return cookie.domain === domain; })
		.map(function(cookie) { return cookie.name + '=' + cookie.value; })
		.join('; ');
}

service.register('jellyseerrRequest', function(message) {
	var userId = message.payload.userId;
	var requestUrl = message.payload.url;
	var method = message.payload.method || 'GET';
	var headers = message.payload.headers || {};
	var body = message.payload.body;
	var timeout = message.payload.timeout || 30000;

	if (!userId || !requestUrl) {
		message.respond({success: false, error: 'Missing userId or url'});
		return;
	}

	var cookieHeader = getCookies(userId, requestUrl);
	if (cookieHeader) {
		headers['Cookie'] = cookieHeader;
	}

	var parsedUrl = url.parse(requestUrl);
	var isHttps = parsedUrl.protocol === 'https:';
	var httpModule = isHttps ? https : http;

	var options = {
		hostname: parsedUrl.hostname,
		port: parsedUrl.port || (isHttps ? 443 : 80),
		path: parsedUrl.path,
		method: method,
		headers: headers,
		timeout: timeout,
		rejectUnauthorized: false
	};

	var req = httpModule.request(options, function(res) {
		var responseBody = '';
		storeCookies(userId, res.headers, requestUrl);
		res.on('data', function(chunk) { responseBody += chunk; });
		res.on('end', function() {
			message.respond({
				success: true,
				status: res.statusCode,
				headers: res.headers,
				body: responseBody
			});
		});
	});

	req.on('error', function(err) {
		message.respond({success: false, error: err.message});
	});
	req.on('timeout', function() {
		req.abort();
		message.respond({success: false, error: 'Request timeout'});
	});

	if (body) req.write(body);
	req.end();
});

service.register('jellyseerrClearCookies', function(message) {
	var userId = message.payload.userId;
	if (!userId) {
		message.respond({success: false, error: 'Missing userId'});
		return;
	}
	loadCookiesSync();
	delete cookieJars[userId];
	saveCookiesSync();
	message.respond({success: true});
});

service.register('imageProxy', function(message) {
	var imageUrl = message.payload.url;
	if (!imageUrl) {
		message.respond({success: false, error: 'Missing image URL'});
		return;
	}

	var parsedUrl = url.parse(imageUrl);
	var isHttps = parsedUrl.protocol === 'https:';
	var httpModule = isHttps ? https : http;

	var options = {
		hostname: parsedUrl.hostname,
		port: parsedUrl.port || (isHttps ? 443 : 80),
		path: parsedUrl.path,
		method: 'GET',
		timeout: 15000,
		rejectUnauthorized: false
	};

	var req = httpModule.request(options, function(res) {
		var chunks = [];
		res.on('data', function(chunk) { chunks.push(chunk); });
		res.on('end', function() {
			var buffer = Buffer.concat(chunks);
			message.respond({
				success: true,
				status: res.statusCode,
				contentType: res.headers['content-type'],
				data: buffer.toString('base64')
			});
		});
	});

	req.on('error', function(err) {
		message.respond({success: false, error: err.message});
	});
	req.on('timeout', function() {
		req.abort();
		message.respond({success: false, error: 'Request timeout'});
	});

	req.end();
});
