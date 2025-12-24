/**
 * Beaten Lengths Analysis Tests
 *
 * Tests for:
 * - Closing velocity calculation
 * - Early position classification
 * - Form bonus for consistent closers
 * - Pace validation using lengths data
 * - Missing data handling
 */

import { describe, it, expect } from 'vitest';
import {
  calculateClosingVelocity,
  calculateEarlyPosition,
  calculateLateGain,
  hadTroubledFinish,
  analyzeBeatenLengths,
  buildBeatenLengthsProfile,
  calculateBeatenLengthsAdjustments,
  validateRunningStyleWithLengths,
  getActualEarlySpeedPosition,
  formatClosingVelocity,
  getEarlyPositionBadge,
} from '../../../lib/scoring/beatenLengths';
import {
  createPastPerformance,
  createRunningLine,
  createHorseEntry,
} from '../../fixtures/testHelpers';

describe('Beaten Lengths Analysis', () => {
  describe('calculateClosingVelocity', () => {
    it('returns positive velocity when horse gains ground', () => {
      // Horse was 10 lengths back at 1st call, only 2 at finish = +8 velocity
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: 10,
          finishLengths: 2,
        }),
      });

      const velocity = calculateClosingVelocity(pp);

      expect(velocity).toBe(8);
    });

    it('returns negative velocity when horse loses ground', () => {
      // Horse was 2 lengths back at 1st call, 8 at finish = -6 velocity (faded)
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: 2,
          finishLengths: 8,
        }),
      });

      const velocity = calculateClosingVelocity(pp);

      expect(velocity).toBe(-6);
    });

    it('returns 0 when position unchanged', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: 5,
          finishLengths: 5,
        }),
      });

      const velocity = calculateClosingVelocity(pp);

      expect(velocity).toBe(0);
    });

    it('returns null when missing first call data', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: null,
          finishLengths: 2,
        }),
      });

      const velocity = calculateClosingVelocity(pp);

      expect(velocity).toBeNull();
    });

    it('returns null when missing finish data', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: 5,
          finishLengths: null,
        }),
      });

      const velocity = calculateClosingVelocity(pp);

      expect(velocity).toBeNull();
    });

    it('uses halfMileLengths as fallback when quarterMile not available', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: null,
          halfMileLengths: 8,
          finishLengths: 2,
        }),
      });

      const velocity = calculateClosingVelocity(pp);

      expect(velocity).toBe(6);
    });
  });

  describe('calculateEarlyPosition', () => {
    it('returns "leading" for horse on or near the lead', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: 0, // On the lead
        }),
      });

      expect(calculateEarlyPosition(pp)).toBe('leading');
    });

    it('returns "leading" for horse within half length', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: 0.5, // Just behind
        }),
      });

      expect(calculateEarlyPosition(pp)).toBe('leading');
    });

    it('returns "close" for horse within 3 lengths', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: 2.5,
        }),
      });

      expect(calculateEarlyPosition(pp)).toBe('close');
    });

    it('returns "mid" for horse 3-7 lengths back', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: 5,
        }),
      });

      expect(calculateEarlyPosition(pp)).toBe('mid');
    });

    it('returns "back" for horse 7+ lengths back', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: 10,
        }),
      });

      expect(calculateEarlyPosition(pp)).toBe('back');
    });

    it('falls back to position data when lengths not available', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMile: 1,
          quarterMileLengths: null,
        }),
        fieldSize: 10,
      });

      expect(calculateEarlyPosition(pp)).toBe('leading');
    });
  });

  describe('calculateLateGain', () => {
    it('returns positive gain when gaining in stretch', () => {
      // 5 lengths back at stretch, 2 at finish = +3 gain
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          stretchLengths: 5,
          finishLengths: 2,
        }),
      });

      const gain = calculateLateGain(pp);

      expect(gain).toBe(3);
    });

    it('returns negative gain when fading in stretch', () => {
      // 2 lengths back at stretch, 6 at finish = -4 (faded)
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          stretchLengths: 2,
          finishLengths: 6,
        }),
      });

      const gain = calculateLateGain(pp);

      expect(gain).toBe(-4);
    });

    it('returns null when missing stretch data', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          stretchLengths: null,
          finishLengths: 2,
        }),
      });

      expect(calculateLateGain(pp)).toBeNull();
    });
  });

  describe('hadTroubledFinish', () => {
    it('returns true when horse led at stretch but lost', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          stretch: 1,
          stretchLengths: 0,
        }),
        finishPosition: 2,
      });

      expect(hadTroubledFinish(pp)).toBe(true);
    });

    it('returns false when horse led and won', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          stretch: 1,
          stretchLengths: 0,
        }),
        finishPosition: 1,
      });

      expect(hadTroubledFinish(pp)).toBe(false);
    });

    it('returns false when horse was not leading at stretch', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          stretch: 3,
          stretchLengths: 4,
        }),
        finishPosition: 2,
      });

      expect(hadTroubledFinish(pp)).toBe(false);
    });
  });

  describe('analyzeBeatenLengths', () => {
    it('returns complete analysis for race with full data', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: 8,
          halfMileLengths: 6,
          stretchLengths: 3,
          finishLengths: 1,
        }),
        finishPosition: 2,
        fieldSize: 10,
      });

      const analysis = analyzeBeatenLengths(pp);

      expect(analysis.closingVelocity).toBe(7); // 8 - 1 = 7
      expect(analysis.earlyPosition).toBe('back');
      expect(analysis.lateGain).toBe(2); // 3 - 1 = 2
      expect(analysis.hadTroubledFinish).toBe(false);
      expect(analysis.improvedThroughout).toBe(true);
      expect(analysis.hasCompleteData).toBe(true);
    });

    it('handles missing data gracefully', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: null,
          stretchLengths: null,
          finishLengths: null,
        }),
      });

      const analysis = analyzeBeatenLengths(pp);

      expect(analysis.closingVelocity).toBeNull();
      expect(analysis.lateGain).toBeNull();
      expect(analysis.hasCompleteData).toBe(false);
    });
  });

  describe('buildBeatenLengthsProfile', () => {
    it('identifies consistent closer from multiple races', () => {
      const pastPerformances = [
        createPastPerformance({
          runningLine: createRunningLine({
            quarterMileLengths: 10,
            stretchLengths: 4,
            finishLengths: 1,
          }),
        }),
        createPastPerformance({
          runningLine: createRunningLine({
            quarterMileLengths: 8,
            stretchLengths: 3,
            finishLengths: 0,
          }),
        }),
        createPastPerformance({
          runningLine: createRunningLine({
            quarterMileLengths: 12,
            stretchLengths: 5,
            finishLengths: 2,
          }),
        }),
      ];

      const profile = buildBeatenLengthsProfile(pastPerformances);

      expect(profile.isConfirmedCloser).toBe(true);
      expect(profile.avgClosingVelocity).toBeGreaterThan(5);
      expect(profile.consistentCloserCount).toBe(3);
    });

    it('identifies front-runner pattern', () => {
      const pastPerformances = [
        createPastPerformance({
          runningLine: createRunningLine({
            quarterMile: 1,
            quarterMileLengths: 0,
            finishLengths: 2,
          }),
        }),
        createPastPerformance({
          runningLine: createRunningLine({
            quarterMile: 1,
            quarterMileLengths: 0,
            finishLengths: 0,
          }),
        }),
        createPastPerformance({
          runningLine: createRunningLine({
            quarterMile: 1,
            quarterMileLengths: 0.5,
            finishLengths: 3,
          }),
        }),
      ];

      const profile = buildBeatenLengthsProfile(pastPerformances);

      expect(profile.isConfirmedFrontRunner).toBe(true);
    });

    it('counts troubled finishes correctly', () => {
      const pastPerformances = [
        createPastPerformance({
          runningLine: createRunningLine({
            stretch: 1,
            stretchLengths: 0,
          }),
          finishPosition: 3,
        }),
        createPastPerformance({
          runningLine: createRunningLine({
            stretch: 1,
            stretchLengths: 0,
          }),
          finishPosition: 2,
        }),
        createPastPerformance({
          runningLine: createRunningLine({
            stretch: 3,
            stretchLengths: 4,
          }),
          finishPosition: 1,
        }),
      ];

      const profile = buildBeatenLengthsProfile(pastPerformances);

      expect(profile.troubledFinishCount).toBe(2);
    });

    it('returns empty profile for no past performances', () => {
      const profile = buildBeatenLengthsProfile([]);

      expect(profile.racesWithData).toBe(0);
      expect(profile.avgClosingVelocity).toBeNull();
      expect(profile.isConfirmedCloser).toBe(false);
      expect(profile.isConfirmedFrontRunner).toBe(false);
    });
  });

  describe('calculateBeatenLengthsAdjustments', () => {
    it('gives form bonus for consistent closer', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 10,
              stretchLengths: 4,
              finishLengths: 1,
            }),
          }),
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 9,
              stretchLengths: 3,
              finishLengths: 0,
            }),
          }),
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 11,
              stretchLengths: 5,
              finishLengths: 2,
            }),
          }),
        ],
      });

      const adjustments = calculateBeatenLengthsAdjustments(horse);

      expect(adjustments.formPoints).toBeGreaterThanOrEqual(2);
      expect(adjustments.formReasoning).toContain('closer');
    });

    it('gives form bonus for strong late gain', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 5,
              stretchLengths: 5,
              finishLengths: 1,
            }),
          }),
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 4,
              stretchLengths: 4,
              finishLengths: 0,
            }),
          }),
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 6,
              stretchLengths: 6,
              finishLengths: 2,
            }),
          }),
        ],
      });

      const adjustments = calculateBeatenLengthsAdjustments(horse);

      expect(adjustments.formPoints).toBeGreaterThanOrEqual(1);
    });

    it('penalizes horses that give up lead late multiple times', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 0,
              stretch: 1,
              stretchLengths: 0,
              finishLengths: 3,
            }),
            finishPosition: 3,
          }),
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 0,
              stretch: 1,
              stretchLengths: 0,
              finishLengths: 4,
            }),
            finishPosition: 4,
          }),
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 0,
              stretch: 1,
              stretchLengths: 0,
              finishLengths: 2,
            }),
            finishPosition: 2,
          }),
        ],
      });

      const adjustments = calculateBeatenLengthsAdjustments(horse);

      // With 3 troubled finishes and negative closing velocity, should be penalized
      expect(adjustments.formPoints).toBeLessThanOrEqual(0);
    });

    it('returns no adjustments for missing data', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: null,
              stretchLengths: null,
              finishLengths: null,
            }),
          }),
        ],
      });

      const adjustments = calculateBeatenLengthsAdjustments(horse);

      expect(adjustments.formPoints).toBe(0);
      expect(adjustments.pacePoints).toBe(0);
    });
  });

  describe('validateRunningStyleWithLengths', () => {
    it('validates E style when horse leads early', () => {
      const horse = createHorseEntry({
        runningStyle: 'E',
        pastPerformances: [
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 0,
              stretchLengths: 1,
              finishLengths: 2,
            }),
          }),
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 0,
              stretchLengths: 0.5,
              finishLengths: 1,
            }),
          }),
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 0.5,
              stretchLengths: 1,
              finishLengths: 0,
            }),
          }),
        ],
      });

      const validation = validateRunningStyleWithLengths(horse);

      // With avg first call = 0.17 lengths, should be recognized as E
      expect(validation.isValid).toBe(true);
      expect(validation.actualPattern).toBe('E');
    });

    it('identifies closer pattern when horse runs from far back', () => {
      const horse = createHorseEntry({
        runningStyle: 'E', // Declared E but runs like C
        pastPerformances: [
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 10,
              stretchLengths: 4,
              finishLengths: 1,
            }),
          }),
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 12,
              stretchLengths: 5,
              finishLengths: 2,
            }),
          }),
          createPastPerformance({
            runningLine: createRunningLine({
              quarterMileLengths: 8,
              stretchLengths: 3,
              finishLengths: 0,
            }),
          }),
        ],
      });

      const validation = validateRunningStyleWithLengths(horse);

      // With avg 10 lengths back at first call, should be C pattern
      expect(validation.actualPattern).toBe('C');
      // Style E doesn't match actual C pattern
      expect(validation.isValid).toBe(false);
    });

    it('returns valid with unknown pattern for insufficient data', () => {
      const horse = createHorseEntry({
        runningStyle: 'E',
        pastPerformances: [
          createPastPerformance({
            runningLine: createRunningLine({ quarterMileLengths: null }),
          }),
        ],
      });

      const validation = validateRunningStyleWithLengths(horse);

      expect(validation.isValid).toBe(true); // Can't invalidate without data
      expect(validation.actualPattern).toBe('U');
    });
  });

  describe('getActualEarlySpeedPosition', () => {
    it('calculates average lengths behind at first call', () => {
      const pastPerformances = [
        createPastPerformance({
          runningLine: createRunningLine({ quarterMileLengths: 4 }),
        }),
        createPastPerformance({
          runningLine: createRunningLine({ quarterMileLengths: 6 }),
        }),
        createPastPerformance({
          runningLine: createRunningLine({ quarterMileLengths: 2 }),
        }),
      ];

      const avg = getActualEarlySpeedPosition(pastPerformances);

      expect(avg).toBe(4); // (4 + 6 + 2) / 3 = 4
    });

    it('returns null for no data', () => {
      const pastPerformances = [
        createPastPerformance({
          runningLine: createRunningLine({ quarterMileLengths: null }),
        }),
      ];

      const avg = getActualEarlySpeedPosition(pastPerformances);

      expect(avg).toBeNull();
    });
  });

  describe('Display utilities', () => {
    describe('formatClosingVelocity', () => {
      it('formats positive velocity with + sign', () => {
        expect(formatClosingVelocity(5.5)).toBe('+5.5L');
      });

      it('formats negative velocity', () => {
        expect(formatClosingVelocity(-3.0)).toBe('-3.0L');
      });

      it('formats zero velocity', () => {
        expect(formatClosingVelocity(0)).toBe('0L');
      });

      it('returns N/A for null', () => {
        expect(formatClosingVelocity(null)).toBe('N/A');
      });
    });

    describe('getEarlyPositionBadge', () => {
      it('returns E badge for leading position', () => {
        const badge = getEarlyPositionBadge('leading');
        expect(badge.label).toBe('E');
      });

      it('returns P badge for close position', () => {
        const badge = getEarlyPositionBadge('close');
        expect(badge.label).toBe('P');
      });

      it('returns S badge for mid position', () => {
        const badge = getEarlyPositionBadge('mid');
        expect(badge.label).toBe('S');
      });

      it('returns C badge for back position', () => {
        const badge = getEarlyPositionBadge('back');
        expect(badge.label).toBe('C');
      });
    });
  });

  describe('Integration with form scoring', () => {
    it('adds consistent closer bonus to form score', () => {
      // Create a horse that consistently closes well
      const closingHorse = createHorseEntry({
        daysSinceLastRace: 21,
        pastPerformances: [
          createPastPerformance({
            finishPosition: 2,
            runningLine: createRunningLine({
              quarterMileLengths: 10,
              stretchLengths: 3,
              finishLengths: 1,
            }),
          }),
          createPastPerformance({
            finishPosition: 1,
            runningLine: createRunningLine({
              quarterMileLengths: 9,
              stretchLengths: 2,
              finishLengths: 0,
            }),
          }),
          createPastPerformance({
            finishPosition: 3,
            runningLine: createRunningLine({
              quarterMileLengths: 11,
              stretchLengths: 4,
              finishLengths: 2,
            }),
          }),
        ],
      });

      const profile = buildBeatenLengthsProfile(closingHorse.pastPerformances);
      const adjustments = calculateBeatenLengthsAdjustments(closingHorse);

      // Should be identified as consistent closer
      expect(profile.isConfirmedCloser).toBe(true);
      expect(profile.avgClosingVelocity).toBeGreaterThan(5);

      // Should get positive form bonus
      expect(adjustments.formPoints).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Sample scenario: Horse gains 8 lengths', () => {
    it('correctly analyzes horse that gained 8 lengths from first call to finish', () => {
      const pp = createPastPerformance({
        runningLine: createRunningLine({
          quarterMileLengths: 10, // 10 lengths back at first call
          halfMileLengths: 7, // Moved up to 7 back
          stretchLengths: 4, // 4 back at stretch
          finishLengths: 2, // Only 2 back at finish
        }),
        finishPosition: 2,
        fieldSize: 10,
      });

      const analysis = analyzeBeatenLengths(pp);

      // Should show 8 lengths gained (10 - 2 = 8)
      expect(analysis.closingVelocity).toBe(8);
      // Started far back
      expect(analysis.earlyPosition).toBe('back');
      // Gained 2 lengths in stretch
      expect(analysis.lateGain).toBe(2);
      // Did not have troubled finish (wasn't leading)
      expect(analysis.hadTroubledFinish).toBe(false);
      // Improved position throughout
      expect(analysis.improvedThroughout).toBe(true);
    });
  });
});
