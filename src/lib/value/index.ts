/**
 * Value Betting Module
 *
 * Comprehensive system for identifying value betting opportunities
 * and market inefficiencies in horse racing.
 *
 * Core Components:
 * - valueDetector: Core EV calculations and value classifications
 * - marketInefficiency: Pattern detection for market mispricings
 * - valueBetting: Strategy generation based on value analysis
 * - confidenceCalibration: Probability calibration and tracking
 *
 * @module value
 */

// ============================================================================
// VALUE DETECTOR EXPORTS
// ============================================================================

export {
  // Main functions
  analyzeValue,
  analyzeRaceValue,
  scoreToWinProbability,
  oddsToMarketProbability,
  calculateEV,
  calculateEdge,
  calculateOverlayPercent,
  classifyValue,
  probabilityToFairOdds,
  formatOddsDisplay,

  // Display helpers
  formatEVPercent,
  formatEdge,
  getEVColor,
  getEVBgColor,
  getValueIcon,
  getValueShortLabel,
  isValuePlay,
  getValueSummary,

  // Constants
  EV_THRESHOLDS,
  VALUE_CLASSIFICATION_META,

  // Types
  type ValueClassification,
  type ValueAnalysis,
  type ValueAnalysisBatch,
} from './valueDetector';

// ============================================================================
// MARKET INEFFICIENCY EXPORTS
// ============================================================================

export {
  // Main functions
  analyzeMarketInefficiency,
  analyzeRaceInefficiencies,
  getBestInefficiencyPlays,

  // Display helpers
  getInefficiencyIcon,
  getInefficiencyColor,
  formatMagnitude,
  getInefficiencyBadge,

  // Constants
  INEFFICIENCY_META,

  // Types
  type InefficiencyType,
  type InefficiencyDirection,
  type InefficiencyDetection,
  type MarketInefficiencyAnalysis,
} from './marketInefficiency';

// ============================================================================
// VALUE BETTING EXPORTS
// ============================================================================

export {
  // Main functions
  generateValueBettingPlan,
  getPureValueStrategy,
  getBalancedValueStrategy,
  getConservativeValueStrategy,

  // Display helpers
  formatValueBetDisplay,
  getValueBetColor,
  getValueBetIcon,
  getUrgencyColor,
  formatBetSizing,

  // Constants
  DEFAULT_STRATEGY_CONFIG,
  MODE_EV_THRESHOLDS,
  MODE_CONFIDENCE_THRESHOLDS,

  // Types
  type ValueStrategyMode,
  type ValueBet,
  type ValueBettingPlan,
  type ValueStrategyConfig,
} from './valueBetting';

// ============================================================================
// ODDS CONFIDENCE EXPORTS
// ============================================================================

export {
  // Main function
  getOddsWithSource,

  // Helper functions
  getOddsSourceLabel,
  getOddsSourceDescription,
  isConfidenceHighEnough,
  getConfidenceLevel,
  getConfidenceColor,
  getEVConfidenceMultiplier,
  getOddsWarning,

  // Constants
  ODDS_CONFIDENCE,
  DEFAULT_FALLBACK_ODDS,

  // Types
  type OddsSource,
  type OddsInfo,
} from './oddsConfidence';

// ============================================================================
// CONFIDENCE CALIBRATION EXPORTS
// ============================================================================

export {
  // Main functions
  getDefaultCalibration,
  scoreToWinProbability as calibratedScoreToWinProbability,
  probabilityToScoreRange,
  calculateBrierScore,
  calculateLogLoss,
  calculateCalibrationError,
  calculateTierMetrics,
  calculateCalibrationMetrics,
  generateCalibrationSummary,
  suggestAdjustedProbabilities,

  // Storage helpers
  saveCalibrationResult,
  loadCalibrationResults,
  saveCalibrationProfile,
  loadCalibrationProfile,
  clearCalibrationData,

  // Constants
  DEFAULT_TIERS,
  BRIER_THRESHOLDS,
  MIN_CALIBRATION_SAMPLES,

  // Types
  type ScoreTier,
  type CalibrationProfile,
  type CalibrationResult,
  type CalibrationMetrics,
  type TierMetrics,
  type CalibrationSummary,
} from './confidenceCalibration';

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import type { HorseEntry, RaceHeader } from '../../types/drf';
import type { HorseScore } from '../scoring';
import { analyzeValue } from './valueDetector';
import { analyzeMarketInefficiency } from './marketInefficiency';
import { generateValueBettingPlan } from './valueBetting';
import { loadCalibrationProfile } from './confidenceCalibration';

/**
 * Complete value analysis for a race
 *
 * Convenience function that runs all value analysis in one call
 */
export function analyzeRaceValueComplete(
  horses: Array<{ horse: HorseEntry; score: HorseScore }>,
  raceHeader: RaceHeader,
  options?: {
    budget?: number;
    mode?: 'pure_value' | 'balanced_value' | 'conservative_value';
  }
): {
  valueAnalyses: Array<{
    horse: HorseEntry;
    score: HorseScore;
    value: ReturnType<typeof analyzeValue>;
  }>;
  inefficiencies: Array<{
    horse: HorseEntry;
    score: HorseScore;
    inefficiency: ReturnType<typeof analyzeMarketInefficiency>;
  }>;
  bettingPlan: ReturnType<typeof generateValueBettingPlan>;
} {
  const calibration = loadCalibrationProfile();

  // Analyze value for each horse
  const valueAnalyses = horses.map(({ horse, score }) => ({
    horse,
    score,
    value: analyzeValue(horse, score, calibration),
  }));

  // Analyze inefficiencies
  const inefficiencies = horses.map(({ horse, score }) => ({
    horse,
    score,
    inefficiency: analyzeMarketInefficiency(horse, score, raceHeader),
  }));

  // Generate betting plan
  const bettingPlan = generateValueBettingPlan(horses, raceHeader, {
    raceBudget: options?.budget ?? 50,
    mode: options?.mode ?? 'balanced_value',
    calibration,
  });

  return {
    valueAnalyses,
    inefficiencies,
    bettingPlan,
  };
}

/**
 * Quick check if any value bets exist in a race
 */
export function hasValueBets(
  horses: Array<{ horse: HorseEntry; score: HorseScore }>,
  minEVPercent: number = 5
): boolean {
  const calibration = loadCalibrationProfile();

  return horses.some(({ horse, score }) => {
    if (score.isScratched) return false;
    const value = analyzeValue(horse, score, calibration);
    return value.evPercent >= minEVPercent;
  });
}

/**
 * Get the best value bet in a race
 */
export function getBestValueBet(
  horses: Array<{ horse: HorseEntry; score: HorseScore }>
): { horse: HorseEntry; score: HorseScore; value: ReturnType<typeof analyzeValue> } | null {
  const calibration = loadCalibrationProfile();

  let best: {
    horse: HorseEntry;
    score: HorseScore;
    value: ReturnType<typeof analyzeValue>;
  } | null = null;
  let bestEV = -Infinity;

  for (const { horse, score } of horses) {
    if (score.isScratched) continue;
    const value = analyzeValue(horse, score, calibration);

    if (value.evPercent > bestEV) {
      bestEV = value.evPercent;
      best = { horse, score, value };
    }
  }

  return best;
}

/**
 * Count positive EV horses in a race
 */
export function countPositiveEVHorses(
  horses: Array<{ horse: HorseEntry; score: HorseScore }>
): number {
  const calibration = loadCalibrationProfile();

  return horses.filter(({ horse, score }) => {
    if (score.isScratched) return false;
    const value = analyzeValue(horse, score, calibration);
    return value.isPositiveEV;
  }).length;
}
