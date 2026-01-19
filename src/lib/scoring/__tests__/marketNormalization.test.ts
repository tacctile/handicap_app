/**
 * Market Normalization Tests
 *
 * Tests for removing takeout/overround from odds-implied probabilities.
 */

import { describe, it, expect } from 'vitest';
import {
  fractionalToDecimalOdds,
  americanToDecimalOdds,
  oddsToImpliedProbability,
  calculateOverround,
  calculateTakeoutPercent,
  normalizeMarketProbabilities,
  normalizeFieldOdds,
  decimalToFractional,
  decimalToAmerican,
  validateMarketOdds,
  parseMorningLineOdds,
  parseToteOdds,
  MARKET_CONFIG,
} from '../marketNormalization';

describe('marketNormalization', () => {
  // ========================================================================
  // FRACTIONAL ODDS CONVERSION
  // ========================================================================
  describe('fractionalToDecimalOdds', () => {
    it('converts 5-1 to 6.0', () => {
      expect(fractionalToDecimalOdds(5, 1)).toBe(6.0);
    });

    it('converts 3-2 to 2.5', () => {
      expect(fractionalToDecimalOdds(3, 2)).toBe(2.5);
    });

    it('converts 1-2 to 1.5', () => {
      expect(fractionalToDecimalOdds(1, 2)).toBe(1.5);
    });

    it('converts even money (1-1) to 2.0', () => {
      expect(fractionalToDecimalOdds(1, 1)).toBe(2.0);
    });

    it('converts 9-2 to 5.5', () => {
      expect(fractionalToDecimalOdds(9, 2)).toBe(5.5);
    });

    it('converts 7-5 to 2.4', () => {
      expect(fractionalToDecimalOdds(7, 5)).toBe(2.4);
    });

    it('handles decimal fractional odds (7.5-1)', () => {
      expect(fractionalToDecimalOdds(7.5, 1)).toBe(8.5);
    });

    it('defaults to even money for zero denominator', () => {
      expect(fractionalToDecimalOdds(5, 0)).toBe(2.0);
    });

    it('defaults to even money for invalid inputs', () => {
      expect(fractionalToDecimalOdds(NaN, 1)).toBe(2.0);
      expect(fractionalToDecimalOdds(5, NaN)).toBe(2.0);
    });
  });

  // ========================================================================
  // AMERICAN ODDS CONVERSION
  // ========================================================================
  describe('americanToDecimalOdds', () => {
    it('converts +150 to 2.5', () => {
      expect(americanToDecimalOdds(150)).toBe(2.5);
    });

    it('converts -150 to approximately 1.667', () => {
      const result = americanToDecimalOdds(-150);
      expect(result).toBeCloseTo(1.667, 2);
    });

    it('converts +400 to 5.0', () => {
      expect(americanToDecimalOdds(400)).toBe(5.0);
    });

    it('converts -200 to 1.5', () => {
      expect(americanToDecimalOdds(-200)).toBe(1.5);
    });

    it('converts +100 to 2.0 (even money)', () => {
      expect(americanToDecimalOdds(100)).toBe(2.0);
    });

    it('converts -100 to 2.0 (even money)', () => {
      expect(americanToDecimalOdds(-100)).toBe(2.0);
    });

    it('converts +500 to 6.0', () => {
      expect(americanToDecimalOdds(500)).toBe(6.0);
    });

    it('converts -300 to approximately 1.333', () => {
      const result = americanToDecimalOdds(-300);
      expect(result).toBeCloseTo(1.333, 2);
    });

    it('defaults to even money for NaN', () => {
      expect(americanToDecimalOdds(NaN)).toBe(2.0);
    });
  });

  // ========================================================================
  // IMPLIED PROBABILITY
  // ========================================================================
  describe('oddsToImpliedProbability', () => {
    it('converts 2.0 decimal odds to 50%', () => {
      expect(oddsToImpliedProbability(2.0)).toBe(0.5);
    });

    it('converts 4.0 decimal odds to 25%', () => {
      expect(oddsToImpliedProbability(4.0)).toBe(0.25);
    });

    it('converts 10.0 decimal odds to 10%', () => {
      expect(oddsToImpliedProbability(10.0)).toBe(0.1);
    });

    it('converts 5.0 decimal odds to 20%', () => {
      expect(oddsToImpliedProbability(5.0)).toBe(0.2);
    });

    it('handles very low odds (heavy favorite)', () => {
      const result = oddsToImpliedProbability(1.2);
      expect(result).toBeCloseTo(0.833, 2);
    });

    it('handles very high odds (longshot)', () => {
      const result = oddsToImpliedProbability(100);
      expect(result).toBe(0.01);
    });

    it('returns 0 for invalid odds', () => {
      expect(oddsToImpliedProbability(0)).toBe(0);
      expect(oddsToImpliedProbability(-1)).toBe(0);
      expect(oddsToImpliedProbability(NaN)).toBe(0);
    });
  });

  // ========================================================================
  // OVERROUND CALCULATION
  // ========================================================================
  describe('calculateOverround', () => {
    it('calculates correct overround for a typical field', () => {
      // 6 horses with ~17% takeout
      const impliedProbs = [0.35, 0.25, 0.2, 0.15, 0.12, 0.1];
      const overround = calculateOverround(impliedProbs);
      expect(overround).toBe(1.17);
    });

    it('calculates correct overround for a fair market', () => {
      const impliedProbs = [0.4, 0.3, 0.2, 0.1];
      const overround = calculateOverround(impliedProbs);
      expect(overround).toBe(1.0);
    });

    it('calculates overround for high takeout market (~25%)', () => {
      const impliedProbs = [0.4, 0.35, 0.3, 0.2];
      const overround = calculateOverround(impliedProbs);
      expect(overround).toBe(1.25);
    });

    it('returns 1.0 for empty array', () => {
      expect(calculateOverround([])).toBe(1.0);
    });

    it('handles NaN values by ignoring them', () => {
      const impliedProbs = [0.5, NaN, 0.5];
      const overround = calculateOverround(impliedProbs);
      expect(overround).toBe(1.0);
    });
  });

  // ========================================================================
  // TAKEOUT CALCULATION
  // ========================================================================
  describe('calculateTakeoutPercent', () => {
    it('calculates 17% takeout from 1.17 overround', () => {
      // Formula: (1.17 - 1) / 1.17 = 0.1453 = 14.5%
      const takeout = calculateTakeoutPercent(1.17);
      expect(takeout).toBeCloseTo(14.5, 1);
    });

    it('calculates 20% takeout from 1.25 overround', () => {
      // Formula: (1.25 - 1) / 1.25 = 0.20 = 20%
      const takeout = calculateTakeoutPercent(1.25);
      expect(takeout).toBe(20.0);
    });

    it('calculates ~9% takeout from 1.10 overround', () => {
      // Formula: (1.10 - 1) / 1.10 = 0.0909 = 9.1%
      const takeout = calculateTakeoutPercent(1.1);
      expect(takeout).toBeCloseTo(9.1, 1);
    });

    it('returns 0% for overround of 1.0 (fair market)', () => {
      expect(calculateTakeoutPercent(1.0)).toBe(0);
    });

    it('returns 0% for invalid input', () => {
      expect(calculateTakeoutPercent(0)).toBe(0);
      expect(calculateTakeoutPercent(-1)).toBe(0);
      expect(calculateTakeoutPercent(NaN)).toBe(0);
    });
  });

  // ========================================================================
  // NORMALIZATION
  // ========================================================================
  describe('normalizeMarketProbabilities', () => {
    it('normalized probabilities sum to 1.0', () => {
      const impliedProbs = [0.35, 0.25, 0.2, 0.15, 0.12, 0.1]; // sum = 1.17
      const normalized = normalizeMarketProbabilities(impliedProbs);

      const sum = normalized.reduce((acc, p) => acc + p, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('normalizes 17% overround field correctly', () => {
      // Field with ~17% overround
      const impliedProbs = [0.35, 0.25, 0.2, 0.15, 0.12, 0.1]; // sum = 1.17
      const normalized = normalizeMarketProbabilities(impliedProbs);

      // Each probability should be divided by 1.17
      expect(normalized[0]).toBeCloseTo(0.35 / 1.17, 3);
      expect(normalized[1]).toBeCloseTo(0.25 / 1.17, 3);
      expect(normalized[2]).toBeCloseTo(0.2 / 1.17, 3);
      expect(normalized[3]).toBeCloseTo(0.15 / 1.17, 3);
      expect(normalized[4]).toBeCloseTo(0.12 / 1.17, 3);
      expect(normalized[5]).toBeCloseTo(0.1 / 1.17, 3);
    });

    it('handles fair market (sum = 1.0) without change', () => {
      const impliedProbs = [0.4, 0.3, 0.2, 0.1];
      const normalized = normalizeMarketProbabilities(impliedProbs);

      expect(normalized[0]).toBeCloseTo(0.4, 5);
      expect(normalized[1]).toBeCloseTo(0.3, 5);
      expect(normalized[2]).toBeCloseTo(0.2, 5);
      expect(normalized[3]).toBeCloseTo(0.1, 5);
    });

    it('returns empty array for empty input', () => {
      expect(normalizeMarketProbabilities([])).toEqual([]);
    });

    it('handles 20% overround correctly', () => {
      const impliedProbs = [0.5, 0.4, 0.3]; // sum = 1.2 (20% overround)
      const normalized = normalizeMarketProbabilities(impliedProbs);

      const sum = normalized.reduce((acc, p) => acc + p, 0);
      expect(sum).toBeCloseTo(1.0, 5);

      expect(normalized[0]).toBeCloseTo(0.5 / 1.2, 3);
      expect(normalized[1]).toBeCloseTo(0.4 / 1.2, 3);
      expect(normalized[2]).toBeCloseTo(0.3 / 1.2, 3);
    });
  });

  // ========================================================================
  // BATCH FIELD NORMALIZATION
  // ========================================================================
  describe('normalizeFieldOdds', () => {
    it('normalizes field and returns complete results', () => {
      const field = [
        { odds: 3.0 }, // 2-1, implied 33.3%
        { odds: 4.0 }, // 3-1, implied 25%
        { odds: 6.0 }, // 5-1, implied 16.7%
        { odds: 9.0 }, // 8-1, implied 11.1%
      ];

      const results = normalizeFieldOdds(field);

      expect(results.length).toBe(4);

      // Check that implied probabilities are correct
      expect(results[0]?.impliedProb).toBeCloseTo(1 / 3, 3);
      expect(results[1]?.impliedProb).toBeCloseTo(0.25, 3);
      expect(results[2]?.impliedProb).toBeCloseTo(1 / 6, 3);
      expect(results[3]?.impliedProb).toBeCloseTo(1 / 9, 3);

      // Check that overround is consistent
      const overround = results[0]?.overround ?? 0;
      expect(overround).toBeCloseTo(0.333 + 0.25 + 0.167 + 0.111, 2);

      // Check that normalized probs sum to 1.0
      const normalizedSum = results.reduce((sum, r) => sum + r.normalizedProb, 0);
      expect(normalizedSum).toBeCloseTo(1.0, 3);
    });

    it('returns empty array for empty input', () => {
      expect(normalizeFieldOdds([])).toEqual([]);
    });

    it('calculates correct takeout percent', () => {
      // Field with approximately 17% takeout
      const field = [
        { odds: 2.5 }, // implied 40%
        { odds: 4.0 }, // implied 25%
        { odds: 5.0 }, // implied 20%
        { odds: 6.25 }, // implied 16%
        { odds: 6.25 }, // implied 16%
      ];
      // Total implied = 117%

      const results = normalizeFieldOdds(field);
      expect(results[0]?.overround).toBeCloseTo(1.17, 2);
      expect(results[0]?.takeoutPercent).toBeCloseTo(14.5, 1);
    });
  });

  // ========================================================================
  // DISPLAY FORMATTING
  // ========================================================================
  describe('decimalToFractional', () => {
    it('converts 6.0 to 5-1', () => {
      expect(decimalToFractional(6.0)).toBe('5-1');
    });

    it('converts 2.5 to 3-2', () => {
      expect(decimalToFractional(2.5)).toBe('3-2');
    });

    it('converts 2.0 to EVEN', () => {
      expect(decimalToFractional(2.0)).toBe('EVEN');
    });

    it('converts 1.5 to 1-2', () => {
      expect(decimalToFractional(1.5)).toBe('1-2');
    });

    it('returns EVEN for odds <= 1', () => {
      expect(decimalToFractional(1.0)).toBe('EVEN');
      expect(decimalToFractional(0.5)).toBe('EVEN');
    });
  });

  describe('decimalToAmerican', () => {
    it('converts 6.0 to +500', () => {
      expect(decimalToAmerican(6.0)).toBe('+500');
    });

    it('converts 2.0 to +100', () => {
      expect(decimalToAmerican(2.0)).toBe('+100');
    });

    it('converts 1.5 to -200', () => {
      expect(decimalToAmerican(1.5)).toBe('-200');
    });

    it('converts 2.5 to +150', () => {
      expect(decimalToAmerican(2.5)).toBe('+150');
    });
  });

  // ========================================================================
  // VALIDATION
  // ========================================================================
  describe('validateMarketOdds', () => {
    it('validates reasonable market odds', () => {
      const odds = [3.0, 4.0, 6.0, 9.0];
      const result = validateMarketOdds(odds);

      // This field has ~86% implied, which is under 100% (unusual)
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('flags overround below minimum', () => {
      // Very high odds = very low implied probabilities
      const odds = [10.0, 15.0, 20.0, 25.0]; // ~20% total implied
      const result = validateMarketOdds(odds);

      expect(result.warnings.some((w) => w.includes('below minimum'))).toBe(true);
    });

    it('returns invalid for small field', () => {
      const odds = [3.0];
      const result = validateMarketOdds(odds);

      expect(result.isValid).toBe(false);
      expect(result.warnings.some((w) => w.includes('Insufficient field'))).toBe(true);
    });

    it('flags invalid odds values', () => {
      const odds = [3.0, 0.5, NaN, 4.0];
      const result = validateMarketOdds(odds);

      expect(result.warnings.some((w) => w.includes('invalid odds'))).toBe(true);
    });
  });

  // ========================================================================
  // MORNING LINE / TOTE PARSING
  // ========================================================================
  describe('parseMorningLineOdds', () => {
    it('parses 5-1 correctly', () => {
      const result = parseMorningLineOdds('5-1');
      expect(result.decimalOdds).toBe(6.0);
      expect(result.source).toBe('morning_line');
    });

    it('parses 3/2 correctly', () => {
      const result = parseMorningLineOdds('3/2');
      expect(result.decimalOdds).toBe(2.5);
    });

    it('parses EVEN correctly', () => {
      const result = parseMorningLineOdds('EVEN');
      expect(result.decimalOdds).toBe(2.0);
    });

    it('parses plain number as X-1', () => {
      const result = parseMorningLineOdds('8');
      expect(result.decimalOdds).toBe(9.0);
    });
  });

  describe('parseToteOdds', () => {
    it('parses and marks as tote source', () => {
      const now = new Date();
      const result = parseToteOdds('5-1', now);

      expect(result.decimalOdds).toBe(6.0);
      expect(result.source).toBe('tote');
      expect(result.timestamp).toBe(now);
    });
  });

  // ========================================================================
  // MARKET CONFIG
  // ========================================================================
  describe('MARKET_CONFIG', () => {
    it('has reasonable default takeout', () => {
      expect(MARKET_CONFIG.defaultTakeout).toBe(0.17);
    });

    it('has reasonable overround bounds', () => {
      expect(MARKET_CONFIG.minOverround).toBe(1.1);
      expect(MARKET_CONFIG.maxOverround).toBe(1.35);
    });

    it('has useNormalizedOverlay enabled', () => {
      expect(MARKET_CONFIG.useNormalizedOverlay).toBe(true);
    });
  });
});
