/**
 * Tests for Trip Trouble Prompt Builder
 *
 * Tests for formatHorseForTripTrouble helper and buildTripTroublePrompt
 */

import { describe, it, expect } from 'vitest';
import {
  formatHorseForTripTrouble,
  buildTripTroublePrompt,
  hasTroubleKeyword,
  countTroubledRaces,
  analyzePositionFlow,
  analyzeBeyerTrajectory,
} from '../prompt';
import type { ParsedRace, RaceHeader, HorseEntry, PastPerformance } from '../../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../../types/drf';
import type {
  RaceScoringResult,
  HorseScoreForAI,
  RaceAnalysis,
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
      createMockHorseEntry({ programNumber: 1, horseName: 'Fast Runner' }),
      createMockHorseEntry({ programNumber: 2, horseName: 'Steady Eddie' }),
      createMockHorseEntry({ programNumber: 3, horseName: 'Longshot Larry' }),
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
// TESTS - hasTroubleKeyword
// ============================================================================

describe('hasTroubleKeyword', () => {
  it('detects traffic trouble keywords', () => {
    expect(hasTroubleKeyword('blocked in stretch')).toBe(true);
    expect(hasTroubleKeyword('boxed in, no room')).toBe(true);
    expect(hasTroubleKeyword('had no room to run')).toBe(true);
    expect(hasTroubleKeyword('tight quarters throughout')).toBe(true);
    expect(hasTroubleKeyword('shuffled back on turn')).toBe(true);
  });

  it('detects contact trouble keywords', () => {
    expect(hasTroubleKeyword('bumped at start')).toBe(true);
    expect(hasTroubleKeyword('checked sharply')).toBe(true);
    expect(hasTroubleKeyword('steadied on turn')).toBe(true);
    expect(hasTroubleKeyword('impeded by faller')).toBe(true);
  });

  it('detects path trouble keywords', () => {
    expect(hasTroubleKeyword('wide throughout')).toBe(true);
    expect(hasTroubleKeyword('5-wide on turn')).toBe(true);
    expect(hasTroubleKeyword('6-wide into stretch')).toBe(true);
    expect(hasTroubleKeyword('parked out 4 wide')).toBe(true);
  });

  it('detects start trouble keywords', () => {
    expect(hasTroubleKeyword('broke slow')).toBe(true);
    expect(hasTroubleKeyword('broke poorly')).toBe(true);
    expect(hasTroubleKeyword('stumbled at start')).toBe(true);
    expect(hasTroubleKeyword('dwelt at gate')).toBe(true);
  });

  it('detects late trouble keywords', () => {
    expect(hasTroubleKeyword('no late room')).toBe(true);
    expect(hasTroubleKeyword("couldn't get out")).toBe(true);
    expect(hasTroubleKeyword('blocked stretch')).toBe(true);
  });

  it('returns false for clean trips', () => {
    expect(hasTroubleKeyword('clear trip')).toBe(false);
    expect(hasTroubleKeyword('no excuses')).toBe(false);
    expect(hasTroubleKeyword('raced well')).toBe(false);
    expect(hasTroubleKeyword('stalked pace, drew clear')).toBe(false);
    expect(hasTroubleKeyword('drew off')).toBe(false);
  });

  it('handles empty and null comments', () => {
    expect(hasTroubleKeyword('')).toBe(false);
    expect(hasTroubleKeyword(null as unknown as string)).toBe(false);
    expect(hasTroubleKeyword(undefined as unknown as string)).toBe(false);
  });

  it('is case insensitive', () => {
    expect(hasTroubleKeyword('BLOCKED in stretch')).toBe(true);
    expect(hasTroubleKeyword('Bumped AT START')).toBe(true);
    expect(hasTroubleKeyword('Wide Trip')).toBe(true);
  });
});

// ============================================================================
// TESTS - countTroubledRaces
// ============================================================================

describe('countTroubledRaces', () => {
  it('counts correctly with no troubled races', () => {
    const pps = [
      createMockPastPerformanceForAI({ tripComment: 'clear trip' }),
      createMockPastPerformanceForAI({ tripComment: 'no excuses' }),
      createMockPastPerformanceForAI({ tripComment: 'stalked pace' }),
    ];
    expect(countTroubledRaces(pps)).toBe(0);
  });

  it('counts correctly with 1 troubled race', () => {
    const pps = [
      createMockPastPerformanceForAI({ tripComment: 'blocked in stretch' }),
      createMockPastPerformanceForAI({ tripComment: 'clear trip' }),
      createMockPastPerformanceForAI({ tripComment: 'no excuses' }),
    ];
    expect(countTroubledRaces(pps)).toBe(1);
  });

  it('counts correctly with 2 troubled races', () => {
    const pps = [
      createMockPastPerformanceForAI({ tripComment: 'blocked in stretch' }),
      createMockPastPerformanceForAI({ tripComment: 'bumped at start, wide trip' }),
      createMockPastPerformanceForAI({ tripComment: 'stalked pace' }),
    ];
    expect(countTroubledRaces(pps)).toBe(2);
  });

  it('counts correctly with 3 troubled races', () => {
    const pps = [
      createMockPastPerformanceForAI({ tripComment: 'blocked' }),
      createMockPastPerformanceForAI({ tripComment: 'checked' }),
      createMockPastPerformanceForAI({ tripComment: 'steadied' }),
    ];
    expect(countTroubledRaces(pps)).toBe(3);
  });

  it('only counts first 3 past performances', () => {
    const pps = [
      createMockPastPerformanceForAI({ tripComment: 'blocked' }),
      createMockPastPerformanceForAI({ tripComment: 'checked' }),
      createMockPastPerformanceForAI({ tripComment: 'clear trip' }),
      createMockPastPerformanceForAI({ tripComment: 'bumped' }), // Should be ignored (4th race)
      createMockPastPerformanceForAI({ tripComment: 'steadied' }), // Should be ignored (5th race)
    ];
    expect(countTroubledRaces(pps)).toBe(2);
  });

  it('handles empty array', () => {
    expect(countTroubledRaces([])).toBe(0);
  });
});

// ============================================================================
// TESTS - analyzePositionFlow
// ============================================================================

describe('analyzePositionFlow', () => {
  it('detects LOST POSITION when finish is worse than start', () => {
    const runningLine = { start: 2, stretch: 4, finish: 5 };
    const result = analyzePositionFlow(runningLine, false);
    expect(result.lostPosition).toBe(true);
    expect(result.ralliedThroughTrouble).toBe(false);
  });

  it('does not flag LOST POSITION when position improved', () => {
    const runningLine = { start: 5, stretch: 3, finish: 2 };
    const result = analyzePositionFlow(runningLine, false);
    expect(result.lostPosition).toBe(false);
  });

  it('does not flag LOST POSITION when position stayed same', () => {
    const runningLine = { start: 3, stretch: 3, finish: 3 };
    const result = analyzePositionFlow(runningLine, false);
    expect(result.lostPosition).toBe(false);
  });

  it('detects RALLIED THROUGH TROUBLE when improved despite trouble', () => {
    const runningLine = { start: 8, stretch: 5, finish: 2 };
    const result = analyzePositionFlow(runningLine, true); // hasTrouble = true
    expect(result.ralliedThroughTrouble).toBe(true);
    expect(result.lostPosition).toBe(false);
  });

  it('does not flag RALLIED THROUGH TROUBLE without trouble', () => {
    const runningLine = { start: 8, stretch: 5, finish: 2 };
    const result = analyzePositionFlow(runningLine, false); // hasTrouble = false
    expect(result.ralliedThroughTrouble).toBe(false);
  });

  it('does not flag RALLIED THROUGH TROUBLE when position worsened', () => {
    const runningLine = { start: 2, stretch: 4, finish: 6 };
    const result = analyzePositionFlow(runningLine, true);
    expect(result.ralliedThroughTrouble).toBe(false);
    expect(result.lostPosition).toBe(true);
  });

  it('handles null values gracefully', () => {
    expect(analyzePositionFlow({ start: null, stretch: 3, finish: 2 }, false)).toEqual({
      lostPosition: false,
      ralliedThroughTrouble: false,
    });
    expect(analyzePositionFlow({ start: 3, stretch: null, finish: null }, false)).toEqual({
      lostPosition: false,
      ralliedThroughTrouble: false,
    });
    expect(analyzePositionFlow({ start: null, stretch: null, finish: null }, false)).toEqual({
      lostPosition: false,
      ralliedThroughTrouble: false,
    });
  });
});

// ============================================================================
// TESTS - analyzeBeyerTrajectory
// ============================================================================

describe('analyzeBeyerTrajectory', () => {
  it('returns trajectory string for valid Beyers', () => {
    const pps = [
      createMockPastPerformanceForAI({ beyer: 78 }),
      createMockPastPerformanceForAI({ beyer: 82 }),
      createMockPastPerformanceForAI({ beyer: 85 }),
    ];
    const result = analyzeBeyerTrajectory(pps);
    expect(result.trajectory).toBe('78 -> 82 -> 85');
  });

  it('flags FIGURE SUPPRESSED when lowest Beyer + trouble', () => {
    const pps = [
      createMockPastPerformanceForAI({ beyer: 72, tripComment: 'blocked, checked in stretch' }),
      createMockPastPerformanceForAI({ beyer: 82, tripComment: 'clear trip' }),
      createMockPastPerformanceForAI({ beyer: 85, tripComment: 'no excuses' }),
    ];
    const result = analyzeBeyerTrajectory(pps);
    expect(result.isSuppressed).toBe(true);
    expect(result.trajectory).toBe('72 -> 82 -> 85');
  });

  it('does not flag FIGURE SUPPRESSED when lowest but no trouble', () => {
    const pps = [
      createMockPastPerformanceForAI({ beyer: 72, tripComment: 'clear trip' }),
      createMockPastPerformanceForAI({ beyer: 82, tripComment: 'no excuses' }),
      createMockPastPerformanceForAI({ beyer: 85, tripComment: 'stalked pace' }),
    ];
    const result = analyzeBeyerTrajectory(pps);
    expect(result.isSuppressed).toBe(false);
  });

  it('does not flag FIGURE SUPPRESSED when most recent is not lowest', () => {
    const pps = [
      createMockPastPerformanceForAI({ beyer: 85, tripComment: 'blocked in stretch' }),
      createMockPastPerformanceForAI({ beyer: 78, tripComment: 'clear trip' }),
      createMockPastPerformanceForAI({ beyer: 82, tripComment: 'no excuses' }),
    ];
    const result = analyzeBeyerTrajectory(pps);
    expect(result.isSuppressed).toBe(false);
  });

  it('handles null Beyers in trajectory', () => {
    const pps = [
      createMockPastPerformanceForAI({ beyer: 78 }),
      createMockPastPerformanceForAI({ beyer: null }),
      createMockPastPerformanceForAI({ beyer: 85 }),
    ];
    const result = analyzeBeyerTrajectory(pps);
    expect(result.trajectory).toBe('78 -> N/A -> 85');
  });

  it('handles all null Beyers', () => {
    const pps = [
      createMockPastPerformanceForAI({ beyer: null }),
      createMockPastPerformanceForAI({ beyer: null }),
      createMockPastPerformanceForAI({ beyer: null }),
    ];
    const result = analyzeBeyerTrajectory(pps);
    expect(result.trajectory).toBe('N/A -> N/A -> N/A');
    expect(result.isSuppressed).toBe(false);
  });

  it('handles empty array', () => {
    const result = analyzeBeyerTrajectory([]);
    expect(result.trajectory).toBe('N/A');
    expect(result.isSuppressed).toBe(false);
  });

  it('handles single performance', () => {
    const pps = [createMockPastPerformanceForAI({ beyer: 85 })];
    const result = analyzeBeyerTrajectory(pps);
    expect(result.trajectory).toBe('85');
    expect(result.isSuppressed).toBe(false); // Need 2+ to compare
  });
});

// ============================================================================
// TESTS - formatHorseForTripTrouble
// ============================================================================

describe('formatHorseForTripTrouble', () => {
  it('includes header with rank and score', () => {
    const horse = createMockHorseScore({
      programNumber: 5,
      horseName: 'Trip Trouble Test',
      rank: 3,
      finalScore: 165,
      pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
    });

    const result = formatHorseForTripTrouble(horse);

    expect(result).toContain('#5 Trip Trouble Test (Rank: 3, Score: 165)');
  });

  it('includes all trip-relevant fields for each race', () => {
    const horse = createMockHorseScore({
      programNumber: 3,
      horseName: 'Detailed Horse',
      rank: 2,
      finalScore: 170,
      pastPerformances: [
        createMockPastPerformanceForAI({
          date: '2024-01-15',
          track: 'SA',
          distance: 6,
          surface: 'dirt',
          finishPosition: 3,
          fieldSize: 10,
          tripComment: 'blocked, checked in stretch',
          beyer: 78,
          earlyPace1: 92,
          latePace: 85,
          runningLine: { start: 4, stretch: 3, finish: 3 },
          lengthsBehind: 2.5,
          odds: 6.5,
          favoriteRank: 3,
        }),
      ],
    });

    const result = formatHorseForTripTrouble(horse);

    // Race details
    expect(result).toContain('Race 1: SA 6f dirt - Finish: 3/10');
    // TRIP comment (uppercase label)
    expect(result).toContain('TRIP: blocked, checked in stretch');
    // Pace figures
    expect(result).toContain('Beyer: 78 | EP1: 92 | LP: 85');
    // Position flow
    expect(result).toContain('Position Flow: Started 4 -> Stretch 3 -> Finish 3');
    // Odds info
    expect(result).toContain('Lengths Behind: 2.5L | Odds: 6.5 (Fav: 3)');
  });

  it('shows "No comment recorded" when tripComment is empty', () => {
    const horse = createMockHorseScore({
      pastPerformances: [createMockPastPerformanceForAI({ tripComment: '' })],
    });

    const result = formatHorseForTripTrouble(horse);

    expect(result).toContain('TRIP: No comment recorded');
  });

  it('shows N/A for null pace figures', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({
          beyer: null,
          earlyPace1: null,
          latePace: null,
        }),
      ],
    });

    const result = formatHorseForTripTrouble(horse);

    expect(result).toContain('Beyer: N/A | EP1: N/A | LP: N/A');
  });

  it('omits position flow line when running line positions are null', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({
          runningLine: { start: null, stretch: null, finish: null },
        }),
      ],
    });

    const result = formatHorseForTripTrouble(horse);

    expect(result).not.toContain('Position Flow:');
  });

  it('calculates and displays troubled races count correctly', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ tripComment: 'blocked in stretch' }),
        createMockPastPerformanceForAI({ tripComment: 'bumped at start' }),
        createMockPastPerformanceForAI({ tripComment: 'clear trip' }),
      ],
    });

    const result = formatHorseForTripTrouble(horse);

    expect(result).toContain('Troubled Races: 2/3');
  });

  it('displays LOST POSITION flag when appropriate', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({
          tripComment: 'clear trip',
          runningLine: { start: 2, stretch: 4, finish: 5 }, // Started 2nd, finished 5th
        }),
      ],
    });

    const result = formatHorseForTripTrouble(horse);

    expect(result).toContain('Race 1: LOST POSITION');
  });

  it('displays RALLIED THROUGH TROUBLE flag when appropriate', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({
          tripComment: 'wide trip, bumped on turn',
          runningLine: { start: 8, stretch: 5, finish: 2 }, // Started 8th, finished 2nd
        }),
      ],
    });

    const result = formatHorseForTripTrouble(horse);

    expect(result).toContain('Race 1: RALLIED THROUGH TROUBLE');
  });

  it('displays Beyer trend trajectory', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ beyer: 72 }),
        createMockPastPerformanceForAI({ beyer: 82 }),
        createMockPastPerformanceForAI({ beyer: 85 }),
      ],
    });

    const result = formatHorseForTripTrouble(horse);

    expect(result).toContain('Beyer Trend: 72 -> 82 -> 85');
  });

  it('displays FIGURE SUPPRESSED flag when lowest Beyer + trouble', () => {
    const horse = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ beyer: 72, tripComment: 'blocked, checked' }),
        createMockPastPerformanceForAI({ beyer: 82, tripComment: 'clear trip' }),
        createMockPastPerformanceForAI({ beyer: 85, tripComment: 'no excuses' }),
      ],
    });

    const result = formatHorseForTripTrouble(horse);

    expect(result).toContain('FIGURE SUPPRESSED');
  });

  it('handles horse with no past performances', () => {
    const horse = createMockHorseScore({
      pastPerformances: [],
    });

    const result = formatHorseForTripTrouble(horse);

    expect(result).toContain('No past performances available');
    expect(result).not.toContain('Race 1:');
  });
});

// ============================================================================
// TESTS - buildTripTroublePrompt
// ============================================================================

describe('buildTripTroublePrompt', () => {
  it('returns a string', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({ rank: 1, pastPerformances: [] }),
        createMockHorseScore({
          rank: 2,
          pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
        }),
      ],
    });

    const prompt = buildTripTroublePrompt(race, scoringResult);

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('skips horse ranked 1st (heavy favorite)', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          programNumber: 1,
          horseName: 'Heavy Favorite',
          rank: 1,
          pastPerformances: [
            createMockPastPerformanceForAI({ tripComment: 'blocked in stretch' }),
            createMockPastPerformanceForAI(),
          ],
        }),
        createMockHorseScore({
          programNumber: 2,
          horseName: 'Second Choice',
          rank: 2,
          pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
        }),
      ],
    });

    const prompt = buildTripTroublePrompt(race, scoringResult);

    expect(prompt).not.toContain('Heavy Favorite');
    expect(prompt).toContain('Second Choice');
  });

  it('skips horses ranked 9 and higher (longshots)', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({ rank: 1, horseName: 'Rank1', pastPerformances: [] }),
        createMockHorseScore({
          rank: 2,
          horseName: 'Rank2',
          pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
        }),
        createMockHorseScore({
          rank: 9,
          horseName: 'Rank9Longshot',
          pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
        }),
        createMockHorseScore({
          rank: 10,
          horseName: 'Rank10Longshot',
          pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
        }),
      ],
    });

    const prompt = buildTripTroublePrompt(race, scoringResult);

    expect(prompt).toContain('Rank2');
    expect(prompt).not.toContain('Rank9Longshot');
    expect(prompt).not.toContain('Rank10Longshot');
  });

  it('skips horses with fewer than 2 past performances', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          rank: 2,
          horseName: 'OnePP',
          pastPerformances: [createMockPastPerformanceForAI()], // Only 1 PP
        }),
        createMockHorseScore({
          rank: 3,
          horseName: 'ZeroPP',
          pastPerformances: [], // No PPs
        }),
        createMockHorseScore({
          rank: 4,
          horseName: 'TwoPP',
          pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
        }),
      ],
    });

    const prompt = buildTripTroublePrompt(race, scoringResult);

    expect(prompt).not.toContain('OnePP');
    expect(prompt).not.toContain('ZeroPP');
    expect(prompt).toContain('TwoPP');
  });

  it('includes trouble keyword reference in prompt', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildTripTroublePrompt(race, scoringResult);

    // Traffic keywords
    expect(prompt).toContain('"blocked"');
    expect(prompt).toContain('"boxed"');
    expect(prompt).toContain('"no room"');
    expect(prompt).toContain('"tight"');
    expect(prompt).toContain('"shuffled"');

    // Contact keywords
    expect(prompt).toContain('"bumped"');
    expect(prompt).toContain('"checked"');
    expect(prompt).toContain('"steadied"');
    expect(prompt).toContain('"impeded"');

    // Path keywords
    expect(prompt).toContain('"wide"');
    expect(prompt).toContain('"5-wide"');
    expect(prompt).toContain('"6-wide"');
    expect(prompt).toContain('"parked out"');

    // Start keywords
    expect(prompt).toContain('"broke slow"');
    expect(prompt).toContain('"broke poorly"');
    expect(prompt).toContain('"stumbled"');
    expect(prompt).toContain('"dwelt"');

    // Late keywords
    expect(prompt).toContain('"no late room"');
    expect(prompt).toContain('"blocked stretch"');
  });

  it('includes figure adjustment logic', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildTripTroublePrompt(race, scoringResult);

    expect(prompt).toContain('FIGURE ADJUSTMENT LOGIC');
    expect(prompt).toContain('+3-5 Beyer hidden');
    expect(prompt).toContain('+5-8 Beyer hidden');
    expect(prompt).toContain('+2-3 Beyer hidden');
  });

  it('includes race context', () => {
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
          speedDuelProbability: 0.7,
          earlySpeedCount: 3,
        },
      }),
    });

    const prompt = buildTripTroublePrompt(race, scoringResult);

    expect(prompt).toContain('Track: Churchill Downs (CD)');
    expect(prompt).toContain('Distance: 8f dirt');
    expect(prompt).toContain('Expected Pace: hot');
  });

  it('includes confidence level definitions', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildTripTroublePrompt(race, scoringResult);

    expect(prompt).toContain('CONFIDENCE LEVELS');
    expect(prompt).toContain('HIGH: 2+ races with clear traffic trouble');
    expect(prompt).toContain('MEDIUM: 1 race with definite trouble');
    expect(prompt).toContain('LOW: Possible trouble but comments ambiguous');
  });

  it('includes expected output structure', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildTripTroublePrompt(race, scoringResult);

    expect(prompt).toContain('"troubledHorses"');
    expect(prompt).toContain('"programNumber"');
    expect(prompt).toContain('"horseName"');
    expect(prompt).toContain('"troubledRaceCount"');
    expect(prompt).toContain('"hiddenAbilityEstimate"');
    expect(prompt).toContain('"keyTroubleRace"');
    expect(prompt).toContain('"confidence"');
    expect(prompt).toContain('"reasoning"');
  });

  it('includes system prompt with JSON only instruction', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildTripTroublePrompt(race, scoringResult);

    expect(prompt).toContain('trip analysis specialist');
    expect(prompt).toContain('Return JSON only');
  });

  it('handles no eligible horses gracefully', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({ rank: 1, pastPerformances: [] }), // Rank 1 - skipped
        createMockHorseScore({ rank: 2, pastPerformances: [] }), // No PPs - skipped
        createMockHorseScore({
          rank: 3,
          pastPerformances: [createMockPastPerformanceForAI()],
        }), // Only 1 PP - skipped
      ],
    });

    const prompt = buildTripTroublePrompt(race, scoringResult);

    expect(prompt).toContain('No eligible horses for trip trouble analysis');
  });
});

// ============================================================================
// SCENARIO TESTS - Integration-style tests
// ============================================================================

describe('Trip Trouble Prompt - Scenario Tests', () => {
  it('Scenario A - Clear Trip Trouble: formats correctly with trouble indicators', () => {
    const horse = createMockHorseScore({
      programNumber: 5,
      horseName: 'Trip Troubled',
      rank: 3,
      finalScore: 160,
      pastPerformances: [
        createMockPastPerformanceForAI({
          beyer: 72,
          tripComment: 'blocked, checked in stretch',
          runningLine: { start: 3, stretch: 4, finish: 5 },
        }),
        createMockPastPerformanceForAI({
          beyer: 82,
          tripComment: 'clear trip',
          runningLine: { start: 2, stretch: 2, finish: 2 },
        }),
        createMockPastPerformanceForAI({
          beyer: 85,
          tripComment: 'no excuses',
          runningLine: { start: 1, stretch: 1, finish: 1 },
        }),
      ],
    });

    const result = formatHorseForTripTrouble(horse);

    // TRIP label prominent
    expect(result).toContain('TRIP: blocked, checked in stretch');
    // Trouble count = 1
    expect(result).toContain('Troubled Races: 1/3');
    // FIGURE SUPPRESSED should be flagged (lowest Beyer + trouble)
    expect(result).toContain('FIGURE SUPPRESSED');
  });

  it('Scenario B - Position Flow Analysis: LOST POSITION flag appears', () => {
    const horse = createMockHorseScore({
      programNumber: 3,
      horseName: 'Position Loser',
      rank: 4,
      finalScore: 155,
      pastPerformances: [
        createMockPastPerformanceForAI({
          tripComment: 'clear trip',
          runningLine: { start: 2, stretch: 2, finish: 5 }, // Started 2nd, finished 5th
        }),
      ],
    });

    const result = formatHorseForTripTrouble(horse);

    expect(result).toContain('Race 1: LOST POSITION');
  });

  it('Scenario C - Rally Through Trouble: flag appears correctly', () => {
    const horse = createMockHorseScore({
      programNumber: 7,
      horseName: 'Rallier',
      rank: 5,
      finalScore: 150,
      pastPerformances: [
        createMockPastPerformanceForAI({
          tripComment: 'wide trip, 5-wide on turn',
          runningLine: { start: 8, stretch: 5, finish: 2 }, // Started 8th, finished 2nd
        }),
      ],
    });

    const result = formatHorseForTripTrouble(horse);

    expect(result).toContain('Race 1: RALLIED THROUGH TROUBLE');
  });
});
