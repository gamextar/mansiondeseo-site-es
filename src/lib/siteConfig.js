const COUNTRY_DEFAULTS = {
  AR: {
    country: 'AR',
    locale: 'es-AR',
    seoLocale: 'es-ar',
    timezone: 'America/Argentina/Buenos_Aires',
    currency: 'ARS',
    origin: 'https://mansiondeseo.com',
    mediaBase: 'https://media.mansiondeseo.com',
    canonicalHost: 'mansiondeseo.com',
    redirectHosts: ['www.mansiondeseo.com'],
  },
  ES: {
    country: 'ES',
    locale: 'es-ES',
    seoLocale: 'es-es',
    timezone: 'Europe/Madrid',
    currency: 'EUR',
    origin: 'https://es.mansiondeseo.com',
    mediaBase: 'https://media-es.mansiondeseo.com',
    canonicalHost: 'es.mansiondeseo.com',
    redirectHosts: [],
  },
};

const viteEnv = import.meta.env || {};
const nodeEnv = typeof process !== 'undefined' ? process.env || {} : {};

function readEnv(name) {
  const viteValue = viteEnv[name];
  if (viteValue != null && String(viteValue).trim() !== '') return String(viteValue).trim();
  const nodeValue = nodeEnv[name];
  if (nodeValue != null && String(nodeValue).trim() !== '') return String(nodeValue).trim();
  return '';
}

function trimTrailingSlash(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function normalizeCountry(value) {
  const code = String(value || '').trim().toUpperCase();
  return COUNTRY_DEFAULTS[code] ? code : 'AR';
}

function normalizeLocale(value, fallback) {
  return String(value || fallback || 'es-AR').trim();
}

function getCurrentCountryDefaults() {
  return COUNTRY_DEFAULTS[
    normalizeCountry(readEnv('VITE_SITE_COUNTRY') || readEnv('SITE_COUNTRY'))
  ];
}

const defaults = getCurrentCountryDefaults();
const country = normalizeCountry(readEnv('VITE_SITE_COUNTRY') || readEnv('SITE_COUNTRY') || defaults.country);
const locale = normalizeLocale(readEnv('VITE_SITE_LOCALE') || readEnv('SITE_LOCALE'), defaults.locale);
const seoLocale = String(readEnv('VITE_SITE_SEO_LOCALE') || readEnv('SITE_SEO_LOCALE') || defaults.seoLocale).trim().toLowerCase();
const timezone = String(readEnv('VITE_SITE_TIMEZONE') || readEnv('SITE_TIMEZONE') || defaults.timezone).trim();
const currency = String(readEnv('VITE_SITE_CURRENCY') || readEnv('SITE_CURRENCY') || defaults.currency).trim().toUpperCase();
const origin = trimTrailingSlash(readEnv('VITE_SITE_ORIGIN') || readEnv('SITE_ORIGIN') || defaults.origin);
const mediaBase = trimTrailingSlash(readEnv('VITE_SITE_MEDIA_BASE') || readEnv('SITE_MEDIA_BASE') || defaults.mediaBase);
const explicitApiBase = trimTrailingSlash(readEnv('VITE_API_BASE') || readEnv('SITE_API_BASE'));
const explicitWsBase = trimTrailingSlash(readEnv('VITE_WS_BASE') || readEnv('SITE_WS_BASE'));
const canonicalHost = String(readEnv('VITE_SITE_CANONICAL_HOST') || readEnv('SITE_CANONICAL_HOST') || defaults.canonicalHost).trim();
const redirectHosts = String(readEnv('VITE_SITE_REDIRECT_HOSTS') || readEnv('SITE_REDIRECT_HOSTS') || defaults.redirectHosts.join(','))
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

function originToWsBase(value) {
  return trimTrailingSlash(String(value || '').replace(/^http:/, 'ws:').replace(/^https:/, 'wss:'));
}

export const SITE_CONFIG = Object.freeze({
  country,
  locale,
  seoLocale,
  timezone,
  currency,
  origin,
  mediaBase,
  canonicalHost,
  redirectHosts,
  apiBase: explicitApiBase || `${origin}/api`,
  wsBase: explicitWsBase || originToWsBase(origin),
});

export const SITE_ORIGIN = SITE_CONFIG.origin;
export const SITE_LOCALE = SITE_CONFIG.locale;
export const SITE_TIMEZONE = SITE_CONFIG.timezone;
export const SITE_CURRENCY = SITE_CONFIG.currency;
export const SITE_MEDIA_BASE = SITE_CONFIG.mediaBase;

export function resolveApiBase() {
  if (explicitApiBase) return explicitApiBase;
  if (viteEnv.PROD === false) return '/api';
  if (typeof window === 'undefined') return SITE_CONFIG.apiBase;
  if (window.location.hostname.endsWith('.pages.dev')) return SITE_CONFIG.apiBase;
  return '/api';
}

export function resolveWsBase() {
  if (explicitWsBase) return explicitWsBase;
  if (typeof window === 'undefined') return SITE_CONFIG.wsBase;
  if (viteEnv.PROD === false) return `ws://${window.location.hostname}:8787`;
  if (window.location.hostname.endsWith('.pages.dev')) return SITE_CONFIG.wsBase;
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
}

export function formatNumber(value, options = {}) {
  return new Intl.NumberFormat(SITE_LOCALE, options).format(Number(value || 0));
}

export function formatCurrencyAmount(value, options = {}) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat(SITE_LOCALE, {
    style: 'currency',
    currency: SITE_CURRENCY,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  }).format(amount);
}

export function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat(SITE_LOCALE, {
    timeZone: SITE_TIMEZONE,
    ...options,
  }).format(value instanceof Date ? value : new Date(value));
}

export function formatTime(value, options = {}) {
  return new Intl.DateTimeFormat(SITE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SITE_TIMEZONE,
    ...options,
  }).format(value instanceof Date ? value : new Date(value));
}
