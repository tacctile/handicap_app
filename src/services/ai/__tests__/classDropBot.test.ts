/**
 * Unit tests for Class Drop Bot
 *
 * Tests for:
 * - analyzeClassDrop function
 * - Class drop signal aggregation in aggregateHorseSignals
 * - Reinforcement-only architecture (Class Drop cannot create value candidates)
 * - Safety filters (chronic dropper, negative form, long layoff)
 * - Template A protection (solid favorite with only class drop signal → PASS)
 */

import { describe, it, expect } from 'vitest';
import { analyzeClassDrop, aggregateHorseSignals, identifyValueHorse } from '../index';
import type { MultiBotRawResults, ClassDropAnalysis } from '../types';
import type { ParsedRace, PastPerformance, RaceClassification } from '../../../types/drf';
import type { RaceScoringResult, HorseScore } from '../../../types/scoring';

// ============================================================================
// MOCK DATA BUILDERS
// ============================================================================

function createDefaultTrainerPatternsForAI() {
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

function createMockPastPerformance(overrides: Partial<PastPerformance> = {}): PastPerformance {
  return {
    date: '20240101',
    track: 'TST',
    trackName: 'Test Track',
    raceNumber: 1,
    distanceFurlongs: 6,
    distance: '6 Furlongs',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'claiming' as RaceClassification,
    claimingPrice: 25000,
    purse: 25000,
    fieldSize: 8,
    finishPosition: 3,
    lengthsBehind: 2.5,
    lengthsAhead: null,
    finalTime: 70.5,
    finalTimeFormatted: '1:10.50',
    speedFigures: {
      beyer: 75,
      timeformUS: null,
      equibase: null,
      trackVariant: null,
      dirtVariant: null,
      turfVariant: null,
    },
    runningLine: {
      start: 4,
      quarterMile: 3,
      quarterMileLengths: 2,
      halfMile: 3,
      halfMileLengths: 2.5,
      threeQuarters: null,
      threeQuartersLengths: null,
      stretch: 3,
      stretchLengths: 3,
      finish: 3,
      finishLengths: 2.5,
    },
    jockey: 'Test Jockey',
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
    favoriteRank: 3,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: 30,
    earlyPace1: 80,
    latePace: 75,
    quarterTime: 22.0,
    halfMileTime: 45.5,
    sixFurlongTime: null,
    mileTime: null,
    ...overrides,
  };
}

function createMockRace(
  horses: Array<{
    programNumber: number;
    name: string;
    runningStyle: string;
    mlOdds: string;
    daysSinceLastRace?: number;
  }>,
  raceOverrides: Partial<ParsedRace['header']> = {}
): ParsedRace {
  return {
    header: {
      raceNumber: 1,
      trackName: 'Test Track',
      trackCode: 'TST',
      distance: '6 Furlongs',
      surface: 'dirt',
      trackCondition: 'fast',
      classification: 'claiming' as RaceClassification,
      purseFormatted: '$15,000',
      purse: 15000,
      claimingPrice: 15000,
      condition: 'fast',
      date: '2024-01-01',
      postTime: '1:00 PM',
      raceType: 'CLM',
      ...raceOverrides,
    },
    horses: horses.map((h) => ({
      programNumber: h.programNumber,
      postPosition: h.programNumber,
      horseName: h.name,
      runningStyle: h.runningStyle,
      morningLineOdds: h.mlOdds,
      jockeyName: 'Test Jockey',
      trainerName: 'Test Trainer',
      jockeyStats: '20%',
      trainerStats: '15%',
      daysSinceLastRace: h.daysSinceLastRace ?? 30,
      age: 3,
      sex: 'C',
      weight: 120,
      sireInfo: { sireName: 'Test Sire' },
      damInfo: { damName: 'Test Dam', damSireName: 'Test Dam Sire' },
      ownerName: 'Test Owner',
      currentOdds: h.mlOdds,
      isScratched: false,
      pastPerformances: [],
      workouts: [],
      medication: '',
      equipment: '',
      breeder: 'Test Breeder',
      whereFrom: 'KY',
    })) as unknown as ParsedRace['horses'],
    warnings: [],
    errors: [],
  } as unknown as ParsedRace;
}

function createMockScoringResult(
  horses: Array<{
    programNumber: number;
    name: string;
    rank: number;
    score: number;
    tier?: string;
    pastPerformances?: PastPerformance[];
    daysSinceLastRace?: number | null;
    averageBeyer?: number | null;
  }>
): RaceScoringResult {
  return {
    scores: horses.map(
      (h): HorseScore => ({
        programNumber: h.programNumber,
        horseName: h.name,
        rank: h.rank,
        finalScore: h.score,
        confidenceTier: (h.tier as 'high' | 'medium' | 'low') || 'high',
        breakdown: {
          speedScore: 50,
          classScore: 30,
          formScore: 20,
          paceScore: 20,
          connectionScore: 15,
        },
        positiveFactors: ['Strong speed figures'],
        negativeFactors: [],
        isScratched: false,
        pastPerformances: h.pastPerformances || [],
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
          daysSinceLastRace: h.daysSinceLastRace ?? 30,
          averageBeyer: h.averageBeyer ?? 75,
          bestBeyer: 80,
          lastBeyer: 75,
          earlySpeedRating: 70,
          lifetimeStarts: 10,
          lifetimeWins: 2,
          lifetimeWinRate: 20,
        },
        morningLineOdds: '5-1',
        morningLineDecimal: 5.0,
      })
    ),
    raceAnalysis: {
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
    },
  };
}

// ============================================================================
// TEST: analyzeClassDrop
// ============================================================================

describe('analyzeClassDrop', () => {
  it('should detect MAJOR class drop (>= 40%)', () => {
    // Today's race: $15,000 claiming
    // Last 3 races: $25,000, $26,000, $24,000 (median = $25,000)
    // Drop: (25000 - 15000) / 25000 = 40%
    const race = createMockRace(
      [{ programNumber: 1, name: 'Big Dropper', runningStyle: 'E', mlOdds: '5-1' }],
      { claimingPrice: 15000, purse: 15000 }
    );

    const pastPerformances = [
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
      createMockPastPerformance({ claimingPrice: 26000, purse: 26000 }),
      createMockPastPerformance({ claimingPrice: 24000, purse: 24000 }),
    ];

    const scoringResult = createMockScoringResult([
      { programNumber: 1, name: 'Big Dropper', rank: 1, score: 200, pastPerformances },
    ]);

    const result = analyzeClassDrop(race, scoringResult);

    expect(result.horses.length).toBe(1);
    expect(result.horses[0]?.classification).toBe('MAJOR');
    expect(result.horses[0]?.dropPercentage).toBeGreaterThanOrEqual(0.4);
    expect(result.horses[0]?.signalBoost).toBe(1.5);
    expect(result.horses[0]?.flagged).toBe(true);
  });

  it('should detect MODERATE class drop (25-39%)', () => {
    // Today's race: $18,000 claiming
    // Last 3 races: $25,000 (30% drop)
    const race = createMockRace(
      [{ programNumber: 1, name: 'Moderate Dropper', runningStyle: 'E', mlOdds: '5-1' }],
      { claimingPrice: 18000, purse: 18000 }
    );

    const pastPerformances = [
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
      createMockPastPerformance({ claimingPrice: 26000, purse: 26000 }),
      createMockPastPerformance({ claimingPrice: 24000, purse: 24000 }),
    ];

    const scoringResult = createMockScoringResult([
      { programNumber: 1, name: 'Moderate Dropper', rank: 1, score: 200, pastPerformances },
    ]);

    const result = analyzeClassDrop(race, scoringResult);

    expect(result.horses.length).toBe(1);
    expect(result.horses[0]?.classification).toBe('MODERATE');
    expect(result.horses[0]?.dropPercentage).toBeGreaterThanOrEqual(0.25);
    expect(result.horses[0]?.dropPercentage).toBeLessThan(0.4);
    expect(result.horses[0]?.signalBoost).toBe(1.0);
  });

  it('should detect MINOR class drop (20-24%)', () => {
    // Today's race: $20,000 claiming
    // Last 3 races: $25,000 (20% drop)
    const race = createMockRace(
      [{ programNumber: 1, name: 'Minor Dropper', runningStyle: 'E', mlOdds: '5-1' }],
      { claimingPrice: 20000, purse: 20000 }
    );

    const pastPerformances = [
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
    ];

    const scoringResult = createMockScoringResult([
      { programNumber: 1, name: 'Minor Dropper', rank: 1, score: 200, pastPerformances },
    ]);

    const result = analyzeClassDrop(race, scoringResult);

    expect(result.horses.length).toBe(1);
    expect(result.horses[0]?.classification).toBe('MINOR');
    expect(result.horses[0]?.dropPercentage).toBeGreaterThanOrEqual(0.2);
    expect(result.horses[0]?.dropPercentage).toBeLessThan(0.25);
    expect(result.horses[0]?.signalBoost).toBe(0.5);
  });

  it('should detect RISING class (>= 20% rise) with penalty', () => {
    // Today's race: $30,000 claiming
    // Last 3 races: $25,000 (-20% = 20% rise)
    const race = createMockRace(
      [{ programNumber: 1, name: 'Rising Star', runningStyle: 'E', mlOdds: '5-1' }],
      { claimingPrice: 32000, purse: 32000 }
    );

    const pastPerformances = [
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
    ];

    const scoringResult = createMockScoringResult([
      { programNumber: 1, name: 'Rising Star', rank: 1, score: 200, pastPerformances },
    ]);

    const result = analyzeClassDrop(race, scoringResult);

    expect(result.horses.length).toBe(1);
    expect(result.horses[0]?.classification).toBe('RISING');
    expect(result.horses[0]?.dropPercentage).toBeLessThan(0);
    expect(result.horses[0]?.signalBoost).toBe(-0.5);
    expect(result.horses[0]?.flagged).toBe(true);
  });

  it('should ignore class changes below 20% threshold', () => {
    // Today's race: $23,000 claiming
    // Last 3 races: $25,000 (only 8% drop)
    const race = createMockRace(
      [{ programNumber: 1, name: 'Small Change', runningStyle: 'E', mlOdds: '5-1' }],
      { claimingPrice: 23000, purse: 23000 }
    );

    const pastPerformances = [
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
    ];

    const scoringResult = createMockScoringResult([
      { programNumber: 1, name: 'Small Change', rank: 1, score: 200, pastPerformances },
    ]);

    const result = analyzeClassDrop(race, scoringResult);

    // Horse should not appear in results (< 20% threshold)
    expect(result.horses.length).toBe(0);
  });

  it('should return null for first-time starter', () => {
    const race = createMockRace([
      { programNumber: 1, name: 'First Timer', runningStyle: 'E', mlOdds: '5-1' },
    ]);

    const scoringResult = createMockScoringResult([
      { programNumber: 1, name: 'First Timer', rank: 1, score: 200, pastPerformances: [] },
    ]);

    const result = analyzeClassDrop(race, scoringResult);

    expect(result.horses.length).toBe(0);
  });

  it('should return null for horse with single past race', () => {
    const race = createMockRace([
      { programNumber: 1, name: 'One Start', runningStyle: 'E', mlOdds: '5-1' },
    ]);

    const pastPerformances = [createMockPastPerformance({ claimingPrice: 25000, purse: 25000 })];

    const scoringResult = createMockScoringResult([
      { programNumber: 1, name: 'One Start', rank: 1, score: 200, pastPerformances },
    ]);

    const result = analyzeClassDrop(race, scoringResult);

    expect(result.horses.length).toBe(0);
  });

  it('should apply 0.9x multiplier for 2-race baseline', () => {
    // Today's race: $15,000 claiming
    // Last 2 races: $25,000, $25,000 (40% drop, but only 2 races)
    const race = createMockRace(
      [{ programNumber: 1, name: 'Two Timer', runningStyle: 'E', mlOdds: '5-1' }],
      { claimingPrice: 15000, purse: 15000 }
    );

    const pastPerformances = [
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
    ];

    const scoringResult = createMockScoringResult([
      { programNumber: 1, name: 'Two Timer', rank: 1, score: 200, pastPerformances },
    ]);

    const result = analyzeClassDrop(race, scoringResult);

    expect(result.horses.length).toBe(1);
    // MAJOR drop = 1.5 * 0.9 = 1.35
    expect(result.horses[0]?.signalBoost).toBeCloseTo(1.35, 2);
    expect(result.horses[0]?.safetyFiltersApplied).toContain('2-race baseline (0.9x multiplier)');
  });

  it('should apply chronic dropper filter (2+ consecutive drops)', () => {
    // Today's race: $15,000 claiming
    // Last 3 races: $20,000, $25,000, $30,000 (consecutive drops)
    const race = createMockRace(
      [{ programNumber: 1, name: 'Chronic Dropper', runningStyle: 'E', mlOdds: '5-1' }],
      { claimingPrice: 15000, purse: 15000 }
    );

    const pastPerformances = [
      createMockPastPerformance({ claimingPrice: 20000, purse: 20000 }),
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
      createMockPastPerformance({ claimingPrice: 30000, purse: 30000 }),
    ];

    const scoringResult = createMockScoringResult([
      { programNumber: 1, name: 'Chronic Dropper', rank: 1, score: 200, pastPerformances },
    ]);

    const result = analyzeClassDrop(race, scoringResult);

    expect(result.horses.length).toBe(1);
    expect(result.horses[0]?.signalBoost).toBe(0);
    expect(result.horses[0]?.safetyFiltersApplied).toContain(
      'chronic dropper (2+ consecutive drops)'
    );
  });

  it('should apply negative form filter (declining speed figures)', () => {
    // Today's race with dropping class but declining form
    const race = createMockRace(
      [{ programNumber: 1, name: 'Declining Form', runningStyle: 'E', mlOdds: '5-1' }],
      { claimingPrice: 15000, purse: 15000 }
    );

    const pastPerformances = [
      createMockPastPerformance({
        claimingPrice: 25000,
        purse: 25000,
        speedFigures: {
          beyer: 70,
          timeformUS: null,
          equibase: null,
          trackVariant: null,
          dirtVariant: null,
          turfVariant: null,
        },
      }),
      createMockPastPerformance({
        claimingPrice: 25000,
        purse: 25000,
        speedFigures: {
          beyer: 75,
          timeformUS: null,
          equibase: null,
          trackVariant: null,
          dirtVariant: null,
          turfVariant: null,
        },
      }),
      createMockPastPerformance({
        claimingPrice: 25000,
        purse: 25000,
        speedFigures: {
          beyer: 80,
          timeformUS: null,
          equibase: null,
          trackVariant: null,
          dirtVariant: null,
          turfVariant: null,
        },
      }),
    ];

    const scoringResult = createMockScoringResult([
      { programNumber: 1, name: 'Declining Form', rank: 1, score: 200, pastPerformances },
    ]);

    const result = analyzeClassDrop(race, scoringResult);

    expect(result.horses.length).toBe(1);
    // MAJOR drop = 1.5, minus 0.5 for negative form = 1.0
    expect(result.horses[0]?.signalBoost).toBe(1.0);
    expect(result.horses[0]?.safetyFiltersApplied).toContain(
      'negative form (declining speed figures)'
    );
  });

  it('should cap boost at 1.0 for long layoff + major drop', () => {
    const race = createMockRace(
      [
        {
          programNumber: 1,
          name: 'Long Layoff',
          runningStyle: 'E',
          mlOdds: '5-1',
          daysSinceLastRace: 200,
        },
      ],
      { claimingPrice: 15000, purse: 15000 }
    );

    const pastPerformances = [
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
      createMockPastPerformance({ claimingPrice: 25000, purse: 25000 }),
    ];

    const scoringResult = createMockScoringResult([
      {
        programNumber: 1,
        name: 'Long Layoff',
        rank: 1,
        score: 200,
        pastPerformances,
        daysSinceLastRace: 200,
      },
    ]);

    const result = analyzeClassDrop(race, scoringResult);

    expect(result.horses.length).toBe(1);
    // MAJOR would be 1.5, but capped at 1.0 for long layoff
    expect(result.horses[0]?.signalBoost).toBe(1.0);
    expect(result.horses[0]?.safetyFiltersApplied).toContain(
      'long layoff (>180 days) + major drop'
    );
  });
});

// ============================================================================
// TEST: aggregateHorseSignals with Class Drop (reinforcement-only)
// ============================================================================

describe('aggregateHorseSignals with Class Drop', () => {
  it('should apply classDropBoost when horse is also flagged by Trip Trouble', () => {
    const race = createMockRace([
      { programNumber: 1, name: 'Double Flagged', runningStyle: 'E', mlOdds: '5-1' },
    ]);

    const classDrop: ClassDropAnalysis = {
      raceId: 'TST-1',
      horses: [
        {
          programNumber: 1,
          horseName: 'Double Flagged',
          baselineClass: 25000,
          todayClass: 15000,
          dropPercentage: 0.4,
          classification: 'MAJOR',
          signalBoost: 1.5,
          flagged: true,
          reason: 'MAJOR class drop: 40%',
          safetyFiltersApplied: [],
        },
      ],
      analysisTimestamp: Date.now(),
    };

    const rawResults: MultiBotRawResults = {
      tripTrouble: {
        horsesWithTripTrouble: [
          {
            programNumber: 1,
            horseName: 'Double Flagged',
            issue: 'Blocked in last 2 races',
            maskedAbility: true,
          },
        ],
      },
      paceScenario: null,
      vulnerableFavorite: null,
      fieldSpread: null,
      classDrop,
    };

    const signals = aggregateHorseSignals(1, 'Double Flagged', 2, 180, rawResults, race);

    // Trip trouble flagged + class drop flagged = reinforcement applies
    expect(signals.tripTroubleFlagged).toBe(true);
    expect(signals.classDropFlagged).toBe(true);
    expect(signals.classDropBoost).toBe(1.5);
    expect(signals.signalCount).toBe(2); // Trip Trouble + Class Drop
    expect(signals.totalAdjustment).toBeGreaterThan(0);
  });

  it('should apply classDropBoost when horse is also flagged by Pace Advantage', () => {
    const race = createMockRace([
      { programNumber: 1, name: 'Pace + Drop', runningStyle: 'E', mlOdds: '5-1' },
    ]);

    const classDrop: ClassDropAnalysis = {
      raceId: 'TST-1',
      horses: [
        {
          programNumber: 1,
          horseName: 'Pace + Drop',
          baselineClass: 25000,
          todayClass: 15000,
          dropPercentage: 0.4,
          classification: 'MAJOR',
          signalBoost: 1.5,
          flagged: true,
          reason: 'MAJOR class drop: 40%',
          safetyFiltersApplied: [],
        },
      ],
      analysisTimestamp: Date.now(),
    };

    const rawResults: MultiBotRawResults = {
      tripTrouble: null,
      paceScenario: {
        advantagedStyles: ['E'],
        disadvantagedStyles: ['C'],
        paceProjection: 'SLOW',
        loneSpeedException: true,
        speedDuelLikely: false,
      },
      vulnerableFavorite: null,
      fieldSpread: null,
      classDrop,
    };

    const signals = aggregateHorseSignals(1, 'Pace + Drop', 2, 180, rawResults, race);

    // Pace advantage flagged (positive) + class drop flagged = reinforcement applies
    expect(signals.paceAdvantageFlagged).toBe(true);
    expect(signals.paceAdvantage).toBeGreaterThan(0);
    expect(signals.classDropFlagged).toBe(true);
    expect(signals.classDropBoost).toBe(1.5);
    expect(signals.signalCount).toBe(2); // Pace + Class Drop
  });

  it('should NOT apply classDropBoost when horse is NOT flagged by other bots (reinforcement-only)', () => {
    const race = createMockRace([
      { programNumber: 1, name: 'Only Class Drop', runningStyle: 'E', mlOdds: '5-1' },
    ]);

    const classDrop: ClassDropAnalysis = {
      raceId: 'TST-1',
      horses: [
        {
          programNumber: 1,
          horseName: 'Only Class Drop',
          baselineClass: 25000,
          todayClass: 10000,
          dropPercentage: 0.6, // Massive 60% drop
          classification: 'MAJOR',
          signalBoost: 1.5,
          flagged: true,
          reason: 'MAJOR class drop: 60%',
          safetyFiltersApplied: [],
        },
      ],
      analysisTimestamp: Date.now(),
    };

    const rawResults: MultiBotRawResults = {
      tripTrouble: null,
      paceScenario: null,
      vulnerableFavorite: null,
      fieldSpread: null,
      classDrop,
    };

    const signals = aggregateHorseSignals(1, 'Only Class Drop', 2, 180, rawResults, race);

    // No other bot flagged the horse, so classDropBoost should be 0 (reinforcement-only)
    expect(signals.classDropFlagged).toBe(true); // The flag is set
    expect(signals.classDropBoost).toBe(0); // But the BOOST is NOT applied
    expect(signals.signalCount).toBe(0); // No signal count increment
    expect(signals.classDropReason).toContain('MAJOR class drop');
  });

  it('should apply RISING class penalty when flagged by other bots', () => {
    const race = createMockRace([
      { programNumber: 1, name: 'Rising + Trip', runningStyle: 'E', mlOdds: '5-1' },
    ]);

    const classDrop: ClassDropAnalysis = {
      raceId: 'TST-1',
      horses: [
        {
          programNumber: 1,
          horseName: 'Rising + Trip',
          baselineClass: 25000,
          todayClass: 32000,
          dropPercentage: -0.28, // 28% rise
          classification: 'RISING',
          signalBoost: -0.5,
          flagged: true,
          reason: 'RISING class: -28%',
          safetyFiltersApplied: [],
        },
      ],
      analysisTimestamp: Date.now(),
    };

    const rawResults: MultiBotRawResults = {
      tripTrouble: {
        horsesWithTripTrouble: [
          {
            programNumber: 1,
            horseName: 'Rising + Trip',
            issue: 'Blocked in last 2 races',
            maskedAbility: true,
          },
        ],
      },
      paceScenario: null,
      vulnerableFavorite: null,
      fieldSpread: null,
      classDrop,
    };

    const signals = aggregateHorseSignals(1, 'Rising + Trip', 2, 180, rawResults, race);

    // Trip trouble gives boost, but RISING class gives penalty
    expect(signals.tripTroubleFlagged).toBe(true);
    expect(signals.classDropFlagged).toBe(true);
    expect(signals.classDropBoost).toBe(-0.5); // Penalty
    // Total should be reduced by the RISING penalty
    expect(signals.totalAdjustment).toBeLessThan(signals.tripTroubleBoost);
  });
});

// ============================================================================
// TEST: identifyValueHorse with Class Drop reinforcement
// ============================================================================

describe('identifyValueHorse with Class Drop', () => {
  it('should increase botCount and signalStrength when class drop reinforces existing candidate', () => {
    const classDrop: ClassDropAnalysis = {
      raceId: 'TST-1',
      horses: [
        {
          programNumber: 2,
          horseName: 'Value Horse',
          baselineClass: 25000,
          todayClass: 15000,
          dropPercentage: 0.4,
          classification: 'MAJOR',
          signalBoost: 1.5,
          flagged: true,
          reason: 'MAJOR class drop: 40%',
          safetyFiltersApplied: [],
        },
      ],
      analysisTimestamp: Date.now(),
    };

    const rawResults: MultiBotRawResults = {
      tripTrouble: {
        horsesWithTripTrouble: [
          {
            programNumber: 2,
            horseName: 'Value Horse',
            issue: 'Blocked in last 2 races',
            maskedAbility: true,
          },
        ],
      },
      paceScenario: null,
      vulnerableFavorite: null,
      fieldSpread: null,
      classDrop,
    };

    const aggregatedSignals = [
      {
        programNumber: 1,
        horseName: 'Favorite',
        algorithmRank: 1,
        algorithmScore: 200,
        tripTroubleBoost: 0,
        hiddenAbility: null,
        tripTroubleFlagged: false,
        paceAdvantage: 0,
        paceEdgeReason: null,
        paceAdvantageFlagged: false,
        isVulnerable: false,
        vulnerabilityFlags: [],
        classification: 'A' as const,
        keyCandidate: true,
        spreadOnly: false,
        classDropBoost: 0,
        classDropFlagged: false,
        classDropReason: null,
        totalAdjustment: 0,
        adjustedRank: 1,
        signalCount: 0,
        conflictingSignals: false,
        overrideReasons: [],
      },
      {
        programNumber: 2,
        horseName: 'Value Horse',
        algorithmRank: 2,
        algorithmScore: 180,
        tripTroubleBoost: 2,
        hiddenAbility: '+5-8 Beyer masked',
        tripTroubleFlagged: true,
        paceAdvantage: 0,
        paceEdgeReason: null,
        paceAdvantageFlagged: false,
        isVulnerable: false,
        vulnerabilityFlags: [],
        classification: 'A' as const,
        keyCandidate: false,
        spreadOnly: false,
        classDropBoost: 1.5,
        classDropFlagged: true,
        classDropReason: 'MAJOR class drop: 40%',
        totalAdjustment: 3.5,
        adjustedRank: 2,
        signalCount: 2,
        conflictingSignals: false,
        overrideReasons: [],
      },
    ];

    const result = identifyValueHorse(aggregatedSignals, rawResults, 'SOLID');

    // Class drop should have reinforced the Trip Trouble candidate
    expect(result.identified).toBe(true);
    expect(result.programNumber).toBe(2);
    expect(result.horseName).toBe('Value Horse');
    // Bot count should be 2 (Trip Trouble + Class Drop reinforcement)
    expect(result.botConvergenceCount).toBe(2);
  });

  it('should NOT create new candidate from class drop alone', () => {
    const classDrop: ClassDropAnalysis = {
      raceId: 'TST-1',
      horses: [
        {
          programNumber: 3,
          horseName: 'Class Only Horse',
          baselineClass: 25000,
          todayClass: 10000,
          dropPercentage: 0.6, // Massive 60% drop
          classification: 'MAJOR',
          signalBoost: 1.5,
          flagged: true,
          reason: 'MAJOR class drop: 60%',
          safetyFiltersApplied: [],
        },
      ],
      analysisTimestamp: Date.now(),
    };

    const rawResults: MultiBotRawResults = {
      tripTrouble: null,
      paceScenario: null,
      vulnerableFavorite: null,
      fieldSpread: null,
      classDrop,
    };

    const aggregatedSignals = [
      {
        programNumber: 1,
        horseName: 'Favorite',
        algorithmRank: 1,
        algorithmScore: 200,
        tripTroubleBoost: 0,
        hiddenAbility: null,
        tripTroubleFlagged: false,
        paceAdvantage: 0,
        paceEdgeReason: null,
        paceAdvantageFlagged: false,
        isVulnerable: false,
        vulnerabilityFlags: [],
        classification: 'A' as const,
        keyCandidate: true,
        spreadOnly: false,
        classDropBoost: 0,
        classDropFlagged: false,
        classDropReason: null,
        totalAdjustment: 0,
        adjustedRank: 1,
        signalCount: 0,
        conflictingSignals: false,
        overrideReasons: [],
      },
      {
        programNumber: 3,
        horseName: 'Class Only Horse',
        algorithmRank: 3,
        algorithmScore: 160,
        tripTroubleBoost: 0,
        hiddenAbility: null,
        tripTroubleFlagged: false,
        paceAdvantage: 0,
        paceEdgeReason: null,
        paceAdvantageFlagged: false,
        isVulnerable: false,
        vulnerabilityFlags: [],
        classification: 'B' as const,
        keyCandidate: false,
        spreadOnly: false,
        classDropBoost: 0, // 0 because reinforcement-only
        classDropFlagged: true, // Flag is set
        classDropReason: 'MAJOR class drop: 60%',
        totalAdjustment: 0,
        adjustedRank: 3,
        signalCount: 0,
        conflictingSignals: false,
        overrideReasons: [],
      },
    ];

    const result = identifyValueHorse(aggregatedSignals, rawResults, 'SOLID');

    // No value horse should be identified because class drop cannot create candidates
    expect(result.identified).toBe(false);
    expect(result.programNumber).toBeNull();
  });
});

// ============================================================================
// TEST: Template A protection
// ============================================================================

describe('Template A protection with Class Drop', () => {
  it('should route to PASS when solid favorite and only class drop signal', () => {
    // This tests that Template A (solid favorite) with only class drop
    // routes to PASS because class drop alone cannot create value

    const classDrop: ClassDropAnalysis = {
      raceId: 'TST-1',
      horses: [
        {
          programNumber: 1,
          horseName: 'Favorite',
          baselineClass: 25000,
          todayClass: 10000,
          dropPercentage: 0.6,
          classification: 'MAJOR',
          signalBoost: 1.5,
          flagged: true,
          reason: 'MAJOR class drop: 60%',
          safetyFiltersApplied: [],
        },
      ],
      analysisTimestamp: Date.now(),
    };

    const rawResults: MultiBotRawResults = {
      tripTrouble: null,
      paceScenario: null,
      vulnerableFavorite: null, // NOT vulnerable
      fieldSpread: null,
      classDrop,
    };

    const aggregatedSignals = [
      {
        programNumber: 1,
        horseName: 'Favorite',
        algorithmRank: 1,
        algorithmScore: 200,
        tripTroubleBoost: 0,
        hiddenAbility: null,
        tripTroubleFlagged: false,
        paceAdvantage: 0,
        paceEdgeReason: null,
        paceAdvantageFlagged: false,
        isVulnerable: false, // SOLID
        vulnerabilityFlags: [],
        classification: 'A' as const,
        keyCandidate: true,
        spreadOnly: false,
        classDropBoost: 0, // Reinforcement-only: no boost without other bot flag
        classDropFlagged: true, // But flagged
        classDropReason: 'MAJOR class drop: 60%',
        totalAdjustment: 0,
        adjustedRank: 1,
        signalCount: 0, // No other bot signals
        conflictingSignals: false,
        overrideReasons: [],
      },
    ];

    const result = identifyValueHorse(aggregatedSignals, rawResults, 'SOLID');

    // No value horse because class drop alone cannot create candidates
    // This means Template A would route to PASS
    expect(result.identified).toBe(false);
    expect(result.reasoning).toContain('No bots identified');
  });
});
