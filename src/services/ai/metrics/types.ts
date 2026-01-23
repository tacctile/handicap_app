/**
 * AI Metrics Type Definitions
 *
 * Types for tracking AI performance data and comparing against algorithm baseline.
 * Algorithm baseline: 16.2% win rate, 48.6% top-3, 33.3% exacta box 4, 37.8% trifecta box 5.
 */

// ============================================================================
// AI DECISION RECORD
// ============================================================================

/**
 * Complete record of an AI decision for a single race
 * Captures both algorithm and AI decisions for comparison
 */
export interface AIDecisionRecord {
  // Race identification
  /** Unique race identifier */
  raceId: string;
  /** Track code (e.g., "CD", "SAR") */
  trackCode: string;
  /** Race number within the card */
  raceNumber: number;
  /** Race date (ISO format YYYY-MM-DD) */
  raceDate: string;
  /** Number of horses in the field */
  fieldSize: number;

  // Algorithm baseline
  /** Algorithm's top pick (program number) */
  algorithmTopPick: number;
  /** Algorithm's top 3 picks (program numbers) */
  algorithmTop3: number[];
  /** Algorithm scores for all horses */
  algorithmScores: Array<{
    programNumber: number;
    score: number;
    rank: number;
  }>;

  // AI decisions
  /** AI's top pick (program number, adjusted rank 1) */
  aiTopPick: number;
  /** AI's value play (program number or null) */
  aiValuePlay: number | null;
  /** AI's top 3 picks (adjusted ranks 1-3) */
  aiTop3: number[];
  /** AI's avoid list (program numbers) */
  aiAvoidList: number[];
  /** AI's confidence level */
  aiConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';

  // Override tracking
  /** Whether AI top pick differs from algorithm top pick */
  isOverride: boolean;
  /** Reason for override if applicable */
  overrideReason: string | null;

  // Bot signals summary
  /** Horses flagged for trip trouble (program numbers) */
  tripTroubleHorses: number[];
  /** Horses with pace advantage (program numbers) */
  paceAdvantageHorses: number[];
  /** Whether favorite was flagged as vulnerable */
  vulnerableFavorite: boolean;
  /** Field type classification */
  fieldType: 'DOMINANT' | 'SEPARATED' | 'COMPETITIVE' | 'WIDE_OPEN';

  // Bet structure
  /** Recommended bet type */
  betType: 'KEY' | 'BOX' | 'WHEEL' | 'PASS';
  /** Horses in exacta construction */
  exactaHorses: number[];
  /** Horses in trifecta construction */
  trifectaHorses: number[];

  // Processing metadata
  /** Time to process analysis in milliseconds */
  processingTimeMs: number;
  /** When this record was created (ISO timestamp) */
  timestamp: string;

  // Outcomes (populated after race results)
  /** Actual winner (program number or null if not yet recorded) */
  actualWinner: number | null;
  /** Actual exacta result or null */
  actualExacta: [number, number] | null;
  /** Actual trifecta result or null */
  actualTrifecta: [number, number, number] | null;
  /** Whether results have been recorded */
  resultRecorded: boolean;
}

// ============================================================================
// AI PERFORMANCE METRICS
// ============================================================================

/**
 * Aggregated performance metrics comparing AI to algorithm baseline
 */
export interface AIPerformanceMetrics {
  // Sample size
  /** Total races analyzed */
  totalRaces: number;
  /** Races with results recorded */
  racesWithResults: number;

  // Win rate comparison
  /** Algorithm wins (top pick won) */
  algorithmWins: number;
  /** Algorithm win rate (percentage) */
  algorithmWinRate: number;
  /** AI wins (top pick won) */
  aiWins: number;
  /** AI win rate (percentage) */
  aiWinRate: number;

  // Top-3 comparison
  /** Algorithm top-3 hits (winner in top 3) */
  algorithmTop3Hits: number;
  /** Algorithm top-3 rate (percentage) */
  algorithmTop3Rate: number;
  /** AI top-3 hits (winner in top 3) */
  aiTop3Hits: number;
  /** AI top-3 rate (percentage) */
  aiTop3Rate: number;

  // Override tracking
  /** Total times AI overrode algorithm */
  totalOverrides: number;
  /** Override rate (percentage) */
  overrideRate: number;
  /** Wins when AI overrode algorithm (AI was right) */
  overrideWins: number;
  /** Win rate when overriding (percentage) */
  overrideWinRate: number;
  /** Wins when AI confirmed algorithm (both agreed) */
  confirmWins: number;
  /** Win rate when confirming (percentage) */
  confirmWinRate: number;

  // Exotic tracking
  /** Exacta box 2 hits */
  exactaBox2Hits: number;
  /** Exacta box 3 hits */
  exactaBox3Hits: number;
  /** Exacta box 4 hits */
  exactaBox4Hits: number;
  /** Trifecta box 3 hits */
  trifectaBox3Hits: number;
  /** Trifecta box 4 hits */
  trifectaBox4Hits: number;
  /** Trifecta box 5 hits */
  trifectaBox5Hits: number;

  // Value play tracking
  /** Number of value plays identified */
  valuePlaysIdentified: number;
  /** Value play wins */
  valuePlayWins: number;
  /** Value play win rate (percentage) */
  valuePlayWinRate: number;
  /** Average ML odds when value play won */
  valuePlayAvgOdds: number;

  // Confidence calibration
  /** Races marked HIGH confidence */
  highConfidenceRaces: number;
  /** Win rate for HIGH confidence races */
  highConfidenceWinRate: number;
  /** Races marked MEDIUM confidence */
  mediumConfidenceRaces: number;
  /** Win rate for MEDIUM confidence races */
  mediumConfidenceWinRate: number;
  /** Races marked LOW confidence */
  lowConfidenceRaces: number;
  /** Win rate for LOW confidence races */
  lowConfidenceWinRate: number;

  // Bot effectiveness
  /** Win rate when trip trouble boost was given to winner */
  tripTroubleBoostWinRate: number;
  /** Win rate when pace advantage was given to winner */
  paceAdvantageWinRate: number;
  /** Rate at which faded favorites actually lost */
  vulnerableFavoriteFadeRate: number;

  // Field type performance
  /** Win rate in DOMINANT fields */
  dominantFieldWinRate: number;
  /** Win rate in COMPETITIVE fields */
  competitiveFieldWinRate: number;
  /** Win rate in WIDE_OPEN fields */
  wideOpenFieldWinRate: number;
}

// ============================================================================
// RACE RESULTS INPUT
// ============================================================================

/**
 * Race results for updating decision records
 */
export interface RaceResults {
  /** Program number of winner */
  winner: number;
  /** Exacta result (1st, 2nd) */
  exacta: [number, number];
  /** Trifecta result (1st, 2nd, 3rd) */
  trifecta: [number, number, number];
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

/**
 * Options for metrics export
 */
export interface MetricsExportOptions {
  /** Include only races with results */
  resultsOnly?: boolean;
  /** Date range start (ISO format) */
  startDate?: string;
  /** Date range end (ISO format) */
  endDate?: string;
  /** Specific track codes to include */
  trackCodes?: string[];
}
