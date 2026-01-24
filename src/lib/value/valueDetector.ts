/**
 * Value Bet Detector
 *
 * Core module for identifying value betting opportunities using Expected Value (EV) analysis.
 *
 * Value bet = Expected Value is positive
 *
 * For each horse, calculates:
 * - Our win probability (from score: 200pts = 75%, 180pts = 65%, etc.)
 * - Market probability (from odds: 2/1 = 33%, 5/1 = 16.7%, etc.)
 * - Edge = Our probability - Market probability
 * - EV = (Our prob × Payout) - (Loss prob × Bet amount)
 * - EV% = EV / Bet amount × 100
 *
 * @module value/valueDetector
 */

import { logger } from '../../services/logging';
import type { HorseEntry } from '../../types/drf';
import type { HorseScore } from '../scoring';
import { parseOddsToDecimal } from '../betting/kellyCriterion';
import {
  getDefaultCalibration,
  scoreToWinProbability as calibratedWinProb,
  type CalibrationProfile,
} from './confidenceCalibration';
import {
  getOddsWithSource,
  getEVConfidenceMultiplier,
  getOddsWarning,
  type OddsSource,
} from './oddsConfidence';

// ============================================================================
// TYPES
// ============================================================================

/** Value classification based on EV% */
export type ValueClassification =
  | 'elite_value' // EV% > 50% - bet immediately
  | 'strong_value' // EV% 25-50% - excellent bet
  | 'moderate_value' // EV% 10-24% - good bet
  | 'slight_value' // EV% 5-9% - playable
  | 'no_value' // EV% 0-4% - pass
  | 'negative_value'; // EV% < 0 - avoid

/** Complete value analysis for a horse */
export interface ValueAnalysis {
  /** Program number */
  programNumber: number;
  /** Horse name */
  horseName: string;
  /** Horse's total score */
  score: number;
  /** Our calculated win probability (0-100%) */
  ourProbability: number;
  /** Market implied probability from odds (0-100%) */
  marketProbability: number;
  /** Edge: Our probability - Market probability */
  edge: number;
  /** Expected value per dollar wagered */
  evPerDollar: number;
  /** EV as percentage */
  evPercent: number;
  /** Value classification */
  classification: ValueClassification;
  /** Whether this is a positive EV bet */
  isPositiveEV: boolean;
  /** Should bet based on EV */
  shouldBet: boolean;
  /** Decimal odds */
  decimalOdds: number;
  /** Display odds string */
  oddsDisplay: string;
  /** Fair odds based on our probability */
  fairOdds: number;
  /** Fair odds display string */
  fairOddsDisplay: string;
  /** Overlay percentage (odds are better than fair) */
  overlayPercent: number;
  /** Human-readable explanation */
  explanation: string[];
  /** Recommendation string */
  recommendation: string;
  /** Bet multiplier suggestion (for Kelly integration) */
  suggestedMultiplier: number;
  /** Urgency level */
  urgency: 'immediate' | 'high' | 'standard' | 'low' | 'none';
  /** Source of odds data (live, morning_line, or default_fallback) */
  oddsSource: OddsSource;
  /** Confidence in odds data (0-100) */
  oddsConfidence: number;
  /** Warning about odds reliability (null if no warning) */
  oddsWarning: string | null;
}

/** Batch value analysis result */
export interface ValueAnalysisBatch {
  /** All analyzed horses */
  allHorses: ValueAnalysis[];
  /** Only positive EV horses */
  positiveEVHorses: ValueAnalysis[];
  /** Horses sorted by EV (best first) */
  rankedByEV: ValueAnalysis[];
  /** Elite value bets (EV > 50%) */
  eliteValue: ValueAnalysis[];
  /** Strong value bets (EV 25-50%) */
  strongValue: ValueAnalysis[];
  /** Total positive EV count */
  positiveEVCount: number;
  /** Best value play */
  bestValuePlay: ValueAnalysis | null;
  /** Summary statistics */
  stats: {
    averageEV: number;
    maxEV: number;
    minEV: number;
    totalOverlay: number;
    positiveEdgeCount: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** EV thresholds for classification (in percentages) */
export const EV_THRESHOLDS = {
  elite: 50,
  strong: 25,
  moderate: 10,
  slight: 5,
  none: 0,
} as const;

/** Classification display metadata */
export const VALUE_CLASSIFICATION_META: Record<
  ValueClassification,
  {
    name: string;
    shortName: string;
    color: string;
    bgColor: string;
    icon: string;
    action: string;
  }
> = {
  elite_value: {
    name: 'Elite Value',
    shortName: 'ELITE',
    color: '#fbbf24', // Gold
    bgColor: '#fbbf2420',
    icon: 'local_fire_department',
    action: 'Bet immediately',
  },
  strong_value: {
    name: 'Strong Value',
    shortName: 'STRONG',
    color: '#22c55e', // Green
    bgColor: '#22c55e20',
    icon: 'trending_up',
    action: 'Excellent bet',
  },
  moderate_value: {
    name: 'Moderate Value',
    shortName: 'GOOD',
    color: '#36d1da', // Teal
    bgColor: '#36d1da20',
    icon: 'thumb_up',
    action: 'Good bet',
  },
  slight_value: {
    name: 'Slight Value',
    shortName: 'SLIGHT',
    color: '#3b82f6', // Blue
    bgColor: '#3b82f620',
    icon: 'check_circle',
    action: 'Playable',
  },
  no_value: {
    name: 'No Value',
    shortName: 'PASS',
    color: '#9ca3af', // Gray
    bgColor: '#9ca3af20',
    icon: 'remove_circle',
    action: 'Pass',
  },
  negative_value: {
    name: 'Negative Value',
    shortName: 'AVOID',
    color: '#ef4444', // Red
    bgColor: '#ef444420',
    icon: 'dangerous',
    action: 'Avoid',
  },
};

// ============================================================================
// PROBABILITY CALCULATIONS
// ============================================================================

/**
 * Convert score to win probability using calibrated formula
 *
 * Default calibration:
 * - 200+ pts → 75% win probability
 * - 180-199 → 65%
 * - 160-179 → 55%
 * - 140-159 → 45%
 * - 120-139 → 35%
 * - 100-119 → 25%
 * - <100 → 15%
 */
export function scoreToWinProbability(score: number, calibration?: CalibrationProfile): number {
  // Validate score (331 = max base score)
  const validScore = Math.max(0, Math.min(331, score));

  // Use calibrated probability if profile provided
  if (calibration) {
    return calibratedWinProb(validScore, calibration);
  }

  // Use default calibration
  return calibratedWinProb(validScore, getDefaultCalibration());
}

/**
 * Convert odds string to market implied probability
 *
 * Formula: Implied Probability = 1 / Decimal Odds
 *
 * Examples:
 * - 2/1 (3.0 decimal) = 33.3%
 * - 5/1 (6.0 decimal) = 16.7%
 * - 1/2 (1.5 decimal) = 66.7%
 * - 10/1 (11.0 decimal) = 9.1%
 */
export function oddsToMarketProbability(oddsString: string): number {
  if (!oddsString || typeof oddsString !== 'string') {
    logger.logWarning('Invalid odds string for probability calculation', {
      component: 'valueDetector',
      oddsString,
    });
    return 10; // Default to 10% for invalid odds
  }

  try {
    const decimalOdds = parseOddsToDecimal(oddsString);

    // Validate decimal odds
    if (decimalOdds <= 1 || !isFinite(decimalOdds)) {
      return 50; // Default for even money or invalid
    }

    // Implied probability = 1 / decimal odds * 100
    const probability = (1 / decimalOdds) * 100;

    // Clamp to reasonable range (1% to 95%)
    return Math.max(1, Math.min(95, probability));
  } catch (_error) {
    logger.logWarning('Error parsing odds for probability', {
      component: 'valueDetector',
      oddsString,
    });
    return 10;
  }
}

/**
 * Convert probability to fair decimal odds
 */
export function probabilityToFairOdds(probability: number): number {
  // Validate probability
  const validProb = Math.max(1, Math.min(99, probability));

  // Fair odds = 100 / probability
  return 100 / validProb;
}

/**
 * Format decimal odds to traditional display
 */
export function formatOddsDisplay(decimalOdds: number): string {
  if (decimalOdds <= 1.01) return 'EVEN';

  const profit = decimalOdds - 1;

  // Common fractional patterns
  const patterns: [number, string][] = [
    [0.2, '1-5'],
    [0.25, '1-4'],
    [0.33, '1-3'],
    [0.5, '1-2'],
    [0.6, '3-5'],
    [0.67, '2-3'],
    [0.75, '3-4'],
    [0.8, '4-5'],
    [1.0, 'EVEN'],
    [1.2, '6-5'],
    [1.5, '3-2'],
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
    [100.0, '100-1'],
  ];

  // Find closest match
  let closest = '10-1';
  let minDiff = Infinity;

  for (const [value, display] of patterns) {
    const diff = Math.abs(profit - value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = display;
    }
  }

  return closest;
}

// ============================================================================
// EV CALCULATIONS
// ============================================================================

/**
 * Calculate Expected Value for a bet
 *
 * EV Formula:
 * EV = (Win Probability × Net Payout) - (Loss Probability × Bet Amount)
 *
 * For a $1 bet:
 * EV = (WinProb × (DecimalOdds - 1)) - (LossProb × 1)
 *
 * EV% = EV × 100
 *
 * @param winProbability Our estimated win probability (0-100)
 * @param decimalOdds Decimal odds from market
 * @returns EV per dollar wagered
 */
export function calculateEV(winProbability: number, decimalOdds: number): number {
  // Validate inputs
  if (winProbability <= 0 || winProbability >= 100) {
    return 0;
  }
  if (decimalOdds <= 1) {
    return -1; // Cannot profit on odds <= 1
  }

  const winProb = winProbability / 100;
  const loseProb = 1 - winProb;
  const netPayout = decimalOdds - 1;

  // EV = (win prob × net payout) - (lose prob × stake)
  const ev = winProb * netPayout - loseProb * 1;

  return Math.round(ev * 1000) / 1000;
}

/**
 * Calculate edge (our probability vs market probability)
 */
export function calculateEdge(ourProbability: number, marketProbability: number): number {
  return ourProbability - marketProbability;
}

/**
 * Calculate overlay percentage
 * Overlay = (Actual Odds - Fair Odds) / Fair Odds × 100
 */
export function calculateOverlayPercent(
  actualDecimalOdds: number,
  fairDecimalOdds: number
): number {
  if (fairDecimalOdds <= 1) return 0;

  const overlay = ((actualDecimalOdds - fairDecimalOdds) / fairDecimalOdds) * 100;
  return Math.round(overlay * 10) / 10;
}

/**
 * Classify value based on EV percentage
 */
export function classifyValue(evPercent: number): ValueClassification {
  if (evPercent >= EV_THRESHOLDS.elite) return 'elite_value';
  if (evPercent >= EV_THRESHOLDS.strong) return 'strong_value';
  if (evPercent >= EV_THRESHOLDS.moderate) return 'moderate_value';
  if (evPercent >= EV_THRESHOLDS.slight) return 'slight_value';
  if (evPercent >= EV_THRESHOLDS.none) return 'no_value';
  return 'negative_value';
}

/**
 * Generate bet multiplier suggestion based on edge
 */
export function calculateBetMultiplier(evPercent: number, edge: number): number {
  if (evPercent < 0) return 0;
  if (evPercent < EV_THRESHOLDS.slight) return 0.25; // Minimal

  // Scale multiplier with edge
  if (evPercent >= EV_THRESHOLDS.elite) {
    return Math.min(3.0, 1.5 + edge / 30);
  }
  if (evPercent >= EV_THRESHOLDS.strong) {
    return Math.min(2.0, 1.0 + edge / 50);
  }
  if (evPercent >= EV_THRESHOLDS.moderate) {
    return Math.min(1.5, 0.75 + edge / 60);
  }

  return Math.min(1.0, 0.5 + edge / 40);
}

/**
 * Determine urgency level based on value
 */
export function determineUrgency(
  classification: ValueClassification,
  evPercent: number
): 'immediate' | 'high' | 'standard' | 'low' | 'none' {
  switch (classification) {
    case 'elite_value':
      return 'immediate';
    case 'strong_value':
      return evPercent > 40 ? 'immediate' : 'high';
    case 'moderate_value':
      return 'standard';
    case 'slight_value':
      return 'low';
    default:
      return 'none';
  }
}

/**
 * Generate explanation for value analysis
 */
export function generateExplanation(analysis: Omit<ValueAnalysis, 'explanation'>): string[] {
  const explanations: string[] = [];

  // Score to probability explanation
  explanations.push(
    `Our analysis gives ${analysis.ourProbability.toFixed(1)}% win probability (score: ${analysis.score})`
  );

  // Market probability
  explanations.push(
    `Market odds of ${analysis.oddsDisplay} imply ${analysis.marketProbability.toFixed(1)}% probability`
  );

  // Edge
  const edgeDirection = analysis.edge > 0 ? 'higher' : 'lower';
  explanations.push(
    `Edge: ${analysis.edge > 0 ? '+' : ''}${analysis.edge.toFixed(1)}% (our probability is ${edgeDirection})`
  );

  // EV
  if (analysis.evPerDollar > 0) {
    explanations.push(
      `Expected return: +$${analysis.evPerDollar.toFixed(2)} per dollar wagered (${analysis.evPercent.toFixed(1)}% EV)`
    );
  } else {
    explanations.push(
      `Expected loss: $${Math.abs(analysis.evPerDollar).toFixed(2)} per dollar wagered (${analysis.evPercent.toFixed(1)}% EV)`
    );
  }

  // Fair odds comparison
  if (analysis.overlayPercent > 10) {
    explanations.push(
      `Fair odds: ${analysis.fairOddsDisplay} - current odds are ${analysis.overlayPercent.toFixed(0)}% better than fair value`
    );
  } else if (analysis.overlayPercent < -10) {
    explanations.push(
      `Fair odds: ${analysis.fairOddsDisplay} - current odds are ${Math.abs(analysis.overlayPercent).toFixed(0)}% worse than fair value`
    );
  }

  return explanations;
}

/**
 * Generate recommendation string
 */
export function generateRecommendation(
  classification: ValueClassification,
  evPercent: number,
  edge: number
): string {
  const meta = VALUE_CLASSIFICATION_META[classification];

  switch (classification) {
    case 'elite_value':
      return `${meta.action} - Exceptional ${evPercent.toFixed(0)}% EV with ${edge.toFixed(0)}% edge. Consider 2-3x standard unit.`;
    case 'strong_value':
      return `${meta.action} - Strong ${evPercent.toFixed(0)}% EV. Standard to 1.5x unit recommended.`;
    case 'moderate_value':
      return `${meta.action} - Solid ${evPercent.toFixed(0)}% EV. Standard unit play.`;
    case 'slight_value':
      return `${meta.action} with reduced unit - Small ${evPercent.toFixed(0)}% edge, minimal value.`;
    case 'no_value':
      return `${meta.action} - No meaningful edge at current odds. Only bet with strong conviction.`;
    case 'negative_value':
      return `${meta.action} - Negative ${Math.abs(evPercent).toFixed(0)}% EV. Not a profitable long-term bet.`;
  }
}

// ============================================================================
// MAIN ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Perform complete value analysis for a single horse
 */
export function analyzeValue(
  horse: HorseEntry,
  score: HorseScore,
  calibration?: CalibrationProfile
): ValueAnalysis {
  const programNumber = horse.programNumber;
  const horseName = horse.horseName;
  const totalScore = score.total;

  // Get odds with source tracking
  // In analysis context, we don't have live user overrides - only DRF morning line
  const oddsInfo = getOddsWithSource(
    programNumber,
    horse.morningLineOdds, // Raw ML from DRF (might be '')
    () => horse.morningLineOdds || '5-1', // The actual odds value we'll use
    () => false // No user override in analysis context
  );
  const oddsDisplay = oddsInfo.value;
  const oddsSource = oddsInfo.source;
  const oddsConfidenceValue = oddsInfo.confidence;
  const oddsWarning = getOddsWarning(oddsSource);

  // Calculate probabilities
  const ourProbability = scoreToWinProbability(totalScore, calibration);
  const decimalOdds = parseOddsToDecimal(oddsDisplay);
  const marketProbability = oddsToMarketProbability(oddsDisplay);

  // Calculate edge and EV
  const edge = calculateEdge(ourProbability, marketProbability);
  const rawEvPerDollar = calculateEV(ourProbability, decimalOdds);

  // Apply confidence multiplier (only dampens fallback, ML and live get 1.0)
  const evMultiplier = getEVConfidenceMultiplier(oddsConfidenceValue);
  const evPerDollar = rawEvPerDollar * evMultiplier;
  const evPercent = evPerDollar * 100;

  // Calculate fair odds and overlay
  const fairOdds = probabilityToFairOdds(ourProbability);
  const fairOddsDisplay = formatOddsDisplay(fairOdds);
  const overlayPercent = calculateOverlayPercent(decimalOdds, fairOdds);

  // Classify and get metadata
  const classification = classifyValue(evPercent);
  const isPositiveEV = evPerDollar > 0;
  const shouldBet = evPercent >= EV_THRESHOLDS.slight;

  // Calculate bet parameters
  const suggestedMultiplier = calculateBetMultiplier(evPercent, edge);
  const urgency = determineUrgency(classification, evPercent);

  // Build partial analysis for explanation generation
  const partialAnalysis = {
    programNumber,
    horseName,
    score: totalScore,
    ourProbability,
    marketProbability,
    edge,
    evPerDollar,
    evPercent,
    classification,
    isPositiveEV,
    shouldBet,
    decimalOdds,
    oddsDisplay,
    fairOdds,
    fairOddsDisplay,
    overlayPercent,
    suggestedMultiplier,
    urgency,
    recommendation: '', // Will be filled below
    oddsSource,
    oddsConfidence: oddsConfidenceValue,
    oddsWarning,
  };

  // Generate explanation and recommendation
  const explanation = generateExplanation(partialAnalysis);
  const recommendation = generateRecommendation(classification, evPercent, edge);

  logger.logDebug(`Value analysis for ${horseName}`, {
    component: 'valueDetector',
    programNumber,
    score: totalScore,
    evPercent: evPercent.toFixed(1),
    classification,
    oddsSource,
    oddsConfidence: oddsConfidenceValue,
  });

  return {
    ...partialAnalysis,
    explanation,
    recommendation,
  };
}

/**
 * Analyze value for all horses in a race
 */
export function analyzeRaceValue(
  horses: Array<{ horse: HorseEntry; score: HorseScore }>,
  calibration?: CalibrationProfile
): ValueAnalysisBatch {
  // Filter out scratched horses
  const activeHorses = horses.filter((h) => !h.score.isScratched);

  // Analyze each horse
  const allAnalyses = activeHorses.map(({ horse, score }) =>
    analyzeValue(horse, score, calibration)
  );

  // Filter positive EV
  const positiveEVHorses = allAnalyses.filter((a) => a.isPositiveEV);

  // Sort by EV (best first)
  const rankedByEV = [...allAnalyses].sort((a, b) => b.evPercent - a.evPercent);

  // Categorize by value classification
  const eliteValue = allAnalyses.filter((a) => a.classification === 'elite_value');
  const strongValue = allAnalyses.filter((a) => a.classification === 'strong_value');

  // Calculate statistics
  const evValues = allAnalyses.map((a) => a.evPercent);
  const overlayValues = positiveEVHorses.map((a) => a.overlayPercent);

  const stats = {
    averageEV:
      evValues.length > 0 ? evValues.reduce((sum, ev) => sum + ev, 0) / evValues.length : 0,
    maxEV: evValues.length > 0 ? Math.max(...evValues) : 0,
    minEV: evValues.length > 0 ? Math.min(...evValues) : 0,
    totalOverlay: overlayValues.reduce((sum, o) => sum + o, 0),
    positiveEdgeCount: allAnalyses.filter((a) => a.edge > 0).length,
  };

  logger.logInfo('Race value analysis complete', {
    component: 'valueDetector',
    totalHorses: allAnalyses.length,
    positiveEVCount: positiveEVHorses.length,
    eliteValueCount: eliteValue.length,
    maxEV: stats.maxEV.toFixed(1),
  });

  return {
    allHorses: allAnalyses,
    positiveEVHorses,
    rankedByEV,
    eliteValue,
    strongValue,
    positiveEVCount: positiveEVHorses.length,
    bestValuePlay: rankedByEV[0] ?? null,
    stats,
  };
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format EV percentage for display
 */
export function formatEVPercent(evPercent: number): string {
  const sign = evPercent >= 0 ? '+' : '';
  return `${sign}${evPercent.toFixed(1)}%`;
}

/**
 * Format edge for display
 */
export function formatEdge(edge: number): string {
  const sign = edge >= 0 ? '+' : '';
  return `${sign}${edge.toFixed(1)}%`;
}

/**
 * Get color for EV display
 */
export function getEVColor(evPercent: number): string {
  const classification = classifyValue(evPercent);
  return VALUE_CLASSIFICATION_META[classification].color;
}

/**
 * Get background color for EV display
 */
export function getEVBgColor(evPercent: number): string {
  const classification = classifyValue(evPercent);
  return VALUE_CLASSIFICATION_META[classification].bgColor;
}

/**
 * Get icon for classification
 */
export function getValueIcon(classification: ValueClassification): string {
  return VALUE_CLASSIFICATION_META[classification].icon;
}

/**
 * Get short label for classification
 */
export function getValueShortLabel(evPercent: number): string {
  const classification = classifyValue(evPercent);
  return VALUE_CLASSIFICATION_META[classification].shortName;
}

/**
 * Check if horse qualifies as a value play
 */
export function isValuePlay(evPercent: number, minEV: number = 5): boolean {
  return evPercent >= minEV;
}

/**
 * Get value summary for a horse
 */
export function getValueSummary(analysis: ValueAnalysis): string {
  if (analysis.classification === 'elite_value') {
    return `Elite Value: ${analysis.evPercent.toFixed(0)}% EV - Immediate bet!`;
  }
  if (analysis.classification === 'strong_value') {
    return `Strong Value: ${analysis.evPercent.toFixed(0)}% EV - Excellent opportunity`;
  }
  if (analysis.classification === 'moderate_value') {
    return `Good Value: ${analysis.evPercent.toFixed(0)}% EV - Solid play`;
  }
  if (analysis.classification === 'slight_value') {
    return `Slight Value: ${analysis.evPercent.toFixed(0)}% EV - Playable with caution`;
  }
  if (analysis.classification === 'negative_value') {
    return `Avoid: ${analysis.evPercent.toFixed(0)}% EV - Negative expected value`;
  }
  return `No Value: ${analysis.evPercent.toFixed(0)}% EV - Pass`;
}
