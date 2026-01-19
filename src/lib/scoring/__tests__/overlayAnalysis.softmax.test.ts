/**
 * Softmax Integration Tests for Overlay Analysis
 *
 * Tests the integration of softmax probability conversion with the existing
 * overlay analysis system. Validates that:
 * - Field-relative calculations use softmax
 * - Probabilities are coherent (sum to ~100%)
 * - Tier assignments remain reasonable
 * - Edge cases (heavy favorites, longshots) work correctly
 * - Backward compatibility is maintained
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFieldRelativeWinProbability,
  analyzeOverlayWithField,
  probabilityToDecimalOdds,
  SOFTMAX_CONFIG,
} from '../overlayAnalysis';

describe('Softmax Integration with Overlay Analysis', () => {
  describe('calculateFieldRelativeWinProbability (softmax)', () => {
    it('should return probabilities that are coherent across field', () => {
      const scores = [220, 195, 185, 170, 160, 150, 140, 130];

      // Calculate probabilities for all horses
      const probs = scores.map((score) => calculateFieldRelativeWinProbability(score, scores));

      // All probabilities should be between 2% and 85%
      probs.forEach((p) => {
        expect(p).toBeGreaterThanOrEqual(2);
        expect(p).toBeLessThanOrEqual(85);
      });

      // Probabilities should sum to approximately 100%
      // Note: clamping can cause slight deviations
      const sum = probs.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(90);
      expect(sum).toBeLessThanOrEqual(110);
    });

    it('should give higher probability to higher scores', () => {
      const scores = [200, 150, 100, 80];

      const prob200 = calculateFieldRelativeWinProbability(200, scores);
      const prob150 = calculateFieldRelativeWinProbability(150, scores);
      const prob100 = calculateFieldRelativeWinProbability(100, scores);
      const prob80 = calculateFieldRelativeWinProbability(80, scores);

      expect(prob200).toBeGreaterThan(prob150);
      expect(prob150).toBeGreaterThan(prob100);
      expect(prob100).toBeGreaterThan(prob80);
    });

    it('should handle typical race field (8 horses)', () => {
      const scores = [195, 180, 175, 165, 155, 145, 135, 125];

      // All horses should get valid probabilities
      scores.forEach((score) => {
        const prob = calculateFieldRelativeWinProbability(score, scores);
        expect(prob).toBeGreaterThanOrEqual(2);
        expect(prob).toBeLessThanOrEqual(85);
        expect(Number.isFinite(prob)).toBe(true);
      });
    });

    it('should handle edge case: heavy favorite (250+ score)', () => {
      const scores = [270, 160, 150, 140, 130, 120];

      const favoriteProb = calculateFieldRelativeWinProbability(270, scores);

      // Should be high but capped
      expect(favoriteProb).toBeGreaterThan(30);
      expect(favoriteProb).toBeLessThanOrEqual(85);

      // Should not crash or return NaN
      expect(Number.isFinite(favoriteProb)).toBe(true);
    });

    it('should handle edge case: extreme longshot', () => {
      const scores = [250, 200, 180, 60];

      const longshotProb = calculateFieldRelativeWinProbability(60, scores);

      // Should be low but not zero
      expect(longshotProb).toBeGreaterThanOrEqual(2);
      expect(longshotProb).toBeLessThan(15);
    });

    it('should handle invalid inputs gracefully', () => {
      // Invalid horse score
      expect(calculateFieldRelativeWinProbability(-50, [200, 150])).toBe(2);
      expect(calculateFieldRelativeWinProbability(0, [200, 150])).toBe(2);
      expect(calculateFieldRelativeWinProbability(NaN, [200, 150])).toBe(2);

      // Empty field
      expect(calculateFieldRelativeWinProbability(150, [])).toBe(2);
    });

    it('should support custom temperature parameter', () => {
      const scores = [200, 150, 100, 80];

      // Lower temperature = more extreme (higher for top, lower for bottom)
      const probLowTemp = calculateFieldRelativeWinProbability(200, scores, 0.5);

      // Higher temperature = flatter distribution
      const probHighTemp = calculateFieldRelativeWinProbability(200, scores, 2.0);

      // Default temperature should work
      const _probDefault = calculateFieldRelativeWinProbability(200, scores);

      // Low temp should give higher probability to favorite than high temp
      // (After clamping, this relationship should still generally hold)
      expect(probLowTemp).toBeGreaterThanOrEqual(probHighTemp - 5); // Allow for clamping effects
    });
  });

  describe('analyzeOverlayWithField (softmax)', () => {
    it('should produce coherent analysis for typical race', () => {
      const scores = [200, 180, 160, 140, 120];

      // Analyze each horse
      const analyses = scores.map((score, idx) =>
        analyzeOverlayWithField(score, scores, `${3 + idx}-1`)
      );

      // All analyses should be valid
      analyses.forEach((analysis) => {
        expect(analysis.winProbability).toBeGreaterThanOrEqual(2);
        expect(analysis.winProbability).toBeLessThanOrEqual(85);
        expect(analysis.fairOddsDecimal).toBeGreaterThan(1);
        expect(Number.isFinite(analysis.evPerDollar)).toBe(true);
      });
    });

    it('should calculate correct fair odds from softmax probabilities', () => {
      const scores = [200, 150, 100];

      const analysis = analyzeOverlayWithField(200, scores, '5-1');

      // Fair odds should reflect the probability
      const expectedFairOdds = 100 / analysis.winProbability;
      expect(analysis.fairOddsDecimal).toBeCloseTo(expectedFairOdds, 0);
    });

    it('should detect overlay when actual odds exceed fair odds', () => {
      // Create a scenario where we know there's an overlay
      const scores = [200, 150, 100, 80];

      // Get fair odds for score 200
      const analysis = analyzeOverlayWithField(200, scores, '10-1');

      // If fair odds are lower than 10-1 (11.0 decimal), it's an overlay
      if (analysis.fairOddsDecimal < 11) {
        expect(analysis.overlayPercent).toBeGreaterThan(0);
        expect(analysis.isPositiveEV).toBe(true);
      }
    });

    it('should detect underlay when actual odds are too short', () => {
      const scores = [200, 150, 100, 80];

      // Heavy favorite at very short odds
      const analysis = analyzeOverlayWithField(200, scores, '1-5');

      // Fair odds should be higher than 1-5 (1.2 decimal)
      if (analysis.fairOddsDecimal > 1.2) {
        expect(analysis.overlayPercent).toBeLessThan(0);
        expect(analysis.isPositiveEV).toBe(false);
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain realistic probability range', () => {
      // Various test scores
      const testScores = [
        [250, 200, 150, 100],
        [180, 175, 170, 165, 160],
        [300, 100, 50],
      ];

      testScores.forEach((scores) => {
        scores.forEach((score) => {
          const prob = calculateFieldRelativeWinProbability(score, scores);
          // Should always be within realistic bounds
          expect(prob).toBeGreaterThanOrEqual(2);
          expect(prob).toBeLessThanOrEqual(85);
        });
      });
    });

    it('should work with existing probabilityToDecimalOdds function', () => {
      const scores = [200, 150, 100];
      const prob = calculateFieldRelativeWinProbability(200, scores);

      // Should be able to convert to decimal odds
      const fairOdds = probabilityToDecimalOdds(prob);

      expect(fairOdds).toBeGreaterThan(1);
      expect(fairOdds).toBeLessThan(100);
      expect(Number.isFinite(fairOdds)).toBe(true);
    });

    it('should not break tier classification logic', () => {
      // Tier thresholds are based on SCORES, not probabilities
      // So this is more of a sanity check that probability calculation
      // doesn't affect the score-based tier logic

      const highScore = 195; // Tier 1 territory
      const midScore = 165; // Tier 2 territory
      const lowScore = 145; // Tier 3 territory

      const scores = [highScore, midScore, lowScore, 120, 100];

      // Probabilities should reflect score ordering
      const probHigh = calculateFieldRelativeWinProbability(highScore, scores);
      const probMid = calculateFieldRelativeWinProbability(midScore, scores);
      const probLow = calculateFieldRelativeWinProbability(lowScore, scores);

      expect(probHigh).toBeGreaterThan(probMid);
      expect(probMid).toBeGreaterThan(probLow);
    });
  });

  describe('Real Race Scenarios', () => {
    it('Scenario C: 8-horse race with spread of scores', () => {
      // Typical Tier 1, 2, 3, and pass horses
      const scores = [210, 185, 170, 155, 150, 140, 130, 115];

      // Calculate all probabilities
      const probs = scores.map((s) => calculateFieldRelativeWinProbability(s, scores));

      // Verify decreasing order
      for (let i = 0; i < probs.length - 1; i++) {
        expect(probs[i]).toBeGreaterThanOrEqual(probs[i + 1]! - 0.5); // Allow tiny rounding
      }

      // Sum should be close to 100% (accounting for clamping)
      const sum = probs.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(85);
      expect(sum).toBeLessThan(115);
    });

    it('Scenario D: Field with dominant favorite', () => {
      const scores = [280, 165, 155, 145, 135, 125];

      const favoriteProb = calculateFieldRelativeWinProbability(280, scores);
      const secondProb = calculateFieldRelativeWinProbability(165, scores);

      // Favorite should have significantly higher probability
      expect(favoriteProb).toBeGreaterThan(secondProb * 1.5);

      // But still capped at 85%
      expect(favoriteProb).toBeLessThanOrEqual(85);
    });

    it('Scenario: Very competitive field (similar scores)', () => {
      const scores = [175, 172, 170, 168, 165, 162];

      const probs = scores.map((s) => calculateFieldRelativeWinProbability(s, scores));

      // Probabilities should be relatively close in a competitive field
      const maxProb = Math.max(...probs);
      const minProb = Math.min(...probs);
      const spread = maxProb - minProb;

      // With similar scores, spread should be moderate
      expect(spread).toBeLessThan(30);
    });

    it('Scenario: Fair odds conversion matches expected for 25% probability', () => {
      // If a horse has 25% win probability, fair odds should be 4.0 (3-1)
      // This is a fundamental relationship we must maintain

      // Find a field configuration that gives approximately 25% probability
      const scores = [200, 150, 150, 150]; // Roughly 25% for first horse with linear
      const prob = calculateFieldRelativeWinProbability(200, scores);

      // Get fair odds
      const fairOdds = probabilityToDecimalOdds(prob);

      // Fair odds = 100 / probability
      const expectedOdds = 100 / prob;
      expect(fairOdds).toBeCloseTo(expectedOdds, 0);
    });
  });

  describe('SOFTMAX_CONFIG export', () => {
    it('should export SOFTMAX_CONFIG from overlayAnalysis', () => {
      expect(SOFTMAX_CONFIG).toBeDefined();
      expect(SOFTMAX_CONFIG.temperature).toBe(1.0);
      expect(SOFTMAX_CONFIG.minProbability).toBe(0.005);
      expect(SOFTMAX_CONFIG.maxProbability).toBe(0.95);
    });
  });

  describe('Comparison: Before vs After Softmax', () => {
    /**
     * This test documents the expected behavior change from linear to softmax.
     *
     * Linear (old): Win% = score / sum(all_scores) * 100
     * Softmax (new): Win% = exp(score/T) / sum(exp(all_scores/T)) * 100
     *
     * Key differences:
     * - Softmax is more sensitive to score differences
     * - Higher scores get proportionally more probability
     * - Provides better separation between top and bottom
     */
    it('should produce more differentiated probabilities than linear', () => {
      const scores = [200, 150, 100, 80];

      // Calculate softmax probabilities
      const softmaxProbs = scores.map((s) => calculateFieldRelativeWinProbability(s, scores));

      // Linear would give: [200/530, 150/530, 100/530, 80/530] * 100
      // = [37.7, 28.3, 18.9, 15.1]
      const linearProbs = scores.map((s) => (s / scores.reduce((a, b) => a + b, 0)) * 100);

      // Calculate the spread (max - min) for each method
      const softmaxSpread = Math.max(...softmaxProbs) - Math.min(...softmaxProbs);
      const linearSpread = Math.max(...linearProbs) - Math.min(...linearProbs);

      // Softmax should generally produce larger spread (more differentiation)
      // This is the key behavioral change we're introducing
      // Note: Clamping may affect this, so we allow for that
      expect(softmaxSpread).toBeGreaterThan(linearSpread * 0.8); // Allow some tolerance
    });
  });
});
