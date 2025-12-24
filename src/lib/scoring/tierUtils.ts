/**
 * Tier Utilities for Horse Display
 *
 * Separates two distinct concepts:
 * - WIN: Pure ability ranking (who will win the race)
 * - BET: Value assessment (is the bet worth making at current odds)
 * - TIER: Synthesis combining WIN + BET for overall recommendation
 *
 * This separation addresses the confusion where a likely winner
 * marked "AVOID" (bad value) was misread as "won't win".
 */

// ============================================================================
// TYPES
// ============================================================================

export type TierLevel = 'top-pick' | 'contender' | 'mid-pack' | 'longshot' | 'avoid';
export type BetValue = 'OVER' | 'FAIR' | 'UNDER';

export interface TierInfo {
  level: TierLevel;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  description: string;
}

export interface BetValueInfo {
  value: BetValue;
  label: string;
  color: string;
  bgColor: string;
  overlayPercent: number;
}

export interface RankColorInfo {
  color: string;
  bgColor: string;
  intensity: number; // 0-1 for gradient
}

// ============================================================================
// TIER DEFINITIONS
// ============================================================================

export const TIER_META: Record<TierLevel, Omit<TierInfo, 'level'>> = {
  'top-pick': {
    label: 'Top Pick',
    shortLabel: 'TOP PICK',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    description: 'Best scoring horse in the field',
  },
  contender: {
    label: 'Contender',
    shortLabel: 'CONTENDER',
    color: '#4ade80',
    bgColor: 'rgba(74, 222, 128, 0.15)',
    description: 'Strong chance to win or place',
  },
  'mid-pack': {
    label: 'Mid Pack',
    shortLabel: 'MID PACK',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.15)',
    description: 'Average chance, needs pace scenario help',
  },
  longshot: {
    label: 'Longshot',
    shortLabel: 'LONGSHOT',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.15)',
    description: 'Below average but could surprise',
  },
  avoid: {
    label: 'Avoid',
    shortLabel: 'AVOID',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    description: 'Poor value, recommend passing',
  },
};

// ============================================================================
// BET VALUE DEFINITIONS
// ============================================================================

/** BET value thresholds based on overlay percent */
export const BET_VALUE_THRESHOLDS = {
  over: 10, // >= 10% overlay = OVER (good value)
  under: -10, // <= -10% = UNDER (bad value)
  // Between -10% and 10% = FAIR
} as const;

export const BET_VALUE_META: Record<BetValue, Omit<BetValueInfo, 'value' | 'overlayPercent'>> = {
  OVER: {
    label: 'Overlay',
    color: '#22c55e', // Green
    bgColor: 'rgba(34, 197, 94, 0.15)',
  },
  FAIR: {
    label: 'Fair Value',
    color: '#eab308', // Yellow
    bgColor: 'rgba(234, 179, 8, 0.15)',
  },
  UNDER: {
    label: 'Underlay',
    color: '#ef4444', // Red
    bgColor: 'rgba(239, 68, 68, 0.15)',
  },
};

// ============================================================================
// BET VALUE CALCULATION
// ============================================================================

/**
 * Calculate BET value from overlay percentage
 * OVER = odds are better than fair value (good bet)
 * FAIR = odds are roughly fair
 * UNDER = odds are worse than fair value (bad bet)
 */
export function calculateBetValue(overlayPercent: number): BetValue {
  if (overlayPercent >= BET_VALUE_THRESHOLDS.over) return 'OVER';
  if (overlayPercent <= BET_VALUE_THRESHOLDS.under) return 'UNDER';
  return 'FAIR';
}

/**
 * Get full BET value info including colors
 */
export function getBetValueInfo(overlayPercent: number): BetValueInfo {
  const value = calculateBetValue(overlayPercent);
  return {
    value,
    overlayPercent,
    ...BET_VALUE_META[value],
  };
}

// ============================================================================
// DYNAMIC TIER CALCULATION
// ============================================================================

/**
 * Calculate tier by synthesizing WIN rank and BET value
 *
 * TIER = synthesis of WIN (ability) + BET (value)
 *
 * | WIN Rank | BET Value | → TIER       |
 * |----------|-----------|--------------|
 * | #1       | OVER      | TOP PICK     | Best ability + good odds
 * | #1       | FAIR      | CONTENDER    | Best ability, fair odds
 * | #1       | UNDER     | CONTENDER    | Best ability but bad odds
 * | #2-3     | OVER      | CONTENDER    | Strong ability + value
 * | #2-3     | FAIR      | CONTENDER    | Strong ability
 * | #2-3     | UNDER     | MID PACK     | Strong ability but bad value
 * | #4-6     | OVER      | MID PACK     | Average + some value
 * | #4-6     | FAIR      | LONGSHOT     | Average, fair odds
 * | #4-6     | UNDER     | AVOID        | Average + bad value
 * | #7+      | OVER      | LONGSHOT     | Weak + good odds (value play)
 * | #7+      | FAIR      | AVOID        | Weak, no value edge
 * | #7+      | UNDER     | AVOID        | Weak + bad value
 */
export function calculateTier(
  rank: number,
  totalHorses: number,
  overlayPercent?: number
): TierLevel {
  const betValue = overlayPercent !== undefined ? calculateBetValue(overlayPercent) : 'FAIR';
  const percentile = rank / totalHorses;

  // Top horse (#1)
  if (rank === 1) {
    if (betValue === 'OVER') return 'top-pick';
    return 'contender'; // FAIR or UNDER - still best ability
  }

  // Strong contenders (#2-3, or top 35%)
  if (percentile <= 0.35) {
    if (betValue === 'UNDER') return 'mid-pack'; // Demoted for bad value
    return 'contender';
  }

  // Mid-pack (35-65%)
  if (percentile <= 0.65) {
    if (betValue === 'OVER') return 'mid-pack'; // Slight upgrade for value
    if (betValue === 'UNDER') return 'avoid'; // Demoted for bad value
    return 'longshot';
  }

  // Lower tier (65-85%)
  if (percentile <= 0.85) {
    if (betValue === 'OVER') return 'longshot'; // Value play
    return 'avoid';
  }

  // Bottom tier (85%+)
  return 'avoid';
}

/**
 * Get full tier info for a horse
 */
export function getTierInfo(rank: number, totalHorses: number, overlayPercent?: number): TierInfo {
  const level = calculateTier(rank, totalHorses, overlayPercent);
  return {
    level,
    ...TIER_META[level],
  };
}

// ============================================================================
// DYNAMIC COLOR GRADIENT
// ============================================================================

/**
 * Color stops for the gradient (green to red)
 */
const GRADIENT_COLORS = [
  { r: 34, g: 197, b: 94 }, // #22c55e - Green (best)
  { r: 74, g: 222, b: 128 }, // #4ade80 - Light green
  { r: 234, g: 179, b: 8 }, // #eab308 - Yellow
  { r: 249, g: 115, b: 22 }, // #f97316 - Orange
  { r: 239, g: 68, b: 68 }, // #ef4444 - Red (worst)
];

/**
 * Interpolate between two colors
 */
function interpolateColor(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number },
  factor: number
): { r: number; g: number; b: number } {
  return {
    r: Math.round(color1.r + (color2.r - color1.r) * factor),
    g: Math.round(color1.g + (color2.g - color1.g) * factor),
    b: Math.round(color1.b + (color2.b - color1.b) * factor),
  };
}

/**
 * Get smooth gradient color based on rank position in field
 *
 * @param rank - Horse's rank (1 = best)
 * @param totalHorses - Total active horses in field
 * @returns Color info with hex color and background
 */
export function getRankColor(rank: number, totalHorses: number): RankColorInfo {
  // Handle edge cases
  if (totalHorses <= 1) {
    return {
      color: '#22c55e',
      bgColor: 'rgba(34, 197, 94, 0.15)',
      intensity: 1,
    };
  }

  // Calculate position as 0-1 (0 = best, 1 = worst)
  const position = (rank - 1) / (totalHorses - 1);

  // Map position to gradient stops
  const numStops = GRADIENT_COLORS.length;
  const scaledPosition = position * (numStops - 1);
  const stopIndex = Math.floor(scaledPosition);
  const stopFraction = scaledPosition - stopIndex;

  // Get colors to interpolate between
  const color1 = GRADIENT_COLORS[Math.min(stopIndex, numStops - 1)]!;
  const color2 = GRADIENT_COLORS[Math.min(stopIndex + 1, numStops - 1)]!;

  // Interpolate
  const rgb = interpolateColor(color1, color2, stopFraction);
  const hexColor = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;

  return {
    color: hexColor,
    bgColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
    intensity: 1 - position,
  };
}

/**
 * Get rank display with ordinal suffix
 */
export function formatRank(rank: number): string {
  return `#${rank}`;
}

// ============================================================================
// SORT UTILITIES
// ============================================================================

export type SortField = 'pp' | 'win' | 'bet' | 'tier';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

/** Tier priority for sorting (lower = better) */
const TIER_SORT_ORDER: Record<TierLevel, number> = {
  'top-pick': 1,
  contender: 2,
  'mid-pack': 3,
  longshot: 4,
  avoid: 5,
};

/** Bet value priority for sorting (lower = better for ascending) */
const BET_SORT_ORDER: Record<BetValue, number> = {
  OVER: 1,
  FAIR: 2,
  UNDER: 3,
};

/**
 * Sort horses by field
 * Supports: pp (post position), win (ability rank), bet (value), tier (overall)
 */
export function sortHorses<
  T extends {
    rank: number; // WIN rank
    horse: { postPosition: number };
    tier: TierInfo;
    betValue: BetValueInfo;
  },
>(horses: T[], config: SortConfig): T[] {
  return [...horses].sort((a, b) => {
    let comparison = 0;

    switch (config.field) {
      case 'pp':
        comparison = a.horse.postPosition - b.horse.postPosition;
        break;
      case 'win':
        comparison = a.rank - b.rank;
        break;
      case 'bet':
        comparison = BET_SORT_ORDER[a.betValue.value] - BET_SORT_ORDER[b.betValue.value];
        break;
      case 'tier':
        comparison = TIER_SORT_ORDER[a.tier.level] - TIER_SORT_ORDER[b.tier.level];
        break;
    }

    return config.direction === 'desc' ? -comparison : comparison;
  });
}

/**
 * Get next sort direction when clicking a column
 */
export function getNextSortDirection(
  currentField: SortField,
  currentDirection: SortDirection,
  clickedField: SortField
): SortDirection {
  if (clickedField !== currentField) {
    // New field: default to ascending (best first)
    return 'asc';
  }
  // Same field: toggle direction
  return currentDirection === 'asc' ? 'desc' : 'asc';
}
