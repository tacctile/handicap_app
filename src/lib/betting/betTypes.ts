/**
 * Bet Types and Interfaces for the Betting Flow Engine
 *
 * Defines all types used for calculating and displaying bet recommendations.
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import type { ScoredHorse } from '../scoring';
import type { RaceValueAnalysis, ValuePlay } from '../../hooks/useValueDetection';

// ============================================================================
// RISK STYLE
// ============================================================================

/**
 * User's betting risk style preference
 */
export type RiskStyle = 'safe' | 'balanced' | 'aggressive';

/**
 * User's experience level (affects explanation depth)
 */
export type ExperienceLevel = 'beginner' | 'standard' | 'expert';

// ============================================================================
// BET TYPES
// ============================================================================

/**
 * Types of bets supported by the system
 */
export type BetType =
  | 'WIN'
  | 'PLACE'
  | 'SHOW'
  | 'EXACTA'
  | 'EXACTA_BOX'
  | 'TRIFECTA_KEY'
  | 'TRIFECTA_BOX'
  | 'SUPERFECTA_KEY';

/**
 * A single bet recommendation
 */
export interface SingleBet {
  /** Unique ID for this bet */
  id: string;
  /** Type of bet */
  type: BetType;
  /** Horses involved (post positions/program numbers) */
  horses: number[];
  /** Horse names for display */
  horseNames: string[];
  /** Base amount per combination */
  amount: number;
  /** Number of combinations */
  combinations: number;
  /** Total cost of this bet */
  totalCost: number;
  /** Potential return range (estimates) */
  potentialReturn: { min: number; max: number };
  /** Plain English explanation of why this bet */
  explanation: string;
  /** Exact phrase to say at the betting window */
  whatToSay: string;
  /** Whether to skip this bet */
  skip?: boolean;
  /** Reason for skipping */
  skipReason?: string;
  /** Priority/order (1 = most important) */
  priority: number;
}

/**
 * Description of betting terms for tooltips
 */
export interface BetTypeExplanation {
  /** Short name */
  name: string;
  /** Full description */
  description: string;
  /** How to read the ticket */
  howToRead: string;
  /** Example scenario */
  example: string;
  /** Risk level description */
  riskLevel: string;
}

// ============================================================================
// BET CALCULATION INPUT/OUTPUT
// ============================================================================

/**
 * Input for bet calculation
 */
export interface BetCalculationInput {
  /** Race header data */
  raceHeader: RaceHeader;
  /** All horses in the race */
  horses: HorseEntry[];
  /** Scored horses with ranks */
  scoredHorses: ScoredHorse[];
  /** User's budget for this race */
  budget: number;
  /** User's risk style */
  riskStyle: RiskStyle;
  /** Value analysis from detection hook */
  valueAnalysis: RaceValueAnalysis;
  /** Primary value play (if any) */
  valuePlay: ValuePlay | null;
  /** Top 4 contenders (by base score rank) */
  contenders: ScoredHorse[];
  /** Function to get current odds for a horse */
  getOdds: (index: number, defaultOdds: string) => string;
  /** Function to check if horse is scratched */
  isScratched: (index: number) => boolean;
}

/**
 * Result of bet calculation
 */
export interface BetCalculationResult {
  /** All recommended bets */
  bets: SingleBet[];
  /** Total cost of all bets */
  totalCost: number;
  /** Remaining budget after bets */
  remainingBudget: number;
  /** Potential return range if bets hit */
  potentialReturn: { min: number; max: number };
  /** Race verdict */
  raceVerdict: 'BET' | 'CAUTION' | 'PASS';
  /** Primary value play used in calculations */
  valuePlay: ValuePlay | null;
  /** Summary message for the user */
  summary: string;
  /** Skipped bets (with reasons) */
  skippedBets: SingleBet[];
}

// ============================================================================
// STYLE CONFIGURATION
// ============================================================================

/**
 * Style card display information
 */
export interface StyleInfo {
  /** Style key */
  key: RiskStyle;
  /** Display emoji */
  icon: string;
  /** Display name */
  name: string;
  /** Tagline quote */
  tagline: string;
  /** Bullet points describing the style */
  bullets: string[];
  /** Best for description */
  bestFor: string;
}

/**
 * Style configurations for display
 */
export const STYLE_CONFIGS: Record<RiskStyle, StyleInfo> = {
  safe: {
    key: 'safe',
    icon: '🛡️',
    name: 'SAFE',
    tagline: 'I want to cash tickets. Give me the safest bets.',
    bullets: ['Mostly Place and Show bets', "Lower payouts, but you'll hit more often"],
    bestFor: 'Beginners, small bankrolls',
  },
  balanced: {
    key: 'balanced',
    icon: '⚖️',
    name: 'BALANCED',
    tagline: 'Mix it up. Some safe bets, some swings.',
    bullets: ['Place bets plus Exacta/Trifecta', 'Medium risk, medium reward'],
    bestFor: 'Most bettors',
  },
  aggressive: {
    key: 'aggressive',
    icon: '🔥',
    name: 'AGGRESSIVE',
    tagline: "I'm here for the big scores. Let it ride.",
    bullets: [
      'Heavy on Exactas, Trifectas, Superfectas',
      'Higher risk, but huge payouts when you hit',
    ],
    bestFor: 'Experienced bettors, larger bankrolls',
  },
};

// ============================================================================
// BUDGET PRESETS
// ============================================================================

/**
 * Preset budget amounts for quick selection
 */
export const BUDGET_PRESETS: number[] = [5, 10, 20, 50, 100];

/**
 * Minimum bet amount (track minimum)
 */
export const MIN_BET_AMOUNT = 2;

/**
 * Maximum custom budget
 */
export const MAX_BUDGET = 1000;

// ============================================================================
// BET TYPE EXPLANATIONS
// ============================================================================

/**
 * Explanations for each bet type (for tooltips)
 */
export const BET_EXPLANATIONS: Record<BetType, BetTypeExplanation> = {
  WIN: {
    name: 'Win',
    description: 'Your horse must finish first to cash.',
    howToRead: 'A $2 WIN bet on #3 means you need #3 to win the race.',
    example: 'If #3 wins at 10-1 odds, your $2 bet pays $22.',
    riskLevel: 'Higher risk - only first place pays.',
  },
  PLACE: {
    name: 'Place',
    description: 'Your horse must finish first OR second to cash.',
    howToRead: 'A $2 PLACE bet on #3 means #3 can finish 1st or 2nd.',
    example: 'If #3 runs 2nd at 10-1 odds, you might get $8-12 back.',
    riskLevel: 'Medium risk - two ways to cash.',
  },
  SHOW: {
    name: 'Show',
    description: 'Your horse must finish first, second, OR third to cash.',
    howToRead: 'A $2 SHOW bet on #3 means #3 just needs to hit the board (top 3).',
    example: 'If #3 runs 3rd at 10-1 odds, you might get $5-7 back.',
    riskLevel: 'Lower risk - three ways to cash.',
  },
  EXACTA: {
    name: 'Exacta',
    description: 'Pick the first two finishers in exact order.',
    howToRead: '"2 over 3" means #2 must win and #3 must be second.',
    example: 'A $2 exacta with a longshot can pay $50-200+.',
    riskLevel: 'Higher risk - exact order is tough.',
  },
  EXACTA_BOX: {
    name: 'Exacta Box',
    description: 'Pick two horses to finish 1st and 2nd in either order.',
    howToRead: "Boxing #2 and #3 means either can win as long as they're 1-2.",
    example: 'Costs 2x a straight exacta (2 combinations).',
    riskLevel: 'Medium-high risk - more flexibility.',
  },
  TRIFECTA_KEY: {
    name: 'Trifecta Key',
    description:
      'Pick one "key" horse to be anywhere in the top 3, with other horses filling the remaining spots.',
    howToRead:
      '"#2 KEY with 1, 3, 5" means #2 can be 1st, 2nd, or 3rd, combined with any two of #1, #3, #5.',
    example: 'Covers 6 combinations when keying one horse with 3 others.',
    riskLevel: 'High risk, high reward - big payouts possible.',
  },
  TRIFECTA_BOX: {
    name: 'Trifecta Box',
    description: 'Pick 3+ horses - they must finish 1st, 2nd, and 3rd in any order.',
    howToRead: 'Boxing 1, 3, 5 covers all 6 possible orderings of those three horses.',
    example: 'Boxing 4 horses = 24 combinations. Gets expensive fast!',
    riskLevel: 'High risk - needs exact top 3 horses.',
  },
  SUPERFECTA_KEY: {
    name: 'Superfecta Key',
    description: 'Pick the first four finishers, using a key horse anywhere in the top 4.',
    howToRead:
      '"#2 KEY with 1, 3, 5, 7" means #2 finishes in the money combined with 3 of those others.',
    example: 'Super payouts can be $500+ even on $0.50 bets.',
    riskLevel: 'Very high risk - but life-changing payouts possible.',
  },
};
