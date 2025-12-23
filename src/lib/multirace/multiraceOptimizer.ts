/**
 * Multi-Race Bet Optimizer
 *
 * Optimizes multi-race ticket structure based on:
 * - Budget constraints
 * - Race scores and horse quality
 * - Strategy preference (conservative, balanced, aggressive)
 *
 * Strategies:
 * - Conservative: Single best horse per race, low cost
 * - Balanced: 2-3 horses per race
 * - Aggressive: All horses in weak legs, singles in strong
 */

import { validateNumber } from '../sanitization';
import {
  type MultiRaceBetType,
  type MultiRaceStrategy,
  type MultiRaceRaceData,
  type MultiRaceHorse,
  type RaceSelection,
  type OptimizedTicket,
  type MultiRaceOptimizationResult,
  type MultiRaceOptimizationConfig,
  type RaceStrength,
  type MultiRaceCost,
  getBetConfig,
} from './multiraceTypes';
import {
  calculateMultiRaceCost,
  findOptimalBaseBet,
  generateWindowInstruction,
} from './multiraceCalculator';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Score thresholds for race strength classification */
const SCORE_THRESHOLDS = {
  standout: 180, // Clear favorite threshold
  competitive: 160, // Strong contender threshold
  standoutGap: 15, // Minimum gap for standout
  competitiveCount: 3, // Min horses for competitive race
};

// ============================================================================
// STANDOUT ANALYSIS TYPES & FUNCTIONS
// ============================================================================

/**
 * Detailed standout analysis for a horse within its field context
 */
export interface StandoutAnalysis {
  /** Whether this horse is a standout (unique leader with sufficient gap) */
  isStandout: boolean;
  /** Whether this horse is the unique leader (highest score with no ties) */
  isLeader: boolean;
  /** Gap from this horse's score to the next LOWER score (0 if tied for first) */
  gapFromNextBest: number;
  /** Percentile ranking in the field (100 = best, 0 = worst) */
  fieldPercentile: number;
  /** The horse's score */
  score: number;
  /** Top score in the field */
  topScore: number;
  /** Number of horses with lower scores */
  horsesBelow: number;
  /** Total field size */
  fieldSize: number;
}

/**
 * Analyze standout metrics for a single horse within its field context.
 *
 * Handles edge cases:
 * 1. Tied scores: If horse is tied for first, gapFromNextBest = 0 and isLeader = false
 * 2. Single horse: fieldPercentile = 100 (avoids division by zero)
 * 3. All same score: No horse is leader since there's no differentiation
 *
 * @param horseScore - The score of the horse to analyze
 * @param allScores - All scores in the field (can include the horse's score)
 * @returns Detailed standout analysis
 *
 * @example
 * // Tied scores case [180, 180, 160]
 * analyzeHorseStandout(180, [180, 180, 160])
 * // Returns: { isStandout: false, isLeader: false, gapFromNextBest: 0, ... }
 */
export function analyzeHorseStandout(horseScore: number, allScores: number[]): StandoutAnalysis {
  const fieldSize = allScores.length;

  // Edge case: empty field
  if (fieldSize === 0) {
    return {
      isStandout: false,
      isLeader: false,
      gapFromNextBest: 0,
      fieldPercentile: 0,
      score: horseScore,
      topScore: 0,
      horsesBelow: 0,
      fieldSize: 0,
    };
  }

  // Sort scores descending to find topScore
  const sortedScores = [...allScores].sort((a, b) => b - a);
  const topScore = sortedScores[0] ?? 0;

  // Count horses with the SAME score as top score (to detect ties at first)
  const horsesAtTop = sortedScores.filter((s) => s === topScore).length;

  // Count horses with scores BELOW this horse's score
  const horsesBelow = allScores.filter((s) => s < horseScore).length;

  // Calculate field percentile (guards against division by zero)
  // fieldPercentile = 100 if only one horse or fieldSize <= 1
  const fieldPercentile = fieldSize <= 1 ? 100 : (horsesBelow / (fieldSize - 1)) * 100;

  // Find gapFromNextBest:
  // - Find the first score that is STRICTLY LESS THAN this horse's score
  // - If the horse is tied for first, gap = 0 (they're not a true unique leader)
  let gapFromNextBest = 0;
  const isAtTopScore = horseScore === topScore;

  if (isAtTopScore && horsesAtTop > 1) {
    // Horse is tied for first place - gap is 0 since they share the lead
    gapFromNextBest = 0;
  } else {
    // Find the first score that is LESS THAN this horse's score
    const nextBestScore = sortedScores.find((s) => s < horseScore);
    if (nextBestScore !== undefined) {
      gapFromNextBest = horseScore - nextBestScore;
    } else {
      // No horse below this one - this horse is last or only horse
      gapFromNextBest = 0;
    }
  }

  // A horse is only isLeader if:
  // 1. Their score equals topScore, AND
  // 2. No other horse has the same score (unique leader)
  const isLeader = horseScore === topScore && horsesAtTop === 1;

  // A horse is a standout if:
  // 1. They are the unique leader (isLeader = true)
  // 2. Their score meets the standout threshold
  // 3. They have sufficient gap from the next best
  const isStandout =
    isLeader &&
    horseScore >= SCORE_THRESHOLDS.standout &&
    gapFromNextBest >= SCORE_THRESHOLDS.standoutGap;

  return {
    isStandout,
    isLeader,
    gapFromNextBest,
    fieldPercentile,
    score: horseScore,
    topScore,
    horsesBelow,
    fieldSize,
  };
}

/** Strategy-specific selection limits */
const STRATEGY_SELECTIONS: Record<
  MultiRaceStrategy,
  {
    standout: { min: number; max: number };
    competitive: { min: number; max: number };
    weak: { min: number; max: number };
  }
> = {
  conservative: {
    standout: { min: 1, max: 1 },
    competitive: { min: 1, max: 2 },
    weak: { min: 2, max: 3 },
  },
  balanced: {
    standout: { min: 1, max: 2 },
    competitive: { min: 2, max: 3 },
    weak: { min: 3, max: 4 },
  },
  aggressive: {
    standout: { min: 1, max: 1 },
    competitive: { min: 3, max: 4 },
    weak: { min: 0, max: 0 }, // 0 means "All"
  },
};

/** Bankroll warning threshold */
const BANKROLL_WARNING_PERCENT = 0.5; // Warn if > 50% of daily bankroll

// ============================================================================
// RACE ANALYSIS
// ============================================================================

/**
 * Classify race strength based on horse scores.
 *
 * Uses analyzeHorseStandout to properly handle edge cases:
 * - Tied scores: Two horses tied for first are NOT a standout race
 * - All same score: No standout exists
 */
export function classifyRaceStrength(horses: MultiRaceHorse[]): RaceStrength {
  if (horses.length === 0) return 'weak';

  const sorted = [...horses].sort((a, b) => b.score - a.score);
  const topHorse = sorted[0];

  if (!topHorse) return 'weak';

  // Use the new analysis to check for standout (handles ties correctly)
  const allScores = horses.map((h) => h.score);
  const analysis = analyzeHorseStandout(topHorse.score, allScores);

  // Check for standout using the corrected logic:
  // - isStandout already checks for unique leader, threshold, and gap
  if (analysis.isStandout) {
    return 'standout';
  }

  // Check for competitive
  const competitiveHorses = horses.filter((h) => h.score >= SCORE_THRESHOLDS.competitive);
  if (competitiveHorses.length >= SCORE_THRESHOLDS.competitiveCount) {
    return 'competitive';
  }

  return 'weak';
}

/**
 * Find the standout horse in a race.
 *
 * Uses analyzeHorseStandout to properly handle edge cases:
 * - Tied scores: If two horses are tied for first, returns undefined
 * - All same score: Returns undefined since no unique leader exists
 *
 * @returns The standout horse if one exists, undefined otherwise
 */
export function findStandoutHorse(horses: MultiRaceHorse[]): MultiRaceHorse | undefined {
  if (horses.length === 0) return undefined;

  const sorted = [...horses].sort((a, b) => b.score - a.score);
  const topHorse = sorted[0];

  if (!topHorse) return undefined;

  // Use the new analysis to check for standout (handles ties correctly)
  const allScores = horses.map((h) => h.score);
  const analysis = analyzeHorseStandout(topHorse.score, allScores);

  // Only return the horse if they are a true standout (unique leader with gap)
  if (analysis.isStandout) {
    return topHorse;
  }

  return undefined;
}

/**
 * Get top horses for a race based on strategy and strength
 */
export function getTopHorsesForRace(
  race: MultiRaceRaceData,
  strategy: MultiRaceStrategy
): number[] {
  const limits = STRATEGY_SELECTIONS[strategy][race.strength];

  // Special case: "All" for aggressive strategy in weak races
  if (limits.max === 0) {
    return race.horses.map((h) => h.programNumber);
  }

  // Sort by score and take top N
  const sorted = [...race.horses].sort((a, b) => b.score - a.score);
  const count = Math.min(limits.max, sorted.length);

  return sorted.slice(0, count).map((h) => h.programNumber);
}

// ============================================================================
// PROBABILITY CALCULATIONS
// ============================================================================

/**
 * Calculate probability of hitting a multi-race bet
 *
 * Uses the product of individual race win probabilities for selected horses
 */
export function calculateTicketProbability(
  races: MultiRaceRaceData[],
  selections: RaceSelection[]
): number {
  // Empty selections means 0 probability
  if (selections.length === 0 || races.length === 0) {
    return 0;
  }

  let probability = 1;

  for (let i = 0; i < selections.length; i++) {
    const race = races[i];
    const selection = selections[i];

    if (!race || !selection) {
      probability = 0;
      break;
    }

    // Sum probabilities of selected horses (any one winning)
    let legProbability = 0;

    for (const programNumber of selection.selections) {
      const horse = race.horses.find((h) => h.programNumber === programNumber);
      if (horse) {
        legProbability += horse.winProbability;
      }
    }

    // Cap at reasonable max
    legProbability = Math.min(0.9, legProbability);
    probability *= legProbability;
  }

  return Math.max(0, Math.min(1, probability));
}

/**
 * Estimate payout range for a multi-race bet
 */
export function estimatePayoutRange(
  betType: MultiRaceBetType,
  cost: MultiRaceCost,
  probability: number
): { min: number; max: number; likely: number } {
  const config = getBetConfig(betType);

  // Base on typical payouts adjusted for probability
  const probabilityMultiplier = Math.max(1, 1 / (probability * 10));

  // Use typical ranges as baseline
  const { min: typicalMin, max: typicalMax, average } = config.typicalPayoutRange;

  // Adjust based on cost (more coverage = lower payout)
  const coverageAdjustment = Math.max(0.5, 1 / Math.sqrt(cost.combinations / 10));

  return {
    min: Math.round(typicalMin * coverageAdjustment),
    max: Math.round(typicalMax * probabilityMultiplier * coverageAdjustment),
    likely: Math.round(average * probabilityMultiplier * coverageAdjustment),
  };
}

/**
 * Calculate expected value
 * EV = (probability × expected payout) - cost
 */
export function calculateExpectedValue(
  probability: number,
  payoutLikely: number,
  cost: number
): number {
  return probability * payoutLikely - cost;
}

// ============================================================================
// SELECTION OPTIMIZATION
// ============================================================================

/**
 * Generate optimal selections for each race based on strategy
 */
export function generateOptimalSelections(
  races: MultiRaceRaceData[],
  strategy: MultiRaceStrategy,
  _budget?: number,
  _baseBet?: number
): RaceSelection[] {
  const selections: RaceSelection[] = [];

  for (let i = 0; i < races.length; i++) {
    const race = races[i];
    if (!race) continue;

    const horsePicks = getTopHorsesForRace(race, strategy);
    const isAll = strategy === 'aggressive' && race.strength === 'weak';

    selections.push({
      raceNumber: race.raceNumber,
      legNumber: i + 1,
      selections: isAll ? race.horses.map((h) => h.programNumber) : horsePicks,
      isAllSelected: isAll,
      fieldSize: race.fieldSize,
      raceStrength: race.strength,
      suggestedSelections: horsePicks,
      suggestionReason: getSuggestionReason(race, strategy),
    });
  }

  return selections;
}

/**
 * Get suggestion reason for a race
 */
function getSuggestionReason(race: MultiRaceRaceData, strategy: MultiRaceStrategy): string {
  switch (race.strength) {
    case 'standout':
      return `Single this race - clear favorite (#${race.standoutHorse?.programNumber} at ${race.standoutHorse?.score} pts)`;
    case 'competitive': {
      const topHorses = race.horses.filter((h) => h.score >= SCORE_THRESHOLDS.competitive).length;
      return `Spread here - competitive race (${topHorses} horses 160+)`;
    }
    case 'weak':
      return strategy === 'aggressive'
        ? 'Use All - weak race, no standout'
        : 'Spread wide - weak race, no standout';
    default:
      return '';
  }
}

// ============================================================================
// TICKET BUILDING
// ============================================================================

/**
 * Build an optimized ticket
 */
export function buildOptimizedTicket(
  config: MultiRaceOptimizationConfig,
  strategy: MultiRaceStrategy
): OptimizedTicket | null {
  const { betType, races, budget } = config;
  const betConfig = getBetConfig(betType);

  // Generate selections for this strategy
  const selections = generateOptimalSelections(races, strategy, budget, betConfig.defaultBaseBet);

  // Find optimal base bet
  const selectionsPerRace = selections.map((s) => s.selections.length);
  const { baseBet, fits } = findOptimalBaseBet(betType, selectionsPerRace, budget);

  if (!fits) {
    return null;
  }

  // Calculate full cost
  const cost = calculateMultiRaceCost({
    betType,
    selections,
    baseBet,
  });

  if (!cost.isValid) {
    return null;
  }

  // Calculate probability and payout
  const probability = calculateTicketProbability(races, selections);
  const payoutRange = estimatePayoutRange(betType, cost, probability);
  const expectedValue = calculateExpectedValue(probability, payoutRange.likely, cost.total);

  // Generate window instruction
  const firstRace = races[0];
  if (!firstRace) {
    return null;
  }

  const startRace = firstRace.raceNumber;
  const windowInstruction = generateWindowInstruction(
    betType,
    startRace,
    selections.map((s) => ({
      raceNumber: s.raceNumber,
      horses: s.selections,
    })),
    baseBet
  );

  const endRace = startRace + betConfig.racesRequired - 1;

  return {
    id: `${betType}-${strategy}-${Date.now()}`,
    betType,
    selections,
    cost,
    probability,
    payoutRange,
    expectedValue,
    strategy,
    isRecommended: false,
    reasoning: getTicketReasoning(strategy, cost, probability, expectedValue),
    windowInstruction,
    raceRange: `${startRace}-${endRace}`,
  };
}

/**
 * Get reasoning text for a ticket
 */
function getTicketReasoning(
  strategy: MultiRaceStrategy,
  cost: MultiRaceCost,
  probability: number,
  expectedValue: number
): string {
  const probPercent = (probability * 100).toFixed(1);
  const evSign = expectedValue >= 0 ? '+' : '';

  switch (strategy) {
    case 'conservative':
      return `Low-cost approach: ${cost.combinations} combos at $${cost.total.toFixed(2)} (${probPercent}% hit rate, EV: ${evSign}$${expectedValue.toFixed(2)})`;
    case 'balanced':
      return `Balanced coverage: ${cost.combinations} combos (${probPercent}% hit rate, EV: ${evSign}$${expectedValue.toFixed(2)})`;
    case 'aggressive':
      return `Maximum coverage: ${cost.combinations} combos using ALL in weak races (${probPercent}% hit rate, EV: ${evSign}$${expectedValue.toFixed(2)})`;
    default:
      return '';
  }
}

// ============================================================================
// MAIN OPTIMIZATION
// ============================================================================

/**
 * Optimize multi-race bet for given configuration
 */
export function optimizeMultiRaceBet(
  config: MultiRaceOptimizationConfig
): MultiRaceOptimizationResult {
  const { betType, races, budget, strategy, dailyBankroll } = config;
  const betConfig = getBetConfig(betType);

  // Validate race count
  if (races.length < betConfig.racesRequired) {
    return {
      tickets: [],
      recommended: null,
      budgetUsed: 0,
      budgetRemaining: budget,
      summary: `${betConfig.displayName} requires ${betConfig.racesRequired} consecutive races, only ${races.length} provided`,
      isValid: false,
      error: `Not enough races for ${betConfig.displayName}`,
      warnings: [],
    };
  }

  // Validate budget
  const validatedBudget = validateNumber(budget, 20, { min: 1, max: 10000 });
  if (validatedBudget <= 0) {
    return {
      tickets: [],
      recommended: null,
      budgetUsed: 0,
      budgetRemaining: 0,
      summary: 'Invalid budget',
      isValid: false,
      error: 'Budget must be greater than 0',
      warnings: [],
    };
  }

  // Check for cancelled races
  const cancelledRaces = races.filter((r) => r.isCancelled);
  if (cancelledRaces.length > 0) {
    return {
      tickets: [],
      recommended: null,
      budgetUsed: 0,
      budgetRemaining: validatedBudget,
      summary: `Cannot build ticket: Race(s) ${cancelledRaces.map((r) => r.raceNumber).join(', ')} cancelled`,
      isValid: false,
      error: 'One or more races cancelled',
      warnings: [],
    };
  }

  // Build tickets for all strategies if none specified, or just the requested one
  const strategies: MultiRaceStrategy[] = strategy
    ? [strategy]
    : ['conservative', 'balanced', 'aggressive'];

  const tickets: OptimizedTicket[] = [];
  const warnings: string[] = [];

  for (const strat of strategies) {
    const ticket = buildOptimizedTicket({ ...config, budget: validatedBudget }, strat);
    if (ticket) {
      tickets.push(ticket);
    }
  }

  if (tickets.length === 0) {
    return {
      tickets: [],
      recommended: null,
      budgetUsed: 0,
      budgetRemaining: validatedBudget,
      summary: `No viable ${betConfig.displayName} tickets within $${validatedBudget} budget`,
      isValid: false,
      error: 'No tickets fit within budget',
      warnings: [],
    };
  }

  // Sort by expected value (descending)
  tickets.sort((a, b) => b.expectedValue - a.expectedValue);

  // Mark best as recommended
  const recommended = tickets[0];
  if (!recommended) {
    return {
      tickets: [],
      recommended: null,
      budgetUsed: 0,
      budgetRemaining: validatedBudget,
      summary: `No viable ${betConfig.displayName} tickets within $${validatedBudget} budget`,
      isValid: false,
      error: 'No tickets fit within budget',
      warnings: [],
    };
  }

  recommended.isRecommended = true;

  // Check for bankroll warnings
  if (dailyBankroll && recommended.cost.total > dailyBankroll * BANKROLL_WARNING_PERCENT) {
    const percentUsed = ((recommended.cost.total / dailyBankroll) * 100).toFixed(0);
    warnings.push(`Warning: This ticket uses ${percentUsed}% of your daily bankroll`);
  }

  return {
    tickets,
    recommended,
    budgetUsed: recommended.cost.total,
    budgetRemaining: validatedBudget - recommended.cost.total,
    summary: `Recommended: ${recommended.strategy} ${betConfig.displayName} using ${recommended.cost.spreadNotation} for $${recommended.cost.total.toFixed(2)}`,
    isValid: true,
    warnings,
  };
}

// ============================================================================
// QUICK OPTIMIZATION HELPERS
// ============================================================================

/**
 * Quick optimize for Daily Double
 */
export function optimizeDailyDouble(
  race1: MultiRaceRaceData,
  race2: MultiRaceRaceData,
  budget: number,
  strategy?: MultiRaceStrategy
): MultiRaceOptimizationResult {
  return optimizeMultiRaceBet({
    betType: 'daily_double',
    races: [race1, race2],
    budget,
    strategy: strategy || 'balanced',
  });
}

/**
 * Quick optimize for Pick 3
 */
export function optimizePick3(
  races: [MultiRaceRaceData, MultiRaceRaceData, MultiRaceRaceData],
  budget: number,
  strategy?: MultiRaceStrategy
): MultiRaceOptimizationResult {
  return optimizeMultiRaceBet({
    betType: 'pick_3',
    races,
    budget,
    strategy: strategy || 'balanced',
  });
}

/**
 * Quick optimize for Pick 4
 */
export function optimizePick4(
  races: [MultiRaceRaceData, MultiRaceRaceData, MultiRaceRaceData, MultiRaceRaceData],
  budget: number,
  strategy?: MultiRaceStrategy
): MultiRaceOptimizationResult {
  return optimizeMultiRaceBet({
    betType: 'pick_4',
    races,
    budget,
    strategy: strategy || 'balanced',
  });
}

/**
 * Quick optimize for Pick 5
 */
export function optimizePick5(
  races: [
    MultiRaceRaceData,
    MultiRaceRaceData,
    MultiRaceRaceData,
    MultiRaceRaceData,
    MultiRaceRaceData,
  ],
  budget: number,
  strategy?: MultiRaceStrategy
): MultiRaceOptimizationResult {
  return optimizeMultiRaceBet({
    betType: 'pick_5',
    races,
    budget,
    strategy: strategy || 'balanced',
  });
}

/**
 * Quick optimize for Pick 6
 */
export function optimizePick6(
  races: [
    MultiRaceRaceData,
    MultiRaceRaceData,
    MultiRaceRaceData,
    MultiRaceRaceData,
    MultiRaceRaceData,
    MultiRaceRaceData,
  ],
  budget: number,
  strategy?: MultiRaceStrategy
): MultiRaceOptimizationResult {
  return optimizeMultiRaceBet({
    betType: 'pick_6',
    races,
    budget,
    strategy: strategy || 'balanced',
  });
}

// ============================================================================
// ANALYSIS HELPERS
// ============================================================================

/**
 * Get available multi-race bets for a race card
 */
export function getAvailableMultiRaceBets(
  totalRaces: number,
  startingRace: number = 1
): Array<{
  betType: MultiRaceBetType;
  displayName: string;
  startRace: number;
  endRace: number;
  isAvailable: boolean;
}> {
  const betTypes: MultiRaceBetType[] = ['daily_double', 'pick_3', 'pick_4', 'pick_5', 'pick_6'];
  const results = [];

  for (const betType of betTypes) {
    const config = getBetConfig(betType);
    const remainingRaces = totalRaces - startingRace + 1;
    const isAvailable = remainingRaces >= config.racesRequired;

    results.push({
      betType,
      displayName: config.displayName,
      startRace: startingRace,
      endRace: startingRace + config.racesRequired - 1,
      isAvailable,
    });
  }

  return results;
}

/**
 * Analyze race card for multi-race opportunities
 */
export function analyzeRaceCard(races: MultiRaceRaceData[]): {
  totalRaces: number;
  standoutRaces: number[];
  competitiveRaces: number[];
  weakRaces: number[];
  bestOpportunity: MultiRaceBetType | null;
  recommendation: string;
} {
  const standoutRaces: number[] = [];
  const competitiveRaces: number[] = [];
  const weakRaces: number[] = [];

  for (const race of races) {
    switch (race.strength) {
      case 'standout':
        standoutRaces.push(race.raceNumber);
        break;
      case 'competitive':
        competitiveRaces.push(race.raceNumber);
        break;
      case 'weak':
        weakRaces.push(race.raceNumber);
        break;
    }
  }

  // Determine best opportunity
  let bestOpportunity: MultiRaceBetType | null = null;
  let recommendation = '';

  if (races.length >= 6 && standoutRaces.length >= 2) {
    bestOpportunity = 'pick_6';
    recommendation = `Pick 6 opportunity: ${standoutRaces.length} standout races for singles, good structure`;
  } else if (races.length >= 4 && standoutRaces.length >= 1) {
    bestOpportunity = 'pick_4';
    recommendation = `Pick 4 opportunity: ${standoutRaces.length} singles, balanced coverage possible`;
  } else if (races.length >= 3) {
    bestOpportunity = 'pick_3';
    recommendation = 'Pick 3 available for manageable multi-race action';
  } else if (races.length >= 2) {
    bestOpportunity = 'daily_double';
    recommendation = 'Daily Double is the only multi-race option with this card';
  }

  return {
    totalRaces: races.length,
    standoutRaces,
    competitiveRaces,
    weakRaces,
    bestOpportunity,
    recommendation,
  };
}
