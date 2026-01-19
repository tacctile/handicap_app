/**
 * Calibration Metrics Module
 *
 * Provides functions to calculate calibration quality metrics:
 * - Brier Score: Mean squared error of probability predictions
 * - Log Loss: Cross-entropy loss (what we optimize during fitting)
 * - Calibration Error (ECE): Average deviation from perfect calibration
 * - Reliability Diagram: Visual representation of calibration
 *
 * @module calibration/metrics
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Small epsilon to prevent log(0) */
const EPSILON = 1e-15;

// ============================================================================
// BRIER SCORE
// ============================================================================

/**
 * Calculate the Brier Score
 *
 * Brier Score = mean((predicted - actual)^2)
 *
 * Range: 0 (perfect) to 1 (worst)
 * - Score of 0: All predictions were exactly right
 * - Score of 0.25: Equivalent to always predicting 0.5
 * - Score of 1: All predictions were exactly wrong
 *
 * @param predictions - Array of predicted probabilities (0-1)
 * @param outcomes - Array of actual outcomes (true = event occurred)
 * @returns Brier score (lower is better)
 *
 * @example
 * // Perfect predictions
 * calculateBrierScore([1.0, 0.0], [true, false]); // Returns 0.0
 *
 * @example
 * // Confident and wrong
 * calculateBrierScore([0.9, 0.9], [false, false]); // Returns 0.81
 */
export function calculateBrierScore(predictions: number[], outcomes: boolean[]): number {
  if (predictions.length === 0 || predictions.length !== outcomes.length) {
    return 1; // Worst possible score for invalid input
  }

  let totalSquaredError = 0;
  let validCount = 0;

  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const outcome = outcomes[i];

    if (pred === undefined || outcome === undefined) continue;
    if (!Number.isFinite(pred)) continue;

    const actual = outcome ? 1 : 0;
    const error = pred - actual;
    totalSquaredError += error * error;
    validCount++;
  }

  if (validCount === 0) return 1;

  return totalSquaredError / validCount;
}

/**
 * Calculate Brier Skill Score (relative to a baseline)
 *
 * BSS = 1 - (Brier_model / Brier_baseline)
 *
 * A positive BSS means the model is better than the baseline.
 *
 * @param predictions - Model predictions
 * @param outcomes - Actual outcomes
 * @param baselinePredictions - Baseline predictions (e.g., historical win rate)
 * @returns Skill score (-inf to 1, higher is better)
 */
export function calculateBrierSkillScore(
  predictions: number[],
  outcomes: boolean[],
  baselinePredictions?: number[]
): number {
  const modelBrier = calculateBrierScore(predictions, outcomes);

  // Default baseline: always predict the historical win rate
  let baselineBrier: number;
  if (baselinePredictions) {
    baselineBrier = calculateBrierScore(baselinePredictions, outcomes);
  } else {
    // Calculate historical win rate
    const wins = outcomes.filter((o) => o).length;
    const winRate = wins / outcomes.length;
    baselineBrier = calculateBrierScore(
      predictions.map(() => winRate),
      outcomes
    );
  }

  if (baselineBrier === 0) return 0; // Avoid division by zero

  return 1 - modelBrier / baselineBrier;
}

// ============================================================================
// LOG LOSS
// ============================================================================

/**
 * Calculate Log Loss (Binary Cross-Entropy)
 *
 * Log Loss = -mean(actual * log(pred) + (1-actual) * log(1-pred))
 *
 * Range: 0 (perfect) to infinity (worst)
 * - Lower is better
 * - Penalizes confident wrong predictions heavily
 *
 * @param predictions - Array of predicted probabilities (0-1)
 * @param outcomes - Array of actual outcomes
 * @returns Log loss (lower is better)
 *
 * @example
 * // Perfect predictions
 * calculateLogLoss([0.99, 0.01], [true, false]); // Returns ~0.02
 *
 * @example
 * // Confident and wrong
 * calculateLogLoss([0.99, 0.99], [false, false]); // Returns ~4.6
 */
export function calculateLogLoss(predictions: number[], outcomes: boolean[]): number {
  if (predictions.length === 0 || predictions.length !== outcomes.length) {
    return Infinity;
  }

  let totalLoss = 0;
  let validCount = 0;

  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const outcome = outcomes[i];

    if (pred === undefined || outcome === undefined) continue;
    if (!Number.isFinite(pred)) continue;

    // Clamp prediction to prevent log(0)
    const clampedPred = Math.max(EPSILON, Math.min(1 - EPSILON, pred));
    const actual = outcome ? 1 : 0;

    // Binary cross-entropy
    const loss = -(actual * Math.log(clampedPred) + (1 - actual) * Math.log(1 - clampedPred));

    totalLoss += loss;
    validCount++;
  }

  if (validCount === 0) return Infinity;

  return totalLoss / validCount;
}

// ============================================================================
// CALIBRATION ERROR
// ============================================================================

/**
 * Calculate Expected Calibration Error (ECE)
 *
 * ECE = sum(|bucket_count/total| * |avg_predicted - avg_actual|)
 *
 * Measures the average absolute difference between predicted and actual
 * frequencies within probability buckets.
 *
 * @param predictions - Array of predicted probabilities
 * @param outcomes - Array of actual outcomes
 * @param buckets - Number of buckets (default: 10)
 * @returns Calibration error (0 to 1, lower is better)
 *
 * @example
 * // Well-calibrated: predictions of 30% win ~30% of the time
 * calculateCalibrationError(predictions, outcomes);
 */
export function calculateCalibrationError(
  predictions: number[],
  outcomes: boolean[],
  buckets: number = 10
): number {
  if (predictions.length === 0 || predictions.length !== outcomes.length) {
    return 1;
  }

  // Create buckets
  const bucketData = Array.from({ length: buckets }, () => ({
    predicted: [] as number[],
    actual: [] as number[],
  }));

  // Assign predictions to buckets
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const outcome = outcomes[i];

    if (pred === undefined || outcome === undefined) continue;
    if (!Number.isFinite(pred) || pred < 0 || pred > 1) continue;

    // Determine bucket index (0 to buckets-1)
    const bucketIndex = Math.min(Math.floor(pred * buckets), buckets - 1);

    bucketData[bucketIndex]!.predicted.push(pred);
    bucketData[bucketIndex]!.actual.push(outcome ? 1 : 0);
  }

  // Calculate weighted calibration error
  let totalError = 0;
  const totalSamples = predictions.length;

  for (const bucket of bucketData) {
    if (bucket.predicted.length === 0) continue;

    const avgPredicted = bucket.predicted.reduce((a, b) => a + b, 0) / bucket.predicted.length;
    const avgActual = bucket.actual.reduce((a, b) => a + b, 0) / bucket.actual.length;

    const weight = bucket.predicted.length / totalSamples;
    const error = Math.abs(avgPredicted - avgActual);

    totalError += weight * error;
  }

  return totalError;
}

/**
 * Calculate Maximum Calibration Error (MCE)
 *
 * MCE = max(|avg_predicted - avg_actual|) across all buckets
 *
 * @param predictions - Array of predicted probabilities
 * @param outcomes - Array of actual outcomes
 * @param buckets - Number of buckets
 * @returns Maximum calibration error (0 to 1)
 */
export function calculateMaxCalibrationError(
  predictions: number[],
  outcomes: boolean[],
  buckets: number = 10
): number {
  if (predictions.length === 0 || predictions.length !== outcomes.length) {
    return 1;
  }

  // Create buckets
  const bucketData = Array.from({ length: buckets }, () => ({
    predicted: [] as number[],
    actual: [] as number[],
  }));

  // Assign predictions to buckets
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const outcome = outcomes[i];

    if (pred === undefined || outcome === undefined) continue;
    if (!Number.isFinite(pred) || pred < 0 || pred > 1) continue;

    const bucketIndex = Math.min(Math.floor(pred * buckets), buckets - 1);
    bucketData[bucketIndex]!.predicted.push(pred);
    bucketData[bucketIndex]!.actual.push(outcome ? 1 : 0);
  }

  // Find maximum error
  let maxError = 0;

  for (const bucket of bucketData) {
    if (bucket.predicted.length < 5) continue; // Skip sparse buckets

    const avgPredicted = bucket.predicted.reduce((a, b) => a + b, 0) / bucket.predicted.length;
    const avgActual = bucket.actual.reduce((a, b) => a + b, 0) / bucket.actual.length;

    const error = Math.abs(avgPredicted - avgActual);
    maxError = Math.max(maxError, error);
  }

  return maxError;
}

// ============================================================================
// RELIABILITY DIAGRAM
// ============================================================================

/**
 * Data point for a reliability diagram
 */
export interface ReliabilityDiagramPoint {
  /** Label for the bucket (e.g., "0.10-0.20") */
  bucket: string;
  /** Average predicted probability in this bucket */
  predicted: number;
  /** Actual win rate in this bucket */
  actual: number;
  /** Number of samples in this bucket */
  count: number;
  /** Standard error of the actual rate */
  standardError?: number;
}

/**
 * Generate data for a reliability diagram
 *
 * A reliability diagram plots predicted vs actual probabilities.
 * Perfect calibration would show all points on the diagonal.
 *
 * @param predictions - Array of predicted probabilities
 * @param outcomes - Array of actual outcomes
 * @param buckets - Number of buckets (default: 10)
 * @returns Array of points for plotting
 *
 * @example
 * const diagram = generateReliabilityDiagram(predictions, outcomes);
 * // Plot predicted (x-axis) vs actual (y-axis)
 */
export function generateReliabilityDiagram(
  predictions: number[],
  outcomes: boolean[],
  buckets: number = 10
): ReliabilityDiagramPoint[] {
  if (predictions.length === 0 || predictions.length !== outcomes.length) {
    return [];
  }

  // Create buckets
  const bucketData = Array.from({ length: buckets }, (_, i) => ({
    minProb: i / buckets,
    maxProb: (i + 1) / buckets,
    predicted: [] as number[],
    actual: [] as number[],
  }));

  // Assign predictions to buckets
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const outcome = outcomes[i];

    if (pred === undefined || outcome === undefined) continue;
    if (!Number.isFinite(pred) || pred < 0 || pred > 1) continue;

    const bucketIndex = Math.min(Math.floor(pred * buckets), buckets - 1);
    bucketData[bucketIndex]!.predicted.push(pred);
    bucketData[bucketIndex]!.actual.push(outcome ? 1 : 0);
  }

  // Generate diagram points
  const points: ReliabilityDiagramPoint[] = [];

  for (const bucket of bucketData) {
    if (bucket.predicted.length === 0) continue;

    const avgPredicted = bucket.predicted.reduce((a, b) => a + b, 0) / bucket.predicted.length;
    const avgActual = bucket.actual.reduce((a, b) => a + b, 0) / bucket.actual.length;

    // Calculate standard error for actual rate
    const se =
      bucket.actual.length > 1
        ? Math.sqrt((avgActual * (1 - avgActual)) / bucket.actual.length)
        : 0;

    points.push({
      bucket: `${bucket.minProb.toFixed(2)}-${bucket.maxProb.toFixed(2)}`,
      predicted: avgPredicted,
      actual: avgActual,
      count: bucket.predicted.length,
      standardError: se,
    });
  }

  return points;
}

// ============================================================================
// COMPREHENSIVE METRICS
// ============================================================================

/**
 * All calibration metrics in one object
 */
export interface ComprehensiveMetrics {
  brierScore: number;
  logLoss: number;
  calibrationError: number;
  maxCalibrationError: number;
  brierSkillScore: number;
  totalPredictions: number;
  totalWins: number;
  overallWinRate: number;
  avgPredictedProb: number;
  reliabilityDiagram: ReliabilityDiagramPoint[];
}

/**
 * Calculate all calibration metrics at once
 *
 * @param predictions - Array of predicted probabilities
 * @param outcomes - Array of actual outcomes
 * @param buckets - Number of buckets for calibration analysis
 * @returns All calibration metrics
 */
export function calculateAllMetrics(
  predictions: number[],
  outcomes: boolean[],
  buckets: number = 10
): ComprehensiveMetrics {
  const validPairs: Array<{ pred: number; outcome: boolean }> = [];

  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const outcome = outcomes[i];

    if (
      pred !== undefined &&
      outcome !== undefined &&
      Number.isFinite(pred) &&
      pred >= 0 &&
      pred <= 1
    ) {
      validPairs.push({ pred, outcome });
    }
  }

  const validPredictions = validPairs.map((p) => p.pred);
  const validOutcomes = validPairs.map((p) => p.outcome);

  const totalWins = validOutcomes.filter((o) => o).length;
  const overallWinRate = validOutcomes.length > 0 ? totalWins / validOutcomes.length : 0;
  const avgPredictedProb =
    validPredictions.length > 0
      ? validPredictions.reduce((a, b) => a + b, 0) / validPredictions.length
      : 0;

  return {
    brierScore: calculateBrierScore(validPredictions, validOutcomes),
    logLoss: calculateLogLoss(validPredictions, validOutcomes),
    calibrationError: calculateCalibrationError(validPredictions, validOutcomes, buckets),
    maxCalibrationError: calculateMaxCalibrationError(validPredictions, validOutcomes, buckets),
    brierSkillScore: calculateBrierSkillScore(validPredictions, validOutcomes),
    totalPredictions: validPredictions.length,
    totalWins,
    overallWinRate,
    avgPredictedProb,
    reliabilityDiagram: generateReliabilityDiagram(validPredictions, validOutcomes, buckets),
  };
}

// ============================================================================
// CALIBRATION IMPROVEMENT
// ============================================================================

/**
 * Calculate the improvement from calibration
 *
 * @param beforeMetrics - Metrics before calibration
 * @param afterMetrics - Metrics after calibration
 * @returns Improvement percentages (positive = better after calibration)
 */
export function calculateCalibrationImprovement(
  beforeMetrics: { brierScore: number; logLoss: number; calibrationError: number },
  afterMetrics: { brierScore: number; logLoss: number; calibrationError: number }
): {
  brierImprovement: number;
  logLossImprovement: number;
  calibrationErrorImprovement: number;
} {
  const brierImprovement =
    beforeMetrics.brierScore > 0
      ? ((beforeMetrics.brierScore - afterMetrics.brierScore) / beforeMetrics.brierScore) * 100
      : 0;

  const logLossImprovement =
    beforeMetrics.logLoss > 0 && Number.isFinite(beforeMetrics.logLoss)
      ? ((beforeMetrics.logLoss - afterMetrics.logLoss) / beforeMetrics.logLoss) * 100
      : 0;

  const calibrationErrorImprovement =
    beforeMetrics.calibrationError > 0
      ? ((beforeMetrics.calibrationError - afterMetrics.calibrationError) /
          beforeMetrics.calibrationError) *
        100
      : 0;

  return {
    brierImprovement,
    logLossImprovement,
    calibrationErrorImprovement,
  };
}

// ============================================================================
// REFERENCE VALUES
// ============================================================================

/**
 * Reference Brier scores for context
 */
export const BRIER_SCORE_REFERENCE = {
  /** Perfect predictions */
  perfect: 0,
  /** Excellent (very well calibrated model) */
  excellent: 0.1,
  /** Good (well calibrated model) */
  good: 0.15,
  /** Fair (acceptable calibration) */
  fair: 0.2,
  /** Always predicting 50% */
  random: 0.25,
  /** Poor calibration */
  poor: 0.3,
  /** Worst possible (always maximally wrong) */
  worst: 1.0,
} as const;

/**
 * Interpret a Brier score
 */
export function interpretBrierScore(score: number): string {
  if (score < BRIER_SCORE_REFERENCE.excellent) return 'Excellent';
  if (score < BRIER_SCORE_REFERENCE.good) return 'Good';
  if (score < BRIER_SCORE_REFERENCE.fair) return 'Fair';
  if (score < BRIER_SCORE_REFERENCE.random) return 'Below Average';
  return 'Poor';
}

/**
 * Interpret calibration error
 */
export function interpretCalibrationError(error: number): string {
  if (error < 0.02) return 'Excellent calibration';
  if (error < 0.05) return 'Good calibration';
  if (error < 0.1) return 'Fair calibration';
  if (error < 0.15) return 'Needs improvement';
  return 'Poor calibration';
}
