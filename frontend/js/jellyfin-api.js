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

    function getSystemInfo(address, accessToken, callback) {
        address = normalizeServerAddress(address);
        
        ajax.request(address + '/System/Info', {
            method: 'GET',
            headers: {
                'X-Emby-Authorization': getAuthHeader(accessToken),
                'X-MediaBrowser-Token': accessToken
            },
            success: function(response) {
                if (callback) callback(null, response);
            },
            error: function(err) {
                Logger.error('Failed to get system info:', err);
                if (callback) callback(err, null);
            }
        });
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
        
        // Unsupported collection types
        var unsupportedCollectionTypes = ['books', 'folders'];
        
        ajax.request(viewsUrl, {
            method: 'GET',
            headers: {
                'X-Emby-Authorization': getAuthHeader(accessToken)
            },
            success: function(response) {
                if (!response || !response.Items) {
                    Logger.error('Invalid user views response - missing Items');
                    if (callback) callback(new Error('Invalid response'), null);
                    return;
                }
                
                Logger.info('Raw user views retrieved:', response.Items.length, 'libraries');
                
                // Filter out unsupported collection types and empty libraries
                var totalItems = response.Items.length;
                response.Items = response.Items.filter(function(view) {
                    var collectionType = view.CollectionType ? view.CollectionType.toLowerCase() : '';
                    
                    // Check if collection type is supported
                    var isSupported = unsupportedCollectionTypes.indexOf(collectionType) === -1;
                    if (!isSupported) {
                        Logger.info('Filtering out unsupported library:', view.Name, 
                            '(Type:', view.CollectionType + ')');
                        return false;
                    }
                    
                    // Check if library has content (skip empty libraries)
                    var hasContent = view.ChildCount === undefined || view.ChildCount > 0;
                    if (!hasContent) {
                        Logger.info('Filtering out empty library:', view.Name, '(ChildCount: 0)');
                        return false;
                    }
                    
                    Logger.info('Supporting library:', view.Name,
                        '(Type:', view.CollectionType || 'unknown',
                        'Items:', view.ChildCount || 0 + ')');
                    return true;
                });
                
                var filteredCount = totalItems - response.Items.length;
                if (filteredCount > 0) {
                    Logger.info('Filtered out', filteredCount, 'unsupported/empty libraries');
                }
                
                Logger.success('User views ready:', response.Items.length, 'supported libraries');
                
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

    /**
     * Get resume items (Continue Watching) for the user
     */
    function getResumeItems(serverAddress, userId, accessToken, callback) {
        Logger.info('Fetching resume items for userId:', userId);
        
        var params = {
            Limit: 50, // ITEM_LIMIT_RESUME
            Recursive: true,
            Fields: 'PrimaryImageAspectRatio,BasicSyncInfo,MediaSourceCount,ProductionYear,ChildCount,RecursiveItemCount',
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Thumb',
            MediaTypes: 'Video'
        };
        
        var endpoint = '/Users/' + userId + '/Items/Resume';
        
        getItems(serverAddress, accessToken, endpoint, params, function(err, response) {
            if (err) {
                Logger.error('Failed to get resume items:', err);
                if (callback) callback(err, null);
                return;
            }
            
            Logger.success('Resume items retrieved:', response.Items ? response.Items.length : 0);
            if (callback) callback(null, response);
        });
    }

    /**
     * Get next up episodes for TV shows
     */
    function getNextUpItems(serverAddress, userId, accessToken, callback) {
        Logger.info('Fetching next up items for userId:', userId);
        
        var params = {
            Limit: 50, // ITEM_LIMIT_NEXT_UP
            Fields: 'PrimaryImageAspectRatio,BasicSyncInfo,MediaSourceCount,ProductionYear,ChildCount,RecursiveItemCount',
            UserId: userId,
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Thumb'
        };
        
        var endpoint = '/Shows/NextUp';
        
        getItems(serverAddress, accessToken, endpoint, params, function(err, response) {
            if (err) {
                Logger.error('Failed to get next up items:', err);
                if (callback) callback(err, null);
                return;
            }
            
            Logger.success('Next up items retrieved:', response.Items ? response.Items.length : 0);
            if (callback) callback(null, response);
        });
    }

    /**
     * Get latest media items for a library
     */
    function getLatestMedia(serverAddress, userId, accessToken, parentId, includeItemTypes, callback) {
        Logger.info('Fetching latest media for parentId:', parentId, 'types:', includeItemTypes);
        
        var params = {
            Limit: 50,
            Fields: 'PrimaryImageAspectRatio,BasicSyncInfo,ProductionYear,ChildCount,RecursiveItemCount',
            ParentId: parentId,
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Thumb'
        };
        
        if (includeItemTypes) {
            params.IncludeItemTypes = includeItemTypes;
        }
        
        var endpoint = '/Users/' + userId + '/Items/Latest';
        
        getItems(serverAddress, accessToken, endpoint, params, function(err, response) {
            if (err) {
                Logger.error('Failed to get latest media:', err);
                if (callback) callback(err, null);
                return;
            }
            
            // Latest endpoint returns Items directly (not in TotalRecordCount wrapper)
            var items = response.Items || response;
            if (!Array.isArray(items)) {
                items = [items];
            }
            
            Logger.success('Latest media retrieved:', items.length, 'items');
            
            // Wrap in standard response format if needed
            var result = response.Items ? response : { Items: items, TotalRecordCount: items.length };
            
            if (callback) callback(null, result);
        });
    }

    /**
     * Check if Live TV is available and get channel count
     */
    function getLiveTVInfo(serverAddress, userId, accessToken, callback) {
        Logger.info('Checking Live TV availability for userId:', userId);
        
        // First check if user has Live TV library access
        getUserViews(serverAddress, userId, accessToken, function(err, views) {
            if (err) {
                Logger.error('Failed to check Live TV views:', err);
                if (callback) callback(err, null);
                return;
            }
            
            // Look for LiveTV collection type
            var liveTVView = views.Items.find(function(view) {
                return view.CollectionType && view.CollectionType.toLowerCase() === 'livetv';
            });
            
            if (!liveTVView) {
                Logger.info('No Live TV library found');
                if (callback) callback(null, { available: false, channelCount: 0 });
                return;
            }
            
            // Get channel count
            var params = {
                UserId: userId,
                Limit: 1,
                Fields: 'ChannelInfo'
            };
            
            getItems(serverAddress, accessToken, '/LiveTv/Channels', params, function(err, response) {
                if (err) {
                    Logger.warn('Failed to get Live TV channels:', err);
                    if (callback) callback(null, { available: false, channelCount: 0 });
                    return;
                }
                
                var channelCount = response.TotalRecordCount || 0;
                Logger.success('Live TV available:', channelCount, 'channels');
                
                if (callback) callback(null, { 
                    available: channelCount > 0, 
                    channelCount: channelCount,
                    viewId: liveTVView.Id
                });
            });
        });
    }

    /**
     * Get Live TV channels
     */
    function getLiveTVChannels(serverAddress, userId, accessToken, callback) {
        Logger.info('Fetching Live TV channels for userId:', userId);
        
        var params = {
            UserId: userId,
            Limit: 50,
            Fields: 'PrimaryImageAspectRatio,ChannelInfo',
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop',
            SortBy: 'SortName',
            SortOrder: 'Ascending'
        };
        
        var endpoint = '/LiveTv/Channels';
        
        getItems(serverAddress, accessToken, endpoint, params, function(err, response) {
            if (err) {
                Logger.error('Failed to get Live TV channels:', err);
                if (callback) callback(err, null);
                return;
            }
            
            Logger.success('Live TV channels retrieved:', response.Items ? response.Items.length : 0);
            if (callback) callback(null, response);
        });
    }

    /**
     * Get Live TV recordings
     */
    function getLiveTVRecordings(serverAddress, userId, accessToken, callback) {
        Logger.info('Fetching Live TV recordings for userId:', userId);
        
        var params = {
            UserId: userId,
            Limit: 50,
            Fields: 'PrimaryImageAspectRatio,BasicSyncInfo',
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Thumb',
            SortBy: 'DateCreated',
            SortOrder: 'Descending'
        };
        
        var endpoint = '/LiveTv/Recordings';
        
        getItems(serverAddress, accessToken, endpoint, params, function(err, response) {
            if (err) {
                Logger.error('Failed to get Live TV recordings:', err);
                if (callback) callback(err, null);
                return;
            }
            
            Logger.success('Live TV recordings retrieved:', response.Items ? response.Items.length : 0);
            if (callback) callback(null, response);
        });
    }

    /**
     * Get collections (box sets)
     */
    function getCollections(serverAddress, userId, accessToken, callback) {
        Logger.info('Fetching collections for userId:', userId);
        
        var params = {
            UserId: userId,
            Limit: 50,
            IncludeItemTypes: 'BoxSet',
            Recursive: true,
            Fields: 'PrimaryImageAspectRatio,BasicSyncInfo,ChildCount',
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Thumb',
            SortBy: 'SortName',
            SortOrder: 'Ascending'
        };
        
        var endpoint = '/Users/' + userId + '/Items';
        
        getItems(serverAddress, accessToken, endpoint, params, function(err, response) {
            if (err) {
                Logger.error('Failed to get collections:', err);
                if (callback) callback(err, null);
                return;
            }
            
            Logger.success('Collections retrieved:', response.Items ? response.Items.length : 0);
            if (callback) callback(null, response);
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
        getResumeItems: getResumeItems,
        getNextUpItems: getNextUpItems,
        getLatestMedia: getLatestMedia,
        getLiveTVInfo: getLiveTVInfo,
        getLiveTVChannels: getLiveTVChannels,
        getLiveTVRecordings: getLiveTVRecordings,
        getCollections: getCollections,
        getSystemInfo: getSystemInfo,
        setFavorite: setFavorite,
        setPlayed: setPlayed,
        logout: logout,
        getStoredAuth: getStoredAuth,
        getAuthHeader: getAuthHeader,
        Logger: Logger,
        LOG_LEVELS: LOG_LEVELS
    };
})();
