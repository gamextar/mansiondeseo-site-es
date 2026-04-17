export const SEO_BASE_INTENTS = [
  ['parejas', 'weekly', '0.9'],
  ['trios', 'weekly', '0.9'],
  ['swingers', 'weekly', '0.8'],
  ['mujeres', 'weekly', '0.8'],
  ['hombres', 'weekly', '0.8'],
  ['trans', 'weekly', '0.8'],
  ['cuckold-argentina', 'weekly', '0.8'],
  ['contactossex', 'weekly', '0.8'],
  ['contactossex-argentina', 'weekly', '0.9'],
  ['cornudos-argentina', 'weekly', '0.9'],
];

export const SEO_GEO_INTENT_CONFIGS = [
  { prefix: 'parejas', priority: '0.8' },
  { prefix: 'trios', priority: '0.8' },
  { prefix: 'swingers', priority: '0.78' },
  { prefix: 'mujeres', priority: '0.78' },
  { prefix: 'hombres', priority: '0.78' },
  { prefix: 'trans', priority: '0.78' },
  { prefix: 'cuckold-argentina', priority: '0.88' },
  { prefix: 'contactossex', priority: '0.85' },
  { prefix: 'contactossex-argentina', priority: '0.92' },
  { prefix: 'cornudos-argentina', priority: '0.92' },
];

export const SEO_INTENT_VARIANTS = SEO_BASE_INTENTS.map(([slug]) => slug);

export function isSeoIntentVariant(variant = '') {
  return SEO_INTENT_VARIANTS.includes(variant);
}
