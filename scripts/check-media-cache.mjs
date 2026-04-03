#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`Uso:
  node scripts/check-media-cache.mjs <url> [url...] [--repeat N] [--wait-ms MS] [--referer URL]

Ejemplos:
  node scripts/check-media-cache.mjs "https://media.unicoapps.com/stories/demo.mp4"
  node scripts/check-media-cache.mjs "https://media.unicoapps.com/stories/demo.mp4" --repeat 2 --wait-ms 3000
  node scripts/check-media-cache.mjs "https://media.unicoapps.com/stories/demo.mp4" --referer "https://mansiondeseo.unicoapps.com/"
`);
  process.exit(0);
}

function takeFlag(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  args.splice(index, 2);
  return value ?? fallback;
}

const repeat = Math.max(1, Number.parseInt(takeFlag('--repeat', '1'), 10) || 1);
const waitMs = Math.max(0, Number.parseInt(takeFlag('--wait-ms', '0'), 10) || 0);
const referer = takeFlag('--referer', '');
const urls = args.filter(Boolean);

if (urls.length === 0) {
  console.error('Falta al menos una URL.');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function inspect(url) {
  const headers = {};
  if (referer) headers.Referer = referer;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'follow',
  });

  const body = await response.arrayBuffer();
  const getHeader = (name) => response.headers.get(name) || '-';

  return {
    status: response.status,
    cacheStatus: getHeader('cf-cache-status'),
    xCache: getHeader('x-cache'),
    age: getHeader('age'),
    cacheControl: getHeader('cache-control'),
    contentType: getHeader('content-type'),
    contentLength: getHeader('content-length'),
    bytesRead: body.byteLength,
  };
}

for (const url of urls) {
  console.log(`\nURL: ${url}`);
  for (let attempt = 1; attempt <= repeat; attempt += 1) {
    const result = await inspect(url);
    console.log(
      [
        `#${attempt}`,
        `status=${result.status}`,
        `cf-cache-status=${result.cacheStatus}`,
        `x-cache=${result.xCache}`,
        `age=${result.age}`,
        `cache-control=${result.cacheControl}`,
        `content-type=${result.contentType}`,
        `content-length=${result.contentLength}`,
        `bytes-read=${result.bytesRead}`,
      ].join(' | ')
    );

    if (attempt < repeat && waitMs > 0) {
      await sleep(waitMs);
    }
  }
}
