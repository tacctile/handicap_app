/**
 * Nuclear Longshot Detection Type Definitions
 *
 * Identifies horses at 25/1+ odds with specific upset angles
 * that create logical scenarios for massive upsets.
 *
 * Upset Angle Categories:
 * - Pace Devastation: Speed duel setup for closers
 * - Class Relief: Major class drop with proven higher level form
 * - Equipment Rescue: First-time Lasix + Blinkers with trainer pattern
 * - Trainer Pattern: Trainer wins 20%+ in this specific spot
 * - Track Bias Fit: Running style perfectly matches track bias
 * - Hidden Form: Workout pattern + valid excuses = bounce candidate
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum odds (decimal) to qualify as a longshot (25/1 = 26.0 decimal) */
export const MIN_LONGSHOT_ODDS_DECIMAL = 26.0;

/** Minimum odds ratio (25/1) */
export const MIN_LONGSHOT_ODDS_RATIO = 25;

/** Minimum base score to consider (not complete trash) */
export const MIN_BASE_SCORE = 100;

/** Minimum angle points needed to be classified as LIVE (2+ angles) */
export const MIN_ANGLE_POINTS_LIVE = 60;

/** Minimum angle points for NUCLEAR classification */
export const MIN_ANGLE_POINTS_NUCLEAR = 100;

// ============================================================================
// UPSET ANGLE TYPES
// ============================================================================

/**
 * Categories of upset angles for longshot horses
 */
export type UpsetAngleCategory =
  | 'pace_devastation'
  | 'class_relief'
  | 'equipment_rescue'
  | 'trainer_pattern'
  | 'track_bias_fit'
  | 'hidden_form';

/**
 * Display names for upset angle categories
 */
export const UPSET_ANGLE_NAMES: Record<UpsetAngleCategory, string> = {
  pace_devastation: 'Pace Devastation',
  class_relief: 'Class Relief',
  equipment_rescue: 'Equipment Rescue',
  trainer_pattern: 'Trainer Pattern',
  track_bias_fit: 'Track Bias Fit',
  hidden_form: 'Hidden Form',
};

/**
 * Icons for upset angle categories
 */
export const UPSET_ANGLE_ICONS: Record<UpsetAngleCategory, string> = {
  pace_devastation: 'speed',
  class_relief: 'trending_down',
  equipment_rescue: 'build',
  trainer_pattern: 'person_pin',
  track_bias_fit: 'track_changes',
  hidden_form: 'visibility',
};

/**
 * Colors for upset angle categories
 */
export const UPSET_ANGLE_COLORS: Record<UpsetAngleCategory, string> = {
  pace_devastation: '#ef4444', // Red - explosive
  class_relief: '#22c55e', // Green - favorable
  equipment_rescue: '#3b82f6', // Blue - equipment
  trainer_pattern: '#f59e0b', // Amber - trainer
  track_bias_fit: '#8b5cf6', // Purple - track
  hidden_form: '#06b6d4', // Cyan - hidden
};

/**
 * Base point values for each upset angle category
 */
export const UPSET_ANGLE_BASE_POINTS: Record<UpsetAngleCategory, number> = {
  pace_devastation: 40, // Strongest angle - pace collapse
  class_relief: 35, // Very strong - proven at higher level
  equipment_rescue: 30, // Strong - equipment + trainer pattern
  trainer_pattern: 35, // Very strong - trainer data is reliable
  track_bias_fit: 30, // Strong - track bias is measurable
  hidden_form: 25, // Moderate - more speculative
};

// ============================================================================
// UPSET ANGLE DEFINITION
// ============================================================================

/**
 * Definition of an upset angle with requirements
 */
export interface UpsetAngleDefinition {
  /** Category of the angle */
  category: UpsetAngleCategory;
  /** Display name */
  name: string;
  /** Full description */
  description: string;
  /** Point value when criteria met */
  basePoints: number;
  /** Required evidence fields */
  requiredEvidence: string[];
  /** Optional bonus evidence fields */
  bonusEvidence?: string[];
  /** Maximum bonus points */
  maxBonusPoints?: number;
}

/**
 * Complete definitions for all upset angle types
 */
export const UPSET_ANGLE_DEFINITIONS: Record<UpsetAngleCategory, UpsetAngleDefinition> = {
  pace_devastation: {
    category: 'pace_devastation',
    name: 'Pace Devastation',
    description:
      'Speed duel scenario where early speed horses will collapse, setting up this closer',
    basePoints: 40,
    requiredEvidence: ['ppi_above_50', 'is_lone_closer', 'speed_count_4_plus'],
    bonusEvidence: ['has_rail_speed', 'proven_closer'],
    maxBonusPoints: 10,
  },
  class_relief: {
    category: 'class_relief',
    name: 'Class Relief',
    description: 'Major class drop (3+ levels) with proven form at higher level',
    basePoints: 35,
    requiredEvidence: ['class_drop_3_plus', 'proven_at_higher_level'],
    bonusEvidence: ['won_at_higher_level', 'hidden_class_edge'],
    maxBonusPoints: 10,
  },
  equipment_rescue: {
    category: 'equipment_rescue',
    name: 'Equipment Rescue',
    description: 'First-time Lasix + Blinkers with trainer having 25%+ win rate combo',
    basePoints: 30,
    requiredEvidence: ['first_time_lasix', 'blinkers_on', 'trainer_equipment_pattern'],
    bonusEvidence: ['had_valid_excuse_last', 'trainer_above_25_pct'],
    maxBonusPoints: 10,
  },
  trainer_pattern: {
    category: 'trainer_pattern',
    name: 'Trainer Pattern',
    description: 'Trainer wins 20%+ at this track/distance/surface with sample size 20+',
    basePoints: 35,
    requiredEvidence: ['trainer_pattern_20_plus', 'sample_size_20_plus'],
    bonusEvidence: ['trainer_pattern_25_plus', 'fits_layoff_pattern', 'fits_class_drop_pattern'],
    maxBonusPoints: 15,
  },
  track_bias_fit: {
    category: 'track_bias_fit',
    name: 'Track Bias Fit',
    description: 'Extreme track bias (80%+ early speed or 70%+ closers) with perfect style match',
    basePoints: 30,
    requiredEvidence: ['extreme_track_bias', 'running_style_match'],
    bonusEvidence: ['ideal_post_position', 'consistent_style'],
    maxBonusPoints: 10,
  },
  hidden_form: {
    category: 'hidden_form',
    name: 'Hidden Form',
    description: 'Sharp workout pattern with valid excuse in last race suggesting improvement',
    basePoints: 25,
    requiredEvidence: ['sharp_workout_pattern', 'valid_excuse_last'],
    bonusEvidence: ['bullet_work', 'surface_switch_favorable', 'distance_change_favorable'],
    maxBonusPoints: 10,
  },
};

// ============================================================================
// DETECTED UPSET ANGLE
// ============================================================================

/**
 * A detected upset angle with evidence and points
 */
export interface DetectedUpsetAngle {
  /** The angle category */
  category: UpsetAngleCategory;
  /** Display name */
  name: string;
  /** Points awarded for this angle */
  points: number;
  /** Evidence string explaining why this angle applies */
  evidence: string;
  /** Detailed breakdown of evidence */
  evidenceDetails: string[];
  /** Confidence in this angle (0-100) */
  confidence: number;
  /** Whether all required evidence was found */
  hasAllRequiredEvidence: boolean;
  /** Bonus points from optional evidence */
  bonusPoints: number;
}

// ============================================================================
// LONGSHOT CLASSIFICATION
// ============================================================================

/**
 * Classification levels for nuclear longshots
 */
export type LongshotClassification =
  | 'nuclear' // 100+ angle pts - serious upset candidate, bet
  | 'live' // 60-99 angle pts - playable longshot, small bet
  | 'lottery' // 40-59 angle pts - low probability, pass usually
  | 'dead'; // 0-39 angle pts - no chance, ignore

/**
 * Metadata for longshot classifications
 */
export const LONGSHOT_CLASSIFICATION_META: Record<
  LongshotClassification,
  {
    name: string;
    description: string;
    color: string;
    icon: string;
    recommendation: string;
    minPoints: number;
    maxPoints: number;
  }
> = {
  nuclear: {
    name: 'NUCLEAR',
    description: 'Serious upset candidate with multiple strong angles',
    color: '#ef4444', // Red/hot
    icon: 'local_fire_department',
    recommendation: 'BET - Value bomb with logical upset angles',
    minPoints: 100,
    maxPoints: 999,
  },
  live: {
    name: 'LIVE',
    description: 'Playable longshot with at least 2 upset angles',
    color: '#f59e0b', // Amber
    icon: 'bolt',
    recommendation: 'SMALL BET - Worth a shot at these odds',
    minPoints: 60,
    maxPoints: 99,
  },
  lottery: {
    name: 'LOTTERY',
    description: 'Low probability but has some angle',
    color: '#6b7280', // Gray
    icon: 'casino',
    recommendation: 'PASS - Unless massive field and need bombs',
    minPoints: 40,
    maxPoints: 59,
  },
  dead: {
    name: 'DEAD',
    description: 'No real upset angle despite the odds',
    color: '#374151', // Dark gray
    icon: 'block',
    recommendation: 'IGNORE - Just a longshot with no angle',
    minPoints: 0,
    maxPoints: 39,
  },
};

// ============================================================================
// LONGSHOT ANALYSIS RESULT
// ============================================================================

/**
 * Complete longshot analysis result for a horse
 */
export interface LongshotAnalysisResult {
  /** Horse's program number */
  programNumber: number;
  /** Horse name */
  horseName: string;
  /** Decimal odds */
  oddsDecimal: number;
  /** Odds display string */
  oddsDisplay: string;
  /** Whether horse qualifies as a longshot (25/1+) */
  isLongshot: boolean;
  /** Base score (from standard scoring) */
  baseScore: number;
  /** Whether base score meets minimum threshold */
  meetsBaseScoreMinimum: boolean;
  /** All detected upset angles */
  detectedAngles: DetectedUpsetAngle[];
  /** Total angle points */
  totalAnglePoints: number;
  /** Number of angles detected */
  angleCount: number;
  /** Classification (nuclear/live/lottery/dead) */
  classification: LongshotClassification;
  /** Classification metadata */
  classificationMeta: (typeof LONGSHOT_CLASSIFICATION_META)[LongshotClassification];
  /** Calculated upset probability based on angles */
  upsetProbability: number;
  /** Expected value calculation */
  expectedValue: number;
  /** ROI multiplier (odds × probability) */
  roiMultiplier: number;
  /** Summary description */
  summary: string;
  /** Full reasoning for display */
  reasoning: string[];
  /** Whether this horse should be flagged in UI */
  shouldFlag: boolean;
  /** Bet recommendation if applicable */
  betRecommendation: string | null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse odds string to decimal (25/1 = 26.0)
 */
export function parseOddsToDecimal(oddsStr: string): number {
  if (!oddsStr) return 0;

  // Handle "25-1" or "25/1" format
  const match = oddsStr.match(/(\d+(?:\.\d+)?)\s*[-/]\s*(\d+)/);
  if (match && match[1] && match[2]) {
    const numerator = parseFloat(match[1]);
    const denominator = parseFloat(match[2]);
    return numerator / denominator + 1; // +1 for decimal odds
  }

  // Handle decimal odds directly
  const decimal = parseFloat(oddsStr);
  if (!isNaN(decimal)) {
    return decimal;
  }

  return 0;
}

/**
 * Format decimal odds to display string
 */
export function formatOddsDisplay(decimalOdds: number): string {
  const ratio = Math.round(decimalOdds - 1);
  return `${ratio}/1`;
}

/**
 * Check if odds qualify as a longshot (25/1+)
 */
export function isLongshotOdds(oddsStr: string): boolean {
  const decimal = parseOddsToDecimal(oddsStr);
  return decimal >= MIN_LONGSHOT_ODDS_DECIMAL;
}

/**
 * Get classification based on angle points
 */
export function getClassificationFromPoints(points: number): LongshotClassification {
  if (points >= MIN_ANGLE_POINTS_NUCLEAR) return 'nuclear';
  if (points >= MIN_ANGLE_POINTS_LIVE) return 'live';
  if (points >= 40) return 'lottery';
  return 'dead';
}

/**
 * Calculate upset probability from angle points
 * Formula: (angle points / 100) * base modifier
 * Capped at 25% - longshots are still longshots
 */
export function calculateUpsetProbability(anglePoints: number): number {
  // Base probability from angle points (1% per 10 points)
  const baseProbability = (anglePoints / 100) * 0.15;

  // Cap at 25% - these are still longshots
  return Math.min(0.25, baseProbability);
}

/**
 * Calculate expected value
 * EV = (odds × probability) - 1
 * Positive EV means profitable bet
 */
export function calculateExpectedValue(decimalOdds: number, upsetProbability: number): number {
  return decimalOdds * upsetProbability - (1 - upsetProbability);
}

/**
 * Get color for longshot classification
 */
export function getClassificationColor(classification: LongshotClassification): string {
  return LONGSHOT_CLASSIFICATION_META[classification].color;
}

/**
 * Get icon for longshot classification
 */
export function getClassificationIcon(classification: LongshotClassification): string {
  return LONGSHOT_CLASSIFICATION_META[classification].icon;
}
