/**
 * Gemini AI Service
 *
 * Single-bot race analysis using Google's Gemini 2.0 Flash-Lite model.
 * Takes algorithm scores and produces AI insights, rankings, and value labels.
 */

import type { ParsedRace } from '../../types/drf';
import type { RaceScoringResult } from '../../types/scoring';
import type { AIRaceAnalysis, AIServiceError, AIServiceErrorCode } from './types';
import { buildRaceAnalysisPrompt } from './prompt';

// Type declaration for Node.js process (available in test/CI environments)
declare const process: { env?: Record<string, string | undefined> } | undefined;

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
 */
function getApiKey(): string {
  // Check Vite environment (browser)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  // Check Node environment (test/CI)
  if (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) {
    return process.env.VITE_GEMINI_API_KEY;
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
          temperature: 0.2, // Lower from 0.3 for more consistency
          topP: 0.8,
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
