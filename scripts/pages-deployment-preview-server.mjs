#!/usr/bin/env node
import http from 'node:http';
import { Buffer } from 'node:buffer';
import { SITE_ORIGIN } from '../src/lib/siteConfig.js';

const args = process.argv.slice(2);

function readArg(name, fallback = '') {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const prefixed = args.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : fallback;
}

const deploymentInput = readArg('--deployment', args[0] || '');
const port = Number(readArg('--port', process.env.PORT || '5173'));
const apiOrigin = readArg('--api-origin', SITE_ORIGIN);

if (!deploymentInput || args.includes('--help') || args.includes('-h')) {
  console.log(`
Uso:
  node scripts/pages-deployment-preview-server.mjs --deployment <deployment-url> [--port 5173]

Ejemplo:
  node scripts/pages-deployment-preview-server.mjs --deployment https://d98e2358.mansiondeseo-site.pages.dev

Notas:
  - Abre http://localhost:5173 para ver el deployment viejo.
  - /api se proxya a ${apiOrigin}/api para poder loguearte con la API actual.
  - /sw.js se reemplaza por un service worker inocuo para evitar caches fantasma.
`);
  process.exit(deploymentInput ? 0 : 1);
}

const deploymentOrigin = normalizeOrigin(deploymentInput);

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  return url.origin;
}

function copyHeaders(source, extra = {}) {
  const headers = {};
  for (const [key, value] of source.entries()) {
    const lower = key.toLowerCase();
    if (
      lower === 'content-encoding' ||
      lower === 'content-length' ||
      lower === 'transfer-encoding' ||
      lower === 'connection'
    ) {
      continue;
    }
    headers[key] = value;
  }
  return { ...headers, ...extra };
}

async function sendFetchResponse(res, upstream, extraHeaders = {}) {
  const body = Buffer.from(await upstream.arrayBuffer());
  res.writeHead(upstream.status, copyHeaders(upstream.headers, extraHeaders));
  res.end(body);
}

async function proxyStatic(req, res, pathname) {
  const upstreamUrl = new URL(pathname, deploymentOrigin);
  upstreamUrl.search = new URL(req.url, 'http://localhost').search;
  const upstream = await fetch(upstreamUrl);
  await sendFetchResponse(res, upstream, {
    'Cache-Control': 'no-store',
  });
}

async function proxyApi(req, res, pathname) {
  const target = new URL(pathname, apiOrigin);
  target.search = new URL(req.url, 'http://localhost').search;

  const headers = new Headers(req.headers);
  headers.set('host', new URL(apiOrigin).host);
  headers.set('origin', apiOrigin);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    redirect: 'manual',
  });

  await sendFetchResponse(res, upstream, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
}

function sendNoopServiceWorker(res) {
  res.writeHead(200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(`
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});
`);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token, X-Turnstile-Token',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    if (pathname === '/sw.js') {
      sendNoopServiceWorker(res);
      return;
    }

    if (pathname.startsWith('/api/')) {
      await proxyApi(req, res, pathname);
      return;
    }

    if (
      pathname.startsWith('/assets/') ||
      pathname.startsWith('/icons/') ||
      pathname === '/manifest.json' ||
      pathname === '/icon-192.png' ||
      pathname === '/icon-512.png' ||
      pathname === '/favicon.ico'
    ) {
      await proxyStatic(req, res, pathname);
      return;
    }

    const upstream = await fetch(new URL('/', deploymentOrigin));
    await sendFetchResponse(res, upstream, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error?.stack || String(error));
  }
});

server.listen(port, () => {
  console.log(`Preview local listo: http://localhost:${port}`);
  console.log(`Deployment fuente: ${deploymentOrigin}`);
  console.log(`API proxya hacia: ${apiOrigin}/api`);
});
