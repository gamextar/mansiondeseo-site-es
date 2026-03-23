import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'mansion_age_verified';

export function useAgeVerified() {
  const [verified, setVerified] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const verify = useCallback(() => {
    setVerified(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage unavailable
    }
  }, []);

  const reset = useCallback(() => {
    setVerified(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable
    }
  }, []);

  return { verified, verify, reset };
}
