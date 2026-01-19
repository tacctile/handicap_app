/**
 * Exotic Calculator Tests
 *
 * Tests for exacta, trifecta, and superfecta key calculations.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateExactaKey,
  calculateTrifectaKey,
  calculateSuperfectaKey,
  calculateBoxCombinations,
  calculateBoxCost,
  validateExoticBet,
  getExoticBetInfo,
} from '../exoticCalculator';

describe('exoticCalculator', () => {
  // Create test probabilities
  const probabilities = new Map<number, number>([
    [1, 0.3], // 30% win prob
    [2, 0.2], // 20% win prob
    [3, 0.15], // 15% win prob
    [4, 0.1], // 10% win prob
    [5, 0.08], // 8% win prob
    [6, 0.07], // 7% win prob
  ]);

  describe('calculateExactaKey', () => {
    it('should calculate correct combinations', () => {
      // Key horse 1 over horses 2, 3, 4 = 3 combinations
      const result = calculateExactaKey(1, [2, 3, 4], probabilities);

      expect(result.combinations).toBe(3);
    });

    it('should calculate correct total cost', () => {
      // 3 combinations × $2 base = $6
      const result = calculateExactaKey(1, [2, 3, 4], probabilities, 2);

      expect(result.totalCost).toBe(6);
    });

    it('should filter out key horse from with horses', () => {
      // Include key horse 1 in with horses - should be filtered
      const result = calculateExactaKey(1, [1, 2, 3], probabilities);

      expect(result.withHorses).not.toContain(1);
      expect(result.combinations).toBe(2);
    });

    it('should be marked as speculative', () => {
      const result = calculateExactaKey(1, [2, 3, 4], probabilities);

      expect(result.isSpeculative).toBe(true);
      expect(result.estimatedEV).toBeNull();
    });

    it('should have correct bet type', () => {
      const result = calculateExactaKey(1, [2, 3, 4], probabilities);

      expect(result.betType).toBe('EXACTA_KEY');
    });

    it('should include reasoning string', () => {
      const result = calculateExactaKey(1, [2, 3, 4], probabilities);

      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning).toContain('Key #1');
    });
  });

  describe('calculateTrifectaKey', () => {
    it('should calculate correct combinations', () => {
      // Key horse 1 over horses 2, 3, 4
      // Combinations = 3 × 2 = 6
      const result = calculateTrifectaKey(1, [2, 3, 4], probabilities);

      expect(result.combinations).toBe(6);
    });

    it('should calculate correct total cost', () => {
      // 6 combinations × $1 base = $6
      const result = calculateTrifectaKey(1, [2, 3, 4], probabilities, 1);

      expect(result.totalCost).toBe(6);
    });

    it('should return 0 combinations with fewer than 2 with horses', () => {
      const result = calculateTrifectaKey(1, [2], probabilities);

      expect(result.combinations).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('should handle 4 with horses correctly', () => {
      // 4 × 3 = 12 combinations
      const result = calculateTrifectaKey(1, [2, 3, 4, 5], probabilities);

      expect(result.combinations).toBe(12);
    });

    it('should have correct bet type', () => {
      const result = calculateTrifectaKey(1, [2, 3, 4], probabilities);

      expect(result.betType).toBe('TRIFECTA_KEY');
    });
  });

  describe('calculateSuperfectaKey', () => {
    it('should calculate correct combinations', () => {
      // Key horse 1 over horses 2, 3, 4, 5
      // Combinations = 4 × 3 × 2 = 24
      const result = calculateSuperfectaKey(1, [2, 3, 4, 5], probabilities);

      expect(result.combinations).toBe(24);
    });

    it('should calculate correct total cost', () => {
      // 24 combinations × $0.10 base = $2.40
      const result = calculateSuperfectaKey(1, [2, 3, 4, 5], probabilities, 0.1);

      expect(result.totalCost).toBeCloseTo(2.4, 2);
    });

    it('should return 0 combinations with fewer than 3 with horses', () => {
      const result = calculateSuperfectaKey(1, [2, 3], probabilities);

      expect(result.combinations).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('should have correct bet type', () => {
      const result = calculateSuperfectaKey(1, [2, 3, 4, 5], probabilities);

      expect(result.betType).toBe('SUPERFECTA_KEY');
    });
  });

  describe('calculateBoxCombinations', () => {
    it('should calculate exacta box combinations', () => {
      // 3 horses in exacta box = 3 × 2 = 6 combinations
      expect(calculateBoxCombinations(3, 2)).toBe(6);

      // 4 horses = 4 × 3 = 12 combinations
      expect(calculateBoxCombinations(4, 2)).toBe(12);
    });

    it('should calculate trifecta box combinations', () => {
      // 3 horses in trifecta box = 3 × 2 × 1 = 6 combinations
      expect(calculateBoxCombinations(3, 3)).toBe(6);

      // 4 horses = 4 × 3 × 2 = 24 combinations
      expect(calculateBoxCombinations(4, 3)).toBe(24);
    });

    it('should calculate superfecta box combinations', () => {
      // 4 horses in superfecta box = 4 × 3 × 2 × 1 = 24 combinations
      expect(calculateBoxCombinations(4, 4)).toBe(24);

      // 5 horses = 5 × 4 × 3 × 2 = 120 combinations
      expect(calculateBoxCombinations(5, 4)).toBe(120);
    });

    it('should return 0 when horses < positions', () => {
      expect(calculateBoxCombinations(2, 3)).toBe(0);
      expect(calculateBoxCombinations(1, 2)).toBe(0);
    });
  });

  describe('calculateBoxCost', () => {
    it('should calculate exacta box cost', () => {
      // 3-horse exacta box at $2 = 6 combos × $2 = $12
      expect(calculateBoxCost(3, 'EXACTA_KEY', 2)).toBe(12);
    });

    it('should calculate trifecta box cost', () => {
      // 4-horse trifecta box at $1 = 24 combos × $1 = $24
      expect(calculateBoxCost(4, 'TRIFECTA_KEY', 1)).toBe(24);
    });

    it('should calculate superfecta box cost', () => {
      // 5-horse superfecta box at $0.10 = 120 combos × $0.10 = $12
      expect(calculateBoxCost(5, 'SUPERFECTA_KEY', 0.1)).toBeCloseTo(12, 2);
    });

    it('should use default amounts when not specified', () => {
      const exactaCost = calculateBoxCost(3, 'EXACTA_KEY');
      expect(exactaCost).toBe(12); // 6 × $2

      const trifectaCost = calculateBoxCost(3, 'TRIFECTA_KEY');
      expect(trifectaCost).toBe(6); // 6 × $1

      const superfectaCost = calculateBoxCost(4, 'SUPERFECTA_KEY');
      expect(superfectaCost).toBeCloseTo(2.4, 2); // 24 × $0.10
    });
  });

  describe('validateExoticBet', () => {
    it('should validate valid exacta key', () => {
      const bet = calculateExactaKey(1, [2, 3, 4], probabilities);
      const result = validateExoticBet(bet);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid key horse number', () => {
      const bet = {
        ...calculateExactaKey(1, [2, 3], probabilities),
        keyHorse: 0,
      };
      const result = validateExoticBet(bet);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('key horse'))).toBe(true);
    });

    it('should reject empty with horses', () => {
      const bet = {
        ...calculateExactaKey(1, [2, 3], probabilities),
        withHorses: [],
      };
      const result = validateExoticBet(bet);

      expect(result.isValid).toBe(false);
    });

    it('should reject insufficient with horses for trifecta', () => {
      const bet = {
        ...calculateTrifectaKey(1, [2], probabilities),
        withHorses: [2], // Need at least 2
      };
      const result = validateExoticBet(bet);

      expect(result.isValid).toBe(false);
    });

    it('should reject insufficient with horses for superfecta', () => {
      const bet = {
        ...calculateSuperfectaKey(1, [2, 3], probabilities),
        withHorses: [2, 3], // Need at least 3
      };
      const result = validateExoticBet(bet);

      expect(result.isValid).toBe(false);
    });
  });

  describe('getExoticBetInfo', () => {
    it('should return correct info for exacta key', () => {
      const info = getExoticBetInfo('EXACTA_KEY');

      expect(info.name).toBe('Exacta Key');
      expect(info.positions).toBe(2);
      expect(info.baseUnit).toBe(2);
      expect(info.minHorses).toBe(2);
    });

    it('should return correct info for trifecta key', () => {
      const info = getExoticBetInfo('TRIFECTA_KEY');

      expect(info.name).toBe('Trifecta Key');
      expect(info.positions).toBe(3);
      expect(info.baseUnit).toBe(1);
      expect(info.minHorses).toBe(3);
    });

    it('should return correct info for superfecta key', () => {
      const info = getExoticBetInfo('SUPERFECTA_KEY');

      expect(info.name).toBe('Superfecta Key');
      expect(info.positions).toBe(4);
      expect(info.baseUnit).toBe(0.1);
      expect(info.minHorses).toBe(4);
    });
  });
});
