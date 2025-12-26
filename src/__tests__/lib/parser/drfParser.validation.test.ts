/**
 * DRF Parser Validation Tests
 *
 * These tests verify that the DRF parser correctly maps fields according to
 * the BRIS 12-PP format specification (DRF_FIELD_MAP.md v2.0).
 *
 * Key validation points:
 * - Field 1 (index 0) = Track Code
 * - Field 28 (index 27) = Trainer Name
 * - Field 45 (index 44) = Horse Name
 * - Field 766 (index 765) = PP1 Speed Figure
 * - Field 777 (index 776) = PP12 Speed Figure
 * - Field 85 (index 84) = Best Turf Year (NOT turf starts!)
 */

import { describe, expect, it } from 'vitest';
import { parseDRFFile, validateParsedData, DRF_COLUMNS } from '../../../lib/drfParser';
import type { HorseEntry } from '../../../types/drf';

describe('DRF Parser Field Mapping Validation', () => {
  describe('DRF_COLUMNS Constants', () => {
    it('should have correct race header indices', () => {
      expect(DRF_COLUMNS.TRACK_CODE.index).toBe(0); // Field 1
      expect(DRF_COLUMNS.RACE_DATE.index).toBe(1); // Field 2
      expect(DRF_COLUMNS.RACE_NUMBER.index).toBe(2); // Field 3
      expect(DRF_COLUMNS.POST_POSITION.index).toBe(3); // Field 4
      expect(DRF_COLUMNS.DISTANCE_YARDS.index).toBe(5); // Field 6 - WAS POST_TIME!
      expect(DRF_COLUMNS.SURFACE.index).toBe(6); // Field 7
      expect(DRF_COLUMNS.RACE_TYPE.index).toBe(8); // Field 9
      expect(DRF_COLUMNS.PURSE.index).toBe(11); // Field 12
      expect(DRF_COLUMNS.CLAIMING_PRICE_HIGH.index).toBe(12); // Field 13
      expect(DRF_COLUMNS.CLAIMING_PRICE_HORSE.index).toBe(13); // Field 14
      expect(DRF_COLUMNS.FIELD_SIZE.index).toBe(23); // Field 24
    });

    it('should have correct horse identity indices', () => {
      expect(DRF_COLUMNS.TRAINER_NAME.index).toBe(27); // Field 28
      expect(DRF_COLUMNS.JOCKEY_NAME.index).toBe(32); // Field 33
      expect(DRF_COLUMNS.PROGRAM_NUMBER.index).toBe(42); // Field 43
      expect(DRF_COLUMNS.MORNING_LINE.index).toBe(43); // Field 44
      expect(DRF_COLUMNS.HORSE_NAME.index).toBe(44); // Field 45
      expect(DRF_COLUMNS.HORSE_AGE_YEARS.index).toBe(45); // Field 46
      expect(DRF_COLUMNS.HORSE_SEX.index).toBe(48); // Field 49
      expect(DRF_COLUMNS.WEIGHT.index).toBe(50); // Field 51
      expect(DRF_COLUMNS.SIRE.index).toBe(51); // Field 52
      expect(DRF_COLUMNS.DAM.index).toBe(53); // Field 54
    });

    it('should have correct lifetime record indices (shifted by 3)', () => {
      expect(DRF_COLUMNS.TODAY_MEDICATION.index).toBe(61); // Field 62
      expect(DRF_COLUMNS.FIRST_TIME_LASIX.index).toBe(62); // Field 63
      expect(DRF_COLUMNS.LIFETIME_STARTS.index).toBe(64); // Field 65 - WAS 61!
      expect(DRF_COLUMNS.LIFETIME_WINS.index).toBe(65); // Field 66 - WAS 62!
      expect(DRF_COLUMNS.LIFETIME_PLACES.index).toBe(66); // Field 67 - WAS 63!
      expect(DRF_COLUMNS.LIFETIME_SHOWS.index).toBe(67); // Field 68 - WAS 64!
      expect(DRF_COLUMNS.LIFETIME_EARNINGS.index).toBe(68); // Field 69
    });

    it('should have correct turf/wet/distance/track indices', () => {
      // Turf record at Fields 80-84 (indices 79-83)
      expect(DRF_COLUMNS.TURF_STARTS.index).toBe(79); // Field 80
      expect(DRF_COLUMNS.TURF_WINS.index).toBe(80); // Field 81
      expect(DRF_COLUMNS.TURF_PLACES.index).toBe(81); // Field 82
      expect(DRF_COLUMNS.TURF_SHOWS.index).toBe(82); // Field 83
      expect(DRF_COLUMNS.TURF_EARNINGS.index).toBe(83); // Field 84

      // Best turf year at Field 85 (index 84) - THIS WAS THE 2025 BUG!
      expect(DRF_COLUMNS.BEST_TURF_YEAR.index).toBe(84); // Field 85

      // Wet record at Fields 86-90 (indices 85-89)
      expect(DRF_COLUMNS.WET_STARTS.index).toBe(85); // Field 86
      expect(DRF_COLUMNS.WET_WINS.index).toBe(86); // Field 87

      // Distance record at Fields 92-96 (indices 91-95)
      expect(DRF_COLUMNS.DISTANCE_STARTS.index).toBe(91); // Field 92
      expect(DRF_COLUMNS.DISTANCE_WINS.index).toBe(92); // Field 93

      // Track record at Fields 97-101 (indices 96-100)
      expect(DRF_COLUMNS.TRACK_STARTS.index).toBe(96); // Field 97
      expect(DRF_COLUMNS.TRACK_WINS.index).toBe(97); // Field 98
    });

    it('should have 12-field PP blocks', () => {
      expect(DRF_COLUMNS.PP_COUNT).toBe(12); // NOT 10!

      // PP dates: Fields 102-113 (indices 101-112)
      expect(DRF_COLUMNS.PP_DATE_START).toBe(101);

      // PP speed figures: Fields 766-777 (indices 765-776)
      expect(DRF_COLUMNS.PP_BEYER_START).toBe(765);

      // PP E1 pace: Fields 816-827 (indices 815-826)
      expect(DRF_COLUMNS.PP_EARLY_PACE_START).toBe(815);

      // PP late pace: Fields 846-857 (indices 845-856)
      expect(DRF_COLUMNS.PP_LATE_PACE_START).toBe(845);
    });

    it('should have 12 workouts', () => {
      expect(DRF_COLUMNS.WORKOUT_COUNT).toBe(12); // NOT 10!

      // Workout dates: Fields 256-267 (indices 255-266)
      expect(DRF_COLUMNS.WK_DATE_START).toBe(255);

      // Workout tracks: Fields 268-279 (indices 267-278)
      expect(DRF_COLUMNS.WK_TRACK_START).toBe(267);

      // Workout distances: Fields 280-291 (indices 279-290)
      expect(DRF_COLUMNS.WK_DISTANCE_START).toBe(279);
    });
  });

  describe('Validation Function', () => {
    it('should detect "2025" turf bug when turfStarts looks like a year', () => {
      const mockHorse: HorseEntry = {
        horseName: 'TEST HORSE',
        trainerName: 'TEST TRAINER',
        turfStarts: 2025, // This is wrong - should be a small number
        turfWins: 0,
        turfPlaces: 0,
        turfShows: 0,
        pastPerformances: [],
      } as HorseEntry;

      const mockFields = new Array(1500).fill('');
      mockFields[44] = 'TEST HORSE'; // Horse name anchor
      mockFields[27] = 'TEST TRAINER'; // Trainer name anchor

      const result = validateParsedData(mockHorse, mockFields);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('2025'))).toBe(true);
    });

    it('should pass validation when turfStarts is a reasonable number', () => {
      const mockHorse: HorseEntry = {
        horseName: 'TEST HORSE',
        trainerName: 'TEST TRAINER',
        turfStarts: 5, // This is correct - a small number
        turfWins: 2,
        turfPlaces: 1,
        turfShows: 0,
        pastPerformances: [],
      } as HorseEntry;

      const mockFields = new Array(1500).fill('');
      mockFields[44] = 'TEST HORSE';
      mockFields[27] = 'TEST TRAINER';
      mockFields[765] = '85'; // Valid PP1 speed figure

      const result = validateParsedData(mockHorse, mockFields);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate horse name anchor at Field 45 (index 44)', () => {
      const mockHorse: HorseEntry = {
        horseName: 'WRONG NAME',
        trainerName: 'TEST TRAINER',
        turfStarts: 5,
        pastPerformances: [],
      } as HorseEntry;

      const mockFields = new Array(1500).fill('');
      mockFields[44] = 'CORRECT NAME'; // Should not match
      mockFields[27] = 'TEST TRAINER';

      const result = validateParsedData(mockHorse, mockFields);

      expect(result.anchorPoints.horseName.expected).toBe('CORRECT NAME');
      expect(result.anchorPoints.horseName.actual).toBe('WRONG NAME');
      expect(result.anchorPoints.horseName.match).toBe(false);
    });

    it('should validate trainer name anchor at Field 28 (index 27)', () => {
      const mockHorse: HorseEntry = {
        horseName: 'TEST HORSE',
        trainerName: 'WRONG TRAINER',
        turfStarts: 5,
        pastPerformances: [],
      } as HorseEntry;

      const mockFields = new Array(1500).fill('');
      mockFields[44] = 'TEST HORSE';
      mockFields[27] = 'CORRECT TRAINER'; // Should not match

      const result = validateParsedData(mockHorse, mockFields);

      expect(result.anchorPoints.trainerName.expected).toBe('CORRECT TRAINER');
      expect(result.anchorPoints.trainerName.actual).toBe('WRONG TRAINER');
      expect(result.anchorPoints.trainerName.match).toBe(false);
    });

    it('should validate PP1 speed figure at Field 766 (index 765)', () => {
      const mockHorse: HorseEntry = {
        horseName: 'TEST HORSE',
        trainerName: 'TEST TRAINER',
        turfStarts: 5,
        pastPerformances: [],
      } as HorseEntry;

      const mockFields = new Array(1500).fill('');
      mockFields[44] = 'TEST HORSE';
      mockFields[27] = 'TEST TRAINER';
      mockFields[765] = '81'; // Valid speed figure

      const result = validateParsedData(mockHorse, mockFields);

      expect(result.anchorPoints.pp1SpeedFigure.value).toBe(81);
      expect(result.anchorPoints.pp1SpeedFigure.valid).toBe(true);
    });

    it('should flag invalid speed figures outside 0-130 range', () => {
      const mockHorse: HorseEntry = {
        horseName: 'TEST HORSE',
        trainerName: 'TEST TRAINER',
        turfStarts: 5,
        pastPerformances: [],
      } as HorseEntry;

      const mockFields = new Array(1500).fill('');
      mockFields[44] = 'TEST HORSE';
      mockFields[27] = 'TEST TRAINER';
      mockFields[765] = '250'; // Invalid - too high

      const result = validateParsedData(mockHorse, mockFields);

      expect(result.anchorPoints.pp1SpeedFigure.valid).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should flag too many past performances (max 12)', () => {
      const mockHorse: HorseEntry = {
        horseName: 'TEST HORSE',
        trainerName: 'TEST TRAINER',
        turfStarts: 5,
        pastPerformances: new Array(15).fill({}), // Too many!
      } as HorseEntry;

      const mockFields = new Array(1500).fill('');
      mockFields[44] = 'TEST HORSE';
      mockFields[27] = 'TEST TRAINER';

      const result = validateParsedData(mockHorse, mockFields);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Too many PPs'))).toBe(true);
    });
  });

  describe('Field Index Changes from v1.0 to v2.0', () => {
    it('should document all changed field indices', () => {
      // This test documents the changes from the old (wrong) to new (correct) indices
      const changes = [
        {
          field: 'DISTANCE_YARDS',
          oldIndex: 'was POST_TIME at 5',
          newIndex: 5,
          description: 'Field 6 is distance in yards, not post time',
        },
        {
          field: 'LIFETIME_STARTS',
          oldIndex: 61,
          newIndex: 64,
          description: 'Shifted by 3 for medication fields',
        },
        {
          field: 'LIFETIME_WINS',
          oldIndex: 62,
          newIndex: 65,
          description: 'Shifted by 3 for medication fields',
        },
        {
          field: 'LIFETIME_PLACES',
          oldIndex: 63,
          newIndex: 66,
          description: 'Shifted by 3 for medication fields',
        },
        {
          field: 'LIFETIME_SHOWS',
          oldIndex: 64,
          newIndex: 67,
          description: 'Shifted by 3 for medication fields',
        },
        {
          field: 'TURF_STARTS',
          oldIndex: 84,
          newIndex: 79,
          description: 'Moved to correct position (Field 80)',
        },
        {
          field: 'TRACK_STARTS',
          oldIndex: 79,
          newIndex: 96,
          description: 'Moved to correct position (Field 97)',
        },
        {
          field: 'PP_COUNT',
          oldValue: 10,
          newValue: 12,
          description: 'Changed from 10-PP to 12-PP format',
        },
        {
          field: 'WORKOUT_COUNT',
          oldValue: 10,
          newValue: 12,
          description: 'Changed from 10 to 12 workouts',
        },
      ];

      // Verify the new indices are correct
      expect(DRF_COLUMNS.DISTANCE_YARDS.index).toBe(5);
      expect(DRF_COLUMNS.LIFETIME_STARTS.index).toBe(64);
      expect(DRF_COLUMNS.LIFETIME_WINS.index).toBe(65);
      expect(DRF_COLUMNS.LIFETIME_PLACES.index).toBe(66);
      expect(DRF_COLUMNS.LIFETIME_SHOWS.index).toBe(67);
      expect(DRF_COLUMNS.TURF_STARTS.index).toBe(79);
      expect(DRF_COLUMNS.TRACK_STARTS.index).toBe(96);
      expect(DRF_COLUMNS.PP_COUNT).toBe(12);
      expect(DRF_COLUMNS.WORKOUT_COUNT).toBe(12);

      // This test serves as documentation
      expect(changes.length).toBe(9);
    });
  });

  describe('Parser Integration', () => {
    it('should parse an empty file gracefully', () => {
      const result = parseDRFFile('', 'test.drf');

      expect(result.isValid).toBe(false);
      expect(result.races.length).toBe(0);
    });

    it('should handle minimal CSV line', () => {
      // Create a minimal valid line with required fields
      const fields = new Array(1500).fill('');
      fields[0] = 'TST'; // Track code
      fields[1] = '20251226'; // Race date
      fields[2] = '1'; // Race number
      fields[3] = '1'; // Post position
      fields[5] = '1320'; // Distance in yards (6f)
      fields[6] = 'D'; // Surface
      fields[11] = '25000'; // Purse
      fields[23] = '8'; // Field size
      fields[27] = 'Smith John'; // Trainer name
      fields[32] = 'Jones Mike'; // Jockey name
      fields[44] = 'FAST HORSE'; // Horse name
      fields[45] = '4'; // Age
      fields[48] = 'G'; // Sex
      fields[50] = '122'; // Weight

      const csvLine = fields.join(',');
      const result = parseDRFFile(csvLine, 'test.drf');

      expect(result.races.length).toBe(1);
      expect(result.races[0]?.horses[0]?.horseName).toBe('FAST HORSE');
      expect(result.races[0]?.horses[0]?.trainerName).toBe('Smith John');
    });
  });
});
