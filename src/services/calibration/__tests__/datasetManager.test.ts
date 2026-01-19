/**
 * Dataset Manager Tests
 *
 * Tests for the calibration dataset manager.
 * Tests probability buckets, calibration readiness, and statistics.
 */

import { describe, it, expect } from 'vitest';
import type { HistoricalRace, HistoricalEntry } from '../schema';
import { generateRaceId } from '../schema';
import { CALIBRATION_THRESHOLD, MINIMUM_CALIBRATION_RACES } from '../datasetManager';
import {
  createDefaultBucketBoundaries,
  getBucketIndex,
  calculateStandardError,
  calculateConfidenceInterval,
  isCalibrationReliable,
} from '../types';

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

function createMockEntry(overrides: Partial<HistoricalEntry> = {}): HistoricalEntry {
  return {
    programNumber: 1,
    finishPosition: 1,
    predictedProbability: 0.25,
    impliedProbability: 0.2,
    finalOdds: 4.0,
    baseScore: 250,
    finalScore: 280,
    tier: 1,
    wasWinner: true,
    wasPlace: true,
    wasShow: true,
    ...overrides,
  };
}

function createMockRace(id: string, entries: HistoricalEntry[] = []): HistoricalRace {
  return {
    id,
    trackCode: 'SAR',
    raceDate: '2024-08-15',
    raceNumber: parseInt(id.split('-R')[1] ?? '1'),
    distance: 6.0,
    surface: 'D',
    fieldSize: entries.length || 8,
    entries:
      entries.length > 0
        ? entries
        : [
            createMockEntry({ programNumber: 1, wasWinner: true }),
            createMockEntry({ programNumber: 2, wasWinner: false }),
          ],
    recordedAt: new Date(),
    source: 'bot_result',
    confidence: 'HIGH',
    status: 'complete',
  };
}

// Create multiple mock races for testing
function createMockRaces(count: number): HistoricalRace[] {
  return Array.from({ length: count }, (_, i) => {
    const raceId = generateRaceId('SAR', '2024-08-15', i + 1);
    return createMockRace(raceId);
  });
}

// ============================================================================
// CALIBRATION THRESHOLD TESTS
// ============================================================================

describe('Calibration Threshold', () => {
  describe('Constants', () => {
    it('should have CALIBRATION_THRESHOLD set to 500', () => {
      expect(CALIBRATION_THRESHOLD).toBe(500);
    });

    it('should have MINIMUM_CALIBRATION_RACES set to 100', () => {
      expect(MINIMUM_CALIBRATION_RACES).toBe(100);
    });
  });

  describe('isCalibrationReady behavior', () => {
    it('Scenario: Returns false under 500 races', () => {
      // This documents expected behavior
      // With 499 races, isCalibrationReady() should return false
      const races = createMockRaces(499);
      const isReady = races.length >= CALIBRATION_THRESHOLD;
      expect(isReady).toBe(false);
    });

    it('Scenario: Returns true at 500+ races', () => {
      // With exactly 500 races, isCalibrationReady() should return true
      const races = createMockRaces(500);
      const isReady = races.length >= CALIBRATION_THRESHOLD;
      expect(isReady).toBe(true);
    });

    it('Scenario: Returns true above 500 races', () => {
      const races = createMockRaces(750);
      const isReady = races.length >= CALIBRATION_THRESHOLD;
      expect(isReady).toBe(true);
    });
  });
});

// ============================================================================
// PROBABILITY BUCKET TESTS
// ============================================================================

describe('Probability Buckets', () => {
  describe('createDefaultBucketBoundaries', () => {
    it('should create 10 equal-width buckets', () => {
      const boundaries = createDefaultBucketBoundaries();

      expect(boundaries.length).toBe(11); // 11 boundaries = 10 buckets
      expect(boundaries[0]).toBe(0);
      expect(boundaries[10]).toBe(1);
      expect(boundaries[5]).toBeCloseTo(0.5);
    });
  });

  describe('getBucketIndex', () => {
    it('should return correct bucket index for various probabilities', () => {
      const boundaries = createDefaultBucketBoundaries();

      // 0.05 should be in bucket 0 (0.0-0.1)
      expect(getBucketIndex(0.05, boundaries)).toBe(0);

      // 0.15 should be in bucket 1 (0.1-0.2)
      expect(getBucketIndex(0.15, boundaries)).toBe(1);

      // 0.5 should be in bucket 5 (0.5-0.6)
      expect(getBucketIndex(0.5, boundaries)).toBe(5);

      // 0.95 should be in bucket 9 (0.9-1.0)
      expect(getBucketIndex(0.95, boundaries)).toBe(9);

      // 1.0 (edge case) should be in the last bucket
      expect(getBucketIndex(1.0, boundaries)).toBe(9);
    });

    it('should handle boundary values correctly', () => {
      const boundaries = createDefaultBucketBoundaries();

      // At 0.1 boundary, should be in bucket 1
      expect(getBucketIndex(0.1, boundaries)).toBe(1);

      // At 0.2 boundary, should be in bucket 2
      expect(getBucketIndex(0.2, boundaries)).toBe(2);
    });
  });

  describe('Bucket grouping behavior', () => {
    it('Scenario: Probability buckets group entries correctly', () => {
      // Create entries with various probabilities
      const entries: HistoricalEntry[] = [
        createMockEntry({ predictedProbability: 0.05 }), // Bucket 0
        createMockEntry({ predictedProbability: 0.15 }), // Bucket 1
        createMockEntry({ predictedProbability: 0.15 }), // Bucket 1
        createMockEntry({ predictedProbability: 0.25 }), // Bucket 2
        createMockEntry({ predictedProbability: 0.35 }), // Bucket 3
        createMockEntry({ predictedProbability: 0.55 }), // Bucket 5
        createMockEntry({ predictedProbability: 0.75 }), // Bucket 7
        createMockEntry({ predictedProbability: 0.95 }), // Bucket 9
      ];

      const boundaries = createDefaultBucketBoundaries();
      const buckets = new Map<number, HistoricalEntry[]>();

      // Initialize buckets
      for (let i = 0; i < 10; i++) {
        buckets.set(i, []);
      }

      // Group entries
      for (const entry of entries) {
        const index = getBucketIndex(entry.predictedProbability, boundaries);
        buckets.get(index)?.push(entry);
      }

      // Verify grouping
      expect(buckets.get(0)?.length).toBe(1); // 1 entry at 0.05
      expect(buckets.get(1)?.length).toBe(2); // 2 entries at 0.15
      expect(buckets.get(2)?.length).toBe(1); // 1 entry at 0.25
      expect(buckets.get(3)?.length).toBe(1); // 1 entry at 0.35
      expect(buckets.get(4)?.length).toBe(0); // No entries in 0.4-0.5
      expect(buckets.get(5)?.length).toBe(1); // 1 entry at 0.55
    });
  });
});

// ============================================================================
// STATISTICAL HELPER TESTS
// ============================================================================

describe('Statistical Helpers', () => {
  describe('calculateStandardError', () => {
    it('should calculate correct standard error', () => {
      // SE = sqrt(p * (1-p) / n)
      // For p=0.5, n=100: SE = sqrt(0.5 * 0.5 / 100) = sqrt(0.0025) = 0.05
      expect(calculateStandardError(0.5, 100)).toBeCloseTo(0.05, 3);

      // For p=0.2, n=100: SE = sqrt(0.2 * 0.8 / 100) = sqrt(0.0016) = 0.04
      expect(calculateStandardError(0.2, 100)).toBeCloseTo(0.04, 3);
    });

    it('should return 0 for sample size <= 1', () => {
      expect(calculateStandardError(0.5, 1)).toBe(0);
      expect(calculateStandardError(0.5, 0)).toBe(0);
    });
  });

  describe('calculateConfidenceInterval', () => {
    it('should calculate 95% confidence interval', () => {
      // For p=0.5, n=100, SE=0.05
      // 95% CI = 0.5 ± 1.96 * 0.05 = [0.402, 0.598]
      const [lower, upper] = calculateConfidenceInterval(0.5, 100);

      expect(lower).toBeCloseTo(0.402, 2);
      expect(upper).toBeCloseTo(0.598, 2);
    });

    it('should bound confidence interval to [0, 1]', () => {
      // Very low probability with small sample
      const [lower1, _upper1] = calculateConfidenceInterval(0.02, 20);
      expect(lower1).toBeGreaterThanOrEqual(0);

      // Very high probability with small sample
      const [_lower2, upper2] = calculateConfidenceInterval(0.98, 20);
      expect(upper2).toBeLessThanOrEqual(1);
    });
  });

  describe('isCalibrationReliable', () => {
    it('should return false for insufficient samples', () => {
      expect(isCalibrationReliable(100, 8, 500, 5)).toBe(false); // Below 500 threshold
    });

    it('should return false for insufficient bucket coverage', () => {
      expect(isCalibrationReliable(600, 3, 500, 5)).toBe(false); // Only 3 buckets with samples
    });

    it('should return true when both conditions met', () => {
      expect(isCalibrationReliable(600, 6, 500, 5)).toBe(true);
    });
  });
});

// ============================================================================
// WIN RATE CALCULATION TESTS
// ============================================================================

describe('Win Rate Calculations', () => {
  it('should calculate correct win rates per bucket', () => {
    // Create entries with known outcomes
    const entries: HistoricalEntry[] = [
      // Bucket 0.2-0.3: 2 entries, 1 winner = 50% win rate
      createMockEntry({ predictedProbability: 0.25, wasWinner: true }),
      createMockEntry({ predictedProbability: 0.25, wasWinner: false }),
      // Bucket 0.3-0.4: 4 entries, 1 winner = 25% win rate
      createMockEntry({ predictedProbability: 0.35, wasWinner: true }),
      createMockEntry({ predictedProbability: 0.35, wasWinner: false }),
      createMockEntry({ predictedProbability: 0.35, wasWinner: false }),
      createMockEntry({ predictedProbability: 0.35, wasWinner: false }),
    ];

    // Bucket 0.2-0.3
    const bucket2Entries = entries.filter(
      (e) => e.predictedProbability >= 0.2 && e.predictedProbability < 0.3
    );
    const bucket2WinRate = bucket2Entries.filter((e) => e.wasWinner).length / bucket2Entries.length;
    expect(bucket2WinRate).toBe(0.5);

    // Bucket 0.3-0.4
    const bucket3Entries = entries.filter(
      (e) => e.predictedProbability >= 0.3 && e.predictedProbability < 0.4
    );
    const bucket3WinRate = bucket3Entries.filter((e) => e.wasWinner).length / bucket3Entries.length;
    expect(bucket3WinRate).toBe(0.25);
  });
});

// ============================================================================
// TIER STATISTICS TESTS
// ============================================================================

describe('Tier Statistics', () => {
  it('should calculate ROI correctly', () => {
    // Create tier 1 entries with known outcomes
    const entries: HistoricalEntry[] = [
      createMockEntry({ tier: 1, wasWinner: true, finalOdds: 3.0 }), // Win: returns 4.0 ($1 bet + $3 win)
      createMockEntry({ tier: 1, wasWinner: false, finalOdds: 2.5 }), // Loss
      createMockEntry({ tier: 1, wasWinner: true, finalOdds: 4.0 }), // Win: returns 5.0
      createMockEntry({ tier: 1, wasWinner: false, finalOdds: 3.0 }), // Loss
    ];

    // Total bet: $4
    // Total returned: 4.0 + 0 + 5.0 + 0 = 9.0
    // ROI = (9.0 - 4.0) / 4.0 = 1.25 = 125%

    const totalBet = entries.length;
    const totalReturned = entries
      .filter((e) => e.wasWinner)
      .reduce((sum, e) => sum + (e.finalOdds + 1), 0);
    const roi = ((totalReturned - totalBet) / totalBet) * 100;

    expect(roi).toBe(125);
  });

  it('should calculate tier win rates', () => {
    const entries: HistoricalEntry[] = [
      // Tier 1: 2 wins out of 4 = 50%
      createMockEntry({ tier: 1, wasWinner: true }),
      createMockEntry({ tier: 1, wasWinner: true }),
      createMockEntry({ tier: 1, wasWinner: false }),
      createMockEntry({ tier: 1, wasWinner: false }),
      // Tier 2: 1 win out of 4 = 25%
      createMockEntry({ tier: 2, wasWinner: true }),
      createMockEntry({ tier: 2, wasWinner: false }),
      createMockEntry({ tier: 2, wasWinner: false }),
      createMockEntry({ tier: 2, wasWinner: false }),
    ];

    const tier1 = entries.filter((e) => e.tier === 1);
    const tier1WinRate = tier1.filter((e) => e.wasWinner).length / tier1.length;
    expect(tier1WinRate).toBe(0.5);

    const tier2 = entries.filter((e) => e.tier === 2);
    const tier2WinRate = tier2.filter((e) => e.wasWinner).length / tier2.length;
    expect(tier2WinRate).toBe(0.25);
  });
});

// ============================================================================
// INTEGRATION SCENARIOS (documentation)
// ============================================================================

describe('Dataset Manager Integration Scenarios', () => {
  it('Scenario: Threshold detection at exactly 499 races', () => {
    const count = 499;
    const isReady = count >= CALIBRATION_THRESHOLD;
    const racesNeeded = Math.max(0, CALIBRATION_THRESHOLD - count);

    expect(isReady).toBe(false);
    expect(racesNeeded).toBe(1);
  });

  it('Scenario: Threshold detection at exactly 500 races', () => {
    const count = 500;
    const isReady = count >= CALIBRATION_THRESHOLD;
    const racesNeeded = Math.max(0, CALIBRATION_THRESHOLD - count);

    expect(isReady).toBe(true);
    expect(racesNeeded).toBe(0);
  });

  it('Scenario: Minimum data threshold at 100 races', () => {
    const count = 100;
    const hasMinimum = count >= MINIMUM_CALIBRATION_RACES;

    expect(hasMinimum).toBe(true);
  });

  it('Scenario: Date range calculation from races', () => {
    const races = [
      createMockRace('SAR-2024-06-01-R1'),
      createMockRace('SAR-2024-07-15-R2'),
      createMockRace('SAR-2024-08-30-R3'),
    ].map((r, i) => ({
      ...r,
      raceDate: ['2024-06-01', '2024-07-15', '2024-08-30'][i] ?? '2024-06-01',
    }));

    const dates = races.map((r) => r.raceDate).sort();
    const earliest = dates[0];
    const latest = dates[dates.length - 1];

    expect(earliest).toBe('2024-06-01');
    expect(latest).toBe('2024-08-30');
  });
});
