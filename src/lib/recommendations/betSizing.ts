/**
 * Bet Sizing Module
 *
 * Calculate bet amounts based on bankroll settings:
 * - Reads from useBankroll hook settings
 * - Supports Simple, Moderate, and Advanced modes
 * - Applies tier allocations based on betting style
 * - Implements Kelly Criterion for optimal bet sizing (Advanced mode)
 *
 * @module recommendations/betSizing
 */

import type { UseBankrollReturn, BettingStyle, ComplexityMode, RiskTolerance } from '../../hooks/useBankroll'
import type { BettingTier } from '../betting/tierClassification'
import type { GeneratedBet } from './betGenerator'
import { logger } from '../../services/logging'
import {
  calculateKelly,
  parseOddsToDecimal,
  confidenceToWinProbability,
  formatKellyResult,
  KELLY_FRACTION_VALUES,
  type KellyResult,
  type KellyInput,
} from '../betting/kellyCriterion'
import {
  type KellySettings,
  type KellyFraction,
  loadKellySettings,
  getKellyFractionLabel,
} from '../betting/kellySettings'

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
  /** Kelly settings if enabled */
  kellySettings?: KellySettings
}

/** Result from Kelly-based bet sizing */
export interface KellyBetSizingResult {
  /** Kelly-calculated bet amount */
  kellyAmount: number
  /** Tier-based bet amount (alternative) */
  tierAmount: number
  /** Which sizing method is active */
  activeMethod: 'kelly' | 'tier'
  /** Kelly result details */
  kellyResult: KellyResult | null
  /** Display info for UI */
  display: {
    recommended: string
    alternative: string
    kellyFraction: string
    edge: string
    shouldBet: boolean
    warnings: string[]
  }
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

  // Load Kelly settings (only used in Advanced mode)
  const kellySettings = mode === 'advanced' ? loadKellySettings() : undefined

  return {
    raceBudget: bankroll.getRaceBudget(),
    mode,
    bettingStyle: simpleSettings.bettingStyle,
    riskTolerance: mode === 'simple'
      ? (simpleSettings.bettingStyle === 'safe' ? 'conservative'
        : simpleSettings.bettingStyle === 'balanced' ? 'moderate' : 'aggressive')
      : moderateSettings.riskLevel,
    unitSize: bankroll.getUnitSize(),
    kellySettings,
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
 * Calculate bet amount using Kelly Criterion
 * Now uses the full Kelly module for proper calculations
 *
 * @param winProbability - Win probability (0-1 or 0-100)
 * @param odds - Decimal odds or odds string (e.g., "5-1")
 * @param bankroll - Current bankroll
 * @param fractionKelly - Kelly fraction (0.25, 0.5, 1.0) - deprecated, use settings
 * @param settings - Optional Kelly settings
 */
export function calculateKellyBetAmount(
  winProbability: number,
  odds: number | string,
  bankroll: number,
  fractionKelly: number = 0.25, // Use quarter Kelly for safety
  settings?: Partial<KellySettings>
): number {
  // Convert odds if string
  const decimalOdds = typeof odds === 'string' ? parseOddsToDecimal(odds) : odds

  // Normalize probability (if > 1, assume percentage)
  const normalizedProb = winProbability > 1 ? winProbability / 100 : winProbability

  // Determine Kelly fraction to use
  let kellyFraction: KellyFraction = 'quarter'
  if (settings?.kellyFraction) {
    kellyFraction = settings.kellyFraction
  } else if (fractionKelly >= 0.9) {
    kellyFraction = 'full'
  } else if (fractionKelly >= 0.4) {
    kellyFraction = 'half'
  }

  // Calculate using Kelly module
  const result = calculateKelly({
    winProbability: normalizedProb,
    decimalOdds,
    bankroll,
    kellyFraction,
    maxBetPercent: (settings?.maxBetPercent ?? 10) / 100,
    minEdgeRequired: (settings?.minEdgeRequired ?? 5) / 100,
  })

  return result.optimalBetSize
}

/**
 * Calculate bet sizing with both Kelly and tier-based methods
 * Returns both options for display in UI
 */
export function calculateBetWithKelly(
  confidence: number,
  oddsString: string,
  tier: BettingTier,
  bankroll: UseBankrollReturn,
  fieldSize: number = 10
): KellyBetSizingResult {
  const config = getBetSizingConfig(bankroll)
  const kellySettings = config.kellySettings

  // Calculate tier-based amount (always available)
  const tierAmount = calculateBetAmount(confidence, tier, bankroll)

  // If Kelly not enabled or not in Advanced mode, just return tier amount
  if (!kellySettings?.enabled || config.mode !== 'advanced') {
    return {
      kellyAmount: 0,
      tierAmount,
      activeMethod: 'tier',
      kellyResult: null,
      display: {
        recommended: `$${tierAmount}`,
        alternative: '',
        kellyFraction: '',
        edge: '',
        shouldBet: true,
        warnings: [],
      },
    }
  }

  // Parse odds
  const decimalOdds = parseOddsToDecimal(oddsString)

  // Convert confidence to win probability
  const winProbability = confidenceToWinProbability(confidence, fieldSize)

  // Calculate Kelly
  const kellyResult = calculateKelly({
    winProbability,
    decimalOdds,
    bankroll: bankroll.settings.totalBankroll,
    kellyFraction: kellySettings.kellyFraction,
    maxBetPercent: kellySettings.maxBetPercent / 100,
    minEdgeRequired: kellySettings.minEdgeRequired / 100,
  })

  // Get formatted display
  const formatted = formatKellyResult(kellyResult)
  const warnings = kellyResult.warnings.map(w => w.message)

  // Determine which is active
  const activeMethod = kellySettings.enabled ? 'kelly' : 'tier'
  const kellyAmount = kellyResult.shouldBet ? kellyResult.optimalBetSize : 0

  return {
    kellyAmount,
    tierAmount,
    activeMethod,
    kellyResult,
    display: {
      recommended: activeMethod === 'kelly'
        ? `$${kellyAmount} (${getKellyFractionLabel(kellySettings.kellyFraction)})`
        : `$${tierAmount} (Tier allocation)`,
      alternative: activeMethod === 'kelly'
        ? `$${tierAmount} (Tier allocation)`
        : kellyResult.shouldBet
          ? `$${kellyAmount} (${getKellyFractionLabel(kellySettings.kellyFraction)})`
          : 'Kelly suggests pass',
      kellyFraction: formatted.fraction,
      edge: formatted.edge,
      shouldBet: kellyResult.shouldBet,
      warnings,
    },
  }
}

/**
 * Check if Kelly Criterion is enabled for current settings
 */
export function isKellyEnabled(bankroll: UseBankrollReturn): boolean {
  const config = getBetSizingConfig(bankroll)
  return config.mode === 'advanced' && (config.kellySettings?.enabled ?? false)
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
export type { KellySettings, KellyFraction, KellyResult }
