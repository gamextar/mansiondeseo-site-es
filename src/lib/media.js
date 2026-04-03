const CANONICAL_R2_BASE = 'https://media.unicoapps.com';
const LEGACY_MEDIA_BASES = [
  'https://videos.unicoapps.com',
  'https://mansion-deseo-api-production.green-silence-8594.workers.dev/api/images',
  'https://pub-c0bc1ab6fb294cc1bb2e231bb55b4afb.r2.dev',
  CANONICAL_R2_BASE,
];

export function resolveMediaUrl(url) {
	if (!url || typeof url !== 'string') return '';
	const trimmed = url.trim();
	if (!trimmed) return '';
	if (
		trimmed.startsWith('blob:') ||
		trimmed.startsWith('data:') ||
		trimmed.startsWith('/')
	) {
		return trimmed;
	}

	for (const base of LEGACY_MEDIA_BASES) {
		if (trimmed === base) return CANONICAL_R2_BASE;
		if (trimmed.startsWith(`${base}/`)) {
			return `${CANONICAL_R2_BASE}/${trimmed.slice(base.length + 1)}`;
		}
	}

	return trimmed;
}
