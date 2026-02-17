import {useCallback, useState, useEffect} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import Popup from '@enact/sandstone/Popup';
import Button from '@enact/sandstone/Button';
import Slider from '@enact/sandstone/Slider';
import {useAuth} from '../../context/AuthContext';
import {useSettings, DEFAULT_HOME_ROWS} from '../../context/SettingsContext';
import {useJellyseerr} from '../../context/JellyseerrContext';
import {useDeviceInfo} from '../../hooks/useDeviceInfo';
import JellyseerrIcon from '../../components/icons/JellyseerrIcon';
import SeerrIcon from '../../components/icons/SeerrIcon';
import serverLogger from '../../services/serverLogger';
import connectionPool from '../../services/connectionPool';

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

const IconAbout = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
	</svg>
);

const IconPlugin = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
	</svg>
);

const MDBLIST_SOURCE_OPTIONS = [
	{value: 'imdb', label: 'IMDb', icon: 'imdb.svg'},
	{value: 'tmdb', label: 'TMDb', icon: 'tmdb.svg'},
	{value: 'trakt', label: 'Trakt', icon: 'trakt.svg'},
	{value: 'tomatoes', label: 'Rotten Tomatoes (Critics)', icon: 'rt-fresh.svg'},
	{value: 'popcorn', label: 'Rotten Tomatoes (Audience)', icon: 'rt-audience-up.svg'},
	{value: 'metacritic', label: 'Metacritic', icon: 'metacritic.svg'},
	{value: 'metacriticuser', label: 'Metacritic User', icon: 'metacritic-user.svg'},
	{value: 'letterboxd', label: 'Letterboxd', icon: 'letterboxd.svg'},
	{value: 'rogerebert', label: 'Roger Ebert', icon: 'rogerebert.svg'},
	{value: 'myanimelist', label: 'MyAnimeList', icon: 'mal.svg'},
	{value: 'anilist', label: 'AniList', icon: 'anilist.svg'}
];

const BASE_CATEGORIES = [
	{id: 'general', label: 'General', Icon: IconGeneral},
	{id: 'playback', label: 'Playback', Icon: IconPlayback},
	{id: 'display', label: 'Display', Icon: IconDisplay},
	{id: 'plugin', label: 'Plugin', Icon: IconPlugin},
	{id: 'jellyseerr', label: 'Jellyseerr', Icon: JellyseerrIcon},
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

const CONTENT_TYPE_OPTIONS = [
	{value: 'both', label: 'Movies & TV Shows'},
	{value: 'movies', label: 'Movies Only'},
	{value: 'tv', label: 'TV Shows Only'}
];

const FEATURED_ITEM_COUNT_OPTIONS = [
	{value: 5, label: '5 items'},
	{value: 10, label: '10 items'},
	{value: 15, label: '15 items'}
];

const BLUR_OPTIONS = [
	{value: 0, label: 'Off'},
	{value: 10, label: 'Light'},
	{value: 20, label: 'Medium'},
	{value: 30, label: 'Strong'},
	{value: 40, label: 'Heavy'}
];

const SUBTITLE_SIZE_OPTIONS = [
	{value: 'small', label: 'Small', fontSize: 36},
	{value: 'medium', label: 'Medium', fontSize: 44},
	{value: 'large', label: 'Large', fontSize: 52},
	{value: 'xlarge', label: 'Extra Large', fontSize: 60}
];

const SUBTITLE_POSITION_OPTIONS = [
	{value: 'bottom', label: 'Bottom', offset: 10},
	{value: 'lower', label: 'Lower', offset: 20},
	{value: 'middle', label: 'Middle', offset: 30},
	{value: 'higher', label: 'Higher', offset: 40},
	{value: 'absolute', label: 'Absolute', offset: 0}
];

const SUBTITLE_COLOR_OPTIONS = [
	{value: '#ffffff', label: 'White'},
	{value: '#ffff00', label: 'Yellow'},
	{value: '#00ffff', label: 'Cyan'},
	{value: '#ff00ff', label: 'Magenta'},
	{value: '#00ff00', label: 'Green'},
	{value: '#ff0000', label: 'Red'},
	{value: '#808080', label: 'Grey'},
	{value: '#404040', label: 'Dark Grey'}
];

const SUBTITLE_SHADOW_COLOR_OPTIONS = [
	{value: '#000000', label: 'Black'},
	{value: '#ffffff', label: 'White'},
	{value: '#808080', label: 'Grey'},
	{value: '#404040', label: 'Dark Grey'},
	{value: '#ff0000', label: 'Red'},
	{value: '#00ff00', label: 'Green'},
	{value: '#0000ff', label: 'Blue'}
];

const SUBTITLE_BACKGROUND_COLOR_OPTIONS = [
	{value: '#000000', label: 'Black'},
	{value: '#ffffff', label: 'White'},
	{value: '#808080', label: 'Grey'},
	{value: '#404040', label: 'Dark Grey'},
	{value: '#000080', label: 'Navy'}
];

const SEEK_STEP_OPTIONS = [
	{value: 5, label: '5 seconds'},
	{value: 10, label: '10 seconds'},
	{value: 20, label: '20 seconds'},
	{value: 30, label: '30 seconds'}
];

const UI_OPACITY_OPTIONS = [
	{value: 50, label: '50%'},
	{value: 65, label: '65%'},
	{value: 75, label: '75%'},
	{value: 85, label: '85%'},
	{value: 95, label: '95%'}
];

const UI_COLOR_OPTIONS = [
	{value: 'dark', label: 'Dark Gray', rgb: '40, 40, 40'},
	{value: 'black', label: 'Black', rgb: '0, 0, 0'},
	{value: 'charcoal', label: 'Charcoal', rgb: '54, 54, 54'},
	{value: 'slate', label: 'Slate', rgb: '47, 54, 64'},
	{value: 'navy', label: 'Navy', rgb: '20, 30, 48'},
	{value: 'midnight', label: 'Midnight Blue', rgb: '25, 25, 65'},
	{value: 'ocean', label: 'Ocean', rgb: '20, 50, 70'},
	{value: 'teal', label: 'Teal', rgb: '0, 60, 60'},
	{value: 'forest', label: 'Forest', rgb: '25, 50, 35'},
	{value: 'olive', label: 'Olive', rgb: '50, 50, 25'},
	{value: 'purple', label: 'Purple', rgb: '48, 25, 52'},
	{value: 'plum', label: 'Plum', rgb: '60, 30, 60'},
	{value: 'wine', label: 'Wine', rgb: '60, 20, 30'},
	{value: 'maroon', label: 'Maroon', rgb: '50, 20, 20'},
	{value: 'brown', label: 'Brown', rgb: '50, 35, 25'}
];

const Settings = ({onBack, onLibrariesChanged}) => {
	const {
		api,
		serverUrl,
		accessToken,
		hasMultipleServers,
	} = useAuth();
	const {settings, updateSetting} = useSettings();
	const {capabilities} = useDeviceInfo();
	const jellyseerr = useJellyseerr();
	const isSeerr = jellyseerr.isMoonfin && jellyseerr.variant === 'seerr';
	const seerrLabel = isSeerr ? (jellyseerr.displayName || 'Seerr') : 'Jellyseerr';

	const categories = BASE_CATEGORIES.map(cat => {
		if (cat.id === 'jellyseerr') {
			return {
				...cat,
				label: seerrLabel,
				Icon: isSeerr ? SeerrIcon : JellyseerrIcon
			};
		}
		return cat;
	});

	const [activeCategory, setActiveCategory] = useState('general');
	const [showHomeRowsModal, setShowHomeRowsModal] = useState(false);
	const [tempHomeRows, setTempHomeRows] = useState([]);

	// Library visibility
	const [showLibraryModal, setShowLibraryModal] = useState(false);
	const [allLibraries, setAllLibraries] = useState([]);
	const [hiddenLibraries, setHiddenLibraries] = useState([]);
	const [libraryLoading, setLibraryLoading] = useState(false);
	const [librarySaving, setLibrarySaving] = useState(false);
	const [serverConfigs, setServerConfigs] = useState([]);

	const [serverVersion, setServerVersion] = useState(null);

	const [moonfinConnecting, setMoonfinConnecting] = useState(false);
	const [moonfinStatus, setMoonfinStatus] = useState('');
	const [moonfinLoginMode, setMoonfinLoginMode] = useState(false);
	const [moonfinUsername, setMoonfinUsername] = useState('');
	const [moonfinPassword, setMoonfinPassword] = useState('');

	useEffect(() => {
		Spotlight.focus('sidebar-general');
	}, []);

	// Global back button handler for Settings view
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.keyCode === 461 || e.keyCode === 27 || e.keyCode === 8) {
				if (e.target.tagName === 'INPUT') {
					return;
				}
				e.preventDefault();
				e.stopPropagation();
				onBack?.();
			}
		};

		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [onBack]);

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

	const handleSidebarKeyDown = useCallback((e) => {
		if (e.keyCode === 37) {
			e.preventDefault();
			e.stopPropagation();
			Spotlight.focus('settings-content');
		}
	}, []);

	const handleContentKeyDown = useCallback((e) => {
		if (e.keyCode === 39) {
			const target = e.target;
			if (target.tagName !== 'INPUT') {
				e.preventDefault();
				e.stopPropagation();
				Spotlight.focus(`sidebar-${activeCategory}`);
			}
		}
	}, [activeCategory]);

	const toggleSetting = useCallback((key) => {
		updateSetting(key, !settings[key]);
		if (key === 'serverLogging') {
			serverLogger.setEnabled(!settings[key]);
		}
	}, [settings, updateSetting]);

	const toggleMdblistSource = useCallback((source) => {
		const current = settings.mdblistRatingSources || [];
		const updated = current.includes(source)
			? current.filter(s => s !== source)
			: [...current, source];
		updateSetting('mdblistRatingSources', updated);
	}, [settings.mdblistRatingSources, updateSetting]);

	const handleMoonfinToggle = useCallback(async () => {
		const enabling = !settings.useMoonfinPlugin;
		updateSetting('useMoonfinPlugin', enabling);

		if (enabling) {
			if (!serverUrl || !accessToken) {
				setMoonfinStatus('Not connected to a Jellyfin server');
				return;
			}

			setMoonfinConnecting(true);
			setMoonfinStatus('Checking Moonfin plugin...');

			try {
				const result = await jellyseerr.configureWithMoonfin(serverUrl, accessToken);
				if (result.authenticated) {
					setMoonfinStatus('Connected via Moonfin!');
					setMoonfinLoginMode(false);
				} else {
					setMoonfinStatus('Moonfin plugin found but no session. Please log in.');
					setMoonfinLoginMode(true);
				}
			} catch (err) {
				setMoonfinStatus(`Moonfin connection failed: ${err.message}`);
			} finally {
				setMoonfinConnecting(false);
			}
		} else {
			jellyseerr.disable();
			setMoonfinStatus('');
			setMoonfinLoginMode(false);
			setMoonfinUsername('');
			setMoonfinPassword('');
		}
	}, [settings.useMoonfinPlugin, updateSetting, serverUrl, accessToken, jellyseerr]);

	const cycleBitrate = useCallback(() => {
		const currentIndex = BITRATE_OPTIONS.findIndex(o => o.value === settings.maxBitrate);
		const nextIndex = (currentIndex + 1) % BITRATE_OPTIONS.length;
		updateSetting('maxBitrate', BITRATE_OPTIONS[nextIndex].value);
	}, [settings.maxBitrate, updateSetting]);

	const cycleFeaturedContentType = useCallback(() => {
		const currentIndex = CONTENT_TYPE_OPTIONS.findIndex(o => o.value === settings.featuredContentType);
		const nextIndex = (currentIndex + 1) % CONTENT_TYPE_OPTIONS.length;
		updateSetting('featuredContentType', CONTENT_TYPE_OPTIONS[nextIndex].value);
	}, [settings.featuredContentType, updateSetting]);

	const cycleShuffleContentType = useCallback(() => {
		const currentIndex = CONTENT_TYPE_OPTIONS.findIndex(o => o.value === settings.shuffleContentType);
		const nextIndex = (currentIndex + 1) % CONTENT_TYPE_OPTIONS.length;
		updateSetting('shuffleContentType', CONTENT_TYPE_OPTIONS[nextIndex].value);
	}, [settings.shuffleContentType, updateSetting]);

	const cycleFeaturedItemCount = useCallback(() => {
		const currentIndex = FEATURED_ITEM_COUNT_OPTIONS.findIndex(o => o.value === settings.featuredItemCount);
		const nextIndex = (currentIndex + 1) % FEATURED_ITEM_COUNT_OPTIONS.length;
		updateSetting('featuredItemCount', FEATURED_ITEM_COUNT_OPTIONS[nextIndex].value);
	}, [settings.featuredItemCount, updateSetting]);

	const cycleBackdropBlurHome = useCallback(() => {
		const currentIndex = BLUR_OPTIONS.findIndex(o => o.value === settings.backdropBlurHome);
		const nextIndex = (currentIndex + 1) % BLUR_OPTIONS.length;
		updateSetting('backdropBlurHome', BLUR_OPTIONS[nextIndex].value);
	}, [settings.backdropBlurHome, updateSetting]);

	const cycleBackdropBlurDetail = useCallback(() => {
		const currentIndex = BLUR_OPTIONS.findIndex(o => o.value === settings.backdropBlurDetail);
		const nextIndex = (currentIndex + 1) % BLUR_OPTIONS.length;
		updateSetting('backdropBlurDetail', BLUR_OPTIONS[nextIndex].value);
	}, [settings.backdropBlurDetail, updateSetting]);

	const cycleSubtitleSize = useCallback(() => {
		const currentIndex = SUBTITLE_SIZE_OPTIONS.findIndex(o => o.value === settings.subtitleSize);
		const nextIndex = (currentIndex + 1) % SUBTITLE_SIZE_OPTIONS.length;
		updateSetting('subtitleSize', SUBTITLE_SIZE_OPTIONS[nextIndex].value);
	}, [settings.subtitleSize, updateSetting]);

	const cycleSubtitlePosition = useCallback(() => {
		const currentIndex = SUBTITLE_POSITION_OPTIONS.findIndex(o => o.value === settings.subtitlePosition);
		const nextIndex = (currentIndex + 1) % SUBTITLE_POSITION_OPTIONS.length;
		updateSetting('subtitlePosition', SUBTITLE_POSITION_OPTIONS[nextIndex].value);
	}, [settings.subtitlePosition, updateSetting]);

	const cycleSubtitleColor = useCallback(() => {
		const currentIndex = SUBTITLE_COLOR_OPTIONS.findIndex(o => o.value === settings.subtitleColor);
		const index = currentIndex === -1 ? 0 : currentIndex;
		const nextIndex = (index + 1) % SUBTITLE_COLOR_OPTIONS.length;
		updateSetting('subtitleColor', SUBTITLE_COLOR_OPTIONS[nextIndex].value);
	}, [settings.subtitleColor, updateSetting]);

	const cycleSubtitleShadowColor = useCallback(() => {
		const currentIndex = SUBTITLE_SHADOW_COLOR_OPTIONS.findIndex(o => o.value === settings.subtitleShadowColor);
		const index = currentIndex === -1 ? 0 : currentIndex;
		const nextIndex = (index + 1) % SUBTITLE_SHADOW_COLOR_OPTIONS.length;
		updateSetting('subtitleShadowColor', SUBTITLE_SHADOW_COLOR_OPTIONS[nextIndex].value);
	}, [settings.subtitleShadowColor, updateSetting]);

	const cycleSubtitleBackgroundColor = useCallback(() => {
		const currentIndex = SUBTITLE_BACKGROUND_COLOR_OPTIONS.findIndex(o => o.value === settings.subtitleBackgroundColor);
		const index = currentIndex === -1 ? 0 : currentIndex;
		const nextIndex = (index + 1) % SUBTITLE_BACKGROUND_COLOR_OPTIONS.length;
		updateSetting('subtitleBackgroundColor', SUBTITLE_BACKGROUND_COLOR_OPTIONS[nextIndex].value);
	}, [settings.subtitleBackgroundColor, updateSetting]);

	const cycleSeekStep = useCallback(() => {
		const currentIndex = SEEK_STEP_OPTIONS.findIndex(o => o.value === settings.seekStep);
		const nextIndex = (currentIndex + 1) % SEEK_STEP_OPTIONS.length;
		updateSetting('seekStep', SEEK_STEP_OPTIONS[nextIndex].value);
	}, [settings.seekStep, updateSetting]);

	const cycleUiOpacity = useCallback(() => {
		const currentIndex = UI_OPACITY_OPTIONS.findIndex(o => o.value === settings.uiOpacity);
		const nextIndex = (currentIndex + 1) % UI_OPACITY_OPTIONS.length;
		updateSetting('uiOpacity', UI_OPACITY_OPTIONS[nextIndex].value);
	}, [settings.uiOpacity, updateSetting]);

	const cycleUiColor = useCallback(() => {
		const currentIndex = UI_COLOR_OPTIONS.findIndex(o => o.value === settings.uiColor);
		const nextIndex = (currentIndex + 1) % UI_COLOR_OPTIONS.length;
		updateSetting('uiColor', UI_COLOR_OPTIONS[nextIndex].value);
	}, [settings.uiColor, updateSetting]);

	const handleSliderPositionAbsolute = useCallback((e) => {
		updateSetting('subtitlePositionAbsolute', e.value);
	}, [updateSetting]);

	const handleSliderOpacity = useCallback((e) => {
		updateSetting('subtitleOpacity', e.value);
	}, [updateSetting]);

	const handleSliderShadowOpacity = useCallback((e) => {
		updateSetting('subtitleShadowOpacity', e.value);
	}, [updateSetting]);

	const handleSliderShadowBlur = useCallback((e) => {
		updateSetting('subtitleShadowBlur', e.value);
	}, [updateSetting]);

	const handleSliderBackground = useCallback((e) => {
		updateSetting('subtitleBackground', e.value);
	}, [updateSetting]);

	const openHomeRowsModal = useCallback(() => {
		setTempHomeRows([...(settings.homeRows || DEFAULT_HOME_ROWS)].sort((a, b) => a.order - b.order));
		setShowHomeRowsModal(true);
	}, [settings.homeRows]);

	const closeHomeRowsModal = useCallback(() => {
		setShowHomeRowsModal(false);
		setTempHomeRows([]);
	}, []);

	const saveHomeRows = useCallback(() => {
		updateSetting('homeRows', tempHomeRows);
		setShowHomeRowsModal(false);
	}, [tempHomeRows, updateSetting]);

	const resetHomeRows = useCallback(() => {
		setTempHomeRows([...DEFAULT_HOME_ROWS]);
	}, []);

	const toggleHomeRow = useCallback((rowId) => {
		setTempHomeRows(prev => prev.map(row =>
			row.id === rowId ? {...row, enabled: !row.enabled} : row
		));
	}, []);

	const moveHomeRowUp = useCallback((rowId) => {
		setTempHomeRows(prev => {
			const index = prev.findIndex(r => r.id === rowId);
			if (index <= 0) return prev;
			const newRows = [...prev];
			const temp = newRows[index].order;
			newRows[index].order = newRows[index - 1].order;
			newRows[index - 1].order = temp;
			return newRows.sort((a, b) => a.order - b.order);
		});
	}, []);

	const moveHomeRowDown = useCallback((rowId) => {
		setTempHomeRows(prev => {
			const index = prev.findIndex(r => r.id === rowId);
			if (index < 0 || index >= prev.length - 1) return prev;
			const newRows = [...prev];
			const temp = newRows[index].order;
			newRows[index].order = newRows[index + 1].order;
			newRows[index + 1].order = temp;
			return newRows.sort((a, b) => a.order - b.order);
		});
	}, []);

	const handleHomeRowToggleClick = useCallback((e) => {
		const rowId = e.currentTarget.dataset.rowId;
		if (rowId) toggleHomeRow(rowId);
	}, [toggleHomeRow]);

	const handleHomeRowUpClick = useCallback((e) => {
		const rowId = e.currentTarget.dataset.rowId;
		if (rowId) moveHomeRowUp(rowId);
	}, [moveHomeRowUp]);

	const handleHomeRowDownClick = useCallback((e) => {
		const rowId = e.currentTarget.dataset.rowId;
		if (rowId) moveHomeRowDown(rowId);
	}, [moveHomeRowDown]);

	// Library visibility handlers
	const openLibraryModal = useCallback(async () => {
		setShowLibraryModal(true);
		setLibraryLoading(true);
		try {
			const isUnified = settings.unifiedLibraryMode && hasMultipleServers;
			if (isUnified) {
				const [allLibs, configs] = await Promise.all([
					connectionPool.getAllLibrariesFromAllServers(),
					connectionPool.getUserConfigFromAllServers()
				]);
				const libs = allLibs.filter(lib => lib.CollectionType);
				setAllLibraries(libs);
				setServerConfigs(configs);
				const allExcludes = configs.reduce((acc, cfg) => {
					return acc.concat(cfg.configuration?.MyMediaExcludes || []);
				}, []);
				setHiddenLibraries([...new Set(allExcludes)]);
			} else {
				const [viewsResult, userData] = await Promise.all([
					api.getAllLibraries(),
					api.getUserConfiguration()
				]);
				const libs = (viewsResult.Items || []).filter(lib => lib.CollectionType);
				setAllLibraries(libs);
				setHiddenLibraries([...(userData.Configuration?.MyMediaExcludes || [])]);
			}
		} catch (err) {
			console.error('Failed to load libraries:', err);
		} finally {
			setLibraryLoading(false);
		}
	}, [api, settings.unifiedLibraryMode, hasMultipleServers]);

	const closeLibraryModal = useCallback(() => {
		setShowLibraryModal(false);
		setAllLibraries([]);
		setHiddenLibraries([]);
		setServerConfigs([]);
	}, []);

	const toggleLibraryVisibility = useCallback((libraryId) => {
		setHiddenLibraries(prev => {
			if (prev.includes(libraryId)) {
				return prev.filter(id => id !== libraryId);
			}
			return [...prev, libraryId];
		});
	}, []);

	const handleLibraryToggleClick = useCallback((e) => {
		const libId = e.currentTarget.dataset.libraryId;
		if (libId) toggleLibraryVisibility(libId);
	}, [toggleLibraryVisibility]);

	const saveLibraryVisibility = useCallback(async () => {
		setLibrarySaving(true);
		try {
			const isUnified = settings.unifiedLibraryMode && hasMultipleServers;
			if (isUnified) {
				// Group hidden library IDs by their server
				const serverExcludes = {};
				for (const lib of allLibraries) {
					const key = lib._serverUrl;
					if (!serverExcludes[key]) {
						serverExcludes[key] = [];
					}
					if (hiddenLibraries.includes(lib.Id)) {
						serverExcludes[key].push(lib.Id);
					}
				}
				// Save to each server
				const savePromises = serverConfigs.map(cfg => {
					const excludes = serverExcludes[cfg.serverUrl] || [];
					const updatedConfig = {
						...cfg.configuration,
						MyMediaExcludes: excludes
					};
					return connectionPool.updateUserConfigOnServer(
						cfg.serverUrl,
						cfg.accessToken,
						cfg.userId,
						updatedConfig
					);
				});
				await Promise.all(savePromises);
			} else {
				const userData = await api.getUserConfiguration();
				const updatedConfig = {
					...userData.Configuration,
					MyMediaExcludes: hiddenLibraries
				};
				await api.updateUserConfiguration(updatedConfig);
			}
			setShowLibraryModal(false);
			setAllLibraries([]);
			setHiddenLibraries([]);
			setServerConfigs([]);
			onLibrariesChanged?.();
			window.dispatchEvent(new window.Event('moonfin:browseRefresh'));
		} catch (err) {
			console.error('Failed to save library visibility:', err);
		} finally {
			setLibrarySaving(false);
		}
	}, [api, hiddenLibraries, allLibraries, serverConfigs, settings.unifiedLibraryMode, hasMultipleServers, onLibrariesChanged]);

	const handleMoonfinLogin = useCallback(async () => {
		if (!moonfinUsername || !moonfinPassword) {
			setMoonfinStatus('Please enter username and password');
			return;
		}

		setMoonfinConnecting(true);
		setMoonfinStatus('Logging in via Moonfin plugin...');

		try {
			await jellyseerr.loginWithMoonfin(moonfinUsername, moonfinPassword);
			setMoonfinStatus('Connected successfully!');
			setMoonfinLoginMode(false);
			setMoonfinUsername('');
			setMoonfinPassword('');
		} catch (err) {
			setMoonfinStatus(`Login failed: ${err.message}`);
		} finally {
			setMoonfinConnecting(false);
		}
	}, [moonfinUsername, moonfinPassword, jellyseerr]);

	const handleMoonfinUsernameChange = useCallback((e) => {
		setMoonfinUsername(e.target.value);
	}, []);

	const handleMoonfinPasswordChange = useCallback((e) => {
		setMoonfinPassword(e.target.value);
	}, []);

	const handleJellyseerrDisconnect = useCallback(() => {
		jellyseerr.disable();
		setMoonfinStatus('');
		setMoonfinLoginMode(false);
		setMoonfinUsername('');
		setMoonfinPassword('');
	}, [jellyseerr]);

	const getBitrateLabel = () => {
		const option = BITRATE_OPTIONS.find(o => o.value === settings.maxBitrate);
		return option?.label || 'Auto';
	};

	const getFeaturedContentTypeLabel = () => {
		const option = CONTENT_TYPE_OPTIONS.find(o => o.value === settings.featuredContentType);
		return option?.label || 'Movies & TV Shows';
	};

	const getShuffleContentTypeLabel = () => {
		const option = CONTENT_TYPE_OPTIONS.find(o => o.value === settings.shuffleContentType);
		return option?.label || 'Movies & TV Shows';
	};

	const getFeaturedItemCountLabel = () => {
		const option = FEATURED_ITEM_COUNT_OPTIONS.find(o => o.value === settings.featuredItemCount);
		return option?.label || '10 items';
	};

	const getBackdropBlurLabel = (value) => {
		const option = BLUR_OPTIONS.find(o => o.value === value);
		return option?.label || 'Medium';
	};

	const getSubtitleSizeLabel = () => {
		const option = SUBTITLE_SIZE_OPTIONS.find(o => o.value === settings.subtitleSize);
		return option?.label || 'Medium';
	};

	const getSubtitlePositionLabel = () => {
		const option = SUBTITLE_POSITION_OPTIONS.find(o => o.value === settings.subtitlePosition);
		return option?.label || 'Bottom';
	};

	const getSubtitleColorLabel = () => {
		const option = SUBTITLE_COLOR_OPTIONS.find(o => o.value === settings.subtitleColor);
		return option?.label || 'White';
	};

	const getSubtitleShadowColorLabel = () => {
		const option = SUBTITLE_SHADOW_COLOR_OPTIONS.find(o => o.value === settings.subtitleShadowColor);
		return option?.label || 'Black';
	};

	const getSubtitleBackgroundColorLabel = () => {
		const option = SUBTITLE_BACKGROUND_COLOR_OPTIONS.find(o => o.value === settings.subtitleBackgroundColor);
		return option?.label || 'Black';
	};

	const getSeekStepLabel = () => {
		const option = SEEK_STEP_OPTIONS.find(o => o.value === settings.seekStep);
		return option?.label || '10 seconds';
	};

	const getUiOpacityLabel = () => {
		const option = UI_OPACITY_OPTIONS.find(o => o.value === settings.uiOpacity);
		return option?.label || '85%';
	};

	const getUiColorLabel = () => {
		const option = UI_COLOR_OPTIONS.find(o => o.value === settings.uiColor);
		return option?.label || 'Dark Gray';
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
				{renderSettingItem('Clock Display', 'Show clock in the interface',
					settings.clockDisplay === '12-hour' ? '12-Hour' : '24-Hour',
					() => updateSetting('clockDisplay', settings.clockDisplay === '12-hour' ? '24-hour' : '12-hour'),
					'setting-clockDisplay'
				)}
				{renderToggleItem('Auto Login', 'Automatically sign in on app launch', 'autoLogin')}
			</div>
			{hasMultipleServers && (
				<div className={css.settingsGroup}>
					<h2>Multi-Server</h2>
					{renderToggleItem('Unified Library Mode', 'Combine content from all servers into a single view', 'unifiedLibraryMode')}
				</div>
			)}
			<div className={css.settingsGroup}>
				<h2>Navigation Bar</h2>
				{renderSettingItem('Navigation Style', 'Position of navigation: top bar or left sidebar',
					settings.navbarPosition === 'left' ? 'Left Sidebar' : 'Top Bar',
					() => updateSetting('navbarPosition', settings.navbarPosition === 'left' ? 'top' : 'left'),
					'setting-navbarPosition'
				)}
				{renderToggleItem('Show Shuffle Button', 'Show shuffle button in navigation bar', 'showShuffleButton')}
				{settings.showShuffleButton && renderSettingItem('Shuffle Content Type', 'Type of content to shuffle',
					getShuffleContentTypeLabel(), cycleShuffleContentType, 'setting-shuffleContentType'
				)}
				{renderToggleItem('Show Genres Button', 'Show genres button in navigation bar', 'showGenresButton')}
				{renderToggleItem('Show Favorites Button', 'Show favorites button in navigation bar', 'showFavoritesButton')}
				{renderToggleItem('Show Libraries in Toolbar', 'Show expandable library shortcuts in navigation bar', 'showLibrariesInToolbar')}
			</div>
			<div className={css.settingsGroup}>
				<h2>Home Screen</h2>
				{renderToggleItem('Merge Continue Watching & Next Up', 'Combine into a single row', 'mergeContinueWatchingNextUp')}
				{renderSettingItem('Configure Home Rows', 'Customize which rows appear on home screen',
					'Edit...', openHomeRowsModal, 'setting-homeRows'
				)}
			</div>
			<div className={css.settingsGroup}>
				<h2>Libraries</h2>
				{renderSettingItem('Hide Libraries', 'Choose which libraries to hide (syncs across all Jellyfin clients)',
					'Edit...', openLibraryModal, 'setting-hideLibraries'
				)}
			</div>
			<div className={css.settingsGroup}>
				<h2>Debugging</h2>
				{renderToggleItem('Server Logging', 'Send logs to Jellyfin server for troubleshooting', 'serverLogging')}
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
				{renderSettingItem('Seek Step', 'Seconds to skip when seeking',
					getSeekStepLabel(), cycleSeekStep, 'setting-seekStep'
				)}
			</div>
			<div className={css.settingsGroup}>
				<h2>Subtitles</h2>
				{renderSettingItem('Subtitle Size', 'Size of subtitle text',
					getSubtitleSizeLabel(), cycleSubtitleSize, 'setting-subtitleSize'
				)}
				{renderSettingItem('Subtitle Position', 'Vertical position of subtitles',
					getSubtitlePositionLabel(), cycleSubtitlePosition, 'setting-subtitlePosition'
				)}
				{settings.subtitlePosition === 'absolute' && (
					<div className={css.sliderItem}>
						<div className={css.sliderLabel}>
							<span>Absolute Position</span>
							<span className={css.sliderValue}>{settings.subtitlePositionAbsolute}%</span>
						</div>
						<Slider
							min={0}
							max={100}
							step={5}
							value={settings.subtitlePositionAbsolute}
							onChange={handleSliderPositionAbsolute}
							className={css.settingsSlider}
							tooltip={false}
							spotlightId="setting-subtitlePositionAbsolute"
						/>
					</div>
				)}
				<div className={css.sliderItem}>
					<div className={css.sliderLabel}>
						<span>Text Opacity</span>
						<span className={css.sliderValue}>{settings.subtitleOpacity}%</span>
					</div>
					<Slider
						min={0}
						max={100}
						step={5}
						value={settings.subtitleOpacity}
						onChange={handleSliderOpacity}
						className={css.settingsSlider}
						tooltip={false}
						spotlightId="setting-subtitleOpacity"
					/>
				</div>
				{renderSettingItem('Text Color', 'Color of subtitle text',
					getSubtitleColorLabel(), cycleSubtitleColor, 'setting-subtitleColor'
				)}

				<div className={css.divider} />

				{renderSettingItem('Shadow Color', 'Color of subtitle shadow',
					getSubtitleShadowColorLabel(), cycleSubtitleShadowColor, 'setting-subtitleShadowColor'
				)}
				<div className={css.sliderItem}>
					<div className={css.sliderLabel}>
						<span>Shadow Opacity</span>
						<span className={css.sliderValue}>{settings.subtitleShadowOpacity}%</span>
					</div>
					<Slider
						min={0}
						max={100}
						step={5}
						value={settings.subtitleShadowOpacity}
						onChange={handleSliderShadowOpacity}
						className={css.settingsSlider}
						tooltip={false}
						spotlightId="setting-subtitleShadowOpacity"
					/>
				</div>
				<div className={css.sliderItem}>
					<div className={css.sliderLabel}>
						<span>Shadow Size (Blur)</span>
						<span className={css.sliderValue}>{settings.subtitleShadowBlur ? settings.subtitleShadowBlur.toFixed(1) : '0.1'}</span>
					</div>
					<Slider
						min={0}
						max={1}
						step={0.1}
						value={settings.subtitleShadowBlur || 0.1}
						onChange={handleSliderShadowBlur}
						className={css.settingsSlider}
						tooltip={false}
						spotlightId="setting-subtitleShadowBlur"
					/>
				</div>

				<div className={css.divider} />

				{renderSettingItem('Background Color', 'Color of subtitle background',
					getSubtitleBackgroundColorLabel(), cycleSubtitleBackgroundColor, 'setting-subtitleBackgroundColor'
				)}
				<div className={css.sliderItem}>
					<div className={css.sliderLabel}>
						<span>Background Opacity</span>
						<span className={css.sliderValue}>{settings.subtitleBackground}%</span>
					</div>
					<Slider
						min={0}
						max={100}
						step={5}
						value={settings.subtitleBackground}
						onChange={handleSliderBackground}
						className={css.settingsSlider}
						tooltip={false}
						spotlightId="setting-subtitleBackground"
					/>
				</div>
			</div>
			<div className={css.settingsGroup}>
				<h2>Transcoding</h2>
				{renderToggleItem('Prefer Transcoding', 'Request transcoded streams when available', 'preferTranscode')}
				{renderToggleItem('Force Direct Play', 'Skip codec checks and always attempt DirectPlay (debug)', 'forceDirectPlay')}
			</div>
		</div>
	);

	const renderDisplayPanel = () => (
		<div className={css.panel}>
			<h1>Display Settings</h1>
			<div className={css.settingsGroup}>
				<h2>Backdrop</h2>
				{renderSettingItem('Home Backdrop Blur', 'Amount of blur on home screen backdrop',
					getBackdropBlurLabel(settings.backdropBlurHome), cycleBackdropBlurHome, 'setting-backdropBlurHome'
				)}
				{renderSettingItem('Details Backdrop Blur', 'Amount of blur on details page backdrop',
					getBackdropBlurLabel(settings.backdropBlurDetail), cycleBackdropBlurDetail, 'setting-backdropBlurDetail'
				)}
			</div>
			<div className={css.settingsGroup}>
				<h2>UI Elements</h2>
				{renderSettingItem('UI Opacity', 'Background opacity of navbar and UI panels',
					getUiOpacityLabel(), cycleUiOpacity, 'setting-uiOpacity'
				)}
				{renderSettingItem('UI Color', 'Background color of navbar and UI panels',
					getUiColorLabel(), cycleUiColor, 'setting-uiColor'
				)}
			</div>
			<div className={css.settingsGroup}>
				<h2>Featured Carousel</h2>
				{renderToggleItem('Show Featured Bar', 'Display the featured media carousel on home screen', 'showFeaturedBar')}
				{renderSettingItem('Content Type', 'Type of content to display in featured carousel',
					getFeaturedContentTypeLabel(), cycleFeaturedContentType, 'setting-featuredContentType'
				)}
				{renderSettingItem('Item Count', 'Number of items in featured carousel',
					getFeaturedItemCountLabel(), cycleFeaturedItemCount, 'setting-featuredItemCount'
				)}
			</div>
		</div>
	);

	const renderPluginPanel = () => {
		const info = jellyseerr.pluginInfo;
		const isConnected = settings.useMoonfinPlugin && info;

		return (
			<div className={css.panel}>
				<h1>Plugin Settings</h1>

				<div className={css.settingsGroup}>
					<h2>Moonfin Plugin</h2>
					{renderSettingItem(
						'Enable Plugin',
						'Connect to the Moonfin server plugin for ratings, settings sync, and Jellyseerr/Seerr proxy',
						settings.useMoonfinPlugin ? 'On' : 'Off',
						handleMoonfinToggle,
						'setting-useMoonfinPlugin'
					)}

					{settings.useMoonfinPlugin && moonfinStatus && (
						<div className={css.statusMessage}>{moonfinStatus}</div>
					)}

					{settings.useMoonfinPlugin && moonfinLoginMode && (
						<>
							<div className={css.inputGroup}>
								<label>{seerrLabel} Username</label>
								<SpottableInput
									type="text"
									placeholder={`Enter ${seerrLabel} username`}
									value={moonfinUsername}
									onChange={handleMoonfinUsernameChange}
									className={css.input}
									spotlightId="moonfin-username"
								/>
							</div>
							<div className={css.inputGroup}>
								<label>{seerrLabel} Password</label>
								<SpottableInput
									type="password"
									placeholder={`Enter ${seerrLabel} password`}
									value={moonfinPassword}
									onChange={handleMoonfinPasswordChange}
									className={css.input}
									spotlightId="moonfin-password"
								/>
							</div>
							<SpottableButton
								className={css.actionButton}
								onClick={handleMoonfinLogin}
								disabled={moonfinConnecting}
								spotlightId="moonfin-login-submit"
							>
								{moonfinConnecting ? 'Logging in...' : 'Log In'}
							</SpottableButton>
						</>
					)}
				</div>

				{isConnected && (
					<div className={css.settingsGroup}>
						<h2>Plugin Status</h2>
						<SpottableDiv className={css.infoItem} tabIndex={0}>
							<span className={css.infoLabel}>Plugin Version</span>
							<span className={css.infoValue}>{info.version || 'Unknown'}</span>
						</SpottableDiv>
						<SpottableDiv className={css.infoItem} tabIndex={0}>
							<span className={css.infoLabel}>Settings Sync</span>
							<span className={css.infoValue}>{info.settingsSyncEnabled ? 'Available' : 'Not Available'}</span>
						</SpottableDiv>
						<SpottableDiv className={css.infoItem} tabIndex={0}>
							<span className={css.infoLabel}>{seerrLabel}</span>
							<span className={css.infoValue}>
								{info.jellyseerrEnabled ? 'Enabled by Admin' : 'Disabled by Admin'}
							</span>
						</SpottableDiv>
						<SpottableDiv className={css.infoItem} tabIndex={0}>
							<span className={css.infoLabel}>MDBList Ratings</span>
							<span className={css.infoValue}>
								{info.mdblistAvailable ? 'Available' : settings.mdblistApiKey ? 'User Key' : 'Not Configured'}
							</span>
						</SpottableDiv>
						<SpottableDiv className={css.infoItem} tabIndex={0}>
							<span className={css.infoLabel}>TMDB Ratings</span>
							<span className={css.infoValue}>
								{info.tmdbAvailable ? 'Available' : settings.tmdbApiKey ? 'User Key' : 'Not Configured'}
							</span>
						</SpottableDiv>
						{isSeerr && (
							<SpottableDiv className={css.infoItem} tabIndex={0}>
								<span className={css.infoLabel}>Detected Variant</span>
								<span className={css.infoValue}>{seerrLabel} (Seerr v3+)</span>
							</SpottableDiv>
						)}
					</div>
				)}

				{isConnected && (
					<div className={css.settingsGroup}>
						<h2>MDBList Ratings</h2>
						{renderToggleItem('Enable Ratings', 'Show MDBList ratings on media details and featured bar', 'mdblistEnabled')}

						{settings.mdblistEnabled && (
							<>
								<div className={css.inputGroup}>
									<label>Personal API Key {info.mdblistAvailable ? '(optional)' : '(required)'}</label>
									<SpottableInput
										type="text"
										placeholder={info.mdblistAvailable ? 'Leave blank to use server key' : 'Enter your MDBList API key'}
										value={settings.mdblistApiKey || ''}
										onChange={(e) => updateSetting('mdblistApiKey', e.target ? e.target.value : e.value || '')}
										className={css.input}
										spotlightId="setting-mdblist-api-key"
									/>
								</div>
								<h3 className={css.subHeader}>Rating Sources</h3>
							{MDBLIST_SOURCE_OPTIONS.map(source => (
								<SpottableDiv
									key={source.value}
									className={css.settingItem}
									onClick={() => toggleMdblistSource(source.value)}
									spotlightId={`setting-mdblist-${source.value}`}
								>
									<div className={css.settingLabel}>
										<div className={css.settingTitle}>
											<img
												src={`${serverUrl}/Moonfin/Assets/${source.icon}`}
												alt={source.label}
												className={css.sourceIcon}
											/>
											{source.label}
										</div>
									</div>
									<div className={css.settingValue}>
										{(settings.mdblistRatingSources || []).includes(source.value) ? 'On' : 'Off'}
									</div>
								</SpottableDiv>
							))}
							</>
						)}
					</div>
				)}

				{isConnected && (
					<div className={css.settingsGroup}>
						<h2>TMDB</h2>
						{renderToggleItem('Episode Ratings', 'Show TMDB ratings on individual episodes', 'tmdbEpisodeRatingsEnabled')}
						{settings.tmdbEpisodeRatingsEnabled && (
							<div className={css.inputGroup}>
								<label>Personal API Key {info.tmdbAvailable ? '(optional)' : '(required)'}</label>
								<SpottableInput
									type="text"
									placeholder={info.tmdbAvailable ? 'Leave blank to use server key' : 'Enter your TMDB API key'}
									value={settings.tmdbApiKey || ''}
									onChange={(e) => updateSetting('tmdbApiKey', e.target ? e.target.value : e.value || '')}
									className={css.input}
									spotlightId="setting-tmdb-api-key"
								/>
							</div>
						)}
					</div>
				)}

				{!settings.useMoonfinPlugin && (
					<div className={css.settingsGroup}>
						<p className={css.authHint}>
							Enable the Moonfin plugin to access ratings, settings sync,
							and {seerrLabel} proxy features. The plugin must be installed
							on your Jellyfin server.
						</p>
					</div>
				)}
			</div>
		);
	};

	const renderJellyseerrPanel = () => {
		return (
		<div className={css.panel}>
			<h1>{seerrLabel} Settings</h1>

			{settings.useMoonfinPlugin ? (
				<div className={css.settingsGroup}>
					<h2>{seerrLabel} via Plugin</h2>
					{jellyseerr.isEnabled && jellyseerr.isAuthenticated && jellyseerr.isMoonfin ? (
						<>
							<div className={css.infoItem}>
								<span className={css.infoLabel}>Status</span>
								<span className={css.infoValue}>Connected via Moonfin</span>
							</div>
							{jellyseerr.serverUrl && (
								<div className={css.infoItem}>
									<span className={css.infoLabel}>{seerrLabel} URL</span>
									<span className={css.infoValue}>{jellyseerr.serverUrl}</span>
								</div>
							)}
							{jellyseerr.user && (
								<div className={css.infoItem}>
									<span className={css.infoLabel}>User</span>
									<span className={css.infoValue}>
										{jellyseerr.user.displayName || 'Moonfin User'}
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
						<p className={css.authHint}>
							{seerrLabel} is managed through the Moonfin plugin.
							Enable and configure the plugin in the Plugin settings tab.
						</p>
					)}
				</div>
			) : (
				<div className={css.settingsGroup}>
					<p className={css.authHint}>
						Enable the Moonfin plugin to access {seerrLabel}.
						The plugin must be installed on your Jellyfin server.
					</p>
				</div>
			)}
		</div>
		);
	};

	const renderAboutPanel = () => (
		<div className={css.panel}>
			<h1>About</h1>
			<div className={css.settingsGroup}>
				<h2>Application</h2>
				<SpottableDiv className={css.infoItem} tabIndex={0}>
					<span className={css.infoLabel}>App Version</span>
					<span className={css.infoValue}>2.0.0</span>
				</SpottableDiv>
				<SpottableDiv className={css.infoItem} tabIndex={0}>
					<span className={css.infoLabel}>Platform</span>
					<span className={css.infoValue}>
						{capabilities?.webosVersionDisplay
							? `webOS ${capabilities.webosVersionDisplay}`
							: 'webOS'}
					</span>
				</SpottableDiv>
			</div>

			<div className={css.settingsGroup}>
				<h2>Server</h2>
				<SpottableDiv className={css.infoItem} tabIndex={0}>
					<span className={css.infoLabel}>Server URL</span>
					<span className={css.infoValue}>{serverUrl || 'Not connected'}</span>
				</SpottableDiv>
				<SpottableDiv className={css.infoItem} tabIndex={0}>
					<span className={css.infoLabel}>Server Version</span>
					<span className={css.infoValue}>{serverVersion || 'Loading...'}</span>
				</SpottableDiv>
			</div>

			{capabilities && (
				<div className={css.settingsGroup}>
					<h2>Device</h2>
					<SpottableDiv className={css.infoItem} tabIndex={0}>
						<span className={css.infoLabel}>Model</span>
						<span className={css.infoValue}>{capabilities.modelName || 'Unknown'}</span>
					</SpottableDiv>
					{capabilities.firmwareVersion && (
						<SpottableDiv className={css.infoItem} tabIndex={0}>
							<span className={css.infoLabel}>Firmware</span>
							<span className={css.infoValue}>{capabilities.firmwareVersion}</span>
						</SpottableDiv>
					)}
					<SpottableDiv className={css.infoItem} tabIndex={0}>
						<span className={css.infoLabel}>Resolution</span>
						<span className={css.infoValue}>
							{capabilities.uhd8K ? '7680x4320 (8K)' :
							 capabilities.uhd ? '3840x2160 (4K)' :
							 '1920x1080 (HD)'}
							{capabilities.oled && ' OLED'}
						</span>
					</SpottableDiv>
				</div>
			)}

			{capabilities && (
				<div className={css.settingsGroup}>
					<h2>Capabilities</h2>
					<SpottableDiv className={css.infoItem} tabIndex={0}>
						<span className={css.infoLabel}>HDR</span>
						<span className={css.infoValue}>
							{[
								capabilities.hdr10 && 'HDR10',
								capabilities.hdr10Plus && 'HDR10+',
								capabilities.hlg && 'HLG',
								capabilities.dolbyVision && 'Dolby Vision'
							].filter(Boolean).join(', ') || 'Not supported'}
						</span>
					</SpottableDiv>
					<SpottableDiv className={css.infoItem} tabIndex={0}>
						<span className={css.infoLabel}>Video Codecs</span>
						<span className={css.infoValue}>
							{[
								'H.264',
								capabilities.hevc && 'HEVC',
								capabilities.vp9 && 'VP9',
								capabilities.av1 && 'AV1'
							].filter(Boolean).join(', ')}
						</span>
					</SpottableDiv>
					<SpottableDiv className={css.infoItem} tabIndex={0}>
						<span className={css.infoLabel}>Audio Codecs</span>
						<span className={css.infoValue}>
							{[
								'AAC',
								capabilities.ac3 && 'AC3',
								capabilities.eac3 && 'E-AC3',
								capabilities.dts && 'DTS',
								capabilities.dolbyAtmos && 'Atmos'
							].filter(Boolean).join(', ')}
						</span>
					</SpottableDiv>
					<SpottableDiv className={css.infoItem} tabIndex={0}>
						<span className={css.infoLabel}>Containers</span>
						<span className={css.infoValue}>
							{[
								'MP4',
								capabilities.mkv && 'MKV',
								'TS',
								capabilities.webm && 'WebM',
								capabilities.asf && 'ASF'
							].filter(Boolean).join(', ')}
						</span>
					</SpottableDiv>
				</div>
			)}
		</div>
	);

	const renderHomeRowsModal = () => {
		return (
			<Popup
				open={showHomeRowsModal}
				onClose={closeHomeRowsModal}
				position="center"
				scrimType="translucent"
				noAutoDismiss
			>
				<div className={css.popupContent}>
					<h2 className={css.popupTitle}>Configure Home Rows</h2>
					<p className={css.popupDescription}>
						Enable/disable and reorder the rows that appear on your home screen.
					</p>
					<div className={css.homeRowsList}>
						{tempHomeRows.map((row, index) => (
							<div key={row.id} className={css.homeRowItem}>
								<Button
									className={css.homeRowToggle}
									onClick={handleHomeRowToggleClick}
									data-row-id={row.id}
									size="small"
								>
									<span className={css.checkbox}>{row.enabled ? '☑' : '☐'}</span>
									<span className={css.homeRowName}>{row.name}</span>
								</Button>
								<div className={css.homeRowControls}>
									<Button
										className={css.moveButton}
										onClick={handleHomeRowUpClick}
										data-row-id={row.id}
										disabled={index === 0}
										size="small"
										icon="arrowlargeup"
									/>
									<Button
										className={css.moveButton}
										onClick={handleHomeRowDownClick}
										data-row-id={row.id}
										disabled={index === tempHomeRows.length - 1}
										size="small"
										icon="arrowlargedown"
									/>
								</div>
							</div>
						))}
					</div>
					<div className={css.popupButtons}>
						<Button
							onClick={resetHomeRows}
							size="small"
						>
							Reset to Default
						</Button>
						<Button
							onClick={closeHomeRowsModal}
							size="small"
						>
							Cancel
						</Button>
						<Button
							onClick={saveHomeRows}
							size="small"
							className={css.primaryButton}
						>
							Save
						</Button>
					</div>
				</div>
			</Popup>
		);
	};

	const isUnifiedModal = settings.unifiedLibraryMode && hasMultipleServers;

	const renderLibraryModal = () => (
		<Popup
			open={showLibraryModal}
			onClose={closeLibraryModal}
			position="center"
			scrimType="translucent"
			noAutoDismiss
		>
			<div className={css.popupContent}>
				<h2 className={css.popupTitle}>Hide Libraries</h2>
				<p className={css.popupDescription}>
					Hidden libraries are removed from all Jellyfin clients. This is a server-level setting.
				</p>
				{libraryLoading ? (
					<div className={css.libraryListLoading}>Loading libraries...</div>
				) : (
					<div className={css.homeRowsList}>
						{allLibraries.map(lib => {
							const isHidden = hiddenLibraries.includes(lib.Id);
							return (
								<div key={`${lib._serverUrl || 'local'}-${lib.Id}`} className={css.homeRowItem}>
									<Button
										className={css.homeRowToggle}
										onClick={handleLibraryToggleClick}
										data-library-id={lib.Id}
										size="small"
									>
										<span className={css.checkbox}>{isHidden ? '☐' : '☑'}</span>
										<span className={css.homeRowName}>
											{lib.Name}{isUnifiedModal && lib._serverName ? ` (${lib._serverName})` : ''}
										</span>
									</Button>
								</div>
							);
						})}
					</div>
				)}
				<div className={css.popupButtons}>
					<Button
						onClick={closeLibraryModal}
						size="small"
					>
						Cancel
					</Button>
					<Button
						onClick={saveLibraryVisibility}
						size="small"
						className={css.primaryButton}
						disabled={librarySaving}
					>
						{librarySaving ? 'Saving...' : 'Save'}
					</Button>
				</div>
			</div>
		</Popup>
	);

	const renderPanel = () => {
		switch (activeCategory) {
			case 'general': return renderGeneralPanel();
			case 'playback': return renderPlaybackPanel();
			case 'display': return renderDisplayPanel();
			case 'plugin': return renderPluginPanel();
			case 'jellyseerr': return renderJellyseerrPanel();
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
				{categories.map(cat => (
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

			{renderHomeRowsModal()}
			{renderLibraryModal()}
		</div>
	);
};

export default Settings;
