import { useEffect, useRef, useCallback } from 'react';

/**
 * Pull-to-refresh hook.
 * @param {() => Promise<void>} onRefresh - async function to call on refresh
 * @param {{ threshold?: number, containerRef?: React.RefObject }} options
 */
export function usePullToRefresh(onRefresh, { threshold = 70 } = {}) {
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
    const el = document.documentElement;

    const onTouchStart = (e) => {
      // Only trigger when scrolled to the very top
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { reset(); return; }
      // Don't fight native scroll
      if (window.scrollY > 0) { reset(); return; }

      pulling.current = true;
      const progress = Math.min(dy / threshold, 1);
      if (indicatorRef.current) {
        indicatorRef.current.style.transform = `translateY(${-100 + progress * 100}%)`;
        indicatorRef.current.style.opacity = String(progress);
      }
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
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

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh, threshold, reset]);

  return { indicatorRef };
}
