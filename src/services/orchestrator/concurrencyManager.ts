/**
 * Concurrency Manager
 *
 * Manages concurrent track processing and API call limits for the
 * multi-track orchestration layer.
 *
 * Features:
 * - Limits concurrent track processing (default: 2 tracks at a time)
 * - Limits concurrent API calls (default: 6 at a time, 4 bots × 1.5 buffer)
 * - Request queuing when limits exceeded
 * - Adaptive throttling when errors spike
 * - Integration with rate limiter
 */

import { getRateLimiter, type RateLimitConfig, type RateLimitResult } from '../../lib/rateLimit';
import type { SlotAcquisitionResult, ConcurrencyStats, OrchestratorConfig } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface QueuedRequest {
  id: string;
  resolve: (result: SlotAcquisitionResult) => void;
  reject: (error: Error) => void;
  timestamp: number;
  timeout?: ReturnType<typeof setTimeout>;
}

interface ActiveSlot {
  id: string;
  type: 'track' | 'api';
  acquiredAt: number;
  trackCode?: string;
}

// ============================================================================
// CONCURRENCY MANAGER CLASS
// ============================================================================

/**
 * Manages concurrency limits for track processing and API calls
 */
export class ConcurrencyManager {
  private config: Pick<
    OrchestratorConfig,
    'maxConcurrentTracks' | 'maxConcurrentApiCalls' | 'rateLimitPerMinute' | 'adaptiveThrottling'
  >;

  // Active slots tracking
  private activeTrackSlots: Map<string, ActiveSlot> = new Map();
  private activeApiSlots: Map<string, ActiveSlot> = new Map();

  // Request queues
  private trackQueue: QueuedRequest[] = [];
  private apiQueue: QueuedRequest[] = [];

  // Slot counter for unique IDs
  private slotCounter = 0;

  // Adaptive throttling state
  private recentErrors: number[] = [];
  private errorWindowMs = 60000; // 1 minute window
  private errorThreshold = 5; // Errors in window to trigger throttling
  private throttleMultiplier = 1.0;

  // Rate limit config for API calls
  private apiRateLimitConfig: RateLimitConfig;

  constructor(
    config: Partial<
      Pick<
        OrchestratorConfig,
        | 'maxConcurrentTracks'
        | 'maxConcurrentApiCalls'
        | 'rateLimitPerMinute'
        | 'adaptiveThrottling'
      >
    > = {}
  ) {
    this.config = {
      maxConcurrentTracks: config.maxConcurrentTracks ?? 2,
      maxConcurrentApiCalls: config.maxConcurrentApiCalls ?? 6,
      rateLimitPerMinute: config.rateLimitPerMinute ?? 120,
      adaptiveThrottling: config.adaptiveThrottling ?? true,
    };

    // Configure rate limiter for multi-track mode
    this.apiRateLimitConfig = {
      maxRequests: this.config.rateLimitPerMinute,
      windowMs: 60000, // 1 minute
      burstLimit: Math.min(10, Math.floor(this.config.rateLimitPerMinute / 10)),
      message: 'API rate limit exceeded. Requests are being queued.',
    };
  }

  // ============================================================================
  // PUBLIC API - TRACK SLOTS
  // ============================================================================

  /**
   * Acquire a track processing slot
   *
   * @param trackCode - Track code for identification
   * @param timeoutMs - Maximum time to wait for slot (default: 30000)
   * @returns Promise resolving to slot acquisition result
   */
  async acquireTrackSlot(trackCode: string, timeoutMs = 30000): Promise<SlotAcquisitionResult> {
    const slotId = this.generateSlotId('track');

    // Check if slot available immediately
    if (this.activeTrackSlots.size < this.config.maxConcurrentTracks) {
      const slot: ActiveSlot = {
        id: slotId,
        type: 'track',
        acquiredAt: Date.now(),
        trackCode,
      };
      this.activeTrackSlots.set(slotId, slot);
      return { acquired: true, slotId, waitTime: 0 };
    }

    // Queue the request
    return this.queueRequest('track', slotId, trackCode, timeoutMs);
  }

  /**
   * Release a track processing slot
   *
   * @param slotId - Slot ID to release
   */
  releaseTrackSlot(slotId: string): void {
    const slot = this.activeTrackSlots.get(slotId);
    if (!slot) {
      console.warn(`[ConcurrencyManager] Attempted to release unknown track slot: ${slotId}`);
      return;
    }

    this.activeTrackSlots.delete(slotId);
    this.processQueue('track');
  }

  // ============================================================================
  // PUBLIC API - API SLOTS
  // ============================================================================

  /**
   * Acquire an API call slot
   *
   * @param trackCode - Track code for identification (optional)
   * @param timeoutMs - Maximum time to wait for slot (default: 15000)
   * @returns Promise resolving to slot acquisition result
   */
  async acquireApiSlot(trackCode?: string, timeoutMs = 15000): Promise<SlotAcquisitionResult> {
    const slotId = this.generateSlotId('api');

    // Check rate limit first
    const rateLimiter = getRateLimiter();
    const rateLimitResult = rateLimiter.check('orchestrator-api', this.apiRateLimitConfig);

    if (!rateLimitResult.allowed) {
      // Rate limited - wait and retry
      const waitTime = Math.min(rateLimitResult.retryAfter, timeoutMs);
      await this.sleep(waitTime);

      // Check again
      const retryResult = rateLimiter.check('orchestrator-api', this.apiRateLimitConfig);
      if (!retryResult.allowed) {
        return {
          acquired: false,
          reason: 'Rate limit exceeded',
          waitTime,
        };
      }
    }

    // Apply adaptive throttling
    const effectiveMaxSlots = this.getEffectiveMaxApiSlots();

    // Check if slot available immediately
    if (this.activeApiSlots.size < effectiveMaxSlots) {
      const slot: ActiveSlot = {
        id: slotId,
        type: 'api',
        acquiredAt: Date.now(),
        trackCode,
      };
      this.activeApiSlots.set(slotId, slot);
      return { acquired: true, slotId, waitTime: 0 };
    }

    // Queue the request
    return this.queueRequest('api', slotId, trackCode, timeoutMs);
  }

  /**
   * Release an API call slot
   *
   * @param slotId - Slot ID to release
   * @param hadError - Whether the API call had an error
   */
  releaseApiSlot(slotId: string, hadError = false): void {
    const slot = this.activeApiSlots.get(slotId);
    if (!slot) {
      console.warn(`[ConcurrencyManager] Attempted to release unknown API slot: ${slotId}`);
      return;
    }

    this.activeApiSlots.delete(slotId);

    // Track errors for adaptive throttling
    if (hadError && this.config.adaptiveThrottling) {
      this.recordError();
    }

    this.processQueue('api');
  }

  // ============================================================================
  // PUBLIC API - STATUS & UTILITIES
  // ============================================================================

  /**
   * Get number of available track slots
   */
  getAvailableTrackSlots(): number {
    return this.config.maxConcurrentTracks - this.activeTrackSlots.size;
  }

  /**
   * Get number of available API slots
   */
  getAvailableApiSlots(): number {
    return this.getEffectiveMaxApiSlots() - this.activeApiSlots.size;
  }

  /**
   * Get current concurrency statistics
   */
  getStats(): ConcurrencyStats {
    return {
      activeTrackSlots: this.activeTrackSlots.size,
      maxTrackSlots: this.config.maxConcurrentTracks,
      activeApiSlots: this.activeApiSlots.size,
      maxApiSlots: this.getEffectiveMaxApiSlots(),
      trackQueueLength: this.trackQueue.length,
      apiQueueLength: this.apiQueue.length,
    };
  }

  /**
   * Check rate limit status without consuming a slot
   */
  getRateLimitStatus(): RateLimitResult {
    const rateLimiter = getRateLimiter();
    return rateLimiter.status('orchestrator-api', this.apiRateLimitConfig);
  }

  /**
   * Record an error for adaptive throttling
   */
  recordError(): void {
    if (!this.config.adaptiveThrottling) return;

    const now = Date.now();
    this.recentErrors.push(now);

    // Clean up old errors outside window
    this.recentErrors = this.recentErrors.filter((ts) => now - ts < this.errorWindowMs);

    // Update throttle multiplier
    if (this.recentErrors.length >= this.errorThreshold) {
      // Increase throttle (reduce max slots)
      this.throttleMultiplier = Math.max(0.5, this.throttleMultiplier - 0.1);
      console.warn(
        `[ConcurrencyManager] Error spike detected (${this.recentErrors.length} errors). Throttle multiplier: ${this.throttleMultiplier.toFixed(2)}`
      );
    } else if (this.recentErrors.length <= 1 && this.throttleMultiplier < 1.0) {
      // Gradually recover
      this.throttleMultiplier = Math.min(1.0, this.throttleMultiplier + 0.05);
    }
  }

  /**
   * Reset error tracking (e.g., after a successful batch)
   */
  resetErrorTracking(): void {
    this.recentErrors = [];
    this.throttleMultiplier = 1.0;
  }

  /**
   * Reset all state (for testing or recovery)
   */
  reset(): void {
    // Clear all active slots
    this.activeTrackSlots.clear();
    this.activeApiSlots.clear();

    // Reject all queued requests
    for (const request of this.trackQueue) {
      if (request.timeout) clearTimeout(request.timeout);
      request.reject(new Error('Concurrency manager reset'));
    }
    for (const request of this.apiQueue) {
      if (request.timeout) clearTimeout(request.timeout);
      request.reject(new Error('Concurrency manager reset'));
    }

    this.trackQueue = [];
    this.apiQueue = [];
    this.resetErrorTracking();
    this.slotCounter = 0;
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(
    config: Partial<
      Pick<
        OrchestratorConfig,
        | 'maxConcurrentTracks'
        | 'maxConcurrentApiCalls'
        | 'rateLimitPerMinute'
        | 'adaptiveThrottling'
      >
    >
  ): void {
    if (config.maxConcurrentTracks !== undefined) {
      this.config.maxConcurrentTracks = config.maxConcurrentTracks;
    }
    if (config.maxConcurrentApiCalls !== undefined) {
      this.config.maxConcurrentApiCalls = config.maxConcurrentApiCalls;
    }
    if (config.rateLimitPerMinute !== undefined) {
      this.config.rateLimitPerMinute = config.rateLimitPerMinute;
      // Update rate limit config
      this.apiRateLimitConfig.maxRequests = config.rateLimitPerMinute;
      this.apiRateLimitConfig.burstLimit = Math.min(10, Math.floor(config.rateLimitPerMinute / 10));
    }
    if (config.adaptiveThrottling !== undefined) {
      this.config.adaptiveThrottling = config.adaptiveThrottling;
    }

    // Process queues in case limits increased
    this.processQueue('track');
    this.processQueue('api');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generateSlotId(type: 'track' | 'api'): string {
    return `${type}-${++this.slotCounter}-${Date.now()}`;
  }

  private getEffectiveMaxApiSlots(): number {
    if (!this.config.adaptiveThrottling) {
      return this.config.maxConcurrentApiCalls;
    }
    return Math.max(1, Math.floor(this.config.maxConcurrentApiCalls * this.throttleMultiplier));
  }

  private queueRequest(
    type: 'track' | 'api',
    slotId: string,
    trackCode?: string,
    timeoutMs = 30000
  ): Promise<SlotAcquisitionResult> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: slotId,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Set timeout
      request.timeout = setTimeout(() => {
        // Remove from queue
        const queue = type === 'track' ? this.trackQueue : this.apiQueue;
        const index = queue.findIndex((r) => r.id === slotId);
        if (index !== -1) {
          queue.splice(index, 1);
        }
        resolve({
          acquired: false,
          reason: `Timeout waiting for ${type} slot after ${timeoutMs}ms`,
          waitTime: timeoutMs,
        });
      }, timeoutMs);

      // Add to appropriate queue
      if (type === 'track') {
        this.trackQueue.push(request);
      } else {
        this.apiQueue.push(request);
      }
    });
  }

  private processQueue(type: 'track' | 'api'): void {
    const queue = type === 'track' ? this.trackQueue : this.apiQueue;
    const activeSlots = type === 'track' ? this.activeTrackSlots : this.activeApiSlots;
    const maxSlots =
      type === 'track' ? this.config.maxConcurrentTracks : this.getEffectiveMaxApiSlots();

    while (queue.length > 0 && activeSlots.size < maxSlots) {
      const request = queue.shift();
      if (!request) break;

      // Clear timeout
      if (request.timeout) {
        clearTimeout(request.timeout);
      }

      // Create and register slot
      const slot: ActiveSlot = {
        id: request.id,
        type,
        acquiredAt: Date.now(),
      };
      activeSlots.set(request.id, slot);

      // Calculate wait time
      const waitTime = Date.now() - request.timestamp;

      // Resolve the promise
      request.resolve({
        acquired: true,
        slotId: request.id,
        waitTime,
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let concurrencyManagerInstance: ConcurrencyManager | null = null;

/**
 * Get the singleton concurrency manager instance
 */
export function getConcurrencyManager(): ConcurrencyManager {
  if (!concurrencyManagerInstance) {
    concurrencyManagerInstance = new ConcurrencyManager();
  }
  return concurrencyManagerInstance;
}

/**
 * Reset the concurrency manager instance (for testing)
 */
export function resetConcurrencyManager(): void {
  if (concurrencyManagerInstance) {
    concurrencyManagerInstance.reset();
    concurrencyManagerInstance = null;
  }
}

/**
 * Create a new concurrency manager with custom config (for testing)
 */
export function createConcurrencyManager(
  config?: Partial<
    Pick<
      OrchestratorConfig,
      'maxConcurrentTracks' | 'maxConcurrentApiCalls' | 'rateLimitPerMinute' | 'adaptiveThrottling'
    >
  >
): ConcurrencyManager {
  return new ConcurrencyManager(config);
}

export default getConcurrencyManager;
