/**
 * FIELD SPREAD ANALYSIS
 *
 * Analyzes score separation to determine field competitiveness
 * and betting confidence FOR BET CONSTRUCTION PURPOSES ONLY.
 *
 * v3.8 UPDATE: SCORE ADJUSTMENTS REMOVED
 * ======================================
 * This module NO LONGER modifies scores. Boosting a dominant leader because
 * they're dominant just confirms what was already calculated (circular logic).
 *
 * Field spread is now INFORMATIONAL ONLY:
 * - Field type detection (DOMINANT, CHALKY, SEPARATED, COMPETITIVE, WIDE_OPEN)
 * - Tier assignments (A/B/C/X based on distance from leader)
 * - Confidence mapping (VERY_HIGH to VERY_LOW)
 * - Sit-out condition detection
 * - Recommended box sizes for exacta/trifecta/superfecta
 *
 * Field Types:
 * - DOMINANT: Clear standout, 25+ point lead over #2
 * - SEPARATED: Clear tiers, 15+ point gaps between groups
 * - COMPETITIVE: Top 4 closely matched, within 15 points
 * - WIDE_OPEN: Top 6+ within 20 points, anyone's race
 * - CHALKY: Top 2 separated from field, but close to each other
 *
 * Confidence Impact (for bet sizing, NOT score adjustment):
 * - DOMINANT: HIGH confidence in top pick → smaller boxes, key play
 * - SEPARATED: MEDIUM-HIGH confidence → moderate box sizes
 * - COMPETITIVE: MEDIUM confidence → wider boxes recommended
 * - WIDE_OPEN: LOW confidence → consider sitting out or max spread
 *
 * This is a purely algorithmic, deterministic replacement for the AI
 * Field Spread Bot. Same inputs always produce same outputs.
 *
 * @module fieldSpread
 */

import {
  FIELD_SPREAD_CONFIG,
  FIELD_TYPE_DEFINITIONS,
  BETTING_CONFIDENCE_DEFINITIONS,
} from './constants/fieldSpread';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Field type classification based on score separation
 */
export type FieldType = 'DOMINANT' | 'SEPARATED' | 'COMPETITIVE' | 'WIDE_OPEN' | 'CHALKY';

/**
 * Betting confidence level
 */
export type BettingConfidence = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';

/**
 * Score gaps between ranked horses
 */
export interface ScoreGaps {
  first_to_second: number;
  second_to_third: number;
  third_to_fourth: number;
  fourth_to_fifth: number;
  first_to_fourth: number; // Key metric for box 4
  first_to_fifth: number; // Key metric for box 5
}

/**
 * Tier assignments for horses
 */
export interface TierAssignments {
  A: number[]; // Program numbers - clear win contenders
  B: number[]; // Board threats
  C: number[]; // Need pace/trip help
  X: number[]; // Likely non-factors
}

/**
 * Adjustment applied to a horse based on field spread
 *
 * @deprecated v3.8 - Score adjustments removed to eliminate circular logic.
 * This interface is preserved for backward compatibility but the adjustments
 * array in FieldSpreadResult is now always empty.
 */
export interface FieldSpreadAdjustment {
  programNumber: number;
  horseName: string;
  /** @deprecated v3.8 - Always 0. Score adjustments removed. */
  adjustment: number;
  reason: string;
}

/**
 * Recommended box sizes for exotic bets
 */
export interface BoxSizeRecommendation {
  exacta: number;
  trifecta: number;
  superfecta: number;
}

/**
 * Input horse data for field spread analysis
 */
export interface RankedHorseInput {
  programNumber: number;
  horseName: string;
  totalScore: number;
  rank: number;
}

/**
 * Complete field spread analysis result
 *
 * v3.8 UPDATE: Score adjustments removed.
 * This result is now INFORMATIONAL ONLY for bet construction.
 * The adjustments array is always empty.
 */
export interface FieldSpreadResult {
  /** Field type classification (DOMINANT, CHALKY, SEPARATED, COMPETITIVE, WIDE_OPEN) */
  fieldType: FieldType;
  /** Betting confidence level for bet sizing decisions */
  confidence: BettingConfidence;

  // Score analysis (for informational display)
  topScore: number;
  scoreGaps: ScoreGaps;

  // Tier assignments (for keying strategy)
  tiers: TierAssignments;

  /**
   * @deprecated v3.8 - Always empty array. Score adjustments removed.
   * Preserved for interface compatibility.
   */
  adjustments: FieldSpreadAdjustment[];

  // Recommendations (for bet construction)
  recommendedBoxSize: BoxSizeRecommendation;

  /** Whether to consider sitting out this race (for pass/play decisions) */
  sitOutFlag: boolean;
  sitOutReason: string | null;

  reason: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate score gaps between ranked horses
 *
 * @param sorted - Horses sorted by score descending
 * @returns Score gaps object
 */
function calculateScoreGaps(sorted: RankedHorseInput[]): ScoreGaps {
  const first = sorted[0];
  const second = sorted[1];
  const third = sorted[2];
  const fourth = sorted[3];
  const fifth = sorted[4];

  return {
    first_to_second: (first?.totalScore ?? 0) - (second?.totalScore ?? 0),
    second_to_third: (second?.totalScore ?? 0) - (third?.totalScore ?? 0),
    third_to_fourth: (third?.totalScore ?? 0) - (fourth?.totalScore ?? 0),
    fourth_to_fifth: (fourth?.totalScore ?? 0) - (fifth?.totalScore ?? 0),
    first_to_fourth: (first?.totalScore ?? 0) - (fourth?.totalScore ?? 0),
    first_to_fifth: (first?.totalScore ?? 0) - (fifth?.totalScore ?? 0),
  };
}

/**
 * Determine field type based on score gaps
 *
 * @param gaps - Score gaps between horses
 * @param sorted - Horses sorted by score descending
 * @returns Field type classification
 */
function determineFieldType(gaps: ScoreGaps, sorted: RankedHorseInput[]): FieldType {
  // DOMINANT: #1 leads by 25+ over #2
  if (gaps.first_to_second >= FIELD_SPREAD_CONFIG.DOMINANT_GAP) {
    return 'DOMINANT';
  }

  // CHALKY: Top 2 close to each other (<10), but 15+ over #3
  if (
    gaps.first_to_second < FIELD_SPREAD_CONFIG.CHALKY_TOP2_MAX &&
    gaps.second_to_third >= FIELD_SPREAD_CONFIG.CHALKY_TO_FIELD
  ) {
    return 'CHALKY';
  }

  // WIDE_OPEN: Top 6 within 20 points (need at least 6 horses)
  if (sorted.length >= FIELD_SPREAD_CONFIG.WIDE_OPEN_MIN_FIELD_SIZE) {
    const first = sorted[0];
    const sixth = sorted[5];
    const last = sorted[sorted.length - 1];
    if (first && (sixth || last)) {
      const top6Range = first.totalScore - (sixth?.totalScore ?? last?.totalScore ?? 0);
      if (top6Range <= FIELD_SPREAD_CONFIG.WIDE_OPEN_RANGE) {
        return 'WIDE_OPEN';
      }
    }
  }

  // COMPETITIVE: Top 4 within 15 points
  if (gaps.first_to_fourth <= FIELD_SPREAD_CONFIG.COMPETITIVE_RANGE) {
    return 'COMPETITIVE';
  }

  // SEPARATED: Clear tier structure (15+ gaps somewhere)
  if (
    gaps.first_to_second >= FIELD_SPREAD_CONFIG.SEPARATED_GAP ||
    gaps.second_to_third >= FIELD_SPREAD_CONFIG.SEPARATED_GAP ||
    gaps.third_to_fourth >= FIELD_SPREAD_CONFIG.SEPARATED_GAP
  ) {
    return 'SEPARATED';
  }

  // Default to COMPETITIVE
  return 'COMPETITIVE';
}

/**
 * Assign horses to tiers based on distance from leader
 *
 * @param sorted - Horses sorted by score descending
 * @param _gaps - Score gaps (unused but available for future enhancements)
 * @returns Tier assignments
 */
function assignTiers(sorted: RankedHorseInput[], _gaps: ScoreGaps): TierAssignments {
  const tiers: TierAssignments = { A: [], B: [], C: [], X: [] };

  const first = sorted[0];
  if (!first) return tiers;

  const topScore = first.totalScore;

  for (const horse of sorted) {
    const diff = topScore - horse.totalScore;

    // A tier: Within 15 points of leader, max 4 horses
    if (
      diff <= FIELD_SPREAD_CONFIG.TIER_A_MAX &&
      tiers.A.length < FIELD_SPREAD_CONFIG.MAX_A_TIER_SIZE
    ) {
      tiers.A.push(horse.programNumber);
    }
    // B tier: 16-30 points back
    else if (diff <= FIELD_SPREAD_CONFIG.TIER_B_MAX) {
      tiers.B.push(horse.programNumber);
    }
    // C tier: 31-45 points back
    else if (diff <= FIELD_SPREAD_CONFIG.TIER_C_MAX) {
      tiers.C.push(horse.programNumber);
    }
    // X tier: 46+ points back
    else {
      tiers.X.push(horse.programNumber);
    }
  }

  return tiers;
}

/**
 * Calculate betting confidence based on field type and gaps
 *
 * @param fieldType - The field type classification
 * @param gaps - Score gaps between horses
 * @returns Betting confidence level
 */
function calculateConfidence(fieldType: FieldType, gaps: ScoreGaps): BettingConfidence {
  switch (fieldType) {
    case 'DOMINANT':
      return gaps.first_to_second >= 35 ? 'VERY_HIGH' : 'HIGH';

    case 'CHALKY':
      return 'HIGH'; // Top 2 are clear

    case 'SEPARATED':
      return gaps.first_to_second >= 20 ? 'HIGH' : 'MEDIUM';

    case 'COMPETITIVE':
      return gaps.first_to_fourth >= 10 ? 'MEDIUM' : 'LOW';

    case 'WIDE_OPEN':
      return 'VERY_LOW';

    default:
      return 'MEDIUM';
  }
}

/**
 * Calculate score adjustments based on field type
 *
 * REMOVED (v3.8): Score adjustments were removed to eliminate circular logic.
 * Boosting a dominant leader because they're dominant just confirms what was
 * already calculated. Field spread analysis now provides INFORMATIONAL value
 * only (field type, tier assignments, bet construction recommendations).
 *
 * This function now always returns an empty array. The adjustment infrastructure
 * is preserved for backward compatibility with interfaces and display code.
 *
 * Previous adjustments that were removed:
 * - DOMINANT: +3 pts to leader (circular - already ranked #1)
 * - CHALKY: +2 pts to top 2 (circular - already ranked top)
 * - SEPARATED: +2 pts to leader (circular - already ranked #1)
 * - WIDE_OPEN: -2 pts to leader, +1 to 4th/5th (manipulated rankings)
 *
 * @param _sorted - Horses sorted by score descending (unused)
 * @param _fieldType - The field type classification (unused)
 * @param _gaps - Score gaps between horses (unused)
 * @returns Empty array - adjustments removed to eliminate circular logic
 */
function calculateFieldAdjustments(
  _sorted: RankedHorseInput[],
  _fieldType: FieldType,
  _gaps: ScoreGaps
): FieldSpreadAdjustment[] {
  // v3.8: Score adjustments removed - field spread is now informational only
  // Field type detection and tier assignments are still calculated and returned
  // for bet construction (box sizes, keying strategy, sit-out triggers)
  return [];
}

/**
 * Determine recommended box sizes based on field type
 *
 * @param fieldType - The field type classification
 * @param fieldSize - Total number of horses in the field
 * @returns Recommended box sizes for exotic bets
 */
function determineBoxSizes(fieldType: FieldType, fieldSize: number): BoxSizeRecommendation {
  let baseRecommendation: BoxSizeRecommendation;

  switch (fieldType) {
    case 'DOMINANT':
      baseRecommendation = { exacta: 3, trifecta: 4, superfecta: 5 };
      break;

    case 'CHALKY':
      baseRecommendation = { exacta: 3, trifecta: 4, superfecta: 5 };
      break;

    case 'SEPARATED':
      baseRecommendation = { exacta: 4, trifecta: 5, superfecta: 6 };
      break;

    case 'COMPETITIVE':
      baseRecommendation = { exacta: 4, trifecta: 5, superfecta: 6 };
      break;

    case 'WIDE_OPEN':
      baseRecommendation = { exacta: 5, trifecta: 6, superfecta: 7 };
      break;

    default:
      baseRecommendation = { exacta: 4, trifecta: 5, superfecta: 6 };
  }

  // Cap box sizes to field size - can't use more horses than available
  return {
    exacta: Math.min(baseRecommendation.exacta, fieldSize),
    trifecta: Math.min(baseRecommendation.trifecta, fieldSize),
    superfecta: Math.min(baseRecommendation.superfecta, fieldSize),
  };
}

/**
 * Check for sit-out conditions
 *
 * @param fieldType - The field type classification
 * @param gaps - Score gaps between horses
 * @param sorted - Horses sorted by score descending
 * @returns Sit-out flag and reason
 */
function checkSitOutConditions(
  fieldType: FieldType,
  gaps: ScoreGaps,
  sorted: RankedHorseInput[]
): { sitOutFlag: boolean; sitOutReason: string | null } {
  const first = sorted[0];
  if (!first) return { sitOutFlag: false, sitOutReason: null };

  // Sit out if top score is below 140 (no confident contenders)
  if (first.totalScore < FIELD_SPREAD_CONFIG.MIN_TOP_SCORE) {
    return {
      sitOutFlag: true,
      sitOutReason: `Top score (${first.totalScore}) below confidence threshold (${FIELD_SPREAD_CONFIG.MIN_TOP_SCORE})`,
    };
  }

  // Sit out if WIDE_OPEN and top 4 are within 8 points (true coin flip)
  if (
    fieldType === 'WIDE_OPEN' &&
    gaps.first_to_fourth <= FIELD_SPREAD_CONFIG.EXTREME_TIGHT_RANGE
  ) {
    return {
      sitOutFlag: true,
      sitOutReason: `Extremely tight field, top 4 within ${gaps.first_to_fourth} points`,
    };
  }

  return { sitOutFlag: false, sitOutReason: null };
}

/**
 * Generate human-readable reason for the field spread result
 *
 * @param fieldType - The field type classification
 * @param gaps - Score gaps between horses
 * @returns Reason string
 */
function generateFieldReason(fieldType: FieldType, gaps: ScoreGaps): string {
  switch (fieldType) {
    case 'DOMINANT':
      return `Dominant leader by ${gaps.first_to_second} points, high confidence`;
    case 'CHALKY':
      return `Top 2 separated from field by ${gaps.second_to_third}+ points`;
    case 'SEPARATED':
      return `Clear tier structure, ${gaps.first_to_fourth} point spread in top 4`;
    case 'COMPETITIVE':
      return `Competitive field, top 4 within ${gaps.first_to_fourth} points`;
    case 'WIDE_OPEN':
      return `Wide open field, minimal separation, high variance`;
    default:
      return 'Field type unclear';
  }
}

/**
 * Create result for small fields (fewer than 4 horses)
 *
 * @param horses - Array of horses
 * @returns Field spread result for small field
 */
function createSmallFieldResult(horses: RankedHorseInput[]): FieldSpreadResult {
  return {
    fieldType: 'COMPETITIVE',
    confidence: 'MEDIUM',
    topScore: horses[0]?.totalScore ?? 0,
    scoreGaps: {
      first_to_second: 0,
      second_to_third: 0,
      third_to_fourth: 0,
      fourth_to_fifth: 0,
      first_to_fourth: 0,
      first_to_fifth: 0,
    },
    tiers: {
      A: horses.map((h) => h.programNumber),
      B: [],
      C: [],
      X: [],
    },
    adjustments: [],
    recommendedBoxSize: {
      exacta: horses.length,
      trifecta: horses.length,
      superfecta: horses.length,
    },
    sitOutFlag: false,
    sitOutReason: null,
    reason: 'Small field, all horses competitive',
  };
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze field spread for a race
 *
 * Evaluates score separation between top horses to determine betting
 * confidence and identify competitive vs dominant fields.
 *
 * @param rankedHorses - Array of horses with scores and rankings
 * @returns Complete field spread analysis result
 */
export function analyzeFieldSpread(rankedHorses: RankedHorseInput[]): FieldSpreadResult {
  // Handle small fields
  if (rankedHorses.length < 4) {
    return createSmallFieldResult(rankedHorses);
  }

  // Sort by score (should already be sorted, but ensure)
  const sorted = [...rankedHorses].sort((a, b) => b.totalScore - a.totalScore);

  // Calculate gaps
  const scoreGaps = calculateScoreGaps(sorted);

  // Determine field type
  const fieldType = determineFieldType(scoreGaps, sorted);

  // Assign tiers
  const tiers = assignTiers(sorted, scoreGaps);

  // Calculate confidence
  const confidence = calculateConfidence(fieldType, scoreGaps);

  // Calculate adjustments (boost dominant leaders, penalize in wide open)
  const adjustments = calculateFieldAdjustments(sorted, fieldType, scoreGaps);

  // Determine recommended box sizes
  const recommendedBoxSize = determineBoxSizes(fieldType, sorted.length);

  // Check for sit-out conditions
  const { sitOutFlag, sitOutReason } = checkSitOutConditions(fieldType, scoreGaps, sorted);

  return {
    fieldType,
    confidence,
    topScore: sorted[0]?.totalScore ?? 0,
    scoreGaps,
    tiers,
    adjustments,
    recommendedBoxSize,
    sitOutFlag,
    sitOutReason,
    reason: generateFieldReason(fieldType, scoreGaps),
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the tier assignment for a specific horse
 *
 * @param result - Field spread result
 * @param programNumber - Horse's program number
 * @returns Tier ('A', 'B', 'C', 'X') or null if not found
 */
export function getHorseTier(
  result: FieldSpreadResult,
  programNumber: number
): 'A' | 'B' | 'C' | 'X' | null {
  if (result.tiers.A.includes(programNumber)) return 'A';
  if (result.tiers.B.includes(programNumber)) return 'B';
  if (result.tiers.C.includes(programNumber)) return 'C';
  if (result.tiers.X.includes(programNumber)) return 'X';
  return null;
}

/**
 * Get the adjustment for a specific horse
 *
 * @param result - Field spread result
 * @param programNumber - Horse's program number
 * @returns Adjustment points (positive or negative) or 0 if none
 */
export function getFieldSpreadAdjustment(result: FieldSpreadResult, programNumber: number): number {
  const adj = result.adjustments.find((a) => a.programNumber === programNumber);
  return adj?.adjustment ?? 0;
}

/**
 * Check if field spread has significant betting implications
 *
 * @param result - Field spread result
 * @returns True if field type affects betting strategy
 */
export function hasSignificantFieldSpread(result: FieldSpreadResult): boolean {
  return result.fieldType === 'DOMINANT' || result.fieldType === 'WIDE_OPEN' || result.sitOutFlag;
}

/**
 * Get display information for a field type
 *
 * @param fieldType - The field type
 * @returns Display information
 */
export function getFieldTypeDisplayInfo(fieldType: FieldType): {
  name: string;
  description: string;
  color: string;
} {
  return FIELD_TYPE_DEFINITIONS[fieldType];
}

/**
 * Get display information for a confidence level
 *
 * @param confidence - The confidence level
 * @returns Display information
 */
export function getConfidenceDisplayInfo(confidence: BettingConfidence): {
  name: string;
  description: string;
  color: string;
} {
  return BETTING_CONFIDENCE_DEFINITIONS[confidence];
}

/**
 * Get color for field spread based on confidence
 *
 * @param confidence - The confidence level
 * @returns CSS color string
 */
export function getFieldSpreadColor(confidence: BettingConfidence): string {
  return BETTING_CONFIDENCE_DEFINITIONS[confidence].color;
}

/**
 * Get summary string for field spread
 *
 * @param result - Field spread result
 * @returns Human-readable summary
 */
export function getFieldSpreadSummary(result: FieldSpreadResult): string {
  const typeInfo = getFieldTypeDisplayInfo(result.fieldType);
  const confInfo = getConfidenceDisplayInfo(result.confidence);

  if (result.sitOutFlag) {
    return `${typeInfo.name} (${confInfo.name}) - SIT OUT: ${result.sitOutReason}`;
  }

  return `${typeInfo.name} (${confInfo.name}): ${result.reason}`;
}

/**
 * Log field spread analysis for debugging
 *
 * @param result - Field spread result
 */
export function logFieldSpreadAnalysis(result: FieldSpreadResult): void {
  console.log(`[FIELD_SPREAD] ${result.fieldType} (${result.confidence})`);
  console.log(`[FIELD_SPREAD] ${result.reason}`);
  console.log(
    `[FIELD_SPREAD] Score gaps: 1st-2nd: ${result.scoreGaps.first_to_second}, 1st-4th: ${result.scoreGaps.first_to_fourth}`
  );
  console.log(
    `[FIELD_SPREAD] Tiers - A: ${result.tiers.A.length}, B: ${result.tiers.B.length}, C: ${result.tiers.C.length}, X: ${result.tiers.X.length}`
  );
  console.log(
    `[FIELD_SPREAD] Recommended box: exacta ${result.recommendedBoxSize.exacta}, tri ${result.recommendedBoxSize.trifecta}, super ${result.recommendedBoxSize.superfecta}`
  );

  if (result.sitOutFlag) {
    console.log(`[FIELD_SPREAD] ⚠️ SIT OUT: ${result.sitOutReason}`);
  }

  for (const adj of result.adjustments) {
    const sign = adj.adjustment > 0 ? '+' : '';
    console.log(`[FIELD_SPREAD] ${sign}${adj.adjustment} ${adj.horseName}: ${adj.reason}`);
  }
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export {
  FIELD_SPREAD_CONFIG,
  FIELD_TYPE_DEFINITIONS,
  BETTING_CONFIDENCE_DEFINITIONS,
} from './constants/fieldSpread';
