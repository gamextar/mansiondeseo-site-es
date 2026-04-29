// ═══════════════════════════════════════════════════════
// MANSIÓN DESEO — UserNotification Durable Object
// Per-user notification channel via WebSocket Hibernation
// ═══════════════════════════════════════════════════════

export class UserNotification {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  debug(...args) {
    if (this.env?.DEBUG_LOGS === '1' || this.env?.ENVIRONMENT !== 'production') {
      console.log(...args);
    }
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      this.debug('[UserNotification.fetch] pathname:', url.pathname, 'method:', request.method);

      // POST /notify — broadcast event to all connected tabs/devices
      if (url.pathname === '/notify' && request.method === 'POST') {
        let data;
        try { data = await request.json(); } catch {
          return new Response('Bad JSON', { status: 400 });
        }
        const sockets = this.state.getWebSockets();
        this.debug('[UserNotification.notify] sockets:', sockets.length, 'data:', JSON.stringify(data));
        const payload = JSON.stringify(data);
        for (const ws of sockets) {
          try {
            ws.send(payload);
          } catch { /* dead socket */ }
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
      this.setSocketAttachment(server, { activeChatId: null });
      // Send immediate connected confirmation
      this.state.waitUntil(Promise.resolve().then(() => {
        try { server.send(JSON.stringify({ type: 'connected' })); } catch { /* ignore */ }
      }));

      return new Response(null, { status: 101, webSocket: client });
    } catch (err) {
      this.debug('[UserNotification.fetch] ERROR:', err?.message || err);
      return new Response('Internal error', { status: 500 });
    }
  }

  async webSocketMessage(ws, msg) {
    try {
      const data = JSON.parse(typeof msg === 'string' ? msg : new TextDecoder().decode(msg));
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      } else if (data.type === 'active_chat') {
        this.setSocketAttachment(ws, {
          ...this.getSocketAttachment(ws),
          activeChatId: data.chatId || null,
        });
      }
    } catch { /* ignore malformed messages */ }
  }

  async webSocketClose(ws, code, reason) {
    try { ws.close(code || 1000, reason || 'Connection closed'); } catch { /* already closed */ }
  }

  async webSocketError(ws, error) {
    this.debug('[UserNotification.webSocketError]', error?.message || error);
    try { ws.close(1011, 'WebSocket error'); } catch { /* already closed */ }
  }

  getSocketAttachment(ws) {
    try {
      return ws.deserializeAttachment?.() || {};
    } catch {
      return {};
    }
  }

  setSocketAttachment(ws, value) {
    try {
      ws.serializeAttachment?.(value);
    } catch {
      // ignore on platforms without attachment support
    }
  }
}
