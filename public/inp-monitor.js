(() => {
  const THRESHOLD_MS = 200;
  let slowestInteraction = null;
  let sent = false;

  if (!('PerformanceObserver' in window) || !PerformanceObserver.supportedEntryTypes?.includes('event')) return;

  function targetLabel(target) {
    if (!(target instanceof Element)) return 'unknown';
    const tag = target.tagName.toLowerCase();
    const id = target.id ? `#${String(target.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)}` : '';
    const role = target.getAttribute('role');
    return `${tag}${id}${role ? `[role=${role.slice(0, 32)}]` : ''}`;
  }

  function sendSlowInteraction() {
    if (sent || !slowestInteraction || slowestInteraction.duration <= THRESHOLD_MS) return;
    sent = true;

    const metric = {
      kind: 'web-vital.inp',
      level: 'warn',
      message: `INP needs improvement: ${Math.round(slowestInteraction.duration)} ms`,
      route: window.location.pathname,
      href: `${window.location.origin}${window.location.pathname}`,
      online: navigator.onLine,
      extra: {
        metric: 'INP',
        value_ms: Math.round(slowestInteraction.duration),
        rating: slowestInteraction.duration > 500 ? 'poor' : 'needs-improvement',
        interaction_type: slowestInteraction.name || 'unknown',
        interaction_target: targetLabel(slowestInteraction.target),
        start_time_ms: Math.round(slowestInteraction.startTime || 0),
        processing_delay_ms: Math.round(Math.max(0, (slowestInteraction.processingStart || 0) - (slowestInteraction.startTime || 0))),
        processing_duration_ms: Math.round(Math.max(0, (slowestInteraction.processingEnd || 0) - (slowestInteraction.processingStart || 0))),
        device: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
        connection: navigator.connection?.effectiveType || '',
      },
    };
    const body = JSON.stringify(metric);
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.('/api/client-errors', blob)) return;
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.interactionId || entry.duration <= (slowestInteraction?.duration || 0)) continue;
        slowestInteraction = entry;
      }
    });
    observer.observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch {
    return;
  }

  addEventListener('pagehide', sendSlowInteraction, { capture: true });
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendSlowInteraction();
  }, { capture: true });
})();
