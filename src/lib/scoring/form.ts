/**
 * Form Scoring Module
 * Analyzes recent race form, layoff patterns, and consistency
 *
 * Score Breakdown (v3.2 - Model B Speed-Dominant Rebalance):
 *
 * FORM SCORING BREAKDOWN (42 pts max, reduced from 50)
 *
 * Recent Performance Base: 0-15 pts (reduced from 18)
 *   - Last 3 race finishes weighted (50%, 30%, 20%)
 *   - 1st = 15 pts, 2nd/3rd (<2L) = 12 pts, 2nd/3rd (>2L) = 9 pts
 *   - 4th-5th (competitive) = 7 pts, lower = 3-5 pts
 *
 * Winner Bonuses: 0-20 pts (reduced from 28)
 *   - Won Last Out: +12 pts (strong signal, not dominant)
 *   - Won 2 of Last 3: +5 pts (stacks with above)
 *   - Won 3 of Last 5: +3 pts (stacks, rewards consistent winners)
 *   - Win Recency (within 30 days): +3 pts (hot horse bonus)
 *
 * Consistency: 0-4 pts (unchanged)
 *   - ITM 50%+ in last 10: 4 pts
 *   - ITM 40-49%: 3 pts
 *   - ITM 30-39%: 2 pts
 *   - ITM 20-29%: 1 pt
 *   - ITM <20%: 0 pts
 *
 * TOTAL MAX: 15 + 20 + 4 + 3 = 42 pts
 *
 * Layoff Adjustments:
 *   - Optimal (7-35 days): 0 penalty
 *   - Freshening (36-60 days): -2 penalty
 *   - Moderate (61-90 days): -5 penalty
 *   - Extended (90+ days): -10 penalty (capped, never wipes out winner bonus)
 *   - Minimum form score: 5 pts (never fully zero out a recent winner)
 *
 * MODEL B CHANGES (v3.2):
 * - Form cap reduced from 50 to 42 to prioritize Speed (105) + Class (35)
 * - Winner bonuses scaled down to prevent Form from overpowering Speed
 * - Base performance rescaled proportionally
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
  /** v3.2: Recent winner bonus (0-20 pts, reduced from 28 for Model B) */
  recentWinnerBonus: number;
  /** v2.5: Won last race */
  wonLastOut: boolean;
  /** v2.5: Won 2 of last 3 races */
  won2OfLast3: boolean;
  /** v3.0: Won 3 of last 5 races */
  won3OfLast5: boolean;
  /** v3.0: Days since last win (null if never won) */
  daysSinceLastWin: number | null;
  /** v3.0: Win recency bonus (0-4 pts for winning within 30/60 days) */
  winRecencyBonus: number;
  /** v3.0: Layoff penalty applied (capped at 10) */
  layoffPenalty: number;
  /** Phase 2: Form confidence info for data completeness */
  formConfidence?: {
    /** Number of valid past performances */
    ppCount: number;
    /** Confidence multiplier applied (0.2-1.0) */
    multiplier: number;
    /** Maximum possible form score given data availability */
    maxPossibleScore: number;
    /** Whether confidence penalty was applied */
    penaltyApplied: boolean;
  };
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
 * v3.2: Rescaled from 18 max to 15 max for Model B (42 pt Form cap)
 *
 * Scoring:
 * - 1st = 15 pts (was 18)
 * - 2nd within 2L = 12 pts (was 14)
 * - 3rd within 2L = 12 pts (was 13)
 * - 2nd >2L = 9 pts (was 11)
 * - 3rd >2L = 9 pts (was 10)
 * - 4th-5th competitive = 7 pts (was 9)
 * - 4th-5th = 5 pts (was 7)
 * - 6th-8th = 4 pts (unchanged)
 * - 9th+ = 3 pts (unchanged)
 */
function analyzeRaceFinish(pp: PastPerformance): number {
  // Won the race
  if (pp.finishPosition === 1) {
    return 15; // v3.2: reduced from 18 for Model B
  }

  // 2nd or 3rd within 2 lengths
  if (pp.finishPosition === 2 && pp.lengthsBehind <= 2) {
    return 12; // v3.2: reduced from 14
  }
  if (pp.finishPosition === 3 && pp.lengthsBehind <= 2) {
    return 12; // v3.2: reduced from 13
  }

  // 2nd or 3rd more than 2 lengths
  if (pp.finishPosition === 2) {
    return 9; // v3.2: reduced from 11
  }
  if (pp.finishPosition === 3) {
    return 9; // v3.2: reduced from 10
  }

  // 4th-5th competitive effort
  if (pp.finishPosition <= 5 && pp.lengthsBehind < 5) {
    return 7; // v3.2: reduced from 9
  }

  // 4th-5th less competitive
  if (pp.finishPosition <= 5) {
    return 5; // v3.2: reduced from 7
  }

  // 6th-8th
  if (pp.finishPosition <= 8) {
    return 4; // v3.2: unchanged
  }

  // Poor effort
  return 3; // v3.2: unchanged
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
 * v3.2: Updated for new 15 pt max base scoring (Model B)
 *
 * Per requirements:
 * - WIN at any class level still scores maximum points (15)
 * - If past race was HIGHER class than today → treat loss as NEUTRAL:
 *   - 4th-6th place at higher class = 9-11 pts (scaled from 11-13)
 *   - 7th+ at higher class = 7-9 pts (scaled from 9-11)
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
      score: 15, // v3.2: reduced from 18 for Model B
      classAdjusted: false,
      adjustmentNote: classComparison === 'higher' ? `Won ${label}` : null,
    };
  }

  // 2nd or 3rd - award bonus points if at higher class
  if (pp.finishPosition === 2 || pp.finishPosition === 3) {
    const baseScore = analyzeRaceFinish(pp);

    if (classComparison === 'higher') {
      // 2nd/3rd at higher class is excellent - boost to near-win level
      const adjustedScore = Math.min(14, baseScore + 2); // v3.2: capped at 14 (was 16)
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

  // 4th-6th at higher class → treat as neutral (9-11 pts, scaled from 11-13)
  if (pp.finishPosition >= 4 && pp.finishPosition <= 6) {
    const baseScore = analyzeRaceFinish(pp);

    if (classComparison === 'higher') {
      // Upgrade to neutral: 9-11 pts (v3.2: scaled from 11-13)
      const adjustedScore = Math.max(9, Math.min(11, baseScore + 4));
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

  // 7th+ at higher class → treat as neutral (7-9 pts, scaled from 9-11)
  if (pp.finishPosition >= 7) {
    const baseScore = analyzeRaceFinish(pp);

    if (classComparison === 'higher') {
      // Upgrade to neutral: 7-9 pts (v3.2: scaled from 9-11)
      const adjustedScore = Math.max(7, Math.min(9, baseScore + 4));
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
 * v3.2: Rescaled from 18 max to 15 max for Model B (42 pt Form cap)
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
      score: 8, // v3.2: Neutral for debut (scaled from 9)
      lastResult: 'First starter',
      classAdjustmentApplied: false,
      classAdjustments: [],
    };
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
      score: 8, // v3.2: Neutral (scaled from 9)
      lastResult: 'No race history',
      classAdjustmentApplied: false,
      classAdjustments: [],
    };
  }
  let lastResult = `${ordinal(lastPP.finishPosition)} of ${lastPP.fieldSize}`;
  if (lastPP.lengthsBehind > 0) {
    lastResult += ` (${lastPP.lengthsBehind.toFixed(1)}L behind)`;
  }

  return {
    score: Math.min(15, score), // v3.2: capped at 15 (was 18)
    lastResult,
    classAdjustmentApplied: anyClassAdjusted,
    classAdjustments,
  };
}

// ============================================================================
// LAYOFF ANALYSIS
// ============================================================================

/**
 * Maximum layoff penalty (v3.0)
 * Layoff penalties are capped at 10 pts to preserve winner bonus value
 */
const MAX_LAYOFF_PENALTY = 10;

/**
 * Calculate layoff penalty based on days since last race
 * v3.0: Changed from score to PENALTY system
 *
 * Penalty Logic:
 * - Optimal (7-35 days): 0 penalty
 * - Quick turnback (<7 days): -2 penalty
 * - Short freshening (36-60 days): -3 penalty
 * - Moderate layoff (61-90 days): -6 penalty
 * - Extended layoff (90+ days): -10 penalty (capped)
 * - First-time starter: -2 penalty (unknown fitness)
 *
 * @returns penalty - Negative adjustment to form score (capped at -10)
 */
function calculateLayoffPenalty(
  daysSinceRace: number | null,
  pastPerformances: PastPerformance[]
): { penalty: number; reasoning: string } {
  if (daysSinceRace === null || pastPerformances.length === 0) {
    // First-time starter - slight penalty for unknown fitness
    return { penalty: -2, reasoning: 'First-time starter (unknown fitness)' };
  }

  // Optimal: 7-35 days (fresh but race fit) - NO PENALTY
  if (daysSinceRace >= 7 && daysSinceRace <= 35) {
    return { penalty: 0, reasoning: `Optimal layoff (${daysSinceRace} days)` };
  }

  // Quick turnback: <7 days (may be worn down) - slight penalty
  if (daysSinceRace < 7) {
    return { penalty: -2, reasoning: `Quick turnback (${daysSinceRace} days)` };
  }

  // Short freshening: 36-60 days - small penalty
  if (daysSinceRace >= 36 && daysSinceRace <= 60) {
    return { penalty: -3, reasoning: `Short freshening (${daysSinceRace} days)` };
  }

  // Moderate: 61-90 days (layoff concern) - moderate penalty
  if (daysSinceRace >= 61 && daysSinceRace <= 90) {
    return { penalty: -6, reasoning: `Moderate layoff (${daysSinceRace} days)` };
  }

  // Long layoff: 90+ days - capped penalty
  if (daysSinceRace > 90) {
    // Check if horse has won off layoff before - reduce penalty
    const hasWonOffLayoff = checkLayoffPattern(pastPerformances);

    if (hasWonOffLayoff) {
      return {
        penalty: -5,
        reasoning: `Long layoff (${daysSinceRace} days) but has won fresh`,
      };
    }

    // Standard extended layoff penalty (capped at MAX_LAYOFF_PENALTY)
    return {
      penalty: -MAX_LAYOFF_PENALTY,
      reasoning: `Extended layoff concern (${daysSinceRace} days)`,
    };
  }

  return { penalty: 0, reasoning: `${daysSinceRace} days since last` };
}

/**
 * Legacy function for backward compatibility
 * Converts penalty to score for older code paths
 * @deprecated Use calculateLayoffPenalty instead
 */
function calculateLayoffScore(
  daysSinceRace: number | null,
  pastPerformances: PastPerformance[]
): { score: number; reasoning: string } {
  const { penalty, reasoning } = calculateLayoffPenalty(daysSinceRace, pastPerformances);
  // Convert penalty to score: no penalty = 13 pts (max), -10 penalty = 3 pts (min)
  const baseLayoffScore = 13;
  const score = Math.max(0, baseLayoffScore + penalty);
  return { score, reasoning };
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
 * Calculate consistency bonus (0-4 points)
 * v3.0: Reduced from 7 max to 4 max to accommodate larger winner bonuses
 *
 * New Scoring (ITM rate based):
 * - ITM 50%+ in last 10: 4 pts
 * - ITM 40-49%: 3 pts
 * - ITM 30-39%: 2 pts
 * - ITM 20-29%: 1 pt
 * - ITM <20%: 0 pts
 *
 * Also awards bonus for hot streaks:
 * - 3+ consecutive ITM: 4 pts
 * - 2 consecutive ITM: 2 pts
 * - 1 ITM: 1 pt
 */
function calculateConsistencyBonus(pastPerformances: PastPerformance[]): {
  bonus: number;
  streak: number;
  reasoning: string;
} {
  if (pastPerformances.length === 0) {
    return { bonus: 0, streak: 0, reasoning: 'No race history' };
  }

  const itmStreak = countITMStreak(pastPerformances);

  // Hot streak gets max bonus
  if (itmStreak >= 3) {
    return {
      bonus: 4, // v3.0: reduced from 7
      streak: itmStreak,
      reasoning: `Hot streak: ${itmStreak} ITM in a row`,
    };
  }

  // Calculate ITM rate in last 10 (or fewer if less available)
  const last10 = pastPerformances.slice(0, 10);
  const itmCount = last10.filter((pp) => pp.finishPosition <= 3).length;
  const itmRate = itmCount / last10.length;

  // ITM rate based scoring (v3.0)
  if (itmRate >= 0.5) {
    return {
      bonus: 4, // 50%+ ITM
      streak: itmStreak,
      reasoning: `Consistent: ${Math.round(itmRate * 100)}% ITM (${itmCount}/${last10.length})`,
    };
  }

  if (itmRate >= 0.4) {
    return {
      bonus: 3, // 40-49% ITM
      streak: itmStreak,
      reasoning: `Good ITM rate: ${Math.round(itmRate * 100)}%`,
    };
  }

  if (itmRate >= 0.3) {
    return {
      bonus: 2, // 30-39% ITM
      streak: itmStreak,
      reasoning: `Moderate ITM rate: ${Math.round(itmRate * 100)}%`,
    };
  }

  if (itmRate >= 0.2) {
    return {
      bonus: 1, // 20-29% ITM
      streak: itmStreak,
      reasoning: `Low ITM rate: ${Math.round(itmRate * 100)}%`,
    };
  }

  // 2 consecutive ITM gets small bonus even with low overall rate
  if (itmStreak === 2) {
    return {
      bonus: 2, // v3.0: reduced from 4
      streak: itmStreak,
      reasoning: '2 consecutive ITM finishes',
    };
  }

  // 1 ITM last out gets tiny bonus
  if (itmStreak === 1) {
    return {
      bonus: 1,
      streak: itmStreak,
      reasoning: 'ITM last out',
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
// FORM CONFIDENCE (DATA COMPLETENESS PENALTIES - Phase 2)
// ============================================================================

/**
 * Get form confidence multiplier based on PP count
 *
 * PENALTY LOGIC (Phase 2 - Missing Data Penalties, v3.2 Model B):
 * - 3+ PPs → 100% confidence (full scoring, 42 pts max)
 * - 2 PPs → 60% confidence (25 pts max)
 * - 1 PP → 40% confidence (17 pts max)
 * - 0 PPs (first-time starter) → 20% confidence (8 pts max, penalized for unknown)
 *
 * This ensures horses with incomplete form data are penalized,
 * not given neutral scores that reward unknowns.
 */
export function getFormConfidenceMultiplier(ppCount: number): number {
  if (ppCount >= 3) return 1.0; // Full confidence
  if (ppCount === 2) return 0.6; // 60% confidence
  if (ppCount === 1) return 0.4; // 40% confidence
  return 0.2; // 20% baseline for first-time starters
}

// ============================================================================
// RECENT WINNER BONUS (v3.2 - Model B Winner Bonus)
// ============================================================================

/**
 * Winner bonus point values (v3.2 - Model B)
 * All bonuses stack when applicable
 * Reduced from v3.0 to fit 42 pt Form cap
 */
const WINNER_BONUSES = {
  wonLastOut: 12, // Won most recent race (strong signal, not dominant)
  won2of3: 5, // Won 2 of last 3 (stacks with above)
  won3of5: 3, // Won 3 of last 5 (stacks)
  lastWinWithin30Days: 3, // Won last out within 30 days (freshness/hot horse)
  lastWinWithin60Days: 2, // Won within 60 days (warm)
};

/**
 * Maximum recent winner bonus points (v3.2 - Model B)
 * Won Last Out (12) + Won 2/3 (5) + Won 3/5 (3) = 20 pts theoretical max
 * Reduced from 28 to fit within 42 pt Form cap
 */
const MAX_RECENT_WINNER_BONUS = 20;

/**
 * Calculate days since last win from past performances
 * @returns Days since last win, or null if horse has never won
 */
function getDaysSinceLastWin(pastPerformances: PastPerformance[]): number | null {
  if (pastPerformances.length === 0) return null;

  // Find the most recent win
  let cumulativeDays = 0;
  for (let i = 0; i < pastPerformances.length; i++) {
    const pp = pastPerformances[i];
    if (!pp) continue;

    // Add days since the previous race to get cumulative time
    if (i === 0 && pp.daysSinceLast !== null) {
      cumulativeDays = pp.daysSinceLast;
    } else if (pp.daysSinceLast !== null) {
      cumulativeDays += pp.daysSinceLast;
    }

    if (pp.finishPosition === 1) {
      // Found a win - if it's the most recent race, use its daysSinceLast
      if (i === 0) {
        return 0; // Won last race, 0 days "since" that win
      }
      return cumulativeDays;
    }
  }

  return null; // Never won
}

/**
 * Calculate win recency bonus (v3.2 - Model B)
 * Rewards horses that won recently (within 30/60 days)
 *
 * Scoring:
 * - Won within 30 days: +3 pts (hot horse)
 * - Won within 60 days: +2 pts (warm horse)
 * - Won 60+ days ago or never: 0 pts
 *
 * @param daysSinceLastWin - Days since horse's last win (null if never won)
 * @returns Bonus points
 */
function getWinRecencyBonus(daysSinceLastWin: number | null): {
  bonus: number;
  reasoning: string;
} {
  if (daysSinceLastWin === null) {
    return { bonus: 0, reasoning: 'No wins in history' };
  }

  if (daysSinceLastWin <= 30) {
    return {
      bonus: WINNER_BONUSES.lastWinWithin30Days,
      reasoning: `Hot: won within ${daysSinceLastWin} days (+${WINNER_BONUSES.lastWinWithin30Days} pts)`,
    };
  }

  if (daysSinceLastWin <= 60) {
    return {
      bonus: WINNER_BONUSES.lastWinWithin60Days,
      reasoning: `Warm: won within ${daysSinceLastWin} days (+${WINNER_BONUSES.lastWinWithin60Days} pts)`,
    };
  }

  return { bonus: 0, reasoning: `Cold: last win ${daysSinceLastWin}+ days ago` };
}

/**
 * Calculate recent winner bonus (v3.2 - Model B)
 *
 * STACKING LOGIC (all bonuses stack):
 * - Won Last Out: +12 pts
 * - Won 2 of 3: +5 pts (stacks)
 * - Won 3 of 5: +3 pts (stacks)
 *
 * EXAMPLES:
 * - Horse won last race only: +12 pts
 * - Horse won last race AND 2 of 3: +12 + 5 = +17 pts
 * - Horse won last race AND 2 of 3 AND 3 of 5: +12 + 5 + 3 = +20 pts (max)
 * - Horse won 2 of 3 but NOT last out: +5 pts
 *
 * @param pastPerformances - Horse's past performances
 * @returns Bonus points and analysis
 */
function calculateRecentWinnerBonus(pastPerformances: PastPerformance[]): {
  bonus: number;
  wonLastOut: boolean;
  won2OfLast3: boolean;
  won3OfLast5: boolean;
  reasoning: string;
} {
  if (pastPerformances.length === 0) {
    return {
      bonus: 0,
      wonLastOut: false,
      won2OfLast3: false,
      won3OfLast5: false,
      reasoning: 'No race history',
    };
  }

  const lastPP = pastPerformances[0];
  const wonLastOut = lastPP?.finishPosition === 1;

  // Count wins in last 3 races
  const last3 = pastPerformances.slice(0, 3);
  const winsInLast3 = last3.filter((pp) => pp.finishPosition === 1).length;
  const won2OfLast3 = winsInLast3 >= 2;

  // Count wins in last 5 races
  const last5 = pastPerformances.slice(0, 5);
  const winsInLast5 = last5.filter((pp) => pp.finishPosition === 1).length;
  const won3OfLast5 = winsInLast5 >= 3;

  // Calculate stacking bonus
  let bonus = 0;
  const reasoningParts: string[] = [];

  if (wonLastOut) {
    bonus += WINNER_BONUSES.wonLastOut;
    reasoningParts.push(`Won Last Out (+${WINNER_BONUSES.wonLastOut})`);
  }

  if (won2OfLast3) {
    bonus += WINNER_BONUSES.won2of3;
    reasoningParts.push(`Won ${winsInLast3}/3 (+${WINNER_BONUSES.won2of3})`);
  }

  if (won3OfLast5) {
    bonus += WINNER_BONUSES.won3of5;
    reasoningParts.push(`Won ${winsInLast5}/5 (+${WINNER_BONUSES.won3of5})`);
  }

  // Cap at maximum
  const cappedBonus = Math.min(bonus, MAX_RECENT_WINNER_BONUS);

  // Build reasoning
  let reasoning = '';
  if (reasoningParts.length > 0) {
    reasoning = reasoningParts.join(' | ');
    if (cappedBonus < bonus) {
      reasoning += ` (capped at ${cappedBonus})`;
    }
  } else {
    reasoning = 'No recent wins';
  }

  return {
    bonus: cappedBonus,
    wonLastOut,
    won2OfLast3,
    won3OfLast5,
    reasoning,
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Minimum form score for horses that won last out (v3.2)
 * Even with layoff penalties, a recent winner should score at least 5 pts
 */
const MIN_FORM_SCORE_FOR_RECENT_WINNER = 5;

/**
 * Calculate form score for a horse
 *
 * v3.2 SCORING BREAKDOWN (42 pts max - Model B):
 * - Recent Performance Base: 0-15 pts
 * - Winner Bonuses (stacking): 0-20 pts
 * - Consistency: 0-4 pts
 * - Layoff Penalty: -10 to 0 pts (capped)
 * - Win Recency Bonus: 0-3 pts (for wins within 30/60 days)
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

  // PHASE 2: Get PP count for confidence multiplier
  const ppCount = pastPerformances.length;
  const confidenceMultiplier = getFormConfidenceMultiplier(ppCount);

  // Calculate recent form with class context (0-15 pts)
  const formResult = calculateRecentFormScore(pastPerformances, todayContext ?? null);

  // Calculate layoff penalty (v3.0: now returns penalty, not score)
  const layoffResult = calculateLayoffPenalty(horse.daysSinceLastRace, pastPerformances);
  // Also get legacy layoff score for backward compatibility
  const layoffScoreResult = calculateLayoffScore(horse.daysSinceLastRace, pastPerformances);

  // Calculate consistency bonus (0-4 pts, reduced from 7)
  const consistencyResult = calculateConsistencyBonus(pastPerformances);

  // Determine form trend
  const formTrend = analyzeFormTrend(pastPerformances);

  // Calculate beaten lengths adjustments (closing patterns, etc.)
  const beatenLengthsAdjustments = calculateBeatenLengthsAdjustments(horse);
  const beatenLengthsProfile = buildBeatenLengthsProfile(pastPerformances);

  // v3.2: Calculate recent winner bonus (0-20 pts with stacking)
  const recentWinnerResult = calculateRecentWinnerBonus(pastPerformances);

  // v3.2: Calculate days since last win and win recency bonus
  const daysSinceLastWin = getDaysSinceLastWin(pastPerformances);
  const winRecencyResult = getWinRecencyBonus(daysSinceLastWin);

  // v3.2: Calculate total with new scoring structure
  // Model B: Base capped at 42 pts (reduced from 50)
  // Then apply layoff penalty (capped at -10) and win recency bonus (+3)
  const baseComponents =
    formResult.score + // 0-15 pts
    consistencyResult.bonus + // 0-4 pts
    recentWinnerResult.bonus + // 0-20 pts (stacking winner bonus)
    beatenLengthsAdjustments.formPoints; // ±adjustment

  // Apply layoff penalty (capped at -10)
  const cappedLayoffPenalty = Math.max(layoffResult.penalty, -MAX_LAYOFF_PENALTY);

  // Add win recency bonus (0-3 pts for hot/warm horses)
  const rawTotal = baseComponents + cappedLayoffPenalty + winRecencyResult.bonus;

  // PHASE 2: Apply confidence multiplier to penalize incomplete form data
  // Model B: Scaled for 42 max
  // First-time starters (0 PPs) → 8 pts max (20% of 42)
  // 1 PP → 17 pts max (40% of 42)
  // 2 PPs → 25 pts max (60% of 42)
  // 3+ PPs → 42 pts max (full scoring)
  let adjustedTotal = Math.round(rawTotal * confidenceMultiplier);

  // v3.2: Apply minimum form score floor for recent winners
  // A horse that won last out should never score below 5 pts
  if (recentWinnerResult.wonLastOut && adjustedTotal < MIN_FORM_SCORE_FOR_RECENT_WINNER) {
    adjustedTotal = MIN_FORM_SCORE_FOR_RECENT_WINNER;
  }

  // Model B: Final score capped at 42 pts (reduced from 50)
  const total = Math.min(42, Math.max(0, adjustedTotal));

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

  // v3.2: Add recent winner bonus to reasoning
  if (recentWinnerResult.bonus > 0) {
    reasoning += ` | ${recentWinnerResult.reasoning}`;
  }

  // v3.2: Add win recency bonus to reasoning
  if (winRecencyResult.bonus > 0) {
    reasoning += ` | ${winRecencyResult.reasoning}`;
  }

  // v3.2: Add layoff penalty to reasoning if applied
  if (cappedLayoffPenalty < 0) {
    reasoning += ` | Layoff: ${cappedLayoffPenalty} pts`;
  }

  // PHASE 2: Add confidence info to reasoning if penalized
  if (confidenceMultiplier < 1.0) {
    const maxPossible = Math.round(42 * confidenceMultiplier);
    reasoning += ` | Confidence: ${Math.round(confidenceMultiplier * 100)}% (${ppCount} PP${ppCount === 1 ? '' : 's'}, max ${maxPossible} pts)`;
  }

  // PHASE 2: Build form confidence info
  const formConfidence = {
    ppCount,
    multiplier: confidenceMultiplier,
    maxPossibleScore: Math.round(42 * confidenceMultiplier),
    penaltyApplied: confidenceMultiplier < 1.0,
  };

  return {
    total,
    recentFormScore: formResult.score,
    layoffScore: layoffScoreResult.score, // Keep legacy layoff score for backward compat
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
    won3OfLast5: recentWinnerResult.won3OfLast5,
    daysSinceLastWin,
    winRecencyBonus: winRecencyResult.bonus,
    layoffPenalty: cappedLayoffPenalty,
    formConfidence,
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
