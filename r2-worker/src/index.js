// ═══════════════════════════════════════════════════════
// MANSIÓN DESEO — R2 Video Delivery Worker
// Aggressive edge caching to minimize Class B operations
// ═══════════════════════════════════════════════════════

const CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable';
const CORS_ORIGINS = [
  'https://mansiondeseo-site.pages.dev',
  'https://mansiondeseo.com',
  'https://www.mansiondeseo.com',
];

// Hotlink protection: returns true if the request is allowed.
// Allows: no Referer (direct access), or Referer from our own domains.
// Blocks: Referer from any other site (hotlinking).
function isAllowedReferer(request) {
  const referer = request.headers.get('Referer') || '';
  if (!referer) return true; // direct access or no-referrer policy
  return CORS_ORIGINS.some((origin) => referer.startsWith(origin));
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upload-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function errorResponse(message, status, request) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // ── CORS Preflight ──────────────────────────────
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Extract the R2 key from the URL path (strip leading /)
    const key = url.pathname.slice(1);
    if (!key) {
      return errorResponse('Key required', 400, request);
    }

    // ── PUT — Upload ────────────────────────────────
    if (method === 'PUT') {
      return handleUpload(request, env, key);
    }

    // ── GET — Delivery (with edge cache) ────────────
    if (method === 'GET' || method === 'HEAD') {
      if (!isAllowedReferer(request)) {
        return new Response('Forbidden', { status: 403 });
      }
      return handleGet(request, env, key, method);
    }

    return errorResponse('Method not allowed', 405, request);
  },
};

// ─────────────────────────────────────────────────────
// PUT Handler — Authenticated upload to R2
// ─────────────────────────────────────────────────────
async function handleUpload(request, env, key) {
  // Security: validate upload token
  const token = request.headers.get('X-Upload-Token') || '';
  if (!token || token !== env.UPLOAD_SECRET) {
    return errorResponse('Unauthorized', 401, request);
  }

  const contentType = request.headers.get('Content-Type') || 'video/mp4';

  // Validate content type
  const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.some(t => contentType.startsWith(t))) {
    return errorResponse('Unsupported content type', 400, request);
  }

  // Max 100MB
  const body = await request.arrayBuffer();
  if (body.byteLength > 100 * 1024 * 1024) {
    return errorResponse('File too large (max 100MB)', 413, request);
  }

  // Store in R2 with aggressive cache metadata
  await env.BUCKET.put(key, body, {
    httpMetadata: {
      contentType,
      cacheControl: CACHE_CONTROL,
    },
  });

  // Purge edge cache for this key so new version is served immediately
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: 'GET' });
  await cache.delete(cacheKey);

  return new Response(JSON.stringify({ key, url: `${url.origin}/${key}` }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

// ─────────────────────────────────────────────────────
// Range header parser — returns R2-compatible range object
// ─────────────────────────────────────────────────────
function parseRangeHeader(rangeHeader, totalSize) {
  if (!rangeHeader) return null;
  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const start = match[1] ? parseInt(match[1], 10) : undefined;
  const end = match[2] ? parseInt(match[2], 10) : undefined;

  if (start !== undefined && end !== undefined) {
    return { offset: start, length: end - start + 1 };
  }
  if (start !== undefined) {
    return { offset: start, length: totalSize - start };
  }
  if (end !== undefined) {
    // Suffix range: last N bytes
    return { suffix: end };
  }
  return null;
}

// ─────────────────────────────────────────────────────
// GET Handler — Range support + edge cache for full requests
// ─────────────────────────────────────────────────────
async function handleGet(request, env, key, method) {
  const rangeHeader = request.headers.get('Range');
  const isRangeRequest = !!rangeHeader;

  // ── Non-range requests: try edge cache first ──────
  if (!isRangeRequest) {
    const cache = caches.default;
    const cacheKey = new Request(request.url, { method: 'GET' });

    let response = await cache.match(cacheKey);
    if (response) {
      const headers = new Headers(response.headers);
      headers.set('X-Cache', 'HIT');
      Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));

      if (method === 'HEAD') {
        return new Response(null, { status: 200, headers });
      }
      return new Response(response.body, { status: 200, headers });
    }

    // Cache MISS — fetch full object from R2
    const object = await env.BUCKET.get(key);
    if (!object) return errorResponse('Not found', 404, request);

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', CACHE_CONTROL);
    headers.set('ETag', object.httpEtag);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Length', String(object.size));
    headers.set('X-Cache', 'MISS');
    Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));

    if (method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }

    // Tee body: one stream for client, one for cache
    const [clientStream, cacheStream] = object.body.tee();
    try {
      cache.put(cacheKey, new Response(cacheStream, { status: 200, headers: new Headers(headers) }));
    } catch {
      // Edge caching is best-effort
    }

    return new Response(clientStream, { status: 200, headers });
  }

  // ── Range requests: pass directly to R2 (no cache) ──
  // First get object metadata to know total size
  const head = await env.BUCKET.head(key);
  if (!head) return errorResponse('Not found', 404, request);

  const totalSize = head.size;
  const range = parseRangeHeader(rangeHeader, totalSize);
  if (!range) {
    return errorResponse('Invalid Range', 416, request);
  }

  const object = await env.BUCKET.get(key, { range });
  if (!object) return errorResponse('Not found', 404, request);

  // Calculate actual byte range for Content-Range header
  let rangeStart, rangeEnd;
  if (range.suffix) {
    rangeStart = totalSize - range.suffix;
    rangeEnd = totalSize - 1;
  } else {
    rangeStart = range.offset;
    rangeEnd = range.offset + range.length - 1;
  }

  const headers = new Headers();
  headers.set('Content-Type', head.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', CACHE_CONTROL);
  headers.set('ETag', head.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${rangeStart}-${rangeEnd}/${totalSize}`);
  headers.set('Content-Length', String(rangeEnd - rangeStart + 1));
  Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));

  if (method === 'HEAD') {
    return new Response(null, { status: 206, headers });
  }

  return new Response(object.body, { status: 206, headers });
}
