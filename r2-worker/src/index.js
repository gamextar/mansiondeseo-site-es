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
// GET Handler — Serve from edge cache, fallback to R2
// ─────────────────────────────────────────────────────
async function handleGet(request, env, key, method) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: 'GET' });

  // 1️⃣ Try edge cache first (FREE — no Class B operation)
  let response = await cache.match(cacheKey);
  if (response) {
    // Cache HIT — add indicator header
    const headers = new Headers(response.headers);
    headers.set('X-Cache', 'HIT');
    headers.set('Vary', 'Accept-Encoding');
    Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));

    if (method === 'HEAD') {
      return new Response(null, { status: response.status, headers });
    }
    return new Response(response.body, { status: response.status, headers });
  }

  // 2️⃣ Cache MISS — fetch from R2 (1 Class B operation)
  const object = await env.BUCKET.get(key);
  if (!object) {
    return errorResponse('Not found', 404, request);
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', CACHE_CONTROL);
  headers.set('ETag', object.httpEtag);
  headers.set('X-Cache', 'MISS');
  headers.set('Vary', 'Accept-Encoding');
  headers.set('Accept-Ranges', 'bytes');

  if (object.size) {
    headers.set('Content-Length', String(object.size));
  }

  Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));

  // Build response for caching
  const body = object.body;
  response = new Response(body, { status: 200, headers });

  // 3️⃣ Store in edge cache (async, non-blocking)
  // Clone before consuming the body — waitUntil keeps the worker alive
  // We tee the body so the original response streams to the client
  const [clientStream, cacheStream] = response.body.tee();

  const cacheResponse = new Response(cacheStream, {
    status: 200,
    headers: response.headers,
  });

  // Use waitUntil so caching doesn't delay the response
  const ctx = { waitUntil: (p) => p }; // fallback
  try {
    // cache.put is fire-and-forget safe in Workers
    cache.put(cacheKey, cacheResponse);
  } catch {
    // Edge caching is best-effort
  }

  if (method === 'HEAD') {
    return new Response(null, { status: 200, headers });
  }

  return new Response(clientStream, { status: 200, headers });
}
