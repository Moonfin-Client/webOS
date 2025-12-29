/**
 * Connection Pool Manager
 * Manages API requests across multiple Jellyfin servers
 * Handles request routing, response aggregation, and failover
 */

var ConnectionPool = (function() {
    'use strict';
    
    // Cache for unreachable servers - prevents repeated slow timeouts
    var unreachableServers = {};
    var UNREACHABLE_CACHE_DURATION_MS = 60000; // 1 minute cache for unreachable servers
    var PER_SERVER_TIMEOUT_MS = 3000; // 3 seconds per server timeout
    
    /**
     * Check if a server is cached as unreachable
     * @param {string} serverId - Server ID to check
     * @returns {boolean} - True if server is cached as unreachable
     */
    function isServerUnreachable(serverId) {
        var cached = unreachableServers[serverId];
        if (!cached) return false;
        
        // Check if cache has expired
        if (Date.now() - cached.timestamp > UNREACHABLE_CACHE_DURATION_MS) {
            delete unreachableServers[serverId];
            return false;
        }
        return true;
    }
    
    /**
     * Mark a server as unreachable
     * @param {string} serverId - Server ID
     * @param {string} serverName - Server name for logging
     */
    function markServerUnreachable(serverId, serverName) {
        unreachableServers[serverId] = {
            timestamp: Date.now(),
            serverName: serverName
        };
        console.log('[ConnectionPool] Marked server as unreachable:', serverName, '- will skip for', UNREACHABLE_CACHE_DURATION_MS / 1000, 'seconds');
    }
    
    /**
     * Clear unreachable cache for a server (e.g., when user manually connects)
     * @param {string} serverId - Server ID to clear
     */
    function clearUnreachableCache(serverId) {
        if (serverId) {
            delete unreachableServers[serverId];
        } else {
            unreachableServers = {};
        }
    }

    /**
     * Execute a request to a specific server
     * @param {string} serverId - Server ID to query
     * @param {Function} apiFunction - JellyfinAPI function to call
     * @param {Array} args - Arguments for the API function (excluding callback)
     * @param {Function} callback - Callback(err, data, serverId)
     */
    function executeRequest(serverId, apiFunction, args, callback) {
        var server = MultiServerManager.getServer(serverId);
        if (!server) {
            if (callback) callback(new Error('Server not found: ' + serverId), null, serverId);
            return;
        }

        // Build args with server auth
        var serverArgs = [server.url].concat(args.slice(1));
        
        // Replace accessToken if it's in the args
        for (var i = 0; i < serverArgs.length; i++) {
            if (serverArgs[i] === '__TOKEN__') {
                serverArgs[i] = server.accessToken;
            }
        }

        // Add callback that includes serverId
        serverArgs.push(function(err, data) {
            if (err) {
                // Mark server as potentially offline
                MultiServerManager.updateServer(serverId, { connected: false });
            } else {
                MultiServerManager.updateServer(serverId, { connected: true });
            }
            
            if (callback) callback(err, data, serverId);
        });

        // Execute the API function
        apiFunction.apply(null, serverArgs);
    }

    /**
     * Execute a request to all servers and aggregate results
     * @param {Function} apiFunction - JellyfinAPI function to call
     * @param {Array} args - Arguments for the API function (excluding server URL and callback)
     * @param {Object} options - Aggregation options
     * @param {Function} callback - Callback(err, aggregatedData)
     */
    function executeAll(apiFunction, args, options, callback) {
        var servers = MultiServerManager.getAllServersArray();
        var results = [];
        var errors = [];
        var completed = 0;
        var total = servers.length;

        if (total === 0) {
            if (callback) callback(new Error('No servers configured'), null);
            return;
        }

        options = options || {};
        var aggregateType = options.aggregateType || 'merge'; // 'merge', 'concat', 'first'
        var sortBy = options.sortBy; // Optional sort function
        var limit = options.limit; // Optional result limit
        var ignoreErrors = options.ignoreErrors !== false; // Default true

        servers.forEach(function(server) {
            executeRequest(server.id, apiFunction, args, function(err, data, serverId) {
                completed++;

                if (err) {
                    errors.push({
                        serverId: serverId,
                        serverName: server.name,
                        error: err
                    });
                } else if (data) {
                    // Tag data with server info
                    if (Array.isArray(data)) {
                        data.forEach(function(item) {
                            item._serverId = serverId;
                            item._serverName = server.name;
                        });
                    } else if (typeof data === 'object') {
                        data._serverId = serverId;
                        data._serverName = server.name;
                    }
                    results.push({ serverId: serverId, data: data });
                }

                // Check if all servers have responded
                if (completed === total) {
                    handleAggregation();
                }
            });
        });

        function handleAggregation() {
            // If all requests failed, return error
            if (results.length === 0 && errors.length > 0) {
                if (callback) callback(errors[0].error, null);
                return;
            }

            var aggregated;

            switch (aggregateType) {
                case 'first':
                    // Return first successful result
                    aggregated = results.length > 0 ? results[0].data : null;
                    break;

                case 'concat':
                    // Concatenate all array results
                    aggregated = [];
                    results.forEach(function(result) {
                        if (Array.isArray(result.data)) {
                            aggregated = aggregated.concat(result.data);
                        }
                    });
                    break;

                case 'merge':
                default:
                    // Merge all results (for objects with Items arrays)
                    aggregated = {
                        Items: [],
                        TotalRecordCount: 0
                    };
                    
                    results.forEach(function(result) {
                        if (result.data && result.data.Items) {
                            aggregated.Items = aggregated.Items.concat(result.data.Items);
                            aggregated.TotalRecordCount += (result.data.TotalRecordCount || result.data.Items.length);
                        } else if (Array.isArray(result.data)) {
                            aggregated.Items = aggregated.Items.concat(result.data);
                            aggregated.TotalRecordCount += result.data.length;
                        }
                    });
                    break;
            }

            // Apply sorting if specified
            if (sortBy && aggregated && (Array.isArray(aggregated) || aggregated.Items)) {
                var itemsToSort = Array.isArray(aggregated) ? aggregated : aggregated.Items;
                itemsToSort.sort(sortBy);
            }

            // Apply limit if specified
            if (limit && aggregated) {
                if (Array.isArray(aggregated)) {
                    aggregated = aggregated.slice(0, limit);
                } else if (aggregated.Items) {
                    aggregated.Items = aggregated.Items.slice(0, limit);
                    aggregated.TotalRecordCount = Math.min(aggregated.TotalRecordCount, limit);
                }
            }

            if (callback) {
                // Include error info if ignoreErrors is false
                if (!ignoreErrors && errors.length > 0) {
                    callback(null, aggregated, errors);
                } else {
                    callback(null, aggregated);
                }
            }
        }
    }

    /**
     * Execute request to active server only
     * @param {Function} apiFunction - JellyfinAPI function to call
     * @param {Array} args - Arguments for the API function
     * @param {Function} callback - Callback(err, data)
     */
    function executeActive(apiFunction, args, callback) {
        var activeServer = MultiServerManager.getActiveServer();
        if (!activeServer) {
            if (callback) callback(new Error('No active server'), null);
            return;
        }

        executeRequest(activeServer.id, apiFunction, args, function(err, data) {
            if (callback) callback(err, data);
        });
    }

    /**
     * Get libraries from all servers
     * @param {Function} callback - Callback(err, libraries)
     */
    function getAllLibraries(callback) {
        var servers = MultiServerManager.getAllServersArray();
        var allLibraries = [];
        var completed = 0;
        var callbackCalled = false;
        
        // Filter out unreachable servers
        var reachableServers = servers.filter(function(server) {
            if (isServerUnreachable(server.id)) {
                console.log('[ConnectionPool] Skipping unreachable server:', server.name);
                return false;
            }
            return true;
        });

        if (reachableServers.length === 0) {
            // All servers unreachable, try all anyway (cache may be stale)
            reachableServers = servers;
            clearUnreachableCache();
        }
        
        var totalServers = reachableServers.length;
        
        if (totalServers === 0) {
            if (callback) callback(null, []);
            return;
        }
        
        // Failsafe timeout - shorter now that we skip unreachable servers
        var failsafeTimeout = setTimeout(function() {
            if (!callbackCalled) {
                callbackCalled = true;
                console.log('[ConnectionPool] Failsafe timeout - returning', allLibraries.length, 'libraries from responsive servers');
                allLibraries.sort(function(a, b) {
                    return a.Name.localeCompare(b.Name);
                });
                if (callback) callback(null, allLibraries);
            }
        }, PER_SERVER_TIMEOUT_MS * totalServers + 1000);

        reachableServers.forEach(function(server) {
            var serverCompleted = false;
            
            // Per-server timeout
            var serverTimeout = setTimeout(function() {
                if (!serverCompleted) {
                    serverCompleted = true;
                    completed++;
                    console.log('[ConnectionPool] Server timeout:', server.name, '(' + server.url + ')');
                    markServerUnreachable(server.id, server.name);
                    checkComplete();
                }
            }, PER_SERVER_TIMEOUT_MS);
            
            JellyfinAPI.getUserViews(server.url, server.userId, server.accessToken, function(err, data) {
                if (serverCompleted) return; // Already timed out
                serverCompleted = true;
                clearTimeout(serverTimeout);
                completed++;

                if (!err && data && data.Items) {
                    console.log('[ConnectionPool] Got', data.Items.length, 'libraries from', server.name);
                    data.Items.forEach(function(library) {
                        allLibraries.push({
                            Id: library.Id,
                            Name: library.Name,
                            CollectionType: library.CollectionType,
                            ServerId: server.id,
                            UserId: server.userId,
                            ServerName: server.name,
                            ServerUrl: server.url,
                            _serverId: server.id,
                            _serverName: server.name,
                            // Include original library data
                            ImageTags: library.ImageTags,
                            BackdropImageTags: library.BackdropImageTags
                        });
                    });
                } else {
                    console.log('[ConnectionPool] Failed to get libraries from', server.name, err ? '(error)' : '(no data)');
                    if (err) {
                        markServerUnreachable(server.id, server.name);
                    }
                }

                checkComplete();
            });
        });
        
        function checkComplete() {
            if (completed === servers.length && !callbackCalled) {
                callbackCalled = true;
                clearTimeout(failsafeTimeout);
                // Sort libraries alphabetically
                allLibraries.sort(function(a, b) {
                    return a.Name.localeCompare(b.Name);
                });
                console.log('[ConnectionPool] All servers processed, total libraries:', allLibraries.length);
                if (callback) callback(null, allLibraries);
            }
        }
    }

    /**
     * Get resume items from all servers
     * @param {Object} options - Query options
     * @param {Function} callback - Callback(err, items)
     */
    function getAllResumeItems(options, callback) {
        options = options || {};
        
        executeAll(
            JellyfinAPI.getResumeItems,
            ['__TOKEN__', options.limit || 20],
            {
                aggregateType: 'merge',
                sortBy: function(a, b) {
                    // Sort by most recently played
                    var dateA = new Date(a.UserData && a.UserData.LastPlayedDate || 0);
                    var dateB = new Date(b.UserData && b.UserData.LastPlayedDate || 0);
                    return dateB - dateA;
                },
                limit: options.limit || 20
            },
            callback
        );
    }

    /**
     * Get next up items from all servers
     * @param {Object} options - Query options
     * @param {Function} callback - Callback(err, items)
     */
    function getAllNextUpItems(options, callback) {
        options = options || {};
        
        executeAll(
            JellyfinAPI.getNextUpItems,
            ['__TOKEN__', options.limit || 20],
            {
                aggregateType: 'merge',
                sortBy: function(a, b) {
                    // Sort by series name, then season, then episode
                    if (a.SeriesName !== b.SeriesName) {
                        return a.SeriesName.localeCompare(b.SeriesName);
                    }
                    if (a.ParentIndexNumber !== b.ParentIndexNumber) {
                        return (a.ParentIndexNumber || 0) - (b.ParentIndexNumber || 0);
                    }
                    return (a.IndexNumber || 0) - (b.IndexNumber || 0);
                },
                limit: options.limit || 20
            },
            callback
        );
    }

    /**
     * Search across all servers
     * @param {string} searchTerm - Search query
     * @param {Object} options - Search options
     * @param {Function} callback - Callback(err, results)
     */
    function searchAll(searchTerm, options, callback) {
        options = options || {};
        
        var servers = MultiServerManager.getAllServersArray();
        var allResults = [];
        var completed = 0;

        if (servers.length === 0) {
            if (callback) callback(null, []);
            return;
        }

        servers.forEach(function(server) {
            JellyfinAPI.search(server.url, server.userId, server.accessToken, searchTerm, options, function(err, data) {
                completed++;

                if (!err && data) {
                    // Tag results with server info
                    if (data.Items) {
                        data.Items.forEach(function(item) {
                            item._serverId = server.id;
                            item._serverName = server.name;
                        });
                        allResults = allResults.concat(data.Items);
                    }
                }

                if (completed === servers.length) {
                    // Sort by relevance/type
                    allResults.sort(function(a, b) {
                        var typeOrder = { 'Movie': 0, 'Series': 1, 'Episode': 2, 'Audio': 3 };
                        var orderA = typeOrder[a.Type] !== undefined ? typeOrder[a.Type] : 99;
                        var orderB = typeOrder[b.Type] !== undefined ? typeOrder[b.Type] : 99;
                        if (orderA !== orderB) return orderA - orderB;
                        return (a.Name || '').localeCompare(b.Name || '');
                    });

                    if (callback) callback(null, { Items: allResults, TotalRecordCount: allResults.length });
                }
            });
        });
    }

    return {
        executeRequest: executeRequest,
        executeAll: executeAll,
        executeActive: executeActive,
        getAllLibraries: getAllLibraries,
        getAllResumeItems: getAllResumeItems,
        getAllNextUpItems: getAllNextUpItems,
        searchAll: searchAll,
        isServerUnreachable: isServerUnreachable,
        clearUnreachableCache: clearUnreachableCache
    };
})();
