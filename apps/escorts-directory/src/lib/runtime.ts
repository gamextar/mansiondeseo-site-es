export function runtimeEnv(locals: Record<string, unknown> | undefined) {
  return ((locals as any)?.runtime?.env || {}) as Record<string, any>;
}

export function mediaUrl(env: Record<string, any>, key: string) {
  if (!key) return '/placeholder-card.svg';
  const origin = String(env.PUBLIC_MEDIA_ORIGIN || '').replace(/\/$/, '');
  return origin ? `${origin}/${key.replace(/^\/+/, '')}` : `/placeholder-card.svg`;
}

export function cachePublicHtml(response: Response, tags: string[] = []) {
  response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
  if (tags.length) response.headers.set('Cache-Tag', tags.join(','));
  return response;
}
