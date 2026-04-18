import { getBrowserBottomNavOffset, getStandaloneBottomNavOffset } from '../lib/bottomNavConfig';

function detectStandaloneMobile() {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const ua = window.navigator.userAgent || '';
  const isMobile = /iphone|ipad|ipod|android/i.test(ua);
  return Boolean(standalone && isMobile);
}

export default function MobileFullScreenProbePage() {
  const isStandaloneMobileApp = detectStandaloneMobile();
  const navBottomOffset = isStandaloneMobileApp
    ? getStandaloneBottomNavOffset()
    : getBrowserBottomNavOffset();

  return (
    <div
      className="min-h-dynamic-screen bg-[#180202] pt-navbar lg:pt-0 lg:pb-[84px]"
      style={{
        paddingBottom: `calc(${navBottomOffset} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div
        className="w-full bg-[#d90429] text-white"
        style={{
          minHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 8px)',
        }}
      >
        <div className="flex min-h-[inherit] flex-col justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Prueba Mobile</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight">Contenedor rojo a pantalla completa</h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">
              Esta pantalla usa el mismo shell mobile de las secciones normales, sin la estructura especial del video feed.
            </p>
          </div>

          <div className="rounded-2xl border border-white/25 bg-black/15 p-4 backdrop-blur-sm">
            <p className="text-sm font-semibold">Checklist visual</p>
            <p className="mt-2 text-sm text-white/85">Si esto sale bien, el rojo debería llegar hasta arriba y hasta abajo como el resto de la app.</p>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/65">
              Safari / PWA / bottom nav encima
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
