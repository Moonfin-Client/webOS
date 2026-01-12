// -*- coding: utf-8 -*-

/*
 * Video Player Adapter - Abstraction layer for multiple playback engines
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * @module VideoPlayerAdapter
 * @description Abstraction layer for multiple playback engines with webOS-specific improvements.
 * Supports native HTML5, HLS.js, Shaka Player, and webOS native API with automatic engine selection.
 * Features enhanced error handling, playback health monitoring, and automatic fallback system.
 * Licensed under MPL 2.0 (see header for full license)
 */

/**
 * Media Error Types 
 * @constant
 */
const MediaError = {
    NETWORK_ERROR: 'NetworkError',
    MEDIA_DECODE_ERROR: 'MediaDecodeError',
    MEDIA_NOT_SUPPORTED: 'MediaNotSupported',
    FATAL_HLS_ERROR: 'FatalHlsError',
    SERVER_ERROR: 'ServerError',
    NO_MEDIA_ERROR: 'NoMediaError',
    PLAYBACK_STUCK: 'PlaybackStuck',
    LOAD_TIMEOUT: 'LoadTimeout',
    CODEC_UNSUPPORTED: 'CodecUnsupported',
    DRM_ERROR: 'DrmError'
};

/**
 * Recovery Strategy Types
 * @constant
 */
const RecoveryStrategy = {
    RETRY: 'retry',
    FALLBACK_ADAPTER: 'fallback_adapter',
    FALLBACK_TRANSCODE: 'fallback_transcode',
    NONE: 'none'
};

/**
 * Adapter priority for fallback chain
 * @constant
 */
const AdapterPriority = {
    SHAKA: 1,
    WEBOS_NATIVE: 2,
    HTML5: 3
};

/**
 * HLS.js error recovery timing
 */
let recoverDecodingErrorDate;
let recoverSwapAudioCodecDate;

/**
 * PlaybackHealthMonitor - Monitors playback health and detects issues
 * @class
 */
class PlaybackHealthMonitor {
    /**
     * @param {HTMLVideoElement} videoElement - Video element to monitor
     * @param {Object} options - Monitor options
     * @param {Function} options.onHealthIssue - Callback when health issue detected
     * @param {Function} options.onHealthy - Callback when playback is healthy
     * @param {boolean} options.isDirectPlay - Whether this is direct play (affects thresholds)
     */
    constructor(videoElement, options = {}) {
        this.videoElement = videoElement;
        this.options = options;
        this.checkCount = 0;
        this.lastTime = 0;
        this.playbackEverStarted = false;
        this.healthCheckTimer = null;
        this.isRunning = false;
        this.adapter = options.adapter || null;
        
        // Configuration based on playback type
        this.maxChecks = options.isDirectPlay ? 5 : 8;
        this.checkInterval = 2000; // 2 seconds
        this.pausedThreshold = options.isDirectPlay ? 3 : 4;
    }

    /**
     * Start monitoring playback health
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.checkCount = 0;
        this.lastTime = 0;
        this.playbackEverStarted = false;
        
        console.log('[HealthMonitor] Starting health check (isDirectPlay=' + !!this.options.isDirectPlay + ')');
        
        // Start checking after initial delay
        this.healthCheckTimer = setTimeout(() => this.checkHealth(), this.checkInterval);
    }

    /**
     * Stop monitoring
     */
    stop() {
        this.isRunning = false;
        if (this.healthCheckTimer) {
            clearTimeout(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
        console.log('[HealthMonitor] Stopped');
    }

    /**
     * Get current playback time from adapter or video element
     * @private
     * @returns {number} Current time in seconds
     */
    getCurrentTime() {
        if (this.adapter && typeof this.adapter.getCurrentTime === 'function') {
            return this.adapter.getCurrentTime();
        }
        return this.videoElement.currentTime;
    }

    /**
     * Check if playback is paused
     * @private
     * @returns {boolean} True if paused
     */
    isPaused() {
        if (this.adapter && typeof this.adapter.isPaused === 'function') {
            return this.adapter.isPaused();
        }
        return this.videoElement.paused;
    }

    /**
     * Check if using a native adapter (Shaka, webOS native)
     * @private
     * @returns {boolean} True if native adapter
     */
    isNativeAdapter() {
        if (!this.adapter || !this.adapter.getName) return false;
        const name = this.adapter.getName();
        return name === 'ShakaPlayer' || name === 'WebOSNative';
    }

    /**
     * Perform health check
     * @private
     */
    checkHealth() {
        if (!this.isRunning) return;

        this.checkCount++;
        const currentTime = this.getCurrentTime();
        
        // Track if playback ever progressed
        if (currentTime > 0) {
            this.playbackEverStarted = true;
        }

        // For native adapters (Shaka, webOS), use simpler checks
        if (this.isNativeAdapter()) {
            const paused = this.isPaused();
            const isStuck = !paused && currentTime === this.lastTime && this.checkCount > 1;
            
            console.log('[HealthMonitor] Check #' + this.checkCount + ' (native):', {
                currentTime: currentTime,
                paused: paused,
                adapter: this.adapter.getName(),
                stuck: isStuck
            });
            
            // For native adapters, only fail if stuck for multiple checks
            if (isStuck && this.checkCount >= 3) {
                console.log('[HealthMonitor] Native adapter playback appears stuck');
                this.reportIssue({
                    type: 'stuck',
                    currentTime: currentTime,
                    checkCount: this.checkCount,
                    adapter: this.adapter.getName()
                });
                return;
            }
            
            // Initialize callbacks on first successful check
            if (this.checkCount === 1 && currentTime >= 0 && this.options.onHealthy) {
                this.options.onHealthy({ firstCheck: true, currentTime: currentTime });
            }
            
            // Playback is fine, schedule next check
            this.lastTime = currentTime;
            this.healthCheckTimer = setTimeout(() => this.checkHealth(), this.checkInterval);
            return;
        }

        // HTML5 video element checks
        const videoPlayer = this.videoElement;
        
        // Check 1: Is playback stuck? (time not advancing when it should)
        const isStuck = !videoPlayer.paused && currentTime === this.lastTime;
        
        // Check 1b: Stuck at 0:00 - common for unsupported codecs
        const stuckAtStart = currentTime === 0 && 
            videoPlayer.readyState < HTMLMediaElement.HAVE_FUTURE_DATA && this.checkCount >= 2;
        
        // Check 1c: Video still paused after several checks - canplay never fired
        const stuckPaused = videoPlayer.paused && currentTime === 0 && 
            videoPlayer.readyState < HTMLMediaElement.HAVE_METADATA && this.checkCount >= this.pausedThreshold;

        // Check 2: Video element in bad state?
        const readyStateThreshold = this.options.isDirectPlay ? 3 : 4;
        const isBadState =
            videoPlayer.error ||
            videoPlayer.networkState === HTMLMediaElement.NETWORK_NO_SOURCE ||
            (videoPlayer.readyState < HTMLMediaElement.HAVE_CURRENT_DATA &&
                this.checkCount >= readyStateThreshold);

        // Check 3: No video or audio tracks?
        let noTracks = false;
        if (videoPlayer.videoTracks && videoPlayer.audioTracks) {
            noTracks = videoPlayer.videoTracks.length === 0 || videoPlayer.audioTracks.length === 0;
        }
        
        // Log current state for debugging
        console.log('[HealthMonitor] Check #' + this.checkCount + ':', {
            currentTime: currentTime,
            paused: videoPlayer.paused,
            readyState: videoPlayer.readyState,
            networkState: videoPlayer.networkState,
            hasError: !!videoPlayer.error
        });

        // Check if max checks reached without playback
        if (this.checkCount >= this.maxChecks) {
            if (!this.playbackEverStarted && currentTime === 0) {
                console.log('[HealthMonitor] Playback never started after ' + this.checkCount + ' checks');
                this.reportIssue({
                    type: 'never_started',
                    readyState: videoPlayer.readyState,
                    networkState: videoPlayer.networkState,
                    error: videoPlayer.error ? videoPlayer.error.message : 'none'
                });
                return;
            }
        }

        // Report issue if detected
        if (isStuck || isBadState || noTracks || stuckAtStart || stuckPaused) {
            console.log('[HealthMonitor] Health issue detected:', {
                stuck: isStuck,
                stuckAtStart: stuckAtStart,
                stuckPaused: stuckPaused,
                badState: isBadState,
                noTracks: noTracks
            });
            
            this.reportIssue({
                type: isStuck ? 'stuck' : (isBadState ? 'bad_state' : (noTracks ? 'no_tracks' : 'start_failed')),
                stuck: isStuck,
                stuckAtStart: stuckAtStart,
                stuckPaused: stuckPaused,
                badState: isBadState,
                noTracks: noTracks,
                readyState: videoPlayer.readyState,
                networkState: videoPlayer.networkState,
                currentTime: currentTime,
                paused: videoPlayer.paused
            });
            return;
        }

        // Initialize callbacks on first successful check
        if (this.checkCount === 1 && currentTime >= 0 && this.options.onHealthy) {
            this.options.onHealthy({ firstCheck: true, currentTime: currentTime });
        }

        // All checks passed, schedule next check
        this.lastTime = currentTime;
        this.healthCheckTimer = setTimeout(() => this.checkHealth(), this.checkInterval);
    }

    /**
     * Report health issue to callback
     * @private
     * @param {Object} details - Issue details
     */
    reportIssue(details) {
        this.stop();
        
        // Log to ServerLogger if available
        if (typeof ServerLogger !== 'undefined') {
            const logMessage = this.options.isDirectPlay ? 
                'Direct play health check failed' : 
                'Transcode playback health check failed';
            ServerLogger.logPlaybackWarning(logMessage, details);
        }
        
        if (this.options.onHealthIssue) {
            this.options.onHealthIssue(details);
        }
    }
}

/**
 * ErrorRecoveryManager - Handles error recovery and fallback strategies
 * @class
 */
class ErrorRecoveryManager {
    /**
     * @param {Object} options - Recovery options
     * @param {Function} options.onFallback - Callback when fallback needed
     * @param {number} options.maxRetries - Maximum retry attempts
     */
    constructor(options = {}) {
        this.options = options;
        this.retryCount = 0;
        this.maxRetries = options.maxRetries || 3;
        this.lastErrorTime = 0;
        this.errorCooldown = 3000; // 3 seconds between retry attempts
    }

    /**
     * Determine recovery strategy for an error
     * @param {Object} error - Error object
     * @param {string} adapterName - Current adapter name
     * @returns {Object} Recovery strategy and details
     */
    getRecoveryStrategy(error, adapterName) {
        const errorType = error.type || MediaError.NETWORK_ERROR;
        const now = Date.now();
        
        // Don't retry too quickly
        if (now - this.lastErrorTime < this.errorCooldown) {
            console.log('[Recovery] Error cooldown active, skipping retry');
            return { strategy: RecoveryStrategy.NONE, reason: 'cooldown' };
        }
        
        this.lastErrorTime = now;

        // Determine strategy based on error type
        switch (errorType) {
            case MediaError.NETWORK_ERROR:
                if (this.retryCount < this.maxRetries) {
                    this.retryCount++;
                    return { 
                        strategy: RecoveryStrategy.RETRY, 
                        retryNumber: this.retryCount,
                        delay: 1000 * this.retryCount // Exponential backoff
                    };
                }
                return { strategy: RecoveryStrategy.FALLBACK_ADAPTER, reason: 'network_retries_exhausted' };

            case MediaError.MEDIA_DECODE_ERROR:
            case MediaError.CODEC_UNSUPPORTED:
                // Codec issues - try fallback adapter or transcode
                if (adapterName === 'ShakaPlayer' || adapterName === 'WebOSNative') {
                    return { strategy: RecoveryStrategy.FALLBACK_ADAPTER, reason: 'decode_error' };
                }
                return { strategy: RecoveryStrategy.FALLBACK_TRANSCODE, reason: 'codec_unsupported' };

            case MediaError.PLAYBACK_STUCK:
            case MediaError.LOAD_TIMEOUT:
                // Stuck playback - try transcode as server may be having issues
                return { strategy: RecoveryStrategy.FALLBACK_TRANSCODE, reason: 'playback_stuck' };

            case MediaError.SERVER_ERROR:
                // Server error (4xx/5xx) - don't auto-retry, let user decide
                return { strategy: RecoveryStrategy.NONE, reason: 'server_error' };

            case MediaError.DRM_ERROR:
                // DRM issues - likely device doesn't support content protection
                return { strategy: RecoveryStrategy.FALLBACK_TRANSCODE, reason: 'drm_unsupported' };

            default:
                if (this.retryCount < this.maxRetries) {
                    this.retryCount++;
                    return { strategy: RecoveryStrategy.RETRY, retryNumber: this.retryCount };
                }
                return { strategy: RecoveryStrategy.NONE, reason: 'unknown_error' };
        }
    }

    /**
     * Reset retry counter
     */
    reset() {
        this.retryCount = 0;
        this.lastErrorTime = 0;
    }

    /**
     * Log recovery attempt to server
     * @param {string} action - Recovery action taken
     * @param {Object} details - Recovery details
     */
    logRecoveryAttempt(action, details) {
        if (typeof ServerLogger !== 'undefined') {
            ServerLogger.logPlaybackWarning('Playback recovery: ' + action, details);
        }
        console.log('[Recovery] ' + action + ':', details);
    }
}

/**
 * Base class for video player adapters
 */
class VideoPlayerAdapter {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.eventHandlers = {};
        this.healthMonitor = null;
        this.recoveryManager = null;
        this.isRecovering = false;
        this.loadAttempts = 0;
        this.maxLoadAttempts = 3;
    }

    /**
     * Initialize the player
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        throw new Error('initialize() must be implemented by subclass');
    }

    /**
     * Load and play a media source
     * @param {string} url - Media URL
     * @param {Object} options - Playback options (mimeType, startPosition, etc.)
     * @returns {Promise<void>}
     */
    async load(url, options = {}) {
        throw new Error('load() must be implemented by subclass');
    }

    /**
     * Play the video
     * @returns {Promise<void>}
     */
    play() {
        return this.videoElement.play();
    }

    /**
     * Pause the video
     */
    pause() {
        this.videoElement.pause();
    }

    /**
     * Stop playback and cleanup
     */
    stop() {
        try {
            this.videoElement.pause();
            this.videoElement.removeAttribute('src');
            this.videoElement.load();
        } catch (e) {
            console.warn('[Adapter] Error stopping playback:', e);
        }
        this.stopHealthMonitor();
    }

    /**
     * Seek to a specific time
     * @param {number} time - Time in seconds
     */
    seek(time) {
        this.videoElement.currentTime = time;
    }

    /**
     * Get current playback time
     * @returns {number} Current time in seconds
     */
    getCurrentTime() {
        return this.videoElement.currentTime;
    }

    /**
     * Get video duration
     * @returns {number} Duration in seconds
     */
    getDuration() {
        return this.videoElement.duration;
    }

    /**
     * Set volume
     * @param {number} volume - Volume level (0-1)
     */
    setVolume(volume) {
        this.videoElement.volume = volume;
    }

    /**
     * Get current volume
     * @returns {number} Volume level (0-1)
     */
    getVolume() {
        return this.videoElement.volume;
    }

    /**
     * Check if video is paused
     * @returns {boolean}
     */
    isPaused() {
        return this.videoElement.paused;
    }

    /**
     * Get buffered ranges
     * @returns {TimeRanges|null} Buffered time ranges
     */
    getBuffered() {
        return this.videoElement.buffered;
    }

    /**
     * Register event handler
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     */
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    /**
     * Remove event handler
     * @param {string} event - Event name
     * @param {Function} handler - Handler to remove
     */
    off(event, handler) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
        }
    }

    /**
     * Emit event to registered handlers
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => handler(data));
        }
    }

    /**
     * Start playback health monitoring
     * @param {Object} options - Monitor options
     * @param {boolean} options.isDirectPlay - Whether this is direct play
     * @param {Function} options.onHealthIssue - Callback for health issues
     * @param {Function} options.onHealthy - Callback when healthy
     */
    startHealthMonitor(options = {}) {
        this.stopHealthMonitor();
        
        this.healthMonitor = new PlaybackHealthMonitor(this.videoElement, {
            ...options,
            adapter: this,
            onHealthIssue: (details) => {
                this.emit('healthissue', details);
                if (options.onHealthIssue) {
                    options.onHealthIssue(details);
                }
            },
            onHealthy: (details) => {
                this.emit('healthy', details);
                if (options.onHealthy) {
                    options.onHealthy(details);
                }
            }
        });
        
        this.healthMonitor.start();
    }

    /**
     * Stop health monitoring
     */
    stopHealthMonitor() {
        if (this.healthMonitor) {
            this.healthMonitor.stop();
            this.healthMonitor = null;
        }
    }

    /**
     * Initialize error recovery manager
     * @param {Object} options - Recovery options
     */
    initRecoveryManager(options = {}) {
        this.recoveryManager = new ErrorRecoveryManager({
            ...options,
            onFallback: (details) => {
                this.emit('fallbackrequired', details);
                if (options.onFallback) {
                    options.onFallback(details);
                }
            }
        });
    }

    /**
     * Handle playback error with recovery logic
     * @param {Object} error - Error object
     * @returns {Object} Recovery strategy
     */
    handleError(error) {
        console.error('[Adapter] Playback error:', error);
        
        // Log to server if available
        if (typeof ServerLogger !== 'undefined') {
            ServerLogger.logPlaybackError('Adapter error: ' + this.getName(), {
                errorType: error.type || 'unknown',
                errorMessage: error.message || error.details || 'Unknown error',
                adapter: this.getName(),
                currentTime: this.getCurrentTime(),
                readyState: this.videoElement.readyState,
                networkState: this.videoElement.networkState
            });
        }
        
        // Get recovery strategy if manager is initialized
        if (this.recoveryManager) {
            return this.recoveryManager.getRecoveryStrategy(error, this.getName());
        }
        
        return { strategy: RecoveryStrategy.NONE, reason: 'no_recovery_manager' };
    }

    /**
     * Select audio track
     * @param {number} trackId - Track ID
     */
    selectAudioTrack(trackId) {
        throw new Error('selectAudioTrack() must be implemented by subclass');
    }

    /**
     * Select subtitle track
     * @param {number} trackId - Track ID (use -1 to disable)
     */
    selectSubtitleTrack(trackId) {
        throw new Error('selectSubtitleTrack() must be implemented by subclass');
    }

    /**
     * Get available audio tracks
     * @returns {Array<Object>} Audio tracks
     */
    getAudioTracks() {
        throw new Error('getAudioTracks() must be implemented by subclass');
    }

    /**
     * Get available subtitle tracks
     * @returns {Array<Object>} Subtitle tracks
     */
    getSubtitleTracks() {
        throw new Error('getSubtitleTracks() must be implemented by subclass');
    }

    /**
     * Get playback statistics
     * @returns {Object} Playback stats
     */
    getStats() {
        return { categories: [] };
    }

    /**
     * Get real-time playback stats (codec, quality, HDR info)
     * @returns {Object|null} Detailed playback statistics
     */
    getPlaybackStats() {
        return null;
    }

    /**
     * Destroy the player and cleanup resources
     */
    async destroy() {
        this.stopHealthMonitor();
        this.eventHandlers = {};
        this.recoveryManager = null;
    }

    /**
     * Get player name/type
     * @returns {string}
     */
    getName() {
        return 'BaseAdapter';
    }

    /**
     * Get adapter priority for fallback ordering
     * @returns {number} Priority (lower = higher priority)
     */
    getPriority() {
        return 999;
    }

    /**
     * Check if adapter supports a specific feature
     * @param {string} feature - Feature name
     * @returns {boolean} True if supported
     */
    supportsFeature(feature) {
        return false;
    }
}

/**
 * Shaka Player Adapter
 */
class ShakaPlayerAdapter extends VideoPlayerAdapter {
    constructor(videoElement) {
        super(videoElement);
        this.player = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            // Check if Shaka Player is supported
            if (!shaka.Player.isBrowserSupported()) {
                console.log('[ShakaAdapter] Browser not supported');
                return false;
            }

            // Install polyfills
            shaka.polyfill.installAll();

            // Create player instance (use attach method instead of constructor with element)
            this.player = new shaka.Player();
            await this.player.attach(this.videoElement);
            
            // Detect codec support using MediaSource API
            // Test multiple Dolby Vision profiles and variants
            this.codecSupport = {
                h264: this.checkCodecSupport('video/mp4; codecs="avc1.64001f"'),
                hevc: this.checkCodecSupport('video/mp4; codecs="hev1.1.6.L93.B0"'),
                hevcMain10: this.checkCodecSupport('video/mp4; codecs="hev1.2.4.L153.B0"'),
                dolbyVisionP5: this.checkCodecSupport('video/mp4; codecs="dvhe.05.07"'),
                dolbyVisionP7: this.checkCodecSupport('video/mp4; codecs="dvhe.07.06"'),
                dolbyVisionP8: this.checkCodecSupport('video/mp4; codecs="dvhe.08.07"'),
                vp9: this.checkCodecSupport('video/webm; codecs="vp9"'),
                vp9Profile2: this.checkCodecSupport('video/webm; codecs="vp09.02.10.10"')
            };
            
            // Determine overall HDR capability
            const hasDolbyVision = this.codecSupport.dolbyVisionP5 || this.codecSupport.dolbyVisionP7 || this.codecSupport.dolbyVisionP8;
            const hasHDR = this.codecSupport.hevcMain10 || hasDolbyVision || this.codecSupport.vp9Profile2;
            
            console.log('[ShakaAdapter] Hardware codec support detected:');
            console.log('  - H.264/AVC:', this.codecSupport.h264);
            console.log('  - HEVC/H.265:', this.codecSupport.hevc, '(10-bit:', this.codecSupport.hevcMain10 + ')');
            console.log('  - Dolby Vision Profile 5:', this.codecSupport.dolbyVisionP5);
            console.log('  - Dolby Vision Profile 7:', this.codecSupport.dolbyVisionP7);
            console.log('  - Dolby Vision Profile 8:', this.codecSupport.dolbyVisionP8);
            console.log('  - VP9:', this.codecSupport.vp9, '(HDR:', this.codecSupport.vp9Profile2 + ')');
            console.log('[ShakaAdapter] HDR Capabilities: Dolby Vision=' + hasDolbyVision + ', HDR10=' + this.codecSupport.hevcMain10);
            
            // Store for later reference
            this.hasDolbyVisionSupport = hasDolbyVision;
            this.hasHDRSupport = hasHDR;

            // Optimized configuration for webOS with Dolby Vision and HDR support
            this.player.configure({
                streaming: {
                    bufferingGoal: 20,
                    rebufferingGoal: 2,
                    bufferBehind: 30,
                    alwaysStreamText: false,
                    startAtSegmentBoundary: false,
                    safeSeekOffset: 0.1,
                    stallEnabled: true,
                    stallThreshold: 1,
                    retryParameters: {
                        timeout: 15000,
                        maxAttempts: 2,
                        baseDelay: 500,
                        backoffFactor: 2,
                        fuzzFactor: 0.5
                    }
                },
                abr: {
                    enabled: true,
                    defaultBandwidthEstimate: 5000000,
                    switchInterval: 8,
                    bandwidthUpgradeTarget: 0.85,
                    bandwidthDowngradeTarget: 0.95,
                    restrictions: {
                        maxHeight: 2160,  // Allow 4K for HDR content
                        maxWidth: 3840,
                        maxBandwidth: 100000000  // Increase for high-bitrate HDR
                    }
                },
                manifest: {
                    retryParameters: {
                        timeout: 15000,
                        maxAttempts: 2
                    },
                    defaultPresentationDelay: 0,
                    dash: {
                        ignoreMinBufferTime: true
                    }
                },
                // Prefer Dolby Vision and HDR codecs over SDR
                // Order: Dolby Vision (Profile 7 dual-layer, Profile 5, Profile 8), HDR10+, HDR10, SDR
                preferredVideoCodecs: [
                    'dvhe.07',  // Dolby Vision Profile 7 (dual-layer with backward compatibility)
                    'dvh1.07',  // Dolby Vision Profile 7 variant
                    'dvhe.05',  // Dolby Vision Profile 5 (single-layer)
                    'dvh1.05',  // Dolby Vision Profile 5 variant
                    'dvhe.08',  // Dolby Vision Profile 8 (single-layer)
                    'dvh1.08',  // Dolby Vision Profile 8 variant
                    'hev1',     // HEVC/H.265 with HDR10
                    'hvc1',     // HEVC/H.265 variant
                    'avc1',     // H.264/AVC (SDR fallback)
                    'avc3'      // H.264/AVC variant
                ]
            });            // Note: Codec support depends on webOS device capabilities
            // The player will automatically select the best codec the device can decode

            // Setup error handling
            this.player.addEventListener('error', (event) => {
                this.emit('error', event.detail);
            });

            // Setup buffering events
            this.player.addEventListener('buffering', (event) => {
                this.emit('buffering', event.buffering);
            });

            // Setup adaptation events (quality changes)
            this.player.addEventListener('adaptation', () => {
                const stats = this.player.getStats();
                this.emit('qualitychange', {
                    width: stats.width,
                    height: stats.height,
                    bandwidth: stats.estimatedBandwidth
                });
            });
            
            // Setup variant change events (audio/video track changes)
            this.player.addEventListener('variantchanged', () => {
                const currentVariant = this.player.getVariantTracks().find(t => t.active);
                if (currentVariant) {
                    this.emit('audiotrackchange', {
                        language: currentVariant.language,
                        bandwidth: currentVariant.bandwidth
                    });
                }
            });

            this.initialized = true;
            return true;
        } catch (error) {
            return false;
        }
    }

    async load(url, options = {}) {
        if (!this.initialized || !this.player) {
            throw new Error('Shaka Player not initialized');
        }

        try {
            console.log('[ShakaAdapter] Loading:', url.substring(0, 80) + '...');
            if (options.startPosition) {
                console.log('[ShakaAdapter] Start position:', options.startPosition, 'seconds');
            }
            
            // Provide helpful info about playback method and codec support
            const isDirect = url.includes('.mp4') && !url.includes('.m3u8') && !url.includes('.mpd');
            const isStreaming = url.includes('.m3u8') || url.includes('.mpd');
            
            if (isDirect) {
                console.log('[ShakaAdapter] Direct file playback mode');
                if (this.hasDolbyVisionSupport) {
                    console.log('[ShakaAdapter] ✓ Device supports Dolby Vision hardware decoding');
                } else if (this.hasHDRSupport) {
                    console.log('[ShakaAdapter] ✓ Device supports HDR10 (HEVC 10-bit)');
                } else {
                    console.log('[ShakaAdapter] ℹ Device supports SDR only (no HDR hardware)');
                }
            } else if (isStreaming) {
                console.log('[ShakaAdapter] Adaptive streaming mode (DASH/HLS)');
                if (this.hasDolbyVisionSupport) {
                    console.log('[ShakaAdapter] ✓ Will prefer Dolby Vision tracks if available');
                } else if (this.hasHDRSupport) {
                    console.log('[ShakaAdapter] ✓ Will prefer HDR10 tracks if available');
                }
            }
            
            // Load the manifest
            await this.player.load(url);
            console.log('[ShakaAdapter] Manifest loaded successfully');
            
            this.emit('loaded', { url });

            // Set start position AFTER loading (when metadata is available)
            if (options.startPosition && options.startPosition > 0) {
                this.videoElement.currentTime = options.startPosition;
            }

            // Apply track selections if provided
            if (options.audioTrackId !== undefined) {
                this.selectAudioTrack(options.audioTrackId);
            }
            if (options.subtitleTrackId !== undefined) {
                this.selectSubtitleTrack(options.subtitleTrackId);
            }

        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    selectAudioTrack(trackId) {
        if (!this.player || !this.initialized) {
            console.warn('[ShakaAdapter] Player not ready for audio track selection');
            return false;
        }

        try {
            const allTracks = this.player.getVariantTracks();
            console.log('[ShakaAdapter] Selecting audio track:', trackId, 'from', allTracks.length, 'variants');
            
            // Get unique audio languages
            const audioLanguages = [];
            const seenLanguages = new Set();
            allTracks.forEach(track => {
                if (track.language && !seenLanguages.has(track.language)) {
                    seenLanguages.add(track.language);
                    audioLanguages.push(track.language);
                }
            });
            
            
            if (trackId >= 0 && trackId < audioLanguages.length) {
                const targetLanguage = audioLanguages[trackId];
                
                // Select all variant tracks with this language
                const tracksToSelect = allTracks.filter(t => t.language === targetLanguage);
                if (tracksToSelect.length > 0) {
                    // Select the first track with this language (Shaka will handle quality variants)
                    this.player.selectAudioLanguage(targetLanguage);
                    console.log('[ShakaAdapter] Audio language selected:', targetLanguage);
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    selectSubtitleTrack(trackId) {
        if (!this.player || !this.initialized) {
            console.warn('[ShakaAdapter] Player not ready for subtitle selection');
            return false;
        }

        try {
            if (trackId === -1) {
                this.player.setTextTrackVisibility(false);
                console.log('[ShakaAdapter] Subtitles disabled');
                return true;
            }

            const tracks = this.player.getTextTracks();
            console.log('[ShakaAdapter] Selecting subtitle:', trackId, 'from', tracks.length, 'tracks');
            
            if (trackId >= 0 && trackId < tracks.length) {
                const track = tracks[trackId];
                this.player.selectTextTrack(track);
                this.player.setTextTrackVisibility(true);
                console.log('[ShakaAdapter] Subtitle track selected:', track.language || trackId);
                return true;
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    getAudioTracks() {
        if (!this.player) return [];

        const tracks = this.player.getVariantTracks();
        const uniqueLanguages = new Map();
        
        tracks.forEach(track => {
            if (track.language && !uniqueLanguages.has(track.language)) {
                uniqueLanguages.set(track.language, {
                    id: uniqueLanguages.size,
                    language: track.language,
                    label: track.label || track.language,
                    channels: track.channelsCount
                });
            }
        });

        return Array.from(uniqueLanguages.values());
    }

    getSubtitleTracks() {
        if (!this.player) return [];

        return this.player.getTextTracks().map((track, index) => ({
            id: index,
            language: track.language,
            label: track.label || track.language,
            kind: track.kind
        }));
    }

    /**
     * Get real-time playback statistics
     * @returns {Object|null} Playback stats including codec, quality, and HDR info
     */
    getPlaybackStats() {
        if (!this.player || !this.initialized) return null;

        try {
            const stats = this.player.getStats();
            const variantTracks = this.player.getVariantTracks();
            const activeVariant = variantTracks.find(t => t.active);
            
            if (!activeVariant) return null;

            // Extract codec information
            const videoCodec = activeVariant.videoCodec || 'unknown';
            const audioCodec = activeVariant.audioCodec || 'unknown';
            
            // Determine HDR type from codec string
            let hdrType = 'SDR';
            let colorInfo = null;
            
            if (videoCodec.startsWith('dvhe.') || videoCodec.startsWith('dvh1.')) {
                // Dolby Vision profiles
                const profileMatch = videoCodec.match(/dv[he]1?\.(\d+)/);
                if (profileMatch) {
                    const profile = profileMatch[1];
                    if (profile === '05') hdrType = 'Dolby Vision (Profile 5)';
                    else if (profile === '07') hdrType = 'Dolby Vision (Profile 7)';
                    else if (profile === '08') hdrType = 'Dolby Vision (Profile 8)';
                    else hdrType = 'Dolby Vision (Profile ' + profile + ')';
                }
            } else if (videoCodec.includes('hev1') || videoCodec.includes('hvc1') || videoCodec.includes('hevc')) {
                // HEVC - likely HDR10 if high bitrate
                hdrType = 'HDR10 (HEVC)';
            } else if (videoCodec.includes('vp9')) {
                hdrType = 'HDR (VP9)';
            }
            
            // Get color information from video element if available
            if (this.videoElement && this.videoElement.videoWidth) {
                colorInfo = {
                    width: this.videoElement.videoWidth,
                    height: this.videoElement.videoHeight
                };
            }

            return {
                // Codec information
                videoCodec: videoCodec,
                audioCodec: audioCodec,
                hdrType: hdrType,
                
                // Quality information
                width: stats.width || (activeVariant.width || 0),
                height: stats.height || (activeVariant.height || 0),
                bandwidth: activeVariant.bandwidth || 0,
                
                // Performance stats
                estimatedBandwidth: stats.estimatedBandwidth || 0,
                droppedFrames: stats.droppedFrames || 0,
                stallsDetected: stats.stallsDetected || 0,
                streamBandwidth: stats.streamBandwidth || 0,
                
                // Additional info
                frameRate: activeVariant.frameRate || 0,
                audioChannels: activeVariant.channelsCount || 0,
                colorInfo: colorInfo
            };
        } catch (error) {
            console.error('[ShakaAdapter] Error getting playback stats:', error);
            return null;
        }
    }

    async destroy() {
        this.stopHealthMonitor();
        if (this.player) {
            await this.player.destroy();
            this.player = null;
        }
        this.initialized = false;
        await super.destroy();
    }

    /**
     * Stop playback
     */
    stop() {
        this.stopHealthMonitor();
        if (this.player) {
            try {
                this.player.unload();
            } catch (e) {
                console.warn('[ShakaAdapter] Error unloading:', e);
            }
        }
        super.stop();
    }

    /**
     * Get adapter priority for fallback ordering
     * @returns {number} Priority (lower = higher priority)
     */
    getPriority() {
        return AdapterPriority.SHAKA;
    }

    /**
     * Check if adapter supports a specific feature
     * @param {string} feature - Feature name
     * @returns {boolean} True if supported
     */
    supportsFeature(feature) {
        switch (feature) {
            case 'hdr':
                return this.hasHDRSupport;
            case 'dolbyvision':
                return this.hasDolbyVisionSupport;
            case 'adaptive':
                return true;
            case 'drm':
                return true;
            default:
                return false;
        }
    }

    /**
     * Get playback statistics
     * @returns {Object} Playback stats including dropped/corrupted frames
     */
    getStats() {
        const stats = {
            categories: []
        };

        if (!this.player || !this.videoElement) {
            return stats;
        }

        const shakaStats = this.player.getStats();
        const videoCategory = {
            type: 'video',
            stats: []
        };

        // Video resolution
        if (this.videoElement.videoWidth && this.videoElement.videoHeight) {
            videoCategory.stats.push({
                label: 'Video Resolution',
                value: `${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`
            });
        }

        // Dropped frames (from HTMLVideoElement API)
        if (this.videoElement.getVideoPlaybackQuality) {
            const quality = this.videoElement.getVideoPlaybackQuality();
            videoCategory.stats.push({
                label: 'Dropped Frames',
                value: quality.droppedVideoFrames || 0
            });
            videoCategory.stats.push({
                label: 'Corrupted Frames',
                value: quality.corruptedVideoFrames || 0
            });
        }

        // Shaka-specific stats
        if (shakaStats.estimatedBandwidth) {
            videoCategory.stats.push({
                label: 'Estimated Bandwidth',
                value: `${(shakaStats.estimatedBandwidth / 1000000).toFixed(2)} Mbps`
            });
        }

        stats.categories.push(videoCategory);
        return stats;
    }

    getName() {
        return 'ShakaPlayer';
    }
    
    /**
     * Check if a specific codec is supported by the browser/device
     * @param {string} mimeType - MIME type with codec string
     * @returns {boolean} True if codec is supported
     */
    checkCodecSupport(mimeType) {
        try {
            if (window.MediaSource && typeof window.MediaSource.isTypeSupported === 'function') {
                return window.MediaSource.isTypeSupported(mimeType);
            }
            // Fallback to video element canPlayType
            const video = document.createElement('video');
            const support = video.canPlayType(mimeType);
            return support === 'probably' || support === 'maybe';
        } catch (e) {
            console.warn('[ShakaAdapter] Error checking codec support:', e);
            return false;
        }
    }
}

/**
 * webOS Native Video API Adapter
 * Enhanced with better error recovery and native API utilization
 */
class WebOSVideoAdapter extends VideoPlayerAdapter {
    constructor(videoElement) {
        super(videoElement);
        this.mediaObject = null;
        this.initialized = false;
        this.currentUrl = null;
        this.loadRetryCount = 0;
        this.maxLoadRetries = 2;
        this.loadTimeout = null;
        this.codecSupport = null;
    }

    async initialize() {
        try {
            // Check if webOS media API is available
            if (!window.webOS || !window.webOS.media) {
                console.log('[WebOSAdapter] webOS media API not available');
                return false;
            }

            // Detect codec support on webOS
            this.codecSupport = this.detectCodecSupport();
            console.log('[WebOSAdapter] Codec support:', this.codecSupport);

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('[WebOSAdapter] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Detect codec support on webOS device
     * @private
     * @returns {Object} Codec support information
     */
    detectCodecSupport() {
        const support = {
            h264: true, // All webOS TVs support H.264
            hevc: false,
            hevc10bit: false,
            vp9: false,
            av1: false,
            dolbyVision: false,
            hdr10: false
        };

        try {
            // Use webOS device info if available
            if (window.webOS && window.webOS.deviceInfo) {
                // webOS 4.0+ generally supports HEVC
                // webOS 5.0+ supports HDR10 and some Dolby Vision
                // webOS 6.0+ has broader AV1 and VP9 support
            }

            // Use MediaSource API for detection
            if (window.MediaSource && typeof window.MediaSource.isTypeSupported === 'function') {
                support.hevc = window.MediaSource.isTypeSupported('video/mp4; codecs="hev1.1.6.L93.B0"');
                support.hevc10bit = window.MediaSource.isTypeSupported('video/mp4; codecs="hev1.2.4.L153.B0"');
                support.vp9 = window.MediaSource.isTypeSupported('video/webm; codecs="vp9"');
                support.av1 = window.MediaSource.isTypeSupported('video/mp4; codecs="av01.0.08M.08"');
                support.dolbyVision = window.MediaSource.isTypeSupported('video/mp4; codecs="dvhe.05.07"') ||
                                     window.MediaSource.isTypeSupported('video/mp4; codecs="dvhe.08.07"');
                support.hdr10 = support.hevc10bit;
            }
        } catch (e) {
            console.warn('[WebOSAdapter] Error detecting codec support:', e);
        }

        return support;
    }

    async load(url, options = {}) {
        if (!this.initialized) {
            throw new Error('webOS Video API not initialized');
        }

        console.log('[WebOSAdapter] Loading:', url.substring(0, 80) + '...');

        // Clear any existing load timeout
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }

        try {
            this.currentUrl = url;

            // Determine media transport type
            const isHLS = url.includes('.m3u8') || (options.mimeType && options.mimeType.includes('mpegURL'));
            const isDASH = url.includes('.mpd');
            
            let mediaTransportType = 'BUFFERSTREAM';
            if (isHLS) mediaTransportType = 'HLS';
            else if (isDASH) mediaTransportType = 'DASH';

            console.log('[WebOSAdapter] Transport type:', mediaTransportType);

            // Unload previous media if exists
            if (this.mediaObject) {
                try {
                    this.mediaObject.unload();
                } catch (e) {
                    console.warn('[WebOSAdapter] Error unloading previous media:', e);
                }
                this.mediaObject = null;
            }

            // Create media options for webOS native API
            const mediaOption = {
                mediaTransportType: mediaTransportType,
                option: {
                    // Use media pipeline for hardware decoding
                    useMediaPipeline: true
                }
            };

            // Log to server for debugging
            if (typeof ServerLogger !== 'undefined') {
                ServerLogger.logPlaybackInfo('webOS adapter loading', {
                    url: url.substring(0, 100),
                    transportType: mediaTransportType,
                    mimeType: options.mimeType || 'unknown'
                });
            }

            // Load media using webOS native API
            const self = this;
            
            return new Promise((resolve, reject) => {
                try {
                    // Create media object with webOS API
                    if (window.webOS && window.webOS.media && window.webOS.media.createMediaObject) {
                        self.mediaObject = window.webOS.media.createMediaObject(
                            '/dev/video0',
                            mediaOption,
                            (event) => self.handleMediaEvent(event)
                        );
                    }

                    // Set video source
                    self.videoElement.src = url;
                    
                    // Set start position if provided
                    if (options.startPosition && options.startPosition > 0) {
                        self.videoElement.currentTime = options.startPosition;
                    }

                    self.emit('loaded', { url });

                    // Setup load event handlers
                    let resolved = false;
                    
                    const cleanup = () => {
                        if (self.loadTimeout) {
                            clearTimeout(self.loadTimeout);
                            self.loadTimeout = null;
                        }
                        self.videoElement.removeEventListener('canplay', onCanPlay);
                        self.videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
                        self.videoElement.removeEventListener('error', onError);
                    };

                    const onCanPlay = () => {
                        if (resolved) return;
                        resolved = true;
                        cleanup();
                        console.log('[WebOSAdapter] Video ready to play');
                        
                        // Try to start playback
                        self.videoElement.play().then(() => {
                            console.log('[WebOSAdapter] Playback started');
                            resolve();
                        }).catch((err) => {
                            console.log('[WebOSAdapter] Play pending:', err.message);
                            resolve(); // Still resolve - video is loaded
                        });
                    };

                    const onLoadedMetadata = () => {
                        console.log('[WebOSAdapter] Metadata loaded');
                        // Extend timeout since we're making progress
                        if (self.loadTimeout) {
                            clearTimeout(self.loadTimeout);
                            self.loadTimeout = setTimeout(onTimeout, 15000);
                        }
                    };

                    const onError = (e) => {
                        if (resolved) return;
                        resolved = true;
                        cleanup();
                        
                        const error = self.videoElement.error;
                        console.error('[WebOSAdapter] Load error:', error ? error.message : 'Unknown');
                        
                        // Log to server
                        if (typeof ServerLogger !== 'undefined') {
                            ServerLogger.logPlaybackError('webOS adapter load error', {
                                errorCode: error ? error.code : 'unknown',
                                errorMessage: error ? error.message : 'unknown',
                                url: url.substring(0, 100)
                            });
                        }
                        
                        // Check if retry is possible
                        if (self.loadRetryCount < self.maxLoadRetries) {
                            self.loadRetryCount++;
                            console.log('[WebOSAdapter] Retrying load (attempt ' + self.loadRetryCount + ')');
                            
                            setTimeout(() => {
                                self.load(url, options).then(resolve).catch(reject);
                            }, 1000 * self.loadRetryCount);
                        } else {
                            reject(new Error('webOS load failed: ' + (error ? error.message : 'Unknown')));
                        }
                    };

                    const onTimeout = () => {
                        if (resolved) return;
                        resolved = true;
                        cleanup();
                        
                        console.warn('[WebOSAdapter] Load timeout');
                        
                        if (typeof ServerLogger !== 'undefined') {
                            ServerLogger.logPlaybackWarning('webOS adapter load timeout', {
                                readyState: self.videoElement.readyState,
                                networkState: self.videoElement.networkState,
                                url: url.substring(0, 100)
                            });
                        }
                        
                        // Try to resolve anyway - health monitor will catch stuck playback
                        resolve();
                    };

                    self.videoElement.addEventListener('canplay', onCanPlay);
                    self.videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
                    self.videoElement.addEventListener('error', onError);
                    
                    // Set timeout (20 seconds)
                    self.loadTimeout = setTimeout(onTimeout, 20000);

                } catch (err) {
                    console.error('[WebOSAdapter] Load exception:', err);
                    reject(err);
                }
            });

        } catch (error) {
            console.error('[WebOSAdapter] Load failed:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Handle webOS media events
     * @private
     * @param {Object} event - Media event
     */
    handleMediaEvent(event) {
        console.log('[WebOSAdapter] Media event:', event.type);
        
        if (event.type === 'error') {
            console.error('[WebOSAdapter] Media error:', event);
            this.emit('error', { type: MediaError.MEDIA_DECODE_ERROR, details: event });
        } else if (event.type === 'buffering') {
            this.emit('buffering', event.buffering);
        } else if (event.type === 'statechange') {
            console.log('[WebOSAdapter] State change:', event.state);
        }
    }

    /**
     * Stop playback
     */
    stop() {
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
        
        if (this.mediaObject) {
            try {
                this.mediaObject.unload();
            } catch (e) {
                console.warn('[WebOSAdapter] Error unloading media:', e);
            }
            this.mediaObject = null;
        }
        
        this.loadRetryCount = 0;
        super.stop();
    }

    selectAudioTrack(trackId) {
        try {
            const audioTracks = this.videoElement.audioTracks;
            if (audioTracks && trackId >= 0 && trackId < audioTracks.length) {
                for (let i = 0; i < audioTracks.length; i++) {
                    audioTracks[i].enabled = (i === trackId);
                }
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    selectSubtitleTrack(trackId) {
        try {
            const textTracks = this.videoElement.textTracks;
            
            if (trackId === -1) {
                for (let i = 0; i < textTracks.length; i++) {
                    textTracks[i].mode = 'disabled';
                }
                return true;
            }

            if (textTracks && trackId >= 0 && trackId < textTracks.length) {
                for (let i = 0; i < textTracks.length; i++) {
                    textTracks[i].mode = (i === trackId) ? 'showing' : 'disabled';
                }
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    getAudioTracks() {
        const audioTracks = this.videoElement.audioTracks;
        if (!audioTracks) return [];

        const tracks = [];
        for (let i = 0; i < audioTracks.length; i++) {
            const track = audioTracks[i];
            tracks.push({
                id: i,
                language: track.language,
                label: track.label || track.language,
                enabled: track.enabled
            });
        }
        return tracks;
    }

    getSubtitleTracks() {
        const textTracks = this.videoElement.textTracks;
        if (!textTracks) return [];

        const tracks = [];
        for (let i = 0; i < textTracks.length; i++) {
            const track = textTracks[i];
            if (track.kind === 'subtitles' || track.kind === 'captions') {
                tracks.push({
                    id: i,
                    language: track.language,
                    label: track.label || track.language,
                    kind: track.kind
                });
            }
        }
        return tracks;
    }

    async destroy() {
        this.stopHealthMonitor();
        
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
        
        if (this.mediaObject) {
            try {
                this.mediaObject.unload();
            } catch (e) {
                // Ignore unload errors during cleanup
            }
            this.mediaObject = null;
        }
        this.currentUrl = null;
        this.initialized = false;
        this.loadRetryCount = 0;
        await super.destroy();
    }

    getName() {
        return 'WebOSNative';
    }

    /**
     * Get adapter priority for fallback ordering
     * @returns {number} Priority (lower = higher priority)
     */
    getPriority() {
        return AdapterPriority.WEBOS_NATIVE;
    }

    /**
     * Check if adapter supports a specific feature
     * @param {string} feature - Feature name
     * @returns {boolean} True if supported
     */
    supportsFeature(feature) {
        if (!this.codecSupport) return false;
        
        switch (feature) {
            case 'hdr':
                return this.codecSupport.hdr10;
            case 'dolbyvision':
                return this.codecSupport.dolbyVision;
            case 'hevc':
                return this.codecSupport.hevc;
            case 'av1':
                return this.codecSupport.av1;
            default:
                return false;
        }
    }

    /**
     * Get playback statistics
     * @returns {Object} Playback stats
     */
    getStats() {
        const stats = {
            categories: []
        };

        if (!this.videoElement) {
            return stats;
        }

        const videoCategory = {
            type: 'video',
            stats: []
        };

        // Video resolution
        if (this.videoElement.videoWidth && this.videoElement.videoHeight) {
            videoCategory.stats.push({
                label: 'Video Resolution',
                value: `${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`
            });
        }

        // Adapter info
        videoCategory.stats.push({
            label: 'Adapter',
            value: 'webOS Native'
        });

        // Dropped/corrupted frames
        if (this.videoElement.getVideoPlaybackQuality) {
            const quality = this.videoElement.getVideoPlaybackQuality();
            videoCategory.stats.push({
                label: 'Dropped Frames',
                value: quality.droppedVideoFrames || 0
            });
        }

        stats.categories.push(videoCategory);
        return stats;
    }
}

/**
 * Handle HLS.js media errors with retry logic
 */
function handleHlsJsMediaError(hlsPlayer) {
    if (!hlsPlayer) return false;

    const now = performance.now ? performance.now() : Date.now();

    // First attempt: recover from decoding error
    if (!recoverDecodingErrorDate || (now - recoverDecodingErrorDate) > 3000) {
        recoverDecodingErrorDate = now;
        console.log('[HLS Recovery] Attempting to recover from media error...');
        hlsPlayer.recoverMediaError();
        return true;
    } 
    // Second attempt: swap audio codec and recover
    else if (!recoverSwapAudioCodecDate || (now - recoverSwapAudioCodecDate) > 3000) {
        recoverSwapAudioCodecDate = now;
        console.log('[HLS Recovery] Swapping audio codec and recovering...');
        hlsPlayer.swapAudioCodec();
        hlsPlayer.recoverMediaError();
        return true;
    } 
    // Failed: cannot recover
    else {
        console.error('[HLS Recovery] Cannot recover, last attempts failed');
        return false;
    }
}

/**
 * Get cross-origin value based on media source
 */
function getCrossOriginValue(mediaSource) {
    if (mediaSource && mediaSource.IsRemote) {
        return null;
    }
    return 'anonymous';
}

/**
 * HTML5 Video Element Adapter (Fallback)
 * Enhanced with better error recovery and HLS.js improvements
 */
class HTML5VideoAdapter extends VideoPlayerAdapter {
    constructor(videoElement) {
        super(videoElement);
        this.initialized = false;
        this.hlsPlayer = null;
        this.loadRetryCount = 0;
        this.maxLoadRetries = 2;
    }

    async initialize() {
        this.initialized = true;
        return true;
    }

    /**
     * Stop playback
     */
    stop() {
        // Cleanup HLS.js player
        if (this.hlsPlayer) {
            try {
                this.hlsPlayer.destroy();
            } catch (err) {
                console.warn('[HTML5Adapter] Error destroying HLS player:', err);
            }
            this.hlsPlayer = null;
        }
        
        this.loadRetryCount = 0;
        super.stop();
    }

    async load(url, options = {}) {
        if (!this.initialized) {
            throw new Error('HTML5 Video adapter not initialized');
        }

        console.log('[HTML5Adapter] Loading:', url.substring(0, 80) + '...');

        try {
            // Check if HLS stream
            const isHLS = url.includes('.m3u8') || (options.mimeType && options.mimeType.includes('mpegURL'));
            
            if (isHLS) {
                // Use DeviceProfile module if available for smarter HLS decision
                if (typeof DeviceProfile !== 'undefined') {
                    const preferNative = DeviceProfile.shouldUseNativeHls();
                    const preferHlsJs = DeviceProfile.shouldUseHlsJs();
                    
                    console.log('[HTML5Adapter] DeviceProfile: preferNative=' + preferNative + ', preferHlsJs=' + preferHlsJs);
                    
                    // If device profile says use native HLS
                    if (preferNative) {
                        console.log('[HTML5Adapter] Using native HLS playback (DeviceProfile)');
                        return this.loadNativeHLS(url, options);
                    }
                    
                    // If device profile says use HLS.js and it's available
                    if (preferHlsJs && typeof Hls !== 'undefined' && Hls.isSupported()) {
                        console.log('[HTML5Adapter] Using HLS.js for HLS playback (DeviceProfile)');
                        return this.loadWithHlsJs(url, options);
                    }
                }
                
                // Fallback: Check for native HLS support first (Safari, iOS, some smart TVs)
                // Native HLS is more reliable on older/embedded browsers than HLS.js + MediaSource
                const videoTest = document.createElement('video');
                const canPlayNativeHLS = videoTest.canPlayType('application/vnd.apple.mpegurl') || 
                                         videoTest.canPlayType('application/x-mpegURL');
                
                if (canPlayNativeHLS) {
                    console.log('[HTML5Adapter] Using native HLS playback');
                    return this.loadNativeHLS(url, options);
                }
                
                // Fall back to HLS.js if native not supported but MediaSource is
                if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                    console.log('[HTML5Adapter] Using HLS.js for HLS playback');
                    return this.loadWithHlsJs(url, options);
                }
                
                // Last resort: try direct src assignment (some browsers handle it)
                console.log('[HTML5Adapter] Trying direct HLS src assignment');
                return this.loadNativeHLS(url, options);
            }

            // Non-HLS content - use standard HTML5 video
            return this.loadDirect(url, options);

        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Load video directly without HLS.js
     * @private
     */
    loadDirect(url, options = {}) {
        // Clear existing sources
        this.videoElement.innerHTML = '';
        
        // Set cross-origin if needed
        const crossOrigin = getCrossOriginValue(options.mediaSource);
        if (crossOrigin) {
            this.videoElement.crossOrigin = crossOrigin;
        }
        
        // Create source element
        const source = document.createElement('source');
        source.src = url;
        
        if (options.mimeType) {
            source.type = options.mimeType;
        }
        
        this.videoElement.appendChild(source);

        // Set start position if provided
        if (options.startPosition) {
            this.videoElement.currentTime = options.startPosition;
        }

        this.emit('loaded', { url });

        // Wait for video to be ready
        return new Promise((resolve, reject) => {
            const onCanPlay = () => {
                this.videoElement.removeEventListener('canplay', onCanPlay);
                this.videoElement.removeEventListener('error', onError);
                resolve();
            };
            
            const onError = (e) => {
                this.videoElement.removeEventListener('canplay', onCanPlay);
                this.videoElement.removeEventListener('error', onError);
                reject(e);
            };

            this.videoElement.addEventListener('canplay', onCanPlay);
            this.videoElement.addEventListener('error', onError);
        });
    }

    /**
     * Load HLS stream using native browser support
     * Works on Safari, iOS, and some smart TV browsers
     * @private
     */
    loadNativeHLS(url, options = {}) {
        var self = this;
        
        return new Promise(function(resolve, reject) {
            // Clear existing sources
            self.videoElement.innerHTML = '';
            
            // Set cross-origin if needed  
            var crossOrigin = getCrossOriginValue(options.mediaSource);
            if (crossOrigin) {
                self.videoElement.crossOrigin = crossOrigin;
            }
            
            // Set src directly for native HLS
            self.videoElement.src = url;
            
            // Set start position if provided
            if (options.startPosition && options.startPosition > 0) {
                self.videoElement.currentTime = options.startPosition;
            }
            
            var resolved = false;
            var timeoutId = null;
            
            var cleanup = function() {
                if (timeoutId) clearTimeout(timeoutId);
                self.videoElement.removeEventListener('canplay', onCanPlay);
                self.videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
                self.videoElement.removeEventListener('error', onError);
            };
            
            var onCanPlay = function() {
                if (resolved) return;
                resolved = true;
                cleanup();
                console.log('[HTML5Adapter] Native HLS ready to play');
                self.videoElement.play().then(function() {
                    console.log('[HTML5Adapter] Native HLS playback started');
                    resolve();
                }).catch(function(err) {
                    // Play might be blocked by autoplay policy, but stream is loaded
                    console.log('[HTML5Adapter] Native HLS loaded (play pending):', err.message);
                    resolve();
                });
            };
            
            var onLoadedMetadata = function() {
                console.log('[HTML5Adapter] Native HLS metadata loaded');
            };
            
            var onError = function(e) {
                if (resolved) return;
                resolved = true;
                cleanup();
                var error = self.videoElement.error;
                console.error('[HTML5Adapter] Native HLS error:', error ? error.message : 'Unknown error');
                reject(new Error('Native HLS playback failed: ' + (error ? error.message : 'Unknown')));
            };
            
            self.videoElement.addEventListener('canplay', onCanPlay);
            self.videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
            self.videoElement.addEventListener('error', onError);
            
            // Timeout after 30 seconds
            timeoutId = setTimeout(function() {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    reject(new Error('Native HLS timeout'));
                }
            }, 30000);
            
            self.emit('loaded', { url: url });
        });
    }

    /**
     * Load HLS stream using HLS.js with error recovery
     * Configured to match jellyfin-web for maximum compatibility
     * @private
     */
    loadWithHlsJs(url, options = {}) {
        return new Promise((resolve, reject) => {
            // Destroy existing HLS player
            if (this.hlsPlayer) {
                try {
                    this.hlsPlayer.destroy();
                } catch (e) {
                    console.warn('[HTML5+HLS.js] Error destroying old player:', e);
                }
                this.hlsPlayer = null;
            }

            // HLS.js configuration matching jellyfin-web for best compatibility
            var hlsConfig = {
                // Manifest loading settings
                manifestLoadingTimeOut: 20000,
                manifestLoadingMaxRetry: 4,
                manifestLoadingRetryDelay: 500,

                // Level loading settings
                levelLoadingTimeOut: 20000,
                levelLoadingMaxRetry: 4,
                levelLoadingRetryDelay: 500,

                // Fragment loading settings
                fragLoadingTimeOut: 20000,
                fragLoadingMaxRetry: 6,
                fragLoadingRetryDelay: 500,

                // Buffer settings - important for smooth playback
                maxBufferLength: 30,
                maxBufferSize: 60 * 1000 * 1000, // 60MB
                maxBufferHole: 0.5,
                backBufferLength: 90,
                liveBackBufferLength: 90,

                // Low latency mode disabled for better compatibility with webOS
                lowLatencyMode: false,

                // ABR settings - matching jellyfin-web
                abrEwmaDefaultEstimate: 1000000,
                abrBandWidthFactor: 0.8,
                abrBandWidthUpFactor: 0.7,
                abrMaxWithRealBitrate: true,

                // Start from specific position if provided
                startPosition: options.startPosition || -1,

                // XHR setup for credentials
                xhrSetup: function(xhr) {
                    xhr.withCredentials = options.withCredentials || false;
                }
            };

            console.log('[HTML5+HLS.js] Creating player with config:', JSON.stringify({
                maxBufferLength: hlsConfig.maxBufferLength,
                backBufferLength: hlsConfig.backBufferLength,
                lowLatencyMode: hlsConfig.lowLatencyMode,
                startPosition: hlsConfig.startPosition
            }));

            var hls = new Hls(hlsConfig);
            var self = this;

            hls.loadSource(url);
            hls.attachMedia(this.videoElement);

            hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
                console.log('[HTML5+HLS.js] Manifest parsed, levels:', data.levels ? data.levels.length : 0);
                // Call play() but don't reject the load promise on play() errors
                // The "interrupted by new load request" error is common during HLS.js recovery
                // and shouldn't be treated as a fatal load failure
                self.videoElement.play().then(function() {
                    console.log('[HTML5+HLS.js] Play started successfully');
                    resolve();
                }).catch(function(err) {
                    // AbortError ("interrupted by new load request") is not fatal
                    // The video will continue loading and play via HLS.js events
                    if (err.name === 'AbortError' || (err.message && err.message.indexOf('interrupted') !== -1)) {
                        console.log('[HTML5+HLS.js] Play interrupted (non-fatal):', err.message);
                        // Still resolve - HLS.js will handle playback
                        resolve();
                    } else {
                        console.error('[HTML5+HLS.js] Play failed:', err.message);
                        reject(err);
                    }
                });
            });

            hls.on(Hls.Events.LEVEL_LOADED, function(event, data) {
                console.log('[HTML5+HLS.js] Level loaded - duration:', data.details ? data.details.totalduration : 'unknown');
            });

            hls.on(Hls.Events.FRAG_LOADED, function(event, data) {
                var fragSize = data.frag && data.frag.stats ? Math.round(data.frag.stats.loaded / 1024) : 0;
                console.log('[HTML5+HLS.js] Fragment loaded - size:', fragSize + 'KB');
            });

            hls.on(Hls.Events.FRAG_BUFFERED, function(event, data) {
                if (data.stats) {
                    console.log('[HTML5+HLS.js] Fragment buffered - processing:', data.stats.buffering + 'ms');
                }
            });

            hls.on(Hls.Events.ERROR, function(event, data) {
                console.error('[HTML5+HLS.js] Error:', data.type, data.details, 'fatal:', data.fatal);

                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            // Check if it's a 4xx error (client error - likely invalid stream)
                            if (data.response && data.response.code >= 400 && data.response.code < 500) {
                                console.error('[HTML5+HLS.js] Client error (4xx), not recoverable:', data.response.code);
                                hls.destroy();
                                self.emit('error', { type: MediaError.SERVER_ERROR, details: data, code: data.response.code });
                                reject(new Error(MediaError.SERVER_ERROR + ': ' + data.response.code));
                            } else if (data.response && data.response.code >= 500) {
                                // 5xx server error - might be temporary, try recovery
                                console.log('[HTML5+HLS.js] Server error (5xx), attempting recovery...');
                                hls.startLoad();
                            } else {
                                // Network issue without HTTP response - try recovery
                                console.log('[HTML5+HLS.js] Network error, attempting recovery...');
                                hls.startLoad();
                            }
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            if (handleHlsJsMediaError(hls)) {
                                console.log('[HTML5+HLS.js] Media error recovery attempted');
                            } else {
                                console.error('[HTML5+HLS.js] Media error recovery exhausted');
                                hls.destroy();
                                self.emit('error', { type: MediaError.MEDIA_DECODE_ERROR, details: data });
                                reject(new Error(MediaError.MEDIA_DECODE_ERROR));
                            }
                            break;
                        default:
                            console.error('[HTML5+HLS.js] Fatal error, no recovery available');
                            hls.destroy();
                            self.emit('error', { type: MediaError.FATAL_HLS_ERROR, details: data });
                            reject(new Error(MediaError.FATAL_HLS_ERROR));
                            break;
                    }
                }
            });

            this.hlsPlayer = hls;
            this.emit('loaded', { url: url });
        });
    }

    selectAudioTrack(trackId) {
        try {
            const audioTracks = this.videoElement.audioTracks;
            if (audioTracks && trackId >= 0 && trackId < audioTracks.length) {
                for (let i = 0; i < audioTracks.length; i++) {
                    audioTracks[i].enabled = (i === trackId);
                }
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    selectSubtitleTrack(trackId) {
        try {
            const textTracks = this.videoElement.textTracks;
            
            if (trackId === -1) {
                for (let i = 0; i < textTracks.length; i++) {
                    textTracks[i].mode = 'disabled';
                }
                return true;
            }

            if (textTracks && trackId >= 0 && trackId < textTracks.length) {
                for (let i = 0; i < textTracks.length; i++) {
                    textTracks[i].mode = (i === trackId) ? 'showing' : 'disabled';
                }
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    getAudioTracks() {
        const audioTracks = this.videoElement.audioTracks;
        if (!audioTracks) return [];

        const tracks = [];
        for (let i = 0; i < audioTracks.length; i++) {
            const track = audioTracks[i];
            tracks.push({
                id: i,
                language: track.language,
                label: track.label || track.language,
                enabled: track.enabled
            });
        }
        return tracks;
    }

    getSubtitleTracks() {
        const textTracks = this.videoElement.textTracks;
        if (!textTracks) return [];

        const tracks = [];
        for (let i = 0; i < textTracks.length; i++) {
            const track = textTracks[i];
            if (track.kind === 'subtitles' || track.kind === 'captions') {
                tracks.push({
                    id: i,
                    language: track.language,
                    label: track.label || track.language,
                    kind: track.kind
                });
            }
        }
        return tracks;
    }

    /**
     * Get playback statistics
     * @returns {Object} Playback stats
     */
    getStats() {
        const stats = {
            categories: []
        };

        if (!this.videoElement) {
            return stats;
        }

        const videoCategory = {
            type: 'video',
            stats: []
        };

        // Video resolution
        if (this.videoElement.videoWidth && this.videoElement.videoHeight) {
            videoCategory.stats.push({
                label: 'Video Resolution',
                value: `${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`
            });
        }

        // Dropped/corrupted frames
        if (this.videoElement.getVideoPlaybackQuality) {
            const quality = this.videoElement.getVideoPlaybackQuality();
            videoCategory.stats.push({
                label: 'Dropped Frames',
                value: quality.droppedVideoFrames || 0
            });
            videoCategory.stats.push({
                label: 'Corrupted Frames',
                value: quality.corruptedVideoFrames || 0
            });
        }

        stats.categories.push(videoCategory);
        return stats;
    }

    async destroy() {
        this.stopHealthMonitor();
        
        // Cleanup HLS.js player
        if (this.hlsPlayer) {
            try {
                this.hlsPlayer.destroy();
            } catch (err) {
                console.error('[HTML5VideoAdapter] Error destroying HLS player:', err);
            }
            this.hlsPlayer = null;
        }

        this.videoElement.innerHTML = '';
        this.initialized = false;
        this.loadRetryCount = 0;
        await super.destroy();
    }

    getName() {
        return 'HTML5Video';
    }

    /**
     * Get adapter priority for fallback ordering
     * @returns {number} Priority (lower = higher priority)
     */
    getPriority() {
        return AdapterPriority.HTML5;
    }

    /**
     * Check if adapter supports a specific feature
     * @param {string} feature - Feature name
     * @returns {boolean} True if supported
     */
    supportsFeature(feature) {
        switch (feature) {
            case 'hls':
                return typeof Hls !== 'undefined' && Hls.isSupported();
            case 'native-hls':
                const video = document.createElement('video');
                return !!(video.canPlayType('application/vnd.apple.mpegurl') || 
                         video.canPlayType('application/x-mpegURL'));
            default:
                return false;
        }
    }
}

/**
 * Video Player Factory
 * Creates the best available player adapter with automatic fallback
 * Enhanced with better adapter selection and fallback chain
 */
class VideoPlayerFactory {
    /**
     * Create a video player adapter with automatic capability detection
     * @param {HTMLVideoElement} videoElement - Video element to use
     * @param {Object} options - Creation options
     * @param {boolean} options.preferWebOS - Prefer WebOS native adapter for HDR/Dolby Vision
     * @param {boolean} options.preferHTML5 - Prefer HTML5 video element for direct files
     * @param {boolean} options.preferHLS - Prefer HTML5+HLS.js for transcoded HLS streams (matches jellyfin-web)
     * @param {boolean} options.preferShaka - Prefer Shaka Player for adaptive streaming
     * @param {string} options.contentType - Content type hint ('hdr', 'dolbyvision', 'hls', 'direct')
     * @returns {Promise<VideoPlayerAdapter>} Initialized player adapter
     */
    static async createPlayer(videoElement, options = {}) {
        console.log('[PlayerFactory] Creating player with options:', JSON.stringify(options));
        
        // Determine adapter priority based on playback needs
        var adapters = VideoPlayerFactory.getAdapterPriority(options);

        for (var i = 0; i < adapters.length; i++) {
            var AdapterClass = adapters[i];
            try {
                console.log('[PlayerFactory] Attempting:', AdapterClass.name || 'UnknownAdapter');
                var adapter = new AdapterClass(videoElement);
                var success = await adapter.initialize();
                
                if (success) {
                    console.log('[PlayerFactory] Using:', adapter.getName());
                    
                    // Log to server for diagnostics
                    if (typeof ServerLogger !== 'undefined') {
                        ServerLogger.logPlaybackInfo('Player adapter selected', {
                            adapter: adapter.getName(),
                            options: options
                        });
                    }
                    
                    return adapter;
                }
            } catch (error) {
                console.warn('[PlayerFactory]', (AdapterClass.name || 'UnknownAdapter'), 'failed:', error.message);
            }
        }

        throw new Error('No video player adapter could be initialized');
    }

    /**
     * Get adapter priority list based on options and content type
     * @param {Object} options - Creation options
     * @returns {Array<Class>} Ordered list of adapter classes
     */
    static getAdapterPriority(options = {}) {
        // Default priority: Shaka > webOS Native > HTML5
        var adapters = [
            ShakaPlayerAdapter,
            WebOSVideoAdapter,
            HTML5VideoAdapter
        ];

        if (options.preferWebOS) {
            // For Dolby Vision/HDR: WebOS native > Shaka > HTML5
            console.log('[PlayerFactory] preferWebOS mode - prioritizing native adapter');
            adapters = [
                WebOSVideoAdapter,
                ShakaPlayerAdapter,
                HTML5VideoAdapter
            ];
        } else if (options.preferHLS) {
            // For transcoded HLS streams: HTML5+HLS.js > Shaka > WebOS
            // This matches jellyfin-web behavior for better compatibility
            console.log('[PlayerFactory] preferHLS mode - using HTML5+HLS.js for transcoded stream');
            adapters = [
                HTML5VideoAdapter,
                ShakaPlayerAdapter,
                WebOSVideoAdapter
            ];
        } else if (options.preferHTML5) {
            // For direct files: HTML5 > Shaka > WebOS
            console.log('[PlayerFactory] preferHTML5 mode - using HTML5 adapter');
            adapters = [
                HTML5VideoAdapter,
                ShakaPlayerAdapter,
                WebOSVideoAdapter
            ];
        } else if (options.preferShaka) {
            // Explicit Shaka preference
            console.log('[PlayerFactory] preferShaka mode - using Shaka adapter');
            adapters = [
                ShakaPlayerAdapter,
                HTML5VideoAdapter,
                WebOSVideoAdapter
            ];
        }

        // Content type hints can further refine the order
        if (options.contentType === 'dolbyvision' || options.contentType === 'hdr') {
            // For HDR content, prefer native adapters that support hardware decoding
            adapters = [
                WebOSVideoAdapter,
                ShakaPlayerAdapter,
                HTML5VideoAdapter
            ];
        }

        return adapters;
    }

    /**
     * Get the next fallback adapter after the current one fails
     * @param {VideoPlayerAdapter} currentAdapter - Current failed adapter
     * @param {Object} options - Creation options
     * @returns {Class|null} Next adapter class or null if none available
     */
    static getNextFallback(currentAdapter, options = {}) {
        const adapters = VideoPlayerFactory.getAdapterPriority(options);
        const currentName = currentAdapter.getName();
        
        // Find current adapter in the list
        let foundCurrent = false;
        for (var i = 0; i < adapters.length; i++) {
            var AdapterClass = adapters[i];
            var testAdapter = new AdapterClass(document.createElement('video'));
            
            if (foundCurrent) {
                return AdapterClass;
            }
            
            if (testAdapter.getName() === currentName) {
                foundCurrent = true;
            }
        }
        
        return null;
    }

    /**
     * Create a fallback adapter after the current one fails
     * @param {HTMLVideoElement} videoElement - Video element to use
     * @param {VideoPlayerAdapter} currentAdapter - Current failed adapter
     * @param {Object} options - Creation options
     * @returns {Promise<VideoPlayerAdapter|null>} New adapter or null if none available
     */
    static async createFallback(videoElement, currentAdapter, options = {}) {
        const adapters = VideoPlayerFactory.getAdapterPriority(options);
        const currentName = currentAdapter.getName();
        
        console.log('[PlayerFactory] Creating fallback for:', currentName);
        
        // Find adapters after the current one in priority
        let foundCurrent = false;
        for (var i = 0; i < adapters.length; i++) {
            var AdapterClass = adapters[i];
            var tempAdapter = new AdapterClass(document.createElement('video'));
            
            if (tempAdapter.getName() === currentName) {
                foundCurrent = true;
                continue;
            }
            
            if (!foundCurrent) continue;
            
            try {
                console.log('[PlayerFactory] Trying fallback:', AdapterClass.name || 'UnknownAdapter');
                var adapter = new AdapterClass(videoElement);
                var success = await adapter.initialize();
                
                if (success) {
                    console.log('[PlayerFactory] Fallback successful:', adapter.getName());
                    
                    if (typeof ServerLogger !== 'undefined') {
                        ServerLogger.logPlaybackInfo('Fallback adapter selected', {
                            previousAdapter: currentName,
                            newAdapter: adapter.getName()
                        });
                    }
                    
                    return adapter;
                }
            } catch (error) {
                console.warn('[PlayerFactory] Fallback failed:', error.message);
            }
        }
        
        console.log('[PlayerFactory] No more fallback adapters available');
        return null;
    }

    /**
     * Get list of available adapters with their capabilities
     * @returns {Array<Object>} List of adapter info
     */
    static getAvailableAdapters() {
        const adapters = [
            ShakaPlayerAdapter,
            WebOSVideoAdapter,
            HTML5VideoAdapter
        ];
        
        const available = [];
        
        for (var i = 0; i < adapters.length; i++) {
            var AdapterClass = adapters[i];
            try {
                var testAdapter = new AdapterClass(document.createElement('video'));
                available.push({
                    name: testAdapter.getName(),
                    priority: testAdapter.getPriority(),
                    supportsHDR: testAdapter.supportsFeature('hdr'),
                    supportsDolbyVision: testAdapter.supportsFeature('dolbyvision'),
                    supportsHLS: testAdapter.supportsFeature('hls') || testAdapter.supportsFeature('native-hls')
                });
            } catch (e) {
                // Adapter not available
            }
        }
        
        return available.sort((a, b) => a.priority - b.priority);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VideoPlayerAdapter,
        VideoPlayerFactory,
        PlaybackHealthMonitor,
        ErrorRecoveryManager,
        ShakaPlayerAdapter,
        WebOSVideoAdapter,
        HTML5VideoAdapter,
        MediaError,
        RecoveryStrategy,
        AdapterPriority
    };
}
