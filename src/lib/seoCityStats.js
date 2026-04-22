import seoCityStatsData from '../../data/seo/seo-city-stats.json';
import { SITE_LOCALE } from './siteConfig';

const cityStatsList = Array.isArray(seoCityStatsData?.cities) ? seoCityStatsData.cities : [];
const cityStatsBySlug = new Map(cityStatsList.map((entry) => [entry.city_slug, entry]));

export function getSeoCityStats(citySlug = '') {
  return cityStatsBySlug.get(citySlug) || null;
}

export function hasSeoCityStats(stats) {
  return Number(stats?.active_profiles_30d || 0) > 0;
}

export function getTopSeoCityStats(limit = 6, excludeSlugs = []) {
  const excluded = new Set(Array.isArray(excludeSlugs) ? excludeSlugs : [excludeSlugs]);
  return cityStatsList
    .filter((entry) => Number(entry.active_profiles_30d || 0) > 0 && !excluded.has(entry.city_slug))
    .sort((left, right) => Number(right.active_profiles_30d || 0) - Number(left.active_profiles_30d || 0))
    .slice(0, limit);
}

export function formatSeoCityStatsDate(value) {
  const datePart = String(value || '').slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Intl.DateTimeFormat(SITE_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
