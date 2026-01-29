/**
 * Master Scoring Engine
 *
 * Combines all scoring categories to produce comprehensive horse scores.
 * All calculations are deterministic - same inputs always produce same scores.
 * Optimized for performance: scoring 12 horses completes in under 100ms.
 *
 * BASE SCORE (0-330 points max) - Rebalanced Connections:
 * ============================================================
 * This model shifts weighting toward Intrinsic Ability (Speed/Class) over
 * Situational Factors (Pace/Connections). Speed figures are the strongest
 * predictor; situational bonuses add granularity but shouldn't dominate.
 *
 * Core Categories (282 pts):
 * - Speed & Class: 0-140 points (42.6% - Speed 105 + Class 35)
 * - Pace: 0-45 points (13.7% - CONSOLIDATED: base + scenario now unified)
 * - Form: 0-50 points (15.2% - Recent performance patterns, v3.6 Form Decay)
 * - Post Position: 0-12 points (3.6% - unchanged)
 * - Connections (Trainer + Jockey + Partnership): 0-24 points (7.3%)
 * - Equipment: 0-8 points (2.4% - unchanged)
 *
 * Bonus Categories (48 pts):
 * - Distance/Surface Affinity: 0-20 points (6.1% - Turf/Wet/Distance)
 * - Track Specialist: 0-10 points (3.0% - Proven success at today's track)
 * - Trainer Patterns: 0-8 points (2.4% - Situational trainer patterns)
 * - Combo Patterns: 0-4 points (1.2% - unchanged)
 * - Trainer Surface/Distance: 0-6 points (1.8% - Trainer specialization)
 * - Weight Change: 0-1 point (0.3% - subtle refinement for weight drops)
 *
 * P3 Refinements (2 pts):
 * - Age Factor: ±1 point (0.3% - Peak performance at 4-5yo, declining at 8+)
 * - Sire's Sire: ±1 point (0.3% - Paternal grandsire influence on breeding)
 *
 * CONSOLIDATED PACE MODULE:
 * The pace scoring now includes integrated scenario adjustments (±8 pts)
 * within the 45-point total. This eliminates double-counting of pace effects
 * and restores scoring resolution lost from odds removal.
 * - Previous: Base pace 35 pts + Scenario overlay ±8 pts = 27-43 range
 * - Now: Unified pace 0-45 pts with scenario built-in
 *
 * OVERLAY SYSTEM (±40 points on top of base - PHASE 5):
 * - Section A: Pace Dynamics & Bias: ±10 points
 * - Section B: Form Cycle & Conditioning: ±15 points
 * - Section C: Trip Analysis & Trouble: ±10 points
 * - Section D: Class Movement & Competition: ±12 points
 * - Section E: Connection Micro-Edges: ±8 points
 * - Section F: Distance & Surface Optimization: ±6 points
 * - Section G: Head-to-Head & Tactical Matchups: ±6 points
 *
 * Final Score = Base Score + Overlay Adjustment
 * Practical Range: 50 to 369 points
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import type { TrackCondition } from '../../hooks/useRaceState';

// Import scoring modules
import {
  calculateConnectionsScore as calcConnections,
  buildConnectionsDatabase,
  calculateTrainerSurfaceDistanceBonus as calcTrainerSurfaceDistance,
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
  calculateDistanceSurfaceScore as calcDistanceSurface,
  calculateTrackSpecialistScore as calcTrackSpecialist,
} from './distanceSurface';
import {
  calculateTrainerPatternScore as calcTrainerPatterns,
  type MatchedPattern,
} from './trainerPatterns';
import {
  detectComboPatterns as calcComboPatterns,
  type ComboPatternResult,
  type DetectedCombo,
} from './comboPatterns';
import { calculateWeightScore as calcWeight } from './weight';
// NOTE: oddsScore module preserved but removed from base scoring pipeline
// Odds data available for post-scoring overlay calculations
import { calculateOddsScore as calcOddsScore, type OddsScoreResult } from './oddsScore';
import { calculateSexRestrictionScore as calcSexRestriction } from './sexRestriction';
import { calculateP3Refinements } from './p3Refinements';
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
import {
  enforceScoreBoundaries,
  enforceBaseScoreBoundaries,
  enforceOverlayBoundaries,
  calculatePaperTigerPenalty,
} from './scoringUtils';
import { calculateDataCompleteness, type DataCompletenessResult } from './dataCompleteness';
import {
  calculateKeyRaceIndexForRace,
  type KeyRaceIndexResult,
  type KeyRaceMatch,
  MAX_KEY_RACE_BONUS,
} from './keyRaceIndex';
import { analyzeTripTrouble, TRIP_TROUBLE_CONFIG } from './tripTrouble';
import type { TripTroubleConfidence } from '../../types/scoring';
import {
  analyzePaceScenario as analyzeFieldPaceScenario,
  getHorseRunningStyle,
  logPaceScenarioAnalysis,
  type PaceScenarioResult,
  type PaceScenario,
  type PaceRunningStyle,
  type PaceScenarioConfidence,
} from './paceScenario';
import {
  analyzeFieldSpread,
  getFieldSpreadAdjustment,
  getHorseTier,
  logFieldSpreadAnalysis,
  type FieldSpreadResult,
  type FieldType,
} from './fieldSpread';
import { calculateWorkoutScore } from './workouts';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum base score (before overlay)
 * v4.1: Increased from 336 to 344 due to workout scoring addition
 *
 * Category breakdown:
 * - Speed & Class: 140 pts (Speed 105 + Class 35)
 * - Form: 50 pts (v3.6: Form Decay System)
 * - Pace: 45 pts (CONSOLIDATED: base 35 + scenario ±8, now unified)
 * - Connections: 24 pts (Jockey 12 + Trainer 10 + Partnership 2)
 * - Post Position: 12 pts
 * - Equipment: 8 pts
 * - Workouts: 8 pts (v4.1: NEW - recency 3 + quality 3 + pattern 2)
 * - Distance/Surface: 20 pts
 * - Track Specialist: 10 pts
 * - Trainer Patterns: 8 pts
 * - Combo Patterns: 10 pts (v4.0: expanded from 4, range -6 to +10)
 * - Trainer Surface/Distance: 6 pts
 * - Weight: 1 pt
 * - P3 (Age + Sire's Sire): 2 pts
 * Total: 344 pts
 *
 * v4.1 CHANGES:
 * - Added workout scoring: 8 pts max (recency 3 + quality 3 + pattern 2)
 * - Workout penalties: -4 to 0 pts (layoff no work, FTS no bullet, slow work)
 * - FTS multiplier: 2x (workouts are only data)
 * - Layoff multiplier: 1.5x (workouts show current fitness)
 *
 * v4.0 CHANGES:
 * - Combo patterns expanded from 4 to 10 pts max (+6)
 * - Added negative combo patterns (-6 to 0 pts)
 * - Net combo range: -6 to +10 (16 point spread)
 * - Trainer pattern sample size increased to 15 for full credit
 */
export const MAX_BASE_SCORE = 344;

/**
 * Maximum overlay adjustment
 * PHASE 5: Reduced from 50 to 40 to prevent pace overlay from destroying favorites
 */
export const MAX_OVERLAY = 40;

/** Maximum total score (base + overlay) */
export const MAX_SCORE = MAX_BASE_SCORE + MAX_OVERLAY; // 384 (v4.1: up from 376)

/**
 * Score limits by category
 *
 * WEIGHT RATIONALE (Consolidated Pace Module):
 * -----------------------------------------------------------------------
 * This model prioritizes Intrinsic Ability (Speed/Class) over Situational
 * Factors (Pace/Connections). Speed figures are the strongest predictor
 * at 30-40% weight, with class providing additional context.
 *
 * Core Categories (290 pts):
 * - Speed/Class: 140 pts (40.7%) — Speed 105 pts (~30.5%) + Class 35 pts (~10.2%)
 * - Form: 50 pts (14.5%) — Recent performance patterns (v3.6 Form Decay)
 * - Pace: 45 pts (13.1%) — CONSOLIDATED: base + scenario adjustments unified
 * - Connections: 24 pts (7.0%) — Jockey 12 + Trainer 10 + Partnership 2
 * - Post Position: 12 pts (3.5%) — Track-dependent situational factor
 * - Equipment: 8 pts (2.3%) — Speculative, fine-tuning only
 * - Workouts: 8 pts (2.3%) — v4.1: NEW (recency 3 + quality 3 + pattern 2)
 *
 * Bonus Categories (54 pts):
 * - Distance/Surface: 20 pts (5.8%) — Turf (8) + Wet (6) + Distance (6)
 * - Track Specialist: 10 pts (2.9%) — Proven success at today's track
 * - Trainer Patterns: 8 pts (2.3%) — Situational patterns (with sample size discount)
 * - Combo Patterns: 10 pts (2.9%) — v4.0: Expanded from 4 pts (range -6 to +10)
 * - Trainer Surface/Distance: 6 pts (1.7%) — Trainer specialization bonus
 *
 * Weight & P3 Refinements (3 pts):
 * - Weight: 1 pt (subtle refinement for weight drops)
 * - Age Factor: ±1 pt (peak performance at 4-5yo, declining at 8+)
 * - Sire's Sire: ±1 pt (integrated into breeding for known influential sires)
 *
 * Total: 344 points base score (v4.1: up from 336)
 *
 * NOTE: Pace scenario adjustments (±8 pts) are now integrated into the
 * 45-point pace score, not applied as a separate overlay layer.
 */
export const SCORE_LIMITS = {
  connections: 24, // Rebalanced: jockey 12 + trainer 10 + partnership 2 (was 23)
  postPosition: 12,
  speedClass: 140, // Model B: increased from 122 (speed 105 + class 35)
  form: 50, // v3.6: Form Decay System restored to 50
  equipment: 8,
  pace: 45, // CONSOLIDATED: base 35 + scenario ±8 now unified into 0-45
  workouts: 8, // v4.1: NEW - recency 3 + quality 3 + pattern 2 (range -4 to +8)
  // NOTE: odds removed from base scoring (circular logic elimination)
  distanceSurface: 20, // Turf (8) + Wet (6) + Distance (6) = 20
  trainerPatterns: 8, // Model B: reduced from 10, with sample size discount tiers
  comboPatterns: 10, // v4.0: expanded from 4, range -6 to +10
  trackSpecialist: 10, // Model B: increased from 6
  trainerSurfaceDistance: 6, // Trainer surface/distance specialization
  weight: 1, // Weight change scoring (subtle refinement)
  // P3 refinements (subtle, ±1 pt each)
  ageFactor: 1, // Age-based peak performance (+1 for 4-5yo, -1 for 8+)
  siresSire: 1, // Sire's sire breeding influence (±1 integrated into breeding)
  baseTotal: MAX_BASE_SCORE, // 344 (v4.1: up from 336)
  overlayMax: MAX_OVERLAY, // 40
  total: MAX_SCORE, // 384 (v4.1: up from 376)
} as const;

/**
 * Score thresholds for color coding and tier classification
 * Based on BASE SCORE ONLY (344 max), not total score with overlay
 *
 * v4.1: Updated for 344 base score (up from 336)
 *
 * | Base Score | Percentage | Rating     |
 * |------------|------------|------------|
 * | 275+       | 80%+       | Elite      |
 * | 224-274    | 65-79%     | Strong     |
 * | 172-223    | 50-64%     | Contender  |
 * | 120-171    | 35-49%     | Fair       |
 * | Below 120  | <35%       | Weak       |
 */
export const SCORE_THRESHOLDS = {
  elite: 275, // 80%+ of 344 base score (was 269)
  strong: 224, // 65-79% of 344 base score (was 218)
  contender: 172, // 50-64% of 344 base score (was 168)
  fair: 120, // 35-49% of 344 base score (was 118)
  weak: 0, // Below 35%
} as const;

/** Score colors matching thresholds (based on base score) */
export const SCORE_COLORS = {
  elite: '#22c55e', // Green - Elite (264+, 80%+)
  strong: '#4ade80', // Light Green - Strong (215-263, 65-79%)
  contender: '#eab308', // Yellow - Contender (165-214, 50-64%)
  fair: '#f97316', // Orange - Fair (116-164, 35-49%)
  weak: '#ef4444', // Red - Weak (<116, <35%)
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
    /** v3.2: Won last race */
    wonLastOut: boolean;
    /** v3.2: Won 2 of last 3 races */
    won2OfLast3: boolean;
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
  /** v4.1: Workout analysis score (critical for FTS and layoff returnees) */
  workouts: {
    /** Total workout score (-4 to +8 pts, after multipliers) */
    total: number;
    /** Raw score before multipliers */
    rawScore: number;
    /** Recency bonus component (0-3 pts) */
    recencyBonus: number;
    /** Quality bonus component (0-3 pts) */
    qualityBonus: number;
    /** Pattern bonus component (0-2 pts) */
    patternBonus: number;
    /** Penalty component (0 to -4 pts) */
    penalty: number;
    /** Multiplier applied (1.0, 1.5, or 2.0) */
    multiplier: number;
    /** Number of works in last 30 days */
    worksInLast30Days: number;
    /** Days since most recent workout */
    daysSinceMostRecentWork: number | null;
    /** Whether horse has a bullet work */
    hasBulletWork: boolean;
    /** Is first-time starter */
    isFirstTimeStarter: boolean;
    /** Is layoff returnee (60+ days) */
    isLayoffReturnee: boolean;
    /** Human-readable reasoning */
    reasoning: string;
  };
  // NOTE: odds removed from base scoring breakdown (circular logic elimination)
  // Odds data still available via HorseScore.oddsResult for overlay calculations
  /** Distance and surface affinity score (turf/wet/distance) */
  distanceSurface: {
    total: number;
    turfScore: number;
    wetScore: number;
    distanceScore: number;
    turfWinRate: number;
    wetWinRate: number;
    distanceWinRate: number;
    reasoning: string[];
  };
  /** Trainer pattern bonuses (situational stats from DRF Fields 1146-1221) */
  trainerPatterns: {
    total: number;
    matchedPatterns: MatchedPattern[];
    reasoning: string[];
  };
  /** Combo pattern bonuses (multiple positive signals aligned) */
  comboPatterns: {
    total: number;
    detectedCombos: DetectedCombo[];
    intentScore: number;
    reasoning: string[];
  };
  /** Track specialist bonus (proven success at today's track) */
  trackSpecialist: {
    total: number;
    trackWinRate: number;
    trackITMRate: number;
    isSpecialist: boolean;
    reasoning: string;
  };
  /** Trainer surface/distance specialization bonus (turf sprint, turf route, dirt sprint, dirt route, wet) */
  trainerSurfaceDistance: {
    total: number;
    matchedCategory: string | null;
    trainerWinPercent: number;
    wetTrackWinPercent: number;
    wetBonusApplied: boolean;
    reasoning: string;
  };
  /** Weight change analysis (P2 subtle refinement, max +1 pt for significant drop) */
  weightAnalysis: {
    total: number;
    currentWeight: number;
    lastRaceWeight: number | null;
    weightChange: number | null;
    significantDrop: boolean;
    significantGain: boolean;
    showWeightGainFlag: boolean;
    reasoning: string;
  };
  /** Sex-based race restriction analysis (subtle adjustment, max -1 pt) */
  sexAnalysis: {
    total: number;
    horseSex: string;
    isFemale: boolean;
    isRestrictedRace: boolean;
    isMixedRace: boolean;
    isFirstTimeFacingMales: boolean;
    flags: string[];
    reasoning: string;
  };
  /** P3: Earnings-based class indicator (informational only, no new points) */
  earningsAnalysis?: {
    lifetimeEarnings: number;
    avgEarningsPerStart: number;
    currentYearEarnings: number;
    earningsClass: 'elite' | 'strong' | 'average' | 'low';
    reasoning: string;
  };
  /** P3: Sire's sire breeding influence (±1 pt integrated into breeding) */
  siresSireAnalysis?: {
    known: boolean;
    siresSireName: string;
    surfaceAffinity: number;
    distanceAffinity: number;
    adjustment: number;
    reasoning: string;
  };
  /** P3: Age-based peak performance analysis (±1 pt) */
  ageAnalysis?: {
    age: number;
    peakStatus: 'developing' | 'peak' | 'mature' | 'declining';
    adjustment: number;
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
  /** Paper Tiger circuit breaker penalty (Model B Part 5) */
  paperTiger?: {
    penaltyApplied: boolean;
    penaltyAmount: number;
    speedScore: number;
    formScore: number;
    paceScore: number;
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
  /** Key Race Index bonus (0-6 pts, cross-referencing horses within today's card) */
  keyRaceIndex?: {
    total: number;
    rawBonus: number;
    capApplied: boolean;
    matches: KeyRaceMatch[];
    reasoning: string;
    hasMatches: boolean;
  };
  /** Trip Trouble adjustment (0-8 pts, masked ability detection) */
  tripTrouble?: {
    adjustment: number;
    confidence: TripTroubleConfidence;
    troubledRaceCount: number;
    causedTroubleCount: number;
    reason: string;
  };
  /** Pace Scenario analysis (field-relative tactical adjustments) */
  paceScenario?: {
    scenario: PaceScenario;
    runningStyle: PaceRunningStyle;
    adjustment: number;
    confidence: PaceScenarioConfidence;
    reason: string;
  };
  /** Field Spread analysis (score separation and betting confidence) */
  fieldSpread?: {
    fieldType: FieldType;
    tier: 'A' | 'B' | 'C' | 'X';
    adjustment: number;
    reason: string;
  };
}

/** Complete score result for a horse */
export interface HorseScore {
  /** Final total score (base + overlay) */
  total: number;
  /** Base score (0-329) before overlay */
  baseScore: number;
  /** Overlay adjustment (±40) */
  overlayScore: number;
  // NOTE: oddsScore removed from base scoring (circular logic elimination)
  // Odds data still available via oddsResult for overlay calculations
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
  /** Full odds analysis result */
  oddsResult?: OddsScoreResult;
  /** Data completeness analysis (infrastructure for scoring accuracy) */
  dataCompleteness: DataCompletenessResult;
  /** Phase 2: Whether low confidence penalty was applied (15% reduction) */
  lowConfidencePenaltyApplied: boolean;
  /** Phase 2: Amount deducted due to low confidence (in points) */
  lowConfidencePenaltyAmount: number;
  /** Model B Part 5: Whether Paper Tiger penalty was applied (-25 pts) */
  paperTigerPenaltyApplied: boolean;
  /** Model B Part 5: Amount deducted due to Paper Tiger circuit breaker */
  paperTigerPenaltyAmount: number;
  /** Key Race Index bonus applied (0-6 pts) */
  keyRaceIndexBonus: number;
  /** Key Race Index full result */
  keyRaceIndexResult?: KeyRaceIndexResult;
  /** Field Spread adjustment applied */
  fieldSpreadAdjustment: number;
  /** Field Spread full result (stored at race level, referenced here) */
  fieldSpreadResult?: FieldSpreadResult;
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
  /** Pace scenario analysis for field-relative tactical adjustments */
  paceScenarioResult: PaceScenarioResult;
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
 * Get the color for a BASE score based on thresholds
 * IMPORTANT: This should be called with baseScore (0-344), NOT total score
 *
 * @param baseScore - The horse's base score (0-344 range)
 * @param isScratched - Whether the horse is scratched
 */
export function getScoreColor(baseScore: number, isScratched: boolean): string {
  if (isScratched) return SCORE_COLORS.weak;
  if (baseScore >= SCORE_THRESHOLDS.elite) return SCORE_COLORS.elite;
  if (baseScore >= SCORE_THRESHOLDS.strong) return SCORE_COLORS.strong;
  if (baseScore >= SCORE_THRESHOLDS.contender) return SCORE_COLORS.contender;
  if (baseScore >= SCORE_THRESHOLDS.fair) return SCORE_COLORS.fair;
  return SCORE_COLORS.weak;
}

/**
 * Get score tier name based on BASE score
 * IMPORTANT: This should be called with baseScore (0-344), NOT total score
 *
 * v4.1 thresholds (for 344 base score):
 *
 * | Base Score | Percentage | Rating     |
 * |------------|------------|------------|
 * | 275+       | 80%+       | Elite      |
 * | 224-274    | 65-79%     | Strong     |
 * | 172-223    | 50-64%     | Contender  |
 * | 120-171    | 35-49%     | Fair       |
 * | Below 120  | <35%       | Weak       |
 *
 * @param baseScore - The horse's base score (0-344 range)
 */
export function getScoreTier(baseScore: number): string {
  if (baseScore >= SCORE_THRESHOLDS.elite) return 'Elite';
  if (baseScore >= SCORE_THRESHOLDS.strong) return 'Strong';
  if (baseScore >= SCORE_THRESHOLDS.contender) return 'Contender';
  if (baseScore >= SCORE_THRESHOLDS.fair) return 'Fair';
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

  // Phase 2.6: Pace Scenario Analysis (field-relative tactical adjustments)
  // Analyzes running style composition to identify lone speed, speed duels, etc.
  const paceScenarioResult = analyzeFieldPaceScenario(activeHorses);

  // Log pace scenario analysis for debugging
  logPaceScenarioAnalysis(paceScenarioResult);

  return {
    horses,
    raceHeader,
    connectionsDb,
    fieldPaceAnalysis,
    activeHorses,
    paceScenarioResult,
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
  trackCondition: TrackCondition,
  isScratched: boolean
): HorseScore {
  // Scratched horses get zero score
  if (isScratched) {
    return {
      total: 0,
      baseScore: 0,
      overlayScore: 0,
      // NOTE: oddsScore removed from base scoring (circular logic elimination)
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
          wonLastOut: false,
          won2OfLast3: false,
        },
        equipment: { total: 0, hasChanges: false, reasoning: 'Scratched' },
        pace: { total: 0, runningStyle: 'Unknown', paceFit: 'neutral', reasoning: 'Scratched' },
        workouts: {
          total: 0,
          rawScore: 0,
          recencyBonus: 0,
          qualityBonus: 0,
          patternBonus: 0,
          penalty: 0,
          multiplier: 1.0,
          worksInLast30Days: 0,
          daysSinceMostRecentWork: null,
          hasBulletWork: false,
          isFirstTimeStarter: false,
          isLayoffReturnee: false,
          reasoning: 'Scratched',
        },
        // NOTE: odds removed from breakdown (circular logic elimination)
        distanceSurface: {
          total: 0,
          turfScore: 0,
          wetScore: 0,
          distanceScore: 0,
          turfWinRate: 0,
          wetWinRate: 0,
          distanceWinRate: 0,
          reasoning: ['Scratched'],
        },
        trainerPatterns: {
          total: 0,
          matchedPatterns: [],
          reasoning: ['Scratched'],
        },
        comboPatterns: {
          total: 0,
          detectedCombos: [],
          intentScore: 0,
          reasoning: ['Scratched'],
        },
        trackSpecialist: {
          total: 0,
          trackWinRate: 0,
          trackITMRate: 0,
          isSpecialist: false,
          reasoning: 'Scratched',
        },
        trainerSurfaceDistance: {
          total: 0,
          matchedCategory: null,
          trainerWinPercent: 0,
          wetTrackWinPercent: 0,
          wetBonusApplied: false,
          reasoning: 'Scratched',
        },
        weightAnalysis: {
          total: 0,
          currentWeight: 0,
          lastRaceWeight: null,
          weightChange: null,
          significantDrop: false,
          significantGain: false,
          showWeightGainFlag: false,
          reasoning: 'Scratched',
        },
        sexAnalysis: {
          total: 0,
          horseSex: '',
          isFemale: false,
          isRestrictedRace: false,
          isMixedRace: false,
          isFirstTimeFacingMales: false,
          flags: [],
          reasoning: 'Scratched',
        },
        // P3 refinements (scratched defaults)
        earningsAnalysis: {
          lifetimeEarnings: 0,
          avgEarningsPerStart: 0,
          currentYearEarnings: 0,
          earningsClass: 'low' as const,
          reasoning: 'Scratched',
        },
        siresSireAnalysis: {
          known: false,
          siresSireName: '',
          surfaceAffinity: 0,
          distanceAffinity: 0,
          adjustment: 0,
          reasoning: 'Scratched',
        },
        ageAnalysis: {
          age: 0,
          peakStatus: 'developing' as const,
          adjustment: 0,
          reasoning: 'Scratched',
        },
      },
      isScratched: true,
      confidenceLevel: 'low',
      dataQuality: 0,
      dataCompleteness: {
        overallScore: 0,
        overallGrade: 'F',
        criticalComplete: 0,
        highComplete: 0,
        mediumComplete: 0,
        lowComplete: 0,
        hasSpeedFigures: false,
        hasPastPerformances: false,
        hasTrainerStats: false,
        hasJockeyStats: false,
        hasRunningStyle: false,
        hasPaceFigures: false,
        missingCritical: [],
        missingHigh: [],
        isLowConfidence: true,
        confidenceReason: 'Scratched',
      },
      lowConfidencePenaltyApplied: false,
      lowConfidencePenaltyAmount: 0,
      paperTigerPenaltyApplied: false,
      paperTigerPenaltyAmount: 0,
      keyRaceIndexBonus: 0,
      keyRaceIndexResult: undefined,
      fieldSpreadAdjustment: 0,
      fieldSpreadResult: undefined,
    };
  }

  // Calculate each category using the new modules
  const connections = calcConnections(horse, context.connectionsDb);
  const postPosition = calcPostPosition(horse, context.raceHeader);
  const speedClass = calcSpeedClass(horse, context.raceHeader);
  const form = calcForm(horse);

  // Calculate trip trouble adjustment (0-8 pts, adds to form score)
  // Scans last 3 races for trouble indicators that mask true ability
  const tripTroubleResult = analyzeTripTrouble(horse);
  const tripTroubleAdjustment = tripTroubleResult.adjustment;

  // Log trip trouble for debugging if adjustment applied
  if (tripTroubleAdjustment > 0) {
    console.log(
      `[TRIP_TROUBLE] ${horse.horseName}: +${tripTroubleAdjustment} pts (${tripTroubleResult.reason})`
    );
  }

  const equipment = calcEquipment(horse);
  const pace = calcPace(horse, context.raceHeader, context.activeHorses, context.fieldPaceAnalysis);

  // v4.1: Calculate workout score (critical for FTS and layoff returnees)
  // Workouts are the primary new data between past races and today
  const workoutResult = calculateWorkoutScore(horse);

  // Log workout score for debugging if significant
  if (workoutResult.total !== 0) {
    const sign = workoutResult.total > 0 ? '+' : '';
    let reason = '';
    if (workoutResult.isFirstTimeStarter) {
      reason = ' (FTS 2x)';
    } else if (workoutResult.isLayoffReturnee) {
      reason = ' (Layoff 1.5x)';
    }
    console.log(
      `[WORKOUT] ${horse.horseName}: ${sign}${workoutResult.total} pts${reason} | ${workoutResult.reasoning}`
    );
  }

  // CONSOLIDATED: Pace scenario adjustment is now integrated into pace.ts (0-45 pts)
  // These legacy variables are kept for informational/display purposes only
  const horseRunningStyle = getHorseRunningStyle(context.paceScenarioResult, horse.programNumber);

  // Log consolidated pace scenario for debugging if applicable
  if (pace.integratedScenarioAdjustment && pace.integratedScenarioAdjustment !== 0) {
    const sign = pace.integratedScenarioAdjustment > 0 ? '+' : '';
    console.log(
      `[PACE_CONSOLIDATED] ${horse.horseName}: ${sign}${pace.integratedScenarioAdjustment} pts scenario adjustment (${pace.integratedScenario} - integrated into ${pace.total} pt pace score)`
    );
  }

  // NOTE: oddsScore removed from base scoring pipeline (circular logic elimination)
  // Still calculate for informational purposes and potential overlay use
  const oddsResult = calcOddsScore(
    horse,
    _currentOdds !== horse.morningLineOdds ? _currentOdds : undefined
  );

  // Calculate distance/surface affinity score (0-20 points)
  const distanceSurface = calcDistanceSurface(horse, context.raceHeader, trackCondition);

  // Calculate trainer pattern bonuses (0-15 points)
  const trainerPatterns = calcTrainerPatterns(horse, context.raceHeader);

  // Calculate combo pattern bonuses (0-12 points)
  const comboPatterns = calcComboPatterns(horse, context.raceHeader, context.horses);

  // Calculate track specialist score (0-6 points)
  const trackSpecialist = calcTrackSpecialist(horse, context.raceHeader.trackCode);

  // Calculate trainer surface/distance specialization bonus (0-6 points)
  const trainerSurfaceDistance = calcTrainerSurfaceDistance(
    horse,
    context.raceHeader,
    trackCondition
  );

  // Calculate weight change score (0-1 points, P2 subtle refinement)
  const weightScore = calcWeight(horse, context.raceHeader);

  // Calculate sex restriction adjustment (0 to -1 points, subtle refinement)
  // Fillies/mares facing males in open races get -1 pt penalty
  const sexRestriction = calcSexRestriction(horse, context.raceHeader, context.activeHorses);

  // Calculate P3 refinements (earnings indicator, sire's sire, age factor)
  const p3Refinements = calculateP3Refinements(horse, context.raceHeader);

  // Calculate breeding score for lightly raced horses
  let breedingScore: DetailedBreedingScore | undefined;
  let breedingBreakdown: ScoreBreakdown['breeding'] | undefined;
  let breedingContribution = 0;

  if (shouldShowBreedingAnalysis(horse)) {
    breedingScore = calculateDetailedBreedingScore(horse, context.raceHeader);
    if (breedingScore.wasApplied) {
      const starts = horse.lifetimeStarts ?? 0;
      breedingContribution = calculateBreedingContribution(breedingScore, starts);
      // P3: Add sire's sire adjustment to breeding contribution (±1 pt max)
      if (p3Refinements.siresSire.known && p3Refinements.siresSire.adjustment !== 0) {
        breedingContribution += p3Refinements.siresSire.adjustment;
      }
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
      // Add trip trouble adjustment to form total (masked ability affects form perception)
      total: Math.min(
        form.total + tripTroubleAdjustment,
        SCORE_LIMITS.form + TRIP_TROUBLE_CONFIG.MAX_ADJUSTMENT
      ),
      recentFormScore: form.recentFormScore,
      layoffScore: form.layoffScore,
      consistencyBonus: form.consistencyBonus,
      formTrend: form.formTrend,
      reasoning:
        tripTroubleAdjustment > 0
          ? `${form.reasoning} | Trip trouble: +${tripTroubleAdjustment} pts`
          : form.reasoning,
      wonLastOut: form.wonLastOut,
      won2OfLast3: form.won2OfLast3,
    },
    equipment: {
      total: equipment.total,
      hasChanges: equipment.hasSignificantChange,
      reasoning: equipment.reasoning,
    },
    pace: {
      // CONSOLIDATED: Scenario adjustments now integrated into pace.ts (0-45 pts)
      // No longer add paceScenarioAdjustment here - it's already in pace.total
      total: Math.max(0, Math.min(pace.total, SCORE_LIMITS.pace)),
      runningStyle: pace.profile.styleName,
      paceFit: pace.paceFit,
      reasoning: pace.reasoning,
    },
    // v4.1: Workout analysis (critical for FTS and layoff returnees)
    workouts: {
      total: workoutResult.total,
      rawScore: workoutResult.rawScore,
      recencyBonus: workoutResult.recencyBonus,
      qualityBonus: workoutResult.qualityBonus,
      patternBonus: workoutResult.patternBonus,
      penalty: workoutResult.penalty,
      multiplier: workoutResult.multiplier,
      worksInLast30Days: workoutResult.worksInLast30Days,
      daysSinceMostRecentWork: workoutResult.daysSinceMostRecentWork,
      hasBulletWork: workoutResult.hasBulletWork,
      isFirstTimeStarter: workoutResult.isFirstTimeStarter,
      isLayoffReturnee: workoutResult.isLayoffReturnee,
      reasoning: workoutResult.reasoning,
    },
    // NOTE: odds removed from breakdown (circular logic elimination)
    distanceSurface: {
      total: distanceSurface.total,
      turfScore: distanceSurface.turfScore,
      wetScore: distanceSurface.wetScore,
      distanceScore: distanceSurface.distanceScore,
      turfWinRate: distanceSurface.turfWinRate,
      wetWinRate: distanceSurface.wetWinRate,
      distanceWinRate: distanceSurface.distanceWinRate,
      reasoning: distanceSurface.reasoning,
    },
    trainerPatterns: {
      total: trainerPatterns.total,
      matchedPatterns: trainerPatterns.matchedPatterns,
      reasoning: trainerPatterns.reasoning,
    },
    comboPatterns: {
      total: comboPatterns.total,
      detectedCombos: comboPatterns.detectedCombos,
      intentScore: comboPatterns.intentScore,
      reasoning: comboPatterns.reasoning,
    },
    trackSpecialist: {
      total: trackSpecialist.score,
      trackWinRate: trackSpecialist.trackWinRate,
      trackITMRate: trackSpecialist.trackITMRate,
      isSpecialist: trackSpecialist.isSpecialist,
      reasoning: trackSpecialist.reasoning,
    },
    trainerSurfaceDistance: {
      total: trainerSurfaceDistance.bonus,
      matchedCategory: trainerSurfaceDistance.matchedCategory,
      trainerWinPercent: trainerSurfaceDistance.trainerWinPercent,
      wetTrackWinPercent: trainerSurfaceDistance.wetTrackWinPercent,
      wetBonusApplied: trainerSurfaceDistance.wetBonusApplied,
      reasoning: trainerSurfaceDistance.reasoning,
    },
    weightAnalysis: {
      total: weightScore.total,
      currentWeight: weightScore.analysis.currentWeight,
      lastRaceWeight: weightScore.analysis.lastRaceWeight,
      weightChange: weightScore.analysis.weightChange,
      significantDrop: weightScore.analysis.significantDrop,
      significantGain: weightScore.analysis.significantGain,
      showWeightGainFlag: weightScore.showWeightGainFlag,
      reasoning: weightScore.reasoning,
    },
    sexAnalysis: {
      total: sexRestriction.total,
      horseSex: sexRestriction.analysis.horseSex,
      isFemale: sexRestriction.analysis.isFemale,
      isRestrictedRace: sexRestriction.analysis.isRestrictedRace,
      isMixedRace: sexRestriction.analysis.isMixedRace,
      isFirstTimeFacingMales: sexRestriction.analysis.isFirstTimeFacingMales,
      flags: sexRestriction.analysis.flags,
      reasoning: sexRestriction.reasoning,
    },
    // P3 refinements
    earningsAnalysis: {
      lifetimeEarnings: p3Refinements.earnings.lifetimeEarnings,
      avgEarningsPerStart: p3Refinements.earnings.avgEarningsPerStart,
      currentYearEarnings: p3Refinements.earnings.currentYearEarnings,
      earningsClass: p3Refinements.earnings.earningsClass,
      reasoning: p3Refinements.earnings.reasoning,
    },
    siresSireAnalysis: {
      known: p3Refinements.siresSire.known,
      siresSireName: p3Refinements.siresSire.siresSireName,
      surfaceAffinity: p3Refinements.siresSire.surfaceAffinity,
      distanceAffinity: p3Refinements.siresSire.distanceAffinity,
      adjustment: p3Refinements.siresSire.adjustment,
      reasoning: p3Refinements.siresSire.reasoning,
    },
    ageAnalysis: {
      age: p3Refinements.ageFactor.age,
      peakStatus: p3Refinements.ageFactor.peakStatus,
      adjustment: p3Refinements.ageFactor.adjustment,
      reasoning: p3Refinements.ageFactor.reasoning,
    },
    breeding: breedingBreakdown,
    classAnalysis: classAnalysisBreakdown,
    // Trip Trouble: masked ability detection (0-8 pts adjustment to form)
    tripTrouble: {
      adjustment: tripTroubleAdjustment,
      confidence: tripTroubleResult.confidence,
      troubledRaceCount: tripTroubleResult.totalTroubledCount,
      causedTroubleCount: tripTroubleResult.causedTroubleCount,
      reason: tripTroubleResult.reason,
    },
    // Pace Scenario: INFORMATIONAL ONLY (adjustment now integrated into pace.ts)
    // The scenario type and confidence are still available for display
    paceScenario: {
      scenario: context.paceScenarioResult.scenario,
      runningStyle: horseRunningStyle,
      adjustment: 0, // CONSOLIDATED: adjustment now part of pace.total (0-45)
      confidence: context.paceScenarioResult.confidence,
      reason: `Scenario adjustment integrated into pace score (${(pace.integratedScenarioAdjustment ?? 0 > 0) ? '+' : ''}${pace.integratedScenarioAdjustment ?? 0} pts)`,
    },
  };

  // Calculate base score (capped at MAX_BASE_SCORE)
  // Add breeding contribution for lightly raced horses
  // Note: Class score is already included in speedClass.classScore, but enhanced analysis
  // provides additional hidden drop bonuses that we add separately
  const hiddenDropsBonus = classScoreResult.hiddenDropsScore;

  // =========================================================================
  // v3.4 FIX: "Bias Inflation" - Algorithm Tuning Package v1
  // =========================================================================
  // PROBLEM: We were unconditionally adding up to 47 points for Connections/
  // Post/Trainer Patterns, allowing slow horses with famous jockeys to
  // outscore fast horses.
  //
  // SOLUTION: Cap "Bias Score" at 25% of "Ability Score"
  // - Ability Score = Speed + Class + Form + Pace (intrinsic ability)
  // - Bias Score = Connections + Post Position + Trainer Patterns
  // - Final Bias Score = Math.min(Raw Bias Score, Ability Score * 0.25)
  //
  // NOTE: Odds removed from bias score (circular logic elimination)
  // =========================================================================

  // ABILITY SCORE: The horse's intrinsic performance potential
  // speedClass.total includes both speed (105 max) and class (35 max)
  const abilityScore =
    breakdown.speedClass.total + // Speed (105) + Class (35) = 140 max
    breakdown.form.total + // Recent form (50 max)
    breakdown.pace.total; // Pace fit (35 max)
  // Total ability: 225 pts max

  // BIAS SCORE (RAW): External factors that can inflate scores
  // NOTE: odds removed from bias calculation (circular logic elimination)
  const rawBiasScore =
    breakdown.connections.total + // Trainer + Jockey (24 max)
    breakdown.postPosition.total + // Post position (12 max)
    breakdown.trainerPatterns.total; // Trainer situational patterns (8 max)
  // Total raw bias: 43 pts max

  // BIAS CAP: Bias cannot exceed 25% of Ability Score
  // This prevents famous jockeys from rescuing slow horses
  const maxBiasAllowed = Math.round(abilityScore * 0.25);
  const cappedBiasScore = Math.min(rawBiasScore, maxBiasAllowed);
  const biasReduction = rawBiasScore - cappedBiasScore;

  // Log bias reduction for debugging (can be removed after validation)
  if (biasReduction > 0) {
    // Bias was capped - this horse had inflated situational factors
    // console.log(`Bias cap applied: ${rawBiasScore} → ${cappedBiasScore} (-${biasReduction}) for ability ${abilityScore}`);
  }

  // Calculate final base score with capped bias
  const rawBaseTotal =
    abilityScore + // Speed + Class + Form + Pace (intrinsic ability)
    cappedBiasScore + // Connections + Post + Trainer Patterns (CAPPED, odds removed)
    breakdown.equipment.total + // Equipment changes (8 max)
    breakdown.workouts.total + // v4.1: Workout analysis (-4 to +8, critical for FTS/layoffs)
    breakdown.distanceSurface.total + // Distance/surface affinity bonus (0-20)
    breakdown.comboPatterns.total + // Combo pattern bonuses (0-12)
    breakdown.trackSpecialist.total + // Track specialist bonus (0-6)
    breakdown.trainerSurfaceDistance.total + // Trainer surface/distance specialization (0-6)
    breakdown.weightAnalysis.total + // Weight change bonus (0-1, P2 subtle refinement)
    breakdown.sexAnalysis.total + // Sex restriction adjustment (0 to -1, filly/mare vs males)
    p3Refinements.ageFactor.adjustment + // P3: Age factor adjustment (±1, 4-5yo peak, 8+ declining)
    breedingContribution + // Includes P3 sire's sire adjustment if applicable
    hiddenDropsBonus; // Add hidden class drop bonuses

  // MODEL B PART 5: Paper Tiger Circuit Breaker (v3.3 - Tiered Penalties)
  // Penalize horses with high Speed but poor Form and mediocre Pace
  // v3.3: Broadened criteria with tiered penalties (-20/-40/-100)
  // v3.3: Recent winners are protected from penalty
  const hasRecentWin = breakdown.form.wonLastOut || breakdown.form.won2OfLast3;
  const paperTigerPenalty = calculatePaperTigerPenalty(
    breakdown.speedClass.speedScore,
    breakdown.form.total,
    breakdown.pace.total,
    hasRecentWin
  );

  // Apply Paper Tiger penalty to raw base total
  const adjustedBaseTotal = rawBaseTotal + paperTigerPenalty;

  // Add Paper Tiger analysis to breakdown
  const paperTigerApplied = paperTigerPenalty !== 0;
  breakdown.paperTiger = {
    penaltyApplied: paperTigerApplied,
    penaltyAmount: paperTigerPenalty,
    speedScore: breakdown.speedClass.speedScore,
    formScore: breakdown.form.total,
    paceScore: breakdown.pace.total,
    reasoning: paperTigerApplied
      ? `Paper Tiger Penalty: Speed ${breakdown.speedClass.speedScore} / Form ${breakdown.form.total} / Pace ${breakdown.pace.total} (${paperTigerPenalty})`
      : hasRecentWin
        ? 'Protected by recent win (no Paper Tiger penalty)'
        : breakdown.pace.total >= 30
          ? 'Tessuto Rule: Elite pace protects (no penalty)'
          : 'No Paper Tiger penalty applied',
  };

  // Calculate data completeness BEFORE applying low confidence penalty
  // This way we can check isLowConfidence to decide on penalty
  const dataCompleteness = calculateDataCompleteness(horse, context.raceHeader);

  // Enforce base score boundaries (0 to MAX_BASE_SCORE)
  let baseScore = enforceBaseScoreBoundaries(adjustedBaseTotal);

  // PHASE 2: Apply 15% penalty to base score for low confidence horses
  // Low confidence = criticalComplete < 75% (missing key data like speed figures, PPs)
  let lowConfidencePenaltyApplied = false;
  let lowConfidencePenaltyAmount = 0;

  if (dataCompleteness.isLowConfidence) {
    const penaltyMultiplier = 0.85; // 15% penalty
    const originalBaseScore = baseScore;
    baseScore = Math.round(baseScore * penaltyMultiplier);
    lowConfidencePenaltyApplied = true;
    lowConfidencePenaltyAmount = originalBaseScore - baseScore;
  }

  // Calculate overlay adjustment (±40 points on top of base score - PHASE 5)
  // Pass user-selected track condition to affect wet track scoring
  const overlayResult = calculateOverlayScore(
    horse,
    context.raceHeader,
    context.horses,
    trackCondition
  );
  // Enforce overlay boundaries (-40 to +40)
  const overlayScore = enforceOverlayBoundaries(overlayResult.cappedScore);

  // Final score = Base + Overlay (with boundary enforcement)
  // Ensures score is floored at MIN_SCORE (0) and capped at MAX_FINAL_SCORE (371)
  const total = enforceScoreBoundaries(baseScore + overlayScore);

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
    // NOTE: oddsScore removed from base scoring (circular logic elimination)
    breakdown,
    isScratched: false,
    confidenceLevel,
    dataQuality,
    breedingScore,
    classScore: classScoreResult,
    overlayResult,
    oddsResult, // Still available for informational/overlay purposes
    dataCompleteness,
    lowConfidencePenaltyApplied,
    lowConfidencePenaltyAmount,
    paperTigerPenaltyApplied: paperTigerApplied,
    paperTigerPenaltyAmount: paperTigerPenalty,
    // Key Race Index - will be populated in second pass by calculateRaceScores
    keyRaceIndexBonus: 0,
    keyRaceIndexResult: undefined,
    // Field Spread - will be populated in third pass by calculateRaceScores
    fieldSpreadAdjustment: 0,
    fieldSpreadResult: undefined,
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
 *
 * INCLUDES TWO-PASS KEY RACE INDEX CALCULATION:
 * Pass 1: Calculate base scores without Key Race Index
 * Pass 2: Calculate Key Race Index using rankings from Pass 1
 *
 * Key Race Index identifies "hidden form" by cross-referencing horses
 * that have met before. A horse that finished 2nd behind a top-ranked
 * horse in today's race gets a bonus.
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

  // =========================================================================
  // PASS 1: Calculate base scores for all horses (WITHOUT Key Race Index)
  // =========================================================================
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

  // Sort by BASE SCORE to determine initial ranks (best base score = rank 1)
  // Uses baseScore (who we think wins) not totalScore (which includes overlay adjustments)
  //
  // TIE-BREAKER CHAIN (Model B Final):
  // 1. Base Score (Descending) - Primary ranking
  // 2. Speed Score (Descending) - Intrinsic ability wins ties
  // 3. Pace Score (Descending) - Running style advantage
  // 4. Form Score (Descending) - Current condition
  // 5. Post Position (Ascending) - Final deterministic resolution
  //
  // This ensures every horse has a UNIQUE rank (no more "3rd (tie)")
  const sortedByScore = [...scoredHorses]
    .filter((h) => !h.score.isScratched)
    .sort((a, b) => {
      // Primary: Base Score (descending)
      const scoreDiff = b.score.baseScore - a.score.baseScore;
      if (scoreDiff !== 0) return scoreDiff;

      // Tie-Breaker #1: Speed Score (descending) - Intrinsic Ability wins
      const speedDiff =
        b.score.breakdown.speedClass.speedScore - a.score.breakdown.speedClass.speedScore;
      if (speedDiff !== 0) return speedDiff;

      // Tie-Breaker #2: Pace Score (descending) - Running Style wins
      const paceDiff = b.score.breakdown.pace.total - a.score.breakdown.pace.total;
      if (paceDiff !== 0) return paceDiff;

      // Tie-Breaker #3: Form Score (descending) - Current Condition wins
      const formDiff = b.score.breakdown.form.total - a.score.breakdown.form.total;
      if (formDiff !== 0) return formDiff;

      // Final Resolution: Post Position (ascending) - Inside post wins
      return a.horse.postPosition - b.horse.postPosition;
    });

  // Assign ranks based on sorted order (unique ranks, no ties)
  sortedByScore.forEach((horse, index) => {
    horse.rank = index + 1;
  });

  // Scratched horses get rank 0 (not ranked)
  scoredHorses.forEach((horse) => {
    if (horse.score.isScratched) {
      horse.rank = 0;
    }
  });

  // =========================================================================
  // PASS 2: Calculate Key Race Index using rankings from Pass 1
  // =========================================================================
  // Build base scores map for Key Race Index calculation
  const baseScoresMap = new Map<number, number>();
  scoredHorses.forEach((sh) => {
    if (!sh.score.isScratched) {
      baseScoresMap.set(sh.horse.programNumber, sh.score.baseScore);
    }
  });

  // Get active (non-scratched) horses for Key Race Index calculation
  const activeHorses = horses.filter((_, i) => !isScratched(i));

  // Calculate Key Race Index for all horses in this race
  const keyRaceResults = calculateKeyRaceIndexForRace(activeHorses, baseScoresMap);

  // Apply Key Race Index bonus to each horse's score
  scoredHorses.forEach((sh) => {
    if (sh.score.isScratched) return;

    const keyRaceResult = keyRaceResults.get(sh.horse.programNumber);
    if (keyRaceResult && keyRaceResult.totalBonus > 0) {
      // Store the Key Race Index result
      sh.score.keyRaceIndexBonus = keyRaceResult.totalBonus;
      sh.score.keyRaceIndexResult = keyRaceResult;

      // Add to breakdown
      sh.score.breakdown.keyRaceIndex = {
        total: keyRaceResult.totalBonus,
        rawBonus: keyRaceResult.rawBonus,
        capApplied: keyRaceResult.capApplied,
        matches: keyRaceResult.matches,
        reasoning: keyRaceResult.reasoning,
        hasMatches: keyRaceResult.hasMatches,
      };

      // Apply Key Race Index bonus to scores
      // Add to baseScore (capped at MAX_BASE_SCORE + MAX_KEY_RACE_BONUS)
      sh.score.baseScore = Math.min(
        sh.score.baseScore + keyRaceResult.totalBonus,
        MAX_BASE_SCORE + MAX_KEY_RACE_BONUS
      );

      // Update total score (base + overlay)
      sh.score.total = enforceScoreBoundaries(sh.score.baseScore + sh.score.overlayScore);
    } else if (keyRaceResult) {
      // Store result even if no bonus (for transparency)
      sh.score.keyRaceIndexResult = keyRaceResult;
      sh.score.breakdown.keyRaceIndex = {
        total: 0,
        rawBonus: 0,
        capApplied: false,
        matches: [],
        reasoning: keyRaceResult.reasoning,
        hasMatches: false,
      };
    }
  });

  // Note: We don't re-rank after Key Race Index because:
  // 1. The bonus is small (max +6 pts) and unlikely to change relative ranks
  // 2. Rankings should be stable for UI consistency
  // 3. Key Race Index is informational enhancement, not a ranking factor

  // =========================================================================
  // PASS 3: Field Spread Analysis (requires all horses scored first)
  // =========================================================================
  // Analyzes score separation to determine field competitiveness and betting confidence
  // This is a race-level analysis that affects individual horse adjustments

  // Build ranked list from current scores for field spread analysis
  const rankedForSpread = scoredHorses
    .filter((sh) => !sh.score.isScratched)
    .map((sh) => ({
      programNumber: sh.horse.programNumber,
      horseName: sh.horse.horseName,
      totalScore: sh.score.baseScore, // Use baseScore for field analysis
      rank: sh.rank,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);

  const fieldSpreadResult = analyzeFieldSpread(rankedForSpread);

  // Log field spread analysis for debugging
  logFieldSpreadAnalysis(fieldSpreadResult);

  // Apply field spread adjustments to each horse
  scoredHorses.forEach((sh) => {
    if (sh.score.isScratched) return;

    // Get adjustment for this horse (can be positive or negative)
    const fieldAdjustment = getFieldSpreadAdjustment(fieldSpreadResult, sh.horse.programNumber);

    // Get tier assignment for this horse
    const tier = getHorseTier(fieldSpreadResult, sh.horse.programNumber);

    // Store field spread results
    sh.score.fieldSpreadAdjustment = fieldAdjustment;
    sh.score.fieldSpreadResult = fieldSpreadResult;

    // Add field spread to breakdown (informational only, no score modifications)
    // v3.8: Score adjustments removed - field spread now used for bet construction only
    sh.score.breakdown.fieldSpread = {
      fieldType: fieldSpreadResult.fieldType,
      tier: tier ?? 'X',
      adjustment: 0, // Always 0 - adjustments removed to eliminate circular logic
      reason: `Tier ${tier ?? 'X'}: ${fieldSpreadResult.reason}`,
    };

    // v3.8 REMOVED: Score adjustments no longer applied
    // Field spread is now INFORMATIONAL ONLY for bet construction:
    // - Field type detection (DOMINANT, CHALKY, SEPARATED, COMPETITIVE, WIDE_OPEN)
    // - Tier assignments (A/B/C/X based on distance from leader)
    // - Confidence mapping (VERY_HIGH to VERY_LOW)
    // - Sit-out condition detection
    // - Recommended box sizes for exacta/trifecta/superfecta
    //
    // Adjustments were removed because boosting a dominant leader because they're
    // dominant just confirms what was already calculated (circular logic).
  });

  // Note: Field Spread does not affect rankings (v3.8)
  // Score adjustments were removed to eliminate circular logic.
  // Field spread is now INFORMATIONAL ONLY for bet construction:
  // - Field type, tier assignments, confidence levels
  // - Box size recommendations
  // - Sit-out condition detection

  // Sort by post position for display (scratched horses stay in place)
  scoredHorses.sort((a, b) => {
    return a.horse.postPosition - b.horse.postPosition;
  });

  return scoredHorses;
}

/**
 * Get top N horses by score (excluding scratched)
 *
 * Returns horses sorted by their algorithm-calculated rank (based on baseScore).
 * Rank 1 = highest baseScore = predicted 1st place finish.
 *
 * NOTE: This function sorts by rank before slicing because scoredHorses
 * from calculateRaceScores() is sorted by post position for display purposes.
 * We need to re-sort by rank to get actual projected finish order.
 */
export function getTopHorses(scoredHorses: ScoredHorse[], count: number = 3): ScoredHorse[] {
  return scoredHorses
    .filter((h) => !h.score.isScratched)
    .sort((a, b) => a.rank - b.rank) // Sort by rank (1 = best, lower is better)
    .slice(0, count);
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
  // Combo pattern types
  ComboPatternResult,
  DetectedCombo,
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
export {
  calculateDistanceSurfaceScore,
  hasDistanceSurfaceAdvantage,
  getDistanceSurfaceSummary,
  DISTANCE_SURFACE_LIMITS,
  type DistanceSurfaceResult,
  // Track specialist exports
  calculateTrackSpecialistScore,
  isTrackSpecialist,
  getTrackRecordSummary,
  type TrackSpecialistResult,
} from './distanceSurface';
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
export {
  getParFigures,
  getClassHierarchy,
  // Sale price scoring for FTS/lightly raced horses
  calculateSalePriceBonus,
  hasReliableSpeedFigures,
  MAX_SALE_PRICE_BONUS,
  MAX_STARTS_FOR_SALE_PRICE,
  type SalePriceBonusResult,
} from './speedClass';

// Track speed normalization exports
export {
  // Core functions
  getSpeedTier,
  getTrackTierAdjustment,
  getTrackSpeedInfo,
  getTrackSpeedPar,
  normalizeSpeedFigure,
  analyzeShipper,
  // Utility functions
  isTier1Track,
  isTier4Track,
  getTracksInTier,
  getTierDisplayInfo,
  // Constants
  TIER_NAMES,
  TIER_ADJUSTMENTS,
  // Types
  type SpeedTier,
  type TrackSpeedInfo,
  type SpeedNormalizationResult,
  type ShipperAnalysis,
} from './trackSpeedNormalization';

// Combo pattern detection exports
export {
  detectComboPatterns,
  hasComboPatterns,
  getComboPatternSummary,
  getIntentLevel,
  // Signal detection helpers
  isClassDrop,
  isFirstTimeLasix,
  isFirstTimeBlinkers,
  hasFirstTimeEquipment,
  isJockeyUpgrade,
  isSecondOffLayoff,
  isReturningFromLayoff,
  hasBulletWork,
  isTrainerHot,
  isFirstTimeTurf,
  hasTurfBreeding,
  isDistanceChange,
  hasTrainerDistancePattern,
  MAX_COMBO_PATTERN_POINTS,
} from './comboPatterns';

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
  analyzeOverlayWithField,
  calculateFieldRelativeWinProbability,
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

// Scoring utilities and defensive helpers
export {
  // Defensive math helpers
  safeDivide,
  safeNumber,
  clamp,
  safeRound,
  // Score validation
  isValidScore,
  isValidCategoryScore,
  // Score boundary enforcement
  enforceScoreBoundaries,
  enforceBaseScoreBoundaries,
  enforceOverlayBoundaries,
  enforceProtocolBoundaries,
  enforceCategoryBoundaries,
  // Circuit breaker penalties
  calculatePaperTigerPenalty,
  // Display helpers
  formatDisplayScore,
  formatOverlay,
  // Calculation helpers
  calculateWinRate,
  calculateSafeAverage,
  // Safe accessors
  safeGet,
  safeFirst,
  safeLength,
  // Constants
  MIN_SCORE,
  MAX_FINAL_SCORE,
  MAX_DISPLAY_SCORE,
  MAX_PROTOCOL_BONUS,
  SCORE_CATEGORY_LIMITS,
} from './scoringUtils';

// Field-relative scoring exports
export {
  // Types
  type FieldStrength,
  type FieldContext,
  type FieldRelativeResult,
  type FieldAnalysis,
  // Main functions
  calculateFieldContext,
  calculateFieldRelativeScore,
  analyzeEntireField,
  // Utility functions
  getFieldStrengthDescription,
  getFieldStrengthColor,
  formatZScore,
  interpretZScore,
} from './fieldRelative';

// Rank utilities (projected finish order based on base score)
export {
  // Types
  type RankInfo,
  // Main functions
  calculateBaseScoreRanks,
  toOrdinal,
  calculateRankGradientColor,
  getRankColor,
} from './rankUtils';

// Trainer surface/distance specialization exports
export {
  calculateTrainerSurfaceDistanceBonus,
  MAX_TRAINER_SURFACE_DISTANCE_POINTS,
  type TrainerSurfaceDistanceBonusResult,
} from './connections';

// Enhanced partnership scoring exports
export {
  analyzeTrainerJockeyPartnership,
  MAX_ENHANCED_PARTNERSHIP_POINTS,
  type TrainerJockeyPartnershipAnalysis,
} from './connections';

// Weight analysis exports
export {
  analyzeWeightChange,
  calculateWeightScore,
  getWeightChangeSummary,
  hasWeightAdvantage,
  hasWeightDisadvantage,
  MAX_WEIGHT_POINTS,
  type WeightAnalysisResult,
  type WeightScoreResult,
} from './weight';

// Sex restriction analysis exports
export {
  analyzeSexRestriction,
  calculateSexRestrictionScore,
  isHorseFemale,
  isHorseMale,
  getSexRestrictionSummary,
  hasSexFlags,
  hasAdjustment as hasSexAdjustment,
  MAX_SEX_ADJUSTMENT,
  type SexRestrictionAnalysis,
  type SexRestrictionScoreResult,
} from './sexRestriction';

// P3 refinements exports (earnings indicator, sire's sire, age factor)
export {
  // Earnings class indicator (informational only)
  getEarningsClassIndicator,
  getEarningsClassColor,
  // Sire's sire analysis (±1 pt to breeding)
  analyzeSiresSire,
  // Age factor analysis (±1 pt)
  analyzeAgeFactor,
  getPeakStatusColor,
  getPeakStatusLabel,
  // Combined P3 analysis
  calculateP3Refinements,
  P3_MAX_ADJUSTMENT,
  // Types
  type EarningsClass,
  type EarningsClassIndicator,
  type SiresSireAnalysis,
  type AgeFactorAnalysis,
  type PeakStatus,
  type P3RefinementsResult,
} from './p3Refinements';

// Data completeness exports (infrastructure for scoring accuracy)
export {
  // Main function
  calculateDataCompleteness,
  // Field presence checks
  hasValidSpeedFigures,
  hasValidPastPerformances,
  hasValidFinishPositions,
  hasValidClassLevel,
  hasValidTrainerStats,
  hasValidJockeyStats,
  hasValidRunningStyle,
  hasValidDaysSinceLastRace,
  hasValidWorkouts,
  hasValidPaceFigures,
  hasValidTrackRecord,
  hasValidDistanceRecord,
  hasValidSurfaceRecord,
  hasValidWetTrackRecord,
  hasValidTrainerCategoryStats,
  hasValidEquipment,
  hasValidBreeding,
  hasValidWeightChanges,
  hasValidClaimingPriceHistory,
  hasValidLifetimeEarnings,
  // Utility functions
  getDataCompletenessSummary,
  getDataCompletenessColor,
  shouldFlagLowConfidence,
  getTierLabel,
  LOW_CONFIDENCE_THRESHOLD,
  // Types re-exported from types/scoring
  type DataCompletenessResult,
} from './dataCompleteness';

// Re-export data completeness types from types/scoring
export type {
  DataCompletenessGrade,
  DataFieldTier,
  FieldPresenceResult,
  SpeedFiguresPresence,
  PastPerformancesPresence,
  TrainerStatsPresence,
  JockeyStatsPresence,
  PaceFiguresPresence,
  RunningStylePresence,
  TrackRecordPresence,
  DistanceRecordPresence,
  SurfaceRecordPresence,
} from '../../types/scoring';

export { DATA_TIER_WEIGHTS, DATA_COMPLETENESS_GRADES } from '../../types/scoring';

// Odds scoring exports (Phase 6: market wisdom for favorites)
export {
  // Main functions
  calculateOddsScore,
  calculateOddsPoints,
  getOddsForScoring,
  parseOddsToDecimal,
  // Utility functions
  formatOdds,
  getOddsTier,
  getOddsScoreColor,
  isFavorite,
  isLongshot,
  calculateOddsPointDifference,
  // Constants
  MAX_ODDS_SCORE,
  NEUTRAL_ODDS_SCORE,
  ODDS_TIERS,
  // Types
  type OddsScoreResult,
} from './oddsScore';

// Key Race Index exports (cross-referencing horses within today's card)
export {
  // Main functions
  calculateKeyRaceIndex,
  calculateKeyRaceIndexForRace,
  // Utility functions
  normalizeHorseName,
  buildTodayHorseMap,
  buildRankingsFromScores,
  hasKeyRacePotential,
  getKeyRaceSummary,
  // Constants
  MAX_KEY_RACE_BONUS,
  MAX_PP_TO_ANALYZE,
  MIN_RANK_FOR_BONUS,
  POINTS_BEHIND_TOP_2,
  POINTS_BEHIND_TOP_4,
  POINTS_4TH_5TH_BEHIND_TOP_2,
  // Types
  type KeyRaceIndexResult,
  type KeyRaceMatch,
  type HorseRanking,
} from './keyRaceIndex';

// Overlay Configuration exports (unified config for overlay pipeline)
export {
  // Main config
  OVERLAY_CONFIG,
  // Derived constants
  MAX_OVERLAY_ADJUSTMENT_POSITIVE,
  MAX_OVERLAY_ADJUSTMENT_NEGATIVE,
  TOTAL_OVERLAY_CAP,
  // Labels and colors
  VALUE_CLASS_LABELS,
  VALUE_CLASS_COLORS,
  VALUE_CLASS_ICONS,
  EV_CLASS_LABELS,
  EV_CLASS_COLORS,
  // Utility functions
  getOverlayConfig,
  createOverlayConfig,
  validateOverlayConfig,
  // Types
  type OverlayConfigType,
  type PipelineValueClass,
  type EVClassification,
} from './overlayConfig';

// Overlay Pipeline exports (unified overlay calculation pipeline)
export {
  // Main pipeline function
  calculateOverlayPipeline,
  // Integration with scoring engine
  enhanceScoringWithOverlay,
  // EV calculation
  calculateExpectedValue,
  classifyEV,
  // Value classification (renamed to avoid conflict with overlayAnalysis.classifyValue)
  classifyTrueOverlay,
  // Overlay adjustment
  calculateOverlayAdjustment,
  // Overlay calculations
  calculateTrueOverlay,
  calculateRawOverlay,
  // Calibration logging
  createCalibrationRecords,
  logForCalibration,
  // Utility functions
  getValueClassDetails,
  getEVClassDetails,
  formatOverlayPercent as formatTrueOverlayPercent,
  formatExpectedValue,
  isValueBet,
  isUnderlay,
  // Types
  type OverlayPipelineInput,
  type OverlayHorseInput,
  type OverlayHorseOutput,
  type OverlayPipelineOutput,
  type EnhancedScoringResult,
  type CalibrationPrediction,
} from './overlayPipeline';

// Probability Conversion exports (softmax-based probability calculation)
export {
  // Core softmax functions
  softmaxProbabilities,
  scoreToProbability as softmaxScoreToProbability,
  probabilityToFairOdds,
  fairOddsToImpliedProbability,
  // Field context probability
  calculateWinProbabilitySoftmax,
  // Validation
  validateProbabilities,
  // Calibration integration
  setCalibrationManagerGetter,
  isCalibrationActive,
  // Config utilities
  getSoftmaxConfig,
  createSoftmaxConfig,
  // Constants
  SOFTMAX_CONFIG,
  // Types
  type SoftmaxConfigType,
} from './probabilityConversion';

// Market Normalization exports (odds and market probability utilities)
export {
  // Odds conversion
  fractionalToDecimalOdds,
  americanToDecimalOdds,
  decimalToFractional,
  decimalToAmerican,
  // Implied probability
  oddsToImpliedProbability,
  calculateOverround,
  calculateTakeoutPercent,
  // Normalization
  normalizeMarketProbabilities,
  oddsArrayToNormalizedProbabilities,
  normalizeFieldOdds,
  // Validation
  validateMarketOdds,
  // Morning line / tote parsing
  parseMorningLineOdds,
  parseToteOdds,
  // Config utilities
  getMarketConfig,
  createMarketConfig,
  // Constants
  MARKET_CONFIG,
  // Types
  type MarketConfigType,
  type NormalizedFieldResult,
  type OddsWithSource,
  type OddsSource,
} from './marketNormalization';

// Trip Trouble Detection exports (algorithmic trip trouble scoring)
export {
  // Main functions
  analyzeTripTrouble,
  analyzeRaceTripTrouble,
  calculateTripAdjustment,
  // Helper functions
  findKeywords,
  extractComments,
  hasSignificantTrouble,
  getTripTroubleSummary,
  getTripTroubleColor,
  logTripTroubleAnalysis,
  // Constants
  TRIP_TROUBLE_CONFIG,
  HIGH_TROUBLE_KEYWORDS,
  MEDIUM_TROUBLE_KEYWORDS,
  LOW_TROUBLE_KEYWORDS,
  CAUSED_TROUBLE_KEYWORDS,
} from './tripTrouble';

// Re-export trip trouble types from types/scoring
export type { TripTroubleResult, TripTroubleConfidence, TroubledRace } from '../../types/scoring';

// Field Spread Analysis exports (algorithmic field spread scoring)
export {
  // Main functions
  analyzeFieldSpread,
  // Utility functions
  getHorseTier,
  getFieldSpreadAdjustment,
  hasSignificantFieldSpread,
  getFieldTypeDisplayInfo,
  getConfidenceDisplayInfo,
  getFieldSpreadColor,
  getFieldSpreadSummary,
  logFieldSpreadAnalysis,
  // Constants
  FIELD_SPREAD_CONFIG,
  FIELD_TYPE_DEFINITIONS,
  BETTING_CONFIDENCE_DEFINITIONS,
  // Types
  type FieldSpreadResult,
  type FieldType,
  type BettingConfidence,
  type ScoreGaps,
  type TierAssignments,
  type FieldSpreadAdjustment,
  type BoxSizeRecommendation,
  type RankedHorseInput,
} from './fieldSpread';
