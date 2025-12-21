/**
 * Exotic Bet Comparison
 *
 * Compare bet structures side-by-side:
 * - Structure (box/key/wheel)
 * - Cost
 * - Combinations covered
 * - Payout range
 * - Expected value
 * - Hit probability
 *
 * Displays as comparison table and recommends highest EV option
 */

import { validateNumber } from '../sanitization';
import {
  calculateExactaBoxCost,
  calculateExactaKeyOverCost,
  calculateExactaWheelCost,
  calculateTrifectaBoxCost,
  calculateTrifectaKeyCost,
  calculateTrifectaPartWheelCost,
  calculateTrifectaWheelCost,
  calculateSuperfectaBoxCost,
  calculateSuperfectaKeyCost,
  calculateSuperfectaPartWheelCost,
  type ExoticBetType,
  type BetStructure,
  type ExoticCost,
} from './exoticCalculator';
import { quickPayoutEstimate, type HorseOdds } from './exoticPayoutEstimator';

// ============================================================================
// TYPES
// ============================================================================

export interface ComparisonRow {
  /** Unique ID */
  id: string;
  /** Bet type */
  type: ExoticBetType;
  /** Structure name */
  structure: BetStructure;
  /** Display name */
  displayName: string;
  /** Cost breakdown */
  cost: ExoticCost;
  /** Number of combinations */
  combinations: number;
  /** Payout range */
  payoutRange: {
    min: number;
    max: number;
    likely: number;
    display: string;
  };
  /** Expected value per dollar */
  expectedValue: number;
  /** Expected value display */
  evDisplay: string;
  /** Hit probability percentage */
  hitProbability: number;
  /** Hit probability display */
  hitDisplay: string;
  /** Is this the recommended option */
  isRecommended: boolean;
  /** Recommendation score (higher = better) */
  score: number;
  /** Notes/reasoning */
  notes: string;
}

export interface ComparisonTable {
  /** All comparison rows */
  rows: ComparisonRow[];
  /** The recommended row */
  recommended: ComparisonRow | null;
  /** Budget used for comparison */
  budget: number;
  /** Summary text */
  summary: string;
  /** Whether comparison is valid */
  isValid: boolean;
  /** Error if not valid */
  error?: string;
}

export interface ComparisonConfig {
  /** Budget amount */
  budget: number;
  /** Horses with odds for comparison */
  horses: HorseOdds[];
  /** Total field size */
  fieldSize: number;
  /** Which bet types to compare */
  betTypes?: ExoticBetType[];
  /** Which structures to compare */
  structures?: BetStructure[];
  /** Maximum number of options to return */
  maxOptions?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Base hit probabilities by bet type and structure */
const HIT_PROBABILITY: Record<ExoticBetType, Record<BetStructure, number>> = {
  exacta: {
    box: 0.2,
    key_over: 0.12,
    key_under: 0.1,
    wheel: 0.15,
    straight: 0.03,
    part_wheel: 0.15,
  },
  trifecta: {
    box: 0.08,
    key_over: 0.04,
    key_under: 0.03,
    wheel: 0.05,
    straight: 0.005,
    part_wheel: 0.06,
  },
  superfecta: {
    box: 0.02,
    key_over: 0.008,
    key_under: 0.005,
    wheel: 0.01,
    straight: 0.0005,
    part_wheel: 0.015,
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate hit probability based on horses and structure
 */
function calculateHitProbability(
  betType: ExoticBetType,
  structure: BetStructure,
  horses: HorseOdds[],
  combinations: number,
  fieldSize: number
): number {
  const baseProb = HIT_PROBABILITY[betType][structure] || 0.05;

  // Adjust for number of horses used
  const coverageRatio = combinations / (fieldSize * (fieldSize - 1));

  // Adjust for horse quality (lower odds = higher probability)
  const avgOdds = horses.reduce((sum, h) => sum + h.odds, 0) / horses.length;
  const qualityFactor = Math.min(1.5, 5 / avgOdds);

  return Math.min(0.5, baseProb * (1 + coverageRatio) * qualityFactor);
}

/**
 * Calculate expected value
 */
function calculateExpectedValue(
  hitProbability: number,
  payoutLikely: number,
  cost: number
): number {
  return hitProbability * payoutLikely - cost;
}

/**
 * Calculate comparison score
 * Higher score = better bet
 */
function calculateScore(row: Partial<ComparisonRow>): number {
  const evWeight = 0.4;
  const hitWeight = 0.3;
  const costWeight = 0.2;
  const payoutWeight = 0.1;

  const evScore = Math.max(0, (row.expectedValue || 0) + 10) / 20;
  const hitScore = (row.hitProbability || 0) * 5;
  const costScore = 1 / Math.max(1, (row.cost?.total || 100) / 10);
  const payoutScore = Math.log10(Math.max(1, row.payoutRange?.likely || 1)) / 3;

  return (
    (evScore * evWeight +
      hitScore * hitWeight +
      costScore * costWeight +
      payoutScore * payoutWeight) *
    100
  );
}

// ============================================================================
// COMPARISON GENERATORS
// ============================================================================

/**
 * Generate exacta comparison rows
 */
function generateExactaComparisons(config: ComparisonConfig, baseBet: number): ComparisonRow[] {
  const { budget, horses, fieldSize } = config;
  const rows: ComparisonRow[] = [];
  const odds = horses.map((h) => h.odds);

  // Box all horses
  if (horses.length >= 2) {
    const horseNums = horses.map((h) => h.programNumber);
    const cost = calculateExactaBoxCost(horseNums, baseBet);

    if (cost.isValid && cost.total <= budget) {
      const payoutRange = quickPayoutEstimate('exacta', odds, baseBet);
      const hitProb = calculateHitProbability(
        'exacta',
        'box',
        horses,
        cost.combinations,
        fieldSize
      );
      const ev = calculateExpectedValue(hitProb, payoutRange.likely, cost.total);

      const row: ComparisonRow = {
        id: 'exacta-box-all',
        type: 'exacta',
        structure: 'box',
        displayName: `Box ${horses.length}`,
        cost,
        combinations: cost.combinations,
        payoutRange,
        expectedValue: ev,
        evDisplay: `${ev >= 0 ? '+' : ''}$${ev.toFixed(2)}`,
        hitProbability: hitProb * 100,
        hitDisplay: `${(hitProb * 100).toFixed(1)}%`,
        isRecommended: false,
        score: 0,
        notes: `Box all ${horses.length} selected horses`,
      };
      row.score = calculateScore(row);
      rows.push(row);
    }
  }

  // Key over (top horse over others)
  if (horses.length >= 2) {
    const keyHorse = [horses[0].programNumber];
    const otherHorses = horses.slice(1).map((h) => h.programNumber);
    const cost = calculateExactaKeyOverCost(keyHorse, otherHorses, baseBet);

    if (cost.isValid && cost.total <= budget) {
      const payoutRange = quickPayoutEstimate('exacta', odds, baseBet);
      const hitProb = calculateHitProbability(
        'exacta',
        'key_over',
        horses,
        cost.combinations,
        fieldSize
      );
      const ev = calculateExpectedValue(hitProb, payoutRange.likely, cost.total);

      const row: ComparisonRow = {
        id: 'exacta-key-over',
        type: 'exacta',
        structure: 'key_over',
        displayName: `Key #${keyHorse[0]}`,
        cost,
        combinations: cost.combinations,
        payoutRange,
        expectedValue: ev,
        evDisplay: `${ev >= 0 ? '+' : ''}$${ev.toFixed(2)}`,
        hitProbability: hitProb * 100,
        hitDisplay: `${(hitProb * 100).toFixed(1)}%`,
        isRecommended: false,
        score: 0,
        notes: `#${keyHorse[0]} must win, others second`,
      };
      row.score = calculateScore(row);
      rows.push(row);
    }
  }

  // Wheel (top horse over entire field)
  if (horses.length >= 1 && fieldSize > horses.length) {
    const keyHorse = [horses[0].programNumber];
    const cost = calculateExactaWheelCost(keyHorse, fieldSize, baseBet);

    if (cost.isValid && cost.total <= budget) {
      const payoutRange = quickPayoutEstimate('exacta', odds, baseBet);
      const hitProb = calculateHitProbability(
        'exacta',
        'wheel',
        horses,
        cost.combinations,
        fieldSize
      );
      const ev = calculateExpectedValue(hitProb, payoutRange.likely * 1.3, cost.total);

      const row: ComparisonRow = {
        id: 'exacta-wheel',
        type: 'exacta',
        structure: 'wheel',
        displayName: `Wheel #${keyHorse[0]}`,
        cost,
        combinations: cost.combinations,
        payoutRange: {
          ...payoutRange,
          max: Math.round(payoutRange.max * 1.5),
          display: payoutRange.display,
        },
        expectedValue: ev,
        evDisplay: `${ev >= 0 ? '+' : ''}$${ev.toFixed(2)}`,
        hitProbability: hitProb * 100,
        hitDisplay: `${(hitProb * 100).toFixed(1)}%`,
        isRecommended: false,
        score: 0,
        notes: `#${keyHorse[0]} over all ${fieldSize - 1} others`,
      };
      row.score = calculateScore(row);
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Generate trifecta comparison rows
 */
function generateTrifectaComparisons(config: ComparisonConfig, baseBet: number): ComparisonRow[] {
  const { budget, horses, fieldSize } = config;
  const rows: ComparisonRow[] = [];
  const odds = horses.map((h) => h.odds);

  // Box all horses
  if (horses.length >= 3) {
    const horseNums = horses.slice(0, 5).map((h) => h.programNumber);
    const cost = calculateTrifectaBoxCost(horseNums, baseBet);

    if (cost.isValid && cost.total <= budget) {
      const selectedOdds = horses.slice(0, horseNums.length).map((h) => h.odds);
      const payoutRange = quickPayoutEstimate('trifecta', selectedOdds, baseBet);
      const hitProb = calculateHitProbability(
        'trifecta',
        'box',
        horses,
        cost.combinations,
        fieldSize
      );
      const ev = calculateExpectedValue(hitProb, payoutRange.likely, cost.total);

      const row: ComparisonRow = {
        id: 'trifecta-box-all',
        type: 'trifecta',
        structure: 'box',
        displayName: `Box ${horseNums.length}`,
        cost,
        combinations: cost.combinations,
        payoutRange,
        expectedValue: ev,
        evDisplay: `${ev >= 0 ? '+' : ''}$${ev.toFixed(2)}`,
        hitProbability: hitProb * 100,
        hitDisplay: `${(hitProb * 100).toFixed(1)}%`,
        isRecommended: false,
        score: 0,
        notes: `Box ${horseNums.length} horses for all finish orders`,
      };
      row.score = calculateScore(row);
      rows.push(row);
    }
  }

  // Key bet (top horse first, others for 2nd/3rd)
  if (horses.length >= 3) {
    const keyHorse = [horses[0].programNumber];
    const otherHorses = horses.slice(1).map((h) => h.programNumber);
    const cost = calculateTrifectaKeyCost(keyHorse, otherHorses, otherHorses, baseBet);

    if (cost.isValid && cost.total <= budget) {
      const payoutRange = quickPayoutEstimate('trifecta', odds, baseBet);
      const hitProb = calculateHitProbability(
        'trifecta',
        'key_over',
        horses,
        cost.combinations,
        fieldSize
      );
      const ev = calculateExpectedValue(hitProb, payoutRange.likely, cost.total);

      const row: ComparisonRow = {
        id: 'trifecta-key',
        type: 'trifecta',
        structure: 'key_over',
        displayName: `Key #${keyHorse[0]}`,
        cost,
        combinations: cost.combinations,
        payoutRange,
        expectedValue: ev,
        evDisplay: `${ev >= 0 ? '+' : ''}$${ev.toFixed(2)}`,
        hitProbability: hitProb * 100,
        hitDisplay: `${(hitProb * 100).toFixed(1)}%`,
        isRecommended: false,
        score: 0,
        notes: `#${keyHorse[0]} must win, others fill places`,
      };
      row.score = calculateScore(row);
      rows.push(row);
    }
  }

  // Part wheel (2 for 1st, all for 2nd/3rd)
  if (horses.length >= 3) {
    const firstHorses = horses.slice(0, 2).map((h) => h.programNumber);
    const otherHorses = horses.map((h) => h.programNumber);
    const cost = calculateTrifectaPartWheelCost(firstHorses, otherHorses, otherHorses, baseBet);

    if (cost.isValid && cost.total <= budget) {
      const payoutRange = quickPayoutEstimate('trifecta', odds, baseBet);
      const hitProb = calculateHitProbability(
        'trifecta',
        'part_wheel',
        horses,
        cost.combinations,
        fieldSize
      );
      const ev = calculateExpectedValue(hitProb, payoutRange.likely, cost.total);

      const row: ComparisonRow = {
        id: 'trifecta-part-wheel',
        type: 'trifecta',
        structure: 'part_wheel',
        displayName: 'Part Wheel',
        cost,
        combinations: cost.combinations,
        payoutRange,
        expectedValue: ev,
        evDisplay: `${ev >= 0 ? '+' : ''}$${ev.toFixed(2)}`,
        hitProbability: hitProb * 100,
        hitDisplay: `${(hitProb * 100).toFixed(1)}%`,
        isRecommended: false,
        score: 0,
        notes: `Top 2 for win, all for 2nd/3rd`,
      };
      row.score = calculateScore(row);
      rows.push(row);
    }
  }

  // Wheel
  if (horses.length >= 1 && fieldSize >= 3) {
    const keyHorse = [horses[0].programNumber];
    const cost = calculateTrifectaWheelCost(keyHorse, fieldSize, baseBet);

    if (cost.isValid && cost.total <= budget) {
      const payoutRange = quickPayoutEstimate('trifecta', odds, baseBet);
      const hitProb = calculateHitProbability(
        'trifecta',
        'wheel',
        horses,
        cost.combinations,
        fieldSize
      );
      const ev = calculateExpectedValue(hitProb, payoutRange.likely * 1.5, cost.total);

      const row: ComparisonRow = {
        id: 'trifecta-wheel',
        type: 'trifecta',
        structure: 'wheel',
        displayName: `Wheel #${keyHorse[0]}`,
        cost,
        combinations: cost.combinations,
        payoutRange: {
          ...payoutRange,
          max: Math.round(payoutRange.max * 2),
          display: payoutRange.display,
        },
        expectedValue: ev,
        evDisplay: `${ev >= 0 ? '+' : ''}$${ev.toFixed(2)}`,
        hitProbability: hitProb * 100,
        hitDisplay: `${(hitProb * 100).toFixed(1)}%`,
        isRecommended: false,
        score: 0,
        notes: `#${keyHorse[0]} with ALL for 2nd and 3rd`,
      };
      row.score = calculateScore(row);
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Generate superfecta comparison rows
 */
function generateSuperfectaComparisons(config: ComparisonConfig, baseBet: number): ComparisonRow[] {
  const { budget, horses, fieldSize } = config;
  const rows: ComparisonRow[] = [];
  const odds = horses.map((h) => h.odds);

  // Box top 4-5 horses
  if (horses.length >= 4) {
    const horseNums = horses.slice(0, 5).map((h) => h.programNumber);
    const cost = calculateSuperfectaBoxCost(horseNums, baseBet);

    if (cost.isValid && cost.total <= budget) {
      const selectedOdds = horses.slice(0, horseNums.length).map((h) => h.odds);
      const payoutRange = quickPayoutEstimate('superfecta', selectedOdds, baseBet);
      const hitProb = calculateHitProbability(
        'superfecta',
        'box',
        horses,
        cost.combinations,
        fieldSize
      );
      const ev = calculateExpectedValue(hitProb, payoutRange.likely, cost.total);

      const row: ComparisonRow = {
        id: 'superfecta-box',
        type: 'superfecta',
        structure: 'box',
        displayName: `Box ${horseNums.length}`,
        cost,
        combinations: cost.combinations,
        payoutRange,
        expectedValue: ev,
        evDisplay: `${ev >= 0 ? '+' : ''}$${ev.toFixed(2)}`,
        hitProbability: hitProb * 100,
        hitDisplay: `${(hitProb * 100).toFixed(1)}%`,
        isRecommended: false,
        score: 0,
        notes: `Box ${horseNums.length} horses for 1st-4th`,
      };
      row.score = calculateScore(row);
      rows.push(row);
    }
  }

  // Key bet
  if (horses.length >= 4) {
    const keyHorse = [horses[0].programNumber];
    const otherHorses = horses.slice(1).map((h) => h.programNumber);
    const cost = calculateSuperfectaKeyCost(
      keyHorse,
      otherHorses,
      otherHorses,
      otherHorses,
      baseBet
    );

    if (cost.isValid && cost.total <= budget) {
      const payoutRange = quickPayoutEstimate('superfecta', odds, baseBet);
      const hitProb = calculateHitProbability(
        'superfecta',
        'key_over',
        horses,
        cost.combinations,
        fieldSize
      );
      const ev = calculateExpectedValue(hitProb, payoutRange.likely, cost.total);

      const row: ComparisonRow = {
        id: 'superfecta-key',
        type: 'superfecta',
        structure: 'key_over',
        displayName: `Key #${keyHorse[0]}`,
        cost,
        combinations: cost.combinations,
        payoutRange,
        expectedValue: ev,
        evDisplay: `${ev >= 0 ? '+' : ''}$${ev.toFixed(2)}`,
        hitProbability: hitProb * 100,
        hitDisplay: `${(hitProb * 100).toFixed(1)}%`,
        isRecommended: false,
        score: 0,
        notes: `#${keyHorse[0]} must win, others fill 2-3-4`,
      };
      row.score = calculateScore(row);
      rows.push(row);
    }
  }

  // Part wheel
  if (horses.length >= 4) {
    const firstHorses = horses.slice(0, 2).map((h) => h.programNumber);
    const otherHorses = horses.map((h) => h.programNumber);
    const cost = calculateSuperfectaPartWheelCost(
      firstHorses,
      otherHorses,
      otherHorses,
      otherHorses,
      baseBet
    );

    if (cost.isValid && cost.total <= budget) {
      const payoutRange = quickPayoutEstimate('superfecta', odds, baseBet);
      const hitProb = calculateHitProbability(
        'superfecta',
        'part_wheel',
        horses,
        cost.combinations,
        fieldSize
      );
      const ev = calculateExpectedValue(hitProb, payoutRange.likely, cost.total);

      const row: ComparisonRow = {
        id: 'superfecta-part-wheel',
        type: 'superfecta',
        structure: 'part_wheel',
        displayName: 'Part Wheel',
        cost,
        combinations: cost.combinations,
        payoutRange,
        expectedValue: ev,
        evDisplay: `${ev >= 0 ? '+' : ''}$${ev.toFixed(2)}`,
        hitProbability: hitProb * 100,
        hitDisplay: `${(hitProb * 100).toFixed(1)}%`,
        isRecommended: false,
        score: 0,
        notes: `Top 2 for win, all others for 2-3-4`,
      };
      row.score = calculateScore(row);
      rows.push(row);
    }
  }

  return rows;
}

// ============================================================================
// MAIN COMPARISON FUNCTION
// ============================================================================

/**
 * Generate comparison table for exotic bets
 */
export function generateComparisonTable(config: ComparisonConfig): ComparisonTable {
  const {
    budget,
    horses,
    betTypes = ['exacta', 'trifecta', 'superfecta'],
    maxOptions = 10,
  } = config;

  const validatedBudget = validateNumber(budget, 20, { min: 1, max: 1000 });

  if (horses.length < 2) {
    return {
      rows: [],
      recommended: null,
      budget: validatedBudget,
      summary: 'At least 2 horses required for exotic bets',
      isValid: false,
      error: 'Not enough horses',
    };
  }

  const allRows: ComparisonRow[] = [];

  // Determine base bets based on budget
  const exactaBaseBet = Math.min(5, validatedBudget / 4);
  const trifectaBaseBet = Math.min(2, validatedBudget / 10);
  const superfectaBaseBet = Math.min(0.5, validatedBudget / 20);

  // Generate comparisons for each bet type
  if (betTypes.includes('exacta') && horses.length >= 2) {
    allRows.push(...generateExactaComparisons(config, exactaBaseBet));
  }

  if (betTypes.includes('trifecta') && horses.length >= 3) {
    allRows.push(...generateTrifectaComparisons(config, trifectaBaseBet));
  }

  if (betTypes.includes('superfecta') && horses.length >= 4) {
    allRows.push(...generateSuperfectaComparisons(config, superfectaBaseBet));
  }

  // Filter to options within budget and sort by score
  const filteredRows = allRows
    .filter((r) => r.cost.isValid && r.cost.total <= validatedBudget)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxOptions);

  if (filteredRows.length === 0) {
    return {
      rows: [],
      recommended: null,
      budget: validatedBudget,
      summary: 'No viable exotic options within budget',
      isValid: false,
      error: 'No options fit within budget',
    };
  }

  // Mark top recommendation
  filteredRows[0].isRecommended = true;
  const recommended = filteredRows[0];

  return {
    rows: filteredRows,
    recommended,
    budget: validatedBudget,
    summary: `Recommended: ${recommended.displayName} ${recommended.type} for $${recommended.cost.total.toFixed(2)} (${recommended.combinations} combos, ${recommended.hitDisplay} hit rate)`,
    isValid: true,
  };
}

/**
 * Format comparison table as string (for console/debugging)
 */
export function formatComparisonTable(table: ComparisonTable): string {
  if (!table.isValid) {
    return table.error || 'Invalid comparison';
  }

  const header = '| Type | Cost | Combos | Payout | EV | Hit% |';
  const separator = '|------|------|--------|--------|-----|------|';

  const rows = table.rows.map((row) => {
    const typeStr = `${row.type} ${row.displayName}`.padEnd(20);
    const costStr = `$${row.cost.total.toFixed(2)}`.padStart(7);
    const comboStr = row.combinations.toString().padStart(5);
    const payoutStr = `$${row.payoutRange.min}-${row.payoutRange.max}`.padStart(10);
    const evStr = row.evDisplay.padStart(6);
    const hitStr = row.hitDisplay.padStart(5);
    const rec = row.isRecommended ? ' *' : '';

    return `| ${typeStr} | ${costStr} | ${comboStr} | ${payoutStr} | ${evStr} | ${hitStr} |${rec}`;
  });

  return [header, separator, ...rows, '', `* Recommended: ${table.summary}`].join('\n');
}

/**
 * Get quick comparison for a specific bet type
 */
export function compareStructuresForType(
  betType: ExoticBetType,
  horses: HorseOdds[],
  budget: number,
  fieldSize: number
): ComparisonTable {
  return generateComparisonTable({
    budget,
    horses,
    fieldSize,
    betTypes: [betType],
    maxOptions: 5,
  });
}
