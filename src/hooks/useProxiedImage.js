import {useState, useEffect} from 'react';
import LS2Request from '@enact/webos/LS2Request';

const SERVICE_URI = 'luna://org.moonfin.webos.service';
const imageCache = new Map();

const proxyImage = (url) => {
	return new Promise((resolve) => {
		if (!url || !url.includes('image.tmdb.org')) {
			resolve(url);
			return;
		}

		if (imageCache.has(url)) {
			resolve(imageCache.get(url));
			return;
		}

		new LS2Request().send({
			service: SERVICE_URI,
			method: 'imageProxy',
			parameters: {url},
			onSuccess: (response) => {
				if (response.success && response.data) {
					const dataUrl = `data:${response.contentType || 'image/jpeg'};base64,${response.data}`;
					imageCache.set(url, dataUrl);
					resolve(dataUrl);
				} else {
					resolve(url);
				}
			},
			onFailure: () => resolve(url)
		});
	});
};

export const useProxiedImage = (originalUrl) => {
	const [imageUrl, setImageUrl] = useState(originalUrl);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;
		setLoading(true);

		if (!originalUrl) {
			setImageUrl(null);
			setLoading(false);
			return;
		}

		if (imageCache.has(originalUrl)) {
			setImageUrl(imageCache.get(originalUrl));
			setLoading(false);
			return;
		}

		proxyImage(originalUrl).then((proxiedUrl) => {
			if (mounted) {
				setImageUrl(proxiedUrl);
				setLoading(false);
			}
		});

		return () => {
			mounted = false;
		};
	}, [originalUrl]);

	return {imageUrl, loading};
};

export default useProxiedImage;
