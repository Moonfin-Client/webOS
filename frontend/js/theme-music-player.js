/**
 * ThemeMusicPlayer
 * Singleton for playing and stopping theme music for items (shows/movies).
 * Uses HTML5 Audio for playback. Ensures only one theme is played at a time.
 *
 * @namespace ThemeMusicPlayer
 */
var ThemeMusicPlayer = (function() {
    'use strict';

    /**
     * The current HTMLAudioElement instance
     * @type {HTMLAudioElement|null}
     */
    var audio = null;
    /**
     * The currently playing theme music URL
     * @type {string|null}
     */
    var currentUrl = null;
    /**
     * Whether theme music playback is enabled
     * @type {boolean}
     */
    var enabled = true;

    /**
     * Play theme music from a given URL
     * @function
     * @param {string} url - The theme music URL
     */
    function play(url) {
        if (!enabled || !url) return;
        if (currentUrl === url && audio && !audio.paused) return;
        stop();
        audio = new Audio(url);
        audio.loop = true;
        audio.volume = 0.7;
        audio.play().then(function() {
            console.log('[ThemeMusicPlayer] Playing theme music:', url);
        }).catch(function(err) {
            console.warn('[ThemeMusicPlayer] Error playing theme music:', err);
        });
        currentUrl = url;
    }

    /**
     * Stop any currently playing theme music
     * @function
     */
    function stop() {
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio = null;
            currentUrl = null;
            console.log('[ThemeMusicPlayer] Stopped theme music');
        }
    }

    /**
     * Enable or disable theme music playback
     * @function
     * @param {boolean} value
     */
    function setEnabled(value) {
        enabled = !!value;
        if (!enabled) stop();
    }

    /**
     * Get whether theme music is enabled
     * @function
     * @returns {boolean}
     */
    function isEnabled() {
        return enabled;
    }

    return {
        play: play,
        stop: stop,
        setEnabled: setEnabled,
        isEnabled: isEnabled
    };
})();
