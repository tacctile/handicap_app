/**
 * Unit tests for combineMultiBotResults function
 *
 * Tests the THREE-TEMPLATE TICKET CONSTRUCTION SYSTEM:
 * - Template A (Solid Favorite): Key #1 in win position
 * - Template B (Vulnerable Favorite): Demote #1 to place, key #2
 * - Template C (Wide Open/Chaos): Full box top 4-5
 *
 * Algorithm top 4 are SACRED — never demoted by AI
 */

import { describe, it, expect } from 'vitest';
import {
  combineMultiBotResults,
  selectTemplate,
  buildExactaTicket,
  buildTrifectaTicket,
  calculateExactaCombinations,
  calculateTrifectaCombinations,
  calculateConfidenceScore,
  deriveRaceType,
  determineFavoriteStatus,
  // Legacy functions (deprecated)
  identifyExpansionHorses,
  detectContractionTarget,
} from '../index';
import type {
  MultiBotRawResults,
  AggregatedSignals,
  VulnerableFavoriteAnalysis,
  FieldSpreadAnalysis,
  ValueHorseIdentification,
} from '../types';
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
// THREE-TEMPLATE SYSTEM TEST SCENARIOS
// ============================================================================

describe('Three-Template Ticket Construction System', () => {
  describe('Scenario A - Solid Favorite WITHOUT Value Horse (PASS → MINIMAL)', () => {
    it('should select PASS template when favorite is NOT vulnerable and NO value horse identified', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Solid Fav', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '8-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '10-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Solid Fav', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 160, tier: 'medium' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 140, tier: 'medium' },
      ]);

      // Vulnerable Favorite bot returns NOT vulnerable, no other value signals
      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: {
          isVulnerable: false,
          reasons: [],
          confidence: 'LOW',
        },
        fieldSpread: {
          fieldType: 'SEPARATED',
          topTierCount: 2,
          recommendedSpread: 'NARROW',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // NEW: PASS template selected (routes to MINIMAL tier)
      // "Solid favorite" = "Market is right" = No value edge
      expect(result.ticketConstruction?.template).toBe('PASS');
      expect(result.ticketConstruction?.templateReason).toContain('no identified value horse');

      // PASS template = empty tickets (algorithm picks only)
      expect(result.ticketConstruction?.exacta.winPosition).toEqual([]);
      expect(result.ticketConstruction?.exacta.combinations).toBe(0);
      expect(result.ticketConstruction?.exacta.estimatedCost).toBe(0);

      expect(result.ticketConstruction?.trifecta.winPosition).toEqual([]);
      expect(result.ticketConstruction?.trifecta.combinations).toBe(0);
      expect(result.ticketConstruction?.trifecta.estimatedCost).toBe(0);

      // topPick = rank 1 (algorithm pick still shown)
      expect(result.topPick).toBe(1);

      // Confidence should be MINIMAL
      expect(result.confidence).toBe('MINIMAL');

      // Not bettable (MINIMAL tier)
      expect(result.bettableRace).toBe(false);
    });
  });

  describe('Scenario B - Vulnerable Favorite (Template B)', () => {
    it('should select Template B when favorite is vulnerable with HIGH confidence', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Vulnerable Fav', runningStyle: 'E', mlOdds: '1-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '8-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '10-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Vulnerable Fav', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 160, tier: 'medium' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 140, tier: 'medium' },
      ]);

      // Vulnerable Favorite bot returns vulnerable with HIGH confidence
      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: {
          isVulnerable: true,
          reasons: ['Class rise from claiming to allowance', 'Pace setup unfavorable'],
          confidence: 'HIGH',
        },
        fieldSpread: {
          fieldType: 'COMPETITIVE',
          topTierCount: 3,
          recommendedSpread: 'MEDIUM',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Template B selected
      expect(result.ticketConstruction?.template).toBe('B');
      expect(result.ticketConstruction?.templateReason).toContain('Vulnerable favorite');

      // Exacta: 2,3,4 WITH 1,2,3,4 (9 combinations, $18)
      expect(result.ticketConstruction?.exacta.winPosition).toEqual([2, 3, 4]);
      expect(result.ticketConstruction?.exacta.placePosition).toEqual([1, 2, 3, 4]);
      expect(result.ticketConstruction?.exacta.combinations).toBe(9);
      expect(result.ticketConstruction?.exacta.estimatedCost).toBe(18);

      // Trifecta: 2,3,4 WITH 1,2,3,4 WITH 1,2,3,4 (18 combinations, $18)
      expect(result.ticketConstruction?.trifecta.winPosition).toEqual([2, 3, 4]);
      expect(result.ticketConstruction?.trifecta.placePosition).toEqual([1, 2, 3, 4]);
      expect(result.ticketConstruction?.trifecta.showPosition).toEqual([1, 2, 3, 4]);
      expect(result.ticketConstruction?.trifecta.combinations).toBe(18);
      expect(result.ticketConstruction?.trifecta.estimatedCost).toBe(18);

      // topPick = rank 2 (favorite demoted)
      expect(result.topPick).toBe(2);
    });
  });

  describe('Scenario C - Wide Open (Template C)', () => {
    it('should select Template C when field is WIDE_OPEN regardless of favorite status', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '4-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '6-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '7-1' },
        { programNumber: 5, name: 'Horse E', runningStyle: 'C', mlOdds: '8-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 170, tier: 'medium' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 168, tier: 'medium' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 165, tier: 'medium' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 162, tier: 'medium' },
        { programNumber: 5, name: 'Horse E', rank: 5, score: 160, tier: 'medium' },
      ]);

      // Field Spread returns WIDE_OPEN
      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: {
          fieldType: 'WIDE_OPEN',
          topTierCount: 5,
          recommendedSpread: 'WIDE',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Template C selected (WIDE_OPEN overrides everything)
      expect(result.ticketConstruction?.template).toBe('C');
      expect(result.ticketConstruction?.templateReason).toContain('Wide open');

      // Exacta: Box 1,2,3,4 (12 combinations, $24)
      expect(result.ticketConstruction?.exacta.winPosition).toEqual([1, 2, 3, 4]);
      expect(result.ticketConstruction?.exacta.placePosition).toEqual([1, 2, 3, 4]);
      expect(result.ticketConstruction?.exacta.combinations).toBe(12);
      expect(result.ticketConstruction?.exacta.estimatedCost).toBe(24);

      // Trifecta: Box 1,2,3,4,5 (60 combinations, $60)
      expect(result.ticketConstruction?.trifecta.winPosition).toEqual([1, 2, 3, 4, 5]);
      expect(result.ticketConstruction?.trifecta.placePosition).toEqual([1, 2, 3, 4, 5]);
      expect(result.ticketConstruction?.trifecta.showPosition).toEqual([1, 2, 3, 4, 5]);
      expect(result.ticketConstruction?.trifecta.combinations).toBe(60);
      expect(result.ticketConstruction?.trifecta.estimatedCost).toBe(60);

      // topPick = rank 1 (even in chaos, algorithm #1 is the pick)
      expect(result.topPick).toBe(1);
    });
  });
});

// ============================================================================
// UNIT TESTS FOR TEMPLATE FUNCTIONS
// ============================================================================

describe('selectTemplate', () => {
  // Helper to create a value horse identification object
  const createValueHorse = (
    identified: boolean,
    programNumber?: number
  ): ValueHorseIdentification => ({
    identified,
    programNumber: programNumber ?? null,
    horseName: identified ? 'Value Horse' : null,
    sources: identified ? ['TRIP_TROUBLE'] : [],
    signalStrength: identified ? 'STRONG' : 'NONE',
    angle: identified ? 'Trip trouble - hidden ability' : null,
    valueOdds: null,
    botConvergenceCount: identified ? 1 : 0,
    reasoning: identified ? 'Value horse detected' : 'No value horse',
  });

  it('should return Template C for WIDE_OPEN regardless of favorite status', () => {
    const [template, reason] = selectTemplate('WIDE_OPEN', 'SOLID', null);
    expect(template).toBe('C');
    expect(reason).toContain('Wide open');
  });

  it('should return Template B for VULNERABLE favorite with HIGH/MEDIUM confidence', () => {
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['Flag 1', 'Flag 2'],
      confidence: 'HIGH',
    };
    const [template, reason] = selectTemplate('COMPETITIVE', 'VULNERABLE', vulnFav);
    expect(template).toBe('B');
    expect(reason).toContain('Vulnerable favorite');
  });

  it('should return PASS for SOLID favorite without value horse identified', () => {
    // NEW BEHAVIOR: SOLID favorite without value horse routes to MINIMAL tier (PASS template)
    const [template, reason] = selectTemplate('CHALK', 'SOLID', null, createValueHorse(false));
    expect(template).toBe('PASS');
    expect(reason).toContain('no identified value horse');
  });

  it('should return Template A for SOLID favorite WITH value horse identified', () => {
    // When value horse is identified, SOLID favorite can still get Template A
    const [template, reason] = selectTemplate('CHALK', 'SOLID', null, createValueHorse(true, 3));
    expect(template).toBe('A');
    expect(reason).toContain('value horse');
  });

  it('should prioritize WIDE_OPEN over VULNERABLE favorite', () => {
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['Flag 1', 'Flag 2'],
      confidence: 'HIGH',
    };
    const [template] = selectTemplate('WIDE_OPEN', 'VULNERABLE', vulnFav);
    expect(template).toBe('C'); // WIDE_OPEN takes precedence
  });
});

describe('buildExactaTicket', () => {
  const algorithmTop4 = [1, 2, 3, 4];

  it('should build Template A exacta: 1 WITH 2,3,4', () => {
    const result = buildExactaTicket('A', algorithmTop4);
    expect(result.winPosition).toEqual([1]);
    expect(result.placePosition).toEqual([2, 3, 4]);
    expect(result.combinations).toBe(3);
    expect(result.estimatedCost).toBe(6);
  });

  it('should build Template B exacta: 2,3,4 WITH 1,2,3,4', () => {
    const result = buildExactaTicket('B', algorithmTop4);
    expect(result.winPosition).toEqual([2, 3, 4]);
    expect(result.placePosition).toEqual([1, 2, 3, 4]);
    expect(result.combinations).toBe(9);
    expect(result.estimatedCost).toBe(18);
  });

  it('should build Template C exacta: Box 1,2,3,4', () => {
    const result = buildExactaTicket('C', algorithmTop4);
    expect(result.winPosition).toEqual([1, 2, 3, 4]);
    expect(result.placePosition).toEqual([1, 2, 3, 4]);
    expect(result.combinations).toBe(12);
    expect(result.estimatedCost).toBe(24);
  });
});

describe('buildTrifectaTicket', () => {
  const algorithmTop4 = [1, 2, 3, 4];
  const algorithmTop5 = [1, 2, 3, 4, 5];

  it('should build Template A trifecta: 1 WITH 2,3,4 WITH 2,3,4', () => {
    const result = buildTrifectaTicket('A', algorithmTop4, algorithmTop5);
    expect(result.winPosition).toEqual([1]);
    expect(result.placePosition).toEqual([2, 3, 4]);
    expect(result.showPosition).toEqual([2, 3, 4]);
    expect(result.combinations).toBe(6);
    expect(result.estimatedCost).toBe(6);
  });

  it('should build Template B trifecta: 2,3,4 WITH 1,2,3,4 WITH 1,2,3,4', () => {
    const result = buildTrifectaTicket('B', algorithmTop4, algorithmTop5);
    expect(result.winPosition).toEqual([2, 3, 4]);
    expect(result.placePosition).toEqual([1, 2, 3, 4]);
    expect(result.showPosition).toEqual([1, 2, 3, 4]);
    expect(result.combinations).toBe(18);
    expect(result.estimatedCost).toBe(18);
  });

  it('should build Template C trifecta: Box 1,2,3,4,5', () => {
    const result = buildTrifectaTicket('C', algorithmTop4, algorithmTop5);
    expect(result.winPosition).toEqual([1, 2, 3, 4, 5]);
    expect(result.placePosition).toEqual([1, 2, 3, 4, 5]);
    expect(result.showPosition).toEqual([1, 2, 3, 4, 5]);
    expect(result.combinations).toBe(60);
    expect(result.estimatedCost).toBe(60);
  });
});

describe('calculateExactaCombinations', () => {
  it('should calculate correct combinations for key bet', () => {
    // 1 WITH 2,3,4 = 3 combinations
    expect(calculateExactaCombinations([1], [2, 3, 4])).toBe(3);
  });

  it('should exclude same-horse combinations for box', () => {
    // Box 1,2,3,4 = 4*4 - 4 = 12 combinations
    expect(calculateExactaCombinations([1, 2, 3, 4], [1, 2, 3, 4])).toBe(12);
  });

  it('should handle partial overlap', () => {
    // 2,3,4 WITH 1,2,3,4 = 3*4 - 3 = 9 combinations
    expect(calculateExactaCombinations([2, 3, 4], [1, 2, 3, 4])).toBe(9);
  });
});

describe('calculateTrifectaCombinations', () => {
  it('should calculate correct combinations for key bet', () => {
    // 1 WITH 2,3,4 WITH 2,3,4 = 1*3*2 = 6 combinations
    expect(calculateTrifectaCombinations([1], [2, 3, 4], [2, 3, 4])).toBe(6);
  });

  it('should calculate correct combinations for full box', () => {
    // Box 1,2,3,4,5 = 5*4*3 = 60 combinations
    expect(calculateTrifectaCombinations([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBe(
      60
    );
  });

  it('should handle Template B structure', () => {
    // 2,3,4 WITH 1,2,3,4 WITH 1,2,3,4 = 18 combinations
    expect(calculateTrifectaCombinations([2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4])).toBe(18);
  });
});

// NOTE: calculateConfidenceScore has been rewired to use value-based logic.
// The new behavior is tested in confidenceTier.test.ts.
// These tests are for the OLD scoring formula and are now skipped.
describe.skip('calculateConfidenceScore (OLD FORMULA - DEPRECATED)', () => {
  // Base signals with algorithm scores for margin testing
  const baseSignals: AggregatedSignals[] = [
    {
      programNumber: 1,
      algorithmRank: 1,
      algorithmScore: 200,
      tripTroubleFlagged: false,
      paceAdvantageFlagged: false,
    } as AggregatedSignals,
    {
      programNumber: 2,
      algorithmRank: 2,
      algorithmScore: 195,
      tripTroubleFlagged: false,
      paceAdvantageFlagged: false,
    } as AggregatedSignals,
    {
      programNumber: 3,
      algorithmRank: 3,
      algorithmScore: 190,
      tripTroubleFlagged: false,
      paceAdvantageFlagged: false,
    } as AggregatedSignals,
    {
      programNumber: 4,
      algorithmRank: 4,
      algorithmScore: 185,
      tripTroubleFlagged: false,
      paceAdvantageFlagged: false,
    } as AggregatedSignals,
  ];

  // ============================================================================
  // BASE SCORE TESTS
  // ============================================================================

  it('should start with base of 65 for COMPETITIVE with no signals', () => {
    // Base 65 + Bot Agreement (3/4 = +10) = 75
    // (4 positives: no trip trouble on rank 1, NO pace advantage, solid favorite, COMPETITIVE race type)
    // Actually only 3: no trip trouble, solid favorite, competitive. No pace advantage means NOT flagged.
    const score = calculateConfidenceScore('COMPETITIVE', null, baseSignals);
    // Base 65, no penalties, 3/4 agreement (no trip trouble, solid favorite, competitive) = +10
    // Clean favorite bonus: solid, competitive, no trip/pace on 2-4 = +10
    expect(score).toBe(85); // 65 + 10 (3/4 agreement) + 10 (clean favorite)
  });

  // ============================================================================
  // PENALTY TESTS
  // ============================================================================

  it('should apply -10 penalty for CHALK race type', () => {
    // CHALK is -10, but counts as positive for field spread (3/4 agreement total)
    // No pace advantage on rank 1, so only 3/4 agreement
    // Base 65 - 10 (CHALK) + 10 (3/4 agreement) + 10 (clean favorite) = 75
    const score = calculateConfidenceScore('CHALK', null, baseSignals);
    expect(score).toBe(75); // 65 - 10 + 10 + 10
  });

  it('should apply -15 penalty for WIDE_OPEN race type', () => {
    // Base 65 - 15 (WIDE_OPEN) + 0 (2/4 agreement) + 0 (no clean bonus) = 50
    const score = calculateConfidenceScore('WIDE_OPEN', null, baseSignals);
    expect(score).toBe(50); // 65 - 15 + 0 + 0
  });

  it('should apply -15 penalty for vulnerable favorite with 3+ flags', () => {
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['Flag 1', 'Flag 2', 'Flag 3'],
      confidence: 'HIGH',
    };
    // Base 65 - 15 (vulnerable) + 0 (2/4 agreement) + 0 (no clean bonus) = 50
    const score = calculateConfidenceScore('COMPETITIVE', vulnFav, baseSignals);
    expect(score).toBe(50); // 65 - 15 + 0 + 0
  });

  it('should apply -15 penalty for vulnerable favorite with 2 flags and HIGH confidence', () => {
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['Flag 1', 'Flag 2'],
      confidence: 'HIGH',
    };
    const score = calculateConfidenceScore('COMPETITIVE', vulnFav, baseSignals);
    expect(score).toBe(50); // 65 - 15 + 0 + 0
  });

  it('should NOT apply penalty for vulnerable favorite with 2 flags and MEDIUM confidence', () => {
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['Flag 1', 'Flag 2'],
      confidence: 'MEDIUM',
    };
    // Still isVulnerable = true, so bot agreement only gets 2/4 (no solid favorite, no WIDE_OPEN bonus)
    // Base 65 + 0 (2/4 agreement) + 0 (no clean - vulnerable) = 65
    const score = calculateConfidenceScore('COMPETITIVE', vulnFav, baseSignals);
    expect(score).toBe(65); // 65 + 0 + 0 (no penalty but also no bonuses due to vulnerable)
  });

  it('should apply -5 per trip trouble signal on rank 2-4 (max -15)', () => {
    const signalsWithTrip: AggregatedSignals[] = [
      {
        programNumber: 1,
        algorithmRank: 1,
        algorithmScore: 200,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 2,
        algorithmRank: 2,
        algorithmScore: 195,
        tripTroubleFlagged: true,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 3,
        algorithmRank: 3,
        algorithmScore: 190,
        tripTroubleFlagged: true,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 4,
        algorithmRank: 4,
        algorithmScore: 185,
        tripTroubleFlagged: true,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
    ];
    // Base 65 - 15 (3 trip troubles) + 10 (3/4 agreement) + 0 (no clean - has trip trouble) = 60
    const score = calculateConfidenceScore('COMPETITIVE', null, signalsWithTrip);
    expect(score).toBe(60);
  });

  it('should apply -5 per pace advantage signal on rank 2-4 (max -15)', () => {
    const signalsWithPace: AggregatedSignals[] = [
      {
        programNumber: 1,
        algorithmRank: 1,
        algorithmScore: 200,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 2,
        algorithmRank: 2,
        algorithmScore: 195,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: true,
      } as AggregatedSignals,
      {
        programNumber: 3,
        algorithmRank: 3,
        algorithmScore: 190,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: true,
      } as AggregatedSignals,
      {
        programNumber: 4,
        algorithmRank: 4,
        algorithmScore: 185,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: true,
      } as AggregatedSignals,
    ];
    // Base 65 - 15 (3 pace advantages) + 10 (3/4 agreement) + 0 (no clean - has pace advantage) = 60
    const score = calculateConfidenceScore('COMPETITIVE', null, signalsWithPace);
    expect(score).toBe(60);
  });

  // ============================================================================
  // BOT AGREEMENT BONUS TESTS
  // ============================================================================

  it('should add +20 for 4/4 bot agreement (all positive signals)', () => {
    // 4/4 = no trip trouble on rank 1, pace advantage on rank 1, solid favorite, CHALK/COMPETITIVE
    const signalsWithPaceOnTop: AggregatedSignals[] = [
      {
        programNumber: 1,
        algorithmRank: 1,
        algorithmScore: 200,
        tripTroubleFlagged: false, // positive
        paceAdvantageFlagged: true, // positive
      } as AggregatedSignals,
      {
        programNumber: 2,
        algorithmRank: 2,
        algorithmScore: 195,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 3,
        algorithmRank: 3,
        algorithmScore: 190,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 4,
        algorithmRank: 4,
        algorithmScore: 185,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
    ];
    // Base 65 + 20 (4/4 agreement) + 10 (clean favorite) = 95
    const score = calculateConfidenceScore('COMPETITIVE', null, signalsWithPaceOnTop);
    expect(score).toBe(95);
  });

  it('should add +10 for 3/4 bot agreement', () => {
    // 3/4 = no trip trouble on rank 1, NO pace advantage on rank 1, solid favorite, COMPETITIVE
    // Base 65 + 10 (3/4 agreement) + 10 (clean favorite) = 85
    const score = calculateConfidenceScore('COMPETITIVE', null, baseSignals);
    expect(score).toBe(85);
  });

  it('should add +0 for 2/4 or fewer bot agreement', () => {
    // WIDE_OPEN removes one positive signal (field type), and if vulnerable favorite removes another
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['Flag 1', 'Flag 2', 'Flag 3'],
      confidence: 'HIGH',
    };
    // 2/4 = no trip trouble on rank 1, NO pace advantage on rank 1, VULNERABLE favorite, WIDE_OPEN
    // Base 65 - 15 (vulnerable) - 15 (WIDE_OPEN) + 0 (2/4 agreement) + 0 (no clean) = 35
    const score = calculateConfidenceScore('WIDE_OPEN', vulnFav, baseSignals);
    expect(score).toBe(35);
  });

  // ============================================================================
  // ALGORITHM MARGIN BONUS TESTS
  // ============================================================================

  it('should add +15 for 20+ point margin', () => {
    const signalsWithLargeMargin: AggregatedSignals[] = [
      {
        programNumber: 1,
        algorithmRank: 1,
        algorithmScore: 220,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 2,
        algorithmRank: 2,
        algorithmScore: 195,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 3,
        algorithmRank: 3,
        algorithmScore: 190,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 4,
        algorithmRank: 4,
        algorithmScore: 185,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
    ];
    // Base 65 + 10 (3/4 agreement) + 15 (25pt margin) + 10 (clean favorite) = 100
    const score = calculateConfidenceScore('COMPETITIVE', null, signalsWithLargeMargin);
    expect(score).toBe(100);
  });

  it('should add +10 for 15-19 point margin', () => {
    const signalsWithMediumMargin: AggregatedSignals[] = [
      {
        programNumber: 1,
        algorithmRank: 1,
        algorithmScore: 210,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 2,
        algorithmRank: 2,
        algorithmScore: 195,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 3,
        algorithmRank: 3,
        algorithmScore: 190,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 4,
        algorithmRank: 4,
        algorithmScore: 185,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
    ];
    // Base 65 + 10 (3/4 agreement) + 10 (15pt margin) + 10 (clean favorite) = 95
    const score = calculateConfidenceScore('COMPETITIVE', null, signalsWithMediumMargin);
    expect(score).toBe(95);
  });

  it('should add +5 for 10-14 point margin', () => {
    const signalsWithSmallMargin: AggregatedSignals[] = [
      {
        programNumber: 1,
        algorithmRank: 1,
        algorithmScore: 205,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 2,
        algorithmRank: 2,
        algorithmScore: 195,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 3,
        algorithmRank: 3,
        algorithmScore: 190,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 4,
        algorithmRank: 4,
        algorithmScore: 185,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
    ];
    // Base 65 + 10 (3/4 agreement) + 5 (10pt margin) + 10 (clean favorite) = 90
    const score = calculateConfidenceScore('COMPETITIVE', null, signalsWithSmallMargin);
    expect(score).toBe(90);
  });

  // ============================================================================
  // CLEAN FAVORITE BONUS TESTS
  // ============================================================================

  it('should add +10 for clean favorite (solid, good race type, no danger signals)', () => {
    // Already tested in base case - baseSignals with COMPETITIVE gives +10 clean bonus
    const score = calculateConfidenceScore('COMPETITIVE', null, baseSignals);
    expect(score).toBe(85); // 65 + 10 (agreement) + 10 (clean)
  });

  it('should NOT give clean favorite bonus if favorite is vulnerable', () => {
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['Flag 1', 'Flag 2'],
      confidence: 'MEDIUM',
    };
    // Base 65 + 0 (2/4 agreement) + 0 (no clean - vulnerable) = 65
    const score = calculateConfidenceScore('COMPETITIVE', vulnFav, baseSignals);
    expect(score).toBe(65);
  });

  it('should NOT give clean favorite bonus if race type is WIDE_OPEN', () => {
    // Base 65 - 15 (WIDE_OPEN) + 0 (2/4 agreement) + 0 (no clean) = 50
    const score = calculateConfidenceScore('WIDE_OPEN', null, baseSignals);
    expect(score).toBe(50);
  });

  it('should NOT give clean favorite bonus if trip trouble on rank 2-4', () => {
    const signalsWithTrip: AggregatedSignals[] = [
      {
        programNumber: 1,
        algorithmRank: 1,
        algorithmScore: 200,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 2,
        algorithmRank: 2,
        algorithmScore: 195,
        tripTroubleFlagged: true,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 3,
        algorithmRank: 3,
        algorithmScore: 190,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 4,
        algorithmRank: 4,
        algorithmScore: 185,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
    ];
    // Base 65 - 5 (1 trip trouble) + 10 (3/4 agreement) + 0 (no clean) = 70
    const score = calculateConfidenceScore('COMPETITIVE', null, signalsWithTrip);
    expect(score).toBe(70);
  });

  // ============================================================================
  // SCORE CAPPING TESTS
  // ============================================================================

  it('should cap at 100 when bonuses exceed maximum', () => {
    // Perfect race: 4/4 agreement + 20pt margin + clean favorite
    const perfectSignals: AggregatedSignals[] = [
      {
        programNumber: 1,
        algorithmRank: 1,
        algorithmScore: 220,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: true, // pace advantage on top horse
      } as AggregatedSignals,
      {
        programNumber: 2,
        algorithmRank: 2,
        algorithmScore: 195,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 3,
        algorithmRank: 3,
        algorithmScore: 190,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 4,
        algorithmRank: 4,
        algorithmScore: 185,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
    ];
    // Base 65 + 20 (4/4 agreement) + 15 (25pt margin) + 10 (clean) = 110 -> capped at 100
    const score = calculateConfidenceScore('COMPETITIVE', null, perfectSignals);
    expect(score).toBe(100);
  });

  it('should floor at 0 when penalties exceed minimum', () => {
    // Worst case: WIDE_OPEN + vulnerable + max trip trouble + max pace advantage
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['Flag 1', 'Flag 2', 'Flag 3'],
      confidence: 'HIGH',
    };
    const terribleSignals: AggregatedSignals[] = [
      {
        programNumber: 1,
        algorithmRank: 1,
        algorithmScore: 200,
        tripTroubleFlagged: true, // trip trouble on rank 1 (doesn't cause penalty but prevents clean)
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 2,
        algorithmRank: 2,
        algorithmScore: 195,
        tripTroubleFlagged: true,
        paceAdvantageFlagged: true,
      } as AggregatedSignals,
      {
        programNumber: 3,
        algorithmRank: 3,
        algorithmScore: 190,
        tripTroubleFlagged: true,
        paceAdvantageFlagged: true,
      } as AggregatedSignals,
      {
        programNumber: 4,
        algorithmRank: 4,
        algorithmScore: 185,
        tripTroubleFlagged: true,
        paceAdvantageFlagged: true,
      } as AggregatedSignals,
    ];
    // Base 65 - 15 (vulnerable) - 15 (WIDE_OPEN) - 15 (trip) - 15 (pace) + 0 (1/4 agreement) = 5
    const score = calculateConfidenceScore('WIDE_OPEN', vulnFav, terribleSignals);
    expect(score).toBe(5);
  });

  // ============================================================================
  // INTEGRATION TESTS - EXPECTED SCORE EXAMPLES FROM TASK
  // ============================================================================

  it('should score 100 for perfect race (4/4 agreement, 20+ margin, clean favorite)', () => {
    const perfectSignals: AggregatedSignals[] = [
      {
        programNumber: 1,
        algorithmRank: 1,
        algorithmScore: 220,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: true,
      } as AggregatedSignals,
      {
        programNumber: 2,
        algorithmRank: 2,
        algorithmScore: 195,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 3,
        algorithmRank: 3,
        algorithmScore: 190,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 4,
        algorithmRank: 4,
        algorithmScore: 185,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
    ];
    // 65 + 20 + 15 + 10 = 110 -> 100
    expect(calculateConfidenceScore('COMPETITIVE', null, perfectSignals)).toBe(100);
  });

  it('should score ~85 for good race (3/4 agreement, 15pt margin, no clean bonus)', () => {
    const goodSignals: AggregatedSignals[] = [
      {
        programNumber: 1,
        algorithmRank: 1,
        algorithmScore: 210,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 2,
        algorithmRank: 2,
        algorithmScore: 195,
        tripTroubleFlagged: true, // one trip trouble removes clean bonus
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 3,
        algorithmRank: 3,
        algorithmScore: 190,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 4,
        algorithmRank: 4,
        algorithmScore: 185,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
    ];
    // 65 - 5 (trip) + 10 (3/4) + 10 (margin) + 0 (no clean) = 80
    expect(calculateConfidenceScore('COMPETITIVE', null, goodSignals)).toBe(80);
  });

  it('should score 65 for average race (2/4 agreement, 8pt margin)', () => {
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['Flag 1', 'Flag 2'],
      confidence: 'MEDIUM',
    };
    const avgSignals: AggregatedSignals[] = [
      {
        programNumber: 1,
        algorithmRank: 1,
        algorithmScore: 200,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 2,
        algorithmRank: 2,
        algorithmScore: 192,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 3,
        algorithmRank: 3,
        algorithmScore: 190,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
      {
        programNumber: 4,
        algorithmRank: 4,
        algorithmScore: 185,
        tripTroubleFlagged: false,
        paceAdvantageFlagged: false,
      } as AggregatedSignals,
    ];
    // 65 + 0 (2/4 agreement) + 0 (8pt margin) + 0 (no clean - vulnerable) = 65
    expect(calculateConfidenceScore('COMPETITIVE', vulnFav, avgSignals)).toBe(65);
  });
});

describe('deriveRaceType', () => {
  const mockSignals: AggregatedSignals[] = [
    { programNumber: 1, algorithmRank: 1, algorithmScore: 200 } as AggregatedSignals,
    { programNumber: 2, algorithmRank: 2, algorithmScore: 180 } as AggregatedSignals,
    { programNumber: 3, algorithmRank: 3, algorithmScore: 160 } as AggregatedSignals,
    { programNumber: 4, algorithmRank: 4, algorithmScore: 140 } as AggregatedSignals,
    { programNumber: 5, algorithmRank: 5, algorithmScore: 120 } as AggregatedSignals,
    { programNumber: 6, algorithmRank: 6, algorithmScore: 100 } as AggregatedSignals,
  ];

  it('should return WIDE_OPEN when fieldSpread says WIDE_OPEN', () => {
    const fieldSpread: FieldSpreadAnalysis = {
      fieldType: 'WIDE_OPEN',
      topTierCount: 5,
      recommendedSpread: 'WIDE',
    };
    const result = deriveRaceType(fieldSpread, mockSignals);
    expect(result).toBe('WIDE_OPEN');
  });

  it('should return CHALK when fieldSpread says DOMINANT or SEPARATED', () => {
    const fieldSpread: FieldSpreadAnalysis = {
      fieldType: 'DOMINANT',
      topTierCount: 1,
      recommendedSpread: 'NARROW',
    };
    const result = deriveRaceType(fieldSpread, mockSignals);
    expect(result).toBe('CHALK');
  });

  it('should return COMPETITIVE when fieldSpread says COMPETITIVE or MIXED', () => {
    const fieldSpread: FieldSpreadAnalysis = {
      fieldType: 'COMPETITIVE',
      topTierCount: 3,
      recommendedSpread: 'MEDIUM',
    };
    const result = deriveRaceType(fieldSpread, mockSignals);
    expect(result).toBe('COMPETITIVE');
  });

  it('should derive WIDE_OPEN from score gaps when top 6 within 30 points', () => {
    const tightSignals: AggregatedSignals[] = [
      { programNumber: 1, algorithmRank: 1, algorithmScore: 180 } as AggregatedSignals,
      { programNumber: 2, algorithmRank: 2, algorithmScore: 175 } as AggregatedSignals,
      { programNumber: 3, algorithmRank: 3, algorithmScore: 170 } as AggregatedSignals,
      { programNumber: 4, algorithmRank: 4, algorithmScore: 165 } as AggregatedSignals,
      { programNumber: 5, algorithmRank: 5, algorithmScore: 160 } as AggregatedSignals,
      { programNumber: 6, algorithmRank: 6, algorithmScore: 155 } as AggregatedSignals,
    ];
    const result = deriveRaceType(null, tightSignals);
    expect(result).toBe('WIDE_OPEN');
  });
});

describe('determineFavoriteStatus', () => {
  it('should return SOLID when not vulnerable', () => {
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: false,
      reasons: [],
      confidence: 'LOW',
    };
    const [status, flags] = determineFavoriteStatus(vulnFav);
    expect(status).toBe('SOLID');
    expect(flags).toEqual([]);
  });

  it('should return VULNERABLE when vulnerable with HIGH confidence', () => {
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['Class rise', 'Pace issue'],
      confidence: 'HIGH',
    };
    const [status, flags] = determineFavoriteStatus(vulnFav);
    expect(status).toBe('VULNERABLE');
    expect(flags).toEqual(['Class rise', 'Pace issue']);
  });

  it('should return VULNERABLE when vulnerable with MEDIUM confidence', () => {
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['One concern'],
      confidence: 'MEDIUM',
    };
    const [status, flags] = determineFavoriteStatus(vulnFav);
    expect(status).toBe('VULNERABLE');
    expect(flags).toEqual(['One concern']);
  });

  it('should return SOLID when vulnerable with LOW confidence', () => {
    const vulnFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['Minor concern'],
      confidence: 'LOW',
    };
    const [status, flags] = determineFavoriteStatus(vulnFav);
    expect(status).toBe('SOLID');
    expect(flags).toEqual([]);
  });

  it('should return SOLID when null', () => {
    const [status, flags] = determineFavoriteStatus(null);
    expect(status).toBe('SOLID');
    expect(flags).toEqual([]);
  });
});

// ============================================================================
// DEPRECATED FUNCTION TESTS (backward compatibility)
// ============================================================================

describe('identifyExpansionHorses (DEPRECATED)', () => {
  it('should always return empty array (expansion horses removed)', () => {
    const signals: AggregatedSignals[] = [
      {
        programNumber: 5,
        algorithmRank: 5,
        tripTroubleBoost: 2,
        paceAdvantage: 0,
      } as AggregatedSignals,
    ];
    const scores = [{ programNumber: 5, morningLineDecimal: 8.0 }] as RaceScoringResult['scores'];

    const result = identifyExpansionHorses(signals, scores);
    expect(result).toEqual([]);
  });
});

describe('detectContractionTarget (still functional)', () => {
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
});

// ============================================================================
// INTEGRATION TESTS - combineMultiBotResults OUTPUT
// ============================================================================

describe('combineMultiBotResults Output', () => {
  it('should include ticketConstruction in output', () => {
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

    expect(result.ticketConstruction).toBeDefined();
    expect(result.ticketConstruction?.template).toBeDefined();
    expect(result.ticketConstruction?.exacta).toBeDefined();
    expect(result.ticketConstruction?.trifecta).toBeDefined();
    expect(result.ticketConstruction?.confidenceScore).toBeDefined();
  });

  it('should set valuePlay to null (expansion horses removed)', () => {
    const race = createMockRace([
      { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '2-1' },
      { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
    ]);

    const scoring = createMockScoringResult([
      { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high' },
      { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
    ]);

    const rawResults: MultiBotRawResults = {
      tripTrouble: {
        horsesWithTripTrouble: [
          { programNumber: 2, horseName: 'Horse B', issue: 'Blocked twice', maskedAbility: true },
        ],
      },
      paceScenario: null,
      vulnerableFavorite: null,
      fieldSpread: null,
    };

    const result = combineMultiBotResults(rawResults, race, scoring, 100);

    // valuePlay is always null now (expansion horses removed)
    expect(result.valuePlay).toBeNull();
  });

  it('should include legacy betConstruction for backward compatibility', () => {
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

    // Legacy betConstruction still included
    expect(result.betConstruction).toBeDefined();
    expect(result.betConstruction?.algorithmTop4).toBeDefined();
    expect(result.betConstruction?.expansionHorses).toEqual([]); // Always empty now
  });

  it('should use algorithm rank for projectedFinish', () => {
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

    const rawResults: MultiBotRawResults = {
      tripTrouble: null,
      paceScenario: null,
      vulnerableFavorite: null,
      fieldSpread: null,
    };

    const result = combineMultiBotResults(rawResults, race, scoring, 100);

    // projectedFinish = algorithm rank (SACRED)
    const horse1 = result.horseInsights.find((h) => h.programNumber === 1);
    const horse2 = result.horseInsights.find((h) => h.programNumber === 2);
    const horse3 = result.horseInsights.find((h) => h.programNumber === 3);

    expect(horse1?.projectedFinish).toBe(1);
    expect(horse2?.projectedFinish).toBe(2);
    expect(horse3?.projectedFinish).toBe(3);
  });

  it('should generate template-based narrative', () => {
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

    // Narrative should mention template
    expect(result.raceNarrative).toContain('TEMPLATE');
  });
});
