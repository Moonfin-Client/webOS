import {useCallback} from 'react';
import {Panel, Header} from '@enact/sandstone/Panels';
import Button from '@enact/sandstone/Button';
import SwitchItem from '@enact/sandstone/SwitchItem';
import Dropdown from '@enact/sandstone/Dropdown';
import Scroller from '@enact/sandstone/Scroller';
import {useAuth} from '../../context/AuthContext';
import {useSettings} from '../../context/SettingsContext';
import {useDeviceInfo} from '../../hooks/useDeviceInfo';

import css from './Settings.module.less';

const BITRATE_OPTIONS = [
	{key: 0, children: 'Auto (No limit)'},
	{key: 120000000, children: '120 Mbps'},
	{key: 80000000, children: '80 Mbps'},
	{key: 60000000, children: '60 Mbps'},
	{key: 40000000, children: '40 Mbps'},
	{key: 20000000, children: '20 Mbps'},
	{key: 10000000, children: '10 Mbps'},
	{key: 5000000, children: '5 Mbps'}
];

const SUBTITLE_MODES = [
	{key: 'default', children: 'Default'},
	{key: 'always', children: 'Always On'},
	{key: 'onlyforced', children: 'Only Forced'},
	{key: 'none', children: 'None'}
];

const Settings = () => {
	const {user, serverUrl, logout} = useAuth();
	const {settings, updateSetting, resetSettings} = useSettings();
	const {capabilities} = useDeviceInfo();

	const handleLogout = useCallback(() => {
		logout();
	}, [logout]);

	const handleBitrateChange = useCallback((e) => {
		updateSetting('maxBitrate', BITRATE_OPTIONS[e.selected].key);
	}, [updateSetting]);

	const handleSubtitleModeChange = useCallback((e) => {
		updateSetting('subtitleMode', SUBTITLE_MODES[e.selected].key);
	}, [updateSetting]);

	return (
		<Panel className={css.panel}>
			<Header title="Settings" />

			<Scroller className={css.content}>
				<section className={css.section}>
					<h2>Account</h2>
					<div className={css.accountInfo}>
						<div className={css.field}>
							<span className={css.label}>User</span>
							<span className={css.value}>{user?.Name || 'Not logged in'}</span>
						</div>
						<div className={css.field}>
							<span className={css.label}>Server</span>
							<span className={css.value}>{serverUrl || 'Not connected'}</span>
						</div>
					</div>
					<Button onClick={handleLogout} className={css.logoutButton}>
						Sign Out
					</Button>
				</section>

				<section className={css.section}>
					<h2>Playback</h2>

					<SwitchItem
						selected={settings.preferTranscode}
						onToggle={() => updateSetting('preferTranscode', !settings.preferTranscode)}
					>
						Prefer Transcoding
					</SwitchItem>

					<div className={css.dropdownField}>
						<span>Maximum Bitrate</span>
						<Dropdown
							title="Bitrate"
							selected={BITRATE_OPTIONS.findIndex(o => o.key === settings.maxBitrate)}
							onSelect={handleBitrateChange}
						>
							{BITRATE_OPTIONS}
						</Dropdown>
					</div>

					<SwitchItem
						selected={settings.autoPlay}
						onToggle={() => updateSetting('autoPlay', !settings.autoPlay)}
					>
						Auto-play Next Episode
					</SwitchItem>

					<SwitchItem
						selected={settings.skipIntro}
						onToggle={() => updateSetting('skipIntro', !settings.skipIntro)}
					>
						Skip Intro
					</SwitchItem>

					<SwitchItem
						selected={settings.skipCredits}
						onToggle={() => updateSetting('skipCredits', !settings.skipCredits)}
					>
						Skip Credits
					</SwitchItem>
				</section>

				<section className={css.section}>
					<h2>Subtitles</h2>

					<div className={css.dropdownField}>
						<span>Subtitle Mode</span>
						<Dropdown
							title="Mode"
							selected={SUBTITLE_MODES.findIndex(o => o.key === settings.subtitleMode)}
							onSelect={handleSubtitleModeChange}
						>
							{SUBTITLE_MODES}
						</Dropdown>
					</div>
				</section>

				<section className={css.section}>
					<h2>Device Info</h2>
					{capabilities && (
						<div className={css.deviceInfo}>
							<div className={css.field}>
								<span className={css.label}>Model</span>
								<span className={css.value}>{capabilities.modelName}</span>
							</div>
							<div className={css.field}>
								<span className={css.label}>webOS Version</span>
								<span className={css.value}>{capabilities.sdkVersion}</span>
							</div>
							<div className={css.field}>
								<span className={css.label}>Resolution</span>
								<span className={css.value}>
									{capabilities.screenWidth}x{capabilities.screenHeight}
									{capabilities.uhd && ' (4K)'}
									{capabilities.uhd8K && ' (8K)'}
								</span>
							</div>
							<div className={css.field}>
								<span className={css.label}>HDR</span>
								<span className={css.value}>
									{[
										capabilities.hdr10 && 'HDR10',
										capabilities.dolbyVision && 'Dolby Vision'
									].filter(Boolean).join(', ') || 'Not supported'}
								</span>
							</div>
							<div className={css.field}>
								<span className={css.label}>Codecs</span>
								<span className={css.value}>
									{[
										'H.264',
										capabilities.hevc && 'HEVC',
										capabilities.vp9 && 'VP9',
										capabilities.av1 && 'AV1'
									].filter(Boolean).join(', ')}
								</span>
							</div>
						</div>
					)}
				</section>

				<section className={css.section}>
					<h2>About</h2>
					<div className={css.about}>
						<div className={css.field}>
							<span className={css.label}>App Version</span>
							<span className={css.value}>2.0.0</span>
						</div>
					</div>
					<Button onClick={resetSettings} size="small">
						Reset Settings
					</Button>
				</section>
			</Scroller>
		</Panel>
	);
};

export default Settings;
