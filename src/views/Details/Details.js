import {useState, useEffect, useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import {Scroller} from '@enact/sandstone/Scroller';
import Button from '@enact/sandstone/Button';
import {useAuth} from '../../context/AuthContext';
import {useSettings} from '../../context/SettingsContext';
import MediaRow from '../../components/MediaRow';
import LoadingSpinner from '../../components/LoadingSpinner';
import {formatDuration, getImageUrl, getBackdropId, getLogoUrl} from '../../utils/helpers';

import css from './Details.module.less';

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');

const getResolutionName = (width, height) => {
	if (width >= 3800 && height >= 2100) return '4K';
	if (width >= 2500 && height >= 1400) return '1440P';
	if (width >= 1900 && height >= 1000) return '1080P';
	if (width >= 1260 && height >= 700) return '720P';
	if (width >= 1000 && height >= 560) return '576P';
	if (width >= 850 && height >= 460) return '480P';
	return height + 'P';
};

const Details = ({itemId, onPlay, onSelectItem, onSelectPerson, onBack}) => {
	const {api, serverUrl} = useAuth();
	const {settings} = useSettings();
	const [item, setItem] = useState(null);
	const [seasons, setSeasons] = useState([]);
	const [episodes, setEpisodes] = useState([]);
	const [similar, setSimilar] = useState([]);
	const [cast, setCast] = useState([]);
	const [nextUp, setNextUp] = useState([]);
	const [collectionItems, setCollectionItems] = useState([]);
	const [selectedSeason, setSelectedSeason] = useState(null);
	const [isLoading, setIsLoading] = useState(true);

	const castScrollerRef = useRef(null);
	const primaryButtonRef = useRef(null);

	useEffect(() => {
		const loadItem = async () => {
			setIsLoading(true);
			setSeasons([]);
			setEpisodes([]);
			setSimilar([]);
			setCast([]);
			setNextUp([]);
			setCollectionItems([]);
			setSelectedSeason(null);

			try {
				const data = await api.getItem(itemId);
				setItem(data);

				if (data.People?.length > 0) {
					setCast(data.People.slice(0, 20));
				}

				if (data.Type === 'Series') {
					const seasonsData = await api.getSeasons(itemId);
					setSeasons(seasonsData.Items || []);
					if (seasonsData.Items?.length > 0) {
						setSelectedSeason(seasonsData.Items[0]);
					}

					try {
						const nextUpData = await api.getNextUp(1, itemId);
						if (nextUpData.Items?.length > 0) {
							setNextUp(nextUpData.Items);
						}
					} catch (e) {
						// Next up not available
					}
				}

				if (data.Type === 'Season') {
					try {
						const episodesData = await api.getEpisodes(data.SeriesId, data.Id);
						setEpisodes(episodesData.Items || []);
					} catch (e) {
						// Episodes not available
					}
				}

				if (data.Type === 'BoxSet') {
					try {
						const collectionData = await api.getItems({
							ParentId: data.Id,
							SortBy: 'ProductionYear,SortName',
							SortOrder: 'Ascending',
							Fields: 'PrimaryImageAspectRatio,ProductionYear'
						});
						setCollectionItems(collectionData.Items || []);
					} catch (e) {
						// Collection items not available
					}
				}

				if (data.Type !== 'Person' && data.Type !== 'BoxSet') {
					try {
						const similarData = await api.getSimilar(itemId);
						setSimilar(similarData.Items || []);
					} catch (e) {
						// Similar items not available
					}
				}

				if (data.Type === 'Person') {
					try {
						const filmography = await api.getItemsByPerson(itemId, 50);
						setSimilar(filmography.Items || []);
					} catch (e) {
						// Filmography not available
					}
				}
			} catch (err) {
				// Item load failed
			} finally {
				setIsLoading(false);
			}
		};
		loadItem();
	}, [api, itemId]);

	// Auto-focus the primary button (Resume or Play) when content loads
	useEffect(() => {
		if (!isLoading && item && primaryButtonRef.current) {
			// Small delay to ensure DOM is ready
			const timer = setTimeout(() => {
				Spotlight.focus(primaryButtonRef.current);
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [isLoading, item]);

	useEffect(() => {
		if (!selectedSeason || !item || item.Type !== 'Series') return;
		const loadEpisodes = async () => {
			try {
				const episodesData = await api.getEpisodes(item.Id, selectedSeason.Id);
				setEpisodes(episodesData.Items || []);
			} catch (err) {
				// Episodes not available
			}
		};
		loadEpisodes();
	}, [api, item, selectedSeason]);

	const handlePlay = useCallback(() => {
		if (!item) return;
		if (item.Type === 'Series') {
			if (nextUp.length > 0) {
				onPlay?.(nextUp[0]);
			} else if (episodes.length > 0) {
				const unwatched = episodes.find(ep => !ep.UserData?.Played);
				onPlay?.(unwatched || episodes[0]);
			}
		} else if (item.Type === 'Season') {
			if (episodes.length > 0) {
				const unwatched = episodes.find(ep => !ep.UserData?.Played);
				onPlay?.(unwatched || episodes[0]);
			}
		} else {
			onPlay?.(item);
		}
	}, [item, episodes, nextUp, onPlay]);

	const handleResume = useCallback(() => {
		if (item) {
			onPlay?.(item, true);
		}
	}, [item, onPlay]);

	const handleShuffle = useCallback(() => {
		if (item) {
			onPlay?.(item, false, true);
		}
	}, [item, onPlay]);

	const handleTrailer = useCallback(() => {
		if (item?.LocalTrailerCount > 0) {
			onPlay?.(item, false, false, true);
		} else if (item?.RemoteTrailers?.length > 0) {
			const trailerUrl = item.RemoteTrailers[0].Url;
			if (trailerUrl) {
				window.open(trailerUrl, '_blank');
			}
		}
	}, [item, onPlay]);

	const handleToggleFavorite = useCallback(async () => {
		if (!item) return;
		const newState = !item.UserData?.IsFavorite;
		await api.setFavorite(item.Id, newState);
		setItem(prev => ({
			...prev,
			UserData: {...prev.UserData, IsFavorite: newState}
		}));
	}, [api, item]);

	const handleToggleWatched = useCallback(async () => {
		if (!item) return;
		const newState = !item.UserData?.Played;
		await api.setWatched(item.Id, newState);
		setItem(prev => ({
			...prev,
			UserData: {...prev.UserData, Played: newState, PlayedPercentage: newState ? 100 : 0}
		}));
	}, [api, item]);

	const handleGoToSeries = useCallback(() => {
		if (item?.SeriesId) {
			onSelectItem?.({Id: item.SeriesId, Type: 'Series'});
		}
	}, [item, onSelectItem]);

	const handleSeasonSelect = useCallback((ev) => {
		const seasonId = ev.currentTarget.dataset.seasonId;
		const season = seasons.find(s => s.Id === seasonId);
		if (season) {
			setSelectedSeason(season);
		}
	}, [seasons]);

	const handleCastSelect = useCallback((ev) => {
		const personId = ev.currentTarget.dataset.personId;
		if (personId) {
			onSelectPerson?.({Id: personId});
		}
	}, [onSelectPerson]);

	const handleCastFocus = useCallback((e) => {
		const card = e.target.closest('.spottable');
		const scroller = castScrollerRef.current;
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

	const handleKeyDown = useCallback((ev) => {
		if (ev.keyCode === 461 || ev.keyCode === 27) {
			ev.preventDefault();
			onBack?.();
		}
	}, [onBack]);

	if (isLoading || !item) {
		return (
			<div className={css.page}>
				<LoadingSpinner />
			</div>
		);
	}

	const backdropId = getBackdropId(item);
	const backdropUrl = backdropId
		? getImageUrl(serverUrl, backdropId, 'Backdrop', {maxWidth: 1920, quality: 90})
		: null;

	const logoUrl = getLogoUrl(serverUrl, item, {maxWidth: 600, quality: 90});

	const year = item.ProductionYear || '';
	const runtime = item.RunTimeTicks ? formatDuration(item.RunTimeTicks) : '';
	const rating = item.OfficialRating || '';
	const communityRating = item.CommunityRating ? item.CommunityRating.toFixed(1) : '';
	const criticRating = item.CriticRating;

	const mediaSource = item.MediaSources?.[0];
	const videoStream = mediaSource?.MediaStreams?.find(s => s.Type === 'Video');
	const audioStream = mediaSource?.MediaStreams?.find(s => s.Type === 'Audio');

	let resolution = '';
	if (videoStream?.Width && videoStream?.Height) {
		resolution = getResolutionName(videoStream.Width, videoStream.Height);
	}

	let videoCodec = '';
	if (videoStream?.Codec) {
		videoCodec = videoStream.VideoRangeType && videoStream.VideoRangeType !== 'SDR'
			? videoStream.VideoRangeType.toUpperCase()
			: videoStream.Codec.toUpperCase();
	}

	let audioCodec = '';
	if (audioStream?.Codec) {
		audioCodec = audioStream.Profile?.includes('Atmos')
			? 'ATMOS'
			: audioStream.Codec.toUpperCase();
	}

	const directors = item.People?.filter(p => p.Type === 'Director') || [];
	const writers = item.People?.filter(p => p.Type === 'Writer') || [];
	const studios = item.Studios || [];
	const genres = item.Genres || [];
	const tagline = item.Taglines?.[0];

	const hasPlaybackPosition = item.UserData?.PlaybackPositionTicks > 0;
	const resumeTimeText = hasPlaybackPosition
		? formatDuration(item.UserData.PlaybackPositionTicks)
		: '';

	const isPerson = item.Type === 'Person';
	const isBoxSet = item.Type === 'BoxSet';
	const isSeries = item.Type === 'Series';
	const isSeason = item.Type === 'Season';
	const isEpisode = item.Type === 'Episode';

	return (
		<div className={css.page} onKeyDown={handleKeyDown}>
			{backdropUrl && (
				<div className={css.backdrop}>
					<img
						src={backdropUrl}
						className={css.backdropImage}
						alt=""
						style={{filter: settings.backdropBlurDetail > 0 ? `blur(${settings.backdropBlurDetail}px)` : 'none'}}
					/>
					<div className={css.backdropOverlay} />
				</div>
			)}

			<Scroller
				className={css.scroller}
				direction="vertical"
				horizontalScrollbar="hidden"
				verticalScrollbar="hidden"
			>
				<div className={css.content}>
					<div className={css.detailsHeader}>
						<div className={css.infoSection}>
							<h1 className={css.title}>{item.Name}</h1>

							{isPerson && item.ImageTags?.Primary && (
								<div className={css.personContent}>
									<img
										src={getImageUrl(serverUrl, item.Id, 'Primary', {maxHeight: 450, quality: 90})}
										className={css.personPhoto}
										alt=""
									/>
									{item.Overview && (
										<p className={css.personOverview}>{item.Overview}</p>
									)}
								</div>
							)}

							{!isPerson && (
								<>
									<div className={css.infoRow}>
										{year && <span className={css.infoBadge}>{year}</span>}
										{rating && <span className={`${css.infoBadge} ${css.pill}`}>{rating}</span>}
										{runtime && <span className={css.infoBadge}>{runtime}</span>}
										{resolution && <span className={`${css.infoBadge} ${css.pill}`}>{resolution}</span>}
										{videoCodec && <span className={`${css.infoBadge} ${css.pill}`}>{videoCodec}</span>}
										{audioCodec && <span className={`${css.infoBadge} ${css.pill}`}>{audioCodec}</span>}
										{communityRating && (
											<span className={css.infoBadge}>
												<span className={css.star}>★</span> {communityRating}
											</span>
										)}
										{criticRating && (
											<span className={css.infoBadge}>
												<span className={css.critic}>🍅</span> {criticRating}%
											</span>
										)}
									</div>

									{tagline && (
										<p className={css.tagline}>{tagline}</p>
									)}

									{item.Overview && (
										<p className={css.overview}>{item.Overview}</p>
									)}

									<div className={css.metadataGroup}>
										{genres.length > 0 && (
											<div className={css.metadataCell}>
												<span className={css.metadataLabel}>Genres</span>
												<span className={css.metadataValue}>{genres.slice(0, 3).join(', ')}</span>
											</div>
										)}
										{directors.length > 0 && (
											<div className={css.metadataCell}>
												<span className={css.metadataLabel}>Director</span>
												<span className={css.metadataValue}>{directors.map(d => d.Name).join(', ')}</span>
											</div>
										)}
										{writers.length > 0 && (
											<div className={css.metadataCell}>
												<span className={css.metadataLabel}>Writers</span>
												<span className={css.metadataValue}>{writers.map(w => w.Name).join(', ')}</span>
											</div>
										)}
										{studios.length > 0 && (
											<div className={css.metadataCell}>
												<span className={css.metadataLabel}>Studio</span>
												<span className={css.metadataValue}>{studios.map(s => s.Name).join(', ')}</span>
											</div>
										)}
									</div>
								</>
							)}
						</div>

						{logoUrl && (
							<div className={css.logoSection}>
								<img src={logoUrl} className={css.logoImage} alt="" />
							</div>
						)}
					</div>

					{!isPerson && !isBoxSet && (
						<div className={css.actionButtons}>
							{hasPlaybackPosition && (
								<div className={css.btnWrapper}>
								<SpottableButton ref={primaryButtonRef} className={`${css.btnAction} ${css.btnPrimary}`} onClick={handleResume} spotlightId="details-primary-btn">
									<span className={css.btnIcon}>▶</span>
								</SpottableButton>
								<span className={css.btnLabel}>Resume {resumeTimeText}</span>
							</div>
						)}
						<div className={css.btnWrapper}>
							<SpottableButton ref={hasPlaybackPosition ? null : primaryButtonRef} className={`${css.btnAction} ${hasPlaybackPosition ? css.btnSecondary : css.btnPrimary}`} onClick={handlePlay} spotlightId={hasPlaybackPosition ? undefined : 'details-primary-btn'}>
									{hasPlaybackPosition ? (
									<svg className={css.btnIcon} viewBox="0 -960 960 960">
											<path d="M480-80q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-440h80q0 117 81.5 198.5T480-160q117 0 198.5-81.5T760-440q0-117-81.5-198.5T480-720h-6l62 62-56 58-160-160 160-160 56 58-62 62h6q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-440q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-80Z"/>
										</svg>
									) : (
										<span className={css.btnIcon}>▶</span>
									)}
								</SpottableButton>
								<span className={css.btnLabel}>{hasPlaybackPosition ? 'Restart from beginning' : 'Play'}</span>
							</div>
							{(isSeries || isSeason) && (
								<div className={css.btnWrapper}>
									<SpottableButton className={css.btnAction} onClick={handleShuffle}>
									<svg className={css.btnIcon} viewBox="0 -960 960 960">
										<path d="M560-160v-80h104L537-367l57-57 126 126v-102h80v240H560Zm-344 0-56-56 504-504H560v-80h240v240h-80v-104L216-160Zm151-377L160-744l56-56 207 207-56 56Z"/>
									</svg>
									</SpottableButton>
									<span className={css.btnLabel}>Shuffle</span>
								</div>
							)}
							{(item.LocalTrailerCount > 0 || item.RemoteTrailers?.length > 0) && (
								<div className={css.btnWrapper}>
									<SpottableButton className={css.btnAction} onClick={handleTrailer}>
									<svg className={css.btnIcon} viewBox="0 -960 960 960">
										<path d="M160-120v-720h80v80h80v-80h320v80h80v-80h80v720h-80v-80h-80v80H320v-80h-80v80h-80Zm80-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm400 320h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80ZM400-200h160v-560H400v560Zm0-560h160-160Z"/>
									</svg>
									</SpottableButton>
									<span className={css.btnLabel}>Trailer</span>
								</div>
							)}
							<div className={css.btnWrapper}>
								<SpottableButton className={css.btnAction} onClick={handleToggleFavorite}>
								<svg className={`${css.btnIcon} ${item.UserData?.IsFavorite ? css.favorited : ''}`} viewBox="0 -960 960 960">
									<path d="m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Zm0-108q96-86 158-147.5t98-107q36-45.5 50-81t14-70.5q0-60-40-100t-100-40q-47 0-87 26.5T518-680h-76q-15-41-55-67.5T300-774q-60 0-100 40t-40 100q0 35 14 70.5t50 81q36 45.5 98 107T480-228Zm0-273Z"/>
								</svg>
								</SpottableButton>
								<span className={css.btnLabel}>{item.UserData?.IsFavorite ? 'Favorited' : 'Favorite'}</span>
							</div>
							<div className={css.btnWrapper}>
								<SpottableButton className={css.btnAction} onClick={handleToggleWatched}>
								{item.UserData?.Played ? (
									<svg className={`${css.btnIcon} ${css.watched}`} viewBox="0 -960 960 960">
										<path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
									</svg>
								) : (
									<svg className={css.btnIcon} viewBox="0 -960 960 960">
										<path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
									</svg>
								)}
								</SpottableButton>
								<span className={css.btnLabel}>{item.UserData?.Played ? 'Watched' : 'Mark Watched'}</span>
							</div>
							{isEpisode && item.SeriesId && (
								<div className={css.btnWrapper}>
									<SpottableButton className={css.btnAction} onClick={handleGoToSeries}>
									<svg className={css.btnIcon} viewBox="0 -960 960 960">
										<path d="M240-120v-80l40-40H160q-33 0-56.5-23.5T80-320v-440q0-33 23.5-56.5T160-840h640q33 0 56.5 23.5T880-760v440q0 33-23.5 56.5T800-240H680l40 40v80H240Zm-80-200h640v-440H160v440Zm0 0v-440 440Z"/>
									</svg>
									</SpottableButton>
									<span className={css.btnLabel}>Go to Series</span>
								</div>
							)}
						</div>
					)}

					<div className={css.sectionsContainer}>
						{nextUp.length > 0 && (
							<MediaRow
								title="Next Up"
								items={nextUp}
								serverUrl={serverUrl}
								onSelectItem={onSelectItem}
							/>
						)}

						{isSeries && seasons.length > 0 && (
							<div className={css.seasonsSection}>
								<h2 className={css.sectionTitle}>Seasons</h2>
								<div className={css.seasonTabs}>
									{seasons.map((season) => (
										<Button
											key={season.Id}
											data-season-id={season.Id}
											selected={selectedSeason?.Id === season.Id}
											onClick={handleSeasonSelect}
											size="small"
											className={css.seasonTab}
										>
											{season.Name}
										</Button>
									))}
								</div>
								{episodes.length > 0 && (
									<MediaRow
										title={selectedSeason?.Name || 'Episodes'}
										items={episodes}
										serverUrl={serverUrl}
										onSelectItem={onSelectItem}
									/>
								)}
							</div>
						)}

						{isSeason && episodes.length > 0 && (
							<MediaRow
								title="Episodes"
								items={episodes}
								serverUrl={serverUrl}
								onSelectItem={onSelectItem}
							/>
						)}

						{isBoxSet && collectionItems.length > 0 && (
							<MediaRow
								title="Items in Collection"
								items={collectionItems}
								serverUrl={serverUrl}
								onSelectItem={onSelectItem}
							/>
						)}

						{cast.length > 0 && !isPerson && (
							<div className={css.castSection}>
								<h2 className={css.sectionTitle}>Cast & Crew</h2>
								<div className={css.castScroller} ref={castScrollerRef} onFocus={handleCastFocus}>
									<div className={css.castList}>
										{cast.map((person) => (
											<SpottableDiv
												key={person.Id}
												data-person-id={person.Id}
												className={css.castCard}
												onClick={handleCastSelect}
											>
												<div className={css.castImageWrapper}>
													{person.PrimaryImageTag ? (
														<img
															src={getImageUrl(serverUrl, person.Id, 'Primary', {maxHeight: 280, quality: 90, tag: person.PrimaryImageTag})}
															className={css.castImage}
															alt=""
														/>
													) : (
														<div className={css.castPlaceholder}>
															{person.Name?.charAt(0)}
														</div>
													)}
												</div>
												<span className={css.castName}>{person.Name}</span>
												<span className={css.castRole}>{person.Role || person.Type}</span>
											</SpottableDiv>
										))}
									</div>
								</div>
							</div>
						)}

						{similar.length > 0 && (
							<MediaRow
								title={isPerson ? 'Filmography' : 'More Like This'}
								items={similar}
								serverUrl={serverUrl}
								onSelectItem={onSelectItem}
							/>
						)}
					</div>
				</div>
			</Scroller>
		</div>
	);
};

export default Details;
