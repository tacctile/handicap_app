/**
 * Data Completeness Tests
 *
 * Tests the data completeness infrastructure that calculates
 * what percentage of scoreable data each horse actually has.
 *
 * Scenario A: Full Data Horse - should get Grade A, 90+%
 * Scenario B: First Time Starter - should flag low confidence
 * Scenario C: Shipper (no meet stats) - should use career fallback
 * Scenario D: Mixed Data - critical high, medium low
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDataCompleteness,
  hasValidSpeedFigures,
  hasValidPastPerformances,
  hasValidTrainerStats,
  hasValidRunningStyle,
  hasValidPaceFigures,
  hasValidTrackRecord,
  hasValidEquipment,
  hasValidBreeding,
  hasValidLifetimeEarnings,
  getDataCompletenessSummary,
  getDataCompletenessColor,
  shouldFlagLowConfidence,
} from '../../../lib/scoring/dataCompleteness';
import {
  createHorseEntry,
  createPastPerformance,
  createRaceHeader,
  createFirstTimeStarter,
  createSpeedFigures,
  createEquipment,
  createBreeding,
  createWorkout,
} from '../../fixtures/testHelpers';

// ============================================================================
// HELPER FUNCTIONS FOR TESTS
// ============================================================================

/**
 * Create a horse with complete data (all fields populated)
 */
function createFullDataHorse() {
  return createHorseEntry({
    // Core identity
    horseName: 'Complete Data Horse',
    age: 4,
    sex: 'c',
    daysSinceLastRace: 21,
    runningStyle: 'E/P',

    // Trainer stats
    trainerName: 'John Trainer',
    trainerStats: '150: 25-20-15 (17%)',
    trainerMeetStarts: 45,
    trainerMeetWins: 8,
    trainerMeetPlaces: 7,
    trainerMeetShows: 5,

    // Jockey stats
    jockeyName: 'Fast Jockey',
    jockeyStats: '200: 40-30-25 (20%)',
    jockeyMeetStarts: 60,
    jockeyMeetWins: 12,
    jockeyMeetPlaces: 10,
    jockeyMeetShows: 8,

    // Lifetime records
    lifetimeStarts: 15,
    lifetimeWins: 4,
    lifetimePlaces: 3,
    lifetimeShows: 2,
    lifetimeEarnings: 250000,

    // Track records
    trackStarts: 5,
    trackWins: 2,
    turfStarts: 3,
    turfWins: 1,
    wetStarts: 2,
    wetWins: 1,
    distanceStarts: 8,
    distanceWins: 3,
    surfaceStarts: 12,
    surfaceWins: 4,

    // Speed figures
    bestBeyer: 92,
    averageBeyer: 88,
    lastBeyer: 90,

    // Weight
    weight: 120,

    // Equipment
    equipment: createEquipment({
      blinkers: true,
      raw: 'B',
    }),

    // Breeding
    breeding: createBreeding({
      sire: 'Quality Road',
      dam: 'Fast Mare',
      damSire: 'Storm Cat',
    }),

    // Past performances (5 races with full data)
    pastPerformances: [
      createPastPerformance({
        finishPosition: 2,
        speedFigures: createSpeedFigures({ beyer: 90 }),
        earlyPace1: 85,
        latePace: 88,
        weight: 120,
        classification: 'allowance',
      }),
      createPastPerformance({
        finishPosition: 1,
        speedFigures: createSpeedFigures({ beyer: 92 }),
        earlyPace1: 87,
        latePace: 90,
        weight: 118,
        classification: 'allowance',
      }),
      createPastPerformance({
        finishPosition: 3,
        speedFigures: createSpeedFigures({ beyer: 85 }),
        earlyPace1: 82,
        latePace: 85,
        weight: 119,
        classification: 'allowance',
        claimingPrice: 25000,
      }),
      createPastPerformance({
        finishPosition: 4,
        speedFigures: createSpeedFigures({ beyer: 82 }),
        classification: 'claiming',
        claimingPrice: 20000,
      }),
      createPastPerformance({
        finishPosition: 2,
        speedFigures: createSpeedFigures({ beyer: 88 }),
        classification: 'maiden',
      }),
    ],

    // Workouts
    workouts: [
      createWorkout({ timeSeconds: 59.8, isBullet: true }),
      createWorkout({ timeSeconds: 60.5 }),
    ],
  });
}

/**
 * Create a horse with minimal data (first time starter)
 */
function createMinimalDataHorse() {
  return createFirstTimeStarter({
    horseName: 'First Timer',
    age: 3,
    sex: 'f',
    daysSinceLastRace: null,
    runningStyle: '',

    // Some trainer/jockey data
    trainerName: 'Unknown Trainer',
    trainerStats: '',
    trainerMeetStarts: 0,
    trainerMeetWins: 0,
    jockeyName: 'Unknown Jockey',
    jockeyStats: '',
    jockeyMeetStarts: 0,
    jockeyMeetWins: 0,

    // No lifetime records
    lifetimeStarts: 0,
    lifetimeWins: 0,
    lifetimeEarnings: 0,

    // No track records
    trackStarts: 0,
    turfStarts: 0,
    wetStarts: 0,
    distanceStarts: 0,

    // No speed figures
    bestBeyer: null,
    averageBeyer: null,
    lastBeyer: null,

    // Empty past performances
    pastPerformances: [],

    // Only workouts
    workouts: [createWorkout()],
  });
}

/**
 * Create a shipper horse (no meet stats but has career stats)
 */
function createShipperHorse() {
  return createHorseEntry({
    horseName: 'California Shipper',
    daysSinceLastRace: 30,
    runningStyle: 'P',

    // No meet stats (just shipped in)
    trainerMeetStarts: 0,
    trainerMeetWins: 0,
    jockeyMeetStarts: 0,
    jockeyMeetWins: 0,

    // But has career stats string
    trainerStats: '300: 60-45-40 (20%)',
    jockeyStats: '500: 100-80-70 (20%)',

    // Has past performances with speed figures
    pastPerformances: [
      createPastPerformance({
        finishPosition: 1,
        speedFigures: createSpeedFigures({ beyer: 95 }),
        classification: 'stakes',
      }),
      createPastPerformance({
        finishPosition: 2,
        speedFigures: createSpeedFigures({ beyer: 93 }),
        classification: 'allowance',
      }),
      createPastPerformance({
        finishPosition: 1,
        speedFigures: createSpeedFigures({ beyer: 91 }),
        classification: 'allowance',
      }),
    ],
  });
}

// ============================================================================
// FIELD PRESENCE CHECK TESTS
// ============================================================================

describe('Field Presence Checks', () => {
  describe('hasValidSpeedFigures', () => {
    it('returns true when horse has at least 1 Beyer in last 3 races', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 85 }) }),
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: null }) }),
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: null }) }),
        ],
      });

      const result = hasValidSpeedFigures(horse);

      expect(result.present).toBe(true);
      expect(result.count).toBe(1);
      expect(result.bestBeyer).toBe(85);
    });

    it('returns false when no Beyers in last 3 races', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: null }) }),
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: null }) }),
        ],
      });

      const result = hasValidSpeedFigures(horse);

      expect(result.present).toBe(false);
      expect(result.count).toBe(0);
      expect(result.bestBeyer).toBeNull();
    });

    it('treats Beyer of 0 as valid data (not missing)', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 0 }) }),
        ],
      });

      const result = hasValidSpeedFigures(horse);

      expect(result.present).toBe(true);
      expect(result.count).toBe(1);
      expect(result.bestBeyer).toBe(0);
    });

    it('calculates average Beyer correctly', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 90 }) }),
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 80 }) }),
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 85 }) }),
        ],
      });

      const result = hasValidSpeedFigures(horse);

      expect(result.present).toBe(true);
      expect(result.count).toBe(3);
      expect(result.averageBeyer).toBe(85); // (90+80+85)/3 = 85
    });
  });

  describe('hasValidPastPerformances', () => {
    it('returns true when horse has 3+ valid PPs', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance(),
          createPastPerformance(),
          createPastPerformance(),
        ],
      });

      const result = hasValidPastPerformances(horse);

      expect(result.present).toBe(true);
      expect(result.count).toBe(3);
    });

    it('returns false when horse has less than 3 PPs', () => {
      const horse = createHorseEntry({
        pastPerformances: [createPastPerformance(), createPastPerformance()],
      });

      const result = hasValidPastPerformances(horse);

      expect(result.present).toBe(false);
      expect(result.count).toBe(2);
    });

    it('counts PPs with finish positions', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 5 }),
        ],
      });

      const result = hasValidPastPerformances(horse);

      expect(result.withFinishPositions).toBe(3);
    });
  });

  describe('hasValidTrainerStats', () => {
    it('returns true when trainer has meet starts', () => {
      const horse = createHorseEntry({
        trainerMeetStarts: 20,
        trainerMeetWins: 3,
      });

      const result = hasValidTrainerStats(horse);

      expect(result.present).toBe(true);
      expect(result.meetStarts).toBe(20);
    });

    it('returns true when trainer has 0 meet starts (valid data for shipper)', () => {
      const horse = createHorseEntry({
        trainerMeetStarts: 0,
        trainerStats: '100: 20-15-10 (20%)',
      });

      const result = hasValidTrainerStats(horse);

      expect(result.present).toBe(true);
      expect(result.meetStarts).toBe(0);
      expect(result.hasCareerStats).toBe(true);
    });

    it('uses career stats as fallback when available', () => {
      const horse = createHorseEntry({
        trainerMeetStarts: 0,
        trainerStats: 'Has career stats',
      });

      const result = hasValidTrainerStats(horse);

      expect(result.present).toBe(true);
      expect(result.hasCareerStats).toBe(true);
    });
  });

  describe('hasValidRunningStyle', () => {
    it('returns true for valid running style codes', () => {
      const styles = ['E', 'E/P', 'P', 'S', 'EP'];

      for (const style of styles) {
        const horse = createHorseEntry({ runningStyle: style });
        const result = hasValidRunningStyle(horse);
        expect(result.present).toBe(true);
        expect(result.style).toBe(style);
      }
    });

    it('returns false for empty running style', () => {
      const horse = createHorseEntry({ runningStyle: '' });

      const result = hasValidRunningStyle(horse);

      expect(result.present).toBe(false);
      expect(result.style).toBeNull();
    });
  });

  describe('hasValidPaceFigures', () => {
    it('returns true when has EP1 figures', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ earlyPace1: 85, latePace: null }),
          createPastPerformance({ earlyPace1: 82, latePace: null }),
        ],
      });

      const result = hasValidPaceFigures(horse);

      expect(result.present).toBe(true);
      expect(result.ep1Count).toBe(2);
      expect(result.lpCount).toBe(0);
    });

    it('returns true when has LP figures', () => {
      const horse = createHorseEntry({
        pastPerformances: [createPastPerformance({ earlyPace1: null, latePace: 88 })],
      });

      const result = hasValidPaceFigures(horse);

      expect(result.present).toBe(true);
      expect(result.ep1Count).toBe(0);
      expect(result.lpCount).toBe(1);
    });

    it('returns false when no pace figures', () => {
      const horse = createHorseEntry({
        pastPerformances: [createPastPerformance({ earlyPace1: null, latePace: null })],
      });

      const result = hasValidPaceFigures(horse);

      expect(result.present).toBe(false);
      expect(result.ep1Count).toBe(0);
      expect(result.lpCount).toBe(0);
    });
  });

  describe('hasValidTrackRecord', () => {
    it('returns true when has track starts (including 0)', () => {
      const horse = createHorseEntry({ trackStarts: 0 });

      const result = hasValidTrackRecord(horse, 'CD');

      expect(result.present).toBe(true);
      expect(result.starts).toBe(0);
    });

    it('returns track starts count', () => {
      const horse = createHorseEntry({ trackStarts: 5, trackWins: 2 });

      const result = hasValidTrackRecord(horse, 'CD');

      expect(result.present).toBe(true);
      expect(result.starts).toBe(5);
    });
  });

  describe('hasValidEquipment', () => {
    it('returns true when has equipment data', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({ blinkers: true, raw: 'B' }),
      });

      const result = hasValidEquipment(horse);

      expect(result.present).toBe(true);
    });

    it('returns false when no equipment data', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({ raw: '' }),
      });

      const result = hasValidEquipment(horse);

      expect(result.present).toBe(false);
    });
  });

  describe('hasValidBreeding', () => {
    it('returns true when has sire and dam', () => {
      const horse = createHorseEntry({
        breeding: createBreeding({ sire: 'Quality Road', dam: 'Fast Mare' }),
      });

      const result = hasValidBreeding(horse);

      expect(result.present).toBe(true);
    });

    it('returns false when missing sire', () => {
      const horse = createHorseEntry({
        breeding: createBreeding({ sire: '', dam: 'Fast Mare' }),
      });

      const result = hasValidBreeding(horse);

      expect(result.present).toBe(false);
    });
  });

  describe('hasValidLifetimeEarnings', () => {
    it('treats 0 earnings as valid (maiden)', () => {
      const horse = createHorseEntry({ lifetimeEarnings: 0 });

      const result = hasValidLifetimeEarnings(horse);

      expect(result.present).toBe(true);
    });

    it('returns true for positive earnings', () => {
      const horse = createHorseEntry({ lifetimeEarnings: 250000 });

      const result = hasValidLifetimeEarnings(horse);

      expect(result.present).toBe(true);
    });
  });
});

// ============================================================================
// SCENARIO TESTS
// ============================================================================

describe('Data Completeness Calculator', () => {
  describe('Scenario A - Full Data Horse', () => {
    it('should have overallScore 90+', () => {
      const horse = createFullDataHorse();
      const raceHeader = createRaceHeader({ classification: 'allowance' });

      const result = calculateDataCompleteness(horse, raceHeader);

      expect(result.overallScore).toBeGreaterThanOrEqual(90);
    });

    it('should have Grade A', () => {
      const horse = createFullDataHorse();
      const raceHeader = createRaceHeader({ classification: 'allowance' });

      const result = calculateDataCompleteness(horse, raceHeader);

      expect(result.overallGrade).toBe('A');
    });

    it('should not be flagged as low confidence', () => {
      const horse = createFullDataHorse();
      const raceHeader = createRaceHeader({ classification: 'allowance' });

      const result = calculateDataCompleteness(horse, raceHeader);

      expect(result.isLowConfidence).toBe(false);
    });

    it('should have empty missingCritical array', () => {
      const horse = createFullDataHorse();
      const raceHeader = createRaceHeader({ classification: 'allowance' });

      const result = calculateDataCompleteness(horse, raceHeader);

      expect(result.missingCritical).toHaveLength(0);
    });

    it('should have all quick flags set to true', () => {
      const horse = createFullDataHorse();
      const raceHeader = createRaceHeader({ classification: 'allowance' });

      const result = calculateDataCompleteness(horse, raceHeader);

      expect(result.hasSpeedFigures).toBe(true);
      expect(result.hasPastPerformances).toBe(true);
      expect(result.hasTrainerStats).toBe(true);
      expect(result.hasJockeyStats).toBe(true);
      expect(result.hasRunningStyle).toBe(true);
      expect(result.hasPaceFigures).toBe(true);
    });
  });

  describe('Scenario B - First Time Starter', () => {
    it('should have hasPastPerformances = false', () => {
      const horse = createMinimalDataHorse();

      const result = calculateDataCompleteness(horse);

      expect(result.hasPastPerformances).toBe(false);
    });

    it('should have hasSpeedFigures = false', () => {
      const horse = createMinimalDataHorse();

      const result = calculateDataCompleteness(horse);

      expect(result.hasSpeedFigures).toBe(false);
    });

    it('should have criticalComplete < 50%', () => {
      const horse = createMinimalDataHorse();

      const result = calculateDataCompleteness(horse);

      expect(result.criticalComplete).toBeLessThan(50);
    });

    it('should be flagged as low confidence', () => {
      const horse = createMinimalDataHorse();

      const result = calculateDataCompleteness(horse);

      expect(result.isLowConfidence).toBe(true);
    });

    it('should include Past Performances and Speed Figures in missingCritical', () => {
      const horse = createMinimalDataHorse();

      const result = calculateDataCompleteness(horse);

      expect(result.missingCritical).toContain('Past Performances');
      expect(result.missingCritical).toContain('Speed Figures');
    });

    it('should have Grade D or F', () => {
      const horse = createMinimalDataHorse();

      const result = calculateDataCompleteness(horse);

      expect(['D', 'F']).toContain(result.overallGrade);
    });
  });

  describe('Scenario C - Shipper (no meet stats)', () => {
    it('should still have hasTrainerStats = true if career stats present', () => {
      const horse = createShipperHorse();

      const result = calculateDataCompleteness(horse);

      expect(result.hasTrainerStats).toBe(true);
    });

    it('should not be flagged as low confidence if critical data present', () => {
      const horse = createShipperHorse();
      const raceHeader = createRaceHeader({ classification: 'allowance' });

      const result = calculateDataCompleteness(horse, raceHeader);

      // Shipper has speed figures and PPs, so critical should be high
      expect(result.criticalComplete).toBeGreaterThanOrEqual(75);
      expect(result.isLowConfidence).toBe(false);
    });

    it('should reflect meet stats being 0 in details', () => {
      const horse = createShipperHorse();

      const result = calculateDataCompleteness(horse);

      expect(result.details?.high.trainerStats.meetStarts).toBe(0);
      expect(result.details?.high.trainerStats.hasCareerStats).toBe(true);
    });
  });

  describe('Scenario D - Mixed Data (speed figures but missing pace)', () => {
    it('should have high criticalComplete', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        runningStyle: 'E',
        trainerMeetStarts: 10,
        jockeyMeetStarts: 20,
        pastPerformances: [
          createPastPerformance({
            finishPosition: 1,
            speedFigures: createSpeedFigures({ beyer: 88 }),
            earlyPace1: null, // No pace figures
            latePace: null,
          }),
          createPastPerformance({
            finishPosition: 2,
            speedFigures: createSpeedFigures({ beyer: 85 }),
            earlyPace1: null,
            latePace: null,
          }),
          createPastPerformance({
            finishPosition: 3,
            speedFigures: createSpeedFigures({ beyer: 82 }),
            earlyPace1: null,
            latePace: null,
          }),
        ],
      });
      const raceHeader = createRaceHeader({ classification: 'claiming' });

      const result = calculateDataCompleteness(horse, raceHeader);

      expect(result.criticalComplete).toBe(100); // All 4 critical fields present
    });

    it('should have lower mediumComplete due to missing pace', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        runningStyle: 'E',
        trainerMeetStarts: 10,
        jockeyMeetStarts: 20,
        trackStarts: 5,
        distanceStarts: 3,
        turfStarts: 2,
        wetStarts: 1,
        equipment: createEquipment({ raw: '' }),
        pastPerformances: [
          createPastPerformance({
            finishPosition: 1,
            speedFigures: createSpeedFigures({ beyer: 88 }),
            earlyPace1: null,
            latePace: null,
          }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
        ],
      });

      const result = calculateDataCompleteness(horse);

      // Missing: earlyPaceFigures, latePaceFigures, trainerCategoryStats, equipment
      // Should have: trackRecord, distanceRecord, surfaceRecord, wetTrackRecord
      expect(result.hasPaceFigures).toBe(false);
      expect(result.mediumComplete).toBeLessThan(100);
    });

    it('should still be Grade B or C (not failing)', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        runningStyle: 'E',
        trainerMeetStarts: 10,
        jockeyMeetStarts: 20,
        pastPerformances: [
          createPastPerformance({
            finishPosition: 1,
            speedFigures: createSpeedFigures({ beyer: 88 }),
          }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
        ],
      });
      const raceHeader = createRaceHeader({ classification: 'allowance' });

      const result = calculateDataCompleteness(horse, raceHeader);

      expect(['A', 'B', 'C']).toContain(result.overallGrade);
    });
  });

  describe('Edge Cases', () => {
    it('should handle horse with 1 PP vs horse with 10 PPs', () => {
      const horseFewPPs = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 85 }) }),
        ],
      });

      const horseManyPPs = createHorseEntry({
        pastPerformances: Array(10)
          .fill(null)
          .map(() => createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 85 }) })),
      });

      const resultFew = calculateDataCompleteness(horseFewPPs);
      const resultMany = calculateDataCompleteness(horseManyPPs);

      // Horse with 1 PP fails the 3 PP minimum
      expect(resultFew.hasPastPerformances).toBe(false);
      // Horse with 10 PPs passes
      expect(resultMany.hasPastPerformances).toBe(true);
    });

    it('should distinguish Beyer of 0 from null', () => {
      const horseZeroBeyer = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 0 }) }),
        ],
      });

      const horseNullBeyer = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: null }) }),
        ],
      });

      const resultZero = hasValidSpeedFigures(horseZeroBeyer);
      const resultNull = hasValidSpeedFigures(horseNullBeyer);

      expect(resultZero.present).toBe(true); // 0 is valid data
      expect(resultNull.present).toBe(false); // null is missing
    });

    it('should handle trainer with 0 meet starts but career stats present', () => {
      const horse = createHorseEntry({
        trainerMeetStarts: 0,
        trainerMeetWins: 0,
        trainerStats: '100: 15-10-8 (15%)',
      });

      const result = hasValidTrainerStats(horse);

      expect(result.present).toBe(true);
      expect(result.meetStarts).toBe(0);
      expect(result.hasCareerStats).toBe(true);
    });

    it('should handle empty past performances array', () => {
      const horse = createHorseEntry({
        pastPerformances: [],
      });

      const result = calculateDataCompleteness(horse);

      expect(result.hasSpeedFigures).toBe(false);
      expect(result.hasPastPerformances).toBe(false);
      expect(result.missingCritical).toContain('Speed Figures');
      expect(result.missingCritical).toContain('Past Performances');
    });

    it('should handle null values gracefully', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: null,
        runningStyle: '',
        trainerMeetStarts: undefined as unknown as number,
        jockeyMeetStarts: undefined as unknown as number,
        trackStarts: undefined as unknown as number,
        lifetimeEarnings: undefined as unknown as number,
      });

      // Should not throw
      const result = calculateDataCompleteness(horse);

      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Tier Weight Calculations', () => {
    it('should weight critical at 50% of overall score', () => {
      // Horse with 100% critical, 0% everything else
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        runningStyle: 'E',
        trainerMeetStarts: 10,
        jockeyMeetStarts: 20,
        pastPerformances: [
          createPastPerformance({
            finishPosition: 1,
            speedFigures: createSpeedFigures({ beyer: 88 }),
          }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
        ],
      });
      const raceHeader = createRaceHeader({ classification: 'allowance' });

      const result = calculateDataCompleteness(horse, raceHeader);

      // 100% critical (50 pts) + 100% high (30 pts) = 80 pts minimum
      // With some medium and low likely also present
      expect(result.criticalComplete).toBe(100);
      expect(result.highComplete).toBe(100);
      expect(result.overallScore).toBeGreaterThanOrEqual(80);
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('Utility Functions', () => {
  describe('getDataCompletenessSummary', () => {
    it('returns appropriate summary for Grade A', () => {
      const result = {
        overallScore: 95,
        overallGrade: 'A' as const,
        missingCritical: [],
      } as ReturnType<typeof calculateDataCompleteness>;

      const summary = getDataCompletenessSummary(result);

      expect(summary).toContain('Excellent');
      expect(summary).toContain('95%');
    });

    it('returns summary with missing items for low grades', () => {
      const result = {
        overallScore: 35,
        overallGrade: 'F' as const,
        missingCritical: ['Speed Figures', 'Past Performances'],
      } as ReturnType<typeof calculateDataCompleteness>;

      const summary = getDataCompletenessSummary(result);

      expect(summary).toContain('Insufficient');
      expect(summary).toContain('Speed Figures');
    });
  });

  describe('getDataCompletenessColor', () => {
    it('returns green for Grade A', () => {
      const color = getDataCompletenessColor('A');
      expect(color).toBe('#22c55e');
    });

    it('returns red for Grade F', () => {
      const color = getDataCompletenessColor('F');
      expect(color).toBe('#ef4444');
    });
  });

  describe('shouldFlagLowConfidence', () => {
    it('returns true when isLowConfidence is true', () => {
      const result = { isLowConfidence: true } as ReturnType<typeof calculateDataCompleteness>;

      expect(shouldFlagLowConfidence(result)).toBe(true);
    });

    it('returns false when isLowConfidence is false', () => {
      const result = { isLowConfidence: false } as ReturnType<typeof calculateDataCompleteness>;

      expect(shouldFlagLowConfidence(result)).toBe(false);
    });
  });
});
