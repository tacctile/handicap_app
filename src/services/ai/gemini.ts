/**
 * Gemini AI Service
 *
 * Single-bot race analysis using Google's Gemini 2.0 Flash-Lite model.
 * Takes algorithm scores and produces AI insights, rankings, and value labels.
 */

import type { ParsedRace } from '../../types/drf';
import type { RaceScoringResult } from '../../types/scoring';
import type {
  AIRaceAnalysis,
  AIServiceError,
  AIServiceErrorCode,
  TripTroubleAnalysis,
  PaceScenarioAnalysis,
  VulnerableFavoriteAnalysis,
  FieldSpreadAnalysis,
} from './types';
import {
  buildRaceAnalysisPrompt,
  buildTripTroublePrompt,
  buildPaceScenarioPrompt,
  buildVulnerableFavoritePrompt,
  buildFieldSpreadPrompt,
} from './prompt';

// Environment detection helpers for isomorphic code (browser + Node.js serverless)
// Note: process.env is available in Node.js environments (serverless, tests)
// import.meta.env is available in Vite browser environments

// ============================================================================
// CONFIGURATION
// ============================================================================

const GEMINI_MODEL = 'gemini-2.0-flash-lite';
const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS = 30000;

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

/**
 * Get the Gemini API key from environment variables
 * Works in both browser (Vite) and server (Node.js) environments
 */
function getApiKey(): string {
  // Check Node environment first (serverless functions, tests, CI)
  // This works because Vercel injects env vars as process.env
  if (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) {
    return process.env.VITE_GEMINI_API_KEY;
  }
  // Also check for GEMINI_API_KEY without VITE_ prefix (server-side convention)
  if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  // Check Vite environment (browser)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  return '';
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Create a structured AI service error
 */
function createError(code: AIServiceErrorCode, message: string): AIServiceError {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Type guard for AIServiceError
 */
function isAIServiceError(error: unknown): error is AIServiceError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a race using Gemini AI
 *
 * Takes the parsed race data and algorithm scoring results,
 * sends them to Gemini, and returns structured AI analysis.
 *
 * @param race - Parsed race data from DRF file
 * @param scoringResult - Algorithm scoring results
 * @returns AIRaceAnalysis with insights and rankings
 * @throws AIServiceError on failure
 */
export async function analyzeRaceWithGemini(
  race: ParsedRace,
  scoringResult: RaceScoringResult
): Promise<AIRaceAnalysis> {
  const startTime = Date.now();
  const apiKey = getApiKey();

  if (!apiKey) {
    throw createError('API_KEY_MISSING', 'Gemini API key not configured');
  }

  const prompt = buildRaceAnalysisPrompt(race, scoringResult);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25, // Balance between consistency (0.15) and creativity (0.3)
          topP: 0.85,
          maxOutputTokens: 2048,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw createError('API_ERROR', `Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw createError('PARSE_ERROR', 'No content in Gemini response');
    }

    return parseGeminiResponse(text, race.header.raceNumber, Date.now() - startTime);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw createError('TIMEOUT', `Request timed out after ${TIMEOUT_MS}ms`);
    }

    if (isAIServiceError(error)) {
      throw error;
    }

    throw createError(
      'NETWORK_ERROR',
      `Network error: ${error instanceof Error ? error.message : 'Unknown'}`
    );
  }
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

/**
 * Parse Gemini's JSON response into AIRaceAnalysis
 *
 * Handles potential markdown wrapping and validates required fields.
 *
 * @param text - Raw text response from Gemini
 * @param raceNumber - Race number for the analysis
 * @param processingTimeMs - How long the request took
 * @returns Parsed AIRaceAnalysis object
 * @throws AIServiceError on parse failure
 */
export function parseGeminiResponse(
  text: string,
  raceNumber: number,
  processingTimeMs: number
): AIRaceAnalysis {
  // Extract JSON from response (handle potential markdown wrapping)
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  }
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate required fields exist
    if (!parsed.horseInsights || !Array.isArray(parsed.horseInsights)) {
      throw new Error('Missing horseInsights array');
    }

    return {
      raceId: `race-${raceNumber}`,
      raceNumber,
      timestamp: new Date().toISOString(),
      processingTimeMs,
      raceNarrative: parsed.raceNarrative || '',
      confidence: parsed.confidence || 'MEDIUM',
      bettableRace: parsed.bettableRace ?? true,
      horseInsights: parsed.horseInsights,
      topPick: parsed.topPick ?? null,
      valuePlay: parsed.valuePlay ?? null,
      avoidList: parsed.avoidList || [],
      vulnerableFavorite: parsed.vulnerableFavorite ?? false,
      likelyUpset: parsed.likelyUpset ?? false,
      chaoticRace: parsed.chaoticRace ?? false,
    };
  } catch (e) {
    throw createError(
      'PARSE_ERROR',
      `Failed to parse Gemini response: ${e instanceof Error ? e.message : 'Unknown'}`
    );
  }
}

// ============================================================================
// MULTI-BOT ARCHITECTURE
// ============================================================================

/**
 * Configuration for multi-bot API calls
 */
const MULTI_BOT_CONFIG = {
  temperature: 0.2, // Lower for more consistent specialized outputs
  topP: 0.8,
  maxOutputTokens: 256, // Smaller output for focused bot responses
  timeoutMs: 15000, // Shorter timeout for individual bots
};

/**
 * Generic Gemini API caller with custom response parser
 *
 * Reuses existing fetch logic, timeout, and error handling.
 * Allows any bot to call Gemini with a custom parser for their specific output format.
 *
 * @param prompt - The prompt to send to Gemini
 * @param parseResponse - Function to parse the text response into type T
 * @returns Parsed response of type T
 * @throws AIServiceError on failure
 */
export async function callGeminiWithSchema<T>(
  prompt: string,
  parseResponse: (text: string) => T
): Promise<T> {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw createError('API_KEY_MISSING', 'Gemini API key not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MULTI_BOT_CONFIG.timeoutMs);

  try {
    const response = await fetch(`${API_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: MULTI_BOT_CONFIG.temperature,
          topP: MULTI_BOT_CONFIG.topP,
          maxOutputTokens: MULTI_BOT_CONFIG.maxOutputTokens,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw createError('API_ERROR', `Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw createError('PARSE_ERROR', 'No content in Gemini response');
    }

    // Log raw response text for debugging parsing issues
    console.log('[Gemini Bot] Raw response text (first 500 chars):', text.substring(0, 500));

    try {
      return parseResponse(text);
    } catch (parseErr) {
      // Log full response on parse failure for debugging
      console.error('[Gemini Bot] Parse error. Full raw response:', text);
      throw parseErr;
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw createError('TIMEOUT', `Request timed out after ${MULTI_BOT_CONFIG.timeoutMs}ms`);
    }

    if (isAIServiceError(error)) {
      throw error;
    }

    throw createError(
      'NETWORK_ERROR',
      `Network error: ${error instanceof Error ? error.message : 'Unknown'}`
    );
  }
}

// ============================================================================
// RESPONSE PARSERS
// ============================================================================

/**
 * Extract JSON from response text (handles markdown wrapping)
 */
function extractJson(text: string): string {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or invalid response text');
  }

  let jsonStr = text.trim();

  // Handle markdown code blocks
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  }
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }

  jsonStr = jsonStr.trim();

  // Try to find JSON object if text has other content
  if (!jsonStr.startsWith('{') && !jsonStr.startsWith('[')) {
    // Look for JSON object in the response
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }

  if (!jsonStr) {
    throw new Error('No JSON content found in response');
  }

  return jsonStr;
}

/**
 * Parse Trip Trouble Bot response
 *
 * @param text - Raw text response from Gemini
 * @returns TripTroubleAnalysis
 * @throws Error on parse failure
 */
export function parseTripTroubleResponse(text: string): TripTroubleAnalysis {
  const jsonStr = extractJson(text);

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate required field
    if (!Array.isArray(parsed.horsesWithTripTrouble)) {
      throw new Error('Missing horsesWithTripTrouble array');
    }

    // Validate each entry has required fields
    const validatedHorses = parsed.horsesWithTripTrouble.map(
      (h: {
        programNumber?: number;
        horseName?: string;
        issue?: string;
        maskedAbility?: boolean;
      }) => ({
        programNumber: typeof h.programNumber === 'number' ? h.programNumber : 0,
        horseName: typeof h.horseName === 'string' ? h.horseName : '',
        issue: typeof h.issue === 'string' ? h.issue : '',
        maskedAbility: typeof h.maskedAbility === 'boolean' ? h.maskedAbility : false,
      })
    );

    return {
      horsesWithTripTrouble: validatedHorses,
    };
  } catch (e) {
    throw new Error(
      `Failed to parse TripTroubleResponse: ${e instanceof Error ? e.message : 'Unknown'}`
    );
  }
}

/**
 * Parse Pace Scenario Bot response
 *
 * @param text - Raw text response from Gemini
 * @returns PaceScenarioAnalysis
 * @throws Error on parse failure
 */
export function parsePaceScenarioResponse(text: string): PaceScenarioAnalysis {
  const jsonStr = extractJson(text);

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate and normalize pace projection
    const validPaceProjections = ['HOT', 'MODERATE', 'SLOW'];
    const paceProjection = validPaceProjections.includes(parsed.paceProjection)
      ? (parsed.paceProjection as 'HOT' | 'MODERATE' | 'SLOW')
      : 'MODERATE';

    return {
      advantagedStyles: Array.isArray(parsed.advantagedStyles) ? parsed.advantagedStyles : [],
      disadvantagedStyles: Array.isArray(parsed.disadvantagedStyles)
        ? parsed.disadvantagedStyles
        : [],
      paceProjection,
      loneSpeedException:
        typeof parsed.loneSpeedException === 'boolean' ? parsed.loneSpeedException : false,
      speedDuelLikely: typeof parsed.speedDuelLikely === 'boolean' ? parsed.speedDuelLikely : false,
    };
  } catch (e) {
    throw new Error(
      `Failed to parse PaceScenarioResponse: ${e instanceof Error ? e.message : 'Unknown'}`
    );
  }
}

/**
 * Parse Vulnerable Favorite Bot response
 *
 * @param text - Raw text response from Gemini
 * @returns VulnerableFavoriteAnalysis
 * @throws Error on parse failure
 */
export function parseVulnerableFavoriteResponse(text: string): VulnerableFavoriteAnalysis {
  const jsonStr = extractJson(text);

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate and normalize confidence
    const validConfidence = ['HIGH', 'MEDIUM', 'LOW'];
    const confidence = validConfidence.includes(parsed.confidence)
      ? (parsed.confidence as 'HIGH' | 'MEDIUM' | 'LOW')
      : 'MEDIUM';

    return {
      isVulnerable: typeof parsed.isVulnerable === 'boolean' ? parsed.isVulnerable : false,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      confidence,
    };
  } catch (e) {
    throw new Error(
      `Failed to parse VulnerableFavoriteResponse: ${e instanceof Error ? e.message : 'Unknown'}`
    );
  }
}

/**
 * Parse Field Spread Bot response
 *
 * @param text - Raw text response from Gemini
 * @returns FieldSpreadAnalysis
 * @throws Error on parse failure
 */
export function parseFieldSpreadResponse(text: string): FieldSpreadAnalysis {
  const jsonStr = extractJson(text);

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate and normalize field type
    const validFieldTypes = ['TIGHT', 'SEPARATED', 'MIXED'];
    const fieldType = validFieldTypes.includes(parsed.fieldType)
      ? (parsed.fieldType as 'TIGHT' | 'SEPARATED' | 'MIXED')
      : 'MIXED';

    // Validate and normalize recommended spread
    const validSpreads = ['NARROW', 'MEDIUM', 'WIDE'];
    const recommendedSpread = validSpreads.includes(parsed.recommendedSpread)
      ? (parsed.recommendedSpread as 'NARROW' | 'MEDIUM' | 'WIDE')
      : 'MEDIUM';

    return {
      fieldType,
      topTierCount: typeof parsed.topTierCount === 'number' ? parsed.topTierCount : 0,
      recommendedSpread,
    };
  } catch (e) {
    throw new Error(
      `Failed to parse FieldSpreadResponse: ${e instanceof Error ? e.message : 'Unknown'}`
    );
  }
}

// ============================================================================
// INDIVIDUAL BOT FUNCTIONS
// ============================================================================

/**
 * Analyze trip trouble for horses in a race
 *
 * @param race - Parsed race data
 * @param scoringResult - Algorithm scoring results
 * @returns Trip trouble analysis
 */
export async function analyzeTripTrouble(
  race: ParsedRace,
  scoringResult: RaceScoringResult
): Promise<TripTroubleAnalysis> {
  const prompt = buildTripTroublePrompt(race, scoringResult);
  return callGeminiWithSchema(prompt, parseTripTroubleResponse);
}

/**
 * Analyze pace scenario for a race
 *
 * @param race - Parsed race data
 * @param scoringResult - Algorithm scoring results
 * @returns Pace scenario analysis
 */
export async function analyzePaceScenario(
  race: ParsedRace,
  scoringResult: RaceScoringResult
): Promise<PaceScenarioAnalysis> {
  const prompt = buildPaceScenarioPrompt(race, scoringResult);
  return callGeminiWithSchema(prompt, parsePaceScenarioResponse);
}

/**
 * Analyze if the favorite is vulnerable
 *
 * @param race - Parsed race data
 * @param scoringResult - Algorithm scoring results
 * @returns Vulnerable favorite analysis
 */
export async function analyzeVulnerableFavorite(
  race: ParsedRace,
  scoringResult: RaceScoringResult
): Promise<VulnerableFavoriteAnalysis> {
  const prompt = buildVulnerableFavoritePrompt(race, scoringResult);
  return callGeminiWithSchema(prompt, parseVulnerableFavoriteResponse);
}

/**
 * Analyze field spread for a race
 *
 * @param race - Parsed race data
 * @param scoringResult - Algorithm scoring results
 * @returns Field spread analysis
 */
export async function analyzeFieldSpread(
  race: ParsedRace,
  scoringResult: RaceScoringResult
): Promise<FieldSpreadAnalysis> {
  const prompt = buildFieldSpreadPrompt(race, scoringResult);
  return callGeminiWithSchema(prompt, parseFieldSpreadResponse);
}
