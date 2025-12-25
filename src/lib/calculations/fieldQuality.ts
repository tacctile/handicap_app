/**
 * Field Quality Assessment Module
 *
 * Assesses the overall quality of a race field and detects changes
 * when horses are scratched. This helps understand how scratches
 * affect the remaining horses' relative chances.
 *
 * Key concepts:
 * - Field strength: Classification based on average score of active horses
 * - Top contenders: Horses within 15 points of the leader
 * - Score spread: Difference between highest and lowest active scores
 *
 * @module calculations/fieldQuality
 */

import type { HorseScore } from '../scoring';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Field strength classification based on average score
 */
export type FieldStrength = 'elite' | 'strong' | 'average' | 'weak';

/**
 * Represents a scored horse with minimal required data
 */
export interface ScoredHorseData {
  index: number;
  score: HorseScore;
  horseName?: string;
}

/**
 * Result of assessing field quality
 */
export interface FieldQualityAssessment {
  /** Average score of active (non-scratched) horses */
  averageScore: number;
  /** Highest score in the field */
  topScore: number;
  /** Difference between highest and lowest active scores */
  scoreSpread: number;
  /** Classification of field strength based on average */
  fieldStrength: FieldStrength;
  /** Number of horses within 15 points of the leader */
  topContenderCount: number;
  /** Number of active horses in the field */
  activeHorseCount: number;
  /** Standard deviation of scores (for statistical analysis) */
  standardDeviation: number;
  /** Median score of the field */
  medianScore: number;
}

/**
 * Describes how field quality changed
 */
export type QualityChangeType = 'improved' | 'unchanged' | 'weakened';

/**
 * Result of detecting field quality changes after scratches
 */
export interface FieldQualityChange {
  /** How the field quality changed: improved, unchanged, or weakened */
  qualityChange: QualityChangeType;
  /** Change in average score (positive = improved, negative = weakened) */
  avgScoreChange: number;
  /** Change in number of top contenders */
  topContenderChange: number;
  /** Human-readable explanation of the change */
  reasoning: string;
  /** Whether the previous leader was scratched */
  leaderScratched: boolean;
  /** New leader's index after scratches (if applicable) */
  newLeaderIndex: number | null;
  /** How much the top score dropped due to scratches */
  topScoreDrop: number;
  /** Recommended adjustment for remaining horses (0-2 points) */
  fieldWeakeningBoost: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Thresholds for field strength classification */
export const FIELD_STRENGTH_THRESHOLDS = {
  elite: 190,
  strong: 170,
  average: 150,
  weak: 0,
} as const;

/** Points behind leader to be considered a "contender" */
export const TOP_CONTENDER_THRESHOLD = 15;

/** Minimum top score drop to trigger field weakening boost */
export const SIGNIFICANT_DROP_THRESHOLD = 20;

/** Maximum field weakening boost points */
export const MAX_FIELD_WEAKENING_BOOST = 2;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate the mean of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate the standard deviation of an array of numbers
 */
function calculateStandardDeviation(values: number[], mean: number): number {
  if (values.length < 2) return 0;

  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate the median of an array of numbers
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    const lower = sorted[mid - 1];
    const upper = sorted[mid];
    return lower !== undefined && upper !== undefined ? (lower + upper) / 2 : 0;
  }
  return sorted[mid] ?? 0;
}

/**
 * Classify field strength based on average score
 */
function classifyFieldStrength(averageScore: number): FieldStrength {
  if (averageScore >= FIELD_STRENGTH_THRESHOLDS.elite) return 'elite';
  if (averageScore >= FIELD_STRENGTH_THRESHOLDS.strong) return 'strong';
  if (averageScore >= FIELD_STRENGTH_THRESHOLDS.average) return 'average';
  return 'weak';
}

/**
 * Count horses within threshold points of the leader
 */
function countTopContenders(scores: number[], topScore: number): number {
  return scores.filter((score) => topScore - score <= TOP_CONTENDER_THRESHOLD).length;
}

/**
 * Calculate field weakening boost based on top score drop
 * - 0 pts: Drop < 20 points (minimal impact)
 * - 1 pt: Drop 20-35 points (moderate impact)
 * - 2 pts: Drop > 35 points (significant impact)
 */
function calculateFieldWeakeningBoost(topScoreDrop: number): number {
  if (topScoreDrop < SIGNIFICANT_DROP_THRESHOLD) return 0;
  if (topScoreDrop <= 35) return 1;
  return MAX_FIELD_WEAKENING_BOOST;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Assess the quality of a race field based on horse scores.
 *
 * @param horses - Array of scored horses
 * @param scratchedIndices - Set of indices for scratched horses
 * @returns FieldQualityAssessment with metrics about field quality
 *
 * @example
 * const horses = [
 *   { index: 0, score: { total: 220, isScratched: false, ... } },
 *   { index: 1, score: { total: 180, isScratched: false, ... } },
 *   { index: 2, score: { total: 160, isScratched: false, ... } },
 * ];
 * const result = assessFieldQuality(horses, new Set());
 * // result.averageScore = 186.67
 * // result.fieldStrength = 'strong'
 * // result.topContenderCount = 2 (220 and 180 are within 15 pts of 220)
 */
export function assessFieldQuality(
  horses: ScoredHorseData[],
  scratchedIndices: Set<number>
): FieldQualityAssessment {
  // Filter to active (non-scratched) horses
  const activeHorses = horses.filter((h) => !scratchedIndices.has(h.index) && !h.score.isScratched);

  // Handle edge case: no active horses
  if (activeHorses.length === 0) {
    return {
      averageScore: 0,
      topScore: 0,
      scoreSpread: 0,
      fieldStrength: 'weak',
      topContenderCount: 0,
      activeHorseCount: 0,
      standardDeviation: 0,
      medianScore: 0,
    };
  }

  // Get all active scores
  const scores = activeHorses.map((h) => h.score.total);
  const sortedScores = [...scores].sort((a, b) => b - a);

  const topScore = sortedScores[0] ?? 0;
  const bottomScore = sortedScores[sortedScores.length - 1] ?? 0;
  const scoreSpread = topScore - bottomScore;

  const averageScore = calculateMean(scores);
  const standardDeviation = calculateStandardDeviation(scores, averageScore);
  const medianScore = calculateMedian(scores);

  const fieldStrength = classifyFieldStrength(averageScore);
  const topContenderCount = countTopContenders(scores, topScore);

  return {
    averageScore: Math.round(averageScore * 100) / 100,
    topScore,
    scoreSpread,
    fieldStrength,
    topContenderCount,
    activeHorseCount: activeHorses.length,
    standardDeviation: Math.round(standardDeviation * 100) / 100,
    medianScore,
  };
}

/**
 * Detect how field quality changed between two states (before and after scratches).
 *
 * This function compares the field quality before and after horses were scratched
 * to determine:
 * - Whether the field got stronger, weaker, or stayed the same
 * - If the leader was scratched (major shift in dynamics)
 * - How much boost remaining horses should get
 *
 * @param beforeScores - Horses before scratches
 * @param afterScores - Horses after scratches
 * @param scratchedIndices - Set of indices that were scratched
 * @returns FieldQualityChange with analysis of changes
 *
 * @example
 * // Top horse (score 220) scratched
 * const change = detectFieldQualityChange(beforeScores, afterScores, new Set([0]));
 * // change.qualityChange = 'weakened'
 * // change.leaderScratched = true
 * // change.topScoreDrop = 40 (if next best was 180)
 * // change.fieldWeakeningBoost = 2
 */
export function detectFieldQualityChange(
  beforeScores: ScoredHorseData[],
  afterScores: ScoredHorseData[],
  scratchedIndices: Set<number>
): FieldQualityChange {
  // Handle edge case: no scratches
  if (scratchedIndices.size === 0) {
    return {
      qualityChange: 'unchanged',
      avgScoreChange: 0,
      topContenderChange: 0,
      reasoning: 'No scratches detected',
      leaderScratched: false,
      newLeaderIndex: null,
      topScoreDrop: 0,
      fieldWeakeningBoost: 0,
    };
  }

  // Assess field quality before and after
  const beforeAssessment = assessFieldQuality(beforeScores, new Set());
  const afterAssessment = assessFieldQuality(afterScores, scratchedIndices);

  // Calculate changes
  const avgScoreChange = afterAssessment.averageScore - beforeAssessment.averageScore;
  const topContenderChange = afterAssessment.topContenderCount - beforeAssessment.topContenderCount;
  const topScoreDrop = beforeAssessment.topScore - afterAssessment.topScore;

  // Determine if leader was scratched
  const beforeActiveHorses = beforeScores.filter((h) => !h.score.isScratched);
  const beforeLeader = beforeActiveHorses.reduce(
    (best, h) => (h.score.total > (best?.score.total ?? 0) ? h : best),
    beforeActiveHorses[0]
  );
  const leaderScratched = beforeLeader !== undefined && scratchedIndices.has(beforeLeader.index);

  // Find new leader
  const afterActiveHorses = afterScores.filter(
    (h) => !scratchedIndices.has(h.index) && !h.score.isScratched
  );
  const newLeader = afterActiveHorses.reduce(
    (best, h) => (h.score.total > (best?.score.total ?? 0) ? h : best),
    afterActiveHorses[0]
  );
  const newLeaderIndex = newLeader?.index ?? null;

  // Determine quality change direction
  // Field "weakens" when average score or top score drops significantly
  // Field "improves" when weak horses are scratched (average goes up)
  let qualityChange: QualityChangeType;
  if (topScoreDrop >= SIGNIFICANT_DROP_THRESHOLD || avgScoreChange < -5) {
    qualityChange = 'weakened';
  } else if (avgScoreChange > 5) {
    qualityChange = 'improved';
  } else {
    qualityChange = 'unchanged';
  }

  // Calculate field weakening boost for remaining horses
  const fieldWeakeningBoost =
    qualityChange === 'weakened' ? calculateFieldWeakeningBoost(topScoreDrop) : 0;

  // Build reasoning string
  const reasoning = buildQualityChangeReasoning({
    qualityChange,
    avgScoreChange,
    topContenderChange,
    leaderScratched,
    topScoreDrop,
    fieldWeakeningBoost,
    scratchedCount: scratchedIndices.size,
    beforeStrength: beforeAssessment.fieldStrength,
    afterStrength: afterAssessment.fieldStrength,
  });

  return {
    qualityChange,
    avgScoreChange: Math.round(avgScoreChange * 100) / 100,
    topContenderChange,
    reasoning,
    leaderScratched,
    newLeaderIndex,
    topScoreDrop,
    fieldWeakeningBoost,
  };
}

/**
 * Build a human-readable reasoning string for field quality changes
 */
function buildQualityChangeReasoning(params: {
  qualityChange: QualityChangeType;
  avgScoreChange: number;
  topContenderChange: number;
  leaderScratched: boolean;
  topScoreDrop: number;
  fieldWeakeningBoost: number;
  scratchedCount: number;
  beforeStrength: FieldStrength;
  afterStrength: FieldStrength;
}): string {
  const parts: string[] = [];

  // Scratches summary
  parts.push(`${params.scratchedCount} horse${params.scratchedCount > 1 ? 's' : ''} scratched`);

  // Leader scratched is major event
  if (params.leaderScratched) {
    parts.push('including the race favorite');
  }

  // Field strength change
  if (params.beforeStrength !== params.afterStrength) {
    parts.push(`field strength changed from ${params.beforeStrength} to ${params.afterStrength}`);
  }

  // Average score change
  if (Math.abs(params.avgScoreChange) > 2) {
    const direction = params.avgScoreChange > 0 ? 'increased' : 'decreased';
    parts.push(
      `average score ${direction} by ${Math.abs(params.avgScoreChange).toFixed(1)} points`
    );
  }

  // Top score drop
  if (params.topScoreDrop > 0) {
    parts.push(`top score dropped by ${params.topScoreDrop} points`);
  }

  // Contender change
  if (params.topContenderChange !== 0) {
    const direction = params.topContenderChange > 0 ? 'more' : 'fewer';
    parts.push(
      `${Math.abs(params.topContenderChange)} ${direction} top contender${Math.abs(params.topContenderChange) !== 1 ? 's' : ''}`
    );
  }

  // Field weakening boost
  if (params.fieldWeakeningBoost > 0) {
    parts.push(
      `remaining horses' relative value improved (+${params.fieldWeakeningBoost} pt advisory boost)`
    );
  }

  return parts.join('; ');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get a human-readable description of field strength
 */
export function getFieldStrengthDescription(strength: FieldStrength): string {
  switch (strength) {
    case 'elite':
      return 'Elite field (avg 190+)';
    case 'strong':
      return 'Strong field (avg 170-189)';
    case 'average':
      return 'Average field (avg 150-169)';
    case 'weak':
      return 'Weak field (avg <150)';
  }
}

/**
 * Get color for field strength display
 */
export function getFieldStrengthColor(strength: FieldStrength): string {
  switch (strength) {
    case 'elite':
      return '#8b5cf6'; // Purple
    case 'strong':
      return '#22c55e'; // Green
    case 'average':
      return '#f97316'; // Orange
    case 'weak':
      return '#ef4444'; // Red
  }
}

/**
 * Get color for quality change display
 */
export function getQualityChangeColor(change: QualityChangeType): string {
  switch (change) {
    case 'improved':
      return '#22c55e'; // Green
    case 'unchanged':
      return '#6b7280'; // Gray
    case 'weakened':
      return '#ef4444'; // Red
  }
}

/**
 * Determine if a scratch significantly affected the field
 * (useful for UI highlighting)
 */
export function isSignificantScratch(change: FieldQualityChange): boolean {
  return (
    change.leaderScratched ||
    change.topScoreDrop >= SIGNIFICANT_DROP_THRESHOLD ||
    Math.abs(change.avgScoreChange) > 10
  );
}

/**
 * Get a brief summary of field quality for display
 */
export function getFieldQualitySummary(assessment: FieldQualityAssessment): string {
  const strengthLabel = getFieldStrengthDescription(assessment.fieldStrength);
  const contenderText =
    assessment.topContenderCount === 1
      ? '1 clear leader'
      : `${assessment.topContenderCount} top contenders`;

  return `${strengthLabel} with ${contenderText}`;
}
