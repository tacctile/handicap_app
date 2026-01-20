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

// Environment detection for isomorphic code (browser + Node.js serverless)
// Note: process.env is available in Node.js environments (serverless, tests)
// import.meta.env is available in Vite browser environments

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
  // Check for API key in both Vite (browser) and Node (serverless/test) environments
  const hasApiKey =
    // Node.js environment (serverless functions, tests, CI)
    (typeof process !== 'undefined' &&
      !!(process.env?.VITE_GEMINI_API_KEY || process.env?.GEMINI_API_KEY)) ||
    // Vite browser environment
    (typeof import.meta !== 'undefined' && !!import.meta.env?.VITE_GEMINI_API_KEY);

  if (!hasApiKey) {
    return 'offline';
  }

  // In Node environment (serverless/tests), skip navigator check
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
  // Wrap each in try/catch with detailed error logging
  const [tripResult, paceResult, favoriteResult, spreadResult] = await Promise.allSettled([
    analyzeTripTrouble(race, scoringResult).catch((err) => {
      console.error(`TripTrouble bot error:`, err?.message || err);
      throw err;
    }),
    analyzePaceScenario(race, scoringResult).catch((err) => {
      console.error(`PaceScenario bot error:`, err?.message || err);
      throw err;
    }),
    analyzeVulnerableFavorite(race, scoringResult).catch((err) => {
      console.error(`VulnerableFavorite bot error:`, err?.message || err);
      throw err;
    }),
    analyzeFieldSpread(race, scoringResult).catch((err) => {
      console.error(`FieldSpread bot error:`, err?.message || err);
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

  // Log detailed failure information
  if (tripResult.status === 'rejected') {
    console.error(
      `TripTrouble bot FAILED - Reason:`,
      tripResult.reason?.message || tripResult.reason
    );
  }
  if (paceResult.status === 'rejected') {
    console.error(
      `PaceScenario bot FAILED - Reason:`,
      paceResult.reason?.message || paceResult.reason
    );
  }
  if (favoriteResult.status === 'rejected') {
    console.error(
      `VulnerableFavorite bot FAILED - Reason:`,
      favoriteResult.reason?.message || favoriteResult.reason
    );
  }
  if (spreadResult.status === 'rejected') {
    console.error(
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

  // ============================================================================
  // DEBUG LOGGING: Show each bot's raw output (or "bot failed" if null)
  // Note: Detailed error messages are logged in getMultiBotAnalysis before this
  // ============================================================================
  console.log(`\n=== COMBINER DEBUG: Race ${race.header.raceNumber} ===`);
  console.log(
    'TripTrouble bot:',
    tripTrouble
      ? `SUCCESS - ${tripTrouble.horsesWithTripTrouble.length} horses with trip trouble`
      : 'FAILED (see error above)'
  );
  if (tripTrouble) {
    tripTrouble.horsesWithTripTrouble.forEach((h) => {
      console.log(
        `  - #${h.programNumber} ${h.horseName}: ${h.issue} (maskedAbility=${h.maskedAbility})`
      );
    });
  }

  console.log(
    'PaceScenario bot:',
    paceScenario
      ? `SUCCESS - pace=${paceScenario.paceProjection}, loneSpeedException=${paceScenario.loneSpeedException}, speedDuel=${paceScenario.speedDuelLikely}`
      : 'FAILED (see error above)'
  );

  console.log(
    'VulnerableFavorite bot:',
    vulnerableFavorite
      ? `SUCCESS - isVulnerable=${vulnerableFavorite.isVulnerable}, confidence=${vulnerableFavorite.confidence}, reasons=[${vulnerableFavorite.reasons.join(', ')}]`
      : 'FAILED (see error above)'
  );

  console.log(
    'FieldSpread bot:',
    fieldSpread
      ? `SUCCESS - fieldType=${fieldSpread.fieldType}, topTierCount=${fieldSpread.topTierCount}, spread=${fieldSpread.recommendedSpread}`
      : 'FAILED (see error above)'
  );

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
  // PART 2: Trip Trouble Bot Integration (HIGH/MEDIUM CONFIDENCE)
  //
  // HIGH confidence trip trouble criteria:
  //   - maskedAbility = true AND
  //   - 2 or more troubled races in last 3 starts AND
  //   - Most recent troubled race finished 4th or worse
  //   → Apply +2 adjustment (can move from rank 3 to rank 1)
  //
  // MEDIUM confidence (1 troubled race):
  //   - maskedAbility = true AND
  //   - 1 troubled race with 4th or worse finish
  //   → Apply +1 adjustment
  //
  // If criteria not met but trip trouble exists, add note to oneLiner only
  // ============================================================================

  console.log('--- Evaluating Trip Trouble triggers ---');

  if (tripTrouble) {
    for (const tripHorse of tripTrouble.horsesWithTripTrouble) {
      const adj = horseAdjustments.find((h) => h.programNumber === tripHorse.programNumber);
      if (!adj) {
        console.log(`  #${tripHorse.programNumber}: horse not found in adjustments`);
        continue;
      }

      const issueLower = tripHorse.issue.toLowerCase();

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
        issueLower.includes('blocked') ||
        issueLower.includes('checked') ||
        issueLower.includes('bumped') ||
        issueLower.includes('steadied') ||
        // If maskedAbility is true, bot believes ability was masked - trust that
        tripHorse.maskedAbility;

      // Check for 2+ troubled races indicators
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

      // Determine confidence level
      const isHighConfidence =
        tripHorse.maskedAbility && hasTwoOrMoreTroubledRaces && hadPoorFinish;
      const isMediumConfidence = tripHorse.maskedAbility && hadPoorFinish && !isHighConfidence;

      console.log(
        `  #${tripHorse.programNumber} ${tripHorse.horseName}: maskedAbility=${tripHorse.maskedAbility}, hadPoorFinish=${hadPoorFinish}, hasTwoOrMore=${hasTwoOrMoreTroubledRaces}, confidence=${isHighConfidence ? 'HIGH' : isMediumConfidence ? 'MEDIUM' : 'LOW'}`
      );

      if (isHighConfidence) {
        // HIGH confidence - apply +2 boost
        adj.adjustment = 2;
        adj.hasTripTroubleBoost = true;
        adj.oneLiner = 'Trip trouble masked true ability - multiple troubled races';
        console.log(
          `    Trip Trouble: #${tripHorse.programNumber} HIGH confidence (2+ troubled) - BOOST +2`
        );
      } else if (isMediumConfidence) {
        // MEDIUM confidence - apply +1 boost
        adj.adjustment = 1;
        adj.hasTripTroubleBoost = true;
        adj.oneLiner = 'Trip trouble masked true ability';
        console.log(
          `    Trip Trouble: #${tripHorse.programNumber} MEDIUM confidence (1 troubled) - BOOST +1`
        );
      } else {
        // Criteria not fully met - add note but NO ranking adjustment
        adj.tripTroubleNote = tripHorse.maskedAbility
          ? 'Has trip trouble history - watch for improvement'
          : `Trip note: ${tripHorse.issue}`;
        console.log(`    → Note added (no boost): ${adj.tripTroubleNote}`);
      }
    }
  } else {
    console.log('  TripTrouble bot failed - skipping');
  }

  // ============================================================================
  // PART 3: Pace Scenario Bot Integration (RELAXED)
  //
  // Apply pace adjustment when:
  // - loneSpeedException = true → find the E or E/P horse with highest early speed, boost +1
  // - speedDuelLikely = true AND paceProjection = "HOT" → boost closers (C style) by +1
  //
  // Cap at +1 even if both conditions met
  // Do NOT penalize any horse based on pace
  // ============================================================================

  let loneSpeedHorse: number | null = null;

  console.log('--- Evaluating Pace Scenario triggers ---');
  if (paceScenario) {
    // CASE 1: Lone speed exception - find the E or E/P horse with highest early speed
    if (paceScenario.loneSpeedException) {
      console.log('  loneSpeedException = true, looking for E or E/P horse');

      // Find all E or E/P running style horses
      const speedHorses = rankedScores
        .filter((score) => {
          const horse = race.horses.find((h) => h.programNumber === score.programNumber);
          const style = horse?.runningStyle?.toLowerCase() || '';
          return style === 'e' || style === 'e/p' || style.includes('early');
        })
        .map((score) => {
          const horse = race.horses.find((h) => h.programNumber === score.programNumber);
          // Get early speed from past performances if available
          const earlySpeed = horse?.pastPerformances?.[0]?.earlyPace1 || 0;
          return { programNumber: score.programNumber, earlySpeed };
        });

      console.log(
        `  Found ${speedHorses.length} speed horses: ${speedHorses.map((h) => `#${h.programNumber}`).join(', ')}`
      );

      // Find the one with highest early speed (or first if no early speed data)
      if (speedHorses.length > 0) {
        speedHorses.sort((a, b) => b.earlySpeed - a.earlySpeed);
        loneSpeedHorse = speedHorses[0]!.programNumber;
        const adj = horseAdjustments.find((h) => h.programNumber === loneSpeedHorse);
        if (adj) {
          adj.adjustment = 1; // +1 boost (max)
          adj.isLoneSpeed = true;
          adj.keyStrength = 'Lone speed - clear tactical advantage';
          console.log(`    → BOOST +1 applied to #${loneSpeedHorse}`);
        }
      } else {
        console.log('  No E or E/P horses found');
      }
    }

    // CASE 2: Speed duel likely AND HOT pace - boost closers only
    if (paceScenario.speedDuelLikely && paceScenario.paceProjection === 'HOT') {
      console.log('  speedDuelLikely = true AND paceProjection = HOT, boosting closers');

      for (const adj of horseAdjustments) {
        const horse = race.horses.find((h) => h.programNumber === adj.programNumber);
        const style = horse?.runningStyle?.toLowerCase() || '';

        // Check if this horse is a closer (C style)
        const isCloser = style === 'c' || style.includes('closer');

        if (isCloser && adj.adjustment === 0) {
          // Only apply if no other adjustment already made
          adj.adjustment = 1; // +1 boost (max, cap even if both conditions met)
          adj.hasPaceAdvantage = true;
          adj.keyStrength = 'Speed duel sets up for closing style';
          console.log(`    → BOOST +1 applied to #${adj.programNumber} (closer)`);
        }
      }
    } else if (paceScenario.speedDuelLikely) {
      console.log(
        `  speedDuelLikely = true BUT paceProjection = ${paceScenario.paceProjection} (not HOT) - no closer boost`
      );
    }

    // NOTE: We do NOT penalize any horse based on pace (removed disadvantage logic)
  } else {
    console.log('  PaceScenario bot failed - skipping');
  }

  // ============================================================================
  // PART 4: Vulnerable Favorite Bot Integration
  //
  // HIGH confidence (isVulnerable = true AND confidence = "HIGH"):
  //   → Drop favorite's ranking by 1 position (adjustment = -1)
  //   → This allows #2 horse to become the new top pick
  //
  // MEDIUM confidence (isVulnerable = true AND confidence = "MEDIUM"):
  //   → Flag only, no ranking change
  //   → Set valueLabel = "FAIR PRICE" and keyWeakness
  //
  // The vulnerable favorite flag is for bet sizing guidance
  // ============================================================================

  console.log('--- Evaluating Vulnerable Favorite trigger ---');

  // Find the favorite (lowest ML odds or #1 algorithm rank)
  const favoriteScore = rankedScores.reduce((fav, curr) => {
    const favHorse = race.horses.find((h) => h.programNumber === fav.programNumber);
    const currHorse = race.horses.find((h) => h.programNumber === curr.programNumber);
    const favOdds = parseFloat(favHorse?.morningLineOdds?.replace('-', '.') || '99');
    const currOdds = parseFloat(currHorse?.morningLineOdds?.replace('-', '.') || '99');
    return currOdds < favOdds ? curr : fav;
  }, rankedScores[0]!);

  const favoriteProgram = favoriteScore.programNumber;
  console.log(`  Favorite identified: #${favoriteProgram} ${favoriteScore.horseName}`);

  // Set flag for MEDIUM or HIGH confidence
  const isVulnerableFavoriteFlag =
    vulnerableFavorite?.isVulnerable === true &&
    (vulnerableFavorite?.confidence === 'HIGH' || vulnerableFavorite?.confidence === 'MEDIUM');

  console.log(
    `  VulnerableFavorite check: isVulnerable=${vulnerableFavorite?.isVulnerable}, confidence=${vulnerableFavorite?.confidence}, flagSet=${isVulnerableFavoriteFlag}`
  );

  // Track if we're overriding due to vulnerable favorite
  let vulnerableFavoriteOverride = false;

  if (vulnerableFavorite?.isVulnerable) {
    const favAdj = horseAdjustments.find((h) => h.programNumber === favoriteProgram);
    if (favAdj) {
      // Set the internal flag for MEDIUM or HIGH confidence
      if (vulnerableFavorite.confidence === 'HIGH' || vulnerableFavorite.confidence === 'MEDIUM') {
        favAdj.isVulnerableFavoriteHorse = true;
        console.log(`    → Flag set on #${favoriteProgram}`);
      }

      // Set keyWeakness from bot's reasons for UI display
      if (vulnerableFavorite.reasons.length > 0) {
        favAdj.keyWeakness = vulnerableFavorite.reasons[0] || null;
        console.log(`    → keyWeakness set: ${favAdj.keyWeakness}`);
      }

      // HIGH confidence: Apply -1 adjustment to drop favorite in rankings
      if (vulnerableFavorite.confidence === 'HIGH' && favAdj.algorithmRank === 1) {
        favAdj.adjustment = -1; // Negative = move down in rankings
        vulnerableFavoriteOverride = true;
        console.log(
          `    Vulnerable Favorite: HIGH confidence - dropping #${favoriteProgram} from rank 1 to rank 2`
        );
      } else if (vulnerableFavorite.confidence === 'MEDIUM') {
        // MEDIUM confidence: Flag only, no ranking change
        console.log(`    → MEDIUM confidence - flag only, no ranking change`);
      }
    }
  } else if (vulnerableFavorite === null) {
    console.log('  VulnerableFavorite bot failed - skipping');
  } else {
    console.log('  Favorite is NOT vulnerable');
  }

  // ============================================================================
  // PART 5: Apply adjustment caps (±2 MAX) and calculate adjusted ranks
  //
  // SAFEGUARDS:
  // - Maximum total adjustment per horse: +2 (cap)
  // - No horse can move more than 2 positions from algorithm rank
  // - Minimum finalRank = 1, maximum = field size
  // - If multiple adjustments would apply to same horse, we already take largest (don't stack)
  //   because each adjustment type assigns directly to adj.adjustment
  //
  // MATH:
  // - adj=+2 (boost) → adjustedRank = algorithmRank - 2 (move UP 2 in rankings)
  // - adj=+1 (boost) → adjustedRank = algorithmRank - 1 (move UP 1 in rankings)
  // - adj=-1 (penalize) → adjustedRank = algorithmRank + 1 (move DOWN 1 in rankings)
  // ============================================================================

  const fieldSize = rankedScores.length;

  // Cap ALL adjustments at ±2 (allow high-confidence moves up to 2 positions)
  for (const adj of horseAdjustments) {
    adj.adjustment = Math.max(-2, Math.min(2, adj.adjustment));
  }

  // Calculate adjusted ranks with bounds capping
  // Positive adjustment = move up = lower rank number
  // Negative adjustment = move down = higher rank number
  for (const adj of horseAdjustments) {
    const rawAdjustedRank = adj.algorithmRank - adj.adjustment;
    // Cap to valid range: minimum 1, maximum field size
    adj.adjustedRank = Math.max(1, Math.min(fieldSize, rawAdjustedRank));
  }

  // ============================================================================
  // PART 5B: Re-sort all horses by adjustedRank to determine final order
  //
  // Sort by adjusted rank.
  // Tiebreaker logic (when adjustedRank ties):
  // 1. Higher adjustment wins (horse that earned their position via boost)
  // 2. If same adjustment, higher original rank wins (they moved up relatively)
  // ============================================================================

  // Re-sort by adjusted rank
  horseAdjustments.sort((a, b) => {
    if (a.adjustedRank !== b.adjustedRank) {
      return a.adjustedRank - b.adjustedRank;
    }
    // Tiebreaker: higher adjustment value wins (earned their position)
    // If same adjustment, higher original rank wins (they moved up relatively)
    if (a.adjustment !== b.adjustment) {
      return b.adjustment - a.adjustment; // Higher adjustment wins
    }
    // Same adjustedRank and same adjustment: higher original rank wins
    // (they earned their position through relative movement)
    return b.algorithmRank - a.algorithmRank;
  });

  // ============================================================================
  // PART 6: Field Spread Bot Integration (SIMPLIFIED - NO EXOTIC INFLUENCE)
  //
  // REMOVED: Logic that uses fieldSpread.recommendedSpread to set isContender count
  // INSTEAD: Always mark algorithm's top 4 as isContender = true
  //
  // Field spread bot output is still logged and can be included in narrative,
  // but it does NOT change contender flags anymore.
  // ============================================================================

  console.log('--- Evaluating Field Spread ---');
  // ALWAYS use top 4 as contenders - field spread no longer influences this
  const contenderCount = Math.min(4, rankedScores.length);
  if (fieldSpread) {
    // Log field spread for narrative purposes only
    console.log(
      `  FieldSpread: fieldType=${fieldSpread.fieldType}, topTierCount=${fieldSpread.topTierCount}, spread=${fieldSpread.recommendedSpread}`
    );
    console.log(`  → Contender count FIXED at ${contenderCount} (ignoring spread recommendation)`);
  } else {
    console.log('  FieldSpread bot failed - using default contenderCount=4');
  }

  // Log final adjustments per horse with before/after ranks
  console.log('--- Final Adjustments ---');
  horseAdjustments.forEach((adj, idx) => {
    const projectedFinish = idx + 1;
    // Show all horses that have adjustments or special flags
    if (
      adj.adjustment !== 0 ||
      adj.isLoneSpeed ||
      adj.hasTripTroubleBoost ||
      adj.hasPaceAdvantage ||
      adj.isVulnerableFavoriteHorse
    ) {
      // Movement direction based on adjustment
      const movement = adj.adjustment > 0 ? '(MOVED UP)' : adj.adjustment < 0 ? '(MOVED DOWN)' : '';
      console.log(
        `  #${adj.programNumber} ${adj.horseName}: algoRank=${adj.algorithmRank}, adj=${adj.adjustment > 0 ? '+' : ''}${adj.adjustment}, finalRank=${adj.adjustedRank}, projectedFinish=${projectedFinish} ${movement} flags=[${[
          adj.hasTripTroubleBoost ? 'tripTrouble' : '',
          adj.isLoneSpeed ? 'loneSpeed' : '',
          adj.hasPaceAdvantage ? 'paceAdv' : '',
          adj.isVulnerableFavoriteHorse ? 'vulnFav' : '',
        ]
          .filter(Boolean)
          .join(', ')}]`
      );
    }
  });

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
  // OVERRIDE reasons:
  // - "OVERRIDE: Favorite vulnerable (HIGH) - #X now top pick"
  // - "OVERRIDE: #X has masked ability from trip trouble - promoted to top pick"
  //
  // CONFIRM:
  // - "CONFIRM: Algorithm's #X supported by pace scenario and form"
  // ============================================================================

  const narrativeParts: string[] = [];

  // Start with OVERRIDE or CONFIRM
  if (aiPickDiffersFromAlgo) {
    // Find why we overrode
    const newTopAdj = horseAdjustments[0];
    const aiTopName = newTopAdj?.horseName || 'unknown';
    const aiTopNum = newTopAdj?.programNumber || 0;

    // Check specific override reasons in priority order
    if (vulnerableFavoriteOverride && favoriteScore.rank === 1) {
      // Override was due to vulnerable favorite HIGH confidence
      narrativeParts.push(
        `OVERRIDE: Favorite vulnerable (HIGH) - #${aiTopNum} ${aiTopName} now top pick`
      );
    } else if (newTopAdj?.hasTripTroubleBoost) {
      // Override was due to trip trouble
      narrativeParts.push(
        `OVERRIDE: #${aiTopNum} ${aiTopName} has masked ability from trip trouble - promoted to top pick`
      );
    } else if (newTopAdj?.isLoneSpeed) {
      narrativeParts.push(
        `OVERRIDE: #${aiTopNum} ${aiTopName} lone speed scenario gives clear tactical edge`
      );
    } else if (newTopAdj?.hasPaceAdvantage) {
      narrativeParts.push(
        `OVERRIDE: #${aiTopNum} ${aiTopName} speed duel sets up perfectly for closing style`
      );
    } else {
      // Generic override
      const algoTopName = rankedScores[0]?.horseName || 'unknown';
      narrativeParts.push(
        `OVERRIDE: Moving from ${algoTopName} to ${aiTopName} - specific bot insight`
      );
    }
  } else {
    const topHorse = horseAdjustments[0];
    const topName = topHorse?.horseName || 'top choice';
    const topNum = topHorse?.programNumber || 0;

    // Build confirm reason parts
    const confirmReasons: string[] = [];
    if (paceScenario) {
      confirmReasons.push('pace scenario');
    }
    if (topHorse?.keyStrength) {
      confirmReasons.push('form');
    }
    if (fieldSpread?.fieldType === 'SEPARATED') {
      confirmReasons.push('clear separation from field');
    }

    const reasonText = confirmReasons.length > 0 ? confirmReasons.join(' and ') : 'bot analysis';
    narrativeParts.push(`CONFIRM: Algorithm's #${topNum} ${topName} supported by ${reasonText}`);
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
