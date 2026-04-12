const STORAGE_KEY = 'mansion_debug_panel_prefs';
const EVENT_NAME = 'mansion-debug-panel-prefs-update';

const DEFAULT_PREFS = {
  api: true,
  realtime: true,
  livefeed: false,
  media: false,
};

function readPrefs() {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_PREFS, ...(parsed || {}) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function emit(prefs) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: prefs }));
}

export function getDebugPanelPrefs() {
  return readPrefs();
}

export function setDebugPanelPref(key, value) {
  if (typeof window === 'undefined') return readPrefs();
  const next = { ...readPrefs(), [key]: !!value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  emit(next);
  return next;
}

export function subscribeDebugPanelPrefs(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => listener(event.detail || readPrefs());
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
