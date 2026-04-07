#!/usr/bin/env node

import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
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
  age, birthdate, province, locality, marital_status, sexual_orientation, country, bio
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
const dryRun = hasFlag('--dry-run')
const useLocal = hasFlag('--local')
const useRemote = !useLocal || hasFlag('--remote')
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

function slugifyUsername(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20)
}

function ensureArray(value) {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return [value]
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
  if (kind === 'story') return `stories/${slug}.${ext}`
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

function resolveLocalPath(baseDir, inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(baseDir, inputPath)
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
  if (isRemoteUrl(input)) return input

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
  const premium = !!profile.premium
  const premiumUntil = premium ? (profile.premiumUntil || futureSql(365)) : null
  const lastActive = profile.lastActive || nowSql()
  const createdAt = profile.createdAt || nowSql()
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
    verified: 1,
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

  if (dryRun) {
    console.log(`\n[dry-run] ${existing ? 'update' : 'insert'} user ${username} (${userId})`)
    console.log(`  email: ${email}`)
    if (!explicitBirthdate && birthdate) console.log(`  birthdate estimada: ${birthdate}`)
    console.log(`  avatar: ${avatarUrl || '-'}`)
    console.log(`  photos: ${photoUrls.length}`)
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

  const storySource = profile.storyVideoPath || null
  if (!storySource) return { userId, username, created: !existing }

  const storyUrl = await resolveMediaReference(manifestDir, username, storySource, 'story')
  const storyCaption = profile.storyCaption || ''

  if (dryRun) {
    console.log(`  story: ${storyUrl}`)
    return { userId, username, created: !existing }
  }

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

  return { userId, username, created: !existing }
}

async function main() {
  const profiles = loadManifest(manifestPath)
  const manifestDir = path.dirname(manifestPath)
  const filtered = onlyUsername
    ? profiles.filter((profile) => String(profile.username || '').toLowerCase() === onlyUsername.toLowerCase())
    : profiles

  if (filtered.length === 0) {
    throw new Error('No hay perfiles para importar con los filtros actuales')
  }

  console.log(`Importando ${filtered.length} perfil(es) desde ${manifestPath}`)
  console.log(`Destino: ${useRemote ? 'remote' : 'local'}${dryRun ? ' (dry-run)' : ''}`)
  console.log(`DB: ${wranglerConfig.dbName}`)
  console.log(`R2: ${wranglerConfig.bucketName}`)

  ensureFakeColumn()
  ensureLocalityColumn()
  ensureBirthdateColumn()
  ensureMaritalStatusColumn()
  ensureSexualOrientationColumn()

  const results = []
  for (let index = 0; index < filtered.length; index += 1) {
    const profile = filtered[index]
    console.log(`\n[${index + 1}/${filtered.length}] ${profile.username}`)
    results.push(await upsertProfile(profile, manifestDir))
  }

  console.log(`\nListo. Procesados: ${results.length}`)
}

main().catch((error) => {
  console.error('\nImport falló:')
  console.error(error.message || error)
  process.exit(1)
})
