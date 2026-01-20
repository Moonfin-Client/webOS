import {useState, useEffect, useCallback} from 'react';
import {Panel, Header} from '@enact/sandstone/Panels';
import Spinner from '@enact/sandstone/Spinner';
import Button from '@enact/sandstone/Button';
import {useAuth} from '../../context/AuthContext';
import MediaRow from '../../components/MediaRow';

import css from './Browse.module.less';

const Browse = ({onSelectItem, onSelectLibrary, onOpenSearch, onOpenSettings}) => {
	const {api, serverUrl, user} = useAuth();
	const [rows, setRows] = useState([]);
	const [libraries, setLibraries] = useState([]);
	const [isLoading, setIsLoading] = useState(true);

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
						items: resumeItems.Items
					});
				}

				if (nextUp.Items?.length > 0) {
					rowData.push({
						id: 'nextup',
						title: 'Next Up',
						items: nextUp.Items
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
								library: lib
							});
						}
					}
				}

				setRows(rowData);
			} catch (err) {
				console.error('Failed to load browse data:', err);
			} finally {
				setIsLoading(false);
			}
		};

		loadData();
	}, [api]);

	const handleSelectItem = useCallback((item) => {
		onSelectItem?.(item);
	}, [onSelectItem]);

	const handleSelectLibrary = useCallback((library) => {
		onSelectLibrary?.(library);
	}, [onSelectLibrary]);

	if (isLoading) {
		return (
			<Panel>
				<Header title="Moonfin" subtitle={user?.Name || ''} />
				<div className={css.loading}><Spinner /></div>
			</Panel>
		);
	}

	return (
		<Panel>
			<Header title="Moonfin" subtitle={user?.Name || ''}>
				<Button icon="search" onClick={onOpenSearch} />
				<Button icon="gear" onClick={onOpenSettings} />
			</Header>
			<div className={css.content}>
				{libraries.length > 0 && (
					<div className={css.libraryRow}>
						{libraries.map((lib) => (
							<Button
								key={lib.Id}
								onClick={() => handleSelectLibrary(lib)}
								className={css.libraryButton}
							>
								{lib.Name}
							</Button>
						))}
					</div>
				)}
				{rows.map((row) => (
					<MediaRow
						key={row.id}
						title={row.title}
						items={row.items}
						serverUrl={serverUrl}
						onSelectItem={handleSelectItem}
					/>
				))}
				{rows.length === 0 && (
					<div className={css.empty}>No content found</div>
				)}
			</div>
		</Panel>
	);
};

export default Browse;
