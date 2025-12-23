/**
 * Field-Relative Scoring Tests
 *
 * Tests for edge cases and normal operation of field-relative scoring
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFieldContext,
  calculateFieldRelativeScore,
  analyzeEntireField,
} from '../fieldRelative';

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('calculateFieldRelativeScore Edge Cases', () => {
  describe('Tied scores [180, 180, 160]', () => {
    it('should return isStandout = false, gapFromNextBest = 0 for tied leaders', () => {
      const scores = [180, 180, 160];
      const result = calculateFieldRelativeScore(180, scores);

      console.log('Tied scores [180, 180, 160] - Horse at 180:');
      console.log(JSON.stringify(result, null, 2));

      expect(result.isStandout).toBe(false);
      expect(result.gapFromNextBest).toBe(0);
      expect(result.gapFromLeader).toBe(0);
      expect(result.adjustmentReason).toContain('Tied for first');
    });

    it('should handle the trailing horse correctly', () => {
      const scores = [180, 180, 160];
      const result = calculateFieldRelativeScore(160, scores);

      expect(result.isStandout).toBe(false);
      expect(result.gapFromLeader).toBe(20);
      expect(result.gapFromNextBest).toBe(0); // No one below
    });
  });

  describe('All same scores [160, 160, 160]', () => {
    it('should return zScore = 0, isStandout = false for all same scores', () => {
      const scores = [160, 160, 160];
      const result = calculateFieldRelativeScore(160, scores);

      console.log('All same scores [160, 160, 160]:');
      console.log(JSON.stringify(result, null, 2));

      expect(result.zScore).toBe(0);
      expect(result.isStandout).toBe(false);
      expect(result.gapFromNextBest).toBe(0);
      expect(result.gapFromLeader).toBe(0);
      expect(result.fieldPercentile).toBe(0); // No one below
    });
  });

  describe('Clear standout in strong field [195, 170, 165, 160]', () => {
    it('should return isStandout = true but tierAdjustment = 0 (strong field)', () => {
      const scores = [195, 170, 165, 160]; // avg = 172.5 = strong field
      const result = calculateFieldRelativeScore(195, scores);

      console.log('Clear standout in strong field [195, 170, 165, 160]:');
      console.log(JSON.stringify(result, null, 2));

      expect(result.isStandout).toBe(true);
      expect(result.gapFromNextBest).toBe(25); // 195 - 170
      expect(result.gapFromLeader).toBe(0);
      expect(result.tierAdjustment).toBe(0); // No promotion in strong field
      expect(result.adjustmentReason).toContain('Standout');
      expect(result.adjustmentReason).toContain('strong field');
    });
  });

  describe('Clear standout in average field [180, 155, 150, 145]', () => {
    it('should return isStandout = true with tierAdjustment = +1', () => {
      const scores = [180, 155, 150, 145]; // avg = 157.5 = average field
      const result = calculateFieldRelativeScore(180, scores);

      console.log('Clear standout in average field [180, 155, 150, 145]:');
      console.log(JSON.stringify(result, null, 2));

      expect(result.isStandout).toBe(true);
      expect(result.gapFromNextBest).toBe(25); // 180 - 155
      expect(result.gapFromLeader).toBe(0);
      expect(result.tierAdjustment).toBe(1); // Promotion in average field
      expect(result.adjustmentReason).toContain('Standout');
      expect(result.adjustmentReason).toContain('tier promotion');
    });
  });

  describe('Single horse field', () => {
    it('should return fieldPercentile = 100, isStandout = false', () => {
      const scores = [180];
      const result = calculateFieldRelativeScore(180, scores);

      expect(result.fieldPercentile).toBe(100);
      expect(result.isStandout).toBe(false);
      expect(result.zScore).toBe(0);
    });
  });

  describe('Empty field', () => {
    it('should handle empty array gracefully', () => {
      const result = calculateFieldRelativeScore(180, []);

      expect(result.fieldPercentile).toBe(0);
      expect(result.isStandout).toBe(false);
      expect(result.zScore).toBe(0);
    });
  });
});

describe('calculateFieldContext', () => {
  it('should throw error for less than 2 scores', () => {
    expect(() => calculateFieldContext([180])).toThrow('requires at least 2 scores');
  });

  it('should calculate field strength correctly', () => {
    // Weak field (avg < 140)
    const weakContext = calculateFieldContext([130, 120, 110]);
    expect(weakContext.fieldStrength).toBe('weak');

    // Average field (avg 140-164)
    const avgContext = calculateFieldContext([160, 150, 140]);
    expect(avgContext.fieldStrength).toBe('average');

    // Strong field (avg 165-184)
    const strongContext = calculateFieldContext([180, 170, 160]);
    expect(strongContext.fieldStrength).toBe('strong');

    // Stacked field (avg >= 185)
    const stackedContext = calculateFieldContext([200, 190, 180]);
    expect(stackedContext.fieldStrength).toBe('stacked');
  });
});

describe('analyzeEntireField', () => {
  it('should analyze all horses with shared context', () => {
    const scores = [180, 155, 150, 145]; // avg = 157.5 = average field
    const { context, results } = analyzeEntireField(scores);

    expect(context.fieldSize).toBe(4);
    expect(context.fieldStrength).toBe('average');
    expect(results.length).toBe(4);

    // First horse (180) should be standout with tier promotion
    expect(results[0]?.isStandout).toBe(true);
    expect(results[0]?.tierAdjustment).toBe(1);

    // Other horses should not be standouts
    expect(results[1]?.isStandout).toBe(false);
    expect(results[2]?.isStandout).toBe(false);
    expect(results[3]?.isStandout).toBe(false);
  });

  it('should handle strong field without tier promotion', () => {
    const scores = [195, 170, 165, 160]; // avg = 172.5 = strong field
    const { context, results } = analyzeEntireField(scores);

    expect(context.fieldStrength).toBe('strong');
    expect(results[0]?.isStandout).toBe(true);
    expect(results[0]?.tierAdjustment).toBe(0); // No promotion in strong field
  });

  it('should throw error for less than 2 scores', () => {
    expect(() => analyzeEntireField([180])).toThrow('requires at least 2 scores');
  });
});
