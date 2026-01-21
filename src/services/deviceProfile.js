let cachedCapabilities = null;

// Map Chrome version to webOS version for display purposes
const getWebOSVersionFromChrome = (chromeVersion) => {
	if (chromeVersion >= 94) return '23';
	if (chromeVersion >= 87) return '22';
	if (chromeVersion >= 79) return '6';
	if (chromeVersion >= 68) return '5';
	if (chromeVersion >= 53) return '4';
	if (chromeVersion >= 38) return '3';
	if (chromeVersion >= 34) return '2';
	if (chromeVersion >= 26) return '1';
	return 'Unknown';
};

// Detect webOS version from user agent
const detectWebOSVersion = () => {
	const ua = navigator.userAgent.toLowerCase();
	const chromeMatch = /chrome\/(\d+)/.exec(ua);
	if (chromeMatch) {
		return getWebOSVersionFromChrome(parseInt(chromeMatch[1], 10));
	}
	return 'Unknown';
};

export const getDeviceCapabilities = async () => {
	if (cachedCapabilities) return cachedCapabilities;

	let deviceInfoData = {};
	let configData = {};

	try {
		const deviceInfo = await import('@enact/webos/deviceInfo');
		deviceInfoData = await new Promise(resolve => deviceInfo.default(resolve));
	} catch (e) {}

	try {
		const LS2Request = (await import('@enact/webos/LS2Request')).default;
		configData = await new Promise((resolve) => {
			new LS2Request().send({
				service: 'luna://com.webos.service.config',
				method: 'getConfigs',
				parameters: {
					configNames: [
						'tv.model.modelName',
						'tv.config.supportDolbyHDRContents',
						'tv.model.supportHDR',
						'tv.hw.supportCodecH265',
						'tv.hw.supportCodecAV1',
						'tv.hw.supportCodecVP9',
						'tv.hw.panelResolution',
						'tv.hw.ddrSize',
						'tv.conti.supportDolbyAtmos',
						'tv.config.supportDolbyAtmos',
						'tv.model.oled'
					]
				},
				onSuccess: resolve,
				onFailure: () => resolve({configs: {}})
			});
		});
	} catch (e) {}

	const cfg = configData.configs || {};

	// Get numeric webOS version from SDK version or Chrome UA detection
	const sdkVersionString = deviceInfoData.sdkVersion || '';
	const webosVersionNumeric = parseFloat(sdkVersionString) || 4;

	// Get friendly webOS version name (e.g., "webOS 23" for 2023 TVs)
	const webosVersionDisplay = detectWebOSVersion();

	cachedCapabilities = {
		modelName: deviceInfoData.modelName || cfg['tv.model.modelName'] || 'Unknown',
		modelNameAscii: deviceInfoData.modelNameAscii || '',
		sdkVersion: sdkVersionString || 'Unknown',
		webosVersion: webosVersionNumeric,
		webosVersionDisplay: webosVersionDisplay,
		firmwareVersion: deviceInfoData.version || '',
		screenWidth: deviceInfoData.screenWidth || 1920,
		screenHeight: deviceInfoData.screenHeight || 1080,
		uhd: cfg['tv.hw.panelResolution'] === 'UD' || deviceInfoData.uhd || false,
		uhd8K: cfg['tv.hw.panelResolution'] === '8K' || deviceInfoData.uhd8K || false,
		oled: cfg['tv.model.oled'] === true || deviceInfoData.oled || false,
		hdr10: cfg['tv.model.supportHDR'] === true,
		dolbyVision: cfg['tv.config.supportDolbyHDRContents'] === true,
		dolbyAtmos: cfg['tv.conti.supportDolbyAtmos'] === true || cfg['tv.config.supportDolbyAtmos'] === true,
		hevc: cfg['tv.hw.supportCodecH265'] !== false,
		av1: cfg['tv.hw.supportCodecAV1'] === true,
		vp9: cfg['tv.hw.supportCodecVP9'] === true || webosVersionNumeric >= 5,
		ddrSize: cfg['tv.hw.ddrSize'] || 0
	};

	return cachedCapabilities;
};

export const getJellyfinDeviceProfile = async () => {
	const caps = await getDeviceCapabilities();

	const videoCodecs = ['h264'];
	if (caps.hevc) videoCodecs.push('hevc');
	if (caps.vp9) videoCodecs.push('vp9');
	if (caps.av1) videoCodecs.push('av1');

	const audioCodecs = ['aac', 'mp3', 'ac3', 'eac3', 'flac', 'opus', 'vorbis'];
	if (caps.dolbyAtmos) {
		audioCodecs.push('truehd');
	}

	const maxBitrate = caps.uhd8K ? 200000000 : caps.uhd ? 120000000 : 80000000;

	return {
		MaxStreamingBitrate: maxBitrate,
		MaxStaticBitrate: maxBitrate,
		MusicStreamingTranscodingBitrate: 384000,

		DirectPlayProfiles: [
			{
				Container: 'mp4,m4v,mkv,webm,mov',
				Type: 'Video',
				VideoCodec: videoCodecs.join(','),
				AudioCodec: audioCodecs.join(',')
			},
			{
				Container: 'mp3,flac,aac,m4a,ogg,opus,wav',
				Type: 'Audio'
			}
		],

		TranscodingProfiles: [
			{
				Container: 'ts',
				Type: 'Video',
				AudioCodec: 'aac,ac3,eac3',
				VideoCodec: caps.hevc ? 'hevc,h264' : 'h264',
				Context: 'Streaming',
				Protocol: 'hls',
				MaxAudioChannels: caps.dolbyAtmos ? '8' : '6',
				MinSegments: '1',
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
		],

		CodecProfiles: [
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
					}
				]
			}
		],

		SubtitleProfiles: [
			{Format: 'srt', Method: 'External'},
			{Format: 'ass', Method: 'External'},
			{Format: 'ssa', Method: 'External'},
			{Format: 'vtt', Method: 'External'},
			{Format: 'sub', Method: 'External'},
			{Format: 'smi', Method: 'External'},
			{Format: 'pgs', Method: 'Embed'},
			{Format: 'dvdsub', Method: 'Embed'}
		],

		ResponseProfiles: [
			{
				Type: 'Video',
				Container: 'mkv',
				MimeType: 'video/x-matroska'
			}
		]
	};
};
