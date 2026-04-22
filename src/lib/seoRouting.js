import { DEFAULT_SEO_LOCALE, getRouteEnabledSeoLocales, getSeoLocale } from './seoLocales.js';
import { SITE_ORIGIN } from './siteConfig.js';

function joinPathSegments(segments) {
  const normalized = segments
    .filter(Boolean)
    .map((segment) => String(segment).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${normalized.join('/')}`.replace(/\/+/g, '/');
}

export function buildSeoPath({ locale = DEFAULT_SEO_LOCALE, variant = '', citySlug = '' } = {}) {
  const localeConfig = getSeoLocale(locale);
  const base = localeConfig.pathPrefix || '';
  return joinPathSegments([base, variant, citySlug]);
}

export function buildSeoCanonical(options = {}) {
  return `${SITE_ORIGIN}${buildSeoPath(options)}`;
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
