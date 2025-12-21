/**
 * useAnalytics Hook
 *
 * Exposes analytics tracking functionality to React components.
 * Wraps the analytics service with error handling to ensure
 * analytics failures never break the app.
 */

import { useCallback, useMemo } from 'react';
import { getAnalyticsService } from '../services/analytics';
import type { EventName, EventProperties } from '../services/analytics/types';

interface UseAnalyticsReturn {
  /**
   * Track an analytics event
   * @param eventName The name of the event to track
   * @param properties Additional properties for the event
   */
  trackEvent: (eventName: EventName, properties?: EventProperties) => void;
}

/**
 * Hook for tracking analytics events
 *
 * Features:
 * - Automatically includes timestamp
 * - Handles errors silently (analytics should never break the app)
 * - Provides consistent interface across the application
 *
 * @example
 * const { trackEvent } = useAnalytics()
 * trackEvent('file_uploaded', { fileSize: 1024, horseCount: 12 })
 */
export function useAnalytics(): UseAnalyticsReturn {
  // Get the singleton analytics service instance
  const analyticsService = useMemo(() => {
    try {
      return getAnalyticsService({ debug: true });
    } catch {
      // If service fails to initialize, return null
      // trackEvent will handle this gracefully
      return null;
    }
  }, []);

  const trackEvent = useCallback(
    (eventName: EventName, properties: EventProperties = {}) => {
      try {
        if (!analyticsService) {
          return;
        }

        // Add timestamp to all events
        const enrichedProperties: EventProperties = {
          ...properties,
          tracked_at: Date.now(),
        };

        // Track the event - service handles logging internally
        analyticsService.trackEvent(eventName, enrichedProperties);
      } catch {
        // Silently fail - analytics should never break the app
        // In development, log for debugging (Vite exposes dev mode via import.meta)
        if (import.meta.env?.DEV) {
          console.warn(`[useAnalytics] Failed to track event: ${eventName}`);
        }
      }
    },
    [analyticsService]
  );

  return {
    trackEvent,
  };
}

export default useAnalytics;
