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
const htmlPath = path.join(__dirname, 'extractor-ui.html')
const port = Number.parseInt(process.env.EXTRACTOR_UI_PORT || '4318', 10)

let activeChild = null
let activeCommand = []
let logBuffer = []
let lastExitCode = null
let lastStatus = 'idle'
let startedAt = null
let finishedAt = null

function appendLog(line) {
  const text = String(line || '').replace(/\r/g, '')
  for (const part of text.split('\n')) {
    if (!part) continue
    logBuffer.push(`[${new Date().toISOString()}] ${part}`)
  }
  if (logBuffer.length > 1000) {
    logBuffer = logBuffer.slice(-1000)
  }
}

function currentStatus() {
  return {
    running: Boolean(activeChild),
    pid: activeChild?.pid || null,
    status: lastStatus,
    startedAt,
    finishedAt,
    lastExitCode,
    command: activeCommand,
    logs: logBuffer.slice(-300),
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
  const delayMs = intValue(config.delayMs, 10000)
  const mediaDelayMs = intValue(config.mediaDelayMs, 750)
  const excludeUsernames = stringValue(config.excludeUsernames, '')

  if (boolValue(config.manualLogin, true)) args.push('--manual-login')
  if (boolValue(config.useChrome, true)) args.push('--chrome')
  if (boolValue(config.headed, true)) args.push('--headed')
  if (boolValue(config.force, false)) args.push('--force')
  if (boolValue(config.freshSession, false)) args.push('--fresh-session')
  if (boolValue(config.overwriteAssets, false)) args.push('--overwrite-assets')

  args.push('--list-url-template', listUrlTemplate)
  args.push('--page-start', String(pageStart))
  args.push('--page-end', String(pageEnd))
  args.push('--max-profiles', String(maxProfiles))
  args.push('--max-photos', String(maxPhotos))
  args.push('--max-videos', String(maxVideos))
  args.push('--delay-ms', String(delayMs))
  args.push('--media-delay-ms', String(mediaDelayMs))

  if (profileUrl) args.push('--profile-url', profileUrl)
  if (excludeUsernames) args.push('--exclude-usernames', excludeUsernames)

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

function startExtraction(config) {
  if (activeChild) {
    throw new Error('Ya hay una extracción corriendo.')
  }

  activeCommand = [process.execPath, ...buildArgs(config)]
  logBuffer = []
  lastExitCode = null
  lastStatus = 'running'
  startedAt = new Date().toISOString()
  finishedAt = null

  appendLog(`Iniciando extractor con ${activeCommand.slice(1).join(' ')}`)

  activeChild = spawn(process.execPath, activeCommand.slice(1), {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  activeChild.stdout.on('data', (chunk) => appendLog(chunk))
  activeChild.stderr.on('data', (chunk) => appendLog(chunk))
  activeChild.on('exit', (code) => {
    lastExitCode = code
    lastStatus = code === 0 ? 'completed' : 'failed'
    finishedAt = new Date().toISOString()
    appendLog(`Extractor finalizado con código ${code}`)
    activeChild = null
  })
}

function stopExtraction() {
  if (!activeChild) return false
  appendLog('Deteniendo extracción por pedido del usuario...')
  activeChild.kill('SIGTERM')
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

    if (req.method === 'POST' && url.pathname === '/api/start') {
      const body = await readBody(req)
      startExtraction(body)
      respondJson(res, 200, currentStatus())
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/stop') {
      const stopped = stopExtraction()
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
