/**
 * Unit Tests for Overlay Pipeline Module
 *
 * Tests the unified overlay calculation pipeline including:
 * - Softmax probability conversion
 * - Market normalization
 * - True overlay detection
 * - Expected value calculations
 * - Value classification
 * - Overlay adjustment points
 *
 * @module scoring/__tests__/overlayPipeline.test
 */

import { describe, test, expect } from 'vitest';
import {
  calculateOverlayPipeline,
  calculateExpectedValue,
  classifyEV,
  classifyTrueOverlay,
  calculateOverlayAdjustment,
  calculateTrueOverlay,
  calculateRawOverlay,
  formatOverlayPercent,
  formatExpectedValue,
  isValueBet,
  isUnderlay,
  createCalibrationRecords,
  type OverlayPipelineInput,
} from '../overlayPipeline';

// ============================================================================
// TEST DATA
// ============================================================================

/**
 * Standard 8-horse field for testing
 * Scores are distributed to create varied probabilities
 */
const createStandard8HorseField = (): OverlayPipelineInput => ({
  horses: [
    { programNumber: 1, baseScore: 200, finalScore: 210, morningLineOdds: '2-1' },
    { programNumber: 2, baseScore: 180, finalScore: 190, morningLineOdds: '3-1' },
    { programNumber: 3, baseScore: 160, finalScore: 170, morningLineOdds: '5-1' },
    { programNumber: 4, baseScore: 140, finalScore: 150, morningLineOdds: '8-1' },
    { programNumber: 5, baseScore: 120, finalScore: 130, morningLineOdds: '12-1' },
    { programNumber: 6, baseScore: 100, finalScore: 110, morningLineOdds: '20-1' },
    { programNumber: 7, baseScore: 90, finalScore: 100, morningLineOdds: '30-1' },
    { programNumber: 8, baseScore: 80, finalScore: 90, morningLineOdds: '50-1' },
  ],
  useNormalization: true,
  temperature: 1.0,
});

/**
 * 6-horse field matching Scenario A from requirements
 */
const createScenarioAField = (): OverlayPipelineInput => ({
  horses: [
    { programNumber: 1, baseScore: 200, finalScore: 200, morningLineOdds: '2-1' },
    { programNumber: 2, baseScore: 180, finalScore: 180, morningLineOdds: '3-1' },
    { programNumber: 3, baseScore: 160, finalScore: 160, morningLineOdds: '5-1' },
    { programNumber: 4, baseScore: 140, finalScore: 140, morningLineOdds: '8-1' },
    { programNumber: 5, baseScore: 120, finalScore: 120, morningLineOdds: '12-1' },
    { programNumber: 6, baseScore: 100, finalScore: 100, morningLineOdds: '20-1' },
  ],
});

// ============================================================================
// EXPECTED VALUE TESTS
// ============================================================================

describe('calculateExpectedValue', () => {
  test('should calculate positive EV correctly', () => {
    // Model says 30% chance, odds are 4.0 (3-1)
    // EV = 0.30 * 4.0 - 1 = 0.20 (20% edge)
    const ev = calculateExpectedValue(0.3, 4.0);
    expect(ev).toBeCloseTo(0.2, 3);
  });

  test('should calculate negative EV correctly', () => {
    // Model says 20% chance, odds are 3.0 (2-1)
    // EV = 0.20 * 3.0 - 1 = -0.40 (losing bet)
    const ev = calculateExpectedValue(0.2, 3.0);
    expect(ev).toBeCloseTo(-0.4, 3);
  });

  test('should calculate break-even correctly', () => {
    // Model says 25% chance, odds are 4.0 (3-1)
    // EV = 0.25 * 4.0 - 1 = 0 (break-even)
    const ev = calculateExpectedValue(0.25, 4.0);
    expect(ev).toBeCloseTo(0, 3);
  });

  test('should handle edge cases', () => {
    expect(calculateExpectedValue(0, 4.0)).toBe(-1);
    expect(calculateExpectedValue(0.5, 1.0)).toBe(-1);
    expect(calculateExpectedValue(NaN, 4.0)).toBe(0);
    expect(calculateExpectedValue(0.5, NaN)).toBe(0);
  });
});

describe('classifyEV', () => {
  test('should classify strong positive EV', () => {
    expect(classifyEV(0.2)).toBe('strongPositive');
    expect(classifyEV(0.15)).toBe('strongPositive');
  });

  test('should classify moderate positive EV', () => {
    expect(classifyEV(0.12)).toBe('moderatePositive');
    expect(classifyEV(0.08)).toBe('moderatePositive');
  });

  test('should classify slight positive EV', () => {
    expect(classifyEV(0.05)).toBe('slightPositive');
    expect(classifyEV(0.02)).toBe('slightPositive');
  });

  test('should classify neutral EV', () => {
    expect(classifyEV(0.01)).toBe('neutral');
    expect(classifyEV(0)).toBe('neutral');
    expect(classifyEV(-0.01)).toBe('neutral');
  });

  test('should classify negative EV', () => {
    expect(classifyEV(-0.05)).toBe('negative');
    expect(classifyEV(-0.1)).toBe('negative');
  });
});

// ============================================================================
// VALUE CLASSIFICATION TESTS
// ============================================================================

describe('classifyTrueOverlay', () => {
  test('should classify strong value', () => {
    expect(classifyTrueOverlay(20)).toBe('STRONG_VALUE');
    expect(classifyTrueOverlay(15)).toBe('STRONG_VALUE');
  });

  test('should classify moderate value', () => {
    expect(classifyTrueOverlay(12)).toBe('MODERATE_VALUE');
    expect(classifyTrueOverlay(8)).toBe('MODERATE_VALUE');
  });

  test('should classify slight value', () => {
    expect(classifyTrueOverlay(6)).toBe('SLIGHT_VALUE');
    expect(classifyTrueOverlay(3)).toBe('SLIGHT_VALUE');
  });

  test('should classify neutral', () => {
    expect(classifyTrueOverlay(2)).toBe('NEUTRAL');
    expect(classifyTrueOverlay(0)).toBe('NEUTRAL');
    expect(classifyTrueOverlay(-2)).toBe('NEUTRAL');
  });

  test('should classify underlay', () => {
    expect(classifyTrueOverlay(-5)).toBe('UNDERLAY');
    expect(classifyTrueOverlay(-10)).toBe('UNDERLAY');
  });

  test('should handle edge cases', () => {
    expect(classifyTrueOverlay(NaN)).toBe('NEUTRAL');
    // Infinity is not finite, so it returns NEUTRAL (defensive behavior)
    expect(classifyTrueOverlay(Infinity)).toBe('NEUTRAL');
  });
});

// ============================================================================
// OVERLAY ADJUSTMENT TESTS
// ============================================================================

describe('calculateOverlayAdjustment', () => {
  test('should give positive adjustment for strong value', () => {
    const result = calculateOverlayAdjustment(20, 0.15);
    expect(result.points).toBeGreaterThanOrEqual(15);
    expect(result.points).toBeLessThanOrEqual(25);
    expect(result.reasoning).toContain('Strong value');
  });

  test('should give moderate adjustment for moderate value', () => {
    const result = calculateOverlayAdjustment(10, 0.08);
    expect(result.points).toBeGreaterThanOrEqual(8);
    expect(result.points).toBeLessThanOrEqual(15);
    expect(result.reasoning).toContain('Good value');
  });

  test('should give slight adjustment for slight value', () => {
    const result = calculateOverlayAdjustment(5, 0.02);
    expect(result.points).toBeGreaterThanOrEqual(3);
    expect(result.points).toBeLessThanOrEqual(8);
    expect(result.reasoning).toContain('Slight value');
  });

  test('should give zero adjustment for neutral', () => {
    const result = calculateOverlayAdjustment(1, 0);
    expect(result.points).toBe(0);
    expect(result.reasoning).toContain('Neutral');
  });

  test('should give negative adjustment for underlay', () => {
    const result = calculateOverlayAdjustment(-10, -0.15);
    expect(result.points).toBeLessThan(0);
    expect(result.points).toBeGreaterThanOrEqual(-20);
    expect(result.reasoning).toContain('Underlay');
  });

  test('should not reward overlay if EV is negative', () => {
    // Moderate overlay but poor EV should get reduced points
    const result = calculateOverlayAdjustment(10, -0.05);
    // Since it doesn't meet the EV threshold for moderate, it should fall through
    expect(result.points).toBeLessThan(8);
  });

  test('should respect max adjustment bounds', () => {
    const strongResult = calculateOverlayAdjustment(50, 0.5);
    expect(strongResult.points).toBeLessThanOrEqual(25);

    const underlayResult = calculateOverlayAdjustment(-30, -0.5);
    expect(underlayResult.points).toBeGreaterThanOrEqual(-20);
  });
});

// ============================================================================
// OVERLAY CALCULATION TESTS
// ============================================================================

describe('calculateTrueOverlay', () => {
  test('should calculate positive overlay correctly', () => {
    // Model says 30%, market says 20% → (0.30 - 0.20) / 0.20 = 50%
    const overlay = calculateTrueOverlay(0.3, 0.2);
    expect(overlay).toBeCloseTo(50, 1);
  });

  test('should calculate negative overlay correctly', () => {
    // Model says 15%, market says 20% → (0.15 - 0.20) / 0.20 = -25%
    const overlay = calculateTrueOverlay(0.15, 0.2);
    expect(overlay).toBeCloseTo(-25, 1);
  });

  test('should return 0 for zero market prob', () => {
    expect(calculateTrueOverlay(0.3, 0)).toBe(0);
    expect(calculateTrueOverlay(0.3, 0.0001)).toBe(0);
  });
});

describe('calculateRawOverlay', () => {
  test('should calculate raw overlay correctly', () => {
    const overlay = calculateRawOverlay(0.3, 0.25);
    expect(overlay).toBeCloseTo(20, 1);
  });

  test('should handle edge cases', () => {
    expect(calculateRawOverlay(NaN, 0.25)).toBe(0);
    expect(calculateRawOverlay(0.3, NaN)).toBe(0);
    expect(calculateRawOverlay(0.3, 0)).toBe(0);
  });
});

// ============================================================================
// MAIN PIPELINE TESTS
// ============================================================================

describe('calculateOverlayPipeline', () => {
  describe('Basic functionality', () => {
    test('should process 8-horse field correctly', () => {
      const input = createStandard8HorseField();
      const result = calculateOverlayPipeline(input);

      expect(result.horses).toHaveLength(8);
      expect(result.fieldMetrics.fieldSize).toBe(8);
    });

    test('should process 6-horse field correctly (Scenario A)', () => {
      const input = createScenarioAField();
      const result = calculateOverlayPipeline(input);

      expect(result.horses).toHaveLength(6);
      expect(result.fieldMetrics.fieldSize).toBe(6);
    });

    test('should handle empty input', () => {
      const result = calculateOverlayPipeline({ horses: [] });

      expect(result.horses).toHaveLength(0);
      expect(result.fieldMetrics.fieldSize).toBe(0);
      expect(result.fieldMetrics.probsValidated).toBe(false);
    });
  });

  describe('Model probability validation', () => {
    test('should have model probabilities sum to ~1.0', () => {
      const input = createStandard8HorseField();
      const result = calculateOverlayPipeline(input);

      const sumProbs = result.horses.reduce((sum, h) => sum + h.modelProbability, 0);
      expect(sumProbs).toBeCloseTo(1.0, 2);
      expect(result.fieldMetrics.probsValidated).toBe(true);
    });

    test('should have normalized market probs sum to ~1.0', () => {
      const input = createStandard8HorseField();
      const result = calculateOverlayPipeline(input);

      const sumProbs = result.horses.reduce((sum, h) => sum + h.normalizedMarketProbability, 0);
      expect(sumProbs).toBeCloseTo(1.0, 2);
    });
  });

  describe('Output field population', () => {
    test('should populate all output fields for each horse', () => {
      const input = createStandard8HorseField();
      const result = calculateOverlayPipeline(input);

      result.horses.forEach((horse) => {
        // Probability metrics
        expect(horse.modelProbability).toBeGreaterThan(0);
        expect(horse.modelProbability).toBeLessThan(1);
        expect(horse.rawImpliedProbability).toBeGreaterThan(0);
        expect(horse.normalizedMarketProbability).toBeGreaterThan(0);

        // Overlay metrics
        expect(typeof horse.trueOverlayPercent).toBe('number');
        expect(typeof horse.rawOverlayPercent).toBe('number');

        // Fair odds
        expect(horse.fairOdds).toBeGreaterThan(1);
        expect(horse.fairOddsDisplay).toBeDefined();
        expect(horse.actualOdds).toBeGreaterThan(1);
        expect(horse.actualOddsDisplay).toBeDefined();

        // Value classification
        expect(['STRONG_VALUE', 'MODERATE_VALUE', 'SLIGHT_VALUE', 'NEUTRAL', 'UNDERLAY']).toContain(
          horse.valueClassification
        );
        expect(horse.valueLabel).toBeDefined();
        expect(horse.valueColor).toBeDefined();
        expect(horse.valueIcon).toBeDefined();

        // Expected value
        expect(typeof horse.expectedValue).toBe('number');
        expect(typeof horse.evPercent).toBe('number');
        expect(horse.evLabel).toBeDefined();
        expect(typeof horse.isPositiveEV).toBe('boolean');

        // Overlay adjustment
        expect(typeof horse.overlayAdjustment).toBe('number');
        expect(horse.adjustmentReasoning).toBeDefined();
      });
    });
  });

  describe('Scenario B - Value Detection', () => {
    test('should detect value horse with positive overlay and EV', () => {
      // Horse with score 160, odds 8-1 (implied ~11%)
      // Higher score relative to field should give higher model prob
      const input: OverlayPipelineInput = {
        horses: [
          { programNumber: 1, baseScore: 160, finalScore: 160, morningLineOdds: '8-1' },
          { programNumber: 2, baseScore: 100, finalScore: 100, morningLineOdds: '2-1' },
          { programNumber: 3, baseScore: 80, finalScore: 80, morningLineOdds: '3-1' },
        ],
      };

      const result = calculateOverlayPipeline(input);
      const valueHorse = result.horses.find((h) => h.programNumber === 1);

      // Horse 1 should have higher model prob than market implies at 8-1
      expect(valueHorse).toBeDefined();
      expect(valueHorse!.trueOverlayPercent).toBeGreaterThan(0);
      expect(valueHorse!.isPositiveEV).toBe(true);
      expect(valueHorse!.overlayAdjustment).toBeGreaterThan(0);
    });
  });

  describe('Scenario C - Underlay Detection', () => {
    test('should detect underlay for overbet favorite', () => {
      // Heavy favorite with score 220, odds 1-2 (implied ~67%)
      // But with lower relative score, model may think 45%
      const input: OverlayPipelineInput = {
        horses: [
          { programNumber: 1, baseScore: 220, finalScore: 220, morningLineOdds: '1-2' },
          { programNumber: 2, baseScore: 200, finalScore: 200, morningLineOdds: '5-1' },
          { programNumber: 3, baseScore: 180, finalScore: 180, morningLineOdds: '8-1' },
          { programNumber: 4, baseScore: 160, finalScore: 160, morningLineOdds: '12-1' },
        ],
      };

      const result = calculateOverlayPipeline(input);
      const favorite = result.horses.find((h) => h.programNumber === 1);

      // Market thinks 67%, but with softmax it might be lower
      expect(favorite).toBeDefined();
      // At 1-2 odds, implied prob is ~67%, which is likely higher than model
      expect(favorite!.rawImpliedProbability).toBeGreaterThan(0.6);
      // This creates an underlay situation
      expect(favorite!.trueOverlayPercent).toBeLessThan(0);
      expect(favorite!.overlayAdjustment).toBeLessThanOrEqual(0);
    });
  });

  describe('Overlay adjustment bounds', () => {
    test('should give positive adjustment to strong value horse', () => {
      const input: OverlayPipelineInput = {
        horses: [
          { programNumber: 1, baseScore: 250, finalScore: 250, morningLineOdds: '20-1' },
          { programNumber: 2, baseScore: 100, finalScore: 100, morningLineOdds: '2-1' },
        ],
      };

      const result = calculateOverlayPipeline(input);
      const strongValue = result.horses.find((h) => h.programNumber === 1);

      expect(strongValue!.overlayAdjustment).toBeGreaterThan(0);
      expect(strongValue!.overlayAdjustment).toBeLessThanOrEqual(25);
    });

    test('should give negative adjustment to underlay horse', () => {
      const input: OverlayPipelineInput = {
        horses: [
          { programNumber: 1, baseScore: 100, finalScore: 100, morningLineOdds: '1-2' },
          { programNumber: 2, baseScore: 200, finalScore: 200, morningLineOdds: '10-1' },
        ],
      };

      const result = calculateOverlayPipeline(input);
      const underlayHorse = result.horses.find((h) => h.programNumber === 1);

      // Horse 1 is weak but heavily bet - underlay
      expect(underlayHorse!.overlayAdjustment).toBeLessThanOrEqual(0);
      expect(underlayHorse!.overlayAdjustment).toBeGreaterThanOrEqual(-20);
    });
  });

  describe('Configuration options', () => {
    test('should use provided temperature', () => {
      const input = createStandard8HorseField();
      input.temperature = 0.5;

      const result = calculateOverlayPipeline(input);
      expect(result.config.temperature).toBe(0.5);
    });

    test('should use normalization flag', () => {
      const input = createStandard8HorseField();
      input.useNormalization = false;

      const result = calculateOverlayPipeline(input);
      expect(result.config.useNormalization).toBe(false);
    });

    test('should track best value horse', () => {
      const input = createStandard8HorseField();
      const result = calculateOverlayPipeline(input);

      // Should identify a horse with positive overlay
      if (result.fieldMetrics.bestOverlayPercent > 0) {
        expect(result.fieldMetrics.bestValueHorse).not.toBeNull();
      }
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('Utility functions', () => {
  describe('formatOverlayPercent', () => {
    test('should format positive overlay', () => {
      expect(formatOverlayPercent(15.5)).toBe('+15.5%');
    });

    test('should format negative overlay', () => {
      expect(formatOverlayPercent(-10.3)).toBe('-10.3%');
    });

    test('should handle zero', () => {
      expect(formatOverlayPercent(0)).toBe('+0.0%');
    });

    test('should handle invalid input', () => {
      expect(formatOverlayPercent(NaN)).toBe('—');
    });
  });

  describe('formatExpectedValue', () => {
    test('should format positive EV', () => {
      expect(formatExpectedValue(0.15)).toBe('+15.0% EV');
    });

    test('should format negative EV', () => {
      expect(formatExpectedValue(-0.1)).toBe('-10.0% EV');
    });

    test('should handle invalid input', () => {
      expect(formatExpectedValue(NaN)).toBe('—');
    });
  });

  describe('isValueBet', () => {
    test('should return true for value bets', () => {
      expect(isValueBet(10, 0.05)).toBe(true);
      expect(isValueBet(5, 0)).toBe(true);
      expect(isValueBet(3, -0.01)).toBe(true);
    });

    test('should return false for non-value bets', () => {
      expect(isValueBet(2, 0.05)).toBe(false); // Below slight overlay threshold
      expect(isValueBet(10, -0.05)).toBe(false); // Negative EV
    });
  });

  describe('isUnderlay', () => {
    test('should return true for underlays', () => {
      expect(isUnderlay(-5)).toBe(true);
      expect(isUnderlay(-10)).toBe(true);
    });

    test('should return false for non-underlays', () => {
      expect(isUnderlay(0)).toBe(false);
      expect(isUnderlay(-2)).toBe(false);
      expect(isUnderlay(10)).toBe(false);
    });
  });
});

// ============================================================================
// CALIBRATION LOGGING TESTS
// ============================================================================

describe('Calibration logging', () => {
  test('should create calibration records', () => {
    const input = createStandard8HorseField();
    const result = calculateOverlayPipeline(input);
    const records = createCalibrationRecords(result, 'RACE-001');

    expect(records).toHaveLength(8);
    records.forEach((record) => {
      expect(record.raceId).toBe('RACE-001');
      expect(record.programNumber).toBeGreaterThan(0);
      expect(record.modelProbability).toBeGreaterThan(0);
      expect(record.timestamp).toBeGreaterThan(0);
    });
  });

  test('should return empty array when logging disabled', () => {
    const input = createStandard8HorseField();
    const result = calculateOverlayPipeline(input);
    const records = createCalibrationRecords(result, 'RACE-001', false);

    expect(records).toHaveLength(0);
  });
});
