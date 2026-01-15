/**
 * Betting Suggestion Engine
 *
 * Algorithm-driven betting suggestion system that generates optimal bet
 * allocations based on budget and risk style.
 *
 * @module betting/suggestionEngine
 */

import type { ScoredHorse } from '../scoring';
import type { RaceHeader } from '../../types/drf';
import { generateTopBets, type TopBet, type TopBetType, type RiskTier } from './topBetsGenerator';
import { logger } from '../../services/logging';

// ============================================================================
// TYPES
// ============================================================================

export type BettingStyle = 'Conservative' | 'Moderate' | 'Aggressive';

export interface BetSuggestion {
  /** Bet type display (WIN, PLACE, EXACTA BOX, etc.) */
  betType: string;
  /** Internal bet type for processing */
  internalType: TopBetType;
  /** Horse numbers involved */
  horseNumbers: number[];
  /** Horse names involved */
  horseNames: string[];
  /** Dollar amount allocated */
  amount: number;
  /** Window script for this bet */
  windowScript: string;
  /** Confidence/probability percentage */
  confidence: number;
  /** Risk tier of this bet */
  riskTier: RiskTier;
  /** Priority order (lower = higher priority) */
  priority: number;
}

export interface SuggestionResult {
  /** List of suggested bets */
  suggestions: BetSuggestion[];
  /** Total amount allocated */
  totalAllocated: number;
  /** Remaining budget (unallocated) */
  remaining: number;
  /** Input budget */
  budget: number;
  /** Input style */
  style: BettingStyle;
  /** Error message if applicable */
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Minimum budget required for any suggestions */
const MIN_BUDGET = 2;

/** Maximum number of bets to suggest (keeps it manageable) */
const MAX_SUGGESTIONS = 15;

/** Practical bet amounts in order of preference */
const BET_AMOUNTS = [1, 2, 3, 5, 10, 20];

/** Style weights for different bet types */
interface StyleConfig {
  /** Weight for WIN bets (0-1) */
  winWeight: number;
  /** Weight for PLACE bets (0-1) */
  placeWeight: number;
  /** Weight for SHOW bets (0-1) */
  showWeight: number;
  /** Weight for EXACTA bets (0-1) */
  exactaWeight: number;
  /** Weight for TRIFECTA bets (0-1) */
  trifectaWeight: number;
  /** Weight for SUPERFECTA bets (0-1) */
  superfectaWeight: number;
  /** How many top horses to focus on */
  topHorsesFocus: number;
  /** Whether to include longshot exotics */
  includeLongshots: boolean;
  /** Target number of bets */
  targetBetCount: number;
}

const STYLE_CONFIGS: Record<BettingStyle, StyleConfig> = {
  Conservative: {
    winWeight: 0.4,
    placeWeight: 0.35,
    showWeight: 0.2,
    exactaWeight: 0.05,
    trifectaWeight: 0,
    superfectaWeight: 0,
    topHorsesFocus: 2,
    includeLongshots: false,
    targetBetCount: 4,
  },
  Moderate: {
    winWeight: 0.25,
    placeWeight: 0.2,
    showWeight: 0.1,
    exactaWeight: 0.25,
    trifectaWeight: 0.15,
    superfectaWeight: 0.05,
    topHorsesFocus: 4,
    includeLongshots: false,
    targetBetCount: 6,
  },
  Aggressive: {
    winWeight: 0.1,
    placeWeight: 0.05,
    showWeight: 0,
    exactaWeight: 0.2,
    trifectaWeight: 0.35,
    superfectaWeight: 0.3,
    topHorsesFocus: 5,
    includeLongshots: true,
    targetBetCount: 8,
  },
};

// ============================================================================
// BET TYPE CATEGORIZATION
// ============================================================================

type BetCategory = 'win' | 'place' | 'show' | 'exacta' | 'trifecta' | 'superfecta';

function getBetCategory(type: TopBetType): BetCategory {
  switch (type) {
    case 'WIN':
      return 'win';
    case 'PLACE':
      return 'place';
    case 'SHOW':
      return 'show';
    case 'QUINELLA':
    case 'EXACTA_STRAIGHT':
    case 'EXACTA_BOX_2':
    case 'EXACTA_BOX_3':
      return 'exacta';
    case 'TRIFECTA_STRAIGHT':
    case 'TRIFECTA_BOX_3':
    case 'TRIFECTA_BOX_4':
    case 'TRIFECTA_KEY':
      return 'trifecta';
    case 'SUPERFECTA_STRAIGHT':
    case 'SUPERFECTA_BOX_4':
    case 'SUPERFECTA_BOX_5':
    case 'SUPERFECTA_KEY':
      return 'superfecta';
    default:
      return 'exacta';
  }
}

function getCategoryWeight(category: BetCategory, config: StyleConfig): number {
  switch (category) {
    case 'win':
      return config.winWeight;
    case 'place':
      return config.placeWeight;
    case 'show':
      return config.showWeight;
    case 'exacta':
      return config.exactaWeight;
    case 'trifecta':
      return config.trifectaWeight;
    case 'superfecta':
      return config.superfectaWeight;
    default:
      return 0;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the best practical bet amount that fits within remaining budget
 */
function getBestBetAmount(remainingBudget: number, idealAmount: number): number {
  // Find the highest practical amount that doesn't exceed ideal or remaining
  const maxAllowed = Math.min(remainingBudget, idealAmount);

  // Find the best matching practical amount
  for (let i = BET_AMOUNTS.length - 1; i >= 0; i--) {
    const amount = BET_AMOUNTS[i];
    if (amount !== undefined && amount <= maxAllowed) {
      return amount;
    }
  }

  // If no practical amount fits, return 1 if possible
  return remainingBudget >= 1 ? 1 : 0;
}

/**
 * Scale window script to new amount
 */
function scaleWindowScript(script: string, newAmount: number): string {
  return script.replace(/\$1/g, `$${newAmount}`);
}

/**
 * Format bet type for display
 */
function formatBetTypeDisplay(type: TopBetType): string {
  switch (type) {
    case 'WIN':
      return 'WIN';
    case 'PLACE':
      return 'PLACE';
    case 'SHOW':
      return 'SHOW';
    case 'QUINELLA':
      return 'QUINELLA';
    case 'EXACTA_STRAIGHT':
      return 'EXACTA';
    case 'EXACTA_BOX_2':
    case 'EXACTA_BOX_3':
      return 'EXACTA BOX';
    case 'TRIFECTA_STRAIGHT':
      return 'TRIFECTA';
    case 'TRIFECTA_BOX_3':
    case 'TRIFECTA_BOX_4':
      return 'TRIFECTA BOX';
    case 'TRIFECTA_KEY':
      return 'TRIFECTA KEY';
    case 'SUPERFECTA_STRAIGHT':
      return 'SUPERFECTA';
    case 'SUPERFECTA_BOX_4':
    case 'SUPERFECTA_BOX_5':
      return 'SUPERFECTA BOX';
    case 'SUPERFECTA_KEY':
      return 'SUPERFECTA KEY';
    default:
      return type;
  }
}

// ============================================================================
// MAIN SUGGESTION ENGINE
// ============================================================================

/**
 * Generate betting suggestions based on budget and style
 */
export function generateBettingSuggestions(
  budget: number,
  style: BettingStyle,
  scoredHorses: ScoredHorse[],
  raceHeader: RaceHeader,
  raceNumber: number,
  getOdds: (index: number, original: string) => string = (_i, o) => o,
  isScratched: (index: number) => boolean = () => false
): SuggestionResult {
  // Validate budget
  if (!budget || budget < MIN_BUDGET) {
    return {
      suggestions: [],
      totalAllocated: 0,
      remaining: budget || 0,
      budget: budget || 0,
      style,
      error: budget && budget > 0 && budget < MIN_BUDGET
        ? 'Budget too low for recommended bets'
        : undefined,
    };
  }

  // Get style configuration
  const config = STYLE_CONFIGS[style];

  // Generate all top bets from the existing algorithm
  const topBetsResult = generateTopBets(scoredHorses, raceHeader, raceNumber, getOdds, isScratched);

  if (topBetsResult.topBets.length === 0) {
    return {
      suggestions: [],
      totalAllocated: 0,
      remaining: budget,
      budget,
      style,
      error: 'No bets available for this race',
    };
  }

  // Get active (non-scratched) horses sorted by score
  const activeHorses = scoredHorses
    .filter((h) => !isScratched(h.index) && !h.score.isScratched)
    .sort((a, b) => b.score.baseScore - a.score.baseScore);

  // Get top horse program numbers for filtering
  const topHorseNumbers = new Set(
    activeHorses.slice(0, config.topHorsesFocus).map((h) => h.horse.programNumber)
  );

  // Score and filter bets based on style
  const scoredBets = topBetsResult.topBets
    .map((bet) => {
      const category = getBetCategory(bet.internalType);
      const categoryWeight = getCategoryWeight(category, config);

      // Skip if this category has zero weight
      if (categoryWeight === 0) return null;

      // Check if bet involves top horses (for conservative/moderate focus)
      const involvesTopHorses = bet.horseNumbers.some((n) => topHorseNumbers.has(n));

      // For conservative style, strongly prefer bets on top horses
      if (style === 'Conservative' && !involvesTopHorses) {
        return null;
      }

      // For moderate, prefer top horses but allow some others
      const topHorseBonus = involvesTopHorses ? 1.5 : 0.5;

      // Calculate priority score (higher = better)
      const priorityScore =
        bet.probability * 0.4 + // Confidence matters
        bet.expectedValue * 0.3 + // EV matters
        categoryWeight * 100 + // Category weight matters a lot
        topHorseBonus * 10; // Top horse bonus

      return { bet, priorityScore, category };
    })
    .filter((item): item is { bet: TopBet; priorityScore: number; category: BetCategory } =>
      item !== null
    )
    .sort((a, b) => b.priorityScore - a.priorityScore);

  // Allocate budget across bets
  const suggestions: BetSuggestion[] = [];
  let remainingBudget = budget;
  let totalAllocated = 0;

  // Track categories used for diversity
  const usedCategories = new Set<BetCategory>();
  const usedBetKeys = new Set<string>();

  // First pass: ensure diversity by picking one from each weighted category
  const categoriesToInclude: BetCategory[] = [];
  if (config.winWeight > 0) categoriesToInclude.push('win');
  if (config.placeWeight > 0) categoriesToInclude.push('place');
  if (config.showWeight > 0) categoriesToInclude.push('show');
  if (config.exactaWeight > 0) categoriesToInclude.push('exacta');
  if (config.trifectaWeight > 0) categoriesToInclude.push('trifecta');
  if (config.superfectaWeight > 0) categoriesToInclude.push('superfecta');

  // Pick best bet from each category
  for (const category of categoriesToInclude) {
    if (suggestions.length >= config.targetBetCount) break;
    if (remainingBudget < 1) break;

    const bestInCategory = scoredBets.find(
      (s) => s.category === category && !usedBetKeys.has(`${s.bet.internalType}-${s.bet.horseNumbers.join(',')}`)
    );

    if (bestInCategory) {
      const bet = bestInCategory.bet;
      const weight = getCategoryWeight(category, config);

      // Calculate ideal amount based on weight and remaining budget
      const idealAmount = Math.max(1, Math.round(budget * weight));
      const amount = getBestBetAmount(remainingBudget, idealAmount);

      if (amount > 0) {
        const betKey = `${bet.internalType}-${bet.horseNumbers.join(',')}`;
        usedBetKeys.add(betKey);
        usedCategories.add(category);

        suggestions.push({
          betType: formatBetTypeDisplay(bet.internalType),
          internalType: bet.internalType,
          horseNumbers: bet.horseNumbers,
          horseNames: bet.horses.map((h) => h.name),
          amount,
          windowScript: scaleWindowScript(bet.whatToSay, amount),
          confidence: bet.probability,
          riskTier: bet.riskTier,
          priority: suggestions.length + 1,
        });

        remainingBudget -= amount;
        totalAllocated += amount;
      }
    }
  }

  // Second pass: fill remaining budget with more bets from priority list
  for (const scored of scoredBets) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    if (remainingBudget < 1) break;

    const bet = scored.bet;
    const betKey = `${bet.internalType}-${bet.horseNumbers.join(',')}`;

    if (usedBetKeys.has(betKey)) continue;

    // Calculate amount based on remaining budget and priority
    const priorityFactor = Math.max(0.5, 1 - suggestions.length * 0.1);
    const idealAmount = Math.max(1, Math.round(remainingBudget * priorityFactor * 0.3));
    const amount = getBestBetAmount(remainingBudget, idealAmount);

    if (amount > 0) {
      usedBetKeys.add(betKey);

      suggestions.push({
        betType: formatBetTypeDisplay(bet.internalType),
        internalType: bet.internalType,
        horseNumbers: bet.horseNumbers,
        horseNames: bet.horses.map((h) => h.name),
        amount,
        windowScript: scaleWindowScript(bet.whatToSay, amount),
        confidence: bet.probability,
        riskTier: bet.riskTier,
        priority: suggestions.length + 1,
      });

      remainingBudget -= amount;
      totalAllocated += amount;
    }
  }

  // Third pass: if we have remaining budget and few suggestions, increase amounts
  if (remainingBudget >= 1 && suggestions.length > 0 && suggestions.length < 3) {
    // Find best suggestion to add more to
    const bestSuggestion = suggestions[0];
    if (bestSuggestion) {
      const additionalAmount = getBestBetAmount(remainingBudget, remainingBudget);
      if (additionalAmount > 0) {
        bestSuggestion.amount += additionalAmount;
        bestSuggestion.windowScript = scaleWindowScript(
          topBetsResult.topBets.find((b) =>
            b.internalType === bestSuggestion.internalType &&
            b.horseNumbers.join(',') === bestSuggestion.horseNumbers.join(',')
          )?.whatToSay || bestSuggestion.windowScript,
          bestSuggestion.amount
        );
        remainingBudget -= additionalAmount;
        totalAllocated += additionalAmount;
      }
    }
  }

  // Sort suggestions by priority
  suggestions.sort((a, b) => a.priority - b.priority);

  logger.logInfo('Betting suggestions generated', {
    component: 'suggestionEngine',
    budget,
    style,
    suggestionCount: suggestions.length,
    totalAllocated,
    remaining: remainingBudget,
  });

  return {
    suggestions,
    totalAllocated,
    remaining: remainingBudget,
    budget,
    style,
  };
}

/**
 * Generate window scripts for all suggestions
 */
export function generateWindowScripts(suggestions: BetSuggestion[]): string[] {
  return suggestions.map((s) => s.windowScript);
}

export default generateBettingSuggestions;
