import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { getBootDebugFlags } from './lib/bootDebugPrefs'
import {
  applyBottomNavCssVariables,
} from './lib/bottomNavConfig'
import { SITE_CONFIG } from './lib/siteConfig'

const ASSET_RECOVERY_KEY = 'mansion-asset-recovery-reload';
const SW_MIGRATION_KEY = 'mansion-sw-migration';
const SW_MIGRATION_VERSION = 'v12-no-html-cache';

function isRecoverableAssetUrl(url) {
  const value = String(url || '');
  return /\/assets\/.+\.(js|css)(\?|$)/i.test(value);
}

function isRecoverableAssetError(errorLike) {
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

function tryRecoverFromAssetFailure() {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(ASSET_RECOVERY_KEY) === '1') {
      sessionStorage.removeItem(ASSET_RECOVERY_KEY);
      return false;
    }
    sessionStorage.setItem(ASSET_RECOVERY_KEY, '1');
  } catch {}
  void (async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    } catch {}
    window.location.reload();
  })();
  return true;
}

if (typeof window !== 'undefined' && SITE_CONFIG.redirectHosts.includes(window.location.hostname)) {
  const canonicalUrl = `${SITE_CONFIG.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(canonicalUrl);
}

if (typeof window !== 'undefined') {
  const currentPath = window.location.pathname || '/';
  if (currentPath === '/app' || currentPath === '/app/') {
    try {
      const params = new URLSearchParams(window.location.search);
      const redirectTarget = params.get('redirect');
      if (redirectTarget && redirectTarget.startsWith('/')) {
        window.history.replaceState({}, '', redirectTarget);
      }
    } catch {}
  }
}

if (typeof document !== 'undefined') {
  // Keep the shell dark even before CSS assets finish loading.
  document.documentElement.style.backgroundColor = '#08080E';
  document.documentElement.style.colorScheme = 'dark';
  applyBottomNavCssVariables(document.documentElement);
  if (document.body) {
    document.body.style.backgroundColor = '#08080E';
    document.body.style.colorScheme = 'dark';
    document.body.style.margin = '0';
  }
}

if (typeof window !== 'undefined') {
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  const debugFlags = getBootDebugFlags();
  const isAppHomePath =
    window.location.pathname === '/' ||
    window.location.pathname === '' ||
    window.location.pathname === '/feed';
  if (debugFlags.forceBlackTest && isAppHomePath) {
    window.history.replaceState({}, '', '/black-test');
  }

  window.addEventListener('error', (event) => {
    const target = event.target;
    if (
      target instanceof HTMLScriptElement ||
      target instanceof HTMLLinkElement
    ) {
      const assetUrl = target.src || target.href || '';
      if (isRecoverableAssetUrl(assetUrl)) {
        tryRecoverFromAssetFailure();
        return;
      }
    }

    if (isRecoverableAssetError(event.error || event.message)) {
      tryRecoverFromAssetFailure();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    if (isRecoverableAssetError(event.reason)) {
      if (tryRecoverFromAssetFailure()) {
        event.preventDefault();
      }
    }
  });
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void (async () => {
      try {
        const currentMigration = localStorage.getItem(SW_MIGRATION_KEY);
        if (currentMigration !== SW_MIGRATION_VERSION) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(
              keys
                .filter((key) => key.startsWith('mansion-'))
                .map((key) => caches.delete(key))
            );
          }
          localStorage.setItem(SW_MIGRATION_KEY, SW_MIGRATION_VERSION);
        }
      } catch {}

      navigator.serviceWorker.register(`/sw.js?${SW_MIGRATION_VERSION}`).catch(() => {});
    })();
  });
}

const rootElement = document.getElementById('root');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
