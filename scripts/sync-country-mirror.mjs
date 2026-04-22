#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);

function readArg(name, fallback = '') {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const prefixed = args.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

function runGit(gitArgs, { allowFailure = false } = {}) {
  const result = spawnSync('git', gitArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!allowFailure && result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`git ${gitArgs.join(' ')} failed${details ? `\n${details}` : ''}`);
  }

  return result;
}

function printUsage() {
  console.log(`Uso:
  node scripts/sync-country-mirror.mjs --repo <repo-url> [--remote espejo-es] [--branch main] [--target-branch main] [--force-with-lease]

Ejemplo:
  node scripts/sync-country-mirror.mjs \\
    --repo git@github.com:gamextar/mansiondeseo-site-es.git \\
    --remote espejo-es \\
    --branch main \\
    --target-branch main

Notas:
  - El repo espejo debe existir en GitHub/GitLab antes de correr este script.
  - El working tree debe estar limpio para evitar deploys de commits incompletos.
  - Usa --force-with-lease solo si el espejo es de solo lectura y nadie edita ahi.
`);
}

if (hasFlag('--help') || hasFlag('-h')) {
  printUsage();
  process.exit(0);
}

const repo = readArg('--repo');
const remoteName = readArg('--remote', 'espejo-es');
const branch = readArg('--branch', 'main');
const targetBranch = readArg('--target-branch', branch);
const forceWithLease = hasFlag('--force-with-lease');

if (!repo) {
  printUsage();
  process.exit(1);
}

const status = runGit(['status', '--porcelain']).stdout.trim();
if (status) {
  console.error('El working tree tiene cambios sin commitear. Commit o stash antes de sincronizar el espejo.');
  console.error(status);
  process.exit(1);
}

const remotes = runGit(['remote']).stdout.split('\n').map((line) => line.trim()).filter(Boolean);
if (!remotes.includes(remoteName)) {
  runGit(['remote', 'add', remoteName, repo]);
} else {
  runGit(['remote', 'set-url', remoteName, repo]);
}

runGit(['fetch', 'origin', branch]);
runGit(['fetch', remoteName, targetBranch], { allowFailure: true });

const currentBranch = runGit(['branch', '--show-current']).stdout.trim();
if (currentBranch !== branch) {
  console.error(`Estás en '${currentBranch || '(detached)'}'. Cambiá a '${branch}' antes de sincronizar.`);
  process.exit(1);
}

runGit(['rev-parse', '--verify', branch]);
const pushArgs = ['push', remoteName, `${branch}:${targetBranch}`];
if (forceWithLease) pushArgs.splice(1, 0, '--force-with-lease');
runGit(pushArgs);

console.log(`Espejo sincronizado: ${remoteName} ${branch} -> ${targetBranch}`);
