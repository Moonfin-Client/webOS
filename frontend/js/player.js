var PlayerController = (function() {
    'use strict';

    let auth = null;
    let itemId = null;
    let itemData = null;
    let videoPlayer = null;
    let controlsVisible = false;
    let controlsTimeout = null;
    let playbackInfo = null;
    let playSessionId = null;
    let progressInterval = null;
    let focusableButtons = [];
    let currentFocusIndex = 0;
    let audioStreams = [];
    let subtitleStreams = [];
    let currentAudioIndex = -1;
    let currentSubtitleIndex = -1;
    let modalFocusableItems = [];
    let currentModalFocusIndex = 0;
    let activeModal = null;

    let elements = {};

    // Timing Constants
    const PROGRESS_REPORT_INTERVAL_MS = 10000; // Report every 10 seconds
    const CONTROLS_HIDE_DELAY_MS = 3000;
    const SKIP_INTERVAL_SECONDS = 10;

    function init() {
        JellyfinAPI.Logger.info('Initializing player controller...');
        
        auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            window.location.href = 'login.html';
            return;
        }

        itemId = getItemIdFromUrl();
        if (!itemId) {
            alert('No item ID provided');
            window.history.back();
            return;
        }

        cacheElements();
        setupEventListeners();
        loadItemAndPlay();
    }

    function getItemIdFromUrl() {
        var params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    function cacheElements() {
        elements = {
            videoPlayer: document.getElementById('videoPlayer'),
            playerControls: document.getElementById('playerControls'),
            mediaTitle: document.getElementById('mediaTitle'),
            mediaSubtitle: document.getElementById('mediaSubtitle'),
            progressBar: document.getElementById('progressBar'),
            progressFill: document.getElementById('progressFill'),
            currentTime: document.getElementById('currentTime'),
            totalTime: document.getElementById('totalTime'),
            playPauseBtn: document.getElementById('playPauseBtn'),
            rewindBtn: document.getElementById('rewindBtn'),
            forwardBtn: document.getElementById('forwardBtn'),
            audioBtn: document.getElementById('audioBtn'),
            subtitleBtn: document.getElementById('subtitleBtn'),
            backBtn: document.getElementById('backBtn'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            audioModal: document.getElementById('audioModal'),
            audioTrackList: document.getElementById('audioTrackList'),
            subtitleModal: document.getElementById('subtitleModal'),
            subtitleTrackList: document.getElementById('subtitleTrackList')
        };

        videoPlayer = elements.videoPlayer;
        
        // Create focusable buttons array for navigation
        focusableButtons = [
            elements.playPauseBtn,
            elements.rewindBtn,
            elements.forwardBtn,
            elements.audioBtn,
            elements.subtitleBtn,
            elements.backBtn
        ].filter(Boolean);
    }

    function setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', handleKeyDown);

        // Video player events
        videoPlayer.addEventListener('play', onPlay);
        videoPlayer.addEventListener('pause', onPause);
        videoPlayer.addEventListener('timeupdate', onTimeUpdate);
        videoPlayer.addEventListener('ended', onEnded);
        videoPlayer.addEventListener('error', onError);

        // Control buttons
        if (elements.playPauseBtn) {
            elements.playPauseBtn.addEventListener('click', togglePlayPause);
        }
        if (elements.rewindBtn) {
            elements.rewindBtn.addEventListener('click', rewind);
        }
        if (elements.forwardBtn) {
            elements.forwardBtn.addEventListener('click', forward);
        }
        if (elements.backBtn) {
            elements.backBtn.addEventListener('click', exitPlayer);
        }
        if (elements.audioBtn) {
            elements.audioBtn.addEventListener('click', showAudioTrackSelector);
        }
        if (elements.subtitleBtn) {
            elements.subtitleBtn.addEventListener('click', showSubtitleTrackSelector);
        }

        // Show controls on any interaction
        document.addEventListener('mousemove', showControls);
        document.addEventListener('click', showControls);
    }

    function handleKeyDown(evt) {
        evt = evt || window.event;

        // Handle modal navigation separately
        if (activeModal) {
            handleModalKeyDown(evt);
            return;
        }

        switch (evt.keyCode) {
            case KeyCodes.PLAY_PAUSE:
                evt.preventDefault();
                togglePlayPause();
                break;
                
            case KeyCodes.ENTER:
                // Only toggle play/pause if no button is focused
                if (!document.activeElement || !focusableButtons.includes(document.activeElement)) {
                    evt.preventDefault();
                    togglePlayPause();
                }
                // If a button is focused, let it handle the click naturally
                break;

            case KeyCodes.PLAY:
                evt.preventDefault();
                play();
                break;

            case KeyCodes.PAUSE:
                evt.preventDefault();
                pause();
                break;

            case KeyCodes.REWIND:
                evt.preventDefault();
                if (!document.activeElement || !focusableButtons.includes(document.activeElement)) {
                    rewind();
                }
                break;

            case KeyCodes.FORWARD:
                evt.preventDefault();
                if (!document.activeElement || !focusableButtons.includes(document.activeElement)) {
                    forward();
                }
                break;

            case KeyCodes.BACK:
            case 461: // webOS back button
                evt.preventDefault();
                exitPlayer();
                break;

            case KeyCodes.UP:
                evt.preventDefault();
                showControls();
                break;
                
            case KeyCodes.DOWN:
                evt.preventDefault();
                showControls();
                if (focusableButtons.length > 0) {
                    currentFocusIndex = 0;
                    focusableButtons[currentFocusIndex].focus();
                }
                break;
                
            case KeyCodes.LEFT:
                if (document.activeElement && focusableButtons.includes(document.activeElement)) {
                    evt.preventDefault();
                    currentFocusIndex = (currentFocusIndex - 1 + focusableButtons.length) % focusableButtons.length;
                    focusableButtons[currentFocusIndex].focus();
                }
                break;
                
            case KeyCodes.RIGHT:
                if (document.activeElement && focusableButtons.includes(document.activeElement)) {
                    evt.preventDefault();
                    currentFocusIndex = (currentFocusIndex + 1) % focusableButtons.length;
                    focusableButtons[currentFocusIndex].focus();
                }
                break;
        }
    }

    function handleModalKeyDown(evt) {
        currentModalFocusIndex = TrackSelector.handleModalKeyDown(
            evt,
            modalFocusableItems,
            currentModalFocusIndex,
            closeModal
        );
    }

    function loadItemAndPlay() {
        showLoading();

        var endpoint = '/Users/' + auth.userId + '/Items/' + itemId;
        var params = {
            Fields: 'MediaSources,MediaStreams,Chapters'
        };

        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, endpoint, params, function(err, data) {
            if (err || !data) {
                alert('Failed to load media item');
                window.history.back();
                return;
            }

            itemData = data;
            JellyfinAPI.Logger.info('Loaded item:', itemData.Name);

            // Set media info
            if (elements.mediaTitle) {
                elements.mediaTitle.textContent = itemData.Name;
            }

            if (elements.mediaSubtitle && itemData.Type === 'Episode') {
                var subtitle = '';
                if (itemData.SeriesName) subtitle += itemData.SeriesName;
                if (itemData.SeasonName) subtitle += ' - ' + itemData.SeasonName;
                if (itemData.IndexNumber) subtitle += ' - Episode ' + itemData.IndexNumber;
                elements.mediaSubtitle.textContent = subtitle;
            }

            // Get playback info
            getPlaybackInfo();
        });
    }

    function getPlaybackInfo() {
        var playbackUrl = auth.serverAddress + '/Items/' + itemId + '/PlaybackInfo';
        
        var requestData = {
            UserId: auth.userId,
            DeviceProfile: getDeviceProfile()
        };

        ajax.request(playbackUrl, {
            method: 'POST',
            headers: {
                'X-Emby-Authorization': JellyfinAPI.getAuthHeader(auth.accessToken),
                'Content-Type': 'application/json'
            },
            data: requestData,
            success: function(response) {
                playbackInfo = response;
                JellyfinAPI.Logger.info('Playback info received');
                
                // Start playback
                if (playbackInfo.MediaSources && playbackInfo.MediaSources.length > 0) {
                    startPlayback(playbackInfo.MediaSources[0]);
                } else {
                    alert('No playable media sources found');
                    window.history.back();
                }
            },
            error: function(err) {
                JellyfinAPI.Logger.error('Failed to get playback info:', err);
                alert('Failed to get playback information');
                window.history.back();
            }
        });
    }

    function getDeviceProfile() {
        return {
            MaxStreamingBitrate: 120000000,
            MaxStaticBitrate: 100000000,
            MusicStreamingTranscodingBitrate: 384000,
            DirectPlayProfiles: [
                { Container: 'mp4,m4v', Type: 'Video', VideoCodec: 'h264,hevc', AudioCodec: 'aac,mp3,ac3,eac3' },
                { Container: 'mkv', Type: 'Video', VideoCodec: 'h264,hevc', AudioCodec: 'aac,mp3,ac3,eac3' }
            ],
            TranscodingProfiles: [
                { Container: 'ts', Type: 'Video', AudioCodec: 'aac', VideoCodec: 'h264', Protocol: 'hls' }
            ],
            ContainerProfiles: [],
            CodecProfiles: [],
            SubtitleProfiles: [
                { Format: 'srt', Method: 'External' },
                { Format: 'vtt', Method: 'External' }
            ]
        };
    }

    function startPlayback(mediaSource) {
        playSessionId = generateUUID();
        
        var streamUrl = auth.serverAddress + '/Videos/' + itemId + '/stream';
        var params = new URLSearchParams({
            Static: 'true',
            mediaSourceId: mediaSource.Id,
            deviceId: JellyfinAPI.init(),
            api_key: auth.accessToken,
            PlaySessionId: playSessionId
        });

        var videoUrl = streamUrl + '?' + params.toString();
        
        JellyfinAPI.Logger.info('Starting playback:', videoUrl);
        
        videoPlayer.src = videoUrl;
        videoPlayer.load();
        
        // Check for resume position
        if (itemData.UserData && itemData.UserData.PlaybackPositionTicks > 0) {
            var resumeSeconds = itemData.UserData.PlaybackPositionTicks / 10000000;
            videoPlayer.currentTime = resumeSeconds;
        }
        
        videoPlayer.play().then(function() {
            hideLoading();
            reportPlaybackStart();
            startProgressReporting();
            showControls();
        }).catch(function(error) {
            JellyfinAPI.Logger.error('Playback error:', error);
            hideLoading();
            alert('Failed to start playback: ' + error.message);
        });
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function reportPlaybackStart() {
        var url = auth.serverAddress + '/Sessions/Playing';
        
        ajax.request(url, {
            method: 'POST',
            headers: {
                'X-Emby-Authorization': JellyfinAPI.getAuthHeader(auth.accessToken),
                'Content-Type': 'application/json'
            },
            data: {
                ItemId: itemId,
                PlaySessionId: playSessionId,
                PositionTicks: Math.floor(videoPlayer.currentTime * 10000000),
                IsPaused: videoPlayer.paused,
                IsMuted: videoPlayer.muted,
                VolumeLevel: Math.floor(videoPlayer.volume * 100)
            },
            success: function() {
                JellyfinAPI.Logger.info('Playback start reported');
            },
            error: function(err) {
                JellyfinAPI.Logger.error('Failed to report playback start:', err);
            }
        });
    }

    function reportPlaybackProgress() {
        if (!playSessionId) return;

        var url = auth.serverAddress + '/Sessions/Playing/Progress';
        
        ajax.request(url, {
            method: 'POST',
            headers: {
                'X-Emby-Authorization': JellyfinAPI.getAuthHeader(auth.accessToken),
                'Content-Type': 'application/json'
            },
            data: {
                ItemId: itemId,
                PlaySessionId: playSessionId,
                PositionTicks: Math.floor(videoPlayer.currentTime * 10000000),
                IsPaused: videoPlayer.paused,
                IsMuted: videoPlayer.muted,
                VolumeLevel: Math.floor(videoPlayer.volume * 100)
            },
            success: function() {
                // Silent success
            },
            error: function(err) {
                JellyfinAPI.Logger.warn('Failed to report progress:', err);
            }
        });
    }

    function reportPlaybackStop() {
        if (!playSessionId) return;

        var url = auth.serverAddress + '/Sessions/Playing/Stopped';
        
        ajax.request(url, {
            method: 'POST',
            headers: {
                'X-Emby-Authorization': JellyfinAPI.getAuthHeader(auth.accessToken),
                'Content-Type': 'application/json'
            },
            data: {
                ItemId: itemId,
                PlaySessionId: playSessionId,
                PositionTicks: Math.floor(videoPlayer.currentTime * 10000000)
            },
            success: function() {
                JellyfinAPI.Logger.info('Playback stop reported');
            },
            error: function(err) {
                JellyfinAPI.Logger.error('Failed to report playback stop:', err);
            }
        });
    }

    function startProgressReporting() {
        if (progressInterval) clearInterval(progressInterval);
        
        progressInterval = setInterval(function() {
            reportPlaybackProgress();
        }, PROGRESS_REPORT_INTERVAL_MS);
    }

    function stopProgressReporting() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    function togglePlayPause() {
        if (videoPlayer.paused) {
            play();
        } else {
            pause();
        }
    }

    function play() {
        videoPlayer.play();
        if (elements.playPauseBtn) {
            const icon = elements.playPauseBtn.querySelector('.btn-icon');
            if (icon) icon.src = 'assets/pause.png';
        }
        showControls();
    }

    function pause() {
        videoPlayer.pause();
        if (elements.playPauseBtn) {
            const icon = elements.playPauseBtn.querySelector('.btn-icon');
            if (icon) icon.src = 'assets/play.png';
        }
        showControls();
    }

    function rewind() {
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - SKIP_INTERVAL_SECONDS);
        showControls();
    }

    function forward() {
        videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + SKIP_INTERVAL_SECONDS);
        showControls();
    }

    function showControls() {
        if (elements.playerControls) {
            elements.playerControls.classList.add('visible');
        }

        if (controlsTimeout) clearTimeout(controlsTimeout);
        
        controlsTimeout = setTimeout(function() {
            if (!videoPlayer.paused) {
                hideControls();
            }
        }, CONTROLS_HIDE_DELAY_MS);
    }

    function hideControls() {
        if (elements.playerControls) {
            elements.playerControls.classList.remove('visible');
        }
    }

    function onPlay() {
        JellyfinAPI.Logger.info('Video playing');
    }

    function onPause() {
        JellyfinAPI.Logger.info('Video paused');
    }

    function onTimeUpdate() {
        if (!videoPlayer.duration) return;

        var progress = (videoPlayer.currentTime / videoPlayer.duration) * 100;
        if (elements.progressFill) {
            elements.progressFill.style.width = progress + '%';
        }

        if (elements.currentTime) {
            elements.currentTime.textContent = formatTime(videoPlayer.currentTime);
        }

        if (elements.totalTime) {
            elements.totalTime.textContent = formatTime(videoPlayer.duration);
        }
    }

    function onEnded() {
        JellyfinAPI.Logger.info('Playback ended');
        reportPlaybackStop();
        stopProgressReporting();
        
        // Go back to details page
        window.history.back();
    }

    function onError(evt) {
        JellyfinAPI.Logger.error('Video error:', evt);
        hideLoading();
        alert('Playback error occurred');
    }

    function exitPlayer() {
        reportPlaybackStop();
        stopProgressReporting();
        window.history.back();
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        var hours = Math.floor(seconds / 3600);
        var minutes = Math.floor((seconds % 3600) / 60);
        var secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return hours + ':' + padZero(minutes) + ':' + padZero(secs);
        }
        return minutes + ':' + padZero(secs);
    }

    function padZero(num) {
        return num < 10 ? '0' + num : num;
    }

    function showLoading() {
        if (elements.loadingIndicator) {
            elements.loadingIndicator.style.display = 'flex';
        }
    }

    function hideLoading() {
        if (elements.loadingIndicator) {
            elements.loadingIndicator.style.display = 'none';
        }
    }

    function showAudioTrackSelector() {
        if (!itemData || !itemData.MediaSources || !itemData.MediaSources[0].MediaStreams) {
            return;
        }

        audioStreams = itemData.MediaSources[0].MediaStreams.filter(function(s) {
            return s.Type === 'Audio';
        });

        if (audioStreams.length === 0) {
            return;
        }

        modalFocusableItems = TrackSelector.buildAudioTrackList(
            audioStreams,
            currentAudioIndex,
            elements.audioTrackList,
            selectAudioTrack
        );

        activeModal = 'audio';
        elements.audioModal.style.display = 'flex';
        currentModalFocusIndex = Math.max(0, currentAudioIndex);
        if (modalFocusableItems[currentModalFocusIndex]) {
            modalFocusableItems[currentModalFocusIndex].focus();
        }
    }

    function showSubtitleTrackSelector() {
        if (!itemData || !itemData.MediaSources || !itemData.MediaSources[0].MediaStreams) {
            return;
        }

        subtitleStreams = itemData.MediaSources[0].MediaStreams.filter(function(s) {
            return s.Type === 'Subtitle';
        });

        modalFocusableItems = TrackSelector.buildSubtitleTrackList(
            subtitleStreams,
            currentSubtitleIndex,
            elements.subtitleTrackList,
            selectSubtitleTrack
        );

        activeModal = 'subtitle';
        elements.subtitleModal.style.display = 'flex';
        currentModalFocusIndex = currentSubtitleIndex + 1; // +1 because of "None" option
        if (modalFocusableItems[currentModalFocusIndex]) {
            modalFocusableItems[currentModalFocusIndex].focus();
        }
    }

    function selectAudioTrack(index) {
        if (index < 0 || index >= audioStreams.length) {
            return;
        }

        currentAudioIndex = index;
        var stream = audioStreams[index];
        
        // Update playback to use selected audio track
        var currentTime = videoPlayer.currentTime;
        var wasPaused = videoPlayer.paused;
        
        var streamUrl = auth.serverAddress + '/Videos/' + itemId + '/stream';
        var params = new URLSearchParams({
            Static: 'true',
            mediaSourceId: itemData.MediaSources[0].Id,
            deviceId: JellyfinAPI.init(),
            api_key: auth.accessToken,
            PlaySessionId: playSessionId,
            AudioStreamIndex: stream.Index
        });

        videoPlayer.src = streamUrl + '?' + params.toString();
        videoPlayer.currentTime = currentTime;
        
        if (!wasPaused) {
            videoPlayer.play();
        }

        closeModal();
        JellyfinAPI.Logger.info('Switched to audio track:', stream.Language || stream.Index);
    }

    function selectSubtitleTrack(index) {
        currentSubtitleIndex = index;
        
        // Disable all text tracks
        var tracks = videoPlayer.textTracks;
        for (var i = 0; i < tracks.length; i++) {
            tracks[i].mode = 'disabled';
        }

        if (index >= 0 && index < subtitleStreams.length) {
            var stream = subtitleStreams[index];
            
            // For external subtitles, we need to reload with subtitle parameter
            var currentTime = videoPlayer.currentTime;
            var wasPaused = videoPlayer.paused;
            
            var streamUrl = auth.serverAddress + '/Videos/' + itemId + '/stream';
            var params = new URLSearchParams({
                Static: 'true',
                mediaSourceId: itemData.MediaSources[0].Id,
                deviceId: JellyfinAPI.init(),
                api_key: auth.accessToken,
                PlaySessionId: playSessionId,
                SubtitleStreamIndex: stream.Index
            });

            if (currentAudioIndex >= 0 && currentAudioIndex < audioStreams.length) {
                params.set('AudioStreamIndex', audioStreams[currentAudioIndex].Index);
            }

            videoPlayer.src = streamUrl + '?' + params.toString();
            videoPlayer.currentTime = currentTime;
            
            if (!wasPaused) {
                videoPlayer.play();
            }

            JellyfinAPI.Logger.info('Enabled subtitle track:', stream.Language || stream.Index);
        } else {
            JellyfinAPI.Logger.info('Disabled subtitles');
        }

        closeModal();
    }

    function closeModal() {
        if (elements.audioModal) {
            elements.audioModal.style.display = 'none';
        }
        if (elements.subtitleModal) {
            elements.subtitleModal.style.display = 'none';
        }
        activeModal = null;
        modalFocusableItems = [];
    }

    return {
        init: init
    };
})();

window.addEventListener('load', function() {
    PlayerController.init();
});
