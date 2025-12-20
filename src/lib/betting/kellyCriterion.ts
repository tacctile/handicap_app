/**
 * Kelly Criterion Module
 *
 * Implements the Kelly Criterion formula for optimal bet sizing.
 * The Kelly formula: f* = (bp - q) / b
 *
 * Where:
 * - f* = fraction of bankroll to wager
 * - b = decimal odds received (net odds, e.g., 3.0 means 3:1)
 * - p = probability of winning
 * - q = probability of losing (1 - p)
 *
 * This module provides:
 * - Full Kelly calculation
 * - Fractional Kelly (1/4, 1/2, Full) for safety
 * - Edge calculation and validation
 * - Expected bankroll growth rate
 *
 * @module betting/kellyCriterion
 */

import { logger } from '../../services/logging'
import type { KellySettings, KellyFraction, RiskToleranceKelly } from './kellySettings'
import { validateKellyInputs } from './kellyValidator'

// ============================================================================
// TYPES
// ============================================================================

export interface KellyInput {
  /** Win probability as decimal (0.0 to 1.0) */
  winProbability: number
  /** Decimal odds (e.g., 5.0 for 4/1 or 5-1) */
  decimalOdds: number
  /** Current bankroll in dollars */
  bankroll: number
  /** Kelly fraction to use (0.25, 0.5, 1.0) */
  kellyFraction?: KellyFraction
  /** Maximum bet as percentage of bankroll (0.0 to 1.0) */
  maxBetPercent?: number
  /** Minimum edge required to bet (0.0 to 1.0) */
  minEdgeRequired?: number
}

export interface KellyResult {
  /** Optimal bet size in dollars */
  optimalBetSize: number
  /** Full Kelly fraction (before safety adjustments) */
  fullKellyFraction: number
  /** Adjusted Kelly fraction (after applying kellyFraction) */
  adjustedKellyFraction: number
  /** Fraction used (e.g., 0.25 for Quarter Kelly) */
  fractionUsed: KellyFraction
  /** Edge percentage ((p * b - q) / 1) */
  edgePercent: number
  /** Whether the bet has positive edge */
  hasPositiveEdge: boolean
  /** Whether Kelly suggests betting */
  shouldBet: boolean
  /** Reason if shouldBet is false */
  reason: string | null
  /** Expected bankroll growth rate (geometric mean) */
  expectedGrowthRate: number
  /** Implied probability from odds */
  impliedProbability: number
  /** Our edge over implied probability */
  overlayPercent: number
  /** Warnings (e.g., bet capped, edge barely positive) */
  warnings: KellyWarning[]
  /** Was the bet capped? */
  wasCapped: boolean
  /** Original bet size before capping */
  uncappedBetSize: number
}

export interface KellyWarning {
  type: 'bet_capped' | 'kelly_negative' | 'edge_marginal' | 'bankroll_low' | 'bet_too_aggressive'
  message: string
  severity: 'info' | 'warning' | 'error'
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Kelly fraction multipliers */
export const KELLY_FRACTION_VALUES: Record<KellyFraction, number> = {
  quarter: 0.25,
  half: 0.50,
  full: 1.00,
}

/** Kelly fraction display labels */
export const KELLY_FRACTION_LABELS: Record<KellyFraction, string> = {
  quarter: '1/4 Kelly',
  half: '1/2 Kelly',
  full: 'Full Kelly',
}

/** Minimum bet amount in dollars */
export const MIN_BET_AMOUNT = 2

/** Default max bet as percentage of bankroll */
export const DEFAULT_MAX_BET_PERCENT = 0.10

/** Default minimum edge required */
export const DEFAULT_MIN_EDGE_PERCENT = 0.05

/** Threshold for considering edge "marginal" */
export const MARGINAL_EDGE_THRESHOLD = 0.03

// ============================================================================
// CORE KELLY FUNCTIONS
// ============================================================================

/**
 * Calculate the Kelly Criterion optimal bet size
 *
 * The Kelly formula: f* = (bp - q) / b
 *
 * @param input - Kelly input parameters
 * @returns Kelly result with optimal bet size and metadata
 */
export function calculateKelly(input: KellyInput): KellyResult {
  const {
    winProbability,
    decimalOdds,
    bankroll,
    kellyFraction = 'quarter',
    maxBetPercent = DEFAULT_MAX_BET_PERCENT,
    minEdgeRequired = DEFAULT_MIN_EDGE_PERCENT,
  } = input

  // Initialize warnings
  const warnings: KellyWarning[] = []

  // Validate inputs
  const validation = validateKellyInputs({
    winProbability,
    decimalOdds,
    bankroll,
  })

  if (!validation.isValid) {
    logger.logWarning('Kelly calculation failed validation', {
      component: 'kellyCriterion',
      errors: validation.errors,
    })

    return createZeroResult(kellyFraction, validation.errors.join('; '))
  }

  // Calculate probabilities
  const p = winProbability
  const q = 1 - p

  // Decimal odds is the multiplier (e.g., 5.0 for 4/1)
  // Net odds (b) = decimalOdds - 1 for fair comparison
  const b = decimalOdds - 1

  // Calculate implied probability from odds
  const impliedProbability = 1 / decimalOdds

  // Calculate overlay percentage
  const overlayPercent = ((p - impliedProbability) / impliedProbability) * 100

  // Calculate edge percentage: (b * p - q) = expected profit per $1 wagered
  const edge = b * p - q
  const edgePercent = edge * 100

  // Calculate full Kelly fraction
  // f* = (bp - q) / b
  const fullKellyFraction = edge / b

  // Check if we have positive edge
  const hasPositiveEdge = fullKellyFraction > 0

  // Determine if edge meets minimum requirement
  const meetsMinEdge = edge >= minEdgeRequired

  // Calculate expected growth rate using Kelly criterion
  // g = p * log(1 + b*f) + q * log(1 - f)
  // For small f, approximately: g ≈ f * edge - (f^2 * b^2 * p * q) / 2
  const expectedGrowthRate = hasPositiveEdge
    ? calculateExpectedGrowthRate(p, b, fullKellyFraction * KELLY_FRACTION_VALUES[kellyFraction])
    : 0

  // Check various conditions
  if (!hasPositiveEdge) {
    warnings.push({
      type: 'kelly_negative',
      message: 'Kelly suggests pass - no positive edge',
      severity: 'warning',
    })

    return {
      optimalBetSize: 0,
      fullKellyFraction,
      adjustedKellyFraction: 0,
      fractionUsed: kellyFraction,
      edgePercent,
      hasPositiveEdge: false,
      shouldBet: false,
      reason: 'Negative edge - underlay',
      expectedGrowthRate: 0,
      impliedProbability,
      overlayPercent,
      warnings,
      wasCapped: false,
      uncappedBetSize: 0,
    }
  }

  if (!meetsMinEdge) {
    warnings.push({
      type: 'edge_marginal',
      message: `Edge ${edgePercent.toFixed(1)}% below minimum ${(minEdgeRequired * 100).toFixed(0)}%`,
      severity: 'info',
    })

    return {
      optimalBetSize: 0,
      fullKellyFraction,
      adjustedKellyFraction: 0,
      fractionUsed: kellyFraction,
      edgePercent,
      hasPositiveEdge: true,
      shouldBet: false,
      reason: `Edge too small (${edgePercent.toFixed(1)}% < ${(minEdgeRequired * 100).toFixed(0)}%)`,
      expectedGrowthRate: 0,
      impliedProbability,
      overlayPercent,
      warnings,
      wasCapped: false,
      uncappedBetSize: 0,
    }
  }

  // Apply fractional Kelly
  const fractionValue = KELLY_FRACTION_VALUES[kellyFraction]
  const adjustedKellyFraction = fullKellyFraction * fractionValue

  // Calculate bet size
  let optimalBetSize = bankroll * adjustedKellyFraction
  const uncappedBetSize = optimalBetSize

  // Check if Kelly is too aggressive (> 25% of bankroll)
  if (fullKellyFraction > 0.25) {
    warnings.push({
      type: 'bet_too_aggressive',
      message: `Full Kelly ${(fullKellyFraction * 100).toFixed(1)}% is aggressive`,
      severity: 'warning',
    })
  }

  // Apply maximum bet cap
  const maxBetAmount = bankroll * maxBetPercent
  let wasCapped = false

  if (optimalBetSize > maxBetAmount) {
    optimalBetSize = maxBetAmount
    wasCapped = true
    warnings.push({
      type: 'bet_capped',
      message: `Bet capped at ${(maxBetPercent * 100).toFixed(0)}% of bankroll`,
      severity: 'info',
    })
  }

  // Ensure minimum bet
  if (optimalBetSize < MIN_BET_AMOUNT) {
    if (bankroll < MIN_BET_AMOUNT) {
      warnings.push({
        type: 'bankroll_low',
        message: `Bankroll $${bankroll.toFixed(2)} below minimum bet $${MIN_BET_AMOUNT}`,
        severity: 'warning',
      })
      return {
        optimalBetSize: 0,
        fullKellyFraction,
        adjustedKellyFraction,
        fractionUsed: kellyFraction,
        edgePercent,
        hasPositiveEdge: true,
        shouldBet: false,
        reason: 'Bankroll too small for minimum bet',
        expectedGrowthRate: 0,
        impliedProbability,
        overlayPercent,
        warnings,
        wasCapped,
        uncappedBetSize,
      }
    }
    optimalBetSize = MIN_BET_AMOUNT
  }

  // Round to whole dollar
  optimalBetSize = Math.round(optimalBetSize)

  // Add marginal edge warning if applicable
  if (edge < MARGINAL_EDGE_THRESHOLD && edge > 0) {
    warnings.push({
      type: 'edge_marginal',
      message: `Edge ${edgePercent.toFixed(1)}% is marginal`,
      severity: 'info',
    })
  }

  return {
    optimalBetSize,
    fullKellyFraction,
    adjustedKellyFraction,
    fractionUsed: kellyFraction,
    edgePercent,
    hasPositiveEdge: true,
    shouldBet: true,
    reason: null,
    expectedGrowthRate,
    impliedProbability,
    overlayPercent,
    warnings,
    wasCapped,
    uncappedBetSize,
  }
}

/**
 * Calculate expected bankroll growth rate
 *
 * g = p * log(1 + b*f) + q * log(1 - f)
 */
function calculateExpectedGrowthRate(p: number, b: number, f: number): number {
  if (f <= 0 || f >= 1) return 0

  try {
    const growth = p * Math.log(1 + b * f) + (1 - p) * Math.log(1 - f)
    return growth
  } catch {
    return 0
  }
}

/**
 * Create a zero result for invalid inputs
 */
function createZeroResult(kellyFraction: KellyFraction, reason: string): KellyResult {
  return {
    optimalBetSize: 0,
    fullKellyFraction: 0,
    adjustedKellyFraction: 0,
    fractionUsed: kellyFraction,
    edgePercent: 0,
    hasPositiveEdge: false,
    shouldBet: false,
    reason,
    expectedGrowthRate: 0,
    impliedProbability: 0,
    overlayPercent: 0,
    warnings: [],
    wasCapped: false,
    uncappedBetSize: 0,
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert American odds to decimal odds
 *
 * Positive American odds (+150): decimal = (odds/100) + 1 = 2.50
 * Negative American odds (-150): decimal = (100/|odds|) + 1 = 1.67
 */
export function americanToDecimal(americanOdds: number): number {
  if (americanOdds >= 100) {
    return americanOdds / 100 + 1
  } else if (americanOdds <= -100) {
    return 100 / Math.abs(americanOdds) + 1
  }
  return 2.0 // Default to even money for invalid odds
}

/**
 * Convert fractional odds to decimal odds
 *
 * 5/1 = 6.00 (5 + 1)
 * 9/2 = 5.50 (9/2 + 1)
 */
export function fractionalToDecimal(numerator: number, denominator: number): number {
  if (denominator === 0) return 2.0
  return numerator / denominator + 1
}

/**
 * Parse morning line odds string to decimal odds
 *
 * Handles: "5-1", "9/2", "3-2", "4-5", "1-5"
 */
export function parseOddsToDecimal(oddsString: string): number {
  if (!oddsString || typeof oddsString !== 'string') {
    return 2.0
  }

  const cleanOdds = oddsString.trim()

  // Handle "X-Y" format (e.g., "5-1", "4-5")
  const dashMatch = cleanOdds.match(/^(\d+)-(\d+)$/)
  if (dashMatch) {
    const num = parseInt(dashMatch[1], 10)
    const den = parseInt(dashMatch[2], 10)
    if (den > 0) {
      return num / den + 1
    }
  }

  // Handle "X/Y" format (e.g., "5/1", "9/2")
  const slashMatch = cleanOdds.match(/^(\d+)\/(\d+)$/)
  if (slashMatch) {
    const num = parseInt(slashMatch[1], 10)
    const den = parseInt(slashMatch[2], 10)
    if (den > 0) {
      return num / den + 1
    }
  }

  // Handle "Even" or "EVN"
  if (/^even$/i.test(cleanOdds) || /^evn$/i.test(cleanOdds)) {
    return 2.0
  }

  // Handle pure decimal (e.g., "5.0")
  const decimal = parseFloat(cleanOdds)
  if (!isNaN(decimal) && decimal > 1) {
    return decimal
  }

  return 2.0 // Default
}

/**
 * Convert confidence score (0-100) to win probability (0-1)
 *
 * Note: Confidence is NOT directly win probability.
 * This is an approximation based on handicapping score.
 */
export function confidenceToWinProbability(confidence: number, fieldSize: number = 10): number {
  // Clamp confidence
  const clampedConfidence = Math.max(0, Math.min(100, confidence))

  // Base probability from confidence (roughly)
  // High confidence (85+) = ~25-35% win probability
  // Good confidence (70-84) = ~15-25% win probability
  // Moderate confidence (55-69) = ~8-15% win probability
  // Low confidence (<55) = ~3-8% win probability

  let baseProbability: number

  if (clampedConfidence >= 85) {
    // Elite: 25-40%
    baseProbability = 0.25 + (clampedConfidence - 85) * 0.01
  } else if (clampedConfidence >= 70) {
    // Strong: 15-25%
    baseProbability = 0.15 + (clampedConfidence - 70) * 0.0067
  } else if (clampedConfidence >= 55) {
    // Good: 8-15%
    baseProbability = 0.08 + (clampedConfidence - 55) * 0.0047
  } else if (clampedConfidence >= 40) {
    // Fair: 4-8%
    baseProbability = 0.04 + (clampedConfidence - 40) * 0.0027
  } else {
    // Poor: 1-4%
    baseProbability = 0.01 + clampedConfidence * 0.00075
  }

  // Adjust for field size (larger fields = lower individual probability)
  const fieldAdjustment = 10 / Math.max(5, fieldSize)
  baseProbability *= fieldAdjustment

  // Clamp to reasonable range
  return Math.max(0.01, Math.min(0.50, baseProbability))
}

/**
 * Get Kelly settings for a given risk tolerance
 */
export function getKellySettingsForRisk(riskTolerance: RiskToleranceKelly): Partial<KellySettings> {
  switch (riskTolerance) {
    case 'conservative':
      return {
        kellyFraction: 'quarter',
        maxBetPercent: 5,
        minEdgeRequired: 15,
      }
    case 'moderate':
      return {
        kellyFraction: 'half',
        maxBetPercent: 10,
        minEdgeRequired: 10,
      }
    case 'aggressive':
      return {
        kellyFraction: 'full',
        maxBetPercent: 15,
        minEdgeRequired: 5,
      }
    default:
      return {
        kellyFraction: 'quarter',
        maxBetPercent: 10,
        minEdgeRequired: 10,
      }
  }
}

/**
 * Format Kelly result for display
 */
export function formatKellyResult(result: KellyResult): {
  betSize: string
  fraction: string
  edge: string
  growth: string
  overlay: string
} {
  return {
    betSize: `$${result.optimalBetSize}`,
    fraction: KELLY_FRACTION_LABELS[result.fractionUsed],
    edge: `${result.edgePercent >= 0 ? '+' : ''}${result.edgePercent.toFixed(1)}%`,
    growth: `${(result.expectedGrowthRate * 100).toFixed(2)}%`,
    overlay: `${result.overlayPercent >= 0 ? '+' : ''}${result.overlayPercent.toFixed(1)}%`,
  }
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

export interface BatchKellyInput {
  /** Unique identifier for the bet */
  id: string
  /** Win probability as decimal */
  winProbability: number
  /** Decimal odds */
  decimalOdds: number
  /** Optional: override bankroll for this bet */
  bankroll?: number
}

export interface BatchKellyResult {
  /** Kelly results for each bet */
  results: Map<string, KellyResult>
  /** Total recommended investment */
  totalInvestment: number
  /** Bets that passed Kelly filter */
  recommendedBets: string[]
  /** Bets that failed Kelly filter */
  passedBets: string[]
  /** Expected portfolio growth */
  portfolioGrowthRate: number
}

/**
 * Calculate Kelly for multiple bets
 */
export function calculateBatchKelly(
  bets: BatchKellyInput[],
  bankroll: number,
  settings: Partial<KellySettings> = {}
): BatchKellyResult {
  const results = new Map<string, KellyResult>()
  const recommendedBets: string[] = []
  const passedBets: string[] = []
  let totalInvestment = 0

  for (const bet of bets) {
    const result = calculateKelly({
      winProbability: bet.winProbability,
      decimalOdds: bet.decimalOdds,
      bankroll: bet.bankroll ?? bankroll,
      kellyFraction: settings.kellyFraction as KellyFraction ?? 'quarter',
      maxBetPercent: (settings.maxBetPercent ?? 10) / 100,
      minEdgeRequired: (settings.minEdgeRequired ?? 10) / 100,
    })

    results.set(bet.id, result)

    if (result.shouldBet) {
      recommendedBets.push(bet.id)
      totalInvestment += result.optimalBetSize
    } else {
      passedBets.push(bet.id)
    }
  }

  // Calculate portfolio growth rate (simplified - assumes independent bets)
  const portfolioGrowthRate = Array.from(results.values())
    .filter(r => r.shouldBet)
    .reduce((sum, r) => sum + r.expectedGrowthRate, 0)

  return {
    results,
    totalInvestment,
    recommendedBets,
    passedBets,
    portfolioGrowthRate,
  }
}
