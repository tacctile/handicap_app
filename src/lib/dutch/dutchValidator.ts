/**
 * Dutch Book Validator
 *
 * Validates Dutch book opportunities:
 * - Sum of implied probabilities must be < 100% (overlay exists)
 * - If sum > 100% = no profit possible (underlay book)
 * - Minimum 2 horses required
 * - Maximum 5 horses recommended (spread too thin beyond that)
 * - All odds must be positive
 *
 * Edge calculation:
 * - Edge% = (100 - Sum_of_Implied_Probs)
 * - Minimum 5% edge recommended
 * - Expected profit: Total_Stake × Edge%
 *
 * @module dutch/dutchValidator
 */

import { logger } from '../../services/logging';
import {
  type DutchHorse,
  type DutchResult,
  calculateImpliedProbability,
  parseOddsToDecimal,
  MINIMUM_TOTAL_STAKE,
  MAX_DUTCH_HORSES,
  RECOMMENDED_MAX_HORSES,
  DEFAULT_MINIMUM_BET,
} from './dutchCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface DutchValidationInput {
  /** Horses to include in Dutch */
  horses: DutchHorse[];
  /** Total stake amount */
  totalStake: number;
  /** Minimum edge required (0-50) */
  minEdgeRequired?: number;
  /** Maximum horses allowed */
  maxHorses?: number;
  /** Minimum individual bet */
  minimumBet?: number;
}

export interface DutchValidationResult {
  /** Whether the Dutch book is valid */
  isValid: boolean;
  /** Whether profit is possible (sum < 100%) */
  isProfitable: boolean;
  /** Validation errors (blocking) */
  errors: string[];
  /** Validation warnings (non-blocking) */
  warnings: string[];
  /** Edge percentage */
  edgePercent: number;
  /** Sum of implied probabilities */
  sumOfImpliedProbs: number;
  /** Expected profit per dollar staked */
  expectedProfitPerDollar: number;
  /** Expected profit for given stake */
  expectedProfit: number;
  /** Whether edge meets minimum requirement */
  meetsMinEdge: boolean;
  /** Sanitized horses with valid odds */
  validHorses: DutchHorse[];
  /** Number of invalid horses removed */
  invalidHorseCount: number;
}

export interface EdgeAnalysis {
  /** Edge percentage */
  edgePercent: number;
  /** Edge classification */
  edgeClass: EdgeClassification;
  /** Human-readable edge description */
  edgeDescription: string;
  /** Whether this is a good Dutch opportunity */
  isRecommended: boolean;
  /** Suggested action */
  suggestedAction: 'bet_confidently' | 'bet_cautiously' | 'consider' | 'avoid';
}

export type EdgeClassification =
  | 'excellent' // 15%+ edge
  | 'good' // 10-14.9% edge
  | 'moderate' // 5-9.9% edge
  | 'marginal' // 0-4.9% edge
  | 'unprofitable'; // negative edge

// ============================================================================
// CONSTANTS
// ============================================================================

/** Edge classification thresholds */
export const EDGE_THRESHOLDS = {
  excellent: 15,
  good: 10,
  moderate: 5,
  marginal: 0,
} as const;

/** Recommended minimum edge for betting */
export const RECOMMENDED_MIN_EDGE = 5;

/** Edge colors for display */
export const EDGE_COLORS: Record<EdgeClassification, string> = {
  excellent: '#22c55e', // Bright green
  good: '#4ade80', // Green
  moderate: '#fbbf24', // Yellow
  marginal: '#f97316', // Orange
  unprofitable: '#ef4444', // Red
};

/** Edge icons for display */
export const EDGE_ICONS: Record<EdgeClassification, string> = {
  excellent: 'rocket_launch',
  good: 'trending_up',
  moderate: 'thumbs_up_down',
  marginal: 'warning',
  unprofitable: 'block',
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a Dutch book opportunity
 *
 * @param input - Validation input
 * @returns Validation result
 */
export function validateDutchBook(input: DutchValidationInput): DutchValidationResult {
  const {
    horses,
    totalStake,
    minEdgeRequired = RECOMMENDED_MIN_EDGE,
    maxHorses = MAX_DUTCH_HORSES,
    minimumBet = DEFAULT_MINIMUM_BET,
  } = input;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate and sanitize horses
  const validHorses: DutchHorse[] = [];
  let invalidHorseCount = 0;

  if (!Array.isArray(horses)) {
    errors.push('Horses must be an array');
  } else {
    for (const horse of horses) {
      const validation = validateHorse(horse);
      if (validation.isValid && validation.sanitizedHorse) {
        validHorses.push(validation.sanitizedHorse);
      } else {
        invalidHorseCount++;
        if (validation.error) {
          logger.logWarning(`Invalid horse in Dutch: ${validation.error}`, {
            component: 'dutchValidator',
            programNumber: horse?.programNumber,
          });
        }
      }
    }
  }

  // Check minimum horse count
  if (validHorses.length < 2) {
    errors.push(`Minimum 2 horses required for Dutch booking (found ${validHorses.length})`);
  }

  // Check maximum horse count
  if (validHorses.length > maxHorses) {
    errors.push(`Maximum ${maxHorses} horses allowed (found ${validHorses.length})`);
  }

  // Warn if too many horses
  if (validHorses.length > RECOMMENDED_MAX_HORSES && validHorses.length <= maxHorses) {
    warnings.push(
      `Using ${validHorses.length} horses spreads risk thin. Consider ${RECOMMENDED_MAX_HORSES} or fewer for optimal edge.`
    );
  }

  // Validate total stake
  if (typeof totalStake !== 'number' || !Number.isFinite(totalStake)) {
    errors.push('Total stake must be a valid number');
  } else if (totalStake < MINIMUM_TOTAL_STAKE) {
    errors.push(`Minimum stake is $${MINIMUM_TOTAL_STAKE} (received $${totalStake})`);
  }

  // If we have errors so far, return early
  if (errors.length > 0) {
    logger.logWarning('Dutch validation failed with errors', {
      component: 'dutchValidator',
      errors,
      horseCount: validHorses.length,
    });

    return {
      isValid: false,
      isProfitable: false,
      errors,
      warnings,
      edgePercent: 0,
      sumOfImpliedProbs: 0,
      expectedProfitPerDollar: 0,
      expectedProfit: 0,
      meetsMinEdge: false,
      validHorses,
      invalidHorseCount,
    };
  }

  // Calculate sum of implied probabilities
  const sumOfImpliedProbs = validHorses.reduce(
    (sum, horse) =>
      sum + (horse.impliedProbability ?? calculateImpliedProbability(horse.decimalOdds)),
    0
  );

  // Calculate edge
  const edgePercent = (1 - sumOfImpliedProbs) * 100;
  const isProfitable = edgePercent > 0;
  const meetsMinEdge = edgePercent >= minEdgeRequired;

  // Calculate expected profit
  const expectedProfitPerDollar = edgePercent / 100;
  const expectedProfit = totalStake * expectedProfitPerDollar;

  // Add warnings for edge
  if (!isProfitable) {
    warnings.push(
      `No profit possible: combined book is ${sumOfImpliedProbs * 100}% (must be < 100%)`
    );
  } else if (!meetsMinEdge) {
    warnings.push(
      `Edge ${edgePercent.toFixed(1)}% is below recommended minimum ${minEdgeRequired}%`
    );
  }

  // Check if individual bets would be too small
  if (validHorses.length > 0 && totalStake > 0) {
    const minImpliedProb = Math.min(
      ...validHorses.map((h) => calculateImpliedProbability(h.decimalOdds))
    );
    const smallestBet = (totalStake * minImpliedProb) / sumOfImpliedProbs;

    if (smallestBet < minimumBet) {
      warnings.push(
        `Smallest bet would be $${smallestBet.toFixed(2)}, below track minimum $${minimumBet}`
      );
    }
  }

  // Log validation result
  logger.logInfo('Dutch validation completed', {
    component: 'dutchValidator',
    isValid: errors.length === 0,
    isProfitable,
    edgePercent,
    horseCount: validHorses.length,
    totalStake,
  });

  return {
    isValid: errors.length === 0,
    isProfitable,
    errors,
    warnings,
    edgePercent: Math.round(edgePercent * 100) / 100,
    sumOfImpliedProbs: Math.round(sumOfImpliedProbs * 10000) / 10000,
    expectedProfitPerDollar: Math.round(expectedProfitPerDollar * 10000) / 10000,
    expectedProfit: Math.round(expectedProfit * 100) / 100,
    meetsMinEdge,
    validHorses,
    invalidHorseCount,
  };
}

/**
 * Validate a single horse for Dutch inclusion
 */
export function validateHorse(horse: unknown): {
  isValid: boolean;
  sanitizedHorse: DutchHorse | null;
  error?: string;
} {
  if (!horse || typeof horse !== 'object') {
    return { isValid: false, sanitizedHorse: null, error: 'Invalid horse object' };
  }

  const h = horse as Partial<DutchHorse>;

  // Validate program number
  if (typeof h.programNumber !== 'number' || h.programNumber < 1) {
    return { isValid: false, sanitizedHorse: null, error: 'Invalid program number' };
  }

  // Parse and validate odds
  let decimalOdds = h.decimalOdds;
  const originalOddsInvalid = typeof decimalOdds !== 'number' || decimalOdds <= 1;

  if (originalOddsInvalid) {
    // Only try to parse display if there's a valid oddsDisplay string
    // that looks like actual odds (contains numbers, dashes, or is EVEN/EVN)
    const display = h.oddsDisplay;
    if (display && typeof display === 'string') {
      const trimmed = display.trim().toUpperCase();
      // Check if it looks like valid odds format
      const looksLikeOdds = /^(EVEN|EVN|[+-]?\d+[-/]\d+|[+-]?\d+)$/.test(trimmed);
      if (looksLikeOdds) {
        decimalOdds = parseOddsToDecimal(display);
      } else {
        // oddsDisplay doesn't look like valid odds
        return {
          isValid: false,
          sanitizedHorse: null,
          error: `Invalid odds for horse ${h.programNumber}`,
        };
      }
    } else {
      // No valid odds provided at all
      return {
        isValid: false,
        sanitizedHorse: null,
        error: `Invalid odds for horse ${h.programNumber}`,
      };
    }
  }

  // At this point, decimalOdds is guaranteed to be a valid number
  const validatedOdds = decimalOdds as number;

  if (validatedOdds <= 1) {
    return {
      isValid: false,
      sanitizedHorse: null,
      error: `Invalid odds for horse ${h.programNumber}`,
    };
  }

  return {
    isValid: true,
    sanitizedHorse: {
      programNumber: Math.floor(h.programNumber),
      horseName: typeof h.horseName === 'string' ? h.horseName : `Horse ${h.programNumber}`,
      decimalOdds: validatedOdds,
      oddsDisplay: h.oddsDisplay || formatDecimalAsOdds(validatedOdds),
      impliedProbability: calculateImpliedProbability(validatedOdds),
      estimatedWinProb: h.estimatedWinProb,
      fairOdds: h.fairOdds,
      overlayPercent: h.overlayPercent,
    },
  };
}

/**
 * Validate a Dutch result
 */
export function validateDutchResult(result: DutchResult): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!result) {
    return { isValid: false, issues: ['Result is null or undefined'] };
  }

  if (!result.isValid) {
    issues.push(result.error || 'Result marked as invalid');
  }

  if (!result.hasProfitPotential) {
    issues.push('No profit potential - sum of implied probabilities >= 100%');
  }

  if (result.bets.length < 2) {
    issues.push('Fewer than 2 bets in result');
  }

  if (result.guaranteedProfit < 0) {
    issues.push('Negative guaranteed profit');
  }

  // Verify bet amounts sum correctly
  const calculatedTotal = result.bets.reduce((sum, bet) => sum + bet.betAmountRounded, 0);
  if (Math.abs(calculatedTotal - result.actualTotalCost) > 0.01) {
    issues.push('Bet amounts do not sum to total cost');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

// ============================================================================
// EDGE ANALYSIS
// ============================================================================

/**
 * Analyze edge and provide recommendations
 */
export function analyzeEdge(edgePercent: number): EdgeAnalysis {
  let edgeClass: EdgeClassification;
  let edgeDescription: string;
  let isRecommended: boolean;
  let suggestedAction: EdgeAnalysis['suggestedAction'];

  if (edgePercent >= EDGE_THRESHOLDS.excellent) {
    edgeClass = 'excellent';
    edgeDescription = `Excellent ${edgePercent.toFixed(1)}% edge - exceptional Dutch opportunity`;
    isRecommended = true;
    suggestedAction = 'bet_confidently';
  } else if (edgePercent >= EDGE_THRESHOLDS.good) {
    edgeClass = 'good';
    edgeDescription = `Good ${edgePercent.toFixed(1)}% edge - solid Dutch opportunity`;
    isRecommended = true;
    suggestedAction = 'bet_confidently';
  } else if (edgePercent >= EDGE_THRESHOLDS.moderate) {
    edgeClass = 'moderate';
    edgeDescription = `Moderate ${edgePercent.toFixed(1)}% edge - acceptable Dutch`;
    isRecommended = true;
    suggestedAction = 'bet_cautiously';
  } else if (edgePercent > 0) {
    edgeClass = 'marginal';
    edgeDescription = `Marginal ${edgePercent.toFixed(1)}% edge - thin profit margin`;
    isRecommended = false;
    suggestedAction = 'consider';
  } else {
    edgeClass = 'unprofitable';
    edgeDescription = `No edge (${edgePercent.toFixed(1)}%) - avoid this Dutch`;
    isRecommended = false;
    suggestedAction = 'avoid';
  }

  return {
    edgePercent,
    edgeClass,
    edgeDescription,
    isRecommended,
    suggestedAction,
  };
}

/**
 * Classify edge by percentage
 */
export function classifyEdge(edgePercent: number): EdgeClassification {
  if (edgePercent >= EDGE_THRESHOLDS.excellent) return 'excellent';
  if (edgePercent >= EDGE_THRESHOLDS.good) return 'good';
  if (edgePercent >= EDGE_THRESHOLDS.moderate) return 'moderate';
  if (edgePercent > 0) return 'marginal';
  return 'unprofitable';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format decimal odds as traditional display
 */
function formatDecimalAsOdds(decimal: number): string {
  if (decimal <= 1.01) return 'EVEN';
  const profit = decimal - 1;

  // Common fractional odds
  const fractions: [number, string][] = [
    [0.5, '1-2'],
    [0.667, '2-3'],
    [0.8, '4-5'],
    [1.0, 'EVEN'],
    [1.2, '6-5'],
    [1.5, '3-2'],
    [2.0, '2-1'],
    [2.5, '5-2'],
    [3.0, '3-1'],
    [4.0, '4-1'],
    [5.0, '5-1'],
    [6.0, '6-1'],
    [8.0, '8-1'],
    [10.0, '10-1'],
    [15.0, '15-1'],
    [20.0, '20-1'],
  ];

  let closest = '2-1';
  let closestDiff = Infinity;

  for (const [value, display] of fractions) {
    const diff = Math.abs(profit - value);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = display;
    }
  }

  return closest;
}

/**
 * Check if a set of horses can form a profitable Dutch
 */
export function canFormProfitableDutch(horses: DutchHorse[]): boolean {
  if (horses.length < 2) return false;

  const sumOfImpliedProbs = horses.reduce((sum, horse) => {
    const prob = horse.impliedProbability ?? calculateImpliedProbability(horse.decimalOdds);
    return sum + prob;
  }, 0);

  return sumOfImpliedProbs < 1;
}

/**
 * Calculate minimum stake needed for all bets to meet minimum bet requirement
 */
export function calculateMinimumViableStake(
  horses: DutchHorse[],
  minimumBet: number = DEFAULT_MINIMUM_BET
): number | null {
  if (horses.length < 2) return null;

  const sumOfImpliedProbs = horses.reduce((sum, horse) => {
    return sum + calculateImpliedProbability(horse.decimalOdds);
  }, 0);

  const minImpliedProb = Math.min(...horses.map((h) => calculateImpliedProbability(h.decimalOdds)));

  // For smallest bet to be >= minimumBet:
  // Stake * minImpliedProb / Sum >= minimumBet
  // Stake >= minimumBet * Sum / minImpliedProb
  const minStake = (minimumBet * sumOfImpliedProbs) / minImpliedProb;

  return Math.max(MINIMUM_TOTAL_STAKE, Math.ceil(minStake));
}
