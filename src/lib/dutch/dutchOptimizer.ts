/**
 * Dutch Book Optimizer
 *
 * Finds optimal Dutch book combinations from a race field:
 * - Best 2-horse Dutch (highest edge)
 * - Best 3-horse Dutch
 * - Best 4-horse Dutch
 *
 * Criteria:
 * - Include only horses with positive overlay (fair odds < actual odds)
 * - Prioritize combinations with highest total edge
 * - Balance confidence (don't Dutch two 50/1 shots)
 * - Prefer mixing tiers (Tier 1 + Tier 2 often optimal)
 *
 * @module dutch/dutchOptimizer
 */

import { logger } from '../../services/logging';
import {
  type DutchHorse,
  type DutchResult,
  calculateDutchBook,
  calculateImpliedProbability,
  parseOddsToDecimal,
} from './dutchCalculator';
import { analyzeEdge, type EdgeClassification } from './dutchValidator';

// ============================================================================
// TYPES
// ============================================================================

export type HorseTierForDutch = 1 | 2 | 3;

export interface DutchCandidateHorse extends DutchHorse {
  /** Horse tier (1 = top, 2 = mid, 3 = value) */
  tier: HorseTierForDutch;
  /** Confidence score (0-100) */
  confidence: number;
  /** Total handicapping score */
  score: number;
  /** Our estimated win probability */
  estimatedWinProb: number;
  /** Whether this horse has a positive overlay */
  hasOverlay: boolean;
}

export interface DutchCombination {
  /** Unique ID for this combination */
  id: string;
  /** Horses in this combination */
  horses: DutchCandidateHorse[];
  /** Number of horses */
  horseCount: number;
  /** Edge percentage */
  edgePercent: number;
  /** Edge classification */
  edgeClass: EdgeClassification;
  /** Sum of implied probabilities */
  sumOfImpliedProbs: number;
  /** Is this profitable? */
  isProfitable: boolean;
  /** Description of the combination */
  description: string;
  /** Tier mix description */
  tierMix: string;
  /** Average confidence of horses */
  avgConfidence: number;
  /** Average odds */
  avgOdds: number;
  /** Recommendation strength (0-100) */
  recommendationStrength: number;
  /** Full Dutch result for a given stake */
  dutchResult?: DutchResult;
}

export interface OptimizationResult {
  /** All valid Dutch combinations found */
  combinations: DutchCombination[];
  /** Best 2-horse Dutch */
  best2Horse: DutchCombination | null;
  /** Best 3-horse Dutch */
  best3Horse: DutchCombination | null;
  /** Best 4-horse Dutch */
  best4Horse: DutchCombination | null;
  /** Overall best Dutch */
  overallBest: DutchCombination | null;
  /** Total combinations analyzed */
  totalCombinationsAnalyzed: number;
  /** Number of profitable combinations */
  profitableCombinations: number;
  /** Optimization metadata */
  meta: {
    raceHorseCount: number;
    eligibleHorseCount: number;
    optimizationTime: number;
  };
}

export interface OptimizationConfig {
  /** Candidate horses for Dutch */
  horses: DutchCandidateHorse[];
  /** Minimum edge required (default 5%) */
  minEdgeRequired?: number;
  /** Maximum horses in a Dutch (default 5) */
  maxHorses?: number;
  /** Only include horses with overlays */
  overlayOnly?: boolean;
  /** Prefer tier mixing */
  preferMixedTiers?: boolean;
  /** Total stake for calculating Dutch results */
  stake?: number;
  /** Maximum combinations to evaluate */
  maxCombinations?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum combinations to evaluate to prevent performance issues */
const MAX_COMBINATIONS_DEFAULT = 500;

/** Weights for recommendation score calculation */
const RECOMMENDATION_WEIGHTS = {
  edge: 0.4,
  confidence: 0.25,
  tierMix: 0.2,
  horseCount: 0.15,
};

/** Ideal horse count bonus */
const IDEAL_HORSE_COUNTS = {
  2: 0.8, // 2 horses - concentrated but risky
  3: 1.0, // 3 horses - ideal balance
  4: 0.9, // 4 horses - good coverage
  5: 0.7, // 5 horses - spread thin
};

// ============================================================================
// OPTIMIZATION FUNCTIONS
// ============================================================================

/**
 * Find optimal Dutch book combinations
 *
 * @param config - Optimization configuration
 * @returns Optimization result with ranked combinations
 */
export function findOptimalDutchCombinations(config: OptimizationConfig): OptimizationResult {
  const startTime = performance.now();

  const {
    horses,
    minEdgeRequired = 5,
    maxHorses = 5,
    overlayOnly = false,
    preferMixedTiers = true,
    stake = 100,
    maxCombinations = MAX_COMBINATIONS_DEFAULT,
  } = config;

  // Filter eligible horses
  const eligibleHorses = horses.filter((horse) => {
    // Basic validation
    if (horse.decimalOdds <= 1) return false;

    // If overlay only, require positive overlay
    if (overlayOnly && !horse.hasOverlay) return false;

    return true;
  });

  logger.logInfo('Starting Dutch optimization', {
    component: 'dutchOptimizer',
    totalHorses: horses.length,
    eligibleHorses: eligibleHorses.length,
    minEdgeRequired,
    maxHorses,
  });

  if (eligibleHorses.length < 2) {
    return createEmptyResult(horses.length, eligibleHorses.length, performance.now() - startTime);
  }

  // Generate all combinations
  const allCombinations: DutchCombination[] = [];
  let totalAnalyzed = 0;

  // Generate combinations for each size (2, 3, 4, ... maxHorses)
  for (let size = 2; size <= Math.min(maxHorses, eligibleHorses.length); size++) {
    const combinations = generateCombinations(eligibleHorses, size);

    for (const combo of combinations) {
      if (totalAnalyzed >= maxCombinations) break;

      const analysis = analyzeCombination(combo, stake, preferMixedTiers);
      totalAnalyzed++;

      if (analysis.isProfitable && analysis.edgePercent >= minEdgeRequired) {
        allCombinations.push(analysis);
      }
    }

    if (totalAnalyzed >= maxCombinations) break;
  }

  // Sort by recommendation strength
  allCombinations.sort((a, b) => b.recommendationStrength - a.recommendationStrength);

  // Find best for each size
  const best2Horse = allCombinations.find((c) => c.horseCount === 2) || null;
  const best3Horse = allCombinations.find((c) => c.horseCount === 3) || null;
  const best4Horse = allCombinations.find((c) => c.horseCount === 4) || null;
  const overallBest = allCombinations[0] || null;

  const endTime = performance.now();

  logger.logInfo('Dutch optimization complete', {
    component: 'dutchOptimizer',
    totalAnalyzed,
    profitableCombinations: allCombinations.length,
    bestEdge: overallBest?.edgePercent || 0,
    optimizationTime: Math.round(endTime - startTime),
  });

  return {
    combinations: allCombinations.slice(0, 20), // Top 20 combinations
    best2Horse,
    best3Horse,
    best4Horse,
    overallBest,
    totalCombinationsAnalyzed: totalAnalyzed,
    profitableCombinations: allCombinations.length,
    meta: {
      raceHorseCount: horses.length,
      eligibleHorseCount: eligibleHorses.length,
      optimizationTime: Math.round(endTime - startTime),
    },
  };
}

/**
 * Analyze a specific combination of horses
 */
function analyzeCombination(
  horses: DutchCandidateHorse[],
  stake: number,
  preferMixedTiers: boolean
): DutchCombination {
  // Calculate sum of implied probabilities
  const sumOfImpliedProbs = horses.reduce(
    (sum, horse) => sum + calculateImpliedProbability(horse.decimalOdds),
    0
  );

  const edgePercent = (1 - sumOfImpliedProbs) * 100;
  const isProfitable = edgePercent > 0;
  const edgeAnalysis = analyzeEdge(edgePercent);

  // Calculate tier mix
  const tierCounts = { 1: 0, 2: 0, 3: 0 };
  for (const horse of horses) {
    tierCounts[horse.tier]++;
  }

  const tierMix = getTierMixDescription(tierCounts);
  const tierMixScore = calculateTierMixScore(tierCounts, preferMixedTiers);

  // Calculate averages
  const avgConfidence = horses.reduce((sum, h) => sum + h.confidence, 0) / horses.length;
  const avgOdds = horses.reduce((sum, h) => sum + h.decimalOdds, 0) / horses.length;

  // Calculate recommendation strength
  const recommendationStrength = calculateRecommendationStrength(
    edgePercent,
    avgConfidence,
    tierMixScore,
    horses.length
  );

  // Generate ID and description
  const id = horses
    .map((h) => h.programNumber)
    .sort()
    .join('-');
  const description = generateCombinationDescription(horses);

  // Calculate full Dutch result
  const dutchResult = isProfitable
    ? calculateDutchBook({
        totalStake: stake,
        horses: horses.map((h) => ({
          programNumber: h.programNumber,
          horseName: h.horseName,
          decimalOdds: h.decimalOdds,
          oddsDisplay: h.oddsDisplay,
        })),
      })
    : undefined;

  return {
    id,
    horses,
    horseCount: horses.length,
    edgePercent: Math.round(edgePercent * 100) / 100,
    edgeClass: edgeAnalysis.edgeClass,
    sumOfImpliedProbs: Math.round(sumOfImpliedProbs * 10000) / 10000,
    isProfitable,
    description,
    tierMix,
    avgConfidence: Math.round(avgConfidence),
    avgOdds: Math.round(avgOdds * 10) / 10,
    recommendationStrength: Math.round(recommendationStrength),
    dutchResult,
  };
}

// ============================================================================
// QUICK ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Quick check for best Dutch opportunity in a race
 * Returns only the best combination without full analysis
 */
export function findQuickBestDutch(
  horses: DutchCandidateHorse[],
  stake: number = 100
): DutchCombination | null {
  const result = findOptimalDutchCombinations({
    horses,
    stake,
    maxCombinations: 100,
  });

  return result.overallBest;
}

/**
 * Check if any profitable Dutch exists for a set of horses
 */
export function hasProfitableDutch(horses: DutchCandidateHorse[]): boolean {
  if (horses.length < 2) return false;

  // Check 2-horse combinations first (most likely to be profitable)
  const combinations = generateCombinations(horses, 2);

  for (const combo of combinations) {
    const sumOfImpliedProbs = combo.reduce(
      (sum, horse) => sum + calculateImpliedProbability(horse.decimalOdds),
      0
    );
    if (sumOfImpliedProbs < 1) return true;
  }

  return false;
}

/**
 * Get top N Dutch opportunities from a race
 */
export function getTopDutchOpportunities(
  horses: DutchCandidateHorse[],
  count: number = 3,
  stake: number = 100
): DutchCombination[] {
  const result = findOptimalDutchCombinations({
    horses,
    stake,
    maxCombinations: 200,
  });

  return result.combinations.slice(0, count);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate all combinations of size n from array
 */
function generateCombinations<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];

  function combine(start: number, combo: T[]) {
    if (combo.length === size) {
      result.push([...combo]);
      return;
    }

    for (let i = start; i <= array.length - (size - combo.length); i++) {
      const element = array[i];
      if (element !== undefined) {
        combo.push(element);
        combine(i + 1, combo);
        combo.pop();
      }
    }
  }

  combine(0, []);
  return result;
}

/**
 * Get tier mix description
 */
function getTierMixDescription(tierCounts: Record<number, number>): string {
  const parts: string[] = [];

  const tier1 = tierCounts[1] ?? 0;
  const tier2 = tierCounts[2] ?? 0;
  const tier3 = tierCounts[3] ?? 0;

  if (tier1 > 0) parts.push(`${tier1} Tier 1`);
  if (tier2 > 0) parts.push(`${tier2} Tier 2`);
  if (tier3 > 0) parts.push(`${tier3} Tier 3`);

  return parts.join(' + ');
}

/**
 * Calculate tier mix score (0-100)
 * Mixed tiers score higher than all same tier
 */
function calculateTierMixScore(tierCounts: Record<number, number>, preferMixed: boolean): number {
  const tier1 = tierCounts[1] ?? 0;
  const tier2 = tierCounts[2] ?? 0;
  const tier3 = tierCounts[3] ?? 0;

  const totalHorses = tier1 + tier2 + tier3;
  const tiersUsed = (tier1 > 0 ? 1 : 0) + (tier2 > 0 ? 1 : 0) + (tier3 > 0 ? 1 : 0);

  if (!preferMixed) return 50; // Neutral

  // Prefer Tier 1 + Tier 2 combinations
  if (tier1 >= 1 && tier2 >= 1) {
    if (tier3 === 0) return 100; // Best: T1 + T2 only
    return 90; // Good: T1 + T2 + T3
  }

  // Tier 1 + Tier 3 is interesting (chalk + longshot)
  if (tier1 >= 1 && tier3 >= 1 && tier2 === 0) {
    return 85;
  }

  // All same tier is less ideal
  if (tiersUsed === 1) {
    if (tier1 === totalHorses) return 70; // All T1 - chalk-heavy
    if (tier2 === totalHorses) return 60; // All T2
    if (tier3 === totalHorses) return 40; // All T3 - risky
  }

  return 70; // Default
}

/**
 * Calculate recommendation strength (0-100)
 */
function calculateRecommendationStrength(
  edgePercent: number,
  avgConfidence: number,
  tierMixScore: number,
  horseCount: number
): number {
  // Edge score (0-100)
  const edgeScore = Math.min(100, Math.max(0, edgePercent * 5)); // 20% edge = 100

  // Confidence score (already 0-100)
  const confidenceScore = avgConfidence;

  // Horse count score
  const horseCountScore =
    (IDEAL_HORSE_COUNTS[horseCount as keyof typeof IDEAL_HORSE_COUNTS] ?? 0.5) * 100;

  // Weighted average
  const score =
    edgeScore * RECOMMENDATION_WEIGHTS.edge +
    confidenceScore * RECOMMENDATION_WEIGHTS.confidence +
    tierMixScore * RECOMMENDATION_WEIGHTS.tierMix +
    horseCountScore * RECOMMENDATION_WEIGHTS.horseCount;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Generate human-readable combination description
 */
function generateCombinationDescription(horses: DutchCandidateHorse[]): string {
  const sorted = [...horses].sort((a, b) => a.decimalOdds - b.decimalOdds);
  const names = sorted.map((h) => `#${h.programNumber} ${h.horseName}`).slice(0, 3);

  if (horses.length > 3) {
    return `${names.join(', ')} +${horses.length - 3} more`;
  }

  return names.join(', ');
}

/**
 * Create empty result when no combinations possible
 */
function createEmptyResult(
  totalHorses: number,
  eligibleHorses: number,
  time: number
): OptimizationResult {
  return {
    combinations: [],
    best2Horse: null,
    best3Horse: null,
    best4Horse: null,
    overallBest: null,
    totalCombinationsAnalyzed: 0,
    profitableCombinations: 0,
    meta: {
      raceHorseCount: totalHorses,
      eligibleHorseCount: eligibleHorses,
      optimizationTime: Math.round(time),
    },
  };
}

// ============================================================================
// RACE CONVERSION UTILITIES
// ============================================================================

/**
 * Convert scored horses from race analysis to Dutch candidates
 */
export function convertToDutchCandidates(
  horses: Array<{
    programNumber: number;
    horseName: string;
    morningLineOdds: string;
    score: number;
    confidence: number;
    tier: 1 | 2 | 3;
    estimatedWinProb?: number;
    overlayPercent?: number;
  }>
): DutchCandidateHorse[] {
  return horses.map((horse) => {
    const decimalOdds = parseOddsToDecimal(horse.morningLineOdds);
    const impliedProb = calculateImpliedProbability(decimalOdds);
    const estimatedWinProb = horse.estimatedWinProb ?? impliedProb;

    return {
      programNumber: horse.programNumber,
      horseName: horse.horseName,
      decimalOdds,
      oddsDisplay: horse.morningLineOdds,
      impliedProbability: impliedProb,
      tier: horse.tier,
      confidence: horse.confidence,
      score: horse.score,
      estimatedWinProb,
      hasOverlay: (horse.overlayPercent ?? 0) > 0,
      overlayPercent: horse.overlayPercent,
    };
  });
}

/**
 * Filter horses suitable for Dutch booking
 */
export function filterDutchCandidates(
  horses: DutchCandidateHorse[],
  options: {
    minConfidence?: number;
    maxOdds?: number;
    minOverlay?: number;
    excludeTier3?: boolean;
  } = {}
): DutchCandidateHorse[] {
  const {
    minConfidence = 0,
    maxOdds = 50,
    minOverlay = -100, // Allow all by default
    excludeTier3 = false,
  } = options;

  return horses.filter((horse) => {
    if (horse.confidence < minConfidence) return false;
    if (horse.decimalOdds > maxOdds) return false;
    if ((horse.overlayPercent ?? 0) < minOverlay) return false;
    if (excludeTier3 && horse.tier === 3) return false;
    return true;
  });
}
