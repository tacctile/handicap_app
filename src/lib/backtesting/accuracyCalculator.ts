/**
 * Accuracy Calculator
 *
 * Calculates hit rates and accuracy metrics from matched prediction results.
 * Used for backtesting algorithm performance against actual race outcomes.
 */

import type { AccuracyMetrics, MatchedResult } from '../../types/chart';
import {
  getTopPredictions,
  isPredictionHit,
  isExactaHit,
  getMatchedByTier,
} from './predictionMatcher';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Single race analysis result for aggregation
 */
export interface RaceAnalysis {
  /** Race identifier */
  raceId: string;

  /** Total matched predictions */
  matchedCount: number;

  /** Tier 1 results */
  tier1: {
    count: number;
    won: boolean;
    hitTop3: boolean;
    winPayoff: number | null;
    placePayoff: number | null;
  };

  /** Tier 2 results */
  tier2: {
    count: number;
    anyWon: boolean;
    winningPayoff: number | null;
  };

  /** Exacta result */
  exacta: {
    attempted: boolean;
    hit: boolean;
  };
}

/**
 * Options for accuracy calculation
 */
export interface AccuracyOptions {
  /** Base bet amount for ROI calculations (default: 2) */
  baseBet?: number;
}

const DEFAULT_OPTIONS: Required<AccuracyOptions> = {
  baseBet: 2,
};

// ============================================================================
// SINGLE RACE ANALYSIS
// ============================================================================

/**
 * Analyze a single race's prediction results
 */
export function analyzeRace(matches: MatchedResult[], raceId: string): RaceAnalysis {
  const nonScratched = matches.filter((m) => !m.wasScratch);

  // Tier 1 analysis
  const tier1Matches = nonScratched.filter((m) => m.predictionTier === 1);
  const topPrediction = getTopPredictions(matches, 1)[0];
  const tier1Won = topPrediction ? isPredictionHit(topPrediction, 1) : false;
  const tier1HitTop3 = topPrediction ? isPredictionHit(topPrediction, 3) : false;

  // Tier 2 analysis
  const tier2Matches = getMatchedByTier(matches, 2);
  const tier2Winner = tier2Matches.find((m) => m.actualFinishPosition === 1);
  const tier2AnyWon = tier2Winner !== undefined;

  // Exacta analysis
  const topTwo = getTopPredictions(matches, 2);
  const exactaAttempted = topTwo.length >= 2;
  const exactaHit = exactaAttempted && isExactaHit(matches);

  return {
    raceId,
    matchedCount: nonScratched.length,
    tier1: {
      count: tier1Matches.length,
      won: tier1Won,
      hitTop3: tier1HitTop3,
      winPayoff: tier1Won && topPrediction ? topPrediction.winPayoff : null,
      placePayoff: tier1HitTop3 && topPrediction ? topPrediction.placePayoff : null,
    },
    tier2: {
      count: tier2Matches.length,
      anyWon: tier2AnyWon,
      winningPayoff: tier2Winner?.winPayoff ?? null,
    },
    exacta: {
      attempted: exactaAttempted,
      hit: exactaHit,
    },
  };
}

// ============================================================================
// AGGREGATE ACCURACY CALCULATION
// ============================================================================

/**
 * Calculate accuracy metrics from multiple race analyses
 *
 * @param raceAnalyses - Array of race analysis results
 * @param options - Calculation options
 * @returns Aggregated accuracy metrics
 */
export function calculateAccuracyFromAnalyses(
  raceAnalyses: RaceAnalysis[],
  options: AccuracyOptions = {}
): AccuracyMetrics {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const totalRaces = raceAnalyses.length;

  if (totalRaces === 0) {
    return createEmptyMetrics();
  }

  // Aggregate counts
  let totalMatched = 0;
  let tier1Wins = 0;
  let tier1Top3 = 0;
  let tier1Total = 0;
  let tier2Wins = 0;
  let tier2Total = 0;
  let exactaHits = 0;
  let exactaTotal = 0;
  let tier1WinPayoffSum = 0;
  let tier1PlacePayoffSum = 0;
  let tier1BetsPlaced = 0;

  for (const analysis of raceAnalyses) {
    totalMatched += analysis.matchedCount;

    // Tier 1 stats
    if (analysis.tier1.count > 0) {
      tier1Total++;
      if (analysis.tier1.won) {
        tier1Wins++;
        if (analysis.tier1.winPayoff !== null) {
          tier1WinPayoffSum += analysis.tier1.winPayoff;
        }
      }
      if (analysis.tier1.hitTop3) {
        tier1Top3++;
        if (analysis.tier1.placePayoff !== null) {
          tier1PlacePayoffSum += analysis.tier1.placePayoff;
        }
      }
      tier1BetsPlaced++;
    }

    // Tier 2 stats
    if (analysis.tier2.count > 0) {
      tier2Total++;
      if (analysis.tier2.anyWon) {
        tier2Wins++;
      }
    }

    // Exacta stats
    if (analysis.exacta.attempted) {
      exactaTotal++;
      if (analysis.exacta.hit) {
        exactaHits++;
      }
    }
  }

  // Calculate rates
  const tier1WinRate = tier1Total > 0 ? (tier1Wins / tier1Total) * 100 : 0;
  const tier1Top3Rate = tier1Total > 0 ? (tier1Top3 / tier1Total) * 100 : 0;
  const tier2HitRate = tier2Total > 0 ? (tier2Wins / tier2Total) * 100 : 0;
  const exactaHitRate = exactaTotal > 0 ? (exactaHits / exactaTotal) * 100 : 0;

  // Calculate ROI (return on investment)
  // ROI = ((Total Returns - Total Wagered) / Total Wagered) * 100
  const totalWagered = tier1BetsPlaced * opts.baseBet;
  const tier1WinROI =
    totalWagered > 0 ? ((tier1WinPayoffSum - totalWagered) / totalWagered) * 100 : undefined;
  const tier1PlaceROI =
    totalWagered > 0 ? ((tier1PlacePayoffSum - totalWagered) / totalWagered) * 100 : undefined;

  return {
    totalRaces,
    totalMatched,
    tier1WinRate: roundTo(tier1WinRate, 2),
    tier1Wins,
    tier1Total,
    tier1Top3Rate: roundTo(tier1Top3Rate, 2),
    tier1Top3,
    tier2HitRate: roundTo(tier2HitRate, 2),
    tier2Wins,
    tier2Total,
    exactaHitRate: roundTo(exactaHitRate, 2),
    exactaHits,
    exactaTotal,
    tier1WinROI: tier1WinROI !== undefined ? roundTo(tier1WinROI, 2) : undefined,
    tier1PlaceROI: tier1PlaceROI !== undefined ? roundTo(tier1PlaceROI, 2) : undefined,
  };
}

/**
 * Calculate accuracy metrics directly from matched results (convenience function)
 *
 * @param allMatches - Array of matched results (can be from multiple races)
 * @param raceIdExtractor - Optional function to extract race ID from match
 * @param options - Calculation options
 * @returns Aggregated accuracy metrics
 */
export function calculateAccuracy(
  allMatches: MatchedResult[],
  raceIdExtractor?: (match: MatchedResult) => string,
  options: AccuracyOptions = {}
): AccuracyMetrics {
  // Group matches by race
  const raceGroups = new Map<string, MatchedResult[]>();

  for (const match of allMatches) {
    const raceId = raceIdExtractor ? raceIdExtractor(match) : `race_${match.predictionRank}`;
    const existing = raceGroups.get(raceId) ?? [];
    existing.push(match);
    raceGroups.set(raceId, existing);
  }

  // Analyze each race
  const analyses: RaceAnalysis[] = [];
  for (const [raceId, matches] of raceGroups) {
    analyses.push(analyzeRace(matches, raceId));
  }

  return calculateAccuracyFromAnalyses(analyses, options);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Round to specified decimal places
 */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Create empty metrics for edge cases
 */
function createEmptyMetrics(): AccuracyMetrics {
  return {
    totalRaces: 0,
    totalMatched: 0,
    tier1WinRate: 0,
    tier1Wins: 0,
    tier1Total: 0,
    tier1Top3Rate: 0,
    tier1Top3: 0,
    tier2HitRate: 0,
    tier2Wins: 0,
    tier2Total: 0,
    exactaHitRate: 0,
    exactaHits: 0,
    exactaTotal: 0,
  };
}

/**
 * Format accuracy metrics for display
 */
export function formatAccuracyReport(metrics: AccuracyMetrics): string {
  const lines = [
    '═══════════════════════════════════════════',
    '           BACKTESTING ACCURACY REPORT      ',
    '═══════════════════════════════════════════',
    '',
    `Total Races Analyzed: ${metrics.totalRaces}`,
    `Total Horses Matched: ${metrics.totalMatched}`,
    '',
    '── TIER 1 (Top Pick) ──────────────────────',
    `  Win Rate:   ${metrics.tier1WinRate.toFixed(1)}% (${metrics.tier1Wins}/${metrics.tier1Total})`,
    `  Top-3 Rate: ${metrics.tier1Top3Rate.toFixed(1)}% (${metrics.tier1Top3}/${metrics.tier1Total})`,
    metrics.tier1WinROI !== undefined ? `  Win ROI:    ${metrics.tier1WinROI.toFixed(1)}%` : '',
    metrics.tier1PlaceROI !== undefined ? `  Place ROI:  ${metrics.tier1PlaceROI.toFixed(1)}%` : '',
    '',
    '── TIER 2 (Alternatives) ──────────────────',
    `  Hit Rate:   ${metrics.tier2HitRate.toFixed(1)}% (${metrics.tier2Wins}/${metrics.tier2Total})`,
    '',
    '── EXACTA ─────────────────────────────────',
    `  Hit Rate:   ${metrics.exactaHitRate.toFixed(1)}% (${metrics.exactaHits}/${metrics.exactaTotal})`,
    '',
    '═══════════════════════════════════════════',
  ];

  return lines.filter((l) => l !== undefined).join('\n');
}

/**
 * Compare two accuracy metrics (useful for A/B testing algorithm changes)
 */
export function compareAccuracy(
  baseline: AccuracyMetrics,
  variant: AccuracyMetrics
): {
  tier1WinDelta: number;
  tier1Top3Delta: number;
  tier2Delta: number;
  exactaDelta: number;
  summary: string;
} {
  const tier1WinDelta = variant.tier1WinRate - baseline.tier1WinRate;
  const tier1Top3Delta = variant.tier1Top3Rate - baseline.tier1Top3Rate;
  const tier2Delta = variant.tier2HitRate - baseline.tier2HitRate;
  const exactaDelta = variant.exactaHitRate - baseline.exactaHitRate;

  const format = (d: number) => (d >= 0 ? `+${d.toFixed(1)}%` : `${d.toFixed(1)}%`);

  const summary = [
    'Accuracy Comparison:',
    `  Tier 1 Win: ${format(tier1WinDelta)}`,
    `  Tier 1 Top-3: ${format(tier1Top3Delta)}`,
    `  Tier 2 Hit: ${format(tier2Delta)}`,
    `  Exacta: ${format(exactaDelta)}`,
  ].join('\n');

  return {
    tier1WinDelta,
    tier1Top3Delta,
    tier2Delta,
    exactaDelta,
    summary,
  };
}
