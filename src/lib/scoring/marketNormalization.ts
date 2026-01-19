/**
 * Market Probability Normalization Module
 *
 * Removes takeout/overround from odds-implied probabilities to enable
 * accurate overlay detection. Track odds include ~17% takeout (overround),
 * meaning implied probabilities from the tote sum to ~117%, not 100%.
 *
 * This module provides:
 * - Odds conversion (fractional, American, decimal)
 * - Implied probability calculation
 * - Overround calculation
 * - Market probability normalization
 *
 * @module scoring/marketNormalization
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Market configuration for normalization calculations
 *
 * These values are based on industry standards for US pari-mutuel racing.
 */
export const MARKET_CONFIG = {
  /** Default win pool takeout (~17% typical for US tracks) */
  defaultTakeout: 0.17,
  /** Minimum expected overround - below this, odds data may be suspect */
  minOverround: 1.1,
  /** Maximum expected overround - above this, odds data may be suspect */
  maxOverround: 1.35,
  /** Feature flag for using normalized overlay calculation */
  useNormalizedOverlay: true,
} as const;

/**
 * Type for market configuration (allows overrides)
 */
export type MarketConfigType = {
  defaultTakeout: number;
  minOverround: number;
  maxOverround: number;
  useNormalizedOverlay: boolean;
};

// ============================================================================
// ODDS CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert fractional odds to decimal odds.
 *
 * Formula: (numerator / denominator) + 1
 *
 * @param numerator - Top part of fraction (profit)
 * @param denominator - Bottom part of fraction (stake)
 * @returns Decimal odds
 *
 * @example
 * fractionalToDecimalOdds(5, 1)  // Returns 6.0 (5-1 odds)
 * fractionalToDecimalOdds(3, 2)  // Returns 2.5 (3-2 odds)
 * fractionalToDecimalOdds(1, 2)  // Returns 1.5 (1-2 odds)
 */
export function fractionalToDecimalOdds(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return 2.0; // Default to even money
  }

  if (denominator === 0) {
    return 2.0; // Prevent division by zero
  }

  return numerator / denominator + 1;
}

/**
 * Convert American (moneyline) odds to decimal odds.
 *
 * Positive odds (+150): decimal = 1 + (odds / 100)
 * Negative odds (-150): decimal = 1 + (100 / |odds|)
 *
 * @param americanOdds - American format odds (+150 or -150)
 * @returns Decimal odds
 *
 * @example
 * americanToDecimalOdds(150)   // Returns 2.5 (+150 → 2.5)
 * americanToDecimalOdds(-150)  // Returns 1.667 (-150 → 1.667)
 * americanToDecimalOdds(400)   // Returns 5.0 (+400 → 5.0)
 * americanToDecimalOdds(-200)  // Returns 1.5 (-200 → 1.5)
 */
export function americanToDecimalOdds(americanOdds: number): number {
  if (!Number.isFinite(americanOdds)) {
    return 2.0; // Default to even money
  }

  if (americanOdds >= 0) {
    // Positive (underdog): +150 → 1 + 150/100 = 2.5
    return 1 + americanOdds / 100;
  } else {
    // Negative (favorite): -150 → 1 + 100/150 = 1.667
    return 1 + 100 / Math.abs(americanOdds);
  }
}

/**
 * Convert decimal odds to fractional display string.
 *
 * @param decimalOdds - Decimal format odds
 * @returns Fractional string (e.g., "5-1", "3-2")
 */
export function decimalToFractional(decimalOdds: number): string {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1.0) {
    return 'EVEN';
  }

  const profit = decimalOdds - 1;

  // Common fractional odds lookup
  const commonOdds: [number, string][] = [
    [0.1, '1-10'],
    [0.2, '1-5'],
    [0.25, '1-4'],
    [0.33, '1-3'],
    [0.4, '2-5'],
    [0.5, '1-2'],
    [0.6, '3-5'],
    [0.667, '2-3'],
    [0.75, '3-4'],
    [0.8, '4-5'],
    [0.9, '9-10'],
    [1.0, 'EVEN'],
    [1.1, '11-10'],
    [1.2, '6-5'],
    [1.4, '7-5'],
    [1.5, '3-2'],
    [1.8, '9-5'],
    [2.0, '2-1'],
    [2.5, '5-2'],
    [3.0, '3-1'],
    [3.5, '7-2'],
    [4.0, '4-1'],
    [5.0, '5-1'],
    [6.0, '6-1'],
    [7.0, '7-1'],
    [8.0, '8-1'],
    [9.0, '9-1'],
    [10.0, '10-1'],
    [12.0, '12-1'],
    [15.0, '15-1'],
    [20.0, '20-1'],
    [30.0, '30-1'],
    [50.0, '50-1'],
    [99.0, '99-1'],
  ];

  // Find closest match
  let closest = 'EVEN';
  let minDiff = Infinity;

  for (const [value, display] of commonOdds) {
    const diff = Math.abs(profit - value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = display;
    }
  }

  return closest;
}

/**
 * Convert decimal odds to American (moneyline) format string.
 *
 * @param decimalOdds - Decimal format odds
 * @returns American format string (e.g., "+150", "-150")
 */
export function decimalToAmerican(decimalOdds: number): string {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1.0) {
    return 'EVEN';
  }

  if (decimalOdds >= 2.0) {
    // Underdog: positive moneyline
    const ml = Math.round((decimalOdds - 1) * 100);
    return `+${ml}`;
  } else {
    // Favorite: negative moneyline
    const ml = Math.round(-100 / (decimalOdds - 1));
    return `${ml}`;
  }
}

// ============================================================================
// IMPLIED PROBABILITY FUNCTIONS
// ============================================================================

/**
 * Calculate implied probability from decimal odds.
 *
 * Formula: impliedProb = 1 / decimalOdds
 *
 * Note: This is the RAW implied probability which includes takeout.
 * For normalized probability, use normalizeMarketProbabilities().
 *
 * @param decimalOdds - Decimal format odds (e.g., 3.0 for 2-1)
 * @returns Implied probability (0-1)
 *
 * @example
 * oddsToImpliedProbability(2.0)   // Returns 0.5 (50%)
 * oddsToImpliedProbability(4.0)   // Returns 0.25 (25%)
 * oddsToImpliedProbability(10.0)  // Returns 0.1 (10%)
 */
export function oddsToImpliedProbability(decimalOdds: number): number {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 0) {
    return 0;
  }

  // Clamp to reasonable odds range
  const clampedOdds = Math.max(1.01, Math.min(1000, decimalOdds));

  return 1 / clampedOdds;
}

/**
 * Calculate the overround (sum of implied probabilities).
 *
 * In a fair market, this would sum to 1.0 (100%).
 * With takeout, it typically sums to 1.15-1.25 (115%-125%).
 *
 * @param impliedProbs - Array of implied probabilities for each horse
 * @returns Overround (sum of implied probs, typically 1.15-1.25)
 *
 * @example
 * // Field with 17% takeout
 * calculateOverround([0.35, 0.25, 0.20, 0.15, 0.12, 0.10])
 * // Returns 1.17 (sum = 117%)
 */
export function calculateOverround(impliedProbs: number[]): number {
  if (!impliedProbs || impliedProbs.length === 0) {
    return 1.0;
  }

  const sum = impliedProbs.reduce((acc, prob) => {
    if (!Number.isFinite(prob)) return acc;
    return acc + prob;
  }, 0);

  return Math.round(sum * 1000) / 1000; // Round to 3 decimal places
}

/**
 * Calculate takeout percentage from overround.
 *
 * Formula: takeout% = (overround - 1) / overround × 100
 *
 * @param overround - Sum of implied probabilities (e.g., 1.17)
 * @returns Takeout percentage (e.g., 14.5 for 14.5%)
 *
 * @example
 * calculateTakeoutPercent(1.17)  // Returns 14.5 (~14.5% takeout)
 * calculateTakeoutPercent(1.20)  // Returns 16.7 (~16.7% takeout)
 * calculateTakeoutPercent(1.25)  // Returns 20.0 (20% takeout)
 */
export function calculateTakeoutPercent(overround: number): number {
  if (!Number.isFinite(overround) || overround <= 0) {
    return 0;
  }

  if (overround <= 1.0) {
    return 0; // No takeout (or negative book, which is unusual)
  }

  const takeout = ((overround - 1) / overround) * 100;
  return Math.round(takeout * 10) / 10; // Round to 1 decimal place
}

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Normalize implied probabilities to remove overround/takeout.
 *
 * Divides each probability by the sum to make them sum to 1.0.
 * This removes the built-in house edge from the odds.
 *
 * @param impliedProbs - Array of raw implied probabilities (from odds)
 * @returns Array of normalized probabilities (sum to 1.0)
 *
 * @example
 * // Field with 17% overround
 * const raw = [0.35, 0.25, 0.20, 0.15, 0.12, 0.10];  // sum = 1.17
 * normalizeMarketProbabilities(raw);
 * // Returns [0.299, 0.214, 0.171, 0.128, 0.103, 0.085]  // sum = 1.0
 */
export function normalizeMarketProbabilities(impliedProbs: number[]): number[] {
  if (!impliedProbs || impliedProbs.length === 0) {
    return [];
  }

  // Calculate overround (sum of implied probs)
  const overround = calculateOverround(impliedProbs);

  // If overround is zero or invalid, return equal probabilities
  if (overround <= 0) {
    const equalProb = 1 / impliedProbs.length;
    return impliedProbs.map(() => equalProb);
  }

  // Normalize by dividing each by the overround
  return impliedProbs.map((prob) => {
    if (!Number.isFinite(prob)) return 0;
    return prob / overround;
  });
}

/**
 * Convert decimal odds array to normalized probabilities.
 *
 * Combines odds→implied→normalized in one step.
 *
 * @param decimalOddsArray - Array of decimal odds for each horse
 * @returns Array of normalized probabilities (sum to 1.0)
 */
export function oddsArrayToNormalizedProbabilities(decimalOddsArray: number[]): number[] {
  // Convert odds to implied probabilities
  const impliedProbs = decimalOddsArray.map(oddsToImpliedProbability);

  // Normalize to remove overround
  return normalizeMarketProbabilities(impliedProbs);
}

// ============================================================================
// BATCH CONVERSION FUNCTIONS
// ============================================================================

/**
 * Result from normalizing field odds
 */
export interface NormalizedFieldResult {
  /** Normalized probability (sums to 1.0 across field) */
  normalizedProb: number;
  /** Raw implied probability from odds */
  impliedProb: number;
  /** Field overround (typically 1.15-1.25) */
  overround: number;
  /** Takeout percentage */
  takeoutPercent: number;
}

/**
 * Normalize odds for an entire field of horses.
 *
 * Returns both raw implied and normalized probabilities for each horse,
 * plus the calculated overround.
 *
 * @param horses - Array of horses with decimal odds
 * @returns Array of results with normalized and implied probabilities
 *
 * @example
 * const field = [
 *   { odds: 3.0 },  // 2-1
 *   { odds: 4.0 },  // 3-1
 *   { odds: 6.0 },  // 5-1
 *   { odds: 9.0 },  // 8-1
 * ];
 * const results = normalizeFieldOdds(field);
 * // Returns: [
 * //   { normalizedProb: 0.385, impliedProb: 0.333, overround: 1.167 },
 * //   { normalizedProb: 0.288, impliedProb: 0.250, overround: 1.167 },
 * //   { normalizedProb: 0.192, impliedProb: 0.167, overround: 1.167 },
 * //   { normalizedProb: 0.128, impliedProb: 0.111, overround: 1.167 },
 * // ]
 */
export function normalizeFieldOdds(horses: { odds: number }[]): NormalizedFieldResult[] {
  if (!horses || horses.length === 0) {
    return [];
  }

  // Extract odds and calculate implied probabilities
  const decimalOdds = horses.map((h) => h.odds);
  const impliedProbs = decimalOdds.map(oddsToImpliedProbability);

  // Calculate overround and takeout
  const overround = calculateOverround(impliedProbs);
  const takeoutPercent = calculateTakeoutPercent(overround);

  // Normalize probabilities
  const normalizedProbs = normalizeMarketProbabilities(impliedProbs);

  // Combine results
  return horses.map((_, index) => ({
    normalizedProb: normalizedProbs[index] ?? 0,
    impliedProb: impliedProbs[index] ?? 0,
    overround,
    takeoutPercent,
  }));
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate that odds data appears reasonable.
 *
 * Checks:
 * - Overround is within expected range (1.10 to 1.35)
 * - All odds are positive and finite
 * - Field has at least 2 horses
 *
 * @param decimalOddsArray - Array of decimal odds
 * @returns Validation result with status and any warnings
 */
export function validateMarketOdds(decimalOddsArray: number[]): {
  isValid: boolean;
  overround: number;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check minimum field size
  if (!decimalOddsArray || decimalOddsArray.length < 2) {
    return {
      isValid: false,
      overround: 0,
      warnings: ['Insufficient field size - need at least 2 horses'],
    };
  }

  // Check for invalid odds values
  const invalidOdds = decimalOddsArray.filter((o) => !Number.isFinite(o) || o < 1.01);
  if (invalidOdds.length > 0) {
    warnings.push(`Found ${invalidOdds.length} invalid odds values`);
  }

  // Calculate overround
  const impliedProbs = decimalOddsArray.map(oddsToImpliedProbability);
  const overround = calculateOverround(impliedProbs);

  // Check overround bounds
  if (overround < MARKET_CONFIG.minOverround) {
    warnings.push(
      `Overround ${overround.toFixed(3)} is below minimum ${MARKET_CONFIG.minOverround} - odds data may be suspect`
    );
  }

  if (overround > MARKET_CONFIG.maxOverround) {
    warnings.push(
      `Overround ${overround.toFixed(3)} is above maximum ${MARKET_CONFIG.maxOverround} - unusual market conditions`
    );
  }

  return {
    isValid: warnings.length === 0,
    overround,
    warnings,
  };
}

// ============================================================================
// MORNING LINE VS TOTE ODDS
// ============================================================================

/**
 * Odds source type for tracking whether odds are estimates or live
 */
export type OddsSource = 'morning_line' | 'tote' | 'unknown';

/**
 * Structure for odds with source information
 */
export interface OddsWithSource {
  /** Decimal odds value */
  decimalOdds: number;
  /** Source of the odds (morning line or tote) */
  source: OddsSource;
  /** Timestamp when odds were captured (for tote) */
  timestamp?: Date;
}

/**
 * Convert morning line odds string to decimal.
 *
 * Morning line odds are the track's pre-race estimates,
 * typically published in the racing form.
 *
 * @param morningLine - Morning line string (e.g., "5-1", "3-2")
 * @returns OddsWithSource with decimal odds and source
 */
export function parseMorningLineOdds(morningLine: string): OddsWithSource {
  // Remove whitespace
  const cleaned = morningLine.trim().toUpperCase();

  // Handle "EVEN" or "EVN"
  if (cleaned === 'EVEN' || cleaned === 'EVN') {
    return { decimalOdds: 2.0, source: 'morning_line' };
  }

  // Try to parse as fractional (X-Y or X/Y)
  const fractionMatch = cleaned.match(/^(\d+(?:\.\d+)?)[/-](\d+(?:\.\d+)?)$/);
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1] ?? '0');
    const denom = parseFloat(fractionMatch[2] ?? '1');
    return {
      decimalOdds: fractionalToDecimalOdds(num, denom),
      source: 'morning_line',
    };
  }

  // Try to parse as plain number (assume X-1)
  const numMatch = cleaned.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1] ?? '1');
    return {
      decimalOdds: num + 1,
      source: 'morning_line',
    };
  }

  // Default to even money if parsing fails
  return { decimalOdds: 2.0, source: 'morning_line' };
}

/**
 * Convert tote (live betting pool) odds to decimal.
 *
 * Tote odds are the actual odds from the pari-mutuel pool,
 * updated in real-time as bets are placed.
 *
 * @param toteOdds - Tote odds string
 * @param timestamp - When the odds were captured
 * @returns OddsWithSource with decimal odds and source
 */
export function parseToteOdds(toteOdds: string, timestamp?: Date): OddsWithSource {
  // Same parsing logic as morning line
  const parsed = parseMorningLineOdds(toteOdds);

  return {
    decimalOdds: parsed.decimalOdds,
    source: 'tote',
    timestamp,
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get current market configuration
 */
export function getMarketConfig(): MarketConfigType {
  return { ...MARKET_CONFIG };
}

/**
 * Create a market config with custom values
 */
export function createMarketConfig(overrides: Partial<MarketConfigType>): MarketConfigType {
  return {
    ...MARKET_CONFIG,
    ...overrides,
  };
}
