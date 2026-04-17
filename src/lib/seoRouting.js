import { DEFAULT_SEO_LOCALE, getRouteEnabledSeoLocales, getSeoLocale } from './seoLocales.js';

const SITE_ORIGIN = 'https://mansiondeseo.com';

function joinPathSegments(segments) {
  const normalized = segments
    .filter(Boolean)
    .map((segment) => String(segment).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${normalized.join('/')}`.replace(/\/+/g, '/');
}

function withTrailingSlash(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

export function buildSeoPath({ locale = DEFAULT_SEO_LOCALE, variant = '', citySlug = '' } = {}) {
  const localeConfig = getSeoLocale(locale);
  const base = localeConfig.pathPrefix || '';
  return joinPathSegments([base, variant, citySlug]);
}

export function buildSeoPublicPath(options = {}) {
  return withTrailingSlash(buildSeoPath(options));
}

export function buildSeoCanonical(options = {}) {
  return `${SITE_ORIGIN}${buildSeoPublicPath(options)}`;
}

export function buildSeoAlternates({ variant = '', citySlug = '' } = {}) {
  return getRouteEnabledSeoLocales().map((locale) => ({
    hrefLang: locale.hreflang,
    href: buildSeoCanonical({
      locale: locale.code,
      variant,
      citySlug,
    }),
  }));
}

export function buildLocaleHomePath(locale = DEFAULT_SEO_LOCALE) {
  const localeConfig = getSeoLocale(locale);
  return localeConfig.pathPrefix || '/';
}
