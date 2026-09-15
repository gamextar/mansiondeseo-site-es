-- Separate database: it does not reference Mansion Deseo community users.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS escort_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escort_profiles (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES escort_accounts(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  city_slug TEXT NOT NULL,
  city_name TEXT NOT NULL,
  price_amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  short_bio TEXT NOT NULL DEFAULT '',
  contact_url TEXT NOT NULL DEFAULT '',
  contact_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending_review', 'published', 'rejected', 'paused', 'expired')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT DEFAULT NULL,
  reviewed_at TEXT DEFAULT NULL,
  published_at TEXT DEFAULT NULL,
  expires_at TEXT DEFAULT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_escort_profiles_public_city ON escort_profiles(status, city_slug, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_escort_profiles_account ON escort_profiles(account_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_escort_profiles_one_per_account ON escort_profiles(account_id);

CREATE TABLE IF NOT EXISTS escort_photos (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES escort_profiles(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL UNIQUE,
  card_key TEXT NOT NULL DEFAULT '',
  detail_key TEXT NOT NULL DEFAULT '',
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  alt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_escort_photos_profile_status ON escort_photos(profile_id, status, sort_order);

-- Five public visibility levels. Promotion cannot bypass profile moderation.
CREATE TABLE IF NOT EXISTS escort_promotions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES escort_profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'basic' CHECK(tier IN ('basic', 'bronze', 'silver', 'gold', 'platinum', 'diamond')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'expired', 'cancelled')),
  starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  ends_at TEXT DEFAULT NULL,
  rotation_seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_escort_promotions_active ON escort_promotions(profile_id, status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS escort_moderation_events (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES escort_profiles(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('submitted', 'approved', 'rejected', 'paused', 'photo_approved', 'photo_rejected')),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escort_reports (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES escort_profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_escort_reports_open ON escort_reports(status, created_at DESC);
