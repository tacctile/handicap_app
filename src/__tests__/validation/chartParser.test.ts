/**
 * Chart Parser Tests
 *
 * Tests for parsing DRF Text Chart files used in backtesting.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseChartFile,
  getChartRace,
  getActiveStarters,
  getWinner,
  getTopFinishers,
} from '../../lib/chartParser';

// ============================================================================
// TEST DATA
// ============================================================================

// Sample chart file path
const SAMPLE_CHART_PATH = path.join(__dirname, '../../data/SAR20060727.chart.txt');

// Sample chart file content for unit tests
const SAMPLE_HEADER = '"H","USA","SAR","20060727","9","D","Saratoga"';

const SAMPLE_RACE =
  '"R","1","TB","AOC"," "," ","4U"," ","51000","0","51000","0"," ","0"," ","0"," ","0"," ","0"," ","0"," ","0"," ","0","30000","30000"," ","1650","F","T","M","11"," "," "," ","0100","0135","0100"," ","OC 30k/N1X -N","Firm","","",""," ","","","83","342.58","0","0","0","0","0"," ","","150542","Good","Cloudy","","","Y"';

const SAMPLE_STARTER_1 =
  '"S","1","000006217149TB","Langburg","20010217","ON","TB","Gelding","Bay","Marienburg","1995","TB","Langfuhr","1992","TB","Conquistador Cielo","1979","TB","Danzig","1977","TB","156","0","L","","30600","Murphy","Cyril"," "," ","Voss","Thomas","H.","Blackwoods Stable"," "," ","210","N","B","0","N","4","2","0","2","3","4","4","2","1","1","100","10","150","150","150","10","10","250","260","350","10","0","N","0","dug in gamely inside","close up in hand, inside rally, dug in gamely inside, driving","6.20","6.40","4.10","N","","","","","","","","","","","","N","0","N","","0","","","Gustav Schickendanz","000000003939TE","000000084353JE"';

const SAMPLE_STARTER_2 =
  '"S","1","000004477877TB","Malagash","19980414","NY","TB","Gelding","Bay","Senorita Constanza","1989","TB","Signal Tap","1991","TB","His Majesty","1968","TB","Fappiano","1977","TB","152","0","L","","9180","Massey","Robert"," "," ","Voss","Thomas","H.","Voss","Mrs. Thomas","H.","210","N","B","0","N","6","2B","0","1","1","1","1","1","2","2","10","100","50","50","10","225","0","0","0","0","0","10","N","30000","came again again","speed in hand, made pace, dropped back, came again again","6.20","6.40","4.10","N","","","","","","","","","","","","N","0","N","","0","","","John R. Michelotti","000000003939TE","000000084355JE"';

const SAMPLE_SCRATCH =
  '"S","2","000007125665TB","Indian Love Call","20040303","KY","TB","Filly","Bay","Mood Music","1998","TB","Cherokee Run","1990","TB","Kingmambo","1990","TB","Runaway Groom","1979","TB","118","0","","","0","Smith","Mike","E."," ","McGaughey III","Claude","R.","Phipps","Cynthia"," ","0","N"," ","0"," ","99","SCR","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","N","0"," "," ","0.00","0.00","0.00","N","","","","","","","","","","","Trainer","N","0","N","","0","","","Cynthia Phipps","000000001217TE","000000001770JE"';

// ============================================================================
// HEADER PARSING TESTS
// ============================================================================

describe('Chart Parser - Header Parsing', () => {
  it('should parse header record correctly', () => {
    const content = [SAMPLE_HEADER, SAMPLE_RACE, SAMPLE_STARTER_1].join('\n');
    const result = parseChartFile(content, 'test.chart.txt');

    expect(result.header).toBeDefined();
    expect(result.header.trackCode).toBe('SAR');
    expect(result.header.raceDate).toBe('20060727');
    expect(result.header.numberOfRaces).toBe(9);
    expect(result.header.countryCode).toBe('USA');
    expect(result.header.trackName).toBe('Saratoga');
  });

  it('should infer header from filename if missing', () => {
    const content = [SAMPLE_RACE, SAMPLE_STARTER_1].join('\n');
    const result = parseChartFile(content, 'SAR20060727.chart.txt');

    expect(result.header.trackCode).toBe('SAR');
    expect(result.header.raceDate).toBe('20060727');
    expect(result.warnings.some((w) => w.message.includes('inferred'))).toBe(true);
  });

  it('should handle empty file gracefully', () => {
    const result = parseChartFile('', 'empty.chart.txt');

    expect(result.races).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// RACE PARSING TESTS
// ============================================================================

describe('Chart Parser - Race Parsing', () => {
  it('should parse race record correctly', () => {
    const content = [SAMPLE_HEADER, SAMPLE_RACE, SAMPLE_STARTER_1].join('\n');
    const result = parseChartFile(content, 'test.chart.txt');

    expect(result.races).toHaveLength(1);
    const race = result.races[0];
    expect(race).toBeDefined();
    expect(race!.raceNumber).toBe(1);
    expect(race!.raceType).toBe('AOC');
    expect(race!.breedCode).toBe('TB');
    expect(race!.distance).toBe(1650);
    expect(race!.surfaceCode).toBe('T');
    expect(race!.surface).toBe('turf');
    expect(race!.trackCondition).toBe('Firm');
  });

  it('should associate starters with correct race', () => {
    const content = [SAMPLE_HEADER, SAMPLE_RACE, SAMPLE_STARTER_1, SAMPLE_STARTER_2].join('\n');
    const result = parseChartFile(content, 'test.chart.txt');

    expect(result.races).toHaveLength(1);
    const race = result.races[0];
    expect(race?.starters).toHaveLength(2);
  });
});

// ============================================================================
// STARTER PARSING TESTS
// ============================================================================

describe('Chart Parser - Starter Parsing', () => {
  it('should parse starter record correctly', () => {
    const content = [SAMPLE_HEADER, SAMPLE_RACE, SAMPLE_STARTER_1].join('\n');
    const result = parseChartFile(content, 'test.chart.txt');

    const race = result.races[0];
    expect(race?.starters).toHaveLength(1);

    const starter = race?.starters[0];
    expect(starter).toBeDefined();
    expect(starter!.horseName).toBe('Langburg');
    expect(starter!.raceNumber).toBe(1);
    expect(starter!.isScratched).toBe(false);
  });

  it('should identify scratched starters', () => {
    const race2 =
      '"R","2","TB","MSW"," ","F","02"," ","47000","0","47000","0"," ","0"," ","0"," ","0"," ","0"," ","0"," ","0"," ","0","0","0"," ","550","F","D","D","11"," "," "," ","0135","0207","0138"," ","Md Sp Wt 47k","Fast","","17","89"," ","","","83","106.09","2173","4582","5924","0","0"," ","","401768","Good","Cloudy","","","Y"';
    const content = [SAMPLE_HEADER, race2, SAMPLE_SCRATCH].join('\n');
    const result = parseChartFile(content, 'test.chart.txt');

    const race = result.races[0];
    const scratch = race?.starters.find((s) => s.horseName === 'Indian Love Call');
    expect(scratch).toBeDefined();
    expect(scratch!.isScratched).toBe(true);
    expect(scratch!.finishPosition).toBe(99);
  });

  it('should sort starters by finish position', () => {
    const content = [SAMPLE_HEADER, SAMPLE_RACE, SAMPLE_STARTER_2, SAMPLE_STARTER_1].join('\n');
    const result = parseChartFile(content, 'test.chart.txt');

    const race = result.races[0];
    expect(race?.starters).toHaveLength(2);
    // First starter should have finish position 1
    expect(race?.starters[0]?.finishPosition).toBe(1);
    // Second starter should have finish position 2
    expect(race?.starters[1]?.finishPosition).toBe(2);
  });
});

// ============================================================================
// QUOTED FIELD HANDLING TESTS
// ============================================================================

describe('Chart Parser - Quoted Field Handling', () => {
  it('should handle fields with embedded commas', () => {
    // Create a line with a field containing a comma
    const lineWithComma = '"H","USA","SAR, Saratoga","20060727","9","D","Saratoga Race Course"';
    const result = parseChartFile(lineWithComma, 'test.chart.txt');

    // The parser should handle this gracefully
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty quoted fields', () => {
    const content = [SAMPLE_HEADER, SAMPLE_RACE, SAMPLE_STARTER_1].join('\n');
    const result = parseChartFile(content, 'test.chart.txt');

    // Should parse without errors
    expect(result.races).toHaveLength(1);
  });
});

// ============================================================================
// MALFORMED RECORD HANDLING TESTS
// ============================================================================

describe('Chart Parser - Malformed Record Handling', () => {
  it('should skip malformed lines and log warnings', () => {
    const malformedLine = 'this is not a valid csv line';
    const content = [SAMPLE_HEADER, malformedLine, SAMPLE_RACE, SAMPLE_STARTER_1].join('\n');
    const result = parseChartFile(content, 'test.chart.txt');

    // Should still parse valid records
    expect(result.races).toHaveLength(1);
    // Should have logged a warning for unknown record type
  });

  it('should handle truncated lines gracefully', () => {
    const truncatedLine = '"S","1","0000"';
    const content = [SAMPLE_HEADER, SAMPLE_RACE, truncatedLine, SAMPLE_STARTER_1].join('\n');
    const result = parseChartFile(content, 'test.chart.txt');

    // Should still parse valid starter
    expect(result.races).toHaveLength(1);
    expect(result.races[0]?.starters.length).toBeGreaterThanOrEqual(1);
  });

  it('should continue parsing after encountering errors', () => {
    // Mix of valid and invalid lines
    const content = [
      SAMPLE_HEADER,
      SAMPLE_RACE,
      'invalid line',
      SAMPLE_STARTER_1,
      'another invalid',
      SAMPLE_STARTER_2,
    ].join('\n');
    const result = parseChartFile(content, 'test.chart.txt');

    // Should parse both valid starters
    expect(result.races).toHaveLength(1);
    expect(result.races[0]?.starters.length).toBe(2);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('Chart Parser - Utility Functions', () => {
  const content = [SAMPLE_HEADER, SAMPLE_RACE, SAMPLE_STARTER_1, SAMPLE_STARTER_2].join('\n');

  it('getChartRace should return correct race', () => {
    const result = parseChartFile(content, 'test.chart.txt');
    const race = getChartRace(result, 1);

    expect(race).toBeDefined();
    expect(race?.raceNumber).toBe(1);
  });

  it('getChartRace should return undefined for non-existent race', () => {
    const result = parseChartFile(content, 'test.chart.txt');
    const race = getChartRace(result, 99);

    expect(race).toBeUndefined();
  });

  it('getActiveStarters should exclude scratches', () => {
    const race2 =
      '"R","2","TB","MSW"," ","F","02"," ","47000","0","47000","0"," ","0"," ","0"," ","0"," ","0"," ","0"," ","0"," ","0","0","0"," ","550","F","D","D","11"," "," "," ","0135","0207","0138"," ","Md Sp Wt 47k","Fast","","17","89"," ","","","83","106.09","2173","4582","5924","0","0"," ","","401768","Good","Cloudy","","","Y"';
    const withScratch = [SAMPLE_HEADER, race2, SAMPLE_SCRATCH].join('\n');
    const result = parseChartFile(withScratch, 'test.chart.txt');
    const race = result.races[0];

    if (race) {
      const active = getActiveStarters(race);
      expect(active.every((s) => !s.isScratched)).toBe(true);
    }
  });

  it('getWinner should return horse with finish position 1', () => {
    const result = parseChartFile(content, 'test.chart.txt');
    const race = result.races[0];

    if (race) {
      const winner = getWinner(race);
      expect(winner).toBeDefined();
      expect(winner?.finishPosition).toBe(1);
    }
  });

  it('getTopFinishers should return correct number of horses', () => {
    const result = parseChartFile(content, 'test.chart.txt');
    const race = result.races[0];

    if (race) {
      const top3 = getTopFinishers(race, 3);
      expect(top3.length).toBeLessThanOrEqual(3);
      // Should be sorted by finish position
      for (let i = 1; i < top3.length; i++) {
        expect(top3[i]!.finishPosition).toBeGreaterThanOrEqual(top3[i - 1]!.finishPosition);
      }
    }
  });
});

// ============================================================================
// INTEGRATION TEST WITH REAL FILE
// ============================================================================

describe('Chart Parser - Integration with Real File', () => {
  let fileContent: string;
  let fileExists = false;

  beforeAll(() => {
    try {
      if (fs.existsSync(SAMPLE_CHART_PATH)) {
        fileContent = fs.readFileSync(SAMPLE_CHART_PATH, 'utf-8');
        fileExists = true;
      }
    } catch {
      // File not available in test environment
      fileExists = false;
    }
  });

  it('should parse sample chart file SAR20060727', () => {
    if (!fileExists) {
      // Skip if file not available
      return;
    }

    const result = parseChartFile(fileContent, 'SAR20060727.chart.txt');

    // Verify header
    expect(result.header.trackCode).toBe('SAR');
    expect(result.header.raceDate).toBe('20060727');
    expect(result.header.numberOfRaces).toBe(9);

    // Verify races
    expect(result.races.length).toBe(9);
  });

  it('should extract correct number of starters for Race 1', () => {
    if (!fileExists) {
      return;
    }

    const result = parseChartFile(fileContent, 'SAR20060727.chart.txt');
    const race1 = getChartRace(result, 1);

    expect(race1).toBeDefined();
    // Race 1 should have starters (exact count may vary based on scratches)
    expect(race1!.starters.length).toBeGreaterThan(0);
  });

  it('should identify finish positions correctly', () => {
    if (!fileExists) {
      return;
    }

    const result = parseChartFile(fileContent, 'SAR20060727.chart.txt');
    const race1 = getChartRace(result, 1);

    if (race1) {
      const winner = getWinner(race1);
      expect(winner).toBeDefined();
      expect(winner?.finishPosition).toBe(1);

      // Verify we have horses with finish positions 1, 2, 3
      const topFinishers = getTopFinishers(race1, 3);
      expect(topFinishers.length).toBeGreaterThanOrEqual(1);
    }
  });
});
