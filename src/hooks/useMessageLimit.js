import { useState, useCallback } from 'react';

const MAX_MESSAGES = 5;
const STORAGE_KEY = 'mansion_msg_count';

export function useMessageLimit() {
  const [sent, setSent] = useState(() => {
    try {
      return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    } catch {
      return 0;
    }
  });

  const remaining = Math.max(0, MAX_MESSAGES - sent);
  const canSend = remaining > 0;

  const sendMessage = useCallback(() => {
    setSent((prev) => {
      const next = prev + 1;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // noop
      }
      return next;
    });
  }, []);

  const resetLimit = useCallback(() => {
    setSent(0);
    try {
      localStorage.setItem(STORAGE_KEY, '0');
    } catch {
      // noop
    }
  }, []);

  return { sent, remaining, canSend, sendMessage, resetLimit, max: MAX_MESSAGES };
}
