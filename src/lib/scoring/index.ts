import type { HorseEntry, RaceHeader } from '../../types/drf'
import type { TrackCondition } from '../../hooks/useRaceState'
import {
  calculateConnectionsScore,
  calculatePostPositionScore,
  calculateSpeedFigureScore,
  calculateFormScore,
  calculateEquipmentScore,
  calculatePaceScore,
  type ScoreBreakdown,
} from './baseScoring'

// Score limits by category
export const SCORE_LIMITS = {
  connections: 50,
  postPosition: 45,
  speedFigure: 50,
  form: 30,
  equipment: 25,
  pace: 40,
  total: 240,
} as const

// Score thresholds for color coding
export const SCORE_THRESHOLDS = {
  high: 180,    // 180+ = high score (teal)
  medium: 140,  // 140-179 = medium score (darker teal)
  low: 0,       // <140 = low score (gray)
} as const

// Score colors
export const SCORE_COLORS = {
  high: '#36d1da',
  medium: '#19abb5',
  low: '#888888',
} as const

export interface HorseScore {
  total: number
  breakdown: ScoreBreakdown
  isScratched: boolean
}

/**
 * Calculate the total score for a horse
 * Returns a score from 0-240 with a full breakdown
 */
export function calculateHorseScore(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  currentOdds: string,
  trackCondition: TrackCondition,
  isScratched: boolean
): HorseScore {
  // Scratched horses get 0 score
  if (isScratched) {
    return {
      total: 0,
      breakdown: {
        connections: { total: 0, trainer: 0, jockey: 0 },
        postPosition: { total: 0, reasoning: 'Scratched' },
        speedFigure: { total: 0, reasoning: 'Scratched' },
        form: { total: 0, reasoning: 'Scratched' },
        equipment: { total: 0, reasoning: 'Scratched' },
        pace: { total: 0, reasoning: 'Scratched' },
      },
      isScratched: true,
    }
  }

  // Calculate each category
  const connections = calculateConnectionsScore(horse)
  const postPosition = calculatePostPositionScore(horse, raceHeader)
  const speedFigure = calculateSpeedFigureScore(horse, currentOdds)
  const form = calculateFormScore(horse)
  const equipment = calculateEquipmentScore(horse)
  const pace = calculatePaceScore(horse, trackCondition)

  // Sum up total score
  const total =
    connections.total +
    postPosition.total +
    speedFigure.total +
    form.total +
    equipment.total +
    pace.total

  return {
    total,
    breakdown: {
      connections,
      postPosition,
      speedFigure,
      form,
      equipment,
      pace,
    },
    isScratched: false,
  }
}

/**
 * Get the color for a score based on thresholds
 */
export function getScoreColor(score: number, isScratched: boolean): string {
  if (isScratched) return SCORE_COLORS.low
  if (score >= SCORE_THRESHOLDS.high) return SCORE_COLORS.high
  if (score >= SCORE_THRESHOLDS.medium) return SCORE_COLORS.medium
  return SCORE_COLORS.low
}

/**
 * Calculate scores for all horses in a race and return sorted by score descending
 */
export function calculateRaceScores(
  horses: HorseEntry[],
  raceHeader: RaceHeader,
  getOdds: (index: number, originalOdds: string) => string,
  isScratched: (index: number) => boolean,
  trackCondition: TrackCondition
): Array<{ horse: HorseEntry; index: number; score: HorseScore }> {
  const scores = horses.map((horse, index) => ({
    horse,
    index,
    score: calculateHorseScore(
      horse,
      raceHeader,
      getOdds(index, horse.morningLineOdds),
      trackCondition,
      isScratched(index)
    ),
  }))

  // Sort by score descending (scratched horses go to bottom)
  return scores.sort((a, b) => {
    // Scratched horses always at bottom
    if (a.score.isScratched && !b.score.isScratched) return 1
    if (!a.score.isScratched && b.score.isScratched) return -1
    // Otherwise sort by score descending
    return b.score.total - a.score.total
  })
}

// Re-export types and utilities from baseScoring
export type { ScoreBreakdown } from './baseScoring'
export { parseOdds } from './baseScoring'
