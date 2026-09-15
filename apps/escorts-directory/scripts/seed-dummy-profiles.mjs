import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const imagePath = process.argv.slice(2).find((value) => !value.startsWith('--')) || '/Users/javier/Desktop/dummy_profile.png';
const useLocal = process.argv.includes('--local');
const skipMedia = process.argv.includes('--skip-media');
const remoteFlag = useLocal ? '--local' : '--remote';
const dbName = 'escorts-directory-db';
const publicBucket = 'mansiondeseo-escorts-public';
const privateBucket = 'mansiondeseo-escorts-private';
const publicKey = 'profiles/demo/dummy-profile.png';

if (!existsSync(imagePath)) throw new Error(`No existe la imagen dummy: ${imagePath}`);

function run(args) {
  execFileSync('npx', ['wrangler', ...args], { cwd: root, stdio: 'inherit' });
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const cities = [
  ['buenos-aires', 'Buenos Aires'], ['caba', 'CABA'], ['palermo', 'Palermo'], ['recoleta', 'Recoleta'],
  ['belgrano', 'Belgrano'], ['san-isidro', 'San Isidro'], ['la-plata', 'La Plata'], ['mar-del-plata', 'Mar del Plata'],
  ['cordoba', 'Córdoba'], ['rosario', 'Rosario'], ['mendoza', 'Mendoza'], ['salta', 'Salta'],
];
const tiers = ['basic', 'bronze', 'silver', 'gold', 'platinum'];
const prices = { basic: 25000, bronze: 30000, silver: 38000, gold: 50000, platinum: 70000 };

if (!skipMedia) {
  console.log(`Subiendo imagen pública a R2: ${publicKey}`);
  run(['r2', 'object', 'put', `${publicBucket}/${publicKey}`, '--file', imagePath, '--remote', '--content-type', 'image/png', '--cache-control', 'public, max-age=31536000, immutable', '--force']);
}

const statements = ["DELETE FROM escort_profiles WHERE is_demo = 1;", "DELETE FROM escort_accounts WHERE email LIKE 'dummy-%@example.invalid';"];

for (let index = 1; index <= 50; index += 1) {
  const number = String(index).padStart(3, '0');
  const [citySlug, cityName] = cities[(index - 1) % cities.length];
  const tier = tiers[(index - 1) % tiers.length];
  const accountId = `dummy-account-${number}`;
  const profileId = `dummy-profile-${number}`;
  const photoId = `dummy-photo-${number}`;
  const slug = `perfil-demo-${number}-${citySlug}`;
  const name = `Perfil Demo ${number}`;
  const sourceKey = `source/demo-${number}/original.png`;
  const cardKey = publicKey;
  const price = prices[tier];
  const rotation = 1000 + index;

  // Keep a unique private source key per photo so the admin preview path stays valid.
  if (!skipMedia) run(['r2', 'object', 'put', `${privateBucket}/${sourceKey}`, '--file', imagePath, '--remote', '--content-type', 'image/png', '--force']);
  statements.push(
    `INSERT INTO escort_accounts (id, email, password_hash) VALUES (${sql(accountId)}, ${sql(`dummy-${number}@example.invalid`)}, ${sql('demo-only:no-login')});`,
    `INSERT INTO escort_profiles (id, account_id, slug, display_name, city_slug, city_name, price_amount, currency, short_bio, contact_url, contact_label, status, reviewed_by, reviewed_at, published_at, is_demo) VALUES (${sql(profileId)}, ${sql(accountId)}, ${sql(slug)}, ${sql(name)}, ${sql(citySlug)}, ${sql(cityName)}, ${price}, 'ARS', ${sql(`Perfil ficticio de prueba ${number} para validar la galería, el precio y el orden de visibilidad.`)}, 'https://example.invalid/demo', 'Contacto demo', 'published', 'seed', datetime('now'), datetime('now'), 1);`,
    `INSERT INTO escort_photos (id, profile_id, source_key, card_key, detail_key, width, height, alt_text, sort_order, status, reviewed_at) VALUES (${sql(photoId)}, ${sql(profileId)}, ${sql(sourceKey)}, ${sql(cardKey)}, ${sql(cardKey)}, 640, 853, ${sql(`Imagen dummy de prueba del perfil ${number}`)}, 0, 'approved', datetime('now'));`,
    `INSERT INTO escort_promotions (id, profile_id, tier, status, rotation_seed) VALUES (${sql(`dummy-promotion-${number}`)}, ${sql(profileId)}, ${sql(tier)}, 'active', ${rotation});`,
    `INSERT INTO escort_moderation_events (id, profile_id, actor_id, action, note) VALUES (${sql(`dummy-event-${number}`)}, ${sql(profileId)}, 'seed', 'approved', 'Perfil dummy de staging');`,
  );
}

const sqlPath = path.join(root, '.tmp-seed-dummy-profiles.sql');
writeFileSync(sqlPath, `${statements.join('\n')}\n`);
try {
  run(['d1', 'execute', dbName, remoteFlag, '--file', sqlPath]);
} finally {
  // The SQL contains only deterministic demo records and is not part of the build.
  try { unlinkSync(sqlPath); } catch {}
}
console.log('50 perfiles dummy cargados. Son visibles solo con STAGING_NO_INDEX=1.');
