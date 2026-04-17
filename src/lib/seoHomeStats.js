import homeStatsData from '../../data/seo/seo-home-stats.json';

export function getSeoHomeStats() {
  return homeStatsData?.stats || null;
}

export function formatSeoHomeStatsDate(value) {
  const datePart = String(value || '').slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
