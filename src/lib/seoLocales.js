export const DEFAULT_SEO_LOCALE = 'es-ar';

export const SEO_LOCALES = {
  'es-ar': {
    code: 'es-ar',
    language: 'es',
    country: 'AR',
    hreflang: 'es-AR',
    label: 'Espanol Argentina',
    pathPrefix: '',
    routeEnabled: true,
    sitemapEnabled: true,
    default: true,
    geoKey: 'ar',
  },
  'es-es': {
    code: 'es-es',
    language: 'es',
    country: 'ES',
    hreflang: 'es-ES',
    label: 'Espanol Espana',
    pathPrefix: '/es-es',
    routeEnabled: false,
    sitemapEnabled: false,
    default: false,
    geoKey: 'es',
  },
  'en-us': {
    code: 'en-us',
    language: 'en',
    country: 'US',
    hreflang: 'en-US',
    label: 'English United States',
    pathPrefix: '/en-us',
    routeEnabled: false,
    sitemapEnabled: false,
    default: false,
    geoKey: 'us',
  },
};

export function getSeoLocale(locale = DEFAULT_SEO_LOCALE) {
  return SEO_LOCALES[locale] || SEO_LOCALES[DEFAULT_SEO_LOCALE];
}

export function isSeoLocale(locale = '') {
  return Boolean(SEO_LOCALES[locale]);
}

export function getRouteEnabledSeoLocales() {
  return Object.values(SEO_LOCALES).filter((locale) => locale.routeEnabled);
}

export function getSitemapSeoLocales() {
  return Object.values(SEO_LOCALES).filter((locale) => locale.sitemapEnabled);
}
