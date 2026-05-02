#!/usr/bin/env node

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const DB_NAME = process.env.STORY_SNAPSHOT_DB || 'mansion-deseo-db';
const R2_BUCKET = process.env.STORY_SNAPSHOT_BUCKET || 'mansion-deseo-images';
const MEDIA_BASE = (process.env.R2_PUBLIC_URL || 'https://media.mansiondeseo.com').replace(/\/$/, '');
const PREFIX = 'story-snapshots';
const BUCKETS = ['hombre', 'mujer', 'pareja', 'trans'];
const FAKE_LIMIT_PER_BUCKET = 100;
const REAL_LIMIT = 300;

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
  return ['pareja', 'pareja_hombres', 'pareja_mujeres'].includes(role) ? 'pareja' : role;
}

function normalizeMediaUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${MEDIA_BASE}/${raw.replace(/^\/+/, '')}`;
}

function mapRow(row, position) {
  return {
    id: String(row.id || ''),
    user_id: String(row.user_id || ''),
    video_url: normalizeMediaUrl(row.video_url),
    caption: row.caption || '',
    vip_only: Number(row.vip_only || 0),
    likes: Number(row.likes || 0),
    comments: Number(row.comments || 0),
    created_at: row.created_at || '',
    username: row.username || '',
    avatar_url: row.avatar_url || '',
    avatar_crop: typeof row.avatar_crop === 'string' ? row.avatar_crop : JSON.stringify(row.avatar_crop || null),
    role: row.role || '',
    fake: Number(row.fake || 0),
    last_active: row.last_active || '',
    visits_total: 0,
    rotation_position: position,
    liked: 0,
  };
}

function uniqueByUser(rows, limit = Infinity) {
  const seenStories = new Set();
  const seenUsers = new Set();
  const output = [];
  for (const row of rows) {
    const storyId = String(row.id || '');
    const userId = String(row.user_id || '');
    if (!storyId || !userId || seenStories.has(storyId) || seenUsers.has(userId)) continue;
    seenStories.add(storyId);
    seenUsers.add(userId);
    output.push(row);
    if (output.length >= limit) break;
  }
  return output;
}

function putObject(key, payload, cacheControl) {
  const file = join(tempDir, key.split('/').pop());
  writeFileSync(file, `${JSON.stringify(payload)}\n`);
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
}

const tempDir = mkdtempSync(join(tmpdir(), 'mansion-story-snapshots-'));

try {
  const version = Date.now().toString(36);
  const updatedAt = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  const baseSql = `
    SELECT s.id, s.user_id, s.video_url, COALESCE(s.caption, '') AS caption,
           COALESCE(s.vip_only, 0) AS vip_only, COALESCE(s.likes, 0) AS likes,
           COALESCE(s.comments, 0) AS comments, s.created_at,
           u.username, u.avatar_url, u.avatar_crop, u.role, COALESCE(u.fake, 0) AS fake,
           u.last_active, COALESCE(u.feed_priority, 0) AS feed_priority
    FROM stories s
    JOIN users u ON u.id = s.user_id
    WHERE s.active = 1
      AND COALESCE(s.vip_only, 0) = 0
      AND u.status = 'verified'
      AND COALESCE(u.account_status, 'active') = 'active'
  `;

  const realRows = uniqueByUser(query(`
    ${baseSql}
      AND COALESCE(u.fake, 0) = 0
    ORDER BY s.created_at DESC, u.last_active DESC, s.id DESC
    LIMIT ${REAL_LIMIT}
  `), REAL_LIMIT).map((row, index) => mapRow(row, index + 1));

  const realKey = `${PREFIX}/real.v${version}.json`;
  putObject(realKey, {
    schema: 1,
    kind: 'real',
    version,
    updated_at: updatedAt,
    count: realRows.length,
    stories: realRows,
  }, 'public, max-age=31536000, immutable');

  const fakeRows = uniqueByUser(query(`
    ${baseSql}
      AND COALESCE(u.fake, 0) = 1
    ORDER BY COALESCE(u.feed_priority, 0) DESC, s.created_at DESC, s.id DESC
    LIMIT 2000
  `), 2000);

  const manifest = {
    schema: 1,
    version,
    updated_at: updatedAt,
    source: 'cli-rebuild-story-snapshots',
    real: {
      key: realKey,
      url: `${MEDIA_BASE}/${realKey}`,
      count: realRows.length,
    },
    fakes: {},
  };

  for (const bucket of BUCKETS) {
    const rows = fakeRows.filter((row) => roleBucket(row.role) === bucket);
    const priorityRows = rows.filter((row) => Number(row.feed_priority || 0) > 0);
    const normalRows = rows.filter((row) => Number(row.feed_priority || 0) <= 0);
    const seed = hashStringToUint32(`fake-snapshot:${bucket}:${version}:${rows.length}`);
    const selectedRows = uniqueByUser([
      ...shuffleRows(priorityRows, seed),
      ...shuffleRows(normalRows, seed ^ 0xa5a5a5a5),
    ], FAKE_LIMIT_PER_BUCKET).map((row, index) => mapRow(row, index + 1));
    const key = `${PREFIX}/fakes-${bucket}.v${version}.json`;
    putObject(key, {
      schema: 1,
      kind: 'fake',
      bucket,
      version,
      updated_at: updatedAt,
      count: selectedRows.length,
      stories: selectedRows,
    }, 'public, max-age=31536000, immutable');
    manifest.fakes[bucket] = {
      key,
      url: `${MEDIA_BASE}/${key}`,
      count: selectedRows.length,
    };
  }

  putObject(`${PREFIX}/manifest.json`, manifest, 'public, max-age=15, stale-while-revalidate=300');
  console.log(`Story snapshots listos: reales=${realRows.length}, fakes=${Object.values(manifest.fakes).reduce((sum, item) => sum + item.count, 0)}, version=${version}`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
