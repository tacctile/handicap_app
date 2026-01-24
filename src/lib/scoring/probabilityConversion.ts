/**
 * Softmax-Based Probability Conversion Module
 *
 * Converts raw scores to coherent win probabilities using softmax function.
 * Provides numerically stable implementation with configurable temperature.
 *
 * Why softmax over linear division?
 * - Naturally produces probabilities that sum to 1.0
 * - Provides smoother probability distributions
 * - Better handles score outliers (extreme favorites/longshots)
 * - Temperature parameter allows tuning probability spread
 *
 * Calibration Integration:
 * - When 500+ races are accumulated, Platt scaling calibration activates
 * - Calibration adjusts raw model probabilities to match actual win rates
 * - Use applyCalibration parameter to control (default: true when ready)
 *
 * @module scoring/probabilityConversion
 */

// ============================================================================
// IMPORTS
// ============================================================================

// Note: Calibration is imported lazily to avoid circular dependencies
// The calibrationManager is accessed via a getter function

/**
 * Lazy getter for calibration manager to avoid circular dependencies.
 * The calibrationManager is a singleton that tracks calibration state.
 */
let _calibrationManagerGetter:
  | (() => {
      calibrateField: (probs: number[]) => number[];
      isReady: boolean;
    })
  | null = null;

/**
 * Set the calibration manager getter (called by calibrationManager on init)
 * This allows the probability module to use calibration without circular imports.
 */
export function setCalibrationManagerGetter(
  getter: () => { calibrateField: (probs: number[]) => number[]; isReady: boolean }
): void {
  _calibrationManagerGetter = getter;
}

/**
 * Get the calibration manager (may be null if not initialized)
 */
function getCalibrationManager(): {
  calibrateField: (probs: number[]) => number[];
  isReady: boolean;
} | null {
  if (_calibrationManagerGetter) {
    return _calibrationManagerGetter();
  }
  return null;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Softmax configuration for probability conversion
 *
 * These defaults can be adjusted during calibration phase:
 * - temperature: 1.0 is standard; lower = more extreme distributions; higher = flatter
 * - minProbability: Floor to prevent 0% (every horse has some chance)
 * - maxProbability: Ceiling to prevent unrealistic certainty
 * - scoreScale: Divisor to normalize racing scores (0-331) to softmax-friendly range
 */
export const SOFTMAX_CONFIG = {
  /** Temperature parameter for softmax (1.0 = standard) */
  temperature: 1.0,
  /** Minimum probability floor (0.5% = 0.005) */
  minProbability: 0.005,
  /** Maximum probability ceiling (95% = 0.95) */
  maxProbability: 0.95,
  /** Score scaling factor - divides scores to normalize for softmax (100 works well for 0-331 range) */
  scoreScale: 100,
} as const;

/**
 * Debug flag - set DEBUG_PROBABILITY env var to enable logging
 * Safe for browser environments where process is not defined
 */
const DEBUG_ENABLED =
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as { process?: { env?: Record<string, string> } }).process !== 'undefined' &&
  (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.DEBUG_PROBABILITY ===
    'true';

/**
 * Type for softmax configuration values (allows number types for overrides)
 */
export type SoftmaxConfigType = {
  temperature: number;
  minProbability: number;
  maxProbability: number;
  scoreScale: number;
};

// ============================================================================
// CORE SOFTMAX FUNCTIONS
// ============================================================================

/**
 * Convert an array of scores to probabilities using softmax function.
 *
 * Softmax formula with numerical stability:
 * P(i) = e^((score_i - max_score) / temperature) / Σ e^((score_j - max_score) / temperature)
 *
 * Subtracting max_score before exponentiating prevents overflow for large scores.
 *
 * @param scores - Array of raw scores (0-331 typical range)
 * @param temperature - Temperature parameter (default: SOFTMAX_CONFIG.temperature)
 *   - temperature < 1.0: More extreme distribution (favorite gets higher %)
 *   - temperature = 1.0: Standard softmax
 *   - temperature > 1.0: Flatter distribution (closer to uniform)
 * @param applyCalibration - Whether to apply Platt scaling calibration if ready (default: true)
 *   - When true and calibration is ready (500+ races), probabilities are adjusted
 *   - When false or calibration not ready, returns raw softmax probabilities
 * @returns Array of probabilities in same order as input scores (sum to 1.0)
 *
 * @example
 * softmaxProbabilities([200, 150, 100, 80])
 * // Returns: [0.52, 0.28, 0.13, 0.07] (approximately)
 *
 * @example
 * // Temperature effects:
 * softmaxProbabilities([200, 150], 0.5)  // [0.73, 0.27] - more extreme
 * softmaxProbabilities([200, 150], 1.0)  // [0.62, 0.38] - standard
 * softmaxProbabilities([200, 150], 2.0)  // [0.56, 0.44] - flatter
 *
 * @example
 * // Disable calibration:
 * softmaxProbabilities([200, 150], 1.0, false)  // Raw softmax only
 */
export function softmaxProbabilities(
  scores: number[],
  temperature: number = SOFTMAX_CONFIG.temperature,
  applyCalibration: boolean = true
): number[] {
  // Edge case: empty array
  if (!scores || scores.length === 0) {
    if (DEBUG_ENABLED) {
      console.log('[softmax] Empty array received, returning []');
    }
    return [];
  }

  // Edge case: single horse gets 100% probability
  if (scores.length === 1) {
    if (DEBUG_ENABLED) {
      console.log('[softmax] Single horse, returning [1.0]');
    }
    return [1.0];
  }

  // Validate and sanitize scores
  const sanitizedScores = scores.map((s) => {
    if (!Number.isFinite(s) || s < 0) return 0;
    return s;
  });

  // Edge case: all zeros
  const allZeros = sanitizedScores.every((s) => s === 0);
  if (allZeros) {
    // Equal probability for all horses
    const equalProb = 1.0 / scores.length;
    if (DEBUG_ENABLED) {
      console.log('[softmax] All zeros, returning equal probabilities:', equalProb);
    }
    return scores.map(() => equalProb);
  }

  // Ensure temperature is positive
  const safeTemperature = Math.max(0.001, temperature);

  // Scale scores to softmax-friendly range (racing scores 0-331 → ~0-3.31)
  // This prevents exponential overflow and produces reasonable probability spreads
  const scaledScores = sanitizedScores.map((s) => s / SOFTMAX_CONFIG.scoreScale);

  // Find max scaled score for numerical stability
  const maxScore = Math.max(...scaledScores);

  // Calculate exp((score - max) / temperature) for each score
  const expScores = scaledScores.map((score) => {
    const adjustedScore = (score - maxScore) / safeTemperature;
    return Math.exp(adjustedScore);
  });

  // Sum of all exponentials
  const sumExp = expScores.reduce((sum, exp) => sum + exp, 0);

  // Calculate raw probabilities
  let rawProbabilities = expScores.map((exp) => exp / sumExp);

  // Debug logging before clamping
  if (DEBUG_ENABLED) {
    console.log('[softmax] Input scores:', sanitizedScores);
    console.log('[softmax] Temperature:', safeTemperature);
    console.log('[softmax] Raw softmax output:', rawProbabilities);
  }

  // Apply bounds (min/max probability)
  rawProbabilities = clampAndRedistribute(rawProbabilities);

  // Debug logging after clamping
  if (DEBUG_ENABLED) {
    console.log('[softmax] After clamping:', rawProbabilities);
  }

  // Apply Platt scaling calibration if enabled and ready
  if (applyCalibration) {
    const calibrationMgr = getCalibrationManager();
    if (calibrationMgr?.isReady) {
      const calibrated = calibrationMgr.calibrateField(rawProbabilities);
      if (DEBUG_ENABLED) {
        console.log('[softmax] After calibration:', calibrated);
      }
      return calibrated;
    }
  }

  return rawProbabilities;
}

/**
 * Get the probability for a single score within a field context.
 *
 * This is a convenience function that runs softmax on all field scores
 * and returns the probability for the specified score.
 *
 * @param score - The score to get probability for
 * @param fieldScores - All scores in the field (must include `score`)
 * @param temperature - Softmax temperature parameter
 * @returns Win probability for the specified score (0-1)
 */
export function scoreToProbability(
  score: number,
  fieldScores: number[],
  temperature: number = SOFTMAX_CONFIG.temperature
): number {
  if (!fieldScores || fieldScores.length === 0) {
    return SOFTMAX_CONFIG.minProbability;
  }

  // Find index of this score in field
  const index = fieldScores.indexOf(score);

  // If score not found, add it and recalculate
  const scoresToUse = index >= 0 ? fieldScores : [...fieldScores, score];
  const scoreIndex = index >= 0 ? index : scoresToUse.length - 1;

  const probabilities = softmaxProbabilities(scoresToUse, temperature);
  return probabilities[scoreIndex] ?? SOFTMAX_CONFIG.minProbability;
}

/**
 * Convert a probability to fair decimal odds.
 *
 * Fair odds represent the odds at which there is no edge either way.
 * Formula: Fair Decimal Odds = 1 / probability
 *
 * @param probability - Win probability (0-1)
 * @returns Fair decimal odds (e.g., 4.0 means 3/1 or +300)
 *
 * @example
 * probabilityToFairOdds(0.25)  // Returns 4.0 (3/1)
 * probabilityToFairOdds(0.50)  // Returns 2.0 (even money)
 * probabilityToFairOdds(0.10)  // Returns 10.0 (9/1)
 */
export function probabilityToFairOdds(probability: number): number {
  // Handle invalid input
  if (!Number.isFinite(probability) || probability <= 0) {
    return 100; // Cap at 99/1 for near-zero probability
  }

  if (probability >= 1) {
    return 1.01; // Near even money for near-certainty
  }

  const fairOdds = 1 / probability;

  // Cap at reasonable limits
  return Math.min(100, Math.max(1.01, Math.round(fairOdds * 100) / 100));
}

/**
 * Convert fair decimal odds to implied probability.
 *
 * This is the inverse of probabilityToFairOdds.
 * Formula: Implied Probability = 1 / decimal odds
 *
 * @param odds - Decimal odds (e.g., 4.0 means 3/1)
 * @returns Implied win probability (0-1)
 *
 * @example
 * fairOddsToImpliedProbability(4.0)   // Returns 0.25 (25%)
 * fairOddsToImpliedProbability(2.0)   // Returns 0.50 (50%)
 * fairOddsToImpliedProbability(10.0)  // Returns 0.10 (10%)
 */
export function fairOddsToImpliedProbability(odds: number): number {
  // Handle invalid input
  if (!Number.isFinite(odds) || odds <= 0) {
    return SOFTMAX_CONFIG.minProbability;
  }

  if (odds < 1.01) {
    return SOFTMAX_CONFIG.maxProbability;
  }

  const impliedProb = 1 / odds;

  // Clamp to valid probability range
  return Math.max(
    SOFTMAX_CONFIG.minProbability,
    Math.min(SOFTMAX_CONFIG.maxProbability, impliedProb)
  );
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate that probabilities are coherent (sum to ~1.0).
 *
 * Tolerance accounts for floating point rounding.
 *
 * @param probs - Array of probabilities
 * @param tolerance - Acceptable deviation from 1.0 (default: 0.001)
 * @returns True if probabilities sum to 1.0 within tolerance
 * @throws Error if validation fails (indicates implementation bug)
 */
export function validateProbabilities(probs: number[], tolerance: number = 0.001): boolean {
  if (!probs || probs.length === 0) {
    return true; // Empty array is vacuously valid
  }

  const sum = probs.reduce((acc, p) => acc + p, 0);

  if (Math.abs(sum - 1.0) > tolerance) {
    throw new Error(
      `Probability validation failed: sum = ${sum.toFixed(6)}, expected ~1.0 (tolerance: ${tolerance})`
    );
  }

  // Check individual values are in valid range
  for (let i = 0; i < probs.length; i++) {
    const p = probs[i];
    if (p === undefined || !Number.isFinite(p)) {
      throw new Error(`Probability validation failed: invalid value at index ${i}`);
    }
    if (p < 0 || p > 1) {
      throw new Error(`Probability validation failed: value ${p} at index ${i} outside [0,1]`);
    }
  }

  return true;
}

// ============================================================================
// PROBABILITY BOUNDS & REDISTRIBUTION
// ============================================================================

/**
 * Clamp probabilities to min/max bounds and redistribute excess.
 *
 * Ensures:
 * - No probability below minProbability (0.5%)
 * - No probability above maxProbability (95%)
 * - Total still sums to 1.0 after adjustment
 *
 * Uses iterative approach to handle cases where normalization
 * would push values outside bounds.
 *
 * @param probs - Raw probabilities from softmax
 * @returns Clamped probabilities that sum to 1.0
 */
function clampAndRedistribute(probs: number[]): number[] {
  const { minProbability, maxProbability } = SOFTMAX_CONFIG;

  // Work with a copy
  let result = [...probs];
  const maxIterations = 10;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Track which indices need adjustment
    const needsMinClamp: number[] = [];
    const needsMaxClamp: number[] = [];
    const adjustable: number[] = [];

    for (let i = 0; i < result.length; i++) {
      const p = result[i] ?? 0;
      if (p < minProbability) {
        needsMinClamp.push(i);
      } else if (p > maxProbability) {
        needsMaxClamp.push(i);
      } else {
        adjustable.push(i);
      }
    }

    // If no clamping needed, we're done
    if (needsMinClamp.length === 0 && needsMaxClamp.length === 0) {
      break;
    }

    // Calculate excess probability to redistribute
    let excess = 0;

    // Clamp low values and track how much we added
    for (const i of needsMinClamp) {
      const diff = minProbability - (result[i] ?? 0);
      excess -= diff; // We added this much, need to take it from elsewhere
      result[i] = minProbability;
    }

    // Clamp high values and track how much we removed
    for (const i of needsMaxClamp) {
      const diff = (result[i] ?? 0) - maxProbability;
      excess += diff; // We removed this much, need to give it elsewhere
      result[i] = maxProbability;
    }

    // Redistribute excess to adjustable values
    if (Math.abs(excess) > 0.0001 && adjustable.length > 0) {
      const adjustableSum = adjustable.reduce((sum, i) => sum + (result[i] ?? 0), 0);

      if (adjustableSum > 0.0001) {
        for (const i of adjustable) {
          const p = result[i] ?? 0;
          const proportion = p / adjustableSum;
          result[i] = p + excess * proportion;
        }
      }
    } else if (adjustable.length === 0) {
      // All values are at bounds - normalize and break
      const sum = result.reduce((s, p) => s + p, 0);
      if (sum > 0) {
        result = result.map((p) => p / sum);
      }
      break;
    }
  }

  // Final check - ensure sum is 1.0
  const finalSum = result.reduce((sum, p) => sum + p, 0);
  if (Math.abs(finalSum - 1.0) > 0.0001 && finalSum > 0) {
    result = result.map((p) => p / finalSum);
  }

  return result;
}

// ============================================================================
// CONVERSION WITH FIELD CONTEXT
// ============================================================================

/**
 * Calculate win probability for a horse using softmax within field context.
 *
 * This is the main function to replace linear division in overlayAnalysis.ts.
 *
 * @param horseScore - The horse's base score
 * @param allFieldScores - All scores in the field (including this horse)
 * @param temperature - Softmax temperature (default from config)
 * @returns Win probability as percentage (0-100)
 */
export function calculateWinProbabilitySoftmax(
  horseScore: number,
  allFieldScores: number[],
  temperature: number = SOFTMAX_CONFIG.temperature
): number {
  // Handle invalid inputs
  if (!Number.isFinite(horseScore) || horseScore <= 0) {
    return SOFTMAX_CONFIG.minProbability * 100; // Return as percentage
  }

  if (!allFieldScores || allFieldScores.length === 0) {
    return SOFTMAX_CONFIG.minProbability * 100;
  }

  // Find this horse's index in the field
  const index = allFieldScores.indexOf(horseScore);

  let probability: number;

  if (index < 0) {
    // Horse score not in field array
    // Calculate as if this horse is added to field
    const extendedField = [...allFieldScores, horseScore];
    const probs = softmaxProbabilities(extendedField, temperature);
    probability = probs[extendedField.length - 1] ?? SOFTMAX_CONFIG.minProbability;
  } else {
    // Calculate softmax probabilities for entire field
    const probabilities = softmaxProbabilities(allFieldScores, temperature);
    probability = probabilities[index] ?? SOFTMAX_CONFIG.minProbability;
  }

  // Return as percentage (0-100), clamped to 2-85% for display consistency
  return Math.max(2, Math.min(85, probability * 100));
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get current softmax configuration
 * Useful for display/debugging
 */
export function getSoftmaxConfig(): typeof SOFTMAX_CONFIG {
  return { ...SOFTMAX_CONFIG };
}

/**
 * Create a new softmax configuration (for testing or calibration)
 *
 * @param overrides - Values to override
 * @returns New config object
 */
export function createSoftmaxConfig(overrides: Partial<SoftmaxConfigType>): SoftmaxConfigType {
  return {
    ...SOFTMAX_CONFIG,
    ...overrides,
  };
}

/**
 * Check if calibration is currently active
 *
 * @returns True if Platt scaling calibration is ready and will be applied
 */
export function isCalibrationActive(): boolean {
  const calibrationMgr = getCalibrationManager();
  return calibrationMgr?.isReady ?? false;
}
