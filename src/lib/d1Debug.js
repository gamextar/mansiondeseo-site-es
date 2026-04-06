const D1_DEBUG_EVENT = 'mansion-d1-debug-update';

function createActionState() {
  return {
    count: 0,
    estimatedWrites: 0,
  };
}

function snapshotAction(action) {
  return { ...action };
}

function getD1DebugController() {
  if (typeof window === 'undefined') return null;
  if (window.__mansionD1Debug) return window.__mansionD1Debug;

  const state = {
    startedAt: Date.now(),
    totals: {
      estimatedWrites: 0,
    },
    actions: {
      chat_message_ws: createActionState(),
      chat_message_http: createActionState(),
      chat_read: createActionState(),
      chat_delete: createActionState(),
    },
  };

  const emitUpdate = () => {
    window.dispatchEvent(new CustomEvent(D1_DEBUG_EVENT, {
      detail: {
        startedAt: state.startedAt,
        elapsedMs: Date.now() - state.startedAt,
        totals: { ...state.totals },
        actions: {
          chat_message_ws: snapshotAction(state.actions.chat_message_ws),
          chat_message_http: snapshotAction(state.actions.chat_message_http),
          chat_read: snapshotAction(state.actions.chat_read),
          chat_delete: snapshotAction(state.actions.chat_delete),
        },
      },
    }));
  };

  const controller = {
    record(actionName, estimatedWrites = 0) {
      const action = state.actions[actionName];
      if (!action) return;
      const writes = Math.max(0, Number(estimatedWrites) || 0);
      action.count += 1;
      action.estimatedWrites += writes;
      state.totals.estimatedWrites += writes;
      emitUpdate();
    },
    reset() {
      state.startedAt = Date.now();
      state.totals = { estimatedWrites: 0 };
      state.actions = {
        chat_message_ws: createActionState(),
        chat_message_http: createActionState(),
        chat_read: createActionState(),
        chat_delete: createActionState(),
      };
      emitUpdate();
      return this.summary();
    },
    summary() {
      return {
        startedAt: state.startedAt,
        elapsedMs: Date.now() - state.startedAt,
        totals: { ...state.totals },
        actions: {
          chat_message_ws: snapshotAction(state.actions.chat_message_ws),
          chat_message_http: snapshotAction(state.actions.chat_message_http),
          chat_read: snapshotAction(state.actions.chat_read),
          chat_delete: snapshotAction(state.actions.chat_delete),
        },
      };
    },
  };

  window.__mansionD1Debug = controller;
  return controller;
}

export function recordD1WriteEstimate(actionName, estimatedWrites) {
  getD1DebugController()?.record(actionName, estimatedWrites);
}

export function getD1DebugSummary() {
  return getD1DebugController()?.summary() || null;
}

export function resetD1Debug() {
  return getD1DebugController()?.reset() || null;
}

export function subscribeD1Debug(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => listener(event.detail);
  window.addEventListener(D1_DEBUG_EVENT, handler);
  return () => window.removeEventListener(D1_DEBUG_EVENT, handler);
}

if (typeof window !== 'undefined') {
  getD1DebugController();
}
