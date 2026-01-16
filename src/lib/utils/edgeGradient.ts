/**
 * Edge Gradient Utility - Dynamic left-border accent coloring based on edge %
 *
 * Creates a color gradient across the active field based on each horse's edge percentage.
 * Best edge = green (#10b981), worst edge = red (#ef4444), middle = yellow (#f59e0b)
 *
 * Pattern matches the Factor Breakdown component styling (3-4px left border + subtle background tint)
 */

// Design system status colors from MASTER_CONTEXT.md
const COLOR_BEST = '#10b981';    // Success green - best edge
const COLOR_MIDDLE = '#f59e0b';  // Warning yellow - middle edge
const COLOR_WORST = '#ef4444';   // Error red - worst edge
const COLOR_SCRATCHED = '#6e6e70'; // Neutral gray for scratched horses

// Background tint opacity (0.05-0.08 as per requirements)
const BG_OPACITY = 0.06;

export interface EdgeGradientResult {
  /** The border color for the left accent (3-4px) */
  borderColor: string;
  /** The subtle background tint rgba value */
  backgroundColor: string;
  /** CSS class name suffix for additional styling hooks */
  className: 'best' | 'good' | 'middle' | 'poor' | 'worst' | 'scratched';
  /** The normalized position in the range (0 = worst, 1 = best) */
  normalizedPosition: number;
}

/**
 * Interpolate between two hex colors
 * @param color1 Starting color (hex)
 * @param color2 Ending color (hex)
 * @param t Interpolation factor (0-1)
 * @returns Interpolated hex color
 */
function interpolateColor(color1: string, color2: string, t: number): string {
  // Parse hex colors
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  // Interpolate
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert hex color to rgba with specified opacity
 */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get the gradient class name based on normalized position
 */
function getClassName(normalizedPosition: number): EdgeGradientResult['className'] {
  if (normalizedPosition >= 0.8) return 'best';
  if (normalizedPosition >= 0.6) return 'good';
  if (normalizedPosition >= 0.4) return 'middle';
  if (normalizedPosition >= 0.2) return 'poor';
  return 'worst';
}

/**
 * Calculate the gradient color for a specific edge value within a field
 *
 * @param edgePercent - The edge percentage for this horse
 * @param allEdgePercents - Array of edge percentages for all unscratched horses in the field
 * @param isScratched - Whether this horse is scratched
 * @returns EdgeGradientResult with border color, background, and class name
 */
export function calculateEdgeGradient(
  edgePercent: number,
  allEdgePercents: number[],
  isScratched: boolean
): EdgeGradientResult {
  // Scratched horses get neutral gray styling
  if (isScratched) {
    return {
      borderColor: COLOR_SCRATCHED,
      backgroundColor: hexToRgba(COLOR_SCRATCHED, 0.03), // Even more subtle for scratched
      className: 'scratched',
      normalizedPosition: -1,
    };
  }

  // If only one horse or no valid edges, use middle color
  if (allEdgePercents.length <= 1) {
    return {
      borderColor: COLOR_MIDDLE,
      backgroundColor: hexToRgba(COLOR_MIDDLE, BG_OPACITY),
      className: 'middle',
      normalizedPosition: 0.5,
    };
  }

  // Find min and max edge in the active field
  const minEdge = Math.min(...allEdgePercents);
  const maxEdge = Math.max(...allEdgePercents);

  // If all horses have the same edge, everyone gets middle color
  if (maxEdge === minEdge) {
    return {
      borderColor: COLOR_MIDDLE,
      backgroundColor: hexToRgba(COLOR_MIDDLE, BG_OPACITY),
      className: 'middle',
      normalizedPosition: 0.5,
    };
  }

  // Calculate normalized position (0 = worst, 1 = best)
  // Higher edge is better, so best edge gets position 1
  const normalizedPosition = (edgePercent - minEdge) / (maxEdge - minEdge);

  // Calculate the gradient color
  // Position 0-0.5: interpolate from red (worst) to yellow (middle)
  // Position 0.5-1: interpolate from yellow (middle) to green (best)
  let borderColor: string;
  if (normalizedPosition <= 0.5) {
    // Worst to middle: red to yellow
    const t = normalizedPosition * 2; // Scale 0-0.5 to 0-1
    borderColor = interpolateColor(COLOR_WORST, COLOR_MIDDLE, t);
  } else {
    // Middle to best: yellow to green
    const t = (normalizedPosition - 0.5) * 2; // Scale 0.5-1 to 0-1
    borderColor = interpolateColor(COLOR_MIDDLE, COLOR_BEST, t);
  }

  return {
    borderColor,
    backgroundColor: hexToRgba(borderColor, BG_OPACITY),
    className: getClassName(normalizedPosition),
    normalizedPosition,
  };
}

/**
 * Calculate edge gradient results for all horses in a field
 * This is the main function to call from Dashboard.tsx
 *
 * @param horseEdgeData - Array of { index, edgePercent, isScratched } for each horse
 * @returns Map from horse index to EdgeGradientResult
 */
export function calculateFieldEdgeGradients(
  horseEdgeData: Array<{ index: number; edgePercent: number; isScratched: boolean }>
): Map<number, EdgeGradientResult> {
  // Collect edge percentages for unscratched horses only
  const unscratchedEdges = horseEdgeData
    .filter(h => !h.isScratched)
    .map(h => h.edgePercent);

  // Calculate gradient for each horse
  const results = new Map<number, EdgeGradientResult>();

  for (const horse of horseEdgeData) {
    const gradient = calculateEdgeGradient(
      horse.edgePercent,
      unscratchedEdges,
      horse.isScratched
    );
    results.set(horse.index, gradient);
  }

  return results;
}
