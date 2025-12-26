/**
 * Master Scoring Engine
 *
 * Combines all scoring categories to produce comprehensive horse scores.
 * All calculations are deterministic - same inputs always produce same scores.
 * Optimized for performance: scoring 12 horses completes in under 100ms.
 *
 * BASE SCORE (0-328 points max) - v3.1 with Phase 6 Odds Factor:
 * Core Categories (256 pts):
 * - Speed & Class: 0-122 points (39% - Speed 90 + Class 32)
 *   v3.0: Speed increased from 48 to 90 pts (~29% of base, industry standard 30-40%)
 * - Pace: 0-45 points (14.4% - Race shape analysis)
 * - Form: 0-50 points (16.0% - Recent performance patterns)
 * - Post Position: 0-12 points (3.8% - v3.0: reduced from 20)
 * - Connections (Trainer + Jockey + Partnership): 0-27 points (8.6%)
 * - Equipment: 0-8 points (2.6% - v3.0: reduced from 12)
 *
 * Bonus Categories (36 pts):
 * - Distance/Surface Affinity: 0-20 points (6.4% - Turf/Wet/Distance)
 * - Trainer Patterns: 0-10 points (3.2% - v3.0: reduced from 15)
 * - Combo Patterns: 0-4 points (1.3% - v3.0: reduced from 6)
 * - Track Specialist: 0-6 points (1.9% - Proven success at today's track)
 * - Trainer Surface/Distance: 0-6 points (1.9% - Trainer specialization)
 * - Weight Change: 0-1 point (0.3% - P2 subtle refinement for weight drops)
 *
 * P3 Refinements (2 pts):
 * - Age Factor: ±1 point (0.3% - Peak performance at 4-5yo, declining at 8+)
 * - Sire's Sire: ±1 point (0.3% - Paternal grandsire influence on breeding)
 *
 * v3.0 KEY CHANGES (Phase 3 - Speed Weight Rebalance):
 * - Speed: 48 → 90 pts (+42) - Industry standard weights speed at 30-40%
 * - Post: 20 → 12 pts (-8) - Industry standard is 3-8%
 * - Equipment: 12 → 8 pts (-4) - Industry standard is 2-5%
 * - Trainer Patterns: 15 → 10 pts (-5) - Proportional reduction
 * - Combo: 6 → 4 pts (-2) - Proportional reduction
 * Net change: +42 - 8 - 4 - 5 - 2 = +23 pts (290 → 313)
 *
 * OVERLAY SYSTEM (±40 points on top of base - PHASE 5: reduced from ±50):
 * - Section A: Pace Dynamics & Bias: ±10 points (reduced from ±20)
 * - Section B: Form Cycle & Conditioning: ±15 points (unchanged)
 * - Section C: Trip Analysis & Trouble: ±10 points (reduced from ±12)
 * - Section D: Class Movement & Competition: ±12 points (reduced from ±15)
 * - Section E: Connection Micro-Edges: ±8 points (reduced from ±10)
 * - Section F: Distance & Surface Optimization: ±6 points (reduced from ±8)
 * - Section G: Head-to-Head & Tactical Matchups: ±6 points (reduced from ±8)
 *
 * Final Score = Base Score + Overlay Adjustment
 * Practical Range: 50 to 368 points
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
} from './scoringUtils';
import { calculateDataCompleteness, type DataCompletenessResult } from './dataCompleteness';
import {
  isTopBeyerBonusEnabled,
  getTopBeyerBonusPoints,
  getTopBeyerBonusRankThreshold,
} from '../config/featureFlags';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum base score (before overlay)
 * v3.1: Updated from 313 to 328 pts per Phase 6 Odds Factor
 *
 * Previous v3.0 Changes:
 * - Speed: 48 → 90 pts (+42)
 * - Post: 20 → 12 pts (-8)
 * - Equipment: 12 → 8 pts (-4)
 * - Trainer Patterns: 15 → 10 pts (-5)
 * - Combo: 6 → 4 pts (-2)
 * v3.0 net change: +42 - 8 - 4 - 5 - 2 = +23 (290 → 313)
 *
 * Phase 6 Addition:
 * - Odds Factor: +15 pts (market wisdom for favorites)
 * v3.1 net change: +15 (313 → 328)
 */
export const MAX_BASE_SCORE = 328;

/**
 * Maximum overlay adjustment
 * PHASE 5: Reduced from 50 to 40 to prevent pace overlay from destroying favorites
 */
export const MAX_OVERLAY = 40;

/** Maximum total score (base + overlay) */
export const MAX_SCORE = MAX_BASE_SCORE + MAX_OVERLAY; // 368 (was 353, originally 363)

/**
 * Score limits by category
 *
 * WEIGHT RATIONALE (v3.1 - Phase 6 Odds Factor):
 * -----------------------------------------------------------------------
 * These weights are aligned with industry handicapping research showing
 * that speed figures are the most predictive factor (30-40% weight).
 *
 * v3.0 Changes:
 * - Speed: 48 → 90 pts (now ~27%, industry standard 30-40%)
 * - Post: 20 → 12 pts (-8 pts)
 * - Equipment: 12 → 8 pts (-4 pts)
 * - Trainer Patterns: 15 → 10 pts (-5 pts)
 * - Combo: 6 → 4 pts (-2 pts)
 *
 * Phase 6 Addition:
 * - Odds Factor: 15 pts (4.6%) — Market wisdom for favorites
 *
 * Core Categories (271 pts):
 * - Speed/Class: 122 pts (37.2%) — Speed 90 pts (~27%) + Class 32 pts (~10%)
 * - Pace: 45 pts (13.7%) — High predictive value for race shape
 * - Form: 50 pts (15.2%) — Recent performance patterns
 * - Post Position: 12 pts (3.7%) — Track-dependent situational factor
 * - Connections: 27 pts (8.2%) — Enhanced partnership scoring
 * - Odds Factor: 15 pts (4.6%) — Market wisdom for favorites (NEW)
 * - Equipment: 8 pts (2.4%) — Speculative, fine-tuning only
 *
 * Bonus Categories (36 pts):
 * - Distance/Surface: 20 pts (6.1%) — Turf (8) + Wet (6) + Distance (6)
 * - Trainer Patterns: 10 pts (3.0%) — Situational trainer pattern bonuses
 * - Combo Patterns: 4 pts (1.2%) — Informational combo bonuses
 * - Track Specialist: 6 pts (1.8%) — Proven success at today's specific track
 * - Trainer Surface/Distance: 6 pts (1.8%) — Trainer specialization bonus
 *
 * Weight Change (3 pts):
 * - Weight: 1 pt (P2 subtle refinement for weight drops)
 * - Age Factor: ±1 pt (P3 peak performance at 4-5yo, declining at 8+)
 * - Sire's Sire: ±1 pt (P3 integrated into breeding for known influential sires)
 *
 * Total: 328 points base score
 */
export const SCORE_LIMITS = {
  connections: 27,
  postPosition: 12, // v3.0: reduced from 20
  speedClass: 122, // v3.0: increased from 80 (speed 90 + class 32)
  form: 50,
  equipment: 8, // v3.0: reduced from 12
  pace: 45,
  odds: 15, // Phase 6: Market wisdom for favorites (0-15 pts)
  distanceSurface: 20, // Turf (8) + Wet (6) + Distance (6) = 20
  trainerPatterns: 10, // v3.0: reduced from 15
  comboPatterns: 4, // v3.0: reduced from 6
  trackSpecialist: 6, // Track specialist bonus (30%+ win rate at track)
  trainerSurfaceDistance: 6, // Trainer surface/distance specialization (can stack with wet)
  weight: 1, // Weight change scoring (P2 subtle refinement)
  // P3 refinements (subtle, ±1 pt each)
  ageFactor: 1, // Age-based peak performance (P3: +1 for 4-5yo, -1 for 8+)
  siresSire: 1, // Sire's sire breeding influence (P3: ±1 integrated into breeding)
  baseTotal: MAX_BASE_SCORE, // 328 (was 313)
  overlayMax: MAX_OVERLAY, // PHASE 5: 40 (was 50)
  total: MAX_SCORE, // Phase 6: 368 (was 353)
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
  elite: '#22c55e', // Green - Elite (200+)
  strong: '#4ade80', // Light Green - Strong (180+)
  good: '#eab308', // Yellow - Good (160+)
  fair: '#f97316', // Orange - Fair (140+)
  weak: '#ef4444', // Red - Weak (<140)
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
  /** Odds-based score (market wisdom for favorites) */
  odds: {
    total: number;
    oddsValue: number | null;
    oddsSource: 'live' | 'morning_line' | 'none';
    tier: string;
    reasoning: string;
  };
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
  /** Top Beyer Bonus (EXPERIMENTAL) */
  topBeyerBonus?: {
    /** Points added from the bonus */
    points: number;
    /** Whether this horse has the highest Beyer in the field */
    isTopBeyer: boolean;
    /** The horse's best Beyer figure */
    beyerFigure: number | null;
    /** The horse's original rank before bonus */
    originalRank: number;
    /** Whether the bonus was applied (only if ranked 5th or worse) */
    bonusApplied: boolean;
    /** Explanation of the bonus status */
    reasoning: string;
  };
}

/** Complete score result for a horse */
export interface HorseScore {
  /** Final total score (base + overlay) */
  total: number;
  /** Base score (0-328) before overlay */
  baseScore: number;
  /** Overlay adjustment (±40) */
  overlayScore: number;
  /** Odds-based score (0-15 pts for market wisdom) */
  oddsScore: number;
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
  /** EXPERIMENTAL: Whether the Top Beyer Bonus was applied */
  topBeyerBonusApplied: boolean;
  /** EXPERIMENTAL: Points added from Top Beyer Bonus */
  topBeyerBonusAmount: number;
  /** EXPERIMENTAL: Whether this horse is the Top Beyer in the field */
  isTopBeyer: boolean;
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
  trackCondition: TrackCondition,
  isScratched: boolean
): HorseScore {
  // Scratched horses get zero score
  if (isScratched) {
    return {
      total: 0,
      baseScore: 0,
      overlayScore: 0,
      oddsScore: 0,
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
        odds: {
          total: 0,
          oddsValue: null,
          oddsSource: 'none',
          tier: 'Unknown',
          reasoning: 'Scratched',
        },
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
      topBeyerBonusApplied: false,
      topBeyerBonusAmount: 0,
      isTopBeyer: false,
    };
  }

  // Calculate each category using the new modules
  const connections = calcConnections(horse, context.connectionsDb);
  const postPosition = calcPostPosition(horse, context.raceHeader);
  const speedClass = calcSpeedClass(horse, context.raceHeader);
  const form = calcForm(horse);
  const equipment = calcEquipment(horse);
  const pace = calcPace(horse, context.raceHeader, context.activeHorses, context.fieldPaceAnalysis);

  // Calculate odds-based score (0-15 points, Phase 6)
  // Note: _currentOdds parameter can be used for live odds override
  const oddsScore = calcOddsScore(
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
    odds: {
      total: oddsScore.total,
      oddsValue: oddsScore.oddsValue,
      oddsSource: oddsScore.oddsSource,
      tier: oddsScore.tier,
      reasoning: oddsScore.reasoning,
    },
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
    breakdown.odds.total + // Phase 6: Odds factor (0-15, market wisdom for favorites)
    breakdown.distanceSurface.total + // Distance/surface affinity bonus (0-20)
    breakdown.trainerPatterns.total + // Trainer pattern bonuses (0-15)
    breakdown.comboPatterns.total + // Combo pattern bonuses (0-12)
    breakdown.trackSpecialist.total + // Track specialist bonus (0-6)
    breakdown.trainerSurfaceDistance.total + // Trainer surface/distance specialization (0-6)
    breakdown.weightAnalysis.total + // Weight change bonus (0-1, P2 subtle refinement)
    breakdown.sexAnalysis.total + // Sex restriction adjustment (0 to -1, filly/mare vs males)
    p3Refinements.ageFactor.adjustment + // P3: Age factor adjustment (±1, 4-5yo peak, 8+ declining)
    breedingContribution + // Includes P3 sire's sire adjustment if applicable
    hiddenDropsBonus; // Add hidden class drop bonuses

  // Calculate data completeness BEFORE applying low confidence penalty
  // This way we can check isLowConfidence to decide on penalty
  const dataCompleteness = calculateDataCompleteness(horse, context.raceHeader);

  // Enforce base score boundaries (0 to MAX_BASE_SCORE)
  let baseScore = enforceBaseScoreBoundaries(rawBaseTotal);

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
  // Ensures score is floored at MIN_SCORE (0) and capped at MAX_FINAL_SCORE (368)
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
    oddsScore: oddsScore.total,
    breakdown,
    isScratched: false,
    confidenceLevel,
    dataQuality,
    breedingScore,
    classScore: classScoreResult,
    overlayResult,
    oddsResult: oddsScore,
    dataCompleteness,
    lowConfidencePenaltyApplied,
    lowConfidencePenaltyAmount,
    topBeyerBonusApplied: false,
    topBeyerBonusAmount: 0,
    isTopBeyer: false,
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
 * Get the best Beyer figure for a horse from recent past performances
 * Uses the same logic as the speed/class scoring module
 */
function getBestBeyerForHorse(horse: HorseEntry): number | null {
  // Calculate max Beyer from past performances (last 3 races)
  // NOTE: Do NOT use horse.bestBeyer (field 224) - it contains incorrect data
  const recentPPs = horse.pastPerformances?.slice(0, 3) || [];
  const beyers = recentPPs
    .map((pp) => pp.speedFigures?.beyer)
    .filter((b): b is number => b !== null && b !== undefined && b > 0);

  if (beyers.length === 0) return null;

  return Math.max(...beyers);
}

/**
 * Find the horse with the highest Beyer figure in the field
 * Returns null if no horses have valid Beyer figures
 */
function findTopBeyerHorse(scoredHorses: ScoredHorse[]): { horse: ScoredHorse; beyer: number } | null {
  let topBeyer: { horse: ScoredHorse; beyer: number } | null = null;

  for (const sh of scoredHorses) {
    if (sh.score.isScratched) continue;

    const beyer = getBestBeyerForHorse(sh.horse);
    if (beyer !== null && (topBeyer === null || beyer > topBeyer.beyer)) {
      topBeyer = { horse: sh, beyer };
    }
  }

  return topBeyer;
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

  // First, sort by BASE SCORE to determine ranks (best base score = rank 1)
  // Uses baseScore (who we think wins) not totalScore (which includes overlay adjustments)
  const sortedByScore = [...scoredHorses]
    .filter((h) => !h.score.isScratched)
    .sort((a, b) => b.score.baseScore - a.score.baseScore);

  // Assign ranks based on score
  sortedByScore.forEach((horse, index) => {
    horse.rank = index + 1;
  });

  // =========================================================================
  // EXPERIMENTAL: Apply Top Beyer Bonus
  // If enabled, find the horse with highest Beyer and boost if ranks 5th+
  // =========================================================================
  if (isTopBeyerBonusEnabled()) {
    const bonusPoints = getTopBeyerBonusPoints();
    const rankThreshold = getTopBeyerBonusRankThreshold();

    // Find the top Beyer horse
    const topBeyerResult = findTopBeyerHorse(scoredHorses);

    if (topBeyerResult) {
      const { horse: topBeyerHorse, beyer: topBeyerFigure } = topBeyerResult;

      // Mark all horses with their top beyer status
      for (const sh of scoredHorses) {
        if (sh.score.isScratched) continue;

        const isTopBeyer = sh === topBeyerHorse;
        const horseBeyer = getBestBeyerForHorse(sh.horse);
        const originalRank = sh.rank;
        const bonusApplied = isTopBeyer && originalRank >= rankThreshold;

        // Update the score object
        sh.score.isTopBeyer = isTopBeyer;

        if (bonusApplied) {
          // Apply the bonus
          sh.score.topBeyerBonusApplied = true;
          sh.score.topBeyerBonusAmount = bonusPoints;
          sh.score.total = enforceScoreBoundaries(sh.score.total + bonusPoints);
        }

        // Add the breakdown info
        sh.score.breakdown.topBeyerBonus = {
          points: bonusApplied ? bonusPoints : 0,
          isTopBeyer,
          beyerFigure: horseBeyer,
          originalRank,
          bonusApplied,
          reasoning: isTopBeyer
            ? bonusApplied
              ? `Top Beyer (${topBeyerFigure}) ranked ${originalRank}th → +${bonusPoints} bonus applied`
              : `Top Beyer (${topBeyerFigure}) ranked ${originalRank}${originalRank === 1 ? 'st' : originalRank === 2 ? 'nd' : originalRank === 3 ? 'rd' : 'th'} → No bonus needed (ranks above ${rankThreshold}th)`
            : horseBeyer !== null
              ? `Beyer ${horseBeyer} (not top in field)`
              : 'No Beyer figure available',
        };
      }

      // Re-rank all horses after applying bonus
      const reSortedByScore = [...scoredHorses]
        .filter((h) => !h.score.isScratched)
        .sort((a, b) => b.score.total - a.score.total);

      reSortedByScore.forEach((horse, index) => {
        horse.rank = index + 1;
      });
    }
  }

  // Now sort by post position for display (scratched horses stay in place)
  scoredHorses.sort((a, b) => {
    return a.horse.postPosition - b.horse.postPosition;
  });

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
export { getParFigures, getClassHierarchy } from './speedClass';

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
