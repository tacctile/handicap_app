/**
 * AI Service Index
 *
 * Main entry point for the AI race analysis service.
 * Provides caching and status checking functionality.
 */

import { analyzeRaceWithGemini } from './gemini';
import type { ParsedRace } from '../../types/drf';
import type { RaceScoringResult } from '../../types/scoring';
import type { AIRaceAnalysis, AIServiceStatus } from './types';

// Re-export types for consumers
export type {
  AIRaceAnalysis,
  AIServiceStatus,
  AIServiceError,
  AIServiceErrorCode,
  ValueLabel,
  HorseInsight,
} from './types';

// Re-export the analyzeRaceWithGemini function for direct access
export { analyzeRaceWithGemini } from './gemini';

// Re-export prompt builder for testing
export { buildRaceAnalysisPrompt } from './prompt';

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
  // Check for Vite environment variable
  let hasApiKey = false;
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
    hasApiKey = true;
  }

  // Also check Node.js environment
  if (!hasApiKey) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeProcess = (globalThis as any).process;
      if (nodeProcess?.env?.VITE_GEMINI_API_KEY) {
        hasApiKey = true;
      }
    } catch {
      // Not in Node.js environment
    }
  }

  if (!hasApiKey) {
    return 'offline';
  }

  // Check network connectivity (browser only)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'offline';
  }

  return 'ready';
}
