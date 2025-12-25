/**
 * Multi-Server Manager
 * Handles multiple Jellyfin server connections with unified content view
 */

var MultiServerManager = (function() {
    'use strict';

    // Storage key for server data
    var SERVERS_KEY = 'jellyfin_servers';
    var ACTIVE_SERVER_KEY = 'jellyfin_active_server';
    var ACTIVE_USER_KEY = 'jellyfin_active_user';

    /**
     * Get all configured servers (normalized structure)
     * Returns object with serverId -> { server info, users: { userId -> user info } }
     * @returns {Object} Object with server data
     */
    function getAllServers() {
        var serversData = storage.get(SERVERS_KEY, true);
        if (!serversData || typeof serversData !== 'object') {
            return {};
        }
        return serversData;
    }

    /**
     * Get all servers as array (for compatibility)
     * @returns {Array} Array of server objects with embedded user info
     */
    function getAllServersArray() {
        var serversData = getAllServers();
        var result = [];
        
        for (var serverId in serversData) {
            if (serversData.hasOwnProperty(serverId)) {
                var server = serversData[serverId];
                // Return each user as a separate server entry (legacy compatibility)
                var users = server.users || {};
                for (var userId in users) {
                    if (users.hasOwnProperty(userId)) {
                        var user = users[userId];
                        result.push({
                            id: serverId,
                            name: server.name,
                            url: server.url,
                            serverId: serverId,
                            userId: userId,
                            username: user.username,
                            accessToken: user.accessToken,
                            addedDate: server.addedDate,
                            lastConnected: user.lastConnected,
                            connected: user.connected
                        });
                    }
                }
            }
        }
        
        return result;
    }

    /**
     * Get currently active server and user
     * @returns {Object|null} Active server/user object or null
     */
    function getActiveServer() {
        var activeServerId = storage.get(ACTIVE_SERVER_KEY);
        var activeUserId = storage.get(ACTIVE_USER_KEY);
        
        if (!activeServerId || !activeUserId) {
            return null;
        }
        
        var servers = getAllServers();
        var server = servers[activeServerId];
        
        if (!server || !server.users || !server.users[activeUserId]) {
            return null;
        }
        
        var user = server.users[activeUserId];
        
        return {
            id: activeServerId,
            name: server.name,
            url: server.url,
            serverId: activeServerId,
            userId: activeUserId,
            username: user.username,
            accessToken: user.accessToken,
            addedDate: server.addedDate,
            lastConnected: user.lastConnected,
            connected: user.connected
        };
    }

    /**
     * Add a new server or user to existing server
     * @param {string} serverUrl - Server URL
     * @param {string} serverName - Display name for server
     * @param {string} userId - User ID
     * @param {string} username - Username
     * @param {string} accessToken - Access token
     * @returns {Object} Created server/user object
     */
    function addServer(serverUrl, serverName, userId, username, accessToken) {
        var servers = getAllServers();
        
        // Check if server already exists by URL
        var existingServerId = null;
        for (var sId in servers) {
            if (servers.hasOwnProperty(sId) && servers[sId].url === serverUrl) {
                existingServerId = sId;
                break;
            }
        }
        
        var serverId = existingServerId;
        
        // If server doesn't exist, create it
        if (!serverId) {
            serverId = 'server_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            servers[serverId] = {
                id: serverId,
                name: serverName,
                url: serverUrl,
                addedDate: new Date().toISOString(),
                users: {}
            };
            JellyfinAPI.Logger.success('[MULTI-SERVER] Added new server: ' + serverName);
        } else {
            JellyfinAPI.Logger.info('[MULTI-SERVER] Server already exists, adding user');
        }
        
        // Add user to server
        servers[serverId].users[userId] = {
            userId: userId,
            username: username,
            accessToken: accessToken,
            lastConnected: new Date().toISOString(),
            connected: true,
            addedDate: new Date().toISOString()
        };
        
        storage.set(SERVERS_KEY, servers);
        
        // If this is the first user, set it as active
        var hasActiveUser = storage.get(ACTIVE_SERVER_KEY) && storage.get(ACTIVE_USER_KEY);
        if (!hasActiveUser) {
            setActiveServer(serverId, userId);
        }
        
        JellyfinAPI.Logger.success('[MULTI-SERVER] Added user: ' + username + ' to server: ' + serverName);
        
        return {
            id: serverId,
            serverId: serverId,
            userId: userId,
            name: serverName,
            url: serverUrl,
            username: username,
            accessToken: accessToken
        };
    }

    /**
     * Remove a user from a server (or entire server if last user)
     * @param {string} serverId - Server ID
     * @param {string} userId - User ID to remove
     * @returns {boolean} Success status
     */
    function removeServer(serverId, userId) {
        var servers = getAllServers();
        
        if (!servers[serverId]) {
            return false;
        }
        
        // If userId is provided, remove just that user
        if (userId && servers[serverId].users[userId]) {
            delete servers[serverId].users[userId];
            
            // If no users left, remove the entire server
            var remainingUsers = Object.keys(servers[serverId].users);
            if (remainingUsers.length === 0) {
                delete servers[serverId];
                JellyfinAPI.Logger.info('[MULTI-SERVER] Removed server (no users left): ' + serverId);
            } else {
                JellyfinAPI.Logger.info('[MULTI-SERVER] Removed user from server: ' + userId);
            }
        } else {
            // Remove entire server
            delete servers[serverId];
            JellyfinAPI.Logger.info('[MULTI-SERVER] Removed server: ' + serverId);
        }
        
        storage.set(SERVERS_KEY, servers);
        
        // If we removed the active server/user, switch to another one
        var activeServerId = storage.get(ACTIVE_SERVER_KEY);
        var activeUserId = storage.get(ACTIVE_USER_KEY);
        
        if (activeServerId === serverId && (!userId || activeUserId === userId)) {
            // Find first available user to set as active
            var firstServer = null;
            var firstUser = null;
            
            for (var sId in servers) {
                if (servers.hasOwnProperty(sId)) {
                    for (var uId in servers[sId].users) {
                        if (servers[sId].users.hasOwnProperty(uId)) {
                            firstServer = sId;
                            firstUser = uId;
                            break;
                        }
                    }
                    if (firstServer) break;
                }
            }
            
            if (firstServer && firstUser) {
                setActiveServer(firstServer, firstUser);
            } else {
                storage.remove(ACTIVE_SERVER_KEY);
                storage.remove(ACTIVE_USER_KEY);
            }
        }
        
        return true;
    }

    /**
     * Update server or user details
     * @param {string} serverId - Server ID
     * @param {Object} updates - Properties to update (server-level)
     * @param {string} userId - User ID (optional, for user-level updates)
     * @param {Object} userUpdates - User properties to update (optional)
     * @returns {boolean} Success status
     */
    function updateServer(serverId, updates, userId, userUpdates) {
        var servers = getAllServers();
        var server = servers[serverId];
        
        if (!server) {
            return false;
        }
        
        // Apply server-level updates
        if (updates) {
            for (var key in updates) {
                if (updates.hasOwnProperty(key) && key !== 'id' && key !== 'users') {
                    server[key] = updates[key];
                }
            }
        }
        
        // Apply user-level updates
        if (userId && userUpdates && server.users[userId]) {
            for (var userKey in userUpdates) {
                if (userUpdates.hasOwnProperty(userKey) && userKey !== 'userId') {
                    server.users[userId][userKey] = userUpdates[userKey];
                }
            }
        }
        
        storage.set(SERVERS_KEY, servers);
        JellyfinAPI.Logger.info('[MULTI-SERVER] Updated server: ' + serverId);
        return true;
    }

    /**
     * Set active server and user
     * @param {string} serverId - Server ID to activate
     * @param {string} userId - User ID to activate
     * @returns {boolean} Success status
     */
    function setActiveServer(serverId, userId) {
        var servers = getAllServers();
        var server = servers[serverId];
        
        if (!server || !server.users[userId]) {
            return false;
        }
        
        storage.set(ACTIVE_SERVER_KEY, serverId);
        storage.set(ACTIVE_USER_KEY, userId);
        
        // Update last connected timestamp for user
        updateServer(serverId, null, userId, {
            lastConnected: new Date().toISOString()
        });
        
        JellyfinAPI.Logger.info('[MULTI-SERVER] Activated server: ' + server.name + ' (user: ' + server.users[userId].username + ')');
        return true;
    }

    /**
     * Get server by ID
     * @param {string} serverId - Server ID
     * @param {string} userId - User ID (optional)
     * @returns {Object|null} Server object or null
     */
    function getServer(serverId, userId) {
        var servers = getAllServers();
        var server = servers[serverId];
        
        if (!server) {
            return null;
        }
        
        // If userId specified, return combined server+user info
        if (userId && server.users[userId]) {
            var user = server.users[userId];
            return {
                id: serverId,
                serverId: serverId,
                name: server.name,
                url: server.url,
                addedDate: server.addedDate,
                userId: userId,
                username: user.username,
                accessToken: user.accessToken,
                lastConnected: user.lastConnected,
                connected: user.connected
            };
        }
        
        // Return server info with all users
        return {
            id: serverId,
            serverId: serverId,
            name: server.name,
            url: server.url,
            addedDate: server.addedDate,
            users: server.users
        };
    }

    /**
     * Migrate from old flat array format to new nested object format
     * This runs automatically when needed
     * @deprecated This function is part of the migration process and can be removed
     *             after 2-3 releases (target: Q2 2026) once all users have migrated.
     */
    function migrateFromLegacyStorage() {
        var serversData = storage.get(SERVERS_KEY, true);
        
        // Check if data is already in new format (object with nested users)
        if (serversData && typeof serversData === 'object' && !Array.isArray(serversData)) {
            // Check if it has the new structure (servers with users property)
            var hasNewStructure = false;
            for (var key in serversData) {
                if (serversData.hasOwnProperty(key) && serversData[key].users) {
                    hasNewStructure = true;
                    break;
                }
            }
            if (hasNewStructure) {
                return; // Already migrated to Phase 2
            }
        }
        
        JellyfinAPI.Logger.info('[MULTI-SERVER] Migrating to normalized server-user structure...');
        
        var newServers = {};
        
        // Migrate from array format
        if (Array.isArray(serversData) && serversData.length > 0) {
            for (var i = 0; i < serversData.length; i++) {
                var oldServer = serversData[i];
                var serverId = oldServer.id || oldServer.serverId;
                
                // Create server entry if it doesn't exist
                if (!newServers[serverId]) {
                    newServers[serverId] = {
                        id: serverId,
                        name: oldServer.name,
                        url: oldServer.url,
                        addedDate: oldServer.addedDate,
                        users: {}
                    };
                }
                
                // Add user to server
                if (oldServer.userId) {
                    newServers[serverId].users[oldServer.userId] = {
                        userId: oldServer.userId,
                        username: oldServer.username,
                        accessToken: oldServer.accessToken,
                        lastConnected: oldServer.lastConnected,
                        connected: oldServer.connected !== false,
                        addedDate: oldServer.addedDate
                    };
                }
            }
            
            // Save new structure
            storage.set(SERVERS_KEY, newServers);
            
            // Migrate active server to active server+user
            var oldActiveServerId = storage.get(ACTIVE_SERVER_KEY);
            if (oldActiveServerId && newServers[oldActiveServerId]) {
                var users = newServers[oldActiveServerId].users;
                var firstUserId = Object.keys(users)[0];
                if (firstUserId) {
                    storage.set(ACTIVE_USER_KEY, firstUserId);
                }
            }
            
            JellyfinAPI.Logger.success('[MULTI-SERVER] Migrated ' + serversData.length + ' entries to new format');
            return;
        }
        
        // Check for old single-server format
        var oldAuth = storage.get('jellyfin_auth', true);
        if (!oldAuth || !oldAuth.serverAddress || !oldAuth.accessToken) {
            return; // No legacy data to migrate
        }

        JellyfinAPI.Logger.info('[MULTI-SERVER] Migrating from legacy single-server format...');

        // Fetch the actual server name from the server
        if (typeof JellyfinAPI !== 'undefined' && JellyfinAPI.getSystemInfo) {
            JellyfinAPI.getSystemInfo(oldAuth.serverAddress, oldAuth.accessToken, function(err, systemInfo) {
                var serverName = 'My Server'; // Default fallback
                
                if (!err && systemInfo && systemInfo.ServerName) {
                    // Use the actual server name from the server
                    serverName = systemInfo.ServerName;
                    JellyfinAPI.Logger.info('[MULTI-SERVER] Fetched server name from server: ' + serverName);
                } else {
                    // Fallback to hostname if fetch fails
                    try {
                        var url = new URL(oldAuth.serverAddress);
                        serverName = url.hostname;
                    } catch (e) {
                        // Use default name if URL parsing fails
                    }
                    JellyfinAPI.Logger.warn('[MULTI-SERVER] Could not fetch server name, using fallback: ' + serverName);
                }

                addServer(
                    oldAuth.serverAddress,
                    serverName,
                    oldAuth.userId,
                    oldAuth.username,
                    oldAuth.accessToken
                );

                JellyfinAPI.Logger.success('[MULTI-SERVER] Migration complete with server name: ' + serverName);
            });
        } else {
            // JellyfinAPI not available, use fallback
            var serverName = 'My Server';
            try {
                var url = new URL(oldAuth.serverAddress);
                serverName = url.hostname;
            } catch (e) {
                // Use default name if URL parsing fails
            }

            addServer(
                oldAuth.serverAddress,
                serverName,
                oldAuth.userId,
                oldAuth.username,
                oldAuth.accessToken
            );

            JellyfinAPI.Logger.success('[MULTI-SERVER] Migration complete!');
        }
    }
    
    /**
     * Clean up server names that were previously enhanced with hostname
     * Extracts original server name from format like "Jellyfin Server (hostname)"
     * @deprecated This function is part of the migration process and can be removed
     *             after 2-3 releases (target: Q2 2026) once all users have migrated.
     * @private
     */
    function cleanupServerNames() {
        console.log('[MULTI-SERVER] cleanupServerNames() starting...');
        var servers = getAllServers();
        console.log('[MULTI-SERVER] Loaded servers:', JSON.stringify(servers, null, 2));
        var updated = false;
        
        for (var serverId in servers) {
            if (servers.hasOwnProperty(serverId)) {
                var server = servers[serverId];
                var originalName = server.name;
                console.log('[MULTI-SERVER] Checking server:', serverId, 'name:', originalName);
                
                // Check if server name has the old enhanced format with parentheses
                // This handles formats like: "Name (hostname)", "Jellyfin Server (hostname)", etc.
                var match = server.name.match(/^(.+?)\s*\((.+?)\)$/);
                console.log('[MULTI-SERVER] Regex match result:', match);
                if (match) {
                    // Extract the base name (before the parentheses)
                    var baseName = match[1].trim();
                    console.log('[MULTI-SERVER] Extracted base name:', baseName);
                    
                    // Only update if the base name is different
                    if (baseName !== server.name) {
                        server.name = baseName;
                        updated = true;
                        console.log('[MULTI-SERVER] ✓ Cleaned server name: "' + originalName + '" -> "' + baseName + '"');
                        if (typeof JellyfinAPI !== 'undefined') {
                            JellyfinAPI.Logger.info('[MULTI-SERVER] Cleaned server name: "' + originalName + '" -> "' + baseName + '"');
                        }
                    }
                }
            }
        }
        
        if (updated) {
            console.log('[MULTI-SERVER] Saving cleaned servers to storage...');
            storage.set(SERVERS_KEY, servers);
            console.log('[MULTI-SERVER] ✓ Server names cleaned and saved');
            if (typeof JellyfinAPI !== 'undefined') {
                JellyfinAPI.Logger.success('[MULTI-SERVER] Server names cleaned');
            }
        } else {
            console.log('[MULTI-SERVER] No server names needed cleaning');
            if (typeof JellyfinAPI !== 'undefined') {
                JellyfinAPI.Logger.info('[MULTI-SERVER] No server names needed cleaning');
            }
        }
    }

    /**
     * Get authentication object for API calls to a specific server/user
     * @param {string} serverId - Server ID (optional, uses active server if not provided)
     * @param {string} userId - User ID (optional, uses active user if not provided)
     * @returns {Object|null} Auth object or null
     */
    function getServerAuth(serverId, userId) {
        var server;
        
        if (serverId && userId) {
            server = getServer(serverId, userId);
        } else {
            server = getActiveServer();
        }
        
        if (!server) {
            return null;
        }
        
        return {
            serverAddress: server.url,
            userId: server.userId,
            username: server.username,
            accessToken: server.accessToken,
            serverId: server.serverId || server.id,
            serverName: server.name
        };
    }

    /**
     * Get authentication for current page from URL parameter or active server
     * Checks for serverId in URL query params and returns appropriate auth
     * @returns {Object|null} Auth object with serverAddress, userId, accessToken or null
     */
    function getAuthForPage() {
        var params = new URLSearchParams(window.location.search);
        var serverId = params.get('serverId');
        
        if (serverId && typeof MultiServerManager !== 'undefined') {
            var server = getServer(serverId);
            if (server && server.users) {
                // Find the first connected user, or any user
                var connectedUser = null;
                var anyUser = null;
                
                for (var userId in server.users) {
                    if (server.users.hasOwnProperty(userId)) {
                        var user = server.users[userId];
                        anyUser = { userId: userId, user: user };
                        
                        if (user.connected) {
                            connectedUser = { userId: userId, user: user };
                            break;
                        }
                    }
                }
                
                var selectedUser = connectedUser || anyUser;
                if (selectedUser) {
                    return {
                        serverAddress: server.url,
                        userId: selectedUser.userId,
                        accessToken: selectedUser.user.accessToken,
                        username: selectedUser.user.username,
                        serverName: server.name
                    };
                }
            }
        }
        
        // If no serverId in URL but multi-server is active, use active server
        if (typeof MultiServerManager !== 'undefined' && getServerCount() > 0) {
            var activeServer = getActiveServer();
            if (activeServer) {
                return {
                    serverAddress: activeServer.url,
                    userId: activeServer.userId,
                    accessToken: activeServer.accessToken,
                    username: activeServer.username,
                    serverName: activeServer.name
                };
            }
        }
        
        // Fallback to stored auth
        return JellyfinAPI.getStoredAuth();
    }

    /**
     * Get all users for a specific server
     * @param {string} serverId - Server ID
     * @returns {Array} Array of user objects
     */
    function getServerUsers(serverId) {
        var servers = getAllServers();
        var server = servers[serverId];
        
        if (!server || !server.users) {
            return [];
        }
        
        var result = [];
        for (var userId in server.users) {
            if (server.users.hasOwnProperty(userId)) {
                var user = server.users[userId];
                result.push({
                    serverId: serverId,
                    userId: userId,
                    username: user.username,
                    accessToken: user.accessToken,
                    lastConnected: user.lastConnected,
                    connected: user.connected,
                    addedDate: user.addedDate
                });
            }
        }
        
        return result;
    }

    /**
     * Get unique servers (without user duplication)
     * @returns {Array} Array of server objects
     */
    function getUniqueServers() {
        var servers = getAllServers();
        var result = [];
        
        for (var serverId in servers) {
            if (servers.hasOwnProperty(serverId)) {
                var server = servers[serverId];
                var userCount = Object.keys(server.users || {}).length;
                
                result.push({
                    id: serverId,
                    serverId: serverId,
                    name: server.name,
                    url: server.url,
                    addedDate: server.addedDate,
                    userCount: userCount
                });
            }
        }
        
        return result;
    }

    /**
     * Check if multiple servers are configured
     * @returns {boolean}
     */
    function hasMultipleServers() {
        var servers = getAllServers();
        var serverCount = Object.keys(servers).length;
        return serverCount > 1;
    }

    /**
     * Get server count
     * @returns {number}
     */
    function getServerCount() {
        var servers = getAllServers();
        return Object.keys(servers).length;
    }

    /**
     * Get total user count across all servers
     * @returns {number}
     */
    function getTotalUserCount() {
        var servers = getAllServers();
        var count = 0;
        
        for (var serverId in servers) {
            if (servers.hasOwnProperty(serverId) && servers[serverId].users) {
                count += Object.keys(servers[serverId].users).length;
            }
        }
        
        return count;
    }

    // Auto-migrate on load
    try {
        migrateFromLegacyStorage();
        cleanupServerNames();
    } catch (e) {
        if (typeof JellyfinAPI !== 'undefined') {
            JellyfinAPI.Logger.error('[MULTI-SERVER] Error during migration:', e);
        }
    }

    // Public API
    return {
        // Core methods
        getAllServers: getAllServers,
        getAllServersArray: getAllServersArray,
        getActiveServer: getActiveServer,
        addServer: addServer,
        removeServer: removeServer,
        updateServer: updateServer,
        setActiveServer: setActiveServer,
        getServer: getServer,
        getServerAuth: getServerAuth,
        getAuthForPage: getAuthForPage,
        
        // New Phase 2 methods
        getServerUsers: getServerUsers,
        getUniqueServers: getUniqueServers,
        getTotalUserCount: getTotalUserCount,
        
        // Utility methods
        hasMultipleServers: hasMultipleServers,
        getServerCount: getServerCount,
        migrateFromLegacyStorage: migrateFromLegacyStorage
    };
})();
