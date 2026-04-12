const STORAGE_KEY = 'mansion_boot_debug_flags';
const EVENT_NAME = 'mansion-boot-debug-flags-update';

const DEFAULT_FLAGS = {
  bootShield: false,
  skipBootstrap: false,
  shellOnly: false,
};

function normalize(raw = {}) {
  return {
    bootShield: !!raw.bootShield,
    skipBootstrap: !!raw.skipBootstrap,
    shellOnly: !!raw.shellOnly,
  };
}

function readStoredFlags() {
  if (typeof window === 'undefined') return { ...DEFAULT_FLAGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_FLAGS, ...normalize(parsed || {}) };
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

function readQueryOverride(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  const value = new URLSearchParams(window.location.search).get(name);
  if (value === '1') return true;
  if (value === '0') return false;
  return fallback;
}

function emit(flags) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: flags }));
}

export function getBootDebugFlags() {
  const stored = readStoredFlags();
  return {
    bootShield: readQueryOverride('boot_shield', stored.bootShield),
    skipBootstrap: readQueryOverride('skip_bootstrap', stored.skipBootstrap),
    shellOnly: readQueryOverride('shell_only', stored.shellOnly),
  };
}

export function setBootDebugFlags(nextFlags) {
  if (typeof window === 'undefined') return { ...DEFAULT_FLAGS };
  const next = { ...DEFAULT_FLAGS, ...normalize(nextFlags || {}) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  emit(next);
  return next;
}

export function clearBootDebugFlags() {
  if (typeof window === 'undefined') return { ...DEFAULT_FLAGS };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  emit({ ...DEFAULT_FLAGS });
  return { ...DEFAULT_FLAGS };
}

export function subscribeBootDebugFlags(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => listener(normalize(event.detail || readStoredFlags()));
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
