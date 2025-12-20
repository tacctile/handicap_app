/**
 * Class Scoring Module
 *
 * Calculates class-based scores for the handicapping system.
 * Class contributes up to 20 points to the overall score.
 *
 * Scoring Components:
 * - Proven at Level: +10 to +20 pts
 * - Class Drops: +5 to +15 pts
 * - Class Rises: -5 to +5 pts
 * - Hidden Drops: +6 to +12 pts (CRITICAL value plays)
 */

import type { HorseEntry, RaceHeader, PastPerformance } from '../../types/drf'
import {
  ClassLevel,
  ClassAnalysisResult,
  ProvenAtLevelResult,
  HiddenClassDrop,
  CLASS_LEVEL_METADATA,
  getClassLevelAbbrev,
} from './classTypes'
import { analyzeClass, extractClassFromPP, extractCurrentRaceClass } from './classExtractor'
import { analyzeTrackTierMovement } from './trackTiers'

// ============================================================================
// SCORE CONSTANTS
// ============================================================================

/** Maximum class score contribution */
export const MAX_CLASS_SCORE = 20

/** Score weights for different factors */
const SCORE_WEIGHTS = {
  // Proven at level
  PROVEN_WINNER: 20,
  PROVEN_PLACED: 15,
  PROVEN_COMPETITIVE: 10,

  // Class drops
  DROP_1_LEVEL_PROVEN: 15,
  DROP_2_LEVELS: 12,
  DROP_3_PLUS_LEVELS: 8, // Too far, be skeptical
  CLAIMING_DROP_10K_PLUS: 10,

  // Class rises
  RISE_1_LEVEL_WON_LAST: 5,
  RISE_2_PLUS_LEVELS: -5,
  MAIDEN_TO_STAKES: -3,

  // Hidden drops
  TRACK_TIER_A_TO_C: 8,
  TRACK_TIER_A_TO_B: 4,
  TRACK_TIER_B_TO_C: 5,
  PURSE_DROP_SIGNIFICANT: 6,
  CLAIMING_PRICE_DROP: 12,
} as const

// ============================================================================
// DETAILED CLASS SCORE RESULT
// ============================================================================

export interface ClassScoreResult {
  /** Total class score (0-20) */
  total: number
  /** Proven at level component */
  provenAtLevelScore: number
  /** Class movement component */
  classMovementScore: number
  /** Hidden drops bonus */
  hiddenDropsScore: number
  /** Track tier adjustment */
  trackTierScore: number
  /** Full class analysis */
  analysis: ClassAnalysisResult
  /** Reasoning for display */
  reasoning: string
  /** Detailed breakdown for tooltip */
  breakdown: ClassScoreBreakdownItem[]
}

export interface ClassScoreBreakdownItem {
  label: string
  points: number
  description: string
}

// ============================================================================
// PROVEN AT LEVEL SCORING
// ============================================================================

/**
 * Score based on horse's proven performance at this class level
 */
function scoreProvenAtLevel(proven: ProvenAtLevelResult): {
  score: number
  breakdown: ClassScoreBreakdownItem[]
} {
  const breakdown: ClassScoreBreakdownItem[] = []
  let score = 0

  if (proven.hasWon) {
    score = SCORE_WEIGHTS.PROVEN_WINNER
    breakdown.push({
      label: 'Proven Winner',
      points: SCORE_WEIGHTS.PROVEN_WINNER,
      description: `${proven.winsAtLevel} win(s) at this class or higher`,
    })
  } else if (proven.hasPlaced) {
    score = SCORE_WEIGHTS.PROVEN_PLACED
    breakdown.push({
      label: 'Proven Placer',
      points: SCORE_WEIGHTS.PROVEN_PLACED,
      description: `${proven.itmAtLevel} ITM at this class or higher`,
    })
  } else if (proven.wasCompetitive) {
    score = SCORE_WEIGHTS.PROVEN_COMPETITIVE
    breakdown.push({
      label: 'Competitive',
      points: SCORE_WEIGHTS.PROVEN_COMPETITIVE,
      description: `${proven.competitiveRacesAtLevel} competitive race(s) within 5 lengths`,
    })
  }

  return { score, breakdown }
}

// ============================================================================
// CLASS MOVEMENT SCORING
// ============================================================================

/**
 * Score based on class movement from last race
 */
function scoreClassMovement(
  analysis: ClassAnalysisResult,
  lastPP: PastPerformance | null
): { score: number; breakdown: ClassScoreBreakdownItem[] } {
  const breakdown: ClassScoreBreakdownItem[] = []
  let score = 0
  const movement = analysis.movement

  if (movement.direction === 'drop') {
    // Calculate level difference
    const fromValue = CLASS_LEVEL_METADATA[movement.fromLevel].value
    const toValue = CLASS_LEVEL_METADATA[movement.toLevel].value
    const levelsDiff = Math.round((fromValue - toValue) / 5) // Normalize to approximate levels

    if (levelsDiff === 1 && analysis.provenAtLevel.hasWon) {
      score = SCORE_WEIGHTS.DROP_1_LEVEL_PROVEN
      breakdown.push({
        label: '1-Level Drop (Proven Higher)',
        points: SCORE_WEIGHTS.DROP_1_LEVEL_PROVEN,
        description: `Dropping from ${getClassLevelAbbrev(movement.fromLevel)}, has won at higher level`,
      })
    } else if (levelsDiff === 1 || levelsDiff === 2) {
      score = SCORE_WEIGHTS.DROP_2_LEVELS
      breakdown.push({
        label: `${levelsDiff}-Level Drop`,
        points: SCORE_WEIGHTS.DROP_2_LEVELS,
        description: `Dropping from ${getClassLevelAbbrev(movement.fromLevel)} to ${getClassLevelAbbrev(movement.toLevel)}`,
      })
    } else if (levelsDiff >= 3) {
      score = SCORE_WEIGHTS.DROP_3_PLUS_LEVELS
      breakdown.push({
        label: 'Major Class Drop',
        points: SCORE_WEIGHTS.DROP_3_PLUS_LEVELS,
        description: `Dropping ${levelsDiff} levels - significant drop, be skeptical`,
      })
    }

    // Claiming price drop bonus
    if (movement.claimingPriceDrop && movement.claimingPriceDrop >= 10000) {
      const claimBonus = Math.min(SCORE_WEIGHTS.CLAIMING_DROP_10K_PLUS, Math.floor(movement.claimingPriceDrop / 5000))
      score += claimBonus
      breakdown.push({
        label: 'Claiming Price Drop',
        points: claimBonus,
        description: `$${(movement.claimingPriceDrop / 1000).toFixed(0)}K claiming drop`,
      })
    }
  } else if (movement.direction === 'rise') {
    // Check if won last race
    const wonLast = lastPP?.finishPosition === 1

    if (wonLast && Math.abs(movement.levelsDifference) <= 5) {
      score = SCORE_WEIGHTS.RISE_1_LEVEL_WON_LAST
      breakdown.push({
        label: 'Rising After Win',
        points: SCORE_WEIGHTS.RISE_1_LEVEL_WON_LAST,
        description: 'Won last, testing higher class',
      })
    } else if (Math.abs(movement.levelsDifference) >= 10) {
      score = SCORE_WEIGHTS.RISE_2_PLUS_LEVELS
      breakdown.push({
        label: 'Ambitious Rise',
        points: SCORE_WEIGHTS.RISE_2_PLUS_LEVELS,
        description: `Rising significantly to ${getClassLevelAbbrev(movement.toLevel)}`,
      })
    }

    // Check for maiden to stakes (rare success)
    if (
      (movement.fromLevel === ClassLevel.MAIDEN_SPECIAL_WEIGHT || movement.fromLevel === ClassLevel.MAIDEN_CLAIMING) &&
      (movement.toLevel === ClassLevel.STAKES_UNGRADED ||
        movement.toLevel === ClassLevel.STAKES_LISTED ||
        movement.toLevel === ClassLevel.STAKES_GRADE_3 ||
        movement.toLevel === ClassLevel.STAKES_GRADE_2 ||
        movement.toLevel === ClassLevel.STAKES_GRADE_1)
    ) {
      score = Math.min(score, SCORE_WEIGHTS.MAIDEN_TO_STAKES)
      breakdown.push({
        label: 'Maiden to Stakes',
        points: SCORE_WEIGHTS.MAIDEN_TO_STAKES,
        description: 'Rare for maiden winner to succeed in stakes',
      })
    }
  }

  return { score, breakdown }
}

// ============================================================================
// HIDDEN DROPS SCORING
// ============================================================================

/**
 * Score hidden class drops - these are CRITICAL value plays
 */
function scoreHiddenDrops(hiddenDrops: HiddenClassDrop[]): {
  score: number
  breakdown: ClassScoreBreakdownItem[]
} {
  const breakdown: ClassScoreBreakdownItem[] = []
  let score = 0

  for (const drop of hiddenDrops) {
    score += drop.pointsBonus
    breakdown.push({
      label: drop.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      points: drop.pointsBonus,
      description: drop.description,
    })
  }

  return { score, breakdown }
}

// ============================================================================
// TRACK TIER SCORING
// ============================================================================

/**
 * Score based on track tier movement
 */
function scoreTrackTier(
  previousTrack: string | null,
  currentTrack: string
): { score: number; breakdown: ClassScoreBreakdownItem[] } {
  const breakdown: ClassScoreBreakdownItem[] = []
  let score = 0

  if (!previousTrack) {
    return { score, breakdown }
  }

  const movement = analyzeTrackTierMovement(previousTrack, currentTrack)

  if (movement) {
    score = movement.pointsAdjustment
    breakdown.push({
      label: 'Track Tier',
      points: movement.pointsAdjustment,
      description: movement.description,
    })
  }

  return { score, breakdown }
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate complete class score for a horse
 */
export function calculateClassScore(
  horse: HorseEntry,
  raceHeader: RaceHeader
): ClassScoreResult {
  // Get full analysis
  const analysis = analyzeClass(horse, raceHeader)
  const pps = horse.pastPerformances
  const lastPP = pps.length > 0 ? pps[0] : null
  const breakdown: ClassScoreBreakdownItem[] = []

  // Score proven at level
  const provenResult = scoreProvenAtLevel(analysis.provenAtLevel)
  breakdown.push(...provenResult.breakdown)

  // Score class movement
  const movementResult = scoreClassMovement(analysis, lastPP)
  breakdown.push(...movementResult.breakdown)

  // Score hidden drops
  const hiddenResult = scoreHiddenDrops(analysis.hiddenDrops)
  breakdown.push(...hiddenResult.breakdown)

  // Score track tier (only if not already counted in hidden drops)
  let trackTierScore = 0
  if (!analysis.hiddenDrops.some(d => d.type === 'track_tier_drop')) {
    const trackResult = scoreTrackTier(lastPP?.track ?? null, raceHeader.trackCode)
    breakdown.push(...trackResult.breakdown)
    trackTierScore = trackResult.score
  }

  // Calculate total
  let total =
    provenResult.score +
    movementResult.score +
    hiddenResult.score +
    trackTierScore

  // Cap at max
  total = Math.max(0, Math.min(MAX_CLASS_SCORE, total))

  // Build reasoning string
  const reasoningParts: string[] = []

  if (analysis.provenAtLevel.hasWon) {
    reasoningParts.push(`${analysis.provenAtLevel.winsAtLevel}W at class`)
  } else if (analysis.provenAtLevel.hasPlaced) {
    reasoningParts.push(`${analysis.provenAtLevel.itmAtLevel} ITM at class`)
  }

  if (analysis.movement.direction === 'drop') {
    reasoningParts.push(analysis.movement.description)
  } else if (analysis.movement.direction === 'rise') {
    reasoningParts.push(`Rising: ${analysis.movement.description}`)
  }

  if (analysis.hiddenDrops.length > 0) {
    reasoningParts.push(`${analysis.hiddenDrops.length} hidden edge(s)`)
  }

  const reasoning = reasoningParts.length > 0
    ? reasoningParts.join(' | ')
    : 'Class analysis neutral'

  return {
    total,
    provenAtLevelScore: provenResult.score,
    classMovementScore: movementResult.score,
    hiddenDropsScore: hiddenResult.score,
    trackTierScore,
    analysis,
    reasoning,
    breakdown,
  }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get class score display color
 */
export function getClassScoreColor(score: number): string {
  if (score >= 16) return '#22c55e' // Green - excellent
  if (score >= 12) return '#84cc16' // Light green - good
  if (score >= 8) return '#eab308' // Yellow - neutral
  if (score >= 4) return '#f97316' // Orange - concerning
  return '#ef4444' // Red - poor
}

/**
 * Get class score tier label
 */
export function getClassScoreTier(score: number): string {
  if (score >= 16) return 'Excellent'
  if (score >= 12) return 'Good'
  if (score >= 8) return 'Neutral'
  if (score >= 4) return 'Concerning'
  return 'Poor'
}

/**
 * Format class movement for display
 */
export function formatClassMovement(analysis: ClassAnalysisResult): string {
  const movement = analysis.movement

  switch (movement.direction) {
    case 'drop':
      return `↓ ${getClassLevelAbbrev(movement.fromLevel)} → ${getClassLevelAbbrev(movement.toLevel)}`
    case 'rise':
      return `↑ ${getClassLevelAbbrev(movement.fromLevel)} → ${getClassLevelAbbrev(movement.toLevel)}`
    case 'lateral':
      return `→ ${getClassLevelAbbrev(movement.toLevel)}`
    default:
      return 'First Start'
  }
}

/**
 * Get hidden drops summary for display
 */
export function getHiddenDropsSummary(drops: HiddenClassDrop[]): string {
  if (drops.length === 0) return ''

  const summaries = drops.map(d => {
    switch (d.type) {
      case 'track_tier_drop':
        return 'Track drop'
      case 'purse_drop':
        return 'Purse drop'
      case 'claiming_price_drop':
        return 'Claiming drop'
      case 'shipper_from_elite':
        return 'Elite shipper'
      case 'runner_up_key_race':
        return 'Key race 2nd'
      default:
        return 'Hidden edge'
    }
  })

  return summaries.join(', ')
}

/**
 * Check if horse has significant hidden value
 */
export function hasSignificantHiddenValue(score: ClassScoreResult): boolean {
  return score.hiddenDropsScore >= 8 || score.analysis.hiddenDrops.length >= 2
}

/**
 * Get value play indicator
 */
export function isValuePlay(score: ClassScoreResult): boolean {
  // Value play if: dropping with hidden edges, or proven with big drop
  return (
    (score.analysis.movement.direction === 'drop' && score.hiddenDropsScore >= 6) ||
    (score.provenAtLevelScore >= 15 && score.classMovementScore > 0) ||
    score.hiddenDropsScore >= 10
  )
}
