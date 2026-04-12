import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { getBootDebugFlags } from './lib/bootDebugPrefs'

function hideStartupShield() {
  if (typeof window === 'undefined') return;
  const shield = document.getElementById('startup-shield');
  if (!shield) return;

  const startedAt = Date.now();

  const removeShield = () => {
    shield.remove();
  };

  const reveal = () => {
    shield.setAttribute('data-hidden', 'true');
    window.setTimeout(removeShield, 320);
  };

  const minVisibleMs = 180;
  const extraSettleMs = 50;

  const waitForFonts = () => {
    if (!document.fonts?.ready) return Promise.resolve();
    return document.fonts.ready.catch(() => {});
  };

  const waitForWindowLoad = () => {
    if (document.readyState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      window.addEventListener('load', resolve, { once: true });
    });
  };

  Promise.all([waitForWindowLoad(), waitForFonts()]).finally(() => {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, minVisibleMs - elapsed);
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.setTimeout(reveal, extraSettleMs);
        });
      });
    }, remaining);
  });
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
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

hideStartupShield()
