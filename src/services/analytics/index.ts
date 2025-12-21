/**
 * Analytics Service Implementation
 *
 * Provides analytics/usage tracking with support for multiple providers.
 * Currently implements a mock provider for development/testing.
 * Ready for Mixpanel and Amplitude integration.
 */

import type {
  AnalyticsProviderType,
  AnalyticsConfig,
  AnalyticsEvent,
  EventName,
  EventProperties,
  UserActivity,
  IAnalyticsProvider,
} from './types';

import { defaultAnalyticsConfig, createAnalyticsError } from './types';

// Re-export types for convenience
export * from './types';

// ============================================================================
// MOCK ANALYTICS SERVICE
// ============================================================================

/**
 * Mock analytics service for development and testing
 * Logs events to console in dev mode and batches for simulated flush
 */
class MockAnalyticsService implements IAnalyticsProvider {
  private config: AnalyticsConfig;
  private eventQueue: AnalyticsEvent[] = [];
  private userActivities: Map<string, UserActivity> = new Map();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...defaultAnalyticsConfig, ...config };
    this.startFlushTimer();
  }

  /**
   * Start the automatic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    const interval = this.config.flushIntervalMs || 30000;
    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush().catch((err) => {
          if (this.config.debug) {
            console.error('[Analytics] Auto-flush failed:', err);
          }
        });
      }
    }, interval);
  }

  /**
   * Log event to console in debug mode
   */
  private logEvent(event: AnalyticsEvent): void {
    if (this.config.debug) {
      console.log(`[Analytics] Event: ${event.eventName}`, {
        timestamp: new Date(event.timestamp).toISOString(),
        userId: event.userId || 'anonymous',
        properties: event.properties,
      });
    }
  }

  /**
   * Check if batch size reached and auto-flush if needed
   */
  private checkBatchSize(): void {
    const batchSize = this.config.batchSize || 10;
    if (this.eventQueue.length >= batchSize) {
      this.flush().catch((err) => {
        if (this.config.debug) {
          console.error('[Analytics] Batch flush failed:', err);
        }
      });
    }
  }

  /**
   * Update user activity tracking
   */
  private updateUserActivity(event: AnalyticsEvent): void {
    const userId = event.userId || 'anonymous';
    const existing = this.userActivities.get(userId);

    if (existing) {
      existing.events.push(event);
      existing.lastActive = event.timestamp;
      if (event.eventName === 'session_start') {
        existing.sessionCount++;
      }
    } else {
      this.userActivities.set(userId, {
        userId,
        events: [event],
        sessionCount: event.eventName === 'session_start' ? 1 : 0,
        lastActive: event.timestamp,
      });
    }
  }

  trackEvent(eventName: EventName, properties: EventProperties = {}, userId?: string): void {
    const event: AnalyticsEvent = {
      eventName,
      timestamp: Date.now(),
      properties,
      userId,
    };

    // Log immediately in dev mode
    this.logEvent(event);

    // Add to queue
    this.eventQueue.push(event);

    // Track user activity
    this.updateUserActivity(event);

    // Check if we need to flush
    this.checkBatchSize();
  }

  async getActivity(userId: string): Promise<UserActivity | null> {
    // Simulate async lookup
    await new Promise((resolve) => setTimeout(resolve, 10));

    const activity = this.userActivities.get(userId);
    if (activity) {
      return { ...activity, events: [...activity.events] };
    }
    return null;
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    if (this.config.debug) {
      console.log(
        `[Analytics] Flushing ${eventsToFlush.length} events (mock - not sent to server)`
      );
    }

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (this.config.debug) {
      console.log('[Analytics] Flush complete');
    }
  }

  getProviderType(): AnalyticsProviderType {
    return 'mock';
  }

  isAvailable(): boolean {
    return true; // Mock is always available
  }

  /**
   * Stop the flush timer (for cleanup)
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// ============================================================================
// PROVIDER STUBS
// ============================================================================

/**
 * Mixpanel analytics service stub
 * Throws "not implemented" error until actual integration is added
 */
class MixpanelAnalyticsService implements IAnalyticsProvider {
  constructor(_config: Partial<AnalyticsConfig> = {}) {
    // Config would be used when implementing actual Mixpanel integration
  }

  trackEvent(_eventName: EventName, _properties?: EventProperties, _userId?: string): void {
    throw createAnalyticsError(
      'NOT_IMPLEMENTED',
      'Mixpanel analytics provider is not yet implemented',
      false
    );
  }

  async getActivity(_userId: string): Promise<UserActivity | null> {
    throw createAnalyticsError(
      'NOT_IMPLEMENTED',
      'Mixpanel analytics provider is not yet implemented',
      false
    );
  }

  async flush(): Promise<void> {
    throw createAnalyticsError(
      'NOT_IMPLEMENTED',
      'Mixpanel analytics provider is not yet implemented',
      false
    );
  }

  getProviderType(): AnalyticsProviderType {
    return 'mixpanel';
  }

  isAvailable(): boolean {
    return false;
  }
}

/**
 * Amplitude analytics service stub
 * Throws "not implemented" error until actual integration is added
 */
class AmplitudeAnalyticsService implements IAnalyticsProvider {
  constructor(_config: Partial<AnalyticsConfig> = {}) {
    // Config would be used when implementing actual Amplitude integration
  }

  trackEvent(_eventName: EventName, _properties?: EventProperties, _userId?: string): void {
    throw createAnalyticsError(
      'NOT_IMPLEMENTED',
      'Amplitude analytics provider is not yet implemented',
      false
    );
  }

  async getActivity(_userId: string): Promise<UserActivity | null> {
    throw createAnalyticsError(
      'NOT_IMPLEMENTED',
      'Amplitude analytics provider is not yet implemented',
      false
    );
  }

  async flush(): Promise<void> {
    throw createAnalyticsError(
      'NOT_IMPLEMENTED',
      'Amplitude analytics provider is not yet implemented',
      false
    );
  }

  getProviderType(): AnalyticsProviderType {
    return 'amplitude';
  }

  isAvailable(): boolean {
    return false;
  }
}

// ============================================================================
// ANALYTICS SERVICE FACTORY
// ============================================================================

/**
 * Get an analytics provider instance based on the specified type
 * @param type The provider type to instantiate
 * @param config Optional configuration for the provider
 * @returns An analytics provider instance
 */
export function getAnalyticsProvider(
  type: AnalyticsProviderType = 'mock',
  config: Partial<AnalyticsConfig> = {}
): IAnalyticsProvider {
  const finalConfig = { ...defaultAnalyticsConfig, ...config, provider: type };

  switch (type) {
    case 'mixpanel':
      console.warn('[Analytics] Mixpanel provider not yet implemented, returning stub');
      return new MixpanelAnalyticsService(finalConfig);

    case 'amplitude':
      console.warn('[Analytics] Amplitude provider not yet implemented, returning stub');
      return new AmplitudeAnalyticsService(finalConfig);

    case 'mock':
    default:
      return new MockAnalyticsService(finalConfig);
  }
}

/**
 * Create an analytics service instance based on configuration
 * Alias for getAnalyticsProvider for consistency with other services
 */
export function createAnalyticsService(config: Partial<AnalyticsConfig> = {}): IAnalyticsProvider {
  const finalConfig = { ...defaultAnalyticsConfig, ...config };
  return getAnalyticsProvider(finalConfig.provider, finalConfig);
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let analyticsServiceInstance: IAnalyticsProvider | null = null;

/**
 * Get the singleton analytics service instance
 * Creates one if it doesn't exist (defaults to mock)
 */
export function getAnalyticsService(config?: Partial<AnalyticsConfig>): IAnalyticsProvider {
  if (!analyticsServiceInstance) {
    analyticsServiceInstance = createAnalyticsService(config);
  }
  return analyticsServiceInstance;
}

/**
 * Reset the analytics service instance (useful for testing)
 */
export function resetAnalyticsService(): void {
  if (analyticsServiceInstance && 'destroy' in analyticsServiceInstance) {
    (analyticsServiceInstance as MockAnalyticsService).destroy();
  }
  analyticsServiceInstance = null;
}

/**
 * Export the service classes for direct instantiation if needed
 */
export { MockAnalyticsService, MixpanelAnalyticsService, AmplitudeAnalyticsService };

/**
 * Default export is the singleton getter
 */
export default getAnalyticsService;
