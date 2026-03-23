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
  seeking       TEXT NOT NULL CHECK(seeking IN ('hombre','mujer','pareja')),
  interests     TEXT DEFAULT '[]',                  -- JSON array of interest IDs
  age           INTEGER CHECK(age >= 18 AND age <= 99),
  city          TEXT,
  country       TEXT DEFAULT '',                    -- Populated from cf-ipcountry
  bio           TEXT DEFAULT '',
  avatar_url    TEXT DEFAULT '',
  photos        TEXT DEFAULT '[]',                  -- JSON array of R2 URLs
  status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified')),
  premium       INTEGER NOT NULL DEFAULT 0,         -- 0 = free, 1 = VIP
  ghost_mode    INTEGER NOT NULL DEFAULT 0,         -- 0 = off, 1 = on (premium only)
  verified      INTEGER NOT NULL DEFAULT 0,         -- 0 = no, 1 = verified identity
  online        INTEGER NOT NULL DEFAULT 0,
  last_active   TEXT DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_country  ON users(country);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status   ON users(status);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  sender_id   TEXT NOT NULL REFERENCES users(id),
  receiver_id TEXT NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages(sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv     ON messages(sender_id, receiver_id, created_at);

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
