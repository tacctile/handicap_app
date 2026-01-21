/**
 * Tests for Field Spread Prompt Builder
 *
 * Tests for calculateFieldSeparation helper, formatHorseForFieldSpread helper,
 * value indicator logic, and buildFieldSpreadPrompt
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFieldSeparation,
  parseMorningLineOdds,
  calculateImpliedProbability,
  formatHorseForFieldSpread,
  formatHorseForFieldSpreadAbbreviated,
  buildFieldSpreadPrompt,
} from '../prompt';
import type { ParsedRace, RaceHeader, HorseEntry, PastPerformance } from '../../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../../types/drf';
import type {
  RaceScoringResult,
  HorseScoreForAI,
  RaceAnalysis,
  TrainerPatternsForAI,
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
// TESTS - calculateFieldSeparation
// ============================================================================

describe('calculateFieldSeparation', () => {
  it('correctly identifies DOMINANT field with 30+ point gap', () => {
    const scores = [
      createMockHorseScore({ rank: 1, finalScore: 220, confidenceTier: 'high' }),
      createMockHorseScore({ rank: 2, finalScore: 180, confidenceTier: 'high' }), // 40 point gap
      createMockHorseScore({ rank: 3, finalScore: 165, confidenceTier: 'medium' }),
      createMockHorseScore({ rank: 4, finalScore: 155, confidenceTier: 'medium' }),
      createMockHorseScore({ rank: 5, finalScore: 140, confidenceTier: 'low' }),
    ];

    const result = calculateFieldSeparation(scores);

    expect(result.fieldType).toBe('DOMINANT');
    expect(result.scoreGaps[0]).toBe(40); // 220 - 180 = 40
    expect(result.topTierCount).toBe(2); // 2 horses with 'high' confidence
    expect(result.contenderCount).toBe(5); // All 5 horses have score >= 140
  });

  it('correctly identifies WIDE_OPEN field with top 6 within 30 points', () => {
    const scores = [
      createMockHorseScore({ rank: 1, finalScore: 190, confidenceTier: 'high' }),
      createMockHorseScore({ rank: 2, finalScore: 185, confidenceTier: 'high' }),
      createMockHorseScore({ rank: 3, finalScore: 180, confidenceTier: 'high' }),
      createMockHorseScore({ rank: 4, finalScore: 175, confidenceTier: 'medium' }),
      createMockHorseScore({ rank: 5, finalScore: 170, confidenceTier: 'medium' }),
      createMockHorseScore({ rank: 6, finalScore: 165, confidenceTier: 'medium' }), // 190 - 165 = 25
    ];

    const result = calculateFieldSeparation(scores);

    expect(result.fieldType).toBe('WIDE_OPEN');
    expect(result.scoreGaps).toEqual([5, 5, 5, 5]); // Tight gaps
  });

  it('correctly identifies SEPARATED field with 15+ point gaps', () => {
    const scores = [
      createMockHorseScore({ rank: 1, finalScore: 195, confidenceTier: 'high' }),
      createMockHorseScore({ rank: 2, finalScore: 175, confidenceTier: 'medium' }), // 20 point gap
      createMockHorseScore({ rank: 3, finalScore: 155, confidenceTier: 'medium' }),
      createMockHorseScore({ rank: 4, finalScore: 140, confidenceTier: 'low' }),
    ];

    const result = calculateFieldSeparation(scores);

    expect(result.fieldType).toBe('SEPARATED');
    expect(result.scoreGaps[0]).toBe(20); // 195 - 175 = 20
    expect(result.clearSeparation).toBe(true);
  });

  it('correctly identifies COMPETITIVE field with top 4 within 25 points and no big gaps', () => {
    // All gaps under 15 points, top 4 within 25 points
    const scores = [
      createMockHorseScore({ rank: 1, finalScore: 180, confidenceTier: 'high' }),
      createMockHorseScore({ rank: 2, finalScore: 172, confidenceTier: 'medium' }), // 8 pt gap
      createMockHorseScore({ rank: 3, finalScore: 165, confidenceTier: 'medium' }), // 7 pt gap
      createMockHorseScore({ rank: 4, finalScore: 158, confidenceTier: 'medium' }), // 7 pt gap, 180-158=22
      createMockHorseScore({ rank: 5, finalScore: 150, confidenceTier: 'low' }), // 8 pt gap
    ];

    const result = calculateFieldSeparation(scores);

    expect(result.fieldType).toBe('COMPETITIVE');
    expect(result.contenderCount).toBe(5); // All 5 horses have score >= 140
  });

  it('handles empty array gracefully', () => {
    const result = calculateFieldSeparation([]);

    expect(result.fieldType).toBe('WIDE_OPEN');
    expect(result.scoreGaps).toEqual([]);
    expect(result.topTierCount).toBe(0);
    expect(result.contenderCount).toBe(0);
    expect(result.clearSeparation).toBe(false);
  });

  it('handles single horse gracefully', () => {
    const scores = [createMockHorseScore({ rank: 1, finalScore: 200 })];

    const result = calculateFieldSeparation(scores);

    expect(result.scoreGaps).toEqual([]);
    expect(result.topTierCount).toBe(1);
    expect(result.contenderCount).toBe(1);
  });

  it('adjusts thresholds for small fields (< 5 horses)', () => {
    // With 4 horses, the DOMINANT threshold is 30 * 0.7 = 21
    // A gap of 25 > 21, so it triggers DOMINANT
    const scores = [
      createMockHorseScore({ rank: 1, finalScore: 200, confidenceTier: 'high' }),
      createMockHorseScore({ rank: 2, finalScore: 175, confidenceTier: 'medium' }), // 25 point gap > 21
      createMockHorseScore({ rank: 3, finalScore: 160, confidenceTier: 'medium' }),
      createMockHorseScore({ rank: 4, finalScore: 145, confidenceTier: 'low' }),
    ];

    const result = calculateFieldSeparation(scores);

    // With 25 > 21 (adjusted DOMINANT threshold), should be DOMINANT
    expect(result.fieldType).toBe('DOMINANT');
  });

  it('identifies SEPARATED in small fields with moderate gap', () => {
    // With 4 horses, SEPARATED threshold is 15 * 0.7 = 10.5
    // A gap of 12 > 10.5 but < 21, so it triggers SEPARATED
    const scores = [
      createMockHorseScore({ rank: 1, finalScore: 185, confidenceTier: 'high' }),
      createMockHorseScore({ rank: 2, finalScore: 173, confidenceTier: 'medium' }), // 12 point gap
      createMockHorseScore({ rank: 3, finalScore: 160, confidenceTier: 'medium' }),
      createMockHorseScore({ rank: 4, finalScore: 145, confidenceTier: 'low' }),
    ];

    const result = calculateFieldSeparation(scores);

    expect(result.fieldType).toBe('SEPARATED');
  });
});

// ============================================================================
// TESTS - parseMorningLineOdds
// ============================================================================

describe('parseMorningLineOdds', () => {
  it('parses standard X-1 format correctly', () => {
    expect(parseMorningLineOdds('5-1')).toBe(5);
    expect(parseMorningLineOdds('10-1')).toBe(10);
    expect(parseMorningLineOdds('1-1')).toBe(1);
  });

  it('parses fractional odds correctly', () => {
    expect(parseMorningLineOdds('3-2')).toBe(1.5);
    expect(parseMorningLineOdds('9-5')).toBe(1.8);
    expect(parseMorningLineOdds('5-2')).toBe(2.5);
  });

  it('handles "even" odds', () => {
    expect(parseMorningLineOdds('even')).toBe(1.0);
    expect(parseMorningLineOdds('EVEN')).toBe(1.0);
    expect(parseMorningLineOdds('evn')).toBe(1.0);
  });

  it('returns null for unparseable odds', () => {
    expect(parseMorningLineOdds('')).toBe(null);
    expect(parseMorningLineOdds('abc')).toBe(null);
    expect(parseMorningLineOdds('5:1')).toBe(null);
    expect(parseMorningLineOdds('5/1')).toBe(null);
  });

  it('handles edge case of 0-denominator', () => {
    // This shouldn't happen in real data, but we should handle it gracefully
    expect(parseMorningLineOdds('5-0')).toBe(null);
  });
});

// ============================================================================
// TESTS - calculateImpliedProbability
// ============================================================================

describe('calculateImpliedProbability', () => {
  it('calculates implied probability correctly for standard odds', () => {
    // 5-1 should be approximately 16.67% (1/6)
    expect(calculateImpliedProbability(5)).toBeCloseTo(16.67, 1);

    // 1-1 should be 50%
    expect(calculateImpliedProbability(1)).toBe(50);

    // 10-1 should be approximately 9.09%
    expect(calculateImpliedProbability(10)).toBeCloseTo(9.09, 1);

    // 2-1 should be approximately 33.33%
    expect(calculateImpliedProbability(2)).toBeCloseTo(33.33, 1);
  });

  it('handles even money (1.0 odds)', () => {
    // Even money should be 50%
    expect(calculateImpliedProbability(1.0)).toBe(50);
  });

  it('handles odds-on favorites', () => {
    // 1-2 (0.5 decimal) should be approximately 66.67%
    expect(calculateImpliedProbability(0.5)).toBeCloseTo(66.67, 1);

    // 3-5 (0.6 decimal) should be approximately 62.5%
    expect(calculateImpliedProbability(0.6)).toBeCloseTo(62.5, 1);
  });
});

// ============================================================================
// TESTS - formatHorseForFieldSpread
// ============================================================================

describe('formatHorseForFieldSpread', () => {
  it('includes header with program number, name, rank, score, and tier', () => {
    const horse = createMockHorseScore({
      programNumber: 5,
      horseName: 'Speed Demon',
      rank: 2,
      finalScore: 175,
      confidenceTier: 'medium',
    });

    const result = formatHorseForFieldSpread(horse);

    expect(result).toContain('#5 Speed Demon | Rank: 2 | Score: 175 | Tier: medium');
  });

  it('calculates ITM rate correctly from lifetime stats', () => {
    const horse = createMockHorseScore({
      formIndicators: {
        daysSinceLastRace: 14,
        averageBeyer: 85,
        bestBeyer: 90,
        lastBeyer: 85,
        earlySpeedRating: 95,
        lifetimeStarts: 20,
        lifetimeWins: 6,
        lifetimeWinRate: 0.3, // 30% win rate
      },
    });

    const result = formatHorseForFieldSpread(horse);

    expect(result).toContain('Win Rate: 30% (6/20)');
  });

  it('displays Beyer figures correctly', () => {
    const horse = createMockHorseScore({
      formIndicators: {
        daysSinceLastRace: 14,
        averageBeyer: 82,
        bestBeyer: 88,
        lastBeyer: 85,
        earlySpeedRating: 95,
        lifetimeStarts: 10,
        lifetimeWins: 3,
        lifetimeWinRate: 0.3,
      },
    });

    const result = formatHorseForFieldSpread(horse);

    expect(result).toContain('Best Beyer: 88 | Last Beyer: 85 | Avg: 82');
  });

  it('handles missing Beyer figures with N/A', () => {
    const horse = createMockHorseScore({
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
    });

    const result = formatHorseForFieldSpread(horse);

    expect(result).toContain('Best Beyer: N/A | Last Beyer: N/A | Avg: N/A');
  });

  it('displays key positives (up to 3)', () => {
    const horse = createMockHorseScore({
      positiveFactors: ['Top Beyer', 'Strong trainer', 'Good post', 'Extra factor'],
    });

    const result = formatHorseForFieldSpread(horse);

    expect(result).toContain('Key Positives: Top Beyer, Strong trainer, Good post');
    expect(result).not.toContain('Extra factor');
  });

  it('displays key negatives (up to 3)', () => {
    const horse = createMockHorseScore({
      negativeFactors: ['Layoff', 'Class rise', 'Poor post', 'Extra negative'],
    });

    const result = formatHorseForFieldSpread(horse);

    expect(result).toContain('Key Negatives: Layoff, Class rise, Poor post');
    expect(result).not.toContain('Extra negative');
  });

  it('flags POTENTIAL VALUE when rank beats ML implied probability', () => {
    // Rank 2 horse with 10-1 odds (9.09% implied) - should have much higher implied for rank 2
    const horse = createMockHorseScore({
      rank: 2,
      morningLineOdds: '10-1', // 9.09% implied, but rank 2 should be at least 18%
    });

    const result = formatHorseForFieldSpread(horse);

    expect(result).toContain('*** POTENTIAL VALUE ***');
  });

  it('does not flag value when odds match rank position', () => {
    // Rank 1 horse with 2-1 odds (33.33% implied) - appropriate for top rank
    const horse = createMockHorseScore({
      rank: 1,
      morningLineOdds: '2-1', // 33.33% implied, meets rank 1 threshold of 25%
    });

    const result = formatHorseForFieldSpread(horse);

    expect(result).not.toContain('*** POTENTIAL VALUE ***');
  });

  it('triggers EXCLUDE flag for score < 100', () => {
    const horse = createMockHorseScore({
      finalScore: 95,
    });

    const result = formatHorseForFieldSpread(horse);

    expect(result).toContain('❌ EXCLUDE: Score below 100');
  });

  it('triggers EXCLUDE flag for 0 wins in 10+ starts', () => {
    const horse = createMockHorseScore({
      formIndicators: {
        daysSinceLastRace: 14,
        averageBeyer: 75,
        bestBeyer: 80,
        lastBeyer: 75,
        earlySpeedRating: 85,
        lifetimeStarts: 12,
        lifetimeWins: 0,
        lifetimeWinRate: 0,
      },
    });

    const result = formatHorseForFieldSpread(horse);

    expect(result).toContain('❌ EXCLUDE: 0 wins in 12 starts');
  });

  it('triggers EXCLUDE flag for no Beyer figures', () => {
    const horse = createMockHorseScore({
      formIndicators: {
        daysSinceLastRace: 14,
        averageBeyer: null,
        bestBeyer: null,
        lastBeyer: null,
        earlySpeedRating: 85,
        lifetimeStarts: 5,
        lifetimeWins: 1,
        lifetimeWinRate: 0.2,
      },
    });

    const result = formatHorseForFieldSpread(horse);

    expect(result).toContain('❌ EXCLUDE: No Beyer figures');
  });

  it('combines multiple exclude reasons', () => {
    const horse = createMockHorseScore({
      finalScore: 90,
      formIndicators: {
        daysSinceLastRace: 14,
        averageBeyer: null,
        bestBeyer: null,
        lastBeyer: null,
        earlySpeedRating: 85,
        lifetimeStarts: 15,
        lifetimeWins: 0,
        lifetimeWinRate: 0,
      },
    });

    const result = formatHorseForFieldSpread(horse);

    expect(result).toContain('❌ EXCLUDE:');
    expect(result).toContain('Score below 100');
    expect(result).toContain('No Beyer figures');
    expect(result).toContain('0 wins in 15 starts');
  });
});

// ============================================================================
// TESTS - formatHorseForFieldSpreadAbbreviated
// ============================================================================

describe('formatHorseForFieldSpreadAbbreviated', () => {
  it('produces abbreviated single-line format for horses ranked 8+', () => {
    const horse = createMockHorseScore({
      programNumber: 9,
      horseName: 'Deep Longshot',
      rank: 9,
      finalScore: 125,
    });

    const result = formatHorseForFieldSpreadAbbreviated(horse);

    expect(result).toBe('#9 Deep Longshot | Score: 125 | ❌ EXCLUDE: Below contention');
    expect(result).not.toContain('Beyer');
    expect(result).not.toContain('Win Rate');
    expect(result).not.toContain('Morning Line');
  });
});

// ============================================================================
// TESTS - buildFieldSpreadPrompt
// ============================================================================

describe('buildFieldSpreadPrompt', () => {
  it('returns a string', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('includes system prompt with JSON instruction', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    expect(prompt).toContain('You are a horse racing bet structuring specialist');
    expect(prompt).toContain('Return JSON only');
  });

  it('includes bet structure framework with EXACTA and TRIFECTA sections', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    expect(prompt).toContain('BET STRUCTURE RECOMMENDATIONS');
    expect(prompt).toContain('For EXACTA:');
    expect(prompt).toContain('For TRIFECTA:');
    expect(prompt).toContain('Key horse + 3-4 underneath');
    expect(prompt).toContain('Box 3 = 6 combinations');
  });

  it('includes field separation analysis section', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    expect(prompt).toContain('FIELD SEPARATION ANALYSIS:');
    expect(prompt).toContain('Field Type:');
    expect(prompt).toContain('Score Gaps');
    expect(prompt).toContain('Top Tier Count');
    expect(prompt).toContain('Contender Count');
    expect(prompt).toContain('Clear Separation:');
  });

  it('includes contender classification criteria', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    expect(prompt).toContain('CONTENDER CLASSIFICATION:');
    expect(prompt).toContain('"A" CONTENDERS: Score 180+');
    expect(prompt).toContain('"B" CONTENDERS: Score 160-179');
    expect(prompt).toContain('"C" CONTENDERS: Score 140-159');
    expect(prompt).toContain('ELIMINATE: Score <140');
  });

  it('includes field type implications', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    expect(prompt).toContain('FIELD TYPE IMPLICATIONS:');
    expect(prompt).toContain('DOMINANT: Key the standout');
    expect(prompt).toContain('SEPARATED: Clear A/B/C tiers');
    expect(prompt).toContain('COMPETITIVE: Dangerous for singles');
    expect(prompt).toContain('WIDE_OPEN: Maximum spread or pass');
  });

  it('horses ranked 8+ get abbreviated format', () => {
    const horses = [];
    const scores = [];
    for (let i = 1; i <= 10; i++) {
      horses.push(
        createMockHorseEntry({
          programNumber: i,
          horseName: `Horse ${i}`,
        })
      );
      scores.push(
        createMockHorseScore({
          programNumber: i,
          horseName: `Horse ${i}`,
          rank: i,
          finalScore: 200 - i * 10,
        })
      );
    }

    const race = createMockParsedRace({ horses });
    const scoringResult = createMockScoringResult({ scores });

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    // Horses 1-7 should have full format with Beyer info
    expect(prompt).toContain('#1 Horse 1 | Rank: 1 | Score: 190 | Tier:');
    expect(prompt).toContain('#7 Horse 7 | Rank: 7 | Score: 130 | Tier:');
    expect(prompt).toContain('Best Beyer:');

    // Horses 8+ should have abbreviated format
    expect(prompt).toContain('#8 Horse 8 | Score: 120 | ❌ EXCLUDE: Below contention');
    expect(prompt).toContain('#10 Horse 10 | Score: 100 | ❌ EXCLUDE: Below contention');
  });

  it('includes expected output structure with all required fields', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    // Field assessment
    expect(prompt).toContain('"fieldAssessment"');
    expect(prompt).toContain('"topTierCount"');
    expect(prompt).toContain('"contenderCount"');
    expect(prompt).toContain('"isBettableRace"');
    expect(prompt).toContain('"passReason"');

    // Horse classifications
    expect(prompt).toContain('"horseClassifications"');
    expect(prompt).toContain('"classification": "A" | "B" | "C" | "EXCLUDE"');
    expect(prompt).toContain('"includeOnTickets"');
    expect(prompt).toContain('"keyCandidate"');
    expect(prompt).toContain('"spreadOnly"');

    // Bet structure
    expect(prompt).toContain('"betStructure"');
    expect(prompt).toContain('"primaryRecommendation"');
    expect(prompt).toContain('"exactaSuggestion"');
    expect(prompt).toContain('"trifectaSuggestion"');
    expect(prompt).toContain('"ticketCost"');

    // Confidence and reasoning
    expect(prompt).toContain('"confidence": "HIGH" | "MEDIUM" | "LOW"');
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

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    expect(prompt).toContain('Active Horse');
    expect(prompt).not.toContain('Scratched Horse');
  });

  it('includes vulnerable favorite flag when detected', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      raceAnalysis: createMockRaceAnalysis({
        vulnerableFavorite: true,
      }),
    });

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    expect(prompt).toContain(
      'Vulnerable Favorite: YES - Algorithm detected potential vulnerability'
    );
  });

  it('shows "No" for vulnerable favorite when not detected', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      raceAnalysis: createMockRaceAnalysis({
        vulnerableFavorite: false,
      }),
    });

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    expect(prompt).toContain('Vulnerable Favorite: No');
  });

  it('includes race context with track and field info', () => {
    const race = createMockParsedRace({
      header: createMockRaceHeader({
        trackName: 'Churchill Downs',
        trackCode: 'CD',
        raceNumber: 8,
        distance: '1 1/16 Miles',
        surface: 'dirt',
      }),
    });
    const scoringResult = createMockScoringResult();

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    expect(prompt).toContain('Track: Churchill Downs (CD)');
    expect(prompt).toContain('Race 8: 1 1/16 Miles on dirt');
    expect(prompt).toContain('Field Size:');
  });
});

// ============================================================================
// SCENARIO TESTS - Integration-style tests
// ============================================================================

describe('Field Spread Prompt - Scenario Tests', () => {
  it('Scenario A - Dominant Favorite: field type DOMINANT with 40pt gap', () => {
    // Field with rank 1 at 220 points, rank 2 at 180 points (40 point gap)
    const race = createMockParsedRace({
      horses: [
        createMockHorseEntry({ programNumber: 1, horseName: 'Dominant Star' }),
        createMockHorseEntry({ programNumber: 2, horseName: 'Second Best' }),
        createMockHorseEntry({ programNumber: 3, horseName: 'Also Ran' }),
        createMockHorseEntry({ programNumber: 4, horseName: 'Longshot' }),
        createMockHorseEntry({ programNumber: 5, horseName: 'Outsider' }),
      ],
    });
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          programNumber: 1,
          horseName: 'Dominant Star',
          rank: 1,
          finalScore: 220,
          confidenceTier: 'high',
        }),
        createMockHorseScore({
          programNumber: 2,
          horseName: 'Second Best',
          rank: 2,
          finalScore: 180, // 40 point gap
          confidenceTier: 'high',
        }),
        createMockHorseScore({
          programNumber: 3,
          horseName: 'Also Ran',
          rank: 3,
          finalScore: 165,
          confidenceTier: 'medium',
        }),
        createMockHorseScore({
          programNumber: 4,
          horseName: 'Longshot',
          rank: 4,
          finalScore: 150,
          confidenceTier: 'low',
        }),
        createMockHorseScore({
          programNumber: 5,
          horseName: 'Outsider',
          rank: 5,
          finalScore: 135,
          confidenceTier: 'low',
        }),
      ],
    });

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    expect(prompt).toContain('Field Type: DOMINANT');
    expect(prompt).toContain('Score Gaps (1-2, 2-3, 3-4, 4-5): 40, 15, 15, 15');
  });

  it('Scenario B - Wide Open Field: top 6 within 25 points', () => {
    // Field with top 6 all within 25 points (165-190 range)
    const race = createMockParsedRace({
      horses: Array.from({ length: 6 }, (_, i) =>
        createMockHorseEntry({
          programNumber: i + 1,
          horseName: `Horse ${i + 1}`,
        })
      ),
    });
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          programNumber: 1,
          horseName: 'Horse 1',
          rank: 1,
          finalScore: 190,
          confidenceTier: 'high',
        }),
        createMockHorseScore({
          programNumber: 2,
          horseName: 'Horse 2',
          rank: 2,
          finalScore: 185,
          confidenceTier: 'high',
        }),
        createMockHorseScore({
          programNumber: 3,
          horseName: 'Horse 3',
          rank: 3,
          finalScore: 180,
          confidenceTier: 'high',
        }),
        createMockHorseScore({
          programNumber: 4,
          horseName: 'Horse 4',
          rank: 4,
          finalScore: 175,
          confidenceTier: 'medium',
        }),
        createMockHorseScore({
          programNumber: 5,
          horseName: 'Horse 5',
          rank: 5,
          finalScore: 170,
          confidenceTier: 'medium',
        }),
        createMockHorseScore({
          programNumber: 6,
          horseName: 'Horse 6',
          rank: 6,
          finalScore: 165, // 190 - 165 = 25
          confidenceTier: 'medium',
        }),
      ],
    });

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    expect(prompt).toContain('Field Type: WIDE_OPEN');
    expect(prompt).toContain('WIDE_OPEN: Maximum spread or pass');
  });

  it('Scenario C - Exclude Triggers: score 95 and 0/12 record get EXCLUDE flag', () => {
    const race = createMockParsedRace({
      horses: [
        createMockHorseEntry({ programNumber: 1, horseName: 'Low Scorer' }),
        createMockHorseEntry({ programNumber: 2, horseName: 'No Wins' }),
        createMockHorseEntry({ programNumber: 3, horseName: 'Normal Horse' }),
      ],
    });
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          programNumber: 3,
          horseName: 'Normal Horse',
          rank: 1,
          finalScore: 180,
        }),
        createMockHorseScore({
          programNumber: 1,
          horseName: 'Low Scorer',
          rank: 2,
          finalScore: 95, // Score < 100
        }),
        createMockHorseScore({
          programNumber: 2,
          horseName: 'No Wins',
          rank: 3,
          finalScore: 120,
          formIndicators: {
            daysSinceLastRace: 14,
            averageBeyer: 75,
            bestBeyer: 80,
            lastBeyer: 75,
            earlySpeedRating: 85,
            lifetimeStarts: 12,
            lifetimeWins: 0, // 0 wins in 12 starts
            lifetimeWinRate: 0,
          },
        }),
      ],
    });

    const prompt = buildFieldSpreadPrompt(race, scoringResult);

    // Both should have EXCLUDE flags
    expect(prompt).toContain('❌ EXCLUDE: Score below 100');
    expect(prompt).toContain('❌ EXCLUDE: 0 wins in 12 starts');

    // Verify Normal Horse doesn't have exclude flag
    const normalHorseSection = prompt.split('Normal Horse')[1]?.split('\n\n')[0];
    expect(normalHorseSection).not.toContain('❌ EXCLUDE');
  });
});
