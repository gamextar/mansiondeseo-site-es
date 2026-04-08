#!/usr/bin/env node

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { chromium } from 'playwright'

const DEFAULT_MAX_PHOTOS_PER_PROFILE = 12
const DEFAULT_MAX_VIDEOS_PER_PROFILE = 3
const MEDIA_REQUEST_TIMEOUT_MS = 15000

function printUsage() {
  console.log(`Uso:
  node scripts/extract-contactossex.mjs --manual-login --page-start 1 --page-end 1
  node scripts/extract-contactossex.mjs --page-start 22 --page-end 24 --max-profiles 12
  node scripts/extract-contactossex.mjs --profile-url https://contactossex.com/members/profile/BiCuriosa91

Descripción:
  Extrae perfiles desde contactossex.com y genera un manifest compatible con import-placeholders.

Opciones:
  --manual-login                 Abre el navegador y espera login manual antes de extraer
  --chrome                       Usa Google Chrome en vez del Chromium integrado de Playwright
  --headed                       Fuerza navegador visible
  --headless                     Fuerza navegador oculto
  --session <path>               Archivo de storage state de Playwright
  --browser-profile-dir <path>   Perfil persistente de Chromium para conservar mejor la sesión
  --state <path>                 Archivo de estado incremental
  --output <path>                Manifest JSON de salida
  --batch-dir <path>             Carpeta donde guardar manifests por corrida
  --batch-name <name>            Nombre del batch actual; si falta, se genera uno automáticamente
  --no-batch-output              Desactiva la escritura del manifest separado por batch
  --role-group <value>           Grupo destino: mujer | hombre | pareja | pareja_hombres | pareja_mujeres | trans | mixto
  --login-username <value>       Username para re-login automático
  --login-password <value>       Password para re-login automático
  --login-creds-file <path>      Archivo local donde guardar/leer credenciales
  --save-login-creds             Guarda las credenciales localmente para futuros re-logins
  --assets-dir <path>            Carpeta donde guardar fotos/videos descargados
  --list-url-template <url>      URL de listados con {page}. Default: https://contactossex.com/members/search?page={page}
  --page-start <n>               Página inicial
  --page-end <n>                 Página final
  --max-profiles <n>             Máximo de perfiles a extraer en esta corrida
  --profile-url <url>            Extrae un solo perfil
  --max-photos <n>               Máximo de fotos por perfil. Default: 12
  --max-videos <n>               Máximo de videos por perfil. Default: 3
  --exclude-usernames <csv>      Usernames a excluir del manifest/listado
  --force                        Reextrae perfiles aunque ya estén marcados en el state
  --delay-ms <n>                 Espera entre perfiles/páginas
  --media-delay-ms <n>           Espera entre descargas de fotos/videos
  --overwrite-assets             Si la carpeta local del perfil existe, la reemplaza
  --fresh-session                Ignora la sesión guardada y obliga nuevo login
  --help                         Muestra esta ayuda
`)
}

const rawArgs = process.argv.slice(2)

function takeFlag(name, fallback = null) {
  const index = rawArgs.indexOf(name)
  if (index === -1) return fallback
  const value = rawArgs[index + 1]
  rawArgs.splice(index, 2)
  return value ?? fallback
}

function hasFlag(name) {
  const index = rawArgs.indexOf(name)
  if (index === -1) return false
  rawArgs.splice(index, 1)
  return true
}

if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
  printUsage()
  process.exit(0)
}

const repoRoot = process.cwd()
const manualLogin = hasFlag('--manual-login')
const useChrome = hasFlag('--chrome')
const explicitHeadless = hasFlag('--headless')
const headed = hasFlag('--headed')
const freshSession = hasFlag('--fresh-session')
const force = hasFlag('--force')
const pageStart = Number.parseInt(takeFlag('--page-start', '1'), 10)
const pageEnd = Number.parseInt(takeFlag('--page-end', String(pageStart)), 10)
const maxProfiles = Number.parseInt(takeFlag('--max-profiles', '0'), 10)
const maxPhotos = Number.parseInt(takeFlag('--max-photos', String(DEFAULT_MAX_PHOTOS_PER_PROFILE)), 10)
const maxVideos = Number.parseInt(takeFlag('--max-videos', String(DEFAULT_MAX_VIDEOS_PER_PROFILE)), 10)
const delayMs = Number.parseInt(takeFlag('--delay-ms', '3000'), 10)
const mediaDelayMs = Number.parseInt(takeFlag('--media-delay-ms', '250'), 10)
const listUrlTemplate = takeFlag('--list-url-template', 'https://contactossex.com/members/search?page={page}')
const profileUrl = takeFlag('--profile-url', '')
const overwriteAssets = hasFlag('--overwrite-assets')
const noBatchOutput = hasFlag('--no-batch-output')
const roleGroup = slugifySegment(takeFlag('--role-group', 'mixto'), 'mixto')
const saveLoginCreds = hasFlag('--save-login-creds') || String(process.env.CONTACTOSSEX_SAVE_LOGIN_CREDS || '') === '1'
const excludedUsernames = new Set(
  String(takeFlag('--exclude-usernames', '') || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
)
const sessionPath = path.resolve(repoRoot, takeFlag('--session', `./data/contactossex-session-${roleGroup}.json`))
const browserProfileDir = path.resolve(
  repoRoot,
  takeFlag('--browser-profile-dir', `./data/contactossex-browser-profile-${roleGroup}`)
)
const statePath = path.resolve(repoRoot, takeFlag('--state', `./data/contactossex-state/${roleGroup}.json`))
const outputPath = path.resolve(repoRoot, takeFlag('--output', `./data/contactossex-placeholders/${roleGroup}.json`))
const batchDir = path.resolve(repoRoot, takeFlag('--batch-dir', `./data/contactossex-batches/${roleGroup}`))
const requestedBatchName = takeFlag('--batch-name', '')
const loginCredsPath = path.resolve(
  repoRoot,
  takeFlag('--login-creds-file', process.env.CONTACTOSSEX_LOGIN_CREDS_FILE || './data/contactossex-login.json')
)
const providedLoginUsername = takeFlag('--login-username', process.env.CONTACTOSSEX_LOGIN_USERNAME || '')
const providedLoginPassword = takeFlag('--login-password', process.env.CONTACTOSSEX_LOGIN_PASSWORD || '')
const assetsDir = path.resolve(repoRoot, takeFlag('--assets-dir', `./data/contactossex-assets/${roleGroup}`))
const headless = explicitHeadless ? true : !headed && !manualLogin
const batchOutputEnabled = !noBatchOutput

if (rawArgs.length > 0) {
  console.error(`Argumentos no reconocidos: ${rawArgs.join(' ')}`)
  printUsage()
  process.exit(1)
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function removeDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true })
}

async function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, JSON.stringify(value, null, 2))
}

async function loadLoginCredentials() {
  const username = String(providedLoginUsername || '').trim()
  const password = String(providedLoginPassword || '')

  if (username && password) {
    const creds = { username, password }
    if (saveLoginCreds) {
      await writeJson(loginCredsPath, creds)
      console.log(`Credenciales guardadas en ${loginCredsPath}`)
    }
    return creds
  }

  const stored = await readJson(loginCredsPath, null)
  if (stored?.username && stored?.password) {
    return {
      username: String(stored.username).trim(),
      password: String(stored.password),
    }
  }

  return null
}

function slugifySegment(value, fallback = 'profile') {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

async function nextSequentialBatchName() {
  const fallback = 'batch-01'
  try {
    const entries = await fs.readdir(batchDir, { withFileTypes: true })
    const numbers = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name.match(/^batch-(\d+)\.json$/i))
      .filter(Boolean)
      .map((match) => Number.parseInt(match[1], 10))
      .filter(Number.isFinite)

    const next = (numbers.length ? Math.max(...numbers) : 0) + 1
    return `batch-${String(next).padStart(2, '0')}`
  } catch {
    return fallback
  }
}

async function buildBatchName() {
  if (requestedBatchName) return slugifySegment(requestedBatchName, 'batch-01')
  return nextSequentialBatchName()
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseSpanishRole(raw) {
  const value = String(raw || '').trim().toLowerCase()
  if (!value) return 'mujer'
  if (value.includes('pareja de hombres')) return 'pareja_hombres'
  if (value.includes('pareja de mujeres')) return 'pareja_mujeres'
  if (value.includes('trans')) return 'trans'
  if (value.includes('pareja')) return 'pareja'
  if (value.includes('hombre')) return 'hombre'
  if (value.includes('mujer')) return 'mujer'
  return 'mujer'
}

function normalizeRoleGroup(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'mujer') return 'mujer'
  if (normalized === 'hombre') return 'hombre'
  if (normalized === 'pareja') return 'pareja'
  if (normalized === 'pareja_hombres') return 'pareja_hombres'
  if (normalized === 'pareja_mujeres') return 'pareja_mujeres'
  if (normalized === 'trans') return 'trans'
  return 'mixto'
}

function roleToGroup(role) {
  const normalized = String(role || '').trim().toLowerCase()
  if (normalized === 'mujer') return 'mujer'
  if (normalized === 'hombre') return 'hombre'
  if (normalized === 'pareja') return 'pareja'
  if (normalized === 'pareja_hombres') return 'pareja_hombres'
  if (normalized === 'pareja_mujeres') return 'pareja_mujeres'
  if (normalized === 'trans') return 'trans'
  return 'mixto'
}

function parseSeeking(raw) {
  const exactMap = new Map([
    ['hombres', 'hombre'],
    ['mujeres', 'mujer'],
    ['crossdressers', 'trans'],
    ['trans', 'trans'],
    ['parejas', 'pareja'],
    ['parejas de hombres', 'pareja_hombres'],
    ['parejas de mujeres', 'pareja_mujeres'],
  ])

  const tokens = String(raw || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)

  const mapped = []
  for (const token of tokens) {
    const mappedValue = exactMap.get(token)
    if (mappedValue) mapped.push(mappedValue)
  }

  return [...new Set(mapped)]
}

function parseMessageBlockRoles(raw) {
  const normalized = String(raw || '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!normalized) return []
  if (normalized.includes('acepta todos los mensajes')) return []

  const exactMap = new Map([
    ['hombres', 'hombre'],
    ['mujeres', 'mujer'],
    ['crossdressers', 'trans'],
    ['trans', 'trans'],
    ['parejas', 'pareja'],
    ['parejas de hombres', 'pareja_hombres'],
    ['parejas de mujeres', 'pareja_mujeres'],
  ])

  const mapped = []
  const tokens = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  for (const token of tokens) {
    const mappedValue = exactMap.get(token)
    if (mappedValue) mapped.push(mappedValue)
  }
  return [...new Set(mapped)]
}

function parseAge(raw) {
  const match = String(raw || '').match(/(\d{1,2})/)
  return match ? Number(match[1]) : null
}

function parsePersonalInfo(raw) {
  const normalized = String(raw || '').replace(/\s+/g, ' ').trim()
  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  const mainPart = parts[0] || ''
  const extras = parts.slice(1)
  const role = parseSpanishRole(mainPart)
  const age = parseAge(mainPart)

  const orientationValues = new Set([
    'heterosexual',
    'bisexual',
    'gay',
    'lesbiana',
    'lesbico',
    'curioso/a',
    'curioso',
    'curiosa',
    'pansexual',
    'asexual',
    'demisexual',
    'queer',
  ])

  const maritalValues = new Set([
    'soltero/a',
    'soltero',
    'soltera',
    'casado/a',
    'casado',
    'casada',
    'separado/a',
    'separado',
    'separada',
    'divorciado/a',
    'divorciado',
    'divorciada',
    'viudo/a',
    'viudo',
    'viuda',
    'en pareja',
    'complicado/a',
    'complicado',
    'complicada',
    'abierto/a',
    'abierto',
    'abierta',
  ])

  let sexualOrientation = ''
  let maritalStatus = ''

  if (extras.length >= 2) {
    sexualOrientation = extras[0] || ''
    maritalStatus = extras[1] || ''
  } else if (extras.length === 1) {
    const single = extras[0]
    const key = single.toLowerCase()
    if (maritalValues.has(key)) maritalStatus = single
    else if (orientationValues.has(key)) sexualOrientation = single
    else sexualOrientation = single
  }

  return {
    role,
    age,
    sexual_orientation: sexualOrientation,
    marital_status: maritalStatus,
  }
}

function parseStats(raw) {
  const normalized = String(raw || '').replace(/\s+/g, ' ').trim()
  const [followersMatch, followingMatch, visitsMatch] = [
    normalized.match(/([\d.,]+)\s+Seguidores/i),
    normalized.match(/([\d.,]+)\s+Seguidos/i),
    normalized.match(/([\d.,]+)\s+Visitas/i),
  ]
  const parseCount = (match) => {
    const value = String(match?.[1] || '').replace(/[^\d]/g, '')
    return value ? Number(value) : 0
  }
  return {
    followers: parseCount(followersMatch),
    following: parseCount(followingMatch),
    visits: parseCount(visitsMatch),
  }
}

function pickExtension(url, contentType = '') {
  const clean = String(url || '').split('?')[0].split('#')[0]
  const ext = path.extname(clean).replace('.', '').toLowerCase()
  if (ext) return ext
  const normalizedType = String(contentType || '').toLowerCase()
  if (normalizedType.includes('jpeg')) return 'jpg'
  if (normalizedType.includes('png')) return 'png'
  if (normalizedType.includes('webp')) return 'webp'
  if (normalizedType.includes('gif')) return 'gif'
  if (normalizedType.includes('mp4')) return 'mp4'
  if (normalizedType.includes('webm')) return 'webm'
  return 'bin'
}

function absolutize(base, maybeRelative) {
  try {
    return new URL(maybeRelative, base).toString()
  } catch {
    return ''
  }
}

function unique(items) {
  return [...new Set(items.filter(Boolean))]
}

async function promptForEnter(message) {
  const rl = readline.createInterface({ input, output })
  try {
    await rl.question(`${message}\n`)
  } finally {
    rl.close()
  }
}

async function pageLooksAuthenticated(page) {
  try {
    return await page.evaluate(() => {
      const href = window.location.href || ''
      const hasMemberSignals =
        !!document.querySelector('a[href*="/members/profile/"]') ||
        !!document.querySelector('.btn-chat') ||
        !!document.querySelector('.profile-bar')
      return href.includes('/members/') || hasMemberSignals
    })
  } catch {
    return false
  }
}

async function waitForManualLogin(page, context) {
  const timeoutMs = 10 * 60 * 1000
  const startedAt = Date.now()

  if (process.stdin.isTTY) {
    await promptForEnter('Presiona Enter cuando el login esté completo...')
  } else {
    console.log('Esperando a que completes el login en la ventana del navegador...')
    console.log('Cuando quedes dentro de una página autenticada, el extractor seguirá solo.')
    while (Date.now() - startedAt < timeoutMs) {
      if (await pageLooksAuthenticated(page)) break
      await delay(1500)
    }
    if (!(await pageLooksAuthenticated(page))) {
      throw new Error('Timeout esperando el login manual. No se detectó una página autenticada.')
    }
  }

  await ensureDir(path.dirname(sessionPath))
  await context.storageState({ path: sessionPath })
  console.log(`Sesión guardada en ${sessionPath}`)
}

async function attemptAutoLogin(page, context, credentials) {
  if (!credentials?.username || !credentials?.password) return false

  console.log('Intentando login automático con credenciales guardadas...')
  await page.goto('https://contactossex.com', { waitUntil: 'domcontentloaded' })

  try {
    await page.waitForSelector('#username', { timeout: 8000 })
    await page.fill('#username', credentials.username)
    await page.fill('#password', credentials.password)
    await Promise.allSettled([
      page.waitForLoadState('domcontentloaded', { timeout: 15000 }),
      page.click('#btn-login'),
    ])

    const timeoutMs = 30000
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      if (await pageLooksAuthenticated(page)) {
        await ensureDir(path.dirname(sessionPath))
        await context.storageState({ path: sessionPath })
        console.log(`Sesión guardada en ${sessionPath}`)
        return true
      }
      await delay(1000)
    }
  } catch {
    // fall through to manual login
  }

  console.log('No se pudo completar el login automático; vuelvo a login manual.')
  return false
}

async function ensureAuthenticated(page, context) {
  const credentials = await loadLoginCredentials()
  await page.goto('https://contactossex.com', { waitUntil: 'domcontentloaded' })
  await delay(1200)
  if (!freshSession && existsSync(sessionPath)) {
    await page.goto(listUrlTemplate.replace('{page}', '1'), { waitUntil: 'domcontentloaded' })
    await delay(1200)
    if (await pageLooksAuthenticated(page)) return
  }

  if (await attemptAutoLogin(page, context, credentials)) {
    return
  }

  console.log('\nLogin manual requerido.')
  console.log('1. Inicia sesión en la ventana del navegador.')
  console.log('2. Navega a una página autenticada que muestre miembros.')
  if (process.stdin.isTTY) {
    console.log('3. Vuelve aquí y presiona Enter para continuar.')
  } else {
    console.log('3. No hace falta tocar la terminal: cuando el login termine seguirá automáticamente.')
  }
  await waitForManualLogin(page, context)
}

async function getProfileLinksFromList(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await delay(Math.max(400, delayMs))
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/members/profile/"]'))
    return [...new Set(anchors.map((a) => a.href).filter(Boolean))]
  })
}

async function scrollProfileMedia(page) {
  const maxPasses = 8
  let previousCount = -1

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const currentCount = await page.evaluate(() => {
      return document.querySelectorAll('.card-multimedia-parent').length
    })

    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })
    })
    await delay(900)

    const nextCount = await page.evaluate(() => {
      return document.querySelectorAll('.card-multimedia-parent').length
    })

    if (nextCount === currentCount && nextCount === previousCount) {
      break
    }

    previousCount = nextCount
  }

  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  })
  await delay(250)
}

async function extractProfileData(page, requestContext, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await delay(Math.max(500, delayMs))
  await scrollProfileMedia(page)

  const extracted = await page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()
    const textByHeading = (heading) => {
      const cards = Array.from(document.querySelectorAll('article.card-info-general .item'))
      const found = cards.find((item) => clean(item.querySelector('h3')?.textContent).toLowerCase() === heading.toLowerCase())
      return clean(found?.querySelector('p')?.textContent || '')
    }
    const description = clean(document.querySelector('.description-wrapper .description p')?.textContent || '')
    const username = clean(document.querySelector('.profile-bar h3 span')?.textContent || '')
    const online = !!document.querySelector('.tag-online')
    const chatButton = document.querySelector('.btn-chat')
    const mainPictureLink = document.querySelector('a[data-fancybox="gallery"][href*="/members/picture-zoom"]')
    const mainPictureStyle = document.querySelector('.main-picture')?.getAttribute('style') || ''
    const backgroundMatch = mainPictureStyle.match(/url\((["']?)(.*?)\1\)/i)
    const galleryItems = Array.from(
      document.querySelectorAll('a[href*="/members/picture-zoom"], a[href*="/members/video-zoom"]')
    ).map((anchor) => {
      const card = anchor.closest('.card-multimedia-parent, .card-multimedia, .card-multimedia-container') || anchor.parentElement || anchor
      const likesText = clean(card.querySelector('.ranking-heart span')?.textContent || '')
      const likes = Number.parseInt(likesText.replace(/[^\d]/g, ''), 10)
      const thumbImage = card.querySelector('img')?.src || ''
      const posterImage = card.querySelector('video')?.getAttribute('poster') || ''
      const style = card.querySelector('[style*="background-image"]')?.getAttribute('style') || ''
      const styleMatch = style.match(/url\((["']?)(.*?)\1\)/i)
      const iconClasses = Array.from(card.querySelectorAll('i')).map((node) => node.className.toLowerCase())
      const classSignals = Array.from(card.querySelectorAll('*'))
        .flatMap((node) => String(node.className || '').toLowerCase().split(/\s+/))
        .filter(Boolean)
      const textSignals = clean(card.textContent || '').toLowerCase()
      const hasPlaySignal =
        iconClasses.some((value) => value.includes('play') || value.includes('video')) ||
        classSignals.some((value) => value.includes('play') || value.includes('video')) ||
        textSignals.includes('video')
      return {
        href: anchor?.href || '',
        thumb: thumbImage || posterImage || styleMatch?.[2] || '',
        declaredType:
          anchor?.href?.includes('/video-zoom') || anchor?.href?.includes('/video/')
            ? 'video'
            : (card.querySelector('video') || hasPlaySignal ? 'video' : 'image'),
        likes: Number.isFinite(likes) ? likes : 0,
      }
    }).filter((item) => item.href || item.thumb)

    return {
      url: window.location.href,
      username,
      userId: chatButton?.getAttribute('data-user-id') || '',
      online,
      premium: !!document.querySelector('.stripesGold'),
      personalInfo: textByHeading('Información Personal'),
      location: textByHeading('Ubicación'),
      stats: textByHeading('Estadísticas'),
      seeking: textByHeading('Buscando'),
      messagePrivacy: textByHeading('Bloqueando'),
      bio: description,
      mainPictureHref: mainPictureLink?.href || '',
      mainPictureThumb: backgroundMatch?.[2] || '',
      galleryItems,
    }
  })

  const personalInfo = parsePersonalInfo(extracted.personalInfo)
  const stats = parseStats(extracted.stats)

  const locationParts = extracted.location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const locality = locationParts[0] || ''
  const province = locationParts[1] || ''
  const country = locationParts[2] || 'Argentina'

  const mediaRefs = []
  if (extracted.mainPictureHref || extracted.mainPictureThumb) {
    mediaRefs.push({
      zoomUrl: extracted.mainPictureHref,
      fallbackUrl: extracted.mainPictureThumb,
      kind: 'avatar',
    })
  }
  const imageGalleryItems = extracted.galleryItems
    .filter((item) => item.declaredType !== 'video')
    .slice(0, Math.max(0, maxPhotos))
  const videoGalleryItems = extracted.galleryItems
    .filter((item) => item.declaredType === 'video')
    .slice(0, Math.max(0, maxVideos))

  for (const item of [...imageGalleryItems, ...videoGalleryItems]) {
    mediaRefs.push({
      zoomUrl: item.href,
      fallbackUrl: item.thumb,
      kind: 'gallery',
      declaredType: item.declaredType || 'image',
      likes: item.likes || 0,
    })
  }

  const resolvedMedia = []
  const seenMediaUrls = new Set()
  for (const ref of mediaRefs) {
    const absoluteZoom = absolutize(extracted.url, ref.zoomUrl)
    const fallback = absolutize(extracted.url, ref.fallbackUrl)
    let finalUrl = fallback
    let mediaType = ref.declaredType === 'video' || fallback.match(/\.(mp4|webm|mov)(\?|$)/i) ? 'video' : 'image'

    if (absoluteZoom) {
      try {
        const response = await requestContext.get(absoluteZoom, { failOnStatusCode: false })
        const contentType = String(response.headers()['content-type'] || '').toLowerCase()
        if (contentType.includes('text/html')) {
          const html = await response.text()
          const sourceMatch = html.match(/<source[^>]+src=["']([^"']+)["']/i)
          const videoMatch = html.match(/<video[^>]+src=["']([^"']+)["']/i)
          const imageMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i)
          const styleMatch = html.match(/url\((["']?)(.*?)\1\)/i)
          const candidate = sourceMatch?.[1] || videoMatch?.[1] || styleMatch?.[2] || imageMatch?.[1] || fallback
          finalUrl = absolutize(absoluteZoom, candidate)
          mediaType = /(mp4|webm|mov)(\?|$)/i.test(finalUrl) ? 'video' : 'image'
        } else if (contentType.includes('video/') || contentType.includes('image/')) {
          finalUrl = absoluteZoom
          mediaType = contentType.includes('video/') ? 'video' : 'image'
        }
      } catch {
        finalUrl = fallback
      }
    }

    let chosenUrl = finalUrl || fallback
    let chosenType = mediaType

    if (
      ref.kind === 'gallery' &&
      chosenUrl &&
      fallback &&
      chosenType === 'image' &&
      seenMediaUrls.has(chosenUrl) &&
      !seenMediaUrls.has(fallback)
    ) {
      chosenUrl = fallback
      chosenType = 'image'
    }

    if (chosenUrl && !seenMediaUrls.has(chosenUrl)) {
      resolvedMedia.push({
        url: chosenUrl,
        type: chosenType,
        kind: ref.kind,
        likes: ref.likes || 0,
      })
      seenMediaUrls.add(chosenUrl)
    } else if (fallback && !seenMediaUrls.has(fallback)) {
      const fallbackType = fallback.match(/\.(mp4|webm|mov)(\?|$)/i) ? 'video' : 'image'
      resolvedMedia.push({
        url: fallback,
        type: fallbackType,
        kind: ref.kind,
        likes: ref.likes || 0,
      })
      seenMediaUrls.add(fallback)
    }
  }

  return {
    sourceUrl: extracted.url,
    userId: extracted.userId,
    username: extracted.username,
    online: extracted.online,
    premium: !!extracted.premium,
    role: personalInfo.role,
    age: personalInfo.age,
    followers: stats.followers,
    following: stats.following,
    visits: stats.visits,
    sexual_orientation: personalInfo.sexual_orientation,
    marital_status: personalInfo.marital_status,
    locality,
    province,
    country,
    seeking: parseSeeking(extracted.seeking),
    message_block_roles: parseMessageBlockRoles(extracted.messagePrivacy),
    bio: extracted.bio,
    media: resolvedMedia,
  }
}

async function downloadFile(requestContext, fileUrl, destinationPath) {
  if (existsSync(destinationPath)) return
  const response = await requestContext.get(fileUrl, {
    failOnStatusCode: true,
    timeout: MEDIA_REQUEST_TIMEOUT_MS,
  })
  const buffer = Buffer.from(await response.body())
  await ensureDir(path.dirname(destinationPath))
  await fs.writeFile(destinationPath, buffer)
  if (mediaDelayMs > 0) await delay(mediaDelayMs)
}

function fallbackExtensionForType(mediaType) {
  return mediaType === 'video' ? 'mp4' : 'webp'
}

async function inferRemoteExtension(requestContext, fileUrl, mediaType = 'image') {
  try {
    const response = await requestContext.get(fileUrl, {
      failOnStatusCode: false,
      timeout: MEDIA_REQUEST_TIMEOUT_MS,
    })
    const contentType = String(response.headers()['content-type'] || '').toLowerCase()
    const inferred = pickExtension(fileUrl, contentType)
    return inferred === 'bin' ? fallbackExtensionForType(mediaType) : inferred
  } catch (error) {
    const fallback = fallbackExtensionForType(mediaType)
    console.log(`Aviso: timeout/extensión no resuelta para ${fileUrl}; usando .${fallback}`)
    return fallback
  }
}

function manifestRelativePath(filePath) {
  return path.relative(path.dirname(outputPath), filePath)
}

function isVideoExtension(ext) {
  return ['mp4', 'webm', 'mov', 'm4v'].includes(String(ext || '').toLowerCase())
}

async function profileAssetDirHasFiles(username, fallbackId = '') {
  const usernameSlug = slugifySegment(username, fallbackId || 'user')
  const userDir = path.join(assetsDir, usernameSlug)
  if (!existsSync(userDir)) {
    return false
  }
  const entries = await fs.readdir(userDir)
  return entries.length > 0
}

async function materializeProfileAssets(profile, requestContext) {
  const usernameSlug = slugifySegment(profile.username, profile.userId || 'user')
  const userDir = path.join(assetsDir, usernameSlug)
  const userDirExists = existsSync(userDir)
  const userDirHasFiles = userDirExists ? (await fs.readdir(userDir)).length > 0 : false
  if (userDirHasFiles && !overwriteAssets) {
    return {
      skipped: true,
      userDir,
    }
  }
  if (userDirExists && overwriteAssets) {
    await removeDir(userDir)
  }
  await ensureDir(userDir)

  const avatar = profile.media.find((item) => item.kind === 'avatar') || null
  const mediaItems = profile.media.filter((item) => item.kind !== 'avatar')

  let avatarPath = ''
  if (avatar?.url) {
    try {
      const ext = await inferRemoteExtension(requestContext, avatar.url, avatar.type || 'image')
      const absolute = path.join(userDir, `avatar.${ext}`)
      await downloadFile(requestContext, avatar.url, absolute)
      avatarPath = manifestRelativePath(absolute)
    } catch (error) {
      console.log(`Aviso: no pude bajar avatar de ${profile.username}: ${error?.message || error}`)
    }
  }

  const photoPaths = []
  const photoLikes = []
  const storyVideoPaths = []
  const storyVideoLikes = []

  for (const item of mediaItems) {
    try {
      const ext = await inferRemoteExtension(requestContext, item.url, item.type || 'image')
      if (isVideoExtension(ext)) {
        if (storyVideoPaths.length >= Math.max(0, maxVideos)) continue
        const suffix = storyVideoPaths.length === 0 ? '' : `-${String(storyVideoPaths.length + 1).padStart(2, '0')}`
        const absolute = path.join(userDir, `story${suffix}.${ext}`)
        await downloadFile(requestContext, item.url, absolute)
        storyVideoPaths.push(manifestRelativePath(absolute))
        storyVideoLikes.push(Number.isFinite(Number(item.likes)) ? Number(item.likes) : 0)
        continue
      }

      if (photoPaths.length >= Math.max(0, maxPhotos)) continue
      const absolute = path.join(userDir, `photo-${String(photoPaths.length + 1).padStart(2, '0')}.${ext}`)
      await downloadFile(requestContext, item.url, absolute)
      photoPaths.push(manifestRelativePath(absolute))
      photoLikes.push(Number.isFinite(Number(item.likes)) ? Number(item.likes) : 0)
    } catch (error) {
      console.log(`Aviso: saltando media de ${profile.username}: ${item.url} (${error?.message || error})`)
    }
  }

  return {
    skipped: false,
    userDir,
    avatarPath,
    photoPaths,
    photoLikes,
    storyVideoPath: storyVideoPaths[0] || '',
    storyVideoPaths,
    storyVideoLikes,
  }
}

function toManifestProfile(profile, assets) {
  return {
    username: profile.username,
    role: profile.role,
    seeking: profile.seeking.length > 0 ? profile.seeking : ['hombre'],
    age: profile.age,
    province: profile.province,
    locality: profile.locality,
    country: profile.country === 'Argentina' ? 'AR' : profile.country,
    bio: profile.bio,
    premium: !!profile.premium,
    followers: Number.isFinite(Number(profile.followers)) ? Number(profile.followers) : 0,
    following: Number.isFinite(Number(profile.following)) ? Number(profile.following) : 0,
    visits: Number.isFinite(Number(profile.visits)) ? Number(profile.visits) : 0,
    message_block_roles: Array.isArray(profile.message_block_roles) ? profile.message_block_roles : [],
    marital_status: profile.marital_status,
    sexual_orientation: profile.sexual_orientation,
    avatarPath: assets.avatarPath || undefined,
    photoPaths: assets.photoPaths,
    photoLikes: assets.photoLikes,
    storyVideoPath: assets.storyVideoPath || undefined,
    storyVideoPaths: assets.storyVideoPaths,
    storyVideoLikes: assets.storyVideoLikes,
  }
}

function upsertManifestProfile(manifest, profile) {
  if (excludedUsernames.has(String(profile.username || '').trim().toLowerCase())) return
  const index = manifest.profiles.findIndex((item) => item.username?.toLowerCase() === profile.username?.toLowerCase())
  if (index >= 0) manifest.profiles[index] = profile
  else manifest.profiles.push(profile)
}

async function main() {
  await ensureDir(path.dirname(outputPath))
  await ensureDir(path.dirname(statePath))
  await ensureDir(assetsDir)
  await ensureDir(path.dirname(browserProfileDir))
  if (batchOutputEnabled) await ensureDir(batchDir)

  const state = await readJson(statePath, {
    processedPages: [],
    processedProfiles: {},
  })
  const manifest = await readJson(outputPath, { profiles: [] })
  const batchName = await buildBatchName()
  const batchPath = path.join(batchDir, `${batchName}.json`)
  const batchManifest = { profiles: [] }
  const selectedRoleGroup = normalizeRoleGroup(roleGroup)

  if (freshSession && existsSync(browserProfileDir)) {
    await removeDir(browserProfileDir)
  }

  const context = await chromium.launchPersistentContext(browserProfileDir, {
    channel: useChrome ? 'chrome' : undefined,
    headless,
    viewport: { width: 1440, height: 960 },
  })
  const page = context.pages()[0] || await context.newPage()

  try {
    await ensureAuthenticated(page, context)

    const urls = []
    if (profileUrl) {
      urls.push(profileUrl)
    } else {
      for (let pageNo = pageStart; pageNo <= pageEnd; pageNo += 1) {
        const listUrl = listUrlTemplate.replace('{page}', String(pageNo))
        console.log(`Leyendo listado ${listUrl}`)
        const links = await getProfileLinksFromList(page, listUrl)
        for (const link of links) {
          urls.push(link)
        }
        if (!state.processedPages.includes(pageNo)) state.processedPages.push(pageNo)
        await writeJson(statePath, state)
        if (delayMs > 0) await delay(delayMs)
      }
    }

    let processedThisRun = 0
    let skippedThisRun = 0
    let skippedMissingUsername = 0
    let skippedExcludedUsername = 0
    let skippedExistingAssets = 0
    let skippedExistingKnownProfile = 0
    let skippedRoleMismatch = 0
    for (const url of urls) {
      if (maxProfiles > 0 && processedThisRun >= maxProfiles) break
      if (!force && !overwriteAssets) {
        const knownProfile = state.processedProfiles[url]
        if (knownProfile?.username && await profileAssetDirHasFiles(knownProfile.username, knownProfile.userId || '')) {
          console.log(`Saltando perfil con carpeta existente: ${knownProfile.username} (${url})`)
          skippedThisRun += 1
          skippedExistingKnownProfile += 1
          continue
        }
      }

      console.log(`Extrayendo ${url}`)
      const profile = await extractProfileData(page, context.request, url)
      if (!profile.username) {
        console.log(`Saltado: no se pudo leer username en ${url}`)
        state.processedProfiles[url] = { skipped: true, reason: 'missing_username', at: new Date().toISOString() }
        await writeJson(statePath, state)
        skippedThisRun += 1
        skippedMissingUsername += 1
        continue
      }
      if (excludedUsernames.has(String(profile.username || '').trim().toLowerCase())) {
        console.log(`Saltando username excluido: ${profile.username}`)
        state.processedProfiles[url] = {
          username: profile.username,
          skipped: true,
          reason: 'excluded_username',
          at: new Date().toISOString(),
        }
        await writeJson(statePath, state)
        skippedThisRun += 1
        skippedExcludedUsername += 1
        continue
      }
      if (selectedRoleGroup !== 'mixto' && roleToGroup(profile.role) !== selectedRoleGroup) {
        console.log(`Saltando ${profile.username} por grupo de rol: ${profile.role} no entra en ${selectedRoleGroup}`)
        state.processedProfiles[url] = {
          username: profile.username,
          userId: profile.userId || '',
          skipped: true,
          reason: 'role_group_mismatch',
          at: new Date().toISOString(),
        }
        await writeJson(statePath, state)
        skippedThisRun += 1
        skippedRoleMismatch += 1
        continue
      }

      const assets = await materializeProfileAssets(profile, context.request)
      if (assets.skipped) {
        console.log(`Saltando assets existentes para ${profile.username}: ${assets.userDir}`)
        state.processedProfiles[url] = {
          username: profile.username,
          userId: profile.userId || '',
          skipped: true,
          reason: 'existing_assets_dir',
          at: new Date().toISOString(),
        }
        await writeJson(statePath, state)
        skippedThisRun += 1
        skippedExistingAssets += 1
        continue
      }
      const manifestProfile = toManifestProfile(profile, assets)
      upsertManifestProfile(manifest, manifestProfile)
      upsertManifestProfile(batchManifest, manifestProfile)

      state.processedProfiles[url] = {
        username: profile.username,
        userId: profile.userId || '',
        at: new Date().toISOString(),
      }

      await writeJson(outputPath, manifest)
      if (batchOutputEnabled) await writeJson(batchPath, batchManifest)
      await writeJson(statePath, state)

      processedThisRun += 1
      if (delayMs > 0) await delay(delayMs)
    }

    await context.storageState({ path: sessionPath })
    console.log(
      `__SUMMARY__ ${JSON.stringify({
        discoveredProfiles: urls.length,
        downloadedProfiles: processedThisRun,
        skippedProfiles: skippedThisRun,
        batchProfiles: batchManifest.profiles.length,
        batchManifestPath: batchOutputEnabled ? batchPath : null,
        roleGroup: selectedRoleGroup,
        skippedBreakdown: {
          existingKnownProfile: skippedExistingKnownProfile,
          existingAssetsDir: skippedExistingAssets,
          excludedUsername: skippedExcludedUsername,
          missingUsername: skippedMissingUsername,
          roleGroupMismatch: skippedRoleMismatch,
        },
      })}`
    )
    console.log(`\nListo. Manifest: ${outputPath}`)
    if (batchOutputEnabled) console.log(`Batch manifest: ${batchPath}`)
    console.log(`Assets: ${assetsDir}`)
    console.log(`Estado: ${statePath}`)
  } finally {
    await context.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
