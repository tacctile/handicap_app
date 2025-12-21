/**
 * useOnlineStatus Hook
 *
 * Tracks browser online/offline status.
 * Critical for providing feedback when user is at the track with no signal.
 */

import { useState, useEffect, useCallback } from 'react';

interface OnlineStatus {
  /** True if browser reports online */
  isOnline: boolean;
  /** True if browser reports offline */
  isOffline: boolean;
  /** Timestamp of last status change */
  lastChanged: Date | null;
  /** Force a connectivity check */
  checkConnectivity: () => Promise<boolean>;
}

/**
 * Hook to track browser online/offline status
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(() => {
    // Default to true during SSR or if navigator is unavailable
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  const [lastChanged, setLastChanged] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastChanged(new Date());
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastChanged(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Force a connectivity check by attempting to fetch a small resource
   * This is useful because navigator.onLine can be unreliable
   */
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      // Try to fetch a small resource with cache disabled
      const response = await fetch('/favicon.svg', {
        method: 'HEAD',
        cache: 'no-store',
      });
      const online = response.ok;
      setIsOnline(online);
      if (!online) setLastChanged(new Date());
      return online;
    } catch {
      setIsOnline(false);
      setLastChanged(new Date());
      return false;
    }
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    lastChanged,
    checkConnectivity,
  };
}

export default useOnlineStatus;
