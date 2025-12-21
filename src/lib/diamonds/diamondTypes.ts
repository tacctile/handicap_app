/**
 * Diamond in Rough Detection Type Definitions
 *
 * Diamonds are horses with moderate scores (120-139) that have
 * massive overlays (200%+) AND multiple supporting factors that
 * create a "perfect storm" scenario for an upset at great odds.
 *
 * Unlike random longshots, diamonds have LOGICAL STORIES:
 * - Class drop + equipment change + pace fit
 * - Hidden form + track bias fit
 * - Breeding potential (lightly raced) + trainer pattern
 *
 * These are rare gems - maybe 1-2 per race card.
 */

// ============================================================================
// DIAMOND CRITERIA CONSTANTS
// ============================================================================

/** Diamond score range - not terrible, but not great */
export const DIAMOND_SCORE_MIN = 120;
export const DIAMOND_SCORE_MAX = 139;

/** Minimum overlay percentage required (200% = 3x fair odds) */
export const DIAMOND_MIN_OVERLAY_PERCENT = 200;

/** Minimum number of supporting factors required (beyond score + overlay) */
export const DIAMOND_MIN_FACTORS = 2;

/** Confidence calculation: (Number of factors × 20%) */
export const CONFIDENCE_PER_FACTOR = 20;

// ============================================================================
// PERFECT STORM FACTOR TYPES
// ============================================================================

/**
 * Categories of "perfect storm" factors that support a diamond
 */
export type PerfectStormFactorType =
  | 'class_drop' // Dropping in class
  | 'equipment_change' // Significant equipment change
  | 'pace_fit' // Running style fits pace scenario
  | 'hidden_form' // Sharp workouts + valid excuse
  | 'track_bias_fit' // Running style matches track bias
  | 'breeding_potential' // Lightly raced with good pedigree
  | 'trainer_pattern' // Trainer excels in this situation
  | 'jockey_upgrade' // Significant jockey improvement
  | 'surface_switch' // Favorable surface change
  | 'distance_change' // Favorable distance change
  | 'hidden_class_drop' // Track tier or purse drop
  | 'first_time_lasix'; // First-time Lasix

/**
 * Display names for perfect storm factor types
 */
export const FACTOR_NAMES: Record<PerfectStormFactorType, string> = {
  class_drop: 'Class Drop',
  equipment_change: 'Equipment Change',
  pace_fit: 'Pace Fit',
  hidden_form: 'Hidden Form',
  track_bias_fit: 'Track Bias Fit',
  breeding_potential: 'Breeding Potential',
  trainer_pattern: 'Trainer Pattern',
  jockey_upgrade: 'Jockey Upgrade',
  surface_switch: 'Surface Switch',
  distance_change: 'Distance Change',
  hidden_class_drop: 'Hidden Class Drop',
  first_time_lasix: 'First-Time Lasix',
};

/**
 * Icons for perfect storm factor types (Material Icons names)
 */
export const FACTOR_ICONS: Record<PerfectStormFactorType, string> = {
  class_drop: 'trending_down',
  equipment_change: 'build',
  pace_fit: 'speed',
  hidden_form: 'visibility',
  track_bias_fit: 'track_changes',
  breeding_potential: 'family_restroom',
  trainer_pattern: 'person_pin',
  jockey_upgrade: 'upgrade',
  surface_switch: 'terrain',
  distance_change: 'straighten',
  hidden_class_drop: 'trending_down',
  first_time_lasix: 'medication',
};

/**
 * Colors for perfect storm factor types
 */
export const FACTOR_COLORS: Record<PerfectStormFactorType, string> = {
  class_drop: '#22c55e', // Green
  equipment_change: '#3b82f6', // Blue
  pace_fit: '#f97316', // Orange
  hidden_form: '#06b6d4', // Cyan
  track_bias_fit: '#8b5cf6', // Purple
  breeding_potential: '#ec4899', // Pink
  trainer_pattern: '#f59e0b', // Amber
  jockey_upgrade: '#10b981', // Emerald
  surface_switch: '#84cc16', // Lime
  distance_change: '#14b8a6', // Teal
  hidden_class_drop: '#22c55e', // Green
  first_time_lasix: '#ef4444', // Red
};

// ============================================================================
// DETECTED FACTOR INTERFACE
// ============================================================================

/**
 * A detected perfect storm factor with evidence
 */
export interface DetectedFactor {
  /** The factor type */
  type: PerfectStormFactorType;
  /** Display name */
  name: string;
  /** Evidence string explaining why this factor applies */
  evidence: string;
  /** Detailed evidence breakdown */
  evidenceDetails: string[];
  /** Confidence in this factor (0-100) */
  confidence: number;
  /** Icon name for display */
  icon: string;
  /** Color for display */
  color: string;
  /** Source module that provided this data */
  sourceModule: string;
}

// ============================================================================
// DIAMOND ANALYSIS RESULT
// ============================================================================

/**
 * Complete diamond analysis result for a horse
 */
export interface DiamondAnalysis {
  /** Horse's program number */
  programNumber: number;
  /** Horse name */
  horseName: string;
  /** Horse index in race */
  horseIndex: number;
  /** Horse's total score (120-139 range) */
  score: number;
  /** Current odds display */
  oddsDisplay: string;
  /** Decimal odds */
  oddsDecimal: number;
  /** Overlay percentage (should be 200%+) */
  overlayPercent: number;
  /** Whether this horse qualifies as a diamond */
  isDiamond: boolean;
  /** Reason if not a diamond */
  disqualificationReason?: string;
  /** All detected perfect storm factors */
  factors: DetectedFactor[];
  /** Number of factors detected */
  factorCount: number;
  /** Calculated confidence percentage (factors × 20%) */
  confidence: number;
  /** The "story" - why this upset makes sense */
  story: string;
  /** Short summary for tooltips */
  summary: string;
  /** Full reasoning with all evidence */
  reasoning: string[];
  /** Validation status */
  validationStatus: 'validated' | 'partial' | 'rejected';
  /** Validation notes */
  validationNotes: string[];
  /** Expected Value calculation */
  expectedValue: number;
  /** ROI potential */
  roiPotential: number;
  /** Bet recommendation */
  betRecommendation: string;
  /** Timestamp of analysis */
  analyzedAt: string;
}

// ============================================================================
// RACE DIAMOND SUMMARY
// ============================================================================

/**
 * Summary of diamonds in a race
 */
export interface RaceDiamondSummary {
  /** Race number */
  raceNumber: number;
  /** Track code */
  trackCode: string;
  /** Total horses analyzed */
  totalHorses: number;
  /** Number of diamonds detected */
  diamondCount: number;
  /** All diamonds found */
  diamonds: DiamondAnalysis[];
  /** Whether any diamonds were found */
  hasDiamonds: boolean;
  /** Best diamond (highest confidence) */
  bestDiamond: DiamondAnalysis | null;
  /** Total factors across all diamonds */
  totalFactors: number;
  /** Average confidence of diamonds */
  averageConfidence: number;
  /** Summary description */
  summary: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a score is in diamond range (120-139)
 */
export function isScoreInDiamondRange(score: number): boolean {
  return score >= DIAMOND_SCORE_MIN && score <= DIAMOND_SCORE_MAX;
}

/**
 * Check if overlay meets diamond minimum (200%+)
 */
export function meetsMinimumOverlay(overlayPercent: number): boolean {
  return overlayPercent >= DIAMOND_MIN_OVERLAY_PERCENT;
}

/**
 * Calculate confidence from factor count
 */
export function calculateConfidence(factorCount: number): number {
  return Math.min(100, factorCount * CONFIDENCE_PER_FACTOR);
}

/**
 * Check if factor count meets minimum (2+)
 */
export function meetsMinimumFactors(factorCount: number): boolean {
  return factorCount >= DIAMOND_MIN_FACTORS;
}

/**
 * Get diamond display color (gold-tinted)
 */
export function getDiamondColor(): string {
  return '#FFD700'; // Gold
}

/**
 * Get diamond background color with opacity
 */
export function getDiamondBgColor(opacity: number = 0.15): string {
  return `rgba(255, 215, 0, ${opacity})`;
}

/**
 * Get diamond border color
 */
export function getDiamondBorderColor(): string {
  return '#FFD70080'; // Gold with 50% opacity
}
