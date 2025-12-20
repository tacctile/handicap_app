/**
 * Pace Scoring Module
 * Analyzes pace scenarios and running style matchups
 *
 * Score Range: 0-40 points
 *
 * Pace Scenario Scoring:
 * - Perfect pace fit (lone speed in soft pace): 40 points
 * - Good pace fit (presser in hot pace): 30 points
 * - Neutral fit: 20 points
 * - Poor fit (closer in soft pace): 10 points
 * - Terrible fit: 5 points
 */

import type { HorseEntry, RaceHeader, PastPerformance } from '../../types/drf'
import { getSpeedBias, isTrackIntelligenceAvailable } from '../trackIntelligence'

// ============================================================================
// TYPES
// ============================================================================

export type RunningStyle = 'E' | 'EP' | 'P' | 'S' | 'C' | 'U'  // Early, Early Presser, Presser, Stalker, Closer, Unknown

export type PaceScenario = 'lone_speed' | 'contested_speed' | 'honest' | 'slow' | 'unknown'

export interface PaceProfile {
  style: RunningStyle
  styleName: string
  earlySpeedRating: number
  averageEarlyPosition: number
  isConfirmedStyle: boolean
}

export interface FieldPaceAnalysis {
  scenario: PaceScenario
  scenarioDescription: string
  speedCount: number
  presserCount: number
  closerCount: number
  pacePressureIndex: number  // 0-100 scale
  expectedPace: 'fast' | 'moderate' | 'slow'
}

export interface PaceScoreResult {
  total: number
  profile: PaceProfile
  fieldAnalysis: FieldPaceAnalysis
  paceFit: 'perfect' | 'good' | 'neutral' | 'poor' | 'terrible'
  trackSpeedBias: number | null
  reasoning: string
}

// ============================================================================
// RUNNING STYLE IDENTIFICATION
// ============================================================================

/**
 * Running style labels for display
 */
const STYLE_NAMES: Record<RunningStyle, string> = {
  E: 'Early Speed',
  EP: 'Early Presser',
  P: 'Presser',
  S: 'Stalker',
  C: 'Closer',
  U: 'Unknown',
}

/**
 * Identify running style from past performances
 */
function identifyRunningStyle(horse: HorseEntry): PaceProfile {
  // Check if DRF already has running style
  if (horse.runningStyle) {
    const style = normalizeRunningStyle(horse.runningStyle)
    return {
      style,
      styleName: STYLE_NAMES[style],
      earlySpeedRating: horse.earlySpeedRating ?? 0,
      averageEarlyPosition: calculateAverageEarlyPosition(horse.pastPerformances),
      isConfirmedStyle: true,
    }
  }

  // Calculate from past performances
  if (horse.pastPerformances.length === 0) {
    return {
      style: 'U',
      styleName: 'Unknown',
      earlySpeedRating: 0,
      averageEarlyPosition: 0,
      isConfirmedStyle: false,
    }
  }

  const avgEarlyPos = calculateAverageEarlyPosition(horse.pastPerformances)
  const avgFieldSize = calculateAverageFieldSize(horse.pastPerformances)

  // Determine style based on relative early position
  const relativePosition = avgFieldSize > 0 ? avgEarlyPos / avgFieldSize : 0.5

  let style: RunningStyle
  if (relativePosition <= 0.15) {
    style = 'E'
  } else if (relativePosition <= 0.3) {
    style = 'EP'
  } else if (relativePosition <= 0.5) {
    style = 'P'
  } else if (relativePosition <= 0.7) {
    style = 'S'
  } else {
    style = 'C'
  }

  // Calculate early speed rating
  const earlySpeedRating = calculateEarlySpeedRating(horse.pastPerformances)

  return {
    style,
    styleName: STYLE_NAMES[style],
    earlySpeedRating,
    averageEarlyPosition: avgEarlyPos,
    isConfirmedStyle: false,
  }
}

/**
 * Normalize running style string from DRF
 */
function normalizeRunningStyle(style: string): RunningStyle {
  const normalized = style.toUpperCase().trim()

  if (normalized.startsWith('E') && normalized.includes('P')) return 'EP'
  if (normalized.startsWith('E')) return 'E'
  if (normalized === 'P' || normalized === 'PRESSER') return 'P'
  if (normalized === 'S' || normalized === 'STALKER') return 'S'
  if (normalized === 'C' || normalized === 'CLOSER') return 'C'

  return 'U'
}

/**
 * Calculate average early position from running lines
 */
function calculateAverageEarlyPosition(pastPerformances: PastPerformance[]): number {
  let total = 0
  let count = 0

  for (const pp of pastPerformances.slice(0, 5)) {
    // Use first call position (quarter mile or half mile depending on distance)
    const earlyPos = pp.runningLine.quarterMile ?? pp.runningLine.halfMile ?? pp.runningLine.start

    if (earlyPos !== null) {
      total += earlyPos
      count++
    }
  }

  return count > 0 ? total / count : 5  // Default to middle
}

/**
 * Calculate average field size
 */
function calculateAverageFieldSize(pastPerformances: PastPerformance[]): number {
  if (pastPerformances.length === 0) return 10

  const total = pastPerformances.slice(0, 5).reduce((sum, pp) => sum + pp.fieldSize, 0)
  return total / Math.min(pastPerformances.length, 5)
}

/**
 * Calculate early speed rating from PPs
 */
function calculateEarlySpeedRating(pastPerformances: PastPerformance[]): number {
  let score = 0
  let count = 0

  for (const pp of pastPerformances.slice(0, 5)) {
    const earlyPos = pp.runningLine.quarterMile ?? pp.runningLine.halfMile

    if (earlyPos !== null) {
      // Higher score for leading or close to lead
      const posScore = Math.max(0, 100 - (earlyPos - 1) * 15)
      score += posScore
      count++
    }
  }

  return count > 0 ? Math.round(score / count) : 50
}

// ============================================================================
// FIELD PACE ANALYSIS
// ============================================================================

/**
 * Analyze the pace scenario for the entire field
 */
export function analyzeFieldPace(horses: HorseEntry[]): FieldPaceAnalysis {
  const activeHorses = horses.filter(h => !h.isScratched)

  let speedCount = 0
  let presserCount = 0
  let stalkerCount = 0
  let closerCount = 0

  // Classify each horse's running style
  for (const horse of activeHorses) {
    const profile = identifyRunningStyle(horse)

    switch (profile.style) {
      case 'E':
        speedCount++
        break
      case 'EP':
        speedCount++  // Count as speed (will contest pace)
        presserCount++
        break
      case 'P':
        presserCount++
        break
      case 'S':
        stalkerCount++
        break
      case 'C':
        closerCount++
        break
    }
  }

  // Calculate pace pressure index (0-100)
  // Higher = more pace pressure
  const fieldSize = activeHorses.length
  const pacePressureIndex = Math.min(100, Math.round(
    (speedCount * 25 + presserCount * 10) / (fieldSize || 1) * 10
  ))

  // Determine pace scenario
  let scenario: PaceScenario
  let scenarioDescription: string
  let expectedPace: 'fast' | 'moderate' | 'slow'

  if (speedCount === 0) {
    scenario = 'slow'
    scenarioDescription = 'No early speed - soft pace expected'
    expectedPace = 'slow'
  } else if (speedCount === 1 && presserCount <= 1) {
    scenario = 'lone_speed'
    scenarioDescription = 'Lone speed - could steal on an easy lead'
    expectedPace = 'slow'
  } else if (speedCount >= 3 || (speedCount >= 2 && presserCount >= 2)) {
    scenario = 'contested_speed'
    scenarioDescription = 'Hot pace expected - speed duel likely'
    expectedPace = 'fast'
  } else {
    scenario = 'honest'
    scenarioDescription = 'Honest pace - tactical race expected'
    expectedPace = 'moderate'
  }

  return {
    scenario,
    scenarioDescription,
    speedCount,
    presserCount,
    closerCount: stalkerCount + closerCount,
    pacePressureIndex,
    expectedPace,
  }
}

// ============================================================================
// PACE FIT SCORING
// ============================================================================

/**
 * Calculate how well a horse's style fits the pace scenario
 */
function calculatePaceFit(
  profile: PaceProfile,
  fieldAnalysis: FieldPaceAnalysis,
  trackSpeedBias: number | null
): { fit: 'perfect' | 'good' | 'neutral' | 'poor' | 'terrible'; score: number } {
  const { style } = profile
  const { scenario, expectedPace } = fieldAnalysis

  // Track bias adjustment
  const trackFavorsSpeed = (trackSpeedBias ?? 50) >= 55
  const trackFavorsClosers = (trackSpeedBias ?? 50) <= 45

  // Perfect fits
  if (style === 'E' && scenario === 'lone_speed') {
    return { fit: 'perfect', score: 40 }
  }

  if ((style === 'C' || style === 'S') && scenario === 'contested_speed') {
    const bonus = trackFavorsClosers ? 5 : 0
    return { fit: 'perfect', score: 38 + bonus }
  }

  if (style === 'P' && scenario === 'honest') {
    return { fit: 'perfect', score: 38 }
  }

  // Good fits
  if (style === 'EP' && scenario === 'lone_speed') {
    return { fit: 'good', score: 32 }
  }

  if (style === 'P' && scenario === 'contested_speed') {
    return { fit: 'good', score: 30 }
  }

  if ((style === 'E' || style === 'EP') && trackFavorsSpeed && expectedPace !== 'fast') {
    return { fit: 'good', score: 30 }
  }

  if ((style === 'S' || style === 'C') && expectedPace === 'fast') {
    return { fit: 'good', score: 28 }
  }

  // Poor fits
  if ((style === 'C' || style === 'S') && scenario === 'slow') {
    const penalty = trackFavorsClosers ? 0 : -5
    return { fit: 'poor', score: 12 + penalty }
  }

  if (style === 'E' && scenario === 'contested_speed') {
    const penalty = trackFavorsSpeed ? 3 : -5
    return { fit: 'poor', score: 15 + penalty }
  }

  // Terrible fits
  if (style === 'C' && scenario === 'lone_speed' && !trackFavorsClosers) {
    return { fit: 'terrible', score: 5 }
  }

  // Neutral - default
  return { fit: 'neutral', score: 20 }
}

/**
 * Build reasoning string for pace score
 */
function buildReasoning(
  profile: PaceProfile,
  fieldAnalysis: FieldPaceAnalysis,
  paceFit: string,
  trackSpeedBias: number | null
): string {
  const parts: string[] = []

  parts.push(profile.styleName)
  parts.push(`(${fieldAnalysis.scenarioDescription})`)

  if (trackSpeedBias !== null) {
    if (trackSpeedBias >= 55) {
      parts.push('Speed-favoring track')
    } else if (trackSpeedBias <= 45) {
      parts.push('Closer-friendly track')
    }
  }

  parts.push(`Fit: ${paceFit}`)

  return parts.join(' | ')
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Calculate pace score for a horse
 *
 * @param horse - The horse entry to score
 * @param raceHeader - Race information
 * @param allHorses - All horses in the race for field analysis
 * @param preCalculatedFieldAnalysis - Optional pre-calculated field analysis for efficiency
 * @returns Detailed score breakdown
 */
export function calculatePaceScore(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  allHorses: HorseEntry[],
  preCalculatedFieldAnalysis?: FieldPaceAnalysis
): PaceScoreResult {
  // Get running style profile
  const profile = identifyRunningStyle(horse)

  // Analyze field pace (use pre-calculated if available)
  const fieldAnalysis = preCalculatedFieldAnalysis ?? analyzeFieldPace(allHorses)

  // Get track speed bias
  let trackSpeedBias: number | null = null
  if (isTrackIntelligenceAvailable(raceHeader.trackCode)) {
    const speedBiasData = getSpeedBias(raceHeader.trackCode, raceHeader.surface)
    if (speedBiasData) {
      trackSpeedBias = speedBiasData.earlySpeedWinRate
    }
  }

  // Calculate pace fit
  const { fit, score } = calculatePaceFit(profile, fieldAnalysis, trackSpeedBias)

  // Build reasoning
  const reasoning = buildReasoning(profile, fieldAnalysis, fit, trackSpeedBias)

  return {
    total: Math.max(5, Math.min(40, score)),
    profile,
    fieldAnalysis,
    paceFit: fit,
    trackSpeedBias,
    reasoning,
  }
}

/**
 * Get pace summary for quick display
 */
export function getPaceSummary(
  horse: HorseEntry,
  allHorses: HorseEntry[]
): { style: string; scenario: string; fit: string } {
  const profile = identifyRunningStyle(horse)
  const fieldAnalysis = analyzeFieldPace(allHorses)

  return {
    style: profile.styleName,
    scenario: fieldAnalysis.scenarioDescription,
    fit: calculatePaceFit(profile, fieldAnalysis, null).fit,
  }
}

/**
 * Calculate pace scores for all horses efficiently
 * Shares field analysis calculation
 */
export function calculateRacePaceScores(
  horses: HorseEntry[],
  raceHeader: RaceHeader
): Map<number, PaceScoreResult> {
  // Pre-calculate field analysis once
  const fieldAnalysis = analyzeFieldPace(horses)

  const results = new Map<number, PaceScoreResult>()

  for (let i = 0; i < horses.length; i++) {
    results.set(i, calculatePaceScore(horses[i], raceHeader, horses, fieldAnalysis))
  }

  return results
}
