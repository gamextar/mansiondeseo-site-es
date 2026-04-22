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
  node scripts/deploy-shared.mjs [--origin origin] [--mirror espejo-es] [--branch main] [--dry-run]

Ejemplo:
  npm run deploy:shared

Notas:
  - Empuja el HEAD actual al branch indicado en origin y en el espejo.
  - El working tree debe estar limpio.
  - Para cambios compartidos, trabajá desde una rama creada a partir de origin/main o desde main.
`);
}

if (hasFlag('--help') || hasFlag('-h')) {
  printUsage();
  process.exit(0);
}

const originRemote = readArg('--origin', 'origin');
const mirrorRemote = readArg('--mirror', 'espejo-es');
const targetBranch = readArg('--branch', 'main');
const dryRun = hasFlag('--dry-run');

const status = runGit(['status', '--porcelain']).stdout.trim();
if (status) {
  console.error('El working tree tiene cambios sin commitear. Hacé commit o stash antes de publicar.');
  console.error(status);
  process.exit(1);
}

const remotes = runGit(['remote']).stdout
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

for (const remote of [originRemote, mirrorRemote]) {
  if (!remotes.includes(remote)) {
    console.error(`No existe el remote '${remote}'.`);
    process.exit(1);
  }
}

const currentBranch = runGit(['branch', '--show-current']).stdout.trim() || 'HEAD';
const targetRef = `HEAD:${targetBranch}`;

console.log(`Publicando ${currentBranch} -> ${originRemote}/${targetBranch} y ${mirrorRemote}/${targetBranch}`);

if (dryRun) {
  console.log(`Dry run: git push ${originRemote} ${targetRef}`);
  console.log(`Dry run: git push ${mirrorRemote} ${targetRef}`);
  process.exit(0);
}

runGit(['push', originRemote, targetRef]);
runGit(['push', mirrorRemote, targetRef]);

console.log(`Listo: ${currentBranch} publicado en ${originRemote}/${targetBranch} y ${mirrorRemote}/${targetBranch}.`);
