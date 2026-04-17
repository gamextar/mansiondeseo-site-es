export const PUBLIC_SITE_ORIGIN = 'https://mansiondeseo.com';
export const APP_SITE_ORIGIN = 'https://app.mansiondeseo.com';

export function isAppSubdomainHost() {
  if (typeof window === 'undefined') return false;
  return (window.location.hostname || '').toLowerCase() === 'app.mansiondeseo.com';
}

export function buildAppUrl(path = '/') {
  const normalized = String(path || '/').startsWith('/') ? String(path || '/') : `/${path}`;
  return `${APP_SITE_ORIGIN}${normalized}`;
}
