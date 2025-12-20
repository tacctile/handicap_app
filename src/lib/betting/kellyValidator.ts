/**
 * Kelly Criterion Validator
 *
 * Validates inputs for Kelly Criterion calculations:
 * - Probability must be 0-100% (0.0-1.0)
 * - Odds must be positive
 * - Bankroll must be positive
 * - Sanitize all inputs
 *
 * Edge cases:
 * - If probability > implied odds probability = underlay, return 0
 * - If Kelly > 25% = too aggressive, cap at configured max
 * - If bankroll too small for minimum bet = flag warning
 *
 * @module betting/kellyValidator
 */

import { logger } from '../../services/logging'

// ============================================================================
// TYPES
// ============================================================================

export interface KellyValidationInput {
  /** Win probability as decimal (0.0 to 1.0) or percentage (0 to 100) */
  winProbability: number
  /** Decimal odds (e.g., 5.0 for 4/1) */
  decimalOdds: number
  /** Current bankroll in dollars */
  bankroll: number
}

export interface KellyValidationResult {
  /** Whether all inputs are valid */
  isValid: boolean
  /** Sanitized win probability (0.0 to 1.0) */
  sanitizedProbability: number
  /** Sanitized decimal odds */
  sanitizedOdds: number
  /** Sanitized bankroll */
  sanitizedBankroll: number
  /** Validation errors */
  errors: string[]
  /** Validation warnings (not blocking) */
  warnings: string[]
}

export interface EdgeValidation {
  /** Whether bet has positive edge */
  hasEdge: boolean
  /** Edge percentage */
  edgePercent: number
  /** Is this an underlay? */
  isUnderlay: boolean
  /** Implied probability from odds */
  impliedProbability: number
  /** Our probability advantage */
  probabilityAdvantage: number
}

export interface BankrollValidation {
  /** Whether bankroll is sufficient */
  isSufficient: boolean
  /** Minimum bet amount */
  minimumBet: number
  /** Can place minimum bet? */
  canPlaceMinBet: boolean
  /** Warning if bankroll is low */
  warning: string | null
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum valid probability */
export const MIN_PROBABILITY = 0.001 // 0.1%

/** Maximum valid probability */
export const MAX_PROBABILITY = 0.999 // 99.9%

/** Minimum valid decimal odds */
export const MIN_DECIMAL_ODDS = 1.01 // Just above even

/** Maximum reasonable decimal odds (1000/1) */
export const MAX_DECIMAL_ODDS = 1001

/** Minimum bankroll for betting */
export const MIN_BANKROLL = 10

/** Standard minimum bet amount */
export const MINIMUM_BET_AMOUNT = 2

/** Threshold for "aggressive" Kelly */
export const AGGRESSIVE_KELLY_THRESHOLD = 0.25 // 25%

// ============================================================================
// CORE VALIDATION
// ============================================================================

/**
 * Validate and sanitize Kelly Criterion inputs
 */
export function validateKellyInputs(input: KellyValidationInput): KellyValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate and sanitize probability
  let sanitizedProbability = sanitizeProbability(input.winProbability)
  if (sanitizedProbability === null) {
    errors.push('Invalid win probability')
    sanitizedProbability = 0
  }

  // Validate and sanitize odds
  let sanitizedOdds = sanitizeOdds(input.decimalOdds)
  if (sanitizedOdds === null) {
    errors.push('Invalid odds')
    sanitizedOdds = 2.0
  }

  // Validate and sanitize bankroll
  let sanitizedBankroll = sanitizeBankroll(input.bankroll)
  if (sanitizedBankroll === null) {
    errors.push('Invalid bankroll')
    sanitizedBankroll = 0
  }

  // Check for low bankroll warning
  if (sanitizedBankroll > 0 && sanitizedBankroll < MIN_BANKROLL) {
    warnings.push(`Bankroll $${sanitizedBankroll.toFixed(2)} is very low`)
  }

  // Check if probability is extremely high or low
  if (sanitizedProbability > 0.5) {
    warnings.push('Win probability > 50% is unusual for horse racing')
  }
  if (sanitizedProbability < 0.02) {
    warnings.push('Win probability < 2% may not justify the risk')
  }

  // Check if odds are unusual
  if (sanitizedOdds < 1.5) {
    warnings.push('Very short odds - minimal potential profit')
  }
  if (sanitizedOdds > 100) {
    warnings.push('Extreme longshot odds - high variance')
  }

  // Log validation issues
  if (errors.length > 0 || warnings.length > 0) {
    logger.logWarning('Kelly validation issues', {
      component: 'kellyValidator',
      errors,
      warnings,
      input,
    })
  }

  return {
    isValid: errors.length === 0,
    sanitizedProbability,
    sanitizedOdds,
    sanitizedBankroll,
    errors,
    warnings,
  }
}

/**
 * Validate edge (probability vs implied probability)
 */
export function validateEdge(
  winProbability: number,
  decimalOdds: number
): EdgeValidation {
  // Implied probability from odds
  const impliedProbability = 1 / decimalOdds

  // Our edge = difference between our probability and implied
  const probabilityAdvantage = winProbability - impliedProbability

  // Edge percentage (based on expected profit per $1)
  const b = decimalOdds - 1
  const edge = b * winProbability - (1 - winProbability)
  const edgePercent = edge * 100

  // Is this an underlay (negative edge)?
  const isUnderlay = winProbability < impliedProbability

  return {
    hasEdge: !isUnderlay && edge > 0,
    edgePercent,
    isUnderlay,
    impliedProbability,
    probabilityAdvantage,
  }
}

/**
 * Validate bankroll for betting
 */
export function validateBankroll(
  bankroll: number,
  minimumBet: number = MINIMUM_BET_AMOUNT
): BankrollValidation {
  const isSufficient = bankroll >= MIN_BANKROLL
  const canPlaceMinBet = bankroll >= minimumBet

  let warning: string | null = null
  if (!canPlaceMinBet) {
    warning = `Bankroll $${bankroll.toFixed(2)} is below minimum bet $${minimumBet}`
  } else if (!isSufficient) {
    warning = `Bankroll $${bankroll.toFixed(2)} is very low for proper bankroll management`
  }

  return {
    isSufficient,
    minimumBet,
    canPlaceMinBet,
    warning,
  }
}

/**
 * Validate if Kelly fraction is too aggressive
 */
export function validateKellyAggression(
  kellyFraction: number,
  maxAllowed: number = AGGRESSIVE_KELLY_THRESHOLD
): {
  isAggressive: boolean
  cappedFraction: number
  warning: string | null
} {
  const isAggressive = kellyFraction > maxAllowed

  return {
    isAggressive,
    cappedFraction: Math.min(kellyFraction, maxAllowed),
    warning: isAggressive
      ? `Kelly ${(kellyFraction * 100).toFixed(1)}% exceeds ${(maxAllowed * 100).toFixed(0)}% cap`
      : null,
  }
}

// ============================================================================
// SANITIZATION HELPERS
// ============================================================================

/**
 * Sanitize probability input
 *
 * Handles:
 * - Decimal (0.0 to 1.0)
 * - Percentage (0 to 100)
 * - String inputs
 */
export function sanitizeProbability(probability: unknown): number | null {
  if (probability === null || probability === undefined) {
    return null
  }

  let value: number

  if (typeof probability === 'string') {
    // Remove % sign if present
    const cleaned = probability.replace(/%/g, '').trim()
    value = parseFloat(cleaned)
    if (isNaN(value)) {
      return null
    }
    // If string contained %, assume percentage
    if (probability.includes('%')) {
      value = value / 100
    }
  } else if (typeof probability === 'number') {
    value = probability
  } else {
    return null
  }

  // If value > 1, assume it's a percentage and convert
  if (value > 1 && value <= 100) {
    value = value / 100
  }

  // Clamp to valid range
  if (value < MIN_PROBABILITY || value > MAX_PROBABILITY) {
    if (value < 0 || value > 100) {
      return null
    }
    value = Math.max(MIN_PROBABILITY, Math.min(MAX_PROBABILITY, value))
  }

  return value
}

/**
 * Sanitize odds input
 *
 * Handles:
 * - Decimal odds (e.g., 5.0)
 * - String odds (e.g., "5-1", "9/2")
 */
export function sanitizeOdds(odds: unknown): number | null {
  if (odds === null || odds === undefined) {
    return null
  }

  let value: number

  if (typeof odds === 'string') {
    // Handle fractional odds (e.g., "5-1", "9/2")
    const fractionalMatch = odds.match(/^(\d+(?:\.\d+)?)\s*[-\/]\s*(\d+(?:\.\d+)?)$/)
    if (fractionalMatch) {
      const num = parseFloat(fractionalMatch[1])
      const den = parseFloat(fractionalMatch[2])
      if (den > 0) {
        value = num / den + 1
      } else {
        return null
      }
    } else if (/^even$/i.test(odds.trim()) || /^evn$/i.test(odds.trim())) {
      value = 2.0
    } else {
      value = parseFloat(odds)
    }
  } else if (typeof odds === 'number') {
    value = odds
  } else {
    return null
  }

  if (isNaN(value)) {
    return null
  }

  // Validate range
  if (value < MIN_DECIMAL_ODDS || value > MAX_DECIMAL_ODDS) {
    return null
  }

  return value
}

/**
 * Sanitize bankroll input
 */
export function sanitizeBankroll(bankroll: unknown): number | null {
  if (bankroll === null || bankroll === undefined) {
    return null
  }

  let value: number

  if (typeof bankroll === 'string') {
    // Remove currency symbols and commas
    const cleaned = bankroll.replace(/[$,]/g, '').trim()
    value = parseFloat(cleaned)
  } else if (typeof bankroll === 'number') {
    value = bankroll
  } else {
    return null
  }

  if (isNaN(value) || value < 0) {
    return null
  }

  return value
}

// ============================================================================
// COMPOSITE VALIDATION
// ============================================================================

/**
 * Comprehensive validation of all Kelly inputs and conditions
 */
export function performFullKellyValidation(
  winProbability: number,
  decimalOdds: number,
  bankroll: number,
  minEdgeRequired: number = 0.05,
  maxKellyAllowed: number = 0.25
): {
  isValid: boolean
  shouldBet: boolean
  reason: string | null
  inputValidation: KellyValidationResult
  edgeValidation: EdgeValidation
  bankrollValidation: BankrollValidation
  kellyFraction: number
  warnings: string[]
} {
  const warnings: string[] = []

  // Validate inputs
  const inputValidation = validateKellyInputs({
    winProbability,
    decimalOdds,
    bankroll,
  })

  if (!inputValidation.isValid) {
    return {
      isValid: false,
      shouldBet: false,
      reason: inputValidation.errors.join('; '),
      inputValidation,
      edgeValidation: validateEdge(0, 2),
      bankrollValidation: validateBankroll(0),
      kellyFraction: 0,
      warnings: inputValidation.warnings,
    }
  }

  // Use sanitized values
  const p = inputValidation.sanitizedProbability
  const odds = inputValidation.sanitizedOdds
  const roll = inputValidation.sanitizedBankroll

  // Validate edge
  const edgeValidation = validateEdge(p, odds)
  if (edgeValidation.isUnderlay) {
    return {
      isValid: true,
      shouldBet: false,
      reason: 'Underlay - probability lower than implied odds',
      inputValidation,
      edgeValidation,
      bankrollValidation: validateBankroll(roll),
      kellyFraction: 0,
      warnings: [...inputValidation.warnings, 'This is an underlay bet'],
    }
  }

  // Check minimum edge
  if (edgeValidation.edgePercent / 100 < minEdgeRequired) {
    return {
      isValid: true,
      shouldBet: false,
      reason: `Edge ${edgeValidation.edgePercent.toFixed(1)}% below minimum ${(minEdgeRequired * 100).toFixed(0)}%`,
      inputValidation,
      edgeValidation,
      bankrollValidation: validateBankroll(roll),
      kellyFraction: 0,
      warnings: [...inputValidation.warnings, 'Edge too small'],
    }
  }

  // Validate bankroll
  const bankrollValidation = validateBankroll(roll)
  if (!bankrollValidation.canPlaceMinBet) {
    return {
      isValid: true,
      shouldBet: false,
      reason: bankrollValidation.warning ?? 'Bankroll insufficient',
      inputValidation,
      edgeValidation,
      bankrollValidation,
      kellyFraction: 0,
      warnings: [...inputValidation.warnings],
    }
  }

  // Calculate Kelly fraction
  const b = odds - 1
  const q = 1 - p
  const kellyFraction = (b * p - q) / b

  // Check aggression
  const aggressionCheck = validateKellyAggression(kellyFraction, maxKellyAllowed)
  if (aggressionCheck.warning) {
    warnings.push(aggressionCheck.warning)
  }

  return {
    isValid: true,
    shouldBet: true,
    reason: null,
    inputValidation,
    edgeValidation,
    bankrollValidation,
    kellyFraction,
    warnings: [...inputValidation.warnings, ...warnings],
  }
}
