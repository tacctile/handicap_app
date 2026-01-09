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
    // Default empty tiers
    const emptyConservative: BetTier = {
      label: 'Conservative Bets',
      description: 'Win and Place bets on top contenders',
      bets: [],
      hasBets: false,
      emptyMessage: 'No conservative bets recommended for this race',
    };

    const emptyModerate: BetTier = {
      label: 'Moderate Bets',
      description: 'Exacta and Trifecta Key combinations',
      bets: [],
      hasBets: false,
      emptyMessage: 'No moderate bets recommended for this race',
    };

    const emptyAggressive: BetTier = {
      label: 'Aggressive Bets',
      description: 'Trifecta Box and Superfecta plays',
      bets: [],
      hasBets: false,
      emptyMessage: 'No aggressive bets recommended for this race',
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
      };
    }

    // Filter out scratched horses
    const activeHorses = scoredHorses.filter((h) => !h.score.isScratched);

    if (activeHorses.length < 2) {
      return {
        conservative: emptyConservative,
        moderate: emptyModerate,
        aggressive: emptyAggressive,
        isLoading: false,
        hasRecommendations: false,
        rawResult: null,
        summary: 'Not enough active horses for recommendations',
      };
    }

    // ========== DEBUG: Log input to generateRecommendations ==========
    console.log('=== useRaceBets DEBUG: INPUT ===');
    console.log('Active horses count:', activeHorses.length);
    console.log(
      'Active horses:',
      activeHorses.map((h) => ({
        name: h.horse.horseName,
        programNumber: h.horse.programNumber,
        score: h.score.total,
        baseScore: h.score.baseScore,
        isScratched: h.score.isScratched,
      }))
    );
    console.log('Race number:', raceNumber);
    console.log('Race header surface:', raceHeader.surface);
    console.log('Bankroll mode:', bankroll.getComplexityMode());

    // Generate recommendations
    let generatorResult: BetGeneratorResult;
    try {
      generatorResult = generateRecommendations({
        scoredHorses: activeHorses,
        raceHeader,
        raceNumber,
        bankroll,
      });

      // ========== DEBUG: Log full generator result ==========
      console.log('=== useRaceBets DEBUG: GENERATOR RESULT ===');
      console.log('Total bets in allBets:', generatorResult.allBets.length);
      console.log('Summary:', generatorResult.summary);

      // Log tierBets
      console.log('--- TIER BETS ---');
      for (const tierBet of generatorResult.tierBets) {
        console.log(`Tier ${tierBet.tier}:`, {
          name: tierBet.tierName,
          betCount: tierBet.bets.length,
          bets: tierBet.bets.map((b) => ({
            type: b.type,
            typeName: b.typeName,
            horseNumbers: b.horseNumbers,
            horses: b.horses?.map((h) => h.horse?.horseName),
            horsesLength: b.horses?.length,
          })),
        });
      }

      // Log specialBets
      console.log('--- SPECIAL BETS ---');
      console.log('Nuclear longshots:', generatorResult.specialBets.nuclearLongshots.length);
      console.log('Diamonds:', generatorResult.specialBets.diamonds.length);
      console.log('Value bombs:', generatorResult.specialBets.valueBombs.length);

      // Log ALL bets with full details
      console.log('--- ALL BETS (full details) ---');
      for (const bet of generatorResult.allBets) {
        console.log({
          type: bet.type,
          typeName: bet.typeName,
          tier: bet.tier,
          specialCategory: bet.specialCategory,
          horseNumbers: bet.horseNumbers,
          horsesArrayLength: bet.horses?.length,
          horsesNames: bet.horses?.map((h) => h?.horse?.horseName),
          confidence: bet.confidence,
          description: bet.description,
        });
      }

      // Check mapping
      console.log('--- BET TYPE MAPPING CHECK ---');
      for (const bet of generatorResult.allBets) {
        const tier = BET_TYPE_TO_TIER[bet.type];
        console.log(`Bet type "${bet.type}" -> UI tier: ${tier || 'UNMAPPED!'}`);
      }
    } catch (error) {
      console.error('Error generating bet recommendations:', error);
      return {
        conservative: emptyConservative,
        moderate: emptyModerate,
        aggressive: emptyAggressive,
        isLoading: false,
        hasRecommendations: false,
        rawResult: null,
        summary: 'Error generating recommendations',
      };
    }

    // Organize bets by UI tier
    const conservativeBets: FormattedBetSuggestion[] = [];
    const moderateBets: FormattedBetSuggestion[] = [];
    const aggressiveBets: FormattedBetSuggestion[] = [];

    // ========== DEBUG: Track what gets added to each tier ==========
    console.log('=== useRaceBets DEBUG: PROCESSING BETS ===');

    // Process all generated bets
    for (const bet of generatorResult.allBets) {
      const tier = BET_TYPE_TO_TIER[bet.type];
      if (!tier) {
        console.log(`SKIPPING bet type "${bet.type}" - no mapping`);
        continue; // Skip unmapped bet types
      }

      const horsesDisplay = formatHorsesForBet(bet);
      console.log(`Processing: ${bet.type} -> ${tier} | horses: ${horsesDisplay}`);

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
            console.log(`  -> ADDED to conservative (now ${conservativeBets.length})`);
          } else {
            console.log(`  -> SKIPPED conservative (tier full)`);
          }
          break;
        case 'moderate':
          if (moderateBets.length < 2) {
            moderateBets.push(formatted);
            console.log(`  -> ADDED to moderate (now ${moderateBets.length})`);
          } else {
            console.log(`  -> SKIPPED moderate (tier full)`);
          }
          break;
        case 'aggressive':
          if (aggressiveBets.length < 2) {
            aggressiveBets.push(formatted);
            console.log(`  -> ADDED to aggressive (now ${aggressiveBets.length})`);
          } else {
            console.log(`  -> SKIPPED aggressive (tier full)`);
          }
          break;
      }

      // Stop if all tiers are full
      if (conservativeBets.length >= 2 && moderateBets.length >= 2 && aggressiveBets.length >= 2) {
        console.log('All tiers full, stopping processing');
        break;
      }
    }

    console.log('=== useRaceBets DEBUG: FINAL TIERS ===');
    console.log(
      'Conservative:',
      conservativeBets.map((b) => `${b.type}: ${b.horsesDisplay}`)
    );
    console.log(
      'Moderate:',
      moderateBets.map((b) => `${b.type}: ${b.horsesDisplay}`)
    );
    console.log(
      'Aggressive:',
      aggressiveBets.map((b) => `${b.type}: ${b.horsesDisplay}`)
    );

    // Build summary message
    const totalBets = generatorResult.allBets.length;
    const posEV = generatorResult.summary.positiveEVCount;
    let summary = '';
    if (totalBets === 0) {
      summary = 'No value plays identified in this race';
    } else if (posEV > 0) {
      summary = `${totalBets} bet${totalBets !== 1 ? 's' : ''} generated, ${posEV} with positive expected value`;
    } else {
      summary = `${totalBets} bet${totalBets !== 1 ? 's' : ''} generated based on scoring analysis`;
    }

    const hasAnyBets =
      conservativeBets.length > 0 || moderateBets.length > 0 || aggressiveBets.length > 0;

    return {
      conservative: {
        label: 'Conservative Bets',
        description: 'Win and Place bets on top contenders',
        bets: conservativeBets,
        hasBets: conservativeBets.length > 0,
        emptyMessage: 'No conservative bets recommended for this race',
      },
      moderate: {
        label: 'Moderate Bets',
        description: 'Exacta and Trifecta Key combinations',
        bets: moderateBets,
        hasBets: moderateBets.length > 0,
        emptyMessage: 'No moderate bets recommended for this race',
      },
      aggressive: {
        label: 'Aggressive Bets',
        description: 'Trifecta Box and Superfecta plays',
        bets: aggressiveBets,
        hasBets: aggressiveBets.length > 0,
        emptyMessage: 'No aggressive bets recommended for this race',
      },
      isLoading: false,
      hasRecommendations: hasAnyBets,
      rawResult: generatorResult,
      summary,
    };
  }, [scoredHorses, raceHeader, raceNumber, bankroll]);

  return result;
}

export default useRaceBets;
