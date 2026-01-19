/**
 * Platt Scaling Parameter Fitter
 *
 * Fits Platt scaling parameters (A, B) from historical data using
 * gradient descent to minimize log loss.
 *
 * The fitting process:
 * 1. Take historical predictions and outcomes
 * 2. Use gradient descent to find A, B that minimize log loss
 * 3. Evaluate quality using Brier score on holdout set
 * 4. Cross-validate to ensure stable estimates
 *
 * @module calibration/plattFitter
 */

import type { PlattParameters } from './plattScaling';
import { logit, sigmoid } from './plattScaling';
import { logger } from '../logging';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration for the fitting algorithm
 */
export interface FittingConfig {
  /** Learning rate for gradient descent (default: 0.01) */
  learningRate: number;
  /** Maximum iterations before stopping (default: 1000) */
  maxIterations: number;
  /** Convergence threshold - stop when gradient is smaller (default: 1e-6) */
  convergenceThreshold: number;
  /** L2 regularization strength to prevent extreme parameters (default: 0.001) */
  regularization: number;
}

/**
 * Default fitting configuration
 */
export const DEFAULT_FITTING_CONFIG: FittingConfig = {
  learningRate: 0.01,
  maxIterations: 1000,
  convergenceThreshold: 1e-6,
  regularization: 0.001,
};

/**
 * Result from the fitting process
 */
export interface FittingResult {
  /** Fitted parameters */
  parameters: PlattParameters;
  /** Whether fitting converged */
  converged: boolean;
  /** Number of iterations used */
  iterations: number;
  /** Final log loss on training data */
  finalLogLoss: number;
  /** History of log loss values (for debugging) */
  lossHistory: number[];
}

/**
 * Result from cross-validation
 */
export interface CrossValidationResult {
  /** Average Brier score across folds */
  avgBrierScore: number;
  /** Average log loss across folds */
  avgLogLoss: number;
  /** Standard deviation of Brier scores */
  brierStdDev: number;
  /** Standard deviation of log losses */
  logLossStdDev: number;
  /** Per-fold results */
  foldResults: Array<{
    brierScore: number;
    logLoss: number;
    parameters: PlattParameters;
  }>;
}

// ============================================================================
// GRADIENT CALCULATION
// ============================================================================

/**
 * Calculate gradients of log loss with respect to A and B
 *
 * Log loss: L = -mean(y * log(p) + (1-y) * log(1-p))
 * Where p = sigmoid(A * logit(raw) + B)
 *
 * dL/dA = mean((p - y) * logit(raw)) + regularization * A
 * dL/dB = mean(p - y) + regularization * B
 *
 * @param predictions - Raw model probabilities (0-1)
 * @param outcomes - Actual outcomes (true = win)
 * @param A - Current A parameter
 * @param B - Current B parameter
 * @param regularization - L2 regularization strength
 * @returns Gradients for A and B
 */
export function calculateGradients(
  predictions: number[],
  outcomes: boolean[],
  A: number,
  B: number,
  regularization: number = DEFAULT_FITTING_CONFIG.regularization
): { gradA: number; gradB: number } {
  if (predictions.length === 0 || predictions.length !== outcomes.length) {
    return { gradA: 0, gradB: 0 };
  }

  let sumGradA = 0;
  let sumGradB = 0;
  const n = predictions.length;

  for (let i = 0; i < n; i++) {
    const rawProb = predictions[i] ?? 0.5;
    const outcome = outcomes[i] ?? false;
    const y = outcome ? 1 : 0;

    // Calculate logit of raw probability
    const logitRaw = logit(rawProb);

    // Calculate calibrated probability
    const transformed = A * logitRaw + B;
    const p = sigmoid(transformed);

    // Gradient contributions
    const error = p - y;
    sumGradA += error * logitRaw;
    sumGradB += error;
  }

  // Average and add regularization
  const gradA = sumGradA / n + regularization * A;
  const gradB = sumGradB / n + regularization * B;

  return { gradA, gradB };
}

// ============================================================================
// LOG LOSS CALCULATION
// ============================================================================

/**
 * Calculate log loss for current parameters
 *
 * @param predictions - Raw model probabilities
 * @param outcomes - Actual outcomes
 * @param A - A parameter
 * @param B - B parameter
 * @returns Log loss (lower is better)
 */
function calculateLogLoss(
  predictions: number[],
  outcomes: boolean[],
  A: number,
  B: number
): number {
  if (predictions.length === 0) return Infinity;

  let totalLoss = 0;
  const epsilon = 1e-15; // Prevent log(0)

  for (let i = 0; i < predictions.length; i++) {
    const rawProb = predictions[i] ?? 0.5;
    const outcome = outcomes[i] ?? false;
    const y = outcome ? 1 : 0;

    // Calculate calibrated probability
    const logitRaw = logit(rawProb);
    const transformed = A * logitRaw + B;
    const p = Math.max(epsilon, Math.min(1 - epsilon, sigmoid(transformed)));

    // Log loss for this sample
    totalLoss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }

  return totalLoss / predictions.length;
}

/**
 * Calculate Brier score for current parameters
 *
 * @param predictions - Raw model probabilities
 * @param outcomes - Actual outcomes
 * @param A - A parameter
 * @param B - B parameter
 * @returns Brier score (0-1, lower is better)
 */
function calculateBrierScore(
  predictions: number[],
  outcomes: boolean[],
  A: number,
  B: number
): number {
  if (predictions.length === 0) return 1;

  let totalSquaredError = 0;

  for (let i = 0; i < predictions.length; i++) {
    const rawProb = predictions[i] ?? 0.5;
    const outcome = outcomes[i] ?? false;
    const y = outcome ? 1 : 0;

    // Calculate calibrated probability
    const logitRaw = logit(rawProb);
    const transformed = A * logitRaw + B;
    const p = sigmoid(transformed);

    // Squared error
    totalSquaredError += Math.pow(p - y, 2);
  }

  return totalSquaredError / predictions.length;
}

// ============================================================================
// MAIN FITTING FUNCTION
// ============================================================================

/**
 * Fit Platt scaling parameters using gradient descent
 *
 * @param predictions - Array of raw model probabilities (0-1)
 * @param outcomes - Array of actual outcomes (true if horse won)
 * @param config - Fitting configuration (optional)
 * @returns Fitted PlattParameters or null if fitting fails
 *
 * @example
 * const predictions = [0.35, 0.25, 0.20, 0.15, 0.05];
 * const outcomes = [true, false, false, false, false];
 * const params = fitPlattGradientDescent(predictions, outcomes);
 */
export function fitPlattGradientDescent(
  predictions: number[],
  outcomes: boolean[],
  config: Partial<FittingConfig> = {}
): FittingResult | null {
  // Merge config with defaults
  const cfg: FittingConfig = { ...DEFAULT_FITTING_CONFIG, ...config };

  // Validate inputs
  if (!predictions || predictions.length === 0) {
    logger.logWarning('[PlattFitter] No predictions provided');
    return null;
  }

  if (predictions.length !== outcomes.length) {
    logger.logWarning('[PlattFitter] Predictions and outcomes length mismatch');
    return null;
  }

  // Filter out invalid predictions
  const validIndices: number[] = [];
  for (let i = 0; i < predictions.length; i++) {
    const p = predictions[i];
    if (p !== undefined && Number.isFinite(p) && p > 0 && p < 1) {
      validIndices.push(i);
    }
  }

  if (validIndices.length < 10) {
    logger.logWarning('[PlattFitter] Not enough valid predictions (need at least 10)');
    return null;
  }

  const validPredictions = validIndices.map((i) => predictions[i]!);
  const validOutcomes = validIndices.map((i) => outcomes[i]!);

  // Initialize parameters
  let A = 1.0; // Start with identity transformation
  let B = 0.0;

  const lossHistory: number[] = [];
  let converged = false;
  let iteration = 0;

  // Gradient descent loop
  for (iteration = 0; iteration < cfg.maxIterations; iteration++) {
    // Calculate current loss
    const currentLoss = calculateLogLoss(validPredictions, validOutcomes, A, B);
    lossHistory.push(currentLoss);

    // Calculate gradients
    const { gradA, gradB } = calculateGradients(
      validPredictions,
      validOutcomes,
      A,
      B,
      cfg.regularization
    );

    // Check for convergence
    const gradMagnitude = Math.sqrt(gradA * gradA + gradB * gradB);
    if (gradMagnitude < cfg.convergenceThreshold) {
      converged = true;
      break;
    }

    // Update parameters
    A -= cfg.learningRate * gradA;
    B -= cfg.learningRate * gradB;

    // Safety clamps to prevent extreme values
    A = Math.max(-10, Math.min(10, A));
    B = Math.max(-10, Math.min(10, B));
  }

  // Calculate final metrics
  const finalLogLoss = calculateLogLoss(validPredictions, validOutcomes, A, B);
  const finalBrierScore = calculateBrierScore(validPredictions, validOutcomes, A, B);

  logger.logInfo('[PlattFitter] Fitting complete', {
    converged,
    iterations: iteration,
    A: A.toFixed(4),
    B: B.toFixed(4),
    brierScore: finalBrierScore.toFixed(4),
    logLoss: finalLogLoss.toFixed(4),
  });

  return {
    parameters: {
      A,
      B,
      fittedAt: new Date(),
      racesUsed: validPredictions.length,
      brierScore: finalBrierScore,
      logLoss: finalLogLoss,
    },
    converged,
    iterations: iteration,
    finalLogLoss,
    lossHistory,
  };
}

/**
 * Fit Platt parameters from historical race data
 *
 * This is a convenience function that takes predictions and outcomes
 * and returns just the PlattParameters.
 *
 * @param predictions - Raw model probabilities (0-1)
 * @param outcomes - Actual outcomes (true = win)
 * @returns PlattParameters or null if fitting fails
 */
export function fitPlattParameters(
  predictions: number[],
  outcomes: boolean[]
): PlattParameters | null {
  const result = fitPlattGradientDescent(predictions, outcomes);
  return result?.parameters ?? null;
}

// ============================================================================
// CROSS-VALIDATION
// ============================================================================

/**
 * Perform k-fold cross-validation on Platt scaling
 *
 * @param predictions - Raw model probabilities
 * @param outcomes - Actual outcomes
 * @param folds - Number of folds (default: 5)
 * @returns Cross-validation results
 *
 * @example
 * const cvResult = crossValidatePlatt(predictions, outcomes, 5);
 * console.log(`Avg Brier: ${cvResult.avgBrierScore}`);
 */
export function crossValidatePlatt(
  predictions: number[],
  outcomes: boolean[],
  folds: number = 5
): CrossValidationResult {
  if (predictions.length < folds * 2) {
    logger.logWarning('[PlattFitter] Not enough data for cross-validation');
    return {
      avgBrierScore: 1,
      avgLogLoss: Infinity,
      brierStdDev: 0,
      logLossStdDev: 0,
      foldResults: [],
    };
  }

  // Create shuffled indices
  const indices = Array.from({ length: predictions.length }, (_, i) => i);
  shuffleArray(indices);

  // Split into folds
  const foldSize = Math.floor(indices.length / folds);
  const foldResults: CrossValidationResult['foldResults'] = [];

  for (let fold = 0; fold < folds; fold++) {
    // Get test indices for this fold
    const testStart = fold * foldSize;
    const testEnd = fold === folds - 1 ? indices.length : (fold + 1) * foldSize;
    const testIndices = indices.slice(testStart, testEnd);
    const trainIndices = [...indices.slice(0, testStart), ...indices.slice(testEnd)];

    // Extract train/test sets
    const trainPredictions = trainIndices.map((i) => predictions[i]!);
    const trainOutcomes = trainIndices.map((i) => outcomes[i]!);
    const testPredictions = testIndices.map((i) => predictions[i]!);
    const testOutcomes = testIndices.map((i) => outcomes[i]!);

    // Fit on training data
    const result = fitPlattGradientDescent(trainPredictions, trainOutcomes);

    if (result) {
      // Evaluate on test data
      const brierScore = calculateBrierScore(
        testPredictions,
        testOutcomes,
        result.parameters.A,
        result.parameters.B
      );
      const logLoss = calculateLogLoss(
        testPredictions,
        testOutcomes,
        result.parameters.A,
        result.parameters.B
      );

      foldResults.push({
        brierScore,
        logLoss,
        parameters: result.parameters,
      });
    }
  }

  if (foldResults.length === 0) {
    return {
      avgBrierScore: 1,
      avgLogLoss: Infinity,
      brierStdDev: 0,
      logLossStdDev: 0,
      foldResults: [],
    };
  }

  // Calculate averages and standard deviations
  const brierScores = foldResults.map((r) => r.brierScore);
  const logLosses = foldResults.map((r) => r.logLoss);

  const avgBrierScore = mean(brierScores);
  const avgLogLoss = mean(logLosses);
  const brierStdDev = standardDeviation(brierScores);
  const logLossStdDev = standardDeviation(logLosses);

  return {
    avgBrierScore,
    avgLogLoss,
    brierStdDev,
    logLossStdDev,
    foldResults,
  };
}

// ============================================================================
// GRID SEARCH ALTERNATIVE
// ============================================================================

/**
 * Fit Platt parameters using grid search (simpler alternative to gradient descent)
 *
 * This is a fallback if gradient descent has issues.
 *
 * @param predictions - Raw model probabilities
 * @param outcomes - Actual outcomes
 * @param aRange - Range for A parameter (default: 0.5 to 2.0, step 0.1)
 * @param bRange - Range for B parameter (default: -1.0 to 1.0, step 0.1)
 * @returns Best fitting PlattParameters
 */
export function fitPlattGridSearch(
  predictions: number[],
  outcomes: boolean[],
  aRange: { min: number; max: number; step: number } = { min: 0.5, max: 2.0, step: 0.1 },
  bRange: { min: number; max: number; step: number } = { min: -1.0, max: 1.0, step: 0.1 }
): PlattParameters | null {
  if (predictions.length === 0 || predictions.length !== outcomes.length) {
    return null;
  }

  let bestA = 1.0;
  let bestB = 0.0;
  let bestLoss = Infinity;

  // Grid search
  for (let A = aRange.min; A <= aRange.max; A += aRange.step) {
    for (let B = bRange.min; B <= bRange.max; B += bRange.step) {
      const loss = calculateLogLoss(predictions, outcomes, A, B);
      if (loss < bestLoss) {
        bestLoss = loss;
        bestA = A;
        bestB = B;
      }
    }
  }

  const brierScore = calculateBrierScore(predictions, outcomes, bestA, bestB);

  return {
    A: bestA,
    B: bestB,
    fittedAt: new Date(),
    racesUsed: predictions.length,
    brierScore,
    logLoss: bestLoss,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Fisher-Yates shuffle (in place)
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j]!;
    array[j] = temp!;
  }
}

/**
 * Calculate mean of an array
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation of an array
 */
function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squaredDiffs));
}

/**
 * Evaluate uncalibrated predictions (for comparison)
 *
 * @param predictions - Raw model probabilities
 * @param outcomes - Actual outcomes
 * @returns Metrics for uncalibrated predictions
 */
export function evaluateUncalibrated(
  predictions: number[],
  outcomes: boolean[]
): { brierScore: number; logLoss: number } {
  // With A=1, B=0, this is identity transformation
  const brierScore = calculateBrierScore(predictions, outcomes, 1.0, 0.0);
  const logLoss = calculateLogLoss(predictions, outcomes, 1.0, 0.0);
  return { brierScore, logLoss };
}
