/**
 * Scoring Type Definitions
 *
 * Contains interfaces for scoring-related calculations including
 * data completeness analysis and trip trouble detection.
 */

// ============================================================================
// TRIP TROUBLE DETECTION TYPES
// ============================================================================

/**
 * Confidence level for trip trouble detection
 */
export type TripTroubleConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

/**
 * Analysis of a single troubled race
 */
export interface TroubledRace {
  /** Race index (0 = last race, 1 = 2 back, etc.) */
  raceIndex: number;
  /** Trouble keywords found in comments */
  troubleKeywords: string[];
  /** Confidence level for this race's trouble */
  confidenceLevel: TripTroubleConfidence;
  /** Finish position in this race */
  finishPosition: number;
  /** Beyer speed figure for this race (null if unavailable) */
  beyer: number | null;
}

/**
 * Complete trip trouble analysis result for a horse
 */
export interface TripTroubleResult {
  /** Program number */
  programNumber: number;
  /** Horse name */
  horseName: string;
  /** Array of troubled race analyses */
  troubledRaces: TroubledRace[];
  /** Total count of troubled races */
  totalTroubledCount: number;
  /** Count of high-confidence trouble races */
  highConfidenceCount: number;
  /** Count of medium-confidence trouble races */
  mediumConfidenceCount: number;
  /** Count of low-confidence trouble races */
  lowConfidenceCount: number;
  /** Count of races where horse caused trouble (disqualifying) */
  causedTroubleCount: number;
  /** Adjustment points to add to form score (0-8) */
  adjustment: number;
  /** Overall confidence level */
  confidence: TripTroubleConfidence;
  /** Human-readable reason for the adjustment */
  reason: string;
}

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

// ============================================================================
// RACE SCORING RESULT TYPES (for AI integration)
// ============================================================================

/**
 * Pace scenario analysis from the scoring engine
 */
export interface PaceScenarioAnalysis {
  /** Expected pace scenario */
  expectedPace: 'hot' | 'moderate' | 'slow' | 'contested';
  /** Program number of likely leader (null if contested) */
  likelyLeader: number | null;
  /** Probability of a speed duel (0-1) */
  speedDuelProbability: number;
  /** Number of early speed horses */
  earlySpeedCount: number;
}

/**
 * Race-level analysis from scoring engine
 */
export interface RaceAnalysis {
  /** Pace scenario breakdown */
  paceScenario: PaceScenarioAnalysis;
  /** Field strength classification */
  fieldStrength: 'elite' | 'strong' | 'average' | 'weak';
  /** Whether the betting favorite appears vulnerable */
  vulnerableFavorite: boolean;
  /** Whether pace is likely to collapse (benefits closers) */
  likelyPaceCollapse: boolean;
  /** Track intelligence data (null if track not found) */
  trackIntelligence: TrackIntelligenceForAI | null;
}

// ============================================================================
// AI-SPECIFIC SUB-INTERFACES
// ============================================================================

/**
 * Running line positions for AI analysis
 * Tracks horse position throughout the race at key points
 */
export interface RunningLineForAI {
  /** Position at start/break */
  start: number | null;
  /** Position at stretch call */
  stretch: number | null;
  /** Final position */
  finish: number | null;
}

/**
 * Past performance data simplified for AI consumption
 * Provides recent race history to inform AI analysis of patterns and trends
 */
export interface PastPerformanceForAI {
  /** Race date (YYYYMMDD format) */
  date: string;
  /** Track code (3-letter abbreviation) */
  track: string;
  /** Distance in furlongs */
  distance: number;
  /** Surface type */
  surface: string;
  /** Track condition (fast, good, muddy, etc.) */
  trackCondition: string;
  /** Official finish position in the race */
  finishPosition: number;
  /** Number of horses in the race */
  fieldSize: number;
  /** Lengths behind the winner (0 if won) */
  lengthsBehind: number;
  /** Beyer speed figure for this race (null if unavailable) */
  beyer: number | null;
  /** Early pace figure (first call rating) */
  earlyPace1: number | null;
  /** Late pace figure (closing ability rating) */
  latePace: number | null;
  /** Chart caller's trip comment describing race experience */
  tripComment: string;
  /** Odds in this race */
  odds: number | null;
  /** Favorite indicator (1 = favorite, 2 = second choice, etc.) */
  favoriteRank: number | null;
  /** Position at key race points (start, stretch, finish) */
  runningLine: RunningLineForAI;
}

/**
 * Workout data simplified for AI consumption
 * Recent training works indicate current fitness and readiness
 */
export interface WorkoutForAI {
  /** Workout date */
  date: string;
  /** Track where workout occurred */
  track: string;
  /** Distance in furlongs */
  distanceFurlongs: number;
  /** Time in seconds */
  timeSeconds: number;
  /** Type of work (breeze, handily, driving, easy) */
  type: string;
  /** Whether this was the fastest work of the day at this distance */
  isBullet: boolean;
  /** Rank among works that day (1 = fastest) */
  rankNumber: number | null;
  /** Total works that day at track/distance */
  totalWorks: number | null;
}

/**
 * Single trainer category statistic for AI
 * Each category tracks trainer performance in specific situations
 */
export interface TrainerCategoryStatForAI {
  /** Number of starts in this category */
  starts: number;
  /** Number of wins in this category */
  wins: number;
  /** Win percentage (0-100) */
  winPercent: number;
  /** Return on investment as percentage */
  roi: number;
}

/**
 * Complete trainer patterns object for AI consumption
 * 19 situational categories that reveal trainer intentions and success rates
 */
export interface TrainerPatternsForAI {
  /** First-time Lasix application - medication change often signals improvement attempt */
  firstTimeLasix: TrainerCategoryStatForAI;
  /** First-time Blinkers application - equipment change to improve focus */
  firstTimeBlinkers: TrainerCategoryStatForAI;
  /** Blinkers removed - sometimes horses respond to equipment removal */
  blinkersOff: TrainerCategoryStatForAI;
  /** Second start off layoff (45+ days) - bounce or improve pattern */
  secondOffLayoff: TrainerCategoryStatForAI;
  /** Returning after 31-60 days layoff */
  days31to60: TrainerCategoryStatForAI;
  /** Returning after 61-90 days layoff */
  days61to90: TrainerCategoryStatForAI;
  /** Returning after 91-180 days layoff */
  days91to180: TrainerCategoryStatForAI;
  /** Returning after 181+ days layoff - long layoff success rate */
  days181plus: TrainerCategoryStatForAI;
  /** Sprint to route switch - stretching out to longer distance */
  sprintToRoute: TrainerCategoryStatForAI;
  /** Route to sprint switch - cutting back to shorter distance */
  routeToSprint: TrainerCategoryStatForAI;
  /** Turf sprint races */
  turfSprint: TrainerCategoryStatForAI;
  /** Turf route races */
  turfRoute: TrainerCategoryStatForAI;
  /** Wet/off track races - success on muddy/sloppy tracks */
  wetTrack: TrainerCategoryStatForAI;
  /** Dirt sprint races */
  dirtSprint: TrainerCategoryStatForAI;
  /** Dirt route races */
  dirtRoute: TrainerCategoryStatForAI;
  /** Maiden claiming races */
  maidenClaiming: TrainerCategoryStatForAI;
  /** Stakes races - success at highest class levels */
  stakes: TrainerCategoryStatForAI;
  /** First start for this trainer - new acquisition performance */
  firstStartTrainer: TrainerCategoryStatForAI;
  /** First start after horse was claimed - post-claim performance */
  afterClaim: TrainerCategoryStatForAI;
}

/**
 * Equipment flags for AI consumption
 * Current equipment configuration and changes can signal trainer intent
 */
export interface EquipmentForAI {
  /** Horse is wearing blinkers (focus aid) */
  blinkers: boolean;
  /** Blinkers were removed from previous race */
  blinkersOff: boolean;
  /** Front bandages applied */
  frontBandages: boolean;
  /** Tongue tie applied (breathing aid) */
  tongueTie: boolean;
  /** Nasal strip applied (breathing aid) */
  nasalStrip: boolean;
  /** Shadow roll applied (visual aid) */
  shadowRoll: boolean;
  /** Bar shoes applied (hoof protection) */
  barShoes: boolean;
  /** Mud caulks applied (wet track traction) */
  mudCaulks: boolean;
  /** List of equipment being used for the first time */
  firstTimeEquipment: string[];
  /** List of equipment changes from last race */
  equipmentChanges: string[];
}

/**
 * Breeding data for AI consumption
 * Pedigree information can indicate surface/distance aptitude
 */
export interface BreedingForAI {
  /** Sire (father) name */
  sire: string;
  /** Dam's sire (maternal grandsire) - important for aptitude inheritance */
  damSire: string;
  /** State/country where horse was bred */
  whereBred: string;
}

/**
 * Distance and surface performance stats for AI consumption
 * Historical success rates at today's conditions
 */
export interface DistanceSurfaceStatsForAI {
  /** Number of starts at today's distance */
  distanceStarts: number;
  /** Wins at today's distance */
  distanceWins: number;
  /** Win rate at today's distance (0-1, handles zero division) */
  distanceWinRate: number;
  /** Number of starts on today's surface (dirt/turf) */
  surfaceStarts: number;
  /** Wins on today's surface */
  surfaceWins: number;
  /** Win rate on today's surface (0-1) */
  surfaceWinRate: number;
  /** Total turf starts (lifetime) */
  turfStarts: number;
  /** Turf wins (lifetime) */
  turfWins: number;
  /** Turf win rate (0-1) */
  turfWinRate: number;
  /** Total wet track starts (lifetime) */
  wetStarts: number;
  /** Wet track wins (lifetime) */
  wetWins: number;
  /** Wet track win rate (0-1) */
  wetWinRate: number;
}

/**
 * Form indicators for AI consumption
 * Current fitness and historical performance metrics
 */
export interface FormIndicatorsForAI {
  /** Days since last race (null if first-time starter) */
  daysSinceLastRace: number | null;
  /** Average Beyer figure over recent races (null if unavailable) */
  averageBeyer: number | null;
  /** Best Beyer figure (career or recent) */
  bestBeyer: number | null;
  /** Most recent Beyer figure */
  lastBeyer: number | null;
  /** Early speed rating (running style indicator) */
  earlySpeedRating: number | null;
  /** Career starts */
  lifetimeStarts: number;
  /** Career wins */
  lifetimeWins: number;
  /** Career win rate (0-1) */
  lifetimeWinRate: number;
}

/**
 * Comprehensive horse score for AI prompt building
 * Maps from the full HorseScore/ScoredHorse types with complete data for AI analysis
 *
 * This interface provides all available data fields so AI bots can access
 * complete information for generating insights, narratives, and recommendations.
 */
export interface HorseScoreForAI {
  // =========================================================================
  // CORE IDENTIFICATION (Original 9 fields)
  // =========================================================================

  /** Program number (saddle cloth number) */
  programNumber: number;
  /** Horse name */
  horseName: string;
  /** Algorithm-assigned rank (1 = best) */
  rank: number;
  /** Final composite score from scoring engine */
  finalScore: number;
  /** Data confidence tier based on completeness */
  confidenceTier: 'high' | 'medium' | 'low';
  /** Score breakdown by major category */
  breakdown: {
    speedScore: number;
    classScore: number;
    formScore: number;
    paceScore: number;
    connectionScore: number;
  };
  /** Factors the algorithm flagged as positive */
  positiveFactors: string[];
  /** Factors the algorithm flagged as negative */
  negativeFactors: string[];
  /** Whether this horse is scratched from the race */
  isScratched: boolean;

  // =========================================================================
  // PAST PERFORMANCES (Last 3 races)
  // =========================================================================

  /**
   * Array of last 3 past performances
   * Provides recent race history for pattern analysis
   */
  pastPerformances: PastPerformanceForAI[];

  // =========================================================================
  // WORKOUTS (Last 3 works)
  // =========================================================================

  /**
   * Array of last 3 workouts
   * Training works indicate current fitness and readiness
   */
  workouts: WorkoutForAI[];

  // =========================================================================
  // TRAINER PATTERNS (19 situational categories)
  // =========================================================================

  /**
   * Complete trainer category statistics
   * Reveals trainer success rates in specific situations
   */
  trainerPatterns: TrainerPatternsForAI;

  // =========================================================================
  // EQUIPMENT
  // =========================================================================

  /**
   * Current equipment configuration and changes
   * Equipment changes can signal trainer intent
   */
  equipment: EquipmentForAI;

  // =========================================================================
  // BREEDING
  // =========================================================================

  /**
   * Pedigree information
   * Breeding can indicate surface/distance aptitude
   */
  breeding: BreedingForAI;

  // =========================================================================
  // DISTANCE/SURFACE STATS
  // =========================================================================

  /**
   * Performance statistics at today's distance and surface
   * Historical success rates inform probability assessments
   */
  distanceSurfaceStats: DistanceSurfaceStatsForAI;

  // =========================================================================
  // FORM INDICATORS
  // =========================================================================

  /**
   * Current form and fitness indicators
   * Layoff, speed figures, and career record
   */
  formIndicators: FormIndicatorsForAI;

  // =========================================================================
  // ODDS
  // =========================================================================

  /** Morning line odds as string (e.g., "5-1") */
  morningLineOdds: string;
  /** Morning line odds as decimal (e.g., 5.0) */
  morningLineDecimal: number;
}

// ============================================================================
// TRACK INTELLIGENCE FOR AI
// ============================================================================

/**
 * Post position bias data for AI consumption
 * Provides insight into track geometry effects on race outcomes
 */
export interface PostPositionBiasForAI {
  /** Win percentage by post (index 0 = post 1) */
  winPercentByPost: number[];
  /** 1-indexed posts with statistical advantage */
  favoredPosts: number[];
  /** Strength of the bias pattern */
  biasStrength: 'strong' | 'moderate' | 'weak' | 'neutral';
  /** Human-readable description of the bias */
  biasDescription: string;
}

/**
 * Speed/pace bias data for AI consumption
 * Indicates how early speed performs at this track/surface
 */
export interface SpeedBiasForAI {
  /** Percentage of races won by early speed horses */
  earlySpeedWinRate: number;
  /** Rating from 1-10 indicating pace advantage */
  paceAdvantageRating: number;
  /** Running style most favored by track */
  favoredStyle: 'E' | 'E/P' | 'P' | 'S' | 'neutral';
  /** Human-readable description of speed bias */
  biasDescription: string;
}

/**
 * Physical track characteristics for AI consumption
 * Helps AI understand track layout and playing style
 */
export interface TrackCharacteristicsForAI {
  /** Main track circumference in miles */
  circumference: number;
  /** Stretch length in feet */
  stretchLength: number;
  /** How the surface typically plays */
  playingStyle: 'speed-favoring' | 'fair' | 'tiring' | 'deep';
  /** Drainage quality affecting off-track conditions */
  drainage: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Seasonal context for current racing conditions
 * Provides AI with time-of-year adjustments
 */
export interface SeasonalContextForAI {
  /** Current season */
  currentSeason: 'winter' | 'spring' | 'summer' | 'fall';
  /** Expected typical track condition */
  typicalCondition: string;
  /** Speed figure adjustment (positive = faster times expected) */
  speedAdjustment: number;
  /** Running style favored this season (null if none) */
  favoredStyle: 'E' | 'P' | 'S' | null;
  /** Notes about seasonal impact */
  notes: string;
}

/**
 * Complete track intelligence data for AI consumption
 * Provides all available track-specific data to inform AI analysis
 */
export interface TrackIntelligenceForAI {
  /** Track code (e.g., "CD", "SAR") */
  trackCode: string;
  /** Full track name */
  trackName: string;
  /** Surface type for this race */
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather';
  /** Distance in furlongs */
  distance: number;
  /** Whether this is a sprint or route */
  isSprintOrRoute: 'sprint' | 'route';

  /** Post position bias analysis */
  postPositionBias: PostPositionBiasForAI;

  /** Speed/pace bias analysis */
  speedBias: SpeedBiasForAI;

  /** Physical track characteristics */
  trackCharacteristics: TrackCharacteristicsForAI;

  /** Seasonal context (null if no pattern for current month) */
  seasonalContext: SeasonalContextForAI | null;

  /** Data quality indicator */
  dataQuality: 'verified' | 'preliminary' | 'estimated' | 'unknown';
}

/**
 * Complete race scoring result for AI analysis
 * Combines individual horse scores with race-level analysis
 */
export interface RaceScoringResult {
  /** Scored horses (sorted by rank) */
  scores: HorseScoreForAI[];
  /** Race-level analysis */
  raceAnalysis: RaceAnalysis;
}
