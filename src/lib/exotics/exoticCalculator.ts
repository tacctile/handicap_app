/**
 * Exotic Bet Cost Calculator
 *
 * Calculates costs for all exotic bet types:
 * - Exacta (box, key over, key under, wheel)
 * - Trifecta (box, key, part-wheel, wheel)
 * - Superfecta (box, key, part-wheel)
 *
 * Usage:
 * - calculateExactaCost: Calculate exacta bet costs
 * - calculateTrifectaCost: Calculate trifecta bet costs
 * - calculateSuperfectaCost: Calculate superfecta bet costs
 * - calculateExoticCost: Universal calculator for any exotic type
 */

import { validateNumber } from '../sanitization';

// ============================================================================
// TYPES
// ============================================================================

export type ExoticBetType = 'exacta' | 'trifecta' | 'superfecta';

export type BetStructure = 'box' | 'key_over' | 'key_under' | 'wheel' | 'part_wheel' | 'straight';

export interface ExoticCost {
  /** Total cost of the bet */
  total: number;
  /** Number of combinations covered */
  combinations: number;
  /** Cost per single combination */
  costPerCombo: number;
  /** Base bet amount used */
  baseBet: number;
  /** Bet type */
  betType: ExoticBetType;
  /** Bet structure */
  structure: BetStructure;
  /** Detailed breakdown of the calculation */
  breakdown: string;
  /** Whether the calculation is valid */
  isValid: boolean;
  /** Error message if invalid */
  error?: string;
}

export interface ExoticBetConfig {
  /** Type of exotic bet */
  betType: ExoticBetType;
  /** Bet structure (box, key, wheel, etc.) */
  structure: BetStructure;
  /** Base bet amount ($0.10, $0.50, $1, $2, etc.) */
  baseBet: number;
  /** Horses in first position (for key/part-wheel bets) */
  firstPosition: number[];
  /** Horses in second position */
  secondPosition: number[];
  /** Horses in third position (for trifecta/superfecta) */
  thirdPosition?: number[];
  /** Horses in fourth position (for superfecta) */
  fourthPosition?: number[];
  /** Total field size (for wheel bets) */
  fieldSize?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum horses required for each bet type */
export const MIN_HORSES: Record<ExoticBetType, number> = {
  exacta: 2,
  trifecta: 3,
  superfecta: 4,
};

/** Available base bet amounts */
export const BASE_BET_OPTIONS = [0.1, 0.5, 1, 2, 5, 10] as const;

/** Default base bets by bet type */
export const DEFAULT_BASE_BETS: Record<ExoticBetType, number> = {
  exacta: 2,
  trifecta: 1,
  superfecta: 0.1,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate factorial
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

/**
 * Calculate permutations: P(n, r) = n! / (n - r)!
 */
function permutations(n: number, r: number): number {
  if (n < r || r < 0 || n < 0) return 0;
  return factorial(n) / factorial(n - r);
}

/**
 * Sanitize and validate horse numbers
 */
function sanitizeHorseNumbers(horses: number[]): number[] {
  if (!Array.isArray(horses)) return [];
  return [
    ...new Set(
      horses
        .filter((h) => typeof h === 'number' && Number.isFinite(h) && h > 0)
        .map((h) => Math.floor(h))
    ),
  ];
}

/**
 * Validate base bet amount
 */
function validateBaseBet(amount: number): number {
  const validated = validateNumber(amount, 2, { min: 0.1, max: 100 });
  return Math.round(validated * 100) / 100;
}

/**
 * Create error result
 */
function createErrorResult(
  betType: ExoticBetType,
  structure: BetStructure,
  baseBet: number,
  error: string
): ExoticCost {
  return {
    total: 0,
    combinations: 0,
    costPerCombo: baseBet,
    baseBet,
    betType,
    structure,
    breakdown: error,
    isValid: false,
    error,
  };
}

// ============================================================================
// EXACTA CALCULATIONS
// ============================================================================

/**
 * Calculate exacta box cost
 * Formula: horses × (horses - 1) × base bet
 * Example: 3-horse box at $2 = 3 × 2 × $2 = $12
 */
export function calculateExactaBoxCost(horses: number[], baseBet: number): ExoticCost {
  const sanitizedHorses = sanitizeHorseNumbers(horses);
  const validatedBet = validateBaseBet(baseBet);

  if (sanitizedHorses.length < 2) {
    return createErrorResult(
      'exacta',
      'box',
      validatedBet,
      'Exacta box requires at least 2 horses'
    );
  }

  const n = sanitizedHorses.length;
  const combinations = n * (n - 1);
  const total = combinations * validatedBet;

  return {
    total: Math.round(total * 100) / 100,
    combinations,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'exacta',
    structure: 'box',
    breakdown: `${n} horses × ${n - 1} combinations × $${validatedBet} = $${total.toFixed(2)}`,
    isValid: true,
  };
}

/**
 * Calculate exacta key over cost
 * Formula: 1 × other horses × base bet
 * Key horse must finish first, other horses can finish second
 */
export function calculateExactaKeyOverCost(
  keyHorses: number[],
  otherHorses: number[],
  baseBet: number
): ExoticCost {
  const sanitizedKey = sanitizeHorseNumbers(keyHorses);
  const sanitizedOthers = sanitizeHorseNumbers(otherHorses);
  const validatedBet = validateBaseBet(baseBet);

  // Remove any key horses from others
  const filteredOthers = sanitizedOthers.filter((h) => !sanitizedKey.includes(h));

  if (sanitizedKey.length < 1) {
    return createErrorResult(
      'exacta',
      'key_over',
      validatedBet,
      'Exacta key over requires at least 1 key horse'
    );
  }

  if (filteredOthers.length < 1) {
    return createErrorResult(
      'exacta',
      'key_over',
      validatedBet,
      'Exacta key over requires at least 1 other horse'
    );
  }

  const combinations = sanitizedKey.length * filteredOthers.length;
  const total = combinations * validatedBet;

  return {
    total: Math.round(total * 100) / 100,
    combinations,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'exacta',
    structure: 'key_over',
    breakdown: `${sanitizedKey.length} key × ${filteredOthers.length} others × $${validatedBet} = $${total.toFixed(2)}`,
    isValid: true,
  };
}

/**
 * Calculate exacta key under cost
 * Formula: other horses × 1 × base bet
 * Other horses can finish first, key horse must finish second
 */
export function calculateExactaKeyUnderCost(
  keyHorses: number[],
  otherHorses: number[],
  baseBet: number
): ExoticCost {
  const sanitizedKey = sanitizeHorseNumbers(keyHorses);
  const sanitizedOthers = sanitizeHorseNumbers(otherHorses);
  const validatedBet = validateBaseBet(baseBet);

  // Remove any key horses from others
  const filteredOthers = sanitizedOthers.filter((h) => !sanitizedKey.includes(h));

  if (sanitizedKey.length < 1) {
    return createErrorResult(
      'exacta',
      'key_under',
      validatedBet,
      'Exacta key under requires at least 1 key horse'
    );
  }

  if (filteredOthers.length < 1) {
    return createErrorResult(
      'exacta',
      'key_under',
      validatedBet,
      'Exacta key under requires at least 1 other horse'
    );
  }

  const combinations = filteredOthers.length * sanitizedKey.length;
  const total = combinations * validatedBet;

  return {
    total: Math.round(total * 100) / 100,
    combinations,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'exacta',
    structure: 'key_under',
    breakdown: `${filteredOthers.length} others × ${sanitizedKey.length} key × $${validatedBet} = $${total.toFixed(2)}`,
    isValid: true,
  };
}

/**
 * Calculate exacta wheel cost
 * Formula: 1 × (field size - 1) × base bet
 * Key horse with all other horses in the field
 */
export function calculateExactaWheelCost(
  keyHorses: number[],
  fieldSize: number,
  baseBet: number
): ExoticCost {
  const sanitizedKey = sanitizeHorseNumbers(keyHorses);
  const validatedBet = validateBaseBet(baseBet);
  const validatedField = validateNumber(fieldSize, 10, { min: 2, max: 20 });

  if (sanitizedKey.length < 1) {
    return createErrorResult(
      'exacta',
      'wheel',
      validatedBet,
      'Exacta wheel requires at least 1 key horse'
    );
  }

  if (validatedField < 2) {
    return createErrorResult('exacta', 'wheel', validatedBet, 'Field size must be at least 2');
  }

  const otherHorses = validatedField - sanitizedKey.length;
  const combinations = sanitizedKey.length * otherHorses;
  const total = combinations * validatedBet;

  return {
    total: Math.round(total * 100) / 100,
    combinations,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'exacta',
    structure: 'wheel',
    breakdown: `${sanitizedKey.length} key × ${otherHorses} field × $${validatedBet} = $${total.toFixed(2)}`,
    isValid: true,
  };
}

/**
 * Calculate straight exacta cost
 * Single combination: 1 × base bet
 */
export function calculateExactaStraightCost(
  firstHorse: number,
  secondHorse: number,
  baseBet: number
): ExoticCost {
  const validatedBet = validateBaseBet(baseBet);

  if (!Number.isFinite(firstHorse) || firstHorse < 1) {
    return createErrorResult(
      'exacta',
      'straight',
      validatedBet,
      'First horse must be a valid number'
    );
  }

  if (!Number.isFinite(secondHorse) || secondHorse < 1) {
    return createErrorResult(
      'exacta',
      'straight',
      validatedBet,
      'Second horse must be a valid number'
    );
  }

  if (firstHorse === secondHorse) {
    return createErrorResult(
      'exacta',
      'straight',
      validatedBet,
      'First and second horses must be different'
    );
  }

  return {
    total: validatedBet,
    combinations: 1,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'exacta',
    structure: 'straight',
    breakdown: `#${firstHorse} over #${secondHorse} × $${validatedBet} = $${validatedBet.toFixed(2)}`,
    isValid: true,
  };
}

// ============================================================================
// TRIFECTA CALCULATIONS
// ============================================================================

/**
 * Calculate trifecta box cost
 * Formula: horses × (horses - 1) × (horses - 2) × base bet
 * Example: 4-horse box at $1 = 4 × 3 × 2 × $1 = $24
 */
export function calculateTrifectaBoxCost(horses: number[], baseBet: number): ExoticCost {
  const sanitizedHorses = sanitizeHorseNumbers(horses);
  const validatedBet = validateBaseBet(baseBet);

  if (sanitizedHorses.length < 3) {
    return createErrorResult(
      'trifecta',
      'box',
      validatedBet,
      'Trifecta box requires at least 3 horses'
    );
  }

  const n = sanitizedHorses.length;
  const combinations = permutations(n, 3);
  const total = combinations * validatedBet;

  return {
    total: Math.round(total * 100) / 100,
    combinations,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'trifecta',
    structure: 'box',
    breakdown: `${n} × ${n - 1} × ${n - 2} × $${validatedBet} = $${total.toFixed(2)}`,
    isValid: true,
  };
}

/**
 * Calculate trifecta key cost
 * Key horse first, second choices second, third choices third
 * Formula: 1 × second choices × third choices × base bet
 */
export function calculateTrifectaKeyCost(
  keyHorses: number[],
  secondHorses: number[],
  thirdHorses: number[],
  baseBet: number
): ExoticCost {
  const sanitizedKey = sanitizeHorseNumbers(keyHorses);
  const sanitizedSecond = sanitizeHorseNumbers(secondHorses);
  const sanitizedThird = sanitizeHorseNumbers(thirdHorses);
  const validatedBet = validateBaseBet(baseBet);

  // Remove key horses from second and third
  const filteredSecond = sanitizedSecond.filter((h) => !sanitizedKey.includes(h));
  const filteredThird = sanitizedThird.filter((h) => !sanitizedKey.includes(h));

  if (sanitizedKey.length < 1) {
    return createErrorResult(
      'trifecta',
      'key_over',
      validatedBet,
      'Trifecta key requires at least 1 key horse'
    );
  }

  if (filteredSecond.length < 1) {
    return createErrorResult(
      'trifecta',
      'key_over',
      validatedBet,
      'Trifecta key requires at least 1 second position horse'
    );
  }

  if (filteredThird.length < 1) {
    return createErrorResult(
      'trifecta',
      'key_over',
      validatedBet,
      'Trifecta key requires at least 1 third position horse'
    );
  }

  // Calculate combinations considering overlapping second/third horses
  let combinations = 0;
  for (const first of sanitizedKey) {
    for (const second of filteredSecond) {
      for (const third of filteredThird) {
        if (first !== second && first !== third && second !== third) {
          combinations++;
        }
      }
    }
  }

  const total = combinations * validatedBet;

  return {
    total: Math.round(total * 100) / 100,
    combinations,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'trifecta',
    structure: 'key_over',
    breakdown: `${sanitizedKey.length} key × ${filteredSecond.length} second × ${filteredThird.length} third = ${combinations} combos × $${validatedBet} = $${total.toFixed(2)}`,
    isValid: true,
  };
}

/**
 * Calculate trifecta part-wheel cost
 * Multiple horses in each position
 * Formula: first choices × second choices × third choices × base bet
 * (accounting for no duplicate horses in same combination)
 */
export function calculateTrifectaPartWheelCost(
  firstHorses: number[],
  secondHorses: number[],
  thirdHorses: number[],
  baseBet: number
): ExoticCost {
  const sanitizedFirst = sanitizeHorseNumbers(firstHorses);
  const sanitizedSecond = sanitizeHorseNumbers(secondHorses);
  const sanitizedThird = sanitizeHorseNumbers(thirdHorses);
  const validatedBet = validateBaseBet(baseBet);

  if (sanitizedFirst.length < 1) {
    return createErrorResult(
      'trifecta',
      'part_wheel',
      validatedBet,
      'Trifecta part-wheel requires at least 1 first position horse'
    );
  }

  if (sanitizedSecond.length < 1) {
    return createErrorResult(
      'trifecta',
      'part_wheel',
      validatedBet,
      'Trifecta part-wheel requires at least 1 second position horse'
    );
  }

  if (sanitizedThird.length < 1) {
    return createErrorResult(
      'trifecta',
      'part_wheel',
      validatedBet,
      'Trifecta part-wheel requires at least 1 third position horse'
    );
  }

  // Calculate combinations excluding duplicates
  let combinations = 0;
  for (const first of sanitizedFirst) {
    for (const second of sanitizedSecond) {
      for (const third of sanitizedThird) {
        if (first !== second && first !== third && second !== third) {
          combinations++;
        }
      }
    }
  }

  if (combinations === 0) {
    return createErrorResult(
      'trifecta',
      'part_wheel',
      validatedBet,
      'No valid combinations possible with selected horses'
    );
  }

  const total = combinations * validatedBet;

  return {
    total: Math.round(total * 100) / 100,
    combinations,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'trifecta',
    structure: 'part_wheel',
    breakdown: `${sanitizedFirst.length} first × ${sanitizedSecond.length} second × ${sanitizedThird.length} third = ${combinations} combos × $${validatedBet} = $${total.toFixed(2)}`,
    isValid: true,
  };
}

/**
 * Calculate trifecta wheel cost
 * Key horse first, all others for second and third
 * Formula: 1 × (field - 1) × (field - 2) × base bet
 */
export function calculateTrifectaWheelCost(
  keyHorses: number[],
  fieldSize: number,
  baseBet: number
): ExoticCost {
  const sanitizedKey = sanitizeHorseNumbers(keyHorses);
  const validatedBet = validateBaseBet(baseBet);
  const validatedField = validateNumber(fieldSize, 10, { min: 3, max: 20 });

  if (sanitizedKey.length < 1) {
    return createErrorResult(
      'trifecta',
      'wheel',
      validatedBet,
      'Trifecta wheel requires at least 1 key horse'
    );
  }

  if (validatedField < 3) {
    return createErrorResult(
      'trifecta',
      'wheel',
      validatedBet,
      'Field size must be at least 3 for trifecta'
    );
  }

  const otherHorses = validatedField - sanitizedKey.length;
  const combinations = sanitizedKey.length * otherHorses * (otherHorses - 1);
  const total = combinations * validatedBet;

  return {
    total: Math.round(total * 100) / 100,
    combinations,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'trifecta',
    structure: 'wheel',
    breakdown: `${sanitizedKey.length} key × ${otherHorses} × ${otherHorses - 1} × $${validatedBet} = $${total.toFixed(2)}`,
    isValid: true,
  };
}

// ============================================================================
// SUPERFECTA CALCULATIONS
// ============================================================================

/**
 * Calculate superfecta box cost
 * Formula: horses × (horses - 1) × (horses - 2) × (horses - 3) × base bet
 * Example: 5-horse box at $0.50 = 5 × 4 × 3 × 2 × $0.50 = $60
 */
export function calculateSuperfectaBoxCost(horses: number[], baseBet: number): ExoticCost {
  const sanitizedHorses = sanitizeHorseNumbers(horses);
  const validatedBet = validateBaseBet(baseBet);

  if (sanitizedHorses.length < 4) {
    return createErrorResult(
      'superfecta',
      'box',
      validatedBet,
      'Superfecta box requires at least 4 horses'
    );
  }

  const n = sanitizedHorses.length;
  const combinations = permutations(n, 4);
  const total = combinations * validatedBet;

  return {
    total: Math.round(total * 100) / 100,
    combinations,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'superfecta',
    structure: 'box',
    breakdown: `${n} × ${n - 1} × ${n - 2} × ${n - 3} × $${validatedBet} = $${total.toFixed(2)}`,
    isValid: true,
  };
}

/**
 * Calculate superfecta key cost
 * Key horse first, others for second, third, fourth
 * Formula: 1 × second × third × fourth × base bet
 */
export function calculateSuperfectaKeyCost(
  keyHorses: number[],
  secondHorses: number[],
  thirdHorses: number[],
  fourthHorses: number[],
  baseBet: number
): ExoticCost {
  const sanitizedKey = sanitizeHorseNumbers(keyHorses);
  const sanitizedSecond = sanitizeHorseNumbers(secondHorses);
  const sanitizedThird = sanitizeHorseNumbers(thirdHorses);
  const sanitizedFourth = sanitizeHorseNumbers(fourthHorses);
  const validatedBet = validateBaseBet(baseBet);

  // Remove key horses from other positions
  const filteredSecond = sanitizedSecond.filter((h) => !sanitizedKey.includes(h));
  const filteredThird = sanitizedThird.filter((h) => !sanitizedKey.includes(h));
  const filteredFourth = sanitizedFourth.filter((h) => !sanitizedKey.includes(h));

  if (sanitizedKey.length < 1) {
    return createErrorResult(
      'superfecta',
      'key_over',
      validatedBet,
      'Superfecta key requires at least 1 key horse'
    );
  }

  if (filteredSecond.length < 1 || filteredThird.length < 1 || filteredFourth.length < 1) {
    return createErrorResult(
      'superfecta',
      'key_over',
      validatedBet,
      'Superfecta key requires at least 1 horse in each position'
    );
  }

  // Calculate combinations excluding duplicates
  let combinations = 0;
  for (const first of sanitizedKey) {
    for (const second of filteredSecond) {
      for (const third of filteredThird) {
        for (const fourth of filteredFourth) {
          if (
            first !== second &&
            first !== third &&
            first !== fourth &&
            second !== third &&
            second !== fourth &&
            third !== fourth
          ) {
            combinations++;
          }
        }
      }
    }
  }

  const total = combinations * validatedBet;

  return {
    total: Math.round(total * 100) / 100,
    combinations,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'superfecta',
    structure: 'key_over',
    breakdown: `${sanitizedKey.length} key × ${filteredSecond.length} × ${filteredThird.length} × ${filteredFourth.length} = ${combinations} combos × $${validatedBet} = $${total.toFixed(2)}`,
    isValid: true,
  };
}

/**
 * Calculate superfecta part-wheel cost
 * Multiple horses in each position
 */
export function calculateSuperfectaPartWheelCost(
  firstHorses: number[],
  secondHorses: number[],
  thirdHorses: number[],
  fourthHorses: number[],
  baseBet: number
): ExoticCost {
  const sanitizedFirst = sanitizeHorseNumbers(firstHorses);
  const sanitizedSecond = sanitizeHorseNumbers(secondHorses);
  const sanitizedThird = sanitizeHorseNumbers(thirdHorses);
  const sanitizedFourth = sanitizeHorseNumbers(fourthHorses);
  const validatedBet = validateBaseBet(baseBet);

  if (
    sanitizedFirst.length < 1 ||
    sanitizedSecond.length < 1 ||
    sanitizedThird.length < 1 ||
    sanitizedFourth.length < 1
  ) {
    return createErrorResult(
      'superfecta',
      'part_wheel',
      validatedBet,
      'Superfecta part-wheel requires at least 1 horse in each position'
    );
  }

  // Calculate combinations excluding duplicates
  let combinations = 0;
  for (const first of sanitizedFirst) {
    for (const second of sanitizedSecond) {
      for (const third of sanitizedThird) {
        for (const fourth of sanitizedFourth) {
          if (
            first !== second &&
            first !== third &&
            first !== fourth &&
            second !== third &&
            second !== fourth &&
            third !== fourth
          ) {
            combinations++;
          }
        }
      }
    }
  }

  if (combinations === 0) {
    return createErrorResult(
      'superfecta',
      'part_wheel',
      validatedBet,
      'No valid combinations possible with selected horses'
    );
  }

  const total = combinations * validatedBet;

  return {
    total: Math.round(total * 100) / 100,
    combinations,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'superfecta',
    structure: 'part_wheel',
    breakdown: `${sanitizedFirst.length} × ${sanitizedSecond.length} × ${sanitizedThird.length} × ${sanitizedFourth.length} = ${combinations} combos × $${validatedBet} = $${total.toFixed(2)}`,
    isValid: true,
  };
}

/**
 * Calculate superfecta wheel cost
 * Key horse first, all others for remaining positions
 */
export function calculateSuperfectaWheelCost(
  keyHorses: number[],
  fieldSize: number,
  baseBet: number
): ExoticCost {
  const sanitizedKey = sanitizeHorseNumbers(keyHorses);
  const validatedBet = validateBaseBet(baseBet);
  const validatedField = validateNumber(fieldSize, 10, { min: 4, max: 20 });

  if (sanitizedKey.length < 1) {
    return createErrorResult(
      'superfecta',
      'wheel',
      validatedBet,
      'Superfecta wheel requires at least 1 key horse'
    );
  }

  if (validatedField < 4) {
    return createErrorResult(
      'superfecta',
      'wheel',
      validatedBet,
      'Field size must be at least 4 for superfecta'
    );
  }

  const otherHorses = validatedField - sanitizedKey.length;
  const combinations = sanitizedKey.length * permutations(otherHorses, 3);
  const total = combinations * validatedBet;

  return {
    total: Math.round(total * 100) / 100,
    combinations,
    costPerCombo: validatedBet,
    baseBet: validatedBet,
    betType: 'superfecta',
    structure: 'wheel',
    breakdown: `${sanitizedKey.length} key × ${otherHorses} × ${otherHorses - 1} × ${otherHorses - 2} × $${validatedBet} = $${total.toFixed(2)}`,
    isValid: true,
  };
}

// ============================================================================
// UNIVERSAL CALCULATOR
// ============================================================================

/**
 * Universal exotic bet cost calculator
 * Routes to appropriate calculation based on config
 */
export function calculateExoticCost(config: ExoticBetConfig): ExoticCost {
  const {
    betType,
    structure,
    baseBet,
    firstPosition,
    secondPosition,
    thirdPosition = [],
    fourthPosition = [],
    fieldSize = 10,
  } = config;

  switch (betType) {
    case 'exacta':
      switch (structure) {
        case 'box':
          return calculateExactaBoxCost(firstPosition, baseBet);
        case 'key_over':
          return calculateExactaKeyOverCost(firstPosition, secondPosition, baseBet);
        case 'key_under':
          return calculateExactaKeyUnderCost(firstPosition, secondPosition, baseBet);
        case 'wheel':
          return calculateExactaWheelCost(firstPosition, fieldSize, baseBet);
        case 'straight': {
          const first = firstPosition[0];
          const second = secondPosition[0];
          if (first === undefined || second === undefined) {
            return createErrorResult(
              betType,
              structure,
              baseBet,
              'Straight exacta requires first and second position horses'
            );
          }
          return calculateExactaStraightCost(first, second, baseBet);
        }
        default:
          return createErrorResult(betType, structure, baseBet, `Unknown structure: ${structure}`);
      }

    case 'trifecta':
      switch (structure) {
        case 'box':
          return calculateTrifectaBoxCost(firstPosition, baseBet);
        case 'key_over':
          return calculateTrifectaKeyCost(firstPosition, secondPosition, thirdPosition, baseBet);
        case 'part_wheel':
          return calculateTrifectaPartWheelCost(
            firstPosition,
            secondPosition,
            thirdPosition,
            baseBet
          );
        case 'wheel':
          return calculateTrifectaWheelCost(firstPosition, fieldSize, baseBet);
        default:
          return createErrorResult(betType, structure, baseBet, `Unknown structure: ${structure}`);
      }

    case 'superfecta':
      switch (structure) {
        case 'box':
          return calculateSuperfectaBoxCost(firstPosition, baseBet);
        case 'key_over':
          return calculateSuperfectaKeyCost(
            firstPosition,
            secondPosition,
            thirdPosition,
            fourthPosition,
            baseBet
          );
        case 'part_wheel':
          return calculateSuperfectaPartWheelCost(
            firstPosition,
            secondPosition,
            thirdPosition,
            fourthPosition,
            baseBet
          );
        case 'wheel':
          return calculateSuperfectaWheelCost(firstPosition, fieldSize, baseBet);
        default:
          return createErrorResult(betType, structure, baseBet, `Unknown structure: ${structure}`);
      }

    default:
      return createErrorResult(betType, structure, baseBet, `Unknown bet type: ${betType}`);
  }
}

/**
 * Calculate total cost for multiple exotic bets
 */
export function calculateTotalExoticCost(configs: ExoticBetConfig[]): {
  total: number;
  totalCombinations: number;
  bets: ExoticCost[];
  isValid: boolean;
  errors: string[];
} {
  const bets = configs.map(calculateExoticCost);
  const errors = bets.filter((b) => !b.isValid).map((b) => b.error || 'Unknown error');

  return {
    total: bets.reduce((sum, b) => sum + b.total, 0),
    totalCombinations: bets.reduce((sum, b) => sum + b.combinations, 0),
    bets,
    isValid: errors.length === 0,
    errors,
  };
}
