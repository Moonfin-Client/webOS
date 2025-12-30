/**
 * Device Profile Builder for webOS
 * Detects browser capabilities and builds a device profile for Jellyfin server
 * Based on jellyfin-web's browserDeviceProfile.js but simplified for webOS
 * @module DeviceProfile
 */
var DeviceProfile = (function() {
    'use strict';

    var _capabilities = null;
    var _videoTestElement = null;

    function getVideoTestElement() {
        if (!_videoTestElement) {
            _videoTestElement = document.createElement('video');
        }
        return _videoTestElement;
    }

    function getWebOSVersion() {
        var ua = navigator.userAgent;
        
        // webOS TV patterns
        var webosMatch = ua.match(/Web0S(?:\.TV)?[\/\s]?(\d+)?/i);
        if (webosMatch && webosMatch[1]) {
            return parseInt(webosMatch[1], 10);
        }
        
        // Try Chrome version as fallback (webOS 4 = Chrome 53, webOS 6 = Chrome 68)
        var chromeMatch = ua.match(/Chrome\/(\d+)/);
        if (chromeMatch) {
            var chromeVersion = parseInt(chromeMatch[1], 10);
            if (chromeVersion <= 53) return 4;
            if (chromeVersion <= 68) return 6;
            return 6; // Assume webOS 6+ for newer Chrome
        }
        
        return 0; // Unknown
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

    function canPlayDts() {
        var webosVersion = getWebOSVersion();
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
     * Detect all capabilities and cache the results
     */
    function detectCapabilities() {
        if (_capabilities) return _capabilities;

        var webosVersion = getWebOSVersion();
        console.log('[DeviceProfile] Detected webOS version:', webosVersion);

        _capabilities = {
            webosVersion: webosVersion,
            h264: canPlayH264(),
            hevc: canPlayHevc(),
            dolbyVision: canPlayDolbyVision(),
            vp9: canPlayVp9(),
            av1: canPlayAv1(),
            aac: canPlayAac(),
            ac3: canPlayAc3(),
            eac3: canPlayEac3(),
            dts: canPlayDts(),
            nativeHls: canPlayNativeHls(),
            mkv: canPlayMkv(),
            ac3InHls: canPlayAc3InHls()
        };

        console.log('[DeviceProfile] Detected capabilities:', JSON.stringify(_capabilities, null, 2));
        return _capabilities;
    }

    /**
     * Build the device profile based on detected capabilities
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
        var hlsVideoCodecs = [];
        
        if (caps.h264) {
            mp4VideoCodecs.push('h264');
            mkvVideoCodecs.push('h264');
            hlsVideoCodecs.push('h264');
        }
        
        if (caps.hevc) {
            mp4VideoCodecs.push('hevc');
            mkvVideoCodecs.push('hevc');
            // HEVC in HLS is typically only supported on webOS 4+
            if (caps.webosVersion >= 4) {
                hlsVideoCodecs.push('hevc');
            }
        }
        
        if (caps.dolbyVision) {
            mp4VideoCodecs.push('dvhe', 'dvh1');
            mkvVideoCodecs.push('dvhe', 'dvh1');
        }

        // Build audio codecs list
        var videoAudioCodecs = [];
        var hlsAudioCodecs = [];
        
        if (caps.aac) {
            videoAudioCodecs.push('aac');
            hlsAudioCodecs.push('aac');
        }
        
        videoAudioCodecs.push('mp3'); // MP3 is widely supported
        hlsAudioCodecs.push('mp3');
        
        if (caps.ac3) {
            videoAudioCodecs.push('ac3');
            if (caps.ac3InHls) {
                hlsAudioCodecs.push('ac3');
            }
        }
        
        if (caps.eac3) {
            videoAudioCodecs.push('eac3');
            if (caps.ac3InHls) {
                hlsAudioCodecs.push('eac3');
            }
        }
        
        if (caps.dts) {
            videoAudioCodecs.push('dts', 'dca');
        }
        
        // Add lossless audio for high-end setups
        videoAudioCodecs.push('truehd', 'flac');

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
                Container: 'mkv,webm',
                Type: 'Video',
                VideoCodec: mkvVideoCodecs.join(','),
                AudioCodec: videoAudioCodecs.join(',')
            });
        }

        // Build Transcoding profiles - HLS is the primary transcoding target
        var transcodingProfiles = [];
        
        // Primary: HLS in fMP4 container (most compatible)
        if (hlsVideoCodecs.length > 0) {
            transcodingProfiles.push({
                Container: 'mp4',
                Type: 'Video',
                AudioCodec: hlsAudioCodecs.join(','),
                VideoCodec: hlsVideoCodecs.join(','),
                Context: 'Streaming',
                Protocol: 'hls',
                MaxAudioChannels: '6',
                MinSegments: '2',
                BreakOnNonKeyFrames: false
            });
            
            // Secondary: HLS in TS container (fallback)
            transcodingProfiles.push({
                Container: 'ts',
                Type: 'Video',
                AudioCodec: hlsAudioCodecs.join(','),
                VideoCodec: hlsVideoCodecs.join(','),
                Context: 'Streaming',
                Protocol: 'hls',
                MaxAudioChannels: '6',
                MinSegments: '2',
                BreakOnNonKeyFrames: false
            });
        }

        // Static transcoding fallback
        transcodingProfiles.push({
            Container: 'mp4',
            Type: 'Video',
            AudioCodec: 'aac,mp3',
            VideoCodec: 'h264',
            Context: 'Static'
        });

        // Build codec profiles with conditions
        var codecProfiles = [];
        
        // H.264 conditions
        codecProfiles.push({
            Type: 'Video',
            Codec: 'h264',
            Conditions: [
                { Condition: 'LessThanEqual', Property: 'Width', Value: String(maxWidth) },
                { Condition: 'LessThanEqual', Property: 'Height', Value: String(maxHeight) },
                { Condition: 'LessThanEqual', Property: 'VideoFramerate', Value: '60' },
                { Condition: 'LessThanEqual', Property: 'VideoBitrate', Value: String(maxBitrate) },
                { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '51' }
            ]
        });
        
        // HEVC conditions (more permissive for 4K HDR)
        if (caps.hevc) {
            codecProfiles.push({
                Type: 'Video',
                Codec: 'hevc',
                Conditions: [
                    { Condition: 'LessThanEqual', Property: 'Width', Value: String(maxWidth) },
                    { Condition: 'LessThanEqual', Property: 'Height', Value: String(maxHeight) },
                    { Condition: 'LessThanEqual', Property: 'VideoFramerate', Value: '60' },
                    { Condition: 'LessThanEqual', Property: 'VideoBitrate', Value: String(maxBitrate) }
                ]
            });
        }

        // Audio channel limit
        codecProfiles.push({
            Type: 'VideoAudio',
            Conditions: [
                { Condition: 'LessThanEqual', Property: 'AudioChannels', Value: '8' }
            ]
        });

        // Subtitle profiles - burn in for compatibility
        var subtitleProfiles = [
            { Format: 'srt', Method: 'Encode' },
            { Format: 'ass', Method: 'Encode' },
            { Format: 'ssa', Method: 'Encode' },
            { Format: 'vtt', Method: 'Encode' },
            { Format: 'sub', Method: 'Encode' },
            { Format: 'subrip', Method: 'Encode' },
            { Format: 'pgssub', Method: 'Encode' }
        ];

        return {
            MaxStreamingBitrate: maxBitrate,
            MaxStaticBitrate: 100000000,
            MusicStreamingTranscodingBitrate: Math.min(maxBitrate, 384000),
            DirectPlayProfiles: directPlayProfiles,
            TranscodingProfiles: transcodingProfiles,
            ContainerProfiles: [],
            CodecProfiles: codecProfiles,
            SubtitleProfiles: subtitleProfiles,
            ResponseProfiles: []
        };
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

    // Public API
    return {
        getProfile: getProfile,
        getCapabilities: getCapabilities,
        shouldUseNativeHls: shouldUseNativeHls,
        shouldUseHlsJs: shouldUseHlsJs,
        getWebOSVersion: getWebOSVersion
    };
})();
