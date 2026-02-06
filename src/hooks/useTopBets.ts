/**
 * useTopBets Hook
 *
 * Provides reactive Top 25 bet recommendations for a race.
 * Recalculates automatically when:
 * - Scored horses change (scores, rankings)
 * - Odds change (live odds updates)
 * - Horses are scratched
 * - Track condition changes
 *
 * This is the core hook powering the "upload DRF → see best bets" workflow.
 *
 * @module hooks/useTopBets
 */

import { useMemo } from 'react';
import { logger } from '../services/logging';
import type { ScoredHorse } from '../lib/scoring';
import type { RaceHeader } from '../types/drf';
import {
  generateTopBets,
  estimateCombinationCount,
  type TopBet,
  type TopBetsResult,
  type RiskTier,
} from '../lib/betting/topBetsGenerator';

// ============================================================================
// TYPES
// ============================================================================

export interface UseTopBetsInput {
  /** Array of scored horses from race analysis */
  scoredHorses: ScoredHorse[] | null | undefined;
  /** Race header information */
  raceHeader: RaceHeader | null | undefined;
  /** Race number for display */
  raceNumber: number;
  /** Function to get current odds for a horse (defaults to morning line) */
  getOdds?: (index: number, originalOdds: string) => string;
  /** Function to check if a horse is scratched */
  isScratched?: (index: number) => boolean;
}

export interface UseTopBetsResult {
  /** Top 25 bets sorted by expected value */
  topBets: TopBet[];
  /** Whether the result is still loading/calculating */
  isLoading: boolean;
  /** Whether any bets are available */
  hasBets: boolean;
  /** Total number of combinations analyzed */
  totalCombinationsAnalyzed: number;
  /** Estimated combinations (before generation) */
  estimatedCombinations: number;
  /** Race context information */
  raceContext: {
    trackCode: string;
    raceNumber: number;
    fieldSize: number;
    surface: string;
  };
  /** Generation performance metrics */
  performance: {
    generationTimeMs: number;
    generatedAt: number;
  };
  /** Summary statistics */
  summary: {
    conservativeCount: number;
    moderateCount: number;
    aggressiveCount: number;
    avgExpectedValue: number;
    bestBetEV: number;
    totalCost: number;
  };
  /** Error message if generation failed */
  error: string | null;
  /** Filtered views of top bets */
  byRiskTier: {
    conservative: TopBet[];
    moderate: TopBet[];
    aggressive: TopBet[];
  };
  /** Filtered views by bet type */
  byBetType: {
    winPlaceShow: TopBet[];
    exacta: TopBet[];
    trifecta: TopBet[];
    superfecta: TopBet[];
  };
  /** Helper to get bets for specific horses */
  getBetsForHorse: (programNumber: number) => TopBet[];
  /** Helper to get best bet for a risk tier */
  getBestByTier: (tier: RiskTier) => TopBet | null;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook to generate and manage Top 25 bet recommendations
 *
 * This hook is fully reactive - it recalculates automatically when any
 * of its inputs change (odds, scratches, scores, track condition).
 *
 * @example
 * ```tsx
 * const {
 *   topBets,
 *   hasBets,
 *   totalCombinationsAnalyzed,
 *   summary,
 *   performance
 * } = useTopBets({
 *   scoredHorses,
 *   raceHeader,
 *   raceNumber,
 *   getOdds,
 *   isScratched,
 *   trackCondition
 * });
 *
 * // Display bets
 * {topBets.map(bet => (
 *   <BetCard key={bet.rank} bet={bet} />
 * ))}
 *
 * // Show performance info
 * <p>Analyzed {totalCombinationsAnalyzed} combinations in {performance.generationTimeMs}ms</p>
 * ```
 */
export function useTopBets(input: UseTopBetsInput): UseTopBetsResult {
  const {
    scoredHorses,
    raceHeader,
    raceNumber,
    getOdds = (_, original) => original,
    isScratched = () => false,
  } = input;

  // Memoize the result - recalculates when dependencies change
  const result = useMemo<UseTopBetsResult>(() => {
    // Empty/default result for missing inputs
    const emptyResult: UseTopBetsResult = {
      topBets: [],
      isLoading: false,
      hasBets: false,
      totalCombinationsAnalyzed: 0,
      estimatedCombinations: 0,
      raceContext: {
        trackCode: 'UNKNOWN',
        raceNumber: raceNumber || 0,
        fieldSize: 0,
        surface: 'dirt',
      },
      performance: {
        generationTimeMs: 0,
        generatedAt: Date.now(),
      },
      summary: {
        conservativeCount: 0,
        moderateCount: 0,
        aggressiveCount: 0,
        avgExpectedValue: 0,
        bestBetEV: 0,
        totalCost: 0,
      },
      error: null,
      byRiskTier: {
        conservative: [],
        moderate: [],
        aggressive: [],
      },
      byBetType: {
        winPlaceShow: [],
        exacta: [],
        trifecta: [],
        superfecta: [],
      },
      getBetsForHorse: () => [],
      getBestByTier: () => null,
    };

    // Validate inputs
    if (!scoredHorses || scoredHorses.length === 0) {
      return {
        ...emptyResult,
        error: 'No scored horses provided',
      };
    }

    if (!raceHeader) {
      return {
        ...emptyResult,
        error: 'No race header provided',
      };
    }

    // Filter to active horses
    const activeHorses = scoredHorses.filter((h) => !isScratched(h.index) && !h.score.isScratched);

    if (activeHorses.length < 2) {
      return {
        ...emptyResult,
        error: 'Not enough active horses (minimum 2 required)',
        raceContext: {
          trackCode: raceHeader.trackCode || 'UNKNOWN',
          raceNumber,
          fieldSize: activeHorses.length,
          surface: raceHeader.surface || 'dirt',
        },
      };
    }

    // Estimate combination count before generation
    const estimatedCombinations = estimateCombinationCount(activeHorses.length);

    // Generate top bets
    let topBetsResult: TopBetsResult;
    try {
      topBetsResult = generateTopBets(scoredHorses, raceHeader, raceNumber, getOdds, isScratched);
    } catch (error) {
      logger.logError(error instanceof Error ? error : new Error(String(error)), {
        component: 'useTopBets',
      });
      return {
        ...emptyResult,
        error: `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        raceContext: {
          trackCode: raceHeader.trackCode || 'UNKNOWN',
          raceNumber,
          fieldSize: activeHorses.length,
          surface: raceHeader.surface || 'dirt',
        },
        estimatedCombinations,
      };
    }

    const { topBets, totalCombinationsAnalyzed, raceContext, generatedAt, generationTimeMs } =
      topBetsResult;

    // Calculate summary statistics
    const conservativeBets = topBets.filter((b) => b.riskTier === 'Conservative');
    const moderateBets = topBets.filter((b) => b.riskTier === 'Moderate');
    const aggressiveBets = topBets.filter((b) => b.riskTier === 'Aggressive');

    const avgEV =
      topBets.length > 0
        ? topBets.reduce((sum, b) => sum + b.expectedValue, 0) / topBets.length
        : 0;

    const bestBetEV = topBets.length > 0 ? topBets[0]?.expectedValue || 0 : 0;

    const totalCost = topBets.reduce((sum, b) => sum + b.cost, 0);

    // Group by bet type
    const winPlaceShowBets = topBets.filter((b) =>
      ['WIN', 'PLACE', 'SHOW'].includes(b.internalType)
    );
    const exactaBets = topBets.filter((b) => b.internalType.startsWith('EXACTA'));
    const trifectaBets = topBets.filter((b) => b.internalType.startsWith('TRIFECTA'));
    const superfectaBets = topBets.filter((b) => b.internalType.startsWith('SUPERFECTA'));

    // Helper functions
    const getBetsForHorse = (programNumber: number): TopBet[] => {
      return topBets.filter((bet) => bet.horseNumbers.includes(programNumber));
    };

    const getBestByTier = (tier: RiskTier): TopBet | null => {
      const tierBets = topBets.filter((b) => b.riskTier === tier);
      return tierBets.length > 0 ? tierBets[0] || null : null;
    };

    return {
      topBets,
      isLoading: false,
      hasBets: topBets.length > 0,
      totalCombinationsAnalyzed,
      estimatedCombinations,
      raceContext,
      performance: {
        generationTimeMs,
        generatedAt,
      },
      summary: {
        conservativeCount: conservativeBets.length,
        moderateCount: moderateBets.length,
        aggressiveCount: aggressiveBets.length,
        avgExpectedValue: Math.round(avgEV * 100) / 100,
        bestBetEV: Math.round(bestBetEV * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
      },
      error: null,
      byRiskTier: {
        conservative: conservativeBets,
        moderate: moderateBets,
        aggressive: aggressiveBets,
      },
      byBetType: {
        winPlaceShow: winPlaceShowBets,
        exacta: exactaBets,
        trifecta: trifectaBets,
        superfecta: superfectaBets,
      },
      getBetsForHorse,
      getBestByTier,
    };
  }, [scoredHorses, raceHeader, raceNumber, getOdds, isScratched]);

  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { TopBet, TopBetsResult, RiskTier } from '../lib/betting/topBetsGenerator';

export default useTopBets;
