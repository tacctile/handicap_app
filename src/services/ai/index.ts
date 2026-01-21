/**
 * AI Service Index
 *
 * Main entry point for the AI race analysis service.
 * Provides caching and status checking functionality.
 * Supports both single-bot and multi-bot parallel architectures.
 */

import {
  analyzeRaceWithGemini,
  analyzeTripTrouble,
  analyzePaceScenario,
  analyzeVulnerableFavorite,
  analyzeFieldSpread,
} from './gemini';
import type { ParsedRace } from '../../types/drf';
import type { RaceScoringResult } from '../../types/scoring';
import type {
  AIRaceAnalysis,
  AIServiceStatus,
  AIServiceConfig,
  MultiBotRawResults,
  AggregatedSignals,
  BetRecommendation,
  RankChange,
  PaceScenarioAnalysis,
  VulnerableFavoriteAnalysis,
  FieldSpreadAnalysis,
} from './types';

// ============================================================================
// DEBUG LOGGING (production-safe)
// ============================================================================

// Debug logging - only in development
const DEBUG = typeof process !== 'undefined' ? process.env?.NODE_ENV !== 'production' : true;
const debugLog = (...args: unknown[]): void => {
  if (DEBUG) console.log(...args);
};
const debugError = (...args: unknown[]): void => {
  if (DEBUG) console.error(...args);
};

// Re-export types for consumers
export type {
  AIRaceAnalysis,
  AIServiceStatus,
  AIServiceError,
  AIServiceErrorCode,
  ValueLabel,
  HorseInsight,
  AIServiceConfig,
  MultiBotRawResults,
  TripTroubleAnalysis,
  PaceScenarioAnalysis,
  VulnerableFavoriteAnalysis,
  FieldSpreadAnalysis,
  HorseClassification,
  HorseClassificationData,
  AggregatedSignals,
  BetRecommendation,
  BetStructureType,
  RankChange,
} from './types';

// Re-export the analyzeRaceWithGemini function for direct access (single-bot)
export { analyzeRaceWithGemini } from './gemini';

// Re-export multi-bot functions for direct access
export {
  analyzeTripTrouble,
  analyzePaceScenario,
  analyzeVulnerableFavorite,
  analyzeFieldSpread,
  callGeminiWithSchema,
  parseTripTroubleResponse,
  parsePaceScenarioResponse,
  parseVulnerableFavoriteResponse,
  parseFieldSpreadResponse,
} from './gemini';

// Re-export prompt builders for testing
export {
  buildRaceAnalysisPrompt,
  buildTripTroublePrompt,
  buildPaceScenarioPrompt,
  buildVulnerableFavoritePrompt,
  buildFieldSpreadPrompt,
} from './prompt';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Default configuration - single-bot mode for backwards compatibility */
const defaultConfig: AIServiceConfig = {
  useMultiBot: false,
};

/** Current service configuration */
let currentConfig: AIServiceConfig = { ...defaultConfig };

/**
 * Configure the AI service mode
 *
 * @param config - Configuration options
 */
export function configureAIService(config: Partial<AIServiceConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Get current AI service configuration
 *
 * @returns Current configuration
 */
export function getAIServiceConfig(): AIServiceConfig {
  return { ...currentConfig };
}

// ============================================================================
// CACHING
// ============================================================================

/** Simple in-memory cache for race analyses */
const analysisCache = new Map<string, AIRaceAnalysis>();

/**
 * Generate cache key for a race analysis
 * Includes trackCode to prevent cache collisions across different tracks
 */
function getCacheKey(raceNumber: number, trackCode: string, scoringVersion: number): string {
  return `${trackCode}-${raceNumber}-${scoringVersion}`;
}

/**
 * Get AI analysis for a race. Uses cache if available.
 *
 * @param race - Parsed race data from DRF file
 * @param scoringResult - Algorithm scoring results
 * @param options - Configuration options
 * @returns AIRaceAnalysis with insights and rankings
 */
export async function getAIAnalysis(
  race: ParsedRace,
  scoringResult: RaceScoringResult,
  options?: { forceRefresh?: boolean; scoringVersion?: number }
): Promise<AIRaceAnalysis> {
  const cacheKey = getCacheKey(
    race.header.raceNumber,
    race.header.trackCode,
    options?.scoringVersion ?? 0
  );

  // Return cached if available and not forcing refresh
  if (!options?.forceRefresh && analysisCache.has(cacheKey)) {
    return analysisCache.get(cacheKey)!;
  }

  // Fetch new analysis
  const analysis = await analyzeRaceWithGemini(race, scoringResult);

  // Cache it
  analysisCache.set(cacheKey, analysis);

  return analysis;
}

/**
 * Clear cache for a specific race (call when race state changes)
 *
 * @param raceNumber - Race number to invalidate
 */
export function invalidateRaceAnalysis(raceNumber: number): void {
  // Clear all versions for this race
  for (const key of analysisCache.keys()) {
    if (key.startsWith(`${raceNumber}-`)) {
      analysisCache.delete(key);
    }
  }
}

/**
 * Clear entire cache
 */
export function clearAnalysisCache(): void {
  analysisCache.clear();
}

// ============================================================================
// SERVICE STATUS
// ============================================================================

/**
 * Check if AI service is available
 *
 * Environment-aware status check:
 * - Browser: Checks network connectivity, serverless handles API key
 * - Node.js/Tests: Checks for direct API key in environment
 *
 * @returns Current service status
 */
export function checkAIServiceStatus(): AIServiceStatus {
  // Check browser network status if available
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'offline';
  }

  // Node.js environment: check for direct API key
  if (typeof window === 'undefined' && typeof process !== 'undefined') {
    const hasKey = !!(process.env?.VITE_GEMINI_API_KEY || process.env?.GEMINI_API_KEY);
    debugLog('[AI] Node.js environment detected');
    debugLog('[AI] Direct API key available:', hasKey);
    if (!hasKey) {
      debugError(
        '[AI] No API key found. Set VITE_GEMINI_API_KEY or GEMINI_API_KEY environment variable.'
      );
    }
    return hasKey ? 'ready' : 'offline';
  }

  // Browser with serverless: assume ready
  // Actual errors will be caught when calls are made
  return 'ready';
}

// ============================================================================
// MULTI-BOT PARALLEL ARCHITECTURE
// ============================================================================

/**
 * Get AI analysis using multi-bot parallel architecture
 *
 * Launches 4 specialized bots in parallel:
 * 1. Trip Trouble Bot - Identifies horses with masked ability
 * 2. Pace Scenario Bot - Analyzes pace dynamics
 * 3. Vulnerable Favorite Bot - Evaluates if favorite is beatable
 * 4. Field Spread Bot - Assesses competitive separation
 *
 * Results are combined into the standard AIRaceAnalysis format.
 *
 * @param race - Parsed race data from DRF file
 * @param scoringResult - Algorithm scoring results
 * @param options - Configuration options
 * @returns AIRaceAnalysis with combined multi-bot insights
 */
export async function getMultiBotAnalysis(
  race: ParsedRace,
  scoringResult: RaceScoringResult,
  options?: { forceRefresh?: boolean; scoringVersion?: number }
): Promise<AIRaceAnalysis> {
  const startTime = Date.now();
  const cacheKey = `multi-${race.header.trackCode}-${race.header.raceNumber}-${options?.scoringVersion ?? 0}`;

  // Return cached if available and not forcing refresh
  if (!options?.forceRefresh && analysisCache.has(cacheKey)) {
    return analysisCache.get(cacheKey)!;
  }

  // Launch all 4 bots in parallel with Promise.allSettled
  // Wrap each in try/catch with detailed error logging
  const [tripResult, paceResult, favoriteResult, spreadResult] = await Promise.allSettled([
    analyzeTripTrouble(race, scoringResult).catch((err) => {
      debugError(`TripTrouble bot error:`, err?.message || err);
      throw err;
    }),
    analyzePaceScenario(race, scoringResult).catch((err) => {
      debugError(`PaceScenario bot error:`, err?.message || err);
      throw err;
    }),
    analyzeVulnerableFavorite(race, scoringResult).catch((err) => {
      debugError(`VulnerableFavorite bot error:`, err?.message || err);
      throw err;
    }),
    analyzeFieldSpread(race, scoringResult).catch((err) => {
      debugError(`FieldSpread bot error:`, err?.message || err);
      throw err;
    }),
  ]);

  // Extract results, handling failures gracefully with detailed error logging
  const rawResults: MultiBotRawResults = {
    tripTrouble: tripResult.status === 'fulfilled' ? tripResult.value : null,
    paceScenario: paceResult.status === 'fulfilled' ? paceResult.value : null,
    vulnerableFavorite: favoriteResult.status === 'fulfilled' ? favoriteResult.value : null,
    fieldSpread: spreadResult.status === 'fulfilled' ? spreadResult.value : null,
  };

  // Log detailed failure information (dev only)
  if (tripResult.status === 'rejected') {
    debugError(`TripTrouble bot FAILED - Reason:`, tripResult.reason?.message || tripResult.reason);
  }
  if (paceResult.status === 'rejected') {
    debugError(
      `PaceScenario bot FAILED - Reason:`,
      paceResult.reason?.message || paceResult.reason
    );
  }
  if (favoriteResult.status === 'rejected') {
    debugError(
      `VulnerableFavorite bot FAILED - Reason:`,
      favoriteResult.reason?.message || favoriteResult.reason
    );
  }
  if (spreadResult.status === 'rejected') {
    debugError(
      `FieldSpread bot FAILED - Reason:`,
      spreadResult.reason?.message || spreadResult.reason
    );
  }

  // Combine into AIRaceAnalysis
  const analysis = combineMultiBotResults(rawResults, race, scoringResult, Date.now() - startTime);

  // Cache it
  analysisCache.set(cacheKey, analysis);

  return analysis;
}

// ============================================================================
// SMART COMBINER - SIGNAL AGGREGATION & BET SYNTHESIS
// ============================================================================

/**
 * Aggregate all bot signals for a single horse
 * Collects signals from all 4 bots and calculates total adjustment
 *
 * @param programNumber - Horse's program number
 * @param horseName - Horse name
 * @param algorithmRank - Original algorithm rank
 * @param algorithmScore - Original algorithm score
 * @param rawResults - Raw results from all 4 bots
 * @param race - Parsed race data
 * @returns Aggregated signals for this horse
 */
export function aggregateHorseSignals(
  programNumber: number,
  horseName: string,
  algorithmRank: number,
  algorithmScore: number,
  rawResults: MultiBotRawResults,
  race: ParsedRace
): AggregatedSignals {
  const { tripTrouble, paceScenario, vulnerableFavorite, fieldSpread } = rawResults;

  // Initialize signals with defaults
  const signals: AggregatedSignals = {
    programNumber,
    horseName,
    algorithmRank,
    algorithmScore,
    tripTroubleBoost: 0,
    hiddenAbility: null,
    paceAdvantage: 0,
    paceEdgeReason: null,
    isVulnerable: false,
    vulnerabilityFlags: [],
    classification: 'B', // Default to B if no field spread data
    keyCandidate: false,
    spreadOnly: false,
    totalAdjustment: 0,
    adjustedRank: algorithmRank,
    signalCount: 0,
    conflictingSignals: false,
  };

  // =========================================================================
  // TRIP TROUBLE SIGNALS
  // =========================================================================
  if (tripTrouble) {
    const tripHorse = tripTrouble.horsesWithTripTrouble.find(
      (h) => h.programNumber === programNumber
    );
    if (tripHorse) {
      const issueLower = tripHorse.issue.toLowerCase();

      // Check for multiple troubled races (HIGH confidence)
      const hasTwoOrMoreTroubledRaces =
        issueLower.includes('2 of') ||
        issueLower.includes('two of') ||
        issueLower.includes('twice') ||
        issueLower.includes('both') ||
        issueLower.includes('multiple') ||
        issueLower.includes('2 races') ||
        issueLower.includes('two races') ||
        issueLower.includes('last 2') ||
        issueLower.includes('last two') ||
        issueLower.includes('2 out of') ||
        issueLower.includes('2/3') ||
        issueLower.includes('3/3') ||
        issueLower.includes('consecutive');

      if (tripHorse.maskedAbility) {
        // HIGH confidence: 2+ troubled races
        if (hasTwoOrMoreTroubledRaces) {
          signals.tripTroubleBoost = 2;
          signals.hiddenAbility = `+5-8 Beyer masked - ${tripHorse.issue}`;
        } else {
          // MEDIUM confidence: 1 troubled race
          signals.tripTroubleBoost = 1;
          signals.hiddenAbility = tripHorse.issue;
        }
        signals.signalCount++;
      }
    }
  }

  // =========================================================================
  // PACE SCENARIO SIGNALS
  // =========================================================================
  if (paceScenario) {
    const horse = race.horses.find((h) => h.programNumber === programNumber);
    const style = horse?.runningStyle?.toLowerCase() || '';
    const isEarlySpeed = style === 'e' || style === 'e/p' || style.includes('early');
    const isCloser = style === 'c' || style.includes('closer');
    const isStalker = style === 's' || style === 'p' || style.includes('stalk');

    // Lone speed exception - STRONG advantage (+2)
    if (paceScenario.loneSpeedException && isEarlySpeed) {
      signals.paceAdvantage = 2;
      signals.paceEdgeReason = 'Lone speed on speed-favoring track';
      signals.signalCount++;
    }
    // Speed duel + HOT pace benefits closers (+1)
    else if (paceScenario.speedDuelLikely && paceScenario.paceProjection === 'HOT' && isCloser) {
      signals.paceAdvantage = 1;
      signals.paceEdgeReason = 'Speed duel sets up for closing kick';
      signals.signalCount++;
    }
    // Speed duel + HOT pace HURTS early speed (-1)
    else if (
      paceScenario.speedDuelLikely &&
      paceScenario.paceProjection === 'HOT' &&
      isEarlySpeed
    ) {
      signals.paceAdvantage = -1;
      signals.paceEdgeReason = 'Speed duel likely - pace hurts early speed';
      signals.signalCount++;
    }
    // SLOW pace helps stalkers moderately (+1)
    else if (
      paceScenario.paceProjection === 'SLOW' &&
      isStalker &&
      !paceScenario.loneSpeedException
    ) {
      signals.paceAdvantage = 1;
      signals.paceEdgeReason = 'Slow pace favors pressing style';
      signals.signalCount++;
    }
  }

  // =========================================================================
  // VULNERABLE FAVORITE SIGNALS (only for rank 1 / betting favorite)
  // =========================================================================
  if (vulnerableFavorite && vulnerableFavorite.isVulnerable) {
    // Find the betting favorite (lowest ML odds)
    const favoriteHorse = race.horses.reduce((fav, curr) => {
      const favOdds = parseFloat(fav?.morningLineOdds?.replace('-', '.') || '99');
      const currOdds = parseFloat(curr?.morningLineOdds?.replace('-', '.') || '99');
      return currOdds < favOdds ? curr : fav;
    }, race.horses[0]);

    if (favoriteHorse?.programNumber === programNumber && algorithmRank === 1) {
      signals.isVulnerable = true;
      signals.vulnerabilityFlags = vulnerableFavorite.reasons;
      signals.signalCount++;
    }
  }

  // =========================================================================
  // FIELD SPREAD SIGNALS
  // =========================================================================
  if (fieldSpread) {
    // Check for per-horse classifications
    const horseClassification = fieldSpread.horseClassifications?.find(
      (h) => h.programNumber === programNumber
    );

    if (horseClassification) {
      signals.classification = horseClassification.classification;
      signals.keyCandidate = horseClassification.keyCandidate;
      signals.spreadOnly = horseClassification.spreadOnly;
    } else {
      // Infer classification from algorithm rank and field type
      if (
        algorithmRank === 1 &&
        (fieldSpread.fieldType === 'DOMINANT' || fieldSpread.fieldType === 'SEPARATED')
      ) {
        signals.classification = 'A';
        signals.keyCandidate = true;
      } else if (algorithmRank <= fieldSpread.topTierCount) {
        signals.classification = 'A';
      } else if (
        algorithmRank <= Math.ceil(race.horses.filter((h) => !h.isScratched).length * 0.6)
      ) {
        signals.classification = 'B';
      } else {
        signals.classification = 'C';
      }
    }
  }

  // =========================================================================
  // CALCULATE TOTAL ADJUSTMENT (capped at ±3)
  // =========================================================================

  // Trip trouble: +1 (MEDIUM) or +2 (HIGH)
  let totalAdj = signals.tripTroubleBoost;

  // Pace advantage: +1 (MODERATE) or +2 (STRONG), -1 if pace hurts
  totalAdj += signals.paceAdvantage;

  // Vulnerable favorite penalty: -1 (MEDIUM) or -2 (HIGH) for rank 1 only
  if (signals.isVulnerable && vulnerableFavorite) {
    if (vulnerableFavorite.confidence === 'HIGH') {
      totalAdj -= 2;
    } else if (vulnerableFavorite.confidence === 'MEDIUM') {
      totalAdj -= 1;
    }
  }

  // Cap at ±3
  signals.totalAdjustment = Math.max(-3, Math.min(3, totalAdj));

  // =========================================================================
  // DETECT CONFLICTING SIGNALS
  // =========================================================================
  // Horse gets pace boost but is marked EXCLUDE by field spread
  if (signals.paceAdvantage > 0 && signals.classification === 'EXCLUDE') {
    signals.conflictingSignals = true;
  }
  // Horse is vulnerable favorite but also has trip trouble boost
  if (signals.isVulnerable && signals.tripTroubleBoost > 0) {
    signals.conflictingSignals = true;
  }
  // Horse has pace advantage but also pace disadvantage (shouldn't happen, but check)
  if (signals.tripTroubleBoost > 0 && signals.paceAdvantage < 0) {
    signals.conflictingSignals = true;
  }

  return signals;
}

/**
 * Reorder horses by adjusted rank and track rank changes
 *
 * @param aggregatedSignals - Array of aggregated signals for all horses
 * @returns Object with reordered signals and rank changes
 */
export function reorderByAdjustedRank(aggregatedSignals: AggregatedSignals[]): {
  reorderedSignals: AggregatedSignals[];
  rankChanges: RankChange[];
} {
  const fieldSize = aggregatedSignals.length;
  const rankChanges: RankChange[] = [];

  // Calculate adjusted ranks
  // Positive adjustment = move up = lower rank number
  // Negative adjustment = move down = higher rank number
  for (const signal of aggregatedSignals) {
    const rawAdjustedRank = signal.algorithmRank - signal.totalAdjustment;
    signal.adjustedRank = Math.max(1, Math.min(fieldSize, rawAdjustedRank));
  }

  // Sort by adjusted rank with tiebreakers
  const reorderedSignals = [...aggregatedSignals].sort((a, b) => {
    // Primary: adjusted rank
    if (a.adjustedRank !== b.adjustedRank) {
      return a.adjustedRank - b.adjustedRank;
    }
    // Secondary: higher total adjustment wins (earned their position)
    if (a.totalAdjustment !== b.totalAdjustment) {
      return b.totalAdjustment - a.totalAdjustment;
    }
    // Tertiary: higher algorithm score wins
    return b.algorithmScore - a.algorithmScore;
  });

  // Track rank changes
  reorderedSignals.forEach((signal, newIndex) => {
    const newRank = newIndex + 1;
    const oldRank = signal.algorithmRank;

    if (newRank !== oldRank) {
      let reason = '';
      if (signal.tripTroubleBoost > 0 && signal.paceAdvantage > 0) {
        reason = 'trip trouble + pace fit';
      } else if (signal.tripTroubleBoost > 0) {
        reason = 'trip trouble';
      } else if (signal.paceAdvantage > 0) {
        reason = 'pace advantage';
      } else if (signal.paceAdvantage < 0) {
        reason = 'pace disadvantage';
      } else if (signal.isVulnerable) {
        reason = 'vulnerable favorite';
      } else {
        reason = 'signal aggregation';
      }

      rankChanges.push({
        programNumber: signal.programNumber,
        horseName: signal.horseName,
        fromRank: oldRank,
        toRank: newRank,
        reason,
        direction: newRank < oldRank ? 'UPGRADED' : 'DOWNGRADED',
      });
    }
  });

  return { reorderedSignals, rankChanges };
}

/**
 * Identify value play based on strict criteria
 * Value play must NOT be the top pick (adjusted rank 1)
 *
 * @param reorderedSignals - Signals sorted by adjusted rank
 * @param paceScenario - Pace scenario analysis (for slow pace check)
 * @param scores - Original scoring results for ML odds
 * @returns Program number of value play or null if none
 */
export function identifyValuePlay(
  reorderedSignals: AggregatedSignals[],
  paceScenario: PaceScenarioAnalysis | null,
  scores: RaceScoringResult['scores']
): number | null {
  // Value play must be adjusted rank 2-5
  const candidates = reorderedSignals.filter((_, idx) => idx >= 1 && idx <= 4);

  for (const candidate of candidates) {
    const score = scores.find((s) => s.programNumber === candidate.programNumber);

    // Check morning line odds > 4-1
    const mlDecimal = score?.morningLineDecimal ?? 0;
    const hasGoodOdds = mlDecimal > 4;

    // Prioritize horses with trip trouble boost (hidden ability)
    if (candidate.tripTroubleBoost > 0 && candidate.classification !== 'EXCLUDE') {
      return candidate.programNumber;
    }

    // Positive total adjustment + classification A or B + good odds
    if (
      candidate.totalAdjustment > 0 &&
      (candidate.classification === 'A' || candidate.classification === 'B') &&
      hasGoodOdds
    ) {
      return candidate.programNumber;
    }

    // Lone speed in slow pace scenario
    if (candidate.paceAdvantage >= 2 && paceScenario?.paceProjection === 'SLOW') {
      return candidate.programNumber;
    }
  }

  // No clear value angle exists
  return null;
}

/**
 * Synthesize bet structure from field spread and signal analysis
 *
 * @param fieldSpread - Field spread analysis
 * @param reorderedSignals - Signals sorted by adjusted rank
 * @param vulnerableFavorite - Vulnerable favorite analysis
 * @returns Bet recommendation
 */
export function synthesizeBetStructure(
  fieldSpread: FieldSpreadAnalysis | null,
  reorderedSignals: AggregatedSignals[],
  vulnerableFavorite: VulnerableFavoriteAnalysis | null
): BetRecommendation {
  const topPick = reorderedSignals[0];
  const fieldType = fieldSpread?.fieldType ?? 'MIXED';

  // Get horses by classification
  const excludeHorses = reorderedSignals
    .filter((s) => s.classification === 'EXCLUDE')
    .map((s) => s.programNumber);

  // Include horses with trip trouble boosts
  const tripBoostHorses = reorderedSignals
    .filter((s) => s.tripTroubleBoost > 0 && s.classification !== 'EXCLUDE')
    .map((s) => s.programNumber);

  // Build include list: top 4-5 horses plus any with trip trouble
  const top5 = reorderedSignals.slice(0, 5).map((s) => s.programNumber);
  const includeList = [...new Set([...top5, ...tripBoostHorses])];

  // Determine bet type and confidence
  let type: BetRecommendation['type'] = 'BOX';
  let confidence: BetRecommendation['confidence'] = 'MEDIUM';
  let reasoning = '';

  // DOMINANT/SEPARATED field + no vulnerable favorite = KEY
  if (
    (fieldType === 'DOMINANT' || fieldType === 'SEPARATED') &&
    !vulnerableFavorite?.isVulnerable
  ) {
    type = 'KEY';
    confidence = 'HIGH';
    reasoning = `Clear standout in ${fieldType} field - key the top pick`;
  }
  // DOMINANT but favorite vulnerable = KEY rank 2-3 over field
  else if (
    (fieldType === 'DOMINANT' || fieldType === 'SEPARATED') &&
    vulnerableFavorite?.isVulnerable &&
    vulnerableFavorite?.confidence === 'HIGH'
  ) {
    type = 'KEY';
    confidence = 'MEDIUM';
    reasoning = 'Favorite vulnerable - key second choice over field';
  }
  // COMPETITIVE = BOX approach
  else if (fieldType === 'COMPETITIVE' || fieldType === 'MIXED') {
    type = 'BOX';
    confidence = 'MEDIUM';
    reasoning = 'Competitive field - box the top contenders';
  }
  // WIDE_OPEN or TIGHT = WIDE spread or PASS
  else if (fieldType === 'WIDE_OPEN' || fieldType === 'TIGHT') {
    if (reorderedSignals.some((s) => s.tripTroubleBoost > 0 || s.paceAdvantage >= 2)) {
      type = 'WHEEL';
      confidence = 'LOW';
      reasoning = 'Wide-open field but specific angles present - wheel with key horse';
    } else {
      type = 'PASS';
      confidence = 'LOW';
      reasoning = 'Wide-open field with no clear angles - consider passing';
    }
  }

  // Build exacta/trifecta suggestions
  let exacta = '';
  let trifecta = '';
  const primaryPlay = topPick?.programNumber ?? 0;

  if (type === 'KEY') {
    const others = includeList.filter((p) => p !== primaryPlay).slice(0, 4);
    exacta = `#${primaryPlay} over #${others.join(',#')}`;
    trifecta = `#${primaryPlay} with #${others.join(',#')}`;
  } else if (type === 'BOX') {
    const boxHorses = includeList.slice(0, 4);
    exacta = `Box #${boxHorses.join(',#')}`;
    trifecta = `Box #${boxHorses.join(',#')}`;
  } else if (type === 'WHEEL') {
    const others = includeList.filter((p) => p !== primaryPlay).slice(0, 5);
    exacta = `#${primaryPlay} wheel over #${others.join(',#')}`;
    trifecta = `#${primaryPlay} wheel with #${others.join(',#')}`;
  } else {
    exacta = 'PASS';
    trifecta = 'PASS';
  }

  return {
    type,
    exacta,
    trifecta,
    primaryPlay,
    includeList,
    excludeList: excludeHorses,
    confidence,
    reasoning,
  };
}

/**
 * Combine multi-bot results into the standard AIRaceAnalysis format
 *
 * INTELLIGENT COMBINER - Aggregates signals from all 4 bots and synthesizes
 * actionable betting recommendations with proper rank reordering.
 *
 * Philosophy:
 * - Aggregate signals per horse from all bots
 * - Apply adjustments with caps (±3 max)
 * - Reorder by adjusted rank
 * - Identify value plays with strict criteria
 * - Synthesize bet structure based on field type
 * - Generate actionable narratives
 *
 * @param rawResults - Raw results from all 4 bots
 * @param race - Parsed race data
 * @param scoringResult - Algorithm scoring results
 * @param processingTimeMs - Total processing time
 * @returns Combined AIRaceAnalysis
 */
export function combineMultiBotResults(
  rawResults: MultiBotRawResults,
  race: ParsedRace,
  scoringResult: RaceScoringResult,
  processingTimeMs: number
): AIRaceAnalysis {
  const { tripTrouble, paceScenario, vulnerableFavorite, fieldSpread } = rawResults;
  const { scores } = scoringResult;

  // ============================================================================
  // DEBUG LOGGING: Bot status summary
  // ============================================================================
  debugLog(`\n=== SMART COMBINER: Race ${race.header.raceNumber} ===`);
  debugLog(
    'TripTrouble:',
    tripTrouble ? `SUCCESS - ${tripTrouble.horsesWithTripTrouble.length} horses flagged` : 'FAILED'
  );
  debugLog(
    'PaceScenario:',
    paceScenario
      ? `SUCCESS - pace=${paceScenario.paceProjection}, loneSpeed=${paceScenario.loneSpeedException}`
      : 'FAILED'
  );
  debugLog(
    'VulnerableFavorite:',
    vulnerableFavorite
      ? `SUCCESS - vulnerable=${vulnerableFavorite.isVulnerable}, confidence=${vulnerableFavorite.confidence}`
      : 'FAILED'
  );
  debugLog(
    'FieldSpread:',
    fieldSpread
      ? `SUCCESS - fieldType=${fieldSpread.fieldType}, topTier=${fieldSpread.topTierCount}`
      : 'FAILED'
  );

  // Get non-scratched horses sorted by algorithm rank
  const rankedScores = [...scores].filter((s) => !s.isScratched).sort((a, b) => a.rank - b.rank);

  if (rankedScores.length === 0) {
    return createEmptyAnalysis(race.header.raceNumber, processingTimeMs);
  }

  // Count successful bots
  const botSuccessCount = [tripTrouble, paceScenario, vulnerableFavorite, fieldSpread].filter(
    Boolean
  ).length;

  // ============================================================================
  // STEP 1: Aggregate signals for each horse
  // ============================================================================
  debugLog('\n--- SIGNAL AGGREGATION ---');

  const aggregatedSignals: AggregatedSignals[] = rankedScores.map((score) => {
    const signals = aggregateHorseSignals(
      score.programNumber,
      score.horseName,
      score.rank,
      score.finalScore,
      rawResults,
      race
    );

    // Debug log each horse's signals
    if (signals.totalAdjustment !== 0 || signals.signalCount > 0) {
      debugLog(
        `Horse #${score.programNumber}: TripBoost=${signals.tripTroubleBoost > 0 ? '+' : ''}${signals.tripTroubleBoost}, ` +
          `PaceAdv=${signals.paceAdvantage > 0 ? '+' : ''}${signals.paceAdvantage}, ` +
          `Total=${signals.totalAdjustment > 0 ? '+' : ''}${signals.totalAdjustment}, ` +
          `Rank ${signals.algorithmRank}→${signals.adjustedRank}` +
          (signals.conflictingSignals ? ' [CONFLICT]' : '')
      );
    }

    return signals;
  });

  // ============================================================================
  // STEP 2: Reorder by adjusted rank
  // ============================================================================
  debugLog('\n--- RANK REORDERING ---');

  const { reorderedSignals, rankChanges } = reorderByAdjustedRank(aggregatedSignals);

  // Log rank changes
  for (const change of rankChanges) {
    debugLog(
      `${change.direction}: #${change.programNumber} moved from rank ${change.fromRank} to rank ${change.toRank} (${change.reason})`
    );
  }

  // Check for override
  const algorithmTopPick = rankedScores[0]?.programNumber ?? null;
  const aiTopPick = reorderedSignals[0]?.programNumber ?? null;
  const isOverride = algorithmTopPick !== aiTopPick;

  if (isOverride) {
    debugLog(`OVERRIDE triggered: #${aiTopPick} overtakes #${algorithmTopPick}`);
  }

  // ============================================================================
  // STEP 3: Identify value play
  // ============================================================================
  debugLog('\n--- VALUE PLAY IDENTIFICATION ---');

  const valuePlay = identifyValuePlay(reorderedSignals, paceScenario, scores);

  if (valuePlay) {
    const valueSignal = reorderedSignals.find((s) => s.programNumber === valuePlay);
    debugLog(`Value play identified: #${valuePlay} (adj=${valueSignal?.totalAdjustment ?? 0})`);
  } else {
    debugLog('No clear value play identified');
  }

  // ============================================================================
  // STEP 4: Synthesize bet structure
  // ============================================================================
  debugLog('\n--- BET STRUCTURE SYNTHESIS ---');

  const betRecommendation = synthesizeBetStructure(
    fieldSpread,
    reorderedSignals,
    vulnerableFavorite
  );

  debugLog(`Bet type: ${betRecommendation.type}, Confidence: ${betRecommendation.confidence}`);
  debugLog(`Exacta: ${betRecommendation.exacta}`);
  debugLog(`Trifecta: ${betRecommendation.trifecta}`);

  // ============================================================================
  // STEP 5: Build race narrative
  // ============================================================================
  const narrativeParts: string[] = [];

  // Start with OVERRIDE or CONFIRM
  if (isOverride) {
    const newTop = reorderedSignals[0];
    const rankChange = rankChanges.find((c) => c.programNumber === newTop?.programNumber);

    if (rankChange) {
      narrativeParts.push(
        `OVERRIDE: #${newTop?.programNumber} ${newTop?.horseName} moved from rank ${rankChange.fromRank} to rank 1 (${rankChange.reason})`
      );
    } else if (vulnerableFavorite?.isVulnerable && vulnerableFavorite?.confidence === 'HIGH') {
      narrativeParts.push(
        `OVERRIDE: Favorite vulnerable (HIGH) - #${newTop?.programNumber} ${newTop?.horseName} now top pick`
      );
    } else {
      narrativeParts.push(
        `OVERRIDE: Signal aggregation promotes #${newTop?.programNumber} ${newTop?.horseName} to top pick`
      );
    }
  } else {
    const topSignal = reorderedSignals[0];
    const confirmReasons: string[] = [];

    if (topSignal?.tripTroubleBoost === 0 && topSignal?.paceAdvantage >= 0) {
      confirmReasons.push('no hidden concerns');
    }
    if (paceScenario && topSignal?.paceAdvantage >= 0) {
      confirmReasons.push('pace scenario favorable');
    }
    if (fieldSpread?.fieldType === 'SEPARATED' || fieldSpread?.fieldType === 'DOMINANT') {
      confirmReasons.push('clear field separation');
    }

    narrativeParts.push(
      `CONFIRM: Algorithm's #${topSignal?.programNumber} ${topSignal?.horseName} supported by ${confirmReasons.length > 0 ? confirmReasons.join(' and ') : 'bot analysis'}`
    );
  }

  // Add vulnerable favorite note
  if (vulnerableFavorite?.isVulnerable && vulnerableFavorite.reasons[0]) {
    narrativeParts.push(`Vulnerable favorite: ${vulnerableFavorite.reasons[0]}.`);
  }

  // Add value play note if different from top pick
  if (valuePlay && valuePlay !== aiTopPick) {
    const valueSignal = reorderedSignals.find((s) => s.programNumber === valuePlay);
    if (valueSignal?.hiddenAbility) {
      narrativeParts.push(
        `Value angle: #${valuePlay} has hidden ability (${valueSignal.hiddenAbility}).`
      );
    } else if (valueSignal?.paceEdgeReason) {
      narrativeParts.push(`Value angle: #${valuePlay} (${valueSignal.paceEdgeReason}).`);
    }
  }

  // Add pace scenario summary
  if (paceScenario) {
    if (paceScenario.loneSpeedException) {
      narrativeParts.push('Lone speed scenario - front-runner has clear advantage.');
    } else if (paceScenario.speedDuelLikely && paceScenario.paceProjection === 'HOT') {
      narrativeParts.push('Speed duel likely with HOT pace - closers benefit.');
    }
  }

  // Add field type note
  if (fieldSpread) {
    if (fieldSpread.fieldType === 'WIDE_OPEN' || fieldSpread.fieldType === 'TIGHT') {
      narrativeParts.push(`${fieldSpread.fieldType} field - spread picks recommended.`);
    } else if (fieldSpread.fieldType === 'DOMINANT' || fieldSpread.fieldType === 'SEPARATED') {
      narrativeParts.push('Top choice stands out from field.');
    }
  }

  const raceNarrative = narrativeParts.join(' ');

  // ============================================================================
  // STEP 6: Build horse insights with value labels
  // ============================================================================
  const horseInsights = reorderedSignals.map((signal, idx) => {
    const score = rankedScores.find((s) => s.programNumber === signal.programNumber)!;
    const finalRank = idx + 1;
    const isBottomThird = finalRank > Math.ceil((reorderedSignals.length * 2) / 3);

    // Determine value label per requirements
    let valueLabel: AIRaceAnalysis['horseInsights'][0]['valueLabel'];

    if (signal.classification === 'EXCLUDE') {
      valueLabel = 'NO CHANCE';
    } else if (signal.isVulnerable && vulnerableFavorite?.confidence === 'HIGH') {
      valueLabel = 'FAIR PRICE'; // False favorite
    } else if (isBottomThird) {
      valueLabel = signal.classification === 'C' ? 'NO VALUE' : 'SKIP';
    } else if (finalRank === 1 && betRecommendation.confidence === 'HIGH') {
      valueLabel = 'BEST BET';
    } else if (finalRank === 1 && betRecommendation.confidence === 'MEDIUM') {
      valueLabel = 'PRIME VALUE';
    } else if (finalRank <= 3 && signal.totalAdjustment > 0) {
      valueLabel = 'SOLID PLAY';
    } else if (signal.classification === 'A' && !signal.keyCandidate) {
      valueLabel = 'FAIR PRICE';
    } else if (signal.classification === 'B') {
      valueLabel = 'WATCH ONLY';
    } else if (finalRank <= 5) {
      valueLabel = 'SOLID PLAY';
    } else {
      valueLabel = 'NO VALUE';
    }

    // Build actionable one-liner
    let oneLiner = '';
    if (signal.tripTroubleBoost > 0 && signal.hiddenAbility) {
      // Extract Beyer estimate if possible
      const beyerMatch = signal.hiddenAbility.match(/\+(\d+)-(\d+)/);
      if (beyerMatch) {
        oneLiner = `Hidden ${beyerMatch[2]}+ Beyer, blocked last ${signal.tripTroubleBoost > 1 ? '2' : 'race'}, gets clean setup today`;
      } else {
        oneLiner = 'Trip trouble masked true ability - improvement expected';
      }
    } else if (signal.paceAdvantage >= 2) {
      oneLiner = 'Lone speed on speed-favoring track, should wire';
    } else if (signal.paceAdvantage === 1) {
      oneLiner = signal.paceEdgeReason || 'Pace scenario favorable';
    } else if (signal.isVulnerable) {
      oneLiner = `False favorite, ${signal.vulnerabilityFlags[0] || 'concerns present'}, fade in exotics`;
    } else if (signal.paceAdvantage < 0) {
      oneLiner = `${signal.paceEdgeReason || 'Pace works against'} - use underneath only`;
    } else if (score.positiveFactors[0]) {
      oneLiner = score.positiveFactors[0];
    } else if (score.negativeFactors[0]) {
      oneLiner = `Concern: ${score.negativeFactors[0]}`;
    } else {
      oneLiner = `Ranked #${finalRank} by combined analysis`;
    }

    // Key strength/weakness
    let keyStrength: string | null = null;
    let keyWeakness: string | null = null;

    if (signal.tripTroubleBoost > 0) {
      keyStrength = signal.hiddenAbility || 'Trip trouble - hidden ability';
    } else if (signal.paceAdvantage >= 2) {
      keyStrength = 'Lone speed - clear tactical advantage';
    } else if (signal.paceAdvantage > 0) {
      keyStrength = signal.paceEdgeReason || 'Pace advantage';
    } else if (score.positiveFactors[0]) {
      keyStrength = score.positiveFactors[0];
    }

    if (signal.isVulnerable && signal.vulnerabilityFlags[0]) {
      keyWeakness = signal.vulnerabilityFlags[0];
    } else if (signal.paceAdvantage < 0) {
      keyWeakness = signal.paceEdgeReason || 'Pace disadvantage';
    } else if (score.negativeFactors[0]) {
      keyWeakness = score.negativeFactors[0];
    }

    const contenderCount = Math.min(4, reorderedSignals.length);

    return {
      programNumber: signal.programNumber,
      horseName: signal.horseName,
      projectedFinish: finalRank,
      valueLabel,
      oneLiner,
      keyStrength,
      keyWeakness,
      isContender: finalRank <= contenderCount,
      avoidFlag:
        signal.classification === 'EXCLUDE' || (isBottomThird && score.negativeFactors.length >= 2),
    };
  });

  // ============================================================================
  // STEP 7: Determine overall confidence and flags
  // ============================================================================

  // HIGH: 3+ bots agree, fieldType DOMINANT or SEPARATED, no conflicts
  // LOW: Bots conflict, fieldType WIDE_OPEN, or vulnerable favorite with trip trouble
  // MEDIUM: Default
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

  const hasConflicts = reorderedSignals.some((s) => s.conflictingSignals);

  if (
    botSuccessCount >= 3 &&
    (fieldSpread?.fieldType === 'DOMINANT' || fieldSpread?.fieldType === 'SEPARATED') &&
    !hasConflicts
  ) {
    confidence = 'HIGH';
  } else if (
    hasConflicts ||
    fieldSpread?.fieldType === 'WIDE_OPEN' ||
    (vulnerableFavorite?.isVulnerable &&
      aggregatedSignals.some((s) => s.tripTroubleBoost > 0 && s.algorithmRank === 1))
  ) {
    confidence = 'LOW';
  }

  // Flags
  const isVulnerableFavoriteFlag =
    vulnerableFavorite?.isVulnerable === true &&
    (vulnerableFavorite?.confidence === 'HIGH' || vulnerableFavorite?.confidence === 'MEDIUM');

  const isLikelyUpset =
    isVulnerableFavoriteFlag &&
    vulnerableFavorite?.confidence === 'HIGH' &&
    fieldSpread?.fieldType !== 'SEPARATED' &&
    fieldSpread?.fieldType !== 'DOMINANT';

  const isChaoticRace =
    fieldSpread?.fieldType === 'WIDE_OPEN' ||
    (fieldSpread?.fieldType === 'TIGHT' && (fieldSpread?.topTierCount ?? 0) >= 5) ||
    reorderedSignals.filter((s) => s.conflictingSignals).length >= 3;

  // Build avoid list
  const avoidList = horseInsights.filter((h) => h.avoidFlag).map((h) => h.programNumber);

  // ============================================================================
  // FINAL DEBUG SUMMARY
  // ============================================================================
  debugLog('\n--- FINAL SUMMARY ---');
  debugLog(`Top Pick: #${aiTopPick} (${isOverride ? 'OVERRIDE' : 'CONFIRM'})`);
  debugLog(`Value Play: ${valuePlay ? `#${valuePlay}` : 'None'}`);
  debugLog(`Confidence: ${confidence}`);
  debugLog(`Bet Type: ${betRecommendation.type}`);
  debugLog(`Chaotic: ${isChaoticRace}, Likely Upset: ${isLikelyUpset}`);
  debugLog('=== END SMART COMBINER ===\n');

  return {
    raceId: `race-${race.header.raceNumber}`,
    raceNumber: race.header.raceNumber,
    timestamp: new Date().toISOString(),
    processingTimeMs,
    raceNarrative,
    confidence,
    bettableRace: !isChaoticRace && confidence !== 'LOW',
    horseInsights,
    topPick: aiTopPick,
    valuePlay,
    avoidList,
    vulnerableFavorite: isVulnerableFavoriteFlag ?? false,
    likelyUpset: isLikelyUpset ?? false,
    chaoticRace: isChaoticRace ?? false,
  };
}

/**
 * Create an empty analysis result for edge cases (no horses)
 */
function createEmptyAnalysis(raceNumber: number, processingTimeMs: number): AIRaceAnalysis {
  return {
    raceId: `race-${raceNumber}`,
    raceNumber,
    timestamp: new Date().toISOString(),
    processingTimeMs,
    raceNarrative: 'No horses available for analysis.',
    confidence: 'LOW',
    bettableRace: false,
    horseInsights: [],
    topPick: null,
    valuePlay: null,
    avoidList: [],
    vulnerableFavorite: false,
    likelyUpset: false,
    chaoticRace: false,
  };
}
