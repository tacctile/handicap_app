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
import type { AIRaceAnalysis, AIServiceStatus, AIServiceConfig, MultiBotRawResults } from './types';

// Type declaration for Node.js process (available in test/CI environments)
declare const process: { env?: Record<string, string | undefined> } | undefined;

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
 */
function getCacheKey(raceNumber: number, scoringVersion: number): string {
  return `${raceNumber}-${scoringVersion}`;
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
  const cacheKey = getCacheKey(race.header.raceNumber, options?.scoringVersion ?? 0);

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
 * @returns Current service status
 */
export function checkAIServiceStatus(): AIServiceStatus {
  // Check for API key in both Vite (browser) and Node (test/CI) environments
  const hasApiKey =
    (typeof import.meta !== 'undefined' && !!import.meta.env?.VITE_GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && !!process.env?.VITE_GEMINI_API_KEY);

  if (!hasApiKey) {
    return 'offline';
  }

  // In Node environment (tests), skip navigator check
  if (typeof navigator === 'undefined') {
    return 'ready';
  }

  if (!navigator.onLine) {
    return 'offline';
  }

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
  const cacheKey = `multi-${race.header.raceNumber}-${options?.scoringVersion ?? 0}`;

  // Return cached if available and not forcing refresh
  if (!options?.forceRefresh && analysisCache.has(cacheKey)) {
    return analysisCache.get(cacheKey)!;
  }

  // Launch all 4 bots in parallel with Promise.allSettled
  const [tripResult, paceResult, favoriteResult, spreadResult] = await Promise.allSettled([
    analyzeTripTrouble(race, scoringResult),
    analyzePaceScenario(race, scoringResult),
    analyzeVulnerableFavorite(race, scoringResult),
    analyzeFieldSpread(race, scoringResult),
  ]);

  // Extract results, handling failures gracefully
  const rawResults: MultiBotRawResults = {
    tripTrouble: tripResult.status === 'fulfilled' ? tripResult.value : null,
    paceScenario: paceResult.status === 'fulfilled' ? paceResult.value : null,
    vulnerableFavorite: favoriteResult.status === 'fulfilled' ? favoriteResult.value : null,
    fieldSpread: spreadResult.status === 'fulfilled' ? spreadResult.value : null,
  };

  // Combine into AIRaceAnalysis
  const analysis = combineMultiBotResults(rawResults, race, scoringResult, Date.now() - startTime);

  // Cache it
  analysisCache.set(cacheKey, analysis);

  return analysis;
}

/**
 * Combine multi-bot results into the standard AIRaceAnalysis format
 *
 * Maps 4 bot outputs into existing AIRaceAnalysis format.
 * Uses algorithm's base rankings, modified by bot insights.
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
  const { scores, raceAnalysis } = scoringResult;

  // Get non-scratched horses sorted by rank
  const rankedScores = [...scores].filter((s) => !s.isScratched).sort((a, b) => a.rank - b.rank);

  // Count how many bots succeeded
  const botSuccessCount = [tripTrouble, paceScenario, vulnerableFavorite, fieldSpread].filter(
    Boolean
  ).length;

  // Build horse insights from algorithm scores, enhanced with bot data
  const horseInsights = rankedScores.map((score) => {
    const horse = race.horses.find((h) => h.programNumber === score.programNumber);
    const tripIssue = tripTrouble?.horsesWithTripTrouble.find(
      (h) => h.programNumber === score.programNumber
    );

    // Determine value label based on tier and insights
    let valueLabel: AIRaceAnalysis['horseInsights'][0]['valueLabel'] = 'FAIR PRICE';
    if (score.confidenceTier === 'high') {
      valueLabel = score.rank === 1 ? 'SOLID PLAY' : 'PRIME VALUE';
    } else if (score.confidenceTier === 'medium') {
      valueLabel = 'FAIR PRICE';
    } else if (score.confidenceTier === 'low') {
      valueLabel = 'WATCH ONLY';
    } else {
      valueLabel = score.rank <= rankedScores.length / 2 ? 'NO VALUE' : 'SKIP';
    }

    // Build one-liner from available insights
    let oneLiner: string;
    if (tripIssue?.maskedAbility) {
      oneLiner = `Trip trouble: ${tripIssue.issue}`;
    } else if (score.positiveFactors.length > 0 && score.positiveFactors[0]) {
      oneLiner = score.positiveFactors[0];
    } else if (score.negativeFactors.length > 0 && score.negativeFactors[0]) {
      oneLiner = `Concern: ${score.negativeFactors[0]}`;
    } else {
      oneLiner = `Ranked #${score.rank} by algorithm`;
    }

    // Enhance one-liner with pace insight if relevant
    if (paceScenario && horse?.runningStyle) {
      const style = horse.runningStyle.toLowerCase();
      if (paceScenario.advantagedStyles.some((s) => style.includes(s.toLowerCase()))) {
        oneLiner += ` | Pace favors running style`;
      } else if (paceScenario.disadvantagedStyles.some((s) => style.includes(s.toLowerCase()))) {
        oneLiner += ` | Pace setup unfavorable`;
      }
    }

    return {
      programNumber: score.programNumber,
      horseName: score.horseName,
      projectedFinish: score.rank,
      valueLabel,
      oneLiner,
      keyStrength: score.positiveFactors[0] || null,
      keyWeakness: score.negativeFactors[0] || null,
      isContender: score.confidenceTier === 'high' || score.confidenceTier === 'medium',
      avoidFlag: score.confidenceTier === 'low' && score.negativeFactors.length >= 3,
    };
  });

  // Determine flags from bot results
  const isVulnerableFavorite = vulnerableFavorite?.isVulnerable ?? raceAnalysis.vulnerableFavorite;
  const isLikelyUpset =
    isVulnerableFavorite &&
    vulnerableFavorite?.confidence === 'HIGH' &&
    fieldSpread?.fieldType !== 'SEPARATED';
  const isChaoticRace =
    (fieldSpread?.fieldType === 'TIGHT' && (fieldSpread?.topTierCount ?? 0) >= 5) ||
    (paceScenario?.speedDuelLikely && paceScenario?.paceProjection === 'HOT');

  // Determine confidence based on bot results and field spread
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (fieldSpread?.fieldType === 'SEPARATED' && botSuccessCount >= 3) {
    confidence = 'HIGH';
  } else if (fieldSpread?.fieldType === 'TIGHT' || botSuccessCount < 2) {
    confidence = 'LOW';
  }

  // Build race narrative from bot insights
  const narrativeParts: string[] = [];

  if (paceScenario) {
    if (paceScenario.loneSpeedException) {
      narrativeParts.push('Lone speed scenario — front-runner has clear advantage.');
    } else if (paceScenario.speedDuelLikely) {
      narrativeParts.push(
        `Speed duel likely with ${paceScenario.paceProjection} pace — closers benefit.`
      );
    } else {
      narrativeParts.push(`Pace projects ${paceScenario.paceProjection.toLowerCase()}.`);
    }
  }

  if (vulnerableFavorite?.isVulnerable && vulnerableFavorite.reasons.length > 0) {
    narrativeParts.push(`Favorite vulnerable: ${vulnerableFavorite.reasons[0]}.`);
  }

  if (fieldSpread) {
    if (fieldSpread.fieldType === 'TIGHT') {
      narrativeParts.push(
        `Tight field with ${fieldSpread.topTierCount} contenders — spread bets recommended.`
      );
    } else if (fieldSpread.fieldType === 'SEPARATED') {
      narrativeParts.push(`Clear separation in field — narrow plays viable.`);
    }
  }

  const raceNarrative =
    narrativeParts.length > 0
      ? narrativeParts.join(' ')
      : 'Multi-bot analysis complete. See individual insights.';

  // Get top pick and value play
  const topPick = rankedScores[0]?.programNumber ?? null;

  // Value play: look for trip trouble horse with masked ability ranked 2-5
  let valuePlay: number | null = null;
  if (tripTrouble) {
    const maskedHorse = tripTrouble.horsesWithTripTrouble.find((h) => {
      const score = rankedScores.find((s) => s.programNumber === h.programNumber);
      return h.maskedAbility && score && score.rank >= 2 && score.rank <= 5;
    });
    if (maskedHorse) {
      valuePlay = maskedHorse.programNumber;
    }
  }

  // Build avoid list from horses with multiple negatives
  const avoidList = rankedScores
    .filter((s) => s.negativeFactors.length >= 3 || s.confidenceTier === 'low')
    .map((s) => s.programNumber);

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
    vulnerableFavorite: isVulnerableFavorite ?? false,
    likelyUpset: isLikelyUpset ?? false,
    chaoticRace: isChaoticRace ?? false,
  };
}
