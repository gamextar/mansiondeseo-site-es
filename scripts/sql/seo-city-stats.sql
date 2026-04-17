CREATE TABLE IF NOT EXISTS seo_city_stats (
  city_slug TEXT NOT NULL,
  province_slug TEXT,
  locality TEXT NOT NULL,
  province TEXT,
  country TEXT NOT NULL DEFAULT 'AR',
  active_profiles_30d INTEGER NOT NULL DEFAULT 0,
  active_couples_30d INTEGER NOT NULL DEFAULT 0,
  active_women_30d INTEGER NOT NULL DEFAULT 0,
  active_men_30d INTEGER NOT NULL DEFAULT 0,
  active_trans_30d INTEGER NOT NULL DEFAULT 0,
  premium_profiles INTEGER NOT NULL DEFAULT 0,
  verified_profiles INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (city_slug, country)
);

CREATE INDEX IF NOT EXISTS idx_seo_city_stats_country
ON seo_city_stats(country);

CREATE INDEX IF NOT EXISTS idx_seo_city_stats_updated_at
ON seo_city_stats(updated_at);
