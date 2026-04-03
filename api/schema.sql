-- ═══════════════════════════════════════════════════════
-- MANSIÓN DESEO — D1 Database Schema
-- ═══════════════════════════════════════════════════════

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  username      TEXT NOT NULL,
  password_hash TEXT,                               -- NULL for magic-link-only users
  role          TEXT NOT NULL CHECK(role IN ('hombre','mujer','pareja')),
  seeking       TEXT NOT NULL DEFAULT '[\"hombre\"]',    -- JSON array of roles: hombre, mujer, pareja
  interests     TEXT DEFAULT '[]',                  -- JSON array of interest IDs
  age           INTEGER CHECK(age >= 18 AND age <= 99),
  city          TEXT,
  country       TEXT DEFAULT '',                    -- Populated from cf-ipcountry
  bio           TEXT DEFAULT '',
  avatar_url    TEXT DEFAULT '',
  avatar_crop   TEXT DEFAULT NULL,                 -- JSON object for avatar focal position/scale
  photos        TEXT DEFAULT '[]',                  -- JSON array of R2 URLs
  status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified')),
  premium       INTEGER NOT NULL DEFAULT 0,         -- 0 = free, 1 = VIP
  premium_until TEXT DEFAULT NULL,                  -- ISO datetime of subscription expiry
  ghost_mode    INTEGER NOT NULL DEFAULT 0,         -- 0 = off, 1 = on (premium only)
  verified      INTEGER NOT NULL DEFAULT 0,         -- 0 = no, 1 = verified identity
  online        INTEGER NOT NULL DEFAULT 0,
  coins         INTEGER NOT NULL DEFAULT 0,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK(account_status IN ('active','under_review','suspended')),
  last_active   TEXT DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Processed payments (prevent payment_id reuse)
CREATE TABLE IF NOT EXISTS processed_payments (
  payment_id  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  plan_id     TEXT NOT NULL,
  amount      REAL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_country  ON users(country);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status   ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_status_active ON users(status, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_users_status_country_active ON users(status, country, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_users_status_country_role_active ON users(status, country, role, last_active DESC);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  sender_id   TEXT NOT NULL REFERENCES users(id),
  receiver_id TEXT NOT NULL REFERENCES users(id),
  conversation_id TEXT,
  content     TEXT NOT NULL,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages(sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv     ON messages(sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages(receiver_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_unread ON messages(receiver_id, sender_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_created ON messages(receiver_id, sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_receiver_unread ON messages(conversation_id, receiver_id, is_read, created_at);

-- Hidden conversations (soft delete per user)
CREATE TABLE IF NOT EXISTS hidden_conversations (
  user_id       TEXT NOT NULL REFERENCES users(id),
  partner_id    TEXT NOT NULL REFERENCES users(id),
  hidden_before TEXT NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_conversations_user ON hidden_conversations(user_id, hidden_before);

-- Denormalized conversation state (fast conversation list + unread sums)
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

-- Daily message counter (enforces 5-message free limit)
CREATE TABLE IF NOT EXISTS message_limits (
  user_id    TEXT NOT NULL REFERENCES users(id),
  date_utc   TEXT NOT NULL,                         -- 'YYYY-MM-DD'
  msg_count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date_utc)
);

-- Verification tokens (magic links)
CREATE TABLE IF NOT EXISTS verification_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id),             -- NULL for new registrations
  email      TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  purpose    TEXT NOT NULL CHECK(purpose IN ('login','verify_email','reset')),
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vtokens_token   ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_vtokens_email   ON verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_vtokens_expires ON verification_tokens(expires_at);

-- Sessions (JWT alternative for stateful session management)
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Favorites table (user A adds user B to favorites)
CREATE TABLE IF NOT EXISTS favorites (
  user_id     TEXT NOT NULL REFERENCES users(id),
  target_id   TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user   ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_target ON favorites(target_id);

-- Profile visits
CREATE TABLE IF NOT EXISTS profile_visits (
  id          TEXT PRIMARY KEY,
  visitor_id  TEXT NOT NULL REFERENCES users(id),
  visited_id  TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profile_visits_visited ON profile_visits(visited_id, created_at);

-- Site settings (key-value config)
CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Gift catalog (available gifts to send)
CREATE TABLE IF NOT EXISTS gift_catalog (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  price       INTEGER NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gift_catalog_category ON gift_catalog(category);
CREATE INDEX IF NOT EXISTS idx_gift_catalog_active   ON gift_catalog(active);

-- User gifts (sent/received)
CREATE TABLE IF NOT EXISTS user_gifts (
  id          TEXT PRIMARY KEY,
  sender_id   TEXT NOT NULL REFERENCES users(id),
  receiver_id TEXT NOT NULL REFERENCES users(id),
  gift_id     TEXT NOT NULL REFERENCES gift_catalog(id),
  message     TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_gifts_receiver ON user_gifts(receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_gifts_sender   ON user_gifts(sender_id, created_at);

-- Stories (TikTok-style video feed)
CREATE TABLE IF NOT EXISTS stories (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  video_url   TEXT NOT NULL,
  caption     TEXT DEFAULT '',
  likes       INTEGER NOT NULL DEFAULT 0,
  comments    INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stories_user   ON stories(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stories_active ON stories(active, created_at);
