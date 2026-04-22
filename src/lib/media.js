import { SITE_CONFIG, SITE_MEDIA_BASE } from './siteConfig';

const CANONICAL_R2_BASE = SITE_MEDIA_BASE;
const API_MEDIA_BASE = `${SITE_CONFIG.apiBase.replace(/\/+$/, '')}/media`;
const PROXY_ONLY_MEDIA_BASES = [
  'https://pub-da03e197cc8641dd8f5374571f9e711b.r2.dev',
];
const LEGACY_MEDIA_BASES = [
  'https://mansion-deseo-api-production.green-silence-8594.workers.dev/api/images',
  'https://pub-c0bc1ab6fb294cc1bb2e231bb55b4afb.r2.dev',
  'https://media.mansiondeseo.com',
  CANONICAL_R2_BASE,
];

function toApiMediaUrl(key) {
  return key ? `${API_MEDIA_BASE}?key=${encodeURIComponent(key)}` : '';
}

export function resolveMediaUrl(url) {
	if (!url || typeof url !== 'string') return '';
	const trimmed = url.trim();
	if (!trimmed) return '';
	if (
		trimmed.startsWith('blob:') ||
		trimmed.startsWith('data:')
	) {
		return trimmed;
	}

  if (trimmed.startsWith('/api/media?')) return trimmed;

  for (const base of PROXY_ONLY_MEDIA_BASES) {
    if (trimmed.startsWith(`${base}/`)) {
      return toApiMediaUrl(trimmed.slice(base.length + 1));
    }
  }

  if (trimmed.startsWith('/')) return trimmed;

	for (const base of LEGACY_MEDIA_BASES) {
		if (trimmed === base) return CANONICAL_R2_BASE;
		if (trimmed.startsWith(`${base}/`)) {
			return `${CANONICAL_R2_BASE}/${trimmed.slice(base.length + 1)}`;
		}
	}

	return trimmed;
}
