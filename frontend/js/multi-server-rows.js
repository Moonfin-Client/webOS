/**
 * Multi-Server Row Aggregation
 * 
 * Handles fetching and aggregating home screen rows from multiple Jellyfin servers.
 * Similar to Android TV's MultiServerRepository pattern.
 */

var MultiServerRows = (function() {
    'use strict';
    
    var REQUEST_TIMEOUT_MS = 3000; // 3 second timeout per request
    
    /**
     * Filter servers to only those that are reachable (using ConnectionPool's cache)
     * @param {Array} servers - Array of server objects
     * @returns {Array} - Filtered array of reachable servers
     */
    function filterReachableServers(servers) {
        if (typeof ConnectionPool !== 'undefined' && typeof ConnectionPool.isServerUnreachable === 'function') {
            return servers.filter(function(server) {
                var unreachable = ConnectionPool.isServerUnreachable(server.id);
                if (unreachable) {
                    console.log('[MultiServerRows] Skipping unreachable server:', server.name);
                }
                return !unreachable;
            });
        }
        return servers;
    }
    
    /**
     * Wrap a promise with a timeout
     * @param {Promise} promise - Promise to wrap
     * @param {number} timeoutMs - Timeout in milliseconds
     * @param {string} serverName - Server name for error logging
     * @returns {Promise} - Promise that resolves/rejects within timeout
     */
    function withTimeout(promise, timeoutMs, serverName) {
        return new Promise(function(resolve, reject) {
            var timedOut = false;
            var timer = setTimeout(function() {
                timedOut = true;
                console.log('[MultiServerRows] Request timeout for server:', serverName);
                resolve([]); // Resolve with empty array instead of rejecting
            }, timeoutMs);
            
            promise.then(function(result) {
                if (!timedOut) {
                    clearTimeout(timer);
                    resolve(result);
                }
            }).catch(function(err) {
                if (!timedOut) {
                    clearTimeout(timer);
                    console.warn('[MultiServerRows] Request error for', serverName, err);
                    resolve([]); // Resolve with empty array instead of rejecting
                }
            });
        });
    }
    
    async function getContinueWatching(limit) {
        if (typeof MultiServerManager === 'undefined') {
            return null; // Not in multi-server mode
        }
        
        var servers = MultiServerManager.getAllServersArray();
        if (!servers || servers.length === 0) {
            return [];
        }
        
        // Filter to only reachable servers
        servers = filterReachableServers(servers);
        if (servers.length === 0) {
            return [];
        }
        
        console.log('MultiServerRows: Aggregating Continue Watching from', servers.length, 'servers');
        
        const results = await Promise.all(servers.map(async (server) => {
            return withTimeout(new Promise((resolve, reject) => {
                try {
                    JellyfinAPI.getResumeItems(
                        server.url,
                        server.userId,
                        server.accessToken,
                        function(err, data) {
                            if (err) reject(err);
                            else resolve(data);
                        }
                    );
                } catch (e) {
                    reject(e);
                }
            }).then(function(data) {
                if (data && data.Items) {
                    data.Items.forEach(function(item) {
                        item.ServerUrl = server.url;
                        item.MultiServerId = server.id;
                        item.ServerName = server.name;
                    });
                    return data.Items;
                }
                return [];
            }), REQUEST_TIMEOUT_MS, server.name);
        }));
        
        const allItems = results.flat();
        allItems.sort(function(a, b) {
            const dateA = (a.UserData && a.UserData.LastPlayedDate) ? new Date(a.UserData.LastPlayedDate) : new Date(0);
            const dateB = (b.UserData && b.UserData.LastPlayedDate) ? new Date(b.UserData.LastPlayedDate) : new Date(0);
            return dateB - dateA;
        });
        
        console.log('MultiServerRows: Aggregated', allItems.length, 'Continue Watching items');
        return allItems.slice(0, limit);
    }
    
    async function getNextUp(limit) {
        if (typeof MultiServerManager === 'undefined') {
            return null;
        }
        
        var servers = MultiServerManager.getAllServersArray();
        if (!servers || servers.length === 0) {
            return [];
        }
        
        // Filter to only reachable servers
        servers = filterReachableServers(servers);
        if (servers.length === 0) {
            return [];
        }
        
        console.log('MultiServerRows: Aggregating Next Up from', servers.length, 'servers')
        
        const results = await Promise.all(servers.map(async (server) => {
            return withTimeout(new Promise((resolve, reject) => {
                try {
                    JellyfinAPI.getNextUpItems(
                        server.url,
                        server.userId,
                        server.accessToken,
                        function(err, data) {
                            if (err) reject(err);
                            else resolve(data);
                        }
                    );
                } catch (e) {
                    reject(e);
                }
            }).then(function(data) {
                if (data && data.Items) {
                    data.Items.forEach(function(item) {
                        item.ServerUrl = server.url;
                        item.MultiServerId = server.id;
                        item.ServerName = server.name;
                    });
                    return data.Items;
                }
                return [];
            }), REQUEST_TIMEOUT_MS, server.name);
        }));
        
        const allItems = results.flat();
        allItems.sort(function(a, b) {
            const dateA = new Date(a.PremiereDate || a.DateCreated || 0);
            const dateB = new Date(b.PremiereDate || b.DateCreated || 0);
            return dateB - dateA;
        });
        
        console.log('MultiServerRows: Aggregated', allItems.length, 'Next Up items');
        return allItems.slice(0, limit);
    }
    
    async function getLatestMedia(libraryId, itemType, limit) {
        if (typeof MultiServerManager === 'undefined') {
            return null;
        }
        
        var servers = MultiServerManager.getAllServersArray();
        if (!servers || servers.length === 0) {
            return [];
        }
        
        // Filter to only reachable servers
        servers = filterReachableServers(servers);
        if (servers.length === 0) {
            return [];
        }
        
        console.log('MultiServerRows: Aggregating Latest Media for library', libraryId, 'from', servers.length, 'servers')
        
        const results = await Promise.all(servers.map(async (server) => {
            return withTimeout(new Promise((resolve, reject) => {
                try {
                    JellyfinAPI.getLatestMedia(
                        server.url,
                        server.userId,
                        server.accessToken,
                        libraryId,
                        itemType,
                        function(err, data) {
                            if (err) reject(err);
                            else resolve(data);
                        }
                    );
                } catch (e) {
                    reject(e);
                }
            }).then(function(data) {
                if (data && data.Items) {
                    data.Items.forEach(function(item) {
                        item.ServerUrl = server.url;
                        item.MultiServerId = server.id;
                        item.ServerName = server.name;
                    });
                    return data.Items;
                }
                return [];
            }), REQUEST_TIMEOUT_MS, server.name);
        }));
        
        const allItems = results.flat();
        allItems.sort(function(a, b) {
            const dateA = new Date(a.DateCreated || 0);
            const dateB = new Date(b.DateCreated || 0);
            return dateB - dateA;
        });
        
        console.log('MultiServerRows: Aggregated', allItems.length, 'Latest Media items');
        return allItems.slice(0, limit);
    }
    
    async function getAllLibraries() {
        if (typeof MultiServerManager === 'undefined') {
            return null;
        }
        
        var servers = MultiServerManager.getAllServersArray();
        if (!servers || servers.length === 0) {
            return [];
        }
        
        // Filter to only reachable servers
        servers = filterReachableServers(servers);
        if (servers.length === 0) {
            return [];
        }
        
        const hasMultipleServers = servers.length > 1;
        
        const results = await Promise.all(servers.map(async (server) => {
            return withTimeout(new Promise((resolve, reject) => {
                try {
                    JellyfinAPI.getUserViews(
                        server.url,
                        server.userId,
                        server.accessToken,
                        function(err, data) {
                            if (err) reject(err);
                            else resolve(data);
                        }
                    );
                } catch (e) {
                    reject(e);
                }
            }).then(function(data) {
                if (data && data.Items) {
                    return data.Items.map(function(library) {
                        return {
                            library: library,
                            server: server,
                            displayName: hasMultipleServers ? 
                                library.Name + ' (' + server.name + ')' : 
                                library.Name
                        };
                    });
                }
                return [];
            }), REQUEST_TIMEOUT_MS, server.name);
        }));
        
        const allLibraries = results.flat();
        allLibraries.sort(function(a, b) {
            const nameCompare = a.library.Name.localeCompare(b.library.Name);
            if (nameCompare !== 0) return nameCompare;
            return a.server.name.localeCompare(b.server.name);
        });
        
        return allLibraries;
    }
    
    return {
        getContinueWatching: getContinueWatching,
        getNextUp: getNextUp,
        getLatestMedia: getLatestMedia,
        getAllLibraries: getAllLibraries
    };
})();
