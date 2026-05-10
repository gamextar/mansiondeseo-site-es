#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const DB_NAME = process.env.SEO_PROFILE_CARDS_DB || 'mansion-deseo-db';
const OUTPUT_PATH = process.env.SEO_PROFILE_CARDS_OUTPUT || 'data/seo/landing-profile-cards.json';
const LIMIT = Math.max(12, Math.min(Number.parseInt(process.env.SEO_PROFILE_CARDS_LIMIT || '600', 10) || 600, 2000));
const INCLUDE_REAL = process.env.SEO_CARDS_INCLUDE_REAL === '1';

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${details ? `\n${details}` : ''}`);
  }
  return result.stdout;
}

function query(sql) {
  const output = run('npx', ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--json', '--command', sql]);
  const parsed = JSON.parse(output);
  return parsed?.[0]?.results || [];
}

function decodeHexUtf8(value = '') {
  const hex = String(value || '').trim();
  if (!hex || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return '';
  return Buffer.from(hex, 'hex').toString('utf8');
}

function rowText(row, key) {
  return String(row?.[key] ?? decodeHexUtf8(row?.[`${key}_hex`]) ?? '');
}

function compactBio(value = '') {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function publicLocation(row) {
  const locality = rowText(row, 'locality');
  const city = rowText(row, 'city');
  const country = rowText(row, 'country');
  return locality || city || country || 'Argentina';
}

function mapRow(row) {
  const imageUrl = rowText(row, 'avatar_thumb_url') || rowText(row, 'avatar_url');
  return {
    id: rowText(row, 'id'),
    name: rowText(row, 'username'),
    age: Number.isFinite(Number(row.age)) ? Number(row.age) : null,
    role: rowText(row, 'role'),
    location: publicLocation(row),
    city: rowText(row, 'city'),
    locality: rowText(row, 'locality'),
    bio: compactBio(rowText(row, 'bio')) || 'Perfil privado con acceso completo solo para usuarios registrados.',
    image_url: imageUrl,
    avatar_url: rowText(row, 'avatar_url'),
    avatar_thumb_url: rowText(row, 'avatar_thumb_url'),
    verified: Number(row.verified || 0) ? 1 : 0,
    premium: Number(row.premium || 0) ? 1 : 0,
    fake: Number(row.fake || 0) ? 1 : 0,
    feed_priority: Math.max(0, Number(row.feed_priority || 0)),
    last_active: rowText(row, 'last_active'),
  };
}

const fakeFilter = INCLUDE_REAL ? '' : 'AND COALESCE(u.fake, 0) = 1';
const sql = `
  SELECT
    hex(COALESCE(u.id, '')) AS id_hex,
    hex(COALESCE(u.username, '')) AS username_hex,
    u.age,
    hex(COALESCE(u.role, '')) AS role_hex,
    hex(COALESCE(u.country, '')) AS country_hex,
    hex(COALESCE(u.city, '')) AS city_hex,
    hex(COALESCE(u.locality, '')) AS locality_hex,
    hex(COALESCE(u.bio, '')) AS bio_hex,
    hex(COALESCE(u.avatar_url, '')) AS avatar_url_hex,
    hex(COALESCE(u.avatar_thumb_url, '')) AS avatar_thumb_url_hex,
    u.verified,
    u.premium,
    COALESCE(u.fake, 0) AS fake,
    COALESCE(u.feed_priority, 0) AS feed_priority,
    hex(COALESCE(u.last_active, '')) AS last_active_hex
  FROM users u
  WHERE u.status = 'verified'
    AND COALESCE(u.account_status, 'active') = 'active'
    AND COALESCE(u.ghost_mode, 0) = 0
    ${fakeFilter}
    AND (COALESCE(u.avatar_thumb_url, '') != '' OR COALESCE(u.avatar_url, '') != '')
  ORDER BY COALESCE(u.feed_priority, 0) DESC, COALESCE(u.last_active, '') DESC, u.id DESC
  LIMIT ${LIMIT}
`;

const cards = query(sql).map(mapRow).filter((card) => card.name && card.image_url);
const payload = {
  schema: 1,
  generated_at: new Date().toISOString(),
  source: INCLUDE_REAL ? 'd1-users-fake-and-real' : 'd1-users-fake-only',
  count: cards.length,
  cards,
};

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Exported ${cards.length} SEO profile cards to ${OUTPUT_PATH}`);
