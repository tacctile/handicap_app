/**
 * Multi-Race Exotic Bet Types
 *
 * Defines types for multi-race exotic bets:
 * - Daily Double: Win 2 consecutive races
 * - Pick 3: Win 3 consecutive races
 * - Pick 4: Win 4 consecutive races
 * - Pick 5: Win 5 consecutive races
 * - Pick 6: Win 6 consecutive races
 *
 * Each type has specific requirements for races, selections,
 * base bet amounts, and typical payout characteristics.
 */

// ============================================================================
// MULTI-RACE BET TYPES
// ============================================================================

/** Multi-race bet types */
export type MultiRaceBetType =
  | 'daily_double'
  | 'pick_3'
  | 'pick_4'
  | 'pick_5'
  | 'pick_6'

/** Strategy for building multi-race tickets */
export type MultiRaceStrategy =
  | 'conservative'  // Single best horse per race, low cost
  | 'balanced'      // 2-3 horses per race
  | 'aggressive'    // All horses in weak legs, singles in strong

/** Race strength classification */
export type RaceStrength =
  | 'standout'      // Clear favorite (180+ score, no competition)
  | 'competitive'   // Multiple strong contenders (3+ horses 160+)
  | 'weak'          // No standout (no horse 160+)

// ============================================================================
// BET TYPE CONFIGURATION
// ============================================================================

/** Configuration for a multi-race bet type */
export interface MultiRaceBetConfig {
  /** Bet type identifier */
  type: MultiRaceBetType
  /** Display name */
  displayName: string
  /** Short name for UI */
  shortName: string
  /** Number of consecutive races required */
  racesRequired: number
  /** Minimum selections per race */
  minSelectionsPerRace: number
  /** Maximum selections per race (practical limit) */
  maxSelectionsPerRace: number
  /** Available base bet amounts */
  baseBetOptions: number[]
  /** Default base bet amount */
  defaultBaseBet: number
  /** Minimum base bet allowed */
  minBaseBet: number
  /** Typical payout ranges (historical averages) */
  typicalPayoutRange: {
    min: number
    max: number
    average: number
  }
  /** Expected hit rate range */
  hitRateRange: {
    min: number
    max: number
  }
  /** Whether carryover tracking applies */
  hasCarryover: boolean
  /** Icon for UI */
  icon: string
  /** Description for users */
  description: string
}

/** All multi-race bet type configurations */
export const MULTI_RACE_BET_CONFIGS: Record<MultiRaceBetType, MultiRaceBetConfig> = {
  daily_double: {
    type: 'daily_double',
    displayName: 'Daily Double',
    shortName: 'DD',
    racesRequired: 2,
    minSelectionsPerRace: 1,
    maxSelectionsPerRace: 8,
    baseBetOptions: [0.5, 1, 2, 5, 10],
    defaultBaseBet: 2,
    minBaseBet: 0.5,
    typicalPayoutRange: {
      min: 10,
      max: 500,
      average: 50,
    },
    hitRateRange: {
      min: 0.10,
      max: 0.35,
    },
    hasCarryover: false,
    icon: 'looks_two',
    description: 'Pick the winner of 2 consecutive races',
  },
  pick_3: {
    type: 'pick_3',
    displayName: 'Pick 3',
    shortName: 'P3',
    racesRequired: 3,
    minSelectionsPerRace: 1,
    maxSelectionsPerRace: 8,
    baseBetOptions: [0.5, 1, 2, 5],
    defaultBaseBet: 1,
    minBaseBet: 0.5,
    typicalPayoutRange: {
      min: 20,
      max: 2000,
      average: 150,
    },
    hitRateRange: {
      min: 0.05,
      max: 0.15,
    },
    hasCarryover: false,
    icon: 'looks_3',
    description: 'Pick the winner of 3 consecutive races',
  },
  pick_4: {
    type: 'pick_4',
    displayName: 'Pick 4',
    shortName: 'P4',
    racesRequired: 4,
    minSelectionsPerRace: 1,
    maxSelectionsPerRace: 8,
    baseBetOptions: [0.5, 1, 2],
    defaultBaseBet: 0.5,
    minBaseBet: 0.5,
    typicalPayoutRange: {
      min: 50,
      max: 10000,
      average: 500,
    },
    hitRateRange: {
      min: 0.02,
      max: 0.08,
    },
    hasCarryover: true,
    icon: 'looks_4',
    description: 'Pick the winner of 4 consecutive races',
  },
  pick_5: {
    type: 'pick_5',
    displayName: 'Pick 5',
    shortName: 'P5',
    racesRequired: 5,
    minSelectionsPerRace: 1,
    maxSelectionsPerRace: 8,
    baseBetOptions: [0.5, 1],
    defaultBaseBet: 0.5,
    minBaseBet: 0.5,
    typicalPayoutRange: {
      min: 200,
      max: 50000,
      average: 2000,
    },
    hitRateRange: {
      min: 0.01,
      max: 0.04,
    },
    hasCarryover: true,
    icon: 'looks_5',
    description: 'Pick the winner of 5 consecutive races - often has carryovers',
  },
  pick_6: {
    type: 'pick_6',
    displayName: 'Pick 6',
    shortName: 'P6',
    racesRequired: 6,
    minSelectionsPerRace: 1,
    maxSelectionsPerRace: 10,
    baseBetOptions: [0.5, 1, 2],
    defaultBaseBet: 0.5,
    minBaseBet: 0.5,
    typicalPayoutRange: {
      min: 500,
      max: 500000,
      average: 10000,
    },
    hitRateRange: {
      min: 0.001,
      max: 0.01,
    },
    hasCarryover: true,
    icon: 'looks_6',
    description: 'Pick the winner of 6 consecutive races - jackpot bet with carryovers',
  },
}

// ============================================================================
// RACE SELECTION TYPES
// ============================================================================

/** Horse selection for a single race in a multi-race bet */
export interface RaceSelection {
  /** Race number */
  raceNumber: number
  /** Race position in sequence (1-based) */
  legNumber: number
  /** Selected horse program numbers */
  selections: number[]
  /** Whether "All" horses are selected */
  isAllSelected: boolean
  /** Total horses in the race field */
  fieldSize: number
  /** Race strength classification */
  raceStrength: RaceStrength
  /** Suggested selection from optimizer */
  suggestedSelections?: number[]
  /** Suggestion reasoning */
  suggestionReason?: string
}

/** Scored horse data for multi-race optimization */
export interface MultiRaceHorse {
  /** Program number */
  programNumber: number
  /** Horse name */
  horseName: string
  /** Overall score from handicapping */
  score: number
  /** Morning line odds */
  morningLineOdds: string
  /** Decimal odds for calculations */
  decimalOdds: number
  /** Estimated win probability */
  winProbability: number
  /** Tier classification (1=top, 2=mid, 3=value) */
  tier: 1 | 2 | 3
  /** Whether this is a "single" candidate (standout) */
  isSingleCandidate: boolean
  /** Score gap to next horse */
  scoreGapToNext: number
}

/** Race data for multi-race betting */
export interface MultiRaceRaceData {
  /** Race number */
  raceNumber: number
  /** Post time */
  postTime: string
  /** Field size */
  fieldSize: number
  /** Scored horses sorted by score */
  horses: MultiRaceHorse[]
  /** Race strength classification */
  strength: RaceStrength
  /** Has a standout favorite */
  hasStandout: boolean
  /** Standout horse if exists */
  standoutHorse?: MultiRaceHorse
  /** Is this race scratched/cancelled */
  isCancelled: boolean
}

// ============================================================================
// COST CALCULATION TYPES
// ============================================================================

/** Cost calculation result for a multi-race bet */
export interface MultiRaceCost {
  /** Total cost of the ticket */
  total: number
  /** Number of unique combinations */
  combinations: number
  /** Cost per single combination */
  costPerCombo: number
  /** Base bet amount used */
  baseBet: number
  /** Bet type */
  betType: MultiRaceBetType
  /** Selections per race (for display) */
  selectionsPerRace: number[]
  /** Spread notation (e.g., "2-3-2-1") */
  spreadNotation: string
  /** Detailed breakdown */
  breakdown: string
  /** Whether calculation is valid */
  isValid: boolean
  /** Error message if invalid */
  error?: string
}

// ============================================================================
// OPTIMIZATION TYPES
// ============================================================================

/** Configuration for multi-race optimization */
export interface MultiRaceOptimizationConfig {
  /** Bet type to optimize */
  betType: MultiRaceBetType
  /** Race data for each leg */
  races: MultiRaceRaceData[]
  /** Budget for this bet */
  budget: number
  /** Strategy preference */
  strategy: MultiRaceStrategy
  /** Maximum cost allowed */
  maxCost?: number
  /** Minimum probability threshold */
  minProbability?: number
  /** User's daily bankroll */
  dailyBankroll?: number
}

/** Optimized ticket result */
export interface OptimizedTicket {
  /** Unique identifier */
  id: string
  /** Bet type */
  betType: MultiRaceBetType
  /** Race selections */
  selections: RaceSelection[]
  /** Cost calculation */
  cost: MultiRaceCost
  /** Estimated win probability */
  probability: number
  /** Estimated payout range */
  payoutRange: {
    min: number
    max: number
    likely: number
  }
  /** Expected value */
  expectedValue: number
  /** Strategy used */
  strategy: MultiRaceStrategy
  /** Whether this is recommended */
  isRecommended: boolean
  /** Recommendation reasoning */
  reasoning: string
  /** Window instruction for placing bet */
  windowInstruction: string
  /** Races included (first-last) */
  raceRange: string
}

/** Result of multi-race optimization */
export interface MultiRaceOptimizationResult {
  /** All viable ticket options */
  tickets: OptimizedTicket[]
  /** Recommended ticket */
  recommended: OptimizedTicket | null
  /** Budget used by recommended */
  budgetUsed: number
  /** Budget remaining */
  budgetRemaining: number
  /** Summary text */
  summary: string
  /** Whether optimization succeeded */
  isValid: boolean
  /** Error message if not valid */
  error?: string
  /** Warnings (e.g., over 50% bankroll) */
  warnings: string[]
}

// ============================================================================
// CARRYOVER TYPES
// ============================================================================

/** Carryover information for Pick 5/6 */
export interface CarryoverInfo {
  /** Bet type (pick_5 or pick_6) */
  betType: 'pick_5' | 'pick_6'
  /** Track code */
  trackCode: string
  /** Track name */
  trackName: string
  /** Current carryover amount */
  carryoverAmount: number
  /** Number of days without a winner */
  daysWithoutWinner: number
  /** Estimated pool size for today */
  estimatedPoolToday: number
  /** Total expected pool (today + carryover) */
  totalExpectedPool: number
  /** Whether this is a mandatory payout day */
  isMandatory: boolean
  /** Mandatory payout date if known */
  mandatoryDate?: string
  /** Value classification */
  valueClass: 'low' | 'medium' | 'high' | 'exceptional'
  /** Recommendation text */
  recommendation: string
  /** Last updated timestamp */
  lastUpdated: string
}

/** Carryover value thresholds */
export const CARRYOVER_THRESHOLDS = {
  pick_5: {
    low: 0,
    medium: 25000,
    high: 50000,
    exceptional: 100000,
  },
  pick_6: {
    low: 0,
    medium: 100000,
    high: 250000,
    exceptional: 500000,
  },
} as const

// ============================================================================
// TICKET BUILDER TYPES
// ============================================================================

/** State for the interactive ticket builder */
export interface TicketBuilderState {
  /** Bet type being built */
  betType: MultiRaceBetType
  /** Starting race number */
  startingRace: number
  /** Race selections */
  selections: RaceSelection[]
  /** Current base bet */
  baseBet: number
  /** Live cost calculation */
  liveCost: MultiRaceCost | null
  /** Live probability estimate */
  liveProbability: number
  /** Budget constraint */
  budget: number
  /** Whether in auto-optimize mode */
  isAutoOptimizing: boolean
  /** Current strategy */
  strategy: MultiRaceStrategy
  /** Validation errors */
  errors: string[]
  /** Carryover info if applicable */
  carryover?: CarryoverInfo
}

/** Suggestion for a race leg */
export interface LegSuggestion {
  /** Race number */
  raceNumber: number
  /** Suggested action */
  action: 'single' | 'spread' | 'use_all'
  /** Suggested horse numbers */
  horses: number[]
  /** Reasoning */
  reason: string
  /** Icon for UI */
  icon: string
}

// ============================================================================
// BET SLIP TYPES
// ============================================================================

/** Multi-race ticket for display in bet slip */
export interface MultiRaceTicketDisplay {
  /** Unique identifier */
  id: string
  /** Bet type */
  betType: MultiRaceBetType
  /** Display name (e.g., "Pick 4 (Races 3-6)") */
  displayName: string
  /** Spread notation (e.g., "2-3-2-1") */
  spreadNotation: string
  /** Total cost */
  totalCost: number
  /** Win probability percentage */
  probabilityPercent: number
  /** Payout range */
  payoutRange: {
    min: number
    max: number
  }
  /** Expected value */
  expectedValue: number
  /** Individual race instructions */
  raceInstructions: Array<{
    raceNumber: number
    horses: number[]
    displayText: string
  }>
  /** Full window instruction */
  windowInstruction: string
  /** Carryover flag */
  hasCarryover: boolean
  /** Carryover amount if applicable */
  carryoverAmount?: number
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Get bet config by type */
export function getBetConfig(type: MultiRaceBetType): MultiRaceBetConfig {
  return MULTI_RACE_BET_CONFIGS[type]
}

/** Get all bet types as array */
export function getAllBetTypes(): MultiRaceBetType[] {
  return Object.keys(MULTI_RACE_BET_CONFIGS) as MultiRaceBetType[]
}

/** Check if bet type supports carryover */
export function supportsCarryover(type: MultiRaceBetType): boolean {
  return MULTI_RACE_BET_CONFIGS[type].hasCarryover
}

/** Get available bet types for a given number of races */
export function getAvailableBetTypes(raceCount: number): MultiRaceBetType[] {
  return getAllBetTypes().filter(
    type => MULTI_RACE_BET_CONFIGS[type].racesRequired <= raceCount
  )
}
