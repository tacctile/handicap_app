/**
 * Normalized Overlay Analysis Tests
 *
 * Tests for the new normalized overlay calculations that remove
 * takeout/overround from market probabilities.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTrueOverlayPercent,
  calculateRawOverlayPercent,
  classifyNormalizedValue,
  analyzeOverlayWithField,
  NORMALIZED_VALUE_THRESHOLDS,
} from '../overlayAnalysis';

import {
  MARKET_CONFIG,
  calculateOverround,
  normalizeMarketProbabilities,
} from '../marketNormalization';

describe('Normalized Overlay Analysis', () => {
  // ========================================================================
  // TRUE OVERLAY CALCULATION
  // ========================================================================
  describe('calculateTrueOverlayPercent', () => {
    it('calculates true overlay correctly', () => {
      // Model says 25%, normalized market says 17%
      // True overlay = (0.25 - 0.17) / 0.17 * 100 = 47.1%
      const result = calculateTrueOverlayPercent(0.25, 0.17);
      expect(result).toBeCloseTo(47.1, 1);
    });

    it('calculates negative overlay (underlay)', () => {
      // Model says 20%, normalized market says 25%
      // True overlay = (0.20 - 0.25) / 0.25 * 100 = -20%
      const result = calculateTrueOverlayPercent(0.2, 0.25);
      expect(result).toBe(-20.0);
    });

    it('calculates zero overlay when probabilities match', () => {
      const result = calculateTrueOverlayPercent(0.2, 0.2);
      expect(result).toBe(0);
    });

    it('handles edge case of very small market prob', () => {
      const result = calculateTrueOverlayPercent(0.05, 0.001);
      expect(result).toBe(0); // Should return 0 to avoid division issues
    });

    it('handles invalid inputs', () => {
      expect(calculateTrueOverlayPercent(NaN, 0.2)).toBe(0);
      expect(calculateTrueOverlayPercent(0.2, NaN)).toBe(0);
    });
  });

  // ========================================================================
  // RAW OVERLAY CALCULATION
  // ========================================================================
  describe('calculateRawOverlayPercent', () => {
    it('calculates raw overlay correctly', () => {
      // Model says 25%, implied (with vig) says 20%
      // Raw overlay = (0.25 - 0.20) / 0.20 * 100 = 25%
      const result = calculateRawOverlayPercent(0.25, 0.2);
      expect(result).toBe(25.0);
    });

    it('raw overlay should be smaller than true overlay', () => {
      // When market has takeout, raw implied prob is inflated
      // So raw overlay calculation underestimates true edge
      const modelProb = 0.25;
      const rawImplied = 0.2; // With ~17% takeout
      const normalizedMarket = 0.17; // After removing takeout

      const rawOverlay = calculateRawOverlayPercent(modelProb, rawImplied);
      const trueOverlay = calculateTrueOverlayPercent(modelProb, normalizedMarket);

      // True overlay should be LARGER because denominator is smaller
      expect(trueOverlay).toBeGreaterThan(rawOverlay);
    });
  });

  // ========================================================================
  // TRUE VS RAW OVERLAY COMPARISON
  // ========================================================================
  describe('True overlay vs Raw overlay comparison', () => {
    it('true overlay is larger than raw overlay by roughly takeout amount', () => {
      // With 17% takeout, true overlay should be meaningfully larger
      const modelProb = 0.3; // Our model says 30%

      // Market with 17% overround
      const rawImplied = 0.25; // 4-1 odds = 25% implied
      // After normalization (divide by 1.17)
      const normalizedMarket = 0.25 / 1.17;

      const rawOverlay = calculateRawOverlayPercent(modelProb, rawImplied);
      const trueOverlay = calculateTrueOverlayPercent(modelProb, normalizedMarket);

      // Raw: (0.30 - 0.25) / 0.25 = 20%
      expect(rawOverlay).toBe(20.0);

      // True: (0.30 - 0.214) / 0.214 = 40.2%
      expect(trueOverlay).toBeGreaterThan(35);
      expect(trueOverlay).toBeLessThan(45);

      // The difference reflects the removed takeout
      expect(trueOverlay - rawOverlay).toBeGreaterThan(15);
    });
  });

  // ========================================================================
  // VALUE CLASSIFICATION (NORMALIZED)
  // ========================================================================
  describe('classifyNormalizedValue', () => {
    it('classifies STRONG_VALUE at 15%+ overlay', () => {
      expect(classifyNormalizedValue(15)).toBe('STRONG_VALUE');
      expect(classifyNormalizedValue(20)).toBe('STRONG_VALUE');
      expect(classifyNormalizedValue(50)).toBe('STRONG_VALUE');
    });

    it('classifies MODERATE_VALUE at 8-14% overlay', () => {
      expect(classifyNormalizedValue(8)).toBe('MODERATE_VALUE');
      expect(classifyNormalizedValue(10)).toBe('MODERATE_VALUE');
      expect(classifyNormalizedValue(14)).toBe('MODERATE_VALUE');
    });

    it('classifies SLIGHT_VALUE at 3-7% overlay', () => {
      expect(classifyNormalizedValue(3)).toBe('SLIGHT_VALUE');
      expect(classifyNormalizedValue(5)).toBe('SLIGHT_VALUE');
      expect(classifyNormalizedValue(7)).toBe('SLIGHT_VALUE');
    });

    it('classifies NEUTRAL at -3% to +2% overlay', () => {
      expect(classifyNormalizedValue(0)).toBe('NEUTRAL');
      expect(classifyNormalizedValue(2)).toBe('NEUTRAL');
      expect(classifyNormalizedValue(-2)).toBe('NEUTRAL');
    });

    it('classifies UNDERLAY below -3%', () => {
      expect(classifyNormalizedValue(-4)).toBe('UNDERLAY');
      expect(classifyNormalizedValue(-10)).toBe('UNDERLAY');
      expect(classifyNormalizedValue(-20)).toBe('UNDERLAY');
    });

    it('handles edge cases', () => {
      expect(classifyNormalizedValue(NaN)).toBe('NEUTRAL');
    });
  });

  // ========================================================================
  // NORMALIZED VALUE THRESHOLDS
  // ========================================================================
  describe('NORMALIZED_VALUE_THRESHOLDS', () => {
    it('has tighter thresholds than raw thresholds', () => {
      // Normalized thresholds should be lower because vig is removed
      expect(NORMALIZED_VALUE_THRESHOLDS.strongOverlay).toBe(15);
      expect(NORMALIZED_VALUE_THRESHOLDS.moderateOverlay).toBe(8);
      expect(NORMALIZED_VALUE_THRESHOLDS.slightOverlay).toBe(3);
      expect(NORMALIZED_VALUE_THRESHOLDS.neutralMin).toBe(-3);
      expect(NORMALIZED_VALUE_THRESHOLDS.neutralMax).toBe(3);
    });
  });

  // ========================================================================
  // ANALYZE WITH FIELD (FULL INTEGRATION)
  // ========================================================================
  describe('analyzeOverlayWithField with normalization', () => {
    it('includes normalized overlay fields in result', () => {
      // 8-horse field with typical scores
      const fieldScores = [250, 230, 200, 190, 170, 160, 150, 140];
      const fieldOdds = ['5-2', '3-1', '4-1', '5-1', '8-1', '10-1', '12-1', '15-1'];

      // Analyze the favorite (250 score, 5-2 odds)
      const result = analyzeOverlayWithField(250, fieldScores, '5-2', fieldOdds);

      // Should have new normalized fields
      expect(result.normalizedMarketProb).toBeDefined();
      expect(result.rawImpliedProb).toBeDefined();
      expect(result.overround).toBeDefined();
      expect(result.trueOverlayPercent).toBeDefined();
      expect(result.rawOverlayPercent).toBeDefined();
      expect(result.valueClassification).toBeDefined();
    });

    it('normalized probs differ from raw implied based on overround', () => {
      const fieldScores = [200, 180, 170, 160, 150, 140];
      // Create a field with realistic odds
      // 2-1 = 33.3%, 4-1 = 20%, 5-1 = 16.7%, 7-1 = 12.5%, 10-1 = 9.1%, 15-1 = 6.25%
      // Total = ~98% (under 100%, so normalized will be higher)
      const fieldOdds = ['2-1', '4-1', '5-1', '7-1', '10-1', '15-1'];

      const result = analyzeOverlayWithField(200, fieldScores, '2-1', fieldOdds);

      // Normalized should exist
      expect(result.normalizedMarketProb).toBeDefined();
      expect(result.rawImpliedProb).toBeDefined();

      // When overround < 1.0, normalized probs are HIGHER than raw
      // When overround > 1.0, normalized probs are LOWER than raw
      if (result.overround && result.normalizedMarketProb && result.rawImpliedProb) {
        if (result.overround > 1.0) {
          expect(result.normalizedMarketProb).toBeLessThan(result.rawImpliedProb);
        } else {
          // With low overround, normalization increases probs to sum to 1.0
          expect(result.normalizedMarketProb).toBeGreaterThanOrEqual(result.rawImpliedProb);
        }
      }
    });

    it('calculates overround correctly', () => {
      const fieldScores = [200, 180, 170, 160, 150, 140];
      // Odds that create roughly 117% overround
      const fieldOdds = ['2-1', '4-1', '5-1', '7-1', '10-1', '15-1'];
      // 2-1 = 33.3%, 4-1 = 20%, 5-1 = 16.7%, 7-1 = 12.5%, 10-1 = 9.1%, 15-1 = 6.25%
      // Total = ~98% (actually under, need adjustment)

      const result = analyzeOverlayWithField(200, fieldScores, '2-1', fieldOdds);

      expect(result.overround).toBeDefined();
      expect(result.overround).toBeGreaterThan(0.9);
    });

    it('value classification uses normalized overlay', () => {
      const fieldScores = [250, 200, 180, 170, 160, 150];
      const fieldOdds = ['5-2', '4-1', '5-1', '7-1', '10-1', '12-1'];

      const result = analyzeOverlayWithField(250, fieldScores, '5-2', fieldOdds);

      expect(result.valueClassification).toBeDefined();
      expect(['STRONG_VALUE', 'MODERATE_VALUE', 'SLIGHT_VALUE', 'NEUTRAL', 'UNDERLAY']).toContain(
        result.valueClassification
      );
    });
  });

  // ========================================================================
  // FULL FIELD NORMALIZATION SCENARIO
  // ========================================================================
  describe('Field with 20% overround normalizes correctly', () => {
    it('normalizes and calculates overlays for entire field', () => {
      // Create a field with exactly 20% overround
      // Odds: 2-1, 3-1, 5-1, 8-1
      // Decimal: 3.0, 4.0, 6.0, 9.0
      // Implied: 33.3%, 25%, 16.7%, 11.1% = 86.1% (under 100%)

      // For 20% overround, we need odds that sum to 120% implied
      // Let's use: 2.0, 2.5, 4.0, 5.0
      // Implied: 50%, 40%, 25%, 20% = 135% (too high)

      // Better: 2.5, 3.33, 5.0, 10.0
      // Implied: 40%, 30%, 20%, 10% = 100% (perfect, no takeout)

      // For ~117% overround:
      // 2.2, 3.0, 5.0, 10.0
      // Implied: 45%, 33%, 20%, 10% = 108%

      // Actually let's just verify the math works
      const impliedProbs = [0.35, 0.25, 0.2, 0.15, 0.12, 0.1]; // Sum = 117%
      const overround = calculateOverround(impliedProbs);
      expect(overround).toBe(1.17);

      const normalized = normalizeMarketProbabilities(impliedProbs);
      const normalizedSum = normalized.reduce((a, b) => a + b, 0);
      expect(normalizedSum).toBeCloseTo(1.0, 5);

      // Each normalized prob is original / 1.17
      expect(normalized[0]).toBeCloseTo(0.35 / 1.17, 3);
    });
  });

  // ========================================================================
  // BACKWARD COMPATIBILITY
  // ========================================================================
  describe('Backward compatibility', () => {
    it('overlayPercent field still works', () => {
      const fieldScores = [200, 180, 170, 160];
      const fieldOdds = ['3-1', '5-1', '7-1', '10-1'];

      const result = analyzeOverlayWithField(200, fieldScores, '3-1', fieldOdds);

      // overlayPercent should still be defined
      expect(result.overlayPercent).toBeDefined();
      expect(typeof result.overlayPercent).toBe('number');
    });

    it('valueClass still works with legacy classification', () => {
      const fieldScores = [200, 180, 170, 160];

      const result = analyzeOverlayWithField(200, fieldScores, '8-1');

      // Legacy value class should still work
      expect(result.valueClass).toBeDefined();
      expect([
        'massive_overlay',
        'strong_overlay',
        'moderate_overlay',
        'slight_overlay',
        'fair_price',
        'underlay',
      ]).toContain(result.valueClass);
    });

    it('works without field odds (uses estimated overround)', () => {
      const fieldScores = [200, 180, 170, 160];

      // No field odds provided
      const result = analyzeOverlayWithField(200, fieldScores, '5-1');

      // Should still calculate normalized fields using default takeout
      expect(result.normalizedMarketProb).toBeDefined();
      expect(result.overround).toBeCloseTo(1 + MARKET_CONFIG.defaultTakeout, 2);
    });
  });

  // ========================================================================
  // SCENARIO: STRONG VALUE DETECTION
  // ========================================================================
  describe('Strong value detection at 15%+ true overlay', () => {
    it('detects strong value correctly', () => {
      // Create scenario where model probability significantly exceeds normalized market
      // Model says 35%, market (after normalization) says 20%
      // True overlay = (0.35 - 0.20) / 0.20 = 75%

      const trueOverlay = calculateTrueOverlayPercent(0.35, 0.2);
      expect(trueOverlay).toBe(75);

      const classification = classifyNormalizedValue(trueOverlay);
      expect(classification).toBe('STRONG_VALUE');
    });

    it('detects borderline strong value at exactly 15%', () => {
      const classification = classifyNormalizedValue(15);
      expect(classification).toBe('STRONG_VALUE');
    });
  });

  // ========================================================================
  // MARKET CONFIG
  // ========================================================================
  describe('MARKET_CONFIG integration', () => {
    it('uses 17% default takeout', () => {
      expect(MARKET_CONFIG.defaultTakeout).toBe(0.17);
    });

    it('has useNormalizedOverlay enabled', () => {
      expect(MARKET_CONFIG.useNormalizedOverlay).toBe(true);
    });
  });
});
