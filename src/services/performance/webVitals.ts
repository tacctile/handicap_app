/**
 * Web Vitals Integration
 *
 * Scaffolding for Core Web Vitals tracking:
 * - LCP (Largest Contentful Paint) - Loading performance
 * - FID (First Input Delay) - Interactivity
 * - CLS (Cumulative Layout Shift) - Visual stability
 * - TTFB (Time to First Byte) - Server response time
 * - FCP (First Contentful Paint) - Initial render
 *
 * When ready to enable:
 * 1. Install: npm install web-vitals
 * 2. Uncomment the import and real implementations
 * 3. Call reportWebVitals() in main.tsx
 *
 * @see https://web.dev/vitals/
 * @see https://github.com/GoogleChrome/web-vitals
 */

import type { WebVitalMetric, WebVitalCallback, WebVitalName } from './types'
import { performanceService } from './index'

// ============================================================================
// WEB VITALS THRESHOLDS
// ============================================================================

/**
 * Performance thresholds for Core Web Vitals ratings
 *
 * Values based on Google's recommendations:
 * @see https://web.dev/vitals/#core-web-vitals
 */
export const WEB_VITALS_THRESHOLDS: Record<
  WebVitalName,
  { good: number; needsImprovement: number }
> = {
  lcp: { good: 2500, needsImprovement: 4000 }, // ms
  fid: { good: 100, needsImprovement: 300 }, // ms
  cls: { good: 0.1, needsImprovement: 0.25 }, // score
  ttfb: { good: 800, needsImprovement: 1800 }, // ms
  fcp: { good: 1800, needsImprovement: 3000 }, // ms
}

/**
 * Get the rating for a Web Vital metric
 */
export function getWebVitalRating(
  name: WebVitalName,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = WEB_VITALS_THRESHOLDS[name]
  if (value <= thresholds.good) {
    return 'good'
  }
  if (value <= thresholds.needsImprovement) {
    return 'needs-improvement'
  }
  return 'poor'
}

// ============================================================================
// CONSOLE FORMATTING
// ============================================================================

/** Console colors for Web Vitals ratings */
const RATING_COLORS = {
  good: '#10b981', // Success green
  'needs-improvement': '#f59e0b', // Warning amber
  poor: '#ef4444', // Error red
}

/**
 * Log a Web Vital metric to console with color-coded rating
 */
function logWebVital(metric: WebVitalMetric): void {
  const color = RATING_COLORS[metric.rating]
  const displayName = metric.name.toUpperCase()
  const unit = metric.name === 'cls' ? '' : 'ms'

  console.log(
    `%c[WEB VITAL]%c ${displayName}: %c${metric.value.toFixed(2)}${unit} %c(${metric.rating})`,
    'color: #19abb5; font-weight: bold',
    'color: inherit',
    `color: ${color}; font-weight: bold`,
    `color: ${color}`
  )
}

// ============================================================================
// MOCK WEB VITALS (for scaffolding)
// ============================================================================

/**
 * Mock metric generator for development
 *
 * Simulates what the real web-vitals library would provide.
 * Remove when real implementation is enabled.
 */
function createMockMetric(name: WebVitalName, value: number): WebVitalMetric {
  return {
    name,
    value,
    rating: getWebVitalRating(name, value),
    delta: value, // First report, delta equals value
    id: `v1-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    entries: [], // Would contain PerformanceEntry objects
  }
}

/**
 * Default callback that logs metrics and tracks them in performance service
 */
function defaultWebVitalHandler(metric: WebVitalMetric): void {
  // Log to console
  logWebVital(metric)

  // Track in performance service
  performanceService.trackMetric(
    metric.name,
    metric.value,
    metric.name === 'cls' ? 'score' : 'ms',
    {
      action: 'web_vital',
      component: 'WebVitals',
      rating: metric.rating,
    }
  )
}

// ============================================================================
// REAL WEB VITALS IMPLEMENTATION (SCAFFOLDED)
// ============================================================================

/*
When ready to enable real Web Vitals:

1. Install the package:
   npm install web-vitals

2. Uncomment the import:
   import { onLCP, onFID, onCLS, onTTFB, onFCP } from 'web-vitals'

3. Uncomment and use the real implementation:

export function reportWebVitals(onMetric?: WebVitalCallback): void {
  const handler = onMetric ?? defaultWebVitalHandler

  // These functions are from the web-vitals library
  onLCP((metric) => {
    handler(transformWebVitalMetric(metric, 'lcp'))
  })

  onFID((metric) => {
    handler(transformWebVitalMetric(metric, 'fid'))
  })

  onCLS((metric) => {
    handler(transformWebVitalMetric(metric, 'cls'))
  })

  onTTFB((metric) => {
    handler(transformWebVitalMetric(metric, 'ttfb'))
  })

  onFCP((metric) => {
    handler(transformWebVitalMetric(metric, 'fcp'))
  })
}

function transformWebVitalMetric(metric: Metric, name: WebVitalName): WebVitalMetric {
  return {
    name,
    value: metric.value,
    rating: metric.rating as 'good' | 'needs-improvement' | 'poor',
    delta: metric.delta,
    id: metric.id,
    entries: metric.entries,
  }
}
*/

// ============================================================================
// SCAFFOLDED IMPLEMENTATION
// ============================================================================

/**
 * Report Web Vitals metrics
 *
 * Currently scaffolded - logs a message about setup.
 * When web-vitals package is installed, this will capture real metrics.
 *
 * @param onMetric Optional callback for each metric. Defaults to logging + tracking.
 *
 * @example
 * // In main.tsx or App.tsx:
 * import { reportWebVitals } from '@/services/performance/webVitals'
 *
 * // Use default handler (logs + tracks)
 * reportWebVitals()
 *
 * // Or provide custom handler
 * reportWebVitals((metric) => {
 *   console.log('Custom handler:', metric.name, metric.value)
 *   // Send to analytics, etc.
 * })
 */
export function reportWebVitals(onMetric?: WebVitalCallback): void {
  const handler = onMetric ?? defaultWebVitalHandler

  // Log scaffolding message
  console.log(
    '%c[WEB VITALS]%c Scaffolded - install web-vitals package to enable real metrics',
    'color: #19abb5; font-weight: bold',
    'color: #888888'
  )

  // For development/demo purposes, simulate metrics after a delay
  // Remove this block when real implementation is enabled
  if (import.meta.env?.DEV) {
    // Simulate TTFB (fires quickly)
    setTimeout(() => {
      const ttfb = createMockMetric('ttfb', 150 + Math.random() * 200)
      handler(ttfb)
    }, 100)

    // Simulate FCP
    setTimeout(() => {
      const fcp = createMockMetric('fcp', 800 + Math.random() * 400)
      handler(fcp)
    }, 500)

    // Simulate LCP
    setTimeout(() => {
      const lcp = createMockMetric('lcp', 1200 + Math.random() * 800)
      handler(lcp)
    }, 1500)

    // Simulate FID (requires user interaction, so we just log a sample)
    setTimeout(() => {
      const fid = createMockMetric('fid', 20 + Math.random() * 50)
      handler(fid)
    }, 2000)

    // Simulate CLS
    setTimeout(() => {
      const cls = createMockMetric('cls', 0.02 + Math.random() * 0.05)
      handler(cls)
    }, 3000)
  }
}

/**
 * Get a specific Web Vital on demand
 *
 * Scaffolded - returns null until web-vitals package is installed.
 *
 * @param name The Web Vital to get
 * @returns Promise resolving to the metric or null
 */
export async function getWebVital(name: WebVitalName): Promise<WebVitalMetric | null> {
  // Scaffolded - return simulated value in development
  if (import.meta.env?.DEV) {
    const mockValues: Record<WebVitalName, number> = {
      lcp: 1500 + Math.random() * 500,
      fid: 30 + Math.random() * 40,
      cls: 0.03 + Math.random() * 0.04,
      ttfb: 180 + Math.random() * 120,
      fcp: 900 + Math.random() * 300,
    }

    return createMockMetric(name, mockValues[name])
  }

  // In production without web-vitals, return null
  console.warn(
    `[WebVitals] Cannot get ${name} - web-vitals package not installed`
  )
  return null
}

/**
 * Check if Web Vitals API is available in the browser
 */
export function isWebVitalsSupported(): boolean {
  // Check for Performance API support
  return (
    typeof window !== 'undefined' &&
    typeof PerformanceObserver !== 'undefined' &&
    typeof performance !== 'undefined' &&
    typeof performance.getEntriesByType === 'function'
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { WebVitalMetric, WebVitalCallback, WebVitalName } from './types'
