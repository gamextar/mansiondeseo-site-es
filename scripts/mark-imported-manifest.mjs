#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

Descripción:
  Marca usernames de uno o más manifests como ya importados, sin tocar D1/R2.
  Sirve para bootstrapear el registro local y evitar reimports futuros.

Opciones:
  --manifest <path>     Manifest a marcar (repetible)
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
const onlyRoleGroup = String(takeFlag('--only-role-group', '')).trim().toLowerCase()
const outputPath = path.resolve(process.cwd(), takeFlag('--out', '') || DEFAULT_IMPORTED_REGISTRY_PATH)

if (manifestArgs.length === 0) {
  console.error('Falta al menos un --manifest <path>.')
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
for (const manifestArg of manifestArgs) {
  const manifestPath = path.resolve(process.cwd(), manifestArg)
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
  manifests: manifestArgs.map((value) => path.resolve(process.cwd(), value)),
  onlyRoleGroup: onlyRoleGroup || null,
  scannedProfiles,
  addedNow: added,
  total: usernames.length,
  usernames,
}

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

console.log(`Registro actualizado: ${outputPath}`)
console.log(`Perfiles leidos: ${scannedProfiles}`)
console.log(`Usernames nuevos agregados: ${added}`)
console.log(`Total acumulado importados: ${usernames.length}`)
