#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const wranglerTomlPath = path.join(repoRoot, 'wrangler.toml')
const LIVEFEED_CURRENT_KEY = 'livefeed/current.json'
const LIVEFEED_BUCKET_LIMIT = 50

function parseWranglerToml(text) {
  const bucketMatch = text.match(/\[\[r2_buckets\]\][\s\S]*?bucket_name\s*=\s*"([^"]+)"/)
  const dbMatch = text.match(/\[\[d1_databases\]\][\s\S]*?database_name\s*=\s*"([^"]+)"/)
  const publicUrlMatch = text.match(/R2_PUBLIC_URL\s*=\s*"([^"]+)"/)

  return {
    bucketName: bucketMatch?.[1] || '',
    dbName: dbMatch?.[1] || '',
    publicUrl: publicUrlMatch?.[1]?.replace(/\/$/, '') || '',
  }
}

const wranglerConfig = parseWranglerToml(readFileSync(wranglerTomlPath, 'utf8'))

function runWrangler(args, { json = false } = {}) {
  const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const result = spawnSync(npxBin, ['wrangler', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || `Wrangler falló (${result.status})`)
  }

  if (!json) return result.stdout
  return JSON.parse(result.stdout || '[]')
}

function extractRows(payload) {
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      if (Array.isArray(entry?.results)) return entry.results
    }
  }
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

function normalizeMediaUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `${wranglerConfig.publicUrl}/${raw.replace(/^\/+/, '')}`
}

function safeParseJSON(value, fallback = null) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function livefeedBucketForRole(role) {
  const normalized = String(role || '').trim().toLowerCase()
  if (normalized === 'mujer') return 'mujer'
  if (normalized === 'hombre') return 'hombre'
  if (normalized === 'trans') return 'trans'
  if (normalized === 'pareja' || normalized === 'pareja_hombres' || normalized === 'pareja_mujeres') return 'pareja'
  return ''
}

function buildStoryRow(row) {
  return {
    id: String(row?.user_id || ''),
    story_id: String(row?.id || ''),
    user_id: String(row?.user_id || ''),
    name: row?.username || '',
    username: row?.username || '',
    role: row?.role || '',
    avatar_url: normalizeMediaUrl(row?.avatar_url || ''),
    avatar_crop: safeParseJSON(row?.avatar_crop, null),
    created_at: row?.created_at || '',
  }
}

function uploadJsonObject(bucketName, key, filePath, cacheControl) {
  runWrangler([
    'r2', 'object', 'put', `${bucketName}/${key}`,
    '--file', filePath,
    '--content-type', 'application/json',
    '--remote',
    '--cache-control', cacheControl,
  ])
}

async function main() {
  const query = `
    SELECT
      s.id,
      s.user_id,
      s.created_at,
      u.username,
      u.avatar_url,
      u.avatar_crop,
      u.role
    FROM stories s
    JOIN users u ON u.id = s.user_id
    WHERE s.active = 1
      AND u.status = 'verified'
      AND COALESCE(u.account_status, 'active') = 'active'
    ORDER BY s.created_at DESC
    LIMIT 400
  `.trim()

  const payload = runWrangler(['d1', 'execute', wranglerConfig.dbName, '--remote', '--command', query, '--json'], { json: true })
  const rows = extractRows(payload)

  const buckets = { mujer: [], hombre: [], pareja: [], trans: [] }
  for (const row of rows) {
    const bucket = livefeedBucketForRole(row?.role)
    if (!bucket || buckets[bucket].length >= LIVEFEED_BUCKET_LIMIT) continue
    buckets[bucket].push(buildStoryRow(row))
  }

  const now = new Date().toISOString()
  const version = `livefeed-${Date.now()}.json`
  const versionKey = `livefeed/${version}`
  const versionUrl = `${wranglerConfig.publicUrl}/${versionKey}`

  const versionPayload = {
    version,
    versionKey,
    updatedAt: now,
    stories: buckets,
  }

  const currentPayload = {
    version,
    versionKey,
    versionUrl,
    updatedAt: now,
    counts: Object.fromEntries(Object.entries(buckets).map(([key, list]) => [key, list.length])),
  }

  const tempDir = mkdtempSync(path.join(tmpdir(), 'mansion-livefeed-'))
  try {
    const versionFile = path.join(tempDir, 'livefeed-version.json')
    const currentFile = path.join(tempDir, 'livefeed-current.json')
    writeFileSync(versionFile, `${JSON.stringify(versionPayload, null, 2)}\n`, 'utf8')
    writeFileSync(currentFile, `${JSON.stringify(currentPayload, null, 2)}\n`, 'utf8')

    uploadJsonObject(wranglerConfig.bucketName, versionKey, versionFile, 'public, max-age=31536000, immutable')
    uploadJsonObject(wranglerConfig.bucketName, LIVEFEED_CURRENT_KEY, currentFile, 'public, max-age=30, stale-while-revalidate=30')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }

  console.log(`Publicado livefeed: ${versionUrl}`)
  console.log(`Buckets: mujer=${buckets.mujer.length}, hombre=${buckets.hombre.length}, pareja=${buckets.pareja.length}, trans=${buckets.trans.length}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
