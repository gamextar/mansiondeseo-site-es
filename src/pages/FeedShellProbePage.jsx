import { getBottomNavBottomPadding, getBottomNavHeight } from '../lib/bottomNavConfig';

function detectStandaloneMobile() {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const ua = window.navigator.userAgent || '';
  const isMobile = /iphone|ipad|ipod|android/i.test(ua);
  return Boolean(standalone && isMobile);
}

const PROBE_IMAGE_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 2400" preserveAspectRatio="none">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2a0f44"/>
        <stop offset="45%" stop-color="#7c183c"/>
        <stop offset="100%" stop-color="#ff5a36"/>
      </linearGradient>
      <pattern id="grid" width="120" height="120" patternUnits="userSpaceOnUse">
        <path d="M 120 0 L 0 0 0 120" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
      </pattern>
    </defs>
    <rect width="1200" height="2400" fill="url(#bg)"/>
    <rect width="1200" height="2400" fill="url(#grid)"/>
    <rect x="18" y="18" width="1164" height="2364" rx="0" fill="none" stroke="#ffffff" stroke-width="14"/>
    <rect x="50" y="50" width="1100" height="2300" rx="0" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="4" stroke-dasharray="18 16"/>
    <text x="600" y="140" text-anchor="middle" fill="#ffffff" font-size="84" font-family="Arial, sans-serif" font-weight="700">BORDE SUPERIOR</text>
    <text x="600" y="2280" text-anchor="middle" fill="#ffffff" font-size="84" font-family="Arial, sans-serif" font-weight="700">BORDE INFERIOR</text>
    <text x="600" y="1200" text-anchor="middle" fill="#ffffff" font-size="110" font-family="Arial, sans-serif" font-weight="700">FEED SHELL EXACTO</text>
    <text x="600" y="1320" text-anchor="middle" fill="#ffffff" font-size="58" font-family="Arial, sans-serif">Imagen aplicada al mismo contenedor raiz del feed</text>
    <circle cx="90" cy="90" r="28" fill="#ffffff"/>
    <circle cx="1110" cy="90" r="28" fill="#ffffff"/>
    <circle cx="90" cy="2310" r="28" fill="#ffffff"/>
    <circle cx="1110" cy="2310" r="28" fill="#ffffff"/>
  </svg>
`)}`;

export default function FeedShellProbePage() {
  const isStandaloneMobileApp = detectStandaloneMobile();
  const navBottomOffset = getBottomNavHeight(isStandaloneMobileApp) + getBottomNavBottomPadding(isStandaloneMobileApp);

  return (
    <div
      className="min-h-dynamic-screen bg-mansion-base pt-navbar lg:pt-0 lg:pb-[84px]"
      style={{
        paddingBottom: `calc(${Math.max(12, navBottomOffset)}px + env(safe-area-inset-bottom, 0px))`,
        backgroundImage: `url(${PROBE_IMAGE_URL})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="px-4 pt-4 text-white lg:px-8 lg:pt-8">
        <div className="inline-flex rounded-full border border-white/35 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] backdrop-blur-sm">
          Feed Shell Test
        </div>
      </div>
    </div>
  );
}
