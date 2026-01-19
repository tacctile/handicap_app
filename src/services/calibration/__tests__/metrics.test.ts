/**
 * Tests for Calibration Metrics Module
 *
 * Tests cover:
 * - Brier score calculation correct
 * - Log loss calculation correct
 * - Perfect predictions give optimal scores
 * - Reliability diagram buckets correctly
 * - Calibration error calculation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBrierScore,
  calculateBrierSkillScore,
  calculateLogLoss,
  calculateCalibrationError,
  calculateMaxCalibrationError,
  generateReliabilityDiagram,
  calculateAllMetrics,
  calculateCalibrationImprovement,
  interpretBrierScore,
  interpretCalibrationError,
  BRIER_SCORE_REFERENCE,
} from '../metrics';

describe('metrics', () => {
  // ==========================================================================
  // Brier Score
  // ==========================================================================

  describe('calculateBrierScore', () => {
    it('should return 0 for perfect predictions', () => {
      const predictions = [1.0, 0.0, 1.0, 0.0];
      const outcomes = [true, false, true, false];

      const score = calculateBrierScore(predictions, outcomes);
      expect(score).toBeCloseTo(0, 5);
    });

    it('should return 1 for maximally wrong predictions', () => {
      const predictions = [0.0, 1.0, 0.0, 1.0];
      const outcomes = [true, false, true, false];

      const score = calculateBrierScore(predictions, outcomes);
      expect(score).toBeCloseTo(1, 5);
    });

    it('should return 0.25 for always predicting 0.5', () => {
      const predictions = [0.5, 0.5, 0.5, 0.5];
      const outcomes = [true, false, true, false];

      const score = calculateBrierScore(predictions, outcomes);
      expect(score).toBeCloseTo(0.25, 5);
    });

    it('should handle confident correct predictions', () => {
      const predictions = [0.9, 0.1, 0.8, 0.2];
      const outcomes = [true, false, true, false];

      const score = calculateBrierScore(predictions, outcomes);
      expect(score).toBeLessThan(0.1);
    });

    it('should handle empty arrays', () => {
      const score = calculateBrierScore([], []);
      expect(score).toBe(1); // Worst case for invalid input
    });

    it('should handle mismatched array lengths', () => {
      const score = calculateBrierScore([0.5, 0.5], [true]);
      expect(score).toBe(1); // Worst case for invalid input
    });

    it('should ignore invalid predictions', () => {
      const predictions = [0.5, NaN, 0.5, Infinity];
      const outcomes = [true, false, true, false];

      const score = calculateBrierScore(predictions, outcomes);
      // Should only use valid predictions
      expect(Number.isFinite(score)).toBe(true);
    });
  });

  describe('calculateBrierSkillScore', () => {
    it('should return positive for better-than-baseline predictions', () => {
      // Model predicts 0.8 for wins, 0.2 for losses
      const predictions = [0.8, 0.2, 0.8, 0.2];
      const outcomes = [true, false, true, false];

      const skill = calculateBrierSkillScore(predictions, outcomes);
      expect(skill).toBeGreaterThan(0);
    });

    it('should return negative for worse-than-baseline predictions', () => {
      // Model predicts opposite of what happens
      const predictions = [0.2, 0.8, 0.2, 0.8];
      const outcomes = [true, false, true, false];

      const skill = calculateBrierSkillScore(predictions, outcomes);
      expect(skill).toBeLessThan(0);
    });

    it('should return ~0 for predictions equal to baseline', () => {
      // 50% win rate data, always predict 0.5
      const predictions = [0.5, 0.5, 0.5, 0.5];
      const outcomes = [true, false, true, false];

      const skill = calculateBrierSkillScore(predictions, outcomes);
      expect(Math.abs(skill)).toBeLessThan(0.1);
    });
  });

  // ==========================================================================
  // Log Loss
  // ==========================================================================

  describe('calculateLogLoss', () => {
    it('should return near 0 for perfect predictions', () => {
      // Using 0.99 and 0.01 instead of 1 and 0 to avoid log(0)
      const predictions = [0.99, 0.01, 0.99, 0.01];
      const outcomes = [true, false, true, false];

      const loss = calculateLogLoss(predictions, outcomes);
      expect(loss).toBeLessThan(0.1);
    });

    it('should return high loss for confident wrong predictions', () => {
      const predictions = [0.01, 0.99, 0.01, 0.99];
      const outcomes = [true, false, true, false];

      const loss = calculateLogLoss(predictions, outcomes);
      expect(loss).toBeGreaterThan(2);
    });

    it('should return ~0.693 for always predicting 0.5', () => {
      const predictions = [0.5, 0.5, 0.5, 0.5];
      const outcomes = [true, false, true, false];

      const loss = calculateLogLoss(predictions, outcomes);
      expect(loss).toBeCloseTo(0.693, 1); // ln(2)
    });

    it('should handle empty arrays', () => {
      const loss = calculateLogLoss([], []);
      expect(loss).toBe(Infinity);
    });

    it('should be bounded below by 0', () => {
      const predictions = [0.7, 0.3, 0.8, 0.2];
      const outcomes = [true, false, true, false];

      const loss = calculateLogLoss(predictions, outcomes);
      expect(loss).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Calibration Error
  // ==========================================================================

  describe('calculateCalibrationError', () => {
    it('should return 0 for perfectly calibrated predictions', () => {
      // Predictions match actual win rates within buckets
      const predictions: number[] = [];
      const outcomes: boolean[] = [];

      // Generate perfectly calibrated data
      for (let bucket = 0; bucket < 10; bucket++) {
        const prob = (bucket + 0.5) / 10; // 0.05, 0.15, ..., 0.95
        const n = 100;
        for (let i = 0; i < n; i++) {
          predictions.push(prob);
          outcomes.push(Math.random() < prob);
        }
      }

      const error = calculateCalibrationError(predictions, outcomes, 10);
      // Should be close to 0 with enough samples
      expect(error).toBeLessThan(0.1);
    });

    it('should return high error for miscalibrated predictions', () => {
      // Always predict 0.5 but outcomes are 90% wins
      const predictions = new Array(100).fill(0.5);
      const outcomes = [...new Array(90).fill(true), ...new Array(10).fill(false)];

      const error = calculateCalibrationError(predictions, outcomes, 10);
      expect(error).toBeGreaterThan(0.3);
    });

    it('should handle empty arrays', () => {
      const error = calculateCalibrationError([], []);
      expect(error).toBe(1); // Worst case
    });

    it('should be bounded between 0 and 1', () => {
      const predictions = [0.3, 0.7, 0.5, 0.2, 0.8];
      const outcomes = [true, false, true, false, true];

      const error = calculateCalibrationError(predictions, outcomes);
      expect(error).toBeGreaterThanOrEqual(0);
      expect(error).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateMaxCalibrationError', () => {
    it('should return the worst bucket error', () => {
      // Create data where one bucket is very miscalibrated
      const predictions = [
        ...new Array(50).fill(0.15), // Bucket 0.1-0.2, predict ~15%
        ...new Array(50).fill(0.55), // Bucket 0.5-0.6, predict ~55%
      ];
      const outcomes = [
        ...new Array(45).fill(true), // 90% wins when predicting 15%
        ...new Array(5).fill(false),
        ...new Array(25).fill(true), // 50% wins when predicting 55%
        ...new Array(25).fill(false),
      ];

      const maxError = calculateMaxCalibrationError(predictions, outcomes, 10);
      // Should detect the 0.15 vs 0.90 bucket as the worst
      expect(maxError).toBeGreaterThan(0.3);
    });
  });

  // ==========================================================================
  // Reliability Diagram
  // ==========================================================================

  describe('generateReliabilityDiagram', () => {
    it('should create correct number of buckets', () => {
      const predictions = [0.1, 0.3, 0.5, 0.7, 0.9];
      const outcomes = [false, true, false, true, true];

      const diagram = generateReliabilityDiagram(predictions, outcomes, 10);

      // Each prediction falls in different bucket
      expect(diagram.length).toBe(5);
    });

    it('should correctly calculate actual win rate per bucket', () => {
      // All predictions in 0.5-0.6 bucket
      const predictions = [0.55, 0.55, 0.55, 0.55];
      const outcomes = [true, true, false, false]; // 50% win rate

      const diagram = generateReliabilityDiagram(predictions, outcomes, 10);

      expect(diagram.length).toBe(1);
      expect(diagram[0]!.actual).toBeCloseTo(0.5, 5);
      expect(diagram[0]!.predicted).toBeCloseTo(0.55, 5);
      expect(diagram[0]!.count).toBe(4);
    });

    it('should include bucket labels', () => {
      const predictions = [0.25];
      const outcomes = [true];

      const diagram = generateReliabilityDiagram(predictions, outcomes, 10);

      expect(diagram[0]!.bucket).toMatch(/0\.\d+-0\.\d+/);
    });

    it('should calculate standard error', () => {
      const predictions = new Array(100).fill(0.55);
      const outcomes = new Array(100).fill(false).map((_, i) => i < 50);

      const diagram = generateReliabilityDiagram(predictions, outcomes, 10);

      expect(diagram[0]!.standardError).toBeDefined();
      expect(diagram[0]!.standardError).toBeGreaterThan(0);
    });

    it('should handle empty arrays', () => {
      const diagram = generateReliabilityDiagram([], []);
      expect(diagram).toEqual([]);
    });
  });

  // ==========================================================================
  // Comprehensive Metrics
  // ==========================================================================

  describe('calculateAllMetrics', () => {
    it('should return all metric types', () => {
      const predictions = [0.3, 0.7, 0.5, 0.2, 0.8];
      const outcomes = [false, true, true, false, true];

      const metrics = calculateAllMetrics(predictions, outcomes);

      expect(metrics.brierScore).toBeDefined();
      expect(metrics.logLoss).toBeDefined();
      expect(metrics.calibrationError).toBeDefined();
      expect(metrics.maxCalibrationError).toBeDefined();
      expect(metrics.brierSkillScore).toBeDefined();
      expect(metrics.totalPredictions).toBe(5);
      expect(metrics.totalWins).toBe(3);
      expect(metrics.reliabilityDiagram).toBeDefined();
    });

    it('should calculate correct overall statistics', () => {
      const predictions = [0.5, 0.5, 0.5, 0.5];
      const outcomes = [true, false, true, false];

      const metrics = calculateAllMetrics(predictions, outcomes);

      expect(metrics.overallWinRate).toBeCloseTo(0.5, 5);
      expect(metrics.avgPredictedProb).toBeCloseTo(0.5, 5);
    });
  });

  // ==========================================================================
  // Calibration Improvement
  // ==========================================================================

  describe('calculateCalibrationImprovement', () => {
    it('should calculate positive improvement when metrics decrease', () => {
      const before = { brierScore: 0.3, logLoss: 0.8, calibrationError: 0.15 };
      const after = { brierScore: 0.2, logLoss: 0.6, calibrationError: 0.08 };

      const improvement = calculateCalibrationImprovement(before, after);

      expect(improvement.brierImprovement).toBeGreaterThan(0);
      expect(improvement.logLossImprovement).toBeGreaterThan(0);
      expect(improvement.calibrationErrorImprovement).toBeGreaterThan(0);
    });

    it('should calculate negative improvement when metrics increase', () => {
      const before = { brierScore: 0.2, logLoss: 0.5, calibrationError: 0.08 };
      const after = { brierScore: 0.3, logLoss: 0.7, calibrationError: 0.12 };

      const improvement = calculateCalibrationImprovement(before, after);

      expect(improvement.brierImprovement).toBeLessThan(0);
      expect(improvement.logLossImprovement).toBeLessThan(0);
      expect(improvement.calibrationErrorImprovement).toBeLessThan(0);
    });

    it('should return 0 when baseline is 0', () => {
      const before = { brierScore: 0, logLoss: 0, calibrationError: 0 };
      const after = { brierScore: 0.2, logLoss: 0.5, calibrationError: 0.1 };

      const improvement = calculateCalibrationImprovement(before, after);

      expect(improvement.brierImprovement).toBe(0);
    });
  });

  // ==========================================================================
  // Interpretation Functions
  // ==========================================================================

  describe('interpretBrierScore', () => {
    it('should return Excellent for very low scores', () => {
      expect(interpretBrierScore(0.05)).toBe('Excellent');
    });

    it('should return Good for low scores', () => {
      expect(interpretBrierScore(0.12)).toBe('Good');
    });

    it('should return Fair for moderate scores', () => {
      expect(interpretBrierScore(0.18)).toBe('Fair');
    });

    it('should return Below Average for scores around 0.25', () => {
      expect(interpretBrierScore(0.23)).toBe('Below Average');
    });

    it('should return Poor for high scores', () => {
      expect(interpretBrierScore(0.35)).toBe('Poor');
    });
  });

  describe('interpretCalibrationError', () => {
    it('should return Excellent calibration for very low error', () => {
      expect(interpretCalibrationError(0.01)).toBe('Excellent calibration');
    });

    it('should return Good calibration for low error', () => {
      expect(interpretCalibrationError(0.03)).toBe('Good calibration');
    });

    it('should return Poor calibration for high error', () => {
      expect(interpretCalibrationError(0.2)).toBe('Poor calibration');
    });
  });

  // ==========================================================================
  // Reference Values
  // ==========================================================================

  describe('BRIER_SCORE_REFERENCE', () => {
    it('should have ordered reference values', () => {
      expect(BRIER_SCORE_REFERENCE.perfect).toBeLessThan(BRIER_SCORE_REFERENCE.excellent);
      expect(BRIER_SCORE_REFERENCE.excellent).toBeLessThan(BRIER_SCORE_REFERENCE.good);
      expect(BRIER_SCORE_REFERENCE.good).toBeLessThan(BRIER_SCORE_REFERENCE.fair);
      expect(BRIER_SCORE_REFERENCE.fair).toBeLessThan(BRIER_SCORE_REFERENCE.random);
      expect(BRIER_SCORE_REFERENCE.random).toBeLessThan(BRIER_SCORE_REFERENCE.worst);
    });
  });
});
