const PROXY_HOSTS = new Set([
	'videos.unicoapps.com',
	'pub-c0bc1ab6fb294cc1bb2e231bb55b4afb.r2.dev',
]);

const IMAGE_PROXY_BASE = import.meta.env.PROD
	? 'https://mansion-deseo-api-production.green-silence-8594.workers.dev/api'
	: '/api';

export function resolveMediaUrl(url) {
	if (!url || typeof url !== 'string') return '';
	if (url.startsWith('/api/image-proxy?url=')) return url;
	if (url.startsWith('https://mansion-deseo-api-production.green-silence-8594.workers.dev/api/image-proxy?url=')) return url;

	try {
		const parsed = new URL(url);
		if (!PROXY_HOSTS.has(parsed.hostname)) return url;
		return `${IMAGE_PROXY_BASE}/image-proxy?url=${encodeURIComponent(url)}`;
	} catch {
		return url;
	}
}