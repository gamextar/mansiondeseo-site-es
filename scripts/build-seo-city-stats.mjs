#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GEO_PAGES } from '../src/lib/seoGeoCatalog.js';
import { GEO_STATS_SLUGS, getGeoStatsTarget } from '../src/lib/seoGeoStatsCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const wranglerTomlPath = path.join(repoRoot, 'wrangler.toml');
const schemaSqlPath = path.join(repoRoot, 'scripts', 'sql', 'seo-city-stats.sql');
const defaultOutputPath = path.join(repoRoot, 'data', 'seo', 'seo-city-stats.json');
const defaultSqlOutputPath = path.join(repoRoot, 'data', 'seo', 'seo-city-stats-upsert.sql');

function takeFlag(argv, name, fallback = '') {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  const value = argv[index + 1];
  argv.splice(index, 2);
  return value ?? fallback;
}

function hasFlag(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return false;
  argv.splice(index, 1);
  return true;
}

function parseWranglerToml(text) {
  const dbMatch = text.match(/\[\[d1_databases\]\][\s\S]*?database_name\s*=\s*"([^"]+)"/);
  return { dbName: dbMatch?.[1] || '' };
}

function loadDbName() {
  const parsed = parseWranglerToml(readFileSync(wranglerTomlPath, 'utf8'));
  if (!parsed.dbName) {
    throw new Error('No pude leer database_name desde wrangler.toml');
  }
  return parsed.dbName;
}

function runWranglerQuery(dbName, { remote, sql }) {
  const args = ['wrangler', 'd1', 'execute', dbName, remote ? '--remote' : '--local', '--command', sql, '--json'];
  const result = spawnSync('npx', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`Wrangler falló con código ${result.status ?? 'desconocido'}`);
  }

  return JSON.parse(result.stdout || '[]');
}

function sqlEscape(value) {
  return String(value ?? '').replaceAll("'", "''");
}

function injectBindings(whereSql, bindings = []) {
  let index = 0;
  return whereSql.replace(/\?/g, () => {
    const value = bindings[index++];
    return `'${sqlEscape(value)}'`;
  });
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRow(slug, target, row) {
  return {
    city_slug: slug,
    province_slug: target.provinceSlug || '',
    locality: target.locality || GEO_PAGES[slug]?.localityHint || GEO_PAGES[slug]?.label || slug,
    province: target.province || '',
    country: 'AR',
    active_profiles_30d: numeric(row?.active_profiles_30d),
    active_couples_30d: numeric(row?.active_couples_30d),
    active_women_30d: numeric(row?.active_women_30d),
    active_men_30d: numeric(row?.active_men_30d),
    active_trans_30d: numeric(row?.active_trans_30d),
    premium_profiles: numeric(row?.premium_profiles),
    verified_profiles: numeric(row?.verified_profiles),
    updated_at: String(row?.updated_at || new Date().toISOString()),
  };
}

function buildStatsQuery(target) {
  const whereClause = injectBindings(target.whereSql, target.bindings || []);
  return `
    SELECT
      COALESCE(SUM(CASE WHEN datetime(last_active) >= datetime('now', '-30 days') THEN 1 ELSE 0 END), 0) AS active_profiles_30d,
      COALESCE(SUM(CASE WHEN role IN ('pareja', 'pareja_hombres', 'pareja_mujeres') AND datetime(last_active) >= datetime('now', '-30 days') THEN 1 ELSE 0 END), 0) AS active_couples_30d,
      COALESCE(SUM(CASE WHEN role = 'mujer' AND datetime(last_active) >= datetime('now', '-30 days') THEN 1 ELSE 0 END), 0) AS active_women_30d,
      COALESCE(SUM(CASE WHEN role = 'hombre' AND datetime(last_active) >= datetime('now', '-30 days') THEN 1 ELSE 0 END), 0) AS active_men_30d,
      COALESCE(SUM(CASE WHEN role = 'trans' AND datetime(last_active) >= datetime('now', '-30 days') THEN 1 ELSE 0 END), 0) AS active_trans_30d,
      COALESCE(SUM(CASE WHEN premium = 1 OR (premium_until IS NOT NULL AND datetime(premium_until) > datetime('now')) THEN 1 ELSE 0 END), 0) AS premium_profiles,
      COUNT(*) AS verified_profiles,
      datetime('now') AS updated_at
    FROM users
    WHERE status = 'verified'
      AND COALESCE(account_status, 'active') = 'active'
      AND ${whereClause}
  `.trim();
}

function buildUpsertSql(rows) {
  const schemaSql = readFileSync(schemaSqlPath, 'utf8').trim();
  const inserts = rows.map((row) => `
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
  '${sqlEscape(row.city_slug)}',
  '${sqlEscape(row.province_slug)}',
  '${sqlEscape(row.locality)}',
  '${sqlEscape(row.province)}',
  '${sqlEscape(row.country)}',
  ${numeric(row.active_profiles_30d)},
  ${numeric(row.active_couples_30d)},
  ${numeric(row.active_women_30d)},
  ${numeric(row.active_men_30d)},
  ${numeric(row.active_trans_30d)},
  ${numeric(row.premium_profiles)},
  ${numeric(row.verified_profiles)},
  '${sqlEscape(row.updated_at)}'
);`.trim());

  return `${schemaSql}\n\n${inserts.join('\n\n')}\n`;
}

function printHelp() {
  console.log(`
Uso:
  npm run seo:city-stats -- [--remote|--local] [--out path] [--sql-out path] [--slugs rosario,caba] [--write-d1]

Ejemplos:
  npm run seo:city-stats -- --remote
  npm run seo:city-stats -- --remote --slugs rosario,caba
  npm run seo:city-stats -- --remote --write-d1

Salida por defecto:
  JSON: ${path.relative(repoRoot, defaultOutputPath)}
  SQL : ${path.relative(repoRoot, defaultSqlOutputPath)}
  `.trim());
}

function main() {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, '--help') || hasFlag(argv, '-h')) {
    printHelp();
    return;
  }

  const outputArg = takeFlag(argv, '--out', '');
  const sqlOutputArg = takeFlag(argv, '--sql-out', '');
  const slugsArg = takeFlag(argv, '--slugs', '');
  const writeD1 = hasFlag(argv, '--write-d1');
  const useLocal = hasFlag(argv, '--local');
  const remote = !useLocal || hasFlag(argv, '--remote');
  const outputPath = path.resolve(process.cwd(), outputArg || defaultOutputPath);
  const sqlOutputPath = path.resolve(process.cwd(), sqlOutputArg || defaultSqlOutputPath);
  const requestedSlugs = slugsArg
    ? slugsArg.split(',').map((value) => String(value || '').trim()).filter(Boolean)
    : GEO_STATS_SLUGS;
  const validSlugs = requestedSlugs.filter((slug) => getGeoStatsTarget(slug));

  if (validSlugs.length === 0) {
    throw new Error('No hay slugs válidos para procesar');
  }

  const dbName = loadDbName();
  const rows = [];

  for (const slug of validSlugs) {
    const target = getGeoStatsTarget(slug);
    if (!target) continue;
    const sql = buildStatsQuery(target);
    const result = runWranglerQuery(dbName, { remote, sql });
    const firstRow = result?.[0]?.results?.[0] || {};
    rows.push(normalizeRow(slug, target, firstRow));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: remote ? 'remote' : 'local',
    dbName,
    totalCities: rows.length,
    cities: rows,
  };
  const upsertSql = buildUpsertSql(rows);

  mkdirSync(path.dirname(outputPath), { recursive: true });
  mkdirSync(path.dirname(sqlOutputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  writeFileSync(sqlOutputPath, upsertSql, 'utf8');

  if (writeD1) {
    runWranglerQuery(dbName, { remote, sql: upsertSql });
  }

  console.log(`City stats generadas: ${outputPath}`);
  console.log(`SQL de upsert generado: ${sqlOutputPath}`);
  console.log(`Ciudades procesadas: ${rows.length}`);
  if (writeD1) {
    console.log(`Tabla seo_city_stats actualizada en D1 (${remote ? 'remote' : 'local'})`);
  }
}

main();
