/**
 * Multi-Race Calculator Tests
 *
 * Tests for cost calculations across all multi-race bet types:
 * - Daily Double, Pick 3, Pick 4, Pick 5, Pick 6
 * - Cost formula validation
 * - "All" button calculations
 * - Budget fitting utilities
 * - Edge cases and error handling
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCombinations,
  calculateBasicCost,
  generateSpreadNotation,
  calculateMultiRaceCost,
  calculateDailyDoubleCost,
  calculatePick3Cost,
  calculatePick4Cost,
  calculatePick5Cost,
  calculatePick6Cost,
  calculateWithAllOption,
  findOptimalBaseBet,
  findMaxSelectionsForBudget,
  compareSpreads,
  generateWindowInstruction,
  MAX_SELECTIONS_PER_RACE,
} from '../multiraceCalculator';
import type { RaceSelection } from '../multiraceTypes';

describe('Multi-Race Calculator', () => {
  // ============================================================================
  // COMBINATION CALCULATIONS
  // ============================================================================

  describe('calculateCombinations', () => {
    it('should calculate Daily Double combinations correctly', () => {
      // 2 horses × 3 horses = 6 combinations
      expect(calculateCombinations([2, 3])).toBe(6);
    });

    it('should calculate Pick 3 combinations correctly', () => {
      // 2 × 2 × 3 = 12 combinations
      expect(calculateCombinations([2, 2, 3])).toBe(12);
    });

    it('should calculate Pick 4 combinations correctly', () => {
      // 3 × 2 × 2 × 3 = 36 combinations
      expect(calculateCombinations([3, 2, 2, 3])).toBe(36);
    });

    it('should calculate Pick 6 combinations correctly', () => {
      // 4 × 3 × 3 × 2 × 2 × 3 = 432 combinations
      expect(calculateCombinations([4, 3, 3, 2, 2, 3])).toBe(432);
    });

    it('should return 0 for empty array', () => {
      expect(calculateCombinations([])).toBe(0);
    });

    it('should return 0 if any leg has 0 selections', () => {
      expect(calculateCombinations([2, 0, 3])).toBe(0);
    });

    it('should handle single horse per leg', () => {
      expect(calculateCombinations([1, 1, 1, 1])).toBe(1);
    });
  });

  // ============================================================================
  // BASIC COST CALCULATIONS
  // ============================================================================

  describe('calculateBasicCost', () => {
    it('should calculate Daily Double cost correctly', () => {
      // 2 × 3 × $2 = $12
      expect(calculateBasicCost([2, 3], 2)).toBe(12);
    });

    it('should calculate Pick 3 cost correctly', () => {
      // 2 × 2 × 3 × $1 = $12
      expect(calculateBasicCost([2, 2, 3], 1)).toBe(12);
    });

    it('should calculate Pick 4 cost correctly', () => {
      // 3 × 2 × 2 × 3 × $0.50 = $18
      expect(calculateBasicCost([3, 2, 2, 3], 0.5)).toBe(18);
    });

    it('should calculate Pick 6 cost correctly', () => {
      // 4 × 3 × 3 × 2 × 2 × 3 × $0.50 = $216
      expect(calculateBasicCost([4, 3, 3, 2, 2, 3], 0.5)).toBe(216);
    });

    it('should round to 2 decimal places', () => {
      const cost = calculateBasicCost([3, 3], 0.33);
      expect(cost).toBe(2.97);
    });
  });

  // ============================================================================
  // SPREAD NOTATION
  // ============================================================================

  describe('generateSpreadNotation', () => {
    it('should generate correct notation for Daily Double', () => {
      expect(generateSpreadNotation([2, 3])).toBe('2-3');
    });

    it('should generate correct notation for Pick 4', () => {
      expect(generateSpreadNotation([2, 3, 2, 1])).toBe('2-3-2-1');
    });

    it('should handle single selections', () => {
      expect(generateSpreadNotation([1, 1, 1, 1])).toBe('1-1-1-1');
    });
  });

  // ============================================================================
  // DAILY DOUBLE QUICK CALCULATOR
  // ============================================================================

  describe('calculateDailyDoubleCost', () => {
    it('should calculate standard Daily Double', () => {
      const result = calculateDailyDoubleCost(2, 3, 2);
      expect(result.isValid).toBe(true);
      expect(result.total).toBe(12);
      expect(result.combinations).toBe(6);
      expect(result.spreadNotation).toBe('2-3');
    });

    it('should use default $2 base bet', () => {
      const result = calculateDailyDoubleCost(2, 2);
      expect(result.baseBet).toBe(2);
      expect(result.total).toBe(8);
    });

    it('should fail with 0 selections in race 1', () => {
      const result = calculateDailyDoubleCost(0, 3, 2);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 1 selection');
    });

    it('should fail with 0 selections in race 2', () => {
      const result = calculateDailyDoubleCost(2, 0, 2);
      expect(result.isValid).toBe(false);
    });
  });

  // ============================================================================
  // PICK 3 QUICK CALCULATOR
  // ============================================================================

  describe('calculatePick3Cost', () => {
    it('should calculate standard Pick 3', () => {
      const result = calculatePick3Cost(2, 2, 3, 1);
      expect(result.isValid).toBe(true);
      expect(result.total).toBe(12);
      expect(result.combinations).toBe(12);
    });

    it('should use default $1 base bet', () => {
      const result = calculatePick3Cost(2, 2, 2);
      expect(result.baseBet).toBe(1);
    });

    it('should fail with invalid selections', () => {
      const result = calculatePick3Cost(0, 2, 2, 1);
      expect(result.isValid).toBe(false);
    });
  });

  // ============================================================================
  // PICK 4 QUICK CALCULATOR
  // ============================================================================

  describe('calculatePick4Cost', () => {
    it('should calculate standard Pick 4', () => {
      const result = calculatePick4Cost([3, 2, 2, 3], 0.5);
      expect(result.isValid).toBe(true);
      expect(result.total).toBe(18);
      expect(result.combinations).toBe(36);
      expect(result.spreadNotation).toBe('3-2-2-3');
    });

    it('should use default $0.50 base bet', () => {
      const result = calculatePick4Cost([2, 2, 2, 2]);
      expect(result.baseBet).toBe(0.5);
    });
  });

  // ============================================================================
  // PICK 5 QUICK CALCULATOR
  // ============================================================================

  describe('calculatePick5Cost', () => {
    it('should calculate standard Pick 5', () => {
      const result = calculatePick5Cost([2, 2, 2, 2, 2], 0.5);
      expect(result.isValid).toBe(true);
      expect(result.total).toBe(16);
      expect(result.combinations).toBe(32);
    });

    it('should handle large spreads', () => {
      const result = calculatePick5Cost([3, 3, 3, 3, 3], 0.5);
      expect(result.isValid).toBe(true);
      expect(result.combinations).toBe(243); // 3^5
      expect(result.total).toBe(121.5);
    });
  });

  // ============================================================================
  // PICK 6 QUICK CALCULATOR
  // ============================================================================

  describe('calculatePick6Cost', () => {
    it('should calculate standard Pick 6', () => {
      const result = calculatePick6Cost([4, 3, 3, 2, 2, 3], 0.5);
      expect(result.isValid).toBe(true);
      expect(result.combinations).toBe(432);
      expect(result.total).toBe(216);
    });

    it('should handle all singles', () => {
      const result = calculatePick6Cost([1, 1, 1, 1, 1, 1], 0.5);
      expect(result.combinations).toBe(1);
      expect(result.total).toBe(0.5);
    });
  });

  // ============================================================================
  // FULL COST CALCULATOR
  // ============================================================================

  describe('calculateMultiRaceCost', () => {
    const createSelections = (counts: number[]): RaceSelection[] => {
      return counts.map((count, idx) => ({
        raceNumber: idx + 1,
        legNumber: idx + 1,
        selections: Array.from({ length: count }, (_, i) => i + 1),
        isAllSelected: false,
        fieldSize: 10,
        raceStrength: 'competitive' as const,
      }));
    };

    it('should validate correct number of races for Daily Double', () => {
      const result = calculateMultiRaceCost({
        betType: 'daily_double',
        selections: createSelections([2, 3]),
        baseBet: 2,
      });
      expect(result.isValid).toBe(true);
    });

    it('should fail if wrong number of races', () => {
      const result = calculateMultiRaceCost({
        betType: 'daily_double',
        selections: createSelections([2, 3, 2]),
        baseBet: 2,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exactly 2 races');
    });

    it('should fail if any race has no selections', () => {
      const selections = createSelections([2, 0]);
      selections[1].selections = [];

      const result = calculateMultiRaceCost({
        betType: 'daily_double',
        selections,
        baseBet: 2,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least');
    });

    it('should handle "All" selections correctly', () => {
      const selections: RaceSelection[] = [
        {
          raceNumber: 1,
          legNumber: 1,
          selections: [1, 2, 3, 4, 5, 6, 7, 8],
          isAllSelected: true,
          fieldSize: 8,
          raceStrength: 'weak',
        },
        {
          raceNumber: 2,
          legNumber: 2,
          selections: [1, 2],
          isAllSelected: false,
          fieldSize: 10,
          raceStrength: 'standout',
        },
      ];

      const result = calculateMultiRaceCost({
        betType: 'daily_double',
        selections,
        baseBet: 2,
      });

      expect(result.isValid).toBe(true);
      expect(result.combinations).toBe(16); // 8 × 2
      expect(result.total).toBe(32);
    });

    it('should fail if cost exceeds maximum', () => {
      // Create a ticket that would exceed MAX_TICKET_COST
      const selections = createSelections([10, 10, 10, 10, 10, 10]);
      selections.forEach((s) => {
        s.selections = Array.from({ length: 10 }, (_, i) => i + 1);
      });

      const result = calculateMultiRaceCost({
        betType: 'pick_6',
        selections,
        baseBet: 100, // 1,000,000 × $100 = way over limit
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });
  });

  // ============================================================================
  // "ALL" OPTION CALCULATIONS
  // ============================================================================

  describe('calculateWithAllOption', () => {
    it('should calculate cost difference when using All', () => {
      const result = calculateWithAllOption({
        betType: 'daily_double',
        currentSelections: [2, 3],
        fieldSizes: [8, 10],
        allLegs: [0], // Use All in first leg
        baseBet: 2,
      });

      expect(result.withAll.isValid).toBe(true);
      expect(result.withAll.combinations).toBe(24); // 8 × 3
      expect(result.withAll.total).toBe(48);

      expect(result.withoutAll).not.toBeNull();
      expect(result.withoutAll!.combinations).toBe(6); // 2 × 3
      expect(result.withoutAll!.total).toBe(12);

      expect(result.costDifference).toBe(36); // 48 - 12
      expect(result.allAddsCombinations).toBe(18); // 24 - 6
    });

    it('should handle All in multiple legs', () => {
      const result = calculateWithAllOption({
        betType: 'pick_3',
        currentSelections: [2, 2, 2],
        fieldSizes: [8, 8, 8],
        allLegs: [0, 2], // All in first and third
        baseBet: 1,
      });

      expect(result.withAll.combinations).toBe(128); // 8 × 2 × 8
    });
  });

  // ============================================================================
  // BUDGET FITTING
  // ============================================================================

  describe('findOptimalBaseBet', () => {
    it('should find highest base bet that fits budget', () => {
      const result = findOptimalBaseBet('daily_double', [2, 3], 20);

      // 6 combos at $2 = $12 (fits)
      expect(result.baseBet).toBe(2);
      expect(result.cost).toBe(12);
      expect(result.fits).toBe(true);
    });

    it('should step down to lower base bet if needed', () => {
      const result = findOptimalBaseBet('daily_double', [2, 3], 8);

      // 6 combos at $2 = $12 (too much)
      // 6 combos at $1 = $6 (fits)
      expect(result.baseBet).toBe(1);
      expect(result.cost).toBe(6);
      expect(result.fits).toBe(true);
    });

    it('should return fits=false if nothing fits budget', () => {
      const result = findOptimalBaseBet('daily_double', [10, 10], 10);

      // Even minimum bet is too expensive
      expect(result.fits).toBe(false);
    });
  });

  describe('findMaxSelectionsForBudget', () => {
    it('should find max balanced selections for budget', () => {
      const result = findMaxSelectionsForBudget('pick_4', 4, 50);

      // At $0.50 base, can afford more selections
      expect(result.fits).toBe(true);
      expect(result.selectionsPerRace.length).toBe(4);
      expect(result.cost).toBeLessThanOrEqual(50);
    });

    it('should handle tight budget', () => {
      const result = findMaxSelectionsForBudget('pick_6', 6, 5);

      // With $5 budget and 6 legs at $0.50, can only afford 1-1-1-1-1-1 or 2 somewhere
      expect(result.fits).toBe(true);
    });
  });

  // ============================================================================
  // SPREAD COMPARISON
  // ============================================================================

  describe('compareSpreads', () => {
    it('should compare and sort spreads by cost', () => {
      const spreads = [
        [3, 3, 3, 3],
        [2, 2, 2, 2],
        [1, 1, 1, 1],
      ];

      const result = compareSpreads('pick_4', spreads, 0.5);

      expect(result.length).toBe(3);
      expect(result[0].cost).toBeLessThan(result[1].cost);
      expect(result[1].cost).toBeLessThan(result[2].cost);
    });

    it('should filter out invalid spreads', () => {
      const spreads = [
        [2, 2, 2], // Only 3 legs for Pick 4
        [2, 2, 2, 2], // Valid
      ];

      const result = compareSpreads('pick_4', spreads, 0.5);

      expect(result.length).toBe(1);
    });
  });

  // ============================================================================
  // WINDOW INSTRUCTIONS
  // ============================================================================

  describe('generateWindowInstruction', () => {
    it('should generate correct Daily Double instruction', () => {
      const instruction = generateWindowInstruction(
        'daily_double',
        3,
        [
          { raceNumber: 3, horses: [2, 5] },
          { raceNumber: 4, horses: [1, 3, 7] },
        ],
        2
      );

      expect(instruction).toContain('$2.00 DAILY DOUBLE');
      expect(instruction).toContain('Races 3-4');
      expect(instruction).toContain('Race 3: 2, 5');
      expect(instruction).toContain('Race 4: 1, 3, 7');
    });

    it('should generate correct Pick 4 instruction', () => {
      const instruction = generateWindowInstruction(
        'pick_4',
        1,
        [
          { raceNumber: 1, horses: [3] },
          { raceNumber: 2, horses: [2, 4] },
          { raceNumber: 3, horses: [1, 5, 6] },
          { raceNumber: 4, horses: [7] },
        ],
        0.5
      );

      expect(instruction).toContain('$0.50 PICK 4');
      expect(instruction).toContain('Races 1-4');
      expect(instruction).toContain('Race 1: 3');
    });

    it('should handle single horse correctly', () => {
      const instruction = generateWindowInstruction(
        'pick_3',
        5,
        [
          { raceNumber: 5, horses: [1] },
          { raceNumber: 6, horses: [2] },
          { raceNumber: 7, horses: [3] },
        ],
        1
      );

      expect(instruction).toContain('Race 5: 1');
      expect(instruction).toContain('Race 6: 2');
      expect(instruction).toContain('Race 7: 3');
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle maximum selections per race', () => {
      const result = calculateDailyDoubleCost(
        MAX_SELECTIONS_PER_RACE,
        MAX_SELECTIONS_PER_RACE,
        0.5
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate negative base bet', () => {
      const result = calculateDailyDoubleCost(2, 2, -1);
      // Should use minimum base bet instead
      expect(result.baseBet).toBeGreaterThan(0);
    });

    it('should handle floating point precision', () => {
      const result = calculateBasicCost([3, 3], 0.1);
      expect(result).toBe(0.9);
    });
  });
});
