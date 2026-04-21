import { useEffect, useRef, useCallback } from 'react';

/**
 * Pull-to-refresh hook.
 * @param {() => Promise<void>} onRefresh - async function to call on refresh
 * @param {{ threshold?: number, containerRef?: React.RefObject<HTMLElement | null>, preventNativePull?: boolean, resetScrollOnRelease?: boolean }} options
 */
export function usePullToRefresh(onRefresh, { threshold = 120, containerRef, preventNativePull = false, resetScrollOnRelease = false } = {}) {
  const startY = useRef(null);
  const pulling = useRef(false);
  const startedAtTop = useRef(false);
  const refreshing = useRef(false);
  const indicatorRef = useRef(null);

  const getScrollTop = useCallback(() => {
    if (containerRef?.current) return Number(containerRef.current.scrollTop || 0);
    if (typeof window === 'undefined') return 0;
    return Math.max(
      Number(window.scrollY || 0),
      Number(document.documentElement?.scrollTop || 0),
      Number(document.body?.scrollTop || 0)
    );
  }, [containerRef]);

  const forceScrollTop = useCallback(() => {
    if (containerRef?.current) {
      containerRef.current.scrollTop = 0;
      return;
    }
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.scrollTop = 0;
    if (body) body.scrollTop = 0;
    root.style.scrollBehavior = previousScrollBehavior;
  }, [containerRef]);

  const stabilizeTopScroll = useCallback(() => {
    forceScrollTop();
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => forceScrollTop());
    [80, 180, 360].forEach((delay) => {
      window.setTimeout(() => forceScrollTop(), delay);
    });
  }, [forceScrollTop]);

  const reset = useCallback((restoreTop = false) => {
    startY.current = null;
    pulling.current = false;
    startedAtTop.current = false;
    if (indicatorRef.current) {
      indicatorRef.current.style.transform = 'translateY(-100%)';
      indicatorRef.current.style.opacity = '0';
    }
    if (restoreTop) stabilizeTopScroll();
  }, [stabilizeTopScroll]);

  useEffect(() => {
    const scrollEl = containerRef?.current || document.documentElement;
    const touchEl = containerRef?.current || document.documentElement;

    if (!scrollEl || !touchEl) return undefined;

    const isAtTop = () => {
      return getScrollTop() <= 1;
    };

    const onTouchStart = (e) => {
      if (refreshing.current) return;
      // Only trigger when scrolled to the very top
      if (!isAtTop()) return;
      startY.current = e.touches[0].clientY;
      startedAtTop.current = true;
    };

    const onTouchMove = (e) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { reset(); return; }
      if (preventNativePull && startedAtTop.current) {
        // Mobile browsers can keep the document displaced after native pull.
        // Once this gesture starts at the top, we own the downward pull.
        e.preventDefault();
        forceScrollTop();
      } else if (!isAtTop()) {
        // Don't fight regular content scroll.
        reset();
        return;
      }

      const progress = Math.min(dy / threshold, 1);
      // Only mark as pulling once threshold is reached
      if (dy >= threshold) {
        pulling.current = true;
      }
      if (indicatorRef.current) {
        indicatorRef.current.style.transform = `translateY(${-100 + progress * 100}%)`;
        indicatorRef.current.style.opacity = String(progress);
      }
    };

    const onTouchEnd = async () => {
      const shouldRestoreTop = resetScrollOnRelease && startedAtTop.current;
      startY.current = null;
      if (!pulling.current) {
        // Didn't reach threshold — reset indicator
        reset(shouldRestoreTop);
        return;
      }
      refreshing.current = true;
      if (indicatorRef.current) {
        // Show spinning state
        indicatorRef.current.style.transform = 'translateY(0%)';
        indicatorRef.current.style.opacity = '1';
        indicatorRef.current.dataset.spinning = 'true';
      }
      try {
        await onRefresh();
      } finally {
        refreshing.current = false;
        if (indicatorRef.current) {
          delete indicatorRef.current.dataset.spinning;
        }
        reset(shouldRestoreTop);
      }
    };

    const onTouchCancel = () => {
      reset(resetScrollOnRelease && startedAtTop.current);
    };

    touchEl.addEventListener('touchstart', onTouchStart, { passive: true });
    touchEl.addEventListener('touchmove', onTouchMove, { passive: !preventNativePull });
    touchEl.addEventListener('touchend', onTouchEnd, { passive: true });
    touchEl.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      touchEl.removeEventListener('touchstart', onTouchStart);
      touchEl.removeEventListener('touchmove', onTouchMove);
      touchEl.removeEventListener('touchend', onTouchEnd);
      touchEl.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [containerRef, forceScrollTop, getScrollTop, onRefresh, preventNativePull, reset, resetScrollOnRelease, threshold]);

  return { indicatorRef };
}
