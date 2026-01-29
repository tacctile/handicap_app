/**
 * Rank Utility Functions
 *
 * Calculates projected finish order based on base score (X/319)
 * and provides dynamic gradient coloring based on field size.
 *
 * v3.7: Updated for 319 base score (odds removed from base scoring)
 *
 * @module scoring/rankUtils
 */

import type { ScoredHorse } from './index';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Primary color for 1st place (teal) */
const RANK_COLOR_FIRST = '#19abb5';

/** Color for last place (muted gray) */
const RANK_COLOR_LAST = '#555555';

// ============================================================================
// ORDINAL FORMATTING
// ============================================================================

/**
 * Convert a number to its ordinal string representation
 *
 * @param n - The number to convert (1-based rank)
 * @returns Ordinal string (e.g., "1st", "2nd", "3rd", "4th")
 *
 * @example
 * toOrdinal(1)  // "1st"
 * toOrdinal(2)  // "2nd"
 * toOrdinal(3)  // "3rd"
 * toOrdinal(4)  // "4th"
 * toOrdinal(11) // "11th"
 * toOrdinal(21) // "21st"
 * toOrdinal(22) // "22nd"
 * toOrdinal(23) // "23rd"
 */
export function toOrdinal(n: number): string {
  // Handle edge cases
  if (!Number.isFinite(n) || n < 1) {
    return '—';
  }

  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;

  // Special case for 11, 12, 13 which all use 'th'
  if (v >= 11 && v <= 13) {
    return `${n}th`;
  }

  // Use the appropriate suffix based on last digit
  return `${n}${s[v % 10] || 'th'}`;
}

// ============================================================================
// RANK CALCULATION
// ============================================================================

/**
 * Interface for rank info attached to each horse
 */
export interface RankInfo {
  /** The rank position (1 = first, 2 = second, etc.) */
  rank: number;
  /** The ordinal string (e.g., "1st", "2nd") */
  ordinal: string;
  /** The gradient color based on position in field */
  color: string;
  /** Total active horses in the field (for gradient calculation) */
  fieldSize: number;
}

/**
 * Calculate ranks based on BASE SCORE (X/319) with full tie-breaker chain
 *
 * Model B Final: Uses deterministic tie-breaker chain to ensure UNIQUE ranks.
 * No more "1st (tie)" situations - every horse gets a distinct rank.
 *
 * This function:
 * 1. Filters to non-scratched horses only
 * 2. Sorts by baseScore with tie-breaker chain (Speed → Pace → Form → Post)
 * 3. Assigns SEQUENTIAL ranks (1, 2, 3, 4...) - no ties
 * 4. Calculates gradient color for each rank
 *
 * TIE-BREAKER CHAIN (Model B Final):
 * 1. Base Score (Descending) - Primary ranking (includes Paper Tiger penalty)
 * 2. Speed Score (Descending) - Intrinsic ability wins ties
 * 3. Pace Score (Descending) - Running style advantage
 * 4. Form Score (Descending) - Current condition
 * 5. Post Position (Ascending) - Final deterministic resolution
 *
 * @param scoredHorses - Array of ScoredHorse objects
 * @returns Map of horse index to RankInfo
 *
 * @example
 * const rankMap = calculateBaseScoreRanks(scoredHorses);
 * const horseRank = rankMap.get(0); // Get rank info for horse at index 0
 */
export function calculateBaseScoreRanks(scoredHorses: ScoredHorse[]): Map<number, RankInfo> {
  const rankMap = new Map<number, RankInfo>();

  // Filter to active (non-scratched) horses
  const activeHorses = scoredHorses.filter((h) => !h.score.isScratched);
  const fieldSize = activeHorses.length;

  if (fieldSize === 0) {
    return rankMap;
  }

  // Sort by BASE SCORE with full Tie-Breaker Chain (Model B Final)
  // Ensures every horse has a UNIQUE rank - no more duplicate ranks
  const sortedByBaseScore = [...activeHorses].sort((a, b) => {
    // 1. Primary: Base Score (descending)
    // Note: baseScore already includes the -100 Paper Tiger penalty
    const scoreDiff = b.score.baseScore - a.score.baseScore;
    if (scoreDiff !== 0) return scoreDiff;

    // 2. Tie-Breaker #1: Speed Score (descending) - Intrinsic Ability wins
    // Access structured breakdown data safely
    const speedA = a.score.breakdown?.speedClass?.speedScore ?? 0;
    const speedB = b.score.breakdown?.speedClass?.speedScore ?? 0;
    if (speedB !== speedA) return speedB - speedA;

    // 3. Tie-Breaker #2: Pace Score (descending) - Running Style wins
    const paceA = a.score.breakdown?.pace?.total ?? 0;
    const paceB = b.score.breakdown?.pace?.total ?? 0;
    if (paceB !== paceA) return paceB - paceA;

    // 4. Tie-Breaker #3: Form Score (descending) - Current Condition wins
    const formA = a.score.breakdown?.form?.total ?? 0;
    const formB = b.score.breakdown?.form?.total ?? 0;
    if (formB !== formA) return formB - formA;

    // 5. Final Resolution: Post Position (ascending) - Inside post wins
    return a.horse.postPosition - b.horse.postPosition;
  });

  // Assign SEQUENTIAL ranks (1, 2, 3, 4...) - no ties
  // Tie-breakers ensure deterministic unique order
  sortedByBaseScore.forEach((horse, sortIndex) => {
    // Calculate gradient color based on position in sorted order
    const color = calculateRankGradientColor(sortIndex, fieldSize);

    rankMap.set(horse.index, {
      rank: sortIndex + 1, // Sequential: 1, 2, 3, 4...
      ordinal: toOrdinal(sortIndex + 1),
      color,
      fieldSize,
    });
  });

  return rankMap;
}

// ============================================================================
// GRADIENT COLOR CALCULATION
// ============================================================================

/**
 * Parse a hex color to RGB components
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB components to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Interpolate between two colors based on a ratio
 *
 * @param color1 - Starting color (hex)
 * @param color2 - Ending color (hex)
 * @param ratio - Interpolation ratio (0 = color1, 1 = color2)
 * @returns Interpolated hex color
 */
function interpolateColor(color1: string, color2: string, ratio: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  const r = c1.r + (c2.r - c1.r) * ratio;
  const g = c1.g + (c2.g - c1.g) * ratio;
  const b = c1.b + (c2.b - c1.b) * ratio;

  return rgbToHex(r, g, b);
}

/**
 * Calculate the gradient color for a rank position
 *
 * Uses linear interpolation from RANK_COLOR_FIRST (teal) to RANK_COLOR_LAST (gray)
 * based on position in the sorted field.
 *
 * For a 6-horse field:
 * - Position 0 (1st): #19abb5 (full teal)
 * - Position 1 (2nd): 80% toward gray
 * - Position 2 (3rd): 60% toward gray
 * - Position 3 (4th): 40% toward gray
 * - Position 4 (5th): 20% toward gray
 * - Position 5 (6th): #555555 (full gray)
 *
 * @param position - 0-based position in sorted order (0 = best)
 * @param fieldSize - Total number of active horses
 * @returns Hex color string
 */
export function calculateRankGradientColor(position: number, fieldSize: number): string {
  // Handle edge cases
  if (fieldSize <= 1) {
    return RANK_COLOR_FIRST;
  }

  // Calculate ratio (0 for first, 1 for last)
  const ratio = position / (fieldSize - 1);

  return interpolateColor(RANK_COLOR_FIRST, RANK_COLOR_LAST, ratio);
}

/**
 * Get the rank color for a specific rank value given the field size
 * This is useful when you have the rank but not the sorted position
 *
 * @param rank - 1-based rank (1 = first place)
 * @param fieldSize - Total number of active horses
 * @returns Hex color string
 */
export function getRankColor(rank: number, fieldSize: number): string {
  // Convert 1-based rank to 0-based position
  const position = rank - 1;
  return calculateRankGradientColor(position, fieldSize);
}
