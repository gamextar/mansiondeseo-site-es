import { isRecoverableAssetError, tryRecoverFromAssetFailure } from './assetRecovery';

export function lazyWithRetry(importer) {
  return () =>
    importer()
      .then((module) => module)
      .catch((error) => {
        if (typeof window === 'undefined' || !isRecoverableAssetError(error)) {
          throw error;
        }

        if (tryRecoverFromAssetFailure()) {
          return new Promise(() => {});
        }

        throw error;
      });
}
