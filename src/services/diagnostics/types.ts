/**
 * Diagnostics Service Types
 *
 * TypeScript interfaces for the hidden diagnostics dashboard that
 * analyzes algorithm predictions against actual race results.
 */

// ============================================================================
// ANALYSIS STATUS
// ============================================================================

/** Current state of the diagnostics analysis pipeline */
export type AnalysisStatus = 'idle' | 'running' | 'complete' | 'error';

// ============================================================================
// RACE RESULT PARSING
// ============================================================================

/** Parsed finish position from a results file */
export interface FinishPosition {
  /** 1-indexed finish position (1st, 2nd, 3rd, 4th) */
  position: number;
  /** Post position number */
  post: number;
  /** Horse name as listed in results */
  horseName: string;
}

/** Parsed result for a single race */
export interface RaceResult {
  /** Race number within the card */
  raceNumber: number;
  /** Finish positions (1st through 4th) */
  positions: FinishPosition[];
  /** Scratched horses */
  scratches: { post: number; horseName: string }[];
}

// ============================================================================
// PREDICTION RECORD (for per-rank and calibration charts)
// ============================================================================

/** Minimal prediction record for per-rank win-rate and calibration analysis */
export interface PredictionRecord {
  /** Algorithm rank among active horses (1 = top pick) */
  algorithmRank: number;
  /** Actual finish position (1–4, or 0 if worse than 4th) */
  actualFinish: number;
  /** Track code for per-track filtering */
  trackCode: string;
  /** Tier classification (1, 2, 3, or 0 if below all tiers) */
  tier: number;
  /** Individual scoring category scores for winners vs field analysis */
  categoryScores?: {
    speed: number;
    class: number;
    form: number;
    pace: number;
    connections: number;
  };
}

// ============================================================================
// PREDICTION ACCURACY
// ============================================================================

/** Comparison of algorithm prediction vs actual result for one horse */
export interface PredictionAccuracy {
  /** Horse name */
  horseName: string;
  /** Post position */
  postPosition: number;
  /** Algorithm rank (1 = top pick) */
  algorithmRank: number;
  /** Algorithm base score */
  algorithmScore: number;
  /** Actual finish position (1-indexed, 0 if didn't finish top 4) */
  actualFinish: number;
  /** Whether this horse was the algorithm's top pick */
  wasTopPick: boolean;
  /** Whether the top pick won */
  topPickWon: boolean;
  /** Whether the top pick placed (1st or 2nd) */
  topPickPlaced: boolean;
  /** Whether the top pick showed (1st, 2nd, or 3rd) */
  topPickShowed: boolean;
}

// ============================================================================
// TIER PERFORMANCE
// ============================================================================

/** Performance metrics for a betting tier */
export interface TierPerformance {
  /** Tier name */
  tierName: string;
  /** Tier label (e.g., "Tier 1 — Cover Chalk") */
  tierLabel: string;
  /** Number of horses classified in this tier */
  horseCount: number;
  /** Win rate percentage */
  winRate: number;
  /** In-the-money rate percentage (1st/2nd/3rd) */
  itmRate: number;
  /** Number of wins */
  wins: number;
  /** Number of ITM finishes */
  itmFinishes: number;
  /** Plain-English tooltip for this tier */
  tooltip: string;
}

// ============================================================================
// TRACK SUMMARY
// ============================================================================

/** Per-track breakdown of algorithm performance */
export interface TrackSummary {
  /** Track code (e.g., "AQU") */
  trackCode: string;
  /** Full track name if available */
  trackName: string;
  /** Number of races at this track */
  raceCount: number;
  /** Number of horses scored at this track */
  horseCount: number;
  /** Top pick win rate at this track */
  topPickWinRate: number;
  /** Top pick ITM rate at this track */
  topPickITMRate: number;
  /** Date range string (e.g., "Dec 24 - Dec 28") */
  dateRange: string;
  /** Number of top pick wins */
  topPickWins: number;
  /** Number of top pick ITM finishes */
  topPickITM: number;
}

// ============================================================================
// FILE PAIR
// ============================================================================

/** A paired DRF file with its matching results file */
export interface FilePair {
  /** Track code extracted from filename (e.g., "AQU1228") */
  trackCode: string;
  /** Raw DRF file content */
  drfContent: string;
  /** Raw results file content */
  resultsContent: string;
  /** DRF filename */
  drfFilename: string;
}

// ============================================================================
// CACHE METADATA
// ============================================================================

/** Metadata stored alongside cached results for invalidation */
export interface CacheMetadata {
  /** Hash of all DRF + results filenames for change detection */
  contentHash: string;
  /** When the analysis was last run */
  timestamp: number;
  /** Version of the diagnostics service for cache busting */
  version: string;
}

// ============================================================================
// PROGRESS
// ============================================================================

/** Progress update during analysis */
export interface AnalysisProgress {
  /** Current file being processed */
  currentFile: string;
  /** Number of files processed so far */
  filesProcessed: number;
  /** Total number of files to process */
  totalFiles: number;
  /** Percentage complete (0-100) */
  percentComplete: number;
}

// ============================================================================
// DIAGNOSTICS RESULTS
// ============================================================================

/** Complete diagnostics analysis output */
export interface DiagnosticsResults {
  // --- Dataset Overview ---
  /** Total number of DRF files analyzed */
  totalFiles: number;
  /** Total number of races analyzed */
  totalRaces: number;
  /** Total number of horses scored */
  totalHorses: number;
  /** Number of tracks represented */
  totalTracks: number;
  /** Date range of data (e.g., "Aug 21, 2024 — Dec 30, 2024") */
  dateRange: string;

  // --- Top Pick Performance ---
  /** Win rate for the #1 ranked horse */
  topPickWinRate: number;
  /** Place rate for the #1 ranked horse (1st or 2nd) */
  topPickPlaceRate: number;
  /** Show rate for the #1 ranked horse (1st, 2nd, or 3rd) */
  topPickShowRate: number;
  /** Number of top pick wins */
  topPickWins: number;
  /** Number of top pick places */
  topPickPlaces: number;
  /** Number of top pick shows */
  topPickShows: number;
  /** Number of valid races (with results and enough data) */
  validRaces: number;

  // --- Tier Performance ---
  /** Performance breakdown by tier */
  tierPerformance: TierPerformance[];

  // --- Per-Track Breakdown ---
  /** Performance breakdown by track */
  trackSummaries: TrackSummary[];

  // --- Exotic Bet Performance ---
  /** Exacta box hit rates */
  exactaBox2Rate: number;
  exactaBox3Rate: number;
  exactaBox4Rate: number;
  /** Trifecta box hit rates */
  trifectaBox3Rate: number;
  trifectaBox4Rate: number;
  trifectaBox5Rate: number;
  /** Superfecta box hit rates */
  superfectaBox4Rate: number;
  superfectaBox5Rate: number;
  superfectaBox6Rate: number;

  // --- Per-Horse Predictions ---
  /** Individual prediction records for per-rank and calibration analysis */
  predictions: PredictionRecord[];

  // --- Metadata ---
  /** When this analysis was run (ISO timestamp) */
  analyzedAt: string;
  /** How long the analysis took in milliseconds */
  analysisTimeMs: number;
  /** DRF files that had no matching results file */
  unmatchedFiles: string[];
}
