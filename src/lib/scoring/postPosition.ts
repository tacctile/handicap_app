/**
 * Post Position Scoring Module
 * Calculates post position advantage based on track-specific bias data
 *
 * Score Range: 0-45 points
 *
 * Sprint (6F-7F) Scoring:
 * - Uses track's actual post position win percentages
 * - Golden posts (typically 4-5) get maximum points
 * - Outside posts (8+) in sprints penalized
 *
 * Route (1M+) Scoring:
 * - Different bias pattern (post 5 optimal, inside posts save ground)
 * - Adjust for field size (large fields penalize outside more)
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import {
  getPostPositionBias,
  parseDistanceToFurlongs,
  getDistanceCategory,
  isTrackIntelligenceAvailable,
} from '../trackIntelligence';

// ============================================================================
// TYPES
// ============================================================================

export interface PostPositionScoreResult {
  total: number;
  baseScore: number;
  biasMultiplier: number;
  fieldSizeAdjustment: number;
  trackBiasApplied: boolean;
  isGoldenPost: boolean;
  reasoning: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Maximum score for post position
const MAX_POST_SCORE = 45;

// Base scores for different post quality tiers
const POST_TIERS = {
  golden: 40, // Optimal post positions
  good: 32, // Favorable posts
  neutral: 24, // Average posts
  poor: 16, // Disadvantaged posts
  terrible: 8, // Severely disadvantaged
} as const;

// Generic post position preferences when no track data
const GENERIC_SPRINT_PREFERENCES = {
  ideal: [4, 5],
  good: [3, 6],
  neutral: [2, 7],
  poor: [1, 8],
  terrible: [9, 10, 11, 12],
};

const GENERIC_ROUTE_PREFERENCES = {
  ideal: [4, 5],
  good: [2, 3, 6],
  neutral: [1, 7],
  poor: [8, 9],
  terrible: [10, 11, 12],
};

// Field size thresholds for adjustments
const FIELD_SIZE = {
  small: 6,
  medium: 8,
  large: 10,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate field size adjustment for outside posts
 * Large fields hurt outside posts more
 */
function calculateFieldSizeAdjustment(
  postPosition: number,
  fieldSize: number,
  category: 'sprint' | 'route'
): number {
  // Inside posts don't get penalized by field size
  if (postPosition <= 5) {
    return 0;
  }

  // Calculate how far outside the horse is
  const outsideRank = postPosition - 5;

  // Large field penalty for outside posts
  if (fieldSize >= FIELD_SIZE.large) {
    // Sprints hurt outside posts more
    const penalty = category === 'sprint' ? outsideRank * -2 : outsideRank * -1.5;
    return Math.max(-10, penalty);
  }

  // Medium field - moderate penalty
  if (fieldSize >= FIELD_SIZE.medium) {
    const penalty = category === 'sprint' ? outsideRank * -1 : outsideRank * -0.5;
    return Math.max(-5, penalty);
  }

  // Small field - minimal penalty
  return 0;
}

/**
 * Get base score using generic post preferences
 */
function getGenericBaseScore(
  postPosition: number,
  category: 'sprint' | 'route'
): { score: number; tier: string } {
  const prefs = category === 'sprint' ? GENERIC_SPRINT_PREFERENCES : GENERIC_ROUTE_PREFERENCES;

  if (prefs.ideal.includes(postPosition)) {
    return { score: POST_TIERS.golden, tier: 'Golden post' };
  }
  if (prefs.good.includes(postPosition)) {
    return { score: POST_TIERS.good, tier: 'Favorable post' };
  }
  if (prefs.neutral.includes(postPosition)) {
    return { score: POST_TIERS.neutral, tier: 'Neutral post' };
  }
  if (prefs.poor.includes(postPosition)) {
    return { score: POST_TIERS.poor, tier: 'Disadvantaged post' };
  }
  return { score: POST_TIERS.terrible, tier: 'Severely disadvantaged' };
}

/**
 * Calculate score from track-specific win percentage data
 */
function calculateTrackSpecificScore(
  postPosition: number,
  winPercentByPost: number[],
  favoredPosts: number[]
): { score: number; multiplier: number; isGolden: boolean } {
  const postIndex = postPosition - 1;

  // Handle posts outside the data range
  if (postIndex < 0 || postIndex >= winPercentByPost.length) {
    return { score: POST_TIERS.terrible, multiplier: 0.5, isGolden: false };
  }

  const winPct = winPercentByPost[postIndex];
  // Safety check for undefined (should not happen after bounds check)
  if (winPct === undefined) {
    return { score: POST_TIERS.terrible, multiplier: 0.5, isGolden: false };
  }

  const avgWinPct = 100 / winPercentByPost.length; // Fair share
  const isGolden = favoredPosts.includes(postPosition);

  // Calculate multiplier based on how much better/worse than average
  let multiplier = winPct / avgWinPct;
  multiplier = Math.max(0.5, Math.min(1.5, multiplier));

  // Calculate score based on win percentage tier
  let score: number;
  if (winPct >= avgWinPct * 1.4) {
    score = POST_TIERS.golden;
  } else if (winPct >= avgWinPct * 1.1) {
    score = POST_TIERS.good;
  } else if (winPct >= avgWinPct * 0.9) {
    score = POST_TIERS.neutral;
  } else if (winPct >= avgWinPct * 0.6) {
    score = POST_TIERS.poor;
  } else {
    score = POST_TIERS.terrible;
  }

  // Apply multiplier to refine score
  score = Math.round(score * multiplier);
  score = Math.max(5, Math.min(MAX_POST_SCORE, score));

  return { score, multiplier, isGolden };
}

/**
 * Build reasoning string for post position score
 */
function buildReasoning(
  postPosition: number,
  category: 'sprint' | 'route',
  trackBiasApplied: boolean,
  isGoldenPost: boolean,
  fieldSize: number,
  baseScore: number,
  adjustment: number,
  trackCode: string,
  distance: string
): string {
  const parts: string[] = [];

  parts.push(`PP${postPosition}`);

  if (isGoldenPost) {
    parts.push('Golden post');
  } else if (baseScore >= POST_TIERS.good) {
    parts.push('Favorable');
  } else if (baseScore >= POST_TIERS.neutral) {
    parts.push('Neutral');
  } else if (baseScore >= POST_TIERS.poor) {
    parts.push('Disadvantaged');
  } else {
    parts.push('Poor draw');
  }

  parts.push(category === 'sprint' ? 'sprint' : 'route');

  if (trackBiasApplied) {
    parts.push(`(${trackCode} bias applied)`);
  }

  if (adjustment !== 0) {
    parts.push(`Field: ${fieldSize}`);
  }

  parts.push(`- ${distance}`);

  return parts.join(' ');
}

// ============================================================================
// TURF-SPECIFIC ADJUSTMENTS
// ============================================================================

/**
 * Apply turf-specific adjustments
 * Inside posts have more value on turf due to ground saved
 */
function applyTurfAdjustment(
  baseScore: number,
  postPosition: number,
  category: 'sprint' | 'route',
  trackBiasApplied: boolean
): number {
  // If track-specific bias is already applied, don't double-adjust
  if (trackBiasApplied) {
    return baseScore;
  }

  // Inside posts get bonus on turf
  if (postPosition <= 3) {
    return Math.min(MAX_POST_SCORE, baseScore + 4);
  }

  // Middle posts are neutral
  if (postPosition <= 6) {
    return baseScore;
  }

  // Outside posts penalized more on turf (ground loss)
  const outsidePenalty = category === 'route' ? 3 : 2;
  return Math.max(5, baseScore - outsidePenalty);
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Calculate post position score for a horse
 *
 * @param horse - The horse entry to score
 * @param raceHeader - Race information
 * @returns Detailed score breakdown
 */
export function calculatePostPositionScore(
  horse: HorseEntry,
  raceHeader: RaceHeader
): PostPositionScoreResult {
  const postPosition = horse.postPosition;
  const trackCode = raceHeader.trackCode;
  const distance = raceHeader.distance;
  const surface = raceHeader.surface;
  const fieldSize = raceHeader.fieldSize;

  // Parse distance and determine category
  const furlongs = parseDistanceToFurlongs(distance);
  const category = getDistanceCategory(furlongs);

  // Check if we have track-specific data
  const hasTrackData = isTrackIntelligenceAvailable(trackCode);

  let baseScore: number;
  let biasMultiplier = 1.0;
  let trackBiasApplied = false;
  let isGoldenPost = false;

  if (hasTrackData) {
    // Use track-specific bias data
    const bias = getPostPositionBias(trackCode, distance, surface);

    if (bias) {
      const trackResult = calculateTrackSpecificScore(
        postPosition,
        bias.winPercentByPost,
        bias.favoredPosts
      );
      baseScore = trackResult.score;
      biasMultiplier = trackResult.multiplier;
      isGoldenPost = trackResult.isGolden;
      trackBiasApplied = true;
    } else {
      // Fallback to generic scoring
      const genericResult = getGenericBaseScore(postPosition, category);
      baseScore = genericResult.score;
      isGoldenPost =
        GENERIC_SPRINT_PREFERENCES.ideal.includes(postPosition) ||
        GENERIC_ROUTE_PREFERENCES.ideal.includes(postPosition);
    }
  } else {
    // Use generic scoring
    const genericResult = getGenericBaseScore(postPosition, category);
    baseScore = genericResult.score;
    isGoldenPost =
      (category === 'sprint' && GENERIC_SPRINT_PREFERENCES.ideal.includes(postPosition)) ||
      (category === 'route' && GENERIC_ROUTE_PREFERENCES.ideal.includes(postPosition));
  }

  // Apply turf adjustments
  if (surface === 'turf') {
    baseScore = applyTurfAdjustment(baseScore, postPosition, category, trackBiasApplied);
  }

  // Calculate field size adjustment
  const fieldSizeAdjustment = calculateFieldSizeAdjustment(postPosition, fieldSize, category);

  // Calculate final score
  let total = baseScore + fieldSizeAdjustment;
  total = Math.max(5, Math.min(MAX_POST_SCORE, total));

  // Build reasoning
  const reasoning = buildReasoning(
    postPosition,
    category,
    trackBiasApplied,
    isGoldenPost,
    fieldSize,
    baseScore,
    fieldSizeAdjustment,
    trackCode,
    distance
  );

  return {
    total: Math.round(total),
    baseScore,
    biasMultiplier,
    fieldSizeAdjustment,
    trackBiasApplied,
    isGoldenPost,
    reasoning,
  };
}

/**
 * Get optimal post positions for a race
 * Useful for analysis and display
 */
export function getOptimalPostPositions(raceHeader: RaceHeader): {
  positions: number[];
  description: string;
} {
  const trackCode = raceHeader.trackCode;
  const distance = raceHeader.distance;
  const surface = raceHeader.surface;

  if (isTrackIntelligenceAvailable(trackCode)) {
    const bias = getPostPositionBias(trackCode, distance, surface);
    if (bias) {
      return {
        positions: bias.favoredPosts,
        description: bias.biasDescription,
      };
    }
  }

  // Generic optimal positions
  const furlongs = parseDistanceToFurlongs(distance);
  const category = getDistanceCategory(furlongs);

  if (surface === 'turf') {
    return {
      positions: [1, 2, 3],
      description: 'Inside posts favored on turf (saves ground)',
    };
  }

  if (category === 'sprint') {
    return {
      positions: [4, 5],
      description: 'Middle posts favored in sprints (clean break, no traffic)',
    };
  }

  return {
    positions: [4, 5, 3],
    description: 'Middle posts slight edge in routes',
  };
}
