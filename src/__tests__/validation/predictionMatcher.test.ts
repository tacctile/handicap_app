/**
 * Prediction Matcher Tests
 *
 * Tests for matching algorithm predictions to actual race results.
 */

import { describe, it, expect } from 'vitest';
import {
  matchPredictionsToResults,
  getMatchedByTier,
  getTopPredictions,
  isPredictionHit,
  didTopPredictionWin,
  didTopPredictionShow,
  isExactaHit,
  getTierWinners,
} from '../../lib/backtesting/predictionMatcher';
import type { ChartRace, ChartStarter } from '../../types/chart';
import type { ScoredHorse } from '../../lib/scoring';
import type { HorseEntry } from '../../types/drf';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a mock ChartRace for testing
 */
function createMockChartRace(starters: Partial<ChartStarter>[]): ChartRace {
  return {
    recordType: 'R',
    raceNumber: 1,
    breedCode: 'TB',
    raceType: 'CLM',
    distance: 5280,
    distanceFurlongs: 8,
    surfaceCode: 'D',
    surface: 'dirt',
    trackCondition: 'Fast',
    starters: starters.map((s, i) => ({
      recordType: 'S',
      raceNumber: 1,
      horseId: `horse_${i}`,
      horseName: s.horseName ?? `Horse ${i}`,
      programNumber: String(i + 1),
      postPosition: i + 1,
      finishPosition: s.finishPosition ?? i + 1,
      isScratched: s.isScratched ?? false,
      odds: s.odds ?? 5.0,
      winPayoff: s.winPayoff ?? null,
      placePayoff: s.placePayoff ?? null,
      showPayoff: s.showPayoff ?? null,
      lengthsBehind: s.lengthsBehind ?? null,
      jockeyName: 'Test Jockey',
      trainerName: 'Test Trainer',
    })),
  };
}

/**
 * Create a mock ScoredHorse for testing
 */
function createMockScoredHorse(
  horseName: string,
  rank: number,
  score: number,
  isScratched = false
): ScoredHorse {
  return {
    horse: {
      horseName,
      programNumber: rank,
      postPosition: rank,
    } as HorseEntry,
    index: rank - 1,
    rank,
    score: {
      total: score,
      baseScore: score,
      overlayScore: 0,
      oddsScore: 0,
      breakdown: {} as unknown as ScoredHorse['score']['breakdown'],
      isScratched,
      confidenceLevel: 'medium',
      dataQuality: 80,
    },
  };
}

// ============================================================================
// EXACT NAME MATCHING TESTS
// ============================================================================

describe('Prediction Matcher - Exact Name Matching', () => {
  it('should match horses with exact names', () => {
    const predictions: ScoredHorse[] = [
      createMockScoredHorse('Thunder Road', 1, 190),
      createMockScoredHorse('Swift Wind', 2, 175),
      createMockScoredHorse('Lucky Star', 3, 165),
    ];

    const chartRace = createMockChartRace([
      { horseName: 'Thunder Road', finishPosition: 2 },
      { horseName: 'Swift Wind', finishPosition: 1 },
      { horseName: 'Lucky Star', finishPosition: 3 },
    ]);

    const matches = matchPredictionsToResults(predictions, chartRace);

    expect(matches).toHaveLength(3);

    // Check Thunder Road match
    const thunderRoad = matches.find((m) => m.horseName === 'Thunder Road');
    expect(thunderRoad).toBeDefined();
    expect(thunderRoad?.predictionRank).toBe(1);
    expect(thunderRoad?.actualFinishPosition).toBe(2);
    expect(thunderRoad?.matchConfidence).toBe(1);
  });

  it('should handle case-insensitive matching', () => {
    const predictions: ScoredHorse[] = [createMockScoredHorse('THUNDER ROAD', 1, 190)];

    const chartRace = createMockChartRace([{ horseName: 'Thunder Road', finishPosition: 1 }]);

    const matches = matchPredictionsToResults(predictions, chartRace);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.matchConfidence).toBe(1);
  });
});

// ============================================================================
// FUZZY MATCHING TESTS
// ============================================================================

describe('Prediction Matcher - Fuzzy Matching', () => {
  it('should match horses with country codes removed', () => {
    const predictions: ScoredHorse[] = [createMockScoredHorse('Galway Bay', 1, 190)];

    const chartRace = createMockChartRace([{ horseName: 'Galway Bay (IRE)', finishPosition: 1 }]);

    const matches = matchPredictionsToResults(predictions, chartRace);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.matchConfidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should match minor name variations', () => {
    const predictions: ScoredHorse[] = [createMockScoredHorse("Thunder's Road", 1, 190)];

    const chartRace = createMockChartRace([{ horseName: 'Thunders Road', finishPosition: 1 }]);

    const matches = matchPredictionsToResults(predictions, chartRace);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.matchConfidence).toBeGreaterThan(0.8);
  });

  it('should not match completely different names', () => {
    const predictions: ScoredHorse[] = [createMockScoredHorse('Thunder Road', 1, 190)];

    const chartRace = createMockChartRace([{ horseName: 'Swift Wind', finishPosition: 1 }]);

    const matches = matchPredictionsToResults(predictions, chartRace, { logWarnings: false });

    expect(matches).toHaveLength(0);
  });

  it('should respect minimum similarity threshold', () => {
    const predictions: ScoredHorse[] = [createMockScoredHorse('Thunder Road', 1, 190)];

    const chartRace = createMockChartRace([{ horseName: 'Thundor Rode', finishPosition: 1 }]);

    // With high threshold, should not match
    const highThreshold = matchPredictionsToResults(predictions, chartRace, {
      minSimilarity: 0.95,
      logWarnings: false,
    });
    expect(highThreshold).toHaveLength(0);

    // With low threshold, should match
    const lowThreshold = matchPredictionsToResults(predictions, chartRace, {
      minSimilarity: 0.7,
      logWarnings: false,
    });
    expect(lowThreshold).toHaveLength(1);
  });
});

// ============================================================================
// TIER CLASSIFICATION TESTS
// ============================================================================

describe('Prediction Matcher - Tier Classification', () => {
  it('should assign correct tier based on score', () => {
    const predictions: ScoredHorse[] = [
      createMockScoredHorse('Tier 1 Horse', 1, 190), // Tier 1: 180+
      createMockScoredHorse('Tier 2 Horse', 2, 170), // Tier 2: 160-179
      createMockScoredHorse('Tier 3 Horse', 3, 145), // Tier 3: 130-159
      createMockScoredHorse('No Tier Horse', 4, 100), // Below threshold
    ];

    const chartRace = createMockChartRace([
      { horseName: 'Tier 1 Horse', finishPosition: 1 },
      { horseName: 'Tier 2 Horse', finishPosition: 2 },
      { horseName: 'Tier 3 Horse', finishPosition: 3 },
      { horseName: 'No Tier Horse', finishPosition: 4 },
    ]);

    const matches = matchPredictionsToResults(predictions, chartRace);

    expect(matches.find((m) => m.horseName === 'Tier 1 Horse')?.predictionTier).toBe(1);
    expect(matches.find((m) => m.horseName === 'Tier 2 Horse')?.predictionTier).toBe(2);
    expect(matches.find((m) => m.horseName === 'Tier 3 Horse')?.predictionTier).toBe(3);
    expect(matches.find((m) => m.horseName === 'No Tier Horse')?.predictionTier).toBeNull();
  });
});

// ============================================================================
// SCRATCH HANDLING TESTS
// ============================================================================

describe('Prediction Matcher - Scratch Handling', () => {
  it('should skip scratched predictions', () => {
    const predictions: ScoredHorse[] = [
      createMockScoredHorse('Active Horse', 1, 190, false),
      createMockScoredHorse('Scratched Horse', 2, 185, true),
    ];

    const chartRace = createMockChartRace([
      { horseName: 'Active Horse', finishPosition: 1 },
      { horseName: 'Scratched Horse', finishPosition: 99, isScratched: true },
    ]);

    const matches = matchPredictionsToResults(predictions, chartRace);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.horseName).toBe('Active Horse');
  });

  it('should mark scratched starters in results', () => {
    const predictions: ScoredHorse[] = [createMockScoredHorse('Test Horse', 1, 190)];

    const chartRace = createMockChartRace([
      { horseName: 'Test Horse', finishPosition: 99, isScratched: true },
    ]);

    const matches = matchPredictionsToResults(predictions, chartRace);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.wasScratch).toBe(true);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('Prediction Matcher - Utility Functions', () => {
  const createTestMatches = () => {
    const predictions: ScoredHorse[] = [
      createMockScoredHorse('Horse A', 1, 195), // Tier 1, rank 1
      createMockScoredHorse('Horse B', 2, 185), // Tier 1, rank 2
      createMockScoredHorse('Horse C', 3, 170), // Tier 2, rank 3
      createMockScoredHorse('Horse D', 4, 150), // Tier 3, rank 4
    ];

    const chartRace = createMockChartRace([
      { horseName: 'Horse A', finishPosition: 2, winPayoff: null, placePayoff: 4.2 },
      {
        horseName: 'Horse B',
        finishPosition: 1,
        winPayoff: 5.6,
        placePayoff: 3.0,
        showPayoff: 2.4,
      },
      { horseName: 'Horse C', finishPosition: 4 },
      { horseName: 'Horse D', finishPosition: 3, showPayoff: 2.8 },
    ]);

    return matchPredictionsToResults(predictions, chartRace);
  };

  it('getMatchedByTier should filter by tier', () => {
    const matches = createTestMatches();

    const tier1 = getMatchedByTier(matches, 1);
    expect(tier1).toHaveLength(2);
    expect(tier1.every((m) => m.predictionTier === 1)).toBe(true);

    const tier2 = getMatchedByTier(matches, 2);
    expect(tier2).toHaveLength(1);
  });

  it('getTopPredictions should return top N horses', () => {
    const matches = createTestMatches();

    const top1 = getTopPredictions(matches, 1);
    expect(top1).toHaveLength(1);
    expect(top1[0]?.horseName).toBe('Horse A');

    const top3 = getTopPredictions(matches, 3);
    expect(top3).toHaveLength(3);
  });

  it('isPredictionHit should correctly identify hits', () => {
    const matches = createTestMatches();
    const horseA = matches.find((m) => m.horseName === 'Horse A')!;
    const horseB = matches.find((m) => m.horseName === 'Horse B')!;

    expect(isPredictionHit(horseB, 1)).toBe(true); // Won
    expect(isPredictionHit(horseA, 1)).toBe(false); // Finished 2nd
    expect(isPredictionHit(horseA, 3)).toBe(true); // Finished top 3
  });

  it('didTopPredictionWin should check if rank 1 won', () => {
    const matches = createTestMatches();
    expect(didTopPredictionWin(matches)).toBe(false); // Horse A finished 2nd
  });

  it('didTopPredictionShow should check if rank 1 finished top 3', () => {
    const matches = createTestMatches();
    expect(didTopPredictionShow(matches)).toBe(true); // Horse A finished 2nd
  });

  it('isExactaHit should check if top 2 finished 1-2', () => {
    const matches = createTestMatches();
    // Horse A (rank 1) finished 2nd, Horse B (rank 2) finished 1st
    expect(isExactaHit(matches)).toBe(true);
  });

  it('isExactaHit should return false when top 2 did not finish 1-2', () => {
    const predictions: ScoredHorse[] = [
      createMockScoredHorse('Horse A', 1, 195),
      createMockScoredHorse('Horse B', 2, 185),
    ];

    const chartRace = createMockChartRace([
      { horseName: 'Horse A', finishPosition: 3 },
      { horseName: 'Horse B', finishPosition: 1 },
    ]);

    const matches = matchPredictionsToResults(predictions, chartRace);
    expect(isExactaHit(matches)).toBe(false);
  });

  it('getTierWinners should return winning tier horses', () => {
    const matches = createTestMatches();
    const winners = getTierWinners(matches);

    expect(winners).toHaveLength(1);
    expect(winners[0]?.horseName).toBe('Horse B');
    expect(winners[0]?.predictionTier).toBe(1);
  });
});

// ============================================================================
// PAYOFF EXTRACTION TESTS
// ============================================================================

describe('Prediction Matcher - Payoff Extraction', () => {
  it('should include payoffs in matched results', () => {
    const predictions: ScoredHorse[] = [createMockScoredHorse('Winner', 1, 190)];

    const chartRace = createMockChartRace([
      { horseName: 'Winner', finishPosition: 1, winPayoff: 8.4, placePayoff: 4.2, showPayoff: 3.0 },
    ]);

    const matches = matchPredictionsToResults(predictions, chartRace);

    expect(matches[0]?.winPayoff).toBe(8.4);
    expect(matches[0]?.placePayoff).toBe(4.2);
    expect(matches[0]?.showPayoff).toBe(3.0);
  });

  it('should include odds in matched results', () => {
    const predictions: ScoredHorse[] = [createMockScoredHorse('Test Horse', 1, 190)];

    const chartRace = createMockChartRace([
      { horseName: 'Test Horse', finishPosition: 1, odds: 3.2 },
    ]);

    const matches = matchPredictionsToResults(predictions, chartRace);

    expect(matches[0]?.actualOdds).toBe(3.2);
  });
});
