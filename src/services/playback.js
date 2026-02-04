import * as jellyfinApi from './jellyfinApi';
import {getJellyfinDeviceProfile, getDeviceCapabilities} from './deviceProfile';
import {getPlayMethod, getMimeType} from './webosVideo';

export const PlayMethod = {
	DirectPlay: 'DirectPlay',
	DirectStream: 'DirectStream',
	Transcode: 'Transcode'
};

let currentSession = null;
let progressInterval = null;
let healthMonitor = null;

const selectMediaSource = (mediaSources, capabilities, options) => {
	if (options.mediaSourceId) {
		const source = mediaSources.find(s => s.Id === options.mediaSourceId);
		if (source) return source;
	}

	const scored = mediaSources.map(source => {
		let score = 0;
		const playMethodResult = getPlayMethod(source, capabilities);

		if (playMethodResult === PlayMethod.DirectPlay) score += 1000;
		else if (playMethodResult === PlayMethod.DirectStream) score += 500;

		if (source.SupportsDirectPlay) score += 200;
		if (source.SupportsDirectStream) score += 100;

		const videoStream = source.MediaStreams?.find(s => s.Type === 'Video');
		if (videoStream) {
			if (videoStream.Width >= 3840) score += 20;
			else if (videoStream.Width >= 1920) score += 15;
			else if (videoStream.Width >= 1280) score += 10;
		}

		if (videoStream?.VideoRangeType) {
			const rangeType = videoStream.VideoRangeType.toUpperCase();
			if (rangeType.includes('DOLBY') && capabilities.dolbyVision) score += 10;
			else if (rangeType.includes('HDR') && capabilities.hdr10) score += 5;
		}

		const audioStream = source.MediaStreams?.find(s => s.Type === 'Audio');
		if (audioStream) {
			if (audioStream.Codec === 'truehd' && capabilities.truehd) score += 15;
			else if (audioStream.Codec === 'eac3') score += 10;
			else if (audioStream.Codec === 'ac3') score += 8;
			else if (audioStream.Channels >= 6) score += 5;
		}

		console.log('[playback] Media source scored:', {
			id: source.Id,
			container: source.Container,
			score,
			playMethod: playMethodResult,
			serverDirectPlay: source.SupportsDirectPlay,
			serverDirectStream: source.SupportsDirectStream
		});

		return {source, score, playMethod: playMethodResult};
	});

	scored.sort((a, b) => b.score - a.score);
	console.log('[playback] Selected media source:', scored[0].source.Id, 'with score:', scored[0].score);
	return scored[0].source;
};

const determinePlayMethod = (mediaSource, capabilities) => {
	// First check what our client-side capability check says
	const computedMethod = getPlayMethod(mediaSource, capabilities);
	console.log('[playback] determinePlayMethod - computed:', computedMethod,
		'serverDirectPlay:', mediaSource.SupportsDirectPlay,
		'serverDirectStream:', mediaSource.SupportsDirectStream,
		'hasTranscodingUrl:', !!mediaSource.TranscodingUrl);

	// If client says we need transcode, we MUST transcode
	// Don't fall back to DirectStream if audio/video isn't compatible
	if (computedMethod === PlayMethod.Transcode) {
		return PlayMethod.Transcode;
	}

	// Client says DirectPlay is OK
	if (computedMethod === PlayMethod.DirectPlay && mediaSource.SupportsDirectPlay) {
		return PlayMethod.DirectPlay;
	}

	// Client says DirectStream is OK
	if (computedMethod === PlayMethod.DirectStream && mediaSource.SupportsDirectStream) {
		return PlayMethod.DirectStream;
	}

	// Fallback
	if (mediaSource.SupportsDirectStream) {
		return PlayMethod.DirectStream;
	}

	return PlayMethod.Transcode;
};

const buildPlaybackUrl = (itemId, mediaSource, playSessionId, playMethod) => {
	const serverUrl = jellyfinApi.getServerUrl();
	const apiKey = jellyfinApi.getApiKey();
	const deviceId = jellyfinApi.getDeviceId();
	const container = (mediaSource.Container || '').toLowerCase();

	console.log('[playback] buildPlaybackUrl:', {
		itemId,
		mediaSourceId: mediaSource?.Id,
		playSessionId,
		playMethod,
		container,
		serverUrl,
		apiKeyType: typeof apiKey,
		apiKeyLength: apiKey?.length
	});

	if (playMethod === PlayMethod.DirectPlay) {
		const params = new URLSearchParams();
		params.append('Static', 'true');
		params.append('mediaSourceId', mediaSource.Id);
		params.append('deviceId', deviceId);
		params.append('api_key', apiKey);
		// Include ETag if available
		if (mediaSource.ETag) {
			params.append('Tag', mediaSource.ETag);
		}
		// Include LiveStreamId if available
		if (mediaSource.LiveStreamId) {
			params.append('LiveStreamId', mediaSource.LiveStreamId);
		}
		// Include container extension for proper MIME type detection
		const url = `${serverUrl}/Videos/${itemId}/stream.${container}?${params.toString()}`;
		console.log('[playback] DirectPlay URL:', url);
		return url;
	}

	if (playMethod === PlayMethod.DirectStream) {
		if (mediaSource.DirectStreamUrl) {
			const url = mediaSource.DirectStreamUrl.startsWith('http')
				? mediaSource.DirectStreamUrl
				: `${serverUrl}${mediaSource.DirectStreamUrl}`;
			return url.includes('api_key') ? url : `${url}&api_key=${apiKey}`;
		}
	}

	if (mediaSource.TranscodingUrl) {
		let transcodeUrl = mediaSource.TranscodingUrl;

		// Clean up any malformed query string (e.g., ?& or &&)
		transcodeUrl = transcodeUrl.replace(/\?&/g, '?').replace(/&&/g, '&');

		const url = transcodeUrl.startsWith('http')
			? transcodeUrl
			: `${serverUrl}${transcodeUrl}`;
		return url.includes('api_key') ? url : `${url}&api_key=${apiKey}`;
	}

	throw new Error('No playback URL available');
};

const extractAudioStreams = (mediaSource) => {
	if (!mediaSource.MediaStreams) return [];
	return mediaSource.MediaStreams
		.filter(s => s.Type === 'Audio')
		.map(s => ({
			index: s.Index,
			codec: s.Codec,
			language: s.Language || 'Unknown',
			displayTitle: s.DisplayTitle || `${s.Language || 'Unknown'} (${s.Codec})`,
			channels: s.Channels,
			channelLayout: s.ChannelLayout,
			bitRate: s.BitRate,
			sampleRate: s.SampleRate,
			isDefault: s.IsDefault,
			isForced: s.IsForced
		}));
};

const extractSubtitleStreams = (mediaSource) => {
	if (!mediaSource.MediaStreams) return [];
	const serverUrl = jellyfinApi.getServerUrl();

	return mediaSource.MediaStreams
		.filter(s => s.Type === 'Subtitle')
		.map(s => {
			let deliveryUrl = null;
			if (s.DeliveryUrl) {
				// External URLs are used as-is, internal URLs need server prefix
				deliveryUrl = s.IsExternalUrl ? s.DeliveryUrl : `${serverUrl}${s.DeliveryUrl}`;
			}
			return {
				index: s.Index,
				codec: s.Codec,
				language: s.Language || 'Unknown',
				displayTitle: s.DisplayTitle || s.Language || 'Unknown',
				isExternal: s.IsExternal,
				isForced: s.IsForced,
				isDefault: s.IsDefault,
				// Text-based subtitle codecs that can be rendered client-side
				// subrip = srt, webvtt = vtt, sami = smi
				isTextBased: ['srt', 'subrip', 'vtt', 'webvtt', 'ass', 'ssa', 'sub', 'smi', 'sami'].includes(s.Codec?.toLowerCase()),
				deliveryUrl: deliveryUrl,
				deliveryMethod: s.DeliveryMethod
			};
		});
};

const extractChapters = (mediaSource) => {
	if (!mediaSource.Chapters) return [];
	return mediaSource.Chapters.map((c, i) => ({
		index: i,
		name: c.Name || `Chapter ${i + 1}`,
		startPositionTicks: c.StartPositionTicks,
		imageTag: c.ImageTag
	}));
};

// Default bitrate for transcoding: 20 Mbps (reasonable for 1080p content)
const DEFAULT_MAX_BITRATE = 20000000;

export const getPlaybackInfo = async (itemId, options = {}) => {
	const deviceProfile = await getJellyfinDeviceProfile();
	const capabilities = await getDeviceCapabilities();

	// Use provided bitrate or default (0 means no limit for direct play, but we need a limit for transcode)
	const maxBitrate = options.maxBitrate || DEFAULT_MAX_BITRATE;

	// webOS 5 has issues with FFmpeg transcodes that start from a non-zero position
	// (causes "unfixable negative timestamp" errors). For webOS 5 transcodes,
	// we request from position 0 and do client-side seeking after load.
	const requestedStartTime = options.startPositionTicks || 0;
	const isWebOS5 = capabilities.webosVersion === 5;
	const needsTranscode = options.enableDirectPlay === false || options.enableDirectStream === false;
	const useClientSideSeek = isWebOS5 && needsTranscode && requestedStartTime > 0;

	// For webOS 5 transcodes with resume, request from 0 to avoid negative timestamp issues
	const apiStartTime = useClientSideSeek ? 0 : requestedStartTime;

	if (useClientSideSeek) {
		console.log('[playback] webOS 5 transcode with resume - will use client-side seek from', requestedStartTime);
	}

	let playbackInfo = await jellyfinApi.api.getPlaybackInfo(itemId, {
		DeviceProfile: deviceProfile,
		StartTimeTicks: apiStartTime,
		AutoOpenLiveStream: true,
		EnableDirectPlay: options.enableDirectPlay !== false,
		EnableDirectStream: options.enableDirectStream !== false,
		EnableTranscoding: options.enableTranscoding !== false,
		AudioStreamIndex: options.audioStreamIndex,
		SubtitleStreamIndex: options.subtitleStreamIndex,
		MaxStreamingBitrate: maxBitrate,
		MediaSourceId: options.mediaSourceId
	});

	if (!playbackInfo.MediaSources?.length) {
		throw new Error('No playable media source found');
	}

	let mediaSource = selectMediaSource(playbackInfo.MediaSources, capabilities, options);
	let playMethod = determinePlayMethod(mediaSource, capabilities);

	// Check again if this will actually be a transcode and we're on webOS 5
	const willTranscode = playMethod === PlayMethod.Transcode;
	const clientSeekRequired = isWebOS5 && willTranscode && requestedStartTime > 0;

	if (clientSeekRequired && !useClientSideSeek) {
		// We didn't anticipate needing a transcode, but now we do
		// Re-request from position 0
		console.log('[playback] webOS 5 transcode detected after initial request - re-requesting from position 0');
		playbackInfo = await jellyfinApi.api.getPlaybackInfo(itemId, {
			DeviceProfile: deviceProfile,
			StartTimeTicks: 0,
			AutoOpenLiveStream: true,
			EnableDirectPlay: false,
			EnableDirectStream: false,
			EnableTranscoding: true,
			AudioStreamIndex: options.audioStreamIndex,
			SubtitleStreamIndex: options.subtitleStreamIndex,
			MaxStreamingBitrate: maxBitrate,
			MediaSourceId: options.mediaSourceId
		});

		if (!playbackInfo.MediaSources?.length) {
			throw new Error('No playable media source found');
		}

		mediaSource = playbackInfo.MediaSources[0];
		playMethod = PlayMethod.Transcode;
	}

	// Log video stream info including HDR type
	const videoStream = mediaSource.MediaStreams?.find(s => s.Type === 'Video');
	console.log('[playback] Video stream info:', {
		codec: videoStream?.Codec,
		profile: videoStream?.Profile,
		level: videoStream?.Level,
		width: videoStream?.Width,
		height: videoStream?.Height,
		videoRangeType: videoStream?.VideoRangeType,
		colorPrimaries: videoStream?.ColorPrimaries,
		colorTransfer: videoStream?.ColorTransfer,
		colorSpace: videoStream?.ColorSpace,
		bitDepth: videoStream?.BitDepth
	});
	console.log('[playback] HDR capabilities:', {
		hdr10: capabilities.hdr10,
		hlg: capabilities.hlg,
		dolbyVision: capabilities.dolbyVision
	});

	// If we determined we need transcoding but server didn't provide a TranscodingUrl,
	// re-request with DirectPlay/DirectStream disabled to force transcoding
	if (playMethod === PlayMethod.Transcode && !mediaSource.TranscodingUrl) {
		// For webOS 5, always request from position 0 for transcodes
		const forceStartTime = isWebOS5 ? 0 : (options.startPositionTicks || 0);
		console.log('[playback] Need transcode but no TranscodingUrl - re-requesting with transcoding forced');
		playbackInfo = await jellyfinApi.api.getPlaybackInfo(itemId, {
			DeviceProfile: deviceProfile,
			StartTimeTicks: forceStartTime,
			AutoOpenLiveStream: true,
			EnableDirectPlay: false,
			EnableDirectStream: false,
			EnableTranscoding: true,
			AudioStreamIndex: options.audioStreamIndex,
			SubtitleStreamIndex: options.subtitleStreamIndex,
			MaxStreamingBitrate: maxBitrate,
			MediaSourceId: options.mediaSourceId
		});

		if (!playbackInfo.MediaSources?.length) {
			throw new Error('No playable media source found after forcing transcode');
		}

		mediaSource = playbackInfo.MediaSources[0];
		playMethod = PlayMethod.Transcode;
		console.log('[playback] After forcing transcode - TranscodingUrl:', mediaSource.TranscodingUrl ? 'present' : 'none');
	}

	// Determine if client needs to seek after load (webOS 5 transcode resume workaround)
	const finalClientSeekRequired = isWebOS5 && playMethod === PlayMethod.Transcode && requestedStartTime > 0;
	if (finalClientSeekRequired) {
		console.log('[playback] Client-side seek required to position:', requestedStartTime);
	}

	const url = buildPlaybackUrl(itemId, mediaSource, playbackInfo.PlaySessionId, playMethod);
	const audioStreams = extractAudioStreams(mediaSource);
	const subtitleStreams = extractSubtitleStreams(mediaSource);
	const chapters = extractChapters(mediaSource);

	currentSession = {
		itemId,
		playSessionId: playbackInfo.PlaySessionId,
		mediaSourceId: mediaSource.Id,
		mediaSource,
		playMethod,
		startPositionTicks: options.startPositionTicks || 0,
		capabilities,
		audioStreamIndex: options.audioStreamIndex ?? mediaSource.DefaultAudioStreamIndex,
		subtitleStreamIndex: options.subtitleStreamIndex ?? mediaSource.DefaultSubtitleStreamIndex,
		maxBitrate: options.maxBitrate
	};

	console.log(`[playback] Playing ${itemId} via ${playMethod}`);

	let mimeType;
	if (playMethod === PlayMethod.Transcode) {
		if (url.includes('/master.m3u8') || url.includes('TranscodingProtocol=hls')) {
			mimeType = 'application/x-mpegURL';
		} else if (url.includes('.ts') || mediaSource.TranscodingContainer === 'ts') {
			mimeType = 'video/mp2t';
		} else {
			mimeType = 'video/mp4';
		}
	} else {
		mimeType = getMimeType(mediaSource.Container);
	}

	return {
		url,
		playSessionId: playbackInfo.PlaySessionId,
		mediaSourceId: mediaSource.Id,
		mediaSource,
		playMethod,
		mimeType,
		runTimeTicks: mediaSource.RunTimeTicks,
		audioStreams,
		subtitleStreams,
		chapters,
		defaultAudioStreamIndex: mediaSource.DefaultAudioStreamIndex,
		defaultSubtitleStreamIndex: mediaSource.DefaultSubtitleStreamIndex,
		// webOS 5 workaround: if true, player must seek to clientSeekPositionTicks after video loads
		clientSeekRequired: finalClientSeekRequired,
		clientSeekPositionTicks: finalClientSeekRequired ? requestedStartTime : 0
	};
};

export const getPlaybackInfoWithFallback = async (itemId, options = {}) => {
	try {
		return await getPlaybackInfo(itemId, options);
	} catch (error) {
		console.warn('[playback] Primary playback failed, trying fallback:', error.message);

		return await getPlaybackInfo(itemId, {
			...options,
			enableDirectPlay: false,
			enableDirectStream: false
		});
	}
};

export const getSubtitleUrl = (subtitleStream) => {
	if (!subtitleStream || !currentSession) return null;

	const {itemId, mediaSourceId} = currentSession;
	const serverUrl = jellyfinApi.getServerUrl();
	const apiKey = jellyfinApi.getApiKey();

	// Request WebVTT for any text-based subtitle - server converts ASS/SSA/SRT as needed
	if (subtitleStream.isTextBased) {
		return `${serverUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${subtitleStream.index}/Stream.vtt?api_key=${apiKey}`;
	}

	return null;
};

/**
 * Fetch subtitle track events as JSON data for custom rendering
 * This is required on webOS because native <track> elements don't work reliably
 * The .js format returns JSON with TrackEvents array containing StartPositionTicks, EndPositionTicks, Text
 */
export const fetchSubtitleData = async (subtitleStream) => {
	if (!subtitleStream || !currentSession) return null;

	const {itemId, mediaSourceId} = currentSession;
	const serverUrl = jellyfinApi.getServerUrl();
	const apiKey = jellyfinApi.getApiKey();

	if (!subtitleStream.isTextBased) {
		console.log('[Playback] Subtitle stream is not text-based, cannot fetch as JSON');
		return null;
	}

	// Jellyfin returns JSON when requesting .js format instead of .vtt
	const url = `${serverUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${subtitleStream.index}/Stream.js?api_key=${apiKey}`;

	try {
		console.log('[Playback] Fetching subtitle data from:', url);
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch subtitles: ${response.status}`);
		}
		const data = await response.json();
		console.log(`[Playback] Loaded ${data.TrackEvents?.length || 0} subtitle events`);
		return data;
	} catch (err) {
		console.error('[Playback] Failed to fetch subtitle data:', err);
		return null;
	}
};

export const getChapterImageUrl = (itemId, chapterIndex, width = 320) => {
	const serverUrl = jellyfinApi.getServerUrl();
	const apiKey = jellyfinApi.getApiKey();
	return `${serverUrl}/Items/${itemId}/Images/Chapter/${chapterIndex}?maxWidth=${width}&api_key=${apiKey}`;
};

export const getTrickplayInfo = async (itemId) => {
	try {
		const serverUrl = jellyfinApi.getServerUrl();
		const apiKey = jellyfinApi.getApiKey();
		const response = await fetch(`${serverUrl}/Videos/${itemId}/Trickplay?api_key=${apiKey}`);
		if (response.ok) {
			return response.json();
		}
	} catch (e) { void e; }
	return null;
};

export const getMediaSegments = async (itemId) => {
	try {
		const item = await jellyfinApi.api.getItem(itemId);
		const segments = {
			introStart: null,
			introEnd: null,
			creditsStart: null
		};

		if (item.Chapters) {
			const introIndex = item.Chapters.findIndex(c =>
				c.MarkerType === 'IntroStart' ||
				c.Name?.toLowerCase().includes('intro')
			);
			if (introIndex >= 0) {
				segments.introStart = item.Chapters[introIndex].StartPositionTicks;
				if (introIndex + 1 < item.Chapters.length) {
					segments.introEnd = item.Chapters[introIndex + 1].StartPositionTicks;
				} else {
					segments.introEnd = segments.introStart + 1200000000; // 2 minutes
				}
			}

			const creditsChapter = item.Chapters.find(c =>
				c.MarkerType === 'Credits' ||
				c.Name?.toLowerCase().includes('credit')
			);
			if (creditsChapter) {
				segments.creditsStart = creditsChapter.StartPositionTicks;
			}
		}

		return segments;
	} catch (e) {
		return {introStart: null, introEnd: null, creditsStart: null};
	}
};

export const getNextEpisode = async (item) => {
	if (item.Type !== 'Episode' || !item.SeriesId) return null;
	try {
		const result = await jellyfinApi.api.getNextEpisode(item.SeriesId, item.Id);
		return result.Items?.[0] || null;
	} catch (e) {
		return null;
	}
};

export const changeAudioStream = async (streamIndex) => {
	if (!currentSession) return null;

	const newInfo = await getPlaybackInfo(currentSession.itemId, {
		...currentSession,
		audioStreamIndex: streamIndex
	});

	return newInfo;
};

export const changeSubtitleStream = async (streamIndex) => {
	if (!currentSession) return null;

	const newInfo = await getPlaybackInfo(currentSession.itemId, {
		...currentSession,
		subtitleStreamIndex: streamIndex
	});

	return newInfo;
};

export const reportStart = async (positionTicks = 0) => {
	if (!currentSession) return;

	try {
		await jellyfinApi.api.reportPlaybackStart({
			ItemId: currentSession.itemId,
			PlaySessionId: currentSession.playSessionId,
			MediaSourceId: currentSession.mediaSourceId,
			PositionTicks: positionTicks,
			CanSeek: true,
			IsPaused: false,
			IsMuted: false,
			PlayMethod: currentSession.playMethod,
			RepeatMode: 'RepeatNone'
		});
	} catch (e) {
		console.warn('[playback] Failed to report start:', e.message);
	}
};

export const reportProgress = async (positionTicks, options = {}) => {
	if (!currentSession) return;

	try {
		await jellyfinApi.api.reportPlaybackProgress({
			ItemId: currentSession.itemId,
			PlaySessionId: currentSession.playSessionId,
			MediaSourceId: currentSession.mediaSourceId,
			PositionTicks: positionTicks,
			CanSeek: true,
			IsPaused: options.isPaused || false,
			IsMuted: options.isMuted || false,
			PlayMethod: currentSession.playMethod,
			AudioStreamIndex: currentSession.audioStreamIndex,
			SubtitleStreamIndex: currentSession.subtitleStreamIndex
		});
	} catch (e) { void e; }
};

export const stopProgressReporting = () => {
	if (progressInterval) {
		clearInterval(progressInterval);
		progressInterval = null;
	}
};

export const stopHealthMonitoring = () => {
	if (healthMonitor) {
		clearInterval(healthMonitor);
		healthMonitor = null;
	}
};

export const reportStop = async (positionTicks) => {
	if (!currentSession) return;

	stopProgressReporting();
	stopHealthMonitoring();

	try {
		await jellyfinApi.api.reportPlaybackStopped({
			ItemId: currentSession.itemId,
			PlaySessionId: currentSession.playSessionId,
			MediaSourceId: currentSession.mediaSourceId,
			PositionTicks: positionTicks
		});
	} catch (e) {
		console.warn('[playback] Failed to report stop:', e.message);
	}

	currentSession = null;
};

export const startProgressReporting = (getPositionTicks, intervalMs = 10000) => {
	stopProgressReporting();

	progressInterval = setInterval(async () => {
		const ticks = getPositionTicks();
		if (ticks !== null && ticks !== undefined) {
			await reportProgress(ticks);
		}
	}, intervalMs);
};

class PlaybackHealthMonitor {
	constructor() {
		this.stallCount = 0;
		this.bufferEvents = [];
		this.lastProgressTime = Date.now();
		this.isHealthy = true;
	}

	recordBuffer() {
		this.bufferEvents.push(Date.now());
		const cutoff = Date.now() - 30000;
		this.bufferEvents = this.bufferEvents.filter(t => t > cutoff);

		if (this.bufferEvents.length > 5) {
			this.isHealthy = false;
		}
	}

	recordStall() {
		this.stallCount++;
		if (this.stallCount > 3) {
			this.isHealthy = false;
		}
	}

	recordProgress() {
		this.lastProgressTime = Date.now();
	}

	checkHealth() {
		if (Date.now() - this.lastProgressTime > 30000) {
			this.isHealthy = false;
		}
		return this.isHealthy;
	}

	reset() {
		this.stallCount = 0;
		this.bufferEvents = [];
		this.lastProgressTime = Date.now();
		this.isHealthy = true;
	}

	shouldFallbackToTranscode() {
		return !this.isHealthy && currentSession?.playMethod !== PlayMethod.Transcode;
	}
}

let healthMonitorInstance = null;

export const getHealthMonitor = () => {
	if (!healthMonitorInstance) {
		healthMonitorInstance = new PlaybackHealthMonitor();
	}
	return healthMonitorInstance;
};

export const startHealthMonitoring = (onUnhealthy) => {
	stopHealthMonitoring();

	const monitor = getHealthMonitor();
	monitor.reset();

	healthMonitor = setInterval(() => {
		if (!monitor.checkHealth()) {
			if (onUnhealthy && monitor.shouldFallbackToTranscode()) {
				onUnhealthy();
			}
		}
	}, 5000);
};

export const getCurrentSession = () => currentSession;

export const isDirectPlay = () => currentSession?.playMethod === PlayMethod.DirectPlay;

export const getPlaybackUrl = async (itemId, startPositionTicks = 0, options = {}) => {
	return getPlaybackInfo(itemId, {...options, startPositionTicks});
};

export const getIntroMarkers = getMediaSegments;

export default {
	PlayMethod,
	getPlaybackInfo,
	getPlaybackInfoWithFallback,
	getPlaybackUrl,
	getSubtitleUrl,
	getChapterImageUrl,
	getTrickplayInfo,
	getMediaSegments,
	getIntroMarkers,
	getNextEpisode,
	changeAudioStream,
	changeSubtitleStream,
	reportStart,
	reportProgress,
	reportStop,
	startProgressReporting,
	stopProgressReporting,
	getHealthMonitor,
	startHealthMonitoring,
	stopHealthMonitoring,
	getCurrentSession,
	isDirectPlay
};
