/**
 * Data Completeness Calculator
 *
 * Calculates and exposes what percentage of scoreable data each horse actually has.
 * This infrastructure enables understanding of data quality before scoring changes.
 *
 * TIER DEFINITIONS:
 * - CRITICAL (50% weight): Must have for reliable score
 * - HIGH (30% weight): Significantly impacts accuracy
 * - MEDIUM (15% weight): Improves accuracy
 * - LOW (5% weight): Nice to have
 *
 * NO SCORING CHANGES - This is infrastructure only
 */

import { logger } from '../../services/logging';
import type { HorseEntry, RaceHeader } from '../../types/drf';
import type {
  DataCompletenessResult,
  DataCompletenessGrade,
  SpeedFiguresPresence,
  PastPerformancesPresence,
  TrainerStatsPresence,
  JockeyStatsPresence,
  PaceFiguresPresence,
  RunningStylePresence,
  TrackRecordPresence,
  DistanceRecordPresence,
  SurfaceRecordPresence,
  FieldPresenceResult,
} from '../../types/scoring';
import { DATA_TIER_WEIGHTS, LOW_CONFIDENCE_THRESHOLD } from '../../types/scoring';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Tier weights for calculating overall completeness score
 */
const TIER_WEIGHTS: typeof DATA_TIER_WEIGHTS = {
  critical: 50,
  high: 30,
  medium: 15,
  low: 5,
};

/**
 * Minimum thresholds for data presence
 */
const THRESHOLDS = {
  /** Minimum Beyers needed in last 3 for "has speed figures" */
  MIN_BEYERS_REQUIRED: 1,
  /** Minimum past performances for "has PPs" */
  MIN_PPS_REQUIRED: 3,
  /** Days since last race to require workouts */
  LAYOFF_DAYS_FOR_WORKOUT_REQUIREMENT: 60,
  /** Minimum workouts required after layoff */
  MIN_WORKOUTS_AFTER_LAYOFF: 1,
} as const;

// ============================================================================
// FIELD PRESENCE CHECK FUNCTIONS
// ============================================================================

/**
 * Check if horse has valid speed figures (Beyer) in last 3 races
 * Handles: null, undefined, NaN, and distinguishes 0 (valid) from missing
 */
export function hasValidSpeedFigures(horse: HorseEntry): SpeedFiguresPresence {
  const pps = horse.pastPerformances || [];
  const last3 = pps.slice(0, 3);

  let count = 0;
  let bestBeyer: number | null = null;
  let sum = 0;

  for (const pp of last3) {
    const beyer = pp?.speedFigures?.beyer;

    // Beyer of 0 is valid data, null/undefined/NaN is missing
    if (beyer !== null && beyer !== undefined && !isNaN(beyer)) {
      count++;
      sum += beyer;
      if (bestBeyer === null || beyer > bestBeyer) {
        bestBeyer = beyer;
      }
    }
  }

  return {
    present: count >= THRESHOLDS.MIN_BEYERS_REQUIRED,
    count,
    bestBeyer,
    averageBeyer: count > 0 ? Math.round(sum / count) : null,
  };
}

/**
 * Check if horse has valid past performances
 * At least 3 PPs for reliable scoring
 */
export function hasValidPastPerformances(horse: HorseEntry): PastPerformancesPresence {
  const pps = horse.pastPerformances || [];

  let validCount = 0;
  let withFinishPositions = 0;

  for (const pp of pps) {
    if (pp && pp.date && pp.track) {
      validCount++;

      // Check if finish position is present and valid
      if (
        pp.finishPosition !== null &&
        pp.finishPosition !== undefined &&
        !isNaN(pp.finishPosition) &&
        pp.finishPosition > 0
      ) {
        withFinishPositions++;
      }
    }
  }

  return {
    present: validCount >= THRESHOLDS.MIN_PPS_REQUIRED,
    count: validCount,
    withFinishPositions,
  };
}

/**
 * Check if finish positions are available in last 3 races
 */
export function hasValidFinishPositions(horse: HorseEntry): FieldPresenceResult {
  const pps = horse.pastPerformances || [];
  const last3 = pps.slice(0, 3);

  let validCount = 0;
  for (const pp of last3) {
    if (
      pp?.finishPosition !== null &&
      pp?.finishPosition !== undefined &&
      !isNaN(pp.finishPosition) &&
      pp.finishPosition > 0
    ) {
      validCount++;
    }
  }

  // Need at least 1 finish position in last 3
  return {
    present: validCount >= 1,
    count: validCount,
  };
}

/**
 * Check if race class level is parseable from race header
 */
export function hasValidClassLevel(
  horse: HorseEntry,
  raceHeader?: RaceHeader
): FieldPresenceResult {
  // Check race header classification
  if (raceHeader) {
    const classification = raceHeader.classification;
    if (classification && classification !== 'unknown') {
      return { present: true };
    }
  }

  // Fallback: check if we can determine class from past performances
  const pps = horse.pastPerformances || [];
  if (pps.length > 0) {
    const recentPP = pps[0];
    if (recentPP?.classification && recentPP.classification !== 'unknown') {
      return { present: true };
    }
  }

  return { present: false };
}

/**
 * Check if trainer stats are present
 * Considers both meet stats (preferred) and career stats (fallback)
 */
export function hasValidTrainerStats(horse: HorseEntry): TrainerStatsPresence {
  const meetStarts = horse.trainerMeetStarts ?? 0;

  // Check if career stats are available (from trainer string parsing)
  const hasCareerStats =
    horse.trainerStats !== null &&
    horse.trainerStats !== undefined &&
    horse.trainerStats !== '' &&
    horse.trainerStats.length > 0;

  // Consider present if has meet starts OR has career stats string
  // 0 meet starts is valid data (shipper), null/undefined is missing
  const hasMeetData = horse.trainerMeetStarts !== null && horse.trainerMeetStarts !== undefined;

  return {
    present: hasMeetData || hasCareerStats,
    meetStarts,
    hasCareerStats,
  };
}

/**
 * Check if jockey stats are present
 * Considers both meet stats (preferred) and career stats (fallback)
 */
export function hasValidJockeyStats(horse: HorseEntry): JockeyStatsPresence {
  const meetStarts = horse.jockeyMeetStarts ?? 0;

  // Check if career stats are available
  const hasCareerStats =
    horse.jockeyStats !== null &&
    horse.jockeyStats !== undefined &&
    horse.jockeyStats !== '' &&
    horse.jockeyStats.length > 0;

  // Consider present if has meet starts OR has career stats string
  const hasMeetData = horse.jockeyMeetStarts !== null && horse.jockeyMeetStarts !== undefined;

  return {
    present: hasMeetData || hasCareerStats,
    meetStarts,
    hasCareerStats,
  };
}

/**
 * Check if running style is classified
 */
export function hasValidRunningStyle(horse: HorseEntry): RunningStylePresence {
  const style = horse.runningStyle;

  // Valid styles: E, E/P, P, S, C (or variations)
  const validStyles = ['E', 'E/P', 'EP', 'E-P', 'P', 'S', 'C', 'PS'];

  const isValid =
    style !== null &&
    style !== undefined &&
    style !== '' &&
    (validStyles.includes(style.toUpperCase()) || style.length > 0);

  return {
    present: isValid,
    style: isValid ? style : null,
  };
}

/**
 * Check if days since last race is available
 */
export function hasValidDaysSinceLastRace(horse: HorseEntry): FieldPresenceResult {
  const days = horse.daysSinceLastRace;

  // 0 days is valid (racing back same day), null/undefined/NaN is missing
  const isValid = days !== null && days !== undefined && !isNaN(days) && days >= 0;

  return {
    present: isValid,
    count: isValid ? 1 : 0,
  };
}

/**
 * Check if workouts are present
 * Required if layoff > 60 days
 */
export function hasValidWorkouts(horse: HorseEntry): FieldPresenceResult {
  const workouts = horse.workouts || [];
  const validWorkouts = workouts.filter(
    (w) => w && w.date && (w.timeSeconds > 0 || w.timeFormatted)
  );

  const count = validWorkouts.length;
  const days = horse.daysSinceLastRace ?? 0;

  // If layoff > 60 days, require at least 1 workout
  if (days > THRESHOLDS.LAYOFF_DAYS_FOR_WORKOUT_REQUIREMENT) {
    return {
      present: count >= THRESHOLDS.MIN_WORKOUTS_AFTER_LAYOFF,
      count,
    };
  }

  // Otherwise, any workout data is a bonus
  return {
    present: count > 0,
    count,
  };
}

/**
 * Check if pace figures (EP1/LP) are present
 */
export function hasValidPaceFigures(horse: HorseEntry): PaceFiguresPresence {
  const pps = horse.pastPerformances || [];
  const last3 = pps.slice(0, 3);

  let ep1Count = 0;
  let lpCount = 0;

  for (const pp of last3) {
    if (pp?.earlyPace1 !== null && pp?.earlyPace1 !== undefined && !isNaN(pp.earlyPace1)) {
      ep1Count++;
    }
    if (pp?.latePace !== null && pp?.latePace !== undefined && !isNaN(pp.latePace)) {
      lpCount++;
    }
  }

  return {
    present: ep1Count > 0 || lpCount > 0,
    ep1Count,
    lpCount,
  };
}

/**
 * Check if track record at today's track is available
 */
export function hasValidTrackRecord(horse: HorseEntry, _trackCode: string): TrackRecordPresence {
  const starts = horse.trackStarts ?? 0;

  // 0 starts is valid data (no experience at track)
  const hasData = horse.trackStarts !== null && horse.trackStarts !== undefined;

  return {
    present: hasData,
    starts,
  };
}

/**
 * Check if distance record is available
 */
export function hasValidDistanceRecord(
  horse: HorseEntry,
  _distance: number
): DistanceRecordPresence {
  const starts = horse.distanceStarts ?? 0;

  // 0 starts is valid data (no experience at distance)
  const hasData = horse.distanceStarts !== null && horse.distanceStarts !== undefined;

  return {
    present: hasData,
    starts,
  };
}

/**
 * Check if surface record is available
 */
export function hasValidSurfaceRecord(horse: HorseEntry, surface: string): SurfaceRecordPresence {
  // For turf, check turfStarts
  if (surface.toLowerCase() === 'turf') {
    const starts = horse.turfStarts ?? 0;
    const hasData = horse.turfStarts !== null && horse.turfStarts !== undefined;

    return {
      present: hasData,
      starts,
    };
  }

  // For dirt, check surfaceStarts
  const starts = horse.surfaceStarts ?? 0;
  const hasData = horse.surfaceStarts !== null && horse.surfaceStarts !== undefined;

  return {
    present: hasData,
    starts,
  };
}

/**
 * Check if wet track record is available
 */
export function hasValidWetTrackRecord(horse: HorseEntry): SurfaceRecordPresence {
  const starts = horse.wetStarts ?? 0;

  // 0 starts is valid data (no wet track experience)
  const hasData = horse.wetStarts !== null && horse.wetStarts !== undefined;

  return {
    present: hasData,
    starts,
  };
}

/**
 * Check if trainer category stats are available
 */
export function hasValidTrainerCategoryStats(horse: HorseEntry): FieldPresenceResult {
  const stats = horse.trainerCategoryStats;

  if (!stats) {
    return { present: false };
  }

  // Check if any category has data
  const categories = [
    stats.firstTimeLasix,
    stats.firstTimeBlinkers,
    stats.secondOffLayoff,
    stats.sprintToRoute,
    stats.routeToSprint,
    stats.wetTrack,
  ];

  const hasAnyData = categories.some((cat) => cat && (cat.starts > 0 || cat.wins > 0));

  return {
    present: hasAnyData,
    count: categories.filter((c) => c && c.starts > 0).length,
  };
}

/**
 * Check if equipment data is available
 */
export function hasValidEquipment(horse: HorseEntry): FieldPresenceResult {
  const equip = horse.equipment;

  if (!equip) {
    return { present: false };
  }

  // Check if any equipment info is present
  const hasData =
    equip.raw !== '' ||
    equip.blinkers ||
    equip.blinkersOff ||
    equip.frontBandages ||
    equip.tongueTie ||
    equip.nasalStrip ||
    (equip.firstTimeEquipment && equip.firstTimeEquipment.length > 0) ||
    (equip.equipmentChanges && equip.equipmentChanges.length > 0);

  return { present: hasData };
}

/**
 * Check if breeding data is available
 */
export function hasValidBreeding(horse: HorseEntry): FieldPresenceResult {
  const breeding = horse.breeding;

  if (!breeding) {
    return { present: false };
  }

  // Must have at least sire and dam
  const hasData =
    breeding.sire !== null &&
    breeding.sire !== undefined &&
    breeding.sire !== '' &&
    breeding.dam !== null &&
    breeding.dam !== undefined &&
    breeding.dam !== '';

  return { present: hasData };
}

/**
 * Check if weight change data is available
 */
export function hasValidWeightChanges(horse: HorseEntry): FieldPresenceResult {
  // Current weight
  const currentWeight = horse.weight;

  // Last race weight from past performances
  const pps = horse.pastPerformances || [];
  const lastWeight = pps.length > 0 ? pps[0]?.weight : null;

  const hasData =
    currentWeight !== null &&
    currentWeight !== undefined &&
    currentWeight > 0 &&
    lastWeight !== null &&
    lastWeight !== undefined &&
    lastWeight > 0;

  return { present: hasData };
}

/**
 * Check if claiming price history is available
 */
export function hasValidClaimingPriceHistory(horse: HorseEntry): FieldPresenceResult {
  const pps = horse.pastPerformances || [];

  // Check if any PPs have claiming price data
  const hasData = pps.some(
    (pp) => pp?.claimingPrice !== null && pp?.claimingPrice !== undefined && pp.claimingPrice > 0
  );

  return { present: hasData };
}

/**
 * Check if lifetime earnings are available
 */
export function hasValidLifetimeEarnings(horse: HorseEntry): FieldPresenceResult {
  const earnings = horse.lifetimeEarnings;

  // 0 earnings is valid (maiden), null/undefined is missing
  const hasData = earnings !== null && earnings !== undefined && !isNaN(earnings);

  return { present: hasData };
}

// ============================================================================
// TIER COMPLETENESS CALCULATORS
// ============================================================================

/**
 * Calculate critical tier completeness (50% of overall)
 *
 * CRITICAL FIELDS:
 * - Speed figures (Beyer) — at least 1 of last 3 races
 * - Past performances — at least 3 races
 * - Finish positions — last 3 races
 * - Class level — today's race type parseable
 */
function calculateCriticalCompleteness(
  horse: HorseEntry,
  raceHeader?: RaceHeader
): {
  percentage: number;
  missing: string[];
  details: NonNullable<DataCompletenessResult['details']>['critical'];
} {
  const fields = {
    speedFigures: hasValidSpeedFigures(horse),
    pastPerformances: hasValidPastPerformances(horse),
    finishPositions: hasValidFinishPositions(horse),
    classLevel: hasValidClassLevel(horse, raceHeader),
  };

  const missing: string[] = [];
  let present = 0;
  const total = 4;

  if (fields.speedFigures.present) {
    present++;
  } else {
    missing.push('Speed Figures');
  }

  if (fields.pastPerformances.present) {
    present++;
  } else {
    missing.push('Past Performances');
  }

  if (fields.finishPositions.present) {
    present++;
  } else {
    missing.push('Finish Positions');
  }

  if (fields.classLevel.present) {
    present++;
  } else {
    missing.push('Class Level');
  }

  return {
    percentage: Math.round((present / total) * 100),
    missing,
    details: fields,
  };
}

/**
 * Calculate high tier completeness (30% of overall)
 *
 * HIGH FIELDS:
 * - Trainer meet stats (starts, wins)
 * - Jockey meet stats (starts, wins)
 * - Running style classification
 * - Days since last race
 * - Workouts (at least 1 if layoff > 60 days)
 */
function calculateHighCompleteness(horse: HorseEntry): {
  percentage: number;
  missing: string[];
  details: NonNullable<DataCompletenessResult['details']>['high'];
} {
  const fields = {
    trainerStats: hasValidTrainerStats(horse),
    jockeyStats: hasValidJockeyStats(horse),
    runningStyle: hasValidRunningStyle(horse),
    daysSinceLastRace: hasValidDaysSinceLastRace(horse),
    workouts: hasValidWorkouts(horse),
  };

  const missing: string[] = [];
  let present = 0;
  const total = 5;

  if (fields.trainerStats.present) {
    present++;
  } else {
    missing.push('Trainer Stats');
  }

  if (fields.jockeyStats.present) {
    present++;
  } else {
    missing.push('Jockey Stats');
  }

  if (fields.runningStyle.present) {
    present++;
  } else {
    missing.push('Running Style');
  }

  if (fields.daysSinceLastRace.present) {
    present++;
  } else {
    missing.push('Days Since Last Race');
  }

  if (fields.workouts.present) {
    present++;
  } else {
    // Only add to missing if it's actually required (layoff > 60 days)
    const days = horse.daysSinceLastRace ?? 0;
    if (days > THRESHOLDS.LAYOFF_DAYS_FOR_WORKOUT_REQUIREMENT) {
      missing.push('Workouts');
    } else {
      // Consider present if not required
      present++;
    }
  }

  return {
    percentage: Math.round((present / total) * 100),
    missing,
    details: fields,
  };
}

/**
 * Calculate medium tier completeness (15% of overall)
 *
 * MEDIUM FIELDS:
 * - Track record at today's track
 * - Distance record
 * - Surface record (turf/dirt)
 * - Wet track record
 * - Early pace figures (EP1)
 * - Late pace figures (LP)
 * - Trainer category stats
 * - Equipment data
 */
function calculateMediumCompleteness(
  horse: HorseEntry,
  raceHeader?: RaceHeader
): {
  percentage: number;
  details: NonNullable<DataCompletenessResult['details']>['medium'];
} {
  const trackCode = raceHeader?.trackCode ?? '';
  const distance = raceHeader?.distanceFurlongs ?? 0;
  const surface = raceHeader?.surface ?? 'dirt';
  const paceFigures = hasValidPaceFigures(horse);

  const fields = {
    trackRecord: hasValidTrackRecord(horse, trackCode),
    distanceRecord: hasValidDistanceRecord(horse, distance),
    surfaceRecord: hasValidSurfaceRecord(horse, surface),
    wetTrackRecord: hasValidWetTrackRecord(horse),
    earlyPaceFigures: { present: paceFigures.ep1Count > 0, count: paceFigures.ep1Count },
    latePaceFigures: { present: paceFigures.lpCount > 0, count: paceFigures.lpCount },
    trainerCategoryStats: hasValidTrainerCategoryStats(horse),
    equipment: hasValidEquipment(horse),
  };

  let present = 0;
  const total = 8;

  if (fields.trackRecord.present) present++;
  if (fields.distanceRecord.present) present++;
  if (fields.surfaceRecord.present) present++;
  if (fields.wetTrackRecord.present) present++;
  if (fields.earlyPaceFigures.present) present++;
  if (fields.latePaceFigures.present) present++;
  if (fields.trainerCategoryStats.present) present++;
  if (fields.equipment.present) present++;

  return {
    percentage: Math.round((present / total) * 100),
    details: fields,
  };
}

/**
 * Calculate low tier completeness (5% of overall)
 *
 * LOW FIELDS:
 * - Breeding data
 * - Weight changes
 * - Claiming price history
 * - Lifetime earnings
 */
function calculateLowCompleteness(horse: HorseEntry): {
  percentage: number;
  details: NonNullable<DataCompletenessResult['details']>['low'];
} {
  const fields = {
    breeding: hasValidBreeding(horse),
    weightChanges: hasValidWeightChanges(horse),
    claimingPriceHistory: hasValidClaimingPriceHistory(horse),
    lifetimeEarnings: hasValidLifetimeEarnings(horse),
  };

  let present = 0;
  const total = 4;

  if (fields.breeding.present) present++;
  if (fields.weightChanges.present) present++;
  if (fields.claimingPriceHistory.present) present++;
  if (fields.lifetimeEarnings.present) present++;

  return {
    percentage: Math.round((present / total) * 100),
    details: fields,
  };
}

/**
 * Calculate overall grade from score
 */
function calculateGrade(score: number): DataCompletenessGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Build confidence reason string
 */
function buildConfidenceReason(missingCritical: string[], criticalComplete: number): string | null {
  if (criticalComplete >= LOW_CONFIDENCE_THRESHOLD) {
    return null;
  }

  if (missingCritical.length === 0) {
    return 'Insufficient critical data';
  }

  if (missingCritical.length === 1) {
    return `Missing ${missingCritical[0]}`;
  }

  if (missingCritical.length === 2) {
    return `Missing ${missingCritical[0]} and ${missingCritical[1]}`;
  }

  return `Missing ${missingCritical.slice(0, -1).join(', ')}, and ${missingCritical[missingCritical.length - 1]}`;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Calculate data completeness for a horse
 *
 * Analyzes all data fields and categorizes them by importance tier,
 * then calculates weighted overall completeness score.
 *
 * @param horse - The horse entry to analyze
 * @param raceHeader - Optional race header for context-specific checks
 * @returns Complete data completeness analysis result
 */
export function calculateDataCompleteness(
  horse: HorseEntry,
  raceHeader?: RaceHeader
): DataCompletenessResult {
  try {
    // Calculate each tier
    const critical = calculateCriticalCompleteness(horse, raceHeader);
    const high = calculateHighCompleteness(horse);
    const medium = calculateMediumCompleteness(horse, raceHeader);
    const low = calculateLowCompleteness(horse);

    // Calculate weighted overall score
    // Weights: Critical 50%, High 30%, Medium 15%, Low 5%
    const overallScore = Math.round(
      (critical.percentage * TIER_WEIGHTS.critical) / 100 +
        (high.percentage * TIER_WEIGHTS.high) / 100 +
        (medium.percentage * TIER_WEIGHTS.medium) / 100 +
        (low.percentage * TIER_WEIGHTS.low) / 100
    );

    // Determine grade
    const overallGrade = calculateGrade(overallScore);

    // Build quick flags from critical/high tier checks
    const speedFigures = hasValidSpeedFigures(horse);
    const pastPerformances = hasValidPastPerformances(horse);
    const trainerStats = hasValidTrainerStats(horse);
    const jockeyStats = hasValidJockeyStats(horse);
    const runningStyle = hasValidRunningStyle(horse);
    const paceFigures = hasValidPaceFigures(horse);

    // Determine confidence
    const isLowConfidence = critical.percentage < LOW_CONFIDENCE_THRESHOLD;
    const confidenceReason = buildConfidenceReason(critical.missing, critical.percentage);

    return {
      // Overall metrics
      overallScore,
      overallGrade,

      // Tier completeness
      criticalComplete: critical.percentage,
      highComplete: high.percentage,
      mediumComplete: medium.percentage,
      lowComplete: low.percentage,

      // Quick flags
      hasSpeedFigures: speedFigures.present,
      hasPastPerformances: pastPerformances.present,
      hasTrainerStats: trainerStats.present,
      hasJockeyStats: jockeyStats.present,
      hasRunningStyle: runningStyle.present,
      hasPaceFigures: paceFigures.present,

      // Missing data
      missingCritical: critical.missing,
      missingHigh: high.missing,

      // Confidence
      isLowConfidence,
      confidenceReason,

      // Detailed breakdown
      details: {
        critical: critical.details,
        high: high.details,
        medium: medium.details,
        low: low.details,
      },
    };
  } catch (error) {
    // Log error but return safe default
    logger.logError(error as Error, {
      action: 'calculateDataCompleteness',
      horseName: horse.horseName,
    });

    // Return minimal valid result on error
    return {
      overallScore: 0,
      overallGrade: 'F',
      criticalComplete: 0,
      highComplete: 0,
      mediumComplete: 0,
      lowComplete: 0,
      hasSpeedFigures: false,
      hasPastPerformances: false,
      hasTrainerStats: false,
      hasJockeyStats: false,
      hasRunningStyle: false,
      hasPaceFigures: false,
      missingCritical: ['Speed Figures', 'Past Performances', 'Finish Positions', 'Class Level'],
      missingHigh: ['Trainer Stats', 'Jockey Stats', 'Running Style', 'Days Since Last Race'],
      isLowConfidence: true,
      confidenceReason: 'Error calculating data completeness',
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get human-readable summary of data completeness
 */
export function getDataCompletenessSummary(result: DataCompletenessResult): string {
  const { overallGrade, overallScore, missingCritical } = result;

  if (overallGrade === 'A') {
    return `Excellent data quality (${overallScore}%)`;
  }

  if (overallGrade === 'B') {
    return `Good data quality (${overallScore}%)`;
  }

  if (overallGrade === 'C') {
    if (missingCritical.length > 0) {
      return `Fair data quality (${overallScore}%) - Missing: ${missingCritical.join(', ')}`;
    }
    return `Fair data quality (${overallScore}%)`;
  }

  if (overallGrade === 'D') {
    return `Poor data quality (${overallScore}%) - Missing: ${missingCritical.join(', ')}`;
  }

  return `Insufficient data (${overallScore}%) - Missing: ${missingCritical.join(', ')}`;
}

/**
 * Get color for data completeness grade
 */
export function getDataCompletenessColor(grade: DataCompletenessGrade): string {
  switch (grade) {
    case 'A':
      return '#22c55e'; // Green
    case 'B':
      return '#4ade80'; // Light green
    case 'C':
      return '#eab308'; // Yellow
    case 'D':
      return '#f97316'; // Orange
    case 'F':
      return '#ef4444'; // Red
    default:
      return '#888888'; // Gray
  }
}

/**
 * Check if horse should be flagged for low data confidence
 */
export function shouldFlagLowConfidence(result: DataCompletenessResult): boolean {
  return result.isLowConfidence;
}

/**
 * Get tier label for display
 */
export function getTierLabel(tier: 'critical' | 'high' | 'medium' | 'low'): string {
  switch (tier) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return tier;
  }
}

/**
 * Export LOW_CONFIDENCE_THRESHOLD for external use
 */
export { LOW_CONFIDENCE_THRESHOLD };

// Re-export types from types/scoring for convenience
export type { DataCompletenessResult } from '../../types/scoring';
