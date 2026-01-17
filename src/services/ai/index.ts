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
 * Applies bot insights as adjustments to algorithm's base rankings.
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

  // Get non-scratched horses sorted by algorithm rank
  const rankedScores = [...scores].filter((s) => !s.isScratched).sort((a, b) => a.rank - b.rank);

  if (rankedScores.length === 0) {
    return createEmptyAnalysis(race.header.raceNumber, processingTimeMs);
  }

  // Count how many bots succeeded
  const botSuccessCount = [tripTrouble, paceScenario, vulnerableFavorite, fieldSpread].filter(
    Boolean
  ).length;

  // ============================================================================
  // PART 1: Build adjustment tracking for each horse
  // ============================================================================

  interface HorseAdjustment {
    programNumber: number;
    horseName: string;
    algorithmRank: number;
    adjustment: number; // Positive = move up, negative = move down
    adjustedRank: number;
    oneLiner: string;
    keyStrength: string | null;
    keyWeakness: string | null;
    hasTripTroubleBoost: boolean;
    hasPaceAdvantage: boolean;
    hasPaceDisadvantage: boolean;
    isLoneSpeed: boolean;
    isVulnerableFavoriteHorse: boolean;
    tripTroubleConfidence: 'HIGH' | 'MEDIUM' | null;
  }

  const horseAdjustments: HorseAdjustment[] = rankedScores.map((score) => ({
    programNumber: score.programNumber,
    horseName: score.horseName,
    algorithmRank: score.rank,
    adjustment: 0,
    adjustedRank: score.rank,
    oneLiner: '',
    keyStrength: score.positiveFactors[0] || null,
    keyWeakness: score.negativeFactors[0] || null,
    hasTripTroubleBoost: false,
    hasPaceAdvantage: false,
    hasPaceDisadvantage: false,
    isLoneSpeed: false,
    isVulnerableFavoriteHorse: false,
    tripTroubleConfidence: null,
  }));

  // ============================================================================
  // PART 2: Trip Trouble Bot Integration
  // ============================================================================

  if (tripTrouble) {
    for (const tripHorse of tripTrouble.horsesWithTripTrouble) {
      const adj = horseAdjustments.find((h) => h.programNumber === tripHorse.programNumber);
      if (adj && tripHorse.maskedAbility) {
        // Count troubled trips to determine confidence
        // HIGH confidence = 2+ troubled trips = boost by 2
        // MEDIUM confidence = 1 troubled trip = boost by 1
        const troubledTripCount = tripTrouble.horsesWithTripTrouble.filter(
          (h) => h.programNumber === tripHorse.programNumber && h.maskedAbility
        ).length;

        // For simplicity, we'll check if issue mentions "multiple" or assume HIGH if maskedAbility
        const isHighConfidence =
          tripHorse.issue.toLowerCase().includes('multiple') ||
          tripHorse.issue.toLowerCase().includes('last 2') ||
          tripHorse.issue.toLowerCase().includes('last 3') ||
          troubledTripCount >= 2;

        if (isHighConfidence) {
          adj.adjustment += 2; // Boost by 2 positions for HIGH confidence
          adj.tripTroubleConfidence = 'HIGH';
          adj.oneLiner = 'Trip trouble masked true ability';
        } else {
          adj.adjustment += 1; // Boost by 1 position for MEDIUM confidence
          adj.tripTroubleConfidence = 'MEDIUM';
          adj.oneLiner = 'Recent trip trouble - better than last shows';
        }
        adj.hasTripTroubleBoost = true;
      }
    }
  }

  // ============================================================================
  // PART 3: Pace Scenario Bot Integration
  // ============================================================================

  // Find lone speed horse if applicable
  let loneSpeedHorse: number | null = null;

  if (paceScenario) {
    // Identify the lone speed horse (front-runner with no pressure)
    if (paceScenario.loneSpeedException) {
      // Find the E or E/P running style horse with best position
      const speedHorses = rankedScores.filter((score) => {
        const horse = race.horses.find((h) => h.programNumber === score.programNumber);
        const style = horse?.runningStyle?.toLowerCase() || '';
        return style === 'e' || style === 'e/p' || style.includes('early');
      });
      if (speedHorses.length > 0 && speedHorses[0]) {
        loneSpeedHorse = speedHorses[0].programNumber;
      }
    }

    for (const adj of horseAdjustments) {
      const horse = race.horses.find((h) => h.programNumber === adj.programNumber);
      const style = horse?.runningStyle?.toLowerCase() || '';

      // Check if this is the lone speed horse - major advantage (+2)
      if (loneSpeedHorse === adj.programNumber) {
        adj.adjustment += 2;
        adj.isLoneSpeed = true;
        adj.keyStrength = 'Lone speed - major advantage';
      } else {
        // Check advantaged styles (+1)
        const isAdvantaged = paceScenario.advantagedStyles.some(
          (advStyle) =>
            style.includes(advStyle.toLowerCase()) || advStyle.toLowerCase().includes(style)
        );

        // Check disadvantaged styles (-1)
        const isDisadvantaged = paceScenario.disadvantagedStyles.some(
          (disStyle) =>
            style.includes(disStyle.toLowerCase()) || disStyle.toLowerCase().includes(style)
        );

        if (isAdvantaged && !isDisadvantaged) {
          adj.adjustment += 1;
          adj.hasPaceAdvantage = true;
          // Always set pace-related keyStrength when pace is a factor
          adj.keyStrength = 'Pace scenario favors running style';
        } else if (isDisadvantaged && !isAdvantaged) {
          adj.adjustment -= 1;
          adj.hasPaceDisadvantage = true;
          if (!adj.keyWeakness) {
            adj.keyWeakness = 'Pace scenario works against running style';
          }
        }
      }
    }
  }

  // ============================================================================
  // PART 4: Vulnerable Favorite Bot Integration
  // ============================================================================

  // Find the favorite (lowest ML odds or #1 algorithm rank)
  const favoriteScore = rankedScores.reduce((fav, curr) => {
    const favHorse = race.horses.find((h) => h.programNumber === fav.programNumber);
    const currHorse = race.horses.find((h) => h.programNumber === curr.programNumber);
    const favOdds = parseFloat(favHorse?.morningLineOdds?.replace('-', '.') || '99');
    const currOdds = parseFloat(currHorse?.morningLineOdds?.replace('-', '.') || '99');
    return currOdds < favOdds ? curr : fav;
  }, rankedScores[0]!);

  const favoriteProgram = favoriteScore.programNumber;
  const isVulnerableFavoriteFlag =
    vulnerableFavorite?.isVulnerable ?? raceAnalysis.vulnerableFavorite;

  if (vulnerableFavorite?.isVulnerable) {
    const favAdj = horseAdjustments.find((h) => h.programNumber === favoriteProgram);
    if (favAdj) {
      favAdj.isVulnerableFavoriteHorse = true;

      if (vulnerableFavorite.confidence === 'HIGH') {
        // Drop favorite's ranking by 1 position
        favAdj.adjustment -= 1;
        // Set keyWeakness from bot's reasons
        if (vulnerableFavorite.reasons.length > 0) {
          favAdj.keyWeakness = vulnerableFavorite.reasons[0] || null;
        }
      } else if (vulnerableFavorite.confidence === 'MEDIUM') {
        // Keep ranking but add keyWeakness
        if (vulnerableFavorite.reasons.length > 0) {
          favAdj.keyWeakness = vulnerableFavorite.reasons[0] || null;
        }
      }
    }
  }

  // ============================================================================
  // PART 5: Apply adjustment caps and re-sort
  // ============================================================================

  // Cap adjustments at ±3 positions
  for (const adj of horseAdjustments) {
    adj.adjustment = Math.max(-3, Math.min(3, adj.adjustment));
  }

  // Calculate adjusted ranks (lower adjustment number = better position)
  // We use algorithm rank minus adjustment (positive adjustment = lower rank number = better)
  for (const adj of horseAdjustments) {
    adj.adjustedRank = adj.algorithmRank - adj.adjustment;
  }

  // Re-sort by adjusted rank, using adjustment as tiebreaker
  // When adjusted ranks are equal, the horse with higher adjustment comes first
  horseAdjustments.sort((a, b) => {
    if (a.adjustedRank !== b.adjustedRank) {
      return a.adjustedRank - b.adjustedRank;
    }
    // Tiebreaker: higher adjustment (more improvement) wins
    return b.adjustment - a.adjustment;
  });

  // Assign final projected finish positions (1, 2, 3, etc.)
  horseAdjustments.forEach((adj, idx) => {
    adj.adjustedRank = idx + 1;
  });

  // ============================================================================
  // PART 6: Field Spread Bot Integration (contender count)
  // ============================================================================

  let contenderCount = 4; // Default to MEDIUM spread
  if (fieldSpread) {
    switch (fieldSpread.recommendedSpread) {
      case 'NARROW':
        contenderCount = Math.min(3, rankedScores.length);
        break;
      case 'MEDIUM':
        contenderCount = Math.min(4, rankedScores.length);
        break;
      case 'WIDE':
        contenderCount = Math.min(6, rankedScores.length);
        break;
    }
  }

  // ============================================================================
  // PART 7: Determine top pick, value play, and tracking
  // ============================================================================

  const algorithmTopPick = rankedScores[0]?.programNumber ?? null;
  const aiTopPick = horseAdjustments[0]?.programNumber ?? null;
  const aiPickDiffersFromAlgo = algorithmTopPick !== aiTopPick;

  // Value play: horse that moved up most from algorithm rank (at least +2 positions)
  let valuePlay: number | null = null;
  let maxImprovement = 0;

  for (const adj of horseAdjustments) {
    const improvement = adj.algorithmRank - adj.adjustedRank;
    if (improvement >= 2 && improvement > maxImprovement && adj.adjustedRank !== 1) {
      maxImprovement = improvement;
      valuePlay = adj.programNumber;
    }
  }

  // ============================================================================
  // PART 8: Build value labels for each horse
  // ============================================================================

  const horseInsights = horseAdjustments.map((adj, idx) => {
    const score = rankedScores.find((s) => s.programNumber === adj.programNumber)!;
    const finalRank = idx + 1;
    const isBottomThird = finalRank > Math.ceil((horseAdjustments.length * 2) / 3);

    // Determine value label based on requirements
    let valueLabel: AIRaceAnalysis['horseInsights'][0]['valueLabel'];

    if (adj.isVulnerableFavoriteHorse && vulnerableFavorite?.isVulnerable) {
      // Vulnerable favorite gets "TOO SHORT" or "FAIR PRICE"
      valueLabel = vulnerableFavorite.confidence === 'HIGH' ? 'TOO SHORT' : 'FAIR PRICE';
    } else if (isBottomThird) {
      // Bottom third of field
      valueLabel = score.negativeFactors.length >= 3 ? 'NO CHANCE' : 'SKIP';
    } else if (finalRank === 1) {
      // Top pick
      if (adj.hasTripTroubleBoost || adj.isLoneSpeed || adj.hasPaceAdvantage) {
        valueLabel = 'BEST BET';
      } else if (adj.keyWeakness) {
        valueLabel = 'SOLID PLAY';
      } else {
        valueLabel = 'PRIME VALUE';
      }
    } else if (finalRank <= 3) {
      // Rank 2-3
      if (adj.hasTripTroubleBoost || adj.isLoneSpeed || adj.hasPaceAdvantage) {
        valueLabel = 'PRIME VALUE';
      } else {
        valueLabel = 'SOLID PLAY';
      }
    } else if (finalRank <= 5) {
      // Rank 4-5
      if (adj.adjustment >= 2) {
        // Strong bot boost - potential value play
        valueLabel = 'FAIR PRICE';
      } else {
        valueLabel = 'WATCH ONLY';
      }
    } else {
      valueLabel = 'NO VALUE';
    }

    // Build one-liner
    let oneLiner = adj.oneLiner;
    if (!oneLiner) {
      if (adj.isLoneSpeed) {
        oneLiner = 'Lone speed - should wire field if clean break';
      } else if (adj.hasTripTroubleBoost) {
        oneLiner =
          adj.tripTroubleConfidence === 'HIGH'
            ? 'Trip trouble masked true ability'
            : 'Recent trip trouble - better than last shows';
      } else if (adj.hasPaceAdvantage) {
        oneLiner = 'Pace scenario sets up perfectly for running style';
      } else if (adj.hasPaceDisadvantage) {
        oneLiner = 'Pace dynamics work against this runner';
      } else if (score.positiveFactors[0]) {
        oneLiner = score.positiveFactors[0];
      } else if (score.negativeFactors[0]) {
        oneLiner = `Concern: ${score.negativeFactors[0]}`;
      } else {
        oneLiner = `Ranked #${finalRank} after bot analysis`;
      }
    }

    // Update keyStrength/keyWeakness if we have bot-derived insights
    let keyStrength = adj.keyStrength;
    let keyWeakness = adj.keyWeakness;

    if (adj.isLoneSpeed && !keyStrength) {
      keyStrength = 'Lone speed - major advantage';
    }
    if (adj.hasPaceAdvantage && !keyStrength) {
      keyStrength = 'Pace scenario favors running style';
    }
    if (adj.hasPaceDisadvantage && !keyWeakness) {
      keyWeakness = 'Pace scenario works against running style';
    }

    return {
      programNumber: adj.programNumber,
      horseName: adj.horseName,
      projectedFinish: finalRank,
      valueLabel,
      oneLiner,
      keyStrength,
      keyWeakness,
      isContender: finalRank <= contenderCount,
      avoidFlag: isBottomThird && score.negativeFactors.length >= 2,
    };
  });

  // ============================================================================
  // PART 9: Build race narrative with OVERRIDE/CONFIRM
  // ============================================================================

  const narrativeParts: string[] = [];

  // Start with OVERRIDE or CONFIRM
  if (aiPickDiffersFromAlgo) {
    // Find why we overrode
    const newTopAdj = horseAdjustments[0];
    let overrideReason = 'bot insights suggest different selection';

    if (newTopAdj) {
      if (newTopAdj.isLoneSpeed) {
        overrideReason = 'lone speed scenario gives clear edge';
      } else if (newTopAdj.hasTripTroubleBoost && newTopAdj.tripTroubleConfidence === 'HIGH') {
        overrideReason = 'masked ability from trip trouble';
      } else if (newTopAdj.hasPaceAdvantage) {
        overrideReason = 'pace scenario strongly favors running style';
      }
    }

    const algoTopName = rankedScores[0]?.horseName || 'unknown';
    const aiTopName = newTopAdj?.horseName || 'unknown';
    narrativeParts.push(
      `OVERRIDE: Moving from ${algoTopName} to ${aiTopName} - ${overrideReason}.`
    );
  } else {
    const topHorse = horseAdjustments[0];
    let confirmReason = 'analysis confirms algorithm selection';

    if (topHorse) {
      if (topHorse.isLoneSpeed) {
        confirmReason = 'lone speed advantage';
      } else if (topHorse.hasPaceAdvantage) {
        confirmReason = 'favorable pace setup';
      } else if (fieldSpread?.fieldType === 'SEPARATED') {
        confirmReason = 'clear separation from field';
      }
    }

    narrativeParts.push(
      `CONFIRM: Algorithm pick ${topHorse?.horseName || 'top choice'} supported by ${confirmReason}.`
    );
  }

  // Add vulnerable favorite note if flagged
  if (isVulnerableFavoriteFlag && vulnerableFavorite?.reasons?.[0]) {
    narrativeParts.push(`Vulnerable favorite: ${vulnerableFavorite.reasons[0]}.`);
  }

  // Add pace scenario summary
  if (paceScenario) {
    if (paceScenario.loneSpeedException) {
      narrativeParts.push('Lone speed scenario - front-runner has clear advantage.');
    } else if (paceScenario.speedDuelLikely) {
      narrativeParts.push(
        `Speed duel likely with ${paceScenario.paceProjection} pace - closers benefit.`
      );
    }
  }

  // Add field type note
  if (fieldSpread) {
    if (fieldSpread.fieldType === 'TIGHT') {
      narrativeParts.push('TIGHT field - spread picks recommended.');
    } else if (fieldSpread.fieldType === 'SEPARATED') {
      narrativeParts.push('SEPARATED field - top choice stands out.');
    }
  }

  const raceNarrative = narrativeParts.join(' ');

  // ============================================================================
  // PART 10: Determine confidence and flags
  // ============================================================================

  const isLikelyUpset =
    isVulnerableFavoriteFlag &&
    vulnerableFavorite?.confidence === 'HIGH' &&
    fieldSpread?.fieldType !== 'SEPARATED';
  const isChaoticRace =
    (fieldSpread?.fieldType === 'TIGHT' && (fieldSpread?.topTierCount ?? 0) >= 5) ||
    (paceScenario?.speedDuelLikely && paceScenario?.paceProjection === 'HOT');

  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (fieldSpread?.fieldType === 'SEPARATED' && botSuccessCount >= 3) {
    confidence = 'HIGH';
  } else if (fieldSpread?.fieldType === 'TIGHT' || botSuccessCount < 2) {
    confidence = 'LOW';
  }

  // Build avoid list from bottom third with multiple negatives
  const avoidList = horseInsights.filter((h) => h.avoidFlag).map((h) => h.programNumber);

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
