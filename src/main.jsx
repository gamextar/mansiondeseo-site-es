import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { getBootDebugFlags } from './lib/bootDebugPrefs'

const ASSET_RECOVERY_KEY = 'mansion-asset-recovery-reload';
const SW_RECOVERY_KEY = 'mansion-sw-recovery-reload';

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
  window.location.reload();
  return true;
}

if (typeof window !== 'undefined' && window.location.hostname === 'www.mansiondeseo.com') {
  const canonicalUrl = `https://mansiondeseo.com${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(canonicalUrl);
}

if (typeof window !== 'undefined') {
  const debugFlags = getBootDebugFlags();
  const isRootPath = window.location.pathname === '/' || window.location.pathname === '';
  if (debugFlags.forceBlackTest && isRootPath) {
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
    let hasReloadedForController = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasReloadedForController) return;
      hasReloadedForController = true;
      try {
        if (sessionStorage.getItem(SW_RECOVERY_KEY) === '1') {
          sessionStorage.removeItem(SW_RECOVERY_KEY);
          return;
        }
        sessionStorage.setItem(SW_RECOVERY_KEY, '1');
      } catch {}
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.update().catch(() => {});
    }).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
