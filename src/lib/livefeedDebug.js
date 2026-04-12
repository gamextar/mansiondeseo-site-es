const LIVEFEED_DEBUG_EVENT = 'mansion-livefeed-debug-update';

function snapshotState(state) {
  return {
    startedAt: state.startedAt,
    elapsedMs: Date.now() - state.startedAt,
    totals: { ...state.totals },
    lastCurrent: state.lastCurrent ? { ...state.lastCurrent } : null,
    lastPayload: state.lastPayload ? { ...state.lastPayload } : null,
    lastError: state.lastError || '',
  };
}

function getLivefeedDebugController() {
  if (typeof window === 'undefined') return null;
  if (window.__mansionLivefeedDebugController) return window.__mansionLivefeedDebugController;

  const state = {
    startedAt: Date.now(),
    totals: {
      currentNetwork: 0,
      currentMemory: 0,
      currentDeduped: 0,
      payloadNetwork: 0,
      errors: 0,
    },
    lastCurrent: null,
    lastPayload: null,
    lastError: '',
  };

  const emitUpdate = () => {
    const detail = snapshotState(state);
    window.__mansionLivefeedDebug = detail;
    window.dispatchEvent(new CustomEvent(LIVEFEED_DEBUG_EVENT, { detail }));
  };

  const controller = {
    recordCurrent(source, snapshot) {
      const normalizedSource = source === 'memory' || source === 'deduped' ? source : 'network';
      if (normalizedSource === 'memory') state.totals.currentMemory += 1;
      else if (normalizedSource === 'deduped') state.totals.currentDeduped += 1;
      else state.totals.currentNetwork += 1;

      state.lastCurrent = {
        source: normalizedSource,
        version: String(snapshot?.version || ''),
        fetchedAt: new Date().toISOString(),
      };
      state.lastError = '';
      emitUpdate();
    },
    recordPayload(snapshot, url = '') {
      state.totals.payloadNetwork += 1;
      state.lastPayload = {
        version: String(snapshot?.version || ''),
        url: String(url || ''),
        fetchedAt: new Date().toISOString(),
      };
      state.lastError = '';
      emitUpdate();
    },
    recordError(error) {
      state.totals.errors += 1;
      state.lastError = String(error?.message || error || 'Error desconocido');
      emitUpdate();
    },
    reset() {
      state.startedAt = Date.now();
      state.totals = {
        currentNetwork: 0,
        currentMemory: 0,
        currentDeduped: 0,
        payloadNetwork: 0,
        errors: 0,
      };
      state.lastCurrent = null;
      state.lastPayload = null;
      state.lastError = '';
      emitUpdate();
      return this.summary();
    },
    summary() {
      return snapshotState(state);
    },
  };

  window.__mansionLivefeedDebugController = controller;
  emitUpdate();
  return controller;
}

export function recordLivefeedCurrentDebug(source, snapshot) {
  getLivefeedDebugController()?.recordCurrent(source, snapshot);
}

export function recordLivefeedPayloadDebug(snapshot, url) {
  getLivefeedDebugController()?.recordPayload(snapshot, url);
}

export function recordLivefeedDebugError(error) {
  getLivefeedDebugController()?.recordError(error);
}

export function getLivefeedDebugSummary() {
  return getLivefeedDebugController()?.summary() || null;
}

export function resetLivefeedDebug() {
  return getLivefeedDebugController()?.reset() || null;
}

export function subscribeLivefeedDebug(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => listener(event.detail);
  window.addEventListener(LIVEFEED_DEBUG_EVENT, handler);
  return () => window.removeEventListener(LIVEFEED_DEBUG_EVENT, handler);
}

if (typeof window !== 'undefined') {
  getLivefeedDebugController();
}
