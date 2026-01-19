/**
 * Place/Show Probability Estimator
 *
 * Estimates place (1st or 2nd) and show (1st, 2nd, or 3rd) probabilities
 * based on win probability and field size.
 *
 * These are approximations based on empirical research:
 * - Place probability ≈ win probability × 1.8 for 8+ horse fields
 * - Show probability ≈ win probability × 2.5 for 8+ horse fields
 *
 * Adjustments are made for field size:
 * - Smaller fields: lower multipliers (fewer positions available proportionally)
 * - Larger fields: multipliers approach the empirical constants
 *
 * Note: Place/show pools have different dynamics than win pools.
 * These estimates are useful for bet recommendation but should be
 * used with caution. Actual place/show probabilities depend on
 * the specific field composition and betting patterns.
 *
 * @module betting/placeShowEstimator
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Confidence level for estimates
 */
export type EstimateConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Place/show probability estimate
 */
export interface PlaceShowEstimate {
  /** Estimated probability (0-1) */
  probability: number;
  /** Confidence in the estimate */
  confidence: EstimateConfidence;
  /** Multiplier used (for debugging) */
  multiplierUsed: number;
  /** Base win probability used */
  baseWinProbability: number;
  /** Field size used */
  fieldSize: number;
  /** Whether this is a reasonable estimate */
  isReasonable: boolean;
  /** Warning message if applicable */
  warning?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Base multiplier for place probability (1st or 2nd)
 * Empirically derived from large samples of race results
 */
const PLACE_BASE_MULTIPLIER = 1.8;

/**
 * Base multiplier for show probability (1st, 2nd, or 3rd)
 */
const SHOW_BASE_MULTIPLIER = 2.5;

/**
 * Minimum field size for full multiplier application
 */
const MIN_FULL_MULTIPLIER_FIELD_SIZE = 8;

/**
 * Maximum probability to return (can't exceed 100%)
 */
const MAX_PROBABILITY = 0.95;

/**
 * Minimum probability to return
 */
const MIN_PROBABILITY = 0.01;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Estimate place probability (1st or 2nd place)
 *
 * Uses approximation: P(place) ≈ P(win) × multiplier
 * Multiplier varies with field size:
 * - 5 horses: ~1.4
 * - 6 horses: ~1.5
 * - 7 horses: ~1.65
 * - 8+ horses: ~1.8
 *
 * @param winProbability - Win probability (0-1)
 * @param fieldSize - Number of horses in the race
 * @returns Place probability estimate
 *
 * @example
 * // 25% win probability in an 8-horse field
 * const estimate = estimatePlaceProbability(0.25, 8);
 * // estimate.probability ≈ 0.45 (45%)
 */
export function estimatePlaceProbability(
  winProbability: number,
  fieldSize: number
): PlaceShowEstimate {
  // Validate inputs
  if (winProbability <= 0 || winProbability >= 1) {
    return {
      probability: 0,
      confidence: 'LOW',
      multiplierUsed: 0,
      baseWinProbability: winProbability,
      fieldSize,
      isReasonable: false,
      warning: `Invalid win probability: ${winProbability}`,
    };
  }

  if (fieldSize < 2) {
    return {
      probability: winProbability, // Only position available
      confidence: 'HIGH',
      multiplierUsed: 1,
      baseWinProbability: winProbability,
      fieldSize,
      isReasonable: false,
      warning: 'Field too small for place betting',
    };
  }

  // Calculate field-adjusted multiplier
  const multiplier = calculatePlaceMultiplier(fieldSize);

  // Calculate raw probability
  let rawProbability = winProbability * multiplier;

  // Apply maximum cap
  rawProbability = Math.min(MAX_PROBABILITY, rawProbability);
  rawProbability = Math.max(MIN_PROBABILITY, rawProbability);

  // Determine confidence
  const confidence = determineConfidence(winProbability, fieldSize, 'PLACE');

  // Check if estimate is reasonable
  const isReasonable = rawProbability > winProbability && rawProbability < 1;

  return {
    probability: rawProbability,
    confidence,
    multiplierUsed: multiplier,
    baseWinProbability: winProbability,
    fieldSize,
    isReasonable,
    warning: !isReasonable
      ? 'Estimate may be unreliable for this probability/field combination'
      : undefined,
  };
}

/**
 * Estimate show probability (1st, 2nd, or 3rd place)
 *
 * Uses approximation: P(show) ≈ P(win) × multiplier
 * Multiplier varies with field size:
 * - 5 horses: ~1.8 (60% of field finishes ITM)
 * - 6 horses: ~2.0
 * - 7 horses: ~2.2
 * - 8+ horses: ~2.5
 *
 * @param winProbability - Win probability (0-1)
 * @param fieldSize - Number of horses in the race
 * @returns Show probability estimate
 *
 * @example
 * // 25% win probability in an 8-horse field
 * const estimate = estimateShowProbability(0.25, 8);
 * // estimate.probability ≈ 0.625 (62.5%)
 */
export function estimateShowProbability(
  winProbability: number,
  fieldSize: number
): PlaceShowEstimate {
  // Validate inputs
  if (winProbability <= 0 || winProbability >= 1) {
    return {
      probability: 0,
      confidence: 'LOW',
      multiplierUsed: 0,
      baseWinProbability: winProbability,
      fieldSize,
      isReasonable: false,
      warning: `Invalid win probability: ${winProbability}`,
    };
  }

  if (fieldSize < 3) {
    // With 2 horses, show = place = win probability conceptually
    const actualProb = fieldSize === 2 ? winProbability : 1;
    return {
      probability: actualProb,
      confidence: 'HIGH',
      multiplierUsed: 1,
      baseWinProbability: winProbability,
      fieldSize,
      isReasonable: false,
      warning: 'Field too small for show betting',
    };
  }

  // Calculate field-adjusted multiplier
  const multiplier = calculateShowMultiplier(fieldSize);

  // Calculate raw probability
  let rawProbability = winProbability * multiplier;

  // Apply maximum cap
  rawProbability = Math.min(MAX_PROBABILITY, rawProbability);
  rawProbability = Math.max(MIN_PROBABILITY, rawProbability);

  // Determine confidence
  const confidence = determineConfidence(winProbability, fieldSize, 'SHOW');

  // Check if estimate is reasonable
  const isReasonable = rawProbability > winProbability && rawProbability < 1;

  return {
    probability: rawProbability,
    confidence,
    multiplierUsed: multiplier,
    baseWinProbability: winProbability,
    fieldSize,
    isReasonable,
    warning: !isReasonable
      ? 'Estimate may be unreliable for this probability/field combination'
      : undefined,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate place multiplier based on field size
 *
 * For place (top 2), the multiplier represents how much more likely
 * a horse is to finish top 2 compared to winning outright.
 *
 * Derived from the logic that in an N-horse field:
 * - If all horses were equal, P(place) = 2/N
 * - A better horse has proportionally better chances
 * - The multiplier interpolates based on field composition
 */
function calculatePlaceMultiplier(fieldSize: number): number {
  if (fieldSize <= 2) return 1; // Can't have place with only 1-2 horses meaningfully

  if (fieldSize >= MIN_FULL_MULTIPLIER_FIELD_SIZE) {
    return PLACE_BASE_MULTIPLIER;
  }

  // Linear interpolation from smaller fields to full multiplier
  // At 3 horses: ~1.2
  // At 4 horses: ~1.3
  // At 5 horses: ~1.4
  // At 6 horses: ~1.5
  // At 7 horses: ~1.65
  // At 8+ horses: 1.8

  const minMultiplier = 1.2;
  const ratio = (fieldSize - 3) / (MIN_FULL_MULTIPLIER_FIELD_SIZE - 3);
  return minMultiplier + ratio * (PLACE_BASE_MULTIPLIER - minMultiplier);
}

/**
 * Calculate show multiplier based on field size
 *
 * For show (top 3), similar logic to place but with wider spread.
 */
function calculateShowMultiplier(fieldSize: number): number {
  if (fieldSize <= 3) return 1; // All horses show with 3 or fewer

  if (fieldSize >= MIN_FULL_MULTIPLIER_FIELD_SIZE) {
    return SHOW_BASE_MULTIPLIER;
  }

  // Linear interpolation
  // At 4 horses: ~1.5 (75% chance to show, slightly better than 3/4)
  // At 5 horses: ~1.8
  // At 6 horses: ~2.0
  // At 7 horses: ~2.2
  // At 8+ horses: 2.5

  const minMultiplier = 1.5;
  const ratio = (fieldSize - 4) / (MIN_FULL_MULTIPLIER_FIELD_SIZE - 4);
  return minMultiplier + ratio * (SHOW_BASE_MULTIPLIER - minMultiplier);
}

/**
 * Determine confidence level for an estimate
 */
function determineConfidence(
  winProbability: number,
  fieldSize: number,
  _betType: 'PLACE' | 'SHOW'
): EstimateConfidence {
  // High confidence: Standard field size, reasonable probability
  if (fieldSize >= 8 && winProbability >= 0.1 && winProbability <= 0.4) {
    return 'HIGH';
  }

  // Medium confidence: Slightly off standard
  if (fieldSize >= 6 && winProbability >= 0.05 && winProbability <= 0.5) {
    return 'MEDIUM';
  }

  // Low confidence: Edge cases
  return 'LOW';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate expected payout multiplier for place/show
 *
 * Place pools typically pay less than win pools.
 * Rough estimates:
 * - Place pays ~40% of win odds
 * - Show pays ~20% of win odds
 *
 * @param winOdds - Decimal win odds
 * @param betType - PLACE or SHOW
 * @returns Estimated decimal odds
 */
export function estimatePlaceShowOdds(winOdds: number, betType: 'PLACE' | 'SHOW'): number {
  const profit = winOdds - 1; // Win odds profit component

  if (betType === 'PLACE') {
    // Place typically pays about 40% of win profit
    return 1 + profit * 0.4;
  }

  // Show typically pays about 20% of win profit
  return 1 + profit * 0.2;
}

/**
 * Calculate expected value for a place/show bet
 *
 * @param estimate - Place/show probability estimate
 * @param estimatedOdds - Estimated decimal odds for place/show
 * @returns Expected value per $1 bet
 */
export function calculatePlaceShowEV(estimate: PlaceShowEstimate, estimatedOdds: number): number {
  return estimate.probability * estimatedOdds - 1;
}

/**
 * Recommend whether to bet place/show instead of win
 *
 * @param winProbability - Win probability
 * @param winOdds - Decimal win odds
 * @param fieldSize - Field size
 * @returns Recommendation with reasoning
 */
export function recommendPlaceShowVsWin(
  winProbability: number,
  winOdds: number,
  fieldSize: number
): {
  recommendation: 'WIN' | 'PLACE' | 'SHOW' | 'PASS';
  reasoning: string;
} {
  const winEV = winProbability * winOdds - 1;

  const placeEstimate = estimatePlaceProbability(winProbability, fieldSize);
  const placeOdds = estimatePlaceShowOdds(winOdds, 'PLACE');
  const placeEV = calculatePlaceShowEV(placeEstimate, placeOdds);

  const showEstimate = estimateShowProbability(winProbability, fieldSize);
  const showOdds = estimatePlaceShowOdds(winOdds, 'SHOW');
  const showEV = calculatePlaceShowEV(showEstimate, showOdds);

  // All negative EV - pass
  if (winEV < 0 && placeEV < 0 && showEV < 0) {
    return {
      recommendation: 'PASS',
      reasoning: 'No positive EV opportunity',
    };
  }

  // Compare EVs
  if (winEV >= placeEV && winEV >= showEV && winEV > 0) {
    return {
      recommendation: 'WIN',
      reasoning: `Win bet has best EV (${(winEV * 100).toFixed(1)}%)`,
    };
  }

  if (placeEV > showEV && placeEV > 0) {
    return {
      recommendation: 'PLACE',
      reasoning: `Place bet has better EV (${(placeEV * 100).toFixed(1)}% vs ${(winEV * 100).toFixed(1)}% win)`,
    };
  }

  if (showEV > 0) {
    return {
      recommendation: 'SHOW',
      reasoning: `Show bet offers positive EV (${(showEV * 100).toFixed(1)}%)`,
    };
  }

  return {
    recommendation: 'WIN',
    reasoning: 'Win bet is the best available option',
  };
}

/**
 * Format place/show estimate for display
 */
export function formatPlaceShowEstimate(estimate: PlaceShowEstimate): {
  probability: string;
  confidence: string;
  warning: string | null;
} {
  return {
    probability: `${(estimate.probability * 100).toFixed(1)}%`,
    confidence: estimate.confidence,
    warning: estimate.warning ?? null,
  };
}
