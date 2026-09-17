CREATE TABLE IF NOT EXISTS escort_reviews (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES escort_profiles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT '',
  relative_date TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('approved', 'hidden')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_escort_reviews_public
  ON escort_reviews(profile_id, status, sort_order);
