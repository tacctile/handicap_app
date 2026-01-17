/**
 * AI Service Type Definitions
 *
 * Single-bot architecture for race analysis.
 * The algorithm calculates scores — AI interprets those scores and produces
 * final rankings, value labels, and per-horse insights.
 */

// ============================================================================
// VALUE LABELS
// ============================================================================

/**
 * Value label that displays in UI
 * Indicates the betting value assessment for a horse
 */
export type ValueLabel =
  | 'BEST BET'
  | 'PRIME VALUE'
  | 'SOLID PLAY'
  | 'FAIR PRICE'
  | 'WATCH ONLY'
  | 'TOO SHORT'
  | 'NO VALUE'
  | 'SKIP'
  | 'NO CHANCE';

// ============================================================================
// HORSE INSIGHT
// ============================================================================

/**
 * Per-horse AI insight
 * Contains the AI's analysis and recommendations for a single horse
 */
export interface HorseInsight {
  /** Program number (saddle cloth) */
  programNumber: number;
  /** Horse name */
  horseName: string;
  /** Projected finish position (1 = winner) */
  projectedFinish: number;
  /** Value assessment label */
  valueLabel: ValueLabel;
  /** One-liner insight, e.g., "Lone speed, should wire if clean break" */
  oneLiner: string;
  /** Primary positive factor */
  keyStrength: string | null;
  /** Primary concern */
  keyWeakness: string | null;
  /** Whether horse is a legitimate contender */
  isContender: boolean;
  /** Whether to avoid betting this horse */
  avoidFlag: boolean;
}

// ============================================================================
// RACE ANALYSIS
// ============================================================================

/**
 * Complete AI analysis for a race
 * Contains narrative, insights, and betting guidance
 */
export interface AIRaceAnalysis {
  /** Unique identifier for the race */
  raceId: string;
  /** Race number */
  raceNumber: number;
  /** When analysis was generated */
  timestamp: string;
  /** How long the AI took to process */
  processingTimeMs: number;

  // Overall race assessment
  /** 2-3 sentences summarizing the race */
  raceNarrative: string;
  /** Confidence in the analysis */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Whether this race is worth betting */
  bettableRace: boolean;

  // Per-horse insights (ordered by projected finish)
  /** Array of insights for each horse */
  horseInsights: HorseInsight[];

  // Betting guidance
  /** Program number of top pick (null if no clear pick) */
  topPick: number | null;
  /** Program number of value play if different from top pick */
  valuePlay: number | null;
  /** Program numbers of horses to avoid */
  avoidList: number[];

  // Flags
  /** Whether the favorite appears vulnerable */
  vulnerableFavorite: boolean;
  /** Whether an upset is likely */
  likelyUpset: boolean;
  /** Whether race is too unpredictable to bet confidently */
  chaoticRace: boolean;
}

// ============================================================================
// SERVICE STATUS
// ============================================================================

/**
 * AI service status
 */
export type AIServiceStatus = 'ready' | 'processing' | 'offline' | 'error';

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error codes from AI service
 */
export type AIServiceErrorCode =
  | 'API_KEY_MISSING'
  | 'API_ERROR'
  | 'PARSE_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR';

/**
 * Error from AI service
 */
export interface AIServiceError {
  /** Error code for programmatic handling */
  code: AIServiceErrorCode;
  /** Human-readable error message */
  message: string;
  /** When the error occurred */
  timestamp: string;
}
