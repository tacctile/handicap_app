/**
 * Connections Scoring Module
 * Calculates trainer, jockey, and partnership scores based on DRF data
 *
 * Score Breakdown:
 * - Trainer Score: 0-35 points (based on win rate)
 * - Jockey Score: 0-15 points (based on win rate)
 * - Elite Partnership Bonus: +5 points (same combo with 25%+ win rate)
 *
 * Total: 0-55 points (with bonus)
 */

import type { HorseEntry } from '../../types/drf'

// ============================================================================
// TYPES
// ============================================================================

export interface ConnectionStats {
  name: string
  wins: number
  starts: number
  winRate: number
  places: number
  shows: number
  itmRate: number  // In the money rate
}

export interface PartnershipStats {
  trainer: string
  jockey: string
  wins: number
  starts: number
  winRate: number
}

export interface ConnectionsDatabase {
  trainers: Map<string, ConnectionStats>
  jockeys: Map<string, ConnectionStats>
  partnerships: Map<string, PartnershipStats>  // Key: "trainer|jockey"
}

export interface ConnectionsScoreResult {
  total: number
  trainer: number
  jockey: number
  partnershipBonus: number
  trainerStats: ConnectionStats | null
  jockeyStats: ConnectionStats | null
  partnershipStats: PartnershipStats | null
  reasoning: string
}

// ============================================================================
// DATABASE BUILDING
// ============================================================================

/**
 * Normalize name for consistent matching
 * Handles "SMITH, J." vs "J. SMITH" vs "JOHN SMITH"
 */
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Build a connections database from all horses' past performances
 * This creates a dynamic trainer/jockey database from the actual DRF data
 */
export function buildConnectionsDatabase(horses: HorseEntry[]): ConnectionsDatabase {
  const trainers = new Map<string, ConnectionStats>()
  const jockeys = new Map<string, ConnectionStats>()
  const partnerships = new Map<string, PartnershipStats>()

  // Process each horse's past performances
  for (const horse of horses) {
    // Add current race trainer/jockey to database (but don't count results yet)
    const currentTrainer = normalizeName(horse.trainerName)
    const currentJockey = normalizeName(horse.jockeyName)

    if (!trainers.has(currentTrainer)) {
      trainers.set(currentTrainer, {
        name: horse.trainerName,
        wins: 0,
        starts: 0,
        winRate: 0,
        places: 0,
        shows: 0,
        itmRate: 0,
      })
    }

    if (!jockeys.has(currentJockey)) {
      jockeys.set(currentJockey, {
        name: horse.jockeyName,
        wins: 0,
        starts: 0,
        winRate: 0,
        places: 0,
        shows: 0,
        itmRate: 0,
      })
    }

    // Process past performances for historical data
    for (const pp of horse.pastPerformances) {
      const ppJockey = normalizeName(pp.jockey)

      // Update jockey stats from past performances
      if (!jockeys.has(ppJockey)) {
        jockeys.set(ppJockey, {
          name: pp.jockey,
          wins: 0,
          starts: 0,
          winRate: 0,
          places: 0,
          shows: 0,
          itmRate: 0,
        })
      }

      const jockeyStats = jockeys.get(ppJockey)!
      jockeyStats.starts++
      if (pp.finishPosition === 1) jockeyStats.wins++
      if (pp.finishPosition === 2) jockeyStats.places++
      if (pp.finishPosition === 3) jockeyStats.shows++
      jockeyStats.winRate = (jockeyStats.wins / jockeyStats.starts) * 100
      jockeyStats.itmRate = ((jockeyStats.wins + jockeyStats.places + jockeyStats.shows) / jockeyStats.starts) * 100

      // Update trainer stats (use current trainer for this horse's PPs)
      const trainerStats = trainers.get(currentTrainer)!
      trainerStats.starts++
      if (pp.finishPosition === 1) trainerStats.wins++
      if (pp.finishPosition === 2) trainerStats.places++
      if (pp.finishPosition === 3) trainerStats.shows++
      trainerStats.winRate = (trainerStats.wins / trainerStats.starts) * 100
      trainerStats.itmRate = ((trainerStats.wins + trainerStats.places + trainerStats.shows) / trainerStats.starts) * 100

      // Track trainer/jockey partnerships
      const partnerKey = `${currentTrainer}|${ppJockey}`
      if (!partnerships.has(partnerKey)) {
        partnerships.set(partnerKey, {
          trainer: horse.trainerName,
          jockey: pp.jockey,
          wins: 0,
          starts: 0,
          winRate: 0,
        })
      }

      const partnerStats = partnerships.get(partnerKey)!
      partnerStats.starts++
      if (pp.finishPosition === 1) partnerStats.wins++
      partnerStats.winRate = (partnerStats.wins / partnerStats.starts) * 100
    }
  }

  return { trainers, jockeys, partnerships }
}

/**
 * Extract trainer stats from horse entry data
 * Uses lifetime stats from the DRF when available
 */
function extractTrainerStatsFromHorse(horse: HorseEntry): ConnectionStats | null {
  // Parse trainer stats string if available (format varies)
  // For now, build from past performances
  const wins = horse.pastPerformances.filter(pp => pp.finishPosition === 1).length
  const starts = horse.pastPerformances.length
  const places = horse.pastPerformances.filter(pp => pp.finishPosition === 2).length
  const shows = horse.pastPerformances.filter(pp => pp.finishPosition === 3).length

  if (starts === 0) return null

  return {
    name: horse.trainerName,
    wins,
    starts,
    winRate: (wins / starts) * 100,
    places,
    shows,
    itmRate: ((wins + places + shows) / starts) * 100,
  }
}

/**
 * Extract jockey stats from horse entry data
 */
function extractJockeyStatsFromHorse(horse: HorseEntry): ConnectionStats | null {
  // Get stats for jockeys from past performances where same jockey rode
  const jockeyNorm = normalizeName(horse.jockeyName)

  const jockeyPPs = horse.pastPerformances.filter(
    pp => normalizeName(pp.jockey) === jockeyNorm
  )

  if (jockeyPPs.length === 0) {
    // First time with this jockey - check all PPs for any jockey data
    const wins = horse.pastPerformances.filter(pp => pp.finishPosition === 1).length
    const starts = horse.pastPerformances.length
    const places = horse.pastPerformances.filter(pp => pp.finishPosition === 2).length
    const shows = horse.pastPerformances.filter(pp => pp.finishPosition === 3).length

    if (starts === 0) return null

    return {
      name: horse.jockeyName,
      wins,
      starts,
      winRate: (wins / starts) * 100,
      places,
      shows,
      itmRate: ((wins + places + shows) / starts) * 100,
    }
  }

  const wins = jockeyPPs.filter(pp => pp.finishPosition === 1).length
  const starts = jockeyPPs.length
  const places = jockeyPPs.filter(pp => pp.finishPosition === 2).length
  const shows = jockeyPPs.filter(pp => pp.finishPosition === 3).length

  return {
    name: horse.jockeyName,
    wins,
    starts,
    winRate: (wins / starts) * 100,
    places,
    shows,
    itmRate: ((wins + places + shows) / starts) * 100,
  }
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate trainer score (0-35 points)
 * Based on win rate thresholds
 */
function calculateTrainerScore(stats: ConnectionStats | null): number {
  if (!stats || stats.starts < 3) {
    // Insufficient data - return neutral score
    return 15
  }

  const winRate = stats.winRate

  if (winRate >= 20) return 35      // Elite trainer (20%+ win rate)
  if (winRate >= 15) return 28      // Very good trainer (15-19%)
  if (winRate >= 10) return 20      // Good trainer (10-14%)
  if (winRate >= 5) return 12       // Average trainer (5-9%)
  return 5                           // Below average (<5%)
}

/**
 * Calculate jockey score (0-15 points)
 * Same methodology as trainer but scaled
 */
function calculateJockeyScore(stats: ConnectionStats | null): number {
  if (!stats || stats.starts < 3) {
    // Insufficient data - return neutral score
    return 7
  }

  const winRate = stats.winRate

  if (winRate >= 20) return 15      // Elite jockey
  if (winRate >= 15) return 12      // Very good jockey
  if (winRate >= 10) return 9       // Good jockey
  if (winRate >= 5) return 6        // Average jockey
  return 3                           // Below average
}

/**
 * Detect elite partnerships and calculate bonus
 * Same trainer/jockey combo with 25%+ win rate = +5 bonus
 */
function calculatePartnershipBonus(
  trainerName: string,
  jockeyName: string,
  database: ConnectionsDatabase | null
): { bonus: number; stats: PartnershipStats | null } {
  if (!database) {
    return { bonus: 0, stats: null }
  }

  const trainerNorm = normalizeName(trainerName)
  const jockeyNorm = normalizeName(jockeyName)
  const partnerKey = `${trainerNorm}|${jockeyNorm}`

  const stats = database.partnerships.get(partnerKey)

  if (!stats || stats.starts < 5) {
    return { bonus: 0, stats: null }
  }

  // Elite partnership: 25%+ win rate with at least 5 starts
  if (stats.winRate >= 25) {
    return { bonus: 5, stats }
  }

  return { bonus: 0, stats }
}

/**
 * Build reasoning string for connections score
 */
function buildReasoning(
  trainerStats: ConnectionStats | null,
  jockeyStats: ConnectionStats | null,
  partnershipStats: PartnershipStats | null,
  partnershipBonus: number
): string {
  const parts: string[] = []

  if (trainerStats && trainerStats.starts >= 3) {
    parts.push(`T: ${trainerStats.winRate.toFixed(0)}% (${trainerStats.wins}/${trainerStats.starts})`)
  } else {
    parts.push('T: Limited data')
  }

  if (jockeyStats && jockeyStats.starts >= 3) {
    parts.push(`J: ${jockeyStats.winRate.toFixed(0)}% (${jockeyStats.wins}/${jockeyStats.starts})`)
  } else {
    parts.push('J: Limited data')
  }

  if (partnershipBonus > 0 && partnershipStats) {
    parts.push(`Elite combo: ${partnershipStats.winRate.toFixed(0)}% together`)
  }

  return parts.join(' | ')
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Calculate connections score for a horse
 *
 * @param horse - The horse entry to score
 * @param database - Optional pre-built connections database for efficiency
 * @returns Detailed score breakdown with stats
 */
export function calculateConnectionsScore(
  horse: HorseEntry,
  database: ConnectionsDatabase | null = null
): ConnectionsScoreResult {
  // Get trainer stats
  let trainerStats: ConnectionStats | null = null
  if (database) {
    trainerStats = database.trainers.get(normalizeName(horse.trainerName)) || null
  }
  if (!trainerStats) {
    trainerStats = extractTrainerStatsFromHorse(horse)
  }

  // Get jockey stats
  let jockeyStats: ConnectionStats | null = null
  if (database) {
    jockeyStats = database.jockeys.get(normalizeName(horse.jockeyName)) || null
  }
  if (!jockeyStats) {
    jockeyStats = extractJockeyStatsFromHorse(horse)
  }

  // Calculate individual scores
  const trainerScore = calculateTrainerScore(trainerStats)
  const jockeyScore = calculateJockeyScore(jockeyStats)

  // Check for elite partnership bonus
  const { bonus: partnershipBonus, stats: partnershipStats } = calculatePartnershipBonus(
    horse.trainerName,
    horse.jockeyName,
    database
  )

  // Build reasoning
  const reasoning = buildReasoning(trainerStats, jockeyStats, partnershipStats, partnershipBonus)

  return {
    total: trainerScore + jockeyScore + partnershipBonus,
    trainer: trainerScore,
    jockey: jockeyScore,
    partnershipBonus,
    trainerStats,
    jockeyStats,
    partnershipStats,
    reasoning,
  }
}

/**
 * Calculate connections scores for all horses in a race
 * Builds a shared database for efficiency
 */
export function calculateRaceConnectionsScores(
  horses: HorseEntry[]
): Map<number, ConnectionsScoreResult> {
  // Build database from all horses' past performances
  const database = buildConnectionsDatabase(horses)

  // Calculate score for each horse
  const results = new Map<number, ConnectionsScoreResult>()

  for (let i = 0; i < horses.length; i++) {
    results.set(i, calculateConnectionsScore(horses[i], database))
  }

  return results
}
