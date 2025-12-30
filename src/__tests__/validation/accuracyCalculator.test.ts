/**
 * Accuracy Calculator Tests
 *
 * Tests for calculating backtesting accuracy metrics.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeRace,
  calculateAccuracy,
  calculateAccuracyFromAnalyses,
  formatAccuracyReport,
  compareAccuracy,
  type RaceAnalysis,
} from '../../lib/backtesting/accuracyCalculator';
import type { MatchedResult, AccuracyMetrics } from '../../types/chart';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a mock MatchedResult for testing
 */
function createMockMatch(
  horseName: string,
  predictionRank: number,
  predictionTier: number | null,
  actualFinishPosition: number,
  options: Partial<MatchedResult> = {}
): MatchedResult {
  return {
    horseName,
    predictionRank,
    predictionTier,
    predictionScore: predictionTier === 1 ? 190 : predictionTier === 2 ? 170 : 145,
    actualFinishPosition,
    wasScratch: false,
    actualOdds: 5.0,
    winPayoff: actualFinishPosition === 1 ? 12.0 : null,
    placePayoff: actualFinishPosition <= 2 ? 5.0 : null,
    showPayoff: actualFinishPosition <= 3 ? 3.0 : null,
    matchConfidence: 1.0,
    ...options,
  };
}

/**
 * Create a race analysis for testing
 */
function createMockRaceAnalysis(overrides: Partial<RaceAnalysis> = {}): RaceAnalysis {
  return {
    raceId: 'race_1',
    matchedCount: 8,
    tier1: {
      count: 1,
      won: false,
      hitTop3: true,
      winPayoff: null,
      placePayoff: 4.5,
    },
    tier2: {
      count: 2,
      anyWon: false,
      winningPayoff: null,
    },
    exacta: {
      attempted: true,
      hit: false,
    },
    ...overrides,
  };
}

// ============================================================================
// ANALYZE RACE TESTS
// ============================================================================

describe('Accuracy Calculator - analyzeRace', () => {
  it('should detect Tier 1 win', () => {
    const matches: MatchedResult[] = [
      createMockMatch('Winner', 1, 1, 1), // Tier 1, rank 1, finished 1st
      createMockMatch('Second', 2, 1, 2), // Tier 1, rank 2, finished 2nd
      createMockMatch('Third', 3, 2, 3), // Tier 2, rank 3, finished 3rd
    ];

    const analysis = analyzeRace(matches, 'test_race');

    expect(analysis.tier1.won).toBe(true);
    expect(analysis.tier1.hitTop3).toBe(true);
  });

  it('should detect Tier 1 top-3 finish without win', () => {
    const matches: MatchedResult[] = [
      createMockMatch('TopPick', 1, 1, 2), // Tier 1, rank 1, finished 2nd
      createMockMatch('Winner', 2, 2, 1), // Tier 2, rank 2, finished 1st
    ];

    const analysis = analyzeRace(matches, 'test_race');

    expect(analysis.tier1.won).toBe(false);
    expect(analysis.tier1.hitTop3).toBe(true);
  });

  it('should detect Tier 2 win', () => {
    const matches: MatchedResult[] = [
      createMockMatch('TopPick', 1, 1, 4), // Tier 1, finished 4th
      createMockMatch('Tier2Winner', 2, 2, 1), // Tier 2, finished 1st
    ];

    const analysis = analyzeRace(matches, 'test_race');

    expect(analysis.tier1.won).toBe(false);
    expect(analysis.tier2.anyWon).toBe(true);
  });

  it('should detect exacta hit', () => {
    const matches: MatchedResult[] = [
      createMockMatch('TopPick', 1, 1, 2), // rank 1, finished 2nd
      createMockMatch('SecondPick', 2, 1, 1), // rank 2, finished 1st
      createMockMatch('ThirdPick', 3, 2, 3), // rank 3, finished 3rd
    ];

    const analysis = analyzeRace(matches, 'test_race');

    expect(analysis.exacta.attempted).toBe(true);
    expect(analysis.exacta.hit).toBe(true);
  });

  it('should not count scratched horses', () => {
    const matches: MatchedResult[] = [
      createMockMatch('Scratched', 1, 1, 99, { wasScratch: true }),
      createMockMatch('Active', 2, 1, 1),
    ];

    const analysis = analyzeRace(matches, 'test_race');

    // The scratched horse should not count as the top prediction
    expect(analysis.matchedCount).toBe(1); // Only active horse counted
  });
});

// ============================================================================
// CALCULATE ACCURACY TESTS
// ============================================================================

describe('Accuracy Calculator - calculateAccuracy', () => {
  it('should calculate correct win rate when top pick wins', () => {
    const analyses: RaceAnalysis[] = [
      createMockRaceAnalysis({
        tier1: { count: 1, won: true, hitTop3: true, winPayoff: 8.0, placePayoff: null },
      }),
      createMockRaceAnalysis({
        tier1: { count: 1, won: false, hitTop3: true, winPayoff: null, placePayoff: 4.0 },
      }),
    ];

    const metrics = calculateAccuracyFromAnalyses(analyses);

    expect(metrics.tier1WinRate).toBe(50); // 1 out of 2
    expect(metrics.tier1Top3Rate).toBe(100); // 2 out of 2
  });

  it('should calculate 0% win rate when top pick never wins', () => {
    const analyses: RaceAnalysis[] = [
      createMockRaceAnalysis({
        tier1: { count: 1, won: false, hitTop3: true, winPayoff: null, placePayoff: 3.5 },
      }),
      createMockRaceAnalysis({
        tier1: { count: 1, won: false, hitTop3: false, winPayoff: null, placePayoff: null },
      }),
    ];

    const metrics = calculateAccuracyFromAnalyses(analyses);

    expect(metrics.tier1WinRate).toBe(0);
    expect(metrics.tier1Wins).toBe(0);
    expect(metrics.tier1Total).toBe(2);
  });

  it('should calculate 100% top-3 rate when all top picks place', () => {
    const analyses: RaceAnalysis[] = [
      createMockRaceAnalysis({
        tier1: { count: 1, won: true, hitTop3: true, winPayoff: 6.0, placePayoff: 3.0 },
      }),
      createMockRaceAnalysis({
        tier1: { count: 1, won: false, hitTop3: true, winPayoff: null, placePayoff: 4.0 },
      }),
      createMockRaceAnalysis({
        tier1: { count: 1, won: false, hitTop3: true, winPayoff: null, placePayoff: 3.5 },
      }),
    ];

    const metrics = calculateAccuracyFromAnalyses(analyses);

    expect(metrics.tier1Top3Rate).toBe(100);
    expect(metrics.tier1Top3).toBe(3);
  });

  it('should handle empty input', () => {
    const metrics = calculateAccuracyFromAnalyses([]);

    expect(metrics.totalRaces).toBe(0);
    expect(metrics.tier1WinRate).toBe(0);
    expect(metrics.tier1Top3Rate).toBe(0);
  });

  it('calculateAccuracy convenience function should work with matches directly', () => {
    const matches: MatchedResult[] = [
      createMockMatch('Horse A', 1, 1, 1), // Top pick won
      createMockMatch('Horse B', 2, 1, 2),
    ];

    // Use unique race IDs via the extractor
    const metrics = calculateAccuracy(matches, () => 'race_1');

    expect(metrics.totalRaces).toBe(1);
    expect(metrics.tier1WinRate).toBe(100);
  });
});

// ============================================================================
// SCENARIO C TEST - TOP PREDICTION FINISHED 2ND
// ============================================================================

describe('Accuracy Calculator - Scenario C (Top Prediction Finished 2nd)', () => {
  it('should show win rate = 0% and top-3 rate = 100%', () => {
    // Create a single race where top prediction finished 2nd
    const matches: MatchedResult[] = [
      createMockMatch('Top Pick', 1, 1, 2), // Top prediction finished 2nd
      createMockMatch('Second Pick', 2, 1, 1), // Second pick won
      createMockMatch('Third Pick', 3, 2, 3),
    ];

    // Assign a unique race ID to the matches
    const analysis = analyzeRace(matches, 'scenario_c');
    const metrics = calculateAccuracyFromAnalyses([analysis]);

    // Win rate should be 0% (top pick didn't win)
    expect(metrics.tier1WinRate).toBe(0);
    expect(metrics.tier1Wins).toBe(0);

    // Top-3 rate should be 100% (top pick finished 2nd)
    expect(metrics.tier1Top3Rate).toBe(100);
    expect(metrics.tier1Top3).toBe(1);
  });
});

// ============================================================================
// TIER 2 HIT RATE TESTS
// ============================================================================

describe('Accuracy Calculator - Tier 2 Hit Rate', () => {
  it('should calculate Tier 2 hit rate correctly', () => {
    const analyses: RaceAnalysis[] = [
      createMockRaceAnalysis({ tier2: { count: 2, anyWon: true, winningPayoff: 15.0 } }),
      createMockRaceAnalysis({ tier2: { count: 1, anyWon: false, winningPayoff: null } }),
      createMockRaceAnalysis({ tier2: { count: 3, anyWon: true, winningPayoff: 22.0 } }),
    ];

    const metrics = calculateAccuracyFromAnalyses(analyses);

    expect(metrics.tier2HitRate).toBeCloseTo(66.67, 1); // 2 out of 3
    expect(metrics.tier2Wins).toBe(2);
    expect(metrics.tier2Total).toBe(3);
  });

  it('should handle races with no Tier 2 horses', () => {
    const analyses: RaceAnalysis[] = [
      createMockRaceAnalysis({ tier2: { count: 0, anyWon: false, winningPayoff: null } }),
    ];

    const metrics = calculateAccuracyFromAnalyses(analyses);

    expect(metrics.tier2Total).toBe(0);
    expect(metrics.tier2HitRate).toBe(0);
  });
});

// ============================================================================
// EXACTA HIT RATE TESTS
// ============================================================================

describe('Accuracy Calculator - Exacta Hit Rate', () => {
  it('should calculate exacta hit rate correctly', () => {
    const analyses: RaceAnalysis[] = [
      createMockRaceAnalysis({ exacta: { attempted: true, hit: true } }),
      createMockRaceAnalysis({ exacta: { attempted: true, hit: false } }),
      createMockRaceAnalysis({ exacta: { attempted: true, hit: true } }),
      createMockRaceAnalysis({ exacta: { attempted: true, hit: false } }),
    ];

    const metrics = calculateAccuracyFromAnalyses(analyses);

    expect(metrics.exactaHitRate).toBe(50); // 2 out of 4
    expect(metrics.exactaHits).toBe(2);
    expect(metrics.exactaTotal).toBe(4);
  });

  it('should handle races with no exacta attempts', () => {
    const analyses: RaceAnalysis[] = [
      createMockRaceAnalysis({ exacta: { attempted: false, hit: false } }),
    ];

    const metrics = calculateAccuracyFromAnalyses(analyses);

    expect(metrics.exactaTotal).toBe(0);
    expect(metrics.exactaHitRate).toBe(0);
  });
});

// ============================================================================
// ROI CALCULATION TESTS
// ============================================================================

describe('Accuracy Calculator - ROI Calculations', () => {
  it('should calculate positive ROI when winning payoffs exceed wagers', () => {
    const analyses: RaceAnalysis[] = [
      createMockRaceAnalysis({
        tier1: { count: 1, won: true, hitTop3: true, winPayoff: 8.0, placePayoff: 4.0 },
      }),
      createMockRaceAnalysis({
        tier1: { count: 1, won: true, hitTop3: true, winPayoff: 6.0, placePayoff: 3.5 },
      }),
    ];

    const metrics = calculateAccuracyFromAnalyses(analyses, { baseBet: 2 });

    // Total wagered: 2 races × $2 = $4
    // Total win returns: $8 + $6 = $14
    // Win ROI: ((14 - 4) / 4) × 100 = 250%
    expect(metrics.tier1WinROI).toBeGreaterThan(0);
  });

  it('should calculate negative ROI when payoffs are less than wagers', () => {
    const analyses: RaceAnalysis[] = [
      createMockRaceAnalysis({
        tier1: { count: 1, won: false, hitTop3: true, winPayoff: null, placePayoff: 2.5 },
      }),
      createMockRaceAnalysis({
        tier1: { count: 1, won: false, hitTop3: false, winPayoff: null, placePayoff: null },
      }),
    ];

    const metrics = calculateAccuracyFromAnalyses(analyses, { baseBet: 2 });

    // Total wagered: 2 × $2 = $4
    // Total win returns: $0
    // Win ROI: ((0 - 4) / 4) × 100 = -100%
    expect(metrics.tier1WinROI).toBe(-100);
  });
});

// ============================================================================
// FORMAT REPORT TESTS
// ============================================================================

describe('Accuracy Calculator - formatAccuracyReport', () => {
  it('should format report with all metrics', () => {
    const metrics: AccuracyMetrics = {
      totalRaces: 10,
      totalMatched: 80,
      tier1WinRate: 35.5,
      tier1Wins: 4,
      tier1Total: 10,
      tier1Top3Rate: 65.0,
      tier1Top3: 7,
      tier2HitRate: 20.0,
      tier2Wins: 2,
      tier2Total: 10,
      exactaHitRate: 15.0,
      exactaHits: 2,
      exactaTotal: 10,
      tier1WinROI: 12.5,
      tier1PlaceROI: 8.3,
    };

    const report = formatAccuracyReport(metrics);

    expect(report).toContain('Total Races Analyzed: 10');
    expect(report).toContain('Win Rate:   35.5%');
    expect(report).toContain('Top-3 Rate: 65.0%');
    expect(report).toContain('TIER 2');
    expect(report).toContain('EXACTA');
    expect(report).toContain('Win ROI:    12.5%');
  });
});

// ============================================================================
// COMPARE ACCURACY TESTS
// ============================================================================

describe('Accuracy Calculator - compareAccuracy', () => {
  it('should calculate deltas between metrics', () => {
    const baseline: AccuracyMetrics = {
      totalRaces: 100,
      totalMatched: 800,
      tier1WinRate: 30.0,
      tier1Wins: 30,
      tier1Total: 100,
      tier1Top3Rate: 60.0,
      tier1Top3: 60,
      tier2HitRate: 15.0,
      tier2Wins: 15,
      tier2Total: 100,
      exactaHitRate: 10.0,
      exactaHits: 10,
      exactaTotal: 100,
    };

    const variant: AccuracyMetrics = {
      totalRaces: 100,
      totalMatched: 800,
      tier1WinRate: 35.0, // +5%
      tier1Wins: 35,
      tier1Total: 100,
      tier1Top3Rate: 65.0, // +5%
      tier1Top3: 65,
      tier2HitRate: 12.0, // -3%
      tier2Wins: 12,
      tier2Total: 100,
      exactaHitRate: 12.0, // +2%
      exactaHits: 12,
      exactaTotal: 100,
    };

    const comparison = compareAccuracy(baseline, variant);

    expect(comparison.tier1WinDelta).toBe(5.0);
    expect(comparison.tier1Top3Delta).toBe(5.0);
    expect(comparison.tier2Delta).toBe(-3.0);
    expect(comparison.exactaDelta).toBe(2.0);
    expect(comparison.summary).toContain('+5.0%');
    expect(comparison.summary).toContain('-3.0%');
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Accuracy Calculator - Edge Cases', () => {
  it('should handle single race analysis', () => {
    const analysis = createMockRaceAnalysis({
      tier1: { count: 1, won: true, hitTop3: true, winPayoff: 10.0, placePayoff: 5.0 },
    });

    const metrics = calculateAccuracyFromAnalyses([analysis]);

    expect(metrics.totalRaces).toBe(1);
    expect(metrics.tier1WinRate).toBe(100);
  });

  it('should handle all losses', () => {
    const analyses: RaceAnalysis[] = Array(5)
      .fill(null)
      .map(() =>
        createMockRaceAnalysis({
          tier1: { count: 1, won: false, hitTop3: false, winPayoff: null, placePayoff: null },
          tier2: { count: 1, anyWon: false, winningPayoff: null },
          exacta: { attempted: true, hit: false },
        })
      );

    const metrics = calculateAccuracyFromAnalyses(analyses);

    expect(metrics.tier1WinRate).toBe(0);
    expect(metrics.tier1Top3Rate).toBe(0);
    expect(metrics.tier2HitRate).toBe(0);
    expect(metrics.exactaHitRate).toBe(0);
  });

  it('should handle all wins', () => {
    const analyses: RaceAnalysis[] = Array(5)
      .fill(null)
      .map(() =>
        createMockRaceAnalysis({
          tier1: { count: 1, won: true, hitTop3: true, winPayoff: 8.0, placePayoff: 4.0 },
          tier2: { count: 1, anyWon: true, winningPayoff: 15.0 },
          exacta: { attempted: true, hit: true },
        })
      );

    const metrics = calculateAccuracyFromAnalyses(analyses);

    expect(metrics.tier1WinRate).toBe(100);
    expect(metrics.tier1Top3Rate).toBe(100);
    expect(metrics.tier2HitRate).toBe(100);
    expect(metrics.exactaHitRate).toBe(100);
  });
});
