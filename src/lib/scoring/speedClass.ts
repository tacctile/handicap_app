/**
 * Speed & Class Scoring Module
 * Calculates scores based on speed figures and class level analysis
 *
 * Score Breakdown (v3.2 - Model B Speed-Dominant):
 * - Speed Figure Score: 0-105 points (based on Beyer/TimeformUS figures)
 * - Class Level Score: 0-35 points (based on class movement and success)
 *
 * Total: 0-140 points (43.3% of 323 base)
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
  /** Variant adjustment details */
  variantResult: VariantAdjustmentResult | null;
  /** Which past performance had the best adjusted figure */
  bestPP: PastPerformance | null;
}

/**
 * Get best speed figure from last N races with variant adjustment
 * Returns both raw and variant-adjusted figures
 */
function getBestRecentFigureWithVariant(
  pastPerformances: PastPerformance[],
  count: number = 3
): BestRecentFigureResult {
  const recentPPs = pastPerformances.slice(0, count);

  if (recentPPs.length === 0) {
    return {
      rawFigure: null,
      adjustedFigure: null,
      variantResult: null,
      bestPP: null,
    };
  }

  // Extract figures with variants and calculate adjusted figures
  const figuresWithAdjustments = recentPPs.map((pp) => {
    const extracted = extractSpeedFigureWithVariant(pp);
    if (extracted.figure === null) {
      return { pp, rawFigure: null, adjustedFigure: null, variantResult: null };
    }
    const variantResult = adjustFigureForVariant(extracted.figure, extracted.variant);
    return {
      pp,
      rawFigure: extracted.figure,
      adjustedFigure: variantResult.adjustedFigure,
      variantResult,
    };
  });

  // Filter out nulls and find the best adjusted figure
  const validFigures = figuresWithAdjustments.filter(
    (
      f
    ): f is {
      pp: PastPerformance;
      rawFigure: number;
      adjustedFigure: number;
      variantResult: VariantAdjustmentResult;
    } => f.adjustedFigure !== null
  );

  if (validFigures.length === 0) {
    return {
      rawFigure: null,
      adjustedFigure: null,
      variantResult: null,
      bestPP: null,
    };
  }

  // Find the PP with the best adjusted figure
  const best = validFigures.reduce((best, current) =>
    current.adjustedFigure > best.adjustedFigure ? current : best
  );

  return {
    rawFigure: best.rawFigure,
    adjustedFigure: best.adjustedFigure,
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
 * PENALTY LOGIC (Phase 2 - Missing Data Penalties):
 * - 3+ figures in last 3 races → 100% confidence (full scoring)
 * - 2 figures in last 3 races → 75% confidence (36 pts max)
 * - 1 figure in last 3 races → 37.5% confidence (18 pts max)
 * - 0 figures → 25% baseline (12 pts max, penalized for unknown)
 *
 * This ensures horses with incomplete speed data are penalized,
 * not given neutral scores that reward unknowns.
 */
export function getSpeedConfidenceMultiplier(figureCount: number): number {
  if (figureCount >= 3) return 1.0; // Full confidence
  if (figureCount === 2) return 0.75; // 75% confidence
  if (figureCount === 1) return 0.375; // 37.5% confidence
  return 0.25; // 25% baseline for no figures
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

  // Proven winner at this level
  if (provenData.proven) {
    return {
      score: 35, // Max score
      reasoning: `Proven winner at level (${provenData.wins}W, ${provenData.itmCount} ITM at class)`,
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
// MAIN EXPORT
// ============================================================================

/**
 * Calculate speed and class score for a horse
 *
 * Includes track-relative normalization:
 * - Track tier adjustments (Tier 1 elite vs Tier 4 weak)
 * - Track-specific par figures when available
 * - Shipper analysis for horses changing track tiers
 *
 * @param horse - The horse entry to score
 * @param raceHeader - Race information
 * @returns Detailed score breakdown with track normalization
 */
export function calculateSpeedClassScore(
  horse: HorseEntry,
  raceHeader: RaceHeader
): SpeedClassScoreResult {
  const currentClass = raceHeader.classification;
  const parForClass = CLASS_PAR_FIGURES[currentClass];

  // =========================================================================
  // GET SPEED FIGURES WITH TRACK VARIANT ADJUSTMENT
  // =========================================================================

  // Get best recent figure with variant adjustment applied
  const bestFigureResult = getBestRecentFigureWithVariant(horse.pastPerformances, 3);

  // Fallback to horse entry's lastBeyer if no PPs (first-time starter)
  let bestRecentFigure = bestFigureResult.adjustedFigure;
  let rawBestFigure = bestFigureResult.rawFigure;
  let variantAdjustmentInfo = bestFigureResult.variantResult;
  let bestPP = bestFigureResult.bestPP;

  // Fallback to lastBeyer from horse entry if no PPs
  if (bestRecentFigure === null && horse.lastBeyer !== null && horse.lastBeyer > 0) {
    bestRecentFigure = horse.lastBeyer;
    rawBestFigure = horse.lastBeyer;
    variantAdjustmentInfo = null;
    bestPP = null;
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
  // Start with variant-adjusted figure, then apply tier normalization
  let effectiveFigure = bestRecentFigure;
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

  // Calculate speed score using effective (normalized + variant-adjusted) figure
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

  return {
    total: adjustedSpeedScore + classResult.score,
    speedScore: adjustedSpeedScore,
    classScore: classResult.score,
    seasonalAdjustment,
    bestRecentFigure,
    averageFigure,
    parForClass,
    classMovement,
    speedReasoning: adjustedSpeedReasoning,
    classReasoning: classResult.reasoning,
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
