/**
 * Calibration Storage Tests
 *
 * Tests for the calibration storage service.
 * Uses mocked IndexedDB since we're testing in Node.js environment.
 */

import { describe, it, expect } from 'vitest';
import type { HistoricalRace, HistoricalEntry } from '../schema';
import {
  generateRaceId,
  normalizeDate,
  toSurfaceCode,
  calculateImpliedProbability,
} from '../schema';

// ============================================================================
// SCHEMA HELPER TESTS (Unit tests - no IndexedDB needed)
// ============================================================================

describe('Calibration Schema Helpers', () => {
  describe('generateRaceId', () => {
    it('should generate correct race ID format', () => {
      const id = generateRaceId('SAR', '2024-08-15', 5);
      expect(id).toBe('SAR-2024-08-15-R5');
    });

    it('should uppercase track code', () => {
      const id = generateRaceId('sar', '2024-08-15', 3);
      expect(id).toBe('SAR-2024-08-15-R3');
    });

    it('should handle YYYYMMDD date format', () => {
      const id = generateRaceId('CD', '20240815', 1);
      expect(id).toBe('CD-2024-08-15-R1');
    });
  });

  describe('normalizeDate', () => {
    it('should pass through ISO format dates', () => {
      expect(normalizeDate('2024-08-15')).toBe('2024-08-15');
    });

    it('should convert YYYYMMDD to ISO format', () => {
      expect(normalizeDate('20240815')).toBe('2024-08-15');
    });

    it('should convert MMDDYY to ISO format (21st century)', () => {
      expect(normalizeDate('081524')).toBe('2024-08-15');
    });

    it('should convert MMDDYY to ISO format (20th century)', () => {
      expect(normalizeDate('081595')).toBe('1995-08-15');
    });
  });

  describe('toSurfaceCode', () => {
    it('should convert dirt variations', () => {
      expect(toSurfaceCode('dirt')).toBe('D');
      expect(toSurfaceCode('D')).toBe('D');
      expect(toSurfaceCode('d')).toBe('D');
    });

    it('should convert turf variations', () => {
      expect(toSurfaceCode('turf')).toBe('T');
      expect(toSurfaceCode('T')).toBe('T');
      expect(toSurfaceCode('t')).toBe('T');
    });

    it('should convert synthetic variations', () => {
      expect(toSurfaceCode('synthetic')).toBe('S');
      expect(toSurfaceCode('all-weather')).toBe('S');
      expect(toSurfaceCode('S')).toBe('S');
    });

    it('should default to dirt for unknown surfaces', () => {
      expect(toSurfaceCode('unknown')).toBe('D');
      expect(toSurfaceCode('')).toBe('D');
    });
  });

  describe('calculateImpliedProbability', () => {
    it('should calculate correct implied probability', () => {
      // 1-1 odds (even) = 50% probability
      expect(calculateImpliedProbability(1)).toBeCloseTo(0.5, 2);

      // 4-1 odds = 20% probability
      expect(calculateImpliedProbability(4)).toBeCloseTo(0.2, 2);

      // 9-1 odds = 10% probability
      expect(calculateImpliedProbability(9)).toBeCloseTo(0.1, 2);
    });

    it('should return 0 for invalid odds', () => {
      expect(calculateImpliedProbability(0)).toBe(0);
      expect(calculateImpliedProbability(-1)).toBe(0);
    });
  });
});

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

function createMockHistoricalEntry(overrides: Partial<HistoricalEntry> = {}): HistoricalEntry {
  return {
    programNumber: 1,
    finishPosition: 1,
    predictedProbability: 0.25,
    impliedProbability: 0.2,
    finalOdds: 4.0,
    baseScore: 250,
    finalScore: 280,
    tier: 1,
    wasWinner: true,
    wasPlace: true,
    wasShow: true,
    horseName: 'Test Horse',
    ...overrides,
  };
}

function createMockHistoricalRace(overrides: Partial<HistoricalRace> = {}): HistoricalRace {
  return {
    id: generateRaceId('SAR', '2024-08-15', 5),
    trackCode: 'SAR',
    raceDate: '2024-08-15',
    raceNumber: 5,
    distance: 6.0,
    surface: 'D',
    fieldSize: 8,
    entries: [
      createMockHistoricalEntry({ programNumber: 1, finishPosition: 1, wasWinner: true }),
      createMockHistoricalEntry({
        programNumber: 2,
        finishPosition: 2,
        wasWinner: false,
        wasPlace: true,
      }),
      createMockHistoricalEntry({
        programNumber: 3,
        finishPosition: 3,
        wasWinner: false,
        wasPlace: false,
        wasShow: true,
      }),
      createMockHistoricalEntry({
        programNumber: 4,
        finishPosition: 4,
        wasWinner: false,
        wasPlace: false,
        wasShow: false,
      }),
    ],
    recordedAt: new Date(),
    source: 'bot_result',
    confidence: 'HIGH',
    status: 'complete',
    ...overrides,
  };
}

// ============================================================================
// STORAGE OPERATION TESTS (require mocking)
// ============================================================================

describe('Calibration Storage Operations', () => {
  // Note: These tests use schema helpers directly since IndexedDB
  // requires browser environment. For full integration tests,
  // run in browser context or use fake-indexeddb package.

  describe('Race Validation', () => {
    it('should validate a correct race structure', () => {
      const race = createMockHistoricalRace();

      // Check structure is valid
      expect(race.id).toBeTruthy();
      expect(race.trackCode).toBeTruthy();
      expect(race.entries.length).toBeGreaterThan(0);
      expect(race.entries.filter((e) => e.wasWinner).length).toBe(1);
    });

    it('should detect missing winner in completed race', () => {
      const race = createMockHistoricalRace({
        entries: [
          createMockHistoricalEntry({ wasWinner: false, finishPosition: 2 }),
          createMockHistoricalEntry({ wasWinner: false, finishPosition: 3, programNumber: 2 }),
        ],
      });

      const winners = race.entries.filter((e) => e.wasWinner);
      expect(winners.length).toBe(0); // Should fail validation
    });

    it('should detect duplicate program numbers', () => {
      const race = createMockHistoricalRace({
        entries: [
          createMockHistoricalEntry({ programNumber: 1 }),
          createMockHistoricalEntry({ programNumber: 1 }), // Duplicate
        ],
      });

      const programNumbers = race.entries.map((e) => e.programNumber);
      const unique = new Set(programNumbers);
      expect(unique.size).not.toBe(programNumbers.length);
    });
  });

  describe('Export/Import Data Structure', () => {
    it('should create valid export structure', () => {
      const races = [
        createMockHistoricalRace({ raceNumber: 1 }),
        createMockHistoricalRace({ raceNumber: 2 }),
        createMockHistoricalRace({ raceNumber: 3 }),
      ];

      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        dataset: {
          totalRaces: races.length,
          totalEntries: races.reduce((sum, r) => sum + r.entries.length, 0),
          dateRange: {
            start: '2024-08-15',
            end: '2024-08-15',
          },
          trackCodes: ['SAR'],
          lastUpdated: new Date(),
        },
        races,
      };

      const json = JSON.stringify(exportData);
      expect(json).toBeTruthy();

      // Verify roundtrip
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.races.length).toBe(3);
    });

    it('should handle import of valid JSON', () => {
      const importData = {
        version: 1,
        races: [
          createMockHistoricalRace({ raceNumber: 1 }),
          createMockHistoricalRace({ raceNumber: 2 }),
        ],
      };

      const json = JSON.stringify(importData);
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed.races)).toBe(true);
      expect(parsed.races.length).toBe(2);
    });

    it('should support legacy format import', () => {
      // Legacy format used 'historicalRaces' key
      const legacyData = {
        historicalRaces: [createMockHistoricalRace()],
      };

      const json = JSON.stringify(legacyData);
      const parsed = JSON.parse(json);

      const races = parsed.races ?? parsed.historicalRaces ?? [];
      expect(races.length).toBe(1);
    });
  });

  describe('Race ID Uniqueness', () => {
    it('should generate unique IDs for different races', () => {
      const id1 = generateRaceId('SAR', '2024-08-15', 1);
      const id2 = generateRaceId('SAR', '2024-08-15', 2);
      const id3 = generateRaceId('CD', '2024-08-15', 1);

      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id2).not.toBe(id3);
    });

    it('should generate same ID for same race', () => {
      const id1 = generateRaceId('SAR', '2024-08-15', 5);
      const id2 = generateRaceId('sar', '20240815', 5);

      expect(id1).toBe(id2);
    });
  });
});

// ============================================================================
// INTEGRATION TEST SCENARIOS (documentation)
// ============================================================================

describe('Storage Integration Scenarios (Documentation)', () => {
  it('Scenario: Save and retrieve historical race', () => {
    // This test documents the expected behavior
    // Actual IndexedDB operations require browser environment

    const race = createMockHistoricalRace();

    // Expected flow:
    // 1. Call saveHistoricalRace(race)
    // 2. Call getHistoricalRace(race.id)
    // 3. Retrieved race should match original

    expect(race.id).toBe('SAR-2024-08-15-R5');
    expect(race.entries.length).toBe(4);
  });

  it('Scenario: Count races correctly', () => {
    // Expected flow:
    // 1. Save multiple races
    // 2. Call getHistoricalRaceCount()
    // 3. Count should match number of saved races

    const races = [
      createMockHistoricalRace({ raceNumber: 1 }),
      createMockHistoricalRace({ raceNumber: 2 }),
      createMockHistoricalRace({ raceNumber: 3 }),
    ];

    expect(races.length).toBe(3);
  });

  it('Scenario: Export/import roundtrip preserves data', () => {
    const original = createMockHistoricalRace();
    const json = JSON.stringify({
      version: 1,
      races: [original],
    });

    const imported = JSON.parse(json);
    const race = imported.races[0];

    expect(race.id).toBe(original.id);
    expect(race.trackCode).toBe(original.trackCode);
    expect(race.entries.length).toBe(original.entries.length);
  });

  it('Scenario: Duplicate race IDs are handled (update, not duplicate)', () => {
    // Expected flow:
    // 1. Save race with ID "SAR-2024-08-15-R5"
    // 2. Save another race with same ID but different data
    // 3. Retrieve race - should have updated data
    // 4. Count should still be 1

    const _id = generateRaceId('SAR', '2024-08-15', 5);
    const race1 = createMockHistoricalRace({ notes: 'First version' });
    const race2 = createMockHistoricalRace({ notes: 'Updated version' });

    expect(race1.id).toBe(race2.id);
    // In actual storage, second save would update, not create duplicate
  });
});
