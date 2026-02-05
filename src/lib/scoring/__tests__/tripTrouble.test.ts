/**
 * Trip Trouble Detection Tests
 *
 * Tests for algorithmic trip trouble detection and scoring.
 * Verifies keyword detection, adjustment calculations, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeTripTrouble,
  analyzeRaceTripTrouble,
  calculateTripAdjustment,
  findKeywords,
  extractComments,
  hasSignificantTrouble,
  getTripTroubleSummary,
  getTripTroubleColor,
  TRIP_TROUBLE_CONFIG,
  HIGH_TROUBLE_KEYWORDS,
  MEDIUM_TROUBLE_KEYWORDS,
  LOW_TROUBLE_KEYWORDS,
  CAUSED_TROUBLE_KEYWORDS,
} from '../tripTrouble';
import type { HorseEntry, PastPerformance } from '../../../types/drf';
import type { TroubledRace } from '../../../types/scoring';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a minimal mock past performance with specified comments
 */
function createMockPP(
  options: {
    tripComment?: string;
    comment?: string;
    finishPosition?: number;
    beyer?: number | null;
  } = {}
): PastPerformance {
  return {
    date: '20250101',
    track: 'CD',
    trackName: 'Churchill Downs',
    raceNumber: 1,
    distanceFurlongs: 6,
    distance: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'claiming',
    claimingPrice: 25000,
    purse: 50000,
    fieldSize: 8,
    finishPosition: options.finishPosition ?? 5,
    lengthsBehind: 5,
    lengthsAhead: null,
    finalTime: 71.5,
    finalTimeFormatted: '1:11.50',
    speedFigures: {
      beyer: options.beyer ?? 75,
      timeformUS: null,
      equibase: null,
      trackVariant: null,
      dirtVariant: null,
      turfVariant: null,
    },
    runningLine: {
      start: 4,
      quarterMile: 3,
      quarterMileLengths: 2,
      halfMile: 3,
      halfMileLengths: 2,
      threeQuarters: 4,
      threeQuartersLengths: 3,
      stretch: 4,
      stretchLengths: 4,
      finish: 5,
      finishLengths: 5,
    },
    jockey: 'Test Jockey',
    weight: 122,
    apprenticeAllowance: 0,
    equipment: 'L',
    medication: 'L',
    winner: 'Winner Horse',
    secondPlace: 'Second Horse',
    thirdPlace: 'Third Horse',
    tripComment: options.tripComment ?? '',
    comment: options.comment ?? '',
    odds: 5.0,
    favoriteRank: null,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: 21,
    earlyPace1: 90,
    latePace: 85,
    quarterTime: null,
    halfMileTime: null,
    sixFurlongTime: null,
    mileTime: null,
  };
}

/**
 * Create a minimal mock horse entry with past performances
 */
function createMockHorse(
  pastPerformances: PastPerformance[],
  options: { programNumber?: number; horseName?: string } = {}
): HorseEntry {
  return {
    programNumber: options.programNumber ?? 1,
    horseName: options.horseName ?? 'Test Horse',
    postPosition: 1,
    morningLineOdds: '5-1',
    trainerName: 'Test Trainer',
    jockeyName: 'Test Jockey',
    age: 4,
    sex: 'C',
    color: 'B',
    weight: 122,
    medication: 'L',
    equipment: { raw: 'L', blinkers: false, firstTimeEquipment: [], blinkersOff: false },
    sire: 'Test Sire',
    dam: 'Test Dam',
    damSire: 'Test Dam Sire',
    owner: 'Test Owner',
    breeder: 'Test Breeder',
    whereBred: 'KY',
    earlySpeedRating: 5,
    runningStyle: 'E/P',
    bestBeyer: 80,
    averageBeyer: 75,
    daysSinceLastRace: 21,
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimePlaces: 3,
    lifetimeShows: 2,
    lifetimeEarnings: 100000,
    currentYearEarnings: 50000,
    previousYearEarnings: 50000,
    pastPerformances,
    workouts: [],
    trainerStats: null,
    jockeyStats: null,
    distanceRecord: { starts: 5, wins: 1, places: 1, shows: 1 },
    surfaceRecord: { starts: 8, wins: 2, places: 2, shows: 1 },
    trackRecord: { starts: 3, wins: 1, places: 0, shows: 1 },
    wetTrackRecord: { starts: 2, wins: 0, places: 1, shows: 0 },
    turfRecord: { starts: 0, wins: 0, places: 0, shows: 0 },
    trainerCategoryStats: null,
    salesPrice: null,
    salesLocation: null,
    siresSire: 'Test Sires Sire',
  } as unknown as HorseEntry;
}

// ============================================================================
// KEYWORD DETECTION TESTS
// ============================================================================

describe('tripTrouble', () => {
  describe('findKeywords', () => {
    it('finds high-confidence trouble keywords', () => {
      const result = findKeywords('horse was blocked in the stretch', HIGH_TROUBLE_KEYWORDS);
      expect(result).toContain('blocked');
    });

    it('finds multiple keywords', () => {
      const result = findKeywords('checked and steadied on turn', HIGH_TROUBLE_KEYWORDS);
      expect(result).toContain('checked');
      expect(result).toContain('steadied');
      expect(result.length).toBe(2);
    });

    it('is case-insensitive', () => {
      const result = findKeywords('BLOCKED in the stretch', HIGH_TROUBLE_KEYWORDS);
      expect(result).toContain('blocked');
    });

    it('returns empty array for no matches', () => {
      const result = findKeywords('raced well throughout', HIGH_TROUBLE_KEYWORDS);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty comments', () => {
      const result = findKeywords('', HIGH_TROUBLE_KEYWORDS);
      expect(result).toEqual([]);
    });

    it('finds medium-confidence keywords', () => {
      const result = findKeywords('horse went 5-wide on the turn', MEDIUM_TROUBLE_KEYWORDS);
      expect(result).toContain('5-wide');
    });

    it('finds low-confidence keywords', () => {
      const result = findKeywords('raced wide throughout', LOW_TROUBLE_KEYWORDS);
      expect(result).toContain('wide');
    });

    it('finds caused-trouble keywords', () => {
      const result = findKeywords('lugged in down the stretch', CAUSED_TROUBLE_KEYWORDS);
      expect(result).toContain('lugged in');
    });
  });

  describe('extractComments', () => {
    it('combines tripComment and comment fields', () => {
      const pp = createMockPP({
        tripComment: 'blocked in stretch',
        comment: 'had to steady',
      });
      const result = extractComments(pp);
      expect(result).toContain('blocked in stretch');
      expect(result).toContain('had to steady');
    });

    it('handles empty tripComment', () => {
      const pp = createMockPP({
        tripComment: '',
        comment: 'raced wide',
      });
      const result = extractComments(pp);
      expect(result).toBe('raced wide');
    });

    it('handles empty comment', () => {
      const pp = createMockPP({
        tripComment: 'blocked',
        comment: '',
      });
      const result = extractComments(pp);
      expect(result).toBe('blocked');
    });

    it('handles both empty', () => {
      const pp = createMockPP({
        tripComment: '',
        comment: '',
      });
      const result = extractComments(pp);
      expect(result).toBe('');
    });
  });

  // ============================================================================
  // ADJUSTMENT CALCULATION TESTS
  // ============================================================================

  describe('calculateTripAdjustment', () => {
    it('returns +2 pts for one high-confidence trouble race (v3.8)', () => {
      const troubledRaces: TroubledRace[] = [
        {
          raceIndex: 0,
          troubleKeywords: ['blocked'],
          confidenceLevel: 'HIGH',
          finishPosition: 5,
          beyer: 75,
        },
      ];
      const result = calculateTripAdjustment(troubledRaces, 0);
      expect(result.adjustment).toBe(2); // v3.8: HIGH_CONFIDENCE_PTS=2, recency=1.0
      expect(result.confidence).toBe('MEDIUM'); // 1 high = MEDIUM overall
    });

    it('returns +3 pts for two high-confidence trouble races (v3.8)', () => {
      const troubledRaces: TroubledRace[] = [
        {
          raceIndex: 0,
          troubleKeywords: ['blocked'],
          confidenceLevel: 'HIGH',
          finishPosition: 5,
          beyer: 75,
        },
        {
          raceIndex: 1,
          troubleKeywords: ['steadied'],
          confidenceLevel: 'HIGH',
          finishPosition: 4,
          beyer: 72,
        },
      ];
      const result = calculateTripAdjustment(troubledRaces, 0);
      expect(result.adjustment).toBe(3); // v3.8: 2*1.0 + 2*0.6 = 3.2 → 3
      expect(result.confidence).toBe('HIGH'); // 2+ high = HIGH overall
    });

    it('returns +1 pt for one medium-confidence trouble race (v3.8)', () => {
      const troubledRaces: TroubledRace[] = [
        {
          raceIndex: 0,
          troubleKeywords: ['bumped'],
          confidenceLevel: 'MEDIUM',
          finishPosition: 6,
          beyer: 70,
        },
      ];
      const result = calculateTripAdjustment(troubledRaces, 0);
      expect(result.adjustment).toBe(1); // v3.8: MEDIUM_CONFIDENCE_PTS=1, recency=1.0
      expect(result.confidence).toBe('LOW');
    });

    it('returns +1 pt for one low-confidence trouble race', () => {
      const troubledRaces: TroubledRace[] = [
        {
          raceIndex: 0,
          troubleKeywords: ['wide'],
          confidenceLevel: 'LOW',
          finishPosition: 6,
          beyer: 70,
        },
      ];
      const result = calculateTripAdjustment(troubledRaces, 0);
      expect(result.adjustment).toBe(1);
      expect(result.confidence).toBe('LOW');
    });

    it('returns 0 pts if horse causes more trouble than suffers', () => {
      const troubledRaces: TroubledRace[] = [
        {
          raceIndex: 0,
          troubleKeywords: ['blocked'],
          confidenceLevel: 'HIGH',
          finishPosition: 5,
          beyer: 75,
        },
      ];
      const result = calculateTripAdjustment(troubledRaces, 2);
      expect(result.adjustment).toBe(0);
      expect(result.confidence).toBe('NONE');
      expect(result.reason).toContain('causes trouble');
    });

    it('caps adjustment at MAX_ADJUSTMENT (4 pts v3.8)', () => {
      const troubledRaces: TroubledRace[] = [
        {
          raceIndex: 0,
          troubleKeywords: ['blocked'],
          confidenceLevel: 'HIGH',
          finishPosition: 4,
          beyer: 80,
        },
        {
          raceIndex: 1,
          troubleKeywords: ['steadied'],
          confidenceLevel: 'HIGH',
          finishPosition: 5,
          beyer: 75,
        },
        {
          raceIndex: 2,
          troubleKeywords: ['bumped'],
          confidenceLevel: 'MEDIUM',
          finishPosition: 6,
          beyer: 72,
        },
      ];
      const result = calculateTripAdjustment(troubledRaces, 0);
      expect(result.adjustment).toBeLessThanOrEqual(TRIP_TROUBLE_CONFIG.MAX_ADJUSTMENT);
    });

    it('returns 0 for no troubled races', () => {
      const result = calculateTripAdjustment([], 0);
      expect(result.adjustment).toBe(0);
      expect(result.confidence).toBe('NONE');
    });

    it('reduces adjustment when horse caused some trouble', () => {
      const troubledRaces: TroubledRace[] = [
        {
          raceIndex: 0,
          troubleKeywords: ['blocked'],
          confidenceLevel: 'HIGH',
          finishPosition: 4,
          beyer: 80,
        },
        {
          raceIndex: 1,
          troubleKeywords: ['steadied'],
          confidenceLevel: 'HIGH',
          finishPosition: 5,
          beyer: 75,
        },
      ];
      // With no caused trouble: 3 pts (v3.8: 2*1.0 + 2*0.6 = 3.2 → 3)
      const resultNoCaused = calculateTripAdjustment(troubledRaces, 0);
      // With 1 caused trouble: reduced by 25%
      const resultWithCaused = calculateTripAdjustment(troubledRaces, 1);
      expect(resultWithCaused.adjustment).toBeLessThan(resultNoCaused.adjustment);
    });
  });

  // ============================================================================
  // MAIN ANALYSIS FUNCTION TESTS
  // ============================================================================

  describe('analyzeTripTrouble', () => {
    it('detects high-confidence trouble from "blocked" in last race', () => {
      const horse = createMockHorse([
        createMockPP({ tripComment: 'blocked in the stretch', finishPosition: 5 }),
        createMockPP({ tripComment: '', finishPosition: 4 }),
        createMockPP({ tripComment: '', finishPosition: 3 }),
      ]);

      const result = analyzeTripTrouble(horse);
      expect(result.adjustment).toBe(2); // v3.8: HIGH_CONFIDENCE_PTS=2, recency=1.0
      expect(result.highConfidenceCount).toBe(1);
      expect(result.totalTroubledCount).toBe(1);
    });

    it('detects high-confidence trouble in two races', () => {
      const horse = createMockHorse([
        createMockPP({ tripComment: 'blocked in stretch', finishPosition: 5 }),
        createMockPP({ tripComment: 'steadied on turn', finishPosition: 4 }),
        createMockPP({ tripComment: '', finishPosition: 3 }),
      ]);

      const result = analyzeTripTrouble(horse);
      expect(result.adjustment).toBe(3); // v3.8: 2*1.0 + 2*0.6 = 3.2 → 3
      expect(result.highConfidenceCount).toBe(2);
      expect(result.confidence).toBe('HIGH');
    });

    it('detects medium-confidence trouble from "wide" patterns', () => {
      const horse = createMockHorse([
        createMockPP({ tripComment: 'went 5-wide on the turn', finishPosition: 6 }),
        createMockPP({ tripComment: '', finishPosition: 5 }),
      ]);

      const result = analyzeTripTrouble(horse);
      expect(result.adjustment).toBe(1); // v3.8: MEDIUM_CONFIDENCE_PTS=1, recency=1.0
      expect(result.mediumConfidenceCount).toBe(1);
    });

    it('gives no bonus when horse caused trouble (lugged in)', () => {
      const horse = createMockHorse([
        createMockPP({ tripComment: 'lugged in down the stretch', finishPosition: 4 }),
        createMockPP({ tripComment: '', finishPosition: 5 }),
      ]);

      const result = analyzeTripTrouble(horse);
      expect(result.adjustment).toBe(0);
      expect(result.causedTroubleCount).toBe(1);
    });

    it('handles mixed trouble and caused trouble', () => {
      const horse = createMockHorse([
        createMockPP({ tripComment: 'blocked in stretch', finishPosition: 5 }),
        createMockPP({ tripComment: 'bore out turning for home', finishPosition: 6 }),
        createMockPP({ tripComment: 'steadied on turn', finishPosition: 4 }),
      ]);

      const result = analyzeTripTrouble(horse);
      // Should have 2 troubled races and 1 caused trouble
      expect(result.totalTroubledCount).toBe(2);
      expect(result.causedTroubleCount).toBe(1);
      // Adjustment should be reduced by caused trouble
      expect(result.adjustment).toBeLessThan(6);
    });

    it('returns 0 adjustment for horse with no trouble', () => {
      const horse = createMockHorse([
        createMockPP({ tripComment: 'raced well throughout', finishPosition: 3 }),
        createMockPP({ tripComment: 'good trip', finishPosition: 2 }),
      ]);

      const result = analyzeTripTrouble(horse);
      expect(result.adjustment).toBe(0);
      expect(result.totalTroubledCount).toBe(0);
      expect(result.confidence).toBe('NONE');
    });

    it('only analyzes last 3 races (older trouble is stale)', () => {
      const horse = createMockHorse([
        createMockPP({ tripComment: '', finishPosition: 3 }),
        createMockPP({ tripComment: '', finishPosition: 2 }),
        createMockPP({ tripComment: '', finishPosition: 4 }),
        createMockPP({ tripComment: 'blocked badly', finishPosition: 8 }), // 4th race back - ignored
      ]);

      const result = analyzeTripTrouble(horse);
      expect(result.adjustment).toBe(0);
      expect(result.totalTroubledCount).toBe(0);
    });

    it('detects low-confidence trouble from generic "wide"', () => {
      const horse = createMockHorse([
        createMockPP({ tripComment: 'raced wide', finishPosition: 5 }),
      ]);

      const result = analyzeTripTrouble(horse);
      expect(result.adjustment).toBe(1);
      expect(result.lowConfidenceCount).toBe(1);
      expect(result.confidence).toBe('LOW');
    });

    it('handles horse with no past performances', () => {
      const horse = createMockHorse([]);

      const result = analyzeTripTrouble(horse);
      expect(result.adjustment).toBe(0);
      expect(result.totalTroubledCount).toBe(0);
    });
  });

  // ============================================================================
  // BATCH ANALYSIS TESTS
  // ============================================================================

  describe('analyzeRaceTripTrouble', () => {
    it('analyzes all horses in a race', () => {
      const horses = [
        createMockHorse([createMockPP({ tripComment: 'blocked', finishPosition: 5 })], {
          programNumber: 1,
          horseName: 'Troubled Horse',
        }),
        createMockHorse([createMockPP({ tripComment: '', finishPosition: 2 })], {
          programNumber: 2,
          horseName: 'Clean Trip Horse',
        }),
      ];

      const results = analyzeRaceTripTrouble(horses);
      expect(results.size).toBe(2);

      const horse1Result = results.get(1);
      const horse2Result = results.get(2);

      expect(horse1Result?.adjustment).toBe(2); // v3.8: HIGH_CONFIDENCE_PTS=2
      expect(horse2Result?.adjustment).toBe(0);
    });
  });

  // ============================================================================
  // UTILITY FUNCTION TESTS
  // ============================================================================

  describe('hasSignificantTrouble', () => {
    it('returns true for adjustment >= 3', () => {
      // v3.8: Need two HIGH races to reach >= 3 (2*1.0 + 2*0.6 = 3.2 → 3)
      const result = analyzeTripTrouble(
        createMockHorse([
          createMockPP({ tripComment: 'blocked', finishPosition: 5 }),
          createMockPP({ tripComment: 'steadied', finishPosition: 4 }),
        ])
      );
      expect(hasSignificantTrouble(result)).toBe(true);
    });

    it('returns false for adjustment < 3', () => {
      // v3.8: Single HIGH race gives 2 pts, which is < 3
      const result = analyzeTripTrouble(
        createMockHorse([createMockPP({ tripComment: 'blocked', finishPosition: 5 })])
      );
      expect(hasSignificantTrouble(result)).toBe(false);
    });
  });

  describe('getTripTroubleSummary', () => {
    it('returns summary for troubled horse', () => {
      const result = analyzeTripTrouble(
        createMockHorse([createMockPP({ tripComment: 'blocked', finishPosition: 5 })])
      );
      const summary = getTripTroubleSummary(result);
      expect(summary).toContain('clear trouble');
      expect(summary).toContain('+2'); // v3.8: HIGH_CONFIDENCE_PTS=2
    });

    it('returns appropriate message for caused trouble', () => {
      const result = analyzeTripTrouble(
        createMockHorse([createMockPP({ tripComment: 'lugged in', finishPosition: 5 })])
      );
      const summary = getTripTroubleSummary(result);
      expect(summary).toContain('Caused trouble');
    });

    it('returns appropriate message for no trouble', () => {
      const result = analyzeTripTrouble(
        createMockHorse([createMockPP({ tripComment: '', finishPosition: 3 })])
      );
      const summary = getTripTroubleSummary(result);
      expect(summary).toBe('No trip trouble detected');
    });
  });

  describe('getTripTroubleColor', () => {
    it('returns green for max adjustment (v3.8: >= 4)', () => {
      expect(getTripTroubleColor(4)).toBe('#22c55e');
    });

    it('returns light green for moderate adjustment (v3.8: >= 2)', () => {
      expect(getTripTroubleColor(3)).toBe('#4ade80');
    });

    it('returns yellow for minor adjustment', () => {
      expect(getTripTroubleColor(1)).toBe('#eab308');
    });

    it('returns gray for no adjustment', () => {
      expect(getTripTroubleColor(0)).toBe('#6E6E70');
    });
  });

  // ============================================================================
  // CONFIGURATION TESTS
  // ============================================================================

  describe('TRIP_TROUBLE_CONFIG', () => {
    it('has correct max adjustment (v3.8)', () => {
      expect(TRIP_TROUBLE_CONFIG.MAX_ADJUSTMENT).toBe(4);
    });

    it('has correct points per confidence level (v3.8)', () => {
      expect(TRIP_TROUBLE_CONFIG.HIGH_CONFIDENCE_PTS).toBe(2);
      expect(TRIP_TROUBLE_CONFIG.MEDIUM_CONFIDENCE_PTS).toBe(1);
      expect(TRIP_TROUBLE_CONFIG.LOW_CONFIDENCE_PTS).toBe(1);
    });

    it('scans only last 3 races', () => {
      expect(TRIP_TROUBLE_CONFIG.MAX_RACES_TO_SCAN).toBe(3);
    });
  });

  // ============================================================================
  // EDGE CASE TESTS
  // ============================================================================

  describe('edge cases', () => {
    it('handles comments with special characters', () => {
      const horse = createMockHorse([
        createMockPP({ tripComment: 'blocked @ 1/4 pole (bad luck!)', finishPosition: 6 }),
      ]);
      const result = analyzeTripTrouble(horse);
      expect(result.adjustment).toBe(2); // v3.8: HIGH_CONFIDENCE_PTS=2
    });

    it('handles very long comments', () => {
      const longComment = 'broke well then ' + 'raced wide '.repeat(50) + 'blocked in stretch';
      const horse = createMockHorse([
        createMockPP({ tripComment: longComment, finishPosition: 6 }),
      ]);
      const result = analyzeTripTrouble(horse);
      expect(result.adjustment).toBeGreaterThanOrEqual(2); // v3.8: Should find "blocked" (2 pts)
    });

    it('handles comments with multiple trouble indicators', () => {
      const horse = createMockHorse([
        createMockPP({
          tripComment: 'checked hard, steadied, and blocked in stretch',
          finishPosition: 7,
        }),
      ]);
      const result = analyzeTripTrouble(horse);
      // Should find multiple high-confidence keywords
      expect(result.troubledRaces[0]?.troubleKeywords.length).toBeGreaterThanOrEqual(2);
    });
  });
});
