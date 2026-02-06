/**
 * useRaceBets Hook
 *
 * Integrates the bet recommendation engine with the UI.
 * Takes scored horses and race information, returns formatted
 * bet suggestions organized by risk tier (Conservative/Moderate/Aggressive).
 *
 * @module hooks/useRaceBets
 */

import { useMemo } from 'react';
import { logger } from '../services/logging';
import { useBankroll } from './useBankroll';
import { generateRecommendations } from '../lib/recommendations';
import type { BetGeneratorResult, GeneratedBet } from '../lib/recommendations';
import type { ScoredHorse } from '../lib/scoring';
import type { RaceHeader } from '../types/drf';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A formatted bet suggestion for display in the UI
 */
export interface FormattedBetSuggestion {
  /** Bet type label (e.g., "Win", "Exacta Box") */
  type: string;
  /** Formatted horse names string */
  horsesDisplay: string;
  /** Program numbers of horses involved */
  programNumbers: number[];
  /** Confidence level (0-100) */
  confidence: number;
  /** Original bet type from generator */
  originalType: string;
  /** Detailed explanation lines */
  explanation: string[];
}

/**
 * A tier of bet suggestions for the UI
 */
export interface BetTier {
  /** Tier label */
  label: string;
  /** Description of this tier */
  description: string;
  /** Formatted bet suggestions (max 2 per tier) */
  bets: FormattedBetSuggestion[];
  /** Whether any bets are available for this tier */
  hasBets: boolean;
  /** Empty state message if no bets */
  emptyMessage: string;
  /** Context stats for this tier (e.g., "0 Tier 1, 0 Tier 2 horses") */
  contextStats?: string;
}

/**
 * Race context summary for the Suggested Bets section
 */
export interface RaceContextSummary {
  /** Main summary message */
  message: string;
  /** Severity level for styling */
  severity: 'good' | 'limited' | 'none' | 'pass' | 'caution';
  /** Number of value plays identified */
  valuePlaysCount: number;
  /** Additional context details */
  details?: string;
}

/**
 * Return type of the useRaceBets hook
 */
export interface UseRaceBetsResult {
  /** Conservative tier (Win/Place bets) */
  conservative: BetTier;
  /** Moderate tier (Exacta/Trifecta Key/Quinella) */
  moderate: BetTier;
  /** Aggressive tier (Trifecta Box/Superfecta/Wheel) */
  aggressive: BetTier;
  /** Whether recommendations are being calculated */
  isLoading: boolean;
  /** Whether any recommendations exist */
  hasRecommendations: boolean;
  /** Raw generator result for advanced use cases */
  rawResult: BetGeneratorResult | null;
  /** Summary message about the race */
  summary: string;
  /** Race context summary for the Suggested Bets header */
  raceContext: RaceContextSummary;
  /** Whether this race should be passed (no value at all) */
  isPassRace: boolean;
  /** Field size context */
  fieldSize: number;
  /** Scratch count in this race */
  scratchCount: number;
}

// ============================================================================
// BET TYPE MAPPING
// ============================================================================

/**
 * Maps bet types to UI tiers based on risk level.
 * Conservative = low-risk straight bets
 * Moderate = exotic combinations with reasonable hit rates
 * Aggressive = high-variance exotic bets
 */
const BET_TYPE_TO_TIER: Record<string, 'conservative' | 'moderate' | 'aggressive'> = {
  // Conservative bets (straight bets)
  win: 'conservative',
  place: 'conservative',
  show: 'conservative',

  // Moderate bets (exactas, keys, quinellas)
  exacta_box: 'moderate',
  exacta_key_over: 'moderate',
  exacta_key_under: 'moderate',
  trifecta_key: 'moderate',
  quinella: 'moderate',

  // Aggressive bets (trifecta box, superfecta, wheels)
  trifecta_box: 'aggressive',
  superfecta: 'aggressive',
  trifecta_wheel: 'aggressive',
  value_bomb: 'aggressive',
  hidden_gem: 'moderate', // Diamonds are moderate risk
};

/**
 * Display names for bet types in the UI
 */
const BET_TYPE_DISPLAY: Record<string, string> = {
  win: 'Win',
  place: 'Place',
  show: 'Show',
  exacta_box: 'Exacta Box',
  exacta_key_over: 'Exacta Key',
  exacta_key_under: 'Exacta Key',
  trifecta_key: 'Trifecta Key',
  trifecta_box: 'Trifecta Box',
  quinella: 'Quinella',
  superfecta: 'Superfecta',
  trifecta_wheel: 'Trifecta Wheel',
  value_bomb: 'Value Bomb',
  hidden_gem: 'Hidden Gem',
};

// ============================================================================
// EMPTY STATE MESSAGE GENERATION
// ============================================================================

/**
 * Generate informative empty state message for Conservative tier
 * Conservative = Win/Place bets on overlays
 */
function generateConservativeEmptyMessage(
  overlayCount: number,
  tier1Count: number,
  tier2Count: number
): { message: string; contextStats: string } {
  const contextStats = `${tier1Count} Tier 1, ${tier2Count} Tier 2 horses`;

  if (overlayCount === 0) {
    return {
      message: 'No win/place value identified — all horses are fairly priced or underlays.',
      contextStats,
    };
  }

  // If there ARE overlays but no conservative bets, it means overlays are only on longshots
  return {
    message: 'Win/place value only at longer odds — see Aggressive tier for value plays.',
    contextStats,
  };
}

/**
 * Generate informative empty state message for Moderate tier
 * Moderate = Exacta/Trifecta Key/Quinella (requires multiple value horses)
 */
function generateModerateEmptyMessage(
  tier1Count: number,
  tier2Count: number,
  overlayCount: number,
  fieldSize: number
): { message: string; contextStats: string } {
  const contextStats = `${tier1Count} Tier 1, ${tier2Count} Tier 2 horses`;
  const highConfidenceCount = tier1Count + tier2Count;

  // Small field check
  if (fieldSize <= 4) {
    return {
      message: 'Small field limits exotic options — consider win/place only.',
      contextStats: `${fieldSize}-horse field`,
    };
  }

  // Only one value play
  if (overlayCount === 1) {
    return {
      message: 'Only one value play in this race — exotic bets require multiple horses.',
      contextStats,
    };
  }

  // Not enough high-confidence horses
  if (highConfidenceCount < 2) {
    return {
      message:
        'No exotic combinations recommended — not enough high-confidence value plays to justify multi-horse bet costs.',
      contextStats,
    };
  }

  // Generic fallback
  return {
    message: 'No exacta/trifecta key combinations identified for this field.',
    contextStats,
  };
}

/**
 * Generate informative empty state message for Aggressive tier
 * Aggressive = Trifecta Box/Superfecta/Value bombs (longshot plays)
 */
function generateAggressiveEmptyMessage(
  tier3Count: number,
  nuclearCount: number,
  diamondCount: number
): { message: string; contextStats: string } {
  const contextStats = `${tier3Count} Tier 3, ${nuclearCount} nuclear, ${diamondCount} diamonds`;

  if (tier3Count === 0 && nuclearCount === 0 && diamondCount === 0) {
    return {
      message: 'No high-risk plays identified — no longshots showing significant overlay.',
      contextStats: 'No value bombs detected',
    };
  }

  // Generic fallback
  return {
    message: 'No aggressive exotic combinations identified.',
    contextStats,
  };
}

/**
 * Generate race context summary for the Suggested Bets header
 */
function generateRaceContextSummary(
  overlayCount: number,
  positiveEVCount: number,
  tier1Count: number,
  tier2Count: number,
  tier3Count: number,
  scratchCount: number,
  fieldSize: number,
  hasAnyBets: boolean
): RaceContextSummary {
  const valuePlaysCount = overlayCount;
  const highConfidenceCount = tier1Count + tier2Count;

  // PASS RACE: No value at all
  if (overlayCount === 0 && positiveEVCount === 0 && !hasAnyBets) {
    return {
      message: 'PASS THIS RACE — No betting value identified. All horses are underlays.',
      severity: 'pass',
      valuePlaysCount: 0,
      details: 'Consider sitting this one out',
    };
  }

  // Small field warning
  if (fieldSize <= 4) {
    return {
      message: `Small ${fieldSize}-horse field limits betting options`,
      severity: 'caution',
      valuePlaysCount,
      details: 'Exotic pools may be thin',
    };
  }

  // Scratches reduced field significantly
  if (scratchCount >= 3) {
    return {
      message: `Field reduced by ${scratchCount} scratches — reassess before betting`,
      severity: 'caution',
      valuePlaysCount,
      details: 'Odds and value may have shifted',
    };
  }

  // Good value exists
  if (highConfidenceCount >= 2 && overlayCount >= 2) {
    return {
      message: `${valuePlaysCount} value play${valuePlaysCount !== 1 ? 's' : ''} identified in this race`,
      severity: 'good',
      valuePlaysCount,
      details: `${highConfidenceCount} high-confidence contenders`,
    };
  }

  // Limited value
  if (overlayCount >= 1) {
    const oddsContext =
      tier3Count > 0 && tier1Count === 0 && tier2Count === 0 ? 'at longer odds' : '';
    return {
      message:
        `Limited value in this race — ${overlayCount} overlay${overlayCount !== 1 ? 's' : ''} ${oddsContext}`.trim(),
      severity: 'limited',
      valuePlaysCount,
      details: highConfidenceCount === 0 ? 'No high-confidence plays' : undefined,
    };
  }

  // No clear value
  return {
    message: 'No clear value plays — consider passing this race',
    severity: 'none',
    valuePlaysCount: 0,
  };
}

// ============================================================================
// HORSE NAME FORMATTING
// ============================================================================

/**
 * Format a single horse for display with optional program number
 */
function formatHorseName(
  horse: { horse: { horseName: string; programNumber: number } },
  includeNumber: boolean = true
): string {
  const name = horse.horse.horseName || 'Unknown';
  if (includeNumber) {
    return `${name} (#${horse.horse.programNumber})`;
  }
  return name;
}

/**
 * Format horse names for a bet based on bet type
 * - Single horse bets: "HORSE NAME (#4)"
 * - Box bets: "HORSE A, HORSE B, HORSE C"
 * - Key bets: "HORSE A over HORSE B, HORSE C"
 */
function formatHorsesForBet(bet: GeneratedBet): string {
  const horses = bet.horses;
  if (!horses || horses.length === 0) {
    return 'No horses';
  }

  const betType = bet.type;

  // Single horse bets
  if (horses.length === 1) {
    const firstHorse = horses[0];
    if (!firstHorse) return 'No horses';
    return formatHorseName(firstHorse, true);
  }

  // Key bets - first horse "over" the rest
  if (betType === 'exacta_key_over' || betType === 'trifecta_key' || betType === 'trifecta_wheel') {
    const keyHorse = horses[0];
    if (!keyHorse) return 'No horses';
    const withHorses = horses.slice(1).filter((h): h is NonNullable<typeof h> => h != null);
    const keyName = formatHorseName(keyHorse, true);
    const withNames = withHorses.map((h) => formatHorseName(h, false)).join(', ');
    return `${keyName} over ${withNames}`;
  }

  // Exacta key under - others over first horse
  if (betType === 'exacta_key_under') {
    const underHorse = horses[0];
    if (!underHorse) return 'No horses';
    const overHorses = horses.slice(1).filter((h): h is NonNullable<typeof h> => h != null);
    const underName = formatHorseName(underHorse, true);
    const overNames = overHorses.map((h) => formatHorseName(h, false)).join(', ');
    return `${overNames} over ${underName}`;
  }

  // Superfecta - special format with "/" for top positions
  if (betType === 'superfecta' && horses.length >= 4) {
    const validHorses = horses.filter((h): h is NonNullable<typeof h> => h != null);
    const top2 = validHorses
      .slice(0, 2)
      .map((h) => formatHorseName(h, false))
      .join('/');
    const bottom = validHorses
      .slice(2)
      .map((h) => formatHorseName(h, false))
      .join(', ');
    return `${top2} over ${bottom}`;
  }

  // Box bets - comma separated list
  const validHorses = horses.filter((h): h is NonNullable<typeof h> => h != null);
  return validHorses.map((h) => formatHorseName(h, false)).join(', ');
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Hook to generate and format bet recommendations for the UI.
 *
 * @param scoredHorses - Array of scored horses from the race
 * @param raceHeader - Race header information
 * @param raceNumber - Race number for display
 * @returns Formatted bet suggestions organized by risk tier
 *
 * @example
 * ```tsx
 * const { conservative, moderate, aggressive, hasRecommendations } = useRaceBets(
 *   scoredHorses,
 *   raceHeader,
 *   raceNumber
 * );
 *
 * if (hasRecommendations) {
 *   // Display conservative.bets, moderate.bets, aggressive.bets
 * }
 * ```
 */
export function useRaceBets(
  scoredHorses: ScoredHorse[] | null | undefined,
  raceHeader: RaceHeader | null | undefined,
  raceNumber: number
): UseRaceBetsResult {
  // Get bankroll settings
  const bankroll = useBankroll();

  // Generate recommendations with memoization
  // Re-calculates when scoredHorses, raceHeader, raceNumber, or bankroll settings change
  const result = useMemo<UseRaceBetsResult>(() => {
    // Default empty tiers with informative messages
    const defaultEmptyContext: RaceContextSummary = {
      message: 'No race data available',
      severity: 'none',
      valuePlaysCount: 0,
    };

    const emptyConservative: BetTier = {
      label: 'Conservative Bets',
      description: 'Win and Place bets on top contenders',
      bets: [],
      hasBets: false,
      emptyMessage: 'No win/place value identified — all horses are fairly priced or underlays.',
      contextStats: undefined,
    };

    const emptyModerate: BetTier = {
      label: 'Moderate Bets',
      description: 'Exacta and Trifecta Key combinations',
      bets: [],
      hasBets: false,
      emptyMessage:
        'No exotic combinations recommended — not enough high-confidence value plays to justify multi-horse bet costs.',
      contextStats: undefined,
    };

    const emptyAggressive: BetTier = {
      label: 'Aggressive Bets',
      description: 'Trifecta Box and Superfecta plays',
      bets: [],
      hasBets: false,
      emptyMessage: 'No high-risk plays identified — no longshots showing significant overlay.',
      contextStats: undefined,
    };

    // Handle missing inputs
    if (!scoredHorses || scoredHorses.length === 0 || !raceHeader) {
      return {
        conservative: emptyConservative,
        moderate: emptyModerate,
        aggressive: emptyAggressive,
        isLoading: false,
        hasRecommendations: false,
        rawResult: null,
        summary: 'No race data available',
        raceContext: defaultEmptyContext,
        isPassRace: false,
        fieldSize: 0,
        scratchCount: 0,
      };
    }

    // Filter out scratched horses
    const activeHorses = scoredHorses.filter((h) => !h.score.isScratched);

    // Calculate scratch count and field size
    const scratchCount = scoredHorses.length - activeHorses.length;
    const fieldSize = activeHorses.length;

    if (activeHorses.length < 2) {
      const smallFieldContext: RaceContextSummary = {
        message:
          scratchCount > 0
            ? `Field reduced to ${fieldSize} horses after ${scratchCount} scratch${scratchCount !== 1 ? 'es' : ''}`
            : `Only ${fieldSize} horse${fieldSize !== 1 ? 's' : ''} in this race`,
        severity: 'caution',
        valuePlaysCount: 0,
        details: 'Not enough horses for betting recommendations',
      };
      return {
        conservative: emptyConservative,
        moderate: emptyModerate,
        aggressive: emptyAggressive,
        isLoading: false,
        hasRecommendations: false,
        rawResult: null,
        summary: 'Not enough active horses for recommendations',
        raceContext: smallFieldContext,
        isPassRace: true,
        fieldSize,
        scratchCount,
      };
    }

    // Generate recommendations
    let generatorResult: BetGeneratorResult;
    try {
      generatorResult = generateRecommendations({
        scoredHorses: activeHorses,
        raceHeader,
        raceNumber,
        bankroll,
      });
    } catch (error) {
      logger.logError(error instanceof Error ? error : new Error(String(error)), {
        component: 'useRaceBets',
      });
      return {
        conservative: emptyConservative,
        moderate: emptyModerate,
        aggressive: emptyAggressive,
        isLoading: false,
        hasRecommendations: false,
        rawResult: null,
        summary: 'Error generating recommendations',
        raceContext: {
          message: 'Error analyzing race — please try again',
          severity: 'none',
          valuePlaysCount: 0,
        },
        isPassRace: false,
        fieldSize,
        scratchCount,
      };
    }

    // Organize bets by UI tier
    const conservativeBets: FormattedBetSuggestion[] = [];
    const moderateBets: FormattedBetSuggestion[] = [];
    const aggressiveBets: FormattedBetSuggestion[] = [];

    // Process all generated bets
    for (const bet of generatorResult.allBets) {
      const tier = BET_TYPE_TO_TIER[bet.type];
      if (!tier) {
        continue; // Skip unmapped bet types
      }

      const horsesDisplay = formatHorsesForBet(bet);

      const formatted: FormattedBetSuggestion = {
        type: BET_TYPE_DISPLAY[bet.type] || bet.typeName || bet.type,
        horsesDisplay,
        programNumbers: bet.horseNumbers,
        confidence: bet.confidence,
        originalType: bet.type,
        explanation: bet.explanation || [],
      };

      // Add to appropriate tier (limit 2 per tier)
      switch (tier) {
        case 'conservative':
          if (conservativeBets.length < 2) {
            conservativeBets.push(formatted);
          }
          break;
        case 'moderate':
          if (moderateBets.length < 2) {
            moderateBets.push(formatted);
          }
          break;
        case 'aggressive':
          if (aggressiveBets.length < 2) {
            aggressiveBets.push(formatted);
          }
          break;
      }

      // Stop if all tiers are full
      if (conservativeBets.length >= 2 && moderateBets.length >= 2 && aggressiveBets.length >= 2) {
        break;
      }
    }

    // Extract summary stats from generator result
    const {
      tier1Count,
      tier2Count,
      tier3Count,
      nuclearCount,
      diamondCount,
      positiveEVCount,
      overlayCount,
      scratchCount: genScratchCount,
    } = generatorResult.summary;

    // Use scratch count from generator if available, otherwise use our calculated value
    const finalScratchCount = genScratchCount || scratchCount;

    // Build summary message
    const totalBets = generatorResult.allBets.length;
    let summary = '';
    if (totalBets === 0) {
      summary = 'No value plays identified in this race';
    } else if (positiveEVCount > 0) {
      summary = `${totalBets} bet${totalBets !== 1 ? 's' : ''} generated, ${positiveEVCount} with positive expected value`;
    } else {
      summary = `${totalBets} bet${totalBets !== 1 ? 's' : ''} generated based on scoring analysis`;
    }

    const hasAnyBets =
      conservativeBets.length > 0 || moderateBets.length > 0 || aggressiveBets.length > 0;

    // Generate informative empty state messages
    const conservativeEmpty = generateConservativeEmptyMessage(
      overlayCount,
      tier1Count,
      tier2Count
    );
    const moderateEmpty = generateModerateEmptyMessage(
      tier1Count,
      tier2Count,
      overlayCount,
      fieldSize
    );
    const aggressiveEmpty = generateAggressiveEmptyMessage(tier3Count, nuclearCount, diamondCount);

    // Generate race context summary
    const raceContext = generateRaceContextSummary(
      overlayCount,
      positiveEVCount,
      tier1Count,
      tier2Count,
      tier3Count,
      finalScratchCount,
      fieldSize,
      hasAnyBets
    );

    // Determine if this is a PASS race (no value at all)
    const isPassRace =
      raceContext.severity === 'pass' ||
      (overlayCount === 0 && positiveEVCount === 0 && !hasAnyBets);

    return {
      conservative: {
        label: 'Conservative Bets',
        description: 'Win and Place bets on top contenders',
        bets: conservativeBets,
        hasBets: conservativeBets.length > 0,
        emptyMessage: conservativeEmpty.message,
        contextStats: conservativeBets.length === 0 ? conservativeEmpty.contextStats : undefined,
      },
      moderate: {
        label: 'Moderate Bets',
        description: 'Exacta and Trifecta Key combinations',
        bets: moderateBets,
        hasBets: moderateBets.length > 0,
        emptyMessage: moderateEmpty.message,
        contextStats: moderateBets.length === 0 ? moderateEmpty.contextStats : undefined,
      },
      aggressive: {
        label: 'Aggressive Bets',
        description: 'Trifecta Box and Superfecta plays',
        bets: aggressiveBets,
        hasBets: aggressiveBets.length > 0,
        emptyMessage: aggressiveEmpty.message,
        contextStats: aggressiveBets.length === 0 ? aggressiveEmpty.contextStats : undefined,
      },
      isLoading: false,
      hasRecommendations: hasAnyBets,
      rawResult: generatorResult,
      summary,
      raceContext,
      isPassRace,
      fieldSize,
      scratchCount: finalScratchCount,
    };
  }, [scoredHorses, raceHeader, raceNumber, bankroll]);

  return result;
}

export default useRaceBets;
