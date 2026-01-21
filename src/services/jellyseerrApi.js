import LS2Request from '@enact/webos/LS2Request';

const SERVICE_URI = 'luna://org.moonfin.webos.service';

let jellyseerrUrl = null;
let userId = null;
let apiKey = null;

export const setConfig = (url, user, key = null) => {
	jellyseerrUrl = url?.replace(/\/+$/, '');
	userId = user;
	apiKey = key;
};

export const getConfig = () => ({jellyseerrUrl, userId, apiKey});

const lunaRequest = (method, params) => {
	return new Promise((resolve, reject) => {
		new LS2Request().send({
			service: SERVICE_URI,
			method,
			parameters: params,
			onSuccess: resolve,
			onFailure: reject
		});
	});
};

const request = async (endpoint, options = {}) => {
	if (!jellyseerrUrl || !userId) {
		throw new Error('Jellyseerr not configured');
	}

	const url = `${jellyseerrUrl}/api/v1${endpoint}`;
	const headers = {
		'Content-Type': 'application/json',
		'Accept': 'application/json',
		...options.headers
	};

	if (apiKey) {
		headers['X-Api-Key'] = apiKey;
	}

	const bodyStr = options.body ? JSON.stringify(options.body) : undefined;

	const result = await lunaRequest('jellyseerrRequest', {
		userId,
		url,
		method: options.method || 'GET',
		headers,
		body: bodyStr,
		timeout: 30000
	});

	if (!result.success) {
		throw new Error(result.error || 'Request failed');
	}

	if (result.status >= 400) {
		let errorMessage = `Jellyseerr API error: ${result.status}`;
		if (result.body) {
			try {
				const errorBody = JSON.parse(result.body);
				errorMessage = errorBody.message || errorBody.error || errorMessage;
			} catch (e) {}
		}
		const error = new Error(errorMessage);
		error.status = result.status;
		throw error;
	}

	if (result.body) {
		try {
			return JSON.parse(result.body);
		} catch (e) {
			return result.body;
		}
	}

	return null;
};

export const clearCookies = async () => {
	if (!userId) return;
	await lunaRequest('jellyseerrClearCookies', {userId});
};

export const testConnection = async () => {
	const status = await request('/status');
	return status;
};

export const login = async (email, password) => {
	const result = await request('/auth/local', {
		method: 'POST',
		body: {email, password}
	});
	return result;
};

export const loginWithJellyfin = async (username, password, jellyfinHost) => {
	try {
		const result = await request('/auth/jellyfin', {
			method: 'POST',
			body: {username, password}
		});
		return result;
	} catch (err) {
		if (err.status === 401) {
			const result = await request('/auth/jellyfin', {
				method: 'POST',
				body: {username, password, hostname: jellyfinHost}
			});
			return result;
		}
		throw err;
	}
};

export const getUser = async () => {
	return request('/auth/me');
};

export const logout = async () => {
	await request('/auth/logout', {method: 'POST'});
	await clearCookies();
};

export const discover = async (page = 1) => {
	return request(`/discover/movies?page=${page}`);
};

export const discoverTv = async (page = 1) => {
	return request(`/discover/tv?page=${page}`);
};

export const trending = async () => {
	return request('/discover/trending');
};

export const search = async (query, page = 1) => {
	return request(`/search?query=${encodeURIComponent(query)}&page=${page}`);
};

export const getMovie = async (tmdbId) => {
	return request(`/movie/${tmdbId}`);
};

export const getTv = async (tmdbId) => {
	return request(`/tv/${tmdbId}`);
};

export const getPerson = async (tmdbId) => {
	return request(`/person/${tmdbId}`);
};

export const getRequests = async (filter = 'all', take = 20, skip = 0) => {
	return request(`/request?filter=${filter}&take=${take}&skip=${skip}`);
};

export const requestMovie = async (tmdbId, options = {}) => {
	return request('/request', {
		method: 'POST',
		body: {
			mediaType: 'movie',
			mediaId: tmdbId,
			is4k: options.is4k || false
		}
	});
};

export const requestTv = async (tmdbId, options = {}) => {
	return request('/request', {
		method: 'POST',
		body: {
			mediaType: 'tv',
			mediaId: tmdbId,
			is4k: options.is4k || false,
			seasons: options.seasons || 'all'
		}
	});
};

export const cancelRequest = async (requestId) => {
	return request(`/request/${requestId}`, {method: 'DELETE'});
};

export const getMediaStatus = async (mediaType, tmdbId) => {
	if (mediaType === 'movie') {
		return getMovie(tmdbId);
	}
	return getTv(tmdbId);
};

export const getImageUrl = (path, size = 'w500') => {
	if (!path) return null;
	return `http://image.tmdb.org/t/p/${size}${path}`;
};

export const proxyImage = async (imageUrl) => {
	const result = await lunaRequest('imageProxy', {url: imageUrl});
	if (result.success && result.data) {
		return `data:${result.contentType || 'image/jpeg'};base64,${result.data}`;
	}
	return null;
};

export default {
	setConfig,
	getConfig,
	testConnection,
	login,
	loginWithJellyfin,
	logout,
	getUser,
	discover,
	discoverTv,
	trending,
	search,
	getMovie,
	getTv,
	getPerson,
	getMediaStatus,
	getRequests,
	requestMovie,
	requestTv,
	cancelRequest,
	getImageUrl,
	proxyImage,
	clearCookies
};
