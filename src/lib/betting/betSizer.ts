/**
 * Bet Sizing Module
 *
 * Applies practical constraints to Kelly-based bet recommendations:
 * - Maximum bet percentage caps
 * - Minimum/maximum bet amounts
 * - Rounding to practical amounts
 * - Multi-bet bankroll management
 *
 * @module betting/betSizer
 */

import type { KellyOutput, KellyFraction } from './kellyCalculator';
import { KELLY_FRACTION_MULTIPLIERS } from './kellyCalculator';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for bet sizing
 */
export interface BetSizingConfig {
  /** Kelly fraction to use (default: 'quarter') */
  kellyFraction: KellyFraction;
  /** Maximum % of bankroll per bet (default: 2%) */
  maxBetPercent: number;
  /** Minimum bet in dollars (default: $2) */
  minBetAmount: number;
  /** Maximum bet in dollars (default: $100) */
  maxBetAmount: number;
  /** Round to nearest dollar (default: 1) */
  roundToNearest: number;
  /** Minimum edge required to bet (default: 2%) */
  minEdgePercent: number;
}

/**
 * Result of bet sizing
 */
export interface SizedBet {
  /** Raw Kelly bet before caps */
  rawKellyBet: number;
  /** Bet after applying caps */
  cappedBet: number;
  /** Final bet after rounding */
  finalBet: number;
  /** Whether a cap was applied */
  wasCapApplied: boolean;
  /** Reason for cap if applied */
  capReason?: 'max_percent' | 'max_amount' | 'min_amount' | 'negative_ev' | 'below_edge';
  /** Kelly fraction used */
  kellyFractionUsed: KellyFraction;
  /** Effective bet percentage of bankroll */
  effectiveBetPercent: number;
}

/**
 * Result of multi-bet adjustment
 */
export interface AdjustedBet extends SizedBet {
  /** Original bet before adjustment */
  originalBet: number;
  /** Reduction applied for simultaneous exposure */
  reductionPercent: number;
  /** Index in the bet array */
  betIndex: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default bet sizing configuration
 * Conservative defaults suitable for most recreational bettors
 */
export const DEFAULT_BET_SIZING_CONFIG: BetSizingConfig = {
  kellyFraction: 'quarter',
  maxBetPercent: 2, // 2% of bankroll max per bet
  minBetAmount: 2, // $2 minimum
  maxBetAmount: 100, // $100 maximum
  roundToNearest: 1, // Round to nearest dollar
  minEdgePercent: 2, // Need at least 2% edge to bet
};

/**
 * Aggressive configuration for experienced bettors
 */
export const AGGRESSIVE_BET_SIZING_CONFIG: BetSizingConfig = {
  kellyFraction: 'half',
  maxBetPercent: 5,
  minBetAmount: 5,
  maxBetAmount: 250,
  roundToNearest: 5,
  minEdgePercent: 5,
};

/**
 * Ultra-conservative configuration
 */
export const CONSERVATIVE_BET_SIZING_CONFIG: BetSizingConfig = {
  kellyFraction: 'eighth',
  maxBetPercent: 1,
  minBetAmount: 2,
  maxBetAmount: 50,
  roundToNearest: 1,
  minEdgePercent: 3,
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Size a bet based on Kelly output and configuration
 *
 * @param kelly - Kelly calculation output
 * @param bankroll - Current bankroll in dollars
 * @param config - Bet sizing configuration (optional)
 * @returns Sized bet with all caps applied
 *
 * @example
 * const kelly = calculateKelly({ probability: 0.25, decimalOdds: 6.0, bankroll: 500 });
 * const sized = sizeBet(kelly, 500);
 * // sized.finalBet might be $10 (2% cap of $500)
 */
export function sizeBet(
  kelly: KellyOutput,
  bankroll: number,
  config: Partial<BetSizingConfig> = {}
): SizedBet {
  const fullConfig = { ...DEFAULT_BET_SIZING_CONFIG, ...config };

  // Handle negative EV case
  if (!kelly.isPositiveEV || kelly.expectedValue <= 0) {
    return {
      rawKellyBet: 0,
      cappedBet: 0,
      finalBet: 0,
      wasCapApplied: true,
      capReason: 'negative_ev',
      kellyFractionUsed: fullConfig.kellyFraction,
      effectiveBetPercent: 0,
    };
  }

  // Check minimum edge requirement
  if (kelly.edgePercent < fullConfig.minEdgePercent) {
    return {
      rawKellyBet: 0,
      cappedBet: 0,
      finalBet: 0,
      wasCapApplied: true,
      capReason: 'below_edge',
      kellyFractionUsed: fullConfig.kellyFraction,
      effectiveBetPercent: 0,
    };
  }

  // Calculate raw Kelly bet with the configured fraction
  const fractionMultiplier = KELLY_FRACTION_MULTIPLIERS[fullConfig.kellyFraction];
  const rawKellyBet = bankroll * kelly.fullKellyFraction * fractionMultiplier;

  // Apply percentage cap
  const maxBetByPercent = bankroll * (fullConfig.maxBetPercent / 100);
  let cappedBet = rawKellyBet;
  let capReason: SizedBet['capReason'] | undefined;
  let wasCapApplied = false;

  if (cappedBet > maxBetByPercent) {
    cappedBet = maxBetByPercent;
    capReason = 'max_percent';
    wasCapApplied = true;
  }

  // Apply maximum amount cap
  if (cappedBet > fullConfig.maxBetAmount) {
    cappedBet = fullConfig.maxBetAmount;
    capReason = 'max_amount';
    wasCapApplied = true;
  }

  // Apply minimum amount (if we have any bet at all)
  if (cappedBet > 0 && cappedBet < fullConfig.minBetAmount) {
    // If bankroll can't cover minimum, don't bet
    if (bankroll < fullConfig.minBetAmount) {
      return {
        rawKellyBet,
        cappedBet: 0,
        finalBet: 0,
        wasCapApplied: true,
        capReason: 'min_amount',
        kellyFractionUsed: fullConfig.kellyFraction,
        effectiveBetPercent: 0,
      };
    }
    cappedBet = fullConfig.minBetAmount;
    capReason = 'min_amount';
    wasCapApplied = true;
  }

  // Round to nearest unit
  const finalBet = roundToNearest(cappedBet, fullConfig.roundToNearest);

  // Calculate effective bet percentage
  const effectiveBetPercent = bankroll > 0 ? (finalBet / bankroll) * 100 : 0;

  return {
    rawKellyBet,
    cappedBet,
    finalBet,
    wasCapApplied,
    capReason,
    kellyFractionUsed: fullConfig.kellyFraction,
    effectiveBetPercent,
  };
}

/**
 * Adjust multiple bets for simultaneous exposure
 *
 * When betting multiple races simultaneously, we need to reduce
 * individual bet sizes to avoid over-exposure.
 *
 * @param bets - Array of sized bets
 * @param bankroll - Current bankroll
 * @param maxTotalExposure - Maximum total exposure as fraction (default: 0.10 = 10%)
 * @returns Adjusted bets with reduced sizes
 *
 * @example
 * const bets = [sizeBet(kelly1, 500), sizeBet(kelly2, 500), sizeBet(kelly3, 500)];
 * const adjusted = adjustForSimultaneousBets(bets, 500, 0.10);
 * // Total of all adjusted bets won't exceed $50 (10% of $500)
 */
export function adjustForSimultaneousBets(
  bets: SizedBet[],
  bankroll: number,
  maxTotalExposure: number = 0.1
): AdjustedBet[] {
  // Filter to bets that have a non-zero amount
  const activeBets = bets.filter((bet) => bet.finalBet > 0);

  if (activeBets.length === 0) {
    return bets.map((bet, index) => ({
      ...bet,
      originalBet: bet.finalBet,
      reductionPercent: 0,
      betIndex: index,
    }));
  }

  // Calculate total current exposure
  const totalExposure = activeBets.reduce((sum, bet) => sum + bet.finalBet, 0);
  const maxAllowedExposure = bankroll * maxTotalExposure;

  // If within limit, no adjustment needed
  if (totalExposure <= maxAllowedExposure) {
    return bets.map((bet, index) => ({
      ...bet,
      originalBet: bet.finalBet,
      reductionPercent: 0,
      betIndex: index,
    }));
  }

  // Calculate reduction factor
  const reductionFactor = maxAllowedExposure / totalExposure;
  const reductionPercent = (1 - reductionFactor) * 100;

  // Apply reduction to all bets proportionally
  return bets.map((bet, index) => {
    const adjustedBet = Math.round(bet.finalBet * reductionFactor);
    return {
      ...bet,
      originalBet: bet.finalBet,
      finalBet: adjustedBet,
      cappedBet: adjustedBet,
      reductionPercent,
      betIndex: index,
      effectiveBetPercent: bankroll > 0 ? (adjustedBet / bankroll) * 100 : 0,
    };
  });
}

/**
 * Calculate total exposure for a set of bets
 *
 * @param bets - Array of sized bets
 * @returns Total dollars at risk
 */
export function calculateTotalExposure(bets: SizedBet[]): number {
  return bets.reduce((sum, bet) => sum + bet.finalBet, 0);
}

/**
 * Calculate exposure percentage for a set of bets
 *
 * @param bets - Array of sized bets
 * @param bankroll - Current bankroll
 * @returns Exposure as percentage of bankroll
 */
export function calculateExposurePercent(bets: SizedBet[], bankroll: number): number {
  if (bankroll <= 0) return 0;
  const total = calculateTotalExposure(bets);
  return (total / bankroll) * 100;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Round a number to the nearest unit
 *
 * @param value - Value to round
 * @param unit - Unit to round to
 * @returns Rounded value
 */
function roundToNearest(value: number, unit: number): number {
  if (unit <= 0) return Math.round(value);
  return Math.round(value / unit) * unit;
}

/**
 * Create a bet sizing config from risk tolerance
 */
export function createConfigFromRiskTolerance(
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
): BetSizingConfig {
  switch (riskTolerance) {
    case 'conservative':
      return CONSERVATIVE_BET_SIZING_CONFIG;
    case 'aggressive':
      return AGGRESSIVE_BET_SIZING_CONFIG;
    case 'moderate':
    default:
      return DEFAULT_BET_SIZING_CONFIG;
  }
}

/**
 * Validate bet sizing configuration
 */
export function validateBetSizingConfig(config: BetSizingConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.maxBetPercent <= 0 || config.maxBetPercent > 100) {
    errors.push('maxBetPercent must be between 0 and 100');
  }

  if (config.minBetAmount < 0) {
    errors.push('minBetAmount cannot be negative');
  }

  if (config.maxBetAmount < config.minBetAmount) {
    errors.push('maxBetAmount must be greater than or equal to minBetAmount');
  }

  if (config.roundToNearest < 0) {
    errors.push('roundToNearest cannot be negative');
  }

  if (config.minEdgePercent < 0) {
    errors.push('minEdgePercent cannot be negative');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Format a sized bet for display
 */
export function formatSizedBet(
  bet: SizedBet,
  _bankroll: number
): {
  amount: string;
  percentOfBankroll: string;
  cappedReason: string;
  kellyFraction: string;
} {
  return {
    amount: bet.finalBet > 0 ? `$${bet.finalBet}` : 'PASS',
    percentOfBankroll: `${bet.effectiveBetPercent.toFixed(1)}%`,
    cappedReason: bet.capReason
      ? formatCapReason(bet.capReason)
      : bet.wasCapApplied
        ? 'Cap applied'
        : 'No cap',
    kellyFraction: `${bet.kellyFractionUsed} Kelly`,
  };
}

/**
 * Format cap reason for display
 */
function formatCapReason(reason: SizedBet['capReason']): string {
  switch (reason) {
    case 'max_percent':
      return 'Capped at max % of bankroll';
    case 'max_amount':
      return 'Capped at max bet amount';
    case 'min_amount':
      return 'Set to minimum bet';
    case 'negative_ev':
      return 'No bet - negative EV';
    case 'below_edge':
      return 'No bet - edge below threshold';
    default:
      return 'Unknown';
  }
}

/**
 * Get recommended bet sizing config based on bankroll
 */
export function getRecommendedConfig(bankroll: number): BetSizingConfig {
  if (bankroll < 100) {
    // Very small bankroll - be extra conservative
    return {
      ...CONSERVATIVE_BET_SIZING_CONFIG,
      minBetAmount: 2,
      maxBetAmount: Math.max(2, Math.floor(bankroll * 0.05)),
    };
  }

  if (bankroll < 500) {
    // Small bankroll - conservative approach
    return {
      ...CONSERVATIVE_BET_SIZING_CONFIG,
      maxBetAmount: Math.min(50, Math.floor(bankroll * 0.1)),
    };
  }

  if (bankroll < 2000) {
    // Medium bankroll - standard approach
    return DEFAULT_BET_SIZING_CONFIG;
  }

  // Large bankroll - can be slightly more aggressive
  return {
    ...DEFAULT_BET_SIZING_CONFIG,
    maxBetAmount: 200,
    roundToNearest: 5,
  };
}
