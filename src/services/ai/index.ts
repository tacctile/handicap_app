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
  BotStatusDebugInfo,
  BetConstructionGuidance,
  ExactaStrategy,
  TrifectaStrategy,
} from './types';
import { recordAIDecision } from './metrics/recorder';

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
  BotStatusInfo,
  BotStatusDebugInfo,
  OverrideReason,
  // New expansion/contraction model types
  BetConstructionGuidance,
  ExactaStrategy,
  TrifectaStrategy,
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
  // Debug logging exports
  setCurrentBotName,
  getRawResponseLog,
  clearRawResponseLog,
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
  conservativeMode: true, // Conservative threshold mode (default: true)
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
  // Note: navigator.onLine must be explicitly false (not undefined) to be offline
  // Node.js 21+ has a navigator global but onLine is undefined
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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
  options?: { forceRefresh?: boolean; scoringVersion?: number; recordMetrics?: boolean }
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

  // Record metrics if enabled (default: true)
  const shouldRecordMetrics = options?.recordMetrics !== false;
  if (shouldRecordMetrics) {
    try {
      const recordId = await recordAIDecision(analysis, scoringResult, race, rawResults);
      debugLog(`[Metrics] Recorded decision: ${recordId}`);
    } catch (error) {
      debugError('[Metrics] Failed to record decision:', error);
      // Don't fail the analysis if metrics recording fails
    }
  }

  return analysis;
}

// ============================================================================
// SMART COMBINER - SIGNAL AGGREGATION & BET SYNTHESIS
// ============================================================================

/**
 * Aggregate all bot signals for a single horse
 * Collects signals from all 4 bots and calculates total adjustment
 *
 * CONSERVATIVE MODE (default) - TUNED THRESHOLDS:
 * - Trip trouble: +2 for HIGH confidence (2+ troubled races), +1 for MEDIUM
 * - Pace advantage: +2 for STRONG (lone speed), +1 for MODERATE
 * - Vulnerable favorite: -2 if HIGH + 2+ flags, -1 if HIGH + 1 flag, MEDIUM = flag only
 * - Competitive field: reduce adjustments by 25% (not 50%)
 * - Minimum for rank change: ±1
 * - Max position movement: 2 positions
 *
 * @param programNumber - Horse's program number
 * @param horseName - Horse name
 * @param algorithmRank - Original algorithm rank
 * @param algorithmScore - Original algorithm score
 * @param rawResults - Raw results from all 4 bots
 * @param race - Parsed race data
 * @param options - Optional configuration for conservative mode
 * @returns Aggregated signals for this horse
 */
export function aggregateHorseSignals(
  programNumber: number,
  horseName: string,
  algorithmRank: number,
  algorithmScore: number,
  rawResults: MultiBotRawResults,
  race: ParsedRace,
  options?: { conservativeMode?: boolean }
): AggregatedSignals {
  const { tripTrouble, paceScenario, vulnerableFavorite, fieldSpread } = rawResults;
  const conservativeMode = options?.conservativeMode ?? currentConfig.conservativeMode ?? true;

  // Initialize signals with defaults
  const signals: AggregatedSignals = {
    programNumber,
    horseName,
    algorithmRank,
    algorithmScore,
    tripTroubleBoost: 0,
    hiddenAbility: null,
    tripTroubleFlagged: false,
    paceAdvantage: 0,
    paceEdgeReason: null,
    paceAdvantageFlagged: false,
    isVulnerable: false,
    vulnerabilityFlags: [],
    classification: 'B', // Default to B if no field spread data
    keyCandidate: false,
    spreadOnly: false,
    totalAdjustment: 0,
    adjustedRank: algorithmRank,
    signalCount: 0,
    conflictingSignals: false,
    overrideReasons: [],
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
        signals.tripTroubleFlagged = true;
        signals.signalCount++;

        if (conservativeMode) {
          // CONSERVATIVE: HIGH confidence (2+ troubled races) gets +2, MEDIUM gets +1
          if (hasTwoOrMoreTroubledRaces) {
            signals.tripTroubleBoost = 2;
            signals.hiddenAbility = `+5-8 Beyer masked - ${tripHorse.issue}`;
            signals.overrideReasons.push({
              signal: 'tripTrouble',
              confidence: 'HIGH',
              description: `Trip trouble HIGH: ${tripHorse.issue}`,
            });
          } else {
            // MEDIUM confidence: +1 boost
            signals.tripTroubleBoost = 1;
            signals.hiddenAbility = tripHorse.issue;
            signals.overrideReasons.push({
              signal: 'tripTrouble',
              confidence: 'MEDIUM',
              description: `Trip trouble MEDIUM: ${tripHorse.issue}`,
            });
          }
        } else {
          // NON-CONSERVATIVE: Original behavior
          if (hasTwoOrMoreTroubledRaces) {
            signals.tripTroubleBoost = 2;
            signals.hiddenAbility = `+5-8 Beyer masked - ${tripHorse.issue}`;
          } else {
            signals.tripTroubleBoost = 1;
            signals.hiddenAbility = tripHorse.issue;
          }
          if (signals.tripTroubleBoost > 0) {
            signals.overrideReasons.push({
              signal: 'tripTrouble',
              confidence: hasTwoOrMoreTroubledRaces ? 'HIGH' : 'MEDIUM',
              description: `Trip trouble: ${tripHorse.issue}`,
            });
          }
        }
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

    // Lone speed exception - STRONG advantage
    if (paceScenario.loneSpeedException && isEarlySpeed) {
      signals.paceAdvantageFlagged = true;
      // STRONG gives +2 in both modes
      signals.paceAdvantage = 2;
      signals.paceEdgeReason = 'Lone speed on speed-favoring track';
      signals.signalCount++;
      signals.overrideReasons.push({
        signal: 'paceAdvantage',
        confidence: 'HIGH',
        description: 'Lone speed exception - STRONG pace advantage',
      });
    }
    // Speed duel + HOT pace benefits closers - MODERATE advantage
    else if (paceScenario.speedDuelLikely && paceScenario.paceProjection === 'HOT' && isCloser) {
      signals.paceAdvantageFlagged = true;
      signals.paceEdgeReason = 'Speed duel sets up for closing kick';
      // MODERATE gives +1 in both modes
      signals.paceAdvantage = 1;
      signals.signalCount++;
      signals.overrideReasons.push({
        signal: 'paceAdvantage',
        confidence: 'MEDIUM',
        description: 'Speed duel benefits closer - MODERATE pace advantage',
      });
    }
    // Speed duel + HOT pace HURTS early speed (-1) - always apply
    else if (
      paceScenario.speedDuelLikely &&
      paceScenario.paceProjection === 'HOT' &&
      isEarlySpeed
    ) {
      signals.paceAdvantage = -1;
      signals.paceEdgeReason = 'Speed duel likely - pace hurts early speed';
      signals.paceAdvantageFlagged = true;
      signals.signalCount++;
      signals.overrideReasons.push({
        signal: 'paceAdvantage',
        confidence: 'MEDIUM',
        description: 'Speed duel hurts early speed - pace disadvantage',
      });
    }
    // SLOW pace helps stalkers - MODERATE advantage
    else if (
      paceScenario.paceProjection === 'SLOW' &&
      isStalker &&
      !paceScenario.loneSpeedException
    ) {
      signals.paceAdvantageFlagged = true;
      signals.paceEdgeReason = 'Slow pace favors pressing style';
      // MODERATE gives +1 in both modes
      signals.paceAdvantage = 1;
      signals.signalCount++;
      signals.overrideReasons.push({
        signal: 'paceAdvantage',
        confidence: 'MEDIUM',
        description: 'Slow pace favors stalker - MODERATE pace advantage',
      });
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

  // Trip trouble: +2 (HIGH only in conservative mode)
  let totalAdj = signals.tripTroubleBoost;

  // Pace advantage: +1 (STRONG only in conservative mode), -1 if pace hurts
  totalAdj += signals.paceAdvantage;

  // Vulnerable favorite penalty
  // CONSERVATIVE: HIGH + 2+ flags = -2, HIGH + 1 flag = -1, MEDIUM = flag only
  // NON-CONSERVATIVE: -2 (HIGH) or -1 (MEDIUM)
  if (signals.isVulnerable && vulnerableFavorite) {
    const flagCount = signals.vulnerabilityFlags.length;

    if (conservativeMode) {
      // CONSERVATIVE: HIGH + 2+ flags = -2, HIGH + 1 flag = -1, MEDIUM = flag only
      if (vulnerableFavorite.confidence === 'HIGH') {
        if (flagCount >= 2) {
          totalAdj -= 2;
          signals.overrideReasons.push({
            signal: 'vulnerableFavorite',
            confidence: 'HIGH',
            description: `Vulnerable favorite HIGH with ${flagCount} flags: ${signals.vulnerabilityFlags.slice(0, 2).join(', ')}`,
          });
        } else {
          // HIGH + 1 flag = -1
          totalAdj -= 1;
          signals.overrideReasons.push({
            signal: 'vulnerableFavorite',
            confidence: 'HIGH',
            description: `Vulnerable favorite HIGH: ${signals.vulnerabilityFlags[0] || 'Unknown'}`,
          });
        }
      }
      // MEDIUM: flag only, no penalty
    } else {
      // NON-CONSERVATIVE: Original behavior
      if (vulnerableFavorite.confidence === 'HIGH') {
        totalAdj -= 2;
        signals.overrideReasons.push({
          signal: 'vulnerableFavorite',
          confidence: 'HIGH',
          description: `Vulnerable favorite HIGH: ${signals.vulnerabilityFlags[0] || 'Unknown'}`,
        });
      } else if (vulnerableFavorite.confidence === 'MEDIUM') {
        totalAdj -= 1;
        signals.overrideReasons.push({
          signal: 'vulnerableFavorite',
          confidence: 'MEDIUM',
          description: `Vulnerable favorite MEDIUM: ${signals.vulnerabilityFlags[0] || 'Unknown'}`,
        });
      }
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
 * Check if this is a competitive field (top 4 horses within 20 points of each other)
 *
 * @param signals - Array of aggregated signals for all horses
 * @returns true if field is competitive (reduce adjustments by 50%)
 */
export function isCompetitiveField(signals: AggregatedSignals[]): boolean {
  // Sort by algorithm score descending to get top 4
  const sortedByScore = [...signals].sort((a, b) => b.algorithmScore - a.algorithmScore);
  const top4 = sortedByScore.slice(0, 4);

  if (top4.length < 4) return false;

  const maxScore = top4[0]?.algorithmScore ?? 0;
  const minScore = top4[3]?.algorithmScore ?? 0;

  // If top 4 are within 20 points, it's a competitive field
  return maxScore - minScore <= 20;
}

/**
 * @deprecated This function is deprecated as of the expansion/contraction refactor.
 * Use buildBetConstructionGuidance() instead for bet construction.
 * Algorithm ranks are now SACRED and never modified by AI signals.
 *
 * Reorder horses by adjusted rank and track rank changes
 *
 * CONSERVATIVE MODE PROTECTIONS:
 * - Only adjustments of ±1 or greater trigger rank changes
 * - Never move a horse more than 2 rank positions from algorithm rank
 * - If competitive field (top 4 within 20 points), reduce adjustments by 25%
 *
 * @param aggregatedSignals - Array of aggregated signals for all horses
 * @param options - Optional configuration for conservative mode
 * @returns Object with reordered signals and rank changes
 */
export function reorderByAdjustedRank(
  aggregatedSignals: AggregatedSignals[],
  options?: { conservativeMode?: boolean }
): {
  reorderedSignals: AggregatedSignals[];
  rankChanges: RankChange[];
  competitiveFieldDetected: boolean;
} {
  const conservativeMode = options?.conservativeMode ?? currentConfig.conservativeMode ?? true;
  const fieldSize = aggregatedSignals.length;
  const rankChanges: RankChange[] = [];

  // Check for competitive field
  const competitiveFieldDetected = isCompetitiveField(aggregatedSignals);

  // Calculate adjusted ranks with conservative protections
  // Positive adjustment = move up = lower rank number
  // Negative adjustment = move down = higher rank number
  for (const signal of aggregatedSignals) {
    let effectiveAdjustment = signal.totalAdjustment;

    if (conservativeMode) {
      // PROTECTION 1: If competitive field, reduce adjustments by 25% (round down)
      if (competitiveFieldDetected) {
        effectiveAdjustment =
          Math.sign(effectiveAdjustment) * Math.floor(Math.abs(effectiveAdjustment) * 0.75);
      }

      // PROTECTION 2: Only adjustments of ±1 or greater trigger rank changes
      if (Math.abs(effectiveAdjustment) < 1) {
        effectiveAdjustment = 0;
      }
    }

    // Calculate raw adjusted rank
    const rawAdjustedRank = signal.algorithmRank - effectiveAdjustment;

    if (conservativeMode) {
      // PROTECTION 3: Never move more than 2 rank positions from algorithm rank
      const minAllowedRank = Math.max(1, signal.algorithmRank - 2);
      const maxAllowedRank = Math.min(fieldSize, signal.algorithmRank + 2);
      signal.adjustedRank = Math.max(minAllowedRank, Math.min(maxAllowedRank, rawAdjustedRank));
    } else {
      signal.adjustedRank = Math.max(1, Math.min(fieldSize, rawAdjustedRank));
    }
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

  return { reorderedSignals, rankChanges, competitiveFieldDetected };
}

/**
 * Identify value play based on strict criteria
 * Value play must NOT be the top pick (adjusted rank 1)
 *
 * NEW CRITERIA (relaxed):
 * - Horse has any positive signal (tripTroubleFlagged OR paceAdvantageFlagged)
 * - Horse is ranked 2-6 by ALGORITHM (not adjusted rank)
 * - Horse has morning line odds >= 3-1
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
  // Value play must be algorithm rank 2-6 (not adjusted rank)
  const candidates = reorderedSignals.filter(
    (s) => s.algorithmRank >= 2 && s.algorithmRank <= 6 && s.classification !== 'EXCLUDE'
  );

  for (const candidate of candidates) {
    const score = scores.find((s) => s.programNumber === candidate.programNumber);

    // Check morning line odds >= 3-1
    const mlDecimal = score?.morningLineDecimal ?? 0;
    const hasGoodOdds = mlDecimal >= 3;

    // Value play if horse has any positive signal flag AND good odds
    const hasPositiveSignal = candidate.tripTroubleFlagged || candidate.paceAdvantageFlagged;

    if (hasPositiveSignal && hasGoodOdds) {
      return candidate.programNumber;
    }
  }

  // Secondary criteria: any horse with trip trouble boost (hidden ability) even at shorter odds
  for (const candidate of candidates) {
    if (candidate.tripTroubleBoost > 0) {
      return candidate.programNumber;
    }
  }

  // Tertiary: Lone speed in slow pace scenario
  for (const candidate of candidates) {
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

// ============================================================================
// EXPANSION/CONTRACTION BET CONSTRUCTION MODEL
// ============================================================================

/**
 * Identify expansion horses (sleepers) based on AI signals
 *
 * Criteria:
 * - Must be algorithm rank 5-10
 * - Must have Trip Trouble HIGH or Pace Advantage STRONG
 * - Must have morning line odds >= 4-1
 * - Maximum 2 expansion horses per race
 *
 * @param aggregatedSignals - Signals for all horses
 * @param scores - Original scoring results for ML odds
 * @returns Array of program numbers for expansion horses
 */
export function identifyExpansionHorses(
  aggregatedSignals: AggregatedSignals[],
  scores: RaceScoringResult['scores']
): number[] {
  const candidates = aggregatedSignals.filter((signal) => {
    // Must be algorithm rank 5-10
    if (signal.algorithmRank < 5 || signal.algorithmRank > 10) return false;

    // Must have Trip Trouble HIGH (2+ troubled races = boost of 2) or Pace Advantage STRONG (boost of 2)
    const hasTripTroubleHigh = signal.tripTroubleBoost >= 2;
    const hasPaceAdvantageStrong = signal.paceAdvantage >= 2;

    if (!hasTripTroubleHigh && !hasPaceAdvantageStrong) return false;

    // Must have morning line odds >= 4-1
    const score = scores.find((s) => s.programNumber === signal.programNumber);
    const mlDecimal = score?.morningLineDecimal ?? 0;
    if (mlDecimal < 4) return false;

    return true;
  });

  // Sort by total adjustment descending, take max 2
  return candidates
    .sort((a, b) => b.totalAdjustment - a.totalAdjustment)
    .slice(0, 2)
    .map((s) => s.programNumber);
}

/**
 * Detect vulnerable favorite for contraction
 *
 * Criteria:
 * - Only algorithm rank 1 qualifies
 * - Requires HIGH confidence from Vulnerable Favorite bot
 * - Requires 2+ vulnerability flags
 *
 * @param aggregatedSignals - Signals for all horses
 * @param vulnerableFavorite - Vulnerable favorite analysis from bot
 * @returns Program number of vulnerable favorite or null
 */
export function detectContractionTarget(
  aggregatedSignals: AggregatedSignals[],
  vulnerableFavorite: VulnerableFavoriteAnalysis | null
): number | null {
  if (!vulnerableFavorite) return null;
  if (!vulnerableFavorite.isVulnerable) return null;
  if (vulnerableFavorite.confidence !== 'HIGH') return null;
  if (vulnerableFavorite.reasons.length < 2) return null;

  // Find algorithm rank 1 horse
  const rank1Horse = aggregatedSignals.find((s) => s.algorithmRank === 1);
  if (!rank1Horse) return null;

  // Confirm this horse is marked as vulnerable
  if (!rank1Horse.isVulnerable) return null;

  return rank1Horse.programNumber;
}

/**
 * Determine exacta strategy based on expansion/contraction signals
 *
 * Strategy rules:
 * - If contractionTarget exists AND expansionHorses has entries:
 *   → PART_WHEEL: Key algorithm #2 over (top 4 minus vulnerable + expansionHorses)
 *
 * - If contractionTarget exists AND no expansionHorses:
 *   → KEY: Key algorithm #2 over algorithm #3-5
 *
 * - If no contractionTarget AND expansionHorses has entries:
 *   → BOX: Algorithm top 4 + expansionHorses (max 5 horses)
 *
 * - If no contractionTarget AND no expansionHorses:
 *   → BOX: Algorithm top 4
 *
 * @param algorithmTop4 - Program numbers of algorithm's top 4 horses
 * @param expansionHorses - Program numbers of AI-identified sleepers
 * @param contractionTarget - Program number of vulnerable favorite (or null)
 * @returns ExactaStrategy object
 */
export function determineExactaStrategy(
  algorithmTop4: number[],
  expansionHorses: number[],
  contractionTarget: number | null
): ExactaStrategy {
  const hasContraction = contractionTarget !== null;
  const hasExpansion = expansionHorses.length > 0;

  // Get algorithm positions 2-5 (index 1-4)
  const algoRank2 = algorithmTop4[1] ?? null;
  const algoRank3to5 = algorithmTop4.slice(2, 5); // May be less than 3 if field is small

  if (hasContraction && hasExpansion) {
    // PART_WHEEL: Key algorithm #2 over (top 4 minus vulnerable + expansionHorses)
    const includeHorses = [
      ...algorithmTop4.filter((pn) => pn !== contractionTarget),
      ...expansionHorses,
    ].filter((pn) => pn !== algoRank2); // Remove key horse from include list

    return {
      type: 'PART_WHEEL',
      keyHorse: algoRank2,
      includeHorses: [...new Set(includeHorses)].slice(0, 5),
      excludeFromTop: contractionTarget,
    };
  }

  if (hasContraction && !hasExpansion) {
    // KEY: Key algorithm #2 over algorithm #3-5
    return {
      type: 'KEY',
      keyHorse: algoRank2,
      includeHorses: algoRank3to5,
      excludeFromTop: contractionTarget,
    };
  }

  if (!hasContraction && hasExpansion) {
    // BOX: Algorithm top 4 + expansionHorses (max 5 horses)
    const boxHorses = [...new Set([...algorithmTop4, ...expansionHorses])].slice(0, 5);
    return {
      type: 'BOX',
      keyHorse: null,
      includeHorses: boxHorses,
      excludeFromTop: null,
    };
  }

  // Default: BOX: Algorithm top 4
  return {
    type: 'BOX',
    keyHorse: null,
    includeHorses: algorithmTop4,
    excludeFromTop: null,
  };
}

/**
 * Determine trifecta strategy based on expansion/contraction signals
 *
 * Strategy rules:
 * - If contractionTarget exists:
 *   → Exclude vulnerable favorite from A horses
 *   → A horses = algorithm #2-3
 *   → B horses = algorithm #4-5 + expansionHorses
 *
 * - If expansionHorses identified (no contraction):
 *   → A horses = algorithm top 3
 *   → B horses = algorithm #4-5 + expansionHorses
 *
 * - Default (no signals):
 *   → A horses = algorithm top 3
 *   → B horses = algorithm #4-5
 *
 * @param algorithmTop4 - Program numbers of algorithm's top 4 horses
 * @param algorithmTop5 - Program numbers of algorithm's top 5 horses (for B horses)
 * @param expansionHorses - Program numbers of AI-identified sleepers
 * @param contractionTarget - Program number of vulnerable favorite (or null)
 * @returns TrifectaStrategy object
 */
export function determineTrifectaStrategy(
  algorithmTop4: number[],
  algorithmTop5: number[],
  expansionHorses: number[],
  contractionTarget: number | null
): TrifectaStrategy {
  const hasContraction = contractionTarget !== null;
  const hasExpansion = expansionHorses.length > 0;

  // Get algorithm positions
  const algoRank1 = algorithmTop4[0] ?? null;
  const algoRank2 = algorithmTop4[1] ?? null;
  const algoRank3 = algorithmTop4[2] ?? null;
  const algoRank4 = algorithmTop4[3] ?? null;
  const algoRank5 = algorithmTop5[4] ?? null;

  if (hasContraction) {
    // Exclude vulnerable favorite from A horses
    // A horses = algorithm #2-3
    const aHorses = [algoRank2, algoRank3].filter((pn): pn is number => pn !== null);

    // B horses = algorithm #4-5 + expansionHorses
    const bHorses = [algoRank4, algoRank5, ...expansionHorses].filter(
      (pn): pn is number => pn !== null
    );

    return {
      type: 'PART_WHEEL',
      keyHorse: algoRank2,
      aHorses,
      bHorses: [...new Set(bHorses)],
      excludeFromTop: contractionTarget,
    };
  }

  if (hasExpansion) {
    // A horses = algorithm top 3
    const aHorses = [algoRank1, algoRank2, algoRank3].filter((pn): pn is number => pn !== null);

    // B horses = algorithm #4-5 + expansionHorses
    const bHorses = [algoRank4, algoRank5, ...expansionHorses].filter(
      (pn): pn is number => pn !== null
    );

    return {
      type: 'BOX',
      keyHorse: null,
      aHorses,
      bHorses: [...new Set(bHorses)],
      excludeFromTop: null,
    };
  }

  // Default: no signals
  // A horses = algorithm top 3
  const aHorses = [algoRank1, algoRank2, algoRank3].filter((pn): pn is number => pn !== null);

  // B horses = algorithm #4-5
  const bHorses = [algoRank4, algoRank5].filter((pn): pn is number => pn !== null);

  return {
    type: 'BOX',
    keyHorse: null,
    aHorses,
    bHorses,
    excludeFromTop: null,
  };
}

/**
 * Build bet construction guidance using expansion/contraction model
 *
 * Philosophy:
 * - Algorithm top 4 are SACRED — never demoted by AI
 * - AI signals EXPAND boxes (add sleepers) or CONTRACT them (fade vulnerable favorites)
 * - No rank shuffling — preserves exotic ticket construction
 *
 * @param aggregatedSignals - Signals for all horses
 * @param scores - Original scoring results
 * @param vulnerableFavorite - Vulnerable favorite analysis
 * @param fieldSpread - Field spread analysis
 * @returns BetConstructionGuidance object
 */
export function buildBetConstructionGuidance(
  aggregatedSignals: AggregatedSignals[],
  scores: RaceScoringResult['scores'],
  vulnerableFavorite: VulnerableFavoriteAnalysis | null,
  fieldSpread: FieldSpreadAnalysis | null
): BetConstructionGuidance {
  // Get algorithm top 4 and top 5 (program numbers)
  const sortedByAlgoRank = [...aggregatedSignals].sort((a, b) => a.algorithmRank - b.algorithmRank);
  const algorithmTop4 = sortedByAlgoRank.slice(0, 4).map((s) => s.programNumber);
  const algorithmTop5 = sortedByAlgoRank.slice(0, 5).map((s) => s.programNumber);

  // Identify expansion horses (sleepers)
  const expansionHorses = identifyExpansionHorses(aggregatedSignals, scores);

  // Detect contraction target (vulnerable favorite)
  const contractionTarget = detectContractionTarget(aggregatedSignals, vulnerableFavorite);

  // Determine strategies
  const exactaStrategy = determineExactaStrategy(algorithmTop4, expansionHorses, contractionTarget);
  const trifectaStrategy = determineTrifectaStrategy(
    algorithmTop4,
    algorithmTop5,
    expansionHorses,
    contractionTarget
  );

  // Determine race classification
  let raceClassification: BetConstructionGuidance['raceClassification'] = 'BETTABLE';

  if (fieldSpread?.fieldType === 'WIDE_OPEN' || fieldSpread?.fieldType === 'TIGHT') {
    raceClassification = 'SPREAD_WIDE';
  }

  // If too chaotic (many conflicting signals), suggest PASS
  const conflictCount = aggregatedSignals.filter((s) => s.conflictingSignals).length;
  if (conflictCount >= 3 || (fieldSpread?.topTierCount ?? 0) >= 6) {
    raceClassification = 'PASS';
  }

  // Build signal summary
  const summaryParts: string[] = [];
  if (contractionTarget !== null) {
    summaryParts.push(`Contraction: #${contractionTarget} (vulnerable favorite)`);
  }
  if (expansionHorses.length > 0) {
    summaryParts.push(`Expansion: #${expansionHorses.join(', #')} (sleepers added)`);
  }
  if (summaryParts.length === 0) {
    summaryParts.push('No AI modifications — algorithm top 4 intact');
  }

  return {
    algorithmTop4,
    expansionHorses,
    contractionTarget,
    exactaStrategy,
    trifectaStrategy,
    raceClassification,
    vulnerableFavoriteDetected: contractionTarget !== null,
    sleeperIdentified: expansionHorses.length > 0,
    signalSummary: summaryParts.join('; '),
  };
}

/**
 * Combine multi-bot results into the standard AIRaceAnalysis format
 *
 * SMART COMBINER (v2) - EXPANSION/CONTRACTION MODEL
 *
 * Philosophy:
 * - Algorithm top 4 are SACRED — never demoted by AI
 * - AI signals EXPAND boxes (add sleepers) or CONTRACT them (fade vulnerable favorites)
 * - No rank shuffling — preserves exotic ticket construction
 *
 * Key changes from v1:
 * - Removed rank reordering
 * - topPick = algorithm rank 1 UNLESS vulnerable favorite HIGH confidence → algorithm rank 2
 * - valuePlay = first horse in expansionHorses, or null
 * - projectedFinish in horseInsights reflects algorithm rank
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
  debugLog(`\n=== SMART COMBINER v2 (Expansion/Contraction): Race ${race.header.raceNumber} ===`);
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

  // Get conservative mode setting
  const conservativeMode = currentConfig.conservativeMode ?? true;

  // ============================================================================
  // STEP 1: Aggregate signals for each horse (for insights generation)
  // Note: We aggregate signals but NO LONGER reorder ranks
  // ============================================================================
  debugLog('\n--- SIGNAL AGGREGATION ---');
  debugLog(`Conservative mode: ${conservativeMode}`);
  debugLog('NOTE: Algorithm ranks are now SACRED — no reordering applied');

  const aggregatedSignals: AggregatedSignals[] = rankedScores.map((score) => {
    const signals = aggregateHorseSignals(
      score.programNumber,
      score.horseName,
      score.rank,
      score.finalScore,
      rawResults,
      race,
      { conservativeMode }
    );

    // Debug log each horse's signals
    if (signals.totalAdjustment !== 0 || signals.signalCount > 0) {
      debugLog(
        `Horse #${score.programNumber} (Algo Rank ${score.rank}): ` +
          `TripBoost=${signals.tripTroubleBoost > 0 ? '+' : ''}${signals.tripTroubleBoost}, ` +
          `PaceAdv=${signals.paceAdvantage > 0 ? '+' : ''}${signals.paceAdvantage}, ` +
          `Total=${signals.totalAdjustment > 0 ? '+' : ''}${signals.totalAdjustment}` +
          (signals.conflictingSignals ? ' [CONFLICT]' : '') +
          (signals.overrideReasons.length > 0
            ? ` [${signals.overrideReasons.map((r) => r.signal).join(', ')}]`
            : '')
      );
    }

    return signals;
  });

  // ============================================================================
  // STEP 2: Build bet construction guidance (EXPANSION/CONTRACTION MODEL)
  // ============================================================================
  debugLog('\n--- BET CONSTRUCTION (Expansion/Contraction Model) ---');

  const betConstruction = buildBetConstructionGuidance(
    aggregatedSignals,
    scores,
    vulnerableFavorite,
    fieldSpread
  );

  debugLog(`Algorithm Top 4: #${betConstruction.algorithmTop4.join(', #')}`);
  debugLog(
    `Expansion Horses: ${betConstruction.expansionHorses.length > 0 ? '#' + betConstruction.expansionHorses.join(', #') : 'None'}`
  );
  debugLog(
    `Contraction Target: ${betConstruction.contractionTarget !== null ? '#' + betConstruction.contractionTarget : 'None'}`
  );
  debugLog(`Race Classification: ${betConstruction.raceClassification}`);
  debugLog(`Signal Summary: ${betConstruction.signalSummary}`);

  // ============================================================================
  // STEP 3: Determine top pick and value play
  // ============================================================================
  debugLog('\n--- TOP PICK & VALUE PLAY ---');

  const algorithmRank1 = rankedScores[0]?.programNumber ?? null;
  const algorithmRank2 = rankedScores[1]?.programNumber ?? null;

  // Top pick: algorithm rank 1 UNLESS vulnerable favorite with HIGH confidence + 2+ flags
  let topPick: number | null;
  if (
    betConstruction.vulnerableFavoriteDetected &&
    vulnerableFavorite?.confidence === 'HIGH' &&
    vulnerableFavorite.reasons.length >= 2
  ) {
    topPick = algorithmRank2;
    debugLog(
      `Top pick = Algorithm #2 (#${algorithmRank2}) due to vulnerable favorite HIGH with ${vulnerableFavorite.reasons.length} flags`
    );
  } else {
    topPick = algorithmRank1;
    debugLog(`Top pick = Algorithm #1 (#${algorithmRank1})`);
  }

  // Value play: first horse in expansionHorses, or null
  const valuePlay =
    betConstruction.expansionHorses.length > 0 ? betConstruction.expansionHorses[0] ?? null : null;

  if (valuePlay) {
    const valueSignal = aggregatedSignals.find((s) => s.programNumber === valuePlay);
    debugLog(
      `Value play = #${valuePlay} (expansion horse, algo rank ${valueSignal?.algorithmRank})`
    );
  } else {
    debugLog('Value play = None (no expansion horses identified)');
  }

  // ============================================================================
  // STEP 4: Synthesize bet structure (legacy format for backward compatibility)
  // ============================================================================
  debugLog('\n--- LEGACY BET STRUCTURE ---');

  // Use legacy synthesize function for backward compatibility
  const betRecommendation = synthesizeBetStructure(
    fieldSpread,
    aggregatedSignals, // Use algorithm-ordered signals
    vulnerableFavorite
  );

  debugLog(`Legacy Bet type: ${betRecommendation.type}`);
  debugLog(`Exacta Strategy: ${betConstruction.exactaStrategy.type}`);
  debugLog(`Trifecta Strategy: ${betConstruction.trifectaStrategy.type}`);

  // ============================================================================
  // STEP 5: Build race narrative (updated for expansion/contraction model)
  // ============================================================================
  const narrativeParts: string[] = [];

  // Start with algorithm confirmation or expansion/contraction note
  if (betConstruction.vulnerableFavoriteDetected && betConstruction.contractionTarget !== null) {
    const rank1Horse = rankedScores[0];
    narrativeParts.push(
      `CONTRACT: Algorithm #1 (#${rank1Horse?.programNumber} ${rank1Horse?.horseName}) flagged vulnerable - fade in key spots.`
    );
  } else {
    const rank1Horse = rankedScores[0];
    narrativeParts.push(
      `CONFIRM: Algorithm top pick #${rank1Horse?.programNumber} ${rank1Horse?.horseName} supported by bot analysis.`
    );
  }

  // Add expansion note
  if (betConstruction.sleeperIdentified && betConstruction.expansionHorses.length > 0) {
    const sleepers = betConstruction.expansionHorses
      .map((pn) => {
        const signal = aggregatedSignals.find((s) => s.programNumber === pn);
        return `#${pn} (rank ${signal?.algorithmRank})`;
      })
      .join(', ');
    narrativeParts.push(`EXPAND: Add sleeper(s) ${sleepers} to exotic tickets.`);
  }

  // Add vulnerable favorite note
  if (vulnerableFavorite?.isVulnerable && vulnerableFavorite.reasons[0]) {
    narrativeParts.push(`Vulnerable favorite: ${vulnerableFavorite.reasons[0]}.`);
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
  // STEP 6: Build horse insights with ALGORITHM RANK for projectedFinish
  // ============================================================================
  const horseInsights = aggregatedSignals.map((signal) => {
    const score = rankedScores.find((s) => s.programNumber === signal.programNumber)!;
    // Use ALGORITHM rank for projectedFinish (not adjusted rank)
    const algorithmRank = signal.algorithmRank;
    const isBottomThird = algorithmRank > Math.ceil((aggregatedSignals.length * 2) / 3);

    // Check if this horse is an expansion horse
    const isExpansionHorse = betConstruction.expansionHorses.includes(signal.programNumber);

    // Determine value label per requirements
    let valueLabel: AIRaceAnalysis['horseInsights'][0]['valueLabel'];

    if (signal.classification === 'EXCLUDE') {
      valueLabel = 'NO CHANCE';
    } else if (
      signal.isVulnerable &&
      vulnerableFavorite?.confidence === 'HIGH' &&
      vulnerableFavorite.reasons.length >= 2
    ) {
      valueLabel = 'FAIR PRICE'; // False favorite
    } else if (isBottomThird && !isExpansionHorse) {
      valueLabel = signal.classification === 'C' ? 'NO VALUE' : 'SKIP';
    } else if (algorithmRank === 1 && !betConstruction.vulnerableFavoriteDetected) {
      valueLabel = betConstruction.raceClassification === 'BETTABLE' ? 'BEST BET' : 'PRIME VALUE';
    } else if (algorithmRank === 2 && betConstruction.vulnerableFavoriteDetected) {
      valueLabel = 'BEST BET'; // Promoted due to vulnerable favorite
    } else if (algorithmRank <= 3 && signal.totalAdjustment > 0) {
      valueLabel = 'SOLID PLAY';
    } else if (isExpansionHorse) {
      valueLabel = 'PRIME VALUE'; // Sleeper horse
    } else if (signal.classification === 'A' && !signal.keyCandidate) {
      valueLabel = 'FAIR PRICE';
    } else if (signal.classification === 'B') {
      valueLabel = 'WATCH ONLY';
    } else if (algorithmRank <= 5) {
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
    } else if (isExpansionHorse) {
      oneLiner = 'AI-identified sleeper - add to exotic tickets';
    } else if (score.positiveFactors[0]) {
      oneLiner = score.positiveFactors[0];
    } else if (score.negativeFactors[0]) {
      oneLiner = `Concern: ${score.negativeFactors[0]}`;
    } else {
      oneLiner = `Algorithm rank #${algorithmRank}`;
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

    const contenderCount = Math.min(4, aggregatedSignals.length);

    return {
      programNumber: signal.programNumber,
      horseName: signal.horseName,
      projectedFinish: algorithmRank, // Use algorithm rank, NOT adjusted rank
      valueLabel,
      oneLiner,
      keyStrength,
      keyWeakness,
      isContender: algorithmRank <= contenderCount || isExpansionHorse,
      avoidFlag:
        signal.classification === 'EXCLUDE' ||
        (isBottomThird && score.negativeFactors.length >= 2 && !isExpansionHorse),
    };
  });

  // ============================================================================
  // STEP 7: Determine overall confidence and flags
  // ============================================================================

  // HIGH: 3+ bots agree, fieldType DOMINANT or SEPARATED, no conflicts
  // LOW: Bots conflict, fieldType WIDE_OPEN, or vulnerable favorite with trip trouble
  // MEDIUM: Default
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

  const hasConflicts = aggregatedSignals.some((s) => s.conflictingSignals);

  if (
    botSuccessCount >= 3 &&
    (fieldSpread?.fieldType === 'DOMINANT' || fieldSpread?.fieldType === 'SEPARATED') &&
    !hasConflicts
  ) {
    confidence = 'HIGH';
  } else if (
    hasConflicts ||
    fieldSpread?.fieldType === 'WIDE_OPEN' ||
    betConstruction.raceClassification === 'PASS'
  ) {
    confidence = 'LOW';
  }

  // Flags
  const isVulnerableFavoriteFlag = betConstruction.vulnerableFavoriteDetected;

  const isLikelyUpset =
    isVulnerableFavoriteFlag &&
    vulnerableFavorite?.confidence === 'HIGH' &&
    vulnerableFavorite?.reasons?.length >= 2 &&
    fieldSpread?.fieldType !== 'SEPARATED' &&
    fieldSpread?.fieldType !== 'DOMINANT';

  const isChaoticRace =
    betConstruction.raceClassification === 'PASS' ||
    fieldSpread?.fieldType === 'WIDE_OPEN' ||
    (fieldSpread?.fieldType === 'TIGHT' && (fieldSpread?.topTierCount ?? 0) >= 5) ||
    aggregatedSignals.filter((s) => s.conflictingSignals).length >= 3;

  // Build avoid list
  const avoidList = horseInsights.filter((h) => h.avoidFlag).map((h) => h.programNumber);

  // ============================================================================
  // BUILD BOT STATUS DEBUG INFO
  // ============================================================================
  const botDebugInfo: BotStatusDebugInfo = {
    tripTrouble: {
      name: 'Trip Trouble Bot',
      success: tripTrouble !== null,
      summary: tripTrouble
        ? `${tripTrouble.horsesWithTripTrouble.length} horse(s) flagged with trip issues`
        : 'FAILED - No data returned',
      count: tripTrouble?.horsesWithTripTrouble.length ?? 0,
    },
    paceScenario: {
      name: 'Pace Scenario Bot',
      success: paceScenario !== null,
      summary: paceScenario
        ? `Pace=${paceScenario.paceProjection}, LoneSpeed=${paceScenario.loneSpeedException ? 'YES' : 'NO'}, SpeedDuel=${paceScenario.speedDuelLikely ? 'YES' : 'NO'}`
        : 'FAILED - No data returned',
    },
    vulnerableFavorite: {
      name: 'Vulnerable Favorite Bot',
      success: vulnerableFavorite !== null,
      summary: vulnerableFavorite
        ? `Vulnerable=${vulnerableFavorite.isVulnerable ? 'YES' : 'NO'}, Confidence=${vulnerableFavorite.confidence}${vulnerableFavorite.reasons[0] ? ', Reason: ' + vulnerableFavorite.reasons[0] : ''}`
        : 'FAILED - No data returned',
    },
    fieldSpread: {
      name: 'Field Spread Bot',
      success: fieldSpread !== null,
      summary: fieldSpread
        ? `FieldType=${fieldSpread.fieldType}, TopTier=${fieldSpread.topTierCount}, Spread=${fieldSpread.recommendedSpread}`
        : 'FAILED - No data returned',
    },
    successCount: botSuccessCount,
    totalBots: 4,
    hasOverride: betConstruction.vulnerableFavoriteDetected || betConstruction.sleeperIdentified,
    signalSummary: betConstruction.signalSummary,
  };

  // ============================================================================
  // FINAL DEBUG SUMMARY - Enhanced console logging (always visible)
  // ============================================================================
  console.log(
    `%c[AI BOTS v2] Race ${race.header.raceNumber} Analysis Summary (Expansion/Contraction Model)`,
    'color: #19abb5; font-weight: bold; font-size: 14px'
  );
  console.log('%c┌─────────────────────────────────────────────────────────┐', 'color: #888');
  console.log(
    `%c│ BOT STATUS: ${botSuccessCount}/4 bots returned data`,
    botSuccessCount === 4 ? 'color: #10b981' : 'color: #f59e0b'
  );
  console.log(
    `%c│ • Trip Trouble:      ${tripTrouble ? '✅ SUCCESS' : '❌ FAILED'} ${tripTrouble ? `(${tripTrouble.horsesWithTripTrouble.length} flagged)` : ''}`,
    tripTrouble ? 'color: #10b981' : 'color: #ef4444'
  );
  console.log(
    `%c│ • Pace Scenario:     ${paceScenario ? '✅ SUCCESS' : '❌ FAILED'} ${paceScenario ? `(${paceScenario.paceProjection})` : ''}`,
    paceScenario ? 'color: #10b981' : 'color: #ef4444'
  );
  console.log(
    `%c│ • Vulnerable Fav:    ${vulnerableFavorite ? '✅ SUCCESS' : '❌ FAILED'} ${vulnerableFavorite ? `(${vulnerableFavorite.isVulnerable ? 'VULNERABLE' : 'SOLID'})` : ''}`,
    vulnerableFavorite ? 'color: #10b981' : 'color: #ef4444'
  );
  console.log(
    `%c│ • Field Spread:      ${fieldSpread ? '✅ SUCCESS' : '❌ FAILED'} ${fieldSpread ? `(${fieldSpread.fieldType})` : ''}`,
    fieldSpread ? 'color: #10b981' : 'color: #ef4444'
  );
  console.log('%c├─────────────────────────────────────────────────────────┤', 'color: #888');
  console.log(
    `%c│ ALGORITHM TOP 4: #${betConstruction.algorithmTop4.join(', #')}`,
    'color: #36d1da; font-weight: bold'
  );
  console.log(
    `%c│ EXPANSION: ${betConstruction.expansionHorses.length > 0 ? '#' + betConstruction.expansionHorses.join(', #') + ' (sleepers added)' : 'None'}`,
    betConstruction.expansionHorses.length > 0 ? 'color: #10b981' : 'color: #888'
  );
  console.log(
    `%c│ CONTRACTION: ${betConstruction.contractionTarget !== null ? '#' + betConstruction.contractionTarget + ' (vulnerable fav excluded)' : 'None'}`,
    betConstruction.contractionTarget !== null ? 'color: #f59e0b' : 'color: #888'
  );
  console.log('%c├─────────────────────────────────────────────────────────┤', 'color: #888');
  console.log(`%c│ TOP PICK: #${topPick}`, 'color: #36d1da; font-weight: bold');
  console.log(
    `%c│ VALUE PLAY: ${valuePlay ? `#${valuePlay}` : 'None identified'}`,
    valuePlay ? 'color: #10b981' : 'color: #b4b4b6'
  );
  console.log(
    `%c│ RACE CLASSIFICATION: ${betConstruction.raceClassification}`,
    betConstruction.raceClassification === 'BETTABLE'
      ? 'color: #10b981'
      : betConstruction.raceClassification === 'PASS'
        ? 'color: #ef4444'
        : 'color: #f59e0b'
  );
  console.log(
    `%c│ CONFIDENCE: ${confidence}`,
    confidence === 'HIGH'
      ? 'color: #10b981'
      : confidence === 'LOW'
        ? 'color: #ef4444'
        : 'color: #f59e0b'
  );
  console.log('%c└─────────────────────────────────────────────────────────┘', 'color: #888');

  // Log exacta/trifecta strategies
  debugLog('\n--- TICKET STRATEGIES ---');
  debugLog(
    `Exacta: ${betConstruction.exactaStrategy.type} - Key: ${betConstruction.exactaStrategy.keyHorse ?? 'N/A'}, Include: #${betConstruction.exactaStrategy.includeHorses.join(', #')}`
  );
  debugLog(
    `Trifecta: ${betConstruction.trifectaStrategy.type} - A: #${betConstruction.trifectaStrategy.aHorses.join(', #')}, B: #${betConstruction.trifectaStrategy.bHorses.join(', #')}`
  );
  debugLog('=== END SMART COMBINER v2 ===\n');

  return {
    raceId: `race-${race.header.raceNumber}`,
    raceNumber: race.header.raceNumber,
    timestamp: new Date().toISOString(),
    processingTimeMs,
    raceNarrative,
    confidence,
    bettableRace: !isChaoticRace && confidence !== 'LOW',
    horseInsights,
    topPick,
    valuePlay,
    avoidList,
    vulnerableFavorite: isVulnerableFavoriteFlag,
    likelyUpset: isLikelyUpset ?? false,
    chaoticRace: isChaoticRace ?? false,
    botDebugInfo,
    betConstruction, // NEW: Include bet construction guidance
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
