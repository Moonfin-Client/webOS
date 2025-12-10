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

// Initialize global storage instance after all prototypes are defined
var storage = new STORAGE();