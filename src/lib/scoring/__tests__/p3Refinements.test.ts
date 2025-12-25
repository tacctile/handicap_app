/**
 * P3 Refinements Tests
 *
 * Tests for the three P3 final refinements:
 * 1. Earnings-based class indicator
 * 2. Sire's sire analysis
 * 3. Age-based peak performance
 */

import { describe, it, expect } from 'vitest';
import {
  getEarningsClassIndicator,
  getEarningsClassColor,
  analyzeSiresSire,
  analyzeAgeFactor,
  getPeakStatusColor,
  getPeakStatusLabel,
  calculateP3Refinements,
  P3_MAX_ADJUSTMENT,
} from '../p3Refinements';
import type { HorseEntry, RaceHeader } from '../../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../../types/drf';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockHorse(overrides: Partial<HorseEntry> = {}): HorseEntry {
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
      sireOfSire: 'A.P. INDY',
      dam: 'Test Dam',
      damSire: 'Test Damsire',
      breeder: 'Test Breeder',
      whereBred: 'KY',
      studFee: null,
    },
    owner: 'Test Owner',
    silks: 'Red and White',
    trainerName: 'Test Trainer',
    trainerStats: '10-2-2-1',
    trainerMeetStarts: 10,
    trainerMeetWins: 2,
    trainerMeetPlaces: 2,
    trainerMeetShows: 1,
    trainerCategoryStats: createDefaultTrainerCategoryStats(),
    jockeyName: 'Test Jockey',
    jockeyStats: '100-20-15-10',
    jockeyMeetStarts: 100,
    jockeyMeetWins: 20,
    jockeyMeetPlaces: 15,
    jockeyMeetShows: 10,
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
      lasixFirstTime: false,
      lasix: false,
      lasixOff: false,
      bute: false,
      other: [],
      raw: '',
    },
    morningLineOdds: '5-1',
    morningLineDecimal: 5,
    currentOdds: null,
    lifetimeStarts: 10,
    lifetimeWins: 3,
    lifetimePlaces: 2,
    lifetimeShows: 1,
    lifetimeEarnings: 500000,
    currentYearStarts: 5,
    currentYearWins: 2,
    currentYearPlaces: 1,
    currentYearShows: 1,
    currentYearEarnings: 250000,
    previousYearStarts: 5,
    previousYearWins: 1,
    previousYearPlaces: 1,
    previousYearShows: 0,
    previousYearEarnings: 250000,
    trackStarts: 3,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 0,
    surfaceStarts: 8,
    surfaceWins: 2,
    distanceStarts: 5,
    distanceWins: 2,
    distancePlaces: 1,
    distanceShows: 1,
    turfStarts: 0,
    turfWins: 0,
    turfPlaces: 0,
    turfShows: 0,
    wetStarts: 2,
    wetWins: 1,
    wetPlaces: 0,
    wetShows: 0,
    daysSinceLastRace: 30,
    lastRaceDate: '20241001',
    averageBeyer: 85,
    bestBeyer: 90,
    lastBeyer: 85,
    earlySpeedRating: 70,
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
    ...overrides,
  };
}

function createMockRaceHeader(overrides: Partial<RaceHeader> = {}): RaceHeader {
  return {
    trackCode: 'CD',
    trackName: 'Churchill Downs',
    trackLocation: 'Louisville, KY',
    raceNumber: 1,
    raceDate: '2024-10-15',
    raceDateRaw: '20241015',
    postTime: '1:00 PM',
    distanceFurlongs: 8,
    distance: '1 Mile',
    distanceExact: '1 Mile',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'allowance',
    raceType: 'Allowance',
    purse: 100000,
    purseFormatted: '$100,000',
    ageRestriction: '3&UP',
    sexRestriction: '',
    weightConditions: 'Standard',
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
    programNumber: 1,
    fieldSize: 10,
    probableFavorite: null,
    ...overrides,
  };
}

// ============================================================================
// PART 1: EARNINGS-BASED CLASS INDICATOR TESTS
// ============================================================================

describe('Earnings-Based Class Indicator (Part 1)', () => {
  describe('getEarningsClassIndicator', () => {
    it('should classify $75k avg earnings as elite', () => {
      const horse = createMockHorse({
        lifetimeEarnings: 750000,
        lifetimeStarts: 10,
        currentYearEarnings: 300000,
      });

      const result = getEarningsClassIndicator(horse);

      expect(result.earningsClass).toBe('elite');
      expect(result.avgEarningsPerStart).toBe(75000);
      expect(result.lifetimeEarnings).toBe(750000);
      expect(result.reasoning).toContain('Elite');
    });

    it('should classify $50k+ avg earnings as elite', () => {
      const horse = createMockHorse({
        lifetimeEarnings: 500000,
        lifetimeStarts: 10,
      });

      const result = getEarningsClassIndicator(horse);

      expect(result.earningsClass).toBe('elite');
      expect(result.avgEarningsPerStart).toBe(50000);
    });

    it('should classify $30k avg earnings as strong', () => {
      const horse = createMockHorse({
        lifetimeEarnings: 300000,
        lifetimeStarts: 10,
      });

      const result = getEarningsClassIndicator(horse);

      expect(result.earningsClass).toBe('strong');
      expect(result.avgEarningsPerStart).toBe(30000);
    });

    it('should classify $10k avg earnings as average', () => {
      const horse = createMockHorse({
        lifetimeEarnings: 100000,
        lifetimeStarts: 10,
      });

      const result = getEarningsClassIndicator(horse);

      expect(result.earningsClass).toBe('average');
      expect(result.avgEarningsPerStart).toBe(10000);
    });

    it('should classify $3k avg earnings as low', () => {
      const horse = createMockHorse({
        lifetimeEarnings: 30000,
        lifetimeStarts: 10,
      });

      const result = getEarningsClassIndicator(horse);

      expect(result.earningsClass).toBe('low');
      expect(result.avgEarningsPerStart).toBe(3000);
    });

    it('should handle first-time starters with 0 starts', () => {
      const horse = createMockHorse({
        lifetimeEarnings: 0,
        lifetimeStarts: 0,
      });

      const result = getEarningsClassIndicator(horse);

      expect(result.earningsClass).toBe('low');
      expect(result.avgEarningsPerStart).toBe(0);
      expect(result.reasoning).toContain('First-time starter');
    });
  });

  describe('getEarningsClassColor', () => {
    it('should return correct colors for each class', () => {
      expect(getEarningsClassColor('elite')).toBe('#22c55e');
      expect(getEarningsClassColor('strong')).toBe('#36d1da');
      expect(getEarningsClassColor('average')).toBe('#888888');
      expect(getEarningsClassColor('low')).toBe('#ef4444');
    });
  });
});

// ============================================================================
// PART 2: SIRE'S SIRE ANALYSIS TESTS
// ============================================================================

describe("Sire's Sire Analysis (Part 2)", () => {
  describe('analyzeSiresSire', () => {
    it('should recognize known influential sire A.P. INDY on dirt routes', () => {
      const result = analyzeSiresSire('A.P. Indy', 'dirt', 9);

      expect(result.known).toBe(true);
      expect(result.siresSireName).toBe('A.P. Indy');
      expect(result.surfaceAffinity).toBeGreaterThan(0);
      expect(result.distanceAffinity).toBeGreaterThan(0);
      expect(result.adjustment).toBe(1); // Strong fit
      expect(result.reasoning).toContain('A.P. Indy');
    });

    it('should give +1 breeding for known influential turf sire on turf', () => {
      const result = analyzeSiresSire('WAR FRONT', 'turf', 7);

      expect(result.known).toBe(true);
      expect(result.surfaceAffinity).toBeGreaterThan(0);
      expect(result.adjustment).toBe(1);
    });

    it('should give no adjustment for unknown sire', () => {
      const result = analyzeSiresSire('Unknown Sire Name', 'dirt', 8);

      expect(result.known).toBe(false);
      expect(result.adjustment).toBe(0);
      expect(result.reasoning).toContain('Unknown');
    });

    it('should handle surface mismatch for turf sire on dirt', () => {
      const result = analyzeSiresSire('GALILEO', 'dirt', 10);

      expect(result.known).toBe(true);
      expect(result.surfaceAffinity).toBeLessThan(0);
      // Adjustment may be negative or neutral depending on distance fit
    });

    it('should handle STORM CAT as versatile sire', () => {
      const result = analyzeSiresSire('Storm Cat', 'dirt', 6);

      expect(result.known).toBe(true);
      // Storm Cat is versatile surface but sprint preferred
      expect(result.distanceAffinity).toBeGreaterThan(0); // Sprint distance match
    });

    it('should handle empty sire name', () => {
      const result = analyzeSiresSire('', 'dirt', 8);

      expect(result.known).toBe(false);
      expect(result.adjustment).toBe(0);
    });
  });
});

// ============================================================================
// PART 3: AGE-BASED PEAK PERFORMANCE TESTS
// ============================================================================

describe('Age-Based Peak Performance (Part 3)', () => {
  describe('analyzeAgeFactor', () => {
    it('should classify 2yo as developing with no adjustment', () => {
      const result = analyzeAgeFactor(2, 'dirt');

      expect(result.peakStatus).toBe('developing');
      expect(result.adjustment).toBe(0);
      expect(result.reasoning).toContain('2yo');
    });

    it('should classify 3yo as peak with no adjustment', () => {
      const result = analyzeAgeFactor(3, 'dirt');

      expect(result.peakStatus).toBe('peak');
      expect(result.adjustment).toBe(0);
      expect(result.reasoning).toContain('3yo');
    });

    it('should give +1 peak bonus for 4yo horse', () => {
      const result = analyzeAgeFactor(4, 'dirt');

      expect(result.peakStatus).toBe('peak');
      expect(result.adjustment).toBe(1);
      expect(result.reasoning).toContain('4yo');
      expect(result.reasoning).toContain('+1');
    });

    it('should give +1 peak bonus for 5yo horse', () => {
      const result = analyzeAgeFactor(5, 'turf');

      expect(result.peakStatus).toBe('peak');
      expect(result.adjustment).toBe(1);
    });

    it('should classify 6yo as mature with no adjustment', () => {
      const result = analyzeAgeFactor(6, 'dirt');

      expect(result.peakStatus).toBe('mature');
      expect(result.adjustment).toBe(0);
    });

    it('should classify 7yo as mature with no adjustment', () => {
      const result = analyzeAgeFactor(7, 'dirt');

      expect(result.peakStatus).toBe('mature');
      expect(result.adjustment).toBe(0);
    });

    it('should flag 8yo as declining with -1 adjustment', () => {
      const result = analyzeAgeFactor(8, 'dirt');

      expect(result.peakStatus).toBe('declining');
      expect(result.adjustment).toBe(-1);
      expect(result.reasoning).toContain('-1');
    });

    it('should flag 9yo as declining with -1 adjustment', () => {
      const result = analyzeAgeFactor(9, 'dirt');

      expect(result.peakStatus).toBe('declining');
      expect(result.adjustment).toBe(-1);
    });

    it('should flag 10yo as declining with -1 adjustment on turf (stamina concerns)', () => {
      const result = analyzeAgeFactor(10, 'turf');

      expect(result.peakStatus).toBe('declining');
      expect(result.adjustment).toBe(-1);
      expect(result.reasoning).toContain('turf');
    });
  });

  describe('getPeakStatusColor', () => {
    it('should return correct colors for each status', () => {
      expect(getPeakStatusColor('developing')).toBe('#3b82f6');
      expect(getPeakStatusColor('peak')).toBe('#22c55e');
      expect(getPeakStatusColor('mature')).toBe('#888888');
      expect(getPeakStatusColor('declining')).toBe('#ef4444');
    });
  });

  describe('getPeakStatusLabel', () => {
    it('should return correct labels for each status', () => {
      expect(getPeakStatusLabel('developing')).toBe('Developing');
      expect(getPeakStatusLabel('peak')).toBe('Peak');
      expect(getPeakStatusLabel('mature')).toBe('Mature');
      expect(getPeakStatusLabel('declining')).toBe('Declining');
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('P3 Refinements Integration', () => {
  describe('calculateP3Refinements', () => {
    it('should calculate all three refinements together', () => {
      const horse = createMockHorse({
        age: 4,
        lifetimeEarnings: 500000,
        lifetimeStarts: 10,
        breeding: {
          sire: 'Test Sire',
          sireOfSire: 'A.P. INDY',
          dam: 'Test Dam',
          damSire: 'Test Damsire',
          breeder: 'Test Breeder',
          whereBred: 'KY',
          studFee: null,
        },
      });
      const raceHeader = createMockRaceHeader({
        surface: 'dirt',
        distanceFurlongs: 9,
      });

      const result = calculateP3Refinements(horse, raceHeader);

      // Check earnings
      expect(result.earnings.earningsClass).toBe('elite');
      expect(result.earnings.avgEarningsPerStart).toBe(50000);

      // Check sire's sire
      expect(result.siresSire.known).toBe(true);
      expect(result.siresSire.adjustment).toBe(1);

      // Check age factor
      expect(result.ageFactor.peakStatus).toBe('peak');
      expect(result.ageFactor.adjustment).toBe(1);

      // Check total adjustment (only age factor goes to base, sire's sire to breeding)
      expect(result.totalAdjustment).toBe(1); // Only age factor
    });

    it('should handle horse with no known sire sire and declining age', () => {
      const horse = createMockHorse({
        age: 9,
        lifetimeEarnings: 50000,
        lifetimeStarts: 20,
        breeding: {
          sire: 'Unknown Sire',
          sireOfSire: 'Unknown Grandsire',
          dam: 'Test Dam',
          damSire: 'Test Damsire',
          breeder: 'Test Breeder',
          whereBred: 'KY',
          studFee: null,
        },
      });
      const raceHeader = createMockRaceHeader();

      const result = calculateP3Refinements(horse, raceHeader);

      // Check earnings (low)
      expect(result.earnings.earningsClass).toBe('low');

      // Check sire's sire (unknown)
      expect(result.siresSire.known).toBe(false);
      expect(result.siresSire.adjustment).toBe(0);

      // Check age factor (declining)
      expect(result.ageFactor.peakStatus).toBe('declining');
      expect(result.ageFactor.adjustment).toBe(-1);

      expect(result.totalAdjustment).toBe(-1);
    });

    it('should return reasoning for display', () => {
      const horse = createMockHorse({
        age: 4,
        lifetimeEarnings: 750000,
        lifetimeStarts: 10,
        breeding: {
          sire: 'Test Sire',
          sireOfSire: 'INTO MISCHIEF',
          dam: 'Test Dam',
          damSire: 'Test Damsire',
          breeder: 'Test Breeder',
          whereBred: 'KY',
          studFee: null,
        },
      });
      const raceHeader = createMockRaceHeader({
        surface: 'dirt',
        distanceFurlongs: 7,
      });

      const result = calculateP3Refinements(horse, raceHeader);

      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning.some((r) => r.includes('Earnings'))).toBe(true);
    });
  });

  describe('P3_MAX_ADJUSTMENT constant', () => {
    it('should be 2 (±1 from age, ±1 from sires sire integrated into breeding)', () => {
      expect(P3_MAX_ADJUSTMENT).toBe(2);
    });
  });
});
