/**
 * Performance Monitoring Service
 *
 * Production-grade performance tracking with:
 * - Custom metrics (DRF parse time, score calculation, render time)
 * - Core Web Vitals integration (LCP, FID, CLS, TTFB, FCP)
 * - Provider abstraction (mock, DataDog, New Relic ready)
 *
 * Usage:
 * ```ts
 * import { performanceService, getPerformanceProvider } from '@/services/performance'
 *
 * // Track a metric
 * performanceService.trackMetric('drf_parse_time', 1500, 'ms', { dataSize: 48 })
 *
 * // Track timing shorthand
 * performanceService.trackTiming('score_calculation_time', 85, { component: 'ScoringEngine' })
 *
 * // Use timer pattern
 * const stopTimer = performanceService.startTimer('render_time')
 * // ... do work ...
 * stopTimer() // Automatically calculates and logs duration
 *
 * // Get a specific provider
 * const provider = getPerformanceProvider('datadog')
 * ```
 */

import type {
  PerformanceMetric,
  PerformanceProvider,
  PerformanceProviderType,
  PerformanceConfig,
  MetricName,
  MetricUnit,
  TimingContext,
  StopTimerFn,
} from './types';
import { DEFAULT_PERFORMANCE_CONFIG } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Console colors for performance logs */
const PERF_LOG_COLORS = {
  metric: '#10b981', // Success green
  timing: '#19abb5', // Primary teal
  timer: '#f59e0b', // Warning amber
  info: '#888888', // Secondary gray
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format a metric for console output
 */
function formatMetricForConsole(metric: PerformanceMetric): string {
  const contextParts: string[] = [];

  if (metric.context?.component) {
    contextParts.push(`[${metric.context.component}]`);
  }
  if (metric.context?.action) {
    contextParts.push(metric.context.action);
  }
  if (metric.context?.dataSize !== undefined) {
    contextParts.push(`size: ${metric.context.dataSize}`);
  }

  const contextStr = contextParts.length > 0 ? ` | ${contextParts.join(' ')}` : '';
  return `${metric.name}: ${metric.value}${metric.unit}${contextStr}`;
}

/**
 * Get a formatted timestamp for logs
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

/**
 * Check if we should sample this metric (based on sample rate)
 */
function shouldSample(sampleRate: number): boolean {
  return Math.random() < sampleRate;
}

// ============================================================================
// MOCK PERFORMANCE SERVICE
// ============================================================================

/**
 * Mock performance service that logs to console
 *
 * Used in development for debugging and validating performance tracking.
 * In production, swap to DataDog or New Relic provider.
 */
class MockPerformanceService implements PerformanceProvider {
  readonly name: PerformanceProviderType = 'mock';

  private config: PerformanceConfig;
  private metrics: PerformanceMetric[] = [];

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
  }

  /**
   * Track a custom metric
   */
  trackMetric(
    name: MetricName | string,
    value: number,
    unit: MetricUnit,
    context?: TimingContext
  ): void {
    if (!this.config.enabled) return;
    if (!shouldSample(this.config.sampleRate)) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      context,
    };

    // Store metric
    this.metrics.push(metric);

    // Trim to max size
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics = this.metrics.slice(-this.config.maxMetrics);
    }

    // Console log in development
    if (this.config.consoleLogging) {
      const formatted = formatMetricForConsole(metric);
      console.log(
        `%c[PERF]%c ${getTimestamp()} %c${formatted}`,
        `color: ${PERF_LOG_COLORS.metric}; font-weight: bold`,
        `color: ${PERF_LOG_COLORS.info}`,
        `color: inherit`
      );
    }
  }

  /**
   * Track a timing metric (shorthand for trackMetric with 'ms' unit)
   */
  trackTiming(name: MetricName | string, durationMs: number, context?: TimingContext): void {
    this.trackMetric(name, durationMs, 'ms', context);
  }

  /**
   * Start a timer and return a function to stop it
   *
   * @example
   * const stop = performanceService.startTimer('score_calculation_time')
   * // ... do expensive work ...
   * stop() // Logs: score_calculation_time: 123ms
   */
  startTimer(name: MetricName | string, context?: TimingContext): StopTimerFn {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.trackTiming(name, Math.round(duration * 100) / 100, context);
    };
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear all recorded metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    if (this.config.consoleLogging) {
      console.log(
        `%c[PERF]%c Metrics cleared`,
        `color: ${PERF_LOG_COLORS.info}; font-weight: bold`,
        `color: ${PERF_LOG_COLORS.info}`
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// DATADOG PROVIDER (SCAFFOLDING)
// ============================================================================

/**
 * DataDog performance provider (scaffolding)
 *
 * Implementation notes for when DataDog is wired:
 * - Install @datadog/browser-rum package
 * - Initialize with datadogRum.init({ ... })
 * - Use datadogRum.addTiming() for custom timings
 * - Use datadogRum.addAction() for user actions
 */
class DataDogPerformanceService implements PerformanceProvider {
  readonly name: PerformanceProviderType = 'datadog';

  private config: PerformanceConfig;
  private metrics: PerformanceMetric[] = [];

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };

    // Log that DataDog is not yet configured
    if (this.config.consoleLogging) {
      console.warn(
        '[Performance] DataDog provider is scaffolded but not wired. ' +
          'Install @datadog/browser-rum and configure to enable.'
      );
    }
  }

  trackMetric(
    name: MetricName | string,
    value: number,
    unit: MetricUnit,
    context?: TimingContext
  ): void {
    if (!this.config.enabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      context,
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics = this.metrics.slice(-this.config.maxMetrics);
    }

    // TODO: When DataDog is wired, use:
    // datadogRum.addTiming(name, value)
    // or datadogRum.addAction(name, { value, ...context })

    if (this.config.consoleLogging) {
      console.log(`[DataDog] Would track: ${name} = ${value}${unit}`);
    }
  }

  trackTiming(name: MetricName | string, durationMs: number, context?: TimingContext): void {
    this.trackMetric(name, durationMs, 'ms', context);
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}

// ============================================================================
// NEW RELIC PROVIDER (SCAFFOLDING)
// ============================================================================

/**
 * New Relic performance provider (scaffolding)
 *
 * Implementation notes for when New Relic is wired:
 * - Install @newrelic/browser-agent package
 * - Initialize with newrelic.setCustomAttribute() for context
 * - Use newrelic.addPageAction() for custom events
 * - Use window.NREUM.addToTrace() for timing data
 */
class NewRelicPerformanceService implements PerformanceProvider {
  readonly name: PerformanceProviderType = 'newrelic';

  private config: PerformanceConfig;
  private metrics: PerformanceMetric[] = [];

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };

    // Log that New Relic is not yet configured
    if (this.config.consoleLogging) {
      console.warn(
        '[Performance] New Relic provider is scaffolded but not wired. ' +
          'Install @newrelic/browser-agent and configure to enable.'
      );
    }
  }

  trackMetric(
    name: MetricName | string,
    value: number,
    unit: MetricUnit,
    context?: TimingContext
  ): void {
    if (!this.config.enabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      context,
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics = this.metrics.slice(-this.config.maxMetrics);
    }

    // TODO: When New Relic is wired, use:
    // window.newrelic?.addPageAction(name, { value, ...context })

    if (this.config.consoleLogging) {
      console.log(`[NewRelic] Would track: ${name} = ${value}${unit}`);
    }
  }

  trackTiming(name: MetricName | string, durationMs: number, context?: TimingContext): void {
    this.trackMetric(name, durationMs, 'ms', context);
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}

// ============================================================================
// PROVIDER FACTORY
// ============================================================================

/** Cache of provider instances */
const providerCache: Partial<Record<PerformanceProviderType, PerformanceProvider>> = {};

/**
 * Get a performance provider by type
 *
 * @param type The provider type ('mock', 'datadog', 'newrelic')
 * @param config Optional configuration
 * @returns The performance provider instance
 *
 * @example
 * const mockProvider = getPerformanceProvider('mock')
 * const datadogProvider = getPerformanceProvider('datadog')
 */
export function getPerformanceProvider(
  type: PerformanceProviderType,
  config?: Partial<PerformanceConfig>
): PerformanceProvider {
  // Return cached instance if no config override
  if (!config && providerCache[type]) {
    return providerCache[type]!;
  }

  let provider: PerformanceProvider;

  switch (type) {
    case 'datadog':
      provider = new DataDogPerformanceService(config);
      break;
    case 'newrelic':
      provider = new NewRelicPerformanceService(config);
      break;
    case 'mock':
    default:
      provider = new MockPerformanceService(config);
      break;
  }

  // Cache the instance
  if (!config) {
    providerCache[type] = provider;
  }

  return provider;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Default performance service instance (uses mock provider)
 *
 * This is the primary export for application-wide performance tracking.
 */
export const performanceService = new MockPerformanceService();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Track a custom metric
 * @see MockPerformanceService.trackMetric
 */
export const trackMetric = performanceService.trackMetric.bind(performanceService);

/**
 * Track a timing metric
 * @see MockPerformanceService.trackTiming
 */
export const trackTiming = performanceService.trackTiming.bind(performanceService);

/**
 * Start a timer
 * @see MockPerformanceService.startTimer
 */
export const startTimer = performanceService.startTimer.bind(performanceService);

/**
 * Get all recorded metrics
 * @see MockPerformanceService.getMetrics
 */
export const getMetrics = performanceService.getMetrics.bind(performanceService);

/**
 * Clear all recorded metrics
 * @see MockPerformanceService.clearMetrics
 */
export const clearMetrics = performanceService.clearMetrics.bind(performanceService);

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

export type {
  PerformanceMetric,
  PerformanceProvider,
  PerformanceProviderType,
  PerformanceConfig,
  MetricName,
  MetricUnit,
  TimingContext,
  StopTimerFn,
  WebVitalName,
  WebVitalMetric,
  WebVitalCallback,
} from './types';

export { DEFAULT_PERFORMANCE_CONFIG } from './types';

// Default export
export default performanceService;
