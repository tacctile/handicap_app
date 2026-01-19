/**
 * Quarter-Kelly Calculator Tests
 *
 * Tests for the Kelly Criterion calculation module.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateKelly,
  calculateFractionalKelly,
  parseOddsToDecimal,
  decimalOddsToDisplay,
  validateKellyInput,
  KELLY_FRACTION_MULTIPLIERS,
} from '../kellyCalculator';

describe('kellyCalculator', () => {
  describe('calculateKelly', () => {
    it('should return positive Kelly fraction for positive EV', () => {
      // 25% probability at 5-1 (6.0 decimal) = positive edge
      const result = calculateKelly({
        probability: 0.25,
        decimalOdds: 6.0,
        bankroll: 500,
      });

      expect(result.fullKellyFraction).toBeGreaterThan(0);
      expect(result.isPositiveEV).toBe(true);
      expect(result.shouldBet).toBe(true);
    });

    it('should return 0 for negative EV', () => {
      // 10% probability at 5-1 (implies 16.7% breakeven) = negative EV
      const result = calculateKelly({
        probability: 0.1,
        decimalOdds: 6.0,
        bankroll: 500,
      });

      expect(result.fullKellyFraction).toBe(0);
      expect(result.quarterKellyFraction).toBe(0);
      expect(result.suggestedBetSize).toBe(0);
      expect(result.isPositiveEV).toBe(false);
      expect(result.shouldBet).toBe(false);
      expect(result.reason).toContain('Negative EV');
    });

    it('should calculate quarter Kelly as 0.25× full Kelly', () => {
      const result = calculateKelly({
        probability: 0.25,
        decimalOdds: 6.0,
        bankroll: 500,
      });

      // Quarter Kelly should be exactly 0.25 of full Kelly
      const expectedQuarter = result.fullKellyFraction * 0.25;
      expect(result.quarterKellyFraction).toBeCloseTo(expectedQuarter, 4);
    });

    it('should match known Kelly calculation example', () => {
      // Standard Kelly formula: f = (bp - q) / b where b = decimalOdds - 1
      // Probability: 25%, Odds: 5-1 (6.0 decimal), Bankroll: $500
      // b = 6.0 - 1 = 5
      // Full Kelly: f = (5 × 0.25 - 0.75) / 5 = (1.25 - 0.75) / 5 = 0.5 / 5 = 0.10 (10%)
      // Quarter Kelly: 0.10 × 0.25 = 0.025 (2.5%)
      // Suggested bet: $500 × 0.025 = $12.50 → rounds to $13
      const result = calculateKelly({
        probability: 0.25,
        decimalOdds: 6.0,
        bankroll: 500,
      });

      // Full Kelly should be 0.10 (10%)
      expect(result.fullKellyFraction).toBeCloseTo(0.1, 2);

      // Quarter Kelly should be 0.025 (2.5%)
      expect(result.quarterKellyFraction).toBeCloseTo(0.025, 4);

      // Suggested bet should be $13 (rounded from $12.50)
      expect(result.suggestedBetSize).toBe(13);
    });

    it('should cap Kelly at 25% maximum', () => {
      // Very high edge scenario that would give Kelly > 0.25
      const result = calculateKelly({
        probability: 0.5,
        decimalOdds: 5.0,
        bankroll: 1000,
      });

      expect(result.fullKellyFraction).toBeLessThanOrEqual(0.25);
    });

    it('should return 0 bet for insufficient bankroll', () => {
      const result = calculateKelly({
        probability: 0.3,
        decimalOdds: 4.0,
        bankroll: 5, // Below minimum
      });

      expect(result.suggestedBetSize).toBe(0);
      expect(result.shouldBet).toBe(false);
      expect(result.reason).toContain('Bankroll');
    });

    it('should calculate correct expected value', () => {
      // EV = p × odds - 1
      // At 25% probability and 6.0 decimal odds:
      // EV = 0.25 × 6.0 - 1 = 1.5 - 1 = 0.5 (50% EV)
      const result = calculateKelly({
        probability: 0.25,
        decimalOdds: 6.0,
        bankroll: 500,
      });

      expect(result.expectedValue).toBeCloseTo(0.5, 2);
    });

    it('should calculate correct implied probability', () => {
      // Implied prob = 1 / odds = 1 / 6.0 = 0.1667
      const result = calculateKelly({
        probability: 0.25,
        decimalOdds: 6.0,
        bankroll: 500,
      });

      expect(result.impliedProbability).toBeCloseTo(0.1667, 3);
    });

    it('should calculate correct edge percentage', () => {
      // Edge = (our prob - implied prob) / implied prob × 100
      // = (0.25 - 0.1667) / 0.1667 × 100 ≈ 50%
      const result = calculateKelly({
        probability: 0.25,
        decimalOdds: 6.0,
        bankroll: 500,
      });

      expect(result.edgePercent).toBeCloseTo(50, 0);
    });
  });

  describe('calculateFractionalKelly', () => {
    it('should apply full Kelly multiplier', () => {
      const result = calculateFractionalKelly(
        {
          probability: 0.25,
          decimalOdds: 6.0,
          bankroll: 500,
        },
        'full'
      );

      // Full Kelly = 0.10, so this should return 0.10
      expect(result.quarterKellyFraction).toBeCloseTo(0.1, 2);
    });

    it('should apply half Kelly multiplier', () => {
      const result = calculateFractionalKelly(
        {
          probability: 0.25,
          decimalOdds: 6.0,
          bankroll: 500,
        },
        'half'
      );

      // Half Kelly = 0.10 × 0.5 = 0.05
      expect(result.quarterKellyFraction).toBeCloseTo(0.05, 3);
    });

    it('should apply eighth Kelly multiplier', () => {
      const result = calculateFractionalKelly(
        {
          probability: 0.25,
          decimalOdds: 6.0,
          bankroll: 500,
        },
        'eighth'
      );

      // Eighth Kelly = 0.10 × 0.125 = 0.0125
      expect(result.quarterKellyFraction).toBeCloseTo(0.0125, 4);
    });
  });

  describe('parseOddsToDecimal', () => {
    it('should parse X-1 format', () => {
      expect(parseOddsToDecimal('5-1')).toBeCloseTo(6.0, 2);
      expect(parseOddsToDecimal('10-1')).toBeCloseTo(11.0, 2);
      expect(parseOddsToDecimal('3-1')).toBeCloseTo(4.0, 2);
    });

    it('should parse fractional format', () => {
      expect(parseOddsToDecimal('3-2')).toBeCloseTo(2.5, 2);
      expect(parseOddsToDecimal('9-2')).toBeCloseTo(5.5, 2);
      expect(parseOddsToDecimal('1-2')).toBeCloseTo(1.5, 2);
    });

    it('should parse slash format', () => {
      expect(parseOddsToDecimal('5/1')).toBeCloseTo(6.0, 2);
      expect(parseOddsToDecimal('9/2')).toBeCloseTo(5.5, 2);
    });

    it('should handle EVEN odds', () => {
      expect(parseOddsToDecimal('EVEN')).toBe(2.0);
      expect(parseOddsToDecimal('EVN')).toBe(2.0);
    });

    it('should return default for invalid input', () => {
      expect(parseOddsToDecimal('')).toBe(2.0);
      expect(parseOddsToDecimal('abc')).toBe(2.0);
    });
  });

  describe('decimalOddsToDisplay', () => {
    it('should convert decimal to display format', () => {
      expect(decimalOddsToDisplay(6.0)).toBe('5-1');
      expect(decimalOddsToDisplay(4.0)).toBe('3-1');
      expect(decimalOddsToDisplay(2.0)).toBe('EVEN');
    });

    it('should handle edge cases', () => {
      expect(decimalOddsToDisplay(1.0)).toBe('EVEN');
      expect(decimalOddsToDisplay(0)).toBe('EVEN');
    });
  });

  describe('validateKellyInput', () => {
    it('should validate correct inputs', () => {
      const result = validateKellyInput({
        probability: 0.25,
        decimalOdds: 6.0,
        bankroll: 500,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid probability', () => {
      const result = validateKellyInput({
        probability: 1.5, // Invalid
        decimalOdds: 6.0,
        bankroll: 500,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid odds', () => {
      const result = validateKellyInput({
        probability: 0.25,
        decimalOdds: 0.5, // Invalid (must be > 1)
        bankroll: 500,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject negative bankroll', () => {
      const result = validateKellyInput({
        probability: 0.25,
        decimalOdds: 6.0,
        bankroll: -100, // Invalid
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('KELLY_FRACTION_MULTIPLIERS', () => {
    it('should have correct values', () => {
      expect(KELLY_FRACTION_MULTIPLIERS.full).toBe(1.0);
      expect(KELLY_FRACTION_MULTIPLIERS.half).toBe(0.5);
      expect(KELLY_FRACTION_MULTIPLIERS.quarter).toBe(0.25);
      expect(KELLY_FRACTION_MULTIPLIERS.eighth).toBe(0.125);
    });
  });
});
