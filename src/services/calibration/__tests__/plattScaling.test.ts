/**
 * Tests for Platt Scaling Module
 *
 * Tests cover:
 * - Calibrated probabilities between 0 and 1
 * - Field calibration maintains sum to ~1.0
 * - Numerical stability at extreme values
 * - Identity transformation with A=1, B=0
 * - Serialization/deserialization
 */

import { describe, it, expect } from 'vitest';
import {
  logit,
  sigmoid,
  calibrateProbability,
  calibrateField,
  createIdentityParameters,
  isIdentityParameters,
  serializePlattParameters,
  deserializePlattParameters,
  validatePlattParameters,
  getCalibrationBounds,
  type PlattParameters,
} from '../plattScaling';

describe('plattScaling', () => {
  // ==========================================================================
  // Logit and Sigmoid Functions
  // ==========================================================================

  describe('logit', () => {
    it('should return 0 for probability 0.5', () => {
      expect(logit(0.5)).toBeCloseTo(0, 5);
    });

    it('should return positive value for probability > 0.5', () => {
      expect(logit(0.7)).toBeGreaterThan(0);
      expect(logit(0.9)).toBeGreaterThan(logit(0.7));
    });

    it('should return negative value for probability < 0.5', () => {
      expect(logit(0.3)).toBeLessThan(0);
      expect(logit(0.1)).toBeLessThan(logit(0.3));
    });

    it('should handle extreme values with clamping', () => {
      // Should not throw or return Infinity
      expect(Number.isFinite(logit(0))).toBe(true);
      expect(Number.isFinite(logit(1))).toBe(true);
      expect(Number.isFinite(logit(0.0001))).toBe(true);
      expect(Number.isFinite(logit(0.9999))).toBe(true);
    });
  });

  describe('sigmoid', () => {
    it('should return 0.5 for input 0', () => {
      expect(sigmoid(0)).toBeCloseTo(0.5, 5);
    });

    it('should return value > 0.5 for positive input', () => {
      expect(sigmoid(1)).toBeGreaterThan(0.5);
      expect(sigmoid(5)).toBeGreaterThan(sigmoid(1));
    });

    it('should return value < 0.5 for negative input', () => {
      expect(sigmoid(-1)).toBeLessThan(0.5);
      expect(sigmoid(-5)).toBeLessThan(sigmoid(-1));
    });

    it('should be bounded between 0 and 1', () => {
      expect(sigmoid(-100)).toBeGreaterThanOrEqual(0);
      expect(sigmoid(-100)).toBeLessThan(0.001);
      expect(sigmoid(100)).toBeLessThanOrEqual(1);
      expect(sigmoid(100)).toBeGreaterThan(0.999);
    });

    it('should be numerically stable for large values', () => {
      expect(Number.isFinite(sigmoid(1000))).toBe(true);
      expect(Number.isFinite(sigmoid(-1000))).toBe(true);
    });
  });

  // ==========================================================================
  // Calibrate Probability
  // ==========================================================================

  describe('calibrateProbability', () => {
    const identityParams: PlattParameters = {
      A: 1.0,
      B: 0.0,
      fittedAt: new Date(),
      racesUsed: 100,
      brierScore: 0.2,
      logLoss: 0.5,
    };

    it('should return values between 0 and 1', () => {
      const testProbs = [0.1, 0.25, 0.5, 0.75, 0.9];
      const params: PlattParameters = {
        ...identityParams,
        A: 0.8,
        B: 0.1,
      };

      for (const prob of testProbs) {
        const calibrated = calibrateProbability(prob, params);
        expect(calibrated).toBeGreaterThanOrEqual(0);
        expect(calibrated).toBeLessThanOrEqual(1);
      }
    });

    it('should return approximately the same value with identity parameters', () => {
      const testProbs = [0.1, 0.25, 0.5, 0.75, 0.9];

      for (const prob of testProbs) {
        const calibrated = calibrateProbability(prob, identityParams);
        expect(calibrated).toBeCloseTo(prob, 1); // Within 0.1
      }
    });

    it('should handle extreme probabilities', () => {
      const params = identityParams;

      // Very low probability
      const lowCalibrated = calibrateProbability(0.001, params);
      expect(lowCalibrated).toBeGreaterThanOrEqual(0.005);
      expect(lowCalibrated).toBeLessThanOrEqual(1);

      // Very high probability
      const highCalibrated = calibrateProbability(0.999, params);
      expect(highCalibrated).toBeGreaterThanOrEqual(0);
      expect(highCalibrated).toBeLessThanOrEqual(0.995);
    });

    it('should handle non-finite inputs', () => {
      const calibrated = calibrateProbability(NaN, identityParams);
      expect(Number.isFinite(calibrated)).toBe(true);
    });
  });

  // ==========================================================================
  // Calibrate Field
  // ==========================================================================

  describe('calibrateField', () => {
    const identityParams: PlattParameters = {
      A: 1.0,
      B: 0.0,
      fittedAt: new Date(),
      racesUsed: 100,
      brierScore: 0.2,
      logLoss: 0.5,
    };

    it('should return probabilities that sum to approximately 1.0', () => {
      const rawProbs = [0.4, 0.3, 0.2, 0.1];
      const params: PlattParameters = {
        ...identityParams,
        A: 0.9,
        B: 0.05,
      };

      const calibrated = calibrateField(rawProbs, params);
      const sum = calibrated.reduce((s, p) => s + p, 0);

      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should preserve order with identity parameters', () => {
      const rawProbs = [0.4, 0.3, 0.2, 0.1];
      const calibrated = calibrateField(rawProbs, identityParams);

      // Higher raw probability should still have higher calibrated probability
      expect(calibrated[0]).toBeGreaterThan(calibrated[1]!);
      expect(calibrated[1]).toBeGreaterThan(calibrated[2]!);
      expect(calibrated[2]).toBeGreaterThan(calibrated[3]!);
    });

    it('should handle empty array', () => {
      const calibrated = calibrateField([], identityParams);
      expect(calibrated).toEqual([]);
    });

    it('should handle single horse', () => {
      const calibrated = calibrateField([0.5], identityParams);
      expect(calibrated).toEqual([1.0]);
    });

    it('should maintain sum even with extreme parameters', () => {
      const rawProbs = [0.5, 0.3, 0.15, 0.05];
      const extremeParams: PlattParameters = {
        ...identityParams,
        A: 2.0,
        B: -0.5,
      };

      const calibrated = calibrateField(rawProbs, extremeParams);
      const sum = calibrated.reduce((s, p) => s + p, 0);

      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should clamp individual probabilities to valid bounds', () => {
      const rawProbs = [0.001, 0.999, 0.5];
      const calibrated = calibrateField(rawProbs, identityParams);

      for (const p of calibrated) {
        expect(p).toBeGreaterThanOrEqual(0.005);
        expect(p).toBeLessThanOrEqual(0.995);
      }
    });
  });

  // ==========================================================================
  // Identity Parameters
  // ==========================================================================

  describe('createIdentityParameters', () => {
    it('should create parameters with A=1 and B=0', () => {
      const params = createIdentityParameters();
      expect(params.A).toBe(1.0);
      expect(params.B).toBe(0.0);
    });

    it('should have valid date', () => {
      const params = createIdentityParameters();
      expect(params.fittedAt).toBeInstanceOf(Date);
    });
  });

  describe('isIdentityParameters', () => {
    it('should return true for identity parameters', () => {
      const params = createIdentityParameters();
      expect(isIdentityParameters(params)).toBe(true);
    });

    it('should return false for non-identity parameters', () => {
      const params: PlattParameters = {
        A: 0.8,
        B: 0.1,
        fittedAt: new Date(),
        racesUsed: 100,
        brierScore: 0.2,
        logLoss: 0.5,
      };
      expect(isIdentityParameters(params)).toBe(false);
    });

    it('should return true for near-identity parameters', () => {
      const params: PlattParameters = {
        A: 1.0001,
        B: -0.0001,
        fittedAt: new Date(),
        racesUsed: 100,
        brierScore: 0.2,
        logLoss: 0.5,
      };
      expect(isIdentityParameters(params)).toBe(true);
    });
  });

  // ==========================================================================
  // Serialization
  // ==========================================================================

  describe('serialization', () => {
    it('should serialize and deserialize correctly', () => {
      const original: PlattParameters = {
        A: 0.85,
        B: 0.12,
        fittedAt: new Date('2024-01-15'),
        racesUsed: 500,
        brierScore: 0.18,
        logLoss: 0.45,
      };

      const serialized = serializePlattParameters(original);
      const deserialized = deserializePlattParameters(serialized);

      expect(deserialized.A).toBe(original.A);
      expect(deserialized.B).toBe(original.B);
      expect(deserialized.racesUsed).toBe(original.racesUsed);
      expect(deserialized.brierScore).toBe(original.brierScore);
      expect(deserialized.logLoss).toBe(original.logLoss);
      expect(deserialized.fittedAt.getTime()).toBe(original.fittedAt.getTime());
    });
  });

  // ==========================================================================
  // Validation
  // ==========================================================================

  describe('validatePlattParameters', () => {
    it('should return empty array for valid parameters', () => {
      const params: PlattParameters = {
        A: 0.9,
        B: 0.1,
        fittedAt: new Date(),
        racesUsed: 500,
        brierScore: 0.2,
        logLoss: 0.5,
      };

      const errors = validatePlattParameters(params);
      expect(errors).toHaveLength(0);
    });

    it('should detect negative A parameter', () => {
      const params: PlattParameters = {
        A: -0.5,
        B: 0.1,
        fittedAt: new Date(),
        racesUsed: 500,
        brierScore: 0.2,
        logLoss: 0.5,
      };

      const errors = validatePlattParameters(params);
      expect(errors.some((e) => e.includes('Parameter A'))).toBe(true);
    });

    it('should detect extremely large parameters', () => {
      const params: PlattParameters = {
        A: 15,
        B: 12,
        fittedAt: new Date(),
        racesUsed: 500,
        brierScore: 0.2,
        logLoss: 0.5,
      };

      const errors = validatePlattParameters(params);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid Brier score', () => {
      const params: PlattParameters = {
        A: 1.0,
        B: 0.0,
        fittedAt: new Date(),
        racesUsed: 500,
        brierScore: 1.5, // Invalid - should be 0-1
        logLoss: 0.5,
      };

      const errors = validatePlattParameters(params);
      expect(errors.some((e) => e.includes('Brier'))).toBe(true);
    });
  });

  // ==========================================================================
  // Calibration Bounds
  // ==========================================================================

  describe('getCalibrationBounds', () => {
    it('should return valid bounds', () => {
      const bounds = getCalibrationBounds();

      expect(bounds.minInput).toBeLessThan(bounds.maxInput);
      expect(bounds.minOutput).toBeLessThan(bounds.maxOutput);
      expect(bounds.minInput).toBeGreaterThan(0);
      expect(bounds.maxInput).toBeLessThan(1);
      expect(bounds.minOutput).toBeGreaterThan(0);
      expect(bounds.maxOutput).toBeLessThan(1);
    });
  });
});
