#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const DB_NAME = process.env.FEED_ITEMS_DB || 'mansion-deseo-db';

function runSql(sql, { silent = false } = {}) {
  const result = spawnSync('npx', [
    'wrangler',
    'd1',
    'execute',
    DB_NAME,
    '--remote',
    '--command',
    sql,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`wrangler d1 execute failed${details ? `\n${details}` : ''}`);
  }

  if (!silent && result.stdout.trim()) console.log(result.stdout.trim());
  return result.stdout;
}

const createTablesSql = `
CREATE TABLE IF NOT EXISTS profile_feed_items (
  user_id       TEXT PRIMARY KEY,
  role          TEXT NOT NULL DEFAULT '',
  fake          INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 0,
  country       TEXT NOT NULL DEFAULT '',
  search_text   TEXT NOT NULL DEFAULT '',
  feed_priority INTEGER NOT NULL DEFAULT 0,
  last_active   TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  card_json     TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS story_feed_items (
  story_id      TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT '',
  fake          INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 0,
  vip_only      INTEGER NOT NULL DEFAULT 0,
  likes         INTEGER NOT NULL DEFAULT 0,
  comments      INTEGER NOT NULL DEFAULT 0,
  feed_priority INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  story_json    TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_profile_feed_items_real_role ON profile_feed_items(fake, active, role, feed_priority DESC, last_active DESC, user_id DESC);
CREATE INDEX IF NOT EXISTS idx_profile_feed_items_real_country_role ON profile_feed_items(fake, active, country, role, feed_priority DESC, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_story_feed_items_real_role ON story_feed_items(fake, active, role, created_at DESC, story_id DESC);
CREATE INDEX IF NOT EXISTS idx_story_feed_items_user ON story_feed_items(user_id, active, created_at DESC);
`;

const rebuildProfilesSql = `
DELETE FROM profile_feed_items WHERE fake = 0;
INSERT INTO profile_feed_items (
  user_id, role, fake, active, country, search_text, feed_priority, last_active, updated_at, card_json
)
SELECT
  u.id,
  COALESCE(u.role, ''),
  0,
  CASE WHEN u.status = 'verified' AND COALESCE(u.account_status, 'active') = 'active' THEN 1 ELSE 0 END,
  UPPER(COALESCE(u.country, '')),
  LOWER(TRIM(COALESCE(u.username, '') || ' ' || COALESCE(u.city, '') || ' ' || COALESCE(u.locality, '') || ' ' || COALESCE(u.bio, '') || ' ' || COALESCE(u.role, ''))),
  COALESCE(u.feed_priority, 0),
  COALESCE(u.last_active, ''),
  datetime('now'),
  json_object(
    'id', COALESCE(u.id, ''),
    'username', COALESCE(u.username, ''),
    'age', u.age,
    'birthdate', COALESCE(u.birthdate, ''),
    'country', COALESCE(u.country, ''),
    'city', COALESCE(u.city, ''),
    'locality', COALESCE(u.locality, ''),
    'role', COALESCE(u.role, ''),
    'interests', COALESCE(u.interests, '[]'),
    'bio', COALESCE(u.bio, ''),
    'avatar_url', COALESCE(u.avatar_url, ''),
    'avatar_thumb_url', COALESCE(u.avatar_thumb_url, ''),
    'photo_thumbs', COALESCE(u.photo_thumbs, '{}'),
    'avatar_crop', COALESCE(u.avatar_crop, 'null'),
    'photos', COALESCE(u.photos, '[]'),
    'verified', CASE WHEN COALESCE(u.verified, 0) != 0 THEN 1 ELSE 0 END,
    'premium', CASE WHEN COALESCE(u.premium, 0) != 0 THEN 1 ELSE 0 END,
    'premium_until', u.premium_until,
    'ghost_mode', CASE WHEN COALESCE(u.ghost_mode, 0) != 0 THEN 1 ELSE 0 END,
    'fake', 0,
    'feed_priority', COALESCE(u.feed_priority, 0),
    'marital_status', COALESCE(u.marital_status, ''),
    'sexual_orientation', COALESCE(u.sexual_orientation, ''),
    'last_active', COALESCE(u.last_active, ''),
    'followers_total', COALESCE(ps.followers_total, 0),
    'has_active_story', 0,
    'active_story_url', '',
    'rotation_position', 0
  )
FROM users u
LEFT JOIN profile_stats ps ON ps.user_id = u.id
WHERE COALESCE(u.fake, 0) = 0;
`;

const rebuildStoriesSql = `
DELETE FROM story_feed_items WHERE fake = 0;
INSERT INTO story_feed_items (
  story_id, user_id, role, fake, active, vip_only, likes, comments,
  feed_priority, created_at, updated_at, story_json
)
SELECT
  s.id,
  s.user_id,
  COALESCE(u.role, ''),
  0,
  CASE WHEN s.active = 1 AND u.status = 'verified' AND COALESCE(u.account_status, 'active') = 'active' THEN 1 ELSE 0 END,
  COALESCE(s.vip_only, 0),
  COALESCE(s.likes, 0),
  COALESCE(s.comments, 0),
  COALESCE(u.feed_priority, 0),
  COALESCE(s.created_at, ''),
  datetime('now'),
  json_object(
    'id', COALESCE(s.id, ''),
    'user_id', COALESCE(s.user_id, ''),
    'video_url', COALESCE(s.video_url, ''),
    'caption', COALESCE(s.caption, ''),
    'vip_only', COALESCE(s.vip_only, 0),
    'likes', COALESCE(s.likes, 0),
    'comments', COALESCE(s.comments, 0),
    'created_at', COALESCE(s.created_at, ''),
    'username', COALESCE(u.username, ''),
    'avatar_url', COALESCE(u.avatar_url, ''),
    'avatar_crop', COALESCE(u.avatar_crop, 'null'),
    'role', COALESCE(u.role, ''),
    'fake', 0,
    'last_active', COALESCE(u.last_active, ''),
    'visits_total', 0,
    'rotation_position', 0,
    'liked', 0
  )
FROM stories s
JOIN users u ON u.id = s.user_id
WHERE COALESCE(u.fake, 0) = 0;
`;

const markReadySql = `
INSERT INTO site_settings (key, value)
VALUES ('real_feed_items_ready', '1')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO site_settings (key, value)
VALUES ('feed_cache_version', CAST(strftime('%s','now') AS TEXT) || substr(CAST(strftime('%f','now') AS TEXT), 4))
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
`;

console.log('Creating feed item tables...');
runSql(createTablesSql, { silent: true });
console.log('Rebuilding real profile feed items...');
runSql(rebuildProfilesSql, { silent: true });
console.log('Rebuilding real story feed items...');
runSql(rebuildStoriesSql, { silent: true });
console.log('Marking real feed items as ready...');
runSql(markReadySql, { silent: true });
console.log('Real feed items rebuilt.');
