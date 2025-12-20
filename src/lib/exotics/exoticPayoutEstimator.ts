/**
 * Exotic Payout Estimator
 *
 * Estimates payouts for exotic bets based on horse odds:
 * - Exacta: odds1 × odds2 × base multiplier
 * - Trifecta: odds1 × odds2 × odds3 × base multiplier
 * - Superfecta: odds1 × odds2 × odds3 × odds4 × base multiplier
 *
 * Returns payout ranges:
 * - Minimum: All favorites hit
 * - Maximum: Mix of favorites + longshots
 * - Most likely: Based on confidence levels
 */

import { validateNumber } from '../sanitization'
import type { ExoticBetType } from './exoticCalculator'

// ============================================================================
// TYPES
// ============================================================================

export interface HorseOdds {
  /** Program number */
  programNumber: number
  /** Horse name */
  horseName: string
  /** Decimal odds (e.g., 5-1 = 5.0) */
  odds: number
  /** Confidence level (0-100) */
  confidence: number
  /** Whether this is a favorite */
  isFavorite?: boolean
  /** Whether this is a longshot */
  isLongshot?: boolean
}

export interface PayoutRange {
  /** Minimum payout (all favorites) */
  minimum: number
  /** Maximum payout (mix with longshots) */
  maximum: number
  /** Most likely payout based on confidence */
  likely: number
  /** Display string: "$45 - $380 (likely $120)" */
  display: string
  /** Per-dollar payout ratio */
  perDollarRatio: {
    min: number
    max: number
    likely: number
  }
}

export interface PayoutEstimate {
  /** The bet type */
  betType: ExoticBetType
  /** Base bet amount */
  baseBet: number
  /** Number of combinations */
  combinations: number
  /** Total cost */
  totalCost: number
  /** Payout range */
  payoutRange: PayoutRange
  /** Breakdown by scenario */
  scenarios: PayoutScenario[]
  /** Whether estimate is valid */
  isValid: boolean
  /** Error message if not valid */
  error?: string
}

export interface PayoutScenario {
  /** Scenario name */
  name: string
  /** Description */
  description: string
  /** Horses involved */
  horses: HorseOdds[]
  /** Estimated payout */
  payout: number
  /** Probability of this scenario */
  probability: number
  /** Display string */
  display: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Track takeout adjusted multipliers
 * These account for the track's take and typical payout patterns
 */
export const PAYOUT_MULTIPLIERS: Record<ExoticBetType, number> = {
  exacta: 1.2,
  trifecta: 2.5,
  superfecta: 8,
}

/**
 * Track takeout percentages (average)
 */
export const TRACK_TAKEOUT: Record<ExoticBetType, number> = {
  exacta: 0.19,
  trifecta: 0.22,
  superfecta: 0.25,
}

/**
 * Odds thresholds for categorization
 */
const FAVORITE_THRESHOLD = 3 // 3-1 or lower is favorite
const LONGSHOT_THRESHOLD = 10 // 10-1 or higher is longshot

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse odds string to decimal
 */
export function parseOddsToDecimal(oddsString: string): number {
  if (!oddsString || typeof oddsString !== 'string') return 5

  // Handle fractional odds like "5-1", "3/1"
  const match = oddsString.match(/(\d+(?:\.\d+)?)[/-](\d+(?:\.\d+)?)?/)
  if (match) {
    const numerator = parseFloat(match[1])
    const denominator = match[2] ? parseFloat(match[2]) : 1
    return numerator / denominator
  }

  // Handle decimal odds
  const decimal = parseFloat(oddsString)
  return Number.isFinite(decimal) ? decimal : 5
}

/**
 * Categorize horse based on odds
 */
function categorizeHorse(horse: HorseOdds): HorseOdds {
  return {
    ...horse,
    isFavorite: horse.odds <= FAVORITE_THRESHOLD,
    isLongshot: horse.odds >= LONGSHOT_THRESHOLD,
  }
}

/**
 * Sort horses by odds (favorites first)
 */
function sortByOdds(horses: HorseOdds[]): HorseOdds[] {
  return [...horses].sort((a, b) => a.odds - b.odds)
}

/**
 * Calculate raw payout for a combination
 */
function calculateRawPayout(
  odds: number[],
  betType: ExoticBetType,
  baseBet: number
): number {
  if (odds.length === 0) return 0

  const multiplier = PAYOUT_MULTIPLIERS[betType]
  const takeout = TRACK_TAKEOUT[betType]

  // Base calculation: multiply all odds together
  let oddsProduct = odds.reduce((product, o) => product * o, 1)

  // Apply multiplier and adjust for takeout
  const grossPayout = oddsProduct * multiplier * baseBet
  const netPayout = grossPayout * (1 - takeout)

  return Math.round(netPayout * 100) / 100
}

/**
 * Calculate exacta payout
 * Formula: odds1 × odds2 × 1.2 (adjusted for takeout)
 */
function calculateExactaPayout(
  firstOdds: number,
  secondOdds: number,
  baseBet: number
): number {
  return calculateRawPayout([firstOdds, secondOdds], 'exacta', baseBet)
}

/**
 * Calculate trifecta payout
 * Formula: odds1 × odds2 × odds3 × 2.5 (adjusted for takeout)
 */
function calculateTrifectaPayout(
  firstOdds: number,
  secondOdds: number,
  thirdOdds: number,
  baseBet: number
): number {
  return calculateRawPayout([firstOdds, secondOdds, thirdOdds], 'trifecta', baseBet)
}

/**
 * Calculate superfecta payout
 * Formula: odds1 × odds2 × odds3 × odds4 × 8 (adjusted for takeout)
 */
function calculateSuperfectaPayout(
  firstOdds: number,
  secondOdds: number,
  thirdOdds: number,
  fourthOdds: number,
  baseBet: number
): number {
  return calculateRawPayout(
    [firstOdds, secondOdds, thirdOdds, fourthOdds],
    'superfecta',
    baseBet
  )
}

// ============================================================================
// SCENARIO GENERATORS
// ============================================================================

/**
 * Generate exacta payout scenarios
 */
function generateExactaScenarios(
  horses: HorseOdds[],
  baseBet: number
): PayoutScenario[] {
  const scenarios: PayoutScenario[] = []
  const sorted = sortByOdds(horses.map(categorizeHorse))

  if (sorted.length < 2) return scenarios

  // Scenario 1: Chalk (favorites 1-2)
  const chalkHorses = sorted.slice(0, 2)
  const chalkPayout = calculateExactaPayout(
    chalkHorses[0].odds,
    chalkHorses[1].odds,
    baseBet
  )
  scenarios.push({
    name: 'Chalk',
    description: 'Favorites finish 1-2',
    horses: chalkHorses,
    payout: chalkPayout,
    probability: 0.25,
    display: `$${chalkPayout.toFixed(0)} (favorites 1-2)`,
  })

  // Scenario 2: Mixed (favorite wins, longer shot second)
  if (sorted.length >= 3) {
    const mixedHorses = [sorted[0], sorted[2]]
    const mixedPayout = calculateExactaPayout(
      mixedHorses[0].odds,
      mixedHorses[1].odds,
      baseBet
    )
    scenarios.push({
      name: 'Mixed',
      description: 'Favorite wins, value horse second',
      horses: mixedHorses,
      payout: mixedPayout,
      probability: 0.15,
      display: `$${mixedPayout.toFixed(0)} (favorite/value)`,
    })
  }

  // Scenario 3: Upset (longer shot wins)
  const longshotIndex = sorted.findIndex(h => h.isLongshot) || sorted.length - 1
  if (longshotIndex >= 0 && longshotIndex < sorted.length) {
    const upsetHorses = [sorted[longshotIndex], sorted[0]]
    const upsetPayout = calculateExactaPayout(
      upsetHorses[0].odds,
      upsetHorses[1].odds,
      baseBet
    )
    scenarios.push({
      name: 'Upset',
      description: 'Longshot wins, favorite second',
      horses: upsetHorses,
      payout: upsetPayout,
      probability: 0.08,
      display: `$${upsetPayout.toFixed(0)} (upset!)`,
    })
  }

  return scenarios
}

/**
 * Generate trifecta payout scenarios
 */
function generateTrifectaScenarios(
  horses: HorseOdds[],
  baseBet: number
): PayoutScenario[] {
  const scenarios: PayoutScenario[] = []
  const sorted = sortByOdds(horses.map(categorizeHorse))

  if (sorted.length < 3) return scenarios

  // Scenario 1: Chalk (favorites 1-2-3)
  const chalkHorses = sorted.slice(0, 3)
  const chalkPayout = calculateTrifectaPayout(
    chalkHorses[0].odds,
    chalkHorses[1].odds,
    chalkHorses[2].odds,
    baseBet
  )
  scenarios.push({
    name: 'Chalk',
    description: 'Top 3 favorites finish 1-2-3',
    horses: chalkHorses,
    payout: chalkPayout,
    probability: 0.08,
    display: `$${chalkPayout.toFixed(0)} (chalk)`,
  })

  // Scenario 2: Mixed (2 favorites + 1 price)
  if (sorted.length >= 4) {
    const mixedHorses = [sorted[0], sorted[1], sorted[3]]
    const mixedPayout = calculateTrifectaPayout(
      mixedHorses[0].odds,
      mixedHorses[1].odds,
      mixedHorses[2].odds,
      baseBet
    )
    scenarios.push({
      name: 'Mixed',
      description: '2 favorites with value horse',
      horses: mixedHorses,
      payout: mixedPayout,
      probability: 0.12,
      display: `$${mixedPayout.toFixed(0)} (mixed)`,
    })
  }

  // Scenario 3: Value (includes a longshot)
  const longshots = sorted.filter(h => h.isLongshot)
  if (longshots.length > 0) {
    const valueHorses = [sorted[0], longshots[0], sorted[1]]
    const valuePayout = calculateTrifectaPayout(
      valueHorses[0].odds,
      valueHorses[1].odds,
      valueHorses[2].odds,
      baseBet
    )
    scenarios.push({
      name: 'Value',
      description: 'Longshot hits the board',
      horses: valueHorses,
      payout: valuePayout,
      probability: 0.05,
      display: `$${valuePayout.toFixed(0)} (value!)`,
    })
  }

  return scenarios
}

/**
 * Generate superfecta payout scenarios
 */
function generateSuperfectaScenarios(
  horses: HorseOdds[],
  baseBet: number
): PayoutScenario[] {
  const scenarios: PayoutScenario[] = []
  const sorted = sortByOdds(horses.map(categorizeHorse))

  if (sorted.length < 4) return scenarios

  // Scenario 1: Chalk (favorites 1-2-3-4)
  const chalkHorses = sorted.slice(0, 4)
  const chalkPayout = calculateSuperfectaPayout(
    chalkHorses[0].odds,
    chalkHorses[1].odds,
    chalkHorses[2].odds,
    chalkHorses[3].odds,
    baseBet
  )
  scenarios.push({
    name: 'Chalk',
    description: 'Top 4 favorites finish in order',
    horses: chalkHorses,
    payout: chalkPayout,
    probability: 0.01,
    display: `$${chalkPayout.toFixed(0)} (chalk)`,
  })

  // Scenario 2: Mixed
  if (sorted.length >= 5) {
    const mixedHorses = [sorted[0], sorted[1], sorted[4], sorted[2]]
    const mixedPayout = calculateSuperfectaPayout(
      mixedHorses[0].odds,
      mixedHorses[1].odds,
      mixedHorses[2].odds,
      mixedHorses[3].odds,
      baseBet
    )
    scenarios.push({
      name: 'Mixed',
      description: 'Favorites with a price horse',
      horses: mixedHorses,
      payout: mixedPayout,
      probability: 0.02,
      display: `$${mixedPayout.toFixed(0)} (mixed)`,
    })
  }

  // Scenario 3: Bomb (longshot in the mix)
  const longshots = sorted.filter(h => h.isLongshot)
  if (longshots.length > 0 && sorted.length >= 4) {
    const bombHorses = [sorted[0], longshots[0], sorted[1], sorted[2]]
    const bombPayout = calculateSuperfectaPayout(
      bombHorses[0].odds,
      bombHorses[1].odds,
      bombHorses[2].odds,
      bombHorses[3].odds,
      baseBet
    )
    scenarios.push({
      name: 'Bomb',
      description: 'Longshot cracks the super',
      horses: bombHorses,
      payout: bombPayout,
      probability: 0.005,
      display: `$${bombPayout.toFixed(0)} (BOMB!)`,
    })
  }

  return scenarios
}

// ============================================================================
// MAIN ESTIMATION FUNCTIONS
// ============================================================================

/**
 * Estimate payout range for an exotic bet
 */
export function estimateExoticPayout(
  betType: ExoticBetType,
  horses: HorseOdds[],
  baseBet: number,
  combinations: number
): PayoutEstimate {
  const validatedBaseBet = validateNumber(baseBet, 2, { min: 0.1, max: 100 })
  const totalCost = validatedBaseBet * combinations

  if (horses.length < 2) {
    return {
      betType,
      baseBet: validatedBaseBet,
      combinations,
      totalCost,
      payoutRange: {
        minimum: 0,
        maximum: 0,
        likely: 0,
        display: 'Not enough horses',
        perDollarRatio: { min: 0, max: 0, likely: 0 },
      },
      scenarios: [],
      isValid: false,
      error: 'At least 2 horses required',
    }
  }

  const sorted = sortByOdds(horses.map(categorizeHorse))

  // Generate scenarios based on bet type
  let scenarios: PayoutScenario[] = []
  switch (betType) {
    case 'exacta':
      scenarios = generateExactaScenarios(horses, validatedBaseBet)
      break
    case 'trifecta':
      scenarios = generateTrifectaScenarios(horses, validatedBaseBet)
      break
    case 'superfecta':
      scenarios = generateSuperfectaScenarios(horses, validatedBaseBet)
      break
  }

  // Calculate payout range
  const payouts = scenarios.map(s => s.payout)
  const minimum = payouts.length > 0 ? Math.min(...payouts) : 0
  const maximum = payouts.length > 0 ? Math.max(...payouts) : 0

  // Calculate likely payout (weighted by probability)
  const likely = scenarios.reduce((sum, s) => sum + s.payout * s.probability, 0) /
    Math.max(0.01, scenarios.reduce((sum, s) => sum + s.probability, 0))

  const payoutRange: PayoutRange = {
    minimum: Math.round(minimum),
    maximum: Math.round(maximum),
    likely: Math.round(likely),
    display: `$${Math.round(minimum)} - $${Math.round(maximum)} (likely $${Math.round(likely)})`,
    perDollarRatio: {
      min: minimum / totalCost,
      max: maximum / totalCost,
      likely: likely / totalCost,
    },
  }

  return {
    betType,
    baseBet: validatedBaseBet,
    combinations,
    totalCost,
    payoutRange,
    scenarios,
    isValid: true,
  }
}

/**
 * Quick payout estimate using just odds
 */
export function quickPayoutEstimate(
  betType: ExoticBetType,
  odds: number[],
  baseBet: number = 2
): { min: number; max: number; likely: number; display: string } {
  if (odds.length === 0) {
    return { min: 0, max: 0, likely: 0, display: 'No odds provided' }
  }

  const sortedOdds = [...odds].sort((a, b) => a - b)
  const avgOdds = odds.reduce((sum, o) => sum + o, 0) / odds.length
  const minOdds = sortedOdds[0]
  const maxOdds = sortedOdds[sortedOdds.length - 1]

  const multiplier = PAYOUT_MULTIPLIERS[betType]
  const takeout = TRACK_TAKEOUT[betType]
  const netFactor = (1 - takeout)

  let min: number, max: number, likely: number

  switch (betType) {
    case 'exacta':
      min = baseBet * minOdds * sortedOdds[1] * multiplier * netFactor
      max = baseBet * maxOdds * avgOdds * multiplier * netFactor
      likely = baseBet * avgOdds * avgOdds * 0.8 * multiplier * netFactor
      break

    case 'trifecta':
      min = baseBet * minOdds * sortedOdds[1] * sortedOdds[2] * multiplier * netFactor
      max = baseBet * maxOdds * avgOdds * avgOdds * multiplier * netFactor
      likely = baseBet * avgOdds * avgOdds * avgOdds * 0.5 * multiplier * netFactor
      break

    case 'superfecta':
      min = baseBet * minOdds * sortedOdds[1] * sortedOdds[2] * (sortedOdds[3] || sortedOdds[2]) * multiplier * netFactor
      max = baseBet * maxOdds * avgOdds * avgOdds * avgOdds * multiplier * netFactor
      likely = baseBet * avgOdds * avgOdds * avgOdds * avgOdds * 0.3 * multiplier * netFactor
      break

    default:
      min = 0
      max = 0
      likely = 0
  }

  return {
    min: Math.round(min),
    max: Math.round(max),
    likely: Math.round(likely),
    display: `$${Math.round(min)} - $${Math.round(max)} (likely $${Math.round(likely)})`,
  }
}

/**
 * Estimate return on investment (ROI)
 */
export function estimateROI(
  payoutEstimate: PayoutEstimate
): { minROI: number; maxROI: number; likelyROI: number; display: string } {
  const { totalCost, payoutRange } = payoutEstimate

  if (totalCost === 0) {
    return { minROI: 0, maxROI: 0, likelyROI: 0, display: 'N/A' }
  }

  const minROI = ((payoutRange.minimum - totalCost) / totalCost) * 100
  const maxROI = ((payoutRange.maximum - totalCost) / totalCost) * 100
  const likelyROI = ((payoutRange.likely - totalCost) / totalCost) * 100

  const formatROI = (roi: number) => `${roi >= 0 ? '+' : ''}${roi.toFixed(0)}%`

  return {
    minROI,
    maxROI,
    likelyROI,
    display: `${formatROI(minROI)} to ${formatROI(maxROI)} (likely ${formatROI(likelyROI)})`,
  }
}

/**
 * Compare payouts across bet types for the same horses
 */
export function comparePayouts(
  horses: HorseOdds[],
  budget: number
): Record<ExoticBetType, PayoutEstimate | null> {
  const result: Record<ExoticBetType, PayoutEstimate | null> = {
    exacta: null,
    trifecta: null,
    superfecta: null,
  }

  if (horses.length >= 2) {
    // Exacta: 2-horse box
    const exactaCombos = horses.length * (horses.length - 1)
    const exactaBaseBet = Math.min(5, budget / exactaCombos)
    result.exacta = estimateExoticPayout('exacta', horses, exactaBaseBet, exactaCombos)
  }

  if (horses.length >= 3) {
    // Trifecta: 3-horse box
    const trifectaCombos = horses.length * (horses.length - 1) * (horses.length - 2)
    const trifectaBaseBet = Math.min(2, budget / trifectaCombos)
    result.trifecta = estimateExoticPayout('trifecta', horses, trifectaBaseBet, trifectaCombos)
  }

  if (horses.length >= 4) {
    // Superfecta: 4-horse box
    const superfectaCombos = horses.length * (horses.length - 1) * (horses.length - 2) * (horses.length - 3)
    const superfectaBaseBet = Math.min(0.5, budget / superfectaCombos)
    result.superfecta = estimateExoticPayout('superfecta', horses, superfectaBaseBet, superfectaCombos)
  }

  return result
}
