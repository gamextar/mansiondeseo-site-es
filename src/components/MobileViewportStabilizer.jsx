import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

function readSafeAreaTop() {
  if (typeof document === 'undefined') return 0;

  const probe = document.createElement('div');
  probe.style.position = 'fixed';
  probe.style.top = '0';
  probe.style.left = '0';
  probe.style.height = '0';
  probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);

  const value = Number.parseFloat(window.getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return Math.round(value);
}

function forceViewportReflow() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const root = document.documentElement;
  const rootStyles = window.getComputedStyle(root);
  const firstNavbarPadding = document.querySelector('.pt-navbar');
  const firstSafeTop = document.querySelector('.safe-top');

  // These reads intentionally mirror SafeAreaRuntimeDebugOverlay. On affected
  // mobile browsers they force the fixed top layer and viewport metrics to
  // settle after a direct refresh on non-feed routes.
  readSafeAreaTop();
  rootStyles.getPropertyValue('--safe-top');
  rootStyles.getPropertyValue('--visual-viewport-offset-top');
  rootStyles.getPropertyValue('--mobile-browser-height-compensation');
  if (firstNavbarPadding) window.getComputedStyle(firstNavbarPadding).paddingTop;
  if (firstSafeTop) window.getComputedStyle(firstSafeTop).paddingTop;
  if (window.visualViewport) {
    Math.round(window.visualViewport.height || 0);
    Math.round(window.visualViewport.offsetTop || 0);
    Math.round(window.visualViewport.pageTop || 0);
  }
  Math.round(window.innerHeight || 0);
  Math.round(window.scrollY || 0);
  Math.round(root.scrollTop || 0);
  Math.round(document.body?.scrollTop || 0);
}

function readNumberParam(params, name, fallback, min, max) {
  const raw = params.get(name);
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export default function MobileViewportStabilizer() {
  const location = useLocation();
  const [tick, setTick] = useState(0);
  const settings = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('paint_probe') || 'ghost';
    return {
      mode,
      height: readNumberParam(params, 'paint_h', 12, 0, 320),
      blur: readNumberParam(params, 'paint_blur', 0.75, 0.01, 2),
      alpha: readNumberParam(params, 'paint_alpha', 0.003, 0, 0.02),
      live: params.get('paint_live') !== '0',
    };
  }, [location.search]);
  const { mode } = settings;

  useEffect(() => {
    if (mode === 'off') return undefined;

    let rafId = 0;
    const update = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        forceViewportReflow();
        setTick((current) => (current + 1) % 1000);
      });
    };
    const continuous = settings.live || mode === 'box' || mode === 'heartbeat';

    update();
    const timers = [80, 180, 360, 700].map((delay) => window.setTimeout(update, delay));
    const intervalId = continuous ? window.setInterval(update, 750) : null;
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('pageshow', update);
    window.addEventListener('focus', update);
    if (continuous) window.addEventListener('scroll', update, { passive: true });
    window.visualViewport?.addEventListener('resize', update);
    if (continuous) window.visualViewport?.addEventListener('scroll', update);

    return () => {
      window.cancelAnimationFrame(rafId);
      timers.forEach((timerId) => window.clearTimeout(timerId));
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('pageshow', update);
      window.removeEventListener('focus', update);
      if (continuous) window.removeEventListener('scroll', update);
      window.visualViewport?.removeEventListener('resize', update);
      if (continuous) window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [location.pathname, mode, settings.live]);

  if (mode === 'off') return null;

  if (mode === 'heartbeat') {
    return (
      <div
        className="fixed left-0 top-0 z-[10000] h-px w-px pointer-events-none lg:hidden"
        data-mobile-viewport-stabilizer={tick}
        aria-hidden="true"
      />
    );
  }

  if (mode === 'box') {
    return (
      <div
        className="fixed left-2 right-2 top-2 z-[10000] rounded-2xl border border-amber-300/60 bg-black/88 p-3 font-mono text-[10px] leading-4 text-amber-50 shadow-2xl backdrop-blur-md pointer-events-none lg:hidden"
        data-mobile-viewport-stabilizer={tick}
        aria-hidden="true"
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <strong className="text-amber-200">paint_probe=box</strong>
          <span>{location.pathname}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {Array.from({ length: 28 }).map((_, index) => (
            <span key={index}>{index % 2 === 0 ? 'viewport' : tick}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[49] pointer-events-none lg:hidden"
      data-mobile-viewport-stabilizer={tick}
      style={{
        minHeight: `${settings.height}px`,
        backgroundColor: `rgba(8,8,14,${settings.alpha})`,
        backdropFilter: `blur(${settings.blur}px)`,
        WebkitBackdropFilter: `blur(${settings.blur}px)`,
        maskImage: 'linear-gradient(to bottom, #000 0%, #000 26%, rgba(0,0,0,0.55) 62%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 26%, rgba(0,0,0,0.55) 62%, transparent 100%)',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        willChange: 'transform, opacity',
      }}
      aria-hidden="true"
    />
  );
}
