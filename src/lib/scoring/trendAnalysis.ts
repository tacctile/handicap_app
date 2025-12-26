/**
 * Trend Analysis Engine
 *
 * Implements rolling window analysis with recency weighting to detect
 * horse performance trajectory. Compares recent performance windows
 * to older windows to determine if a horse is improving, declining, or flat.
 *
 * See /src/docs/TREND_RANK.md for full methodology documentation.
 *
 * @module scoring/trendAnalysis
 */

import type { HorseEntry, PastPerformance } from '../../types/drf';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Direction of the trend */
export type TrendDirection = 'IMPROVING' | 'DECLINING' | 'FLAT';

/** Confidence level in the trend assessment */
export type TrendConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/** Strength classification of a trend */
export type TrendStrength = 'MINOR' | 'MODERATE' | 'SIGNIFICANT' | 'EXPLOSIVE';

/** Metric type for trend analysis */
export type TrendMetric =
  | 'finishPosition'
  | 'beyer'
  | 'beatenLengths'
  | 'firstCallPosition'
  | 'stretchCallPosition'
  | 'groundGained'
  | 'classLevel'
  | 'odds';

/** Result of a single metric's trend analysis */
export interface TrendResult {
  /** Name of the metric analyzed */
  metric: TrendMetric;
  /** Direction of the trend */
  direction: TrendDirection;
  /** Strength of the trend (numeric delta) */
  strength: number;
  /** Strength classification */
  strengthCategory: TrendStrength;
  /** Recent window average */
  recentAvg: number;
  /** Old window average */
  oldAvg: number;
  /** Number of data points used */
  dataPoints: number;
}

/** Rolling window averages for a metric */
export interface RollingWindows {
  /** Race 1 only (current form) */
  window1: number | null;
  /** Races 1-2 average (very recent) */
  window1_2: number | null;
  /** Races 1-3 average (short-term) */
  window1_3: number | null;
  /** Races 1-4 average (medium-term) */
  window1_4: number | null;
  /** Races 1-5 average (established) */
  window1_5: number | null;
  /** Races 4-5 average (old baseline) */
  window4_5: number | null;
  /** Races 3-5 average (older trend) */
  window3_5: number | null;
  /** Number of races available */
  raceCount: number;
}

/** Boolean trend flags */
export interface TrendFlags {
  /** Workout pattern trending up (more bullets recently) */
  workoutPatternTrending: boolean;
  /** Days since last race is optimal (14-30 days) */
  optimalLayoff: boolean;
  /** Class dropping with form improving */
  classDropImproving: boolean;
  /** Jockey upgrade from last race */
  jockeyUpgrade: boolean;
  /** Trainer hot streak (3+ wins last 14 days) - requires external data */
  trainerHotStreak: boolean;
  /** First time equipment (blinkers, etc) */
  equipmentChange: boolean;
  /** Layoff with bullet work */
  layoffWithBullet: boolean;
  /** Back to winning distance */
  backToWinningDistance: boolean;
  /** Surface switch to preferred */
  preferredSurface: boolean;
}

/** Complete trend score for a horse */
export interface TrendScore {
  /** Trend rank position (1 = best trending) */
  rank: number;
  /** Overall trend direction */
  direction: TrendDirection;
  /** Overall strength value */
  strength: number;
  /** Strength classification */
  strengthCategory: TrendStrength;
  /** Confidence level in the assessment */
  confidence: TrendConfidence;
  /** Normalized score for blended ranking (0-100) */
  normalizedScore: number;
  /** Raw composite score (before normalization) */
  rawScore: number;
  /** Individual metric trend results */
  details: TrendResult[];
  /** Boolean trend flags */
  flags: TrendFlags;
  /** Rolling windows for finish position (for sparkline) */
  finishWindows: RollingWindows;
  /** Rolling windows for Beyer figures (for modal) */
  beyerWindows: RollingWindows;
  /** Finish positions array (most recent first, for sparkline) */
  finishHistory: number[];
  /** Beyer figures array (most recent first) */
  beyerHistory: number[];
  /** Whether there's sufficient data for analysis */
  hasSufficientData: boolean;
  /** Reason for insufficient data (if applicable) */
  insufficientDataReason?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Threshold for determining improving trend */
const IMPROVING_THRESHOLD = 1.0;

/** Threshold for determining declining trend */
const DECLINING_THRESHOLD = -1.0;

/** Strength thresholds */
const STRENGTH_THRESHOLDS = {
  MINOR: 0.5,
  MODERATE: 1.5,
  SIGNIFICANT: 3.0,
  EXPLOSIVE: 4.5,
} as const;

/** Minimum races needed for trend analysis */
const MIN_RACES_FOR_TREND = 3;

/** Weight for each metric in composite score */
const METRIC_WEIGHTS: Record<TrendMetric, number> = {
  finishPosition: 0.25, // Most important - actual race results
  beyer: 0.25, // Speed figure trend
  beatenLengths: 0.15, // How close to winner
  firstCallPosition: 0.10, // Breaking pattern
  stretchCallPosition: 0.10, // Position late
  groundGained: 0.05, // Finishing kick
  classLevel: 0.05, // Class movement
  odds: 0.05, // Public perception
};

/** Bonus/penalty for each flag */
const FLAG_SCORES: Record<keyof TrendFlags, number> = {
  workoutPatternTrending: 3,
  optimalLayoff: 2,
  classDropImproving: 4,
  jockeyUpgrade: 2,
  trainerHotStreak: 3,
  equipmentChange: 2,
  layoffWithBullet: 3,
  backToWinningDistance: 3,
  preferredSurface: 2,
};

// ============================================================================
// ROLLING WINDOW CALCULATIONS
// ============================================================================

/**
 * Extract values from past performances for a given metric
 */
function extractMetricValues(races: PastPerformance[], metric: TrendMetric): (number | null)[] {
  return races.map((race) => {
    switch (metric) {
      case 'finishPosition':
        return race.finishPosition > 0 ? race.finishPosition : null;
      case 'beyer':
        return race.speedFigures?.beyer ?? null;
      case 'beatenLengths':
        return race.lengthsBehind >= 0 ? race.lengthsBehind : null;
      case 'firstCallPosition':
        return race.runningLine?.quarterMile ?? race.runningLine?.start ?? null;
      case 'stretchCallPosition':
        return race.runningLine?.stretch ?? null;
      case 'groundGained': {
        // Ground gained = stretch position - finish position (positive = gained ground)
        const stretchPos = race.runningLine?.stretch;
        const finishPos = race.finishPosition;
        if (stretchPos != null && finishPos > 0) {
          return stretchPos - finishPos;
        }
        return null;
      }
      case 'classLevel': {
        // Convert classification to numeric scale (higher = better class)
        return getClassNumeric(race.classification);
      }
      case 'odds':
        return race.odds ?? null;
      default:
        return null;
    }
  });
}

/**
 * Convert race classification to numeric value
 */
function getClassNumeric(classification: string): number {
  const classMap: Record<string, number> = {
    'stakes-graded-1': 10,
    'stakes-graded-2': 9,
    'stakes-graded-3': 8,
    'stakes-listed': 7,
    stakes: 6,
    handicap: 6,
    'allowance-optional-claiming': 5,
    allowance: 4,
    'starter-allowance': 3,
    claiming: 2,
    'maiden-claiming': 1,
    maiden: 1,
    unknown: 0,
  };
  return classMap[classification] ?? 0;
}

/**
 * Calculate average of valid numbers in an array
 */
function calculateAverage(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

/**
 * Calculate rolling windows for any metric
 *
 * @param races - Array of past performances (most recent first)
 * @param metric - The metric to analyze
 * @returns Rolling window averages
 */
export function calculateRollingWindows(
  races: PastPerformance[],
  metric: TrendMetric
): RollingWindows {
  const values = extractMetricValues(races, metric);
  const raceCount = values.filter((v) => v !== null).length;

  // Calculate each window
  const window1 = values[0] ?? null;
  const window1_2 = calculateAverage(values.slice(0, 2));
  const window1_3 = calculateAverage(values.slice(0, 3));
  const window1_4 = calculateAverage(values.slice(0, 4));
  const window1_5 = calculateAverage(values.slice(0, 5));
  const window4_5 = calculateAverage(values.slice(3, 5));
  const window3_5 = calculateAverage(values.slice(2, 5));

  return {
    window1,
    window1_2,
    window1_3,
    window1_4,
    window1_5,
    window4_5,
    window3_5,
    raceCount,
  };
}

// ============================================================================
// TREND DIRECTION & STRENGTH
// ============================================================================

/**
 * Calculate trend direction based on window comparison
 *
 * Trend Score = (Old Window Avg) - (Recent Window Avg)
 * For metrics where LOWER is better (finish position, beaten lengths):
 *   Positive score = Improving
 * For metrics where HIGHER is better (Beyer, class):
 *   Score is inverted (Recent - Old)
 *
 * @param recentWindow - Recent window average
 * @param oldWindow - Old window average
 * @param invertDirection - True for metrics where higher is better
 * @returns Trend direction
 */
export function calculateTrendDirection(
  recentWindow: number | null,
  oldWindow: number | null,
  invertDirection: boolean = false
): TrendDirection {
  if (recentWindow === null || oldWindow === null) {
    return 'FLAT';
  }

  let trendScore = oldWindow - recentWindow;
  if (invertDirection) {
    trendScore = -trendScore; // For Beyer/class, lower-is-worse, so invert
  }

  if (trendScore > IMPROVING_THRESHOLD) {
    return 'IMPROVING';
  } else if (trendScore < DECLINING_THRESHOLD) {
    return 'DECLINING';
  }
  return 'FLAT';
}

/**
 * Calculate trend strength (the delta value)
 *
 * @param recentWindow - Recent window average
 * @param oldWindow - Old window average
 * @param invertDirection - True for metrics where higher is better
 * @returns Numeric strength value (positive = improving)
 */
export function calculateTrendStrength(
  recentWindow: number | null,
  oldWindow: number | null,
  invertDirection: boolean = false
): number {
  if (recentWindow === null || oldWindow === null) {
    return 0;
  }

  let strength = oldWindow - recentWindow;
  if (invertDirection) {
    strength = -strength;
  }
  return strength;
}

/**
 * Classify strength into category
 */
function classifyStrength(strength: number): TrendStrength {
  const absStrength = Math.abs(strength);
  if (absStrength >= STRENGTH_THRESHOLDS.EXPLOSIVE) {
    return 'EXPLOSIVE';
  } else if (absStrength >= STRENGTH_THRESHOLDS.SIGNIFICANT) {
    return 'SIGNIFICANT';
  } else if (absStrength >= STRENGTH_THRESHOLDS.MODERATE) {
    return 'MODERATE';
  }
  return 'MINOR';
}

// ============================================================================
// TREND CONFIDENCE
// ============================================================================

/**
 * Calculate confidence level based on how many metrics agree
 *
 * HIGH: 3+ metrics trending same direction
 * MEDIUM: 2 metrics trending same direction
 * LOW: Mixed signals or insufficient data
 *
 * @param allTrends - Array of trend results from all metrics
 * @returns Confidence level
 */
export function calculateTrendConfidence(allTrends: TrendResult[]): TrendConfidence {
  if (allTrends.length === 0) {
    return 'LOW';
  }

  // Count directions
  const improving = allTrends.filter((t) => t.direction === 'IMPROVING').length;
  const declining = allTrends.filter((t) => t.direction === 'DECLINING').length;

  const maxAgreement = Math.max(improving, declining);

  if (maxAgreement >= 3) {
    return 'HIGH';
  } else if (maxAgreement >= 2) {
    return 'MEDIUM';
  }
  return 'LOW';
}

// ============================================================================
// TREND FLAGS
// ============================================================================

/**
 * Analyze boolean trend flags for a horse
 */
function analyzeTrendFlags(
  horse: HorseEntry,
  races: PastPerformance[],
  raceHeader?: { distanceFurlongs?: number; surface?: string }
): TrendFlags {
  const flags: TrendFlags = {
    workoutPatternTrending: false,
    optimalLayoff: false,
    classDropImproving: false,
    jockeyUpgrade: false,
    trainerHotStreak: false, // Would need external data
    equipmentChange: false,
    layoffWithBullet: false,
    backToWinningDistance: false,
    preferredSurface: false,
  };

  // Check workout pattern - look for bullets in recent works
  if (horse.workouts && horse.workouts.length >= 2) {
    const recentBullets = horse.workouts.slice(0, 2).filter((w) => w.isBullet).length;
    const olderBullets = horse.workouts.slice(2).filter((w) => w.isBullet).length;
    flags.workoutPatternTrending = recentBullets > 0 && recentBullets > olderBullets;
  }

  // Check optimal layoff (14-30 days)
  if (horse.daysSinceLastRace !== null) {
    flags.optimalLayoff = horse.daysSinceLastRace >= 14 && horse.daysSinceLastRace <= 30;
  }

  // Check class drop with improving form
  if (races.length >= 2) {
    const recentClass = getClassNumeric(races[0]?.classification ?? 'unknown');
    const previousClass = getClassNumeric(races[1]?.classification ?? 'unknown');
    const recentFinish = races[0]?.finishPosition ?? 99;
    const previousFinish = races[1]?.finishPosition ?? 99;
    flags.classDropImproving = recentClass < previousClass && recentFinish < previousFinish;
  }

  // Check jockey upgrade
  if (races.length >= 2 && races[0] && races[1]) {
    const currentJockey = horse.jockeyName?.toLowerCase() ?? '';
    const lastJockey = races[0].jockey?.toLowerCase() ?? '';
    const previousJockey = races[1].jockey?.toLowerCase() ?? '';
    // This is a simplification - could use jockey stats to compare
    flags.jockeyUpgrade = currentJockey !== lastJockey && lastJockey === previousJockey;
  }

  // Check equipment change
  const equipmentChanges = horse.equipment?.equipmentChanges ?? [];
  const firstTimeEquipment = horse.equipment?.firstTimeEquipment ?? [];
  flags.equipmentChange = equipmentChanges.length > 0 || firstTimeEquipment.length > 0;

  // Check layoff with bullet work
  const isLayoff = (horse.daysSinceLastRace ?? 0) >= 45;
  const hasBullet = horse.workouts?.some((w) => w.isBullet) ?? false;
  flags.layoffWithBullet = isLayoff && hasBullet;

  // Check back to winning distance
  if (raceHeader?.distanceFurlongs && races.length > 0) {
    const currentDistance = raceHeader.distanceFurlongs;
    const wins = races.filter((r) => r.finishPosition === 1);
    const winningDistances = wins.map((r) => r.distanceFurlongs);
    // Within 0.5 furlongs of a winning distance
    flags.backToWinningDistance = winningDistances.some(
      (d) => Math.abs(d - currentDistance) <= 0.5
    );
  }

  // Check preferred surface
  if (raceHeader?.surface && races.length >= 3) {
    const currentSurface = raceHeader.surface;
    const surfaceWins = races.filter(
      (r) => r.finishPosition === 1 && r.surface === currentSurface
    ).length;
    const totalWins = races.filter((r) => r.finishPosition === 1).length;
    flags.preferredSurface = totalWins > 0 && surfaceWins / totalWins >= 0.6;
  }

  return flags;
}

// ============================================================================
// MAIN TREND RANK CALCULATION
// ============================================================================

/**
 * Calculate complete trend score for a horse
 *
 * @param horse - Horse entry with past performances
 * @param raceHeader - Optional race header for context
 * @returns Complete trend score
 */
export function calculateTrendRank(
  horse: HorseEntry,
  raceHeader?: { distanceFurlongs?: number; surface?: string }
): TrendScore {
  const races = horse.pastPerformances ?? [];

  // Default insufficient data result
  const defaultResult: TrendScore = {
    rank: 0,
    direction: 'FLAT',
    strength: 0,
    strengthCategory: 'MINOR',
    confidence: 'LOW',
    normalizedScore: 50, // Neutral score
    rawScore: 0,
    details: [],
    flags: analyzeTrendFlags(horse, races, raceHeader),
    finishWindows: { window1: null, window1_2: null, window1_3: null, window1_4: null, window1_5: null, window4_5: null, window3_5: null, raceCount: 0 },
    beyerWindows: { window1: null, window1_2: null, window1_3: null, window1_4: null, window1_5: null, window4_5: null, window3_5: null, raceCount: 0 },
    finishHistory: races.map((r) => r.finishPosition).filter((p) => p > 0),
    beyerHistory: races.map((r) => r.speedFigures?.beyer).filter((b): b is number => b !== null),
    hasSufficientData: false,
    insufficientDataReason: races.length < MIN_RACES_FOR_TREND
      ? `Only ${races.length} races available (need ${MIN_RACES_FOR_TREND}+)`
      : undefined,
  };

  if (races.length < MIN_RACES_FOR_TREND) {
    return defaultResult;
  }

  // Calculate rolling windows for each metric
  const metrics: TrendMetric[] = [
    'finishPosition',
    'beyer',
    'beatenLengths',
    'firstCallPosition',
    'stretchCallPosition',
    'groundGained',
    'classLevel',
    'odds',
  ];

  // Metrics where higher is better (need to invert direction)
  const higherIsBetter: TrendMetric[] = ['beyer', 'groundGained', 'classLevel'];

  const trendResults: TrendResult[] = [];
  let finishWindows: RollingWindows | null = null;
  let beyerWindows: RollingWindows | null = null;

  for (const metric of metrics) {
    const windows = calculateRollingWindows(races, metric);

    // Store finish and beyer windows for display
    if (metric === 'finishPosition') {
      finishWindows = windows;
    } else if (metric === 'beyer') {
      beyerWindows = windows;
    }

    // Skip if insufficient data for this metric
    if (windows.window1_2 === null || windows.window4_5 === null) {
      continue;
    }

    const invert = higherIsBetter.includes(metric);
    const direction = calculateTrendDirection(windows.window1_2, windows.window4_5, invert);
    const strength = calculateTrendStrength(windows.window1_2, windows.window4_5, invert);

    trendResults.push({
      metric,
      direction,
      strength,
      strengthCategory: classifyStrength(strength),
      recentAvg: windows.window1_2,
      oldAvg: windows.window4_5,
      dataPoints: windows.raceCount,
    });
  }

  if (trendResults.length === 0) {
    return {
      ...defaultResult,
      finishWindows: finishWindows ?? defaultResult.finishWindows,
      beyerWindows: beyerWindows ?? defaultResult.beyerWindows,
      insufficientDataReason: 'Insufficient metric data across races',
    };
  }

  // Calculate weighted composite score
  let weightedSum = 0;
  let totalWeight = 0;

  for (const result of trendResults) {
    const weight = METRIC_WEIGHTS[result.metric] ?? 0;
    weightedSum += result.strength * weight;
    totalWeight += weight;
  }

  const compositeStrength = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Add flag bonuses
  const flags = analyzeTrendFlags(horse, races, raceHeader);
  let flagBonus = 0;
  for (const [key, value] of Object.entries(flags)) {
    if (value === true) {
      flagBonus += FLAG_SCORES[key as keyof TrendFlags] ?? 0;
    }
  }

  // Calculate raw score (composite strength + flag bonuses)
  const rawScore = compositeStrength * 10 + flagBonus;

  // Determine overall direction and strength
  const overallDirection =
    compositeStrength > IMPROVING_THRESHOLD
      ? 'IMPROVING'
      : compositeStrength < DECLINING_THRESHOLD
        ? 'DECLINING'
        : 'FLAT';

  // Calculate confidence
  const confidence = calculateTrendConfidence(trendResults);

  // Normalize score to 0-100 scale
  // Raw scores typically range from -50 to +50
  // Center at 50, with 0-100 range
  const normalizedScore = Math.max(0, Math.min(100, 50 + rawScore));

  return {
    rank: 0, // Will be set when ranking field
    direction: overallDirection,
    strength: compositeStrength,
    strengthCategory: classifyStrength(compositeStrength),
    confidence,
    normalizedScore,
    rawScore,
    details: trendResults,
    flags,
    finishWindows: finishWindows ?? defaultResult.finishWindows,
    beyerWindows: beyerWindows ?? defaultResult.beyerWindows,
    finishHistory: races.map((r) => r.finishPosition).filter((p) => p > 0),
    beyerHistory: races.map((r) => r.speedFigures?.beyer).filter((b): b is number => b !== null),
    hasSufficientData: true,
  };
}

// ============================================================================
// FIELD RANKING
// ============================================================================

/** Horse with trend score for ranking */
export interface HorseWithTrend {
  horse: HorseEntry;
  index: number;
  trendScore: TrendScore;
}

/**
 * Rank all horses in field by trend score
 *
 * @param horses - Array of horse entries
 * @param raceHeader - Optional race header for context
 * @returns Horses with trend scores and ranks assigned
 */
export function rankHorsesByTrend(
  horses: HorseEntry[],
  raceHeader?: { distanceFurlongs?: number; surface?: string }
): HorseWithTrend[] {
  // Calculate trend scores for all horses
  const horsesWithTrend: HorseWithTrend[] = horses.map((horse, index) => ({
    horse,
    index,
    trendScore: calculateTrendRank(horse, raceHeader),
  }));

  // Filter to non-scratched horses
  const activeHorses = horsesWithTrend.filter((h) => !h.horse.isScratched);

  // Sort by normalized score (higher is better = more improving)
  const sorted = [...activeHorses].sort(
    (a, b) => b.trendScore.normalizedScore - a.trendScore.normalizedScore
  );

  // Assign ranks with tie handling
  let currentRank = 1;
  let previousScore: number | null = null;
  let sameRankCount = 0;

  sorted.forEach((horse) => {
    const score = horse.trendScore.normalizedScore;

    if (previousScore !== null && score < previousScore) {
      currentRank += sameRankCount;
      sameRankCount = 1;
    } else if (previousScore !== null && score === previousScore) {
      sameRankCount++;
    } else {
      sameRankCount = 1;
    }

    previousScore = score;
    horse.trendScore.rank = currentRank;
  });

  return horsesWithTrend;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  MIN_RACES_FOR_TREND,
  METRIC_WEIGHTS,
  FLAG_SCORES,
  IMPROVING_THRESHOLD,
  DECLINING_THRESHOLD,
  STRENGTH_THRESHOLDS,
};
