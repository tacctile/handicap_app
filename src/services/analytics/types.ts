/**
 * Analytics Service Type Definitions
 *
 * Provides type-safe abstractions for usage tracking and analytics.
 * Designed to work with Mixpanel, Amplitude, or mock implementations.
 */

// ============================================================================
// ANALYTICS PROVIDERS
// ============================================================================

/**
 * Supported analytics providers
 */
export type AnalyticsProviderType = 'mock' | 'mixpanel' | 'amplitude'

/**
 * Configuration for analytics service
 */
export interface AnalyticsConfig {
  /** Which analytics provider to use */
  provider: AnalyticsProviderType
  /** API key for the provider (not used by mock) */
  apiKey?: string
  /** Whether to enable debug logging */
  debug?: boolean
  /** Batch size before auto-flush */
  batchSize?: number
  /** Flush interval in milliseconds */
  flushIntervalMs?: number
}

/**
 * Default analytics configuration
 */
export const defaultAnalyticsConfig: AnalyticsConfig = {
  provider: 'mock',
  debug: true,
  batchSize: 10,
  flushIntervalMs: 30000, // 30 seconds
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Supported event names for tracking
 */
export type EventName =
  | 'file_uploaded'
  | 'race_analyzed'
  | 'bet_viewed'
  | 'exotic_built'
  | 'session_start'
  | 'session_end'
  | 'feature_used'

/**
 * Event properties - flexible key-value pairs for event metadata
 */
export type EventProperties = Record<string, string | number | boolean | null>

/**
 * Analytics event structure
 */
export interface AnalyticsEvent {
  /** The name/type of the event */
  eventName: EventName
  /** When the event occurred */
  timestamp: number
  /** Additional properties for the event */
  properties: EventProperties
  /** User ID if available (optional) */
  userId?: string
}

// ============================================================================
// USER ACTIVITY TYPES
// ============================================================================

/**
 * User activity summary
 */
export interface UserActivity {
  /** The user's identifier */
  userId: string
  /** List of events for this user */
  events: AnalyticsEvent[]
  /** Total number of sessions */
  sessionCount: number
  /** Timestamp of last activity */
  lastActive: number
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Analytics error codes
 */
export type AnalyticsErrorCode =
  | 'NOT_IMPLEMENTED'
  | 'INVALID_EVENT'
  | 'NETWORK_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'AUTHENTICATION_ERROR'
  | 'UNKNOWN_ERROR'

/**
 * Structured analytics error
 */
export interface AnalyticsError {
  /** Error code for programmatic handling */
  code: AnalyticsErrorCode
  /** Human-readable error message */
  message: string
  /** Whether the operation can be retried */
  retryable: boolean
  /** Original error if any */
  originalError?: unknown
}

/**
 * Create a typed analytics error
 */
export function createAnalyticsError(
  code: AnalyticsErrorCode,
  message: string,
  retryable: boolean = false,
  originalError?: unknown
): AnalyticsError {
  return { code, message, retryable, originalError }
}

/**
 * Type guard for AnalyticsError
 */
export function isAnalyticsError(error: unknown): error is AnalyticsError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'retryable' in error
  )
}

// ============================================================================
// SERVICE INTERFACE
// ============================================================================

/**
 * Analytics Provider interface
 * All analytics providers must implement this interface
 */
export interface IAnalyticsProvider {
  /**
   * Track an analytics event
   * @param eventName The name of the event to track
   * @param properties Additional properties for the event
   * @param userId Optional user identifier
   */
  trackEvent(
    eventName: EventName,
    properties?: EventProperties,
    userId?: string
  ): void

  /**
   * Get activity summary for a user
   * @param userId The user's identifier
   * @returns User activity data
   */
  getActivity(userId: string): Promise<UserActivity | null>

  /**
   * Flush any pending events to the analytics service
   * @returns Promise that resolves when flush is complete
   */
  flush(): Promise<void>

  /**
   * Get the provider type
   */
  getProviderType(): AnalyticsProviderType

  /**
   * Check if the provider is available/configured
   */
  isAvailable(): boolean
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Result type for async analytics operations
 */
export type AnalyticsResult<T> =
  | { success: true; data: T }
  | { success: false; error: AnalyticsError }

/**
 * Wrap async analytics operation in result type
 */
export async function wrapAnalyticsResult<T>(
  operation: () => Promise<T>
): Promise<AnalyticsResult<T>> {
  try {
    const data = await operation()
    return { success: true, data }
  } catch (error) {
    if (isAnalyticsError(error)) {
      return { success: false, error }
    }
    return {
      success: false,
      error: createAnalyticsError(
        'UNKNOWN_ERROR',
        'An unexpected error occurred',
        false,
        error
      ),
    }
  }
}
