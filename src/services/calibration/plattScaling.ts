/**
 * Platt Scaling Module
 *
 * Implements Platt scaling for probability calibration.
 * Platt scaling fits a logistic function to map raw model probabilities
 * to calibrated probabilities that better match actual win rates.
 *
 * Formula: P_calibrated = 1 / (1 + exp(A * logit(P_raw) + B))
 * Where: logit(p) = ln(p / (1-p))
 *
 * This module activates once 500+ historical races are accumulated.
 *
 * @module calibration/plattScaling
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Fitted Platt scaling parameters
 */
export interface PlattParameters {
  /** Slope parameter (A) - scales the logit transformation */
  A: number;
  /** Intercept parameter (B) - shifts the logit transformation */
  B: number;
  /** When these parameters were fitted */
  fittedAt: Date;
  /** Number of races used to fit these parameters */
  racesUsed: number;
  /** Brier score on validation data (lower is better, 0-1 range) */
  brierScore: number;
  /** Log loss on validation data (lower is better) */
  logLoss: number;
}

/**
 * Serializable version of PlattParameters for storage
 */
export interface StorablePlattParameters {
  A: number;
  B: number;
  fittedAt: string; // ISO date string
  racesUsed: number;
  brierScore: number;
  logLoss: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum probability to prevent log(0) */
const MIN_PROB = 0.001;

/** Maximum probability to prevent log(inf) */
const MAX_PROB = 0.999;

/** Minimum clamped output probability */
const MIN_OUTPUT = 0.005;

/** Maximum clamped output probability */
const MAX_OUTPUT = 0.995;

// ============================================================================
// LOGIT AND SIGMOID FUNCTIONS
// ============================================================================

/**
 * Calculate the logit (log-odds) of a probability
 * logit(p) = ln(p / (1-p))
 *
 * @param probability - Input probability (0-1)
 * @returns Logit value (can be any real number)
 */
export function logit(probability: number): number {
  // Clamp to prevent log(0) or log(inf)
  const p = Math.max(MIN_PROB, Math.min(MAX_PROB, probability));
  return Math.log(p / (1 - p));
}

/**
 * Calculate the sigmoid (inverse logit) of a value
 * sigmoid(x) = 1 / (1 + exp(-x))
 *
 * @param x - Input value (any real number)
 * @returns Probability (0-1)
 */
export function sigmoid(x: number): number {
  // Numerical stability: for large negative x, exp(-x) is huge
  // For large positive x, exp(-x) approaches 0
  if (x >= 0) {
    const expNegX = Math.exp(-x);
    return 1 / (1 + expNegX);
  } else {
    const expX = Math.exp(x);
    return expX / (1 + expX);
  }
}

// ============================================================================
// CALIBRATION FUNCTIONS
// ============================================================================

/**
 * Apply Platt scaling calibration to a single probability
 *
 * Formula: P_calibrated = sigmoid(A * logit(P_raw) + B)
 *          = 1 / (1 + exp(-(A * logit(P_raw) + B)))
 *
 * @param rawProbability - Raw model probability (0-1)
 * @param params - Platt scaling parameters
 * @returns Calibrated probability (0-1)
 *
 * @example
 * const params = { A: 1.0, B: 0.0, ... }; // Identity transformation
 * calibrateProbability(0.25, params); // Returns ~0.25
 *
 * @example
 * const params = { A: 0.8, B: 0.1, ... }; // Compress and shift
 * calibrateProbability(0.25, params); // Returns adjusted probability
 */
export function calibrateProbability(rawProbability: number, params: PlattParameters): number {
  // Handle edge cases
  if (!Number.isFinite(rawProbability)) {
    return MIN_OUTPUT;
  }

  // Clamp input
  const clampedRaw = Math.max(MIN_PROB, Math.min(MAX_PROB, rawProbability));

  // Calculate logit of raw probability
  const logitRaw = logit(clampedRaw);

  // Apply Platt transformation: A * logit(p) + B
  const transformed = params.A * logitRaw + params.B;

  // Convert back to probability using sigmoid
  const calibrated = sigmoid(transformed);

  // Clamp output to reasonable bounds
  return Math.max(MIN_OUTPUT, Math.min(MAX_OUTPUT, calibrated));
}

/**
 * Apply Platt scaling calibration to an entire field of horses
 * Re-normalizes probabilities after calibration to sum to 1.0
 *
 * @param rawProbabilities - Array of raw model probabilities
 * @param params - Platt scaling parameters
 * @returns Array of calibrated probabilities (sum to ~1.0)
 *
 * @example
 * const rawProbs = [0.40, 0.30, 0.20, 0.10];
 * const calibrated = calibrateField(rawProbs, params);
 * // Returns calibrated probs that sum to 1.0
 */
export function calibrateField(rawProbabilities: number[], params: PlattParameters): number[] {
  // Handle empty input
  if (!rawProbabilities || rawProbabilities.length === 0) {
    return [];
  }

  // Handle single horse
  if (rawProbabilities.length === 1) {
    return [1.0];
  }

  // Calibrate each probability
  const calibrated = rawProbabilities.map((p) => calibrateProbability(p, params));

  // Re-normalize to sum to 1.0
  const sum = calibrated.reduce((acc, p) => acc + p, 0);

  if (sum <= 0) {
    // Fallback to uniform distribution if all calibrated to near-zero
    const uniform = 1.0 / rawProbabilities.length;
    return rawProbabilities.map(() => uniform);
  }

  // Normalize
  const normalized = calibrated.map((p) => p / sum);

  // Final clamping pass to ensure bounds
  return clampAndRedistribute(normalized);
}

/**
 * Clamp probabilities and redistribute to maintain sum of 1.0
 *
 * @param probs - Array of probabilities
 * @returns Clamped and normalized probabilities
 */
function clampAndRedistribute(probs: number[]): number[] {
  let result = [...probs];
  const maxIterations = 10;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const needsMinClamp: number[] = [];
    const needsMaxClamp: number[] = [];
    const adjustable: number[] = [];

    for (let i = 0; i < result.length; i++) {
      const p = result[i] ?? 0;
      if (p < MIN_OUTPUT) {
        needsMinClamp.push(i);
      } else if (p > MAX_OUTPUT) {
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

    for (const i of needsMinClamp) {
      const diff = MIN_OUTPUT - (result[i] ?? 0);
      excess -= diff;
      result[i] = MIN_OUTPUT;
    }

    for (const i of needsMaxClamp) {
      const diff = (result[i] ?? 0) - MAX_OUTPUT;
      excess += diff;
      result[i] = MAX_OUTPUT;
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
      // All values at bounds - normalize and break
      const sum = result.reduce((s, p) => s + p, 0);
      if (sum > 0) {
        result = result.map((p) => p / sum);
      }
      break;
    }
  }

  // Final normalization check
  const finalSum = result.reduce((sum, p) => sum + p, 0);
  if (Math.abs(finalSum - 1.0) > 0.0001 && finalSum > 0) {
    result = result.map((p) => p / finalSum);
  }

  return result;
}

// ============================================================================
// DEFAULT / IDENTITY PARAMETERS
// ============================================================================

/**
 * Create identity Platt parameters (no transformation)
 * A=1, B=0 means: calibrated = sigmoid(logit(raw)) = raw
 *
 * @returns Identity PlattParameters
 */
export function createIdentityParameters(): PlattParameters {
  return {
    A: 1.0,
    B: 0.0,
    fittedAt: new Date(),
    racesUsed: 0,
    brierScore: 0,
    logLoss: 0,
  };
}

/**
 * Check if parameters are essentially identity (no transformation)
 *
 * @param params - Parameters to check
 * @returns True if parameters produce no meaningful change
 */
export function isIdentityParameters(params: PlattParameters): boolean {
  return Math.abs(params.A - 1.0) < 0.001 && Math.abs(params.B) < 0.001;
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Convert PlattParameters to storable format
 *
 * @param params - PlattParameters to serialize
 * @returns Storable version with date as ISO string
 */
export function serializePlattParameters(params: PlattParameters): StorablePlattParameters {
  return {
    A: params.A,
    B: params.B,
    fittedAt: params.fittedAt.toISOString(),
    racesUsed: params.racesUsed,
    brierScore: params.brierScore,
    logLoss: params.logLoss,
  };
}

/**
 * Convert storable format back to PlattParameters
 *
 * @param storable - Storable parameters from IndexedDB
 * @returns PlattParameters with Date object
 */
export function deserializePlattParameters(storable: StorablePlattParameters): PlattParameters {
  return {
    A: storable.A,
    B: storable.B,
    fittedAt: new Date(storable.fittedAt),
    racesUsed: storable.racesUsed,
    brierScore: storable.brierScore,
    logLoss: storable.logLoss,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that Platt parameters are reasonable
 *
 * @param params - Parameters to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validatePlattParameters(params: PlattParameters): string[] {
  const errors: string[] = [];

  if (!Number.isFinite(params.A)) {
    errors.push('Parameter A must be a finite number');
  }

  if (!Number.isFinite(params.B)) {
    errors.push('Parameter B must be a finite number');
  }

  // A should generally be positive (maintaining monotonicity)
  // A negative A would invert the relationship
  if (params.A < 0) {
    errors.push('Parameter A should be positive for monotonic calibration');
  }

  // Very extreme values suggest fitting failure
  if (Math.abs(params.A) > 10) {
    errors.push(`Parameter A (${params.A}) is unusually large`);
  }

  if (Math.abs(params.B) > 10) {
    errors.push(`Parameter B (${params.B}) is unusually large`);
  }

  // Check metrics are valid
  if (params.brierScore < 0 || params.brierScore > 1) {
    errors.push('Brier score should be between 0 and 1');
  }

  if (params.logLoss < 0) {
    errors.push('Log loss should be non-negative');
  }

  if (params.racesUsed < 0) {
    errors.push('Races used should be non-negative');
  }

  return errors;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get the calibration bounds
 */
export function getCalibrationBounds(): {
  minInput: number;
  maxInput: number;
  minOutput: number;
  maxOutput: number;
} {
  return {
    minInput: MIN_PROB,
    maxInput: MAX_PROB,
    minOutput: MIN_OUTPUT,
    maxOutput: MAX_OUTPUT,
  };
}
