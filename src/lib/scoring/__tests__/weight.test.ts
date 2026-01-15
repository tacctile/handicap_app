/**
 * Weight Analysis Module Tests
 *
 * Tests weight change analysis and scoring logic.
 * Per requirements:
 * - 5+ lb drop from last race: +1 pt
 * - 3-4 lb drop: +0.5 pt
 * - No significant change: 0 pts
 * - No last race weight available: 0 pts
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeWeightChange,
  calculateWeightScore,
  getWeightChangeSummary,
  hasWeightAdvantage,
  hasWeightDisadvantage,
  MAX_WEIGHT_POINTS,
} from '../weight';
import type { HorseEntry, RaceHeader, PastPerformance } from '../../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../../types/drf';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a minimal mock past performance for testing weight
 */
function createMockPP(weight: number): PastPerformance {
  return {
    date: '20240101',
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
    fieldSize: 10,
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
    weight,
    apprenticeAllowance: 0,
    equipment: '',
    medication: '',
    winner: 'Winner Horse',
    secondPlace: 'Second Horse',
    thirdPlace: 'This Horse',
    tripComment: '',
    comment: '',
    odds: 5.0,
    favoriteRank: 3,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: 21,
    earlyPace1: 90,
    latePace: 88,
    quarterTime: null,
    halfMileTime: null,
    sixFurlongTime: null,
    mileTime: null,
  };
}

/**
 * Create a minimal mock horse entry for testing
 */
function createMockHorse(currentWeight: number, lastRaceWeight: number | null): HorseEntry {
  const pastPerformances: PastPerformance[] =
    lastRaceWeight !== null ? [createMockPP(lastRaceWeight)] : [];

  return {
    programNumber: 1,
    entryIndicator: '',
    postPosition: 1,
    horseName: 'Test Horse',
    age: 4,
    sex: 'c',
    sexFull: 'Colt',
    color: 'b',
    breeding: {
      sire: 'Test Sire',
      sireOfSire: 'Test Grandsire',
      dam: 'Test Dam',
      damSire: 'Test Damsire',
      breeder: 'Test Breeder',
      whereBred: 'KY',
      studFee: null,
    },
    owner: 'Test Owner',
    silks: 'Red, White',
    trainerName: 'Test Trainer',
    trainerStats: '',
    trainerMeetStarts: 50,
    trainerMeetWins: 10,
    trainerMeetPlaces: 8,
    trainerMeetShows: 7,
    trainerCategoryStats: createDefaultTrainerCategoryStats(),
    jockeyName: 'Test Jockey',
    jockeyStats: '',
    jockeyMeetStarts: 100,
    jockeyMeetWins: 20,
    jockeyMeetPlaces: 18,
    jockeyMeetShows: 15,
    weight: currentWeight,
    apprenticeAllowance: 0,
    equipment: {
      blinkers: false,
      blinkersOff: false,
      frontBandages: false,
      rearBandages: false,
      barShoes: false,
      mudCaulks: false,
      tongueTie: false,
      nasalStrip: false,
      shadowRoll: false,
      cheekPieces: false,
      firstTimeEquipment: [],
      equipmentChanges: [],
      raw: '',
    },
    medication: {
      lasixFirstTime: false,
      lasix: false,
      lasixOff: false,
      bute: false,
      other: [],
      raw: '',
    },
    morningLineOdds: '5-1',
    morningLineDecimal: 5.0,
    currentOdds: null,
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimePlaces: 3,
    lifetimeShows: 2,
    lifetimeEarnings: 100000,
    currentYearStarts: 5,
    currentYearWins: 1,
    currentYearPlaces: 2,
    currentYearShows: 1,
    currentYearEarnings: 50000,
    previousYearStarts: 5,
    previousYearWins: 1,
    previousYearPlaces: 1,
    previousYearShows: 1,
    previousYearEarnings: 50000,
    trackStarts: 3,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 0,
    surfaceStarts: 8,
    surfaceWins: 2,
    distanceStarts: 5,
    distanceWins: 1,
    distancePlaces: 2,
    distanceShows: 1,
    turfStarts: 2,
    turfWins: 0,
    turfPlaces: 1,
    turfShows: 1,
    wetStarts: 1,
    wetWins: 0,
    wetPlaces: 0,
    wetShows: 1,
    daysSinceLastRace: 21,
    lastRaceDate: '20240101',
    averageBeyer: 82,
    bestBeyer: 88,
    lastBeyer: 85,
    earlySpeedRating: 85,
    runningStyle: 'E/P',
    pedigreeRating: null,
    claimingPrice: null,
    lastClaimPrice: null,
    trainerAngle: null,
    workouts: [],
    pastPerformances,
    isScratched: false,
    scratchReason: null,
    isCoupledMain: false,
    coupledWith: [],
    rawLine: '',
    salePrice: null,
    saleLocation: null,
  };
}

/**
 * Create a mock race header
 */
function createMockRaceHeader(
  classification: RaceHeader['classification'] = 'allowance'
): RaceHeader {
  return {
    trackCode: 'SAR',
    trackName: 'Saratoga',
    trackLocation: 'Saratoga Springs, NY',
    raceNumber: 5,
    raceDate: '2024-06-15',
    raceDateRaw: '20240615',
    postTime: '3:45 PM',
    distanceFurlongs: 6,
    distance: '6 furlongs',
    distanceExact: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification,
    raceType: 'Allowance',
    purse: 75000,
    purseFormatted: '$75,000',
    ageRestriction: '3&UP',
    sexRestriction: '',
    weightConditions: '',
    stateBred: null,
    claimingPriceMin: null,
    claimingPriceMax: null,
    allowedWeight: null,
    conditions: 'Allowance',
    raceName: null,
    grade: null,
    isListed: false,
    isAbout: false,
    tempRail: null,
    turfCourseType: null,
    chuteStart: false,
    hasReplay: false,
    programNumber: 5,
    fieldSize: 10,
    probableFavorite: null,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Weight Analysis Module', () => {
  describe('analyzeWeightChange', () => {
    it('should detect significant weight drop (5+ lbs)', () => {
      const horse = createMockHorse(118, 124); // 6 lb drop
      const result = analyzeWeightChange(horse);

      expect(result.currentWeight).toBe(118);
      expect(result.lastRaceWeight).toBe(124);
      expect(result.weightChange).toBe(-6);
      expect(result.significantDrop).toBe(true);
      expect(result.significantGain).toBe(false);
      expect(result.reasoning).toContain('Significant drop');
    });

    it('should detect moderate weight drop (3-4 lbs)', () => {
      const horse = createMockHorse(119, 122); // 3 lb drop
      const result = analyzeWeightChange(horse);

      expect(result.weightChange).toBe(-3);
      expect(result.significantDrop).toBe(false);
      expect(result.significantGain).toBe(false);
      expect(result.reasoning).toContain('Moderate drop');
    });

    it('should detect significant weight gain (5+ lbs)', () => {
      const horse = createMockHorse(126, 120); // 6 lb gain
      const result = analyzeWeightChange(horse);

      expect(result.weightChange).toBe(6);
      expect(result.significantDrop).toBe(false);
      expect(result.significantGain).toBe(true);
      expect(result.reasoning).toContain('Significant gain');
    });

    it('should detect no change (same weight)', () => {
      const horse = createMockHorse(120, 120);
      const result = analyzeWeightChange(horse);

      expect(result.weightChange).toBe(0);
      expect(result.significantDrop).toBe(false);
      expect(result.significantGain).toBe(false);
      expect(result.reasoning).toContain('Same weight');
    });

    it('should handle first-time starter (no PP data)', () => {
      const horse = createMockHorse(120, null);
      const result = analyzeWeightChange(horse);

      expect(result.currentWeight).toBe(120);
      expect(result.lastRaceWeight).toBe(null);
      expect(result.weightChange).toBe(null);
      expect(result.significantDrop).toBe(false);
      expect(result.significantGain).toBe(false);
      expect(result.reasoning).toContain('No weight history');
    });
  });

  describe('calculateWeightScore', () => {
    it('should award +1 point for 5+ lb drop', () => {
      const horse = createMockHorse(118, 124); // 6 lb drop
      const raceHeader = createMockRaceHeader();
      const result = calculateWeightScore(horse, raceHeader);

      expect(result.total).toBe(1);
      expect(result.reasoning).toContain('Weight drop bonus (+1)');
    });

    it('should award +0.5 points for 3-4 lb drop', () => {
      const horse = createMockHorse(119, 122); // 3 lb drop
      const raceHeader = createMockRaceHeader();
      const result = calculateWeightScore(horse, raceHeader);

      expect(result.total).toBe(0.5);
      expect(result.reasoning).toContain('Moderate drop bonus (+0.5)');
    });

    it('should award 0 points for no significant change', () => {
      const horse = createMockHorse(120, 121); // 1 lb gain - minor change
      const raceHeader = createMockRaceHeader();
      const result = calculateWeightScore(horse, raceHeader);

      expect(result.total).toBe(0);
      expect(result.showWeightGainFlag).toBe(false);
    });

    it('should award 0 points when no last race weight available', () => {
      const horse = createMockHorse(120, null);
      const raceHeader = createMockRaceHeader();
      const result = calculateWeightScore(horse, raceHeader);

      expect(result.total).toBe(0);
      expect(result.showWeightGainFlag).toBe(false);
    });

    it('should flag significant weight gain but not subtract points', () => {
      const horse = createMockHorse(126, 120); // 6 lb gain
      const raceHeader = createMockRaceHeader();
      const result = calculateWeightScore(horse, raceHeader);

      expect(result.total).toBe(0); // No deduction per requirements
      expect(result.showWeightGainFlag).toBe(true);
      expect(result.reasoning).toContain('Note: significant weight gain');
    });

    it('should note handicap race for significant weight gain', () => {
      const horse = createMockHorse(126, 120); // 6 lb gain
      const raceHeader = createMockRaceHeader('handicap');
      const result = calculateWeightScore(horse, raceHeader);

      expect(result.total).toBe(0); // No deduction
      expect(result.showWeightGainFlag).toBe(true);
      expect(result.isHandicapRace).toBe(true);
      expect(result.reasoning).toContain('handicap race');
    });

    it('should not exceed MAX_WEIGHT_POINTS', () => {
      const horse = createMockHorse(110, 125); // 15 lb drop (extreme)
      const raceHeader = createMockRaceHeader();
      const result = calculateWeightScore(horse, raceHeader);

      expect(result.total).toBeLessThanOrEqual(MAX_WEIGHT_POINTS);
      expect(result.total).toBe(1);
    });
  });

  describe('getWeightChangeSummary', () => {
    it('should return positive indicator for weight drop', () => {
      const horse = createMockHorse(118, 124);
      const summary = getWeightChangeSummary(horse);

      expect(summary.indicator).toBe('positive');
      expect(summary.label).toContain('6 lbs');
    });

    it('should return negative indicator for weight gain', () => {
      const horse = createMockHorse(126, 120);
      const summary = getWeightChangeSummary(horse);

      expect(summary.indicator).toBe('negative');
      expect(summary.label).toContain('6 lbs');
    });

    it('should return neutral indicator for same weight', () => {
      const horse = createMockHorse(120, 120);
      const summary = getWeightChangeSummary(horse);

      expect(summary.indicator).toBe('neutral');
      expect(summary.label).toBe('Same');
    });

    it('should return N/A for first-time starters', () => {
      const horse = createMockHorse(120, null);
      const summary = getWeightChangeSummary(horse);

      expect(summary.indicator).toBe('neutral');
      expect(summary.label).toBe('N/A');
    });
  });

  describe('hasWeightAdvantage', () => {
    it('should return true for significant drop', () => {
      const horse = createMockHorse(118, 124);
      expect(hasWeightAdvantage(horse)).toBe(true);
    });

    it('should return true for moderate drop', () => {
      const horse = createMockHorse(119, 122);
      expect(hasWeightAdvantage(horse)).toBe(true);
    });

    it('should return false for no change', () => {
      const horse = createMockHorse(120, 120);
      expect(hasWeightAdvantage(horse)).toBe(false);
    });

    it('should return false for weight gain', () => {
      const horse = createMockHorse(126, 120);
      expect(hasWeightAdvantage(horse)).toBe(false);
    });
  });

  describe('hasWeightDisadvantage', () => {
    it('should return true for significant gain', () => {
      const horse = createMockHorse(126, 120);
      expect(hasWeightDisadvantage(horse)).toBe(true);
    });

    it('should return false for moderate gain', () => {
      const horse = createMockHorse(123, 120); // 3 lb gain - not significant
      expect(hasWeightDisadvantage(horse)).toBe(false);
    });

    it('should return false for weight drop', () => {
      const horse = createMockHorse(118, 124);
      expect(hasWeightDisadvantage(horse)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero current weight gracefully', () => {
      const horse = createMockHorse(0, 120);
      const result = analyzeWeightChange(horse);

      expect(result.weightChange).toBe(null);
      expect(result.reasoning).toContain('Current weight not available');
    });

    it('should handle zero PP weight gracefully', () => {
      // Create horse with PP but weight = 0
      const horse = createMockHorse(120, null);
      horse.pastPerformances = [createMockPP(0)]; // PP with 0 weight
      const result = analyzeWeightChange(horse);

      expect(result.lastRaceWeight).toBe(null);
      expect(result.weightChange).toBe(null);
    });

    it('should handle exactly 5 lb drop threshold', () => {
      const horse = createMockHorse(115, 120); // exactly 5 lb drop
      const raceHeader = createMockRaceHeader();
      const result = calculateWeightScore(horse, raceHeader);

      expect(result.total).toBe(1); // Should get full bonus
      expect(result.analysis.significantDrop).toBe(true);
    });

    it('should handle exactly 3 lb drop threshold', () => {
      const horse = createMockHorse(117, 120); // exactly 3 lb drop
      const raceHeader = createMockRaceHeader();
      const result = calculateWeightScore(horse, raceHeader);

      expect(result.total).toBe(0.5); // Should get moderate bonus
    });

    it('should handle 2 lb drop (below threshold)', () => {
      const horse = createMockHorse(118, 120); // 2 lb drop
      const raceHeader = createMockRaceHeader();
      const result = calculateWeightScore(horse, raceHeader);

      expect(result.total).toBe(0); // No bonus
    });
  });
});
