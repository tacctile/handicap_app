/**
 * Speed & Class Scoring Module
 * Calculates scores based on speed figures and class level analysis
 *
 * Score Breakdown (v3.2 - Model B Speed-Dominant):
 * - Speed Figure Score: 0-105 points (based on Beyer/TimeformUS figures)
 * - Class Level Score: 0-35 points (based on class movement and success)
 *
 * Total: 0-140 points (42.3% of 331 base)
 *
 * v3.7 CHANGES (Speed Recency Decay Re-enabled):
 * - Re-enabled getRecencyDecayMultiplier() with calibrated tiers
 * - Decay is GENTLER than Form Decay (speed = ability, form = condition)
 * - Added Active Horse Protection (3+ figs in 90 days = protected)
 * - Decay tiers: 0-30d=1.0, 31-60d=0.95, 61-90d=0.85, 91-120d=0.75, 121-180d=0.60, 181+d=0.45
 *
 * v3.2 CHANGES:
 * - Speed figures increased to 105 pts (Intrinsic Ability focus)
 * - Class increased to 35 pts
 */

import type { HorseEntry, RaceHeader, PastPerformance, RaceClassification } from '../../types/drf';
import { getSeasonalSpeedAdjustment, isTrackIntelligenceAvailable } from '../trackIntelligence';
import {
  getSpeedTier,
  getTrackTierAdjustment,
  analyzeShipper,
  getTrackSpeedPar,
  TIER_NAMES,
  type SpeedTier,
  type ShipperAnalysis,
} from './trackSpeedNormalization';

// ============================================================================
// TYPES
// ============================================================================

export interface SpeedClassScoreResult {
  total: number;
  speedScore: number;
  classScore: number;
  seasonalAdjustment: number;
  bestRecentFigure: number | null;
  averageFigure: number | null;
  parForClass: number;
  classMovement: 'drop' | 'rise' | 'level' | 'unknown';
  speedReasoning: string;
  classReasoning: string;
  /** Track variant adjustment info */
  variantAdjustment?: {
    /** Raw (unadjusted) best figure */
    rawFigure: number;
    /** Adjusted best figure */
    adjustedFigure: number;
    /** Points adjusted (+/-) */
    adjustment: number;
    /** Track variant value used */
    variant: number | null;
    /** Human-readable reasoning */
    reasoning: string;
  };
  /** Track normalization info */
  trackNormalization?: {
    /** Current track speed tier (1-4) */
    currentTrackTier: SpeedTier;
    /** Current track tier name */
    currentTrackTierName: string;
    /** Track tier adjustment applied to figure evaluation */
    tierAdjustment: number;
    /** Shipper analysis if horse is shipping between tiers */
    shipperAnalysis?: ShipperAnalysis;
    /** Track-specific par figure for this distance/class */
    trackParFigure: number | null;
    /** How much above/below track par the best figure is */
    parDifferential: number | null;
  };
  /** Phase 2: Speed confidence info for data completeness */
  speedConfidence?: {
    /** Number of valid speed figures in last 3 races */
    figureCount: number;
    /** Confidence multiplier applied (0.25-1.0) */
    multiplier: number;
    /** Maximum possible speed score given data availability */
    maxPossibleScore: number;
    /** Whether confidence penalty was applied */
    penaltyApplied: boolean;
  };
  /** Recency decay info for speed figures */
  recencyDecay?: {
    /** Days since the race with the best figure */
    daysSinceRace: number | null;
    /** Recency decay multiplier applied (0.5-1.0) */
    multiplier: number;
    /** Original figure before decay */
    originalFigure: number | null;
    /** Decayed figure used for scoring */
    decayedFigure: number | null;
    /** Whether decay was applied */
    decayApplied: boolean;
  };
  /** Sale price scoring for FTS/lightly raced horses */
  salePriceScoring?: {
    /** Whether sale price bonus was applied */
    applied: boolean;
    /** Bonus points awarded (0-8) */
    bonus: number;
    /** Sale price in dollars */
    salePrice: number | null;
    /** Sale location/type */
    saleLocation: string | null;
    /** Price tier description */
    priceTier: string;
    /** Human-readable reasoning */
    reasoning: string;
  };
}

// ============================================================================
// CLASS LEVEL HIERARCHY
// ============================================================================

// Class levels ranked from lowest to highest
const CLASS_HIERARCHY: Record<RaceClassification, number> = {
  'maiden-claiming': 1,
  maiden: 2,
  claiming: 3,
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

// Par speed figures by class level (approximate Beyer figures)
const CLASS_PAR_FIGURES: Record<RaceClassification, number> = {
  'maiden-claiming': 65,
  maiden: 72,
  claiming: 75,
  'starter-allowance': 78,
  allowance: 82,
  'allowance-optional-claiming': 85,
  handicap: 88,
  stakes: 90,
  'stakes-listed': 93,
  'stakes-graded-3': 96,
  'stakes-graded-2': 100,
  'stakes-graded-1': 105,
  unknown: 75,
};

// ============================================================================
// TRACK VARIANT ADJUSTMENT
// ============================================================================

/**
 * Result of adjusting a speed figure for track variant
 */
export interface VariantAdjustmentResult {
  /** Adjusted speed figure */
  adjustedFigure: number;
  /** Points adjusted (+/-) */
  adjustment: number;
  /** Human-readable reasoning for the adjustment */
  reasoning: string;
}

/**
 * Adjust a speed figure based on track variant
 *
 * Track variants measure how fast or slow a track was playing on a given day.
 * - Positive variant = track was fast (figures were aided/inflated)
 * - Negative variant = track was slow (figures were hindered/deflated)
 *
 * Adjustment logic:
 * - Variant > +3: Subtract 1-2 pts (track was fast, figure inflated)
 * - Variant -3 to +3: No adjustment (normal conditions)
 * - Variant < -3: Add 1-2 pts (track was slow, figure deflated)
 *
 * @param rawFigure - The raw Beyer/speed figure
 * @param variant - The track variant for that day (can be null)
 * @returns Adjusted figure with reasoning
 */
export function adjustFigureForVariant(
  rawFigure: number,
  variant: number | null
): VariantAdjustmentResult {
  // No variant data - return figure unchanged
  if (variant === null) {
    return {
      adjustedFigure: rawFigure,
      adjustment: 0,
      reasoning: 'No variant data available',
    };
  }

  let adjustment = 0;
  let reasoning = '';

  if (variant > 5) {
    // Very fast track - subtract 2 points
    adjustment = -2;
    reasoning = `Variant +${variant} (very fast track) - subtracting 2 pts`;
  } else if (variant > 3) {
    // Fast track - subtract 1 point
    adjustment = -1;
    reasoning = `Variant +${variant} (fast track) - subtracting 1 pt`;
  } else if (variant < -5) {
    // Very slow track - add 2 points
    adjustment = 2;
    reasoning = `Variant ${variant} (very slow track) - adding 2 pts`;
  } else if (variant < -3) {
    // Slow track - add 1 point
    adjustment = 1;
    reasoning = `Variant ${variant} (slow track) - adding 1 pt`;
  } else {
    // Normal conditions (-3 to +3)
    reasoning = `Variant ${variant >= 0 ? '+' : ''}${variant} (normal conditions)`;
  }

  return {
    adjustedFigure: rawFigure + adjustment,
    adjustment,
    reasoning,
  };
}

// ============================================================================
// SPEED FIGURE RECENCY DECAY (v3.7 - Re-enabled with Calibrated Tiers)
// ============================================================================

/**
 * v3.7 Speed Recency Decay Thresholds
 *
 * These thresholds define the recency tiers for speed figure decay.
 * Speed figure decay is GENTLER than Form Decay because:
 * - Speed figures represent ABILITY (more stable over time)
 * - Form represents CURRENT CONDITION (more volatile)
 * - A horse can maintain ability while losing form
 *
 * Re-enabled in v3.7 after v3.6 Form Decay System provided better framework
 * for understanding recency effects. Original disable in v3.3 was before
 * Form Decay existed.
 */
export const SPEED_RECENCY_THRESHOLDS = {
  RECENT: 30, // 0-30 days: Full credit
  RELEVANT: 60, // 31-60 days: Still relevant
  GETTING_STALE: 90, // 61-90 days: Getting stale
  STALE: 120, // 91-120 days: Stale
  VERY_STALE: 180, // 121-180 days: Very stale
  // 181+ days: Ancient
} as const;

/**
 * v3.7 Speed Recency Decay Multipliers
 *
 * These multipliers are applied to speed figures based on age.
 * Gentler than Form Decay (which goes from 1.0 to 0.10) because
 * speed figures represent ability, not current condition.
 *
 * Comparison to Form Decay:
 * | Days      | Speed Decay | Form Decay |
 * |-----------|-------------|------------|
 * | 0-30      | 1.00        | 1.00       |
 * | 31-60     | 0.95        | 0.65-0.85  |
 * | 61-90     | 0.85        | 0.25-0.40  |
 * | 91-120    | 0.75        | 0.10       |
 * | 121-180   | 0.60        | 0.10       |
 * | 181+      | 0.45        | 0.10       |
 */
export const SPEED_RECENCY_MULTIPLIERS = {
  RECENT: 1.0, // 0-30 days: Full credit - recent figure
  RELEVANT: 0.95, // 31-60 days: 5% reduction - still relevant
  GETTING_STALE: 0.85, // 61-90 days: 15% reduction - getting stale
  STALE: 0.75, // 91-120 days: 25% reduction - stale
  VERY_STALE: 0.6, // 121-180 days: 40% reduction - very stale
  ANCIENT: 0.45, // 181+ days: 55% reduction - ancient
} as const;

/**
 * Number of figures in last 90 days needed to qualify for Active Horse Protection
 * When a horse has this many recent figures, we don't penalize old standout figures
 */
export const ACTIVE_HORSE_FIGURE_THRESHOLD = 3;

/**
 * Maximum days to look back for "active horse" determination
 */
export const ACTIVE_HORSE_WINDOW_DAYS = 90;

/**
 * Calculate days between two dates
 * @param raceDate - Date string in YYYYMMDD format (from PastPerformance.date)
 * @param todayDate - Today's date string in YYYYMMDD or YYYY-MM-DD format
 * @returns Number of days between dates, or null if parsing fails
 */
function calculateDaysSinceRace(raceDate: string, todayDate: string): number | null {
  try {
    // Parse race date (YYYYMMDD format)
    const cleanRaceDate = raceDate.replace(/[-/]/g, '');
    if (cleanRaceDate.length < 8) return null;

    const raceYear = parseInt(cleanRaceDate.substring(0, 4));
    const raceMonth = parseInt(cleanRaceDate.substring(4, 6)) - 1;
    const raceDay = parseInt(cleanRaceDate.substring(6, 8));
    const race = new Date(raceYear, raceMonth, raceDay);

    // Parse today's date
    const cleanToday = todayDate.replace(/[-/]/g, '');
    const todayYear = parseInt(cleanToday.substring(0, 4));
    const todayMonth = parseInt(cleanToday.substring(4, 6)) - 1;
    const todayDay = parseInt(cleanToday.substring(6, 8));
    const today = new Date(todayYear, todayMonth, todayDay);

    // Calculate difference in days
    const diffTime = today.getTime() - race.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 0 ? diffDays : 0;
  } catch {
    return null;
  }
}

/**
 * Get recency decay multiplier for a speed figure based on age.
 *
 * v3.7 CALIBRATED DECAY (Re-enabled after v3.6 Form Decay established framework):
 *
 * | Days Since Race | Multiplier | Description        |
 * |-----------------|------------|--------------------|
 * | 0-30 days       | 1.00       | Full credit        |
 * | 31-60 days      | 0.95       | Still relevant     |
 * | 61-90 days      | 0.85       | Getting stale      |
 * | 91-120 days     | 0.75       | Stale              |
 * | 121-180 days    | 0.60       | Very stale         |
 * | 181+ days       | 0.45       | Ancient            |
 *
 * These tiers are GENTLER than Form Decay because:
 * - Speed figures represent ABILITY (more stable over time)
 * - Form represents CURRENT CONDITION (more volatile)
 * - A horse can maintain ability while temporarily losing form
 *
 * RATIONALE FOR RE-ENABLING (v3.7):
 * Originally disabled in v3.3 because "testing showed it hurt predictive accuracy".
 * However, that was BEFORE v3.6 Form Decay existed. With Form Decay now handling
 * the "current condition" aspect, Speed Recency Decay can properly address the
 * separate concern of whether old Beyer figures still represent current ability.
 *
 * A 95 Beyer from 180 days ago should NOT be treated equally to a 95 from 14 days ago.
 * The old figure was earned under different conditions (different track maintenance,
 * potentially different fitness level, different training regimen).
 *
 * @param daysSinceRace - Days since the race where the figure was earned
 * @returns Multiplier to apply to the figure (0.45-1.0)
 */
export function getRecencyDecayMultiplier(daysSinceRace: number | null): number {
  // If no date available, assume moderate staleness (60-day estimate)
  if (daysSinceRace === null) {
    return SPEED_RECENCY_MULTIPLIERS.RELEVANT; // 0.95
  }

  // Invalid input protection
  if (daysSinceRace < 0) {
    return SPEED_RECENCY_MULTIPLIERS.RECENT; // 1.0
  }

  // 0-30 days: Full credit - recent figure
  if (daysSinceRace <= SPEED_RECENCY_THRESHOLDS.RECENT) {
    return SPEED_RECENCY_MULTIPLIERS.RECENT;
  }

  // 31-60 days: 5% reduction - still relevant
  if (daysSinceRace <= SPEED_RECENCY_THRESHOLDS.RELEVANT) {
    return SPEED_RECENCY_MULTIPLIERS.RELEVANT;
  }

  // 61-90 days: 15% reduction - getting stale
  if (daysSinceRace <= SPEED_RECENCY_THRESHOLDS.GETTING_STALE) {
    return SPEED_RECENCY_MULTIPLIERS.GETTING_STALE;
  }

  // 91-120 days: 25% reduction - stale
  if (daysSinceRace <= SPEED_RECENCY_THRESHOLDS.STALE) {
    return SPEED_RECENCY_MULTIPLIERS.STALE;
  }

  // 121-180 days: 40% reduction - very stale
  if (daysSinceRace <= SPEED_RECENCY_THRESHOLDS.VERY_STALE) {
    return SPEED_RECENCY_MULTIPLIERS.VERY_STALE;
  }

  // 181+ days: 55% reduction - ancient
  return SPEED_RECENCY_MULTIPLIERS.ANCIENT;
}

/**
 * Count the number of valid speed figures within a given day window.
 *
 * Used for Active Horse Protection: if a horse has 3+ figures in the last 90 days,
 * it's considered "active" and old standout figures shouldn't be heavily penalized.
 *
 * @param pastPerformances - Array of past performances
 * @param todayDate - Today's date for calculating figure age
 * @param windowDays - Maximum days to look back (default: 90)
 * @returns Count of figures within the window
 */
function countFiguresInWindow(
  pastPerformances: PastPerformance[],
  todayDate: string,
  windowDays: number = ACTIVE_HORSE_WINDOW_DAYS
): number {
  let count = 0;

  for (const pp of pastPerformances) {
    // Check if this PP has a valid figure
    const figure = extractSpeedFigure(pp);
    if (figure === null) continue;

    // Calculate days since this race
    const daysSinceRace = calculateDaysSinceRace(pp.date, todayDate);
    if (daysSinceRace === null) continue;

    // Count if within window
    if (daysSinceRace <= windowDays) {
      count++;
    }
  }

  return count;
}

/**
 * Get the best (highest) recency multiplier from recent figures within a window.
 *
 * Used for Active Horse Protection: when an active horse (3+ figures in 90 days)
 * has an old standout figure, we use this better multiplier instead of the
 * stale multiplier that would normally apply to the old figure.
 *
 * @param pastPerformances - Array of past performances
 * @param todayDate - Today's date for calculating figure age
 * @param windowDays - Maximum days to look back (default: 90)
 * @returns The best (highest) multiplier found, or null if no figures in window
 */
function getBestMultiplierInWindow(
  pastPerformances: PastPerformance[],
  todayDate: string,
  windowDays: number = ACTIVE_HORSE_WINDOW_DAYS
): number | null {
  let bestMultiplier: number | null = null;

  for (const pp of pastPerformances) {
    // Check if this PP has a valid figure
    const figure = extractSpeedFigure(pp);
    if (figure === null) continue;

    // Calculate days since this race
    const daysSinceRace = calculateDaysSinceRace(pp.date, todayDate);
    if (daysSinceRace === null) continue;

    // Only consider figures within the window
    if (daysSinceRace <= windowDays) {
      const multiplier = getRecencyDecayMultiplier(daysSinceRace);
      if (bestMultiplier === null || multiplier > bestMultiplier) {
        bestMultiplier = multiplier;
      }
    }
  }

  return bestMultiplier;
}

// ============================================================================
// SPEED FIGURE EXTRACTION
// ============================================================================

/**
 * Result of extracting speed figure with variant data
 */
interface ExtractedSpeedFigure {
  figure: number | null;
  variant: number | null;
}

/**
 * Extract the best available speed figure and variant from a past performance
 * Prefers Beyer, falls back to TimeformUS, then Equibase
 */
function extractSpeedFigureWithVariant(pp: PastPerformance): ExtractedSpeedFigure {
  const figures = pp.speedFigures;
  let figure: number | null = null;

  // Prefer Beyer as primary
  if (figures.beyer !== null && figures.beyer > 0) {
    figure = figures.beyer;
  }
  // TimeformUS as secondary
  else if (figures.timeformUS !== null && figures.timeformUS > 0) {
    figure = figures.timeformUS;
  }
  // Equibase as fallback
  else if (figures.equibase !== null && figures.equibase > 0) {
    figure = figures.equibase;
  }

  return {
    figure,
    variant: figures.trackVariant,
  };
}

/**
 * Extract the best available speed figure from a past performance
 * Prefers Beyer, falls back to TimeformUS, then Equibase
 */
function extractSpeedFigure(pp: PastPerformance): number | null {
  return extractSpeedFigureWithVariant(pp).figure;
}

/**
 * Result of getting best recent figure with variant adjustment
 */
interface BestRecentFigureResult {
  /** Raw (unadjusted) best figure */
  rawFigure: number | null;
  /** Variant-adjusted best figure */
  adjustedFigure: number | null;
  /** Recency-decayed figure (for scoring comparison) */
  decayedFigure: number | null;
  /** Recency decay multiplier applied */
  recencyMultiplier: number;
  /** Days since the race with best figure */
  daysSinceRace: number | null;
  /** Variant adjustment details */
  variantResult: VariantAdjustmentResult | null;
  /** Which past performance had the best adjusted figure */
  bestPP: PastPerformance | null;
}

/**
 * Get best speed figure from last N races with variant adjustment and recency decay.
 * Returns both raw and variant-adjusted figures, plus recency-decayed figure for scoring.
 *
 * v3.7 RECENCY DECAY:
 * Figures are weighted by age to prevent stale high figures from dominating over
 * recent competitive figures. A 90 Beyer from 120 days ago is worth less than
 * an 85 Beyer from 14 days ago.
 *
 * v3.7 ACTIVE HORSE PROTECTION:
 * If a horse has 3+ figures in the last 90 days, it's considered "active".
 * For active horses, old standout figures (>90 days) are protected from heavy
 * decay by using the best multiplier from recent figures instead.
 *
 * This prevents penalizing an active horse that happens to have an older
 * career-best figure. If they're racing frequently, the old figure still
 * reflects maintained ability.
 *
 * @param pastPerformances - Array of past performances
 * @param count - Number of recent races to consider (default 3)
 * @param todayDate - Today's date for calculating figure age (YYYYMMDD or YYYY-MM-DD)
 */
function getBestRecentFigureWithVariant(
  pastPerformances: PastPerformance[],
  count: number = 3,
  todayDate?: string
): BestRecentFigureResult {
  const recentPPs = pastPerformances.slice(0, count);

  // Use current date if not provided
  const today = todayDate || new Date().toISOString().split('T')[0]?.replace(/-/g, '') || '';

  if (recentPPs.length === 0) {
    return {
      rawFigure: null,
      adjustedFigure: null,
      decayedFigure: null,
      recencyMultiplier: 1.0,
      daysSinceRace: null,
      variantResult: null,
      bestPP: null,
    };
  }

  // v3.7 ACTIVE HORSE PROTECTION
  // Check if horse qualifies for active horse protection:
  // - Has 3+ figures in the last 90 days
  // - If so, old standout figures use the best recent multiplier instead of stale one
  const figuresInWindow = countFiguresInWindow(pastPerformances, today, ACTIVE_HORSE_WINDOW_DAYS);
  const isActiveHorse = figuresInWindow >= ACTIVE_HORSE_FIGURE_THRESHOLD;
  const bestRecentMultiplier = isActiveHorse
    ? getBestMultiplierInWindow(pastPerformances, today, ACTIVE_HORSE_WINDOW_DAYS)
    : null;

  // Extract figures with variants, calculate adjusted figures, and apply recency decay
  const figuresWithAdjustments = recentPPs.map((pp) => {
    const extracted = extractSpeedFigureWithVariant(pp);
    if (extracted.figure === null) {
      return {
        pp,
        rawFigure: null,
        adjustedFigure: null,
        decayedFigure: null,
        recencyMultiplier: 1.0,
        daysSinceRace: null,
        variantResult: null,
      };
    }

    const variantResult = adjustFigureForVariant(extracted.figure, extracted.variant);

    // Calculate recency decay
    const daysSinceRace = calculateDaysSinceRace(pp.date, today);
    let recencyMultiplier = getRecencyDecayMultiplier(daysSinceRace);

    // v3.7 ACTIVE HORSE PROTECTION:
    // If this is an active horse and the figure is old (>90 days),
    // use the best recent multiplier to protect the old standout figure
    if (
      isActiveHorse &&
      bestRecentMultiplier !== null &&
      daysSinceRace !== null &&
      daysSinceRace > ACTIVE_HORSE_WINDOW_DAYS
    ) {
      // Use the better of: the figure's natural multiplier OR the best recent multiplier
      // This ensures active horses aren't penalized for having an old career-best
      recencyMultiplier = Math.max(recencyMultiplier, bestRecentMultiplier);
    }

    const decayedFigure = Math.round(variantResult.adjustedFigure * recencyMultiplier);

    return {
      pp,
      rawFigure: extracted.figure,
      adjustedFigure: variantResult.adjustedFigure,
      decayedFigure,
      recencyMultiplier,
      daysSinceRace,
      variantResult,
    };
  });

  // Filter out nulls and find the best DECAYED figure (not raw/adjusted)
  // This ensures we're comparing apples to apples with recency factored in
  const validFigures = figuresWithAdjustments.filter(
    (
      f
    ): f is {
      pp: PastPerformance;
      rawFigure: number;
      adjustedFigure: number;
      decayedFigure: number;
      recencyMultiplier: number;
      daysSinceRace: number | null;
      variantResult: VariantAdjustmentResult;
    } => f.decayedFigure !== null
  );

  if (validFigures.length === 0) {
    return {
      rawFigure: null,
      adjustedFigure: null,
      decayedFigure: null,
      recencyMultiplier: 1.0,
      daysSinceRace: null,
      variantResult: null,
      bestPP: null,
    };
  }

  // Find the PP with the best DECAYED figure
  // This prioritizes recent competitive figures over stale high figures
  const best = validFigures.reduce((best, current) =>
    current.decayedFigure > best.decayedFigure ? current : best
  );

  return {
    rawFigure: best.rawFigure,
    adjustedFigure: best.adjustedFigure,
    decayedFigure: best.decayedFigure,
    recencyMultiplier: best.recencyMultiplier,
    daysSinceRace: best.daysSinceRace,
    variantResult: best.variantResult,
    bestPP: best.pp,
  };
}

/**
 * Get average speed figure from last N races
 */
function getAverageFigure(pastPerformances: PastPerformance[], count: number = 5): number | null {
  const recentPPs = pastPerformances.slice(0, count);

  const figures = recentPPs.map(extractSpeedFigure).filter((f): f is number => f !== null);

  if (figures.length === 0) return null;

  return Math.round(figures.reduce((a, b) => a + b, 0) / figures.length);
}

// ============================================================================
// SPEED FIGURE CONFIDENCE (DATA COMPLETENESS PENALTIES)
// ============================================================================

/**
 * Get speed confidence multiplier based on figure count in last 3 races
 *
 * PENALTY LOGIC (Phase 2 - Data Completeness):
 * - 3+ figures in last 3 races → 100% confidence (full scoring)
 * - 2 figures in last 3 races → 75% confidence (67.5 pts max from 90)
 * - 1 figure in last 3 races → 37.5% confidence (33.75 pts max from 90)
 * - 0 figures → 25% baseline (22.5 pts max) - heavily penalized
 *
 * This creates meaningful differentiation between horses with proven
 * speed figure history vs. unknowns/first-time starters.
 */
export function getSpeedConfidenceMultiplier(figureCount: number): number {
  if (figureCount >= 3) return 1.0; // Full confidence
  if (figureCount === 2) return 0.75; // 75% confidence
  if (figureCount === 1) return 0.375; // 37.5% confidence - limited data
  return 0.25; // 25% baseline - heavily penalized for no figures
}

/**
 * Count valid Beyer figures in last N races
 */
function countSpeedFigures(pastPerformances: PastPerformance[], count: number = 3): number {
  const recentPPs = pastPerformances.slice(0, count);
  let figureCount = 0;

  for (const pp of recentPPs) {
    const figure = extractSpeedFigure(pp);
    if (figure !== null) {
      figureCount++;
    }
  }

  return figureCount;
}

// ============================================================================
// SPEED FIGURE SCORING
// ============================================================================

/** Maximum speed figure score (Model B: increased from 90 to 105) */
export const MAX_SPEED_SCORE = 105;

/**
 * Calculate RAW speed figure score (0-105 points) before confidence adjustment
 * Based on comparison to par for today's class
 *
 * Model B NEW TIERS (105 max):
 * ≥ +10 differential to par → 105 pts
 * +7 to +9 → 95 pts
 * +4 to +6 → 80 pts
 * +1 to +3 (slightly above par) → 70 pts
 * 0 (at par) → 55 pts
 * -1 to -3 → 45 pts
 * -4 to -6 → 35 pts
 * -7 to -9 → 25 pts
 * ≤ -10 → 15 pts
 */
function calculateRawSpeedScore(
  figure: number,
  parForClass: number
): { score: number; reasoning: string } {
  const differential = figure - parForClass;

  let score: number;
  let reasoning: string;

  if (differential >= 10) {
    score = 105;
    reasoning = `${figure} Beyer (+${differential} above par ${parForClass}) - Elite`;
  } else if (differential >= 7) {
    score = 95;
    reasoning = `${figure} Beyer (+${differential} above par ${parForClass}) - Strong`;
  } else if (differential >= 4) {
    score = 80;
    reasoning = `${figure} Beyer (+${differential} above par ${parForClass}) - Good`;
  } else if (differential >= 1) {
    score = 70;
    reasoning = `${figure} Beyer (+${differential} above par ${parForClass}) - Above par`;
  } else if (differential === 0) {
    score = 55;
    reasoning = `${figure} Beyer (at par ${parForClass})`;
  } else if (differential >= -3) {
    score = 45;
    reasoning = `${figure} Beyer (${Math.abs(differential)} below par ${parForClass})`;
  } else if (differential >= -6) {
    score = 35;
    reasoning = `${figure} Beyer (${Math.abs(differential)} below par ${parForClass})`;
  } else if (differential >= -9) {
    score = 25;
    reasoning = `${figure} Beyer (${Math.abs(differential)} below par ${parForClass})`;
  } else {
    score = 15;
    reasoning = `${figure} Beyer (${Math.abs(differential)} below par ${parForClass}) - Below par`;
  }

  return { score, reasoning };
}

/**
 * Calculate speed figure score (0-105 points)
 * Based on comparison to par for today's class
 *
 * Model B: Increased from 90 to 105 max to weight speed at ~32% (industry standard 30-40%)
 *
 * SCORING WITH CONFIDENCE (Phase 2 still applies):
 * - No Beyer figures → 26.25 pts (25% of max 105, penalized for unknown)
 * - Only 1 figure in last 3 → score capped at ~39 pts max
 * - 2 figures in last 3 → score capped at ~79 pts max
 * - 3+ figures in last 3 → full 105 pts max
 */
function calculateSpeedFigureScore(
  bestRecent: number | null,
  average: number | null,
  parForClass: number,
  figureCount: number = 0
): { score: number; reasoning: string; confidenceMultiplier: number } {
  // Use best recent figure primarily, average as fallback
  const figure = bestRecent ?? average;

  // Get confidence multiplier based on data completeness
  const multiplier = getSpeedConfidenceMultiplier(figureCount);

  if (figure === null) {
    // PHASE 2: Penalized score for no data (22.5 pts = 25% of 90, not neutral)
    const penalizedScore = Math.round(MAX_SPEED_SCORE * 0.25);
    return {
      score: penalizedScore,
      reasoning: `No speed figures available (penalized: ${penalizedScore}/${MAX_SPEED_SCORE} pts)`,
      confidenceMultiplier: multiplier,
    };
  }

  // Calculate raw score based on figure quality
  const rawResult = calculateRawSpeedScore(figure, parForClass);
  const rawScore = rawResult.score;
  let reasoning = rawResult.reasoning;

  // PHASE 2: Apply confidence multiplier to cap score based on data availability
  // This penalizes horses with fewer speed figures in recent races
  const adjustedScore = Math.round(rawScore * multiplier);

  if (bestRecent !== null && average !== null) {
    reasoning += ` | Best: ${bestRecent}, Avg: ${average}`;
  }

  // Add confidence info to reasoning if less than full confidence
  if (multiplier < 1.0) {
    const maxPossible = Math.round(MAX_SPEED_SCORE * multiplier);
    reasoning += ` | Confidence: ${Math.round(multiplier * 100)}% (${figureCount} fig${figureCount === 1 ? '' : 's'}, max ${maxPossible} pts)`;
  }

  return { score: adjustedScore, reasoning, confidenceMultiplier: multiplier };
}

// ============================================================================
// CLASS LEVEL ANALYSIS
// ============================================================================

/**
 * Determine class movement from past performances
 */
function analyzeClassMovement(
  currentClass: RaceClassification,
  pastPerformances: PastPerformance[]
): 'drop' | 'rise' | 'level' | 'unknown' {
  if (pastPerformances.length === 0) {
    return 'unknown';
  }

  const lastRace = pastPerformances[0];
  if (!lastRace) {
    return 'unknown';
  }

  const currentLevel = CLASS_HIERARCHY[currentClass];
  const lastRaceLevel = CLASS_HIERARCHY[lastRace.classification];

  if (currentLevel < lastRaceLevel) {
    return 'drop';
  } else if (currentLevel > lastRaceLevel) {
    return 'rise';
  } else {
    return 'level';
  }
}

/**
 * Check if horse has proven at this class level
 * Returns true if horse has won or placed at same or higher level
 */
function hasProvenAtClass(
  currentClass: RaceClassification,
  pastPerformances: PastPerformance[]
): { proven: boolean; wins: number; itmCount: number } {
  const currentLevel = CLASS_HIERARCHY[currentClass];

  let wins = 0;
  let itmCount = 0; // In the money (1st, 2nd, 3rd)

  for (const pp of pastPerformances) {
    const ppLevel = CLASS_HIERARCHY[pp.classification];

    // Only count races at same level or higher
    if (ppLevel >= currentLevel) {
      if (pp.finishPosition === 1) wins++;
      if (pp.finishPosition <= 3) itmCount++;
    }
  }

  return {
    proven: wins > 0,
    wins,
    itmCount,
  };
}

/**
 * Check for valid excuse in last race
 * (Wide trip, trouble, blocked, etc.)
 */
function hasValidExcuse(pp: PastPerformance): boolean {
  const excuse = pp.tripComment.toLowerCase();

  const excuseKeywords = [
    'wide',
    'blocked',
    'steadied',
    'bumped',
    'traffic',
    'impeded',
    'checked',
    'shuffled',
    'boxed',
    'crowded',
    'slow start',
    'stumbled',
    'poor break',
    'eased',
  ];

  return excuseKeywords.some((keyword) => excuse.includes(keyword));
}

/**
 * Calculate class level score (0-35 points)
 * Model B: Scaled up from 32 to 35 max
 */
function calculateClassScore(
  currentClass: RaceClassification,
  pastPerformances: PastPerformance[],
  classMovement: 'drop' | 'rise' | 'level' | 'unknown'
): { score: number; reasoning: string } {
  if (pastPerformances.length === 0) {
    return {
      score: 17, // Neutral for first-time starters
      reasoning: 'First-time starter - class unknown',
    };
  }

  const provenData = hasProvenAtClass(currentClass, pastPerformances);
  const lastRace = pastPerformances[0];
  if (!lastRace) {
    return {
      score: 17,
      reasoning: 'No recent race data',
    };
  }
  const hasExcuse = hasValidExcuse(lastRace);

  // v3.4 FIX: For maiden races, "proven winner at level" is illogical.
  // If a horse truly won a maiden race, they can't run in another maiden race.
  // Any "win" in PP data at maiden level is likely from a different tier/price class.
  // So we cap maiden class scores at 26 pts (competitive, not "proven winner").
  const isMaidenRace = currentClass === 'maiden' || currentClass === 'maiden-claiming';

  // Proven winner at this level (but NOT for maiden races)
  if (provenData.proven && !isMaidenRace) {
    return {
      score: 35, // Max score
      reasoning: `Proven winner at level (${provenData.wins}W, ${provenData.itmCount} ITM at class)`,
    };
  }

  // v3.4: For maiden races with "proven" data, treat as competitive only
  if (provenData.proven && isMaidenRace) {
    return {
      score: 26, // Capped for maiden races
      reasoning: `Maiden race - capped at competitive (${provenData.wins}W at similar class)`,
    };
  }

  // Competitive at level (placed but not won)
  if (provenData.itmCount >= 2) {
    return {
      score: 26,
      reasoning: `Competitive at level (${provenData.itmCount} ITM at class)`,
    };
  }

  // Class drop with valid excuse
  if (classMovement === 'drop' && hasExcuse) {
    return {
      score: 32,
      reasoning: `Class drop with excuse: "${lastRace.tripComment.substring(0, 30)}..."`,
    };
  }

  // Simple class drop
  if (classMovement === 'drop') {
    return {
      score: 28,
      reasoning: 'Dropping in class',
    };
  }

  // Class rise
  if (classMovement === 'rise') {
    // Check if horse was competitive in lower class
    const wasCompetitive =
      lastRace.finishPosition <= 3 || (lastRace.finishPosition <= 5 && lastRace.lengthsBehind < 5);

    if (wasCompetitive) {
      return {
        score: 21,
        reasoning: 'Rising in class, competitive last out',
      };
    }

    return {
      score: 17,
      reasoning: 'Rising in class - testing',
    };
  }

  // Level class, not proven
  if (provenData.itmCount >= 1) {
    return {
      score: 21,
      reasoning: 'Placed at level, seeking first win',
    };
  }

  // Overmatched or struggling at level
  const recentPlacings = pastPerformances.slice(0, 3).filter((pp) => pp.finishPosition <= 5).length;

  if (recentPlacings === 0) {
    return {
      score: 9,
      reasoning: 'Struggling at current level',
    };
  }

  return {
    score: 17,
    reasoning: 'Competitive but unproven at level',
  };
}

// ============================================================================
// SALE PRICE SCORING (for FTS and lightly raced horses)
// ============================================================================

/** Maximum bonus points from sale price */
export const MAX_SALE_PRICE_BONUS = 8;

/** Maximum career starts for sale price scoring to apply */
export const MAX_STARTS_FOR_SALE_PRICE = 5;

/**
 * Sale price tier definitions with bonus points
 *
 * Typical thoroughbred sale prices:
 * - Elite: $500,000+ (top prospects, Grade 1 potential)
 * - High: $200,000 - $499,999 (stakes potential)
 * - Above Average: $100,000 - $199,999 (solid prospects)
 * - Average: $50,000 - $99,999 (typical claimers/allowance)
 * - Below Average: $20,000 - $49,999 (lower expectations)
 * - Bargain: <$20,000 (longshots, rescue cases)
 * - Private/No Sale: $0 or null (homebred or no auction record)
 */
const SALE_PRICE_TIERS = [
  { minPrice: 500000, bonus: 8, tier: 'Elite' },
  { minPrice: 200000, bonus: 6, tier: 'High-End' },
  { minPrice: 100000, bonus: 4, tier: 'Above Average' },
  { minPrice: 50000, bonus: 2, tier: 'Solid' },
  { minPrice: 20000, bonus: 1, tier: 'Average' },
] as const;

/**
 * Result of sale price bonus calculation
 */
export interface SalePriceBonusResult {
  /** Whether sale price bonus was applied */
  applied: boolean;
  /** Bonus points awarded (0-8) */
  bonus: number;
  /** Sale price in dollars */
  salePrice: number | null;
  /** Sale location/type */
  saleLocation: string | null;
  /** Price tier description */
  priceTier: string;
  /** Human-readable reasoning */
  reasoning: string;
}

/**
 * Calculate sale price bonus for first-time starters and lightly raced horses
 *
 * Sale price indicates the market's perceived class potential based on
 * pedigree, conformation, and professional assessment at auction.
 *
 * ELIGIBILITY:
 * - Horse is first-time starter (0 career starts), OR
 * - Horse has fewer than 5 career starts AND lacks reliable speed figures
 *
 * SCORING:
 * - $500,000+: +8 pts (elite purchase)
 * - $200,000 - $499,999: +6 pts (high-end purchase)
 * - $100,000 - $199,999: +4 pts (above average)
 * - $50,000 - $99,999: +2 pts (solid purchase)
 * - $20,000 - $49,999: +1 pt (average)
 * - <$20,000: 0 pts (no bonus, no penalty)
 * - $0/null: 0 pts (homebred/unknown - use breeding fallback)
 *
 * @param salePrice - The horse's auction/sale price in dollars
 * @param saleLocation - The sale location/type (e.g., "KEE SEP YRLG")
 * @param lifetimeStarts - Horse's total career starts
 * @param hasReliableSpeedFigures - Whether horse has established speed figures
 */
export function calculateSalePriceBonus(
  salePrice: number | null,
  saleLocation: string | null,
  lifetimeStarts: number,
  hasReliableSpeedFigures: boolean
): SalePriceBonusResult {
  // Default result for ineligible horses
  const defaultResult: SalePriceBonusResult = {
    applied: false,
    bonus: 0,
    salePrice,
    saleLocation,
    priceTier: 'N/A',
    reasoning: '',
  };

  // Eligibility check: Only apply to FTS or lightly raced horses
  const isFirstTimeStarter = lifetimeStarts === 0;
  const isLightlyRaced = lifetimeStarts > 0 && lifetimeStarts < MAX_STARTS_FOR_SALE_PRICE;

  // Experienced horses (5+ starts) don't get sale price bonus - they have race records
  if (lifetimeStarts >= MAX_STARTS_FOR_SALE_PRICE) {
    return {
      ...defaultResult,
      reasoning: `Not applied - horse has ${lifetimeStarts} starts (5+ = has race record)`,
    };
  }

  // Lightly raced horses with reliable speed figures don't need sale price bonus
  if (isLightlyRaced && hasReliableSpeedFigures) {
    return {
      ...defaultResult,
      reasoning: `Not applied - lightly raced (${lifetimeStarts} starts) but has established speed figures`,
    };
  }

  // No sale price data (homebred or private purchase)
  if (salePrice === null || salePrice === 0) {
    return {
      ...defaultResult,
      priceTier: 'Homebred/Private',
      reasoning: isFirstTimeStarter
        ? 'FTS - No sale price (homebred/private), using breeding fallback'
        : `Lightly raced (${lifetimeStarts} starts) - No sale price, using breeding fallback`,
    };
  }

  // Find the appropriate price tier and bonus
  for (const tier of SALE_PRICE_TIERS) {
    if (salePrice >= tier.minPrice) {
      const prefix = isFirstTimeStarter ? 'FTS' : `Lightly raced (${lifetimeStarts} starts)`;
      const locationInfo = saleLocation ? ` at ${saleLocation}` : '';

      return {
        applied: true,
        bonus: tier.bonus,
        salePrice,
        saleLocation,
        priceTier: tier.tier,
        reasoning: `${prefix} - $${salePrice.toLocaleString()}${locationInfo} (${tier.tier}: +${tier.bonus} pts)`,
      };
    }
  }

  // Below $20,000 - no bonus but acknowledge the sale
  const prefix = isFirstTimeStarter ? 'FTS' : `Lightly raced (${lifetimeStarts} starts)`;
  const locationInfo = saleLocation ? ` at ${saleLocation}` : '';

  return {
    applied: false,
    bonus: 0,
    salePrice,
    saleLocation,
    priceTier: 'Bargain',
    reasoning: `${prefix} - $${salePrice.toLocaleString()}${locationInfo} (below bonus threshold)`,
  };
}

/**
 * Check if a horse has reliable speed figures
 * Used to determine if sale price scoring should apply to lightly raced horses
 *
 * @param pastPerformances - Horse's past performance records
 * @param figureCount - Number of valid figures in recent races (from speed confidence)
 */
export function hasReliableSpeedFigures(
  pastPerformances: PastPerformance[],
  figureCount: number
): boolean {
  // Need at least 2 valid speed figures to be "reliable"
  if (figureCount < 2) return false;

  // Check if the figures are reasonably high (not all 0s or very low)
  const validFigures = pastPerformances
    .slice(0, 3)
    .map((pp) => pp.speedFigures.beyer ?? pp.speedFigures.timeformUS ?? pp.speedFigures.equibase)
    .filter((f): f is number => f !== null && f > 0);

  // Need at least 2 valid figures with average above 50 to be "reliable"
  if (validFigures.length < 2) return false;

  const avgFigure = validFigures.reduce((sum, f) => sum + f, 0) / validFigures.length;
  return avgFigure >= 50;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Calculate speed and class score for a horse
 *
 * Includes track-relative normalization:
 * - Track tier adjustments (Tier 1 elite vs Tier 4 weak)
 * - Track-specific par figures when available
 * - Shipper analysis for horses changing track tiers
 * - Recency decay on speed figures (stale figures worth less)
 *
 * @param horse - The horse entry to score
 * @param raceHeader - Race information
 * @param raceDate - Optional race date for recency decay calculation (YYYYMMDD or YYYY-MM-DD)
 * @returns Detailed score breakdown with track normalization
 */
export function calculateSpeedClassScore(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  raceDate?: string
): SpeedClassScoreResult {
  const currentClass = raceHeader.classification;
  const parForClass = CLASS_PAR_FIGURES[currentClass];

  // Use provided race date or fall back to header date or current date
  const todayDate = raceDate || raceHeader.raceDateRaw || new Date().toISOString().split('T')[0];

  // =========================================================================
  // GET SPEED FIGURES WITH TRACK VARIANT ADJUSTMENT AND RECENCY DECAY
  // =========================================================================

  // Get best recent figure with variant adjustment and recency decay applied
  const bestFigureResult = getBestRecentFigureWithVariant(horse.pastPerformances, 3, todayDate);

  // Fallback to horse entry's lastBeyer if no PPs (first-time starter)
  let bestRecentFigure = bestFigureResult.adjustedFigure;
  let decayedFigure = bestFigureResult.decayedFigure;
  let rawBestFigure = bestFigureResult.rawFigure;
  let variantAdjustmentInfo = bestFigureResult.variantResult;
  let bestPP = bestFigureResult.bestPP;
  let recencyMultiplier = bestFigureResult.recencyMultiplier;
  let daysSinceRace = bestFigureResult.daysSinceRace;

  // Fallback to lastBeyer from horse entry if no PPs
  if (bestRecentFigure === null && horse.lastBeyer !== null && horse.lastBeyer > 0) {
    bestRecentFigure = horse.lastBeyer;
    decayedFigure = horse.lastBeyer; // No decay for fallback (unknown age)
    rawBestFigure = horse.lastBeyer;
    variantAdjustmentInfo = null;
    bestPP = null;
    recencyMultiplier = 0.75; // Assume moderate staleness for unknown
    daysSinceRace = null;
  }

  const averageFigure = getAverageFigure(horse.pastPerformances, 5) ?? horse.averageBeyer ?? null;

  // PHASE 2: Count speed figures for confidence multiplier
  const figureCount = countSpeedFigures(horse.pastPerformances, 3);

  // Analyze class movement
  const classMovement = analyzeClassMovement(currentClass, horse.pastPerformances);

  // =========================================================================
  // TRACK NORMALIZATION
  // =========================================================================

  // Get current track tier info
  const currentTrackTier = getSpeedTier(raceHeader.trackCode);
  const currentTrackTierName = TIER_NAMES[currentTrackTier];
  const tierAdjustment = getTrackTierAdjustment(raceHeader.trackCode);

  // Get track-specific par figure if available
  const trackParFigure = getTrackSpeedPar(
    raceHeader.trackCode,
    raceHeader.distanceFurlongs,
    currentClass
  );

  // Calculate par differential (using adjusted figure)
  let parDifferential: number | null = null;
  if (trackParFigure !== null && bestRecentFigure !== null) {
    parDifferential = bestRecentFigure - trackParFigure;
  }

  // Analyze shipper status (detect if moving between track tiers)
  let shipperAnalysis: ShipperAnalysis | undefined;
  let shipperAdjustment = 0;
  const lastPP = horse.pastPerformances[0];
  if (lastPP) {
    shipperAnalysis = analyzeShipper(lastPP.track, raceHeader.trackCode);
    if (shipperAnalysis.isShipping) {
      shipperAdjustment = shipperAnalysis.adjustment;
    }
  }

  // Calculate effective figure for scoring
  // Start with DECAYED figure (recency-adjusted), then apply tier normalization
  // This ensures stale high figures don't dominate over recent competitive figures
  let effectiveFigure = decayedFigure;
  if (effectiveFigure !== null && bestPP) {
    const figureTierAdj = getTrackTierAdjustment(bestPP.track);
    // Apply tier adjustment to the figure for comparison purposes
    effectiveFigure = effectiveFigure + figureTierAdj;
  } else if (effectiveFigure !== null) {
    // Fallback: check horse's past performances for tier adjustment
    const figureTracks = horse.pastPerformances.slice(0, 3).map((pp) => pp.track);
    if (figureTracks.length > 0 && rawBestFigure !== null) {
      // Find the track where the best raw figure was earned
      const bestPPByRaw = horse.pastPerformances
        .slice(0, 3)
        .find((pp) => extractSpeedFigure(pp) === rawBestFigure);
      if (bestPPByRaw) {
        const figureTierAdj = getTrackTierAdjustment(bestPPByRaw.track);
        effectiveFigure = effectiveFigure + figureTierAdj;
      }
    }
  }

  // Calculate speed score using effective (normalized + variant-adjusted + recency-decayed) figure
  // PHASE 2: Pass figure count for confidence-based scoring
  const speedResult = calculateSpeedFigureScore(
    effectiveFigure,
    averageFigure,
    parForClass,
    figureCount
  );

  // Calculate class score
  const classResult = calculateClassScore(currentClass, horse.pastPerformances, classMovement);

  // Apply seasonal speed adjustment if available
  // Positive adjustment = track playing fast (boost figures), negative = slow (penalize)
  let seasonalAdjustment = 0;
  let adjustedSpeedReasoning = speedResult.reasoning;

  // Add variant adjustment info to reasoning if applicable
  if (variantAdjustmentInfo !== null && variantAdjustmentInfo.adjustment !== 0) {
    adjustedSpeedReasoning += ` | ${variantAdjustmentInfo.reasoning}`;
  }

  if (isTrackIntelligenceAvailable(raceHeader.trackCode)) {
    const rawSeasonalAdj = getSeasonalSpeedAdjustment(raceHeader.trackCode);
    if (rawSeasonalAdj !== 0 && bestRecentFigure !== null) {
      // Convert seasonal adjustment to score points
      // Track playing +2 faster = slight boost, -2 slower = slight penalty
      // Rescaled from ±3 to ±5 (scale factor: 80/50 = 1.6)
      seasonalAdjustment = Math.round(rawSeasonalAdj * 0.8); // ±2-3 points typically
      seasonalAdjustment = Math.max(-5, Math.min(5, seasonalAdjustment)); // Cap at ±5

      if (seasonalAdjustment > 0) {
        adjustedSpeedReasoning += ` | Track playing fast (seasonal +${seasonalAdjustment})`;
      } else if (seasonalAdjustment < 0) {
        adjustedSpeedReasoning += ` | Track playing slow (seasonal ${seasonalAdjustment})`;
      }
    }
  }

  // Apply shipper adjustment to reasoning
  if (shipperAnalysis?.isShipping && shipperAdjustment !== 0) {
    if (shipperAdjustment > 0) {
      adjustedSpeedReasoning += ` | Shipping down (+${shipperAdjustment})`;
    } else {
      adjustedSpeedReasoning += ` | Shipping up (${shipperAdjustment})`;
    }
  }

  // Add track tier info to reasoning
  if (bestRecentFigure !== null) {
    const lastPPForReasoning = horse.pastPerformances[0];
    if (lastPPForReasoning) {
      const figureTier = getSpeedTier(lastPPForReasoning.track);
      if (figureTier !== currentTrackTier) {
        adjustedSpeedReasoning += ` | Figures from Tier ${figureTier} track`;
      }
    }
  }

  // Add track par info to reasoning if available
  if (trackParFigure !== null && bestRecentFigure !== null) {
    const parDiff = bestRecentFigure - trackParFigure;
    if (Math.abs(parDiff) >= 5) {
      if (parDiff > 0) {
        adjustedSpeedReasoning += ` | ${parDiff}+ above ${raceHeader.trackCode} par`;
      } else {
        adjustedSpeedReasoning += ` | ${Math.abs(parDiff)} below ${raceHeader.trackCode} par`;
      }
    }
  }

  // Add recency decay info to reasoning if decay was applied
  if (recencyMultiplier < 1.0 && daysSinceRace !== null && bestRecentFigure !== null) {
    const decayPct = Math.round((1 - recencyMultiplier) * 100);
    adjustedSpeedReasoning += ` | Recency: ${daysSinceRace}d old (-${decayPct}% decay, ${bestRecentFigure}→${decayedFigure})`;
  }

  // Apply shipper adjustment to speed score (±2-5 points max)
  // Model B: Updated max from 90 to 105
  const adjustedSpeedScore = Math.max(
    0,
    Math.min(
      MAX_SPEED_SCORE,
      speedResult.score + seasonalAdjustment + Math.round(shipperAdjustment * 0.5)
    )
  );

  // Build variant adjustment info for result
  const variantAdjustmentResult =
    rawBestFigure !== null && variantAdjustmentInfo !== null
      ? {
          rawFigure: rawBestFigure,
          adjustedFigure: bestRecentFigure!,
          adjustment: variantAdjustmentInfo.adjustment,
          variant: bestPP?.speedFigures.trackVariant ?? null,
          reasoning: variantAdjustmentInfo.reasoning,
        }
      : undefined;

  // PHASE 2: Build speed confidence info for data completeness tracking
  const speedConfidenceMultiplier = speedResult.confidenceMultiplier;
  const speedConfidence = {
    figureCount,
    multiplier: speedConfidenceMultiplier,
    maxPossibleScore: Math.round(MAX_SPEED_SCORE * speedConfidenceMultiplier),
    penaltyApplied: speedConfidenceMultiplier < 1.0,
  };

  // Build recency decay info
  const recencyDecay = {
    daysSinceRace,
    multiplier: recencyMultiplier,
    originalFigure: bestRecentFigure,
    decayedFigure,
    decayApplied: recencyMultiplier < 1.0,
  };

  // SALE PRICE SCORING: Apply bonus for FTS and lightly raced horses
  // This helps evaluate horses that lack performance history
  const lifetimeStarts = horse.lifetimeStarts ?? horse.pastPerformances.length;
  const hasReliableFigures = hasReliableSpeedFigures(horse.pastPerformances, figureCount);
  const salePriceBonus = calculateSalePriceBonus(
    horse.salePrice,
    horse.saleLocation,
    lifetimeStarts,
    hasReliableFigures
  );

  // Calculate final total with sale price bonus (bonus is added to class score conceptually)
  const totalWithSalePrice = adjustedSpeedScore + classResult.score + salePriceBonus.bonus;

  // Add sale price info to class reasoning if bonus was applied
  let adjustedClassReasoning = classResult.reasoning;
  if (salePriceBonus.applied) {
    adjustedClassReasoning += ` | Sale: ${salePriceBonus.reasoning}`;
  } else if (salePriceBonus.priceTier === 'Homebred/Private' && lifetimeStarts === 0) {
    // Note homebred status for FTS even though no bonus
    adjustedClassReasoning += ' | Homebred (no sale bonus)';
  }

  return {
    total: totalWithSalePrice,
    speedScore: adjustedSpeedScore,
    classScore: classResult.score + salePriceBonus.bonus, // Include bonus in class score display
    seasonalAdjustment,
    bestRecentFigure,
    averageFigure,
    parForClass,
    classMovement,
    speedReasoning: adjustedSpeedReasoning,
    classReasoning: adjustedClassReasoning,
    variantAdjustment: variantAdjustmentResult,
    trackNormalization: {
      currentTrackTier,
      currentTrackTierName,
      tierAdjustment,
      shipperAnalysis: shipperAnalysis?.isShipping ? shipperAnalysis : undefined,
      trackParFigure,
      parDifferential,
    },
    speedConfidence,
    recencyDecay,
    salePriceScoring: {
      applied: salePriceBonus.applied,
      bonus: salePriceBonus.bonus,
      salePrice: salePriceBonus.salePrice,
      saleLocation: salePriceBonus.saleLocation,
      priceTier: salePriceBonus.priceTier,
      reasoning: salePriceBonus.reasoning,
    },
  };
}

/**
 * Get par figures for comparison
 * Useful for display and analysis
 */
export function getParFigures(): Record<RaceClassification, number> {
  return { ...CLASS_PAR_FIGURES };
}

/**
 * Get class hierarchy for comparison
 */
export function getClassHierarchy(): Record<RaceClassification, number> {
  return { ...CLASS_HIERARCHY };
}
