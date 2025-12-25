/**
 * Distance & Surface Affinity Scoring Module
 * Calculates bonus points based on horse's lifetime record on turf, wet tracks, and at distance
 *
 * Score Breakdown:
 * - Turf Score: 0-8 points (only applies if today's race is on turf)
 * - Wet Track Score: 0-6 points (only applies if track condition is wet/off)
 * - Distance Score: 0-6 points (always applies)
 *
 * Total: 0-20 points (additive bonus to base score)
 *
 * Uses lifetime records from DRF Fields 85-96:
 * - turfStarts, turfWins (Fields 85-88)
 * - wetStarts, wetWins (Fields 89-92)
 * - distanceStarts, distanceWins (Fields 93-96)
 */

import type { HorseEntry, RaceHeader, TrackCondition } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

export interface DistanceSurfaceResult {
  /** Total score 0-20 points */
  total: number;
  /** Turf affinity score 0-8 points (if turf race) */
  turfScore: number;
  /** Wet track score 0-6 points (if wet track) */
  wetScore: number;
  /** Distance affinity score 0-6 points */
  distanceScore: number;
  /** Turf win rate for display */
  turfWinRate: number;
  /** Wet track win rate for display */
  wetWinRate: number;
  /** Distance win rate for display */
  distanceWinRate: number;
  /** Reasoning for each component */
  reasoning: string[];
}

/**
 * Track Specialist Scoring Result
 * Identifies horses with proven success at today's specific track
 */
export interface TrackSpecialistResult {
  /** Total score 0-6 points */
  score: number;
  /** Track win rate (wins/starts) */
  trackWinRate: number;
  /** Track ITM rate ((wins+places+shows)/starts) */
  trackITMRate: number;
  /** Whether horse qualifies as track specialist (30%+ win rate, 4+ starts) */
  isSpecialist: boolean;
  /** Reasoning for the score */
  reasoning: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum starts required for full credit */
const MIN_STARTS_FULL_CREDIT = 3;

/** Maximum scores by category */
export const DISTANCE_SURFACE_LIMITS = {
  turf: 8,
  wet: 6,
  distance: 6,
  trackSpecialist: 6,
  total: 20,
} as const;

/** Minimum starts required for track specialist scoring */
const MIN_TRACK_STARTS = 4;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if track condition is considered "wet" or "off"
 */
function isWetCondition(condition: TrackCondition): boolean {
  const wetConditions: TrackCondition[] = ['muddy', 'sloppy', 'heavy', 'yielding', 'soft', 'slow'];
  return wetConditions.includes(condition);
}

/**
 * Calculate win rate from starts and wins
 * Returns 0 if no starts
 */
function calculateWinRate(starts: number, wins: number): number {
  if (starts <= 0 || wins < 0) return 0;
  return wins / starts;
}

/**
 * Apply small sample size adjustment (half credit for 1-2 starts)
 */
function applySmallSampleAdjustment(score: number, starts: number): number {
  if (starts >= MIN_STARTS_FULL_CREDIT) {
    return score;
  }
  if (starts > 0 && starts < MIN_STARTS_FULL_CREDIT) {
    // 1-2 starts = half credit maximum
    return Math.round(score / 2);
  }
  return 0;
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate turf affinity score (0-8 points)
 * Only applies if today's race is on turf
 *
 * Scoring:
 * - 30%+ win rate: 8 pts
 * - 20-29%: 6 pts
 * - 15-19%: 4 pts
 * - 10-14%: 2 pts
 * - <10% or no starts: 0 pts
 * - 1-2 starts = half credit maximum
 */
function calculateTurfScore(
  horse: HorseEntry,
  isTurfRace: boolean
): { score: number; winRate: number; reasoning: string } {
  if (!isTurfRace) {
    return {
      score: 0,
      winRate: 0,
      reasoning: 'Not a turf race',
    };
  }

  const starts = horse.turfStarts ?? 0;
  const wins = horse.turfWins ?? 0;

  if (starts <= 0) {
    return {
      score: 0,
      winRate: 0,
      reasoning: 'No turf starts (unproven)',
    };
  }

  const winRate = calculateWinRate(starts, wins);
  let baseScore: number;
  let tier: string;

  if (winRate >= 0.3) {
    baseScore = 8;
    tier = 'elite turf specialist';
  } else if (winRate >= 0.2) {
    baseScore = 6;
    tier = 'strong turf affinity';
  } else if (winRate >= 0.15) {
    baseScore = 4;
    tier = 'good turf affinity';
  } else if (winRate >= 0.1) {
    baseScore = 2;
    tier = 'moderate turf ability';
  } else {
    baseScore = 0;
    tier = 'weak turf record';
  }

  const adjustedScore = applySmallSampleAdjustment(baseScore, starts);
  const sampleNote = starts < MIN_STARTS_FULL_CREDIT ? ' (small sample)' : '';

  return {
    score: adjustedScore,
    winRate,
    reasoning: `Turf: ${wins}/${starts} (${(winRate * 100).toFixed(0)}%) - ${tier}${sampleNote}`,
  };
}

/**
 * Calculate wet track score (0-6 points)
 * Only applies if track condition is wet/off
 *
 * Scoring:
 * - 25%+ win rate: 6 pts
 * - 15-24%: 4 pts
 * - 10-14%: 2 pts
 * - <10% or no starts: 0 pts
 * - 1-2 starts = half credit maximum
 */
function calculateWetScore(
  horse: HorseEntry,
  isWetTrack: boolean
): { score: number; winRate: number; reasoning: string } {
  if (!isWetTrack) {
    return {
      score: 0,
      winRate: 0,
      reasoning: 'Track is not wet/off',
    };
  }

  const starts = horse.wetStarts ?? 0;
  const wins = horse.wetWins ?? 0;

  if (starts <= 0) {
    return {
      score: 0,
      winRate: 0,
      reasoning: 'No wet track starts (unproven)',
    };
  }

  const winRate = calculateWinRate(starts, wins);
  let baseScore: number;
  let tier: string;

  if (winRate >= 0.25) {
    baseScore = 6;
    tier = 'proven mudder';
  } else if (winRate >= 0.15) {
    baseScore = 4;
    tier = 'handles wet tracks';
  } else if (winRate >= 0.1) {
    baseScore = 2;
    tier = 'moderate wet ability';
  } else {
    baseScore = 0;
    tier = 'weak wet track record';
  }

  const adjustedScore = applySmallSampleAdjustment(baseScore, starts);
  const sampleNote = starts < MIN_STARTS_FULL_CREDIT ? ' (small sample)' : '';

  return {
    score: adjustedScore,
    winRate,
    reasoning: `Wet: ${wins}/${starts} (${(winRate * 100).toFixed(0)}%) - ${tier}${sampleNote}`,
  };
}

/**
 * Calculate distance affinity score (0-6 points)
 * Always applies regardless of surface/condition
 *
 * Scoring:
 * - 25%+ win rate: 6 pts
 * - 15-24%: 4 pts
 * - 10-14%: 2 pts
 * - <10% or no starts: 0 pts
 * - 1-2 starts = half credit maximum
 */
function calculateDistanceScore(horse: HorseEntry): {
  score: number;
  winRate: number;
  reasoning: string;
} {
  const starts = horse.distanceStarts ?? 0;
  const wins = horse.distanceWins ?? 0;

  if (starts <= 0) {
    return {
      score: 0,
      winRate: 0,
      reasoning: 'No starts at distance (unproven)',
    };
  }

  const winRate = calculateWinRate(starts, wins);
  let baseScore: number;
  let tier: string;

  if (winRate >= 0.25) {
    baseScore = 6;
    tier = 'distance specialist';
  } else if (winRate >= 0.15) {
    baseScore = 4;
    tier = 'good at distance';
  } else if (winRate >= 0.1) {
    baseScore = 2;
    tier = 'moderate at distance';
  } else {
    baseScore = 0;
    tier = 'weak at distance';
  }

  const adjustedScore = applySmallSampleAdjustment(baseScore, starts);
  const sampleNote = starts < MIN_STARTS_FULL_CREDIT ? ' (small sample)' : '';

  return {
    score: adjustedScore,
    winRate,
    reasoning: `Distance: ${wins}/${starts} (${(winRate * 100).toFixed(0)}%) - ${tier}${sampleNote}`,
  };
}

// ============================================================================
// TRACK SPECIALIST SCORING
// ============================================================================

/**
 * Calculate track specialist score (0-6 points)
 * Identifies horses with proven success at today's specific track
 *
 * Scoring:
 * - 30%+ win rate at track (min 4 starts): 6 pts "Track specialist"
 * - 20-29% win rate at track (min 4 starts): 4 pts "Track positive"
 * - 50%+ ITM rate at track (min 4 starts): 2 pts bonus "Consistent at track"
 * - 10-19% win rate (min 4 starts): 2 pts "Track experience"
 * - <10% win rate or 0 wins (4+ starts): 0 pts "Struggles here"
 * - <4 starts: 0 pts (insufficient data, not penalized)
 *
 * @param horse - The horse entry to score
 * @param _trackCode - The track code for today's race (unused but available for future enhancements)
 * @returns Track specialist scoring result
 */
export function calculateTrackSpecialistScore(
  horse: HorseEntry,
  _trackCode: string
): TrackSpecialistResult {
  const starts = horse.trackStarts ?? 0;
  const wins = horse.trackWins ?? 0;
  const places = horse.trackPlaces ?? 0;
  const shows = horse.trackShows ?? 0;

  // Insufficient data - no penalty, no bonus
  if (starts < MIN_TRACK_STARTS) {
    return {
      score: 0,
      trackWinRate: starts > 0 ? wins / starts : 0,
      trackITMRate: starts > 0 ? (wins + places + shows) / starts : 0,
      isSpecialist: false,
      reasoning:
        starts === 0
          ? 'First time at track'
          : `Only ${starts} start${starts === 1 ? '' : 's'} at track (need ${MIN_TRACK_STARTS}+)`,
    };
  }

  // Calculate rates
  const winRate = wins / starts;
  const itmRate = (wins + places + shows) / starts;

  let baseScore = 0;
  let tier = '';

  // Win rate-based scoring
  if (winRate >= 0.3) {
    baseScore = 6;
    tier = 'Track specialist';
  } else if (winRate >= 0.2) {
    baseScore = 4;
    tier = 'Track positive';
  } else if (winRate >= 0.1) {
    baseScore = 2;
    tier = 'Track experience';
  } else {
    baseScore = 0;
    tier = 'Struggles here';
  }

  // ITM bonus (only if win rate is at least 10% and not already at max)
  let itmBonus = 0;
  if (itmRate >= 0.5 && winRate >= 0.1 && baseScore < 6) {
    // Cap so total doesn't exceed 6
    itmBonus = Math.min(2, 6 - baseScore);
    tier = tier + ' + Consistent';
  }

  const finalScore = baseScore + itmBonus;
  const isSpecialist = winRate >= 0.3 && starts >= MIN_TRACK_STARTS;

  // Build reasoning string
  const winRatePercent = (winRate * 100).toFixed(0);
  const itmRatePercent = (itmRate * 100).toFixed(0);
  const record = `${wins}-${places}-${shows} from ${starts} starts`;

  let reasoning = `Track: ${record} (${winRatePercent}% win`;
  if (itmBonus > 0) {
    reasoning += `, ${itmRatePercent}% ITM`;
  }
  reasoning += `) - ${tier}`;

  return {
    score: finalScore,
    trackWinRate: winRate,
    trackITMRate: itmRate,
    isSpecialist,
    reasoning,
  };
}

/**
 * Check if horse is a track specialist (30%+ win rate, 4+ starts)
 */
export function isTrackSpecialist(horse: HorseEntry): boolean {
  const starts = horse.trackStarts ?? 0;
  const wins = horse.trackWins ?? 0;

  if (starts < MIN_TRACK_STARTS) return false;
  return wins / starts >= 0.3;
}

/**
 * Get a summary of track record for display
 */
export function getTrackRecordSummary(horse: HorseEntry): string {
  const starts = horse.trackStarts ?? 0;
  const wins = horse.trackWins ?? 0;
  const places = horse.trackPlaces ?? 0;
  const shows = horse.trackShows ?? 0;

  if (starts === 0) {
    return 'First time at track';
  }

  const winRate = ((wins / starts) * 100).toFixed(0);
  return `${wins}-${places}-${shows} (${winRate}%) from ${starts} starts`;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Calculate distance and surface affinity score for a horse
 *
 * @param horse - The horse entry to score
 * @param raceHeader - Race information (contains surface and track condition)
 * @param trackConditionOverride - Optional user-selected track condition override
 * @returns Detailed score breakdown
 */
export function calculateDistanceSurfaceScore(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  trackConditionOverride?: TrackCondition
): DistanceSurfaceResult {
  // Determine conditions
  const isTurfRace = raceHeader.surface === 'turf';
  const effectiveCondition = trackConditionOverride ?? raceHeader.trackCondition;
  const isWetTrack = isWetCondition(effectiveCondition);

  // Calculate each component
  const turfResult = calculateTurfScore(horse, isTurfRace);
  const wetResult = calculateWetScore(horse, isWetTrack);
  const distanceResult = calculateDistanceScore(horse);

  // Combine reasoning
  const reasoning: string[] = [];
  if (isTurfRace) {
    reasoning.push(turfResult.reasoning);
  }
  if (isWetTrack) {
    reasoning.push(wetResult.reasoning);
  }
  reasoning.push(distanceResult.reasoning);

  // Calculate total (capped at 20)
  const rawTotal = turfResult.score + wetResult.score + distanceResult.score;
  const total = Math.min(DISTANCE_SURFACE_LIMITS.total, rawTotal);

  return {
    total,
    turfScore: turfResult.score,
    wetScore: wetResult.score,
    distanceScore: distanceResult.score,
    turfWinRate: turfResult.winRate,
    wetWinRate: wetResult.winRate,
    distanceWinRate: distanceResult.winRate,
    reasoning,
  };
}

/**
 * Check if horse has significant distance/surface advantages
 * Useful for quick filtering/highlighting
 */
export function hasDistanceSurfaceAdvantage(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  trackConditionOverride?: TrackCondition
): boolean {
  const result = calculateDistanceSurfaceScore(horse, raceHeader, trackConditionOverride);
  // 10+ points = significant advantage
  return result.total >= 10;
}

/**
 * Get a summary string for display
 */
export function getDistanceSurfaceSummary(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  trackConditionOverride?: TrackCondition
): string {
  const result = calculateDistanceSurfaceScore(horse, raceHeader, trackConditionOverride);

  if (result.total === 0) {
    return 'No distance/surface bonus';
  }

  const parts: string[] = [];

  if (result.turfScore > 0) {
    parts.push(`Turf: +${result.turfScore}`);
  }
  if (result.wetScore > 0) {
    parts.push(`Wet: +${result.wetScore}`);
  }
  if (result.distanceScore > 0) {
    parts.push(`Distance: +${result.distanceScore}`);
  }

  return parts.join(', ') + ` (Total: +${result.total})`;
}
