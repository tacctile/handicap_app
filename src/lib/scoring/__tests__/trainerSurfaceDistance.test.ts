/**
 * Tests for Trainer Surface/Distance Specialization Scoring
 *
 * Tests the calculateTrainerSurfaceDistanceBonus function which awards
 * bonus points based on trainer's win percentage in specific categories:
 * - turf sprint, turf route, dirt sprint, dirt route
 * - wet track (stacks with surface/distance)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTrainerSurfaceDistanceBonus,
  MAX_TRAINER_SURFACE_DISTANCE_POINTS,
} from '../connections';
import type { HorseEntry, RaceHeader, TrainerCategoryStats } from '../../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../../types/drf';

// Helper to create minimal horse entry with trainer category stats
function createTestHorse(trainerCategoryStats: Partial<TrainerCategoryStats> = {}): HorseEntry {
  const defaultStats = createDefaultTrainerCategoryStats();
  return {
    programNumber: 1,
    entryIndicator: '',
    postPosition: 1,
    horseName: 'Test Horse',
    age: 4,
    sex: 'c',
    sexFull: 'Colt',
    color: 'bay',
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
    silks: 'Red and White',
    trainerName: 'Test Trainer',
    trainerStats: '10-3-2-1',
    trainerMeetStarts: 10,
    trainerMeetWins: 3,
    trainerMeetPlaces: 2,
    trainerMeetShows: 1,
    trainerCategoryStats: { ...defaultStats, ...trainerCategoryStats },
    jockeyName: 'Test Jockey',
    jockeyStats: '20-5-4-3',
    jockeyMeetStarts: 20,
    jockeyMeetWins: 5,
    jockeyMeetPlaces: 4,
    jockeyMeetShows: 3,
    weight: 120,
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
      lasix: false,
      lasixFirstTime: false,
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
    lifetimeEarnings: 50000,
    currentYearStarts: 5,
    currentYearWins: 1,
    currentYearPlaces: 2,
    currentYearShows: 1,
    currentYearEarnings: 25000,
    previousYearStarts: 5,
    previousYearWins: 1,
    previousYearPlaces: 1,
    previousYearShows: 1,
    previousYearEarnings: 25000,
    trackStarts: 3,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 0,
    surfaceStarts: 8,
    surfaceWins: 2,
    distanceStarts: 4,
    distanceWins: 1,
    distancePlaces: 1,
    distanceShows: 1,
    turfStarts: 0,
    turfWins: 0,
    turfPlaces: 0,
    turfShows: 0,
    wetStarts: 0,
    wetWins: 0,
    wetPlaces: 0,
    wetShows: 0,
    daysSinceLastRace: 21,
    lastRaceDate: '2024-01-01',
    averageBeyer: 80,
    bestBeyer: 85,
    lastBeyer: 78,
    earlySpeedRating: 95,
    runningStyle: 'E',
    pedigreeRating: null,
    claimingPrice: null,
    lastClaimPrice: null,
    trainerAngle: null,
    workouts: [],
    pastPerformances: [],
    isScratched: false,
    scratchReason: null,
    isCoupledMain: false,
    coupledWith: [],
    rawLine: '',
  };
}

// Helper to create race header
function createTestRaceHeader(overrides: Partial<RaceHeader> = {}): RaceHeader {
  return {
    trackCode: 'SAR',
    trackName: 'Saratoga',
    trackLocation: 'Saratoga Springs, NY',
    raceNumber: 1,
    raceDate: '2024-08-01',
    raceDateRaw: '20240801',
    postTime: '1:00 PM',
    distanceFurlongs: 6, // Sprint by default
    distance: '6 furlongs',
    distanceExact: '6f',
    surface: 'turf', // Turf by default
    trackCondition: 'firm', // Good/fast by default
    classification: 'allowance',
    raceType: 'Allowance',
    purse: 100000,
    purseFormatted: '$100,000',
    ageRestriction: '3&UP',
    sexRestriction: '',
    weightConditions: '',
    stateBred: null,
    claimingPriceMin: null,
    claimingPriceMax: null,
    allowedWeight: null,
    conditions: 'For three year olds and upward',
    raceName: null,
    grade: null,
    isListed: false,
    isAbout: false,
    tempRail: null,
    turfCourseType: null,
    chuteStart: false,
    hasReplay: false,
    programNumber: 1,
    fieldSize: 8,
    probableFavorite: null,
    ...overrides,
  };
}

describe('calculateTrainerSurfaceDistanceBonus', () => {
  describe('Turf Sprint Scoring', () => {
    it('should award 4 points for trainer with 28% turf sprints (25%+ tier)', () => {
      const horse = createTestHorse({
        turfSprint: { starts: 10, wins: 3, winPercent: 28, roi: 1.5 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'turf',
        distanceFurlongs: 6,
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.bonus).toBe(4);
      expect(result.matchedCategory).toBe('turf sprints');
      expect(result.trainerWinPercent).toBe(28);
      expect(result.reasoning).toContain('28%');
      expect(result.reasoning).toContain('turf sprints');
      expect(result.reasoning).toContain('+4pts');
    });

    it('should award 3 points for trainer with 22% turf sprints (20-24% tier)', () => {
      const horse = createTestHorse({
        turfSprint: { starts: 10, wins: 2, winPercent: 22, roi: 1.2 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'turf',
        distanceFurlongs: 6,
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.bonus).toBe(3);
      expect(result.trainerWinPercent).toBe(22);
    });

    it('should award 2 points for trainer with 17% turf sprints (15-19% tier)', () => {
      const horse = createTestHorse({
        turfSprint: { starts: 12, wins: 2, winPercent: 17, roi: 1.0 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'turf',
        distanceFurlongs: 6,
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.bonus).toBe(2);
    });

    it('should award 1 point for trainer with 12% turf sprints (10-14% tier)', () => {
      const horse = createTestHorse({
        turfSprint: { starts: 10, wins: 1, winPercent: 12, roi: 0.8 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'turf',
        distanceFurlongs: 6,
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.bonus).toBe(1);
    });

    it('should award 0 points for trainer with 8% turf sprints (<10% tier)', () => {
      const horse = createTestHorse({
        turfSprint: { starts: 10, wins: 1, winPercent: 8, roi: 0.5 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'turf',
        distanceFurlongs: 6,
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.bonus).toBe(0);
    });
  });

  describe('Dirt Route Scoring', () => {
    it('should award 3 points for trainer with 22% dirt routes', () => {
      const horse = createTestHorse({
        dirtRoute: { starts: 15, wins: 3, winPercent: 22, roi: 1.3 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'dirt',
        distanceFurlongs: 9, // Route
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.bonus).toBe(3);
      expect(result.matchedCategory).toBe('dirt routes');
      expect(result.trainerWinPercent).toBe(22);
    });

    it('should correctly identify route vs sprint (8f threshold)', () => {
      const horse = createTestHorse({
        dirtRoute: { starts: 10, wins: 3, winPercent: 25, roi: 1.5 },
        dirtSprint: { starts: 10, wins: 1, winPercent: 10, roi: 0.8 },
      });

      // At exactly 8f, should be route
      const raceHeader8f = createTestRaceHeader({
        surface: 'dirt',
        distanceFurlongs: 8,
      });
      const result8f = calculateTrainerSurfaceDistanceBonus(horse, raceHeader8f);
      expect(result8f.matchedCategory).toBe('dirt routes');
      expect(result8f.bonus).toBe(4); // 25% = 4pts

      // At 7.5f, should be sprint
      const raceHeader7f = createTestRaceHeader({
        surface: 'dirt',
        distanceFurlongs: 7.5,
      });
      const result7f = calculateTrainerSurfaceDistanceBonus(horse, raceHeader7f);
      expect(result7f.matchedCategory).toBe('dirt sprints');
      expect(result7f.bonus).toBe(1); // 10% = 1pt
    });
  });

  describe('Wet Track Stacking', () => {
    it('should stack wet track bonus with surface/distance bonus', () => {
      const horse = createTestHorse({
        dirtSprint: { starts: 10, wins: 3, winPercent: 25, roi: 1.5 },
        wetTrack: { starts: 10, wins: 3, winPercent: 25, roi: 1.6 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'dirt',
        distanceFurlongs: 6,
        trackCondition: 'muddy', // Wet condition
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      // 4 pts (25% dirt sprint) + 4 pts (25% wet) = 8, but capped at 6
      expect(result.bonus).toBe(6);
      expect(result.wetBonusApplied).toBe(true);
      expect(result.wetTrackWinPercent).toBe(25);
      expect(result.reasoning).toContain('capped');
    });

    it('should award wet bonus alone on wet track', () => {
      const horse = createTestHorse({
        dirtSprint: { starts: 10, wins: 1, winPercent: 8, roi: 0.5 }, // Below threshold
        wetTrack: { starts: 10, wins: 3, winPercent: 25, roi: 1.6 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'dirt',
        distanceFurlongs: 6,
        trackCondition: 'sloppy',
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.bonus).toBe(4); // Only wet track bonus
      expect(result.wetBonusApplied).toBe(true);
    });

    it('should recognize various wet track conditions', () => {
      const horse = createTestHorse({
        wetTrack: { starts: 10, wins: 3, winPercent: 28, roi: 1.6 },
        dirtSprint: { starts: 5, wins: 0, winPercent: 0, roi: 0 },
      });

      const wetConditions = ['muddy', 'sloppy', 'heavy', 'yielding', 'soft', 'slow'];

      for (const condition of wetConditions) {
        const raceHeader = createTestRaceHeader({
          surface: 'dirt',
          distanceFurlongs: 6,
          trackCondition: condition as RaceHeader['trackCondition'],
        });

        const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);
        expect(result.wetBonusApplied).toBe(true);
        expect(result.bonus).toBeGreaterThan(0);
      }
    });

    it('should not apply wet bonus on fast/firm tracks', () => {
      const horse = createTestHorse({
        dirtSprint: { starts: 10, wins: 3, winPercent: 25, roi: 1.5 },
        wetTrack: { starts: 10, wins: 3, winPercent: 25, roi: 1.6 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'dirt',
        distanceFurlongs: 6,
        trackCondition: 'fast',
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.bonus).toBe(4); // Only surface/distance
      expect(result.wetBonusApplied).toBe(false);
    });
  });

  describe('Missing or Insufficient Data', () => {
    it('should return 0 with no penalty for missing trainer stats', () => {
      const horse = createTestHorse();
      // @ts-expect-error - Testing null case
      horse.trainerCategoryStats = null;

      const raceHeader = createTestRaceHeader({
        surface: 'turf',
        distanceFurlongs: 6,
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.bonus).toBe(0);
      expect(result.matchedCategory).toBeNull();
      expect(result.reasoning).toBe('No trainer surface/distance data');
    });

    it('should return 0 for insufficient starts (less than 5)', () => {
      const horse = createTestHorse({
        turfSprint: { starts: 3, wins: 1, winPercent: 33, roi: 2.0 }, // Great rate but too few starts
      });
      const raceHeader = createTestRaceHeader({
        surface: 'turf',
        distanceFurlongs: 6,
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.bonus).toBe(0);
      expect(result.reasoning).toContain('need 5+');
    });

    it('should handle exactly 5 starts (minimum threshold)', () => {
      const horse = createTestHorse({
        turfRoute: { starts: 5, wins: 2, winPercent: 40, roi: 2.5 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'turf',
        distanceFurlongs: 10, // Route
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.bonus).toBe(4); // 40% = 4pts
    });
  });

  describe('Category Selection', () => {
    it('should select turf sprint for turf race under 8f', () => {
      const horse = createTestHorse({
        turfSprint: { starts: 10, wins: 3, winPercent: 30, roi: 2.0 },
        turfRoute: { starts: 10, wins: 1, winPercent: 10, roi: 0.8 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'turf',
        distanceFurlongs: 5.5,
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.matchedCategory).toBe('turf sprints');
      expect(result.bonus).toBe(4);
    });

    it('should select turf route for turf race at 8f or more', () => {
      const horse = createTestHorse({
        turfSprint: { starts: 10, wins: 1, winPercent: 10, roi: 0.8 },
        turfRoute: { starts: 10, wins: 3, winPercent: 30, roi: 2.0 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'turf',
        distanceFurlongs: 9,
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.matchedCategory).toBe('turf routes');
      expect(result.bonus).toBe(4);
    });

    it('should select dirt sprint for dirt race under 8f', () => {
      const horse = createTestHorse({
        dirtSprint: { starts: 10, wins: 3, winPercent: 30, roi: 2.0 },
        dirtRoute: { starts: 10, wins: 1, winPercent: 10, roi: 0.8 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'dirt',
        distanceFurlongs: 6,
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.matchedCategory).toBe('dirt sprints');
      expect(result.bonus).toBe(4);
    });

    it('should select dirt route for dirt race at 8f or more', () => {
      const horse = createTestHorse({
        dirtSprint: { starts: 10, wins: 1, winPercent: 10, roi: 0.8 },
        dirtRoute: { starts: 10, wins: 3, winPercent: 30, roi: 2.0 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'dirt',
        distanceFurlongs: 8.5,
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.matchedCategory).toBe('dirt routes');
      expect(result.bonus).toBe(4);
    });

    it('should treat synthetic as dirt', () => {
      const horse = createTestHorse({
        dirtSprint: { starts: 10, wins: 3, winPercent: 28, roi: 1.8 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'synthetic',
        distanceFurlongs: 6,
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.matchedCategory).toBe('dirt sprints');
      expect(result.bonus).toBe(4);
    });
  });

  describe('Maximum Score Cap', () => {
    it('should cap total at 6 points maximum', () => {
      const horse = createTestHorse({
        turfSprint: { starts: 20, wins: 8, winPercent: 40, roi: 3.0 }, // 4 pts
        wetTrack: { starts: 20, wins: 10, winPercent: 50, roi: 4.0 }, // 4 pts
      });
      const raceHeader = createTestRaceHeader({
        surface: 'turf',
        distanceFurlongs: 6,
        trackCondition: 'yielding', // Wet
      });

      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader);

      expect(result.bonus).toBe(MAX_TRAINER_SURFACE_DISTANCE_POINTS);
      expect(result.bonus).toBe(6);
    });
  });

  describe('Track Condition Override', () => {
    it('should use track condition override when provided', () => {
      const horse = createTestHorse({
        dirtSprint: { starts: 10, wins: 1, winPercent: 10, roi: 0.8 },
        wetTrack: { starts: 10, wins: 3, winPercent: 28, roi: 1.6 },
      });
      const raceHeader = createTestRaceHeader({
        surface: 'dirt',
        distanceFurlongs: 6,
        trackCondition: 'fast', // Header says fast
      });

      // Override with muddy
      const result = calculateTrainerSurfaceDistanceBonus(horse, raceHeader, 'muddy');

      expect(result.wetBonusApplied).toBe(true);
      expect(result.bonus).toBe(4 + 1); // 1 for 10% dirt sprint + 4 for wet
    });
  });
});

describe('Integration with ScoreBreakdown', () => {
  it('MAX_TRAINER_SURFACE_DISTANCE_POINTS should be 6', () => {
    expect(MAX_TRAINER_SURFACE_DISTANCE_POINTS).toBe(6);
  });
});
