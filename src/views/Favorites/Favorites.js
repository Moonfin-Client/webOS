import {useState, useEffect, useCallback, useRef} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import {VirtualGridList} from '@enact/sandstone/VirtualList';
import Popup from '@enact/sandstone/Popup';
import Button from '@enact/sandstone/Button';
import {useAuth} from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import {getImageUrl, getBackdropId, getPrimaryImageId} from '../../utils/helpers';

import css from './Favorites.module.less';

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');

const SORT_OPTIONS = [
	{key: 'SortName,Ascending', label: 'Name (A-Z)'},
	{key: 'SortName,Descending', label: 'Name (Z-A)'},
	{key: 'CommunityRating,Descending', label: 'Rating'},
	{key: 'DateCreated,Descending', label: 'Date Added'},
	{key: 'PremiereDate,Descending', label: 'Release Date'}
];

const FILTER_OPTIONS = [
	{key: 'all', label: 'All'},
	{key: 'Movie', label: 'Movies'},
	{key: 'Series', label: 'TV Shows'}
];

const BACKDROP_DEBOUNCE_MS = 300;

const Favorites = ({onSelectItem, onBack}) => {
	const {api, serverUrl} = useAuth();
	const [items, setItems] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [totalCount, setTotalCount] = useState(0);
	const [sortBy, setSortBy] = useState('SortName,Ascending');
	const [filterType, setFilterType] = useState('all');
	const [backdropUrl, setBackdropUrl] = useState('');
	const [showSortModal, setShowSortModal] = useState(false);
	const [showFilterModal, setShowFilterModal] = useState(false);

	const backdropTimeoutRef = useRef(null);
	const backdropSetRef = useRef(false);
	const loadingMoreRef = useRef(false);
	const itemsLengthRef = useRef(0);
	const itemsRef = useRef([]);

	const loadItems = useCallback(async (startIndex = 0, append = false) => {
		if (append && loadingMoreRef.current) return;

		if (append) {
			loadingMoreRef.current = true;
		}

		try {
			const [sortField, sortOrder] = sortBy.split(',');
			const params = {
				StartIndex: startIndex,
				Limit: 50,
				SortBy: sortField,
				SortOrder: sortOrder,
				Recursive: true,
				Filters: 'IsFavorite',
				EnableTotalRecordCount: true,
				Fields: 'PrimaryImageAspectRatio,ProductionYear,Overview,ImageTags,BackdropImageTags,ParentBackdropImageTags,ParentBackdropItemId,SeriesId,SeriesPrimaryImageTag'
			};

			if (filterType !== 'all') {
				params.IncludeItemTypes = filterType;
			} else {
				params.IncludeItemTypes = 'Movie,Series';
			}

			const result = await api.getItems(params);
			const newItems = result.Items || [];

			setItems(prev => {
				const updatedItems = append ? [...prev, ...newItems] : newItems;
				itemsLengthRef.current = updatedItems.length;
				itemsRef.current = updatedItems;
				return updatedItems;
			});
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
			console.error('Failed to load favorites:', err);
		} finally {
			setIsLoading(false);
			loadingMoreRef.current = false;
		}
	}, [api, sortBy, filterType, serverUrl]);

	useEffect(() => {
		setIsLoading(true);
		setItems([]);
		itemsLengthRef.current = 0;
		backdropSetRef.current = false;
		loadingMoreRef.current = false;
		loadItems(0, false);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sortBy, filterType]);

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

	const handleScrollStop = useCallback(() => {
		if (itemsLengthRef.current < totalCount && !isLoading && !loadingMoreRef.current) {
			loadItems(itemsLengthRef.current, true);
		}
	}, [totalCount, isLoading, loadItems]);

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

	const handlePopupKeyDown = useCallback((ev) => {
		const keyCode = ev.keyCode;
		if (keyCode === 461 || keyCode === 27) {
			ev.preventDefault();
			ev.stopPropagation();
			setShowSortModal(false);
			setShowFilterModal(false);
		}
	}, []);

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
			setFilterType(key);
			setShowFilterModal(false);
		}
	}, []);

	const renderItem = useCallback(({index, ...rest}) => {
		const item = itemsRef.current[index];
		if (!item) return null;

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
	}, [serverUrl, handleItemClick, updateBackdrop]);

	const currentSort = SORT_OPTIONS.find(o => o.key === sortBy);
	const currentFilter = FILTER_OPTIONS.find(o => o.key === filterType);

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
						<div className={css.title}>Favorites</div>
						<div className={css.subtitle}>
							{currentSort?.label} • {currentFilter?.label}
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
				</div>

				<div className={css.gridContainer}>
					{isLoading && items.length === 0 ? (
						<div className={css.loading}>
							<LoadingSpinner />
						</div>
					) : items.length === 0 ? (
						<div className={css.empty}>No favorites yet</div>
					) : (
						<VirtualGridList
							className={css.grid}
							dataSize={items.length}
							itemRenderer={renderItem}
							itemSize={{minWidth: 180, minHeight: 340}}
							spacing={20}
							onScrollStop={handleScrollStop}
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
				onKeyDown={handlePopupKeyDown}
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
							size="small"
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
				onKeyDown={handlePopupKeyDown}
			>
				<div className={css.popupContent}>
					<div className={css.modalTitle}>Filter</div>
					{FILTER_OPTIONS.map((option) => (
						<Button
							key={option.key}
							className={css.popupOption}
							selected={filterType === option.key}
							onClick={handleFilterSelect}
							data-filter-key={option.key}
							size="small"
						>
							{option.label}
						</Button>
					))}
				</div>
			</Popup>
		</div>
	);
};

export default Favorites;
