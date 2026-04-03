// ═══════════════════════════════════════════════════════
// MANSIÓN DESEO — WebSocket Chat Connection Manager
// Auto-reconnect with exponential backoff
// ═══════════════════════════════════════════════════════
import { recordRealtimeDebug, setRealtimeActiveConnections } from './realtimeDebug';

const WS_BASE = import.meta.env.PROD
  ? 'wss://mansion-deseo-api-production.green-silence-8594.workers.dev'
  : `ws://${window.location.hostname}:8787`;
const CHAT_PING_MS = 45_000;
const CHAT_BACKGROUND_GRACE_MS = 15_000;
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
  let backgroundTimer = null;
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
        recordRealtimeDebug('chat', 'pingsSent');
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, CHAT_PING_MS);
  }

  function clearBackgroundTimer() {
    clearTimeout(backgroundTimer);
    backgroundTimer = null;
  }

  function setState(s) {
    state = s;
    callbacks.onStateChange?.(s);
  }

  function connect() {
    if (closed || paused) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    setState('connecting');

    try {
      recordRealtimeDebug('chat', 'connectAttempts');
      ws = new WebSocket(url);
    } catch {
      recordRealtimeDebug('chat', 'errors');
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      retryCount = 0;
      setState('connected');
      recordRealtimeDebug('chat', 'opens');
      startPing();
    };

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      recordRealtimeDebug('chat', 'messagesReceived');

      switch (data.type) {
        case 'history':
          callbacks.onHistory?.(data);
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
          recordRealtimeDebug('chat', 'pongsReceived');
          break;
      }
    };

    ws.onclose = () => {
      stopPing();
      recordRealtimeDebug('chat', 'closes');
      if (!closed) {
        setState('disconnected');
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      recordRealtimeDebug('chat', 'errors');
    };
  }

  function scheduleReconnect() {
    if (closed || paused) return;
    if (retryCount >= CHAT_MAX_RETRIES) return;
    const delay = Math.min(2000 * Math.pow(2, retryCount), 30_000);
    retryCount++;
    recordRealtimeDebug('chat', 'reconnectsScheduled');
    retryTimer = setTimeout(connect, delay);
  }

  function send(content) {
    if (ws?.readyState === WebSocket.OPEN) {
      recordRealtimeDebug('chat', 'messagesSent');
      ws.send(JSON.stringify({ type: 'message', content }));
    }
  }

  function sendTyping() {
    if (ws?.readyState === WebSocket.OPEN) {
      recordRealtimeDebug('chat', 'messagesSent');
      ws.send(JSON.stringify({ type: 'typing' }));
    }
  }

  function markRead(messageIds) {
    if (ws?.readyState === WebSocket.OPEN && messageIds.length > 0) {
      recordRealtimeDebug('chat', 'messagesSent');
      ws.send(JSON.stringify({ type: 'read', messageIds }));
    }
  }

  function close() {
    closed = true;
    clearTimeout(retryTimer);
    clearBackgroundTimer();
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
      clearBackgroundTimer();
      paused = false;
      retryCount = 0;
      connect();
      return;
    }
    clearBackgroundTimer();
    backgroundTimer = setTimeout(() => {
      if (closed || document.visibilityState === 'visible') return;
      paused = true;
      recordRealtimeDebug('chat', 'backgroundPauses');
      clearTimeout(retryTimer);
      stopPing();
      if (ws) {
        ws.onclose = null;
        ws.close(1000, 'client-pause');
        ws = null;
      }
      setState('disconnected');
    }, CHAT_BACKGROUND_GRACE_MS);
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
      setRealtimeActiveConnections('chat', 0);
      close();
    },
    getState,
  };
}
