import { useEffect, useRef, useState } from 'react';

function readSafeAreaInsets() {
  if (typeof document === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const probe = document.createElement('div');
  probe.style.position = 'fixed';
  probe.style.inset = '0';
  probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
  probe.style.paddingRight = 'env(safe-area-inset-right, 0px)';
  probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
  probe.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);

  const styles = window.getComputedStyle(probe);
  const insets = {
    top: Number.parseFloat(styles.paddingTop) || 0,
    right: Number.parseFloat(styles.paddingRight) || 0,
    bottom: Number.parseFloat(styles.paddingBottom) || 0,
    left: Number.parseFloat(styles.paddingLeft) || 0,
  };

  probe.remove();
  return insets;
}

function collectViewportMetrics(rootEl) {
  if (typeof window === 'undefined') return null;

  const visualViewport = window.visualViewport;
  const rootRect = rootEl?.getBoundingClientRect();
  const doc = document.documentElement;
  const body = document.body;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;

  return {
    safe: readSafeAreaInsets(),
    window: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      scrollY: Math.round(window.scrollY || 0),
      devicePixelRatio: window.devicePixelRatio || 1,
    },
    visualViewport: visualViewport ? {
      width: Math.round(visualViewport.width),
      height: Math.round(visualViewport.height),
      offsetTop: Math.round(visualViewport.offsetTop),
      offsetLeft: Math.round(visualViewport.offsetLeft),
      pageTop: Math.round(visualViewport.pageTop),
      scale: visualViewport.scale,
    } : null,
    document: {
      clientHeight: doc.clientHeight,
      scrollHeight: doc.scrollHeight,
      bodyClientHeight: body?.clientHeight || 0,
      bodyScrollHeight: body?.scrollHeight || 0,
    },
    rootRect: rootRect ? {
      top: Math.round(rootRect.top),
      bottom: Math.round(rootRect.bottom),
      height: Math.round(rootRect.height),
      width: Math.round(rootRect.width),
    } : null,
    screen: {
      width: window.screen?.width || 0,
      height: window.screen?.height || 0,
      availWidth: window.screen?.availWidth || 0,
      availHeight: window.screen?.availHeight || 0,
    },
    mode: {
      standalone: Boolean(standalone),
      userAgent: window.navigator.userAgent,
    },
  };
}

function MetricRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 py-2 text-sm">
      <span className="text-white/62">{label}</span>
      <span className="font-mono text-white">{String(value)}</span>
    </div>
  );
}

function MetricSection({ title, children }) {
  return (
    <section className="rounded-2xl border border-white/12 bg-black/35 p-4 backdrop-blur-xl">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/58">{title}</h2>
      {children}
    </section>
  );
}

export default function SafeAreaDebugPage() {
  const rootRef = useRef(null);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    let rafId = 0;

    const update = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        setMetrics(collectViewportMetrics(rootRef.current));
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('scroll', update, { passive: true });
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);

    const timer = window.setInterval(update, 1000);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(timer);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('scroll', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  const safe = metrics?.safe || { top: 0, right: 0, bottom: 0, left: 0 };
  const viewportHeight = metrics?.visualViewport?.height || metrics?.window?.innerHeight || 0;
  const rootHeight = metrics?.rootRect?.height || 0;

  return (
    <div
      ref={rootRef}
      className="relative min-h-screen overflow-hidden bg-[#111]"
      style={{
        backgroundImage: 'url(/feed-shell-probe.svg?v=2)',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-[80] bg-sky-400/55"
        style={{ height: 'env(safe-area-inset-top, 0px)' }}
      />
      <div
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-[80] bg-rose-400/55"
        style={{ height: 'env(safe-area-inset-bottom, 0px)' }}
      />

      <div className="relative z-10 min-h-[145svh] px-4 pb-mobile-legacy-nav pt-navbar lg:px-8 lg:pb-8 lg:pt-8">
        <div className="mb-4 rounded-3xl border border-white/15 bg-black/45 p-4 text-white shadow-2xl backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/58">Safe Area Debug</p>
          <h1 className="mt-2 text-2xl font-bold">Medición real del viewport</h1>
          <p className="mt-2 text-sm leading-6 text-white/72">
            Azul = safe-area superior. Rosa = safe-area inferior. La imagen de fondo está en el contenedor raíz.
          </p>
        </div>

        {metrics && (
          <div className="space-y-3 pb-8">
            <MetricSection title="Safe areas">
              <MetricRow label="top" value={`${safe.top}px`} />
              <MetricRow label="bottom" value={`${safe.bottom}px`} />
              <MetricRow label="left" value={`${safe.left}px`} />
              <MetricRow label="right" value={`${safe.right}px`} />
            </MetricSection>

            <MetricSection title="Viewport">
              <MetricRow label="window.innerHeight" value={`${metrics.window.innerHeight}px`} />
              <MetricRow label="visualViewport.height" value={`${viewportHeight}px`} />
              <MetricRow label="visualViewport.offsetTop" value={`${metrics.visualViewport?.offsetTop ?? 'n/a'}px`} />
              <MetricRow label="visualViewport.pageTop" value={`${metrics.visualViewport?.pageTop ?? 'n/a'}px`} />
              <MetricRow label="devicePixelRatio" value={metrics.window.devicePixelRatio} />
            </MetricSection>

            <MetricSection title="Document / Root">
              <MetricRow label="document.clientHeight" value={`${metrics.document.clientHeight}px`} />
              <MetricRow label="document.scrollHeight" value={`${metrics.document.scrollHeight}px`} />
              <MetricRow label="body.clientHeight" value={`${metrics.document.bodyClientHeight}px`} />
              <MetricRow label="root rect height" value={`${rootHeight}px`} />
              <MetricRow label="root - visualViewport" value={`${Math.round(rootHeight - viewportHeight)}px`} />
              <MetricRow label="scrollY" value={`${metrics.window.scrollY}px`} />
            </MetricSection>

            <MetricSection title="Mode">
              <MetricRow label="standalone/PWA" value={metrics.mode.standalone ? 'true' : 'false'} />
              <MetricRow label="screen.height" value={`${metrics.screen.height}px`} />
              <MetricRow label="screen.availHeight" value={`${metrics.screen.availHeight}px`} />
            </MetricSection>

            <pre className="whitespace-pre-wrap break-words rounded-2xl border border-white/12 bg-black/45 p-4 font-mono text-[11px] leading-5 text-white/72 backdrop-blur-xl">
              {JSON.stringify(metrics, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
