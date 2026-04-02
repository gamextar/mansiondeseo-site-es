// ═══════════════════════════════════════════════════════
// MANSIÓN DESEO — WebSocket Chat Connection Manager
// Auto-reconnect with exponential backoff
// ═══════════════════════════════════════════════════════

const WS_BASE = import.meta.env.PROD
  ? 'wss://mansion-deseo-api-production.green-silence-8594.workers.dev'
  : `ws://${window.location.hostname}:8787`;
const CHAT_PING_MS = 45_000;
const CHAT_MAX_RETRIES = 5;

/**
 * Creates a managed WebSocket connection to the ChatRoom Durable Object.
 *
 * @param {string} myUserId - Authenticated user's ID
 * @param {string} partnerId - Chat partner's ID
 * @param {string} token - JWT token
 * @param {object} callbacks
 *   - onHistory(messages): initial message history from DO
 *   - onMessage(msg): new incoming message
 *   - onRead(messageIds): read receipt
 *   - onAck(msg): sent message confirmed
 *   - onLimit({ remaining, max, canSend }): limit update
 *   - onError(message): server error (e.g., limit reached)
 *   - onStateChange(state): 'connecting' | 'connected' | 'disconnected'
 * @returns {{ send, markRead, close, getState }}
 */
export function createChatSocket(myUserId, partnerId, token, callbacks) {
  const chatId = [myUserId, partnerId].sort().join('-');
  const url = `${WS_BASE}/api/chat/ws/${chatId}?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(myUserId)}`;

  let ws = null;
  let state = 'disconnected';
  let retryCount = 0;
  let retryTimer = null;
  let pingTimer = null;
  let closed = false; // true when user explicitly closes
  let paused = false; // true when tab is in background

  function stopPing() {
    clearInterval(pingTimer);
    pingTimer = null;
  }

  function startPing() {
    if (document.visibilityState !== 'visible') return;
    stopPing();
    pingTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, CHAT_PING_MS);
  }

  function setState(s) {
    state = s;
    callbacks.onStateChange?.(s);
  }

  function connect() {
    if (closed || paused) return;
    setState('connecting');

    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      retryCount = 0;
      setState('connected');
      startPing();
    };

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (data.type) {
        case 'history':
          callbacks.onHistory?.(data.messages || []);
          break;
        case 'message':
          callbacks.onMessage?.(data.message);
          break;
        case 'ack':
          callbacks.onAck?.(data.message);
          break;
        case 'read':
          callbacks.onRead?.(data.messageIds);
          break;
        case 'typing':
          callbacks.onTyping?.();
          break;
        case 'limit':
          callbacks.onLimit?.(data);
          break;
        case 'error':
          callbacks.onError?.(data);
          break;
        case 'pong':
          break;
      }
    };

    ws.onclose = () => {
      stopPing();
      if (!closed) {
        setState('disconnected');
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }

  function scheduleReconnect() {
    if (closed || paused) return;
    if (retryCount >= CHAT_MAX_RETRIES) return;
    const delay = Math.min(2000 * Math.pow(2, retryCount), 30_000);
    retryCount++;
    retryTimer = setTimeout(connect, delay);
  }

  function send(content) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', content }));
    }
  }

  function sendTyping() {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'typing' }));
    }
  }

  function markRead(messageIds) {
    if (ws?.readyState === WebSocket.OPEN && messageIds.length > 0) {
      ws.send(JSON.stringify({ type: 'read', messageIds }));
    }
  }

  function close() {
    closed = true;
    clearTimeout(retryTimer);
    stopPing();
    if (ws) {
      ws.onclose = null; // prevent reconnect
      ws.close();
      ws = null;
    }
    setState('disconnected');
  }

  function getState() {
    return state;
  }

  function handleVisibilityChange() {
    if (closed) return;
    if (document.visibilityState === 'visible') {
      paused = false;
      retryCount = 0;
      connect();
      return;
    }
    // Background: disconnect cleanly like notification WS
    paused = true;
    clearTimeout(retryTimer);
    stopPing();
    if (ws) {
      ws.onclose = null;
      ws.close(1000, 'client-pause');
      ws = null;
    }
    setState('disconnected');
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Start connection
  connect();

  return {
    send,
    sendTyping,
    markRead,
    close: () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      close();
    },
    getState,
  };
}
