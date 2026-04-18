import { useEffect } from 'react';
import { getBottomNavBottomPadding, getBottomNavHeight } from '../lib/bottomNavConfig';

const PROBE_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

function detectStandaloneMobile() {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const ua = window.navigator.userAgent || '';
  const isMobile = /iphone|ipad|ipod|android/i.test(ua);
  return Boolean(standalone && isMobile);
}

export default function FeedShellProbePage() {
  const isStandaloneMobileApp = detectStandaloneMobile();
  const navBottomOffset = getBottomNavHeight(isStandaloneMobileApp) + getBottomNavBottomPadding(isStandaloneMobileApp);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlBackground = html.style.background;
    const previousBodyBackground = body.style.background;
    const previousBodyColor = body.style.color;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const previousThemeColor = themeMeta?.getAttribute('content') ?? null;

    html.style.background = '#d90429';
    body.style.background = '#d90429';
    body.style.color = '#ffffff';
    if (themeMeta) themeMeta.setAttribute('content', '#d90429');

    return () => {
      html.style.background = previousHtmlBackground;
      body.style.background = previousBodyBackground;
      body.style.color = previousBodyColor;
      if (themeMeta && previousThemeColor !== null) {
        themeMeta.setAttribute('content', previousThemeColor);
      }
    };
  }, []);

  return (
    <div
      className="relative min-h-dynamic-screen overflow-hidden bg-[#d90429] pt-navbar lg:pt-0 lg:pb-[84px] text-white"
      style={{
        paddingBottom: `calc(${Math.max(12, navBottomOffset)}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <video
        className="absolute inset-0 h-full w-full object-fill"
        src={PROBE_VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 px-3 pt-4 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">Prueba Feed</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">Shell exacto del feed</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">
          Esta pantalla usa la raíz exacta del feed: mismo wrapper, mismo padding inferior y mismo tratamiento mobile.
        </p>
      </div>

      <div className="relative z-10 px-2">
        <div className="rounded-2xl border border-white/25 bg-black/25 p-4 backdrop-blur-sm min-h-[60vh]">
          <p className="text-sm font-semibold">Checklist visual</p>
          <p className="mt-2 text-sm text-white/85">Si esta sí ocupa toda la pantalla, ya sabemos que el feed y el resto comparten un wrapper distinto al de la prueba anterior.</p>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/65">Copia literal del shell del feed</p>
        </div>
      </div>
    </div>
  );
}
