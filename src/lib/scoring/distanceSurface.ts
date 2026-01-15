/**
 * Distance & Surface Affinity Scoring Module
 * Calculates bonus/penalty points based on horse's record on turf, wet tracks, and at distance
 *
 * Score Breakdown (v3.6 - January 2026):
 * - Turf Score: 0-8 points (only applies if today's race is on turf)
 * - Wet Track Score: -2 to +6 points (only applies if track condition is wet/off)
 * - Distance Score: -2 to +6 points (always applies)
 *
 * Total: -4 to +20 points (can be negative for proven poor performers)
 *
 * Data Sources:
 * - Turf: From DRF Fields 85-90 (current year turf record)
 * - Wet Track: Derived from past performance track conditions (no DRF header field exists)
 * - Distance: Derived from past performances at today's distance ±0.5 furlongs
 *
 * v3.6 Enhancement: Added penalties (-2 pts) for horses with extensive experience (5+ starts)
 * but very poor win rates (<10%) at wet tracks or at today's distance. This differentiates
 * between "unproven" (neutral) and "proven poor performer" (penalty).
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
  /** Total score 0-10 points (Model B: increased from 6) */
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
  trackSpecialist: 10, // Model B: increased from 6 to reward proven track success
  total: 20,
} as const;

/**
 * NEUTRAL BASELINES for missing data (v2.5 - Favorite Fix)
 *
 * Per diagnostic findings: "Unproven" should be neutral, not a penalty.
 * Horses with 0 starts on a surface/distance were being penalized with 0 pts,
 * causing favorites to rank low despite having no negative evidence.
 *
 * Neutral baseline = 50% of max for each category:
 * - Turf (0 starts in turf race): 4 pts (50% of 8)
 * - Wet (0 starts in wet race): 3 pts (50% of 6)
 * - Distance (0 starts at distance): 3 pts (50% of 6)
 * - Track specialist (0 starts at track): 5 pts (50% of 10) - Model B adjusted
 */
export const NEUTRAL_BASELINES = {
  turf: 4, // 50% of 8 max
  wet: 3, // 50% of 6 max
  distance: 3, // 50% of 6 max
  trackSpecialist: 5, // Model B: 50% of 10 max (increased from 3)
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
    // v2.5: Neutral baseline instead of 0 (unproven ≠ bad)
    return {
      score: NEUTRAL_BASELINES.turf,
      winRate: 0,
      reasoning: `No turf starts (neutral baseline: ${NEUTRAL_BASELINES.turf} pts)`,
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
 * Calculate wet track score (-2 to +6 points)
 * Only applies if track condition is wet/off
 *
 * v3.6 Enhanced Scoring (January 2026):
 * - 30%+ win rate: 6 pts (wet track specialist)
 * - 20-29%: 4 pts (handles wet)
 * - 10-19%: 2 pts (adequate wet form)
 * - <10% win rate with 5+ starts: -2 pts (struggles on wet - PENALTY)
 * - <10% win rate with <5 starts: 0 pts (insufficient data)
 * - No starts: neutral baseline (unproven ≠ bad)
 * - 1-2 starts = half credit maximum for bonuses
 *
 * Key insight: Horses with extensive wet track experience (5+ starts) but
 * very low win rates (<10%) are penalized, as this represents proven inability.
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
    // v2.5: Neutral baseline instead of 0 (unproven ≠ bad)
    return {
      score: NEUTRAL_BASELINES.wet,
      winRate: 0,
      reasoning: `No wet track starts (neutral baseline: ${NEUTRAL_BASELINES.wet} pts)`,
    };
  }

  const winRate = calculateWinRate(starts, wins);
  let baseScore: number;
  let tier: string;

  // v3.6: Enhanced tiers with penalty for proven poor wet track record
  if (winRate >= 0.3) {
    baseScore = 6;
    tier = 'wet track specialist';
  } else if (winRate >= 0.2) {
    baseScore = 4;
    tier = 'handles wet';
  } else if (winRate >= 0.1) {
    baseScore = 2;
    tier = 'adequate wet form';
  } else if (starts >= 5) {
    // v3.6 NEW: Penalty for horses with extensive wet track experience but poor results
    baseScore = -2;
    tier = 'struggles on wet (penalty)';
  } else {
    // Insufficient sample size to penalize
    baseScore = 0;
    tier = 'weak wet record (small sample)';
  }

  // Only apply small sample adjustment for positive scores
  const adjustedScore = baseScore > 0 ? applySmallSampleAdjustment(baseScore, starts) : baseScore;
  const sampleNote = starts < MIN_STARTS_FULL_CREDIT && baseScore >= 0 ? ' (small sample)' : '';

  return {
    score: adjustedScore,
    winRate,
    reasoning: `Wet: ${wins}/${starts} (${(winRate * 100).toFixed(0)}%) - ${tier}${sampleNote}`,
  };
}

/**
 * Calculate distance affinity score (-2 to +6 points)
 * Always applies regardless of surface/condition
 *
 * v3.6 Enhanced Scoring (January 2026):
 * - 30%+ win rate: 6 pts (distance specialist)
 * - 20-29%: 4 pts (proven at distance)
 * - 10-19%: 2 pts (adequate at distance)
 * - <10% win rate with 5+ starts: -2 pts (questionable at distance - PENALTY)
 * - <10% win rate with <5 starts: 0 pts (insufficient data)
 * - No starts: neutral baseline (unproven ≠ bad, may use pedigree fallback)
 * - 1-2 starts = half credit maximum for bonuses
 *
 * Key insight: Distance affinity is derived from past performances at today's
 * distance (±0.5 furlongs). Horses with extensive experience (5+ starts) at
 * this distance but very low win rates are penalized as proven non-performers.
 */
function calculateDistanceScore(horse: HorseEntry): {
  score: number;
  winRate: number;
  reasoning: string;
} {
  const starts = horse.distanceStarts ?? 0;
  const wins = horse.distanceWins ?? 0;

  if (starts <= 0) {
    // v2.5: Neutral baseline instead of 0 (unproven ≠ bad)
    return {
      score: NEUTRAL_BASELINES.distance,
      winRate: 0,
      reasoning: `No starts at distance (neutral baseline: ${NEUTRAL_BASELINES.distance} pts)`,
    };
  }

  const winRate = calculateWinRate(starts, wins);
  let baseScore: number;
  let tier: string;

  // v3.6: Enhanced tiers with penalty for proven poor distance record
  if (winRate >= 0.3) {
    baseScore = 6;
    tier = 'distance specialist';
  } else if (winRate >= 0.2) {
    baseScore = 4;
    tier = 'proven at distance';
  } else if (winRate >= 0.1) {
    baseScore = 2;
    tier = 'adequate at distance';
  } else if (starts >= 5) {
    // v3.6 NEW: Penalty for horses with extensive experience but poor results at distance
    baseScore = -2;
    tier = 'questionable at distance (penalty)';
  } else {
    // Insufficient sample size to penalize
    baseScore = 0;
    tier = 'weak at distance (small sample)';
  }

  // Only apply small sample adjustment for positive scores
  const adjustedScore = baseScore > 0 ? applySmallSampleAdjustment(baseScore, starts) : baseScore;
  const sampleNote = starts < MIN_STARTS_FULL_CREDIT && baseScore >= 0 ? ' (small sample)' : '';

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
 * Calculate track specialist score (0-10 points)
 * Identifies horses with proven success at today's specific track
 *
 * Model B Scoring (increased from 6 to 10 max):
 * - 40%+ win rate at track (min 4 starts): 10 pts "Track ace"
 * - 30-39% win rate at track (min 4 starts): 8 pts "Track specialist"
 * - 25-29% win rate at track (min 4 starts): 6 pts "Track positive"
 * - 20-24% win rate at track (min 4 starts): 5 pts "Track affinity"
 * - 10-19% win rate (min 4 starts): 3 pts "Track experience"
 * - <10% win rate or 0 wins (4+ starts): 0 pts "Struggles here"
 * - <4 starts: neutral baseline (insufficient data, not penalized)
 *
 * ITM Bonus (stacks with win rate score, capped at 10 total):
 * - 60%+ ITM rate: +2 pts "Highly consistent"
 * - 50-59% ITM rate: +1 pt "Consistent"
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

  // Insufficient data - give neutral baseline instead of 0
  if (starts < MIN_TRACK_STARTS) {
    return {
      score: NEUTRAL_BASELINES.trackSpecialist, // neutral instead of 0
      trackWinRate: starts > 0 ? wins / starts : 0,
      trackITMRate: starts > 0 ? (wins + places + shows) / starts : 0,
      isSpecialist: false,
      reasoning:
        starts === 0
          ? `First time at track (neutral baseline: ${NEUTRAL_BASELINES.trackSpecialist} pts)`
          : `Only ${starts} start${starts === 1 ? '' : 's'} at track (neutral: ${NEUTRAL_BASELINES.trackSpecialist} pts)`,
    };
  }

  // Calculate rates
  const winRate = wins / starts;
  const itmRate = (wins + places + shows) / starts;

  let baseScore = 0;
  let tier = '';

  // Win rate-based scoring (Model B: expanded tiers up to 10)
  if (winRate >= 0.4) {
    baseScore = 10;
    tier = 'Track ace';
  } else if (winRate >= 0.3) {
    baseScore = 8;
    tier = 'Track specialist';
  } else if (winRate >= 0.25) {
    baseScore = 6;
    tier = 'Track positive';
  } else if (winRate >= 0.2) {
    baseScore = 5;
    tier = 'Track affinity';
  } else if (winRate >= 0.1) {
    baseScore = 3;
    tier = 'Track experience';
  } else {
    baseScore = 0;
    tier = 'Struggles here';
  }

  // ITM bonus (stacks with base score, capped at 10)
  let itmBonus = 0;
  if (winRate >= 0.1 && baseScore < 10) {
    if (itmRate >= 0.6) {
      itmBonus = Math.min(2, 10 - baseScore);
      tier = tier + ' + Highly consistent';
    } else if (itmRate >= 0.5) {
      itmBonus = Math.min(1, 10 - baseScore);
      tier = tier + ' + Consistent';
    }
  }

  const finalScore = Math.min(10, baseScore + itmBonus);
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
