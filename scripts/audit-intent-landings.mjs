#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIST_EXPLORAR_DIR = path.resolve('dist/explorar');

function matchAll(content, pattern) {
  return [...content.matchAll(pattern)];
}

async function listHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listHtmlFiles(fullPath));
    if (entry.isFile() && entry.name === 'index.html') files.push(fullPath);
  }
  return files;
}

function parseJsonLdBlocks(html) {
  return matchAll(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    .flatMap((match) => {
      const parsed = JSON.parse(match[1]);
      return Array.isArray(parsed) ? parsed : [parsed];
    });
}

function auditPage(filePath, html) {
  const errors = [];
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1] || '';
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1] || '';
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || '';
  const h1 = html.match(/<h1 class="h1">([^<]+)<\/h1>/)?.[1] || '';
  const profileCards = matchAll(html, /<a id="perfil-\d+" class="profile-card"/g).length;
  const images = matchAll(html, /<img [^>]*class="profile-image"/g).length;
  const widthHeightImages = matchAll(html, /<img [^>]*class="profile-image"[^>]*width="480"[^>]*height="480"/g).length;
  const preloads = matchAll(html, /<link rel="preload" as="image"/g).length;
  const relatedPills = matchAll(html, /class="seo-pill"/g).length;
  const jsonLd = parseJsonLdBlocks(html);
  const itemList = jsonLd.find((item) => item?.['@type'] === 'ItemList');
  const itemListCount = itemList?.itemListElement?.length || 0;

  if (!title) errors.push('missing title');
  if (!description) errors.push('missing description');
  if (!canonical) errors.push('missing canonical');
  if (!h1) errors.push('missing h1');
  if (profileCards < 12) errors.push(`expected at least 12 profile cards, got ${profileCards}`);
  if (images !== profileCards) errors.push(`profile image/card mismatch: ${images}/${profileCards}`);
  if (widthHeightImages !== images) errors.push('some profile images are missing width/height');
  if (preloads < 1) errors.push('missing first image preload');
  if (relatedPills < 5) errors.push(`expected at least 5 related pills, got ${relatedPills}`);
  if (!itemList) errors.push('missing ItemList JSON-LD');
  if (itemList && itemListCount !== profileCards) errors.push(`ItemList/card mismatch: ${itemListCount}/${profileCards}`);
  if (html.includes('Ver Perfil')) errors.push('legacy Ver Perfil text still present');
  if (html.includes('data-profile-card') || html.includes('is-visible')) errors.push('legacy reveal behavior still present');

  for (let index = 1; index <= profileCards; index += 1) {
    if (!html.includes(`id="perfil-${index}"`)) errors.push(`missing #perfil-${index}`);
  }

  return {
    filePath,
    route: filePath.replace(path.resolve('dist'), '').replace(/\/index\.html$/, '/'),
    title,
    canonical,
    profileCards,
    images,
    relatedPills,
    errors,
  };
}

let files = [];
try {
  files = await listHtmlFiles(DIST_EXPLORAR_DIR);
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.error('No existe dist/explorar. Ejecutá npm run build primero.');
    process.exit(1);
  }
  throw error;
}

const results = [];
for (const filePath of files) {
  if (path.dirname(filePath) === DIST_EXPLORAR_DIR) continue;
  const html = await readFile(filePath, 'utf8');
  results.push(auditPage(filePath, html));
}

const failed = results.filter((result) => result.errors.length > 0);
if (failed.length > 0) {
  console.error(`Intent landing audit failed: ${failed.length}/${results.length}`);
  for (const result of failed) {
    console.error(`\n${result.route}`);
    for (const error of result.errors) console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Intent landing audit passed: ${results.length} pages`);
