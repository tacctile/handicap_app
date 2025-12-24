/**
 * Form Scoring Module
 * Analyzes recent race form, layoff patterns, and consistency
 *
 * Score Breakdown (v2.0 - Industry-Aligned Weights):
 * - Recent Form Score: 0-20 points (last 3 races)
 * - Layoff Analysis: 0-13 points
 * - Consistency Bonus: 0-7 points
 *
 * Total: 0-40 points (16.7% of 240 base)
 *
 * NOTE: Form increased from 30 to 40 points to better capture
 * recent performance patterns and their predictive value.
 */

import type { HorseEntry, PastPerformance } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

export interface FormScoreResult {
  total: number;
  recentFormScore: number;
  layoffScore: number;
  consistencyBonus: number;
  lastRaceResult: string;
  daysSinceRace: number | null;
  itmStreak: number;
  formTrend: 'improving' | 'declining' | 'steady' | 'unknown';
  reasoning: string;
}

// ============================================================================
// RECENT FORM ANALYSIS
// ============================================================================

/**
 * Analyze a single race finish for form score
 * Rescaled from 15 max to 20 max (scale factor: 40/30 = 1.3333)
 */
function analyzeRaceFinish(pp: PastPerformance): number {
  // Won the race
  if (pp.finishPosition === 1) {
    return 20; // was 15
  }

  // 2nd or 3rd within 2 lengths
  if (pp.finishPosition === 2 && pp.lengthsBehind <= 2) {
    return 16; // was 12
  }
  if (pp.finishPosition === 3 && pp.lengthsBehind <= 2) {
    return 15; // was 11
  }

  // 2nd or 3rd more than 2 lengths
  if (pp.finishPosition === 2) {
    return 13; // was 10
  }
  if (pp.finishPosition === 3) {
    return 12; // was 9
  }

  // 4th-5th competitive effort
  if (pp.finishPosition <= 5 && pp.lengthsBehind < 5) {
    return 11; // was 8
  }

  // 4th-5th less competitive
  if (pp.finishPosition <= 5) {
    return 8; // was 6
  }

  // 6th-8th
  if (pp.finishPosition <= 8) {
    return 5; // was 4
  }

  // Poor effort
  return 4; // was 3
}

/**
 * Determine form trend from last 3 races
 */
function analyzeFormTrend(
  pastPerformances: PastPerformance[]
): 'improving' | 'declining' | 'steady' | 'unknown' {
  if (pastPerformances.length < 2) {
    return 'unknown';
  }

  const races = pastPerformances.slice(0, 3);

  // Calculate scores for each race
  const scores = races.map(analyzeRaceFinish);

  if (scores.length < 2) return 'unknown';

  // Compare first (most recent) to last
  const mostRecent = scores[0];
  const oldest = scores[scores.length - 1];

  // Check for undefined (shouldn't happen but TypeScript needs assurance)
  if (mostRecent === undefined || oldest === undefined) {
    return 'unknown';
  }

  const diff = mostRecent - oldest;

  if (diff >= 3) return 'improving';
  if (diff <= -3) return 'declining';
  return 'steady';
}

/**
 * Calculate recent form score from last 3 races
 * Rescaled from 15 max to 20 max (scale factor: 40/30 = 1.3333)
 */
function calculateRecentFormScore(pastPerformances: PastPerformance[]): {
  score: number;
  lastResult: string;
} {
  if (pastPerformances.length === 0) {
    return { score: 11, lastResult: 'First starter' }; // Neutral for debut (was 8)
  }

  const recentPPs = pastPerformances.slice(0, 3);

  // Weight recent races more heavily
  // Last race = 50%, 2nd last = 30%, 3rd last = 20%
  const weights = [0.5, 0.3, 0.2];

  let weightedScore = 0;
  let totalWeight = 0;

  for (let i = 0; i < recentPPs.length; i++) {
    const pp = recentPPs[i];
    if (!pp) continue;
    const raceScore = analyzeRaceFinish(pp);
    const weight = weights[i] ?? 0.1;
    weightedScore += raceScore * weight;
    totalWeight += weight;
  }

  // Normalize score
  const score = Math.round(weightedScore / totalWeight);

  // Build last result string
  const lastPP = pastPerformances[0];
  if (!lastPP) {
    return { score: 11, lastResult: 'No race history' }; // was 8
  }
  let lastResult = `${ordinal(lastPP.finishPosition)} of ${lastPP.fieldSize}`;
  if (lastPP.lengthsBehind > 0) {
    lastResult += ` (${lastPP.lengthsBehind.toFixed(1)}L behind)`;
  }

  return { score: Math.min(20, score), lastResult }; // was 15
}

// ============================================================================
// LAYOFF ANALYSIS
// ============================================================================

/**
 * Calculate layoff score based on days since last race
 * Rescaled from 10 max to 13 max (scale factor: 40/30 = 1.3333)
 */
function calculateLayoffScore(
  daysSinceRace: number | null,
  pastPerformances: PastPerformance[]
): { score: number; reasoning: string } {
  if (daysSinceRace === null || pastPerformances.length === 0) {
    // First-time starter - check for workouts instead
    return { score: 7, reasoning: 'First-time starter' }; // was 5
  }

  // Optimal: 7-35 days (fresh but race fit)
  if (daysSinceRace >= 7 && daysSinceRace <= 35) {
    return { score: 13, reasoning: `Optimal layoff (${daysSinceRace} days)` }; // was 10
  }

  // Good: 36-60 days (short freshening)
  if (daysSinceRace >= 36 && daysSinceRace <= 60) {
    return { score: 9, reasoning: `Short freshening (${daysSinceRace} days)` }; // was 7
  }

  // Moderate: 61-90 days (layoff concern)
  if (daysSinceRace >= 61 && daysSinceRace <= 90) {
    return { score: 5, reasoning: `Moderate layoff (${daysSinceRace} days)` }; // was 4
  }

  // Long layoff: 90+ days
  if (daysSinceRace > 90) {
    // Check if horse has won off layoff before
    const hasWonOffLayoff = checkLayoffPattern(pastPerformances);

    if (hasWonOffLayoff) {
      return { score: 7, reasoning: `Long layoff (${daysSinceRace} days) but has won fresh` }; // was 5
    }

    return { score: 0, reasoning: `Extended layoff concern (${daysSinceRace} days)` };
  }

  // Very quick turnback: <7 days (may be worn down)
  if (daysSinceRace < 7) {
    return { score: 8, reasoning: `Quick turnback (${daysSinceRace} days)` }; // was 6
  }

  return { score: 7, reasoning: `${daysSinceRace} days since last` }; // was 5
}

/**
 * Check if horse has pattern of winning off layoffs
 */
function checkLayoffPattern(pastPerformances: PastPerformance[]): boolean {
  // Look for wins after 60+ day layoffs
  for (let i = 0; i < pastPerformances.length - 1; i++) {
    const pp = pastPerformances[i];
    if (pp && pp.finishPosition === 1 && pp.daysSinceLast !== null && pp.daysSinceLast >= 60) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// CONSISTENCY ANALYSIS
// ============================================================================

/**
 * Count consecutive ITM (in the money) finishes
 */
function countITMStreak(pastPerformances: PastPerformance[]): number {
  let streak = 0;

  for (const pp of pastPerformances) {
    if (pp.finishPosition <= 3) {
      streak++;
    } else {
      break; // Streak broken
    }
  }

  return streak;
}

/**
 * Calculate consistency bonus (0-7 points)
 * Rescaled from 5 max to 7 max (scale factor: 40/30 = 1.3333)
 */
function calculateConsistencyBonus(pastPerformances: PastPerformance[]): {
  bonus: number;
  streak: number;
  reasoning: string;
} {
  const itmStreak = countITMStreak(pastPerformances);

  if (itmStreak >= 3) {
    return {
      bonus: 7, // was 5
      streak: itmStreak,
      reasoning: `Hot streak: ${itmStreak} ITM in a row`,
    };
  }

  if (itmStreak === 2) {
    return {
      bonus: 4, // was 3
      streak: itmStreak,
      reasoning: '2 consecutive ITM finishes',
    };
  }

  if (itmStreak === 1) {
    return {
      bonus: 1,
      streak: itmStreak,
      reasoning: 'ITM last out',
    };
  }

  // Check overall consistency (ITM rate in last 5)
  const lastFive = pastPerformances.slice(0, 5);
  const itmCount = lastFive.filter((pp) => pp.finishPosition <= 3).length;

  if (itmCount >= 4) {
    return {
      bonus: 4, // was 3
      streak: 0,
      reasoning: `Consistent: ${itmCount}/5 ITM recent`,
    };
  }

  return { bonus: 0, streak: 0, reasoning: 'No consistency bonus' };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  const index1 = (v - 20) % 10;
  const suffix =
    (index1 >= 0 && index1 < s.length ? s[index1] : undefined) ??
    (v >= 0 && v < s.length ? s[v] : undefined) ??
    s[0];
  return n + (suffix ?? 'th');
}

/**
 * Build overall reasoning string
 */
function buildReasoning(
  lastResult: string,
  formTrend: string,
  layoffReason: string,
  consistencyReason: string
): string {
  const parts = [lastResult];

  if (formTrend !== 'unknown') {
    parts.push(`Form: ${formTrend}`);
  }

  parts.push(layoffReason);

  if (consistencyReason !== 'No consistency bonus') {
    parts.push(consistencyReason);
  }

  return parts.join(' | ');
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Calculate form score for a horse
 *
 * @param horse - The horse entry to score
 * @returns Detailed score breakdown
 */
export function calculateFormScore(horse: HorseEntry): FormScoreResult {
  const pastPerformances = horse.pastPerformances;

  // Calculate recent form
  const formResult = calculateRecentFormScore(pastPerformances);

  // Calculate layoff score
  const layoffResult = calculateLayoffScore(horse.daysSinceLastRace, pastPerformances);

  // Calculate consistency bonus
  const consistencyResult = calculateConsistencyBonus(pastPerformances);

  // Determine form trend
  const formTrend = analyzeFormTrend(pastPerformances);

  // Calculate total
  const total = formResult.score + layoffResult.score + consistencyResult.bonus;

  // Build reasoning
  const reasoning = buildReasoning(
    formResult.lastResult,
    formTrend,
    layoffResult.reasoning,
    consistencyResult.reasoning
  );

  return {
    total: Math.min(40, total), // was 30
    recentFormScore: formResult.score,
    layoffScore: layoffResult.score,
    consistencyBonus: consistencyResult.bonus,
    lastRaceResult: formResult.lastResult,
    daysSinceRace: horse.daysSinceLastRace,
    itmStreak: consistencyResult.streak,
    formTrend,
    reasoning,
  };
}

/**
 * Check if horse is on a hot streak
 */
export function isOnHotStreak(horse: HorseEntry): boolean {
  return countITMStreak(horse.pastPerformances) >= 3;
}

/**
 * Get form summary for quick display
 */
export function getFormSummary(horse: HorseEntry): { emoji: string; label: string } {
  const itmStreak = countITMStreak(horse.pastPerformances);
  const formTrend = analyzeFormTrend(horse.pastPerformances);

  if (itmStreak >= 3) {
    return { emoji: '🔥', label: 'Hot' };
  }

  if (formTrend === 'improving') {
    return { emoji: '📈', label: 'Improving' };
  }

  if (formTrend === 'declining') {
    return { emoji: '📉', label: 'Declining' };
  }

  if (horse.daysSinceLastRace && horse.daysSinceLastRace > 90) {
    return { emoji: '😴', label: 'Layoff' };
  }

  return { emoji: '➡️', label: 'Steady' };
}
