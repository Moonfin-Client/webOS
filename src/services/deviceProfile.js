/**
 * Device Profile Service - Detects webOS hardware capabilities
 *
 * IMPORTANT: webOS uses native media pipeline, NOT browser-based playback.
 * canPlayType() is unreliable - use Luna APIs and documented specs instead.
 */

let cachedCapabilities = null;

export const clearCapabilitiesCache = () => {
	cachedCapabilities = null;
};

const CHROME_TO_WEBOS = [
	[94, 23], [87, 22], [79, 6], [68, 5], [53, 4], [38, 3], [34, 2], [26, 1]
];

const getWebOSVersionFromChrome = (chromeVersion) => {
	for (const [chrome, webos] of CHROME_TO_WEBOS) {
		if (chromeVersion >= chrome) return webos;
	}
	return 4; // Default
};

export const detectWebOSVersion = (sdkVersion = null) => {
	if (sdkVersion) {
		const match = /^(\d+)\./.exec(sdkVersion);
		if (match) {
			const major = parseInt(match[1], 10);
			if (major >= 1 && major <= 23) return major;
		}
	}

	const ua = navigator.userAgent.toLowerCase();
	const chromeMatch = /chrome\/(\d+)/.exec(ua);
	if (chromeMatch) {
		return getWebOSVersionFromChrome(parseInt(chromeMatch[1], 10));
	}
	return 4;
};

const getDocumentedContainerSupport = (webosVersion) => {
	const supported = {
		mp4: true,
		m4v: true,
		ts: true,
		mov: false,
		avi: false,
		webm: false,
		mkv: false,
		hls: false
	};

	if (webosVersion >= 4) {
		supported.mkv = true;
	}

	if (webosVersion >= 5) {
		supported.webm = true;
		supported.hls = true;
	}

	console.log(`[deviceProfile] webOS ${webosVersion} documented container support:`, supported);
	return supported;
};

export const testHevcSupport = (lunaResult = null, webosVersion = 4) => {
	if (lunaResult === true) return true;
	if (lunaResult === false) return false;
	return webosVersion >= 3;
};

export const testAv1Support = (lunaResult = null, webosVersion = 4) => {
	if (lunaResult === true) return true;
	if (lunaResult === false) return false;
	return webosVersion >= 22;
};

export const testVp9Support = (lunaResult = null, webosVersion = 4) => {
	if (lunaResult === true) return true;
	if (lunaResult === false) return false;
	return webosVersion >= 4;
};

export const testDtsSupport = (webosVersion) => {
	return webosVersion <= 4 || webosVersion >= 23;
};

export const testAc3Support = () => true;

export const getDeviceCapabilities = async () => {
	if (cachedCapabilities) return cachedCapabilities;

	let deviceInfoData = {};
	let configData = {};

	// Get device info from webOS SDK
	try {
		const deviceInfo = await import('@enact/webos/deviceinfo');
		deviceInfoData = await new Promise(resolve => deviceInfo.default(resolve));
	} catch (e) { void e; }

	// Get config from Luna API
	try {
		const LS2Request = (await import('@enact/webos/LS2Request')).default;
		configData = await new Promise((resolve) => {
			new LS2Request().send({
				service: 'luna://com.webos.service.config',
				method: 'getConfigs',
				parameters: {
					configNames: [
						'tv.model.modelName',
						'tv.model.serialnumber',
						'tv.config.supportDolbyHDRContents',
						'tv.model.supportHDR',
						'tv.hw.supportCodecH265',
						'tv.hw.supportCodecAV1',
						'tv.hw.supportCodecVP9',
						'tv.hw.panelResolution',
						'tv.hw.ddrSize',
						'tv.conti.supportDolbyAtmos',
						'tv.config.supportDolbyAtmos',
						'tv.model.oled',
						'tv.nvm.support.edid.hdr10plus',
						'tv.config.supportHLG'
					]
				},
				onSuccess: resolve,
				onFailure: () => resolve({configs: {}})
			});
		});
	} catch (e) { void e; }

	const cfg = configData.configs || {};
	const webosVersion = detectWebOSVersion(deviceInfoData.sdkVersion);

	// Get container support from documented webOS specifications
	const containerSupport = getDocumentedContainerSupport(webosVersion);

	// Get Luna API codec results (null if not available)
	const lunaHevc = cfg['tv.hw.supportCodecH265'];
	const lunaAv1 = cfg['tv.hw.supportCodecAV1'];
	const lunaVp9 = cfg['tv.hw.supportCodecVP9'];

	cachedCapabilities = {
		modelName: deviceInfoData.modelName || cfg['tv.model.modelName'] || 'Unknown',
		modelNameAscii: deviceInfoData.modelNameAscii || '',
		serialNumber: cfg['tv.model.serialnumber'] || '',
		sdkVersion: deviceInfoData.sdkVersion || 'Unknown',
		firmwareVersion: deviceInfoData.version || '',

		webosVersion,
		webosVersionDisplay: `webOS ${webosVersion}`,

		screenWidth: deviceInfoData.screenWidth || 1920,
		screenHeight: deviceInfoData.screenHeight || 1080,
		uhd: cfg['tv.hw.panelResolution'] === 'UD' || deviceInfoData.uhd || false,
		uhd8K: cfg['tv.hw.panelResolution'] === '8K' || deviceInfoData.uhd8K || false,
		oled: cfg['tv.model.oled'] === true || deviceInfoData.oled || false,

		hdr10: cfg['tv.model.supportHDR'] === true,
		hdr10Plus: cfg['tv.nvm.support.edid.hdr10plus'] === true,
		hlg: cfg['tv.config.supportHLG'] === true,
		dolbyVision: cfg['tv.config.supportDolbyHDRContents'] === true,

		dolbyAtmos: cfg['tv.conti.supportDolbyAtmos'] === true || cfg['tv.config.supportDolbyAtmos'] === true,
		dts: testDtsSupport(webosVersion),
		ac3: testAc3Support(),
		eac3: true,
		truehd: cfg['tv.conti.supportDolbyAtmos'] === true,

		hevc: lunaHevc === true || (lunaHevc !== false && testHevcSupport(null, webosVersion)),
		av1: lunaAv1 === true || testAv1Support(null, webosVersion),
		vp9: lunaVp9 === true || testVp9Support(null, webosVersion),

		...containerSupport,

		nativeHls: containerSupport.hls,
		nativeHlsFmp4: webosVersion >= 5,
		hlsAc3: webosVersion >= 5,

		lunaConfig: cfg,
		ddrSize: cfg['tv.hw.ddrSize'] || 0
	};

	console.log('[deviceProfile] Capabilities:', cachedCapabilities);
	return cachedCapabilities;
};

export const getJellyfinDeviceProfile = async () => {
	const caps = await getDeviceCapabilities();

	const videoCodecs = ['h264'];
	if (caps.hevc) videoCodecs.push('hevc');
	if (caps.vp9) videoCodecs.push('vp9');
	if (caps.av1) videoCodecs.push('av1');

	const audioCodecs = ['aac', 'mp3', 'flac', 'opus', 'vorbis', 'pcm', 'wav'];
	if (caps.ac3) audioCodecs.push('ac3');
	if (caps.eac3) audioCodecs.push('eac3');
	if (caps.dts) audioCodecs.push('dts', 'dca');
	if (caps.truehd) audioCodecs.push('truehd');

	const videoContainers = [];
	if (caps.mp4) videoContainers.push('mp4');
	if (caps.m4v) videoContainers.push('m4v');
	if (caps.webm) videoContainers.push('webm');
	if (caps.ts) videoContainers.push('ts', 'mpegts');
	if (caps.mkv) videoContainers.push('mkv', 'matroska');

	console.log('[deviceProfile] DirectPlayProfiles:', [{Container: videoContainers.join(','), VideoCodec: videoCodecs.join(','), AudioCodec: audioCodecs.join(',')}]);
	console.log('[deviceProfile] Containers:', videoContainers);
	console.log('[deviceProfile] Video codecs:', videoCodecs);
	console.log('[deviceProfile] Audio codecs:', audioCodecs);

	const maxBitrate = caps.uhd8K ? 200000000 : caps.uhd ? 120000000 : 80000000;
	const maxAudioChannels = caps.dolbyAtmos ? '8' : '6';

	const directPlayProfiles = [
		{
			Container: videoContainers.join(','),
			Type: 'Video',
			VideoCodec: videoCodecs.join(','),
			AudioCodec: audioCodecs.join(',')
		},
		{
			Container: 'mp3,flac,aac,m4a,ogg,opus,wav,wma',
			Type: 'Audio'
		}
	];

	if (caps.nativeHls) {
		directPlayProfiles.push({
			Container: 'm3u8',
			Type: 'Video',
			VideoCodec: videoCodecs.join(','),
			AudioCodec: caps.hlsAc3 ? audioCodecs.join(',') : 'aac,mp3'
		});
	}

	const transcodingProfiles = [
		{
			Container: 'ts',
			Type: 'Video',
			AudioCodec: caps.ac3 ? 'aac,ac3,eac3' : 'aac',
			VideoCodec: caps.hevc ? 'hevc,h264' : 'h264',
			Context: 'Streaming',
			Protocol: 'hls',
			MaxAudioChannels: maxAudioChannels,
			MinSegments: '1',
			SegmentLength: '3',
			BreakOnNonKeyFrames: true
		},
		{
			Container: 'mp4',
			Type: 'Video',
			AudioCodec: 'aac,ac3',
			VideoCodec: 'h264',
			Context: 'Static'
		},
		{
			Container: 'mp3',
			Type: 'Audio',
			AudioCodec: 'mp3',
			Context: 'Streaming',
			Protocol: 'http'
		}
	];

	const codecProfiles = [
		{
			Type: 'Video',
			Codec: 'h264',
			Conditions: [
				{
					Condition: 'NotEquals',
					Property: 'IsAnamorphic',
					Value: 'true',
					IsRequired: false
				},
				{
					Condition: 'LessThanEqual',
					Property: 'VideoLevel',
					Value: caps.uhd ? '51' : '41',
					IsRequired: false
				},
				{
					Condition: 'LessThanEqual',
					Property: 'VideoBitDepth',
					Value: '8',
					IsRequired: false
				},
				{
					Condition: 'LessThanEqual',
					Property: 'RefFrames',
					Value: '16',
					IsRequired: false
				}
			]
		},
		{
			Type: 'Video',
			Codec: 'hevc',
			Conditions: [
				{
					Condition: 'LessThanEqual',
					Property: 'VideoLevel',
					Value: caps.uhd ? '153' : '120',
					IsRequired: false
				},
				{
					Condition: 'LessThanEqual',
					Property: 'VideoBitDepth',
					Value: caps.hdr10 || caps.dolbyVision ? '10' : '8',
					IsRequired: false
				}
			]
		},
		{
			Type: 'Audio',
			Conditions: [
				{
					Condition: 'LessThanEqual',
					Property: 'AudioChannels',
					Value: maxAudioChannels,
					IsRequired: false
				}
			]
		}
	];

	if (caps.av1) {
		codecProfiles.push({
			Type: 'Video',
			Codec: 'av1',
			Conditions: [
				{
					Condition: 'LessThanEqual',
					Property: 'VideoLevel',
					Value: '15',
					IsRequired: false
				},
				{
					Condition: 'LessThanEqual',
					Property: 'VideoBitDepth',
					Value: '10',
					IsRequired: false
				}
			]
		});
	}

	const subtitleProfiles = [
		{Format: 'srt', Method: 'External'},
		{Format: 'ass', Method: 'External'},
		{Format: 'ssa', Method: 'External'},
		{Format: 'vtt', Method: 'External'},
		{Format: 'sub', Method: 'External'},
		{Format: 'smi', Method: 'External'},
		{Format: 'ttml', Method: 'External'},
		{Format: 'pgs', Method: 'Embed'},
		{Format: 'dvdsub', Method: 'Embed'},
		{Format: 'dvbsub', Method: 'Embed'}
	];

	const responseProfiles = [
		{
			Type: 'Video',
			Container: 'm4v',
			MimeType: 'video/mp4'
		}
	];

	if (caps.mkv) {
		responseProfiles.push({
			Type: 'Video',
			Container: 'mkv',
			MimeType: 'video/x-matroska'
		});
	}

	return {
		Name: `Moonfin webOS ${caps.webosVersion}`,
		MaxStreamingBitrate: maxBitrate,
		MaxStaticBitrate: maxBitrate,
		MaxStaticMusicBitrate: 40000000,
		MusicStreamingTranscodingBitrate: 384000,
		DirectPlayProfiles: directPlayProfiles,
		TranscodingProfiles: transcodingProfiles,
		CodecProfiles: codecProfiles,
		SubtitleProfiles: subtitleProfiles,
		ResponseProfiles: responseProfiles
	};
};

export const getDeviceId = () => {
	let deviceId = localStorage.getItem('moonfin_device_id');
	if (!deviceId) {
		deviceId = 'moonfin_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
		localStorage.setItem('moonfin_device_id', deviceId);
	}
	return deviceId;
};

export const getDeviceName = async () => {
	const caps = await getDeviceCapabilities();
	return caps.modelName || `webOS TV ${caps.webosVersion}`;
};

export default {
	detectWebOSVersion,
	getDeviceCapabilities,
	getJellyfinDeviceProfile,
	getDeviceId,
	getDeviceName
};
