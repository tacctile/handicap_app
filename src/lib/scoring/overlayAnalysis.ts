/**
 * Overlay Detection and Expected Value (EV) Calculations
 *
 * This module provides comprehensive value betting analysis:
 * - Score to win probability conversion
 * - Fair odds calculation from win probability
 * - Overlay/underlay detection and classification
 * - Expected Value (EV) calculations
 * - Value classification for betting decisions
 *
 * This is the foundation for Kelly Criterion betting (Phase 3).
 */

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
}

export type ValueClassification =
  | 'massive_overlay' // 150%+ overlay - bet immediately
  | 'strong_overlay' // 50-149% overlay - excellent value
  | 'moderate_overlay' // 25-49% overlay - good value
  | 'slight_overlay' // 10-24% overlay - playable
  | 'fair_price' // -10% to +9% - no edge
  | 'underlay'; // <-10% - avoid

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

/** Value classification thresholds */
export const VALUE_THRESHOLDS = {
  massiveOverlay: 150,
  strongOverlay: 50,
  moderateOverlay: 25,
  slightOverlay: 10,
  fairPrice: -10,
  // Below -10% is underlay
} as const;

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

/** Labels for value classification */
export const VALUE_LABELS: Record<ValueClassification, string> = {
  massive_overlay: 'Massive Overlay',
  strong_overlay: 'Strong Overlay',
  moderate_overlay: 'Moderate Overlay',
  slight_overlay: 'Slight Overlay',
  fair_price: 'Fair Price',
  underlay: 'Underlay',
};

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

/**
 * Convert a score (0-240 range) to win probability
 *
 * Formula: Win% = (Score - 50) / 200 × 100
 * Clamped between 2% and 80% for realistic bounds
 *
 * Benchmarks:
 * - 200+ score = 75%+ win probability
 * - 180 score = 65% win probability
 * - 160 score = 55% win probability
 * - 140 score = 45% win probability
 * - 120 score = 35% win probability
 * - 100 score = 25% win probability
 */
export function scoreToWinProbability(score: number): number {
  // Handle NaN or invalid input
  if (!Number.isFinite(score)) return 2; // Return minimum probability

  // Formula: (Score - 50) / 200 * 100
  // This maps:
  // - Score 50 → 0%
  // - Score 100 → 25%
  // - Score 150 → 50%
  // - Score 200 → 75%
  // - Score 250 → 100% (capped at 80%)
  const rawProbability = ((score - 50) / 200) * 100;

  // Clamp to realistic bounds (2% to 80%)
  // Even a longshot has some chance, elite horses rarely over 80%
  return Math.max(2, Math.min(80, rawProbability));
}

/**
 * Convert win probability to fair decimal odds
 * Formula: Fair Odds = 1 / Win Probability (as decimal)
 *
 * Examples:
 * - 50% probability → 2.0 (even money, 1-1)
 * - 25% probability → 4.0 (3-1)
 * - 20% probability → 5.0 (4-1)
 * - 10% probability → 10.0 (9-1)
 */
export function probabilityToDecimalOdds(probability: number): number {
  // Probability as decimal (e.g., 25% → 0.25)
  const probDecimal = probability / 100;

  // Fair decimal odds = 1 / probability
  if (probDecimal <= 0) return 100; // Cap at 99-1
  if (probDecimal >= 1) return 1.01; // Near even money

  return Math.round((1 / probDecimal) * 100) / 100;
}

/**
 * Convert decimal odds to traditional fractional display
 * E.g., 4.0 → "3-1", 2.5 → "3-2", 1.5 → "1-2"
 */
export function decimalToFractionalOdds(decimal: number): string {
  // Handle NaN or invalid input
  if (!Number.isFinite(decimal) || decimal <= 0) return '—';
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
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Perform complete overlay analysis for a horse
 *
 * @param score - Horse's total score (0-240)
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

  // Step 3: Parse actual odds
  const actualOddsDecimal = parseOddsToDecimal(actualOdds);

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
 * High score + underlay = bump down tier
 *
 * Examples:
 * - 175 score + 80% overlay = effectively 195 (Tier 1 territory)
 * - 185 score + -30% underlay = effectively 167 (Tier 2 territory)
 * - 155 score + 200% overlay = "Diamond in Rough" special classification
 */
export function calculateTierAdjustment(
  score: number,
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
  } else if (overlayPercent <= -30) {
    tierShift = -2; // Major bump down
    adjustedScore = score - 25;
    reasoning = `Significant ${Math.abs(overlayPercent).toFixed(0)}% underlay subtracts -25 effective points`;
  } else if (overlayPercent <= -15) {
    tierShift = -1; // Bump down one tier
    adjustedScore = score - 15;
    reasoning = `Underlay of ${Math.abs(overlayPercent).toFixed(0)}% subtracts -15 effective points`;
  }

  // Check for special cases
  // Diamond in Rough: Low score but massive overlay
  if (score >= 140 && score < 170 && overlayPercent >= 150) {
    isSpecialCase = true;
    specialCaseType = 'diamond_in_rough';
    reasoning = `DIAMOND IN ROUGH: Score ${score} with ${overlayPercent.toFixed(0)}% overlay - hidden gem!`;
  }

  // Fool's Gold: High score but severe underlay
  if (score >= 180 && overlayPercent <= -25) {
    isSpecialCase = true;
    specialCaseType = 'fool_gold';
    reasoning = `FOOL'S GOLD: Score ${score} looks good but ${Math.abs(overlayPercent).toFixed(0)}% underlay - overbet public choice`;
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
  const sign = overlayPercent >= 0 ? '+' : '';
  return `${sign}${overlayPercent.toFixed(0)}%`;
}

/**
 * Format EV for display
 */
export function formatEV(evPerDollar: number): string {
  const sign = evPerDollar >= 0 ? '+' : '';
  return `${sign}$${evPerDollar.toFixed(2)}`;
}

/**
 * Format EV as percentage
 */
export function formatEVPercent(evPercent: number): string {
  const sign = evPercent >= 0 ? '+' : '';
  return `${sign}${evPercent.toFixed(1)}%`;
}

/**
 * Get color for overlay display
 */
export function getOverlayColor(overlayPercent: number): string {
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
