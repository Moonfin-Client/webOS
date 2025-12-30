// -*- coding: utf-8 -*-

/*
 * Backend node.js service for server autodiscovery.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// File-based logging for debugging on webOS 4
var fs = require('fs');
var logFile = '/tmp/moonfin-service.log';

function logToFile(msg) {
	var timestamp = new Date().toISOString();
	var line = '[' + timestamp + '] ' + msg + '\n';
	try {
		fs.appendFileSync(logFile, line);
	} catch (e) {
		// Ignore file write errors
	}
	console.log(msg);
}

logToFile('[Service] ========================================');
logToFile('[Service] Moonfin service starting...');
logToFile('[Service] Node.js version: ' + process.version);
logToFile('[Service] Platform: ' + process.platform);
logToFile('[Service] ========================================');

// Catch any uncaught exceptions
process.on('uncaughtException', function(err) {
	logToFile('[Service] UNCAUGHT EXCEPTION: ' + err.message);
	logToFile('[Service] Stack: ' + err.stack);
});

var pkgInfo = require('./package.json');
logToFile('[Service] Package loaded: ' + pkgInfo.name);

var Service = require('webos-service');
logToFile('[Service] webos-service module loaded');

// Register com.yourdomain.@DIR@.service, on both buses
var service = new Service(pkgInfo.name);
logToFile('[Service] Service instance created');

var dgram = require('dgram');
logToFile('[Service] dgram module loaded');

var client4 = null;
try {
	client4 = dgram.createSocket("udp4");
	logToFile('[Service] UDP4 socket created');
} catch (e) {
	logToFile('[Service] Failed to create UDP4 socket: ' + e.message);
}

var JELLYFIN_DISCOVERY_PORT = 7359;
var JELLYFIN_DISCOVERY_MESSAGE = "who is JellyfinServer?";

var SCAN_INTERVAL = 15 * 1000;
var SCAN_ON_START = true;
var ENABLE_IP_SCAN = true; // Fallback to IP scanning if broadcast discovery fails

var scanresult = {};
var ipScanInProgress = false;
var scannedIPs = {}; // Use object instead of Set for Node.js 8 compatibility

function sendScanResults(server_id) {
	for (var i in subscriptions) {
		if (subscriptions.hasOwnProperty(i)) {
			var s = subscriptions[i];
			if (server_id) {
				var res = {};
				res[server_id] = scanresult[server_id];
				s.respond({
					results: res
				});
			} else {
			s.respond({
				results: scanresult,
			});
			}
		}
	}
}

function handleDiscoveryResponse(message, remote) {
	try {
		var msg = JSON.parse(message.toString('utf-8'));

		if (typeof msg == "object" &&
			typeof msg.Id == "string" &&
			typeof msg.Name == "string" &&
			typeof msg.Address == "string") {

			scanresult[msg.Id] = msg;
			scanresult[msg.Id].source = {
				address: remote.address,
				port: remote.port,
			};

			sendScanResults(msg.Id);
		}
	} catch (err) {
		console.log(err);
	}
}

function sendJellyfinDiscovery() {
	var msg = Buffer.from(JELLYFIN_DISCOVERY_MESSAGE);
	client4.send(msg, 0, msg.length, 7359, "255.255.255.255");

	// if (client6) {
	// 	client6.send(msg, 0, msg.length, 7359, "ff08::1"); // All organization-local nodes
	// }

	// Start IP scanning as fallback if enabled
	if (ENABLE_IP_SCAN && !ipScanInProgress) {
		startIPScan();
	}
}

// Get local network info for scanning
function getLocalNetworkPrefix() {
	var os = require('os');
	var interfaces = os.networkInterfaces();
	
	for (var name in interfaces) {
		var iface = interfaces[name];
		for (var i = 0; i < iface.length; i++) {
			var alias = iface[i];
			// Skip internal, IPv6, and loopback addresses
			if (alias.family === 'IPv4' && !alias.internal && alias.address.indexOf('169.254') !== 0) {
				// Extract network prefix (e.g., "192.168.1" from "192.168.1.100")
				var parts = alias.address.split('.');
				return parts[0] + '.' + parts[1] + '.' + parts[2];
			}
		}
	}
	return '192.168.1'; // Default fallback
}

// Check a single IP for Jellyfin server
function checkIP(ip) {
	if (scannedIPs[ip]) {
		return; // Already checked this IP
	}
	scannedIPs[ip] = true;
	
	var ports = [8096, 8920]; // Common Jellyfin ports
	var schemes = ['http', 'https'];
	
	ports.forEach(function(port) {
		schemes.forEach(function(scheme) {
			var url = scheme + '://' + ip + ':' + port + '/System/Info/Public';
			var httpModule = scheme === 'https' ? https : http;
			
			var req = httpModule.get(url, { timeout: 2000 }, function(res) {
				var data = '';
				
				res.on('data', function(chunk) {
					data += chunk;
				});
				
				res.on('end', function() {
					try {
						var serverInfo = JSON.parse(data);
						if (serverInfo.ProductName && serverInfo.ProductName.toLowerCase().indexOf('jellyfin') !== -1) {
							// Found a Jellyfin server!
							var serverId = serverInfo.Id || ip + ':' + port;
							scanresult[serverId] = {
								Id: serverId,
								Name: serverInfo.ServerName || 'Jellyfin Server',
								Address: scheme + '://' + ip + ':' + port,
								source: {
									address: ip,
									port: port,
									method: 'ip-scan'
								}
							};
							sendScanResults(serverId);
						}
					} catch (err) {
						// Not a valid JSON response, skip
					}
				});
			});
			
			req.on('error', function() {
				// Ignore connection errors
			});
			
			req.on('timeout', function() {
				req.abort();
			});
		});
	});
}

// Scan subnet for Jellyfin servers
function startIPScan() {
	if (ipScanInProgress) {
		return;
	}
	
	ipScanInProgress = true;
	scannedIPs = {};
	
	var networkPrefix = getLocalNetworkPrefix();
	
	// Scan all IPs in the subnet (1-254)
	var currentIP = 1;
	
	function scanNext() {
		if (currentIP > 254) {
			ipScanInProgress = false;
			return;
		}
		
		var ip = networkPrefix + '.' + currentIP;
		checkIP(ip);
		currentIP++;
		
		// Don't overwhelm the network - scan in batches with delays
		if (currentIP % 10 === 0) {
			setTimeout(scanNext, 100);
		} else {
			scanNext();
		}
	}
	
	scanNext();
}

function discoverInitial() {
	if (SCAN_ON_START) {
		sendJellyfinDiscovery();
	}
}

client4.on("listening", function () {
	var address = client4.address();
	client4.setBroadcast(true)
	client4.setMulticastTTL(128);
	//client.addMembership('230.185.192.108');
});

client4.on("message", handleDiscoveryResponse);
client4.bind({
	port: JELLYFIN_DISCOVERY_PORT
}, discoverInitial);


var interval;
var subscriptions = {};

function createInterval() {
	if (interval) {
		return;
	}
	interval = setInterval(function () {
		sendJellyfinDiscovery();
	}, SCAN_INTERVAL);
}

var discover = service.register("discover");
discover.on("request", function (message) {
	sendScanResults();
	var uniqueToken = message.uniqueToken;

	sendJellyfinDiscovery();

	if (message.isSubscription) {
		subscriptions[uniqueToken] = message;
		if (!interval) {
			createInterval();
		}
	}
});
discover.on("cancel", function (message) {
	var uniqueToken = message.uniqueToken;
	delete subscriptions[uniqueToken];
	var keys = Object.keys(subscriptions);
	if (keys.length === 0) {
		clearInterval(interval);
		interval = undefined;
	}
});

// ==================== Jellyseerr Proxy ====================

var http = require('http');
var https = require('https');
var url = require('url');

// Cookie storage per user
var cookieJars = {};

/**
 * Parse Set-Cookie headers and store cookies
 */
function storeCookies(userId, headers, requestUrl) {
	if (!headers || !headers['set-cookie']) {
		return;
	}
	
	if (!cookieJars[userId]) {
		cookieJars[userId] = [];
	}
	
	var setCookieHeaders = Array.isArray(headers['set-cookie']) 
		? headers['set-cookie'] 
		: [headers['set-cookie']];
	
	var domain = url.parse(requestUrl).hostname;
	
	setCookieHeaders.forEach(function(cookieStr) {
		var cookie = parseCookie(cookieStr);
		if (cookie) {
			cookie.domain = domain;
			// Remove existing cookie with same name
			cookieJars[userId] = cookieJars[userId].filter(function(c) {
				return c.name !== cookie.name || c.domain !== cookie.domain;
			});
			// Add new cookie
			cookieJars[userId].push(cookie);
		}
	});
	
	console.log('[JellyseerrProxy] Stored ' + setCookieHeaders.length + ' cookies for user: ' + userId);
	console.log('[JellyseerrProxy] Total cookies in jar: ' + cookieJars[userId].length);
	if (cookieJars[userId].length > 0) {
		console.log('[JellyseerrProxy] Cookie names: ' + cookieJars[userId].map(function(c) { return c.name; }).join(', '));
	}
}

/**
 * Parse a single cookie string
 */
function parseCookie(cookieStr) {
	var parts = cookieStr.split(';');
	if (parts.length === 0) return null;
	
	var nameValue = parts[0].trim().split('=');
	if (nameValue.length < 2) return null;
	
	var cookie = {
		name: nameValue[0],
		value: nameValue.slice(1).join('='),
		expires: null,
		path: '/',
		httpOnly: false,
		secure: false
	};
	
	for (var i = 1; i < parts.length; i++) {
		var part = parts[i].trim().toLowerCase();
		if (part === 'httponly') {
			cookie.httpOnly = true;
		} else if (part === 'secure') {
			cookie.secure = true;
		} else if (part.startsWith('path=')) {
			cookie.path = part.substring(5);
		} else if (part.startsWith('expires=')) {
			cookie.expires = new Date(part.substring(8));
		} else if (part.startsWith('max-age=')) {
			var maxAge = parseInt(part.substring(8));
			cookie.expires = new Date(Date.now() + maxAge * 1000);
		}
	}
	
	return cookie;
}

/**
 * Get cookies for a request
 */
function getCookies(userId, requestUrl) {
	if (!cookieJars[userId] || cookieJars[userId].length === 0) {
		return '';
	}
	
	var domain = url.parse(requestUrl).hostname;
	var now = new Date();
	
	// Filter expired cookies
	cookieJars[userId] = cookieJars[userId].filter(function(cookie) {
		return !cookie.expires || cookie.expires > now;
	});
	
	// Get matching cookies
	var cookies = cookieJars[userId]
		.filter(function(cookie) {
			return cookie.domain === domain;
		})
		.map(function(cookie) {
			return cookie.name + '=' + cookie.value;
		});
	
	return cookies.join('; ');
}

/**
 * Jellyseerr HTTP proxy request with cookie support
 */
service.register('jellyseerrRequest', function(message) {
	console.log('[JellyseerrProxy] Request received');
	
	var userId = message.payload.userId;
	var requestUrl = message.payload.url;
	var method = message.payload.method || 'GET';
	var headers = message.payload.headers || {};
	var body = message.payload.body;
	var timeout = message.payload.timeout || 30000;
	
	if (!userId || !requestUrl) {
		message.respond({
			success: false,
			error: 'Missing userId or url'
		});
		return;
	}
	
	console.log('[JellyseerrProxy] ' + method + ' ' + requestUrl + ' (user: ' + userId + ')');
	
	// Add cookies to request
	var cookieHeader = getCookies(userId, requestUrl);
	if (cookieHeader) {
		headers['Cookie'] = cookieHeader;
		console.log('[JellyseerrProxy] Added cookies: ' + cookieHeader.substring(0, 100));
	} else {
		console.log('[JellyseerrProxy] No cookies found for user: ' + userId + ', URL: ' + requestUrl);
		console.log('[JellyseerrProxy] Cookie jar has ' + (cookieJars[userId] ? cookieJars[userId].length : 0) + ' cookies');
	}
	
	// Parse URL
	var parsedUrl = url.parse(requestUrl);
	var isHttps = parsedUrl.protocol === 'https:';
	var httpModule = isHttps ? https : http;
	
	// Request options
	var options = {
		hostname: parsedUrl.hostname,
		port: parsedUrl.port || (isHttps ? 443 : 80),
		path: parsedUrl.path,
		method: method,
		headers: headers,
		timeout: timeout
	};
	
	// Make request
	var req = httpModule.request(options, function(res) {
		var responseBody = '';
		
		// Store cookies from response
		storeCookies(userId, res.headers, requestUrl);
		
		res.on('data', function(chunk) {
			responseBody += chunk;
		});
		
		res.on('end', function() {
			console.log('[JellyseerrProxy] Response: ' + res.statusCode + ' (' + responseBody.length + ' bytes)');
			
			message.respond({
				success: true,
				status: res.statusCode,
				headers: res.headers,
				body: responseBody
			});
		});
	});
	
	req.on('error', function(err) {
		console.error('[JellyseerrProxy] Request failed:', err.message);
		message.respond({
			success: false,
			error: err.message
		});
	});
	
	req.on('timeout', function() {
		console.error('[JellyseerrProxy] Request timeout');
		req.abort();
		message.respond({
			success: false,
			error: 'Request timeout'
		});
	});
	
	// Send request body
	if (body) {
		req.write(body);
	}
	
	req.end();
});

/**
 * Clear cookies for a user
 */
service.register('jellyseerrClearCookies', function(message) {
	var userId = message.payload.userId;
	var domain = message.payload.domain;
	
	if (!userId) {
		message.respond({
			success: false,
			error: 'Missing userId'
		});
		return;
	}
	
	if (domain) {
		// Clear cookies for specific domain
		if (cookieJars[userId]) {
			cookieJars[userId] = cookieJars[userId].filter(function(cookie) {
				return cookie.domain !== domain;
			});
			console.log('[JellyseerrProxy] Cleared cookies for domain: ' + domain + ' (user: ' + userId + ')');
		}
	} else {
		// Clear all cookies
		delete cookieJars[userId];
		console.log('[JellyseerrProxy] Cleared all cookies for user: ' + userId);
	}
	
	message.respond({
		success: true
	});
});

/**
 * Image proxy for TMDB images (bypasses SSL certificate issues on old webOS)
 */
service.register('imageProxy', function(message) {
	var imageUrl = message.payload.url;
	
	if (!imageUrl) {
		message.respond({
			success: false,
			error: 'Missing image URL'
		});
		return;
	}
	
	logToFile('[ImageProxy] Proxying: ' + imageUrl);
	
	var parsedUrl = url.parse(imageUrl);
	var isHttps = parsedUrl.protocol === 'https:';
	var httpModule = isHttps ? https : http;
	
	var options = {
		hostname: parsedUrl.hostname,
		port: parsedUrl.port || (isHttps ? 443 : 80),
		path: parsedUrl.path,
		method: 'GET',
		headers: {
			'User-Agent': 'Moonfin/1.0'
		},
		rejectUnauthorized: false // Accept any SSL cert
	};
	
	var req = httpModule.request(options, function(res) {
		var chunks = [];
		
		res.on('data', function(chunk) {
			chunks.push(chunk);
		});
		
		res.on('end', function() {
			var buffer = Buffer.concat(chunks);
			var base64 = buffer.toString('base64');
			var contentType = res.headers['content-type'] || 'image/jpeg';
			
			message.respond({
				success: true,
				data: 'data:' + contentType + ';base64,' + base64,
				contentType: contentType,
				statusCode: res.statusCode
			});
		});
	});
	
	req.on('error', function(err) {
		logToFile('[ImageProxy] Error: ' + err.message);
		message.respond({
			success: false,
			error: err.message
		});
	});
	
	req.setTimeout(10000, function() {
		req.abort();
		message.respond({
			success: false,
			error: 'Request timeout'
		});
	});
	
	req.end();
});

/**
 * Status check for Jellyseerr proxy
 */
service.register('jellyseerrStatus', function(message) {
	logToFile('[Service] jellyseerrStatus called!');
	logToFile('[Service] Payload: ' + JSON.stringify(message.payload));
	var userId = message.payload.userId;
	var cookieCount = (cookieJars[userId] || []).length;
	
	logToFile('[Service] Responding with success');
	message.respond({
		success: true,
		running: true,
		userId: userId,
		cookieCount: cookieCount
	});
});

logToFile('[Service] jellyseerrStatus method registered');
logToFile('[Service] All Jellyseerr proxy methods registered');
logToFile('[Service] Service ready!');
