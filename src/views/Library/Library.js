import {useState, useEffect, useCallback, useRef} from 'react';
import Spottable from '@enact/spotlight/Spottable';
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

const BACKDROP_DEBOUNCE_MS = 300;

const WINDOW_SIZE = 500;

const Library = ({library, onSelectItem, onBack}) => {
	const {api, serverUrl} = useAuth();
	const [items, setItems] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [serverTotalCount, setServerTotalCount] = useState(0);
	const [sortBy, setSortBy] = useState('SortName,Ascending');
	const [filter, setFilter] = useState('all');
	const [startLetter, setStartLetter] = useState(null);
	const [backdropUrl, setBackdropUrl] = useState('');
	const [showSortModal, setShowSortModal] = useState(false);
	const [showFilterModal, setShowFilterModal] = useState(false);

	const backdropTimeoutRef = useRef(null);
	const backdropSetRef = useRef(false);
	const pendingBatchesRef = useRef(new Set()); // Track batches being loaded
	const itemsRef = useRef([]);
	const loadedRangesRef = useRef([]);
	const currentIndexRef = useRef(0);

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

	const isRangeLoaded = useCallback((start, end) => {
		return loadedRangesRef.current.some(range =>
			range.start <= start && range.end >= end
		);
	}, []);

	// Unload items outside the current window to free memory
	const unloadDistantItems = useCallback((currentIndex) => {
		const windowStart = Math.max(0, currentIndex - WINDOW_SIZE);
		const windowEnd = currentIndex + WINDOW_SIZE;

		let unloadedCount = 0;
		itemsRef.current.forEach((item, index) => {
			if (item && (index < windowStart || index > windowEnd)) {
				itemsRef.current[index] = null;
				unloadedCount++;
			}
		});

		if (unloadedCount > 0) {
			loadedRangesRef.current = loadedRangesRef.current.filter(range =>
				!(range.end < windowStart || range.start > windowEnd)
			).map(range => ({
				start: Math.max(range.start, windowStart),
				end: Math.min(range.end, windowEnd)
			}));
		}
	}, []);

	const loadItems = useCallback(async (startIndex = 0, isReset = false) => {
		if (!library) return;

		// Check if this batch is already loaded or pending
		if (!isReset) {
			if (isRangeLoaded(startIndex, startIndex + 99)) {
				return;
			}
			if (pendingBatchesRef.current.has(startIndex)) {
				return;
			}
			pendingBatchesRef.current.add(startIndex);
		}

		try {
			const [sortField, sortOrder] = sortBy.split(',');
			const params = {
				ParentId: library.Id,
				StartIndex: startIndex,
				Limit: 100,
				SortBy: sortField,
				SortOrder: sortOrder,
				Recursive: true,
				IncludeItemTypes: getItemTypeForLibrary(),
				EnableTotalRecordCount: true,
				CollapseBoxSetItems: false,
				Fields: 'PrimaryImageAspectRatio,ProductionYear,ImageTags,BackdropImageTags,ParentBackdropImageTags,ParentBackdropItemId,SeriesId,SeriesPrimaryImageTag'
			};

			const excludeTypes = getExcludeItemTypes();
			if (excludeTypes) {
				params.ExcludeItemTypes = excludeTypes;
			}

			if (startLetter && startLetter !== '#') {
				params.NameStartsWith = startLetter;
			} else if (startLetter === '#') {
				params.NameLessThan = 'A';
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

			const result = await api.getItems(params);
			let newItems = result.Items || [];

			// Filter out BoxSets client-side
			if (excludeTypes && newItems.length > 0) {
				newItems = newItems.filter(item => item.Type !== 'BoxSet');
			}

			setServerTotalCount(result.TotalRecordCount || 0);

			if (isReset) {
				const sparseArray = new Array(result.TotalRecordCount || 0).fill(null);
				newItems.forEach((item, i) => {
					sparseArray[startIndex + i] = item;
				});
				itemsRef.current = sparseArray;
				loadedRangesRef.current = [{start: startIndex, end: startIndex + newItems.length - 1}];
				setItems([...sparseArray]);
			} else {
				newItems.forEach((item, i) => {
					itemsRef.current[startIndex + i] = item;
				});
				loadedRangesRef.current.push({start: startIndex, end: startIndex + newItems.length - 1});
				loadedRangesRef.current.sort((a, b) => a.start - b.start);
				setItems([...itemsRef.current]);
			}

			if (isReset && newItems.length > 0 && !backdropSetRef.current) {
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
			pendingBatchesRef.current.delete(startIndex);
			if (isReset) {
				setIsLoading(false);
			}
		}
	}, [api, library, sortBy, filter, startLetter, serverUrl, getItemTypeForLibrary, getExcludeItemTypes, isRangeLoaded]);

	useEffect(() => {
		if (library) {
			setIsLoading(true);
			setItems([]);
			setServerTotalCount(0);
			itemsRef.current = [];
			loadedRangesRef.current = [];
			pendingBatchesRef.current = new Set();
			currentIndexRef.current = 0;
			backdropSetRef.current = false;
			loadItems(0, true);
		}
	}, [library, sortBy, filter, startLetter, loadItems]);

	const updateBackdrop = useCallback((ev) => {
		const itemIndex = ev.currentTarget?.dataset?.index;
		if (itemIndex === undefined) return;

		const item = itemsRef.current[parseInt(itemIndex, 10)];
		if (!item) return;

		const backdropId = getBackdropId(item);
		if (backdropId) {
			const url = getImageUrl(serverUrl, backdropId, 'Backdrop', {maxWidth: 1280, quality: 80});

			if (backdropTimeoutRef.current) {
				clearTimeout(backdropTimeoutRef.current);
			}
			backdropTimeoutRef.current = setTimeout(() => {
				setBackdropUrl(url);
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

	const handleLetterSelect = useCallback((ev) => {
		const letter = ev.currentTarget?.dataset?.letter;
		if (letter) {
			setStartLetter(letter === startLetter ? null : letter);
		}
	}, [startLetter]);

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

		// Track current position for windowing
		currentIndexRef.current = index;

		// Check if we need to load items near this index
		if (!item) {
			const batchStart = Math.floor(index / 100) * 100;
			if (!isRangeLoaded(batchStart, batchStart + 99) && !pendingBatchesRef.current.has(batchStart)) {
				loadItems(batchStart, false);
			}
		}

		// Periodically unload distant items to free memory (less frequently)
		if (index % 500 === 0 && pendingBatchesRef.current.size === 0) {
			unloadDistantItems(index);
		}

		if (!item) {
			// Placeholder for items not yet loaded
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
	}, [serverUrl, handleItemClick, updateBackdrop, loadItems, isRangeLoaded, unloadDistantItems]);

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
					<SpottableButton className={css.backButton} onClick={onBack}>
						<svg viewBox="0 0 24 24">
							<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
						</svg>
					</SpottableButton>
					<div className={css.titleSection}>
						<div className={css.title}>{library.Name}</div>
						<div className={css.subtitle}>
							{currentSort?.label} • {currentFilter?.label}
							{startLetter && ` • Starting with "${startLetter}"`}
						</div>
					</div>
					<div className={css.counter}>{serverTotalCount} items</div>
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
							dataSize={serverTotalCount}
							itemRenderer={renderItem}
							itemSize={{minWidth: 180, minHeight: 340}}
							spacing={20}
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
