let cachedCapabilities = null;

export const getDeviceCapabilities = async () => {
	if (cachedCapabilities) return cachedCapabilities;

	let deviceInfoData = {};
	let configData = {};

	try {
		const deviceInfo = await import('@enact/webos/deviceInfo');
		deviceInfoData = await new Promise(resolve => deviceInfo.default(resolve));
	} catch (e) {
		// Not on webOS
	}

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
						'tv.hw.panelResolution'
					]
				},
				onSuccess: resolve,
				onFailure: () => resolve({configs: {}})
			});
		});
	} catch (e) {
		// Not on webOS
	}

	const cfg = configData.configs || {};

	cachedCapabilities = {
		modelName: deviceInfoData.modelName || cfg['tv.model.modelName'] || 'Unknown',
		sdkVersion: deviceInfoData.sdkVersion || '0',
		webosVersion: parseFloat(deviceInfoData.sdkVersion) || 4,
		screenWidth: deviceInfoData.screenWidth || 1920,
		screenHeight: deviceInfoData.screenHeight || 1080,
		uhd: cfg['tv.hw.panelResolution'] === 'UD' || deviceInfoData.uhd || false,
		hdr10: cfg['tv.model.supportHDR'] === true,
		dolbyVision: cfg['tv.config.supportDolbyHDRContents'] === true,
		hevc: cfg['tv.hw.supportCodecH265'] !== false,
		av1: cfg['tv.hw.supportCodecAV1'] === true
	};

	return cachedCapabilities;
};

export const getJellyfinDeviceProfile = async () => {
	const caps = await getDeviceCapabilities();

	const videoCodecs = ['h264'];
	if (caps.hevc) videoCodecs.push('hevc');
	if (caps.av1) videoCodecs.push('av1');

	const audioCodecs = ['aac', 'mp3', 'ac3', 'eac3', 'flac'];

	return {
		MaxStreamingBitrate: 120000000,
		MaxStaticBitrate: 100000000,
		MusicStreamingTranscodingBitrate: 384000,

		DirectPlayProfiles: [
			{
				Container: 'mp4,m4v,mkv,webm',
				Type: 'Video',
				VideoCodec: videoCodecs.join(','),
				AudioCodec: audioCodecs.join(',')
			},
			{
				Container: 'mp3,flac,aac,m4a,ogg',
				Type: 'Audio'
			}
		],

		TranscodingProfiles: [
			{
				Container: 'ts',
				Type: 'Video',
				AudioCodec: 'aac,ac3',
				VideoCodec: 'h264',
				Context: 'Streaming',
				Protocol: 'hls',
				MaxAudioChannels: '6',
				MinSegments: '1',
				BreakOnNonKeyFrames: true
			}
		],

		CodecProfiles: [],

		SubtitleProfiles: [
			{Format: 'srt', Method: 'External'},
			{Format: 'ass', Method: 'External'},
			{Format: 'ssa', Method: 'External'},
			{Format: 'vtt', Method: 'External'},
			{Format: 'sub', Method: 'External'}
		]
	};
};
