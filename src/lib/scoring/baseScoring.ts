import type { HorseEntry, RaceHeader } from '../../types/drf'
import type { TrackCondition } from '../../hooks/useRaceState'
import {
  getPostPositionBiasMultiplier,
  isTrackIntelligenceAvailable
} from '../trackIntelligence'

// Score breakdown for transparency
export interface ScoreBreakdown {
  connections: { total: number; trainer: number; jockey: number }
  postPosition: { total: number; reasoning: string; trackBiasApplied: boolean }
  speedFigure: { total: number; reasoning: string }
  form: { total: number; reasoning: string }
  equipment: { total: number; reasoning: string }
  pace: { total: number; reasoning: string }
}

// Placeholder trainer scores - will be replaced with real data
const TRAINER_SCORES: Record<string, number> = {
  // Top trainers get higher scores
  'BAFFERT': 25,
  'PLETCHER': 24,
  'ASMUSSEN': 23,
  'COX': 22,
  'MOTT': 21,
}

// Placeholder jockey scores - will be replaced with real data
const JOCKEY_SCORES: Record<string, number> = {
  'VELAZQUEZ': 25,
  'PRAT': 24,
  'ROSARIO': 23,
  'SAEZ': 22,
  'ORTIZ': 21,
  'CASTELLANO': 20,
}

/**
 * A. Calculate Connections Score (max 50 points)
 * Trainer base score + Jockey base score
 */
export function calculateConnectionsScore(horse: HorseEntry): ScoreBreakdown['connections'] {
  const trainerUpper = horse.trainerName.toUpperCase()
  const jockeyUpper = horse.jockeyName.toUpperCase()

  // Look up trainer score (check if name contains known trainer)
  let trainerScore = 12 // Default base score
  for (const [name, score] of Object.entries(TRAINER_SCORES)) {
    if (trainerUpper.includes(name)) {
      trainerScore = score
      break
    }
  }

  // Look up jockey score (check if name contains known jockey)
  let jockeyScore = 12 // Default base score
  for (const [name, score] of Object.entries(JOCKEY_SCORES)) {
    if (jockeyUpper.includes(name)) {
      jockeyScore = score
      break
    }
  }

  return {
    total: trainerScore + jockeyScore,
    trainer: trainerScore,
    jockey: jockeyScore,
  }
}

/**
 * Parse distance string to determine if sprint or route
 * Sprint: 6F-7F
 * Route: 1M+
 */
function parseDistance(distance: string): { isSprint: boolean; isRoute: boolean; furlongs: number } {
  const distLower = distance.toLowerCase()

  // Handle mile distances
  if (distLower.includes('m')) {
    const mileMatch = distLower.match(/(\d+\.?\d*)\s*m/)
    if (mileMatch) {
      const miles = parseFloat(mileMatch[1])
      const furlongs = miles * 8
      return { isSprint: false, isRoute: true, furlongs }
    }
  }

  // Handle furlong distances
  const furlongMatch = distLower.match(/(\d+\.?\d*)\s*f/)
  if (furlongMatch) {
    const furlongs = parseFloat(furlongMatch[1])
    return {
      isSprint: furlongs >= 6 && furlongs <= 7,
      isRoute: furlongs >= 8,
      furlongs,
    }
  }

  // Default to sprint if can't parse
  return { isSprint: true, isRoute: false, furlongs: 6 }
}

/**
 * B. Calculate Post Position Score (max 45 points)
 * Now uses track-specific bias data when available
 * Falls back to generic scoring when track not in database
 */
export function calculatePostPositionScore(
  horse: HorseEntry,
  raceHeader: RaceHeader
): ScoreBreakdown['postPosition'] {
  const pp = horse.postPosition
  const { isSprint, isRoute } = parseDistance(raceHeader.distance)
  const trackCode = raceHeader.trackCode
  const hasTrackData = isTrackIntelligenceAvailable(trackCode)

  let baseScore = 10 // Base score
  let reasoning = ''

  // Calculate base score using generic rules
  if (isSprint) {
    // Sprint distances (6F-7F)
    if (pp === 4) {
      baseScore = 20
      reasoning = 'Ideal sprint post (4)'
    } else if (pp === 5) {
      baseScore = 18
      reasoning = 'Good sprint post (5)'
    } else if (pp === 3) {
      baseScore = 14
      reasoning = 'Decent sprint post (3)'
    } else if (pp === 2) {
      baseScore = 12
      reasoning = 'Inside sprint post (2)'
    } else if (pp === 1) {
      baseScore = 8
      reasoning = 'Rail can be tricky in sprints'
    } else if (pp >= 6 && pp <= 8) {
      baseScore = 10
      reasoning = 'Outside post in sprint'
    } else {
      baseScore = 5
      reasoning = 'Far outside post in sprint'
    }
  } else if (isRoute) {
    // Route distances (1M+)
    if (pp === 5) {
      baseScore = 20
      reasoning = 'Ideal route post (5)'
    } else if (pp >= 2 && pp <= 4) {
      baseScore = 15
      reasoning = 'Good inside route post'
    } else if (pp === 6 || pp === 7) {
      baseScore = 12
      reasoning = 'Mid-outside route post'
    } else if (pp === 1) {
      baseScore = 10
      reasoning = 'Rail - can save ground'
    } else {
      baseScore = 8
      reasoning = 'Wide post in route'
    }
  } else {
    // Mid-distance
    if (pp >= 3 && pp <= 5) {
      baseScore = 15
      reasoning = 'Good mid-distance post'
    } else {
      baseScore = 10
      reasoning = 'Average post position'
    }
  }

  // Adjust for turf (inside posts slightly better) - generic bonus
  if (raceHeader.surface === 'turf' && pp <= 3 && !hasTrackData) {
    baseScore = Math.min(baseScore + 3, 20)
    reasoning += ' (turf rail bonus)'
  }

  // Apply track-specific bias if available
  let finalScore = baseScore
  let trackBiasApplied = false

  if (hasTrackData) {
    const biasResult = getPostPositionBiasMultiplier(
      trackCode,
      raceHeader.distance,
      raceHeader.surface,
      pp
    )

    // Apply multiplier and cap at max score
    finalScore = Math.round(baseScore * biasResult.multiplier)
    finalScore = Math.max(5, Math.min(45, finalScore)) // Cap between 5-45

    reasoning = biasResult.reasoning
    trackBiasApplied = true
  }

  return {
    total: finalScore,
    reasoning: `${reasoning} - ${raceHeader.distance}`,
    trackBiasApplied
  }
}

/**
 * Parse odds string to decimal number
 * Handles formats like "3-1", "5/2", "3.5", "3.5-1"
 */
export function parseOdds(oddsStr: string): number {
  const cleaned = oddsStr.trim().toUpperCase()

  // Handle "EVEN" odds
  if (cleaned === 'EVEN' || cleaned === 'EVN') {
    return 1.0
  }

  // Handle "X-1" format (e.g., "5-1")
  if (cleaned.includes('-')) {
    const [num] = cleaned.split('-')
    return parseFloat(num) || 10
  }

  // Handle "X/Y" format (e.g., "5/2")
  if (cleaned.includes('/')) {
    const [num, denom] = cleaned.split('/')
    return parseFloat(num) / (parseFloat(denom) || 1)
  }

  // Handle plain number
  return parseFloat(cleaned) || 10
}

/**
 * C. Calculate Speed Figure Score (max 50 points)
 * Uses morning line odds as proxy for now
 * Favorites get 40-50 points, longshots get 0-20 points
 */
export function calculateSpeedFigureScore(
  _horse: HorseEntry,
  currentOdds: string
): ScoreBreakdown['speedFigure'] {
  const odds = parseOdds(currentOdds)

  let score: number
  let reasoning: string

  if (odds <= 1) {
    score = 50
    reasoning = 'Heavy favorite (even money or less)'
  } else if (odds <= 2) {
    score = 45
    reasoning = 'Strong favorite (2-1 or less)'
  } else if (odds <= 3) {
    score = 40
    reasoning = 'Favorite (3-1 or less)'
  } else if (odds <= 5) {
    score = 35
    reasoning = 'Low odds contender (5-1 or less)'
  } else if (odds <= 8) {
    score = 28
    reasoning = 'Mid-odds contender'
  } else if (odds <= 12) {
    score = 20
    reasoning = 'Higher odds runner'
  } else if (odds <= 20) {
    score = 12
    reasoning = 'Longshot'
  } else {
    score = 5
    reasoning = 'Extreme longshot'
  }

  return {
    total: score,
    reasoning: `${reasoning} (${currentOdds})`,
  }
}

/**
 * D. Calculate Form Score (max 30 points)
 * Placeholder: 15-25 points based on program number for now
 * Will be replaced with real form analysis later
 */
export function calculateFormScore(horse: HorseEntry): ScoreBreakdown['form'] {
  // Use program number to create pseudo-random but consistent scores
  const seed = horse.programNumber * 7 + horse.horseName.length
  const score = 15 + (seed % 11) // 15-25 range

  return {
    total: score,
    reasoning: 'Placeholder form score (to be replaced with real analysis)',
  }
}

/**
 * E. Calculate Equipment Score (max 25 points)
 * Placeholder: 10-15 points for now
 * Will be enhanced with real equipment change analysis
 */
export function calculateEquipmentScore(horse: HorseEntry): ScoreBreakdown['equipment'] {
  // Base equipment score
  const seed = horse.postPosition * 3 + horse.programNumber
  const score = 10 + (seed % 6) // 10-15 range

  return {
    total: score,
    reasoning: 'Placeholder equipment score (to be enhanced)',
  }
}

/**
 * F. Calculate Pace Score (max 40 points)
 * Placeholder: 20-30 points for now
 * Will be enhanced with real pace analysis
 */
export function calculatePaceScore(
  horse: HorseEntry,
  _trackCondition: TrackCondition
): ScoreBreakdown['pace'] {
  // Base pace score - will use track condition in future
  const seed = horse.programNumber * 5 + horse.postPosition * 2
  const score = 20 + (seed % 11) // 20-30 range

  return {
    total: score,
    reasoning: 'Placeholder pace score (to be enhanced with running style analysis)',
  }
}
