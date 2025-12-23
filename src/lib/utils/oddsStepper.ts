/**
 * Odds Stepper Utility
 * Provides functions to increment/decrement odds in standard racing odds sequence
 */

// Standard racing odds sequence from lowest to highest
export const ODDS_SEQUENCE = [
  '1-9',
  '1-5',
  '2-5',
  '1-2',
  '3-5',
  '4-5',
  '1-1',
  '6-5',
  '7-5',
  '3-2',
  '8-5',
  '9-5',
  '2-1',
  '5-2',
  '3-1',
  '7-2',
  '4-1',
  '9-2',
  '5-1',
  '6-1',
  '7-1',
  '8-1',
  '9-1',
  '10-1',
  '12-1',
  '15-1',
  '20-1',
  '25-1',
  '30-1',
  '50-1',
  '99-1',
] as const;

/**
 * Parse odds string to decimal value for comparison
 * e.g., "5-1" -> 5.0, "3-2" -> 1.5, "1-2" -> 0.5
 */
export function oddsToDecimal(odds: string): number {
  const normalized = odds.trim().replace(/\s+/g, '');
  const match = normalized.match(/^(\d+)-(\d+)$/);
  if (!match || !match[1] || !match[2]) {
    // Try to parse as a number (e.g., "5" means "5-1")
    const num = parseFloat(normalized);
    return isNaN(num) ? 5 : num;
  }
  return parseInt(match[1], 10) / parseInt(match[2], 10);
}

/**
 * Find the closest odds in sequence to the given odds string
 */
export function findClosestOddsIndex(odds: string): number {
  const targetDecimal = oddsToDecimal(odds);

  let closestIndex = 0;
  let closestDiff = Infinity;

  for (let i = 0; i < ODDS_SEQUENCE.length; i++) {
    const oddsValue = ODDS_SEQUENCE[i];
    if (!oddsValue) continue;
    const seqDecimal = oddsToDecimal(oddsValue);
    const diff = Math.abs(seqDecimal - targetDecimal);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = i;
    }
  }

  return closestIndex;
}

/**
 * Get the next higher odds in the sequence
 * Returns the same odds if already at maximum
 */
export function incrementOdds(currentOdds: string): string {
  const currentIndex = findClosestOddsIndex(currentOdds);
  const nextIndex = Math.min(currentIndex + 1, ODDS_SEQUENCE.length - 1);
  return ODDS_SEQUENCE[nextIndex] ?? currentOdds;
}

/**
 * Get the next lower odds in the sequence
 * Returns the same odds if already at minimum
 */
export function decrementOdds(currentOdds: string): string {
  const currentIndex = findClosestOddsIndex(currentOdds);
  const prevIndex = Math.max(currentIndex - 1, 0);
  return ODDS_SEQUENCE[prevIndex] ?? currentOdds;
}

/**
 * Check if odds can be incremented (not at max)
 */
export function canIncrementOdds(currentOdds: string): boolean {
  const currentIndex = findClosestOddsIndex(currentOdds);
  return currentIndex < ODDS_SEQUENCE.length - 1;
}

/**
 * Check if odds can be decremented (not at min)
 */
export function canDecrementOdds(currentOdds: string): boolean {
  const currentIndex = findClosestOddsIndex(currentOdds);
  return currentIndex > 0;
}

/**
 * Normalize an odds string to match sequence format
 * e.g., "5/1" -> "5-1", "3:2" -> "3-2"
 */
export function normalizeOddsFormat(odds: string): string {
  const normalized = odds.trim().replace(/[/:]/g, '-').replace(/\s+/g, '');
  // If it's just a number, append -1
  if (/^\d+$/.test(normalized)) {
    return `${normalized}-1`;
  }
  return normalized;
}
