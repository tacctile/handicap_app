/**
 * Carryover Tracker Tests
 *
 * Tests for Pick 5/6 carryover tracking:
 * - Value classification
 * - Parsing functionality
 * - EV adjustments
 * - Storage operations
 * - Alert generation
 */

import { describe, it, expect } from 'vitest';
import {
  classifyCarryoverValue,
  getCarryoverRecommendation,
  formatCarryoverAmount,
  createCarryoverInfo,
  parseCarryoverAmount,
  parseCarryoverFromDRF,
  calculateCarryoverAdjustedEV,
  shouldAlertCarryover,
  createCarryoverAlert,
  getCarryoverBadgeColor,
  formatCarryoverDisplay,
  HIGH_VALUE_THRESHOLD,
} from '../carryoverTracker';
import { CARRYOVER_THRESHOLDS } from '../multiraceTypes';

// ============================================================================
// VALUE CLASSIFICATION
// ============================================================================

describe('Carryover Value Classification', () => {
  describe('classifyCarryoverValue', () => {
    describe('Pick 5 thresholds', () => {
      it('should classify low carryover', () => {
        expect(classifyCarryoverValue('pick_5', 10000)).toBe('low');
      });

      it('should classify medium carryover', () => {
        expect(classifyCarryoverValue('pick_5', 30000)).toBe('medium');
      });

      it('should classify high carryover', () => {
        expect(classifyCarryoverValue('pick_5', 75000)).toBe('high');
      });

      it('should classify exceptional carryover', () => {
        expect(classifyCarryoverValue('pick_5', 150000)).toBe('exceptional');
      });
    });

    describe('Pick 6 thresholds', () => {
      it('should classify low carryover', () => {
        expect(classifyCarryoverValue('pick_6', 50000)).toBe('low');
      });

      it('should classify medium carryover', () => {
        expect(classifyCarryoverValue('pick_6', 150000)).toBe('medium');
      });

      it('should classify high carryover', () => {
        expect(classifyCarryoverValue('pick_6', 300000)).toBe('high');
      });

      it('should classify exceptional carryover', () => {
        expect(classifyCarryoverValue('pick_6', 600000)).toBe('exceptional');
      });
    });

    it('should handle zero carryover', () => {
      expect(classifyCarryoverValue('pick_5', 0)).toBe('low');
      expect(classifyCarryoverValue('pick_6', 0)).toBe('low');
    });

    it('should handle boundary values correctly', () => {
      // At exactly the threshold
      expect(classifyCarryoverValue('pick_5', CARRYOVER_THRESHOLDS.pick_5.medium)).toBe('medium');
      expect(classifyCarryoverValue('pick_5', CARRYOVER_THRESHOLDS.pick_5.high)).toBe('high');
    });
  });

  describe('getCarryoverRecommendation', () => {
    it('should return mandatory message for mandatory days', () => {
      const rec = getCarryoverRecommendation('pick_6', 500000, true);
      expect(rec).toContain('MANDATORY');
      expect(rec).toContain('paid out today');
    });

    it('should return exceptional message for high carryover', () => {
      const rec = getCarryoverRecommendation('pick_6', 600000, false);
      expect(rec).toContain('Exceptional');
      expect(rec).toContain('increased investment');
    });

    it('should return normal message for no carryover', () => {
      const rec = getCarryoverRecommendation('pick_5', 0, false);
      expect(rec).toContain('Fresh pool');
    });
  });
});

// ============================================================================
// AMOUNT FORMATTING
// ============================================================================

describe('Carryover Formatting', () => {
  describe('formatCarryoverAmount', () => {
    it('should format millions correctly', () => {
      expect(formatCarryoverAmount(1500000)).toBe('1.50M');
      expect(formatCarryoverAmount(2000000)).toBe('2.00M');
    });

    it('should format thousands correctly', () => {
      expect(formatCarryoverAmount(50000)).toBe('50K');
      expect(formatCarryoverAmount(125000)).toBe('125K');
    });

    it('should format small amounts correctly', () => {
      expect(formatCarryoverAmount(500)).toBe('500');
      expect(formatCarryoverAmount(999)).toBe('999');
    });

    it('should handle zero', () => {
      expect(formatCarryoverAmount(0)).toBe('0');
    });
  });
});

// ============================================================================
// PARSING
// ============================================================================

describe('Carryover Parsing', () => {
  describe('parseCarryoverAmount', () => {
    it('should parse dollar amounts with commas', () => {
      expect(parseCarryoverAmount('$50,000')).toBe(50000);
      expect(parseCarryoverAmount('$1,234,567')).toBe(1234567);
    });

    it('should parse K notation', () => {
      expect(parseCarryoverAmount('$50K')).toBe(50000);
      expect(parseCarryoverAmount('125K')).toBe(125000);
    });

    it('should parse M notation', () => {
      expect(parseCarryoverAmount('$1.5M')).toBe(1500000);
      expect(parseCarryoverAmount('2.25M')).toBe(2250000);
    });

    it('should parse plain numbers', () => {
      expect(parseCarryoverAmount('50000')).toBe(50000);
      expect(parseCarryoverAmount('$75000')).toBe(75000);
    });

    it('should handle invalid input', () => {
      expect(parseCarryoverAmount('')).toBe(0);
      expect(parseCarryoverAmount('no money')).toBe(0);
    });

    it('should be case insensitive', () => {
      expect(parseCarryoverAmount('50k')).toBe(50000);
      expect(parseCarryoverAmount('1.5m')).toBe(1500000);
    });
  });

  describe('parseCarryoverFromDRF', () => {
    it('should parse Pick 5 carryover from text', () => {
      const text = 'Pick 5 carryover: $75,000. Races 1-5.';
      const results = parseCarryoverFromDRF(text, 'SA', 'Santa Anita');

      expect(results.length).toBeGreaterThanOrEqual(1);
      const firstResult = results[0];
      expect(firstResult).toBeDefined();
      expect(firstResult?.betType).toBe('pick_5');
      expect(firstResult?.carryoverAmount).toBe(75000);
    });

    it('should parse Pick 6 carryover from text', () => {
      const text = 'Pick 6 carryover is $250K';
      const results = parseCarryoverFromDRF(text, 'CD', 'Churchill Downs');

      expect(results.find((r) => r.betType === 'pick_6')?.carryoverAmount).toBe(250000);
    });

    it('should parse both Pick 5 and Pick 6', () => {
      const text = 'Pick 5 carryover $50K. Pick 6 carryover $200K.';
      const results = parseCarryoverFromDRF(text, 'GP', 'Gulfstream Park');

      expect(results.length).toBe(2);
    });

    it('should handle text with no carryover', () => {
      const text = 'No carryover today';
      const results = parseCarryoverFromDRF(text, 'SA', 'Santa Anita');

      expect(results.length).toBe(0);
    });
  });
});

// ============================================================================
// CARRYOVER INFO CREATION
// ============================================================================

describe('Carryover Info Creation', () => {
  describe('createCarryoverInfo', () => {
    it('should create valid carryover info', () => {
      const info = createCarryoverInfo({
        betType: 'pick_5',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: 75000,
        daysWithoutWinner: 3,
        estimatedPoolToday: 50000,
      });

      expect(info.betType).toBe('pick_5');
      expect(info.trackCode).toBe('SA');
      expect(info.carryoverAmount).toBe(75000);
      expect(info.totalExpectedPool).toBe(125000);
      expect(info.valueClass).toBe('high');
    });

    it('should sanitize track code', () => {
      const info = createCarryoverInfo({
        betType: 'pick_6',
        trackCode: '<script>sa</script>',
        trackName: 'Santa Anita',
        carryoverAmount: 50000,
      });

      expect(info.trackCode).not.toContain('<script>');
    });

    it('should validate negative amounts', () => {
      const info = createCarryoverInfo({
        betType: 'pick_5',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: -1000,
      });

      expect(info.carryoverAmount).toBe(0);
    });

    it('should set mandatory flag correctly', () => {
      const info = createCarryoverInfo({
        betType: 'pick_6',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: 500000,
        isMandatory: true,
        mandatoryDate: '2024-12-31',
      });

      expect(info.isMandatory).toBe(true);
      expect(info.mandatoryDate).toBe('2024-12-31');
    });
  });
});

// ============================================================================
// EV CALCULATIONS
// ============================================================================

describe('Carryover EV Calculations', () => {
  describe('calculateCarryoverAdjustedEV', () => {
    it('should show EV boost from carryover', () => {
      const result = calculateCarryoverAdjustedEV({
        baseCost: 50,
        baseProbability: 0.05,
        carryoverAmount: 100000,
        estimatedPoolToday: 50000,
      });

      expect(result.adjustedEV).toBeGreaterThan(result.baseEV);
      expect(result.evBoost).toBeGreaterThan(0);
    });

    it('should calculate base EV without carryover correctly', () => {
      const result = calculateCarryoverAdjustedEV({
        baseCost: 50,
        baseProbability: 0.05,
        carryoverAmount: 0,
        estimatedPoolToday: 100000,
        takeoutRate: 0.25,
      });

      // Base EV = 0.05 × (100000 × 0.75) - 50 = 3750 - 50 = 3700
      expect(result.baseEV).toBeCloseTo(3700, 0);
    });

    it('should show proportional boost', () => {
      const smallCarryover = calculateCarryoverAdjustedEV({
        baseCost: 50,
        baseProbability: 0.05,
        carryoverAmount: 50000,
        estimatedPoolToday: 100000,
      });

      const largeCarryover = calculateCarryoverAdjustedEV({
        baseCost: 50,
        baseProbability: 0.05,
        carryoverAmount: 200000,
        estimatedPoolToday: 100000,
      });

      expect(largeCarryover.evBoost).toBeGreaterThan(smallCarryover.evBoost);
    });
  });
});

// ============================================================================
// ALERTS
// ============================================================================

describe('Carryover Alerts', () => {
  describe('shouldAlertCarryover', () => {
    it('should alert for mandatory payout', () => {
      const info = createCarryoverInfo({
        betType: 'pick_6',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: 10000,
        isMandatory: true,
      });

      expect(shouldAlertCarryover(info)).toBe(true);
    });

    it('should alert for exceptional carryover', () => {
      const info = createCarryoverInfo({
        betType: 'pick_5',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: 150000,
      });

      expect(shouldAlertCarryover(info)).toBe(true);
    });

    it('should alert for high carryover', () => {
      const info = createCarryoverInfo({
        betType: 'pick_5',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: HIGH_VALUE_THRESHOLD + 1,
      });

      expect(shouldAlertCarryover(info)).toBe(true);
    });

    it('should not alert for low carryover', () => {
      const info = createCarryoverInfo({
        betType: 'pick_5',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: 10000,
      });

      expect(shouldAlertCarryover(info)).toBe(false);
    });
  });

  describe('createCarryoverAlert', () => {
    it('should create high priority alert for mandatory', () => {
      const info = createCarryoverInfo({
        betType: 'pick_6',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: 500000,
        isMandatory: true,
      });

      const alert = createCarryoverAlert(info);

      expect(alert.priority).toBe('high');
      expect(alert.title).toContain('Mandatory');
    });

    it('should create high priority for exceptional', () => {
      const info = createCarryoverInfo({
        betType: 'pick_6',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: 600000,
      });

      const alert = createCarryoverAlert(info);

      expect(alert.priority).toBe('high');
      expect(alert.title).toContain('Exceptional');
    });

    it('should include track name in message', () => {
      const info = createCarryoverInfo({
        betType: 'pick_5',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: 75000,
      });

      const alert = createCarryoverAlert(info);

      expect(alert.message).toContain('Santa Anita');
    });
  });
});

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

describe('Display Helpers', () => {
  describe('getCarryoverBadgeColor', () => {
    it('should return gold for exceptional', () => {
      const colors = getCarryoverBadgeColor('exceptional');
      expect(colors.text).toBe('#eab308');
    });

    it('should return green for high', () => {
      const colors = getCarryoverBadgeColor('high');
      expect(colors.text).toBe('#22c55e');
    });

    it('should return blue for medium', () => {
      const colors = getCarryoverBadgeColor('medium');
      expect(colors.text).toBe('#3b82f6');
    });

    it('should return gray for low', () => {
      const colors = getCarryoverBadgeColor('low');
      expect(colors.text).toBe('#9ca3af');
    });
  });

  describe('formatCarryoverDisplay', () => {
    it('should format all display fields', () => {
      const info = createCarryoverInfo({
        betType: 'pick_5',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: 75000,
        daysWithoutWinner: 3,
        estimatedPoolToday: 50000,
      });

      const display = formatCarryoverDisplay(info);

      expect(display.amountDisplay).toBe('$75K');
      expect(display.poolDisplay).toContain('125K');
      expect(display.daysDisplay).toContain('3 days');
      expect(display.valueLabel).toBe('HIGH');
    });

    it('should show fresh pool for no days without winner', () => {
      const info = createCarryoverInfo({
        betType: 'pick_5',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: 0,
        daysWithoutWinner: 0,
      });

      const display = formatCarryoverDisplay(info);

      expect(display.daysDisplay).toBe('Fresh pool');
    });

    it('should show MANDATORY label for mandatory day', () => {
      const info = createCarryoverInfo({
        betType: 'pick_6',
        trackCode: 'SA',
        trackName: 'Santa Anita',
        carryoverAmount: 500000,
        isMandatory: true,
      });

      const display = formatCarryoverDisplay(info);

      expect(display.valueLabel).toBe('MANDATORY');
    });
  });
});
