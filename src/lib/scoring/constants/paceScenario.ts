/**
 * PACE SCENARIO CONSTANTS
 *
 * Adjustments for tactical pace advantages/disadvantages.
 * These values can be tuned based on validation results.
 *
 * Historical Win Rates by Scenario:
 * - Lone E (only speed): 35-40% win rate
 * - E in speed duel (2+ E types): 15-20% win rate
 * - Closer in speed duel: 25-30% win rate
 * - Closer with no pace: 10-15% win rate (no setup)
 *
 * DISTANCE-ADJUSTED EP1 THRESHOLDS (January 2026):
 * EP1 figures have different meanings based on race distance.
 * - Sprints (≤7f): Higher EP1 values needed to classify as early speed
 *   because early position is more contested at shorter distances
 * - Routes (>7f): Lower EP1 thresholds are appropriate because
 *   early speed is more conserved and an EP1 of 88 at 1.5 miles
 *   means the horse is on the lead, not mid-pack
 */

/**
 * Maximum distance in furlongs for sprint classification
 * Races ≤7f are sprints, >7f are routes
 */
export const SPRINT_MAX_FURLONGS = 7;

/**
 * Sprint EP1 thresholds (≤7 furlongs)
 * These are the original, more restrictive thresholds
 *
 * E (Early): EP1 ≥ 92 - Must show strong early speed in sprint
 * EP (Early Presser): EP1 85-91 - Presses the pace
 * P (Presser/Stalker): EP1 75-84 - Mid-pack positioning
 * S (Closer): EP1 < 75 - Comes from behind
 */
export const SPRINT_EP1_THRESHOLDS = {
  /** E type (early speed): EP1 >= 92 */
  E: 92,
  /** EP type (early presser): EP1 85-91 */
  EP: 85,
  /** P type (stalker): EP1 75-84 */
  P: 75,
  // Below 75 = S type (closer)
} as const;

/**
 * Route EP1 thresholds (>7 furlongs)
 * Lower thresholds because early speed is more conserved at distance
 *
 * Logic: An EP1 of 88 at 6 furlongs means mid-pack positioning,
 * but the same EP1 at 1.5 miles means the horse is on the lead.
 * Pace scenarios in routes require lower EP1 thresholds to
 * accurately classify running styles.
 *
 * E (Early): EP1 ≥ 88 - Early speed at route distance
 * EP (Early Presser): EP1 80-87 - Presses the pace
 * P (Presser/Stalker): EP1 70-79 - Mid-pack positioning
 * S (Closer): EP1 < 70 - Comes from behind
 */
export const ROUTE_EP1_THRESHOLDS = {
  /** E type (early speed): EP1 >= 88 */
  E: 88,
  /** EP type (early presser): EP1 80-87 */
  EP: 80,
  /** P type (stalker): EP1 70-79 */
  P: 70,
  // Below 70 = S type (closer)
} as const;

/**
 * Get the appropriate EP1 thresholds based on race distance
 *
 * @param distanceFurlongs - Race distance in furlongs (null/undefined = sprint default)
 * @returns The appropriate threshold set (sprint or route)
 */
export function getEP1ThresholdsForDistance(
  distanceFurlongs: number | null | undefined
): typeof SPRINT_EP1_THRESHOLDS | typeof ROUTE_EP1_THRESHOLDS {
  // Default to sprint thresholds if distance is not available (more conservative)
  if (distanceFurlongs === null || distanceFurlongs === undefined) {
    console.warn(
      '[PACE_SCENARIO] Distance not available, defaulting to sprint EP1 thresholds (conservative)'
    );
    return SPRINT_EP1_THRESHOLDS;
  }

  // 7f or less = sprint, more than 7f = route
  if (distanceFurlongs <= SPRINT_MAX_FURLONGS) {
    return SPRINT_EP1_THRESHOLDS;
  }

  return ROUTE_EP1_THRESHOLDS;
}

/**
 * Determine if a race is a sprint or route
 *
 * @param distanceFurlongs - Race distance in furlongs
 * @returns 'sprint' or 'route'
 */
export function getRaceDistanceType(
  distanceFurlongs: number | null | undefined
): 'sprint' | 'route' {
  if (distanceFurlongs === null || distanceFurlongs === undefined) {
    return 'sprint'; // Conservative default
  }
  return distanceFurlongs <= SPRINT_MAX_FURLONGS ? 'sprint' : 'route';
}

export const PACE_SCENARIO_CONFIG = {
  // DEPRECATED: Use SPRINT_EP1_THRESHOLDS and ROUTE_EP1_THRESHOLDS with getEP1ThresholdsForDistance()
  // Kept for backwards compatibility - these are the sprint thresholds
  /** @deprecated Use SPRINT_EP1_THRESHOLDS.E instead - E type (early speed): EP1 >= 92 */
  EP1_EARLY_SPEED: 92,
  /** @deprecated Use SPRINT_EP1_THRESHOLDS.EP instead - EP type (early presser): EP1 85-91 */
  EP1_PRESSER: 85,
  /** @deprecated Use SPRINT_EP1_THRESHOLDS.P instead - P type (stalker): EP1 75-84 */
  EP1_STALKER: 75,
  // Below 75 = S type (closer)

  // Adjustments by scenario - LONE_SPEED
  /** Lone speed bonus: unchallenged lead */
  LONE_SPEED_BONUS: 8,
  /** Closer penalty in lone speed: no pace to close into */
  LONE_SPEED_CLOSER_PENALTY: -3,

  // Adjustments by scenario - SPEED_DUEL
  /** Speed duel penalty: will fight for lead, tire */
  SPEED_DUEL_PENALTY: -4,
  /** Closer/stalker bonus in speed duel: pace collapse benefit */
  SPEED_DUEL_CLOSER_BONUS: 4,

  // Adjustments by scenario - CHAOTIC
  /** Chaotic speed penalty: 3+ speed types fighting */
  CHAOTIC_SPEED_PENALTY: -6,
  /** Deep closer bonus in chaotic pace */
  CHAOTIC_CLOSER_BONUS: 5,
  /** Stalker bonus in chaotic pace: pace meltdown */
  CHAOTIC_STALKER_BONUS: 3,

  // Adjustments by scenario - SLOW
  /** Presser/stalker bonus in slow pace: can control */
  SLOW_PRESSER_BONUS: 3,
  /** Closer penalty in slow pace: no pace to close into */
  SLOW_CLOSER_PENALTY: -4,

  // Adjustments by scenario - CONTESTED
  /** Speed penalty in contested pace */
  CONTESTED_SPEED_PENALTY: -2,
  /** Closer/stalker bonus in contested pace: honest setup */
  CONTESTED_CLOSER_BONUS: 2,

  // Confidence thresholds
  /** Maximum percentage of unknown styles for HIGH confidence */
  HIGH_CONFIDENCE_MAX_UNKNOWN_PCT: 0.1,
  /** Maximum percentage of unknown styles for MEDIUM confidence */
  MEDIUM_CONFIDENCE_MAX_UNKNOWN_PCT: 0.2,
  /** Maximum percentage of unknown styles for LOW confidence */
  LOW_CONFIDENCE_MAX_UNKNOWN_PCT: 0.3,

  // Recent PPs to consider for running style classification
  /** Number of recent PPs to analyze for EP1 average */
  RECENT_PP_COUNT: 3,
} as const;

/**
 * Running style definitions for display and documentation
 */
export const RUNNING_STYLE_DEFINITIONS = {
  E: {
    name: 'Early Speed',
    description: 'Wants the lead, typically has EP1 >= 92',
    shortName: 'E',
  },
  EP: {
    name: 'Early Presser',
    description: 'Can press the pace, typically has EP1 85-91',
    shortName: 'EP',
  },
  P: {
    name: 'Presser/Stalker',
    description: 'Sits mid-pack, typically has EP1 75-84',
    shortName: 'P',
  },
  S: {
    name: 'Closer/Sustained',
    description: 'Comes from behind, typically has EP1 < 75',
    shortName: 'S',
  },
  UNKNOWN: {
    name: 'Unknown',
    description: 'Insufficient data to classify running style',
    shortName: '?',
  },
} as const;

/**
 * Pace scenario definitions for display and documentation
 */
export const PACE_SCENARIO_DEFINITIONS = {
  LONE_SPEED: {
    name: 'Lone Speed',
    description: 'One E type, huge advantage - unchallenged lead',
    color: '#22c55e', // Green
  },
  SPEED_DUEL: {
    name: 'Speed Duel',
    description: '2 E types, likely pace collapse',
    color: '#f97316', // Orange
  },
  CONTESTED: {
    name: 'Contested',
    description: '2+ EP types pressuring, honest tempo',
    color: '#eab308', // Yellow
  },
  HONEST: {
    name: 'Honest',
    description: 'Normal pace, fair for all styles',
    color: '#6b7280', // Gray
  },
  SLOW: {
    name: 'Slow',
    description: 'No speed, closers disadvantaged',
    color: '#3b82f6', // Blue
  },
  CHAOTIC: {
    name: 'Chaotic',
    description: '3+ speed types, unpredictable',
    color: '#ef4444', // Red
  },
} as const;
