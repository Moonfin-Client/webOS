import {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import {VirtualGridList} from '@enact/sandstone/VirtualList';
import Popup from '@enact/sandstone/Popup';
import Button from '@enact/sandstone/Button';
import {useAuth} from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import {getImageUrl, getBackdropId} from '../../utils/helpers';

import css from './Genres.module.less';

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');

const SORT_OPTIONS = [
	{key: 'name-asc', label: 'Name (A-Z)'},
	{key: 'name-desc', label: 'Name (Z-A)'},
	{key: 'count-desc', label: 'Most Items'},
	{key: 'count-asc', label: 'Least Items'},
	{key: 'random', label: 'Random'}
];

const Genres = ({onSelectGenre, onBack}) => {
	const {api, serverUrl} = useAuth();
	const [genres, setGenres] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [sortOrder, setSortOrder] = useState('name-asc');
	const [showSortModal, setShowSortModal] = useState(false);
	const [selectedLibrary, setSelectedLibrary] = useState(null);
	const [libraries, setLibraries] = useState([]);
	const [showLibraryModal, setShowLibraryModal] = useState(false);

	const sortedGenresRef = useRef([]);

	useEffect(() => {
		const loadLibraries = async () => {
			try {
				const result = await api.getLibraries();
				const videoLibraries = (result.Items || []).filter(lib =>
					lib.CollectionType === 'movies' || lib.CollectionType === 'tvshows'
				);
				setLibraries(videoLibraries);
			} catch (err) {
				console.error('Failed to load libraries:', err);
			}
		};
		loadLibraries();
	}, [api]);

	useEffect(() => {
		const loadGenres = async () => {
			setIsLoading(true);
			try {
				const params = {};
				if (selectedLibrary) {
					params.ParentId = selectedLibrary.Id;
				}

				const genresResult = await api.getGenres(params.ParentId);
				const genreList = genresResult.Items || [];

				const genresWithData = await Promise.all(
					genreList.map(async (genre) => {
						try {
							const itemParams = {
								Genres: genre.Name,
								IncludeItemTypes: 'Movie,Series',
								Recursive: true,
								Limit: 5,
								SortBy: 'Random',
								EnableTotalRecordCount: true,
								Fields: 'PrimaryImageAspectRatio,BackdropImageTags,ParentBackdropImageTags,ParentBackdropItemId'
							};

							if (selectedLibrary) {
								itemParams.ParentId = selectedLibrary.Id;
							}

							const itemsResult = await api.getItems(itemParams);
							const items = itemsResult.Items || [];
							const itemCount = itemsResult.TotalRecordCount || 0;

							if (itemCount === 0) return null;

							let backdropUrl = null;
							for (const item of items) {
								const backdropId = getBackdropId(item);
								if (backdropId) {
									backdropUrl = getImageUrl(serverUrl, backdropId, 'Backdrop', {maxWidth: 780, quality: 80});
									break;
								}
							}

							return {
								id: genre.Id,
								name: genre.Name,
								itemCount,
								backdropUrl
							};
						} catch (err) {
							console.error(`Failed to get data for genre ${genre.Name}:`, err);
							return null;
						}
					})
				);

				// Filter out null entries (empty genres) and apply sort
				const validGenres = genresWithData.filter(g => g !== null);
				setGenres(validGenres);
			} catch (err) {
				console.error('Failed to load genres:', err);
			} finally {
				setIsLoading(false);
			}
		};

		loadGenres();
	}, [api, serverUrl, selectedLibrary]);

	const sortedGenres = useMemo(() => {
		const sorted = [...genres];
		switch (sortOrder) {
			case 'name-asc':
				sorted.sort((a, b) => a.name.localeCompare(b.name));
				break;
			case 'name-desc':
				sorted.sort((a, b) => b.name.localeCompare(a.name));
				break;
			case 'count-desc':
				sorted.sort((a, b) => b.itemCount - a.itemCount);
				break;
			case 'count-asc':
				sorted.sort((a, b) => a.itemCount - b.itemCount);
				break;
			case 'random':
				sorted.sort(() => Math.random() - 0.5);
				break;
			default:
				break;
		}
		sortedGenresRef.current = sorted;
		return sorted;
	}, [genres, sortOrder]);

	const handleGenreClick = useCallback((ev) => {
		const genreIndex = ev.currentTarget?.dataset?.index;
		if (genreIndex !== undefined) {
			const genre = sortedGenresRef.current[parseInt(genreIndex, 10)];
			if (genre) {
				onSelectGenre?.({
					name: genre.name,
					id: genre.id
				}, selectedLibrary?.Id);
			}
		}
	}, [onSelectGenre, selectedLibrary]);

	const handleOpenLibraryModal = useCallback(() => {
		setShowLibraryModal(true);
	}, []);

	const handleOpenSortModal = useCallback(() => {
		setShowSortModal(true);
	}, []);

	const handleCloseModal = useCallback(() => {
		setShowSortModal(false);
		setShowLibraryModal(false);
	}, []);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.keyCode === 461 || e.keyCode === 27) {
				if (showSortModal || showLibraryModal) {
					setShowSortModal(false);
					setShowLibraryModal(false);
				} else {
					onBack?.();
				}
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [showSortModal, showLibraryModal, onBack]);

	const handleSortSelect = useCallback((ev) => {
		const key = ev.currentTarget?.dataset?.sortKey;
		if (key) {
			setSortOrder(key);
			setShowSortModal(false);
		}
	}, []);

	const handleLibrarySelect = useCallback((ev) => {
		const libData = ev.currentTarget?.dataset?.library;
		if (libData === 'null') {
			setSelectedLibrary(null);
		} else if (libData) {
			try {
				const lib = JSON.parse(libData);
				setSelectedLibrary(lib);
			} catch (e) { /* ignore */ }
		}
		setShowLibraryModal(false);
	}, []);

	const renderGenreCard = useCallback(({index, ...rest}) => {
		const genre = sortedGenresRef.current[index];
		if (!genre) return null;

		return (
			<SpottableDiv
				{...rest}
				className={css.genreCard}
				onClick={handleGenreClick}
				data-index={index}
			>
				<div className={css.genreBackdrop}>
					{genre.backdropUrl ? (
						<img
							className={css.genreBackdropImage}
							src={genre.backdropUrl}
							alt=""
							loading="lazy"
						/>
					) : (
						<div className={css.genreBackdropPlaceholder} />
					)}
					<div className={css.genreBackdropOverlay} />
				</div>
				<div className={css.genreInfo}>
					<div className={css.genreName}>{genre.name}</div>
					<div className={css.genreCount}>{genre.itemCount} items</div>
				</div>
			</SpottableDiv>
		);
	}, [handleGenreClick]);

	const currentSort = SORT_OPTIONS.find(o => o.key === sortOrder);

	return (
		<div className={css.page}>
			<div className={css.content}>
				<div className={css.header}>
					<div className={css.titleSection}>
						<div className={css.title}>Genres</div>
						{selectedLibrary && (
							<div className={css.subtitle}>{selectedLibrary.Name}</div>
						)}
					</div>
					<div className={css.counter}>{sortedGenres.length} genres</div>
				</div>

				<div className={css.toolbar}>
					<SpottableButton
						className={css.filterButton}
						onClick={handleOpenLibraryModal}
					>
						<svg viewBox="0 0 24 24">
							<path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z" />
						</svg>
						{selectedLibrary?.Name || 'All Libraries'}
					</SpottableButton>

					<SpottableButton
						className={css.sortButton}
						onClick={handleOpenSortModal}
					>
						<svg viewBox="0 0 24 24">
							<path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" />
						</svg>
						{currentSort?.label}
					</SpottableButton>
				</div>

				<div className={css.gridContainer}>
					{isLoading ? (
						<div className={css.loading}>
							<LoadingSpinner />
						</div>
					) : sortedGenres.length === 0 ? (
						<div className={css.empty}>No genres found</div>
					) : (
						<VirtualGridList
							className={css.grid}
							dataSize={sortedGenres.length}
							itemRenderer={renderGenreCard}
							itemSize={{minWidth: 320, minHeight: 180}}
							spacing={20}
							spotlightId="genres-grid"
						/>
					)}
				</div>
			</div>

			<Popup
				open={showSortModal}
				onClose={handleCloseModal}
				position="center"
				scrimType="translucent"
				noAutoDismiss
			>
				<div className={css.popupContent}>
					<div className={css.modalTitle}>Sort By</div>
					{SORT_OPTIONS.map((option) => (
						<Button
							key={option.key}
							className={css.popupOption}
							selected={sortOrder === option.key}
							onClick={handleSortSelect}
							data-sort-key={option.key}
						>
							{option.label}
						</Button>
					))}
				</div>
			</Popup>

			<Popup
				open={showLibraryModal}
				onClose={handleCloseModal}
				position="center"
				scrimType="translucent"
				noAutoDismiss
			>
				<div className={css.popupContent}>
					<div className={css.modalTitle}>Select Library</div>
					<Button
						className={css.popupOption}
						selected={!selectedLibrary}
						onClick={handleLibrarySelect}
						data-library="null"
					>
						All Libraries
					</Button>
					{libraries.map(lib => (
						<Button
							key={lib.Id}
							className={css.popupOption}
							selected={selectedLibrary?.Id === lib.Id}
							onClick={handleLibrarySelect}
							data-library={JSON.stringify(lib)}
						>
							{lib.Name}
						</Button>
					))}
				</div>
			</Popup>
		</div>
	);
};

export default Genres;
