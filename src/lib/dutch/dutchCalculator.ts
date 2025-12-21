/**
 * Dutch Book Calculator
 *
 * Implements Dutch booking strategy for distributing risk across multiple horses
 * while guaranteeing profit if any selected horse wins.
 *
 * Dutch Book Formula:
 * Calculate bet amounts so total return is the same regardless of which horse wins.
 *
 * For each horse:
 * Bet_i = (Total_Stake × Implied_Prob_i) / Sum_of_All_Implied_Probs
 *
 * Where:
 * - Implied_Prob = 1 / (Decimal_Odds)
 * - Total_Stake = Total amount to wager
 * - Sum = Total of all horses' implied probabilities
 *
 * Profit is only possible when Sum < 1.0 (overlay exists)
 *
 * @module dutch/dutchCalculator
 */

import { validateNumber } from '../sanitization'

// ============================================================================
// TYPES
// ============================================================================

export interface DutchHorse {
  /** Program number */
  programNumber: number
  /** Horse name */
  horseName: string
  /** Decimal odds (e.g., 3.0 for 2/1) */
  decimalOdds: number
  /** Odds display string (e.g., "2-1") */
  oddsDisplay: string
  /** Implied probability (1 / decimalOdds) */
  impliedProbability?: number
  /** Our estimated win probability (optional, for edge calculation) */
  estimatedWinProb?: number
  /** Fair odds based on our estimate (optional) */
  fairOdds?: number
  /** Overlay percentage (optional) */
  overlayPercent?: number
}

export interface DutchBet {
  /** Program number */
  programNumber: number
  /** Horse name */
  horseName: string
  /** Calculated bet amount */
  betAmount: number
  /** Bet amount rounded to nearest $0.10 */
  betAmountRounded: number
  /** Odds display string */
  oddsDisplay: string
  /** Decimal odds */
  decimalOdds: number
  /** Return if this horse wins */
  returnIfWins: number
  /** Implied probability */
  impliedProbability: number
  /** Percentage of total stake */
  percentOfStake: number
}

export interface DutchResult {
  /** Whether the Dutch book is valid and profitable */
  isValid: boolean
  /** Whether this Dutch has positive edge (sum < 100%) */
  hasProfitPotential: boolean
  /** Individual bet amounts */
  bets: DutchBet[]
  /** Total stake (sum of all bets) */
  totalStake: number
  /** Actual total cost after rounding */
  actualTotalCost: number
  /** Guaranteed return if any selected horse wins */
  guaranteedReturn: number
  /** Guaranteed profit */
  guaranteedProfit: number
  /** Return on investment percentage */
  roiPercent: number
  /** Edge percentage (100 - sum of implied probs) */
  edgePercent: number
  /** Sum of implied probabilities */
  sumOfImpliedProbs: number
  /** Number of horses in Dutch */
  horseCount: number
  /** Error message if invalid */
  error?: string
  /** Warnings (e.g., individual bets too small) */
  warnings: string[]
}

export interface DutchConfig {
  /** Total stake to distribute */
  totalStake: number
  /** Horses to include in Dutch */
  horses: DutchHorse[]
  /** Round bet amounts to nearest value (default $0.10) */
  roundToNearest?: number
  /** Minimum individual bet amount (default $2) */
  minimumBet?: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default minimum individual bet */
export const DEFAULT_MINIMUM_BET = 2

/** Default rounding increment */
export const DEFAULT_ROUND_TO_NEAREST = 0.1

/** Minimum total stake */
export const MINIMUM_TOTAL_STAKE = 10

/** Maximum horses in a Dutch */
export const MAX_DUTCH_HORSES = 10

/** Recommended maximum horses */
export const RECOMMENDED_MAX_HORSES = 5

/** Minimum edge percentage for a profitable Dutch */
export const MINIMUM_EDGE_PERCENT = 0

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse odds string to decimal odds
 * Handles: "5-1", "9/2", "EVEN", "+300", "-150"
 */
export function parseOddsToDecimal(oddsStr: string): number {
  if (!oddsStr || typeof oddsStr !== 'string') {
    return 2.0
  }

  const cleaned = oddsStr.trim().toUpperCase()

  // Handle "EVEN" odds
  if (cleaned === 'EVEN' || cleaned === 'EVN') {
    return 2.0
  }

  // Handle moneyline format (+300 or -150)
  if (cleaned.startsWith('+')) {
    const ml = parseFloat(cleaned.substring(1))
    if (!isNaN(ml)) {
      return 1 + ml / 100
    }
  }
  if (cleaned.startsWith('-')) {
    const ml = parseFloat(cleaned.substring(1))
    if (!isNaN(ml) && ml > 0) {
      return 1 + 100 / ml
    }
  }

  // Handle "X-Y" format (e.g., "5-1", "4-5")
  const dashMatch = cleaned.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/)
  if (dashMatch) {
    const num = parseFloat(dashMatch[1])
    const denom = parseFloat(dashMatch[2])
    if (!isNaN(num) && !isNaN(denom) && denom > 0) {
      return 1 + num / denom
    }
  }

  // Handle "X/Y" format (e.g., "5/2")
  const slashMatch = cleaned.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/)
  if (slashMatch) {
    const num = parseFloat(slashMatch[1])
    const denom = parseFloat(slashMatch[2])
    if (!isNaN(num) && !isNaN(denom) && denom > 0) {
      return 1 + num / denom
    }
  }

  // Handle plain number (already decimal or assume X-1 format)
  const plainNum = parseFloat(cleaned)
  if (!isNaN(plainNum)) {
    if (plainNum >= 1 && plainNum < 1.5) return 2.0 // Probably even money
    if (plainNum >= 1.5) return plainNum // Already decimal
    if (plainNum > 0 && plainNum < 1) return 1 + plainNum // Assume fractional part
    return 1 + plainNum // Assume X-1 format
  }

  return 2.0 // Default to even money
}

/**
 * Calculate implied probability from decimal odds
 */
export function calculateImpliedProbability(decimalOdds: number): number {
  if (decimalOdds <= 1.01) return 0.99 // Near certainty cap
  return 1 / decimalOdds
}

/**
 * Round a number to the nearest increment
 */
export function roundToNearest(value: number, increment: number): number {
  if (increment <= 0) return value
  return Math.round(value / increment) * increment
}

/**
 * Validate and sanitize horse data
 */
function sanitizeHorse(horse: DutchHorse): DutchHorse | null {
  if (!horse || typeof horse.programNumber !== 'number') {
    return null
  }

  const decimalOdds =
    typeof horse.decimalOdds === 'number' && horse.decimalOdds > 1
      ? horse.decimalOdds
      : parseOddsToDecimal(horse.oddsDisplay || '')

  if (decimalOdds <= 1) {
    return null
  }

  return {
    ...horse,
    programNumber: Math.floor(horse.programNumber),
    decimalOdds,
    impliedProbability: calculateImpliedProbability(decimalOdds),
  }
}

// ============================================================================
// CORE DUTCH BOOK CALCULATIONS
// ============================================================================

/**
 * Calculate Dutch book bet amounts
 *
 * Formula for each horse:
 * Bet_i = (Total_Stake × Implied_Prob_i) / Sum_of_All_Implied_Probs
 *
 * This ensures the return is the same regardless of which horse wins:
 * Return = Bet_i × Decimal_Odds_i = Total_Stake / Sum_of_All_Implied_Probs
 *
 * @param config - Dutch book configuration
 * @returns Dutch result with bet amounts and guaranteed return
 */
export function calculateDutchBook(config: DutchConfig): DutchResult {
  const {
    totalStake,
    horses,
    roundToNearest: roundIncrement = DEFAULT_ROUND_TO_NEAREST,
    minimumBet = DEFAULT_MINIMUM_BET,
  } = config

  const warnings: string[] = []

  // Validate total stake - check original value first
  if (typeof totalStake !== 'number' || !Number.isFinite(totalStake) || totalStake < MINIMUM_TOTAL_STAKE) {
    return createErrorResult(`Total stake must be at least $${MINIMUM_TOTAL_STAKE}`)
  }

  const validatedStake = validateNumber(totalStake, MINIMUM_TOTAL_STAKE, {
    min: MINIMUM_TOTAL_STAKE,
    max: 100000,
  })

  // Validate and sanitize horses
  if (!Array.isArray(horses) || horses.length < 2) {
    return createErrorResult('Dutch book requires at least 2 horses')
  }

  const sanitizedHorses = horses
    .map(sanitizeHorse)
    .filter((h): h is DutchHorse => h !== null)

  if (sanitizedHorses.length < 2) {
    return createErrorResult('At least 2 valid horses required with positive odds')
  }

  if (sanitizedHorses.length > MAX_DUTCH_HORSES) {
    return createErrorResult(`Maximum ${MAX_DUTCH_HORSES} horses allowed in a Dutch`)
  }

  if (sanitizedHorses.length > RECOMMENDED_MAX_HORSES) {
    warnings.push(
      `Consider using ${RECOMMENDED_MAX_HORSES} or fewer horses for optimal value`
    )
  }

  // Calculate sum of implied probabilities
  const sumOfImpliedProbs = sanitizedHorses.reduce(
    (sum, horse) => sum + (horse.impliedProbability ?? calculateImpliedProbability(horse.decimalOdds)),
    0
  )

  // Check if profitable (sum < 1.0 means overlay exists)
  const hasProfitPotential = sumOfImpliedProbs < 1
  const edgePercent = (1 - sumOfImpliedProbs) * 100

  if (!hasProfitPotential) {
    warnings.push(
      `No profit possible: combined book is ${(sumOfImpliedProbs * 100).toFixed(1)}% (need < 100%)`
    )
  }

  // Calculate individual bet amounts
  const bets: DutchBet[] = sanitizedHorses.map((horse) => {
    const impliedProb = horse.impliedProbability ?? calculateImpliedProbability(horse.decimalOdds)
    const betAmount = (validatedStake * impliedProb) / sumOfImpliedProbs
    const betAmountRounded = roundToNearest(betAmount, roundIncrement)
    const returnIfWins = betAmountRounded * horse.decimalOdds

    return {
      programNumber: horse.programNumber,
      horseName: horse.horseName,
      betAmount,
      betAmountRounded,
      oddsDisplay: horse.oddsDisplay,
      decimalOdds: horse.decimalOdds,
      returnIfWins,
      impliedProbability: impliedProb,
      percentOfStake: (betAmount / validatedStake) * 100,
    }
  })

  // Check for bets below minimum
  const belowMinimum = bets.filter((bet) => bet.betAmountRounded < minimumBet)
  if (belowMinimum.length > 0) {
    warnings.push(
      `${belowMinimum.length} bet(s) below track minimum $${minimumBet}. Consider increasing stake or removing horses.`
    )
  }

  // Calculate actual totals after rounding
  const actualTotalCost = bets.reduce((sum, bet) => sum + bet.betAmountRounded, 0)

  // Guaranteed return is calculated from any winning horse
  // Due to rounding, returns may vary slightly - use minimum
  const possibleReturns = bets.map((bet) => bet.returnIfWins)
  const guaranteedReturn = Math.min(...possibleReturns)

  const guaranteedProfit = guaranteedReturn - actualTotalCost
  const roiPercent = actualTotalCost > 0 ? (guaranteedProfit / actualTotalCost) * 100 : 0

  // Sort bets by bet amount descending
  bets.sort((a, b) => b.betAmountRounded - a.betAmountRounded)

  return {
    isValid: true,
    hasProfitPotential,
    bets,
    totalStake: validatedStake,
    actualTotalCost: Math.round(actualTotalCost * 100) / 100,
    guaranteedReturn: Math.round(guaranteedReturn * 100) / 100,
    guaranteedProfit: Math.round(guaranteedProfit * 100) / 100,
    roiPercent: Math.round(roiPercent * 100) / 100,
    edgePercent: Math.round(edgePercent * 100) / 100,
    sumOfImpliedProbs: Math.round(sumOfImpliedProbs * 10000) / 10000,
    horseCount: bets.length,
    warnings,
  }
}

/**
 * Create error result
 */
function createErrorResult(error: string): DutchResult {
  return {
    isValid: false,
    hasProfitPotential: false,
    bets: [],
    totalStake: 0,
    actualTotalCost: 0,
    guaranteedReturn: 0,
    guaranteedProfit: 0,
    roiPercent: 0,
    edgePercent: 0,
    sumOfImpliedProbs: 0,
    horseCount: 0,
    error,
    warnings: [],
  }
}

// ============================================================================
// ADVANCED CALCULATIONS
// ============================================================================

/**
 * Calculate Dutch book for a target profit
 *
 * Given a target profit amount, calculates the required total stake
 * and individual bet amounts.
 *
 * @param horses - Horses to include
 * @param targetProfit - Desired profit amount
 * @returns Dutch result or null if not achievable
 */
export function calculateDutchForTargetProfit(
  horses: DutchHorse[],
  targetProfit: number
): DutchResult | null {
  // First, check if profit is possible
  const sanitizedHorses = horses
    .map(sanitizeHorse)
    .filter((h): h is DutchHorse => h !== null)

  if (sanitizedHorses.length < 2) return null

  const sumOfImpliedProbs = sanitizedHorses.reduce(
    (sum, horse) => sum + calculateImpliedProbability(horse.decimalOdds),
    0
  )

  if (sumOfImpliedProbs >= 1) {
    // No profit possible
    return null
  }

  // Calculate required stake for target profit
  // Profit = (Stake / Sum) - Stake = Stake * (1/Sum - 1) = Stake * (1 - Sum) / Sum
  // Therefore: Stake = Profit * Sum / (1 - Sum)
  const requiredStake = (targetProfit * sumOfImpliedProbs) / (1 - sumOfImpliedProbs)

  if (requiredStake < MINIMUM_TOTAL_STAKE) {
    return calculateDutchBook({
      totalStake: MINIMUM_TOTAL_STAKE,
      horses: sanitizedHorses,
    })
  }

  return calculateDutchBook({
    totalStake: Math.ceil(requiredStake),
    horses: sanitizedHorses,
  })
}

/**
 * Calculate Dutch book for a target return
 *
 * @param horses - Horses to include
 * @param targetReturn - Desired return amount
 * @returns Dutch result or null if not achievable
 */
export function calculateDutchForTargetReturn(
  horses: DutchHorse[],
  targetReturn: number
): DutchResult | null {
  const sanitizedHorses = horses
    .map(sanitizeHorse)
    .filter((h): h is DutchHorse => h !== null)

  if (sanitizedHorses.length < 2) return null

  const sumOfImpliedProbs = sanitizedHorses.reduce(
    (sum, horse) => sum + calculateImpliedProbability(horse.decimalOdds),
    0
  )

  // Return = Stake / Sum, so Stake = Return * Sum
  const requiredStake = targetReturn * sumOfImpliedProbs

  if (requiredStake < MINIMUM_TOTAL_STAKE) {
    return calculateDutchBook({
      totalStake: MINIMUM_TOTAL_STAKE,
      horses: sanitizedHorses,
    })
  }

  return calculateDutchBook({
    totalStake: Math.ceil(requiredStake),
    horses: sanitizedHorses,
  })
}

/**
 * Calculate the edge for a potential Dutch book
 * without calculating full bet amounts
 *
 * @param horses - Horses to check
 * @returns Edge percentage and validity info
 */
export function calculateDutchEdge(horses: DutchHorse[]): {
  edgePercent: number
  sumOfImpliedProbs: number
  hasProfitPotential: boolean
  horseCount: number
} {
  const sanitizedHorses = horses
    .map(sanitizeHorse)
    .filter((h): h is DutchHorse => h !== null)

  const sumOfImpliedProbs = sanitizedHorses.reduce(
    (sum, horse) => sum + calculateImpliedProbability(horse.decimalOdds),
    0
  )

  return {
    edgePercent: Math.round((1 - sumOfImpliedProbs) * 10000) / 100,
    sumOfImpliedProbs: Math.round(sumOfImpliedProbs * 10000) / 10000,
    hasProfitPotential: sumOfImpliedProbs < 1,
    horseCount: sanitizedHorses.length,
  }
}

/**
 * Find the maximum stake for a Dutch book given a budget
 * that still allows individual bets above minimum
 *
 * @param horses - Horses in Dutch
 * @param budget - Maximum available budget
 * @param minimumBet - Minimum bet amount
 * @returns Maximum viable stake or null if not possible
 */
export function findMaxViableStake(
  horses: DutchHorse[],
  budget: number,
  minimumBet: number = DEFAULT_MINIMUM_BET
): number | null {
  const sanitizedHorses = horses
    .map(sanitizeHorse)
    .filter((h): h is DutchHorse => h !== null)

  if (sanitizedHorses.length < 2) return null

  const sumOfImpliedProbs = sanitizedHorses.reduce(
    (sum, horse) => sum + calculateImpliedProbability(horse.decimalOdds),
    0
  )

  // Find the smallest implied probability (this horse will get the smallest bet)
  const minImpliedProb = Math.min(
    ...sanitizedHorses.map((h) => calculateImpliedProbability(h.decimalOdds))
  )

  // For smallest bet to be >= minimumBet:
  // Stake * minImpliedProb / Sum >= minimumBet
  // Stake >= minimumBet * Sum / minImpliedProb
  const minStakeForAllBets = (minimumBet * sumOfImpliedProbs) / minImpliedProb

  if (minStakeForAllBets > budget) {
    return null // Not enough budget for all bets to meet minimum
  }

  return Math.min(budget, Math.max(minStakeForAllBets, MINIMUM_TOTAL_STAKE))
}
