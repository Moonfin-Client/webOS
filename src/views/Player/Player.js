import {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import VideoPlayer from '@enact/sandstone/VideoPlayer';
import {MediaControls} from '@enact/sandstone/MediaPlayer';
import Button from '@enact/sandstone/Button';
import Popup from '@enact/sandstone/Popup';
import Item from '@enact/sandstone/Item';
import Scroller from '@enact/sandstone/Scroller';
import * as playback from '../../services/playback';
import {useSettings} from '../../context/SettingsContext';
import LoadingSpinner from '../../components/LoadingSpinner';

import css from './Player.module.less';

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

const Player = ({item, onEnded, onBack, onPlayNext}) => {
	const {settings} = useSettings();
	const [mediaUrl, setMediaUrl] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);
	const [title, setTitle] = useState('');

	const [audioStreams, setAudioStreams] = useState([]);
	const [subtitleStreams, setSubtitleStreams] = useState([]);
	const [selectedAudioIndex, setSelectedAudioIndex] = useState(null);
	const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(-1);
	const [subtitleUrl, setSubtitleUrl] = useState(null);

	const [showAudioPopup, setShowAudioPopup] = useState(false);
	const [showSubtitlePopup, setShowSubtitlePopup] = useState(false);
	const [showSpeedPopup, setShowSpeedPopup] = useState(false);

	const [playbackRate, setPlaybackRate] = useState(1);
	const [introMarkers, setIntroMarkers] = useState(null);
	const [showSkipIntro, setShowSkipIntro] = useState(false);
	const [showSkipCredits, setShowSkipCredits] = useState(false);
	const [nextEpisode, setNextEpisode] = useState(null);

	const positionRef = useRef(0);
	const playSessionRef = useRef(null);
	const videoRef = useRef(null);
	const runTimeRef = useRef(0);

	useEffect(() => {
		const loadMedia = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const startPosition = item.UserData?.PlaybackPositionTicks || 0;
				const result = await playback.getPlaybackUrl(item.Id, startPosition, {
					maxBitrate: settings.maxBitrate
				});

				setMediaUrl(result.url);
				playSessionRef.current = result.playSessionId;
				positionRef.current = startPosition;
				runTimeRef.current = result.runTimeTicks || 0;

				setAudioStreams(result.audioStreams || []);
				setSubtitleStreams(result.subtitleStreams || []);

				const defaultAudio = result.audioStreams?.find(s => s.isDefault);
				if (defaultAudio) setSelectedAudioIndex(defaultAudio.index);

				if (settings.subtitleMode === 'always') {
					const defaultSub = result.subtitleStreams?.find(s => s.isDefault);
					if (defaultSub) {
						setSelectedSubtitleIndex(defaultSub.index);
						setSubtitleUrl(playback.getSubtitleUrl(defaultSub));
					}
				}

				let displayTitle = item.Name;
				if (item.SeriesName) {
					displayTitle = `${item.SeriesName} - S${item.ParentIndexNumber}E${item.IndexNumber} - ${item.Name}`;
				}
				setTitle(displayTitle);

				if (settings.skipIntro) {
					const markers = await playback.getIntroMarkers(item.Id);
					setIntroMarkers(markers);
				}

				if (item.Type === 'Episode') {
					const next = await playback.getNextEpisode(item);
					setNextEpisode(next);
				}
			} catch (err) {
				console.error('Failed to get playback URL:', err);
				setError(err.message || 'Failed to load media');
			} finally {
				setIsLoading(false);
			}
		};

		loadMedia();

		return () => {
			playback.stopProgressReporting();
		};
	}, [item, settings.maxBitrate, settings.subtitleMode, settings.skipIntro]);

	const handlePlay = useCallback(() => {
		playback.reportStart(positionRef.current);
		playback.startProgressReporting(() => positionRef.current);
	}, []);

	const handleTimeUpdate = useCallback((e) => {
		if (e.currentTime) {
			const ticks = Math.floor(e.currentTime * 10000000);
			positionRef.current = ticks;

			if (introMarkers && settings.skipIntro) {
				if (introMarkers.introStart && introMarkers.introEnd) {
					const inIntro = ticks >= introMarkers.introStart && ticks < introMarkers.introEnd;
					setShowSkipIntro(inIntro);
				}
				if (introMarkers.creditsStart && runTimeRef.current) {
					const inCredits = ticks >= introMarkers.creditsStart;
					setShowSkipCredits(inCredits && nextEpisode);
				}
			}
		}
	}, [introMarkers, settings.skipIntro, nextEpisode]);

	const handleEnded = useCallback(async () => {
		await playback.reportStop(positionRef.current);
		if (nextEpisode && onPlayNext) {
			onPlayNext(nextEpisode);
		} else {
			onEnded?.();
		}
	}, [onEnded, onPlayNext, nextEpisode]);

	const handleBack = useCallback(async () => {
		await playback.reportStop(positionRef.current);
		onBack?.();
	}, [onBack]);

	const handleError = useCallback((e) => {
		console.error('Playback error:', e);
		setError('Playback failed');
	}, []);

	const handleSelectAudio = useCallback((stream) => {
		setSelectedAudioIndex(stream.index);
		setShowAudioPopup(false);
	}, []);

	const handleSelectSubtitle = useCallback((stream) => {
		if (stream === null) {
			setSelectedSubtitleIndex(-1);
			setSubtitleUrl(null);
		} else {
			setSelectedSubtitleIndex(stream.index);
			setSubtitleUrl(playback.getSubtitleUrl(stream));
		}
		setShowSubtitlePopup(false);
	}, []);

	const handleSelectSpeed = useCallback((rate) => {
		setPlaybackRate(rate);
		setShowSpeedPopup(false);
	}, []);

	const handleSkipIntro = useCallback(() => {
		if (introMarkers?.introEnd && videoRef.current) {
			const seekTime = introMarkers.introEnd / 10000000;
			videoRef.current.seek(seekTime);
		}
		setShowSkipIntro(false);
	}, [introMarkers]);

	const handlePlayNextEpisode = useCallback(async () => {
		if (nextEpisode && onPlayNext) {
			await playback.reportStop(positionRef.current);
			onPlayNext(nextEpisode);
		}
	}, [nextEpisode, onPlayNext]);

	const subtitleTracks = useMemo(() => {
		if (!subtitleUrl) return [];
		return [{src: subtitleUrl, type: 'vtt', language: 'selected'}];
	}, [subtitleUrl]);

	if (isLoading) {
		return (
			<div className={css.container}>
				<LoadingSpinner message="Loading media..." />
			</div>
		);
	}

	if (error) {
		return (
			<div className={css.container}>
				<div className={css.error}>
					<h2>Playback Error</h2>
					<p>{error}</p>
					<Button onClick={onBack}>Go Back</Button>
				</div>
			</div>
		);
	}

	return (
		<div className={css.container}>
			<VideoPlayer
				ref={videoRef}
				title={title}
				src={mediaUrl}
				autoPlay
				playbackRate={playbackRate}
				onPlay={handlePlay}
				onUpdate={handleTimeUpdate}
				onEnded={handleEnded}
				onBack={handleBack}
				onError={handleError}
				subtitleTracks={subtitleTracks}
			>
				<MediaControls>
					<Button
						icon="audio"
						onClick={() => setShowAudioPopup(true)}
						disabled={audioStreams.length === 0}
					/>
					<Button
						icon="closedcaption"
						onClick={() => setShowSubtitlePopup(true)}
						disabled={subtitleStreams.length === 0}
					/>
					<Button
						icon="speed"
						onClick={() => setShowSpeedPopup(true)}
					/>
					{nextEpisode && (
						<Button
							icon="skipforward"
							onClick={handlePlayNextEpisode}
						/>
					)}
				</MediaControls>
			</VideoPlayer>

			{showSkipIntro && (
				<div className={css.skipButton}>
					<Button onClick={handleSkipIntro}>Skip Intro</Button>
				</div>
			)}

			{showSkipCredits && nextEpisode && (
				<div className={css.skipButton}>
					<Button onClick={handlePlayNextEpisode}>Next Episode</Button>
				</div>
			)}

			<Popup open={showAudioPopup} onClose={() => setShowAudioPopup(false)} position="center">
				<div className={css.trackPopup}>
					<h3>Audio Track</h3>
					<Scroller>
						{audioStreams.map((stream) => (
							<Item
								key={stream.index}
								onClick={() => handleSelectAudio(stream)}
								selected={stream.index === selectedAudioIndex}
							>
								{stream.displayTitle}
							</Item>
						))}
					</Scroller>
				</div>
			</Popup>

			<Popup open={showSubtitlePopup} onClose={() => setShowSubtitlePopup(false)} position="center">
				<div className={css.trackPopup}>
					<h3>Subtitles</h3>
					<Scroller>
						<Item
							onClick={() => handleSelectSubtitle(null)}
							selected={selectedSubtitleIndex === -1}
						>
							Off
						</Item>
						{subtitleStreams.map((stream) => (
							<Item
								key={stream.index}
								onClick={() => handleSelectSubtitle(stream)}
								selected={stream.index === selectedSubtitleIndex}
							>
								{stream.displayTitle}
							</Item>
						))}
					</Scroller>
				</div>
			</Popup>

			<Popup open={showSpeedPopup} onClose={() => setShowSpeedPopup(false)} position="center">
				<div className={css.trackPopup}>
					<h3>Playback Speed</h3>
					<Scroller>
						{PLAYBACK_RATES.map((rate) => (
							<Item
								key={rate}
								onClick={() => handleSelectSpeed(rate)}
								selected={rate === playbackRate}
							>
								{rate === 1 ? 'Normal' : `${rate}x`}
							</Item>
						))}
					</Scroller>
				</div>
			</Popup>
		</div>
	);
};

export default Player;
