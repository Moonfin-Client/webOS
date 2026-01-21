import {useState, useEffect, useCallback, useRef} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import {useAuth} from '../../context/AuthContext';
import NavBar from '../../components/NavBar';
import MediaRow from '../../components/MediaRow';
import LoadingSpinner from '../../components/LoadingSpinner';
import {getImageUrl, getBackdropId} from '../../utils/helpers';

import css from './Browse.module.less';

const FOCUS_DELAY_MS = 100;
const BACKDROP_DEBOUNCE_MS = 150;
const CAROUSEL_ROTATION_MS = 8000;
const FEATURED_ITEMS_LIMIT = 10;
const FEATURED_GENRES_LIMIT = 3;
const DETAIL_GENRES_LIMIT = 2;
const TRANSITION_DELAY_MS = 450;

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');

const Browse = ({
	onSelectItem,
	onSelectLibrary,
	onOpenSearch,
	onOpenSettings,
	onOpenFavorites,
	onOpenJellyseerr,
	onOpenGenres,
	onLogout
}) => {
	const {api, serverUrl} = useAuth();
	const [rows, setRows] = useState([]);
	const [libraries, setLibraries] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [featuredItems, setFeaturedItems] = useState([]);
	const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0);
	const [backdropUrl, setBackdropUrl] = useState('');
	const [browseMode, setBrowseMode] = useState('featured');
	const [featuredFocused, setFeaturedFocused] = useState(false);
	const [focusedItem, setFocusedItem] = useState(null);
	const mainContentRef = useRef(null);
	const backdropTimeoutRef = useRef(null);
	const pendingBackdropRef = useRef(null);

	const handleNavigateUp = useCallback((fromRowIndex) => {
		if (fromRowIndex === 0) {
			Spotlight.focus('featured-banner');
			return;
		}
		const targetIndex = fromRowIndex - 1;
		Spotlight.focus(`row-${targetIndex}`);
		if (targetIndex === 0) {
			const contentRows = document.querySelector('[data-element="content-rows"]');
			if (contentRows) contentRows.scrollTop = 0;
		}
	}, []);

	const handleNavigateDown = useCallback((fromRowIndex) => {
		const targetIndex = fromRowIndex + 1;
		if (targetIndex >= rows.length) return;
		Spotlight.focus(`row-${targetIndex}`);
		const targetRow = document.querySelector(`[data-row-index="${targetIndex}"]`);
		if (targetRow) {
			targetRow.scrollIntoView({behavior: 'smooth', block: 'center'});
		}
	}, [rows.length]);

	useEffect(() => {
		const loadData = async () => {
			try {
				const [libResult, resumeItems, nextUp] = await Promise.all([
					api.getLibraries(),
					api.getResumeItems(),
					api.getNextUp()
				]);

				const libs = libResult.Items || [];
				setLibraries(libs);

				const rowData = [];

				if (resumeItems.Items?.length > 0) {
					rowData.push({
						id: 'resume',
						title: 'Continue Watching',
						items: resumeItems.Items,
						type: 'landscape'
					});
				}

				if (nextUp.Items?.length > 0) {
					rowData.push({
						id: 'nextup',
						title: 'Next Up',
						items: nextUp.Items,
						type: 'landscape'
					});
				}

				for (const lib of libs) {
					if (['movies', 'tvshows'].includes(lib.CollectionType)) {
						const latest = await api.getLatest(lib.Id, 16);
						if (latest?.length > 0) {
							rowData.push({
								id: lib.Id,
								title: `Latest ${lib.Name}`,
								items: latest,
								library: lib,
								type: 'portrait'
							});
						}
					}
				}

				setRows(rowData);

				const allLatest = rowData.filter(r => r.library).flatMap(r => r.items);
				if (allLatest.length > 0) {
					setFeaturedItems(allLatest.slice(0, FEATURED_ITEMS_LIMIT));
				}
			} catch (err) {
				console.error('Failed to load browse data:', err);
			} finally {
				setIsLoading(false);
			}
		};

		loadData();
	}, [api]);

	useEffect(() => {
		if (featuredItems.length <= 1 || !featuredFocused) return;

		const interval = setInterval(() => {
			setCurrentFeaturedIndex((prev) => (prev + 1) % featuredItems.length);
		}, CAROUSEL_ROTATION_MS);

		return () => clearInterval(interval);
	}, [featuredItems.length, featuredFocused]);

	useEffect(() => {
		let backdropId = null;

		if (browseMode === 'featured') {
			backdropId = getBackdropId(featuredItems[currentFeaturedIndex]);
		} else if (focusedItem) {
			backdropId = getBackdropId(focusedItem);
		} else {
			backdropId = getBackdropId(featuredItems[currentFeaturedIndex]);
		}

		if (backdropId) {
			const url = getImageUrl(serverUrl, backdropId, 'Backdrop', {maxWidth: 1920, quality: 100});

			if (backdropTimeoutRef.current) {
				clearTimeout(backdropTimeoutRef.current);
			}
			pendingBackdropRef.current = url;
			backdropTimeoutRef.current = setTimeout(() => {
				setBackdropUrl(pendingBackdropRef.current);
			}, BACKDROP_DEBOUNCE_MS);
		}

		return () => {
			if (backdropTimeoutRef.current) {
				clearTimeout(backdropTimeoutRef.current);
			}
		};
	}, [focusedItem, browseMode, currentFeaturedIndex, featuredItems, serverUrl]);

	const handleSelectItem = useCallback((item) => {
		onSelectItem?.(item);
	}, [onSelectItem]);

	const handleSelectLibrary = useCallback((library) => {
		onSelectLibrary?.(library);
	}, [onSelectLibrary]);

	const handleShuffle = useCallback(async () => {
		try {
			const items = await api.getItems({
				Recursive: true,
				IncludeItemTypes: 'Movie,Episode',
				SortBy: 'Random',
				Limit: 1
			});
			if (items.Items?.length > 0) {
				onSelectItem?.(items.Items[0]);
			}
		} catch (err) {
			console.error('Shuffle failed:', err);
		}
	}, [api, onSelectItem]);

	const handleHome = useCallback(() => {
		setBrowseMode('featured');
		if (mainContentRef.current) {
			mainContentRef.current.scrollTo({top: 0, behavior: 'smooth'});
		}
		setTimeout(() => {
			Spotlight.focus('featured-banner');
		}, FOCUS_DELAY_MS);
	}, []);

	const handleFeaturedPrev = useCallback(() => {
		if (featuredItems.length <= 1) return;
		setCurrentFeaturedIndex((prev) =>
			prev === 0 ? featuredItems.length - 1 : prev - 1
		);
	}, [featuredItems.length]);

	const handleFeaturedNext = useCallback(() => {
		if (featuredItems.length <= 1) return;
		setCurrentFeaturedIndex((prev) =>
			(prev + 1) % featuredItems.length
		);
	}, [featuredItems.length]);

	const handleFeaturedKeyDown = useCallback((e) => {
		if (e.keyCode === 37) {
			e.preventDefault();
			e.stopPropagation();
			handleFeaturedPrev();
		} else if (e.keyCode === 39) {
			e.preventDefault();
			e.stopPropagation();
			handleFeaturedNext();
		} else if (e.keyCode === 38) {
			e.preventDefault();
			e.stopPropagation();
			Spotlight.focus('navbar-home');
		} else if (e.keyCode === 40) {
			e.preventDefault();
			e.stopPropagation();
			setBrowseMode('rows');
			setTimeout(() => {
				const contentRows = document.querySelector('[data-element="content-rows"]');
				if (contentRows) contentRows.scrollTop = 0;
				Spotlight.focus('row-0');
			}, TRANSITION_DELAY_MS);
		}
	}, [handleFeaturedPrev, handleFeaturedNext]);

	const handleRowFocus = useCallback(() => {
		if (browseMode !== 'rows') {
			setBrowseMode('rows');
		}
	}, [browseMode]);

	const handleFocusItem = useCallback((item) => {
		setFocusedItem(item);
	}, []);

	const handleFeaturedClick = useCallback(() => {
		const item = featuredItems[currentFeaturedIndex];
		if (item) handleSelectItem(item);
	}, [featuredItems, currentFeaturedIndex, handleSelectItem]);

	const handleFeaturedFocus = useCallback(() => {
		setFeaturedFocused(true);
		setFocusedItem(null);
		setBrowseMode('featured');
	}, []);

	const handleFeaturedBlur = useCallback(() => {
		setFeaturedFocused(false);
	}, []);

	const handleCarouselPrevClick = useCallback((e) => {
		e.stopPropagation();
		handleFeaturedPrev();
	}, [handleFeaturedPrev]);

	const handleCarouselNextClick = useCallback((e) => {
		e.stopPropagation();
		handleFeaturedNext();
	}, [handleFeaturedNext]);

	const formatRuntime = (ticks) => {
		if (!ticks) return '';
		const minutes = Math.round(ticks / 600000000);
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
	};

	const currentFeatured = featuredItems[currentFeaturedIndex];

	if (isLoading) {
		return (
			<div className={css.page}>
				<div className={css.loadingContainer}>
					<LoadingSpinner />
					<p>Loading your library...</p>
				</div>
			</div>
		);
	}

	return (
		<div className={css.page}>
			<div className={css.globalBackdrop}>
				{backdropUrl && (
					<img className={css.globalBackdropImage} src={backdropUrl} alt="" />
				)}
				<div className={css.globalBackdropOverlay} />
			</div>

			<NavBar
				activeView="home"
				libraries={libraries}
				onHome={handleHome}
				onSearch={onOpenSearch}
				onShuffle={handleShuffle}
				onGenres={onOpenGenres}
				onFavorites={onOpenFavorites}
				onDiscover={onOpenJellyseerr}
				onSettings={onOpenSettings}
				onSelectLibrary={handleSelectLibrary}
				onUserMenu={onLogout}
			/>

			<div className={css.mainContent} ref={mainContentRef}>
				{currentFeatured && (
					<div
						className={`${css.featuredBanner} ${browseMode === 'rows' ? css.featuredHidden : ''}`}
					>
						<SpottableDiv
							className={css.featuredInner}
							spotlightId="featured-banner"
							onClick={handleFeaturedClick}
							onKeyDown={handleFeaturedKeyDown}
							onFocus={handleFeaturedFocus}
							onBlur={handleFeaturedBlur}
						>
							<div className={css.featuredBackdrop}>
								<img
									src={getImageUrl(serverUrl, getBackdropId(currentFeatured), 'Backdrop', {maxWidth: 1920, quality: 100})}
									alt=""
								/>
							</div>

							{featuredItems.length > 1 && (
								<>
									<SpottableButton
										className={`${css.carouselNav} ${css.carouselNavLeft}`}
										onClick={handleCarouselPrevClick}
									>
										<svg viewBox="0 0 24 24" width="32" height="32">
											<path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
										</svg>
									</SpottableButton>
									<SpottableButton
										className={`${css.carouselNav} ${css.carouselNavRight}`}
										onClick={handleCarouselNextClick}
									>
										<svg viewBox="0 0 24 24" width="32" height="32">
											<path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
										</svg>
									</SpottableButton>
								</>
							)}

							<div className={css.featuredContent}>
								<div className={css.featuredInfoBox}>
									<h1 className={css.featuredTitle}>{currentFeatured.Name}</h1>
									<div className={css.featuredMeta}>
										{currentFeatured.ProductionYear && (
											<span className={css.metaItem}>{currentFeatured.ProductionYear}</span>
										)}
										{currentFeatured.OfficialRating && (
											<span className={css.metaItem}>{currentFeatured.OfficialRating}</span>
										)}
										{currentFeatured.RunTimeTicks && (
											<span className={css.metaItem}>{formatRuntime(currentFeatured.RunTimeTicks)}</span>
										)}
										{currentFeatured.Genres?.slice(0, FEATURED_GENRES_LIMIT).map((g, i) => (
											<span key={i} className={css.metaItem}>{g}</span>
										))}
									</div>
									<p className={css.featuredOverview}>
										{currentFeatured.Overview || 'No description available.'}
									</p>
								</div>
							</div>

							{featuredItems.length > 1 && (
								<div className={css.featuredIndicators}>
									{featuredItems.map((_, idx) => (
										<div
											key={idx}
											className={`${css.indicatorDot} ${idx === currentFeaturedIndex ? css.active : ''}`}
										/>
									))}
								</div>
							)}
						</SpottableDiv>
					</div>
				)}

				<div
					className={`${css.detailSection} ${browseMode === 'rows' ? css.detailVisible : css.detailHidden}`}
				>
					{focusedItem ? (
						<>
							<h2 className={css.detailTitle}>
								{focusedItem.Type === 'Episode' ? focusedItem.SeriesName : focusedItem.Name}
							</h2>
							<div className={css.detailInfoRow}>
								{focusedItem.ProductionYear && (
									<span className={css.infoBadge}>{focusedItem.ProductionYear}</span>
								)}
								{focusedItem.OfficialRating && (
									<span className={css.infoBadge}>{focusedItem.OfficialRating}</span>
								)}
								{focusedItem.RunTimeTicks && (
									<span className={css.infoBadge}>{formatRuntime(focusedItem.RunTimeTicks)}</span>
								)}
								{focusedItem.Type === 'Episode' && focusedItem.ParentIndexNumber !== undefined && (
									<span className={css.infoBadge}>
										S{focusedItem.ParentIndexNumber} E{focusedItem.IndexNumber}
									</span>
								)}
								{focusedItem.Genres?.slice(0, DETAIL_GENRES_LIMIT).map((g, i) => (
									<span key={i} className={css.infoBadge}>{g}</span>
								))}
							</div>
							<p className={css.detailSummary}>
								{focusedItem.Overview || 'No description available.'}
							</p>
						</>
					) : (
						<div className={css.detailPlaceholder}>
							<p>Navigate to an item to see details</p>
						</div>
					)}
				</div>

				<div
					className={`${css.contentRows} ${browseMode === 'rows' ? css.rowsMode : ''}`}
					data-element="content-rows"
				>
					{rows.map((row, index) => (
						<MediaRow
							key={row.id}
							title={row.title}
							items={row.items}
							serverUrl={serverUrl}
							cardType={row.type}
							onSelectItem={handleSelectItem}
							onFocus={handleRowFocus}
							onFocusItem={handleFocusItem}
							rowIndex={index}
							onNavigateUp={handleNavigateUp}
							onNavigateDown={handleNavigateDown}
						/>
					))}
					{rows.length === 0 && (
						<div className={css.empty}>No content found</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default Browse;
