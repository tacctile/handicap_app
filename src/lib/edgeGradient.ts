/**
 * Edge Gradient Utility
 *
 * Calculates dynamic edge colors based on race field context.
 * The gradient scales based on the min/max edges in the current field,
 * with 0% as the anchor point (always gray).
 *
 * @module lib/edgeGradient
 */

// Design system colors
const COLORS = {
  gray: '#6E6E70',      // Neutral anchor point (0% edge)
  brightGreen: '#10b981', // Highest positive edge
  brightRed: '#ef4444',   // Lowest negative edge
} as const

/**
 * Interpolate between two hex colors
 * @param color1 Starting color (hex)
 * @param color2 Ending color (hex)
 * @param factor Interpolation factor (0-1)
 * @returns Interpolated hex color
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  // Parse hex colors to RGB
  const c1 = {
    r: parseInt(color1.slice(1, 3), 16),
    g: parseInt(color1.slice(3, 5), 16),
    b: parseInt(color1.slice(5, 7), 16),
  }
  const c2 = {
    r: parseInt(color2.slice(1, 3), 16),
    g: parseInt(color2.slice(3, 5), 16),
    b: parseInt(color2.slice(5, 7), 16),
  }

  // Clamp factor between 0 and 1
  const clampedFactor = Math.max(0, Math.min(1, factor))

  // Interpolate each channel
  const r = Math.round(c1.r + (c2.r - c1.r) * clampedFactor)
  const g = Math.round(c1.g + (c2.g - c1.g) * clampedFactor)
  const b = Math.round(c1.b + (c2.b - c1.b) * clampedFactor)

  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Calculate edge color based on race field context
 *
 * Logic:
 * - Zero (0%) is the anchor point, always gray (#6E6E70)
 * - Positive edges scale from gray toward bright green (#10b981)
 * - Negative edges scale from gray toward red (#ef4444)
 * - The highest positive edge in the field gets brightest green
 * - The lowest negative edge in the field gets brightest red
 * - Intermediate values interpolate proportionally
 *
 * @param edge The edge percentage for this horse (can be negative or positive)
 * @param allEdgesInRace Array of all edge percentages in the race (non-scratched horses)
 * @returns Hex color string for the edge display
 */
export function calculateEdgeColor(edge: number, allEdgesInRace: number[]): string {
  // Handle empty array - return gray
  if (allEdgesInRace.length === 0) {
    return COLORS.gray
  }

  // Find max positive and min negative edges in the field
  const positiveEdges = allEdgesInRace.filter(e => e > 0)
  const negativeEdges = allEdgesInRace.filter(e => e < 0)

  const maxPositive = positiveEdges.length > 0 ? Math.max(...positiveEdges) : 0
  const minNegative = negativeEdges.length > 0 ? Math.min(...negativeEdges) : 0

  // Edge is exactly 0 - return gray
  if (edge === 0) {
    return COLORS.gray
  }

  // Positive edge - interpolate from gray to green
  if (edge > 0) {
    // If no positive edges or max is 0, return gray
    if (maxPositive <= 0) {
      return COLORS.gray
    }
    // Calculate factor: how close is this edge to the max positive?
    const factor = edge / maxPositive
    return interpolateColor(COLORS.gray, COLORS.brightGreen, factor)
  }

  // Negative edge - interpolate from gray to red
  // If no negative edges or min is 0, return gray
  if (minNegative >= 0) {
    return COLORS.gray
  }
  // Calculate factor: how close is this edge to the min negative?
  // minNegative is negative, edge is negative, so both are < 0
  const factor = edge / minNegative
  return interpolateColor(COLORS.gray, COLORS.brightRed, factor)
}

/**
 * Format edge percentage for display
 * @param edge The edge percentage
 * @returns Formatted string with sign and percent symbol
 */
export function formatEdgePercent(edge: number): string {
  const sign = edge >= 0 ? '+' : ''
  return `${sign}${Math.round(edge)}%`
}

/**
 * Get all non-scratched edges from scored horses
 * Utility to extract edges for calculateEdgeColor
 */
export function extractEdgesFromRace(
  scoredHorses: Array<{ score: { isScratched: boolean }; overlay?: { overlayPercent: number } }>
): number[] {
  return scoredHorses
    .filter(h => !h.score.isScratched && h.overlay)
    .map(h => h.overlay!.overlayPercent)
}
