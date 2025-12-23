/**
 * Field-Relative Scoring Module
 *
 * Calculates how a horse's score compares to the rest of the field.
 * Produces metrics like z-score, percentile, and standout detection.
 *
 * IMPORTANT: This module produces ADVISORY adjustments only.
 * Diamond detection (120-139 raw score) is unaffected - always use
 * raw scores for diamond classification.
 *
 * Edge cases handled:
 * - Tied for first: isStandout = false, gapFromNextBest = 0 (must be UNIQUE leader)
 * - Single horse with context: fieldPercentile = 100 (guard against division by zero)
 * - All same score: zScore = 0, no horse is leader, isStandout = false for all
 * - stdDev = 0: zScore = 0 (don't divide by zero)
 *
 * @module scoring/fieldRelative
 */

import {
  isFieldRelativeScoringEnabled,
  getFieldRelativeStandoutThreshold,
} from '../config/featureFlags';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Field strength classification based on average score
 */
export type FieldStrength = 'weak' | 'average' | 'strong' | 'stacked';

/**
 * Context about the entire field for relative comparisons
 */
export interface FieldContext {
  /** Number of horses in the field */
  fieldSize: number;
  /** Mean score across all horses */
  averageScore: number;
  /** Standard deviation of scores */
  standardDeviation: number;
  /** Highest score in the field */
  topScore: number;
  /** Lowest score in the field */
  bottomScore: number;
  /** Difference between top and bottom scores */
  scoreRange: number;
  /** Classification of field quality based on average score */
  fieldStrength: FieldStrength;
}

/**
 * Result of field-relative analysis for a single horse
 */
export interface FieldRelativeResult {
  /** Z-score: (horseScore - fieldAvg) / stdDev. 0 if stdDev is 0 */
  zScore: number;
  /** Percentile ranking in this field (0-100). Higher = better */
  fieldPercentile: number;
  /** Points behind the top horse (0 if this horse is the leader) */
  gapFromLeader: number;
  /** Points ahead of #2 (only meaningful for unique leader, 0 if tied) */
  gapFromNextBest: number;
  /** True only if UNIQUE leader AND meets standout threshold */
  isStandout: boolean;
  /** Advisory tier adjustment: -1 (demote), 0 (no change), +1 (promote) */
  tierAdjustment: -1 | 0 | 1;
  /** Human-readable explanation of the adjustment */
  adjustmentReason: string;
}

/**
 * Complete field analysis with context and per-horse results
 */
export interface FieldAnalysis {
  /** Computed field context */
  context: FieldContext;
  /** Results for each horse, in same order as input scores */
  results: FieldRelativeResult[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Thresholds for field strength classification */
const FIELD_STRENGTH_THRESHOLDS = {
  weak: 140,
  average: 165,
  strong: 185,
} as const;

/** Minimum gap to be considered a standout (can be overridden by feature flag) */
const DEFAULT_STANDOUT_THRESHOLD = 20;

/** Minimum gap considered "close" for stacked field demotion */
const CLOSE_RACE_THRESHOLD = 5;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate the mean of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate the standard deviation of an array of numbers
 */
function calculateStandardDeviation(values: number[], mean: number): number {
  if (values.length < 2) return 0;

  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Classify field strength based on average score
 */
function classifyFieldStrength(averageScore: number): FieldStrength {
  if (averageScore >= FIELD_STRENGTH_THRESHOLDS.strong) return 'stacked';
  if (averageScore >= FIELD_STRENGTH_THRESHOLDS.average) return 'strong';
  if (averageScore >= FIELD_STRENGTH_THRESHOLDS.weak) return 'average';
  return 'weak';
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Calculate context about the entire field.
 *
 * @param scores - Array of all horse scores in the field
 * @returns FieldContext with statistics about the field
 * @throws Error if fewer than 2 scores provided
 *
 * @example
 * const context = calculateFieldContext([180, 165, 155, 140]);
 * // context.averageScore = 160
 * // context.fieldStrength = 'average'
 */
export function calculateFieldContext(scores: number[]): FieldContext {
  if (scores.length < 2) {
    throw new Error('calculateFieldContext requires at least 2 scores');
  }

  const sortedScores = [...scores].sort((a, b) => b - a);
  const topScore = sortedScores[0] ?? 0;
  const bottomScore = sortedScores[sortedScores.length - 1] ?? 0;
  const averageScore = calculateMean(scores);
  const standardDeviation = calculateStandardDeviation(scores, averageScore);

  return {
    fieldSize: scores.length,
    averageScore,
    standardDeviation,
    topScore,
    bottomScore,
    scoreRange: topScore - bottomScore,
    fieldStrength: classifyFieldStrength(averageScore),
  };
}

/**
 * Calculate field-relative metrics for a single horse.
 *
 * Handles edge cases:
 * - Tied for first: isStandout = false, gapFromNextBest = 0
 * - Single horse: fieldPercentile = 100
 * - All same score: zScore = 0, isStandout = false
 * - stdDev = 0: zScore = 0
 *
 * @param horseScore - The score of the horse to analyze
 * @param allScores - All scores in the field (including this horse)
 * @param fieldContext - Pre-computed field context (optional, will be calculated if not provided)
 * @returns FieldRelativeResult with metrics and advisory adjustment
 *
 * @example
 * // Tied scores case [180, 180, 160]
 * const result = calculateFieldRelativeScore(180, [180, 180, 160]);
 * // result.isStandout = false (tied for first)
 * // result.gapFromNextBest = 0 (not unique leader)
 */
export function calculateFieldRelativeScore(
  horseScore: number,
  allScores: number[],
  fieldContext?: FieldContext
): FieldRelativeResult {
  // Handle edge case: empty or single score array
  if (allScores.length === 0) {
    return {
      zScore: 0,
      fieldPercentile: 0,
      gapFromLeader: 0,
      gapFromNextBest: 0,
      isStandout: false,
      tierAdjustment: 0,
      adjustmentReason: 'No field data available',
    };
  }

  if (allScores.length === 1) {
    return {
      zScore: 0,
      fieldPercentile: 100,
      gapFromLeader: 0,
      gapFromNextBest: 0,
      isStandout: false,
      tierAdjustment: 0,
      adjustmentReason: 'Single horse field - no comparison possible',
    };
  }

  // Calculate or use provided context
  const context = fieldContext ?? calculateFieldContext(allScores);
  const { averageScore, standardDeviation, topScore, fieldSize, fieldStrength } = context;

  // Sort scores descending for gap calculations
  const sortedScores = [...allScores].sort((a, b) => b - a);

  // ========== Z-SCORE ==========
  // Guard against division by zero when all scores are the same
  const zScore = standardDeviation === 0 ? 0 : (horseScore - averageScore) / standardDeviation;

  // ========== FIELD PERCENTILE ==========
  // Count horses with scores BELOW this horse's score
  const horsesBelow = allScores.filter((s) => s < horseScore).length;

  // Guard against division by zero for single horse
  // fieldPercentile = 100 if fieldSize <= 1
  const fieldPercentile = fieldSize <= 1 ? 100 : (horsesBelow / (fieldSize - 1)) * 100;

  // ========== GAP FROM LEADER ==========
  const gapFromLeader = topScore - horseScore;

  // ========== GAP FROM NEXT BEST (tied scores handling) ==========
  // Count horses at the top score to detect ties
  const horsesAtTop = sortedScores.filter((s) => s === topScore).length;
  const isAtTopScore = horseScore === topScore;

  let gapFromNextBest = 0;

  if (isAtTopScore && horsesAtTop > 1) {
    // Horse is TIED for first place - gap is 0 since they share the lead
    gapFromNextBest = 0;
  } else if (isAtTopScore && horsesAtTop === 1) {
    // Horse is UNIQUE leader - find gap to second place
    const secondScore = sortedScores[1];
    if (secondScore !== undefined) {
      gapFromNextBest = horseScore - secondScore;
    }
  } else {
    // Not at top - find first score LESS THAN this horse's score
    const nextBestScore = sortedScores.find((s) => s < horseScore);
    if (nextBestScore !== undefined) {
      gapFromNextBest = horseScore - nextBestScore;
    }
  }

  // ========== IS STANDOUT ==========
  // A horse is only a standout if:
  // 1. They are at the top score (isAtTopScore)
  // 2. They are the UNIQUE leader (horsesAtTop === 1)
  // 3. Their gap meets the standout threshold
  const standoutThreshold = isFieldRelativeScoringEnabled()
    ? getFieldRelativeStandoutThreshold()
    : DEFAULT_STANDOUT_THRESHOLD;

  const isUniqueLeader = isAtTopScore && horsesAtTop === 1;
  const isStandout = isUniqueLeader && gapFromNextBest >= standoutThreshold;

  // ========== TIER ADJUSTMENT ==========
  let tierAdjustment: -1 | 0 | 1 = 0;
  let adjustmentReason = 'No adjustment needed';

  if (isStandout && (fieldStrength === 'weak' || fieldStrength === 'average')) {
    // Standout in a weak/average field - promote
    tierAdjustment = 1;
    adjustmentReason = `Standout by ${gapFromNextBest} points in ${fieldStrength} field - consider tier promotion`;
  } else if (
    isUniqueLeader &&
    gapFromNextBest < CLOSE_RACE_THRESHOLD &&
    fieldStrength === 'stacked'
  ) {
    // Close race in stacked field - demote
    tierAdjustment = -1;
    adjustmentReason = `Leading by only ${gapFromNextBest} points in stacked field - consider tier demotion`;
  } else if (isStandout) {
    adjustmentReason = `Standout by ${gapFromNextBest} points in ${fieldStrength} field`;
  } else if (isAtTopScore && horsesAtTop > 1) {
    adjustmentReason = `Tied for first with ${horsesAtTop - 1} other horse(s)`;
  } else if (gapFromLeader > 0) {
    adjustmentReason = `${gapFromLeader} points behind leader`;
  }

  return {
    zScore: Math.round(zScore * 100) / 100, // Round to 2 decimal places
    fieldPercentile: Math.round(fieldPercentile * 10) / 10, // Round to 1 decimal place
    gapFromLeader,
    gapFromNextBest,
    isStandout,
    tierAdjustment,
    adjustmentReason,
  };
}

/**
 * Analyze all horses in a field at once.
 *
 * More efficient than calling calculateFieldRelativeScore for each horse
 * separately, as it calculates the field context only once.
 *
 * @param scores - Array of all horse scores
 * @returns Object with context and results array (same order as input)
 * @throws Error if fewer than 2 scores provided
 *
 * @example
 * const { context, results } = analyzeEntireField([195, 165, 155, 140]);
 * // context.fieldStrength = 'average'
 * // results[0].isStandout = true (195 is 30 points ahead of 165)
 */
export function analyzeEntireField(scores: number[]): FieldAnalysis {
  if (scores.length < 2) {
    throw new Error('analyzeEntireField requires at least 2 scores');
  }

  const context = calculateFieldContext(scores);

  const results = scores.map((score) => calculateFieldRelativeScore(score, scores, context));

  return { context, results };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get a human-readable summary of field strength
 */
export function getFieldStrengthDescription(strength: FieldStrength): string {
  switch (strength) {
    case 'weak':
      return 'Weak field (avg < 140)';
    case 'average':
      return 'Average field (avg 140-164)';
    case 'strong':
      return 'Strong field (avg 165-184)';
    case 'stacked':
      return 'Stacked field (avg 185+)';
  }
}

/**
 * Get color for field strength display
 */
export function getFieldStrengthColor(strength: FieldStrength): string {
  switch (strength) {
    case 'weak':
      return '#ef4444'; // Red
    case 'average':
      return '#f97316'; // Orange
    case 'strong':
      return '#22c55e'; // Green
    case 'stacked':
      return '#8b5cf6'; // Purple
  }
}

/**
 * Format z-score for display
 */
export function formatZScore(zScore: number): string {
  const sign = zScore >= 0 ? '+' : '';
  return `${sign}${zScore.toFixed(2)}σ`;
}

/**
 * Get interpretation of z-score
 */
export function interpretZScore(zScore: number): string {
  if (zScore >= 2) return 'Exceptional - far above field average';
  if (zScore >= 1) return 'Strong - above field average';
  if (zScore >= 0) return 'Average - at or slightly above field average';
  if (zScore >= -1) return 'Below average - slightly below field';
  return 'Weak - significantly below field average';
}
