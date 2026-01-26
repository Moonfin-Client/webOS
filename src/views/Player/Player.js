import {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import Button from '@enact/sandstone/Button';
import * as playback from '../../services/playback';
import {initLunaAPI, registerAppStateObserver, keepScreenOn} from '../../services/webosVideo';
import {useSettings} from '../../context/SettingsContext';
import TrickplayPreview from '../../components/TrickplayPreview';

import css from './Player.module.less';

const SpottableButton = Spottable('button');
const SpottableDiv = Spottable('div');

const formatTime = (seconds) => {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);

	if (h > 0) {
		return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}
	return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatEndTime = (remainingSeconds) => {
	const now = new Date();
	now.setSeconds(now.getSeconds() + remainingSeconds);
	const hours = now.getHours();
	const minutes = now.getMinutes();
	const ampm = hours >= 12 ? 'PM' : 'AM';
	const h12 = hours % 12 || 12;
	return `Ends at ${h12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

// Playback speed options
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Quality presets (bitrate in bps)
const QUALITY_PRESETS = [
	{label: 'Auto', value: null},
	{label: '4K (60 Mbps)', value: 60000000, minRes: 3840},
	{label: '1080p (20 Mbps)', value: 20000000, minRes: 1920},
	{label: '1080p (10 Mbps)', value: 10000000, minRes: 1920},
	{label: '720p (8 Mbps)', value: 8000000, minRes: 1280},
	{label: '720p (4 Mbps)', value: 4000000, minRes: 1280},
	{label: '480p (2 Mbps)', value: 2000000, minRes: 854},
	{label: '360p (1 Mbps)', value: 1000000, minRes: 640}
];

const CONTROLS_HIDE_DELAY = 5000;

// SVG Icon components
const IconPlay = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="M320-200v-560l440 280-440 280Zm80-280Zm0 134 210-134-210-134v268Z"/>
	</svg>
);

const IconPause = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="M520-200v-560h240v560H520Zm-320 0v-560h240v560H200Zm400-80h80v-400h-80v400Zm-320 0h80v-400h-80v400Zm0-400v400-400Zm320 0v400-400Z"/>
	</svg>
);

const IconRewind = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="M860-240 500-480l360-240v480Zm-400 0L100-480l360-240v480Zm-80-240Zm400 0Zm-400 90v-180l-136 90 136 90Zm400 0v-180l-136 90 136 90Z"/>
	</svg>
);

const IconForward = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="M100-240v-480l360 240-360 240Zm400 0v-480l360 240-360 240ZM180-480Zm400 0Zm-400 90 136-90-136-90v180Zm400 0 136-90-136-90v180Z"/>
	</svg>
);

const IconSubtitle = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="M200-160q-33 0-56.5-23.5T120-240v-480q0-33 23.5-56.5T200-800h560q33 0 56.5 23.5T840-720v480q0 33-23.5 56.5T760-160H200Zm0-80h560v-480H200v480Zm80-120h120q17 0 28.5-11.5T440-400v-40h-60v20h-80v-120h80v20h60v-40q0-17-11.5-28.5T400-600H280q-17 0-28.5 11.5T240-560v160q0 17 11.5 28.5T280-360Zm280 0h120q17 0 28.5-11.5T720-400v-40h-60v20h-80v-120h80v20h60v-40q0-17-11.5-28.5T680-600H560q-17 0-28.5 11.5T520-560v160q0 17 11.5 28.5T560-360ZM200-240v-480 480Z"/>
	</svg>
);

const IconPlayMode = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="M170-228q-38-44-61-98T80-440h82q6 44 22 83.5t42 72.5l-56 56ZM80-520q8-60 30-114t60-98l56 56q-26 33-42 72.5T162-520H80ZM438-82q-60-6-113.5-29T226-170l56-58q35 26 73.5 43t82.5 23v80ZM284-732l-58-58q45-36 98.5-59T440-878v80q-45 6-84 23t-72 43Zm96 432v-360l280 180-280 180ZM520-82v-80q121-17 200.5-107T800-480q0-121-79.5-211T520-798v-80q154 17 257 130t103 268q0 155-103 268T520-82Z"/>
	</svg>
);

const IconAudio = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="M560-131v-82q90-26 145-100t55-168q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 127-78 224.5T560-131ZM120-360v-240h160l200-200v640L280-360H120Zm440 40v-322q47 22 73.5 66t26.5 96q0 51-26.5 94.5T560-320ZM400-606l-86 86H200v80h114l86 86v-252ZM300-480Z"/>
	</svg>
);

const IconChapters = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="M320-280q17 0 28.5-11.5T360-320v-320q0-17-11.5-28.5T320-680q-17 0-28.5 11.5T280-640v320q0 17 11.5 28.5T320-280Zm160 0q17 0 28.5-11.5T520-320v-320q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v320q0 17 11.5 28.5T480-280Zm160 0q17 0 28.5-11.5T680-320v-320q0-17-11.5-28.5T640-680q-17 0-28.5 11.5T600-640v320q0 17 11.5 28.5T640-280ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/>
	</svg>
);

const IconPrevious = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="M220-240v-480h80v480h-80Zm520 0L380-480l360-240v480Zm-80-240Zm0 90v-180l-136 90 136 90Z"/>
	</svg>
);

const IconNext = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="M660-240v-480h80v480h-80Zm-440 0v-480l360 240-360 240Zm80-240Zm0 90 136-90-136-90v180Z"/>
	</svg>
);

const IconSpeed = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="M418-340q24 24 62 23.5t56-27.5l224-336-336 224q-27 18-28.5 55t22.5 61Zm62-460q59 0 113.5 16.5T696-734l-76 48q-33-17-68.5-25.5T480-720q-133 0-226.5 93.5T160-400q0 42 11.5 83t32.5 77h552q23-38 33.5-79t10.5-85q0-36-8.5-70T766-540l48-76q30 47 48 100.5T880-400q0 90-34.5 167T752-120H208q-59-59-93.5-136T80-400q0-83 31.5-156T197-669q54-54 127-85.5T480-786Zm0 386Z"/>
	</svg>
);

const IconQuality = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/>
	</svg>
);

const IconInfo = () => (
	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
		<path d="M160-120v-720h80v80h80v-80h320v80h80v-80h80v720h-80v-80h-80v80H320v-80h-80v80h-80Zm80-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm400 320h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80ZM400-200h160v-560H400v560Zm0-560h160-160Z"/>
	</svg>
);
const SKIP_SECONDS = 10;

const Player = ({item, onEnded, onBack, onPlayNext}) => {
	const {settings} = useSettings();

	const [mediaUrl, setMediaUrl] = useState(null);
	// eslint-disable-next-line no-unused-vars
	const [mimeType, setMimeType] = useState('video/mp4');
	const [isLoading, setIsLoading] = useState(true);
	const [isBuffering, setIsBuffering] = useState(false);
	const [error, setError] = useState(null);
	const [title, setTitle] = useState('');
	const [subtitle, setSubtitle] = useState('');
	const [playMethod, setPlayMethod] = useState(null);
	const [isPaused, setIsPaused] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [audioStreams, setAudioStreams] = useState([]);
	const [subtitleStreams, setSubtitleStreams] = useState([]);
	const [chapters, setChapters] = useState([]);
	const [selectedAudioIndex, setSelectedAudioIndex] = useState(null);
	const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(-1);
	const [subtitleUrl, setSubtitleUrl] = useState(null);
	const [controlsVisible, setControlsVisible] = useState(false);
	const [activeModal, setActiveModal] = useState(null);
	const [playbackRate, setPlaybackRate] = useState(1);
	const [selectedQuality, setSelectedQuality] = useState(null);
	const [mediaSegments, setMediaSegments] = useState(null);
	const [showSkipIntro, setShowSkipIntro] = useState(false);
	const [showSkipCredits, setShowSkipCredits] = useState(false);
	const [nextEpisode, setNextEpisode] = useState(null);
	const [showNextEpisode, setShowNextEpisode] = useState(false);
	const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(null);
	const [isSeeking, setIsSeeking] = useState(false);
	const [seekPosition, setSeekPosition] = useState(0);
	const [mediaSourceId, setMediaSourceId] = useState(null);
	const [hasTriedTranscode, setHasTriedTranscode] = useState(false);
	const [focusRow, setFocusRow] = useState('top');

	const videoRef = useRef(null);
	const positionRef = useRef(0);
	const playSessionRef = useRef(null);
	const runTimeRef = useRef(0);
	const healthMonitorRef = useRef(null);
	const nextEpisodeTimerRef = useRef(null);
	const unregisterAppStateRef = useRef(null);
	const controlsTimeoutRef = useRef(null);

	const topButtons = useMemo(() => [
		{id: 'playPause', icon: isPaused ? <IconPlay /> : <IconPause />, label: isPaused ? 'Play' : 'Pause', action: 'playPause'},
		{id: 'rewind', icon: <IconRewind />, label: 'Rewind', action: 'rewind'},
		{id: 'forward', icon: <IconForward />, label: 'Forward', action: 'forward'},
		{id: 'audio', icon: <IconAudio />, label: 'Audio', action: 'audio', disabled: audioStreams.length === 0},
		{id: 'subtitle', icon: <IconSubtitle />, label: 'Subtitles', action: 'subtitle', disabled: subtitleStreams.length === 0},
		{id: 'playMode', icon: <IconPlayMode />, label: 'Play Mode', action: 'quality'}
	], [isPaused, audioStreams.length, subtitleStreams.length]);

	const bottomButtons = useMemo(() => [
		{id: 'chapters', icon: <IconChapters />, label: 'Chapters', action: 'chapter', disabled: chapters.length === 0},
		{id: 'previous', icon: <IconPrevious />, label: 'Previous', action: 'previous', disabled: true},
		{id: 'next', icon: <IconNext />, label: 'Next', action: 'next', disabled: !nextEpisode},
		{id: 'speed', icon: <IconSpeed />, label: 'Speed', action: 'speed'},
		{id: 'quality', icon: <IconQuality />, label: 'Quality', action: 'quality'},
		{id: 'info', icon: <IconInfo />, label: 'Info', action: 'info'}
	], [chapters.length, nextEpisode]);

	useEffect(() => {
		const init = async () => {
			await initLunaAPI();
			await keepScreenOn(true);

			unregisterAppStateRef.current = registerAppStateObserver(
				() => {
					console.log('[Player] App resumed');
					if (videoRef.current && !isPaused) {
						videoRef.current.play();
					}
				},
				() => {
					console.log('[Player] App backgrounded');
				}
			);
		};
		init();

		return () => {
			keepScreenOn(false);
			if (unregisterAppStateRef.current) {
				unregisterAppStateRef.current();
			}
		};
	}, [isPaused]);

	useEffect(() => {
		const loadMedia = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const startPosition = item.UserData?.PlaybackPositionTicks || 0;
				const result = await playback.getPlaybackInfo(item.Id, {
					startPositionTicks: startPosition,
					maxBitrate: selectedQuality || settings.maxBitrate
				});

				setMediaUrl(result.url);
				setMimeType(result.mimeType || 'video/mp4');
				setPlayMethod(result.playMethod);
				setMediaSourceId(result.mediaSourceId);
				playSessionRef.current = result.playSessionId;
				positionRef.current = startPosition;
				runTimeRef.current = result.runTimeTicks || 0;
				setDuration((result.runTimeTicks || 0) / 10000000);

				// Set streams
				setAudioStreams(result.audioStreams || []);
				setSubtitleStreams(result.subtitleStreams || []);
				setChapters(result.chapters || []);

				// Default audio
				const defaultAudio = result.audioStreams?.find(s => s.isDefault);
				if (defaultAudio) setSelectedAudioIndex(defaultAudio.index);

				// Handle subtitles based on settings
				if (settings.subtitleMode === 'always') {
					const defaultSub = result.subtitleStreams?.find(s => s.isDefault);
					if (defaultSub) {
						setSelectedSubtitleIndex(defaultSub.index);
						setSubtitleUrl(playback.getSubtitleUrl(defaultSub));
					}
				} else if (settings.subtitleMode === 'forced') {
					const forcedSub = result.subtitleStreams?.find(s => s.isForced);
					if (forcedSub) {
						setSelectedSubtitleIndex(forcedSub.index);
						setSubtitleUrl(playback.getSubtitleUrl(forcedSub));
					}
				}

				// Build title and subtitle
				let displayTitle = item.Name;
				let displaySubtitle = '';
				if (item.SeriesName) {
					displayTitle = item.SeriesName;
					displaySubtitle = `S${item.ParentIndexNumber}E${item.IndexNumber} - ${item.Name}`;
				}
				setTitle(displayTitle);
				setSubtitle(displaySubtitle);

				// Load media segments (intro/credits markers)
				if (settings.skipIntro) {
					const segments = await playback.getMediaSegments(item.Id);
					setMediaSegments(segments);
				}

				// Load next episode for TV shows
				if (item.Type === 'Episode') {
					const next = await playback.getNextEpisode(item);
					setNextEpisode(next);
				}

				console.log(`[Player] Loaded ${displayTitle} via ${result.playMethod}`);
			} catch (err) {
				console.error('[Player] Failed to load media:', err);
				setError(err.message || 'Failed to load media');
			} finally {
				setIsLoading(false);
			}
		};

		loadMedia();

		return () => {
			playback.stopProgressReporting();
			playback.stopHealthMonitoring();
			if (nextEpisodeTimerRef.current) {
				clearInterval(nextEpisodeTimerRef.current);
			}
			if (controlsTimeoutRef.current) {
				clearTimeout(controlsTimeoutRef.current);
			}
		};
	}, [item, selectedQuality, settings.maxBitrate, settings.subtitleMode, settings.skipIntro]);

	// Controls auto-hide
	const showControls = useCallback(() => {
		setControlsVisible(true);
		if (controlsTimeoutRef.current) {
			clearTimeout(controlsTimeoutRef.current);
		}
		controlsTimeoutRef.current = setTimeout(() => {
			if (!activeModal) {
				setControlsVisible(false);
			}
		}, CONTROLS_HIDE_DELAY);
	}, [activeModal]);

	const hideControls = useCallback(() => {
		setControlsVisible(false);
		if (controlsTimeoutRef.current) {
			clearTimeout(controlsTimeoutRef.current);
		}
	}, []);

	// Handle playback health issues
	const handleUnhealthy = useCallback(async () => {
		console.log('[Player] Playback unhealthy, falling back to transcode');
	}, []);

	// Cancel next episode countdown
	const cancelNextEpisodeCountdown = useCallback(() => {
		if (nextEpisodeTimerRef.current) {
			clearInterval(nextEpisodeTimerRef.current);
			nextEpisodeTimerRef.current = null;
		}
		setNextEpisodeCountdown(null);
		setShowNextEpisode(false);
		setShowSkipCredits(false);
	}, []);

	// Play next episode
	const handlePlayNextEpisode = useCallback(async () => {
		if (nextEpisode && onPlayNext) {
			cancelNextEpisodeCountdown();
			await playback.reportStop(positionRef.current);
			onPlayNext(nextEpisode);
		}
	}, [nextEpisode, onPlayNext, cancelNextEpisodeCountdown]);

	// Start countdown to next episode
	const startNextEpisodeCountdown = useCallback(() => {
		if (nextEpisodeTimerRef.current) return;

		let countdown = 15;
		setNextEpisodeCountdown(countdown);

		nextEpisodeTimerRef.current = setInterval(() => {
			countdown--;
			setNextEpisodeCountdown(countdown);

			if (countdown <= 0) {
				clearInterval(nextEpisodeTimerRef.current);
				nextEpisodeTimerRef.current = null;
				handlePlayNextEpisode();
			}
		}, 1000);
	}, [handlePlayNextEpisode]);

	// Video event handlers
	const handleLoadedMetadata = useCallback(() => {
		if (videoRef.current) {
			setDuration(videoRef.current.duration);
			// Seek to start position if resuming
			if (positionRef.current > 0) {
				videoRef.current.currentTime = positionRef.current / 10000000;
			}
		}
	}, []);

	const handlePlay = useCallback(() => {
		setIsPaused(false);
		playback.reportStart(positionRef.current);
		playback.startProgressReporting(() => positionRef.current);
		playback.startHealthMonitoring(handleUnhealthy);
		healthMonitorRef.current = playback.getHealthMonitor();
	}, [handleUnhealthy]);

	const handlePause = useCallback(() => {
		setIsPaused(true);
	}, []);

	const handleTimeUpdate = useCallback(() => {
		if (videoRef.current) {
			const time = videoRef.current.currentTime;
			setCurrentTime(time);
			const ticks = Math.floor(time * 10000000);
			positionRef.current = ticks;

			if (healthMonitorRef.current) {
				healthMonitorRef.current.recordProgress();
			}

			// Check for intro skip
			if (mediaSegments && settings.skipIntro) {
				const {introStart, introEnd, creditsStart} = mediaSegments;

				if (introStart && introEnd) {
					const inIntro = ticks >= introStart && ticks < introEnd;
					setShowSkipIntro(inIntro);
				}

				if (creditsStart && nextEpisode) {
					const inCredits = ticks >= creditsStart;
					if (inCredits && !showSkipCredits) {
						setShowSkipCredits(true);
						startNextEpisodeCountdown();
					}
				}
			}

			// Near end of video
			if (nextEpisode && runTimeRef.current > 0) {
				const remaining = runTimeRef.current - ticks;
				const nearEnd = remaining < 300000000;
				if (nearEnd && !showNextEpisode && !showSkipCredits) {
					setShowNextEpisode(true);
					startNextEpisodeCountdown();
				}
			}
		}
	}, [mediaSegments, settings.skipIntro, nextEpisode, showSkipCredits, showNextEpisode, startNextEpisodeCountdown]);

	const handleWaiting = useCallback(() => {
		setIsBuffering(true);
		if (healthMonitorRef.current) {
			healthMonitorRef.current.recordBuffer();
		}
	}, []);

	const handlePlaying = useCallback(() => {
		setIsBuffering(false);
	}, []);

	const handleEnded = useCallback(async () => {
		await playback.reportStop(positionRef.current);
		if (nextEpisode && onPlayNext) {
			onPlayNext(nextEpisode);
		} else {
			onEnded?.();
		}
	}, [onEnded, onPlayNext, nextEpisode]);

	const handleError = useCallback(async () => {
		console.error('[Player] Playback error');

		if (!hasTriedTranscode && playMethod !== playback.PlayMethod.Transcode) {
			console.log('[Player] DirectPlay failed, falling back to transcode...');
			setHasTriedTranscode(true);

			try {
				const result = await playback.getPlaybackInfo(item.Id, {
					startPositionTicks: positionRef.current,
					maxBitrate: selectedQuality || settings.maxBitrate,
					enableDirectPlay: false,
					enableDirectStream: false,
					enableTranscoding: true
				});

				if (result.url) {
					setMediaUrl(result.url);
					setPlayMethod(result.playMethod);
					playSessionRef.current = result.playSessionId;
					return;
				}
			} catch (fallbackErr) {
				console.error('[Player] Transcode fallback failed:', fallbackErr);
			}
		}

		setError('Playback failed. The file format may not be supported.');
	}, [hasTriedTranscode, playMethod, item.Id, selectedQuality, settings.maxBitrate]);

	// Handle back button
	const handleBack = useCallback(async () => {
		cancelNextEpisodeCountdown();
		await playback.reportStop(positionRef.current);
		onBack?.();
	}, [onBack, cancelNextEpisodeCountdown]);

	// Control actions
	const handlePlayPause = useCallback(() => {
		if (videoRef.current) {
			if (isPaused) {
				videoRef.current.play();
			} else {
				videoRef.current.pause();
			}
		}
	}, [isPaused]);

	const handleRewind = useCallback(() => {
		if (videoRef.current) {
			videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - SKIP_SECONDS);
		}
	}, []);

	const handleForward = useCallback(() => {
		if (videoRef.current) {
			videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + SKIP_SECONDS);
		}
	}, [duration]);

	const handleSkipIntro = useCallback(() => {
		if (mediaSegments?.introEnd && videoRef.current) {
			videoRef.current.currentTime = mediaSegments.introEnd / 10000000;
		}
		setShowSkipIntro(false);
	}, [mediaSegments]);

	// Modal handlers
	const openModal = useCallback((modal) => {
		setActiveModal(modal);
	}, []);

	const closeModal = useCallback(() => {
		setActiveModal(null);
		showControls();
	}, [showControls]);

	// Track selection - using data attributes to avoid arrow functions in JSX
	const handleSelectAudio = useCallback(async (e) => {
		const index = parseInt(e.currentTarget.dataset.index, 10);
		if (isNaN(index)) return;
		setSelectedAudioIndex(index);
		closeModal();

		if (playMethod === playback.PlayMethod.Transcode) {
			try {
				const result = await playback.changeAudioStream(index);
				if (result) {
					setMediaUrl(result.url);
				}
			} catch (err) {
				console.error('[Player] Failed to change audio:', err);
			}
		}
	}, [playMethod, closeModal]);

	const handleSelectSubtitle = useCallback((e) => {
		const index = parseInt(e.currentTarget.dataset.index, 10);
		if (isNaN(index)) return;
		if (index === -1) {
			setSelectedSubtitleIndex(-1);
			setSubtitleUrl(null);
		} else {
			setSelectedSubtitleIndex(index);
			const stream = subtitleStreams.find(s => s.index === index);
			setSubtitleUrl(stream ? playback.getSubtitleUrl(stream) : null);
		}
		closeModal();
	}, [subtitleStreams, closeModal]);

	const handleSelectSpeed = useCallback((e) => {
		const rate = parseFloat(e.currentTarget.dataset.rate);
		if (isNaN(rate)) return;
		setPlaybackRate(rate);
		if (videoRef.current) {
			videoRef.current.playbackRate = rate;
		}
		closeModal();
	}, [closeModal]);

	const handleSelectQuality = useCallback((e) => {
		const valueStr = e.currentTarget.dataset.value;
		const value = valueStr === 'null' ? null : parseInt(valueStr, 10);
		setSelectedQuality(isNaN(value) ? null : value);
		closeModal();
	}, [closeModal]);

	const handleSelectChapter = useCallback((e) => {
		const ticks = parseInt(e.currentTarget.dataset.ticks, 10);
		if (isNaN(ticks)) return;
		if (videoRef.current && ticks >= 0) {
			videoRef.current.currentTime = ticks / 10000000;
		}
		closeModal();
	}, [closeModal]);

	// Progress bar seeking
	const handleProgressClick = useCallback((e) => {
		if (!videoRef.current) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		const newTime = percent * duration;
		videoRef.current.currentTime = newTime;
	}, [duration]);

	// Progress bar keyboard control
	const handleProgressKeyDown = useCallback((e) => {
		if (!videoRef.current) return;
		const step = 10;

		if (e.key === 'ArrowLeft' || e.keyCode === 37) {
			e.preventDefault();
			setIsSeeking(true);
			const newTime = Math.max(0, videoRef.current.currentTime - step);
			setSeekPosition(Math.floor(newTime * 10000000));
			videoRef.current.currentTime = newTime;
		} else if (e.key === 'ArrowRight' || e.keyCode === 39) {
			e.preventDefault();
			setIsSeeking(true);
			const newTime = Math.min(duration, videoRef.current.currentTime + step);
			setSeekPosition(Math.floor(newTime * 10000000));
			videoRef.current.currentTime = newTime;
		} else if (e.key === 'ArrowUp' || e.keyCode === 38) {
			e.preventDefault();
			setFocusRow('top');
			setIsSeeking(false);
		} else if (e.key === 'ArrowDown' || e.keyCode === 40) {
			e.preventDefault();
			setFocusRow('bottom');
			setIsSeeking(false);
		}
	}, [duration]);

	const handleProgressBlur = useCallback(() => {
		setIsSeeking(false);
	}, []);

	// Button action handler
	const handleButtonAction = useCallback((action) => {
		showControls();
		switch (action) {
			case 'playPause': handlePlayPause(); break;
			case 'rewind': handleRewind(); break;
			case 'forward': handleForward(); break;
			case 'audio': openModal('audio'); break;
			case 'subtitle': openModal('subtitle'); break;
			case 'speed': openModal('speed'); break;
			case 'quality': openModal('quality'); break;
			case 'chapter': openModal('chapter'); break;
			case 'info': openModal('info'); break;
			case 'next': handlePlayNextEpisode(); break;
			default: break;
		}
	}, [showControls, handlePlayPause, handleRewind, handleForward, openModal, handlePlayNextEpisode]);

	// Wrapper for control button clicks - reads action from data attribute
	const handleControlButtonClick = useCallback((e) => {
		const action = e.currentTarget.dataset.action;
		if (action) {
			handleButtonAction(action);
		}
	}, [handleButtonAction]);

	// Prevent propagation handler for modals
	const stopPropagation = useCallback((e) => {
		e.stopPropagation();
	}, []);

	// Global key handler
	useEffect(() => {
		const handleKeyDown = (e) => {
			const key = e.key || e.keyCode;

			// Back button
			if (key === 'GoBack' || key === 'Backspace' || e.keyCode === 461 || e.keyCode === 8) {
				if (activeModal) {
					e.preventDefault();
					closeModal();
					return;
				}
				if (controlsVisible) {
					e.preventDefault();
					hideControls();
					return;
				}
				handleBack();
				return;
			}

			// Any key shows controls if hidden
			if (!controlsVisible && !activeModal) {
				e.preventDefault();
				showControls();
				return;
			}

			// Up/Down arrow navigation between rows when controls are visible
			if (controlsVisible && !activeModal) {
				if (key === 'ArrowUp' || e.keyCode === 38) {
					e.preventDefault();
					setFocusRow(prev => {
						if (prev === 'bottom') return 'progress';
						if (prev === 'progress') return 'top';
						return 'top'; // Already at top, stay there
					});
					return;
				}
				if (key === 'ArrowDown' || e.keyCode === 40) {
					e.preventDefault();
					setFocusRow(prev => {
						if (prev === 'top') return 'progress';
						if (prev === 'progress') return 'bottom';
						return 'bottom'; // Already at bottom, stay there
					});
					return;
				}
			}

			// Play/Pause with Enter when controls not focused
			if ((key === 'Enter' || e.keyCode === 13) && !controlsVisible) {
				handlePlayPause();
				return;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [controlsVisible, activeModal, closeModal, hideControls, handleBack, showControls, handlePlayPause]);

	// Calculate progress
	const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

	// Render loading
	if (isLoading) {
		return (
			<div className={css.container}>
				<div className={css.loadingIndicator}>
					<div className={css.spinner} />
					<p>Loading...</p>
				</div>
			</div>
		);
	}

	// Render error
	if (error) {
		return (
			<div className={css.container}>
				<div className={css.error}>
					<h2>Playback Error</h2>
					<p>{error}</p>
					<Button onClick={onBack}>Go Back</Button>
				</div>
			</div>
		);
	}

	return (
		<div className={css.container} onClick={showControls}>
			{/* Video Element - Hardware accelerated on webOS */}
			<video
				ref={videoRef}
				className={css.videoPlayer}
				src={mediaUrl}
				autoPlay
				onLoadedMetadata={handleLoadedMetadata}
				onPlay={handlePlay}
				onPause={handlePause}
				onTimeUpdate={handleTimeUpdate}
				onWaiting={handleWaiting}
				onPlaying={handlePlaying}
				onEnded={handleEnded}
				onError={handleError}
			>
				{subtitleUrl && <track kind="subtitles" src={subtitleUrl} default />}
			</video>

			{/* Video Dimmer */}
			<div className={`${css.videoDimmer} ${controlsVisible ? css.visible : ''}`} />

			{/* Buffering Indicator */}
			{isBuffering && (
				<div className={css.bufferingIndicator}>
					<div className={css.spinner} />
				</div>
			)}

			{/* Playback Indicators */}
			{playbackRate !== 1 && (
				<div className={css.playbackIndicators}>
					<div className={css.speedIndicator}>{playbackRate}x</div>
				</div>
			)}

			{/* Skip Intro Button */}
			{showSkipIntro && !activeModal && (
				<div className={css.skipOverlay}>
					<SpottableButton className={css.skipButton} onClick={handleSkipIntro}>
						Skip Intro
					</SpottableButton>
				</div>
			)}

			{/* Next Episode Overlay */}
			{(showSkipCredits || showNextEpisode) && nextEpisode && !activeModal && (
				<div className={css.nextEpisodeOverlay}>
					<div className={css.nextLabel}>Up Next</div>
					<div className={css.nextTitle}>{nextEpisode.Name}</div>
					{nextEpisode.SeriesName && (
						<div className={css.nextMeta}>
							S{nextEpisode.ParentIndexNumber}E{nextEpisode.IndexNumber}
						</div>
					)}
					{nextEpisodeCountdown !== null && (
						<div className={css.nextCountdown}>
							Starting in {nextEpisodeCountdown}s
						</div>
					)}
					<div className={css.nextButtons}>
						<Button onClick={handlePlayNextEpisode}>Play Now</Button>
						<Button onClick={cancelNextEpisodeCountdown}>Cancel</Button>
					</div>
				</div>
			)}

			{/* Player Controls Overlay */}
			<div className={`${css.playerControls} ${controlsVisible && !activeModal ? css.visible : ''}`}>
				{/* Top - Media Info */}
				<div className={css.controlsTop}>
					<div className={css.mediaInfo}>
						<h1 className={css.mediaTitle}>{title}</h1>
						{subtitle && <p className={css.mediaSubtitle}>{subtitle}</p>}
					</div>
				</div>

				{/* Bottom - Controls */}
				<div className={css.controlsBottom}>
					{/* Top Row Buttons */}
					<div className={css.controlButtons}>
						{topButtons.map((btn) => (
							<SpottableButton
								key={btn.id}
								className={css.controlBtn}
							data-action={btn.action}
							onClick={handleControlButtonClick}
								disabled={btn.disabled}
								aria-label={btn.label}
								spotlightDisabled={focusRow !== 'top'}
							>
								{btn.icon}
							</SpottableButton>
						))}
					</div>

					{/* Progress Bar */}
					<div className={css.progressContainer}>
						<div className={css.timeInfoTop}>
							<span className={css.timeEnd}>{formatEndTime(duration - currentTime)}</span>
						</div>
						<SpottableDiv
							className={css.progressBar}
							onClick={handleProgressClick}
							onKeyDown={handleProgressKeyDown}
							onBlur={handleProgressBlur}
							tabIndex={0}
							spotlightDisabled={focusRow !== 'progress'}
						>
							<div className={css.progressFill} style={{width: `${progressPercent}%`}} />
							<div className={css.seekIndicator} style={{left: `${progressPercent}%`}} />
							{isSeeking && (
								<TrickplayPreview
									itemId={item.Id}
									mediaSourceId={mediaSourceId}
									positionTicks={seekPosition}
									visible
									style={{left: `${progressPercent}%`}}
								/>
							)}
						</SpottableDiv>
						<div className={css.timeInfo}>
							<span className={css.timeDisplay}>
								{formatTime(currentTime)} / {formatTime(duration)}
							</span>
						</div>
					</div>

					{/* Bottom Row Buttons */}
					<div className={css.controlButtonsBottom}>
						{bottomButtons.map((btn) => (
							<SpottableButton
								key={btn.id}
								className={css.controlBtn}
							data-action={btn.action}
							onClick={handleControlButtonClick}
								disabled={btn.disabled}
								aria-label={btn.label}
								spotlightDisabled={focusRow !== 'bottom'}
							>
								{btn.icon}
							</SpottableButton>
						))}
					</div>
				</div>
			</div>

			{/* Audio Track Modal */}
			{activeModal === 'audio' && (
				<div className={css.trackModal} onClick={closeModal}>
					<div className={css.modalContent} onClick={stopPropagation}>
						<h2 className={css.modalTitle}>Select Audio Track</h2>
						<div className={css.trackList}>
							{audioStreams.map((stream) => (
								<SpottableButton
									key={stream.index}
									className={`${css.trackItem} ${stream.index === selectedAudioIndex ? css.selected : ''}`}
									data-index={stream.index}
									onClick={handleSelectAudio}
								>
									<span className={css.trackName}>{stream.displayTitle}</span>
									{stream.channels && <span className={css.trackInfo}>{stream.channels}ch</span>}
								</SpottableButton>
							))}
						</div>
						<p className={css.modalFooter}>Press BACK to close</p>
					</div>
				</div>
			)}

			{/* Subtitle Modal */}
			{activeModal === 'subtitle' && (
				<div className={css.trackModal} onClick={closeModal}>
					<div className={css.modalContent} onClick={stopPropagation}>
						<h2 className={css.modalTitle}>Select Subtitle</h2>
						<div className={css.trackList}>
							<SpottableButton
								className={`${css.trackItem} ${selectedSubtitleIndex === -1 ? css.selected : ''}`}
								data-index={-1}
								onClick={handleSelectSubtitle}
							>
								<span className={css.trackName}>Off</span>
							</SpottableButton>
							{subtitleStreams.map((stream) => (
								<SpottableButton
									key={stream.index}
									className={`${css.trackItem} ${stream.index === selectedSubtitleIndex ? css.selected : ''}`}
									data-index={stream.index}
									onClick={handleSelectSubtitle}
								>
									<span className={css.trackName}>{stream.displayTitle}</span>
									{stream.isForced && <span className={css.trackInfo}>Forced</span>}
								</SpottableButton>
							))}
						</div>
						<p className={css.modalFooter}>Press BACK to close</p>
					</div>
				</div>
			)}

			{/* Speed Modal */}
			{activeModal === 'speed' && (
				<div className={css.trackModal} onClick={closeModal}>
					<div className={css.modalContent} onClick={stopPropagation}>
						<h2 className={css.modalTitle}>Playback Speed</h2>
						<div className={css.trackList}>
							{PLAYBACK_RATES.map((rate) => (
								<SpottableButton
									key={rate}
									className={`${css.trackItem} ${rate === playbackRate ? css.selected : ''}`}
									data-rate={rate}
									onClick={handleSelectSpeed}
								>
									<span className={css.trackName}>{rate === 1 ? 'Normal' : `${rate}x`}</span>
								</SpottableButton>
							))}
						</div>
						<p className={css.modalFooter}>Press BACK to close</p>
					</div>
				</div>
			)}

			{/* Quality Modal */}
			{activeModal === 'quality' && (
				<div className={css.trackModal} onClick={closeModal}>
					<div className={css.modalContent} onClick={stopPropagation}>
						<h2 className={css.modalTitle}>Max Bitrate</h2>
						<div className={css.trackList}>
							{QUALITY_PRESETS.map((preset) => (
								<SpottableButton
									key={preset.label}
									className={`${css.trackItem} ${selectedQuality === preset.value ? css.selected : ''}`}
									data-value={preset.value === null ? 'null' : preset.value}
									onClick={handleSelectQuality}
								>
									<span className={css.trackName}>{preset.label}</span>
								</SpottableButton>
							))}
						</div>
						<p className={css.modalFooter}>Current: {playMethod || 'Unknown'}</p>
					</div>
				</div>
			)}

			{/* Chapter Modal */}
			{activeModal === 'chapter' && (
				<div className={css.trackModal} onClick={closeModal}>
					<div className={`${css.modalContent} ${css.chaptersModal}`} onClick={stopPropagation}>
						<h2 className={css.modalTitle}>Chapters</h2>
						<div className={css.trackList}>
							{chapters.map((chapter) => {
								const chapterTime = chapter.startPositionTicks / 10000000;
								const isCurrent = currentTime >= chapterTime &&
									(chapters.indexOf(chapter) === chapters.length - 1 ||
									 currentTime < chapters[chapters.indexOf(chapter) + 1].startPositionTicks / 10000000);
								return (
									<SpottableButton
										key={chapter.index}
										className={`${css.chapterItem} ${isCurrent ? css.currentChapter : ''}`}
										data-ticks={chapter.startPositionTicks}
										onClick={handleSelectChapter}
									>
										<span className={css.chapterTime}>{formatTime(chapterTime)}</span>
										<span className={css.chapterName}>{chapter.name}</span>
									</SpottableButton>
								);
							})}
						</div>
						<p className={css.modalFooter}>Press BACK to close</p>
					</div>
				</div>
			)}

			{/* Info Modal */}
			{activeModal === 'info' && (
				<div className={css.trackModal} onClick={closeModal}>
					<div className={`${css.modalContent} ${css.videoInfoModal}`} onClick={stopPropagation}>
						<h2 className={css.modalTitle}>Playback Information</h2>
						<div className={css.videoInfoContent}>
							<div className={css.infoSection}>
								<h3 className={css.infoHeader}>Playback</h3>
								<div className={css.infoRow}>
									<span className={css.infoLabel}>Play Method</span>
									<span className={css.infoValue}>{playMethod || 'Unknown'}</span>
								</div>
								<div className={css.infoRow}>
									<span className={css.infoLabel}>Container</span>
									<span className={css.infoValue}>
										{playback.getCurrentSession()?.mediaSource?.Container || 'Unknown'}
									</span>
								</div>
								<div className={css.infoRow}>
									<span className={css.infoLabel}>Session ID</span>
									<span className={css.infoValue}>
										{playSessionRef.current?.substring(0, 8) || 'N/A'}
									</span>
								</div>
							</div>
							{audioStreams.find(s => s.index === selectedAudioIndex) && (
								<div className={css.infoSection}>
									<h3 className={css.infoHeader}>Audio</h3>
									<div className={css.infoRow}>
										<span className={css.infoLabel}>Track</span>
										<span className={css.infoValue}>
											{audioStreams.find(s => s.index === selectedAudioIndex)?.displayTitle}
										</span>
									</div>
								</div>
							)}
						</div>
						<p className={css.modalFooter}>Press BACK to close</p>
					</div>
				</div>
			)}
		</div>
	);
};

export default Player;
