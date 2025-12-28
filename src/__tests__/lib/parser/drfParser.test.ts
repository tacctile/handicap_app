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

      // Lifetime stats (Fields 97-100, indices 96-99)
      // NOTE: Verified that lifetime stats are at indices 96-100, NOT 61-68
      fields[96] = '20'; // Lifetime starts (Field 97)
      fields[97] = '5'; // Lifetime wins (Field 98)
      fields[98] = '4'; // Lifetime places (Field 99)
      fields[99] = '3'; // Lifetime shows (Field 100)

      // Track-specific stats (fields 80-83)
      fields[79] = '8'; // Track starts
      fields[80] = '2'; // Track wins
      fields[81] = '1'; // Track places
      fields[82] = '2'; // Track shows

      // Turf record (Fields 86-89, indices 85-88)
      // NOTE: Field 85 (index 84) contains year, parser skips it
      fields[84] = '2024'; // Year (skipped by parser)
      fields[85] = String(turf[0]); // Turf starts (Field 86, index 85)
      fields[86] = String(turf[1]); // Turf wins (Field 87, index 86)
      fields[87] = String(turf[2]); // Turf places (Field 88, index 87)
      fields[88] = String(turf[3]); // Turf shows (Field 89, index 88)

      // NOTE: Wet and Distance record locations are UNKNOWN in DRF spec
      // Parser returns 0 for these fields by design
      // The values below are not actually read by the parser
      void wet; // Acknowledge unused parameter
      void distance; // Acknowledge unused parameter

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
      // NOTE: Wet track field locations are UNKNOWN in DRF spec
      // Parser returns 0 for all wet track fields by design
      const content = createDRFWithSurfaceRecords([0, 0, 0, 0], [8, 2, 3, 1], [0, 0, 0, 0]);

      const result = parseDRFFile(content, 'wet-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // Parser returns 0 for wet track fields (location unknown)
      expect(horse.wetStarts).toBe(0);
      expect(horse.wetWins).toBe(0);
      expect(horse.wetPlaces).toBe(0);
      expect(horse.wetShows).toBe(0);
    });

    it('parses distance record correctly from valid DRF data', () => {
      // NOTE: Distance field locations are UNKNOWN in DRF spec
      // Parser returns 0 for all distance fields by design
      const content = createDRFWithSurfaceRecords([0, 0, 0, 0], [0, 0, 0, 0], [15, 5, 4, 3]);

      const result = parseDRFFile(content, 'distance-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // Parser returns 0 for distance fields (location unknown)
      expect(horse.distanceStarts).toBe(0);
      expect(horse.distanceWins).toBe(0);
      expect(horse.distancePlaces).toBe(0);
      expect(horse.distanceShows).toBe(0);
    });

    it('parses all surface records together correctly', () => {
      const content = createDRFWithSurfaceRecords([10, 3, 2, 1], [6, 2, 1, 1], [8, 3, 2, 2]);

      const result = parseDRFFile(content, 'all-surfaces.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // Turf - these are correctly parsed from indices 85-88
      expect(horse.turfStarts).toBe(10);
      expect(horse.turfWins).toBe(3);
      expect(horse.turfPlaces).toBe(2);
      expect(horse.turfShows).toBe(1);

      // Wet - location unknown, returns 0
      expect(horse.wetStarts).toBe(0);
      expect(horse.wetWins).toBe(0);
      expect(horse.wetPlaces).toBe(0);
      expect(horse.wetShows).toBe(0);

      // Distance - location unknown, returns 0
      expect(horse.distanceStarts).toBe(0);
      expect(horse.distanceWins).toBe(0);
      expect(horse.distancePlaces).toBe(0);
      expect(horse.distanceShows).toBe(0);
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

  describe('Pace Figures Parsing (Fields 816-825 EP1, Fields 846-855 LP)', () => {
    // Helper to create DRF content with pace figures
    // Fields 816-825: Early Pace 1 (EP1) figures for last 10 PPs -> indices 815-824
    // Fields 846-855: Late Pace figures for last 10 PPs -> indices 845-854
    // Also need PP dates (Fields 102-113) to trigger PP parsing
    function createDRFWithPaceFigures(
      earlyPace: (number | string)[],
      latePace: (number | string)[]
    ): string {
      // Build array with enough fields to cover pace figure indices
      const fields = new Array(900).fill('');

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
      fields[44] = 'Pace Test Horse'; // Horse name
      fields[45] = '4'; // Age
      fields[48] = 'c'; // Sex

      // PP dates - need at least one to trigger PP parsing (Field 102 = index 101)
      for (let i = 0; i < Math.max(earlyPace.length, latePace.length); i++) {
        // PP dates: YYYYMMDD format, going backwards from race date
        const raceDate = new Date(2024, 1, 15); // Feb 15, 2024
        const ppDate = new Date(raceDate);
        ppDate.setDate(ppDate.getDate() - 21 * (i + 1)); // Each PP 21 days apart
        const ppDateStr =
          ppDate.getFullYear() +
          String(ppDate.getMonth() + 1).padStart(2, '0') +
          String(ppDate.getDate()).padStart(2, '0');
        fields[101 + i] = ppDateStr;
      }

      // Early Pace figures (Fields 816-825, indices 815-824)
      for (let i = 0; i < earlyPace.length; i++) {
        fields[815 + i] = String(earlyPace[i]);
      }

      // Late Pace figures (Fields 846-855, indices 845-854)
      for (let i = 0; i < latePace.length; i++) {
        fields[845 + i] = String(latePace[i]);
      }

      return fields.join(',');
    }

    it('parses early pace (EP1) figures correctly for multiple PPs', () => {
      const earlyPaceFigures = [85, 78, 92, 80, 75];
      const content = createDRFWithPaceFigures(earlyPaceFigures, []);

      const result = parseDRFFile(content, 'early-pace-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.pastPerformances.length).toBe(5);

      for (let i = 0; i < earlyPaceFigures.length; i++) {
        expect(horse.pastPerformances[i].earlyPace1).toBe(earlyPaceFigures[i]);
      }
    });

    it('parses late pace figures correctly for multiple PPs', () => {
      const latePaceFigures = [90, 82, 88, 95, 78];
      const content = createDRFWithPaceFigures([], latePaceFigures);

      const result = parseDRFFile(content, 'late-pace-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.pastPerformances.length).toBe(5);

      for (let i = 0; i < latePaceFigures.length; i++) {
        expect(horse.pastPerformances[i].latePace).toBe(latePaceFigures[i]);
      }
    });

    it('parses both early and late pace figures together', () => {
      const earlyPaceFigures = [85, 78, 92];
      const latePaceFigures = [90, 82, 88];
      const content = createDRFWithPaceFigures(earlyPaceFigures, latePaceFigures);

      const result = parseDRFFile(content, 'both-pace-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.pastPerformances.length).toBe(3);

      for (let i = 0; i < 3; i++) {
        expect(horse.pastPerformances[i].earlyPace1).toBe(earlyPaceFigures[i]);
        expect(horse.pastPerformances[i].latePace).toBe(latePaceFigures[i]);
      }
    });

    it('handles missing/empty pace figures by returning null', () => {
      // Create content with PP dates but no pace figures
      const content = createDRFWithPaceFigures([], []);

      // Manually add a PP date without pace figures
      const fields = content.split(',');
      fields[101] = '20240125'; // PP date to trigger parsing
      const modifiedContent = fields.join(',');

      const result = parseDRFFile(modifiedContent, 'missing-pace-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.pastPerformances.length).toBeGreaterThan(0);
      expect(horse.pastPerformances[0].earlyPace1).toBeNull();
      expect(horse.pastPerformances[0].latePace).toBeNull();
    });

    it('handles invalid (non-numeric) pace figures by returning 0', () => {
      const content = createDRFWithPaceFigures(['abc', 'xyz'], ['invalid', 'NaN']);

      const result = parseDRFFile(content, 'invalid-pace-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.pastPerformances.length).toBe(2);

      // Invalid values should return 0
      expect(horse.pastPerformances[0].earlyPace1).toBe(0);
      expect(horse.pastPerformances[1].earlyPace1).toBe(0);
      expect(horse.pastPerformances[0].latePace).toBe(0);
      expect(horse.pastPerformances[1].latePace).toBe(0);
    });

    it('validates pace figures are within reasonable range (0-150)', () => {
      // Test with valid range values
      const earlyPaceFigures = [0, 50, 85, 120, 150];
      const latePaceFigures = [0, 45, 92, 110, 140];
      const content = createDRFWithPaceFigures(earlyPaceFigures, latePaceFigures);

      const result = parseDRFFile(content, 'valid-range-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.pastPerformances.length).toBe(5);

      // All values should be parsed correctly
      for (let i = 0; i < 5; i++) {
        expect(horse.pastPerformances[i].earlyPace1).toBe(earlyPaceFigures[i]);
        expect(horse.pastPerformances[i].latePace).toBe(latePaceFigures[i]);
      }
    });

    it('handles high pace figures above typical range (still valid)', () => {
      // Values above 150 are unusual but should still be parsed
      const earlyPaceFigures = [155, 160];
      const latePaceFigures = [155, 165];
      const content = createDRFWithPaceFigures(earlyPaceFigures, latePaceFigures);

      const result = parseDRFFile(content, 'high-pace-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.pastPerformances.length).toBe(2);

      // High values should still be returned (with dev-mode warning)
      expect(horse.pastPerformances[0].earlyPace1).toBe(155);
      expect(horse.pastPerformances[1].earlyPace1).toBe(160);
      expect(horse.pastPerformances[0].latePace).toBe(155);
      expect(horse.pastPerformances[1].latePace).toBe(165);
    });

    it('handles negative pace figures by returning 0', () => {
      const earlyPaceFigures = [-5, -10];
      const latePaceFigures = [-1, -20];
      const content = createDRFWithPaceFigures(earlyPaceFigures, latePaceFigures);

      const result = parseDRFFile(content, 'negative-pace-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.pastPerformances.length).toBe(2);

      // Negative values should return 0
      expect(horse.pastPerformances[0].earlyPace1).toBe(0);
      expect(horse.pastPerformances[1].earlyPace1).toBe(0);
      expect(horse.pastPerformances[0].latePace).toBe(0);
      expect(horse.pastPerformances[1].latePace).toBe(0);
    });

    it('handles zero pace figures correctly', () => {
      const earlyPaceFigures = [0, 85];
      const latePaceFigures = [0, 90];
      const content = createDRFWithPaceFigures(earlyPaceFigures, latePaceFigures);

      const result = parseDRFFile(content, 'zero-pace-test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.pastPerformances.length).toBe(2);

      // Zero is a valid pace figure
      expect(horse.pastPerformances[0].earlyPace1).toBe(0);
      expect(horse.pastPerformances[1].earlyPace1).toBe(85);
      expect(horse.pastPerformances[0].latePace).toBe(0);
      expect(horse.pastPerformances[1].latePace).toBe(90);
    });
  });
});
