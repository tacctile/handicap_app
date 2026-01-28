/**
 * useAIAnalysis Transformation Tests
 *
 * Tests the transformation logic that converts ScoredHorse[] to HorseScoreForAI[]
 * for AI consumption. Validates:
 * - Complete data transformation
 * - Handling of missing/sparse data
 * - Edge cases (division by zero, null values)
 * - All new fields populated correctly
 */

import { describe, it, expect } from 'vitest';
import {
  transformToRaceScoringResult,
  transformPastPerformances,
  transformWorkouts,
  transformTrainerPatterns,
  transformEquipment,
  transformBreeding,
  transformDistanceSurfaceStats,
  transformFormIndicators,
  safeWinRate,
} from '../useAIAnalysis';
import type {
  HorseEntry,
  PastPerformance,
  Workout,
  TrainerCategoryStats,
  RaceHeader,
} from '../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../types/drf';
import type { ScoredHorse, HorseScore, ScoreBreakdown } from '../../lib/scoring';
import type { DataCompletenessResult } from '../../types/scoring';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a minimal mock past performance
 */
function createMockPastPerformance(overrides?: Partial<PastPerformance>): PastPerformance {
  return {
    date: '20240101',
    track: 'CD',
    trackName: 'Churchill Downs',
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
    lengthsBehind: 2.5,
    lengthsAhead: null,
    finalTime: 70.5,
    finalTimeFormatted: '1:10.50',
    speedFigures: {
      beyer: 85,
      timeformUS: null,
      equibase: null,
      trackVariant: 0,
      dirtVariant: null,
      turfVariant: null,
    },
    runningLine: {
      start: 5,
      quarterMile: 4,
      quarterMileLengths: 2,
      halfMile: 3,
      halfMileLengths: 1.5,
      threeQuarters: null,
      threeQuartersLengths: null,
      stretch: 3,
      stretchLengths: 2,
      finish: 3,
      finishLengths: 2.5,
    },
    jockey: 'Test Jockey',
    weight: 122,
    apprenticeAllowance: 0,
    equipment: 'L',
    medication: 'L',
    winner: 'Winner Horse',
    secondPlace: 'Second Horse',
    thirdPlace: 'Third Horse',
    tripComment: 'Bumped start, rallied late',
    comment: 'Good effort',
    odds: 5.0,
    favoriteRank: 3,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: 21,
    earlyPace1: 90,
    latePace: 85,
    quarterTime: 22.5,
    halfMileTime: 45.2,
    sixFurlongTime: null,
    mileTime: null,
    ...overrides,
  };
}

/**
 * Create a minimal mock workout
 */
function createMockWorkout(overrides?: Partial<Workout>): Workout {
  return {
    date: '20240110',
    track: 'CD',
    distanceFurlongs: 5,
    distance: '5f',
    timeSeconds: 60.2,
    timeFormatted: '1:00.20',
    type: 'handily',
    trackCondition: 'fast',
    surface: 'dirt',
    ranking: '3 of 25',
    rankNumber: 3,
    totalWorks: 25,
    isBullet: false,
    fromGate: false,
    notes: '',
    ...overrides,
  };
}

/**
 * Create a minimal mock horse entry
 */
function createMockHorseEntry(overrides?: Partial<HorseEntry>): HorseEntry {
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
    trainerStats: '15: 3-2-1',
    trainerMeetStarts: 50,
    trainerMeetWins: 10,
    trainerMeetPlaces: 8,
    trainerMeetShows: 7,
    trainerCategoryStats: createDefaultTrainerCategoryStats(),
    jockeyName: 'Test Jockey',
    jockeyStats: '100: 20-15-10',
    jockeyMeetStarts: 100,
    jockeyMeetWins: 20,
    jockeyMeetPlaces: 18,
    jockeyMeetShows: 15,
    weight: 122,
    apprenticeAllowance: 0,
    equipment: {
      blinkers: true,
      blinkersOff: false,
      frontBandages: false,
      rearBandages: false,
      barShoes: false,
      mudCaulks: false,
      tongueTie: false,
      nasalStrip: false,
      shadowRoll: false,
      cheekPieces: false,
      firstTimeEquipment: ['Blinkers'],
      equipmentChanges: ['Added Blinkers'],
      raw: 'B',
    },
    medication: {
      lasixFirstTime: false,
      lasix: true,
      lasixOff: false,
      bute: false,
      other: [],
      raw: 'L',
    },
    morningLineOdds: '5-1',
    morningLineDecimal: 5.0,
    currentOdds: null,
    lifetimeStarts: 10,
    lifetimeWins: 3,
    lifetimePlaces: 2,
    lifetimeShows: 2,
    lifetimeEarnings: 150000,
    currentYearStarts: 5,
    currentYearWins: 2,
    currentYearPlaces: 1,
    currentYearShows: 1,
    currentYearEarnings: 75000,
    previousYearStarts: 5,
    previousYearWins: 1,
    previousYearPlaces: 1,
    previousYearShows: 1,
    previousYearEarnings: 75000,
    trackStarts: 3,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 0,
    surfaceStarts: 8,
    surfaceWins: 3,
    distanceStarts: 5,
    distanceWins: 2,
    distancePlaces: 1,
    distanceShows: 1,
    turfStarts: 2,
    turfWins: 1,
    turfPlaces: 0,
    turfShows: 1,
    wetStarts: 3,
    wetWins: 1,
    wetPlaces: 1,
    wetShows: 0,
    daysSinceLastRace: 21,
    lastRaceDate: '20240101',
    averageBeyer: 82,
    bestBeyer: 90,
    lastBeyer: 85,
    earlySpeedRating: 88,
    runningStyle: 'E/P',
    pedigreeRating: 'A',
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
    salePrice: null,
    saleLocation: null,
    ...overrides,
  };
}

/**
 * Create a minimal mock score breakdown
 */
function createMockScoreBreakdown(overrides?: Partial<ScoreBreakdown>): ScoreBreakdown {
  return {
    connections: {
      total: 20,
      trainer: 10,
      jockey: 8,
      partnershipBonus: 2,
      reasoning: 'Test connections',
    },
    postPosition: {
      total: 8,
      trackBiasApplied: false,
      isGoldenPost: false,
      reasoning: 'Test post',
    },
    speedClass: {
      total: 70,
      speedScore: 50,
      classScore: 20,
      bestFigure: 90,
      classMovement: 'level',
      reasoning: 'Test speed/class',
    },
    form: {
      total: 35,
      recentFormScore: 25,
      layoffScore: 5,
      consistencyBonus: 5,
      formTrend: 'improving',
      reasoning: 'Test form',
      wonLastOut: false,
      won2OfLast3: false,
    },
    equipment: {
      total: 4,
      hasChanges: true,
      reasoning: 'First-time blinkers',
    },
    pace: {
      total: 25,
      runningStyle: 'E/P',
      paceFit: 'favorable',
      reasoning: 'Test pace',
    },
    odds: {
      total: 8,
      oddsValue: 5.0,
      oddsSource: 'morning_line',
      tier: 'Low',
      reasoning: 'Test odds',
    },
    distanceSurface: {
      total: 12,
      turfScore: 0,
      wetScore: 4,
      distanceScore: 8,
      turfWinRate: 0.5,
      wetWinRate: 0.33,
      distanceWinRate: 0.4,
      reasoning: ['Distance proven'],
    },
    trainerPatterns: {
      total: 6,
      matchedPatterns: [],
      reasoning: ['First-time blinkers trainer 25% win'],
    },
    comboPatterns: {
      total: 3,
      detectedCombos: [],
      intentScore: 2,
      reasoning: ['Equipment change + class drop'],
    },
    trackSpecialist: {
      total: 4,
      trackWinRate: 0.33,
      trackITMRate: 0.67,
      isSpecialist: false,
      reasoning: 'Test track',
    },
    trainerSurfaceDistance: {
      total: 2,
      matchedCategory: 'dirtSprint',
      trainerWinPercent: 22,
      wetTrackWinPercent: 0,
      wetBonusApplied: false,
      reasoning: 'Test trainer surface',
    },
    weightAnalysis: {
      total: 0,
      currentWeight: 122,
      lastRaceWeight: 122,
      weightChange: 0,
      significantDrop: false,
      significantGain: false,
      showWeightGainFlag: false,
      reasoning: 'No weight change',
    },
    sexAnalysis: {
      total: 0,
      horseSex: 'c',
      isFemale: false,
      isRestrictedRace: false,
      isMixedRace: false,
      isFirstTimeFacingMales: false,
      flags: [],
      reasoning: 'Open race',
    },
    ...overrides,
  };
}

/**
 * Create a minimal mock data completeness result
 */
function createMockDataCompleteness(): DataCompletenessResult {
  return {
    overallScore: 85,
    overallGrade: 'B',
    criticalComplete: 90,
    highComplete: 80,
    mediumComplete: 75,
    lowComplete: 70,
    hasSpeedFigures: true,
    hasPastPerformances: true,
    hasTrainerStats: true,
    hasJockeyStats: true,
    hasRunningStyle: true,
    hasPaceFigures: true,
    missingCritical: [],
    missingHigh: [],
    isLowConfidence: false,
    confidenceReason: null,
  };
}

/**
 * Create a minimal mock horse score
 */
function createMockHorseScore(overrides?: Partial<HorseScore>): HorseScore {
  return {
    total: 200,
    baseScore: 180,
    overlayScore: 20,
    oddsScore: 8,
    breakdown: createMockScoreBreakdown(),
    isScratched: false,
    confidenceLevel: 'high',
    dataQuality: 85,
    dataCompleteness: createMockDataCompleteness(),
    lowConfidencePenaltyApplied: false,
    lowConfidencePenaltyAmount: 0,
    paperTigerPenaltyApplied: false,
    paperTigerPenaltyAmount: 0,
    keyRaceIndexBonus: 0,
    fieldSpreadAdjustment: 0,
    ...overrides,
  };
}

/**
 * Create a minimal mock scored horse
 */
function createMockScoredHorse(overrides?: Partial<ScoredHorse>): ScoredHorse {
  return {
    horse: createMockHorseEntry(),
    index: 0,
    score: createMockHorseScore(),
    rank: 1,
    ...overrides,
  };
}

/**
 * Create a minimal mock race header
 */
function createMockRaceHeader(overrides?: Partial<RaceHeader>): RaceHeader {
  return {
    trackCode: 'CD',
    trackName: 'Churchill Downs',
    trackLocation: 'Louisville, KY',
    raceNumber: 1,
    raceDate: 'January 15, 2024',
    raceDateRaw: '20240115',
    postTime: '1:00 PM',
    distanceFurlongs: 6,
    distance: '6 furlongs',
    distanceExact: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'allowance',
    raceType: 'Allowance',
    purse: 100000,
    purseFormatted: '$100,000',
    ageRestriction: '3&UP',
    sexRestriction: '',
    weightConditions: 'Weight for age',
    stateBred: null,
    claimingPriceMin: null,
    claimingPriceMax: null,
    allowedWeight: null,
    conditions: 'Allowance race for 3yo and up',
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
    probableFavorite: 1,
    ...overrides,
  };
}

// ============================================================================
// SAFE WIN RATE TESTS
// ============================================================================

describe('safeWinRate', () => {
  it('should calculate correct win rate for normal values', () => {
    expect(safeWinRate(3, 10)).toBe(0.3);
    expect(safeWinRate(5, 20)).toBe(0.25);
    expect(safeWinRate(0, 10)).toBe(0);
  });

  it('should return 0 for division by zero', () => {
    expect(safeWinRate(5, 0)).toBe(0);
    expect(safeWinRate(0, 0)).toBe(0);
  });

  it('should return 0 for non-finite starts', () => {
    expect(safeWinRate(5, NaN)).toBe(0);
    expect(safeWinRate(5, Infinity)).toBe(0);
    expect(safeWinRate(5, -Infinity)).toBe(0);
  });

  it('should handle perfect win rate', () => {
    expect(safeWinRate(10, 10)).toBe(1);
  });
});

// ============================================================================
// PAST PERFORMANCES TRANSFORMATION TESTS
// ============================================================================

describe('transformPastPerformances', () => {
  it('should return empty array for undefined pastPerformances', () => {
    const result = transformPastPerformances(undefined);
    expect(result).toEqual([]);
  });

  it('should return empty array for empty pastPerformances', () => {
    const result = transformPastPerformances([]);
    expect(result).toEqual([]);
  });

  it('should transform last 3 past performances correctly', () => {
    const pps = [
      createMockPastPerformance({ date: '20240101', finishPosition: 1 }),
      createMockPastPerformance({ date: '20231215', finishPosition: 2 }),
      createMockPastPerformance({ date: '20231201', finishPosition: 3 }),
      createMockPastPerformance({ date: '20231115', finishPosition: 4 }), // Should not be included
    ];

    const result = transformPastPerformances(pps);

    expect(result.length).toBe(3);
    expect(result[0]!.finishPosition).toBe(1);
    expect(result[1]!.finishPosition).toBe(2);
    expect(result[2]!.finishPosition).toBe(3);
  });

  it('should correctly extract beyer from speedFigures', () => {
    const pps = [
      createMockPastPerformance({
        speedFigures: {
          beyer: 95,
          timeformUS: null,
          equibase: null,
          trackVariant: 0,
          dirtVariant: null,
          turfVariant: null,
        },
      }),
    ];

    const result = transformPastPerformances(pps);

    expect(result[0]!.beyer).toBe(95);
  });

  it('should handle null beyer figure', () => {
    const pps = [
      createMockPastPerformance({
        speedFigures: {
          beyer: null,
          timeformUS: null,
          equibase: null,
          trackVariant: 0,
          dirtVariant: null,
          turfVariant: null,
        },
      }),
    ];

    const result = transformPastPerformances(pps);

    expect(result[0]!.beyer).toBeNull();
  });

  it('should extract running line positions correctly', () => {
    const pps = [createMockPastPerformance()];

    const result = transformPastPerformances(pps);

    expect(result[0]!.runningLine.start).toBe(5);
    expect(result[0]!.runningLine.stretch).toBe(3);
    expect(result[0]!.runningLine.finish).toBe(3);
  });

  it('should extract earlyPace1 and latePace', () => {
    const pps = [createMockPastPerformance({ earlyPace1: 92, latePace: 88 })];

    const result = transformPastPerformances(pps);

    expect(result[0]!.earlyPace1).toBe(92);
    expect(result[0]!.latePace).toBe(88);
  });

  it('should extract tripComment', () => {
    const pps = [createMockPastPerformance({ tripComment: 'Wide throughout' })];

    const result = transformPastPerformances(pps);

    expect(result[0]!.tripComment).toBe('Wide throughout');
  });
});

// ============================================================================
// WORKOUTS TRANSFORMATION TESTS
// ============================================================================

describe('transformWorkouts', () => {
  it('should return empty array for undefined workouts', () => {
    const result = transformWorkouts(undefined);
    expect(result).toEqual([]);
  });

  it('should return empty array for empty workouts', () => {
    const result = transformWorkouts([]);
    expect(result).toEqual([]);
  });

  it('should transform last 3 workouts correctly', () => {
    const workouts = [
      createMockWorkout({ date: '20240115' }),
      createMockWorkout({ date: '20240108' }),
      createMockWorkout({ date: '20240101' }),
      createMockWorkout({ date: '20231225' }), // Should not be included
    ];

    const result = transformWorkouts(workouts);

    expect(result.length).toBe(3);
    expect(result[0]!.date).toBe('20240115');
    expect(result[1]!.date).toBe('20240108');
    expect(result[2]!.date).toBe('20240101');
  });

  it('should correctly extract workout fields', () => {
    const workouts = [
      createMockWorkout({
        distanceFurlongs: 4,
        timeSeconds: 48.5,
        type: 'breeze',
        isBullet: true,
        rankNumber: 1,
        totalWorks: 50,
      }),
    ];

    const result = transformWorkouts(workouts);

    expect(result[0]!.distanceFurlongs).toBe(4);
    expect(result[0]!.timeSeconds).toBe(48.5);
    expect(result[0]!.type).toBe('breeze');
    expect(result[0]!.isBullet).toBe(true);
    expect(result[0]!.rankNumber).toBe(1);
    expect(result[0]!.totalWorks).toBe(50);
  });
});

// ============================================================================
// TRAINER PATTERNS TRANSFORMATION TESTS
// ============================================================================

describe('transformTrainerPatterns', () => {
  it('should return object with zero values for undefined trainerStats', () => {
    const result = transformTrainerPatterns(undefined);

    expect(result.firstTimeLasix.starts).toBe(0);
    expect(result.firstTimeLasix.wins).toBe(0);
    expect(result.firstTimeLasix.winPercent).toBe(0);
    expect(result.firstTimeLasix.roi).toBe(0);
  });

  it('should correctly transform all 19 trainer categories', () => {
    const stats: TrainerCategoryStats = {
      ...createDefaultTrainerCategoryStats(),
      firstTimeLasix: { starts: 10, wins: 3, winPercent: 30, roi: 150 },
      firstTimeBlinkers: { starts: 20, wins: 5, winPercent: 25, roi: 120 },
      secondOffLayoff: { starts: 15, wins: 4, winPercent: 26.67, roi: 110 },
    };

    const result = transformTrainerPatterns(stats);

    expect(result.firstTimeLasix.starts).toBe(10);
    expect(result.firstTimeLasix.wins).toBe(3);
    expect(result.firstTimeLasix.winPercent).toBe(30);
    expect(result.firstTimeLasix.roi).toBe(150);
    expect(result.firstTimeBlinkers.starts).toBe(20);
    expect(result.secondOffLayoff.winPercent).toBe(26.67);
  });

  it('should have all 19 categories defined', () => {
    const result = transformTrainerPatterns(undefined);

    const expectedCategories = [
      'firstTimeLasix',
      'firstTimeBlinkers',
      'blinkersOff',
      'secondOffLayoff',
      'days31to60',
      'days61to90',
      'days91to180',
      'days181plus',
      'sprintToRoute',
      'routeToSprint',
      'turfSprint',
      'turfRoute',
      'wetTrack',
      'dirtSprint',
      'dirtRoute',
      'maidenClaiming',
      'stakes',
      'firstStartTrainer',
      'afterClaim',
    ];

    for (const category of expectedCategories) {
      expect(result).toHaveProperty(category);
      expect(result[category as keyof typeof result]).toHaveProperty('starts');
      expect(result[category as keyof typeof result]).toHaveProperty('wins');
      expect(result[category as keyof typeof result]).toHaveProperty('winPercent');
      expect(result[category as keyof typeof result]).toHaveProperty('roi');
    }
  });
});

// ============================================================================
// EQUIPMENT TRANSFORMATION TESTS
// ============================================================================

describe('transformEquipment', () => {
  it('should transform equipment flags correctly', () => {
    const horse = createMockHorseEntry({
      equipment: {
        blinkers: true,
        blinkersOff: false,
        frontBandages: true,
        rearBandages: false,
        barShoes: false,
        mudCaulks: true,
        tongueTie: true,
        nasalStrip: false,
        shadowRoll: true,
        cheekPieces: false,
        firstTimeEquipment: ['Blinkers', 'Tongue Tie'],
        equipmentChanges: ['Added Blinkers', 'Added Tongue Tie'],
        raw: 'B T',
      },
    });

    const result = transformEquipment(horse);

    expect(result.blinkers).toBe(true);
    expect(result.blinkersOff).toBe(false);
    expect(result.frontBandages).toBe(true);
    expect(result.tongueTie).toBe(true);
    expect(result.shadowRoll).toBe(true);
    expect(result.mudCaulks).toBe(true);
    expect(result.firstTimeEquipment).toEqual(['Blinkers', 'Tongue Tie']);
    expect(result.equipmentChanges).toEqual(['Added Blinkers', 'Added Tongue Tie']);
  });

  it('should handle horse with no equipment', () => {
    const horse = createMockHorseEntry({
      equipment: undefined as unknown as HorseEntry['equipment'],
    });

    const result = transformEquipment(horse);

    expect(result.blinkers).toBe(false);
    expect(result.firstTimeEquipment).toEqual([]);
    expect(result.equipmentChanges).toEqual([]);
  });
});

// ============================================================================
// BREEDING TRANSFORMATION TESTS
// ============================================================================

describe('transformBreeding', () => {
  it('should transform breeding data correctly', () => {
    const horse = createMockHorseEntry({
      breeding: {
        sire: 'Into Mischief',
        sireOfSire: "Harlan's Holiday",
        dam: 'Test Dam',
        damSire: 'Tapit',
        breeder: 'Test Breeder',
        whereBred: 'KY',
        studFee: 200000,
      },
    });

    const result = transformBreeding(horse);

    expect(result.sire).toBe('Into Mischief');
    expect(result.damSire).toBe('Tapit');
    expect(result.whereBred).toBe('KY');
  });

  it('should handle horse with no breeding data', () => {
    const horse = createMockHorseEntry({
      breeding: undefined as unknown as HorseEntry['breeding'],
    });

    const result = transformBreeding(horse);

    expect(result.sire).toBe('');
    expect(result.damSire).toBe('');
    expect(result.whereBred).toBe('');
  });
});

// ============================================================================
// DISTANCE/SURFACE STATS TRANSFORMATION TESTS
// ============================================================================

describe('transformDistanceSurfaceStats', () => {
  it('should calculate win rates correctly', () => {
    const horse = createMockHorseEntry({
      distanceStarts: 10,
      distanceWins: 3,
      surfaceStarts: 20,
      surfaceWins: 5,
      turfStarts: 5,
      turfWins: 2,
      wetStarts: 4,
      wetWins: 1,
    });

    const result = transformDistanceSurfaceStats(horse);

    expect(result.distanceStarts).toBe(10);
    expect(result.distanceWins).toBe(3);
    expect(result.distanceWinRate).toBe(0.3);
    expect(result.surfaceWinRate).toBe(0.25);
    expect(result.turfWinRate).toBe(0.4);
    expect(result.wetWinRate).toBe(0.25);
  });

  it('should return 0 win rate for zero starts (no NaN)', () => {
    const horse = createMockHorseEntry({
      distanceStarts: 0,
      distanceWins: 0,
      surfaceStarts: 0,
      surfaceWins: 0,
      turfStarts: 0,
      turfWins: 0,
      wetStarts: 0,
      wetWins: 0,
    });

    const result = transformDistanceSurfaceStats(horse);

    expect(result.distanceWinRate).toBe(0);
    expect(Number.isNaN(result.distanceWinRate)).toBe(false);
    expect(Number.isFinite(result.distanceWinRate)).toBe(true);
    expect(result.surfaceWinRate).toBe(0);
    expect(result.turfWinRate).toBe(0);
    expect(result.wetWinRate).toBe(0);
  });
});

// ============================================================================
// FORM INDICATORS TRANSFORMATION TESTS
// ============================================================================

describe('transformFormIndicators', () => {
  it('should transform form indicators correctly', () => {
    const horse = createMockHorseEntry({
      daysSinceLastRace: 14,
      averageBeyer: 85,
      bestBeyer: 92,
      lastBeyer: 88,
      earlySpeedRating: 90,
      lifetimeStarts: 15,
      lifetimeWins: 5,
    });

    const result = transformFormIndicators(horse);

    expect(result.daysSinceLastRace).toBe(14);
    expect(result.averageBeyer).toBe(85);
    expect(result.bestBeyer).toBe(92);
    expect(result.lastBeyer).toBe(88);
    expect(result.earlySpeedRating).toBe(90);
    expect(result.lifetimeStarts).toBe(15);
    expect(result.lifetimeWins).toBe(5);
    expect(result.lifetimeWinRate).toBeCloseTo(0.333, 2);
  });

  it('should handle null daysSinceLastRace for first-time starters', () => {
    const horse = createMockHorseEntry({
      daysSinceLastRace: null,
      lifetimeStarts: 0,
      lifetimeWins: 0,
    });

    const result = transformFormIndicators(horse);

    expect(result.daysSinceLastRace).toBeNull();
    expect(result.lifetimeWinRate).toBe(0);
    expect(Number.isNaN(result.lifetimeWinRate)).toBe(false);
  });
});

// ============================================================================
// FULL TRANSFORMATION TESTS
// ============================================================================

describe('transformToRaceScoringResult', () => {
  it('should transform complete horse data correctly', () => {
    const horse = createMockHorseEntry({
      pastPerformances: [
        createMockPastPerformance({ finishPosition: 1 }),
        createMockPastPerformance({ finishPosition: 2 }),
        createMockPastPerformance({ finishPosition: 3 }),
      ],
      workouts: [createMockWorkout({ isBullet: true }), createMockWorkout(), createMockWorkout()],
      trainerCategoryStats: {
        ...createDefaultTrainerCategoryStats(),
        firstTimeBlinkers: { starts: 10, wins: 3, winPercent: 30, roi: 150 },
      },
    });

    const scoredHorses: ScoredHorse[] = [createMockScoredHorse({ horse, rank: 1 })];

    const result = transformToRaceScoringResult(scoredHorses, createMockRaceHeader());

    expect(result.scores.length).toBe(1);

    const transformed = result.scores[0]!;

    // Core fields
    expect(transformed.programNumber).toBe(1);
    expect(transformed.horseName).toBe('Test Horse');
    expect(transformed.rank).toBe(1);
    expect(transformed.finalScore).toBe(200);
    expect(transformed.confidenceTier).toBe('high');
    expect(transformed.isScratched).toBe(false);

    // Past performances
    expect(transformed.pastPerformances.length).toBe(3);
    expect(transformed.pastPerformances[0]!.finishPosition).toBe(1);

    // Workouts
    expect(transformed.workouts.length).toBe(3);
    expect(transformed.workouts[0]!.isBullet).toBe(true);

    // Trainer patterns
    expect(transformed.trainerPatterns.firstTimeBlinkers.starts).toBe(10);
    expect(transformed.trainerPatterns.firstTimeBlinkers.winPercent).toBe(30);

    // Equipment
    expect(transformed.equipment.blinkers).toBe(true);
    expect(transformed.equipment.firstTimeEquipment).toContain('Blinkers');

    // Breeding
    expect(transformed.breeding.sire).toBe('Test Sire');
    expect(transformed.breeding.damSire).toBe('Test Damsire');
    expect(transformed.breeding.whereBred).toBe('KY');

    // Distance/Surface stats
    expect(transformed.distanceSurfaceStats.distanceStarts).toBe(5);
    expect(transformed.distanceSurfaceStats.distanceWinRate).toBe(0.4);

    // Form indicators
    expect(transformed.formIndicators.daysSinceLastRace).toBe(21);
    expect(transformed.formIndicators.bestBeyer).toBe(90);
    expect(transformed.formIndicators.lifetimeWinRate).toBe(0.3);

    // Odds
    expect(transformed.morningLineOdds).toBe('5-1');
    expect(transformed.morningLineDecimal).toBe(5.0);
  });

  it('should handle horse with missing past performances', () => {
    const horse = createMockHorseEntry({
      pastPerformances: [],
    });

    const scoredHorses: ScoredHorse[] = [createMockScoredHorse({ horse })];

    const result = transformToRaceScoringResult(scoredHorses, createMockRaceHeader());

    expect(result.scores[0]!.pastPerformances).toEqual([]);
  });

  it('should handle horse with missing workouts', () => {
    const horse = createMockHorseEntry({
      workouts: [],
    });

    const scoredHorses: ScoredHorse[] = [createMockScoredHorse({ horse })];

    const result = transformToRaceScoringResult(scoredHorses, createMockRaceHeader());

    expect(result.scores[0]!.workouts).toEqual([]);
  });

  it('should filter out scratched horses', () => {
    const scoredHorses: ScoredHorse[] = [
      createMockScoredHorse({ rank: 1 }),
      createMockScoredHorse({
        horse: createMockHorseEntry({ programNumber: 2, horseName: 'Scratched Horse' }),
        score: createMockHorseScore({ isScratched: true }),
        rank: 0,
      }),
    ];

    const result = transformToRaceScoringResult(scoredHorses, createMockRaceHeader());

    expect(result.scores.length).toBe(1);
    expect(result.scores[0]!.programNumber).toBe(1);
  });

  it('should sort horses by rank', () => {
    const scoredHorses: ScoredHorse[] = [
      createMockScoredHorse({
        horse: createMockHorseEntry({ programNumber: 3 }),
        rank: 3,
      }),
      createMockScoredHorse({
        horse: createMockHorseEntry({ programNumber: 1 }),
        rank: 1,
      }),
      createMockScoredHorse({
        horse: createMockHorseEntry({ programNumber: 2 }),
        rank: 2,
      }),
    ];

    const result = transformToRaceScoringResult(scoredHorses, createMockRaceHeader());

    expect(result.scores[0]!.rank).toBe(1);
    expect(result.scores[1]!.rank).toBe(2);
    expect(result.scores[2]!.rank).toBe(3);
  });

  it('should derive positive factors correctly', () => {
    const scoredHorses: ScoredHorse[] = [
      createMockScoredHorse({
        score: createMockHorseScore({
          breakdown: createMockScoreBreakdown({
            speedClass: {
              total: 100,
              speedScore: 60,
              classScore: 40,
              bestFigure: 95,
              classMovement: 'up',
              reasoning: 'Strong',
            },
            form: {
              total: 45,
              recentFormScore: 35,
              layoffScore: 5,
              consistencyBonus: 5,
              formTrend: 'up',
              reasoning: 'Hot',
              wonLastOut: true,
              won2OfLast3: true,
            },
            connections: {
              total: 32,
              trainer: 15,
              jockey: 12,
              partnershipBonus: 5,
              reasoning: 'Elite',
            },
          }),
        }),
      }),
    ];

    const result = transformToRaceScoringResult(scoredHorses, createMockRaceHeader());

    expect(result.scores[0]!.positiveFactors).toContain('Strong speed figures');
    expect(result.scores[0]!.positiveFactors).toContain('Class advantage');
    expect(result.scores[0]!.positiveFactors).toContain('Strong recent form');
    expect(result.scores[0]!.positiveFactors).toContain('Elite connections');
  });

  it('should derive negative factors correctly', () => {
    const scoredHorses: ScoredHorse[] = [
      createMockScoredHorse({
        score: createMockHorseScore({
          breakdown: createMockScoreBreakdown({
            speedClass: {
              total: 20,
              speedScore: 15,
              classScore: 5,
              bestFigure: 60,
              classMovement: 'down',
              reasoning: 'Weak',
            },
            form: {
              total: 10,
              recentFormScore: 5,
              layoffScore: 2,
              consistencyBonus: 3,
              formTrend: 'down',
              reasoning: 'Cold',
              wonLastOut: false,
              won2OfLast3: false,
            },
          }),
        }),
      }),
    ];

    const result = transformToRaceScoringResult(scoredHorses, createMockRaceHeader());

    expect(result.scores[0]!.negativeFactors).toContain('Weak speed figures');
    expect(result.scores[0]!.negativeFactors).toContain('Class disadvantage');
    expect(result.scores[0]!.negativeFactors).toContain('Poor recent form');
  });

  it('should calculate race analysis correctly', () => {
    const scoredHorses: ScoredHorse[] = [
      createMockScoredHorse({
        rank: 1,
        score: createMockHorseScore({
          total: 250,
          breakdown: createMockScoreBreakdown({
            pace: { total: 30, runningStyle: 'E', paceFit: 'excellent', reasoning: 'Speed horse' },
          }),
        }),
      }),
      createMockScoredHorse({
        horse: createMockHorseEntry({ programNumber: 2 }),
        rank: 2,
        score: createMockHorseScore({
          total: 220,
          breakdown: createMockScoreBreakdown({
            pace: { total: 28, runningStyle: 'E/P', paceFit: 'good', reasoning: 'Presser' },
          }),
        }),
      }),
      createMockScoredHorse({
        horse: createMockHorseEntry({ programNumber: 3 }),
        rank: 3,
        score: createMockHorseScore({
          total: 210,
          breakdown: createMockScoreBreakdown({
            pace: { total: 25, runningStyle: 'P', paceFit: 'neutral', reasoning: 'Stalker' },
          }),
        }),
      }),
    ];

    const result = transformToRaceScoringResult(scoredHorses, createMockRaceHeader());

    expect(result.raceAnalysis).toBeDefined();
    expect(result.raceAnalysis.paceScenario).toBeDefined();
    // Average is (250+220+210)/3 = 226.67 which is > 200, so 'elite'
    expect(result.raceAnalysis.fieldStrength).toBe('elite');
    expect(result.raceAnalysis.paceScenario.earlySpeedCount).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty scored horses array', () => {
    const result = transformToRaceScoringResult([], createMockRaceHeader());

    expect(result.scores).toEqual([]);
    // raceAnalysis should still be calculated but with empty field
    expect(result.raceAnalysis).toBeDefined();
  });

  it('should handle horse with all null values', () => {
    const horse = createMockHorseEntry({
      daysSinceLastRace: null,
      averageBeyer: null,
      bestBeyer: null,
      lastBeyer: null,
      earlySpeedRating: null,
    });

    const result = transformFormIndicators(horse);

    expect(result.daysSinceLastRace).toBeNull();
    expect(result.averageBeyer).toBeNull();
    expect(result.bestBeyer).toBeNull();
    expect(result.lastBeyer).toBeNull();
    expect(result.earlySpeedRating).toBeNull();
  });

  it('should not produce NaN or Infinity in any calculation', () => {
    const horse = createMockHorseEntry({
      distanceStarts: 0,
      distanceWins: 0,
      surfaceStarts: 0,
      surfaceWins: 0,
      turfStarts: 0,
      turfWins: 0,
      wetStarts: 0,
      wetWins: 0,
      lifetimeStarts: 0,
      lifetimeWins: 0,
    });

    const scoredHorses: ScoredHorse[] = [createMockScoredHorse({ horse })];
    const result = transformToRaceScoringResult(scoredHorses, createMockRaceHeader());

    const transformed = result.scores[0]!;

    // Check all win rates are valid numbers
    expect(Number.isNaN(transformed.distanceSurfaceStats.distanceWinRate)).toBe(false);
    expect(Number.isNaN(transformed.distanceSurfaceStats.surfaceWinRate)).toBe(false);
    expect(Number.isNaN(transformed.distanceSurfaceStats.turfWinRate)).toBe(false);
    expect(Number.isNaN(transformed.distanceSurfaceStats.wetWinRate)).toBe(false);
    expect(Number.isNaN(transformed.formIndicators.lifetimeWinRate)).toBe(false);

    expect(Number.isFinite(transformed.distanceSurfaceStats.distanceWinRate)).toBe(true);
    expect(Number.isFinite(transformed.distanceSurfaceStats.surfaceWinRate)).toBe(true);
    expect(Number.isFinite(transformed.distanceSurfaceStats.turfWinRate)).toBe(true);
    expect(Number.isFinite(transformed.distanceSurfaceStats.wetWinRate)).toBe(true);
    expect(Number.isFinite(transformed.formIndicators.lifetimeWinRate)).toBe(true);
  });
});
