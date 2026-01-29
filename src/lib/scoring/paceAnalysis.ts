/**
 * Pace Scenario Detection System
 *
 * Comprehensive analysis of pace scenarios and running styles based on DRF past performances.
 *
 * Running Style Classification:
 * - E (Early Speed): Leads or contests early, position at first call ≤ 3
 * - P (Presser): Stalks pace, sits 3-5 lengths off early
 * - C (Closer): Mid-pack or worse early, makes late run
 * - S (Sustained Speed): Maintains position throughout
 *
 * Pace Pressure Index (PPI):
 * - Soft Pace: PPI < 20 (0-1 speed horses in 8+ horse field)
 * - Moderate Pace: PPI 20-35 (2-3 speed horses)
 * - Contested Pace: PPI 35-50 (3-4 speed horses)
 * - Speed Duel: PPI > 50 (4+ speed horses)
 */

import type { HorseEntry, PastPerformance } from '../../types/drf';
import {
  buildBeatenLengthsProfile,
  validateRunningStyleWithLengths,
  type BeatenLengthsProfile,
} from './beatenLengths';

// ============================================================================
// PACE FIGURE THRESHOLDS
// ============================================================================

// Import static thresholds from paceScenario constants
import { EP1_THRESHOLDS as EP1_STATIC_THRESHOLDS } from './constants/paceScenario';

// Re-export for convenience
export { EP1_THRESHOLDS as EP1_STATIC_THRESHOLDS } from './constants/paceScenario';

/**
 * Thresholds for EP1 (Early Pace) figure classification
 * EP1 ranges typically from 0-120, with higher = faster early speed
 *
 * Uses static EP1 thresholds for running style classification:
 * - E (Early): EP1 ≥ 92
 * - EP (Early Presser): EP1 85-91
 * - P (Presser/Stalker): EP1 75-84
 * - S (Closer): EP1 < 75
 */
export const EP1_THRESHOLDS = {
  /** High early pace = confirmed early speed */
  HIGH: EP1_STATIC_THRESHOLDS.EP, // 85 - At or above EP threshold means confirmed speed
  /** Moderate early pace */
  MODERATE: EP1_STATIC_THRESHOLDS.P, // 75 - At or above P threshold
  /** Low early pace = confirmed closer */
  LOW: 70, // Below 70 = confirmed closer
} as const;

/**
 * Thresholds for Late Pace figure classification
 * LP ranges typically from 0-120, with higher = stronger closing kick
 */
export const LP_THRESHOLDS = {
  /** Strong closing kick (90+) */
  STRONG: 90,
  /** Good closing ability (80+) */
  GOOD: 80,
  /** Moderate closing ability */
  MODERATE: 75,
} as const;

/**
 * Thresholds for field pace pressure based on EP1 sum
 * Based on field size multiplied by expected average EP1
 */
export const FIELD_PACE_THRESHOLDS = {
  /** Per-horse EP1 average indicating soft pace (75 or less) */
  SOFT_AVG: 75,
  /** Per-horse EP1 average indicating moderate pace */
  MODERATE_AVG: 80,
  /** Per-horse EP1 average indicating contested pace */
  CONTESTED_AVG: 85,
  /** Per-horse EP1 average indicating speed duel (90+) */
  DUEL_AVG: 90,
} as const;

// ============================================================================
// TYPES
// ============================================================================

/** Pace figure analysis result for a single horse */
export interface PaceFigureAnalysis {
  /** Average EP1 from last 3-5 races, null if insufficient data */
  avgEarlyPace: number | null;
  /** Average LP from last 3-5 races, null if insufficient data */
  avgLatePace: number | null;
  /** Number of races with valid EP1 data */
  ep1RaceCount: number;
  /** Number of races with valid LP data */
  lpRaceCount: number;
  /** EP1 trend (improving/declining/stable) */
  ep1Trend: 'improving' | 'declining' | 'stable' | 'unknown';
  /** LP trend (improving/declining/stable) */
  lpTrend: 'improving' | 'declining' | 'stable' | 'unknown';
  /** Is this horse a confirmed early speed based on EP1? */
  isConfirmedSpeed: boolean;
  /** Is this horse a confirmed closer based on EP1/LP? */
  isConfirmedCloser: boolean;
  /** LP significantly higher than EP1 = closer with kick */
  hasClosingKick: boolean;
  /** Closing kick differential (LP - EP1) */
  closingKickDifferential: number | null;
}

/** Field-level pace pressure analysis using EP1 figures */
export interface FieldPacePressureAnalysis {
  /** Pace pressure classification */
  pressure: 'soft' | 'moderate' | 'contested' | 'duel';
  /** Average EP1 across all horses with data */
  avgFieldEP1: number | null;
  /** Sum of all valid EP1 figures in the field */
  totalFieldEP1: number;
  /** Number of horses with high EP1 (85+) */
  highEP1Count: number;
  /** Number of horses with valid EP1 data */
  validHorsesCount: number;
  /** Horses identified as confirmed speed via EP1 (program numbers) */
  confirmedSpeedHorses: number[];
  /** Confidence level based on data availability (0-100) */
  dataConfidence: number;
  /** Description of the pace pressure projection */
  description: string;
}

/** Core running style classification */
export type RunningStyleCode = 'E' | 'P' | 'C' | 'S' | 'U';

/** Detailed running style names */
export const RUNNING_STYLE_NAMES: Record<RunningStyleCode, string> = {
  E: 'Early Speed',
  P: 'Presser',
  C: 'Closer',
  S: 'Sustained Speed',
  U: 'Unknown',
};

/** Pace scenario classification */
export type PaceScenarioType = 'soft' | 'moderate' | 'contested' | 'speed_duel' | 'unknown';

/** Pace scenario display labels */
export const PACE_SCENARIO_LABELS: Record<PaceScenarioType, string> = {
  soft: 'Soft (Lone Speed)',
  moderate: 'Moderate',
  contested: 'Contested',
  speed_duel: 'Speed Duel',
  unknown: 'Unknown',
};

/** Pace scenario colors for UI */
export const PACE_SCENARIO_COLORS: Record<PaceScenarioType, string> = {
  soft: '#22c55e', // Green
  moderate: '#eab308', // Yellow
  contested: '#f97316', // Orange
  speed_duel: '#ef4444', // Red
  unknown: '#888888', // Gray
};

/** Running style evidence from past performance */
export interface RunningStyleEvidence {
  raceDate: string;
  track: string;
  firstCallPosition: number;
  fieldSize: number;
  finishPosition: number;
  styleInRace: RunningStyleCode;
  wasOnLead: boolean;
  lengthsBehindAtFirstCall: number | null;
}

/** Detailed running style profile */
export interface RunningStyleProfile {
  /** Primary running style */
  style: RunningStyleCode;
  /** Style display name */
  styleName: string;
  /** Confidence in style classification (0-100) */
  confidence: number;
  /** Evidence from past races */
  evidence: RunningStyleEvidence[];
  /** Summary statistics */
  stats: {
    totalRaces: number;
    timesOnLead: number;
    timesInTop3Early: number;
    avgFirstCallPosition: number;
    avgLengthsBehindEarly: number;
  };
  /** Description for display */
  description: string;
  /** Pace figure analysis (EP1 and LP) - if available */
  paceFigures?: PaceFigureAnalysis;
  /** Beaten lengths profile - closing patterns, etc. */
  beatenLengthsProfile?: BeatenLengthsProfile;
  /** Whether the declared style is validated by beaten lengths data */
  styleValidated: boolean;
  /** Actual running pattern derived from beaten lengths */
  actualPattern?: 'E' | 'P' | 'S' | 'C' | 'U';
}

/** Pace scenario analysis for the entire field */
export interface PaceScenarioAnalysis {
  /** Pace scenario type */
  scenario: PaceScenarioType;
  /** Display label */
  label: string;
  /** Color for UI */
  color: string;
  /** Pace Pressure Index (0-100) */
  ppi: number;
  /** Breakdown of running styles */
  styleBreakdown: {
    earlySpeed: number[]; // Program numbers
    pressers: number[];
    closers: number[];
    sustained: number[];
    unknown: number[];
  };
  /** Field size (active horses only) */
  fieldSize: number;
  /** Expected pace description */
  expectedPace: string;
  /** Detailed scenario description */
  description: string;
  /** Field pace pressure analysis using EP1 figures (if available) */
  pacePressure?: FieldPacePressureAnalysis;
}

/** Tactical advantage result */
export interface TacticalAdvantage {
  /** Points earned (0-25) */
  points: number;
  /** Advantage level */
  level: 'excellent' | 'good' | 'neutral' | 'poor' | 'terrible';
  /** Description of the tactical fit */
  fit: string;
  /** Reasoning for display */
  reasoning: string;
}

/** Complete pace analysis result */
export interface PaceAnalysisResult {
  /** Horse's running style profile */
  profile: RunningStyleProfile;
  /** Field pace scenario */
  scenario: PaceScenarioAnalysis;
  /** Tactical advantage calculation */
  tactical: TacticalAdvantage;
  /** Total pace score (used by scoring system) */
  totalScore: number;
}

// ============================================================================
// PACE FIGURE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Calculate the average early pace (EP1) from a horse's past performances
 * Uses the last 3-5 races with valid EP1 data
 *
 * @param horse - The horse entry to analyze
 * @returns Average EP1 figure, or null if insufficient data
 */
export function getAverageEarlyPace(horse: HorseEntry): number | null {
  const recentPPs = horse.pastPerformances.slice(0, 5);
  const validEP1s = recentPPs
    .map((pp) => pp.earlyPace1)
    .filter((ep1): ep1 is number => ep1 !== null && ep1 > 0);

  // Require at least 2 races for reliable average
  if (validEP1s.length < 2) {
    return null;
  }

  const sum = validEP1s.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / validEP1s.length) * 10) / 10;
}

/**
 * Calculate the average late pace (LP) from a horse's past performances
 * Uses the last 3-5 races with valid LP data
 *
 * @param horse - The horse entry to analyze
 * @returns Average LP figure, or null if insufficient data
 */
export function getAverageLatePace(horse: HorseEntry): number | null {
  const recentPPs = horse.pastPerformances.slice(0, 5);
  const validLPs = recentPPs
    .map((pp) => pp.latePace)
    .filter((lp): lp is number => lp !== null && lp > 0);

  // Require at least 2 races for reliable average
  if (validLPs.length < 2) {
    return null;
  }

  const sum = validLPs.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / validLPs.length) * 10) / 10;
}

/**
 * Calculate a trend (improving, declining, stable) from pace figures
 *
 * @param figures - Array of pace figures (most recent first)
 * @returns Trend classification
 */
function calculatePaceTrend(figures: number[]): 'improving' | 'declining' | 'stable' | 'unknown' {
  if (figures.length < 2) {
    return 'unknown';
  }

  // Compare most recent to average of previous
  const recent = figures[0];
  const previous = figures.slice(1);
  const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length;

  if (recent === undefined) {
    return 'unknown';
  }

  const diff = recent - prevAvg;
  const threshold = 3; // 3 points is significant

  if (diff >= threshold) {
    return 'improving';
  } else if (diff <= -threshold) {
    return 'declining';
  }
  return 'stable';
}

/**
 * Analyze a horse's pace figures (EP1 and LP) to determine their running profile
 * Uses static EP1 thresholds for classification.
 *
 * @param horse - The horse entry to analyze
 * @returns Detailed pace figure analysis
 */
export function analyzePaceFigures(horse: HorseEntry): PaceFigureAnalysis {
  const recentPPs = horse.pastPerformances.slice(0, 5);

  // Extract valid EP1 figures
  const ep1Data = recentPPs
    .map((pp) => pp.earlyPace1)
    .filter((ep1): ep1 is number => ep1 !== null && ep1 > 0);

  // Extract valid LP figures
  const lpData = recentPPs
    .map((pp) => pp.latePace)
    .filter((lp): lp is number => lp !== null && lp > 0);

  // Calculate averages
  const avgEarlyPace =
    ep1Data.length >= 2
      ? Math.round((ep1Data.reduce((a, b) => a + b, 0) / ep1Data.length) * 10) / 10
      : null;

  const avgLatePace =
    lpData.length >= 2
      ? Math.round((lpData.reduce((a, b) => a + b, 0) / lpData.length) * 10) / 10
      : null;

  // Calculate trends
  const ep1Trend = calculatePaceTrend(ep1Data);
  const lpTrend = calculatePaceTrend(lpData);

  // Use static thresholds for speed/closer classification
  const speedThreshold = EP1_STATIC_THRESHOLDS.EP; // 85+ = confirmed speed
  const closerThreshold = EP1_STATIC_THRESHOLDS.P; // Below 75 = confirmed closer

  // Determine if confirmed speed (high EP1)
  const isConfirmedSpeed = avgEarlyPace !== null && avgEarlyPace >= speedThreshold;

  // Determine if confirmed closer (low EP1 OR high LP)
  const isConfirmedCloser =
    (avgEarlyPace !== null && avgEarlyPace < closerThreshold) ||
    (avgLatePace !== null && avgLatePace >= LP_THRESHOLDS.STRONG);

  // Calculate closing kick differential (LP - EP1)
  let closingKickDifferential: number | null = null;
  let hasClosingKick = false;

  if (avgLatePace !== null && avgEarlyPace !== null) {
    closingKickDifferential = Math.round((avgLatePace - avgEarlyPace) * 10) / 10;
    // LP significantly higher than EP1 (5+ points) indicates closing kick
    hasClosingKick = closingKickDifferential >= 5;
  }

  return {
    avgEarlyPace,
    avgLatePace,
    ep1RaceCount: ep1Data.length,
    lpRaceCount: lpData.length,
    ep1Trend,
    lpTrend,
    isConfirmedSpeed,
    isConfirmedCloser,
    hasClosingKick,
    closingKickDifferential,
  };
}

/**
 * Analyze the field's pace pressure based on EP1 figures
 * Higher average EP1 across the field = more contested pace
 *
 * @param horses - All horses in the race
 * @returns Field pace pressure analysis
 */
export function getFieldPacePressure(horses: HorseEntry[]): FieldPacePressureAnalysis {
  const activeHorses = horses.filter((h) => !h.isScratched);

  // Use static threshold for "high EP1" (85+)
  const highEP1Threshold = EP1_STATIC_THRESHOLDS.EP;

  // Gather EP1 data for all horses
  const horsesWithEP1: Array<{ progNum: number; avgEP1: number; isHighEP1: boolean }> = [];

  for (const horse of activeHorses) {
    const avgEP1 = getAverageEarlyPace(horse);
    if (avgEP1 !== null) {
      horsesWithEP1.push({
        progNum: horse.programNumber,
        avgEP1,
        isHighEP1: avgEP1 >= highEP1Threshold,
      });
    }
  }

  // Calculate data confidence based on how many horses have EP1 data
  const dataConfidence =
    activeHorses.length > 0 ? Math.round((horsesWithEP1.length / activeHorses.length) * 100) : 0;

  // If less than 50% of horses have EP1 data, return unknown with low confidence
  if (dataConfidence < 50) {
    return {
      pressure: 'moderate', // Default fallback
      avgFieldEP1: null,
      totalFieldEP1: 0,
      highEP1Count: 0,
      validHorsesCount: horsesWithEP1.length,
      confirmedSpeedHorses: [],
      dataConfidence,
      description: 'Insufficient EP1 data for reliable pace projection',
    };
  }

  // Calculate field statistics
  const totalFieldEP1 = horsesWithEP1.reduce((sum, h) => sum + h.avgEP1, 0);
  const avgFieldEP1 = Math.round((totalFieldEP1 / horsesWithEP1.length) * 10) / 10;
  const highEP1Count = horsesWithEP1.filter((h) => h.isHighEP1).length;
  const confirmedSpeedHorses = horsesWithEP1.filter((h) => h.isHighEP1).map((h) => h.progNum);

  // Determine pace pressure from field average EP1
  let pressure: 'soft' | 'moderate' | 'contested' | 'duel';
  let description: string;

  if (avgFieldEP1 >= FIELD_PACE_THRESHOLDS.DUEL_AVG || highEP1Count >= 4) {
    pressure = 'duel';
    description = `Speed duel likely: ${highEP1Count} horses with high EP1 (85+). Field avg EP1: ${avgFieldEP1}`;
  } else if (avgFieldEP1 >= FIELD_PACE_THRESHOLDS.CONTESTED_AVG || highEP1Count >= 3) {
    pressure = 'contested';
    description = `Contested pace expected: ${highEP1Count} speed horses. Field avg EP1: ${avgFieldEP1}`;
  } else if (avgFieldEP1 >= FIELD_PACE_THRESHOLDS.MODERATE_AVG || highEP1Count >= 2) {
    pressure = 'moderate';
    description = `Moderate pace projected. Field avg EP1: ${avgFieldEP1}`;
  } else {
    pressure = 'soft';
    description =
      highEP1Count === 1
        ? `Soft pace - lone speed. Field avg EP1: ${avgFieldEP1}`
        : `Very soft pace - no confirmed speed. Field avg EP1: ${avgFieldEP1}`;
  }

  return {
    pressure,
    avgFieldEP1,
    totalFieldEP1,
    highEP1Count,
    validHorsesCount: horsesWithEP1.length,
    confirmedSpeedHorses,
    dataConfidence,
    description,
  };
}

/**
 * Calculate pace figure bonus/penalty points for a horse
 * Used to adjust tactical scoring based on actual pace figures
 *
 * @param paceFigures - Horse's pace figure analysis
 * @param fieldPressure - Field pace pressure analysis
 * @param runningStyle - Horse's running style
 * @returns Adjustment points (-5 to +5)
 */
export function calculatePaceFigureAdjustment(
  paceFigures: PaceFigureAnalysis,
  fieldPressure: FieldPacePressureAnalysis,
  runningStyle: RunningStyleCode
): { points: number; reasoning: string } {
  let points = 0;
  const reasons: string[] = [];

  // If no pace figure data, return neutral
  if (paceFigures.avgEarlyPace === null && paceFigures.avgLatePace === null) {
    return { points: 0, reasoning: 'No pace figures available' };
  }

  // Speed horse bonuses/penalties
  if (runningStyle === 'E' || paceFigures.isConfirmedSpeed) {
    if (fieldPressure.pressure === 'soft') {
      // Strong early pace in soft pace scenario: big bonus
      if (paceFigures.avgEarlyPace !== null && paceFigures.avgEarlyPace >= EP1_THRESHOLDS.HIGH) {
        points += 5;
        reasons.push(
          `Strong EP1 (${paceFigures.avgEarlyPace}) in soft pace = wire-to-wire opportunity`
        );
      } else if (
        paceFigures.avgEarlyPace !== null &&
        paceFigures.avgEarlyPace >= EP1_THRESHOLDS.MODERATE
      ) {
        points += 3;
        reasons.push(`Good EP1 (${paceFigures.avgEarlyPace}) in soft pace`);
      }
    } else if (fieldPressure.pressure === 'duel') {
      // Speed in a duel: penalty (unless they have the best EP1)
      if (paceFigures.avgEarlyPace !== null && fieldPressure.avgFieldEP1 !== null) {
        if (paceFigures.avgEarlyPace < fieldPressure.avgFieldEP1 - 3) {
          points -= 3;
          reasons.push(`EP1 (${paceFigures.avgEarlyPace}) below field avg in speed duel`);
        }
      }
    }
  }

  // Closer bonuses/penalties
  if (runningStyle === 'C' || paceFigures.isConfirmedCloser) {
    if (fieldPressure.pressure === 'duel' || fieldPressure.pressure === 'contested') {
      // Strong closing kick in contested/duel pace: big bonus
      if (paceFigures.avgLatePace !== null && paceFigures.avgLatePace >= LP_THRESHOLDS.STRONG) {
        points += 5;
        reasons.push(`Strong LP (${paceFigures.avgLatePace}) in ${fieldPressure.pressure} pace`);
      } else if (
        paceFigures.avgLatePace !== null &&
        paceFigures.avgLatePace >= LP_THRESHOLDS.GOOD
      ) {
        points += 3;
        reasons.push(`Good LP (${paceFigures.avgLatePace}) in ${fieldPressure.pressure} pace`);
      }

      // Extra bonus for closing kick differential
      if (paceFigures.hasClosingKick && paceFigures.closingKickDifferential !== null) {
        points += 1;
        reasons.push(`Closing kick (+${paceFigures.closingKickDifferential} LP over EP1)`);
      }
    } else if (fieldPressure.pressure === 'soft') {
      // Closer in soft pace: penalty
      if (paceFigures.avgLatePace !== null && paceFigures.avgLatePace < LP_THRESHOLDS.GOOD) {
        points -= 2;
        reasons.push(
          `Moderate LP (${paceFigures.avgLatePace}) in soft pace - needs pace to close into`
        );
      }
    }
  }

  // LP trending up bonus for closers
  if (paceFigures.lpTrend === 'improving' && runningStyle === 'C') {
    points += 1;
    reasons.push('LP trending up');
  }

  // Pace mismatch penalty: slow closer in speed-favoring race
  if (
    paceFigures.avgLatePace !== null &&
    paceFigures.avgLatePace < LP_THRESHOLDS.MODERATE &&
    fieldPressure.pressure === 'soft' &&
    runningStyle === 'C'
  ) {
    points -= 2;
    reasons.push('Pace mismatch: slow closer in speed-favoring setup');
  }

  // Clamp to range
  points = Math.max(-5, Math.min(5, points));

  return {
    points,
    reasoning: reasons.length > 0 ? reasons.join(' | ') : 'No pace figure adjustments',
  };
}

// ============================================================================
// RUNNING STYLE DETECTION
// ============================================================================

/**
 * Analyze a single past performance to determine running style in that race
 */
function analyzeRaceRunningStyle(pp: PastPerformance): RunningStyleEvidence {
  const firstCallPosition =
    pp.runningLine.quarterMile ?? pp.runningLine.halfMile ?? pp.runningLine.start ?? pp.fieldSize;

  const lengthsBehindAtFirstCall =
    pp.runningLine.quarterMileLengths ?? pp.runningLine.halfMileLengths ?? null;

  const wasOnLead = firstCallPosition === 1;
  const fieldSize = pp.fieldSize || 10;

  // Determine style based on relative position
  let styleInRace: RunningStyleCode;
  const relativePosition = firstCallPosition / fieldSize;

  if (firstCallPosition <= 2 || relativePosition <= 0.2) {
    styleInRace = 'E'; // Early Speed - on or near lead
  } else if (firstCallPosition <= 4 || relativePosition <= 0.4) {
    // Check if maintaining position = Sustained, else Presser
    const stretchPosition = pp.runningLine.stretch ?? pp.finishPosition;
    const positionDiff = Math.abs(firstCallPosition - stretchPosition);
    if (positionDiff <= 1) {
      styleInRace = 'S'; // Sustained - maintained position
    } else {
      styleInRace = 'P'; // Presser - stalking
    }
  } else if (relativePosition >= 0.6) {
    styleInRace = 'C'; // Closer - back of pack
  } else {
    // Mid-pack - determine by late move
    const finishPosition = pp.finishPosition;
    if (finishPosition < firstCallPosition - 2) {
      styleInRace = 'C'; // Made a closing run
    } else if (finishPosition <= firstCallPosition + 1) {
      styleInRace = 'S'; // Sustained position
    } else {
      styleInRace = 'P'; // Presser
    }
  }

  return {
    raceDate: pp.date,
    track: pp.track,
    firstCallPosition,
    fieldSize,
    finishPosition: pp.finishPosition,
    styleInRace,
    wasOnLead,
    lengthsBehindAtFirstCall,
  };
}

/**
 * Parse running style from past performances
 * Analyzes last 3 races to determine dominant running style
 * Enhanced with EP1/LP pace figure analysis when available
 *
 * @param horse - The horse entry to analyze
 */
export function parseRunningStyle(horse: HorseEntry): RunningStyleProfile {
  const pastPerfs = horse.pastPerformances.slice(0, 10); // Up to last 10 for evidence

  if (pastPerfs.length === 0) {
    return {
      style: 'U',
      styleName: RUNNING_STYLE_NAMES['U'],
      confidence: 0,
      evidence: [],
      stats: {
        totalRaces: 0,
        timesOnLead: 0,
        timesInTop3Early: 0,
        avgFirstCallPosition: 0,
        avgLengthsBehindEarly: 0,
      },
      description: 'First-time starter or no past performances available',
      styleValidated: true, // No data to invalidate
      actualPattern: 'U',
    };
  }

  // Analyze pace figures first (EP1 and LP)
  const paceFigures = analyzePaceFigures(horse);

  // Analyze each race
  const evidence = pastPerfs.map((pp) => analyzeRaceRunningStyle(pp));

  // Focus on last 3 races for dominant style
  const recentEvidence = evidence.slice(0, 3);

  // Count styles in recent races
  const styleCounts: Record<RunningStyleCode, number> = {
    E: 0,
    P: 0,
    C: 0,
    S: 0,
    U: 0,
  };

  for (const ev of recentEvidence) {
    styleCounts[ev.styleInRace]++;
  }

  // Determine dominant style
  let dominantStyle: RunningStyleCode = 'U';
  let maxCount = 0;

  for (const [style, count] of Object.entries(styleCounts) as [RunningStyleCode, number][]) {
    if (style !== 'U' && count > maxCount) {
      maxCount = count;
      dominantStyle = style;
    }
  }

  // If no clear dominant style, use most recent race
  if (maxCount === 0 && evidence.length > 0) {
    const firstEvidence = evidence[0];
    if (firstEvidence) {
      dominantStyle = firstEvidence.styleInRace;
    }
  }

  // Use EP1 figures to validate/adjust running style classification
  // EP1 provides more accurate classification than just position analysis
  if (paceFigures.avgEarlyPace !== null) {
    if (paceFigures.isConfirmedSpeed && dominantStyle !== 'E') {
      // High EP1 (85+) overrides to Early Speed if not already classified
      if (dominantStyle === 'P' || dominantStyle === 'U') {
        dominantStyle = 'E';
      }
    } else if (paceFigures.isConfirmedCloser && dominantStyle !== 'C') {
      // Low EP1 (<75) or high LP (90+) indicates closer
      if (paceFigures.hasClosingKick && dominantStyle !== 'E') {
        dominantStyle = 'C';
      }
    }
  }

  // Calculate stats
  const timesOnLead = evidence.filter((e) => e.wasOnLead).length;
  const timesInTop3Early = evidence.filter((e) => e.firstCallPosition <= 3).length;
  const avgFirstCallPosition =
    evidence.reduce((sum, e) => sum + e.firstCallPosition, 0) / evidence.length;
  const lengthsData = evidence.filter((e) => e.lengthsBehindAtFirstCall !== null);
  const avgLengthsBehindEarly =
    lengthsData.length > 0
      ? lengthsData.reduce((sum, e) => sum + (e.lengthsBehindAtFirstCall ?? 0), 0) /
        lengthsData.length
      : 0;

  // Calculate confidence - boost if pace figures confirm the style
  let confidence = Math.min(
    100,
    Math.round(
      (recentEvidence.length / 3) * 50 + // More races = more confidence
        (maxCount / recentEvidence.length) * 50 // Consistency = more confidence
    )
  );

  // Boost confidence if pace figures confirm the running style
  if (paceFigures.avgEarlyPace !== null || paceFigures.avgLatePace !== null) {
    const styleConfirmedByPaceFigures =
      (dominantStyle === 'E' && paceFigures.isConfirmedSpeed) ||
      (dominantStyle === 'C' && (paceFigures.isConfirmedCloser || paceFigures.hasClosingKick));

    if (styleConfirmedByPaceFigures) {
      confidence = Math.min(100, confidence + 15);
    }
  }

  // Generate description with pace figure info
  let description = generateStyleDescription(
    dominantStyle,
    timesOnLead,
    timesInTop3Early,
    evidence.length
  );

  // Add pace figure context to description
  if (paceFigures.avgEarlyPace !== null) {
    description += ` | Avg EP1: ${paceFigures.avgEarlyPace}`;
  }
  if (paceFigures.avgLatePace !== null) {
    description += ` | Avg LP: ${paceFigures.avgLatePace}`;
  }
  if (paceFigures.hasClosingKick) {
    description += ` (closing kick +${paceFigures.closingKickDifferential})`;
  }

  // Validate running style using beaten lengths data
  const beatenLengthsProfile = buildBeatenLengthsProfile(pastPerfs);
  const styleValidation = validateRunningStyleWithLengths(horse);

  // Add beaten lengths info to description if relevant
  if (beatenLengthsProfile.racesWithData > 0 && beatenLengthsProfile.avgClosingVelocity !== null) {
    const vel = beatenLengthsProfile.avgClosingVelocity;
    if (vel >= 3) {
      description += ` | Strong closer (avg +${vel.toFixed(1)}L)`;
    } else if (vel <= -2) {
      description += ` | Fades late (avg ${vel.toFixed(1)}L)`;
    }
  }

  // Adjust confidence if style is validated by beaten lengths
  if (styleValidation.isValid && styleValidation.confidence > 50) {
    confidence = Math.min(100, confidence + 5);
  } else if (!styleValidation.isValid && styleValidation.confidence > 50) {
    // Style doesn't match lengths data - slight confidence reduction
    confidence = Math.max(30, confidence - 10);
  }

  return {
    style: dominantStyle,
    styleName: RUNNING_STYLE_NAMES[dominantStyle],
    confidence,
    evidence,
    stats: {
      totalRaces: evidence.length,
      timesOnLead,
      timesInTop3Early,
      avgFirstCallPosition: Math.round(avgFirstCallPosition * 10) / 10,
      avgLengthsBehindEarly: Math.round(avgLengthsBehindEarly * 10) / 10,
    },
    description,
    paceFigures, // Include pace figure analysis
    beatenLengthsProfile, // Include beaten lengths profile
    styleValidated: styleValidation.isValid,
    actualPattern: styleValidation.actualPattern,
  };
}

/**
 * Generate a human-readable description of running style
 */
function generateStyleDescription(
  style: RunningStyleCode,
  timesOnLead: number,
  timesInTop3Early: number,
  totalRaces: number
): string {
  if (totalRaces === 0) return 'No race history available';

  const leadPct = Math.round((timesOnLead / totalRaces) * 100);
  const top3Pct = Math.round((timesInTop3Early / totalRaces) * 100);

  switch (style) {
    case 'E':
      return `Early Speed - Led in ${timesOnLead} of ${totalRaces} starts (${leadPct}%)`;
    case 'P':
      return `Presser - In top 3 early in ${timesInTop3Early} of ${totalRaces} starts (${top3Pct}%)`;
    case 'C':
      return `Closer - Makes late run, typically mid-pack or worse early`;
    case 'S':
      return `Sustained Speed - Maintains position throughout the race`;
    default:
      return `Unknown running style - insufficient data`;
  }
}

// ============================================================================
// PACE PRESSURE INDEX (PPI) CALCULATION
// ============================================================================

/**
 * Calculate Pace Pressure Index for a race
 * PPI = (Early Speed Count / Field Size) × 100
 */
export function calculatePPI(earlySpeedCount: number, fieldSize: number): number {
  if (fieldSize === 0) return 0;
  return Math.round((earlySpeedCount / fieldSize) * 100);
}

/**
 * Determine pace scenario from PPI
 */
export function getPaceScenarioFromPPI(ppi: number): PaceScenarioType {
  if (ppi < 20) return 'soft';
  if (ppi <= 35) return 'moderate';
  if (ppi <= 50) return 'contested';
  return 'speed_duel';
}

/**
 * Analyze the pace scenario for an entire field
 *
 * @param horses - All horses in the race
 */
export function analyzePaceScenario(horses: HorseEntry[]): PaceScenarioAnalysis {
  // Filter out scratched horses
  const activeHorses = horses.filter((h) => !h.isScratched);
  const fieldSize = activeHorses.length;

  if (fieldSize === 0) {
    return {
      scenario: 'unknown',
      label: PACE_SCENARIO_LABELS['unknown'],
      color: PACE_SCENARIO_COLORS['unknown'],
      ppi: 0,
      styleBreakdown: {
        earlySpeed: [],
        pressers: [],
        closers: [],
        sustained: [],
        unknown: [],
      },
      fieldSize: 0,
      expectedPace: 'Unknown',
      description: 'No active horses in field',
    };
  }

  // Analyze each horse's running style
  const styleBreakdown: PaceScenarioAnalysis['styleBreakdown'] = {
    earlySpeed: [],
    pressers: [],
    closers: [],
    sustained: [],
    unknown: [],
  };

  for (const horse of activeHorses) {
    const profile = parseRunningStyle(horse);
    const progNum = horse.programNumber;

    switch (profile.style) {
      case 'E':
        styleBreakdown.earlySpeed.push(progNum);
        break;
      case 'P':
        styleBreakdown.pressers.push(progNum);
        break;
      case 'C':
        styleBreakdown.closers.push(progNum);
        break;
      case 'S':
        styleBreakdown.sustained.push(progNum);
        break;
      default:
        styleBreakdown.unknown.push(progNum);
    }
  }

  // Calculate PPI
  const earlySpeedCount = styleBreakdown.earlySpeed.length;
  const ppi = calculatePPI(earlySpeedCount, fieldSize);

  // Determine scenario (may be adjusted based on EP1 data below)
  const scenario = getPaceScenarioFromPPI(ppi);

  // Generate expected pace and description
  const { expectedPace, description } = generatePaceDescription(
    scenario,
    earlySpeedCount,
    styleBreakdown.pressers.length,
    styleBreakdown.closers.length,
    fieldSize
  );

  // Calculate field pace pressure using EP1 figures
  const pacePressure = getFieldPacePressure(activeHorses);

  // If pace pressure analysis has high confidence, it may override the PPI-based scenario
  // This provides more accurate pace projection when EP1 data is available
  let adjustedScenario = scenario;
  let adjustedDescription = description;

  if (pacePressure.dataConfidence >= 70) {
    // High confidence EP1 data available - use it to refine scenario
    const pressureToScenario: Record<typeof pacePressure.pressure, PaceScenarioType> = {
      soft: 'soft',
      moderate: 'moderate',
      contested: 'contested',
      duel: 'speed_duel',
    };
    adjustedScenario = pressureToScenario[pacePressure.pressure];
    adjustedDescription = `${description} | EP1 Analysis: ${pacePressure.description}`;
  }

  return {
    scenario: adjustedScenario,
    label: PACE_SCENARIO_LABELS[adjustedScenario],
    color: PACE_SCENARIO_COLORS[adjustedScenario],
    ppi,
    styleBreakdown,
    fieldSize,
    expectedPace,
    description: adjustedDescription,
    pacePressure, // Include field pace pressure analysis
  };
}

/**
 * Generate pace description based on scenario
 */
function generatePaceDescription(
  scenario: PaceScenarioType,
  earlyCount: number,
  presserCount: number,
  _closerCount: number,
  fieldSize: number
): { expectedPace: string; description: string } {
  switch (scenario) {
    case 'soft':
      if (earlyCount === 0) {
        return {
          expectedPace: 'Very Slow',
          description: `No confirmed early speed - expect very slow pace. Closers may struggle.`,
        };
      }
      return {
        expectedPace: 'Slow',
        description: `Only ${earlyCount} speed horse(s) in ${fieldSize}-horse field. Lone speed could steal on easy lead.`,
      };

    case 'moderate':
      return {
        expectedPace: 'Honest',
        description: `${earlyCount} speed, ${presserCount} pressers - balanced pace expected. Tactical race likely.`,
      };

    case 'contested':
      return {
        expectedPace: 'Fast',
        description: `${earlyCount} speed horses likely to pressure each other. Good setup for closers.`,
      };

    case 'speed_duel':
      return {
        expectedPace: 'Very Fast',
        description: `${earlyCount} speed horses will battle early - pace suicide likely. Strong closer advantage.`,
      };

    default:
      return {
        expectedPace: 'Unknown',
        description: 'Unable to analyze pace scenario',
      };
  }
}

// ============================================================================
// TACTICAL ADVANTAGE CALCULATION
// ============================================================================

/**
 * Tactical advantage points based on pace scenario
 *
 * Soft Pace (lone speed):
 * - Early Speed: +25 pts (wire-to-wire advantage)
 * - Presser: +15 pts (perfect stalking position)
 * - Closer: +5 pts (pace too slow to set up)
 *
 * Moderate Pace (balanced):
 * - Early Speed: +12 pts
 * - Presser: +20 pts (ideal scenario)
 * - Closer: +15 pts
 *
 * Contested Pace (speed duel likely):
 * - Early Speed: +5 pts (will tire from battle)
 * - Presser: +25 pts (perfect setup)
 * - Closer: +20 pts (strong late run setup)
 *
 * Speed Duel (multiple speed):
 * - Early Speed: -5 pts (pace suicide) -> 0 minimum
 * - Presser: +15 pts
 * - Closer: +25 pts (maximize advantage)
 */
export function calculateTacticalAdvantage(
  style: RunningStyleCode,
  scenario: PaceScenarioType
): TacticalAdvantage {
  // Point matrix
  const advantageMatrix: Record<PaceScenarioType, Record<RunningStyleCode, number>> = {
    soft: { E: 25, P: 15, C: 5, S: 18, U: 10 },
    moderate: { E: 12, P: 20, C: 15, S: 15, U: 12 },
    contested: { E: 5, P: 25, C: 20, S: 12, U: 12 },
    speed_duel: { E: 0, P: 15, C: 25, S: 8, U: 10 },
    unknown: { E: 12, P: 12, C: 12, S: 12, U: 10 },
  };

  const points = Math.max(0, advantageMatrix[scenario][style]);

  // Determine advantage level
  let level: TacticalAdvantage['level'];
  if (points >= 23) level = 'excellent';
  else if (points >= 18) level = 'good';
  else if (points >= 12) level = 'neutral';
  else if (points >= 5) level = 'poor';
  else level = 'terrible';

  // Generate fit and reasoning
  const { fit, reasoning } = generateTacticalReasoning(style, scenario, points);

  return {
    points,
    level,
    fit,
    reasoning,
  };
}

/**
 * Generate tactical fit description
 */
function generateTacticalReasoning(
  style: RunningStyleCode,
  scenario: PaceScenarioType,
  points: number
): { fit: string; reasoning: string } {
  const styleName = RUNNING_STYLE_NAMES[style];

  // Specific scenario/style combinations
  if (style === 'E' && scenario === 'soft') {
    return {
      fit: 'Excellent fit - lone speed in soft pace',
      reasoning: `${styleName} should have clear lead with minimal pressure. Wire-to-wire opportunity.`,
    };
  }

  if (style === 'E' && scenario === 'speed_duel') {
    return {
      fit: 'Poor fit - speed in speed duel',
      reasoning: `${styleName} faces pace suicide - multiple speed horses will burn each other out.`,
    };
  }

  if (style === 'C' && scenario === 'speed_duel') {
    return {
      fit: 'Excellent fit - closer in speed duel',
      reasoning: `${styleName} benefits from fast early pace. Speed horses will tire, setting up strong close.`,
    };
  }

  if (style === 'C' && scenario === 'soft') {
    return {
      fit: 'Poor fit - closer in soft pace',
      reasoning: `${styleName} needs pace to close into. Slow early fractions will make it difficult to rally.`,
    };
  }

  if (style === 'P' && (scenario === 'contested' || scenario === 'moderate')) {
    return {
      fit: 'Excellent fit - presser in balanced pace',
      reasoning: `${styleName} can stalk the pace and pounce when speed tires. Ideal tactical position.`,
    };
  }

  if (style === 'S') {
    return {
      fit: points >= 15 ? 'Good fit' : 'Neutral fit',
      reasoning: `${styleName} maintains position throughout. Can adapt to most pace scenarios.`,
    };
  }

  // Default reasoning
  if (points >= 20) {
    return {
      fit: 'Good fit',
      reasoning: `${styleName} should benefit from the ${PACE_SCENARIO_LABELS[scenario]} pace scenario.`,
    };
  } else if (points >= 12) {
    return {
      fit: 'Neutral fit',
      reasoning: `${styleName} has no particular advantage or disadvantage in this pace scenario.`,
    };
  } else {
    return {
      fit: 'Poor fit',
      reasoning: `${styleName} may struggle in this ${PACE_SCENARIO_LABELS[scenario]} pace scenario.`,
    };
  }
}

// ============================================================================
// COMPLETE PACE ANALYSIS
// ============================================================================

/**
 * Perform complete pace analysis for a horse within a race context
 *
 * @param horse - The horse entry to analyze
 * @param allHorses - All horses in the race
 * @param preCalculatedScenario - Optional pre-calculated pace scenario
 */
export function analyzePaceForHorse(
  horse: HorseEntry,
  allHorses: HorseEntry[],
  preCalculatedScenario?: PaceScenarioAnalysis
): PaceAnalysisResult {
  // Get horse's running style profile
  const profile = parseRunningStyle(horse);

  // Get field pace scenario (use pre-calculated if available)
  const scenario = preCalculatedScenario ?? analyzePaceScenario(allHorses);

  // Calculate tactical advantage
  const tactical = calculateTacticalAdvantage(profile.style, scenario.scenario);

  // Calculate total pace score
  // Base score from tactical advantage (0-25)
  // Additional points from confidence (0-5)
  // Additional points from evidence quality (0-10)
  const confidenceBonus = Math.round((profile.confidence / 100) * 5);
  const evidenceBonus = Math.min(10, Math.round((profile.stats.totalRaces / 5) * 10));

  let totalScore = Math.min(40, tactical.points + confidenceBonus + evidenceBonus);

  // Apply pace figure adjustments if available (±5 pts)
  // This integrates EP1/LP figures into tactical scoring
  if (profile.paceFigures && scenario.pacePressure) {
    const paceFigureAdj = calculatePaceFigureAdjustment(
      profile.paceFigures,
      scenario.pacePressure,
      profile.style
    );

    totalScore = Math.min(40, Math.max(0, totalScore + paceFigureAdj.points));

    // Add pace figure reasoning to tactical advantage
    if (paceFigureAdj.points !== 0) {
      tactical.reasoning = `${tactical.reasoning} | ${paceFigureAdj.reasoning}`;
    }
  }

  return {
    profile,
    scenario,
    tactical,
    totalScore,
  };
}

/**
 * Analyze pace for all horses in a race efficiently
 * Pre-calculates scenario once for performance
 *
 * @param horses - All horses in the race
 */
export function analyzeRacePace(horses: HorseEntry[]): Map<number, PaceAnalysisResult> {
  // Pre-calculate scenario once
  const scenario = analyzePaceScenario(horses);

  const results = new Map<number, PaceAnalysisResult>();

  for (const horse of horses) {
    results.set(horse.programNumber, analyzePaceForHorse(horse, horses, scenario));
  }

  return results;
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format running style breakdown for display
 * Returns: "E: #3, #7 | P: #2, #5, #8 | C: #1, #4, #6"
 */
export function formatStyleBreakdown(breakdown: PaceScenarioAnalysis['styleBreakdown']): string {
  const parts: string[] = [];

  if (breakdown.earlySpeed.length > 0) {
    parts.push(`E: ${breakdown.earlySpeed.map((n) => `#${n}`).join(', ')}`);
  }
  if (breakdown.pressers.length > 0) {
    parts.push(`P: ${breakdown.pressers.map((n) => `#${n}`).join(', ')}`);
  }
  if (breakdown.closers.length > 0) {
    parts.push(`C: ${breakdown.closers.map((n) => `#${n}`).join(', ')}`);
  }
  if (breakdown.sustained.length > 0) {
    parts.push(`S: ${breakdown.sustained.map((n) => `#${n}`).join(', ')}`);
  }

  return parts.join(' | ') || 'No style data available';
}

/**
 * Get compact pace scenario summary for card display
 */
export function getPaceScenarioSummary(scenario: PaceScenarioAnalysis): {
  label: string;
  color: string;
  ppi: number;
  shortDescription: string;
} {
  return {
    label: scenario.label,
    color: scenario.color,
    ppi: scenario.ppi,
    shortDescription: scenario.expectedPace,
  };
}

/**
 * Get running style badge display info
 */
export function getRunningStyleBadge(profile: RunningStyleProfile): {
  code: RunningStyleCode;
  name: string;
  color: string;
  confidence: number;
} {
  // Color based on style
  const styleColors: Record<RunningStyleCode, string> = {
    E: '#ef4444', // Red for early speed
    P: '#f97316', // Orange for presser
    C: '#3b82f6', // Blue for closer
    S: '#8b5cf6', // Purple for sustained
    U: '#888888', // Gray for unknown
  };

  return {
    code: profile.style,
    name: profile.styleName,
    color: styleColors[profile.style],
    confidence: profile.confidence,
  };
}
