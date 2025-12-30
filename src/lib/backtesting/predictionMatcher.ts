/**
 * Prediction Matcher
 *
 * Matches algorithm predictions (ScoredHorse[]) to actual race results
 * (ChartRace) for backtesting accuracy analysis.
 */

import { logger } from '../../services/logging';
import type { ChartRace, ChartStarter, MatchedResult } from '../../types/chart';
import type { ScoredHorse } from '../scoring';

// ============================================================================
// TIER THRESHOLDS (matching tierClassification.ts)
// ============================================================================

const TIER_THRESHOLDS = {
  TIER_1_MIN: 180,
  TIER_2_MIN: 160,
  TIER_3_MIN: 130,
};

// ============================================================================
// NAME MATCHING UTILITIES
// ============================================================================

/**
 * Normalize horse name for matching
 * Removes common variations and formatting differences
 */
function normalizeHorseName(name: string): string {
  return (
    name
      .toUpperCase()
      .trim()
      // Remove country/region codes like (IRE), (GB), (ARG), etc.
      .replace(/\s*\([A-Z]{2,4}\)\s*/g, ' ')
      // Remove common suffixes
      .replace(/\s+(JR|SR|II|III|IV|V)\.?\s*$/i, '')
      // Remove apostrophes and quotes
      .replace(/[''`"]/g, '')
      // Normalize spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a value between 0 and 1 (1 = exact match)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Create distance matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0]![j] = j;
  }

  // Fill in the matrix
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1, // deletion
        matrix[i]![j - 1]! + 1, // insertion
        matrix[i - 1]![j - 1]! + cost // substitution
      );
    }
  }

  // Calculate similarity from distance
  const distance = matrix[s1.length]![s2.length]!;
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

/**
 * Match options for controlling matching behavior
 */
export interface MatchOptions {
  /** Minimum similarity threshold for fuzzy matching (0-1, default 0.8) */
  minSimilarity?: number;
  /** Whether to log warnings for unmatched horses */
  logWarnings?: boolean;
}

const DEFAULT_MATCH_OPTIONS: Required<MatchOptions> = {
  minSimilarity: 0.8,
  logWarnings: true,
};

// ============================================================================
// TIER CALCULATION
// ============================================================================

/**
 * Determine tier from score
 */
function getTierFromScore(score: number): number | null {
  if (score >= TIER_THRESHOLDS.TIER_1_MIN) return 1;
  if (score >= TIER_THRESHOLDS.TIER_2_MIN) return 2;
  if (score >= TIER_THRESHOLDS.TIER_3_MIN) return 3;
  return null;
}

// ============================================================================
// MAIN MATCHING FUNCTION
// ============================================================================

/**
 * Match predictions to actual race results
 *
 * @param predictions - Array of scored horses from algorithm (sorted by rank)
 * @param chartRace - Actual race results from chart file
 * @param options - Matching options
 * @returns Array of matched results
 */
export function matchPredictionsToResults(
  predictions: ScoredHorse[],
  chartRace: ChartRace,
  options: MatchOptions = {}
): MatchedResult[] {
  const opts = { ...DEFAULT_MATCH_OPTIONS, ...options };
  const results: MatchedResult[] = [];

  // Build a map of normalized names to starters for efficient lookup
  const starterMap = new Map<string, ChartStarter>();
  const normalizedStarterNames: Array<{
    original: string;
    normalized: string;
    starter: ChartStarter;
  }> = [];

  for (const starter of chartRace.starters) {
    const normalized = normalizeHorseName(starter.horseName);
    starterMap.set(normalized, starter);
    normalizedStarterNames.push({
      original: starter.horseName,
      normalized,
      starter,
    });
  }

  // Match each prediction to a starter
  for (const prediction of predictions) {
    // Skip scratched predictions
    if (prediction.score.isScratched) {
      continue;
    }

    const horseName = prediction.horse.horseName;
    const normalizedPrediction = normalizeHorseName(horseName);

    // Try exact match first
    let matchedStarter = starterMap.get(normalizedPrediction);
    let matchConfidence = matchedStarter ? 1.0 : 0;

    // If no exact match, try fuzzy matching
    if (!matchedStarter) {
      let bestMatch: { starter: ChartStarter; similarity: number } | null = null;

      for (const { normalized, starter } of normalizedStarterNames) {
        const similarity = calculateSimilarity(normalizedPrediction, normalized);
        if (similarity >= opts.minSimilarity && (!bestMatch || similarity > bestMatch.similarity)) {
          bestMatch = { starter, similarity };
        }
      }

      if (bestMatch) {
        matchedStarter = bestMatch.starter;
        matchConfidence = bestMatch.similarity;
      }
    }

    if (matchedStarter) {
      results.push({
        horseName,
        predictionRank: prediction.rank,
        predictionTier: getTierFromScore(prediction.score.total),
        predictionScore: prediction.score.total,
        actualFinishPosition: matchedStarter.finishPosition,
        wasScratch: matchedStarter.isScratched,
        actualOdds: matchedStarter.odds,
        winPayoff: matchedStarter.winPayoff,
        placePayoff: matchedStarter.placePayoff,
        showPayoff: matchedStarter.showPayoff,
        matchConfidence,
      });
    } else if (opts.logWarnings) {
      logger.logWarning('Prediction not matched to race result', {
        horseName,
        raceNumber: chartRace.raceNumber,
        availableStarters: chartRace.starters.map((s) => s.horseName).join(', '),
      });
    }
  }

  return results;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get matched results for a specific tier
 */
export function getMatchedByTier(matches: MatchedResult[], tier: number): MatchedResult[] {
  return matches.filter((m) => m.predictionTier === tier && !m.wasScratch);
}

/**
 * Get the top prediction(s) - non-scratched Tier 1 horses
 */
export function getTopPredictions(matches: MatchedResult[], count: number = 1): MatchedResult[] {
  return matches
    .filter((m) => !m.wasScratch)
    .sort((a, b) => a.predictionRank - b.predictionRank)
    .slice(0, count);
}

/**
 * Check if prediction hit (finished in specified position or better)
 */
export function isPredictionHit(match: MatchedResult, maxPosition: number = 1): boolean {
  return !match.wasScratch && match.actualFinishPosition <= maxPosition;
}

/**
 * Check if top prediction won
 */
export function didTopPredictionWin(matches: MatchedResult[]): boolean {
  const top = getTopPredictions(matches, 1)[0];
  return top ? isPredictionHit(top, 1) : false;
}

/**
 * Check if top prediction finished top 3
 */
export function didTopPredictionShow(matches: MatchedResult[]): boolean {
  const top = getTopPredictions(matches, 1)[0];
  return top ? isPredictionHit(top, 3) : false;
}

/**
 * Check if exacta hit (top 2 predictions finished 1-2 in either order)
 */
export function isExactaHit(matches: MatchedResult[]): boolean {
  const topTwo = getTopPredictions(matches, 2);
  if (topTwo.length < 2) return false;

  const positions = new Set(
    topTwo
      .filter((m) => !m.wasScratch && m.actualFinishPosition <= 2)
      .map((m) => m.actualFinishPosition)
  );

  // Both must have finished in top 2
  return positions.size === 2 && positions.has(1) && positions.has(2);
}

/**
 * Find all tier winners in a race
 */
export function getTierWinners(matches: MatchedResult[]): MatchedResult[] {
  return matches.filter(
    (m) => !m.wasScratch && m.actualFinishPosition === 1 && m.predictionTier !== null
  );
}

/**
 * Calculate average match confidence for a set of matches
 */
export function getAverageMatchConfidence(matches: MatchedResult[]): number {
  if (matches.length === 0) return 0;
  const sum = matches.reduce((acc, m) => acc + m.matchConfidence, 0);
  return sum / matches.length;
}
