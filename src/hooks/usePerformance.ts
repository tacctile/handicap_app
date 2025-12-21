/**
 * usePerformance Hook
 *
 * Exposes performance tracking functionality to React components.
 * Wraps the performance service with error handling to ensure
 * performance tracking never breaks the app.
 *
 * @example
 * ```tsx
 * import { usePerformance } from '@/hooks/usePerformance'
 *
 * function ScoreCalculator() {
 *   const { trackTiming, startTimer } = usePerformance()
 *
 *   const calculateScores = async () => {
 *     const stop = startTimer('score_calculation_time', { component: 'ScoreCalculator' })
 *     // ... expensive calculation ...
 *     stop() // Automatically logs duration
 *   }
 *
 *   // Or track a known duration
 *   trackTiming('drf_parse_time', 1500, { dataSize: 48 })
 * }
 * ```
 */

import { useCallback, useMemo } from 'react';
import {
  performanceService,
  type MetricName,
  type MetricUnit,
  type TimingContext,
  type StopTimerFn,
  type PerformanceMetric,
} from '../services/performance';

/**
 * Return type for usePerformance hook
 */
interface UsePerformanceReturn {
  /**
   * Track a custom metric with name, value, unit, and optional context
   *
   * @example
   * trackMetric('drf_parse_time', 1500, 'ms', { fileName: 'races.drf' })
   */
  trackMetric: (
    name: MetricName | string,
    value: number,
    unit: MetricUnit,
    context?: TimingContext
  ) => void;

  /**
   * Track a timing metric (shorthand for trackMetric with 'ms' unit)
   *
   * @example
   * trackTiming('score_calculation_time', 85, { component: 'ScoringEngine' })
   */
  trackTiming: (name: MetricName | string, durationMs: number, context?: TimingContext) => void;

  /**
   * Start a timer and return a function to stop it
   * The stop function automatically calculates and logs the duration
   *
   * @example
   * const stop = startTimer('render_time')
   * // ... do work ...
   * stop() // Logs: render_time: 123ms
   */
  startTimer: (name: MetricName | string, context?: TimingContext) => StopTimerFn;

  /**
   * Get all recorded metrics (useful for debugging/testing)
   */
  getMetrics: () => PerformanceMetric[];

  /**
   * Clear all recorded metrics
   */
  clearMetrics: () => void;
}

/**
 * Hook for tracking performance metrics in React components
 *
 * Features:
 * - Safe error handling (performance tracking never breaks the app)
 * - Memoized functions for stable references
 * - Access to all performance service capabilities
 * - TypeScript-safe metric names
 *
 * @returns Object with performance tracking methods
 *
 * @example
 * ```tsx
 * function DRFParser() {
 *   const { startTimer, trackMetric } = usePerformance()
 *
 *   const parseFile = async (file: File) => {
 *     const stop = startTimer('drf_parse_time', { dataSize: file.size })
 *
 *     try {
 *       const result = await parseDRF(file)
 *       stop() // Logs timing on success
 *
 *       // Track additional metric
 *       trackMetric('horse_count', result.horses.length, 'count')
 *
 *       return result
 *     } catch (error) {
 *       stop() // Still logs timing on error
 *       throw error
 *     }
 *   }
 *
 *   return <FileUpload onFile={parseFile} />
 * }
 * ```
 */
export function usePerformance(): UsePerformanceReturn {
  /**
   * Track a custom metric
   */
  const trackMetric = useCallback(
    (name: MetricName | string, value: number, unit: MetricUnit, context?: TimingContext): void => {
      try {
        performanceService.trackMetric(name, value, unit, context);
      } catch {
        // Silently fail - performance tracking should never break the app
        if (import.meta.env?.DEV) {
          console.warn(`[usePerformance] Failed to track metric: ${name}`);
        }
      }
    },
    []
  );

  /**
   * Track a timing metric (shorthand)
   */
  const trackTiming = useCallback(
    (name: MetricName | string, durationMs: number, context?: TimingContext): void => {
      try {
        performanceService.trackTiming(name, durationMs, context);
      } catch {
        // Silently fail
        if (import.meta.env?.DEV) {
          console.warn(`[usePerformance] Failed to track timing: ${name}`);
        }
      }
    },
    []
  );

  /**
   * Start a timer
   */
  const startTimer = useCallback(
    (name: MetricName | string, context?: TimingContext): StopTimerFn => {
      try {
        return performanceService.startTimer(name, context);
      } catch {
        // Return a no-op function if timer creation fails
        if (import.meta.env?.DEV) {
          console.warn(`[usePerformance] Failed to start timer: ${name}`);
        }
        return () => {
          // No-op
        };
      }
    },
    []
  );

  /**
   * Get all recorded metrics
   */
  const getMetrics = useCallback((): PerformanceMetric[] => {
    try {
      return performanceService.getMetrics();
    } catch {
      return [];
    }
  }, []);

  /**
   * Clear all recorded metrics
   */
  const clearMetrics = useCallback((): void => {
    try {
      performanceService.clearMetrics();
    } catch {
      // Silently fail
    }
  }, []);

  /**
   * Memoize the return object for stable reference
   */
  return useMemo(
    () => ({
      trackMetric,
      trackTiming,
      startTimer,
      getMetrics,
      clearMetrics,
    }),
    [trackMetric, trackTiming, startTimer, getMetrics, clearMetrics]
  );
}

export default usePerformance;
