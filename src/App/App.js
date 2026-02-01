import {useState, useCallback, useEffect} from 'react';
import ThemeDecorator from '@enact/sandstone/ThemeDecorator';

import {AuthProvider, useAuth} from '../context/AuthContext';
import {SettingsProvider} from '../context/SettingsContext';
import {JellyseerrProvider} from '../context/JellyseerrContext';
import {useVersionCheck} from '../hooks/useVersionCheck';
import UpdateNotification from '../components/UpdateNotification';
import NavBar from '../components/NavBar';
import Login from '../views/Login';
import Browse from '../views/Browse';
import Details from '../views/Details';
import Library from '../views/Library';
import Search from '../views/Search';
import Settings from '../views/Settings';
import Player from '../views/Player';
import Favorites from '../views/Favorites';
import Genres from '../views/Genres';
import GenreBrowse from '../views/GenreBrowse';
import Person from '../views/Person';
import LiveTV from '../views/LiveTV';
import Recordings from '../views/Recordings';
import JellyseerrDiscover from '../views/JellyseerrDiscover';
import JellyseerrDetails from '../views/JellyseerrDetails';
import JellyseerrRequests from '../views/JellyseerrRequests';
import JellyseerrBrowse from '../views/JellyseerrBrowse';
import JellyseerrPerson from '../views/JellyseerrPerson';

import css from './App.module.less';

const EXCLUDED_COLLECTION_TYPES = ['playlists', 'books', 'music', 'musicvideos', 'homevideos', 'photos'];

const PANELS = {
	LOGIN: 0,
	BROWSE: 1,
	DETAILS: 2,
	LIBRARY: 3,
	SEARCH: 4,
	SETTINGS: 5,
	PLAYER: 6,
	FAVORITES: 7,
	GENRES: 8,
	PERSON: 9,
	LIVETV: 10,
	JELLYSEERR_DISCOVER: 11,
	JELLYSEERR_DETAILS: 12,
	JELLYSEERR_REQUESTS: 13,
	GENRE_BROWSE: 14,
	RECORDINGS: 15,
	JELLYSEERR_BROWSE: 16,
	JELLYSEERR_PERSON: 17,
	ADD_SERVER: 18,
	ADD_USER: 19
};

const AppContent = (props) => {
	const {isAuthenticated, isLoading, logout, serverUrl, serverName, api, user} = useAuth();
	const [panelIndex, setPanelIndex] = useState(PANELS.LOGIN);
	const [selectedItem, setSelectedItem] = useState(null);
	const [selectedLibrary, setSelectedLibrary] = useState(null);
	const [selectedPerson, setSelectedPerson] = useState(null);
	const [selectedGenre, setSelectedGenre] = useState(null);
	const [selectedGenreLibraryId, setSelectedGenreLibraryId] = useState(null);
	const [playingItem, setPlayingItem] = useState(null);
	const [panelHistory, setPanelHistory] = useState([]);
	const [jellyseerrItem, setJellyseerrItem] = useState(null);
	const [jellyseerrBrowse, setJellyseerrBrowse] = useState(null);
	const [jellyseerrPerson, setJellyseerrPerson] = useState(null);
	const [authChecked, setAuthChecked] = useState(false);
	const [libraries, setLibraries] = useState([]);

	useEffect(() => {
		const fetchLibraries = async () => {
			if (isAuthenticated && api && user) {
				try {
					const result = await api.getLibraries();
					const libs = result.Items || [];
					const filtered = libs.filter(lib => !EXCLUDED_COLLECTION_TYPES.includes(lib.CollectionType?.toLowerCase()));
					setLibraries(filtered);
				} catch (err) {
					console.error('Failed to fetch libraries:', err);
				}
			} else {
				setLibraries([]);
			}
		};
		fetchLibraries();
	}, [isAuthenticated, api, user]);

	const {updateInfo, formattedNotes, dismiss: dismissUpdate} = useVersionCheck(isAuthenticated ? 3000 : null);
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
		if (panelIndex === PANELS.ADD_SERVER || panelIndex === PANELS.ADD_USER) {
			setPanelHistory([]);
			setPanelIndex(PANELS.SETTINGS);
			return;
		}
		if (panelHistory.length > 0) {
			const prevPanel = panelHistory[panelHistory.length - 1];
			setPanelHistory(prev => prev.slice(0, -1));
			setPanelIndex(prevPanel);
		} else if (panelIndex > PANELS.BROWSE) {
			setPanelIndex(PANELS.BROWSE);
		}
	}, [panelHistory, panelIndex]);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.keyCode === 8 && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
				return;
			}
			if (e.keyCode === 461 || e.keyCode === 27 || e.keyCode === 8) {
				e.preventDefault();

				if (panelIndex === PANELS.BROWSE || panelIndex === PANELS.LOGIN) {
					e.stopPropagation();
					return;
				}
				if (panelIndex === PANELS.PLAYER || panelIndex === PANELS.SETTINGS) {
					return;
				}
				e.stopPropagation();
				handleBack();
			}
		};

		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [panelIndex, handleBack]);

	const handleLoggedIn = useCallback(() => {
		setPanelHistory([]);
		navigateTo(PANELS.BROWSE, false);
	}, [navigateTo]);

	const handleShuffle = useCallback(async () => {
		try {
			const items = await api.getRandomItem('Movie,Series');
			if (items.Items?.length > 0) {
				const item = items.Items[0];
				setSelectedItem(item);
				navigateTo(PANELS.DETAILS);
			}
		} catch (err) {
			console.error('Shuffle failed:', err);
		}
	}, [api, navigateTo]);

	const handleSelectItem = useCallback((item) => {
		setSelectedItem(item);
		navigateTo(PANELS.DETAILS);
	}, [navigateTo]);

	const handleSelectLibrary = useCallback((library) => {
		// Check if this is a Live TV library - redirect to Live TV view
		if (library.CollectionType === 'livetv') {
			navigateTo(PANELS.LIVETV);
			return;
		}
		setSelectedLibrary(library);
		navigateTo(PANELS.LIBRARY);
	}, [navigateTo]);

	const [playbackOptions, setPlaybackOptions] = useState(null);

	const handlePlay = useCallback((item, resume, options) => {
		setPlayingItem(item);
		setPlaybackOptions(options || null);
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

	const handleOpenGenres = useCallback(() => {
		navigateTo(PANELS.GENRES);
	}, [navigateTo]);

	const handleSelectGenre = useCallback((genre, libraryId) => {
		setSelectedGenre(genre);
		setSelectedGenreLibraryId(libraryId);
		navigateTo(PANELS.GENRE_BROWSE);
	}, [navigateTo]);

	const handleSelectPerson = useCallback((person) => {
		setSelectedPerson(person);
		navigateTo(PANELS.PERSON);
	}, [navigateTo]);

	const handlePlayChannel = useCallback((channel) => {
		setPlayingItem(channel);
		navigateTo(PANELS.PLAYER);
	}, [navigateTo]);

	const handleOpenRecordings = useCallback(() => {
		navigateTo(PANELS.RECORDINGS);
	}, [navigateTo]);

	const handlePlayRecording = useCallback((recording) => {
		setPlayingItem(recording);
		navigateTo(PANELS.PLAYER);
	}, [navigateTo]);

	const handleOpenJellyseerr = useCallback(() => {
		navigateTo(PANELS.JELLYSEERR_DISCOVER);
	}, [navigateTo]);

	const handleHome = useCallback(() => {
		setPanelHistory([]);
		setPanelIndex(PANELS.BROWSE);
	}, []);

	const handleOpenJellyseerrRequests = useCallback(() => {
		navigateTo(PANELS.JELLYSEERR_REQUESTS);
	}, [navigateTo]);

	const handleSwitchUser = useCallback(async () => {
		await logout();
		setPanelHistory([]);
		setPanelIndex(PANELS.LOGIN);
	}, [logout]);

	const handleAddServer = useCallback(() => {
		setPanelHistory([]);
		setPanelIndex(PANELS.ADD_SERVER);
	}, []);

	const handleAddUser = useCallback(() => {
		setPanelHistory([]);
		setPanelIndex(PANELS.ADD_USER);
	}, []);

	const handleServerAdded = useCallback((result) => {
		if (!result) {
			setPanelHistory([]);
			setPanelIndex(PANELS.SETTINGS);
			return;
		}
		setPanelHistory([]);
		setPanelIndex(PANELS.BROWSE);
	}, []);

	const handleSelectJellyseerrItem = useCallback((item) => {
		setJellyseerrItem(item);
		navigateTo(PANELS.JELLYSEERR_DETAILS);
	}, [navigateTo]);

	const handleSelectJellyseerrGenre = useCallback((genreId, genreName, mediaType) => {
		setJellyseerrBrowse({browseType: 'genre', item: {id: genreId, name: genreName}, mediaType});
		navigateTo(PANELS.JELLYSEERR_BROWSE);
	}, [navigateTo]);

	const handleSelectJellyseerrStudio = useCallback((studioId, studioName) => {
		setJellyseerrBrowse({browseType: 'studio', item: {id: studioId, name: studioName}, mediaType: 'movie'});
		navigateTo(PANELS.JELLYSEERR_BROWSE);
	}, [navigateTo]);

	const handleSelectJellyseerrNetwork = useCallback((networkId, networkName) => {
		setJellyseerrBrowse({browseType: 'network', item: {id: networkId, name: networkName}, mediaType: 'tv'});
		navigateTo(PANELS.JELLYSEERR_BROWSE);
	}, [navigateTo]);

	const handleSelectJellyseerrKeyword = useCallback((keyword, mediaType) => {
		setJellyseerrBrowse({browseType: 'keyword', item: keyword, mediaType});
		navigateTo(PANELS.JELLYSEERR_BROWSE);
	}, [navigateTo]);

	const handleSelectJellyseerrPerson = useCallback((personId, personName) => {
		setJellyseerrPerson({id: personId, name: personName});
		navigateTo(PANELS.JELLYSEERR_PERSON);
	}, [navigateTo]);

	if (isLoading || !authChecked) {
		return <div className={css.loading} />;
	}
	const renderView = () => {
		switch (panelIndex) {
			case PANELS.LOGIN:
				return <Login onLoggedIn={handleLoggedIn} />;
			case PANELS.BROWSE:
				return (
					<Browse
						onSelectItem={handleSelectItem}
						onSelectLibrary={handleSelectLibrary}
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
				return <Search onSelectItem={handleSelectItem} onSelectPerson={handleSelectPerson} onBack={handleBack} />;
			case PANELS.SETTINGS:
				return <Settings onBack={handleBack} onLogout={handleSwitchUser} onAddServer={handleAddServer} onAddUser={handleAddUser} />;
			case PANELS.ADD_SERVER:
				return (
					<Login
						onLoggedIn={handleLoggedIn}
						onServerAdded={handleServerAdded}
						isAddingServer
					/>
				);
			case PANELS.ADD_USER:
				return (
					<Login
						onLoggedIn={handleLoggedIn}
						onServerAdded={handleServerAdded}
						isAddingUser
						currentServerUrl={serverUrl}
						currentServerName={serverName}
					/>
				);
			case PANELS.PLAYER:
				return playingItem ? (
					<Player
						item={playingItem}
						initialAudioIndex={playbackOptions?.audioStreamIndex}
						initialSubtitleIndex={playbackOptions?.subtitleStreamIndex}
						onEnded={handlePlayerEnd}
						onBack={handlePlayerEnd}
						onPlayNext={handlePlayNext}
					/>
				) : null;
			case PANELS.FAVORITES:
				return <Favorites onSelectItem={handleSelectItem} onBack={handleBack} />;
			case PANELS.GENRES:
				return <Genres onSelectGenre={handleSelectGenre} onBack={handleBack} />;
			case PANELS.GENRE_BROWSE:
				return (
					<GenreBrowse
						genre={selectedGenre}
						libraryId={selectedGenreLibraryId}
						onSelectItem={handleSelectItem}
						onBack={handleBack}
					/>
				);
			case PANELS.PERSON:
				return <Person personId={selectedPerson?.Id} onSelectItem={handleSelectItem} onBack={handleBack} />;
			case PANELS.LIVETV:
				return <LiveTV onPlayChannel={handlePlayChannel} onRecordings={handleOpenRecordings} onBack={handleBack} />;
			case PANELS.RECORDINGS:
				return <Recordings onPlayRecording={handlePlayRecording} onBack={handleBack} />;
			case PANELS.JELLYSEERR_DISCOVER:
				return (
					<JellyseerrDiscover
						onSelectItem={handleSelectJellyseerrItem}
						onSelectGenre={handleSelectJellyseerrGenre}
						onSelectStudio={handleSelectJellyseerrStudio}
						onSelectNetwork={handleSelectJellyseerrNetwork}
						onOpenRequests={handleOpenJellyseerrRequests}
						onBack={handleBack}
					/>
				);
			case PANELS.JELLYSEERR_DETAILS:
				return (
					<JellyseerrDetails
						mediaType={jellyseerrItem?.mediaType}
						mediaId={jellyseerrItem?.mediaId}
						onSelectItem={handleSelectJellyseerrItem}
						onSelectPerson={handleSelectJellyseerrPerson}
						onSelectKeyword={handleSelectJellyseerrKeyword}
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
			case PANELS.JELLYSEERR_BROWSE:
				return (
					<JellyseerrBrowse
						browseType={jellyseerrBrowse?.browseType}
						item={jellyseerrBrowse?.item}
						mediaType={jellyseerrBrowse?.mediaType}
						onSelectItem={handleSelectJellyseerrItem}
						onBack={handleBack}
					/>
				);
			case PANELS.JELLYSEERR_PERSON:
				return (
					<JellyseerrPerson
						personId={jellyseerrPerson?.id}
						personName={jellyseerrPerson?.name}
						onSelectItem={handleSelectJellyseerrItem}
						onBack={handleBack}
					/>
				);
			default:
				return (
					<Browse
						onSelectItem={handleSelectItem}
						onSelectLibrary={handleSelectLibrary}
					/>
				);
		}
	};

	const getActiveView = () => {
		switch (panelIndex) {
			case PANELS.BROWSE: return 'home';
			case PANELS.SEARCH: return 'search';
			case PANELS.SETTINGS: return 'settings';
			case PANELS.FAVORITES: return 'favorites';
			case PANELS.GENRES: return 'genres';
			case PANELS.JELLYSEERR_DISCOVER:
			case PANELS.JELLYSEERR_DETAILS:
			case PANELS.JELLYSEERR_REQUESTS:
			case PANELS.JELLYSEERR_BROWSE:
			case PANELS.JELLYSEERR_PERSON:
				return 'discover';
			case PANELS.LIBRARY: return selectedLibrary?.Id || '';
			default: return '';
		}
	};

	const showNavBar = panelIndex !== PANELS.LOGIN &&
		panelIndex !== PANELS.PLAYER &&
		panelIndex !== PANELS.ADD_SERVER &&
		panelIndex !== PANELS.ADD_USER;

	return (
		<div className={css.app} {...props}>
			{showNavBar && (
				<NavBar
					activeView={getActiveView()}
					libraries={libraries}
					onHome={handleHome}
					onSearch={handleOpenSearch}
					onShuffle={handleShuffle}
					onGenres={handleOpenGenres}
					onFavorites={handleOpenFavorites}
					onDiscover={handleOpenJellyseerr}
					onSettings={handleOpenSettings}
					onSelectLibrary={handleSelectLibrary}
					onUserMenu={handleOpenSettings}
				/>
			)}
			{renderView()}
			<UpdateNotification
				updateInfo={updateInfo}
				formattedNotes={formattedNotes}
				onDismiss={dismissUpdate}
			/>
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
