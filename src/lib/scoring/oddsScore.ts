/**
 * Odds-Based Scoring Module
 *
 * NOTE: This module is PRESERVED but REMOVED from base scoring pipeline.
 * Odds data is still available for overlay calculations and informational purposes.
 *
 * Rationale for removal: The odds factor creates circular logic - rewarding
 * horses for being favorites, then using that score to confirm they're favorites.
 * This corrupts the model's independence from public opinion and makes true
 * value detection impossible.
 *
 * MAX_ODDS_SCORE = 12 points (no longer added to base score)
 *
 * Tier Structure (Model B - 6 tiers):
 * - Heavy favorite (<2-1): 12 pts - Market strongly backs this horse
 * - Solid favorite (2-1 to 7-2): 10 pts - Clear contender
 * - Contender (7-2 to 6-1): 8 pts - Among the better chances
 * - Mid-pack (6-1 to 10-1): 5 pts - Neutral baseline
 * - Longshot (10-1 to 20-1): 2 pts - Less supported by market
 * - Extreme longshot (>20-1): 0 pts - Market sees very low chance
 *
 * @module scoring/oddsScore
 */

import type { HorseEntry } from '../../types/drf';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum points for odds-based scoring (Model B) */
export const MAX_ODDS_SCORE = 12;

/** Neutral score for horses with missing odds data (mid-pack baseline) */
export const NEUTRAL_ODDS_SCORE = 5;

/**
 * Odds tier thresholds and corresponding scores
 * Odds values are in decimal format (e.g., 3-1 = 3.0)
 * Model B: 6-tier structure with steeper penalties for longshots
 */
export const ODDS_TIERS = {
  HEAVY_FAVORITE: { maxOdds: 2, score: 12, label: 'Heavy Favorite' },
  SOLID_FAVORITE: { maxOdds: 3.5, score: 10, label: 'Solid Favorite' },
  CONTENDER: { maxOdds: 6, score: 8, label: 'Contender' },
  MID_PACK: { maxOdds: 10, score: 5, label: 'Mid-Pack' },
  LONGSHOT: { maxOdds: 20, score: 2, label: 'Longshot' },
  EXTREME_LONGSHOT: { maxOdds: Infinity, score: 0, label: 'Extreme Longshot' },
} as const;

// ============================================================================
// ODDS PARSING
// ============================================================================

/**
 * Parse odds string to decimal number
 *
 * Converts various odds formats to a decimal value representing
 * the amount won per $1 bet (not including stake).
 *
 * Supported formats:
 * - "3-1" → 3.0
 * - "7-2" → 3.5
 * - "15-1" → 15.0
 * - "1-1" or "EVEN" → 1.0
 * - "5/2" → 2.5
 * - "2.5" → 2.5
 * - "" or invalid → null
 *
 * @param oddsString - The odds string to parse
 * @returns Decimal odds value or null if unparseable
 */
export function parseOddsToDecimal(oddsString: string | null | undefined): number | null {
  // Handle null/undefined/empty
  if (!oddsString || typeof oddsString !== 'string') {
    return null;
  }

  const cleaned = oddsString.trim().toUpperCase();

  // Handle empty after trim
  if (cleaned === '' || cleaned === '0-0' || cleaned === '0') {
    return null;
  }

  // Handle "EVEN" or "EVN" odds (1-1)
  if (cleaned === 'EVEN' || cleaned === 'EVN' || cleaned === 'E') {
    return 1.0;
  }

  // Handle "X-Y" format (e.g., "3-1", "7-2", "15-1")
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    if (parts.length !== 2) {
      return null;
    }
    const numerator = parseFloat(parts[0] ?? '');
    const denominator = parseFloat(parts[1] ?? '');

    if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
      return null;
    }

    return numerator / denominator;
  }

  // Handle "X/Y" format (e.g., "5/2")
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    if (parts.length !== 2) {
      return null;
    }
    const numerator = parseFloat(parts[0] ?? '');
    const denominator = parseFloat(parts[1] ?? '');

    if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
      return null;
    }

    return numerator / denominator;
  }

  // Handle plain decimal number (e.g., "2.5")
  const decimal = parseFloat(cleaned);
  if (isNaN(decimal) || decimal <= 0) {
    return null;
  }

  return decimal;
}

// ============================================================================
// ODDS SELECTION
// ============================================================================

/**
 * Get the odds to use for scoring
 *
 * Prefers user-entered live odds if available, otherwise falls back
 * to morning line odds. This allows score recalculation when the user
 * updates odds at the track.
 *
 * @param horse - The horse entry containing morning line odds
 * @param userOdds - Optional user-entered live odds (as decimal or string)
 * @returns Decimal odds value to use for scoring, or null if unavailable
 */
export function getOddsForScoring(
  horse: HorseEntry,
  userOdds?: number | string | null
): number | null {
  // Prefer user-entered live odds if available
  if (userOdds !== undefined && userOdds !== null) {
    if (typeof userOdds === 'number' && Number.isFinite(userOdds) && userOdds > 0) {
      return userOdds;
    }
    if (typeof userOdds === 'string') {
      const parsed = parseOddsToDecimal(userOdds);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  // Fall back to morning line odds
  // First try the pre-parsed decimal value
  if (
    horse.morningLineDecimal !== undefined &&
    horse.morningLineDecimal !== null &&
    horse.morningLineDecimal > 0
  ) {
    return horse.morningLineDecimal;
  }

  // Otherwise parse the string
  return parseOddsToDecimal(horse.morningLineOdds);
}

// ============================================================================
// ODDS SCORING
// ============================================================================

/**
 * Result from odds score calculation
 */
export interface OddsScoreResult {
  /** Total odds score (0-12 points) */
  total: number;
  /** Decimal odds value used for scoring */
  oddsValue: number | null;
  /** Source of odds: 'live', 'morning_line', or 'none' */
  oddsSource: 'live' | 'morning_line' | 'none';
  /** Tier classification */
  tier: string;
  /** Human-readable reasoning */
  reasoning: string;
}

/**
 * Get the odds tier label for display
 *
 * @param odds - Decimal odds value
 * @returns Tier label string
 */
export function getOddsTier(odds: number | null): string {
  if (odds === null) {
    return 'Unknown';
  }

  if (odds < ODDS_TIERS.HEAVY_FAVORITE.maxOdds) return ODDS_TIERS.HEAVY_FAVORITE.label;
  if (odds <= ODDS_TIERS.SOLID_FAVORITE.maxOdds) return ODDS_TIERS.SOLID_FAVORITE.label;
  if (odds <= ODDS_TIERS.CONTENDER.maxOdds) return ODDS_TIERS.CONTENDER.label;
  if (odds <= ODDS_TIERS.MID_PACK.maxOdds) return ODDS_TIERS.MID_PACK.label;
  if (odds <= ODDS_TIERS.LONGSHOT.maxOdds) return ODDS_TIERS.LONGSHOT.label;
  return ODDS_TIERS.EXTREME_LONGSHOT.label;
}

/**
 * Calculate odds-based score
 *
 * Favorites get more points, longshots get less. This is NOT about value
 * betting - it's about incorporating the market signal that when a horse
 * is heavily backed, there's usually a reason.
 *
 * Scoring tiers (Model B - 6-tier structure):
 * - <2-1 (heavy favorite): 12 pts
 * - 2-1 to 7-2 (solid favorite): 10 pts
 * - 7-2 to 6-1 (contender): 8 pts
 * - 6-1 to 10-1 (mid-pack): 5 pts (neutral)
 * - 10-1 to 20-1 (longshot): 2 pts
 * - >20-1 (extreme longshot): 0 pts
 * - No odds: 5 pts (neutral)
 *
 * @param morningLineOdds - Decimal odds value (or null if unavailable)
 * @returns Score from 0-12 points
 */
export function calculateOddsPoints(morningLineOdds: number | null): number {
  // Neutral score if no odds available
  if (morningLineOdds === null || morningLineOdds <= 0) {
    return NEUTRAL_ODDS_SCORE;
  }

  // Heavy favorite (less than 2-1)
  if (morningLineOdds < ODDS_TIERS.HEAVY_FAVORITE.maxOdds) {
    return ODDS_TIERS.HEAVY_FAVORITE.score;
  }

  // Solid favorite (2-1 to 7-2)
  if (morningLineOdds <= ODDS_TIERS.SOLID_FAVORITE.maxOdds) {
    return ODDS_TIERS.SOLID_FAVORITE.score;
  }

  // Contender (7-2 to 6-1)
  if (morningLineOdds <= ODDS_TIERS.CONTENDER.maxOdds) {
    return ODDS_TIERS.CONTENDER.score;
  }

  // Mid-pack (6-1 to 10-1)
  if (morningLineOdds <= ODDS_TIERS.MID_PACK.maxOdds) {
    return ODDS_TIERS.MID_PACK.score;
  }

  // Longshot (10-1 to 20-1)
  if (morningLineOdds <= ODDS_TIERS.LONGSHOT.maxOdds) {
    return ODDS_TIERS.LONGSHOT.score;
  }

  // Extreme longshot (over 20-1)
  return ODDS_TIERS.EXTREME_LONGSHOT.score;
}

/**
 * Calculate complete odds score with full result details
 *
 * @param horse - The horse entry
 * @param userOdds - Optional user-entered live odds
 * @returns Complete odds score result
 */
export function calculateOddsScore(
  horse: HorseEntry,
  userOdds?: number | string | null
): OddsScoreResult {
  // Determine which odds to use
  const oddsValue = getOddsForScoring(horse, userOdds);

  // Determine source
  let oddsSource: 'live' | 'morning_line' | 'none' = 'none';
  if (oddsValue !== null) {
    if (userOdds !== undefined && userOdds !== null) {
      const parsedUserOdds = typeof userOdds === 'number' ? userOdds : parseOddsToDecimal(userOdds);
      if (parsedUserOdds !== null && parsedUserOdds > 0) {
        oddsSource = 'live';
      } else {
        oddsSource = 'morning_line';
      }
    } else {
      oddsSource = 'morning_line';
    }
  }

  // Calculate score
  const total = calculateOddsPoints(oddsValue);

  // Get tier label
  const tier = getOddsTier(oddsValue);

  // Build reasoning
  let reasoning: string;
  if (oddsValue === null) {
    reasoning = `No odds available - neutral score (${total} pts)`;
  } else {
    const oddsFormatted = formatOdds(oddsValue);
    const sourceLabel = oddsSource === 'live' ? 'live' : 'morning line';
    reasoning = `${tier} at ${oddsFormatted} (${sourceLabel}) → ${total} pts`;
  }

  return {
    total,
    oddsValue,
    oddsSource,
    tier,
    reasoning,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format decimal odds for display
 *
 * @param odds - Decimal odds value
 * @returns Formatted string (e.g., "3-1", "7-2")
 */
export function formatOdds(odds: number | null): string {
  if (odds === null || !Number.isFinite(odds) || odds <= 0) {
    return 'N/A';
  }

  // Check for common fractional odds
  if (odds === 1) return 'Even';
  if (odds === 0.5) return '1-2';

  // For whole numbers, format as X-1
  if (Number.isInteger(odds)) {
    return `${odds}-1`;
  }

  // For common half-odds, format as X-2
  if (odds * 2 === Math.floor(odds * 2)) {
    const numerator = odds * 2;
    return `${numerator}-2`;
  }

  // For other decimals, just show the decimal
  return odds.toFixed(1) + '-1';
}

/**
 * Get the score color for odds tier
 *
 * @param score - The odds score (0-12)
 * @returns Hex color string
 */
export function getOddsScoreColor(score: number): string {
  if (score >= 12) return '#22c55e'; // Green - Heavy favorite
  if (score >= 10) return '#4ade80'; // Light green - Solid favorite
  if (score >= 8) return '#eab308'; // Yellow - Contender
  if (score >= 5) return '#94a3b8'; // Gray - Mid-pack/Neutral
  if (score >= 2) return '#f97316'; // Orange - Longshot
  return '#ef4444'; // Red - Extreme longshot
}

/**
 * Check if odds indicate a favorite
 *
 * @param odds - Decimal odds value
 * @returns True if odds are 6-1 or less (Contender tier or better)
 */
export function isFavorite(odds: number | null): boolean {
  if (odds === null || odds <= 0) return false;
  return odds <= ODDS_TIERS.CONTENDER.maxOdds;
}

/**
 * Check if odds indicate a longshot
 *
 * @param odds - Decimal odds value
 * @returns True if odds are greater than 20-1 (Extreme Longshot tier)
 */
export function isLongshot(odds: number | null): boolean {
  if (odds === null || odds <= 0) return false;
  return odds > ODDS_TIERS.LONGSHOT.maxOdds;
}

/**
 * Calculate the point difference between two odds values
 * Useful for showing score impact of odds changes
 *
 * @param oldOdds - Previous odds value
 * @param newOdds - New odds value
 * @returns Point difference (positive = gained points)
 */
export function calculateOddsPointDifference(
  oldOdds: number | null,
  newOdds: number | null
): number {
  const oldPoints = calculateOddsPoints(oldOdds);
  const newPoints = calculateOddsPoints(newOdds);
  return newPoints - oldPoints;
}
