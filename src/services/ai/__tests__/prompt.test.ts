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
    trackCondition: 'fast',
    distance: '6f',
    distanceYards: 1320,
    surface: 'dirt',
    raceNumber: 5,
    raceType: 'ALW',
    classification: 'allowance',
    purse: 75000,
    fieldSize: 8,
    postPosition: 3,
    startPosition: '3',
    firstCallPosition: 2,
    secondCallPosition: 3,
    stretchPosition: 2,
    finishPosition: 1,
    beatenLengths: 0,
    speedFigures: {
      beyer: 85,
      timeformUS: null,
      equibase: null,
      trackVariant: null,
      dirtVariant: null,
      turfVariant: null,
    },
    tripComment: 'Stalked pace, drew clear',
    finalTime: 70.45,
    winner: 'Test Horse',
    ...overrides,
  };
}

function createMockHorseEntry(overrides: Partial<HorseEntry> = {}): HorseEntry {
  return {
    programNumber: 1,
    horseName: 'Test Horse',
    morningLineOdds: '5-1',
    jockeyName: 'John Smith',
    trainerName: 'Jane Doe',
    ownerName: 'Test Owner',
    weight: 122,
    age: 4,
    sex: 'c',
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
    jockeyStats: '15% win',
    trainerStats: '20% win',
    runningStyle: 'E/P',
    daysSinceLastRace: 21,
    pastPerformances: [createMockPastPerformance()],
    workouts: [],
    lifetimeRecord: {
      starts: 10,
      wins: 3,
      places: 2,
      shows: 2,
      earnings: 150000,
    },
    currentYearRecord: {
      starts: 5,
      wins: 2,
      places: 1,
      shows: 1,
      earnings: 75000,
    },
    previousYearRecord: {
      starts: 5,
      wins: 1,
      places: 1,
      shows: 1,
      earnings: 75000,
    },
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
    medications: [],
    claimingPrice: null,
    trackRecord: { starts: 2, wins: 1, places: 1, shows: 0 },
    distanceRecord: { starts: 3, wins: 1, places: 1, shows: 1 },
    surfaceRecord: { starts: 8, wins: 3, places: 1, shows: 2 },
    wetTrackRecord: { starts: 1, wins: 0, places: 0, shows: 0 },
    turfRecord: { starts: 2, wins: 0, places: 1, shows: 0 },
    trainerCategoryStats: createDefaultTrainerCategoryStats(),
    ...overrides,
  };
}

function createMockRaceHeader(overrides: Partial<RaceHeader> = {}): RaceHeader {
  return {
    trackCode: 'SA',
    trackName: 'Santa Anita',
    raceDate: '2024-01-20',
    raceNumber: 5,
    distance: '6 Furlongs',
    distanceFurlongs: 6,
    surface: 'dirt',
    trackCondition: 'fast',
    raceType: 'CLM',
    classification: 'claiming',
    purse: 35000,
    purseFormatted: '$35,000',
    ageRestriction: '4+',
    sexRestriction: '',
    fieldSize: 8,
    postTime: '3:00 PM',
    scheduledRaceType: 'Thoroughbred',
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
