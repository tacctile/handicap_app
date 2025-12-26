/**
 * Scoring Type Definitions
 *
 * Contains interfaces for scoring-related calculations including
 * data completeness analysis.
 */

// ============================================================================
// DATA COMPLETENESS TYPES
// ============================================================================

/**
 * Data completeness grade based on overall score
 * A = 90+, B = 75+, C = 60+, D = 40+, F = <40
 */
export type DataCompletenessGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Data field importance tier
 * Used for categorizing which data fields are most critical for scoring accuracy
 */
export type DataFieldTier = 'critical' | 'high' | 'medium' | 'low';

/**
 * Field presence check result
 * Standard structure for all field validation checks
 */
export interface FieldPresenceResult {
  /** Whether the data is present and valid */
  present: boolean;
  /** Count of valid items (for arrays like past performances) */
  count?: number;
}

/**
 * Speed figures presence result
 */
export interface SpeedFiguresPresence extends FieldPresenceResult {
  /** Number of valid Beyer figures in last 3 races */
  count: number;
  /** Best Beyer figure found (null if none) */
  bestBeyer: number | null;
  /** Average Beyer figure (null if insufficient data) */
  averageBeyer: number | null;
}

/**
 * Past performances presence result
 */
export interface PastPerformancesPresence extends FieldPresenceResult {
  /** Number of valid past performances */
  count: number;
  /** Number with finish positions */
  withFinishPositions: number;
}

/**
 * Trainer stats presence result
 */
export interface TrainerStatsPresence extends FieldPresenceResult {
  /** Number of meet starts */
  meetStarts: number;
  /** Whether career stats are available as fallback */
  hasCareerStats: boolean;
}

/**
 * Jockey stats presence result
 */
export interface JockeyStatsPresence extends FieldPresenceResult {
  /** Number of meet starts */
  meetStarts: number;
  /** Whether career stats are available as fallback */
  hasCareerStats: boolean;
}

/**
 * Pace figures presence result
 */
export interface PaceFiguresPresence extends FieldPresenceResult {
  /** Number of valid EP1 (early pace) figures */
  ep1Count: number;
  /** Number of valid LP (late pace) figures */
  lpCount: number;
}

/**
 * Running style presence result
 */
export interface RunningStylePresence extends FieldPresenceResult {
  /** Running style code if present (E, E/P, P, S, etc.) */
  style: string | null;
}

/**
 * Track record presence result
 */
export interface TrackRecordPresence extends FieldPresenceResult {
  /** Number of starts at the track */
  starts: number;
}

/**
 * Distance record presence result
 */
export interface DistanceRecordPresence extends FieldPresenceResult {
  /** Number of starts at the distance */
  starts: number;
}

/**
 * Surface record presence result
 */
export interface SurfaceRecordPresence extends FieldPresenceResult {
  /** Number of starts on the surface */
  starts: number;
}

/**
 * Complete data completeness analysis result
 * Provides detailed breakdown of data availability for a horse
 */
export interface DataCompletenessResult {
  // =========================================================================
  // OVERALL METRICS
  // =========================================================================

  /** Overall completeness score (0-100 percentage) */
  overallScore: number;

  /** Letter grade based on overall score: A=90+, B=75+, C=60+, D=40+, F=<40 */
  overallGrade: DataCompletenessGrade;

  // =========================================================================
  // TIER COMPLETENESS
  // =========================================================================

  /** Percentage of critical fields that are complete (0-100) */
  criticalComplete: number;

  /** Percentage of high importance fields that are complete (0-100) */
  highComplete: number;

  /** Percentage of medium importance fields that are complete (0-100) */
  mediumComplete: number;

  /** Percentage of low importance fields that are complete (0-100) */
  lowComplete: number;

  // =========================================================================
  // SPECIFIC FLAGS (Quick Access)
  // =========================================================================

  /** Has at least 1 Beyer speed figure in last 3 races */
  hasSpeedFigures: boolean;

  /** Has at least 3 past performances */
  hasPastPerformances: boolean;

  /** Has valid trainer statistics (meet or career) */
  hasTrainerStats: boolean;

  /** Has valid jockey statistics (meet or career) */
  hasJockeyStats: boolean;

  /** Has valid running style classification */
  hasRunningStyle: boolean;

  /** Has valid pace figures (EP1 and/or LP) */
  hasPaceFigures: boolean;

  // =========================================================================
  // MISSING DATA LISTS
  // =========================================================================

  /** List of missing critical data items (for display) */
  missingCritical: string[];

  /** List of missing high importance data items (for display) */
  missingHigh: string[];

  // =========================================================================
  // CONFIDENCE ASSESSMENT
  // =========================================================================

  /** Flag indicating low confidence in scoring (criticalComplete < 75%) */
  isLowConfidence: boolean;

  /** Human-readable reason for low confidence (null if not low confidence) */
  confidenceReason: string | null;

  // =========================================================================
  // DETAILED BREAKDOWN (for debugging/advanced display)
  // =========================================================================

  /** Detailed breakdown of each tier's field status */
  details?: {
    critical: {
      speedFigures: SpeedFiguresPresence;
      pastPerformances: PastPerformancesPresence;
      finishPositions: FieldPresenceResult;
      classLevel: FieldPresenceResult;
    };
    high: {
      trainerStats: TrainerStatsPresence;
      jockeyStats: JockeyStatsPresence;
      runningStyle: RunningStylePresence;
      daysSinceLastRace: FieldPresenceResult;
      workouts: FieldPresenceResult;
    };
    medium: {
      trackRecord: TrackRecordPresence;
      distanceRecord: DistanceRecordPresence;
      surfaceRecord: SurfaceRecordPresence;
      wetTrackRecord: SurfaceRecordPresence;
      earlyPaceFigures: FieldPresenceResult;
      latePaceFigures: FieldPresenceResult;
      trainerCategoryStats: FieldPresenceResult;
      equipment: FieldPresenceResult;
    };
    low: {
      breeding: FieldPresenceResult;
      weightChanges: FieldPresenceResult;
      claimingPriceHistory: FieldPresenceResult;
      lifetimeEarnings: FieldPresenceResult;
    };
  };
}

// ============================================================================
// TIER WEIGHT CONSTANTS
// ============================================================================

/**
 * Tier weights for calculating overall completeness score
 * Total: 100%
 */
export const DATA_TIER_WEIGHTS = {
  critical: 50, // 50% of overall score
  high: 30, // 30% of overall score
  medium: 15, // 15% of overall score
  low: 5, // 5% of overall score
} as const;

/**
 * Grade thresholds for data completeness
 */
export const DATA_COMPLETENESS_GRADES = {
  A: 90,
  B: 75,
  C: 60,
  D: 40,
  F: 0,
} as const;

/**
 * Low confidence threshold for critical data
 */
export const LOW_CONFIDENCE_THRESHOLD = 75;
