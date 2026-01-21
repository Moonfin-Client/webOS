import {memo, useCallback} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import {getImageUrl} from '../../utils/helpers';

import css from './MediaCard.module.less';

const SpottableDiv = Spottable('div');

const MediaCard = ({item, serverUrl, cardType = 'portrait', onSelect, onFocusItem}) => {
	const isLandscape = cardType === 'landscape';

	const getItemImageUrl = () => {
		if (isLandscape && item.Type === 'Episode') {
			if (item.ImageTags?.Primary) {
				return getImageUrl(serverUrl, item.Id, 'Primary', {maxWidth: 500, quality: 100});
			}
			if (item.ParentThumbItemId) {
				return getImageUrl(serverUrl, item.ParentThumbItemId, 'Thumb', {maxWidth: 500, quality: 100});
			}
			if (item.ParentBackdropItemId) {
				return getImageUrl(serverUrl, item.ParentBackdropItemId, 'Backdrop', {maxWidth: 500, quality: 100});
			}
		}

		if (item.ImageTags?.Primary) {
			return getImageUrl(serverUrl, item.Id, 'Primary', {maxHeight: 400, quality: 100});
		}

		return null;
	};

	const imageUrl = getItemImageUrl();

	const handleClick = useCallback(() => {
		onSelect?.(item);
	}, [item, onSelect]);

	const handleFocus = useCallback(() => {
		onFocusItem?.(item);
	}, [item, onFocusItem]);

	const progress = item.UserData?.PlayedPercentage || 0;

	const getDisplayTitle = () => {
		if (item.Type === 'Episode') {
			return item.SeriesName || item.Name;
		}
		return item.Name;
	};

	const getEpisodeInfo = () => {
		if (item.Type === 'Episode' && item.ParentIndexNumber !== undefined) {
			return `S${item.ParentIndexNumber} E${item.IndexNumber} - ${item.Name}`;
		}
		return null;
	};

	const cardClass = `${css.card} ${isLandscape ? css.landscape : css.portrait}`;
	const episodeInfo = getEpisodeInfo();

	return (
		<SpottableDiv className={cardClass} onClick={handleClick} onFocus={handleFocus}>
			<div className={css.imageContainer}>
				{imageUrl ? (
					<img className={css.image} src={imageUrl} alt={item.Name} />
				) : (
					<div className={css.placeholder}>{item.Name?.[0]}</div>
				)}

				{progress > 0 && (
					<div className={css.progressBar}>
						<div className={css.progress} style={{width: `${progress}%`}} />
					</div>
				)}
			</div>

			<div className={css.info}>
				{episodeInfo ? (
					<>
						<div className={css.seriesName}>{getDisplayTitle()}</div>
						<div className={css.episodeInfo}>{episodeInfo}</div>
					</>
				) : (
					<div className={css.title}>{getDisplayTitle()}</div>
				)}
			</div>
		</SpottableDiv>
	);
};

export default memo(MediaCard);
