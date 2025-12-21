/**
 * Value Betting Strategy Generator
 *
 * Generates value-focused betting strategies based on EV analysis.
 *
 * Core Rules:
 * - Only bet horses with positive EV
 * - Bet size proportional to edge (Kelly Criterion integration)
 * - Prioritize highest EV bets within budget
 * - Avoid favorites with negative EV (even if high score)
 * - Embrace longshots with positive EV
 *
 * Strategy Modes:
 * - Pure Value: Only bet positive EV (ignore confidence)
 * - Balanced Value: Positive EV + minimum confidence threshold
 * - Conservative Value: Strong EV (25%+) only
 *
 * @module value/valueBetting
 */

import { logger } from '../../services/logging'
import type { HorseEntry, RaceHeader } from '../../types/drf'
import type { HorseScore } from '../scoring'
import { parseOddsToDecimal } from '../betting/kellyCriterion'
import {
  analyzeValue,
  VALUE_CLASSIFICATION_META,
  type ValueAnalysis,
  type ValueClassification,
} from './valueDetector'
import {
  analyzeMarketInefficiency,
  type MarketInefficiencyAnalysis,
} from './marketInefficiency'
import type { CalibrationProfile } from './confidenceCalibration'

// ============================================================================
// TYPES
// ============================================================================

/** Betting strategy mode */
export type ValueStrategyMode =
  | 'pure_value'       // Only positive EV matters
  | 'balanced_value'   // Positive EV + minimum confidence
  | 'conservative_value' // Strong EV (25%+) only

/** Individual value bet in the plan */
export interface ValueBet {
  /** Program number */
  programNumber: number
  /** Horse name */
  horseName: string
  /** Bet type (win, place, show) */
  betType: 'win' | 'place' | 'show'
  /** Recommended bet amount */
  recommendedAmount: number
  /** Minimum bet amount */
  minAmount: number
  /** Maximum bet amount */
  maxAmount: number
  /** Expected value per dollar */
  evPerDollar: number
  /** EV percentage */
  evPercent: number
  /** Edge over market */
  edge: number
  /** Our win probability */
  ourProbability: number
  /** Market probability */
  marketProbability: number
  /** Value classification */
  classification: ValueClassification
  /** Urgency level */
  urgency: 'immediate' | 'high' | 'standard' | 'low'
  /** Confidence in bet (0-100) */
  confidence: number
  /** Kelly fraction (0-1) */
  kellyFraction: number
  /** Display odds */
  oddsDisplay: string
  /** Decimal odds */
  decimalOdds: number
  /** Market inefficiency detected */
  inefficiency: MarketInefficiencyAnalysis | null
  /** Reasoning for bet */
  reasoning: string[]
  /** Is this a longshot? */
  isLongshot: boolean
  /** Is this a favorite? */
  isFavorite: boolean
  /** Score */
  score: number
  /** Rank in value order (1 = best value) */
  valueRank: number
}

/** Complete value betting plan */
export interface ValueBettingPlan {
  /** Strategy mode used */
  mode: ValueStrategyMode
  /** All analyzed bets (including passes) */
  allAnalyzed: ValueBet[]
  /** Recommended bets only */
  recommendedBets: ValueBet[]
  /** Bets to avoid (negative EV) */
  avoidBets: ValueBet[]
  /** Total recommended wager */
  totalRecommendedWager: number
  /** Total expected profit */
  expectedProfit: number
  /** Expected ROI percentage */
  expectedROI: number
  /** Best single bet */
  bestBet: ValueBet | null
  /** Count of positive EV bets */
  positiveEVCount: number
  /** Count of negative EV bets */
  negativeEVCount: number
  /** Summary statistics */
  stats: {
    averageEV: number
    maxEV: number
    averageEdge: number
    maxEdge: number
    totalBetValue: number
    eliteValueCount: number
    strongValueCount: number
    longshotCount: number
    favoriteAvoidCount: number
  }
  /** Strategy explanation */
  strategyExplanation: string[]
  /** Warnings */
  warnings: string[]
}

/** Strategy configuration */
export interface ValueStrategyConfig {
  /** Strategy mode */
  mode: ValueStrategyMode
  /** Available bankroll for this race */
  raceBudget: number
  /** Total bankroll */
  totalBankroll: number
  /** Minimum bet size */
  minBetSize: number
  /** Maximum bet size per horse */
  maxBetSize: number
  /** Maximum percentage of budget per bet */
  maxBudgetPercentPerBet: number
  /** Minimum EV threshold (override for mode) */
  minEVThreshold?: number
  /** Minimum confidence threshold (0-100) */
  minConfidence?: number
  /** Include place/show bets */
  includePlaceShow?: boolean
  /** Calibration profile to use */
  calibration?: CalibrationProfile
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default strategy configuration */
export const DEFAULT_STRATEGY_CONFIG: ValueStrategyConfig = {
  mode: 'balanced_value',
  raceBudget: 50,
  totalBankroll: 500,
  minBetSize: 2,
  maxBetSize: 20,
  maxBudgetPercentPerBet: 30,
  minConfidence: 50,
  includePlaceShow: false,
}

/** Mode-specific EV thresholds */
export const MODE_EV_THRESHOLDS: Record<ValueStrategyMode, number> = {
  pure_value: 0.01,      // Any positive EV
  balanced_value: 5,     // 5%+ EV
  conservative_value: 25, // 25%+ EV (strong value only)
}

/** Mode-specific confidence thresholds */
export const MODE_CONFIDENCE_THRESHOLDS: Record<ValueStrategyMode, number> = {
  pure_value: 0,         // No confidence requirement
  balanced_value: 50,    // 50%+ confidence
  conservative_value: 65, // 65%+ confidence
}

/** Longshot threshold (decimal odds) */
const LONGSHOT_ODDS_THRESHOLD = 8.0

/** Favorite threshold (decimal odds) */
const FAVORITE_ODDS_THRESHOLD = 3.0

// ============================================================================
// KELLY CRITERION INTEGRATION
// ============================================================================

/**
 * Calculate Kelly fraction for a bet
 *
 * Kelly = (edge × probability of win) / (decimal odds - 1)
 * Capped at 25% of bankroll for safety
 */
function calculateKellyFraction(
  winProbability: number,
  decimalOdds: number,
  edge: number
): number {
  if (edge <= 0 || winProbability <= 0) return 0
  if (decimalOdds <= 1) return 0

  const prob = winProbability / 100
  const profit = decimalOdds - 1

  // Kelly formula: (bp - q) / b
  // where b = odds profit, p = win prob, q = lose prob
  const kelly = (profit * prob - (1 - prob)) / profit

  // Cap at 25% (quarter Kelly is safer)
  return Math.max(0, Math.min(0.25, kelly))
}

/**
 * Calculate recommended bet size based on Kelly and config
 */
function calculateBetSize(
  kellyFraction: number,
  evPercent: number,
  config: ValueStrategyConfig
): { recommended: number; min: number; max: number } {
  const { raceBudget, minBetSize, maxBetSize, maxBudgetPercentPerBet } = config

  // Kelly-based amount
  const kellyAmount = kellyFraction * raceBudget

  // EV-scaled amount (higher EV = can bet more)
  const evScale = Math.min(1.5, 0.5 + (evPercent / 100))
  const scaledAmount = kellyAmount * evScale

  // Budget percentage cap
  const maxFromBudget = (maxBudgetPercentPerBet / 100) * raceBudget

  // Calculate bounds
  const max = Math.min(maxBetSize, maxFromBudget)
  const min = minBetSize
  const recommended = Math.max(min, Math.min(max, Math.round(scaledAmount)))

  return { recommended, min, max }
}

// ============================================================================
// BET GENERATION
// ============================================================================

/**
 * Generate a value bet entry from analysis
 */
function createValueBet(
  horse: HorseEntry,
  score: HorseScore,
  valueAnalysis: ValueAnalysis,
  inefficiency: MarketInefficiencyAnalysis,
  config: ValueStrategyConfig,
  valueRank: number
): ValueBet {
  const decimalOdds = parseOddsToDecimal(horse.morningLineOdds)
  const isLongshot = decimalOdds >= LONGSHOT_ODDS_THRESHOLD
  const isFavorite = decimalOdds < FAVORITE_ODDS_THRESHOLD

  const kellyFraction = calculateKellyFraction(
    valueAnalysis.ourProbability,
    decimalOdds,
    valueAnalysis.edge
  )

  const betSizes = calculateBetSize(kellyFraction, valueAnalysis.evPercent, config)

  // Confidence combines score quality + data quality
  const confidence = Math.min(100, Math.round(
    (score.dataQuality * 0.3) +
    (valueAnalysis.ourProbability * 0.3) +
    (Math.min(100, valueAnalysis.evPercent * 2) * 0.4)
  ))

  // Build reasoning
  const reasoning: string[] = [
    `Our probability: ${valueAnalysis.ourProbability.toFixed(1)}%`,
    `Market probability: ${valueAnalysis.marketProbability.toFixed(1)}%`,
    `Edge: ${valueAnalysis.edge > 0 ? '+' : ''}${valueAnalysis.edge.toFixed(1)}%`,
    `Expected value: ${valueAnalysis.evPercent > 0 ? '+' : ''}${valueAnalysis.evPercent.toFixed(1)}% per dollar`,
  ]

  if (inefficiency.hasExploitableInefficiency && inefficiency.primaryInefficiency) {
    reasoning.push(`Market inefficiency: ${inefficiency.primaryInefficiency.title}`)
  }

  if (isLongshot && valueAnalysis.isPositiveEV) {
    reasoning.push('Positive EV longshot - good value despite low probability')
  }

  if (isFavorite && !valueAnalysis.isPositiveEV) {
    reasoning.push('Favorite with negative EV - avoid despite high win probability')
  }

  return {
    programNumber: horse.programNumber,
    horseName: horse.horseName,
    betType: 'win',
    recommendedAmount: betSizes.recommended,
    minAmount: betSizes.min,
    maxAmount: betSizes.max,
    evPerDollar: valueAnalysis.evPerDollar,
    evPercent: valueAnalysis.evPercent,
    edge: valueAnalysis.edge,
    ourProbability: valueAnalysis.ourProbability,
    marketProbability: valueAnalysis.marketProbability,
    classification: valueAnalysis.classification,
    urgency: valueAnalysis.urgency === 'none' ? 'low' : valueAnalysis.urgency,
    confidence,
    kellyFraction,
    oddsDisplay: horse.morningLineOdds,
    decimalOdds,
    inefficiency: inefficiency.hasExploitableInefficiency ? inefficiency : null,
    reasoning,
    isLongshot,
    isFavorite,
    score: score.total,
    valueRank,
  }
}

/**
 * Filter bets based on strategy mode
 */
function filterByMode(
  bets: ValueBet[],
  mode: ValueStrategyMode,
  config: ValueStrategyConfig
): ValueBet[] {
  const minEV = config.minEVThreshold ?? MODE_EV_THRESHOLDS[mode]
  const minConf = config.minConfidence ?? MODE_CONFIDENCE_THRESHOLDS[mode]

  return bets.filter(bet => {
    // Must have positive EV above threshold
    if (bet.evPercent < minEV) return false

    // Confidence check for balanced/conservative modes
    if (mode !== 'pure_value' && bet.confidence < minConf) return false

    return true
  })
}

/**
 * Optimize bet allocation within budget
 */
function optimizeBetAllocation(
  bets: ValueBet[],
  config: ValueStrategyConfig
): ValueBet[] {
  if (bets.length === 0) return []

  const { raceBudget, maxBudgetPercentPerBet } = config

  // Sort by EV descending
  const sorted = [...bets].sort((a, b) => b.evPercent - a.evPercent)

  let remainingBudget = raceBudget
  const optimized: ValueBet[] = []

  for (const bet of sorted) {
    if (remainingBudget <= 0) break

    const maxAllocation = Math.min(
      bet.maxAmount,
      remainingBudget,
      (maxBudgetPercentPerBet / 100) * raceBudget
    )

    if (maxAllocation >= bet.minAmount) {
      // Allocate based on EV proportion
      const evWeight = bet.evPercent / sorted[0].evPercent // Relative to best
      const allocation = Math.round(maxAllocation * Math.min(1, evWeight))

      if (allocation >= bet.minAmount) {
        optimized.push({
          ...bet,
          recommendedAmount: allocation,
        })
        remainingBudget -= allocation
      }
    }
  }

  return optimized
}

// ============================================================================
// MAIN STRATEGY GENERATOR
// ============================================================================

/**
 * Generate value betting plan for a race
 */
export function generateValueBettingPlan(
  horses: Array<{ horse: HorseEntry; score: HorseScore }>,
  raceHeader: RaceHeader,
  config: Partial<ValueStrategyConfig> = {}
): ValueBettingPlan {
  const fullConfig: ValueStrategyConfig = { ...DEFAULT_STRATEGY_CONFIG, ...config }

  // Filter out scratched horses
  const activeHorses = horses.filter(h => !h.score.isScratched)

  // Analyze each horse
  const allAnalyzed: ValueBet[] = activeHorses.map(({ horse, score }, idx) => {
    const valueAnalysis = analyzeValue(horse, score, fullConfig.calibration)
    const inefficiency = analyzeMarketInefficiency(horse, score, raceHeader)

    return createValueBet(horse, score, valueAnalysis, inefficiency, fullConfig, idx + 1)
  })

  // Sort by EV for ranking
  allAnalyzed.sort((a, b) => b.evPercent - a.evPercent)
  allAnalyzed.forEach((bet, idx) => {
    bet.valueRank = idx + 1
  })

  // Filter based on mode
  const passingBets = filterByMode(allAnalyzed, fullConfig.mode, fullConfig)

  // Separate avoid bets (negative EV favorites especially)
  const avoidBets = allAnalyzed.filter(bet =>
    bet.evPercent < 0 || (bet.isFavorite && bet.evPercent < MODE_EV_THRESHOLDS[fullConfig.mode])
  )

  // Optimize allocation
  const recommendedBets = optimizeBetAllocation(passingBets, fullConfig)

  // Calculate totals
  const totalRecommendedWager = recommendedBets.reduce((sum, b) => sum + b.recommendedAmount, 0)
  const expectedProfit = recommendedBets.reduce((sum, b) =>
    sum + (b.evPerDollar * b.recommendedAmount), 0
  )
  const expectedROI = totalRecommendedWager > 0
    ? (expectedProfit / totalRecommendedWager) * 100
    : 0

  // Stats
  const evValues = allAnalyzed.map(b => b.evPercent)
  const edgeValues = allAnalyzed.map(b => b.edge)

  const stats = {
    averageEV: evValues.reduce((s, v) => s + v, 0) / evValues.length || 0,
    maxEV: Math.max(...evValues, 0),
    averageEdge: edgeValues.reduce((s, v) => s + v, 0) / edgeValues.length || 0,
    maxEdge: Math.max(...edgeValues, 0),
    totalBetValue: totalRecommendedWager,
    eliteValueCount: recommendedBets.filter(b => b.classification === 'elite_value').length,
    strongValueCount: recommendedBets.filter(b => b.classification === 'strong_value').length,
    longshotCount: recommendedBets.filter(b => b.isLongshot).length,
    favoriteAvoidCount: avoidBets.filter(b => b.isFavorite).length,
  }

  // Generate explanation
  const strategyExplanation = generateStrategyExplanation(fullConfig.mode, stats, recommendedBets)

  // Generate warnings
  const warnings = generateWarnings(recommendedBets, avoidBets, fullConfig)

  logger.logInfo('Value betting plan generated', {
    component: 'valueBetting',
    mode: fullConfig.mode,
    recommendedCount: recommendedBets.length,
    totalWager: totalRecommendedWager,
    expectedROI: expectedROI.toFixed(1),
  })

  return {
    mode: fullConfig.mode,
    allAnalyzed,
    recommendedBets,
    avoidBets,
    totalRecommendedWager,
    expectedProfit,
    expectedROI,
    bestBet: recommendedBets.length > 0 ? recommendedBets[0] : null,
    positiveEVCount: allAnalyzed.filter(b => b.evPercent > 0).length,
    negativeEVCount: allAnalyzed.filter(b => b.evPercent < 0).length,
    stats,
    strategyExplanation,
    warnings,
  }
}

/**
 * Generate strategy explanation text
 */
function generateStrategyExplanation(
  mode: ValueStrategyMode,
  stats: ValueBettingPlan['stats'],
  bets: ValueBet[]
): string[] {
  const explanations: string[] = []

  switch (mode) {
    case 'pure_value':
      explanations.push('Pure Value mode: Betting any positive expected value, regardless of confidence.')
      break
    case 'balanced_value':
      explanations.push('Balanced Value mode: Positive EV bets with reasonable confidence threshold.')
      break
    case 'conservative_value':
      explanations.push('Conservative Value mode: Only strong value (25%+ EV) with high confidence.')
      break
  }

  if (bets.length === 0) {
    explanations.push('No bets meet the value threshold for this race. Consider passing or waiting for better spots.')
    return explanations
  }

  if (stats.eliteValueCount > 0) {
    explanations.push(`${stats.eliteValueCount} elite value bet(s) detected - highest priority.`)
  }

  if (stats.strongValueCount > 0) {
    explanations.push(`${stats.strongValueCount} strong value bet(s) available.`)
  }

  if (stats.longshotCount > 0) {
    explanations.push(`${stats.longshotCount} positive EV longshot(s) included - good value despite lower probability.`)
  }

  if (stats.favoriteAvoidCount > 0) {
    explanations.push(`Avoiding ${stats.favoriteAvoidCount} favorite(s) with negative EV.`)
  }

  explanations.push(
    `Total wagered: $${stats.totalBetValue}. Expected ROI: ${((stats.maxEV + stats.averageEV) / 2).toFixed(1)}%.`
  )

  return explanations
}

/**
 * Generate warning messages
 */
function generateWarnings(
  recommended: ValueBet[],
  avoid: ValueBet[],
  config: ValueStrategyConfig
): string[] {
  const warnings: string[] = []

  // No value plays
  if (recommended.length === 0) {
    warnings.push('No positive EV bets found. Consider sitting this race out.')
  }

  // All longshots
  if (recommended.length > 0 && recommended.every(b => b.isLongshot)) {
    warnings.push('All value plays are longshots. High variance expected.')
  }

  // Low confidence
  const lowConfBets = recommended.filter(b => b.confidence < 50)
  if (lowConfBets.length > recommended.length / 2) {
    warnings.push('Many bets have low confidence. Data quality may be limited.')
  }

  // Avoiding the favorite
  const favoriteAvoid = avoid.find(b => b.isFavorite && b.evPercent < -10)
  if (favoriteAvoid) {
    warnings.push(`Favorite (#${favoriteAvoid.programNumber}) is negative EV. Public may be overbet.`)
  }

  // Budget warning
  const totalWager = recommended.reduce((s, b) => s + b.recommendedAmount, 0)
  if (totalWager > config.raceBudget * 0.8) {
    warnings.push('Betting near maximum budget for this race. Ensure bankroll management.')
  }

  return warnings
}

// ============================================================================
// PRESET STRATEGIES
// ============================================================================

/**
 * Get Pure Value strategy (most aggressive)
 */
export function getPureValueStrategy(
  horses: Array<{ horse: HorseEntry; score: HorseScore }>,
  raceHeader: RaceHeader,
  budget: number = 50
): ValueBettingPlan {
  return generateValueBettingPlan(horses, raceHeader, {
    mode: 'pure_value',
    raceBudget: budget,
    minConfidence: 0,
    minEVThreshold: 0.01,
  })
}

/**
 * Get Balanced Value strategy (recommended default)
 */
export function getBalancedValueStrategy(
  horses: Array<{ horse: HorseEntry; score: HorseScore }>,
  raceHeader: RaceHeader,
  budget: number = 50
): ValueBettingPlan {
  return generateValueBettingPlan(horses, raceHeader, {
    mode: 'balanced_value',
    raceBudget: budget,
    minConfidence: 50,
    minEVThreshold: 5,
  })
}

/**
 * Get Conservative Value strategy (safest)
 */
export function getConservativeValueStrategy(
  horses: Array<{ horse: HorseEntry; score: HorseScore }>,
  raceHeader: RaceHeader,
  budget: number = 50
): ValueBettingPlan {
  return generateValueBettingPlan(horses, raceHeader, {
    mode: 'conservative_value',
    raceBudget: budget,
    minConfidence: 65,
    minEVThreshold: 25,
  })
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format value bet for display
 */
export function formatValueBetDisplay(bet: ValueBet): string {
  const meta = VALUE_CLASSIFICATION_META[bet.classification]
  return `#${bet.programNumber} ${bet.horseName} - ${meta.shortName} (${bet.evPercent.toFixed(0)}% EV)`
}

/**
 * Get color for value bet
 */
export function getValueBetColor(bet: ValueBet): string {
  return VALUE_CLASSIFICATION_META[bet.classification].color
}

/**
 * Get icon for value bet
 */
export function getValueBetIcon(bet: ValueBet): string {
  return VALUE_CLASSIFICATION_META[bet.classification].icon
}

/**
 * Get urgency color
 */
export function getUrgencyColor(urgency: ValueBet['urgency']): string {
  switch (urgency) {
    case 'immediate': return '#fbbf24' // Gold
    case 'high': return '#22c55e' // Green
    case 'standard': return '#3b82f6' // Blue
    case 'low': return '#9ca3af' // Gray
    default: return '#6b7280'
  }
}

/**
 * Format bet sizing explanation
 */
export function formatBetSizing(bet: ValueBet): string {
  if (bet.evPercent < 0) {
    return 'No bet recommended - negative expected value'
  }

  const kellyPercent = (bet.kellyFraction * 100).toFixed(1)

  if (bet.classification === 'elite_value') {
    return `$${bet.recommendedAmount} recommended (${kellyPercent}% Kelly) - Elite value, bet aggressively`
  }
  if (bet.classification === 'strong_value') {
    return `$${bet.recommendedAmount} recommended (${kellyPercent}% Kelly) - Strong value`
  }
  if (bet.classification === 'moderate_value') {
    return `$${bet.recommendedAmount} recommended (${kellyPercent}% Kelly) - Moderate value`
  }

  return `$${bet.minAmount}-${bet.maxAmount} range - Slight value, bet conservatively`
}
