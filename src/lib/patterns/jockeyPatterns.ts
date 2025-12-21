/**
 * Dynamic Jockey Pattern Matching Module
 *
 * Extracts jockey statistics from DRF past performances and calculates
 * dynamic success rates based on actual race data.
 *
 * Success Rate Calculations:
 * - Track-specific: "Jockey Y at Gulfstream: 16% win (234 starts)"
 * - Style-specific: "Jockey Y on closers: 19% win (89 starts)"
 * - Surface-specific: "Jockey Y on turf: 14% win (156 starts)"
 *
 * Scoring (0-15 pts from Elite Connections category):
 * - 20%+ win rate: +15 pts (elite)
 * - 15-19% win rate: +12 pts (strong)
 * - 10-14% win rate: +8 pts (average)
 * - <10% win rate: +3 pts (below average)
 *
 * Requires minimum 20 starts for credibility
 */

import type { HorseEntry, PastPerformance, RaceHeader, Surface } from '../../types/drf';
import { logger } from '../../services/logging';

// ============================================================================
// TYPES
// ============================================================================

export type RunningStyle = 'E' | 'E/P' | 'P' | 'C' | 'S' | 'unknown';

export interface JockeyPatternStats {
  /** Jockey name */
  jockeyName: string;
  /** Total wins in this pattern */
  wins: number;
  /** Total starts in this pattern */
  starts: number;
  /** Win rate percentage */
  winRate: number;
  /** Place (2nd) count */
  places: number;
  /** Show (3rd) count */
  shows: number;
  /** In-the-money percentage */
  itmRate: number;
  /** Average Beyer for wins (if available) */
  avgWinningBeyer: number | null;
  /** Pattern description */
  description: string;
  /** Context (track, style, surface) */
  context: JockeyPatternContext;
}

export interface JockeyPatternContext {
  /** Track code */
  trackCode?: string;
  /** Running style (E, P, C, etc.) */
  runningStyle?: RunningStyle;
  /** Surface type */
  surface?: Surface;
  /** Distance category */
  distanceCategory?: 'sprint' | 'route';
}

export interface JockeyProfile {
  /** Jockey name (normalized) */
  jockeyName: string;
  /** Overall stats across all patterns */
  overall: JockeyPatternStats;
  /** Track-specific patterns */
  byTrack: Map<string, JockeyPatternStats>;
  /** Running style patterns */
  byRunningStyle: Map<RunningStyle, JockeyPatternStats>;
  /** Surface-specific patterns */
  bySurface: Map<Surface, JockeyPatternStats>;
  /** Distance category patterns */
  byDistanceCategory: Map<string, JockeyPatternStats>;
  /** Best pattern (highest win rate with credible sample) */
  bestPattern: JockeyPatternStats | null;
  /** Score (0-15 pts) */
  score: number;
  /** Scoring tier */
  tier: 'elite' | 'strong' | 'average' | 'below_average';
  /** Evidence strings for display */
  evidence: string[];
}

export interface JockeyPatternResult {
  /** The jockey profile with all patterns */
  profile: JockeyProfile;
  /** The most relevant pattern for current race conditions */
  relevantPattern: JockeyPatternStats | null;
  /** Score based on relevant pattern */
  score: number;
  /** Reasoning for the score */
  reasoning: string;
  /** Evidence for display */
  evidence: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum starts required for jockey pattern credibility */
export const MIN_JOCKEY_STARTS_FOR_CREDIBILITY = 20;

/** Sprint/route distance threshold (in furlongs) */
const ROUTE_DISTANCE_THRESHOLD = 8; // 1 mile

/** Jockey scoring thresholds */
const JOCKEY_SCORE_THRESHOLDS = {
  elite: { minWinRate: 20, score: 15 },
  strong: { minWinRate: 15, score: 12 },
  average: { minWinRate: 10, score: 8 },
  belowAverage: { minWinRate: 0, score: 3 },
} as const;

/** Default score when insufficient data */
const DEFAULT_JOCKEY_SCORE = 7;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize jockey name for consistent matching
 */
export function normalizeJockeyName(name: string): string {
  return name.toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Determine running style from past performance running line
 */
export function determineRunningStyle(pp: PastPerformance): RunningStyle {
  const runningLine = pp.runningLine;
  if (!runningLine) return 'unknown';

  const firstCall = runningLine.quarterMile || runningLine.start;
  const stretchCall = runningLine.stretch;
  const finishPos = runningLine.finish || pp.finishPosition;

  if (!firstCall || !finishPos) return 'unknown';

  // E (Early): Led or within 2 lengths at first call
  if (firstCall <= 2) {
    return 'E';
  }

  // E/P (Early/Presser): Within 4 lengths at first call
  if (firstCall <= 4) {
    return 'E/P';
  }

  // P (Presser): 5-8 lengths behind at first call, rallies
  if (firstCall <= 8 && stretchCall && stretchCall < firstCall) {
    return 'P';
  }

  // C (Closer): 9+ lengths behind at first call, closes strongly
  if (firstCall > 8 && finishPos <= 4) {
    return 'C';
  }

  // S (Sustained/Slow start): Runs on evenly
  if (firstCall > 6) {
    return 'S';
  }

  return 'P'; // Default to presser
}

/**
 * Get distance category
 */
function getDistanceCategory(distanceFurlongs: number): 'sprint' | 'route' {
  return distanceFurlongs < ROUTE_DISTANCE_THRESHOLD ? 'sprint' : 'route';
}

/**
 * Calculate jockey score based on win rate
 */
function calculateJockeyScore(
  winRate: number,
  starts: number
): { score: number; tier: JockeyProfile['tier'] } {
  if (starts < MIN_JOCKEY_STARTS_FOR_CREDIBILITY) {
    return { score: DEFAULT_JOCKEY_SCORE, tier: 'average' };
  }

  if (winRate >= JOCKEY_SCORE_THRESHOLDS.elite.minWinRate) {
    return { score: JOCKEY_SCORE_THRESHOLDS.elite.score, tier: 'elite' };
  }
  if (winRate >= JOCKEY_SCORE_THRESHOLDS.strong.minWinRate) {
    return { score: JOCKEY_SCORE_THRESHOLDS.strong.score, tier: 'strong' };
  }
  if (winRate >= JOCKEY_SCORE_THRESHOLDS.average.minWinRate) {
    return { score: JOCKEY_SCORE_THRESHOLDS.average.score, tier: 'average' };
  }
  return { score: JOCKEY_SCORE_THRESHOLDS.belowAverage.score, tier: 'below_average' };
}

/**
 * Create a jockey pattern stats object
 */
function createJockeyPatternStats(
  jockeyName: string,
  context: JockeyPatternContext,
  description: string
): JockeyPatternStats {
  return {
    jockeyName,
    wins: 0,
    starts: 0,
    winRate: 0,
    places: 0,
    shows: 0,
    itmRate: 0,
    avgWinningBeyer: null,
    description,
    context,
  };
}

/**
 * Update jockey pattern stats with a race result
 */
function updateJockeyPatternStats(
  stats: JockeyPatternStats,
  finishPosition: number,
  beyer: number | null
): void {
  stats.starts++;

  if (finishPosition === 1) {
    stats.wins++;
    if (beyer !== null) {
      if (stats.avgWinningBeyer === null) {
        stats.avgWinningBeyer = beyer;
      } else {
        stats.avgWinningBeyer = (stats.avgWinningBeyer * (stats.wins - 1) + beyer) / stats.wins;
      }
    }
  } else if (finishPosition === 2) {
    stats.places++;
  } else if (finishPosition === 3) {
    stats.shows++;
  }

  stats.winRate = (stats.wins / stats.starts) * 100;
  stats.itmRate = ((stats.wins + stats.places + stats.shows) / stats.starts) * 100;
}

/**
 * Format jockey stats for display
 */
function formatJockeyPatternEvidence(stats: JockeyPatternStats): string {
  if (stats.starts < MIN_JOCKEY_STARTS_FOR_CREDIBILITY) {
    return `${stats.description}: ${stats.winRate.toFixed(0)}% (${stats.starts} starts - limited)`;
  }
  return `${stats.description}: ${stats.winRate.toFixed(0)}% win (${stats.starts} starts)`;
}

/**
 * Get running style label
 */
export function getRunningStyleLabel(style: RunningStyle): string {
  switch (style) {
    case 'E':
      return 'on speed horses';
    case 'E/P':
      return 'on early speed';
    case 'P':
      return 'on pressers';
    case 'C':
      return 'on closers';
    case 'S':
      return 'on sustained runners';
    default:
      return '';
  }
}

// ============================================================================
// MAIN EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extract jockey patterns from all horses' past performances
 * Builds a comprehensive jockey database from race data
 */
export function extractJockeyPatternsFromHorses(horses: HorseEntry[]): Map<string, JockeyProfile> {
  const jockeyProfiles = new Map<string, JockeyProfile>();

  try {
    for (const horse of horses) {
      // Process each past performance
      for (const pp of horse.pastPerformances) {
        if (!pp.jockey) continue;

        const normalizedName = normalizeJockeyName(pp.jockey);
        const beyer = pp.speedFigures?.beyer ?? null;
        const runningStyle = determineRunningStyle(pp);
        const distCat = getDistanceCategory(pp.distanceFurlongs);

        // Get or create jockey profile
        if (!jockeyProfiles.has(normalizedName)) {
          jockeyProfiles.set(normalizedName, {
            jockeyName: normalizedName,
            overall: createJockeyPatternStats(pp.jockey, {}, `${pp.jockey} overall`),
            byTrack: new Map(),
            byRunningStyle: new Map(),
            bySurface: new Map(),
            byDistanceCategory: new Map(),
            bestPattern: null,
            score: DEFAULT_JOCKEY_SCORE,
            tier: 'average',
            evidence: [],
          });
        }

        const profile = jockeyProfiles.get(normalizedName);
        if (!profile) continue;

        // Update overall
        updateJockeyPatternStats(profile.overall, pp.finishPosition, beyer);

        // Update track pattern
        if (!profile.byTrack.has(pp.track)) {
          profile.byTrack.set(
            pp.track,
            createJockeyPatternStats(
              pp.jockey,
              { trackCode: pp.track },
              `At ${pp.trackName || pp.track}`
            )
          );
        }
        const trackPattern = profile.byTrack.get(pp.track);
        if (trackPattern) {
          updateJockeyPatternStats(trackPattern, pp.finishPosition, beyer);
        }

        // Update running style pattern
        if (runningStyle !== 'unknown') {
          if (!profile.byRunningStyle.has(runningStyle)) {
            profile.byRunningStyle.set(
              runningStyle,
              createJockeyPatternStats(
                pp.jockey,
                { runningStyle },
                `${getRunningStyleLabel(runningStyle).charAt(0).toUpperCase() + getRunningStyleLabel(runningStyle).slice(1)}`
              )
            );
          }
          const stylePattern = profile.byRunningStyle.get(runningStyle);
          if (stylePattern) {
            updateJockeyPatternStats(stylePattern, pp.finishPosition, beyer);
          }
        }

        // Update surface pattern
        if (!profile.bySurface.has(pp.surface)) {
          profile.bySurface.set(
            pp.surface,
            createJockeyPatternStats(pp.jockey, { surface: pp.surface }, `On ${pp.surface}`)
          );
        }
        const surfacePattern = profile.bySurface.get(pp.surface);
        if (surfacePattern) {
          updateJockeyPatternStats(surfacePattern, pp.finishPosition, beyer);
        }

        // Update distance category pattern
        if (!profile.byDistanceCategory.has(distCat)) {
          profile.byDistanceCategory.set(
            distCat,
            createJockeyPatternStats(
              pp.jockey,
              { distanceCategory: distCat },
              `In ${distCat === 'sprint' ? 'sprints' : 'routes'}`
            )
          );
        }
        const distancePattern = profile.byDistanceCategory.get(distCat);
        if (distancePattern) {
          updateJockeyPatternStats(distancePattern, pp.finishPosition, beyer);
        }
      }
    }

    // Finalize profiles
    for (const [, profile] of jockeyProfiles) {
      // Find best pattern
      const allPatterns = [
        profile.overall,
        ...Array.from(profile.byTrack.values()),
        ...Array.from(profile.byRunningStyle.values()),
        ...Array.from(profile.bySurface.values()),
      ];

      const crediblePatterns = allPatterns.filter(
        (p) => p.starts >= MIN_JOCKEY_STARTS_FOR_CREDIBILITY
      );

      if (crediblePatterns.length > 0) {
        profile.bestPattern = crediblePatterns.reduce((best, current) =>
          current.winRate > best.winRate ? current : best
        );
      }

      // Calculate score
      const patternToScore = profile.bestPattern || profile.overall;
      const { score, tier } = calculateJockeyScore(patternToScore.winRate, patternToScore.starts);
      profile.score = score;
      profile.tier = tier;

      // Build evidence
      if (profile.overall.starts >= MIN_JOCKEY_STARTS_FOR_CREDIBILITY) {
        profile.evidence.push(formatJockeyPatternEvidence(profile.overall));
      }
      if (profile.bestPattern && profile.bestPattern !== profile.overall) {
        profile.evidence.push(formatJockeyPatternEvidence(profile.bestPattern));
      }
    }
  } catch (error) {
    logger.logWarning('Error extracting jockey patterns', {
      component: 'JockeyPatterns',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return jockeyProfiles;
}

/**
 * Build a jockey profile for a specific jockey from race data
 */
export function buildJockeyProfile(jockeyName: string, horses: HorseEntry[]): JockeyProfile {
  const normalizedName = normalizeJockeyName(jockeyName);
  const allProfiles = extractJockeyPatternsFromHorses(horses);

  const profile = allProfiles.get(normalizedName);

  if (profile) {
    return profile;
  }

  // Return default profile if not found
  return {
    jockeyName: normalizedName,
    overall: createJockeyPatternStats(jockeyName, {}, `${jockeyName} overall`),
    byTrack: new Map(),
    byRunningStyle: new Map(),
    bySurface: new Map(),
    byDistanceCategory: new Map(),
    bestPattern: null,
    score: DEFAULT_JOCKEY_SCORE,
    tier: 'average',
    evidence: [],
  };
}

/**
 * Calculate jockey pattern score for a specific horse in a specific race
 */
export function calculateJockeyPatternScore(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  allHorses: HorseEntry[]
): JockeyPatternResult {
  try {
    const profile = buildJockeyProfile(horse.jockeyName, allHorses);

    // Determine horse's running style for pattern matching
    const firstPerformance = horse.pastPerformances[0];
    const horseRunningStyle =
      firstPerformance !== undefined ? determineRunningStyle(firstPerformance) : 'unknown';

    const currentTrack = raceHeader.trackCode;
    const currentSurface = raceHeader.surface;

    let relevantPattern: JockeyPatternStats | null = null;
    let patternScore = profile.score;
    const evidence: string[] = [];

    // Priority order:
    // 1. Track-specific pattern
    // 2. Running style pattern (if known)
    // 3. Surface pattern
    // 4. Overall pattern

    // 1. Try track-specific pattern
    const trackPattern = profile.byTrack.get(currentTrack);
    if (trackPattern && trackPattern.starts >= MIN_JOCKEY_STARTS_FOR_CREDIBILITY) {
      relevantPattern = trackPattern;
      const { score } = calculateJockeyScore(trackPattern.winRate, trackPattern.starts);
      patternScore = score;
      evidence.push(formatJockeyPatternEvidence(trackPattern));
    }

    // 2. Try running style pattern
    if (!relevantPattern && horseRunningStyle !== 'unknown') {
      const stylePattern = profile.byRunningStyle.get(horseRunningStyle);
      if (stylePattern && stylePattern.starts >= MIN_JOCKEY_STARTS_FOR_CREDIBILITY) {
        relevantPattern = stylePattern;
        const { score } = calculateJockeyScore(stylePattern.winRate, stylePattern.starts);
        patternScore = score;
        evidence.push(formatJockeyPatternEvidence(stylePattern));
      }
    }

    // 3. Try surface pattern
    if (!relevantPattern) {
      const surfacePattern = profile.bySurface.get(currentSurface);
      if (surfacePattern && surfacePattern.starts >= MIN_JOCKEY_STARTS_FOR_CREDIBILITY) {
        relevantPattern = surfacePattern;
        const { score } = calculateJockeyScore(surfacePattern.winRate, surfacePattern.starts);
        patternScore = score;
        evidence.push(formatJockeyPatternEvidence(surfacePattern));
      }
    }

    // 4. Fall back to overall
    if (!relevantPattern && profile.overall.starts >= MIN_JOCKEY_STARTS_FOR_CREDIBILITY) {
      relevantPattern = profile.overall;
      const { score } = calculateJockeyScore(profile.overall.winRate, profile.overall.starts);
      patternScore = score;
      evidence.push(formatJockeyPatternEvidence(profile.overall));
    }

    // If still no pattern, use default
    if (!relevantPattern) {
      return {
        profile,
        relevantPattern: null,
        score: DEFAULT_JOCKEY_SCORE,
        reasoning: `${horse.jockeyName}: Limited data (${profile.overall.starts} rides)`,
        evidence: ['Insufficient data for pattern analysis'],
      };
    }

    const reasoning =
      relevantPattern.starts >= MIN_JOCKEY_STARTS_FOR_CREDIBILITY
        ? `${horse.jockeyName}: ${relevantPattern.winRate.toFixed(0)}% win rate ${relevantPattern.description.toLowerCase()} (${relevantPattern.starts} rides)`
        : `${horse.jockeyName}: Limited data`;

    return {
      profile,
      relevantPattern,
      score: patternScore,
      reasoning,
      evidence,
    };
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error('Unknown error'), {
      component: 'JockeyPatterns',
      horseName: horse.horseName,
      jockeyName: horse.jockeyName,
    });

    return {
      profile: {
        jockeyName: normalizeJockeyName(horse.jockeyName),
        overall: createJockeyPatternStats(horse.jockeyName, {}, `${horse.jockeyName} overall`),
        byTrack: new Map(),
        byRunningStyle: new Map(),
        bySurface: new Map(),
        byDistanceCategory: new Map(),
        bestPattern: null,
        score: DEFAULT_JOCKEY_SCORE,
        tier: 'average',
        evidence: [],
      },
      relevantPattern: null,
      score: DEFAULT_JOCKEY_SCORE,
      reasoning: `${horse.jockeyName}: Unable to analyze patterns`,
      evidence: ['Pattern analysis failed'],
    };
  }
}

/**
 * Get a formatted display string for jockey patterns
 */
export function getJockeyPatternDisplay(result: JockeyPatternResult): string {
  if (!result.relevantPattern) {
    return 'Limited jockey data';
  }

  const { relevantPattern } = result;
  const winPct = relevantPattern.winRate.toFixed(0);
  const starts = relevantPattern.starts;

  return `${winPct}% win (${starts} rides) ${relevantPattern.description.toLowerCase()}`;
}
