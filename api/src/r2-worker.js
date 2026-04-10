// ── R2 Media Gatekeeper Worker ───────────────────────────
// Sits in front of media.mansiondeseo.com (R2 public bucket).
// Validates path before letting the request through.
// Invalid paths → 403 immediately, zero R2 Class B operations.

// Valid key pattern: profiles/<id>/<id>.ext  |  stories/<id>.ext  |  assets/<id>.ext
const VALID_PATH = /^\/(profiles\/[^/]+\/[^/]+|stories\/[^/]+|assets\/[^/]+)\.[a-zA-Z0-9]{2,5}$/;

const R2_PUBLIC_BASE = 'https://media.mansiondeseo.com';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Block anything that doesn't look like a real media key
    if (!VALID_PATH.test(url.pathname)) {
      return new Response('Not found', { status: 404 });
    }

    // Only allow GET and HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Forward to R2 public URL directly (triggers CF CDN cache, not Worker R2 binding)
    const r2Url = `${R2_PUBLIC_BASE}${url.pathname}`;
    return fetch(r2Url, {
      method: request.method,
      headers: {
        // Forward Range header for video streaming
        ...(request.headers.has('Range') ? { Range: request.headers.get('Range') } : {}),
      },
    });
  },
};
