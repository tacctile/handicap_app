/**
 * Carryover Tracker for Pick 5/6
 *
 * Tracks and analyzes carryover pools for Pick 5 and Pick 6 bets:
 * - Parse carryover amounts from DRF or manual input
 * - Calculate carryover value and EV impact
 * - Flag high-value carryover days
 * - Track mandatory payout dates
 */

import { validateNumber, sanitizeString } from '../sanitization'
import {
  type CarryoverInfo,
  type MultiRaceBetType,
  CARRYOVER_THRESHOLDS,
  getBetConfig,
} from './multiraceTypes'

// ============================================================================
// CONSTANTS
// ============================================================================

/** High-value carryover threshold for alerts */
export const HIGH_VALUE_THRESHOLD = 50000

/** Local storage key for saved carryovers */
const CARRYOVER_STORAGE_KEY = 'multirace_carryovers'

/** How long carryover data is considered fresh (hours) */
const DATA_FRESHNESS_HOURS = 6

// ============================================================================
// CARRYOVER VALUE CLASSIFICATION
// ============================================================================

/**
 * Classify carryover value based on amount
 */
export function classifyCarryoverValue(
  betType: 'pick_5' | 'pick_6',
  amount: number
): 'low' | 'medium' | 'high' | 'exceptional' {
  const thresholds = CARRYOVER_THRESHOLDS[betType]

  if (amount >= thresholds.exceptional) return 'exceptional'
  if (amount >= thresholds.high) return 'high'
  if (amount >= thresholds.medium) return 'medium'
  return 'low'
}

/**
 * Get recommendation based on carryover value
 */
export function getCarryoverRecommendation(
  betType: 'pick_5' | 'pick_6',
  amount: number,
  isMandatory: boolean
): string {
  const valueClass = classifyCarryoverValue(betType, amount)
  const config = getBetConfig(betType)

  if (isMandatory) {
    return `MANDATORY PAYOUT DAY - Entire ${config.displayName} pool must be paid out today. High action expected.`
  }

  switch (valueClass) {
    case 'exceptional':
      return `Exceptional carryover ($${formatCarryoverAmount(amount)}) - Consider increased investment. Pool edge significantly in player's favor.`
    case 'high':
      return `High-value carryover day ($${formatCarryoverAmount(amount)}) - Good opportunity for multi-race action.`
    case 'medium':
      return `Moderate carryover ($${formatCarryoverAmount(amount)}) - Worth considering if you like the races.`
    case 'low':
      return amount > 0
        ? `Small carryover ($${formatCarryoverAmount(amount)}) - Normal pool expected.`
        : 'No carryover - Fresh pool starting today.'
    default:
      return ''
  }
}

/**
 * Format carryover amount for display
 */
export function formatCarryoverAmount(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)}M`
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`
  }
  return amount.toFixed(0)
}

// ============================================================================
// CARRYOVER CREATION
// ============================================================================

/**
 * Create carryover info from raw data
 */
export function createCarryoverInfo(params: {
  betType: 'pick_5' | 'pick_6'
  trackCode: string
  trackName: string
  carryoverAmount: number
  daysWithoutWinner?: number
  estimatedPoolToday?: number
  isMandatory?: boolean
  mandatoryDate?: string
}): CarryoverInfo {
  const {
    betType,
    trackCode,
    trackName,
    carryoverAmount,
    daysWithoutWinner = 0,
    estimatedPoolToday = 0,
    isMandatory = false,
    mandatoryDate,
  } = params

  const validatedAmount = validateNumber(carryoverAmount, 0, { min: 0, max: 100000000 })
  const validatedPool = validateNumber(estimatedPoolToday, 0, { min: 0, max: 100000000 })
  const totalPool = validatedAmount + validatedPool

  const valueClass = classifyCarryoverValue(betType, validatedAmount)
  const recommendation = getCarryoverRecommendation(betType, validatedAmount, isMandatory)

  return {
    betType,
    trackCode: sanitizeString(trackCode).toUpperCase(),
    trackName: sanitizeString(trackName),
    carryoverAmount: validatedAmount,
    daysWithoutWinner: validateNumber(daysWithoutWinner, 0, { min: 0, max: 365 }),
    estimatedPoolToday: validatedPool,
    totalExpectedPool: totalPool,
    isMandatory,
    mandatoryDate: mandatoryDate ? sanitizeString(mandatoryDate) : undefined,
    valueClass,
    recommendation,
    lastUpdated: new Date().toISOString(),
  }
}

// ============================================================================
// CARRYOVER PARSING
// ============================================================================

/**
 * Parse carryover amount from text (e.g., from DRF)
 *
 * Handles formats like:
 * - "$50,000"
 * - "50000"
 * - "$1.2M"
 * - "Carryover: $50K"
 */
export function parseCarryoverAmount(text: string): number {
  if (!text || typeof text !== 'string') return 0

  const cleanText = text.replace(/[,\s]/g, '').toUpperCase()

  // Look for amount patterns
  const patterns = [
    /\$?([\d.]+)M/i,           // "$1.5M" or "1.5M"
    /\$?([\d.]+)K/i,           // "$50K" or "50K"
    /\$?([\d]+(?:\.\d+)?)/,    // "$50000" or "50000"
  ]

  for (const pattern of patterns) {
    const match = cleanText.match(pattern)
    if (match) {
      let amount = parseFloat(match[1])

      // Apply multiplier
      if (pattern.source.includes('M')) {
        amount *= 1000000
      } else if (pattern.source.includes('K')) {
        amount *= 1000
      }

      return Math.round(amount)
    }
  }

  return 0
}

/**
 * Parse carryover info from DRF text block
 */
export function parseCarryoverFromDRF(
  text: string,
  trackCode: string,
  trackName: string
): Array<CarryoverInfo> {
  const results: CarryoverInfo[] = []

  // Look for Pick 5 carryover
  const pick5Match = text.match(/pick\s*5[^$]*\$?([\d,.]+K?M?)/i)
  if (pick5Match) {
    const amount = parseCarryoverAmount(pick5Match[1])
    if (amount > 0) {
      results.push(createCarryoverInfo({
        betType: 'pick_5',
        trackCode,
        trackName,
        carryoverAmount: amount,
      }))
    }
  }

  // Look for Pick 6 carryover
  const pick6Match = text.match(/pick\s*6[^$]*\$?([\d,.]+K?M?)/i)
  if (pick6Match) {
    const amount = parseCarryoverAmount(pick6Match[1])
    if (amount > 0) {
      results.push(createCarryoverInfo({
        betType: 'pick_6',
        trackCode,
        trackName,
        carryoverAmount: amount,
      }))
    }
  }

  return results
}

// ============================================================================
// EV CALCULATION WITH CARRYOVER
// ============================================================================

/**
 * Calculate adjusted expected value with carryover
 *
 * Carryover increases pool size, improving EV for all ticket holders
 */
export function calculateCarryoverAdjustedEV(params: {
  baseCost: number
  baseProbability: number
  carryoverAmount: number
  estimatedPoolToday: number
  takeoutRate?: number
}): {
  baseEV: number
  adjustedEV: number
  evBoost: number
  boostPercent: number
} {
  const {
    baseCost,
    baseProbability,
    carryoverAmount,
    estimatedPoolToday,
    takeoutRate = 0.25, // Typical Pick 5/6 takeout
  } = params

  // Without carryover: expected return is pool * (1 - takeout)
  const normalPoolReturn = estimatedPoolToday * (1 - takeoutRate)
  const baseExpectedReturn = baseProbability * normalPoolReturn
  const baseEV = baseExpectedReturn - baseCost

  // With carryover: pool is larger
  const totalPool = estimatedPoolToday + carryoverAmount
  const carryoverPoolReturn = estimatedPoolToday * (1 - takeoutRate) + carryoverAmount
  const adjustedExpectedReturn = baseProbability * carryoverPoolReturn
  const adjustedEV = adjustedExpectedReturn - baseCost

  const evBoost = adjustedEV - baseEV
  const boostPercent = baseEV !== 0 ? (evBoost / Math.abs(baseEV)) * 100 : 0

  return {
    baseEV,
    adjustedEV,
    evBoost,
    boostPercent,
  }
}

// ============================================================================
// CARRYOVER STORAGE
// ============================================================================

/**
 * Save carryover data to local storage
 */
export function saveCarryovers(carryovers: CarryoverInfo[]): void {
  try {
    const data = {
      carryovers,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(CARRYOVER_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage may be unavailable or full
    console.warn('Unable to save carryover data')
  }
}

/**
 * Load carryover data from local storage
 */
export function loadCarryovers(): CarryoverInfo[] {
  try {
    const stored = localStorage.getItem(CARRYOVER_STORAGE_KEY)
    if (!stored) return []

    const data = JSON.parse(stored)
    const savedAt = new Date(data.savedAt)
    const now = new Date()
    const hoursSinceSave = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60)

    // Return empty if data is stale
    if (hoursSinceSave > DATA_FRESHNESS_HOURS) {
      return []
    }

    return data.carryovers || []
  } catch {
    return []
  }
}

/**
 * Get carryover for specific track and bet type
 */
export function getCarryover(
  trackCode: string,
  betType: 'pick_5' | 'pick_6'
): CarryoverInfo | null {
  const carryovers = loadCarryovers()
  return carryovers.find(
    c => c.trackCode === trackCode.toUpperCase() && c.betType === betType
  ) || null
}

/**
 * Update or add a carryover
 */
export function updateCarryover(carryover: CarryoverInfo): void {
  const carryovers = loadCarryovers()

  const existingIndex = carryovers.findIndex(
    c => c.trackCode === carryover.trackCode && c.betType === carryover.betType
  )

  if (existingIndex >= 0) {
    carryovers[existingIndex] = carryover
  } else {
    carryovers.push(carryover)
  }

  saveCarryovers(carryovers)
}

/**
 * Clear all carryover data
 */
export function clearCarryovers(): void {
  try {
    localStorage.removeItem(CARRYOVER_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// CARRYOVER ALERTS
// ============================================================================

/**
 * Check if carryover warrants an alert
 */
export function shouldAlertCarryover(carryover: CarryoverInfo): boolean {
  return (
    carryover.isMandatory ||
    carryover.valueClass === 'exceptional' ||
    carryover.valueClass === 'high' ||
    carryover.carryoverAmount >= HIGH_VALUE_THRESHOLD
  )
}

/**
 * Get all high-value carryovers for today
 */
export function getHighValueCarryovers(): CarryoverInfo[] {
  return loadCarryovers().filter(shouldAlertCarryover)
}

/**
 * Create alert message for carryover
 */
export function createCarryoverAlert(carryover: CarryoverInfo): {
  title: string
  message: string
  priority: 'low' | 'medium' | 'high'
  icon: string
} {
  const config = getBetConfig(carryover.betType)

  if (carryover.isMandatory) {
    return {
      title: `Mandatory ${config.displayName} Payout`,
      message: `${carryover.trackName}: Entire pool ($${formatCarryoverAmount(carryover.totalExpectedPool)}) must be paid today`,
      priority: 'high',
      icon: 'priority_high',
    }
  }

  if (carryover.valueClass === 'exceptional') {
    return {
      title: `Exceptional ${config.displayName} Carryover`,
      message: `${carryover.trackName}: $${formatCarryoverAmount(carryover.carryoverAmount)} carryover - strong betting opportunity`,
      priority: 'high',
      icon: 'stars',
    }
  }

  if (carryover.valueClass === 'high') {
    return {
      title: `High ${config.displayName} Carryover`,
      message: `${carryover.trackName}: $${formatCarryoverAmount(carryover.carryoverAmount)} carryover`,
      priority: 'medium',
      icon: 'trending_up',
    }
  }

  return {
    title: `${config.displayName} Carryover`,
    message: `${carryover.trackName}: $${formatCarryoverAmount(carryover.carryoverAmount)}`,
    priority: 'low',
    icon: 'info',
  }
}

// ============================================================================
// CARRYOVER DISPLAY HELPERS
// ============================================================================

/**
 * Get display badge color for carryover value class
 */
export function getCarryoverBadgeColor(valueClass: 'low' | 'medium' | 'high' | 'exceptional'): {
  bg: string
  text: string
  border: string
} {
  switch (valueClass) {
    case 'exceptional':
      return { bg: 'rgba(234, 179, 8, 0.2)', text: '#eab308', border: 'rgba(234, 179, 8, 0.5)' }
    case 'high':
      return { bg: 'rgba(34, 197, 94, 0.2)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.5)' }
    case 'medium':
      return { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.5)' }
    case 'low':
    default:
      return { bg: 'rgba(156, 163, 175, 0.2)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.5)' }
  }
}

/**
 * Format carryover for display
 */
export function formatCarryoverDisplay(carryover: CarryoverInfo): {
  amountDisplay: string
  poolDisplay: string
  daysDisplay: string
  valueLabel: string
  icon: string
} {
  return {
    amountDisplay: `$${formatCarryoverAmount(carryover.carryoverAmount)}`,
    poolDisplay: `Est. Total: $${formatCarryoverAmount(carryover.totalExpectedPool)}`,
    daysDisplay: carryover.daysWithoutWinner > 0
      ? `${carryover.daysWithoutWinner} day${carryover.daysWithoutWinner > 1 ? 's' : ''} without winner`
      : 'Fresh pool',
    valueLabel: carryover.isMandatory
      ? 'MANDATORY'
      : carryover.valueClass.toUpperCase(),
    icon: carryover.isMandatory
      ? 'priority_high'
      : carryover.valueClass === 'exceptional'
        ? 'stars'
        : carryover.valueClass === 'high'
          ? 'trending_up'
          : 'monetization_on',
  }
}
