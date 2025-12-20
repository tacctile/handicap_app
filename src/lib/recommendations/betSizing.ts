/**
 * Bet Sizing Module
 *
 * Calculate bet amounts based on bankroll settings:
 * - Reads from useBankroll hook settings
 * - Supports Simple, Moderate, and Advanced modes
 * - Applies tier allocations based on betting style
 * - Implements Kelly Criterion placeholder for Phase 3
 *
 * @module recommendations/betSizing
 */

import type { UseBankrollReturn, BettingStyle, ComplexityMode, RiskTolerance } from '../../hooks/useBankroll'
import type { BettingTier } from '../betting/tierClassification'
import type { GeneratedBet } from './betGenerator'
import { logger } from '../../services/logging'

// ============================================================================
// TYPES
// ============================================================================

export interface BetSizingConfig {
  /** Race budget for this race */
  raceBudget: number
  /** Complexity mode */
  mode: ComplexityMode
  /** Betting style (for simple mode) */
  bettingStyle: BettingStyle
  /** Risk tolerance (for moderate/advanced) */
  riskTolerance: RiskTolerance
  /** Base unit size */
  unitSize: number
}

export interface TierAllocation {
  tier1: number
  tier2: number
  tier3: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Simple Mode allocations by betting style
 * Percentages of race budget allocated to each tier
 */
export const SIMPLE_MODE_ALLOCATIONS: Record<BettingStyle, TierAllocation> = {
  safe: { tier1: 70, tier2: 30, tier3: 0 },
  balanced: { tier1: 40, tier2: 35, tier3: 25 },
  aggressive: { tier1: 20, tier2: 30, tier3: 50 },
}

/**
 * Moderate Mode allocations by risk level
 */
export const MODERATE_MODE_ALLOCATIONS: Record<RiskTolerance, TierAllocation> = {
  conservative: { tier1: 60, tier2: 30, tier3: 10 },
  moderate: { tier1: 45, tier2: 35, tier3: 20 },
  aggressive: { tier1: 25, tier2: 35, tier3: 40 },
}

/**
 * Advanced Mode uses the same as moderate but with Kelly adjustment
 */
export const ADVANCED_MODE_ALLOCATIONS = MODERATE_MODE_ALLOCATIONS

/**
 * Tier multipliers for bet sizing
 */
export const TIER_MULTIPLIERS: Record<BettingTier, number> = {
  tier1: 1.5,
  tier2: 1.0,
  tier3: 0.5,
}

/**
 * Confidence-based multipliers
 */
export const CONFIDENCE_MULTIPLIERS = {
  elite: { min: 85, multiplier: 2.0 },
  strong: { min: 75, multiplier: 1.5 },
  good: { min: 65, multiplier: 1.0 },
  fair: { min: 55, multiplier: 0.75 },
  weak: { min: 0, multiplier: 0.5 },
} as const

/**
 * Risk tolerance multipliers
 */
export const RISK_MULTIPLIERS: Record<RiskTolerance, number> = {
  conservative: 0.6,
  moderate: 1.0,
  aggressive: 1.5,
}

/**
 * Minimum and maximum bet amounts
 */
export const BET_LIMITS = {
  min: 1,
  max: 100,
  superfectaMin: 0.1,
  superfectaMax: 1,
} as const

// ============================================================================
// CORE SIZING FUNCTIONS
// ============================================================================

/**
 * Get bet sizing configuration from bankroll hook
 */
export function getBetSizingConfig(bankroll: UseBankrollReturn): BetSizingConfig {
  const mode = bankroll.getComplexityMode()
  const simpleSettings = bankroll.getSimpleSettings()
  const moderateSettings = bankroll.getModerateSettings()

  return {
    raceBudget: bankroll.getRaceBudget(),
    mode,
    bettingStyle: simpleSettings.bettingStyle,
    riskTolerance: mode === 'simple'
      ? (simpleSettings.bettingStyle === 'safe' ? 'conservative'
        : simpleSettings.bettingStyle === 'balanced' ? 'moderate' : 'aggressive')
      : moderateSettings.riskLevel,
    unitSize: bankroll.getUnitSize(),
  }
}

/**
 * Get tier allocation based on bankroll settings
 */
export function getTierAllocation(bankroll: UseBankrollReturn): TierAllocation {
  const mode = bankroll.getComplexityMode()

  switch (mode) {
    case 'simple': {
      const style = bankroll.getSimpleSettings().bettingStyle
      return SIMPLE_MODE_ALLOCATIONS[style]
    }
    case 'moderate': {
      const risk = bankroll.getModerateSettings().riskLevel
      return MODERATE_MODE_ALLOCATIONS[risk]
    }
    case 'advanced': {
      const settings = bankroll.settings
      return ADVANCED_MODE_ALLOCATIONS[settings.riskTolerance]
    }
    default:
      return SIMPLE_MODE_ALLOCATIONS.balanced
  }
}

/**
 * Get confidence multiplier based on confidence percentage
 */
export function getConfidenceMultiplier(confidence: number): number {
  if (confidence >= CONFIDENCE_MULTIPLIERS.elite.min) {
    return CONFIDENCE_MULTIPLIERS.elite.multiplier
  }
  if (confidence >= CONFIDENCE_MULTIPLIERS.strong.min) {
    return CONFIDENCE_MULTIPLIERS.strong.multiplier
  }
  if (confidence >= CONFIDENCE_MULTIPLIERS.good.min) {
    return CONFIDENCE_MULTIPLIERS.good.multiplier
  }
  if (confidence >= CONFIDENCE_MULTIPLIERS.fair.min) {
    return CONFIDENCE_MULTIPLIERS.fair.multiplier
  }
  return CONFIDENCE_MULTIPLIERS.weak.multiplier
}

/**
 * Calculate bet amount for a single bet
 */
export function calculateBetAmount(
  confidence: number,
  tier: BettingTier,
  bankroll: UseBankrollReturn
): number {
  try {
    const config = getBetSizingConfig(bankroll)
    const allocation = getTierAllocation(bankroll)

    // Base amount from unit size
    const baseAmount = config.unitSize

    // Tier multiplier
    const tierMultiplier = TIER_MULTIPLIERS[tier]

    // Risk multiplier
    const riskMultiplier = RISK_MULTIPLIERS[config.riskTolerance]

    // Confidence multiplier
    const confMultiplier = getConfidenceMultiplier(confidence)

    // Calculate raw amount
    let amount = baseAmount * tierMultiplier * riskMultiplier * confMultiplier

    // Apply tier allocation cap
    const tierBudget = (config.raceBudget * allocation[tier]) / 100
    const maxPerBet = tierBudget / 3 // Assume ~3 bets per tier

    amount = Math.min(amount, maxPerBet)

    // Apply global limits
    amount = Math.max(BET_LIMITS.min, Math.min(BET_LIMITS.max, amount))

    // Round to whole dollar
    return Math.round(amount)
  } catch (error) {
    logger.logWarning('Error calculating bet amount, using default', {
      component: 'betSizing',
      confidence,
      tier,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return 5 // Safe default
  }
}

/**
 * Calculate bet amount using Kelly Criterion (placeholder for Phase 3)
 * Kelly formula: f* = (bp - q) / b
 * where b = odds, p = win probability, q = 1-p
 */
export function calculateKellyBetAmount(
  winProbability: number,
  odds: number,
  bankroll: number,
  fractionKelly: number = 0.25 // Use quarter Kelly for safety
): number {
  // Convert American odds to decimal if needed
  const decimalOdds = odds

  // Calculate Kelly fraction
  const b = decimalOdds
  const p = winProbability
  const q = 1 - p

  const kellyFraction = (b * p - q) / b

  // Apply fractional Kelly for safety
  const adjustedKelly = kellyFraction * fractionKelly

  // Don't bet if Kelly is negative
  if (adjustedKelly <= 0) return 0

  // Calculate bet amount
  let amount = bankroll * adjustedKelly

  // Apply limits
  amount = Math.max(BET_LIMITS.min, Math.min(bankroll * 0.05, amount)) // Max 5% of bankroll

  return Math.round(amount)
}

// ============================================================================
// BET SCALING FUNCTIONS
// ============================================================================

/**
 * Scale all bets by bankroll settings
 */
export function scaleBetsByBankroll(
  bets: GeneratedBet[],
  bankroll: UseBankrollReturn
): GeneratedBet[] {
  try {
    const config = getBetSizingConfig(bankroll)
    const allocation = getTierAllocation(bankroll)

    // Calculate current totals by tier
    const tierTotals: Record<BettingTier, number> = {
      tier1: 0,
      tier2: 0,
      tier3: 0,
    }

    for (const bet of bets) {
      tierTotals[bet.tier] += bet.totalCost
    }

    // Calculate target budgets by tier
    const tierBudgets: Record<BettingTier, number> = {
      tier1: (config.raceBudget * allocation.tier1) / 100,
      tier2: (config.raceBudget * allocation.tier2) / 100,
      tier3: (config.raceBudget * allocation.tier3) / 100,
    }

    // Scale bets to fit within tier budgets
    return bets.map(bet => {
      const currentTotal = tierTotals[bet.tier]
      const targetBudget = tierBudgets[bet.tier]

      if (currentTotal === 0 || targetBudget === 0) {
        return bet
      }

      // Calculate scale factor
      const scaleFactor = Math.min(1, targetBudget / currentTotal)

      // Apply scaling
      const newAmount = Math.max(
        bet.type === 'superfecta' ? BET_LIMITS.superfectaMin : BET_LIMITS.min,
        Math.round(bet.amount * scaleFactor * 100) / 100
      )

      const newTotalCost = recalculateTotalCost(bet.type, bet.horses.length, newAmount)

      return {
        ...bet,
        amount: newAmount,
        totalCost: newTotalCost,
        potentialReturn: scaleReturn(bet.potentialReturn, newTotalCost / bet.totalCost),
      }
    })
  } catch (error) {
    logger.logWarning('Error scaling bets, returning original', {
      component: 'betSizing',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return bets
  }
}

/**
 * Recalculate total cost after amount change
 */
function recalculateTotalCost(type: string, numHorses: number, amount: number): number {
  switch (type) {
    case 'exacta_box':
      return numHorses * (numHorses - 1) * amount
    case 'exacta_key_over':
    case 'exacta_key_under':
      return (numHorses - 1) * amount
    case 'trifecta_box':
      return numHorses * (numHorses - 1) * (numHorses - 2) * amount
    case 'trifecta_key':
    case 'trifecta_wheel':
      return Math.max(1, (numHorses - 1) * 2 * amount)
    case 'superfecta':
      return numHorses >= 4 ? 2.40 : numHorses * amount
    default:
      return amount
  }
}

/**
 * Scale potential return by a factor
 */
function scaleReturn(
  potentialReturn: { min: number; max: number },
  factor: number
): { min: number; max: number } {
  return {
    min: Math.round(potentialReturn.min * factor),
    max: Math.round(potentialReturn.max * factor),
  }
}

// ============================================================================
// BUDGET VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if bets fit within race budget
 */
export function validateBudget(
  bets: GeneratedBet[],
  bankroll: UseBankrollReturn
): { isValid: boolean; overage: number; message: string | null } {
  const raceBudget = bankroll.getRaceBudget()
  const totalCost = bets.reduce((sum, bet) => sum + bet.totalCost, 0)

  if (totalCost <= raceBudget) {
    return { isValid: true, overage: 0, message: null }
  }

  const overage = totalCost - raceBudget
  return {
    isValid: false,
    overage,
    message: `Bets exceed budget by $${overage.toFixed(2)}. Consider reducing selections.`,
  }
}

/**
 * Get remaining budget after selected bets
 */
export function getRemainingBudget(
  selectedBets: GeneratedBet[],
  bankroll: UseBankrollReturn
): number {
  const raceBudget = bankroll.getRaceBudget()
  const totalCost = selectedBets.reduce((sum, bet) => sum + bet.totalCost, 0)
  return Math.max(0, raceBudget - totalCost)
}

/**
 * Calculate optimal bet distribution to maximize coverage within budget
 */
export function optimizeBetDistribution(
  bets: GeneratedBet[],
  bankroll: UseBankrollReturn
): GeneratedBet[] {
  const raceBudget = bankroll.getRaceBudget()
  const allocation = getTierAllocation(bankroll)

  // Sort bets by priority (tier 1 > positive EV > tier 2 > tier 3)
  const sortedBets = [...bets].sort((a, b) => {
    // Nuclear longshots get priority
    if (a.specialCategory === 'nuclear' && b.specialCategory !== 'nuclear') return -1
    if (b.specialCategory === 'nuclear' && a.specialCategory !== 'nuclear') return 1

    // Then by tier
    const tierOrder = { tier1: 0, tier2: 1, tier3: 2 }
    if (tierOrder[a.tier] !== tierOrder[b.tier]) {
      return tierOrder[a.tier] - tierOrder[b.tier]
    }

    // Then by EV
    return b.evPerDollar - a.evPerDollar
  })

  // Allocate budget by tier
  const tierBudgets: Record<BettingTier, number> = {
    tier1: (raceBudget * allocation.tier1) / 100,
    tier2: (raceBudget * allocation.tier2) / 100,
    tier3: (raceBudget * allocation.tier3) / 100,
  }

  const tierSpent: Record<BettingTier, number> = {
    tier1: 0,
    tier2: 0,
    tier3: 0,
  }

  // Filter bets that fit within tier budgets
  return sortedBets.filter(bet => {
    const wouldExceed = tierSpent[bet.tier] + bet.totalCost > tierBudgets[bet.tier]
    if (!wouldExceed) {
      tierSpent[bet.tier] += bet.totalCost
      return true
    }
    return false
  })
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { BettingTier }
