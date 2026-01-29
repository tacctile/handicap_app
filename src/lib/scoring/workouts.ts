/**
 * Workout Scoring Module
 *
 * Analyzes workout patterns to identify trainer intent and horse fitness,
 * especially important for first-time starters (FTS) and layoff returnees
 * where workouts are the primary indicator of readiness.
 *
 * WORKOUT SCORING BREAKDOWN (max 8 pts):
 *
 * Recency Bonus (0-3 pts):
 *   - Workout within 7 days: +3 pts
 *   - Workout within 14 days: +2 pts
 *   - Workout within 21 days: +1 pt
 *   - No workout in 21 days: +0 pts
 *
 * Quality Bonus (0-3 pts):
 *   - Bullet work (rank #1, fastest of morning): +3 pts
 *   - Top 10% of works at distance: +2 pts
 *   - Top 25% of works at distance: +1 pt
 *   - Below top 25%: +0 pts
 *
 * Pattern Bonus (0-2 pts):
 *   - 4+ works in last 30 days: +2 pts (trainer cranking)
 *   - 3 works in last 30 days: +1 pt
 *   - Fewer than 3 works: +0 pts
 *
 * WORKOUT PENALTIES:
 *   - Layoff returnee (60+ days) with no published work in 21 days: -4 pts
 *   - First-time starter with no bullet work: -2 pts
 *   - Last work was slow (bottom 25%): -1 pt
 *
 * SPECIAL HANDLING:
 *   - First-time starters: workout score weight DOUBLED
 *   - Layoff returnees (60+ days): workout score weight INCREASED by 50%
 *
 * Net workout score range: -4 to +8 pts
 *
 * DATA AVAILABILITY NOTE:
 * DRF standard format provides:
 * - Workout dates and days since workout
 * - Track, surface, condition
 * - Rank position (1 = bullet) and total works that day
 *
 * NOT available in standard DRF:
 * - Workout times (would need extended format)
 * - Workout type (breeze/handily/driving)
 */

import type { HorseEntry, Workout } from '../../types/drf';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum workout score (before penalties)
 */
export const MAX_WORKOUT_SCORE = 8;

/**
 * Minimum workout score (after penalties)
 */
export const MIN_WORKOUT_SCORE = -4;

/**
 * Recency bonus configuration
 */
export const RECENCY_BONUS = {
  /** Days threshold for maximum bonus */
  WITHIN_7_DAYS: 7,
  WITHIN_7_DAYS_BONUS: 3,

  /** Days threshold for medium bonus */
  WITHIN_14_DAYS: 14,
  WITHIN_14_DAYS_BONUS: 2,

  /** Days threshold for minimum bonus */
  WITHIN_21_DAYS: 21,
  WITHIN_21_DAYS_BONUS: 1,
} as const;

/**
 * Quality bonus configuration (based on ranking)
 */
export const QUALITY_BONUS = {
  /** Bullet work (rank #1) gets maximum bonus */
  BULLET_BONUS: 3,

  /** Top 10% threshold and bonus */
  TOP_10_PERCENT_THRESHOLD: 0.10,
  TOP_10_PERCENT_BONUS: 2,

  /** Top 25% threshold and bonus */
  TOP_25_PERCENT_THRESHOLD: 0.25,
  TOP_25_PERCENT_BONUS: 1,
} as const;

/**
 * Pattern bonus configuration (work count in last 30 days)
 */
export const PATTERN_BONUS = {
  /** Days to look back for pattern analysis */
  LOOKBACK_DAYS: 30,

  /** 4+ works = trainer is cranking */
  FOUR_PLUS_WORKS_BONUS: 2,
  FOUR_PLUS_WORKS_THRESHOLD: 4,

  /** 3 works = solid training */
  THREE_WORKS_BONUS: 1,
  THREE_WORKS_THRESHOLD: 3,
} as const;

/**
 * Penalty configuration
 */
export const WORKOUT_PENALTIES = {
  /** Layoff returnee without recent work */
  LAYOFF_NO_WORK_PENALTY: -4,
  LAYOFF_THRESHOLD_DAYS: 60,
  NO_WORK_THRESHOLD_DAYS: 21,

  /** First-time starter without bullet work */
  FTS_NO_BULLET_PENALTY: -2,

  /** Last work in bottom 25% */
  SLOW_WORK_PENALTY: -1,
  SLOW_WORK_THRESHOLD: 0.75, // Bottom 25% = rank > 75th percentile
} as const;

/**
 * Weight multipliers for special cases
 */
export const WORKOUT_MULTIPLIERS = {
  /** First-time starters - workouts are the ONLY performance data */
  FTS_MULTIPLIER: 2.0,

  /** Layoff returnees (60+ days) - workouts show current fitness */
  LAYOFF_MULTIPLIER: 1.5,
} as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Detailed result from workout analysis
 */
export interface WorkoutScoreResult {
  /** Total workout score (after multipliers and caps) */
  total: number;

  /** Raw score before multipliers */
  rawScore: number;

  /** Recency bonus component (0-3) */
  recencyBonus: number;

  /** Quality bonus component (0-3) */
  qualityBonus: number;

  /** Pattern bonus component (0-2) */
  patternBonus: number;

  /** Penalty component (0 to -4) */
  penalty: number;

  /** Multiplier applied (1.0, 1.5, or 2.0) */
  multiplier: number;

  /** Whether multiplier was applied */
  multiplierApplied: boolean;

  /** Reason for multiplier */
  multiplierReason: string;

  /** Number of works in last 30 days */
  worksInLast30Days: number;

  /** Days since most recent workout */
  daysSinceMostRecentWork: number | null;

  /** Whether horse has a bullet work */
  hasBulletWork: boolean;

  /** Best rank percentage (lower = better, 0.05 = top 5%) */
  bestRankPercentage: number | null;

  /** Is first-time starter */
  isFirstTimeStarter: boolean;

  /** Is layoff returnee */
  isLayoffReturnee: boolean;

  /** Human-readable reasoning */
  reasoning: string;

  /** Detailed breakdown for diagnostics */
  breakdown: {
    recency: string;
    quality: string;
    pattern: string;
    penalty: string;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse days since workout from the notes field
 * Notes format: "5d ago" or similar
 */
function parseDaysSinceWork(workout: Workout): number | null {
  // First, check if we can calculate from the date
  if (workout.date) {
    try {
      // Date format: YYYYMMDD
      const year = parseInt(workout.date.substring(0, 4), 10);
      const month = parseInt(workout.date.substring(4, 6), 10) - 1; // JS months are 0-indexed
      const day = parseInt(workout.date.substring(6, 8), 10);

      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const workoutDate = new Date(year, month, day);
        const today = new Date();
        const diffTime = today.getTime() - workoutDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 ? diffDays : null;
      }
    } catch {
      // Fall through to notes parsing
    }
  }

  // Fallback: parse from notes field
  if (workout.notes) {
    const match = workout.notes.match(/(\d+)d ago/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Calculate rank percentage (lower = better)
 * Returns null if ranking data not available
 */
function getRankPercentage(workout: Workout): number | null {
  if (workout.rankNumber === null || workout.totalWorks === null) {
    return null;
  }

  if (workout.totalWorks === 0) {
    return null;
  }

  // Rank 1 of 20 = 0.05 (5%), Rank 10 of 20 = 0.50 (50%)
  return workout.rankNumber / workout.totalWorks;
}

/**
 * Check if a workout is within a certain number of days
 */
function isWorkoutWithinDays(workout: Workout, days: number): boolean {
  const daysSince = parseDaysSinceWork(workout);
  return daysSince !== null && daysSince <= days;
}

/**
 * Count workouts within a certain number of days
 */
function countWorksWithinDays(workouts: Workout[], days: number): number {
  return workouts.filter((w) => isWorkoutWithinDays(w, days)).length;
}

/**
 * Get the most recent workout
 */
function getMostRecentWorkout(workouts: Workout[]): Workout | null {
  if (workouts.length === 0) return null;

  // Workouts should already be sorted by date (most recent first)
  // But let's find the one with the smallest days since
  let mostRecent: Workout | null = null;
  let minDays: number | null = null;

  for (const workout of workouts) {
    const days = parseDaysSinceWork(workout);
    if (days !== null) {
      if (minDays === null || days < minDays) {
        minDays = days;
        mostRecent = workout;
      }
    }
  }

  // If no days info, assume first is most recent
  return mostRecent ?? workouts[0] ?? null;
}

/**
 * Find the best (lowest) rank percentage among all workouts
 */
function getBestRankPercentage(workouts: Workout[]): number | null {
  let best: number | null = null;

  for (const workout of workouts) {
    const pct = getRankPercentage(workout);
    if (pct !== null) {
      if (best === null || pct < best) {
        best = pct;
      }
    }
  }

  return best;
}

/**
 * Check if horse has any bullet works
 */
function hasBulletWork(workouts: Workout[]): boolean {
  return workouts.some((w) => w.isBullet);
}

/**
 * Check if horse is a first-time starter
 */
function isFirstTimeStarter(horse: HorseEntry): boolean {
  return horse.pastPerformances.length === 0 || horse.lifetimeStarts === 0;
}

/**
 * Check if horse is a layoff returnee (60+ days since last race)
 */
function isLayoffReturnee(horse: HorseEntry): boolean {
  const days = horse.daysSinceLastRace;
  return days !== null && days >= WORKOUT_PENALTIES.LAYOFF_THRESHOLD_DAYS;
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate recency bonus (0-3 pts)
 */
function calculateRecencyBonus(workouts: Workout[]): { bonus: number; reasoning: string } {
  const mostRecent = getMostRecentWorkout(workouts);

  if (!mostRecent) {
    return { bonus: 0, reasoning: 'No workouts' };
  }

  const daysSince = parseDaysSinceWork(mostRecent);

  if (daysSince === null) {
    return { bonus: 0, reasoning: 'Cannot determine workout recency' };
  }

  if (daysSince <= RECENCY_BONUS.WITHIN_7_DAYS) {
    return {
      bonus: RECENCY_BONUS.WITHIN_7_DAYS_BONUS,
      reasoning: `Work ${daysSince}d ago (+${RECENCY_BONUS.WITHIN_7_DAYS_BONUS})`,
    };
  }

  if (daysSince <= RECENCY_BONUS.WITHIN_14_DAYS) {
    return {
      bonus: RECENCY_BONUS.WITHIN_14_DAYS_BONUS,
      reasoning: `Work ${daysSince}d ago (+${RECENCY_BONUS.WITHIN_14_DAYS_BONUS})`,
    };
  }

  if (daysSince <= RECENCY_BONUS.WITHIN_21_DAYS) {
    return {
      bonus: RECENCY_BONUS.WITHIN_21_DAYS_BONUS,
      reasoning: `Work ${daysSince}d ago (+${RECENCY_BONUS.WITHIN_21_DAYS_BONUS})`,
    };
  }

  return { bonus: 0, reasoning: `Work ${daysSince}d ago (stale)` };
}

/**
 * Calculate quality bonus (0-3 pts)
 * Based on workout rankings (bullet work = rank #1)
 */
function calculateQualityBonus(workouts: Workout[]): { bonus: number; reasoning: string } {
  if (workouts.length === 0) {
    return { bonus: 0, reasoning: 'No workouts' };
  }

  // Check for bullet work first
  if (hasBulletWork(workouts)) {
    return {
      bonus: QUALITY_BONUS.BULLET_BONUS,
      reasoning: `Bullet work (+${QUALITY_BONUS.BULLET_BONUS})`,
    };
  }

  // Check best rank percentage
  const bestPct = getBestRankPercentage(workouts);

  if (bestPct === null) {
    return { bonus: 0, reasoning: 'No ranking data available' };
  }

  if (bestPct <= QUALITY_BONUS.TOP_10_PERCENT_THRESHOLD) {
    const pctDisplay = Math.round(bestPct * 100);
    return {
      bonus: QUALITY_BONUS.TOP_10_PERCENT_BONUS,
      reasoning: `Top ${pctDisplay}% work (+${QUALITY_BONUS.TOP_10_PERCENT_BONUS})`,
    };
  }

  if (bestPct <= QUALITY_BONUS.TOP_25_PERCENT_THRESHOLD) {
    const pctDisplay = Math.round(bestPct * 100);
    return {
      bonus: QUALITY_BONUS.TOP_25_PERCENT_BONUS,
      reasoning: `Top ${pctDisplay}% work (+${QUALITY_BONUS.TOP_25_PERCENT_BONUS})`,
    };
  }

  const pctDisplay = Math.round(bestPct * 100);
  return { bonus: 0, reasoning: `Best work at ${pctDisplay}%` };
}

/**
 * Calculate pattern bonus (0-2 pts)
 * Based on number of works in last 30 days
 */
function calculatePatternBonus(workouts: Workout[]): { bonus: number; reasoning: string } {
  const worksIn30Days = countWorksWithinDays(workouts, PATTERN_BONUS.LOOKBACK_DAYS);

  if (worksIn30Days >= PATTERN_BONUS.FOUR_PLUS_WORKS_THRESHOLD) {
    return {
      bonus: PATTERN_BONUS.FOUR_PLUS_WORKS_BONUS,
      reasoning: `${worksIn30Days} works in 30d (cranking, +${PATTERN_BONUS.FOUR_PLUS_WORKS_BONUS})`,
    };
  }

  if (worksIn30Days >= PATTERN_BONUS.THREE_WORKS_THRESHOLD) {
    return {
      bonus: PATTERN_BONUS.THREE_WORKS_BONUS,
      reasoning: `${worksIn30Days} works in 30d (+${PATTERN_BONUS.THREE_WORKS_BONUS})`,
    };
  }

  return { bonus: 0, reasoning: `${worksIn30Days} works in 30d` };
}

/**
 * Calculate penalties (0 to -4 pts)
 */
function calculatePenalties(
  horse: HorseEntry,
  workouts: Workout[],
  isFTS: boolean,
  isLayoff: boolean
): { penalty: number; reasoning: string } {
  let totalPenalty = 0;
  const reasons: string[] = [];

  // Check layoff with no recent work
  if (isLayoff) {
    const mostRecent = getMostRecentWorkout(workouts);
    const daysSinceWork = mostRecent ? parseDaysSinceWork(mostRecent) : null;

    if (daysSinceWork === null || daysSinceWork > WORKOUT_PENALTIES.NO_WORK_THRESHOLD_DAYS) {
      totalPenalty += WORKOUT_PENALTIES.LAYOFF_NO_WORK_PENALTY;
      const daysDisplay = horse.daysSinceLastRace ?? 60;
      reasons.push(`Layoff (${daysDisplay}d) with no recent work (${WORKOUT_PENALTIES.LAYOFF_NO_WORK_PENALTY})`);
    }
  }

  // Check FTS without bullet work
  if (isFTS && !hasBulletWork(workouts)) {
    totalPenalty += WORKOUT_PENALTIES.FTS_NO_BULLET_PENALTY;
    reasons.push(`FTS without bullet work (${WORKOUT_PENALTIES.FTS_NO_BULLET_PENALTY})`);
  }

  // Check for slow last work (bottom 25%)
  const mostRecent = getMostRecentWorkout(workouts);
  if (mostRecent) {
    const rankPct = getRankPercentage(mostRecent);
    if (rankPct !== null && rankPct > WORKOUT_PENALTIES.SLOW_WORK_THRESHOLD) {
      totalPenalty += WORKOUT_PENALTIES.SLOW_WORK_PENALTY;
      const pctDisplay = Math.round(rankPct * 100);
      reasons.push(`Slow last work (${pctDisplay}%, ${WORKOUT_PENALTIES.SLOW_WORK_PENALTY})`);
    }
  }

  return {
    penalty: totalPenalty,
    reasoning: reasons.length > 0 ? reasons.join(' | ') : 'No penalties',
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Calculate workout score for a horse
 *
 * Analyzes workout patterns to identify trainer intent and horse fitness.
 * Critical for FTS (first-time starters) and layoff returnees.
 *
 * @param horse - The horse entry to score
 * @returns Detailed workout score result
 */
export function calculateWorkoutScore(horse: HorseEntry): WorkoutScoreResult {
  const workouts = horse.workouts || [];

  // Determine special status
  const isFTS = isFirstTimeStarter(horse);
  const isLayoff = isLayoffReturnee(horse);

  // Calculate components
  const recencyResult = calculateRecencyBonus(workouts);
  const qualityResult = calculateQualityBonus(workouts);
  const patternResult = calculatePatternBonus(workouts);
  const penaltyResult = calculatePenalties(horse, workouts, isFTS, isLayoff);

  // Sum up raw score
  const rawScore =
    recencyResult.bonus +
    qualityResult.bonus +
    patternResult.bonus +
    penaltyResult.penalty;

  // Determine multiplier
  let multiplier = 1.0;
  let multiplierApplied = false;
  let multiplierReason = 'Standard weighting';

  if (isFTS) {
    multiplier = WORKOUT_MULTIPLIERS.FTS_MULTIPLIER;
    multiplierApplied = true;
    multiplierReason = 'First-time starter (workouts are only data)';
  } else if (isLayoff) {
    multiplier = WORKOUT_MULTIPLIERS.LAYOFF_MULTIPLIER;
    multiplierApplied = true;
    multiplierReason = `Layoff returnee (${horse.daysSinceLastRace}d)`;
  }

  // Apply multiplier (only to positive portion, penalties stay fixed)
  const positiveScore = recencyResult.bonus + qualityResult.bonus + patternResult.bonus;
  const multipliedPositive = Math.round(positiveScore * multiplier);
  const adjustedScore = multipliedPositive + penaltyResult.penalty;

  // Cap at limits
  const total = Math.max(MIN_WORKOUT_SCORE, Math.min(MAX_WORKOUT_SCORE, adjustedScore));

  // Get additional stats for diagnostics
  const mostRecent = getMostRecentWorkout(workouts);
  const daysSinceMostRecentWork = mostRecent ? parseDaysSinceWork(mostRecent) : null;
  const worksInLast30Days = countWorksWithinDays(workouts, PATTERN_BONUS.LOOKBACK_DAYS);
  const bestRankPercentage = getBestRankPercentage(workouts);

  // Build reasoning
  const reasoningParts: string[] = [];

  if (workouts.length === 0) {
    reasoningParts.push('No workouts published');
  } else {
    reasoningParts.push(`${workouts.length} work${workouts.length === 1 ? '' : 's'}`);

    if (recencyResult.bonus > 0) {
      reasoningParts.push(recencyResult.reasoning);
    }

    if (qualityResult.bonus > 0) {
      reasoningParts.push(qualityResult.reasoning);
    }

    if (patternResult.bonus > 0) {
      reasoningParts.push(patternResult.reasoning);
    }
  }

  if (penaltyResult.penalty < 0) {
    reasoningParts.push(penaltyResult.reasoning);
  }

  if (multiplierApplied) {
    reasoningParts.push(`${multiplier}x (${multiplierReason.split(' (')[0]})`);
  }

  return {
    total,
    rawScore,
    recencyBonus: recencyResult.bonus,
    qualityBonus: qualityResult.bonus,
    patternBonus: patternResult.bonus,
    penalty: penaltyResult.penalty,
    multiplier,
    multiplierApplied,
    multiplierReason,
    worksInLast30Days,
    daysSinceMostRecentWork,
    hasBulletWork: hasBulletWork(workouts),
    bestRankPercentage,
    isFirstTimeStarter: isFTS,
    isLayoffReturnee: isLayoff,
    reasoning: reasoningParts.join(' | '),
    breakdown: {
      recency: recencyResult.reasoning,
      quality: qualityResult.reasoning,
      pattern: patternResult.reasoning,
      penalty: penaltyResult.reasoning,
    },
  };
}

/**
 * Check if horse has significant workout advantage
 * Returns true if workout score is 4+ pts
 */
export function hasWorkoutAdvantage(horse: HorseEntry): boolean {
  const result = calculateWorkoutScore(horse);
  return result.total >= 4;
}

/**
 * Get workout summary for display
 */
export function getWorkoutSummary(horse: HorseEntry): {
  emoji: string;
  label: string;
  score: number;
} {
  const result = calculateWorkoutScore(horse);

  if (result.total >= 6) {
    return { emoji: '🔥', label: 'Sharp', score: result.total };
  }

  if (result.total >= 4) {
    return { emoji: '✅', label: 'Good', score: result.total };
  }

  if (result.total >= 2) {
    return { emoji: '➡️', label: 'Fair', score: result.total };
  }

  if (result.total >= 0) {
    return { emoji: '⚠️', label: 'Light', score: result.total };
  }

  return { emoji: '❌', label: 'Concern', score: result.total };
}

/**
 * Get color for workout score
 */
export function getWorkoutScoreColor(score: number): string {
  if (score >= 6) return '#22c55e'; // Green - Sharp
  if (score >= 4) return '#4ade80'; // Light green - Good
  if (score >= 2) return '#eab308'; // Yellow - Fair
  if (score >= 0) return '#f97316'; // Orange - Light
  return '#ef4444'; // Red - Concern
}
