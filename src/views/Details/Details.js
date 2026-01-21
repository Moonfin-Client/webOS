import {useState, useEffect, useCallback} from 'react';
import {Panel, Header} from '@enact/sandstone/Panels';
import Button from '@enact/sandstone/Button';
import Image from '@enact/sandstone/Image';
import BodyText from '@enact/sandstone/BodyText';
import {useAuth} from '../../context/AuthContext';
import MediaRow from '../../components/MediaRow';
import LoadingSpinner from '../../components/LoadingSpinner';
import {formatDuration, getImageUrl} from '../../utils/helpers';

import css from './Details.module.less';

const Details = ({itemId, onPlay, onSelectItem, onSelectPerson}) => {
	const {api, serverUrl} = useAuth();
	const [item, setItem] = useState(null);
	const [seasons, setSeasons] = useState([]);
	const [episodes, setEpisodes] = useState([]);
	const [similar, setSimilar] = useState([]);
	const [selectedSeason, setSelectedSeason] = useState(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadItem = async () => {
			setIsLoading(true);
			try {
				const data = await api.getItem(itemId);
				setItem(data);

				if (data.Type === 'Series') {
					const seasonsData = await api.getSeasons(itemId);
					setSeasons(seasonsData.Items || []);
					if (seasonsData.Items?.length > 0) {
						setSelectedSeason(seasonsData.Items[0]);
					}
				}

				const similarData = await api.getSimilar(itemId);
				setSimilar(similarData.Items || []);
			} catch (err) {
				console.error('Failed to load item:', err);
			} finally {
				setIsLoading(false);
			}
		};
		loadItem();
	}, [api, itemId]);

	useEffect(() => {
		if (!selectedSeason || !item) return;
		const loadEpisodes = async () => {
			try {
				const episodesData = await api.getEpisodes(item.Id, selectedSeason.Id);
				setEpisodes(episodesData.Items || []);
			} catch (err) {
				console.error('Failed to load episodes:', err);
			}
		};
		loadEpisodes();
	}, [api, item, selectedSeason]);

	const handlePlay = useCallback(() => {
		if (item) {
			if (item.Type === 'Series' && episodes.length > 0) {
				const unwatched = episodes.find(ep => !ep.UserData?.Played);
				onPlay?.(unwatched || episodes[0]);
			} else {
				onPlay?.(item);
			}
		}
	}, [item, episodes, onPlay]);

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

	if (isLoading || !item) {
		return (
			<Panel>
				<Header title="Loading..." />
				<LoadingSpinner />
			</Panel>
		);
	}

	const backdropUrl = item.BackdropImageTags?.[0]
		? getImageUrl(serverUrl, item.Id, 'Backdrop', {maxWidth: 1920, quality: 100})
		: null;

	const posterUrl = item.ImageTags?.Primary
		? getImageUrl(serverUrl, item.Id, 'Primary', {maxHeight: 600, quality: 100})
		: null;

	const year = item.ProductionYear || '';
	const runtime = item.RunTimeTicks ? formatDuration(item.RunTimeTicks) : '';
	const rating = item.OfficialRating || '';
	const communityRating = item.CommunityRating ? item.CommunityRating.toFixed(1) : '';

	return (
		<Panel className={css.panel}>
			<Header title={item.Name} />

			{backdropUrl && (
				<div className={css.backdrop}>
					<Image src={backdropUrl} className={css.backdropImage} sizing="fill" />
					<div className={css.backdropGradient} />
				</div>
			)}

			<div className={css.content}>
				<div className={css.main}>
					{posterUrl && (
						<div className={css.poster}>
							<Image src={posterUrl} className={css.posterImage} sizing="fit" />
						</div>
					)}

					<div className={css.info}>
						<h1 className={css.title}>{item.Name}</h1>

						<div className={css.meta}>
							{year && <span>{year}</span>}
							{runtime && <span>{runtime}</span>}
							{rating && <span>{rating}</span>}
							{communityRating && <span>★ {communityRating}</span>}
						</div>

						{item.Genres?.length > 0 && (
							<div className={css.genres}>{item.Genres.join(' • ')}</div>
						)}

						{item.Overview && (
							<BodyText className={css.overview}>{item.Overview}</BodyText>
						)}

						<div className={css.actions}>
							<Button icon="play" onClick={handlePlay}>
								{item.UserData?.PlaybackPositionTicks ? 'Resume' : 'Play'}
							</Button>
							<Button
								icon={item.UserData?.IsFavorite ? 'heart' : 'hearthollow'}
								onClick={handleToggleFavorite}
							>
								{item.UserData?.IsFavorite ? 'Favorited' : 'Favorite'}
							</Button>
							<Button
								icon={item.UserData?.Played ? 'check' : 'circle'}
								onClick={handleToggleWatched}
							>
								{item.UserData?.Played ? 'Watched' : 'Mark Watched'}
							</Button>
						</div>

						{item.People?.length > 0 && (
							<div className={css.people}>
								<h3>Cast & Crew</h3>
								<div className={css.peopleList}>
									{item.People.slice(0, 10).map((person) => (
										<div
											key={person.Id}
											className={css.person}
											onClick={() => onSelectPerson?.(person)}
										>
											<span className={css.personName}>{person.Name}</span>
											{person.Role && <span className={css.personRole}>{person.Role}</span>}
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>

				{item.Type === 'Series' && seasons.length > 0 && (
					<div className={css.seasons}>
						<div className={css.seasonTabs}>
							{seasons.map((season) => (
								<Button
									key={season.Id}
									selected={selectedSeason?.Id === season.Id}
									onClick={() => setSelectedSeason(season)}
									size="small"
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
								onSelectItem={onPlay}
							/>
						)}
					</div>
				)}

				{similar.length > 0 && (
					<MediaRow
						title="More Like This"
						items={similar}
						serverUrl={serverUrl}
						onSelectItem={onSelectItem}
					/>
				)}
			</div>
		</Panel>
	);
};

export default Details;
