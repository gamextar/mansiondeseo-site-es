const REALTIME_DEBUG_EVENT = 'mansion-realtime-debug-update';

function createChannelState() {
  return {
    connectAttempts: 0,
    opens: 0,
    closes: 0,
    errors: 0,
    reconnectsScheduled: 0,
    pingsSent: 0,
    pongsReceived: 0,
    messagesReceived: 0,
    messagesSent: 0,
    activeConnections: 0,
    backgroundPauses: 0,
  };
}

function snapshotChannel(channel) {
  return { ...channel };
}

function getRealtimeDebugController() {
  if (typeof window === 'undefined') return null;
  if (window.__mansionRealtimeDebug) return window.__mansionRealtimeDebug;

  const state = {
    channels: {
      notifications: createChannelState(),
      chat: createChannelState(),
    },
  };

  const emitUpdate = () => {
    window.dispatchEvent(new CustomEvent(REALTIME_DEBUG_EVENT, {
      detail: {
        channels: {
          notifications: snapshotChannel(state.channels.notifications),
          chat: snapshotChannel(state.channels.chat),
        },
      },
    }));
  };

  const controller = {
    record(channelName, metric, delta = 1) {
      const channel = state.channels[channelName];
      if (!channel || typeof channel[metric] !== 'number') return;
      channel[metric] += delta;
      if (metric === 'opens') {
        channel.activeConnections += delta;
      } else if (metric === 'closes') {
        channel.activeConnections = Math.max(0, channel.activeConnections - delta);
      }
      emitUpdate();
    },
    setActiveConnections(channelName, value) {
      const channel = state.channels[channelName];
      if (!channel) return;
      channel.activeConnections = Math.max(0, Number(value) || 0);
      emitUpdate();
    },
    reset() {
      state.channels.notifications = createChannelState();
      state.channels.chat = createChannelState();
      emitUpdate();
      return this.summary();
    },
    summary() {
      return {
        channels: {
          notifications: snapshotChannel(state.channels.notifications),
          chat: snapshotChannel(state.channels.chat),
        },
      };
    },
  };

  window.__mansionRealtimeDebug = controller;
  return controller;
}

export function recordRealtimeDebug(channelName, metric, delta = 1) {
  getRealtimeDebugController()?.record(channelName, metric, delta);
}

export function setRealtimeActiveConnections(channelName, value) {
  getRealtimeDebugController()?.setActiveConnections(channelName, value);
}

export function getRealtimeDebugSummary() {
  return getRealtimeDebugController()?.summary() || null;
}

export function resetRealtimeDebug() {
  return getRealtimeDebugController()?.reset() || null;
}

export function subscribeRealtimeDebug(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => listener(event.detail);
  window.addEventListener(REALTIME_DEBUG_EVENT, handler);
  return () => window.removeEventListener(REALTIME_DEBUG_EVENT, handler);
}

if (typeof window !== 'undefined') {
  getRealtimeDebugController();
}
