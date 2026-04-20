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

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'buenos-aires',
  'buenos-aires',
  'Buenos Aires',
  'Buenos Aires',
  'AR',
  858,
  326,
  303,
  229,
  0,
  156,
  858,
  '2026-04-17 16:16:06'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'caba',
  'buenos-aires',
  'CABA',
  'Buenos Aires',
  'AR',
  476,
  107,
  198,
  171,
  0,
  74,
  476,
  '2026-04-17 16:16:07'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'buenos-aires-provincia',
  'buenos-aires',
  'Provincia de Buenos Aires',
  'Buenos Aires',
  'AR',
  857,
  325,
  303,
  229,
  0,
  156,
  857,
  '2026-04-17 16:16:09'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'cordoba',
  'cordoba',
  'Córdoba',
  'Córdoba',
  'AR',
  142,
  46,
  37,
  59,
  0,
  17,
  142,
  '2026-04-17 16:16:10'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'cordoba-provincia',
  'cordoba',
  'Provincia de Córdoba',
  'Córdoba',
  'AR',
  216,
  84,
  57,
  75,
  0,
  31,
  216,
  '2026-04-17 16:16:11'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'rosario',
  'santa-fe',
  'Rosario',
  'Santa Fe',
  'AR',
  118,
  51,
  33,
  34,
  0,
  26,
  118,
  '2026-04-17 16:16:12'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'mendoza',
  'mendoza',
  'Mendoza',
  'Mendoza',
  'AR',
  99,
  32,
  33,
  34,
  0,
  11,
  99,
  '2026-04-17 16:16:14'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'la-plata',
  'buenos-aires',
  'La Plata',
  'Buenos Aires',
  'AR',
  43,
  18,
  11,
  14,
  0,
  6,
  43,
  '2026-04-17 16:16:15'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'mar-del-plata',
  'buenos-aires',
  'Mar del Plata',
  'Buenos Aires',
  'AR',
  67,
  24,
  21,
  22,
  0,
  12,
  67,
  '2026-04-17 16:16:16'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'santa-fe',
  'santa-fe',
  'Santa Fe',
  'Santa Fe',
  'AR',
  213,
  89,
  63,
  61,
  0,
  36,
  213,
  '2026-04-17 16:16:17'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'neuquen',
  'neuquen',
  'Neuquén',
  'Neuquén',
  'AR',
  67,
  21,
  24,
  22,
  0,
  7,
  67,
  '2026-04-17 16:16:18'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'tucuman',
  'tucuman',
  'Tucumán',
  'Tucumán',
  'AR',
  64,
  21,
  18,
  25,
  0,
  3,
  64,
  '2026-04-17 16:16:19'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'salta',
  'salta',
  'Salta',
  'Salta',
  'AR',
  61,
  17,
  19,
  25,
  0,
  9,
  61,
  '2026-04-17 16:16:20'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'corrientes',
  'corrientes',
  'Corrientes',
  'Corrientes',
  'AR',
  52,
  24,
  10,
  18,
  0,
  6,
  52,
  '2026-04-17 16:16:21'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'parana',
  'entre-rios',
  'Paraná',
  'Entre Ríos',
  'AR',
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  '2026-04-17 16:16:23'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'bahiablanca',
  'buenos-aires',
  'Bahía Blanca',
  'Buenos Aires',
  'AR',
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  '2026-04-17 16:16:24'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'san-juan',
  'san-juan',
  'San Juan',
  'San Juan',
  'AR',
  31,
  9,
  12,
  10,
  0,
  2,
  31,
  '2026-04-17 16:16:25'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'san-luis',
  'san-luis',
  'San Luis',
  'San Luis',
  'AR',
  51,
  17,
  15,
  19,
  0,
  5,
  51,
  '2026-04-17 16:16:27'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'rio-cuarto',
  'cordoba',
  'Río Cuarto',
  'Córdoba',
  'AR',
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  '2026-04-17 16:16:28'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'posadas',
  'misiones',
  'Posadas',
  'Misiones',
  'AR',
  24,
  12,
  4,
  8,
  0,
  3,
  24,
  '2026-04-17 16:16:29'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'jujuy',
  'jujuy',
  'Jujuy',
  'Jujuy',
  'AR',
  20,
  10,
  6,
  4,
  0,
  0,
  20,
  '2026-04-17 16:16:30'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'entre-rios',
  'entre-rios',
  'Entre Ríos',
  'Entre Ríos',
  'AR',
  85,
  32,
  29,
  24,
  0,
  12,
  85,
  '2026-04-17 16:16:32'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'rio-negro',
  'rio-negro',
  'Río Negro',
  'Río Negro',
  'AR',
  49,
  18,
  13,
  18,
  0,
  11,
  49,
  '2026-04-17 16:16:33'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'chaco',
  'chaco',
  'Chaco',
  'Chaco',
  'AR',
  58,
  11,
  22,
  25,
  0,
  7,
  58,
  '2026-04-17 16:16:34'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'santa-cruz',
  'santa-cruz',
  'Santa Cruz',
  'Santa Cruz',
  'AR',
  31,
  8,
  13,
  10,
  0,
  3,
  31,
  '2026-04-17 16:16:35'
);

INSERT OR REPLACE INTO seo_city_stats (
  city_slug,
  province_slug,
  locality,
  province,
  country,
  active_profiles_30d,
  active_couples_30d,
  active_women_30d,
  active_men_30d,
  active_trans_30d,
  premium_profiles,
  verified_profiles,
  updated_at
) VALUES (
  'misiones',
  'misiones',
  'Misiones',
  'Misiones',
  'AR',
  43,
  21,
  10,
  12,
  0,
  6,
  43,
  '2026-04-17 16:16:36'
);
