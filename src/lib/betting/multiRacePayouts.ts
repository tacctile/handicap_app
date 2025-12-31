/**
 * Multi-Race Payout Estimation
 *
 * Estimates potential payouts for multi-race bets based on:
 * - Bet type (Daily Double, Pick 3, Pick 4, etc.)
 * - Horses selected (favorites vs longshots)
 * - Historical typical payouts
 *
 * These are rough estimates - actual payouts vary widely based on
 * public betting patterns and whether longshots come in.
 */

import type { MultiRaceBetType, MultiRaceLeg } from './betTypes';

// ============================================================================
// PAYOUT ESTIMATION DATA
// ============================================================================

/**
 * Base payout multipliers by bet type
 * These represent typical minimum payouts when all favorites win
 */
const BASE_PAYOUTS: Record<MultiRaceBetType, { min: number; max: number }> = {
  DAILY_DOUBLE: { min: 20, max: 50 },
  PICK_3: { min: 50, max: 150 },
  PICK_4: { min: 100, max: 300 },
  PICK_5: { min: 200, max: 600 },
  PICK_6: { min: 500, max: 1500 },
};

/**
 * Longshot multipliers
 * When a longshot hits in a multi-race bet, payouts increase dramatically
 */
const LONGSHOT_MULTIPLIERS = {
  ONE_LONGSHOT: { min: 3, max: 8 },
  TWO_LONGSHOTS: { min: 10, max: 30 },
  THREE_PLUS_LONGSHOTS: { min: 30, max: 100 },
};

/**
 * Odds threshold to consider a horse a "longshot"
 */
const LONGSHOT_ODDS_THRESHOLD = 8; // 8-1 or higher

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse odds string to decimal number
 */
function parseOddsToDecimal(oddsStr: string): number {
  const cleaned = oddsStr.trim().toUpperCase();

  if (cleaned === 'EVEN' || cleaned === 'EVN') {
    return 1.0;
  }

  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const num = parseFloat(parts[0] || '10');
    return num;
  }

  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const num = parseFloat(parts[0] || '10');
    const denom = parseFloat(parts[1] || '1');
    return num / denom;
  }

  return parseFloat(cleaned) || 10;
}

/**
 * Count longshots in a set of legs
 */
function countLongshots(legs: MultiRaceLeg[]): number {
  let count = 0;

  for (const leg of legs) {
    // Check if any horse in the leg is a longshot value play
    if (leg.hasValuePlay && leg.valuePlayHorse) {
      const horseIndex = leg.horses.indexOf(leg.valuePlayHorse);
      if (horseIndex >= 0) {
        const odds = parseOddsToDecimal(leg.horseOdds[horseIndex] || '5-1');
        if (odds >= LONGSHOT_ODDS_THRESHOLD) {
          count++;
        }
      }
    }
  }

  return count;
}

/**
 * Calculate the average odds of selected horses
 */
function calculateAverageOdds(legs: MultiRaceLeg[]): number {
  const allOdds: number[] = [];

  for (const leg of legs) {
    for (const oddsStr of leg.horseOdds) {
      allOdds.push(parseOddsToDecimal(oddsStr));
    }
  }

  if (allOdds.length === 0) return 5;

  return allOdds.reduce((sum, o) => sum + o, 0) / allOdds.length;
}

// ============================================================================
// MAIN ESTIMATION FUNCTION
// ============================================================================

/**
 * Estimate potential payout for a multi-race bet
 *
 * @param type - Type of multi-race bet
 * @param legs - The legs of the bet
 * @param combinations - Total number of combinations
 * @returns Estimated payout range { min, max }
 */
export function estimateMultiRacePayout(
  type: MultiRaceBetType,
  legs: MultiRaceLeg[],
  _combinations: number
): { min: number; max: number } {
  const basePayout = BASE_PAYOUTS[type];
  const longshotCount = countLongshots(legs);
  const avgOdds = calculateAverageOdds(legs);

  // Start with base payout
  let minPayout = basePayout.min;
  let maxPayout = basePayout.max;

  // Adjust for longshots
  if (longshotCount >= 3) {
    minPayout *= LONGSHOT_MULTIPLIERS.THREE_PLUS_LONGSHOTS.min;
    maxPayout *= LONGSHOT_MULTIPLIERS.THREE_PLUS_LONGSHOTS.max;
  } else if (longshotCount === 2) {
    minPayout *= LONGSHOT_MULTIPLIERS.TWO_LONGSHOTS.min;
    maxPayout *= LONGSHOT_MULTIPLIERS.TWO_LONGSHOTS.max;
  } else if (longshotCount === 1) {
    minPayout *= LONGSHOT_MULTIPLIERS.ONE_LONGSHOT.min;
    maxPayout *= LONGSHOT_MULTIPLIERS.ONE_LONGSHOT.max;
  }

  // Adjust for average odds of selected horses
  if (avgOdds > 10) {
    // Higher odds = higher potential payout
    const oddsMultiplier = 1 + (avgOdds - 10) / 20;
    maxPayout *= oddsMultiplier;
  }

  // Round to nice numbers
  minPayout = Math.round(minPayout / 10) * 10;
  maxPayout = Math.round(maxPayout / 50) * 50;

  // Ensure minimum makes sense
  minPayout = Math.max(minPayout, basePayout.min);

  return { min: minPayout, max: maxPayout };
}

/**
 * Get payout scenario descriptions
 */
export function getPayoutScenarios(
  type: MultiRaceBetType,
  legs: MultiRaceLeg[]
): { scenario: string; estimate: string; icon: string }[] {
  const basePayout = BASE_PAYOUTS[type];
  const longshotCount = countLongshots(legs);

  const scenarios = [];

  // All favorites scenario
  scenarios.push({
    scenario: 'If all favorites hit',
    estimate: `~$${basePayout.min}-${basePayout.max}`,
    icon: '📊',
  });

  // One longshot scenario
  if (longshotCount >= 1) {
    const oneLongshot = {
      min: basePayout.min * LONGSHOT_MULTIPLIERS.ONE_LONGSHOT.min,
      max: basePayout.max * LONGSHOT_MULTIPLIERS.ONE_LONGSHOT.max,
    };
    scenarios.push({
      scenario: 'If one longshot hits',
      estimate: `~$${Math.round(oneLongshot.min / 10) * 10}-${Math.round(oneLongshot.max / 100) * 100}`,
      icon: '🎯',
    });
  }

  // Two longshots scenario
  if (longshotCount >= 2) {
    const twoLongshots = {
      min: basePayout.min * LONGSHOT_MULTIPLIERS.TWO_LONGSHOTS.min,
      max: basePayout.max * LONGSHOT_MULTIPLIERS.TWO_LONGSHOTS.max,
    };
    scenarios.push({
      scenario: 'If both value plays hit',
      estimate: `~$${Math.round(twoLongshots.min / 100) * 100}-${Math.round(twoLongshots.max / 1000) * 1000}+`,
      icon: '🔥',
    });
  }

  return scenarios;
}

/**
 * Format payout range for display
 */
export function formatPayoutRange(payout: { min: number; max: number }): string {
  if (payout.max >= 10000) {
    return `$${Math.round(payout.min / 1000)}K - $${Math.round(payout.max / 1000)}K+`;
  }
  if (payout.max >= 1000) {
    return `$${payout.min.toLocaleString()} - $${payout.max.toLocaleString()}`;
  }
  return `$${payout.min} - $${payout.max}`;
}

/**
 * Get typical payout ranges for display in explanations
 */
export function getTypicalPayouts(type: MultiRaceBetType): {
  allFavorites: string;
  oneLongshot: string;
  twoLongshots: string;
} {
  const base = BASE_PAYOUTS[type];
  const one = LONGSHOT_MULTIPLIERS.ONE_LONGSHOT;
  const two = LONGSHOT_MULTIPLIERS.TWO_LONGSHOTS;

  return {
    allFavorites: `$${base.min}-${base.max}`,
    oneLongshot: `$${base.min * one.min}-${base.max * one.max}`,
    twoLongshots: `$${(base.min * two.min).toLocaleString()}-${(base.max * two.max).toLocaleString()}`,
  };
}

/**
 * Calculate expected value (rough estimate)
 * This is very approximate - actual EV depends on true probabilities
 */
export function calculateApproximateEV(
  totalCost: number,
  potentialReturn: { min: number; max: number },
  longshotCount: number
): { ev: number; evPercent: number; rating: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' } {
  // Average expected payout
  const avgPayout = (potentialReturn.min + potentialReturn.max) / 2;

  // Rough hit probability based on longshot count
  // More longshots = lower probability but higher payout
  const baseProbability = 0.15; // 15% base probability for multi-race hit
  const probabilityMultiplier = longshotCount > 0 ? 0.7 ** longshotCount : 1;
  const hitProbability = baseProbability * probabilityMultiplier;

  // Expected value
  const ev = (avgPayout * hitProbability) - (totalCost * (1 - hitProbability));
  const evPercent = (ev / totalCost) * 100;

  let rating: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  if (evPercent > 10) {
    rating = 'POSITIVE';
  } else if (evPercent > -10) {
    rating = 'NEUTRAL';
  } else {
    rating = 'NEGATIVE';
  }

  return { ev: Math.round(ev), evPercent: Math.round(evPercent), rating };
}

/**
 * Get payout color based on range
 */
export function getPayoutColor(max: number): string {
  if (max >= 5000) return '#10b981'; // Green for big potential
  if (max >= 1000) return '#3b82f6'; // Blue for solid potential
  if (max >= 500) return '#f59e0b'; // Amber for modest
  return '#6b7280'; // Gray for low
}
