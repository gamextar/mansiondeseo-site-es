var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var CACHE_CONTROL = "public, max-age=31536000, s-maxage=31536000, immutable";
var CORS_ORIGINS = [
  "https://mansiondeseo-site.pages.dev",
  "https://mansiondeseo.com",
  "https://www.mansiondeseo.com"
];
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Upload-Token",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function errorResponse(message, status, request) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) }
  });
}
__name(errorResponse, "errorResponse");
var index_default = {
  async fetch(request, env) {
    const url2 = new URL(request.url);
    const method = request.method;
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    const key = url2.pathname.slice(1);
    if (!key) {
      return errorResponse("Key required", 400, request);
    }
    if (method === "PUT") {
      return handleUpload(request, env, key);
    }
    if (method === "GET" || method === "HEAD") {
      return handleGet(request, env, key, method);
    }
    return errorResponse("Method not allowed", 405, request);
  }
};
async function handleUpload(request, env, key) {
  const token = request.headers.get("X-Upload-Token") || "";
  if (!token || token !== env.UPLOAD_SECRET) {
    return errorResponse("Unauthorized", 401, request);
  }
  const contentType = request.headers.get("Content-Type") || "video/mp4";
  const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.some((t) => contentType.startsWith(t))) {
    return errorResponse("Unsupported content type", 400, request);
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > 100 * 1024 * 1024) {
    return errorResponse("File too large (max 100MB)", 413, request);
  }
  await env.BUCKET.put(key, body, {
    httpMetadata: {
      contentType,
      cacheControl: CACHE_CONTROL
    }
  });
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  await cache.delete(cacheKey);
  return new Response(JSON.stringify({ key, url: `${url.origin}/${key}` }), {
    status: 201,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) }
  });
}
__name(handleUpload, "handleUpload");
async function handleGet(request, env, key, method) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  let response = await cache.match(cacheKey);
  if (response) {
    const headers2 = new Headers(response.headers);
    headers2.set("X-Cache", "HIT");
    headers2.set("Vary", "Accept-Encoding");
    Object.entries(corsHeaders(request)).forEach(([k, v]) => headers2.set(k, v));
    if (method === "HEAD") {
      return new Response(null, { status: response.status, headers: headers2 });
    }
    return new Response(response.body, { status: response.status, headers: headers2 });
  }
  const object = await env.BUCKET.get(key);
  if (!object) {
    return errorResponse("Not found", 404, request);
  }
  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Cache-Control", CACHE_CONTROL);
  headers.set("ETag", object.httpEtag);
  headers.set("X-Cache", "MISS");
  headers.set("Vary", "Accept-Encoding");
  headers.set("Accept-Ranges", "bytes");
  if (object.size) {
    headers.set("Content-Length", String(object.size));
  }
  Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));
  const body = object.body;
  response = new Response(body, { status: 200, headers });
  const [clientStream, cacheStream] = response.body.tee();
  const cacheResponse = new Response(cacheStream, {
    status: 200,
    headers: response.headers
  });
  const ctx = { waitUntil: /* @__PURE__ */ __name((p) => p, "waitUntil") };
  try {
    cache.put(cacheKey, cacheResponse);
  } catch {
  }
  if (method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return new Response(clientStream, { status: 200, headers });
}
__name(handleGet, "handleGet");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
