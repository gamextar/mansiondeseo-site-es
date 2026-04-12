import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

function hideStartupShield() {
  if (typeof window === 'undefined') return;
  const shield = document.getElementById('startup-shield');
  if (!shield) return;

  const removeShield = () => {
    shield.remove();
  };

  const reveal = () => {
    shield.setAttribute('data-hidden', 'true');
    window.setTimeout(removeShield, 320);
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.setTimeout(reveal, 120);
    });
  });
}

if (typeof window !== 'undefined' && window.location.hostname === 'www.mansiondeseo.com') {
  const canonicalUrl = `https://mansiondeseo.com${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(canonicalUrl);
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
