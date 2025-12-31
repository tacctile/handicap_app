/**
 * Day Budget Allocation Engine
 *
 * Allocates a user's total bankroll across all races based on:
 * - Race verdicts (BET/CAUTION/PASS)
 * - Value plays identified
 * - User's risk style
 */

import type { RiskStyle } from './betTypes';
import type { RaceValueAnalysis, ValuePlay } from '../../hooks/useValueDetection';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Race allocation result
 */
export interface RaceAllocation {
  /** Race number (1-indexed) */
  raceNumber: number;
  /** Race verdict from value analysis */
  verdict: 'BET' | 'CAUTION' | 'PASS';
  /** Primary value play for this race (if any) */
  valuePlay: ValuePlay | null;
  /** Edge percentage (if value play exists) */
  edge: number | null;
  /** Allocated budget for this race */
  allocatedBudget: number;
  /** Track name */
  trackName: string;
  /** Post time (if available) */
  postTime?: string;
}

/**
 * Input for day budget allocation
 */
export interface DayAllocationInput {
  /** Total bankroll for the day */
  totalBankroll: number;
  /** Value analysis for each race (indexed by race number - 1) */
  raceAnalyses: RaceValueAnalysis[];
  /** Track name */
  trackName: string;
  /** User's risk style */
  riskStyle: RiskStyle;
  /** Post times for each race (optional) */
  postTimes?: string[];
}

/**
 * Day budget allocation result
 */
export interface DayAllocationResult {
  /** Allocations for each race */
  raceAllocations: RaceAllocation[];
  /** Total allocated to single-race bets */
  totalAllocated: number;
  /** Reserve for multi-race bets */
  multiRaceReserve: number;
  /** Count by verdict type */
  verdictCounts: {
    bet: number;
    caution: number;
    pass: number;
  };
  /** Budget by verdict type */
  verdictBudgets: {
    bet: number;
    caution: number;
    pass: number;
  };
}

// ============================================================================
// ALLOCATION PERCENTAGES BY STYLE
// ============================================================================

/**
 * Allocation percentages by risk style and verdict
 * Note: These percentages apply to the single-race portion of the bankroll
 */
const ALLOCATION_PERCENTAGES: Record<RiskStyle, { bet: number; caution: number; pass: number }> = {
  safe: {
    bet: 0.35,     // 35% of single-race bankroll to BET races
    caution: 0.25, // 25% to CAUTION races
    pass: 0.40,    // 40% to PASS races (stay in action)
  },
  balanced: {
    bet: 0.50,     // 50% to BET races
    caution: 0.20, // 20% to CAUTION races
    pass: 0.30,    // 30% to PASS races
  },
  aggressive: {
    bet: 0.65,     // 65% to BET races
    caution: 0.20, // 20% to CAUTION races
    pass: 0.15,    // 15% to PASS races (minimal)
  },
};

/**
 * Multi-race reserve percentages by risk style
 * This portion is set aside for multi-race bets (Daily Double, Pick 3, etc.)
 */
const MULTI_RACE_RESERVE_PERCENTAGES: Record<RiskStyle, number> = {
  safe: 0.05,       // 5% reserve for multi-race (minimal)
  balanced: 0.15,   // 15% reserve for multi-race
  aggressive: 0.25, // 25% reserve for multi-race
};

/**
 * Minimum budget per race (track minimums)
 */
const MIN_RACE_BUDGET = 10;

/**
 * Round to nearest $5 for clean numbers
 */
function roundToFive(amount: number): number {
  return Math.round(amount / 5) * 5;
}

/**
 * Ensure minimum budget per race
 */
function ensureMinimum(amount: number, min: number = MIN_RACE_BUDGET): number {
  return Math.max(min, amount);
}

// ============================================================================
// MAIN ALLOCATION FUNCTION
// ============================================================================

/**
 * Allocate total bankroll across all races
 */
export function allocateDayBudget(input: DayAllocationInput): DayAllocationResult {
  const { totalBankroll, raceAnalyses, trackName, riskStyle, postTimes } = input;
  const percentages = ALLOCATION_PERCENTAGES[riskStyle];
  const multiRaceReservePercent = MULTI_RACE_RESERVE_PERCENTAGES[riskStyle];

  // Calculate multi-race reserve first
  const multiRaceReserve = roundToFive(totalBankroll * multiRaceReservePercent);

  // Remaining bankroll for single-race bets
  const singleRaceBankroll = totalBankroll - multiRaceReserve;

  // Count races by verdict
  let betCount = 0;
  let cautionCount = 0;
  let passCount = 0;

  for (const analysis of raceAnalyses) {
    switch (analysis.verdict) {
      case 'BET':
        betCount++;
        break;
      case 'CAUTION':
        cautionCount++;
        break;
      case 'PASS':
        passCount++;
        break;
    }
  }

  // Handle edge cases where no races of a certain type
  // Redistribute unused budget to BET races first, then CAUTION
  let betPercent = percentages.bet;
  let cautionPercent = percentages.caution;
  let passPercent = percentages.pass;

  if (betCount === 0) {
    // No BET races - add to CAUTION if available, else PASS
    if (cautionCount > 0) {
      cautionPercent += betPercent;
    } else {
      passPercent += betPercent;
    }
    betPercent = 0;
  }

  if (cautionCount === 0) {
    // No CAUTION races - split between BET and PASS
    if (betCount > 0) {
      betPercent += cautionPercent * 0.6;
      passPercent += cautionPercent * 0.4;
    } else {
      passPercent += cautionPercent;
    }
    cautionPercent = 0;
  }

  if (passCount === 0) {
    // No PASS races - add to BET first
    if (betCount > 0) {
      betPercent += passPercent;
    } else {
      cautionPercent += passPercent;
    }
    passPercent = 0;
  }

  // Calculate total budget for each verdict type (from single-race bankroll)
  const betBudget = singleRaceBankroll * betPercent;
  const cautionBudget = singleRaceBankroll * cautionPercent;
  const passBudget = singleRaceBankroll * passPercent;

  // Calculate per-race budgets
  const perBetRace = betCount > 0 ? betBudget / betCount : 0;
  const perCautionRace = cautionCount > 0 ? cautionBudget / cautionCount : 0;
  const perPassRace = passCount > 0 ? passBudget / passCount : 0;

  // Create allocations
  const raceAllocations: RaceAllocation[] = raceAnalyses.map((analysis, index) => {
    let rawBudget: number;
    switch (analysis.verdict) {
      case 'BET':
        rawBudget = perBetRace;
        break;
      case 'CAUTION':
        rawBudget = perCautionRace;
        break;
      case 'PASS':
        rawBudget = perPassRace;
        break;
    }

    // Round to $5 and ensure minimum
    const allocatedBudget = ensureMinimum(roundToFive(rawBudget));

    return {
      raceNumber: index + 1,
      verdict: analysis.verdict,
      valuePlay: analysis.primaryValuePlay,
      edge: analysis.primaryValuePlay?.valueEdge ?? null,
      allocatedBudget,
      trackName,
      postTime: postTimes?.[index],
    };
  });

  // Adjust total to match bankroll (handle rounding differences)
  const currentTotal = raceAllocations.reduce((sum, r) => sum + r.allocatedBudget, 0);
  const diff = totalBankroll - currentTotal;

  // Distribute difference to BET races first, then CAUTION
  if (Math.abs(diff) >= 5) {
    const adjustment = roundToFive(diff);
    const targetRaces = raceAllocations
      .filter((r) => r.verdict === 'BET')
      .sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));

    if (targetRaces.length > 0) {
      // Distribute evenly among BET races
      const perRaceAdjust = Math.floor(adjustment / targetRaces.length);
      for (const race of targetRaces) {
        race.allocatedBudget += perRaceAdjust;
      }
    }
  }

  // Calculate final totals
  const totalAllocated = raceAllocations.reduce((sum, r) => sum + r.allocatedBudget, 0);
  const verdictBudgets = {
    bet: raceAllocations.filter((r) => r.verdict === 'BET').reduce((sum, r) => sum + r.allocatedBudget, 0),
    caution: raceAllocations.filter((r) => r.verdict === 'CAUTION').reduce((sum, r) => sum + r.allocatedBudget, 0),
    pass: raceAllocations.filter((r) => r.verdict === 'PASS').reduce((sum, r) => sum + r.allocatedBudget, 0),
  };

  return {
    raceAllocations,
    totalAllocated,
    multiRaceReserve,
    verdictCounts: {
      bet: betCount,
      caution: cautionCount,
      pass: passCount,
    },
    verdictBudgets,
  };
}

/**
 * Get the multi-race reserve percentage for a given risk style
 */
export function getMultiRaceReservePercent(riskStyle: RiskStyle): number {
  return MULTI_RACE_RESERVE_PERCENTAGES[riskStyle];
}

// ============================================================================
// BUDGET ADJUSTMENT FUNCTIONS
// ============================================================================

/**
 * Adjust a specific race's budget and rebalance others
 */
export function adjustRaceBudget(
  allocations: RaceAllocation[],
  raceIndex: number,
  newBudget: number,
  _totalBankroll: number
): RaceAllocation[] {
  const updated = allocations.map((a) => ({ ...a }));
  const targetRace = updated[raceIndex];
  if (!targetRace) return updated;

  const diff = newBudget - targetRace.allocatedBudget;
  targetRace.allocatedBudget = newBudget;

  // Rebalance: take from/give to PASS races first, then CAUTION
  // Never adjust BET races automatically
  const passRaces = updated.filter((r, i) => r.verdict === 'PASS' && i !== raceIndex);
  const cautionRaces = updated.filter((r, i) => r.verdict === 'CAUTION' && i !== raceIndex);

  let remaining = -diff; // Negative means we need to take, positive means we need to give

  // Distribute adjustment
  const adjustRaces = (races: RaceAllocation[], amount: number): number => {
    if (races.length === 0 || amount === 0) return amount;

    const perRace = Math.floor(amount / races.length);
    let leftover = amount - perRace * races.length;

    for (const race of races) {
      let adjustment = perRace;
      if (leftover !== 0) {
        adjustment += Math.sign(leftover);
        leftover -= Math.sign(leftover);
      }

      const newAmount = race.allocatedBudget + adjustment;
      // Ensure we don't go below minimum
      if (newAmount >= MIN_RACE_BUDGET) {
        race.allocatedBudget = newAmount;
      } else {
        // Can't adjust this race enough, return the unused amount
        const unused = MIN_RACE_BUDGET - newAmount;
        race.allocatedBudget = MIN_RACE_BUDGET;
        leftover += unused;
      }
    }

    return leftover;
  };

  // First try PASS races
  remaining = adjustRaces(passRaces, remaining);

  // Then CAUTION races if needed
  if (remaining !== 0) {
    adjustRaces(cautionRaces, remaining);
  }

  return updated;
}

/**
 * Get impact summary for a budget adjustment
 */
export function getAdjustmentImpact(
  allocations: RaceAllocation[],
  raceIndex: number,
  newBudget: number
): { affectedRaces: { raceNumber: number; change: number }[]; canApply: boolean } {
  const current = allocations[raceIndex]?.allocatedBudget ?? 0;
  const diff = newBudget - current;

  if (diff === 0) {
    return { affectedRaces: [], canApply: true };
  }

  // Find races that would be affected
  const affectedRaces: { raceNumber: number; change: number }[] = [];
  const passRaces = allocations.filter((r, i) => r.verdict === 'PASS' && i !== raceIndex);
  const cautionRaces = allocations.filter((r, i) => r.verdict === 'CAUTION' && i !== raceIndex);

  const allTargets = [...passRaces, ...cautionRaces];
  if (allTargets.length === 0) {
    return { affectedRaces: [], canApply: false };
  }

  const perRace = Math.floor(-diff / allTargets.length);
  let distributed = 0;

  for (const race of allTargets) {
    let change = perRace;
    // Check if change would go below minimum
    if (race.allocatedBudget + change < MIN_RACE_BUDGET) {
      change = MIN_RACE_BUDGET - race.allocatedBudget;
    }
    if (change !== 0) {
      affectedRaces.push({ raceNumber: race.raceNumber, change });
      distributed += change;
    }
  }

  // Check if we can fully accommodate the change
  const canApply = Math.abs(distributed + diff) < 5; // Allow small rounding

  return { affectedRaces, canApply };
}
