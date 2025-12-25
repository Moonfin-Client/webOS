// -*- coding: utf-8 -*-

/*
 * Video Player Adapter - Abstraction layer for multiple playback engines
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Media Error Types
 */
const MediaError = {
    NETWORK_ERROR: 'NetworkError',
    MEDIA_DECODE_ERROR: 'MediaDecodeError',
    MEDIA_NOT_SUPPORTED: 'MediaNotSupported',
    FATAL_HLS_ERROR: 'FatalHlsError',
    SERVER_ERROR: 'ServerError',
    NO_MEDIA_ERROR: 'NoMediaError'
};

/**
 * HLS.js error recovery timing
 */
let recoverDecodingErrorDate;
let recoverSwapAudioCodecDate;

/**
 * Base class for video player adapters
 */
class VideoPlayerAdapter {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.eventHandlers = {};
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
     * Destroy the player and cleanup resources
     */
    async destroy() {
        this.eventHandlers = {};
    }

    /**
     * Get player name/type
     * @returns {string}
     */
    getName() {
        return 'BaseAdapter';
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
        if (this.player) {
            await this.player.destroy();
            this.player = null;
        }
        this.initialized = false;
        await super.destroy();
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
 */
class WebOSVideoAdapter extends VideoPlayerAdapter {
    constructor(videoElement) {
        super(videoElement);
        this.mediaObject = null;
        this.initialized = false;
        this.currentUrl = null;
    }

    async initialize() {
        try {
            // Check if webOS media API is available
            if (!window.webOS || !window.webOS.media) {
                return false;
            }

            this.initialized = true;
            return true;
        } catch (error) {
            return false;
        }
    }

    async load(url, options = {}) {
        if (!this.initialized) {
            throw new Error('webOS Video API not initialized');
        }

        try {
            this.currentUrl = url;

            // Create media object for hardware-accelerated playback
            const mediaOption = {
                mediaTransportType: options.mimeType && options.mimeType.includes('application/x-mpegURL') 
                    ? 'HLS' 
                    : 'BUFFERSTREAM'
            };

            // Unload previous media if exists
            if (this.mediaObject) {
                try {
                    this.mediaObject.unload();
                } catch (e) {
                    // Ignore unload errors, will create new media object
                }
            }

            // Load media using webOS native API
            this.mediaObject = webOS.media.createMediaObject(
                '/dev/video0',
                mediaOption,
                (event) => this.handleMediaEvent(event)
            );

            // Set source
            this.videoElement.src = url;
            
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

        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    handleMediaEvent(event) {
        
        if (event.type === 'error') {
            this.emit('error', event);
        } else if (event.type === 'buffering') {
            this.emit('buffering', event.buffering);
        }
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
        await super.destroy();
    }

    getName() {
        return 'WebOSNative';
    }
}

/**
 * Handle HLS.js media errors with retry logic
 * @param {Object} hlsPlayer - HLS.js player instance
 * @returns {boolean} True if recovery attempted, false if exhausted
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
 * @param {Object} mediaSource - Media source info
 * @returns {string|null} Cross-origin value
 */
function getCrossOriginValue(mediaSource) {
    if (mediaSource && mediaSource.IsRemote) {
        return null;
    }
    return 'anonymous';
}

/**
 * HTML5 Video Element Adapter (Fallback)
 */
class HTML5VideoAdapter extends VideoPlayerAdapter {
    constructor(videoElement) {
        super(videoElement);
        this.initialized = false;
        this.hlsPlayer = null;
    }

    async initialize() {
        this.initialized = true;
        return true;
    }

    async load(url, options = {}) {
        if (!this.initialized) {
            throw new Error('HTML5 Video adapter not initialized');
        }

        console.log('[HTML5Adapter] Loading:', url.substring(0, 80) + '...');

        try {
            // Check if HLS stream and HLS.js is available
            const isHLS = url.includes('.m3u8') || (options.mimeType && options.mimeType.includes('mpegURL'));
            
            if (isHLS && typeof Hls !== 'undefined' && Hls.isSupported()) {
                return this.loadWithHlsJs(url, options);
            }

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

        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Load HLS stream using HLS.js with error recovery
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

            const hls = new Hls({
                manifestLoadingTimeOut: 20000,
                startPosition: options.startPosition || 0,
                xhrSetup: (xhr) => {
                    xhr.withCredentials = options.withCredentials || false;
                }
            });

            hls.loadSource(url);
            hls.attachMedia(this.videoElement);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('[HTML5+HLS.js] Manifest parsed, starting playback');
                this.videoElement.play().then(resolve).catch(reject);
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('[HTML5+HLS.js] Error:', data.type, data.details, 'fatal:', data.fatal);

                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            if (data.response && data.response.code >= 400) {
                                hls.destroy();
                                this.emit('error', { type: MediaError.SERVER_ERROR, details: data });
                                reject(new Error(MediaError.SERVER_ERROR));
                            } else {
                                console.log('[HTML5+HLS.js] Network error, attempting recovery...');
                                hls.startLoad();
                            }
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            if (handleHlsJsMediaError(hls)) {
                                console.log('[HTML5+HLS.js] Media error recovery attempted');
                            } else {
                                hls.destroy();
                                this.emit('error', { type: MediaError.MEDIA_DECODE_ERROR, details: data });
                                reject(new Error(MediaError.MEDIA_DECODE_ERROR));
                            }
                            break;
                        default:
                            hls.destroy();
                            this.emit('error', { type: MediaError.FATAL_HLS_ERROR, details: data });
                            reject(new Error(MediaError.FATAL_HLS_ERROR));
                            break;
                    }
                }
            });

            this.hlsPlayer = hls;
            this.emit('loaded', { url });
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
        await super.destroy();
    }

    getName() {
        return 'HTML5Video';
    }
}

/**
 * Video Player Factory
 * Creates the best available player adapter with automatic fallback
 */
class VideoPlayerFactory {
    /**
     * Create a video player adapter with automatic capability detection
     * @param {HTMLVideoElement} videoElement - Video element to use
     * @param {Object} options - Creation options
     * @param {boolean} options.preferWebOS - Prefer WebOS native adapter for HDR/Dolby Vision
     * @param {boolean} options.preferHTML5 - Prefer HTML5 video element for direct files
     * @returns {Promise<VideoPlayerAdapter>} Initialized player adapter
     */
    static async createPlayer(videoElement, options = {}) {
        // Determine adapter priority based on playback needs
        let adapters = [
            ShakaPlayerAdapter,
            WebOSVideoAdapter,
            HTML5VideoAdapter
        ];

        if (options.preferWebOS) {
            // For Dolby Vision: WebOS native > Shaka > HTML5
            adapters = [
                WebOSVideoAdapter,
                ShakaPlayerAdapter,
                HTML5VideoAdapter
            ];
        } else if (options.preferHTML5) {
            // For direct files: HTML5 > Shaka > WebOS
            adapters = [
                HTML5VideoAdapter,
                ShakaPlayerAdapter,
                WebOSVideoAdapter
            ];
        }

        for (const AdapterClass of adapters) {
            try {
                console.log('[PlayerFactory] Attempting:', AdapterClass.name);
                const adapter = new AdapterClass(videoElement);
                const success = await adapter.initialize();
                
                if (success) {
                    console.log('[PlayerFactory] Using:', adapter.getName());
                    return adapter;
                }
            } catch (error) {
                console.warn('[PlayerFactory]', AdapterClass.name, 'failed:', error.message);
            }
        }

        throw new Error('No video player adapter could be initialized');
    }
}
