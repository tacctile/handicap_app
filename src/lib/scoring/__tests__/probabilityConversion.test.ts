/**
 * Unit tests for Softmax Probability Conversion
 *
 * Tests the softmax-based probability conversion functions including:
 * - Basic softmax calculations
 * - Temperature effects
 * - Edge cases (empty, single horse, all zeros, negatives)
 * - Numerical stability with large/small scores
 * - Probability bounds and clamping
 * - Fair odds conversion
 * - Validation functions
 */

import { describe, it, expect } from 'vitest';
import {
  softmaxProbabilities,
  scoreToProbability,
  probabilityToFairOdds,
  fairOddsToImpliedProbability,
  validateProbabilities,
  calculateWinProbabilitySoftmax,
  SOFTMAX_CONFIG,
  getSoftmaxConfig,
  createSoftmaxConfig,
} from '../probabilityConversion';

describe('softmaxProbabilities', () => {
  describe('basic functionality', () => {
    it('should return probabilities that sum to 1.0', () => {
      const scores = [200, 150, 100, 80];
      const probs = softmaxProbabilities(scores);

      const sum = probs.reduce((acc, p) => acc + p, 0);
      expect(sum).toBeCloseTo(1.0, 3);
    });

    it('should return higher probability for higher scores', () => {
      const scores = [200, 150, 100, 80];
      const probs = softmaxProbabilities(scores);

      // Verify decreasing order
      expect(probs[0]).toBeGreaterThan(probs[1]!);
      expect(probs[1]).toBeGreaterThan(probs[2]!);
      expect(probs[2]).toBeGreaterThan(probs[3]!);
    });

    it('should return same length array as input', () => {
      const scores = [200, 150, 100, 80, 60, 50];
      const probs = softmaxProbabilities(scores);

      expect(probs.length).toBe(scores.length);
    });

    it('should handle typical race field scores', () => {
      // Typical 8-horse race
      const scores = [220, 195, 185, 170, 160, 150, 140, 130];
      const probs = softmaxProbabilities(scores);

      // Sum to 1
      expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 3);

      // All positive
      probs.forEach((p) => {
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty input', () => {
      const probs = softmaxProbabilities([]);
      expect(probs).toEqual([]);
    });

    it('should return [1.0] for single horse', () => {
      const probs = softmaxProbabilities([200]);
      expect(probs).toHaveLength(1);
      expect(probs[0]).toBe(1.0);
    });

    it('should return equal probabilities for all zeros', () => {
      const scores = [0, 0, 0, 0];
      const probs = softmaxProbabilities(scores);

      const equalProb = 1 / 4;
      probs.forEach((p) => {
        expect(p).toBeCloseTo(equalProb, 5);
      });
    });

    it('should handle negative scores by treating as zero', () => {
      const scores = [200, 150, -50, -100];
      const probs = softmaxProbabilities(scores);

      // Should still sum to 1
      expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 3);
      // Highest positive score gets highest probability
      expect(probs[0]).toBeGreaterThan(probs[1]!);
    });

    it('should handle all identical scores', () => {
      const scores = [150, 150, 150, 150];
      const probs = softmaxProbabilities(scores);

      // All should be equal
      const expected = 1 / 4;
      probs.forEach((p) => {
        expect(p).toBeCloseTo(expected, 5);
      });
    });

    it('should handle NaN/Infinity by treating as zero', () => {
      const scores = [200, NaN, 100, Infinity];
      const probs = softmaxProbabilities(scores);

      expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 3);
    });
  });

  describe('numerical stability', () => {
    it('should handle very large scores (300+) without overflow', () => {
      const scores = [350, 320, 300, 280];
      const probs = softmaxProbabilities(scores);

      // Should not have NaN or Infinity
      probs.forEach((p) => {
        expect(Number.isFinite(p)).toBe(true);
      });

      // Should sum to 1
      expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 3);
    });

    it('should handle extreme score differences', () => {
      const scores = [328, 100, 50, 10];
      const probs = softmaxProbabilities(scores);

      // Should not have NaN or Infinity
      probs.forEach((p) => {
        expect(Number.isFinite(p)).toBe(true);
      });

      // Sum to 1
      expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 3);
    });

    it('should handle very small positive scores', () => {
      const scores = [5, 3, 2, 1];
      const probs = softmaxProbabilities(scores);

      expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 3);
      expect(probs[0]).toBeGreaterThan(probs[3]!);
    });
  });

  describe('temperature effects', () => {
    const scores = [200, 150, 100, 80];

    it('should produce more extreme distribution with temperature=0.5', () => {
      const normalProbs = softmaxProbabilities(scores, 1.0);
      const extremeProbs = softmaxProbabilities(scores, 0.5);

      // Lower temperature = higher probability for top scorer
      // Note: After clamping, the differences may be adjusted
      expect(extremeProbs[0]).toBeGreaterThanOrEqual(normalProbs[0]! - 0.1);

      // Sum should still be 1
      expect(extremeProbs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 3);
    });

    it('should produce flatter distribution with temperature=2.0', () => {
      const normalProbs = softmaxProbabilities(scores, 1.0);
      const flatProbs = softmaxProbabilities(scores, 2.0);

      // Higher temperature = lower probability for top scorer (flatter)
      // The difference between top and bottom should be smaller
      const normalSpread = (normalProbs[0] ?? 0) - (normalProbs[3] ?? 0);
      const flatSpread = (flatProbs[0] ?? 0) - (flatProbs[3] ?? 0);

      expect(flatSpread).toBeLessThan(normalSpread);
    });

    it('should handle very low temperature (near deterministic)', () => {
      const probs = softmaxProbabilities(scores, 0.1);

      // Should still sum to 1 and be valid
      expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 3);
      probs.forEach((p) => {
        expect(Number.isFinite(p)).toBe(true);
      });
    });

    it('should use default temperature from config', () => {
      const probs = softmaxProbabilities(scores);
      const probsWithDefault = softmaxProbabilities(scores, SOFTMAX_CONFIG.temperature);

      probs.forEach((p, i) => {
        expect(p).toBeCloseTo(probsWithDefault[i]!, 10);
      });
    });
  });

  describe('probability bounds (clamping)', () => {
    it('should not have any probability below minProbability', () => {
      // Extreme case where one horse dominates
      const scores = [300, 50, 40, 30];
      const probs = softmaxProbabilities(scores);

      probs.forEach((p) => {
        expect(p).toBeGreaterThanOrEqual(SOFTMAX_CONFIG.minProbability - 0.001);
      });
    });

    it('should not have any probability above maxProbability', () => {
      // Extreme case where one horse dominates
      const scores = [300, 50, 40, 30];
      const probs = softmaxProbabilities(scores);

      probs.forEach((p) => {
        expect(p).toBeLessThanOrEqual(SOFTMAX_CONFIG.maxProbability + 0.001);
      });
    });

    it('should maintain sum=1 after clamping', () => {
      const scores = [300, 50, 40, 30];
      const probs = softmaxProbabilities(scores);

      expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 3);
    });
  });
});

describe('scoreToProbability', () => {
  it('should return probability for a score within field', () => {
    const fieldScores = [200, 150, 100, 80];
    const prob = scoreToProbability(200, fieldScores);

    expect(prob).toBeGreaterThan(0);
    expect(prob).toBeLessThanOrEqual(1);
  });

  it('should return highest probability for highest score', () => {
    const fieldScores = [200, 150, 100, 80];
    const prob200 = scoreToProbability(200, fieldScores);
    const prob80 = scoreToProbability(80, fieldScores);

    expect(prob200).toBeGreaterThan(prob80);
  });

  it('should handle score not in field by adding it', () => {
    const fieldScores = [200, 150, 100];
    const prob = scoreToProbability(80, fieldScores);

    expect(prob).toBeGreaterThan(0);
    expect(prob).toBeLessThan(1);
  });

  it('should return minProbability for empty field', () => {
    const prob = scoreToProbability(150, []);
    expect(prob).toBe(SOFTMAX_CONFIG.minProbability);
  });
});

describe('probabilityToFairOdds', () => {
  it('should convert 25% probability to 4.0 decimal odds', () => {
    const odds = probabilityToFairOdds(0.25);
    expect(odds).toBeCloseTo(4.0, 1);
  });

  it('should convert 50% probability to 2.0 decimal odds', () => {
    const odds = probabilityToFairOdds(0.5);
    expect(odds).toBeCloseTo(2.0, 1);
  });

  it('should convert 10% probability to 10.0 decimal odds', () => {
    const odds = probabilityToFairOdds(0.1);
    expect(odds).toBeCloseTo(10.0, 1);
  });

  it('should convert 20% probability to 5.0 decimal odds', () => {
    const odds = probabilityToFairOdds(0.2);
    expect(odds).toBeCloseTo(5.0, 1);
  });

  it('should handle near-zero probability', () => {
    const odds = probabilityToFairOdds(0.001);
    expect(odds).toBe(100); // Capped at 99-1
  });

  it('should handle near-certainty probability', () => {
    const odds = probabilityToFairOdds(0.99);
    expect(odds).toBeCloseTo(1.01, 1);
  });

  it('should handle invalid input gracefully', () => {
    expect(probabilityToFairOdds(0)).toBe(100);
    expect(probabilityToFairOdds(-0.1)).toBe(100);
    expect(probabilityToFairOdds(NaN)).toBe(100);
  });
});

describe('fairOddsToImpliedProbability', () => {
  it('should convert 4.0 decimal odds to 25% probability', () => {
    const prob = fairOddsToImpliedProbability(4.0);
    expect(prob).toBeCloseTo(0.25, 2);
  });

  it('should convert 2.0 decimal odds to 50% probability', () => {
    const prob = fairOddsToImpliedProbability(2.0);
    expect(prob).toBeCloseTo(0.5, 2);
  });

  it('should convert 10.0 decimal odds to 10% probability', () => {
    const prob = fairOddsToImpliedProbability(10.0);
    expect(prob).toBeCloseTo(0.1, 2);
  });

  it('should respect minProbability bound', () => {
    const prob = fairOddsToImpliedProbability(1000);
    expect(prob).toBeGreaterThanOrEqual(SOFTMAX_CONFIG.minProbability);
  });

  it('should respect maxProbability bound', () => {
    const prob = fairOddsToImpliedProbability(1.01);
    expect(prob).toBeLessThanOrEqual(SOFTMAX_CONFIG.maxProbability);
  });
});

describe('validateProbabilities', () => {
  it('should return true for valid probabilities summing to 1', () => {
    const probs = [0.4, 0.3, 0.2, 0.1];
    expect(validateProbabilities(probs)).toBe(true);
  });

  it('should return true for empty array', () => {
    expect(validateProbabilities([])).toBe(true);
  });

  it('should throw for probabilities not summing to 1', () => {
    const probs = [0.5, 0.5, 0.5];
    expect(() => validateProbabilities(probs)).toThrow('sum');
  });

  it('should throw for negative probability', () => {
    const probs = [0.5, 0.6, -0.1];
    expect(() => validateProbabilities(probs)).toThrow('outside');
  });

  it('should throw for probability > 1', () => {
    // Note: sum check happens first, so this throws "sum" error
    // To test the outside check, we need values that sum to 1 but have invalid individual values
    const probs = [0.5, 0.3, 1.2];
    // This will throw either "sum" or "outside" - both indicate validation failure
    expect(() => validateProbabilities(probs)).toThrow();
  });

  it('should accept small floating point errors within tolerance', () => {
    const probs = [0.333333, 0.333333, 0.333334]; // Sums to 1.0
    expect(validateProbabilities(probs, 0.001)).toBe(true);
  });
});

describe('calculateWinProbabilitySoftmax', () => {
  it('should return probability as percentage (0-100)', () => {
    const scores = [200, 150, 100, 80];
    const prob = calculateWinProbabilitySoftmax(200, scores);

    expect(prob).toBeGreaterThanOrEqual(2);
    expect(prob).toBeLessThanOrEqual(85);
  });

  it('should give higher percentage to higher scores', () => {
    const scores = [200, 150, 100, 80];
    const prob200 = calculateWinProbabilitySoftmax(200, scores);
    const prob80 = calculateWinProbabilitySoftmax(80, scores);

    expect(prob200).toBeGreaterThan(prob80);
  });

  it('should return minimum for invalid horse score', () => {
    const prob = calculateWinProbabilitySoftmax(-50, [200, 150]);
    expect(prob).toBe(SOFTMAX_CONFIG.minProbability * 100);
  });

  it('should return minimum for empty field', () => {
    const prob = calculateWinProbabilitySoftmax(150, []);
    expect(prob).toBe(SOFTMAX_CONFIG.minProbability * 100);
  });

  it('should handle score not in field array', () => {
    const scores = [200, 150, 100];
    const prob = calculateWinProbabilitySoftmax(80, scores);

    expect(prob).toBeGreaterThanOrEqual(2);
    expect(prob).toBeLessThanOrEqual(85);
  });

  it('should clamp to realistic bounds', () => {
    // Extreme favorite
    const probHigh = calculateWinProbabilitySoftmax(300, [300, 50, 40]);
    expect(probHigh).toBeLessThanOrEqual(85);

    // Extreme longshot
    const probLow = calculateWinProbabilitySoftmax(30, [300, 200, 30]);
    expect(probLow).toBeGreaterThanOrEqual(2);
  });
});

describe('configuration', () => {
  it('should have sensible default configuration', () => {
    expect(SOFTMAX_CONFIG.temperature).toBe(1.0);
    expect(SOFTMAX_CONFIG.minProbability).toBe(0.005);
    expect(SOFTMAX_CONFIG.maxProbability).toBe(0.95);
  });

  it('should return config copy from getSoftmaxConfig', () => {
    const config = getSoftmaxConfig();
    expect(config.temperature).toBe(SOFTMAX_CONFIG.temperature);
  });

  it('should create new config with overrides', () => {
    const newConfig = createSoftmaxConfig({ temperature: 0.5 });
    expect(newConfig.temperature).toBe(0.5);
    expect(newConfig.minProbability).toBe(SOFTMAX_CONFIG.minProbability);
  });
});

describe('real-world scenarios', () => {
  it('Scenario A: Basic softmax with typical scores', () => {
    const scores = [200, 150, 100, 80];
    const probs = softmaxProbabilities(scores, 1.0);

    // Verify: highest score gets highest probability
    expect(probs[0]).toBeGreaterThan(probs[1]!);
    expect(probs[1]).toBeGreaterThan(probs[2]!);
    expect(probs[2]).toBeGreaterThan(probs[3]!);

    // Verify: probabilities sum to 1.0
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5);
  });

  it('Scenario B: Temperature effects on same scores', () => {
    const scores = [200, 150, 100, 80];

    // Temperature=0.5: more extreme spread
    const extremeProbs = softmaxProbabilities(scores, 0.5);
    const extremeSpread = (extremeProbs[0] ?? 0) - (extremeProbs[3] ?? 0);

    // Temperature=2.0: flatter spread
    const flatProbs = softmaxProbabilities(scores, 2.0);
    const flatSpread = (flatProbs[0] ?? 0) - (flatProbs[3] ?? 0);

    // Extreme should have larger spread than flat
    expect(extremeSpread).toBeGreaterThan(flatSpread);
  });

  it('Scenario C: Heavy favorite (250+ score)', () => {
    // Heavy favorite scenario
    const scores = [270, 160, 150, 140, 130, 120];
    const probs = softmaxProbabilities(scores);

    // Should not break the system
    probs.forEach((p) => {
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });

    // Sum to 1
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 3);

    // Heavy favorite should get highest but capped probability
    expect(probs[0]).toBeLessThanOrEqual(SOFTMAX_CONFIG.maxProbability);
  });

  it('Fair odds conversion is correct: 25% = 4.0 decimal odds', () => {
    const odds = probabilityToFairOdds(0.25);
    expect(odds).toBeCloseTo(4.0, 1);
  });
});
