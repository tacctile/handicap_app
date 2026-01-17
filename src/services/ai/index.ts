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
 * CONSERVATIVE COMBINER - Trust the algorithm, only override with HIGH confidence signals.
 *
 * Philosophy:
 * - Default behavior: Trust the algorithm's ranking order
 * - Only override when a bot provides HIGH confidence signal on a SPECIFIC horse
 * - Maximum adjustment: ±1 position (surgical precision, not wholesale reordering)
 * - When in doubt, do NOT adjust
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
    adjustment: number; // Positive = move up, negative = move down (CAPPED AT ±1)
    adjustedRank: number;
    oneLiner: string;
    keyStrength: string | null;
    keyWeakness: string | null;
    hasTripTroubleBoost: boolean;
    hasPaceAdvantage: boolean;
    hasPaceDisadvantage: boolean;
    isLoneSpeed: boolean;
    isVulnerableFavoriteHorse: boolean;
    tripTroubleNote: string | null; // Note for oneLiner when not boosted
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
    tripTroubleNote: null,
  }));

  // ============================================================================
  // PART 2: Trip Trouble Bot Integration (TIGHTENED)
  //
  // Only apply trip trouble boost when ALL criteria met:
  // - maskedAbility = true
  // - Horse had trouble in MOST RECENT race (issue must mention "last race" or similar)
  // - Horse finished 4th or worse in that troubled race
  //
  // If criteria not met but trip trouble exists, add note to oneLiner only
  // ============================================================================

  if (tripTrouble) {
    for (const tripHorse of tripTrouble.horsesWithTripTrouble) {
      const adj = horseAdjustments.find((h) => h.programNumber === tripHorse.programNumber);
      if (!adj) continue;

      // Check if this is MOST RECENT race trouble (not just any of last 3)
      const issueLower = tripHorse.issue.toLowerCase();
      const isMostRecentRaceTrouble =
        issueLower.includes('last race') ||
        issueLower.includes('last start') ||
        issueLower.includes('most recent') ||
        issueLower.includes('last out') ||
        // If issue doesn't specify which race, assume it's about the most recent
        (!issueLower.includes('last 2') &&
          !issueLower.includes('last 3') &&
          !issueLower.includes('2 back') &&
          !issueLower.includes('3 back'));

      // Check for 4th or worse finish indicator in the issue
      const hadPoorFinish =
        issueLower.includes('4th') ||
        issueLower.includes('5th') ||
        issueLower.includes('6th') ||
        issueLower.includes('7th') ||
        issueLower.includes('8th') ||
        issueLower.includes('finished off') ||
        issueLower.includes('finished behind') ||
        issueLower.includes('out of the money') ||
        issueLower.includes('well beaten') ||
        // If maskedAbility is true, bot believes ability was masked - trust that
        tripHorse.maskedAbility;

      if (tripHorse.maskedAbility && isMostRecentRaceTrouble && hadPoorFinish) {
        // Strict criteria met - apply +1 boost (max adjustment is ±1)
        adj.adjustment = 1;
        adj.hasTripTroubleBoost = true;
        adj.oneLiner = 'Trip trouble masked true ability in last start';
      } else {
        // Criteria not fully met - add note but NO ranking adjustment
        adj.tripTroubleNote = tripHorse.maskedAbility
          ? 'Has trip trouble history - watch for improvement'
          : `Trip note: ${tripHorse.issue}`;
      }
    }
  }

  // ============================================================================
  // PART 3: Pace Scenario Bot Integration (TIGHTENED)
  //
  // Only apply pace adjustment when:
  // - loneSpeedException = true → boost the lone speed by +1
  // - speedDuelLikely = true AND horse is a closer → boost closer by +1
  //
  // Do NOT adjust for general "advantaged/disadvantaged styles" - too noisy
  // Remove disadvantaged style penalties entirely - only boost, never penalize
  // ============================================================================

  let loneSpeedHorse: number | null = null;

  if (paceScenario) {
    // CASE 1: Lone speed exception - find and boost the lone speed horse
    if (paceScenario.loneSpeedException) {
      // Find the E or E/P running style horse (the lone speed)
      const speedHorses = rankedScores.filter((score) => {
        const horse = race.horses.find((h) => h.programNumber === score.programNumber);
        const style = horse?.runningStyle?.toLowerCase() || '';
        return style === 'e' || style === 'e/p' || style.includes('early');
      });

      // Only boost if there's exactly one early speed horse (truly "lone")
      if (speedHorses.length === 1 && speedHorses[0]) {
        loneSpeedHorse = speedHorses[0].programNumber;
        const adj = horseAdjustments.find((h) => h.programNumber === loneSpeedHorse);
        if (adj && adj.adjustment === 0) {
          // Only apply if no other adjustment already made
          adj.adjustment = 1; // +1 boost (max)
          adj.isLoneSpeed = true;
          adj.keyStrength = 'Lone speed - clear tactical advantage';
        }
      }
    }

    // CASE 2: Speed duel likely - boost closers only
    if (paceScenario.speedDuelLikely && !paceScenario.loneSpeedException) {
      for (const adj of horseAdjustments) {
        const horse = race.horses.find((h) => h.programNumber === adj.programNumber);
        const style = horse?.runningStyle?.toLowerCase() || '';

        // Check if this horse is a closer (S, S/P, or similar)
        const isCloser =
          style === 's' || style === 's/p' || style.includes('closer') || style.includes('stalker');

        if (isCloser && adj.adjustment === 0) {
          // Only apply if no other adjustment already made
          adj.adjustment = 1; // +1 boost (max)
          adj.hasPaceAdvantage = true;
          adj.keyStrength = 'Speed duel sets up for closing style';
        }
      }
    }

    // NOTE: We do NOT penalize any horse based on pace (removed disadvantage logic)
    // NOTE: We do NOT boost for general "advantaged styles" - too noisy
  }

  // ============================================================================
  // PART 4: Vulnerable Favorite Bot Integration (TIGHTENED)
  //
  // Only apply when: isVulnerable = true AND confidence = "HIGH"
  //
  // When triggered:
  // - Do NOT drop favorite's ranking position
  // - Only change valueLabel to "FAIR PRICE" and add keyWeakness
  // - The vulnerable favorite flag is for bet sizing guidance, not pick changes
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

  // Only flag as vulnerable if HIGH confidence (3+ factors)
  const isVulnerableFavoriteFlag =
    vulnerableFavorite?.isVulnerable && vulnerableFavorite?.confidence === 'HIGH';

  if (vulnerableFavorite?.isVulnerable && vulnerableFavorite?.confidence === 'HIGH') {
    const favAdj = horseAdjustments.find((h) => h.programNumber === favoriteProgram);
    if (favAdj) {
      favAdj.isVulnerableFavoriteHorse = true;
      // NO ranking adjustment - only metadata for bet sizing
      // Set keyWeakness from bot's reasons for UI display
      if (vulnerableFavorite.reasons.length > 0) {
        favAdj.keyWeakness = vulnerableFavorite.reasons[0] || null;
      }
    }
  }

  // ============================================================================
  // PART 5: Apply adjustment caps (±1 MAX) and calculate adjusted ranks
  //
  // CONSERVATIVE: Maximum ±1 position change
  // A horse can only move 1 position up OR 1 position down, never more
  // ============================================================================

  // Cap ALL adjustments at ±1 (conservative - surgical precision)
  for (const adj of horseAdjustments) {
    adj.adjustment = Math.max(-1, Math.min(1, adj.adjustment));
  }

  // Calculate adjusted ranks
  // Positive adjustment = move up = lower rank number
  for (const adj of horseAdjustments) {
    adj.adjustedRank = adj.algorithmRank - adj.adjustment;
  }

  // ============================================================================
  // PART 5B: Preserve algorithm strength in exotic ordering
  //
  // Rules:
  // - Start with algorithm's exact order
  // - Only reorder when a +1 boost would move a horse into top 4
  // - Never push an algorithm top-4 horse out of top 4
  // ============================================================================

  // Re-sort by adjusted rank
  horseAdjustments.sort((a, b) => {
    if (a.adjustedRank !== b.adjustedRank) {
      return a.adjustedRank - b.adjustedRank;
    }
    // Tiebreaker: preserve algorithm order (lower original rank wins)
    return a.algorithmRank - b.algorithmRank;
  });

  // Protect algorithm's top 4 from being pushed out
  const algorithmTop4 = new Set(
    rankedScores.slice(0, Math.min(4, rankedScores.length)).map((s) => s.programNumber)
  );

  // Assign final projected finish positions
  // But ensure algorithm's top 4 stay in top 4
  const finalOrder: HorseAdjustment[] = [];
  const boostedIntoTop4: HorseAdjustment[] = [];
  const algorithmTop4Horses: HorseAdjustment[] = [];
  const others: HorseAdjustment[] = [];

  for (const adj of horseAdjustments) {
    if (algorithmTop4.has(adj.programNumber)) {
      algorithmTop4Horses.push(adj);
    } else if (adj.adjustment > 0 && adj.adjustedRank <= 4) {
      // Boosted horse trying to enter top 4
      boostedIntoTop4.push(adj);
    } else {
      others.push(adj);
    }
  }

  // Build final order:
  // 1. Algorithm's top 4 horses maintain their positions (sorted by adjusted rank)
  algorithmTop4Horses.sort((a, b) => a.adjustedRank - b.adjustedRank);

  // 2. If a boosted horse would displace an algorithm top-4 horse, don't let it
  // Instead, the boosted horse goes right after the top 4
  const top4Count = Math.min(4, rankedScores.length);

  // Interleave boosted horses into position if they don't displace algorithm top-4
  let algoIdx = 0;
  let boostIdx = 0;

  for (let pos = 1; pos <= top4Count; pos++) {
    const algoHorse = algorithmTop4Horses[algoIdx];
    const boostHorse = boostedIntoTop4[boostIdx];

    if (algoHorse && boostHorse) {
      // Both available - pick the one with better adjusted rank
      // But never let boosted horse push algorithm top-4 out entirely
      if (
        boostHorse.adjustedRank < algoHorse.adjustedRank &&
        finalOrder.length < top4Count - (algorithmTop4Horses.length - algoIdx)
      ) {
        finalOrder.push(boostHorse);
        boostIdx++;
      } else {
        finalOrder.push(algoHorse);
        algoIdx++;
      }
    } else if (algoHorse) {
      finalOrder.push(algoHorse);
      algoIdx++;
    } else if (boostHorse) {
      finalOrder.push(boostHorse);
      boostIdx++;
    }
  }

  // Add remaining algorithm top-4 horses
  while (algoIdx < algorithmTop4Horses.length) {
    finalOrder.push(algorithmTop4Horses[algoIdx]!);
    algoIdx++;
  }

  // Add remaining boosted horses
  while (boostIdx < boostedIntoTop4.length) {
    finalOrder.push(boostedIntoTop4[boostIdx]!);
    boostIdx++;
  }

  // Add all other horses
  finalOrder.push(...others);

  // Assign final positions
  finalOrder.forEach((adj, idx) => {
    adj.adjustedRank = idx + 1;
  });

  // Replace horseAdjustments with final order for remaining code
  horseAdjustments.length = 0;
  horseAdjustments.push(...finalOrder);

  // ============================================================================
  // PART 6: Field Spread Bot Integration (SIMPLIFIED)
  //
  // Do NOT use field spread to change rankings
  // Only use field spread to set isContender flags:
  // - NARROW: top 3 are contenders
  // - MEDIUM: top 4 are contenders
  // - WIDE: top 5 are contenders
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
        contenderCount = Math.min(5, rankedScores.length); // Changed from 6 to 5
        break;
    }
  }

  // ============================================================================
  // PART 7: Determine top pick, value play, and tracking (STRICT VALUEPLAY)
  //
  // valuePlay should be a horse ranked 3rd-5th by ALGORITHM that has:
  // - Trip trouble with maskedAbility = true, OR
  // - Is the lone speed in a slow pace scenario
  //
  // If no horse qualifies, valuePlay = null (don't force it)
  // ============================================================================

  const algorithmTopPick = rankedScores[0]?.programNumber ?? null;
  const aiTopPick = horseAdjustments[0]?.programNumber ?? null;
  const aiPickDiffersFromAlgo = algorithmTopPick !== aiTopPick;

  // Value play: strict criteria
  let valuePlay: number | null = null;

  // Check horses ranked 3rd-5th by algorithm
  const valuePlayCandidates = rankedScores.filter((s) => s.rank >= 3 && s.rank <= 5);

  for (const candidate of valuePlayCandidates) {
    const adj = horseAdjustments.find((h) => h.programNumber === candidate.programNumber);
    if (!adj) continue;

    // Criteria 1: Trip trouble with maskedAbility
    if (adj.hasTripTroubleBoost) {
      valuePlay = candidate.programNumber;
      break;
    }

    // Criteria 2: Lone speed in slow pace scenario
    if (adj.isLoneSpeed && paceScenario?.paceProjection === 'SLOW') {
      valuePlay = candidate.programNumber;
      break;
    }
  }

  // If no horse qualifies, valuePlay stays null (don't force it)

  // ============================================================================
  // PART 8: Build value labels for each horse
  //
  // Value label logic (conservative):
  // - Vulnerable favorite (HIGH confidence): "FAIR PRICE" (not TOO SHORT - for bet sizing only)
  // - Top pick: "PRIME VALUE" or "SOLID PLAY" based on bot insights
  // - Rank 2-3: "SOLID PLAY" or "PRIME VALUE" if has specific edge
  // - Rank 4-5: "WATCH ONLY" (conservative - no +2 adjustments possible now)
  // - Bottom third: "SKIP" or "NO CHANCE"
  // ============================================================================

  const horseInsights = horseAdjustments.map((adj, idx) => {
    const score = rankedScores.find((s) => s.programNumber === adj.programNumber)!;
    const finalRank = idx + 1;
    const isBottomThird = finalRank > Math.ceil((horseAdjustments.length * 2) / 3);

    // Determine value label based on requirements
    let valueLabel: AIRaceAnalysis['horseInsights'][0]['valueLabel'];

    if (adj.isVulnerableFavoriteHorse) {
      // Vulnerable favorite (HIGH confidence only per PART 4)
      // Label as "FAIR PRICE" for bet sizing guidance - NOT a ranking change
      valueLabel = 'FAIR PRICE';
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
      // Rank 4-5 - conservative: just "WATCH ONLY"
      // (Max adjustment is ±1, so no "strong bot boost" scenario)
      valueLabel = 'WATCH ONLY';
    } else {
      valueLabel = 'NO VALUE';
    }

    // Build one-liner
    let oneLiner = adj.oneLiner;
    if (!oneLiner) {
      if (adj.isLoneSpeed) {
        oneLiner = 'Lone speed - should wire field if clean break';
      } else if (adj.hasTripTroubleBoost) {
        oneLiner = 'Trip trouble masked true ability in last start';
      } else if (adj.tripTroubleNote) {
        // Trip trouble noted but not boosted - add informational note
        oneLiner = adj.tripTroubleNote;
      } else if (adj.hasPaceAdvantage) {
        oneLiner = 'Speed duel sets up for closing style';
      } else if (score.positiveFactors[0]) {
        oneLiner = score.positiveFactors[0];
      } else if (score.negativeFactors[0]) {
        oneLiner = `Concern: ${score.negativeFactors[0]}`;
      } else {
        oneLiner = `Ranked #${finalRank} by algorithm`;
      }
    }

    // Update keyStrength/keyWeakness if we have bot-derived insights
    let keyStrength = adj.keyStrength;
    const keyWeakness = adj.keyWeakness;

    if (adj.isLoneSpeed && !keyStrength) {
      keyStrength = 'Lone speed - clear tactical advantage';
    }
    if (adj.hasPaceAdvantage && !keyStrength) {
      keyStrength = 'Speed duel sets up for closing style';
    }
    // NOTE: No pace disadvantage penalties in conservative model

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
  //
  // Conservative narrative: Only report OVERRIDE when there's a HIGH confidence
  // specific signal. Most races should be CONFIRM.
  // ============================================================================

  const narrativeParts: string[] = [];

  // Start with OVERRIDE or CONFIRM
  if (aiPickDiffersFromAlgo) {
    // Find why we overrode (should be rare with conservative approach)
    const newTopAdj = horseAdjustments[0];
    let overrideReason = 'specific bot insight on this horse';

    if (newTopAdj) {
      if (newTopAdj.isLoneSpeed) {
        overrideReason = 'lone speed scenario gives clear tactical edge';
      } else if (newTopAdj.hasTripTroubleBoost) {
        overrideReason = 'masked ability from trip trouble in last start';
      } else if (newTopAdj.hasPaceAdvantage) {
        overrideReason = 'speed duel sets up perfectly for closing style';
      }
    }

    const algoTopName = rankedScores[0]?.horseName || 'unknown';
    const aiTopName = newTopAdj?.horseName || 'unknown';
    narrativeParts.push(
      `OVERRIDE: Moving from ${algoTopName} to ${aiTopName} - ${overrideReason}.`
    );
  } else {
    const topHorse = horseAdjustments[0];
    let confirmReason = 'bot analysis confirms algorithm selection';

    if (topHorse) {
      if (topHorse.isLoneSpeed) {
        confirmReason = 'lone speed advantage reinforces pick';
      } else if (topHorse.hasPaceAdvantage) {
        confirmReason = 'favorable pace setup for closing style';
      } else if (fieldSpread?.fieldType === 'SEPARATED') {
        confirmReason = 'clear separation from field';
      }
    }

    narrativeParts.push(
      `CONFIRM: Algorithm pick ${topHorse?.horseName || 'top choice'} supported - ${confirmReason}.`
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
