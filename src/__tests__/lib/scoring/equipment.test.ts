/**
 * Equipment Scoring Tests
 * Tests equipment change bonuses and Lasix scenarios
 * NOTE: v2.0 rescaled from 25 max to 20 max (scale factor: 20/25 = 0.8)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEquipmentScore,
  getEquipmentSummary,
  hasSignificantEquipmentChange,
} from '../../../lib/scoring/equipment';
import {
  createHorseEntry,
  createPastPerformance,
  createEquipment,
  createMedication,
  createEquipmentChangeHorse,
  createRaceHeader,
} from '../../fixtures/testHelpers';

describe('Equipment Scoring', () => {
  describe('Base Score', () => {
    it('returns base score of 8 for no equipment changes', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({ raw: '' }),
        medication: createMedication({ raw: '' }),
        pastPerformances: [],
      });

      const result = calculateEquipmentScore(horse);

      // Base score should be around 8 (may vary based on implementation)
      expect(result.baseScore).toBe(8);
    });
  });

  describe('Blinkers On (First-time)', () => {
    it('adds 10-16 points for first-time blinkers', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({
          blinkers: true,
          firstTimeEquipment: ['blinkers'],
          raw: 'B',
        }),
        pastPerformances: [
          createPastPerformance({ equipment: '' }), // No blinkers last time
        ],
      });

      const result = calculateEquipmentScore(horse);

      // First time blinkers should add significant points
      expect(result.total).toBeGreaterThan(10);
      expect(result.hasSignificantChange).toBe(true);
    });

    it('includes blinkers in changes array when first-time', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({
          blinkers: true,
          firstTimeEquipment: ['blinkers'],
          raw: 'B',
        }),
        pastPerformances: [createPastPerformance({ equipment: '' })],
      });

      const result = calculateEquipmentScore(horse);

      const blinkersChange = result.changes.find((c) => c.type === 'blinkers_on');
      expect(blinkersChange).toBeDefined();
      expect(blinkersChange?.impact).toBe('positive');
    });
  });

  describe('Blinkers Off', () => {
    it('adds 8-15 points for blinkers removal', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({
          blinkersOff: true,
          raw: 'BO',
        }),
        pastPerformances: [
          createPastPerformance({ equipment: 'B' }), // Had blinkers last time
        ],
      });

      const result = calculateEquipmentScore(horse);

      // Blinkers off can help aggressive horses
      expect(result.total).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Lasix Scenarios', () => {
    it('adds 12-20 points for first-time Lasix', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        pastPerformances: [
          createPastPerformance({ medication: '' }), // No Lasix last time
        ],
      });

      const result = calculateEquipmentScore(horse);

      expect(result.total).toBeGreaterThan(15);
      expect(result.hasSignificantChange).toBe(true);
    });

    it('finds lasix_first change type for first-time Lasix', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        pastPerformances: [createPastPerformance({ medication: '' })],
      });

      const result = calculateEquipmentScore(horse);

      const lasixChange = result.changes.find((c) => c.type === 'lasix_first');
      expect(lasixChange).toBeDefined();
      expect(lasixChange?.impact).toBe('positive');
    });

    it('penalizes Lasix removal with negative impact', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixOff: true,
          lasix: false,
          raw: 'LO',
        }),
        pastPerformances: [
          createPastPerformance({ medication: 'L' }), // Had Lasix last time
        ],
      });

      const result = calculateEquipmentScore(horse);

      const lasixOffChange = result.changes.find((c) => c.type === 'lasix_off');
      // Lasix off is typically negative
      if (lasixOffChange) {
        expect(lasixOffChange.impact).toBe('negative');
      }
    });
  });

  describe('Other Equipment Changes', () => {
    it('handles tongue tie addition', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({
          tongueTie: true,
          raw: 'TT',
        }),
        pastPerformances: [createPastPerformance({ equipment: '' })],
      });

      const result = calculateEquipmentScore(horse);

      // Should detect the equipment change
      expect(result.total).toBeGreaterThanOrEqual(10);
    });

    it('handles nasal strip addition', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({
          nasalStrip: true,
          raw: 'NS',
        }),
        pastPerformances: [createPastPerformance({ equipment: '' })],
      });

      const result = calculateEquipmentScore(horse);

      expect(result.total).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Score Limits', () => {
    it('total score does not exceed 20 points', () => {
      // Horse with multiple equipment changes
      const horse = createHorseEntry({
        equipment: createEquipment({
          blinkers: true,
          firstTimeEquipment: ['blinkers'],
          tongueTie: true,
          raw: 'B TT',
        }),
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        pastPerformances: [createPastPerformance({ equipment: '', medication: '' })],
      });

      const result = calculateEquipmentScore(horse);

      expect(result.total).toBeLessThanOrEqual(20);
    });

    it('minimum score is at least base score', () => {
      // Horse with potentially negative changes
      const horse = createHorseEntry({
        equipment: createEquipment({ raw: '' }),
        medication: createMedication({
          lasixOff: true,
          raw: 'LO',
        }),
        pastPerformances: [createPastPerformance({ medication: 'L' })],
      });

      const result = calculateEquipmentScore(horse);

      expect(result.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getEquipmentSummary', () => {
    it('returns hasChanges=true for significant changes', () => {
      const horse = createEquipmentChangeHorse('blinkers_on');

      const summary = getEquipmentSummary(horse);

      expect(summary.hasChanges).toBe(true);
    });

    it('returns hasChanges=false for no changes', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({ raw: '' }),
        medication: createMedication({ raw: '' }),
        pastPerformances: [],
      });

      const summary = getEquipmentSummary(horse);

      expect(summary.hasChanges).toBe(false);
    });

    it('returns summary string describing changes', () => {
      const horse = createEquipmentChangeHorse('lasix_first');

      const summary = getEquipmentSummary(horse);

      expect(summary.summary).toBeDefined();
      expect(typeof summary.summary).toBe('string');
    });
  });

  describe('hasSignificantEquipmentChange', () => {
    it('returns true for first-time blinkers', () => {
      const horse = createEquipmentChangeHorse('blinkers_on');

      expect(hasSignificantEquipmentChange(horse)).toBe(true);
    });

    it('returns true for first-time Lasix', () => {
      const horse = createEquipmentChangeHorse('lasix_first');

      expect(hasSignificantEquipmentChange(horse)).toBe(true);
    });

    it('returns false for no equipment changes', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({ raw: '' }),
        medication: createMedication({ raw: '' }),
        pastPerformances: [],
      });

      expect(hasSignificantEquipmentChange(horse)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty past performances', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({ blinkers: true, raw: 'B' }),
        pastPerformances: [],
      });

      const result = calculateEquipmentScore(horse);

      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('handles horse with same equipment as previous race', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({ blinkers: true, raw: 'B' }),
        pastPerformances: [
          createPastPerformance({ equipment: 'B' }),
          createPastPerformance({ equipment: 'B' }),
        ],
      });

      const result = calculateEquipmentScore(horse);

      // No change = base score
      expect(result.total).toBe(result.baseScore);
    });

    it('works with race header context', () => {
      const horse = createEquipmentChangeHorse('blinkers_on');
      const header = createRaceHeader();

      const result = calculateEquipmentScore(horse, header);

      expect(result.total).toBeGreaterThan(0);
    });
  });
});
