import {useState, useEffect, useCallback, useRef} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import {VirtualGridList} from '@enact/sandstone/VirtualList';
import Popup from '@enact/sandstone/Popup';
import Button from '@enact/sandstone/Button';
import {useAuth} from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import {getImageUrl, getBackdropId, getPrimaryImageId} from '../../utils/helpers';

import css from './Library.module.less';

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');

const SORT_OPTIONS = [
	{key: 'SortName,Ascending', label: 'Name (A-Z)'},
	{key: 'SortName,Descending', label: 'Name (Z-A)'},
	{key: 'CommunityRating,Descending', label: 'Rating'},
	{key: 'DateCreated,Descending', label: 'Date Added'},
	{key: 'PremiereDate,Descending', label: 'Release Date'},
	{key: 'Random,Ascending', label: 'Random'}
];

const FILTER_OPTIONS = [
	{key: 'all', label: 'All'},
	{key: 'Favorites', label: 'Favorites'},
	{key: 'Unplayed', label: 'Unplayed'},
	{key: 'Played', label: 'Played'},
	{key: 'Resumable', label: 'Resumable'}
];

const LETTERS = ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

const BACKDROP_DEBOUNCE_MS = 500;

const Library = ({library, onSelectItem, onBack}) => {
	const {api, serverUrl} = useAuth();
	const [allItems, setAllItems] = useState([]);
	const [items, setItems] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [totalCount, setTotalCount] = useState(0);
	const [sortBy, setSortBy] = useState('SortName,Ascending');
	const [filter, setFilter] = useState('all');
	const [startLetter, setStartLetter] = useState(null);
	const [backdropUrl, setBackdropUrl] = useState('');
	const [showSortModal, setShowSortModal] = useState(false);
	const [showFilterModal, setShowFilterModal] = useState(false);

	const backdropTimeoutRef = useRef(null);
	const backdropSetRef = useRef(false);
	const pendingBackdropUrlRef = useRef(null);
	const loadingMoreRef = useRef(false);
	const itemsRef = useRef([]);
	const apiFetchIndexRef = useRef(0);

	const getItemTypeForLibrary = useCallback(() => {
		if (!library) return 'Movie,Series';
		const collectionType = library.CollectionType?.toLowerCase();

		switch (collectionType) {
			case 'movies':
				return 'Movie';
			case 'tvshows':
				return 'Series';
			case 'boxsets':
				return 'BoxSet';
			case 'homevideos':
				return 'Video';
			case 'music':
				return 'MusicAlbum,MusicArtist';
			default:
				return 'Movie,Series';
		}
	}, [library]);

	const getExcludeItemTypes = useCallback(() => {
		if (!library) return '';
		const collectionType = library.CollectionType?.toLowerCase();

		if (collectionType === 'movies' || collectionType === 'tvshows') {
			return 'BoxSet';
		}
		return '';
	}, [library]);

	const loadItems = useCallback(async (startIndex = 0, append = false) => {
		if (!library) return;

		if (append && loadingMoreRef.current) return;

		if (append) {
			loadingMoreRef.current = true;
		}

		try {
			const [sortField, sortOrder] = sortBy.split(',');
			const collectionType = library.CollectionType?.toLowerCase();

			const params = {
				ParentId: library.Id,
				StartIndex: startIndex,
				Limit: 150,
				SortBy: sortField,
				SortOrder: sortOrder,
				Recursive: true,
				IncludeItemTypes: getItemTypeForLibrary(),
				EnableTotalRecordCount: true,
				Fields: 'PrimaryImageAspectRatio,ProductionYear,Overview,ImageTags,BackdropImageTags,ParentBackdropImageTags,ParentBackdropItemId,SeriesId,SeriesPrimaryImageTag'
			};

			const excludeTypes = getExcludeItemTypes();
			if (excludeTypes) {
				params.ExcludeItemTypes = excludeTypes;
			}

			// For movie libraries: CollapseBoxSetItems=false ensures movies that are part of
			// BoxSets are still shown individually (not collapsed/hidden). Combined with
			// ExcludeItemTypes=BoxSet, this shows all movies without showing BoxSet containers.
			if (collectionType === 'movies') {
				params.CollapseBoxSetItems = false;
			}

			if (filter !== 'all') {
				if (filter === 'Favorites') {
					params.Filters = 'IsFavorite';
				} else if (filter === 'Unplayed') {
					params.Filters = 'IsUnplayed';
				} else if (filter === 'Played') {
					params.Filters = 'IsPlayed';
				} else if (filter === 'Resumable') {
					params.Filters = 'IsResumable';
				}
			}

			// NOTE: We do NOT use NameStartsWith server-side because Jellyfin's API
			// ignores type filters when NameStartsWith is used, returning BoxSets
			// even when excluded. Letter filtering is done client-side instead.

			console.log('[Library] loadItems called, startIndex:', startIndex, 'params:', JSON.stringify(params));
			const result = await api.getItems(params);
			console.log('[Library] API returned:', result.TotalRecordCount, 'total,', result.Items?.length, 'items');
			let newItems = result.Items || [];

			// Filter out BoxSets client-side (Jellyfin API often ignores ExcludeItemTypes)
			if (excludeTypes && newItems.length > 0) {
				const before = newItems.length;
				newItems = newItems.filter(item => item.Type !== 'BoxSet');
				const filtered = before - newItems.length;
				if (filtered > 0) {
					console.log('[Library] Filtered out', filtered, 'BoxSets');
				}
			}

			console.log('[Library] After BoxSet filter:', newItems.length, 'items');

			apiFetchIndexRef.current = append ? apiFetchIndexRef.current + (result.Items?.length || 0) : (result.Items?.length || 0);

			setAllItems(prev => append ? [...prev, ...newItems] : newItems);
			setTotalCount(result.TotalRecordCount || 0);

			if (!append && newItems.length > 0 && !backdropSetRef.current) {
				const firstItemWithBackdrop = newItems.find(item => getBackdropId(item));
				if (firstItemWithBackdrop) {
					const url = getImageUrl(serverUrl, getBackdropId(firstItemWithBackdrop), 'Backdrop', {maxWidth: 1920, quality: 100});
					setBackdropUrl(url);
					backdropSetRef.current = true;
				}
			}
		} catch (err) {
			console.error('Failed to load library items:', err);
		} finally {
			setIsLoading(false);
			loadingMoreRef.current = false;
		}
	}, [api, library, sortBy, filter, serverUrl, getItemTypeForLibrary, getExcludeItemTypes]);

	useEffect(() => {
		console.log('[Library] useEffect triggered - library:', library?.Name);
		if (library) {
			setIsLoading(true);
			setAllItems([]);
			setItems([]);
			backdropSetRef.current = false;
			loadingMoreRef.current = false;
			apiFetchIndexRef.current = 0;
			loadItems(0, false);
		}
	}, [library, sortBy, filter, loadItems]);

	useEffect(() => {
		if (!startLetter) {
			setItems(allItems);
			itemsRef.current = allItems;
		} else {
			const filtered = allItems.filter(item => {
				const name = item.Name || '';
				const firstChar = name.charAt(0).toUpperCase();
				if (startLetter === '#') {
					return !/[A-Z]/.test(firstChar);
				}
				return firstChar === startLetter;
			});
			console.log('[Library] Filtered by letter', startLetter, ':', filtered.length, 'items');
			setItems(filtered);
			itemsRef.current = filtered;
		}

		if (allItems.length > 0 && !isLoading) {
			setTimeout(() => {
				const firstItem = document.querySelector(`.${css.grid} .spottable`);
				if (firstItem) {
					firstItem.focus();
				}
			}, 100);
		}
	}, [allItems, startLetter, isLoading]);

	const updateBackdrop = useCallback((ev) => {
		const itemIndex = ev.currentTarget?.dataset?.index;
		if (itemIndex === undefined) return;

		const item = itemsRef.current[parseInt(itemIndex, 10)];
		if (!item) return;

		const backdropId = getBackdropId(item);
		if (backdropId) {
			const url = getImageUrl(serverUrl, backdropId, 'Backdrop', {maxWidth: 1280, quality: 80});
			if (pendingBackdropUrlRef.current === url) return;
			pendingBackdropUrlRef.current = url;

			if (backdropTimeoutRef.current) {
				clearTimeout(backdropTimeoutRef.current);
			}
			backdropTimeoutRef.current = setTimeout(() => {
				window.requestAnimationFrame(() => {
					setBackdropUrl(url);
				});
			}, BACKDROP_DEBOUNCE_MS);
		}
	}, [serverUrl]);

	const handleItemClick = useCallback((ev) => {
		const itemIndex = ev.currentTarget?.dataset?.index;
		if (itemIndex === undefined) return;

		const item = itemsRef.current[parseInt(itemIndex, 10)];
		if (item) {
			onSelectItem?.(item);
		}
	}, [onSelectItem]);

	const handleScrollStop = useCallback(() => {
		console.log('[Library] onScrollStop - apiFetchIndex:', apiFetchIndexRef.current, 'totalCount:', totalCount, 'isLoading:', isLoading);
		if (apiFetchIndexRef.current < totalCount && !isLoading && !loadingMoreRef.current) {
			console.log('[Library] Loading more items from index:', apiFetchIndexRef.current);
			loadItems(apiFetchIndexRef.current, true);
		}
	}, [totalCount, isLoading, loadItems]);

	const handleLetterSelect = useCallback((ev) => {
		const letter = ev.currentTarget?.dataset?.letter;
		if (letter) {
			setStartLetter(letter === startLetter ? null : letter);
		}
	}, [startLetter]);

	const handleLetterKeyDown = useCallback((e) => {
		if (e.keyCode === 40) {
			e.preventDefault();
			e.stopPropagation();
			const focused = Spotlight.focus('.spottable');
			if (!focused) {
				const grid = document.querySelector(`.${css.grid}`);
				if (grid) {
					const firstItem = grid.querySelector('.spottable');
					if (firstItem) {
						firstItem.focus();
					}
				}
			}
		}
	}, []);

	const handleOpenSortModal = useCallback(() => {
		setShowSortModal(true);
	}, []);

	const handleOpenFilterModal = useCallback(() => {
		setShowFilterModal(true);
	}, []);

	const handleCloseModal = useCallback(() => {
		setShowSortModal(false);
		setShowFilterModal(false);
	}, []);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.keyCode === 461 || e.keyCode === 27) {
				if (showSortModal || showFilterModal) {
					setShowSortModal(false);
					setShowFilterModal(false);
				} else {
					onBack?.();
				}
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [showSortModal, showFilterModal, onBack]);

	const handleSortSelect = useCallback((ev) => {
		const key = ev.currentTarget?.dataset?.sortKey;
		if (key) {
			setSortBy(key);
			setShowSortModal(false);
		}
	}, []);

	const handleFilterSelect = useCallback((ev) => {
		const key = ev.currentTarget?.dataset?.filterKey;
		if (key) {
			setFilter(key);
			setShowFilterModal(false);
		}
	}, []);

	const renderItem = useCallback(({index, ...rest}) => {
		const item = itemsRef.current[index];
		const isNearEnd = index >= items.length - 50;
		if (isNearEnd && apiFetchIndexRef.current < totalCount && !isLoading && !loadingMoreRef.current) {
			console.log('[Library] Near end of items, loading more from index:', apiFetchIndexRef.current);
			loadItems(apiFetchIndexRef.current, true);
		}

		if (!item) {
			return (
				<div {...rest} className={css.itemCard}>
					<div className={css.posterPlaceholder}>
						<div className={css.loadingPlaceholder} />
					</div>
				</div>
			);
		}

		const imageId = getPrimaryImageId(item);
		const imageUrl = imageId ? getImageUrl(serverUrl, imageId, 'Primary', {maxHeight: 300, quality: 80}) : null;

		return (
			<SpottableDiv
				{...rest}
				className={css.itemCard}
				onClick={handleItemClick}
				onFocus={updateBackdrop}
				data-index={index}
			>
				{imageUrl ? (
					<img
						className={css.poster}
						src={imageUrl}
						alt={item.Name}
						loading="lazy"
					/>
				) : (
					<div className={css.posterPlaceholder}>
						<svg viewBox="0 0 24 24" className={css.placeholderIcon}>
							<path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
						</svg>
					</div>
				)}
				<div className={css.itemInfo}>
					<div className={css.itemName}>{item.Name}</div>
					{item.ProductionYear && (
						<div className={css.itemYear}>{item.ProductionYear}</div>
					)}
				</div>
			</SpottableDiv>
		);
	}, [serverUrl, handleItemClick, updateBackdrop, items.length, totalCount, isLoading, loadItems]);

	const currentSort = SORT_OPTIONS.find(o => o.key === sortBy);
	const currentFilter = FILTER_OPTIONS.find(o => o.key === filter);

	if (!library) {
		return (
			<div className={css.page}>
				<div className={css.empty}>No library selected</div>
			</div>
		);
	}

	return (
		<div className={css.page}>
			<div className={css.backdrop}>
				{backdropUrl && (
					<img className={css.backdropImage} src={backdropUrl} alt="" />
				)}
				<div className={css.backdropOverlay} />
			</div>

			<div className={css.content}>
				<div className={css.header}>
					<div className={css.titleSection}>
						<div className={css.title}>{library.Name}</div>
						<div className={css.subtitle}>
							{currentSort?.label} • {currentFilter?.label}
							{startLetter && ` • Starting with "${startLetter}"`}
						</div>
					</div>
					<div className={css.counter}>{totalCount} items</div>
				</div>

				<div className={css.toolbar}>
					<SpottableButton
						className={css.sortButton}
						onClick={handleOpenSortModal}
					>
						<svg viewBox="0 0 24 24">
							<path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" />
						</svg>
						{currentSort?.label}
					</SpottableButton>

					<SpottableButton
						className={css.filterButton}
						onClick={handleOpenFilterModal}
					>
						<svg viewBox="0 0 24 24">
							<path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
						</svg>
						{currentFilter?.label}
					</SpottableButton>

					<div className={css.letterNav}>
						{LETTERS.map(letter => (
							<SpottableButton
								key={letter}
								className={`${css.letterButton} ${startLetter === letter ? css.active : ''}`}
								onClick={handleLetterSelect}
								onKeyDown={handleLetterKeyDown}
								data-letter={letter}
							>
								{letter}
							</SpottableButton>
						))}
					</div>
				</div>

				<div className={css.gridContainer}>
					{isLoading && items.length === 0 ? (
						<div className={css.loading}>
							<LoadingSpinner />
						</div>
					) : items.length === 0 ? (
						<div className={css.empty}>No items found</div>
					) : (
						<VirtualGridList
							className={css.grid}
							dataSize={items.length}
							itemRenderer={renderItem}
							itemSize={{minWidth: 180, minHeight: 340}}
							spacing={20}
							onScrollStop={handleScrollStop}
							spotlightId="library-grid"
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
							selected={sortBy === option.key}
							onClick={handleSortSelect}
							data-sort-key={option.key}
						>
							{option.label}
						</Button>
					))}
				</div>
			</Popup>

			<Popup
				open={showFilterModal}
				onClose={handleCloseModal}
				position="center"
				scrimType="translucent"
				noAutoDismiss
			>
				<div className={css.popupContent}>
					<div className={css.modalTitle}>Filter</div>
					{FILTER_OPTIONS.map((option) => (
						<Button
							key={option.key}
							className={css.popupOption}
							selected={filter === option.key}
							onClick={handleFilterSelect}
							data-filter-key={option.key}
						>
							{option.label}
						</Button>
					))}
				</div>
			</Popup>
		</div>
	);
};

export default Library;
