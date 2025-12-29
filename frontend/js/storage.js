/* 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This file incorporates work covered by the following copyright and
 * permission notice:
 * 
 *   Copyright 2019 Simon J. Hogan
 * 
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 * 
*/

/**
 * STORAGE - Persistent storage for webOS with fallback to localStorage
 * Uses webOS db8 database service for true persistence across app restarts
 */
function STORAGE() {
	this.useWebOSStorage = false;
	this.dbKind = 'org.jellyfin.webos:1';
	this.cache = {}; // In-memory cache for webOS data
	
	// Check for webOS service availability
	if (typeof webOS !== 'undefined' && webOS.service && webOS.service.request) {
		this.useWebOSStorage = true;
		if (typeof JellyfinAPI !== 'undefined') {
			JellyfinAPI.Logger.info('[STORAGE] webOS db8 service available - using persistent storage');
		}
		this._initWebOSStorage();
	} else {
		if (typeof JellyfinAPI !== 'undefined') {
			JellyfinAPI.Logger.warn('[STORAGE] webOS service unavailable - using localStorage only');
		}
	}
}

/**
 * Initialize webOS storage by loading existing data from db8
 * @private
 */
STORAGE.prototype._initWebOSStorage = function() {
	if (!this.useWebOSStorage) return;
	
	var self = this;
	
	// Load from localStorage immediately as backup
	if (localStorage) {
		try {
			for (var i = 0; i < localStorage.length; i++) {
				var key = localStorage.key(i);
				if (key) {
					self.cache[key] = localStorage.getItem(key);
				}
			}
			if (Object.keys(self.cache).length > 0 && typeof JellyfinAPI !== 'undefined') {
				JellyfinAPI.Logger.info('[STORAGE] Preloaded ' + Object.keys(self.cache).length + ' keys from localStorage');
			}
		} catch (e) {
			if (typeof JellyfinAPI !== 'undefined') {
				JellyfinAPI.Logger.warn('[STORAGE] Could not preload from localStorage:', e);
			}
		}
	}
	
	// Try to load from db8 (will override localStorage cache if available)
	try {
		webOS.service.request('luna://com.webos.service.db/', {
			method: 'find',
			parameters: {
				query: {
					from: this.dbKind
				}
			},
			onSuccess: function(response) {
				if (response && response.results && response.results.length > 0) {
					// Load all key-value pairs from db8
					response.results.forEach(function(item) {
						if (item.key && item.value !== undefined) {
							self.cache[item.key] = item.value;
						}
					});
					if (typeof JellyfinAPI !== 'undefined') {
						JellyfinAPI.Logger.success('[STORAGE] Loaded ' + Object.keys(self.cache).length + ' keys from webOS db8');
					}
				} else {
					if (typeof JellyfinAPI !== 'undefined') {
						JellyfinAPI.Logger.info('[STORAGE] No existing data in webOS db8, using localStorage cache');
					}
				}
			},
			onFailure: function(error) {
				// db8 kind might not exist yet, that's okay - we have localStorage cache
				if (typeof JellyfinAPI !== 'undefined') {
					JellyfinAPI.Logger.info('[STORAGE] webOS db8 not available, using localStorage (data: ' + Object.keys(self.cache).length + ' keys)');
				}
			}
		});
	} catch (e) {
		if (typeof JellyfinAPI !== 'undefined') {
			JellyfinAPI.Logger.warn('[STORAGE] Error initializing webOS db8, using localStorage:', e);
		}
	}
};

/**
 * Get value from storage
 * @param {string} name - Key name
 * @param {boolean} isJSON - Whether to parse as JSON (default: true)
 * @returns {*} Stored value or undefined
 */
STORAGE.prototype.get = function(name, isJSON) {	
	if (isJSON === undefined) {
		isJSON = true;	
	}
	
	// Use webOS persistent storage
	if (this.useWebOSStorage) {
		try {
			// Check cache first (loaded from db8 on init)
			if (this.cache.hasOwnProperty(name)) {
				var value = this.cache[name];
				if (isJSON && typeof value === 'string') {
					return JSON.parse(value);
				}
				return value;
			}
			
			// Fallback to localStorage if not in cache (db8 might not be ready yet)
			if (localStorage && localStorage.getItem(name)) {
				var localValue = localStorage.getItem(name);
				if (isJSON) {
					return JSON.parse(localValue);
				}
				return localValue;
			}
		} catch (e) {
			if (typeof JellyfinAPI !== 'undefined') {
				JellyfinAPI.Logger.error('[STORAGE] Error reading from webOS storage:', e);
			}
		}
		return undefined;
	}
	
	// Fallback to localStorage only
	try {
		if (localStorage && localStorage.getItem(name)) {
			if (isJSON) {
				return JSON.parse(localStorage.getItem(name));
			} else {
				return localStorage.getItem(name);
			}
		}
	} catch (e) {
		if (typeof JellyfinAPI !== 'undefined') {
			JellyfinAPI.Logger.error('[STORAGE] Error reading from localStorage:', e);
		}
	}
	return undefined;
};

/**
 * Set value in storage
 * @param {string} name - Key name
 * @param {*} data - Data to store
 * @param {boolean} isJSON - Whether to stringify as JSON (default: true)
 * @returns {*} The stored data
 */
STORAGE.prototype.set = function(name, data, isJSON) {
	if (isJSON === undefined) {
		isJSON = true;	
	}
	
	var valueToStore = isJSON ? JSON.stringify(data) : data;
	
	// Use webOS persistent storage via db8
	if (this.useWebOSStorage) {
		try {
			this.cache[name] = valueToStore;
			
			// Also write to localStorage as backup
			if (localStorage) {
				localStorage.setItem(name, valueToStore);
			}
			
			var dbObject = {
				_kind: this.dbKind,
				key: name,
				value: valueToStore
			};
			
			webOS.service.request('luna://com.webos.service.db/', {
				method: 'merge',
				parameters: {
					objects: [dbObject],
					query: {
						from: this.dbKind,
						where: [{ prop: 'key', op: '=', val: name }]
					}
				},
				onSuccess: function(response) {
					if (typeof JellyfinAPI !== 'undefined') {
						JellyfinAPI.Logger.info('[STORAGE] Persisted to webOS db8: ' + name);
					}
				},
				onFailure: function(error) {
					if (typeof JellyfinAPI !== 'undefined') {
						JellyfinAPI.Logger.warn('[STORAGE] db8 merge failed, data saved to localStorage:', error);
					}
				}
			});
		} catch (e) {
			if (typeof JellyfinAPI !== 'undefined') {
				JellyfinAPI.Logger.error('[STORAGE] Error writing to webOS storage:', e);
			}
		}
		return data;
	}
	
	// Fallback to localStorage
	try {
		if (localStorage) {
			localStorage.setItem(name, valueToStore);
		}
	} catch (e) {
		if (typeof JellyfinAPI !== 'undefined') {
			JellyfinAPI.Logger.error('[STORAGE] Error writing to localStorage:', e);
			JellyfinAPI.Logger.error('[STORAGE] This might be a quota issue');
		}
	}
	
	return data;
};

/**
 * Remove value from storage
 * @param {string} name - Key name to remove
 */
STORAGE.prototype.remove = function(name) {
	// Use webOS persistent storage via db8
	if (this.useWebOSStorage) {
		try {
			delete this.cache[name];
			
			// Also remove from localStorage
			if (localStorage) {
				localStorage.removeItem(name);
			}
			
			webOS.service.request('luna://com.webos.service.db/', {
				method: 'del',
				parameters: {
					query: {
						from: this.dbKind,
						where: [{ prop: 'key', op: '=', val: name }]
					}
				},
				onSuccess: function(response) {
					if (typeof JellyfinAPI !== 'undefined') {
						JellyfinAPI.Logger.info('[STORAGE] Removed from webOS db8: ' + name);
					}
				},
				onFailure: function(error) {
					if (typeof JellyfinAPI !== 'undefined') {
						JellyfinAPI.Logger.warn('[STORAGE] db8 del failed:', error);
					}
				}
			});
		} catch (e) {
			if (typeof JellyfinAPI !== 'undefined') {
				JellyfinAPI.Logger.error('[STORAGE] Error removing from webOS storage:', e);
			}
		}
		return;
	}
	
	// Fallback to localStorage
	try {
		if (localStorage) {
			localStorage.removeItem(name);
		}
	} catch (e) {
		if (typeof JellyfinAPI !== 'undefined') {
			JellyfinAPI.Logger.error('[STORAGE] Error removing from localStorage:', e);
		}
	}
};

/**
 * Check if key exists in storage
 * @param {string} name - Key name to check
 * @returns {boolean} True if key exists
 */
STORAGE.prototype.exists = function(name) {
	// Use webOS persistent storage
	if (this.useWebOSStorage) {
		return this.cache.hasOwnProperty(name);
	}
	
	// Fallback to localStorage
	try {
		if (localStorage) {
			return localStorage.getItem(name) !== null;
		}	
	} catch (e) {
		if (typeof JellyfinAPI !== 'undefined') {
			JellyfinAPI.Logger.error('[STORAGE] Error checking localStorage:', e);
		}
	}
	return false;
};

// ==================== Per-User Preferences Support (Phase 1) ====================

/**
 * Get the current logged-in user's ID
 * @returns {string|null} User ID or null if not logged in
 */
STORAGE.prototype.getCurrentUserId = function() {
	var auth = this.get('jellyfin_auth');
	if (auth && auth.userId) {
		return auth.userId;
	}
	return null;
};

/**
 * Generate a user-scoped storage key
 * @param {string} baseKey - The base key name (e.g., 'home_rows_settings')
 * @param {string} userId - User ID (optional, defaults to current user)
 * @returns {string} User-scoped key (e.g., 'home_rows_settings_user_abc123')
 */
STORAGE.prototype.getUserKey = function(baseKey, userId) {
	if (!userId) {
		userId = this.getCurrentUserId();
	}
	
	if (!userId) {
		// No user logged in, return global key as fallback
		return baseKey;
	}
	
	return baseKey + '_user_' + userId;
};

/**
 * Get user-scoped preference value
 * @param {string} baseKey - Base key name
 * @param {*} defaultValue - Default value if not found
 * @param {string} userId - User ID (optional, defaults to current user)
 * @returns {*} Stored value or default
 */
STORAGE.prototype.getUserPreference = function(baseKey, defaultValue, userId) {
	var userKey = this.getUserKey(baseKey, userId);
	var value = this.get(userKey);
	
	if (value === undefined || value === null) {
		// Try global fallback for backward compatibility
		var globalValue = this.get(baseKey);
		if (globalValue !== undefined && globalValue !== null) {
			// Found global value - migrate it to user-scoped
			this.setUserPreference(baseKey, globalValue, userId);
			return globalValue;
		}
		return defaultValue;
	}
	
	return value;
};

/**
 * Set user-scoped preference value
 * @param {string} baseKey - Base key name
 * @param {*} value - Value to store
 * @param {string} userId - User ID (optional, defaults to current user)
 * @returns {*} The stored value
 */
STORAGE.prototype.setUserPreference = function(baseKey, value, userId) {
	var userKey = this.getUserKey(baseKey, userId);
	return this.set(userKey, value);
};

/**
 * Remove user-scoped preference
 * @param {string} baseKey - Base key name
 * @param {string} userId - User ID (optional, defaults to current user)
 */
STORAGE.prototype.removeUserPreference = function(baseKey, userId) {
	var userKey = this.getUserKey(baseKey, userId);
	this.remove(userKey);
};

/**
 * Migrate global preference to user-scoped (for all users)
 * This is a helper for migration during Phase 1 rollout
 * @param {string} baseKey - Base key to migrate
 */
STORAGE.prototype.migrateToUserPreference = function(baseKey) {
	var globalValue = this.get(baseKey);
	
	if (globalValue === undefined || globalValue === null) {
		return; // Nothing to migrate
	}
	
	var currentUserId = this.getCurrentUserId();
	if (currentUserId) {
		// Migrate for current user
		var userKey = this.getUserKey(baseKey, currentUserId);
		if (!this.exists(userKey)) {
			this.set(userKey, globalValue);
			if (typeof JellyfinAPI !== 'undefined') {
				JellyfinAPI.Logger.info('[STORAGE] Migrated ' + baseKey + ' to user-scoped for user ' + currentUserId);
			}
		}
	}
	
	// Note: We don't remove the global key to maintain backward compatibility
	// It will serve as fallback for users not yet migrated
};

/**
 * Check if a user has user-scoped preferences stored
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user has any user-scoped preferences
 */
STORAGE.prototype.hasUserPreferences = function(userId) {
	if (!userId) {
		userId = this.getCurrentUserId();
	}
	
	if (!userId) {
		return false;
	}
	
	// Check for common user-scoped keys
	var commonKeys = ['home_rows_settings', 'jellyfin_settings'];
	for (var i = 0; i < commonKeys.length; i++) {
		var userKey = this.getUserKey(commonKeys[i], userId);
		if (this.exists(userKey)) {
			return true;
		}
	}
	
	return false;
};

/**
 * Apply backdrop blur to an element based on settings
 * @param {HTMLElement} element - The backdrop image element
 * @param {string} settingKey - The setting key ('backdropBlurHome' or 'backdropBlurDetail')
 * @param {number} maxBlur - Maximum blur in pixels (20 for home, 15 for detail)
 */
STORAGE.prototype.applyBackdropBlur = function(element, settingKey, maxBlur) {
	if (!element) return;
	
	var settings = this.getUserPreference('jellyfin_settings', null);
	if (!settings) return;
	
	try {
		if (typeof settings === 'string') settings = JSON.parse(settings);
		var blurAmount = settings[settingKey] !== undefined ? settings[settingKey] : 3;
		var blurPx = blurAmount * (maxBlur / 5); // Maps 0-5 to 0-maxBlur
		element.style.filter = 'blur(' + blurPx + 'px)';
	} catch (e) {
		// Fallback to default blur
		var defaultBlurPx = 3 * (maxBlur / 5);
		element.style.filter = 'blur(' + defaultBlurPx + 'px)';
	}
};

// ==================== Jellyseerr-Specific Storage Extensions ====================

/**
 * Get Jellyseerr storage key for a given user
 * @param {string} key - Base key name
 * @param {string} userId - Jellyfin user ID (optional)
 * @private
 */
STORAGE.prototype._getJellyseerrKey = function(key, userId) {
	if (userId) {
		return 'jellyseerr_' + userId + '_' + key;
	}
	return 'jellyseerr_' + key;
};

/**
 * Get Jellyseerr setting (global, not user-specific)
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Setting value
 */
STORAGE.prototype.getJellyseerrSetting = function(key, defaultValue) {
	var storageKey = 'jellyseerr_' + key;
	var value = this.get(storageKey, true);
	
	if (value === null || value === undefined) {
		return defaultValue;
	}
	
	// Try to parse as JSON for objects/arrays
	if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
		try {
			return JSON.parse(value);
		} catch (e) {
			return value;
		}
	}
	
	return value;
};

/**
 * Set Jellyseerr setting (global, not user-specific)
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 */
STORAGE.prototype.setJellyseerrSetting = function(key, value) {
	var storageKey = 'jellyseerr_' + key;
	var storageValue = value;
	
	// Stringify objects/arrays
	if (typeof value === 'object' && value !== null) {
		storageValue = JSON.stringify(value);
	}
	
	this.set(storageKey, storageValue, true);
	
	if (typeof JellyseerrAPI !== 'undefined') {
		JellyseerrAPI.Logger.debug('[STORAGE] Saved Jellyseerr setting: ' + key);
	}
};

/**
 * Get per-user Jellyseerr setting
 * @param {string} userId - Jellyfin user ID
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Setting value
 */
STORAGE.prototype.getJellyseerrUserSetting = function(userId, key, defaultValue) {
	if (!userId) {
		if (typeof JellyseerrAPI !== 'undefined') {
			JellyseerrAPI.Logger.warn('[STORAGE] User ID required for user-specific setting');
		}
		return defaultValue;
	}
	
	var storageKey = this._getJellyseerrKey(key, userId);
	var value = this.get(storageKey, true);
	
	if (value === null || value === undefined) {
		return defaultValue;
	}
	
	// Try to parse as JSON for objects/arrays
	if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
		try {
			return JSON.parse(value);
		} catch (e) {
			return value;
		}
	}
	
	return value;
};

/**
 * Set per-user Jellyseerr setting
 * @param {string} userId - Jellyfin user ID
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 */
STORAGE.prototype.setJellyseerrUserSetting = function(userId, key, value) {
	if (!userId) {
		if (typeof JellyseerrAPI !== 'undefined') {
			JellyseerrAPI.Logger.warn('[STORAGE] User ID required for user-specific setting');
		}
		return;
	}
	
	var storageKey = this._getJellyseerrKey(key, userId);
	var storageValue = value;
	
	// Stringify objects/arrays
	if (typeof value === 'object' && value !== null) {
		storageValue = JSON.stringify(value);
	}
	
	this.set(storageKey, storageValue, true);
	
	if (typeof JellyseerrAPI !== 'undefined') {
		JellyseerrAPI.Logger.debug('[STORAGE] Saved user Jellyseerr setting: ' + userId + '/' + key);
	}
};

/**
 * Remove Jellyseerr setting
 * @param {string} key - Setting key
 */
STORAGE.prototype.removeJellyseerrSetting = function(key) {
	var storageKey = 'jellyseerr_' + key;
	this.remove(storageKey, true);
};

/**
 * Remove per-user Jellyseerr setting
 * @param {string} userId - Jellyfin user ID
 * @param {string} key - Setting key
 */
STORAGE.prototype.removeJellyseerrUserSetting = function(userId, key) {
	if (!userId) return;
	var storageKey = this._getJellyseerrKey(key, userId);
	this.remove(storageKey, true);
};

/**
 * Get all Jellyseerr settings for a user
 * @param {string} userId - Jellyfin user ID
 * @returns {Object} All user settings as key-value pairs
 */
STORAGE.prototype.getAllJellyseerrUserSettings = function(userId) {
	if (!userId) return {};
	
	var prefix = 'jellyseerr_' + userId + '_';
	var settings = {};
	
	// Check cache first (for webOS)
	if (this.useWebOSStorage && this.cache) {
		for (var key in this.cache) {
			if (this.cache.hasOwnProperty(key) && key.startsWith(prefix)) {
				var settingKey = key.substring(prefix.length);
				var value = this.cache[key];
				
				// Try to parse JSON
				if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
					try {
						settings[settingKey] = JSON.parse(value);
					} catch (e) {
						settings[settingKey] = value;
					}
				} else {
					settings[settingKey] = value;
				}
			}
		}
	}
	
	// Also check localStorage
	if (localStorage) {
		try {
			for (var i = 0; i < localStorage.length; i++) {
				var storageKey = localStorage.key(i);
				if (storageKey && storageKey.startsWith(prefix)) {
					var settingKey = storageKey.substring(prefix.length);
					if (!settings.hasOwnProperty(settingKey)) {
						var value = localStorage.getItem(storageKey);
						
						// Try to parse JSON
						if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
							try {
								settings[settingKey] = JSON.parse(value);
							} catch (e) {
								settings[settingKey] = value;
							}
						} else {
							settings[settingKey] = value;
						}
					}
				}
			}
		} catch (e) {
			if (typeof JellyseerrAPI !== 'undefined') {
				JellyseerrAPI.Logger.error('[STORAGE] Error reading user settings:', e);
			}
		}
	}
	
	return settings;
};

/**
 * Clear all Jellyseerr data for a user
 * @param {string} userId - Jellyfin user ID
 */
STORAGE.prototype.clearJellyseerrUserData = function(userId) {
	if (!userId) return;
	
	var prefix = 'jellyseerr_' + userId + '_';
	var keysToRemove = [];
	
	// Collect keys to remove from cache
	if (this.useWebOSStorage && this.cache) {
		for (var key in this.cache) {
			if (this.cache.hasOwnProperty(key) && key.startsWith(prefix)) {
				keysToRemove.push(key);
			}
		}
	}
	
	// Collect keys from localStorage
	if (localStorage) {
		try {
			for (var i = 0; i < localStorage.length; i++) {
				var key = localStorage.key(i);
				if (key && key.startsWith(prefix)) {
					keysToRemove.push(key);
				}
			}
		} catch (e) {
			if (typeof JellyseerrAPI !== 'undefined') {
				JellyseerrAPI.Logger.error('[STORAGE] Error clearing user data:', e);
			}
		}
	}
	
	// Remove all collected keys
	keysToRemove.forEach(function(key) {
		this.remove(key, true);
	}.bind(this));
	
	if (typeof JellyseerrAPI !== 'undefined') {
		JellyseerrAPI.Logger.info('[STORAGE] Cleared Jellyseerr data for user: ' + userId);
	}
};

/**
 * Clear all Jellyseerr global settings
 */
STORAGE.prototype.clearJellyseerrSettings = function() {
	var prefix = 'jellyseerr_';
	var keysToRemove = [];
	
	// Collect keys to remove from cache
	if (this.useWebOSStorage && this.cache) {
		for (var key in this.cache) {
			if (this.cache.hasOwnProperty(key) && key.startsWith(prefix)) {
				// Skip user-specific keys (they have userId in them)
				if (key.match(/jellyseerr_[a-f0-9]{32}_/)) continue;
				keysToRemove.push(key);
			}
		}
	}
	
	// Collect keys from localStorage
	if (localStorage) {
		try {
			for (var i = 0; i < localStorage.length; i++) {
				var key = localStorage.key(i);
				if (key && key.startsWith(prefix)) {
					// Skip user-specific keys
					if (key.match(/jellyseerr_[a-f0-9]{32}_/)) continue;
					keysToRemove.push(key);
				}
			}
		} catch (e) {
			if (typeof JellyseerrAPI !== 'undefined') {
				JellyseerrAPI.Logger.error('[STORAGE] Error clearing global settings:', e);
			}
		}
	}
	
	// Remove all collected keys
	keysToRemove.forEach(function(key) {
		this.remove(key, true);
	}.bind(this));
	
	if (typeof JellyseerrAPI !== 'undefined') {
		JellyseerrAPI.Logger.info('[STORAGE] Cleared Jellyseerr global settings');
	}
};

/**
 * Migrate Jellyseerr storage data (for future version updates)
 * @param {number} fromVersion - Source version
 * @param {number} toVersion - Target version
 */
STORAGE.prototype.migrateJellyseerrData = function(fromVersion, toVersion) {
	if (typeof JellyseerrAPI !== 'undefined') {
		JellyseerrAPI.Logger.info('[STORAGE] Migrating Jellyseerr data from v' + fromVersion + ' to v' + toVersion);
	}
	
	// Migration logic will be added here as needed for future versions
	// Example migrations:
	
	// if (fromVersion < 2 && toVersion >= 2) {
	//     // Migrate v1 to v2 data structure
	// }
	
	// Store current version
	this.setJellyseerrSetting('storage_version', toVersion);
	
	if (typeof JellyseerrAPI !== 'undefined') {
		JellyseerrAPI.Logger.success('[STORAGE] Jellyseerr data migration complete');
	}
};

/**
 * Get Jellyseerr storage version
 * @returns {number} Current storage version
 */
STORAGE.prototype.getJellyseerrStorageVersion = function() {
	return parseInt(this.getJellyseerrSetting('storage_version', 1), 10);
};

/**
 * Initialize Jellyseerr storage system
 * Performs any necessary migrations
 */
STORAGE.prototype.initializeJellyseerrStorage = function() {
	var currentVersion = this.getJellyseerrStorageVersion();
	var targetVersion = 1; // Current version
	
	if (currentVersion < targetVersion) {
		this.migrateJellyseerrData(currentVersion, targetVersion);
	}
	
	if (typeof JellyseerrAPI !== 'undefined') {
		JellyseerrAPI.Logger.info('[STORAGE] Jellyseerr storage initialized (version ' + targetVersion + ')');
	}
};

// Initialize global storage instance after all prototypes are defined
var storage = new STORAGE();
