/**
 * Polyfills for older Chromium compatibility
 * Supports: webOS 3.x (Chromium 38), webOS 4-6 (Chromium 53-68)
 * Provides URLSearchParams, Promise, Symbol, and ES6+ Array/String/Object methods
 */

(function () {
   "use strict";

   // Array.isArray polyfill
   if (!Array.isArray) {
      Array.isArray = function (arg) {
         return Object.prototype.toString.call(arg) === "[object Array]";
      };
   }

   // Object.keys polyfill
   if (!Object.keys) {
      Object.keys = function (obj) {
         if (obj !== Object(obj)) {
            throw new TypeError("Object.keys called on a non-object");
         }
         var keys = [];
         for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
               keys.push(key);
            }
         }
         return keys;
      };
   }

   // Object.values polyfill
   if (!Object.values) {
      Object.values = function (obj) {
         if (obj !== Object(obj)) {
            throw new TypeError("Object.values called on a non-object");
         }
         var values = [];
         for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
               values.push(obj[key]);
            }
         }
         return values;
      };
   }

   // Object.entries polyfill
   if (!Object.entries) {
      Object.entries = function (obj) {
         if (obj !== Object(obj)) {
            throw new TypeError("Object.entries called on a non-object");
         }
         var entries = [];
         for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
               entries.push([key, obj[key]]);
            }
         }
         return entries;
      };
   }

   // Object.fromEntries polyfill
   if (!Object.fromEntries) {
      Object.fromEntries = function (iterable) {
         var obj = {};
         var arr = Array.isArray(iterable) ? iterable : Array.from(iterable);
         for (var i = 0; i < arr.length; i++) {
            var pair = arr[i];
            if (pair && pair.length >= 2) {
               obj[pair[0]] = pair[1];
            }
         }
         return obj;
      };
   }

   // Number.isFinite polyfill
   if (!Number.isFinite) {
      Number.isFinite = function (value) {
         return typeof value === "number" && isFinite(value);
      };
   }

   // Number.isNaN polyfill
   if (!Number.isNaN) {
      Number.isNaN = function (value) {
         return typeof value === "number" && isNaN(value);
      };
   }

   // Number.isInteger polyfill
   if (!Number.isInteger) {
      Number.isInteger = function (value) {
         return (
            typeof value === "number" &&
            isFinite(value) &&
            Math.floor(value) === value
         );
      };
   }

   if (!Number.parseInt) {
      Number.parseInt = parseInt;
   }
   if (!Number.parseFloat) {
      Number.parseFloat = parseFloat;
   }

   // String.prototype.padStart polyfill
   if (!String.prototype.padStart) {
      String.prototype.padStart = function (targetLength, padString) {
         targetLength = targetLength >> 0;
         padString = String(typeof padString !== "undefined" ? padString : " ");
         if (this.length >= targetLength) {
            return String(this);
         }
         targetLength = targetLength - this.length;
         if (targetLength > padString.length) {
            padString += padString.repeat(
               Math.ceil(targetLength / padString.length)
            );
         }
         return padString.slice(0, targetLength) + String(this);
      };
   }

   // String.prototype.padEnd polyfill
   if (!String.prototype.padEnd) {
      String.prototype.padEnd = function (targetLength, padString) {
         targetLength = targetLength >> 0;
         padString = String(typeof padString !== "undefined" ? padString : " ");
         if (this.length >= targetLength) {
            return String(this);
         }
         targetLength = targetLength - this.length;
         if (targetLength > padString.length) {
            padString += padString.repeat(
               Math.ceil(targetLength / padString.length)
            );
         }
         return String(this) + padString.slice(0, targetLength);
      };
   }

   // String.prototype.repeat polyfill
   if (!String.prototype.repeat) {
      String.prototype.repeat = function (count) {
         if (this == null) {
            throw new TypeError("can't convert " + this + " to object");
         }
         var str = "" + this;
         count = +count;
         if (count < 0 || count === Infinity) {
            throw new RangeError("Invalid count value");
         }
         count = Math.floor(count);
         if (str.length === 0 || count === 0) {
            return "";
         }
         var result = "";
         while (count > 0) {
            if (count & 1) {
               result += str;
            }
            count >>>= 1;
            if (count) {
               str += str;
            }
         }
         return result;
      };
   }

   // String.prototype.trim polyfill
   if (!String.prototype.trim) {
      String.prototype.trim = function () {
         return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
      };
   }

   // String.prototype.trimStart polyfill
   if (!String.prototype.trimStart) {
      String.prototype.trimStart = function () {
         return this.replace(/^[\s\uFEFF\xA0]+/, "");
      };
   }

   // String.prototype.trimEnd polyfill
   if (!String.prototype.trimEnd) {
      String.prototype.trimEnd = function () {
         return this.replace(/[\s\uFEFF\xA0]+$/, "");
      };
   }

   // Array.prototype.includes polyfill
   if (!Array.prototype.includes) {
      Array.prototype.includes = function (searchElement, fromIndex) {
         if (this == null) {
            throw new TypeError('"this" is null or not defined');
         }
         var o = Object(this);
         var len = o.length >>> 0;
         if (len === 0) return false;
         var n = fromIndex | 0;
         var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
         while (k < len) {
            if (o[k] === searchElement) return true;
            k++;
         }
         return false;
      };
   }

   // Array.prototype.find polyfill
   if (!Array.prototype.find) {
      Array.prototype.find = function (predicate, thisArg) {
         if (this == null) {
            throw new TypeError('"this" is null or not defined');
         }
         var o = Object(this);
         var len = o.length >>> 0;
         if (typeof predicate !== "function") {
            throw new TypeError("predicate must be a function");
         }
         for (var k = 0; k < len; k++) {
            var kValue = o[k];
            if (predicate.call(thisArg, kValue, k, o)) {
               return kValue;
            }
         }
         return undefined;
      };
   }

   // Array.prototype.findIndex polyfill
   if (!Array.prototype.findIndex) {
      Array.prototype.findIndex = function (predicate, thisArg) {
         if (this == null) {
            throw new TypeError('"this" is null or not defined');
         }
         var o = Object(this);
         var len = o.length >>> 0;
         if (typeof predicate !== "function") {
            throw new TypeError("predicate must be a function");
         }
         for (var k = 0; k < len; k++) {
            if (predicate.call(thisArg, o[k], k, o)) {
               return k;
            }
         }
         return -1;
      };
   }

   // Array.from polyfill
   if (!Array.from) {
      Array.from = function (arrayLike, mapFn, thisArg) {
         if (arrayLike == null) {
            throw new TypeError("Array.from requires an array-like object");
         }
         var len = arrayLike.length >>> 0;
         var result = new Array(len);
         for (var i = 0; i < len; i++) {
            result[i] = mapFn
               ? mapFn.call(thisArg, arrayLike[i], i)
               : arrayLike[i];
         }
         return result;
      };
   }

   // Array.prototype.flat polyfill
   if (!Array.prototype.flat) {
      Array.prototype.flat = function (depth) {
         var flattend = [];
         (function flat(array, depth) {
            for (var i = 0; i < array.length; i++) {
               var el = array[i];
               if (Array.isArray(el) && depth > 0) {
                  flat(el, depth - 1);
               } else {
                  flattend.push(el);
               }
            }
         })(this, Math.floor(depth) || 1);
         return flattend;
      };
   }

   // Array.prototype.flatMap polyfill
   if (!Array.prototype.flatMap) {
      Array.prototype.flatMap = function (callback, thisArg) {
         return this.map(callback, thisArg).flat();
      };
   }

   // String.prototype.includes polyfill
   if (!String.prototype.includes) {
      String.prototype.includes = function (search, start) {
         if (typeof start !== "number") start = 0;
         if (start + search.length > this.length) return false;
         return this.indexOf(search, start) !== -1;
      };
   }

   // String.prototype.startsWith polyfill
   if (!String.prototype.startsWith) {
      String.prototype.startsWith = function (search, pos) {
         pos = !pos || pos < 0 ? 0 : +pos;
         return this.substring(pos, pos + search.length) === search;
      };
   }

   // String.prototype.endsWith polyfill
   if (!String.prototype.endsWith) {
      String.prototype.endsWith = function (search, thisLen) {
         if (thisLen === undefined || thisLen > this.length) {
            thisLen = this.length;
         }
         return this.substring(thisLen - search.length, thisLen) === search;
      };
   }

   // Object.assign polyfill
   if (typeof Object.assign !== "function") {
      Object.assign = function (target) {
         if (target == null) {
            throw new TypeError("Cannot convert undefined or null to object");
         }
         var to = Object(target);
         for (var index = 1; index < arguments.length; index++) {
            var nextSource = arguments[index];
            if (nextSource != null) {
               for (var nextKey in nextSource) {
                  if (
                     Object.prototype.hasOwnProperty.call(nextSource, nextKey)
                  ) {
                     to[nextKey] = nextSource[nextKey];
                  }
               }
            }
         }
         return to;
      };
   }

   // NodeList.prototype.forEach polyfill
   if (typeof NodeList !== "undefined" && !NodeList.prototype.forEach) {
      NodeList.prototype.forEach = Array.prototype.forEach;
   }

   // HTMLCollection.prototype.forEach polyfill
   if (
      typeof HTMLCollection !== "undefined" &&
      !HTMLCollection.prototype.forEach
   ) {
      HTMLCollection.prototype.forEach = Array.prototype.forEach;
   }

   // Element.prototype.remove polyfill
   if (typeof Element !== "undefined" && !Element.prototype.remove) {
      Element.prototype.remove = function () {
         if (this.parentNode) {
            this.parentNode.removeChild(this);
         }
      };
   }

   // Promise polyfill for older webOS (Chromium 47 and below)
   if (typeof Promise === "undefined") {
      window.Promise = function (executor) {
         var self = this;
         self._state = "pending";
         self._value = undefined;
         self._handlers = [];

         function resolve(value) {
            if (self._state !== "pending") return;
            self._state = "fulfilled";
            self._value = value;
            self._handlers.forEach(function (h) {
               h.onFulfilled(value);
            });
         }

         function reject(reason) {
            if (self._state !== "pending") return;
            self._state = "rejected";
            self._value = reason;
            self._handlers.forEach(function (h) {
               h.onRejected(reason);
            });
         }

         this.then = function (onFulfilled, onRejected) {
            return new Promise(function (resolve, reject) {
               function handle(value) {
                  try {
                     var result =
                        typeof onFulfilled === "function"
                           ? onFulfilled(value)
                           : value;
                     if (result && typeof result.then === "function") {
                        result.then(resolve, reject);
                     } else {
                        resolve(result);
                     }
                  } catch (e) {
                     reject(e);
                  }
               }

               function handleError(reason) {
                  try {
                     if (typeof onRejected === "function") {
                        var result = onRejected(reason);
                        if (result && typeof result.then === "function") {
                           result.then(resolve, reject);
                        } else {
                           resolve(result);
                        }
                     } else {
                        reject(reason);
                     }
                  } catch (e) {
                     reject(e);
                  }
               }

               if (self._state === "fulfilled") {
                  setTimeout(function () {
                     handle(self._value);
                  }, 0);
               } else if (self._state === "rejected") {
                  setTimeout(function () {
                     handleError(self._value);
                  }, 0);
               } else {
                  self._handlers.push({
                     onFulfilled: handle,
                     onRejected: handleError,
                  });
               }
            });
         };

         this.catch = function (onRejected) {
            return this.then(null, onRejected);
         };

         try {
            executor(resolve, reject);
         } catch (e) {
            reject(e);
         }
      };

      Promise.resolve = function (value) {
         return new Promise(function (resolve) {
            resolve(value);
         });
      };

      Promise.reject = function (reason) {
         return new Promise(function (resolve, reject) {
            reject(reason);
         });
      };

      Promise.all = function (promises) {
         return new Promise(function (resolve, reject) {
            if (!promises || !promises.length) {
               resolve([]);
               return;
            }
            var results = [];
            var completed = 0;
            promises.forEach(function (promise, index) {
               Promise.resolve(promise).then(function (value) {
                  results[index] = value;
                  completed++;
                  if (completed === promises.length) {
                     resolve(results);
                  }
               }, reject);
            });
         });
      };

      console.log("[Polyfills] Promise available for older webOS");
   }

   // URLSearchParams polyfill
   if (!window.URLSearchParams) {
      window.URLSearchParams = function (search) {
         var self = this;
         self.dict = {};

         if (search) {
            // Handle object input (modern API)
            if (typeof search === 'object' && search !== null && !(search instanceof Array)) {
               for (var key in search) {
                  if (search.hasOwnProperty(key)) {
                     var value = search[key];
                     if (!self.dict[key]) {
                        self.dict[key] = [];
                     }
                     self.dict[key].push(value === null || value === undefined ? '' : String(value));
                  }
               }
            }
            // Handle string input
            else if (typeof search === 'string') {
               // Remove leading '?' if present
               search = search.replace(/^\?/, "");

               if (search) {
                  var pairs = search.split("&");
                  for (var i = 0; i < pairs.length; i++) {
                     var pair = pairs[i].split("=");
                     var key = decodeURIComponent(pair[0]);
                     var value = pair[1] ? decodeURIComponent(pair[1]) : "";

                     if (!self.dict[key]) {
                        self.dict[key] = [];
                     }
                     self.dict[key].push(value);
                  }
               }
            }
         }

         this.append = function (key, value) {
            if (!self.dict[key]) {
               self.dict[key] = [];
            }
            self.dict[key].push(value === null || value === undefined ? '' : String(value));
         };

         this.delete = function (key) {
            delete self.dict[key];
         };

         this.get = function (key) {
            return self.dict[key] ? self.dict[key][0] : null;
         };

         this.getAll = function (key) {
            return self.dict[key] || [];
         };

         this.has = function (key) {
            return self.dict.hasOwnProperty(key);
         };

         this.set = function (key, value) {
            self.dict[key] = [value];
         };

         this.toString = function () {
            var pairs = [];
            for (var key in self.dict) {
               if (self.dict.hasOwnProperty(key)) {
                  var values = self.dict[key];
                  for (var i = 0; i < values.length; i++) {
                     pairs.push(
                        encodeURIComponent(key) +
                           "=" +
                           encodeURIComponent(values[i])
                     );
                  }
               }
            }
            return pairs.join("&");
         };
      };
   }

   // URL constructor polyfill (partial - for hostname extraction)
   if (typeof URL === "undefined" || !URL.prototype) {
      window.URL = function (url, base) {
         var self = this;

         if (base) {
            if (url.indexOf("://") === -1 && url.indexOf("/") === 0) {
               var baseMatch = base.match(/^(https?:\/\/[^\/]+)/);
               if (baseMatch) {
                  url = baseMatch[1] + url;
               }
            } else if (url.indexOf("://") === -1) {
               url = base.replace(/\/[^\/]*$/, "/") + url;
            }
         }
         
         self.href = url;
         
         // Parse protocol
         var protocolMatch = url.match(/^([a-z][a-z0-9+.-]*:)/i);
         self.protocol = protocolMatch ? protocolMatch[1] : "";
         
         // Parse host and hostname
         var hostMatch = url.match(/^[a-z][a-z0-9+.-]*:\/\/([^\/\?#]+)/i);
         if (hostMatch) {
            self.host = hostMatch[1];
            self.hostname = hostMatch[1].split(":")[0];
            var portMatch = hostMatch[1].match(/:(\d+)$/);
            self.port = portMatch ? portMatch[1] : "";
         } else {
            self.host = "";
            self.hostname = "";
            self.port = "";
         }
         
         var pathMatch = url.match(/^[a-z][a-z0-9+.-]*:\/\/[^\/\?#]*(\/[^\?#]*)?/i);
         self.pathname = pathMatch && pathMatch[1] ? pathMatch[1] : "/";
         
         var searchMatch = url.match(/\?([^#]*)/);
         self.search = searchMatch ? "?" + searchMatch[1] : "";
         
         var hashMatch = url.match(/#(.*)$/);
         self.hash = hashMatch ? "#" + hashMatch[1] : "";
         
         self.origin = self.protocol + "//" + self.host;
         
         self.toString = function () {
            return self.href;
         };
      };
   }

   // Promise.prototype.finally polyfill
   if (
      typeof Promise !== "undefined" &&
      !Promise.prototype.finally
   ) {
      Promise.prototype.finally = function (callback) {
         var P = this.constructor;
         return this.then(
            function (value) {
               return P.resolve(callback()).then(function () {
                  return value;
               });
            },
            function (reason) {
               return P.resolve(callback()).then(function () {
                  throw reason;
               });
            }
         );
      };
   }

   // Promise.race polyfill
   if (typeof Promise !== "undefined" && !Promise.race) {
      Promise.race = function (promises) {
         return new Promise(function (resolve, reject) {
            if (!promises || !promises.length) {
               return;
            }
            for (var i = 0; i < promises.length; i++) {
               Promise.resolve(promises[i]).then(resolve, reject);
            }
         });
      };
   }

   // Promise.allSettled polyfill
   if (typeof Promise !== "undefined" && !Promise.allSettled) {
      Promise.allSettled = function (promises) {
         return Promise.all(
            promises.map(function (p) {
               return Promise.resolve(p).then(
                  function (value) {
                     return { status: "fulfilled", value: value };
                  },
                  function (reason) {
                     return { status: "rejected", reason: reason };
                  }
               );
            })
         );
      };
   }

   // ============================================
   // DOM POLYFILLS (older browsers)
   // ============================================

   // requestAnimationFrame polyfill
   if (!window.requestAnimationFrame) {
      window.requestAnimationFrame =
         window.webkitRequestAnimationFrame ||
         window.mozRequestAnimationFrame ||
         function (callback) {
            return window.setTimeout(callback, 1000 / 60);
         };
   }

   if (!window.cancelAnimationFrame) {
      window.cancelAnimationFrame =
         window.webkitCancelAnimationFrame ||
         window.mozCancelAnimationFrame ||
         function (id) {
            window.clearTimeout(id);
         };
   }

   // scrollIntoView with options polyfill (Chrome 61+)
   (function () {
      var originalScrollIntoView = Element.prototype.scrollIntoView;
      
      var supportsOptions = false;
      try {
         var testDiv = document.createElement("div");
         testDiv.scrollIntoView({ behavior: "instant" });
         supportsOptions = true;
      } catch (e) {
         supportsOptions = false;
      }
      
      if (!supportsOptions) {
         Element.prototype.scrollIntoView = function (arg) {
            if (arg === undefined || arg === null || typeof arg === "boolean") {
               originalScrollIntoView.call(this, arg);
            } else if (typeof arg === "object") {
               var block = arg.block || "start";
               var alignToTop = block === "start" || block === "nearest";
               
               if (block === "nearest") {
                  var rect = this.getBoundingClientRect();
                  var viewHeight = window.innerHeight || document.documentElement.clientHeight;
                  
                  if (rect.top < 0) {
                     alignToTop = true;
                  } else if (rect.bottom > viewHeight) {
                     alignToTop = false;
                  } else {
                     return;
                  }
               }
               
               originalScrollIntoView.call(this, alignToTop);
            }
         };
      }
   })();

   // Element.closest polyfill
   if (!Element.prototype.closest) {
      Element.prototype.closest = function (selector) {
         var el = this;
         while (el && el.nodeType === 1) {
            if (el.matches(selector)) {
               return el;
            }
            el = el.parentElement || el.parentNode;
         }
         return null;
      };
   }

   // Element.matches polyfill
   if (!Element.prototype.matches) {
      Element.prototype.matches =
         Element.prototype.webkitMatchesSelector ||
         Element.prototype.mozMatchesSelector ||
         Element.prototype.msMatchesSelector ||
         function (selector) {
            var matches = (
               this.document || this.ownerDocument
            ).querySelectorAll(selector);
            var i = matches.length;
            while (--i >= 0 && matches.item(i) !== this) {}
            return i > -1;
         };
   }

   // classList polyfill for SVG
   if (typeof SVGElement !== "undefined" && !("classList" in SVGElement.prototype)) {
      Object.defineProperty(SVGElement.prototype, "classList", {
         get: function () {
            var self = this;
            return {
               contains: function (className) {
                  return self.className.baseVal.split(" ").indexOf(className) !== -1;
               },
               add: function (className) {
                  if (!this.contains(className)) {
                     self.className.baseVal += " " + className;
                  }
               },
               remove: function (className) {
                  self.className.baseVal = self.className.baseVal
                     .split(" ")
                     .filter(function (c) {
                        return c !== className;
                     })
                     .join(" ");
               },
               toggle: function (className) {
                  if (this.contains(className)) {
                     this.remove(className);
                  } else {
                     this.add(className);
                  }
               },
            };
         },
      });
   }

   // DOMTokenList.prototype.forEach polyfill
   if (
      typeof DOMTokenList !== "undefined" &&
      !DOMTokenList.prototype.forEach
   ) {
      DOMTokenList.prototype.forEach = Array.prototype.forEach;
   }

   if (typeof console === "undefined") {
      window.console = {
         log: function () {},
         warn: function () {},
         error: function () {},
         info: function () {},
         debug: function () {},
      };
   }

   if (!console.debug) {
      console.debug = console.log;
   }
   if (!console.info) {
      console.info = console.log;
   }

   // performance.now polyfill
   if (!window.performance) {
      window.performance = {};
   }
   if (!window.performance.now) {
      var startTime = Date.now();
      window.performance.now = function () {
         return Date.now() - startTime;
      };
   }

   // Log polyfills loaded
   if (typeof console !== "undefined" && console.log) {
      var webOSVersion = "unknown";
      if (
         typeof window !== "undefined" &&
         window.PalmSystem &&
         window.PalmSystem.deviceInfo
      ) {
         try {
            var deviceInfo = JSON.parse(window.PalmSystem.deviceInfo);
            webOSVersion = deviceInfo.platformVersion || "unknown";
         } catch (e) {}
      }
      console.log(
         "[Polyfills] Loaded comprehensive polyfills for webOS " + webOSVersion
      );
   }

   // Global image proxy for webOS 4 SSL certificate issues
   window.ImageProxy = (function() {
      var proxyCache = {};
      var proxyEnabled = false;
      var pendingRequests = {};
      
      // Check if image proxy should be enabled (webOS with Luna service)
      function init() {
         if (typeof webOS !== 'undefined' && webOS.service) {
            proxyEnabled = true;
            console.log('[ImageProxy] Enabled - Luna service available');
         }
      }
      
      // Load image through Luna service proxy
      function loadImage(imgElement, url) {
         if (!proxyEnabled || !url) {
            imgElement.src = url;
            return;
         }
         
         // Only proxy TMDB images
         if (url.indexOf('image.tmdb.org') === -1) {
            imgElement.src = url;
            return;
         }
         
         // Check cache first
         if (proxyCache[url]) {
            imgElement.src = proxyCache[url];
            return;
         }
         
         // Check if request is already pending
         if (pendingRequests[url]) {
            pendingRequests[url].push(imgElement);
            return;
         }
         
         pendingRequests[url] = [imgElement];
         
         // Set placeholder while loading
         imgElement.dataset.originalSrc = url;
         
         webOS.service.request('luna://org.moonfin.webos.service', {
            method: 'imageProxy',
            parameters: { url: url },
            onSuccess: function(response) {
               if (response.success && response.data) {
                  proxyCache[url] = response.data;
                  // Apply to all waiting images
                  var waiting = pendingRequests[url] || [];
                  for (var i = 0; i < waiting.length; i++) {
                     waiting[i].src = response.data;
                  }
               } else {
                  // Fallback to direct URL
                  var waiting = pendingRequests[url] || [];
                  for (var i = 0; i < waiting.length; i++) {
                     waiting[i].src = url;
                  }
               }
               delete pendingRequests[url];
            },
            onFailure: function(error) {
               console.warn('[ImageProxy] Failed to proxy:', url, error);
               // Fallback to direct URL
               var waiting = pendingRequests[url] || [];
               for (var i = 0; i < waiting.length; i++) {
                  waiting[i].src = url;
               }
               delete pendingRequests[url];
            }
         });
      }
      
      // Get proxied URL (for background images, etc.)
      function getProxiedUrl(url, callback) {
         if (!proxyEnabled || !url || url.indexOf('image.tmdb.org') === -1) {
            callback(url);
            return;
         }
         
         if (proxyCache[url]) {
            callback(proxyCache[url]);
            return;
         }
         
         webOS.service.request('luna://org.moonfin.webos.service', {
            method: 'imageProxy',
            parameters: { url: url },
            onSuccess: function(response) {
               if (response.success && response.data) {
                  proxyCache[url] = response.data;
                  callback(response.data);
               } else {
                  callback(url);
               }
            },
            onFailure: function() {
               callback(url);
            }
         });
      }
      
      // Initialize on load
      if (typeof document !== 'undefined') {
         if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
         } else {
            init();
         }
      }
      
      return {
         loadImage: loadImage,
         getProxiedUrl: getProxiedUrl,
         isEnabled: function() { return proxyEnabled; },
         clearCache: function() { proxyCache = {}; }
      };
   })();
})();
