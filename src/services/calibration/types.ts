/**
 * Calibration Types
 *
 * Type definitions for probability calibration metrics and analysis.
 * These types support Platt scaling calibration with 500+ race samples.
 */

// ============================================================================
// PROBABILITY BUCKET
// ============================================================================

/**
 * A probability bucket for calibration analysis
 * Groups predictions by predicted probability range and compares to actual outcomes
 */
export interface ProbabilityBucket {
  /** Range of predicted probabilities [min, max) */
  range: [number, number];

  /** Average predicted probability in this bucket */
  predicted: number;

  /** Actual win rate in this bucket */
  actual: number;

  /** Number of predictions in this bucket */
  count: number;

  /** Standard error of the actual win rate */
  standardError?: number;

  /** 95% confidence interval for actual win rate */
  confidenceInterval?: [number, number];
}

// ============================================================================
// CALIBRATION METRICS
// ============================================================================

/**
 * Comprehensive calibration metrics for evaluating probability predictions
 */
export interface CalibrationMetrics {
  /** Brier Score (lower is better, 0-1 range, perfect = 0) */
  brierScore: number;

  /** Log Loss / Cross-Entropy (lower is better) */
  logLoss: number;

  /** Expected Calibration Error - ECE (lower is better, 0-1 range) */
  calibrationError: number;

  /** Maximum Calibration Error (worst bucket deviation) */
  maxCalibrationError: number;

  /** Probability buckets for detailed analysis */
  buckets: ProbabilityBucket[];

  /** Total number of predictions evaluated */
  totalPredictions: number;

  /** Number of actual wins */
  totalWins: number;

  /** Overall predicted win rate */
  overallPredicted: number;

  /** Overall actual win rate */
  overallActual: number;

  /** Reliability diagram data points */
  reliabilityDiagram?: ReliabilityPoint[];
}

/**
 * A point on the reliability diagram
 */
export interface ReliabilityPoint {
  /** Predicted probability (x-axis) */
  predicted: number;

  /** Actual frequency (y-axis) */
  actual: number;

  /** Sample size */
  count: number;
}

// ============================================================================
// TIER CALIBRATION
// ============================================================================

/**
 * Calibration metrics broken down by betting tier
 */
export interface TierCalibrationMetrics {
  /** Tier 1 (Chalk) calibration */
  tier1: TierMetrics;

  /** Tier 2 (Alternatives) calibration */
  tier2: TierMetrics;

  /** Tier 3 (Value) calibration */
  tier3: TierMetrics;

  /** Pass (no bet) calibration */
  pass: TierMetrics;

  /** Overall metrics */
  overall: CalibrationMetrics;
}

/**
 * Metrics for a single betting tier
 */
export interface TierMetrics {
  /** Number of predictions in this tier */
  count: number;

  /** Number of wins in this tier */
  wins: number;

  /** Expected win rate based on predictions */
  expectedWinRate: number;

  /** Actual win rate */
  actualWinRate: number;

  /** Average predicted probability */
  avgPredicted: number;

  /** Brier score for this tier */
  brierScore: number;

  /** ROI if flat betting this tier */
  flatBetROI: number;

  /** Sample standard deviation */
  stdDev?: number;
}

// ============================================================================
// SCORE-BASED CALIBRATION
// ============================================================================

/**
 * Score bucket for analyzing calibration by score range
 */
export interface ScoreBucket {
  /** Score range [min, max) */
  range: [number, number];

  /** Average score in this bucket */
  avgScore: number;

  /** Average predicted probability */
  avgPredicted: number;

  /** Actual win rate */
  actualWinRate: number;

  /** Count of predictions */
  count: number;

  /** Average odds for entries in this bucket */
  avgOdds: number;
}

/**
 * Calibration analysis by final score
 */
export interface ScoreCalibration {
  /** Score buckets (typically 20-point ranges) */
  buckets: ScoreBucket[];

  /** Correlation between score and win rate */
  scoreWinCorrelation: number;

  /** Optimal score threshold for positive ROI */
  optimalThreshold?: number;
}

// ============================================================================
// CALIBRATION ANALYSIS RESULT
// ============================================================================

/**
 * Complete calibration analysis result
 */
export interface CalibrationAnalysisResult {
  /** Core calibration metrics */
  metrics: CalibrationMetrics;

  /** Tier-based analysis */
  tierAnalysis: TierCalibrationMetrics;

  /** Score-based analysis */
  scoreAnalysis: ScoreCalibration;

  /** Whether we have enough data for reliable calibration (500+ races) */
  isCalibrationReady: boolean;

  /** Total races analyzed */
  totalRaces: number;

  /** Total entries analyzed */
  totalEntries: number;

  /** Analysis timestamp */
  analyzedAt: Date;

  /** Recommendations based on analysis */
  recommendations: string[];
}

// ============================================================================
// PLATT SCALING PARAMETERS
// ============================================================================

/**
 * Parameters for Platt scaling calibration
 * These are fitted from historical data to transform raw probabilities
 */
export interface PlattScalingParams {
  /** Slope parameter (A) */
  a: number;

  /** Intercept parameter (B) */
  b: number;

  /** Calibrated probability = 1 / (1 + exp(A * raw + B)) */

  /** Number of samples used to fit these parameters */
  sampleSize: number;

  /** Date when parameters were fitted */
  fittedAt: Date;

  /** Metrics before calibration */
  beforeMetrics: {
    brierScore: number;
    calibrationError: number;
  };

  /** Metrics after calibration (on holdout set) */
  afterMetrics: {
    brierScore: number;
    calibrationError: number;
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Options for creating probability buckets
 */
export interface BucketOptions {
  /** Number of buckets (default: 10) */
  numBuckets?: number;

  /** Custom bucket boundaries (overrides numBuckets) */
  boundaries?: number[];

  /** Minimum samples per bucket to include (default: 10) */
  minSamples?: number;
}

/**
 * Filter options for calibration analysis
 */
export interface CalibrationFilterOptions {
  /** Filter by track code(s) */
  trackCodes?: string[];

  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** Filter by surface */
  surface?: 'D' | 'T' | 'S';

  /** Filter by distance range */
  distanceRange?: {
    min: number; // furlongs
    max: number;
  };

  /** Filter by field size range */
  fieldSizeRange?: {
    min: number;
    max: number;
  };

  /** Filter by data source */
  source?: 'drf_parse' | 'manual' | 'bot_result';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create default bucket boundaries for probability calibration
 * Returns boundaries for 10 equal-width buckets
 */
export function createDefaultBucketBoundaries(): number[] {
  return [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
}

/**
 * Determine which bucket a probability falls into
 */
export function getBucketIndex(probability: number, boundaries: number[]): number {
  for (let i = 0; i < boundaries.length - 1; i++) {
    const lower = boundaries[i];
    const upper = boundaries[i + 1];
    if (lower !== undefined && upper !== undefined && probability >= lower && probability < upper) {
      return i;
    }
  }
  // Handle edge case where probability === 1.0
  return boundaries.length - 2;
}

/**
 * Calculate standard error for a proportion
 */
export function calculateStandardError(proportion: number, sampleSize: number): number {
  if (sampleSize <= 1) return 0;
  return Math.sqrt((proportion * (1 - proportion)) / sampleSize);
}

/**
 * Calculate 95% confidence interval for a proportion
 */
export function calculateConfidenceInterval(
  proportion: number,
  sampleSize: number
): [number, number] {
  const se = calculateStandardError(proportion, sampleSize);
  const z = 1.96; // 95% confidence
  const lower = Math.max(0, proportion - z * se);
  const upper = Math.min(1, proportion + z * se);
  return [lower, upper];
}

/**
 * Check if calibration is statistically reliable
 * Requires minimum sample size and bucket coverage
 */
export function isCalibrationReliable(
  totalSamples: number,
  bucketsWithSamples: number,
  minSamples: number = 500,
  minBuckets: number = 5
): boolean {
  return totalSamples >= minSamples && bucketsWithSamples >= minBuckets;
}
