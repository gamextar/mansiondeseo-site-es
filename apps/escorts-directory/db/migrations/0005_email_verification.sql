ALTER TABLE escort_accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS escort_email_verifications (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES escort_accounts(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_escort_email_verifications_lookup
  ON escort_email_verifications(token, used, expires_at);
