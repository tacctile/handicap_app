/**
 * Track Intelligence Schema
 * Defines the structure for track-specific data used in handicapping
 */

/**
 * Post position bias data for a specific distance range
 */
export interface PostPositionBias {
  /** Distance range identifier (e.g., "6f", "1m", "1m1/4") */
  distance: string;
  /** Minimum distance in furlongs for this range */
  minFurlongs: number;
  /** Maximum distance in furlongs for this range */
  maxFurlongs: number;
  /** Win percentage by post position (index 0 = post 1, etc.) */
  winPercentByPost: number[];
  /** Posts that are statistically favored (1-indexed) */
  favoredPosts: number[];
  /** Brief description of the bias pattern */
  biasDescription: string;
}

/**
 * Speed bias data indicating early speed advantage
 */
export interface SpeedBias {
  /** Surface type this bias applies to */
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather';
  /** Percentage of races won by early speed horses */
  earlySpeedWinRate: number;
  /** Rating from 1-10 indicating pace advantage (10 = very strong speed bias) */
  paceAdvantageRating: number;
  /** Description of track's pace tendencies */
  description: string;
}

/**
 * Track measurement specifications
 */
export interface TrackMeasurements {
  /** Main track circumference in miles */
  circumference: number;
  /** Stretch length in feet */
  stretchLength: number;
  /** Turn radius in feet (approximate) */
  turnRadius: number;
  /** Width of track in feet */
  trackWidth: number;
  /** Chute distances available (in furlongs) */
  chutes: number[];
}

/**
 * Surface characteristics for the track
 */
export interface SurfaceCharacteristics {
  /** Base material type */
  baseType: 'dirt' | 'turf' | 'synthetic';
  /** Specific surface composition or turf type */
  composition: string;
  /** How the surface typically plays (speed-favoring, fair, tiring) */
  playingStyle: 'speed-favoring' | 'fair' | 'tiring' | 'deep';
  /** Drainage quality affecting off-track conditions */
  drainage: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Seasonal patterns affecting track performance
 */
export interface SeasonalPattern {
  /** Season identifier */
  season: 'winter' | 'spring' | 'summer' | 'fall';
  /** Months this pattern applies to */
  months: number[];
  /** Expected track condition variance */
  typicalCondition: string;
  /** Speed figure adjustment (positive = faster times expected) */
  speedAdjustment: number;
  /** Notes about seasonal impact */
  notes: string;
  /**
   * Optional: Running style favored during this season
   * 'E' = Early speed favored
   * 'C' = Closers favored
   * 'P' = Pressers/stalkers favored
   * null = No specific style advantage
   */
  favoredStyle?: 'E' | 'P' | 'C' | null;
  /**
   * Optional: Magnitude of style advantage (0-3)
   * 0 = No advantage, 1 = Slight, 2 = Moderate, 3 = Strong
   * Defaults to deriving from speedAdjustment if not specified
   */
  styleBiasMagnitude?: number;
}

/**
 * Average winning times by distance for par time calculations
 */
export interface WinningTimeByDistance {
  /** Distance identifier */
  distance: string;
  /** Distance in furlongs */
  furlongs: number;
  /** Surface type */
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather';
  /** Average winning time in seconds for claiming races ($25k-$50k) */
  claimingAvg: number;
  /** Average winning time in seconds for allowance races */
  allowanceAvg: number;
  /** Average winning time in seconds for stakes races */
  stakesAvg: number;
}

/**
 * Main track data interface containing all track intelligence
 */
export interface TrackData {
  /** Unique track code (e.g., "SA", "GP", "CD") */
  code: string;
  /** Full track name */
  name: string;
  /** City and state location */
  location: string;
  /** State abbreviation */
  state: string;
  /** Track measurements and dimensions */
  measurements: {
    dirt: TrackMeasurements;
    turf?: TrackMeasurements;
  };
  /** Post position biases by distance and surface */
  postPositionBias: {
    dirt: PostPositionBias[];
    turf?: PostPositionBias[];
  };
  /** Speed/pace bias data by surface */
  speedBias: SpeedBias[];
  /** Surface characteristics */
  surfaces: SurfaceCharacteristics[];
  /** Seasonal patterns */
  seasonalPatterns: SeasonalPattern[];
  /** Average winning times by distance */
  winningTimes: WinningTimeByDistance[];
  /** Last updated timestamp */
  lastUpdated: string;
  /** Data quality indicator */
  dataQuality: 'verified' | 'preliminary' | 'estimated';
}

/**
 * Simplified track bias summary for UI display
 */
export interface TrackBiasSummary {
  trackCode: string;
  trackName: string;
  speedBiasPercent: number;
  speedBiasDescription: string;
  favoredPostsDescription: string;
  isDataAvailable: boolean;
}
