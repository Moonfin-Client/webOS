import {useCallback, useState, useEffect} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import {useAuth} from '../../context/AuthContext';
import {useSettings} from '../../context/SettingsContext';
import {useJellyseerr} from '../../context/JellyseerrContext';
import {useDeviceInfo} from '../../hooks/useDeviceInfo';
import JellyseerrIcon from '../../components/icons/JellyseerrIcon';

import css from './Settings.module.less';

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');
const SpottableInput = Spottable('input');

const SidebarContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const ContentContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');

const IconGeneral = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
	</svg>
);

const IconPlayback = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M8 5v14l11-7z" />
	</svg>
);

const IconDisplay = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
	</svg>
);

const IconAccount = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
	</svg>
);

const IconAbout = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
	</svg>
);

const CATEGORIES = [
	{id: 'general', label: 'General', Icon: IconGeneral},
	{id: 'playback', label: 'Playback', Icon: IconPlayback},
	{id: 'display', label: 'Display', Icon: IconDisplay},
	{id: 'jellyseerr', label: 'Jellyseerr', Icon: JellyseerrIcon},
	{id: 'account', label: 'Account', Icon: IconAccount},
	{id: 'about', label: 'About', Icon: IconAbout}
];

const BITRATE_OPTIONS = [
	{value: 0, label: 'Auto (No limit)'},
	{value: 120000000, label: '120 Mbps'},
	{value: 80000000, label: '80 Mbps'},
	{value: 60000000, label: '60 Mbps'},
	{value: 40000000, label: '40 Mbps'},
	{value: 20000000, label: '20 Mbps'},
	{value: 10000000, label: '10 Mbps'},
	{value: 5000000, label: '5 Mbps'}
];

const AUTH_METHODS = {
	NONE: 'none',
	JELLYFIN: 'jellyfin',
	LOCAL: 'local'
};

const Settings = ({onBack, onLogout}) => {
	const {user, serverUrl, logout, accessToken} = useAuth();
	const {settings, updateSetting} = useSettings();
	const {capabilities} = useDeviceInfo();
	const jellyseerr = useJellyseerr();

	const [activeCategory, setActiveCategory] = useState('general');

	// Jellyseerr state
	const [jellyseerrUrl, setJellyseerrUrl] = useState(jellyseerr.serverUrl || '');
	const [jellyseerrStatus, setJellyseerrStatus] = useState('');
	const [authMethod, setAuthMethod] = useState(AUTH_METHODS.NONE);
	const [isAuthenticating, setIsAuthenticating] = useState(false);

	// Jellyfin auth state
	const [jellyfinPassword, setJellyfinPassword] = useState('');

	// Local auth state
	const [localEmail, setLocalEmail] = useState('');
	const [localPassword, setLocalPassword] = useState('');

	// Server info state
	const [serverVersion, setServerVersion] = useState(null);

	useEffect(() => {
		Spotlight.focus('sidebar-general');
	}, []);

	// Fetch Jellyfin server version
	useEffect(() => {
		if (serverUrl && accessToken) {
			fetch(`${serverUrl}/System/Info`, {
				headers: {
					'Authorization': `MediaBrowser Token="${accessToken}"`
				}
			})
				.then(res => res.json())
				.then(data => {
					if (data.Version) {
						setServerVersion(data.Version);
					}
				})
				.catch(() => {});
		}
	}, [serverUrl, accessToken]);

	const handleCategorySelect = useCallback((e) => {
		const categoryId = e.currentTarget?.dataset?.category;
		if (categoryId) {
			setActiveCategory(categoryId);
		}
	}, []);

	const handleJellyseerrUrlChange = useCallback((e) => {
		setJellyseerrUrl(e.target.value);
	}, []);

	const handleJellyfinPasswordChange = useCallback((e) => {
		setJellyfinPassword(e.target.value);
	}, []);

	const handleLocalEmailChange = useCallback((e) => {
		setLocalEmail(e.target.value);
	}, []);

	const handleLocalPasswordChange = useCallback((e) => {
		setLocalPassword(e.target.value);
	}, []);

	const handleSidebarKeyDown = useCallback((e) => {
		if (e.keyCode === 39) {
			e.preventDefault();
			e.stopPropagation();
			Spotlight.focus('settings-content');
		} else if (e.keyCode === 461 || e.keyCode === 8) {
			e.preventDefault();
			onBack?.();
		}
	}, [onBack]);

	const handleContentKeyDown = useCallback((e) => {
		if (e.keyCode === 37) {
			const target = e.target;
			if (target.tagName !== 'INPUT') {
				e.preventDefault();
				e.stopPropagation();
				Spotlight.focus(`sidebar-${activeCategory}`);
			}
		} else if (e.keyCode === 461 || e.keyCode === 8) {
			e.preventDefault();
			Spotlight.focus(`sidebar-${activeCategory}`);
		}
	}, [activeCategory]);

	const handleLogout = useCallback(async () => {
		await logout();
		onLogout?.();
	}, [logout, onLogout]);

	const toggleSetting = useCallback((key) => {
		updateSetting(key, !settings[key]);
	}, [settings, updateSetting]);

	const cycleBitrate = useCallback(() => {
		const currentIndex = BITRATE_OPTIONS.findIndex(o => o.value === settings.maxBitrate);
		const nextIndex = (currentIndex + 1) % BITRATE_OPTIONS.length;
		updateSetting('maxBitrate', BITRATE_OPTIONS[nextIndex].value);
	}, [settings.maxBitrate, updateSetting]);

	const handleSelectJellyfinAuth = useCallback(() => {
		setAuthMethod(AUTH_METHODS.JELLYFIN);
		setJellyseerrStatus('');
	}, []);

	const handleSelectLocalAuth = useCallback(() => {
		setAuthMethod(AUTH_METHODS.LOCAL);
		setJellyseerrStatus('');
	}, []);

	const handleBackToAuthSelection = useCallback(() => {
		setAuthMethod(AUTH_METHODS.NONE);
		setJellyseerrStatus('');
	}, []);

	const handleJellyfinAuth = useCallback(async () => {
		if (!jellyseerrUrl) {
			setJellyseerrStatus('Please enter a Jellyseerr URL first');
			return;
		}
		if (!jellyfinPassword) {
			setJellyseerrStatus('Please enter your Jellyfin password');
			return;
		}
		if (!user?.Name || !serverUrl) {
			setJellyseerrStatus('Jellyfin authentication not found');
			return;
		}

		setIsAuthenticating(true);
		setJellyseerrStatus('Authenticating with Jellyfin...');

		try {
			await jellyseerr.configure(jellyseerrUrl, user.Id);
			await jellyseerr.loginWithJellyfin(user.Name, jellyfinPassword, serverUrl);
			setJellyseerrStatus('Connected successfully!');
			setJellyfinPassword('');
			setAuthMethod(AUTH_METHODS.NONE);
		} catch (err) {
			setJellyseerrStatus(`Authentication failed: ${err.message}`);
		} finally {
			setIsAuthenticating(false);
		}
	}, [jellyseerrUrl, jellyfinPassword, user, serverUrl, jellyseerr]);

	const handleLocalAuth = useCallback(async () => {
		if (!jellyseerrUrl) {
			setJellyseerrStatus('Please enter a Jellyseerr URL first');
			return;
		}
		if (!localEmail || !localPassword) {
			setJellyseerrStatus('Please enter email and password');
			return;
		}

		setIsAuthenticating(true);
		setJellyseerrStatus('Logging in...');

		try {
			await jellyseerr.configure(jellyseerrUrl, user?.Id);
			await jellyseerr.login(localEmail, localPassword);
			setJellyseerrStatus('Connected successfully!');
			setLocalEmail('');
			setLocalPassword('');
			setAuthMethod(AUTH_METHODS.NONE);
		} catch (err) {
			setJellyseerrStatus(`Login failed: ${err.message}`);
		} finally {
			setIsAuthenticating(false);
		}
	}, [jellyseerrUrl, localEmail, localPassword, user, jellyseerr]);

	const handleJellyseerrDisconnect = useCallback(() => {
		jellyseerr.disable();
		setJellyseerrUrl('');
		setJellyfinPassword('');
		setLocalEmail('');
		setLocalPassword('');
		setJellyseerrStatus('');
		setAuthMethod(AUTH_METHODS.NONE);
	}, [jellyseerr]);

	const getBitrateLabel = () => {
		const option = BITRATE_OPTIONS.find(o => o.value === settings.maxBitrate);
		return option?.label || 'Auto';
	};

	const renderSettingItem = (title, description, value, onClick, key) => (
		<SpottableDiv
			key={key}
			className={css.settingItem}
			onClick={onClick}
			spotlightId={key}
		>
			<div className={css.settingLabel}>
				<div className={css.settingTitle}>{title}</div>
				{description && <div className={css.settingDescription}>{description}</div>}
			</div>
			<div className={css.settingValue}>{value}</div>
		</SpottableDiv>
	);

	const renderToggleItem = (title, description, settingKey) => (
		renderSettingItem(
			title,
			description,
			settings[settingKey] ? 'On' : 'Off',
			() => toggleSetting(settingKey),
			`setting-${settingKey}`
		)
	);

	const renderGeneralPanel = () => (
		<div className={css.panel}>
			<h1>General Settings</h1>
			<div className={css.settingsGroup}>
				<h2>Application</h2>
				{renderToggleItem('Auto Login', 'Automatically sign in on startup', 'autoLogin')}
				{renderSettingItem('Clock Display', 'Show clock in the interface',
					settings.clockDisplay === '12-hour' ? '12-Hour' : '24-Hour',
					() => updateSetting('clockDisplay', settings.clockDisplay === '12-hour' ? '24-hour' : '12-hour'),
					'setting-clockDisplay'
				)}
			</div>
		</div>
	);

	const renderPlaybackPanel = () => (
		<div className={css.panel}>
			<h1>Playback Settings</h1>
			<div className={css.settingsGroup}>
				<h2>Video</h2>
				{renderToggleItem('Skip Intro', 'Automatically skip intros when detected', 'skipIntro')}
				{renderToggleItem('Skip Credits', 'Automatically skip credits', 'skipCredits')}
				{renderToggleItem('Auto Play Next', 'Automatically play the next episode', 'autoPlay')}
				{renderSettingItem('Maximum Bitrate', 'Limit streaming quality',
					getBitrateLabel(), cycleBitrate, 'setting-bitrate'
				)}
			</div>
			<div className={css.settingsGroup}>
				<h2>Transcoding</h2>
				{renderToggleItem('Prefer Transcoding', 'Request transcoded streams when available', 'preferTranscode')}
			</div>
		</div>
	);

	const renderDisplayPanel = () => (
		<div className={css.panel}>
			<h1>Display Settings</h1>
			<div className={css.settingsGroup}>
				<h2>Appearance</h2>
				{renderSettingItem('Theme', 'Choose the app theme',
					settings.theme === 'dark' ? 'Dark' : 'Light',
					() => updateSetting('theme', settings.theme === 'dark' ? 'light' : 'dark'),
					'setting-theme'
				)}
			</div>
		</div>
	);

	const renderJellyseerrPanel = () => (
		<div className={css.panel}>
			<h1>Jellyseerr Settings</h1>
			<div className={css.settingsGroup}>
				<h2>Connection</h2>
				{jellyseerr.isEnabled && jellyseerr.isAuthenticated ? (
					<>
						<div className={css.infoItem}>
							<span className={css.infoLabel}>Status</span>
							<span className={css.infoValue}>Connected</span>
						</div>
						<div className={css.infoItem}>
							<span className={css.infoLabel}>Server</span>
							<span className={css.infoValue}>{jellyseerr.serverUrl}</span>
						</div>
						{jellyseerr.user && (
							<div className={css.infoItem}>
								<span className={css.infoLabel}>User</span>
								<span className={css.infoValue}>
									{jellyseerr.user.displayName || jellyseerr.user.username || jellyseerr.user.email}
								</span>
							</div>
						)}
						<SpottableButton
							className={css.actionButton}
							onClick={handleJellyseerrDisconnect}
							spotlightId="jellyseerr-disconnect"
						>
							Disconnect
						</SpottableButton>
					</>
				) : (
					<>
						<div className={css.inputGroup}>
							<label>Jellyseerr URL</label>
							<SpottableInput
								type="url"
								placeholder="http://192.168.1.100:5055"
								value={jellyseerrUrl}
								onChange={handleJellyseerrUrlChange}
								className={css.input}
								spotlightId="jellyseerr-url"
							/>
						</div>

						{jellyseerrStatus && (
							<div className={css.statusMessage}>{jellyseerrStatus}</div>
						)}
					</>
				)}
			</div>

			{!jellyseerr.isAuthenticated && (
				<div className={css.settingsGroup}>
					<h2>Authentication</h2>
					<p className={css.authDescription}>
						Choose how to authenticate with Jellyseerr
					</p>

					{authMethod === AUTH_METHODS.NONE && (
						<div className={css.authButtons}>
							<SpottableButton
								className={css.authMethodButton}
								onClick={handleSelectJellyfinAuth}
								spotlightId="auth-jellyfin-select"
							>
								Login with Jellyfin Account
							</SpottableButton>
							<SpottableButton
								className={css.authMethodButton}
								onClick={handleSelectLocalAuth}
								spotlightId="auth-local-select"
							>
								Login with Local Account
							</SpottableButton>
						</div>
					)}

					{authMethod === AUTH_METHODS.JELLYFIN && (
						<div className={css.authForm}>
							<div className={css.authFormHeader}>
								<span>Jellyfin Authentication</span>
								<SpottableButton
									className={css.backLink}
									onClick={handleBackToAuthSelection}
									spotlightId="auth-back"
								>
									← Back
								</SpottableButton>
							</div>
							<p className={css.authHint}>
								Sign in using your Jellyfin credentials ({user?.Name})
							</p>
							<div className={css.inputGroup}>
								<label>Jellyfin Password</label>
								<SpottableInput
									type="password"
									placeholder="Enter your Jellyfin password"
									value={jellyfinPassword}
									onChange={handleJellyfinPasswordChange}
									className={css.input}
									spotlightId="jellyfin-password"
								/>
							</div>
							<SpottableButton
								className={css.actionButton}
								onClick={handleJellyfinAuth}
								disabled={isAuthenticating}
								spotlightId="jellyfin-auth-submit"
							>
								{isAuthenticating ? 'Connecting...' : 'Connect'}
							</SpottableButton>
						</div>
					)}

					{authMethod === AUTH_METHODS.LOCAL && (
						<div className={css.authForm}>
							<div className={css.authFormHeader}>
								<span>Local Account</span>
								<SpottableButton
									className={css.backLink}
									onClick={handleBackToAuthSelection}
									spotlightId="auth-back-local"
								>
									← Back
								</SpottableButton>
							</div>
							<p className={css.authHint}>
								Sign in with your Jellyseerr email and password
							</p>
							<div className={css.inputGroup}>
								<label>Email</label>
								<SpottableInput
									type="email"
									placeholder="email@example.com"
									value={localEmail}
									onChange={handleLocalEmailChange}
									className={css.input}
									spotlightId="local-email"
								/>
							</div>
							<div className={css.inputGroup}>
								<label>Password</label>
								<SpottableInput
									type="password"
									placeholder="Enter your password"
									value={localPassword}
									onChange={handleLocalPasswordChange}
									className={css.input}
									spotlightId="local-password"
								/>
							</div>
							<SpottableButton
								className={css.actionButton}
								onClick={handleLocalAuth}
								disabled={isAuthenticating}
								spotlightId="local-auth-submit"
							>
								{isAuthenticating ? 'Logging in...' : 'Login'}
							</SpottableButton>
						</div>
					)}
				</div>
			)}
		</div>
	);

	const renderAccountPanel = () => (
		<div className={css.panel}>
			<h1>Account Settings</h1>
			<div className={css.settingsGroup}>
				<h2>User</h2>
				<div className={css.infoItem}>
					<span className={css.infoLabel}>Username</span>
					<span className={css.infoValue}>{user?.Name || 'Not logged in'}</span>
				</div>
				<div className={css.infoItem}>
					<span className={css.infoLabel}>Server</span>
					<span className={css.infoValue}>{serverUrl || 'Not connected'}</span>
				</div>
			</div>
			<div className={css.settingsGroup}>
				<h2>Actions</h2>
				<SpottableButton
					className={css.actionButton}
					onClick={handleLogout}
					spotlightId="logout-button"
				>
					Sign Out
				</SpottableButton>
			</div>
		</div>
	);

	const renderAboutPanel = () => (
		<div className={css.panel}>
			<h1>About</h1>
			<div className={css.settingsGroup}>
				<h2>Application</h2>
				<div className={css.infoItem}>
					<span className={css.infoLabel}>App Version</span>
					<span className={css.infoValue}>2.0.0</span>
				</div>
				<div className={css.infoItem}>
					<span className={css.infoLabel}>Platform</span>
					<span className={css.infoValue}>
						{capabilities?.webosVersionDisplay
							? `webOS ${capabilities.webosVersionDisplay}`
							: 'webOS'}
					</span>
				</div>
			</div>

			<div className={css.settingsGroup}>
				<h2>Server</h2>
				<div className={css.infoItem}>
					<span className={css.infoLabel}>Server URL</span>
					<span className={css.infoValue}>{serverUrl || 'Not connected'}</span>
				</div>
				<div className={css.infoItem}>
					<span className={css.infoLabel}>Server Version</span>
					<span className={css.infoValue}>{serverVersion || 'Loading...'}</span>
				</div>
			</div>

			{capabilities && (
				<div className={css.settingsGroup}>
					<h2>Device</h2>
					<div className={css.infoItem}>
						<span className={css.infoLabel}>Model</span>
						<span className={css.infoValue}>{capabilities.modelName || 'Unknown'}</span>
					</div>
					{capabilities.firmwareVersion && (
						<div className={css.infoItem}>
							<span className={css.infoLabel}>Firmware</span>
							<span className={css.infoValue}>{capabilities.firmwareVersion}</span>
						</div>
					)}
					<div className={css.infoItem}>
						<span className={css.infoLabel}>Resolution</span>
						<span className={css.infoValue}>
							{capabilities.screenWidth}x{capabilities.screenHeight}
							{capabilities.uhd8K && ' (8K)'}
							{capabilities.uhd && !capabilities.uhd8K && ' (4K)'}
							{capabilities.oled && ' OLED'}
						</span>
					</div>
				</div>
			)}

			{capabilities && (
				<div className={css.settingsGroup}>
					<h2>Capabilities</h2>
					<div className={css.infoItem}>
						<span className={css.infoLabel}>HDR</span>
						<span className={css.infoValue}>
							{[
								capabilities.hdr10 && 'HDR10',
								capabilities.dolbyVision && 'Dolby Vision'
							].filter(Boolean).join(', ') || 'Not supported'}
						</span>
					</div>
					<div className={css.infoItem}>
						<span className={css.infoLabel}>Audio</span>
						<span className={css.infoValue}>
							{capabilities.dolbyAtmos ? 'Dolby Atmos' : 'Standard'}
						</span>
					</div>
					<div className={css.infoItem}>
						<span className={css.infoLabel}>Video Codecs</span>
						<span className={css.infoValue}>
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
		</div>
	);

	const renderPanel = () => {
		switch (activeCategory) {
			case 'general': return renderGeneralPanel();
			case 'playback': return renderPlaybackPanel();
			case 'display': return renderDisplayPanel();
			case 'jellyseerr': return renderJellyseerrPanel();
			case 'account': return renderAccountPanel();
			case 'about': return renderAboutPanel();
			default: return renderGeneralPanel();
		}
	};

	return (
		<div className={css.page}>
			<SidebarContainer
				className={css.sidebar}
				onKeyDown={handleSidebarKeyDown}
				spotlightId="settings-sidebar"
			>
				{CATEGORIES.map(cat => (
					<SpottableDiv
						key={cat.id}
						className={`${css.category} ${activeCategory === cat.id ? css.active : ''}`}
						onClick={handleCategorySelect}
						onFocus={handleCategorySelect}
						data-category={cat.id}
						spotlightId={`sidebar-${cat.id}`}
					>
						<span className={css.categoryIcon}><cat.Icon /></span>
						<span className={css.categoryLabel}>{cat.label}</span>
					</SpottableDiv>
				))}
			</SidebarContainer>

			<ContentContainer
				className={css.content}
				onKeyDown={handleContentKeyDown}
				spotlightId="settings-content"
			>
				{renderPanel()}
			</ContentContainer>
		</div>
	);
};

export default Settings;
