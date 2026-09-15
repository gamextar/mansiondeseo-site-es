export function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeText(value: unknown, maximum: number) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

export function citySlug(value: unknown) {
  return normalizeText(value, 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function profileSlug(value: unknown) {
  return citySlug(value).slice(0, 56);
}

export function isSafeContactUrl(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol);
  } catch {
    return false;
  }
}
