// ═══════════════════════════════════════════════════════
// MANSIÓN DESEO — UserNotification Durable Object
// Per-user notification channel via WebSocket Hibernation
// ═══════════════════════════════════════════════════════

export class UserNotification {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // POST /notify — broadcast event to all connected tabs/devices
    if (url.pathname === '/notify' && request.method === 'POST') {
      const data = await request.json();
      const payload = JSON.stringify(data);
      for (const ws of this.state.getWebSockets()) {
        try { ws.send(payload); } catch { /* dead socket */ }
      }
      return new Response('ok');
    }

    // WebSocket upgrade
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, msg) {
    // Only handle pings to keep connection alive
    try {
      const data = JSON.parse(typeof msg === 'string' ? msg : new TextDecoder().decode(msg));
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch { /* ignore */ }
  }

  async webSocketClose(ws, code, reason) {
    ws.close(code, reason);
  }

  async webSocketError(ws, error) {
    ws.close(1011, 'WebSocket error');
  }
}
