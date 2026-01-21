export const formatDuration = (ticks) => {
	if (!ticks) return '';
	const totalMinutes = Math.floor(ticks / 600000000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
};

export const formatDate = (dateString) => {
	if (!dateString) return '';
	const date = new Date(dateString);
	return date.toLocaleDateString();
};

export const getImageUrl = (serverUrl, itemId, imageType = 'Primary', options = {}) => {
	if (!serverUrl || !itemId) return null;
	const params = new URLSearchParams();
	if (options.maxWidth) params.set('maxWidth', options.maxWidth);
	if (options.maxHeight) params.set('maxHeight', options.maxHeight);
	if (options.quality) params.set('quality', options.quality);
	if (options.tag) params.set('tag', options.tag);
	const queryString = params.toString();
	return `${serverUrl}/Items/${itemId}/Images/${imageType}${queryString ? '?' + queryString : ''}`;
};

export const getBackdropId = (item) => {
	if (!item) return null;
	return item.BackdropImageTags?.length > 0 ? item.Id : (item.ParentBackdropItemId || item.Id);
};
