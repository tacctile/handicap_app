/**
 * Validation Test Type Definitions
 *
 * Detailed interfaces for capturing race-by-race comparison data
 * for pattern analysis of AI vs Algorithm disagreements.
 */

// ============================================================================
// DETAILED RACE RESULT
// ============================================================================

/**
 * Complete detailed result for a single race
 * Captures all data needed for disagreement pattern analysis
 */
export interface DetailedRaceResult {
  // Race identification
  trackCode: string;
  trackName: string;
  raceNumber: number;
  date: string;
  surface: string;
  distance: string;
  distanceFurlongs: number;
  fieldSize: number;
  raceClass: string;

  // Algorithm pick details
  algorithmPick: {
    postPosition: number;
    horseName: string;
    score: number;
    tier: 1 | 2 | 3 | 0; // 0 = pass
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    topCategories: string[]; // top 3 scoring categories
    scoreMargin: number; // gap to 2nd place
  };

  // AI pick details
  aiPick: {
    postPosition: number | null;
    horseName: string | null;
    algorithmScore: number | null; // what algorithm gave this horse
    algorithmRank: number | null;
    tier: 1 | 2 | 3 | 0;
    reasoning: string; // AI's narrative explanation
    overrideType: 'CONFIRM' | 'OVERRIDE' | 'PASS';
    topPickOneLiner: string | null;
    keyStrength: string | null;
    keyWeakness: string | null;
  };

  // Actual result
  winner: {
    postPosition: number;
    horseName: string;
    algorithmScore: number;
    algorithmRank: number;
    algorithmTier: 1 | 2 | 3 | 0;
    odds: string;
    wasAlgorithmPick: boolean;
    wasAiPick: boolean;
  };

  // Analysis flags
  agreement: boolean;
  outcome: 'BOTH_CORRECT' | 'BOTH_WRONG' | 'AI_CORRECT' | 'ALGO_CORRECT';

  // Multi-bot signals (if available)
  botSignals: {
    tripTrouble: string | null;
    tripTroubleHorses: Array<{ post: number; name: string; issue: string }>;
    paceProjection: 'HOT' | 'MODERATE' | 'SLOW' | null;
    loneSpeedException: boolean;
    speedDuelLikely: boolean;
    vulnerableFavorite: boolean;
    vulnerableFavoriteReasons: string[];
    fieldType: 'TIGHT' | 'SEPARATED' | 'MIXED' | null;
    topTierCount: number | null;
  };

  // Timing
  aiProcessingMs: number;

  // AI confidence
  aiConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  aiFlaggedVulnerableFavorite: boolean;
  aiFlaggedLikelyUpset: boolean;
}

// ============================================================================
// DISAGREEMENT RESULTS
// ============================================================================

/**
 * Filtered disagreement results for analysis
 */
export interface DisagreementResults {
  /** Races where AI disagreed with algorithm AND AI was correct */
  aiDisagreedAndWon: DetailedRaceResult[];
  /** Races where AI disagreed with algorithm AND AI was wrong */
  aiDisagreedAndLost: DetailedRaceResult[];
  /** Same as aiDisagreedAndLost - algorithm was right when they disagreed */
  algorithmWonDisagreement: DetailedRaceResult[];
}

// ============================================================================
// VALIDATION RESULTS FILE
// ============================================================================

/**
 * Complete validation results file structure
 */
export interface ValidationResultsFile {
  /** When results were generated */
  generatedAt: string;
  /** Version of the validation test */
  version: string;

  /** Summary statistics */
  summary: {
    totalRaces: number;
    totalProcessingTimeMs: number;
    averageProcessingTimeMs: number;

    algorithm: {
      winRate: number;
      top3Rate: number;
      exactaRate: number;
      trifectaRate: number;
      wins: number;
      top3Hits: number;
      exactaHits: number;
      trifectaHits: number;
    };

    ai: {
      winRate: number;
      top3Rate: number;
      exactaRate: number;
      trifectaRate: number;
      wins: number;
      top3Hits: number;
      exactaHits: number;
      trifectaHits: number;
      skippedRaces: number;
    };

    comparison: {
      agreedCount: number;
      agreedBothCorrect: number;
      agreedBothWrong: number;
      disagreedCount: number;
      aiDisagreedAndWon: number;
      aiDisagreedAndLost: number;
      algorithmWonDisagreement: number;
    };

    aiFlags: {
      vulnerableFavoritesCalled: number;
      vulnerableFavoritesCorrect: number;
      likelyUpsetsCalled: number;
      likelyUpsetsCorrect: number;
    };
  };

  /** Detailed race-by-race results */
  detailedResults: DetailedRaceResult[];

  /** Pre-filtered disagreement results for quick access */
  disagreements: DisagreementResults;
}

// ============================================================================
// ANALYSIS HELPERS
// ============================================================================

/**
 * Pattern grouping for analysis
 */
export interface PatternGroup {
  label: string;
  count: number;
  races: DetailedRaceResult[];
  winRate: number;
}

/**
 * Analysis summary by grouping
 */
export interface AnalysisByGroup {
  byTrack: PatternGroup[];
  bySurface: PatternGroup[];
  byDistance: PatternGroup[];
  byConfidence: PatternGroup[];
  byScoreDifferential: PatternGroup[];
  byFieldSize: PatternGroup[];
  byOverrideType: PatternGroup[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determine betting tier from score
 */
export function getTierFromScore(score: number): 1 | 2 | 3 | 0 {
  if (score >= 180) return 1;
  if (score >= 160) return 2;
  if (score >= 140) return 3;
  return 0;
}

/**
 * Get top scoring categories from breakdown
 */
export function getTopCategories(breakdown: {
  speedScore: number;
  classScore: number;
  formScore: number;
  paceScore: number;
  connectionScore: number;
}): string[] {
  const categories = [
    { name: 'Speed', score: breakdown.speedScore },
    { name: 'Class', score: breakdown.classScore },
    { name: 'Form', score: breakdown.formScore },
    { name: 'Pace', score: breakdown.paceScore },
    { name: 'Connections', score: breakdown.connectionScore },
  ];

  return categories
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => `${c.name}: ${c.score}`);
}

/**
 * Determine outcome category
 */
export function determineOutcome(
  algorithmCorrect: boolean,
  aiCorrect: boolean,
  agreed: boolean
): DetailedRaceResult['outcome'] {
  if (agreed) {
    return algorithmCorrect ? 'BOTH_CORRECT' : 'BOTH_WRONG';
  }
  if (aiCorrect) return 'AI_CORRECT';
  if (algorithmCorrect) return 'ALGO_CORRECT';
  return 'BOTH_WRONG';
}

/**
 * Filter results for disagreements
 * Uses same logic as summary: aiPick !== null && aiPick !== algorithmPick && (outcome check)
 */
export function getDisagreements(results: DetailedRaceResult[]): DisagreementResults {
  // Must check aiPick.postPosition !== null to match summary's explicit aiPick !== null check
  const aiDisagreedAndWon = results.filter(
    (r) => r.aiPick.postPosition !== null && !r.agreement && r.outcome === 'AI_CORRECT'
  );
  const aiDisagreedAndLost = results.filter(
    (r) => r.aiPick.postPosition !== null && !r.agreement && r.outcome === 'ALGO_CORRECT'
  );

  return {
    aiDisagreedAndWon,
    aiDisagreedAndLost,
    algorithmWonDisagreement: aiDisagreedAndLost,
  };
}

/**
 * Categorize distance as sprint or route
 */
export function categorizeDistance(furlongs: number): 'sprint' | 'route' {
  return furlongs < 8 ? 'sprint' : 'route';
}

/**
 * Categorize field size
 */
export function categorizeFieldSize(size: number): 'small' | 'medium' | 'large' {
  if (size <= 6) return 'small';
  if (size <= 10) return 'medium';
  return 'large';
}

/**
 * Categorize score differential
 */
export function categorizeScoreDiff(margin: number): 'tight' | 'moderate' | 'dominant' {
  if (margin < 10) return 'tight';
  if (margin < 25) return 'moderate';
  return 'dominant';
}
