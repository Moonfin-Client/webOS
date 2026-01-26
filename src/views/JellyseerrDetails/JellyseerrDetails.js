import {useCallback, useEffect, useState, useRef, useMemo, memo} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import Image from '@enact/sandstone/Image';
import Popup from '@enact/sandstone/Popup';
import Button from '@enact/sandstone/Button';
import jellyseerrApi from '../../services/jellyseerrApi';
import {useJellyseerr} from '../../context/JellyseerrContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import css from './JellyseerrDetails.module.less';

const SpottableDiv = Spottable('div');
const RowContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused'
}, 'div');
const ActionButtonsContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused'
}, 'div');
const CastSectionContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused'
}, 'div');
const KeywordsSectionContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused'
}, 'div');

// Status constants matching Android TV app
const STATUS = {
	UNKNOWN: 1,
	PENDING: 2,
	PROCESSING: 3,
	PARTIALLY_AVAILABLE: 4,
	AVAILABLE: 5,
	BLACKLISTED: 6
};

/**
 * Get combined status badge text and color matching Android TV MediaDetailsFragment
 * Handles all HD/4K status combinations
 */
const getStatusBadge = (hdStatus, status4k, hdDeclined, fourKDeclined) => {
	// Check for declined states first
	if (hdDeclined && fourKDeclined) return {text: 'DECLINED', color: 'red'};
	if (fourKDeclined && hdStatus === STATUS.AVAILABLE) return {text: 'HD AVAILABLE • 4K DECLINED', color: 'mixed'};
	if (hdDeclined && status4k === STATUS.AVAILABLE) return {text: 'HD DECLINED • 4K AVAILABLE', color: 'mixed'};
	if (fourKDeclined) return {text: '4K DECLINED', color: 'red'};
	if (hdDeclined) return {text: 'HD DECLINED', color: 'red'};

	// Both available
	if (hdStatus === STATUS.AVAILABLE && status4k === STATUS.AVAILABLE) return {text: 'HD + 4K AVAILABLE', color: 'green'};

	// One available
	if (status4k === STATUS.AVAILABLE) return {text: '4K AVAILABLE', color: 'green'};
	if (hdStatus === STATUS.AVAILABLE) return {text: 'HD AVAILABLE', color: 'green'};

	// Partially available combinations
	if (hdStatus === STATUS.PARTIALLY_AVAILABLE && status4k === STATUS.PARTIALLY_AVAILABLE) return {text: 'PARTIALLY AVAILABLE', color: 'purple'};
	if (hdStatus === STATUS.PARTIALLY_AVAILABLE && status4k === STATUS.PROCESSING) return {text: 'HD PARTIAL • 4K PROCESSING', color: 'mixed'};
	if (hdStatus === STATUS.PARTIALLY_AVAILABLE && status4k === STATUS.PENDING) return {text: 'HD PARTIAL • 4K PENDING', color: 'mixed'};
	if (hdStatus === STATUS.PARTIALLY_AVAILABLE) return {text: 'HD PARTIALLY AVAILABLE', color: 'purple'};
	if (status4k === STATUS.PARTIALLY_AVAILABLE && hdStatus === STATUS.PROCESSING) return {text: 'HD PROCESSING • 4K PARTIAL', color: 'mixed'};
	if (status4k === STATUS.PARTIALLY_AVAILABLE && hdStatus === STATUS.PENDING) return {text: 'HD PENDING • 4K PARTIAL', color: 'mixed'};
	if (status4k === STATUS.PARTIALLY_AVAILABLE) return {text: '4K PARTIALLY AVAILABLE', color: 'purple'};

	// Processing combinations
	if (hdStatus === STATUS.PROCESSING && status4k === STATUS.PROCESSING) return {text: 'PROCESSING', color: 'indigo'};
	if (hdStatus === STATUS.PROCESSING && status4k === STATUS.PENDING) return {text: 'HD PROCESSING • 4K PENDING', color: 'mixed'};
	if (status4k === STATUS.PROCESSING && hdStatus === STATUS.PENDING) return {text: 'HD PENDING • 4K PROCESSING', color: 'mixed'};
	if (status4k === STATUS.PROCESSING) return {text: '4K PROCESSING', color: 'indigo'};
	if (hdStatus === STATUS.PROCESSING) return {text: 'HD PROCESSING', color: 'indigo'};

	// Pending combinations
	if (hdStatus === STATUS.PENDING && status4k === STATUS.PENDING) return {text: 'PENDING', color: 'yellow'};
	if (status4k === STATUS.PENDING) return {text: '4K PENDING', color: 'yellow'};
	if (hdStatus === STATUS.PENDING) return {text: 'HD PENDING', color: 'yellow'};

	// Blacklisted
	if (hdStatus === STATUS.BLACKLISTED || status4k === STATUS.BLACKLISTED) return {text: 'BLACKLISTED', color: 'red'};

	// Not requested
	return {text: 'NOT REQUESTED', color: 'gray'};
};

/**
 * Check if a status blocks new requests
 * Blocked if: pending (2), processing (3), available (5), blacklisted (6)
 * Requestable if: not requested (null/1), or partially available (4)
 */
const isStatusBlocked = (currentStatus) => {
	return currentStatus != null && currentStatus >= 2 && currentStatus !== STATUS.PARTIALLY_AVAILABLE;
};

/**
 * Format date string to readable format
 */
const formatDate = (dateStr) => {
	if (!dateStr) return null;
	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'});
	} catch {
		return null;
	}
};

/**
 * Format currency
 */
const formatCurrency = (amount) => {
	if (!amount || amount <= 0) return null;
	return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(amount);
};

/**
 * Format runtime
 */
const formatRuntime = (minutes) => {
	if (!minutes) return null;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

// Memoized Cast Card component
const CastCard = memo(({person, onSelect}) => {
	const photoUrl = person.profilePath
		? jellyseerrApi.getImageUrl(person.profilePath, 'w185')
		: null;

	const handleClick = useCallback(() => {
		onSelect(person);
	}, [person, onSelect]);

	return (
		<SpottableDiv className={css.castCard} onClick={handleClick}>
			<div className={css.castPhotoContainer}>
				{photoUrl ? (
					<Image className={css.castPhoto} src={photoUrl} sizing="fill" />
				) : (
					<div className={css.castPhotoPlaceholder}>{person.name?.[0]}</div>
				)}
			</div>
			<p className={css.castName}>{person.name}</p>
			{person.character && <p className={css.castCharacter}>{person.character}</p>}
		</SpottableDiv>
	);
});

// Memoized Media Card component
const MediaCard = memo(({item, onSelect}) => {
	const posterUrl = jellyseerrApi.getImageUrl(item.posterPath || item.poster_path, 'w342');
	const title = item.title || item.name;

	const handleClick = useCallback(() => {
		onSelect(item);
	}, [item, onSelect]);

	return (
		<SpottableDiv className={css.recommendationCard} onClick={handleClick}>
			{posterUrl ? (
				<Image className={css.recommendationPoster} src={posterUrl} sizing="fill" />
			) : (
				<div className={css.recommendationNoPoster}>{title?.[0]}</div>
			)}
			<div className={css.recommendationTitle}>{title}</div>
		</SpottableDiv>
	);
});

// Memoized Keyword Tag component
const KeywordTag = memo(({keyword, onSelect}) => {
	const handleClick = useCallback(() => {
		onSelect(keyword);
	}, [keyword, onSelect]);

	return (
		<SpottableDiv className={css.keywordTag} onClick={handleClick}>
			{keyword.name}
		</SpottableDiv>
	);
});

const HorizontalMediaRow = memo(({title, items, onSelect, rowIndex, onNavigateUp, onNavigateDown, sectionClass}) => {
	const scrollerRef = useRef(null);

	const handleFocus = useCallback((e) => {
		const card = e.target.closest(`.${css.recommendationCard}`);
		const scroller = scrollerRef.current;
		if (card && scroller) {
			const cardRect = card.getBoundingClientRect();
			const scrollerRect = scroller.getBoundingClientRect();

			if (cardRect.left < scrollerRect.left) {
				scroller.scrollLeft -= (scrollerRect.left - cardRect.left + 50);
			} else if (cardRect.right > scrollerRect.right) {
				scroller.scrollLeft += (cardRect.right - scrollerRect.right + 50);
			}
		}
	}, []);

	const handleKeyDown = useCallback((e) => {
		if (e.keyCode === 38) {
			e.preventDefault();
			e.stopPropagation();
			onNavigateUp?.(rowIndex);
		} else if (e.keyCode === 40) {
			e.preventDefault();
			e.stopPropagation();
			onNavigateDown?.(rowIndex);
		}
	}, [rowIndex, onNavigateUp, onNavigateDown]);

	if (!items || items.length === 0) return null;

	return (
		<div className={sectionClass}>
			<h2 className={css.sectionTitle}>{title}</h2>
			<RowContainer
				className={css.rowContainer}
				spotlightId={`details-row-${rowIndex}`}
				data-row-index={rowIndex}
				onKeyDown={handleKeyDown}
				ref={scrollerRef}
				onFocus={handleFocus}
			>
				{items.map(item => (
					<MediaCard key={item.id} item={item} onSelect={onSelect} />
				))}
			</RowContainer>
		</div>
	);
});

// Quality Selection Popup - matches Android TV QualitySelectionDialog
const QualitySelectionPopup = memo(({open, title, hdStatus, status4k, canRequestHd, canRequest4k, onSelect, onClose}) => {
	const getButtonLabel = useCallback((is4k, currentStatus) => {
		const quality = is4k ? '4K' : 'HD';
		if (currentStatus === STATUS.PENDING) return `${quality} (Pending)`;
		if (currentStatus === STATUS.PROCESSING) return `${quality} (Processing)`;
		if (currentStatus === STATUS.AVAILABLE) return `${quality} (Available)`;
		if (currentStatus === STATUS.PARTIALLY_AVAILABLE) return `Request More ${quality}`;
		return `Request ${quality}`;
	}, []);

	const handleHdClick = useCallback(() => {
		if (canRequestHd) onSelect(false);
	}, [canRequestHd, onSelect]);

	const handleFourKClick = useCallback(() => {
		if (canRequest4k) onSelect(true);
	}, [canRequest4k, onSelect]);

	return (
		<Popup open={open} onClose={onClose} position="center" className={css.qualityPopup}>
			<div className={css.qualityPopupContent}>
				<h2 className={css.qualityPopupTitle}>Request {title}</h2>
				<p className={css.qualityPopupSubtitle}>Select quality to request</p>
				<div className={css.qualityButtons}>
					<Button
						className={`${css.qualityButton} ${!canRequestHd ? css.qualityButtonDisabled : ''}`}
						onClick={handleHdClick}
						disabled={!canRequestHd}
					>
						{getButtonLabel(false, hdStatus)}
					</Button>
					<Button
						className={`${css.qualityButton} ${!canRequest4k ? css.qualityButtonDisabled : ''}`}
						onClick={handleFourKClick}
						disabled={!canRequest4k}
					>
						{getButtonLabel(true, status4k)}
					</Button>
				</div>
				<Button className={css.qualityCancelButton} onClick={onClose}>
					Cancel
				</Button>
			</div>
		</Popup>
	);
});

// Cancel Request Confirmation Popup
const CancelRequestPopup = memo(({open, pendingRequests, title, onConfirm, onClose}) => {
	const description = useMemo(() => {
		if (!pendingRequests || pendingRequests.length === 0) return '';
		if (pendingRequests.length === 1) {
			const req = pendingRequests[0];
			const quality = req.is4k ? '4K' : 'HD';
			return `Cancel ${quality} request for "${title}"?`;
		}
		const hdCount = pendingRequests.filter(r => !r.is4k).length;
		const fourKCount = pendingRequests.filter(r => r.is4k).length;
		const parts = [];
		if (hdCount > 0) parts.push(`${hdCount} HD`);
		if (fourKCount > 0) parts.push(`${fourKCount} 4K`);
		return `Cancel ${parts.join(' and ')} request${pendingRequests.length > 1 ? 's' : ''} for "${title}"?`;
	}, [pendingRequests, title]);

	return (
		<Popup open={open} onClose={onClose} position="center" className={css.cancelPopup}>
			<div className={css.cancelPopupContent}>
				<h2 className={css.cancelPopupTitle}>Cancel Request</h2>
				<p className={css.cancelPopupDescription}>{description}</p>
				<div className={css.cancelButtons}>
					<Button className={css.cancelConfirmButton} onClick={onConfirm}>
						Cancel Request
					</Button>
					<Button className={css.cancelKeepButton} onClick={onClose}>
						Keep Request
					</Button>
				</div>
			</div>
		</Popup>
	);
});

const JellyseerrDetails = ({mediaType, mediaId, onClose, onSelectItem, onSelectPerson, onSelectKeyword, onBack}) => {
	const {isAuthenticated} = useJellyseerr();
	const [details, setDetails] = useState(null);
	const [loading, setLoading] = useState(true);
	const [requesting, setRequesting] = useState(false);
	const [error, setError] = useState(null);
	const [recommendations, setRecommendations] = useState([]);
	const [similar, setSimilar] = useState([]);
	const [showQualityPopup, setShowQualityPopup] = useState(false);
	const [showCancelPopup, setShowCancelPopup] = useState(false);
	const contentRef = useRef(null);

	// Popup close handlers - must be defined before any early returns
	const handleCloseQualityPopup = useCallback(() => setShowQualityPopup(false), []);
	const handleCloseCancelPopup = useCallback(() => setShowCancelPopup(false), []);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.keyCode === 461 || e.keyCode === 27) {
				if (showQualityPopup) {
					setShowQualityPopup(false);
				} else if (showCancelPopup) {
					setShowCancelPopup(false);
				} else {
					onClose?.();
					onBack?.();
				}
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [onClose, onBack, showQualityPopup, showCancelPopup]);

	useEffect(() => {
		if (!mediaId || !mediaType) return;

		const loadDetails = async () => {
			setLoading(true);
			setError(null);
			try {
				const data = mediaType === 'movie'
					? await jellyseerrApi.getMovie(mediaId)
					: await jellyseerrApi.getTv(mediaId);
				setDetails(data);

				// Load recommendations and similar (3 pages each like Android TV)
				const loadMultiplePages = async (fetcher) => {
					const allResults = [];
					for (let page = 1; page <= 3; page++) {
						try {
							const pageData = await fetcher(mediaId, page);
							if (pageData?.results) allResults.push(...pageData.results);
						} catch {
							break;
						}
					}
					return allResults;
				};

				const [recsData, similarData] = await Promise.all([
					loadMultiplePages(mediaType === 'movie'
						? jellyseerrApi.getMovieRecommendations
						: jellyseerrApi.getTvRecommendations
					),
					loadMultiplePages(mediaType === 'movie'
						? jellyseerrApi.getMovieSimilar
						: jellyseerrApi.getTvSimilar
					)
				]);
				setRecommendations(recsData.slice(0, 20));
				setSimilar(similarData.slice(0, 20));
			} catch (err) {
				console.error('Failed to load details:', err);
				setError(err.message || 'Failed to load details');
			} finally {
				setLoading(false);
			}
		};

		loadDetails();
	}, [mediaId, mediaType]);

	useEffect(() => {
		if (!loading && details) {
			Spotlight.focus('action-buttons');
		}
	}, [loading, details]);

	// Memoized status values
	const hdStatus = useMemo(() => details?.mediaInfo?.status ?? null, [details]);
	const status4k = useMemo(() => details?.mediaInfo?.status4k ?? null, [details]);
	const requests = useMemo(() => details?.mediaInfo?.requests ?? [], [details]);
	const hdDeclined = useMemo(() => requests.some(r => !r.is4k && r.status === 3), [requests]);
	const fourKDeclined = useMemo(() => requests.some(r => r.is4k && r.status === 3), [requests]);
	const pendingRequests = useMemo(() => requests.filter(r => r.status === STATUS.PENDING), [requests]);

	// Check if HD/4K are requestable (matching Android TV logic)
	const canRequestHd = useMemo(() => {
		if (!isAuthenticated) return false;
		const blocked = isStatusBlocked(hdStatus) || hdDeclined;
		return !blocked;
	}, [isAuthenticated, hdStatus, hdDeclined]);

	const canRequest4k = useMemo(() => {
		if (!isAuthenticated) return false;
		const blocked = isStatusBlocked(status4k) || fourKDeclined;
		return !blocked;
	}, [isAuthenticated, status4k, fourKDeclined]);

	const canRequestAny = canRequestHd || canRequest4k;

	// Status badge
	const statusBadge = useMemo(() =>
		getStatusBadge(hdStatus, status4k, hdDeclined, fourKDeclined),
	[hdStatus, status4k, hdDeclined, fourKDeclined]
	);

	// Request button label (matches Android TV getStatusLabel)
	const requestButtonLabel = useMemo(() => {
		if (!canRequestAny) {
			// Return status label when nothing requestable
			if (hdDeclined && fourKDeclined) return 'Declined';
			if (fourKDeclined) return '4K Declined';
			if (hdDeclined) return 'HD Declined';
			if (hdStatus === STATUS.AVAILABLE && status4k === STATUS.AVAILABLE) return 'Available';
			if (status4k === STATUS.AVAILABLE) return '4K Available';
			if (hdStatus === STATUS.AVAILABLE) return 'HD Available';
			if (hdStatus === STATUS.PROCESSING && status4k === STATUS.PROCESSING) return 'Processing';
			if (status4k === STATUS.PROCESSING) return '4K Processing';
			if (hdStatus === STATUS.PROCESSING) return 'HD Processing';
			if (hdStatus === STATUS.PENDING && status4k === STATUS.PENDING) return 'Pending';
			if (status4k === STATUS.PENDING) return '4K Pending';
			if (hdStatus === STATUS.PENDING) return 'HD Pending';
			if (hdStatus === STATUS.BLACKLISTED || status4k === STATUS.BLACKLISTED) return 'Blacklisted';
			return 'Unavailable';
		}
		// Can request
		if (hdStatus === STATUS.PARTIALLY_AVAILABLE || status4k === STATUS.PARTIALLY_AVAILABLE) return 'Request More';
		return 'Request';
	}, [canRequestAny, hdStatus, status4k, hdDeclined, fourKDeclined]);

	const handleRequest = useCallback(async (is4K = false) => {
		if (requesting) return;

		setShowQualityPopup(false);
		setRequesting(true);
		try {
			if (mediaType === 'movie') {
				await jellyseerrApi.requestMovie(mediaId, {is4k: is4K});
			} else {
				await jellyseerrApi.requestTv(mediaId, {is4k: is4K});
			}
			// Refresh details to update status
			const updated = mediaType === 'movie'
				? await jellyseerrApi.getMovie(mediaId)
				: await jellyseerrApi.getTv(mediaId);
			setDetails(updated);
		} catch (err) {
			console.error('Request failed:', err);
			setError(err.message || 'Request failed');
		} finally {
			setRequesting(false);
		}
	}, [mediaId, mediaType, requesting]);

	const handleRequestClick = useCallback(() => {
		if (!canRequestAny) return;
		// If both HD and 4K are requestable, show quality selection
		if (canRequestHd && canRequest4k) {
			setShowQualityPopup(true);
		} else if (canRequest4k) {
			handleRequest(true);
		} else if (canRequestHd) {
			handleRequest(false);
		}
	}, [canRequestAny, canRequestHd, canRequest4k, handleRequest]);

	const handleCancelRequestClick = useCallback(() => {
		if (pendingRequests.length > 0) {
			setShowCancelPopup(true);
		}
	}, [pendingRequests]);

	const handleCancelConfirm = useCallback(async () => {
		setShowCancelPopup(false);
		try {
			for (const req of pendingRequests) {
				await jellyseerrApi.cancelRequest(req.id);
			}
			// Refresh details
			const updated = mediaType === 'movie'
				? await jellyseerrApi.getMovie(mediaId)
				: await jellyseerrApi.getTv(mediaId);
			setDetails(updated);
		} catch (err) {
			console.error('Cancel failed:', err);
			setError(err.message || 'Failed to cancel request');
		}
	}, [pendingRequests, mediaId, mediaType]);

	const handleTrailer = useCallback(() => {
		// Search YouTube for trailer like Android TV app does
		const mediaTitle = details?.title || details?.name || 'Unknown';
		const mediaYear = details?.releaseDate?.substring(0, 4) || details?.firstAirDate?.substring(0, 4) || '';
		const searchQuery = `${mediaTitle} ${mediaYear} official trailer`;
		const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
		window.open(youtubeUrl, '_blank');
	}, [details]);

	const handlePlay = useCallback(() => {
		// Navigate to play the content in Jellyfin/Moonfin
		if (details?.mediaInfo?.jellyfinMediaId) {
			console.log('Play content:', details.mediaInfo.jellyfinMediaId);
		}
	}, [details]);

	const handleSelectRelated = useCallback((item) => {
		const type = item.mediaType || item.media_type || (item.title ? 'movie' : 'tv');
		onSelectItem?.({mediaId: item.id, mediaType: type});
	}, [onSelectItem]);

	const handleSelectCast = useCallback((person) => {
		onSelectPerson?.(person.id, person.name);
	}, [onSelectPerson]);

	const handleSelectKeyword = useCallback((keyword) => {
		onSelectKeyword?.(keyword, mediaType);
	}, [onSelectKeyword, mediaType]);

	// Handle action buttons key navigation
	const handleActionButtonsKeyDown = useCallback((e) => {
		if (e.keyCode === 40) { // Down arrow
			e.preventDefault();
			e.stopPropagation();
			// Try to focus cast section first, then recommendations, then similar
			const castFocused = Spotlight.focus('cast-section');
			if (!castFocused) {
				const recFocused = Spotlight.focus('details-row-0');
				if (!recFocused) {
					Spotlight.focus('details-row-1');
				}
			}
		}
	}, []);

	// Row navigation handlers (like Browse/MediaRow)
	const handleRowNavigateUp = useCallback((fromRowIndex) => {
		if (fromRowIndex === 0) {
			// Try cast section first, then action buttons
			const castFocused = Spotlight.focus('cast-section');
			if (!castFocused) {
				Spotlight.focus('action-buttons');
			}
		} else {
			const targetIndex = fromRowIndex - 1;
			const focused = Spotlight.focus(`details-row-${targetIndex}`);
			if (!focused) {
				// If row doesn't exist, try cast or action buttons
				const castFocused = Spotlight.focus('cast-section');
				if (!castFocused) {
					Spotlight.focus('action-buttons');
				}
			}
		}
	}, []);

	const handleRowNavigateDown = useCallback((fromRowIndex) => {
		const targetIndex = fromRowIndex + 1;
		// Try to focus next row, if it fails try keywords section
		const focused = Spotlight.focus(`details-row-${targetIndex}`);
		if (!focused) {
			// Try keywords or seasons section
			const keywordsFocused = Spotlight.focus('keywords-section');
			if (!keywordsFocused) {
				Spotlight.focus('seasons-section');
			}
		}
	}, []);

	// Handle cast section key navigation
	const handleCastSectionKeyDown = useCallback((e) => {
		if (e.keyCode === 38) { // Up arrow
			e.preventDefault();
			e.stopPropagation();
			Spotlight.focus('action-buttons');
		} else if (e.keyCode === 40) { // Down arrow
			e.preventDefault();
			e.stopPropagation();
			// Try recommendations, then similar
			const recFocused = Spotlight.focus('details-row-0');
			if (!recFocused) {
				const simFocused = Spotlight.focus('details-row-1');
				if (!simFocused) {
					Spotlight.focus('keywords-section');
				}
			}
		}
	}, []);

	// Handle keywords section key navigation
	const handleKeywordsSectionKeyDown = useCallback((e) => {
		if (e.keyCode === 38) { // Up arrow
			e.preventDefault();
			e.stopPropagation();
			// Try similar, then recommendations, then cast, then action buttons
			const simFocused = Spotlight.focus('details-row-1');
			if (!simFocused) {
				const recFocused = Spotlight.focus('details-row-0');
				if (!recFocused) {
					const castFocused = Spotlight.focus('cast-section');
					if (!castFocused) {
						Spotlight.focus('action-buttons');
					}
				}
			}
		} else if (e.keyCode === 40) { // Down arrow
			e.preventDefault();
			e.stopPropagation();
			// Try seasons section
			Spotlight.focus('seasons-section');
		}
	}, []);

	// Media facts data (matches Android TV createMediaFactsSection)
	const mediaFacts = useMemo(() => {
		if (!details) return [];
		const facts = [];

		// TMDB Score
		const voteAverage = details.voteAverage;
		if (voteAverage && voteAverage > 0) {
			facts.push({label: 'TMDB Score', value: `${Math.round(voteAverage * 10)}%`});
		}

		// Status
		const productionStatus = details.status;
		if (productionStatus) {
			facts.push({label: 'Status', value: productionStatus});
		}

		// TV Show specific fields
		if (mediaType === 'tv') {
			if (details.firstAirDate) {
				const formatted = formatDate(details.firstAirDate);
				if (formatted) facts.push({label: 'First Air Date', value: formatted});
			}
			if (details.lastAirDate) {
				const formatted = formatDate(details.lastAirDate);
				if (formatted) facts.push({label: 'Last Air Date', value: formatted});
			}
			if (details.numberOfSeasons) {
				facts.push({label: 'Seasons', value: details.numberOfSeasons.toString()});
			}
			// Networks
			if (details.networks?.length > 0) {
				facts.push({label: 'Networks', value: details.networks.slice(0, 3).map(n => n.name).join(', ')});
			}
		}

		// Movie specific fields
		if (mediaType === 'movie') {
			if (details.releaseDate) {
				const formatted = formatDate(details.releaseDate);
				if (formatted) facts.push({label: 'Release Date', value: formatted});
			}
			if (details.runtime) {
				facts.push({label: 'Runtime', value: formatRuntime(details.runtime)});
			}
			if (details.budget) {
				const formatted = formatCurrency(details.budget);
				if (formatted) facts.push({label: 'Budget', value: formatted});
			}
			if (details.revenue) {
				const formatted = formatCurrency(details.revenue);
				if (formatted) facts.push({label: 'Revenue', value: formatted});
			}
		}

		return facts;
	}, [details, mediaType]);

	if (loading) {
		return (
			<div className={css.container}>
				<LoadingSpinner />
			</div>
		);
	}

	if (error && !details) {
		return (
			<div className={css.container}>
				<div className={css.error}>
					<p>{error}</p>
					<SpottableDiv className={css.errorButton} onClick={onClose || onBack}>
						Go Back
					</SpottableDiv>
				</div>
			</div>
		);
	}

	if (!details) {
		return (
			<div className={css.container}>
				<div className={css.error}>
					<p>No details available</p>
				</div>
			</div>
		);
	}

	const posterUrl = details.posterPath
		? jellyseerrApi.getImageUrl(details.posterPath, 'w500')
		: null;
	const backdropUrl = details.backdropPath
		? jellyseerrApi.getImageUrl(details.backdropPath, 'original')
		: null;
	const title = details.title || details.name;
	const year = details.releaseDate
		? new Date(details.releaseDate).getFullYear()
		: details.firstAirDate
			? new Date(details.firstAirDate).getFullYear()
			: null;
	const isAvailable = hdStatus === STATUS.AVAILABLE || hdStatus === STATUS.PARTIALLY_AVAILABLE;
	const keywords = details.keywords || [];

	return (
		<div className={css.container}>
			{/* Quality Selection Popup */}
			<QualitySelectionPopup
				open={showQualityPopup}
				title={title}
				hdStatus={hdStatus}
				status4k={status4k}
				canRequestHd={canRequestHd}
				canRequest4k={canRequest4k}
				onSelect={handleRequest}
				onClose={handleCloseQualityPopup}
			/>

			{/* Cancel Request Popup */}
			<CancelRequestPopup
				open={showCancelPopup}
				pendingRequests={pendingRequests}
				title={title}
				onConfirm={handleCancelConfirm}
				onClose={handleCloseCancelPopup}
			/>

			{/* Backdrop */}
			<div className={css.backdropSection}>
				{backdropUrl && <Image className={css.backdropImage} src={backdropUrl} />}
				<div className={css.backdropOverlay} />
			</div>

			<div className={css.mainContent} ref={contentRef}>
				{/* Header Section with Poster and Title */}
				<div className={css.headerWrapper}>
					{/* Poster */}
					<div className={css.posterContainer}>
						{posterUrl ? (
							<Image className={css.posterImage} src={posterUrl} sizing="fill" />
						) : (
							<div className={css.posterPlaceholder}>{title?.[0]}</div>
						)}
					</div>

					{/* Title Section */}
					<div className={css.titleSection}>
						<h1 className={css.mediaTitle}>
							{title}
							{year && <span className={css.mediaYear}> ({year})</span>}
						</h1>

						{/* Status Badge - Combined HD/4K status */}
						<div className={`${css.statusBadge} ${css[`badge${statusBadge.color}`]}`}>
							{statusBadge.text}
						</div>

						{/* Metadata Row */}
						<div className={css.metadataRow}>
							{details.voteAverage > 0 && (
								<span className={css.metadataItem}>★ {details.voteAverage.toFixed(1)}</span>
							)}
							{details.runtime && (
								<span className={css.metadataItem}>{formatRuntime(details.runtime)}</span>
							)}
							{details.numberOfSeasons && (
								<span className={css.metadataItem}>
									{details.numberOfSeasons} Season{details.numberOfSeasons > 1 ? 's' : ''}
								</span>
							)}
						</div>

						{/* Genres */}
						{details.genres?.length > 0 && (
							<div className={css.genresRow}>
								{details.genres.slice(0, 3).map(g => g.name).join(' • ')}
							</div>
						)}

						{/* Tagline */}
						{details.tagline && (
							<p className={css.tagline}>&ldquo;{details.tagline}&rdquo;</p>
						)}
					</div>
				</div>

				{/* Overview Section */}
				<div className={css.overviewSection}>
					{/* Left side - Overview text and action buttons */}
					<div className={css.overviewLeft}>
						<h2 className={css.overviewHeading}>Overview</h2>
						<p className={css.overview}>{details.overview || 'Overview unavailable.'}</p>

						{/* Action Buttons */}
						<ActionButtonsContainer
							className={css.actionButtons}
							spotlightId="action-buttons"
							onKeyDown={handleActionButtonsKeyDown}
						>
							{/* Request Button */}
							<div className={css.btnWrapper}>
								<SpottableDiv
									className={`${css.btnAction} ${!canRequestAny ? css.btnDisabled : ''}`}
									onClick={handleRequestClick}
									disabled={!canRequestAny}
								>
									<span className={css.btnIcon}>📥</span>
								</SpottableDiv>
								<span className={css.btnLabel}>{requestButtonLabel}</span>
							</div>

							{/* Cancel Request Button - show if pending requests exist */}
							{pendingRequests.length > 0 && (
								<div className={css.btnWrapper}>
									<SpottableDiv className={css.btnAction} onClick={handleCancelRequestClick}>
										<span className={css.btnIcon}>🗑️</span>
									</SpottableDiv>
									<span className={css.btnLabel}>Cancel Request</span>
								</div>
							)}

							{/* Watch Trailer Button */}
							<div className={css.btnWrapper}>
								<SpottableDiv className={css.btnAction} onClick={handleTrailer}>
									<span className={css.btnIcon}>▶️</span>
								</SpottableDiv>
								<span className={css.btnLabel}>Watch Trailer</span>
							</div>

							{/* Play in Moonfin Button (if available) */}
							{isAvailable && (
								<div className={css.btnWrapper}>
									<SpottableDiv className={css.btnAction} onClick={handlePlay}>
										<span className={css.btnIcon}>🎞️</span>
									</SpottableDiv>
									<span className={css.btnLabel}>Play in Moonfin</span>
								</div>
							)}
						</ActionButtonsContainer>
					</div>

					{/* Right side - Media Facts */}
					{mediaFacts.length > 0 && (
						<div className={css.mediaFacts}>
							{mediaFacts.map((fact, index) => (
								<div
									key={fact.label}
									className={`${css.factRow} ${index === 0 ? css.factRowFirst : ''} ${index === mediaFacts.length - 1 ? css.factRowLast : ''}`}
								>
									<span className={css.factLabel}>{fact.label}</span>
									<span className={css.factValue}>{fact.value}</span>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Cast Section */}
				{details.credits?.cast?.length > 0 && (
					<CastSectionContainer
						className={css.castSection}
						spotlightId="cast-section"
						onKeyDown={handleCastSectionKeyDown}
					>
						<h2 className={css.sectionTitle}>Cast</h2>
						<div className={css.castList}>
							{details.credits.cast.slice(0, 10).map(person => (
								<CastCard key={person.id} person={person} onSelect={handleSelectCast} />
							))}
						</div>
					</CastSectionContainer>
				)}

				{/* Recommendations Section */}
				{recommendations.length > 0 && (
					<HorizontalMediaRow
						title="Recommendations"
						items={recommendations}
						onSelect={handleSelectRelated}
						rowIndex={0}
						onNavigateUp={handleRowNavigateUp}
						onNavigateDown={handleRowNavigateDown}
						sectionClass={css.recommendationsSection}
					/>
				)}

				{/* Similar Section */}
				{similar.length > 0 && (
					<HorizontalMediaRow
						title={mediaType === 'tv' ? 'Similar Series' : 'Similar Titles'}
						items={similar}
						onSelect={handleSelectRelated}
						rowIndex={1}
						onNavigateUp={handleRowNavigateUp}
						onNavigateDown={handleRowNavigateDown}
						sectionClass={css.similarSection}
					/>
				)}

				{/* Keywords Section */}
				{keywords.length > 0 && (
					<KeywordsSectionContainer
						className={css.keywordsSection}
						spotlightId="keywords-section"
						onKeyDown={handleKeywordsSectionKeyDown}
					>
						<h2 className={css.sectionTitle}>Keywords</h2>
						<div className={css.keywordsList}>
							{keywords.map(keyword => (
								<KeywordTag key={keyword.id} keyword={keyword} onSelect={handleSelectKeyword} />
							))}
						</div>
					</KeywordsSectionContainer>
				)}

				{/* Seasons Section for TV */}
				{mediaType === 'tv' && details.seasons?.length > 0 && (
					<div className={css.seasonsSection}>
						<h2 className={css.sectionTitle}>Seasons</h2>
						<div className={css.seasonsList}>
							{details.seasons.filter(s => s.seasonNumber > 0).map(season => (
								<div key={season.id} className={css.seasonItem}>
									<span className={css.seasonName}>{season.name}</span>
									<span className={css.seasonEpisodes}>{season.episodeCount} episodes</span>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default JellyseerrDetails;
