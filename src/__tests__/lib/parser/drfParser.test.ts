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
});
