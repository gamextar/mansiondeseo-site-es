function createStorage(storageKey) {
  return {
    load() {
      if (typeof window === 'undefined') return {};
      try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    },
    save(value) {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch {}
    },
  };
}

export function createMutationQueue({
  storageKey,
  flushDelayMs = 2500,
  flush,
  onError,
}) {
  const storage = createStorage(storageKey);
  let pending = storage.load();
  let timer = null;
  let flushing = null;
  const listeners = new Set();

  const emit = () => {
    const snapshot = { ...pending };
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {}
    });
  };

  const persist = () => {
    storage.save(pending);
    emit();
  };

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const scheduleFlush = () => {
    clearTimer();
    timer = setTimeout(() => {
      queue.flush().catch(() => {});
    }, flushDelayMs);
  };

  const queue = {
    getPending() {
      return { ...pending };
    },
    get(key) {
      return pending[key];
    },
    set(key, value) {
      if (!key) return;
      pending = { ...pending, [key]: value };
      persist();
      scheduleFlush();
    },
    remove(key) {
      if (!(key in pending)) return;
      const next = { ...pending };
      delete next[key];
      pending = next;
      persist();
    },
    clear() {
      pending = {};
      persist();
      clearTimer();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async flush({ keepalive = false } = {}) {
      if (flushing) return flushing;
      const entries = Object.entries(pending);
      if (entries.length === 0) return [];

      clearTimer();

      const snapshot = Object.fromEntries(entries);
      flushing = Promise.resolve()
        .then(() => flush(entries.map(([key, value]) => ({ key, value })), { keepalive }))
        .then((result) => {
          const next = { ...pending };
          for (const [key, value] of Object.entries(snapshot)) {
            if (pending[key] === value) {
              delete next[key];
            }
          }
          pending = next;
          persist();
          return result;
        })
        .catch((error) => {
          onError?.(error);
          scheduleFlush();
          throw error;
        })
        .finally(() => {
          flushing = null;
        });

      return flushing;
    },
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      queue.flush({ keepalive: true }).catch(() => {});
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        queue.flush({ keepalive: true }).catch(() => {});
      }
    });
    window.addEventListener('online', () => {
      if (Object.keys(pending).length > 0) {
        queue.flush().catch(() => {});
      }
    });
  }

  return queue;
}
