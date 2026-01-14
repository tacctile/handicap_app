/**
 * Return Estimates Calculator
 *
 * Estimates potential returns for different bet types based on odds.
 * These are estimates only - actual payouts depend on pool sizes.
 */

import type { BetType } from './betTypes';

// ============================================================================
// ODDS PARSING
// ============================================================================

/**
 * Parse odds string to decimal number
 * "5-1" -> 5, "3/2" -> 1.5, "EVEN" -> 1
 */
export function parseOddsToDecimal(oddsStr: string): number {
  const cleaned = oddsStr.trim().toUpperCase();

  if (cleaned === 'EVEN' || cleaned === 'EVN') {
    return 1.0;
  }

  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const num = parseFloat(parts[0] || '10');
    const denom = parseFloat(parts[1] || '1');
    return num / denom;
  }

  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const num = parseFloat(parts[0] || '10');
    const denom = parseFloat(parts[1] || '1');
    return num / denom;
  }

  return parseFloat(cleaned) || 10;
}

// ============================================================================
// WIN/PLACE/SHOW ESTIMATES
// ============================================================================

/**
 * Estimate WIN bet payout
 * Straightforward: (odds + 1) * bet amount
 */
export function estimateWinReturn(
  oddsDecimal: number,
  betAmount: number
): { min: number; max: number } {
  const payout = (oddsDecimal + 1) * betAmount;
  return {
    min: Math.round(payout * 0.9), // Slight variation
    max: Math.round(payout),
  };
}

/**
 * Estimate PLACE bet payout
 * Typically 40-50% of win odds
 * Place pays: (odds * 0.4 to 0.5 + 1) * bet
 */
export function estimatePlaceReturn(
  oddsDecimal: number,
  betAmount: number
): { min: number; max: number } {
  const minMultiplier = oddsDecimal * 0.35 + 1;
  const maxMultiplier = oddsDecimal * 0.5 + 1;
  return {
    min: Math.round(betAmount * minMultiplier),
    max: Math.round(betAmount * maxMultiplier),
  };
}

/**
 * Estimate SHOW bet payout
 * Typically 25-35% of win odds
 * Show pays: (odds * 0.25 to 0.35 + 1) * bet
 */
export function estimateShowReturn(
  oddsDecimal: number,
  betAmount: number
): { min: number; max: number } {
  const minMultiplier = oddsDecimal * 0.2 + 1;
  const maxMultiplier = oddsDecimal * 0.35 + 1;
  return {
    min: Math.round(betAmount * minMultiplier),
    max: Math.round(betAmount * maxMultiplier),
  };
}

// ============================================================================
// EXOTIC BET ESTIMATES
// ============================================================================

/**
 * Estimate EXACTA payout
 * Very rough: multiply approximate odds of both horses
 * longshot in exacta = huge payouts
 */
export function estimateExactaReturn(
  horse1Odds: number,
  horse2Odds: number,
  betAmount: number
): { min: number; max: number } {
  // Rough formula: product of odds, adjusted
  const combinedMultiplier = (horse1Odds + 1) * (horse2Odds * 0.6 + 1);
  const basePayout = betAmount * combinedMultiplier * 0.6;

  return {
    min: Math.round(basePayout * 0.7),
    max: Math.round(basePayout * 1.3),
  };
}

/**
 * Estimate TRIFECTA KEY payout
 * Highly variable, estimate based on key horse odds
 */
export function estimateTrifectaKeyReturn(
  keyHorseOdds: number,
  otherHorsesOdds: number[],
  betAmount: number,
  combinations: number
): { min: number; max: number } {
  // Trifectas with longshots pay huge
  // Base estimate on key horse odds
  const avgOtherOdds = otherHorsesOdds.reduce((a, b) => a + b, 0) / otherHorsesOdds.length || 3;

  // Rough multiplier based on odds
  const baseMultiplier = (keyHorseOdds + 1) * (avgOtherOdds * 0.5 + 1) * 2;
  const totalBet = betAmount * combinations;
  const basePayout = totalBet * baseMultiplier;

  // Wide range for trifectas
  return {
    min: Math.round(Math.max(totalBet * 5, basePayout * 0.4)),
    max: Math.round(basePayout * 2),
  };
}

/**
 * Estimate TRIFECTA BOX payout
 * Similar to key but less variability since no key horse
 */
export function estimateTrifectaBoxReturn(
  horsesOdds: number[],
  betAmount: number,
  combinations: number
): { min: number; max: number } {
  const avgOdds = horsesOdds.reduce((a, b) => a + b, 0) / horsesOdds.length || 3;
  const maxOdds = Math.max(...horsesOdds, 3);

  const totalBet = betAmount * combinations;
  const baseMultiplier = (maxOdds + 1) * (avgOdds * 0.5 + 1);
  const basePayout = totalBet * baseMultiplier * 0.8;

  return {
    min: Math.round(Math.max(totalBet * 3, basePayout * 0.5)),
    max: Math.round(basePayout * 1.5),
  };
}

/**
 * Estimate SUPERFECTA KEY payout
 * Even more variable - can be massive
 */
export function estimateSuperfectaKeyReturn(
  keyHorseOdds: number,
  otherHorsesOdds: number[],
  betAmount: number,
  combinations: number
): { min: number; max: number } {
  const avgOtherOdds = otherHorsesOdds.reduce((a, b) => a + b, 0) / otherHorsesOdds.length || 3;

  const totalBet = betAmount * combinations;
  const baseMultiplier = (keyHorseOdds + 1) * (avgOtherOdds * 0.4 + 1) * 4;
  const basePayout = totalBet * baseMultiplier;

  return {
    min: Math.round(Math.max(totalBet * 10, basePayout * 0.3)),
    max: Math.round(basePayout * 3),
  };
}

/**
 * Estimate SUPERFECTA BOX payout
 * Similar to superfecta key but covering all orderings
 */
export function estimateSuperfectaBoxReturn(
  horsesOdds: number[],
  betAmount: number,
  combinations: number
): { min: number; max: number } {
  const avgOdds = horsesOdds.reduce((a, b) => a + b, 0) / horsesOdds.length || 3;
  const maxOdds = Math.max(...horsesOdds, 3);

  const totalBet = betAmount * combinations;
  const baseMultiplier = (maxOdds + 1) * (avgOdds * 0.4 + 1) * 3;
  const basePayout = totalBet * baseMultiplier * 0.7;

  return {
    min: Math.round(Math.max(totalBet * 8, basePayout * 0.3)),
    max: Math.round(basePayout * 2.5),
  };
}

// ============================================================================
// UNIFIED RETURN ESTIMATOR
// ============================================================================

/**
 * Estimate return for any bet type
 */
export function estimateBetReturn(
  betType: BetType,
  horsesOdds: number[],
  betAmount: number,
  combinations: number = 1
): { min: number; max: number } {
  const primaryOdds = horsesOdds[0] || 5;
  const secondaryOdds = horsesOdds[1] || 3;

  switch (betType) {
    case 'WIN':
      return estimateWinReturn(primaryOdds, betAmount * combinations);

    case 'PLACE':
      return estimatePlaceReturn(primaryOdds, betAmount * combinations);

    case 'SHOW':
      return estimateShowReturn(primaryOdds, betAmount * combinations);

    case 'EXACTA':
      return estimateExactaReturn(primaryOdds, secondaryOdds, betAmount * combinations);

    case 'EXACTA_BOX':
      return estimateExactaReturn(primaryOdds, secondaryOdds, betAmount * combinations);

    case 'TRIFECTA_KEY':
      return estimateTrifectaKeyReturn(primaryOdds, horsesOdds.slice(1), betAmount, combinations);

    case 'TRIFECTA_BOX':
      return estimateTrifectaBoxReturn(horsesOdds, betAmount, combinations);

    case 'SUPERFECTA_KEY':
      return estimateSuperfectaKeyReturn(primaryOdds, horsesOdds.slice(1), betAmount, combinations);

    case 'SUPERFECTA_BOX':
      return estimateSuperfectaBoxReturn(horsesOdds, betAmount, combinations);

    case 'QUINELLA':
      // Quinella pays similar to exacta but single bet
      return estimateExactaReturn(primaryOdds, secondaryOdds, betAmount * combinations);

    case 'TRIFECTA':
      // Straight trifecta return
      return estimateTrifectaBoxReturn(horsesOdds, betAmount, 1);

    default:
      return { min: 0, max: 0 };
  }
}

/**
 * Format potential return for display
 * Shows as "$35-48" or "$180-500"
 */
export function formatReturnRange(returns: { min: number; max: number }): string {
  if (returns.min === 0 && returns.max === 0) {
    return '$0';
  }

  // If min and max are very close, just show one number
  if (Math.abs(returns.max - returns.min) <= 5) {
    return `$${returns.max}`;
  }

  return `$${returns.min}-${returns.max}`;
}

/**
 * Format profit range (return minus investment)
 */
export function formatProfitRange(
  returns: { min: number; max: number },
  investment: number
): string {
  const minProfit = returns.min - investment;
  const maxProfit = returns.max - investment;

  if (minProfit <= 0 && maxProfit <= 0) {
    return `-$${Math.abs(maxProfit)}`;
  }

  if (minProfit === maxProfit) {
    return `+$${maxProfit}`;
  }

  return `+$${minProfit}-${maxProfit}`;
}

/**
 * Calculate combined return scenarios
 * Shows what happens if different bets hit
 */
export interface ReturnScenario {
  description: string;
  betsHit: string[];
  totalReturn: { min: number; max: number };
  profit: { min: number; max: number };
  isMainScenario: boolean;
}

export function calculateReturnScenarios(
  bets: Array<{
    type: BetType;
    totalCost: number;
    potentialReturn: { min: number; max: number };
    horseNames: string[];
  }>,
  totalInvestment: number
): ReturnScenario[] {
  const scenarios: ReturnScenario[] = [];

  // Scenario 1: Place/Show bet hits only
  const straightBets = bets.filter((b) => ['PLACE', 'SHOW', 'WIN'].includes(b.type));
  if (straightBets.length > 0) {
    const bet = straightBets[0]!;
    scenarios.push({
      description: `If ${bet.type.toLowerCase()} hits`,
      betsHit: [`${bet.type} on ${bet.horseNames[0]}`],
      totalReturn: bet.potentialReturn,
      profit: {
        min: bet.potentialReturn.min - totalInvestment,
        max: bet.potentialReturn.max - totalInvestment,
      },
      isMainScenario: false,
    });
  }

  // Scenario 2: Exotic hits
  const exoticBets = bets.filter((b) =>
    ['EXACTA', 'EXACTA_BOX', 'TRIFECTA_KEY', 'TRIFECTA_BOX', 'SUPERFECTA_KEY'].includes(b.type)
  );
  if (exoticBets.length > 0) {
    const bet = exoticBets[0]!;
    scenarios.push({
      description: `If ${bet.type.toLowerCase().replace('_', ' ')} hits`,
      betsHit: [`${bet.type.replace('_', ' ')} with ${bet.horseNames.join(', ')}`],
      totalReturn: bet.potentialReturn,
      profit: {
        min: bet.potentialReturn.min - totalInvestment,
        max: bet.potentialReturn.max - totalInvestment,
      },
      isMainScenario: false,
    });
  }

  // Scenario 3: Both hit (if applicable)
  if (straightBets.length > 0 && exoticBets.length > 0) {
    const straight = straightBets[0]!;
    const exotic = exoticBets[0]!;
    const combinedReturn = {
      min: straight.potentialReturn.min + exotic.potentialReturn.min,
      max: straight.potentialReturn.max + exotic.potentialReturn.max,
    };
    scenarios.push({
      description: 'If both hit',
      betsHit: [
        `${straight.type} on ${straight.horseNames[0]}`,
        `${exotic.type.replace('_', ' ')}`,
      ],
      totalReturn: combinedReturn,
      profit: {
        min: combinedReturn.min - totalInvestment,
        max: combinedReturn.max - totalInvestment,
      },
      isMainScenario: true,
    });
  }

  return scenarios;
}
