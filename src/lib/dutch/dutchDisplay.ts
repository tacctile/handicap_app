/**
 * Dutch Book Display Module
 *
 * Formats Dutch betting instructions for display:
 * - Clear summary of Dutch book opportunity
 * - Individual bet amounts and instructions
 * - Window instructions format for betting
 * - Guaranteed return and profit display
 *
 * @module dutch/dutchDisplay
 */

import type { DutchResult, DutchBet } from './dutchCalculator'
import type { DutchCombination } from './dutchOptimizer'
import type { EdgeClassification } from './dutchValidator'
import { EDGE_COLORS, EDGE_ICONS } from './dutchValidator'

// ============================================================================
// TYPES
// ============================================================================

export interface DutchDisplaySummary {
  /** Main headline */
  headline: string
  /** Short description */
  description: string
  /** Badge text (e.g., "5.2% edge") */
  badgeText: string
  /** Badge color */
  badgeColor: string
  /** Is this profitable? */
  isProfitable: boolean
  /** Icon to display */
  icon: string
}

export interface DutchBetInstruction {
  /** Program number */
  programNumber: number
  /** Horse name */
  horseName: string
  /** Bet amount display (e.g., "$54.80") */
  amountDisplay: string
  /** Window instruction (e.g., "$55 to win on the 3") */
  windowInstruction: string
  /** Short instruction (e.g., "$55 Win #3") */
  shortInstruction: string
  /** Odds display */
  oddsDisplay: string
  /** Return if wins display */
  returnIfWinsDisplay: string
}

export interface DutchFullDisplay {
  /** Summary section */
  summary: DutchDisplaySummary
  /** Individual bet instructions */
  bets: DutchBetInstruction[]
  /** Total investment display */
  totalInvestmentDisplay: string
  /** Guaranteed return display */
  guaranteedReturnDisplay: string
  /** Guaranteed profit display */
  guaranteedProfitDisplay: string
  /** ROI display */
  roiDisplay: string
  /** Edge display */
  edgeDisplay: string
  /** Window instructions combined */
  allWindowInstructions: string
  /** Explanation text */
  explanationText: string[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Display labels for edge classes */
export const EDGE_CLASS_LABELS: Record<EdgeClassification, string> = {
  excellent: 'Excellent Edge',
  good: 'Good Edge',
  moderate: 'Moderate Edge',
  marginal: 'Marginal Edge',
  unprofitable: 'No Edge',
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format currency for window (rounded to nearest $0.10)
 */
export function formatCurrencyForWindow(amount: number): string {
  const rounded = Math.round(amount * 10) / 10
  if (rounded === Math.floor(rounded)) {
    return `$${rounded}`
  }
  return `$${rounded.toFixed(2)}`
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

/**
 * Format ROI for display
 */
export function formatROI(roiPercent: number): string {
  return `${roiPercent >= 0 ? '+' : ''}${roiPercent.toFixed(0)}% ROI`
}

// ============================================================================
// DISPLAY GENERATION
// ============================================================================

/**
 * Generate display summary for a Dutch result
 */
export function generateDutchSummary(
  result: DutchResult,
  edgeClass: EdgeClassification = 'moderate'
): DutchDisplaySummary {
  if (!result.isValid || !result.hasProfitPotential) {
    return {
      headline: 'No Profitable Dutch Available',
      description: result.error || 'Combined odds do not allow for guaranteed profit',
      badgeText: 'No Edge',
      badgeColor: EDGE_COLORS.unprofitable,
      isProfitable: false,
      icon: 'block',
    }
  }

  const headline = `Dutch Book: ${result.horseCount} horses for guaranteed profit`
  const description = `${formatCurrency(result.actualTotalCost)} stake returns ${formatCurrency(result.guaranteedReturn)} if any wins`
  const badgeText = `${result.edgePercent.toFixed(1)}% edge - Guaranteed profit`
  const badgeColor = EDGE_COLORS[edgeClass]
  const icon = EDGE_ICONS[edgeClass]

  return {
    headline,
    description,
    badgeText,
    badgeColor,
    isProfitable: true,
    icon,
  }
}

/**
 * Generate individual bet instruction
 */
export function generateBetInstruction(bet: DutchBet, raceNumber?: number): DutchBetInstruction {
  const racePrefix = raceNumber ? `Race ${raceNumber}, ` : ''
  const roundedAmount = formatCurrencyForWindow(bet.betAmountRounded)

  return {
    programNumber: bet.programNumber,
    horseName: bet.horseName,
    amountDisplay: formatCurrency(bet.betAmountRounded),
    windowInstruction: `"${racePrefix}${roundedAmount} to win on the ${bet.programNumber}"`,
    shortInstruction: `${roundedAmount} Win #${bet.programNumber}`,
    oddsDisplay: bet.oddsDisplay,
    returnIfWinsDisplay: formatCurrency(bet.returnIfWins),
  }
}

/**
 * Generate full Dutch display with all components
 */
export function generateFullDutchDisplay(
  result: DutchResult,
  edgeClass: EdgeClassification = 'moderate',
  raceNumber?: number
): DutchFullDisplay {
  const summary = generateDutchSummary(result, edgeClass)

  const bets = result.bets.map((bet) => generateBetInstruction(bet, raceNumber))

  // Combine all window instructions
  const allWindowInstructions = bets
    .map((bet) => bet.windowInstruction.replace(/^"|"$/g, ''))
    .join('\n')

  // Generate explanation text
  const explanationText = generateDutchExplanation(result)

  return {
    summary,
    bets,
    totalInvestmentDisplay: formatCurrency(result.actualTotalCost),
    guaranteedReturnDisplay: formatCurrency(result.guaranteedReturn),
    guaranteedProfitDisplay: formatCurrency(result.guaranteedProfit),
    roiDisplay: formatROI(result.roiPercent),
    edgeDisplay: `${result.edgePercent.toFixed(1)}%`,
    allWindowInstructions,
    explanationText,
  }
}

// ============================================================================
// EXPLANATION GENERATION
// ============================================================================

/**
 * Generate explanation text for a Dutch book
 */
export function generateDutchExplanation(result: DutchResult): string[] {
  if (!result.isValid || !result.hasProfitPotential) {
    return ['This Dutch combination is not profitable.']
  }

  const explanations: string[] = []

  // Main reason
  explanations.push(
    `Why Dutch? ${result.horseCount} horses all have overlays (${result.edgePercent.toFixed(1)}% total edge)`
  )

  // Show what happens if each horse wins
  for (const bet of result.bets.slice(0, 3)) {
    explanations.push(
      `If #${bet.programNumber} wins at ${bet.oddsDisplay}: return ${formatCurrency(bet.returnIfWins)}`
    )
  }

  if (result.bets.length > 3) {
    explanations.push(`...and ${result.bets.length - 3} more horses with similar returns`)
  }

  // Profit guarantee
  explanations.push(
    `Profit guaranteed: ${formatCurrency(result.guaranteedProfit)} (${result.roiPercent.toFixed(0)}% ROI)`
  )

  return explanations
}

/**
 * Generate compact explanation for Dutch bet
 */
export function generateCompactExplanation(result: DutchResult): string {
  if (!result.hasProfitPotential) {
    return 'No profit possible with these odds'
  }

  return `${result.edgePercent.toFixed(1)}% edge: ${formatCurrency(result.actualTotalCost)} → ${formatCurrency(result.guaranteedReturn)} guaranteed`
}

// ============================================================================
// COMBINATION DISPLAY
// ============================================================================

/**
 * Format Dutch combination for display
 */
export function formatDutchCombination(combination: DutchCombination): {
  title: string
  subtitle: string
  badge: string
  badgeColor: string
  horses: string
  stats: Array<{ label: string; value: string }>
} {
  const title = `${combination.horseCount}-Horse Dutch`
  const subtitle = combination.description
  const badge = `${combination.edgePercent.toFixed(1)}% edge`
  const badgeColor = EDGE_COLORS[combination.edgeClass]
  const horses = combination.horses.map((h) => `#${h.programNumber}`).join(', ')

  const stats = [
    { label: 'Edge', value: `${combination.edgePercent.toFixed(1)}%` },
    { label: 'Avg Confidence', value: `${combination.avgConfidence}%` },
    { label: 'Tier Mix', value: combination.tierMix },
  ]

  if (combination.dutchResult) {
    stats.push({
      label: 'ROI',
      value: `${combination.dutchResult.roiPercent.toFixed(0)}%`,
    })
  }

  return {
    title,
    subtitle,
    badge,
    badgeColor,
    horses,
    stats,
  }
}

/**
 * Generate ranking display for multiple Dutch options
 */
export function generateDutchRankingDisplay(
  combinations: DutchCombination[]
): Array<{
  rank: number
  display: ReturnType<typeof formatDutchCombination>
  isRecommended: boolean
}> {
  return combinations.map((combo, index) => ({
    rank: index + 1,
    display: formatDutchCombination(combo),
    isRecommended: index === 0 || combo.recommendationStrength >= 70,
  }))
}

// ============================================================================
// WINDOW INSTRUCTION FORMATTING
// ============================================================================

/**
 * Format single window instruction
 */
export function formatWindowInstruction(
  programNumber: number,
  amount: number,
  raceNumber?: number
): string {
  const racePrefix = raceNumber ? `Race ${raceNumber}, ` : ''
  const roundedAmount = formatCurrencyForWindow(amount)
  return `${racePrefix}${roundedAmount} to win on the ${programNumber}`
}

/**
 * Format all window instructions for a Dutch
 */
export function formatAllWindowInstructions(
  result: DutchResult,
  raceNumber?: number
): string[] {
  return result.bets.map((bet) =>
    formatWindowInstruction(bet.programNumber, bet.betAmountRounded, raceNumber)
  )
}

/**
 * Format Dutch as copyable text
 */
export function formatDutchForCopy(
  result: DutchResult,
  raceNumber?: number
): string {
  const lines: string[] = []

  lines.push(`Dutch Book - Race ${raceNumber ?? '?'}`)
  lines.push('='.repeat(30))
  lines.push('')

  for (const bet of result.bets) {
    lines.push(formatWindowInstruction(bet.programNumber, bet.betAmountRounded))
  }

  lines.push('')
  lines.push(`Total: ${formatCurrency(result.actualTotalCost)}`)
  lines.push(`Guaranteed Return: ${formatCurrency(result.guaranteedReturn)}`)
  lines.push(`Profit: ${formatCurrency(result.guaranteedProfit)} (${result.roiPercent.toFixed(0)}% ROI)`)
  lines.push(`Edge: ${result.edgePercent.toFixed(1)}%`)

  return lines.join('\n')
}

// ============================================================================
// BUILDER DISPLAY HELPERS
// ============================================================================

/**
 * Format live calculation display for Dutch builder
 */
export function formatLiveCalculation(result: DutchResult | null): {
  isValid: boolean
  betBreakdown: string[]
  totalStake: string
  guaranteedReturn: string
  profit: string
  edge: string
  warning: string | null
} {
  if (!result) {
    return {
      isValid: false,
      betBreakdown: [],
      totalStake: '-',
      guaranteedReturn: '-',
      profit: '-',
      edge: '-',
      warning: 'Select at least 2 horses',
    }
  }

  if (!result.isValid) {
    return {
      isValid: false,
      betBreakdown: [],
      totalStake: formatCurrency(result.totalStake),
      guaranteedReturn: '-',
      profit: '-',
      edge: '-',
      warning: result.error || 'Invalid Dutch configuration',
    }
  }

  const betBreakdown = result.bets.map(
    (bet) =>
      `#${bet.programNumber}: ${formatCurrency(bet.betAmountRounded)} → ${formatCurrency(bet.returnIfWins)} if wins`
  )

  let warning: string | null = null
  if (!result.hasProfitPotential) {
    warning = `No profit possible (book is ${(result.sumOfImpliedProbs * 100).toFixed(1)}%)`
  } else if (result.warnings.length > 0) {
    warning = result.warnings[0]
  }

  return {
    isValid: true,
    betBreakdown,
    totalStake: formatCurrency(result.actualTotalCost),
    guaranteedReturn: formatCurrency(result.guaranteedReturn),
    profit: formatCurrency(result.guaranteedProfit),
    edge: `${result.edgePercent.toFixed(1)}%`,
    warning,
  }
}

/**
 * Format horse option for Dutch builder selection
 */
export function formatHorseOption(horse: {
  programNumber: number
  horseName: string
  oddsDisplay: string
  impliedProbability: number
}): {
  value: number
  label: string
  odds: string
  prob: string
} {
  return {
    value: horse.programNumber,
    label: `#${horse.programNumber} ${horse.horseName}`,
    odds: horse.oddsDisplay,
    prob: `${(horse.impliedProbability * 100).toFixed(1)}%`,
  }
}
