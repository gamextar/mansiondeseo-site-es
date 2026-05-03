#!/usr/bin/env node

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const DB_NAME = process.env.PROFILE_SNAPSHOT_DB || 'mansion-deseo-db';
const R2_BUCKET = process.env.PROFILE_SNAPSHOT_BUCKET || 'mansion-deseo-images';
const MEDIA_BASE = (process.env.R2_PUBLIC_URL || 'https://media.mansiondeseo.com').replace(/\/$/, '');
const PREFIX = 'profile-snapshots';
const BUCKETS = ['hombre', 'mujer', 'pareja', 'trans'];
const PAIR_ROLES = ['pareja', 'pareja_hombres', 'pareja_mujeres'];
const PAGE_SIZE = 200;

function run(command, args, { input, silent = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    input,
    stdio: input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${details ? `\n${details}` : ''}`);
  }

  if (!silent && result.stdout.trim()) console.log(result.stdout.trim());
  return result.stdout;
}

function query(sql) {
  const output = run('npx', ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--json', '--command', sql], { silent: true });
  const parsed = JSON.parse(output);
  return parsed?.[0]?.results || [];
}

function hashStringToUint32(value = '') {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seedValue) {
  let state = (Number(seedValue) >>> 0) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return (((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296);
  };
}

function shuffleRows(rows, seed) {
  const output = [...rows];
  const random = createSeededRandom(seed);
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function roleBucket(role) {
  return PAIR_ROLES.includes(role) ? 'pareja' : role;
}

function stringifyJsonValue(value, fallback) {
  if (typeof value === 'string') return value || fallback;
  try {
    return JSON.stringify(value ?? JSON.parse(fallback));
  } catch {
    return fallback;
  }
}

function decodeHexUtf8(value = '') {
  const hex = String(value || '').trim();
  if (!hex || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return '';
  return Buffer.from(hex, 'hex').toString('utf8');
}

function rowText(row, key) {
  return String(row?.[key] ?? decodeHexUtf8(row?.[`${key}_hex`]) ?? '');
}

function mapRow(row, position) {
  return {
    id: rowText(row, 'id'),
    username: rowText(row, 'username'),
    age: Number.isFinite(Number(row.age)) ? Number(row.age) : null,
    birthdate: rowText(row, 'birthdate'),
    country: rowText(row, 'country'),
    city: rowText(row, 'city'),
    locality: rowText(row, 'locality'),
    role: rowText(row, 'role'),
    interests: stringifyJsonValue(row.interests ?? decodeHexUtf8(row.interests_hex), '[]'),
    bio: String(row.bio ?? decodeHexUtf8(row.bio_hex)).replace(/[\r\n]+/g, ' '),
    avatar_url: rowText(row, 'avatar_url'),
    avatar_thumb_url: rowText(row, 'avatar_thumb_url'),
    photo_thumbs: stringifyJsonValue(row.photo_thumbs ?? decodeHexUtf8(row.photo_thumbs_hex), '{}'),
    avatar_crop: stringifyJsonValue(row.avatar_crop ?? decodeHexUtf8(row.avatar_crop_hex), 'null'),
    photos: stringifyJsonValue(row.photos ?? decodeHexUtf8(row.photos_hex), '[]'),
    verified: Number(row.verified || 0) ? 1 : 0,
    premium: Number(row.premium || 0) ? 1 : 0,
    premium_until: rowText(row, 'premium_until') || null,
    ghost_mode: Number(row.ghost_mode || 0) ? 1 : 0,
    fake: 1,
    feed_priority: Math.max(0, Number(row.feed_priority || 0)),
    marital_status: rowText(row, 'marital_status'),
    sexual_orientation: rowText(row, 'sexual_orientation'),
    last_active: rowText(row, 'last_active'),
    followers_total: Number(row.followers_total || 0),
    has_active_story: 0,
    active_story_url: '',
    rotation_position: position,
  };
}

function putObject(key, payload, cacheControl) {
  const file = join(tempDir, key.split('/').pop());
  const body = `${JSON.stringify(payload)}\n`;
  writeFileSync(file, body);
  run('npx', [
    'wrangler',
    'r2',
    'object',
    'put',
    `${R2_BUCKET}/${key}`,
    '--remote',
    '--file',
    file,
    '--content-type',
    'application/json; charset=utf-8',
    '--cache-control',
    cacheControl,
  ], { silent: false });
  return Buffer.byteLength(body);
}

const tempDir = mkdtempSync(join(tmpdir(), 'mansion-profile-snapshots-'));

try {
  const version = Date.now().toString(36);
  const updatedAt = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  const baseSql = `
    SELECT
      hex(COALESCE(u.id, '')) AS id_hex, hex(COALESCE(u.username, '')) AS username_hex, u.age,
      hex(COALESCE(u.birthdate, '')) AS birthdate_hex, hex(COALESCE(u.country, '')) AS country_hex,
      hex(COALESCE(u.city, '')) AS city_hex, hex(COALESCE(u.locality, '')) AS locality_hex,
      hex(COALESCE(u.role, '')) AS role_hex, hex(COALESCE(u.interests, '')) AS interests_hex,
      hex(COALESCE(u.bio, '')) AS bio_hex, hex(COALESCE(u.avatar_url, '')) AS avatar_url_hex,
      hex(COALESCE(u.avatar_thumb_url, '')) AS avatar_thumb_url_hex,
      hex(COALESCE(u.photo_thumbs, '')) AS photo_thumbs_hex, hex(COALESCE(u.avatar_crop, '')) AS avatar_crop_hex,
      hex(COALESCE(u.photos, '')) AS photos_hex, u.verified, u.premium,
      hex(COALESCE(u.premium_until, '')) AS premium_until_hex, u.ghost_mode, COALESCE(u.feed_priority, 0) AS feed_priority,
      hex(COALESCE(u.marital_status, '')) AS marital_status_hex,
      hex(COALESCE(u.sexual_orientation, '')) AS sexual_orientation_hex,
      hex(COALESCE(u.last_active, '')) AS last_active_hex,
      COALESCE(ps.followers_total, 0) AS followers_total
    FROM users u
    LEFT JOIN profile_stats ps ON ps.user_id = u.id
    WHERE COALESCE(u.fake, 0) = 1
      AND u.status = 'verified'
      AND COALESCE(u.account_status, 'active') = 'active'
    ORDER BY COALESCE(u.feed_priority, 0) DESC, u.id DESC
  `;
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const batch = query(`${baseSql} LIMIT ${PAGE_SIZE} OFFSET ${offset}`);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  const manifest = {
    schema: 1,
    version,
    updated_at: updatedAt,
    source: 'cli-rebuild-profile-snapshots',
    total_count: 0,
    total_bytes: 0,
    fakes: {},
  };

  for (const bucket of BUCKETS) {
    const bucketRows = rows.filter((row) => roleBucket(rowText(row, 'role')) === bucket);
    const priorityRows = bucketRows.filter((row) => Number(row.feed_priority || 0) > 0);
    const normalRows = bucketRows.filter((row) => Number(row.feed_priority || 0) <= 0);
    const seed = hashStringToUint32(`fake-profile-snapshot:${bucket}:${version}:${bucketRows.length}`);
    const selectedRows = [
      ...shuffleRows(priorityRows, seed),
      ...shuffleRows(normalRows, seed ^ 0xa5a5a5a5),
    ].map((row, index) => mapRow(row, index + 1));
    const key = `${PREFIX}/fakes-${bucket}.v${version}.json`;
    const bytes = putObject(key, {
      schema: 1,
      kind: 'fake-profiles',
      bucket,
      version,
      updated_at: updatedAt,
      count: selectedRows.length,
      profiles: selectedRows,
    }, 'public, max-age=31536000, immutable');
    manifest.total_count += selectedRows.length;
    manifest.total_bytes += bytes;
    manifest.fakes[bucket] = {
      key,
      url: `${MEDIA_BASE}/${key}`,
      count: selectedRows.length,
      bytes,
    };
  }

  putObject(`${PREFIX}/manifest.json`, manifest, 'public, max-age=15, stale-while-revalidate=300');
  console.log(`Profile snapshots listos: fakes=${manifest.total_count}, bytes=${manifest.total_bytes}, version=${version}`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
