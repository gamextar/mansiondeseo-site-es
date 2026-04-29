// ═══════════════════════════════════════════════════════
// MANSIÓN DESEO — ChatRoom Durable Object
// WebSocket Hibernation + D1-backed history
// ═══════════════════════════════════════════════════════

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.hiddenConversationsReady = null;
    this.messageLimitSettingsCache = { value: null, expiresAt: 0 };
    this.userStatusCache = new Map();
    this.userPreviewCache = new Map();
    this.messageConversationIdReady = null;
    this.messageAttachmentColumnsReady = null;
    this.senderConversationStateWriteAt = new Map();
    this.userMessageBlockRolesColumnReady = null;
    this.userBlocksReady = null;
  }

  normalizeRoleArray(rawValue, validValues, fallback = []) {
    const arr = Array.isArray(rawValue) ? rawValue : (rawValue ? [rawValue] : []);
    const filtered = arr
      .map((value) => String(value || '').trim())
      .filter((value) => validValues.includes(value));
    return [...new Set(filtered.length ? filtered : fallback)];
  }

  mapRoleToDisplay(role) {
    const map = {
      hombre: 'Hombre Solo',
      mujer: 'Mujer Sola',
      pareja: 'Pareja',
      pareja_hombres: 'Pareja de Hombres',
      pareja_mujeres: 'Pareja de Mujeres',
      trans: 'Trans',
    };
    return map[role] || role;
  }

  buildConversationId(userA, userB) {
    return [String(userA), String(userB)].sort().join(':');
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
      lastMessage: this.getMessagePreviewText(msg),
      timestamp: msg.created_at,
      unread,
      online: this.isOnline(partner.last_active),
    };
  }

  getMessagePreviewText(msg) {
    const text = String(msg?.content || '').trim();
    if (text) return text.slice(0, 50);
    return msg?.image_url ? 'Imagen' : '';
  }

  async getUserPreview(userId) {
    const now = Date.now();
    const cached = this.userPreviewCache.get(userId);
    if (cached && now < cached.expiresAt) {
      return cached.value;
    }

    const user = await this.env.DB.prepare(
      'SELECT id, username, avatar_url, avatar_crop, last_active FROM users WHERE id = ?'
    ).bind(userId).first();

    if (user) {
      this.userPreviewCache.set(userId, {
        value: user,
        expiresAt: now + 60_000,
      });
    }

    return user || null;
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

  async ensureUsersMessageBlockRolesColumn() {
    if (!this.userMessageBlockRolesColumnReady) {
      this.userMessageBlockRolesColumnReady = (async () => {
        try {
          await this.env.DB.prepare(
            'ALTER TABLE users ADD COLUMN message_block_roles TEXT'
          ).run();
        } catch (err) {
          const message = String(err?.message || err || '').toLowerCase();
          if (!message.includes('duplicate column name') && !message.includes('already exists')) {
            throw err;
          }
        }
      })().catch((err) => {
        this.userMessageBlockRolesColumnReady = null;
        throw err;
      });
    }

    return this.userMessageBlockRolesColumnReady;
  }

  async ensureUserBlocksTable() {
    if (!this.userBlocksReady) {
      this.userBlocksReady = Promise.all([
        this.env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS user_blocks (
            blocker_id TEXT NOT NULL REFERENCES users(id),
            blocked_id TEXT NOT NULL REFERENCES users(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (blocker_id, blocked_id)
          )
        `).run(),
        this.env.DB.prepare(
          'CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id, blocker_id)'
        ).run(),
      ]).catch((err) => {
        this.userBlocksReady = null;
        throw err;
      });
    }

    return this.userBlocksReady;
  }

  async assertMessagingAllowed(senderId, receiverId) {
    await this.ensureUsersMessageBlockRolesColumn();
    await this.ensureUserBlocksTable();
    const [sender, receiver, blockRow] = await Promise.all([
      this.env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(senderId).first(),
      this.env.DB.prepare('SELECT id, message_block_roles FROM users WHERE id = ?').bind(receiverId).first(),
      this.env.DB.prepare(`
        SELECT blocker_id
        FROM user_blocks
        WHERE (blocker_id = ? AND blocked_id = ?)
           OR (blocker_id = ? AND blocked_id = ?)
        LIMIT 1
      `).bind(senderId, receiverId, receiverId, senderId).first(),
    ]);

    if (!receiver) {
      return { ok: false, code: 'RECEIVER_NOT_FOUND', message: 'Destinatario no encontrado.' };
    }

    if (blockRow) {
      const blockedByMe = String(blockRow.blocker_id) === String(senderId);
      return {
        ok: false,
        code: blockedByMe ? 'USER_BLOCKED_BY_ME' : 'USER_BLOCKED_ME',
        message: blockedByMe
          ? 'Desbloquea a este usuario para poder enviarle mensajes.'
          : 'Este usuario no acepta mensajes tuyos.',
      };
    }

    if (!sender?.role) {
      return { ok: true };
    }

    const blockedRoles = this.normalizeRoleArray(this.safeParseJSON(receiver.message_block_roles, []), ['hombre', 'mujer', 'pareja', 'pareja_hombres', 'pareja_mujeres', 'trans'], []);
    if (blockedRoles.includes(sender.role)) {
      return {
        ok: false,
        code: 'MESSAGE_ROLE_BLOCKED',
        message: `Este usuario no recibe mensajes de ${this.mapRoleToDisplay(sender.role)}.`,
      };
    }

    return { ok: true };
  }

  async buildNewMessageEvents(senderId, receiverId, msg) {
    await this.ensureHiddenConversationsTable();
    const chatId = [senderId, receiverId].sort().join('-');
    let senderConversation = null;
    let receiverConversation = null;

    try {
      const users = await Promise.all([
        this.getUserPreview(senderId),
        this.getUserPreview(receiverId),
      ]);

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

  async getUnreadCount(userId) {
    const row = await this.env.DB.prepare(
      'SELECT COALESCE(SUM(unread_count), 0) as unread FROM conversation_state WHERE user_id = ?'
    ).bind(userId).first();
    return Number(row?.unread || 0);
  }

  async notifyUser(userId, data) {
    const doId = this.env.USER_NOTIFICATIONS.idFromName(userId);
    const stub = this.env.USER_NOTIFICATIONS.get(doId);
    return stub.fetch('https://do/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  normalizeMessageLimitWindowHours(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 12;
    return Math.max(1, Math.min(168, Math.round(parsed)));
  }

  async getMessageLimitSettings() {
    const now = Date.now();
    if (this.messageLimitSettingsCache.value && now < this.messageLimitSettingsCache.expiresAt) {
      return this.messageLimitSettingsCache.value;
    }

    const { results = [] } = await this.env.DB.prepare(
      "SELECT key, value FROM site_settings WHERE key IN ('daily_message_limit', 'message_limit_window_hours')"
    ).all();
    const settings = Object.fromEntries(results.map((row) => [row.key, row.value]));
    const maxMessages = parseInt(settings.daily_message_limit || '5', 10);
    const value = {
      maxMessages: Number.isFinite(maxMessages) ? Math.max(1, maxMessages) : 5,
      windowHours: this.normalizeMessageLimitWindowHours(settings.message_limit_window_hours),
    };
    this.messageLimitSettingsCache = {
      value,
      expiresAt: now + 60_000,
    };
    return value;
  }

  getMessageLimitWindowUTC(hours = 12, date = new Date()) {
    const windowHours = this.normalizeMessageLimitWindowHours(hours);
    const windowMs = windowHours * 60 * 60 * 1000;
    const bucket = Math.floor(date.getTime() / windowMs);
    const bucketStart = new Date(bucket * windowMs);
    const bucketStamp = bucketStart.toISOString().replace(/[-:]/g, '').slice(0, 11);
    return `${windowHours}h-${bucketStamp}`;
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

  getSocketChatId(ws) {
    try {
      const tags = this.state.getTags(ws);
      if (tags?.[1]) return tags[1];
    } catch {}

    return null;
  }

  getPartnerIdFromChatId(chatId, userId) {
    const match = String(chatId || '').match(/^([0-9a-f-]{36})-([0-9a-f-]{36})$/i);
    if (!match) return null;
    const [, id1, id2] = match;
    const safeUserId = String(userId);
    if (id1 === safeUserId) return id2;
    if (id2 === safeUserId) return id1;
    return null;
  }

  async ensureConversationStateTables() {
    if (!this.conversationStateReady) {
      this.conversationStateReady = Promise.all([
        this.env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS conversation_state (
            user_id TEXT NOT NULL REFERENCES users(id),
            partner_id TEXT NOT NULL REFERENCES users(id),
            last_message TEXT NOT NULL DEFAULT '',
            last_message_at TEXT NOT NULL,
            unread_count INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (user_id, partner_id)
          )
        `).run(),
        this.env.DB.prepare(
          'CREATE INDEX IF NOT EXISTS idx_conversation_state_user_last ON conversation_state(user_id, last_message_at DESC)'
        ).run(),
      ]).catch((err) => {
        this.conversationStateReady = null;
        throw err;
      });
    }

    return this.conversationStateReady;
  }

  async ensureMessageConversationIdColumn() {
    if (!this.messageConversationIdReady) {
      this.messageConversationIdReady = (async () => {
        try {
          await this.env.DB.prepare('ALTER TABLE messages ADD COLUMN conversation_id TEXT').run();
        } catch (err) {
          const message = String(err?.message || '').toLowerCase();
          if (!message.includes('duplicate column name')) {
            throw err;
          }
        }

        await Promise.all([
          this.env.DB.prepare(
            'CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at)'
          ).run(),
          this.env.DB.prepare(
            'CREATE INDEX IF NOT EXISTS idx_messages_conversation_receiver_unread ON messages(conversation_id, receiver_id, is_read, created_at)'
          ).run(),
        ]);
      })().catch((err) => {
        this.messageConversationIdReady = null;
        throw err;
      });
    }

    return this.messageConversationIdReady;
  }

  async ensureMessageAttachmentColumns() {
    if (!this.messageAttachmentColumnsReady) {
      this.messageAttachmentColumnsReady = (async () => {
        await this.ensureMessageConversationIdColumn();
        const columns = [
          ['image_url', "TEXT NOT NULL DEFAULT ''"],
          ['image_thumb_url', "TEXT NOT NULL DEFAULT ''"],
          ['image_mime', "TEXT NOT NULL DEFAULT ''"],
        ];
        for (const [name, definition] of columns) {
          try {
            await this.env.DB.prepare(`ALTER TABLE messages ADD COLUMN ${name} ${definition}`).run();
          } catch (err) {
            const message = String(err?.message || '').toLowerCase();
            if (!message.includes('duplicate column name')) {
              throw err;
            }
          }
        }
      })().catch((err) => {
        this.messageAttachmentColumnsReady = null;
        throw err;
      });
    }

    return this.messageAttachmentColumnsReady;
  }

  async syncConversationStateForMessage(senderId, receiverId, msg) {
    await this.ensureConversationStateTables();
    const lastMessage = this.getMessagePreviewText(msg);
    const senderKey = `${senderId}:${receiverId}`;
    const nowMs = Date.now();
    const lastSenderWriteAt = this.senderConversationStateWriteAt.get(senderKey) || 0;
    const shouldWriteSender = (nowMs - lastSenderWriteAt) >= 2_000;

    const writes = [
      this.env.DB.prepare(
        `INSERT INTO conversation_state (user_id, partner_id, last_message, last_message_at, unread_count, updated_at)
         VALUES (?, ?, ?, ?, 1, datetime('now'))
         ON CONFLICT(user_id, partner_id) DO UPDATE SET
           last_message = excluded.last_message,
           last_message_at = excluded.last_message_at,
           unread_count = conversation_state.unread_count + 1,
           updated_at = excluded.updated_at`
      ).bind(receiverId, senderId, lastMessage, msg.created_at).run(),
    ];

    if (shouldWriteSender) {
      this.senderConversationStateWriteAt.set(senderKey, nowMs);
      writes.push(
        this.env.DB.prepare(
          `INSERT INTO conversation_state (user_id, partner_id, last_message, last_message_at, unread_count, updated_at)
           VALUES (?, ?, ?, ?, 0, datetime('now'))
           ON CONFLICT(user_id, partner_id) DO UPDATE SET
             last_message = excluded.last_message,
             last_message_at = excluded.last_message_at,
             unread_count = 0,
             updated_at = excluded.updated_at`
        ).bind(senderId, receiverId, lastMessage, msg.created_at).run()
      );
    }

    await Promise.all(writes);
  }

  async clearConversationStateUnread(userId, partnerId) {
    await this.ensureConversationStateTables();
    await this.env.DB.prepare(
      'UPDATE conversation_state SET unread_count = 0, updated_at = datetime(\'now\') WHERE user_id = ? AND partner_id = ?'
    ).bind(userId, partnerId).run();
  }

  async rebuildConversationStateForPair(userA, userB) {
    await this.ensureConversationStateTables();
    await this.ensureMessageAttachmentColumns();
    const conversationId = this.buildConversationId(userA, userB);

    const rebuildForUser = async (userId, partnerId) => {
      const hiddenRow = await this.env.DB.prepare(
        'SELECT hidden_before FROM hidden_conversations WHERE user_id = ? AND partner_id = ?'
      ).bind(userId, partnerId).first();
      const hiddenBefore = hiddenRow?.hidden_before || null;

      const latestMessage = await this.env.DB.prepare(`
        SELECT content, image_url, created_at
        FROM messages
        WHERE conversation_id = ?
          AND (? IS NULL OR created_at > ?)
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(conversationId, hiddenBefore, hiddenBefore).first();

      if (!latestMessage) {
        await this.env.DB.prepare(
          'DELETE FROM conversation_state WHERE user_id = ? AND partner_id = ?'
        ).bind(userId, partnerId).run();
        return;
      }

      const unreadRow = await this.env.DB.prepare(`
        SELECT COUNT(*) as unread
        FROM messages
        WHERE conversation_id = ?
          AND receiver_id = ?
          AND is_read = 0
          AND (? IS NULL OR created_at > ?)
      `).bind(conversationId, userId, hiddenBefore, hiddenBefore).first();

      await this.env.DB.prepare(
        `INSERT INTO conversation_state (user_id, partner_id, last_message, last_message_at, unread_count, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, partner_id) DO UPDATE SET
           last_message = excluded.last_message,
           last_message_at = excluded.last_message_at,
           unread_count = excluded.unread_count,
           updated_at = excluded.updated_at`
      ).bind(
        userId,
        partnerId,
        this.getMessagePreviewText(latestMessage),
        latestMessage.created_at,
        Number(unreadRow?.unread || 0),
      ).run();
    };

    await Promise.all([
      rebuildForUser(userA, userB),
      rebuildForUser(userB, userA),
    ]);
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Handle notify — broadcast a new message to connected sockets (from HTTP send)
    if (url.pathname === '/notify') {
      return this.handleNotify(request);
    }

    if (url.pathname === '/read') {
      return this.handleNotifyRead(request);
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

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernation API: tag socket with userId and chatId so we do not need
    // per-room Durable Object storage just to remember the conversation.
    this.state.acceptWebSocket(server, chatId ? [userId, chatId] : [userId]);

    if (url.searchParams.get('history') !== '0') {
      // Legacy clients can still ask the room for history. New clients load
      // history over HTTP so this object stays focused on realtime delivery.
      this.state.waitUntil(this.sendHistory(server, userId, chatId));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async sendHistory(ws, userId, chatId) {
    try {
      const partnerId = this.getPartnerIdFromChatId(chatId, userId);

      if (userId && partnerId) {
        await this.ensureHiddenConversationsTable();
        await this.ensureMessageAttachmentColumns();

        const conversationId = this.buildConversationId(userId, partnerId);
        const hiddenRow = await this.env.DB.prepare(
          'SELECT hidden_before FROM hidden_conversations WHERE user_id = ? AND partner_id = ?'
        ).bind(userId, partnerId).first();
        const hiddenBefore = hiddenRow?.hidden_before || null;
        const queryLimit = 31;

        const { results } = await this.env.DB.prepare(`
          SELECT id, sender_id, content, image_url, image_thumb_url, image_mime, is_read, created_at
          FROM (
            SELECT id, sender_id, content, image_url, image_thumb_url, image_mime, is_read, created_at
            FROM messages
            WHERE conversation_id = ?
              AND (? IS NULL OR created_at > ?)
            ORDER BY created_at DESC
            LIMIT ?
          )
          ORDER BY created_at ASC
        `).bind(conversationId, hiddenBefore, hiddenBefore, queryLimit).all();

        const hasMore = results.length > 30;
        const rows = hasMore ? results.slice(1) : results;

        ws.send(JSON.stringify({ type: 'history', messages: rows, hasMore }));
        return;
      }

      ws.send(JSON.stringify({ type: 'history', messages: [], hasMore: false }));
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
      const chatId = this.getSocketChatId(ws);
      receiverId = this.getPartnerIdFromChatId(chatId, senderId);
    }

    if (receiverId) {
      const messagingAllowed = await this.assertMessagingAllowed(senderId, receiverId);
      if (!messagingAllowed.ok) {
        ws.send(JSON.stringify({
          type: 'error',
          code: messagingAllowed.code || 'MESSAGE_BLOCKED',
          message: messagingAllowed.message || 'No se pudo enviar el mensaje.',
        }));
        return;
      }
    }

    // Check free-user message limit via D1 in the configured window.
    try {
      const senderStatus = await this.getSenderStatus(senderId);
      const isPremium = senderStatus.isPremium;

      if (!isPremium) {
        const limitSettings = await this.getMessageLimitSettings();
        const dailyLimit = limitSettings.maxMessages;
        const windowHours = limitSettings.windowHours;
        const limitWindow = this.getMessageLimitWindowUTC(windowHours);

        const limitRow = await this.env.DB.prepare(
          'SELECT msg_count FROM message_limits WHERE user_id = ? AND date_utc = ?'
        ).bind(senderId, limitWindow).first();

        const currentCount = limitRow?.msg_count || 0;
        if (currentCount >= dailyLimit) {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'LIMIT_REACHED',
            message: `Has alcanzado el límite de ${dailyLimit} mensajes cada ${windowHours} horas. Desbloquea VIP para mensajes ilimitados.`,
            remaining: 0,
            max: dailyLimit,
            windowHours,
          }));
          return;
        }

        // Increment counter
        if (limitRow) {
          await this.env.DB.prepare(
            'UPDATE message_limits SET msg_count = msg_count + 1 WHERE user_id = ? AND date_utc = ?'
          ).bind(senderId, limitWindow).run();
        } else {
          await this.env.DB.prepare(
            'INSERT INTO message_limits (user_id, date_utc, msg_count) VALUES (?, ?, 1)'
          ).bind(senderId, limitWindow).run();
        }

        // Send remaining count
        const newCount = currentCount + 1;
        ws.send(JSON.stringify({
          type: 'limit',
          remaining: dailyLimit - newCount,
          max: dailyLimit,
          canSend: newCount < dailyLimit,
          windowHours,
        }));
      }
    } catch (err) {
      console.error('Limit check error:', err.message);
      // Don't block message on limit check failure
    }

    const msgId = crypto.randomUUID();
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

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
      const conversationId = this.buildConversationId(senderId, receiverId);
      this.state.waitUntil((async () => {
        this.debug('[ChatRoom.handleMessage] waitUntil started, chatId:', chatId, 'sender:', senderId, 'receiver:', receiverId);
        await this.ensureMessageConversationIdColumn().catch((err) => {
          console.error('messages conversation_id ensure error:', err.message);
        });
        // Write to D1
        await this.env.DB.prepare(
          'INSERT INTO messages (id, sender_id, receiver_id, content, created_at, conversation_id) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(msgId, senderId, receiverId, content, now, conversationId).run().catch(err => {
          console.error('D1 message write error:', err.message);
        });
        await this.syncConversationStateForMessage(senderId, receiverId, msg).catch((err) => {
          console.error('conversation_state sync error:', err.message);
          return this.rebuildConversationStateForPair(senderId, receiverId).catch((repairErr) => {
            console.error('conversation_state repair error:', repairErr.message);
          });
        });
        this.debug('[ChatRoom.handleMessage] D1 write done');
        // Notify only the receiver's UserNotification DO.
        // Sender-side conversation previews are synchronized locally in the browser.
        const events = await this.buildNewMessageEvents(senderId, receiverId, msg);
        const receiverUnreadCount = await this.getUnreadCount(receiverId).catch(() => null);
        if (receiverUnreadCount !== null) events.receiver.unreadCount = receiverUnreadCount;
        try {
          this.debug('[ChatRoom.handleMessage] notifying UserNotification for:', receiverId);
          const res = await this.notifyUser(receiverId, events.receiver);
          this.debug('[ChatRoom.handleMessage] UserNotification response:', res.status, 'for:', receiverId);
        } catch (err) {
          console.error('[ChatRoom.handleMessage] UserNotification error for', receiverId, ':', err.message);
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

    const uniqueMessageIds = [...new Set(messageIds.filter((id) => typeof id === 'string' && id))];
    if (uniqueMessageIds.length === 0) return;

    const chunkSize = 50;

    // Notify other sockets
    const allSockets = this.state.getWebSockets();
    for (const sock of allSockets) {
      const [tag] = this.state.getTags(sock);
      if (tag !== readerId) {
        try {
          sock.send(JSON.stringify({ type: 'read', messageIds: uniqueMessageIds }));
        } catch { /* ignore */ }
      }
    }

    // Async: update D1
    this.state.waitUntil((async () => {
      const chatId = this.getSocketChatId(ws);
      const partnerId = this.getPartnerIdFromChatId(chatId, readerId);
      for (let index = 0; index < uniqueMessageIds.length; index += chunkSize) {
        const chunk = uniqueMessageIds.slice(index, index + chunkSize);
        const placeholders = chunk.map(() => '?').join(', ');
        await this.env.DB.prepare(`UPDATE messages SET is_read = 1 WHERE id IN (${placeholders})`)
          .bind(...chunk)
          .run()
          .catch(() => {});
      }
      if (partnerId) {
        await this.clearConversationStateUnread(readerId, partnerId).catch(() => {});
        const unreadCount = await this.getUnreadCount(readerId).catch(() => null);
        if (unreadCount !== null) {
          await this.notifyUser(readerId, {
            type: 'unread_count',
            unreadCount,
          }).catch(() => {});
        }
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

  async handleNotifyRead(request) {
    try {
      const data = await request.json();
      const readerId = String(data?.readerId || '');
      const messageIds = Array.isArray(data?.messageIds) ? data.messageIds : [];
      const uniqueMessageIds = [...new Set(messageIds.filter((id) => typeof id === 'string' && id))];
      if (!readerId || uniqueMessageIds.length === 0) {
        return new Response('ok', { status: 200 });
      }

      for (const sock of this.state.getWebSockets()) {
        const [tag] = this.state.getTags(sock);
        if (tag !== readerId) {
          try {
            sock.send(JSON.stringify({ type: 'read', messageIds: uniqueMessageIds }));
          } catch { /* socket might be closed */ }
        }
      }
      return new Response('ok', { status: 200 });
    } catch (e) {
      console.error('[ChatRoom.handleNotifyRead] error:', e.message);
      return new Response('error', { status: 500 });
    }
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
