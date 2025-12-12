// -*- coding: utf-8 -*-

/*
 * Video Player Adapter - Abstraction layer for multiple playback engines
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

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
                console.log('Shaka Player not supported in this browser');
                return false;
            }

            // Install polyfills
            shaka.polyfill.installAll();

            // Create player instance (use attach method instead of constructor with element)
            this.player = new shaka.Player();
            await this.player.attach(this.videoElement);

            // Optimized configuration for webOS with fast seeking and minimal buffering issues
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
                        maxHeight: 1080,
                        maxWidth: 1920,
                        maxBandwidth: 40000000
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
                }
            });

            // Setup error handling
            this.player.addEventListener('error', (event) => {
                console.error('Shaka Player error:', event.detail);
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
            console.log('Shaka Player initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize Shaka Player:', error);
            return false;
        }
    }

    async load(url, options = {}) {
        if (!this.initialized || !this.player) {
            throw new Error('Shaka Player not initialized');
        }

        try {
            console.log('[ShakaAdapter] Loading:', url);
            if (options.startPosition) {
                console.log('[ShakaAdapter] Will seek to:', options.startPosition, 'after load');
            }
            
            // Load the manifest
            await this.player.load(url);
            
            console.log('[ShakaAdapter] Shaka Player loaded:', url);
            this.emit('loaded', { url });

            // Set start position AFTER loading (when metadata is available)
            if (options.startPosition && options.startPosition > 0) {
                console.log('[ShakaAdapter] Seeking to start position:', options.startPosition);
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
            console.error('Shaka Player load error:', error);
            this.emit('error', error);
            throw error;
        }
    }

    selectAudioTrack(trackId) {
        if (!this.player || !this.initialized) {
            console.warn('Shaka Player not ready for audio track selection');
            return false;
        }

        try {
            const allTracks = this.player.getVariantTracks();
            console.log('[ShakaAdapter] selectAudioTrack called with trackId:', trackId);
            console.log('[ShakaAdapter] All variant tracks:', allTracks.length);
            
            // Get unique audio languages
            const audioLanguages = [];
            const seenLanguages = new Set();
            allTracks.forEach(track => {
                if (track.language && !seenLanguages.has(track.language)) {
                    seenLanguages.add(track.language);
                    audioLanguages.push(track.language);
                }
            });
            
            console.log('[ShakaAdapter] Unique audio languages from Shaka:', audioLanguages);
            console.log('[ShakaAdapter] trackId:', trackId, 'audioLanguages.length:', audioLanguages.length);
            
            if (trackId >= 0 && trackId < audioLanguages.length) {
                const targetLanguage = audioLanguages[trackId];
                console.log('[ShakaAdapter] Target language:', targetLanguage);
                
                // Select all variant tracks with this language
                const tracksToSelect = allTracks.filter(t => t.language === targetLanguage);
                if (tracksToSelect.length > 0) {
                    // Select the first track with this language (Shaka will handle quality variants)
                    this.player.selectAudioLanguage(targetLanguage);
                    console.log('✓ Audio language selected:', targetLanguage);
                    return true;
                }
            }
            
            console.warn('[ShakaAdapter] Invalid audio track ID:', trackId, 'valid range: 0 -', audioLanguages.length - 1);
            return false;
        } catch (error) {
            console.error('Error selecting audio track:', error);
            return false;
        }
    }

    selectSubtitleTrack(trackId) {
        if (!this.player || !this.initialized) {
            console.warn('Shaka Player not ready for subtitle track selection');
            return false;
        }

        try {
            if (trackId === -1) {
                this.player.setTextTrackVisibility(false);
                console.log('✓ Subtitles disabled');
                return true;
            }

            const tracks = this.player.getTextTracks();
            console.log('[ShakaAdapter] selectSubtitleTrack called with trackId:', trackId);
            console.log('[ShakaAdapter] Available text tracks:', tracks.length);
            console.log('[ShakaAdapter] Text tracks:', tracks.map(t => ({lang: t.language, kind: t.kind})));
            
            if (trackId >= 0 && trackId < tracks.length) {
                const track = tracks[trackId];
                this.player.selectTextTrack(track);
                this.player.setTextTrackVisibility(true);
                console.log('✓ Subtitle track selected:', track.language || trackId);
                return true;
            }
            
            console.warn('[ShakaAdapter] Invalid subtitle track ID:', trackId, 'valid range: 0 -', tracks.length - 1);
            return false;
        } catch (error) {
            console.error('Error selecting subtitle track:', error);
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

    async destroy() {
        if (this.player) {
            await this.player.destroy();
            this.player = null;
        }
        this.initialized = false;
        await super.destroy();
    }

    getName() {
        return 'ShakaPlayer';
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
                console.log('webOS media API not available');
                return false;
            }

            this.initialized = true;
            console.log('webOS Native Video API initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize webOS Video API:', error);
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
                mediaTransportType: options.mimeType?.includes('application/x-mpegURL') 
                    ? 'HLS' 
                    : 'BUFFERSTREAM'
            };

            // Unload previous media if exists
            if (this.mediaObject) {
                try {
                    this.mediaObject.unload();
                } catch (e) {
                    console.warn('Error unloading previous media:', e);
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

            console.log('webOS Native Video loaded:', url);
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
            console.error('webOS Video load error:', error);
            this.emit('error', error);
            throw error;
        }
    }

    handleMediaEvent(event) {
        console.log('webOS media event:', event);
        
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
                console.log('✓ Audio track selected via webOS:', trackId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error selecting audio track:', error);
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
                console.log('✓ Subtitles disabled via webOS');
                return true;
            }

            if (textTracks && trackId >= 0 && trackId < textTracks.length) {
                for (let i = 0; i < textTracks.length; i++) {
                    textTracks[i].mode = (i === trackId) ? 'showing' : 'disabled';
                }
                console.log('✓ Subtitle track selected via webOS:', trackId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error selecting subtitle track:', error);
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
                console.warn('Error unloading media object:', e);
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
 * HTML5 Video Adapter (Fallback)
 */
class HTML5VideoAdapter extends VideoPlayerAdapter {
    constructor(videoElement) {
        super(videoElement);
        this.initialized = false;
    }

    async initialize() {
        this.initialized = true;
        console.log('HTML5 Video adapter initialized (fallback mode)');
        return true;
    }

    async load(url, options = {}) {
        if (!this.initialized) {
            throw new Error('HTML5 Video adapter not initialized');
        }

        try {
            // Clear existing sources
            this.videoElement.innerHTML = '';
            
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

            console.log('HTML5 Video loaded:', url);
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
            console.error('HTML5 Video load error:', error);
            this.emit('error', error);
            throw error;
        }
    }

    selectAudioTrack(trackId) {
        try {
            const audioTracks = this.videoElement.audioTracks;
            if (audioTracks && trackId >= 0 && trackId < audioTracks.length) {
                for (let i = 0; i < audioTracks.length; i++) {
                    audioTracks[i].enabled = (i === trackId);
                }
                console.log('✓ Audio track selected via HTML5:', trackId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error selecting audio track:', error);
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
                console.log('✓ Subtitles disabled via HTML5');
                return true;
            }

            if (textTracks && trackId >= 0 && trackId < textTracks.length) {
                for (let i = 0; i < textTracks.length; i++) {
                    textTracks[i].mode = (i === trackId) ? 'showing' : 'disabled';
                }
                console.log('✓ Subtitle track selected via HTML5:', trackId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error selecting subtitle track:', error);
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
     * @returns {Promise<VideoPlayerAdapter>} Initialized player adapter
     */
    static async createPlayer(videoElement) {
        const adapters = [
            ShakaPlayerAdapter,
            WebOSVideoAdapter,
            HTML5VideoAdapter
        ];

        for (const AdapterClass of adapters) {
            try {
                console.log(`Attempting to initialize ${AdapterClass.name}...`);
                const adapter = new AdapterClass(videoElement);
                const success = await adapter.initialize();
                
                if (success) {
                    console.log(`✓ Using ${adapter.getName()} for video playback`);
                    return adapter;
                }
            } catch (error) {
                console.warn(`Failed to initialize ${AdapterClass.name}:`, error);
            }
        }

        throw new Error('No video player adapter could be initialized');
    }
}
