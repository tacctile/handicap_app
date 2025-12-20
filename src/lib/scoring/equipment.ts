/**
 * Equipment Scoring Module
 *
 * Enhanced equipment change detection and scoring with trainer-specific patterns.
 * Uses the comprehensive equipment analysis module for detailed tracking.
 *
 * Score Breakdown:
 * - First-time Lasix: +12-20 points (trainer-dependent)
 * - Lasix removal: -8 pts
 * - Blinkers ON (first-time): +10-16 points (trainer-dependent)
 * - Blinkers OFF: +8-15 points (can help aggressive horses)
 * - Tongue tie: +5-8 pts
 * - Other equipment: +2-5 pts
 *
 * Base Score: 10 points (no changes)
 * Total Range: 0-25 points
 */

import type { HorseEntry, RaceHeader } from '../../types/drf'
import {
  calculateEquipmentImpactScore,
  getEquipmentImpactSummary,
  hasSignificantEquipmentImpact,
  type DetectedEquipmentChange,
} from '../equipment'

// ============================================================================
// TYPES (Backwards Compatible)
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
  /** Detailed changes from new equipment module */
  detailedChanges?: DetectedEquipmentChange[]
  /** Trainer pattern evidence if applicable */
  trainerEvidence?: string | null
}

// ============================================================================
// CONVERSION HELPERS
// ============================================================================

/**
 * Convert new DetectedEquipmentChange to legacy EquipmentChange format
 */
function convertToLegacyChange(change: DetectedEquipmentChange): EquipmentChange {
  // Map equipment type to legacy type
  let type: EquipmentChange['type'] = 'other'

  if (change.equipmentType.id === 'lasix') {
    type = change.direction === 'added' ? 'lasix_first' : 'lasix_off'
  } else if (change.equipmentType.id === 'blinkers') {
    type = change.direction === 'added' ? 'blinkers_on' : 'blinkers_off'
  }

  // Map impact
  let impact: EquipmentChange['impact'] = 'neutral'
  if (change.adjustedPoints >= 5) {
    impact = 'positive'
  } else if (change.adjustedPoints < 0) {
    impact = 'negative'
  }

  return {
    type,
    description: change.changeDescription,
    impact,
    points: change.adjustedPoints,
  }
}

// ============================================================================
// MAIN EXPORTS
// ============================================================================

/**
 * Calculate equipment score for a horse
 *
 * @param horse - The horse entry to score
 * @param raceHeader - Optional race header for context-aware adjustments
 * @returns Detailed score breakdown
 */
export function calculateEquipmentScore(
  horse: HorseEntry,
  raceHeader?: RaceHeader
): EquipmentScoreResult {
  // Use new comprehensive equipment scoring
  const detailed = calculateEquipmentImpactScore(horse, raceHeader)

  // Convert to legacy format for backwards compatibility
  const legacyChanges = detailed.changes.map(convertToLegacyChange)

  return {
    total: detailed.total,
    baseScore: detailed.baseScore,
    changes: legacyChanges,
    hasSignificantChange: detailed.hasSignificantChange,
    reasoning: detailed.reasoning,
    detailedChanges: detailed.changes,
    trainerEvidence: detailed.trainerEvidence,
  }
}

/**
 * Get equipment changes summary for display
 */
export function getEquipmentSummary(
  horse: HorseEntry
): { hasChanges: boolean; summary: string } {
  const result = getEquipmentImpactSummary(horse)

  return {
    hasChanges: result.hasChanges,
    summary: result.summary,
  }
}

/**
 * Check if horse has significant equipment change
 */
export function hasSignificantEquipmentChange(horse: HorseEntry): boolean {
  return hasSignificantEquipmentImpact(horse)
}

// ============================================================================
// NEW EXPORTS FOR ENHANCED UI
// ============================================================================

// Re-export all equipment module functions for enhanced UI
export {
  // Types
  type DetectedEquipmentChange,
  type EquipmentAnalysis,
  type EquipmentHistoryEntry,
  type EquipmentScoreResult as DetailedEquipmentScoreResult,
  type TrainerEquipmentPattern,

  // Type helpers
  getImpactColor,
  getImpactIcon,
  getCategoryIcon,
  getImpactClassification,

  // Extraction functions
  extractEquipmentInfo,
  getEquipmentChangeSummary,
  analyzeEquipmentHistory,
  hasEquipment,
  hasUsedEquipmentBefore,

  // Scoring functions
  calculateEquipmentImpactScore,
  getEquipmentImpactSummary,
  hasSignificantEquipmentImpact,
  getEquipmentScoreColor,
  formatEquipmentChange,
  getHorsesWithEquipmentChanges,
  countEquipmentChanges,
  BASE_EQUIPMENT_SCORE,
  MAX_EQUIPMENT_SCORE,

  // Trainer patterns
  getTrainerProfile,
  getTrainerPattern,
  hasCrediblePattern,
  getTopLasixTrainers,
  getTopBlinkersTrainers,
  compareToBaseRate,
} from '../equipment'
