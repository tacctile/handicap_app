/**
 * Confidence Calibration Module
 *
 * Calibrates confidence scores against actual results to ensure
 * probability predictions are accurate.
 *
 * Default calibration mapping:
 * - 200+ pts → 75% win probability
 * - 180-199 → 65%
 * - 160-179 → 55%
 * - 140-159 → 45%
 * - 120-139 → 35%
 * - 100-119 → 25%
 * - <100 → 15%
 *
 * Future (Phase 4 Integration):
 * - Track actual win rates by tier
 * - Adjust calibration based on historical accuracy
 * - Brier Score for measuring prediction quality
 *
 * @module value/confidenceCalibration
 */

import { logger } from '../../services/logging';

// ============================================================================
// TYPES
// ============================================================================

/** Score tier definition */
export interface ScoreTier {
  /** Minimum score for this tier */
  minScore: number;
  /** Maximum score for this tier (exclusive) */
  maxScore: number;
  /** Default win probability for this tier */
  winProbability: number;
  /** Tier label */
  label: string;
}

/** Calibration profile with tier probabilities */
export interface CalibrationProfile {
  /** Profile name */
  name: string;
  /** Score tiers with probabilities */
  tiers: ScoreTier[];
  /** Last updated timestamp */
  lastUpdated: string;
  /** Total sample size used for calibration */
  sampleSize: number;
  /** Whether this is the default profile */
  isDefault: boolean;
}

/** Historical result for calibration tracking */
export interface CalibrationResult {
  /** Score at time of prediction */
  score: number;
  /** Predicted win probability */
  predictedProb: number;
  /** Actual outcome (1 = win, 0 = loss) */
  actualOutcome: 0 | 1;
  /** Odds at time of bet */
  odds: string;
  /** Timestamp */
  timestamp: string;
}

/** Calibration metrics */
export interface CalibrationMetrics {
  /** Brier Score (0 = perfect, lower is better) */
  brierScore: number;
  /** Log Loss (lower is better) */
  logLoss: number;
  /** Calibration curve deviation */
  calibrationError: number;
  /** Total predictions counted */
  predictionCount: number;
  /** Metrics by tier */
  tierMetrics: Map<string, TierMetrics>;
}

/** Per-tier calibration metrics */
export interface TierMetrics {
  /** Tier label */
  tierLabel: string;
  /** Predicted win rate (average) */
  predictedWinRate: number;
  /** Actual win rate */
  actualWinRate: number;
  /** Number of samples */
  sampleCount: number;
  /** ROI percentage */
  roiPercent: number;
  /** Hit rate difference (actual - predicted) */
  hitRateDiff: number;
}

/** Calibration summary for display */
export interface CalibrationSummary {
  /** Overall accuracy assessment */
  overallAccuracy: 'excellent' | 'good' | 'fair' | 'needs_adjustment';
  /** Brier score interpretation */
  brierInterpretation: string;
  /** Tier-level adjustments needed */
  adjustments: string[];
  /** Suggestions for improvement */
  suggestions: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default score tiers with probabilities (adjusted for MAX_BASE_SCORE=336 per ALGORITHM_REFERENCE.md) */
export const DEFAULT_TIERS: ScoreTier[] = [
  { minScore: 200, maxScore: 336, winProbability: 75, label: 'Elite (200+)' },
  { minScore: 181, maxScore: 200, winProbability: 65, label: 'Strong (181-199)' },
  { minScore: 161, maxScore: 181, winProbability: 55, label: 'Good (161-180)' },
  { minScore: 141, maxScore: 161, winProbability: 45, label: 'Fair (141-160)' },
  { minScore: 121, maxScore: 141, winProbability: 35, label: 'Below Avg (121-140)' },
  { minScore: 101, maxScore: 121, winProbability: 25, label: 'Weak (101-120)' },
  { minScore: 0, maxScore: 101, winProbability: 15, label: 'Poor (<101)' },
];

/** Brier score thresholds for quality assessment */
export const BRIER_THRESHOLDS = {
  excellent: 0.15,
  good: 0.2,
  fair: 0.25,
  poor: 0.3,
} as const;

/** Minimum sample size for reliable calibration */
export const MIN_CALIBRATION_SAMPLES = 50;

// ============================================================================
// DEFAULT CALIBRATION
// ============================================================================

/**
 * Get the default calibration profile
 */
export function getDefaultCalibration(): CalibrationProfile {
  return {
    name: 'Default Calibration',
    tiers: DEFAULT_TIERS,
    lastUpdated: new Date().toISOString(),
    sampleSize: 0,
    isDefault: true,
  };
}

/**
 * Convert score to win probability using calibration profile
 */
export function scoreToWinProbability(
  score: number,
  calibration: CalibrationProfile = getDefaultCalibration()
): number {
  // Validate score (336 = max base score)
  const validScore = Math.max(0, Math.min(336, score));

  // Find matching tier
  for (const tier of calibration.tiers) {
    if (validScore >= tier.minScore && validScore < tier.maxScore) {
      // Linear interpolation within tier
      const tierRange = tier.maxScore - tier.minScore;
      const scorePosition = validScore - tier.minScore;
      const tierFraction = tierRange > 0 ? scorePosition / tierRange : 0;

      // Get next tier probability for interpolation
      const nextTierIdx = calibration.tiers.findIndex((t) => t === tier) - 1;
      const nextTier = nextTierIdx >= 0 ? calibration.tiers[nextTierIdx] : undefined;
      const nextTierProb = nextTier?.winProbability ?? tier.winProbability + 10;

      // Interpolate between current and next tier
      const interpolated =
        tier.winProbability + tierFraction * (nextTierProb - tier.winProbability);

      return Math.max(5, Math.min(85, interpolated));
    }
  }

  // Fallback for edge cases
  if (validScore >= 200) return 75;
  if (validScore < 100) return 15;

  return 35; // Default mid-range
}

/**
 * Convert probability to expected score range
 */
export function probabilityToScoreRange(
  probability: number,
  calibration: CalibrationProfile = getDefaultCalibration()
): { min: number; max: number; label: string } {
  // Find tier matching probability
  for (const tier of calibration.tiers) {
    if (Math.abs(tier.winProbability - probability) < 10) {
      return {
        min: tier.minScore,
        max: tier.maxScore,
        label: tier.label,
      };
    }
  }

  // Default range
  return { min: 140, max: 160, label: 'Unknown' };
}

// ============================================================================
// CALIBRATION METRICS
// ============================================================================

/**
 * Calculate Brier Score
 *
 * Brier Score = (1/N) × Σ(predicted - actual)²
 *
 * Range: 0 to 1
 * - 0 = perfect predictions
 * - 0.25 = random guessing for 50/50 events
 * - Lower is better
 */
export function calculateBrierScore(results: CalibrationResult[]): number {
  if (results.length === 0) return 0.25; // Default to random

  const sumSquaredError = results.reduce((sum, r) => {
    const prediction = r.predictedProb / 100;
    const error = prediction - r.actualOutcome;
    return sum + error * error;
  }, 0);

  return sumSquaredError / results.length;
}

/**
 * Calculate Log Loss
 *
 * LogLoss = -(1/N) × Σ[y × log(p) + (1-y) × log(1-p)]
 *
 * Lower is better, penalizes confident wrong predictions heavily
 */
export function calculateLogLoss(results: CalibrationResult[]): number {
  if (results.length === 0) return 1;

  const epsilon = 1e-15; // Prevent log(0)

  const sumLogLoss = results.reduce((sum, r) => {
    const p = Math.max(epsilon, Math.min(1 - epsilon, r.predictedProb / 100));
    const y = r.actualOutcome;

    const logLoss = -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    return sum + logLoss;
  }, 0);

  return sumLogLoss / results.length;
}

/**
 * Calculate calibration error
 * How much predicted probabilities differ from actual outcomes
 */
export function calculateCalibrationError(results: CalibrationResult[]): number {
  if (results.length < 10) return 0;

  // Group by predicted probability buckets
  const buckets = new Map<number, { predicted: number; actual: number; count: number }>();

  for (const r of results) {
    // Round to nearest 10%
    const bucket = Math.round(r.predictedProb / 10) * 10;

    const current = buckets.get(bucket) || { predicted: 0, actual: 0, count: 0 };
    current.predicted += r.predictedProb;
    current.actual += r.actualOutcome;
    current.count++;
    buckets.set(bucket, current);
  }

  // Calculate weighted absolute error
  let totalError = 0;
  let totalWeight = 0;

  for (const [_, bucket] of buckets) {
    if (bucket.count >= 3) {
      const avgPredicted = bucket.predicted / bucket.count / 100;
      const avgActual = bucket.actual / bucket.count;
      totalError += Math.abs(avgPredicted - avgActual) * bucket.count;
      totalWeight += bucket.count;
    }
  }

  return totalWeight > 0 ? totalError / totalWeight : 0;
}

/**
 * Calculate metrics for a specific tier
 */
export function calculateTierMetrics(
  tierLabel: string,
  results: CalibrationResult[],
  tierPredictedProb: number
): TierMetrics {
  if (results.length === 0) {
    return {
      tierLabel,
      predictedWinRate: tierPredictedProb,
      actualWinRate: 0,
      sampleCount: 0,
      roiPercent: 0,
      hitRateDiff: 0,
    };
  }

  const wins = results.filter((r) => r.actualOutcome === 1).length;
  const actualWinRate = (wins / results.length) * 100;
  const avgPredicted = results.reduce((sum, r) => sum + r.predictedProb, 0) / results.length;

  // Calculate ROI (simplified - assumes flat betting)
  let totalReturns = 0;
  let totalWagered = 0;

  for (const r of results) {
    const oddsParts = r.odds.split('-');
    const oddsValue = oddsParts[0];
    const odds = oddsValue ? parseFloat(oddsValue) : 5;
    totalWagered++;
    if (r.actualOutcome === 1) {
      totalReturns += odds + 1;
    }
  }

  const roiPercent = totalWagered > 0 ? ((totalReturns - totalWagered) / totalWagered) * 100 : 0;

  return {
    tierLabel,
    predictedWinRate: avgPredicted,
    actualWinRate,
    sampleCount: results.length,
    roiPercent,
    hitRateDiff: actualWinRate - avgPredicted,
  };
}

/**
 * Calculate full calibration metrics
 */
export function calculateCalibrationMetrics(
  results: CalibrationResult[],
  calibration: CalibrationProfile = getDefaultCalibration()
): CalibrationMetrics {
  const brierScore = calculateBrierScore(results);
  const logLoss = calculateLogLoss(results);
  const calibrationError = calculateCalibrationError(results);

  // Group results by tier
  const tierResults = new Map<string, CalibrationResult[]>();

  for (const r of results) {
    const tier = calibration.tiers.find((t) => r.score >= t.minScore && r.score < t.maxScore);
    const tierLabel = tier?.label || 'Unknown';

    const current = tierResults.get(tierLabel) || [];
    current.push(r);
    tierResults.set(tierLabel, current);
  }

  // Calculate per-tier metrics
  const tierMetrics = new Map<string, TierMetrics>();

  for (const tier of calibration.tiers) {
    const tierData = tierResults.get(tier.label) || [];
    tierMetrics.set(tier.label, calculateTierMetrics(tier.label, tierData, tier.winProbability));
  }

  logger.logDebug('Calibration metrics calculated', {
    component: 'confidenceCalibration',
    brierScore: brierScore.toFixed(3),
    predictionCount: results.length,
  });

  return {
    brierScore,
    logLoss,
    calibrationError,
    predictionCount: results.length,
    tierMetrics,
  };
}

// ============================================================================
// CALIBRATION SUMMARY & ADJUSTMENTS
// ============================================================================

/**
 * Generate calibration summary with recommendations
 */
export function generateCalibrationSummary(metrics: CalibrationMetrics): CalibrationSummary {
  const adjustments: string[] = [];
  const suggestions: string[] = [];

  // Assess overall accuracy
  let overallAccuracy: CalibrationSummary['overallAccuracy'] = 'good';

  if (metrics.brierScore <= BRIER_THRESHOLDS.excellent) {
    overallAccuracy = 'excellent';
  } else if (metrics.brierScore <= BRIER_THRESHOLDS.good) {
    overallAccuracy = 'good';
  } else if (metrics.brierScore <= BRIER_THRESHOLDS.fair) {
    overallAccuracy = 'fair';
  } else {
    overallAccuracy = 'needs_adjustment';
  }

  // Interpret Brier score
  let brierInterpretation = '';
  if (metrics.brierScore < 0.15) {
    brierInterpretation = 'Excellent prediction accuracy. Probabilities are well-calibrated.';
  } else if (metrics.brierScore < 0.2) {
    brierInterpretation = 'Good prediction accuracy. Minor calibration improvements possible.';
  } else if (metrics.brierScore < 0.25) {
    brierInterpretation = 'Fair prediction accuracy. Consider adjusting tier probabilities.';
  } else {
    brierInterpretation =
      'Prediction accuracy needs improvement. Significant calibration required.';
  }

  // Check each tier for adjustments
  for (const [tierLabel, tierMetric] of metrics.tierMetrics) {
    if (tierMetric.sampleCount < 10) continue;

    const diff = tierMetric.hitRateDiff;

    if (Math.abs(diff) > 10) {
      if (diff > 0) {
        adjustments.push(
          `${tierLabel}: Underestimating win rate. Actual: ${tierMetric.actualWinRate.toFixed(0)}%, Predicted: ${tierMetric.predictedWinRate.toFixed(0)}%. Consider increasing probability.`
        );
      } else {
        adjustments.push(
          `${tierLabel}: Overestimating win rate. Actual: ${tierMetric.actualWinRate.toFixed(0)}%, Predicted: ${tierMetric.predictedWinRate.toFixed(0)}%. Consider decreasing probability.`
        );
      }
    }

    // ROI-based suggestions
    if (tierMetric.roiPercent < -20 && tierMetric.sampleCount >= 20) {
      suggestions.push(
        `${tierLabel}: Negative ROI (${tierMetric.roiPercent.toFixed(0)}%). May be overbetting this tier.`
      );
    } else if (tierMetric.roiPercent > 20 && tierMetric.sampleCount >= 20) {
      suggestions.push(
        `${tierLabel}: Strong ROI (${tierMetric.roiPercent.toFixed(0)}%). Consider increasing bet size.`
      );
    }
  }

  // General suggestions
  if (metrics.predictionCount < MIN_CALIBRATION_SAMPLES) {
    suggestions.push(
      `Need ${MIN_CALIBRATION_SAMPLES - metrics.predictionCount} more predictions for reliable calibration.`
    );
  }

  if (metrics.calibrationError > 0.15) {
    suggestions.push('High calibration error detected. Predictions may be over/underconfident.');
  }

  return {
    overallAccuracy,
    brierInterpretation,
    adjustments,
    suggestions,
  };
}

/**
 * Suggest adjusted tier probabilities based on historical data
 */
export function suggestAdjustedProbabilities(
  metrics: CalibrationMetrics,
  currentCalibration: CalibrationProfile
): CalibrationProfile {
  const adjustedTiers = currentCalibration.tiers.map((tier) => {
    const tierMetric = metrics.tierMetrics.get(tier.label);

    if (!tierMetric || tierMetric.sampleCount < 20) {
      return tier; // Not enough data, keep current
    }

    // Blend current probability with actual win rate
    // Weight towards actual as sample size grows
    const sampleWeight = Math.min(0.7, tierMetric.sampleCount / 100);
    const adjustedProb =
      tier.winProbability * (1 - sampleWeight) + tierMetric.actualWinRate * sampleWeight;

    return {
      ...tier,
      winProbability: Math.round(adjustedProb),
    };
  });

  return {
    ...currentCalibration,
    tiers: adjustedTiers,
    lastUpdated: new Date().toISOString(),
    sampleSize: metrics.predictionCount,
    isDefault: false,
    name: 'Adjusted Calibration',
  };
}

// ============================================================================
// STORAGE HELPERS (for Phase 4 persistence)
// ============================================================================

/** Storage key for calibration results */
const CALIBRATION_RESULTS_KEY = 'furlong_calibration_results';
const CALIBRATION_PROFILE_KEY = 'furlong_calibration_profile';

/**
 * Save calibration result (prep for Phase 4)
 */
export function saveCalibrationResult(result: CalibrationResult): void {
  try {
    const stored = localStorage.getItem(CALIBRATION_RESULTS_KEY);
    const results: CalibrationResult[] = stored ? JSON.parse(stored) : [];

    // Keep last 1000 results
    if (results.length >= 1000) {
      results.shift();
    }

    results.push(result);
    localStorage.setItem(CALIBRATION_RESULTS_KEY, JSON.stringify(results));
  } catch (_error) {
    logger.logWarning('Failed to save calibration result', {
      component: 'confidenceCalibration',
    });
  }
}

/**
 * Load calibration results
 */
export function loadCalibrationResults(): CalibrationResult[] {
  try {
    const stored = localStorage.getItem(CALIBRATION_RESULTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save custom calibration profile
 */
export function saveCalibrationProfile(profile: CalibrationProfile): void {
  try {
    localStorage.setItem(CALIBRATION_PROFILE_KEY, JSON.stringify(profile));
  } catch (_error) {
    logger.logWarning('Failed to save calibration profile', {
      component: 'confidenceCalibration',
    });
  }
}

/**
 * Load calibration profile
 */
export function loadCalibrationProfile(): CalibrationProfile {
  try {
    const stored = localStorage.getItem(CALIBRATION_PROFILE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Fall through to default
  }
  return getDefaultCalibration();
}

/**
 * Clear calibration data
 */
export function clearCalibrationData(): void {
  localStorage.removeItem(CALIBRATION_RESULTS_KEY);
  localStorage.removeItem(CALIBRATION_PROFILE_KEY);
}
