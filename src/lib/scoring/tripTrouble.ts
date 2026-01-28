/**
 * Trip Trouble Detection Module
 *
 * Identifies horses with masked ability due to racing trouble.
 * Scans PP comments for specific trouble indicators and adjusts form scores.
 *
 * ADJUSTMENT PHILOSOPHY:
 * - A troubled trip masks true ability by 3-8 Beyer points typically
 * - Multiple troubled trips = higher confidence of masked ability
 * - Trouble that horse CAUSED (lugged, bore out) = no bonus
 *
 * This is a purely algorithmic, deterministic replacement for the AI Trip
 * Trouble Bot. Same inputs always produce same outputs.
 *
 * SCORING:
 * - HIGH confidence trouble: +3 pts per race (max 2 races = +6)
 * - MEDIUM confidence trouble: +2 pts per race (max 2 races = +4)
 * - LOW confidence trouble: +1 pt per race (max 2 races = +2)
 * - Maximum total adjustment: +8 pts
 *
 * @module tripTrouble
 */

import type { HorseEntry, PastPerformance } from '../../types/drf';
import type { TripTroubleResult, TroubledRace, TripTroubleConfidence } from '../../types/scoring';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Trip trouble configuration constants.
 * Adjustments for horses with masked ability due to racing trouble.
 * These values can be tuned based on validation results.
 */
export const TRIP_TROUBLE_CONFIG = {
  /** Maximum adjustment points */
  MAX_ADJUSTMENT: 8,

  /** Points per troubled race by confidence level */
  HIGH_CONFIDENCE_PTS: 3,
  MEDIUM_CONFIDENCE_PTS: 2,
  LOW_CONFIDENCE_PTS: 1,

  /** Maximum races to consider */
  MAX_RACES_TO_SCAN: 3,

  /** Maximum troubled races to count per confidence level */
  MAX_RACES_PER_LEVEL: 2,
} as const;

// ============================================================================
// TROUBLE KEYWORD CATEGORIES
// ============================================================================

/**
 * High-confidence trouble (clear, specific impediments)
 * These indicate definite interference that cost the horse position/momentum.
 */
export const HIGH_TROUBLE_KEYWORDS: readonly string[] = [
  'blocked',
  'boxed',
  'boxed in',
  'no room',
  'shut off',
  'steadied',
  'checked',
  'taken up',
  'clipped heels',
  'stumbled',
  'fell',
  'lost rider',
  'pulled up',
  'eased',
] as const;

/**
 * Medium-confidence trouble (likely impediment)
 * These indicate probable interference or difficult circumstances.
 */
export const MEDIUM_TROUBLE_KEYWORDS: readonly string[] = [
  'bumped',
  'bumped start',
  'shuffled',
  'shuffled back',
  'forced wide',
  'carried wide',
  '5-wide',
  '6-wide',
  '7-wide',
  'wide turn',
  'wide stretch',
  'broke slow',
  'broke poorly',
  'dwelt',
  'hesitated',
  'bobbled',
] as const;

/**
 * Low-confidence trouble (possible impediment)
 * These indicate potential interference but may be subjective.
 */
export const LOW_TROUBLE_KEYWORDS: readonly string[] = [
  'wide', // Generic wide (needs context)
  '4-wide',
  'crowded',
  'tight quarters',
  'lacked room',
  'no late room',
  'blocked stretch',
  'stopped',
  'gave way',
] as const;

/**
 * EXCLUSION keywords - horse caused trouble, no bonus
 * If a horse caused the trouble rather than suffering it, no bonus applies.
 */
export const CAUSED_TROUBLE_KEYWORDS: readonly string[] = [
  'lugged in',
  'lugged out',
  'bore in',
  'bore out',
  'drifted',
  'ducked in',
  'ducked out',
  'rank',
  'fractious',
  'unruly',
  'bolted',
  'ran off',
  'fought',
  'hung',
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find matching keywords in a comment string
 *
 * @param comments - The comment string to search
 * @param keywords - Array of keywords to look for
 * @returns Array of found keywords
 */
export function findKeywords(comments: string, keywords: readonly string[]): string[] {
  if (!comments || comments.trim() === '') return [];

  const lowerComments = comments.toLowerCase();
  return keywords.filter((keyword) => lowerComments.includes(keyword.toLowerCase()));
}

/**
 * Extract and combine all comment fields from a past performance
 * DRF has multiple comment fields - trip comments (396-405) and extended comments (1383-1392)
 *
 * @param pp - Past performance record
 * @returns Combined comment string
 */
export function extractComments(pp: PastPerformance): string {
  // Combine trip comment and extended comment fields
  const parts = [pp.tripComment, pp.comment].filter(
    (c): c is string => typeof c === 'string' && c.trim() !== ''
  );
  return parts.join(' ');
}

/**
 * Determine confidence level based on keyword matches
 *
 * @param highCount - Number of high-confidence keywords found
 * @param mediumCount - Number of medium-confidence keywords found
 * @param lowCount - Number of low-confidence keywords found
 * @returns Confidence level
 */
function determineConfidenceLevel(
  highCount: number,
  mediumCount: number,
  lowCount: number
): TripTroubleConfidence {
  if (highCount > 0) return 'HIGH';
  if (mediumCount > 0) return 'MEDIUM';
  if (lowCount > 0) return 'LOW';
  return 'NONE';
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze trip trouble for a single horse
 *
 * Scans the last 3 races for trouble indicators in PP comments.
 * Calculates an adjustment to add to the horse's form score.
 *
 * @param horse - The horse entry to analyze
 * @returns Trip trouble analysis result
 */
export function analyzeTripTrouble(horse: HorseEntry): TripTroubleResult {
  const pastPerformances = horse.pastPerformances;

  // Only analyze last 3 races (older trouble is stale)
  const recentPPs = pastPerformances.slice(0, TRIP_TROUBLE_CONFIG.MAX_RACES_TO_SCAN);

  const troubledRaces: TroubledRace[] = [];
  let causedTroubleCount = 0;

  for (let i = 0; i < recentPPs.length; i++) {
    const pp = recentPPs[i];
    if (!pp) continue;

    const comments = extractComments(pp);

    // Check for caused trouble FIRST (disqualifying)
    const causedTrouble = findKeywords(comments, CAUSED_TROUBLE_KEYWORDS);
    if (causedTrouble.length > 0) {
      causedTroubleCount++;
      continue; // Don't give bonus for this race
    }

    // Check for trouble suffered
    const highTrouble = findKeywords(comments, HIGH_TROUBLE_KEYWORDS);
    const mediumTrouble = findKeywords(comments, MEDIUM_TROUBLE_KEYWORDS);
    const lowTrouble = findKeywords(comments, LOW_TROUBLE_KEYWORDS);

    if (highTrouble.length > 0 || mediumTrouble.length > 0 || lowTrouble.length > 0) {
      const confidenceLevel = determineConfidenceLevel(
        highTrouble.length,
        mediumTrouble.length,
        lowTrouble.length
      );

      troubledRaces.push({
        raceIndex: i,
        troubleKeywords: [...highTrouble, ...mediumTrouble, ...lowTrouble],
        confidenceLevel,
        finishPosition: pp.finishPosition,
        beyer: pp.speedFigures?.beyer ?? null,
      });
    }
  }

  // Calculate adjustment
  const { adjustment, confidence, reason } = calculateTripAdjustment(
    troubledRaces,
    causedTroubleCount
  );

  return {
    programNumber: horse.programNumber,
    horseName: horse.horseName,
    troubledRaces,
    totalTroubledCount: troubledRaces.length,
    highConfidenceCount: troubledRaces.filter((r) => r.confidenceLevel === 'HIGH').length,
    mediumConfidenceCount: troubledRaces.filter((r) => r.confidenceLevel === 'MEDIUM').length,
    lowConfidenceCount: troubledRaces.filter((r) => r.confidenceLevel === 'LOW').length,
    causedTroubleCount,
    adjustment,
    confidence,
    reason,
  };
}

/**
 * Calculate the trip trouble adjustment based on analyzed races
 *
 * Adjustment scale:
 * - HIGH confidence trouble: +3 pts per race (max 2 races = +6)
 * - MEDIUM confidence trouble: +2 pts per race (max 2 races = +4)
 * - LOW confidence trouble: +1 pt per race (max 2 races = +2)
 * - Maximum total adjustment: +8 pts
 *
 * @param troubledRaces - Array of troubled race analyses
 * @param causedTroubleCount - Number of races where horse caused trouble
 * @returns Adjustment points, confidence level, and reason
 */
export function calculateTripAdjustment(
  troubledRaces: TroubledRace[],
  causedTroubleCount: number
): { adjustment: number; confidence: TripTroubleConfidence; reason: string } {
  // If horse causes more trouble than it suffers, no bonus
  if (causedTroubleCount >= troubledRaces.length && troubledRaces.length > 0) {
    return {
      adjustment: 0,
      confidence: 'NONE',
      reason: 'Horse causes trouble, no bonus applied',
    };
  }

  // If horse causes trouble and suffers trouble equally, reduce confidence
  if (causedTroubleCount > 0 && causedTroubleCount === troubledRaces.length) {
    return {
      adjustment: 0,
      confidence: 'NONE',
      reason: 'Horse causes as much trouble as it suffers, no bonus applied',
    };
  }

  const highCount = troubledRaces.filter((r) => r.confidenceLevel === 'HIGH').length;
  const mediumCount = troubledRaces.filter((r) => r.confidenceLevel === 'MEDIUM').length;
  const lowCount = troubledRaces.filter((r) => r.confidenceLevel === 'LOW').length;

  // No trouble found
  if (troubledRaces.length === 0) {
    return { adjustment: 0, confidence: 'NONE', reason: 'No trip trouble detected' };
  }

  // Calculate adjustment with per-level caps
  let adjustment = 0;
  adjustment +=
    Math.min(highCount, TRIP_TROUBLE_CONFIG.MAX_RACES_PER_LEVEL) *
    TRIP_TROUBLE_CONFIG.HIGH_CONFIDENCE_PTS;
  adjustment +=
    Math.min(mediumCount, TRIP_TROUBLE_CONFIG.MAX_RACES_PER_LEVEL) *
    TRIP_TROUBLE_CONFIG.MEDIUM_CONFIDENCE_PTS;
  adjustment +=
    Math.min(lowCount, TRIP_TROUBLE_CONFIG.MAX_RACES_PER_LEVEL) *
    TRIP_TROUBLE_CONFIG.LOW_CONFIDENCE_PTS;

  // Apply maximum cap
  adjustment = Math.min(adjustment, TRIP_TROUBLE_CONFIG.MAX_ADJUSTMENT);

  // If horse caused some trouble, reduce the bonus
  if (causedTroubleCount > 0) {
    const reductionFactor = 1 - causedTroubleCount * 0.25; // 25% reduction per caused trouble
    adjustment = Math.max(0, Math.round(adjustment * reductionFactor));
  }

  // Determine overall confidence
  let confidence: TripTroubleConfidence;
  let reason: string;

  if (highCount >= 2) {
    confidence = 'HIGH';
    reason = `${highCount} races with clear traffic trouble, +${adjustment} pts`;
  } else if (highCount === 1 || mediumCount >= 2) {
    confidence = 'MEDIUM';
    reason = `${troubledRaces.length} troubled trips detected, +${adjustment} pts`;
  } else if (troubledRaces.length > 0) {
    confidence = 'LOW';
    reason = `Possible trouble in ${troubledRaces.length} race(s), +${adjustment} pts`;
  } else {
    confidence = 'NONE';
    reason = 'No trip trouble detected';
  }

  // Add note about caused trouble reduction
  if (causedTroubleCount > 0 && adjustment > 0) {
    reason += ` (reduced by ${causedTroubleCount} caused trouble incident${causedTroubleCount > 1 ? 's' : ''})`;
  }

  return { adjustment, confidence, reason };
}

// ============================================================================
// BATCH ANALYSIS FOR RACE
// ============================================================================

/**
 * Analyze trip trouble for all horses in a race
 *
 * @param horses - Array of horse entries
 * @returns Map of program number to trip trouble result
 */
export function analyzeRaceTripTrouble(horses: HorseEntry[]): Map<number, TripTroubleResult> {
  const results = new Map<number, TripTroubleResult>();

  for (const horse of horses) {
    const result = analyzeTripTrouble(horse);
    results.set(horse.programNumber, result);
  }

  return results;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a horse has significant trip trouble
 *
 * @param result - Trip trouble analysis result
 * @returns True if horse has meaningful trip trouble adjustment
 */
export function hasSignificantTrouble(result: TripTroubleResult): boolean {
  return result.adjustment >= 3 && result.confidence !== 'NONE';
}

/**
 * Get a summary string for trip trouble
 *
 * @param result - Trip trouble analysis result
 * @returns Human-readable summary
 */
export function getTripTroubleSummary(result: TripTroubleResult): string {
  if (result.adjustment === 0) {
    if (result.causedTroubleCount > 0) {
      return 'Caused trouble - no bonus';
    }
    return 'No trip trouble detected';
  }

  const parts: string[] = [];
  if (result.highConfidenceCount > 0) {
    parts.push(`${result.highConfidenceCount} clear trouble`);
  }
  if (result.mediumConfidenceCount > 0) {
    parts.push(`${result.mediumConfidenceCount} likely trouble`);
  }
  if (result.lowConfidenceCount > 0) {
    parts.push(`${result.lowConfidenceCount} possible trouble`);
  }

  return `${parts.join(', ')} (+${result.adjustment} pts)`;
}

/**
 * Get color for trip trouble display based on adjustment
 *
 * @param adjustment - The adjustment value
 * @returns CSS color string
 */
export function getTripTroubleColor(adjustment: number): string {
  if (adjustment >= 6) return '#22c55e'; // Green - significant masked ability
  if (adjustment >= 3) return '#4ade80'; // Light green - moderate masked ability
  if (adjustment >= 1) return '#eab308'; // Yellow - minor masked ability
  return '#6E6E70'; // Gray - no adjustment
}

/**
 * Log trip trouble analysis for debugging
 *
 * @param results - Map of trip trouble results
 */
export function logTripTroubleAnalysis(results: Map<number, TripTroubleResult>): void {
  const adjustedHorses = Array.from(results.values()).filter((r) => r.adjustment > 0);

  if (adjustedHorses.length === 0) {
    console.log('[TRIP_TROUBLE] No adjustments applied');
    return;
  }

  console.log(`[TRIP_TROUBLE] Analyzing ${results.size} horses`);
  console.log('[TRIP_TROUBLE] Adjustments applied:');

  for (const result of adjustedHorses) {
    console.log(
      `  #${result.programNumber} ${result.horseName}: +${result.adjustment} (${result.confidence})`
    );
    for (const tr of result.troubledRaces) {
      console.log(`    Race ${tr.raceIndex + 1} back: ${tr.troubleKeywords.join(', ')}`);
    }
  }
}
