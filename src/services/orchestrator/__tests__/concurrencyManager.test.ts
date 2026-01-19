/**
 * Concurrency Manager Tests
 *
 * Tests for slot acquisition, rate limiting, and adaptive throttling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConcurrencyManager,
  createConcurrencyManager,
  resetConcurrencyManager,
} from '../concurrencyManager';

// Mock the rate limiter
vi.mock('../../../lib/rateLimit', () => {
  const mockEntries = new Map();

  return {
    getRateLimiter: vi.fn(() => ({
      check: vi.fn((key: string, config: { maxRequests: number }) => {
        const entry = mockEntries.get(key) || { count: 0 };
        if (entry.count >= config.maxRequests) {
          return { allowed: false, remaining: 0, retryAfter: 1000 };
        }
        entry.count++;
        mockEntries.set(key, entry);
        return {
          allowed: true,
          remaining: config.maxRequests - entry.count,
          retryAfter: 0,
        };
      }),
      status: vi.fn((key: string, config: { maxRequests: number }) => {
        const entry = mockEntries.get(key) || { count: 0 };
        return {
          allowed: entry.count < config.maxRequests,
          remaining: Math.max(0, config.maxRequests - entry.count),
          retryAfter: 0,
        };
      }),
      reset: vi.fn((key: string) => {
        mockEntries.delete(key);
      }),
    })),
    resetRateLimiter: vi.fn(() => {
      mockEntries.clear();
    }),
  };
});

describe('ConcurrencyManager', () => {
  let manager: ConcurrencyManager;

  beforeEach(() => {
    resetConcurrencyManager();
    manager = createConcurrencyManager({
      maxConcurrentTracks: 2,
      maxConcurrentApiCalls: 4,
      rateLimitPerMinute: 100,
      adaptiveThrottling: true,
    });
  });

  afterEach(() => {
    manager.reset();
    vi.clearAllMocks();
  });

  describe('Track Slot Management', () => {
    it('should acquire track slot when under limit', async () => {
      const result = await manager.acquireTrackSlot('SAR');

      expect(result.acquired).toBe(true);
      expect(result.slotId).toBeDefined();
      expect(result.waitTime).toBe(0);
    });

    it('should report correct available slots', async () => {
      expect(manager.getAvailableTrackSlots()).toBe(2);

      const result1 = await manager.acquireTrackSlot('SAR');
      expect(manager.getAvailableTrackSlots()).toBe(1);

      const result2 = await manager.acquireTrackSlot('CD');
      expect(manager.getAvailableTrackSlots()).toBe(0);

      manager.releaseTrackSlot(result1.slotId!);
      expect(manager.getAvailableTrackSlots()).toBe(1);

      manager.releaseTrackSlot(result2.slotId!);
      expect(manager.getAvailableTrackSlots()).toBe(2);
    });

    it('should queue requests when at limit', async () => {
      // Acquire 2 slots (at limit)
      const slot1 = await manager.acquireTrackSlot('SAR');
      const slot2 = await manager.acquireTrackSlot('CD');

      expect(slot1.acquired).toBe(true);
      expect(slot2.acquired).toBe(true);

      // Third request should wait and timeout
      const slot3Promise = manager.acquireTrackSlot('GP', 100); // 100ms timeout

      // Release a slot after a delay
      setTimeout(() => {
        manager.releaseTrackSlot(slot1.slotId!);
      }, 50);

      const slot3 = await slot3Promise;

      // Should have acquired after waiting
      expect(slot3.acquired).toBe(true);
      expect(slot3.waitTime).toBeGreaterThan(0);
    });

    it('should timeout when waiting too long', async () => {
      // Acquire 2 slots (at limit)
      await manager.acquireTrackSlot('SAR');
      await manager.acquireTrackSlot('CD');

      // Third request should timeout
      const result = await manager.acquireTrackSlot('GP', 50); // 50ms timeout

      expect(result.acquired).toBe(false);
      expect(result.reason).toContain('Timeout');
    });
  });

  describe('API Slot Management', () => {
    it('should acquire API slot when under limit', async () => {
      const result = await manager.acquireApiSlot('SAR');

      expect(result.acquired).toBe(true);
      expect(result.slotId).toBeDefined();
    });

    it('should respect API slot limit', async () => {
      // Acquire 4 API slots (at limit)
      const slots = await Promise.all([
        manager.acquireApiSlot('SAR'),
        manager.acquireApiSlot('SAR'),
        manager.acquireApiSlot('SAR'),
        manager.acquireApiSlot('SAR'),
      ]);

      slots.forEach((slot) => {
        expect(slot.acquired).toBe(true);
      });

      expect(manager.getAvailableApiSlots()).toBe(0);
    });

    it('should release API slot and allow new acquisition', async () => {
      // Fill all slots
      const slots = await Promise.all([
        manager.acquireApiSlot(),
        manager.acquireApiSlot(),
        manager.acquireApiSlot(),
        manager.acquireApiSlot(),
      ]);

      expect(manager.getAvailableApiSlots()).toBe(0);

      // Release one
      manager.releaseApiSlot(slots[0]!.slotId!);

      expect(manager.getAvailableApiSlots()).toBe(1);

      // Should be able to acquire again
      const newSlot = await manager.acquireApiSlot();
      expect(newSlot.acquired).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should report correct stats', async () => {
      await manager.acquireTrackSlot('SAR');
      await manager.acquireApiSlot();
      await manager.acquireApiSlot();

      const stats = manager.getStats();

      expect(stats.activeTrackSlots).toBe(1);
      expect(stats.maxTrackSlots).toBe(2);
      expect(stats.activeApiSlots).toBe(2);
      expect(stats.maxApiSlots).toBe(4);
      expect(stats.trackQueueLength).toBe(0);
      expect(stats.apiQueueLength).toBe(0);
    });
  });

  describe('Adaptive Throttling', () => {
    it('should reduce max slots after errors', async () => {
      // Initial state - just verify we can get available slots
      expect(manager.getAvailableApiSlots()).toBeGreaterThan(0);

      // Record multiple errors
      for (let i = 0; i < 10; i++) {
        manager.recordError();
      }

      // Max slots should be reduced
      const newMaxSlots = manager.getStats().maxApiSlots;
      expect(newMaxSlots).toBeLessThan(4);
    });

    it('should reset error tracking', async () => {
      // Record errors
      for (let i = 0; i < 5; i++) {
        manager.recordError();
      }

      // Reset
      manager.resetErrorTracking();

      // Should be back to normal
      const stats = manager.getStats();
      expect(stats.maxApiSlots).toBe(4);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration at runtime', async () => {
      expect(manager.getStats().maxTrackSlots).toBe(2);

      manager.updateConfig({
        maxConcurrentTracks: 3,
      });

      expect(manager.getStats().maxTrackSlots).toBe(3);
    });
  });

  describe('Reset', () => {
    it('should clear all state on reset', async () => {
      await manager.acquireTrackSlot('SAR');
      await manager.acquireApiSlot();

      manager.reset();

      const stats = manager.getStats();
      expect(stats.activeTrackSlots).toBe(0);
      expect(stats.activeApiSlots).toBe(0);
    });
  });
});

describe('Slot Release Behavior', () => {
  let manager: ConcurrencyManager;

  beforeEach(() => {
    resetConcurrencyManager();
    manager = createConcurrencyManager({
      maxConcurrentTracks: 2,
      maxConcurrentApiCalls: 3,
    });
  });

  afterEach(() => {
    manager.reset();
  });

  it('should allow waiting request to acquire after release', async () => {
    // Fill all track slots
    const slot1 = await manager.acquireTrackSlot('SAR');
    const slot2 = await manager.acquireTrackSlot('CD');

    // Start waiting for a third slot
    const waitingPromise = manager.acquireTrackSlot('GP', 1000);

    // Release one slot after a delay
    await new Promise((resolve) => setTimeout(resolve, 50));
    manager.releaseTrackSlot(slot1.slotId!);

    // Waiting request should complete
    const result = await waitingPromise;
    expect(result.acquired).toBe(true);
    expect(result.waitTime).toBeGreaterThan(0);

    // Clean up
    manager.releaseTrackSlot(slot2.slotId!);
    manager.releaseTrackSlot(result.slotId!);
  });

  it('should process queue in FIFO order', async () => {
    // Fill all API slots
    const initialSlots = await Promise.all([
      manager.acquireApiSlot(),
      manager.acquireApiSlot(),
      manager.acquireApiSlot(),
    ]);

    // Queue multiple requests
    const completionOrder: number[] = [];

    const waiting1 = manager.acquireApiSlot(undefined, 2000).then((r) => {
      completionOrder.push(1);
      return r;
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const waiting2 = manager.acquireApiSlot(undefined, 2000).then((r) => {
      completionOrder.push(2);
      return r;
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const waiting3 = manager.acquireApiSlot(undefined, 2000).then((r) => {
      completionOrder.push(3);
      return r;
    });

    // Release slots one by one
    await new Promise((resolve) => setTimeout(resolve, 50));
    manager.releaseApiSlot(initialSlots[0]!.slotId!);

    await new Promise((resolve) => setTimeout(resolve, 50));
    manager.releaseApiSlot(initialSlots[1]!.slotId!);

    await new Promise((resolve) => setTimeout(resolve, 50));
    manager.releaseApiSlot(initialSlots[2]!.slotId!);

    // Wait for all to complete
    const results = await Promise.all([waiting1, waiting2, waiting3]);

    // All should be acquired
    results.forEach((r) => {
      expect(r.acquired).toBe(true);
    });

    // FIFO order should be preserved
    expect(completionOrder).toEqual([1, 2, 3]);
  });
});

describe('Rate Limit Integration', () => {
  let manager: ConcurrencyManager;

  beforeEach(() => {
    resetConcurrencyManager();
    manager = createConcurrencyManager({
      maxConcurrentTracks: 2,
      maxConcurrentApiCalls: 4,
      rateLimitPerMinute: 10, // Low limit for testing
    });
  });

  afterEach(() => {
    manager.reset();
  });

  it('should check rate limit status', () => {
    const status = manager.getRateLimitStatus();

    expect(status).toMatchObject({
      allowed: expect.any(Boolean),
      remaining: expect.any(Number),
    });
  });
});
