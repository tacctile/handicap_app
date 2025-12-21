/**
 * Shared Confidence Utilities
 *
 * Used by:
 * - RaceOverview.tsx (confidence badges for each race)
 * - CalculationStatus.tsx (confidence display in race detail)
 * - RaceTable.tsx (race confidence calculation)
 *
 * Confidence is calculated based on:
 * - Data quality of horses in the race
 * - Score separation between top picks
 * - Quality of the top-scoring horse
 */

/**
 * Confidence thresholds for color coding
 */
export const CONFIDENCE_THRESHOLDS = {
  veryHigh: 80,
  high: 65,
  moderate: 50,
  low: 35,
} as const;

/**
 * Get the color for a confidence level
 * Uses design system colors:
 * - #36d1da (elite/very high)
 * - #19abb5 (primary/high)
 * - #f59e0b (warning/moderate-low)
 * - #888888 (muted/very low)
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= CONFIDENCE_THRESHOLDS.veryHigh) return '#36d1da';
  if (confidence >= CONFIDENCE_THRESHOLDS.moderate) return '#19abb5';
  if (confidence >= CONFIDENCE_THRESHOLDS.low) return '#f59e0b';
  return '#888888';
}

/**
 * Get the label for a confidence level
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= CONFIDENCE_THRESHOLDS.veryHigh) return 'Very High';
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'High';
  if (confidence >= CONFIDENCE_THRESHOLDS.moderate) return 'Moderate';
  if (confidence >= CONFIDENCE_THRESHOLDS.low) return 'Low';
  return 'Very Low';
}

/**
 * Get both color and label for a confidence level
 */
export function getConfidenceDisplay(confidence: number): {
  color: string;
  label: string;
} {
  return {
    color: getConfidenceColor(confidence),
    label: getConfidenceLabel(confidence),
  };
}

/**
 * Get a short label for compact displays
 */
export function getConfidenceLabelShort(confidence: number): string {
  if (confidence >= CONFIDENCE_THRESHOLDS.veryHigh) return 'V.High';
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'High';
  if (confidence >= CONFIDENCE_THRESHOLDS.moderate) return 'Med';
  if (confidence >= CONFIDENCE_THRESHOLDS.low) return 'Low';
  return 'V.Low';
}

/**
 * Get the background color for confidence badges (with transparency)
 */
export function getConfidenceBgColor(confidence: number): string {
  const baseColor = getConfidenceColor(confidence);
  return `${baseColor}20`; // 20% opacity
}

/**
 * Get the border color for confidence badges
 */
export function getConfidenceBorderColor(confidence: number): string {
  const baseColor = getConfidenceColor(confidence);
  return `${baseColor}40`; // 40% opacity
}
