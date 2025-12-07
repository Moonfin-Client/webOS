/*
 * Jellyfin WebOS Key Codes
 * Global key code constants for consistent keyboard/remote navigation
 */

var KeyCodes = (function() {
    'use strict';

    // Standard navigation keys
    var NAVIGATION = {
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        ENTER: 13,
        OK: 13 // Alias for ENTER
    };

    // WebOS specific keys
    var WEBOS = {
        BACK: 461,
        RED: 403,
        GREEN: 404,
        YELLOW: 405,
        BLUE: 406,
        PLAY: 415,
        PAUSE: 19,
        STOP: 413,
        REWIND: 412,
        FAST_FORWARD: 417
    };

    // Standard keyboard keys
    var KEYBOARD = {
        SPACE: 32,
        ESCAPE: 27,
        TAB: 9,
        BACKSPACE: 8,
        DELETE: 46
    };

    // Number keys
    var NUMBERS = {
        ZERO: 48,
        ONE: 49,
        TWO: 50,
        THREE: 51,
        FOUR: 52,
        FIVE: 53,
        SIX: 54,
        SEVEN: 55,
        EIGHT: 56,
        NINE: 57
    };

    // Merged object with all keys
    var ALL_KEYS = {
        // Navigation
        LEFT: NAVIGATION.LEFT,
        UP: NAVIGATION.UP,
        RIGHT: NAVIGATION.RIGHT,
        DOWN: NAVIGATION.DOWN,
        ENTER: NAVIGATION.ENTER,
        OK: NAVIGATION.OK,
        
        // WebOS specific
        BACK: WEBOS.BACK,
        RED: WEBOS.RED,
        GREEN: WEBOS.GREEN,
        YELLOW: WEBOS.YELLOW,
        BLUE: WEBOS.BLUE,
        PLAY: WEBOS.PLAY,
        PAUSE: WEBOS.PAUSE,
        STOP: WEBOS.STOP,
        REWIND: WEBOS.REWIND,
        FAST_FORWARD: WEBOS.FAST_FORWARD,
        
        // Keyboard
        SPACE: KEYBOARD.SPACE,
        ESCAPE: KEYBOARD.ESCAPE,
        TAB: KEYBOARD.TAB,
        BACKSPACE: KEYBOARD.BACKSPACE,
        DELETE: KEYBOARD.DELETE,
        
        // Numbers
        ZERO: NUMBERS.ZERO,
        ONE: NUMBERS.ONE,
        TWO: NUMBERS.TWO,
        THREE: NUMBERS.THREE,
        FOUR: NUMBERS.FOUR,
        FIVE: NUMBERS.FIVE,
        SIX: NUMBERS.SIX,
        SEVEN: NUMBERS.SEVEN,
        EIGHT: NUMBERS.EIGHT,
        NINE: NUMBERS.NINE
    };

    /**
     * Check if a key code is a navigation key
     * @param {number} keyCode - The key code to check
     * @returns {boolean} True if the key is a navigation key
     */
    function isNavigationKey(keyCode) {
        return keyCode === NAVIGATION.LEFT ||
               keyCode === NAVIGATION.UP ||
               keyCode === NAVIGATION.RIGHT ||
               keyCode === NAVIGATION.DOWN ||
               keyCode === NAVIGATION.ENTER;
    }

    /**
     * Check if a key code is a number key
     * @param {number} keyCode - The key code to check
     * @returns {boolean} True if the key is a number key
     */
    function isNumberKey(keyCode) {
        return keyCode >= NUMBERS.ZERO && keyCode <= NUMBERS.NINE;
    }

    /**
     * Get the number value from a number key code
     * @param {number} keyCode - The key code
     * @returns {number|null} The number value (0-9) or null if not a number key
     */
    function getNumberValue(keyCode) {
        if (isNumberKey(keyCode)) {
            return keyCode - NUMBERS.ZERO;
        }
        return null;
    }

    /**
     * Get a human-readable name for a key code
     * @param {number} keyCode - The key code
     * @returns {string} The key name or 'UNKNOWN'
     */
    function getKeyName(keyCode) {
        for (var key in ALL_KEYS) {
            if (ALL_KEYS[key] === keyCode) {
                return key;
            }
        }
        return 'UNKNOWN';
    }

    // Public API
    return {
        // Key code groups
        NAVIGATION: NAVIGATION,
        WEBOS: WEBOS,
        KEYBOARD: KEYBOARD,
        NUMBERS: NUMBERS,
        
        // Individual keys (flat structure for convenience)
        LEFT: ALL_KEYS.LEFT,
        UP: ALL_KEYS.UP,
        RIGHT: ALL_KEYS.RIGHT,
        DOWN: ALL_KEYS.DOWN,
        ENTER: ALL_KEYS.ENTER,
        OK: ALL_KEYS.OK,
        BACK: ALL_KEYS.BACK,
        RED: ALL_KEYS.RED,
        GREEN: ALL_KEYS.GREEN,
        YELLOW: ALL_KEYS.YELLOW,
        BLUE: ALL_KEYS.BLUE,
        PLAY: ALL_KEYS.PLAY,
        PAUSE: ALL_KEYS.PAUSE,
        STOP: ALL_KEYS.STOP,
        REWIND: ALL_KEYS.REWIND,
        FAST_FORWARD: ALL_KEYS.FAST_FORWARD,
        SPACE: ALL_KEYS.SPACE,
        ESCAPE: ALL_KEYS.ESCAPE,
        TAB: ALL_KEYS.TAB,
        BACKSPACE: ALL_KEYS.BACKSPACE,
        DELETE: ALL_KEYS.DELETE,
        ZERO: ALL_KEYS.ZERO,
        ONE: ALL_KEYS.ONE,
        TWO: ALL_KEYS.TWO,
        THREE: ALL_KEYS.THREE,
        FOUR: ALL_KEYS.FOUR,
        FIVE: ALL_KEYS.FIVE,
        SIX: ALL_KEYS.SIX,
        SEVEN: ALL_KEYS.SEVEN,
        EIGHT: ALL_KEYS.EIGHT,
        NINE: ALL_KEYS.NINE,
        
        // Utility functions
        isNavigationKey: isNavigationKey,
        isNumberKey: isNumberKey,
        getNumberValue: getNumberValue,
        getKeyName: getKeyName
    };
})();
