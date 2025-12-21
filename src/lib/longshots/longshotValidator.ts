/**
 * Longshot Validator Module
 *
 * Validates upset angles with hard evidence from data sources.
 * Only credits angles with verifiable data - no speculation.
 *
 * Data Sources:
 * - paceAnalysis: Pace scenario, running styles
 * - classScoring: Class movement, proven at level
 * - equipmentScoring: Equipment changes and trainer patterns
 * - trainerPatterns: Trainer-specific statistics
 * - trackIntelligence: Track biases
 * - DRF workouts: Workout data from past performances
 */

import type { HorseEntry, RaceHeader, Workout, PastPerformance } from '../../types/drf'
import type { DetectedUpsetAngle, UpsetAngleCategory } from './longshotTypes'
import type { PaceScenarioAnalysis, RunningStyleProfile } from '../scoring/paceAnalysis'
import type { ClassScoreResult } from '../class/classScoring'
import type { EquipmentScoreResult } from '../equipment/equipmentScoring'
import { sanitizeString } from '../sanitization'
import { logger } from '../../services/logging'

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation result for a single piece of evidence
 */
export interface EvidenceValidation {
  /** Evidence type being validated */
  evidenceType: string
  /** Whether the evidence is valid */
  isValid: boolean
  /** Confidence in the validation (0-100) */
  confidence: number
  /** Source of the data */
  dataSource: string
  /** Actual value found */
  actualValue: string | number | null
  /** Threshold or expected value */
  threshold: string | number | null
  /** Detailed message */
  message: string
}

/**
 * Complete validation result for an angle
 */
export interface AngleValidationResult {
  /** The angle category */
  category: UpsetAngleCategory
  /** Whether the angle is fully validated */
  isValid: boolean
  /** Overall confidence (0-100) */
  overallConfidence: number
  /** Individual evidence validations */
  evidenceValidations: EvidenceValidation[]
  /** Missing required evidence */
  missingEvidence: string[]
  /** Warnings about data quality */
  warnings: string[]
  /** Summary message */
  summary: string
}

// ============================================================================
// PACE VALIDATION
// ============================================================================

/**
 * Validate pace scenario data
 */
export function validatePaceScenarioData(
  paceScenario: PaceScenarioAnalysis
): EvidenceValidation {
  try {
    const ppi = paceScenario.ppi
    const speedCount = paceScenario.styleBreakdown.earlySpeed.length
    const fieldSize = paceScenario.fieldSize

    const isValid = ppi > 0 && fieldSize > 0

    return {
      evidenceType: 'pace_scenario',
      isValid,
      confidence: isValid ? Math.min(90, 50 + speedCount * 10) : 0,
      dataSource: 'paceAnalysis',
      actualValue: `PPI: ${ppi}, Speed: ${speedCount}/${fieldSize}`,
      threshold: 'PPI > 50 for speed duel',
      message: isValid
        ? `Valid pace data: PPI ${ppi}, ${speedCount} speed horses`
        : 'Invalid or missing pace scenario data',
    }
  } catch {
    return {
      evidenceType: 'pace_scenario',
      isValid: false,
      confidence: 0,
      dataSource: 'paceAnalysis',
      actualValue: null,
      threshold: null,
      message: 'Error validating pace scenario data',
    }
  }
}

/**
 * Validate running style evidence
 */
export function validateRunningStyleData(
  runningStyle: RunningStyleProfile,
  expectedStyle: 'E' | 'P' | 'C' | 'S'
): EvidenceValidation {
  try {
    const isMatch = runningStyle.style === expectedStyle
    const hasEvidence = runningStyle.evidence.length >= 2

    return {
      evidenceType: 'running_style',
      isValid: isMatch && hasEvidence,
      confidence: runningStyle.confidence,
      dataSource: 'paceAnalysis',
      actualValue: `${runningStyle.styleName} (${runningStyle.stats.totalRaces} races)`,
      threshold: `Expected: ${expectedStyle}`,
      message: isMatch
        ? `Running style confirmed: ${runningStyle.styleName}`
        : `Running style mismatch: expected ${expectedStyle}, got ${runningStyle.style}`,
    }
  } catch {
    return {
      evidenceType: 'running_style',
      isValid: false,
      confidence: 0,
      dataSource: 'paceAnalysis',
      actualValue: null,
      threshold: null,
      message: 'Error validating running style',
    }
  }
}

// ============================================================================
// CLASS VALIDATION
// ============================================================================

/**
 * Validate class movement data
 */
export function validateClassMovement(
  classScore: ClassScoreResult,
  minLevelsDrop: number
): EvidenceValidation {
  try {
    const movement = classScore.analysis.movement
    const levelsDiff = Math.abs(movement.levelsDifference)
    const approximateLevels = Math.ceil(levelsDiff / 5)

    const isValid = movement.direction === 'drop' && approximateLevels >= minLevelsDrop

    return {
      evidenceType: 'class_drop',
      isValid,
      confidence: isValid ? Math.min(95, 70 + approximateLevels * 5) : 30,
      dataSource: 'classScoring',
      actualValue: `${movement.direction}: ${approximateLevels} levels`,
      threshold: `Min ${minLevelsDrop} level drop`,
      message: isValid
        ? `Valid class drop: ${movement.description}`
        : `Insufficient class drop: ${approximateLevels} levels (need ${minLevelsDrop})`,
    }
  } catch {
    return {
      evidenceType: 'class_drop',
      isValid: false,
      confidence: 0,
      dataSource: 'classScoring',
      actualValue: null,
      threshold: null,
      message: 'Error validating class movement',
    }
  }
}

/**
 * Validate proven at level data
 */
export function validateProvenAtLevel(
  classScore: ClassScoreResult
): EvidenceValidation {
  try {
    const proven = classScore.analysis.provenAtLevel

    const isValid = proven.hasWon || proven.hasPlaced || proven.wasCompetitive
    let confidence = 50

    if (proven.hasWon) {
      confidence = Math.min(95, 70 + proven.winsAtLevel * 10)
    } else if (proven.hasPlaced) {
      confidence = Math.min(85, 60 + proven.itmAtLevel * 5)
    } else if (proven.wasCompetitive) {
      confidence = 55
    }

    return {
      evidenceType: 'proven_at_level',
      isValid,
      confidence: isValid ? confidence : 0,
      dataSource: 'classScoring',
      actualValue: proven.hasWon
        ? `Won ${proven.winsAtLevel} at level`
        : proven.hasPlaced
          ? `Placed ${proven.itmAtLevel} at level`
          : proven.wasCompetitive
            ? `Competitive at level`
            : 'Not proven',
      threshold: 'Won, placed, or competitive at class',
      message: isValid
        ? `Proven at level: ${proven.winsAtLevel}W ${proven.itmAtLevel}ITM`
        : 'Not proven at this class level',
    }
  } catch {
    return {
      evidenceType: 'proven_at_level',
      isValid: false,
      confidence: 0,
      dataSource: 'classScoring',
      actualValue: null,
      threshold: null,
      message: 'Error validating proven at level',
    }
  }
}

// ============================================================================
// EQUIPMENT VALIDATION
// ============================================================================

/**
 * Validate equipment change data
 */
export function validateEquipmentChange(
  equipmentScore: EquipmentScoreResult,
  changeType: 'lasix' | 'blinkers' | 'both'
): EvidenceValidation {
  try {
    const changes = equipmentScore.changes
    const hasLasix = changes.some(
      c => c.equipmentType.id === 'lasix' && c.direction === 'added'
    )
    const hasBlinkers = changes.some(
      c => c.equipmentType.id === 'blinkers' && c.direction === 'added'
    )

    let isValid = false
    let actualValue = ''

    switch (changeType) {
      case 'lasix':
        isValid = hasLasix
        actualValue = hasLasix ? 'First-time Lasix' : 'No Lasix change'
        break
      case 'blinkers':
        isValid = hasBlinkers
        actualValue = hasBlinkers ? 'Blinkers ON' : 'No blinkers change'
        break
      case 'both':
        isValid = hasLasix && hasBlinkers
        actualValue = `Lasix: ${hasLasix}, Blinkers: ${hasBlinkers}`
        break
    }

    return {
      evidenceType: 'equipment_change',
      isValid,
      confidence: isValid ? 85 : 0,
      dataSource: 'equipmentScoring',
      actualValue,
      threshold: `Required: ${changeType}`,
      message: isValid
        ? `Equipment change confirmed: ${actualValue}`
        : `Missing equipment change: ${changeType}`,
    }
  } catch {
    return {
      evidenceType: 'equipment_change',
      isValid: false,
      confidence: 0,
      dataSource: 'equipmentScoring',
      actualValue: null,
      threshold: null,
      message: 'Error validating equipment change',
    }
  }
}

/**
 * Validate trainer pattern data
 */
export function validateTrainerPattern(
  equipmentScore: EquipmentScoreResult,
  minWinRate: number
): EvidenceValidation {
  try {
    const hasPattern = equipmentScore.usesTrainerPattern
    const evidence = equipmentScore.trainerEvidence

    // Try to extract win rate from evidence
    let winRate = 0
    if (evidence) {
      const match = evidence.match(/(\d+(?:\.\d+)?)\s*%/)
      if (match) {
        winRate = parseFloat(match[1])
      }
    }

    const isValid = hasPattern && winRate >= minWinRate

    return {
      evidenceType: 'trainer_pattern',
      isValid,
      confidence: isValid ? Math.min(90, 60 + winRate) : 30,
      dataSource: 'trainerPatterns',
      actualValue: evidence || 'No pattern',
      threshold: `Min ${minWinRate}% win rate`,
      message: isValid
        ? `Trainer pattern validated: ${evidence}`
        : hasPattern
          ? `Trainer pattern below threshold: ${winRate}%`
          : 'No trainer pattern found',
    }
  } catch {
    return {
      evidenceType: 'trainer_pattern',
      isValid: false,
      confidence: 0,
      dataSource: 'trainerPatterns',
      actualValue: null,
      threshold: null,
      message: 'Error validating trainer pattern',
    }
  }
}

// ============================================================================
// WORKOUT VALIDATION
// ============================================================================

/**
 * Validate workout pattern from DRF data
 */
export function validateWorkoutPattern(
  workouts: Workout[],
  minWorksIn14Days: number
): EvidenceValidation {
  try {
    if (!workouts || workouts.length === 0) {
      return {
        evidenceType: 'workout_pattern',
        isValid: false,
        confidence: 0,
        dataSource: 'DRF workouts',
        actualValue: 'No workouts',
        threshold: `Min ${minWorksIn14Days} works in 14 days`,
        message: 'No workout data available',
      }
    }

    const now = new Date()
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    let worksIn14Days = 0
    let bulletCount = 0

    for (const work of workouts) {
      try {
        const workDate = new Date(work.date)
        if (workDate >= fourteenDaysAgo) {
          worksIn14Days++
          if (work.isBullet) bulletCount++
        }
      } catch {
        // Skip invalid dates
      }
    }

    const isValid = worksIn14Days >= minWorksIn14Days
    const bulletBonus = bulletCount > 0 ? 10 : 0

    return {
      evidenceType: 'workout_pattern',
      isValid,
      confidence: isValid ? Math.min(85, 50 + worksIn14Days * 10 + bulletBonus) : 30,
      dataSource: 'DRF workouts',
      actualValue: `${worksIn14Days} works in 14 days (${bulletCount} bullets)`,
      threshold: `Min ${minWorksIn14Days} works`,
      message: isValid
        ? `Sharp workout pattern: ${worksIn14Days} works, ${bulletCount} bullet(s)`
        : `Insufficient works: ${worksIn14Days} (need ${minWorksIn14Days})`,
    }
  } catch {
    return {
      evidenceType: 'workout_pattern',
      isValid: false,
      confidence: 0,
      dataSource: 'DRF workouts',
      actualValue: null,
      threshold: null,
      message: 'Error validating workout pattern',
    }
  }
}

// ============================================================================
// TRIP COMMENT VALIDATION
// ============================================================================

/**
 * Validate trip comment for excuse
 */
export function validateTripExcuse(
  pastPerformances: PastPerformance[]
): EvidenceValidation {
  try {
    const lastRace = pastPerformances[0]
    if (!lastRace) {
      return {
        evidenceType: 'trip_excuse',
        isValid: false,
        confidence: 0,
        dataSource: 'DRF past performances',
        actualValue: 'No last race',
        threshold: 'Valid trip excuse',
        message: 'No past performance data available',
      }
    }

    // Sanitize and check comment
    const comment = sanitizeString(lastRace.tripComment || '').toLowerCase()

    // Look for excuse keywords
    const excuseKeywords = [
      'wide', 'traffic', 'blocked', 'bumped', 'checked',
      'steadied', 'clipped heels', 'stumbled', 'off slow',
      'broke outward', 'broke inward', 'dwelt',
    ]

    let foundExcuse: string | null = null
    for (const keyword of excuseKeywords) {
      if (comment.includes(keyword)) {
        foundExcuse = keyword
        break
      }
    }

    const isValid = foundExcuse !== null

    return {
      evidenceType: 'trip_excuse',
      isValid,
      confidence: isValid ? 75 : 20,
      dataSource: 'DRF past performances',
      actualValue: foundExcuse || 'No excuse found',
      threshold: 'Trip trouble keyword',
      message: isValid
        ? `Valid excuse: "${foundExcuse}" in "${lastRace.tripComment}"`
        : `No valid excuse in trip comment`,
    }
  } catch {
    return {
      evidenceType: 'trip_excuse',
      isValid: false,
      confidence: 0,
      dataSource: 'DRF past performances',
      actualValue: null,
      threshold: null,
      message: 'Error validating trip excuse',
    }
  }
}

// ============================================================================
// ANGLE VALIDATION
// ============================================================================

/**
 * Validate a detected angle against all required evidence
 */
export function validateAngle(
  angle: DetectedUpsetAngle,
  horse: HorseEntry,
  _raceHeader: RaceHeader,
  paceScenario: PaceScenarioAnalysis,
  runningStyle: RunningStyleProfile,
  classScore: ClassScoreResult,
  equipmentScore: EquipmentScoreResult
): AngleValidationResult {
  const evidenceValidations: EvidenceValidation[] = []
  const missingEvidence: string[] = []
  const warnings: string[] = []

  try {
    switch (angle.category) {
      case 'pace_devastation':
        evidenceValidations.push(validatePaceScenarioData(paceScenario))
        evidenceValidations.push(validateRunningStyleData(runningStyle, 'C'))
        break

      case 'class_relief':
        evidenceValidations.push(validateClassMovement(classScore, 3))
        evidenceValidations.push(validateProvenAtLevel(classScore))
        break

      case 'equipment_rescue':
        evidenceValidations.push(validateEquipmentChange(equipmentScore, 'both'))
        evidenceValidations.push(validateTrainerPattern(equipmentScore, 20))
        break

      case 'trainer_pattern':
        evidenceValidations.push(validateTrainerPattern(equipmentScore, 20))
        break

      case 'track_bias_fit':
        evidenceValidations.push(validatePaceScenarioData(paceScenario))
        evidenceValidations.push(validateRunningStyleData(runningStyle, runningStyle.style as 'E' | 'P' | 'C' | 'S'))
        break

      case 'hidden_form':
        evidenceValidations.push(validateWorkoutPattern(horse.workouts, 3))
        evidenceValidations.push(validateTripExcuse(horse.pastPerformances))
        break
    }

    // Check for missing evidence
    for (const validation of evidenceValidations) {
      if (!validation.isValid) {
        missingEvidence.push(validation.evidenceType)
      }
      if (validation.confidence < 50) {
        warnings.push(`Low confidence on ${validation.evidenceType}: ${validation.confidence}%`)
      }
    }

    // Calculate overall confidence
    const validCount = evidenceValidations.filter(v => v.isValid).length
    const totalCount = evidenceValidations.length
    const avgConfidence = totalCount > 0
      ? evidenceValidations.reduce((sum, v) => sum + v.confidence, 0) / totalCount
      : 0

    const isValid = validCount === totalCount

    return {
      category: angle.category,
      isValid,
      overallConfidence: Math.round(avgConfidence),
      evidenceValidations,
      missingEvidence,
      warnings,
      summary: isValid
        ? `${angle.name} validated with ${Math.round(avgConfidence)}% confidence`
        : `${angle.name} missing evidence: ${missingEvidence.join(', ')}`,
    }
  } catch (_error) {
    logger.logWarning('Error validating angle', {
      component: 'longshotValidator',
      angle: angle.category,
    })

    return {
      category: angle.category,
      isValid: false,
      overallConfidence: 0,
      evidenceValidations,
      missingEvidence: ['validation_error'],
      warnings: ['Error during validation'],
      summary: 'Validation error occurred',
    }
  }
}

/**
 * Validate all angles for a longshot
 */
export function validateAllAngles(
  angles: DetectedUpsetAngle[],
  horse: HorseEntry,
  raceHeader: RaceHeader,
  paceScenario: PaceScenarioAnalysis,
  runningStyle: RunningStyleProfile,
  classScore: ClassScoreResult,
  equipmentScore: EquipmentScoreResult
): AngleValidationResult[] {
  return angles.map(angle =>
    validateAngle(
      angle,
      horse,
      raceHeader,
      paceScenario,
      runningStyle,
      classScore,
      equipmentScore
    )
  )
}

/**
 * Filter angles to only those with full validation
 */
export function getValidatedAngles(
  angles: DetectedUpsetAngle[],
  validations: AngleValidationResult[]
): DetectedUpsetAngle[] {
  return angles.filter((_angle, index) => {
    const validation = validations[index]
    return validation && validation.isValid
  })
}
