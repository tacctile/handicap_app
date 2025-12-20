/**
 * Equipment Scoring Module
 * Detects equipment changes and calculates impact on performance
 *
 * Score Breakdown:
 * - First-time Lasix: +12 points (if trainer has success pattern)
 * - Blinkers ON first time: +10 points
 * - Blinkers OFF: +8 points (if previous pace issues)
 * - Other equipment changes: +5 points
 *
 * Base Score: 10 points (no changes)
 * Total Range: 0-25 points
 */

import type { HorseEntry, Equipment } from '../../types/drf'

// ============================================================================
// TYPES
// ============================================================================

export interface EquipmentChange {
  type: 'lasix_first' | 'lasix_off' | 'blinkers_on' | 'blinkers_off' | 'other'
  description: string
  impact: 'positive' | 'neutral' | 'negative'
  points: number
}

export interface EquipmentScoreResult {
  total: number
  baseScore: number
  changes: EquipmentChange[]
  hasSignificantChange: boolean
  reasoning: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_EQUIPMENT_SCORE = 10

const EQUIPMENT_CHANGE_POINTS = {
  lasix_first: 12,      // First-time Lasix
  lasix_off: -3,        // Lasix off (usually negative)
  blinkers_on: 10,      // Blinkers on first time
  blinkers_off: 8,      // Blinkers off (can help over-aggressive horses)
  tongue_tie_on: 5,     // Tongue tie added
  nasal_strip_on: 4,    // Nasal strip added
  cheek_pieces_on: 5,   // Cheek pieces added
  shadow_roll_on: 4,    // Shadow roll added
  bar_shoes_on: 3,      // Bar shoes (for hoof issues)
  mud_caulks_on: 3,     // Mud caulks (wet track specific)
  other: 2,             // Any other change
} as const

const MAX_EQUIPMENT_SCORE = 25

// ============================================================================
// EQUIPMENT CHANGE DETECTION
// ============================================================================

/**
 * Detect first-time Lasix
 */
function detectLasixChange(horse: HorseEntry): EquipmentChange | null {
  if (horse.medication.lasixFirstTime) {
    return {
      type: 'lasix_first',
      description: 'First-time Lasix',
      impact: 'positive',
      points: EQUIPMENT_CHANGE_POINTS.lasix_first,
    }
  }

  if (horse.medication.lasixOff) {
    return {
      type: 'lasix_off',
      description: 'Lasix off',
      impact: 'negative',
      points: EQUIPMENT_CHANGE_POINTS.lasix_off,
    }
  }

  return null
}

/**
 * Detect blinker changes
 */
function detectBlinkerChange(horse: HorseEntry): EquipmentChange | null {
  const equipment = horse.equipment
  const firstTimeEquip = equipment.firstTimeEquipment.map(e => e.toLowerCase())

  // First-time blinkers
  if (firstTimeEquip.includes('blinkers') || firstTimeEquip.includes('b')) {
    return {
      type: 'blinkers_on',
      description: 'Blinkers ON (first time)',
      impact: 'positive',
      points: EQUIPMENT_CHANGE_POINTS.blinkers_on,
    }
  }

  // Blinkers off
  if (equipment.blinkersOff) {
    return {
      type: 'blinkers_off',
      description: 'Blinkers OFF',
      impact: 'positive',  // Can help horses that were over-aggressive
      points: EQUIPMENT_CHANGE_POINTS.blinkers_off,
    }
  }

  return null
}

/**
 * Detect other equipment changes
 */
function detectOtherEquipmentChanges(horse: HorseEntry): EquipmentChange[] {
  const changes: EquipmentChange[] = []
  const equipment = horse.equipment
  const firstTimeEquip = equipment.firstTimeEquipment.map(e => e.toLowerCase())
  const equipChanges = equipment.equipmentChanges.map(e => e.toLowerCase())

  // Tongue tie added
  if (firstTimeEquip.includes('tongue tie') || firstTimeEquip.includes('t')) {
    changes.push({
      type: 'other',
      description: 'Tongue tie ON',
      impact: 'positive',
      points: EQUIPMENT_CHANGE_POINTS.tongue_tie_on,
    })
  }

  // Nasal strip added
  if (firstTimeEquip.includes('nasal strip') || firstTimeEquip.includes('n')) {
    changes.push({
      type: 'other',
      description: 'Nasal strip ON',
      impact: 'positive',
      points: EQUIPMENT_CHANGE_POINTS.nasal_strip_on,
    })
  }

  // Cheek pieces added
  if (firstTimeEquip.includes('cheek pieces') || firstTimeEquip.includes('c')) {
    changes.push({
      type: 'other',
      description: 'Cheek pieces ON',
      impact: 'positive',
      points: EQUIPMENT_CHANGE_POINTS.cheek_pieces_on,
    })
  }

  // Shadow roll added
  if (firstTimeEquip.includes('shadow roll') || firstTimeEquip.includes('s')) {
    changes.push({
      type: 'other',
      description: 'Shadow roll ON',
      impact: 'positive',
      points: EQUIPMENT_CHANGE_POINTS.shadow_roll_on,
    })
  }

  // Bar shoes (often for hoof issues)
  if (equipment.barShoes && !hasEquipmentInLastRace(horse, 'barShoes')) {
    changes.push({
      type: 'other',
      description: 'Bar shoes ON',
      impact: 'neutral',
      points: EQUIPMENT_CHANGE_POINTS.bar_shoes_on,
    })
  }

  // Mud caulks (wet track specific)
  if (equipment.mudCaulks) {
    changes.push({
      type: 'other',
      description: 'Mud caulks ON',
      impact: 'positive',
      points: EQUIPMENT_CHANGE_POINTS.mud_caulks_on,
    })
  }

  // Check for any generic equipment changes not covered above
  for (const change of equipChanges) {
    const alreadyCovered = [
      'blinkers', 'tongue tie', 'nasal strip', 'cheek pieces',
      'shadow roll', 'bar shoes', 'mud caulks', 'b', 't', 'n', 'c', 's'
    ]

    if (!alreadyCovered.some(c => change.includes(c))) {
      changes.push({
        type: 'other',
        description: `Equipment change: ${change}`,
        impact: 'neutral',
        points: EQUIPMENT_CHANGE_POINTS.other,
      })
    }
  }

  return changes
}

/**
 * Check if equipment was present in last race
 */
function hasEquipmentInLastRace(
  horse: HorseEntry,
  equipmentType: keyof Equipment
): boolean {
  if (horse.pastPerformances.length === 0) return false

  // Equipment in past performances is stored as raw string
  const lastPP = horse.pastPerformances[0]
  const equipStr = lastPP.equipment.toLowerCase()

  const equipmentMapping: Record<string, string[]> = {
    blinkers: ['b', 'blink'],
    barShoes: ['bar', 'bs'],
    mudCaulks: ['mud', 'mc'],
    tongueTie: ['tt', 'tongue'],
    nasalStrip: ['ns', 'nasal'],
    shadowRoll: ['sr', 'shadow'],
    cheekPieces: ['cp', 'cheek'],
  }

  const searchTerms = equipmentMapping[equipmentType] || []
  return searchTerms.some(term => equipStr.includes(term))
}

// ============================================================================
// TRAINER PATTERN ANALYSIS
// ============================================================================

/**
 * Check if trainer has success with first-time Lasix
 * This would ideally use a larger database, but we can check patterns
 * from the horse's own past or make a reasonable estimate
 */
function hasTrainerLasixPattern(_horse: HorseEntry): boolean {
  // This is a simplified check
  // In a full system, we'd have trainer statistics database

  // Check if horse's past performances show any pattern
  // For now, assume first-time Lasix is generally positive
  return true
}

/**
 * Check for pace issues that blinkers-off might help
 */
function hadPaceIssues(horse: HorseEntry): boolean {
  if (horse.pastPerformances.length === 0) return false

  const lastRaces = horse.pastPerformances.slice(0, 3)

  // Look for races where horse was leading early but faded
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

// ============================================================================
// SCORING CALCULATION
// ============================================================================

/**
 * Calculate total equipment change points
 */
function calculateChangePoints(
  changes: EquipmentChange[],
  horse: HorseEntry
): number {
  let points = 0

  for (const change of changes) {
    let changePoints = change.points

    // Adjust Lasix first-time based on trainer pattern
    if (change.type === 'lasix_first' && !hasTrainerLasixPattern(horse)) {
      changePoints = Math.round(changePoints * 0.7)  // Reduce impact
    }

    // Adjust blinkers-off based on pace issues
    if (change.type === 'blinkers_off' && hadPaceIssues(horse)) {
      changePoints += 2  // Bonus for addressing pace issues
    }

    points += changePoints
  }

  return points
}

/**
 * Build reasoning string
 */
function buildReasoning(changes: EquipmentChange[]): string {
  if (changes.length === 0) {
    return 'No equipment changes'
  }

  const descriptions = changes.map(c => c.description)
  return descriptions.join(' + ')
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Calculate equipment score for a horse
 *
 * @param horse - The horse entry to score
 * @returns Detailed score breakdown
 */
export function calculateEquipmentScore(horse: HorseEntry): EquipmentScoreResult {
  const changes: EquipmentChange[] = []

  // Detect Lasix changes
  const lasixChange = detectLasixChange(horse)
  if (lasixChange) changes.push(lasixChange)

  // Detect blinker changes
  const blinkerChange = detectBlinkerChange(horse)
  if (blinkerChange) changes.push(blinkerChange)

  // Detect other equipment changes
  const otherChanges = detectOtherEquipmentChanges(horse)
  changes.push(...otherChanges)

  // Calculate points from changes
  const changePoints = calculateChangePoints(changes, horse)

  // Calculate total score
  let total = BASE_EQUIPMENT_SCORE + changePoints
  total = Math.max(0, Math.min(MAX_EQUIPMENT_SCORE, total))

  // Build reasoning
  const reasoning = buildReasoning(changes)

  return {
    total,
    baseScore: BASE_EQUIPMENT_SCORE,
    changes,
    hasSignificantChange: changes.some(c =>
      c.type === 'lasix_first' || c.type === 'blinkers_on' || c.type === 'blinkers_off'
    ),
    reasoning,
  }
}

/**
 * Get equipment changes summary for display
 */
export function getEquipmentSummary(
  horse: HorseEntry
): { hasChanges: boolean; summary: string } {
  const result = calculateEquipmentScore(horse)

  if (result.changes.length === 0) {
    return { hasChanges: false, summary: '' }
  }

  return {
    hasChanges: true,
    summary: result.changes.map(c => c.description).join(', '),
  }
}

/**
 * Check if horse has significant equipment change
 */
export function hasSignificantEquipmentChange(horse: HorseEntry): boolean {
  const result = calculateEquipmentScore(horse)
  return result.hasSignificantChange
}
