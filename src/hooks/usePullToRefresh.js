import { useEffect, useRef, useCallback } from 'react';

/**
 * Pull-to-refresh hook.
 * @param {() => Promise<void>} onRefresh - async function to call on refresh
 * @param {{ threshold?: number, containerRef?: React.RefObject<HTMLElement | null> }} options
 */
export function usePullToRefresh(onRefresh, { threshold = 120, containerRef } = {}) {
  const startY = useRef(null);
  const pulling = useRef(false);
  const indicatorRef = useRef(null);

  const reset = useCallback(() => {
    startY.current = null;
    pulling.current = false;
    if (indicatorRef.current) {
      indicatorRef.current.style.transform = 'translateY(-100%)';
      indicatorRef.current.style.opacity = '0';
    }
  }, []);

  useEffect(() => {
    const scrollEl = containerRef?.current || document.documentElement;
    const touchEl = containerRef?.current || document.documentElement;

    if (!scrollEl || !touchEl) return undefined;

    const isAtTop = () => {
      if (containerRef?.current) {
        return containerRef.current.scrollTop <= 0;
      }
      return window.scrollY <= 0;
    };

    const onTouchStart = (e) => {
      // Only trigger when scrolled to the very top
      if (!isAtTop()) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { reset(); return; }
      // Don't fight native scroll
      if (!isAtTop()) { reset(); return; }

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
      startY.current = null;
      if (!pulling.current) {
        // Didn't reach threshold — reset indicator
        reset();
        return;
      }
      if (indicatorRef.current) {
        // Show spinning state
        indicatorRef.current.style.transform = 'translateY(0%)';
        indicatorRef.current.style.opacity = '1';
        indicatorRef.current.dataset.spinning = 'true';
      }
      try {
        await onRefresh();
      } finally {
        if (indicatorRef.current) {
          delete indicatorRef.current.dataset.spinning;
        }
        reset();
      }
    };

    touchEl.addEventListener('touchstart', onTouchStart, { passive: true });
    touchEl.addEventListener('touchmove', onTouchMove, { passive: true });
    touchEl.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      touchEl.removeEventListener('touchstart', onTouchStart);
      touchEl.removeEventListener('touchmove', onTouchMove);
      touchEl.removeEventListener('touchend', onTouchEnd);
    };
  }, [containerRef, onRefresh, threshold, reset]);

  return { indicatorRef };
}
