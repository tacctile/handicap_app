/**
 * Field-Relative Scoring Module
 *
 * Provides context-aware analysis of a horse's score relative to its competition.
 * A 175-point horse in a weak field (next-best 140) is different from 175
 * in a stacked field (three others at 170+).
 *
 * IMPORTANT: This module produces ADVISORY adjustments only.
 * - Actual tier determination still uses absolute scores (180+, 160-179, 130-159)
 * - Diamond detection (120-139 raw score range) is NOT affected by these calculations
 * - UI can display field context and recommendations can factor in standout status
 * - Works alongside (not replaces) the overlay-based adjustment in tierClassification.ts:182
 *
 * @module scoring/fieldRelative
 */

import { FEATURE_FLAGS } from '../config/featureFlags';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Statistical context about the competitive field
 */
export interface FieldContext {
  /** Number of horses in the race */
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

  /**
   * Categorical field strength based on average score:
   * - weak: avg < 140
   * - average: avg 140-164
   * - strong: avg 165-184
   * - stacked: avg >= 185
   */
  fieldStrength: 'weak' | 'average' | 'strong' | 'stacked';
}

/**
 * A horse's position and performance relative to its field
 */
export interface FieldRelativeResult {
  /**
   * Z-score: (horseScore - fieldAvg) / stdDev
   * Positive = above average, negative = below average
   * Typically ranges from -3 to +3
   */
  zScore: number;

  /**
   * Percentile position within this field (0-100)
   * 100 = best in field, 0 = worst in field
   */
  fieldPercentile: number;

  /**
   * Points behind the top horse (0 if this horse is the leader)
   */
  gapFromLeader: number;

  /**
   * Points ahead of second-best horse (only meaningful if this horse is #1)
   * 0 if not the leader or tied for lead
   */
  gapFromNextBest: number;

  /**
   * True when horse is #1 AND 20+ points above #2
   * Indicates a clear standout that could justify tier promotion
   */
  isStandout: boolean;

  /**
   * ADVISORY tier adjustment suggestion:
   * - +1: Consider promoting (standout in weak/average field)
   * - -1: Consider demoting (barely leading in stacked field)
   * - 0: No adjustment suggested
   *
   * NOTE: This is a SUGGESTION only. The actual tier is still determined
   * by absolute score thresholds. This value helps inform betting decisions
   * and UI presentation.
   */
  tierAdjustment: -1 | 0 | 1;

  /** Human-readable explanation of the adjustment recommendation */
  adjustmentReason: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Field strength thresholds based on average field score
 *
 * Derivation:
 *   - Tier thresholds: 180+ (T1), 160-179 (T2), 130-159 (T3)
 *   - A "weak" field averages Tier 3 or below
 *   - An "average" field centers around low Tier 2 / high Tier 3
 *   - A "strong" field averages Tier 2 to low Tier 1
 *   - A "stacked" field averages Tier 1 quality
 */
const FIELD_STRENGTH_THRESHOLDS = {
  weak: 140, // Below this = weak field
  average: 165, // 140-164 = average field
  strong: 185, // 165-184 = strong field
  // 185+ = stacked field
} as const;

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Calculate statistical context for a field of horses
 *
 * @param scores - Array of raw scores for all horses in the race
 * @returns FieldContext with statistical analysis of the field
 * @throws Error if fewer than 2 scores provided
 *
 * @example
 * const scores = [185, 175, 165, 155, 145];
 * const context = calculateFieldContext(scores);
 * // context.fieldStrength === 'strong' (avg = 165)
 */
export function calculateFieldContext(scores: number[]): FieldContext {
  if (scores.length < 2) {
    throw new Error('Field context requires at least 2 horses');
  }

  const fieldSize = scores.length;
  const sortedScores = [...scores].sort((a, b) => b - a); // Descending

  // Calculate mean
  const sum = scores.reduce((acc, s) => acc + s, 0);
  const averageScore = sum / fieldSize;

  // Calculate standard deviation
  const squaredDiffs = scores.map((s) => Math.pow(s - averageScore, 2));
  const variance = squaredDiffs.reduce((acc, d) => acc + d, 0) / fieldSize;
  const standardDeviation = Math.sqrt(variance);

  const topScore = sortedScores[0];
  const bottomScore = sortedScores[sortedScores.length - 1];
  const scoreRange = topScore - bottomScore;

  // Determine field strength category
  let fieldStrength: FieldContext['fieldStrength'];
  if (averageScore < FIELD_STRENGTH_THRESHOLDS.weak) {
    fieldStrength = 'weak';
  } else if (averageScore < FIELD_STRENGTH_THRESHOLDS.average) {
    fieldStrength = 'average';
  } else if (averageScore < FIELD_STRENGTH_THRESHOLDS.strong) {
    fieldStrength = 'strong';
  } else {
    fieldStrength = 'stacked';
  }

  return {
    fieldSize,
    averageScore: Math.round(averageScore * 10) / 10, // 1 decimal place
    standardDeviation: Math.round(standardDeviation * 10) / 10,
    topScore,
    bottomScore,
    scoreRange,
    fieldStrength,
  };
}

/**
 * Calculate a horse's relative position and performance within its field
 *
 * @param horseScore - The individual horse's raw score
 * @param allScores - Array of all scores in the field (including this horse)
 * @param fieldContext - Pre-calculated field context (optional, will calculate if not provided)
 * @returns FieldRelativeResult with z-score, percentile, and adjustment recommendation
 *
 * @example
 * const scores = [175, 150, 145, 140, 135];
 * const context = calculateFieldContext(scores);
 * const result = calculateFieldRelativeScore(175, scores, context);
 * // result.isStandout === true (25 points ahead of #2)
 * // result.tierAdjustment === 1 (standout in average field)
 */
export function calculateFieldRelativeScore(
  horseScore: number,
  allScores: number[],
  fieldContext?: FieldContext
): FieldRelativeResult {
  const context = fieldContext || calculateFieldContext(allScores);
  const sortedScores = [...allScores].sort((a, b) => b - a); // Descending

  // Z-score calculation
  // Handle edge case of zero standard deviation (all same scores)
  const zScore =
    context.standardDeviation > 0
      ? (horseScore - context.averageScore) / context.standardDeviation
      : 0;

  // Percentile: what percentage of the field is this horse better than?
  const horsesBelow = allScores.filter((s) => s < horseScore).length;
  const fieldPercentile = Math.round((horsesBelow / (allScores.length - 1)) * 100);

  // Gap calculations
  const topScore = sortedScores[0];
  const gapFromLeader = Math.max(0, topScore - horseScore);

  // Gap from next best (only if this horse is the leader)
  let gapFromNextBest = 0;
  const isLeader = horseScore === topScore;
  if (isLeader && sortedScores.length > 1) {
    // Find first horse with different (lower) score
    const secondBest = sortedScores.find((s) => s < horseScore);
    gapFromNextBest = secondBest !== undefined ? horseScore - secondBest : 0;
  }

  // Get standout threshold from feature flags
  const standoutThreshold = FEATURE_FLAGS.fieldRelativeStandoutThreshold;

  // Standout detection: leader with significant gap
  const isStandout = isLeader && gapFromNextBest >= standoutThreshold;

  // Determine tier adjustment recommendation
  const { tierAdjustment, adjustmentReason } = calculateTierAdjustmentRecommendation(
    horseScore,
    isLeader,
    isStandout,
    gapFromNextBest,
    context.fieldStrength
  );

  return {
    zScore: Math.round(zScore * 100) / 100, // 2 decimal places
    fieldPercentile,
    gapFromLeader,
    gapFromNextBest,
    isStandout,
    tierAdjustment,
    adjustmentReason,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate the advisory tier adjustment based on field context
 *
 * Rules:
 * - +1 for standouts (20+ point lead) in weak or average fields
 * - -1 for barely-leading (< 5 point gap) in stacked fields
 * - 0 otherwise
 *
 * @internal
 */
function calculateTierAdjustmentRecommendation(
  horseScore: number,
  isLeader: boolean,
  isStandout: boolean,
  gapFromNextBest: number,
  fieldStrength: FieldContext['fieldStrength']
): { tierAdjustment: -1 | 0 | 1; adjustmentReason: string } {
  // Check if field-relative scoring is enabled
  if (!FEATURE_FLAGS.useFieldRelativeScoring) {
    return {
      tierAdjustment: 0,
      adjustmentReason: 'Field-relative scoring disabled',
    };
  }

  const standoutThreshold = FEATURE_FLAGS.fieldRelativeStandoutThreshold;

  // Standout in weak/average field: consider promotion
  if (isStandout && (fieldStrength === 'weak' || fieldStrength === 'average')) {
    return {
      tierAdjustment: 1,
      adjustmentReason: `Standout performance (${gapFromNextBest}+ point lead) in ${fieldStrength} field - consider tier promotion`,
    };
  }

  // Barely leading in stacked field: consider demotion
  const BARELY_LEADING_THRESHOLD = 5;
  if (isLeader && fieldStrength === 'stacked' && gapFromNextBest < BARELY_LEADING_THRESHOLD) {
    return {
      tierAdjustment: -1,
      adjustmentReason: `Narrow lead (${gapFromNextBest} pts) in stacked field - competition is fierce, consider tier demotion`,
    };
  }

  // Default: no adjustment
  let reason: string;
  if (!isLeader) {
    reason = 'Not the field leader';
  } else if (isStandout && fieldStrength === 'stacked') {
    reason = `Standout (${gapFromNextBest}+ pts ahead) but in stacked field - absolute score prevails`;
  } else if (isStandout && fieldStrength === 'strong') {
    reason = `Standout (${gapFromNextBest}+ pts ahead) in strong field - no adjustment needed`;
  } else if (gapFromNextBest < standoutThreshold) {
    reason = `Competitive lead (${gapFromNextBest} pts) - not a clear standout`;
  } else {
    reason = 'No adjustment criteria met';
  }

  return {
    tierAdjustment: 0,
    adjustmentReason: reason,
  };
}

/**
 * Get a human-readable description of field strength
 */
export function describeFieldStrength(fieldStrength: FieldContext['fieldStrength']): string {
  switch (fieldStrength) {
    case 'weak':
      return 'Weak field (below-average competition)';
    case 'average':
      return 'Average field (typical competition)';
    case 'strong':
      return 'Strong field (above-average competition)';
    case 'stacked':
      return 'Stacked field (elite competition)';
  }
}

/**
 * Utility: Calculate field context and relative scores for all horses in one pass
 *
 * @param scores - Array of raw scores for all horses
 * @returns Object with fieldContext and array of results matching input order
 */
export function analyzeEntireField(scores: number[]): {
  fieldContext: FieldContext;
  horseResults: FieldRelativeResult[];
} {
  const fieldContext = calculateFieldContext(scores);

  const horseResults = scores.map((score) =>
    calculateFieldRelativeScore(score, scores, fieldContext)
  );

  return {
    fieldContext,
    horseResults,
  };
}
