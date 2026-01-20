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

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

/**
 * Detect if running in Node.js environment (tests, serverless) vs Browser
 *
 * IMPORTANT: Vitest uses jsdom which defines `window`, so we can't rely solely on
 * `typeof window === 'undefined'`. Instead, we check for Node.js-specific indicators:
 *
 * 1. process.versions.node - Only exists in real Node.js, not jsdom polyfills
 * 2. window is undefined AND process exists - Fallback for edge cases
 *
 * In Node.js: process.versions.node exists (even in jsdom test environments)
 * In Browser: process.versions.node is undefined (even if process is polyfilled)
 */
function isNodeEnvironment(): boolean {
  // Primary check: process.versions.node is Node.js-specific and not polyfilled by jsdom
  // Cast to unknown first to avoid TypeScript errors (Vite's process type doesn't include versions)
  if (typeof process !== 'undefined') {
    const nodeProcess = process as unknown as { versions?: { node?: string } };
    if (typeof nodeProcess.versions?.node === 'string') {
      return true;
    }
  }

  // Fallback: window undefined check (for non-jsdom Node.js environments)
  return typeof window === 'undefined' && typeof process !== 'undefined';
}

/**
 * Get Gemini API key directly from environment (for Node.js/test environments)
 *
 * Checks both VITE_GEMINI_API_KEY (Vite convention) and GEMINI_API_KEY (standard)
 * Returns null if not in Node.js environment or key not found
 */
function getDirectApiKey(): string | null {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || null;
  }
  return null;
}

// Log environment detection at module load (helps debug test runs)
const _isNode = isNodeEnvironment();
console.log('=== [GEMINI] ENVIRONMENT DETECTION ===');
console.log(`[GEMINI] typeof window: ${typeof window}`);
console.log(`[GEMINI] typeof process: ${typeof process}`);
console.log(
  `[GEMINI] process.versions?.node: ${typeof process !== 'undefined' ? (process as unknown as { versions?: { node?: string } }).versions?.node : 'N/A'}`
);
console.log(`[GEMINI] isNodeEnvironment(): ${_isNode}`);
if (_isNode) {
  console.log('=== [GEMINI] Environment: Node.js, will use DIRECT API ===');
  console.log('[GEMINI] Direct API key available:', !!getDirectApiKey());
} else {
  console.log('=== [GEMINI] Environment: Browser, will use SERVERLESS ===');
}
console.log('======================================');

// ============================================================================
// CONFIGURATION
// ============================================================================

const TIMEOUT_MS = 30000;
const MULTI_BOT_TIMEOUT_MS = 15000;

// Serverless endpoint - browser calls go through this
const SERVERLESS_ENDPOINT = '/api/gemini';

// Direct API configuration (for Node.js/test environments)
const GEMINI_MODEL = 'gemini-2.0-flash-lite';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DIRECT_API_CONFIG = {
  temperature: 0.7,
  maxOutputTokens: 2048,
  topP: 0.95,
  topK: 40,
};

// Debug logging - only in development
const DEBUG = typeof process !== 'undefined' ? process.env?.NODE_ENV !== 'production' : true;
const debugLog = (...args: unknown[]): void => {
  if (DEBUG) console.log(...args);
};
const debugError = (...args: unknown[]): void => {
  if (DEBUG) console.error(...args);
};

// ============================================================================
// SERVERLESS RESPONSE TYPES
// ============================================================================

interface ServerlessResponse {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  processingTimeMs: number;
}

interface ServerlessErrorResponse {
  error: string;
  code: string;
}

// Direct API response type (matches Gemini API)
interface GeminiDirectAPIResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    message?: string;
    code?: number;
  };
}

// ============================================================================
// DIRECT API CALL (Node.js/Test Environment)
// ============================================================================

/**
 * Call Gemini API directly (bypassing serverless endpoint)
 *
 * Used in Node.js/test environments where /api/gemini endpoint doesn't exist.
 * Mirrors the logic in api/gemini.ts serverless function.
 *
 * @param systemPrompt - System instruction for the AI
 * @param userContent - User content/prompt
 * @param config - Optional configuration overrides
 * @returns ServerlessResponse-compatible object
 * @throws Error on API failure
 */
async function callGeminiDirect(
  systemPrompt: string,
  userContent: string,
  config?: { temperature?: number; maxOutputTokens?: number }
): Promise<ServerlessResponse> {
  const apiKey = getDirectApiKey();
  if (!apiKey) {
    const errorMsg =
      '[AI/Gemini] GEMINI_API_KEY not found in environment. Set VITE_GEMINI_API_KEY or GEMINI_API_KEY.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userContent }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: config?.temperature ?? DIRECT_API_CONFIG.temperature,
      maxOutputTokens: config?.maxOutputTokens ?? DIRECT_API_CONFIG.maxOutputTokens,
      topP: DIRECT_API_CONFIG.topP,
      topK: DIRECT_API_CONFIG.topK,
    },
  };

  const startTime = Date.now();

  console.log('=== [GEMINI] Direct API call starting... ===');
  console.log(`[GEMINI] Target URL: ${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const processingTimeMs = Date.now() - startTime;
  const responseText = await response.text();

  if (!response.ok) {
    let errorMessage = `Gemini API error: ${response.status}`;
    try {
      const errorData = JSON.parse(responseText);
      errorMessage = errorData.error?.message || responseText;
    } catch {
      errorMessage = responseText || errorMessage;
    }

    console.error(`[AI/Gemini] Direct API error ${response.status}: ${errorMessage}`);
    throw new Error(`Gemini API error: ${response.status} - ${errorMessage}`);
  }

  const data: GeminiDirectAPIResponse = JSON.parse(responseText);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const errorMsg = '[AI/Gemini] No text in Gemini response';
    console.error(errorMsg, JSON.stringify(data).slice(0, 500));
    throw new Error(errorMsg);
  }

  debugLog(`[AI/Gemini] Direct API call completed in ${processingTimeMs}ms`);

  return {
    text,
    promptTokens: data.usageMetadata?.promptTokenCount || 0,
    completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
    totalTokens: data.usageMetadata?.totalTokenCount || 0,
    model: GEMINI_MODEL,
    processingTimeMs,
  };
}

/**
 * Call Gemini via serverless endpoint (browser environment)
 *
 * @param systemPrompt - System instruction for the AI
 * @param userContent - User content/prompt
 * @param config - Optional configuration overrides
 * @param signal - Optional abort signal for timeout
 * @returns ServerlessResponse
 * @throws Error on API failure
 */
async function callGeminiServerless(
  systemPrompt: string,
  userContent: string,
  config?: { temperature?: number; maxOutputTokens?: number },
  signal?: AbortSignal
): Promise<ServerlessResponse> {
  console.log('=== [GEMINI] Serverless API call starting... ===');
  console.log(`[GEMINI] Target URL: ${SERVERLESS_ENDPOINT}`);

  const response = await fetch(SERVERLESS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt,
      userContent,
      temperature: config?.temperature ?? DIRECT_API_CONFIG.temperature,
      maxOutputTokens: config?.maxOutputTokens ?? DIRECT_API_CONFIG.maxOutputTokens,
    }),
    signal,
  });

  if (!response.ok) {
    let errorCode: AIServiceErrorCode = 'API_ERROR';
    let errorMessage = `API error: ${response.status}`;

    try {
      const errorData: ServerlessErrorResponse = await response.json();
      errorCode = mapServerlessErrorCode(errorData.code);
      errorMessage = errorData.error || errorMessage;
    } catch {
      // If we can't parse the error, use default message
    }

    throw createError(errorCode, errorMessage);
  }

  return response.json();
}

/**
 * Unified Gemini API caller - routes to direct or serverless based on environment
 *
 * @param systemPrompt - System instruction for the AI
 * @param userContent - User content/prompt
 * @param config - Optional configuration overrides
 * @param signal - Optional abort signal for timeout (only used in browser)
 * @returns ServerlessResponse
 */
async function callGeminiAPI(
  systemPrompt: string,
  userContent: string,
  config?: { temperature?: number; maxOutputTokens?: number },
  signal?: AbortSignal
): Promise<ServerlessResponse> {
  const isNode = isNodeEnvironment();
  console.log(`=== [GEMINI] callGeminiAPI() routing decision: isNode=${isNode} ===`);

  if (isNode) {
    // Direct API call for Node.js/tests
    console.log('=== [GEMINI] ROUTING TO: callGeminiDirect() (Node.js) ===');
    return callGeminiDirect(systemPrompt, userContent, config);
  } else {
    // Serverless proxy for browser
    console.log('=== [GEMINI] ROUTING TO: callGeminiServerless() (Browser) ===');
    return callGeminiServerless(systemPrompt, userContent, config, signal);
  }
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
 * Routes through either:
 * - /api/gemini serverless endpoint (browser) for secure API key handling
 * - Direct Gemini API (Node.js/tests) when serverless endpoint unavailable
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

  const prompt = buildRaceAnalysisPrompt(race, scoringResult);
  const systemPrompt = 'You are a horse racing analysis AI. Return JSON only.';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const data = await callGeminiAPI(
      systemPrompt,
      prompt,
      { temperature: 0.25, maxOutputTokens: 2048 },
      controller.signal
    );

    clearTimeout(timeoutId);

    const text = data.text;

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
  maxOutputTokens: 256, // Smaller output for focused bot responses
};

/**
 * Map serverless error codes to AIServiceError codes
 */
function mapServerlessErrorCode(code: string): AIServiceErrorCode {
  switch (code) {
    case 'RATE_LIMITED':
      return 'RATE_LIMITED';
    case 'API_KEY_MISSING':
    case 'API_KEY_INVALID':
      return 'API_KEY_MISSING';
    case 'INVALID_REQUEST':
      return 'PARSE_ERROR';
    case 'NETWORK_ERROR':
      return 'NETWORK_ERROR';
    case 'PARSE_ERROR':
      return 'PARSE_ERROR';
    default:
      return 'API_ERROR';
  }
}

/**
 * Generic Gemini API caller with custom response parser
 *
 * Routes through either:
 * - /api/gemini serverless endpoint (browser) for secure API key handling
 * - Direct Gemini API (Node.js/tests) when serverless endpoint unavailable
 *
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MULTI_BOT_TIMEOUT_MS);
  const systemPrompt = 'You are a horse racing analysis AI. Return JSON only.';

  try {
    const data = await callGeminiAPI(
      systemPrompt,
      prompt,
      {
        temperature: MULTI_BOT_CONFIG.temperature,
        maxOutputTokens: MULTI_BOT_CONFIG.maxOutputTokens,
      },
      controller.signal
    );

    clearTimeout(timeoutId);

    const text = data.text;

    if (!text) {
      throw createError('PARSE_ERROR', 'No content in Gemini response');
    }

    // Log raw response text for debugging parsing issues (dev only)
    debugLog('[Gemini Bot] Raw response text (first 500 chars):', text.substring(0, 500));

    try {
      return parseResponse(text);
    } catch (parseErr) {
      // Log full response on parse failure for debugging (dev only)
      debugError('[Gemini Bot] Parse error. Full raw response:', text);
      throw parseErr;
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw createError('TIMEOUT', `Request timed out after ${MULTI_BOT_TIMEOUT_MS}ms`);
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
