/**
 * FIELD SPREAD CONSTANTS
 *
 * Thresholds for field classification and confidence.
 * These values can be tuned based on validation results.
 *
 * Field Spread analyzes score separation between top horses to determine:
 * - Betting confidence (VERY_HIGH to VERY_LOW)
 * - Field type (DOMINANT, SEPARATED, COMPETITIVE, WIDE_OPEN, CHALKY)
 * - Box size recommendations for exotic bets
 * - Sit-out conditions for high-variance races
 *
 * This is a purely algorithmic, deterministic replacement for the AI
 * Field Spread Bot. Same inputs always produce same outputs.
 */

export const FIELD_SPREAD_CONFIG = {
  // Gap thresholds for field type determination (points)
  /** #1 over #2 gap required for DOMINANT classification */
  DOMINANT_GAP: 25,
  /** Max gap between #1 and #2 for CHALKY (top 2 close to each other) */
  CHALKY_TOP2_MAX: 10,
  /** Min gap from #2 to #3 for CHALKY (separated from field) */
  CHALKY_TO_FIELD: 15,
  /** Max spread in top 6 for WIDE_OPEN */
  WIDE_OPEN_RANGE: 20,
  /** Max spread in top 4 for COMPETITIVE */
  COMPETITIVE_RANGE: 15,
  /** Min gap somewhere for SEPARATED */
  SEPARATED_GAP: 15,

  // Tier assignment thresholds (points behind leader)
  /** Maximum points behind leader for A tier (win contenders) */
  TIER_A_MAX: 15,
  /** Maximum points behind leader for B tier (board threats) */
  TIER_B_MAX: 30,
  /** Maximum points behind leader for C tier (need pace/trip help) */
  TIER_C_MAX: 45,
  // Beyond 45 = X tier (likely non-factors)

  // Maximum horses in A tier
  /** Cap on number of horses that can be in A tier */
  MAX_A_TIER_SIZE: 4,

  // Adjustment values (points)
  /** Confidence boost for dominant leader */
  DOMINANT_BOOST: 3,
  /** Confidence boost for chalky race top tier */
  CHALKY_BOOST: 2,
  /** Confidence boost for clearly separated leader */
  SEPARATED_BOOST: 2,
  /** Penalty for "leader" in wide open field (false confidence) */
  WIDE_OPEN_LEADER_PENALTY: -2,
  /** Value boost for mid-pack in wide open field */
  WIDE_OPEN_VALUE_BOOST: 1,

  // Sit-out thresholds
  /** Minimum top score required (below = no confident contenders) */
  MIN_TOP_SCORE: 140,
  /** Top 4 within this range = extreme tight field, sit out */
  EXTREME_TIGHT_RANGE: 8,

  // Minimum field size for WIDE_OPEN classification
  /** At least this many horses for WIDE_OPEN */
  WIDE_OPEN_MIN_FIELD_SIZE: 6,
} as const;

/**
 * Field type definitions for display and documentation
 */
export const FIELD_TYPE_DEFINITIONS = {
  DOMINANT: {
    name: 'Dominant',
    description: 'Clear standout, 25+ point lead over #2',
    color: '#22c55e', // Green - high confidence
  },
  SEPARATED: {
    name: 'Separated',
    description: 'Clear tiers, 15+ point gaps between groups',
    color: '#4ade80', // Light green - good confidence
  },
  COMPETITIVE: {
    name: 'Competitive',
    description: 'Top 4 closely matched, within 15 points',
    color: '#eab308', // Yellow - medium confidence
  },
  WIDE_OPEN: {
    name: 'Wide Open',
    description: "Top 6+ within 20 points, anyone's race",
    color: '#ef4444', // Red - low confidence
  },
  CHALKY: {
    name: 'Chalky',
    description: 'Top 2 separated from field, but close to each other',
    color: '#3b82f6', // Blue - focus on exacta
  },
} as const;

/**
 * Betting confidence definitions
 */
export const BETTING_CONFIDENCE_DEFINITIONS = {
  VERY_HIGH: {
    name: 'Very High',
    description: 'Dominant leader by 35+ points',
    color: '#22c55e', // Green
  },
  HIGH: {
    name: 'High',
    description: 'Clear leader or chalky top 2',
    color: '#4ade80', // Light green
  },
  MEDIUM: {
    name: 'Medium',
    description: 'Competitive field, wider boxes recommended',
    color: '#eab308', // Yellow
  },
  LOW: {
    name: 'Low',
    description: 'Tight field, high variance expected',
    color: '#f97316', // Orange
  },
  VERY_LOW: {
    name: 'Very Low',
    description: 'Wide open field, consider sitting out',
    color: '#ef4444', // Red
  },
} as const;
