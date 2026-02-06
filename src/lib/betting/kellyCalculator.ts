/**
 * Quarter-Kelly Criterion Calculator
 *
 * Implements the Kelly Criterion formula for optimal bet sizing with
 * Quarter-Kelly as the recommended default for reduced variance.
 *
 * Kelly formula: f = (bp - q) / b
 * Where:
 * - f = fraction of bankroll to wager
 * - b = decimal odds - 1 (net odds)
 * - p = win probability
 * - q = 1 - p (loss probability)
 *
 * Full Kelly maximizes long-term growth but has high variance.
 * Quarter Kelly (0.25× full Kelly) provides ~75% of the growth with far less risk.
 *
 * @module betting/kellyCalculator
 */

import { parseOddsToDecimal as _parseOddsToDecimal } from '../../utils/formatters';
import { isCalibrationActive } from '../scoring/probabilityConversion';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input for Kelly calculation
 */
export interface KellyInput {
  /** Calibrated win probability (0-1) */
  probability: number;
  /** Decimal odds (e.g., 6.0 for 5-1) */
  decimalOdds: number;
  /** Current bankroll in dollars */
  bankroll: number;
}

/**
 * Output from Kelly calculation
 */
export interface KellyOutput {
  /** Raw Kelly fraction (0-1) - full Kelly */
  fullKellyFraction: number;
  /** Conservative fraction (quarter Kelly by default) */
  quarterKellyFraction: number;
  /** Suggested bet size in dollars */
  suggestedBetSize: number;
  /** Expected value per dollar wagered */
  expectedValue: number;
  /** Expected log growth rate per bet */
  expectedGrowth: number;
  /** Approximate risk of ruin at this bet size */
  riskOfRuin: number;
  /** Whether this is a positive EV bet */
  isPositiveEV: boolean;
  /** Whether Kelly suggests betting (positive fraction) */
  shouldBet: boolean;
  /** Reason for not betting if shouldBet is false */
  reason?: string;
  /** Implied probability from odds */
  impliedProbability: number;
  /** Edge percentage over the market */
  edgePercent: number;
}

/**
 * Kelly fraction options
 */
export type KellyFraction = 'full' | 'half' | 'quarter' | 'eighth';

/**
 * Kelly fraction multipliers
 */
export const KELLY_FRACTION_MULTIPLIERS: Record<KellyFraction, number> = {
  full: 1.0,
  half: 0.5,
  quarter: 0.25,
  eighth: 0.125,
};

/**
 * Kelly fraction display labels
 */
export const KELLY_FRACTION_LABELS: Record<KellyFraction, string> = {
  full: 'Full Kelly',
  half: 'Half Kelly',
  quarter: 'Quarter Kelly',
  eighth: 'Eighth Kelly',
};

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum probability to consider (avoids division issues) */
const MIN_PROBABILITY = 0.001;

/** Maximum probability to consider */
const MAX_PROBABILITY = 0.999;

/** Minimum odds to consider (must be > 1.0) */
const MIN_DECIMAL_ODDS = 1.01;

/** Maximum Kelly fraction to ever recommend (safety cap) */
const MAX_KELLY_FRACTION = 0.25;

/** Minimum bankroll for any bet */
const MIN_BANKROLL = 10;

// ============================================================================
// CORE KELLY FUNCTIONS
// ============================================================================

/**
 * Calculate Kelly Criterion optimal bet fraction
 *
 * Full Kelly formula: f = (bp - q) / b
 * Where b = decimalOdds - 1, p = probability, q = 1 - p
 *
 * @param input - Kelly input parameters
 * @returns Kelly output with all metrics
 *
 * @example
 * // Probability: 25%, Odds: 5-1 (6.0 decimal), Bankroll: $500
 * const result = calculateKelly({
 *   probability: 0.25,
 *   decimalOdds: 6.0,
 *   bankroll: 500
 * });
 * // fullKellyFraction: 0.15 (15%)
 * // quarterKellyFraction: 0.0375 (3.75%)
 * // suggestedBetSize: $19 (rounded from $18.75)
 */
export function calculateKelly(input: KellyInput): KellyOutput {
  const { probability, decimalOdds, bankroll } = input;

  // Validate and clamp inputs
  const p = Math.max(MIN_PROBABILITY, Math.min(MAX_PROBABILITY, probability));
  const q = 1 - p;
  const odds = Math.max(MIN_DECIMAL_ODDS, decimalOdds);
  const b = odds - 1; // Net odds

  // Calculate implied probability from odds
  const impliedProbability = 1 / odds;

  // Calculate edge: how much better our probability is vs market
  const edgePercent = ((p - impliedProbability) / impliedProbability) * 100;

  // Calculate expected value per $1 bet: EV = (p × odds) - 1
  const expectedValue = p * odds - 1;
  const isPositiveEV = expectedValue > 0;

  // Kelly formula: f = (bp - q) / b
  const fullKellyFraction = (b * p - q) / b;

  // Handle negative or zero Kelly (no edge)
  if (fullKellyFraction <= 0) {
    return {
      fullKellyFraction: 0,
      quarterKellyFraction: 0,
      suggestedBetSize: 0,
      expectedValue,
      expectedGrowth: 0,
      riskOfRuin: 1, // 100% certainty of loss long-term
      isPositiveEV: false,
      shouldBet: false,
      reason: 'Negative EV - no edge over the market',
      impliedProbability,
      edgePercent,
    };
  }

  // Cap full Kelly at safety maximum
  const cappedFullKelly = Math.min(fullKellyFraction, MAX_KELLY_FRACTION);
  const quarterKellyFraction = cappedFullKelly * KELLY_FRACTION_MULTIPLIERS.quarter;

  // Calculate expected log growth rate: g = p × log(1 + b×f) + q × log(1 - f)
  const expectedGrowth = calculateExpectedGrowth(p, b, quarterKellyFraction);

  // Calculate approximate risk of ruin
  const riskOfRuin = calculateRiskOfRuin(p, quarterKellyFraction, bankroll);

  // Check bankroll is sufficient
  if (bankroll < MIN_BANKROLL) {
    return {
      fullKellyFraction: cappedFullKelly,
      quarterKellyFraction,
      suggestedBetSize: 0,
      expectedValue,
      expectedGrowth,
      riskOfRuin,
      isPositiveEV,
      shouldBet: false,
      reason: `Bankroll ($${bankroll}) below minimum ($${MIN_BANKROLL})`,
      impliedProbability,
      edgePercent,
    };
  }

  // Calculate suggested bet size
  const suggestedBetSize = Math.round(bankroll * quarterKellyFraction);

  return {
    fullKellyFraction: cappedFullKelly,
    quarterKellyFraction,
    suggestedBetSize,
    expectedValue,
    expectedGrowth,
    riskOfRuin,
    isPositiveEV,
    shouldBet: true,
    impliedProbability,
    edgePercent,
  };
}

/**
 * Calculate Kelly with a specific fraction (full, half, quarter, eighth)
 *
 * @param input - Kelly input parameters
 * @param fraction - Kelly fraction to use (default: quarter)
 * @returns Kelly output with the specified fraction applied
 */
export function calculateFractionalKelly(
  input: KellyInput,
  fraction: KellyFraction = 'quarter'
): KellyOutput {
  const result = calculateKelly(input);

  if (!result.shouldBet) {
    return result;
  }

  // Apply the specified fraction
  const multiplier = KELLY_FRACTION_MULTIPLIERS[fraction];
  const adjustedFraction = result.fullKellyFraction * multiplier;
  const adjustedBetSize = Math.round(input.bankroll * adjustedFraction);

  // Recalculate growth and risk for the adjusted fraction
  const p = Math.max(MIN_PROBABILITY, Math.min(MAX_PROBABILITY, input.probability));
  const b = Math.max(MIN_DECIMAL_ODDS, input.decimalOdds) - 1;
  const adjustedGrowth = calculateExpectedGrowth(p, b, adjustedFraction);
  const adjustedRisk = calculateRiskOfRuin(p, adjustedFraction, input.bankroll);

  return {
    ...result,
    quarterKellyFraction: adjustedFraction,
    suggestedBetSize: adjustedBetSize,
    expectedGrowth: adjustedGrowth,
    riskOfRuin: adjustedRisk,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate expected log growth rate per bet
 *
 * g = p × log(1 + b×f) + q × log(1 - f)
 *
 * @param p - Win probability
 * @param b - Net odds (decimal odds - 1)
 * @param f - Bet fraction
 * @returns Expected log growth rate
 */
function calculateExpectedGrowth(p: number, b: number, f: number): number {
  if (f <= 0 || f >= 1) return 0;

  try {
    const winGrowth = p * Math.log(1 + b * f);
    const lossGrowth = (1 - p) * Math.log(1 - f);
    return winGrowth + lossGrowth;
  } catch {
    return 0;
  }
}

/**
 * Calculate approximate risk of ruin
 *
 * Uses simplified formula: RoR ≈ ((1 - edge) / (1 + edge))^(bankroll / betSize)
 *
 * @param p - Win probability
 * @param f - Bet fraction
 * @param bankroll - Current bankroll
 * @returns Risk of ruin (0-1)
 */
function calculateRiskOfRuin(p: number, f: number, bankroll: number): number {
  if (f <= 0 || bankroll <= 0) return 1;

  // Calculate edge
  const edge = 2 * p - 1; // Simplified edge for this approximation

  if (edge <= 0) return 1;

  // Number of "units" in bankroll
  const units = bankroll / (bankroll * f);

  // Risk of ruin formula
  const ratio = (1 - edge) / (1 + edge);
  const ror = Math.pow(Math.max(0, Math.min(1, ratio)), units);

  return Math.min(1, Math.max(0, ror));
}

// Re-export from canonical source
export const parseOddsToDecimal = _parseOddsToDecimal;

/**
 * Convert decimal odds to display string (e.g., "5-1")
 *
 * @param decimalOdds - Decimal odds
 * @returns Display string
 */
export function decimalOddsToDisplay(decimalOdds: number): string {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1.0) {
    return 'EVEN';
  }

  const profit = decimalOdds - 1;

  // Check for common fractional odds
  const commonOdds: [number, string][] = [
    [0.2, '1-5'],
    [0.25, '1-4'],
    [0.33, '1-3'],
    [0.4, '2-5'],
    [0.5, '1-2'],
    [0.6, '3-5'],
    [0.8, '4-5'],
    [1.0, 'EVEN'],
    [1.2, '6-5'],
    [1.4, '7-5'],
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

/**
 * Check if calibration is active for more accurate probabilities
 */
export function isCalibrationReady(): boolean {
  return isCalibrationActive();
}

/**
 * Format Kelly result for display
 */
export function formatKellyResult(result: KellyOutput): {
  betSize: string;
  fraction: string;
  edge: string;
  ev: string;
  growth: string;
  risk: string;
} {
  return {
    betSize: result.suggestedBetSize > 0 ? `$${result.suggestedBetSize}` : '$0',
    fraction: `${(result.quarterKellyFraction * 100).toFixed(2)}%`,
    edge: `${result.edgePercent >= 0 ? '+' : ''}${result.edgePercent.toFixed(1)}%`,
    ev: `${result.expectedValue >= 0 ? '+' : ''}${(result.expectedValue * 100).toFixed(1)}%`,
    growth: `${(result.expectedGrowth * 100).toFixed(3)}%`,
    risk: `${(result.riskOfRuin * 100).toFixed(1)}%`,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate Kelly input parameters
 */
export function validateKellyInput(input: KellyInput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (input.probability < 0 || input.probability > 1) {
    errors.push(`Probability must be between 0 and 1, got ${input.probability}`);
  }

  if (input.decimalOdds <= 1) {
    errors.push(`Decimal odds must be greater than 1, got ${input.decimalOdds}`);
  }

  if (input.bankroll < 0) {
    errors.push(`Bankroll cannot be negative, got ${input.bankroll}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
