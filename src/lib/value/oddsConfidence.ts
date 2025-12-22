/**
 * Odds Confidence Module
 *
 * Tracks the SOURCE of odds data to enable downstream systems to assess reliability.
 *
 * Odds can come from three sources:
 * 1. Live odds: User has manually overridden odds before post time (highest confidence)
 * 2. Morning line: Original DRF morning line odds (moderate confidence)
 * 3. Default fallback: No odds data available, using default 5-1 (low confidence)
 *
 * Confidence values are initial estimates subject to tuning based on actual performance.
 * The values represent how much downstream systems should trust the odds data:
 * - 95: Live odds from user - highly reliable, reflects current market
 * - 60: Morning line from DRF - reasonable starting point but can diverge significantly
 * - 20: Default fallback - essentially a guess, treat with caution
 *
 * @module value/oddsConfidence
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Source of odds data
 *
 * - 'live': User has manually entered/overridden odds before post time
 * - 'morning_line': Original morning line from DRF data
 * - 'default_fallback': No odds available, using default 5-1
 */
export type OddsSource = 'live' | 'morning_line' | 'default_fallback';

/**
 * Complete odds information including source and confidence
 */
export interface OddsInfo {
  /** The odds value as a string (e.g., "5-1", "3-2") */
  value: string;
  /** Where this odds data came from */
  source: OddsSource;
  /**
   * Confidence level (0-100) indicating how much to trust this odds data
   *
   * Initial estimates subject to tuning:
   * - 95: Live odds - user override, reflects current market conditions
   * - 60: Morning line - DRF default, reasonable but often diverges from actual
   * - 20: Default fallback - no real data, treat with significant caution
   */
  confidence: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Confidence values for each odds source
 *
 * These are initial estimates subject to tuning based on actual betting performance.
 * Track win rates and EV by source to calibrate these values over time.
 *
 * Derivation:
 * - Live (95): User is watching tote board, odds reflect actual market sentiment
 * - Morning line (60): Track handicapper estimate, typically within 2x of final odds
 *   but can be significantly off for overlays/underlays
 * - Default fallback (20): 5-1 is a reasonable "average horse" assumption but has
 *   no actual information about the specific horse
 */
export const ODDS_CONFIDENCE = {
  live: 95,
  morning_line: 60,
  default_fallback: 20,
} as const;

/**
 * Default odds used when no odds data is available
 */
export const DEFAULT_FALLBACK_ODDS = '5-1';

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Determine odds with source information
 *
 * Logic:
 * 1. If hasOddsChanged returns true -> live odds (user override)
 * 2. If morningLineOdds exists and is not empty/undefined -> morning line
 * 3. Otherwise -> default fallback
 *
 * Edge cases:
 * - morningLineOdds is undefined or empty string: fallback
 * - morningLineOdds is exactly '5-1': could be real ML or missing data,
 *   but we trust it as morning line since it came from DRF
 * - getOdds returns different value than morningLineOdds: user override (live)
 *
 * @param horseIndex - Index of the horse in the race
 * @param morningLineOdds - Morning line odds from DRF data (may be undefined)
 * @param getOdds - Function to get current odds for a horse index
 * @param hasOddsChanged - Function to check if user has overridden odds
 * @returns OddsInfo with value, source, and confidence
 */
export function getOddsWithSource(
  horseIndex: number,
  morningLineOdds: string | undefined,
  getOdds: (index: number) => string,
  hasOddsChanged: (index: number) => boolean
): OddsInfo {
  // Get current odds value
  const currentOdds = getOdds(horseIndex);

  // Check if user has manually overridden the odds
  if (hasOddsChanged(horseIndex)) {
    return {
      value: currentOdds,
      source: 'live',
      confidence: ODDS_CONFIDENCE.live,
    };
  }

  // Check if we have valid morning line odds from DRF
  if (morningLineOdds && morningLineOdds.trim() !== '') {
    return {
      value: currentOdds,
      source: 'morning_line',
      confidence: ODDS_CONFIDENCE.morning_line,
    };
  }

  // No valid odds data - using default fallback
  return {
    value: currentOdds || DEFAULT_FALLBACK_ODDS,
    source: 'default_fallback',
    confidence: ODDS_CONFIDENCE.default_fallback,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get human-readable label for odds source
 */
export function getOddsSourceLabel(source: OddsSource): string {
  switch (source) {
    case 'live':
      return 'Live';
    case 'morning_line':
      return 'ML';
    case 'default_fallback':
      return 'Default';
  }
}

/**
 * Get detailed description for odds source
 */
export function getOddsSourceDescription(source: OddsSource): string {
  switch (source) {
    case 'live':
      return 'User-entered live odds before post time';
    case 'morning_line':
      return 'Morning line odds from DRF';
    case 'default_fallback':
      return 'Default fallback (no odds data available)';
  }
}

/**
 * Check if odds confidence is high enough for value betting
 *
 * @param confidence - Confidence value (0-100)
 * @param threshold - Minimum confidence required (default: 50)
 */
export function isConfidenceHighEnough(confidence: number, threshold: number = 50): boolean {
  return confidence >= threshold;
}

/**
 * Get confidence level category
 */
export function getConfidenceLevel(
  confidence: number
): 'high' | 'moderate' | 'low' {
  if (confidence >= 80) return 'high';
  if (confidence >= 50) return 'moderate';
  return 'low';
}

/**
 * Get color for confidence display
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return '#22c55e'; // Green
  if (confidence >= 50) return '#f59e0b'; // Amber
  return '#ef4444'; // Red
}

/**
 * Apply confidence-based adjustment to EV calculations
 *
 * Only dampens EV for default_fallback (when we're truly guessing).
 * Morning line and live odds get full EV - we show warnings in UI instead.
 *
 * Rationale:
 * - A 30% edge with morning line odds is still a 30% edge
 * - Dampening legitimate value bets causes missed opportunities
 * - UI warnings let user decide whether to verify before betting
 * - Only fallback (no real data) warrants mathematical adjustment
 *
 * @param confidence - Confidence value (0-100)
 * @returns Multiplier to apply to EV (0.5 for fallback, 1.0 otherwise)
 */
export function getEVConfidenceMultiplier(confidence: number): number {
  // Only dampen for default_fallback (confidence 20, threshold 30 for safety margin)
  if (confidence <= 30) {
    return 0.5;
  }
  // Morning line and live odds: no dampening
  return 1.0;
}

/**
 * Get warning message for odds source (for UI display)
 *
 * Returns null for live odds (no warning needed), or a warning string
 * for morning line and fallback sources.
 *
 * @param source - The odds source
 * @returns Warning string or null
 */
export function getOddsWarning(source: OddsSource): string | null {
  switch (source) {
    case 'live':
      return null;
    case 'morning_line':
      return 'EV based on morning line - verify before post';
    case 'default_fallback':
      return 'No odds data - using 5-1 default (low confidence)';
  }
}
