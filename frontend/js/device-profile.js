/**
 * Device Profile Builder for webOS
 * Detects browser capabilities and builds a device profile for Jellyfin server
 * Based on jellyfin-web's browserDeviceProfile.js with full webOS-specific handling
 * @module DeviceProfile
 */
var DeviceProfile = (function() {
    'use strict';

    var _capabilities = null;
    var _videoTestElement = null;
    var _deviceInfo = null;
    var _deviceInfoCallbacks = [];
    var _deviceInfoLoaded = false;

    function getVideoTestElement() {
        if (!_videoTestElement) {
            _videoTestElement = document.createElement('video');
        }
        return _videoTestElement;
    }

    /**
     * Get webOS version using Chrome version mapping (from jellyfin-web browser.js)
     * webOS 1 = Chrome 26-33 (app) or Safari 537 (browser)
     * webOS 2 = Chrome 34-37 (app) or Safari 538 (browser)
     * webOS 3 = Chrome 38-52
     * webOS 4 = Chrome 53-67
     * webOS 5 = Chrome 68-78
     * webOS 6 = Chrome 79-86
     * webOS 22 = Chrome 87-93
     * webOS 23 = Chrome 94+
     */
    function getWebOSVersion() {
        var ua = navigator.userAgent.toLowerCase();
        
        // Check for NetCast browser (legacy, can't detect version reliably)
        if (ua.indexOf('netcast') !== -1) {
            console.warn('[DeviceProfile] NetCast browser detected - webOS version uncertain');
            return 3; // Assume webOS 3 for legacy
        }
        
        // Try Chrome version mapping (most reliable for webOS apps)
        var chromeMatch = ua.match(/chrome\/(\d+)/);
        if (chromeMatch) {
            var chromeVersion = parseInt(chromeMatch[1], 10);
            
            if (chromeVersion >= 94) return 23;
            if (chromeVersion >= 87) return 22;
            if (chromeVersion >= 79) return 6;
            if (chromeVersion >= 68) return 5;
            if (chromeVersion >= 53) return 4;
            if (chromeVersion >= 38) return 3;
            if (chromeVersion >= 34) return 2;
            if (chromeVersion >= 26) return 1;
        }
        
        // Safari fallback for webOS browser mode
        var safariMatch = ua.match(/safari\/(\d+)/);
        if (safariMatch) {
            var safariVersion = parseInt(safariMatch[1], 10);
            if (safariVersion >= 538) return 2;
            if (safariVersion >= 537) return 1;
        }
        
        console.error('[DeviceProfile] Unable to detect webOS version');
        return 4; // Default to webOS 4 as safe assumption
    }

    /**
     * Load device info from webOS.deviceInfo API
     * This provides HDR10, Dolby Vision, Dolby Atmos capabilities directly from the TV
     */
    function loadDeviceInfo(callback) {
        if (_deviceInfoLoaded) {
            if (callback) callback(_deviceInfo);
            return;
        }
        
        if (callback) {
            _deviceInfoCallbacks.push(callback);
        }
        
        // Only initiate loading once
        if (_deviceInfoCallbacks.length > 1) {
            return;
        }
        
        if (typeof webOS !== 'undefined' && typeof webOS.deviceInfo === 'function') {
            console.log('[DeviceProfile] Loading webOS deviceInfo...');
            try {
                webOS.deviceInfo(function(info) {
                    _deviceInfo = info || {};
                    _deviceInfoLoaded = true;
                    console.log('[DeviceProfile] webOS deviceInfo loaded:', JSON.stringify(_deviceInfo, null, 2));
                    
                    // Call all waiting callbacks
                    var callbacks = _deviceInfoCallbacks.slice();
                    _deviceInfoCallbacks = [];
                    callbacks.forEach(function(cb) {
                        cb(_deviceInfo);
                    });
                });
            } catch (e) {
                console.error('[DeviceProfile] Error loading webOS deviceInfo:', e);
                _deviceInfo = {};
                _deviceInfoLoaded = true;
                
                var callbacks = _deviceInfoCallbacks.slice();
                _deviceInfoCallbacks = [];
                callbacks.forEach(function(cb) {
                    cb(_deviceInfo);
                });
            }
        } else {
            console.warn('[DeviceProfile] webOS.deviceInfo not available');
            _deviceInfo = {};
            _deviceInfoLoaded = true;
            
            var callbacks = _deviceInfoCallbacks.slice();
            _deviceInfoCallbacks = [];
            callbacks.forEach(function(cb) {
                cb(_deviceInfo);
            });
        }
    }

    /**
     * Get cached device info synchronously (may be empty if not loaded yet)
     */
    function getDeviceInfo() {
        return _deviceInfo || {};
    }

    /**
     * Check if TV supports HDR10 based on deviceInfo
     * Falls back to webOS version check if deviceInfo not available
     */
    function supportsHdr10() {
        var deviceInfo = getDeviceInfo();
        if (deviceInfo && typeof deviceInfo.hdr10 !== 'undefined') {
            return deviceInfo.hdr10 === true;
        }
        // webOS 4+ TVs generally support HDR10
        return getWebOSVersion() >= 4;
    }

    /**
     * Check if TV supports Dolby Vision based on deviceInfo
     * Falls back to codec test and webOS version check
     */
    function supportsDolbyVision() {
        var deviceInfo = getDeviceInfo();
        if (deviceInfo && typeof deviceInfo.dolbyVision !== 'undefined') {
            return deviceInfo.dolbyVision === true;
        }
        // webOS 4+ with codec support
        var webosVersion = getWebOSVersion();
        if (webosVersion >= 4) {
            return canPlayDolbyVision();
        }
        return false;
    }

    /**
     * Check Dolby Vision profile 8 support (webOS 4+ generally supports this)
     * Profile 8 is important for DV with HDR10 fallback
     */
    function supportsDolbyVisionProfile8() {
        var webosVersion = getWebOSVersion();
        var video = getVideoTestElement();
        
        // Profile 8 4k@24fps test
        if (video.canPlayType && 
            video.canPlayType('video/mp4; codecs="dvh1.08.06"').replace(/no/, '')) {
            return true;
        }
        
        // LG TVs from webOS 4+ should support profile 8 even if not reported
        // Per jellyfin-web: "LG TVs from at least 2020 onwards should support profile 8"
        return webosVersion >= 4;
    }

    /**
     * Check if TV supports Dolby Atmos based on deviceInfo
     */
    function supportsDolbyAtmos() {
        var deviceInfo = getDeviceInfo();
        if (deviceInfo && typeof deviceInfo.dolbyAtmos !== 'undefined') {
            return deviceInfo.dolbyAtmos === true;
        }
        return false;
    }

    /**
     * Check if browser can play H.264
     */
    function canPlayH264() {
        var video = getVideoTestElement();
        return !!(video.canPlayType && 
            video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"').replace(/no/, ''));
    }

    function canPlayHevc() {
        var video = getVideoTestElement();
        return !!(video.canPlayType && (
            video.canPlayType('video/mp4; codecs="hvc1.1.4.L123"').replace(/no/, '') ||
            video.canPlayType('video/mp4; codecs="hev1.1.4.L123"').replace(/no/, '') ||
            video.canPlayType('video/mp4; codecs="hevc"').replace(/no/, '')
        ));
    }

    function canPlayDolbyVision() {
        var video = getVideoTestElement();
        return !!(video.canPlayType && (
            video.canPlayType('video/mp4; codecs="dvhe.05.07"').replace(/no/, '') ||
            video.canPlayType('video/mp4; codecs="dvh1.05.07"').replace(/no/, '') ||
            video.canPlayType('video/mp4; codecs="dvhe"').replace(/no/, '') ||
            video.canPlayType('video/mp4; codecs="dvh1"').replace(/no/, '')
        ));
    }

    function canPlayVp9() {
        var video = getVideoTestElement();
        return !!(video.canPlayType && 
            video.canPlayType('video/webm; codecs="vp9"').replace(/no/, ''));
    }

    function canPlayAv1() {
        var video = getVideoTestElement();
        return !!(video.canPlayType && 
            video.canPlayType('video/mp4; codecs="av01.0.08M.08"').replace(/no/, ''));
    }

    function canPlayAac() {
        var video = getVideoTestElement();
        return !!(video.canPlayType && 
            video.canPlayType('video/mp4; codecs="avc1.640029, mp4a.40.2"').replace(/no/, ''));
    }

    function canPlayAc3() {
        var video = getVideoTestElement();
        return !!(video.canPlayType && (
            video.canPlayType('video/mp4; codecs="ac-3"').replace(/no/, '') ||
            video.canPlayType('video/mp4; codecs="mp4a.a5"').replace(/no/, '')
        ));
    }

    function canPlayEac3() {
        var video = getVideoTestElement();
        return !!(video.canPlayType && (
            video.canPlayType('video/mp4; codecs="ec-3"').replace(/no/, '') ||
            video.canPlayType('video/mp4; codecs="mp4a.a6"').replace(/no/, '')
        ));
    }

    /**
     * Check DTS support based on webOS version
     * DTS is NOT supported on webOS 5.0-22
     * Per jellyfin-web: "DTS audio is not supported by LG TV 2020-2022 (webOS 5.0, 6.0 and 22) models"
     */
    function canPlayDts() {
        var webosVersion = getWebOSVersion();
        // webOS 5, 6, 22 do NOT support DTS
        if (webosVersion >= 5 && webosVersion < 23) {
            return false;
        }
        // webOS 4 and earlier support DTS
        // webOS 23+ also supports DTS again
        return webosVersion <= 4 || webosVersion >= 23;
    }

    /**
     * Check if native HLS in fMP4 is supported
     * Per jellyfin-web: webOS 3.5+ supports HLS in fMP4
     */
    function canPlayNativeHlsInFmp4() {
        var webosVersion = getWebOSVersion();
        // webOS 3.5+ (approximately webOS 4+) supports HLS in fMP4
        return webosVersion >= 4;
    }

    function canPlayNativeHls() {
        var video = getVideoTestElement();
        return !!(video.canPlayType && (
            video.canPlayType('application/x-mpegURL').replace(/no/, '') ||
            video.canPlayType('application/vnd.apple.mpegURL').replace(/no/, '')
        ));
    }

    function canPlayMkv() {
        var video = getVideoTestElement();
        if (video.canPlayType) {
            var result = video.canPlayType('video/x-matroska').replace(/no/, '') ||
                        video.canPlayType('video/mkv').replace(/no/, '');
            if (result) return true;
        }
        return getWebOSVersion() >= 3;
    }

    /**
     * Check if browser supports AC3 in HLS
     */
    function canPlayAc3InHls() {
        // webOS generally supports AC3 in HLS
        var webosVersion = getWebOSVersion();
        if (webosVersion >= 3) return true;
        
        var video = getVideoTestElement();
        return !!(video.canPlayType && (
            video.canPlayType('application/x-mpegurl; codecs="avc1.42E01E, ac-3"').replace(/no/, '') ||
            video.canPlayType('application/vnd.apple.mpegURL; codecs="avc1.42E01E, ac-3"').replace(/no/, '')
        ));
    }

    /**
     * Check if opus audio is supported
     * webOS < 3.5 doesn't support opus properly
     */
    function canPlayOpus() {
        var webosVersion = getWebOSVersion();
        // webOS 3.5+ supports opus (webOS 4+)
        if (webosVersion >= 4) {
            return true;
        }
        return false;
    }

    /**
     * Check if secondary audio tracks are supported
     * Per jellyfin-web: webOS 4.0+ supports secondary audio
     */
    function canPlaySecondaryAudio() {
        var webosVersion = getWebOSVersion();
        return webosVersion >= 4;
    }

    /**
     * Get maximum H.264 level supported
     * webOS generally supports H.264 level 5.1
     */
    function getMaxH264Level() {
        var video = getVideoTestElement();
        var webosVersion = getWebOSVersion();
        
        // Test for level 5.1
        if (video.canPlayType('video/mp4; codecs="avc1.640033"').replace(/no/, '') ||
            webosVersion >= 4) {
            return 51;
        }
        
        // Default to level 4.2
        return 42;
    }

    /**
     * Get maximum HEVC level supported
     */
    function getMaxHevcLevel() {
        var video = getVideoTestElement();
        
        // hevc main10 level 6.1
        if (video.canPlayType('video/mp4; codecs="hvc1.2.4.L183"').replace(/no/, '') ||
            video.canPlayType('video/mp4; codecs="hev1.2.4.L183"').replace(/no/, '')) {
            return 183;
        }
        
        // hevc main10 level 5.1
        if (video.canPlayType('video/mp4; codecs="hvc1.2.4.L153"').replace(/no/, '') ||
            video.canPlayType('video/mp4; codecs="hev1.2.4.L153"').replace(/no/, '')) {
            return 153;
        }
        
        // hevc main10 level 4.1
        if (video.canPlayType('video/mp4; codecs="hvc1.2.4.L123"').replace(/no/, '') ||
            video.canPlayType('video/mp4; codecs="hev1.2.4.L123"').replace(/no/, '')) {
            return 123;
        }
        
        // Default to level 4.0
        return 120;
    }

    /**
     * Detect all capabilities and cache the results
     */
    function detectCapabilities() {
        if (_capabilities) return _capabilities;

        var webosVersion = getWebOSVersion();
        var deviceInfo = getDeviceInfo();
        
        console.log('[DeviceProfile] Detected webOS version:', webosVersion);
        console.log('[DeviceProfile] Device info:', JSON.stringify(deviceInfo, null, 2));

        // Use deviceInfo for HDR/DV if available, otherwise fall back to detection
        var hasHdr10 = (deviceInfo && deviceInfo.hdr10 === true) || webosVersion >= 4;
        var hasDolbyVision = (deviceInfo && deviceInfo.dolbyVision === true) || 
                            (webosVersion >= 4 && canPlayDolbyVision());
        var hasDolbyAtmos = deviceInfo && deviceInfo.dolbyAtmos === true;
        
        // HEVC is always supported on webOS 3+
        var hasHevc = webosVersion >= 3 || canPlayHevc();
        
        // AV1 support (webOS 5+)
        var hasAv1 = webosVersion >= 5 && canPlayAv1();

        _capabilities = {
            webosVersion: webosVersion,
            h264: canPlayH264(),
            hevc: hasHevc,
            dolbyVision: hasDolbyVision,
            dolbyVisionProfile8: supportsDolbyVisionProfile8(),
            hdr10: hasHdr10,
            dolbyAtmos: hasDolbyAtmos,
            vp9: canPlayVp9(),
            av1: hasAv1,
            aac: canPlayAac(),
            ac3: canPlayAc3(),
            eac3: canPlayEac3(),
            dts: canPlayDts(),
            opus: canPlayOpus(),
            nativeHls: canPlayNativeHls(),
            nativeHlsFmp4: canPlayNativeHlsInFmp4(),
            mkv: canPlayMkv(),
            ac3InHls: canPlayAc3InHls(),
            secondaryAudio: canPlaySecondaryAudio(),
            maxH264Level: getMaxH264Level(),
            maxHevcLevel: getMaxHevcLevel()
        };

        console.log('[DeviceProfile] Detected capabilities:', JSON.stringify(_capabilities, null, 2));
        return _capabilities;
    }

    /**
     * Build the device profile based on detected capabilities
     * This is heavily based on jellyfin-web's browserDeviceProfile.js with webOS-specific handling
     */
    function getProfile(options) {
        options = options || {};
        var caps = detectCapabilities();
        
        var maxBitrate = options.maxBitrate || 120000000; // 120 Mbps default
        var maxWidth = options.maxWidth || 3840;
        var maxHeight = options.maxHeight || 2160;

        // Build video codecs list based on capabilities
        var mp4VideoCodecs = [];
        var mkvVideoCodecs = [];
        var hlsInTsVideoCodecs = [];
        var hlsInFmp4VideoCodecs = [];
        
        if (caps.h264) {
            mp4VideoCodecs.push('h264');
            mkvVideoCodecs.push('h264');
            hlsInTsVideoCodecs.push('h264');
            hlsInFmp4VideoCodecs.push('h264');
        }
        
        if (caps.hevc) {
            mp4VideoCodecs.push('hevc');
            mkvVideoCodecs.push('hevc');
            // HEVC in HLS TS is supported on webOS
            hlsInTsVideoCodecs.push('hevc');
            // HEVC in HLS fMP4 requires webOS 4+
            if (caps.webosVersion >= 4) {
                hlsInFmp4VideoCodecs.push('hevc');
            }
        }
        
        // AV1 support (webOS 5+)
        if (caps.av1) {
            mp4VideoCodecs.push('av1');
            mkvVideoCodecs.push('av1');
        }

        // Build audio codecs list
        var videoAudioCodecs = [];
        var hlsInTsAudioCodecs = [];
        var hlsInFmp4AudioCodecs = [];
        
        if (caps.aac) {
            videoAudioCodecs.push('aac');
            hlsInTsAudioCodecs.push('aac');
            hlsInFmp4AudioCodecs.push('aac');
        }
        
        videoAudioCodecs.push('mp3');
        hlsInTsAudioCodecs.push('mp3');
        
        if (caps.ac3) {
            videoAudioCodecs.push('ac3');
            if (caps.ac3InHls) {
                hlsInTsAudioCodecs.push('ac3');
                hlsInFmp4AudioCodecs.push('ac3');
            }
        }
        
        if (caps.eac3) {
            videoAudioCodecs.push('eac3');
            if (caps.ac3InHls) {
                hlsInTsAudioCodecs.push('eac3');
                hlsInFmp4AudioCodecs.push('eac3');
            }
        }
        
        if (caps.dts) {
            videoAudioCodecs.push('dts', 'dca');
        }
        
        if (caps.opus) {
            videoAudioCodecs.push('opus');
            hlsInFmp4AudioCodecs.push('opus');
        }
        
        // webOS supports PCM audio
        videoAudioCodecs.push('pcm_s16le', 'pcm_s24le');
        
        // Add lossless audio for high-end setups
        videoAudioCodecs.push('truehd', 'flac', 'alac');

        // Build DirectPlay profiles
        var directPlayProfiles = [];
        
        if (mp4VideoCodecs.length > 0) {
            directPlayProfiles.push({
                Container: 'mp4,m4v',
                Type: 'Video',
                VideoCodec: mp4VideoCodecs.join(','),
                AudioCodec: videoAudioCodecs.join(',')
            });
        }
        
        if (caps.mkv && mkvVideoCodecs.length > 0) {
            directPlayProfiles.push({
                Container: 'mkv',
                Type: 'Video',
                VideoCodec: mkvVideoCodecs.join(','),
                AudioCodec: videoAudioCodecs.join(',')
            });
        }
        
        // Additional container support for webOS
        directPlayProfiles.push({
            Container: 'mov',
            Type: 'Video',
            VideoCodec: 'h264',
            AudioCodec: videoAudioCodecs.join(',')
        });
        
        // TS container support
        var tsVideoCodecs = ['h264'];
        if (caps.hevc) tsVideoCodecs.push('hevc');
        directPlayProfiles.push({
            Container: 'ts,mpegts',
            Type: 'Video',
            VideoCodec: tsVideoCodecs.join(','),
            AudioCodec: videoAudioCodecs.join(',')
        });
        
        // m2ts container
        directPlayProfiles.push({
            Container: 'm2ts',
            Type: 'Video',
            VideoCodec: tsVideoCodecs.join(','),
            AudioCodec: videoAudioCodecs.join(',')
        });
        
        // HLS direct play for fMP4
        if (hlsInFmp4VideoCodecs.length > 0) {
            directPlayProfiles.push({
                Container: 'hls',
                Type: 'Video',
                VideoCodec: hlsInFmp4VideoCodecs.join(','),
                AudioCodec: hlsInFmp4AudioCodecs.join(',')
            });
        }

        // Audio direct play profiles
        ['mp3', 'aac', 'flac', 'alac', 'wav', 'ogg', 'oga'].forEach(function(format) {
            directPlayProfiles.push({
                Container: format,
                Type: 'Audio'
            });
        });

        // Build Transcoding profiles - HLS is the primary transcoding target
        var transcodingProfiles = [];
        var maxAudioChannels = '6';
        
        // Primary: HLS in fMP4 container (webOS 4+)
        if (caps.nativeHlsFmp4 && hlsInFmp4VideoCodecs.length > 0) {
            transcodingProfiles.push({
                Container: 'mp4',
                Type: 'Video',
                AudioCodec: hlsInFmp4AudioCodecs.join(','),
                VideoCodec: hlsInFmp4VideoCodecs.join(','),
                Context: 'Streaming',
                Protocol: 'hls',
                MaxAudioChannels: maxAudioChannels,
                MinSegments: '1',
                BreakOnNonKeyFrames: false
            });
        }
        
        // Secondary: HLS in TS container (broader compatibility)
        if (hlsInTsVideoCodecs.length > 0) {
            transcodingProfiles.push({
                Container: 'ts',
                Type: 'Video',
                AudioCodec: hlsInTsAudioCodecs.join(','),
                VideoCodec: hlsInTsVideoCodecs.join(','),
                Context: 'Streaming',
                Protocol: 'hls',
                MaxAudioChannels: maxAudioChannels,
                MinSegments: '1',
                BreakOnNonKeyFrames: false
            });
        }

        // Audio transcoding profile
        transcodingProfiles.push({
            Container: 'mp3',
            Type: 'Audio',
            AudioCodec: 'mp3',
            Context: 'Streaming',
            Protocol: 'http',
            MaxAudioChannels: '2'
        });

        // Build codec profiles with conditions
        var codecProfiles = [];
        
        // Build HDR video range types based on capabilities
        var h264VideoRangeTypes = 'SDR';
        var hevcVideoRangeTypes = 'SDR';
        var av1VideoRangeTypes = 'SDR';
        
        // HDR10 support
        if (caps.hdr10) {
            hevcVideoRangeTypes += '|HDR10|HDR10Plus';
            if (caps.av1) {
                av1VideoRangeTypes += '|HDR10|HDR10Plus';
            }
        }
        
        // HLG support (generally available if HDR10 is supported)
        if (caps.hdr10) {
            hevcVideoRangeTypes += '|HLG';
            if (caps.av1) {
                av1VideoRangeTypes += '|HLG';
            }
        }
        
        // Dolby Vision support
        if (caps.dolbyVision) {
            // Profile 5
            hevcVideoRangeTypes += '|DOVI';
            
            // Profile 8 (DV with HDR10/HLG/SDR fallback)
            if (caps.dolbyVisionProfile8) {
                hevcVideoRangeTypes += '|DOVIWithHDR10|DOVIWithHLG|DOVIWithSDR|DOVIWithHDR10Plus';
            }
            
            // webOS can play fallback of Profile 7 and most invalid profiles
            hevcVideoRangeTypes += '|DOVIWithEL|DOVIWithELHDR10Plus|DOVIInvalid';
        }
        
        // H.264 conditions
        var h264Conditions = [
            { Condition: 'LessThanEqual', Property: 'Width', Value: String(maxWidth), IsRequired: false },
            { Condition: 'LessThanEqual', Property: 'Height', Value: String(maxHeight), IsRequired: false },
            { Condition: 'LessThanEqual', Property: 'VideoFramerate', Value: '60', IsRequired: false },
            { Condition: 'LessThanEqual', Property: 'VideoBitrate', Value: String(maxBitrate), IsRequired: false },
            { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: String(caps.maxH264Level), IsRequired: false },
            { Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'high|main|baseline|constrained baseline', IsRequired: false },
            { Condition: 'EqualsAny', Property: 'VideoRangeType', Value: h264VideoRangeTypes, IsRequired: false }
        ];
        
        codecProfiles.push({
            Type: 'Video',
            Codec: 'h264',
            Conditions: h264Conditions
        });
        
        // HEVC conditions with HDR support
        if (caps.hevc) {
            var hevcConditions = [
                { Condition: 'LessThanEqual', Property: 'Width', Value: String(maxWidth), IsRequired: false },
                { Condition: 'LessThanEqual', Property: 'Height', Value: String(maxHeight), IsRequired: false },
                { Condition: 'LessThanEqual', Property: 'VideoFramerate', Value: '60', IsRequired: false },
                { Condition: 'LessThanEqual', Property: 'VideoBitrate', Value: String(maxBitrate), IsRequired: false },
                { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: String(caps.maxHevcLevel), IsRequired: false },
                { Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'main|main 10', IsRequired: false },
                { Condition: 'EqualsAny', Property: 'VideoRangeType', Value: hevcVideoRangeTypes, IsRequired: false }
            ];
            
            codecProfiles.push({
                Type: 'Video',
                Codec: 'hevc',
                Conditions: hevcConditions
            });
            
            // Special handling for Dolby Vision in webOS
            // Disallow direct playing of DOVI media in containers not ts or mp4
            if (caps.dolbyVision) {
                codecProfiles.push({
                    Type: 'Video',
                    Container: '-mp4,ts',
                    Codec: 'hevc',
                    Conditions: [
                        { Condition: 'NotEquals', Property: 'VideoRangeType', Value: 'DOVI', IsRequired: false }
                    ]
                });
            }
        }
        
        // AV1 conditions
        if (caps.av1) {
            var av1Conditions = [
                { Condition: 'LessThanEqual', Property: 'Width', Value: String(maxWidth), IsRequired: false },
                { Condition: 'LessThanEqual', Property: 'Height', Value: String(maxHeight), IsRequired: false },
                { Condition: 'LessThanEqual', Property: 'VideoFramerate', Value: '60', IsRequired: false },
                { Condition: 'LessThanEqual', Property: 'VideoBitrate', Value: String(maxBitrate), IsRequired: false },
                { Condition: 'EqualsAny', Property: 'VideoRangeType', Value: av1VideoRangeTypes, IsRequired: false }
            ];
            
            codecProfiles.push({
                Type: 'Video',
                Codec: 'av1',
                Conditions: av1Conditions
            });
        }

        // Global audio conditions
        var globalAudioConditions = [
            { Condition: 'LessThanEqual', Property: 'AudioChannels', Value: '8', IsRequired: false }
        ];
        
        codecProfiles.push({
            Type: 'VideoAudio',
            Conditions: globalAudioConditions
        });
        
        // Secondary audio handling (if not supported, require primary audio only)
        if (!caps.secondaryAudio) {
            codecProfiles.push({
                Type: 'VideoAudio',
                Conditions: [
                    { Condition: 'Equals', Property: 'IsSecondaryAudio', Value: 'false', IsRequired: false }
                ]
            });
        }
        
        // FLAC audio limitation for webOS (max 2 channels)
        codecProfiles.push({
            Type: 'VideoAudio',
            Codec: 'flac',
            Conditions: [
                { Condition: 'LessThanEqual', Property: 'AudioChannels', Value: '2', IsRequired: false }
            ]
        });

        // Subtitle profiles - use external delivery where possible, burn-in for complex formats
        var subtitleProfiles = [
            { Format: 'srt', Method: 'External' },
            { Format: 'vtt', Method: 'External' },
            { Format: 'ass', Method: 'Encode' },
            { Format: 'ssa', Method: 'Encode' },
            { Format: 'sub', Method: 'Encode' },
            { Format: 'subrip', Method: 'External' },
            { Format: 'pgssub', Method: 'Encode' },
            { Format: 'dvdsub', Method: 'Encode' },
            { Format: 'dvbsub', Method: 'Encode' }
        ];

        // Container profiles (webOS limitation on stream count)
        var containerProfiles = [];

        var profile = {
            MaxStreamingBitrate: maxBitrate,
            MaxStaticBitrate: 100000000,
            MusicStreamingTranscodingBitrate: Math.min(maxBitrate, 384000),
            DirectPlayProfiles: directPlayProfiles,
            TranscodingProfiles: transcodingProfiles,
            ContainerProfiles: containerProfiles,
            CodecProfiles: codecProfiles,
            SubtitleProfiles: subtitleProfiles,
            ResponseProfiles: []
        };
        
        console.log('[DeviceProfile] Built profile:', JSON.stringify(profile, null, 2));
        return profile;
    }

    /**
     * Get capabilities object
     */
    function getCapabilities() {
        return detectCapabilities();
    }

    /**
     * Check if we should use native HLS instead of HLS.js
     * Native HLS is often more reliable on TV browsers
     */
    function shouldUseNativeHls() {
        var caps = detectCapabilities();
        // Prefer native HLS on webOS as it handles codec issues better
        return caps.nativeHls;
    }

    /**
     * Check if HLS.js should be used for a specific media source
     * Based on jellyfin-web's enableHlsJsPlayerForCodecs
     */
    function shouldUseHlsJs(mediaSource) {
        var caps = detectCapabilities();
        
        // If no native HLS support, we need HLS.js
        if (!caps.nativeHls) {
            return typeof Hls !== 'undefined' && Hls.isSupported();
        }
        
        // Check if media has VP9 codec which may need HLS.js
        if (mediaSource && mediaSource.MediaStreams) {
            var hasVp9 = mediaSource.MediaStreams.some(function(s) {
                return s.Codec === 'vp9';
            });
            if (hasVp9 && !caps.vp9) {
                return typeof Hls !== 'undefined' && Hls.isSupported();
            }
        }
        
        // Default to native HLS on webOS for better compatibility
        return false;
    }

    /**
     * Determine the best play method for a given media source
     * Returns: 'DirectPlay', 'DirectStream', or 'Transcode'
     */
    function getPlayMethod(mediaSource) {
        var caps = detectCapabilities();
        
        if (!mediaSource) {
            return 'Transcode';
        }
        
        // Check if direct play is possible
        var videoStream = null;
        var audioStream = null;
        
        if (mediaSource.MediaStreams) {
            mediaSource.MediaStreams.forEach(function(stream) {
                if (stream.Type === 'Video' && !videoStream) {
                    videoStream = stream;
                } else if (stream.Type === 'Audio' && !audioStream) {
                    audioStream = stream;
                }
            });
        }
        
        if (!videoStream) {
            // Audio only - check audio direct play
            return 'DirectPlay';
        }
        
        var videoCodec = (videoStream.Codec || '').toLowerCase();
        var container = (mediaSource.Container || '').toLowerCase();
        
        // Check video codec support
        var canPlayVideo = false;
        if (videoCodec === 'h264' && caps.h264) canPlayVideo = true;
        if ((videoCodec === 'hevc' || videoCodec === 'h265') && caps.hevc) canPlayVideo = true;
        if (videoCodec === 'av1' && caps.av1) canPlayVideo = true;
        if ((videoCodec === 'dvhe' || videoCodec === 'dvh1') && caps.dolbyVision) canPlayVideo = true;
        
        // Check HDR compatibility
        var videoRangeType = videoStream.VideoRangeType || 'SDR';
        if (videoRangeType !== 'SDR') {
            if (videoRangeType.indexOf('HDR10') !== -1 && !caps.hdr10) {
                canPlayVideo = false;
            }
            if (videoRangeType.indexOf('DOVI') !== -1 && !caps.dolbyVision) {
                canPlayVideo = false;
            }
        }
        
        if (!canPlayVideo) {
            return 'Transcode';
        }
        
        // Check container support
        var supportedContainers = ['mp4', 'm4v', 'mkv', 'ts', 'mpegts', 'm2ts', 'mov'];
        if (supportedContainers.indexOf(container) === -1) {
            return 'DirectStream'; // Remux to supported container
        }
        
        // Check audio codec if present
        if (audioStream) {
            var audioCodec = (audioStream.Codec || '').toLowerCase();
            var canPlayAudio = false;
            
            if (audioCodec === 'aac' && caps.aac) canPlayAudio = true;
            if (audioCodec === 'mp3') canPlayAudio = true;
            if (audioCodec === 'ac3' && caps.ac3) canPlayAudio = true;
            if ((audioCodec === 'eac3' || audioCodec === 'ec-3') && caps.eac3) canPlayAudio = true;
            if ((audioCodec === 'dts' || audioCodec === 'dca') && caps.dts) canPlayAudio = true;
            if (audioCodec === 'truehd') canPlayAudio = true;
            if (audioCodec === 'flac') canPlayAudio = true;
            if (audioCodec === 'opus' && caps.opus) canPlayAudio = true;
            
            if (!canPlayAudio) {
                return 'DirectStream'; // Need audio transcoding
            }
        }
        
        return 'DirectPlay';
    }

    /**
     * Initialize the device profile module
     * Loads webOS device info asynchronously
     * @param {Function} callback - Optional callback when initialization is complete
     */
    function init(callback) {
        console.log('[DeviceProfile] Initializing...');
        loadDeviceInfo(function(deviceInfo) {
            console.log('[DeviceProfile] Initialization complete');
            if (callback) {
                callback(deviceInfo);
            }
        });
    }

    /**
     * Get the profile asynchronously (ensures device info is loaded)
     * @param {Object} options - Profile options
     * @param {Function} callback - Callback with the profile
     */
    function getProfileAsync(options, callback) {
        loadDeviceInfo(function() {
            var profile = getProfile(options);
            if (callback) {
                callback(profile);
            }
        });
    }

    // Public API
    return {
        init: init,
        getProfile: getProfile,
        getProfileAsync: getProfileAsync,
        getCapabilities: getCapabilities,
        getDeviceInfo: getDeviceInfo,
        loadDeviceInfo: loadDeviceInfo,
        shouldUseNativeHls: shouldUseNativeHls,
        shouldUseHlsJs: shouldUseHlsJs,
        getPlayMethod: getPlayMethod,
        getWebOSVersion: getWebOSVersion,
        supportsHdr10: supportsHdr10,
        supportsDolbyVision: supportsDolbyVision,
        supportsDolbyAtmos: supportsDolbyAtmos
    };
})();
