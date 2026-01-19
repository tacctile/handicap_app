/**
 * Overlay Detection and Expected Value (EV) Calculations
 *
 * This module provides comprehensive value betting analysis:
 * - Score to win probability conversion (using softmax)
 * - Fair odds calculation from win probability
 * - Overlay/underlay detection and classification
 * - Expected Value (EV) calculations
 * - Value classification for betting decisions
 * - Market probability normalization (removes takeout/overround)
 *
 * This is the foundation for Kelly Criterion betting (Phase 3).
 *
 * NOTE: As of v3.7, probability conversion uses softmax function
 * instead of linear division for better probability coherence.
 *
 * NOTE: As of v3.8, market probability normalization removes ~17% takeout
 * from odds-implied probabilities for accurate overlay detection.
 */

import {
  softmaxProbabilities,
  probabilityToFairOdds as softmaxProbabilityToFairOdds,
  SOFTMAX_CONFIG,
} from './probabilityConversion';

import {
  MARKET_CONFIG,
  oddsToImpliedProbability,
  normalizeMarketProbabilities,
  calculateOverround,
} from './marketNormalization';

import { parseOddsString } from './oddsParser';

// Re-export SOFTMAX_CONFIG for external configuration access
export { SOFTMAX_CONFIG } from './probabilityConversion';

// Re-export MARKET_CONFIG for external configuration access
export { MARKET_CONFIG } from './marketNormalization';

// ============================================================================
// TYPES
// ============================================================================

export interface OverlayAnalysis {
  /** Fair odds based on score (decimal format, e.g., 4.0 = 3/1) */
  fairOddsDecimal: number;
  /** Fair odds in traditional format (e.g., "3-1") */
  fairOddsDisplay: string;
  /** Fair odds as moneyline (e.g., +300 or -150) */
  fairOddsMoneyline: string;
  /** Win probability from score (0-100%) */
  winProbability: number;
  /** Actual odds decimal */
  actualOddsDecimal: number;
  /** Overlay percentage (positive = value, negative = underlay) */
  overlayPercent: number;
  /** Value classification */
  valueClass: ValueClassification;
  /** Expected value per dollar wagered */
  evPerDollar: number;
  /** EV as percentage */
  evPercent: number;
  /** Whether this is a positive EV bet */
  isPositiveEV: boolean;
  /** Human-readable overlay description */
  overlayDescription: string;
  /** Betting recommendation based on value */
  recommendation: BettingRecommendation;

  // New fields for normalized overlay (v3.8)
  /** Normalized market probability (with takeout removed, sums to 1.0) */
  normalizedMarketProb?: number;
  /** Raw implied probability from odds (includes takeout) */
  rawImpliedProb?: number;
  /** Field overround (sum of implied probs, typically 1.15-1.25) */
  overround?: number;
  /** True overlay using normalized market prob (new primary metric) */
  trueOverlayPercent?: number;
  /** Raw overlay using implied prob (old method, kept for comparison) */
  rawOverlayPercent?: number;
  /** Value classification based on normalized overlay */
  valueClassification?: NormalizedValueClass;
}

export type ValueClassification =
  | 'massive_overlay' // 150%+ overlay - bet immediately
  | 'strong_overlay' // 50-149% overlay - excellent value
  | 'moderate_overlay' // 25-49% overlay - good value
  | 'slight_overlay' // 10-24% overlay - playable
  | 'fair_price' // -10% to +9% - no edge
  | 'underlay'; // <-10% - avoid

/**
 * Normalized value classification (with takeout removed)
 *
 * Thresholds are tighter because we've removed the ~17% vig inflation.
 * These map to the same semantic categories as ValueClassification
 * but use different numeric thresholds.
 */
export type NormalizedValueClass =
  | 'STRONG_VALUE' // 15%+ true overlay - strong betting opportunity
  | 'MODERATE_VALUE' // 8-14% true overlay - good value
  | 'SLIGHT_VALUE' // 3-7% true overlay - playable
  | 'NEUTRAL' // -3% to +2% - fair price
  | 'UNDERLAY'; // < -3% - avoid

export interface BettingRecommendation {
  action: 'bet_heavily' | 'bet_standard' | 'bet_small' | 'pass' | 'avoid';
  reasoning: string;
  suggestedMultiplier: number; // For Kelly Criterion (1.0 = standard unit)
  urgency: 'immediate' | 'standard' | 'low' | 'none';
}

export interface ValuePlay {
  horseIndex: number;
  horseName: string;
  programNumber: number;
  score: number;
  overlayPercent: number;
  valueClass: ValueClassification;
  evPerDollar: number;
  fairOddsDisplay: string;
  actualOddsDisplay: string;
  recommendation: BettingRecommendation;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Value classification thresholds
 *
 * Updated for clearer overlay/underlay/fair classification:
 * - Overlay: Actual odds > Fair odds by 20%+ (value bet)
 * - Fair: Within ±20% of fair odds (neutral)
 * - Underlay: Actual odds < Fair odds by 20%+ (bad bet)
 */
export const VALUE_THRESHOLDS = {
  massiveOverlay: 100, // 100%+ overlay - exceptional value
  strongOverlay: 40, // 40-99% overlay - good value
  moderateOverlay: 20, // 20-39% overlay - slight value (OVERLAY threshold)
  slightOverlay: 10, // 10-19% overlay - marginal edge
  fairPrice: -20, // -20% to +19% is FAIR (within tolerance)
  // Below -20% is UNDERLAY (bad value)
} as const;

/**
 * Normalized value thresholds (with takeout removed)
 *
 * With normalized overlay, thresholds are tighter because we've
 * removed the ~17% vig inflation from the market probabilities.
 *
 * Old (raw) → New (normalized):
 * - Strong: 20% → 15%
 * - Moderate: 10% → 8%
 * - Slight: 5% → 3%
 */
export const NORMALIZED_VALUE_THRESHOLDS = {
  strongOverlay: 15, // 15%+ true overlay - strong betting opportunity
  moderateOverlay: 8, // 8-14% true overlay - good value
  slightOverlay: 3, // 3-7% true overlay - playable
  neutralMin: -3, // -3% to +2% - fair price
  neutralMax: 3, // upper bound of neutral zone
  // Below -3% is UNDERLAY (avoid)
} as const;

/**
 * Score threshold for underlay penalty waiver
 *
 * Horses with base scores >= this threshold will NOT receive underlay
 * penalties. Rationale: Horses with 160+ base score have demonstrated
 * ability through Speed/Class, Form, Pace, etc. The market recognizing
 * this (low odds) should not penalize proven performers. Underlay penalty
 * only applies to horses where the public may be overvaluing weak fundamentals.
 *
 * This prevents circular logic: good horse → public bets → low odds → penalty → ranks lower
 */
export const UNDERLAY_PENALTY_THRESHOLD = 160;

/** Colors for value classification display */
export const VALUE_COLORS: Record<ValueClassification, string> = {
  massive_overlay: '#22c55e', // Bright green
  strong_overlay: '#4ade80', // Green
  moderate_overlay: '#86efac', // Light green
  slight_overlay: '#bbf7d0', // Very light green
  fair_price: '#9ca3af', // Gray
  underlay: '#ef4444', // Red
};

/** Icons for value classification */
export const VALUE_ICONS: Record<ValueClassification, string> = {
  massive_overlay: 'rocket_launch',
  strong_overlay: 'trending_up',
  moderate_overlay: 'thumb_up',
  slight_overlay: 'check_circle',
  fair_price: 'horizontal_rule',
  underlay: 'do_not_disturb',
};

/**
 * Labels for value classification
 * - Overlay: Actual odds > Fair odds by 20%+ (value bet)
 * - Fair: Within ±20% (neutral)
 * - Underlay: Actual odds < Fair odds by 20%+ (bad bet)
 */
export const VALUE_LABELS: Record<ValueClassification, string> = {
  massive_overlay: 'Strong Overlay', // 100%+ overlay
  strong_overlay: 'Overlay', // 40-99% overlay
  moderate_overlay: 'Overlay', // 20-39% overlay (meets threshold)
  slight_overlay: 'Fair', // 10-19% (within tolerance)
  fair_price: 'Fair', // -20% to +9% (within tolerance)
  underlay: 'Underlay', // < -20% (bad value)
};

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

/**
 * Calculate field-relative win probability using softmax
 *
 * UPDATED (v3.7): Now uses softmax for better probability coherence.
 *
 * Softmax provides:
 * - Probabilities that naturally sum to 1.0
 * - Smoother probability distributions
 * - Better handling of score outliers (extreme favorites/longshots)
 * - Configurable temperature for probability spread tuning
 *
 * The softmax formula (with numerical stability):
 * P(i) = e^((score_i - max_score) / temperature) / Σ e^((score_j - max_score) / temperature)
 *
 * Example (6-horse field with temperature=1.0):
 * Scores: [250, 230, 200, 190, 170, 160]
 * Softmax produces probabilities that sum to 100% with larger
 * gaps between high/low scorers than linear division.
 *
 * @param horseBaseScore - This horse's base score (0-328)
 * @param allFieldBaseScores - Array of all non-scratched horses' base scores
 * @param temperature - Optional temperature parameter (default from SOFTMAX_CONFIG)
 * @returns Win probability as percentage (0-100)
 */
export function calculateFieldRelativeWinProbability(
  horseBaseScore: number,
  allFieldBaseScores: number[],
  temperature: number = SOFTMAX_CONFIG.temperature
): number {
  // Handle invalid inputs
  if (!Number.isFinite(horseBaseScore) || horseBaseScore <= 0) return 2;
  if (!allFieldBaseScores || allFieldBaseScores.length === 0) return 2;

  // Find this horse's index in the field
  const index = allFieldBaseScores.indexOf(horseBaseScore);

  // If horse not in field array, calculate with extended field
  const scoresToUse = index >= 0 ? allFieldBaseScores : [...allFieldBaseScores, horseBaseScore];
  const scoreIndex = index >= 0 ? index : scoresToUse.length - 1;

  // Calculate softmax probabilities for entire field
  const probabilities = softmaxProbabilities(scoresToUse, temperature);

  // Get this horse's probability
  const probability = probabilities[scoreIndex];

  // Handle edge cases
  if (probability === undefined || !Number.isFinite(probability)) {
    return 2; // Minimum probability fallback
  }

  // Convert to percentage
  const winProbability = probability * 100;

  // Clamp to realistic bounds (2% to 85%)
  // Post-softmax safety clamp for display consistency
  return Math.max(2, Math.min(85, winProbability));
}

/**
 * Convert a score (0-323 range) to win probability
 * LEGACY FUNCTION - use calculateFieldRelativeWinProbability for accurate results
 *
 * This standalone formula is only used when field context is not available.
 * It's less accurate because it doesn't account for field strength.
 *
 * Updated formula for 323-point scale:
 * Win% = (Score / 323) × 50% (normalized to reasonable range)
 * Clamped between 2% and 50% for standalone calculations
 */
export function scoreToWinProbability(score: number): number {
  // Handle NaN or invalid input
  if (!Number.isFinite(score)) return 2; // Return minimum probability

  // For standalone calculations without field context,
  // use a conservative formula that doesn't over-inflate probabilities
  // Score of 323 → 50%, Score of 162 → 25%, Score of 81 → 12.5%
  const rawProbability = (score / 323) * 50;

  // Clamp to realistic bounds (2% to 50%)
  // Without field context, cap at 50% to avoid unrealistic probabilities
  return Math.max(2, Math.min(50, rawProbability));
}

/**
 * Convert win probability to fair decimal odds
 * Formula: Fair Odds = 1 / Win Probability (as decimal)
 *
 * NOTE: This function takes probability as percentage (0-100).
 * For probability as decimal (0-1), use probabilityToFairOdds from
 * probabilityConversion module.
 *
 * Examples:
 * - 50% probability → 2.0 (even money, 1-1)
 * - 25% probability → 4.0 (3-1)
 * - 20% probability → 5.0 (4-1)
 * - 10% probability → 10.0 (9-1)
 */
export function probabilityToDecimalOdds(probability: number): number {
  // Handle NaN or invalid input - return high odds (longshot default)
  if (!Number.isFinite(probability)) return 50; // Default to 49-1

  // Probability as decimal (e.g., 25% → 0.25)
  const probDecimal = probability / 100;

  // Use softmax module's helper for consistency
  return softmaxProbabilityToFairOdds(probDecimal);
}

/**
 * Convert decimal odds to traditional fractional display
 * E.g., 4.0 → "3-1", 2.5 → "3-2", 1.5 → "1-2"
 *
 * Note: Returns "N/A" for invalid input (not em-dash) to ensure
 * consistent parsing in components that split on hyphen.
 */
export function decimalToFractionalOdds(decimal: number): string {
  // Handle NaN or invalid input - return "N/A" (not em-dash for parsing safety)
  if (!Number.isFinite(decimal) || decimal <= 0) return 'N/A';
  if (decimal <= 1.01) return 'EVEN';

  const profit = decimal - 1;

  // Common fractional odds patterns
  const commonFractions: [number, string][] = [
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
  let closestMatch = '10-1';
  let closestDiff = Infinity;

  for (const [value, display] of commonFractions) {
    const diff = Math.abs(profit - value);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestMatch = display;
    }
  }

  return closestMatch;
}

/**
 * Convert decimal odds to moneyline format
 * Positive: underdog (+300 = 3-1)
 * Negative: favorite (-150 = 1.5-1 against)
 */
export function decimalToMoneyline(decimal: number): string {
  if (decimal >= 2.0) {
    // Underdog: positive moneyline
    const moneyline = Math.round((decimal - 1) * 100);
    return `+${moneyline}`;
  } else {
    // Favorite: negative moneyline
    const moneyline = Math.round(-100 / (decimal - 1));
    return `${moneyline}`;
  }
}

/**
 * Parse various odds formats to decimal
 * Handles: "3-1", "5/2", "EVEN", plain numbers, "+300", "-150"
 */
export function parseOddsToDecimal(oddsStr: string): number {
  const cleaned = oddsStr.trim().toUpperCase();

  // Handle "EVEN" odds
  if (cleaned === 'EVEN' || cleaned === 'EVN') {
    return 2.0; // Even money is 2.0 decimal (1-1)
  }

  // Handle moneyline format (+300 or -150)
  if (cleaned.startsWith('+')) {
    const ml = parseFloat(cleaned.substring(1));
    return 1 + ml / 100;
  }
  if (cleaned.startsWith('-')) {
    const ml = parseFloat(cleaned.substring(1));
    return 1 + 100 / ml;
  }

  // Handle "X-1" format (e.g., "5-1")
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const num = parts[0];
    const denom = parts[1];
    const numerator = num ? parseFloat(num) : 0;
    const denominator = denom ? parseFloat(denom) : 1;
    return 1 + numerator / (denominator || 1);
  }

  // Handle "X/Y" format (e.g., "5/2")
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const num = parts[0];
    const denom = parts[1];
    const numerator = num ? parseFloat(num) : 0;
    const denominator = denom ? parseFloat(denom) : 1;
    return 1 + numerator / (denominator || 1);
  }

  // Handle plain number (already decimal)
  const plainNum = parseFloat(cleaned);
  if (!isNaN(plainNum)) {
    // If it's a small number like 5, assume it's the profit ratio (5-1)
    if (plainNum < 1.5) return 2.0; // Probably meant even money
    if (plainNum < 20) return 1 + plainNum; // Assume X-1 format
    return plainNum; // Already decimal odds
  }

  return 11.0; // Default to 10-1 if parsing fails
}

/**
 * Calculate overlay percentage
 * Overlay% = ((Actual Odds - Fair Odds) / Fair Odds) × 100
 *
 * Positive = overlay (value bet)
 * Negative = underlay (bad value)
 *
 * Examples:
 * - Fair 3-1, Actual 8-1 = +167% overlay (HUGE VALUE)
 * - Fair 2-1, Actual 5/2 = +25% overlay (good value)
 * - Fair 5/2, Actual 2-1 = -20% overlay (underlay, avoid)
 */
export function calculateOverlayPercent(fairOdds: number, actualOdds: number): number {
  if (fairOdds <= 1.01) return 0; // Avoid division issues

  const overlay = ((actualOdds - fairOdds) / fairOdds) * 100;
  return Math.round(overlay * 10) / 10;
}

/**
 * Calculate TRUE overlay percentage using normalized market probabilities.
 *
 * This removes the takeout/overround from the market probability before
 * comparing to our model probability, giving a more accurate overlay.
 *
 * Formula: trueOverlay = (modelProb - normalizedMarketProb) / normalizedMarketProb × 100
 *
 * @param modelProb - Our model's win probability (0-1)
 * @param normalizedMarketProb - Market probability with takeout removed (0-1)
 * @returns True overlay percentage
 *
 * @example
 * // Model says 25%, normalized market says 17%
 * calculateTrueOverlayPercent(0.25, 0.17)  // Returns 47.1%
 *
 * // Model says 20%, normalized market says 25%
 * calculateTrueOverlayPercent(0.20, 0.25)  // Returns -20% (underlay)
 */
export function calculateTrueOverlayPercent(
  modelProb: number,
  normalizedMarketProb: number
): number {
  if (!Number.isFinite(modelProb) || !Number.isFinite(normalizedMarketProb)) {
    return 0;
  }

  if (normalizedMarketProb <= 0.001) {
    return 0; // Avoid division by zero
  }

  const trueOverlay = ((modelProb - normalizedMarketProb) / normalizedMarketProb) * 100;
  return Math.round(trueOverlay * 10) / 10;
}

/**
 * Calculate RAW overlay percentage using implied probability (includes takeout).
 *
 * This is the old method, kept for comparison and backward compatibility.
 *
 * @param modelProb - Our model's win probability (0-1)
 * @param impliedProb - Raw implied probability from odds (0-1)
 * @returns Raw overlay percentage
 */
export function calculateRawOverlayPercent(modelProb: number, impliedProb: number): number {
  if (!Number.isFinite(modelProb) || !Number.isFinite(impliedProb)) {
    return 0;
  }

  if (impliedProb <= 0.001) {
    return 0; // Avoid division by zero
  }

  const rawOverlay = ((modelProb - impliedProb) / impliedProb) * 100;
  return Math.round(rawOverlay * 10) / 10;
}

/**
 * Classify value based on overlay percentage
 */
export function classifyValue(overlayPercent: number): ValueClassification {
  if (overlayPercent >= VALUE_THRESHOLDS.massiveOverlay) return 'massive_overlay';
  if (overlayPercent >= VALUE_THRESHOLDS.strongOverlay) return 'strong_overlay';
  if (overlayPercent >= VALUE_THRESHOLDS.moderateOverlay) return 'moderate_overlay';
  if (overlayPercent >= VALUE_THRESHOLDS.slightOverlay) return 'slight_overlay';
  if (overlayPercent >= VALUE_THRESHOLDS.fairPrice) return 'fair_price';
  return 'underlay';
}

/**
 * Classify value based on TRUE overlay (normalized, takeout removed)
 *
 * Uses tighter thresholds because the ~17% vig has been removed
 * from the market probability denominator.
 *
 * @param trueOverlay - True overlay percentage (model prob vs normalized market prob)
 * @returns NormalizedValueClass classification
 *
 * @example
 * classifyNormalizedValue(18)   // Returns 'STRONG_VALUE'
 * classifyNormalizedValue(10)   // Returns 'MODERATE_VALUE'
 * classifyNormalizedValue(5)    // Returns 'SLIGHT_VALUE'
 * classifyNormalizedValue(0)    // Returns 'NEUTRAL'
 * classifyNormalizedValue(-5)   // Returns 'UNDERLAY'
 */
export function classifyNormalizedValue(trueOverlay: number): NormalizedValueClass {
  if (!Number.isFinite(trueOverlay)) {
    return 'NEUTRAL';
  }

  if (trueOverlay >= NORMALIZED_VALUE_THRESHOLDS.strongOverlay) {
    return 'STRONG_VALUE';
  }
  if (trueOverlay >= NORMALIZED_VALUE_THRESHOLDS.moderateOverlay) {
    return 'MODERATE_VALUE';
  }
  if (trueOverlay >= NORMALIZED_VALUE_THRESHOLDS.slightOverlay) {
    return 'SLIGHT_VALUE';
  }
  if (trueOverlay >= NORMALIZED_VALUE_THRESHOLDS.neutralMin) {
    return 'NEUTRAL';
  }
  return 'UNDERLAY';
}

/**
 * Calculate Expected Value (EV)
 *
 * EV = (Win Probability × Net Payout) - (Loss Probability × Bet Amount)
 *
 * For a $1 bet:
 * EV = (WinProb × (Odds - 1)) - (LossProb × 1)
 * EV = (WinProb × Odds) - 1
 *
 * Returns EV per dollar wagered
 */
export function calculateEV(winProbability: number, decimalOdds: number): number {
  const winProb = winProbability / 100;
  const lossProb = 1 - winProb;

  // EV per $1 bet
  const evPerDollar = winProb * (decimalOdds - 1) - lossProb * 1;

  return Math.round(evPerDollar * 1000) / 1000;
}

/**
 * Generate betting recommendation based on overlay analysis
 */
export function generateRecommendation(
  valueClass: ValueClassification,
  overlayPercent: number,
  _evPerDollar: number
): BettingRecommendation {
  switch (valueClass) {
    case 'massive_overlay':
      return {
        action: 'bet_heavily',
        reasoning: `This is a ${overlayPercent.toFixed(0)}% overlay - exceptional value. Consider 2-3x standard unit.`,
        suggestedMultiplier: Math.min(3, 1 + overlayPercent / 100),
        urgency: 'immediate',
      };

    case 'strong_overlay':
      return {
        action: 'bet_standard',
        reasoning: `Excellent value at ${overlayPercent.toFixed(0)}% overlay. Standard to 1.5x unit.`,
        suggestedMultiplier: 1 + overlayPercent / 150,
        urgency: 'standard',
      };

    case 'moderate_overlay':
      return {
        action: 'bet_standard',
        reasoning: `Good value bet with ${overlayPercent.toFixed(0)}% overlay.`,
        suggestedMultiplier: 1.0,
        urgency: 'standard',
      };

    case 'slight_overlay':
      return {
        action: 'bet_small',
        reasoning: `Slight edge at ${overlayPercent.toFixed(0)}% overlay. Playable with reduced unit.`,
        suggestedMultiplier: 0.75,
        urgency: 'low',
      };

    case 'fair_price':
      return {
        action: 'pass',
        reasoning: `No significant edge detected (${overlayPercent.toFixed(0)}%). Only bet if other factors are compelling.`,
        suggestedMultiplier: 0.5,
        urgency: 'none',
      };

    case 'underlay':
      return {
        action: 'avoid',
        reasoning: `Underlay of ${Math.abs(overlayPercent).toFixed(0)}% - avoid this bet. Price does not offer value.`,
        suggestedMultiplier: 0,
        urgency: 'none',
      };
  }
}

/**
 * Generate human-readable overlay description
 */
export function generateOverlayDescription(
  overlayPercent: number,
  valueClass: ValueClassification,
  fairOddsDisplay: string,
  actualOddsDisplay: string
): string {
  if (valueClass === 'underlay') {
    return `Underlay: Fair odds ${fairOddsDisplay}, actual ${actualOddsDisplay} (${Math.abs(overlayPercent).toFixed(0)}% worse than fair value)`;
  }

  if (valueClass === 'fair_price') {
    return `Fair price: Odds of ${actualOddsDisplay} are close to fair value of ${fairOddsDisplay}`;
  }

  const intensity =
    valueClass === 'massive_overlay'
      ? 'exceptional'
      : valueClass === 'strong_overlay'
        ? 'excellent'
        : valueClass === 'moderate_overlay'
          ? 'good'
          : 'slight';

  return `${overlayPercent.toFixed(0)}% overlay - ${intensity} value! Fair odds ${fairOddsDisplay}, actual ${actualOddsDisplay}`;
}

// ============================================================================
// MAIN ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Perform complete overlay analysis for a horse WITH FIELD CONTEXT
 *
 * This is the CORRECT way to calculate overlay/underlay:
 * 1. Calculate win probability relative to field (score / sum of all scores)
 * 2. Convert win probability to fair odds
 * 3. Compare fair odds to actual odds
 * 4. Classify: Overlay (>20%), Fair (±20%), Underlay (<-20%)
 *
 * NEW (v3.8): Also calculates normalized overlay using market probability
 * with takeout removed for more accurate value detection.
 *
 * @param horseBaseScore - Horse's base score (0-328)
 * @param allFieldBaseScores - Array of all non-scratched horses' base scores
 * @param actualOdds - Current odds string (e.g., "5-1", "8-1")
 * @param fieldOdds - Optional array of all field odds for normalization
 * @returns Complete overlay analysis with normalized metrics
 */
export function analyzeOverlayWithField(
  horseBaseScore: number,
  allFieldBaseScores: number[],
  actualOdds: string,
  fieldOdds?: string[]
): OverlayAnalysis {
  // Step 1: Calculate field-relative win probability (our model)
  const winProbability = calculateFieldRelativeWinProbability(horseBaseScore, allFieldBaseScores);

  // Step 2: Calculate fair odds from probability
  const fairOddsDecimal = probabilityToDecimalOdds(winProbability);
  const fairOddsDisplay = decimalToFractionalOdds(fairOddsDecimal);
  const fairOddsMoneyline = decimalToMoneyline(fairOddsDecimal);

  // Step 3: Parse actual odds
  const actualOddsDecimal = parseOddsString(actualOdds);

  // Step 4: Calculate overlay percentage (legacy method)
  const overlayPercent = calculateOverlayPercent(fairOddsDecimal, actualOddsDecimal);

  // Step 5: Classify value (legacy)
  const valueClass = classifyValue(overlayPercent);

  // Step 6: Calculate expected value
  const evPerDollar = calculateEV(winProbability, actualOddsDecimal);
  const evPercent = evPerDollar * 100;

  // Step 7: Generate recommendation
  const recommendation = generateRecommendation(valueClass, overlayPercent, evPerDollar);

  // Step 8: Generate description
  const overlayDescription = generateOverlayDescription(
    overlayPercent,
    valueClass,
    fairOddsDisplay,
    actualOdds
  );

  // NEW (v3.8): Calculate normalized overlay metrics
  // Convert model probability from percentage to decimal (0-1)
  const modelProbDecimal = winProbability / 100;

  // Calculate raw implied probability from this horse's odds
  const rawImpliedProb = oddsToImpliedProbability(actualOddsDecimal);

  // Calculate normalized market probability (if field odds provided)
  let normalizedMarketProb = rawImpliedProb;
  let overround = 1.0;
  let trueOverlayPercent = overlayPercent;
  let rawOverlayPercent = overlayPercent;

  if (fieldOdds && fieldOdds.length > 0 && MARKET_CONFIG.useNormalizedOverlay) {
    // Parse all field odds to decimal
    const fieldDecimalOdds = fieldOdds.map(parseOddsString);

    // Calculate implied probabilities for all horses
    const fieldImpliedProbs = fieldDecimalOdds.map(oddsToImpliedProbability);

    // Calculate overround
    overround = calculateOverround(fieldImpliedProbs);

    // Normalize probabilities (removes takeout)
    const normalizedProbs = normalizeMarketProbabilities(fieldImpliedProbs);

    // Find this horse's index (by matching odds)
    const horseIndex = fieldOdds.indexOf(actualOdds);

    if (horseIndex >= 0 && normalizedProbs[horseIndex] !== undefined) {
      normalizedMarketProb = normalizedProbs[horseIndex];
    } else {
      // Fallback: normalize this horse's implied prob by the overround
      normalizedMarketProb = overround > 0 ? rawImpliedProb / overround : rawImpliedProb;
    }

    // Calculate true overlay (using normalized market prob)
    trueOverlayPercent = calculateTrueOverlayPercent(modelProbDecimal, normalizedMarketProb);

    // Calculate raw overlay (for comparison)
    rawOverlayPercent = calculateRawOverlayPercent(modelProbDecimal, rawImpliedProb);
  } else {
    // No field odds provided - estimate using this horse's odds only
    // Use default takeout to approximate normalization
    const estimatedOverround = 1 + MARKET_CONFIG.defaultTakeout;
    normalizedMarketProb = rawImpliedProb / estimatedOverround;
    overround = estimatedOverround;
    trueOverlayPercent = calculateTrueOverlayPercent(modelProbDecimal, normalizedMarketProb);
    rawOverlayPercent = calculateRawOverlayPercent(modelProbDecimal, rawImpliedProb);
  }

  // Classify using normalized overlay
  const valueClassification = classifyNormalizedValue(trueOverlayPercent);

  return {
    fairOddsDecimal,
    fairOddsDisplay,
    fairOddsMoneyline,
    winProbability,
    actualOddsDecimal,
    // For backward compatibility, overlayPercent uses trueOverlay when normalized
    overlayPercent: MARKET_CONFIG.useNormalizedOverlay ? trueOverlayPercent : overlayPercent,
    valueClass,
    evPerDollar,
    evPercent,
    isPositiveEV: evPerDollar > 0,
    overlayDescription,
    recommendation,
    // New normalized fields
    normalizedMarketProb,
    rawImpliedProb,
    overround,
    trueOverlayPercent,
    rawOverlayPercent,
    valueClassification,
  };
}

/**
 * Perform complete overlay analysis for a horse (LEGACY - without field context)
 *
 * NOTE: This function is less accurate because it doesn't consider field strength.
 * Use analyzeOverlayWithField when field context is available.
 *
 * @param score - Horse's total score (0-328)
 * @param actualOdds - Current odds string (e.g., "5-1", "8-1")
 * @returns Complete overlay analysis
 */
export function analyzeOverlay(score: number, actualOdds: string): OverlayAnalysis {
  // Step 1: Convert score to win probability
  const winProbability = scoreToWinProbability(score);

  // Step 2: Calculate fair odds from probability
  const fairOddsDecimal = probabilityToDecimalOdds(winProbability);
  const fairOddsDisplay = decimalToFractionalOdds(fairOddsDecimal);
  const fairOddsMoneyline = decimalToMoneyline(fairOddsDecimal);

  // Step 3: Parse actual odds (use new oddsParser module)
  const actualOddsDecimal = parseOddsString(actualOdds);

  // Step 4: Calculate overlay percentage
  const overlayPercent = calculateOverlayPercent(fairOddsDecimal, actualOddsDecimal);

  // Step 5: Classify value
  const valueClass = classifyValue(overlayPercent);

  // Step 6: Calculate expected value
  const evPerDollar = calculateEV(winProbability, actualOddsDecimal);
  const evPercent = evPerDollar * 100;

  // Step 7: Generate recommendation
  const recommendation = generateRecommendation(valueClass, overlayPercent, evPerDollar);

  // Step 8: Generate description
  const overlayDescription = generateOverlayDescription(
    overlayPercent,
    valueClass,
    fairOddsDisplay,
    actualOdds
  );

  return {
    fairOddsDecimal,
    fairOddsDisplay,
    fairOddsMoneyline,
    winProbability,
    actualOddsDecimal,
    overlayPercent,
    valueClass,
    evPerDollar,
    evPercent,
    isPositiveEV: evPerDollar > 0,
    overlayDescription,
    recommendation,
  };
}

// ============================================================================
// VALUE PLAYS DETECTION
// ============================================================================

/**
 * Detect all value plays in a race
 * Returns horses with positive overlay sorted by value
 */
export function detectValuePlays(
  horses: Array<{
    horseIndex: number;
    horseName: string;
    programNumber: number;
    score: number;
    currentOdds: string;
    isScratched: boolean;
  }>,
  minOverlayPercent: number = 10
): ValuePlay[] {
  const valuePlays: ValuePlay[] = [];

  for (const horse of horses) {
    if (horse.isScratched) continue;

    const analysis = analyzeOverlay(horse.score, horse.currentOdds);

    if (analysis.overlayPercent >= minOverlayPercent) {
      valuePlays.push({
        horseIndex: horse.horseIndex,
        horseName: horse.horseName,
        programNumber: horse.programNumber,
        score: horse.score,
        overlayPercent: analysis.overlayPercent,
        valueClass: analysis.valueClass,
        evPerDollar: analysis.evPerDollar,
        fairOddsDisplay: analysis.fairOddsDisplay,
        actualOddsDisplay: horse.currentOdds,
        recommendation: analysis.recommendation,
      });
    }
  }

  // Sort by overlay percentage descending (best value first)
  return valuePlays.sort((a, b) => b.overlayPercent - a.overlayPercent);
}

/**
 * Get summary stats for value plays in a race
 */
export function getValuePlaysSummary(valuePlays: ValuePlay[]): {
  totalCount: number;
  massiveCount: number;
  strongCount: number;
  moderateCount: number;
  bestPlay: ValuePlay | null;
  totalPositiveEV: number;
} {
  const massiveCount = valuePlays.filter((p) => p.valueClass === 'massive_overlay').length;
  const strongCount = valuePlays.filter((p) => p.valueClass === 'strong_overlay').length;
  const moderateCount = valuePlays.filter((p) => p.valueClass === 'moderate_overlay').length;
  const totalPositiveEV = valuePlays.reduce((sum, p) => sum + Math.max(0, p.evPerDollar), 0);

  return {
    totalCount: valuePlays.length,
    massiveCount,
    strongCount,
    moderateCount,
    bestPlay: valuePlays[0] ?? null,
    totalPositiveEV: Math.round(totalPositiveEV * 100) / 100,
  };
}

// ============================================================================
// TIER ADJUSTMENT BASED ON OVERLAY
// ============================================================================

/**
 * Calculate tier adjustment based on overlay
 * Returns points to add/subtract from tier threshold consideration
 *
 * High score + overlay = bump up tier
 * High score + underlay = bump down tier (ONLY if baseScore < UNDERLAY_PENALTY_THRESHOLD)
 *
 * Examples:
 * - 175 score + 80% overlay = effectively 195 (Tier 1 territory)
 * - 185 base + -30% underlay = effectively 185 (NO penalty - exceeds threshold)
 * - 150 base + -30% underlay = effectively 125 (penalty applies - below threshold)
 * - 155 score + 200% overlay = "Diamond in Rough" special classification
 *
 * @param score - Total score (base + overlay) used as starting point for adjustments
 * @param baseScore - Base score (before overlay) used for threshold checks
 * @param overlayPercent - Market overlay percentage
 */
export function calculateTierAdjustment(
  score: number,
  baseScore: number,
  overlayPercent: number
): {
  adjustedScore: number;
  tierShift: number;
  isSpecialCase: boolean;
  specialCaseType: 'diamond_in_rough' | 'fool_gold' | null;
  reasoning: string;
} {
  let adjustedScore = score;
  let tierShift = 0;
  let isSpecialCase = false;
  let specialCaseType: 'diamond_in_rough' | 'fool_gold' | null = null;
  let reasoning = '';

  // Calculate tier shift based on overlay
  // OVERLAY BONUSES - always apply regardless of score
  if (overlayPercent >= 150) {
    tierShift = 2; // Major bump up
    adjustedScore = score + 30;
    reasoning = `Massive ${overlayPercent.toFixed(0)}% overlay adds +30 effective points`;
  } else if (overlayPercent >= 80) {
    tierShift = 1; // Bump up one tier
    adjustedScore = score + 20;
    reasoning = `Strong ${overlayPercent.toFixed(0)}% overlay adds +20 effective points`;
  } else if (overlayPercent >= 40) {
    tierShift = 1;
    adjustedScore = score + 10;
    reasoning = `Good ${overlayPercent.toFixed(0)}% overlay adds +10 effective points`;
  } else if (overlayPercent >= 15) {
    adjustedScore = score + 5;
    reasoning = `Slight ${overlayPercent.toFixed(0)}% overlay adds +5 effective points`;
  }
  // UNDERLAY PENALTIES - only apply if BASE score is BELOW the threshold
  // Horses with 160+ base score have demonstrated ability. The market recognizing
  // this (low odds) should not penalize proven performers.
  else if (overlayPercent <= -30) {
    if (baseScore >= UNDERLAY_PENALTY_THRESHOLD) {
      // Skip penalty for high-scoring horses - use baseScore for threshold check
      reasoning = `Underlay of ${Math.abs(overlayPercent).toFixed(0)}% — penalty waived (base score ${baseScore} exceeds threshold)`;
      // adjustedScore unchanged, tierShift stays 0
    } else {
      tierShift = -2; // Major bump down
      adjustedScore = score - 25;
      reasoning = `Significant ${Math.abs(overlayPercent).toFixed(0)}% underlay subtracts -25 effective points`;
    }
  } else if (overlayPercent <= -15) {
    if (baseScore >= UNDERLAY_PENALTY_THRESHOLD) {
      // Skip penalty for high-scoring horses - use baseScore for threshold check
      reasoning = `Underlay of ${Math.abs(overlayPercent).toFixed(0)}% — penalty waived (base score ${baseScore} exceeds threshold)`;
      // adjustedScore unchanged, tierShift stays 0
    } else {
      tierShift = -1; // Bump down one tier
      adjustedScore = score - 15;
      reasoning = `Underlay of ${Math.abs(overlayPercent).toFixed(0)}% subtracts -15 effective points`;
    }
  }

  // Check for special cases
  // Diamond in Rough: Low BASE score but massive overlay
  if (baseScore >= 140 && baseScore < 170 && overlayPercent >= 150) {
    isSpecialCase = true;
    specialCaseType = 'diamond_in_rough';
    reasoning = `DIAMOND IN ROUGH: Base score ${baseScore} with ${overlayPercent.toFixed(0)}% overlay - hidden gem!`;
  }

  // Fool's Gold: High score but severe underlay
  // NOTE: Only flag this for BASE scores BELOW the underlay threshold
  // Horses at 160+ base with underlays are correctly identified by the market, not "fool's gold"
  if (baseScore >= 180 && baseScore < UNDERLAY_PENALTY_THRESHOLD && overlayPercent <= -25) {
    isSpecialCase = true;
    specialCaseType = 'fool_gold';
    reasoning = `FOOL'S GOLD: Base score ${baseScore} looks good but ${Math.abs(overlayPercent).toFixed(0)}% underlay - overbet public choice`;
  }

  // Clamp adjusted score
  adjustedScore = Math.max(0, Math.min(250, adjustedScore));

  return {
    adjustedScore,
    tierShift,
    isSpecialCase,
    specialCaseType,
    reasoning,
  };
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format overlay percentage for display
 */
export function formatOverlayPercent(overlayPercent: number): string {
  // Handle NaN or invalid input
  if (!Number.isFinite(overlayPercent)) return '—';

  const sign = overlayPercent >= 0 ? '+' : '';
  return `${sign}${overlayPercent.toFixed(0)}%`;
}

/**
 * Format EV for display
 */
export function formatEV(evPerDollar: number): string {
  // Handle NaN or invalid input
  if (!Number.isFinite(evPerDollar)) return '—';

  const sign = evPerDollar >= 0 ? '+' : '';
  return `${sign}$${evPerDollar.toFixed(2)}`;
}

/**
 * Format EV as percentage
 */
export function formatEVPercent(evPercent: number): string {
  // Handle NaN or invalid input
  if (!Number.isFinite(evPercent)) return '—';

  const sign = evPercent >= 0 ? '+' : '';
  return `${sign}${evPercent.toFixed(1)}%`;
}

/**
 * Get color for overlay display
 */
export function getOverlayColor(overlayPercent: number): string {
  // Handle NaN - return neutral/gray color
  if (!Number.isFinite(overlayPercent)) return VALUE_COLORS.fair_price;

  const valueClass = classifyValue(overlayPercent);
  return VALUE_COLORS[valueClass];
}

/**
 * Get background color with opacity for overlay badge
 */
export function getOverlayBgColor(overlayPercent: number, opacity: number = 0.2): string {
  const color = getOverlayColor(overlayPercent);
  // Convert hex to rgba
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
