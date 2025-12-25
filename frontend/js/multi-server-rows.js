/**
 * Multi-Server Row Aggregation
 * 
 * Handles fetching and aggregating home screen rows from multiple Jellyfin servers.
 * Similar to Android TV's MultiServerRepository pattern.
 */

var MultiServerRows = (function() {
    'use strict';
    
    async function getContinueWatching(limit) {
        if (typeof MultiServerManager === 'undefined') {
            return null; // Not in multi-server mode
        }
        
        const servers = MultiServerManager.getAllServersArray();
        if (!servers || servers.length === 0) {
            return [];
        }
        
        console.log('MultiServerRows: Aggregating Continue Watching from', servers.length, 'servers');
        
        const results = await Promise.all(servers.map(async (server) => {
            try {
                const data = await new Promise((resolve, reject) => {
                    JellyfinAPI.getResumeItems(
                        server.url,
                        server.userId,
                        server.accessToken,
                        function(err, data) {
                            if (err) reject(err);
                            else resolve(data);
                        }
                    );
                });
                
                if (data && data.Items) {
                    data.Items.forEach(function(item) {
                        item.ServerUrl = server.url;
                        item.MultiServerId = server.id;
                        item.ServerName = server.name;
                    });
                    return data.Items;
                }
                return [];
            } catch (err) {
                console.warn('MultiServerRows: Failed to fetch Continue Watching from', server.name, err);
                return [];
            }
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
        
        const servers = MultiServerManager.getAllServersArray();
        if (!servers || servers.length === 0) {
            return [];
        }
        
        console.log('MultiServerRows: Aggregating Next Up from', servers.length, 'servers')
        
        const results = await Promise.all(servers.map(async (server) => {
            try {
                const data = await new Promise((resolve, reject) => {
                    JellyfinAPI.getNextUpItems(
                        server.url,
                        server.userId,
                        server.accessToken,
                        function(err, data) {
                            if (err) reject(err);
                            else resolve(data);
                        }
                    );
                });
                
                if (data && data.Items) {
                    data.Items.forEach(function(item) {
                        item.ServerUrl = server.url;
                        item.MultiServerId = server.id;
                        item.ServerName = server.name;
                    });
                    return data.Items;
                }
                return [];
            } catch (err) {
                console.warn('MultiServerRows: Failed to fetch Next Up from', server.name, err);
                return [];
            }
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
        
        const servers = MultiServerManager.getAllServersArray();
        if (!servers || servers.length === 0) {
            return [];
        }
        
        console.log('MultiServerRows: Aggregating Latest Media for library', libraryId, 'from', servers.length, 'servers')
        
        const results = await Promise.all(servers.map(async (server) => {
            try {
                const data = await new Promise((resolve, reject) => {
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
                });
                
                if (data && data.Items) {
                    data.Items.forEach(function(item) {
                        item.ServerUrl = server.url;
                        item.MultiServerId = server.id;
                        item.ServerName = server.name;
                    });
                    return data.Items;
                }
                return [];
            } catch (err) {
                console.warn('MultiServerRows: Failed to fetch Latest Media from', server.name, err);
                return [];
            }
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
        
        const servers = MultiServerManager.getAllServersArray();
        if (!servers || servers.length === 0) {
            return [];
        }
        
        const hasMultipleServers = servers.length > 1;
        
        const results = await Promise.all(servers.map(async (server) => {
            try {
                const data = await new Promise((resolve, reject) => {
                    JellyfinAPI.getUserViews(
                        server.url,
                        server.userId,
                        server.accessToken,
                        function(err, data) {
                            if (err) reject(err);
                            else resolve(data);
                        }
                    );
                });
                
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
            } catch (err) {
                console.warn('MultiServerRows: Failed to fetch libraries from', server.name, err);
                return [];
            }
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
