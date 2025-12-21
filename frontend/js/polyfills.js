/**
 * Polyfills for webOS 6 / Chromium 52 compatibility
 * Provides URLSearchParams support for older browsers
 */

(function() {
    'use strict';

    // URLSearchParams polyfill for Chromium 52 / webOS 6
    if (!window.URLSearchParams) {
        window.URLSearchParams = function(search) {
            var self = this;
            self.dict = {};

            if (search) {
                // Remove leading '?' if present
                search = search.replace(/^\?/, '');
                
                if (search) {
                    var pairs = search.split('&');
                    for (var i = 0; i < pairs.length; i++) {
                        var pair = pairs[i].split('=');
                        var key = decodeURIComponent(pair[0]);
                        var value = pair[1] ? decodeURIComponent(pair[1]) : '';
                        
                        if (!self.dict[key]) {
                            self.dict[key] = [];
                        }
                        self.dict[key].push(value);
                    }
                }
            }

            this.append = function(key, value) {
                if (!self.dict[key]) {
                    self.dict[key] = [];
                }
                self.dict[key].push(value);
            };

            this.delete = function(key) {
                delete self.dict[key];
            };

            this.get = function(key) {
                return self.dict[key] ? self.dict[key][0] : null;
            };

            this.getAll = function(key) {
                return self.dict[key] || [];
            };

            this.has = function(key) {
                return self.dict.hasOwnProperty(key);
            };

            this.set = function(key, value) {
                self.dict[key] = [value];
            };

            this.toString = function() {
                var pairs = [];
                for (var key in self.dict) {
                    if (self.dict.hasOwnProperty(key)) {
                        var values = self.dict[key];
                        for (var i = 0; i < values.length; i++) {
                            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(values[i]));
                        }
                    }
                }
                return pairs.join('&');
            };
        };
    }
})();
