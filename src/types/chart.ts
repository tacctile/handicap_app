/**
 * DRF Text Chart Type Definitions
 *
 * These interfaces define the structure of parsed DRF Text Chart files
 * (comma-delimited format from DRF's subscription service).
 * Used for backtesting predictions against actual race results.
 */

// ============================================================================
// CHART HEADER (H Record)
// ============================================================================

/**
 * Header record containing track and card metadata
 * Parsed from "H" record type
 */
export interface ChartHeader {
  /** Record type identifier (always "H") */
  recordType: 'H';

  /** Country code (e.g., "USA") - field 2 */
  countryCode: string;

  /** Track code (e.g., "SAR" for Saratoga) - field 3 */
  trackCode: string;

  /** Race date in YYYYMMDD format - field 4 */
  raceDate: string;

  /** Number of races on the card - field 5 */
  numberOfRaces: number;

  /** Full track name (e.g., "Saratoga") - field 7 */
  trackName: string;
}

// ============================================================================
// CHART RACE (R Record)
// ============================================================================

/**
 * Race record containing race-level information
 * Parsed from "R" record type
 */
export interface ChartRace {
  /** Record type identifier (always "R") */
  recordType: 'R';

  /** Race number (1-indexed) - field 2 */
  raceNumber: number;

  /** Breed code (e.g., "TB" for Thoroughbred) - field 3 */
  breedCode: string;

  /** Race type code (e.g., "MSW", "CLM", "ALW", "STK") - field 4 */
  raceType: string;

  /** Distance in feet - field 30 */
  distance: number;

  /** Distance in furlongs (calculated) */
  distanceFurlongs: number;

  /** Surface code ("D" = Dirt, "T" = Turf) - field 32 */
  surfaceCode: string;

  /** Surface description */
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather';

  /** Track condition (e.g., "Fast", "Firm", "Good") - field 43 */
  trackCondition: string;

  /** Array of starters in this race */
  starters: ChartStarter[];
}

// ============================================================================
// CHART STARTER (S Record)
// ============================================================================

/**
 * Starter record containing individual horse result data
 * Parsed from "S" record type
 */
export interface ChartStarter {
  /** Record type identifier (always "S") */
  recordType: 'S';

  /** Race number this starter belongs to - field 2 */
  raceNumber: number;

  /** Horse ID (unique identifier) - field 3 */
  horseId: string;

  /** Horse name - field 4 */
  horseName: string;

  /** Program number (may include letters like "1A") - field 43 */
  programNumber: string;

  /** Post position (1-indexed) - field 42 */
  postPosition: number;

  /** Official finish position (1 = winner, 99 = scratch) - field 51 */
  finishPosition: number;

  /** Whether the horse was scratched */
  isScratched: boolean;

  /** Morning line or final odds - field 37 */
  odds: number | null;

  /** Win payoff (for $2 bet) - field 68 */
  winPayoff: number | null;

  /** Place payoff (for $2 bet) - field 69 */
  placePayoff: number | null;

  /** Show payoff (for $2 bet) - field 70 */
  showPayoff: number | null;

  /** Lengths behind winner at finish - field 63 */
  lengthsBehind: number | null;

  /** Jockey name - field 24-25 */
  jockeyName: string;

  /** Trainer name - field 29-31 */
  trainerName: string;

  /** Raw line for debugging */
  rawLine?: string;
}

// ============================================================================
// PARSED CHART FILE (Complete structure)
// ============================================================================

/**
 * Complete parsed chart file structure
 */
export interface ParsedChartFile {
  /** Header record with track/date metadata */
  header: ChartHeader;

  /** Array of races with their starters */
  races: ChartRace[];

  /** Source filename */
  filename: string;

  /** Parse timestamp */
  parsedAt: string;

  /** Any warnings generated during parsing */
  warnings: ChartParseWarning[];
}

// ============================================================================
// PARSE WARNINGS
// ============================================================================

/**
 * Warning generated during chart parsing
 */
export interface ChartParseWarning {
  /** Line number where warning occurred */
  lineNumber: number;

  /** Warning message */
  message: string;

  /** Record type if applicable */
  recordType?: string;

  /** Raw line content (truncated) */
  rawContent?: string;
}

// ============================================================================
// BACKTESTING TYPES
// ============================================================================

/**
 * Result of matching a prediction to actual race result
 */
export interface MatchedResult {
  /** Horse name */
  horseName: string;

  /** Prediction rank (1 = top pick) */
  predictionRank: number;

  /** Predicted tier (1, 2, 3, or null for unranked) */
  predictionTier: number | null;

  /** Predicted score */
  predictionScore: number;

  /** Actual finish position */
  actualFinishPosition: number;

  /** Whether the horse was scratched */
  wasScratch: boolean;

  /** Actual odds at post time */
  actualOdds: number | null;

  /** Win payoff if won */
  winPayoff: number | null;

  /** Place payoff if placed */
  placePayoff: number | null;

  /** Show payoff if showed */
  showPayoff: number | null;

  /** Match confidence (1.0 = exact match, <1.0 = fuzzy match) */
  matchConfidence: number;
}

/**
 * Accuracy metrics calculated from matched results
 */
export interface AccuracyMetrics {
  /** Total races analyzed */
  totalRaces: number;

  /** Total matched predictions (non-scratched) */
  totalMatched: number;

  // Tier 1 Metrics
  /** Tier 1 win rate - top pick wins */
  tier1WinRate: number;

  /** Tier 1 wins count */
  tier1Wins: number;

  /** Tier 1 total (non-scratched) */
  tier1Total: number;

  /** Tier 1 top-3 rate - top pick finishes 1st/2nd/3rd */
  tier1Top3Rate: number;

  /** Tier 1 top-3 count */
  tier1Top3: number;

  // Tier 2 Metrics
  /** Tier 2 hit rate - any Tier 2 horse wins */
  tier2HitRate: number;

  /** Tier 2 wins count */
  tier2Wins: number;

  /** Tier 2 total races with Tier 2 horses */
  tier2Total: number;

  // Exacta Metrics
  /** Exacta hit rate - top 2 predictions finish 1-2 in either order */
  exactaHitRate: number;

  /** Exacta hits count */
  exactaHits: number;

  /** Exacta total attempts */
  exactaTotal: number;

  // ROI Metrics (optional, based on available payoff data)
  /** Win bet ROI based on $2 flat bets on Tier 1 */
  tier1WinROI?: number;

  /** Place bet ROI based on $2 flat bets on Tier 1 */
  tier1PlaceROI?: number;
}
