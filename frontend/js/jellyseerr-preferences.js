/*
 * Jellyseerr Preferences Manager
 * High-level interface for managing Jellyseerr settings and preferences
 * 
 * Provides a simple API for getting/setting Jellyseerr configuration
 * with proper defaults and validation.
 */

var JellyseerrPreferences = (function() {
    'use strict';

    // ==================== Default Values ====================

    const DEFAULTS = {
        // Global settings (not user-specific)
        enabled: false,
        serverUrl: '',
        showInNavigation: true,
        showInToolbar: true,
        blockNsfw: true,
        fetchLimit: 50, // 25, 50, or 75

        // Per-user settings
        authMethod: 'jellyfin', // 'jellyfin' or 'local'
        apiKey: '',
        localEmail: '',
        localPassword: '',
        password: '', // Jellyfin password for auto-renewal
        autoRegenerateApiKey: true,
        lastVerifiedTime: '',
        lastConnectionSuccess: false,

        // Display preferences
        showRequestStatus: true,

        // Quality profiles (per-user)
        hdMovieProfileId: null,
        fourKMovieProfileId: null,
        hdTvProfileId: null,
        fourKTvProfileId: null,
        hdMovieRootFolderId: null,
        fourKMovieRootFolderId: null,
        hdTvRootFolderId: null,
        fourKTvRootFolderId: null,
        hdMovieServerId: null,
        fourKMovieServerId: null,
        hdTvServerId: null,
        fourKTvServerId: null
    };

    // Keys that are stored globally (not per-user)
    const GLOBAL_KEYS = [
        'enabled',
        'serverUrl',
        'showInNavigation',
        'showInToolbar',
        'blockNsfw',
        'fetchLimit'
    ];

    // Keys that are stored per-user
    const USER_KEYS = [
        'authMethod',
        'apiKey',
        'localEmail',
        'localPassword',
        'password',
        'autoRegenerateApiKey',
        'lastVerifiedTime',
        'lastConnectionSuccess',
        'showRequestStatus',
        'hdMovieProfileId',
        'fourKMovieProfileId',
        'hdTvProfileId',
        'fourKTvProfileId',
        'hdMovieRootFolderId',
        'fourKMovieRootFolderId',
        'hdTvRootFolderId',
        'fourKTvRootFolderId',
        'hdMovieServerId',
        'fourKMovieServerId',
        'hdTvServerId',
        'fourKTvServerId'
    ];

    // ==================== Helper Functions ====================

    /**
     * Check if a key is stored globally
     * @private
     */
    function isGlobalKey(key) {
        return GLOBAL_KEYS.indexOf(key) !== -1;
    }

    /**
     * Validate setting value
     * @private
     */
    function validateValue(key, value) {
        switch (key) {
            case 'enabled':
            case 'showInNavigation':
            case 'showInToolbar':
            case 'blockNsfw':
            case 'showRequestStatus':
            case 'autoRegenerateApiKey':
            case 'lastConnectionSuccess':
                return typeof value === 'boolean';
            
            case 'fetchLimit':
                return [25, 50, 75].indexOf(value) !== -1;
            
            case 'authMethod':
                return value === 'jellyfin' || value === 'local' || value === 'jellyfin-apikey';
            
            case 'serverUrl':
            case 'apiKey':
            case 'localEmail':
            case 'localPassword':
            case 'password':
            case 'lastVerifiedTime':
                return typeof value === 'string';
            
            default:
                return true; // Allow other values
        }
    }

    // ==================== Public API ====================

    return {
        /**
         * Get a preference value
         * @param {string} key - Preference key
         * @param {string} userId - User ID (optional, uses current if not specified)
         * @returns {*} Preference value
         */
        get: function(key, userId) {
            if (!storage) {
                return DEFAULTS[key];
            }

            var value;

            if (isGlobalKey(key)) {
                value = storage.getJellyseerrSetting(key, DEFAULTS[key]);
            } else {
                // Get current user ID if not provided
                if (!userId) {
                    var auth = JellyfinAPI.getStoredAuth();
                    if (auth && auth.userId) {
                        userId = auth.userId;
                    }
                }

                if (!userId) {
                    if (typeof JellyseerrAPI !== 'undefined') {
                        JellyseerrAPI.Logger.warn('[Preferences] No user ID available, using default');
                    }
                    return DEFAULTS[key];
                }

                value = storage.getJellyseerrUserSetting(userId, key, DEFAULTS[key]);
            }

            return value;
        },

        /**
         * Set a preference value
         * @param {string} key - Preference key
         * @param {*} value - Preference value
         * @param {string} userId - User ID (optional, uses current if not specified)
         */
        set: function(key, value, userId) {
            if (!storage) {
                return;
            }

            // Validate value
            if (!validateValue(key, value)) {
                return;
            }

            if (isGlobalKey(key)) {
                storage.setJellyseerrSetting(key, value);
            } else {
                // Get current user ID if not provided
                if (!userId) {
                    var auth = JellyfinAPI.getStoredAuth();
                    if (auth && auth.userId) {
                        userId = auth.userId;
                    }
                }

                if (!userId) {
                    return;
                }

                storage.setJellyseerrUserSetting(userId, key, value);
            }

            if (typeof JellyseerrAPI !== 'undefined') {
                JellyseerrAPI.Logger.debug('[Preferences] Set ' + key + ' = ' + value);
            }
        },

        /**
         * Get all preferences for a user
         * @param {string} userId - User ID (optional, uses current if not specified)
         * @returns {Object} All preferences
         */
        getAll: function(userId) {
            var prefs = {};

            // Get global preferences
            GLOBAL_KEYS.forEach(function(key) {
                prefs[key] = this.get(key);
            }.bind(this));

            // Get user preferences
            if (!userId) {
                var auth = JellyfinAPI.getStoredAuth();
                if (auth && auth.userId) {
                    userId = auth.userId;
                }
            }

            if (userId) {
                USER_KEYS.forEach(function(key) {
                    prefs[key] = this.get(key, userId);
                }.bind(this));
            }

            return prefs;
        },

        /**
         * Reset all preferences to defaults
         * @param {string} userId - User ID (optional, clears current user if not specified)
         */
        reset: function(userId) {
            if (!storage) return;

            if (userId) {
                storage.clearJellyseerrUserData(userId);
            } else {
                var auth = JellyfinAPI.getStoredAuth();
                if (auth && auth.userId) {
                    storage.clearJellyseerrUserData(auth.userId);
                }
            }

            if (typeof JellyseerrAPI !== 'undefined') {
                JellyseerrAPI.Logger.info('[Preferences] Reset to defaults');
            }
        },

        /**
         * Reset global preferences
         */
        resetGlobal: function() {
            if (!storage) return;
            storage.clearJellyseerrSettings();

            if (typeof JellyseerrAPI !== 'undefined') {
                JellyseerrAPI.Logger.info('[Preferences] Reset global preferences');
            }
        },

        /**
         * Check if Jellyseerr is enabled
         * @returns {boolean}
         */
        isEnabled: function() {
            return this.get('enabled') === true;
        },

        /**
         * Check if Jellyseerr is configured
         * @returns {boolean}
         */
        isConfigured: function() {
            var serverUrl = this.get('serverUrl');
            return serverUrl && serverUrl.length > 0;
        },

        /**
         * Check if user has valid authentication
         * @param {string} userId - User ID (optional)
         * @returns {boolean}
         */
        hasAuth: function(userId) {
            var apiKey = this.get('apiKey', userId);
            var authMethod = this.get('authMethod', userId);

            if (authMethod === 'local' || authMethod === 'jellyfin-apikey') {
                return apiKey && apiKey.length > 0;
            }

            // For Jellyfin SSO, check if we have cookies
            if (typeof JellyseerrAPI !== 'undefined' && JellyseerrAPI.hasCookies) {
                return JellyseerrAPI.hasCookies();
            }

            return false;
        },

        /**
         * Get server URL
         * @returns {string|null}
         */
        getServerUrl: function() {
            var url = this.get('serverUrl');
            return url || null;
        },

        /**
         * Set server URL
         * @param {string} url - Server URL
         */
        setServerUrl: function(url) {
            // Clean up URL
            if (url) {
                url = url.trim().replace(/\/$/, '');
            }
            this.set('serverUrl', url);
        },

        /**
         * Get API key for current user
         * @param {string} userId - User ID (optional)
         * @returns {string|null}
         */
        getApiKey: function(userId) {
            var key = this.get('apiKey', userId);
            return key || null;
        },

        /**
         * Set API key for current user
         * @param {string} key - API key
         * @param {string} userId - User ID (optional)
         */
        setApiKey: function(key, userId) {
            this.set('apiKey', key, userId);
        },

        /**
         * Get quality profile ID for a request type
         * @param {string} mediaType - 'movie' or 'tv'
         * @param {boolean} is4k - Whether 4K quality
         * @param {string} userId - User ID (optional)
         * @returns {number|null}
         */
        getProfileId: function(mediaType, is4k, userId) {
            var key;
            if (mediaType === 'movie') {
                key = is4k ? 'fourKMovieProfileId' : 'hdMovieProfileId';
            } else {
                key = is4k ? 'fourKTvProfileId' : 'hdTvProfileId';
            }
            
            var value = this.get(key, userId);
            return value ? parseInt(value, 10) : null;
        },

        /**
         * Set quality profile ID
         * @param {string} mediaType - 'movie' or 'tv'
         * @param {boolean} is4k - Whether 4K quality
         * @param {number} profileId - Profile ID
         * @param {string} userId - User ID (optional)
         */
        setProfileId: function(mediaType, is4k, profileId, userId) {
            var key;
            if (mediaType === 'movie') {
                key = is4k ? 'fourKMovieProfileId' : 'hdMovieProfileId';
            } else {
                key = is4k ? 'fourKTvProfileId' : 'hdTvProfileId';
            }
            
            this.set(key, profileId ? profileId.toString() : null, userId);
        },

        /**
         * Get root folder ID for a request type
         * @param {string} mediaType - 'movie' or 'tv'
         * @param {boolean} is4k - Whether 4K quality
         * @param {string} userId - User ID (optional)
         * @returns {number|null}
         */
        getRootFolderId: function(mediaType, is4k, userId) {
            var key;
            if (mediaType === 'movie') {
                key = is4k ? 'fourKMovieRootFolderId' : 'hdMovieRootFolderId';
            } else {
                key = is4k ? 'fourKTvRootFolderId' : 'hdTvRootFolderId';
            }
            
            var value = this.get(key, userId);
            return value ? parseInt(value, 10) : null;
        },

        /**
         * Get server ID for a request type
         * @param {string} mediaType - 'movie' or 'tv'
         * @param {boolean} is4k - Whether 4K quality
         * @param {string} userId - User ID (optional)
         * @returns {number|null}
         */
        getServerId: function(mediaType, is4k, userId) {
            var key;
            if (mediaType === 'movie') {
                key = is4k ? 'fourKMovieServerId' : 'hdMovieServerId';
            } else {
                key = is4k ? 'fourKTvServerId' : 'hdTvServerId';
            }
            
            var value = this.get(key, userId);
            return value ? parseInt(value, 10) : null;
        },

        /**
         * Get default values
         * @returns {Object} Default preferences
         */
        getDefaults: function() {
            return Object.assign({}, DEFAULTS);
        },

        /**
         * Export preferences as JSON
         * @param {string} userId - User ID (optional)
         * @returns {string} JSON string
         */
        exportToJson: function(userId) {
            var prefs = this.getAll(userId);
            return JSON.stringify(prefs, null, 2);
        },

        /**
         * Import preferences from JSON
         * @param {string} json - JSON string
         * @param {string} userId - User ID (optional)
         */
        importFromJson: function(json, userId) {
            try {
                var prefs = JSON.parse(json);
                
                for (var key in prefs) {
                    if (prefs.hasOwnProperty(key) && DEFAULTS.hasOwnProperty(key)) {
                        this.set(key, prefs[key], userId);
                    }
                }

                if (typeof JellyseerrAPI !== 'undefined') {
                    JellyseerrAPI.Logger.success('[Preferences] Imported preferences');
                }
            } catch (e) {
                // Preference import failed, will use defaults
            }
        }
    };
})();

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JellyseerrPreferences;
}
