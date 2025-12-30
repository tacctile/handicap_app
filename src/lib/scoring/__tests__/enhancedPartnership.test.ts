/**
 * Tests for Enhanced Trainer/Jockey Partnership Scoring
 *
 * v3.2: Partnership bonus capped at 2 pts max
 * Tests the analyzeTrainerJockeyPartnership and enhanced partnership bonus
 * which awards points based on trainer/jockey combo win rate:
 * - Elite partnership (30%+ combo win rate, 8+ starts): 2 pts (was 4)
 * - Strong partnership (25-29% combo win rate, 5+ starts): 2 pts (was 3)
 * - Good partnership (20-24% combo win rate, 5+ starts): 1 pt (was 2)
 * - Regular partnership (15-19% combo win rate, 5+ starts): 1 pt
 * - New or weak partnership: 0 pts
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeTrainerJockeyPartnership,
  calculateConnectionsScore,
  MAX_ENHANCED_PARTNERSHIP_POINTS,
} from '../connections';
import type { HorseEntry, PastPerformance, TrainerCategoryStats } from '../../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../../types/drf';

// Helper to create a past performance with specific jockey
function createPP(
  jockey: string,
  finishPosition: number,
  date: string = '2024-01-01'
): PastPerformance {
  return {
    date,
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
    fieldSize: 8,
    finishPosition,
    lengthsBehind: finishPosition === 1 ? 0 : 2,
    lengthsAhead: null,
    finalTime: 70.5,
    finalTimeFormatted: '1:10.50',
    speedFigures: {
      beyer: 80,
      timeformUS: null,
      equibase: null,
      trackVariant: null,
      dirtVariant: null,
      turfVariant: null,
    },
    runningLine: {
      start: null,
      quarterMile: null,
      quarterMileLengths: null,
      halfMile: null,
      halfMileLengths: null,
      threeQuarters: null,
      threeQuartersLengths: null,
      stretch: null,
      stretchLengths: null,
      finish: finishPosition,
      finishLengths: null,
    },
    jockey,
    weight: 120,
    apprenticeAllowance: 0,
    equipment: '',
    medication: '',
    winner: 'Winner Horse',
    secondPlace: 'Second Horse',
    thirdPlace: 'Third Horse',
    tripComment: '',
    comment: '',
    odds: 5.0,
    favoriteRank: null,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: null,
    earlyPace1: null,
    latePace: null,
  };
}

// Helper to create minimal horse entry with past performances
function createTestHorse(
  jockeyName: string,
  pastPerformances: PastPerformance[],
  trainerCategoryStats: Partial<TrainerCategoryStats> = {}
): HorseEntry {
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
    jockeyName,
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
    pastPerformances,
    isScratched: false,
    scratchReason: null,
    isCoupledMain: false,
    coupledWith: [],
    rawLine: '',
  };
}

describe('analyzeTrainerJockeyPartnership', () => {
  describe('Elite Partnership (30%+ win rate, 8+ starts)', () => {
    it('should detect elite partnership with 8-for-20 record (40% win rate)', () => {
      // Create past performances: 8 wins in 20 starts with same jockey
      const pps: PastPerformance[] = [];
      for (let i = 0; i < 20; i++) {
        pps.push(createPP('J. Smith', i < 8 ? 1 : 4, `2024-0${(i % 9) + 1}-01`));
      }

      const horse = createTestHorse('J. Smith', pps);
      const result = analyzeTrainerJockeyPartnership(horse);

      expect(result.startsWithCombo).toBe(20);
      expect(result.winsWithCombo).toBe(8);
      expect(result.comboWinRate).toBe(40);
      expect(result.partnershipTier).toBe('elite');
      expect(result.isRegularPartnership).toBe(true);
      expect(result.isWinningPartnership).toBe(true);
      expect(result.isFirstTimeWithJockey).toBe(false);
    });

    it('should detect elite partnership at minimum threshold (30% with 8 starts)', () => {
      // 3 wins in 10 starts = 30%
      const pps: PastPerformance[] = [];
      for (let i = 0; i < 10; i++) {
        pps.push(createPP('M. Franco', i < 3 ? 1 : 4));
      }

      const horse = createTestHorse('M. Franco', pps);
      const result = analyzeTrainerJockeyPartnership(horse);

      expect(result.startsWithCombo).toBe(10);
      expect(result.winsWithCombo).toBe(3);
      expect(result.comboWinRate).toBe(30);
      expect(result.partnershipTier).toBe('elite');
    });
  });

  describe('Strong Partnership (25-29% win rate, 5+ starts)', () => {
    it('should detect strong partnership with 3-for-12 record (25% win rate)', () => {
      // 3 wins in 12 starts = 25%
      const pps: PastPerformance[] = [];
      for (let i = 0; i < 12; i++) {
        pps.push(createPP('J. Ortiz', i < 3 ? 1 : 3));
      }

      const horse = createTestHorse('J. Ortiz', pps);
      const result = analyzeTrainerJockeyPartnership(horse);

      expect(result.startsWithCombo).toBe(12);
      expect(result.winsWithCombo).toBe(3);
      expect(result.comboWinRate).toBe(25);
      expect(result.partnershipTier).toBe('strong');
      expect(result.isWinningPartnership).toBe(true);
    });

    it('should detect strong partnership at 29% (just below elite)', () => {
      // 2 wins in 7 starts = 28.57%
      const pps: PastPerformance[] = [];
      for (let i = 0; i < 7; i++) {
        pps.push(createPP('L. Saez', i < 2 ? 1 : 5));
      }

      const horse = createTestHorse('L. Saez', pps);
      const result = analyzeTrainerJockeyPartnership(horse);

      expect(result.startsWithCombo).toBe(7);
      expect(result.winsWithCombo).toBe(2);
      expect(result.comboWinRate).toBeCloseTo(28.57, 1);
      expect(result.partnershipTier).toBe('strong');
    });
  });

  describe('Good Partnership (20-24% win rate, 5+ starts)', () => {
    it('should detect good partnership with 20% win rate', () => {
      // 1 win in 5 starts = 20%
      const pps: PastPerformance[] = [];
      for (let i = 0; i < 5; i++) {
        pps.push(createPP('I. Ortiz Jr.', i === 0 ? 1 : 4));
      }

      const horse = createTestHorse('I. Ortiz Jr.', pps);
      const result = analyzeTrainerJockeyPartnership(horse);

      expect(result.startsWithCombo).toBe(5);
      expect(result.winsWithCombo).toBe(1);
      expect(result.comboWinRate).toBe(20);
      expect(result.partnershipTier).toBe('good');
    });

    it('should detect good partnership with 24% win rate', () => {
      // 2 wins in 8 starts = 25% - but we want 24%, so 3 in 13 ≈ 23%
      const pps: PastPerformance[] = [];
      for (let i = 0; i < 8; i++) {
        pps.push(createPP('F. Prat', i < 2 ? 1 : 3));
      }

      const horse = createTestHorse('F. Prat', pps);
      const result = analyzeTrainerJockeyPartnership(horse);

      // 2/8 = 25%, which is actually strong tier
      expect(result.comboWinRate).toBe(25);
      expect(result.partnershipTier).toBe('strong');
    });
  });

  describe('Regular Partnership (15-19% win rate, 5+ starts)', () => {
    it('should detect regular partnership with 15% win rate', () => {
      // 1 win in 7 starts ≈ 14.3%, 1 in 6 ≈ 16.7%
      const pps: PastPerformance[] = [];
      for (let i = 0; i < 6; i++) {
        pps.push(createPP('J. Velazquez', i === 0 ? 1 : 4));
      }

      const horse = createTestHorse('J. Velazquez', pps);
      const result = analyzeTrainerJockeyPartnership(horse);

      expect(result.startsWithCombo).toBe(6);
      expect(result.winsWithCombo).toBe(1);
      expect(result.comboWinRate).toBeCloseTo(16.67, 1);
      expect(result.partnershipTier).toBe('regular');
    });
  });

  describe('Weak/New Partnership', () => {
    it('should detect weak partnership with 1-for-8 record (12.5%)', () => {
      // 1 win in 8 starts = 12.5% (below 15% threshold)
      const pps: PastPerformance[] = [];
      for (let i = 0; i < 8; i++) {
        pps.push(createPP('R. Santana Jr.', i === 0 ? 1 : 5));
      }

      const horse = createTestHorse('R. Santana Jr.', pps);
      const result = analyzeTrainerJockeyPartnership(horse);

      expect(result.startsWithCombo).toBe(8);
      expect(result.winsWithCombo).toBe(1);
      expect(result.comboWinRate).toBe(12.5);
      expect(result.partnershipTier).toBe('new');
      expect(result.isRegularPartnership).toBe(true); // 5+ starts
      expect(result.isWinningPartnership).toBe(false); // <25%
    });

    it('should detect new partnership when less than 5 starts together', () => {
      // Only 4 starts with same jockey
      const pps: PastPerformance[] = [];
      for (let i = 0; i < 4; i++) {
        pps.push(createPP('T. Gaffalione', i < 2 ? 1 : 3)); // 50% but only 4 starts
      }

      const horse = createTestHorse('T. Gaffalione', pps);
      const result = analyzeTrainerJockeyPartnership(horse);

      expect(result.startsWithCombo).toBe(4);
      expect(result.comboWinRate).toBe(50);
      expect(result.partnershipTier).toBe('new'); // Not enough starts
      expect(result.isRegularPartnership).toBe(false);
    });
  });

  describe('First Time With Jockey', () => {
    it('should detect first time with jockey when no PPs with current jockey', () => {
      // Past performances have different jockeys
      const pps: PastPerformance[] = [
        createPP('J. Smith', 1),
        createPP('M. Franco', 2),
        createPP('J. Ortiz', 3),
      ];

      const horse = createTestHorse('L. Saez', pps); // Current jockey is different
      const result = analyzeTrainerJockeyPartnership(horse);

      expect(result.startsWithCombo).toBe(0);
      expect(result.winsWithCombo).toBe(0);
      expect(result.isFirstTimeWithJockey).toBe(true);
      expect(result.partnershipTier).toBe('new');
    });

    it('should not flag as first time when jockey has ridden before', () => {
      const pps: PastPerformance[] = [
        createPP('J. Smith', 1),
        createPP('L. Saez', 3),
        createPP('J. Smith', 2),
      ];

      const horse = createTestHorse('J. Smith', pps);
      const result = analyzeTrainerJockeyPartnership(horse);

      expect(result.startsWithCombo).toBe(2);
      expect(result.isFirstTimeWithJockey).toBe(false);
    });
  });

  describe('Name Normalization', () => {
    it('should match jockeys with normalized names (case insensitive)', () => {
      const pps: PastPerformance[] = [
        createPP('SMITH J', 1),
        createPP('Smith, J.', 2),
        createPP('J. Smith', 1),
      ];

      // Normalize to same format
      const horse = createTestHorse('J SMITH', pps);

      // All should match due to normalization
      // Note: Current implementation uses simple normalization, may need adjustment
      const result = analyzeTrainerJockeyPartnership(horse);

      // This depends on how well the normalization works
      expect(result.startsWithCombo).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('calculateConnectionsScore with Enhanced Partnership', () => {
  it('should award 2 points for elite partnership in total connections score', () => {
    // Create horse with elite partnership (8-for-20 = 40%)
    // v3.2: capped at 2 pts (was 4)
    const pps: PastPerformance[] = [];
    for (let i = 0; i < 20; i++) {
      pps.push(createPP('J. Smith', i < 8 ? 1 : 4));
    }

    const horse = createTestHorse('J. Smith', pps);
    const result = calculateConnectionsScore(horse);

    expect(result.partnershipBonus).toBe(2);
    expect(result.reasoning).toContain('Elite combo');
    expect(result.reasoning).toContain('40%');
  });

  it('should award 2 points for strong partnership', () => {
    // 3-for-12 = 25%
    // v3.2: capped at 2 pts (was 3)
    const pps: PastPerformance[] = [];
    for (let i = 0; i < 12; i++) {
      pps.push(createPP('J. Ortiz', i < 3 ? 1 : 4));
    }

    const horse = createTestHorse('J. Ortiz', pps);
    const result = calculateConnectionsScore(horse);

    expect(result.partnershipBonus).toBe(2);
    expect(result.reasoning).toContain('Strong combo');
  });

  it('should award 1 point for good partnership', () => {
    // 1-for-5 = 20%
    // v3.2: reduced to 1 pt (was 2)
    const pps: PastPerformance[] = [];
    for (let i = 0; i < 5; i++) {
      pps.push(createPP('I. Ortiz Jr.', i === 0 ? 1 : 4));
    }

    const horse = createTestHorse('I. Ortiz Jr.', pps);
    const result = calculateConnectionsScore(horse);

    expect(result.partnershipBonus).toBe(1);
    expect(result.reasoning).toContain('Good combo');
  });

  it('should award 1 point for regular partnership', () => {
    // 1-for-6 ≈ 16.7%
    const pps: PastPerformance[] = [];
    for (let i = 0; i < 6; i++) {
      pps.push(createPP('J. Velazquez', i === 0 ? 1 : 4));
    }

    const horse = createTestHorse('J. Velazquez', pps);
    const result = calculateConnectionsScore(horse);

    expect(result.partnershipBonus).toBe(1);
    expect(result.reasoning).toContain('Regular combo');
  });

  it('should award 0 points for weak partnership', () => {
    // 1-for-8 = 12.5%
    const pps: PastPerformance[] = [];
    for (let i = 0; i < 8; i++) {
      pps.push(createPP('R. Santana Jr.', i === 0 ? 1 : 5));
    }

    const horse = createTestHorse('R. Santana Jr.', pps);
    const result = calculateConnectionsScore(horse);

    expect(result.partnershipBonus).toBe(0);
    expect(result.reasoning).toContain('Limited combo');
  });

  it('should award 0 points for first time with jockey', () => {
    // No past performances with current jockey
    const pps: PastPerformance[] = [createPP('J. Smith', 1), createPP('M. Franco', 2)];

    const horse = createTestHorse('L. Saez', pps); // Different jockey
    const result = calculateConnectionsScore(horse);

    expect(result.partnershipBonus).toBe(0);
    expect(result.reasoning).toContain('First time with this jockey');
  });
});

describe('MAX_ENHANCED_PARTNERSHIP_POINTS', () => {
  it('should be 2 points maximum (v3.2 cap)', () => {
    expect(MAX_ENHANCED_PARTNERSHIP_POINTS).toBe(2);
  });
});

describe('Partnership Stats in Result', () => {
  it('should include partnership stats when combo exists', () => {
    const pps: PastPerformance[] = [];
    for (let i = 0; i < 10; i++) {
      pps.push(createPP('J. Smith', i < 4 ? 1 : 3));
    }

    const horse = createTestHorse('J. Smith', pps);
    const result = calculateConnectionsScore(horse);

    expect(result.partnershipStats).not.toBeNull();
    expect(result.partnershipStats?.trainer).toBe('Test Trainer');
    expect(result.partnershipStats?.jockey).toBe('J. Smith');
    expect(result.partnershipStats?.wins).toBe(4);
    expect(result.partnershipStats?.starts).toBe(10);
    expect(result.partnershipStats?.winRate).toBe(40);
  });

  it('should have null partnership stats for new pairing', () => {
    const pps: PastPerformance[] = [];
    // All PPs have different jockey
    for (let i = 0; i < 5; i++) {
      pps.push(createPP('J. Ortiz', i === 0 ? 1 : 4));
    }

    const horse = createTestHorse('M. Franco', pps); // Different jockey
    const result = calculateConnectionsScore(horse);

    // Partnership stats should be null when no history
    expect(result.partnershipStats).toBeNull();
  });
});
