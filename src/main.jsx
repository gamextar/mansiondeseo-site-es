import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

if (typeof window !== 'undefined' && window.location.hostname === 'www.mansiondeseo.com') {
  const canonicalUrl = `https://mansiondeseo.com${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(canonicalUrl);
}

// Prevent iOS Safari PWA from restoring scroll on SPA navigation.
// Our pages handle scroll position explicitly (FeedPage resets to 0 on mount,
// overlay in App.jsx restores via explicit window.scrollTo — both unaffected by this flag).
if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
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
