/**
 * Performance Monitoring Service Type Definitions
 *
 * Defines interfaces for performance tracking including:
 * - Custom application metrics (DRF parse time, score calculation, etc.)
 * - Core Web Vitals (LCP, FID, CLS, TTFB, FCP)
 * - Provider abstraction for future integrations (DataDog, New Relic)
 */

// ============================================================================
// METRIC TYPES
// ============================================================================

/**
 * Supported metric names for performance tracking
 *
 * Application metrics:
 * - drf_parse_time: Time to parse a DRF file
 * - score_calculation_time: Time to calculate horse scores
 * - render_time: Component render duration
 *
 * Core Web Vitals:
 * - lcp: Largest Contentful Paint
 * - fid: First Input Delay
 * - cls: Cumulative Layout Shift
 * - ttfb: Time to First Byte
 * - fcp: First Contentful Paint
 */
export type MetricName =
  | 'drf_parse_time'
  | 'score_calculation_time'
  | 'render_time'
  | 'lcp'
  | 'fid'
  | 'cls'
  | 'ttfb'
  | 'fcp'

/**
 * Unit of measurement for metrics
 */
export type MetricUnit = 'ms' | 's' | 'score' | 'ratio' | 'count' | 'bytes'

/**
 * A single performance metric
 */
export interface PerformanceMetric {
  /** Name of the metric */
  name: MetricName | string
  /** Numeric value of the metric */
  value: number
  /** Unit of measurement */
  unit: MetricUnit
  /** ISO timestamp when metric was recorded */
  timestamp: string
  /** Optional additional context */
  context?: TimingContext
}

/**
 * Context for timing operations
 */
export interface TimingContext {
  /** Component where the timing was recorded */
  component?: string
  /** Action being timed */
  action?: string
  /** Size of data being processed (e.g., number of horses) */
  dataSize?: number
  /** Additional metadata */
  [key: string]: unknown
}

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

/**
 * Provider type for performance monitoring backends
 */
export type PerformanceProviderType = 'mock' | 'datadog' | 'newrelic'

/**
 * Interface for performance monitoring providers
 *
 * Allows swapping between mock (development), DataDog, or New Relic
 * implementations without changing application code.
 */
export interface PerformanceProvider {
  /** Provider name for identification */
  readonly name: PerformanceProviderType

  /**
   * Track a custom metric
   * @param name The metric name
   * @param value The metric value
   * @param unit The unit of measurement
   * @param context Optional context
   */
  trackMetric(
    name: MetricName | string,
    value: number,
    unit: MetricUnit,
    context?: TimingContext
  ): void

  /**
   * Track a timing metric (shorthand for trackMetric with 'ms' unit)
   * @param name The metric name
   * @param durationMs Duration in milliseconds
   * @param context Optional context
   */
  trackTiming(
    name: MetricName | string,
    durationMs: number,
    context?: TimingContext
  ): void

  /**
   * Get all recorded metrics
   * @returns Array of recorded metrics
   */
  getMetrics(): PerformanceMetric[]

  /**
   * Clear all recorded metrics
   */
  clearMetrics(): void
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration for the performance monitoring service
 */
export interface PerformanceConfig {
  /** Whether performance tracking is enabled */
  enabled: boolean
  /** Maximum number of metrics to store in memory */
  maxMetrics: number
  /** Whether to log metrics to console (development) */
  consoleLogging: boolean
  /** Sample rate for metrics (0-1, where 1 = 100%) */
  sampleRate: number
}

/**
 * Default configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enabled: true,
  maxMetrics: 100,
  consoleLogging: true,
  sampleRate: 1.0,
}

// ============================================================================
// WEB VITALS TYPES
// ============================================================================

/**
 * Web Vitals metric names
 */
export type WebVitalName = 'lcp' | 'fid' | 'cls' | 'ttfb' | 'fcp'

/**
 * Web Vitals metric entry (compatible with web-vitals library)
 */
export interface WebVitalMetric {
  /** Metric name */
  name: WebVitalName
  /** Metric value */
  value: number
  /** Rating: good, needs-improvement, or poor */
  rating: 'good' | 'needs-improvement' | 'poor'
  /** Delta from last report (for CLS) */
  delta: number
  /** Unique ID for the metric */
  id: string
  /** Metric entries (for debugging) */
  entries: PerformanceEntry[]
}

/**
 * Callback for web vitals reporting
 */
export type WebVitalCallback = (metric: WebVitalMetric) => void

// ============================================================================
// TIMER TYPES
// ============================================================================

/**
 * Function returned by startTimer() to stop timing and record the metric
 */
export type StopTimerFn = () => void

/**
 * Extended stop function that also returns the duration
 */
export interface TimerResult {
  /** Duration in milliseconds */
  duration: number
  /** The recorded metric */
  metric: PerformanceMetric
}
