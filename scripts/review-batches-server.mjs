#!/usr/bin/env node

import http from 'node:http'
import fs from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const htmlPath = path.join(__dirname, 'review-batches.html')
const defaultBatchDir = path.join(repoRoot, 'data', 'contactossex-batches')
const port = Number.parseInt(process.env.REVIEW_UI_PORT || '4319', 10)

function stringValue(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
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

function mimeTypeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mov':
      return 'video/quicktime'
    default:
      return 'application/octet-stream'
  }
}

function ensureInsideRoot(filePath, rootPath = repoRoot) {
  const resolved = path.resolve(filePath)
  return resolved.startsWith(rootPath + path.sep) || resolved === rootPath
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

function formatRoleList(values) {
  if (!Array.isArray(values) || values.length === 0) return []
  return values.map((value) => formatRoleLabel(value))
}

function resolveManifestPath(inputPath) {
  const raw = stringValue(inputPath, '')
  if (!raw) throw new Error('Falta manifestPath')
  const absolutePath = path.resolve(repoRoot, raw)
  if (!ensureInsideRoot(absolutePath)) {
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
    manifestDir: path.dirname(absolutePath),
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

function resolveLocalPath(manifestDir, inputPath) {
  if (!inputPath) return ''
  if (path.isAbsolute(inputPath)) return inputPath

  const candidates = [path.resolve(manifestDir, inputPath)]
  const normalized = String(inputPath).replace(/\\/g, '/')

  if (normalized.startsWith('data/') || normalized.startsWith('./data/')) {
    candidates.push(path.resolve(repoRoot, normalized.replace(/^\.\//, '')))
  }

  const stripped = normalized.replace(/^(\.\.\/)+/, '')
  if (stripped && stripped !== normalized) {
    candidates.push(path.resolve(repoRoot, 'data', stripped))
  }

  const batchMatch = String(manifestDir).replace(/\\/g, '/').match(/\/data\/contactossex-batches\/([^/]+)(?:\/|$)/)
  const roleGroup = batchMatch?.[1] || null
  if (roleGroup && normalized.startsWith('contactossex-assets/')) {
    const subPath = normalized.replace(/^contactossex-assets\//, '')
    candidates.push(path.resolve(repoRoot, 'data', 'contactossex-assets', roleGroup, subPath))
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  return candidates[0]
}

function toMediaUrl(absolutePath) {
  if (!absolutePath || !existsSync(absolutePath) || !ensureInsideRoot(absolutePath)) return ''
  return `/media?path=${encodeURIComponent(path.relative(repoRoot, absolutePath))}`
}

function mapReviewProfile(profile, manifestDir) {
  const avatarAbsolute = resolveLocalPath(manifestDir, profile.avatarPath || '')
  const photoPaths = Array.isArray(profile.photoPaths) ? profile.photoPaths : []
  const storyVideoPaths = Array.isArray(profile.storyVideoPaths)
    ? profile.storyVideoPaths
    : (profile.storyVideoPath ? [profile.storyVideoPath] : [])

  const previewPhotos = photoPaths
    .slice(0, 3)
    .map((value) => toMediaUrl(resolveLocalPath(manifestDir, value)))
    .filter(Boolean)

  const previewVideos = storyVideoPaths
    .slice(0, 1)
    .map((value) => toMediaUrl(resolveLocalPath(manifestDir, value)))
    .filter(Boolean)

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
    bio: String(profile.bio || ''),
    seeking: formatRoleList(profile.seeking),
    messageBlockRoles: formatRoleList(profile.message_block_roles || profile.messageBlockRoles),
    photos: photoPaths.length,
    videos: storyVideoPaths.length,
    avatarUrl: toMediaUrl(avatarAbsolute),
    previewPhotos,
    previewVideos,
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)

    if (req.method === 'GET' && url.pathname === '/') {
      await serveHtml(res)
      return
    }

    if (req.method === 'GET' && url.pathname === '/media') {
      const relativePath = stringValue(url.searchParams.get('path'), '')
      if (!relativePath) {
        respondJson(res, 400, { error: 'Falta path' })
        return
      }
      const absolutePath = path.resolve(repoRoot, relativePath)
      if (!ensureInsideRoot(absolutePath, path.join(repoRoot, 'data')) || !existsSync(absolutePath)) {
        respondJson(res, 404, { error: 'Media no encontrada' })
        return
      }

      res.writeHead(200, {
        'Content-Type': mimeTypeForFile(absolutePath),
        'Cache-Control': 'no-store',
      })
      createReadStream(absolutePath).pipe(res)
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/batches') {
      respondJson(res, 200, { batches: await listBatchFiles() })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/review') {
      const manifestPath = url.searchParams.get('manifestPath') || ''
      const manifest = await loadManifestFile(manifestPath)
      const profiles = manifest.profiles.map((profile) => mapReviewProfile(profile, manifest.manifestDir))
      respondJson(res, 200, {
        manifestPath: manifest.relativePath,
        total: profiles.length,
        excluded: profiles.filter((profile) => profile.excluded).length,
        profiles,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/review/excluded') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}

      const manifestPath = stringValue(body.manifestPath, '')
      const username = stringValue(body.username, '')
      const excluded = Boolean(body.excluded)
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
        profile: mapReviewProfile(manifest.profiles[index], manifest.manifestDir),
      })
      return
    }

    respondJson(res, 404, { error: 'Not found' })
  } catch (error) {
    respondJson(res, 500, { error: String(error?.message || error) })
  }
})

server.listen(port, () => {
  console.log(`Review UI disponible en http://127.0.0.1:${port}`)
})
