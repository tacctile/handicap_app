/**
 * DRF Parser Tests
 * Tests file parsing, field extraction, and error handling
 */

import { describe, it, expect } from 'vitest';
import {
  parseDRFFile,
  createDefaultHorseEntry,
  createDefaultRaceHeader,
} from '../../../lib/drfParser';
import { readFileSync } from 'fs';
import { join } from 'path';

// Helper to load fixture files
function loadFixture(filename: string): string {
  const fixturePath = join(__dirname, '../../fixtures', filename);
  return readFileSync(fixturePath, 'utf-8');
}

describe('DRF Parser', () => {
  describe('Successful Parse', () => {
    it('returns expected structure for valid DRF file', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');

      expect(result).toBeDefined();
      expect(result.filename).toBe('sample.drf');
      expect(result.races).toBeInstanceOf(Array);
      expect(result.format).toBe('csv');
      expect(result.parsedAt).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it('extracts race header correctly', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');

      expect(result.races.length).toBeGreaterThan(0);

      const race = result.races[0];
      expect(race.header).toBeDefined();
      expect(race.header.trackCode).toBe('CD');
      expect(race.header.raceNumber).toBe(5);
      expect(race.header.surface).toBe('dirt');
    });

    it('extracts horse entries correctly', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const race = result.races[0];
      expect(race.horses.length).toBeGreaterThan(0);

      const horse = race.horses[0];
      expect(horse.horseName).toBeDefined();
      expect(horse.postPosition).toBeGreaterThan(0);
      expect(horse.morningLineOdds).toBeDefined();
    });

    it('parses multiple horses per race', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');

      const race = result.races[0];
      expect(race.horses.length).toBe(3); // sample.drf has 3 horses
    });

    it('sorts horses by post position', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');

      const horses = result.races[0].horses;
      for (let i = 1; i < horses.length; i++) {
        expect(horses[i].postPosition).toBeGreaterThanOrEqual(horses[i - 1].postPosition);
      }
    });
  });

  describe('Critical Field Extraction', () => {
    it('extracts trainer name', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');
      const horse = result.races[0].horses[0];

      expect(horse.trainerName).toBeDefined();
      expect(typeof horse.trainerName).toBe('string');
    });

    it('extracts jockey name', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');
      const horse = result.races[0].horses[0];

      expect(horse.jockeyName).toBeDefined();
      expect(typeof horse.jockeyName).toBe('string');
    });

    it('extracts post position', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');
      const horses = result.races[0].horses;

      horses.forEach((horse, i) => {
        expect(horse.postPosition).toBe(i + 1);
      });
    });

    it('extracts morning line odds', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');
      const horse = result.races[0].horses[0];

      expect(horse.morningLineOdds).toBeDefined();
      expect(horse.morningLineDecimal).toBeGreaterThan(0);
    });

    it('extracts distance and surface', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');
      const header = result.races[0].header;

      expect(header.distance).toBeDefined();
      expect(header.distanceFurlongs).toBeGreaterThan(0);
      expect(['dirt', 'turf', 'synthetic', 'all-weather']).toContain(header.surface);
    });

    it('extracts race classification', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');
      const header = result.races[0].header;

      expect(header.classification).toBeDefined();
    });

    it('extracts breeding information', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');
      const horse = result.races[0].horses[0];

      expect(horse.breeding).toBeDefined();
      expect(horse.breeding.sire).toBeDefined();
      expect(horse.breeding.dam).toBeDefined();
    });
  });

  describe('Malformed File Handling', () => {
    it('handles malformed CSV gracefully', () => {
      const content = loadFixture('malformed.drf');

      const result = parseDRFFile(content, 'malformed.drf');

      // Should not throw, should return result with warnings
      expect(result).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('reports lines skipped in stats', () => {
      const content = loadFixture('malformed.drf');

      const result = parseDRFFile(content, 'malformed.drf');

      expect(result.stats.linesSkipped).toBeGreaterThan(0);
    });
  });

  describe('Empty File Handling', () => {
    it('returns error for empty file', () => {
      const result = parseDRFFile('', 'empty.drf');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.races).toHaveLength(0);
    });

    it('returns error for whitespace-only file', () => {
      const result = parseDRFFile('   \n  \n   ', 'whitespace.drf');

      expect(result.isValid).toBe(false);
      expect(result.races).toHaveLength(0);
    });
  });

  describe('Encoding Issues', () => {
    it('handles special characters in names', () => {
      // Create content with special characters
      const content = `CD,20240215,5,1,,"Horse Niño",Smith,John,Jones,Bob,1320,6,D,ALW,3YO+,,75000,,FT,"Allowance",120,0,"5-1",B,L`;

      const result = parseDRFFile(content, 'special.drf');

      // Should parse without crashing
      expect(result).toBeDefined();
    });
  });

  describe('Parse Statistics', () => {
    it('tracks total races parsed', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');

      expect(result.stats.totalRaces).toBe(1);
    });

    it('tracks total horses parsed', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');

      expect(result.stats.totalHorses).toBe(3);
    });

    it('tracks parse time', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');

      expect(result.stats.parseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('tracks lines processed', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');

      expect(result.stats.linesProcessed).toBeGreaterThan(0);
    });
  });

  describe('Default Factories', () => {
    it('createDefaultHorseEntry returns valid structure', () => {
      const horse = createDefaultHorseEntry(0);

      expect(horse.programNumber).toBe(1);
      expect(horse.postPosition).toBe(1);
      expect(horse.horseName).toBeDefined();
      expect(horse.equipment).toBeDefined();
      expect(horse.medication).toBeDefined();
      expect(horse.breeding).toBeDefined();
      expect(horse.pastPerformances).toEqual([]);
      expect(horse.workouts).toEqual([]);
    });

    it('createDefaultRaceHeader returns valid structure', () => {
      const header = createDefaultRaceHeader();

      expect(header.trackCode).toBe('UNK');
      expect(header.raceNumber).toBe(1);
      expect(header.surface).toBe('dirt');
      expect(header.trackCondition).toBe('fast');
    });
  });

  describe('Format Detection', () => {
    it('detects CSV format', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');

      expect(result.format).toBe('csv');
    });

    it('detects fixed-width format', () => {
      // Create fixed-width content (no commas)
      const content = `CD  20240215 5 1 Fast Runner         Smith John   Jones Bob  1320`;

      const result = parseDRFFile(content, 'fixed.drf');

      expect(result.format).toBe('fixed-width');
    });
  });

  describe('Progress Callback', () => {
    it('calls progress callback during parsing', () => {
      const content = loadFixture('sample.drf');
      const progressCalls: { progress: number; step: string }[] = [];

      parseDRFFile(content, 'sample.drf', (msg) => {
        progressCalls.push({ progress: msg.progress, step: msg.step });
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].progress).toBe(0);
      expect(progressCalls[progressCalls.length - 1].progress).toBe(100);
    });

    it('reports initialization step', () => {
      const content = loadFixture('sample.drf');
      let hasInitStep = false;

      parseDRFFile(content, 'sample.drf', (msg) => {
        if (msg.step === 'initializing') hasInitStep = true;
      });

      expect(hasInitStep).toBe(true);
    });

    it('reports complete step', () => {
      const content = loadFixture('sample.drf');
      let hasCompleteStep = false;

      parseDRFFile(content, 'sample.drf', (msg) => {
        if (msg.step === 'complete') hasCompleteStep = true;
      });

      expect(hasCompleteStep).toBe(true);
    });
  });

  describe('Validation', () => {
    it('validates minimum horses per race', () => {
      // Single horse race should generate warning
      const content = `CD,20240215,5,1,,"Solo Horse",Smith,John,Jones,Bob,1320,6,D,ALW,3YO+,,75000,,FT,"Allowance",120,0,"5-1",B,L`;

      const result = parseDRFFile(content, 'single.drf');

      expect(result.warnings.some((w) => w.includes('horse'))).toBe(true);
    });

    it('reports isValid=true for good files', () => {
      const content = loadFixture('sample.drf');

      const result = parseDRFFile(content, 'sample.drf');

      expect(result.isValid).toBe(true);
    });

    it('reports isValid=false for problem files', () => {
      const result = parseDRFFile('', 'empty.drf');

      expect(result.isValid).toBe(false);
    });
  });

  describe('Binary File Detection', () => {
    it('rejects binary content', () => {
      // Create binary-like content
      const binaryContent = String.fromCharCode(0x89, 0x50, 0x4e, 0x47) + 'rest of png';

      const result = parseDRFFile(binaryContent, 'fake.png');

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('binary'))).toBe(true);
    });
  });

  describe('Distance/Surface/Turf Records Parsing (Fields 85-96)', () => {
    // Helper to create DRF content with enough fields for turf/wet/distance records
    // Fields are 0-indexed in the array but 1-indexed in DRF spec
    // Fields 85-88: Turf (starts, wins, places, shows) -> indices 84-87
    // Fields 89-92: Wet (starts, wins, places, shows) -> indices 88-91
    // Fields 93-96: Distance (starts, wins, places, shows) -> indices 92-95
    function createDRFWithSurfaceRecords(
      turf: [number, number, number, number],
      wet: [number, number, number, number],
      distance: [number, number, number, number]
    ): string {
      // Build array with 100 fields (enough to cover indices 0-95)
      const fields = new Array(100).fill('');

      // Race header fields
      fields[0] = 'CD'; // Track code
      fields[1] = '20240215'; // Race date
      fields[2] = '5'; // Race number
      fields[3] = '1'; // Post position
      fields[5] = '14:30'; // Post time
      fields[6] = 'D'; // Surface
      fields[11] = '75000'; // Purse
      fields[14] = '6'; // Distance furlongs
      fields[23] = '8'; // Field size

      // Horse identification
      fields[27] = 'Test Trainer'; // Trainer name
      fields[32] = 'Test Jockey'; // Jockey name
      fields[43] = '5-1'; // Morning line
      fields[44] = 'Test Horse'; // Horse name
      fields[45] = '4'; // Age
      fields[48] = 'c'; // Sex

      // Lifetime stats (fields 62-65)
      fields[61] = '20'; // Lifetime starts
      fields[62] = '5'; // Lifetime wins
      fields[63] = '4'; // Lifetime places
      fields[64] = '3'; // Lifetime shows

      // Track-specific stats (fields 80-83)
      fields[79] = '8'; // Track starts
      fields[80] = '2'; // Track wins
      fields[81] = '1'; // Track places
      fields[82] = '2'; // Track shows

      // Turf record (fields 85-88, indices 84-87)
      fields[84] = String(turf[0]); // Turf starts
      fields[85] = String(turf[1]); // Turf wins
      fields[86] = String(turf[2]); // Turf places
      fields[87] = String(turf[3]); // Turf shows

      // Wet track record (fields 89-92, indices 88-91)
      fields[88] = String(wet[0]); // Wet starts
      fields[89] = String(wet[1]); // Wet wins
      fields[90] = String(wet[2]); // Wet places
      fields[91] = String(wet[3]); // Wet shows

      // Distance record (fields 93-96, indices 92-95)
      fields[92] = String(distance[0]); // Distance starts
      fields[93] = String(distance[1]); // Distance wins
      fields[94] = String(distance[2]); // Distance places
      fields[95] = String(distance[3]); // Distance shows

      return fields.join(',');
    }

    it('parses turf record correctly from valid DRF data', () => {
      const content = createDRFWithSurfaceRecords([12, 4, 3, 2], [0, 0, 0, 0], [0, 0, 0, 0]);

      const result = parseDRFFile(content, 'turf-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      expect(horse.turfStarts).toBe(12);
      expect(horse.turfWins).toBe(4);
      expect(horse.turfPlaces).toBe(3);
      expect(horse.turfShows).toBe(2);
    });

    it('parses wet track record correctly from valid DRF data', () => {
      const content = createDRFWithSurfaceRecords([0, 0, 0, 0], [8, 2, 3, 1], [0, 0, 0, 0]);

      const result = parseDRFFile(content, 'wet-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      expect(horse.wetStarts).toBe(8);
      expect(horse.wetWins).toBe(2);
      expect(horse.wetPlaces).toBe(3);
      expect(horse.wetShows).toBe(1);
    });

    it('parses distance record correctly from valid DRF data', () => {
      const content = createDRFWithSurfaceRecords([0, 0, 0, 0], [0, 0, 0, 0], [15, 5, 4, 3]);

      const result = parseDRFFile(content, 'distance-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      expect(horse.distanceStarts).toBe(15);
      expect(horse.distanceWins).toBe(5);
      expect(horse.distancePlaces).toBe(4);
      expect(horse.distanceShows).toBe(3);
    });

    it('parses all surface records together correctly', () => {
      const content = createDRFWithSurfaceRecords([10, 3, 2, 1], [6, 2, 1, 1], [8, 3, 2, 2]);

      const result = parseDRFFile(content, 'all-surfaces.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // Turf
      expect(horse.turfStarts).toBe(10);
      expect(horse.turfWins).toBe(3);
      expect(horse.turfPlaces).toBe(2);
      expect(horse.turfShows).toBe(1);

      // Wet
      expect(horse.wetStarts).toBe(6);
      expect(horse.wetWins).toBe(2);
      expect(horse.wetPlaces).toBe(1);
      expect(horse.wetShows).toBe(1);

      // Distance
      expect(horse.distanceStarts).toBe(8);
      expect(horse.distanceWins).toBe(3);
      expect(horse.distancePlaces).toBe(2);
      expect(horse.distanceShows).toBe(2);
    });

    it('defaults missing turf/wet/distance fields to 0', () => {
      // Create content with fewer fields (not reaching indices 84-95)
      const shortContent = 'CD,20240215,5,1,,"Test Horse",Trainer,Jockey,120';

      const result = parseDRFFile(shortContent, 'short.drf');

      // Even with short content, we should get defaults
      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // All should default to 0
      expect(horse.turfStarts).toBe(0);
      expect(horse.turfWins).toBe(0);
      expect(horse.turfPlaces).toBe(0);
      expect(horse.turfShows).toBe(0);

      expect(horse.wetStarts).toBe(0);
      expect(horse.wetWins).toBe(0);
      expect(horse.wetPlaces).toBe(0);
      expect(horse.wetShows).toBe(0);

      expect(horse.distanceStarts).toBe(0);
      expect(horse.distanceWins).toBe(0);
      expect(horse.distancePlaces).toBe(0);
      expect(horse.distanceShows).toBe(0);
    });

    it('handles invalid (non-numeric) values gracefully by defaulting to 0', () => {
      // Create content with invalid values at the turf/wet/distance positions
      const fields = new Array(100).fill('');
      fields[0] = 'CD';
      fields[1] = '20240215';
      fields[2] = '5';
      fields[3] = '1';
      fields[44] = 'Test Horse';
      fields[27] = 'Trainer';
      fields[32] = 'Jockey';

      // Invalid values for turf (indices 84-87)
      fields[84] = 'abc'; // Invalid
      fields[85] = 'xyz'; // Invalid
      fields[86] = ''; // Empty
      fields[87] = 'NaN'; // Invalid

      const content = fields.join(',');
      const result = parseDRFFile(content, 'invalid-values.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // All should default to 0 since values are invalid
      expect(horse.turfStarts).toBe(0);
      expect(horse.turfWins).toBe(0);
      expect(horse.turfPlaces).toBe(0);
      expect(horse.turfShows).toBe(0);
    });

    it('handles empty string fields by defaulting to 0', () => {
      // Create content where turf/wet/distance fields are empty strings
      const fields = new Array(100).fill('');
      fields[0] = 'CD';
      fields[1] = '20240215';
      fields[2] = '5';
      fields[3] = '1';
      fields[44] = 'Empty Stats Horse';
      fields[27] = 'Trainer';
      fields[32] = 'Jockey';

      // Fields 84-95 are already empty strings (from fill(''))

      const content = fields.join(',');
      const result = parseDRFFile(content, 'empty-fields.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      expect(horse.turfStarts).toBe(0);
      expect(horse.wetStarts).toBe(0);
      expect(horse.distanceStarts).toBe(0);
    });

    it('createDefaultHorseEntry includes turf/wet/distance fields with defaults', () => {
      const defaultHorse = createDefaultHorseEntry(0);

      // Verify all new fields exist and are 0
      expect(defaultHorse.turfStarts).toBe(0);
      expect(defaultHorse.turfWins).toBe(0);
      expect(defaultHorse.turfPlaces).toBe(0);
      expect(defaultHorse.turfShows).toBe(0);

      expect(defaultHorse.wetStarts).toBe(0);
      expect(defaultHorse.wetWins).toBe(0);
      expect(defaultHorse.wetPlaces).toBe(0);
      expect(defaultHorse.wetShows).toBe(0);

      expect(defaultHorse.distanceStarts).toBe(0);
      expect(defaultHorse.distanceWins).toBe(0);
      expect(defaultHorse.distancePlaces).toBe(0);
      expect(defaultHorse.distanceShows).toBe(0);
    });
  });

  describe('Trainer Category Statistics Parsing (Fields 1146-1221)', () => {
    // Helper to create DRF content with trainer category stats
    // Fields 1146-1221 = indices 1145-1220 (0-based)
    // Each category has 4 fields: starts, wins, win%, ROI
    function createDRFWithTrainerStats(categories: {
      firstTimeLasix?: [number, number, number, number];
      secondOffLayoff?: [number, number, number, number];
      turfSprint?: [number, number, number, number];
      firstTimeBlinkers?: [number, number, number, number];
      firstStartForTrainer?: [number, number, number, number];
    }): string {
      // Build array with 1222 fields (enough to cover indices 0-1221)
      const fields = new Array(1222).fill('');

      // Race header fields
      fields[0] = 'CD'; // Track code
      fields[1] = '20240215'; // Race date
      fields[2] = '5'; // Race number
      fields[3] = '1'; // Post position
      fields[5] = '14:30'; // Post time
      fields[6] = 'D'; // Surface
      fields[11] = '75000'; // Purse
      fields[14] = '6'; // Distance furlongs
      fields[23] = '8'; // Field size

      // Horse identification
      fields[27] = 'Bob Baffert'; // Trainer name
      fields[32] = 'Irad Ortiz Jr'; // Jockey name
      fields[43] = '5-1'; // Morning line
      fields[44] = 'Champion Horse'; // Horse name
      fields[45] = '4'; // Age
      fields[48] = 'c'; // Sex

      // Set trainer category stats if provided
      // First Time Lasix - Fields 1146-1149 (indices 1145-1148)
      if (categories.firstTimeLasix) {
        fields[1145] = String(categories.firstTimeLasix[0]); // Starts
        fields[1146] = String(categories.firstTimeLasix[1]); // Wins
        fields[1147] = String(categories.firstTimeLasix[2]); // Win%
        fields[1148] = String(categories.firstTimeLasix[3]); // ROI
      }

      // 2nd Off Layoff - Fields 1150-1153 (indices 1149-1152)
      if (categories.secondOffLayoff) {
        fields[1149] = String(categories.secondOffLayoff[0]);
        fields[1150] = String(categories.secondOffLayoff[1]);
        fields[1151] = String(categories.secondOffLayoff[2]);
        fields[1152] = String(categories.secondOffLayoff[3]);
      }

      // Turf Sprint - Fields 1158-1161 (indices 1157-1160)
      if (categories.turfSprint) {
        fields[1157] = String(categories.turfSprint[0]);
        fields[1158] = String(categories.turfSprint[1]);
        fields[1159] = String(categories.turfSprint[2]);
        fields[1160] = String(categories.turfSprint[3]);
      }

      // First Time Blinkers - Fields 1166-1169 (indices 1165-1168)
      if (categories.firstTimeBlinkers) {
        fields[1165] = String(categories.firstTimeBlinkers[0]);
        fields[1166] = String(categories.firstTimeBlinkers[1]);
        fields[1167] = String(categories.firstTimeBlinkers[2]);
        fields[1168] = String(categories.firstTimeBlinkers[3]);
      }

      // First Start for Trainer - Fields 1186-1189 (indices 1185-1188)
      if (categories.firstStartForTrainer) {
        fields[1185] = String(categories.firstStartForTrainer[0]);
        fields[1186] = String(categories.firstStartForTrainer[1]);
        fields[1187] = String(categories.firstStartForTrainer[2]);
        fields[1188] = String(categories.firstStartForTrainer[3]);
      }

      return fields.join(',');
    }

    it('parses first time Lasix trainer stats correctly', () => {
      const content = createDRFWithTrainerStats({
        firstTimeLasix: [25, 7, 28.0, 145.5],
      });

      const result = parseDRFFile(content, 'trainer-lasix.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      expect(horse.trainerCategoryStats.firstTimeLasix.starts).toBe(25);
      expect(horse.trainerCategoryStats.firstTimeLasix.wins).toBe(7);
      expect(horse.trainerCategoryStats.firstTimeLasix.winPercent).toBe(28.0);
      expect(horse.trainerCategoryStats.firstTimeLasix.roi).toBe(145.5);
    });

    it('parses 2nd off layoff trainer stats correctly', () => {
      const content = createDRFWithTrainerStats({
        secondOffLayoff: [40, 10, 25.0, 112.0],
      });

      const result = parseDRFFile(content, 'trainer-layoff.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      expect(horse.trainerCategoryStats.secondOffLayoff.starts).toBe(40);
      expect(horse.trainerCategoryStats.secondOffLayoff.wins).toBe(10);
      expect(horse.trainerCategoryStats.secondOffLayoff.winPercent).toBe(25.0);
      expect(horse.trainerCategoryStats.secondOffLayoff.roi).toBe(112.0);
    });

    it('parses turf sprint trainer stats correctly', () => {
      const content = createDRFWithTrainerStats({
        turfSprint: [18, 5, 27.8, 188.2],
      });

      const result = parseDRFFile(content, 'trainer-turf-sprint.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      expect(horse.trainerCategoryStats.turfSprint.starts).toBe(18);
      expect(horse.trainerCategoryStats.turfSprint.wins).toBe(5);
      expect(horse.trainerCategoryStats.turfSprint.winPercent).toBeCloseTo(27.8, 1);
      expect(horse.trainerCategoryStats.turfSprint.roi).toBeCloseTo(188.2, 1);
    });

    it('parses first time blinkers trainer stats correctly', () => {
      const content = createDRFWithTrainerStats({
        firstTimeBlinkers: [32, 8, 25.0, 95.5],
      });

      const result = parseDRFFile(content, 'trainer-blinkers.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      expect(horse.trainerCategoryStats.firstTimeBlinkers.starts).toBe(32);
      expect(horse.trainerCategoryStats.firstTimeBlinkers.wins).toBe(8);
      expect(horse.trainerCategoryStats.firstTimeBlinkers.winPercent).toBe(25.0);
      expect(horse.trainerCategoryStats.firstTimeBlinkers.roi).toBe(95.5);
    });

    it('parses first start for trainer stats correctly', () => {
      const content = createDRFWithTrainerStats({
        firstStartForTrainer: [55, 12, 21.8, 125.0],
      });

      const result = parseDRFFile(content, 'trainer-new-barn.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      expect(horse.trainerCategoryStats.firstStartForTrainer.starts).toBe(55);
      expect(horse.trainerCategoryStats.firstStartForTrainer.wins).toBe(12);
      expect(horse.trainerCategoryStats.firstStartForTrainer.winPercent).toBeCloseTo(21.8, 1);
      expect(horse.trainerCategoryStats.firstStartForTrainer.roi).toBe(125.0);
    });

    it('parses multiple trainer categories together correctly', () => {
      const content = createDRFWithTrainerStats({
        firstTimeLasix: [20, 5, 25.0, 110.0],
        secondOffLayoff: [30, 8, 26.7, 130.0],
        turfSprint: [15, 4, 26.7, 150.0],
        firstTimeBlinkers: [25, 6, 24.0, 100.0],
        firstStartForTrainer: [45, 10, 22.2, 115.0],
      });

      const result = parseDRFFile(content, 'trainer-multi.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // First Time Lasix
      expect(horse.trainerCategoryStats.firstTimeLasix.starts).toBe(20);
      expect(horse.trainerCategoryStats.firstTimeLasix.wins).toBe(5);

      // 2nd Off Layoff
      expect(horse.trainerCategoryStats.secondOffLayoff.starts).toBe(30);
      expect(horse.trainerCategoryStats.secondOffLayoff.wins).toBe(8);

      // Turf Sprint
      expect(horse.trainerCategoryStats.turfSprint.starts).toBe(15);
      expect(horse.trainerCategoryStats.turfSprint.wins).toBe(4);

      // First Time Blinkers
      expect(horse.trainerCategoryStats.firstTimeBlinkers.starts).toBe(25);
      expect(horse.trainerCategoryStats.firstTimeBlinkers.wins).toBe(6);

      // First Start for Trainer
      expect(horse.trainerCategoryStats.firstStartForTrainer.starts).toBe(45);
      expect(horse.trainerCategoryStats.firstStartForTrainer.wins).toBe(10);
    });

    it('defaults missing trainer category fields to zeros', () => {
      // Create content with fewer fields (not reaching indices 1145+)
      const shortContent = 'CD,20240215,5,1,,"Test Horse",Trainer,Jockey,120';

      const result = parseDRFFile(shortContent, 'short-trainer.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // All trainer category stats should default to 0
      expect(horse.trainerCategoryStats.firstTimeLasix.starts).toBe(0);
      expect(horse.trainerCategoryStats.firstTimeLasix.wins).toBe(0);
      expect(horse.trainerCategoryStats.firstTimeLasix.winPercent).toBe(0);
      expect(horse.trainerCategoryStats.firstTimeLasix.roi).toBe(0);

      expect(horse.trainerCategoryStats.secondOffLayoff.starts).toBe(0);
      expect(horse.trainerCategoryStats.turfSprint.starts).toBe(0);
      expect(horse.trainerCategoryStats.firstTimeBlinkers.starts).toBe(0);
      expect(horse.trainerCategoryStats.firstStartForTrainer.starts).toBe(0);
    });

    it('handles invalid (non-numeric) trainer stat values gracefully', () => {
      const fields = new Array(1222).fill('');
      fields[0] = 'CD';
      fields[1] = '20240215';
      fields[2] = '5';
      fields[3] = '1';
      fields[44] = 'Test Horse';
      fields[27] = 'Trainer';
      fields[32] = 'Jockey';

      // Invalid values for first time Lasix (indices 1145-1148)
      fields[1145] = 'abc'; // Invalid starts
      fields[1146] = 'xyz'; // Invalid wins
      fields[1147] = 'bad'; // Invalid win%
      fields[1148] = 'NaN'; // Invalid ROI

      const content = fields.join(',');
      const result = parseDRFFile(content, 'invalid-trainer.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // All should default to 0 since values are invalid
      expect(horse.trainerCategoryStats.firstTimeLasix.starts).toBe(0);
      expect(horse.trainerCategoryStats.firstTimeLasix.wins).toBe(0);
      expect(horse.trainerCategoryStats.firstTimeLasix.winPercent).toBe(0);
      expect(horse.trainerCategoryStats.firstTimeLasix.roi).toBe(0);
    });

    it('handles win percentage > 100 gracefully (caps at 100)', () => {
      const fields = new Array(1222).fill('');
      fields[0] = 'CD';
      fields[1] = '20240215';
      fields[2] = '5';
      fields[3] = '1';
      fields[44] = 'Test Horse';
      fields[27] = 'Trainer';
      fields[32] = 'Jockey';

      // Win percentage > 100 (invalid)
      fields[1145] = '10'; // Starts
      fields[1146] = '5'; // Wins
      fields[1147] = '150'; // Invalid win% > 100
      fields[1148] = '100'; // ROI

      const content = fields.join(',');
      const result = parseDRFFile(content, 'high-winpct.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // Win percent should be capped at 100
      expect(horse.trainerCategoryStats.firstTimeLasix.winPercent).toBe(100);
    });

    it('handles negative win percentage gracefully (returns 0)', () => {
      const fields = new Array(1222).fill('');
      fields[0] = 'CD';
      fields[1] = '20240215';
      fields[2] = '5';
      fields[3] = '1';
      fields[44] = 'Test Horse';
      fields[27] = 'Trainer';
      fields[32] = 'Jockey';

      // Negative win percentage (invalid)
      fields[1145] = '10'; // Starts
      fields[1146] = '5'; // Wins
      fields[1147] = '-10'; // Invalid negative win%
      fields[1148] = '100'; // ROI

      const content = fields.join(',');
      const result = parseDRFFile(content, 'negative-winpct.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // Negative win percent should default to 0
      expect(horse.trainerCategoryStats.firstTimeLasix.winPercent).toBe(0);
    });

    it('accepts extreme ROI values (positive and negative)', () => {
      const fields = new Array(1222).fill('');
      fields[0] = 'CD';
      fields[1] = '20240215';
      fields[2] = '5';
      fields[3] = '1';
      fields[44] = 'Test Horse';
      fields[27] = 'Trainer';
      fields[32] = 'Jockey';

      // Extreme ROI values (valid but unusual)
      fields[1145] = '5'; // Starts
      fields[1146] = '3'; // Wins
      fields[1147] = '60'; // Win%
      fields[1148] = '750'; // Very high ROI (small sample)

      // Negative ROI
      fields[1149] = '20'; // 2nd layoff starts
      fields[1150] = '0'; // 2nd layoff wins
      fields[1151] = '0'; // 2nd layoff win%
      fields[1152] = '-100'; // Worst possible ROI

      const content = fields.join(',');
      const result = parseDRFFile(content, 'extreme-roi.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // Should accept extreme values
      expect(horse.trainerCategoryStats.firstTimeLasix.roi).toBe(750);
      expect(horse.trainerCategoryStats.secondOffLayoff.roi).toBe(-100);
    });

    it('createDefaultHorseEntry includes trainerCategoryStats with all zeros', () => {
      const defaultHorse = createDefaultHorseEntry(0);

      // Verify trainerCategoryStats exists and all categories default to zeros
      expect(defaultHorse.trainerCategoryStats).toBeDefined();
      expect(defaultHorse.trainerCategoryStats.firstTimeLasix.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.firstTimeLasix.wins).toBe(0);
      expect(defaultHorse.trainerCategoryStats.firstTimeLasix.winPercent).toBe(0);
      expect(defaultHorse.trainerCategoryStats.firstTimeLasix.roi).toBe(0);

      expect(defaultHorse.trainerCategoryStats.secondOffLayoff.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.days31to60.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.turfSprint.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.turfRoute.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.firstTimeBlinkers.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.blinkersOff.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.sprintToRoute.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.routeToSprint.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.maidenClaiming.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.firstStartForTrainer.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.afterClaim.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.days61to90.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.days91to180.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.days181plus.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.dirtSprints.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.dirtRoutes.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.wetTracks.starts).toBe(0);
      expect(defaultHorse.trainerCategoryStats.stakesRaces.starts).toBe(0);
    });
  });
});
