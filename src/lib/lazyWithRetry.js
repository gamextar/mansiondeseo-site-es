function shouldReloadForImportError(error) {
  const message = String(error?.message || error || '');
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('is not a valid JavaScript MIME type') ||
    message.includes('ChunkLoadError')
  );
}

export function lazyWithRetry(importer, key) {
  return () =>
    importer()
      .then((module) => {
        try {
          sessionStorage.removeItem(key);
        } catch {}
        return module;
      })
      .catch((error) => {
        if (typeof window === 'undefined' || !shouldReloadForImportError(error)) {
          throw error;
        }

        const alreadyRetried = sessionStorage.getItem(key) === '1';
        if (alreadyRetried) {
          sessionStorage.removeItem(key);
          throw error;
        }

        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise(() => {});
      });
}
