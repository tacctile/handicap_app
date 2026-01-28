/**
 * Tests for Vulnerable Favorite Prompt Builder
 *
 * Tests for formatFavoriteForAnalysis, formatChallengers helpers,
 * vulnerability flag detection, and buildVulnerableFavoritePrompt
 */

import { describe, it, expect } from 'vitest';
import {
  formatFavoriteForAnalysis,
  formatChallengers,
  buildVulnerableFavoritePrompt,
  hasFlatteningTripKeyword,
  isDecliningBeyers,
  hasStyleMismatch,
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
      distanceStarts: 5,
      distanceWins: 2,
      distanceWinRate: 0.4,
      surfaceStarts: 8,
      surfaceWins: 3,
      surfaceWinRate: 0.375,
      turfStarts: 0,
      turfWins: 0,
      turfWinRate: 0,
      wetStarts: 0,
      wetWins: 0,
      wetWinRate: 0,
    },
    formIndicators: {
      daysSinceLastRace: 21,
      averageBeyer: 82,
      bestBeyer: 88,
      lastBeyer: 85,
      earlySpeedRating: 95,
      lifetimeStarts: 10,
      lifetimeWins: 3,
      lifetimeWinRate: 0.3,
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
// TESTS - hasFlatteningTripKeyword
// ============================================================================

describe('hasFlatteningTripKeyword', () => {
  it('detects perfect trip keywords', () => {
    expect(hasFlatteningTripKeyword('perfect trip throughout')).toBe(true);
    expect(hasFlatteningTripKeyword('got the ideal trip')).toBe(true);
    expect(hasFlatteningTripKeyword('dream trip, no traffic')).toBe(true);
    expect(hasFlatteningTripKeyword('textbook trip from rail')).toBe(true);
  });

  it('detects rail/ground saving keywords', () => {
    expect(hasFlatteningTripKeyword('rail trip all the way')).toBe(true);
    expect(hasFlatteningTripKeyword('saved ground on turns')).toBe(true);
    expect(hasFlatteningTripKeyword('golden trip inside')).toBe(true);
  });

  it('detects easy lead keywords', () => {
    expect(hasFlatteningTripKeyword('easy lead, never challenged')).toBe(true);
    expect(hasFlatteningTripKeyword('uncontested lead throughout')).toBe(true);
    expect(hasFlatteningTripKeyword('all alone on front end')).toBe(true);
    expect(hasFlatteningTripKeyword('wire to wire victory')).toBe(true);
  });

  it('detects no traffic keywords', () => {
    expect(hasFlatteningTripKeyword('no traffic, clear path')).toBe(true);
    expect(hasFlatteningTripKeyword('clear sailing down lane')).toBe(true);
  });

  it('returns false for troubled trips', () => {
    expect(hasFlatteningTripKeyword('blocked in stretch')).toBe(false);
    expect(hasFlatteningTripKeyword('bumped at start')).toBe(false);
    expect(hasFlatteningTripKeyword('wide throughout')).toBe(false);
    expect(hasFlatteningTripKeyword('checked sharply')).toBe(false);
  });

  it('returns false for neutral trips', () => {
    expect(hasFlatteningTripKeyword('stalked pace')).toBe(false);
    expect(hasFlatteningTripKeyword('rallied well')).toBe(false);
    expect(hasFlatteningTripKeyword('drew clear')).toBe(false);
    expect(hasFlatteningTripKeyword('no excuses')).toBe(false);
  });

  it('handles empty and null comments', () => {
    expect(hasFlatteningTripKeyword('')).toBe(false);
    expect(hasFlatteningTripKeyword(null as unknown as string)).toBe(false);
    expect(hasFlatteningTripKeyword(undefined as unknown as string)).toBe(false);
  });

  it('is case insensitive', () => {
    expect(hasFlatteningTripKeyword('PERFECT TRIP')).toBe(true);
    expect(hasFlatteningTripKeyword('Rail Trip')).toBe(true);
    expect(hasFlatteningTripKeyword('WIRE TO WIRE')).toBe(true);
  });
});

// ============================================================================
// TESTS - isDecliningBeyers
// ============================================================================

describe('isDecliningBeyers', () => {
  it('returns true when Beyers are strictly declining', () => {
    // Most recent first: 78 -> 82 -> 85 (each older is higher)
    expect(isDecliningBeyers([78, 82, 85])).toBe(true);
    expect(isDecliningBeyers([70, 80])).toBe(true);
    expect(isDecliningBeyers([60, 70, 80, 90])).toBe(true);
  });

  it('returns false when Beyers are improving', () => {
    // Most recent first: 85 -> 82 -> 78 (improving trend)
    expect(isDecliningBeyers([85, 82, 78])).toBe(false);
    expect(isDecliningBeyers([90, 80])).toBe(false);
  });

  it('returns false when Beyers are flat', () => {
    expect(isDecliningBeyers([82, 82, 82])).toBe(false);
    expect(isDecliningBeyers([80, 80])).toBe(false);
  });

  it('returns false when Beyers have mixed pattern', () => {
    expect(isDecliningBeyers([78, 85, 80])).toBe(false);
    expect(isDecliningBeyers([82, 80, 85])).toBe(false);
  });

  it('returns false with less than 2 valid Beyers', () => {
    expect(isDecliningBeyers([82])).toBe(false);
    expect(isDecliningBeyers([])).toBe(false);
    expect(isDecliningBeyers([null, null])).toBe(false);
    expect(isDecliningBeyers([82, null, null])).toBe(false);
  });

  it('handles null values correctly', () => {
    // With nulls, only compare valid values
    expect(isDecliningBeyers([78, null, 85])).toBe(true); // 78 < 85
    expect(isDecliningBeyers([null, 78, 85])).toBe(true); // 78 < 85
  });
});

// ============================================================================
// TESTS - hasStyleMismatch
// ============================================================================

describe('hasStyleMismatch', () => {
  it('detects closer on speed-favoring track', () => {
    expect(hasStyleMismatch('S', 'E')).toBe(true);
    expect(hasStyleMismatch('S', 'E/P')).toBe(true);
    expect(hasStyleMismatch('PS', 'E')).toBe(true);
  });

  it('detects speed horse on closer-favoring track', () => {
    expect(hasStyleMismatch('E', 'S')).toBe(true);
    expect(hasStyleMismatch('E', 'P')).toBe(true);
    expect(hasStyleMismatch('E/P', 'S')).toBe(true);
  });

  it('returns false when style matches track', () => {
    expect(hasStyleMismatch('E', 'E')).toBe(false);
    expect(hasStyleMismatch('E/P', 'E/P')).toBe(false);
    expect(hasStyleMismatch('S', 'S')).toBe(false);
    expect(hasStyleMismatch('P', 'P')).toBe(false);
  });

  it('returns false for neutral track bias', () => {
    expect(hasStyleMismatch('E', 'neutral')).toBe(false);
    expect(hasStyleMismatch('S', 'neutral')).toBe(false);
  });

  it('returns false when running style is null', () => {
    expect(hasStyleMismatch(null, 'E')).toBe(false);
    expect(hasStyleMismatch(null, 'S')).toBe(false);
  });

  it('returns false when track favored style is null', () => {
    expect(hasStyleMismatch('E', null)).toBe(false);
    expect(hasStyleMismatch('S', null)).toBe(false);
  });
});

// ============================================================================
// TESTS - formatFavoriteForAnalysis
// ============================================================================

describe('formatFavoriteForAnalysis', () => {
  it('includes header with program number, name, rank, score, tier, and ML', () => {
    const favorite = createMockHorseScore({
      programNumber: 5,
      horseName: 'Vulnerable Chalk',
      rank: 1,
      finalScore: 195,
      confidenceTier: 'high',
      morningLineOdds: '3-2',
      pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
    });
    const horseData = { postPosition: 3, runningStyle: 'E/P' as const };

    const result = formatFavoriteForAnalysis(favorite, horseData, null, 'claiming');

    expect(result).toContain('FAVORITE ANALYSIS: #5 Vulnerable Chalk');
    expect(result).toContain('Algorithm Rank: 1 | Score: 195/371 | Tier: high');
    expect(result).toContain('Morning Line: 3-2');
  });

  it('shows LIMITED FORM DATA when fewer than 2 PPs', () => {
    const favorite = createMockHorseScore({
      pastPerformances: [createMockPastPerformanceForAI()], // Only 1 PP
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).toContain('LIMITED FORM DATA - cannot fully assess');
    expect(result).not.toContain('--- RECENT FORM ---');
  });

  it('includes recent form section with last 3 results', () => {
    const favorite = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ finishPosition: 1, fieldSize: 8 }),
        createMockPastPerformanceForAI({ finishPosition: 2, fieldSize: 10 }),
        createMockPastPerformanceForAI({ finishPosition: 3, fieldSize: 6 }),
      ],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).toContain('--- RECENT FORM ---');
    expect(result).toContain('Last 3 Results: 1/8, 2/10, 3/6');
  });

  it('includes Beyer trend', () => {
    const favorite = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ beyer: 85 }),
        createMockPastPerformanceForAI({ beyer: 82 }),
        createMockPastPerformanceForAI({ beyer: 78 }),
      ],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).toContain('Beyer Trend: 85 -> 82 -> 78');
  });

  it('flags DECLINING FIGURES when Beyers are declining', () => {
    const favorite = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ beyer: 78 }), // Most recent - lowest
        createMockPastPerformanceForAI({ beyer: 82 }),
        createMockPastPerformanceForAI({ beyer: 85 }), // Oldest - highest
      ],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).toContain('DECLINING FIGURES');
    expect(result).toContain('VULNERABILITY FLAGS:');
    expect(result).toContain('DECLINING FIGURES');
  });

  it('flags LAYOFF RISK when >60 days since last race', () => {
    const favorite = createMockHorseScore({
      formIndicators: {
        daysSinceLastRace: 75,
        averageBeyer: 82,
        bestBeyer: 88,
        lastBeyer: 85,
        earlySpeedRating: 95,
        lifetimeStarts: 10,
        lifetimeWins: 3,
        lifetimeWinRate: 0.3,
      },
      pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).toContain('Days Since Last Race: 75');
    expect(result).toContain('LAYOFF RISK');
  });

  it('does not flag LAYOFF RISK when <=60 days', () => {
    const favorite = createMockHorseScore({
      formIndicators: {
        daysSinceLastRace: 45,
        averageBeyer: 82,
        bestBeyer: 88,
        lastBeyer: 85,
        earlySpeedRating: 95,
        lifetimeStarts: 10,
        lifetimeWins: 3,
        lifetimeWinRate: 0.3,
      },
      pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).not.toContain('LAYOFF RISK');
  });

  it('includes trip quality section with all 3 trip comments', () => {
    const favorite = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({ tripComment: 'perfect trip, saved ground' }),
        createMockPastPerformanceForAI({ tripComment: 'stalked pace' }),
        createMockPastPerformanceForAI({ tripComment: 'clear sailing' }),
      ],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).toContain('--- TRIP QUALITY ---');
    expect(result).toContain('Race 1: "perfect trip, saved ground"');
    expect(result).toContain('Race 2: "stalked pace"');
    expect(result).toContain('Race 3: "clear sailing"');
  });

  it('flags FLATTERED BY TRIP when won with flattering trip', () => {
    const favorite = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({
          finishPosition: 1,
          tripComment: 'perfect trip, rail all the way',
        }),
        createMockPastPerformanceForAI({ finishPosition: 2, tripComment: 'no excuses' }),
      ],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).toContain('FLATTERED BY TRIP');
  });

  it('does not flag FLATTERED BY TRIP when flattering trip was not a win', () => {
    const favorite = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({
          finishPosition: 3, // Not a win
          tripComment: 'perfect trip, rail all the way',
        }),
        createMockPastPerformanceForAI({ finishPosition: 2, tripComment: 'no excuses' }),
      ],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).not.toContain('FLATTERED BY TRIP');
  });

  it('includes distance/surface stats', () => {
    const favorite = createMockHorseScore({
      distanceSurfaceStats: {
        distanceStarts: 5,
        distanceWins: 2,
        distanceWinRate: 0.4,
        surfaceStarts: 8,
        surfaceWins: 3,
        surfaceWinRate: 0.375,
        turfStarts: 0,
        turfWins: 0,
        turfWinRate: 0,
        wetStarts: 0,
        wetWins: 0,
        wetWinRate: 0,
      },
      pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).toContain('Distance Record: 2/5 (40%)');
    expect(result).toContain('Surface Record: 3/8 (38%)');
  });

  it('flags UNPROVEN AT DISTANCE when <2 distance starts', () => {
    const favorite = createMockHorseScore({
      distanceSurfaceStats: {
        distanceStarts: 1, // Less than 2
        distanceWins: 0,
        distanceWinRate: 0,
        surfaceStarts: 5,
        surfaceWins: 2,
        surfaceWinRate: 0.4,
        turfStarts: 0,
        turfWins: 0,
        turfWinRate: 0,
        wetStarts: 0,
        wetWins: 0,
        wetWinRate: 0,
      },
      pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).toContain('UNPROVEN AT DISTANCE');
  });

  it('flags POOR SURFACE RECORD when <15% win rate with 3+ starts', () => {
    const favorite = createMockHorseScore({
      distanceSurfaceStats: {
        distanceStarts: 5,
        distanceWins: 2,
        distanceWinRate: 0.4,
        surfaceStarts: 10, // 3+ starts
        surfaceWins: 1, // 10% win rate < 15%
        surfaceWinRate: 0.1,
        turfStarts: 0,
        turfWins: 0,
        turfWinRate: 0,
        wetStarts: 0,
        wetWins: 0,
        wetWinRate: 0,
      },
      pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).toContain('POOR SURFACE RECORD');
  });

  it('flags STYLE MISMATCH when running style vs track bias conflict', () => {
    const favorite = createMockHorseScore({
      pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
    });
    const horseData = { postPosition: 5, runningStyle: 'S' as const }; // Closer
    const trackIntel = createMockTrackIntelligence({
      speedBias: {
        earlySpeedWinRate: 58,
        paceAdvantageRating: 7,
        favoredStyle: 'E', // Speed-favoring track
        biasDescription: 'Speed holds',
      },
    });

    const result = formatFavoriteForAnalysis(favorite, horseData, trackIntel, 'claiming');

    expect(result).toContain('--- PACE FIT VS TRACK ---');
    expect(result).toContain('Running Style: S');
    expect(result).toContain('Track Favors: E');
    expect(result).toContain('STYLE MISMATCH');
  });

  it('does not flag STYLE MISMATCH when style matches track', () => {
    const favorite = createMockHorseScore({
      pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
    });
    const horseData = { postPosition: 1, runningStyle: 'E' as const }; // Speed horse
    const trackIntel = createMockTrackIntelligence({
      speedBias: {
        earlySpeedWinRate: 58,
        paceAdvantageRating: 7,
        favoredStyle: 'E', // Speed-favoring track
        biasDescription: 'Speed holds',
      },
    });

    const result = formatFavoriteForAnalysis(favorite, horseData, trackIntel, 'claiming');

    expect(result).not.toContain('STYLE MISMATCH');
  });

  it('flags CLASS RISE for stakes race when recent was not stakes', () => {
    const favorite = createMockHorseScore({
      pastPerformances: [
        createMockPastPerformanceForAI({
          finishPosition: 1,
          trackCondition: 'fast', // Not stakes
        }),
        createMockPastPerformanceForAI({
          finishPosition: 2,
          trackCondition: 'fast',
        }),
      ],
    });

    const result = formatFavoriteForAnalysis(
      favorite,
      undefined,
      null,
      'Stakes - Grade 2' // Today is stakes
    );

    expect(result).toContain('CLASS RISE');
  });

  it('omits pace fit section when track intelligence is null', () => {
    const favorite = createMockHorseScore({
      pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).not.toContain('--- PACE FIT VS TRACK ---');
  });

  it('includes vulnerability flags summary', () => {
    const favorite = createMockHorseScore({
      formIndicators: {
        daysSinceLastRace: 75, // Will trigger LAYOFF RISK
        averageBeyer: 82,
        bestBeyer: 88,
        lastBeyer: 85,
        earlySpeedRating: 95,
        lifetimeStarts: 10,
        lifetimeWins: 3,
        lifetimeWinRate: 0.3,
      },
      pastPerformances: [
        createMockPastPerformanceForAI({ beyer: 78 }), // Declining
        createMockPastPerformanceForAI({ beyer: 82 }),
        createMockPastPerformanceForAI({ beyer: 85 }),
      ],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).toContain('VULNERABILITY FLAGS: DECLINING FIGURES, LAYOFF RISK');
  });

  it('shows no flags when favorite is solid', () => {
    const favorite = createMockHorseScore({
      formIndicators: {
        daysSinceLastRace: 21,
        averageBeyer: 85,
        bestBeyer: 88,
        lastBeyer: 88, // Improving
        earlySpeedRating: 95,
        lifetimeStarts: 10,
        lifetimeWins: 3,
        lifetimeWinRate: 0.3,
      },
      distanceSurfaceStats: {
        distanceStarts: 5,
        distanceWins: 2,
        distanceWinRate: 0.4,
        surfaceStarts: 8,
        surfaceWins: 3,
        surfaceWinRate: 0.375,
        turfStarts: 0,
        turfWins: 0,
        turfWinRate: 0,
        wetStarts: 0,
        wetWins: 0,
        wetWinRate: 0,
      },
      pastPerformances: [
        createMockPastPerformanceForAI({
          beyer: 88,
          finishPosition: 1,
          tripComment: 'drew clear, no excuses',
        }),
        createMockPastPerformanceForAI({
          beyer: 85,
          finishPosition: 2,
          tripComment: 'stalked pace',
        }),
      ],
    });

    const result = formatFavoriteForAnalysis(favorite, undefined, null, 'claiming');

    expect(result).toContain('VULNERABILITY FLAGS: None');
  });
});

// ============================================================================
// TESTS - formatChallengers
// ============================================================================

describe('formatChallengers', () => {
  it('shows ranks 2-4 only (max 3 challengers)', () => {
    const favorite = createMockHorseScore({ rank: 1, finalScore: 190 });
    const challengers = [
      createMockHorseScore({ programNumber: 2, horseName: 'Rank 2', rank: 2, finalScore: 175 }),
      createMockHorseScore({ programNumber: 3, horseName: 'Rank 3', rank: 3, finalScore: 165 }),
      createMockHorseScore({ programNumber: 4, horseName: 'Rank 4', rank: 4, finalScore: 155 }),
      createMockHorseScore({ programNumber: 5, horseName: 'Rank 5', rank: 5, finalScore: 145 }), // Should be excluded
    ];

    const result = formatChallengers(challengers, favorite);

    expect(result).toContain('CHALLENGERS (Ranks 2-4):');
    expect(result).toContain('#2 Rank 2 (Rank 2, Score 175)');
    expect(result).toContain('#3 Rank 3 (Rank 3, Score 165)');
    expect(result).toContain('#4 Rank 4 (Rank 4, Score 155)');
    expect(result).not.toContain('#5 Rank 5');
  });

  it('includes key strength for each challenger', () => {
    const favorite = createMockHorseScore({ rank: 1, finalScore: 190 });
    const challengers = [
      createMockHorseScore({
        programNumber: 2,
        horseName: 'Challenger',
        rank: 2,
        finalScore: 175,
        positiveFactors: ['Strong late pace figure'],
      }),
    ];

    const result = formatChallengers(challengers, favorite);

    expect(result).toContain('Key Strength: Strong late pace figure');
  });

  it('includes key angle for each challenger', () => {
    const favorite = createMockHorseScore({ rank: 1, finalScore: 190 });
    const challengers = [
      createMockHorseScore({
        programNumber: 2,
        horseName: 'Challenger',
        rank: 2,
        finalScore: 175,
      }),
    ];

    const result = formatChallengers(challengers, favorite);

    expect(result).toContain('Key Angle:');
  });

  it('returns message when no challengers available', () => {
    const favorite = createMockHorseScore({ rank: 1 });
    const result = formatChallengers([], favorite);

    expect(result).toBe('CHALLENGERS: None available');
  });

  it('shows inferred strength when no positive factors', () => {
    const favorite = createMockHorseScore({ rank: 1, finalScore: 190 });
    const challengers = [
      createMockHorseScore({
        programNumber: 2,
        horseName: 'Close Challenger',
        rank: 2,
        finalScore: 188, // Close to favorite
        positiveFactors: [],
      }),
    ];

    const result = formatChallengers(challengers, favorite);

    expect(result).toContain('Key Strength: Close to favorite in algorithm score');
  });
});

// ============================================================================
// TESTS - buildVulnerableFavoritePrompt
// ============================================================================

describe('buildVulnerableFavoritePrompt', () => {
  it('returns a string', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('includes system prompt with JSON instruction', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(prompt).toContain('You are a horse racing contrarian analyst');
    expect(prompt).toContain('Identify vulnerable favorites');
    expect(prompt).toContain('Return JSON only');
  });

  it('includes vulnerability categories', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(prompt).toContain('VULNERABILITY FLAGS - Check all that apply:');
    expect(prompt).toContain('CATEGORY A - FORM CONCERNS');
    expect(prompt).toContain('CATEGORY B - CLASS/CONDITIONS MISMATCH');
    expect(prompt).toContain('CATEGORY C - PACE/TRIP VULNERABILITY');
    expect(prompt).toContain('CATEGORY D - FALSE FORM');
    expect(prompt).toContain('Beyers declining');
    expect(prompt).toContain('Stepping up in class');
    expect(prompt).toContain('Speed horse facing');
  });

  it('includes what makes a favorite solid', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(prompt).toContain('FAVORITE IS SOLID (NOT vulnerable) when:');
    expect(prompt).toContain('Beyers steady or improving over last 3 races');
    expect(prompt).toContain('Has won at this class level before');
    expect(prompt).toContain('Running style fits track bias');
  });

  it('includes confidence levels guidance', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(prompt).toContain('CONFIDENCE LEVELS:');
    expect(prompt).toContain('HIGH: 2+ vulnerability flags from ANY source');
    expect(prompt).toContain('MEDIUM: 1 flag with supporting context');
    expect(prompt).toContain('LOW: Single minor concern with no supporting factors');
  });

  it('includes beneficiaries guidance', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(prompt).toContain('IF VULNERABLE - WHO BENEFITS?');
    expect(prompt).toContain('Identify which challengers gain most');
  });

  it('includes track intelligence section', () => {
    const trackIntel = createMockTrackIntelligence();
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      raceAnalysis: createMockRaceAnalysis({
        trackIntelligence: trackIntel,
      }),
    });

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(prompt).toContain('TRACK: Santa Anita (SA)');
    expect(prompt).toContain('SPEED BIAS:');
  });

  it('includes track intelligence unavailable message when null', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      raceAnalysis: createMockRaceAnalysis({
        trackIntelligence: null,
      }),
    });

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(prompt).toContain('TRACK INTELLIGENCE: NOT AVAILABLE');
  });

  it('includes favorite analysis section', () => {
    const race = createMockParsedRace({
      horses: [
        createMockHorseEntry({
          programNumber: 1,
          horseName: 'Top Pick',
          runningStyle: 'E/P',
        }),
      ],
    });
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          programNumber: 1,
          horseName: 'Top Pick',
          rank: 1,
          finalScore: 195,
          pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
        }),
      ],
    });

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(prompt).toContain('FAVORITE ANALYSIS: #1 Top Pick');
    expect(prompt).toContain('Algorithm Rank: 1');
  });

  it('includes challengers section', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({ programNumber: 1, horseName: 'Favorite', rank: 1, finalScore: 195 }),
        createMockHorseScore({
          programNumber: 2,
          horseName: 'Challenger 1',
          rank: 2,
          finalScore: 180,
        }),
        createMockHorseScore({
          programNumber: 3,
          horseName: 'Challenger 2',
          rank: 3,
          finalScore: 170,
        }),
      ],
    });

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(prompt).toContain('CHALLENGERS (Ranks 2-4):');
    expect(prompt).toContain('Challenger 1');
    expect(prompt).toContain('Challenger 2');
  });

  it('includes expected output structure with new format', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(prompt).toContain('"favoriteAnalysis"');
    expect(prompt).toContain('"programNumber"');
    expect(prompt).toContain('"horseName"');
    expect(prompt).toContain('"isVulnerable"');
    expect(prompt).toContain('"vulnerabilityFlags"');
    expect(prompt).toContain('"solidFoundation"');
    expect(prompt).toContain('"overallAssessment"');
    expect(prompt).toContain('"confidence"');
    expect(prompt).toContain('"recommendedAction"');
    expect(prompt).toContain('"beneficiaries"');
    expect(prompt).toContain('"reasoning"');
  });

  it('handles empty scores array gracefully', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      scores: [],
    });

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(prompt).toContain('No horses available for analysis');
    expect(prompt).toContain('"isVulnerable": false');
  });

  it('excludes scratched horses', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          programNumber: 1,
          horseName: 'Scratched Favorite',
          rank: 1,
          isScratched: true,
        }),
        createMockHorseScore({
          programNumber: 2,
          horseName: 'New Favorite',
          rank: 2,
          finalScore: 180,
          isScratched: false,
          pastPerformances: [createMockPastPerformanceForAI(), createMockPastPerformanceForAI()],
        }),
      ],
    });

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    expect(prompt).not.toContain('Scratched Favorite');
    expect(prompt).toContain('New Favorite');
  });
});

// ============================================================================
// SCENARIO TESTS - Integration-style tests
// ============================================================================

describe('Vulnerable Favorite Prompt - Scenario Tests', () => {
  it('Scenario A - Clear Vulnerable Favorite: declining Beyers, perfect trip, class rise', () => {
    const favorite = createMockHorseScore({
      programNumber: 1,
      horseName: 'Vulnerable Star',
      rank: 1,
      finalScore: 195,
      pastPerformances: [
        createMockPastPerformanceForAI({
          beyer: 78, // Declining
          finishPosition: 1,
          tripComment: 'perfect trip, rail all the way',
          trackCondition: 'fast',
        }),
        createMockPastPerformanceForAI({
          beyer: 82,
          finishPosition: 2,
          tripComment: 'stalked pace',
          trackCondition: 'fast',
        }),
        createMockPastPerformanceForAI({
          beyer: 85,
          finishPosition: 1,
          tripComment: 'no excuses',
          trackCondition: 'fast',
        }),
      ],
    });

    const result = formatFavoriteForAnalysis(
      favorite,
      undefined,
      null,
      'Stakes - Grade 2' // Class rise
    );

    // All 3 flags should appear
    expect(result).toContain('DECLINING FIGURES');
    expect(result).toContain('FLATTERED BY TRIP');
    expect(result).toContain('CLASS RISE');
  });

  it('Scenario B - Solid Favorite: improving Beyers, traffic trouble, class drop', () => {
    const favorite = createMockHorseScore({
      programNumber: 1,
      horseName: 'Solid Chalk',
      rank: 1,
      finalScore: 195,
      formIndicators: {
        daysSinceLastRace: 21,
        averageBeyer: 85,
        bestBeyer: 88,
        lastBeyer: 88,
        earlySpeedRating: 95,
        lifetimeStarts: 10,
        lifetimeWins: 3,
        lifetimeWinRate: 0.3,
      },
      distanceSurfaceStats: {
        distanceStarts: 5,
        distanceWins: 2,
        distanceWinRate: 0.4,
        surfaceStarts: 8,
        surfaceWins: 3,
        surfaceWinRate: 0.375,
        turfStarts: 0,
        turfWins: 0,
        turfWinRate: 0,
        wetStarts: 0,
        wetWins: 0,
        wetWinRate: 0,
      },
      pastPerformances: [
        createMockPastPerformanceForAI({
          beyer: 88, // Improving
          finishPosition: 2,
          tripComment: 'blocked, checked in stretch', // Had trouble
          trackCondition: 'fast',
        }),
        createMockPastPerformanceForAI({
          beyer: 85,
          finishPosition: 1,
          tripComment: 'drew clear',
          trackCondition: 'fast',
        }),
      ],
    });

    const result = formatFavoriteForAnalysis(
      favorite,
      undefined,
      null,
      'claiming' // Class drop from allowance
    );

    // No vulnerability flags should appear
    expect(result).toContain('VULNERABILITY FLAGS: None');
    expect(result).not.toContain('DECLINING FIGURES');
    expect(result).not.toContain('FLATTERED BY TRIP');
    expect(result).not.toContain('LAYOFF RISK');
  });

  it('Scenario C - Style Mismatch: closer on speed-favoring track (58% early speed win rate)', () => {
    const favorite = createMockHorseScore({
      programNumber: 1,
      horseName: 'Deep Closer',
      rank: 1,
      finalScore: 190,
      pastPerformances: [
        createMockPastPerformanceForAI({ beyer: 85 }),
        createMockPastPerformanceForAI({ beyer: 85 }),
      ],
    });
    const horseData = { postPosition: 8, runningStyle: 'S' as const }; // Closer
    const trackIntel = createMockTrackIntelligence({
      speedBias: {
        earlySpeedWinRate: 58, // Speed-favoring
        paceAdvantageRating: 7,
        favoredStyle: 'E',
        biasDescription: 'Speed holds well',
      },
    });

    const result = formatFavoriteForAnalysis(favorite, horseData, trackIntel, 'claiming');

    expect(result).toContain('Running Style: S');
    expect(result).toContain('Track Favors: E');
    expect(result).toContain('STYLE MISMATCH');
  });

  it('Full prompt includes all vulnerability flags for vulnerable favorite', () => {
    const race = createMockParsedRace({
      header: createMockRaceHeader({
        classification: 'stakes-graded-2',
      }),
      horses: [
        createMockHorseEntry({
          programNumber: 1,
          horseName: 'Vulnerable Star',
          runningStyle: 'S', // Closer
        }),
      ],
    });

    const trackIntel = createMockTrackIntelligence({
      speedBias: {
        earlySpeedWinRate: 58,
        paceAdvantageRating: 7,
        favoredStyle: 'E', // Speed-favoring
        biasDescription: 'Speed holds',
      },
    });

    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          programNumber: 1,
          horseName: 'Vulnerable Star',
          rank: 1,
          finalScore: 195,
          formIndicators: {
            daysSinceLastRace: 75, // Layoff
            averageBeyer: 82,
            bestBeyer: 88,
            lastBeyer: 78,
            earlySpeedRating: 50,
            lifetimeStarts: 10,
            lifetimeWins: 3,
            lifetimeWinRate: 0.3,
          },
          pastPerformances: [
            createMockPastPerformanceForAI({
              beyer: 78, // Declining
              finishPosition: 1,
              tripComment: 'perfect trip, saved ground',
              trackCondition: 'fast',
            }),
            createMockPastPerformanceForAI({
              beyer: 82,
              finishPosition: 2,
              trackCondition: 'fast',
            }),
            createMockPastPerformanceForAI({
              beyer: 85,
              finishPosition: 1,
              trackCondition: 'fast',
            }),
          ],
        }),
        createMockHorseScore({
          programNumber: 2,
          horseName: 'Challenger',
          rank: 2,
          finalScore: 180,
        }),
      ],
      raceAnalysis: createMockRaceAnalysis({
        trackIntelligence: trackIntel,
      }),
    });

    const prompt = buildVulnerableFavoritePrompt(race, scoringResult);

    // Should include multiple vulnerability flags in the favorite analysis section
    expect(prompt).toContain('DECLINING FIGURES');
    expect(prompt).toContain('LAYOFF RISK');
    expect(prompt).toContain('FLATTERED BY TRIP');
    expect(prompt).toContain('STYLE MISMATCH');
    expect(prompt).toContain('CLASS RISE');
  });
});
