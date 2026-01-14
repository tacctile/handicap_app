/**
 * Top Bets Generator
 *
 * Generates ALL possible bet combinations for a race, calculates expected value
 * for each, and returns the top 25 ranked by EV.
 *
 * This is the culmination of the entire app:
 * Upload DRF → See Top 25 best bets → No thinking required
 *
 * @module betting/topBetsGenerator
 */

import type { ScoredHorse } from '../scoring';
import type { RaceHeader } from '../../types/drf';
import { logger } from '../../services/logging';

// ============================================================================
// TYPES
// ============================================================================

export type RiskTier = 'Conservative' | 'Moderate' | 'Aggressive';

export type TopBetType =
  | 'WIN'
  | 'PLACE'
  | 'SHOW'
  | 'QUINELLA'
  | 'EXACTA_STRAIGHT'
  | 'EXACTA_BOX_2'
  | 'EXACTA_BOX_3'
  | 'TRIFECTA_STRAIGHT'
  | 'TRIFECTA_BOX_3'
  | 'TRIFECTA_BOX_4'
  | 'TRIFECTA_KEY'
  | 'SUPERFECTA_BOX_4'
  | 'SUPERFECTA_BOX_5';

export interface TopBetHorse {
  programNumber: number;
  name: string;
  position?: 'Key' | 'With' | 'Over' | 'Under';
}

export interface TopBet {
  /** Rank 1-25 */
  rank: number;
  /** Risk classification */
  riskTier: RiskTier;
  /** Bet type display name */
  betType: string;
  /** Internal bet type for processing */
  internalType: TopBetType;
  /** Horses involved in this bet */
  horses: TopBetHorse[];
  /** Total cost in dollars ($1 base unit) */
  cost: number;
  /** Exact words for the betting window */
  whatToSay: string;
  /** Plain English explanation of bet type */
  whatThisBetIs: string;
  /** Algorithm reasoning for this specific bet */
  whyThisBet: string;
  /** Estimated payout range */
  estimatedPayout: string;
  /** Probability of hitting (0-100) */
  probability: number;
  /** Expected value used for ranking */
  expectedValue: number;
  /** Number of permutations this bet covers */
  combinationsInvolved: number;
  /** Horse program numbers for lookup */
  horseNumbers: number[];
}

export interface TopBetsResult {
  /** Top 25 bets sorted by EV */
  topBets: TopBet[];
  /** Total combinations analyzed */
  totalCombinationsAnalyzed: number;
  /** Race context info */
  raceContext: {
    trackCode: string;
    raceNumber: number;
    fieldSize: number;
    surface: string;
  };
  /** Generation timestamp */
  generatedAt: number;
  /** Generation time in ms */
  generationTimeMs: number;
}

/**
 * Internal type for candidate bets before ranking
 */
interface BetCandidate {
  type: TopBetType;
  horseIndices: number[];
  cost: number;
  probability: number;
  estimatedPayout: number;
  expectedValue: number;
  combinationsInvolved: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_UNIT = 1; // $1 base unit

/**
 * Payout estimation multipliers by bet type
 * These are conservative estimates based on typical track payouts
 */
const ESTIMATED_PAYOUT_MULTIPLIERS: Record<TopBetType, { base: number; longshot: number }> = {
  WIN: { base: 1.0, longshot: 1.0 },
  PLACE: { base: 0.4, longshot: 0.4 },
  SHOW: { base: 0.25, longshot: 0.25 },
  QUINELLA: { base: 6, longshot: 12 },
  EXACTA_STRAIGHT: { base: 8, longshot: 15 },
  EXACTA_BOX_2: { base: 8, longshot: 15 },
  EXACTA_BOX_3: { base: 6, longshot: 12 },
  TRIFECTA_STRAIGHT: { base: 80, longshot: 200 },
  TRIFECTA_BOX_3: { base: 60, longshot: 150 },
  TRIFECTA_BOX_4: { base: 40, longshot: 100 },
  TRIFECTA_KEY: { base: 50, longshot: 120 },
  SUPERFECTA_BOX_4: { base: 500, longshot: 2000 },
  SUPERFECTA_BOX_5: { base: 300, longshot: 1500 },
};

/**
 * Risk tier probability thresholds
 */
const RISK_THRESHOLDS = {
  CONSERVATIVE_MIN: 15, // >15% probability
  MODERATE_MIN: 5, // 5-15% probability
  // <5% = Aggressive
} as const;

/**
 * Minimum expected value to consider a bet
 * Negative EV bets are filtered out unless they're the best available
 */
const MIN_EV_THRESHOLD = -0.5;

/**
 * Bet type explanations
 */
const BET_TYPE_EXPLANATIONS: Record<TopBetType, string> = {
  WIN: 'A Win bet pays if your horse finishes 1st. Highest payout but must win.',
  PLACE: 'A Place bet pays if your horse finishes 1st or 2nd. Lower payout but safer.',
  SHOW: 'A Show bet pays if your horse finishes 1st, 2nd, or 3rd. Safest bet, lowest payout.',
  QUINELLA:
    'A Quinella pays if your two horses finish 1st and 2nd in either order. Single bet covering both orders.',
  EXACTA_STRAIGHT:
    'An Exacta Straight pays if your two horses finish 1st and 2nd in the exact order you picked.',
  EXACTA_BOX_2:
    'An Exacta Box pays if your horses finish 1st and 2nd in either order. Costs more but covers both scenarios.',
  EXACTA_BOX_3:
    'A 3-horse Exacta Box pays if any two of your three horses finish 1-2 in either order. More coverage, higher cost.',
  TRIFECTA_STRAIGHT:
    'A Trifecta Straight pays if your three horses finish 1st, 2nd, and 3rd in the exact order. High payout, hard to hit.',
  TRIFECTA_BOX_3:
    'A Trifecta Box pays if your horses finish 1st, 2nd, and 3rd in any order. More combinations = higher cost but better odds of hitting.',
  TRIFECTA_BOX_4:
    'A 4-horse Trifecta Box covers any order of your 4 horses in the top 3. 24 combinations at $1 each = $24.',
  TRIFECTA_KEY:
    "A Trifecta Key puts one horse on top to win, with others filling 2nd and 3rd in any order. Good when you're confident in the winner.",
  SUPERFECTA_BOX_4:
    'A Superfecta Box pays if your horses finish 1st, 2nd, 3rd, and 4th in any order. Very hard to hit but massive payouts.',
  SUPERFECTA_BOX_5:
    'A 5-horse Superfecta Box covers all orders of your 5 horses in the top 4. 120 combinations = $120 at $1.',
};

/**
 * Bet type display names
 */
const BET_TYPE_NAMES: Record<TopBetType, string> = {
  WIN: 'WIN',
  PLACE: 'PLACE',
  SHOW: 'SHOW',
  QUINELLA: 'QUINELLA',
  EXACTA_STRAIGHT: 'EXACTA',
  EXACTA_BOX_2: 'EXACTA BOX',
  EXACTA_BOX_3: 'EXACTA BOX',
  TRIFECTA_STRAIGHT: 'TRIFECTA',
  TRIFECTA_BOX_3: 'TRIFECTA BOX',
  TRIFECTA_BOX_4: 'TRIFECTA BOX',
  TRIFECTA_KEY: 'TRIFECTA KEY',
  SUPERFECTA_BOX_4: 'SUPERFECTA BOX',
  SUPERFECTA_BOX_5: 'SUPERFECTA BOX',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse odds string to decimal number
 */
function parseOddsToDecimal(oddsStr: string): number {
  if (!oddsStr) return 10;
  const cleaned = oddsStr.trim().toUpperCase();

  if (cleaned === 'EVEN' || cleaned === 'EVN') return 1.0;

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

/**
 * Calculate permutations P(n, r)
 */
function permutations(n: number, r: number): number {
  if (n < r || r < 0) return 0;
  let result = 1;
  for (let i = 0; i < r; i++) {
    result *= n - i;
  }
  return result;
}

/**
 * Calculate combinations C(n, r)
 */
function combinations(n: number, r: number): number {
  if (n < r || r < 0) return 0;
  if (r === 0 || r === n) return 1;

  let result = 1;
  for (let i = 0; i < r; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Generate all k-combinations from array indices
 */
function* generateCombinations(n: number, k: number): Generator<number[]> {
  if (k > n || k < 1) return;

  const indices = Array.from({ length: k }, (_, i) => i);

  while (true) {
    yield [...indices];

    let i = k - 1;
    while (i >= 0 && indices[i] === n - k + i) {
      i--;
    }

    if (i < 0) return;

    // Safe to access since i >= 0 and i < k (indices length)
    const currentVal = indices[i]!;
    indices[i] = currentVal + 1;
    for (let j = i + 1; j < k; j++) {
      const prevVal = indices[j - 1]!;
      indices[j] = prevVal + 1;
    }
  }
}

/**
 * Generate all k-permutations from array indices
 */
function* generatePermutations(n: number, k: number): Generator<number[]> {
  for (const combo of generateCombinations(n, k)) {
    yield* permuteArray(combo);
  }
}

/**
 * Generate all permutations of an array
 */
function* permuteArray(arr: number[]): Generator<number[]> {
  const n = arr.length;
  if (n === 0) return;
  if (n === 1) {
    yield [...arr];
    return;
  }

  const c = new Array<number>(n).fill(0);
  yield [...arr];

  let i = 0;
  while (i < n) {
    const ci = c[i] as number;
    if (ci < i) {
      if (i % 2 === 0) {
        const temp = arr[0] as number;
        arr[0] = arr[i] as number;
        arr[i] = temp;
      } else {
        const temp = arr[ci] as number;
        arr[ci] = arr[i] as number;
        arr[i] = temp;
      }
      yield [...arr];
      c[i] = ci + 1;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

/**
 * Determine risk tier based on probability
 */
function determineRiskTier(probability: number): RiskTier {
  if (probability > RISK_THRESHOLDS.CONSERVATIVE_MIN) return 'Conservative';
  if (probability >= RISK_THRESHOLDS.MODERATE_MIN) return 'Moderate';
  return 'Aggressive';
}

/**
 * Format dollars for display
 */
function formatDollars(amount: number): string {
  if (amount >= 1000) {
    return `$${Math.round(amount).toLocaleString()}`;
  }
  return `$${Math.round(amount)}`;
}

// ============================================================================
// PROBABILITY CALCULATIONS
// ============================================================================

/**
 * Scored horse data prepared for probability calculations
 */
interface HorseProb {
  index: number;
  programNumber: number;
  name: string;
  score: number;
  odds: number;
  winProb: number;
  placeProb: number;
  showProb: number;
  modelRank: number;
  edgePercent: number;
  oddsDisplay: string;
}

/**
 * Prepare horses with probability data
 */
function prepareHorseProbs(
  scoredHorses: ScoredHorse[],
  getOdds: (index: number, original: string) => string,
  isScratched: (index: number) => boolean
): HorseProb[] {
  // Filter active horses
  const activeHorses = scoredHorses
    .filter((h) => !isScratched(h.index) && !h.score.isScratched)
    .sort((a, b) => b.score.baseScore - a.score.baseScore);

  if (activeHorses.length === 0) return [];

  // Calculate total score for probability conversion
  const totalScore = activeHorses.reduce((sum, h) => sum + h.score.baseScore, 0);

  return activeHorses.map((h, rankIndex) => {
    const oddsStr = getOdds(h.index, h.horse.morningLineOdds);
    const odds = parseOddsToDecimal(oddsStr);

    // Model win probability based on relative score
    const winProb = totalScore > 0 ? (h.score.baseScore / totalScore) * 100 : 10;

    // Place/Show probabilities adjusted from win probability
    const placeProb = Math.min(95, winProb * 1.6);
    const showProb = Math.min(98, winProb * 2.0);

    // Calculate implied probability from odds
    const impliedProb = (1 / (odds + 1)) * 100;

    // Edge = (model - implied) / implied * 100
    const edgePercent = ((winProb - impliedProb) / Math.max(impliedProb, 0.01)) * 100;

    return {
      index: h.index,
      programNumber: h.horse.programNumber,
      name: h.horse.horseName,
      score: h.score.baseScore,
      odds,
      winProb,
      placeProb,
      showProb,
      modelRank: rankIndex + 1,
      edgePercent,
      oddsDisplay: oddsStr,
    };
  });
}

/**
 * Calculate exacta probability (horse A wins, horse B places)
 */
function calculateExactaProb(horses: HorseProb[], firstIndex: number, secondIndex: number): number {
  const first = horses[firstIndex];
  const second = horses[secondIndex];
  if (!first || !second) return 0;

  // P(A wins) × P(B places | A wins)
  // Conditional: if A wins, remaining horses compete for 2nd
  const remainingHorses = horses.filter((_, i) => i !== firstIndex);
  const remainingScore = remainingHorses.reduce((sum, h) => sum + h.score, 0);
  const bPlaceGivenAWins =
    remainingScore > 0 ? (second.score / remainingScore) * 100 : second.winProb;

  return (first.winProb / 100) * (bPlaceGivenAWins / 100) * 100;
}

/**
 * Calculate trifecta probability
 */
function calculateTrifectaProb(
  horses: HorseProb[],
  firstIndex: number,
  secondIndex: number,
  thirdIndex: number
): number {
  const first = horses[firstIndex];
  const second = horses[secondIndex];
  const third = horses[thirdIndex];
  if (!first || !second || !third) return 0;

  // P(A wins) × P(B places | A) × P(C shows | A, B)
  const remainingAfterFirst = horses.filter((_, i) => i !== firstIndex);
  const scoreAfterFirst = remainingAfterFirst.reduce((sum, h) => sum + h.score, 0);
  const bPlaceGivenA = scoreAfterFirst > 0 ? second.score / scoreAfterFirst : 0;

  const remainingAfterTwo = horses.filter((_, i) => i !== firstIndex && i !== secondIndex);
  const scoreAfterTwo = remainingAfterTwo.reduce((sum, h) => sum + h.score, 0);
  const cShowGivenAB = scoreAfterTwo > 0 ? third.score / scoreAfterTwo : 0;

  return (first.winProb / 100) * bPlaceGivenA * cShowGivenAB * 100;
}

/**
 * Calculate superfecta probability
 */
function calculateSuperfectaProb(horses: HorseProb[], indices: number[]): number {
  if (indices.length < 4) return 0;

  const selectedHorses = indices.map((i) => horses[i]).filter(Boolean);
  if (selectedHorses.length < 4) return 0;

  let prob = 1;
  let remainingScore = horses.reduce((sum, h) => sum + h.score, 0);

  for (const horse of selectedHorses) {
    if (!horse || remainingScore <= 0) break;
    prob *= horse.score / remainingScore;
    remainingScore -= horse.score;
  }

  return prob * 100;
}

/**
 * Calculate box probability (any order of selected horses)
 */
function calculateBoxProb(horses: HorseProb[], indices: number[], positions: number): number {
  if (indices.length < positions) return 0;

  let totalProb = 0;

  // Sum probability of all valid orderings
  for (const perm of generatePermutations(indices.length, positions)) {
    const selectedIndices: number[] = perm
      .map((p) => indices[p])
      .filter((n): n is number => n !== undefined);

    if (positions === 2 && selectedIndices.length >= 2) {
      const first = selectedIndices[0]!;
      const second = selectedIndices[1]!;
      totalProb += calculateExactaProb(horses, first, second);
    } else if (positions === 3 && selectedIndices.length >= 3) {
      const first = selectedIndices[0]!;
      const second = selectedIndices[1]!;
      const third = selectedIndices[2]!;
      totalProb += calculateTrifectaProb(horses, first, second, third);
    } else if (positions === 4 && selectedIndices.length >= 4) {
      totalProb += calculateSuperfectaProb(horses, selectedIndices);
    }
  }

  return totalProb;
}

// ============================================================================
// PAYOUT ESTIMATION
// ============================================================================

/**
 * Estimate payout for a bet
 */
function estimatePayout(
  type: TopBetType,
  horses: HorseProb[],
  selectedIndices: number[],
  baseCost: number
): { min: number; max: number; likely: number } {
  const selectedHorses = selectedIndices
    .map((i) => horses[i])
    .filter((h): h is HorseProb => h !== undefined);
  if (selectedHorses.length === 0) return { min: 0, max: 0, likely: 0 };

  const avgOdds = selectedHorses.reduce((sum, h) => sum + h.odds, 0) / selectedHorses.length;
  const maxOdds = Math.max(...selectedHorses.map((h) => h.odds));
  const minOdds = Math.min(...selectedHorses.map((h) => h.odds));

  const multiplier = ESTIMATED_PAYOUT_MULTIPLIERS[type];
  const isLongshot = minOdds >= 10;
  const baseMultiplier = isLongshot ? multiplier.longshot : multiplier.base;

  switch (type) {
    case 'WIN':
      return {
        min: Math.round(baseCost * (minOdds + 1)),
        max: Math.round(baseCost * (maxOdds + 1)),
        likely: Math.round(baseCost * (avgOdds + 1)),
      };

    case 'PLACE':
      return {
        min: Math.round(baseCost * (minOdds * 0.4 + 1)),
        max: Math.round(baseCost * (maxOdds * 0.5 + 1)),
        likely: Math.round(baseCost * (avgOdds * 0.45 + 1)),
      };

    case 'SHOW':
      return {
        min: Math.round(baseCost * (minOdds * 0.2 + 1)),
        max: Math.round(baseCost * (maxOdds * 0.3 + 1)),
        likely: Math.round(baseCost * (avgOdds * 0.25 + 1)),
      };

    case 'QUINELLA':
      return {
        min: Math.round(baseCost * minOdds * avgOdds * baseMultiplier * 0.6),
        max: Math.round(baseCost * maxOdds * avgOdds * baseMultiplier * 1.2),
        likely: Math.round(baseCost * avgOdds * avgOdds * baseMultiplier * 0.8),
      };

    case 'EXACTA_STRAIGHT':
    case 'EXACTA_BOX_2':
      return {
        min: Math.round(baseCost * minOdds * avgOdds * baseMultiplier * 0.8),
        max: Math.round(baseCost * maxOdds * avgOdds * baseMultiplier * 1.5),
        likely: Math.round(baseCost * avgOdds * avgOdds * baseMultiplier),
      };

    case 'EXACTA_BOX_3':
      return {
        min: Math.round(baseCost * minOdds * avgOdds * baseMultiplier * 0.6),
        max: Math.round(baseCost * maxOdds * avgOdds * baseMultiplier * 1.2),
        likely: Math.round(baseCost * avgOdds * avgOdds * baseMultiplier * 0.8),
      };

    case 'TRIFECTA_STRAIGHT':
    case 'TRIFECTA_BOX_3':
    case 'TRIFECTA_KEY':
      return {
        min: Math.round(baseCost * minOdds * avgOdds * avgOdds * baseMultiplier * 0.3),
        max: Math.round(baseCost * maxOdds * avgOdds * avgOdds * baseMultiplier),
        likely: Math.round(baseCost * avgOdds * avgOdds * avgOdds * baseMultiplier * 0.5),
      };

    case 'TRIFECTA_BOX_4':
      return {
        min: Math.round(baseCost * minOdds * avgOdds * avgOdds * baseMultiplier * 0.2),
        max: Math.round(baseCost * maxOdds * avgOdds * avgOdds * baseMultiplier * 0.8),
        likely: Math.round(baseCost * avgOdds * avgOdds * avgOdds * baseMultiplier * 0.3),
      };

    case 'SUPERFECTA_BOX_4':
    case 'SUPERFECTA_BOX_5':
      return {
        min: Math.round(baseCost * minOdds * avgOdds * avgOdds * avgOdds * baseMultiplier * 0.1),
        max: Math.round(baseCost * maxOdds * avgOdds * avgOdds * avgOdds * baseMultiplier),
        likely: Math.round(baseCost * avgOdds * avgOdds * avgOdds * avgOdds * baseMultiplier * 0.3),
      };

    default:
      return { min: 0, max: 0, likely: 0 };
  }
}

// ============================================================================
// WINDOW INSTRUCTION GENERATION
// ============================================================================

/**
 * Generate exact betting window language
 */
function generateWhatToSay(
  type: TopBetType,
  horses: HorseProb[],
  selectedIndices: number[]
): string {
  const nums = selectedIndices
    .map((i) => horses[i]?.programNumber)
    .filter((n): n is number => n !== undefined);

  if (nums.length === 0) return '';

  switch (type) {
    case 'WIN':
      return `$1 WIN on number ${nums[0]}`;

    case 'PLACE':
      return `$1 PLACE on number ${nums[0]}`;

    case 'SHOW':
      return `$1 SHOW on number ${nums[0]}`;

    case 'QUINELLA':
      return `$1 QUINELLA, ${nums[0]}-${nums[1]}`;

    case 'EXACTA_STRAIGHT':
      return `$1 EXACTA, ${nums[0]} over ${nums[1]}`;

    case 'EXACTA_BOX_2':
      return `$1 EXACTA BOX, ${nums[0]}-${nums[1]}`;

    case 'EXACTA_BOX_3':
      return `$1 EXACTA BOX, ${nums[0]}-${nums[1]}-${nums[2]}`;

    case 'TRIFECTA_STRAIGHT':
      return `$1 TRIFECTA, ${nums[0]}-${nums[1]}-${nums[2]}`;

    case 'TRIFECTA_BOX_3':
      return `$1 TRIFECTA BOX, ${nums[0]}-${nums[1]}-${nums[2]}`;

    case 'TRIFECTA_BOX_4':
      return `$1 TRIFECTA BOX, ${nums[0]}-${nums[1]}-${nums[2]}-${nums[3]}`;

    case 'TRIFECTA_KEY':
      return `$1 TRIFECTA KEY, ${nums[0]} with ${nums.slice(1).join(', ')}`;

    case 'SUPERFECTA_BOX_4':
      return `$1 SUPERFECTA BOX, ${nums[0]}-${nums[1]}-${nums[2]}-${nums[3]}`;

    case 'SUPERFECTA_BOX_5':
      return `$1 SUPERFECTA BOX, ${nums[0]}-${nums[1]}-${nums[2]}-${nums[3]}-${nums[4]}`;

    default:
      return '';
  }
}

// ============================================================================
// REASONING GENERATION
// ============================================================================

/**
 * Generate specific reasoning for a bet
 */
function generateWhyThisBet(
  type: TopBetType,
  horses: HorseProb[],
  selectedIndices: number[]
): string {
  const selectedHorses = selectedIndices
    .map((i) => horses[i])
    .filter((h): h is HorseProb => h !== undefined);
  if (selectedHorses.length === 0) return '';

  const firstHorse = selectedHorses[0];
  if (!firstHorse) return '';

  // Single horse bets (WIN/PLACE/SHOW)
  if (selectedHorses.length === 1) {
    const h = firstHorse;
    const fairOdds = Math.round(100 / h.winProb - 1);

    if (h.edgePercent >= 50) {
      return `${h.name} (#${h.programNumber}) is ranked #${h.modelRank} by our model with +${Math.round(h.edgePercent)}% edge. The public has this horse at ${h.oddsDisplay}, but our analysis says fair odds are ${fairOdds}-1. You're getting paid ${h.edgePercent > 100 ? 'more than double' : 'significantly more than'} what this horse is worth.`;
    } else if (h.modelRank <= 3) {
      return `${h.name} (#${h.programNumber}) ranks #${h.modelRank} in our model. While not a huge overlay at ${h.oddsDisplay}, this horse has solid fundamentals and a ${Math.round(h.winProb)}% model win probability.`;
    } else {
      return `${h.name} (#${h.programNumber}) at ${h.oddsDisplay} offers value despite lower ranking. Our model gives this horse a ${Math.round(h.winProb)}% chance, better than the odds suggest.`;
    }
  }

  // Two horse bets (EXACTA)
  if (selectedHorses.length === 2) {
    const h1 = selectedHorses[0];
    const h2 = selectedHorses[1];
    if (!h1 || !h2) return '';

    const hasEdge1 = h1.edgePercent >= 25;
    const hasEdge2 = h2.edgePercent >= 25;

    if (hasEdge1 && hasEdge2) {
      return `Combining the top 2 value plays: #${h1.programNumber} has +${Math.round(h1.edgePercent)}% edge at ${h1.oddsDisplay}, #${h2.programNumber} has +${Math.round(h2.edgePercent)}% edge at ${h2.oddsDisplay}. If either wins with the other placing, you cash.`;
    } else if (type === 'EXACTA_STRAIGHT') {
      return `Our model has ${h1.name} (#${h1.programNumber}) ranked #${h1.modelRank} with ${Math.round(h1.winProb)}% win probability, over ${h2.name} (#${h2.programNumber}) ranked #${h2.modelRank}. This specific order offers the best EV.`;
    } else {
      return `Boxing #${h1.programNumber} and #${h2.programNumber} covers both orders. Combined these horses have model ranks #${h1.modelRank} and #${h2.modelRank}, giving solid coverage of the top finishers.`;
    }
  }

  // Three horse bets (TRIFECTA)
  if (selectedHorses.length === 3 || (type === 'TRIFECTA_KEY' && selectedHorses.length >= 3)) {
    const topRanks = selectedHorses
      .slice(0, 3)
      .map((h) => h.modelRank)
      .join(', ');
    const avgEdge = selectedHorses.slice(0, 3).reduce((sum, h) => sum + h.edgePercent, 0) / 3;

    if (type === 'TRIFECTA_KEY') {
      const keyHorse = selectedHorses[0];
      const withHorses = selectedHorses.slice(1);
      if (!keyHorse) return '';
      return `A key bet on #${keyHorse.programNumber} makes sense because our model gives ${keyHorse.name} the highest probability of winning${keyHorse.edgePercent > 50 ? ' despite long odds' : ''}. If #${keyHorse.programNumber} wins, any combination of ${withHorses.map((h) => `#${h.programNumber}`).join(', ')} underneath pays.`;
    } else if (type === 'TRIFECTA_STRAIGHT') {
      return `Our model has these horses ranked #${topRanks} with an average +${Math.round(avgEdge)}% edge. This specific order represents the most likely trifecta outcome.`;
    } else {
      return `Boxing our top 3 model picks (#${selectedHorses.map((h) => h.programNumber).join(', ')}) covers all 6 possible orders. Combined model ranks: ${topRanks}.`;
    }
  }

  // Four+ horse bets (TRIFECTA BOX 4, SUPERFECTA)
  if (selectedHorses.length >= 4) {
    const topRanks = selectedHorses
      .slice(0, 4)
      .map((h) => h.modelRank)
      .join(', ');
    const hasLongshot = selectedHorses.some((h) => h.odds >= 10);

    if (type.includes('SUPERFECTA')) {
      return `This superfecta box includes our top model picks (ranks #${topRanks})${hasLongshot ? ' plus a live longshot for massive payout potential' : ''}. While hard to hit, the EV is positive when these horses fill the top 4.`;
    } else {
      return `Expanding to a 4-horse trifecta box covers 24 combinations with our top contenders (ranks #${topRanks}). The extra coverage is worth the cost given the horses involved.`;
    }
  }

  return "This combination offers the best expected value based on our model's probability calculations.";
}

// ============================================================================
// BET GENERATION
// ============================================================================

/**
 * Generate WIN bets
 */
function generateWinBets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];

  for (let i = 0; i < horses.length; i++) {
    const horse = horses[i];
    if (!horse) continue;

    const prob = horse.winProb;
    const payout = estimatePayout('WIN', horses, [i], BASE_UNIT);
    const ev = (prob / 100) * payout.likely - BASE_UNIT;

    candidates.push({
      type: 'WIN',
      horseIndices: [i],
      cost: BASE_UNIT,
      probability: prob,
      estimatedPayout: payout.likely,
      expectedValue: ev,
      combinationsInvolved: 1,
    });
  }

  return candidates;
}

/**
 * Generate PLACE bets
 */
function generatePlaceBets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];

  for (let i = 0; i < horses.length; i++) {
    const horse = horses[i];
    if (!horse) continue;

    const prob = horse.placeProb;
    const payout = estimatePayout('PLACE', horses, [i], BASE_UNIT);
    const ev = (prob / 100) * payout.likely - BASE_UNIT;

    candidates.push({
      type: 'PLACE',
      horseIndices: [i],
      cost: BASE_UNIT,
      probability: prob,
      estimatedPayout: payout.likely,
      expectedValue: ev,
      combinationsInvolved: 1,
    });
  }

  return candidates;
}

/**
 * Generate SHOW bets
 */
function generateShowBets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];

  for (let i = 0; i < horses.length; i++) {
    const horse = horses[i];
    if (!horse) continue;

    const prob = horse.showProb;
    const payout = estimatePayout('SHOW', horses, [i], BASE_UNIT);
    const ev = (prob / 100) * payout.likely - BASE_UNIT;

    candidates.push({
      type: 'SHOW',
      horseIndices: [i],
      cost: BASE_UNIT,
      probability: prob,
      estimatedPayout: payout.likely,
      expectedValue: ev,
      combinationsInvolved: 1,
    });
  }

  return candidates;
}

/**
 * Generate QUINELLA bets (all 2-horse combinations, either order pays)
 */
function generateQuinellaBets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];

  for (const combo of generateCombinations(horses.length, 2)) {
    // Quinella pays if either horse wins and the other places (any order)
    const prob = calculateBoxProb(horses, combo, 2);
    const payout = estimatePayout('QUINELLA', horses, combo, BASE_UNIT);
    const ev = (prob / 100) * payout.likely - BASE_UNIT;

    candidates.push({
      type: 'QUINELLA',
      horseIndices: combo,
      cost: BASE_UNIT, // Single bet covers both orders
      probability: prob,
      estimatedPayout: payout.likely,
      expectedValue: ev,
      combinationsInvolved: 1,
    });
  }

  return candidates;
}

/**
 * Generate EXACTA STRAIGHT bets (all 2-horse permutations)
 */
function generateExactaStraightBets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];
  const n = horses.length;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;

      const prob = calculateExactaProb(horses, i, j);
      const payout = estimatePayout('EXACTA_STRAIGHT', horses, [i, j], BASE_UNIT);
      const ev = (prob / 100) * payout.likely - BASE_UNIT;

      candidates.push({
        type: 'EXACTA_STRAIGHT',
        horseIndices: [i, j],
        cost: BASE_UNIT,
        probability: prob,
        estimatedPayout: payout.likely,
        expectedValue: ev,
        combinationsInvolved: 1,
      });
    }
  }

  return candidates;
}

/**
 * Generate EXACTA BOX 2 bets (all 2-horse combinations)
 */
function generateExactaBox2Bets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];

  for (const combo of generateCombinations(horses.length, 2)) {
    const prob = calculateBoxProb(horses, combo, 2);
    const cost = BASE_UNIT * 2; // 2 permutations
    const payout = estimatePayout('EXACTA_BOX_2', horses, combo, BASE_UNIT);
    const ev = (prob / 100) * payout.likely - cost;

    candidates.push({
      type: 'EXACTA_BOX_2',
      horseIndices: combo,
      cost,
      probability: prob,
      estimatedPayout: payout.likely,
      expectedValue: ev,
      combinationsInvolved: 2,
    });
  }

  return candidates;
}

/**
 * Generate EXACTA BOX 3 bets (all 3-horse combinations for top 2 spots)
 */
function generateExactaBox3Bets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];

  for (const combo of generateCombinations(horses.length, 3)) {
    const prob = calculateBoxProb(horses, combo, 2);
    const cost = BASE_UNIT * 6; // 3×2 = 6 permutations
    const payout = estimatePayout('EXACTA_BOX_3', horses, combo, BASE_UNIT);
    const ev = (prob / 100) * payout.likely - cost;

    candidates.push({
      type: 'EXACTA_BOX_3',
      horseIndices: combo,
      cost,
      probability: prob,
      estimatedPayout: payout.likely,
      expectedValue: ev,
      combinationsInvolved: 6,
    });
  }

  return candidates;
}

/**
 * Generate TRIFECTA STRAIGHT bets (all 3-horse permutations)
 */
function generateTrifectaStraightBets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];

  for (const perm of generatePermutations(horses.length, 3)) {
    const prob = calculateTrifectaProb(horses, perm[0]!, perm[1]!, perm[2]!);
    const payout = estimatePayout('TRIFECTA_STRAIGHT', horses, perm, BASE_UNIT);
    const ev = (prob / 100) * payout.likely - BASE_UNIT;

    candidates.push({
      type: 'TRIFECTA_STRAIGHT',
      horseIndices: perm,
      cost: BASE_UNIT,
      probability: prob,
      estimatedPayout: payout.likely,
      expectedValue: ev,
      combinationsInvolved: 1,
    });
  }

  return candidates;
}

/**
 * Generate TRIFECTA BOX 3 bets (all 3-horse combinations)
 */
function generateTrifectaBox3Bets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];

  for (const combo of generateCombinations(horses.length, 3)) {
    const prob = calculateBoxProb(horses, combo, 3);
    const cost = BASE_UNIT * 6; // 3! = 6 permutations
    const payout = estimatePayout('TRIFECTA_BOX_3', horses, combo, BASE_UNIT);
    const ev = (prob / 100) * payout.likely - cost;

    candidates.push({
      type: 'TRIFECTA_BOX_3',
      horseIndices: combo,
      cost,
      probability: prob,
      estimatedPayout: payout.likely,
      expectedValue: ev,
      combinationsInvolved: 6,
    });
  }

  return candidates;
}

/**
 * Generate TRIFECTA BOX 4 bets (all 4-horse combinations)
 */
function generateTrifectaBox4Bets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];

  for (const combo of generateCombinations(horses.length, 4)) {
    const prob = calculateBoxProb(horses, combo, 3);
    const cost = BASE_UNIT * 24; // P(4,3) = 24 permutations
    const payout = estimatePayout('TRIFECTA_BOX_4', horses, combo, BASE_UNIT);
    const ev = (prob / 100) * payout.likely - cost;

    candidates.push({
      type: 'TRIFECTA_BOX_4',
      horseIndices: combo,
      cost,
      probability: prob,
      estimatedPayout: payout.likely,
      expectedValue: ev,
      combinationsInvolved: 24,
    });
  }

  return candidates;
}

/**
 * Generate TRIFECTA KEY bets (top 5 horses as key)
 */
function generateTrifectaKeyBets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];
  const maxKeyHorses = Math.min(5, horses.length);

  for (let keyIdx = 0; keyIdx < maxKeyHorses; keyIdx++) {
    // Key this horse over the rest
    const withHorses = horses
      .map((_, i) => i)
      .filter((i) => i !== keyIdx)
      .slice(0, 5); // Limit "with" horses

    if (withHorses.length < 2) continue;

    // Calculate probability (key horse wins, any of the "with" horses 2nd/3rd)
    let prob = 0;
    const keyHorse = horses[keyIdx];
    if (!keyHorse) continue;

    for (let i = 0; i < withHorses.length; i++) {
      for (let j = 0; j < withHorses.length; j++) {
        if (i === j) continue;
        const second = withHorses[i];
        const third = withHorses[j];
        if (second !== undefined && third !== undefined) {
          prob += calculateTrifectaProb(horses, keyIdx, second, third);
        }
      }
    }

    const combos = withHorses.length * (withHorses.length - 1);
    const cost = BASE_UNIT * combos;
    const payout = estimatePayout('TRIFECTA_KEY', horses, [keyIdx, ...withHorses], BASE_UNIT);
    const ev = (prob / 100) * payout.likely - cost;

    candidates.push({
      type: 'TRIFECTA_KEY',
      horseIndices: [keyIdx, ...withHorses],
      cost,
      probability: prob,
      estimatedPayout: payout.likely,
      expectedValue: ev,
      combinationsInvolved: combos,
    });
  }

  return candidates;
}

/**
 * Generate SUPERFECTA BOX 4 bets (all 4-horse combinations)
 */
function generateSuperfectaBox4Bets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];

  for (const combo of generateCombinations(horses.length, 4)) {
    const prob = calculateBoxProb(horses, combo, 4);
    const cost = BASE_UNIT * 24; // 4! = 24 permutations
    const payout = estimatePayout('SUPERFECTA_BOX_4', horses, combo, BASE_UNIT);
    const ev = (prob / 100) * payout.likely - cost;

    candidates.push({
      type: 'SUPERFECTA_BOX_4',
      horseIndices: combo,
      cost,
      probability: prob,
      estimatedPayout: payout.likely,
      expectedValue: ev,
      combinationsInvolved: 24,
    });
  }

  return candidates;
}

/**
 * Generate SUPERFECTA BOX 5 bets (all 5-horse combinations)
 */
function generateSuperfectaBox5Bets(horses: HorseProb[]): BetCandidate[] {
  const candidates: BetCandidate[] = [];

  for (const combo of generateCombinations(horses.length, 5)) {
    const prob = calculateBoxProb(horses, combo, 4);
    const cost = BASE_UNIT * 120; // P(5,4) = 120 permutations
    const payout = estimatePayout('SUPERFECTA_BOX_5', horses, combo, BASE_UNIT);
    const ev = (prob / 100) * payout.likely - cost;

    candidates.push({
      type: 'SUPERFECTA_BOX_5',
      horseIndices: combo,
      cost,
      probability: prob,
      estimatedPayout: payout.likely,
      expectedValue: ev,
      combinationsInvolved: 120,
    });
  }

  return candidates;
}

// ============================================================================
// DIVERSITY ENFORCEMENT
// ============================================================================

/**
 * Ensure diversity in top 25 by including best from each tier
 */
function enforceTypeDiversity(
  candidates: BetCandidate[],
  targetCount: number = 25
): BetCandidate[] {
  // Group by risk tier
  const conservative = candidates
    .filter((c) => determineRiskTier(c.probability) === 'Conservative')
    .sort((a, b) => b.expectedValue - a.expectedValue);

  const moderate = candidates
    .filter((c) => determineRiskTier(c.probability) === 'Moderate')
    .sort((a, b) => b.expectedValue - a.expectedValue);

  const aggressive = candidates
    .filter((c) => determineRiskTier(c.probability) === 'Aggressive')
    .sort((a, b) => b.expectedValue - a.expectedValue);

  // Start with top EV overall
  const allSorted = [...candidates].sort((a, b) => b.expectedValue - a.expectedValue);
  const selected = new Set<string>();
  const result: BetCandidate[] = [];

  const makeKey = (c: BetCandidate) => `${c.type}-${c.horseIndices.join(',')}`;

  // Add top 15 by pure EV
  for (const candidate of allSorted) {
    if (result.length >= 15) break;
    const key = makeKey(candidate);
    if (!selected.has(key)) {
      selected.add(key);
      result.push(candidate);
    }
  }

  // Ensure at least 3 conservative
  let conservativeCount = result.filter(
    (c) => determineRiskTier(c.probability) === 'Conservative'
  ).length;

  for (const candidate of conservative) {
    if (conservativeCount >= 3) break;
    const key = makeKey(candidate);
    if (!selected.has(key)) {
      selected.add(key);
      result.push(candidate);
      conservativeCount++;
    }
  }

  // Ensure at least 3 moderate
  let moderateCount = result.filter((c) => determineRiskTier(c.probability) === 'Moderate').length;

  for (const candidate of moderate) {
    if (moderateCount >= 3) break;
    const key = makeKey(candidate);
    if (!selected.has(key)) {
      selected.add(key);
      result.push(candidate);
      moderateCount++;
    }
  }

  // Ensure at least 3 aggressive
  let aggressiveCount = result.filter(
    (c) => determineRiskTier(c.probability) === 'Aggressive'
  ).length;

  for (const candidate of aggressive) {
    if (aggressiveCount >= 3) break;
    const key = makeKey(candidate);
    if (!selected.has(key)) {
      selected.add(key);
      result.push(candidate);
      aggressiveCount++;
    }
  }

  // Fill remaining from sorted list
  for (const candidate of allSorted) {
    if (result.length >= targetCount) break;
    const key = makeKey(candidate);
    if (!selected.has(key)) {
      selected.add(key);
      result.push(candidate);
    }
  }

  // Final sort by EV
  return result.sort((a, b) => b.expectedValue - a.expectedValue).slice(0, targetCount);
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate all bet combinations and return top 25 by expected value
 */
export function generateTopBets(
  scoredHorses: ScoredHorse[],
  raceHeader: RaceHeader,
  raceNumber: number,
  getOdds: (index: number, original: string) => string = (_i, o) => o,
  isScratched: (index: number) => boolean = () => false
): TopBetsResult {
  const startTime = performance.now();

  // Prepare horse probability data
  const horses = prepareHorseProbs(scoredHorses, getOdds, isScratched);

  if (horses.length < 2) {
    return {
      topBets: [],
      totalCombinationsAnalyzed: 0,
      raceContext: {
        trackCode: raceHeader.trackCode || 'UNKNOWN',
        raceNumber,
        fieldSize: horses.length,
        surface: raceHeader.surface || 'dirt',
      },
      generatedAt: Date.now(),
      generationTimeMs: performance.now() - startTime,
    };
  }

  // Generate all bet candidates
  const allCandidates: BetCandidate[] = [];

  // WIN/PLACE/SHOW (always generate)
  allCandidates.push(...generateWinBets(horses));
  allCandidates.push(...generatePlaceBets(horses));
  allCandidates.push(...generateShowBets(horses));

  // QUINELLA and EXACTA (need at least 2 horses)
  if (horses.length >= 2) {
    allCandidates.push(...generateQuinellaBets(horses));
    allCandidates.push(...generateExactaStraightBets(horses));
    allCandidates.push(...generateExactaBox2Bets(horses));
  }

  // EXACTA BOX 3 (need at least 3 horses)
  if (horses.length >= 3) {
    allCandidates.push(...generateExactaBox3Bets(horses));
  }

  // TRIFECTA (need at least 3 horses)
  if (horses.length >= 3) {
    allCandidates.push(...generateTrifectaStraightBets(horses));
    allCandidates.push(...generateTrifectaBox3Bets(horses));
    allCandidates.push(...generateTrifectaKeyBets(horses));
  }

  // TRIFECTA BOX 4 (need at least 4 horses)
  if (horses.length >= 4) {
    allCandidates.push(...generateTrifectaBox4Bets(horses));
  }

  // SUPERFECTA (need at least 4 horses)
  if (horses.length >= 4) {
    allCandidates.push(...generateSuperfectaBox4Bets(horses));
  }

  // SUPERFECTA BOX 5 (need at least 5 horses)
  if (horses.length >= 5) {
    allCandidates.push(...generateSuperfectaBox5Bets(horses));
  }

  const totalCombinations = allCandidates.length;

  // Filter out extremely negative EV bets (keep at least some options)
  const viableCandidates = allCandidates.filter((c) => c.expectedValue >= MIN_EV_THRESHOLD);

  // If we filtered too aggressively, use all candidates
  const candidatesToRank = viableCandidates.length >= 25 ? viableCandidates : allCandidates;

  // Apply diversity enforcement to get top 25
  const top25Candidates = enforceTypeDiversity(candidatesToRank, 25);

  // Convert to TopBet format
  const topBets: TopBet[] = top25Candidates.map((candidate, index) => {
    const payout = estimatePayout(candidate.type, horses, candidate.horseIndices, BASE_UNIT);

    // Determine horse positions for display
    const horsePositions = candidate.horseIndices.map((idx, posIdx): TopBetHorse => {
      const horse = horses[idx];
      if (!horse) return { programNumber: 0, name: 'Unknown' };

      let position: TopBetHorse['position'] = undefined;

      if (candidate.type === 'TRIFECTA_KEY' && posIdx === 0) {
        position = 'Key';
      } else if (candidate.type === 'TRIFECTA_KEY' && posIdx > 0) {
        position = 'With';
      } else if (candidate.type === 'EXACTA_STRAIGHT' && posIdx === 0) {
        position = 'Over';
      } else if (candidate.type === 'EXACTA_STRAIGHT' && posIdx === 1) {
        position = 'Under';
      } else if (candidate.type === 'TRIFECTA_STRAIGHT') {
        position = posIdx === 0 ? 'Over' : posIdx === 2 ? 'Under' : undefined;
      }

      return {
        programNumber: horse.programNumber,
        name: horse.name,
        position,
      };
    });

    const payoutDisplay =
      payout.min === payout.max
        ? formatDollars(payout.likely)
        : `${formatDollars(payout.min)}-${formatDollars(payout.max)}`;

    return {
      rank: index + 1,
      riskTier: determineRiskTier(candidate.probability),
      betType: BET_TYPE_NAMES[candidate.type],
      internalType: candidate.type,
      horses: horsePositions,
      cost: candidate.cost,
      whatToSay: generateWhatToSay(candidate.type, horses, candidate.horseIndices),
      whatThisBetIs: BET_TYPE_EXPLANATIONS[candidate.type],
      whyThisBet: generateWhyThisBet(candidate.type, horses, candidate.horseIndices),
      estimatedPayout: payoutDisplay,
      probability: Math.round(candidate.probability * 100) / 100,
      expectedValue: Math.round(candidate.expectedValue * 100) / 100,
      combinationsInvolved: candidate.combinationsInvolved,
      horseNumbers: candidate.horseIndices.map((i) => horses[i]?.programNumber || 0),
    };
  });

  const generationTimeMs = performance.now() - startTime;

  logger.logInfo('Top bets generated', {
    component: 'topBetsGenerator',
    raceNumber,
    fieldSize: horses.length,
    totalCombinations,
    generationTimeMs: Math.round(generationTimeMs),
  });

  return {
    topBets,
    totalCombinationsAnalyzed: totalCombinations,
    raceContext: {
      trackCode: raceHeader.trackCode || 'UNKNOWN',
      raceNumber,
      fieldSize: horses.length,
      surface: raceHeader.surface || 'dirt',
    },
    generatedAt: Date.now(),
    generationTimeMs,
  };
}

/**
 * Quick count of combinations for a field size (no generation)
 */
export function estimateCombinationCount(fieldSize: number): number {
  if (fieldSize < 2) return 0;

  let count = 0;

  // WIN/PLACE/SHOW
  count += fieldSize * 3;

  // QUINELLA
  count += combinations(fieldSize, 2);

  // EXACTA STRAIGHT
  count += permutations(fieldSize, 2);

  // EXACTA BOX 2
  count += combinations(fieldSize, 2);

  // EXACTA BOX 3
  if (fieldSize >= 3) count += combinations(fieldSize, 3);

  // TRIFECTA STRAIGHT
  if (fieldSize >= 3) count += permutations(fieldSize, 3);

  // TRIFECTA BOX 3
  if (fieldSize >= 3) count += combinations(fieldSize, 3);

  // TRIFECTA BOX 4
  if (fieldSize >= 4) count += combinations(fieldSize, 4);

  // TRIFECTA KEY (top 5 keys)
  if (fieldSize >= 3) count += Math.min(5, fieldSize);

  // SUPERFECTA BOX 4
  if (fieldSize >= 4) count += combinations(fieldSize, 4);

  // SUPERFECTA BOX 5
  if (fieldSize >= 5) count += combinations(fieldSize, 5);

  return count;
}

export default generateTopBets;
