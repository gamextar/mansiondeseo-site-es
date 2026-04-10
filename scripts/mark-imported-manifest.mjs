#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const DEFAULT_IMPORTED_REGISTRY_PATH = path.join(repoRoot, 'data', 'import-state', 'imported-usernames.json')

function printUsage() {
  console.log(`Uso:
  npm run mark:imported-manifest -- --manifest data/contactossex-batches/hombre/batch-01.json
  npm run mark:imported-manifest -- --manifest data/contactossex-batches/hombre/batch-01.json --manifest data/contactossex-batches/hombre/batch-02.json
  npm run mark:imported-manifest -- --all-batches
  npm run mark:imported-manifest -- --all-batches --batch-dir data/contactossex-batches/hombre

Descripción:
  Marca usernames de uno o más manifests como ya importados, sin tocar D1/R2.
  Sirve para bootstrapear el registro local y evitar reimports futuros.

Opciones:
  --manifest <path>     Manifest a marcar (repetible)
  --all-batches         Recorre todos los batch-*.json dentro de data/contactossex-batches
  --batch-dir <path>    Limita --all-batches a una carpeta base específica
  --out <path>          Archivo de registro de importados
  --only-role-group <group>  Filtra por grupo: mujer | hombre | pareja | pareja_hombres | pareja_mujeres | trans
  --help                Muestra esta ayuda
`)
}

const rawArgs = process.argv.slice(2)

function takeRepeatedFlag(name) {
  const values = []
  while (true) {
    const index = rawArgs.indexOf(name)
    if (index === -1) break
    const value = rawArgs[index + 1]
    rawArgs.splice(index, 2)
    if (value) values.push(value)
  }
  return values
}

function takeFlag(name, fallback = '') {
  const index = rawArgs.indexOf(name)
  if (index === -1) return fallback
  const value = rawArgs[index + 1]
  rawArgs.splice(index, 2)
  return value ?? fallback
}

if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
  printUsage()
  process.exit(0)
}

const manifestArgs = takeRepeatedFlag('--manifest')
const allBatches = rawArgs.includes('--all-batches')
if (allBatches) {
  rawArgs.splice(rawArgs.indexOf('--all-batches'), 1)
}
const batchDirArg = takeFlag('--batch-dir', '')
const onlyRoleGroup = String(takeFlag('--only-role-group', '')).trim().toLowerCase()
const outputPath = path.resolve(process.cwd(), takeFlag('--out', '') || DEFAULT_IMPORTED_REGISTRY_PATH)

function listBatchManifests(baseDir) {
  const files = []

  function walk(currentDir) {
    for (const entry of readdirSync(currentDir)) {
      const absolutePath = path.join(currentDir, entry)
      const stats = statSync(absolutePath)
      if (stats.isDirectory()) {
        walk(absolutePath)
        continue
      }
      if (/^batch-\d+\.json$/i.test(entry)) {
        files.push(absolutePath)
      }
    }
  }

  if (!existsSync(baseDir)) {
    throw new Error(`No existe batch-dir: ${baseDir}`)
  }

  walk(baseDir)
  return files.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}

const manifestPaths = allBatches
  ? listBatchManifests(path.resolve(process.cwd(), batchDirArg || path.join('data', 'contactossex-batches')))
  : manifestArgs.map((value) => path.resolve(process.cwd(), value))

if (manifestPaths.length === 0) {
  console.error('Falta al menos un --manifest <path> o usar --all-batches.')
  printUsage()
  process.exit(1)
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

function loadManifest(filePath) {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8'))
  const profiles = Array.isArray(parsed) ? parsed : parsed?.profiles
  if (!Array.isArray(profiles)) {
    throw new Error(`Manifest inválido: ${filePath}`)
  }
  return profiles
}

function loadExistingRegistry(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8').trim()
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (Array.isArray(parsed?.usernames)) return parsed.usernames
    if (Array.isArray(parsed?.blacklist)) return parsed.blacklist
    return []
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

const existingUsernames = loadExistingRegistry(outputPath)
const merged = new Set(
  existingUsernames
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
)

let added = 0
let scannedProfiles = 0
for (const manifestPath of manifestPaths) {
  if (!existsSync(manifestPath)) {
    throw new Error(`No existe el manifest: ${manifestPath}`)
  }

  const profiles = loadManifest(manifestPath)
  for (const profile of profiles) {
    if (profile?.excluded) continue
    if (onlyRoleGroup && roleToGroup(profile?.role) !== onlyRoleGroup) continue
    scannedProfiles += 1
    const username = String(profile?.username || '').trim().toLowerCase()
    if (!username || merged.has(username)) continue
    merged.add(username)
    added += 1
  }
}

const usernames = [...merged].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
const payload = {
  updatedAt: new Date().toISOString(),
  mode: 'incremental',
  source: 'mark-imported-manifest',
  manifests: manifestPaths,
  allBatches,
  batchDir: allBatches ? path.resolve(process.cwd(), batchDirArg || path.join('data', 'contactossex-batches')) : null,
  onlyRoleGroup: onlyRoleGroup || null,
  scannedProfiles,
  addedNow: added,
  total: usernames.length,
  usernames,
}

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

console.log(`Registro actualizado: ${outputPath}`)
console.log(`Manifests procesados: ${manifestPaths.length}`)
console.log(`Perfiles leidos: ${scannedProfiles}`)
console.log(`Usernames nuevos agregados: ${added}`)
console.log(`Total acumulado importados: ${usernames.length}`)
