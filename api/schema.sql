-- ═══════════════════════════════════════════════════════
-- MANSIÓN DESEO — D1 Database Schema
-- Baseline aligned with the live production D1 schema.
-- ═══════════════════════════════════════════════════════

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE,
  username           TEXT NOT NULL,
  password_hash      TEXT,
  role               TEXT NOT NULL CHECK(role IN ('hombre','mujer','pareja','pareja_hombres','pareja_mujeres','trans')),
  seeking            TEXT NOT NULL DEFAULT '["hombre"]',
  interests          TEXT DEFAULT '[]',
  age                INTEGER CHECK(age >= 18 AND age <= 99),
  city               TEXT,
  country            TEXT DEFAULT '',
  bio                TEXT DEFAULT '',
  avatar_url         TEXT DEFAULT '',
  avatar_thumb_url   TEXT DEFAULT '',
  photo_thumbs       TEXT DEFAULT '{}',
  photos             TEXT DEFAULT '[]',
  status             TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified')),
  premium            INTEGER NOT NULL DEFAULT 0,
  verified           INTEGER NOT NULL DEFAULT 0,
  online             INTEGER NOT NULL DEFAULT 0,
  last_active        TEXT DEFAULT (datetime('now')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  ghost_mode         INTEGER NOT NULL DEFAULT 0,
  is_admin           INTEGER NOT NULL DEFAULT 0,
  coins              INTEGER NOT NULL DEFAULT 100,
  premium_until      TEXT DEFAULT NULL,
  last_ip            TEXT DEFAULT '',
  account_status     TEXT NOT NULL DEFAULT 'active' CHECK(account_status IN ('active','under_review','suspended')),
  avatar_crop        TEXT DEFAULT NULL,
  fake               INTEGER NOT NULL DEFAULT 0,
  feed_priority      INTEGER NOT NULL DEFAULT 0,
  locality           TEXT,
  birthdate          TEXT,
  marital_status     TEXT,
  sexual_orientation TEXT,
  message_block_roles TEXT,
  duplicate_flag     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_status_active ON users(status, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_users_status_country_active ON users(status, country, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_users_status_country_role_active ON users(status, country, role, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_users_fake ON users(fake);
CREATE INDEX IF NOT EXISTS idx_users_feed_priority ON users(feed_priority);
CREATE INDEX IF NOT EXISTS idx_users_duplicate_flag ON users(duplicate_flag);

-- Photo OTP verification requests
CREATE TABLE IF NOT EXISTS photo_verification_requests (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code               TEXT NOT NULL,
  photo_key          TEXT DEFAULT '',
  photo_content_type TEXT DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'code_issued' CHECK(status IN ('code_issued','pending','approved','rejected','expired')),
  admin_note         TEXT DEFAULT '',
  reviewed_by        TEXT REFERENCES users(id),
  reviewed_at        TEXT DEFAULT NULL,
  expires_at         TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photo_verification_user_created ON photo_verification_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_verification_status_created ON photo_verification_requests(status, created_at DESC);

-- Processed payments
CREATE TABLE IF NOT EXISTS processed_payments (
  payment_id TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  plan_id    TEXT NOT NULL,
  amount     REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  sender_id       TEXT NOT NULL REFERENCES users(id),
  receiver_id     TEXT NOT NULL REFERENCES users(id),
  content         TEXT NOT NULL,
  is_read         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  conversation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages(receiver_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_unread ON messages(receiver_id, sender_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_created ON messages(receiver_id, sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_receiver_unread ON messages(conversation_id, receiver_id, is_read, created_at);

-- Hidden conversations
CREATE TABLE IF NOT EXISTS hidden_conversations (
  user_id       TEXT NOT NULL REFERENCES users(id),
  partner_id    TEXT NOT NULL REFERENCES users(id),
  hidden_before TEXT NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_conversations_user ON hidden_conversations(user_id, hidden_before);

-- Denormalized conversation state
CREATE TABLE IF NOT EXISTS conversation_state (
  user_id         TEXT NOT NULL REFERENCES users(id),
  partner_id      TEXT NOT NULL REFERENCES users(id),
  last_message    TEXT NOT NULL DEFAULT '',
  last_message_at TEXT NOT NULL,
  unread_count    INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_state_user_last ON conversation_state(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_state_user_unread ON conversation_state(user_id, unread_count, last_message_at DESC);

-- Daily message counter
CREATE TABLE IF NOT EXISTS message_limits (
  user_id   TEXT NOT NULL REFERENCES users(id),
  date_utc  TEXT NOT NULL,
  msg_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date_utc)
);

-- Verification tokens
CREATE TABLE IF NOT EXISTS verification_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id),
  email      TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  purpose    TEXT NOT NULL CHECK(purpose IN ('login','verify_email','reset')),
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vtokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_vtokens_email ON verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_vtokens_expires ON verification_tokens(expires_at);

-- Account deletion confirmation tokens
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_user ON account_deletion_requests(user_id, used, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_deletion_token ON account_deletion_requests(token);
CREATE INDEX IF NOT EXISTS idx_account_deletion_expires ON account_deletion_requests(expires_at);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  user_id    TEXT NOT NULL REFERENCES users(id),
  target_id  TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_target ON favorites(target_id);

-- Profile visits and aggregate stats
CREATE TABLE IF NOT EXISTS profile_visits (
  id         TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL REFERENCES users(id),
  visited_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visits_visited ON profile_visits(visited_id, created_at);
CREATE INDEX IF NOT EXISTS idx_profile_visits_visited_created ON profile_visits(visited_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_visits_visitor_visited_created ON profile_visits(visitor_id, visited_id, created_at DESC);

CREATE TABLE IF NOT EXISTS profile_stats (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  visits_total    INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  followers_total INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_profile_stats_visits_total ON profile_stats(visits_total DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_stats_followers_total ON profile_stats(followers_total DESC, updated_at DESC);

-- Error logs
CREATE TABLE IF NOT EXISTS error_logs (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL,
  level       TEXT NOT NULL DEFAULT 'error',
  message     TEXT NOT NULL,
  stack       TEXT DEFAULT '',
  route       TEXT DEFAULT '',
  method      TEXT DEFAULT '',
  status_code INTEGER,
  user_id     TEXT,
  request_id  TEXT DEFAULT '',
  ip          TEXT DEFAULT '',
  user_agent  TEXT DEFAULT '',
  meta        TEXT DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_source_created_at ON error_logs(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_status_created_at ON error_logs(status_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_created_at ON error_logs(user_id, created_at DESC);

-- Site settings
CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Gift catalog
CREATE TABLE IF NOT EXISTS gift_catalog (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  price      INTEGER NOT NULL,
  category   TEXT NOT NULL DEFAULT 'general',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gift_catalog_category ON gift_catalog(category);
CREATE INDEX IF NOT EXISTS idx_gift_catalog_active ON gift_catalog(active);

-- User gifts
CREATE TABLE IF NOT EXISTS user_gifts (
  id          TEXT PRIMARY KEY,
  sender_id   TEXT NOT NULL REFERENCES users(id),
  receiver_id TEXT NOT NULL REFERENCES users(id),
  gift_id     TEXT NOT NULL REFERENCES gift_catalog(id),
  message     TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_gifts_receiver ON user_gifts(receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_gifts_sender ON user_gifts(sender_id, created_at);

-- Stories
CREATE TABLE IF NOT EXISTS stories (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  video_url  TEXT NOT NULL,
  caption    TEXT DEFAULT '',
  vip_only   INTEGER NOT NULL DEFAULT 0,
  likes      INTEGER NOT NULL DEFAULT 0,
  comments   INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stories_active ON stories(active, created_at);

CREATE TABLE IF NOT EXISTS story_likes (
  user_id    TEXT NOT NULL,
  story_id   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, story_id)
);

CREATE TABLE IF NOT EXISTS story_daily_views (
  user_id    TEXT NOT NULL,
  story_id   TEXT NOT NULL,
  date_utc   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, story_id, date_utc)
);

CREATE INDEX IF NOT EXISTS idx_story_daily_views_user_date ON story_daily_views(user_id, date_utc);

-- SEO city stats
CREATE TABLE IF NOT EXISTS seo_city_stats (
  city_slug           TEXT NOT NULL,
  province_slug       TEXT,
  locality            TEXT NOT NULL,
  province            TEXT,
  country             TEXT NOT NULL DEFAULT 'AR',
  active_profiles_30d INTEGER NOT NULL DEFAULT 0,
  active_couples_30d  INTEGER NOT NULL DEFAULT 0,
  active_women_30d    INTEGER NOT NULL DEFAULT 0,
  active_men_30d      INTEGER NOT NULL DEFAULT 0,
  active_trans_30d    INTEGER NOT NULL DEFAULT 0,
  premium_profiles    INTEGER NOT NULL DEFAULT 0,
  verified_profiles   INTEGER NOT NULL DEFAULT 0,
  updated_at          TEXT NOT NULL,
  PRIMARY KEY (city_slug, country)
);

CREATE INDEX IF NOT EXISTS idx_seo_city_stats_country ON seo_city_stats(country);
CREATE INDEX IF NOT EXISTS idx_seo_city_stats_updated_at ON seo_city_stats(updated_at);
