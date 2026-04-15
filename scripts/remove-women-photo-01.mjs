#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const wranglerTomlPath = path.join(repoRoot, 'wrangler.toml')
const TARGET_BASENAME = 'photo-01.webp'
const DB_UPDATE_CHUNK_SIZE = 50
const R2_DELETE_LOG_INTERVAL = 25
const ROLE_GROUPS = {
  mujer: ['mujer'],
  hombre: ['hombre'],
  pareja: ['pareja', 'pareja_hombres', 'pareja_mujeres'],
  trans: ['trans'],
}
const LEGACY_MEDIA_BASES = [
  'https://media.mansiondeseo.com',
  'https://media.unicoapps.com',
  'https://pub-c0bc1ab6fb294cc1bb2e231bb55b4afb.r2.dev',
  'https://mansion-deseo-api-production.green-silence-8594.workers.dev/api/images',
]

function takeFlag(argv, name, fallback = '') {
  const index = argv.indexOf(name)
  if (index === -1) return fallback
  const value = argv[index + 1]
  argv.splice(index, 2)
  return value ?? fallback
}

function hasFlag(argv, name) {
  const index = argv.indexOf(name)
  if (index === -1) return false
  argv.splice(index, 1)
  return true
}

function printUsage() {
  console.log(`Uso:
  npm run cleanup:women-photo-01 -- --dry-run
  npm run cleanup:women-photo-01 -- --apply --remote
  npm run cleanup:women-photo-01 -- --apply --remote --r2-only
  npm run cleanup:role-photo-01 -- --dry-run --roles hombre,pareja
  npm run cleanup:women-photo-01 -- --dry-run --out ./data/maintenance-reports/women-photo-01.json

Descripción:
  Busca perfiles del/los roles indicados cuyo users.photos contiene photo-01.webp,
  elimina esas URLs del array de galería y, en modo apply, borra también los
  objetos correspondientes en R2.

Opciones:
  --dry-run    Solo muestra y genera reporte. Es el modo por default.
  --apply      Aplica UPDATEs en D1 y delete en R2.
  --r2-only    Omite D1 y reconstruye las keys R2 desde usernames de los roles elegidos.
  --roles      Lista separada por comas: mujer,hombre,pareja,trans. Default: mujer.
  --remote     Opera contra Cloudflare remoto (default).
  --local      Usa almacenamiento/bindings locales de Wrangler.
  --out <path> Ruta del reporte JSON.
  --help       Muestra esta ayuda.
`)
}

function parseWranglerToml(text) {
  const dbMatch = text.match(/\[\[d1_databases\]\][\s\S]*?database_name\s*=\s*"([^"]+)"/)
  const bucketMatch = text.match(/\[\[r2_buckets\]\][\s\S]*?bucket_name\s*=\s*"([^"]+)"/)
  const publicUrlMatch = text.match(/R2_PUBLIC_URL\s*=\s*"([^"]+)"/)

  return {
    dbName: dbMatch?.[1] || '',
    bucketName: bucketMatch?.[1] || '',
    publicUrl: publicUrlMatch?.[1]?.replace(/\/$/, '') || '',
  }
}

function loadWranglerConfig() {
  const parsed = parseWranglerToml(readFileSync(wranglerTomlPath, 'utf8'))
  if (!parsed.dbName || !parsed.bucketName) {
    throw new Error('No pude leer database_name o bucket_name desde wrangler.toml')
  }
  return parsed
}

function runWrangler(args, { json = false } = {}) {
  const result = spawnSync('npx', ['wrangler', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    throw new Error(`Wrangler falló con código ${result.status ?? 'desconocido'}`)
  }

  return json ? JSON.parse(result.stdout || '[]') : result.stdout
}

function runWranglerRaw(args) {
  return spawnSync('npx', ['wrangler', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
}

function runQuery(dbName, { remote, sql }) {
  const payload = runWrangler(
    ['d1', 'execute', dbName, remote ? '--remote' : '--local', '--command', sql, '--json'],
    { json: true },
  )
  return payload?.[0]?.results || []
}

function safeParseJSON(raw, fallback = []) {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function basenameFromUrl(url) {
  const trimmed = String(url || '').trim()
  if (!trimmed) return ''
  const clean = trimmed.split('?')[0].split('#')[0]
  return clean.split('/').pop() || ''
}

function isTargetPhotoUrl(url) {
  return basenameFromUrl(url) === TARGET_BASENAME
}

function extractMediaKey(url, publicUrl = '') {
  const normalizedUrl = String(url || '').trim()
  if (!normalizedUrl) return ''

  const bases = [publicUrl, ...LEGACY_MEDIA_BASES]
    .filter(Boolean)
    .map((base) => String(base).replace(/\/$/, ''))

  for (const base of bases) {
    if (normalizedUrl.startsWith(`${base}/`)) {
      return normalizedUrl.slice(base.length + 1)
    }
    if (normalizedUrl === base) {
      return ''
    }
  }

  if (normalizedUrl.includes('/api/images/')) {
    return normalizedUrl.split('/api/images/')[1] || ''
  }

  return normalizedUrl.replace(/^https?:\/\/[^/]+\//, '')
}

function sql(value) {
  if (value == null) return 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

function sqlList(values) {
  return values.map((value) => sql(value)).join(', ')
}

function chunkArray(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function sanitizeFileSegment(input, fallback = 'mujer') {
  const normalized = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function parseRequestedRoleGroups(rawValue) {
  const requested = String(rawValue || 'mujer')
    .split(',')
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)

  const roleGroups = [...new Set(requested.length > 0 ? requested : ['mujer'])]
  const unknown = roleGroups.filter((group) => !ROLE_GROUPS[group])
  if (unknown.length > 0) {
    throw new Error(`Roles no soportados: ${unknown.join(', ')}`)
  }

  return {
    roleGroups,
    expandedRoles: [...new Set(roleGroups.flatMap((group) => ROLE_GROUPS[group]))],
  }
}

function buildDefaultReportPath(roleGroups) {
  const suffix = sanitizeFileSegment(roleGroups.join('-'))
  return path.join(repoRoot, 'data', 'maintenance-reports', `remove-${suffix}-photo-01.json`)
}

function slugifyUsername(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20)
}

function shouldIgnoreR2DeleteError(output) {
  return /404|NoSuchKey|object does not exist|could not find object/i.test(output)
}

function isRetryableR2DeleteError(output) {
  return /502|bad gateway|504|timed out|internal error|fetch failed/i.test(output)
}

function deleteR2ObjectWithRetry({ bucketName, key, remote, maxAttempts = 5 }) {
  let lastErrorOutput = ''

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = runWranglerRaw([
      'r2',
      'object',
      'delete',
      `${bucketName}/${key}`,
      remote ? '--remote' : '--local',
    ])

    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim()
    if (result.status === 0) {
      return { ok: true, ignored: false, attempts: attempt }
    }

    if (shouldIgnoreR2DeleteError(output)) {
      return { ok: true, ignored: true, attempts: attempt }
    }

    lastErrorOutput = output
    if (attempt < maxAttempts && isRetryableR2DeleteError(output)) {
      sleepMs(500 * attempt)
      continue
    }

    return { ok: false, ignored: false, attempts: attempt, errorOutput: output }
  }

  return { ok: false, ignored: false, attempts: maxAttempts, errorOutput: lastErrorOutput }
}

function buildCandidates(rows, publicUrl) {
  return rows
    .map((row) => {
      const photos = safeParseJSON(row?.photos, [])
      const removedUrls = photos.filter(isTargetPhotoUrl)
      if (removedUrls.length === 0) return null

      const nextPhotos = photos.filter((url) => !isTargetPhotoUrl(url))
      const removedKeys = [...new Set(removedUrls.map((url) => extractMediaKey(url, publicUrl)).filter(Boolean))]

      return {
        id: String(row?.id || ''),
        username: String(row?.username || ''),
        beforeCount: photos.length,
        afterCount: nextPhotos.length,
        removedUrls,
        removedKeys,
        nextPhotos,
      }
    })
    .filter(Boolean)
}

function writeReport(reportPath, payload) {
  mkdirSync(path.dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage()
    process.exit(0)
  }

  const outputArg = takeFlag(argv, '--out', '')
  const rolesArg = takeFlag(argv, '--roles', 'mujer')
  const apply = hasFlag(argv, '--apply')
  const dryRun = hasFlag(argv, '--dry-run') || !apply
  const r2Only = hasFlag(argv, '--r2-only')
  const useLocal = hasFlag(argv, '--local')
  const remote = !useLocal || hasFlag(argv, '--remote')
  const { roleGroups, expandedRoles } = parseRequestedRoleGroups(rolesArg)
  const reportPath = path.resolve(process.cwd(), outputArg || buildDefaultReportPath(roleGroups))
  const wranglerConfig = loadWranglerConfig()

  let candidates = []
  let uniqueKeys = []

  if (r2Only) {
    const rows = runQuery(wranglerConfig.dbName, {
      remote,
      sql: `
        SELECT username
        FROM users
        WHERE role IN (${sqlList(expandedRoles)})
        ORDER BY username COLLATE NOCASE ASC
      `.trim(),
    })

    uniqueKeys = [...new Set(
      rows
        .map((row) => slugifyUsername(row?.username))
        .filter(Boolean)
        .map((slug) => `profiles/${slug}/${TARGET_BASENAME}`)
    )]
  } else {
    const rows = runQuery(wranglerConfig.dbName, {
      remote,
      sql: `
        SELECT id, username, photos
        FROM users
        WHERE role IN (${sqlList(expandedRoles)})
          AND photos LIKE '%${TARGET_BASENAME}%'
        ORDER BY username COLLATE NOCASE ASC
      `.trim(),
    })

    candidates = buildCandidates(rows, wranglerConfig.publicUrl)
    uniqueKeys = [...new Set(candidates.flatMap((candidate) => candidate.removedKeys))]
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    source: remote ? 'remote' : 'local',
    r2Only,
    roleGroups,
    expandedRoles,
    dbName: wranglerConfig.dbName,
    bucketName: wranglerConfig.bucketName,
    targetBasename: TARGET_BASENAME,
    matchedUsers: candidates.length,
    matchedObjects: uniqueKeys.length,
    users: candidates.map((candidate) => ({
      id: candidate.id,
      username: candidate.username,
      beforeCount: candidate.beforeCount,
      afterCount: candidate.afterCount,
      removedUrls: candidate.removedUrls,
      removedKeys: candidate.removedKeys,
    })),
  }

  writeReport(reportPath, report)

  console.log(`Reporte: ${reportPath}`)
  console.log(`Roles: ${roleGroups.join(', ')} (${expandedRoles.join(', ')})`)
  console.log(`Perfiles afectados: ${candidates.length}`)
  console.log(`Objetos R2 a borrar: ${uniqueKeys.length}`)

  if (candidates.length > 0) {
    const preview = candidates.slice(0, 5).map((candidate) => ({
      username: candidate.username,
      removed: candidate.removedUrls,
    }))
    console.log(`Primeras coincidencias: ${JSON.stringify(preview, null, 2)}`)
  }

  if (dryRun && !apply) {
    console.log('\nDry-run: no se aplicaron cambios.')
    console.log('Para aplicar:')
    console.log(`  npm run cleanup:role-photo-01 -- --apply ${remote ? '--remote' : '--local'} --roles ${roleGroups.join(',')}${r2Only ? ' --r2-only' : ''}`)
    return
  }

  const startedAt = Date.now()
  if (!r2Only) {
    const updateChunks = chunkArray(candidates, DB_UPDATE_CHUNK_SIZE)
    console.log(`\nAplicando cambios en D1 en ${updateChunks.length} bloques de hasta ${DB_UPDATE_CHUNK_SIZE} perfiles...`)

    for (const [index, chunk] of updateChunks.entries()) {
      const statements = chunk.map((candidate) =>
        `UPDATE users SET photos = ${sql(JSON.stringify(candidate.nextPhotos))} WHERE id = ${sql(candidate.id)};`
      )
      runWrangler([
        'd1',
        'execute',
        wranglerConfig.dbName,
        remote ? '--remote' : '--local',
        '--command',
        statements.join('\n'),
      ])

      const processed = Math.min((index + 1) * DB_UPDATE_CHUNK_SIZE, candidates.length)
      const elapsedMs = Date.now() - startedAt
      const avgPerUserMs = processed > 0 ? elapsedMs / processed : 0
      const remainingUsers = candidates.length - processed
      const etaMs = avgPerUserMs * remainingUsers
      console.log(`[D1] ${processed}/${candidates.length} perfiles actualizados | transcurrido ${formatDuration(elapsedMs)} | ETA ${formatDuration(etaMs)}`)
    }
  }

  console.log(`\nBorrando ${uniqueKeys.length} objetos en R2...`)
  const failures = []
  for (const [index, key] of uniqueKeys.entries()) {
    const deletion = deleteR2ObjectWithRetry({
      bucketName: wranglerConfig.bucketName,
      key,
      remote,
    })

    if (!deletion.ok) {
      failures.push({ key, attempts: deletion.attempts, errorOutput: deletion.errorOutput })
      console.log(`\n[R2] fallo en ${key} tras ${deletion.attempts} intentos`)
      console.log(deletion.errorOutput)
      continue
    }

    const processed = index + 1
    if (processed === uniqueKeys.length || processed % R2_DELETE_LOG_INTERVAL === 0) {
      const elapsedMs = Date.now() - startedAt
      const avgPerObjectMs = processed > 0 ? elapsedMs / (candidates.length + processed) : 0
      const remainingOperations = uniqueKeys.length - processed
      const etaMs = avgPerObjectMs * remainingOperations
      console.log(`[R2] ${processed}/${uniqueKeys.length} objetos borrados | transcurrido ${formatDuration(elapsedMs)} | ETA ${formatDuration(etaMs)}`)
    }
  }

  if (failures.length > 0) {
    const failureReportPath = reportPath.replace(/\.json$/i, '.failures.json')
    writeReport(failureReportPath, {
      generatedAt: new Date().toISOString(),
      mode: 'r2-failures',
      source: remote ? 'remote' : 'local',
      roleGroups,
      expandedRoles,
      bucketName: wranglerConfig.bucketName,
      failures,
    })
    console.log(`\nQuedaron ${failures.length} objetos con error. Reporte: ${failureReportPath}`)
  }

  console.log(`\nBorrado completado en ${formatDuration(Date.now() - startedAt)}.`)
}

main()
