/**
 * Blended Rank Calculation Engine
 *
 * Combines static ability (Base Rank) with dynamic momentum (Trend Rank)
 * into a single actionable ranking.
 *
 * See /src/docs/BLENDED_RANK.md for full methodology documentation.
 *
 * @module scoring/blendedRank
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import type { ScoredHorse, HorseScore } from './index';
import {
  rankHorsesByTrend,
  type TrendScore,
  type HorseWithTrend,
  MIN_RACES_FOR_TREND,
} from './trendAnalysis';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Blending weights configuration */
export interface BlendWeights {
  /** Weight for base rank (0-1) */
  base: number;
  /** Weight for trend rank (0-1) */
  trend: number;
}

/** Default blending weights */
export const DEFAULT_BLEND_WEIGHTS: BlendWeights = {
  base: 0.6, // 60% base ability
  trend: 0.4, // 40% momentum/trend
};

/** Agreement level between base and trend ranks */
export type AgreementLevel = 'HIGH' | 'MODERATE' | 'DIVERGENT';

/** Complete blended rank result for a horse */
export interface BlendedRankResult {
  /** Blended rank position (1 = best) */
  blendedRank: number;
  /** Blended score (weighted combination) */
  blendedScore: number;
  /** Base rank position */
  baseRank: number;
  /** Base score (0-323) */
  baseScore: number;
  /** Trend rank position */
  trendRank: number;
  /** Trend normalized score (0-100) */
  trendScore: number;
  /** Agreement between base and trend */
  agreement: AgreementLevel;
  /** Flag indicating limited trend data */
  limitedTrendData: boolean;
  /** Reason for limited data */
  limitedDataReason?: string;
  /** Full trend analysis result */
  trendDetails: TrendScore;
}

/** Horse with all ranking information */
export interface BlendedRankedHorse {
  horse: HorseEntry;
  index: number;
  score: HorseScore;
  baseRank: number;
  trendScore: TrendScore;
  trendRank: number;
  blendedResult: BlendedRankResult;
}

// ============================================================================
// BLENDED SCORE CALCULATION
// ============================================================================

/**
 * Calculate blended score from base and trend scores
 *
 * Formula: Blended = (Base × BaseWeight) + (Trend × TrendWeight)
 *
 * Scores are normalized before blending:
 * - Base score: 0-323 → 0-100
 * - Trend score: already 0-100
 *
 * @param baseScore - Base score (0-323)
 * @param trendScore - Trend normalized score (0-100)
 * @param weights - Optional custom weights
 * @returns Blended score (0-100)
 */
export function calculateBlendedScore(
  baseScore: number,
  trendScore: number,
  weights: BlendWeights = DEFAULT_BLEND_WEIGHTS
): number {
  // Normalize base score to 0-100 scale (323 is max)
  const normalizedBase = (baseScore / 323) * 100;

  // Calculate weighted blend
  const blended = normalizedBase * weights.base + trendScore * weights.trend;

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, blended));
}

/**
 * Calculate agreement level between base and trend ranks
 *
 * HIGH: Within 1 position
 * MODERATE: 2 positions apart
 * DIVERGENT: 3+ positions apart
 */
export function calculateAgreement(baseRank: number, trendRank: number): AgreementLevel {
  const difference = Math.abs(baseRank - trendRank);

  if (difference <= 1) {
    return 'HIGH';
  } else if (difference === 2) {
    return 'MODERATE';
  }
  return 'DIVERGENT';
}

/**
 * Calculate complete blended rank for a single horse
 *
 * @param baseScore - Base score from main algorithm
 * @param baseRank - Base rank position
 * @param trendScore - Trend analysis result
 * @param trendRank - Trend rank position
 * @param weights - Optional custom weights
 * @returns Complete blended rank result
 */
export function calculateBlendedRank(
  baseScore: number,
  baseRank: number,
  trendScore: TrendScore,
  trendRank: number,
  weights: BlendWeights = DEFAULT_BLEND_WEIGHTS
): BlendedRankResult {
  // Check for limited trend data
  const limitedTrendData = !trendScore.hasSufficientData;

  // If limited trend data, use base only (effectively 100% base weight)
  const effectiveWeights = limitedTrendData ? { base: 1.0, trend: 0.0 } : weights;

  // Calculate blended score
  const blendedScore = calculateBlendedScore(
    baseScore,
    trendScore.normalizedScore,
    effectiveWeights
  );

  // Calculate agreement
  const agreement = calculateAgreement(baseRank, trendRank);

  return {
    blendedRank: 0, // Will be set during field ranking
    blendedScore,
    baseRank,
    baseScore,
    trendRank,
    trendScore: trendScore.normalizedScore,
    agreement,
    limitedTrendData,
    limitedDataReason: limitedTrendData ? trendScore.insufficientDataReason : undefined,
    trendDetails: trendScore,
  };
}

// ============================================================================
// FIELD RANKING
// ============================================================================

/**
 * Rank all horses in field by blended score
 *
 * This function:
 * 1. Takes scored horses with base ranks
 * 2. Calculates trend scores for each
 * 3. Calculates blended scores
 * 4. Ranks by blended score
 *
 * @param scoredHorses - Array of horses with base scores
 * @param raceHeader - Optional race header for trend context
 * @param weights - Optional custom blending weights
 * @returns Horses with complete ranking information
 */
export function rankHorsesByBlended(
  scoredHorses: ScoredHorse[],
  raceHeader?: RaceHeader,
  weights: BlendWeights = DEFAULT_BLEND_WEIGHTS
): BlendedRankedHorse[] {
  // Filter to active (non-scratched) horses
  const activeHorses = scoredHorses.filter((h) => !h.score.isScratched);

  if (activeHorses.length === 0) {
    return [];
  }

  // Calculate trend scores for all horses
  const trendContext = raceHeader
    ? { distanceFurlongs: raceHeader.distanceFurlongs, surface: raceHeader.surface }
    : undefined;

  const horsesWithTrend = rankHorsesByTrend(
    activeHorses.map((h) => h.horse),
    trendContext
  );

  // Create a map of horse index to trend info
  const trendMap = new Map<number, HorseWithTrend>();
  for (const hwt of horsesWithTrend) {
    trendMap.set(hwt.index, hwt);
  }

  // Build blended ranked horses
  const blendedHorses: BlendedRankedHorse[] = activeHorses.map((scoredHorse) => {
    const trendInfo = trendMap.get(scoredHorse.index);
    const trendScore = trendInfo?.trendScore ?? {
      rank: activeHorses.length,
      direction: 'FLAT' as const,
      strength: 0,
      strengthCategory: 'MINOR' as const,
      confidence: 'LOW' as const,
      normalizedScore: 50,
      rawScore: 0,
      details: [],
      flags: {
        workoutPatternTrending: false,
        optimalLayoff: false,
        classDropImproving: false,
        jockeyUpgrade: false,
        trainerHotStreak: false,
        equipmentChange: false,
        layoffWithBullet: false,
        backToWinningDistance: false,
        preferredSurface: false,
      },
      finishWindows: {
        window1: null,
        window1_2: null,
        window1_3: null,
        window1_4: null,
        window1_5: null,
        window4_5: null,
        window3_5: null,
        raceCount: 0,
      },
      beyerWindows: {
        window1: null,
        window1_2: null,
        window1_3: null,
        window1_4: null,
        window1_5: null,
        window4_5: null,
        window3_5: null,
        raceCount: 0,
      },
      finishHistory: [],
      beyerHistory: [],
      hasSufficientData: false,
      insufficientDataReason: 'Trend data not found',
    };

    const blendedResult = calculateBlendedRank(
      scoredHorse.score.baseScore,
      scoredHorse.rank,
      trendScore,
      trendScore.rank || activeHorses.length,
      weights
    );

    return {
      horse: scoredHorse.horse,
      index: scoredHorse.index,
      score: scoredHorse.score,
      baseRank: scoredHorse.rank,
      trendScore,
      trendRank: trendScore.rank || activeHorses.length,
      blendedResult,
    };
  });

  // Sort by blended score (higher is better)
  const sorted = [...blendedHorses].sort(
    (a, b) => b.blendedResult.blendedScore - a.blendedResult.blendedScore
  );

  // Assign blended ranks with tie handling
  let currentRank = 1;
  let previousScore: number | null = null;
  let sameRankCount = 0;

  sorted.forEach((horse) => {
    const score = horse.blendedResult.blendedScore;

    if (previousScore !== null && score < previousScore) {
      currentRank += sameRankCount;
      sameRankCount = 1;
    } else if (previousScore !== null && Math.abs(score - previousScore) < 0.001) {
      sameRankCount++;
    } else {
      sameRankCount = 1;
    }

    previousScore = score;
    horse.blendedResult.blendedRank = currentRank;
  });

  // Return all horses (including scratched) but only ranked ones have valid ranks
  return scoredHorses.map((scoredHorse) => {
    const blendedHorse = blendedHorses.find((bh) => bh.index === scoredHorse.index);
    if (blendedHorse) {
      return blendedHorse;
    }

    // Scratched horse - return placeholder
    const defaultTrendScore: TrendScore = {
      rank: 0,
      direction: 'FLAT',
      strength: 0,
      strengthCategory: 'MINOR',
      confidence: 'LOW',
      normalizedScore: 0,
      rawScore: 0,
      details: [],
      flags: {
        workoutPatternTrending: false,
        optimalLayoff: false,
        classDropImproving: false,
        jockeyUpgrade: false,
        trainerHotStreak: false,
        equipmentChange: false,
        layoffWithBullet: false,
        backToWinningDistance: false,
        preferredSurface: false,
      },
      finishWindows: {
        window1: null,
        window1_2: null,
        window1_3: null,
        window1_4: null,
        window1_5: null,
        window4_5: null,
        window3_5: null,
        raceCount: 0,
      },
      beyerWindows: {
        window1: null,
        window1_2: null,
        window1_3: null,
        window1_4: null,
        window1_5: null,
        window4_5: null,
        window3_5: null,
        raceCount: 0,
      },
      finishHistory: [],
      beyerHistory: [],
      hasSufficientData: false,
      insufficientDataReason: 'Scratched',
    };

    return {
      horse: scoredHorse.horse,
      index: scoredHorse.index,
      score: scoredHorse.score,
      baseRank: 0,
      trendScore: defaultTrendScore,
      trendRank: 0,
      blendedResult: {
        blendedRank: 0,
        blendedScore: 0,
        baseRank: 0,
        baseScore: 0,
        trendRank: 0,
        trendScore: 0,
        agreement: 'DIVERGENT' as AgreementLevel,
        limitedTrendData: true,
        limitedDataReason: 'Scratched',
        trendDetails: defaultTrendScore,
      },
    };
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get color for agreement level
 */
export function getAgreementColor(agreement: AgreementLevel): string {
  switch (agreement) {
    case 'HIGH':
      return '#22c55e'; // Green
    case 'MODERATE':
      return '#eab308'; // Yellow
    case 'DIVERGENT':
      return '#ef4444'; // Red
  }
}

/**
 * Get description for agreement level
 */
export function getAgreementDescription(agreement: AgreementLevel): string {
  switch (agreement) {
    case 'HIGH':
      return 'Strong conviction - Base and Trend agree';
    case 'MODERATE':
      return 'Moderate confidence - Some disagreement';
    case 'DIVERGENT':
      return 'Dig deeper - Base and Trend diverge significantly';
  }
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Re-export MIN_RACES_FOR_TREND from trendAnalysis for convenience
export { MIN_RACES_FOR_TREND };
