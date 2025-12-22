/**
 * Master Scoring Engine
 *
 * Combines all scoring categories to produce comprehensive horse scores.
 * All calculations are deterministic - same inputs always produce same scores.
 * Optimized for performance: scoring 12 horses completes in under 100ms.
 *
 * BASE SCORE (0-240 points max):
 * - Connections (Trainer + Jockey + Partnership): 0-55 points
 * - Post Position: 0-45 points
 * - Speed & Class: 0-50 points
 * - Form: 0-30 points
 * - Equipment: 0-25 points
 * - Pace: 0-40 points
 *
 * OVERLAY SYSTEM (±50 points on top of base):
 * - Section A: Pace Dynamics & Bias: ±20 points
 * - Section B: Form Cycle & Conditioning: ±15 points
 * - Section C: Trip Analysis & Trouble: ±12 points
 * - Section D: Class Movement & Competition: ±15 points
 * - Section E: Connection Micro-Edges: ±10 points
 * - Section F: Distance & Surface Optimization: ±8 points
 * - Section G: Head-to-Head & Tactical Matchups: ±8 points
 *
 * Final Score = Base Score + Overlay Adjustment
 * Practical Range: 50 to 290 points
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import type { TrackCondition } from '../../hooks/useRaceState';

// Import scoring modules
import {
  calculateConnectionsScore as calcConnections,
  buildConnectionsDatabase,
  type ConnectionsScoreResult,
  type ConnectionsDatabase,
} from './connections';
import {
  calculatePostPositionScore as calcPostPosition,
  type PostPositionScoreResult,
} from './postPosition';
import {
  calculateSpeedClassScore as calcSpeedClass,
  type SpeedClassScoreResult,
} from './speedClass';
import { calculateFormScore as calcForm, type FormScoreResult } from './form';
import { calculateEquipmentScore as calcEquipment, type EquipmentScoreResult } from './equipment';
import {
  calculatePaceScore as calcPace,
  analyzeFieldPace,
  type PaceScoreResult,
  type FieldPaceAnalysis,
  type RunningStyleCode,
  type RunningStyleProfile,
  type PaceScenarioType,
  type PaceScenarioAnalysis,
  type TacticalAdvantage,
  type PaceAnalysisResult,
} from './pace';
import {
  calculateDetailedBreedingScore,
  calculateBreedingContribution,
  shouldShowBreedingAnalysis,
  type DetailedBreedingScore,
} from '../breeding';
import {
  calculateClassScore,
  formatClassMovement,
  isValuePlay,
  type ClassScoreResult,
  type HiddenClassDrop,
} from '../class';
import { calculateOverlayScore, type OverlayResult } from './overlayScoring';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum base score (before overlay) */
export const MAX_BASE_SCORE = 240;

/** Maximum overlay adjustment */
export const MAX_OVERLAY = 50;

/** Maximum total score (base + overlay) */
export const MAX_SCORE = MAX_BASE_SCORE + MAX_OVERLAY; // 290

/** Score limits by category */
export const SCORE_LIMITS = {
  connections: 55,
  postPosition: 45,
  speedClass: 50,
  form: 30,
  equipment: 25,
  pace: 40,
  baseTotal: MAX_BASE_SCORE,
  overlayMax: MAX_OVERLAY,
  total: MAX_SCORE,
} as const;

/** Score thresholds for color coding and tier classification */
export const SCORE_THRESHOLDS = {
  elite: 200, // Bright accent (#36d1da)
  strong: 180, // Accent (#19abb5)
  good: 160, // Medium (#1b7583)
  fair: 140, // Low (#888)
  weak: 0, // Grey (#555)
} as const;

/** Score colors matching thresholds */
export const SCORE_COLORS = {
  elite: '#36d1da',
  strong: '#19abb5',
  good: '#1b7583',
  fair: '#888888',
  weak: '#555555',
} as const;

// ============================================================================
// TYPES
// ============================================================================

/** Detailed breakdown of all scoring categories */
export interface ScoreBreakdown {
  connections: {
    total: number;
    trainer: number;
    jockey: number;
    partnershipBonus: number;
    reasoning: string;
  };
  postPosition: {
    total: number;
    trackBiasApplied: boolean;
    isGoldenPost: boolean;
    reasoning: string;
  };
  speedClass: {
    total: number;
    speedScore: number;
    classScore: number;
    bestFigure: number | null;
    classMovement: string;
    reasoning: string;
  };
  form: {
    total: number;
    recentFormScore: number;
    layoffScore: number;
    consistencyBonus: number;
    formTrend: string;
    reasoning: string;
  };
  equipment: {
    total: number;
    hasChanges: boolean;
    reasoning: string;
  };
  pace: {
    total: number;
    runningStyle: string;
    paceFit: string;
    reasoning: string;
  };
  /** Breeding score for lightly raced horses (0 if 8+ starts) */
  breeding?: {
    total: number;
    contribution: number;
    sireScore: number;
    damScore: number;
    damsireScore: number;
    bonuses: number;
    wasApplied: boolean;
    summary: string;
  };
  /** Enhanced class analysis including hidden drops */
  classAnalysis?: {
    total: number;
    provenAtLevelScore: number;
    classMovementScore: number;
    hiddenDropsScore: number;
    trackTierScore: number;
    movement: string;
    hiddenDrops: HiddenClassDrop[];
    isValuePlay: boolean;
    reasoning: string;
  };
  /** Overlay system adjustments (±50 points) */
  overlay?: {
    cappedScore: number;
    rawScore: number;
    overflow: number;
    confidenceLevel: string;
    paceAndBias: number;
    formCycle: number;
    tripAnalysis: number;
    classMovement: number;
    connectionEdges: number;
    distanceSurface: number;
    headToHead: number;
    reasoning: string;
  };
}

/** Complete score result for a horse */
export interface HorseScore {
  /** Final total score (base + overlay) */
  total: number;
  /** Base score (0-240) before overlay */
  baseScore: number;
  /** Overlay adjustment (±50) */
  overlayScore: number;
  breakdown: ScoreBreakdown;
  isScratched: boolean;
  confidenceLevel: 'high' | 'medium' | 'low';
  dataQuality: number; // 0-100 percentage
  /** Detailed breeding score (for lightly raced horses) */
  breedingScore?: DetailedBreedingScore;
  /** Detailed class analysis */
  classScore?: ClassScoreResult;
  /** Full overlay analysis result */
  overlayResult?: OverlayResult;
}

/** Scored horse with index for sorting */
export interface ScoredHorse {
  horse: HorseEntry;
  index: number;
  score: HorseScore;
  rank: number;
}

/** Race scoring context for efficient batch processing */
interface RaceScoringContext {
  horses: HorseEntry[];
  raceHeader: RaceHeader;
  connectionsDb: ConnectionsDatabase;
  fieldPaceAnalysis: FieldPaceAnalysis;
  activeHorses: HorseEntry[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse odds string to decimal number
 * Handles formats like "3-1", "5/2", "3.5", "EVEN"
 */
export function parseOdds(oddsStr: string): number {
  const cleaned = oddsStr.trim().toUpperCase();

  // Handle "EVEN" odds
  if (cleaned === 'EVEN' || cleaned === 'EVN') {
    return 1.0;
  }

  // Handle "X-1" format (e.g., "5-1")
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const num = parts[0];
    return num ? parseFloat(num) || 10 : 10;
  }

  // Handle "X/Y" format (e.g., "5/2")
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const num = parts[0];
    const denom = parts[1];
    const numerator = num ? parseFloat(num) : 0;
    const denominator = denom ? parseFloat(denom) : 1;
    return numerator / (denominator || 1);
  }

  // Handle plain number
  return parseFloat(cleaned) || 10;
}

/**
 * Get the color for a score based on thresholds
 */
export function getScoreColor(score: number, isScratched: boolean): string {
  if (isScratched) return SCORE_COLORS.weak;
  if (score >= SCORE_THRESHOLDS.elite) return SCORE_COLORS.elite;
  if (score >= SCORE_THRESHOLDS.strong) return SCORE_COLORS.strong;
  if (score >= SCORE_THRESHOLDS.good) return SCORE_COLORS.good;
  if (score >= SCORE_THRESHOLDS.fair) return SCORE_COLORS.fair;
  return SCORE_COLORS.weak;
}

/**
 * Get score tier name
 */
export function getScoreTier(score: number): string {
  if (score >= SCORE_THRESHOLDS.elite) return 'Elite';
  if (score >= SCORE_THRESHOLDS.strong) return 'Strong';
  if (score >= SCORE_THRESHOLDS.good) return 'Good';
  if (score >= SCORE_THRESHOLDS.fair) return 'Fair';
  return 'Weak';
}

/**
 * Calculate data quality score based on available information
 */
function calculateDataQuality(horse: HorseEntry): number {
  let quality = 0;
  const maxPoints = 100;

  // Past performances (40 points max)
  const ppCount = horse.pastPerformances.length;
  quality += Math.min(40, ppCount * 8); // 5+ PPs = full points

  // Speed figures available (20 points)
  if (horse.bestBeyer !== null || horse.averageBeyer !== null) {
    quality += 20;
  } else if (horse.pastPerformances.some((pp) => pp.speedFigures.beyer !== null)) {
    quality += 15;
  }

  // Running style data (15 points)
  if (horse.runningStyle) {
    quality += 15;
  } else if (horse.earlySpeedRating !== null) {
    quality += 10;
  }

  // Trainer/jockey data (15 points)
  if (horse.trainerName && horse.jockeyName) {
    quality += 10;
  }
  if (horse.trainerStats || horse.jockeyStats) {
    quality += 5;
  }

  // Equipment data (10 points)
  if (horse.equipment.raw || horse.equipment.firstTimeEquipment.length > 0) {
    quality += 10;
  }

  return Math.min(maxPoints, quality);
}

/**
 * Determine confidence level based on data quality and score variance
 */
function calculateConfidenceLevel(
  dataQuality: number,
  breakdown: ScoreBreakdown
): 'high' | 'medium' | 'low' {
  // Low data quality = low confidence
  if (dataQuality < 40) return 'low';

  // Check for too many placeholder/neutral scores
  const neutralCount = [
    breakdown.connections.total === 22, // Neutral trainer + jockey
    breakdown.speedClass.speedScore === 15, // No speed data
    breakdown.form.total === 8, // First starter neutral
    breakdown.pace.total === 20, // Neutral fit
  ].filter(Boolean).length;

  if (neutralCount >= 3) return 'low';
  if (neutralCount >= 2 || dataQuality < 60) return 'medium';

  return 'high';
}

// ============================================================================
// MAIN SCORING FUNCTIONS
// ============================================================================

/**
 * Build scoring context for efficient batch processing
 * Call once per race, reuse for all horses
 */
function buildScoringContext(
  horses: HorseEntry[],
  raceHeader: RaceHeader,
  isScratched: (index: number) => boolean
): RaceScoringContext {
  // Get active (non-scratched) horses
  const activeHorses = horses.filter((_, i) => !isScratched(i));

  // Build connections database from all horses
  const connectionsDb = buildConnectionsDatabase(horses);

  // Pre-calculate field pace analysis
  const fieldPaceAnalysis = analyzeFieldPace(activeHorses);

  return {
    horses,
    raceHeader,
    connectionsDb,
    fieldPaceAnalysis,
    activeHorses,
  };
}

/**
 * Calculate the total score for a single horse
 * Uses pre-built context for efficiency
 */
function calculateHorseScoreWithContext(
  horse: HorseEntry,
  context: RaceScoringContext,
  _currentOdds: string,
  _trackCondition: TrackCondition,
  isScratched: boolean
): HorseScore {
  // Scratched horses get zero score
  if (isScratched) {
    return {
      total: 0,
      baseScore: 0,
      overlayScore: 0,
      breakdown: {
        connections: {
          total: 0,
          trainer: 0,
          jockey: 0,
          partnershipBonus: 0,
          reasoning: 'Scratched',
        },
        postPosition: {
          total: 0,
          trackBiasApplied: false,
          isGoldenPost: false,
          reasoning: 'Scratched',
        },
        speedClass: {
          total: 0,
          speedScore: 0,
          classScore: 0,
          bestFigure: null,
          classMovement: 'unknown',
          reasoning: 'Scratched',
        },
        form: {
          total: 0,
          recentFormScore: 0,
          layoffScore: 0,
          consistencyBonus: 0,
          formTrend: 'unknown',
          reasoning: 'Scratched',
        },
        equipment: { total: 0, hasChanges: false, reasoning: 'Scratched' },
        pace: { total: 0, runningStyle: 'Unknown', paceFit: 'neutral', reasoning: 'Scratched' },
      },
      isScratched: true,
      confidenceLevel: 'low',
      dataQuality: 0,
    };
  }

  // Calculate each category using the new modules
  const connections = calcConnections(horse, context.connectionsDb);
  const postPosition = calcPostPosition(horse, context.raceHeader);
  const speedClass = calcSpeedClass(horse, context.raceHeader);
  const form = calcForm(horse);
  const equipment = calcEquipment(horse);
  const pace = calcPace(horse, context.raceHeader, context.activeHorses, context.fieldPaceAnalysis);

  // Calculate breeding score for lightly raced horses
  let breedingScore: DetailedBreedingScore | undefined;
  let breedingBreakdown: ScoreBreakdown['breeding'] | undefined;
  let breedingContribution = 0;

  if (shouldShowBreedingAnalysis(horse)) {
    breedingScore = calculateDetailedBreedingScore(horse, context.raceHeader);
    if (breedingScore.wasApplied) {
      const starts = horse.lifetimeStarts ?? 0;
      breedingContribution = calculateBreedingContribution(breedingScore, starts);
      breedingBreakdown = {
        total: breedingScore.total,
        contribution: breedingContribution,
        sireScore: breedingScore.breakdown.sireScore,
        damScore: breedingScore.breakdown.damScore,
        damsireScore: breedingScore.breakdown.damsireScore,
        bonuses: breedingScore.bonuses.total,
        wasApplied: true,
        summary: breedingScore.summary,
      };
    }
  }

  // Calculate enhanced class analysis
  const classScoreResult = calculateClassScore(horse, context.raceHeader);
  const classAnalysisBreakdown: ScoreBreakdown['classAnalysis'] = {
    total: classScoreResult.total,
    provenAtLevelScore: classScoreResult.provenAtLevelScore,
    classMovementScore: classScoreResult.classMovementScore,
    hiddenDropsScore: classScoreResult.hiddenDropsScore,
    trackTierScore: classScoreResult.trackTierScore,
    movement: formatClassMovement(classScoreResult.analysis),
    hiddenDrops: classScoreResult.analysis.hiddenDrops,
    isValuePlay: isValuePlay(classScoreResult),
    reasoning: classScoreResult.reasoning,
  };

  // Build breakdown
  const breakdown: ScoreBreakdown = {
    connections: {
      total: connections.total,
      trainer: connections.trainer,
      jockey: connections.jockey,
      partnershipBonus: connections.partnershipBonus,
      reasoning: connections.reasoning,
    },
    postPosition: {
      total: postPosition.total,
      trackBiasApplied: postPosition.trackBiasApplied,
      isGoldenPost: postPosition.isGoldenPost,
      reasoning: postPosition.reasoning,
    },
    speedClass: {
      total: speedClass.total,
      speedScore: speedClass.speedScore,
      classScore: speedClass.classScore,
      bestFigure: speedClass.bestRecentFigure,
      classMovement: speedClass.classMovement,
      reasoning: `${speedClass.speedReasoning} | ${speedClass.classReasoning}`,
    },
    form: {
      total: form.total,
      recentFormScore: form.recentFormScore,
      layoffScore: form.layoffScore,
      consistencyBonus: form.consistencyBonus,
      formTrend: form.formTrend,
      reasoning: form.reasoning,
    },
    equipment: {
      total: equipment.total,
      hasChanges: equipment.hasSignificantChange,
      reasoning: equipment.reasoning,
    },
    pace: {
      total: pace.total,
      runningStyle: pace.profile.styleName,
      paceFit: pace.paceFit,
      reasoning: pace.reasoning,
    },
    breeding: breedingBreakdown,
    classAnalysis: classAnalysisBreakdown,
  };

  // Calculate base score (capped at MAX_BASE_SCORE)
  // Add breeding contribution for lightly raced horses
  // Note: Class score is already included in speedClass.classScore, but enhanced analysis
  // provides additional hidden drop bonuses that we add separately
  const hiddenDropsBonus = classScoreResult.hiddenDropsScore;
  const rawBaseTotal =
    breakdown.connections.total +
    breakdown.postPosition.total +
    breakdown.speedClass.total +
    breakdown.form.total +
    breakdown.equipment.total +
    breakdown.pace.total +
    breedingContribution +
    hiddenDropsBonus; // Add hidden class drop bonuses

  const baseScore = Math.min(MAX_BASE_SCORE, rawBaseTotal);

  // Calculate overlay adjustment (±50 points on top of base score)
  const overlayResult = calculateOverlayScore(horse, context.raceHeader, context.horses);
  const overlayScore = overlayResult.cappedScore;

  // Final score = Base + Overlay
  const total = baseScore + overlayScore;

  // Add overlay to breakdown
  breakdown.overlay = {
    cappedScore: overlayResult.cappedScore,
    rawScore: overlayResult.rawScore,
    overflow: overlayResult.overflow,
    confidenceLevel: overlayResult.confidenceLevel,
    paceAndBias: overlayResult.sections.paceAndBias.score,
    formCycle: overlayResult.sections.formCycle.score,
    tripAnalysis: overlayResult.sections.tripAnalysis.score,
    classMovement: overlayResult.sections.classMovement.score,
    connectionEdges: overlayResult.sections.connectionEdges.score,
    distanceSurface: overlayResult.sections.distanceSurface.score,
    headToHead: overlayResult.sections.headToHead.score,
    reasoning: overlayResult.reasoning,
  };

  // Calculate data quality and confidence
  const dataQuality = calculateDataQuality(horse);
  const confidenceLevel = calculateConfidenceLevel(dataQuality, breakdown);

  return {
    total,
    baseScore,
    overlayScore,
    breakdown,
    isScratched: false,
    confidenceLevel,
    dataQuality,
    breedingScore,
    classScore: classScoreResult,
    overlayResult,
  };
}

/**
 * Calculate the total score for a horse (standalone version)
 * Less efficient than batch processing but works for single horse
 */
export function calculateHorseScore(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  currentOdds: string,
  trackCondition: TrackCondition,
  isScratched: boolean
): HorseScore {
  // Build minimal context
  const context = buildScoringContext([horse], raceHeader, () => isScratched);

  return calculateHorseScoreWithContext(horse, context, currentOdds, trackCondition, isScratched);
}

/**
 * Calculate scores for all horses in a race and return sorted by score descending
 * Optimized for performance - builds shared context once
 */
export function calculateRaceScores(
  horses: HorseEntry[],
  raceHeader: RaceHeader,
  getOdds: (index: number, originalOdds: string) => string,
  isScratched: (index: number) => boolean,
  trackCondition: TrackCondition
): ScoredHorse[] {
  // Build shared context for efficiency
  const context = buildScoringContext(horses, raceHeader, isScratched);

  // Calculate scores for all horses
  const scoredHorses: ScoredHorse[] = horses.map((horse, index) => ({
    horse,
    index,
    score: calculateHorseScoreWithContext(
      horse,
      context,
      getOdds(index, horse.morningLineOdds),
      trackCondition,
      isScratched(index)
    ),
    rank: 0, // Will be set after sorting
  }));

  // Sort by score descending (scratched horses go to bottom)
  scoredHorses.sort((a, b) => {
    if (a.score.isScratched && !b.score.isScratched) return 1;
    if (!a.score.isScratched && b.score.isScratched) return -1;
    return b.score.total - a.score.total;
  });

  // Assign ranks
  let currentRank = 1;
  for (let i = 0; i < scoredHorses.length; i++) {
    const scoredHorse = scoredHorses[i];
    if (scoredHorse && !scoredHorse.score.isScratched) {
      scoredHorse.rank = currentRank++;
    }
  }

  return scoredHorses;
}

/**
 * Get top N horses by score (excluding scratched)
 */
export function getTopHorses(scoredHorses: ScoredHorse[], count: number = 3): ScoredHorse[] {
  return scoredHorses.filter((h) => !h.score.isScratched).slice(0, count);
}

/**
 * Calculate overall confidence for the race analysis
 */
export function calculateRaceConfidence(scoredHorses: ScoredHorse[]): number {
  const activeHorses = scoredHorses.filter((h) => !h.score.isScratched);

  if (activeHorses.length === 0) return 0;

  // Average data quality
  const avgDataQuality =
    activeHorses.reduce((sum, h) => sum + h.score.dataQuality, 0) / activeHorses.length;

  // Score separation (higher = more confident)
  const scores = activeHorses.map((h) => h.score.total).sort((a, b) => b - a);
  const topScore = scores[0] ?? 0;
  const secondScore = scores[1];
  const separation = secondScore !== undefined ? ((topScore - secondScore) / topScore) * 30 : 0;

  // Quality bonus
  const qualityBonus = Math.min(20, (topScore / MAX_SCORE) * 25);

  // Base confidence from data quality
  const baseConfidence = 40 + (avgDataQuality / 100) * 30;

  return Math.min(100, Math.round(baseConfidence + separation + qualityBonus));
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Re-export types from sub-modules for convenience
export type {
  ConnectionsScoreResult,
  PostPositionScoreResult,
  SpeedClassScoreResult,
  FormScoreResult,
  EquipmentScoreResult,
  PaceScoreResult,
  FieldPaceAnalysis,
  // New pace analysis types
  RunningStyleCode,
  RunningStyleProfile,
  PaceScenarioType,
  PaceScenarioAnalysis,
  TacticalAdvantage,
  PaceAnalysisResult,
};

// Re-export utility functions from sub-modules
export {
  analyzeFieldPace,
  analyzePaceScenario,
  parseRunningStyle,
  formatStyleBreakdown,
  getEnhancedPaceDisplay,
  calculateTacticalAdvantage,
  RUNNING_STYLE_NAMES,
  PACE_SCENARIO_LABELS,
  PACE_SCENARIO_COLORS,
} from './pace';
export { getFormSummary, isOnHotStreak } from './form';
export {
  getEquipmentSummary,
  hasSignificantEquipmentChange,
  // Enhanced equipment exports
  extractEquipmentInfo,
  getEquipmentChangeSummary,
  getEquipmentImpactSummary,
  hasSignificantEquipmentImpact,
  getEquipmentScoreColor,
  formatEquipmentChange,
  getHorsesWithEquipmentChanges,
  countEquipmentChanges,
  getImpactColor,
  getImpactIcon,
  getCategoryIcon,
  getImpactClassification,
  // Trainer patterns
  getTrainerProfile,
  getTrainerPattern,
  hasCrediblePattern,
  getTopLasixTrainers,
  getTopBlinkersTrainers,
  // Types
  type DetectedEquipmentChange,
  type EquipmentAnalysis,
  type EquipmentHistoryEntry,
  type TrainerEquipmentPattern,
} from './equipment';
export { getOptimalPostPositions } from './postPosition';
export { getParFigures, getClassHierarchy } from './speedClass';

// Breeding analysis exports
export {
  calculateDetailedBreedingScore,
  calculateBreedingContribution,
  shouldShowBreedingAnalysis,
  getBreedingScoreWeight,
  getBreedingScoreDisplay,
  MAX_STARTS_FOR_BREEDING,
  BREEDING_CATEGORY_LIMITS,
  type DetailedBreedingScore,
} from '../breeding';

// Overlay value analysis exports (betting overlay detection)
export {
  analyzeOverlay,
  detectValuePlays,
  getValuePlaysSummary,
  calculateTierAdjustment,
  scoreToWinProbability,
  probabilityToDecimalOdds,
  calculateOverlayPercent,
  classifyValue,
  calculateEV,
  formatOverlayPercent,
  formatEV,
  formatEVPercent,
  getOverlayColor,
  getOverlayBgColor,
  VALUE_THRESHOLDS,
  VALUE_COLORS,
  VALUE_ICONS,
  VALUE_LABELS,
  type OverlayAnalysis,
  type ValueClassification,
  type BettingRecommendation as OverlayBettingRecommendation,
  type ValuePlay,
} from './overlayAnalysis';

// Overlay Scoring System exports (±50 point race-specific adjustments)
export {
  calculateOverlayScore,
  calculateRaceOverlayScores,
  calculatePaceOverlay,
  calculateFormOverlay,
  calculateTripOverlay,
  calculateClassOverlay,
  calculateConnectionOverlay,
  calculateDistanceSurfaceOverlay,
  calculateHeadToHeadOverlay,
  formatOverlayScore,
  getOverlayScoreColor,
  getConfidenceLevelLabel,
  type OverlayResult,
  type OverlaySectionScore,
} from './overlayScoring';

// Class analysis exports
export {
  // Types
  ClassLevel,
  CLASS_LEVEL_METADATA,
  type ClassLevelMetadata,
  type ClassMovementDirection,
  type ClassMovementMagnitude,
  type ClassMovement,
  type ClassAnalysisResult,
  type ProvenAtLevelResult,
  type HiddenClassDrop,
  type HiddenDropType,
  type TrackTier,
  type TrackTierMovement,
  type ClassScoreResult,
  type ClassScoreBreakdownItem,
  // Track tiers
  TIER_A_TRACKS,
  TIER_B_TRACKS,
  TIER_C_TRACKS,
  getTrackTier,
  getTrackInfo,
  isTierATrack,
  isTierCTrack,
  analyzeTrackTierMovement,
  getTierColor,
  getTierDisplayName,
  getTracksByTier,
  isShipperFromElite,
  // Class extraction
  extractClassFromPP,
  extractCurrentRaceClass,
  getRecentClassLevels,
  analyzeClassMovement,
  analyzeClassMovementWithClaiming,
  analyzeProvenAtLevel,
  detectHiddenClassDrops,
  analyzeClass,
  parseClassFromConditions,
  // Class scoring
  MAX_CLASS_SCORE,
  calculateClassScore,
  getClassScoreColor,
  getClassScoreTier,
  formatClassMovement,
  getHiddenDropsSummary,
  hasSignificantHiddenValue,
  isValuePlay,
  // Utility
  getClassLevelName,
  getClassLevelAbbrev,
  getClassParBeyer,
  compareClassLevels,
  getMovementMagnitude,
  getClassMovementColor,
  getClassMovementIcon,
} from '../class';
