/**
 * Form Scoring Module (v3.8 Bounce Risk Penalty)
 * Analyzes recent race form, layoff patterns, and consistency
 *
 * v3.8 BOUNCE RISK PENALTY (new)
 * Addresses issue: Horses coming off career-best performances regress 65-70%
 * of the time. The previous -3 pt penalty was token-sized given actual rates.
 *
 * BOUNCE PENALTY SCHEDULE:
 * - Full penalty (-6): Career-best last out + significant effort
 *   (fig within 3 pts of best, OR finished 1st-3rd, OR beaten <5L)
 * - Partial penalty (-3): Career-best last out but NOT significant effort
 * - Protected (0): Won 2 of last 3 races (proven repeat ability)
 * - No penalty (0): Last race NOT at/near career-best level
 *
 * v3.7 CONDITIONAL WINNER BONUS (replaces unconditional 15-pt floor)
 * Addresses issue: A horse that won a $10K claimer 4 races ago shouldn't get
 * floor protection when facing allowance company today. The old system gave
 * ANY last-out winner a minimum 15-point floor regardless of quality or recency.
 *
 * NEW SYSTEM: Conditional ADDITIVE bonuses (not a floor) based on recency AND class:
 *   | Win Position   | Class vs Today   | Bonus |
 *   |----------------|------------------|-------|
 *   | Last race      | Same or higher   | +3    |
 *   | Last race      | Lower (moving up)| +1    |
 *   | 2 races back   | Same or higher   | +2    |
 *   | 2 races back   | Lower            | +0    |
 *   | 3+ races back  | Any              | +0    |
 *
 * v3.6 FORM DECAY SYSTEM (preserved)
 * Addresses Algorithm Audit Finding #1: 53% of bad picks had stale form.
 * Winner bonuses now scale based on recency - horses that won 90 days ago
 * get less credit than horses that won 14 days ago.
 *
 * FORM SCORING BREAKDOWN (50 pts max):
 *
 * Recent Performance Base: 0-15 pts
 *   - Last 3 race finishes weighted (50%, 30%, 20%)
 *   - 1st = 15 pts, 2nd/3rd (<2L) = 12 pts, 2nd/3rd (>2L) = 9 pts
 *   - 4th-5th (competitive) = 7 pts, lower = 3-5 pts
 *
 * Winner Bonuses with Decay: 0-30 pts
 *   - Won Last Out (WLO): +1-18 pts via calculateWLODecay()
 *     | Days Since Win | Points | Description      |
 *     |----------------|--------|------------------|
 *     | 0-21 days      | 18     | Hot winner       |
 *     | 22-35 days     | 14     | Recent winner    |
 *     | 36-50 days     | 10     | Freshening       |
 *     | 51-75 days     | 6      | Stale            |
 *     | 76-90 days     | 3      | Very stale       |
 *     | 91+ days       | 1      | Ancient history  |
 *
 *   - Won 2 of 3: Base 8 pts * getRecencyMultiplier(), rounded
 *   - Won 3 of 5: Base 4 pts * getRecencyMultiplier(), rounded
 *
 * Pattern Bonus Multiplier (v3.6 getRecencyMultiplier):
 *   | Days Since Win | Multiplier |
 *   |----------------|------------|
 *   | 0-21 days      | 1.00       |
 *   | 22-35 days     | 0.85       |
 *   | 36-50 days     | 0.65       |
 *   | 51-75 days     | 0.40       |
 *   | 76-90 days     | 0.25       |
 *   | 91+ days       | 0.10       |
 *
 * Conditional Winner Bonus (v3.7): 0-3 pts
 *   - Stacks WITH WLO decay (not replaces it)
 *   - Based on win recency AND class comparison
 *   - See table above for bonus schedule
 *
 * Win Recency Bonus: 0-4 pts (unchanged, already time-gated)
 *   - Won within 30 days: +4 pts (hot horse)
 *   - Won within 60 days: +3 pts (warm horse)
 *
 * Consistency: 0-4 pts
 *   - ITM 50%+ in last 10: 4 pts
 *   - ITM 40-49%: 3 pts
 *   - ITM 30-39%: 2 pts
 *   - ITM 20-29%: 1 pt
 *   - ITM <20%: 0 pts
 *
 * Layoff Penalties:
 *   - Optimal (7-35 days): 0 penalty
 *   - Freshening (36-60 days): -3 penalty
 *   - Moderate (61-90 days): -6 penalty
 *   - Extended (90+ days): -10 penalty (capped)
 *
 * FORM CATEGORY CAP: 50 pts
 *
 * Edge Cases:
 *   - Horse with wins but no date available: Use conservative 60-day estimate
 *   - First-time starters: 20% confidence multiplier (10 pts max)
 *   - No class context available: Use simplified bonus (+3 WLO, +1 for 2 back)
 *
 * v3.8 CHANGES (Bounce Risk Penalty):
 * - ADDED bounce risk penalty (0 to -6 pts) for career-best performances
 * - Full penalty (-6) for career-best + significant effort
 * - Partial penalty (-3) for career-best without significant effort
 * - Protection for proven repeat winners (won 2 of last 3)
 *
 * v3.7 CHANGES (Conditional Winner Bonus):
 * - REMOVED unconditional 15-point winner protection floor
 * - ADDED conditional winner bonus (0-3 pts) based on recency AND class
 * - Conditional bonus STACKS WITH WLO decay (doesn't replace it)
 * - Form score now calculates naturally without artificial floors
 *
 * v3.6 CHANGES (Form Decay System):
 * - WLO bonus now decayed via calculateWLODecay() (1-18 pts)
 * - Pattern bonuses scaled via getRecencyMultiplier() (0.10-1.0x)
 * - Form cap set to 50 pts per v3.6 specification
 * - Edge case handling for missing win dates (60-day estimate)
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
  /** v3.7: Conditional winner bonus (0-3 pts based on recency AND class) */
  conditionalWinnerBonus: number;
  /** v3.8: Bounce risk penalty (0 to -6 pts) */
  bounceRiskPenalty: number;
  /** v3.8: Detailed bounce risk analysis */
  bounceRiskResult?: BounceRiskResult;
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
 * v3.2: 15 max base scoring for Model B (42 pt Form cap)
 *
 * Scoring:
 * - 1st = 15 pts
 * - 2nd within 2L = 12 pts
 * - 3rd within 2L = 12 pts
 * - 2nd >2L = 9 pts
 * - 3rd >2L = 9 pts
 * - 4th-5th competitive = 7 pts
 * - 4th-5th = 5 pts
 * - 6th-8th = 4 pts
 * - 9th+ = 3 pts
 */
function analyzeRaceFinish(pp: PastPerformance): number {
  // Won the race
  if (pp.finishPosition === 1) {
    return 15;
  }

  // 2nd or 3rd within 2 lengths
  if (pp.finishPosition === 2 && pp.lengthsBehind <= 2) {
    return 12;
  }
  if (pp.finishPosition === 3 && pp.lengthsBehind <= 2) {
    return 12;
  }

  // 2nd or 3rd more than 2 lengths
  if (pp.finishPosition === 2) {
    return 9;
  }
  if (pp.finishPosition === 3) {
    return 9;
  }

  // 4th-5th competitive effort
  if (pp.finishPosition <= 5 && pp.lengthsBehind < 5) {
    return 7;
  }

  // 4th-5th less competitive
  if (pp.finishPosition <= 5) {
    return 5;
  }

  // 6th-8th
  if (pp.finishPosition <= 8) {
    return 4;
  }

  // Poor effort
  return 3;
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
 * v3.2: Updated for 15 pt max base scoring (42 pt Form cap)
 *
 * Per requirements:
 * - WIN at any class level still scores maximum points (15)
 * - If past race was HIGHER class than today → treat loss as NEUTRAL:
 *   - 4th-6th place at higher class = 9-11 pts
 *   - 7th+ at higher class = 7-9 pts
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
      score: 15, // v3.2: 15 pt max for 42 pt Form cap
      classAdjusted: false,
      adjustmentNote: classComparison === 'higher' ? `Won ${label}` : null,
    };
  }

  // 2nd or 3rd - award bonus points if at higher class
  if (pp.finishPosition === 2 || pp.finishPosition === 3) {
    const baseScore = analyzeRaceFinish(pp);

    if (classComparison === 'higher') {
      // 2nd/3rd at higher class is excellent - boost to near-win level
      const adjustedScore = Math.min(14, baseScore + 2); // v3.2: capped at 14
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

  // 4th-6th at higher class → treat as neutral (9-11 pts)
  if (pp.finishPosition >= 4 && pp.finishPosition <= 6) {
    const baseScore = analyzeRaceFinish(pp);

    if (classComparison === 'higher') {
      // Upgrade to neutral: 9-11 pts
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

  // 7th+ at higher class → treat as neutral (7-9 pts)
  if (pp.finishPosition >= 7) {
    const baseScore = analyzeRaceFinish(pp);

    if (classComparison === 'higher') {
      // Upgrade to neutral: 7-9 pts
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

// ============================================================================
// BOUNCE RISK PENALTY (v3.8)
// ============================================================================

/**
 * Bounce Risk Penalty Configuration
 *
 * "Bounce" refers to the tendency for horses to regress after a peak performance.
 * Horses coming off career-best (or near career-best) speed figures are at high
 * risk of regression, with actual bounce rates running 65-70% off career peaks.
 *
 * v3.8: Increased penalty from -3 to -6 to properly account for regression risk.
 *
 * PENALTY LOGIC:
 * - Full penalty (-6): Last race was career-best AND a "significant effort"
 * - Partial penalty (-3): Last race was career-best but NOT a significant effort
 * - No penalty (0): Horse has proven repeat ability (won 2 of last 3)
 * - No penalty (0): Last race was NOT at/near career-best level
 *
 * "Significant Effort" Definition:
 * A significant effort is one that fully extended the horse's ability:
 * - Speed figure within 3 points of career best, OR
 * - Finished 1st-3rd, OR
 * - Beaten less than 5 lengths
 * (Any ONE of these qualifies as significant effort)
 */
export const BOUNCE_RISK_CONFIG = {
  /** Full bounce penalty for career-best + significant effort (-6 pts) */
  FULL_BOUNCE_PENALTY: -6,

  /** Partial bounce penalty for career-best but NOT significant effort (-3 pts) */
  PARTIAL_BOUNCE_PENALTY: -3,

  /** How close to career-best triggers bounce risk (points) */
  CAREER_BEST_THRESHOLD: 3,

  /** Finish position threshold for "significant effort" */
  SIGNIFICANT_FINISH_THRESHOLD: 3, // 1st, 2nd, or 3rd

  /** Beaten lengths threshold for "significant effort" */
  SIGNIFICANT_BEATEN_THRESHOLD: 5,

  /** Minimum career starts to have enough data for career-best comparison */
  MIN_CAREER_STARTS: 3,

  /** Proven repeat ability: won X of last Y races (immune to bounce penalty) */
  REPEAT_WINNER_THRESHOLD: { wins: 2, races: 3 },
} as const;

/**
 * Result from bounce risk analysis
 */
export interface BounceRiskResult {
  /** Penalty applied (0, -3, or -6) */
  penalty: number;
  /** Whether horse is at bounce risk */
  atRisk: boolean;
  /** Whether full penalty applied (vs partial) */
  fullPenalty: boolean;
  /** Whether horse is protected as proven repeat winner */
  protectedAsRepeatWinner: boolean;
  /** Explanation of the decision */
  reasoning: string;
  /** Career best speed figure detected */
  careerBest: number | null;
  /** Last race speed figure */
  lastRaceFigure: number | null;
}

/**
 * Get the best available speed figure from a past performance
 * Prefers Beyer, then TimeformUS, then Equibase
 */
function getSpeedFigure(pp: PastPerformance): number | null {
  return pp.speedFigures.beyer ?? pp.speedFigures.timeformUS ?? pp.speedFigures.equibase ?? null;
}

/**
 * Calculate career-best speed figure from past performances
 * Returns null if insufficient data
 */
function getCareerBestFigure(pastPerformances: PastPerformance[]): number | null {
  const figures: number[] = [];

  for (const pp of pastPerformances) {
    const fig = getSpeedFigure(pp);
    if (fig !== null) {
      figures.push(fig);
    }
  }

  if (figures.length < BOUNCE_RISK_CONFIG.MIN_CAREER_STARTS) {
    return null; // Insufficient data
  }

  return Math.max(...figures);
}

/**
 * Check if a past performance represents a "significant effort"
 *
 * A significant effort is one where the horse was fully extended:
 * - Speed figure within CAREER_BEST_THRESHOLD points of career best, OR
 * - Finished 1st-3rd, OR
 * - Beaten less than 5 lengths
 */
function isSignificantEffort(
  pp: PastPerformance,
  careerBest: number | null,
  lastFigure: number | null
): boolean {
  const { CAREER_BEST_THRESHOLD, SIGNIFICANT_FINISH_THRESHOLD, SIGNIFICANT_BEATEN_THRESHOLD } =
    BOUNCE_RISK_CONFIG;

  // Check 1: Speed figure within threshold of career best
  if (careerBest !== null && lastFigure !== null) {
    if (careerBest - lastFigure <= CAREER_BEST_THRESHOLD) {
      return true;
    }
  }

  // Check 2: Finished 1st, 2nd, or 3rd
  if (pp.finishPosition <= SIGNIFICANT_FINISH_THRESHOLD) {
    return true;
  }

  // Check 3: Beaten less than 5 lengths
  if (pp.lengthsBehind < SIGNIFICANT_BEATEN_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * Count wins in the last N races
 */
function countWinsInLastN(pastPerformances: PastPerformance[], n: number): number {
  return pastPerformances.slice(0, n).filter((pp) => pp.finishPosition === 1).length;
}

/**
 * Calculate bounce risk penalty for a horse
 *
 * v3.8: Penalizes horses coming off career-best or near-career-best performances.
 * Actual bounce rates off career peaks run 65-70%.
 *
 * PENALTY SCHEDULE:
 * - Full penalty (-6): Career-best last out AND significant effort
 * - Partial penalty (-3): Career-best last out but NOT significant effort
 * - No penalty (0): Protected as repeat winner (2 of last 3)
 * - No penalty (0): Last race NOT at career-best level
 *
 * @param horse - The horse entry to analyze
 * @returns BounceRiskResult with penalty and reasoning
 */
export function calculateBounceRiskPenalty(horse: HorseEntry): BounceRiskResult {
  const pps = horse.pastPerformances;

  // Default: no penalty
  const noRiskResult: BounceRiskResult = {
    penalty: 0,
    atRisk: false,
    fullPenalty: false,
    protectedAsRepeatWinner: false,
    reasoning: 'No bounce risk detected',
    careerBest: null,
    lastRaceFigure: null,
  };

  // Need at least one past performance
  if (pps.length === 0) {
    return { ...noRiskResult, reasoning: 'No past performances' };
  }

  const lastPP = pps[0];
  if (!lastPP) {
    return noRiskResult;
  }

  // Get career-best speed figure
  const careerBest = getCareerBestFigure(pps);
  if (careerBest === null) {
    return { ...noRiskResult, reasoning: 'Insufficient data for career-best comparison' };
  }

  // Get last race figure
  const lastFigure = getSpeedFigure(lastPP);
  if (lastFigure === null) {
    return { ...noRiskResult, careerBest, reasoning: 'No speed figure for last race' };
  }

  // Check if last race was at or near career-best
  const isAtCareerBest = lastFigure >= careerBest - BOUNCE_RISK_CONFIG.CAREER_BEST_THRESHOLD;

  if (!isAtCareerBest) {
    return {
      ...noRiskResult,
      careerBest,
      lastRaceFigure: lastFigure,
      reasoning: `Last figure (${lastFigure}) well below career-best (${careerBest})`,
    };
  }

  // PROTECTION: Check if horse has proven repeat ability (won 2 of last 3)
  const { wins, races } = BOUNCE_RISK_CONFIG.REPEAT_WINNER_THRESHOLD;
  const recentWins = countWinsInLastN(pps, races);

  if (recentWins >= wins) {
    return {
      penalty: 0,
      atRisk: false,
      fullPenalty: false,
      protectedAsRepeatWinner: true,
      reasoning: `Protected: won ${recentWins} of last ${races} (proven repeat winner)`,
      careerBest,
      lastRaceFigure: lastFigure,
    };
  }

  // Horse is at bounce risk - determine penalty level
  const significant = isSignificantEffort(lastPP, careerBest, lastFigure);

  if (significant) {
    // Full penalty: career-best + significant effort
    return {
      penalty: BOUNCE_RISK_CONFIG.FULL_BOUNCE_PENALTY,
      atRisk: true,
      fullPenalty: true,
      protectedAsRepeatWinner: false,
      reasoning: `BOUNCE RISK: Career-best ${lastFigure} with significant effort (${BOUNCE_RISK_CONFIG.FULL_BOUNCE_PENALTY} pts)`,
      careerBest,
      lastRaceFigure: lastFigure,
    };
  } else {
    // Partial penalty: career-best but not significant effort
    return {
      penalty: BOUNCE_RISK_CONFIG.PARTIAL_BOUNCE_PENALTY,
      atRisk: true,
      fullPenalty: false,
      protectedAsRepeatWinner: false,
      reasoning: `Bounce risk: Near career-best ${lastFigure} (${BOUNCE_RISK_CONFIG.PARTIAL_BOUNCE_PENALTY} pts)`,
      careerBest,
      lastRaceFigure: lastFigure,
    };
  }
}

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
 * Winner bonus base point values (v3.6 Form Decay System)
 *
 * v3.6 Changes:
 * - wonLastOut: Now uses calculateWLODecay() for decayed values (1-18 pts)
 * - won2of3: Base 8 pts * getRecencyMultiplier()
 * - won3of5: Base 4 pts * getRecencyMultiplier()
 * - Win recency bonuses unchanged (already time-gated)
 */
const WINNER_BONUSES = {
  wonLastOut: 18, // Max WLO bonus (decayed via calculateWLODecay)
  won2of3: 8, // Won 2 of last 3 base (scaled by recency multiplier)
  won3of5: 4, // Won 3 of last 5 base (scaled by recency multiplier)
  lastWinWithin30Days: 4, // Won last out within 30 days (hot horse bonus)
  lastWinWithin60Days: 3, // Won within 60 days (warm horse bonus)
};

/**
 * Maximum recent winner bonus points (v3.6)
 * WLO (18) + Won 2/3 (8) + Won 3/5 (4) = 30 pts theoretical max
 * Plus win recency bonus up to 4 pts
 * Total form max: 50 pts (capped per v3.6 spec)
 */
const MAX_RECENT_WINNER_BONUS = 30;

// ============================================================================
// v3.5 WINNER BONUS RECENCY DECAY SYSTEM
// ============================================================================
// Algorithm Audit Finding #1: 53% of Bad Beat picks had "stale form"
// The "won last out" bonus had NO recency check - a horse that won 90 days ago
// got the same +18 pts as a horse that won 14 days ago.
// This fix implements decay so recent winners are rewarded more than stale winners.
// ============================================================================

/**
 * Day thresholds for WLO (Won Last Out) decay (v3.6)
 * Each threshold marks the upper bound of that decay tier
 *
 * v3.6 Form Decay System - scales winner bonuses based on recency
 * to address Algorithm Audit Finding #1: 53% of bad picks had stale form
 */
export const WINNER_DECAY_THRESHOLDS = {
  HOT: 21, // 0-21 days: Hot winner, full credit
  RECENT: 35, // 22-35 days: Recent winner, slight decay
  FRESH: 50, // 36-50 days: Freshening, moderate decay
  STALE: 75, // 51-75 days: Stale, heavy decay
  VERY_STALE: 90, // 76-90 days: Very stale, minimal credit
  // 91+ days: Ancient history, token credit
} as const;

/**
 * Bonus point values for each WLO decay tier (v3.6)
 * These correspond to the thresholds above
 */
export const WINNER_DECAY_BONUSES = {
  HOT: 18, // 0-21 days: Full credit
  RECENT: 14, // 22-35 days: Slight decay
  FRESH: 10, // 36-50 days: Moderate decay
  STALE: 6, // 51-75 days: Heavy decay
  VERY_STALE: 3, // 76-90 days: Minimal credit
  ANCIENT: 1, // 91+ days: Token credit
} as const;

/**
 * Thresholds for pattern bonus decay multipliers (v3.6)
 * Applied to Won 2 of 3 and Won 3 of 5 bonuses
 *
 * v3.6 Spec:
 * | Days Since Win | Multiplier |
 * |----------------|------------|
 * | 0-21 days      | 1.00x      |
 * | 22-35 days     | 0.85x      |
 * | 36-50 days     | 0.65x      |
 * | 51-75 days     | 0.40x      |
 * | 76-90 days     | 0.25x      |
 * | 91+ days       | 0.10x      |
 */
export const PATTERN_DECAY_THRESHOLDS = {
  HOT: 21, // 0-21 days: Full multiplier (1.0)
  RECENT: 35, // 22-35 days: 0.85 multiplier
  FRESH: 50, // 36-50 days: 0.65 multiplier
  STALE: 75, // 51-75 days: 0.40 multiplier
  VERY_STALE: 90, // 76-90 days: 0.25 multiplier
  // 91+ days: 0.10 multiplier
} as const;

/**
 * Pattern bonus multiplier values for each decay tier (v3.6)
 */
export const PATTERN_DECAY_MULTIPLIERS = {
  HOT: 1.0, // 0-21 days: Full credit
  RECENT: 0.85, // 22-35 days: Slight discount
  FRESH: 0.65, // 36-50 days: Moderate decay
  STALE: 0.4, // 51-75 days: Significant decay
  VERY_STALE: 0.25, // 76-90 days: Heavy decay
  ANCIENT: 0.1, // 91+ days: Minimal credit
} as const;

/**
 * Calculate the decayed WLO (Won Last Out) bonus based on days since win.
 *
 * v3.6 Form Decay System - addresses Algorithm Audit Finding #1:
 * 53% of bad picks had stale form. Horses that won 90 days ago were
 * receiving the same bonus as horses that won 14 days ago.
 *
 * | Days Since Win | Points | Description      |
 * |----------------|--------|------------------|
 * | 0-21 days      | 18     | Hot winner       |
 * | 22-35 days     | 14     | Recent winner    |
 * | 36-50 days     | 10     | Freshening       |
 * | 51-75 days     | 6      | Stale            |
 * | 76-90 days     | 3      | Very stale       |
 * | 91+ days       | 1      | Ancient history  |
 *
 * @param daysSinceWin - Days since the horse's most recent win
 * @returns The decayed WLO bonus points (1-18)
 */
export function calculateWLODecay(daysSinceWin: number): number {
  // Edge case: invalid input
  if (daysSinceWin < 0) {
    return WINNER_DECAY_BONUSES.HOT; // Assume fresh if invalid
  }

  // Hot: 0-21 days - full credit
  if (daysSinceWin <= WINNER_DECAY_THRESHOLDS.HOT) {
    return WINNER_DECAY_BONUSES.HOT;
  }

  // Recent: 22-35 days - slight decay
  if (daysSinceWin <= WINNER_DECAY_THRESHOLDS.RECENT) {
    return WINNER_DECAY_BONUSES.RECENT;
  }

  // Fresh: 36-50 days - moderate decay
  if (daysSinceWin <= WINNER_DECAY_THRESHOLDS.FRESH) {
    return WINNER_DECAY_BONUSES.FRESH;
  }

  // Stale: 51-75 days - heavy decay
  if (daysSinceWin <= WINNER_DECAY_THRESHOLDS.STALE) {
    return WINNER_DECAY_BONUSES.STALE;
  }

  // Very stale: 76-90 days - minimal credit
  if (daysSinceWin <= WINNER_DECAY_THRESHOLDS.VERY_STALE) {
    return WINNER_DECAY_BONUSES.VERY_STALE;
  }

  // Ancient: 91+ days - token credit
  return WINNER_DECAY_BONUSES.ANCIENT;
}

/**
 * @deprecated Use calculateWLODecay instead. Alias for backward compatibility.
 */
export const getDecayedWonLastOutBonus = calculateWLODecay;

/**
 * Get the recency multiplier for pattern bonuses based on days since most recent win.
 *
 * v3.6 Form Decay System - Applied to Won 2 of 3 and Won 3 of 5 bonuses.
 * Pattern bonuses use this multiplier to scale their base values:
 * - Won 2 of 3: 8 pts base * multiplier
 * - Won 3 of 5: 4 pts base * multiplier
 *
 * | Days Since Win | Multiplier | Description      |
 * |----------------|------------|------------------|
 * | 0-21 days      | 1.00       | Full credit      |
 * | 22-35 days     | 0.85       | Slight discount  |
 * | 36-50 days     | 0.65       | Moderate decay   |
 * | 51-75 days     | 0.40       | Significant decay|
 * | 76-90 days     | 0.25       | Heavy decay      |
 * | 91+ days       | 0.10       | Minimal credit   |
 *
 * @param daysSinceWin - Days since the horse's most recent win
 * @returns The multiplier to apply to pattern bonuses (0.10-1.0)
 */
export function getRecencyMultiplier(daysSinceWin: number): number {
  // Edge case: invalid input
  if (daysSinceWin < 0) {
    return PATTERN_DECAY_MULTIPLIERS.HOT; // Assume fresh if invalid
  }

  // Hot: 0-21 days - full credit
  if (daysSinceWin <= PATTERN_DECAY_THRESHOLDS.HOT) {
    return PATTERN_DECAY_MULTIPLIERS.HOT;
  }

  // Recent: 22-35 days - slight discount
  if (daysSinceWin <= PATTERN_DECAY_THRESHOLDS.RECENT) {
    return PATTERN_DECAY_MULTIPLIERS.RECENT;
  }

  // Fresh: 36-50 days - moderate decay
  if (daysSinceWin <= PATTERN_DECAY_THRESHOLDS.FRESH) {
    return PATTERN_DECAY_MULTIPLIERS.FRESH;
  }

  // Stale: 51-75 days - significant decay
  if (daysSinceWin <= PATTERN_DECAY_THRESHOLDS.STALE) {
    return PATTERN_DECAY_MULTIPLIERS.STALE;
  }

  // Very stale: 76-90 days - heavy decay
  if (daysSinceWin <= PATTERN_DECAY_THRESHOLDS.VERY_STALE) {
    return PATTERN_DECAY_MULTIPLIERS.VERY_STALE;
  }

  // Ancient: 91+ days - minimal credit
  return PATTERN_DECAY_MULTIPLIERS.ANCIENT;
}

/**
 * @deprecated Use getRecencyMultiplier instead. Alias for backward compatibility.
 */
export const getPatternBonusMultiplier = getRecencyMultiplier;

/**
 * Calculate days since last win from past performances (v3.2)
 * @returns Days since last win, or null if horse has never won
 *
 * Returns 0 if horse won its most recent race (for win recency bonus calculations).
 * For pattern bonuses, this tracks when the most recent win occurred.
 */
function getDaysSinceLastWin(pastPerformances: PastPerformance[]): number | null {
  if (pastPerformances.length === 0) return null;

  // Find the most recent win
  let cumulativeDays = 0;
  for (let i = 0; i < pastPerformances.length; i++) {
    const pp = pastPerformances[i];
    if (!pp) continue;

    // Add days since the previous race to get cumulative time
    // For PP[0], daysSinceLast = days from today to that race
    // For PP[1+], daysSinceLast = days between that race and the one before it
    if (i === 0 && pp.daysSinceLast !== null) {
      cumulativeDays = pp.daysSinceLast;
    } else if (pp.daysSinceLast !== null) {
      cumulativeDays += pp.daysSinceLast;
    }

    if (pp.finishPosition === 1) {
      // v3.2: If horse won most recent race, return 0 for win recency calculations
      // For PP[1+]: return cumulative days to that winning race
      if (i === 0) {
        return 0; // Won most recent race
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
 * Calculate recent winner bonus with v3.6 Form Decay System.
 *
 * v3.6 DECAY LOGIC:
 * - Won Last Out (WLO): Uses calculateWLODecay() for 1-18 pts based on recency
 * - Won 2 of 3: Base 8 pts * getRecencyMultiplier(), rounded to nearest integer
 * - Won 3 of 5: Base 4 pts * getRecencyMultiplier(), rounded to nearest integer
 *
 * All bonuses stack when applicable. Max: 18 + 8 + 4 = 30 pts
 *
 * @param pastPerformances - Horse's past performances
 * @param daysSinceLastWin - Days since most recent win (null if never won, use 60 as conservative estimate if unknown)
 * @returns Bonus points and analysis
 */
function calculateRecentWinnerBonus(
  pastPerformances: PastPerformance[],
  daysSinceLastWin: number | null
): {
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

  // v3.6: Calculate bonuses with decay
  let bonus = 0;
  const reasoningParts: string[] = [];

  // v3.6 Edge case: If horse has wins but no date available, use conservative 60-day estimate
  const effectiveDaysSinceWin = daysSinceLastWin ?? 60;

  if (wonLastOut) {
    // v3.6: Use calculateWLODecay instead of flat bonus
    const wloBonus = calculateWLODecay(effectiveDaysSinceWin);
    bonus += wloBonus;
    reasoningParts.push(`WLO (+${wloBonus}, ${effectiveDaysSinceWin}d)`);
  }

  if (won2OfLast3) {
    // v3.6: Apply recency multiplier to base 8 pts, round to nearest integer
    const multiplier = getRecencyMultiplier(effectiveDaysSinceWin);
    const patternBonus = Math.round(WINNER_BONUSES.won2of3 * multiplier);
    bonus += patternBonus;
    reasoningParts.push(`Won ${winsInLast3}/3 (+${patternBonus})`);
  }

  if (won3OfLast5) {
    // v3.6: Apply recency multiplier to base 4 pts, round to nearest integer
    const multiplier = getRecencyMultiplier(effectiveDaysSinceWin);
    const patternBonus = Math.round(WINNER_BONUSES.won3of5 * multiplier);
    bonus += patternBonus;
    reasoningParts.push(`Won ${winsInLast5}/5 (+${patternBonus})`);
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
 * CONDITIONAL WINNER BONUS SYSTEM (v3.7)
 *
 * v3.7 CHANGE: Removed unconditional 15-point winner protection floor.
 * The old system gave ANY last-out winner a minimum 15-point form score,
 * regardless of how weak the win was or how long ago it occurred.
 *
 * Problem: A horse that won a $10K claimer 4 races ago shouldn't get
 * floor protection when facing allowance company today.
 *
 * New system: Conditional ADDITIVE bonuses (not a floor) based on:
 * - Win in last race (race 1 back) at same or higher class: +3 pts
 * - Win in last race at lower class (class drop win): +1 pt
 * - Win 2 races back at same or higher class: +2 pts
 * - Win 2 races back at lower class: +0 pts
 * - Win 3+ races back: no bonus regardless of class
 *
 * These bonuses STACK WITH WLO decay (not replace it):
 * - WLO decay gives 1-18 pts based on days since last win
 * - Conditional bonus adds 0-3 pts based on recency AND class
 * - Total form score still capped at 50 pts
 *
 * @deprecated MIN_FORM_SCORE_FOR_RECENT_WINNER removed in v3.7
 */
const CONDITIONAL_WINNER_BONUS = {
  /** Win in last race at same or higher class */
  WIN_LAST_SAME_OR_HIGHER_CLASS: 3,
  /** Win in last race at lower class (class drop win) */
  WIN_LAST_LOWER_CLASS: 1,
  /** Win 2 races back at same or higher class */
  WIN_2_BACK_SAME_OR_HIGHER_CLASS: 2,
  /** Win 2 races back at lower class */
  WIN_2_BACK_LOWER_CLASS: 0,
  /** Win 3+ races back - no bonus regardless of class */
  WIN_3_PLUS_BACK: 0,
} as const;

/**
 * Calculate conditional winner bonus based on win recency AND class.
 *
 * v3.7 NEW SYSTEM - Replaces unconditional 15-point floor.
 *
 * This function provides ADDITIVE bonuses (not a floor) that stack with
 * WLO decay to reward wins appropriately based on both timing and quality.
 *
 * Bonus Schedule:
 * | Win Position | Class vs Today | Bonus |
 * |--------------|----------------|-------|
 * | Last race    | Same or higher | +3    |
 * | Last race    | Lower          | +1    |
 * | 2 races back | Same or higher | +2    |
 * | 2 races back | Lower          | +0    |
 * | 3+ back      | Any            | +0    |
 *
 * @param pastPerformances - Horse's past performance records
 * @param todayContext - Class context for today's race (optional)
 * @returns Bonus points and reasoning
 */
function calculateConditionalWinnerBonus(
  pastPerformances: PastPerformance[],
  todayContext: ClassContext | null
): { bonus: number; reasoning: string } {
  if (pastPerformances.length === 0) {
    return { bonus: 0, reasoning: 'No race history' };
  }

  // Check last race (index 0)
  const lastPP = pastPerformances[0];
  if (lastPP?.finishPosition === 1) {
    // Won last race - check class comparison
    if (todayContext) {
      const winClassLevel = getClassLevel(
        lastPP.classification,
        lastPP.claimingPrice,
        lastPP.purse
      );
      const todayClassLevel = getClassLevel(
        todayContext.classification,
        todayContext.claimingPrice,
        todayContext.purse
      );
      const comparison = compareClassLevels(winClassLevel, todayClassLevel);

      // 'higher' means past class > today class (win at higher class)
      // 'same' means approximately equal
      // 'lower' means past class < today class (win at lower class, moving up)
      if (comparison === 'higher' || comparison === 'same') {
        return {
          bonus: CONDITIONAL_WINNER_BONUS.WIN_LAST_SAME_OR_HIGHER_CLASS,
          reasoning: `WLO at ${comparison === 'higher' ? 'higher' : 'same'} class (+${CONDITIONAL_WINNER_BONUS.WIN_LAST_SAME_OR_HIGHER_CLASS})`,
        };
      } else {
        return {
          bonus: CONDITIONAL_WINNER_BONUS.WIN_LAST_LOWER_CLASS,
          reasoning: `WLO at lower class (+${CONDITIONAL_WINNER_BONUS.WIN_LAST_LOWER_CLASS})`,
        };
      }
    } else {
      // No class context available - use simplified version: +3 for last race win
      return {
        bonus: CONDITIONAL_WINNER_BONUS.WIN_LAST_SAME_OR_HIGHER_CLASS,
        reasoning: `WLO (+${CONDITIONAL_WINNER_BONUS.WIN_LAST_SAME_OR_HIGHER_CLASS})`,
      };
    }
  }

  // Check second-to-last race (index 1)
  const secondPP = pastPerformances[1];
  if (secondPP?.finishPosition === 1) {
    // Won 2 races back - check class comparison
    if (todayContext) {
      const winClassLevel = getClassLevel(
        secondPP.classification,
        secondPP.claimingPrice,
        secondPP.purse
      );
      const todayClassLevel = getClassLevel(
        todayContext.classification,
        todayContext.claimingPrice,
        todayContext.purse
      );
      const comparison = compareClassLevels(winClassLevel, todayClassLevel);

      if (comparison === 'higher' || comparison === 'same') {
        return {
          bonus: CONDITIONAL_WINNER_BONUS.WIN_2_BACK_SAME_OR_HIGHER_CLASS,
          reasoning: `Won 2 back at ${comparison === 'higher' ? 'higher' : 'same'} class (+${CONDITIONAL_WINNER_BONUS.WIN_2_BACK_SAME_OR_HIGHER_CLASS})`,
        };
      } else {
        return {
          bonus: CONDITIONAL_WINNER_BONUS.WIN_2_BACK_LOWER_CLASS,
          reasoning: 'Won 2 back at lower class (no bonus)',
        };
      }
    } else {
      // No class context - use simplified version: +1 for 2 races back
      return {
        bonus: 1,
        reasoning: 'Won 2 back (+1)',
      };
    }
  }

  // Win 3+ races back or no recent win - no conditional bonus
  return { bonus: 0, reasoning: 'No recent win (3+ back)' };
}

/**
 * Form category maximum score (v3.6)
 * Per v3.6 specification, Form category cap is 50 pts
 */
export const FORM_CATEGORY_MAX = 50;

/**
 * Calculate form score for a horse
 *
 * v3.7 SCORING BREAKDOWN (50 pts max):
 * - Recent Performance Base: 0-15 pts
 * - Winner Bonuses (with decay): 0-30 pts
 *   - WLO: 1-18 pts (via calculateWLODecay)
 *   - Won 2/3: 0-8 pts (via getRecencyMultiplier)
 *   - Won 3/5: 0-4 pts (via getRecencyMultiplier)
 * - Conditional Winner Bonus: 0-3 pts (v3.7 - based on recency AND class)
 *   - Win last race at same/higher class: +3 pts
 *   - Win last race at lower class: +1 pt
 *   - Win 2 back at same/higher class: +2 pts
 *   - Win 2 back at lower class: +0 pts
 *   - Win 3+ back: +0 pts
 * - Consistency: 0-4 pts
 * - Layoff Penalty: -10 to 0 pts (capped)
 * - Win Recency Bonus: 0-4 pts (for wins within 30/60 days)
 *
 * v3.7 NOTE: Unconditional 15-point winner protection floor REMOVED.
 * Form score now calculates naturally based on actual performance factors.
 * The conditional winner bonus provides lighter protection for quality wins only.
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

  // v3.6: Calculate days since last win FIRST (needed for decay)
  const daysSinceLastWin = getDaysSinceLastWin(pastPerformances);

  // v3.6: Calculate recent winner bonus with decay (0-30 pts)
  const recentWinnerResult = calculateRecentWinnerBonus(pastPerformances, daysSinceLastWin);

  // v3.6: Calculate win recency bonus
  const winRecencyResult = getWinRecencyBonus(daysSinceLastWin);

  // v3.7: Calculate conditional winner bonus (replaces unconditional floor)
  // This bonus is ADDITIVE and considers both recency and class
  const conditionalWinnerBonusResult = calculateConditionalWinnerBonus(
    pastPerformances,
    todayContext ?? null
  );

  // v3.8: Calculate bounce risk penalty
  // Penalizes horses coming off career-best performances (65-70% bounce rate)
  const bounceRiskResult = calculateBounceRiskPenalty(horse);

  // v3.6/3.7/3.8: Calculate total with Form Decay System + Conditional Winner Bonus + Bounce Risk
  // Form cap: 50 pts per v3.6 specification
  const baseComponents =
    formResult.score + // 0-15 pts
    consistencyResult.bonus + // 0-4 pts
    recentWinnerResult.bonus + // 0-30 pts (decayed winner bonus via WLO decay)
    beatenLengthsAdjustments.formPoints + // ±adjustment
    conditionalWinnerBonusResult.bonus; // v3.7: 0-3 pts (conditional on recency AND class)

  // Apply layoff penalty (capped at -10)
  const cappedLayoffPenalty = Math.max(layoffResult.penalty, -MAX_LAYOFF_PENALTY);

  // v3.8: Apply bounce risk penalty (0 to -6 pts)
  const bounceRiskPenalty = bounceRiskResult.penalty;

  // Add win recency bonus (0-4 pts for hot/warm horses) and bounce penalty
  const rawTotal = baseComponents + cappedLayoffPenalty + winRecencyResult.bonus + bounceRiskPenalty;

  // PHASE 2: Apply confidence multiplier to penalize incomplete form data
  // v3.6: Scaled for 50 max
  // First-time starters (0 PPs) → 10 pts max (20% of 50)
  // 1 PP → 20 pts max (40% of 50)
  // 2 PPs → 30 pts max (60% of 50)
  // 3+ PPs → 50 pts max (full scoring)
  const adjustedTotal = Math.round(rawTotal * confidenceMultiplier);

  // v3.7: REMOVED unconditional 15-point winner protection floor
  // The old floor (MIN_FORM_SCORE_FOR_RECENT_WINNER = 15) was removed because:
  // - It gave ANY last-out winner 15 pts regardless of win quality or recency
  // - A $10K claimer win 4 races ago shouldn't protect against layoff penalties
  // - The new conditional winner bonus (+0 to +3 pts) handles quality wins appropriately
  // - WLO decay (1-18 pts) already rewards recency

  // v3.6: Final score capped at 50 pts per v3.6 specification
  const total = Math.min(FORM_CATEGORY_MAX, Math.max(0, adjustedTotal));

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

  // v3.7: Add conditional winner bonus to reasoning
  if (conditionalWinnerBonusResult.bonus > 0) {
    reasoning += ` | ${conditionalWinnerBonusResult.reasoning}`;
  }

  // v3.2: Add win recency bonus to reasoning
  if (winRecencyResult.bonus > 0) {
    reasoning += ` | ${winRecencyResult.reasoning}`;
  }

  // v3.2: Add layoff penalty to reasoning if applied
  if (cappedLayoffPenalty < 0) {
    reasoning += ` | Layoff: ${cappedLayoffPenalty} pts`;
  }

  // v3.8: Add bounce risk to reasoning if applied
  if (bounceRiskPenalty < 0) {
    reasoning += ` | ${bounceRiskResult.reasoning}`;
  } else if (bounceRiskResult.protectedAsRepeatWinner) {
    reasoning += ` | Bounce protected (repeat winner)`;
  }

  // PHASE 2: Add confidence info to reasoning if penalized
  if (confidenceMultiplier < 1.0) {
    const maxPossible = Math.round(FORM_CATEGORY_MAX * confidenceMultiplier);
    reasoning += ` | Confidence: ${Math.round(confidenceMultiplier * 100)}% (${ppCount} PP${ppCount === 1 ? '' : 's'}, max ${maxPossible} pts)`;
  }

  // PHASE 2: Build form confidence info
  const formConfidence = {
    ppCount,
    multiplier: confidenceMultiplier,
    maxPossibleScore: Math.round(FORM_CATEGORY_MAX * confidenceMultiplier),
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
    conditionalWinnerBonus: conditionalWinnerBonusResult.bonus,
    bounceRiskPenalty,
    bounceRiskResult,
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
