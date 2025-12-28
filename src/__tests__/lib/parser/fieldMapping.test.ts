/**
 * Field Mapping Tests
 *
 * Tests that verify correct field extraction from DRF files
 * based on the official DRF_FIELD_MAP.md specification.
 *
 * These tests use a fixture with known values at specific field positions
 * to verify that the parser extracts data from the correct indices.
 */

import { describe, it, expect } from 'vitest';
import { parseDRFFile, parseOdds } from '../../../lib/drfParser';

/**
 * Create a DRF row with specific values at specific indices
 * This allows testing exact field positions
 */
function createDRFRow(fieldValues: Record<number, string>): string {
  // DRF files can have 1,435 fields - create an array with enough fields
  const fields: string[] = new Array(1500).fill('');

  // Set the values at specific indices
  for (const [index, value] of Object.entries(fieldValues)) {
    fields[parseInt(index, 10)] = value;
  }

  return fields.map((f) => (f.includes(',') || f.includes('"') ? `"${f}"` : f)).join(',');
}

describe('DRF Field Mapping - Core Horse Data', () => {
  describe('Horse Name (Field 45, Index 44)', () => {
    it('extracts horse name from correct index', () => {
      const row = createDRFRow({
        0: 'CD', // Track Code (Field 1)
        1: '20240815', // Race Date (Field 2)
        2: '5', // Race Number (Field 3)
        3: '1', // Post Position (Field 4)
        44: 'Secretariat', // Horse Name (Field 45)
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.horseName).toBe('Secretariat');
    });
  });

  describe('Jockey Name (Field 33, Index 32)', () => {
    it('extracts jockey name from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        32: 'John Velazquez', // Jockey Name (Field 33)
        44: 'Test Horse',
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.jockeyName).toBe('John Velazquez');
    });
  });

  describe('Trainer Name (Field 28, Index 27)', () => {
    it('extracts trainer name from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        27: 'Bob Baffert', // Trainer Name (Field 28)
        44: 'Test Horse',
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.trainerName).toBe('Bob Baffert');
    });
  });

  describe('Owner Name (Field 39, Index 38)', () => {
    it('extracts owner name from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        38: 'Juddmonte Farms', // Owner Name (Field 39)
        44: 'Test Horse',
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.owner).toBe('Juddmonte Farms');
    });
  });

  describe('Program Number (Field 43, Index 42)', () => {
    it('extracts program number from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        42: '7', // Program Number (Field 43)
        44: 'Test Horse',
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.programNumber).toBe(7);
    });
  });

  describe('Morning Line Odds (Field 44, Index 43)', () => {
    it('extracts morning line from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        43: '5-1', // Morning Line Odds (Field 44)
        44: 'Test Horse',
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.morningLineOdds).toBe('5-1');
      expect(horse.morningLineDecimal).toBe(5);
    });

    it('does NOT conflict with Current Year Earnings (Field 74, Index 73)', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        43: '3-1', // Morning Line Odds (Field 44) - NOT earnings!
        44: 'Test Horse',
        73: '500000', // Current Year Earnings (Field 74)
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // Morning line should be odds, not earnings
      expect(horse.morningLineOdds).toBe('3-1');
      expect(horse.morningLineDecimal).toBe(3);

      // Earnings should be from field 74
      expect(horse.currentYearEarnings).toBe(500000);
    });
  });

  describe('Age (Field 46, Index 45)', () => {
    it('extracts age from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        44: 'Test Horse',
        45: '4', // Age in years (Field 46)
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.age).toBe(4);
    });
  });

  describe('Sex Code (Field 49, Index 48)', () => {
    it('extracts sex code from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        44: 'Test Horse',
        48: 'c', // Sex Code (Field 49)
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.sex).toBe('c');
      expect(horse.sexFull).toBe('Colt');
    });
  });

  describe('Weight (Field 51, Index 50)', () => {
    it('extracts weight from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        44: 'Test Horse',
        50: '122', // Weight (Field 51)
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.weight).toBe(122);
    });
  });
});

describe('DRF Field Mapping - Race Header Data', () => {
  describe('Track Code (Field 1, Index 0)', () => {
    it('extracts track code from correct index', () => {
      const row = createDRFRow({
        0: 'SAR', // Track Code (Field 1)
        1: '20240815',
        2: '5',
        3: '1',
        44: 'Test Horse',
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      expect(result.races[0].header.trackCode).toBe('SAR');
    });
  });

  describe('Race Date (Field 2, Index 1)', () => {
    it('extracts race date from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815', // Race Date (Field 2)
        2: '5',
        3: '1',
        44: 'Test Horse',
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      expect(result.races[0].header.raceDate).toBe('20240815');
    });
  });

  describe('Race Number (Field 3, Index 2)', () => {
    it('extracts race number from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '9', // Race Number (Field 3)
        3: '1',
        44: 'Test Horse',
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      expect(result.races[0].header.raceNumber).toBe(9);
    });
  });

  describe('Surface Code (Field 7, Index 6)', () => {
    it('extracts surface from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        6: 'T', // Surface Code (Field 7) - Turf
        44: 'Test Horse',
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      expect(result.races[0].header.surface).toBe('turf');
    });
  });

  describe('Distance (Field 15, Index 14)', () => {
    it('extracts distance from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        14: '8.5', // Distance in furlongs (Field 15)
        44: 'Test Horse',
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      expect(result.races[0].header.distanceFurlongs).toBe(8.5);
    });
  });

  describe('Purse (Field 12, Index 11)', () => {
    it('extracts purse from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        11: '100000', // Purse (Field 12)
        44: 'Test Horse',
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      expect(result.races[0].header.purse).toBe(100000);
    });
  });
});

describe('DRF Field Mapping - Lifetime Statistics', () => {
  // NOTE: Lifetime stats are in Fields 97-101 (indices 96-100), NOT Fields 62-69
  // Verified with real DRF data - previous indices 61-68 contained unknown data

  describe('Lifetime Starts (Field 97, Index 96)', () => {
    it('extracts lifetime starts from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        44: 'Test Horse',
        96: '25', // Lifetime Starts (Field 97)
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.lifetimeStarts).toBe(25);
    });
  });

  describe('Lifetime Wins (Field 98, Index 97)', () => {
    it('extracts lifetime wins from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        44: 'Test Horse',
        97: '10', // Lifetime Wins (Field 98)
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.lifetimeWins).toBe(10);
    });
  });

  describe('Lifetime Earnings (Field 101, Index 100)', () => {
    it('extracts lifetime earnings from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        44: 'Test Horse',
        100: '2500000', // Lifetime Earnings (Field 101)
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.lifetimeEarnings).toBe(2500000);
    });
  });

  describe('Current Year Earnings (Field 74, Index 73) - NO CONFLICT', () => {
    it('extracts current year earnings from field 74, NOT field 44', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        43: '8-1', // Morning Line (Field 44)
        44: 'Test Horse',
        73: '750000', // Current Year Earnings (Field 74) - CORRECT INDEX
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];

      // Current year earnings should come from index 73, not 43
      expect(horse.currentYearEarnings).toBe(750000);

      // And morning line should still be correct
      expect(horse.morningLineDecimal).toBe(8);
    });
  });
});

describe('DRF Field Mapping - Breeding Information', () => {
  describe('Sire (Field 52, Index 51)', () => {
    it('extracts sire from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        44: 'Test Horse',
        51: 'Into Mischief', // Sire (Field 52)
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.breeding.sire).toBe('Into Mischief');
    });
  });

  describe('Dam (Field 54, Index 53)', () => {
    it('extracts dam from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        44: 'Test Horse',
        53: 'Songbird', // Dam (Field 54)
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.breeding.dam).toBe('Songbird');
    });
  });

  describe('Dam Sire (Field 55, Index 54)', () => {
    it('extracts dam sire from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        44: 'Test Horse',
        54: "Medaglia d'Oro", // Dam Sire (Field 55)
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.breeding.damSire).toBe("Medaglia d'Oro");
    });
  });
});

describe('DRF Field Mapping - Speed Figures', () => {
  describe('Best Speed Figure (Field 224, Index 223)', () => {
    it('extracts best beyer from correct index', () => {
      const row = createDRFRow({
        0: 'CD',
        1: '20240815',
        2: '5',
        3: '1',
        44: 'Test Horse',
        223: '105', // Best Speed Figure (Field 224)
      });

      const result = parseDRFFile(row, 'test.drf');

      expect(result.races.length).toBeGreaterThan(0);
      const horse = result.races[0].horses[0];
      expect(horse.bestBeyer).toBe(105);
    });
  });
});

describe('parseOdds utility', () => {
  it('parses fractional odds with dash', () => {
    const result = parseOdds('5-1');
    expect(result.odds).toBe('5-1');
    expect(result.decimal).toBe(5);
  });

  it('parses fractional odds with slash', () => {
    const result = parseOdds('7/2');
    expect(result.odds).toBe('7-2');
    expect(result.decimal).toBe(3.5);
  });

  it('parses even odds', () => {
    const result = parseOdds('even');
    expect(result.odds).toBe('1-1');
    expect(result.decimal).toBe(1);
  });

  it('parses whole number odds as X-1', () => {
    const result = parseOdds('10');
    expect(result.odds).toBe('10-1');
    expect(result.decimal).toBe(10);
  });

  it('parses decimal odds', () => {
    const result = parseOdds('2.5');
    expect(result.odds).toBe('2.5');
    expect(result.decimal).toBe(2.5);
  });

  it('handles empty string', () => {
    const result = parseOdds('');
    expect(result.odds).toBe('');
    expect(result.decimal).toBe(0);
  });

  it('handles odds with spaces', () => {
    const result = parseOdds('5 - 1');
    expect(result.odds).toBe('5-1');
    expect(result.decimal).toBe(5);
  });
});

describe('Index 43 Conflict Resolution', () => {
  it('Morning Line (index 43) and Current Year Earnings (index 73) are distinct', () => {
    const row = createDRFRow({
      0: 'CD',
      1: '20240815',
      2: '5',
      3: '1',
      43: '9-2', // Morning Line Odds at index 43
      44: 'Test Horse',
      73: '1000000', // Current Year Earnings at index 73
    });

    const result = parseDRFFile(row, 'test.drf');
    const horse = result.races[0].horses[0];

    // These should be completely different values
    expect(horse.morningLineOdds).toBe('9-2');
    expect(horse.morningLineDecimal).toBe(4.5);
    expect(horse.currentYearEarnings).toBe(1000000);

    // The old bug would have both reading from index 43
    expect(horse.currentYearEarnings).not.toBe(horse.morningLineDecimal);
  });
});
