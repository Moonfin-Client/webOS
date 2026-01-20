import {useState, useCallback, useRef, useEffect} from 'react';
import {Panel, Header} from '@enact/sandstone/Panels';
import {VirtualGridList} from '@enact/sandstone/VirtualList';
import Input from '@enact/sandstone/Input';
import {useAuth} from '../../context/AuthContext';
import MediaCard from '../../components/MediaCard';
import LoadingSpinner from '../../components/LoadingSpinner';

import css from './Search.module.less';

const Search = ({onSelectItem}) => {
	const {api, serverUrl} = useAuth();
	const [query, setQuery] = useState('');
	const [results, setResults] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const debounceRef = useRef(null);

	const doSearch = useCallback(async (searchQuery) => {
		if (!searchQuery || searchQuery.length < 2) {
			setResults([]);
			setHasSearched(false);
			return;
		}

		setIsLoading(true);
		setHasSearched(true);

		try {
			const result = await api.search(searchQuery, 50);
			setResults(result.Items || []);
		} catch (err) {
			console.error('Search failed:', err);
			setResults([]);
		} finally {
			setIsLoading(false);
		}
	}, [api]);

	const handleQueryChange = useCallback((e) => {
		const value = e.value;
		setQuery(value);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(() => {
			doSearch(value);
		}, 500);
	}, [doSearch]);

	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	const renderItem = useCallback(({index, ...rest}) => {
		const item = results[index];
		if (!item) return null;
		return (
			<MediaCard
				{...rest}
				item={item}
				serverUrl={serverUrl}
				onSelect={onSelectItem}
			/>
		);
	}, [results, serverUrl, onSelectItem]);

	return (
		<Panel className={css.panel}>
			<Header title="Search" />

			<div className={css.searchBar}>
				<Input
					className={css.input}
					placeholder="Search movies, shows, people..."
					value={query}
					onChange={handleQueryChange}
					dismissOnEnter
				/>
			</div>

			<div className={css.results}>
				{isLoading ? (
					<LoadingSpinner message="Searching..." />
				) : results.length > 0 ? (
					<VirtualGridList
						className={css.grid}
						dataSize={results.length}
						itemRenderer={renderItem}
						itemSize={{minWidth: 200, minHeight: 340}}
						spacing={24}
					/>
				) : hasSearched ? (
					<div className={css.empty}>
						No results found for &quot;{query}&quot;
					</div>
				) : (
					<div className={css.empty}>
						Enter a search term to find movies, shows, and more
					</div>
				)}
			</div>
		</Panel>
	);
};

export default Search;
