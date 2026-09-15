PRAGMA foreign_keys = OFF;
ALTER TABLE escort_promotions RENAME TO escort_promotions_legacy;
CREATE TABLE escort_promotions (
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
INSERT INTO escort_promotions SELECT id, profile_id, tier, status, starts_at, ends_at, rotation_seed, created_at, updated_at FROM escort_promotions_legacy;
DROP TABLE escort_promotions_legacy;
CREATE INDEX IF NOT EXISTS idx_escort_promotions_active ON escort_promotions(profile_id, status, starts_at, ends_at);
PRAGMA foreign_keys = ON;
