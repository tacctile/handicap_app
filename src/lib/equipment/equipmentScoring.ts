/**
 * Equipment Scoring Module
 *
 * Calculates equipment impact scores based on detected changes
 * and trainer-specific success patterns.
 *
 * Score Range: 0-25 points (from Equipment & Medication category)
 * Base Score: 10 points (no changes)
 *
 * Key Impacts:
 * - First-time Lasix: +12-20 pts (trainer-dependent)
 * - Lasix removal: -8 pts
 * - Blinkers ON (first-time): +10-16 pts (trainer-dependent)
 * - Blinkers OFF: +8-15 pts (trainer-dependent)
 * - Tongue tie added: +5-8 pts
 * - Other equipment: +2-5 pts
 */

import type { HorseEntry, RaceHeader } from '../../types/drf'
import {
  type DetectedEquipmentChange,
  type EquipmentAnalysis,
  getImpactClassification,
} from './equipmentTypes'
import {
  extractEquipmentInfo,
  type EquipmentExtractionResult,
} from './equipmentExtractor'
import {
  calculateTrainerAdjustedPoints,
  hasCrediblePattern,
  equipmentIdToChangeType,
} from './trainerPatterns'

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Base equipment score when no changes
 */
export const BASE_EQUIPMENT_SCORE = 10

/**
 * Maximum equipment score
 */
export const MAX_EQUIPMENT_SCORE = 25

/**
 * Minimum equipment score
 */
export const MIN_EQUIPMENT_SCORE = 0

// ============================================================================
// TYPES
// ============================================================================

/**
 * Equipment score result
 */
export interface EquipmentScoreResult {
  /** Total equipment score (0-25) */
  total: number
  /** Base score before adjustments */
  baseScore: number
  /** All detected changes with adjusted points */
  changes: DetectedEquipmentChange[]
  /** Has at least one significant change */
  hasSignificantChange: boolean
  /** Summary reasoning */
  reasoning: string
  /** Is trainer pattern being used */
  usesTrainerPattern: boolean
  /** Trainer pattern evidence (if any) */
  trainerEvidence: string | null
  /** Equipment analysis details */
  analysis: EquipmentExtractionResult
}

// ============================================================================
// CONTEXT-SPECIFIC ADJUSTMENTS
// ============================================================================

/**
 * Adjust bar shoes score based on surface
 */
function adjustBarShoesForSurface(
  change: DetectedEquipmentChange,
  surface: string
): number {
  if (change.equipmentType.id !== 'barShoes') {
    return change.adjustedPoints
  }

  // Bar shoes on turf: +2 (better grip)
  // Bar shoes on dirt: -1 (may indicate hoof concern)
  if (surface === 'turf') {
    return change.adjustedPoints + 2
  } else if (surface === 'dirt') {
    return change.adjustedPoints - 2
  }

  return change.adjustedPoints
}

/**
 * Check for pace issues that blinkers-off might help
 */
function checkForPaceIssues(horse: HorseEntry): boolean {
  if (horse.pastPerformances.length === 0) return false

  const lastRaces = horse.pastPerformances.slice(0, 3)

  for (const pp of lastRaces) {
    const runningLine = pp.runningLine

    // Was leading or close early but faded badly
    if (runningLine.quarterMile !== null && runningLine.finish !== null) {
      const earlyPosition = runningLine.quarterMile
      const finalPosition = runningLine.finish

      // Led early (top 2) but finished poorly (outside top 5)
      if (earlyPosition <= 2 && finalPosition > 5) {
        return true
      }
    }

    // Check trip comment for pace-related issues
    const comment = pp.tripComment.toLowerCase()
    if (comment.includes('hung') || comment.includes('lugged') ||
        comment.includes('bore') || comment.includes('rank') ||
        comment.includes('keen') || comment.includes('fought')) {
      return true
    }
  }

  return false
}

/**
 * Adjust blinkers-off score based on pace issues
 */
function adjustBlinkersOffForPace(
  change: DetectedEquipmentChange,
  horse: HorseEntry
): number {
  if (change.equipmentType.id !== 'blinkers' || change.direction !== 'removed') {
    return change.adjustedPoints
  }

  // Bonus if horse had pace issues (blinkers off may help)
  if (checkForPaceIssues(horse)) {
    return change.adjustedPoints + 3
  }

  return change.adjustedPoints
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate complete equipment score for a horse
 */
export function calculateEquipmentImpactScore(
  horse: HorseEntry,
  raceHeader?: RaceHeader
): EquipmentScoreResult {
  // Extract equipment info
  const extraction = extractEquipmentInfo(horse)

  // If no changes, return base score
  if (!extraction.hasChanges) {
    return {
      total: BASE_EQUIPMENT_SCORE,
      baseScore: BASE_EQUIPMENT_SCORE,
      changes: [],
      hasSignificantChange: false,
      reasoning: 'No equipment changes',
      usesTrainerPattern: false,
      trainerEvidence: null,
      analysis: extraction,
    }
  }

  // Process each change with trainer patterns and context adjustments
  const processedChanges: DetectedEquipmentChange[] = []
  let totalPoints = 0
  let usesTrainerPattern = false
  let trainerEvidence: string | null = null

  for (const change of extraction.changes) {
    // Check for trainer pattern
    const trainerResult = calculateTrainerAdjustedPoints(
      horse.trainerName,
      change.equipmentType.id,
      change.direction,
      change.basePoints
    )

    // Create processed change with adjusted points
    const processedChange: DetectedEquipmentChange = {
      ...change,
      adjustedPoints: trainerResult.adjustedPoints,
    }

    // Apply context adjustments
    if (raceHeader) {
      processedChange.adjustedPoints = adjustBarShoesForSurface(
        processedChange,
        raceHeader.surface
      )
    }

    // Adjust blinkers-off based on pace issues
    processedChange.adjustedPoints = adjustBlinkersOffForPace(
      processedChange,
      horse
    )

    // Update impact classification based on final points
    processedChange.impact = getImpactClassification(processedChange.adjustedPoints)

    // Add evidence if trainer pattern was used
    if (trainerResult.hasPattern) {
      processedChange.evidence = trainerResult.evidence || undefined
      usesTrainerPattern = true
      if (!trainerEvidence) {
        trainerEvidence = trainerResult.evidence
      }
    }

    processedChanges.push(processedChange)
    totalPoints += processedChange.adjustedPoints
  }

  // Calculate total score (base + changes, clamped to range)
  const rawTotal = BASE_EQUIPMENT_SCORE + totalPoints
  const total = Math.max(MIN_EQUIPMENT_SCORE, Math.min(MAX_EQUIPMENT_SCORE, rawTotal))

  // Build reasoning string
  const reasoning = buildReasoning(processedChanges, usesTrainerPattern, trainerEvidence)

  return {
    total,
    baseScore: BASE_EQUIPMENT_SCORE,
    changes: processedChanges,
    hasSignificantChange: extraction.hasSignificantChange,
    reasoning,
    usesTrainerPattern,
    trainerEvidence,
    analysis: extraction,
  }
}

/**
 * Build reasoning string from changes
 */
function buildReasoning(
  changes: DetectedEquipmentChange[],
  usesTrainerPattern: boolean,
  trainerEvidence: string | null
): string {
  if (changes.length === 0) {
    return 'No equipment changes'
  }

  const descriptions = changes.map(c => {
    let desc = c.changeDescription
    if (c.adjustedPoints > 0) {
      desc += ` (+${c.adjustedPoints})`
    } else if (c.adjustedPoints < 0) {
      desc += ` (${c.adjustedPoints})`
    }
    return desc
  })

  let reasoning = descriptions.join(' + ')

  if (usesTrainerPattern && trainerEvidence) {
    reasoning += ` | Trainer pattern: ${trainerEvidence}`
  }

  return reasoning
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get equipment changes summary for display
 */
export function getEquipmentImpactSummary(
  horse: HorseEntry
): {
  hasChanges: boolean
  summary: string
  totalImpact: number
  primaryChange: DetectedEquipmentChange | null
  hasTrainerPattern: boolean
} {
  const result = calculateEquipmentImpactScore(horse)

  if (!result.hasSignificantChange && result.changes.length === 0) {
    return {
      hasChanges: false,
      summary: '',
      totalImpact: 0,
      primaryChange: null,
      hasTrainerPattern: false,
    }
  }

  // Get primary change (highest absolute impact)
  const primaryChange = result.changes.length > 0
    ? result.changes.reduce((max, c) =>
        Math.abs(c.adjustedPoints) > Math.abs(max.adjustedPoints) ? c : max
      )
    : null

  return {
    hasChanges: true,
    summary: result.changes.map(c => c.changeDescription).join(', '),
    totalImpact: result.total - BASE_EQUIPMENT_SCORE,
    primaryChange,
    hasTrainerPattern: result.usesTrainerPattern,
  }
}

/**
 * Check if horse has any significant equipment change
 */
export function hasSignificantEquipmentImpact(horse: HorseEntry): boolean {
  const result = calculateEquipmentImpactScore(horse)
  return result.hasSignificantChange
}

/**
 * Get equipment score color for UI
 */
export function getEquipmentScoreColor(score: number): string {
  if (score >= 20) return '#22c55e'  // Excellent - green
  if (score >= 15) return '#36d1da'  // Good - cyan
  if (score >= 10) return '#888888'  // Neutral - gray
  if (score >= 5) return '#f97316'   // Concern - orange
  return '#ef4444'                   // Poor - red
}

/**
 * Format equipment change for display
 */
export function formatEquipmentChange(change: DetectedEquipmentChange): {
  label: string
  points: string
  color: string
  icon: string
} {
  const isPositive = change.adjustedPoints > 0
  const isNegative = change.adjustedPoints < 0

  let color: string
  let icon: string

  if (isPositive) {
    if (change.adjustedPoints >= 10) {
      color = '#22c55e'  // Bright green
      icon = 'rocket_launch'
    } else {
      color = '#36d1da'  // Cyan
      icon = 'trending_up'
    }
  } else if (isNegative) {
    if (change.adjustedPoints <= -5) {
      color = '#ef4444'  // Red
      icon = 'warning'
    } else {
      color = '#f97316'  // Orange
      icon = 'trending_down'
    }
  } else {
    color = '#888888'
    icon = 'remove'
  }

  return {
    label: change.changeDescription,
    points: isPositive ? `+${change.adjustedPoints}` : String(change.adjustedPoints),
    color,
    icon,
  }
}

/**
 * Get all horses with equipment changes in a race
 */
export function getHorsesWithEquipmentChanges(
  horses: HorseEntry[]
): {
  horse: HorseEntry
  changes: DetectedEquipmentChange[]
  totalImpact: number
}[] {
  return horses
    .map(horse => {
      const result = calculateEquipmentImpactScore(horse)
      return {
        horse,
        changes: result.changes,
        totalImpact: result.total - BASE_EQUIPMENT_SCORE,
      }
    })
    .filter(h => h.changes.length > 0)
    .sort((a, b) => Math.abs(b.totalImpact) - Math.abs(a.totalImpact))
}

/**
 * Count significant equipment changes in a race
 */
export function countEquipmentChanges(horses: HorseEntry[]): {
  total: number
  significant: number
  positive: number
  negative: number
} {
  let total = 0
  let significant = 0
  let positive = 0
  let negative = 0

  for (const horse of horses) {
    const result = calculateEquipmentImpactScore(horse)

    if (result.changes.length > 0) {
      total += result.changes.length

      if (result.hasSignificantChange) {
        significant++
      }

      for (const change of result.changes) {
        if (change.adjustedPoints > 0) positive++
        else if (change.adjustedPoints < 0) negative++
      }
    }
  }

  return { total, significant, positive, negative }
}
