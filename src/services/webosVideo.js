/**
 * webOS Video Service - Hardware-accelerated video playback using Luna APIs
 */

let lunaClient = null;
let isLunaAvailable = false;

export const isWebOS = () => {
	if (typeof window === 'undefined') return false;
	if (typeof window.webOS !== 'undefined') return true;
	const ua = navigator.userAgent.toLowerCase();
	return ua.includes('webos') || ua.includes('web0s');
};

export const getWebOSVersion = () => {
	const ua = navigator.userAgent.toLowerCase();
	const chromeMatch = /chrome\/(\d+)/.exec(ua);
	if (chromeMatch) {
		const chromeVersion = parseInt(chromeMatch[1], 10);
		if (chromeVersion >= 94) return 23;
		if (chromeVersion >= 87) return 22;
		if (chromeVersion >= 79) return 6;
		if (chromeVersion >= 68) return 5;
		if (chromeVersion >= 53) return 4;
		if (chromeVersion >= 38) return 3;
		return 2;
	}
	return 4; // Default assumption
};

export const initLunaAPI = async () => {
	if (!isWebOS()) {
		console.log('[webosVideo] Not on webOS platform');
		return false;
	}

	try {
		const LS2Request = (await import('@enact/webos/LS2Request')).default;
		lunaClient = LS2Request;
		isLunaAvailable = true;
		console.log('[webosVideo] Luna API initialized');
		return true;
	} catch (e) {
		console.warn('[webosVideo] Luna API not available:', e.message);
		return false;
	}
};

const lunaCall = (service, method, parameters = {}) => {
	return new Promise((resolve, reject) => {
		if (!lunaClient) {
			reject(new Error('Luna API not initialized'));
			return;
		}

		// eslint-disable-next-line @babel/new-cap
		new lunaClient().send({
			service: `luna://${service}`,
			method,
			parameters,
			onSuccess: resolve,
			onFailure: (err) => reject(new Error(err.errorText || 'Luna call failed'))
		});
	});
};

const getDefaultCapabilities = () => {
	const webosVersion = getWebOSVersion();
	return {
		webosVersion,
		modelName: 'Unknown',
		uhd: true,
		uhd8K: false,
		oled: false,
		hdr10: webosVersion >= 4,
		dolbyVision: false,
		dolbyAtmos: false,
		hevc: true,
		av1: webosVersion >= 22,
		vp9: webosVersion >= 5,
		dts: webosVersion <= 4 || webosVersion >= 23,
		ac3: true,
		eac3: true,
		truehd: false,
		mkv: webosVersion >= 4,
		nativeHls: webosVersion >= 5,
		nativeHlsFmp4: webosVersion >= 5,
		hlsAc3: webosVersion >= 5
	};
};

export const getMediaCapabilities = async () => {
	if (!isLunaAvailable) {
		return getDefaultCapabilities();
	}

	try {
		const result = await lunaCall('com.webos.service.config', 'getConfigs', {
			configNames: [
				'tv.model.modelName',
				'tv.config.supportDolbyHDRContents',
				'tv.model.supportHDR',
				'tv.hw.supportCodecH265',
				'tv.hw.supportCodecAV1',
				'tv.hw.supportCodecVP9',
				'tv.hw.panelResolution',
				'tv.conti.supportDolbyAtmos',
				'tv.config.supportDolbyAtmos',
				'tv.model.oled',
				'tv.hw.ddrSize'
			]
		});

		const cfg = result.configs || {};
		const webosVersion = getWebOSVersion();

		return {
			webosVersion,
			modelName: cfg['tv.model.modelName'] || 'Unknown',
			uhd: cfg['tv.hw.panelResolution'] === 'UD',
			uhd8K: cfg['tv.hw.panelResolution'] === '8K',
			oled: cfg['tv.model.oled'] === true,
			hdr10: cfg['tv.model.supportHDR'] === true,
			dolbyVision: cfg['tv.config.supportDolbyHDRContents'] === true,
			dolbyAtmos: cfg['tv.conti.supportDolbyAtmos'] === true || cfg['tv.config.supportDolbyAtmos'] === true,
			hevc: cfg['tv.hw.supportCodecH265'] !== false,
			av1: cfg['tv.hw.supportCodecAV1'] === true,
			vp9: cfg['tv.hw.supportCodecVP9'] === true || webosVersion >= 5,
			dts: webosVersion <= 4 || webosVersion >= 23,
			ac3: true,
			eac3: true,
			truehd: cfg['tv.conti.supportDolbyAtmos'] === true,
			mkv: webosVersion >= 4,
			nativeHls: webosVersion >= 5,
			nativeHlsFmp4: webosVersion >= 5,
			hlsAc3: webosVersion >= 5
		};
	} catch (e) {
		console.warn('[webosVideo] Failed to get capabilities:', e.message);
		return getDefaultCapabilities();
	}
};

export const getPlayMethod = (mediaSource, capabilities) => {
	if (!mediaSource) return 'Transcode';

	const container = (mediaSource.Container || '').toLowerCase();
	const videoStream = mediaSource.MediaStreams?.find(s => s.Type === 'Video');
	const audioStream = mediaSource.MediaStreams?.find(s => s.Type === 'Audio');

	const videoCodec = (videoStream?.Codec || '').toLowerCase();
	const supportedVideoCodecs = ['h264', 'avc'];
	if (capabilities.hevc) supportedVideoCodecs.push('hevc', 'h265', 'hev1', 'hvc1');
	if (capabilities.av1) supportedVideoCodecs.push('av1');
	if (capabilities.vp9) supportedVideoCodecs.push('vp9');
	if (capabilities.dolbyVision) supportedVideoCodecs.push('dvhe', 'dvh1');

	const audioCodec = (audioStream?.Codec || '').toLowerCase();
	const supportedAudioCodecs = ['aac', 'mp3', 'flac', 'opus', 'vorbis'];
	if (capabilities.ac3) supportedAudioCodecs.push('ac3');
	if (capabilities.eac3) supportedAudioCodecs.push('eac3');
	if (capabilities.dts) supportedAudioCodecs.push('dts', 'dca');
	if (capabilities.truehd) supportedAudioCodecs.push('truehd');

	const supportedContainers = ['mp4', 'm4v', 'mov', 'ts', 'mpegts'];
	if (capabilities.mkv) supportedContainers.push('mkv', 'matroska');
	if (capabilities.nativeHls) supportedContainers.push('m3u8');

	const videoOk = !videoCodec || supportedVideoCodecs.includes(videoCodec);
	const audioOk = !audioCodec || supportedAudioCodecs.includes(audioCodec);
	const containerOk = !container || supportedContainers.includes(container);

	let hdrOk = true;
	if (videoStream?.VideoRangeType) {
		const rangeType = videoStream.VideoRangeType.toUpperCase();
		if (rangeType.includes('DOLBY') || rangeType.includes('DV')) {
			hdrOk = capabilities.dolbyVision;
		} else if (rangeType.includes('HDR')) {
			hdrOk = capabilities.hdr10;
		}
	}

	console.log('[webosVideo] getPlayMethod check:', {
		container,
		videoCodec,
		audioCodec,
		videoRange: videoStream?.VideoRangeType,
		videoOk,
		audioOk,
		containerOk,
		hdrOk,
		supportedContainers,
		supportedVideoCodecs,
		supportedAudioCodecs,
		serverSupportsDirectPlay: mediaSource.SupportsDirectPlay
	});

	if (mediaSource.SupportsDirectPlay && videoOk && audioOk && containerOk && hdrOk) {
		return 'DirectPlay';
	}

	if (mediaSource.SupportsDirectStream && videoOk && containerOk) {
		return 'DirectStream';
	}

	return 'Transcode';
};

export const getMimeType = (container) => {
	const mimeTypes = {
		mp4: 'video/mp4',
		m4v: 'video/mp4',
		mkv: 'video/x-matroska',
		matroska: 'video/x-matroska',
		webm: 'video/webm',
		ts: 'video/mp2t',
		mpegts: 'video/mp2t',
		m2ts: 'video/mp2t',
		avi: 'video/x-msvideo',
		mov: 'video/quicktime',
		m3u8: 'application/x-mpegURL',
		mpd: 'application/dash+xml'
	};
	return mimeTypes[container?.toLowerCase()] || 'video/mp4';
};

export const setDisplayWindow = async (rect) => {
	if (!isLunaAvailable) return false;

	try {
		await lunaCall('com.webos.service.avoutput', 'video/setDisplayWindow', {
			sourceInput: {
				x: rect.x || 0,
				y: rect.y || 0,
				width: rect.width || 1920,
				height: rect.height || 1080
			},
			outputDestination: {
				x: rect.destX || 0,
				y: rect.destY || 0,
				width: rect.destWidth || 1920,
				height: rect.destHeight || 1080
			}
		});
		return true;
	} catch (e) {
		console.warn('[webosVideo] setDisplayWindow failed:', e.message);
		return false;
	}
};

export const registerAppStateObserver = (onForeground, onBackground) => {
	if (typeof document === 'undefined') return () => {};

	const handleVisibilityChange = () => {
		if (document.hidden) {
			onBackground?.();
		} else {
			onForeground?.();
		}
	};

	document.addEventListener('visibilitychange', handleVisibilityChange);
	document.addEventListener('webOSRelaunch', onForeground);

	return () => {
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		document.removeEventListener('webOSRelaunch', onForeground);
	};
};

export const keepScreenOn = async (enable) => {
	if (!isLunaAvailable) return true;

	try {
		await lunaCall('com.webos.service.power', 'state', {
			state: enable ? 'Active' : 'ActiveStandby'
		});
		return true;
	} catch {
		return true;
	}
};

export const getAudioOutputInfo = async () => {
	if (!isLunaAvailable) return null;

	try {
		const result = await lunaCall('com.webos.service.avoutput', 'audio/getStatus', {});
		return result;
	} catch (e) {
		return null;
	}
};

export default {
	isWebOS,
	getWebOSVersion,
	initLunaAPI,
	getMediaCapabilities,
	getPlayMethod,
	getMimeType,
	setDisplayWindow,
	registerAppStateObserver,
	keepScreenOn,
	getAudioOutputInfo
};
