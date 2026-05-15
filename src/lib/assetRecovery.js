const ASSET_RECOVERY_KEY = 'mansion-asset-recovery-reload';
const ASSET_RECOVERY_RECENT_MS = 30_000;

function getStoredRecoveryState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ASSET_RECOVERY_KEY);
    if (!raw) return null;
    if (raw === '1') {
      return { buildId: 'legacy', retried: true, at: 0 };
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStoredRecoveryState(state) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ASSET_RECOVERY_KEY, JSON.stringify(state));
  } catch {}
}

export function getCurrentAssetBuildId() {
  if (typeof document === 'undefined') return 'unknown';
  try {
    const entryScript =
      document.querySelector('script[type="module"][src*="/assets/"]') ||
      document.querySelector('script[type="module"][src]');
    return entryScript?.getAttribute('src') || entryScript?.src || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function isRecoverableAssetUrl(url) {
  const value = String(url || '');
  return /\/assets\/.+\.(js|css)(\?|$)/i.test(value);
}

export function isRecoverableAssetError(errorLike) {
  const message = String(errorLike?.message || errorLike || '');
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('is not a valid JavaScript MIME type') ||
    message.includes('non CSS MIME types are not allowed') ||
    message.includes('Did not parse stylesheet') ||
    message.includes('ChunkLoadError')
  );
}

export function wasAssetRecoveryTriggeredRecently() {
  if (typeof window !== 'undefined' && window.__mansionAssetRecoveryTriggered) {
    return true;
  }
  const state = getStoredRecoveryState();
  const timestamp = Number(state?.at || 0);
  return Boolean(timestamp && Date.now() - timestamp < ASSET_RECOVERY_RECENT_MS);
}

export function tryRecoverFromAssetFailure() {
  if (typeof window === 'undefined') return false;

  const buildId = getCurrentAssetBuildId();
  const state = getStoredRecoveryState();
  if (state?.retried && state?.buildId === buildId) {
    return false;
  }

  window.__mansionAssetRecoveryTriggered = true;
  setStoredRecoveryState({
    buildId,
    retried: true,
    at: Date.now(),
    href: window.location.href,
  });

  let reloadStarted = false;
  const reload = () => {
    if (reloadStarted) return;
    reloadStarted = true;
    window.location.reload();
  };

  const hardReloadTimer = window.setTimeout(reload, 1500);

  void (async () => {
    try {
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
      if ('serviceWorker' in window.navigator) {
        const registrations = await window.navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    } catch {}

    window.clearTimeout(hardReloadTimer);
    reload();
  })();

  return true;
}
