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

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a mock PastPerformance with only the fields the extractor uses.
 * Uses type assertion since we don't need all fields for testing.
 */
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
    favoriteRank: null,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: null,
    earlyPace1: null,
    latePace: null,
    quarterTime: null,
    halfMileTime: null,
    sixFurlongTime: null,
    mileTime: null,
    ...overrides,
  };
}

/**
 * Create a mock HorseEntry with fields the extractor uses.
 * Uses type assertion for fields we don't test.
 */
function createMockHorseEntry(
  programNumber: number,
  pastPerformances: PastPerformance[] = [],
  overrides: Partial<HorseEntry> = {}
): HorseEntry {
  // Create minimal horse entry with required fields for extraction
  const base = {
    programNumber,
    horseName: `Horse ${programNumber}`,
    postPosition: programNumber,
    isScratched: false,
    pastPerformances,
    morningLineDecimal: 5.0,
    ...overrides,
  };

  // Cast to HorseEntry - the extractor only uses these fields
  return base as unknown as HorseEntry;
}

/**
 * Create a mock RaceHeader with fields the extractor uses.
 */
function createMockRaceHeader(overrides: Partial<RaceHeader> = {}): RaceHeader {
  const base = {
    trackCode: 'SAR',
    trackName: 'Saratoga',
    trackLocation: 'Saratoga Springs, NY',
    raceDateRaw: '20240815',
    raceDate: '2024-08-15',
    raceNumber: 5,
    postTime: '14:00',
    surface: 'dirt',
    distanceFurlongs: 6,
    distance: '6 furlongs',
    distanceExact: '6f',
    classification: 'allowance',
    raceType: 'allowance',
    raceName: null,
    conditions: 'For 3yo and up',
    purse: 75000,
    purseFormatted: '$75,000',
    trackCondition: 'fast',
    ageRestriction: '3YO+',
    sexRestriction: '',
    weightConditions: '',
    stateBred: null,
    claimingPriceMin: null,
    claimingPriceMax: null,
    allowedWeight: null,
    grade: null,
    isListed: false,
    ...overrides,
  };

  return base as unknown as RaceHeader;
}

/**
 * Create a mock ParsedRace.
 */
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
    warnings: [],
    errors: [],
  };
}

/**
 * Create a mock ParsedDRFFile.
 */
function createMockParsedDRFFile(races: ParsedRace[] = []): ParsedDRFFile {
  const actualRaces = races.length > 0 ? races : [createMockParsedRace()];
  const base = {
    filename: 'test.drf',
    races: actualRaces,
    format: 'csv' as const,
    version: null,
    parsedAt: new Date().toISOString(),
    isValid: true,
    warnings: [],
    errors: [],
    stats: {
      totalRaces: actualRaces.length,
      totalHorses: actualRaces.reduce((sum, r) => sum + r.horses.length, 0),
      totalPastPerformances: 0,
      totalWorkouts: 0,
      parseTimeMs: 0,
      linesProcessed: 0,
      linesSkipped: 0,
    },
  };

  return base as ParsedDRFFile;
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
        finishPosition: 2,
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
      // Create two horses that both ran in the same race
      const sharedRacePP = createMockPastPerformance({
        date: '20240801',
        track: 'SAR',
        raceNumber: 5,
        fieldSize: 8,
      });

      const horse1 = createMockHorseEntry(1, [{ ...sharedRacePP, finishPosition: 1 }]);

      const horse2 = createMockHorseEntry(2, [{ ...sharedRacePP, finishPosition: 3 }]);

      const parsedFile = createMockParsedDRFFile([createMockParsedRace([horse1, horse2])]);

      const result = extractHistoricalRaces(parsedFile);

      // Should have exactly one race (deduplicated)
      const sarRaces = result.races.filter(
        (r) => r.trackCode === 'SAR' && r.raceDate === '2024-08-01' && r.raceNumber === 5
      );
      expect(sarRaces.length).toBe(1);

      // That race should have entries from both horses
      const sarRace = sarRaces[0];
      expect(sarRace?.entries.length).toBe(2);
    });

    it('should respect minFieldSize option', () => {
      const smallFieldPP = createMockPastPerformance({
        fieldSize: 3, // Below minimum
      });

      const normalFieldPP = createMockPastPerformance({
        date: '20240802',
        fieldSize: 8, // Above minimum
      });

      const horse = createMockHorseEntry(1, [smallFieldPP, normalFieldPP]);
      const parsedFile = createMockParsedDRFFile([createMockParsedRace([horse])]);

      const result = extractHistoricalRaces(parsedFile, { minFieldSize: 4 });

      // Should only include the race with 8 starters
      const smallFieldRaces = result.races.filter((r) => r.fieldSize === 3);
      expect(smallFieldRaces.length).toBe(0);
    });

    it('should respect minDate option', () => {
      const oldPP = createMockPastPerformance({
        date: '20230101',
      });

      const recentPP = createMockPastPerformance({
        date: '20240801',
      });

      const horse = createMockHorseEntry(1, [oldPP, recentPP]);
      const parsedFile = createMockParsedDRFFile([createMockParsedRace([horse])]);

      const result = extractHistoricalRaces(parsedFile, { minDate: '2024-01-01' });

      // Should only include races from 2024+
      const oldRaces = result.races.filter((r) => r.raceDate < '2024-01-01');
      expect(oldRaces.length).toBe(0);
    });

    it('should handle races without odds data', () => {
      // Create two horses with shared PPs - one race has odds, one doesn't
      const ppWithOdds = createMockPastPerformance({
        date: '20240801',
        track: 'SAR',
        raceNumber: 1,
        odds: 5.5,
      });

      const ppWithoutOdds = createMockPastPerformance({
        date: '20240802',
        track: 'SAR',
        raceNumber: 2,
        odds: null,
      });

      // Need multiple horses per race for extraction to include them
      const horse1 = createMockHorseEntry(1, [
        { ...ppWithOdds, finishPosition: 1 },
        { ...ppWithoutOdds, finishPosition: 2 },
      ]);
      const horse2 = createMockHorseEntry(2, [
        { ...ppWithOdds, finishPosition: 2 },
        { ...ppWithoutOdds, finishPosition: 1 },
      ]);

      const parsedFile = createMockParsedDRFFile([createMockParsedRace([horse1, horse2])]);

      // With includeWithoutOdds = true (default) - should include both races
      const resultWithOdds = extractHistoricalRaces(parsedFile, { includeWithoutOdds: true });
      expect(resultWithOdds.races.length).toBe(2);

      // With includeWithoutOdds = false - should only include race with odds
      const resultFiltered = extractHistoricalRaces(parsedFile, { includeWithoutOdds: false });
      expect(resultFiltered.races.length).toBe(1);
      expect(resultFiltered.stats.racesWithFullOdds).toBe(1);
    });
  });

  describe('extractRaceForPredictionLogging', () => {
    it('should extract race info for prediction logging', () => {
      const race = createMockParsedRace(
        [createMockHorseEntry(1), createMockHorseEntry(2), createMockHorseEntry(3)],
        {
          trackCode: 'SAR',
          raceDateRaw: '20240815',
          raceNumber: 5,
          distanceFurlongs: 6,
          surface: 'dirt',
        }
      );

      const result = extractRaceForPredictionLogging(race);

      expect(result.raceKey).toBe('SAR-2024-08-15-R5');
      expect(result.trackCode).toBe('SAR');
      expect(result.raceDate).toBe('2024-08-15');
      expect(result.raceNumber).toBe(5);
      expect(result.distance).toBe(6);
      expect(result.surface).toBe('D');
      expect(result.fieldSize).toBe(3);
      expect(result.horses.length).toBe(3);
    });

    it('should exclude scratched horses', () => {
      const race = createMockParsedRace([
        createMockHorseEntry(1),
        createMockHorseEntry(2, [], { isScratched: true }),
        createMockHorseEntry(3),
      ]);

      const result = extractRaceForPredictionLogging(race);

      expect(result.fieldSize).toBe(2);
      expect(result.horses.length).toBe(2);
      expect(result.horses.find((h) => h.programNumber === 2)).toBeUndefined();
    });
  });

  describe('estimateExtractableRaces', () => {
    it('should estimate races from a parsed file', () => {
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
