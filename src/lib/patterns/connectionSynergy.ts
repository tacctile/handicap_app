/**
 * Connection Synergy Module
 *
 * Detects and evaluates trainer-jockey partnerships from DRF data.
 * Successful partnerships get bonus points when working together.
 *
 * Partnership Bonuses:
 * - 25%+ win rate together, 20+ starts: +10 pts bonus
 * - 20-24% win rate together, 15+ starts: +6 pts bonus
 * - Strong recent form (2+ wins in last 10): +5 pts bonus
 *
 * Maximum synergy bonus: 10 pts
 */

import type { HorseEntry } from '../../types/drf'
import { logger } from '../../services/logging'
import { normalizeTrainerName } from './trainerPatterns'
import { normalizeJockeyName } from './jockeyPatterns'

// ============================================================================
// TYPES
// ============================================================================

export interface PartnershipStats {
  /** Trainer name */
  trainerName: string
  /** Jockey name */
  jockeyName: string
  /** Total wins together */
  wins: number
  /** Total starts together */
  starts: number
  /** Win rate percentage */
  winRate: number
  /** Place count */
  places: number
  /** Show count */
  shows: number
  /** In-the-money percentage */
  itmRate: number
  /** Wins in last 10 races together */
  recentWins: number
  /** Recent starts together (up to 10) */
  recentStarts: number
  /** Recent win rate */
  recentWinRate: number
  /** First start date together */
  firstStartDate: string | null
  /** Most recent start date together */
  lastStartDate: string | null
}

export interface SynergyResult {
  /** Partnership stats if found */
  partnership: PartnershipStats | null
  /** Synergy bonus points (0-10) */
  bonus: number
  /** Synergy level */
  level: 'elite' | 'strong' | 'developing' | 'new' | 'none'
  /** Human-readable description */
  description: string
  /** Evidence for display */
  evidence: string[]
  /** Is this a hot combo recently? */
  isHotCombo: boolean
  /** Recent form description */
  recentForm: string
}

export interface RacePartnershipDatabase {
  /** All partnerships found in race data */
  partnerships: Map<string, PartnershipStats>
  /** Quick lookup by trainer */
  byTrainer: Map<string, string[]>
  /** Quick lookup by jockey */
  byJockey: Map<string, string[]>
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum starts for elite partnership */
const ELITE_MIN_STARTS = 20

/** Minimum starts for strong partnership */
const STRONG_MIN_STARTS = 15

/** Minimum starts for developing partnership */
const DEVELOPING_MIN_STARTS = 10

/** Elite partnership win rate threshold */
const ELITE_WIN_RATE = 25

/** Strong partnership win rate threshold */
const STRONG_WIN_RATE = 20

/** Recent form threshold (wins in last 10) */
const HOT_COMBO_MIN_WINS = 2

/** Maximum recent races to consider */
const RECENT_RACE_LIMIT = 10

/** Partnership bonuses */
const PARTNERSHIP_BONUSES = {
  elite: 10,
  strong: 6,
  hotCombo: 5,
  developing: 3,
  new: 0,
} as const

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a unique partnership key
 */
function createPartnershipKey(trainerName: string, jockeyName: string): string {
  return `${normalizeTrainerName(trainerName)}|${normalizeJockeyName(jockeyName)}`
}

/**
 * Create empty partnership stats
 */
function createEmptyPartnership(trainerName: string, jockeyName: string): PartnershipStats {
  return {
    trainerName,
    jockeyName,
    wins: 0,
    starts: 0,
    winRate: 0,
    places: 0,
    shows: 0,
    itmRate: 0,
    recentWins: 0,
    recentStarts: 0,
    recentWinRate: 0,
    firstStartDate: null,
    lastStartDate: null,
  }
}

/**
 * Update partnership stats with a race result
 */
function updatePartnershipStats(
  stats: PartnershipStats,
  finishPosition: number,
  raceDate: string
): void {
  stats.starts++

  if (finishPosition === 1) {
    stats.wins++
  } else if (finishPosition === 2) {
    stats.places++
  } else if (finishPosition === 3) {
    stats.shows++
  }

  // Update dates
  if (!stats.firstStartDate || raceDate < stats.firstStartDate) {
    stats.firstStartDate = raceDate
  }
  if (!stats.lastStartDate || raceDate > stats.lastStartDate) {
    stats.lastStartDate = raceDate
  }

  // Recalculate rates
  stats.winRate = (stats.wins / stats.starts) * 100
  stats.itmRate = ((stats.wins + stats.places + stats.shows) / stats.starts) * 100
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Build a comprehensive partnership database from all horses in a race
 */
export function buildPartnershipDatabase(horses: HorseEntry[]): RacePartnershipDatabase {
  const partnerships = new Map<string, PartnershipStats>()
  const byTrainer = new Map<string, string[]>()
  const byJockey = new Map<string, string[]>()

  // Track recent races for each partnership for recency analysis
  const recentRaces = new Map<string, { date: string; won: boolean }[]>()

  try {
    for (const horse of horses) {
      const trainerNorm = normalizeTrainerName(horse.trainerName)

      // Process past performances to find trainer-jockey combinations
      for (const pp of horse.pastPerformances) {
        if (!pp.jockey) continue

        const jockeyNorm = normalizeJockeyName(pp.jockey)
        const key = createPartnershipKey(horse.trainerName, pp.jockey)

        // Get or create partnership stats
        if (!partnerships.has(key)) {
          partnerships.set(key, createEmptyPartnership(horse.trainerName, pp.jockey))

          // Update lookup maps
          if (!byTrainer.has(trainerNorm)) {
            byTrainer.set(trainerNorm, [])
          }
          byTrainer.get(trainerNorm)!.push(key)

          if (!byJockey.has(jockeyNorm)) {
            byJockey.set(jockeyNorm, [])
          }
          byJockey.get(jockeyNorm)!.push(key)
        }

        // Update partnership stats
        const stats = partnerships.get(key)!
        updatePartnershipStats(stats, pp.finishPosition, pp.date)

        // Track recent races
        if (!recentRaces.has(key)) {
          recentRaces.set(key, [])
        }
        const recent = recentRaces.get(key)!
        recent.push({
          date: pp.date,
          won: pp.finishPosition === 1,
        })
      }
    }

    // Calculate recent stats for each partnership
    for (const [key, races] of recentRaces) {
      const stats = partnerships.get(key)!

      // Sort by date descending and take last 10
      races.sort((a, b) => b.date.localeCompare(a.date))
      const recentRacesSlice = races.slice(0, RECENT_RACE_LIMIT)

      stats.recentStarts = recentRacesSlice.length
      stats.recentWins = recentRacesSlice.filter((r) => r.won).length
      stats.recentWinRate =
        stats.recentStarts > 0
          ? (stats.recentWins / stats.recentStarts) * 100
          : 0
    }
  } catch (error) {
    logger.logWarning('Error building partnership database', {
      component: 'ConnectionSynergy',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  return { partnerships, byTrainer, byJockey }
}

/**
 * Get partnership stats for a specific trainer-jockey combo
 */
export function getPartnershipStats(
  trainerName: string,
  jockeyName: string,
  database: RacePartnershipDatabase
): PartnershipStats | null {
  const key = createPartnershipKey(trainerName, jockeyName)
  return database.partnerships.get(key) || null
}

/**
 * Calculate synergy bonus for a trainer-jockey partnership
 */
export function calculateSynergyBonus(
  stats: PartnershipStats | null
): SynergyResult {
  if (!stats || stats.starts === 0) {
    return {
      partnership: null,
      bonus: 0,
      level: 'none',
      description: 'No partnership history',
      evidence: [],
      isHotCombo: false,
      recentForm: '',
    }
  }

  const evidence: string[] = []
  let bonus = 0
  let level: SynergyResult['level'] = 'new'
  let isHotCombo = false

  // Check for elite partnership
  if (stats.starts >= ELITE_MIN_STARTS && stats.winRate >= ELITE_WIN_RATE) {
    bonus = PARTNERSHIP_BONUSES.elite
    level = 'elite'
    evidence.push(
      `Elite combo: ${stats.winRate.toFixed(0)}% win together (${stats.wins}/${stats.starts})`
    )
  }
  // Check for strong partnership
  else if (stats.starts >= STRONG_MIN_STARTS && stats.winRate >= STRONG_WIN_RATE) {
    bonus = PARTNERSHIP_BONUSES.strong
    level = 'strong'
    evidence.push(
      `Strong combo: ${stats.winRate.toFixed(0)}% win together (${stats.wins}/${stats.starts})`
    )
  }
  // Check for developing partnership
  else if (stats.starts >= DEVELOPING_MIN_STARTS) {
    bonus = PARTNERSHIP_BONUSES.developing
    level = 'developing'
    evidence.push(
      `Developing combo: ${stats.winRate.toFixed(0)}% together (${stats.starts} starts)`
    )
  }
  // New partnership
  else {
    level = 'new'
    evidence.push(`New pairing: ${stats.starts} start${stats.starts === 1 ? '' : 's'} together`)
  }

  // Check for hot recent form (additional bonus)
  if (stats.recentWins >= HOT_COMBO_MIN_WINS) {
    isHotCombo = true
    // Add hot combo bonus only if not already at max
    if (level !== 'elite') {
      bonus = Math.min(bonus + PARTNERSHIP_BONUSES.hotCombo, PARTNERSHIP_BONUSES.elite)
    }
    evidence.push(
      `Hot combo: ${stats.recentWins} wins in last ${stats.recentStarts} starts together`
    )
  }

  // Build description
  const description =
    level === 'elite'
      ? `Elite partnership (${stats.winRate.toFixed(0)}% together)`
      : level === 'strong'
      ? `Strong partnership (${stats.winRate.toFixed(0)}% together)`
      : level === 'developing'
      ? `Developing partnership`
      : `Limited history together`

  // Build recent form string
  const recentForm =
    stats.recentStarts > 0
      ? `${stats.recentWins}/${stats.recentStarts} recently (${stats.recentWinRate.toFixed(0)}%)`
      : ''

  return {
    partnership: stats,
    bonus,
    level,
    description,
    evidence,
    isHotCombo,
    recentForm,
  }
}

/**
 * Get synergy result for a horse's connections
 */
export function getConnectionSynergy(
  horse: HorseEntry,
  horses: HorseEntry[]
): SynergyResult {
  try {
    const database = buildPartnershipDatabase(horses)
    const stats = getPartnershipStats(horse.trainerName, horse.jockeyName, database)
    return calculateSynergyBonus(stats)
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error('Unknown error'), {
      component: 'ConnectionSynergy',
      horseName: horse.horseName,
      trainerName: horse.trainerName,
      jockeyName: horse.jockeyName,
    })

    return {
      partnership: null,
      bonus: 0,
      level: 'none',
      description: 'Unable to analyze partnership',
      evidence: ['Partnership analysis failed'],
      isHotCombo: false,
      recentForm: '',
    }
  }
}

/**
 * Get all partnerships for a trainer
 */
export function getTrainerPartnerships(
  trainerName: string,
  database: RacePartnershipDatabase
): PartnershipStats[] {
  const trainerNorm = normalizeTrainerName(trainerName)
  const partnershipKeys = database.byTrainer.get(trainerNorm) || []

  return partnershipKeys
    .map((key) => database.partnerships.get(key)!)
    .filter(Boolean)
    .sort((a, b) => b.winRate - a.winRate)
}

/**
 * Get all partnerships for a jockey
 */
export function getJockeyPartnerships(
  jockeyName: string,
  database: RacePartnershipDatabase
): PartnershipStats[] {
  const jockeyNorm = normalizeJockeyName(jockeyName)
  const partnershipKeys = database.byJockey.get(jockeyNorm) || []

  return partnershipKeys
    .map((key) => database.partnerships.get(key)!)
    .filter(Boolean)
    .sort((a, b) => b.winRate - a.winRate)
}

/**
 * Get formatted display string for synergy
 */
export function getSynergyDisplay(result: SynergyResult): string {
  if (!result.partnership || result.level === 'none') {
    return 'No partnership data'
  }

  const { partnership } = result
  const winPct = partnership.winRate.toFixed(0)
  const starts = partnership.starts

  let display = `Together: ${winPct}% win (${starts} starts)`

  if (result.isHotCombo) {
    display += ` - HOT`
  }

  return display
}

/**
 * Check if a partnership qualifies for any bonus
 */
export function hasSignificantPartnership(result: SynergyResult): boolean {
  return result.bonus > 0 || result.level !== 'none'
}
