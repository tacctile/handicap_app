/**
 * Deliberation Orchestrator
 *
 * Coordinates the 6-bot AI deliberation system:
 * - Phase 1: Bots 1-4 run in parallel (Pattern Scanner, Longshot Hunter, Favorite Killer, Trip Analyst)
 * - Phase 2: Bot 5 (Synthesizer) waits for Phase 1, then runs
 * - Phase 3: Bot 6 (Race Narrator) waits for Phase 2, then produces final output
 */

import type {
  BotId,
  BotAnalysis,
  DeliberationInput,
  DeliberationOutput,
  HorseRanking,
  BettingSuggestion,
} from './types';
import { BOT_INFO } from './types';
import { callGeminiWithRetry, isGeminiError } from './gemini';
import {
  BOT_PROMPTS,
  generateAnalysisBotContent,
  generateSynthesizerContent,
  generateNarratorContent,
  extractMentionedHorses,
  extractConfidence,
} from './prompts';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Temperature settings per bot type */
const BOT_TEMPERATURES: Record<BotId, number> = {
  'pattern-scanner': 0.5, // More deterministic for pattern matching
  'longshot-hunter': 0.8, // More creative for finding value
  'favorite-killer': 0.7, // Balanced contrarian thinking
  'trip-analyst': 0.5, // Fact-based pace analysis
  synthesizer: 0.6, // Balanced synthesis
  'race-narrator': 0.7, // Engaging narrative
};

/** Max output tokens per bot */
const BOT_MAX_TOKENS: Record<BotId, number> = {
  'pattern-scanner': 1024,
  'longshot-hunter': 1024,
  'favorite-killer': 1024,
  'trip-analyst': 1024,
  synthesizer: 1536,
  'race-narrator': 2048,
};

// ============================================================================
// SINGLE BOT EXECUTION
// ============================================================================

/**
 * Execute a single bot's analysis
 */
async function executeBotAnalysis(
  botId: BotId,
  systemPrompt: string,
  userContent: string,
  horseMap: Map<number, string>
): Promise<BotAnalysis> {
  const startTime = Date.now();
  const botInfo = BOT_INFO[botId];

  try {
    const response = await callGeminiWithRetry({
      systemPrompt,
      userContent,
      temperature: BOT_TEMPERATURES[botId],
      maxOutputTokens: BOT_MAX_TOKENS[botId],
    });

    const { positive, negative } = extractMentionedHorses(response.text, horseMap);
    const confidence = extractConfidence(response.text);

    return {
      botId,
      botName: botInfo.name,
      analysis: response.text,
      topPicks: positive,
      concerns: negative,
      confidence,
      processingTimeMs: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    const errorMessage = isGeminiError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Unknown error';

    return {
      botId,
      botName: botInfo.name,
      analysis: '',
      topPicks: [],
      concerns: [],
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

/**
 * Parse the narrator's response into structured output
 */
function parseNarratorResponse(
  text: string,
  horses: DeliberationInput['horses']
): {
  narrative: string;
  rankings: HorseRanking[];
  insights: string[];
  bettingSuggestions: BettingSuggestion[];
} {
  let narrative = '';
  let rankings: HorseRanking[] = [];
  let insights: string[] = [];
  let bettingSuggestions: BettingSuggestion[] = [];

  // Extract narrative
  const narrativeMatch = text.match(/<narrative>([\s\S]*?)<\/narrative>/i);
  if (narrativeMatch && narrativeMatch[1]) {
    narrative = narrativeMatch[1].trim();
  } else {
    // Fallback: use first few paragraphs
    const paragraphs = text.split('\n\n').filter((p) => p.trim().length > 50);
    narrative = paragraphs.slice(0, 3).join('\n\n');
  }

  // Extract rankings
  const rankingsMatch = text.match(/<rankings>([\s\S]*?)<\/rankings>/i);
  if (rankingsMatch && rankingsMatch[1]) {
    try {
      // Find JSON array in the rankings section
      const jsonMatch = rankingsMatch[1].match(/\[[\s\S]*\]/);
      if (jsonMatch && jsonMatch[0]) {
        rankings = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback: create rankings from algorithm scores
      rankings = createFallbackRankings(horses);
    }
  } else {
    rankings = createFallbackRankings(horses);
  }

  // Extract insights
  const insightsMatch = text.match(/<insights>([\s\S]*?)<\/insights>/i);
  if (insightsMatch && insightsMatch[1]) {
    insights = insightsMatch[1]
      .split(/[-•*]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
  }

  // Extract betting suggestions
  const bettingMatch = text.match(/<betting>([\s\S]*?)<\/betting>/i);
  if (bettingMatch && bettingMatch[1]) {
    bettingSuggestions = parseBettingSuggestions(bettingMatch[1], horses);
  }

  return { narrative, rankings, insights, bettingSuggestions };
}

/**
 * Create fallback rankings from algorithm scores
 */
function createFallbackRankings(horses: DeliberationInput['horses']): HorseRanking[] {
  const sorted = [...horses].sort((a, b) => b.algorithmScore - a.algorithmScore);
  const totalScore = sorted.reduce((sum, h) => sum + Math.max(h.algorithmScore, 1), 0);

  return sorted.map((horse, index) => ({
    rank: index + 1,
    programNumber: horse.programNumber,
    horseName: horse.name,
    winProbability: Math.round((Math.max(horse.algorithmScore, 1) / totalScore) * 100),
    valueRating: determineValueRating(horse),
    keyReasons: horse.keyFactors.slice(0, 3),
  }));
}

/**
 * Determine value rating based on horse data
 */
function determineValueRating(horse: DeliberationInput['horses'][0]): HorseRanking['valueRating'] {
  // Parse morning line to decimal
  const mlParts = horse.morningLineOdds.split('-').map(Number);
  const mlDecimal =
    mlParts.length === 2 && mlParts[1] !== 0 ? (mlParts[0] ?? 5) / (mlParts[1] ?? 1) : 5;

  // Higher tier + higher odds = more value potential
  if (horse.tier <= 2 && mlDecimal >= 4) return 'strong-value';
  if (horse.tier <= 3 && mlDecimal >= 2) return 'fair-value';
  if (horse.tier <= 2 && mlDecimal < 1) return 'underlay';
  return 'pass';
}

/**
 * Parse betting suggestions from text
 */
function parseBettingSuggestions(
  text: string,
  horses: DeliberationInput['horses']
): BettingSuggestion[] {
  const suggestions: BettingSuggestion[] = [];
  const horseMap = new Map(horses.map((h) => [h.programNumber, h.name]));

  // Look for win bet mentions
  const winMatch = text.match(/(?:win|bet|play)\s*(?:on)?\s*#?(\d+)/gi);
  if (winMatch) {
    const programNumber = parseInt(winMatch[0].match(/\d+/)?.[0] || '0', 10);
    if (horseMap.has(programNumber)) {
      suggestions.push({
        type: 'win',
        horses: [programNumber],
        confidence: text.toLowerCase().includes('high confidence') ? 'high' : 'medium',
        rationale: extractRationale(text, programNumber),
      });
    }
  }

  // Look for exacta mentions
  const exactaMatch = text.match(/exacta[:\s]+#?(\d+)\s*[-/over]*\s*#?(\d+)/gi);
  if (exactaMatch) {
    const nums = exactaMatch[0].match(/\d+/g)?.map(Number) || [];
    if (nums.length >= 2 && nums.every((n) => horseMap.has(n))) {
      suggestions.push({
        type: 'exacta',
        horses: nums.slice(0, 2),
        confidence: 'medium',
        rationale: 'Top two finishers projected',
      });
    }
  }

  // Look for trifecta mentions
  const trifectaMatch = text.match(/trifecta[:\s]+#?(\d+)[\s,\-/]+#?(\d+)[\s,\-/]+#?(\d+)/gi);
  if (trifectaMatch) {
    const nums = trifectaMatch[0].match(/\d+/g)?.map(Number) || [];
    if (nums.length >= 3 && nums.every((n) => horseMap.has(n))) {
      suggestions.push({
        type: 'trifecta',
        horses: nums.slice(0, 3),
        confidence: 'low',
        rationale: 'Top three finishers projected',
      });
    }
  }

  return suggestions;
}

/**
 * Extract rationale for a specific horse
 */
function extractRationale(text: string, programNumber: number): string {
  const sentences = text.split(/[.!?]+/);
  const relevantSentence = sentences.find(
    (s) => s.includes(`#${programNumber}`) || s.includes(`${programNumber}`)
  );
  return relevantSentence?.trim() || `Selected as top pick (#${programNumber})`;
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Run the complete 6-bot deliberation process
 *
 * @param input - Race data and algorithm scores
 * @returns Complete deliberation output with rankings and narrative
 *
 * @example
 * ```typescript
 * const result = await runDeliberation({
 *   race: { trackCode: 'SAR', raceNumber: 5, ... },
 *   horses: [{ programNumber: 1, name: 'Fast Horse', ... }],
 *   timestamp: new Date().toISOString(),
 * });
 *
 * console.log(result.narrative);
 * console.log(result.rankings);
 * ```
 */
export async function runDeliberation(input: DeliberationInput): Promise<DeliberationOutput> {
  const overallStartTime = Date.now();
  const errors: string[] = [];
  const botAnalyses: BotAnalysis[] = [];

  // Build horse lookup map
  const horseMap = new Map<number, string>(input.horses.map((h) => [h.programNumber, h.name]));

  // Generate content for initial bots
  const initialContent = generateAnalysisBotContent(input);

  // =========================================================================
  // PHASE 1: Run bots 1-4 in parallel
  // =========================================================================
  const phase1Bots: BotId[] = [
    'pattern-scanner',
    'longshot-hunter',
    'favorite-killer',
    'trip-analyst',
  ];

  const phase1Results = await Promise.all(
    phase1Bots.map((botId) =>
      executeBotAnalysis(botId, BOT_PROMPTS[botId], initialContent, horseMap)
    )
  );

  // Collect results
  for (const result of phase1Results) {
    botAnalyses.push(result);
    if (!result.success && result.error) {
      errors.push(`${result.botName}: ${result.error}`);
    }
  }

  // Filter successful analyses for synthesizer
  const successfulPhase1 = phase1Results.filter((r) => r.success);

  // =========================================================================
  // PHASE 2: Run Synthesizer (Bot 5)
  // =========================================================================
  let synthesizerResult: BotAnalysis;

  if (successfulPhase1.length > 0) {
    const synthesizerContent = generateSynthesizerContent(input, successfulPhase1);
    synthesizerResult = await executeBotAnalysis(
      'synthesizer',
      BOT_PROMPTS.synthesizer,
      synthesizerContent,
      horseMap
    );
  } else {
    // All phase 1 bots failed, synthesizer works with raw data
    synthesizerResult = await executeBotAnalysis(
      'synthesizer',
      BOT_PROMPTS.synthesizer,
      `No previous analyses available. Analyze this race independently:\n\n${initialContent}`,
      horseMap
    );
  }

  botAnalyses.push(synthesizerResult);
  if (!synthesizerResult.success && synthesizerResult.error) {
    errors.push(`Synthesizer: ${synthesizerResult.error}`);
  }

  // =========================================================================
  // PHASE 3: Run Race Narrator (Bot 6)
  // =========================================================================
  let narratorResult: BotAnalysis;
  let narrative = '';
  let rankings: HorseRanking[] = [];
  let keyInsights: string[] = [];
  let bettingSuggestions: BettingSuggestion[] = [];

  if (synthesizerResult.success) {
    const narratorContent = generateNarratorContent(input, synthesizerResult);
    narratorResult = await executeBotAnalysis(
      'race-narrator',
      BOT_PROMPTS['race-narrator'],
      narratorContent,
      horseMap
    );
  } else {
    // Synthesizer failed, narrator works with phase 1 results
    const fallbackContent =
      successfulPhase1.length > 0
        ? generateSynthesizerContent(input, successfulPhase1) +
          '\n\nCreate the final output despite missing synthesis.'
        : `Analyze this race and create the final output:\n\n${initialContent}`;

    narratorResult = await executeBotAnalysis(
      'race-narrator',
      BOT_PROMPTS['race-narrator'],
      fallbackContent,
      horseMap
    );
  }

  botAnalyses.push(narratorResult);

  if (narratorResult.success) {
    const parsed = parseNarratorResponse(narratorResult.analysis, input.horses);
    narrative = parsed.narrative;
    rankings = parsed.rankings;
    keyInsights = parsed.insights;
    bettingSuggestions = parsed.bettingSuggestions;
  } else {
    if (narratorResult.error) {
      errors.push(`Race Narrator: ${narratorResult.error}`);
    }
    // Fallback output
    narrative = 'Unable to generate race narrative due to processing errors.';
    rankings = createFallbackRankings(input.horses);
    keyInsights = ['Analysis incomplete - review algorithm scores for guidance.'];
  }

  // =========================================================================
  // BUILD FINAL OUTPUT
  // =========================================================================
  const totalProcessingTimeMs = Date.now() - overallStartTime;
  const successfulBots = botAnalyses.filter((b) => b.success).length;
  const overallSuccess = successfulBots >= 4; // At least 4 of 6 bots succeeded
  const partialResults = successfulBots > 0 && successfulBots < 6;

  // Calculate overall confidence from successful bot confidences
  const confidences = botAnalyses.filter((b) => b.success).map((b) => b.confidence);
  const overallConfidence =
    confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;

  return {
    botAnalyses,
    rankings,
    narrative,
    bettingSuggestions,
    keyInsights,
    overallConfidence,
    totalProcessingTimeMs,
    completedAt: new Date().toISOString(),
    success: overallSuccess,
    partialResults,
    errors,
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Run a single bot for testing/debugging
 */
export async function runSingleBot(botId: BotId, input: DeliberationInput): Promise<BotAnalysis> {
  const horseMap = new Map<number, string>(input.horses.map((h) => [h.programNumber, h.name]));
  const content = generateAnalysisBotContent(input);

  return executeBotAnalysis(botId, BOT_PROMPTS[botId], content, horseMap);
}

/**
 * Check if deliberation service is ready
 */
export { isGeminiConfigured } from './gemini';
