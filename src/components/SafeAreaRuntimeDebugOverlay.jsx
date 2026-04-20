import { useEffect, useState } from 'react';
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

function readMetrics(pathname) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  const root = document.documentElement;
  const body = document.body;
  const rootStyles = window.getComputedStyle(root);
  const immersiveShell = document.querySelector('[data-mobile-immersive="true"]');
  const firstNavbarPadding = document.querySelector('.pt-navbar');
  const firstSafeTop = document.querySelector('.safe-top');
  const vv = window.visualViewport;

  return {
    route: pathname,
    safeEnvTop: readSafeAreaTop(),
    safeTopVar: rootStyles.getPropertyValue('--safe-top').trim(),
    visualTopVar: rootStyles.getPropertyValue('--visual-viewport-offset-top').trim(),
    heightCompVar: rootStyles.getPropertyValue('--mobile-browser-height-compensation').trim(),
    immersive: Boolean(immersiveShell),
    standalone: Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true),
    innerHeight: Math.round(window.innerHeight || 0),
    scrollY: Math.round(window.scrollY || 0),
    docScrollTop: Math.round(root.scrollTop || 0),
    bodyScrollTop: Math.round(body?.scrollTop || 0),
    navbarPaddingTop: firstNavbarPadding ? window.getComputedStyle(firstNavbarPadding).paddingTop : 'n/a',
    safeTopPaddingTop: firstSafeTop ? window.getComputedStyle(firstSafeTop).paddingTop : 'n/a',
    visualViewport: vv ? {
      height: Math.round(vv.height || 0),
      offsetTop: Math.round(vv.offsetTop || 0),
      pageTop: Math.round(vv.pageTop || 0),
      scale: vv.scale,
    } : null,
  };
}

export default function SafeAreaRuntimeDebugOverlay() {
  const location = useLocation();
  const [enabled, setEnabled] = useState(false);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextEnabled = params.get('safe_debug') === '1';
    setEnabled(nextEnabled);
    if (!nextEnabled) setMetrics(null);
  }, [location.search]);

  useEffect(() => {
    if (!enabled) return undefined;

    let rafId = 0;
    const update = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        setMetrics(readMetrics(location.pathname));
      });
    };

    update();
    const intervalId = window.setInterval(update, 750);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('scroll', update, { passive: true });
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('scroll', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [enabled, location.pathname]);

  if (!enabled || !metrics) return null;

  return (
    <div className="fixed left-2 right-2 top-2 z-[10000] rounded-2xl border border-amber-300/60 bg-black/88 p-3 font-mono text-[10px] leading-4 text-amber-50 shadow-2xl backdrop-blur-md lg:left-auto lg:right-3 lg:w-[360px]">
      <div className="mb-1 flex items-center justify-between gap-3">
        <strong className="text-amber-200">safe_debug=1</strong>
        <span>{metrics.route}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span>immersive</span><span>{String(metrics.immersive)}</span>
        <span>standalone</span><span>{String(metrics.standalone)}</span>
        <span>safe env top</span><span>{metrics.safeEnvTop}px</span>
        <span>--safe-top</span><span>{metrics.safeTopVar || 'n/a'}</span>
        <span>--vv-top</span><span>{metrics.visualTopVar || 'n/a'}</span>
        <span>nav padding</span><span>{metrics.navbarPaddingTop}</span>
        <span>safe padding</span><span>{metrics.safeTopPaddingTop}</span>
        <span>innerHeight</span><span>{metrics.innerHeight}px</span>
        <span>vv.height</span><span>{metrics.visualViewport?.height ?? 'n/a'}px</span>
        <span>vv.offsetTop</span><span>{metrics.visualViewport?.offsetTop ?? 'n/a'}px</span>
        <span>vv.pageTop</span><span>{metrics.visualViewport?.pageTop ?? 'n/a'}px</span>
        <span>scrollY</span><span>{metrics.scrollY}px</span>
        <span>doc/body top</span><span>{metrics.docScrollTop}/{metrics.bodyScrollTop}px</span>
        <span>height comp</span><span>{metrics.heightCompVar || 'n/a'}</span>
      </div>
    </div>
  );
}
