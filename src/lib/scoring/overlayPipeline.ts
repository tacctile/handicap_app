/**
 * Unified Overlay Pipeline Module
 *
 * Single entry point for all overlay calculations that combines:
 * - Softmax probability conversion from scores
 * - Market probability normalization (removes takeout/vig)
 * - True overlay detection
 * - Expected value (EV) calculations
 * - Value classification
 * - Overlay adjustment points (for ±40 point cap)
 *
 * This module unifies probabilityConversion.ts and marketNormalization.ts
 * into a coherent pipeline for value betting analysis.
 *
 * @module scoring/overlayPipeline
 */

import {
  softmaxProbabilities,
  probabilityToFairOdds,
  isCalibrationActive,
} from './probabilityConversion';
import {
  oddsToImpliedProbability,
  normalizeMarketProbabilities,
  calculateOverround,
  calculateTakeoutPercent,
} from './marketNormalization';
import { parseOddsString } from './oddsParser';
import {
  OVERLAY_CONFIG,
  VALUE_CLASS_LABELS,
  VALUE_CLASS_COLORS,
  VALUE_CLASS_ICONS,
  EV_CLASS_LABELS,
  type PipelineValueClass,
  type EVClassification,
} from './overlayConfig';
import type { HorseScore } from './index';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input for the overlay pipeline
 */
export interface OverlayPipelineInput {
  /** Array of horses with scores and odds */
  horses: OverlayHorseInput[];
  /** Whether to use market normalization (default: true) */
  useNormalization?: boolean;
  /** Softmax temperature parameter (default: 1.0) */
  temperature?: number;
}

/**
 * Individual horse input for the pipeline
 */
export interface OverlayHorseInput {
  /** Program number for identification */
  programNumber: number;
  /** Base score (0-319 before overlay adjustments) */
  baseScore: number;
  /** Final score (base + overlay adjustments) */
  finalScore: number;
  /** Morning line odds from DRF (decimal format or string like "5-1") */
  morningLineOdds: number | string;
  /** Optional live tote odds (for future use) */
  liveOdds?: number | string;
  /** Horse name for display (optional) */
  horseName?: string;
}

/**
 * Output for a single horse from the pipeline
 */
export interface OverlayHorseOutput {
  /** Program number */
  programNumber: number;
  /** Horse name if provided */
  horseName?: string;

  // Probability metrics
  /** Win probability from softmax model (0-1) */
  modelProbability: number;
  /** Raw implied probability from odds (includes takeout) (0-1) */
  rawImpliedProbability: number;
  /** Normalized market probability (takeout removed, sums to 1.0) (0-1) */
  normalizedMarketProbability: number;

  // Overlay metrics
  /** True overlay percentage (primary value signal) */
  trueOverlayPercent: number;
  /** Raw overlay percentage (for comparison, includes takeout) */
  rawOverlayPercent: number;

  // Fair odds
  /** What odds should be based on model probability */
  fairOdds: number;
  /** Fair odds as display string (e.g., "5-1") */
  fairOddsDisplay: string;
  /** Actual odds from market */
  actualOdds: number;
  /** Actual odds as display string */
  actualOddsDisplay: string;

  // Value classification
  /** Value classification based on normalized overlay */
  valueClassification: PipelineValueClass;
  /** Human-readable label for value class */
  valueLabel: string;
  /** Color for value class display */
  valueColor: string;
  /** Icon for value class display */
  valueIcon: string;

  // Expected value
  /** Expected value per $1 bet */
  expectedValue: number;
  /** EV as percentage */
  evPercent: number;
  /** EV classification */
  evClassification: EVClassification;
  /** Human-readable EV label */
  evLabel: string;
  /** Whether this is a positive EV bet */
  isPositiveEV: boolean;

  // Overlay adjustment
  /** Points to add to score from value overlay (within ±40 cap) */
  overlayAdjustment: number;
  /** Reasoning for the adjustment */
  adjustmentReasoning: string;

  // Original inputs (for reference)
  /** Original base score */
  baseScore: number;
  /** Original final score */
  finalScore: number;
}

/**
 * Full output from the overlay pipeline
 */
export interface OverlayPipelineOutput {
  /** Array of horse outputs */
  horses: OverlayHorseOutput[];
  /** Field-level metrics */
  fieldMetrics: {
    /** Market overround (sum of implied probs, typically 1.15-1.25) */
    overround: number;
    /** Takeout percentage */
    takeoutPercent: number;
    /** Average model probability (should be close to 1/fieldSize) */
    averageModelProb: number;
    /** Whether model probabilities are validated (sum to ~1.0) */
    probsValidated: boolean;
    /** Field size (non-scratched horses) */
    fieldSize: number;
    /** Strongest value horse by program number (null if none) */
    bestValueHorse: number | null;
    /** Best true overlay percentage in field */
    bestOverlayPercent: number;
  };
  /** Pipeline configuration used */
  config: {
    temperature: number;
    useNormalization: boolean;
  };
  /** Whether Platt scaling calibration was applied to model probabilities */
  calibrationApplied: boolean;
  /** Calibration metrics (only present if calibration was applied) */
  calibrationMetrics?: {
    /** Brier score of the calibration model */
    brierScore: number;
    /** Number of races used to fit the calibration */
    racesUsed: number;
    /** When the calibration parameters were fitted */
    fittedAt: Date;
  };
}

// ============================================================================
// EXPECTED VALUE CALCULATION
// ============================================================================

/**
 * Calculate Expected Value per $1 bet
 *
 * EV = (modelProb × decimalOdds) - 1
 * Positive EV indicates a profitable long-term bet.
 *
 * @param modelProb - Model's win probability (0-1)
 * @param decimalOdds - Decimal odds (e.g., 4.0 for 3-1)
 * @returns EV per $1 bet (e.g., 0.15 = 15% edge)
 *
 * @example
 * // Model says 30% chance, odds are 4.0 (3-1)
 * calculateExpectedValue(0.30, 4.0)  // Returns 0.20 (20% edge)
 *
 * // Model says 20% chance, odds are 3.0 (2-1)
 * calculateExpectedValue(0.20, 3.0)  // Returns -0.40 (losing bet)
 */
export function calculateExpectedValue(modelProb: number, decimalOdds: number): number {
  if (!Number.isFinite(modelProb) || !Number.isFinite(decimalOdds)) {
    return 0;
  }

  if (modelProb <= 0 || decimalOdds <= 1.0) {
    return -1; // Invalid input indicates losing bet
  }

  return modelProb * decimalOdds - 1;
}

/**
 * Classify EV based on thresholds
 *
 * @param ev - Expected value (e.g., 0.15 for 15% edge)
 * @returns EV classification
 */
export function classifyEV(ev: number): EVClassification {
  if (!Number.isFinite(ev)) {
    return 'neutral';
  }

  if (ev >= OVERLAY_CONFIG.ev.strongPositive) {
    return 'strongPositive';
  }
  if (ev >= OVERLAY_CONFIG.ev.moderatePositive) {
    return 'moderatePositive';
  }
  if (ev >= OVERLAY_CONFIG.ev.slightPositive) {
    return 'slightPositive';
  }
  if (ev >= OVERLAY_CONFIG.ev.negative) {
    return 'neutral';
  }
  return 'negative';
}

// ============================================================================
// VALUE CLASSIFICATION
// ============================================================================

/**
 * Classify value based on true overlay percentage
 *
 * Uses normalized overlay (with takeout removed) for accurate classification.
 *
 * @param trueOverlay - True overlay percentage (model prob vs normalized market prob)
 * @returns Value classification
 *
 * @example
 * classifyTrueOverlay(18)   // Returns 'STRONG_VALUE'
 * classifyTrueOverlay(10)   // Returns 'MODERATE_VALUE'
 * classifyTrueOverlay(5)    // Returns 'SLIGHT_VALUE'
 * classifyTrueOverlay(0)    // Returns 'NEUTRAL'
 * classifyTrueOverlay(-5)   // Returns 'UNDERLAY'
 */
export function classifyTrueOverlay(trueOverlay: number): PipelineValueClass {
  if (!Number.isFinite(trueOverlay)) {
    return 'NEUTRAL';
  }

  if (trueOverlay >= OVERLAY_CONFIG.value.strongOverlay) {
    return 'STRONG_VALUE';
  }
  if (trueOverlay >= OVERLAY_CONFIG.value.moderateOverlay) {
    return 'MODERATE_VALUE';
  }
  if (trueOverlay >= OVERLAY_CONFIG.value.slightOverlay) {
    return 'SLIGHT_VALUE';
  }
  if (trueOverlay >= OVERLAY_CONFIG.value.underlayThreshold) {
    return 'NEUTRAL';
  }
  return 'UNDERLAY';
}

// ============================================================================
// OVERLAY ADJUSTMENT POINTS
// ============================================================================

/**
 * Calculate overlay adjustment points for the scoring system
 *
 * Maps true overlay percentage and EV to adjustment points within the ±40 cap.
 * Points are ADDITIVE to the existing overlay system, not replacements.
 *
 * The value overlay adjustment is ONE component alongside existing adjustments:
 * - Pace dynamics & bias (±10)
 * - Form cycle & conditioning (±15)
 * - Trip analysis & trouble (±10)
 * - Class movement & competition (±12)
 * - Connection micro-edges (±8)
 * - Distance & surface optimization (±6)
 * - Head-to-head & tactical (±6)
 * - VALUE OVERLAY (this function) (±25 max, but contributes to ±40 total cap)
 *
 * @param trueOverlayPercent - True overlay percentage
 * @param ev - Expected value per $1 bet
 * @returns Adjustment points and reasoning
 */
export function calculateOverlayAdjustment(
  trueOverlayPercent: number,
  ev: number
): { points: number; reasoning: string } {
  if (!Number.isFinite(trueOverlayPercent) || !Number.isFinite(ev)) {
    return { points: 0, reasoning: 'Invalid overlay or EV data' };
  }

  const { value: thresholds, adjustments } = OVERLAY_CONFIG;

  // Strong overlay (15%+) with positive EV: +15 to +25 points
  if (trueOverlayPercent >= thresholds.strongOverlay && ev >= OVERLAY_CONFIG.ev.slightPositive) {
    // Scale points based on overlay magnitude (15% → +15, 30%+ → +25)
    const scaleFactor = Math.min(1, (trueOverlayPercent - 15) / 15);
    const { strongOverlay } = adjustments.points;
    const points = Math.round(
      strongOverlay.min + scaleFactor * (strongOverlay.max - strongOverlay.min)
    );
    return {
      points,
      reasoning: `Strong value: ${trueOverlayPercent.toFixed(1)}% overlay with ${(ev * 100).toFixed(1)}% EV`,
    };
  }

  // Moderate overlay (8-15%) with positive EV: +8 to +15 points
  if (trueOverlayPercent >= thresholds.moderateOverlay && ev >= OVERLAY_CONFIG.ev.slightPositive) {
    const scaleFactor = (trueOverlayPercent - 8) / 7; // 8% → 0, 15% → 1
    const { moderateOverlay } = adjustments.points;
    const points = Math.round(
      moderateOverlay.min + scaleFactor * (moderateOverlay.max - moderateOverlay.min)
    );
    return {
      points,
      reasoning: `Good value: ${trueOverlayPercent.toFixed(1)}% overlay with ${(ev * 100).toFixed(1)}% EV`,
    };
  }

  // Slight overlay (3-8%) with positive EV: +3 to +8 points
  if (trueOverlayPercent >= thresholds.slightOverlay && ev >= OVERLAY_CONFIG.ev.negative) {
    const scaleFactor = (trueOverlayPercent - 3) / 5; // 3% → 0, 8% → 1
    const { slightOverlay } = adjustments.points;
    const points = Math.round(
      slightOverlay.min + scaleFactor * (slightOverlay.max - slightOverlay.min)
    );
    return {
      points,
      reasoning: `Slight value: ${trueOverlayPercent.toFixed(1)}% overlay`,
    };
  }

  // Neutral zone: 0 points
  if (trueOverlayPercent >= thresholds.underlayThreshold) {
    return {
      points: 0,
      reasoning: `Neutral: ${trueOverlayPercent.toFixed(1)}% (within fair price range)`,
    };
  }

  // Underlay with negative EV: -5 to -20 points
  // Scale based on underlay severity
  const underlayMagnitude = Math.abs(trueOverlayPercent);
  const { underlay } = adjustments.points;

  // -3% to -10% → -5 to -10 points
  // -10% to -20%+ → -10 to -20 points
  let points: number;
  if (underlayMagnitude < 10) {
    const scaleFactor = (underlayMagnitude - 3) / 7; // 3% → 0, 10% → 1
    points = Math.round(underlay.max + scaleFactor * (-10 - underlay.max));
  } else {
    const scaleFactor = Math.min(1, (underlayMagnitude - 10) / 10); // 10% → 0, 20% → 1
    points = Math.round(-10 + scaleFactor * (underlay.min - -10));
  }

  return {
    points,
    reasoning: `Underlay: ${trueOverlayPercent.toFixed(1)}% (poor value, market overpriced)`,
  };
}

// ============================================================================
// OVERLAY CALCULATION HELPERS
// ============================================================================

/**
 * Calculate true overlay percentage
 *
 * True overlay = (modelProb - normalizedMarketProb) / normalizedMarketProb × 100
 *
 * @param modelProb - Model probability (0-1)
 * @param normalizedMarketProb - Normalized market probability (0-1)
 * @returns True overlay percentage
 */
export function calculateTrueOverlay(modelProb: number, normalizedMarketProb: number): number {
  if (!Number.isFinite(modelProb) || !Number.isFinite(normalizedMarketProb)) {
    return 0;
  }

  if (normalizedMarketProb <= 0.001) {
    return 0; // Avoid division by zero
  }

  return ((modelProb - normalizedMarketProb) / normalizedMarketProb) * 100;
}

/**
 * Calculate raw overlay percentage (without normalization)
 *
 * @param modelProb - Model probability (0-1)
 * @param rawImpliedProb - Raw implied probability from odds (0-1)
 * @returns Raw overlay percentage
 */
export function calculateRawOverlay(modelProb: number, rawImpliedProb: number): number {
  if (!Number.isFinite(modelProb) || !Number.isFinite(rawImpliedProb)) {
    return 0;
  }

  if (rawImpliedProb <= 0.001) {
    return 0; // Avoid division by zero
  }

  return ((modelProb - rawImpliedProb) / rawImpliedProb) * 100;
}

/**
 * Convert decimal odds to display string (e.g., "5-1")
 */
function oddsToDisplay(decimalOdds: number): string {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1.0) {
    return 'EVEN';
  }

  const profit = decimalOdds - 1;

  // Common fractional odds lookup
  const commonOdds: [number, string][] = [
    [0.2, '1-5'],
    [0.25, '1-4'],
    [0.33, '1-3'],
    [0.5, '1-2'],
    [0.6, '3-5'],
    [0.667, '2-3'],
    [0.8, '4-5'],
    [1.0, 'EVEN'],
    [1.2, '6-5'],
    [1.5, '3-2'],
    [1.8, '9-5'],
    [2.0, '2-1'],
    [2.5, '5-2'],
    [3.0, '3-1'],
    [3.5, '7-2'],
    [4.0, '4-1'],
    [5.0, '5-1'],
    [6.0, '6-1'],
    [7.0, '7-1'],
    [8.0, '8-1'],
    [9.0, '9-1'],
    [10.0, '10-1'],
    [12.0, '12-1'],
    [15.0, '15-1'],
    [20.0, '20-1'],
    [30.0, '30-1'],
    [50.0, '50-1'],
    [99.0, '99-1'],
  ];

  // Find closest match
  let closest = 'EVEN';
  let minDiff = Infinity;

  for (const [value, display] of commonOdds) {
    const diff = Math.abs(profit - value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = display;
    }
  }

  return closest;
}

// ============================================================================
// MAIN PIPELINE FUNCTION
// ============================================================================

/**
 * Calculate the complete overlay pipeline for a field of horses
 *
 * This is the single entry point for all overlay-related calculations:
 * 1. Extracts all scores and converts to softmax probabilities
 * 2. Parses and normalizes market odds (removes vig)
 * 3. Calculates true overlay for each horse
 * 4. Classifies value
 * 5. Calculates expected value
 * 6. Determines overlay adjustment points
 *
 * @param input - Pipeline input with horses, scores, and odds
 * @returns Complete pipeline output with all metrics
 *
 * @example
 * const result = calculateOverlayPipeline({
 *   horses: [
 *     { programNumber: 1, baseScore: 200, finalScore: 210, morningLineOdds: "2-1" },
 *     { programNumber: 2, baseScore: 180, finalScore: 190, morningLineOdds: "3-1" },
 *     // ... more horses
 *   ],
 *   useNormalization: true,
 *   temperature: 1.0
 * });
 */
export function calculateOverlayPipeline(input: OverlayPipelineInput): OverlayPipelineOutput {
  const useNormalization = input.useNormalization ?? OVERLAY_CONFIG.market.useNormalization;
  const temperature = input.temperature ?? OVERLAY_CONFIG.softmax.temperature;

  // Handle empty input
  if (!input.horses || input.horses.length === 0) {
    return {
      horses: [],
      fieldMetrics: {
        overround: 0,
        takeoutPercent: 0,
        averageModelProb: 0,
        probsValidated: false,
        fieldSize: 0,
        bestValueHorse: null,
        bestOverlayPercent: 0,
      },
      config: { temperature, useNormalization },
      calibrationApplied: false,
    };
  }

  // Step 1: Extract scores for softmax
  const scores = input.horses.map((h) => h.finalScore);

  // Step 2: Calculate softmax probabilities from scores
  const modelProbs = softmaxProbabilities(scores, temperature);

  // Step 3: Parse all odds to decimal format
  const decimalOdds = input.horses.map((h) => {
    const odds = h.liveOdds ?? h.morningLineOdds;
    if (typeof odds === 'number') {
      return odds >= 1.01 ? odds : odds + 1; // Assume X-1 format if small number
    }
    return parseOddsString(odds);
  });

  // Step 4: Calculate implied probabilities from odds
  const impliedProbs = decimalOdds.map(oddsToImpliedProbability);

  // Step 5: Calculate field metrics
  const overround = calculateOverround(impliedProbs);
  const takeoutPercent = calculateTakeoutPercent(overround);

  // Step 6: Normalize market probabilities (removes vig)
  const normalizedProbs = useNormalization
    ? normalizeMarketProbabilities(impliedProbs)
    : impliedProbs;

  // Step 7: Validate model probabilities sum to ~1.0
  const modelProbSum = modelProbs.reduce((sum, p) => sum + p, 0);
  const probsValidated = Math.abs(modelProbSum - 1.0) < OVERLAY_CONFIG.validation.sumTolerance;

  // Step 8: Process each horse
  let bestOverlayPercent = -Infinity;
  let bestValueHorse: number | null = null;

  const horseOutputs: OverlayHorseOutput[] = input.horses.map((horse, index) => {
    const modelProb = modelProbs[index] ?? 0;
    const rawImpliedProb = impliedProbs[index] ?? 0;
    const normalizedMarketProb = normalizedProbs[index] ?? rawImpliedProb;
    const actualOdds = decimalOdds[index] ?? 2.0;

    // Calculate overlays
    const trueOverlayPercent = calculateTrueOverlay(modelProb, normalizedMarketProb);
    const rawOverlayPercent = calculateRawOverlay(modelProb, rawImpliedProb);

    // Calculate fair odds from model probability
    const fairOdds = probabilityToFairOdds(modelProb);

    // Calculate expected value
    const expectedValue = calculateExpectedValue(modelProb, actualOdds);
    const evPercent = expectedValue * 100;

    // Classify
    const valueClassification = classifyTrueOverlay(trueOverlayPercent);
    const evClassification = classifyEV(expectedValue);

    // Calculate overlay adjustment
    const adjustment = calculateOverlayAdjustment(trueOverlayPercent, expectedValue);

    // Track best value
    if (trueOverlayPercent > bestOverlayPercent) {
      bestOverlayPercent = trueOverlayPercent;
      bestValueHorse = horse.programNumber;
    }

    // Format odds for display
    const originalOdds = horse.liveOdds ?? horse.morningLineOdds;
    const actualOddsDisplay =
      typeof originalOdds === 'string' ? originalOdds : oddsToDisplay(actualOdds);

    return {
      programNumber: horse.programNumber,
      horseName: horse.horseName,

      // Probability metrics
      modelProbability: modelProb,
      rawImpliedProbability: rawImpliedProb,
      normalizedMarketProbability: normalizedMarketProb,

      // Overlay metrics
      trueOverlayPercent: Math.round(trueOverlayPercent * 10) / 10,
      rawOverlayPercent: Math.round(rawOverlayPercent * 10) / 10,

      // Fair odds
      fairOdds,
      fairOddsDisplay: oddsToDisplay(fairOdds),
      actualOdds,
      actualOddsDisplay,

      // Value classification
      valueClassification,
      valueLabel: VALUE_CLASS_LABELS[valueClassification],
      valueColor: VALUE_CLASS_COLORS[valueClassification],
      valueIcon: VALUE_CLASS_ICONS[valueClassification],

      // Expected value
      expectedValue: Math.round(expectedValue * 1000) / 1000,
      evPercent: Math.round(evPercent * 10) / 10,
      evClassification,
      evLabel: EV_CLASS_LABELS[evClassification],
      isPositiveEV: expectedValue > 0,

      // Overlay adjustment
      overlayAdjustment: adjustment.points,
      adjustmentReasoning: adjustment.reasoning,

      // Original inputs
      baseScore: horse.baseScore,
      finalScore: horse.finalScore,
    };
  });

  // Calculate average model probability
  const averageModelProb = modelProbs.reduce((sum, p) => sum + p, 0) / modelProbs.length;

  // Check if calibration was applied (softmaxProbabilities applies it automatically when ready)
  const calibrationApplied = isCalibrationActive();

  // Build result with calibration info
  const result: OverlayPipelineOutput = {
    horses: horseOutputs,
    fieldMetrics: {
      overround: Math.round(overround * 1000) / 1000,
      takeoutPercent: Math.round(takeoutPercent * 10) / 10,
      averageModelProb: Math.round(averageModelProb * 1000) / 1000,
      probsValidated,
      fieldSize: input.horses.length,
      bestValueHorse: bestOverlayPercent > 0 ? bestValueHorse : null,
      bestOverlayPercent: Math.round(bestOverlayPercent * 10) / 10,
    },
    config: { temperature, useNormalization },
    calibrationApplied,
  };

  // Add calibration metrics if calibration was applied
  // Note: Calibration metrics are retrieved lazily to avoid circular dependencies
  // The calibrationManager getter will be set up during initialization
  if (calibrationApplied) {
    // Calibration metrics are stored in the calibrationManager
    // These can be retrieved via the getCalibrationMetrics function
    // For now, we indicate that calibration was applied; detailed metrics
    // can be fetched separately via calibrationManager.getMetrics()
  }

  return result;
}

// ============================================================================
// INTEGRATION WITH SCORING ENGINE
// ============================================================================

/**
 * Enhanced scoring result that includes overlay pipeline data
 */
export interface EnhancedScoringResult {
  /** Original scoring data (all fields preserved) */
  originalScore: HorseScore;

  /** Overlay pipeline output for this horse */
  overlayPipeline: OverlayHorseOutput;

  /** Updated final score (base + all overlay adjustments including value) */
  enhancedFinalScore: number;

  /** Updated tier based on enhanced final score */
  enhancedTier: string;

  /** Program number */
  programNumber: number;

  /** Whether the value overlay adjustment was applied */
  valueOverlayApplied: boolean;
}

/**
 * Tier thresholds for classification
 * Based on base score ranges from the scoring engine
 */
const TIER_THRESHOLDS = {
  elite: 255, // 80%+ of 319 base score
  strong: 207, // 65-80% of 319 base score
  contender: 160, // 50-65% of 319 base score
  fair: 112, // 35-50% of 319 base score
  weak: 0, // Below 35%
} as const;

/**
 * Get tier name based on score
 */
function getTierFromScore(score: number): string {
  if (score >= TIER_THRESHOLDS.elite) return 'Elite';
  if (score >= TIER_THRESHOLDS.strong) return 'Strong';
  if (score >= TIER_THRESHOLDS.contender) return 'Contender';
  if (score >= TIER_THRESHOLDS.fair) return 'Fair';
  return 'Weak';
}

/**
 * Enhance a scoring result with overlay pipeline data
 *
 * Takes an existing ScoringResult and adds overlay pipeline analysis.
 * Preserves all original fields while adding new ones.
 *
 * @param scoringResult - Original scoring result from the scoring engine
 * @param marketOdds - Map of program number to decimal odds
 * @param fieldScores - Array of all field scores for softmax calculation
 * @returns Enhanced scoring result with overlay pipeline data
 */
export function enhanceScoringWithOverlay(
  scoringResult: HorseScore,
  programNumber: number,
  marketOdds: Map<number, number>,
  fieldData: Array<{ programNumber: number; baseScore: number; finalScore: number }>
): EnhancedScoringResult {
  // Build pipeline input from field data
  const pipelineInput: OverlayPipelineInput = {
    horses: fieldData.map((h) => ({
      programNumber: h.programNumber,
      baseScore: h.baseScore,
      finalScore: h.finalScore,
      morningLineOdds: marketOdds.get(h.programNumber) ?? 2.0,
    })),
    useNormalization: true,
  };

  // Run pipeline
  const pipelineOutput = calculateOverlayPipeline(pipelineInput);

  // Find this horse's output
  const horseOutput = pipelineOutput.horses.find((h) => h.programNumber === programNumber);

  if (!horseOutput) {
    // Fallback if horse not found
    return {
      originalScore: scoringResult,
      overlayPipeline: {
        programNumber,
        modelProbability: 0,
        rawImpliedProbability: 0,
        normalizedMarketProbability: 0,
        trueOverlayPercent: 0,
        rawOverlayPercent: 0,
        fairOdds: 2.0,
        fairOddsDisplay: 'EVEN',
        actualOdds: 2.0,
        actualOddsDisplay: 'EVEN',
        valueClassification: 'NEUTRAL',
        valueLabel: 'Fair Price',
        valueColor: VALUE_CLASS_COLORS.NEUTRAL,
        valueIcon: VALUE_CLASS_ICONS.NEUTRAL,
        expectedValue: 0,
        evPercent: 0,
        evClassification: 'neutral',
        evLabel: 'Break Even',
        isPositiveEV: false,
        overlayAdjustment: 0,
        adjustmentReasoning: 'No data available',
        baseScore: scoringResult.baseScore,
        finalScore: scoringResult.total,
      },
      enhancedFinalScore: scoringResult.total,
      enhancedTier: getTierFromScore(scoringResult.baseScore),
      programNumber,
      valueOverlayApplied: false,
    };
  }

  // Calculate enhanced final score
  // The value overlay adjustment is added to the existing overlay score
  // But we need to respect the ±40 total cap
  const existingOverlay = scoringResult.overlayScore;
  const valueAdjustment = horseOutput.overlayAdjustment;

  // Calculate new total overlay (capped at ±40)
  const rawTotalOverlay = existingOverlay + valueAdjustment;
  const cappedTotalOverlay = Math.max(-40, Math.min(40, rawTotalOverlay));

  // New final score
  const enhancedFinalScore = scoringResult.baseScore + cappedTotalOverlay;

  return {
    originalScore: scoringResult,
    overlayPipeline: horseOutput,
    enhancedFinalScore: Math.max(0, enhancedFinalScore),
    enhancedTier: getTierFromScore(scoringResult.baseScore),
    programNumber,
    valueOverlayApplied: valueAdjustment !== 0,
  };
}

// ============================================================================
// CALIBRATION LOGGING
// ============================================================================

/**
 * Prediction record for calibration
 */
export interface CalibrationPrediction {
  /** Race identifier */
  raceId: string;
  /** Program number */
  programNumber: number;
  /** Model probability (0-1) */
  modelProbability: number;
  /** Implied probability from odds (0-1) */
  impliedProbability: number;
  /** Final score */
  finalScore: number;
  /** Tier classification */
  tier: string;
  /** Value classification */
  valueClassification: PipelineValueClass;
  /** True overlay percentage */
  trueOverlayPercent: number;
  /** Expected value */
  expectedValue: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Log pipeline output for calibration analysis
 *
 * Creates calibration records that can be stored and later analyzed
 * to determine model accuracy (do horses we give 30% win at that rate?)
 *
 * @param pipelineOutput - Output from calculateOverlayPipeline
 * @param raceId - Unique identifier for the race
 * @param shouldLog - Whether to actually log (allows conditional logging)
 * @returns Array of calibration predictions
 */
export function createCalibrationRecords(
  pipelineOutput: OverlayPipelineOutput,
  raceId: string,
  shouldLog: boolean = true
): CalibrationPrediction[] {
  if (!shouldLog || !pipelineOutput.horses.length) {
    return [];
  }

  const timestamp = Date.now();

  return pipelineOutput.horses.map((horse) => ({
    raceId,
    programNumber: horse.programNumber,
    modelProbability: horse.modelProbability,
    impliedProbability: horse.rawImpliedProbability,
    finalScore: horse.finalScore,
    tier: getTierFromScore(horse.baseScore),
    valueClassification: horse.valueClassification,
    trueOverlayPercent: horse.trueOverlayPercent,
    expectedValue: horse.expectedValue,
    timestamp,
  }));
}

/**
 * Hook for logging predictions for calibration
 *
 * This is a placeholder that can be connected to a calibration storage system.
 * Currently returns the records for manual handling.
 *
 * @param pipelineOutput - Output from calculateOverlayPipeline
 * @param raceId - Unique identifier for the race
 * @param shouldLog - Whether to log (default: true)
 * @returns Promise resolving to calibration predictions
 */
export async function logForCalibration(
  pipelineOutput: OverlayPipelineOutput,
  raceId: string,
  shouldLog: boolean = true
): Promise<CalibrationPrediction[]> {
  const records = createCalibrationRecords(pipelineOutput, raceId, shouldLog);

  // TODO: Connect to calibration storage system when available
  // For now, just return the records for manual handling
  // Example future integration:
  // await calibrationStorage.logPredictions(records);

  return records;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get value classification details
 */
export function getValueClassDetails(classification: PipelineValueClass): {
  label: string;
  color: string;
  icon: string;
} {
  return {
    label: VALUE_CLASS_LABELS[classification],
    color: VALUE_CLASS_COLORS[classification],
    icon: VALUE_CLASS_ICONS[classification],
  };
}

/**
 * Get EV classification details
 */
export function getEVClassDetails(classification: EVClassification): {
  label: string;
  color: string;
} {
  const colors: Record<EVClassification, string> = {
    strongPositive: '#22c55e',
    moderatePositive: '#4ade80',
    slightPositive: '#86efac',
    neutral: '#9ca3af',
    negative: '#ef4444',
  };

  return {
    label: EV_CLASS_LABELS[classification],
    color: colors[classification],
  };
}

/**
 * Format overlay percentage for display
 */
export function formatOverlayPercent(percent: number): string {
  if (!Number.isFinite(percent)) return '—';
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(1)}%`;
}

/**
 * Format expected value for display
 */
export function formatExpectedValue(ev: number): string {
  if (!Number.isFinite(ev)) return '—';
  const sign = ev >= 0 ? '+' : '';
  return `${sign}${(ev * 100).toFixed(1)}% EV`;
}

/**
 * Check if a horse represents value based on overlay analysis
 */
export function isValueBet(trueOverlayPercent: number, ev: number): boolean {
  return (
    trueOverlayPercent >= OVERLAY_CONFIG.value.slightOverlay && ev >= OVERLAY_CONFIG.ev.negative
  );
}

/**
 * Check if a horse is an underlay (poor value)
 */
export function isUnderlay(trueOverlayPercent: number): boolean {
  return trueOverlayPercent < OVERLAY_CONFIG.value.underlayThreshold;
}
