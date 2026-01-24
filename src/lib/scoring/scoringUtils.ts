/**
 * Scoring Utility Functions
 *
 * Defensive coding helpers for the scoring system.
 * These functions ensure robust handling of edge cases:
 * - Division by zero protection
 * - NaN/Infinity handling
 * - Score boundary enforcement
 * - Type coercion safety
 *
 * @module scoring/scoringUtils
 */

// ============================================================================
// SCORE BOUNDARY CONSTANTS
// ============================================================================

/** Minimum possible final score (floor) */
export const MIN_SCORE = 0;

/**
 * Maximum base score before overlay
 * Audit-verified: 331 points (matches index.ts and ALGORITHM_REFERENCE.md)
 */
export const MAX_BASE_SCORE = 331;

/**
 * Maximum overlay adjustment
 * PHASE 5: Reduced from 50 to 40 to prevent pace overlay from destroying favorites
 */
export const MAX_OVERLAY_POSITIVE = 40;

/**
 * Minimum overlay adjustment
 * PHASE 5: Reduced from -50 to -40
 */
export const MIN_OVERLAY_NEGATIVE = -40;

/** Maximum protocol bonus */
export const MAX_PROTOCOL_BONUS = 60;

/** Maximum final score (base + overlay) */
export const MAX_FINAL_SCORE = MAX_BASE_SCORE + MAX_OVERLAY_POSITIVE; // 371

/** Maximum display score (for UI - uses base score) */
export const MAX_DISPLAY_SCORE = 331;

// Category maximums (Model B - Speed-Dominant Rebalance)
export const SCORE_CATEGORY_LIMITS = {
  connections: 23, // Model B: reduced from 27
  postPosition: 12, // 3.7% - v3.0: reduced from 20
  speedClass: 140, // Model B: Speed 105 + Class 35
  form: 42, // Model B: reduced from 50
  equipment: 8, // 2.4% - v3.0: reduced from 12
  pace: 35, // Model B: reduced from 45
  odds: 12, // Model B: reduced from 15
  breeding: 15,
  classHiddenDrops: 10,
  trainerPatterns: 8, // Model B: reduced from 10
  comboPatterns: 4, // 1.2% - v3.0: reduced from 6
} as const;

// ============================================================================
// DEFENSIVE MATH HELPERS
// ============================================================================

/**
 * Safe division that handles zero divisor and invalid results
 *
 * @param numerator - The number to divide
 * @param denominator - The divisor
 * @param fallback - Value to return if division is invalid (default 0)
 * @returns The division result or fallback value
 *
 * @example
 * safeDivide(10, 2)     // 5
 * safeDivide(10, 0)     // 0 (fallback)
 * safeDivide(10, 0, -1) // -1 (custom fallback)
 */
export function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  // Handle zero divisor
  if (denominator === 0) {
    return fallback;
  }

  const result = numerator / denominator;

  // Handle NaN or Infinity results
  if (!Number.isFinite(result)) {
    return fallback;
  }

  return result;
}

/**
 * Safely coerce a value to a number with fallback
 *
 * @param value - The value to convert to number
 * @param fallback - Value to return if conversion fails (default 0)
 * @returns A valid finite number or the fallback
 *
 * @example
 * safeNumber(42)          // 42
 * safeNumber("42")        // 42
 * safeNumber(null)        // 0
 * safeNumber(undefined)   // 0
 * safeNumber(NaN)         // 0
 * safeNumber(Infinity)    // 0
 * safeNumber("invalid")   // 0
 * safeNumber(null, -1)    // -1 (custom fallback)
 */
export function safeNumber(value: unknown, fallback: number = 0): number {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return fallback;
  }

  // Convert to number
  const num = typeof value === 'number' ? value : Number(value);

  // Return fallback if not finite
  if (!Number.isFinite(num)) {
    return fallback;
  }

  return num;
}

/**
 * Clamp a number between min and max bounds
 *
 * @param value - The number to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns The clamped value
 *
 * @example
 * clamp(150, 0, 100)  // 100
 * clamp(-10, 0, 100)  // 0
 * clamp(50, 0, 100)   // 50
 */
export function clamp(value: number, min: number, max: number): number {
  // Handle NaN by returning min
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

/**
 * Round a number to specified decimal places
 *
 * @param value - The number to round
 * @param decimals - Number of decimal places (default 0 for integer)
 * @returns The rounded number
 *
 * @example
 * safeRound(150.6)      // 151
 * safeRound(150.4)      // 150
 * safeRound(150.456, 2) // 150.46
 */
export function safeRound(value: number, decimals: number = 0): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

// ============================================================================
// SCORE VALIDATION
// ============================================================================

/**
 * Check if a score is valid (finite number within possible range)
 *
 * @param score - The score to validate
 * @returns true if valid, false otherwise
 */
export function isValidScore(score: unknown): score is number {
  if (typeof score !== 'number') return false;
  if (!Number.isFinite(score)) return false;
  // Allow slightly beyond theoretical bounds for calculation intermediates
  if (score < -100 || score > 400) return false;
  return true;
}

/**
 * Check if a category score is valid and within bounds
 *
 * @param score - The score to validate
 * @param maxValue - Maximum allowed value for this category
 * @returns true if valid
 */
export function isValidCategoryScore(score: unknown, maxValue: number): score is number {
  if (!isValidScore(score)) return false;
  return score >= 0 && score <= maxValue;
}

// ============================================================================
// CIRCUIT BREAKER PENALTIES
// ============================================================================

/**
 * Paper Tiger Circuit Breaker Penalty (v3.3 - With Winner Protection)
 *
 * Identifies horses with Elite Speed Figures but Zero Form and Mediocre Pace.
 * These "Paper Tigers" look good on paper but lack current fitness and
 * tactical advantage to convert their speed into wins.
 *
 * v3.3 CHANGES:
 * - Added hasRecentWin protection: horses that won in last 3 races are immune
 * - Kept original narrow thresholds to avoid over-penalizing
 *
 * @param speedScore - The horse's speed score (0-105 in Model B)
 * @param formScore - The horse's form score (0-55 in v3.3)
 * @param paceScore - The horse's pace score (0-35 in Model B)
 * @param hasRecentWin - Optional: whether horse won in last 3 races (protects winners)
 * @returns -100 if Paper Tiger conditions met, 0 otherwise
 *
 * CONDITIONS FOR PENALTY:
 * - speedScore > 120 (Elite Ability - very high speed figures)
 * - formScore < 10 (Critical/Negligible Form - low form score)
 * - paceScore < 30 (Lacks Dominant Running Style - no elite tactical edge)
 * - hasRecentWin = false (not protected by recent wins)
 *
 * SAFETY CHECK ("Tessuto Rule"):
 * - If paceScore >= 30, NO penalty applied even with low form
 * - This protects ELITE wire-to-wire threats like Tessuto
 *
 * @example
 * // Paper Tiger: Fast historical speed, no form, no pace advantage
 * calculatePaperTigerPenalty(125, 5, 20) // -100
 *
 * // Protected by recent win
 * calculatePaperTigerPenalty(125, 5, 20, true) // 0 (winner protection)
 *
 * // Tessuto Rule: Elite wire-to-wire threat off layoff (high pace protects)
 * calculatePaperTigerPenalty(130, 0, 32) // 0 (protected by elite pace)
 *
 * // Normal horse: Good speed with decent form
 * calculatePaperTigerPenalty(130, 10, 20) // 0 (form >= 10 is acceptable)
 */
export function calculatePaperTigerPenalty(
  speedScore: number,
  formScore: number,
  paceScore: number,
  hasRecentWin: boolean = false
): number {
  // Safety check: Recent winners are protected from Paper Tiger penalty
  // If you won recently, you're not a Paper Tiger
  if (hasRecentWin) {
    return 0;
  }

  // Safety check: "Tessuto Rule" - Elite pace protects even with low form
  // Only DOMINANT wire-to-wire threats (pace >= 30) can steal races off layoffs
  if (paceScore >= 30) {
    return 0;
  }

  // Paper Tiger conditions (v3.2 thresholds - documented in test file):
  // 1. Elite Speed (> 120) - Horse has very high speed figures
  // 2. Critical/Negligible Form (< 10) - Low form score (catches negligible form, not just zero)
  // 3. Non-Elite Pace (< 30) - No dominant running style advantage
  if (speedScore > 120 && formScore < 10 && paceScore < 30) {
    return -100;
  }

  return 0;
}

// ============================================================================
// SCORE BOUNDARY ENFORCEMENT
// ============================================================================

/**
 * Enforce score boundaries on a final score
 *
 * Ensures:
 * - Score is a valid finite number
 * - Score is floored at MIN_SCORE (0)
 * - Score is capped at MAX_FINAL_SCORE (368)
 * - Score is rounded to integer
 *
 * @param score - The raw score to enforce bounds on
 * @returns Bounded integer score
 */
export function enforceScoreBoundaries(score: number): number {
  // Handle invalid input
  if (!Number.isFinite(score)) {
    return MIN_SCORE;
  }

  // Clamp to valid range and round
  return safeRound(clamp(score, MIN_SCORE, MAX_FINAL_SCORE));
}

/**
 * Enforce base score boundaries (before overlay)
 *
 * @param score - The raw base score
 * @returns Bounded base score (0 to MAX_BASE_SCORE)
 */
export function enforceBaseScoreBoundaries(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return safeRound(clamp(score, 0, MAX_BASE_SCORE));
}

/**
 * Enforce overlay adjustment boundaries
 *
 * @param overlay - The raw overlay adjustment
 * @returns Bounded overlay (-40 to +40)
 */
export function enforceOverlayBoundaries(overlay: number): number {
  if (!Number.isFinite(overlay)) {
    return 0;
  }

  return safeRound(clamp(overlay, MIN_OVERLAY_NEGATIVE, MAX_OVERLAY_POSITIVE));
}

/**
 * Enforce protocol bonus boundaries
 *
 * @param bonus - The raw protocol bonus
 * @returns Bounded protocol bonus (0 to MAX_PROTOCOL_BONUS)
 */
export function enforceProtocolBoundaries(bonus: number): number {
  if (!Number.isFinite(bonus)) {
    return 0;
  }

  return safeRound(clamp(bonus, 0, MAX_PROTOCOL_BONUS));
}

/**
 * Enforce category score boundaries
 *
 * @param score - The raw category score
 * @param categoryMax - Maximum for this category
 * @returns Bounded category score
 */
export function enforceCategoryBoundaries(score: number, categoryMax: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return safeRound(clamp(score, 0, categoryMax));
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format score for display
 * Shows "331+" for scores exceeding display max
 *
 * @param score - The score to format
 * @returns Formatted score string
 */
export function formatDisplayScore(score: number): string {
  const bounded = enforceScoreBoundaries(score);

  if (bounded > MAX_DISPLAY_SCORE) {
    return `${MAX_DISPLAY_SCORE}+`;
  }

  return String(bounded);
}

/**
 * Format overlay score with sign
 *
 * @param overlay - The overlay value
 * @returns Formatted string with + or - prefix
 */
export function formatOverlay(overlay: number): string {
  const bounded = enforceOverlayBoundaries(overlay);

  if (bounded > 0) {
    return `+${bounded}`;
  }

  return String(bounded);
}

// ============================================================================
// WIN RATE CALCULATION
// ============================================================================

/**
 * Calculate win rate safely
 *
 * @param wins - Number of wins
 * @param starts - Total starts
 * @returns Win rate as percentage (0-100), or 0 if invalid
 */
export function calculateWinRate(wins: number, starts: number): number {
  const safeWins = safeNumber(wins);
  const safeStarts = safeNumber(starts);

  // No starts = 0 win rate
  if (safeStarts === 0) {
    return 0;
  }

  // Calculate rate and convert to percentage
  const rate = safeDivide(safeWins, safeStarts) * 100;

  // Clamp to valid range and round
  return safeRound(clamp(rate, 0, 100), 1);
}

/**
 * Calculate average safely
 *
 * @param values - Array of numbers to average
 * @returns Average or 0 if empty/invalid
 */
export function calculateSafeAverage(values: number[]): number {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  // Filter to valid numbers only
  const validValues = values.filter((v) => Number.isFinite(v));

  if (validValues.length === 0) {
    return 0;
  }

  const sum = validValues.reduce((acc, val) => acc + val, 0);
  return safeDivide(sum, validValues.length);
}

// ============================================================================
// NULL/UNDEFINED SAFE ACCESSORS
// ============================================================================

/**
 * Safely get a numeric property with fallback
 *
 * @param obj - Object to access
 * @param key - Property key
 * @param fallback - Fallback value (default 0)
 * @returns The value or fallback
 */
export function safeGet<T extends Record<string, unknown>>(
  obj: T | null | undefined,
  key: keyof T,
  fallback: number = 0
): number {
  if (obj === null || obj === undefined) {
    return fallback;
  }

  return safeNumber(obj[key], fallback);
}

/**
 * Safely access first element of an array
 *
 * @param arr - Array to access
 * @returns First element or undefined
 */
export function safeFirst<T>(arr: T[] | null | undefined): T | undefined {
  if (!Array.isArray(arr) || arr.length === 0) {
    return undefined;
  }

  return arr[0];
}

/**
 * Safely get array length
 *
 * @param arr - Array to measure
 * @returns Length or 0
 */
export function safeLength(arr: unknown[] | null | undefined): number {
  if (!Array.isArray(arr)) {
    return 0;
  }

  return arr.length;
}
