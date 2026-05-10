#!/usr/bin/env node
import crypto from 'node:crypto';
import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONFIG_DIR = path.join(ROOT, 'config', 'google-search-console');
const DEFAULT_CREDENTIALS_PATH = path.join(DEFAULT_CONFIG_DIR, 'credentials.json');
const DEFAULT_TOKEN_PATH = path.join(DEFAULT_CONFIG_DIR, 'token.json');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'data', 'search-console');
const DEFAULT_SITE_URL = 'sc-domain:mansiondeseo.com';
const DEFAULT_DAYS = 90;
const DEFAULT_ROW_LIMIT = 25000;
const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const [rawKey, inlineValue] = item.slice(2).split('=');
    const key = rawKey.trim();
    if (!key) continue;
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[key] = argv[i + 1];
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function safeFilePart(value) {
  return String(value || '')
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'site';
}

function csvEscape(value) {
  if (value == null) return '';
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows, columns) {
  return [
    columns.map(csvEscape).join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ].join('\n');
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function getOAuthClient(credentials) {
  const installed = credentials.installed || credentials.web || {};
  const clientId = installed.client_id;
  const clientSecret = installed.client_secret;
  if (!clientId || !clientSecret) {
    throw new Error('credentials.json no parece ser un OAuth Client válido.');
  }
  return { clientId, clientSecret };
}

function openBrowser(url) {
  const command = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';
  import('node:child_process').then(({ execFile }) => {
    execFile(command, [url], { stdio: 'ignore' }, () => {});
  }).catch(() => {});
}

function waitForOAuthCode({ clientId, port, state }) {
  return new Promise((resolve, reject) => {
    const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', redirectUri);
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404).end('Not found');
        return;
      }
      if (url.searchParams.get('state') !== state) {
        res.writeHead(400).end('Invalid state');
        reject(new Error('OAuth state inválido.'));
        server.close();
        return;
      }
      const error = url.searchParams.get('error');
      if (error) {
        res.writeHead(400).end(`OAuth error: ${error}`);
        reject(new Error(`OAuth error: ${error}`));
        server.close();
        return;
      }
      const code = url.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Autorización completa</h1><p>Ya podés volver a la terminal.</p>');
      resolve({ code, redirectUri });
      server.close();
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`Abriendo autorización de Google en el navegador...`);
      console.log(authUrl.toString());
      openBrowser(authUrl.toString());
    });
    server.on('error', reject);
  });
}

async function exchangeCodeForToken({ clientId, clientSecret, code, redirectUri }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`No se pudo obtener token OAuth: ${JSON.stringify(data)}`);
  return {
    ...data,
    expires_at: Date.now() + Math.max(0, Number(data.expires_in || 0) - 60) * 1000,
  };
}

async function refreshToken({ clientId, clientSecret, refreshTokenValue }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshTokenValue,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`No se pudo refrescar token OAuth: ${JSON.stringify(data)}`);
  return {
    ...data,
    refresh_token: refreshTokenValue,
    expires_at: Date.now() + Math.max(0, Number(data.expires_in || 0) - 60) * 1000,
  };
}

async function getAccessToken({ credentialsPath, tokenPath, port }) {
  if (!existsSync(credentialsPath)) {
    throw new Error(`Falta ${credentialsPath}. Descargá credentials.json desde Google Cloud y guardalo ahí.`);
  }
  const credentials = await readJson(credentialsPath);
  const { clientId, clientSecret } = getOAuthClient(credentials);
  let token = existsSync(tokenPath) ? await readJson(tokenPath) : null;

  if (token?.access_token && Number(token.expires_at || 0) > Date.now()) {
    return token.access_token;
  }

  if (token?.refresh_token) {
    token = await refreshToken({ clientId, clientSecret, refreshTokenValue: token.refresh_token });
    await writeJson(tokenPath, token);
    return token.access_token;
  }

  const state = crypto.randomBytes(16).toString('hex');
  const { code, redirectUri } = await waitForOAuthCode({ clientId, port, state });
  token = await exchangeCodeForToken({ clientId, clientSecret, code, redirectUri });
  await writeJson(tokenPath, token);
  return token.access_token;
}

async function googleJson(url, { accessToken, method = 'GET', body = null } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function querySearchAnalytics({ accessToken, siteUrl, dimensions, startDate, endDate, rowLimit }) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const rows = [];
  let startRow = 0;
  while (true) {
    const data = await googleJson(endpoint, {
      accessToken,
      method: 'POST',
      body: {
        startDate,
        endDate,
        dimensions,
        rowLimit,
        startRow,
        searchType: 'web',
        dataState: 'final',
      },
    });
    const batch = data.rows || [];
    rows.push(...batch.map((row) => ({
      keys: row.keys || [],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    })));
    if (batch.length < rowLimit) break;
    startRow += rowLimit;
  }
  return rows;
}

function normalizeAnalyticsRows(rows, dimensions) {
  return rows.map((row) => {
    const output = {};
    dimensions.forEach((dimension, index) => {
      output[dimension] = row.keys[index] || '';
    });
    output.clicks = row.clicks;
    output.impressions = row.impressions;
    output.ctr = row.ctr;
    output.position = row.position;
    return output;
  });
}

function summarizeOpportunities(queryRows, pageRows) {
  const queryOpportunities = queryRows
    .filter((row) => Number(row.impressions || 0) >= 20 && Number(row.clicks || 0) === 0)
    .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0))
    .slice(0, 30);
  const lowCtrQueries = queryRows
    .filter((row) => Number(row.impressions || 0) >= 50 && Number(row.position || 99) <= 20 && Number(row.ctr || 0) < 0.02)
    .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0))
    .slice(0, 30);
  const pageOpportunities = pageRows
    .filter((row) => Number(row.impressions || 0) >= 20)
    .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0))
    .slice(0, 30);
  return { queryOpportunities, lowCtrQueries, pageOpportunities };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const credentialsPath = path.resolve(args.credentials || DEFAULT_CREDENTIALS_PATH);
  const tokenPath = path.resolve(args.token || DEFAULT_TOKEN_PATH);
  const outputDir = path.resolve(args.output || DEFAULT_OUTPUT_DIR);
  const siteUrl = String(args.site || DEFAULT_SITE_URL);
  const days = Math.max(1, Number(args.days || DEFAULT_DAYS));
  const port = Math.max(1024, Number(args.port || 8987));
  const rowLimit = Math.max(1, Math.min(25000, Number(args.rowLimit || DEFAULT_ROW_LIMIT)));
  const endDate = args.endDate || formatDate(addDays(new Date(), -3));
  const startDate = args.startDate || formatDate(addDays(new Date(`${endDate}T00:00:00Z`), -(days - 1)));
  const stamp = `${safeFilePart(siteUrl)}_${startDate}_${endDate}`;

  await mkdir(outputDir, { recursive: true });
  const accessToken = await getAccessToken({ credentialsPath, tokenPath, port });

  const sites = await googleJson('https://www.googleapis.com/webmasters/v3/sites', { accessToken });
  const sitemaps = await googleJson(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
    { accessToken },
  ).catch((err) => ({ error: err.message, sitemap: [] }));

  const exports = [
    { name: 'queries', dimensions: ['query'] },
    { name: 'pages', dimensions: ['page'] },
    { name: 'queries-pages', dimensions: ['query', 'page'] },
    { name: 'countries', dimensions: ['country'] },
    { name: 'devices', dimensions: ['device'] },
    { name: 'dates', dimensions: ['date'] },
  ];

  const allResults = {};
  for (const item of exports) {
    console.log(`Descargando ${item.name}...`);
    const rows = normalizeAnalyticsRows(
      await querySearchAnalytics({
        accessToken,
        siteUrl,
        dimensions: item.dimensions,
        startDate,
        endDate,
        rowLimit,
      }),
      item.dimensions,
    );
    allResults[item.name] = rows;
    const csvPath = path.join(outputDir, `${stamp}_${item.name}.csv`);
    await writeFile(csvPath, `${rowsToCsv(rows, [...item.dimensions, 'clicks', 'impressions', 'ctr', 'position'])}\n`);
    console.log(`  ${rows.length} filas -> ${csvPath}`);
  }

  const summary = {
    siteUrl,
    startDate,
    endDate,
    generatedAt: new Date().toISOString(),
    sites: sites.siteEntry || [],
    sitemaps: sitemaps.sitemap || [],
    opportunities: summarizeOpportunities(allResults.queries || [], allResults.pages || []),
  };
  const summaryPath = path.join(outputDir, `${stamp}_summary.json`);
  await writeJson(summaryPath, summary);
  console.log(`Resumen -> ${summaryPath}`);
  console.log('Listo. Mandame esos CSV/JSON o pedime que los analice desde data/search-console/.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
