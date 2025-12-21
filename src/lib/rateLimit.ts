/**
 * Client-Side Rate Limiting Utility
 *
 * Prevents accidental API spam and provides a smooth user experience
 * by throttling actions on the client side before they reach the server.
 *
 * Features:
 * - Configurable limits per action type
 * - Sliding window rate limiting
 * - Token bucket algorithm for burst handling
 * - Automatic cleanup of expired entries
 *
 * Note: This is CLIENT-SIDE rate limiting for UX improvement.
 * Server-side rate limiting should ALWAYS be implemented for security.
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Configuration for a rate limit
 */
export interface RateLimitConfig {
  /** Maximum number of actions allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional: Allow burst of extra requests */
  burstLimit?: number;
  /** Optional: Message to show when rate limited */
  message?: string;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Number of remaining requests in current window */
  remaining: number;
  /** When the current window resets (timestamp) */
  resetsAt: number;
  /** Time until next allowed request (ms), 0 if allowed */
  retryAfter: number;
  /** User-friendly message if rate limited */
  message?: string;
}

/**
 * Internal tracking for rate limit windows
 */
interface RateLimitEntry {
  /** Timestamps of recent requests */
  timestamps: number[];
  /** Token bucket tokens available */
  tokens: number;
  /** Last token refill time */
  lastRefill: number;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Pre-configured rate limits for common actions
 */
export const RateLimitPresets = {
  /** File uploads: 10 per minute */
  FILE_UPLOAD: {
    maxRequests: 10,
    windowMs: 60 * 1000,
    burstLimit: 3,
    message: 'Too many file uploads. Please wait a moment.',
  },

  /** API calls: 60 per minute */
  API_CALL: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    burstLimit: 10,
    message: 'Too many requests. Please slow down.',
  },

  /** Form submissions: 5 per minute */
  FORM_SUBMIT: {
    maxRequests: 5,
    windowMs: 60 * 1000,
    message: 'Please wait before submitting again.',
  },

  /** Auth attempts: 5 per 15 minutes */
  AUTH_ATTEMPT: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Too many login attempts. Please try again later.',
  },

  /** Calculations: 30 per minute */
  CALCULATION: {
    maxRequests: 30,
    windowMs: 60 * 1000,
    burstLimit: 5,
    message: 'Processing too many calculations. Please wait.',
  },

  /** Export/download: 10 per 5 minutes */
  EXPORT: {
    maxRequests: 10,
    windowMs: 5 * 60 * 1000,
    message: 'Export limit reached. Please wait before exporting again.',
  },
} as const satisfies Record<string, RateLimitConfig>;

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

/**
 * Client-side rate limiter using sliding window + token bucket
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter()
 *
 * // Check before making API call
 * const result = limiter.check('api-call', RateLimitPresets.API_CALL)
 * if (result.allowed) {
 *   await makeApiCall()
 * } else {
 *   showError(result.message)
 * }
 * ```
 */
export class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start periodic cleanup every 5 minutes
    this.startCleanup();
  }

  /**
   * Check if an action is allowed under rate limiting
   *
   * @param key - Unique identifier for this action type
   * @param config - Rate limit configuration
   * @returns Rate limit result with allow/deny decision
   */
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const entry = this.getOrCreateEntry(key, config);

    // Clean up old timestamps outside the window
    const windowStart = now - config.windowMs;
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    // Refill tokens based on time passed
    if (config.burstLimit) {
      this.refillTokens(entry, config, now);
    }

    // Check if under the limit
    const currentCount = entry.timestamps.length;
    const hasTokens = !config.burstLimit || entry.tokens > 0;
    const underLimit = currentCount < config.maxRequests;

    if (underLimit && hasTokens) {
      // Action allowed - record timestamp
      entry.timestamps.push(now);
      if (config.burstLimit && entry.tokens > 0) {
        entry.tokens--;
      }

      const oldestTimestamp = entry.timestamps[0] ?? now;
      return {
        allowed: true,
        remaining: config.maxRequests - entry.timestamps.length,
        resetsAt: oldestTimestamp + config.windowMs,
        retryAfter: 0,
      };
    }

    // Rate limited
    const oldestTimestamp = entry.timestamps[0] || now;
    const resetsAt = oldestTimestamp + config.windowMs;
    const retryAfter = Math.max(0, resetsAt - now);

    return {
      allowed: false,
      remaining: 0,
      resetsAt,
      retryAfter,
      message: config.message || 'Rate limit exceeded. Please try again later.',
    };
  }

  /**
   * Consume a rate limit slot without checking
   * Use when you know the action will proceed
   */
  consume(key: string, config: RateLimitConfig): void {
    const entry = this.getOrCreateEntry(key, config);
    entry.timestamps.push(Date.now());
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.entries.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.entries.clear();
  }

  /**
   * Get current status without consuming a slot
   */
  status(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const entry = this.entries.get(key);

    if (!entry) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetsAt: now + config.windowMs,
        retryAfter: 0,
      };
    }

    // Clean up old timestamps
    const windowStart = now - config.windowMs;
    const activeTimestamps = entry.timestamps.filter((ts) => ts > windowStart);
    const remaining = Math.max(0, config.maxRequests - activeTimestamps.length);
    const resetsAt = activeTimestamps[0]
      ? activeTimestamps[0] + config.windowMs
      : now + config.windowMs;

    return {
      allowed: remaining > 0,
      remaining,
      resetsAt,
      retryAfter: remaining > 0 ? 0 : Math.max(0, resetsAt - now),
      message: remaining > 0 ? undefined : config.message,
    };
  }

  /**
   * Get or create a rate limit entry
   */
  private getOrCreateEntry(key: string, config: RateLimitConfig): RateLimitEntry {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        timestamps: [],
        tokens: config.burstLimit || 0,
        lastRefill: Date.now(),
      };
      this.entries.set(key, entry);
    }
    return entry;
  }

  /**
   * Refill tokens based on time passed (token bucket algorithm)
   */
  private refillTokens(entry: RateLimitEntry, config: RateLimitConfig, now: number): void {
    if (!config.burstLimit) return;

    const timePassed = now - entry.lastRefill;
    const refillRate = config.windowMs / config.maxRequests;
    const tokensToAdd = Math.floor(timePassed / refillRate);

    if (tokensToAdd > 0) {
      entry.tokens = Math.min(config.burstLimit, entry.tokens + tokensToAdd);
      entry.lastRefill = now;
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    // Max window we support is 1 hour, clean up anything older
    const maxAge = 60 * 60 * 1000;

    for (const [key, entry] of this.entries) {
      // Remove entries where all timestamps are expired
      const recentTimestamps = entry.timestamps.filter((ts) => now - ts < maxAge);
      if (recentTimestamps.length === 0) {
        this.entries.delete(key);
      } else {
        entry.timestamps = recentTimestamps;
      }
    }
  }

  /**
   * Stop the cleanup interval (for cleanup when limiter is no longer needed)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.entries.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let rateLimiterInstance: RateLimiter | null = null;

/**
 * Get the singleton rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
}

/**
 * Reset the rate limiter instance (for testing)
 */
export function resetRateLimiter(): void {
  if (rateLimiterInstance) {
    rateLimiterInstance.destroy();
    rateLimiterInstance = null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Check if an action is rate limited
 *
 * @example
 * ```typescript
 * import { checkRateLimit, RateLimitPresets } from '@/lib/rateLimit'
 *
 * async function uploadFile(file: File) {
 *   const result = checkRateLimit('file-upload', RateLimitPresets.FILE_UPLOAD)
 *
 *   if (!result.allowed) {
 *     throw new Error(result.message)
 *   }
 *
 *   // Proceed with upload
 *   await performUpload(file)
 * }
 * ```
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  return getRateLimiter().check(key, config);
}

/**
 * Decorator-style rate limiting for async functions
 *
 * @example
 * ```typescript
 * const rateLimitedUpload = withRateLimit(
 *   uploadFile,
 *   'file-upload',
 *   RateLimitPresets.FILE_UPLOAD
 * )
 *
 * try {
 *   await rateLimitedUpload(file)
 * } catch (error) {
 *   if (error instanceof RateLimitError) {
 *     showRetryMessage(error.retryAfter)
 *   }
 * }
 * ```
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  key: string,
  config: RateLimitConfig
): T {
  return (async (...args: Parameters<T>) => {
    const result = checkRateLimit(key, config);

    if (!result.allowed) {
      const error = new RateLimitError(result.message || 'Rate limit exceeded', result.retryAfter);
      throw error;
    }

    return fn(...args);
  }) as T;
}

/**
 * Custom error class for rate limiting
 */
export class RateLimitError extends Error {
  retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// ============================================================================
// REACT HOOK (if using React)
// ============================================================================

/**
 * Hook for rate limiting in React components
 *
 * @example
 * ```tsx
 * function UploadButton() {
 *   const { check, remaining, isLimited } = useRateLimit('upload', RateLimitPresets.FILE_UPLOAD)
 *
 *   const handleClick = () => {
 *     if (check()) {
 *       performUpload()
 *     }
 *   }
 *
 *   return (
 *     <button onClick={handleClick} disabled={isLimited}>
 *       Upload ({remaining} remaining)
 *     </button>
 *   )
 * }
 * ```
 */
export function useRateLimitStatus(key: string, config: RateLimitConfig) {
  const limiter = getRateLimiter();

  return {
    /**
     * Check and consume a rate limit slot
     * Returns true if allowed
     */
    check: (): boolean => {
      const result = limiter.check(key, config);
      return result.allowed;
    },

    /**
     * Get current status without consuming
     */
    status: () => limiter.status(key, config),

    /**
     * Reset the rate limit
     */
    reset: () => limiter.reset(key),
  };
}

export default getRateLimiter;
