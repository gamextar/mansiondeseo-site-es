#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const wranglerTomlPath = path.join(repoRoot, 'wrangler.toml')
const defaultOutputPath = path.join(repoRoot, 'data', 'import-blacklists', 'under-review-usernames.json')

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

function parseWranglerToml(text) {
  const dbMatch = text.match(/\[\[d1_databases\]\][\s\S]*?database_name\s*=\s*"([^"]+)"/)
  return { dbName: dbMatch?.[1] || '' }
}

function loadDbName() {
  const parsed = parseWranglerToml(readFileSync(wranglerTomlPath, 'utf8'))
  if (!parsed.dbName) {
    throw new Error('No pude leer database_name desde wrangler.toml')
  }
  return parsed.dbName
}

function runWranglerQuery(dbName, { remote, sql }) {
  const args = ['wrangler', 'd1', 'execute', dbName, remote ? '--remote' : '--local', '--command', sql, '--json']
  const result = spawnSync('npx', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    throw new Error(`Wrangler falló con código ${result.status ?? 'desconocido'}`)
  }

  return JSON.parse(result.stdout || '[]')
}

function loadExistingUsernames(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8').trim()
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value || '').trim()).filter(Boolean)
    }
    if (Array.isArray(parsed?.usernames)) {
      return parsed.usernames.map((value) => String(value || '').trim()).filter(Boolean)
    }
    if (Array.isArray(parsed?.blacklist)) {
      return parsed.blacklist.map((value) => String(value || '').trim()).filter(Boolean)
    }
    return []
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

function main() {
  const argv = process.argv.slice(2)
  const outputArg = takeFlag(argv, '--out', '')
  const useLocal = hasFlag(argv, '--local')
  const remote = !useLocal || hasFlag(argv, '--remote')
  const outputPath = path.resolve(process.cwd(), outputArg || defaultOutputPath)
  const dbName = loadDbName()

  const sql = `
    SELECT username
    FROM users
    WHERE COALESCE(account_status, 'active') = 'under_review'
    ORDER BY username COLLATE NOCASE ASC
  `.trim()

  const rows = runWranglerQuery(dbName, { remote, sql })
  const fetchedUsernames = (rows?.[0]?.results || [])
    .map((row) => String(row?.username || '').trim())
    .filter(Boolean)
  const existingUsernames = loadExistingUsernames(outputPath)
  const usernames = [...new Set([...existingUsernames, ...fetchedUsernames])].sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  )
  const addedUsernames = fetchedUsernames.filter((username) => !existingUsernames.includes(username))

  const payload = {
    generatedAt: new Date().toISOString(),
    mode: 'incremental',
    source: remote ? 'remote' : 'local',
    dbName,
    filter: "COALESCE(account_status, 'active') = 'under_review'",
    fetchedNow: fetchedUsernames.length,
    existingBeforeMerge: existingUsernames.length,
    addedNow: addedUsernames.length,
    total: usernames.length,
    usernames,
  }

  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(`Blacklist generada: ${outputPath}`)
  console.log(`Usernames leidos desde D1: ${fetchedUsernames.length}`)
  console.log(`Usernames nuevos agregados: ${addedUsernames.length}`)
  console.log(`Total acumulado blacklist: ${usernames.length}`)
}

main()
