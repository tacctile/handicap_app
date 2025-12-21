/**
 * Multi-Race Bet Cost Calculator
 *
 * Calculates costs for multi-race exotic bets:
 * - Daily Double, Pick 3, Pick 4, Pick 5, Pick 6
 *
 * Formula: selections_race1 × selections_race2 × ... × base_bet
 *
 * Examples:
 * - Daily Double: 2 horses × 3 horses × $2 = $12
 * - Pick 3: 2 × 2 × 3 × $1 = $12
 * - Pick 4: 3 × 2 × 2 × 3 × $0.50 = $18
 * - Pick 6: 4 × 3 × 3 × 2 × 2 × 3 × $0.50 = $432
 */

import { validateNumber } from '../sanitization'
import {
  type MultiRaceBetType,
  type MultiRaceCost,
  type RaceSelection,
  getBetConfig,
} from './multiraceTypes'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum practical cost for a single ticket */
export const MAX_TICKET_COST = 10000

/** Maximum selections per race (to prevent runaway costs) */
export const MAX_SELECTIONS_PER_RACE = 12

/** Minimum selections per race */
export const MIN_SELECTIONS_PER_RACE = 1

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate and sanitize selections for a race
 */
function sanitizeSelections(
  selections: number[],
  fieldSize: number
): number[] {
  if (!Array.isArray(selections)) return []

  return [...new Set(
    selections
      .filter(s =>
        typeof s === 'number' &&
        Number.isFinite(s) &&
        Number.isInteger(s) &&
        s >= 1 &&
        s <= fieldSize
      )
  )].sort((a, b) => a - b)
}

/**
 * Validate base bet amount
 */
function validateBaseBet(
  amount: number,
  betType: MultiRaceBetType
): number {
  const config = getBetConfig(betType)
  const validated = validateNumber(amount, config.defaultBaseBet, {
    min: config.minBaseBet,
    max: 100,
  })
  return Math.round(validated * 100) / 100
}

/**
 * Create error result
 */
function createErrorResult(
  betType: MultiRaceBetType,
  baseBet: number,
  error: string
): MultiRaceCost {
  return {
    total: 0,
    combinations: 0,
    costPerCombo: baseBet,
    baseBet,
    betType,
    selectionsPerRace: [],
    spreadNotation: '',
    breakdown: error,
    isValid: false,
    error,
  }
}

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate the number of combinations for multi-race bet
 *
 * @param selectionsPerRace - Array of selection counts for each race
 * @returns Total number of combinations
 */
export function calculateCombinations(selectionsPerRace: number[]): number {
  if (selectionsPerRace.length === 0) return 0
  if (selectionsPerRace.some(s => s <= 0)) return 0

  return selectionsPerRace.reduce((product, count) => product * count, 1)
}

/**
 * Calculate multi-race bet cost
 *
 * @param selectionsPerRace - Array of selection counts for each race
 * @param baseBet - Base bet amount per combination
 * @returns Total cost
 */
export function calculateBasicCost(
  selectionsPerRace: number[],
  baseBet: number
): number {
  const combinations = calculateCombinations(selectionsPerRace)
  return Math.round(combinations * baseBet * 100) / 100
}

/**
 * Generate spread notation (e.g., "2-3-2-1")
 */
export function generateSpreadNotation(selectionsPerRace: number[]): string {
  return selectionsPerRace.join('-')
}

/**
 * Calculate cost for a multi-race bet with full validation
 *
 * @param config - Configuration object
 * @returns MultiRaceCost result
 */
export function calculateMultiRaceCost(config: {
  betType: MultiRaceBetType
  selections: RaceSelection[]
  baseBet: number
}): MultiRaceCost {
  const { betType, selections, baseBet } = config
  const betConfig = getBetConfig(betType)
  const validatedBaseBet = validateBaseBet(baseBet, betType)

  // Validate number of races
  if (selections.length !== betConfig.racesRequired) {
    return createErrorResult(
      betType,
      validatedBaseBet,
      `${betConfig.displayName} requires exactly ${betConfig.racesRequired} races, got ${selections.length}`
    )
  }

  // Validate each race has at least one selection
  const selectionsPerRace: number[] = []
  for (let i = 0; i < selections.length; i++) {
    const leg = selections[i]

    if (leg.isAllSelected) {
      selectionsPerRace.push(leg.fieldSize)
    } else {
      const sanitized = sanitizeSelections(leg.selections, leg.fieldSize)
      if (sanitized.length < MIN_SELECTIONS_PER_RACE) {
        return createErrorResult(
          betType,
          validatedBaseBet,
          `Race ${leg.raceNumber} (leg ${i + 1}) requires at least ${MIN_SELECTIONS_PER_RACE} selection`
        )
      }
      if (sanitized.length > MAX_SELECTIONS_PER_RACE) {
        return createErrorResult(
          betType,
          validatedBaseBet,
          `Race ${leg.raceNumber} (leg ${i + 1}) exceeds maximum ${MAX_SELECTIONS_PER_RACE} selections`
        )
      }
      selectionsPerRace.push(sanitized.length)
    }
  }

  // Calculate combinations and cost
  const combinations = calculateCombinations(selectionsPerRace)
  const total = calculateBasicCost(selectionsPerRace, validatedBaseBet)

  // Check for excessive cost
  if (total > MAX_TICKET_COST) {
    return createErrorResult(
      betType,
      validatedBaseBet,
      `Ticket cost $${total.toFixed(2)} exceeds maximum $${MAX_TICKET_COST}`
    )
  }

  const spreadNotation = generateSpreadNotation(selectionsPerRace)
  const breakdown = `${spreadNotation} × $${validatedBaseBet.toFixed(2)} = ${combinations} combos × $${validatedBaseBet.toFixed(2)} = $${total.toFixed(2)}`

  return {
    total,
    combinations,
    costPerCombo: validatedBaseBet,
    baseBet: validatedBaseBet,
    betType,
    selectionsPerRace,
    spreadNotation,
    breakdown,
    isValid: true,
  }
}

// ============================================================================
// CONVENIENCE CALCULATORS
// ============================================================================

/**
 * Quick calculate Daily Double cost
 */
export function calculateDailyDoubleCost(
  race1Selections: number,
  race2Selections: number,
  baseBet: number = 2
): MultiRaceCost {
  const validatedBaseBet = validateBaseBet(baseBet, 'daily_double')
  const selectionsPerRace = [race1Selections, race2Selections]

  if (race1Selections < 1 || race2Selections < 1) {
    return createErrorResult('daily_double', validatedBaseBet, 'Each race requires at least 1 selection')
  }

  const combinations = calculateCombinations(selectionsPerRace)
  const total = calculateBasicCost(selectionsPerRace, validatedBaseBet)
  const spreadNotation = generateSpreadNotation(selectionsPerRace)

  return {
    total,
    combinations,
    costPerCombo: validatedBaseBet,
    baseBet: validatedBaseBet,
    betType: 'daily_double',
    selectionsPerRace,
    spreadNotation,
    breakdown: `${race1Selections} × ${race2Selections} × $${validatedBaseBet.toFixed(2)} = $${total.toFixed(2)}`,
    isValid: true,
  }
}

/**
 * Quick calculate Pick 3 cost
 */
export function calculatePick3Cost(
  race1: number,
  race2: number,
  race3: number,
  baseBet: number = 1
): MultiRaceCost {
  const validatedBaseBet = validateBaseBet(baseBet, 'pick_3')
  const selectionsPerRace = [race1, race2, race3]

  if (selectionsPerRace.some(s => s < 1)) {
    return createErrorResult('pick_3', validatedBaseBet, 'Each race requires at least 1 selection')
  }

  const combinations = calculateCombinations(selectionsPerRace)
  const total = calculateBasicCost(selectionsPerRace, validatedBaseBet)
  const spreadNotation = generateSpreadNotation(selectionsPerRace)

  return {
    total,
    combinations,
    costPerCombo: validatedBaseBet,
    baseBet: validatedBaseBet,
    betType: 'pick_3',
    selectionsPerRace,
    spreadNotation,
    breakdown: `${race1} × ${race2} × ${race3} × $${validatedBaseBet.toFixed(2)} = $${total.toFixed(2)}`,
    isValid: true,
  }
}

/**
 * Quick calculate Pick 4 cost
 */
export function calculatePick4Cost(
  selectionsPerRace: [number, number, number, number],
  baseBet: number = 0.5
): MultiRaceCost {
  const validatedBaseBet = validateBaseBet(baseBet, 'pick_4')

  if (selectionsPerRace.some(s => s < 1)) {
    return createErrorResult('pick_4', validatedBaseBet, 'Each race requires at least 1 selection')
  }

  const combinations = calculateCombinations(selectionsPerRace)
  const total = calculateBasicCost(selectionsPerRace, validatedBaseBet)
  const spreadNotation = generateSpreadNotation(selectionsPerRace)

  return {
    total,
    combinations,
    costPerCombo: validatedBaseBet,
    baseBet: validatedBaseBet,
    betType: 'pick_4',
    selectionsPerRace: [...selectionsPerRace],
    spreadNotation,
    breakdown: `${spreadNotation} × $${validatedBaseBet.toFixed(2)} = $${total.toFixed(2)}`,
    isValid: true,
  }
}

/**
 * Quick calculate Pick 5 cost
 */
export function calculatePick5Cost(
  selectionsPerRace: [number, number, number, number, number],
  baseBet: number = 0.5
): MultiRaceCost {
  const validatedBaseBet = validateBaseBet(baseBet, 'pick_5')

  if (selectionsPerRace.some(s => s < 1)) {
    return createErrorResult('pick_5', validatedBaseBet, 'Each race requires at least 1 selection')
  }

  const combinations = calculateCombinations(selectionsPerRace)
  const total = calculateBasicCost(selectionsPerRace, validatedBaseBet)
  const spreadNotation = generateSpreadNotation(selectionsPerRace)

  return {
    total,
    combinations,
    costPerCombo: validatedBaseBet,
    baseBet: validatedBaseBet,
    betType: 'pick_5',
    selectionsPerRace: [...selectionsPerRace],
    spreadNotation,
    breakdown: `${spreadNotation} × $${validatedBaseBet.toFixed(2)} = $${total.toFixed(2)}`,
    isValid: true,
  }
}

/**
 * Quick calculate Pick 6 cost
 */
export function calculatePick6Cost(
  selectionsPerRace: [number, number, number, number, number, number],
  baseBet: number = 0.5
): MultiRaceCost {
  const validatedBaseBet = validateBaseBet(baseBet, 'pick_6')

  if (selectionsPerRace.some(s => s < 1)) {
    return createErrorResult('pick_6', validatedBaseBet, 'Each race requires at least 1 selection')
  }

  const combinations = calculateCombinations(selectionsPerRace)
  const total = calculateBasicCost(selectionsPerRace, validatedBaseBet)
  const spreadNotation = generateSpreadNotation(selectionsPerRace)

  return {
    total,
    combinations,
    costPerCombo: validatedBaseBet,
    baseBet: validatedBaseBet,
    betType: 'pick_6',
    selectionsPerRace: [...selectionsPerRace],
    spreadNotation,
    breakdown: `${spreadNotation} × $${validatedBaseBet.toFixed(2)} = $${total.toFixed(2)}`,
    isValid: true,
  }
}

// ============================================================================
// "ALL" BUTTON CALCULATIONS
// ============================================================================

/**
 * Calculate cost when using "All" for one or more legs
 *
 * @param betType - Type of multi-race bet
 * @param selections - Selection counts per race (use negative for "All" with field size)
 * @param fieldSizes - Field sizes for each race (required for "All" legs)
 * @param baseBet - Base bet amount
 * @returns Cost with and without "All" comparison
 */
export function calculateWithAllOption(config: {
  betType: MultiRaceBetType
  currentSelections: number[]
  fieldSizes: number[]
  allLegs: number[]  // Leg indices (0-based) where "All" is used
  baseBet: number
}): {
  withAll: MultiRaceCost
  withoutAll: MultiRaceCost | null
  costDifference: number
  allAddsCombinations: number
} {
  const { betType, currentSelections, fieldSizes, allLegs, baseBet } = config
  const betConfig = getBetConfig(betType)
  const validatedBaseBet = validateBaseBet(baseBet, betType)

  // Calculate with "All" substituted
  const selectionsWithAll = currentSelections.map((sel, idx) =>
    allLegs.includes(idx) ? fieldSizes[idx] : sel
  )

  const withAllCombos = calculateCombinations(selectionsWithAll)
  const withAllCost = calculateBasicCost(selectionsWithAll, validatedBaseBet)

  const withAll: MultiRaceCost = {
    total: withAllCost,
    combinations: withAllCombos,
    costPerCombo: validatedBaseBet,
    baseBet: validatedBaseBet,
    betType,
    selectionsPerRace: selectionsWithAll,
    spreadNotation: generateSpreadNotation(selectionsWithAll),
    breakdown: `Using "All" in ${allLegs.length} leg(s): ${generateSpreadNotation(selectionsWithAll)} × $${validatedBaseBet.toFixed(2)} = $${withAllCost.toFixed(2)}`,
    isValid: withAllCombos > 0 && selectionsWithAll.length === betConfig.racesRequired,
  }

  // Calculate without All for comparison
  let withoutAll: MultiRaceCost | null = null
  if (currentSelections.every(s => s > 0)) {
    const withoutCombos = calculateCombinations(currentSelections)
    const withoutCost = calculateBasicCost(currentSelections, validatedBaseBet)

    withoutAll = {
      total: withoutCost,
      combinations: withoutCombos,
      costPerCombo: validatedBaseBet,
      baseBet: validatedBaseBet,
      betType,
      selectionsPerRace: currentSelections,
      spreadNotation: generateSpreadNotation(currentSelections),
      breakdown: `Without "All": ${generateSpreadNotation(currentSelections)} × $${validatedBaseBet.toFixed(2)} = $${withoutCost.toFixed(2)}`,
      isValid: true,
    }
  }

  return {
    withAll,
    withoutAll,
    costDifference: withoutAll ? withAllCost - withoutAll.total : withAllCost,
    allAddsCombinations: withoutAll ? withAllCombos - withoutAll.combinations : withAllCombos,
  }
}

// ============================================================================
// BUDGET FITTING UTILITIES
// ============================================================================

/**
 * Find the optimal base bet that fits within budget
 */
export function findOptimalBaseBet(
  betType: MultiRaceBetType,
  selectionsPerRace: number[],
  budget: number
): { baseBet: number; cost: number; fits: boolean } {
  const config = getBetConfig(betType)
  const combinations = calculateCombinations(selectionsPerRace)

  if (combinations === 0) {
    return { baseBet: config.defaultBaseBet, cost: 0, fits: false }
  }

  // Try each base bet option from highest to lowest
  const options = [...config.baseBetOptions].sort((a, b) => b - a)

  for (const bet of options) {
    const cost = calculateBasicCost(selectionsPerRace, bet)
    if (cost <= budget) {
      return { baseBet: bet, cost, fits: true }
    }
  }

  // Nothing fits, return minimum with actual cost
  const minCost = calculateBasicCost(selectionsPerRace, config.minBaseBet)
  return { baseBet: config.minBaseBet, cost: minCost, fits: false }
}

/**
 * Find maximum selections per race that fit budget
 * Returns balanced selection counts
 */
export function findMaxSelectionsForBudget(
  betType: MultiRaceBetType,
  raceCount: number,
  budget: number,
  baseBet?: number
): { selectionsPerRace: number[]; cost: number; fits: boolean } {
  const config = getBetConfig(betType)
  const bet = baseBet ?? config.minBaseBet

  // Start with 1 selection per race and increase
  const currentSelections = new Array(raceCount).fill(1)
  let lastValidSelections = [...currentSelections]
  let lastValidCost = calculateBasicCost(currentSelections, bet)

  // Iteratively increase selections
  for (let targetPerRace = 2; targetPerRace <= MAX_SELECTIONS_PER_RACE; targetPerRace++) {
    const testSelections = new Array(raceCount).fill(targetPerRace)
    const cost = calculateBasicCost(testSelections, bet)

    if (cost <= budget) {
      lastValidSelections = testSelections
      lastValidCost = cost
    } else {
      break
    }
  }

  return {
    selectionsPerRace: lastValidSelections,
    cost: lastValidCost,
    fits: lastValidCost <= budget,
  }
}

// ============================================================================
// COST COMPARISON UTILITIES
// ============================================================================

/**
 * Compare costs for different spread configurations
 */
export function compareSpreads(
  betType: MultiRaceBetType,
  spreads: number[][],
  baseBet: number
): Array<{
  spread: number[]
  notation: string
  combinations: number
  cost: number
  isValid: boolean
}> {
  const config = getBetConfig(betType)
  const validatedBaseBet = validateBaseBet(baseBet, betType)

  return spreads
    .filter(spread => spread.length === config.racesRequired)
    .map(spread => {
      const combinations = calculateCombinations(spread)
      const cost = calculateBasicCost(spread, validatedBaseBet)

      return {
        spread,
        notation: generateSpreadNotation(spread),
        combinations,
        cost,
        isValid: spread.every(s => s >= 1),
      }
    })
    .sort((a, b) => a.cost - b.cost)
}

/**
 * Generate window instruction for multi-race bet
 */
export function generateWindowInstruction(
  betType: MultiRaceBetType,
  startRace: number,
  selections: Array<{ raceNumber: number; horses: number[] }>,
  baseBet: number
): string {
  const config = getBetConfig(betType)
  const validatedBaseBet = validateBaseBet(baseBet, betType)

  const endRace = startRace + config.racesRequired - 1
  const betName = config.displayName.toUpperCase()

  const parts = [
    `$${validatedBaseBet.toFixed(2)} ${betName}, Races ${startRace}-${endRace}`,
  ]

  for (const sel of selections) {
    const horsesStr = sel.horses.length === 1
      ? sel.horses[0].toString()
      : sel.horses.join(', ')
    parts.push(`Race ${sel.raceNumber}: ${horsesStr}`)
  }

  return parts.join('\n')
}
