/**
 * Exotic Bet Optimizer
 *
 * Optimizes exotic bet structure for a given budget:
 * - Compares key vs box structures
 * - Calculates expected value for each option
 * - Finds highest EV combination within budget
 * - Suggests optimal base bet amounts
 *
 * Usage:
 * - optimizeExoticBet: Main optimization function
 * - findBestStructure: Find best structure for given horses and budget
 * - suggestBaseBet: Suggest optimal base bet amount
 */

import { validateNumber } from '../sanitization'
import {
  calculateExactaBoxCost,
  calculateExactaKeyOverCost,
  calculateTrifectaBoxCost,
  calculateTrifectaPartWheelCost,
  calculateSuperfectaBoxCost,
  calculateSuperfectaKeyCost,
  type ExoticBetType,
  type BetStructure,
  BASE_BET_OPTIONS,
  MIN_HORSES,
} from './exoticCalculator'

// ============================================================================
// TYPES
// ============================================================================

export interface HorseTier {
  /** Program number */
  programNumber: number
  /** Horse name */
  horseName: string
  /** Tier: 1 = high confidence, 2 = medium, 3 = low */
  tier: 1 | 2 | 3
  /** Win probability estimate (0-1) */
  winProbability: number
  /** Current odds */
  odds: number
  /** Confidence score (0-100) */
  confidence: number
}

export interface OptimizationConfig {
  /** Budget amount for this exotic bet */
  budget: number
  /** Tier 1 horses (high confidence) */
  tier1Horses: HorseTier[]
  /** Tier 2 horses (medium confidence) */
  tier2Horses: HorseTier[]
  /** Tier 3 horses (lower confidence value plays) */
  tier3Horses?: HorseTier[]
  /** Preferred bet type */
  betType: ExoticBetType
  /** Total field size */
  fieldSize: number
  /** Whether to include wheel options */
  includeWheels?: boolean
  /** Maximum base bet to consider */
  maxBaseBet?: number
}

export interface OptimizedBetOption {
  /** Unique ID for this option */
  id: string
  /** Structure type */
  structure: BetStructure
  /** Description of the bet */
  description: string
  /** Cost calculation result */
  cost: ExoticCost
  /** Expected value per dollar */
  expectedValue: number
  /** Hit probability (estimate) */
  hitProbability: number
  /** Horses used in first position */
  firstHorses: number[]
  /** Horses used in second position */
  secondHorses: number[]
  /** Horses used in third position (if applicable) */
  thirdHorses: number[]
  /** Horses used in fourth position (if applicable) */
  fourthHorses: number[]
  /** Recommended base bet */
  baseBet: number
  /** Budget remaining after this bet */
  budgetRemaining: number
  /** Whether this is the recommended option */
  isRecommended: boolean
  /** Reasoning for recommendation or not */
  reasoning: string
}

export interface OptimizationResult {
  /** All viable options sorted by EV */
  options: OptimizedBetOption[]
  /** The recommended option */
  recommended: OptimizedBetOption | null
  /** Budget used */
  budgetUsed: number
  /** Budget remaining */
  budgetRemaining: number
  /** Summary text */
  summary: string
  /** Whether optimization succeeded */
  isValid: boolean
  /** Error message if not valid */
  error?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Expected payout multipliers (track takeout adjusted) */
const PAYOUT_MULTIPLIERS: Record<ExoticBetType, number> = {
  exacta: 1.2,
  trifecta: 2.5,
  superfecta: 8,
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate win probability from odds
 */
function oddsToWinProb(odds: number): number {
  if (odds <= 0) return 0.5
  // Convert decimal odds to implied probability with juice adjustment
  const impliedProb = 1 / (odds + 1)
  return Math.min(0.7, impliedProb * 1.1) // Slight adjustment for public bias
}

/**
 * Calculate exacta probability
 * P(A first, B second) = P(A wins) × P(B second | A wins)
 */
function calculateExactaProbability(
  firstHorses: HorseTier[],
  secondHorses: HorseTier[]
): number {
  if (firstHorses.length === 0 || secondHorses.length === 0) return 0

  let totalProb = 0
  for (const first of firstHorses) {
    const firstWinProb = first.winProbability || oddsToWinProb(first.odds)
    for (const second of secondHorses) {
      if (first.programNumber === second.programNumber) continue
      // Conditional probability of second given first won
      const secondProb = (second.winProbability || oddsToWinProb(second.odds)) * 1.3
      totalProb += firstWinProb * secondProb
    }
  }
  return Math.min(0.5, totalProb)
}

/**
 * Calculate trifecta probability
 */
function calculateTrifectaProbability(
  firstHorses: HorseTier[],
  secondHorses: HorseTier[],
  thirdHorses: HorseTier[]
): number {
  if (firstHorses.length === 0 || secondHorses.length === 0 || thirdHorses.length === 0) return 0

  let totalProb = 0
  for (const first of firstHorses) {
    const firstWinProb = first.winProbability || oddsToWinProb(first.odds)
    for (const second of secondHorses) {
      if (first.programNumber === second.programNumber) continue
      const secondProb = (second.winProbability || oddsToWinProb(second.odds)) * 1.2
      for (const third of thirdHorses) {
        if (
          third.programNumber === first.programNumber ||
          third.programNumber === second.programNumber
        ) continue
        const thirdProb = (third.winProbability || oddsToWinProb(third.odds)) * 1.1
        totalProb += firstWinProb * secondProb * thirdProb
      }
    }
  }
  return Math.min(0.25, totalProb)
}

/**
 * Calculate superfecta probability
 */
function calculateSuperfectaProbability(
  firstHorses: HorseTier[],
  secondHorses: HorseTier[],
  thirdHorses: HorseTier[],
  fourthHorses: HorseTier[]
): number {
  if (
    firstHorses.length === 0 ||
    secondHorses.length === 0 ||
    thirdHorses.length === 0 ||
    fourthHorses.length === 0
  ) return 0

  // Simplified calculation for superfecta
  const baseProb = calculateTrifectaProbability(firstHorses, secondHorses, thirdHorses)
  const fourthFactor = fourthHorses.reduce((sum, h) => {
    return sum + (h.winProbability || oddsToWinProb(h.odds))
  }, 0) / fourthHorses.length

  return Math.min(0.1, baseProb * fourthFactor * 0.8)
}

/**
 * Estimate expected payout based on odds
 */
function estimateExpectedPayout(
  betType: ExoticBetType,
  horses: HorseTier[],
  baseBet: number
): { min: number; max: number; likely: number } {
  if (horses.length === 0) {
    return { min: 0, max: 0, likely: 0 }
  }

  const multiplier = PAYOUT_MULTIPLIERS[betType]
  const avgOdds = horses.reduce((sum, h) => sum + h.odds, 0) / horses.length
  const maxOdds = Math.max(...horses.map(h => h.odds))
  const minOdds = Math.min(...horses.map(h => h.odds))

  switch (betType) {
    case 'exacta':
      return {
        min: Math.round(baseBet * minOdds * 1.5 * multiplier),
        max: Math.round(baseBet * maxOdds * avgOdds * multiplier),
        likely: Math.round(baseBet * avgOdds * 2 * multiplier),
      }
    case 'trifecta':
      return {
        min: Math.round(baseBet * minOdds * 3 * multiplier),
        max: Math.round(baseBet * maxOdds * avgOdds * 5 * multiplier),
        likely: Math.round(baseBet * avgOdds * 8 * multiplier),
      }
    case 'superfecta':
      return {
        min: Math.round(baseBet * minOdds * 10 * multiplier),
        max: Math.round(baseBet * maxOdds * avgOdds * maxOdds * multiplier),
        likely: Math.round(baseBet * avgOdds * 40 * multiplier),
      }
    default:
      return { min: 0, max: 0, likely: 0 }
  }
}

/**
 * Calculate expected value
 * EV = (probability × expected payout) - cost
 */
function calculateExpectedValue(
  hitProbability: number,
  expectedPayout: number,
  cost: number
): number {
  return (hitProbability * expectedPayout) - cost
}

/**
 * Find optimal base bet for budget
 */
function findOptimalBaseBet(
  budget: number,
  combinations: number,
  maxBaseBet: number = 5
): number {
  const availableBets = BASE_BET_OPTIONS.filter(b => b <= maxBaseBet)

  // Find the highest base bet that fits within budget
  for (let i = availableBets.length - 1; i >= 0; i--) {
    const cost = availableBets[i] * combinations
    if (cost <= budget) {
      return availableBets[i]
    }
  }

  // If nothing fits, return minimum
  return availableBets[0]
}

// ============================================================================
// OPTIMIZATION FUNCTIONS
// ============================================================================

/**
 * Generate exacta bet options
 */
function generateExactaOptions(
  config: OptimizationConfig
): OptimizedBetOption[] {
  const { budget, tier1Horses, tier2Horses, tier3Horses = [], maxBaseBet = 5 } = config
  const options: OptimizedBetOption[] = []
  const allHorses = [...tier1Horses, ...tier2Horses, ...tier3Horses]

  // Option 1: Box Tier 1 horses only
  if (tier1Horses.length >= 2) {
    const horses = tier1Horses.map(h => h.programNumber)
    const testCost = calculateExactaBoxCost(horses, 1)
    const baseBet = findOptimalBaseBet(budget, testCost.combinations, maxBaseBet)
    const cost = calculateExactaBoxCost(horses, baseBet)

    if (cost.isValid && cost.total <= budget) {
      const hitProb = calculateExactaProbability(tier1Horses, tier1Horses) * 0.8
      const payout = estimateExpectedPayout('exacta', tier1Horses, baseBet)
      const ev = calculateExpectedValue(hitProb, payout.likely, cost.total)

      options.push({
        id: 'exacta-box-tier1',
        structure: 'box',
        description: `Box ${tier1Horses.length} Tier 1 horses`,
        cost,
        expectedValue: ev,
        hitProbability: hitProb,
        firstHorses: horses,
        secondHorses: horses,
        thirdHorses: [],
        fourthHorses: [],
        baseBet,
        budgetRemaining: budget - cost.total,
        isRecommended: false,
        reasoning: `High confidence horses, ${cost.combinations} combinations`,
      })
    }
  }

  // Option 2: Key Tier 1 over Tier 2
  if (tier1Horses.length >= 1 && tier2Horses.length >= 1) {
    const keyHorses = tier1Horses.map(h => h.programNumber)
    const otherHorses = tier2Horses.map(h => h.programNumber)
    const testCost = calculateExactaKeyOverCost(keyHorses, otherHorses, 1)
    const baseBet = findOptimalBaseBet(budget, testCost.combinations, maxBaseBet)
    const cost = calculateExactaKeyOverCost(keyHorses, otherHorses, baseBet)

    if (cost.isValid && cost.total <= budget) {
      const hitProb = calculateExactaProbability(tier1Horses, tier2Horses)
      const payout = estimateExpectedPayout('exacta', [...tier1Horses, ...tier2Horses], baseBet)
      const ev = calculateExpectedValue(hitProb, payout.likely, cost.total)

      options.push({
        id: 'exacta-key-t1-over-t2',
        structure: 'key_over',
        description: `Key ${tier1Horses.length} Tier 1 over ${tier2Horses.length} Tier 2`,
        cost,
        expectedValue: ev,
        hitProbability: hitProb,
        firstHorses: keyHorses,
        secondHorses: otherHorses,
        thirdHorses: [],
        fourthHorses: [],
        baseBet,
        budgetRemaining: budget - cost.total,
        isRecommended: false,
        reasoning: `Top picks on top, value plays underneath`,
      })
    }
  }

  // Option 3: Key Tier 1 over ALL others
  if (tier1Horses.length >= 1 && allHorses.length > tier1Horses.length) {
    const keyHorses = tier1Horses.map(h => h.programNumber)
    const otherHorses = allHorses
      .filter(h => !tier1Horses.some(t => t.programNumber === h.programNumber))
      .map(h => h.programNumber)

    if (otherHorses.length >= 1) {
      const testCost = calculateExactaKeyOverCost(keyHorses, otherHorses, 1)
      const baseBet = findOptimalBaseBet(budget, testCost.combinations, maxBaseBet)
      const cost = calculateExactaKeyOverCost(keyHorses, otherHorses, baseBet)

      if (cost.isValid && cost.total <= budget) {
        const allOthers = allHorses.filter(h => !tier1Horses.some(t => t.programNumber === h.programNumber))
        const hitProb = calculateExactaProbability(tier1Horses, allOthers)
        const payout = estimateExpectedPayout('exacta', allHorses, baseBet)
        const ev = calculateExpectedValue(hitProb, payout.likely, cost.total)

        options.push({
          id: 'exacta-key-t1-over-all',
          structure: 'key_over',
          description: `Key ${tier1Horses.length} Tier 1 over ${otherHorses.length} others`,
          cost,
          expectedValue: ev,
          hitProbability: hitProb,
          firstHorses: keyHorses,
          secondHorses: otherHorses,
          thirdHorses: [],
          fourthHorses: [],
          baseBet,
          budgetRemaining: budget - cost.total,
          isRecommended: false,
          reasoning: `Maximum coverage with top picks on top`,
        })
      }
    }
  }

  // Option 4: Box all viable horses
  if (allHorses.length >= 2 && allHorses.length <= 5) {
    const horses = allHorses.map(h => h.programNumber)
    const testCost = calculateExactaBoxCost(horses, 1)
    const baseBet = findOptimalBaseBet(budget, testCost.combinations, maxBaseBet)
    const cost = calculateExactaBoxCost(horses, baseBet)

    if (cost.isValid && cost.total <= budget) {
      const hitProb = calculateExactaProbability(allHorses, allHorses) * 0.9
      const payout = estimateExpectedPayout('exacta', allHorses, baseBet)
      const ev = calculateExpectedValue(hitProb, payout.likely, cost.total)

      options.push({
        id: 'exacta-box-all',
        structure: 'box',
        description: `Box all ${allHorses.length} tiered horses`,
        cost,
        expectedValue: ev,
        hitProbability: hitProb,
        firstHorses: horses,
        secondHorses: horses,
        thirdHorses: [],
        fourthHorses: [],
        baseBet,
        budgetRemaining: budget - cost.total,
        isRecommended: false,
        reasoning: `Maximum coverage boxing all selections`,
      })
    }
  }

  return options
}

/**
 * Generate trifecta bet options
 */
function generateTrifectaOptions(
  config: OptimizationConfig
): OptimizedBetOption[] {
  const { budget, tier1Horses, tier2Horses, tier3Horses = [], maxBaseBet = 2 } = config
  const options: OptimizedBetOption[] = []
  const allHorses = [...tier1Horses, ...tier2Horses, ...tier3Horses]

  // Option 1: Box Tier 1 horses only
  if (tier1Horses.length >= 3) {
    const horses = tier1Horses.slice(0, 4).map(h => h.programNumber)
    const testCost = calculateTrifectaBoxCost(horses, 1)
    const baseBet = findOptimalBaseBet(budget, testCost.combinations, maxBaseBet)
    const cost = calculateTrifectaBoxCost(horses, baseBet)

    if (cost.isValid && cost.total <= budget) {
      const selectedHorses = tier1Horses.slice(0, horses.length)
      const hitProb = calculateTrifectaProbability(selectedHorses, selectedHorses, selectedHorses) * 0.7
      const payout = estimateExpectedPayout('trifecta', selectedHorses, baseBet)
      const ev = calculateExpectedValue(hitProb, payout.likely, cost.total)

      options.push({
        id: 'trifecta-box-tier1',
        structure: 'box',
        description: `Box ${horses.length} Tier 1 horses`,
        cost,
        expectedValue: ev,
        hitProbability: hitProb,
        firstHorses: horses,
        secondHorses: horses,
        thirdHorses: horses,
        fourthHorses: [],
        baseBet,
        budgetRemaining: budget - cost.total,
        isRecommended: false,
        reasoning: `High confidence trifecta box`,
      })
    }
  }

  // Option 2: Key Tier 1 / Tier 1+2 / Tier 1+2
  if (tier1Horses.length >= 1 && (tier1Horses.length + tier2Horses.length) >= 3) {
    const keyHorses = tier1Horses.slice(0, 2).map(h => h.programNumber)
    const secondThirdHorses = [...tier1Horses, ...tier2Horses].map(h => h.programNumber)

    const testCost = calculateTrifectaPartWheelCost(keyHorses, secondThirdHorses, secondThirdHorses, 1)
    const baseBet = findOptimalBaseBet(budget, testCost.combinations, maxBaseBet)
    const cost = calculateTrifectaPartWheelCost(keyHorses, secondThirdHorses, secondThirdHorses, baseBet)

    if (cost.isValid && cost.total <= budget) {
      const keyHorsesFull = tier1Horses.slice(0, 2)
      const allUsed = [...tier1Horses, ...tier2Horses]
      const hitProb = calculateTrifectaProbability(keyHorsesFull, allUsed, allUsed)
      const payout = estimateExpectedPayout('trifecta', allUsed, baseBet)
      const ev = calculateExpectedValue(hitProb, payout.likely, cost.total)

      options.push({
        id: 'trifecta-key-t1-over-all',
        structure: 'part_wheel',
        description: `Key ${keyHorses.length} Tier 1 with ${secondThirdHorses.length - keyHorses.length} others`,
        cost,
        expectedValue: ev,
        hitProbability: hitProb,
        firstHorses: keyHorses,
        secondHorses: secondThirdHorses,
        thirdHorses: secondThirdHorses,
        fourthHorses: [],
        baseBet,
        budgetRemaining: budget - cost.total,
        isRecommended: false,
        reasoning: `Top picks must win, others fill in places`,
      })
    }
  }

  // Option 3: Box mixed tiers
  if (allHorses.length >= 3 && allHorses.length <= 5) {
    const horses = allHorses.slice(0, 5).map(h => h.programNumber)
    const testCost = calculateTrifectaBoxCost(horses, 1)
    const baseBet = findOptimalBaseBet(budget, testCost.combinations, maxBaseBet)
    const cost = calculateTrifectaBoxCost(horses, baseBet)

    if (cost.isValid && cost.total <= budget) {
      const selectedHorses = allHorses.slice(0, horses.length)
      const hitProb = calculateTrifectaProbability(selectedHorses, selectedHorses, selectedHorses) * 0.8
      const payout = estimateExpectedPayout('trifecta', selectedHorses, baseBet)
      const ev = calculateExpectedValue(hitProb, payout.likely, cost.total)

      options.push({
        id: 'trifecta-box-mixed',
        structure: 'box',
        description: `Box ${horses.length} mixed tier horses`,
        cost,
        expectedValue: ev,
        hitProbability: hitProb,
        firstHorses: horses,
        secondHorses: horses,
        thirdHorses: horses,
        fourthHorses: [],
        baseBet,
        budgetRemaining: budget - cost.total,
        isRecommended: false,
        reasoning: `Value-focused box with multiple tiers`,
      })
    }
  }

  return options
}

/**
 * Generate superfecta bet options
 */
function generateSuperfectaOptions(
  config: OptimizationConfig
): OptimizedBetOption[] {
  const { budget, tier1Horses, tier2Horses, tier3Horses = [], maxBaseBet = 0.5 } = config
  const options: OptimizedBetOption[] = []
  const allHorses = [...tier1Horses, ...tier2Horses, ...tier3Horses]

  // Option 1: Box top 4-5 horses
  if (allHorses.length >= 4) {
    const horses = allHorses.slice(0, 5).map(h => h.programNumber)
    const testCost = calculateSuperfectaBoxCost(horses, 0.1)
    const baseBet = findOptimalBaseBet(budget, testCost.combinations, maxBaseBet)
    const cost = calculateSuperfectaBoxCost(horses, baseBet)

    if (cost.isValid && cost.total <= budget) {
      const selectedHorses = allHorses.slice(0, horses.length)
      const hitProb = calculateSuperfectaProbability(selectedHorses, selectedHorses, selectedHorses, selectedHorses) * 0.6
      const payout = estimateExpectedPayout('superfecta', selectedHorses, baseBet)
      const ev = calculateExpectedValue(hitProb, payout.likely, cost.total)

      options.push({
        id: 'superfecta-box-top',
        structure: 'box',
        description: `Box top ${horses.length} horses`,
        cost,
        expectedValue: ev,
        hitProbability: hitProb,
        firstHorses: horses,
        secondHorses: horses,
        thirdHorses: horses,
        fourthHorses: horses,
        baseBet,
        budgetRemaining: budget - cost.total,
        isRecommended: false,
        reasoning: `Comprehensive coverage of top selections`,
      })
    }
  }

  // Option 2: Key Tier 1 / All / All / All
  if (tier1Horses.length >= 1 && allHorses.length >= 4) {
    const keyHorses = tier1Horses.slice(0, 2).map(h => h.programNumber)
    const otherHorses = allHorses.map(h => h.programNumber)

    const testCost = calculateSuperfectaKeyCost(keyHorses, otherHorses, otherHorses, otherHorses, 0.1)
    const baseBet = findOptimalBaseBet(budget, testCost.combinations, maxBaseBet)
    const cost = calculateSuperfectaKeyCost(keyHorses, otherHorses, otherHorses, otherHorses, baseBet)

    if (cost.isValid && cost.total <= budget) {
      const keyHorsesFull = tier1Horses.slice(0, 2)
      const hitProb = calculateSuperfectaProbability(keyHorsesFull, allHorses, allHorses, allHorses)
      const payout = estimateExpectedPayout('superfecta', allHorses, baseBet)
      const ev = calculateExpectedValue(hitProb, payout.likely, cost.total)

      options.push({
        id: 'superfecta-key-t1',
        structure: 'key_over',
        description: `Key ${keyHorses.length} Tier 1 over all others`,
        cost,
        expectedValue: ev,
        hitProbability: hitProb,
        firstHorses: keyHorses,
        secondHorses: otherHorses,
        thirdHorses: otherHorses,
        fourthHorses: otherHorses,
        baseBet,
        budgetRemaining: budget - cost.total,
        isRecommended: false,
        reasoning: `Top picks on top for big payouts`,
      })
    }
  }

  return options
}

// ============================================================================
// MAIN OPTIMIZATION FUNCTION
// ============================================================================

/**
 * Main optimization function
 * Finds the best exotic bet structure for given budget and horses
 */
export function optimizeExoticBet(config: OptimizationConfig): OptimizationResult {
  const { budget, betType, tier1Horses, tier2Horses, tier3Horses = [] } = config

  // Validate inputs
  const validatedBudget = validateNumber(budget, 20, { min: 1, max: 1000 })
  const allHorses = [...tier1Horses, ...tier2Horses, ...tier3Horses]

  if (allHorses.length < MIN_HORSES[betType]) {
    return {
      options: [],
      recommended: null,
      budgetUsed: 0,
      budgetRemaining: validatedBudget,
      summary: `Not enough horses for ${betType}. Need at least ${MIN_HORSES[betType]}.`,
      isValid: false,
      error: `Minimum ${MIN_HORSES[betType]} horses required for ${betType}`,
    }
  }

  if (validatedBudget <= 0) {
    return {
      options: [],
      recommended: null,
      budgetUsed: 0,
      budgetRemaining: 0,
      summary: 'Invalid budget',
      isValid: false,
      error: 'Budget must be greater than 0',
    }
  }

  // Generate options based on bet type
  let options: OptimizedBetOption[] = []
  const adjustedConfig = { ...config, budget: validatedBudget }

  switch (betType) {
    case 'exacta':
      options = generateExactaOptions(adjustedConfig)
      break
    case 'trifecta':
      options = generateTrifectaOptions(adjustedConfig)
      break
    case 'superfecta':
      options = generateSuperfectaOptions(adjustedConfig)
      break
  }

  // Filter to only options within budget
  options = options.filter(o => o.cost.isValid && o.cost.total <= validatedBudget)

  if (options.length === 0) {
    return {
      options: [],
      recommended: null,
      budgetUsed: 0,
      budgetRemaining: validatedBudget,
      summary: `No viable ${betType} options within $${validatedBudget} budget`,
      isValid: false,
      error: 'No options fit within budget',
    }
  }

  // Sort by expected value (descending)
  options.sort((a, b) => b.expectedValue - a.expectedValue)

  // Mark the best option as recommended
  const recommended = options[0]
  recommended.isRecommended = true
  recommended.reasoning = `Best EV: ${recommended.expectedValue > 0 ? '+' : ''}$${recommended.expectedValue.toFixed(2)} per bet`

  return {
    options,
    recommended,
    budgetUsed: recommended.cost.total,
    budgetRemaining: recommended.budgetRemaining,
    summary: `Recommended: ${recommended.description} for $${recommended.cost.total.toFixed(2)} (${recommended.cost.combinations} combos)`,
    isValid: true,
  }
}

/**
 * Suggest the best base bet amount for a given budget and combinations
 */
export function suggestBaseBet(
  budget: number,
  combinations: number,
  betType: ExoticBetType
): { baseBet: number; total: number; remaining: number } {
  const validatedBudget = validateNumber(budget, 20, { min: 1, max: 1000 })

  // Determine max base bet based on bet type
  const maxBase = betType === 'superfecta' ? 1 : betType === 'trifecta' ? 2 : 5

  const optimalBet = findOptimalBaseBet(validatedBudget, combinations, maxBase)
  const total = optimalBet * combinations

  return {
    baseBet: optimalBet,
    total: Math.round(total * 100) / 100,
    remaining: Math.round((validatedBudget - total) * 100) / 100,
  }
}

/**
 * Quick calculation of all bet types for a given set of horses
 */
export function calculateAllExoticOptions(
  horses: HorseTier[],
  budget: number
): Record<ExoticBetType, OptimizationResult> {
  // Split horses into tiers
  const tier1 = horses.filter(h => h.tier === 1)
  const tier2 = horses.filter(h => h.tier === 2)
  const tier3 = horses.filter(h => h.tier === 3)

  const baseConfig = {
    budget,
    tier1Horses: tier1,
    tier2Horses: tier2,
    tier3Horses: tier3,
    fieldSize: horses.length,
  }

  return {
    exacta: optimizeExoticBet({ ...baseConfig, betType: 'exacta' }),
    trifecta: optimizeExoticBet({ ...baseConfig, betType: 'trifecta' }),
    superfecta: optimizeExoticBet({ ...baseConfig, betType: 'superfecta' }),
  }
}
