import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { getBootDebugFlags } from './lib/bootDebugPrefs'

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
