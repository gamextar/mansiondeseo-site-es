#!/usr/bin/env node

import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const extractorScript = path.join(__dirname, 'extract-contactossex.mjs')
const importerScript = path.join(__dirname, 'import-placeholders.mjs')
const htmlPath = path.join(__dirname, 'extractor-ui.html')
const port = Number.parseInt(process.env.EXTRACTOR_UI_PORT || '4318', 10)
const defaultBatchDir = path.join(repoRoot, 'data', 'contactossex-batches')

function createJobState(jobType) {
  return {
    jobType,
    activeChild: null,
    activeCommand: [],
    logBuffer: [],
    lastExitCode: null,
    lastStatus: 'idle',
    startedAt: null,
    finishedAt: null,
    lastSummary: null,
  }
}

const jobs = {
  extract: createJobState('extract'),
  import: createJobState('import'),
}

function appendLog(jobType, line) {
  const job = jobs[jobType]
  if (!job) return
  const text = String(line || '').replace(/\r/g, '')
  for (const part of text.split('\n')) {
    if (!part) continue
    if (part.startsWith('__SUMMARY__ ')) {
      try {
        job.lastSummary = JSON.parse(part.slice('__SUMMARY__ '.length))
      } catch {
        // ignore malformed summary lines and keep normal logs flowing
      }
      continue
    }
    job.logBuffer.push(`[${new Date().toISOString()}] ${part}`)
  }
  if (job.logBuffer.length > 1000) {
    job.logBuffer = job.logBuffer.slice(-1000)
  }
}

function jobStatus(jobType) {
  const job = jobs[jobType]
  if (!job) return null
  return {
    running: Boolean(job.activeChild),
    pid: job.activeChild?.pid || null,
    status: job.lastStatus,
    jobType,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    lastExitCode: job.lastExitCode,
    command: job.activeCommand,
    summary: job.lastSummary,
    logs: job.logBuffer.slice(-300),
  }
}

function currentStatus() {
  return {
    running: Object.values(jobs).some((job) => Boolean(job.activeChild)),
    extract: jobStatus('extract'),
    import: jobStatus('import'),
  }
}

function boolValue(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return ['1', 'true', 'on', 'yes'].includes(value.toLowerCase())
  return fallback
}

function stringValue(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function intValue(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildArgs(config) {
  const args = [extractorScript]

  const profileUrl = stringValue(config.profileUrl, '')
  const listUrlTemplate = stringValue(
    config.listUrlTemplate,
    'https://contactossex.com/members/search?page={page}'
  )
  const pageStart = intValue(config.pageStart, 1)
  const pageEnd = intValue(config.pageEnd, pageStart)
  const maxProfiles = intValue(config.maxProfiles, 24)
  const maxPhotos = intValue(config.maxPhotos, 12)
  const maxVideos = intValue(config.maxVideos, 3)
  const delayMs = intValue(config.delayMs, 3000)
  const mediaDelayMs = intValue(config.mediaDelayMs, 250)
  const excludeUsernames = stringValue(config.excludeUsernames, '')
  const batchName = stringValue(config.batchName, '')
  const batchDir = stringValue(config.batchDir, './data/contactossex-batches')
  const roleGroup = stringValue(config.roleGroup, 'mixto')
  const effectiveBatchDir = path.join(batchDir, roleGroup)

  if (boolValue(config.manualLogin, true)) args.push('--manual-login')
  if (boolValue(config.useChrome, true)) args.push('--chrome')
  if (boolValue(config.headed, true)) args.push('--headed')
  if (boolValue(config.force, false)) args.push('--force')
  if (boolValue(config.freshSession, false)) args.push('--fresh-session')
  if (boolValue(config.overwriteAssets, false)) args.push('--overwrite-assets')
  if (!boolValue(config.batchOutput, true)) args.push('--no-batch-output')

  args.push('--list-url-template', listUrlTemplate)
  args.push('--page-start', String(pageStart))
  args.push('--page-end', String(pageEnd))
  args.push('--max-profiles', String(maxProfiles))
  args.push('--max-photos', String(maxPhotos))
  args.push('--max-videos', String(maxVideos))
  args.push('--delay-ms', String(delayMs))
  args.push('--media-delay-ms', String(mediaDelayMs))
  args.push('--batch-dir', effectiveBatchDir)
  args.push('--role-group', roleGroup)

  if (profileUrl) args.push('--profile-url', profileUrl)
  if (excludeUsernames) args.push('--exclude-usernames', excludeUsernames)
  if (batchName) args.push('--batch-name', batchName)

  return args
}

function buildChildEnv(jobType, config) {
  const env = { ...process.env }

  // Prefer the current Wrangler OAuth session over potentially stale shell vars
  // when the long-running UI server was started from an old terminal session.
  delete env.CLOUDFLARE_API_TOKEN
  delete env.CLOUDFLARE_ACCOUNT_ID
  delete env.CF_API_TOKEN
  delete env.CF_ACCOUNT_ID

  if (jobType === 'extract') {
    const loginUsername = stringValue(config.loginUsername, '')
    const loginPassword = typeof config.loginPassword === 'string' ? config.loginPassword : ''
    if (loginUsername) env.CONTACTOSSEX_LOGIN_USERNAME = loginUsername
    if (loginPassword) env.CONTACTOSSEX_LOGIN_PASSWORD = loginPassword
    if (boolValue(config.saveLoginCreds, false)) env.CONTACTOSSEX_SAVE_LOGIN_CREDS = '1'
  }

  return env
}

function buildImportArgs(config) {
  const args = [importerScript]
  const manifestPath = stringValue(config.manifestPath, '')
  const onlyUsername = stringValue(config.onlyUsername, '')
  const startFromUsername = stringValue(config.startFromUsername, '')
  const onlyRoleGroup = stringValue(config.onlyRoleGroup, '')

  if (!manifestPath) {
    throw new Error('Falta manifestPath para la importación.')
  }

  args.push('--manifest', manifestPath)
  if (boolValue(config.useLocal, false)) args.push('--local')
  else args.push('--remote')
  if (boolValue(config.dryRun, true)) args.push('--dry-run')
  if (boolValue(config.skipExistingUsers, true)) args.push('--skip-existing-users')
  if (boolValue(config.keepStory, false)) args.push('--keep-story')
  if (onlyUsername) args.push('--only', onlyUsername)
  if (startFromUsername) args.push('--start-from', startFromUsername)
  if (onlyRoleGroup && onlyRoleGroup !== 'all') args.push('--only-role-group', onlyRoleGroup)

  return args
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw)
}

function respondJson(res, statusCode, value) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(value, null, 2))
}

async function serveHtml(res) {
  const html = await fs.readFile(htmlPath, 'utf8')
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(html)
}

function resolveManifestPath(inputPath) {
  const raw = stringValue(inputPath, '')
  if (!raw) {
    throw new Error('Falta manifestPath')
  }
  const absolutePath = path.resolve(repoRoot, raw)
  if (!absolutePath.startsWith(repoRoot)) {
    throw new Error('Ruta de manifest inválida')
  }
  return absolutePath
}

async function loadManifestFile(inputPath) {
  const absolutePath = resolveManifestPath(inputPath)
  const raw = JSON.parse(await fs.readFile(absolutePath, 'utf8'))
  const profiles = Array.isArray(raw) ? raw : raw?.profiles
  if (!Array.isArray(profiles)) {
    throw new Error('El manifest debe ser un array o { "profiles": [...] }')
  }
  return {
    absolutePath,
    relativePath: path.relative(repoRoot, absolutePath),
    wrapped: !Array.isArray(raw),
    raw,
    profiles,
  }
}

async function saveManifestFile(manifest) {
  const nextPayload = manifest.wrapped
    ? { ...manifest.raw, profiles: manifest.profiles }
    : manifest.profiles
  await fs.writeFile(manifest.absolutePath, JSON.stringify(nextPayload, null, 2))
}

function formatRoleLabel(role) {
  const normalized = String(role || '').trim().toLowerCase()
  if (normalized === 'mujer') return 'Mujer'
  if (normalized === 'hombre') return 'Hombre'
  if (normalized === 'pareja') return 'Pareja'
  if (normalized === 'pareja_hombres') return 'Pareja de Hombres'
  if (normalized === 'pareja_mujeres') return 'Pareja de Mujeres'
  if (normalized === 'trans') return 'Trans'
  return role || '-'
}

function mapReviewProfile(profile) {
  return {
    username: profile.username || '',
    role: profile.role || '',
    roleLabel: formatRoleLabel(profile.role),
    province: profile.province || profile.city || '',
    locality: profile.locality || '',
    followers: Number(profile.followers) || 0,
    visits: Number(profile.visits) || 0,
    premium: !!profile.premium,
    excluded: !!profile.excluded,
    photos: Array.isArray(profile.photoPaths) ? profile.photoPaths.length : 0,
    videos: Array.isArray(profile.storyVideoPaths)
      ? profile.storyVideoPaths.length
      : (profile.storyVideoPath ? 1 : 0),
    seeking: Array.isArray(profile.seeking) ? profile.seeking : [],
  }
}

async function listBatchFiles() {
  async function walk(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const items = []
    for (const entry of entries) {
      const absolutePath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        items.push(...await walk(absolutePath))
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      const stat = await fs.stat(absolutePath)
      items.push({
        name: path.relative(defaultBatchDir, absolutePath),
        path: path.relative(repoRoot, absolutePath),
        modifiedAt: stat.mtime.toISOString(),
        size: stat.size,
      })
    }
    return items
  }

  try {
    const items = await walk(defaultBatchDir)
    return items.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  } catch {
    return []
  }
}

function startProcess(jobType, argsBuilder, config) {
  const job = jobs[jobType]
  if (!job) {
    throw new Error(`Tipo de job inválido: ${jobType}`)
  }
  if (job.activeChild) {
    throw new Error(`Ya hay una ${jobType === 'import' ? 'importación' : 'extracción'} corriendo.`)
  }

  job.activeCommand = [process.execPath, ...argsBuilder(config)]
  job.logBuffer = []
  job.lastExitCode = null
  job.lastStatus = 'running'
  job.lastSummary = null
  job.startedAt = new Date().toISOString()
  job.finishedAt = null

  appendLog(jobType, `Iniciando ${jobType === 'import' ? 'importador' : 'extractor'} con ${job.activeCommand.slice(1).join(' ')}`)

  job.activeChild = spawn(process.execPath, job.activeCommand.slice(1), {
    cwd: repoRoot,
    env: buildChildEnv(jobType, config),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  job.activeChild.stdout.on('data', (chunk) => appendLog(jobType, chunk))
  job.activeChild.stderr.on('data', (chunk) => appendLog(jobType, chunk))
  job.activeChild.on('exit', (code) => {
    job.lastExitCode = code
    job.lastStatus = code === 0 ? 'completed' : 'failed'
    job.finishedAt = new Date().toISOString()
    appendLog(jobType, `${jobType === 'import' ? 'Importador' : 'Extractor'} finalizado con código ${code}`)
    job.activeChild = null
  })
}

function startExtraction(config) {
  startProcess('extract', buildArgs, config)
}

function startImport(config) {
  startProcess('import', buildImportArgs, config)
}

function stopProcess(jobType) {
  const job = jobs[jobType]
  if (!job?.activeChild) return false
  appendLog(jobType, `Deteniendo ${jobType === 'import' ? 'importación' : 'extracción'} por pedido del usuario...`)
  job.activeChild.kill('SIGTERM')
  return true
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)

    if (req.method === 'GET' && url.pathname === '/') {
      await serveHtml(res)
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/status') {
      respondJson(res, 200, currentStatus())
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/batches') {
      respondJson(res, 200, { batches: await listBatchFiles() })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/review') {
      const manifestPath = url.searchParams.get('manifestPath') || ''
      const manifest = await loadManifestFile(manifestPath)
      const profiles = manifest.profiles.map(mapReviewProfile)
      respondJson(res, 200, {
        manifestPath: manifest.relativePath,
        total: profiles.length,
        excluded: profiles.filter((profile) => profile.excluded).length,
        profiles,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/review/excluded') {
      const body = await readBody(req)
      const manifestPath = stringValue(body.manifestPath, '')
      const username = stringValue(body.username, '')
      const excluded = boolValue(body.excluded, false)
      if (!manifestPath || !username) {
        throw new Error('Faltan manifestPath o username')
      }

      const manifest = await loadManifestFile(manifestPath)
      const index = manifest.profiles.findIndex((profile) => String(profile?.username || '').toLowerCase() === username.toLowerCase())
      if (index === -1) {
        throw new Error(`No encontré ${username} en ${manifest.relativePath}`)
      }

      manifest.profiles[index] = {
        ...manifest.profiles[index],
        excluded,
      }
      await saveManifestFile(manifest)

      respondJson(res, 200, {
        ok: true,
        manifestPath: manifest.relativePath,
        profile: mapReviewProfile(manifest.profiles[index]),
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/start') {
      const body = await readBody(req)
      startExtraction(body)
      respondJson(res, 200, currentStatus())
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/import') {
      const body = await readBody(req)
      startImport(body)
      respondJson(res, 200, currentStatus())
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/stop') {
      const body = await readBody(req)
      const requestedJobType = stringValue(body.jobType, '')
      const targets = requestedJobType && requestedJobType !== 'all'
        ? [requestedJobType]
        : ['extract', 'import']
      const stopped = targets.some((jobType) => stopProcess(jobType))
      respondJson(res, 200, { stopped, ...currentStatus() })
      return
    }

    respondJson(res, 404, { error: 'Not found' })
  } catch (error) {
    respondJson(res, 500, { error: String(error?.message || error) })
  }
})

server.listen(port, () => {
  console.log(`Extractor UI disponible en http://127.0.0.1:${port}`)
})
