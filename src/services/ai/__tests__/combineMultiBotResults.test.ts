/**
 * Unit tests for combineMultiBotResults function
 *
 * Tests the expansion/contraction model:
 * - Algorithm top 4 are SACRED — never demoted
 * - AI signals EXPAND boxes (add sleepers) or CONTRACT them (fade vulnerable favorites)
 * - No rank shuffling — projectedFinish reflects algorithm rank
 */

import { describe, it, expect } from 'vitest';
import {
  combineMultiBotResults,
  identifyExpansionHorses,
  detectContractionTarget,
  determineExactaStrategy,
  determineTrifectaStrategy,
} from '../index';
import type { MultiBotRawResults, AggregatedSignals } from '../types';
import type { ParsedRace } from '../../../types/drf';
import type { RaceScoringResult } from '../../../types/scoring';

// ============================================================================
// MOCK DATA BUILDERS
// ============================================================================

function createMockRace(
  horses: Array<{ programNumber: number; name: string; runningStyle: string; mlOdds: string }>
): ParsedRace {
  return {
    header: {
      raceNumber: 1,
      trackName: 'Test Track',
      trackCode: 'TST',
      distance: '6 Furlongs',
      surface: 'dirt',
      trackCondition: 'fast',
      classification: 'maiden-claiming',
      purseFormatted: '$25,000',
      purse: 25000,
      condition: 'fast',
      date: '2024-01-01',
      postTime: '1:00 PM',
      raceType: 'MCL',
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
      daysSinceLastRace: 30,
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

/**
 * Create default empty trainer patterns for AI
 */
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

function createMockScoringResult(
  horses: Array<{
    programNumber: number;
    name: string;
    rank: number;
    score: number;
    tier: string;
    mlOdds?: string;
  }>
): RaceScoringResult {
  return {
    scores: horses.map((h) => ({
      programNumber: h.programNumber,
      horseName: h.name,
      rank: h.rank,
      finalScore: h.score,
      confidenceTier: h.tier as 'high' | 'medium' | 'low',
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
      morningLineOdds: h.mlOdds || '5-1',
      morningLineDecimal: parseFloat((h.mlOdds || '5-1').replace('-', '.')) || 5.0,
    })),
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
// TEST SCENARIOS FROM REQUIREMENTS
// ============================================================================

describe('Expansion/Contraction Model Test Scenarios', () => {
  describe('Scenario A - No Signals', () => {
    it('should use algorithm top 4 as BOX with no AI modifications', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '8-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '10-1' },
        { programNumber: 5, name: 'Horse E', runningStyle: 'C', mlOdds: '15-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 160, tier: 'medium' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 140, tier: 'medium' },
        { programNumber: 5, name: 'Horse E', rank: 5, score: 120, tier: 'low' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // topPick = algorithm #1
      expect(result.topPick).toBe(1);

      // betConstruction should have BOX with algorithm top 4
      expect(result.betConstruction).toBeDefined();
      expect(result.betConstruction?.algorithmTop4).toEqual([1, 2, 3, 4]);
      expect(result.betConstruction?.expansionHorses).toEqual([]);
      expect(result.betConstruction?.contractionTarget).toBeNull();

      // Exacta strategy should be BOX [1,2,3,4]
      expect(result.betConstruction?.exactaStrategy.type).toBe('BOX');
      expect(result.betConstruction?.exactaStrategy.includeHorses).toEqual([1, 2, 3, 4]);

      // Trifecta strategy: A:[1,2,3] B:[4,5]
      expect(result.betConstruction?.trifectaStrategy.aHorses).toEqual([1, 2, 3]);
      expect(result.betConstruction?.trifectaStrategy.bHorses).toEqual([4, 5]);
    });
  });

  describe('Scenario B - Vulnerable Favorite Only', () => {
    it('should set contractionTarget and KEY #2 strategy when favorite is vulnerable with HIGH + 2 flags', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Vulnerable Fav', runningStyle: 'E', mlOdds: '1-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '8-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '10-1' },
        { programNumber: 5, name: 'Horse E', runningStyle: 'C', mlOdds: '15-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Vulnerable Fav', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 160, tier: 'medium' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 140, tier: 'medium' },
        { programNumber: 5, name: 'Horse E', rank: 5, score: 120, tier: 'low' },
      ]);

      // Vulnerable favorite with HIGH confidence and 2+ flags
      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: {
          isVulnerable: true,
          reasons: ['Class rise from claiming to allowance', 'Pace setup unfavorable'],
          confidence: 'HIGH',
        },
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // contractionTarget = #1
      expect(result.betConstruction?.contractionTarget).toBe(1);
      expect(result.betConstruction?.vulnerableFavoriteDetected).toBe(true);

      // topPick = algorithm #2 (due to vulnerable favorite)
      expect(result.topPick).toBe(2);

      // Exacta strategy: KEY #2 over [3,4,5]
      expect(result.betConstruction?.exactaStrategy.type).toBe('KEY');
      expect(result.betConstruction?.exactaStrategy.keyHorse).toBe(2);
      expect(result.betConstruction?.exactaStrategy.includeHorses).toEqual([3, 4]);
    });
  });

  describe('Scenario C - Sleeper Only', () => {
    it('should identify expansion horse and BOX [1,2,3,4,7] when sleeper found', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '3-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '6-1' },
        { programNumber: 5, name: 'Horse E', runningStyle: 'C', mlOdds: '10-1' },
        { programNumber: 6, name: 'Horse F', runningStyle: 'E', mlOdds: '12-1' },
        { programNumber: 7, name: 'Sleeper', runningStyle: 'E', mlOdds: '8-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 190, tier: 'high', mlOdds: '3-1' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 180, tier: 'medium', mlOdds: '5-1' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 170, tier: 'medium', mlOdds: '6-1' },
        { programNumber: 5, name: 'Horse E', rank: 5, score: 160, tier: 'medium', mlOdds: '10-1' },
        { programNumber: 6, name: 'Horse F', rank: 6, score: 150, tier: 'low', mlOdds: '12-1' },
        { programNumber: 7, name: 'Sleeper', rank: 7, score: 140, tier: 'low', mlOdds: '8-1' },
      ]);

      // Horse #7 (rank 7) has Trip Trouble HIGH with odds >= 4-1
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 7,
              horseName: 'Sleeper',
              issue: 'Blocked in last 2 races - consecutive troubled trips',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // expansionHorses = [7]
      expect(result.betConstruction?.expansionHorses).toContain(7);
      expect(result.betConstruction?.sleeperIdentified).toBe(true);

      // valuePlay = #7
      expect(result.valuePlay).toBe(7);

      // Exacta strategy: BOX top 4 + expansion (max 5)
      expect(result.betConstruction?.exactaStrategy.type).toBe('BOX');
      expect(result.betConstruction?.exactaStrategy.includeHorses).toContain(7);
      expect(result.betConstruction?.exactaStrategy.includeHorses.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Scenario D - Both Signals (Contraction + Expansion)', () => {
    it('should set contractionTarget and expansionHorses for PART_WHEEL strategy', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Vulnerable Fav', runningStyle: 'E', mlOdds: '1-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '4-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '6-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '8-1' },
        { programNumber: 5, name: 'Horse E', runningStyle: 'C', mlOdds: '10-1' },
        { programNumber: 6, name: 'Sleeper', runningStyle: 'E', mlOdds: '6-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Vulnerable Fav', rank: 1, score: 200, tier: 'high', mlOdds: '1-1' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high', mlOdds: '4-1' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 160, tier: 'medium', mlOdds: '6-1' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 140, tier: 'medium', mlOdds: '8-1' },
        { programNumber: 5, name: 'Horse E', rank: 5, score: 120, tier: 'low', mlOdds: '10-1' },
        { programNumber: 6, name: 'Sleeper', rank: 6, score: 110, tier: 'low', mlOdds: '6-1' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 6,
              horseName: 'Sleeper',
              issue: 'Blocked in last 2 races - consecutive troubled trips',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: null,
        vulnerableFavorite: {
          isVulnerable: true,
          reasons: ['Class rise', 'Pace setup unfavorable'],
          confidence: 'HIGH',
        },
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // contractionTarget = #1, expansionHorses = [#6]
      expect(result.betConstruction?.contractionTarget).toBe(1);
      expect(result.betConstruction?.expansionHorses).toContain(6);

      // topPick = #2, valuePlay = #6
      expect(result.topPick).toBe(2);
      expect(result.valuePlay).toBe(6);

      // Exacta strategy: PART_WHEEL #2 over [3,4,6] (top 4 minus vulnerable + expansion)
      expect(result.betConstruction?.exactaStrategy.type).toBe('PART_WHEEL');
      expect(result.betConstruction?.exactaStrategy.keyHorse).toBe(2);
    });
  });
});

// ============================================================================
// UNIT TESTS FOR NEW FUNCTIONS
// ============================================================================

describe('identifyExpansionHorses', () => {
  it('should identify horses ranked 5-10 with Trip Trouble HIGH and odds >= 4-1', () => {
    const signals: AggregatedSignals[] = [
      { programNumber: 1, algorithmRank: 1, tripTroubleBoost: 0, paceAdvantage: 0 } as AggregatedSignals,
      { programNumber: 5, algorithmRank: 5, tripTroubleBoost: 2, paceAdvantage: 0 } as AggregatedSignals,
      { programNumber: 6, algorithmRank: 6, tripTroubleBoost: 2, paceAdvantage: 0 } as AggregatedSignals,
    ];

    const scores = [
      { programNumber: 1, morningLineDecimal: 2.0 },
      { programNumber: 5, morningLineDecimal: 8.0 }, // 8-1, qualifies
      { programNumber: 6, morningLineDecimal: 3.0 }, // 3-1, does NOT qualify (< 4-1)
    ] as RaceScoringResult['scores'];

    const result = identifyExpansionHorses(signals, scores);

    expect(result).toContain(5);
    expect(result).not.toContain(6); // Odds too low
    expect(result).not.toContain(1); // Rank too high
  });

  it('should limit expansion horses to max 2', () => {
    const signals: AggregatedSignals[] = [
      { programNumber: 5, algorithmRank: 5, tripTroubleBoost: 2, paceAdvantage: 0, totalAdjustment: 2 } as AggregatedSignals,
      { programNumber: 6, algorithmRank: 6, tripTroubleBoost: 2, paceAdvantage: 0, totalAdjustment: 2 } as AggregatedSignals,
      { programNumber: 7, algorithmRank: 7, tripTroubleBoost: 2, paceAdvantage: 0, totalAdjustment: 2 } as AggregatedSignals,
    ];

    const scores = [
      { programNumber: 5, morningLineDecimal: 8.0 },
      { programNumber: 6, morningLineDecimal: 10.0 },
      { programNumber: 7, morningLineDecimal: 12.0 },
    ] as RaceScoringResult['scores'];

    const result = identifyExpansionHorses(signals, scores);

    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('should NOT identify horses ranked 1-4 as expansion horses', () => {
    const signals: AggregatedSignals[] = [
      { programNumber: 3, algorithmRank: 3, tripTroubleBoost: 2, paceAdvantage: 0 } as AggregatedSignals,
    ];

    const scores = [{ programNumber: 3, morningLineDecimal: 8.0 }] as RaceScoringResult['scores'];

    const result = identifyExpansionHorses(signals, scores);

    expect(result).not.toContain(3);
  });
});

describe('detectContractionTarget', () => {
  it('should detect vulnerable favorite with HIGH confidence and 2+ flags', () => {
    const signals: AggregatedSignals[] = [
      { programNumber: 1, algorithmRank: 1, isVulnerable: true } as AggregatedSignals,
    ];

    const vulnFav = {
      isVulnerable: true,
      reasons: ['Flag 1', 'Flag 2'],
      confidence: 'HIGH' as const,
    };

    const result = detectContractionTarget(signals, vulnFav);

    expect(result).toBe(1);
  });

  it('should NOT detect vulnerable favorite with only 1 flag', () => {
    const signals: AggregatedSignals[] = [
      { programNumber: 1, algorithmRank: 1, isVulnerable: true } as AggregatedSignals,
    ];

    const vulnFav = {
      isVulnerable: true,
      reasons: ['Only one flag'],
      confidence: 'HIGH' as const,
    };

    const result = detectContractionTarget(signals, vulnFav);

    expect(result).toBeNull();
  });

  it('should NOT detect vulnerable favorite with MEDIUM confidence', () => {
    const signals: AggregatedSignals[] = [
      { programNumber: 1, algorithmRank: 1, isVulnerable: true } as AggregatedSignals,
    ];

    const vulnFav = {
      isVulnerable: true,
      reasons: ['Flag 1', 'Flag 2'],
      confidence: 'MEDIUM' as const,
    };

    const result = detectContractionTarget(signals, vulnFav);

    expect(result).toBeNull();
  });
});

describe('determineExactaStrategy', () => {
  it('should return BOX when no contraction or expansion', () => {
    const result = determineExactaStrategy([1, 2, 3, 4], [], null);

    expect(result.type).toBe('BOX');
    expect(result.keyHorse).toBeNull();
    expect(result.includeHorses).toEqual([1, 2, 3, 4]);
  });

  it('should return KEY when contraction only', () => {
    const result = determineExactaStrategy([1, 2, 3, 4], [], 1);

    expect(result.type).toBe('KEY');
    expect(result.keyHorse).toBe(2); // Algorithm #2
    expect(result.includeHorses).toEqual([3, 4]); // Algorithm #3-5
    expect(result.excludeFromTop).toBe(1);
  });

  it('should return BOX with expansion when expansion only', () => {
    const result = determineExactaStrategy([1, 2, 3, 4], [7], null);

    expect(result.type).toBe('BOX');
    expect(result.includeHorses).toContain(7);
    expect(result.includeHorses.length).toBeLessThanOrEqual(5);
  });

  it('should return PART_WHEEL when both contraction and expansion', () => {
    const result = determineExactaStrategy([1, 2, 3, 4], [6], 1);

    expect(result.type).toBe('PART_WHEEL');
    expect(result.keyHorse).toBe(2);
    expect(result.includeHorses).toContain(6);
    expect(result.includeHorses).not.toContain(1); // Excluded
    expect(result.excludeFromTop).toBe(1);
  });
});

describe('determineTrifectaStrategy', () => {
  it('should return A:[1,2,3] B:[4,5] when no signals', () => {
    const result = determineTrifectaStrategy([1, 2, 3, 4], [1, 2, 3, 4, 5], [], null);

    expect(result.aHorses).toEqual([1, 2, 3]);
    expect(result.bHorses).toEqual([4, 5]);
  });

  it('should exclude vulnerable favorite from A horses when contraction', () => {
    const result = determineTrifectaStrategy([1, 2, 3, 4], [1, 2, 3, 4, 5], [], 1);

    expect(result.aHorses).toEqual([2, 3]); // #1 excluded
    expect(result.excludeFromTop).toBe(1);
  });

  it('should add expansion horses to B horses', () => {
    const result = determineTrifectaStrategy([1, 2, 3, 4], [1, 2, 3, 4, 5], [6, 7], null);

    expect(result.bHorses).toContain(6);
    expect(result.bHorses).toContain(7);
  });
});

// ============================================================================
// LEGACY BEHAVIOR TESTS (updated for new model)
// ============================================================================

describe('combineMultiBotResults', () => {
  describe('Algorithm Ranks are SACRED', () => {
    it('should use algorithm rank for projectedFinish (not adjusted rank)', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '8-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 160, tier: 'medium' },
      ]);

      // Even with trip trouble, algorithm ranks should NOT change
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 3,
              horseName: 'Horse C',
              issue: 'Blocked in last 2 races',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Horse A still has projectedFinish = 1 (algorithm rank)
      const horseA = result.horseInsights.find((h) => h.programNumber === 1);
      expect(horseA?.projectedFinish).toBe(1);

      // Horse C still has projectedFinish = 3 (algorithm rank), even with trip trouble
      const horseC = result.horseInsights.find((h) => h.programNumber === 3);
      expect(horseC?.projectedFinish).toBe(3);
    });
  });

  describe('Vulnerable Favorite Integration', () => {
    it('should set topPick to algorithm #2 when vulnerable favorite HIGH + 2 flags', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Favorite', runningStyle: 'E', mlOdds: '1-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'C', mlOdds: '8-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Favorite', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 160, tier: 'medium' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: {
          isVulnerable: true,
          reasons: ['Class rise', 'Pace setup unfavorable'],
          confidence: 'HIGH',
        },
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // topPick = #2 (algorithm #2 because favorite is vulnerable)
      expect(result.topPick).toBe(2);
      expect(result.vulnerableFavorite).toBe(true);
    });

    it('should keep topPick as algorithm #1 when vulnerable favorite only has 1 flag', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Favorite', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Favorite', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: {
          isVulnerable: true,
          reasons: ['Only one flag'],
          confidence: 'HIGH',
        },
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // topPick = #1 (only 1 flag, not enough for contraction)
      expect(result.topPick).toBe(1);
    });
  });

  describe('Value Play is Expansion Horse', () => {
    it('should set valuePlay to first expansion horse', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '3-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '4-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '5-1' },
        { programNumber: 5, name: 'Sleeper', runningStyle: 'E', mlOdds: '8-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high', mlOdds: '3-1' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 160, tier: 'medium', mlOdds: '4-1' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 140, tier: 'medium', mlOdds: '5-1' },
        { programNumber: 5, name: 'Sleeper', rank: 5, score: 120, tier: 'low', mlOdds: '8-1' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 5,
              horseName: 'Sleeper',
              issue: 'Blocked in last 2 races',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // valuePlay = #5 (expansion horse)
      expect(result.valuePlay).toBe(5);
    });

    it('should set valuePlay to null when no expansion horses', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      expect(result.valuePlay).toBeNull();
    });
  });

  describe('Narrative Generation', () => {
    it('should generate CONFIRM narrative when algorithm is supported', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Top Horse', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Top Horse', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 160, tier: 'medium' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      expect(result.raceNarrative).toContain('CONFIRM');
    });

    it('should generate CONTRACT narrative when vulnerable favorite detected', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Vulnerable', runningStyle: 'E', mlOdds: '1-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Vulnerable', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: {
          isVulnerable: true,
          reasons: ['Flag 1', 'Flag 2'],
          confidence: 'HIGH',
        },
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      expect(result.raceNarrative).toContain('CONTRACT');
    });

    it('should generate EXPAND narrative when sleeper identified', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '3-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '4-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '5-1' },
        { programNumber: 5, name: 'Sleeper', runningStyle: 'E', mlOdds: '8-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high', mlOdds: '3-1' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 160, tier: 'medium', mlOdds: '4-1' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 140, tier: 'medium', mlOdds: '5-1' },
        { programNumber: 5, name: 'Sleeper', rank: 5, score: 120, tier: 'low', mlOdds: '8-1' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 5,
              horseName: 'Sleeper',
              issue: 'Blocked in last 2 races',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      expect(result.raceNarrative).toContain('EXPAND');
    });
  });

  describe('BetConstruction Output', () => {
    it('should include betConstruction in result', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      expect(result.betConstruction).toBeDefined();
      expect(result.betConstruction?.algorithmTop4).toBeDefined();
      expect(result.betConstruction?.exactaStrategy).toBeDefined();
      expect(result.betConstruction?.trifectaStrategy).toBeDefined();
      expect(result.betConstruction?.signalSummary).toBeDefined();
    });
  });
});
