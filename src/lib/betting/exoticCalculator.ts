/**
 * Exotic Bet Calculator
 *
 * Calculates costs, combinations, and estimated probabilities for
 * exotic bets keyed on a single horse:
 * - Exacta Key (Key horse with other horses)
 * - Trifecta Key (Key horse with other horses)
 * - Superfecta Key (Key horse with other horses)
 *
 * Note: EV calculations for exotics are highly speculative due to
 * the difficulty of estimating accurate payout distributions.
 * These recommendations should be marked as "speculative" in the UI.
 *
 * @module betting/exoticCalculator
 */

import type { OverlayPipelineOutput } from '../scoring/overlayPipeline';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Exotic bet types supported
 */
export type ExoticBetType = 'EXACTA_KEY' | 'TRIFECTA_KEY' | 'SUPERFECTA_KEY';

/**
 * Exotic key bet structure
 */
export interface ExoticKeyBet {
  /** Type of exotic bet */
  betType: ExoticBetType;
  /** Key horse program number (must finish 1st) */
  keyHorse: number;
  /** Horses to use underneath the key */
  withHorses: number[];
  /** Number of combinations */
  combinations: number;
  /** Cost per unit ($2 for exacta, $1 for trifecta, $0.10 for superfecta) */
  costPerUnit: number;
  /** Total cost of the ticket */
  totalCost: number;
  /** Rough estimated probability (very approximate) */
  estimatedProbability: number;
  /** Estimated EV (marked as speculative) */
  estimatedEV: number | null;
  /** Whether this is a speculative calculation */
  isSpeculative: boolean;
  /** Reasoning for the recommendation */
  reasoning: string;
  /** Key horse name if available */
  keyHorseName?: string;
  /** Tier of the key horse */
  keyHorseTier: 'TIER_1' | 'TIER_2' | 'TIER_3';
}

/**
 * Exotic recommendation result
 */
export interface ExoticRecommendations {
  /** All exotic recommendations */
  bets: ExoticKeyBet[];
  /** Total cost of all exotics */
  totalCost: number;
  /** Whether any exotics are recommended */
  hasRecommendations: boolean;
  /** Reason if no recommendations */
  noRecommendationReason?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum base unit for exacta ($2 standard) */
const EXACTA_BASE_UNIT = 2;

/** Minimum base unit for trifecta ($1 standard) */
const TRIFECTA_BASE_UNIT = 1;

/** Minimum base unit for superfecta ($0.10 or $1) */
const SUPERFECTA_BASE_UNIT = 0.1;

/** Minimum field size for exacta key */
const MIN_FIELD_SIZE_EXACTA = 4;

/** Minimum field size for trifecta key */
const MIN_FIELD_SIZE_TRIFECTA = 5;

/** Minimum field size for superfecta key */
const MIN_FIELD_SIZE_SUPERFECTA = 6;

/** Minimum score for Tier 1 key horse */
const TIER_1_MIN_SCORE = 180;

/** Minimum score for Tier 2/3 horses underneath */
const UNDERNEATH_MIN_SCORE = 140;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Calculate an exacta key bet
 *
 * Key horse wins, any of the with horses finish 2nd.
 * Combinations = number of with horses
 *
 * @param keyHorse - Program number of key horse
 * @param withHorses - Program numbers of horses underneath
 * @param probabilities - Map of program number to win probability
 * @param baseAmount - Base bet amount (default $2)
 * @returns Exacta key bet structure
 *
 * @example
 * const bet = calculateExactaKey(3, [5, 7, 8], probabilities, 2);
 * // 3 combinations: 3-5, 3-7, 3-8
 * // Total cost: $6
 */
export function calculateExactaKey(
  keyHorse: number,
  withHorses: number[],
  probabilities: Map<number, number>,
  baseAmount: number = EXACTA_BASE_UNIT
): ExoticKeyBet {
  // Filter out the key horse from with horses if present
  const filteredWithHorses = withHorses.filter((h) => h !== keyHorse);

  // Number of combinations = number of with horses
  const combinations = filteredWithHorses.length;

  // Total cost
  const totalCost = combinations * baseAmount;

  // Estimate probability (very rough)
  // P(exacta) ≈ P(key wins) × P(one of with horses finishes 2nd | key wins)
  const keyWinProb = probabilities.get(keyHorse) ?? 0;
  const withProbs = filteredWithHorses.map((h) => probabilities.get(h) ?? 0);
  const withTotalProb = withProbs.reduce((sum, p) => sum + p, 0);

  // Rough approximation: P(with horse is 2nd | key wins) ≈ withProb / (1 - keyWinProb)
  const conditionalWithProb = keyWinProb < 1 ? withTotalProb / (1 - keyWinProb) : withTotalProb;
  const estimatedProbability = keyWinProb * Math.min(1, conditionalWithProb);

  return {
    betType: 'EXACTA_KEY',
    keyHorse,
    withHorses: filteredWithHorses,
    combinations,
    costPerUnit: baseAmount,
    totalCost,
    estimatedProbability,
    estimatedEV: null, // Mark as speculative - can't reliably estimate exacta payouts
    isSpeculative: true,
    reasoning: `Key #${keyHorse} over ${filteredWithHorses.length} horses (${filteredWithHorses.join(', ')})`,
    keyHorseTier: 'TIER_1', // Default, will be updated by recommender
  };
}

/**
 * Calculate a trifecta key bet
 *
 * Key horse wins, with horses fill 2nd and 3rd in any order.
 * Combinations = withHorses × (withHorses - 1)
 *
 * @param keyHorse - Program number of key horse
 * @param withHorses - Program numbers of horses underneath
 * @param probabilities - Map of program number to win probability
 * @param baseAmount - Base bet amount (default $1)
 * @returns Trifecta key bet structure
 *
 * @example
 * const bet = calculateTrifectaKey(3, [5, 7, 8], probabilities, 1);
 * // 6 combinations: 3-5-7, 3-5-8, 3-7-5, 3-7-8, 3-8-5, 3-8-7
 * // Total cost: $6
 */
export function calculateTrifectaKey(
  keyHorse: number,
  withHorses: number[],
  probabilities: Map<number, number>,
  baseAmount: number = TRIFECTA_BASE_UNIT
): ExoticKeyBet {
  // Filter out the key horse from with horses if present
  const filteredWithHorses = withHorses.filter((h) => h !== keyHorse);

  // Need at least 2 horses for trifecta
  if (filteredWithHorses.length < 2) {
    return {
      betType: 'TRIFECTA_KEY',
      keyHorse,
      withHorses: filteredWithHorses,
      combinations: 0,
      costPerUnit: baseAmount,
      totalCost: 0,
      estimatedProbability: 0,
      estimatedEV: null,
      isSpeculative: true,
      reasoning: 'Need at least 2 horses underneath for trifecta key',
      keyHorseTier: 'TIER_1',
    };
  }

  // Combinations = n × (n-1) where n = number of with horses
  const n = filteredWithHorses.length;
  const combinations = n * (n - 1);

  // Total cost
  const totalCost = combinations * baseAmount;

  // Estimate probability (very rough)
  const keyWinProb = probabilities.get(keyHorse) ?? 0;
  const withProbs = filteredWithHorses.map((h) => probabilities.get(h) ?? 0);
  const withTotalProb = withProbs.reduce((sum, p) => sum + p, 0);

  // Very rough approximation for trifecta probability
  const estimatedProbability = keyWinProb * Math.pow(withTotalProb, 0.7) * 0.3;

  return {
    betType: 'TRIFECTA_KEY',
    keyHorse,
    withHorses: filteredWithHorses,
    combinations,
    costPerUnit: baseAmount,
    totalCost,
    estimatedProbability: Math.min(0.5, estimatedProbability),
    estimatedEV: null, // Speculative
    isSpeculative: true,
    reasoning: `Key #${keyHorse} over ${n} horses (${combinations} combinations)`,
    keyHorseTier: 'TIER_1',
  };
}

/**
 * Calculate a superfecta key bet
 *
 * Key horse wins, with horses fill 2nd, 3rd, and 4th in any order.
 * Combinations = withHorses × (withHorses - 1) × (withHorses - 2)
 *
 * @param keyHorse - Program number of key horse
 * @param withHorses - Program numbers of horses underneath
 * @param probabilities - Map of program number to win probability
 * @param baseAmount - Base bet amount (default $0.10)
 * @returns Superfecta key bet structure
 */
export function calculateSuperfectaKey(
  keyHorse: number,
  withHorses: number[],
  probabilities: Map<number, number>,
  baseAmount: number = SUPERFECTA_BASE_UNIT
): ExoticKeyBet {
  // Filter out the key horse from with horses if present
  const filteredWithHorses = withHorses.filter((h) => h !== keyHorse);

  // Need at least 3 horses for superfecta
  if (filteredWithHorses.length < 3) {
    return {
      betType: 'SUPERFECTA_KEY',
      keyHorse,
      withHorses: filteredWithHorses,
      combinations: 0,
      costPerUnit: baseAmount,
      totalCost: 0,
      estimatedProbability: 0,
      estimatedEV: null,
      isSpeculative: true,
      reasoning: 'Need at least 3 horses underneath for superfecta key',
      keyHorseTier: 'TIER_1',
    };
  }

  // Combinations = n × (n-1) × (n-2) where n = number of with horses
  const n = filteredWithHorses.length;
  const combinations = n * (n - 1) * (n - 2);

  // Total cost
  const totalCost = combinations * baseAmount;

  // Estimate probability (very rough)
  const keyWinProb = probabilities.get(keyHorse) ?? 0;

  // Very rough approximation for superfecta probability
  const estimatedProbability = keyWinProb * 0.05; // Very low hit rate

  return {
    betType: 'SUPERFECTA_KEY',
    keyHorse,
    withHorses: filteredWithHorses,
    combinations,
    costPerUnit: baseAmount,
    totalCost,
    estimatedProbability: Math.min(0.2, estimatedProbability),
    estimatedEV: null, // Speculative
    isSpeculative: true,
    reasoning: `Key #${keyHorse} over ${n} horses (${combinations} combinations)`,
    keyHorseTier: 'TIER_1',
  };
}

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

/**
 * Recommend exotic key bets based on pipeline output
 *
 * Only recommends when:
 * - Strong key horse identified (Tier 1)
 * - 2-4 logical horses underneath (Tier 2-3)
 * - Field size supports exotics (6+ horses)
 *
 * @param pipelineOutput - Overlay pipeline output
 * @param bankroll - Current bankroll
 * @param maxExoticBudget - Maximum budget for exotic bets (default $20)
 * @returns Exotic recommendations
 */
export function recommendExoticKeys(
  pipelineOutput: OverlayPipelineOutput,
  _bankroll: number,
  maxExoticBudget: number = 20
): ExoticRecommendations {
  const fieldSize = pipelineOutput.fieldMetrics.fieldSize;
  const horses = pipelineOutput.horses;

  // Check minimum field size
  if (fieldSize < MIN_FIELD_SIZE_EXACTA) {
    return {
      bets: [],
      totalCost: 0,
      hasRecommendations: false,
      noRecommendationReason: `Field size (${fieldSize}) too small for exotic keys`,
    };
  }

  // Find Tier 1 horses (potential keys)
  const tier1Horses = horses.filter((h) => h.baseScore >= TIER_1_MIN_SCORE);

  if (tier1Horses.length === 0) {
    return {
      bets: [],
      totalCost: 0,
      hasRecommendations: false,
      noRecommendationReason: 'No Tier 1 horses identified for key position',
    };
  }

  // Find Tier 2-3 horses (potential underneath)
  const underneathHorses = horses.filter(
    (h) => h.baseScore >= UNDERNEATH_MIN_SCORE && h.baseScore < TIER_1_MIN_SCORE
  );

  if (underneathHorses.length < 2) {
    return {
      bets: [],
      totalCost: 0,
      hasRecommendations: false,
      noRecommendationReason: 'Not enough Tier 2-3 horses for exotic key underneath',
    };
  }

  // Build probability map
  const probabilities = new Map<number, number>();
  for (const horse of horses) {
    probabilities.set(horse.programNumber, horse.modelProbability);
  }

  // Generate recommendations
  const bets: ExoticKeyBet[] = [];
  let totalBudgetUsed = 0;

  // Use the strongest Tier 1 horse as the key
  const keyHorse = tier1Horses.sort((a, b) => b.baseScore - a.baseScore)[0]!;

  // Get 2-4 best underneath horses
  const withHorses = underneathHorses
    .sort((a, b) => b.baseScore - a.baseScore)
    .slice(0, 4)
    .map((h) => h.programNumber);

  // Calculate exacta key if within budget
  if (fieldSize >= MIN_FIELD_SIZE_EXACTA && withHorses.length >= 2) {
    const exacta = calculateExactaKey(
      keyHorse.programNumber,
      withHorses.slice(0, 3), // Use top 3 underneath
      probabilities,
      EXACTA_BASE_UNIT
    );

    if (exacta.totalCost <= maxExoticBudget - totalBudgetUsed && exacta.combinations > 0) {
      exacta.keyHorseName = keyHorse.horseName;
      exacta.keyHorseTier = 'TIER_1';
      bets.push(exacta);
      totalBudgetUsed += exacta.totalCost;
    }
  }

  // Calculate trifecta key if within budget and field supports it
  if (fieldSize >= MIN_FIELD_SIZE_TRIFECTA && withHorses.length >= 3) {
    const trifecta = calculateTrifectaKey(
      keyHorse.programNumber,
      withHorses.slice(0, 4), // Use top 4 underneath
      probabilities,
      TRIFECTA_BASE_UNIT
    );

    if (trifecta.totalCost <= maxExoticBudget - totalBudgetUsed && trifecta.combinations > 0) {
      trifecta.keyHorseName = keyHorse.horseName;
      trifecta.keyHorseTier = 'TIER_1';
      bets.push(trifecta);
      totalBudgetUsed += trifecta.totalCost;
    }
  }

  // Calculate superfecta key if within budget and field supports it
  if (fieldSize >= MIN_FIELD_SIZE_SUPERFECTA && withHorses.length >= 4) {
    const remainingBudget = maxExoticBudget - totalBudgetUsed;

    // Calculate max base unit we can afford
    const superfecta = calculateSuperfectaKey(
      keyHorse.programNumber,
      withHorses,
      probabilities,
      SUPERFECTA_BASE_UNIT
    );

    if (superfecta.totalCost <= remainingBudget && superfecta.combinations > 0) {
      superfecta.keyHorseName = keyHorse.horseName;
      superfecta.keyHorseTier = 'TIER_1';
      bets.push(superfecta);
      totalBudgetUsed += superfecta.totalCost;
    }
  }

  const totalCost = bets.reduce((sum, b) => sum + b.totalCost, 0);

  return {
    bets,
    totalCost,
    hasRecommendations: bets.length > 0,
    noRecommendationReason:
      bets.length === 0 ? 'No exotic bets fit within budget constraints' : undefined,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format exotic bet for display
 */
export function formatExoticBet(bet: ExoticKeyBet): {
  type: string;
  ticket: string;
  cost: string;
  probability: string;
  note: string;
} {
  const typeNames: Record<ExoticBetType, string> = {
    EXACTA_KEY: 'Exacta Key',
    TRIFECTA_KEY: 'Trifecta Key',
    SUPERFECTA_KEY: 'Superfecta Key',
  };

  return {
    type: typeNames[bet.betType],
    ticket: `#${bet.keyHorse} / ${bet.withHorses.join(', ')}`,
    cost: `$${bet.totalCost.toFixed(2)} (${bet.combinations} combos)`,
    probability:
      bet.estimatedProbability > 0
        ? `~${(bet.estimatedProbability * 100).toFixed(1)}% (est.)`
        : 'N/A',
    note: bet.isSpeculative ? 'Speculative - EV not calculated' : '',
  };
}

/**
 * Calculate total combinations for a box bet (all permutations)
 *
 * @param horses - Number of horses in the box
 * @param positions - Number of finishing positions (2 for exacta, 3 for trifecta, 4 for super)
 * @returns Number of combinations
 */
export function calculateBoxCombinations(horses: number, positions: number): number {
  if (horses < positions) return 0;

  // n! / (n - positions)!
  let result = 1;
  for (let i = 0; i < positions; i++) {
    result *= horses - i;
  }
  return result;
}

/**
 * Calculate cost for a box bet
 *
 * @param horses - Number of horses in the box
 * @param betType - Type of exotic bet
 * @param baseAmount - Base bet amount
 * @returns Total cost
 */
export function calculateBoxCost(
  horses: number,
  betType: ExoticBetType,
  baseAmount?: number
): number {
  const positionsMap: Record<ExoticBetType, number> = {
    EXACTA_KEY: 2,
    TRIFECTA_KEY: 3,
    SUPERFECTA_KEY: 4,
  };

  const defaultAmounts: Record<ExoticBetType, number> = {
    EXACTA_KEY: EXACTA_BASE_UNIT,
    TRIFECTA_KEY: TRIFECTA_BASE_UNIT,
    SUPERFECTA_KEY: SUPERFECTA_BASE_UNIT,
  };

  const positions = positionsMap[betType];
  const amount = baseAmount ?? defaultAmounts[betType];
  const combinations = calculateBoxCombinations(horses, positions);

  return combinations * amount;
}

/**
 * Validate exotic bet parameters
 */
export function validateExoticBet(bet: ExoticKeyBet): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (bet.keyHorse <= 0) {
    errors.push('Invalid key horse number');
  }

  if (bet.withHorses.length === 0) {
    errors.push('No horses selected underneath');
  }

  if (bet.withHorses.includes(bet.keyHorse)) {
    errors.push('Key horse cannot be in with horses list');
  }

  const minWith: Record<ExoticBetType, number> = {
    EXACTA_KEY: 1,
    TRIFECTA_KEY: 2,
    SUPERFECTA_KEY: 3,
  };

  if (bet.withHorses.length < minWith[bet.betType]) {
    errors.push(`${bet.betType} requires at least ${minWith[bet.betType]} horses underneath`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get exotic bet type info
 */
export function getExoticBetInfo(betType: ExoticBetType): {
  name: string;
  description: string;
  minHorses: number;
  baseUnit: number;
  positions: number;
} {
  const info: Record<ExoticBetType, ReturnType<typeof getExoticBetInfo>> = {
    EXACTA_KEY: {
      name: 'Exacta Key',
      description: 'Key horse wins, with horses finish 2nd',
      minHorses: 2,
      baseUnit: EXACTA_BASE_UNIT,
      positions: 2,
    },
    TRIFECTA_KEY: {
      name: 'Trifecta Key',
      description: 'Key horse wins, with horses fill 2nd & 3rd',
      minHorses: 3,
      baseUnit: TRIFECTA_BASE_UNIT,
      positions: 3,
    },
    SUPERFECTA_KEY: {
      name: 'Superfecta Key',
      description: 'Key horse wins, with horses fill 2nd, 3rd & 4th',
      minHorses: 4,
      baseUnit: SUPERFECTA_BASE_UNIT,
      positions: 4,
    },
  };

  return info[betType];
}
