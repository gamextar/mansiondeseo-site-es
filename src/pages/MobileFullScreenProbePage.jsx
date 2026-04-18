import { useEffect } from 'react';

const PROBE_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

export default function MobileFullScreenProbePage() {
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
    <div className="relative min-h-screen overflow-hidden bg-[#d90429] pb-mobile-legacy-nav lg:pb-8 pt-navbar lg:pt-0 text-white">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={PROBE_VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 px-3 pt-4 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">Prueba Mobile</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">Video a pantalla completa</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">
            Esta pantalla usa exactamente la misma raíz que Mensajes, pero con un video real ocupando todo el fondo para validar el viewport.
          </p>
        </div>
      </div>

      <div className="relative z-10 px-2">
        <div className="rounded-2xl border border-white/25 bg-black/25 p-4 backdrop-blur-sm min-h-[60vh]">
          <p className="text-sm font-semibold">Checklist visual</p>
          <p className="mt-2 text-sm text-white/85">Si esto sale bien, el video debería tocar arriba y abajo exactamente igual que las secciones que en tu dispositivo ves bien.</p>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/65">
            Video demo sobre shell de mensajes
          </p>
        </div>
      </div>
    </div>
  );
}
