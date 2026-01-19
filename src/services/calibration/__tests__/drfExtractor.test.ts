/**
 * DRF Extractor Tests
 *
 * Tests for extracting historical race data from parsed DRF files.
 */

import { describe, it, expect } from 'vitest';
import {
  extractHistoricalRaces,
  extractRaceForPredictionLogging,
  estimateExtractableRaces,
} from '../drfExtractor';
import type {
  ParsedDRFFile,
  ParsedRace,
  HorseEntry,
  RaceHeader,
  PastPerformance,
} from '../../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../../types/drf';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockPastPerformance(overrides: Partial<PastPerformance> = {}): PastPerformance {
  return {
    date: '20240801',
    track: 'SAR',
    trackName: 'Saratoga',
    raceNumber: 1,
    distanceFurlongs: 6,
    distance: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'allowance',
    claimingPrice: null,
    purse: 50000,
    fieldSize: 8,
    finishPosition: 3,
    lengthsBehind: 2,
    lengthsAhead: null,
    finalTime: 70.5,
    finalTimeFormatted: '1:10.50',
    speedFigures: {
      beyer: 85,
      timeformUS: null,
      equibase: null,
      trackVariant: null,
      dirtVariant: null,
      turfVariant: null,
    },
    runningLine: {
      start: 3,
      quarterMile: 3,
      quarterMileLengths: 2,
      halfMile: 2,
      halfMileLengths: 1,
      threeQuarters: null,
      threeQuartersLengths: null,
      stretch: 2,
      stretchLengths: 1,
      finish: 3,
      finishLengths: 2,
    },
    jockey: 'Smith J',
    weight: 122,
    apprenticeAllowance: 0,
    equipment: '',
    medication: '',
    winner: 'Winner Horse',
    secondPlace: 'Second Horse',
    thirdPlace: 'Third Horse',
    tripComment: '',
    comment: '',
    odds: 5.5,
    ...overrides,
  };
}

function createMockHorseEntry(
  programNumber: number,
  pastPerformances: PastPerformance[] = [],
  overrides: Partial<HorseEntry> = {}
): HorseEntry {
  return {
    programNumber,
    horseName: `Horse ${programNumber}`,
    postPosition: programNumber,
    coupledIndicator: '',
    weight: 122,
    apprenticeAllowance: 0,
    morningLineRaw: '5-1',
    morningLineDecimal: 5.0,
    jockeyName: 'Smith J',
    trainerName: 'Jones T',
    ownerName: 'Owner LLC',
    silks: 'Red and white',
    age: 4,
    ageMonths: 0,
    sex: 'C',
    color: 'Bay',
    sire: 'Sire Name',
    siresSire: 'Sires Sire',
    dam: 'Dam Name',
    damsSire: 'Dams Sire',
    breeder: 'Breeder Name',
    whereBred: 'KY',
    lifetimeRecord: {
      starts: 15,
      wins: 3,
      places: 4,
      shows: 2,
      earnings: 150000,
    },
    currentYearRecord: {
      starts: 5,
      wins: 1,
      places: 2,
      shows: 1,
      earnings: 50000,
    },
    previousYearRecord: {
      starts: 8,
      wins: 2,
      places: 1,
      shows: 1,
      earnings: 80000,
    },
    trackRecord: {
      starts: 3,
      wins: 1,
      places: 1,
      shows: 0,
      earnings: 30000,
    },
    turfRecord: {
      starts: 2,
      wins: 0,
      places: 1,
      shows: 0,
      earnings: 10000,
    },
    wetRecord: {
      starts: 1,
      wins: 0,
      places: 0,
      shows: 1,
      earnings: 5000,
    },
    distanceRecord: {
      starts: 4,
      wins: 1,
      places: 1,
      shows: 1,
      earnings: 40000,
    },
    runningStyle: 'E/P',
    speedPoints: 6,
    bestBeyer: 90,
    averageBeyer: 85,
    lastBeyer: 87,
    daysSinceLastRace: 21,
    pastPerformances,
    workouts: [],
    trainerMeetStats: {
      starts: 50,
      wins: 10,
      places: 12,
      shows: 8,
    },
    jockeyMeetStats: {
      starts: 200,
      wins: 40,
      places: 35,
      shows: 30,
    },
    trainerCategoryStats: createDefaultTrainerCategoryStats(),
    equipment: {
      blinkers: false,
      frontBandages: false,
      rearBandages: false,
      barShoe: false,
      steelShoe: false,
      aluminumPads: false,
      barShoes: false,
      mudCaulks: false,
      glovesBack: false,
      innerRims: false,
      frontWraps: false,
      tongueTie: false,
      turnDowns: false,
      queensPlates: false,
      cheekPieces: false,
      noEquipment: true,
      hasChanges: false,
      rawCode: '',
    },
    medication: {
      lasix: false,
      bute: false,
      firstTimeLasix: false,
      lasixRemoved: false,
      rawCode: '',
    },
    isScratched: false,
    ...overrides,
  };
}

function createMockRaceHeader(overrides: Partial<RaceHeader> = {}): RaceHeader {
  return {
    trackCode: 'SAR',
    raceDateRaw: '20240815',
    raceDate: new Date('2024-08-15'),
    raceNumber: 5,
    postPosition: 1,
    postTime: 1400,
    surface: 'dirt',
    distanceCode: 'S',
    distanceFurlongs: 6,
    distanceFeet: 3960,
    raceType: 'allowance',
    raceName: 'Test Race',
    conditions: 'For 3yo and up',
    purse: 75000,
    breedCode: 'TB',
    fieldSize: 8,
    trackCondition: 'fast',
    ageRestriction: '3YO+',
    sexRestriction: '',
    ...overrides,
  };
}

function createMockParsedRace(
  horses: HorseEntry[] = [],
  header: Partial<RaceHeader> = {}
): ParsedRace {
  return {
    header: createMockRaceHeader(header),
    horses:
      horses.length > 0
        ? horses
        : [createMockHorseEntry(1), createMockHorseEntry(2), createMockHorseEntry(3)],
  };
}

function createMockParsedDRFFile(races: ParsedRace[] = []): ParsedDRFFile {
  return {
    races: races.length > 0 ? races : [createMockParsedRace()],
    metadata: {
      totalHorses: races.reduce((sum, r) => sum + r.horses.length, 0),
      totalRaces: races.length || 1,
      rawLines: 100,
      parsedDate: new Date(),
    },
  };
}

// ============================================================================
// EXTRACTION TESTS
// ============================================================================

describe('DRF Extractor', () => {
  describe('extractHistoricalRaces', () => {
    it('should extract races from PP data', () => {
      // Create horses with overlapping PPs (same race seen by multiple horses)
      const sharedPP1 = createMockPastPerformance({
        date: '20240801',
        track: 'SAR',
        raceNumber: 3,
        fieldSize: 6,
      });

      const sharedPP2 = createMockPastPerformance({
        date: '20240801',
        track: 'SAR',
        raceNumber: 3,
        fieldSize: 6,
        finishPosition: 1, // Winner
      });

      const horse1 = createMockHorseEntry(1, [
        { ...sharedPP1, finishPosition: 3 },
        createMockPastPerformance({ date: '20240720', track: 'CD', raceNumber: 5 }),
      ]);

      const horse2 = createMockHorseEntry(2, [
        { ...sharedPP2, finishPosition: 1 },
        createMockPastPerformance({ date: '20240715', track: 'GP', raceNumber: 2 }),
      ]);

      const parsedFile = createMockParsedDRFFile([createMockParsedRace([horse1, horse2])]);

      const result = extractHistoricalRaces(parsedFile);

      expect(result.races.length).toBeGreaterThan(0);
      expect(result.stats.totalPPsExamined).toBeGreaterThan(0);
    });

    it('should deduplicate races from multiple horses', () => {
      // Create 3 horses that all ran in the same race
      const pp = createMockPastPerformance({
        date: '20240801',
        track: 'SAR',
        raceNumber: 5,
        fieldSize: 8,
      });

      const horses = [
        createMockHorseEntry(1, [{ ...pp, finishPosition: 1 }]),
        createMockHorseEntry(2, [{ ...pp, finishPosition: 2 }]),
        createMockHorseEntry(3, [{ ...pp, finishPosition: 3 }]),
      ];

      const parsedFile = createMockParsedDRFFile([createMockParsedRace(horses)]);

      const result = extractHistoricalRaces(parsedFile);

      // Should find only ONE unique race, not three
      const sarRaces = result.races.filter(
        (r) => r.trackCode === 'SAR' && r.raceDate === '2024-08-01' && r.raceNumber === 5
      );

      expect(sarRaces.length).toBe(1);
      // The race should have entries from all three horses
      expect(sarRaces[0]?.entries.length).toBe(3);
    });

    it('should handle missing/incomplete PP data gracefully', () => {
      // Create horse with incomplete PP
      const incompletePP = createMockPastPerformance({
        track: '', // Missing track
        date: '20240801',
        raceNumber: 1,
      });

      const horse = createMockHorseEntry(1, [
        incompletePP,
        createMockPastPerformance(), // Valid PP
      ]);

      const parsedFile = createMockParsedDRFFile([createMockParsedRace([horse])]);

      // Should not throw
      const result = extractHistoricalRaces(parsedFile);
      expect(result.stats.incompleteSkipped).toBeGreaterThan(0);
    });

    it('should respect minFieldSize option', () => {
      const smallFieldPP = createMockPastPerformance({
        fieldSize: 3, // Small field
        date: '20240801',
        track: 'SAR',
        raceNumber: 1,
      });

      const normalFieldPP = createMockPastPerformance({
        fieldSize: 8,
        date: '20240802',
        track: 'CD',
        raceNumber: 2,
      });

      const horse = createMockHorseEntry(1, [smallFieldPP, normalFieldPP]);
      const parsedFile = createMockParsedDRFFile([createMockParsedRace([horse])]);

      const result = extractHistoricalRaces(parsedFile, { minFieldSize: 5 });

      // Should only include the 8-horse field race
      const smallFieldRaces = result.races.filter((r) => r.fieldSize < 5);
      expect(smallFieldRaces.length).toBe(0);
    });

    it('should respect maxPPsPerHorse option', () => {
      // Create horse with 10 PPs
      const pps = Array.from({ length: 10 }, (_, i) =>
        createMockPastPerformance({
          date: `2024070${i}`,
          track: 'SAR',
          raceNumber: i + 1,
        })
      );

      const horse = createMockHorseEntry(1, pps);
      const parsedFile = createMockParsedDRFFile([createMockParsedRace([horse])]);

      // Only process first 3 PPs
      const result = extractHistoricalRaces(parsedFile, { maxPPsPerHorse: 3 });

      expect(result.stats.totalPPsExamined).toBeLessThanOrEqual(3);
    });
  });

  describe('extractRaceForPredictionLogging', () => {
    it('should extract current race data for logging', () => {
      const race = createMockParsedRace(
        [
          createMockHorseEntry(1),
          createMockHorseEntry(2),
          createMockHorseEntry(3, [], { isScratched: true }), // Scratched horse
        ],
        { raceNumber: 7, distanceFurlongs: 8.5 }
      );

      const result = extractRaceForPredictionLogging(race);

      expect(result.trackCode).toBe('SAR');
      expect(result.raceNumber).toBe(7);
      expect(result.distance).toBe(8.5);
      expect(result.fieldSize).toBe(2); // Excludes scratched horse
      expect(result.horses.length).toBe(2);
    });
  });

  describe('estimateExtractableRaces', () => {
    it('should estimate races without full extraction', () => {
      // Create file with known PP structure
      const pps = [
        createMockPastPerformance({ date: '20240801', track: 'SAR', raceNumber: 1 }),
        createMockPastPerformance({ date: '20240802', track: 'CD', raceNumber: 2 }),
        createMockPastPerformance({ date: '20240803', track: 'GP', raceNumber: 3 }),
      ];

      const horse1 = createMockHorseEntry(1, pps);
      const horse2 = createMockHorseEntry(2, pps); // Same PPs, should be deduplicated

      const parsedFile = createMockParsedDRFFile([createMockParsedRace([horse1, horse2])]);

      const estimate = estimateExtractableRaces(parsedFile);

      expect(estimate.estimatedRaces).toBe(3); // 3 unique races
      expect(estimate.dateRange).not.toBeNull();
      expect(estimate.dateRange?.earliest).toBe('2024-08-01');
      expect(estimate.dateRange?.latest).toBe('2024-08-03');
    });
  });
});

// ============================================================================
// INTEGRATION SCENARIOS (documentation)
// ============================================================================

describe('DRF Extractor Integration Scenarios', () => {
  it('Scenario: Parse DRF with 10 horses, each having 10 PPs', () => {
    // Expected: Should extract ~30-50 unique races (not 100)
    // due to deduplication of same race from multiple horses

    const horses = Array.from({ length: 10 }, (_, horseIdx) => {
      const pps = Array.from({ length: 10 }, (_, ppIdx) =>
        createMockPastPerformance({
          date: `2024070${ppIdx}`,
          track: 'SAR',
          raceNumber: ppIdx + 1,
          finishPosition: horseIdx + 1, // Different finish positions
          fieldSize: 10,
        })
      );
      return createMockHorseEntry(horseIdx + 1, pps);
    });

    const parsedFile = createMockParsedDRFFile([createMockParsedRace(horses)]);
    const result = extractHistoricalRaces(parsedFile);

    // With all horses having the same 10 races, we should only get 10 unique races
    // (not 10 horses × 10 PPs = 100)
    expect(result.races.length).toBeLessThanOrEqual(50);
    expect(result.stats.uniqueRacesFound).toBeLessThanOrEqual(50);
  });

  it('Scenario: Each extracted race has correct field size and finish positions', () => {
    const pp = createMockPastPerformance({
      date: '20240801',
      track: 'SAR',
      raceNumber: 5,
      fieldSize: 8,
    });

    const horses = Array.from({ length: 4 }, (_, i) =>
      createMockHorseEntry(i + 1, [{ ...pp, finishPosition: i + 1 }])
    );

    const parsedFile = createMockParsedDRFFile([createMockParsedRace(horses)]);
    const result = extractHistoricalRaces(parsedFile);

    const race = result.races.find(
      (r) => r.trackCode === 'SAR' && r.raceDate === '2024-08-01' && r.raceNumber === 5
    );

    expect(race).toBeDefined();
    expect(race?.fieldSize).toBe(8);
    expect(race?.entries.length).toBe(4); // We have 4 horses' data

    // Check finish positions are unique and sequential
    const positions = race?.entries.map((e) => e.finishPosition).sort((a, b) => a - b);
    expect(positions).toEqual([1, 2, 3, 4]);
  });
});
