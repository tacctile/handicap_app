/**
 * Tests for AI Prompt Builder
 */

import { describe, it, expect } from 'vitest';
import { buildRaceAnalysisPrompt } from '../prompt';
import type { ParsedRace, RaceHeader, HorseEntry, PastPerformance } from '../../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../../types/drf';
import type { RaceScoringResult, HorseScoreForAI, RaceAnalysis } from '../../../types/scoring';

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
// TESTS
// ============================================================================

describe('buildRaceAnalysisPrompt', () => {
  it('returns a string', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('includes race header information', () => {
    const race = createMockParsedRace({
      header: createMockRaceHeader({
        trackName: 'Santa Anita',
        trackCode: 'SA',
        raceNumber: 5,
        distance: '6 Furlongs',
        surface: 'dirt',
        trackCondition: 'fast',
        classification: 'claiming',
        purseFormatted: '$35,000',
      }),
    });
    const scoringResult = createMockScoringResult();

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('Santa Anita');
    expect(prompt).toContain('SA');
    expect(prompt).toContain('Race 5');
    expect(prompt).toContain('6 Furlongs');
    expect(prompt).toContain('dirt');
    expect(prompt).toContain('fast');
    expect(prompt).toContain('claiming');
    expect(prompt).toContain('$35,000');
  });

  it('includes all non-scratched horses', () => {
    const race = createMockParsedRace({
      horses: [
        createMockHorseEntry({ programNumber: 1, horseName: 'Fast Runner' }),
        createMockHorseEntry({ programNumber: 2, horseName: 'Steady Eddie' }),
        createMockHorseEntry({ programNumber: 3, horseName: 'Longshot Larry' }),
      ],
    });
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({ programNumber: 1, horseName: 'Fast Runner', isScratched: false }),
        createMockHorseScore({ programNumber: 2, horseName: 'Steady Eddie', isScratched: false }),
        createMockHorseScore({ programNumber: 3, horseName: 'Longshot Larry', isScratched: false }),
      ],
    });

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('Fast Runner');
    expect(prompt).toContain('Steady Eddie');
    expect(prompt).toContain('Longshot Larry');
    expect(prompt).toContain('#1');
    expect(prompt).toContain('#2');
    expect(prompt).toContain('#3');
  });

  it('excludes scratched horses', () => {
    const race = createMockParsedRace({
      horses: [
        createMockHorseEntry({ programNumber: 1, horseName: 'Fast Runner' }),
        createMockHorseEntry({ programNumber: 2, horseName: 'Scratched Horse' }),
        createMockHorseEntry({ programNumber: 3, horseName: 'Longshot Larry' }),
      ],
    });
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({ programNumber: 1, horseName: 'Fast Runner', isScratched: false }),
        createMockHorseScore({ programNumber: 2, horseName: 'Scratched Horse', isScratched: true }),
        createMockHorseScore({ programNumber: 3, horseName: 'Longshot Larry', isScratched: false }),
      ],
    });

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('Fast Runner');
    expect(prompt).toContain('Longshot Larry');
    // Scratched horse should not appear in the HORSES section
    expect(prompt).not.toContain('Scratched Horse');
  });

  it('includes algorithm analysis information', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      raceAnalysis: createMockRaceAnalysis({
        paceScenario: {
          expectedPace: 'hot',
          likelyLeader: 1,
          speedDuelProbability: 0.75,
          earlySpeedCount: 3,
        },
        fieldStrength: 'strong',
        vulnerableFavorite: true,
        likelyPaceCollapse: true,
      }),
    });

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('hot pace expected');
    expect(prompt).toContain('#1');
    expect(prompt).toContain('75%');
    expect(prompt).toContain('strong');
    expect(prompt).toContain('Vulnerable Favorite: YES');
    expect(prompt).toContain('Pace Collapse Likely: YES');
  });

  it('includes score breakdown for each horse', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
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
        }),
      ],
    });

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('Algorithm Rank: 1');
    expect(prompt).toContain('Score: 185/290');
    expect(prompt).toContain('Tier: high');
    expect(prompt).toContain('Speed 52/60');
    expect(prompt).toContain('Class 40/48');
    expect(prompt).toContain('Form 30/36');
    expect(prompt).toContain('Pace 28/36');
    expect(prompt).toContain('Connections 25/30');
  });

  it('includes positive and negative factors', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          programNumber: 1,
          horseName: 'Fast Runner',
          positiveFactors: ['Top Beyer figure', 'Strong trainer stats'],
          negativeFactors: ['First time at distance'],
        }),
      ],
    });

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('Top Beyer figure');
    expect(prompt).toContain('Strong trainer stats');
    expect(prompt).toContain('First time at distance');
  });

  it('includes instructions for JSON response', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('RESPOND WITH VALID JSON ONLY');
    expect(prompt).toContain('"raceNarrative"');
    expect(prompt).toContain('"horseInsights"');
    expect(prompt).toContain('"topPick"');
    expect(prompt).toContain('"valueLabel"');
  });
});
