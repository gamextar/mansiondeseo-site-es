#!/usr/bin/env node

import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const wranglerTomlPath = path.join(repoRoot, 'wrangler.toml')
const DEFAULT_IMPORTED_EMAIL_DOMAIN = 'gamextar.com'
const DEFAULT_IMPORTED_PASSWORD = 'mansiondeseo26'
const DEFAULT_BLACKLIST_PATH = path.join(repoRoot, 'data', 'import-blacklists', 'under-review-usernames.json')
const DEFAULT_IMPORTED_REGISTRY_PATH = path.join(repoRoot, 'data', 'import-state', 'imported-usernames.json')
const CANONICAL_MEDIA_BASE = (process.env.SITE_MEDIA_BASE || process.env.VITE_SITE_MEDIA_BASE || 'https://media.mansiondeseo.com').replace(/\/+$/, '')
const LEGACY_MEDIA_BASES = [
  'https://media.unicoapps.com',
  'https://pub-c0bc1ab6fb294cc1bb2e231bb55b4afb.r2.dev',
  'https://mansion-deseo-api-production.green-silence-8594.workers.dev/api/images',
]

const rawArgs = process.argv.slice(2)

function printUsage() {
  console.log(`Uso:
  npm run import:placeholders -- --manifest ./scripts/placeholders.example.json --dry-run
  npm run import:placeholders -- --manifest ./data/placeholders.json --remote
  npm run import:placeholders -- --manifest ./data/placeholders.json --remote --only sofia.noir

Descripción:
  Importa placeholders locales a R2 + D1 usando Wrangler.

Opciones:
  --manifest <path>   JSON con perfiles a importar
  --remote            Opera contra Cloudflare remoto (default)
  --local             Usa bindings locales de wrangler
  --dry-run           No sube ni escribe; solo muestra el plan
  --only <username>   Importa solo un username
  --start-from <username>  Retoma el batch desde ese username (incluido)
  --only-role-group <group>  Importa solo un grupo: mujer | hombre | pareja | pareja_hombres | pareja_mujeres | trans
  --skip-existing-users  Salta usuarios que ya existan en Mansion Deseo
  --blacklist-file <path>  JSON/TXT con usernames a bloquear antes de importar
  --imported-file <path>  JSON/TXT con usernames ya importados; por default usa un registro local acumulativo
  --ignore-imported-registry  Ignora el registro local de ya importados para esta corrida
  --replace-story     Borra stories existentes del usuario antes de insertar la nueva (default)
  --keep-story        Conserva stories existentes
  --help              Muestra esta ayuda

Formato del manifest:
  Puede ser un array o { "profiles": [...] }

Campos soportados por perfil:
  username            requerido
  email               opcional (si falta, se genera como username@gamextar.com)
  role                requerido: hombre | mujer | pareja | pareja_hombres | pareja_mujeres | trans
  seeking             requerido: array de roles (hombre | mujer | pareja | pareja_hombres | pareja_mujeres | trans)
  interests           opcional: array
  age, birthdate, province, locality, marital_status, sexual_orientation, country, bio, visits, followers
  premium             opcional boolean
  premiumUntil        opcional string YYYY-MM-DD HH:MM:SS
  avatarPath          opcional path local o URL
  avatarCrop          opcional objeto JSON
  photoPaths          opcional array de paths locales o URLs
  storyVideoPath      opcional path local o URL
  storyCaption        opcional string
  lastActive          opcional string YYYY-MM-DD HH:MM:SS

Notas:
  - Las cuentas importadas se fuerzan como fake = 1
  - La contraseña importada por default es: mansiondeseo26
  - Si falta birthdate pero hay age, se estima una fecha de nacimiento aproximada
`)
}

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

const manifestArg = takeFlag('--manifest', null) || rawArgs.shift() || null
const onlyUsername = takeFlag('--only', '')
const startFromUsername = takeFlag('--start-from', '')
const onlyRoleGroup = takeFlag('--only-role-group', '')
const blacklistFileArg = takeFlag('--blacklist-file', '')
const importedFileArg = takeFlag('--imported-file', '')
const dryRun = hasFlag('--dry-run')
const useLocal = hasFlag('--local')
const useRemote = !useLocal || hasFlag('--remote')
const skipExistingUsers = hasFlag('--skip-existing-users')
const ignoreImportedRegistry = hasFlag('--ignore-imported-registry')
const replaceStory = !hasFlag('--keep-story')

if (!manifestArg) {
  console.error('Falta --manifest <path>.')
  printUsage()
  process.exit(1)
}

const manifestPath = path.resolve(process.cwd(), manifestArg)

if (!existsSync(manifestPath)) {
  console.error(`No existe el manifest: ${manifestPath}`)
  process.exit(1)
}

if (!existsSync(wranglerTomlPath)) {
  console.error(`No existe wrangler.toml en ${wranglerTomlPath}`)
  process.exit(1)
}

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

if (!wranglerConfig.bucketName || !wranglerConfig.dbName || !wranglerConfig.publicUrl) {
  console.error('No pude leer bucket/database/publicUrl desde wrangler.toml')
  process.exit(1)
}

function loadManifest(filePath) {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8'))
  const profiles = Array.isArray(parsed) ? parsed : parsed?.profiles
  if (!Array.isArray(profiles)) {
    throw new Error('El manifest debe ser un array o { "profiles": [...] }')
  }
  return profiles
}

function loadUsernameBlacklist(filePath) {
  if (!filePath || !existsSync(filePath)) {
    return new Set()
  }

  const raw = readFileSync(filePath, 'utf8')
  const trimmed = raw.trim()
  if (!trimmed) return new Set()

  let usernames = []
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      usernames = parsed
    } else if (Array.isArray(parsed?.usernames)) {
      usernames = parsed.usernames
    } else if (Array.isArray(parsed?.blacklist)) {
      usernames = parsed.blacklist
    } else {
      throw new Error(`Formato de blacklist inválido en ${filePath}`)
    }
  } else {
    usernames = trimmed.split(/\r?\n/g)
  }

  return new Set(
    usernames
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
  )
}

function loadUsernameRegistry(filePath) {
  return loadUsernameBlacklist(filePath)
}

function saveUsernameRegistry(filePath, usernames, metadata = {}) {
  const payload = {
    updatedAt: new Date().toISOString(),
    mode: 'incremental',
    total: usernames.length,
    usernames,
    ...metadata,
  }

  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function slugifyUsername(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20)
}

function roleToGroup(role) {
  const normalized = String(role || '').trim().toLowerCase()
  if (normalized === 'mujer') return 'mujer'
  if (normalized === 'hombre') return 'hombre'
  if (normalized === 'pareja') return 'pareja'
  if (normalized === 'pareja_hombres') return 'pareja_hombres'
  if (normalized === 'pareja_mujeres') return 'pareja_mujeres'
  if (normalized === 'trans') return 'trans'
  return ''
}

function ensureArray(value) {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return [value]
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key)
}

function sql(value) {
  if (value == null) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  return `'${String(value).replace(/'/g, "''")}'`
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function futureSql(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256')
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

function extFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, '')
  return ext || 'bin'
}

function sanitizeKeySegment(input, fallback = 'media') {
  return String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || fallback
}

function stableProfileMediaKey(username, filePath, kind, index = 0) {
  const ext = extFromPath(filePath)
  const slug = sanitizeKeySegment(username, 'user')
  if (kind === 'story') return `profiles/${slug}/stories/story-${String(index + 1).padStart(2, '0')}.${ext}`
  if (kind === 'avatar') return `profiles/${slug}/avatar.${ext}`
  return `profiles/${slug}/photo-${String(index + 1).padStart(2, '0')}.${ext}`
}

function guessContentType(filePath) {
  const ext = extFromPath(filePath)
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'mp4':
      return 'video/mp4'
    case 'mov':
      return 'video/quicktime'
    case 'webm':
      return 'video/webm'
    case 'm4v':
      return 'video/x-m4v'
    default:
      return ''
  }
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(String(value || ''))
}

function canonicalizeRemoteMediaUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return raw
  for (const base of LEGACY_MEDIA_BASES) {
    if (raw === base) return CANONICAL_MEDIA_BASE
    if (raw.startsWith(`${base}/`)) {
      return `${CANONICAL_MEDIA_BASE}/${raw.slice(base.length + 1)}`
    }
  }
  return raw
}

function resolveLocalPath(baseDir, inputPath) {
  if (path.isAbsolute(inputPath)) return inputPath

  const inferLegacyRoleGroup = () => {
    const normalizedBase = String(baseDir || '').replace(/\\/g, '/')
    const batchMatch = normalizedBase.match(/\/data\/contactossex-batches\/([^/]+)(?:\/|$)/)
    if (batchMatch?.[1]) return batchMatch[1]
    const manifestMatch = normalizedBase.match(/\/data\/contactossex-placeholders(?:\/([^/.]+)\.json)?$/)
    if (manifestMatch?.[1]) return manifestMatch[1]
    return null
  }

  const candidates = [
    path.resolve(baseDir, inputPath),
  ]

  const normalized = String(inputPath || '').replace(/\\/g, '/')
  if (normalized.startsWith('data/') || normalized.startsWith('./data/')) {
    candidates.push(path.resolve(repoRoot, normalized.replace(/^\.\//, '')))
  }

  const stripped = normalized.replace(/^(\.\.\/)+/, '')
  if (stripped && stripped !== normalized) {
    candidates.push(path.resolve(repoRoot, 'data', stripped))
  }

  const legacyRoleGroup = inferLegacyRoleGroup()
  if (legacyRoleGroup && normalized.startsWith('contactossex-assets/')) {
    const subPath = normalized.replace(/^contactossex-assets\//, '')
    candidates.push(path.resolve(repoRoot, 'data', 'contactossex-assets', legacyRoleGroup, subPath))
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  return candidates[0]
}

function runWrangler(args, { json = false } = {}) {
  const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const result = spawnSync(npxBin, ['wrangler', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    const details = result.stderr?.trim() || result.stdout?.trim() || 'Wrangler command failed'
    throw new Error(details)
  }

  if (!json) return result.stdout

  try {
    return JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(`No pude parsear JSON de Wrangler: ${result.stdout || error.message}`)
  }
}

function formatRoleLabel(role) {
  switch (String(role || '').trim().toLowerCase()) {
    case 'hombre':
      return 'Hombre'
    case 'mujer':
      return 'Mujer'
    case 'pareja':
      return 'Pareja'
    case 'pareja_hombres':
      return 'Pareja de Hombres'
    case 'pareja_mujeres':
      return 'Pareja de Mujeres'
    case 'trans':
      return 'Trans'
    default:
      return role || '-'
  }
}

function formatRoleList(values) {
  if (!Array.isArray(values) || values.length === 0) return '-'
  return values.map((value) => formatRoleLabel(value)).join(', ')
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

function d1Args(sqlCommand, jsonOutput = false) {
  const args = ['d1', 'execute', wranglerConfig.dbName, '--command', sqlCommand]
  if (useRemote) args.push('--remote')
  else args.push('--local')
  if (jsonOutput) args.push('--json')
  return args
}

function queryRows(sqlCommand) {
  const payload = runWrangler(d1Args(sqlCommand, true), { json: true })
  return extractRows(payload)
}

function executeSql(sqlCommand) {
  return runWrangler(d1Args(sqlCommand, false))
}

function ensureFakeColumn() {
  if (dryRun) return
  try {
    executeSql('ALTER TABLE users ADD COLUMN fake INTEGER NOT NULL DEFAULT 0')
  } catch (error) {
    const message = String(error?.message || error || '').toLowerCase()
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw error
    }
  }

  executeSql('CREATE INDEX IF NOT EXISTS idx_users_fake ON users(fake)')
}

function ensureLocalityColumn() {
  if (dryRun) return
  try {
    executeSql('ALTER TABLE users ADD COLUMN locality TEXT')
  } catch (error) {
    const message = String(error?.message || error || '').toLowerCase()
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw error
    }
  }
}

function ensureBirthdateColumn() {
  if (dryRun) return
  try {
    executeSql('ALTER TABLE users ADD COLUMN birthdate TEXT')
  } catch (error) {
    const message = String(error?.message || error || '').toLowerCase()
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw error
    }
  }
}

function ensureMaritalStatusColumn() {
  if (dryRun) return
  try {
    executeSql('ALTER TABLE users ADD COLUMN marital_status TEXT')
  } catch (error) {
    const message = String(error?.message || error || '').toLowerCase()
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw error
    }
  }
}

function ensureSexualOrientationColumn() {
  if (dryRun) return
  try {
    executeSql('ALTER TABLE users ADD COLUMN sexual_orientation TEXT')
  } catch (error) {
    const message = String(error?.message || error || '').toLowerCase()
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw error
    }
  }
}

function ensureProfileStatsTable() {
  if (dryRun) return
  executeSql(`
    CREATE TABLE IF NOT EXISTS profile_stats (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      visits_total INTEGER NOT NULL DEFAULT 0,
      followers_total INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  try {
    executeSql('ALTER TABLE profile_stats ADD COLUMN followers_total INTEGER NOT NULL DEFAULT 0')
  } catch (error) {
    const message = String(error?.message || error || '').toLowerCase()
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw error
    }
  }
  executeSql('CREATE INDEX IF NOT EXISTS idx_profile_stats_visits_total ON profile_stats(visits_total DESC, updated_at DESC)')
  executeSql('CREATE INDEX IF NOT EXISTS idx_profile_stats_followers_total ON profile_stats(followers_total DESC, updated_at DESC)')
}

function normalizeBirthdate(value) {
  const raw = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ''
  const [yearStr, monthStr, dayStr] = raw.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return ''
  }
  return raw
}

function calculateAgeFromBirthdate(birthdate) {
  const normalized = normalizeBirthdate(birthdate)
  if (!normalized) return null
  const [yearStr, monthStr, dayStr] = normalized.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  const now = new Date()
  let age = now.getUTCFullYear() - year
  if ((now.getUTCMonth() + 1) < month || ((now.getUTCMonth() + 1) === month && now.getUTCDate() < day)) {
    age -= 1
  }
  return age
}

function estimateBirthdateFromAge(ageValue) {
  const age = Number(ageValue)
  if (!Number.isFinite(age) || age <= 0) return ''
  const now = new Date()
  const year = now.getUTCFullYear() - Math.floor(age)
  const month = now.getUTCMonth() + 1
  const day = now.getUTCDate()
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function uploadToR2(key, filePath) {
  const args = ['r2', 'object', 'put', `${wranglerConfig.bucketName}/${key}`, '--file', filePath]
  if (useRemote) args.push('--remote')
  else args.push('--local')
  const contentType = guessContentType(filePath)
  if (contentType) args.push('--content-type', contentType)
  runWrangler(args)
  return `${wranglerConfig.publicUrl}/${key}`
}

async function resolveMediaReference(baseDir, username, input, kind, index = 0) {
  if (!input) return null
  if (isRemoteUrl(input)) return canonicalizeRemoteMediaUrl(input)

  const absolutePath = resolveLocalPath(baseDir, input)
  if (!existsSync(absolutePath)) {
    throw new Error(`No existe archivo: ${absolutePath}`)
  }

  const key = stableProfileMediaKey(username, absolutePath, kind, index)

  if (dryRun) {
    return `${wranglerConfig.publicUrl}/${key}`
  }

  return uploadToR2(key, absolutePath)
}

function validateProfile(profile) {
  if (!profile?.username) throw new Error('Cada perfil necesita username')
  if (!profile?.role) throw new Error(`Falta role en ${profile.username}`)

  const validRoles = new Set(['hombre', 'mujer', 'pareja', 'pareja_hombres', 'pareja_mujeres', 'trans'])
  const validSeekingRoles = new Set(['hombre', 'mujer', 'pareja', 'pareja_hombres', 'pareja_mujeres', 'trans'])
  if (!validRoles.has(profile.role)) {
    throw new Error(`role inválido en ${profile.username}: ${profile.role}`)
  }

  const seeking = ensureArray(profile.seeking)
  if (seeking.length === 0 || seeking.some((value) => !validSeekingRoles.has(value))) {
    throw new Error(`seeking inválido en ${profile.username}`)
  }

  const messageBlockRoles = ensureArray(profile.message_block_roles || profile.messageBlockRoles)
  if (messageBlockRoles.some((value) => !validSeekingRoles.has(value))) {
    throw new Error(`message_block_roles inválido en ${profile.username}`)
  }
}

async function upsertProfile(profile, manifestDir) {
  validateProfile(profile)

  const username = String(profile.username).trim()
  const normalizedUsername = slugifyUsername(username)
  const email = String(profile.email || `${normalizedUsername}@${DEFAULT_IMPORTED_EMAIL_DOMAIN}`).toLowerCase()
  const passwordHash = hashPassword(profile.password || DEFAULT_IMPORTED_PASSWORD)
  const existing = dryRun
    ? null
    : (queryRows(
        `SELECT id, email, username FROM users WHERE email = ${sql(email)} OR LOWER(username) = LOWER(${sql(username)}) LIMIT 1`
      )[0] || null)
  const existingStats = existing
    ? (queryRows(
        `SELECT visits_total, followers_total FROM profile_stats WHERE user_id = ${sql(existing.id)} LIMIT 1`
      )[0] || null)
    : null

  if (existing && skipExistingUsers) {
    const actionLabel = dryRun ? '[dry-run] saltando existente' : 'Saltando existente'
    console.log(`\n${actionLabel} user ${username} (${existing.id})`)
    console.log(`  email: ${existing.email || email}`)
    return { userId: existing.id, username, created: false, updated: false, skipped: true, skippedExisting: true, storyImported: false }
  }

  const userId = existing?.id || profile.id || randomUUID()

  const uploadedAvatar = await resolveMediaReference(manifestDir, username, profile.avatarPath || null, 'avatar')
  const uploadedPhotos = []
  for (const [index, photoPath] of ensureArray(profile.photoPaths).entries()) {
    uploadedPhotos.push(await resolveMediaReference(manifestDir, username, photoPath, 'gallery', index))
  }

  let avatarUrl = uploadedAvatar || ''
  let photoUrls = [...uploadedPhotos]
  if (!avatarUrl && photoUrls.length > 0) {
    avatarUrl = photoUrls[0]
    photoUrls = photoUrls.slice(1)
  }

  const interests = ensureArray(profile.interests)
  const seeking = ensureArray(profile.seeking)
  const messageBlockRoles = ensureArray(profile.message_block_roles || profile.messageBlockRoles)
  const premium = !!profile.premium
  const premiumUntil = premium ? (profile.premiumUntil || futureSql(365)) : null
  const lastActive = profile.lastActive || nowSql()
  const createdAt = profile.createdAt || nowSql()
  const importedVisits = Math.max(0, Number(profile.visits) || 0)
  const importedFollowers = Math.max(0, Number(profile.followers) || 0)
  const visitsProvided = hasOwn(profile, 'visits')
  const followersProvided = hasOwn(profile, 'followers')
  const visitsTotal = visitsProvided ? importedVisits : Math.max(0, Number(existingStats?.visits_total) || 0)
  const followersTotal = followersProvided ? importedFollowers : Math.max(0, Number(existingStats?.followers_total) || 0)
  const avatarCrop = profile.avatarCrop ? JSON.stringify(profile.avatarCrop) : null
  const explicitBirthdate = normalizeBirthdate(profile.birthdate || '')
  const derivedBirthdate = !explicitBirthdate ? estimateBirthdateFromAge(profile.age) : ''
  const birthdate = explicitBirthdate || derivedBirthdate
  const age = Number.isFinite(calculateAgeFromBirthdate(birthdate))
    ? calculateAgeFromBirthdate(birthdate)
    : (profile.age ?? null)

  const baseFields = {
    email,
    password_hash: passwordHash,
    username,
    role: profile.role,
    seeking: JSON.stringify(seeking),
    message_block_roles: JSON.stringify(messageBlockRoles),
    interests: JSON.stringify(interests),
    age,
    birthdate: birthdate || null,
    city: profile.province || profile.city || '',
    locality: profile.locality || '',
    marital_status: profile.marital_status || profile.maritalStatus || '',
    sexual_orientation: profile.sexual_orientation || profile.sexualOrientation || '',
    country: profile.country || 'AR',
    bio: profile.bio || '',
    status: 'verified',
    avatar_url: avatarUrl || null,
    avatar_crop: avatarCrop,
    photos: JSON.stringify(photoUrls),
    verified: 0,
    online: 0,
    premium: premium ? 1 : 0,
    premium_until: premiumUntil,
    ghost_mode: profile.ghostMode ? 1 : 0,
    fake: 1,
    coins: Number.isFinite(Number(profile.coins)) ? Number(profile.coins) : 0,
    is_admin: profile.isAdmin ? 1 : 0,
    last_active: lastActive,
    created_at: createdAt,
  }

  const columns = Object.keys(baseFields)
  const storySources = ensureArray(profile.storyVideoPaths)
  if (storySources.length === 0 && profile.storyVideoPath) {
    storySources.push(profile.storyVideoPath)
  }
  const storySource = storySources[0] || null

  if (dryRun) {
    console.log(`\n[dry-run] ${existing ? 'update' : 'insert'} user ${username} (${userId})`)
    console.log(`  email: ${email}`)
    if (!explicitBirthdate && birthdate) console.log(`  birthdate estimada: ${birthdate}`)
    console.log(`  rol: ${formatRoleLabel(profile.role)}`)
    console.log(`  buscando: ${formatRoleList(seeking)}`)
    console.log(`  ubicación: ${[baseFields.locality, baseFields.city].filter(Boolean).join(', ') || '-'}`)
    console.log(`  premium: ${premium ? 'sí' : 'no'}`)
    console.log(`  fake: sí`)
    console.log(`  avatar: ${avatarUrl || '-'}`)
    console.log(`  photos: ${photoUrls.length}`)
    console.log(`  videos en manifest: ${storySources.length}`)
    console.log(`  seguidores: ${followersTotal}`)
    console.log(`  visitas: ${visitsTotal}`)
    const baseResult = { userId, username, created: !existing, updated: !!existing, skipped: false, skippedExisting: false, storyImported: false }
    if (!storySource) return baseResult
    const storyUrl = await resolveMediaReference(manifestDir, username, storySource, 'story')
    console.log(`  story: ${storyUrl}`)
    if (storySources.length > 1) {
      console.log(`  videos extra no importados hoy: ${storySources.length - 1}`)
    }
    return { ...baseResult, storyImported: !!storyUrl }
  } else if (existing) {
    const updates = columns.map((column) => `${column} = ${sql(baseFields[column])}`).join(',\n      ')
    executeSql(`
      UPDATE users
      SET ${updates}
      WHERE id = ${sql(userId)}
    `)
    console.log(`Actualizado user ${username} (${userId})`)
  } else {
    executeSql(`
      INSERT INTO users (
        id,
        ${columns.join(',\n        ')}
      ) VALUES (
        ${sql(userId)},
        ${columns.map((column) => sql(baseFields[column])).join(',\n        ')}
      )
    `)
    console.log(`Creado user ${username} (${userId})`)
  }

  executeSql(`
    INSERT INTO profile_stats (user_id, visits_total, followers_total, updated_at)
    VALUES (${sql(userId)}, ${sql(visitsTotal)}, ${sql(followersTotal)}, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      visits_total = ${sql(visitsTotal)},
      followers_total = ${sql(followersTotal)},
      updated_at = datetime('now')
  `)
  if (followersTotal > 0) {
    console.log(`  seguidores importados: ${followersTotal}`)
  }
  if (visitsTotal > 0) {
    console.log(`  visitas importadas: ${visitsTotal}`)
  }

  if (!storySource) return { userId, username, created: !existing, updated: !!existing, skipped: false, skippedExisting: false, storyImported: false }

  const storyUrl = await resolveMediaReference(manifestDir, username, storySource, 'story')
  const storyCaption = profile.storyCaption || ''

  if (replaceStory) {
    executeSql(`DELETE FROM stories WHERE user_id = ${sql(userId)}`)
  }

  executeSql(`
    INSERT INTO stories (id, user_id, video_url, caption, active, created_at)
    VALUES (
      ${sql(randomUUID())},
      ${sql(userId)},
      ${sql(storyUrl)},
      ${sql(storyCaption)},
      1,
      ${sql(profile.storyCreatedAt || nowSql())}
    )
  `)
  console.log(`  story importada para ${username}`)

  return { userId, username, created: !existing, updated: !!existing, skipped: false, skippedExisting: false, storyImported: true }
}

async function main() {
  const profiles = loadManifest(manifestPath)
  const manifestDir = path.dirname(manifestPath)
  const normalizedRoleGroup = String(onlyRoleGroup || '').trim().toLowerCase()
  const blacklistPath = blacklistFileArg
    ? path.resolve(process.cwd(), blacklistFileArg)
    : (existsSync(DEFAULT_BLACKLIST_PATH) ? DEFAULT_BLACKLIST_PATH : '')
  const usernameBlacklist = loadUsernameBlacklist(blacklistPath)
  const importedRegistryPath = ignoreImportedRegistry
    ? ''
    : path.resolve(process.cwd(), importedFileArg || DEFAULT_IMPORTED_REGISTRY_PATH)
  const importedUsernames = loadUsernameRegistry(importedRegistryPath)
  let filtered = profiles.filter((profile) => {
    const normalizedUsername = String(profile?.username || '').trim().toLowerCase()
    if (profile?.excluded) {
      return false
    }
    if (onlyUsername && String(profile.username || '').toLowerCase() !== onlyUsername.toLowerCase()) {
      return false
    }
    if (normalizedRoleGroup && roleToGroup(profile.role) !== normalizedRoleGroup) {
      return false
    }
    if (usernameBlacklist.has(normalizedUsername)) {
      return false
    }
    if (importedUsernames.has(normalizedUsername)) {
      return false
    }
    return true
  })

  if (startFromUsername) {
    const normalizedStart = String(startFromUsername).toLowerCase()
    const startIndex = filtered.findIndex((profile) => String(profile?.username || '').toLowerCase() === normalizedStart)
    if (startIndex === -1) {
      throw new Error(`No encontré start-from=${startFromUsername} dentro del manifest filtrado`)
    }
    filtered = filtered.slice(startIndex)
  }

  if (filtered.length === 0) {
    throw new Error('No hay perfiles para importar con los filtros actuales')
  }

  console.log(`Importando ${filtered.length} perfil(es) desde ${manifestPath}`)
  console.log(`Destino: ${useRemote ? 'remote' : 'local'}${dryRun ? ' (dry-run)' : ''}`)
  console.log(`DB: ${wranglerConfig.dbName}`)
  console.log(`R2: ${wranglerConfig.bucketName}`)
  if (blacklistPath) {
    console.log(`Blacklist: ${blacklistPath} (${usernameBlacklist.size} usernames)`)
  }
  if (importedRegistryPath) {
    console.log(`Registro ya importados: ${importedRegistryPath} (${importedUsernames.size} usernames)`)
  }
  if (startFromUsername) {
    console.log(`Retomando desde: ${startFromUsername}`)
  }

  ensureFakeColumn()
  ensureLocalityColumn()
  ensureBirthdateColumn()
  ensureMaritalStatusColumn()
  ensureSexualOrientationColumn()
  ensureProfileStatsTable()

  const results = []
  for (let index = 0; index < filtered.length; index += 1) {
    const profile = filtered[index]
    console.log(`\n[${index + 1}/${filtered.length}] ${profile.username}`)
    const result = await upsertProfile(profile, manifestDir)
    results.push(result)

    if (!dryRun && importedRegistryPath && !result.skipped) {
      importedUsernames.add(String(result.username || '').trim().toLowerCase())
      saveUsernameRegistry(importedRegistryPath, [...importedUsernames].sort((a, b) =>
        a.localeCompare(b, 'es', { sensitivity: 'base' })
      ), {
        source: 'import-placeholders',
        manifestPath,
      })
    }
  }

  const summary = {
    type: 'import',
    manifestPath,
    blacklistPath: blacklistPath || null,
    blacklistedUsernames: usernameBlacklist.size,
    importedRegistryPath: importedRegistryPath || null,
    importedRegistryUsernames: importedUsernames.size,
    processedProfiles: results.length,
    createdProfiles: results.filter((item) => item.created).length,
    updatedProfiles: results.filter((item) => item.updated).length,
    skippedProfiles: results.filter((item) => item.skipped).length,
    skippedExistingProfiles: results.filter((item) => item.skippedExisting).length,
    importedStories: results.filter((item) => item.storyImported).length,
    startedFrom: startFromUsername || null,
    dryRun,
    remote: useRemote,
  }
  console.log(`__SUMMARY__ ${JSON.stringify(summary)}`)
  console.log(`\nListo. Procesados: ${results.length}`)
}

main().catch((error) => {
  console.error('\nImport falló:')
  console.error(error.message || error)
  process.exit(1)
})
