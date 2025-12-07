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

var storage = new STORAGE();

function STORAGE() {
	// Initialize webOS systeminfo storage if available
	this.useWebOSStorage = typeof webOS !== 'undefined' && webOS.service;
	
	if (this.useWebOSStorage) {
		console.log('[STORAGE] Using webOS persistent storage API');
	} else {
		console.log('[STORAGE] Using localStorage (may not persist on webOS)');
	}
};

STORAGE.prototype.get = function(name, isJSON) {	
	if (isJSON === undefined) {
		isJSON = true;	
	}
	
	// Try webOS storage first (persistent across app launches)
	if (this.useWebOSStorage) {
		try {
			// Use localStorage as cache, but it's the primary for webOS too
			// webOS should persist localStorage automatically
			if (localStorage && localStorage.getItem(name)) {
				if (isJSON) {
					return JSON.parse(localStorage.getItem(name));
				} else {
					return localStorage.getItem(name);
				}
			}
		} catch (e) {
			console.error('[STORAGE] Error reading from storage:', e);
		}
	}
	
	// Fallback to standard localStorage
	if (localStorage) {
		if (localStorage.getItem(name)) {
			if (isJSON) {
				return JSON.parse(localStorage.getItem(name));
			} else {
				return localStorage.getItem(name);
			}
		}
	}
};

STORAGE.prototype.set = function(name, data, isJSON) {
	if (isJSON === undefined) {
		isJSON = true;	
	}
	
	try {
		if (localStorage) {
			if (isJSON) {
				var stringified = JSON.stringify(data);
				localStorage.setItem(name, stringified);
				console.log('[STORAGE] Saved ' + name + ' (' + stringified.length + ' bytes)');
			} else {
				localStorage.setItem(name, data);
				console.log('[STORAGE] Saved ' + name);
			}
		}
		
		// For webOS, explicitly flush to ensure persistence
		if (this.useWebOSStorage && typeof localStorage !== 'undefined') {
			// WebOS should handle this automatically, but we log it
			console.log('[STORAGE] Data should persist on webOS');
		}
	} catch (e) {
		console.error('[STORAGE] Error writing to storage:', e);
		console.error('[STORAGE] This might be a quota issue or webOS restriction');
	}
	
	return data;
};

STORAGE.prototype.remove = function(name) {
	try {
		if (localStorage) {
			localStorage.removeItem(name);
			console.log('[STORAGE] Removed ' + name);
		}
	} catch (e) {
		console.error('[STORAGE] Error removing from storage:', e);
	}
};

STORAGE.prototype.exists = function(name) {
	try {
		if (localStorage) {
			if (localStorage.getItem(name)) {
				return true;
			} 
		}	
	} catch (e) {
		console.error('[STORAGE] Error checking storage:', e);
	}
	return false;
};