import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SITE_ORIGIN } from '../src/lib/siteConfig.js';

export const DEFAULT_INTENT_KEYWORDS_FILE = 'data/seo/intent-keywords.json';
const INTENT_ROUTE_PREFIX = '/explorar';

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function slugifyIntentTerm(value = '') {
  return normalizeText(value)
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 86);
}

function titleCase(value = '') {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLocaleLowerCase('es-AR');
      if (['de', 'del', 'en', 'y', 'para', 'con'].includes(lower)) return lower;
      return `${lower.charAt(0).toLocaleUpperCase('es-AR')}${lower.slice(1)}`;
    })
    .join(' ');
}

function inferIntent(term = '') {
  const normalized = normalizeText(term);
  if (normalized.includes('cornud')) return 'cornudos';
  if (normalized.includes('cuck')) return 'cuckold';
  if (normalized.includes('swing')) return 'swingers';
  if (normalized.includes('trio')) return 'trios';
  if (normalized.includes('mujer')) return 'mujeres';
  if (normalized.includes('hombre')) return 'hombres';
  if (normalized.includes('pareja')) return 'parejas liberales';
  if (normalized.includes('contactossex')) return 'contactossex';
  return 'encuentros privados';
}

function inferLocation(term = '') {
  const normalized = normalizeText(term);
  const locationMap = [
    ['buenos aires', 'Buenos Aires'],
    ['caba', 'CABA'],
    ['cordoba', 'Córdoba'],
    ['mendoza', 'Mendoza'],
    ['rosario', 'Rosario'],
    ['la plata', 'La Plata'],
    ['mar del plata', 'Mar del Plata'],
    ['neuquen', 'Neuquén'],
    ['tucuman', 'Tucumán'],
    ['argentina', 'Argentina'],
  ];
  return locationMap.find(([needle]) => normalized.includes(needle))?.[1] || 'Argentina';
}

function parseCsv(content = '') {
  const rows = [];
  let cell = '';
  let row = [];
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => normalizeText(header).replace(/\s+/g, '_'));
  const hasHeader = headers.includes('term') || headers.includes('keyword') || headers.includes('termino');
  return (hasHeader ? rows.slice(1) : rows).map((values) => {
    if (!hasHeader) return { term: values[0] };
    return headers.reduce((entry, header, index) => {
      entry[header] = values[index] || '';
      return entry;
    }, {});
  });
}

async function readKeywordFile(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    const content = await readFile(absolutePath, 'utf8');
    if (absolutePath.toLowerCase().endsWith('.csv')) return parseCsv(content);
    const parsed = JSON.parse(content);
    return flattenKeywordEntries(parsed);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function normalizeKeywordEntry(entry, defaults = {}) {
  const value = typeof entry === 'string' ? { term: entry } : entry || {};
  return {
    ...defaults,
    ...value,
    category: value.category || defaults.category,
    category_id: value.category_id || defaults.category_id,
    subcategory: value.subcategory || defaults.subcategory,
    subcategory_id: value.subcategory_id || defaults.subcategory_id,
  };
}

function flattenKeywordEntries(input, defaults = {}) {
  if (Array.isArray(input)) return input.map((entry) => normalizeKeywordEntry(entry, defaults));
  if (!input || typeof input !== 'object') return [];

  const entries = [];
  if (Array.isArray(input.keywords)) {
    entries.push(...input.keywords.map((entry) => normalizeKeywordEntry(entry, defaults)));
  }

  if (Array.isArray(input.categories)) {
    for (const category of input.categories) {
      const categoryDefaults = {
        ...defaults,
        intent: category.intent || defaults.intent,
        category: category.label || category.id || defaults.category,
        category_id: category.id || defaults.category_id,
      };
      entries.push(...flattenKeywordEntries({ keywords: category.keywords || [] }, categoryDefaults));

      if (Array.isArray(category.subcategories)) {
        for (const subcategory of category.subcategories) {
          entries.push(...flattenKeywordEntries(
            { keywords: subcategory.keywords || [] },
            {
              ...categoryDefaults,
              intent: subcategory.intent || categoryDefaults.intent,
              subcategory: subcategory.label || subcategory.id || categoryDefaults.subcategory,
              subcategory_id: subcategory.id || categoryDefaults.subcategory_id,
            }
          ));
        }
      }
    }
  }

  return entries;
}

export async function loadIntentKeywordPages(filePath = process.env.SEO_INTENT_KEYWORDS_FILE || DEFAULT_INTENT_KEYWORDS_FILE) {
  const entries = await readKeywordFile(filePath);
  const seen = new Set();
  return entries
    .map((rawEntry) => (typeof rawEntry === 'string' ? { term: rawEntry } : rawEntry || {}))
    .filter((entry) => entry.enabled !== false)
    .map((entry) => {
      const term = String(entry.term || entry.keyword || entry.termino || '').trim();
      if (!term) return null;
      const slug = slugifyIntentTerm(entry.slug || term);
      if (!slug || seen.has(slug)) return null;
      seen.add(slug);
      const titleTerm = titleCase(term);
      const routePath = `${INTENT_ROUTE_PREFIX}/${slug}/`;
      return {
        ...entry,
        term,
        slug,
        titleTerm,
        intent: String(entry.intent || inferIntent(term)).trim(),
        location: String(entry.location || entry.localidad || inferLocation(term)).trim(),
        routePath,
        canonical: `${SITE_ORIGIN}${routePath}`,
        priority: String(entry.priority || '0.72'),
        changefreq: String(entry.changefreq || 'weekly'),
      };
    })
    .filter(Boolean);
}
