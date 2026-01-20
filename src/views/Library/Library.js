import {useState, useEffect, useCallback} from 'react';
import {Panel, Header} from '@enact/sandstone/Panels';
import {VirtualGridList} from '@enact/sandstone/VirtualList';
import Button from '@enact/sandstone/Button';
import Dropdown from '@enact/sandstone/Dropdown';
import {useAuth} from '../../context/AuthContext';
import MediaCard from '../../components/MediaCard';
import LoadingSpinner from '../../components/LoadingSpinner';

import css from './Library.module.less';

const SORT_OPTIONS = [
	{key: 'SortName', children: 'Name'},
	{key: 'DateCreated', children: 'Date Added'},
	{key: 'PremiereDate', children: 'Release Date'},
	{key: 'CommunityRating', children: 'Rating'},
	{key: 'Random', children: 'Random'}
];

const Library = ({library, onSelectItem}) => {
	const {api, serverUrl} = useAuth();
	const [items, setItems] = useState([]);
	const [genres, setGenres] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [sortBy, setSortBy] = useState('SortName');
	const [sortOrder, setSortOrder] = useState('Ascending');
	const [selectedGenre, setSelectedGenre] = useState(null);
	const [totalCount, setTotalCount] = useState(0);

	const loadItems = useCallback(async (startIndex = 0, append = false) => {
		if (!library) return;

		try {
			const params = {
				ParentId: library.Id,
				StartIndex: startIndex,
				Limit: 100,
				SortBy: sortBy,
				SortOrder: sortOrder,
				Recursive: true,
				IncludeItemTypes: library.CollectionType === 'movies' ? 'Movie' : 'Series',
				Fields: 'PrimaryImageAspectRatio,ProductionYear'
			};

			if (selectedGenre) {
				params.GenreIds = selectedGenre.Id;
			}

			const result = await api.getItems(params);
			setItems(append ? prev => [...prev, ...result.Items] : result.Items || []);
			setTotalCount(result.TotalRecordCount || 0);
		} catch (err) {
			console.error('Failed to load library items:', err);
		} finally {
			setIsLoading(false);
		}
	}, [api, library, sortBy, sortOrder, selectedGenre]);

	useEffect(() => {
		if (!library) return;
		setIsLoading(true);
		loadItems(0, false);
	}, [loadItems, library]);

	useEffect(() => {
		if (!library) return;
		const loadGenres = async () => {
			try {
				const result = await api.getGenres(library.Id);
				setGenres(result.Items || []);
			} catch (err) {
				console.error('Failed to load genres:', err);
			}
		};
		loadGenres();
	}, [api, library]);

	const handleSortChange = useCallback((e) => {
		setSortBy(e.data);
		setIsLoading(true);
	}, []);

	const handleSortOrderToggle = useCallback(() => {
		setSortOrder(prev => prev === 'Ascending' ? 'Descending' : 'Ascending');
		setIsLoading(true);
	}, []);

	const handleGenreSelect = useCallback((genre) => {
		setSelectedGenre(genre);
		setIsLoading(true);
	}, []);

	const handleClearGenre = useCallback(() => {
		setSelectedGenre(null);
		setIsLoading(true);
	}, []);

	const handleScrollBottom = useCallback(() => {
		if (items.length < totalCount) {
			loadItems(items.length, true);
		}
	}, [items.length, totalCount, loadItems]);

	const renderItem = useCallback(({index, ...rest}) => {
		const item = items[index];
		if (!item) return null;
		return (
			<MediaCard
				{...rest}
				item={item}
				serverUrl={serverUrl}
				onSelect={onSelectItem}
			/>
		);
	}, [items, serverUrl, onSelectItem]);

	if (!library) {
		return (
			<Panel>
				<Header title="Library" />
				<div className={css.empty}>No library selected</div>
			</Panel>
		);
	}

	return (
		<Panel className={css.panel}>
			<Header title={library.Name} subtitle={`${totalCount} items`} />

			<div className={css.toolbar}>
				<div className={css.filters}>
					<Dropdown
						title="Sort by"
						selected={SORT_OPTIONS.findIndex(o => o.key === sortBy)}
						onSelect={handleSortChange}
					>
						{SORT_OPTIONS}
					</Dropdown>
					<Button
						icon={sortOrder === 'Ascending' ? 'arrowsmallup' : 'arrowsmalldown'}
						onClick={handleSortOrderToggle}
						size="small"
					>
						{sortOrder === 'Ascending' ? 'A-Z' : 'Z-A'}
					</Button>
				</div>

				{genres.length > 0 && (
					<div className={css.genres}>
						{selectedGenre && (
							<Button onClick={handleClearGenre} size="small">
								Clear: {selectedGenre.Name}
							</Button>
						)}
						{genres.slice(0, 10).map((genre) => (
							<Button
								key={genre.Id}
								onClick={() => handleGenreSelect(genre)}
								selected={selectedGenre?.Id === genre.Id}
								size="small"
							>
								{genre.Name}
							</Button>
						))}
					</div>
				)}
			</div>

			{isLoading ? (
				<LoadingSpinner />
			) : items.length === 0 ? (
				<div className={css.empty}>No items found</div>
			) : (
				<VirtualGridList
					className={css.grid}
					dataSize={items.length}
					itemRenderer={renderItem}
					itemSize={{minWidth: 200, minHeight: 340}}
					spacing={24}
					onScrollStop={handleScrollBottom}
				/>
			)}
		</Panel>
	);
};

export default Library;
