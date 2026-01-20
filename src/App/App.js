import {useState, useCallback} from 'react';
import ThemeDecorator from '@enact/sandstone/ThemeDecorator';
import Panels from '@enact/sandstone/Panels';

import {AuthProvider, useAuth} from '../context/AuthContext';
import {SettingsProvider} from '../context/SettingsContext';
import Login from '../views/Login';
import Browse from '../views/Browse';
import Details from '../views/Details';
import Library from '../views/Library';
import Search from '../views/Search';
import Settings from '../views/Settings';
import Player from '../views/Player';

import css from './App.module.less';

const PANELS = {
	LOGIN: 0,
	BROWSE: 1,
	DETAILS: 2,
	LIBRARY: 3,
	SEARCH: 4,
	SETTINGS: 5,
	PLAYER: 6
};

const AppContent = (props) => {
	const {isAuthenticated, isLoading} = useAuth();
	const [panelIndex, setPanelIndex] = useState(isAuthenticated ? PANELS.BROWSE : PANELS.LOGIN);
	const [selectedItem, setSelectedItem] = useState(null);
	const [selectedLibrary, setSelectedLibrary] = useState(null);
	const [playingItem, setPlayingItem] = useState(null);
	const [panelHistory, setPanelHistory] = useState([]);

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

	if (isLoading) {
		return <div className={css.loading}>Loading...</div>;
	}

	return (
		<div className={css.app} {...props}>
			<Panels
				index={panelIndex}
				onBack={handleBack}
				noCloseButton
			>
				<Login onLoggedIn={handleLoggedIn} />
				<Browse
					onSelectItem={handleSelectItem}
					onSelectLibrary={handleSelectLibrary}
					onOpenSearch={handleOpenSearch}
					onOpenSettings={handleOpenSettings}
				/>
				<Details
					itemId={selectedItem?.Id}
					onPlay={handlePlay}
					onSelectItem={handleSelectItem}
				/>
				<Library
					library={selectedLibrary}
					onSelectItem={handleSelectItem}
				/>
				<Search onSelectItem={handleSelectItem} />
				<Settings />
				{playingItem && (
					<Player
						item={playingItem}
						onEnded={handlePlayerEnd}
						onBack={handlePlayerEnd}
					/>
				)}
			</Panels>
		</div>
	);
};

const AppBase = (props) => (
	<SettingsProvider>
		<AuthProvider>
			<AppContent {...props} />
		</AuthProvider>
	</SettingsProvider>
);

const App = ThemeDecorator(AppBase);
export default App;
