/**
 * Weight Analysis Module
 *
 * Analyzes weight carried and weight changes between races as a scoring factor.
 * Weight is parsed from DRF Field 51 (current race) and Field 436+ (past performances).
 *
 * This is a P2 refinement - subtle adjustments only (max ±1 point impact).
 *
 * SCORING LOGIC:
 * - 5+ lb drop from last race: +1 pt
 * - 3-4 lb drop: +0.5 pt
 * - No significant change (±2 lbs): 0 pts
 * - 3-4 lb gain: -0.5 pt (flag only, no deduction per requirements)
 * - 5+ lb gain: -1 pt (flag only in handicap races)
 *
 * HANDICAPPING RATIONALE:
 * Weight is a secondary factor in horse racing handicapping. While significant
 * weight drops can help a horse (less to carry = faster times), and weight
 * increases can hinder (especially in handicap races where better horses are
 * assigned more weight), the impact is subtle compared to form, class, and pace.
 *
 * Total: 0-1 points max (1 point contribution to MAX_BASE_SCORE)
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of analyzing weight changes for a horse
 */
export interface WeightAnalysisResult {
  /** Today's assigned weight in pounds */
  currentWeight: number;
  /** Weight carried in last race (null if no past races) */
  lastRaceWeight: number | null;
  /** Weight change from last race (positive = gained, negative = dropped) */
  weightChange: number | null;
  /** True if horse is dropping 5+ lbs from last race */
  significantDrop: boolean;
  /** True if horse is gaining 5+ lbs from last race */
  significantGain: boolean;
  /** Human-readable explanation of weight analysis */
  reasoning: string;
}

/**
 * Weight score result for scoring system integration
 */
export interface WeightScoreResult {
  /** Points awarded (0 to 1, subtle P2 adjustment) */
  total: number;
  /** Full weight analysis details */
  analysis: WeightAnalysisResult;
  /** Reasoning for score display */
  reasoning: string;
  /** Whether weight gain flag should be shown (informational) */
  showWeightGainFlag: boolean;
  /** Whether this is a handicap race (weight gain more significant) */
  isHandicapRace: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum points for weight scoring (P2 subtle adjustment) */
export const MAX_WEIGHT_POINTS = 1;

/** Threshold for significant weight drop (lbs) */
const SIGNIFICANT_DROP_THRESHOLD = 5;

/** Threshold for moderate weight drop (lbs) */
const MODERATE_DROP_THRESHOLD = 3;

/** Threshold for significant weight gain (lbs) */
const SIGNIFICANT_GAIN_THRESHOLD = 5;

/** Threshold for moderate weight gain (lbs) */
const MODERATE_GAIN_THRESHOLD = 3;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine if race classification is a handicap race
 * In handicap races, weight is assigned based on ability - weight gains are more significant
 */
function isHandicapRace(raceHeader: RaceHeader): boolean {
  return raceHeader.classification === 'handicap';
}

/**
 * Get the weight from the most recent past performance
 */
function getLastRaceWeight(horse: HorseEntry): number | null {
  if (horse.pastPerformances.length === 0) {
    return null;
  }

  const lastPP = horse.pastPerformances[0];
  if (!lastPP || lastPP.weight === 0) {
    return null;
  }

  return lastPP.weight;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Analyze weight change between last race and today
 *
 * @param horse - The horse entry to analyze
 * @returns Weight analysis including current weight, change, and significance
 */
export function analyzeWeightChange(horse: HorseEntry): WeightAnalysisResult {
  const currentWeight = horse.weight || 0;
  const lastRaceWeight = getLastRaceWeight(horse);

  // No last race weight available
  if (lastRaceWeight === null || currentWeight === 0) {
    return {
      currentWeight,
      lastRaceWeight,
      weightChange: null,
      significantDrop: false,
      significantGain: false,
      reasoning:
        lastRaceWeight === null
          ? 'No weight history available (first-time starter or no PP data)'
          : 'Current weight not available',
    };
  }

  // Calculate weight change (positive = gained weight, negative = dropped weight)
  const weightChange = currentWeight - lastRaceWeight;

  // Determine significance
  const significantDrop = weightChange <= -SIGNIFICANT_DROP_THRESHOLD;
  const significantGain = weightChange >= SIGNIFICANT_GAIN_THRESHOLD;

  // Build reasoning
  let reasoning: string;
  if (weightChange === 0) {
    reasoning = `Same weight as last race (${currentWeight} lbs)`;
  } else if (weightChange < 0) {
    const absChange = Math.abs(weightChange);
    if (significantDrop) {
      reasoning = `Significant drop: ${absChange} lbs lighter (${lastRaceWeight} → ${currentWeight})`;
    } else if (absChange >= MODERATE_DROP_THRESHOLD) {
      reasoning = `Moderate drop: ${absChange} lbs lighter (${lastRaceWeight} → ${currentWeight})`;
    } else {
      reasoning = `Minor change: ${absChange} lbs lighter (${lastRaceWeight} → ${currentWeight})`;
    }
  } else {
    if (significantGain) {
      reasoning = `Significant gain: ${weightChange} lbs heavier (${lastRaceWeight} → ${currentWeight})`;
    } else if (weightChange >= MODERATE_GAIN_THRESHOLD) {
      reasoning = `Moderate gain: ${weightChange} lbs heavier (${lastRaceWeight} → ${currentWeight})`;
    } else {
      reasoning = `Minor change: ${weightChange} lbs heavier (${lastRaceWeight} → ${currentWeight})`;
    }
  }

  return {
    currentWeight,
    lastRaceWeight,
    weightChange,
    significantDrop,
    significantGain,
    reasoning,
  };
}

/**
 * Calculate weight score for a horse
 *
 * This is a subtle P2 refinement with max ±1 point impact:
 * - 5+ lb drop: +1 pt
 * - 3-4 lb drop: +0.5 pt
 * - No significant change: 0 pts
 * - Weight gains are flagged but don't subtract points per requirements
 *
 * @param horse - The horse entry to score
 * @param raceHeader - Race header for handicap race detection
 * @returns Weight score result
 */
export function calculateWeightScore(horse: HorseEntry, raceHeader: RaceHeader): WeightScoreResult {
  const analysis = analyzeWeightChange(horse);
  const handicapRace = isHandicapRace(raceHeader);

  // No weight data available - neutral score
  if (analysis.weightChange === null) {
    return {
      total: 0,
      analysis,
      reasoning: analysis.reasoning,
      showWeightGainFlag: false,
      isHandicapRace: handicapRace,
    };
  }

  let score = 0;
  let reasoning = analysis.reasoning;
  let showWeightGainFlag = false;

  // Calculate score based on weight change
  if (analysis.weightChange <= -SIGNIFICANT_DROP_THRESHOLD) {
    // 5+ lb drop: +1 pt
    score = 1;
    reasoning = `${analysis.reasoning} — Weight drop bonus (+1)`;
  } else if (analysis.weightChange <= -MODERATE_DROP_THRESHOLD) {
    // 3-4 lb drop: +0.5 pt
    score = 0.5;
    reasoning = `${analysis.reasoning} — Moderate drop bonus (+0.5)`;
  } else if (analysis.weightChange >= SIGNIFICANT_GAIN_THRESHOLD) {
    // 5+ lb gain: flag only (no deduction per requirements)
    // In handicap races, this is more noteworthy
    showWeightGainFlag = true;
    reasoning = handicapRace
      ? `${analysis.reasoning} — Note: significant weight gain in handicap race`
      : `${analysis.reasoning} — Note: significant weight gain`;
  } else if (analysis.weightChange >= MODERATE_GAIN_THRESHOLD) {
    // 3-4 lb gain: flag only (no deduction per requirements)
    showWeightGainFlag = true;
    reasoning = `${analysis.reasoning} — Note: moderate weight gain`;
  }
  // Otherwise: no significant change, 0 pts

  return {
    total: Math.min(MAX_WEIGHT_POINTS, Math.max(0, score)),
    analysis,
    reasoning,
    showWeightGainFlag,
    isHandicapRace: handicapRace,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get a quick summary of weight change for display
 */
export function getWeightChangeSummary(horse: HorseEntry): {
  label: string;
  indicator: 'positive' | 'negative' | 'neutral';
} {
  const analysis = analyzeWeightChange(horse);

  if (analysis.weightChange === null) {
    return { label: 'N/A', indicator: 'neutral' };
  }

  if (analysis.significantDrop) {
    return { label: `↓${Math.abs(analysis.weightChange)} lbs`, indicator: 'positive' };
  }

  if (analysis.weightChange <= -MODERATE_DROP_THRESHOLD) {
    return { label: `↓${Math.abs(analysis.weightChange)} lbs`, indicator: 'positive' };
  }

  if (analysis.significantGain) {
    return { label: `↑${analysis.weightChange} lbs`, indicator: 'negative' };
  }

  if (analysis.weightChange >= MODERATE_GAIN_THRESHOLD) {
    return { label: `↑${analysis.weightChange} lbs`, indicator: 'negative' };
  }

  if (analysis.weightChange === 0) {
    return { label: 'Same', indicator: 'neutral' };
  }

  return {
    label:
      analysis.weightChange > 0 ? `+${analysis.weightChange} lbs` : `${analysis.weightChange} lbs`,
    indicator: 'neutral',
  };
}

/**
 * Check if horse has a weight advantage (dropping weight)
 */
export function hasWeightAdvantage(horse: HorseEntry): boolean {
  const analysis = analyzeWeightChange(horse);
  return (
    analysis.significantDrop ||
    (analysis.weightChange !== null && analysis.weightChange <= -MODERATE_DROP_THRESHOLD)
  );
}

/**
 * Check if horse has a weight disadvantage (gaining significant weight)
 */
export function hasWeightDisadvantage(horse: HorseEntry): boolean {
  const analysis = analyzeWeightChange(horse);
  return analysis.significantGain;
}
