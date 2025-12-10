/*
 * Jellyfin API Client for webOS
 * Handles server discovery, authentication, and API calls
 */

var JellyfinAPI = (function() {
    'use strict';

    const LOG_LEVELS = {
        ERROR: 0,
        WARN: 1,
        SUCCESS: 2,
        INFO: 3
    };
    
    let currentLogLevel = LOG_LEVELS.ERROR;

    const Logger = {
        setLevel: function(level) {
            currentLogLevel = level;
        },
        info: function(message, data) {
            if (currentLogLevel >= LOG_LEVELS.INFO) {
                console.log('[Jellyfin INFO]', message, data || '');
            }
        },
        success: function(message, data) {
            if (currentLogLevel >= LOG_LEVELS.SUCCESS) {
                console.log('[Jellyfin SUCCESS]', message, data || '');
            }
        },
        error: function(message, data) {
            if (currentLogLevel >= LOG_LEVELS.ERROR) {
                console.error('[Jellyfin ERROR]', message, data || '');
            }
        },
        warn: function(message, data) {
            if (currentLogLevel >= LOG_LEVELS.WARN) {
                console.warn('[Jellyfin WARN]', message, data || '');
            }
        }
    };

    let deviceId = null;
    const deviceName = 'LG Smart TV';
    const appName = 'Jellyfin for webOS';
    const appVersion = '1.2.2';

    const SERVER_DISCOVERY_TIMEOUT_MS = 5000;
    const LAN_SCAN_TIMEOUT_MS = 2000;

    function initDeviceId() {
        deviceId = storage.get('_deviceId2', false);
        if (!deviceId) {
            deviceId = btoa([navigator.userAgent, new Date().getTime()].join('|')).replace(/=/g, '1');
            storage.set('_deviceId2', deviceId, false);
            Logger.info('Generated new device ID:', deviceId);
        }
        return deviceId;
    }

    function getAuthHeader(accessToken) {
        var header = 'MediaBrowser Client="' + appName + '", Device="' + deviceName + '", DeviceId="' + deviceId + '", Version="' + appVersion + '"';
        if (accessToken) {
            header += ', Token="' + accessToken + '"';
        }
        return header;
    }

    function discoverServers(callback) {
        Logger.info('Starting server discovery...');
        
        var discoveryUrl = 'https://jellyfin.org/api/v1/servers';
        
        ajax.request(discoveryUrl, {
            method: 'GET',
            timeout: SERVER_DISCOVERY_TIMEOUT_MS,
            success: function(response) {
                Logger.success('Server discovery completed', response);
                if (callback) callback(null, response);
            },
            error: function(err) {
                Logger.warn('Server discovery via jellyfin.org failed, trying local discovery', err);
                discoverLocalServers(callback);
            }
        });
    }

    function discoverLocalServers(callback) {
        Logger.info('Attempting local network discovery - scanning LAN for port 8096...');
        
        var localIP = getLocalIPPrefix();
        Logger.info('Detected local network:', localIP);
        
        var addressesToScan = [];
        
        addressesToScan.push('http://localhost:8096');
        addressesToScan.push('http://127.0.0.1:8096');
        addressesToScan.push('http://jellyfin:8096');
        
        if (localIP) {
            for (var i = 1; i <= 255; i++) {
                addressesToScan.push('http://' + localIP + i + ':8096');
            }
        } else {
            for (var i = 1; i <= 255; i++) {
                addressesToScan.push('http://192.168.1.' + i + ':8096');
            }
            for (var i = 1; i <= 50; i++) {
                addressesToScan.push('http://192.168.0.' + i + ':8096');
            }
            for (var i = 1; i <= 50; i++) {
                addressesToScan.push('http://10.0.0.' + i + ':8096');
            }
        }
        
        Logger.info('Scanning ' + addressesToScan.length + ' IP addresses for Jellyfin servers...');
        
        var foundServers = [];
        var checkedCount = 0;
        var totalToCheck = addressesToScan.length;
        
        var batchSize = 20;
        var currentBatch = 0;
        
        function scanBatch() {
            var start = currentBatch * batchSize;
            var end = Math.min(start + batchSize, totalToCheck);
            
            for (var i = start; i < end; i++) {
                (function(address) {
                    testServer(address, function(err, serverInfo) {
                        checkedCount++;
                        
                        if (!err && serverInfo) {
                            foundServers.push(serverInfo);
                            Logger.success('Found server at:', address);
                        }
                        
                        if (checkedCount % 50 === 0) {
                            Logger.info('Scan progress: ' + checkedCount + '/' + totalToCheck);
                        }
                        
                        if (checkedCount === totalToCheck) {
                            if (foundServers.length > 0) {
                                Logger.success('Scan complete! Found ' + foundServers.length + ' server(s)', foundServers);
                                if (callback) callback(null, foundServers);
                            } else {
                                Logger.warn('Scan complete. No servers found on port 8096');
                                if (callback) callback({ error: 'No servers found' }, null);
                            }
                        }
                    });
                })(addressesToScan[i]);
            }
            
            currentBatch++;
            if (end < totalToCheck) {
                setTimeout(scanBatch, 100);
            }
        }
        
        scanBatch();
    }
    
    function getLocalIPPrefix() {
        try {
            return null;
        } catch (e) {
            Logger.warn('Could not detect local IP, using default ranges');
            return null;
        }
    }
    
    function normalizeServerAddress(address) {
        if (!address || typeof address !== 'string') {
            Logger.error('Invalid address provided to normalizeServerAddress:', address);
            return null;
        }
        
        address = address.trim();
        
        if (address === '') {
            Logger.error('Empty address after trim');
            return null;
        }
        
        address = address.replace(/\/+$/, '');
        
        if (!/^https?:\/\//i.test(address)) {
            address = 'http://' + address;
        }
        
        var hasPort = false;
        try {
            var match = address.match(/:(\d+)$/);
            if (match) {
                hasPort = true;
            }
        } catch (e) {
            Logger.warn('Error parsing address:', address);
        }
        
        if (!hasPort) {
            address = address + ':8096';
            Logger.info('No port specified, added default :8096 to address');
        }
        
        Logger.info('Normalized address:', address);
        return address;
    }

    function testServer(address, callback) {
        address = normalizeServerAddress(address);
        
        if (!address) {
            Logger.error('Invalid server address');
            if (callback) callback({ error: 'Invalid address' }, null);
            return;
        }
        
        ajax.request(address + '/System/Info/Public', {
            method: 'GET',
            timeout: LAN_SCAN_TIMEOUT_MS,
            headers: {
                'X-Emby-Authorization': getAuthHeader()
            },
            success: function(response) {
                if (callback) callback(null, {
                    address: address,
                    name: response.ServerName || 'Jellyfin Server',
                    id: response.Id,
                    version: response.Version,
                    operatingSystem: response.OperatingSystem
                });
            },
            error: function(err) {
                if (callback) callback(err, null);
            }
        });
    }

    function authenticateByName(serverAddress, username, password, callback) {
        if (!serverAddress || typeof serverAddress !== 'string' || serverAddress.trim() === '') {
            Logger.error('Invalid server address provided to authenticateByName');
            if (callback) callback({ error: 'Invalid server address' }, null);
            return;
        }
        
        if (!username || typeof username !== 'string' || username.trim() === '') {
            Logger.error('Invalid username provided to authenticateByName');
            if (callback) callback({ error: 'Username is required' }, null);
            return;
        }
        
        if (password === null || password === undefined) {
            Logger.error('Password is null or undefined');
            if (callback) callback({ error: 'Password must be provided (can be empty string)' }, null);
            return;
        }
        
        Logger.info('Attempting authentication for user:', username);
        
        var authUrl = serverAddress + '/Users/AuthenticateByName';
        
        ajax.request(authUrl, {
            method: 'POST',
            headers: {
                'X-Emby-Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            },
            data: {
                Username: username,
                Pw: password
            },
            success: function(response) {
                Logger.success('Authentication successful!', {
                    user: response.User.Name,
                    userId: response.User.Id,
                    serverId: response.ServerId,
                    hasAccessToken: !!response.AccessToken
                });
                
                var authData = {
                    serverAddress: serverAddress,
                    accessToken: response.AccessToken,
                    userId: response.User.Id,
                    username: response.User.Name,
                    serverId: response.ServerId,
                    serverName: response.ServerName || 'Jellyfin Server'
                };
                
                Logger.info('=== STORING AUTHENTICATION ===');
                Logger.info('Auth data to store:', authData);
                storage.set('jellyfin_auth', authData);
                
                var verification = storage.get('jellyfin_auth');
                if (verification && verification.accessToken === authData.accessToken) {
                    Logger.success('Authentication data successfully stored and verified!');
                } else {
                    Logger.error('WARNING: Storage verification failed! Auth may not persist!');
                    Logger.error('Stored:', verification);
                }
                
                if (callback) callback(null, authData);
            },
            error: function(err) {
                Logger.error('Authentication failed!', err);
                if (callback) callback(err, null);
            }
        });
    }

    function getUserInfo(serverAddress, userId, accessToken, callback) {
        Logger.info('Fetching user info for userId:', userId);
        
        var userUrl = serverAddress + '/Users/' + userId;
        
        ajax.request(userUrl, {
            method: 'GET',
            headers: {
                'X-Emby-Authorization': getAuthHeader(accessToken)
            },
            success: function(response) {
                Logger.success('User info retrieved:', response.Name);
                if (callback) callback(null, response);
            },
            error: function(err) {
                Logger.error('Failed to get user info:', err);
                if (callback) callback(err, null);
            }
        });
    }

    function logout() {
        Logger.info('Logging out and clearing stored credentials');
        storage.remove('jellyfin_auth');
        Logger.success('Logout complete');
    }

    function getStoredAuth() {
        Logger.info('=== CHECKING STORED AUTHENTICATION ===');
        
        if (typeof localStorage !== 'undefined') {
            Logger.info('localStorage is available');
            try {
                var rawData = localStorage.getItem('jellyfin_auth');
                Logger.info('Raw jellyfin_auth data:', rawData ? rawData.substring(0, 100) + '...' : 'null');
            } catch (e) {
                Logger.error('Error accessing localStorage:', e);
            }
        }
        
        var auth = storage.get('jellyfin_auth');
        if (auth) {
            Logger.success('Found stored authentication for user:', auth.username);
            Logger.info('Server:', auth.serverAddress);
            Logger.info('Has access token:', !!auth.accessToken);
        } else {
            Logger.warn('No stored authentication found - user needs to log in');
        }
        return auth;
    }

    function getUserViews(serverAddress, userId, accessToken, callback) {
        Logger.info('Fetching user views for userId:', userId);
        
        var viewsUrl = serverAddress + '/Users/' + userId + '/Views';
        
        ajax.request(viewsUrl, {
            method: 'GET',
            headers: {
                'X-Emby-Authorization': getAuthHeader(accessToken)
            },
            success: function(response) {
                Logger.success('User views retrieved:', response.Items.length + ' libraries');
                if (callback) callback(null, response);
            },
            error: function(err) {
                Logger.error('Failed to get user views:', err);
                if (callback) callback(err, null);
            }
        });
    }

    function getItems(serverAddress, accessToken, endpoint, params, callback) {
        var queryString = '';
        if (params) {
            var parts = [];
            for (var key in params) {
                if (params.hasOwnProperty(key)) {
                    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
                }
            }
            queryString = '?' + parts.join('&');
        }
        
        var url = serverAddress + endpoint + queryString;
        
        ajax.request(url, {
            method: 'GET',
            headers: {
                'X-Emby-Authorization': getAuthHeader(accessToken)
            },
            success: function(response) {
                if (callback) callback(null, response);
            },
            error: function(err) {
                Logger.error('Failed to get items from:', endpoint, err);
                if (callback) callback(err, null);
            }
        });
    }

    function setFavorite(serverAddress, userId, accessToken, itemId, isFavorite, callback) {
        var endpoint = '/Users/' + userId + '/FavoriteItems/' + itemId;
        var method = isFavorite ? 'POST' : 'DELETE';
        
        ajax.request(serverAddress + endpoint, {
            method: method,
            headers: {
                'X-Emby-Authorization': getAuthHeader(accessToken)
            },
            success: function(response) {
                Logger.success('Favorite status updated:', isFavorite);
                if (callback) callback(null, response);
            },
            error: function(err) {
                Logger.error('Failed to update favorite status:', err);
                if (callback) callback(err, null);
            }
        });
    }

    function setPlayed(serverAddress, userId, accessToken, itemId, isPlayed, callback) {
        var endpoint = '/Users/' + userId + '/PlayedItems/' + itemId;
        var method = isPlayed ? 'POST' : 'DELETE';
        
        ajax.request(serverAddress + endpoint, {
            method: method,
            headers: {
                'X-Emby-Authorization': getAuthHeader(accessToken)
            },
            success: function(response) {
                Logger.success('Played status updated:', isPlayed);
                if (callback) callback(null, response);
            },
            error: function(err) {
                Logger.error('Failed to update played status:', err);
                if (callback) callback(err, null);
            }
        });
    }

    function getPublicUsers(serverAddress, callback) {
        var endpoint = serverAddress + '/Users/Public';
        
        ajax.request(endpoint, {
            method: 'GET',
            headers: {
                'X-Emby-Authorization': getAuthHeader()
            },
            success: function(response) {
                Logger.info('Retrieved public users:', response.length);
                if (callback) callback(null, response);
            },
            error: function(err) {
                Logger.error('Failed to get public users:', err);
                if (callback) callback(err, null);
            }
        });
    }

    function getUserImageUrl(serverAddress, userId, imageTag) {
        if (!imageTag) return null;
        return serverAddress + '/Users/' + userId + '/Images/Primary?tag=' + imageTag + '&quality=90&maxWidth=400';
    }

    function initiateQuickConnect(serverAddress, callback) {
        var endpoint = serverAddress + '/QuickConnect/Initiate';
        
        ajax.request(endpoint, {
            method: 'POST',
            headers: {
                'X-Emby-Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            },
            success: function(response) {
                Logger.info('Quick Connect initiated:', response.Code);
                if (callback) callback(null, response);
            },
            error: function(err) {
                Logger.error('Failed to initiate Quick Connect:', err);
                if (callback) callback(err, null);
            }
        });
    }

    function checkQuickConnectStatus(serverAddress, secret, callback) {
        var endpoint = serverAddress + '/QuickConnect/Connect?secret=' + encodeURIComponent(secret);
        
        ajax.request(endpoint, {
            method: 'GET',
            headers: {
                'X-Emby-Authorization': getAuthHeader()
            },
            success: function(response) {
                if (callback) callback(null, response);
            },
            error: function(err) {
                Logger.error('Failed to check Quick Connect status:', err);
                if (callback) callback(err, null);
            }
        });
    }

    function authenticateQuickConnect(serverAddress, secret, callback) {
        var endpoint = serverAddress + '/Users/AuthenticateWithQuickConnect';
        
        ajax.request(endpoint, {
            method: 'POST',
            headers: {
                'X-Emby-Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            },
            data: {
                Secret: secret
            },
            success: function(response) {
                Logger.success('Quick Connect authentication successful!', {
                    user: response.User.Name,
                    userId: response.User.Id
                });
                
                // Store credentials
                var authData = {
                    serverAddress: serverAddress,
                    accessToken: response.AccessToken,
                    userId: response.User.Id,
                    username: response.User.Name,
                    serverId: response.ServerId,
                    serverName: response.ServerName || 'Jellyfin Server'
                };
                
                storage.set('jellyfin_auth', authData);
                
                if (callback) callback(null, response);
            },
            error: function(err) {
                Logger.error('Quick Connect authentication failed:', err);
                if (callback) callback(err, null);
            }
        });
    }

    return {
        init: initDeviceId,
        discoverServers: discoverServers,
        testServer: testServer,
        normalizeServerAddress: normalizeServerAddress,
        authenticateByName: authenticateByName,
        getPublicUsers: getPublicUsers,
        getUserImageUrl: getUserImageUrl,
        initiateQuickConnect: initiateQuickConnect,
        checkQuickConnectStatus: checkQuickConnectStatus,
        authenticateQuickConnect: authenticateQuickConnect,
        getUserInfo: getUserInfo,
        getUserViews: getUserViews,
        getItems: getItems,
        setFavorite: setFavorite,
        setPlayed: setPlayed,
        logout: logout,
        getStoredAuth: getStoredAuth,
        getAuthHeader: getAuthHeader,
        Logger: Logger,
        LOG_LEVELS: LOG_LEVELS
    };
})();
