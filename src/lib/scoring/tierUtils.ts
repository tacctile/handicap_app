/**
 * Tier Utilities for Horse Display
 *
 * Provides dynamic color gradients and tier labels based on field position
 * rather than absolute score thresholds.
 */

// ============================================================================
// TYPES
// ============================================================================

export type TierLevel = 'top-pick' | 'contender' | 'mid-pack' | 'longshot' | 'avoid';

export interface TierInfo {
  level: TierLevel;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  description: string;
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
// DYNAMIC TIER CALCULATION
// ============================================================================

/**
 * Calculate tier based on position in field (not absolute score)
 *
 * Field-relative approach:
 * - Top 15%: Top Pick
 * - Top 35%: Contender
 * - Middle 30%: Mid Pack
 * - Bottom 25%: Longshot
 * - Underlay regardless of rank: Avoid
 */
export function calculateTier(
  rank: number,
  totalHorses: number,
  overlayPercent?: number
): TierLevel {
  // If significant underlay, recommend avoid regardless of rank
  if (overlayPercent !== undefined && overlayPercent < -15) {
    return 'avoid';
  }

  const percentile = rank / totalHorses;

  if (rank === 1) return 'top-pick';
  if (percentile <= 0.35) return 'contender';
  if (percentile <= 0.65) return 'mid-pack';
  if (percentile <= 0.85) return 'longshot';
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

export type SortField = 'rank' | 'pp';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

/**
 * Sort horses by field
 */
export function sortHorses<T extends { rank: number; horse: { postPosition: number } }>(
  horses: T[],
  config: SortConfig
): T[] {
  return [...horses].sort((a, b) => {
    let comparison = 0;

    if (config.field === 'rank') {
      comparison = a.rank - b.rank;
    } else if (config.field === 'pp') {
      comparison = a.horse.postPosition - b.horse.postPosition;
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
    // New field: default to ascending for PP, descending for rank
    return clickedField === 'rank' ? 'asc' : 'asc';
  }
  // Same field: toggle direction
  return currentDirection === 'asc' ? 'desc' : 'asc';
}
