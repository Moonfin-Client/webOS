import {useState, useEffect, useCallback} from 'react';
import {Panel, Header} from '@enact/sandstone/Panels';
import Spinner from '@enact/sandstone/Spinner';
import {useAuth} from '../../context/AuthContext';
import MediaRow from '../../components/MediaRow';

import css from './Browse.module.less';

const Browse = ({onSelectItem}) => {
	const {api, serverUrl, user} = useAuth();
	const [rows, setRows] = useState([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadData = async () => {
			try {
				const [libraries, resumeItems, nextUp] = await Promise.all([
					api.getLibraries(),
					api.getResumeItems(),
					api.getNextUp()
				]);

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

				for (const lib of libraries.Items || []) {
					if (['movies', 'tvshows'].includes(lib.CollectionType)) {
						const latest = await api.getLatest(lib.Id, 16);
						if (latest?.length > 0) {
							rowData.push({
								id: lib.Id,
								title: `Latest ${lib.Name}`,
								items: latest
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
			<Header title="Moonfin" subtitle={user?.Name || ''} />
			<div className={css.content}>
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
