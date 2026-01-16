/**
 * Value Tag Matrix System
 *
 * Combines projected finish rank with edge percentage to create 15 distinct value tags.
 * Each tag has a plain English label (top line) and handicapper term (bottom line).
 *
 * Data analysis of 112 races (1,007 horses) determined these thresholds:
 * - Strong Overlay: +50% and above
 * - Mild Overlay: +15% to +50%
 * - Fair: -15% to +15%
 * - Mild Underlay: -40% to -15%
 * - Strong Underlay: Below -40%
 */

// Edge percentage thresholds based on data analysis
export const EDGE_THRESHOLDS = {
  STRONG_OVERLAY: 50, // >= +50%
  MILD_OVERLAY: 15, // +15% to +50%
  FAIR_MAX: 15, // -15% to +15%
  FAIR_MIN: -15,
  MILD_UNDERLAY: -40, // -40% to -15%
  STRONG_UNDERLAY: -40, // < -40%
} as const;

// Rank tier definitions
export type RankTier = 'TOP' | 'MID' | 'BOTTOM';

export interface ValueTag {
  plainLabel: string; // Top line - simple English
  techLabel: string; // Bottom line - handicapper term
  action: string; // Betting action code
}

export interface ValueTagResult {
  tag: ValueTag;
  tier: RankTier;
  edgeBucket: string;
  valueScore: number;
  color: string;
  textColor: string;
}

// 15-tag matrix organized by tier and edge bucket
const VALUE_TAG_MATRIX: Record<RankTier, Record<string, ValueTag>> = {
  TOP: {
    STRONG_OVERLAY: {
      plainLabel: 'BEST BET',
      techLabel: 'PRIME VALUE',
      action: 'BET_STRONG',
    },
    MILD_OVERLAY: {
      plainLabel: 'STRONG PICK',
      techLabel: 'SOLID EDGE',
      action: 'BET',
    },
    FAIR: {
      plainLabel: 'PRICED RIGHT',
      techLabel: 'FAIR PRICE',
      action: 'CONSIDER',
    },
    MILD_UNDERLAY: {
      plainLabel: 'TOO SHORT',
      techLabel: 'UNDERLAID',
      action: 'WATCH',
    },
    STRONG_UNDERLAY: {
      plainLabel: 'PASS',
      techLabel: 'OVERBET',
      action: 'AVOID',
    },
  },
  MID: {
    STRONG_OVERLAY: {
      plainLabel: 'SNEAKY GOOD',
      techLabel: 'BIG OVERLAY',
      action: 'BET',
    },
    MILD_OVERLAY: {
      plainLabel: 'WORTH A LOOK',
      techLabel: 'MILD OVERLAY',
      action: 'CONSIDER',
    },
    FAIR: {
      plainLabel: 'COIN FLIP',
      techLabel: 'IN THE MIX',
      action: 'WATCH',
    },
    MILD_UNDERLAY: {
      plainLabel: 'RISKY',
      techLabel: 'UNDERLAID',
      action: 'CAUTION',
    },
    STRONG_UNDERLAY: {
      plainLabel: 'SKIP',
      techLabel: 'FADE',
      action: 'AVOID',
    },
  },
  BOTTOM: {
    STRONG_OVERLAY: {
      plainLabel: 'LOTTERY TICKET',
      techLabel: 'BOMB PRICE',
      action: 'SMALL_BET',
    },
    MILD_OVERLAY: {
      plainLabel: 'LONG SHOT',
      techLabel: 'SOME VALUE',
      action: 'WATCH',
    },
    FAIR: {
      plainLabel: 'NEEDS HELP',
      techLabel: 'NEEDS CHAOS',
      action: 'PASS',
    },
    MILD_UNDERLAY: {
      plainLabel: 'UNLIKELY',
      techLabel: 'THIN',
      action: 'AVOID',
    },
    STRONG_UNDERLAY: {
      plainLabel: 'NO CHANCE',
      techLabel: 'DEAD MONEY',
      action: 'AVOID',
    },
  },
};

/**
 * Determine the rank tier based on position and field size.
 *
 * TOP: #1-2
 * MID: #3-5 (or up to 50% of field, whichever is smaller)
 * BOTTOM: #6+
 */
export function getRankTier(rank: number, fieldSize: number): RankTier {
  if (rank <= 2) return 'TOP';
  if (rank <= Math.min(5, Math.ceil(fieldSize * 0.5))) return 'MID';
  return 'BOTTOM';
}

/**
 * Determine the edge bucket based on edge percentage.
 */
export function getEdgeBucket(edgePercent: number): string {
  if (edgePercent >= EDGE_THRESHOLDS.STRONG_OVERLAY) return 'STRONG_OVERLAY';
  if (edgePercent >= EDGE_THRESHOLDS.MILD_OVERLAY) return 'MILD_OVERLAY';
  if (edgePercent >= EDGE_THRESHOLDS.FAIR_MIN) return 'FAIR';
  if (edgePercent >= EDGE_THRESHOLDS.MILD_UNDERLAY) return 'MILD_UNDERLAY';
  return 'STRONG_UNDERLAY';
}

/**
 * Calculate a value score from 0-100 used for the color gradient.
 * Combines rank position and edge into a single value.
 * Higher = better value (greener), Lower = worse value (redder)
 *
 * @param rank - Horse's projected finish rank (1 = best)
 * @param fieldSize - Total number of active horses in the race
 * @param edgePercent - Edge percentage (positive = overlay, negative = underlay)
 * @returns Value score from 0-100
 */
export function calculateValueScore(rank: number, fieldSize: number, edgePercent: number): number {
  // Edge component (0-60 points)
  // Maps -60% to +100% onto 0-60 scale
  const edgeClamped = Math.max(-60, Math.min(100, edgePercent));
  const edgeScore = ((edgeClamped + 60) / 160) * 60;

  // Rank component (0-40 points)
  // #1 = 40pts, last place = 0pts
  // Handle edge case where fieldSize is 1 (avoid division by zero)
  const rankScore =
    fieldSize > 1 ? ((fieldSize - rank) / (fieldSize - 1)) * 40 : rank === 1 ? 40 : 0;

  return Math.round(edgeScore + rankScore);
}

/**
 * Map a value score (0-100) to a color on the gradient.
 *
 * 0-20: Deep red (#ef4444)
 * 20-35: Orange (#f97316)
 * 35-50: Yellow (#eab308)
 * 50-65: Gray (#6b7280)
 * 65-80: Teal (#14b8a6)
 * 80-90: Green (#10b981)
 * 90-100: Bright green (#22c55e)
 */
export function getValueColor(valueScore: number): string {
  if (valueScore >= 90) return '#22c55e'; // Bright green
  if (valueScore >= 80) return '#10b981'; // Green
  if (valueScore >= 65) return '#14b8a6'; // Teal
  if (valueScore >= 50) return '#6b7280'; // Gray
  if (valueScore >= 35) return '#eab308'; // Yellow
  if (valueScore >= 20) return '#f97316'; // Orange
  return '#ef4444'; // Deep red
}

/**
 * Get contrasting text color for a given background color.
 * Returns white for dark backgrounds, dark gray for light backgrounds.
 */
export function getContrastTextColor(bgColor: string): string {
  // Map of background colors to appropriate text colors
  const colorMap: Record<string, string> = {
    '#22c55e': '#ffffff', // Bright green -> white
    '#10b981': '#ffffff', // Green -> white
    '#14b8a6': '#ffffff', // Teal -> white
    '#6b7280': '#ffffff', // Gray -> white
    '#eab308': '#1a1a1c', // Yellow -> dark
    '#f97316': '#ffffff', // Orange -> white
    '#ef4444': '#ffffff', // Deep red -> white
  };

  return colorMap[bgColor] || '#ffffff';
}

/**
 * Get the complete value tag result combining rank, field size, and edge.
 *
 * @param rank - Horse's projected finish rank (1 = best)
 * @param fieldSize - Total number of active horses in the race
 * @param edgePercent - Edge percentage (positive = overlay, negative = underlay)
 * @returns Complete ValueTagResult with tag, tier, colors, and score
 */
export function getValueTag(rank: number, fieldSize: number, edgePercent: number): ValueTagResult {
  const tier = getRankTier(rank, fieldSize);
  const edgeBucket = getEdgeBucket(edgePercent);
  const valueScore = calculateValueScore(rank, fieldSize, edgePercent);
  const color = getValueColor(valueScore);
  const textColor = getContrastTextColor(color);

  const tag = VALUE_TAG_MATRIX[tier][edgeBucket] ?? {
    plainLabel: 'UNKNOWN',
    techLabel: 'N/A',
    action: 'WATCH',
  };

  return {
    tag,
    tier,
    edgeBucket,
    valueScore,
    color,
    textColor,
  };
}

/**
 * Get a scratched horse tag result (empty/neutral styling)
 */
export function getScratchedValueTag(): ValueTagResult {
  return {
    tag: {
      plainLabel: '',
      techLabel: '',
      action: 'SCRATCHED',
    },
    tier: 'BOTTOM',
    edgeBucket: 'SCRATCHED',
    valueScore: 0,
    color: '#6e6e70',
    textColor: '#ffffff',
  };
}
