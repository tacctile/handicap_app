/**
 * Dynamic Trainer Pattern Matching Module
 *
 * Extracts trainer statistics from DRF past performances and calculates
 * dynamic success rates based on actual race data.
 *
 * Success Rate Calculations:
 * - Track-specific: "Trainer X at Churchill Downs: 18% win (45 starts)"
 * - Distance-specific: "Trainer X at 6F: 22% win (67 starts)"
 * - Surface-specific: "Trainer X on turf: 15% win (123 starts)"
 * - Class-specific: "Trainer X in $25K claimers: 28% win (89 starts)"
 * - Combo patterns: "Trainer X in turf routes at Saratoga: 31% win (26 starts)"
 *
 * Scoring (0-35 pts from Elite Connections category):
 * - 25%+ win rate: +35 pts (elite)
 * - 20-24% win rate: +28 pts (strong)
 * - 15-19% win rate: +20 pts (above average)
 * - 10-14% win rate: +12 pts (average)
 * - <10% win rate: +5 pts (below average)
 *
 * Requires minimum 15 starts for credibility
 */

import type { HorseEntry, RaceHeader, Surface, RaceClassification } from '../../types/drf'
import { logger } from '../../services/logging'

// ============================================================================
// TYPES
// ============================================================================

export interface TrainerPatternStats {
  /** Trainer name */
  trainerName: string
  /** Total wins in this pattern */
  wins: number
  /** Total starts in this pattern */
  starts: number
  /** Win rate percentage */
  winRate: number
  /** Place (2nd) count */
  places: number
  /** Show (3rd) count */
  shows: number
  /** In-the-money percentage */
  itmRate: number
  /** Average Beyer for wins (if available) */
  avgWinningBeyer: number | null
  /** Pattern description */
  description: string
  /** Context (track, distance, surface, class) */
  context: PatternContext
}

export interface PatternContext {
  /** Track code (e.g., "CD" for Churchill Downs) */
  trackCode?: string
  /** Distance in furlongs */
  distanceFurlongs?: number
  /** Distance category ("sprint" or "route") */
  distanceCategory?: 'sprint' | 'route'
  /** Surface type */
  surface?: Surface
  /** Race classification */
  classification?: RaceClassification
  /** Claiming price range */
  claimingRange?: { min: number; max: number }
}

export interface TrainerProfile {
  /** Trainer name (normalized) */
  trainerName: string
  /** Overall stats across all patterns */
  overall: TrainerPatternStats
  /** Track-specific patterns */
  byTrack: Map<string, TrainerPatternStats>
  /** Distance-specific patterns (sprint/route) */
  byDistanceCategory: Map<string, TrainerPatternStats>
  /** Surface-specific patterns */
  bySurface: Map<Surface, TrainerPatternStats>
  /** Class-specific patterns */
  byClass: Map<RaceClassification, TrainerPatternStats>
  /** Combined patterns (e.g., turf routes at specific track) */
  combinedPatterns: TrainerPatternStats[]
  /** Best pattern (highest win rate with credible sample) */
  bestPattern: TrainerPatternStats | null
  /** Score (0-35 pts) */
  score: number
  /** Scoring tier */
  tier: 'elite' | 'strong' | 'above_average' | 'average' | 'below_average'
  /** Evidence strings for display */
  evidence: string[]
}

export interface TrainerPatternResult {
  /** The trainer profile with all patterns */
  profile: TrainerProfile
  /** The most relevant pattern for current race conditions */
  relevantPattern: TrainerPatternStats | null
  /** Score based on relevant pattern */
  score: number
  /** Reasoning for the score */
  reasoning: string
  /** Evidence for display */
  evidence: string[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum starts required for pattern credibility */
export const MIN_STARTS_FOR_CREDIBILITY = 15

/** Sprint/route distance threshold (in furlongs) */
const ROUTE_DISTANCE_THRESHOLD = 8 // 1 mile

/** Scoring thresholds */
const SCORE_THRESHOLDS = {
  elite: { minWinRate: 25, score: 35 },
  strong: { minWinRate: 20, score: 28 },
  aboveAverage: { minWinRate: 15, score: 20 },
  average: { minWinRate: 10, score: 12 },
  belowAverage: { minWinRate: 0, score: 5 },
} as const

/** Default score when insufficient data */
const DEFAULT_SCORE = 10

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize trainer name for consistent matching
 */
export function normalizeTrainerName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Determine if a distance is sprint or route
 */
function getDistanceCategory(distanceFurlongs: number): 'sprint' | 'route' {
  return distanceFurlongs < ROUTE_DISTANCE_THRESHOLD ? 'sprint' : 'route'
}

/**
 * Get claiming price range bucket
 */
function getClaimingRangeBucket(price: number | null): string {
  if (price === null) return 'non-claiming'
  if (price < 10000) return '<10K'
  if (price < 20000) return '10-20K'
  if (price < 40000) return '20-40K'
  if (price < 75000) return '40-75K'
  return '75K+'
}

/**
 * Calculate score based on win rate
 */
function calculateScore(winRate: number, starts: number): { score: number; tier: TrainerProfile['tier'] } {
  // Check for credibility
  if (starts < MIN_STARTS_FOR_CREDIBILITY) {
    return { score: DEFAULT_SCORE, tier: 'average' }
  }

  if (winRate >= SCORE_THRESHOLDS.elite.minWinRate) {
    return { score: SCORE_THRESHOLDS.elite.score, tier: 'elite' }
  }
  if (winRate >= SCORE_THRESHOLDS.strong.minWinRate) {
    return { score: SCORE_THRESHOLDS.strong.score, tier: 'strong' }
  }
  if (winRate >= SCORE_THRESHOLDS.aboveAverage.minWinRate) {
    return { score: SCORE_THRESHOLDS.aboveAverage.score, tier: 'above_average' }
  }
  if (winRate >= SCORE_THRESHOLDS.average.minWinRate) {
    return { score: SCORE_THRESHOLDS.average.score, tier: 'average' }
  }
  return { score: SCORE_THRESHOLDS.belowAverage.score, tier: 'below_average' }
}

/**
 * Create a pattern stats object
 */
function createPatternStats(
  trainerName: string,
  context: PatternContext,
  description: string
): TrainerPatternStats {
  return {
    trainerName,
    wins: 0,
    starts: 0,
    winRate: 0,
    places: 0,
    shows: 0,
    itmRate: 0,
    avgWinningBeyer: null,
    description,
    context,
  }
}

/**
 * Update pattern stats with a race result
 */
function updatePatternStats(
  stats: TrainerPatternStats,
  finishPosition: number,
  beyer: number | null
): void {
  stats.starts++

  if (finishPosition === 1) {
    stats.wins++
    if (beyer !== null) {
      if (stats.avgWinningBeyer === null) {
        stats.avgWinningBeyer = beyer
      } else {
        // Running average
        stats.avgWinningBeyer =
          (stats.avgWinningBeyer * (stats.wins - 1) + beyer) / stats.wins
      }
    }
  } else if (finishPosition === 2) {
    stats.places++
  } else if (finishPosition === 3) {
    stats.shows++
  }

  // Recalculate rates
  stats.winRate = (stats.wins / stats.starts) * 100
  stats.itmRate = ((stats.wins + stats.places + stats.shows) / stats.starts) * 100
}

/**
 * Format stats for display
 */
function formatPatternEvidence(stats: TrainerPatternStats): string {
  if (stats.starts < MIN_STARTS_FOR_CREDIBILITY) {
    return `${stats.description}: ${stats.winRate.toFixed(0)}% (${stats.starts} starts - limited data)`
  }
  return `${stats.description}: ${stats.winRate.toFixed(0)}% win (${stats.starts} starts)`
}

// ============================================================================
// MAIN EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extract trainer patterns from a single horse's past performances
 * Associates the horse's trainer with all their PP results
 */
export function extractTrainerPatternsFromHorse(horse: HorseEntry): Map<string, TrainerPatternStats> {
  const trainerName = normalizeTrainerName(horse.trainerName)
  const patterns = new Map<string, TrainerPatternStats>()

  // Track overall stats
  const overallKey = 'overall'
  patterns.set(
    overallKey,
    createPatternStats(trainerName, {}, `${horse.trainerName} overall`)
  )

  try {
    for (const pp of horse.pastPerformances) {
      const beyer = pp.speedFigures?.beyer ?? null

      // Update overall
      const overall = patterns.get(overallKey)!
      updatePatternStats(overall, pp.finishPosition, beyer)

      // Track-specific pattern
      const trackKey = `track:${pp.track}`
      if (!patterns.has(trackKey)) {
        patterns.set(
          trackKey,
          createPatternStats(trainerName, { trackCode: pp.track }, `At ${pp.trackName || pp.track}`)
        )
      }
      updatePatternStats(patterns.get(trackKey)!, pp.finishPosition, beyer)

      // Distance category pattern
      const distCat = getDistanceCategory(pp.distanceFurlongs)
      const distKey = `dist:${distCat}`
      if (!patterns.has(distKey)) {
        patterns.set(
          distKey,
          createPatternStats(
            trainerName,
            { distanceCategory: distCat },
            `In ${distCat === 'sprint' ? 'sprints' : 'routes'}`
          )
        )
      }
      updatePatternStats(patterns.get(distKey)!, pp.finishPosition, beyer)

      // Surface pattern
      const surfaceKey = `surface:${pp.surface}`
      if (!patterns.has(surfaceKey)) {
        patterns.set(
          surfaceKey,
          createPatternStats(
            trainerName,
            { surface: pp.surface },
            `On ${pp.surface}`
          )
        )
      }
      updatePatternStats(patterns.get(surfaceKey)!, pp.finishPosition, beyer)

      // Class pattern
      const classKey = `class:${pp.classification}`
      if (!patterns.has(classKey)) {
        patterns.set(
          classKey,
          createPatternStats(
            trainerName,
            { classification: pp.classification },
            `In ${pp.classification}`
          )
        )
      }
      updatePatternStats(patterns.get(classKey)!, pp.finishPosition, beyer)

      // Claiming price range pattern (if claiming)
      if (pp.claimingPrice) {
        const claimRange = getClaimingRangeBucket(pp.claimingPrice)
        const claimKey = `claim:${claimRange}`
        if (!patterns.has(claimKey)) {
          patterns.set(
            claimKey,
            createPatternStats(
              trainerName,
              { claimingRange: { min: pp.claimingPrice, max: pp.claimingPrice } },
              `In ${claimRange} claimers`
            )
          )
        }
        updatePatternStats(patterns.get(claimKey)!, pp.finishPosition, beyer)
      }

      // Combined pattern: surface + distance at track
      const comboKey = `combo:${pp.track}:${pp.surface}:${distCat}`
      if (!patterns.has(comboKey)) {
        patterns.set(
          comboKey,
          createPatternStats(
            trainerName,
            {
              trackCode: pp.track,
              surface: pp.surface,
              distanceCategory: distCat,
            },
            `${pp.surface} ${distCat}s at ${pp.trackName || pp.track}`
          )
        )
      }
      updatePatternStats(patterns.get(comboKey)!, pp.finishPosition, beyer)
    }
  } catch (error) {
    logger.logWarning('Error extracting trainer patterns from horse', {
      component: 'TrainerPatterns',
      horseName: horse.horseName,
      trainerName: horse.trainerName,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  return patterns
}

/**
 * Build a comprehensive trainer profile from all horses in a race
 * Aggregates patterns across all horses trained by this trainer
 */
export function buildTrainerProfile(
  trainerName: string,
  horses: HorseEntry[]
): TrainerProfile {
  const normalizedName = normalizeTrainerName(trainerName)

  // Initialize profile
  const profile: TrainerProfile = {
    trainerName: normalizedName,
    overall: createPatternStats(normalizedName, {}, `${trainerName} overall`),
    byTrack: new Map(),
    byDistanceCategory: new Map(),
    bySurface: new Map(),
    byClass: new Map(),
    combinedPatterns: [],
    bestPattern: null,
    score: DEFAULT_SCORE,
    tier: 'average',
    evidence: [],
  }

  // Aggregate patterns from all horses with this trainer
  const aggregatedPatterns = new Map<string, TrainerPatternStats>()

  for (const horse of horses) {
    if (normalizeTrainerName(horse.trainerName) !== normalizedName) {
      continue
    }

    const horsePatterns = extractTrainerPatternsFromHorse(horse)

    for (const [key, stats] of horsePatterns) {
      if (!aggregatedPatterns.has(key)) {
        aggregatedPatterns.set(key, { ...stats })
      } else {
        const existing = aggregatedPatterns.get(key)!
        // Merge stats
        existing.wins += stats.wins
        existing.starts += stats.starts
        existing.places += stats.places
        existing.shows += stats.shows
        if (stats.avgWinningBeyer !== null) {
          if (existing.avgWinningBeyer === null) {
            existing.avgWinningBeyer = stats.avgWinningBeyer
          } else {
            // Weighted average
            existing.avgWinningBeyer =
              (existing.avgWinningBeyer * (existing.wins - stats.wins) +
                stats.avgWinningBeyer * stats.wins) /
              existing.wins
          }
        }
        // Recalculate rates
        existing.winRate = (existing.wins / existing.starts) * 100
        existing.itmRate =
          ((existing.wins + existing.places + existing.shows) / existing.starts) * 100
      }
    }
  }

  // Populate profile from aggregated patterns
  for (const [key, stats] of aggregatedPatterns) {
    if (key === 'overall') {
      profile.overall = stats
    } else if (key.startsWith('track:')) {
      const trackCode = key.replace('track:', '')
      profile.byTrack.set(trackCode, stats)
    } else if (key.startsWith('dist:')) {
      const distCat = key.replace('dist:', '')
      profile.byDistanceCategory.set(distCat, stats)
    } else if (key.startsWith('surface:')) {
      const surface = key.replace('surface:', '') as Surface
      profile.bySurface.set(surface, stats)
    } else if (key.startsWith('class:')) {
      const classification = key.replace('class:', '') as RaceClassification
      profile.byClass.set(classification, stats)
    } else if (key.startsWith('combo:')) {
      profile.combinedPatterns.push(stats)
    }
  }

  // Find best pattern (highest win rate with credible sample)
  const crediblePatterns = Array.from(aggregatedPatterns.values()).filter(
    (p) => p.starts >= MIN_STARTS_FOR_CREDIBILITY
  )

  if (crediblePatterns.length > 0) {
    profile.bestPattern = crediblePatterns.reduce((best, current) =>
      current.winRate > best.winRate ? current : best
    )
  }

  // Calculate score based on overall or best pattern
  const patternToScore = profile.bestPattern || profile.overall
  const { score, tier } = calculateScore(patternToScore.winRate, patternToScore.starts)
  profile.score = score
  profile.tier = tier

  // Build evidence strings
  if (profile.overall.starts >= MIN_STARTS_FOR_CREDIBILITY) {
    profile.evidence.push(formatPatternEvidence(profile.overall))
  }
  if (profile.bestPattern && profile.bestPattern !== profile.overall) {
    profile.evidence.push(formatPatternEvidence(profile.bestPattern))
  }

  // Add top track patterns
  const topTrackPatterns = Array.from(profile.byTrack.values())
    .filter((p) => p.starts >= MIN_STARTS_FOR_CREDIBILITY)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 2)

  for (const pattern of topTrackPatterns) {
    if (!profile.evidence.includes(formatPatternEvidence(pattern))) {
      profile.evidence.push(formatPatternEvidence(pattern))
    }
  }

  return profile
}

/**
 * Calculate trainer pattern score for a specific horse in a specific race
 * Finds the most relevant pattern based on current race conditions
 */
export function calculateTrainerPatternScore(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  allHorses: HorseEntry[]
): TrainerPatternResult {
  try {
    const profile = buildTrainerProfile(horse.trainerName, allHorses)

    // Find most relevant pattern for current race conditions
    const currentDistCat = getDistanceCategory(raceHeader.distanceFurlongs)
    const currentSurface = raceHeader.surface
    const currentTrack = raceHeader.trackCode
    const currentClass = raceHeader.classification

    // Priority order for pattern matching:
    // 1. Combined pattern (track + surface + distance)
    // 2. Track-specific pattern
    // 3. Surface + distance pattern
    // 4. Class-specific pattern
    // 5. Overall pattern

    let relevantPattern: TrainerPatternStats | null = null
    let patternScore = profile.score
    const evidence: string[] = []

    // 1. Try combined pattern (track + surface + distance)
    const comboPattern = profile.combinedPatterns.find(
      (p) =>
        p.context.trackCode === currentTrack &&
        p.context.surface === currentSurface &&
        p.context.distanceCategory === currentDistCat &&
        p.starts >= MIN_STARTS_FOR_CREDIBILITY
    )

    if (comboPattern) {
      relevantPattern = comboPattern
      const { score } = calculateScore(comboPattern.winRate, comboPattern.starts)
      patternScore = score
      evidence.push(formatPatternEvidence(comboPattern))
    }

    // 2. Try track-specific pattern
    if (!relevantPattern) {
      const trackPattern = profile.byTrack.get(currentTrack)
      if (trackPattern && trackPattern.starts >= MIN_STARTS_FOR_CREDIBILITY) {
        relevantPattern = trackPattern
        const { score } = calculateScore(trackPattern.winRate, trackPattern.starts)
        patternScore = score
        evidence.push(formatPatternEvidence(trackPattern))
      }
    }

    // 3. Try surface pattern
    if (!relevantPattern) {
      const surfacePattern = profile.bySurface.get(currentSurface)
      if (surfacePattern && surfacePattern.starts >= MIN_STARTS_FOR_CREDIBILITY) {
        relevantPattern = surfacePattern
        const { score } = calculateScore(surfacePattern.winRate, surfacePattern.starts)
        patternScore = score
        evidence.push(formatPatternEvidence(surfacePattern))
      }
    }

    // 4. Try class pattern
    if (!relevantPattern && currentClass) {
      const classPattern = profile.byClass.get(currentClass)
      if (classPattern && classPattern.starts >= MIN_STARTS_FOR_CREDIBILITY) {
        relevantPattern = classPattern
        const { score } = calculateScore(classPattern.winRate, classPattern.starts)
        patternScore = score
        evidence.push(formatPatternEvidence(classPattern))
      }
    }

    // 5. Fall back to overall
    if (!relevantPattern && profile.overall.starts >= MIN_STARTS_FOR_CREDIBILITY) {
      relevantPattern = profile.overall
      const { score } = calculateScore(profile.overall.winRate, profile.overall.starts)
      patternScore = score
      evidence.push(formatPatternEvidence(profile.overall))
    }

    // If still no pattern, use default
    if (!relevantPattern) {
      return {
        profile,
        relevantPattern: null,
        score: DEFAULT_SCORE,
        reasoning: `${horse.trainerName}: Limited data (${profile.overall.starts} starts)`,
        evidence: ['Insufficient data for pattern analysis'],
      }
    }

    // Build reasoning
    const reasoning =
      relevantPattern.starts >= MIN_STARTS_FOR_CREDIBILITY
        ? `${horse.trainerName}: ${relevantPattern.winRate.toFixed(0)}% win rate ${relevantPattern.description.toLowerCase()} (${relevantPattern.starts} starts)`
        : `${horse.trainerName}: Limited data`

    return {
      profile,
      relevantPattern,
      score: patternScore,
      reasoning,
      evidence,
    }
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error('Unknown error'), {
      component: 'TrainerPatterns',
      horseName: horse.horseName,
      trainerName: horse.trainerName,
    })

    // Return default on error
    return {
      profile: {
        trainerName: normalizeTrainerName(horse.trainerName),
        overall: createPatternStats(horse.trainerName, {}, `${horse.trainerName} overall`),
        byTrack: new Map(),
        byDistanceCategory: new Map(),
        bySurface: new Map(),
        byClass: new Map(),
        combinedPatterns: [],
        bestPattern: null,
        score: DEFAULT_SCORE,
        tier: 'average',
        evidence: [],
      },
      relevantPattern: null,
      score: DEFAULT_SCORE,
      reasoning: `${horse.trainerName}: Unable to analyze patterns`,
      evidence: ['Pattern analysis failed'],
    }
  }
}

/**
 * Get a formatted display string for trainer patterns
 */
export function getTrainerPatternDisplay(result: TrainerPatternResult): string {
  if (!result.relevantPattern) {
    return 'Limited trainer data'
  }

  const { relevantPattern } = result
  const winPct = relevantPattern.winRate.toFixed(0)
  const starts = relevantPattern.starts

  return `${winPct}% win (${starts} starts) ${relevantPattern.description.toLowerCase()}`
}
