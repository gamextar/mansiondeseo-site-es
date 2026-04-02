const PROXY_HOSTS = new Set([
	'videos.unicoapps.com',
	'pub-c0bc1ab6fb294cc1bb2e231bb55b4afb.r2.dev',
]);

export function resolveMediaUrl(url) {
	if (!url || typeof url !== 'string') return '';
	if (url.startsWith('/api/image-proxy?url=')) return url;

	try {
		const parsed = new URL(url);
		if (!PROXY_HOSTS.has(parsed.hostname)) return url;
		return `/api/image-proxy?url=${encodeURIComponent(url)}`;
	} catch {
		return url;
	}
}