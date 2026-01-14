/**
 * Combination Calculator
 *
 * Functions for calculating bet combinations, costs, and potential returns.
 * Also generates "what to say at window" scripts.
 */

import type { BetType } from './betTypes';

// ============================================================================
// COMBINATION CALCULATIONS
// ============================================================================

/**
 * Calculate the factorial of a number
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Calculate permutations P(n, r) = n! / (n-r)!
 */
function permutations(n: number, r: number): number {
  if (n < r) return 0;
  return factorial(n) / factorial(n - r);
}

/**
 * Calculate number of combinations for any bet type
 */
export function calculateCombinations(
  betType: string,
  horseCount: number,
  keyHorseCount?: number
): number {
  switch (betType) {
    case 'WIN':
    case 'PLACE':
    case 'SHOW':
      return 1;

    case 'EXACTA':
      return 1; // Straight exacta

    case 'EXACTA_BOX':
      // n * (n-1) combinations
      if (horseCount < 2) return 0;
      return horseCount * (horseCount - 1);

    case 'EXACTA_KEY':
      // Key over n horses = n combinations
      return keyHorseCount || (horseCount - 1);

    case 'TRIFECTA':
      return 1; // Straight trifecta

    case 'TRIFECTA_BOX':
      // n * (n-1) * (n-2) combinations
      if (horseCount < 3) return 0;
      return horseCount * (horseCount - 1) * (horseCount - 2);

    case 'TRIFECTA_KEY':
      // Key with n other horses: n * (n-1) combinations
      // (key is 1st, pick 2 from n others in order)
      const withHorses = keyHorseCount || (horseCount - 1);
      if (withHorses < 2) return 0;
      return withHorses * (withHorses - 1);

    case 'SUPERFECTA':
      return 1; // Straight superfecta

    case 'SUPERFECTA_BOX':
      // n * (n-1) * (n-2) * (n-3) combinations
      if (horseCount < 4) return 0;
      return horseCount * (horseCount - 1) * (horseCount - 2) * (horseCount - 3);

    case 'SUPERFECTA_KEY':
      // Key with n other horses: n * (n-1) * (n-2) combinations
      const superWithHorses = keyHorseCount || (horseCount - 1);
      if (superWithHorses < 3) return 0;
      return superWithHorses * (superWithHorses - 1) * (superWithHorses - 2);

    case 'QUINELLA':
      return 1; // Single quinella bet covers both orders

    case 'DAILY_DOUBLE':
      // Horse count is total across both races
      return horseCount;

    case 'PICK_3':
    case 'PICK_4':
    case 'PICK_5':
    case 'PICK_6':
      // For multi-race bets, horseCount is the product of horses per leg
      return horseCount;

    default:
      return 1;
  }
}

/**
 * Get combination counts for common box sizes
 */
export const BOX_COMBINATIONS = {
  EXACTA_BOX: {
    2: 2,
    3: 6,
    4: 12,
    5: 20,
    6: 30,
  },
  TRIFECTA_BOX: {
    3: 6,
    4: 24,
    5: 60,
    6: 120,
    7: 210,
  },
  SUPERFECTA_BOX: {
    4: 24,
    5: 120,
    6: 360,
    7: 840,
    8: 1680,
  },
} as const;

// ============================================================================
// COST CALCULATIONS
// ============================================================================

/**
 * Calculate total cost of a bet
 */
export function calculateTotalCost(
  combinations: number,
  baseAmount: number
): number {
  return combinations * baseAmount;
}

/**
 * Get minimum bet amounts by bet type
 */
export const MINIMUM_BET_AMOUNTS: Record<string, number> = {
  WIN: 2,
  PLACE: 2,
  SHOW: 2,
  EXACTA: 2,
  EXACTA_BOX: 2,
  EXACTA_KEY: 2,
  TRIFECTA: 1,
  TRIFECTA_BOX: 1,
  TRIFECTA_KEY: 1,
  SUPERFECTA: 0.5,
  SUPERFECTA_BOX: 0.5,
  SUPERFECTA_KEY: 0.5,
  QUINELLA: 2,
  DAILY_DOUBLE: 2,
  PICK_3: 0.5,
  PICK_4: 0.5,
  PICK_5: 0.5,
  PICK_6: 0.2,
};

/**
 * Calculate maximum horses that fit within a budget
 */
export function calculateMaxHorsesInBudget(
  betType: string,
  budget: number,
  baseAmount: number
): number {
  // For box bets, find max horses where cost <= budget
  switch (betType) {
    case 'EXACTA_BOX':
      for (let n = 2; n <= 10; n++) {
        if (calculateCombinations('EXACTA_BOX', n) * baseAmount > budget) {
          return n - 1;
        }
      }
      return 10;

    case 'TRIFECTA_BOX':
      for (let n = 3; n <= 10; n++) {
        if (calculateCombinations('TRIFECTA_BOX', n) * baseAmount > budget) {
          return n - 1;
        }
      }
      return 10;

    case 'SUPERFECTA_BOX':
      for (let n = 4; n <= 10; n++) {
        if (calculateCombinations('SUPERFECTA_BOX', n) * baseAmount > budget) {
          return n - 1;
        }
      }
      return 10;

    default:
      return Math.floor(budget / baseAmount);
  }
}

// ============================================================================
// RETURN CALCULATIONS
// ============================================================================

export interface Horse {
  programNumber: number;
  horseName: string;
  currentOdds: string;
  decimalOdds: number;
  rank: number;
}

/**
 * Parse odds string to decimal (e.g., "5-1" -> 5)
 */
export function parseOdds(oddsStr: string): number {
  if (!oddsStr) return 5; // Default

  // Handle "X-1" format
  const match = oddsStr.match(/(\d+(?:\.\d+)?)-1/);
  if (match) {
    return parseFloat(match[1]);
  }

  // Handle "X/Y" format
  const fractionMatch = oddsStr.match(/(\d+)\/(\d+)/);
  if (fractionMatch) {
    return parseFloat(fractionMatch[1]) / parseFloat(fractionMatch[2]);
  }

  // Try direct parse
  const num = parseFloat(oddsStr);
  return isNaN(num) ? 5 : num;
}

/**
 * Calculate potential return range based on current odds
 */
export function calculatePotentialReturn(
  betType: string,
  horses: Horse[],
  baseAmount: number,
  combinations: number
): { min: number; max: number } {
  if (horses.length === 0) {
    return { min: 0, max: 0 };
  }

  const totalCost = baseAmount * combinations;
  const odds = horses.map((h) => h.decimalOdds || parseOdds(h.currentOdds));

  switch (betType) {
    case 'WIN': {
      const winOdds = odds[0] || 5;
      const winReturn = baseAmount * (winOdds + 1);
      return { min: winReturn, max: winReturn };
    }

    case 'PLACE': {
      // Place typically pays about 40-60% of win odds
      const placeOdds = (odds[0] || 5) * 0.4;
      const placeReturn = baseAmount * (placeOdds + 1);
      return { min: placeReturn, max: placeReturn * 1.5 };
    }

    case 'SHOW': {
      // Show typically pays about 20-40% of win odds
      const showOdds = (odds[0] || 5) * 0.25;
      const showReturn = baseAmount * (showOdds + 1);
      return { min: showReturn, max: showReturn * 1.5 };
    }

    case 'EXACTA':
    case 'EXACTA_BOX':
    case 'EXACTA_KEY': {
      // Exacta pays approximately odds1 * odds2 * 0.6 (track takeout)
      const minOdds = Math.min(...odds);
      const maxOdds = Math.max(...odds);
      const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;

      const minReturn = baseAmount * (minOdds * 2 * 0.6);
      const maxReturn = baseAmount * (maxOdds * avgOdds * 0.8);

      return {
        min: Math.round(Math.max(totalCost * 2, minReturn)),
        max: Math.round(Math.max(totalCost * 10, maxReturn)),
      };
    }

    case 'TRIFECTA':
    case 'TRIFECTA_BOX':
    case 'TRIFECTA_KEY': {
      // Trifecta pays approximately odds1 * odds2 * odds3 * 0.4
      const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
      const oddsProduct = odds.slice(0, 3).reduce((a, b) => a * b, 1);

      const minReturn = baseAmount * avgOdds * 3;
      const maxReturn = baseAmount * Math.sqrt(oddsProduct) * 2;

      return {
        min: Math.round(Math.max(totalCost * 5, minReturn)),
        max: Math.round(Math.max(totalCost * 50, maxReturn)),
      };
    }

    case 'SUPERFECTA':
    case 'SUPERFECTA_BOX':
    case 'SUPERFECTA_KEY': {
      const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;

      return {
        min: Math.round(totalCost * 20),
        max: Math.round(totalCost * 500 * (avgOdds / 5)),
      };
    }

    default:
      return { min: totalCost * 2, max: totalCost * 10 };
  }
}

// ============================================================================
// WINDOW SCRIPT GENERATION
// ============================================================================

/**
 * Format a list of horse numbers for speaking
 */
function formatHorseList(horses: number[]): string {
  if (horses.length === 0) return '';
  if (horses.length === 1) return String(horses[0]);
  if (horses.length === 2) return `${horses[0]} and ${horses[1]}`;

  const allButLast = horses.slice(0, -1).join(', ');
  const last = horses[horses.length - 1];
  return `${allButLast}, and ${last}`;
}

/**
 * Generate "what to say at window" string for a bet
 */
export function generateWindowScript(
  betType: string,
  horses: Horse[] | number[],
  amount: number,
  raceNumber?: number
): string {
  // Convert Horse objects to numbers if needed
  const horseNumbers =
    typeof horses[0] === 'number'
      ? (horses as number[])
      : (horses as Horse[]).map((h) => h.programNumber);

  const racePrefix = raceNumber ? `Race ${raceNumber}, ` : '';

  switch (betType) {
    case 'WIN':
      return `${racePrefix}$${amount} to WIN on number ${horseNumbers[0]}`;

    case 'PLACE':
      return `${racePrefix}$${amount} to PLACE on number ${horseNumbers[0]}`;

    case 'SHOW':
      return `${racePrefix}$${amount} to SHOW on number ${horseNumbers[0]}`;

    case 'EXACTA':
      return `${racePrefix}$${amount} EXACTA, ${horseNumbers[0]} over ${horseNumbers[1]}`;

    case 'EXACTA_BOX':
      return `${racePrefix}$${amount} EXACTA BOX, ${formatHorseList(horseNumbers)}`;

    case 'EXACTA_KEY': {
      const keyHorse = horseNumbers[0];
      const withHorses = horseNumbers.slice(1);
      return `${racePrefix}$${amount} EXACTA, ${keyHorse} over ${formatHorseList(withHorses)}`;
    }

    case 'TRIFECTA':
      return `${racePrefix}$${amount} TRIFECTA, ${horseNumbers[0]}, ${horseNumbers[1]}, ${horseNumbers[2]}`;

    case 'TRIFECTA_BOX':
      return `${racePrefix}$${amount} TRIFECTA BOX, ${formatHorseList(horseNumbers)}`;

    case 'TRIFECTA_KEY': {
      const triKey = horseNumbers[0];
      const triWith = horseNumbers.slice(1);
      return `${racePrefix}$${amount} TRIFECTA KEY, number ${triKey} ALL with ${formatHorseList(triWith)}`;
    }

    case 'SUPERFECTA':
      return `${racePrefix}$${amount} SUPERFECTA, ${horseNumbers.join(', ')}`;

    case 'SUPERFECTA_BOX':
      return `${racePrefix}$${amount} SUPERFECTA BOX, ${formatHorseList(horseNumbers)}`;

    case 'SUPERFECTA_KEY': {
      const superKey = horseNumbers[0];
      const superWith = horseNumbers.slice(1);
      return `${racePrefix}$${amount} SUPERFECTA KEY, number ${superKey} ALL with ${formatHorseList(superWith)}`;
    }

    case 'QUINELLA':
      return `${racePrefix}$${amount} QUINELLA, ${horseNumbers[0]} and ${horseNumbers[1]}`;

    default:
      return `${racePrefix}$${amount} ${betType} on ${horseNumbers.join(', ')}`;
  }
}

/**
 * Generate a formatted list of all bets for copying
 */
export function generateAllBetsScript(
  bets: Array<{
    betType: string;
    horses: number[];
    amount: number;
    totalCost: number;
  }>,
  raceNumber?: number
): string {
  const lines: string[] = [];

  for (const bet of bets) {
    const script = generateWindowScript(bet.betType, bet.horses, bet.amount, raceNumber);
    lines.push(script);
  }

  return lines.join('\n');
}

/**
 * Generate a detailed bet summary for clipboard
 */
export function generateBetSummary(
  bets: Array<{
    betType: string;
    horses: Horse[];
    amount: number;
    totalCost: number;
    potentialReturn: { min: number; max: number };
  }>,
  trackName: string,
  raceNumber: number
): string {
  const lines: string[] = [
    `${trackName} - Race ${raceNumber}`,
    '─'.repeat(30),
    '',
  ];

  let totalCost = 0;

  for (const bet of bets) {
    const horseNumbers = bet.horses.map((h) => h.programNumber);
    const script = generateWindowScript(bet.betType, horseNumbers, bet.amount);
    lines.push(script);
    lines.push(`  Cost: $${bet.totalCost}`);
    lines.push(`  Potential: $${bet.potentialReturn.min}-$${bet.potentialReturn.max}`);
    lines.push('');
    totalCost += bet.totalCost;
  }

  lines.push('─'.repeat(30));
  lines.push(`TOTAL: $${totalCost}`);

  return lines.join('\n');
}

// ============================================================================
// BUDGET ALLOCATION HELPERS
// ============================================================================

export interface BetAllocation {
  betType: string;
  percentage: number;
  minAmount: number;
}

/**
 * Get recommended bet allocations based on budget and risk
 */
export function getBetAllocations(
  budget: number,
  riskLevel: 'safe' | 'balanced' | 'aggressive'
): BetAllocation[] {
  if (budget < 10) {
    // Small budget - single bets only
    switch (riskLevel) {
      case 'safe':
        return [{ betType: 'WIN', percentage: 100, minAmount: 2 }];
      case 'balanced':
        return [
          { betType: 'PLACE', percentage: 60, minAmount: 2 },
          { betType: 'WIN', percentage: 40, minAmount: 2 },
        ];
      case 'aggressive':
        return [{ betType: 'WIN', percentage: 100, minAmount: 2 }];
    }
  } else if (budget <= 20) {
    switch (riskLevel) {
      case 'safe':
        return [
          { betType: 'WIN', percentage: 50, minAmount: 2 },
          { betType: 'PLACE', percentage: 50, minAmount: 2 },
        ];
      case 'balanced':
        return [
          { betType: 'WIN', percentage: 40, minAmount: 2 },
          { betType: 'EXACTA_BOX', percentage: 60, minAmount: 2 },
        ];
      case 'aggressive':
        return [
          { betType: 'TRIFECTA_KEY', percentage: 80, minAmount: 1 },
          { betType: 'WIN', percentage: 20, minAmount: 2 },
        ];
    }
  } else if (budget <= 50) {
    switch (riskLevel) {
      case 'safe':
        return [
          { betType: 'WIN', percentage: 40, minAmount: 2 },
          { betType: 'PLACE', percentage: 30, minAmount: 2 },
          { betType: 'EXACTA_BOX', percentage: 30, minAmount: 2 },
        ];
      case 'balanced':
        return [
          { betType: 'WIN', percentage: 30, minAmount: 2 },
          { betType: 'EXACTA_BOX', percentage: 30, minAmount: 2 },
          { betType: 'TRIFECTA_KEY', percentage: 40, minAmount: 1 },
        ];
      case 'aggressive':
        return [
          { betType: 'TRIFECTA_BOX', percentage: 60, minAmount: 1 },
          { betType: 'WIN', percentage: 20, minAmount: 2 },
          { betType: 'EXACTA_BOX', percentage: 20, minAmount: 2 },
        ];
    }
  } else {
    // Budget > $50
    switch (riskLevel) {
      case 'safe':
        return [
          { betType: 'WIN', percentage: 30, minAmount: 2 },
          { betType: 'PLACE', percentage: 20, minAmount: 2 },
          { betType: 'SHOW', percentage: 20, minAmount: 2 },
          { betType: 'EXACTA_BOX', percentage: 30, minAmount: 2 },
        ];
      case 'balanced':
        return [
          { betType: 'WIN', percentage: 20, minAmount: 2 },
          { betType: 'EXACTA_BOX', percentage: 30, minAmount: 2 },
          { betType: 'TRIFECTA_BOX', percentage: 50, minAmount: 1 },
        ];
      case 'aggressive':
        return [
          { betType: 'SUPERFECTA_BOX', percentage: 40, minAmount: 0.5 },
          { betType: 'TRIFECTA_BOX', percentage: 40, minAmount: 1 },
          { betType: 'WIN', percentage: 20, minAmount: 2 },
        ];
    }
  }
}
