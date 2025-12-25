/**
 * Form Scoring Module
 * Analyzes recent race form, layoff patterns, and consistency
 *
 * Score Breakdown (v2.5 - Favorite Fix):
 * - Recent Form Score: 0-20 points (last 3 races)
 * - Layoff Analysis: 0-13 points
 * - Consistency Bonus: 0-7 points
 * - Recent Winner Bonuses: 0-10 points (NEW in v2.5)
 *   - Won Last Out: +8 pts
 *   - Won 2 of Last 3: +4 pts (if didn't win last out)
 *
 * Total: 0-50 points (increased from 40)
 *
 * NOTE: Form increased from 40 to 50 points per diagnostic findings.
 * Recent winners (favorites) were being systematically undervalued.
 * A horse that won its last race should score high in form.
 *
 * FIX v2.1: Added class-context adjustment for Recent Form.
 * Losses at higher class levels are now treated as neutral when
 * the horse is dropping in class. This prevents class droppers
 * (one of the strongest betting angles) from being penalized.
 */

import type { HorseEntry, PastPerformance, RaceClassification } from '../../types/drf';
import {
  buildBeatenLengthsProfile,
  calculateBeatenLengthsAdjustments,
  type BeatenLengthsProfile,
} from './beatenLengths';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Class context for comparing past race class to today's race
 */
export interface ClassContext {
  /** Today's race classification */
  classification: RaceClassification;
  /** Today's race claiming price (if applicable) */
  claimingPrice: number | null;
  /** Today's race purse */
  purse: number;
}

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
  /** Whether class context adjustment was applied to any race */
  classAdjustmentApplied: boolean;
  /** Details of class adjustments made */
  classAdjustments: string[];
  /** Beaten lengths bonus/penalty (from closing patterns) */
  beatenLengthsBonus: number;
  /** Beaten lengths profile analysis */
  beatenLengthsProfile: BeatenLengthsProfile | null;
  /** Beaten lengths reasoning */
  beatenLengthsReasoning: string;
  /** v2.5: Recent winner bonus (0-10 pts) */
  recentWinnerBonus: number;
  /** v2.5: Won last race */
  wonLastOut: boolean;
  /** v2.5: Won 2 of last 3 races */
  won2OfLast3: boolean;
}

// ============================================================================
// CLASS HIERARCHY
// ============================================================================

/**
 * Class hierarchy levels (higher number = higher class)
 * Used to compare past race class to today's race class
 */
const CLASS_HIERARCHY: Record<RaceClassification, number> = {
  'maiden-claiming': 1,
  maiden: 2,
  claiming: 3, // Base claiming, adjusted by price
  'starter-allowance': 4,
  allowance: 5,
  'allowance-optional-claiming': 6,
  handicap: 7,
  stakes: 8,
  'stakes-listed': 9,
  'stakes-graded-3': 10,
  'stakes-graded-2': 11,
  'stakes-graded-1': 12,
  unknown: 3, // Default to claiming level
};

/**
 * Get numeric class level for comparison
 * Incorporates claiming price and purse for finer granularity
 */
function getClassLevel(
  classification: RaceClassification,
  claimingPrice: number | null,
  purse: number
): number {
  let baseLevel = CLASS_HIERARCHY[classification] ?? 3;

  // For claiming races, adjust by price tier
  if (classification === 'claiming' && claimingPrice !== null) {
    if (claimingPrice >= 50000) {
      baseLevel = 3.8; // High claiming
    } else if (claimingPrice >= 25000) {
      baseLevel = 3.5; // Mid claiming
    } else if (claimingPrice >= 10000) {
      baseLevel = 3.2; // Low-mid claiming
    } else {
      baseLevel = 3.0; // Bottom claiming
    }
  }

  // For maiden claiming, adjust by price
  if (classification === 'maiden-claiming' && claimingPrice !== null) {
    if (claimingPrice >= 30000) {
      baseLevel = 1.8;
    } else if (claimingPrice >= 15000) {
      baseLevel = 1.5;
    } else {
      baseLevel = 1.0;
    }
  }

  // Use purse as secondary indicator for allowance/stakes
  // Higher purse within same classification = slightly higher class
  if (classification === 'allowance' || classification === 'allowance-optional-claiming') {
    if (purse >= 100000) {
      baseLevel += 0.5;
    } else if (purse >= 75000) {
      baseLevel += 0.3;
    }
  }

  return baseLevel;
}

/**
 * Compare two class levels and return the relationship
 * @returns 'higher' if pastClass > todayClass, 'lower' if pastClass < todayClass, 'same' otherwise
 */
function compareClassLevels(
  pastClassLevel: number,
  todayClassLevel: number
): 'higher' | 'lower' | 'same' {
  const diff = pastClassLevel - todayClassLevel;

  // Consider classes within 0.5 as "same"
  if (Math.abs(diff) <= 0.5) {
    return 'same';
  }

  return diff > 0 ? 'higher' : 'lower';
}

/**
 * Get a human-readable description of the class comparison
 */
function getClassComparisonLabel(
  pastClassification: RaceClassification,
  _todayClassification: RaceClassification,
  comparison: 'higher' | 'lower' | 'same'
): string {
  if (comparison === 'same') {
    return 'same class';
  }

  const classNames: Record<RaceClassification, string> = {
    'maiden-claiming': 'MCL',
    maiden: 'MSW',
    claiming: 'CLM',
    'starter-allowance': 'STR ALW',
    allowance: 'ALW',
    'allowance-optional-claiming': 'AOC',
    handicap: 'HCP',
    stakes: 'STK',
    'stakes-listed': 'Listed',
    'stakes-graded-3': 'G3',
    'stakes-graded-2': 'G2',
    'stakes-graded-1': 'G1',
    unknown: 'UNK',
  };

  const pastName = classNames[pastClassification] ?? pastClassification;
  return comparison === 'higher' ? `vs ${pastName}` : `vs ${pastName} (lower)`;
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
 * Result from analyzing a race finish with class context
 */
interface ClassContextFinishResult {
  score: number;
  classAdjusted: boolean;
  adjustmentNote: string | null;
}

/**
 * Analyze a single race finish for form score WITH class context
 * Applies class-context adjustment when past race was at higher class
 *
 * Per requirements:
 * - WIN at any class level still scores maximum points (20)
 * - If past race was HIGHER class than today → treat loss as NEUTRAL:
 *   - 4th-6th place at higher class = 12-14 pts (not 8-10)
 *   - 7th+ at higher class = 10-12 pts (not 4-5)
 * - If past race was SAME class as today → score normally
 */
function analyzeRaceFinishWithClassContext(
  pp: PastPerformance,
  todayContext: ClassContext | null
): ClassContextFinishResult {
  // If no class context provided, use regular scoring
  if (!todayContext) {
    return {
      score: analyzeRaceFinish(pp),
      classAdjusted: false,
      adjustmentNote: null,
    };
  }

  // Get class levels for comparison
  const pastClassLevel = getClassLevel(pp.classification, pp.claimingPrice, pp.purse);
  const todayClassLevel = getClassLevel(
    todayContext.classification,
    todayContext.claimingPrice,
    todayContext.purse
  );

  const classComparison = compareClassLevels(pastClassLevel, todayClassLevel);

  // Wins always score maximum regardless of class
  if (pp.finishPosition === 1) {
    const label = getClassComparisonLabel(
      pp.classification,
      todayContext.classification,
      classComparison
    );
    return {
      score: 20,
      classAdjusted: false,
      adjustmentNote: classComparison === 'higher' ? `Won ${label}` : null,
    };
  }

  // 2nd or 3rd - award bonus points if at higher class
  if (pp.finishPosition === 2 || pp.finishPosition === 3) {
    const baseScore = analyzeRaceFinish(pp);

    if (classComparison === 'higher') {
      // 2nd/3rd at higher class is excellent - boost to near-win level
      const adjustedScore = Math.min(18, baseScore + 3);
      const label = getClassComparisonLabel(
        pp.classification,
        todayContext.classification,
        classComparison
      );
      return {
        score: adjustedScore,
        classAdjusted: true,
        adjustmentNote: `${ordinal(pp.finishPosition)} ${label} (+${adjustedScore - baseScore})`,
      };
    }

    return {
      score: baseScore,
      classAdjusted: false,
      adjustmentNote: null,
    };
  }

  // 4th-6th at higher class → treat as neutral (12-14 pts instead of 8-11)
  if (pp.finishPosition >= 4 && pp.finishPosition <= 6) {
    const baseScore = analyzeRaceFinish(pp);

    if (classComparison === 'higher') {
      // Upgrade to neutral: 12-14 pts
      const adjustedScore = Math.max(12, Math.min(14, baseScore + 4));
      const label = getClassComparisonLabel(
        pp.classification,
        todayContext.classification,
        classComparison
      );
      return {
        score: adjustedScore,
        classAdjusted: true,
        adjustmentNote: `${ordinal(pp.finishPosition)} ${label} (+${adjustedScore - baseScore})`,
      };
    }

    return {
      score: baseScore,
      classAdjusted: false,
      adjustmentNote: null,
    };
  }

  // 7th+ at higher class → treat as neutral (10-12 pts instead of 4-5)
  if (pp.finishPosition >= 7) {
    const baseScore = analyzeRaceFinish(pp);

    if (classComparison === 'higher') {
      // Upgrade to neutral: 10-12 pts
      const adjustedScore = Math.max(10, Math.min(12, baseScore + 6));
      const label = getClassComparisonLabel(
        pp.classification,
        todayContext.classification,
        classComparison
      );
      return {
        score: adjustedScore,
        classAdjusted: true,
        adjustmentNote: `${ordinal(pp.finishPosition)} ${label} (+${adjustedScore - baseScore})`,
      };
    }

    return {
      score: baseScore,
      classAdjusted: false,
      adjustmentNote: null,
    };
  }

  // Fallback
  return {
    score: analyzeRaceFinish(pp),
    classAdjusted: false,
    adjustmentNote: null,
  };
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
 * Result from calculating recent form with class context
 */
interface RecentFormResult {
  score: number;
  lastResult: string;
  classAdjustmentApplied: boolean;
  classAdjustments: string[];
}

/**
 * Calculate recent form score from last 3 races
 * Rescaled from 15 max to 20 max (scale factor: 40/30 = 1.3333)
 *
 * @param pastPerformances - Array of past performance records
 * @param todayContext - Optional class context for today's race
 */
function calculateRecentFormScore(
  pastPerformances: PastPerformance[],
  todayContext: ClassContext | null = null
): RecentFormResult {
  if (pastPerformances.length === 0) {
    return {
      score: 11,
      lastResult: 'First starter',
      classAdjustmentApplied: false,
      classAdjustments: [],
    }; // Neutral for debut (was 8)
  }

  const recentPPs = pastPerformances.slice(0, 3);

  // Weight recent races more heavily
  // Last race = 50%, 2nd last = 30%, 3rd last = 20%
  const weights = [0.5, 0.3, 0.2];

  let weightedScore = 0;
  let totalWeight = 0;
  let anyClassAdjusted = false;
  const classAdjustments: string[] = [];

  for (let i = 0; i < recentPPs.length; i++) {
    const pp = recentPPs[i];
    if (!pp) continue;

    // Use class-context scoring if context provided
    const result = analyzeRaceFinishWithClassContext(pp, todayContext);
    const raceScore = result.score;

    if (result.classAdjusted) {
      anyClassAdjusted = true;
    }
    if (result.adjustmentNote) {
      classAdjustments.push(result.adjustmentNote);
    }

    const weight = weights[i] ?? 0.1;
    weightedScore += raceScore * weight;
    totalWeight += weight;
  }

  // Normalize score
  const score = Math.round(weightedScore / totalWeight);

  // Build last result string
  const lastPP = pastPerformances[0];
  if (!lastPP) {
    return {
      score: 11,
      lastResult: 'No race history',
      classAdjustmentApplied: false,
      classAdjustments: [],
    }; // was 8
  }
  let lastResult = `${ordinal(lastPP.finishPosition)} of ${lastPP.fieldSize}`;
  if (lastPP.lengthsBehind > 0) {
    lastResult += ` (${lastPP.lengthsBehind.toFixed(1)}L behind)`;
  }

  return {
    score: Math.min(20, score),
    lastResult,
    classAdjustmentApplied: anyClassAdjusted,
    classAdjustments,
  }; // was 15
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
// RECENT WINNER BONUS (v2.5 - Favorite Fix)
// ============================================================================

/**
 * Maximum recent winner bonus points
 * Won Last Out = 8 pts, Won 2 of Last 3 = 4 pts (not cumulative)
 */
const MAX_RECENT_WINNER_BONUS = 10;

/**
 * Calculate recent winner bonus (v2.5)
 *
 * Per diagnostic findings, recent winners (often favorites) were being
 * undervalued. This bonus ensures horses that recently won score high.
 *
 * Scoring:
 * - Won Last Out: +8 pts (strong signal of current form)
 * - Won 2 of Last 3: +4 pts (consistent winner, if didn't win last out)
 *
 * @param pastPerformances - Horse's past performances
 * @returns Bonus points and analysis
 */
function calculateRecentWinnerBonus(pastPerformances: PastPerformance[]): {
  bonus: number;
  wonLastOut: boolean;
  won2OfLast3: boolean;
  reasoning: string;
} {
  if (pastPerformances.length === 0) {
    return {
      bonus: 0,
      wonLastOut: false,
      won2OfLast3: false,
      reasoning: 'No race history',
    };
  }

  const lastPP = pastPerformances[0];
  const wonLastOut = lastPP?.finishPosition === 1;

  // Count wins in last 3 races
  const last3 = pastPerformances.slice(0, 3);
  const winsInLast3 = last3.filter((pp) => pp.finishPosition === 1).length;
  const won2OfLast3 = winsInLast3 >= 2;

  let bonus = 0;
  let reasoning = '';

  if (wonLastOut) {
    // Won last out gets the big bonus
    bonus = 8;
    reasoning = 'Won Last Out (+8 pts)';

    // If also won 2 of 3, add extra
    if (winsInLast3 >= 2 && pastPerformances.length >= 2) {
      bonus = 10; // 8 + 2 extra for multiple recent wins
      reasoning = `Won Last Out + ${winsInLast3}/3 wins (+10 pts)`;
    }
  } else if (won2OfLast3) {
    // Didn't win last out but won 2 of 3 still gets credit
    bonus = 4;
    reasoning = `Won ${winsInLast3} of last 3 (+4 pts)`;
  }

  return {
    bonus: Math.min(bonus, MAX_RECENT_WINNER_BONUS),
    wonLastOut,
    won2OfLast3,
    reasoning,
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Calculate form score for a horse
 *
 * @param horse - The horse entry to score
 * @param todayContext - Optional class context for today's race (enables class-aware scoring)
 * @returns Detailed score breakdown
 */
export function calculateFormScore(
  horse: HorseEntry,
  todayContext?: ClassContext
): FormScoreResult {
  const pastPerformances = horse.pastPerformances;

  // Calculate recent form with class context
  const formResult = calculateRecentFormScore(pastPerformances, todayContext ?? null);

  // Calculate layoff score
  const layoffResult = calculateLayoffScore(horse.daysSinceLastRace, pastPerformances);

  // Calculate consistency bonus
  const consistencyResult = calculateConsistencyBonus(pastPerformances);

  // Determine form trend
  const formTrend = analyzeFormTrend(pastPerformances);

  // Calculate beaten lengths adjustments (closing patterns, etc.)
  const beatenLengthsAdjustments = calculateBeatenLengthsAdjustments(horse);
  const beatenLengthsProfile = buildBeatenLengthsProfile(pastPerformances);

  // v2.5: Calculate recent winner bonus
  const recentWinnerResult = calculateRecentWinnerBonus(pastPerformances);

  // Calculate total with beaten lengths bonus/penalty AND recent winner bonus
  const baseTotal = formResult.score + layoffResult.score + consistencyResult.bonus;
  const total = baseTotal + beatenLengthsAdjustments.formPoints + recentWinnerResult.bonus;

  // Build reasoning with class context info
  let reasoning = buildReasoning(
    formResult.lastResult,
    formTrend,
    layoffResult.reasoning,
    consistencyResult.reasoning
  );

  // Add class adjustment info to reasoning if applied
  if (formResult.classAdjustmentApplied && formResult.classAdjustments.length > 0) {
    reasoning += ` | Class drop: ${formResult.classAdjustments.join(', ')}`;
  }

  // Add beaten lengths info to reasoning if applicable
  if (beatenLengthsAdjustments.formPoints !== 0) {
    reasoning += ` | ${beatenLengthsAdjustments.formReasoning}`;
  }

  // v2.5: Add recent winner bonus to reasoning
  if (recentWinnerResult.bonus > 0) {
    reasoning += ` | ${recentWinnerResult.reasoning}`;
  }

  return {
    total: Math.min(50, Math.max(0, total)), // Cap at 0-50 (v2.5: increased from 40)
    recentFormScore: formResult.score,
    layoffScore: layoffResult.score,
    consistencyBonus: consistencyResult.bonus,
    lastRaceResult: formResult.lastResult,
    daysSinceRace: horse.daysSinceLastRace,
    itmStreak: consistencyResult.streak,
    formTrend,
    reasoning,
    classAdjustmentApplied: formResult.classAdjustmentApplied,
    classAdjustments: formResult.classAdjustments,
    beatenLengthsBonus: beatenLengthsAdjustments.formPoints,
    beatenLengthsProfile,
    beatenLengthsReasoning: beatenLengthsAdjustments.formReasoning,
    recentWinnerBonus: recentWinnerResult.bonus,
    wonLastOut: recentWinnerResult.wonLastOut,
    won2OfLast3: recentWinnerResult.won2OfLast3,
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
