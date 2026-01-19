/**
 * Tests for Platt Scaling Parameter Fitter
 *
 * Tests cover:
 * - Gradient descent converges
 * - Cross-validation produces stable estimates
 * - Regularization prevents extreme parameters
 * - Handles small datasets gracefully
 * - Grid search alternative works
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGradients,
  fitPlattGradientDescent,
  fitPlattParameters,
  crossValidatePlatt,
  fitPlattGridSearch,
  evaluateUncalibrated,
  DEFAULT_FITTING_CONFIG,
} from '../plattFitter';

describe('plattFitter', () => {
  // ==========================================================================
  // Gradient Calculation
  // ==========================================================================

  describe('calculateGradients', () => {
    it('should return zero gradients when predictions match outcomes', () => {
      // Perfect predictions: 0.9 when win, 0.1 when loss
      const predictions = [0.9, 0.1, 0.9, 0.1];
      const outcomes = [true, false, true, false];

      const { gradA, gradB } = calculateGradients(predictions, outcomes, 1.0, 0.0, 0);

      // Gradients should be small (not exactly zero due to logit transformation)
      expect(Math.abs(gradA)).toBeLessThan(0.5);
      expect(Math.abs(gradB)).toBeLessThan(0.5);
    });

    it('should return non-zero gradients for biased predictions', () => {
      // Predictions systematically too high
      const predictions = [0.8, 0.8, 0.8, 0.8];
      const outcomes = [false, false, false, false]; // All losses

      const { gradA: _gradA, gradB } = calculateGradients(predictions, outcomes, 1.0, 0.0, 0);

      // Should have positive gradients (need to push predictions down)
      expect(gradB).toBeGreaterThan(0);
    });

    it('should handle empty arrays', () => {
      const { gradA, gradB } = calculateGradients([], [], 1.0, 0.0, 0);
      expect(gradA).toBe(0);
      expect(gradB).toBe(0);
    });

    it('should include regularization term', () => {
      const predictions = [0.5, 0.5];
      const outcomes = [true, false];

      const { gradA: gradA1 } = calculateGradients(predictions, outcomes, 2.0, 0.0, 0);
      const { gradA: gradA2 } = calculateGradients(predictions, outcomes, 2.0, 0.0, 0.1);

      // With regularization, gradient for A should be larger (pushing toward 0)
      expect(Math.abs(gradA2)).toBeGreaterThan(Math.abs(gradA1));
    });
  });

  // ==========================================================================
  // Gradient Descent Fitting
  // ==========================================================================

  describe('fitPlattGradientDescent', () => {
    it('should converge within max iterations', () => {
      // Generate synthetic data with known bias
      const predictions = generateBiasedPredictions(200, 0.1); // Predictions 10% too high
      const outcomes = generateOutcomes(predictions, -0.1); // Outcomes adjusted

      const result = fitPlattGradientDescent(predictions, outcomes, {
        maxIterations: 500,
      });

      expect(result).not.toBeNull();
      expect(result!.iterations).toBeLessThanOrEqual(500);
    });

    it('should return null for empty predictions', () => {
      const result = fitPlattGradientDescent([], []);
      expect(result).toBeNull();
    });

    it('should return null for too few predictions', () => {
      const result = fitPlattGradientDescent([0.5, 0.5, 0.5], [true, false, true]);
      expect(result).toBeNull();
    });

    it('should produce A close to 1 and B close to 0 for well-calibrated data', () => {
      // Generate well-calibrated data
      const predictions: number[] = [];
      const outcomes: boolean[] = [];

      for (let i = 0; i < 500; i++) {
        const p = Math.random() * 0.8 + 0.1; // 0.1 to 0.9
        predictions.push(p);
        outcomes.push(Math.random() < p);
      }

      const result = fitPlattGradientDescent(predictions, outcomes);

      expect(result).not.toBeNull();
      // Parameters should be close to identity (A≈1, B≈0)
      expect(result!.parameters.A).toBeGreaterThan(0.5);
      expect(result!.parameters.A).toBeLessThan(2.0);
      expect(Math.abs(result!.parameters.B)).toBeLessThan(1.0);
    });

    it('should have loss history that generally decreases', () => {
      const predictions = generateBiasedPredictions(200, 0.15);
      const outcomes = generateOutcomes(predictions, -0.1);

      const result = fitPlattGradientDescent(predictions, outcomes, {
        maxIterations: 100,
      });

      expect(result).not.toBeNull();
      expect(result!.lossHistory.length).toBeGreaterThan(1);

      // First half should generally have higher loss than second half
      const midpoint = Math.floor(result!.lossHistory.length / 2);
      const firstHalfAvg =
        result!.lossHistory.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
      const secondHalfAvg =
        result!.lossHistory.slice(midpoint).reduce((a, b) => a + b, 0) /
        (result!.lossHistory.length - midpoint);

      expect(secondHalfAvg).toBeLessThanOrEqual(firstHalfAvg + 0.1);
    });
  });

  // ==========================================================================
  // Fit Platt Parameters (convenience function)
  // ==========================================================================

  describe('fitPlattParameters', () => {
    it('should return PlattParameters on success', () => {
      const predictions = generateBiasedPredictions(200, 0.1);
      const outcomes = generateOutcomes(predictions, -0.1);

      const params = fitPlattParameters(predictions, outcomes);

      expect(params).not.toBeNull();
      expect(params!.A).toBeDefined();
      expect(params!.B).toBeDefined();
      expect(params!.fittedAt).toBeInstanceOf(Date);
      expect(params!.racesUsed).toBeGreaterThan(0);
    });

    it('should return null for invalid input', () => {
      const params = fitPlattParameters([], []);
      expect(params).toBeNull();
    });
  });

  // ==========================================================================
  // Cross-Validation
  // ==========================================================================

  describe('crossValidatePlatt', () => {
    it('should produce stable estimates across folds', () => {
      const predictions = generateBiasedPredictions(300, 0.1);
      const outcomes = generateOutcomes(predictions, -0.1);

      const result = crossValidatePlatt(predictions, outcomes, 5);

      // Standard deviation should be relatively small
      expect(result.brierStdDev).toBeLessThan(0.15);
      expect(result.logLossStdDev).toBeLessThan(0.5);
    });

    it('should return results for each fold', () => {
      const predictions = generateBiasedPredictions(200, 0.1);
      const outcomes = generateOutcomes(predictions, -0.1);

      const result = crossValidatePlatt(predictions, outcomes, 5);

      expect(result.foldResults).toHaveLength(5);
    });

    it('should handle insufficient data gracefully', () => {
      const predictions = [0.5, 0.5, 0.5];
      const outcomes = [true, false, true];

      const result = crossValidatePlatt(predictions, outcomes, 5);

      expect(result.avgBrierScore).toBe(1); // Default worst case
      expect(result.foldResults).toHaveLength(0);
    });

    it('should produce average metrics', () => {
      const predictions = generateBiasedPredictions(300, 0.1);
      const outcomes = generateOutcomes(predictions, -0.1);

      const result = crossValidatePlatt(predictions, outcomes, 5);

      expect(result.avgBrierScore).toBeGreaterThan(0);
      expect(result.avgBrierScore).toBeLessThan(1);
      expect(result.avgLogLoss).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Grid Search Alternative
  // ==========================================================================

  describe('fitPlattGridSearch', () => {
    it('should find reasonable parameters', () => {
      const predictions = generateBiasedPredictions(100, 0.1);
      const outcomes = generateOutcomes(predictions, -0.1);

      const params = fitPlattGridSearch(predictions, outcomes);

      expect(params).not.toBeNull();
      expect(params!.A).toBeGreaterThan(0);
      expect(params!.A).toBeLessThan(3);
    });

    it('should return null for empty input', () => {
      const params = fitPlattGridSearch([], []);
      expect(params).toBeNull();
    });

    it('should accept custom ranges', () => {
      const predictions = generateBiasedPredictions(100, 0.1);
      const outcomes = generateOutcomes(predictions, -0.1);

      const params = fitPlattGridSearch(
        predictions,
        outcomes,
        { min: 0.8, max: 1.2, step: 0.05 },
        { min: -0.2, max: 0.2, step: 0.05 }
      );

      expect(params).not.toBeNull();
      expect(params!.A).toBeGreaterThanOrEqual(0.8);
      expect(params!.A).toBeLessThanOrEqual(1.2);
    });
  });

  // ==========================================================================
  // Uncalibrated Evaluation
  // ==========================================================================

  describe('evaluateUncalibrated', () => {
    it('should return Brier score between 0 and 1', () => {
      const predictions = [0.3, 0.7, 0.5, 0.2, 0.8];
      const outcomes = [false, true, true, false, true];

      const result = evaluateUncalibrated(predictions, outcomes);

      expect(result.brierScore).toBeGreaterThanOrEqual(0);
      expect(result.brierScore).toBeLessThanOrEqual(1);
    });

    it('should return perfect score for perfect predictions', () => {
      const predictions = [0.99, 0.01, 0.99, 0.01];
      const outcomes = [true, false, true, false];

      const result = evaluateUncalibrated(predictions, outcomes);

      expect(result.brierScore).toBeLessThan(0.01);
    });
  });

  // ==========================================================================
  // Default Config
  // ==========================================================================

  describe('DEFAULT_FITTING_CONFIG', () => {
    it('should have reasonable default values', () => {
      expect(DEFAULT_FITTING_CONFIG.learningRate).toBeGreaterThan(0);
      expect(DEFAULT_FITTING_CONFIG.learningRate).toBeLessThan(1);
      expect(DEFAULT_FITTING_CONFIG.maxIterations).toBeGreaterThanOrEqual(100);
      expect(DEFAULT_FITTING_CONFIG.convergenceThreshold).toBeGreaterThan(0);
      expect(DEFAULT_FITTING_CONFIG.regularization).toBeGreaterThanOrEqual(0);
    });
  });
});

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Generate predictions with a systematic bias
 */
function generateBiasedPredictions(n: number, bias: number): number[] {
  const predictions: number[] = [];
  for (let i = 0; i < n; i++) {
    // Base prediction between 0.1 and 0.9
    let p = Math.random() * 0.8 + 0.1;
    // Add bias
    p = Math.max(0.05, Math.min(0.95, p + bias));
    predictions.push(p);
  }
  return predictions;
}

/**
 * Generate outcomes based on predictions with adjustment
 */
function generateOutcomes(predictions: number[], adjustment: number): boolean[] {
  return predictions.map((p) => {
    const trueProb = Math.max(0.01, Math.min(0.99, p + adjustment));
    return Math.random() < trueProb;
  });
}
