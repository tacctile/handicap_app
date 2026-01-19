/**
 * Bet Sizer Tests
 *
 * Tests for bet sizing constraints and multi-bet management.
 */

import { describe, it, expect } from 'vitest';
import {
  sizeBet,
  adjustForSimultaneousBets,
  calculateTotalExposure,
  calculateExposurePercent,
  validateBetSizingConfig,
  DEFAULT_BET_SIZING_CONFIG,
} from '../betSizer';
import { calculateKelly } from '../kellyCalculator';

describe('betSizer', () => {
  describe('sizeBet', () => {
    it('should respect max bet percent cap', () => {
      // Create a Kelly result with a large fraction
      const kelly = calculateKelly({
        probability: 0.4,
        decimalOdds: 4.0,
        bankroll: 1000,
      });

      const sized = sizeBet(kelly, 1000, {
        maxBetPercent: 2, // 2% cap = $20 max
      });

      expect(sized.finalBet).toBeLessThanOrEqual(20);
      expect(sized.wasCapApplied).toBe(true);
      expect(sized.capReason).toBe('max_percent');
    });

    it('should respect max bet amount cap', () => {
      const kelly = calculateKelly({
        probability: 0.4,
        decimalOdds: 4.0,
        bankroll: 10000,
      });

      const sized = sizeBet(kelly, 10000, {
        maxBetPercent: 10, // Would allow $1000
        maxBetAmount: 100, // But capped at $100
      });

      expect(sized.finalBet).toBeLessThanOrEqual(100);
      expect(sized.wasCapApplied).toBe(true);
      expect(sized.capReason).toBe('max_amount');
    });

    it('should enforce minimum bet amount', () => {
      // Small edge that would result in tiny bet
      const kelly = calculateKelly({
        probability: 0.18,
        decimalOdds: 6.0,
        bankroll: 100,
      });

      const sized = sizeBet(kelly, 100, {
        minBetAmount: 5,
      });

      if (sized.finalBet > 0) {
        expect(sized.finalBet).toBeGreaterThanOrEqual(5);
      }
    });

    it('should round to nearest dollar', () => {
      const kelly = calculateKelly({
        probability: 0.25,
        decimalOdds: 6.0,
        bankroll: 500,
      });

      const sized = sizeBet(kelly, 500, {
        roundToNearest: 1,
      });

      // Check that finalBet is a whole number
      expect(sized.finalBet).toBe(Math.round(sized.finalBet));
    });

    it('should round to nearest 5 dollars when configured', () => {
      const kelly = calculateKelly({
        probability: 0.3,
        decimalOdds: 5.0,
        bankroll: 1000,
      });

      const sized = sizeBet(kelly, 1000, {
        roundToNearest: 5,
        maxBetPercent: 5,
      });

      expect(sized.finalBet % 5).toBe(0);
    });

    it('should return 0 for negative EV', () => {
      const kelly = calculateKelly({
        probability: 0.1, // 10% at 5-1 is negative EV
        decimalOdds: 6.0,
        bankroll: 500,
      });

      const sized = sizeBet(kelly, 500);

      expect(sized.finalBet).toBe(0);
      expect(sized.capReason).toBe('negative_ev');
    });

    it('should return 0 when edge below threshold', () => {
      // Barely positive EV
      const kelly = calculateKelly({
        probability: 0.17, // Slightly above 16.67% breakeven for 5-1
        decimalOdds: 6.0,
        bankroll: 500,
      });

      const sized = sizeBet(kelly, 500, {
        minEdgePercent: 5, // Require 5% edge
      });

      // Edge is only ~2%, below threshold
      expect(sized.finalBet).toBe(0);
      expect(sized.capReason).toBe('below_edge');
    });

    it('should calculate effective bet percent correctly', () => {
      const kelly = calculateKelly({
        probability: 0.25,
        decimalOdds: 6.0,
        bankroll: 500,
      });

      const sized = sizeBet(kelly, 500);

      const expectedPercent = (sized.finalBet / 500) * 100;
      expect(sized.effectiveBetPercent).toBeCloseTo(expectedPercent, 1);
    });
  });

  describe('adjustForSimultaneousBets', () => {
    it('should reduce individual sizes when total exceeds max exposure', () => {
      // Create 3 bets that total more than 10% of bankroll
      const bankroll = 500;
      const bets = [createMockSizedBet(30), createMockSizedBet(25), createMockSizedBet(20)]; // Total = $75 = 15%

      const adjusted = adjustForSimultaneousBets(bets, bankroll, 0.1); // Max 10%

      const totalAfter = adjusted.reduce((sum, b) => sum + b.finalBet, 0);
      expect(totalAfter).toBeLessThanOrEqual(50); // 10% of $500
    });

    it('should not change bets when within limit', () => {
      const bankroll = 500;
      const bets = [createMockSizedBet(10), createMockSizedBet(15), createMockSizedBet(10)]; // Total = $35 = 7%

      const adjusted = adjustForSimultaneousBets(bets, bankroll, 0.1); // Max 10%

      // Should be unchanged
      expect(adjusted[0]?.finalBet).toBe(10);
      expect(adjusted[1]?.finalBet).toBe(15);
      expect(adjusted[2]?.finalBet).toBe(10);
    });

    it('should handle empty bet array', () => {
      const adjusted = adjustForSimultaneousBets([], 500, 0.1);
      expect(adjusted).toHaveLength(0);
    });

    it('should preserve original bet amount in result', () => {
      const bets = [createMockSizedBet(40), createMockSizedBet(40)];

      const adjusted = adjustForSimultaneousBets(bets, 500, 0.1);

      expect(adjusted[0]?.originalBet).toBe(40);
      expect(adjusted[1]?.originalBet).toBe(40);
    });

    it('should apply proportional reduction', () => {
      const bets = [createMockSizedBet(40), createMockSizedBet(60)]; // Total $100
      const bankroll = 500;
      const maxExposure = 0.1; // $50 max

      const adjusted = adjustForSimultaneousBets(bets, bankroll, maxExposure);

      // Reduction factor = 50/100 = 0.5
      // So bets should be halved
      expect(adjusted[0]?.finalBet).toBeCloseTo(20, 0);
      expect(adjusted[1]?.finalBet).toBeCloseTo(30, 0);
    });
  });

  describe('calculateTotalExposure', () => {
    it('should sum all bet amounts', () => {
      const bets = [createMockSizedBet(10), createMockSizedBet(20), createMockSizedBet(30)];

      expect(calculateTotalExposure(bets)).toBe(60);
    });

    it('should return 0 for empty array', () => {
      expect(calculateTotalExposure([])).toBe(0);
    });
  });

  describe('calculateExposurePercent', () => {
    it('should calculate correct percentage', () => {
      const bets = [createMockSizedBet(25)];
      expect(calculateExposurePercent(bets, 500)).toBe(5);
    });

    it('should return 0 for zero bankroll', () => {
      const bets = [createMockSizedBet(25)];
      expect(calculateExposurePercent(bets, 0)).toBe(0);
    });
  });

  describe('validateBetSizingConfig', () => {
    it('should validate default config', () => {
      const result = validateBetSizingConfig(DEFAULT_BET_SIZING_CONFIG);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid maxBetPercent', () => {
      const config = { ...DEFAULT_BET_SIZING_CONFIG, maxBetPercent: 150 };
      const result = validateBetSizingConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should reject negative minBetAmount', () => {
      const config = { ...DEFAULT_BET_SIZING_CONFIG, minBetAmount: -5 };
      const result = validateBetSizingConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should reject maxBetAmount < minBetAmount', () => {
      const config = { ...DEFAULT_BET_SIZING_CONFIG, minBetAmount: 100, maxBetAmount: 50 };
      const result = validateBetSizingConfig(config);
      expect(result.isValid).toBe(false);
    });
  });
});

// Helper to create mock sized bet
function createMockSizedBet(amount: number): ReturnType<typeof sizeBet> {
  return {
    rawKellyBet: amount,
    cappedBet: amount,
    finalBet: amount,
    wasCapApplied: false,
    kellyFractionUsed: 'quarter',
    effectiveBetPercent: 0,
  };
}
