/**
 * Edge Gradient Utility
 *
 * Calculates dynamic gradient colors for row backgrounds based on edge %
 * Uses Google Sheets-style conditional formatting that dynamically adjusts
 * based on active (unscratched) horses in the field.
 *
 * Color scale:
 * - Best edge (1.0): #57bb8a (green)
 * - Middle (0.5): #ffd666 (yellow)
 * - Worst edge (0.0): #e67c73 (red)
 */

// Google Sheets-style gradient colors
export const GRADIENT_COLORS = {
  best: { r: 87, g: 187, b: 138 }, // #57bb8a (green)
  middle: { r: 255, g: 214, b: 102 }, // #ffd666 (yellow)
  worst: { r: 230, g: 124, b: 115 }, // #e67c73 (red)
} as const;

// Background opacity for dark theme (subtle tint without overwhelming)
export const GRADIENT_OPACITY = 0.18;

// Scratched row neutral color (muted gray)
export const SCRATCHED_COLOR = 'rgba(110, 110, 112, 0.08)';

export interface EdgeGradientInput {
  /** Horse index in the array */
  index: number;
  /** Edge percentage for this horse */
  edgePercent: number;
  /** Whether this horse is scratched */
  isScratched: boolean;
}

export interface EdgeGradientResult {
  /** Horse index */
  index: number;
  /** Position in the gradient range (0 = worst, 1 = best) */
  position: number;
  /** RGB color as { r, g, b } */
  rgb: { r: number; g: number; b: number };
  /** CSS rgba color string with appropriate opacity */
  backgroundColor: string;
  /** Whether this horse is scratched (uses neutral background) */
  isScratched: boolean;
}

/**
 * Linear interpolation between two values
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate between two RGB colors
 */
function interpolateRgb(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number },
  t: number
): { r: number; g: number; b: number } {
  return {
    r: Math.round(lerp(color1.r, color2.r, t)),
    g: Math.round(lerp(color1.g, color2.g, t)),
    b: Math.round(lerp(color1.b, color2.b, t)),
  };
}

/**
 * Calculate gradient color based on position (0 = worst, 1 = best)
 * Uses three-point interpolation: worst -> middle -> best
 */
function calculateGradientColor(position: number): { r: number; g: number; b: number } {
  // Clamp position to valid range
  const clampedPosition = Math.max(0, Math.min(1, position));

  if (clampedPosition <= 0.5) {
    // Interpolate between worst (red) and middle (yellow)
    const t = clampedPosition * 2; // Map 0-0.5 to 0-1
    return interpolateRgb(GRADIENT_COLORS.worst, GRADIENT_COLORS.middle, t);
  } else {
    // Interpolate between middle (yellow) and best (green)
    const t = (clampedPosition - 0.5) * 2; // Map 0.5-1 to 0-1
    return interpolateRgb(GRADIENT_COLORS.middle, GRADIENT_COLORS.best, t);
  }
}

/**
 * Convert RGB color to CSS rgba string with specified opacity
 */
function rgbToRgba(rgb: { r: number; g: number; b: number }, opacity: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

/**
 * Calculate dynamic gradient colors for all horses in a race field
 *
 * This function:
 * 1. Takes array of edge values for unscratched horses
 * 2. Finds min and max edge within the active field
 * 3. For each horse, calculates its position in the range (0 to 1)
 * 4. Maps position to color gradient: best edge = green, worst edge = red
 * 5. Scratched horses receive neutral/muted background
 *
 * @param inputs Array of horse data with edge percentages
 * @returns Array of gradient results with background colors
 */
export function calculateEdgeGradients(inputs: EdgeGradientInput[]): EdgeGradientResult[] {
  // Separate active and scratched horses
  const activeInputs = inputs.filter((input) => !input.isScratched);

  // If no active horses, return neutral colors for all
  if (activeInputs.length === 0) {
    return inputs.map((input) => ({
      index: input.index,
      position: 0.5,
      rgb: GRADIENT_COLORS.middle,
      backgroundColor: SCRATCHED_COLOR,
      isScratched: input.isScratched,
    }));
  }

  // Find min and max edge among active horses
  const edgeValues = activeInputs.map((input) => input.edgePercent);
  const minEdge = Math.min(...edgeValues);
  const maxEdge = Math.max(...edgeValues);
  const edgeRange = maxEdge - minEdge;

  // Calculate gradient for each horse
  return inputs.map((input) => {
    // Scratched horses get neutral background
    if (input.isScratched) {
      return {
        index: input.index,
        position: 0.5,
        rgb: GRADIENT_COLORS.middle,
        backgroundColor: SCRATCHED_COLOR,
        isScratched: true,
      };
    }

    // Calculate position in the gradient (0 = worst, 1 = best)
    // If all horses have the same edge, position is 0.5 (middle)
    let position: number;
    if (edgeRange === 0) {
      position = 0.5;
    } else {
      position = (input.edgePercent - minEdge) / edgeRange;
    }

    // Calculate the RGB color for this position
    const rgb = calculateGradientColor(position);

    // Generate CSS background color with appropriate opacity
    const backgroundColor = rgbToRgba(rgb, GRADIENT_OPACITY);

    return {
      index: input.index,
      position,
      rgb,
      backgroundColor,
      isScratched: false,
    };
  });
}

/**
 * Get gradient background color for a single horse given field context
 *
 * Convenience function when you already know the field's min/max edge
 *
 * @param edgePercent The horse's edge percentage
 * @param minEdge Minimum edge in the active field
 * @param maxEdge Maximum edge in the active field
 * @param isScratched Whether this horse is scratched
 * @returns CSS rgba background color string
 */
export function getEdgeGradientBackground(
  edgePercent: number,
  minEdge: number,
  maxEdge: number,
  isScratched: boolean
): string {
  if (isScratched) {
    return SCRATCHED_COLOR;
  }

  const edgeRange = maxEdge - minEdge;
  const position = edgeRange === 0 ? 0.5 : (edgePercent - minEdge) / edgeRange;
  const rgb = calculateGradientColor(position);

  return rgbToRgba(rgb, GRADIENT_OPACITY);
}

/**
 * Calculate min and max edge values from an array of horses
 *
 * @param edgeValues Array of edge percentages for active (non-scratched) horses
 * @returns Object with minEdge and maxEdge, or null if array is empty
 */
export function calculateEdgeRange(
  edgeValues: number[]
): { minEdge: number; maxEdge: number } | null {
  if (edgeValues.length === 0) {
    return null;
  }

  return {
    minEdge: Math.min(...edgeValues),
    maxEdge: Math.max(...edgeValues),
  };
}

/**
 * Get gradient position (0-1) for display/debugging
 */
export function getGradientPosition(edgePercent: number, minEdge: number, maxEdge: number): number {
  const edgeRange = maxEdge - minEdge;
  if (edgeRange === 0) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, (edgePercent - minEdge) / edgeRange));
}
