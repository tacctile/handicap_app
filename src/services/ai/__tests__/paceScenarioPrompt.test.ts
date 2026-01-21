/**
 * Tests for Pace Scenario Prompt Builder
 *
 * Tests for formatHorseForPaceScenario helper, pace tendency analysis,
 * and buildPaceScenarioPrompt
 */

import { describe, it, expect } from 'vitest';
import {
  formatHorseForPaceScenario,
  formatHorseForPaceScenarioAbbreviated,
  buildPaceScenarioPrompt,
  calculatePaceAverage,
  classifySpeedProfile,
  analyzePaceTendencies,
} from '../prompt';
import type { ParsedRace, RaceHeader, HorseEntry, PastPerformance } from '../../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../../types/drf';
import type {
  RaceScoringResult,
  HorseScoreForAI,
  RaceAnalysis,
  TrackIntelligenceForAI,
  TrainerPatternsForAI,
  PastPerformanceForAI,
} from '../../../types/scoring';

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

function createMockPastPerformance(overrides: Partial<PastPerformance> = {}): PastPerformance {
  return {
    date: '2024-01-15',
    track: 'SA',
    trackName: 'Santa Anita',
    raceNumber: 5,
    distanceFurlongs: 6,
    distance: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'allowance',
    claimingPrice: null,
    purse: 75000,
    fieldSize: 8,
    finishPosition: 1,
    lengthsBehind: 0,
    lengthsAhead: 2.5,
    finalTime: 70.45,
    finalTimeFormatted: '1:10.45',
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
      quarterMile: 2,
      quarterMileLengths: 1,
      halfMile: 2,
      halfMileLengths: 0.5,
      threeQuarters: null,
      threeQuartersLengths: null,
      stretch: 1,
      stretchLengths: 0,
      finish: 1,
      finishLengths: 0,
    },
    jockey: 'John Smith',
    weight: 122,
    apprenticeAllowance: 0,
    equipment: '',
    medication: '',
    winner: 'Test Horse',
    secondPlace: 'Runner Up',
    thirdPlace: 'Third Horse',
    tripComment: 'Stalked pace, drew clear',
    comment: '',
    odds: 3.5,
    favoriteRank: null,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: 21,
    earlyPace1: null,
    latePace: null,
    quarterTime: null,
    halfMileTime: null,
    sixFurlongTime: null,
    mileTime: null,
    ...overrides,
  };
}

function createMockHorseEntry(overrides: Partial<HorseEntry> = {}): HorseEntry {
  return {
    programNumber: 1,
    entryIndicator: '',
    postPosition: 1,
    horseName: 'Test Horse',
    age: 4,
    sex: 'c',
    sexFull: 'colt',
    color: 'dk b',
    breeding: {
      sire: 'Sire Name',
      sireOfSire: 'Grandsire Name',
      dam: 'Dam Name',
      damSire: 'Dam Sire',
      breeder: 'Test Breeder',
      whereBred: 'KY',
      studFee: null,
    },
    owner: 'Test Owner',
    silks: 'Blue, white stars',
    trainerName: 'Jane Doe',
    trainerStats: '20% win',
    trainerMeetStarts: 50,
    trainerMeetWins: 10,
    trainerMeetPlaces: 8,
    trainerMeetShows: 7,
    trainerCategoryStats: createDefaultTrainerCategoryStats(),
    jockeyName: 'John Smith',
    jockeyStats: '15% win',
    jockeyMeetStarts: 100,
    jockeyMeetWins: 15,
    jockeyMeetPlaces: 12,
    jockeyMeetShows: 10,
    weight: 122,
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
    trackStarts: 2,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 0,
    surfaceStarts: 8,
    surfaceWins: 3,
    distanceStarts: 3,
    distanceWins: 1,
    distancePlaces: 1,
    distanceShows: 1,
    turfStarts: 2,
    turfWins: 0,
    turfPlaces: 1,
    turfShows: 0,
    wetStarts: 1,
    wetWins: 0,
    wetPlaces: 0,
    wetShows: 0,
    daysSinceLastRace: 21,
    lastRaceDate: '2024-01-01',
    averageBeyer: 82,
    bestBeyer: 88,
    lastBeyer: 85,
    earlySpeedRating: 95,
    runningStyle: 'E/P',
    pedigreeRating: null,
    claimingPrice: null,
    lastClaimPrice: null,
    trainerAngle: null,
    workouts: [],
    pastPerformances: [createMockPastPerformance()],
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

function createMockRaceHeader(overrides: Partial<RaceHeader> = {}): RaceHeader {
  return {
    trackCode: 'SA',
    trackName: 'Santa Anita',
    trackLocation: 'Arcadia, CA',
    raceNumber: 5,
    raceDate: '2024-01-20',
    raceDateRaw: '20240120',
    postTime: '3:00 PM',
    distanceFurlongs: 6,
    distance: '6 Furlongs',
    distanceExact: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'claiming',
    raceType: 'CLM',
    purse: 35000,
    purseFormatted: '$35,000',
    ageRestriction: '4+',
    sexRestriction: '',
    weightConditions: 'Allowances',
    stateBred: null,
    claimingPriceMin: 25000,
    claimingPriceMax: 25000,
    allowedWeight: null,
    conditions: 'For four year olds and upward',
    raceName: null,
    grade: null,
    isListed: false,
    isAbout: false,
    tempRail: null,
    turfCourseType: null,
    chuteStart: false,
    hasReplay: false,
    programNumber: 5,
    fieldSize: 8,
    probableFavorite: 1,
    ...overrides,
  };
}

function createMockParsedRace(overrides: Partial<ParsedRace> = {}): ParsedRace {
  return {
    header: createMockRaceHeader(),
    horses: [
      createMockHorseEntry({
        programNumber: 1,
        horseName: 'Fast Runner',
        postPosition: 1,
        runningStyle: 'E',
      }),
      createMockHorseEntry({
        programNumber: 2,
        horseName: 'Steady Eddie',
        postPosition: 2,
        runningStyle: 'E/P',
      }),
      createMockHorseEntry({
        programNumber: 3,
        horseName: 'Longshot Larry',
        postPosition: 3,
        runningStyle: 'S',
      }),
    ],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function createDefaultTrainerPatternsForAI(): TrainerPatternsForAI {
  const defaultStat = { starts: 0, wins: 0, winPercent: 0, roi: 0 };
  return {
    firstTimeLasix: defaultStat,
    firstTimeBlinkers: defaultStat,
    blinkersOff: defaultStat,
    secondOffLayoff: defaultStat,
    days31to60: defaultStat,
    days61to90: defaultStat,
    days91to180: defaultStat,
    days181plus: defaultStat,
    sprintToRoute: defaultStat,
    routeToSprint: defaultStat,
    turfSprint: defaultStat,
    turfRoute: defaultStat,
    wetTrack: defaultStat,
    dirtSprint: defaultStat,
    dirtRoute: defaultStat,
    maidenClaiming: defaultStat,
    stakes: defaultStat,
    firstStartTrainer: defaultStat,
    afterClaim: defaultStat,
  };
}

function createMockPastPerformanceForAI(
  overrides: Partial<PastPerformanceForAI> = {}
): PastPerformanceForAI {
  return {
    date: '2024-01-15',
    track: 'SA',
    distance: 6,
    surface: 'dirt',
    trackCondition: 'fast',
    finishPosition: 2,
    fieldSize: 8,
    lengthsBehind: 1.5,
    beyer: 82,
    earlyPace1: 95,
    latePace: 88,
    tripComment: 'Stalked pace, drew clear',
    odds: 4.5,
    favoriteRank: 2,
    runningLine: { start: 3, stretch: 2, finish: 2 },
    ...overrides,
  };
}

function createMockHorseScore(overrides: Partial<HorseScoreForAI> = {}): HorseScoreForAI {
  return {
    programNumber: 1,
    horseName: 'Fast Runner',
    rank: 1,
    finalScore: 185,
    confidenceTier: 'high',
    breakdown: {
      speedScore: 52,
      classScore: 40,
      formScore: 30,
      paceScore: 28,
      connectionScore: 25,
    },
    positiveFactors: ['Top Beyer figure', 'Strong trainer stats'],
    negativeFactors: [],
    isScratched: false,
    pastPerformances: [],
    workouts: [],
    trainerPatterns: createDefaultTrainerPatternsForAI(),
    equipment: {
      blinkers: false,
      blinkersOff: false,
      frontBandages: false,
      tongueTie: false,
      nasalStrip: false,
      shadowRoll: false,
      barShoes: false,
      mudCaulks: false,
      firstTimeEquipment: [],
      equipmentChanges: [],
    },
    breeding: { sire: '', damSire: '', whereBred: '' },
    distanceSurfaceStats: {
      distanceStarts: 0,
      distanceWins: 0,
      distanceWinRate: 0,
      surfaceStarts: 0,
      surfaceWins: 0,
      surfaceWinRate: 0,
      turfStarts: 0,
      turfWins: 0,
      turfWinRate: 0,
      wetStarts: 0,
      wetWins: 0,
      wetWinRate: 0,
    },
    formIndicators: {
      daysSinceLastRace: null,
      averageBeyer: null,
      bestBeyer: null,
      lastBeyer: null,
      earlySpeedRating: null,
      lifetimeStarts: 0,
      lifetimeWins: 0,
      lifetimeWinRate: 0,
    },
    morningLineOdds: '5-1',
    morningLineDecimal: 5.0,
    ...overrides,
  };
}

function createMockTrackIntelligence(
  overrides: Partial<TrackIntelligenceForAI> = {}
): TrackIntelligenceForAI {
  return {
    trackCode: 'SA',
    trackName: 'Santa Anita',
    surface: 'dirt',
    distance: 6,
    isSprintOrRoute: 'sprint',
    postPositionBias: {
      winPercentByPost: [12, 14, 11, 10, 9, 8, 7, 6],
      favoredPosts: [1, 2],
      biasStrength: 'moderate',
      biasDescription: 'Inside posts favored at sprint distances',
    },
    speedBias: {
      earlySpeedWinRate: 58,
      paceAdvantageRating: 7,
      favoredStyle: 'E/P',
      biasDescription: 'Speed holds well on fast dirt',
    },
    trackCharacteristics: {
      circumference: 1.0,
      stretchLength: 990,
      playingStyle: 'speed-favoring',
      drainage: 'good',
    },
    seasonalContext: {
      currentSeason: 'winter',
      typicalCondition: 'fast',
      speedAdjustment: 0,
      favoredStyle: 'E',
      notes: 'Firm ground favors early speed',
    },
    dataQuality: 'verified',
    ...overrides,
  };
}

function createMockRaceAnalysis(overrides: Partial<RaceAnalysis> = {}): RaceAnalysis {
  return {
    paceScenario: {
      expectedPace: 'moderate',
      likelyLeader: 1,
      speedDuelProbability: 0.3,
      earlySpeedCount: 2,
    },
    fieldStrength: 'average',
    vulnerableFavorite: false,
    likelyPaceCollapse: false,
    trackIntelligence: null,
    ...overrides,
  };
}

function createMockScoringResult(overrides: Partial<RaceScoringResult> = {}): RaceScoringResult {
  return {
    scores: [
      createMockHorseScore({ programNumber: 1, horseName: 'Fast Runner', rank: 1 }),
      createMockHorseScore({
        programNumber: 2,
        horseName: 'Steady Eddie',
        rank: 2,
        finalScore: 170,
      }),
      createMockHorseScore({
        programNumber: 3,
        horseName: 'Longshot Larry',
        rank: 3,
        finalScore: 145,
      }),
    ],
    raceAnalysis: createMockRaceAnalysis(),
    ...overrides,
  };
}

// ============================================================================
// TESTS - calculatePaceAverage
// ============================================================================

describe('calculatePaceAverage', () => {
  it('calculates average correctly for valid values', () => {
    expect(calculatePaceAverage([90, 92, 94])).toBe(92);
    expect(calculatePaceAverage([85, 90])).toBe(88); // Rounded
    expect(calculatePaceAverage([100])).toBe(100);
  });

  it('ignores null values when calculating average', () => {
    expect(calculatePaceAverage([90, null, 94])).toBe(92);
    expect(calculatePaceAverage([null, 85, null, 90, null])).toBe(88);
  });

  it('returns null for all-null values', () => {
    expect(calculatePaceAverage([null, null, null])).toBe(null);
    expect(calculatePaceAverage([])).toBe(null);
  });

  it('rounds to nearest integer', () => {
    expect(calculatePaceAverage([91, 92])).toBe(92); // 91.5 rounds to 92
    expect(calculatePaceAverage([89, 90, 91])).toBe(90); // 90 exact
  });
});

// ============================================================================
// TESTS - classifySpeedProfile
// ============================================================================

describe('classifySpeedProfile', () => {
  it('classifies Early Burner when EP1 exceeds LP by 5+', () => {
    expect(classifySpeedProfile(95, 88)).toBe('Early Burner');
    expect(classifySpeedProfile(100, 90)).toBe('Early Burner');
    expect(classifySpeedProfile(93, 88)).toBe('Early Burner');
  });

  it('classifies Presser when EP1 slightly exceeds LP (0-4)', () => {
    expect(classifySpeedProfile(92, 90)).toBe('Presser');
    expect(classifySpeedProfile(90, 90)).toBe('Presser');
    expect(classifySpeedProfile(94, 90)).toBe('Presser');
  });

  it('classifies Mid-Pack when LP slightly exceeds EP1 (1-5)', () => {
    expect(classifySpeedProfile(88, 90)).toBe('Mid-Pack');
    expect(classifySpeedProfile(85, 90)).toBe('Mid-Pack');
  });

  it('classifies Closer when LP exceeds EP1 by 6+', () => {
    expect(classifySpeedProfile(82, 92)).toBe('Closer');
    expect(classifySpeedProfile(80, 95)).toBe('Closer');
  });

  it('returns Unknown when either value is null', () => {
    expect(classifySpeedProfile(null, 90)).toBe('Unknown');
    expect(classifySpeedProfile(92, null)).toBe('Unknown');
    expect(classifySpeedProfile(null, null)).toBe('Unknown');
  });
});

// ============================================================================
// TESTS - analyzePaceTendencies
// ============================================================================

describe('analyzePaceTendencies', () => {
  it('detects CONFIRMED EARLY SPEED when started 1-2 in 2+ of last 3 races', () => {
    const pps = [
      createMockPastPerformanceForAI({ runningLine: { start: 1, stretch: 1, finish: 2 } }),
      createMockPastPerformanceForAI({ runningLine: { start: 2, stretch: 2, finish: 3 } }),
      createMockPastPerformanceForAI({ runningLine: { start: 4, stretch: 3, finish: 4 } }),
    ];
    const result = analyzePaceTendencies(pps);
    expect(result.confirmedEarlySpeed).toBe(true);
  });

  it('does not flag CONFIRMED EARLY SPEED when started 1-2 in only 1 race', () => {
    const pps = [
      createMockPastPerformanceForAI({ runningLine: { start: 1, stretch: 1, finish: 2 } }),
      createMockPastPerformanceForAI({ runningLine: { start: 5, stretch: 4, finish: 4 } }),
      createMockPastPerformanceForAI({ runningLine: { start: 4, stretch: 3, finish: 3 } }),
    ];
    const result = analyzePaceTendencies(pps);
    expect(result.confirmedEarlySpeed).toBe(false);
  });

  it('detects CONFIRMED CLOSER when started 6+ and finished 1-3 in 2+ races', () => {
    const pps = [
      createMockPastPerformanceForAI({
        runningLine: { start: 8, stretch: 4, finish: 2 },
        finishPosition: 2,
      }),
      createMockPastPerformanceForAI({
        runningLine: { start: 7, stretch: 3, finish: 1 },
        finishPosition: 1,
      }),
      createMockPastPerformanceForAI({
        runningLine: { start: 6, stretch: 4, finish: 3 },
        finishPosition: 3,
      }),
    ];
    const result = analyzePaceTendencies(pps);
    expect(result.confirmedCloser).toBe(true);
  });

  it('does not flag CONFIRMED CLOSER when finish position is worse than 3rd', () => {
    const pps = [
      createMockPastPerformanceForAI({
        runningLine: { start: 8, stretch: 6, finish: 5 },
        finishPosition: 5,
      }),
      createMockPastPerformanceForAI({
        runningLine: { start: 7, stretch: 5, finish: 4 },
        finishPosition: 4,
      }),
    ];
    const result = analyzePaceTendencies(pps);
    expect(result.confirmedCloser).toBe(false);
  });

  it('detects STRONG LATE KICK when position improves 3+ spots in 2+ races', () => {
    const pps = [
      createMockPastPerformanceForAI({ runningLine: { start: 7, stretch: 4, finish: 3 } }),
      createMockPastPerformanceForAI({ runningLine: { start: 6, stretch: 3, finish: 2 } }),
      createMockPastPerformanceForAI({ runningLine: { start: 3, stretch: 2, finish: 2 } }),
    ];
    const result = analyzePaceTendencies(pps);
    expect(result.strongLateKick).toBe(true);
  });

  it('does not flag STRONG LATE KICK when improvement is less than 3 spots', () => {
    const pps = [
      createMockPastPerformanceForAI({ runningLine: { start: 4, stretch: 3, finish: 3 } }),
      createMockPastPerformanceForAI({ runningLine: { start: 5, stretch: 4, finish: 4 } }),
    ];
    const result = analyzePaceTendencies(pps);
    expect(result.strongLateKick).toBe(false);
  });

  it('detects FADES LATE when position drops 3+ spots in 2+ races', () => {
    const pps = [
      createMockPastPerformanceForAI({ runningLine: { start: 1, stretch: 3, finish: 5 } }),
      createMockPastPerformanceForAI({ runningLine: { start: 2, stretch: 4, finish: 6 } }),
      createMockPastPerformanceForAI({ runningLine: { start: 3, stretch: 3, finish: 4 } }),
    ];
    const result = analyzePaceTendencies(pps);
    expect(result.fadesLate).toBe(true);
  });

  it('does not flag FADES LATE when only 1 race shows fading', () => {
    const pps = [
      createMockPastPerformanceForAI({ runningLine: { start: 1, stretch: 3, finish: 5 } }),
      createMockPastPerformanceForAI({ runningLine: { start: 2, stretch: 2, finish: 2 } }),
      createMockPastPerformanceForAI({ runningLine: { start: 3, stretch: 2, finish: 1 } }),
    ];
    const result = analyzePaceTendencies(pps);
    expect(result.fadesLate).toBe(false);
  });

  it('returns all false for less than 2 past performances', () => {
    const pps = [createMockPastPerformanceForAI()];
    const result = analyzePaceTendencies(pps);
    expect(result.confirmedEarlySpeed).toBe(false);
    expect(result.confirmedCloser).toBe(false);
    expect(result.strongLateKick).toBe(false);
    expect(result.fadesLate).toBe(false);
  });

  it('handles null values in running line gracefully', () => {
    const pps = [
      createMockPastPerformanceForAI({ runningLine: { start: null, stretch: 3, finish: null } }),
      createMockPastPerformanceForAI({ runningLine: { start: null, stretch: null, finish: null } }),
      createMockPastPerformanceForAI({ runningLine: { start: 2, stretch: 2, finish: 3 } }),
    ];
    const result = analyzePaceTendencies(pps);
    // Should not crash and return reasonable defaults
    expect(result).toBeDefined();
  });
});

// ============================================================================
// TESTS - formatHorseForPaceScenario
// ============================================================================

describe('formatHorseForPaceScenario', () => {
  it('includes header with program number, name, style, and rank', () => {
    const horse = createMockHorseScore({
      programNumber: 5,
      horseName: 'Speed Demon',
      rank: 2,
    });
    const horseData = { postPosition: 3, runningStyle: 'E' as const };

    const result = formatHorseForPaceScenario(horse, horseData);

    expect(result).toContain('#5 Speed Demon | Style: E | Rank: 2');
  });

  it('calculates and displays EP1/LP averages correctly', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ earlyPace1: 94, latePace: 86 }),
        createMockPastPerformanceForAI({ earlyPace1: 92, latePace: 88 }),
        createMockPastPerformanceForAI({ earlyPace1: 96, latePace: 84 }),
      ],
    });
    const horseData = { postPosition: 1, runningStyle: 'E' as const };

    const result = formatHorseForPaceScenario(horse, horseData);

    expect(result).toContain('Avg EP1: 94 | Avg LP: 86');
  });

  it('displays Early Speed Rating from form indicators', () => {
    const horse = createMockHorseScore({
      formIndicators: {
        daysSinceLastRace: 14,
        averageBeyer: 85,
        bestBeyer: 90,
        lastBeyer: 85,
        earlySpeedRating: 98,
        lifetimeStarts: 10,
        lifetimeWins: 3,
        lifetimeWinRate: 0.3,
      },
    });
    const horseData = { postPosition: 1, runningStyle: 'E' as const };

    const result = formatHorseForPaceScenario(horse, horseData);

    expect(result).toContain('Early Speed Rating: 98');
  });

  it('classifies speed profile correctly as Early Burner', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ earlyPace1: 95, latePace: 85 }),
        createMockPastPerformanceForAI({ earlyPace1: 93, latePace: 87 }),
      ],
    });
    const horseData = { postPosition: 1, runningStyle: 'E' as const };

    const result = formatHorseForPaceScenario(horse, horseData);

    expect(result).toContain('SPEED PROFILE: Early Burner');
  });

  it('classifies speed profile correctly as Closer', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ earlyPace1: 80, latePace: 92 }),
        createMockPastPerformanceForAI({ earlyPace1: 82, latePace: 94 }),
      ],
    });
    const horseData = { postPosition: 5, runningStyle: 'S' as const };

    const result = formatHorseForPaceScenario(horse, horseData);

    expect(result).toContain('SPEED PROFILE: Closer');
  });

  it('shows "Pace figures: UNAVAILABLE" when all EP1/LP are null', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ earlyPace1: null, latePace: null }),
        createMockPastPerformanceForAI({ earlyPace1: null, latePace: null }),
      ],
    });
    const horseData = { postPosition: 1, runningStyle: 'E' as const };

    const result = formatHorseForPaceScenario(horse, horseData);

    expect(result).toContain('Pace figures: UNAVAILABLE');
  });

  it('formats past performance pace data correctly', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({
          track: 'CD',
          distance: 8,
          earlyPace1: 91,
          latePace: 89,
          finishPosition: 2,
          fieldSize: 10,
          runningLine: { start: 4, stretch: 2, finish: 2 },
        }),
      ],
    });
    const horseData = { postPosition: 3, runningStyle: 'E/P' as const };

    const result = formatHorseForPaceScenario(horse, horseData);

    expect(result).toContain('CD 8f: EP1 91 / LP 89');
    expect(result).toContain('Start: 4 -> Stretch: 2 -> Finish: 2');
    expect(result).toContain('Final Position: 2/10');
  });

  it('displays CONFIRMED EARLY SPEED flag when appropriate', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ runningLine: { start: 1, stretch: 1, finish: 1 } }),
        createMockPastPerformanceForAI({ runningLine: { start: 2, stretch: 1, finish: 2 } }),
        createMockPastPerformanceForAI({ runningLine: { start: 1, stretch: 2, finish: 3 } }),
      ],
    });
    const horseData = { postPosition: 1, runningStyle: 'E' as const };

    const result = formatHorseForPaceScenario(horse, horseData);

    expect(result).toContain('CONFIRMED EARLY SPEED');
  });

  it('displays CONFIRMED CLOSER flag when appropriate', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({
          runningLine: { start: 8, stretch: 3, finish: 1 },
          finishPosition: 1,
        }),
        createMockPastPerformanceForAI({
          runningLine: { start: 7, stretch: 4, finish: 2 },
          finishPosition: 2,
        }),
      ],
    });
    const horseData = { postPosition: 6, runningStyle: 'S' as const };

    const result = formatHorseForPaceScenario(horse, horseData);

    expect(result).toContain('CONFIRMED CLOSER');
  });

  it('displays STRONG LATE KICK flag when appropriate', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ runningLine: { start: 7, stretch: 3, finish: 2 } }),
        createMockPastPerformanceForAI({ runningLine: { start: 8, stretch: 4, finish: 3 } }),
      ],
    });
    const horseData = { postPosition: 4, runningStyle: 'S' as const };

    const result = formatHorseForPaceScenario(horse, horseData);

    expect(result).toContain('STRONG LATE KICK');
  });

  it('displays FADES LATE flag when appropriate', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ runningLine: { start: 1, stretch: 3, finish: 5 } }),
        createMockPastPerformanceForAI({ runningLine: { start: 2, stretch: 4, finish: 6 } }),
      ],
    });
    const horseData = { postPosition: 2, runningStyle: 'E' as const };

    const result = formatHorseForPaceScenario(horse, horseData);

    expect(result).toContain('FADES LATE');
  });

  it('shows post position', () => {
    const horse = createMockHorseScore({ programNumber: 3, horseName: 'Test Horse' });
    const horseData = { postPosition: 5, runningStyle: 'E/P' as const };

    const result = formatHorseForPaceScenario(horse, horseData);

    expect(result).toContain('Post: 5');
  });

  it('handles undefined horse data gracefully', () => {
    const horse = createMockHorseScore({
      programNumber: 4,
      horseName: 'Unknown Horse',
      formIndicators: {
        daysSinceLastRace: null,
        averageBeyer: null,
        bestBeyer: null,
        lastBeyer: null,
        earlySpeedRating: 95,
        lifetimeStarts: 5,
        lifetimeWins: 1,
        lifetimeWinRate: 0.2,
      },
    });

    const result = formatHorseForPaceScenario(horse, undefined);

    expect(result).toContain('#4 Unknown Horse');
    expect(result).toContain('Post: N/A');
  });
});

// ============================================================================
// TESTS - formatHorseForPaceScenarioAbbreviated
// ============================================================================

describe('formatHorseForPaceScenarioAbbreviated', () => {
  it('produces abbreviated format for horses ranked 7+', () => {
    const horse = createMockHorseScore({
      programNumber: 8,
      horseName: 'Longshot Luke',
      rank: 8,
      pastPerformances: [
        createMockPastPerformanceForAI({ earlyPace1: 82 }),
        createMockPastPerformanceForAI({ earlyPace1: 84 }),
        createMockPastPerformanceForAI({ earlyPace1: 80 }),
      ],
    });
    const horseData = { postPosition: 8, runningStyle: 'S' as const };

    const result = formatHorseForPaceScenarioAbbreviated(horse, horseData);

    expect(result).toBe('#8 Longshot Luke | Style: S | EP1 Avg: 82');
    expect(result).not.toContain('SPEED PROFILE');
    expect(result).not.toContain('Start:');
    expect(result).not.toContain('Post:');
  });

  it('handles null EP1 averages', () => {
    const horse = createMockHorseScore({
      programNumber: 9,
      horseName: 'No Pace Data',
      rank: 9,
      pastPerformances: [
        createMockPastPerformanceForAI({ earlyPace1: null }),
        createMockPastPerformanceForAI({ earlyPace1: null }),
      ],
    });
    const horseData = { postPosition: 9, runningStyle: 'P' as const };

    const result = formatHorseForPaceScenarioAbbreviated(horse, horseData);

    expect(result).toContain('EP1 Avg: N/A');
  });
});

// ============================================================================
// TESTS - buildPaceScenarioPrompt
// ============================================================================

describe('buildPaceScenarioPrompt', () => {
  it('returns a string', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('includes system prompt with JSON instruction', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(prompt).toContain('You are a horse racing pace analyst');
    expect(prompt).toContain('Return JSON only');
  });

  it('includes track intelligence section when available', () => {
    const trackIntel = createMockTrackIntelligence({
      speedBias: {
        earlySpeedWinRate: 58,
        paceAdvantageRating: 7,
        favoredStyle: 'E/P',
        biasDescription: 'Speed holds well',
      },
    });
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      raceAnalysis: createMockRaceAnalysis({
        trackIntelligence: trackIntel,
      }),
    });

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(prompt).toContain('TRACK BIAS CONTEXT:');
    expect(prompt).toContain('SPEED BIAS:');
    expect(prompt).toContain('58% early speed wins');
  });

  it('includes warning when track intelligence is null', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      raceAnalysis: createMockRaceAnalysis({
        trackIntelligence: null,
      }),
    });

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(prompt).toContain('NOT AVAILABLE');
    expect(prompt).toContain('use caution on pace/position analysis');
  });

  it('includes all horses in the prompt', () => {
    const race = createMockParsedRace({
      horses: [
        createMockHorseEntry({ programNumber: 1, horseName: 'Speed King', runningStyle: 'E' }),
        createMockHorseEntry({ programNumber: 2, horseName: 'Presser Pete', runningStyle: 'E/P' }),
        createMockHorseEntry({ programNumber: 3, horseName: 'Closing Colleen', runningStyle: 'S' }),
      ],
    });
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({ programNumber: 1, horseName: 'Speed King', rank: 1 }),
        createMockHorseScore({ programNumber: 2, horseName: 'Presser Pete', rank: 2 }),
        createMockHorseScore({ programNumber: 3, horseName: 'Closing Colleen', rank: 3 }),
      ],
    });

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(prompt).toContain('Speed King');
    expect(prompt).toContain('Presser Pete');
    expect(prompt).toContain('Closing Colleen');
  });

  it('abbreviates horses ranked 7+', () => {
    const horses = [];
    const scores = [];
    for (let i = 1; i <= 10; i++) {
      horses.push(
        createMockHorseEntry({
          programNumber: i,
          horseName: `Horse ${i}`,
          runningStyle: 'E/P',
        })
      );
      scores.push(
        createMockHorseScore({
          programNumber: i,
          horseName: `Horse ${i}`,
          rank: i,
          pastPerformances: [createMockPastPerformanceForAI({ earlyPace1: 90 })],
        })
      );
    }

    const race = createMockParsedRace({ horses });
    const scoringResult = createMockScoringResult({ scores });

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    // Horses 1-6 should have full format with SPEED PROFILE
    expect(prompt).toContain('#1 Horse 1 | Style: E/P | Rank: 1');
    expect(prompt).toContain('#6 Horse 6 | Style: E/P | Rank: 6');

    // Horses 7+ should have abbreviated format (no SPEED PROFILE for them)
    // The abbreviated format just has EP1 Avg
    expect(prompt).toContain('#7 Horse 7 | Style: E/P | EP1 Avg:');
    expect(prompt).toContain('#10 Horse 10 | Style: E/P | EP1 Avg:');
  });

  it('includes pace scenario classification guide', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(prompt).toContain('PACE SCENARIO CLASSIFICATION');
    expect(prompt).toContain('LONE_SPEED');
    expect(prompt).toContain('SPEED_DUEL');
    expect(prompt).toContain('MODERATE');
    expect(prompt).toContain('SLOW');
  });

  it('includes track bias integration instructions', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(prompt).toContain('USE TRACK BIAS TO INFORM ANALYSIS');
    expect(prompt).toContain('speed bias >55%');
    expect(prompt).toContain('stretch >1100ft');
    expect(prompt).toContain('stretch <990ft');
  });

  it('includes pace collapse warning criteria', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(prompt).toContain('PACE COLLAPSE WARNING');
    expect(prompt).toContain('3+ confirmed speed horses');
    expect(prompt).toContain('EP1 spread <5 points');
  });

  it('includes golden scenarios guidance', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(prompt).toContain('GOLDEN SCENARIOS');
    expect(prompt).toContain('Lone speed + speed-favoring track');
    expect(prompt).toContain('Speed duel + deep closer');
  });

  it('includes race context with early speed count', () => {
    const race = createMockParsedRace({
      header: createMockRaceHeader({
        trackName: 'Churchill Downs',
        trackCode: 'CD',
        distanceFurlongs: 8,
        surface: 'dirt',
      }),
    });
    const scoringResult = createMockScoringResult({
      raceAnalysis: createMockRaceAnalysis({
        paceScenario: {
          expectedPace: 'hot',
          likelyLeader: 1,
          speedDuelProbability: 0.75,
          earlySpeedCount: 4,
        },
      }),
    });

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(prompt).toContain('Track: Churchill Downs (CD)');
    expect(prompt).toContain('Distance: 8f dirt');
    expect(prompt).toContain('Algorithm Early Speed Count: 4');
    expect(prompt).toContain('Algorithm Speed Duel Probability: 75%');
  });

  it('includes expected output structure with beneficiaries', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(prompt).toContain('"paceProjection"');
    expect(prompt).toContain('"earlySpeedHorses"');
    expect(prompt).toContain('"likelyLeader"');
    expect(prompt).toContain('"speedDuelLikely"');
    expect(prompt).toContain('"paceCollapseRisk"');
    expect(prompt).toContain('"beneficiaries"');
    expect(prompt).toContain('"advantage"');
    expect(prompt).toContain('"edgeStrength"');
    expect(prompt).toContain('"loneSpeedException"');
    expect(prompt).toContain('"confidence"');
    expect(prompt).toContain('"reasoning"');
  });

  it('excludes scratched horses', () => {
    const race = createMockParsedRace({
      horses: [
        createMockHorseEntry({ programNumber: 1, horseName: 'Active Horse' }),
        createMockHorseEntry({ programNumber: 2, horseName: 'Scratched Horse' }),
      ],
    });
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({ programNumber: 1, horseName: 'Active Horse', isScratched: false }),
        createMockHorseScore({ programNumber: 2, horseName: 'Scratched Horse', isScratched: true }),
      ],
    });

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(prompt).toContain('Active Horse');
    expect(prompt).not.toContain('Scratched Horse');
  });
});

// ============================================================================
// SCENARIO TESTS - Integration-style tests
// ============================================================================

describe('Pace Scenario Prompt - Scenario Tests', () => {
  it('Scenario A - Lone Speed Detection: highlights lone speed scenario', () => {
    // Field with 1 horse having "CONFIRMED EARLY SPEED", others are closers
    const race = createMockParsedRace({
      horses: [
        createMockHorseEntry({ programNumber: 1, horseName: 'Lone Speedster', runningStyle: 'E' }),
        createMockHorseEntry({ programNumber: 2, horseName: 'Deep Closer', runningStyle: 'S' }),
        createMockHorseEntry({ programNumber: 3, horseName: 'Another Closer', runningStyle: 'S' }),
      ],
    });
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          programNumber: 1,
          horseName: 'Lone Speedster',
          rank: 1,
          pastPerformances: [
            createMockPastPerformanceForAI({
              earlyPace1: 96,
              latePace: 84,
              runningLine: { start: 1, stretch: 1, finish: 1 },
            }),
            createMockPastPerformanceForAI({
              earlyPace1: 94,
              latePace: 86,
              runningLine: { start: 2, stretch: 1, finish: 2 },
            }),
            createMockPastPerformanceForAI({
              earlyPace1: 95,
              latePace: 85,
              runningLine: { start: 1, stretch: 2, finish: 1 },
            }),
          ],
        }),
        createMockHorseScore({
          programNumber: 2,
          horseName: 'Deep Closer',
          rank: 2,
          pastPerformances: [
            createMockPastPerformanceForAI({
              earlyPace1: 80,
              latePace: 92,
              runningLine: { start: 8, stretch: 3, finish: 1 },
              finishPosition: 1,
            }),
            createMockPastPerformanceForAI({
              earlyPace1: 78,
              latePace: 94,
              runningLine: { start: 7, stretch: 4, finish: 2 },
              finishPosition: 2,
            }),
          ],
        }),
        createMockHorseScore({
          programNumber: 3,
          horseName: 'Another Closer',
          rank: 3,
          pastPerformances: [
            createMockPastPerformanceForAI({
              earlyPace1: 82,
              latePace: 90,
              runningLine: { start: 6, stretch: 5, finish: 3 },
              finishPosition: 3,
            }),
          ],
        }),
      ],
      raceAnalysis: createMockRaceAnalysis({
        paceScenario: {
          expectedPace: 'slow',
          likelyLeader: 1,
          speedDuelProbability: 0.1,
          earlySpeedCount: 1,
        },
      }),
    });

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    // Lone Speedster should have CONFIRMED EARLY SPEED flag
    expect(prompt).toContain('Lone Speedster');
    expect(prompt).toContain('CONFIRMED EARLY SPEED');
    expect(prompt).toContain('Early Speed Count: 1');
  });

  it('Scenario B - Speed Duel Setup: identifies speed duel risk', () => {
    // Field with 3 horses having EP1 >92
    const race = createMockParsedRace({
      horses: [
        createMockHorseEntry({ programNumber: 1, horseName: 'Speed 1', runningStyle: 'E' }),
        createMockHorseEntry({ programNumber: 2, horseName: 'Speed 2', runningStyle: 'E' }),
        createMockHorseEntry({ programNumber: 3, horseName: 'Speed 3', runningStyle: 'E/P' }),
        createMockHorseEntry({ programNumber: 4, horseName: 'Closer', runningStyle: 'S' }),
      ],
    });
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          programNumber: 1,
          horseName: 'Speed 1',
          rank: 1,
          pastPerformances: [
            createMockPastPerformanceForAI({
              earlyPace1: 96,
              latePace: 82,
              runningLine: { start: 1, stretch: 2, finish: 3 },
            }),
            createMockPastPerformanceForAI({
              earlyPace1: 94,
              latePace: 84,
              runningLine: { start: 2, stretch: 1, finish: 2 },
            }),
          ],
        }),
        createMockHorseScore({
          programNumber: 2,
          horseName: 'Speed 2',
          rank: 2,
          pastPerformances: [
            createMockPastPerformanceForAI({
              earlyPace1: 95,
              latePace: 83,
              runningLine: { start: 1, stretch: 1, finish: 2 },
            }),
            createMockPastPerformanceForAI({
              earlyPace1: 93,
              latePace: 85,
              runningLine: { start: 2, stretch: 2, finish: 1 },
            }),
          ],
        }),
        createMockHorseScore({
          programNumber: 3,
          horseName: 'Speed 3',
          rank: 3,
          pastPerformances: [
            createMockPastPerformanceForAI({ earlyPace1: 94, latePace: 86 }),
            createMockPastPerformanceForAI({ earlyPace1: 92, latePace: 88 }),
          ],
        }),
        createMockHorseScore({
          programNumber: 4,
          horseName: 'Closer',
          rank: 4,
          pastPerformances: [createMockPastPerformanceForAI({ earlyPace1: 80, latePace: 92 })],
        }),
      ],
      raceAnalysis: createMockRaceAnalysis({
        paceScenario: {
          expectedPace: 'hot',
          likelyLeader: null,
          speedDuelProbability: 0.85,
          earlySpeedCount: 3,
        },
      }),
    });

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    // Should show high speed duel probability and multiple speed horses
    expect(prompt).toContain('Speed Duel Probability: 85%');
    expect(prompt).toContain('Early Speed Count: 3');
    // Each speed horse should have their high EP1 averages visible
    expect(prompt).toContain('Avg EP1: 95'); // Speed 1
    expect(prompt).toContain('Avg EP1: 94'); // Speed 2
  });

  it('Scenario C - Track Bias Integration: formats track intelligence with 58% early speed win rate', () => {
    const trackIntel = createMockTrackIntelligence({
      trackName: 'Gulfstream Park',
      trackCode: 'GP',
      speedBias: {
        earlySpeedWinRate: 58,
        paceAdvantageRating: 7,
        favoredStyle: 'E',
        biasDescription: 'Speed favoring rail, closers struggle',
      },
      trackCharacteristics: {
        circumference: 1.0,
        stretchLength: 950,
        playingStyle: 'speed-favoring',
        drainage: 'good',
      },
    });
    const race = createMockParsedRace({
      header: createMockRaceHeader({
        trackName: 'Gulfstream Park',
        trackCode: 'GP',
      }),
    });
    const scoringResult = createMockScoringResult({
      raceAnalysis: createMockRaceAnalysis({
        trackIntelligence: trackIntel,
      }),
    });

    const prompt = buildPaceScenarioPrompt(race, scoringResult);

    expect(prompt).toContain('TRACK: Gulfstream Park (GP)');
    expect(prompt).toContain('SPEED BIAS: 58% early speed wins');
    expect(prompt).toContain('Favors: E');
    expect(prompt).toContain('Stretch: 950ft');
  });
});
