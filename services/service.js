// -*- coding: utf-8 -*-

/*
 * Backend node.js service for server autodiscovery.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

var pkgInfo = require('./package.json');
var Service = require('webos-service');

// Register com.yourdomain.@DIR@.service, on both buses
var service = new Service(pkgInfo.name);

var dgram = require('dgram');
var client4 = dgram.createSocket("udp4");

// var client6;
// try {
// 	client6 = dgram.createSocket("udp6");
// } catch (err) {
// 	console.log(err);
// 	client6 = false;
// }

const JELLYFIN_DISCOVERY_PORT = 7359;
const JELLYFIN_DISCOVERY_MESSAGE = "who is JellyfinServer?";

const SCAN_INTERVAL = 15 * 1000;
const SCAN_ON_START = true;
const ENABLE_IP_SCAN = true; // Fallback to IP scanning if broadcast discovery fails

var scanresult = {};
var ipScanInProgress = false;
var scannedIPs = new Set();

function sendScanResults(server_id) {
	console.log("Sending responses, subscription count=" + Object.keys(subscriptions).length);
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
	var msg = new Buffer(JELLYFIN_DISCOVERY_MESSAGE);
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
	if (scannedIPs.has(ip)) {
		return; // Already checked this IP
	}
	scannedIPs.add(ip);
	
	var http = require('http');
	var ports = [8096, 8920]; // Common Jellyfin ports
	var schemes = ['http', 'https'];
	
	ports.forEach(function(port) {
		schemes.forEach(function(scheme) {
			var url = scheme + '://' + ip + ':' + port + '/System/Info/Public';
			
			var req = http.get(url, { timeout: 2000 }, function(res) {
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
							console.log('Found Jellyfin server at ' + ip + ':' + port);
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
	scannedIPs.clear();
	console.log('Starting IP subnet scan...');
	
	var networkPrefix = getLocalNetworkPrefix();
	console.log('Scanning network: ' + networkPrefix + '.0/24');
	
	// Scan all IPs in the subnet (1-254)
	var currentIP = 1;
	
	function scanNext() {
		if (currentIP > 254) {
			console.log('IP scan complete. Scanned ' + scannedIPs.size + ' addresses.');
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
	console.log('UDP Client listening on ' + address.address + ":" + address.port);
	client4.setBroadcast(true)
	client4.setMulticastTTL(128);
	//client.addMembership('230.185.192.108');
});

client4.on("message", handleDiscoveryResponse);
client4.bind({
	port: JELLYFIN_DISCOVERY_PORT
}, discoverInitial);


// if (client6) {
// 	client6.on("listening", function () {
// 		var address = client4.address();
// 		console.log('UDP Client listening on ' + address.address + ":" + address.port);
// 		client6.setMulticastTTL(128);
// 		//client.addMembership('230.185.192.108');
// 	});

// 	client6.on("message", handleDiscoveryResponse);

// 	try { // client6 bind failing even in a try catch.
// 		//client6.bind(JELLYFIN_DISCOVERY_PORT, discoverInitial);
// 	} catch (err) {
// 		console.log(err);
// 	}
// }


var interval;
var subscriptions = {};

function createInterval() {
	if (interval) {
		return;
	}
	console.log("create new interval");
	interval = setInterval(function () {
		sendJellyfinDiscovery();
	}, SCAN_INTERVAL);
}

var discover = service.register("discover");
discover.on("request", function (message) {
	sendScanResults();
	var uniqueToken = message.uniqueToken;
	console.log("discover callback, uniqueToken: " + uniqueToken + ", token: " + message.token);

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
	console.log("Canceled " + uniqueToken);
	delete subscriptions[uniqueToken];
	var keys = Object.keys(subscriptions);
	if (keys.length === 0) {
		console.log("no more subscriptions, canceling interval");
		clearInterval(interval);
		interval = undefined;
	}
});
