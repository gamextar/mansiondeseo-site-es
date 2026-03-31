// ═══════════════════════════════════════════════════════
// MANSIÓN DESEO — ChatRoom Durable Object
// WebSocket Hibernation + SQLite storage
// ═══════════════════════════════════════════════════════

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    this.initPromise = this.init();
    this.hiddenConversationsReady = null;
    this.chatId = null;
    this.dailyLimitCache = { value: null, expiresAt: 0 };
    this.userStatusCache = new Map();
  }

  debug(...args) {
    if (this.env?.DEBUG_LOGS === '1' || this.env?.ENVIRONMENT !== 'production') {
      console.log(...args);
    }
  }

  safeParseJSON(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  isOnline(lastActive) {
    if (!lastActive) return false;
    const ts = new Date(lastActive.endsWith('Z') ? lastActive : `${lastActive}Z`).getTime();
    return (Date.now() - ts) < 3600000;
  }

  buildConversationPreview(partner, msg, unread) {
    if (!partner) return null;

    return {
      id: `conv-${partner.id}`,
      profileId: partner.id,
      name: partner.username,
      avatar: partner.avatar_url || '',
      avatarCrop: this.safeParseJSON(partner.avatar_crop, null),
      lastMessage: (msg.content || '').slice(0, 50),
      timestamp: msg.created_at,
      unread,
      online: this.isOnline(partner.last_active),
    };
  }

  async ensureHiddenConversationsTable() {
    if (!this.hiddenConversationsReady) {
      this.hiddenConversationsReady = Promise.all([
        this.env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS hidden_conversations (
            user_id TEXT NOT NULL REFERENCES users(id),
            partner_id TEXT NOT NULL REFERENCES users(id),
            hidden_before TEXT NOT NULL DEFAULT (datetime('now')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (user_id, partner_id)
          )
        `).run(),
        this.env.DB.prepare(
          'CREATE INDEX IF NOT EXISTS idx_hidden_conversations_user ON hidden_conversations(user_id, hidden_before)'
        ).run(),
      ]).catch((err) => {
        this.hiddenConversationsReady = null;
        throw err;
      });
    }

    return this.hiddenConversationsReady;
  }

  async buildNewMessageEvents(senderId, receiverId, msg) {
    await this.ensureHiddenConversationsTable();
    const chatId = [senderId, receiverId].sort().join('-');
    let senderConversation = null;
    let receiverConversation = null;

    try {
      const { results: users } = await this.env.DB.prepare(
        'SELECT id, username, avatar_url, avatar_crop, last_active FROM users WHERE id IN (?, ?)'
      ).bind(senderId, receiverId).all();

      const userMap = new Map(users.map((user) => [user.id, user]));
      senderConversation = this.buildConversationPreview(userMap.get(receiverId), msg, 0);
      receiverConversation = this.buildConversationPreview(userMap.get(senderId), msg, 0);
      if (receiverConversation) delete receiverConversation.unread;
    } catch (err) {
      console.error('[ChatRoom.buildNewMessageEvents] users query error:', err.message);
    }

    return {
      sender: {
        type: 'new_message',
        chatId,
        partnerId: receiverId,
        conversation: senderConversation,
      },
      receiver: {
        type: 'new_message',
        chatId,
        partnerId: senderId,
        unreadDelta: 1,
        conversationUnreadDelta: 1,
        conversation: receiverConversation,
      },
    };
  }

  async getChatId() {
    if (this.chatId) return this.chatId;
    const stored = await this.state.storage.get('chatId');
    this.chatId = stored || null;
    return this.chatId;
  }

  async rememberChatId(chatId) {
    if (!chatId || this.chatId === chatId) return;
    this.chatId = chatId;
    await this.state.storage.put('chatId', chatId);
  }

  async getDailyLimit() {
    const now = Date.now();
    if (this.dailyLimitCache.value != null && now < this.dailyLimitCache.expiresAt) {
      return this.dailyLimitCache.value;
    }

    const limitSetting = await this.env.DB.prepare(
      "SELECT value FROM site_settings WHERE key = 'daily_message_limit'"
    ).first();
    const dailyLimit = parseInt(limitSetting?.value || '5', 10);
    this.dailyLimitCache = {
      value: dailyLimit,
      expiresAt: now + 60_000,
    };
    return dailyLimit;
  }

  async getSenderStatus(userId) {
    const now = Date.now();
    const cached = this.userStatusCache.get(userId);
    if (cached && now < cached.expiresAt) {
      return cached;
    }

    const sender = await this.env.DB.prepare(
      'SELECT premium, premium_until FROM users WHERE id = ?'
    ).bind(userId).first();

    const next = {
      isPremium: !!(sender && sender.premium && sender.premium_until &&
        new Date(sender.premium_until.endsWith('Z') ? sender.premium_until : sender.premium_until + 'Z') > new Date()),
      expiresAt: now + 60_000,
    };

    this.userStatusCache.set(userId, next);
    return next;
  }

  async init() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_msg_created ON messages(created_at);
    `);
  }

  async fetch(request) {
    await this.initPromise;

    const url = new URL(request.url);

    // Handle cleanup request from admin
    if (url.pathname === '/cleanup') {
      return this.handleCleanup();
    }

    // Handle notify — broadcast a new message to connected sockets (from HTTP send)
    if (url.pathname === '/notify') {
      return this.handleNotify(request);
    }

    // WebSocket upgrade
    const upgrade = request.headers.get('Upgrade');
    if (!upgrade || upgrade !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const userId = url.searchParams.get('userId');
    if (!userId) {
      return new Response('Missing userId', { status: 400 });
    }

    // Extract chatId: may be in query params (old) or in URL path (new: /api/chat/ws/{chatId})
    const chatId = url.searchParams.get('chatId') || url.pathname.split('/').pop();
    if (chatId) {
      await this.rememberChatId(chatId);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernation API: tag the socket with the userId
    this.state.acceptWebSocket(server, [userId]);

    // Send message history to the new connection
    this.state.waitUntil(this.sendHistory(server));

    return new Response(null, { status: 101, webSocket: client });
  }

  async sendHistory(ws) {
    try {
      const rows = this.sql.exec(
        'SELECT id, sender_id, content, is_read, created_at FROM messages ORDER BY created_at DESC LIMIT 30'
      ).toArray().reverse();

      ws.send(JSON.stringify({ type: 'history', messages: rows }));
    } catch (err) {
      console.error('sendHistory error:', err.message);
    }
  }

  // ── Hibernation event handlers ──

  async webSocketMessage(ws, rawMessage) {
    let data;
    try {
      data = JSON.parse(typeof rawMessage === 'string' ? rawMessage : new TextDecoder().decode(rawMessage));
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const [senderTag] = this.state.getTags(ws);
    const senderId = senderTag;

    if (data.type === 'message') {
      await this.handleMessage(ws, senderId, data);
    } else if (data.type === 'read') {
      await this.handleRead(ws, senderId, data);
    } else if (data.type === 'typing') {
      // Broadcast typing indicator to other sockets in this ChatRoom
      for (const sock of this.state.getWebSockets()) {
        const [tag] = this.state.getTags(sock);
        if (tag !== senderId) {
          try { sock.send(JSON.stringify({ type: 'typing', userId: senderId })); } catch {}
        }
      }
    } else if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }

  async handleMessage(ws, senderId, data) {
    const content = data.content?.trim();
    if (!content) return;

    // Collect other connected sockets for broadcast
    const allSockets = this.state.getWebSockets();
    const otherSockets = [];
    let receiverId = null;

    for (const sock of allSockets) {
      const [tag] = this.state.getTags(sock);
      if (tag !== senderId) {
        otherSockets.push(sock);
        receiverId = tag;
      }
    }

    // Derive receiverId from stored chatId if receiver is not connected
    if (!receiverId) {
      const chatId = await this.getChatId();
      if (chatId) {
        // chatId = "uuid1-uuid2" where each UUID is 36 chars (8-4-4-4-12)
        // Split at position 36 (the separator hyphen between the two UUIDs)
        const id1 = chatId.slice(0, 36);
        const id2 = chatId.slice(37);
        receiverId = id1 !== senderId ? id1 : id2;
      }
    }

    // Check daily message limit via D1
    try {
      const today = new Date().toISOString().slice(0, 10);
      const senderStatus = await this.getSenderStatus(senderId);
      const isPremium = senderStatus.isPremium;

      if (!isPremium) {
        const dailyLimit = await this.getDailyLimit();

        const limitRow = await this.env.DB.prepare(
          'SELECT msg_count FROM message_limits WHERE user_id = ? AND date_utc = ?'
        ).bind(senderId, today).first();

        const currentCount = limitRow?.msg_count || 0;
        if (currentCount >= dailyLimit) {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'LIMIT_REACHED',
            message: `Has alcanzado el límite de ${dailyLimit} mensajes diarios. Desbloquea VIP para mensajes ilimitados.`,
            remaining: 0,
            max: dailyLimit,
          }));
          return;
        }

        // Increment counter
        if (limitRow) {
          await this.env.DB.prepare(
            'UPDATE message_limits SET msg_count = msg_count + 1 WHERE user_id = ? AND date_utc = ?'
          ).bind(senderId, today).run();
        } else {
          await this.env.DB.prepare(
            'INSERT INTO message_limits (user_id, date_utc, msg_count) VALUES (?, ?, 1)'
          ).bind(senderId, today).run();
        }

        // Send remaining count
        const newCount = currentCount + 1;
        ws.send(JSON.stringify({
          type: 'limit',
          remaining: dailyLimit - newCount,
          max: dailyLimit,
          canSend: newCount < dailyLimit,
        }));
      }
    } catch (err) {
      console.error('Limit check error:', err.message);
      // Don't block message on limit check failure
    }

    const msgId = crypto.randomUUID();
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // Save to DO SQLite (instant)
    this.sql.exec(
      'INSERT INTO messages (id, sender_id, content, created_at) VALUES (?, ?, ?, ?)',
      msgId, senderId, content, now
    );

    const msg = {
      id: msgId,
      sender_id: senderId,
      content,
      is_read: 0,
      created_at: now,
    };

    // Send ack to sender
    ws.send(JSON.stringify({ type: 'ack', message: msg }));

    // Broadcast to receiver(s)
    for (const sock of otherSockets) {
      try {
        sock.send(JSON.stringify({ type: 'message', message: msg }));
      } catch { /* socket might be closed */ }
    }

    // Async: write to D1 (source of truth) + notify UserNotification DOs
    if (receiverId) {
      const chatId = [senderId, receiverId].sort().join('-');
      this.state.waitUntil((async () => {
        this.debug('[ChatRoom.handleMessage] waitUntil started, chatId:', chatId, 'sender:', senderId, 'receiver:', receiverId);
        // Write to D1
        await this.env.DB.prepare(
          'INSERT INTO messages (id, sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(msgId, senderId, receiverId, content, now).run().catch(err => {
          console.error('D1 message write error:', err.message);
        });
        this.debug('[ChatRoom.handleMessage] D1 write done');
        // Notify UserNotification DOs so ChatListPage updates in real-time
        const events = await this.buildNewMessageEvents(senderId, receiverId, msg);
        for (const userId of [senderId, receiverId]) {
          try {
            this.debug('[ChatRoom.handleMessage] notifying UserNotification for:', userId);
            const doId = this.env.USER_NOTIFICATIONS.idFromName(userId);
            const stub = this.env.USER_NOTIFICATIONS.get(doId);
            const res = await stub.fetch('https://do/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(userId === senderId ? events.sender : events.receiver),
            });
            this.debug('[ChatRoom.handleMessage] UserNotification response:', res.status, 'for:', userId);
          } catch (err) {
            console.error('[ChatRoom.handleMessage] UserNotification error for', userId, ':', err.message);
          }
        }
        this.debug('[ChatRoom.handleMessage] waitUntil done');
      })());
    } else {
      this.debug('[ChatRoom.handleMessage] NO receiverId - skipping D1 write and notifications');
    }
  }

  async handleRead(ws, readerId, data) {
    const { messageIds } = data;
    if (!Array.isArray(messageIds) || messageIds.length === 0) return;

    // Update DO SQLite
    for (const mid of messageIds) {
      this.sql.exec('UPDATE messages SET is_read = 1 WHERE id = ?', mid);
    }

    // Notify other sockets
    const allSockets = this.state.getWebSockets();
    for (const sock of allSockets) {
      const [tag] = this.state.getTags(sock);
      if (tag !== readerId) {
        try {
          sock.send(JSON.stringify({ type: 'read', messageIds }));
        } catch { /* ignore */ }
      }
    }

    // Async: update D1
    this.state.waitUntil((async () => {
      for (const mid of messageIds) {
        await this.env.DB.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').bind(mid).run().catch(() => {});
      }
    })());
  }

  async handleNotify(request) {
    try {
      const msg = await request.json();
      const sockets = this.state.getWebSockets();
      this.debug('[ChatRoom.handleNotify] sockets:', sockets.length, 'sender:', msg.sender_id);
      // Broadcast to all connected sockets except the sender
      for (const sock of sockets) {
        const [tag] = this.state.getTags(sock);
        if (tag !== msg.sender_id) {
          try {
            sock.send(JSON.stringify({ type: 'message', message: msg }));
            this.debug('[ChatRoom.handleNotify] sent to:', tag);
          } catch { /* socket might be closed */ }
        }
      }
      return new Response('ok', { status: 200 });
    } catch (e) {
      console.error('[ChatRoom.handleNotify] error:', e.message);
      return new Response('error', { status: 500 });
    }
  }

  async handleCleanup() {
    const deleted = this.sql.exec(
      "DELETE FROM messages WHERE created_at < datetime('now', '-30 days')"
    );
    return new Response(JSON.stringify({ cleaned: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async webSocketClose(ws, code, reason) {
    // Code 1006 is reserved (abnormal closure) and cannot be sent by app code
    try { ws.close(1000, 'Connection closed'); } catch { /* already closed */ }
  }

  async webSocketError(ws, error) {
    console.error('WebSocket error:', error);
    try { ws.close(1011, 'WebSocket error'); } catch { /* already closed */ }
  }
}
