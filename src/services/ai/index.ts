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
  // New three-template system types
  TicketConstruction,
  TicketTemplate,
  RaceType,
  FavoriteStatus,
  ExactaConstruction,
  TrifectaConstruction,
  // Value horse identification types
  ValueHorseIdentification,
  ValueHorseSource,
  ValueSignalStrength,
  // Sizing and verdict types
  SizingRecommendation,
  SizingRecommendationType,
  RaceVerdict,
  // Class Drop Bot types
  ClassDropAnalysis,
  ClassDropHorse,
  ClassDropClassification,
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
  // New three-template system types
  TicketConstruction,
  TicketTemplate,
  RaceType,
  FavoriteStatus,
  ExactaConstruction,
  TrifectaConstruction,
  // Value horse identification types
  ValueHorseIdentification,
  ValueHorseSource,
  ValueSignalStrength,
  // Sizing and verdict types
  SizingRecommendation,
  SizingRecommendationType,
  RaceVerdict,
  // Class Drop Bot types
  ClassDropAnalysis,
  ClassDropHorse,
  ClassDropClassification,
  // Legacy types (deprecated)
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
// CLASS DROP BOT - LOCAL ANALYSIS (NO API CALL)
// ============================================================================

/**
 * Analyze class drop for all horses in a race
 *
 * REINFORCEMENT-ONLY ARCHITECTURE:
 * This bot CANNOT create value candidates alone. It can only strengthen
 * horses already flagged by other bots (Trip Trouble or Pace Scenario).
 *
 * Class drop is calculated by comparing today's class level (claiming price or purse)
 * against the median of the horse's last 3 races.
 *
 * @param race - Parsed race data from DRF file
 * @param scoringResult - Algorithm scoring results
 * @returns ClassDropAnalysis with per-horse analysis
 */
export function analyzeClassDrop(
  race: ParsedRace,
  _scoringResult: RaceScoringResult
): ClassDropAnalysis {
  const raceId = `${race.header.trackCode}-${race.header.raceNumber}`;
  const horses: ClassDropHorse[] = [];

  // Get today's class level
  // Use claiming price (max if range) if > 0, otherwise use purse
  const todayClaimingPrice = race.header.claimingPriceMax ?? race.header.claimingPriceMin ?? 0;
  const todayPurse = race.header.purse ?? 0;
  const todayClass = todayClaimingPrice > 0 ? todayClaimingPrice : todayPurse;

  // Determine if today's race is claiming or allowance/stakes
  const todayRaceType = race.header.classification;
  const isTodayClaiming = todayRaceType.includes('claiming');

  debugLog(`[ClassDrop] Analyzing race ${raceId} - Today class: $${todayClass} (${todayRaceType})`);

  for (const horse of race.horses) {
    // Skip scratched horses
    if (horse.isScratched) continue;

    // Use full PastPerformance data from race.horses (not the simplified PastPerformanceForAI from scoring)
    const pastPerformances = horse.pastPerformances || [];

    // Edge case: First-time starter (0 past races) - return null (silent)
    if (pastPerformances.length === 0) {
      debugLog(
        `[ClassDrop] #${horse.programNumber} ${horse.horseName}: First-time starter - skipped`
      );
      continue;
    }

    // Edge case: Single past race - return null (insufficient baseline)
    if (pastPerformances.length === 1) {
      debugLog(
        `[ClassDrop] #${horse.programNumber} ${horse.horseName}: Only 1 PP - insufficient baseline`
      );
      continue;
    }

    // Get last 3 races (or 2 if only 2 available)
    const recentRaces = pastPerformances.slice(0, 3);

    // Determine if we need to handle cross-surface moves or claiming/allowance transitions
    const pastRaceTypes = recentRaces.map((pp) => pp.classification);
    const anyPastClaiming = pastRaceTypes.some((t) => t.includes('claiming'));
    const anyPastAllowance = pastRaceTypes.some(
      (t) => t === 'allowance' || t === 'allowance-optional-claiming' || t === 'starter-allowance'
    );

    // Edge case: Claiming to Allowance - return null (cannot cleanly compare)
    if (
      anyPastClaiming &&
      !isTodayClaiming &&
      (todayRaceType === 'allowance' || todayRaceType.includes('stakes'))
    ) {
      debugLog(
        `[ClassDrop] #${horse.programNumber} ${horse.horseName}: Claiming to Allowance - cannot compare`
      );
      continue;
    }

    // Calculate class values for past races
    // Edge case: Cross-surface moves - use purse only
    const crossSurface = recentRaces.some((pp) => pp.surface !== race.header.surface);

    const pastClassValues: number[] = [];
    for (const pp of recentRaces) {
      let classValue: number;
      if (crossSurface) {
        // Cross-surface: use purse only
        classValue = pp.purse || 0;
      } else {
        // Same surface: use claiming price if > 0, else purse
        classValue = pp.claimingPrice && pp.claimingPrice > 0 ? pp.claimingPrice : pp.purse || 0;
      }
      if (classValue > 0) {
        pastClassValues.push(classValue);
      }
    }

    // If we couldn't get valid class values, skip
    if (pastClassValues.length === 0) {
      debugLog(
        `[ClassDrop] #${horse.programNumber} ${horse.horseName}: No valid class values found`
      );
      continue;
    }

    // Calculate baseline (median of past races)
    pastClassValues.sort((a, b) => a - b);
    let baseline: number;
    if (pastClassValues.length === 1) {
      baseline = pastClassValues[0]!;
    } else if (pastClassValues.length === 2) {
      baseline = (pastClassValues[0]! + pastClassValues[1]!) / 2;
    } else {
      // Median of 3
      baseline = pastClassValues[1]!;
    }

    // Calculate drop percentage
    // drop_pct = (baseline - today) / baseline
    // Positive = dropping, Negative = rising
    const dropPercentage = (baseline - todayClass) / baseline;

    // Check for Allowance to Claiming transition - automatic MODERATE
    const wasAllowance = anyPastAllowance && !anyPastClaiming;
    const isEnteringForSale = wasAllowance && isTodayClaiming;

    // Classify the drop
    let classification: ClassDropClassification = null;
    let signalBoost = 0;

    if (isEnteringForSale) {
      // Automatic MODERATE for Allowance → Claiming
      classification = 'MODERATE';
      signalBoost = 1.0;
      debugLog(
        `[ClassDrop] #${horse.programNumber} ${horse.horseName}: Allowance to Claiming - auto MODERATE`
      );
    } else if (dropPercentage < 0 && Math.abs(dropPercentage) >= 0.2) {
      // RISING: 20%+ class rise (penalty)
      classification = 'RISING';
      signalBoost = -0.5;
    } else if (dropPercentage >= 0.4) {
      // MAJOR: 40%+ drop
      classification = 'MAJOR';
      signalBoost = 1.5;
    } else if (dropPercentage >= 0.25) {
      // MODERATE: 25-39% drop
      classification = 'MODERATE';
      signalBoost = 1.0;
    } else if (dropPercentage >= 0.2) {
      // MINOR: 20-24% drop
      classification = 'MINOR';
      signalBoost = 0.5;
    }
    // else: < 20% drop - IGNORE (null classification)

    // If no classification (< 20% change), skip this horse
    if (classification === null) {
      debugLog(
        `[ClassDrop] #${horse.programNumber} ${horse.horseName}: ${(dropPercentage * 100).toFixed(1)}% - below threshold`
      );
      continue;
    }

    // Apply safety filters
    const safetyFiltersApplied: string[] = [];
    let reasonOverride: string | null = null;

    // Safety filter 1: Chronic dropper (dropped class in 2+ consecutive starts)
    if (pastPerformances.length >= 2 && classification !== 'RISING') {
      const pp1Class =
        (pastPerformances[0]?.claimingPrice ?? 0) > 0
          ? pastPerformances[0]?.claimingPrice
          : pastPerformances[0]?.purse;
      const pp2Class =
        (pastPerformances[1]?.claimingPrice ?? 0) > 0
          ? pastPerformances[1]?.claimingPrice
          : pastPerformances[1]?.purse;
      const pp3Class = pastPerformances[2]
        ? (pastPerformances[2]?.claimingPrice ?? 0) > 0
          ? pastPerformances[2]?.claimingPrice
          : pastPerformances[2]?.purse
        : null;

      // Check if class has been dropping consecutively
      let consecutiveDrops = 0;
      if (pp1Class && pp2Class && pp1Class < pp2Class) {
        consecutiveDrops++;
        if (pp3Class && pp2Class < pp3Class) {
          consecutiveDrops++;
        }
      }

      if (consecutiveDrops >= 2) {
        safetyFiltersApplied.push('chronic dropper (2+ consecutive drops)');
        signalBoost = 0;
        reasonOverride = 'Chronic dropper - no boost applied';
        debugLog(`[ClassDrop] #${horse.programNumber}: Chronic dropper filter - boost zeroed`);
      }
    }

    // Safety filter 2: Negative form (last 2 speed figures declining)
    if (signalBoost > 0 && pastPerformances.length >= 2) {
      const fig1 = pastPerformances[0]?.speedFigures?.beyer ?? null;
      const fig2 = pastPerformances[1]?.speedFigures?.beyer ?? null;

      if (fig1 !== null && fig2 !== null && fig1 < fig2) {
        // Speed figures declining
        const fig3 = pastPerformances[2]?.speedFigures?.beyer ?? null;
        if (fig3 === null || fig2 < fig3) {
          // Two consecutive declines
          safetyFiltersApplied.push('negative form (declining speed figures)');
          signalBoost = Math.max(0, signalBoost - 0.5);
          debugLog(
            `[ClassDrop] #${horse.programNumber}: Negative form filter - boost reduced by 0.5`
          );
        }
      }
    }

    // Safety filter 3: Long layoff (>180 days since last race AND major drop)
    if (signalBoost > 0 && classification === 'MAJOR') {
      const daysSinceLastRace = horse.daysSinceLastRace ?? 0;
      if (daysSinceLastRace > 180) {
        safetyFiltersApplied.push('long layoff (>180 days) + major drop');
        signalBoost = Math.min(1.0, signalBoost);
        debugLog(`[ClassDrop] #${horse.programNumber}: Long layoff filter - boost capped at 1.0`);
      }
    }

    // Apply 0.9x multiplier for 2-race baseline
    if (pastPerformances.length === 2 && signalBoost > 0) {
      signalBoost = signalBoost * 0.9;
      safetyFiltersApplied.push('2-race baseline (0.9x multiplier)');
    }

    // Build reason string
    const reason =
      reasonOverride ||
      `${classification} class drop: ${(dropPercentage * 100).toFixed(0)}% ` +
        `(baseline: $${baseline.toLocaleString()}, today: $${todayClass.toLocaleString()})`;

    horses.push({
      programNumber: horse.programNumber,
      horseName: horse.horseName,
      baselineClass: baseline,
      todayClass,
      dropPercentage,
      classification,
      signalBoost,
      flagged: classification !== null && signalBoost !== 0,
      reason,
      safetyFiltersApplied,
    });

    debugLog(
      `[ClassDrop] #${horse.programNumber} ${horse.horseName}: ${classification} ${(dropPercentage * 100).toFixed(1)}% boost=${signalBoost}`
    );
  }

  return {
    raceId,
    horses,
    analysisTimestamp: Date.now(),
  };
}

// ============================================================================
// MULTI-BOT PARALLEL ARCHITECTURE
// ============================================================================

/**
 * Get AI analysis using multi-bot parallel architecture
 *
 * Launches 5 specialized bots:
 * 1. Trip Trouble Bot - Identifies horses with masked ability
 * 2. Pace Scenario Bot - Analyzes pace dynamics
 * 3. Vulnerable Favorite Bot - Evaluates if favorite is beatable
 * 4. Field Spread Bot - Assesses competitive separation
 * 5. Class Drop Bot - Identifies significant class drops (reinforcement-only)
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

  // Launch the 4 AI bots in parallel with Promise.allSettled
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
    // Class Drop Bot runs synchronously (no API call needed)
    classDrop: null,
  };

  // Run Class Drop Bot (synchronous - local analysis, no API call)
  try {
    rawResults.classDrop = analyzeClassDrop(race, scoringResult);
    debugLog(`[ClassDrop] Bot completed - ${rawResults.classDrop.horses.length} horses analyzed`);
  } catch (err) {
    debugError(`ClassDrop bot error:`, err instanceof Error ? err.message : err);
    rawResults.classDrop = null;
  }

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
 * Collects signals from all 5 bots and calculates total adjustment
 *
 * CONSERVATIVE MODE (default) - TUNED THRESHOLDS:
 * - Trip trouble: +2 for HIGH confidence (2+ troubled races), +1 for MEDIUM
 * - Pace advantage: +2 for STRONG (lone speed), +1 for MODERATE
 * - Vulnerable favorite: -2 if HIGH confidence, -1 if MEDIUM confidence
 * - Class drop: REINFORCEMENT-ONLY - only applies if another bot flagged the horse
 * - Competitive field: reduce adjustments by 25% (not 50%)
 * - Minimum for rank change: ±1
 * - Max position movement: 2 positions
 *
 * @param programNumber - Horse's program number
 * @param horseName - Horse name
 * @param algorithmRank - Original algorithm rank
 * @param algorithmScore - Original algorithm score
 * @param rawResults - Raw results from all 5 bots
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
  const { tripTrouble, paceScenario, vulnerableFavorite, fieldSpread, classDrop } = rawResults;
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
    classDropBoost: 0,
    classDropFlagged: false,
    classDropReason: null,
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
  // CLASS DROP SIGNALS (REINFORCEMENT-ONLY)
  // =========================================================================
  // CRITICAL: Class Drop can ONLY strengthen horses already flagged by other bots.
  // It cannot create value candidates on its own. This prevents the failure mode
  // where class drop creates too many weak candidates.
  if (classDrop) {
    const classDropHorse = classDrop.horses.find((h) => h.programNumber === programNumber);
    if (classDropHorse && classDropHorse.flagged) {
      // Store the raw class drop data
      signals.classDropFlagged = true;
      signals.classDropReason = classDropHorse.reason;

      // REINFORCEMENT-ONLY: Only apply boost if another bot already flagged this horse
      const hasOtherBotFlag =
        signals.tripTroubleFlagged || (signals.paceAdvantageFlagged && signals.paceAdvantage > 0);

      if (hasOtherBotFlag) {
        // Apply the class drop boost
        signals.classDropBoost = classDropHorse.signalBoost;
        signals.signalCount++;

        // Determine confidence based on classification
        let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
        if (classDropHorse.classification === 'MAJOR') {
          confidence = 'HIGH';
        } else if (
          classDropHorse.classification === 'MINOR' ||
          classDropHorse.classification === 'RISING'
        ) {
          confidence = 'LOW';
        }

        signals.overrideReasons.push({
          signal: 'classDrop',
          confidence,
          description: classDropHorse.reason || `Class drop ${classDropHorse.classification}`,
        });

        debugLog(
          `[ClassDrop] #${programNumber}: Reinforcement applied - boost=${signals.classDropBoost}`
        );
      } else {
        // REINFORCEMENT-ONLY: No other bot flagged this horse, so classDropBoost = 0
        signals.classDropBoost = 0;
        debugLog(`[ClassDrop] #${programNumber}: No reinforcement - not flagged by other bots`);
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
  // RECALIBRATED: HIGH = -2, MEDIUM = -1
  // NON-CONSERVATIVE: -2 (HIGH) or -1 (MEDIUM)
  if (signals.isVulnerable && vulnerableFavorite) {
    const flagCount = signals.vulnerabilityFlags.length;

    if (conservativeMode) {
      // RECALIBRATED: HIGH = -2, MEDIUM = -1
      if (vulnerableFavorite.confidence === 'HIGH') {
        totalAdj -= 2;
        signals.overrideReasons.push({
          signal: 'vulnerableFavorite',
          confidence: 'HIGH',
          description: `Vulnerable favorite HIGH with ${flagCount} flags: ${signals.vulnerabilityFlags.slice(0, 2).join(', ')}`,
        });
      } else if (vulnerableFavorite.confidence === 'MEDIUM') {
        // MEDIUM confidence: -1 penalty (allows MEDIUM vulnerables to influence template)
        totalAdj -= 1;
        signals.overrideReasons.push({
          signal: 'vulnerableFavorite',
          confidence: 'MEDIUM',
          description: `Vulnerable favorite MEDIUM with ${flagCount} flags: ${signals.vulnerabilityFlags.slice(0, 2).join(', ')}`,
        });
      }
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

  // Class drop boost (reinforcement-only - already filtered above)
  totalAdj += signals.classDropBoost;

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
      // Build reason from contributing signals
      const reasons: string[] = [];
      if (signal.tripTroubleBoost > 0) reasons.push('trip trouble');
      if (signal.paceAdvantage > 0) reasons.push('pace advantage');
      if (signal.paceAdvantage < 0) reasons.push('pace disadvantage');
      if (signal.isVulnerable) reasons.push('vulnerable favorite');

      if (reasons.length > 0) {
        reason = reasons.join(' + ');
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
// DEPRECATED: EXPANSION/CONTRACTION BET CONSTRUCTION MODEL
// ============================================================================

/**
 * @deprecated This function is no longer used. Expansion horses (rank 5-10) were not
 * hitting the board according to six-model analysis. Use buildTicketConstruction() instead.
 *
 * Always returns an empty array for backward compatibility.
 *
 * @param _aggregatedSignals - Unused
 * @param _scores - Unused
 * @returns Empty array (expansion horses removed)
 */
export function identifyExpansionHorses(
  _aggregatedSignals: AggregatedSignals[],
  _scores: RaceScoringResult['scores']
): number[] {
  // Expansion horses are no longer identified - they weren't hitting the board
  return [];
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

// ============================================================================
// THREE-TEMPLATE TICKET CONSTRUCTION SYSTEM
// ============================================================================

/**
 * Derive race type from field spread analysis or score gaps
 *
 * If Field Spread bot returns WIDE_OPEN, use that directly.
 * Otherwise, derive from score gaps: top 6 within 30 points = WIDE_OPEN
 *
 * @param fieldSpread - Field spread analysis from bot
 * @param aggregatedSignals - Signals for all horses (for score gap fallback)
 * @returns Race type classification
 */
export function deriveRaceType(
  fieldSpread: FieldSpreadAnalysis | null,
  aggregatedSignals: AggregatedSignals[]
): RaceType {
  // Direct mapping from field spread bot
  if (fieldSpread?.fieldType === 'WIDE_OPEN') {
    return 'WIDE_OPEN';
  }

  if (fieldSpread?.fieldType === 'DOMINANT' || fieldSpread?.fieldType === 'SEPARATED') {
    return 'CHALK';
  }

  if (fieldSpread?.fieldType === 'COMPETITIVE' || fieldSpread?.fieldType === 'MIXED') {
    return 'COMPETITIVE';
  }

  // Fallback: derive from score gaps
  // Sort by algorithm score descending
  const sortedByScore = [...aggregatedSignals].sort((a, b) => b.algorithmScore - a.algorithmScore);
  const top6 = sortedByScore.slice(0, 6);

  if (top6.length >= 6) {
    const maxScore = top6[0]?.algorithmScore ?? 0;
    const minScore = top6[5]?.algorithmScore ?? 0;

    // Top 6 within 30 points = WIDE_OPEN
    if (maxScore - minScore <= 30) {
      return 'WIDE_OPEN';
    }
  }

  // Check for clear separation (top horse 20+ points ahead of #2)
  if (sortedByScore.length >= 2) {
    const topScore = sortedByScore[0]?.algorithmScore ?? 0;
    const secondScore = sortedByScore[1]?.algorithmScore ?? 0;

    if (topScore - secondScore >= 20) {
      return 'CHALK';
    }
  }

  return 'COMPETITIVE';
}

/**
 * Determine favorite status from vulnerable favorite analysis
 *
 * RECALIBRATED CRITERIA (targeting 40-50% vulnerable rate):
 * - 0-1 flags → SOLID (regardless of bot output)
 * - 2+ flags with HIGH or MEDIUM confidence → VULNERABLE
 * - 2+ flags with LOW confidence → SOLID
 *
 * @param vulnerableFavorite - Vulnerable favorite analysis from bot
 * @returns Tuple of [status, flags]
 */
export function determineFavoriteStatus(
  vulnerableFavorite: VulnerableFavoriteAnalysis | null
): [FavoriteStatus, string[]] {
  if (!vulnerableFavorite) {
    return ['SOLID', []];
  }

  // Not vulnerable according to bot - SOLID
  if (!vulnerableFavorite.isVulnerable) {
    return ['SOLID', []];
  }

  // Count vulnerability flags
  const flagCount = vulnerableFavorite.reasons?.length ?? 0;

  // 0-1 flags → SOLID (regardless of bot output)
  if (flagCount <= 1) {
    console.log(`[VULN] SOLID: Only ${flagCount} flag(s), requires 2+ for vulnerable status`);
    return ['SOLID', []];
  }

  // 2+ flags with HIGH or MEDIUM confidence → VULNERABLE
  if (vulnerableFavorite.confidence === 'HIGH' || vulnerableFavorite.confidence === 'MEDIUM') {
    console.log(
      `[VULN] VULNERABLE: ${flagCount} flags with ${vulnerableFavorite.confidence} confidence - ${vulnerableFavorite.reasons.join(', ')}`
    );
    return ['VULNERABLE', vulnerableFavorite.reasons];
  }

  // 2+ flags with LOW confidence → SOLID (not confident enough)
  console.log(`[VULN] SOLID: ${flagCount} flags but confidence is LOW, requires HIGH or MEDIUM`);
  return ['SOLID', []];
}

/**
 * Identify value horse from bot outputs
 *
 * A race is bettable (HIGH/MEDIUM/LOW) ONLY when bots identify a specific value horse.
 * The value horse must be explicitly identified with a specific angle:
 * - Pace advantage (Pace Scenario Bot)
 * - Troubled trip excuse (Trip Trouble Bot)
 * - Vulnerable favorite creating opportunity (Vulnerable Favorite Bot)
 * - Wide open field with no deserving favorite (Field Spread Bot)
 * - Class Drop Bot (REINFORCEMENT-ONLY: only strengthens existing candidates)
 *
 * @param aggregatedSignals - Signals for all horses
 * @param rawResults - Raw bot results
 * @param favoriteStatus - Whether favorite is SOLID or VULNERABLE
 * @returns ValueHorseIdentification object
 */
export function identifyValueHorse(
  aggregatedSignals: AggregatedSignals[],
  rawResults: MultiBotRawResults,
  favoriteStatus: FavoriteStatus
): ValueHorseIdentification {
  const { tripTrouble, paceScenario, vulnerableFavorite, fieldSpread } = rawResults;

  // Track candidates with their sources and signals
  interface ValueCandidate {
    programNumber: number;
    horseName: string;
    sources: ValueHorseSource[];
    angles: string[];
    signalStrength: number; // 0-100
    botCount: number;
  }

  const candidates: Map<number, ValueCandidate> = new Map();

  // Helper to add/update a candidate
  const addCandidate = (
    programNumber: number,
    horseName: string,
    source: ValueHorseSource,
    angle: string,
    strengthBonus: number
  ): void => {
    const existing = candidates.get(programNumber);
    if (existing) {
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
        existing.botCount++;
      }
      existing.angles.push(angle);
      existing.signalStrength += strengthBonus;
    } else {
      candidates.set(programNumber, {
        programNumber,
        horseName,
        sources: [source],
        angles: [angle],
        signalStrength: strengthBonus,
        botCount: 1,
      });
    }
  };

  // 1. TRIP TROUBLE: Identify horses with masked ability
  if (tripTrouble?.horsesWithTripTrouble) {
    for (const horse of tripTrouble.horsesWithTripTrouble) {
      if (horse.maskedAbility) {
        // HIGH confidence: multiple troubled trips
        const isHighConfidence =
          horse.issue.includes('last 2') ||
          horse.issue.includes('last 3') ||
          horse.issue.includes('multiple') ||
          horse.issue.includes('consecutive');
        const strengthBonus = isHighConfidence ? 30 : 15;
        const angle = `Trip trouble: ${horse.issue}`;
        addCandidate(horse.programNumber, horse.horseName, 'TRIP_TROUBLE', angle, strengthBonus);
      }
    }
  }

  // 2. PACE ADVANTAGE: Identify horses with tactical edge
  if (paceScenario) {
    // Lone speed is a very strong signal
    if (paceScenario.loneSpeedException) {
      // Find the lone speed horse from aggregated signals
      for (const signal of aggregatedSignals) {
        if (signal.paceAdvantage > 0 && signal.paceEdgeReason?.includes('Lone speed')) {
          const strengthBonus = 35; // Dominant pace advantage = 15+ point edge
          const angle = 'Lone speed with no pressure - dominant pace advantage';
          addCandidate(
            signal.programNumber,
            signal.horseName,
            'PACE_ADVANTAGE',
            angle,
            strengthBonus
          );
        }
      }
    }

    // Speed duel benefits closers
    if (paceScenario.speedDuelLikely && paceScenario.paceProjection === 'HOT') {
      for (const signal of aggregatedSignals) {
        if (signal.paceAdvantage > 0 && !signal.paceEdgeReason?.includes('Lone speed')) {
          const strengthBonus = 20;
          const angle = 'Closer benefits from expected speed duel and hot pace';
          addCandidate(
            signal.programNumber,
            signal.horseName,
            'PACE_ADVANTAGE',
            angle,
            strengthBonus
          );
        }
      }
    }

    // Any horse with pace advantage flagged
    for (const signal of aggregatedSignals) {
      if (signal.paceAdvantageFlagged && signal.paceAdvantage > 0 && signal.algorithmRank >= 2) {
        const existing = candidates.get(signal.programNumber);
        if (!existing?.sources.includes('PACE_ADVANTAGE')) {
          const strengthBonus = signal.paceAdvantage >= 2 ? 25 : 15;
          const angle = signal.paceEdgeReason || 'Pace scenario advantage';
          addCandidate(
            signal.programNumber,
            signal.horseName,
            'PACE_ADVANTAGE',
            angle,
            strengthBonus
          );
        }
      }
    }
  }

  // 3. VULNERABLE FAVORITE: When favorite is vulnerable, find the beneficiary
  if (favoriteStatus === 'VULNERABLE' && vulnerableFavorite?.isVulnerable) {
    // The algorithm rank 2 horse benefits most from vulnerable favorite
    const rank2Horse = aggregatedSignals.find((s) => s.algorithmRank === 2);
    if (rank2Horse) {
      const strengthBonus = vulnerableFavorite.confidence === 'HIGH' ? 25 : 15;
      const reasons = vulnerableFavorite.reasons?.slice(0, 2).join(', ') || 'Vulnerable favorite';
      const angle = `Beneficiary of vulnerable favorite: ${reasons}`;
      addCandidate(
        rank2Horse.programNumber,
        rank2Horse.horseName,
        'VULNERABLE_FAVORITE',
        angle,
        strengthBonus
      );
    }

    // Also check rank 3 if it has other positive signals
    const rank3Horse = aggregatedSignals.find((s) => s.algorithmRank === 3);
    if (rank3Horse && (rank3Horse.tripTroubleBoost > 0 || rank3Horse.paceAdvantage > 0)) {
      const strengthBonus = 15;
      const angle = 'Secondary beneficiary of vulnerable favorite with supporting signals';
      addCandidate(
        rank3Horse.programNumber,
        rank3Horse.horseName,
        'VULNERABLE_FAVORITE',
        angle,
        strengthBonus
      );
    }
  }

  // 4. FIELD SPREAD: Wide open field - check for value horses identified
  if (fieldSpread?.fieldType === 'WIDE_OPEN' && fieldSpread.horseClassifications) {
    // In wide open fields, key candidates at good odds are value plays
    for (const classification of fieldSpread.horseClassifications) {
      if (classification.keyCandidate && classification.classification === 'A') {
        const strengthBonus = 15;
        const angle = `Field spread analysis: ${classification.reason}`;
        addCandidate(
          classification.programNumber,
          classification.horseName,
          'FIELD_SPREAD',
          angle,
          strengthBonus
        );
      }
    }
  }

  // 5. CLASS DROP REINFORCEMENT (REINFORCEMENT-ONLY)
  // CRITICAL: Class Drop cannot CREATE new value candidates - it can only STRENGTHEN
  // existing candidates that were already flagged by other bots.
  // This is the key to preventing the failure mode where class drop creates weak candidates.
  const { classDrop } = rawResults;
  if (classDrop?.horses) {
    for (const classDropHorse of classDrop.horses) {
      // Only process horses that were flagged by class drop
      if (!classDropHorse.flagged || classDropHorse.signalBoost === 0) continue;

      // Check if this horse already exists as a candidate (flagged by another bot)
      const existingCandidate = candidates.get(classDropHorse.programNumber);

      if (existingCandidate) {
        // REINFORCEMENT: Horse is already a candidate - strengthen it
        // Convert signalBoost (0.5, 1.0, 1.5, -0.5) to strengthBonus (scale by 10)
        const strengthBonus = classDropHorse.signalBoost * 10;
        existingCandidate.signalStrength += strengthBonus;
        // Class Drop is reinforcement-only - does not count toward bot convergence
        existingCandidate.angles.push(
          classDropHorse.reason || `Class drop ${classDropHorse.classification}`
        );

        debugLog(
          `[ClassDrop] Reinforced #${classDropHorse.programNumber} ${classDropHorse.horseName}: ` +
            `+${strengthBonus} strength (reinforcement-only, botCount unchanged at ${existingCandidate.botCount})`
        );
      } else {
        // NOT a candidate - Class Drop does NOT create new candidates
        debugLog(
          `[ClassDrop] Skipped #${classDropHorse.programNumber} ${classDropHorse.horseName}: ` +
            `Not flagged by other bots (reinforcement-only)`
        );
      }
    }
  }

  // Find the best candidate
  if (candidates.size === 0) {
    // No value horse identified
    return {
      identified: false,
      programNumber: null,
      horseName: null,
      sources: [],
      signalStrength: 'NONE',
      angle: null,
      valueOdds: null,
      botConvergenceCount: 0,
      reasoning: 'No bots identified a specific value horse with exploitable angle',
    };
  }

  // Sort candidates by signal strength (bot convergence is a major factor)
  const sortedCandidates = Array.from(candidates.values()).sort((a, b) => {
    // Prioritize bot convergence (multiple bots agreeing)
    if (a.botCount !== b.botCount) {
      return b.botCount - a.botCount;
    }
    // Then by signal strength
    return b.signalStrength - a.signalStrength;
  });

  const bestCandidate = sortedCandidates[0];
  if (!bestCandidate) {
    return {
      identified: false,
      programNumber: null,
      horseName: null,
      sources: [],
      signalStrength: 'NONE',
      angle: null,
      valueOdds: null,
      botConvergenceCount: 0,
      reasoning: 'No value horse candidates found',
    };
  }

  // ============================================================================
  // CRITICAL FIX: For SOLID favorites, require stronger evidence to identify value horse
  // Single-bot signals with LOW confidence are NOT enough to justify Template A.
  //
  // RULE: SOLID favorite + no value horse = PASS (→ MINIMAL tier)
  // Template A should trigger when there's evidence of value:
  // - 1+ bots with HIGH confidence signal (30+ strength), OR
  // - 2+ bots converging on the same horse
  //
  // Single MEDIUM confidence signals (15-29 strength) are still rejected for SOLID favorites.
  // This balances capturing HIGH confidence single-bot signals while preventing weak leaks.
  // ============================================================================
  if (favoriteStatus === 'SOLID') {
    const requiresStrongerEvidence =
      bestCandidate.botCount < 1 && bestCandidate.signalStrength < 30;

    if (requiresStrongerEvidence) {
      console.log(
        `[VALUE] SOLID favorite filter: Rejecting weak value horse identification. ` +
          `Horse #${bestCandidate.programNumber} ${bestCandidate.horseName} ` +
          `(botCount=${bestCandidate.botCount}, strength=${bestCandidate.signalStrength}). ` +
          `Requires 1+ bots with strength >= 30 for SOLID favorites.`
      );
      return {
        identified: false,
        programNumber: null,
        horseName: null,
        sources: [],
        signalStrength: 'NONE',
        angle: null,
        valueOdds: null,
        botConvergenceCount: 0,
        reasoning: `SOLID favorite: Weak value signal rejected (${bestCandidate.botCount} bot(s), strength ${bestCandidate.signalStrength}). Requires 1+ bots with strength >= 30.`,
      };
    }

    // Log when identified under relaxed threshold (single bot with HIGH confidence 30-49)
    if (
      bestCandidate.botCount === 1 &&
      bestCandidate.signalStrength >= 30 &&
      bestCandidate.signalStrength < 50
    ) {
      console.log(
        `[VALUE_HORSE] Identified under relaxed threshold: ${bestCandidate.horseName}, ` +
          `botCount: ${bestCandidate.botCount}, signalStrength: ${bestCandidate.signalStrength}`
      );
    }

    console.log(
      `[VALUE] SOLID favorite filter: Accepting value horse #${bestCandidate.programNumber} ` +
        `(botCount=${bestCandidate.botCount}, strength=${bestCandidate.signalStrength}) - meets threshold.`
    );
  }

  // Determine signal strength based on cutoffs from requirements
  // HIGH (80-100): 3+ bots OR 2 bots with strong data OR dominant pace (15+ point edge)
  // MEDIUM (60-79): 2 bots OR 1 bot with strong signal + supporting algorithm data
  // LOW (40-59): 1 bot with potential value
  // MINIMAL (<40): No value horse identified
  let signalStrength: ValueSignalStrength;
  if (bestCandidate.botCount >= 3 || bestCandidate.signalStrength >= 80) {
    signalStrength = 'VERY_STRONG';
  } else if (bestCandidate.botCount === 2 || bestCandidate.signalStrength >= 50) {
    signalStrength = 'STRONG';
  } else if (bestCandidate.signalStrength >= 30) {
    signalStrength = 'MODERATE';
  } else {
    signalStrength = 'WEAK';
  }

  // Mark as MULTIPLE source if bot count >= 2
  const sources: ValueHorseSource[] =
    bestCandidate.botCount >= 2 ? ['MULTIPLE', ...bestCandidate.sources] : bestCandidate.sources;

  // Build reasoning string
  const reasoning =
    bestCandidate.botCount >= 3
      ? `${bestCandidate.botCount} bots converge on #${bestCandidate.programNumber} ${bestCandidate.horseName}`
      : bestCandidate.botCount === 2
        ? `2 bots identify #${bestCandidate.programNumber} ${bestCandidate.horseName} as value play`
        : `Single bot flags #${bestCandidate.programNumber} ${bestCandidate.horseName} with ${bestCandidate.angles[0]}`;

  return {
    identified: true,
    programNumber: bestCandidate.programNumber,
    horseName: bestCandidate.horseName,
    sources: sources,
    signalStrength,
    angle: bestCandidate.angles[0] || null,
    valueOdds: null, // TODO: Could pull from scoring result if needed
    botConvergenceCount: bestCandidate.botCount,
    reasoning,
  };
}

/**
 * Select template based on race type, favorite status, and value horse identification
 *
 * CRITICAL CHANGE: Template A (Solid Favorite) now routes to MINIMAL tier because
 * "solid favorite" means "market is right" which means no value edge exists.
 *
 * Priority:
 * 1. If WIDE_OPEN → Template C (regardless of favorite status)
 * 2. Else if VULNERABLE favorite → Template B (value in fading favorite)
 * 3. Else if SOLID favorite WITH value horse identified → Template A (algorithm pick)
 * 4. Else if SOLID favorite WITHOUT value horse → PASS (route to MINIMAL)
 *
 * @param raceType - Race classification
 * @param favoriteStatus - Favorite status
 * @param vulnerableFavorite - Vulnerable favorite analysis (for confidence check)
 * @param valueHorse - Value horse identification result
 * @returns Tuple of [template, reason]
 */
export function selectTemplate(
  raceType: RaceType,
  favoriteStatus: FavoriteStatus,
  vulnerableFavorite: VulnerableFavoriteAnalysis | null,
  valueHorse?: ValueHorseIdentification
): [TicketTemplate, string] {
  // Priority 1: WIDE_OPEN field → Template C
  if (raceType === 'WIDE_OPEN') {
    // Even in wide open, check if value horse was identified
    if (valueHorse?.identified) {
      return [
        'C',
        `Wide open field with value horse #${valueHorse.programNumber} identified - spread recommended`,
      ];
    }
    return ['C', 'Wide open field - full box recommended'];
  }

  // Priority 2: VULNERABLE favorite with HIGH/MEDIUM confidence → Template B
  if (favoriteStatus === 'VULNERABLE') {
    const confidence = vulnerableFavorite?.confidence ?? 'MEDIUM';
    const flagCount = vulnerableFavorite?.reasons?.length ?? 0;
    return [
      'B',
      `Vulnerable favorite (${confidence} confidence, ${flagCount} flags) - demote from win position`,
    ];
  }

  // Priority 3: SOLID favorite - check for value horse
  // CRITICAL: If no value horse is identified, route to PASS (→ MINIMAL tier)
  // This is because Template A (solid favorite) historically has -59% trifecta ROI
  if (!valueHorse?.identified) {
    return [
      'PASS',
      'Solid favorite with no identified value horse - algorithm picks only, no AI bet recommendation',
    ];
  }

  // Priority 4: SOLID favorite WITH value horse identified → Template A
  // This rare case means bots found a value horse despite solid favorite
  return [
    'A',
    `Solid favorite but value horse #${valueHorse.programNumber} identified: ${valueHorse.angle || 'edge detected'}`,
  ];
}

/**
 * Calculate valid exacta combinations
 * Exacta: win × place minus same-horse combos
 *
 * @param winPosition - Horses in win position
 * @param placePosition - Horses in place position
 * @returns Number of valid combinations
 */
export function calculateExactaCombinations(
  winPosition: number[],
  placePosition: number[]
): number {
  let combinations = 0;

  for (const win of winPosition) {
    for (const place of placePosition) {
      // Can't have same horse in both positions
      if (win !== place) {
        combinations++;
      }
    }
  }

  return combinations;
}

/**
 * Calculate valid trifecta combinations
 * Trifecta: win × place × show minus invalid combos where same horse appears twice
 *
 * @param winPosition - Horses in win position
 * @param placePosition - Horses in place position
 * @param showPosition - Horses in show position
 * @returns Number of valid combinations
 */
export function calculateTrifectaCombinations(
  winPosition: number[],
  placePosition: number[],
  showPosition: number[]
): number {
  let combinations = 0;

  for (const win of winPosition) {
    for (const place of placePosition) {
      if (win === place) continue; // Same horse can't be in win and place

      for (const show of showPosition) {
        // Same horse can't appear in multiple positions
        if (show !== win && show !== place) {
          combinations++;
        }
      }
    }
  }

  return combinations;
}

/**
 * Build exacta ticket based on template
 *
 * Template A: winPosition = [1], placePosition = [2,3,4]
 * Template B: winPosition = [2,3,4], placePosition = [1,2,3,4]
 * Template C: winPosition = [1,2,3,4], placePosition = [1,2,3,4]
 *
 * @param template - Selected template (A, B, or C)
 * @param algorithmTop4 - Algorithm's top 4 horses (program numbers in rank order)
 * @returns ExactaConstruction object
 */
export function buildExactaTicket(
  template: TicketTemplate,
  algorithmTop4: number[]
): ExactaConstruction {
  const [rank1, rank2, rank3, rank4] = algorithmTop4;

  let winPosition: number[];
  let placePosition: number[];

  switch (template) {
    case 'A':
      // Solid Favorite: 1 WITH 2,3,4 (3 combinations)
      winPosition = rank1 !== undefined ? [rank1] : [];
      placePosition = [rank2, rank3, rank4].filter((n): n is number => n !== undefined);
      break;

    case 'B':
      // Vulnerable Favorite: 2,3,4 WITH 1,2,3,4 (9 combinations)
      // Favorite demoted to place only
      winPosition = [rank2, rank3, rank4].filter((n): n is number => n !== undefined);
      placePosition = [rank1, rank2, rank3, rank4].filter((n): n is number => n !== undefined);
      break;

    case 'C':
      // Wide Open: Box 1,2,3,4 (12 combinations)
      winPosition = [rank1, rank2, rank3, rank4].filter((n): n is number => n !== undefined);
      placePosition = [rank1, rank2, rank3, rank4].filter((n): n is number => n !== undefined);
      break;

    default:
      winPosition = [];
      placePosition = [];
  }

  const combinations = calculateExactaCombinations(winPosition, placePosition);
  const estimatedCost = combinations * 2; // $2 base

  return {
    winPosition,
    placePosition,
    combinations,
    estimatedCost,
  };
}

/**
 * Build trifecta ticket based on template
 *
 * Template A: win = [1], place = [2,3,4], show = [2,3,4]
 * Template B: win = [2,3,4], place = [1,2,3,4], show = [1,2,3,4]
 * Template C: win = [1,2,3,4,5], place = [1,2,3,4,5], show = [1,2,3,4,5]
 *
 * @param template - Selected template (A, B, or C)
 * @param algorithmTop4 - Algorithm's top 4 horses (program numbers in rank order)
 * @param algorithmTop5 - Algorithm's top 5 horses (for Template C)
 * @returns TrifectaConstruction object
 */
export function buildTrifectaTicket(
  template: TicketTemplate,
  algorithmTop4: number[],
  algorithmTop5: number[]
): TrifectaConstruction {
  const [rank1, rank2, rank3, rank4] = algorithmTop4;
  const rank5 = algorithmTop5[4];

  let winPosition: number[];
  let placePosition: number[];
  let showPosition: number[];

  switch (template) {
    case 'A':
      // Solid Favorite: 1 WITH 2,3,4 WITH 2,3,4 (6 combinations)
      winPosition = rank1 !== undefined ? [rank1] : [];
      placePosition = [rank2, rank3, rank4].filter((n): n is number => n !== undefined);
      showPosition = [rank2, rank3, rank4].filter((n): n is number => n !== undefined);
      break;

    case 'B':
      // Vulnerable Favorite: 2,3,4 WITH 1,2,3,4 WITH 1,2,3,4 (18 combinations)
      winPosition = [rank2, rank3, rank4].filter((n): n is number => n !== undefined);
      placePosition = [rank1, rank2, rank3, rank4].filter((n): n is number => n !== undefined);
      showPosition = [rank1, rank2, rank3, rank4].filter((n): n is number => n !== undefined);
      break;

    case 'C':
      // Wide Open: Box 1,2,3,4,5 (60 combinations)
      winPosition = [rank1, rank2, rank3, rank4, rank5].filter((n): n is number => n !== undefined);
      placePosition = [rank1, rank2, rank3, rank4, rank5].filter(
        (n): n is number => n !== undefined
      );
      showPosition = [rank1, rank2, rank3, rank4, rank5].filter(
        (n): n is number => n !== undefined
      );
      break;

    default:
      winPosition = [];
      placePosition = [];
      showPosition = [];
  }

  const combinations = calculateTrifectaCombinations(winPosition, placePosition, showPosition);
  const estimatedCost = combinations * 1; // $1 base

  return {
    winPosition,
    placePosition,
    showPosition,
    combinations,
    estimatedCost,
  };
}

/**
 * Calculate confidence score for the race
 *
 * NEW VALUE-BASED CUTOFFS (rewired for value horse identification):
 *
 * The confidence score now reflects VALUE HORSE SIGNAL STRENGTH:
 *
 * HIGH (80-100): Multiple bots converge on same value horse OR single bot with very strong signal
 *   - 3+ bots identify same horse as value play, OR
 *   - 2 bots identify same horse with strong supporting data, OR
 *   - Pace Scenario Bot shows dominant pace advantage (15+ point edge / lone speed)
 *
 * MEDIUM (60-79): Clear value horse identified with solid angle
 *   - 2 bots identify same value horse, OR
 *   - 1 bot with strong signal + supporting algorithm data (horse ranks top 3 but odds suggest top 6+)
 *
 * LOW (40-59): Weak but present value signal
 *   - 1 bot identifies potential value horse, OR
 *   - Vulnerable favorite flagged + algorithm suggests specific alternative
 *
 * MINIMAL (0-39): No value horse identified
 *   - Solid favorite (no vulnerability flags), OR
 *   - Vulnerable favorite but no clear alternative identified, OR
 *   - Bots return conflicting signals with no consensus
 *
 * These cutoffs are DETERMINISTIC — same inputs always produce same tier.
 *
 * @param raceType - Race classification
 * @param vulnerableFavorite - Vulnerable favorite analysis
 * @param aggregatedSignals - Signals for all horses
 * @param valueHorse - Value horse identification result
 * @param favoriteStatus - Favorite status (SOLID or VULNERABLE)
 * @returns Confidence score 0-100
 */
export function calculateConfidenceScore(
  raceType: RaceType,
  vulnerableFavorite: VulnerableFavoriteAnalysis | null,
  aggregatedSignals: AggregatedSignals[],
  valueHorse?: ValueHorseIdentification,
  favoriteStatus?: FavoriteStatus
): number {
  // Track breakdown for debug logging
  const bonusBreakdown: { name: string; value: number }[] = [];

  // ============================================================================
  // CRITICAL: If no value horse identified AND solid favorite → MINIMAL tier
  // This implements the core requirement: Template A races route to MINIMAL
  // ============================================================================
  const isSolidFavorite = favoriteStatus === 'SOLID' || !vulnerableFavorite?.isVulnerable;

  if (!valueHorse?.identified && isSolidFavorite) {
    // No value horse + solid favorite = MINIMAL tier (0-39)
    // Return a score in the MINIMAL range
    const baseScore = 25; // Middle of MINIMAL range
    debugLog('[Confidence] MINIMAL tier: Solid favorite with no identified value horse');
    debugLog(`  Final: ${baseScore} (MINIMAL tier)`);
    return baseScore;
  }

  // ============================================================================
  // VALUE-BASED CONFIDENCE SCORING
  // ============================================================================

  let score: number;

  if (!valueHorse?.identified) {
    // No value horse but vulnerable favorite - LOW tier (40-59)
    // At least there's opportunity from vulnerable favorite
    score = 45;
    bonusBreakdown.push({ name: 'No value horse (vulnerable fav)', value: 45 });
  } else {
    // Value horse identified - score based on signal strength
    switch (valueHorse.signalStrength) {
      case 'VERY_STRONG':
        // HIGH tier (80-100): 3+ bots converge OR dominant signal
        score = 85;
        bonusBreakdown.push({
          name: `Very Strong Signal (${valueHorse.botConvergenceCount} bots)`,
          value: 85,
        });
        break;
      case 'STRONG':
        // HIGH tier (80-100): 2 bots with strong data
        score = 80;
        bonusBreakdown.push({
          name: `Strong Signal (${valueHorse.botConvergenceCount} bots)`,
          value: 80,
        });
        break;
      case 'MODERATE':
        // MEDIUM tier (60-79): Clear value horse with solid angle
        score = 70;
        bonusBreakdown.push({
          name: `Moderate Signal (${valueHorse.botConvergenceCount} bot)`,
          value: 70,
        });
        break;
      case 'WEAK':
        // LOW tier (40-59): Weak but present value signal
        score = 50;
        bonusBreakdown.push({ name: 'Weak Signal (1 bot)', value: 50 });
        break;
      default:
        // Fallback - should not reach here
        score = 45;
        bonusBreakdown.push({ name: 'Default (no signal)', value: 45 });
    }
  }

  // ============================================================================
  // ADJUSTMENTS (maintain some existing logic for refinement)
  // ============================================================================

  // Race type adjustment - wide open is more uncertain
  if (raceType === 'WIDE_OPEN') {
    const penalty = -10;
    score += penalty;
    bonusBreakdown.push({ name: 'Wide Open Field', value: penalty });
  }

  // Bot convergence bonus - if multiple bots agree on value horse
  if (valueHorse?.identified && valueHorse.botConvergenceCount >= 3) {
    const bonus = 10;
    score += bonus;
    bonusBreakdown.push({
      name: `Bot Convergence (${valueHorse.botConvergenceCount} bots)`,
      value: bonus,
    });
  }

  // Algorithm margin bonus - check point separation
  const topHorse = aggregatedSignals.find((s) => s.algorithmRank === 1);
  const secondHorse = aggregatedSignals.find((s) => s.algorithmRank === 2);
  if (topHorse && secondHorse) {
    const margin = topHorse.algorithmScore - secondHorse.algorithmScore;
    if (margin >= 20) {
      const bonus = 5;
      score += bonus;
      bonusBreakdown.push({ name: `Strong Algorithm Margin (+${margin}pts)`, value: bonus });
    }
  }

  // Conflicting signals penalty
  const conflictCount = aggregatedSignals.filter((s) => s.conflictingSignals).length;
  if (conflictCount >= 2) {
    const penalty = -10;
    score += penalty;
    bonusBreakdown.push({ name: `Conflicting Signals (${conflictCount})`, value: penalty });
  }

  // ============================================================================
  // DEBUG LOGGING
  // ============================================================================
  if (bonusBreakdown.length > 0) {
    debugLog('[Confidence] Value-based score calculation:');
    for (const item of bonusBreakdown) {
      const sign = item.value > 0 ? '+' : '';
      debugLog(`  ${item.name}: ${sign}${item.value}`);
    }
    debugLog(`  Final (before cap): ${score}`);
  }

  // Cap at 0-100
  const finalScore = Math.max(0, Math.min(100, score));

  if (finalScore !== score) {
    debugLog(`  Final (after cap): ${finalScore}`);
  }

  // Tier determination logging
  let tier: string;
  if (finalScore >= 80) tier = 'HIGH';
  else if (finalScore >= 60) tier = 'MEDIUM';
  else if (finalScore >= 40) tier = 'LOW';
  else tier = 'MINIMAL';
  debugLog(`  Tier: ${tier} (${finalScore}/100)`);

  return finalScore;
}

/**
 * Calculate sizing recommendation using FLAT BETTING strategy
 *
 * Background: Confidence scoring is inverted and unfixable with current signals.
 * Higher confidence correlates with lower hit rates. But template selection works
 * (+61.3% trifecta ROI). Solution: flat bet everything that passes template selection.
 *
 * Sizing Logic (FLAT BETTING):
 * - Confidence < 25 → PASS (0x): "Insufficient confidence, skip this race"
 * - Confidence >= 25 (any template) → STANDARD (1.0x): "Flat betting - template selection is primary edge"
 *
 * Note: Confidence score is still calculated and logged for future analysis,
 * but it no longer determines sizing tiers (MAX/STRONG/HALF removed).
 *
 * @param confidenceScore - Confidence score 0-100 (used only for PASS threshold)
 * @param template - Template type (A, B, or C) - no longer affects sizing
 * @param exactaCombinations - Number of exacta combinations
 * @param trifectaCombinations - Number of trifecta combinations
 * @returns SizingRecommendation object
 */
export function calculateSizing(
  confidenceScore: number,
  template: TicketTemplate,
  exactaCombinations: number,
  trifectaCombinations: number
): SizingRecommendation {
  // Handle undefined/null confidenceScore - default to 50
  const effectiveConfidence = confidenceScore ?? 50;

  let multiplier: number;
  let recommendation: SizingRecommendationType;
  let reasoning: string;

  // FLAT BETTING STRATEGY with VALUE HORSE ROUTING
  //
  // PASS template now uses ALGORITHM_ONLY tier with 0.5x sizing
  // instead of completely skipping the race.
  //
  // Rationale: Algorithm baseline has 16.2% win rate and 33.3% exacta box 4,
  // which is profitable at reduced sizing even without AI-identified value horse.
  //
  // The key insight: "solid favorite" = "market is right" = reduced edge, not zero edge
  // Algorithm picks still have value, just at lower confidence/sizing.

  // PASS template ALWAYS uses ALGORITHM_ONLY sizing (0.5x) with algorithm-based tickets
  // This preserves the 37.8% of races that were previously being discarded entirely.
  // Confidence floor for this tier is 35 (used for display/tracking purposes).
  if (template === 'PASS') {
    // Algorithm-only fallback at reduced sizing
    multiplier = 0.5;
    recommendation = 'ALGORITHM_ONLY';
    reasoning =
      'Algorithm-only picks at 0.5x sizing - no AI value horse but algorithm baseline is profitable';
  }
  // PASS threshold: confidence < 40 means MINIMAL tier (skip this race)
  // This aligns with the new MINIMAL tier cutoff
  else if (effectiveConfidence < 40) {
    multiplier = 0;
    recommendation = 'PASS';
    reasoning = 'MINIMAL tier - no actionable value edge identified';
  }
  // All non-PASS bets get STANDARD sizing (1.0x multiplier)
  // Template selection and value horse identification are the primary edges
  else {
    multiplier = 1.0;
    recommendation = 'STANDARD';
    reasoning = 'Flat betting - value horse identified, template selection is primary edge';
  }

  // Note: Confidence score is still calculated and logged for future analysis,
  // but it no longer determines sizing tiers (MAX/STRONG/HALF removed)

  // Calculate suggested units
  // Base: $2 for exacta, $1 for trifecta
  const suggestedExactaUnit = 2 * multiplier;
  const suggestedTrifectaUnit = 1 * multiplier;

  // Calculate total investment
  const totalInvestment =
    exactaCombinations * suggestedExactaUnit + trifectaCombinations * suggestedTrifectaUnit;

  return {
    multiplier,
    recommendation,
    reasoning,
    suggestedExactaUnit,
    suggestedTrifectaUnit,
    totalInvestment,
  };
}

/**
 * Build race verdict based on sizing recommendation and template
 *
 * Verdict Logic:
 * - If sizing.recommendation === 'PASS' → action: 'PASS', summary: "Skip - confidence too low"
 * - Else → action: 'BET', summary based on template:
 *   - Template A: "Bet {recommendation} - Solid favorite, key #{topPick}"
 *   - Template B: "Bet {recommendation} - Fade favorite, key #{algorithmTop4[1]}"
 *   - Template C: "Bet {recommendation} - Wide open, box top 4-5"
 *
 * @param sizing - Sizing recommendation
 * @param template - Template type (A, B, or C)
 * @param algorithmTop4 - Algorithm's top 4 horses (program numbers)
 * @returns RaceVerdict object
 */
export function buildRaceVerdict(
  sizing: SizingRecommendation,
  template: TicketTemplate,
  algorithmTop4: number[]
): RaceVerdict {
  // If PASS recommendation, skip the race
  if (sizing.recommendation === 'PASS') {
    return {
      action: 'PASS',
      summary: 'Skip - confidence too low',
    };
  }

  // Build summary based on template
  let summary: string;
  const recommendation = sizing.recommendation;

  switch (template) {
    case 'PASS':
      // PASS template - check if using algorithm-only fallback or complete skip
      if (sizing.recommendation === 'ALGORITHM_ONLY') {
        // Algorithm-only fallback at 0.5x sizing
        summary = `Bet ALGORITHM_ONLY (0.5x) - Algorithm picks only, key #${algorithmTop4[0] ?? '?'}`;
        return {
          action: 'BET',
          summary,
        };
      } else {
        // Complete skip (below confidence floor)
        summary = 'Skip - below confidence floor, no bet';
        return {
          action: 'PASS',
          summary,
        };
      }
    case 'A':
      // Solid favorite with identified value horse - key the top pick
      summary = `Bet ${recommendation} - Solid favorite with value angle, key #${algorithmTop4[0] ?? '?'}`;
      break;
    case 'B':
      // Vulnerable favorite - key the second choice
      summary = `Bet ${recommendation} - Fade favorite, key #${algorithmTop4[1] ?? '?'}`;
      break;
    case 'C':
      // Wide open - box top 4-5
      summary = `Bet ${recommendation} - Wide open, box top 4-5`;
      break;
    default:
      summary = `Bet ${recommendation}`;
  }

  return {
    action: 'BET',
    summary,
  };
}

/**
 * Build ticket construction using the three-template system with VALUE HORSE ROUTING
 *
 * CRITICAL CHANGE: Template A (Solid Favorite) now routes to MINIMAL tier
 * because "solid favorite" means "market is right" = no value edge.
 *
 * Philosophy:
 * - Algorithm top 4 are SACRED — never demoted by AI
 * - Template selection based on favorite vulnerability, field type, AND value horse
 * - Bettable races (HIGH/MEDIUM/LOW) require an identified value horse
 * - SOLID favorite without value horse → PASS template → MINIMAL tier
 * - Vulnerable favorites stay on tickets but demoted from win position
 *
 * @param aggregatedSignals - Signals for all horses
 * @param vulnerableFavorite - Vulnerable favorite analysis
 * @param fieldSpread - Field spread analysis
 * @param rawResults - Raw bot results (optional, for value horse identification)
 * @returns TicketConstruction object
 */
export function buildTicketConstruction(
  aggregatedSignals: AggregatedSignals[],
  vulnerableFavorite: VulnerableFavoriteAnalysis | null,
  fieldSpread: FieldSpreadAnalysis | null,
  rawResults?: MultiBotRawResults
): TicketConstruction {
  // Get algorithm top 4 and top 5 (program numbers in rank order)
  const sortedByAlgoRank = [...aggregatedSignals].sort((a, b) => a.algorithmRank - b.algorithmRank);
  const algorithmTop4 = sortedByAlgoRank.slice(0, 4).map((s) => s.programNumber);
  const algorithmTop5 = sortedByAlgoRank.slice(0, 5).map((s) => s.programNumber);

  // Derive race type
  const raceType = deriveRaceType(fieldSpread, aggregatedSignals);

  // Determine favorite status
  const [favoriteStatus, favoriteVulnerabilityFlags] = determineFavoriteStatus(vulnerableFavorite);

  // Debug logging for vulnerability decisions
  const flagCount = vulnerableFavorite?.reasons?.length ?? 0;
  const botConfidence = vulnerableFavorite?.confidence ?? 'N/A';
  const botVulnerable = vulnerableFavorite?.isVulnerable ?? false;
  console.log(
    `[VULN] Flags: ${flagCount}, BotConfidence: ${botConfidence}, BotVulnerable: ${botVulnerable}, FinalStatus: ${favoriteStatus}`
  );

  // ============================================================================
  // NEW: Identify value horse from bot outputs
  // This is the KEY to the new confidence tier routing
  // ============================================================================
  const valueHorse: ValueHorseIdentification = rawResults
    ? identifyValueHorse(aggregatedSignals, rawResults, favoriteStatus)
    : {
        identified: false,
        programNumber: null,
        horseName: null,
        sources: [],
        signalStrength: 'NONE',
        angle: null,
        valueOdds: null,
        botConvergenceCount: 0,
        reasoning: 'No raw results available for value horse identification',
      };

  console.log(
    `[VALUE] Identified: ${valueHorse.identified}, ` +
      `Horse: ${valueHorse.identified ? `#${valueHorse.programNumber} ${valueHorse.horseName}` : 'None'}, ` +
      `Signal: ${valueHorse.signalStrength}, Bots: ${valueHorse.botConvergenceCount}`
  );

  // ============================================================================
  // Select template - NOW CONSIDERS VALUE HORSE
  // Template A (solid favorite) routes to PASS if no value horse identified
  // ============================================================================
  const [template, templateReason] = selectTemplate(
    raceType,
    favoriteStatus,
    vulnerableFavorite,
    valueHorse
  );

  console.log(`[TEMPLATE] ${template}: ${templateReason}`);

  // ============================================================================
  // DIAGNOSTIC: Log Template A decisions for debugging
  // Template A should only occur when:
  // 1. Favorite is SOLID (not VULNERABLE, not WIDE_OPEN)
  // 2. Value horse IS identified (2+ bots converge OR strong single signal)
  // If Template A is occurring too often, the value horse identification is too loose.
  // ============================================================================
  if (template === 'A') {
    console.log(
      `[TEMPLATE_A_DIAGNOSTIC] ========================================\n` +
        `  Race Type: ${raceType}\n` +
        `  Favorite Status: ${favoriteStatus}\n` +
        `  Value Horse Identified: ${valueHorse.identified}\n` +
        `  Value Horse: #${valueHorse.programNumber} ${valueHorse.horseName}\n` +
        `  Value Signal Strength: ${valueHorse.signalStrength}\n` +
        `  Bot Convergence Count: ${valueHorse.botConvergenceCount}\n` +
        `  Sources: ${valueHorse.sources.join(', ')}\n` +
        `  Angle: ${valueHorse.angle}\n` +
        `  Reasoning: ${valueHorse.reasoning}\n` +
        `========================================`
    );
  }

  // Build tickets (with base costs)
  // PASS template now uses algorithm-only fallback instead of empty tickets
  let exactaBase: ExactaConstruction;
  let trifectaBase: TrifectaConstruction;
  let isAlgorithmOnly = false;

  if (template === 'PASS') {
    // PASS template: algorithm-only fallback at reduced sizing
    // Uses conservative algorithm-based tickets since no AI value horse was identified
    // Exacta: Algorithm 1 WITH 2,3,4 (3 combos) - same structure as Template A
    // Trifecta: Algorithm 1 WITH 2,3,4 WITH 2,3,4,5 (12 combos) - expanded show position
    isAlgorithmOnly = true;

    const [rank1, rank2, rank3, rank4] = algorithmTop4;
    const rank5 = algorithmTop5[4];

    // Build conservative exacta: 1 WITH 2,3,4 (3 combinations)
    const exactaWinPosition = rank1 !== undefined ? [rank1] : [];
    const exactaPlacePosition = [rank2, rank3, rank4].filter((n): n is number => n !== undefined);
    const exactaCombinations = calculateExactaCombinations(exactaWinPosition, exactaPlacePosition);

    exactaBase = {
      winPosition: exactaWinPosition,
      placePosition: exactaPlacePosition,
      combinations: exactaCombinations,
      estimatedCost: exactaCombinations * 2, // $2 base
    };

    // Build conservative trifecta: 1 WITH 2,3,4 WITH 2,3,4,5 (12 combinations)
    const trifectaWinPosition = rank1 !== undefined ? [rank1] : [];
    const trifectaPlacePosition = [rank2, rank3, rank4].filter((n): n is number => n !== undefined);
    const trifectaShowPosition = [rank2, rank3, rank4, rank5].filter(
      (n): n is number => n !== undefined
    );
    const trifectaCombinations = calculateTrifectaCombinations(
      trifectaWinPosition,
      trifectaPlacePosition,
      trifectaShowPosition
    );

    trifectaBase = {
      winPosition: trifectaWinPosition,
      placePosition: trifectaPlacePosition,
      showPosition: trifectaShowPosition,
      combinations: trifectaCombinations,
      estimatedCost: trifectaCombinations * 1, // $1 base
    };

    console.log(
      `[PASS_FALLBACK] Algorithm-only tickets: Exacta ${exactaCombinations} combos, Trifecta ${trifectaCombinations} combos`
    );
  } else {
    exactaBase = buildExactaTicket(template, algorithmTop4);
    trifectaBase = buildTrifectaTicket(template, algorithmTop4, algorithmTop5);
  }

  // Calculate confidence score - NOW USES VALUE HORSE
  const confidenceScore = calculateConfidenceScore(
    raceType,
    vulnerableFavorite,
    aggregatedSignals,
    valueHorse,
    favoriteStatus
  );

  // Calculate sizing based on confidence and template
  const sizing = calculateSizing(
    confidenceScore,
    template,
    exactaBase.combinations,
    trifectaBase.combinations
  );

  // Update estimated costs to use sizing multiplier
  const exacta: ExactaConstruction = {
    ...exactaBase,
    estimatedCost: exactaBase.combinations * sizing.suggestedExactaUnit,
  };

  const trifecta: TrifectaConstruction = {
    ...trifectaBase,
    estimatedCost: trifectaBase.combinations * sizing.suggestedTrifectaUnit,
  };

  // Build verdict
  const verdict = buildRaceVerdict(sizing, template, algorithmTop4);

  return {
    template,
    templateReason,
    algorithmTop4,
    favoriteStatus,
    favoriteVulnerabilityFlags,
    valueHorse,
    exacta,
    trifecta,
    raceType,
    confidenceScore,
    sizing,
    verdict,
    // Flag for PASS races using algorithm-only fallback
    // Distinguishes "PASS with algorithm fallback" from previous "PASS with no bet"
    isAlgorithmOnly,
  };
}

/**
 * @deprecated Use buildTicketConstruction instead.
 * Build bet construction guidance using expansion/contraction model (legacy)
 *
 * Note: Expansion horses are no longer identified as they weren't hitting the board.
 * This function is kept for backward compatibility only.
 *
 * @param aggregatedSignals - Signals for all horses
 * @param _scores - Unused (expansion horses removed)
 * @param vulnerableFavorite - Vulnerable favorite analysis
 * @param fieldSpread - Field spread analysis
 * @returns BetConstructionGuidance object (legacy format)
 */
export function buildBetConstructionGuidance(
  aggregatedSignals: AggregatedSignals[],
  _scores: RaceScoringResult['scores'],
  vulnerableFavorite: VulnerableFavoriteAnalysis | null,
  fieldSpread: FieldSpreadAnalysis | null
): BetConstructionGuidance {
  // Get algorithm top 4 and top 5 (program numbers)
  const sortedByAlgoRank = [...aggregatedSignals].sort((a, b) => a.algorithmRank - b.algorithmRank);
  const algorithmTop4 = sortedByAlgoRank.slice(0, 4).map((s) => s.programNumber);
  const algorithmTop5 = sortedByAlgoRank.slice(0, 5).map((s) => s.programNumber);

  // Expansion horses are no longer identified (they weren't hitting the board)
  const expansionHorses: number[] = [];

  // Detect contraction target (vulnerable favorite)
  const contractionTarget = detectContractionTarget(aggregatedSignals, vulnerableFavorite);

  // Determine strategies (legacy format)
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
  summaryParts.push('Expansion horses removed - use buildTicketConstruction() instead');

  return {
    algorithmTop4,
    expansionHorses, // Always empty now
    contractionTarget,
    exactaStrategy,
    trifectaStrategy,
    raceClassification,
    vulnerableFavoriteDetected: contractionTarget !== null,
    sleeperIdentified: false, // Always false now
    signalSummary: summaryParts.join('; '),
  };
}

/**
 * Combine multi-bot results into the standard AIRaceAnalysis format
 *
 * SMART COMBINER (v3) - THREE-TEMPLATE TICKET CONSTRUCTION SYSTEM
 *
 * Philosophy:
 * - Algorithm top 4 are SACRED — never demoted by AI
 * - Template selection based on favorite vulnerability and field type
 * - No more expansion horses — they weren't hitting the board
 * - Vulnerable favorites stay on tickets but demoted from win position
 *
 * Templates:
 * - Template A (Solid Favorite): 1 WITH 2,3,4
 * - Template B (Vulnerable Favorite): 2,3,4 WITH 1,2,3,4 (favorite demoted)
 * - Template C (Wide Open/Chaos): Box 1,2,3,4,5
 *
 * Top Pick Logic:
 * - Template A: topPick = algorithm rank 1
 * - Template B: topPick = algorithm rank 2
 * - Template C: topPick = algorithm rank 1
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
  debugLog(`\n=== SMART COMBINER v3 (Three-Template System): Race ${race.header.raceNumber} ===`);
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

  // Count successful bots (now including Class Drop Bot = 5 bots total)
  const { classDrop } = rawResults;
  const botSuccessCount = [
    tripTrouble,
    paceScenario,
    vulnerableFavorite,
    fieldSpread,
    classDrop,
  ].filter(Boolean).length;

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
  // STEP 2: Build ticket construction (THREE-TEMPLATE SYSTEM)
  // ============================================================================
  debugLog('\n--- TICKET CONSTRUCTION (Three-Template System with Value Horse) ---');

  const ticketConstruction = buildTicketConstruction(
    aggregatedSignals,
    vulnerableFavorite,
    fieldSpread,
    rawResults // Pass raw results for value horse identification
  );

  debugLog(`Template: ${ticketConstruction.template} - ${ticketConstruction.templateReason}`);
  debugLog(`Algorithm Top 4: #${ticketConstruction.algorithmTop4.join(', #')}`);
  debugLog(`Favorite Status: ${ticketConstruction.favoriteStatus}`);
  if (ticketConstruction.favoriteVulnerabilityFlags.length > 0) {
    debugLog(`Vulnerability Flags: ${ticketConstruction.favoriteVulnerabilityFlags.join(', ')}`);
  }
  debugLog(`Race Type: ${ticketConstruction.raceType}`);
  debugLog(`Confidence Score: ${ticketConstruction.confidenceScore}`);
  debugLog(
    `Sizing: ${ticketConstruction.sizing.recommendation} (${ticketConstruction.sizing.multiplier}x) - ${ticketConstruction.sizing.reasoning}`
  );
  debugLog(
    `Suggested Units: Exacta $${ticketConstruction.sizing.suggestedExactaUnit}, Trifecta $${ticketConstruction.sizing.suggestedTrifectaUnit}`
  );
  debugLog(`Total Investment: $${ticketConstruction.sizing.totalInvestment}`);
  debugLog(`Verdict: ${ticketConstruction.verdict.action} - ${ticketConstruction.verdict.summary}`);

  // ============================================================================
  // STEP 3: Determine top pick based on template
  // ============================================================================
  debugLog('\n--- TOP PICK (Template-Based) ---');

  const algorithmRank1 = rankedScores[0]?.programNumber ?? null;
  const algorithmRank2 = rankedScores[1]?.programNumber ?? null;

  // Top pick logic based on template:
  // - Template A: topPick = algorithm rank 1
  // - Template B: topPick = algorithm rank 2 (favorite demoted)
  // - Template C: topPick = algorithm rank 1
  let topPick: number | null;
  if (ticketConstruction.template === 'B') {
    topPick = algorithmRank2;
    debugLog(
      `Top pick = Algorithm #2 (#${algorithmRank2}) - Template B (vulnerable favorite demoted)`
    );
  } else {
    topPick = algorithmRank1;
    debugLog(
      `Top pick = Algorithm #1 (#${algorithmRank1}) - Template ${ticketConstruction.template}`
    );
  }

  // Note: valuePlay is no longer used (expansion horses removed)
  debugLog('Value play = Removed (expansion horses no longer identified)');

  // ============================================================================
  // STEP 4: Log ticket details
  // ============================================================================
  debugLog('\n--- TICKET DETAILS ---');
  debugLog(
    `Exacta: Win=[${ticketConstruction.exacta.winPosition.join(',')}] Place=[${ticketConstruction.exacta.placePosition.join(',')}] ` +
      `(${ticketConstruction.exacta.combinations} combos, $${ticketConstruction.exacta.estimatedCost})`
  );
  debugLog(
    `Trifecta: Win=[${ticketConstruction.trifecta.winPosition.join(',')}] Place=[${ticketConstruction.trifecta.placePosition.join(',')}] Show=[${ticketConstruction.trifecta.showPosition.join(',')}] ` +
      `(${ticketConstruction.trifecta.combinations} combos, $${ticketConstruction.trifecta.estimatedCost})`
  );

  // ============================================================================
  // STEP 5: Build race narrative (updated for three-template system)
  // ============================================================================
  const narrativeParts: string[] = [];

  // Start with template-based narrative
  const rank1Horse = rankedScores[0];
  const rank2Horse = rankedScores[1];

  switch (ticketConstruction.template) {
    case 'PASS':
      // MINIMAL tier: No AI bet recommendation, algorithm picks only
      narrativeParts.push(
        `MINIMAL TIER (No Value Edge): Solid favorite with no identified value horse. ` +
          `Algorithm picks: #${rank1Horse?.programNumber} ${rank1Horse?.horseName} top rated. ` +
          `No AI bet recommendation - use algorithm projected finishes for reference only.`
      );
      break;
    case 'A':
      // Template A with identified value horse (rare case)
      if (ticketConstruction.valueHorse?.identified) {
        narrativeParts.push(
          `TEMPLATE A (Solid Favorite + Value): Key #${rank1Horse?.programNumber} ${rank1Horse?.horseName} in win position. ` +
            `Value horse: #${ticketConstruction.valueHorse.programNumber} ${ticketConstruction.valueHorse.horseName} ` +
            `(${ticketConstruction.valueHorse.angle}).`
        );
      } else {
        narrativeParts.push(
          `TEMPLATE A (Solid Favorite): Key #${rank1Horse?.programNumber} ${rank1Horse?.horseName} in win position.`
        );
      }
      break;
    case 'B':
      narrativeParts.push(
        `TEMPLATE B (Vulnerable Favorite): Demote #${rank1Horse?.programNumber} to place only. Key #${rank2Horse?.programNumber} ${rank2Horse?.horseName} in win position.`
      );
      if (ticketConstruction.favoriteVulnerabilityFlags[0]) {
        narrativeParts.push(`Vulnerability: ${ticketConstruction.favoriteVulnerabilityFlags[0]}.`);
      }
      // Include value horse info if identified
      if (
        ticketConstruction.valueHorse?.identified &&
        ticketConstruction.valueHorse.programNumber !== rank2Horse?.programNumber
      ) {
        narrativeParts.push(
          `Value angle: #${ticketConstruction.valueHorse.programNumber} ${ticketConstruction.valueHorse.horseName} (${ticketConstruction.valueHorse.angle}).`
        );
      }
      break;
    case 'C':
      narrativeParts.push(
        `TEMPLATE C (Wide Open): Full box top 4-5. No clear standout - spread your picks.`
      );
      if (ticketConstruction.valueHorse?.identified) {
        narrativeParts.push(
          `Value angle: #${ticketConstruction.valueHorse.programNumber} ${ticketConstruction.valueHorse.horseName} (${ticketConstruction.valueHorse.angle}).`
        );
      }
      break;
  }

  // Add pace scenario summary
  if (paceScenario) {
    if (paceScenario.loneSpeedException) {
      narrativeParts.push('Lone speed scenario - front-runner has clear advantage.');
    } else if (paceScenario.speedDuelLikely && paceScenario.paceProjection === 'HOT') {
      narrativeParts.push('Speed duel likely with HOT pace - closers benefit.');
    }
  }

  // Add race type note
  if (ticketConstruction.raceType === 'CHALK') {
    narrativeParts.push('Clear separation in field - narrow approach recommended.');
  } else if (ticketConstruction.raceType === 'WIDE_OPEN') {
    narrativeParts.push('Wide open field - spread picks recommended.');
  }

  // Add cost summary
  narrativeParts.push(
    `Exacta: ${ticketConstruction.exacta.combinations} combos ($${ticketConstruction.exacta.estimatedCost}). ` +
      `Trifecta: ${ticketConstruction.trifecta.combinations} combos ($${ticketConstruction.trifecta.estimatedCost}).`
  );

  const raceNarrative = narrativeParts.join(' ');

  // ============================================================================
  // STEP 6: Build horse insights with ALGORITHM RANK for projectedFinish
  // ============================================================================
  const horseInsights = aggregatedSignals.map((signal) => {
    const score = rankedScores.find((s) => s.programNumber === signal.programNumber)!;
    // Use ALGORITHM rank for projectedFinish (not adjusted rank)
    const algorithmRank = signal.algorithmRank;
    const isBottomThird = algorithmRank > Math.ceil((aggregatedSignals.length * 2) / 3);

    // Determine value label based on template and position
    let valueLabel: AIRaceAnalysis['horseInsights'][0]['valueLabel'];

    if (signal.classification === 'EXCLUDE') {
      valueLabel = 'NO CHANCE';
    } else if (signal.isVulnerable && ticketConstruction.favoriteStatus === 'VULNERABLE') {
      valueLabel = 'FAIR PRICE'; // False favorite - demoted in tickets
    } else if (isBottomThird) {
      valueLabel = signal.classification === 'C' ? 'NO VALUE' : 'SKIP';
    } else if (algorithmRank === 1 && ticketConstruction.template === 'A') {
      valueLabel = 'BEST BET'; // Solid favorite keyed in win
    } else if (algorithmRank === 1 && ticketConstruction.template === 'B') {
      valueLabel = 'FAIR PRICE'; // Vulnerable favorite - demoted
    } else if (algorithmRank === 2 && ticketConstruction.template === 'B') {
      valueLabel = 'BEST BET'; // Promoted due to vulnerable favorite
    } else if (algorithmRank <= 3 && signal.totalAdjustment > 0) {
      valueLabel = 'SOLID PLAY';
    } else if (signal.classification === 'A' && !signal.keyCandidate) {
      valueLabel = 'FAIR PRICE';
    } else if (signal.classification === 'B') {
      valueLabel = 'WATCH ONLY';
    } else if (algorithmRank <= 4) {
      // In top 4 but no strong signals
      valueLabel = ticketConstruction.template === 'C' ? 'SOLID PLAY' : 'PRIME VALUE';
    } else if (algorithmRank === 5 && ticketConstruction.template === 'C') {
      valueLabel = 'SOLID PLAY'; // Template C includes rank 5 in trifecta
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
      oneLiner = `Vulnerable favorite, ${signal.vulnerabilityFlags[0] || 'concerns present'}, demoted from win position`;
    } else if (signal.paceAdvantage < 0) {
      oneLiner = `${signal.paceEdgeReason || 'Pace works against'} - use underneath only`;
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

    // Contenders based on template
    const contenderCount = ticketConstruction.template === 'C' ? 5 : 4;

    return {
      programNumber: signal.programNumber,
      horseName: signal.horseName,
      projectedFinish: algorithmRank, // Use algorithm rank, NOT adjusted rank
      valueLabel,
      oneLiner,
      keyStrength,
      keyWeakness,
      isContender: algorithmRank <= contenderCount,
      avoidFlag:
        signal.classification === 'EXCLUDE' || (isBottomThird && score.negativeFactors.length >= 2),
      // Class Drop Bot data
      classDropFlagged: signal.classDropFlagged,
      classDropBoost: signal.classDropBoost,
      classDropReason: signal.classDropReason,
    };
  });

  // ============================================================================
  // STEP 7: Determine overall confidence and flags
  // ============================================================================

  // Map confidence score to 4-tier system
  // 80+: HIGH, 60-79: MEDIUM, 40-59: LOW, <40: MINIMAL
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';
  if (ticketConstruction.confidenceScore >= 80) {
    confidence = 'HIGH';
  } else if (ticketConstruction.confidenceScore >= 60) {
    confidence = 'MEDIUM';
  } else if (ticketConstruction.confidenceScore >= 40) {
    confidence = 'LOW';
  } else {
    confidence = 'MINIMAL';
  }

  // Flags based on template
  const isVulnerableFavoriteFlag = ticketConstruction.favoriteStatus === 'VULNERABLE';

  const isLikelyUpset =
    ticketConstruction.template === 'B' &&
    vulnerableFavorite?.confidence === 'HIGH' &&
    vulnerableFavorite?.reasons?.length >= 2;

  // PASS template or Template C routes to non-bettable
  // MINIMAL confidence also means not bettable (algorithm picks only)
  const isMinimalTier = ticketConstruction.template === 'PASS' || confidence === 'MINIMAL';
  const isChaoticRace =
    ticketConstruction.template === 'C' || ticketConstruction.raceType === 'WIDE_OPEN';

  // Build avoid list
  const avoidList = horseInsights.filter((h) => h.avoidFlag).map((h) => h.programNumber);

  // ============================================================================
  // BUILD BOT STATUS DEBUG INFO
  // ============================================================================
  const classDropHorsesFlagged = classDrop?.horses.filter((h) => h.flagged).length ?? 0;
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
    classDrop: {
      name: 'Class Drop Bot',
      success: classDrop !== null,
      summary: classDrop
        ? `${classDrop.horses.length} analyzed, ${classDropHorsesFlagged} flagged (reinforcement-only)`
        : 'FAILED - No data returned',
      count: classDropHorsesFlagged,
    },
    successCount: botSuccessCount,
    totalBots: 5,
    // Template B, C, or PASS means we modified from default (Template A was formerly default)
    hasOverride: ticketConstruction.template !== 'A' || !ticketConstruction.valueHorse?.identified,
    signalSummary: `Template ${ticketConstruction.template}: ${ticketConstruction.templateReason}`,
  };

  // ============================================================================
  // FINAL DEBUG SUMMARY - Enhanced console logging (always visible)
  // ============================================================================
  console.log(
    `%c[AI BOTS v3] Race ${race.header.raceNumber} Analysis Summary (Three-Template System)`,
    'color: #19abb5; font-weight: bold; font-size: 14px'
  );
  console.log('%c┌─────────────────────────────────────────────────────────┐', 'color: #888');
  console.log(
    `%c│ BOT STATUS: ${botSuccessCount}/5 bots returned data`,
    botSuccessCount === 5 ? 'color: #10b981' : 'color: #f59e0b'
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
  console.log(
    `%c│ • Class Drop:        ${classDrop ? '✅ SUCCESS' : '❌ FAILED'} ${classDrop ? `(${classDropHorsesFlagged} flagged)` : ''}`,
    classDrop ? 'color: #10b981' : 'color: #ef4444'
  );
  console.log('%c├─────────────────────────────────────────────────────────┤', 'color: #888');
  console.log(
    `%c│ TEMPLATE: ${ticketConstruction.template}${ticketConstruction.template === 'PASS' ? ' (MINIMAL TIER - No AI Bet)' : ''}`,
    ticketConstruction.template === 'PASS'
      ? 'color: #6b7280; font-weight: bold' // Gray for PASS/MINIMAL
      : ticketConstruction.template === 'A'
        ? 'color: #10b981; font-weight: bold'
        : ticketConstruction.template === 'B'
          ? 'color: #f59e0b; font-weight: bold'
          : 'color: #ef4444; font-weight: bold'
  );
  console.log(`%c│ ${ticketConstruction.templateReason}`, 'color: #b4b4b6');
  console.log('%c├─────────────────────────────────────────────────────────┤', 'color: #888');
  console.log(
    `%c│ ALGORITHM TOP 4: #${ticketConstruction.algorithmTop4.join(', #')}`,
    'color: #36d1da; font-weight: bold'
  );
  console.log(
    `%c│ FAVORITE STATUS: ${ticketConstruction.favoriteStatus}`,
    ticketConstruction.favoriteStatus === 'SOLID' ? 'color: #10b981' : 'color: #f59e0b'
  );
  console.log(
    `%c│ RACE TYPE: ${ticketConstruction.raceType}`,
    ticketConstruction.raceType === 'CHALK'
      ? 'color: #10b981'
      : ticketConstruction.raceType === 'COMPETITIVE'
        ? 'color: #f59e0b'
        : 'color: #ef4444'
  );
  console.log('%c├─────────────────────────────────────────────────────────┤', 'color: #888');
  console.log(`%c│ TOP PICK: #${topPick}`, 'color: #36d1da; font-weight: bold');
  console.log(
    `%c│ CONFIDENCE SCORE: ${ticketConstruction.confidenceScore}/100 (${confidence})`,
    confidence === 'HIGH'
      ? 'color: #10b981'
      : confidence === 'MEDIUM'
        ? 'color: #f59e0b'
        : confidence === 'LOW'
          ? 'color: #ef4444'
          : 'color: #6b7280'
  );
  console.log('%c├─────────────────────────────────────────────────────────┤', 'color: #888');
  console.log(
    `%c│ SIZING: ${ticketConstruction.sizing.recommendation} (${ticketConstruction.sizing.multiplier}x)`,
    ticketConstruction.sizing.recommendation === 'PASS'
      ? 'color: #ef4444; font-weight: bold'
      : ticketConstruction.sizing.recommendation === 'MAX'
        ? 'color: #10b981; font-weight: bold'
        : ticketConstruction.sizing.recommendation === 'STRONG'
          ? 'color: #36d1da; font-weight: bold'
          : 'color: #f59e0b; font-weight: bold'
  );
  console.log(`%c│ ${ticketConstruction.sizing.reasoning}`, 'color: #b4b4b6');
  console.log(
    `%c│ Units: Exacta $${ticketConstruction.sizing.suggestedExactaUnit}, Trifecta $${ticketConstruction.sizing.suggestedTrifectaUnit}`,
    'color: #888'
  );
  console.log(
    `%c│ TOTAL INVESTMENT: $${ticketConstruction.sizing.totalInvestment}`,
    'color: #36d1da; font-weight: bold'
  );
  console.log('%c├─────────────────────────────────────────────────────────┤', 'color: #888');
  console.log(
    `%c│ VERDICT: ${ticketConstruction.verdict.action}`,
    ticketConstruction.verdict.action === 'BET'
      ? 'color: #10b981; font-weight: bold'
      : 'color: #ef4444; font-weight: bold'
  );
  console.log(`%c│ ${ticketConstruction.verdict.summary}`, 'color: #b4b4b6');
  console.log('%c├─────────────────────────────────────────────────────────┤', 'color: #888');
  console.log(
    `%c│ EXACTA: Win=[${ticketConstruction.exacta.winPosition.join(',')}] Place=[${ticketConstruction.exacta.placePosition.join(',')}]`,
    'color: #b4b4b6'
  );
  console.log(
    `%c│         ${ticketConstruction.exacta.combinations} combos, $${ticketConstruction.exacta.estimatedCost}`,
    'color: #888'
  );
  console.log(
    `%c│ TRIFECTA: Win=[${ticketConstruction.trifecta.winPosition.join(',')}] Place=[${ticketConstruction.trifecta.placePosition.join(',')}] Show=[${ticketConstruction.trifecta.showPosition.join(',')}]`,
    'color: #b4b4b6'
  );
  console.log(
    `%c│          ${ticketConstruction.trifecta.combinations} combos, $${ticketConstruction.trifecta.estimatedCost}`,
    'color: #888'
  );
  console.log('%c└─────────────────────────────────────────────────────────┘', 'color: #888');

  debugLog('=== END SMART COMBINER v3 ===\n');

  // CRITICAL: bettableRace is false for:
  // 1. PASS template (solid favorite, no value horse → MINIMAL tier)
  // 2. MINIMAL confidence tier (no identified value edge)
  // 3. Chaotic races (Template C / wide open)
  // Top Bets / bet recommendations pull ONLY from HIGH/MEDIUM/LOW races
  const isBettableRace = !isMinimalTier && !isChaoticRace;

  return {
    raceId: `race-${race.header.raceNumber}`,
    raceNumber: race.header.raceNumber,
    timestamp: new Date().toISOString(),
    processingTimeMs,
    raceNarrative,
    confidence,
    bettableRace: isBettableRace,
    horseInsights,
    topPick,
    avoidList,
    vulnerableFavorite: isVulnerableFavoriteFlag,
    likelyUpset: isLikelyUpset ?? false,
    chaoticRace: isChaoticRace ?? false,
    botDebugInfo,
    // Three-template ticket construction
    ticketConstruction,
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
    avoidList: [],
    vulnerableFavorite: false,
    likelyUpset: false,
    chaoticRace: false,
  };
}
