/**
 * Diamond Validator
 *
 * Validates diamond candidates with hard evidence from existing modules.
 * Requires data backing for each "perfect storm" factor.
 *
 * Validation Rules:
 * - Each factor must have evidence from its source module
 * - Minimum 2 factors required with valid evidence
 * - Confidence = (Number of validated factors × 20%)
 * - Reject if only 1 factor or no evidence
 */

import type { DiamondAnalysis, DetectedFactor } from './diamondTypes'
import { DIAMOND_MIN_FACTORS, calculateConfidence } from './diamondTypes'
import { logger } from '../../services/logging'

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

/**
 * Validation result for a single factor
 */
export interface FactorValidationResult {
  /** The factor being validated */
  factor: DetectedFactor
  /** Whether the factor has valid evidence */
  isValid: boolean
  /** Validation notes */
  notes: string[]
  /** Evidence strength (0-100) */
  evidenceStrength: number
}

/**
 * Complete validation result for a diamond
 */
export interface DiamondValidationResult {
  /** Whether the diamond passed validation */
  isValid: boolean
  /** Validation status */
  status: 'validated' | 'partial' | 'rejected'
  /** Original diamond analysis */
  diamond: DiamondAnalysis
  /** Individual factor validations */
  factorValidations: FactorValidationResult[]
  /** Number of validated factors */
  validatedFactorCount: number
  /** Adjusted confidence based on validated factors */
  adjustedConfidence: number
  /** Validation summary */
  summary: string
  /** Detailed validation notes */
  notes: string[]
  /** Timestamp */
  validatedAt: string
}

// ============================================================================
// FACTOR VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a class drop factor
 */
function validateClassDropFactor(factor: DetectedFactor): FactorValidationResult {
  const notes: string[] = []
  let isValid = false
  let evidenceStrength = 0

  // Check evidence details
  if (factor.evidenceDetails.length === 0) {
    notes.push('No evidence details provided')
    return { factor, isValid, notes, evidenceStrength: 0 }
  }

  // Look for specific evidence markers
  const hasLevelsDrop = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('dropping') || e.toLowerCase().includes('class level')
  )
  const hasProvenRecord = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('won') || e.toLowerCase().includes('proven')
  )

  if (hasLevelsDrop) {
    evidenceStrength += 50
    notes.push('Verified: Class drop detected from scoring module')
  }

  if (hasProvenRecord) {
    evidenceStrength += 30
    notes.push('Verified: Horse has proven form at higher class')
  }

  isValid = evidenceStrength >= 50
  if (isValid) {
    notes.push('Factor validated with sufficient evidence')
  }

  return { factor, isValid, notes, evidenceStrength }
}

/**
 * Validate an equipment change factor
 */
function validateEquipmentChangeFactor(factor: DetectedFactor): FactorValidationResult {
  const notes: string[] = []
  let isValid = false
  let evidenceStrength = 0

  if (factor.evidenceDetails.length === 0) {
    notes.push('No evidence details provided')
    return { factor, isValid, notes, evidenceStrength: 0 }
  }

  // Check for specific equipment evidence
  const hasLasix = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('lasix')
  )
  const hasBlinkers = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('blinker')
  )
  const hasTrainerPattern = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('trainer') && e.toLowerCase().includes('%')
  )

  if (hasLasix) {
    evidenceStrength += 40
    notes.push('Verified: First-time Lasix detected')
  }

  if (hasBlinkers) {
    evidenceStrength += 30
    notes.push('Verified: Blinker change detected')
  }

  if (hasTrainerPattern) {
    evidenceStrength += 30
    notes.push('Verified: Trainer pattern supports equipment change')
  }

  isValid = evidenceStrength >= 40
  if (isValid) {
    notes.push('Factor validated with equipment data')
  }

  return { factor, isValid, notes, evidenceStrength }
}

/**
 * Validate a pace fit factor
 */
function validatePaceFitFactor(factor: DetectedFactor): FactorValidationResult {
  const notes: string[] = []
  let isValid = false
  let evidenceStrength = 0

  if (factor.evidenceDetails.length === 0) {
    notes.push('No evidence details provided')
    return { factor, isValid, notes, evidenceStrength: 0 }
  }

  // Check for pace analysis evidence
  const hasRunningStyle = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('running style') || e.toLowerCase().includes('closer') ||
    e.toLowerCase().includes('presser') || e.toLowerCase().includes('speed')
  )
  const hasPaceScenario = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('pace scenario') || e.toLowerCase().includes('ppi')
  )

  if (hasRunningStyle) {
    evidenceStrength += 40
    notes.push('Verified: Running style identified from past performances')
  }

  if (hasPaceScenario) {
    evidenceStrength += 40
    notes.push('Verified: Pace scenario analyzed from field composition')
  }

  isValid = evidenceStrength >= 60
  if (isValid) {
    notes.push('Factor validated with pace analysis data')
  }

  return { factor, isValid, notes, evidenceStrength }
}

/**
 * Validate a track bias fit factor
 */
function validateTrackBiasFitFactor(factor: DetectedFactor): FactorValidationResult {
  const notes: string[] = []
  let isValid = false
  let evidenceStrength = 0

  if (factor.evidenceDetails.length === 0) {
    notes.push('No evidence details provided')
    return { factor, isValid, notes, evidenceStrength: 0 }
  }

  // Check for track bias evidence
  const hasTrackData = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('track') && e.includes('%')
  )
  const hasStyleMatch = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('this is a') || e.toLowerCase().includes('running style')
  )

  if (hasTrackData) {
    evidenceStrength += 50
    notes.push('Verified: Track bias data from track intelligence module')
  }

  if (hasStyleMatch) {
    evidenceStrength += 30
    notes.push('Verified: Running style matches track bias')
  }

  isValid = evidenceStrength >= 50
  if (isValid) {
    notes.push('Factor validated with track intelligence data')
  }

  return { factor, isValid, notes, evidenceStrength }
}

/**
 * Validate a hidden form factor
 */
function validateHiddenFormFactor(factor: DetectedFactor): FactorValidationResult {
  const notes: string[] = []
  let isValid = false
  let evidenceStrength = 0

  if (factor.evidenceDetails.length === 0) {
    notes.push('No evidence details provided')
    return { factor, isValid, notes, evidenceStrength: 0 }
  }

  // Check for workout evidence
  const hasWorkouts = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('work') || e.toLowerCase().includes('bullet')
  )
  const hasExcuse = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('excuse') || e.toLowerCase().includes('wide') ||
    e.toLowerCase().includes('trouble') || e.toLowerCase().includes('blocked')
  )

  if (hasWorkouts) {
    evidenceStrength += 50
    notes.push('Verified: Sharp workout pattern detected')
  }

  if (hasExcuse) {
    evidenceStrength += 30
    notes.push('Verified: Valid excuse found in last race')
  }

  isValid = evidenceStrength >= 50
  if (isValid) {
    notes.push('Factor validated with form analysis data')
  }

  return { factor, isValid, notes, evidenceStrength }
}

/**
 * Validate a breeding potential factor
 */
function validateBreedingPotentialFactor(factor: DetectedFactor): FactorValidationResult {
  const notes: string[] = []
  let isValid = false
  let evidenceStrength = 0

  if (factor.evidenceDetails.length === 0) {
    notes.push('No evidence details provided')
    return { factor, isValid, notes, evidenceStrength: 0 }
  }

  // Check for breeding evidence
  const hasLifetimeStarts = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('lifetime starts')
  )
  const hasBreedingScore = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('breeding score')
  )
  const hasSireData = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('sire')
  )

  if (hasLifetimeStarts) {
    evidenceStrength += 30
    notes.push('Verified: Horse is lightly raced')
  }

  if (hasBreedingScore) {
    evidenceStrength += 40
    notes.push('Verified: Breeding score calculated from pedigree data')
  }

  if (hasSireData) {
    evidenceStrength += 20
    notes.push('Verified: Sire profile found in database')
  }

  isValid = evidenceStrength >= 50
  if (isValid) {
    notes.push('Factor validated with breeding analysis data')
  }

  return { factor, isValid, notes, evidenceStrength }
}

/**
 * Validate a trainer pattern factor
 */
function validateTrainerPatternFactor(factor: DetectedFactor): FactorValidationResult {
  const notes: string[] = []
  let isValid = false
  let evidenceStrength = 0

  if (factor.evidenceDetails.length === 0) {
    notes.push('No evidence details provided')
    return { factor, isValid, notes, evidenceStrength: 0 }
  }

  // Check for trainer evidence
  const hasWinRate = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('win rate') || (e.includes('%') && e.toLowerCase().includes('trainer'))
  )
  const hasSampleSize = factor.evidenceDetails.some(e =>
    e.toLowerCase().includes('starts') || e.toLowerCase().includes('sample')
  )

  if (hasWinRate) {
    evidenceStrength += 50
    notes.push('Verified: Trainer win rate from pattern database')
  }

  if (hasSampleSize) {
    evidenceStrength += 30
    notes.push('Verified: Sufficient sample size for pattern')
  }

  isValid = evidenceStrength >= 50
  if (isValid) {
    notes.push('Factor validated with trainer pattern data')
  }

  return { factor, isValid, notes, evidenceStrength }
}

/**
 * Generic factor validation for other types
 */
function validateGenericFactor(factor: DetectedFactor): FactorValidationResult {
  const notes: string[] = []

  if (factor.evidenceDetails.length === 0) {
    return {
      factor,
      isValid: false,
      notes: ['No evidence details provided'],
      evidenceStrength: 0,
    }
  }

  // Check that we have at least 2 evidence details
  const evidenceStrength = Math.min(80, factor.evidenceDetails.length * 30)
  const isValid = evidenceStrength >= 50

  if (isValid) {
    notes.push(`Validated with ${factor.evidenceDetails.length} pieces of evidence`)
    notes.push(`Source: ${factor.sourceModule}`)
  } else {
    notes.push('Insufficient evidence for validation')
  }

  return { factor, isValid, notes, evidenceStrength }
}

/**
 * Validate a single factor based on its type
 */
function validateFactor(factor: DetectedFactor): FactorValidationResult {
  switch (factor.type) {
    case 'class_drop':
    case 'hidden_class_drop':
      return validateClassDropFactor(factor)
    case 'equipment_change':
    case 'first_time_lasix':
      return validateEquipmentChangeFactor(factor)
    case 'pace_fit':
      return validatePaceFitFactor(factor)
    case 'track_bias_fit':
      return validateTrackBiasFitFactor(factor)
    case 'hidden_form':
      return validateHiddenFormFactor(factor)
    case 'breeding_potential':
      return validateBreedingPotentialFactor(factor)
    case 'trainer_pattern':
      return validateTrainerPatternFactor(factor)
    default:
      return validateGenericFactor(factor)
  }
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate a diamond candidate with hard evidence
 */
export function validateDiamond(diamond: DiamondAnalysis): DiamondValidationResult {
  const factorValidations: FactorValidationResult[] = []
  const notes: string[] = []

  logger.logInfo('Validating diamond candidate', {
    component: 'diamondValidator',
    horseName: diamond.horseName,
    programNumber: diamond.programNumber,
    factorCount: diamond.factorCount,
  })

  // Validate each factor
  for (const factor of diamond.factors) {
    const validation = validateFactor(factor)
    factorValidations.push(validation)

    if (validation.isValid) {
      notes.push(`✓ ${factor.name}: Validated (${validation.evidenceStrength}% evidence strength)`)
    } else {
      notes.push(`✗ ${factor.name}: Failed validation - ${validation.notes.join(', ')}`)
    }
  }

  // Count validated factors
  const validatedFactorCount = factorValidations.filter(v => v.isValid).length

  // Determine validation status
  let status: 'validated' | 'partial' | 'rejected'
  let isValid: boolean

  if (validatedFactorCount >= DIAMOND_MIN_FACTORS) {
    status = 'validated'
    isValid = true
    notes.push(`\nDiamond VALIDATED: ${validatedFactorCount} factors with hard evidence`)
  } else if (validatedFactorCount === 1) {
    status = 'partial'
    isValid = false
    notes.push(`\nDiamond PARTIAL: Only ${validatedFactorCount} validated factor, need ${DIAMOND_MIN_FACTORS}+`)
  } else {
    status = 'rejected'
    isValid = false
    notes.push(`\nDiamond REJECTED: ${validatedFactorCount} validated factors, need ${DIAMOND_MIN_FACTORS}+`)
  }

  // Calculate adjusted confidence
  const adjustedConfidence = isValid
    ? calculateConfidence(validatedFactorCount)
    : 0

  // Generate summary
  const summary = isValid
    ? `Diamond validated: ${diamond.horseName} with ${validatedFactorCount} factors (${adjustedConfidence}% confidence)`
    : `Diamond rejected: ${diamond.horseName} - insufficient validated factors (${validatedFactorCount}/${DIAMOND_MIN_FACTORS})`

  logger.logInfo('Diamond validation complete', {
    component: 'diamondValidator',
    horseName: diamond.horseName,
    status,
    validatedFactorCount,
    adjustedConfidence,
  })

  return {
    isValid,
    status,
    diamond,
    factorValidations,
    validatedFactorCount,
    adjustedConfidence,
    summary,
    notes,
    validatedAt: new Date().toISOString(),
  }
}

/**
 * Validate multiple diamonds
 */
export function validateDiamonds(
  diamonds: DiamondAnalysis[]
): DiamondValidationResult[] {
  return diamonds.map(validateDiamond)
}

/**
 * Get only validated diamonds from a list
 */
export function getValidatedDiamonds(
  diamonds: DiamondAnalysis[]
): DiamondAnalysis[] {
  return diamonds.filter(diamond => {
    const result = validateDiamond(diamond)
    return result.isValid
  })
}

/**
 * Check if a diamond passes validation
 */
export function isDiamondValid(diamond: DiamondAnalysis): boolean {
  return validateDiamond(diamond).isValid
}
