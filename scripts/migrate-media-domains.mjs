#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const wranglerTomlPath = path.join(repoRoot, 'wrangler.toml')

const FROM_BASE = 'https://media.unicoapps.com'
const TO_BASE = (process.env.SITE_MEDIA_BASE || process.env.VITE_SITE_MEDIA_BASE || 'https://media.mansiondeseo.com').replace(/\/+$/, '')

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    dryRun: argv.includes('--dry-run') || !argv.includes('--apply'),
    remote: !argv.includes('--local'),
  }
}

function parseWranglerToml(text) {
  const dbMatch = text.match(/\[\[d1_databases\]\][\s\S]*?database_name\s*=\s*"([^"]+)"/)
  return { dbName: dbMatch?.[1] || '' }
}

function runWrangler(dbName, args, label) {
  const result = spawnSync('npx', ['wrangler', 'd1', 'execute', dbName, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  if (result.status !== 0) {
    throw new Error(`${label} falló con código ${result.status ?? 'desconocido'}`)
  }
}

function sqlForCounts() {
  return [
    `SELECT 'users.avatar_url' AS field, COUNT(*) AS rows FROM users WHERE avatar_url LIKE '${FROM_BASE}/%';`,
    `SELECT 'users.photos' AS field, COUNT(*) AS rows FROM users WHERE photos LIKE '%${FROM_BASE}/%';`,
    `SELECT 'stories.video_url' AS field, COUNT(*) AS rows FROM stories WHERE video_url LIKE '${FROM_BASE}/%';`,
  ]
}

function sqlForUpdates() {
  return [
    `UPDATE users SET avatar_url = REPLACE(avatar_url, '${FROM_BASE}', '${TO_BASE}') WHERE avatar_url LIKE '${FROM_BASE}/%';`,
    `UPDATE users SET photos = REPLACE(photos, '${FROM_BASE}', '${TO_BASE}') WHERE photos LIKE '%${FROM_BASE}/%';`,
    `UPDATE stories SET video_url = REPLACE(video_url, '${FROM_BASE}', '${TO_BASE}') WHERE video_url LIKE '${FROM_BASE}/%';`,
  ]
}

function main() {
  const wranglerConfig = parseWranglerToml(readFileSync(wranglerTomlPath, 'utf8'))
  if (!wranglerConfig.dbName) {
    throw new Error('No pude leer database_name desde wrangler.toml')
  }

  const args = parseArgs(process.argv.slice(2))
  const d1Args = args.remote ? ['--remote'] : ['--local']

  console.log(`Base origen: ${FROM_BASE}`)
  console.log(`Base destino: ${TO_BASE}`)
  console.log(`DB: ${wranglerConfig.dbName}`)

  console.log('\nFilas candidatas:')
  for (const statement of sqlForCounts()) {
    console.log(`- ${statement}`)
  }

  if (args.dryRun && !args.apply) {
    console.log('\nDry-run: no se realizaron cambios.')
    console.log('Para aplicar la migracion, ejecuta:')
    console.log(`  node scripts/migrate-media-domains.mjs --apply ${args.remote ? '--remote' : '--local'}`)
    return
  }

  console.log('\nAplicando migracion...')
  for (const statement of sqlForUpdates()) {
    runWrangler(
      wranglerConfig.dbName,
      [...d1Args, '--command', statement],
      `SQL: ${statement}`,
    )
  }
  console.log('\nMigracion completada.')
}

main()
