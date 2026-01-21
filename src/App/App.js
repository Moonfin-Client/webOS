import {useState, useCallback, useEffect} from 'react';
import ThemeDecorator from '@enact/sandstone/ThemeDecorator';

import {AuthProvider, useAuth} from '../context/AuthContext';
import {SettingsProvider} from '../context/SettingsContext';
import {JellyseerrProvider} from '../context/JellyseerrContext';
import Login from '../views/Login';
import Browse from '../views/Browse';
import Details from '../views/Details';
import Library from '../views/Library';
import Search from '../views/Search';
import Settings from '../views/Settings';
import Player from '../views/Player';
import Favorites from '../views/Favorites';
import Person from '../views/Person';
import LiveTV from '../views/LiveTV';
import JellyseerrDiscover from '../views/JellyseerrDiscover';
import JellyseerrDetails from '../views/JellyseerrDetails';
import JellyseerrRequests from '../views/JellyseerrRequests';

import css from './App.module.less';

const PANELS = {
	LOGIN: 0,
	BROWSE: 1,
	DETAILS: 2,
	LIBRARY: 3,
	SEARCH: 4,
	SETTINGS: 5,
	PLAYER: 6,
	FAVORITES: 7,
	PERSON: 8,
	LIVETV: 9,
	JELLYSEERR_DISCOVER: 10,
	JELLYSEERR_DETAILS: 11,
	JELLYSEERR_REQUESTS: 12
};

const AppContent = (props) => {
	const {isAuthenticated, isLoading} = useAuth();
	const [panelIndex, setPanelIndex] = useState(PANELS.LOGIN);
	const [selectedItem, setSelectedItem] = useState(null);
	const [selectedLibrary, setSelectedLibrary] = useState(null);
	const [selectedPerson, setSelectedPerson] = useState(null);
	const [playingItem, setPlayingItem] = useState(null);
	const [panelHistory, setPanelHistory] = useState([]);
	const [jellyseerrItem, setJellyseerrItem] = useState(null);
	const [authChecked, setAuthChecked] = useState(false);

	// Update panel when auth state is determined
	useEffect(() => {
		if (!isLoading && !authChecked) {
			setAuthChecked(true);
			if (isAuthenticated) {
				setPanelIndex(PANELS.BROWSE);
			}
		}
	}, [isLoading, isAuthenticated, authChecked]);

	const navigateTo = useCallback((panel, addToHistory = true) => {
		if (addToHistory && panelIndex !== PANELS.LOGIN) {
			setPanelHistory(prev => [...prev, panelIndex]);
		}
		setPanelIndex(panel);
	}, [panelIndex]);

	const handleBack = useCallback(() => {
		if (panelHistory.length > 0) {
			const prevPanel = panelHistory[panelHistory.length - 1];
			setPanelHistory(prev => prev.slice(0, -1));
			setPanelIndex(prevPanel);
		} else if (panelIndex > PANELS.BROWSE) {
			setPanelIndex(PANELS.BROWSE);
		}
	}, [panelHistory, panelIndex]);

	// Global back button handler
	useEffect(() => {
		const handleKeyDown = (e) => {
			// webOS back button (461) or Escape key (27)
			if (e.keyCode === 461 || e.keyCode === 27) {
				// Don't handle back if we're on Login or Browse (root)
				if (panelIndex !== PANELS.LOGIN && panelIndex !== PANELS.BROWSE) {
					e.preventDefault();
					e.stopPropagation();
					handleBack();
				}
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [panelIndex, handleBack]);

	const handleLoggedIn = useCallback(() => {
		setPanelHistory([]);
		navigateTo(PANELS.BROWSE, false);
	}, [navigateTo]);

	const handleSelectItem = useCallback((item) => {
		setSelectedItem(item);
		navigateTo(PANELS.DETAILS);
	}, [navigateTo]);

	const handleSelectLibrary = useCallback((library) => {
		setSelectedLibrary(library);
		navigateTo(PANELS.LIBRARY);
	}, [navigateTo]);

	const handlePlay = useCallback((item) => {
		setPlayingItem(item);
		navigateTo(PANELS.PLAYER);
	}, [navigateTo]);

	const handlePlayNext = useCallback((item) => {
		setPlayingItem(item);
	}, []);

	const handlePlayerEnd = useCallback(() => {
		setPlayingItem(null);
		handleBack();
	}, [handleBack]);

	const handleOpenSearch = useCallback(() => {
		navigateTo(PANELS.SEARCH);
	}, [navigateTo]);

	const handleOpenSettings = useCallback(() => {
		navigateTo(PANELS.SETTINGS);
	}, [navigateTo]);

	const handleOpenFavorites = useCallback(() => {
		navigateTo(PANELS.FAVORITES);
	}, [navigateTo]);

	const handleSelectPerson = useCallback((person) => {
		setSelectedPerson(person);
		navigateTo(PANELS.PERSON);
	}, [navigateTo]);

	const handleOpenLiveTV = useCallback(() => {
		navigateTo(PANELS.LIVETV);
	}, [navigateTo]);

	const handlePlayChannel = useCallback((channel) => {
		setPlayingItem(channel);
		navigateTo(PANELS.PLAYER);
	}, [navigateTo]);

	const handleOpenJellyseerr = useCallback(() => {
		navigateTo(PANELS.JELLYSEERR_DISCOVER);
	}, [navigateTo]);

	const handleOpenJellyseerrRequests = useCallback(() => {
		navigateTo(PANELS.JELLYSEERR_REQUESTS);
	}, [navigateTo]);

	const handleSelectJellyseerrItem = useCallback((item) => {
		setJellyseerrItem(item);
		navigateTo(PANELS.JELLYSEERR_DETAILS);
	}, [navigateTo]);

	// Show loading screen while auth state is being determined
	if (isLoading || !authChecked) {
		return <div className={css.loading} />;
	}

	// Render only the active view - no Panels overhead
	const renderView = () => {
		switch (panelIndex) {
			case PANELS.LOGIN:
				return <Login onLoggedIn={handleLoggedIn} />;
			case PANELS.BROWSE:
				return (
					<Browse
						onSelectItem={handleSelectItem}
						onSelectLibrary={handleSelectLibrary}
						onOpenSearch={handleOpenSearch}
						onOpenSettings={handleOpenSettings}
						onOpenFavorites={handleOpenFavorites}
						onOpenLiveTV={handleOpenLiveTV}
						onOpenJellyseerr={handleOpenJellyseerr}
					/>
				);
			case PANELS.DETAILS:
				return (
					<Details
						itemId={selectedItem?.Id}
						onPlay={handlePlay}
						onSelectItem={handleSelectItem}
						onSelectPerson={handleSelectPerson}
						onBack={handleBack}
					/>
				);
			case PANELS.LIBRARY:
				return (
					<Library
						library={selectedLibrary}
						onSelectItem={handleSelectItem}
						onBack={handleBack}
					/>
				);
			case PANELS.SEARCH:
				return <Search onSelectItem={handleSelectItem} onBack={handleBack} />;
			case PANELS.SETTINGS:
				return <Settings onBack={handleBack} />;
			case PANELS.PLAYER:
				return playingItem ? (
					<Player
						item={playingItem}
						onEnded={handlePlayerEnd}
						onBack={handlePlayerEnd}
						onPlayNext={handlePlayNext}
					/>
				) : null;
			case PANELS.FAVORITES:
				return <Favorites onSelectItem={handleSelectItem} onBack={handleBack} />;
			case PANELS.PERSON:
				return <Person personId={selectedPerson?.Id} onSelectItem={handleSelectItem} onBack={handleBack} />;
			case PANELS.LIVETV:
				return <LiveTV onPlayChannel={handlePlayChannel} onBack={handleBack} />;
			case PANELS.JELLYSEERR_DISCOVER:
				return (
					<JellyseerrDiscover
						onSelectItem={handleSelectJellyseerrItem}
						onOpenRequests={handleOpenJellyseerrRequests}
						onBack={handleBack}
					/>
				);
			case PANELS.JELLYSEERR_DETAILS:
				return (
					<JellyseerrDetails
						mediaType={jellyseerrItem?.mediaType}
						mediaId={jellyseerrItem?.mediaId}
						onClose={handleBack}
					/>
				);
			case PANELS.JELLYSEERR_REQUESTS:
				return (
					<JellyseerrRequests
						onSelectItem={handleSelectJellyseerrItem}
						onClose={handleBack}
					/>
				);
			default:
				return <Browse onSelectItem={handleSelectItem} />;
		}
	};

	return (
		<div className={css.app} {...props}>
			{renderView()}
		</div>
	);
};

const AppBase = (props) => (
	<SettingsProvider>
		<AuthProvider>
			<JellyseerrProvider>
				<AppContent {...props} />
			</JellyseerrProvider>
		</AuthProvider>
	</SettingsProvider>
);

const App = ThemeDecorator(AppBase);
export default App;
