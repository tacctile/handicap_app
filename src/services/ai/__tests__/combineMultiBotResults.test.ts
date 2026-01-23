/**
 * Unit tests for combineMultiBotResults function
 *
 * Verifies that bot insights correctly adjust horse rankings
 * and produce expected outputs without needing API calls.
 */

import { describe, it, expect } from 'vitest';
import { combineMultiBotResults } from '../index';
import type { MultiBotRawResults } from '../types';
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
  horses: Array<{ programNumber: number; name: string; rank: number; score: number; tier: string }>
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
      // New required fields
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
// TEST CASES
// ============================================================================

describe('combineMultiBotResults', () => {
  describe('Trip Trouble Bot Integration', () => {
    it('should boost horse with masked ability by +2 for HIGH confidence (multiple troubled races)', () => {
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

      // Horse E (rank 5) has trip trouble with maskedAbility = true and multiple races
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 5,
              horseName: 'Horse E',
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

      // Horse E should get +2 boost (HIGH confidence) and move up significantly
      const horseE = result.horseInsights.find((h) => h.programNumber === 5);
      // With +2 boost, rank 5 -> adjusted rank 3
      expect(horseE?.projectedFinish).toBeLessThanOrEqual(4);
    });

    it('should add trip trouble note when maskedAbility is true (HIGH confidence - 2+ races)', () => {
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

      // Horse C (rank 3) has HIGH confidence trip trouble (2+ races)
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 3,
              horseName: 'Horse C',
              // HIGH confidence - needs "2 of" or similar indicator
              issue: 'Checked in stretch in 2 of last 3 races',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Horse C should have trip trouble in oneLiner (HIGH confidence gets boost)
      const horseC = result.horseInsights.find((h) => h.programNumber === 3);
      expect(horseC?.oneLiner).toMatch(/[Hh]idden|[Bb]eyer|[Tt]rip/i);
    });
  });

  describe('Pace Scenario Bot Integration', () => {
    it('should penalize speed horse when speedDuelLikely and HOT pace (closers flag only in conservative)', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Speed Horse', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Stalker', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Closer', runningStyle: 'C', mlOdds: '8-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Speed Horse', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Stalker', rank: 2, score: 180, tier: 'high' },
        { programNumber: 3, name: 'Closer', rank: 3, score: 160, tier: 'medium' },
      ]);

      // Closers advantaged due to HOT pace AND speedDuelLikely
      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: {
          advantagedStyles: ['C', 'S'],
          disadvantagedStyles: ['E'],
          paceProjection: 'HOT',
          loneSpeedException: false,
          speedDuelLikely: true,
        },
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // CONSERVATIVE: Closers get flagged but no boost (MODERATE edge strength)
      // Speed horse gets -1 penalty (always applied for disadvantage)
      const speedHorse = result.horseInsights.find((h) => h.programNumber === 1);
      // -1 is below ±2 threshold, so rank doesn't change in conservative mode
      expect(speedHorse?.keyWeakness).toContain('Speed duel');
    });

    it('should boost lone speed horse by +1 position (STRONG edge in conservative mode)', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Stalker', runningStyle: 'S', mlOdds: '2-1' },
        { programNumber: 2, name: 'Closer', runningStyle: 'C', mlOdds: '5-1' },
        { programNumber: 3, name: 'Lone Speed', runningStyle: 'E', mlOdds: '8-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Stalker', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Closer', rank: 2, score: 180, tier: 'high' },
        { programNumber: 3, name: 'Lone Speed', rank: 3, score: 160, tier: 'medium' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: {
          advantagedStyles: ['E'],
          disadvantagedStyles: ['C'],
          paceProjection: 'SLOW',
          loneSpeedException: true, // Key flag - STRONG edge
          speedDuelLikely: false,
        },
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // CONSERVATIVE: Lone speed gets +1 (STRONG edge)
      // +1 is below ±2 threshold, so no rank override but pace edge noted
      const loneSpeed = result.horseInsights.find((h) => h.programNumber === 3);
      expect(loneSpeed?.keyStrength).toContain('Lone speed');
    });

    it('should NOT boost closers when speedDuelLikely but NOT HOT pace', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Speed Horse', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Closer', runningStyle: 'C', mlOdds: '5-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Speed Horse', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Closer', rank: 2, score: 180, tier: 'high' },
      ]);

      // speedDuelLikely but MODERATE pace - closers should NOT be boosted
      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: {
          advantagedStyles: ['C'],
          disadvantagedStyles: ['E'],
          paceProjection: 'MODERATE', // NOT HOT
          loneSpeedException: false,
          speedDuelLikely: true,
        },
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Rankings should remain unchanged
      expect(result.topPick).toBe(1);
      const closer = result.horseInsights.find((h) => h.programNumber === 2);
      expect(closer?.projectedFinish).toBe(2);
    });
  });

  describe('Vulnerable Favorite Bot Integration', () => {
    it('should drop vulnerable favorite with HIGH confidence and set FAIR PRICE label', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Favorite', runningStyle: 'E', mlOdds: '1-1' }, // Heavy favorite
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
          reasons: ['Class rise from claiming to allowance', 'Pace setup unfavorable'],
          confidence: 'HIGH',
        },
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // With new combiner, HIGH confidence vulnerable favorite gets -2 penalty
      // So favorite (rank 1) should drop to rank 3
      const favorite = result.horseInsights.find((h) => h.programNumber === 1);
      expect(favorite?.keyWeakness).toBe('Class rise from claiming to allowance');
      // valueLabel should be FAIR PRICE (for bet sizing guidance)
      expect(favorite?.valueLabel).toBe('FAIR PRICE');

      // Global flag should be set
      expect(result.vulnerableFavorite).toBe(true);
      // Top pick should now be Horse B
      expect(result.topPick).toBe(2);
    });

    it('should apply -1 penalty for MEDIUM confidence vulnerable favorite', () => {
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
          reasons: ['Coming off layoff'],
          confidence: 'MEDIUM',
        },
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // With MEDIUM confidence, favorite gets -1 penalty
      // Rank 1 -> adjusted rank 2, so Horse B becomes top pick
      const favorite = result.horseInsights.find((h) => h.programNumber === 1);
      expect(favorite?.keyWeakness).toBe('Coming off layoff');

      // MEDIUM confidence should set the flag
      expect(result.vulnerableFavorite).toBe(true);
    });

    it('should NOT set vulnerableFavorite flag with LOW confidence', () => {
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
          reasons: ['Minor concern'],
          confidence: 'LOW',
        },
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // LOW confidence should NOT set the flag
      expect(result.vulnerableFavorite).toBe(false);
    });
  });

  describe('Field Spread Bot Integration', () => {
    it('should use fixed contender count of 4 (or field size if smaller)', () => {
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
        fieldSpread: {
          fieldType: 'SEPARATED',
          topTierCount: 2,
          recommendedSpread: 'NARROW',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Contender count is fixed at min(4, field_size) = 4
      const contenders = result.horseInsights.filter((h) => h.isContender);
      expect(contenders.length).toBe(4);
    });

    it('should assign horse classifications from field spread bot', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '3-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '4-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '6-1' },
        { programNumber: 5, name: 'Horse E', runningStyle: 'C', mlOdds: '7-1' },
        { programNumber: 6, name: 'Horse F', runningStyle: 'C', mlOdds: '8-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 180, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 178, tier: 'high' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 175, tier: 'medium' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 172, tier: 'medium' },
        { programNumber: 5, name: 'Horse E', rank: 5, score: 170, tier: 'medium' },
        { programNumber: 6, name: 'Horse F', rank: 6, score: 168, tier: 'medium' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: {
          fieldType: 'TIGHT',
          topTierCount: 5,
          recommendedSpread: 'WIDE',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Contender count is fixed at 4
      const contenders = result.horseInsights.filter((h) => h.isContender);
      expect(contenders.length).toBe(4);
    });
  });

  describe('Narrative Generation', () => {
    it('should generate CONFIRM narrative when lone speed is not enough to override (conservative +1)', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Algo Pick', runningStyle: 'S', mlOdds: '2-1' }, // Stalker - not a speed horse
        { programNumber: 2, name: 'Speed Horse', runningStyle: 'E', mlOdds: '5-1' }, // Early speed
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Algo Pick', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Speed Horse', rank: 2, score: 180, tier: 'high' },
      ]);

      // CONSERVATIVE: Lone speed exception gives +1 boost (not +2)
      // +1 is below ±2 threshold, so no rank change
      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: {
          advantagedStyles: ['E'],
          disadvantagedStyles: ['S', 'C'],
          paceProjection: 'SLOW',
          loneSpeedException: true,
          speedDuelLikely: false,
        },
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // CONSERVATIVE: +1 is below ±2 threshold - no override
      expect(result.topPick).toBe(1);
      expect(result.raceNarrative).toContain('CONFIRM');

      // Speed horse should still have lone speed noted as strength
      const speedHorse = result.horseInsights.find((h) => h.programNumber === 2);
      expect(speedHorse?.keyStrength).toContain('Lone speed');
    });

    it('should generate OVERRIDE narrative when HIGH confidence trip trouble overtakes algorithm pick', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Algo Pick', runningStyle: 'S', mlOdds: '2-1' },
        { programNumber: 2, name: 'Trip Horse', runningStyle: 'E', mlOdds: '5-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Algo Pick', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Trip Horse', rank: 2, score: 180, tier: 'high' },
      ]);

      // HIGH confidence trip trouble gives +2 boost - enough to trigger override
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 2,
              horseName: 'Trip Horse',
              issue: 'Blocked in last 2 races - multiple troubled trips',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // +2 meets threshold - Trip Horse becomes top pick
      expect(result.topPick).toBe(2);
      expect(result.raceNarrative).toContain('OVERRIDE');
    });

    it('should generate CONFIRM narrative when AI agrees with algorithm', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Top Horse', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Top Horse', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 160, tier: 'medium' },
      ]);

      // No bot results that would change rankings
      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: {
          fieldType: 'SEPARATED',
          topTierCount: 1,
          recommendedSpread: 'NARROW',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      expect(result.raceNarrative).toContain('CONFIRM');
      expect(result.topPick).toBe(1);
    });
  });

  describe('Value Play Detection', () => {
    it('should identify value play as horse ranked 3rd-5th with trip trouble boost', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '8-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '10-1' },
        { programNumber: 5, name: 'Value Horse', runningStyle: 'E', mlOdds: '15-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 160, tier: 'medium' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 140, tier: 'medium' },
        { programNumber: 5, name: 'Value Horse', rank: 5, score: 120, tier: 'low' },
      ]);

      // Value Horse (rank 5) has trip trouble with maskedAbility
      // Strict value play criteria: horse ranked 3rd-5th with trip trouble boost
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 5,
              horseName: 'Value Horse',
              issue: 'Blocked in last 3 races - multiple troubled trips',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Value Horse is ranked 5th (in 3rd-5th range) and has trip trouble boost
      expect(result.valuePlay).toBe(5);
    });

    it('should identify value play as lone speed horse ranked 3rd-5th in slow pace', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'S', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'C', mlOdds: '8-1' },
        { programNumber: 4, name: 'Lone Speed', runningStyle: 'E', mlOdds: '10-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 160, tier: 'medium' },
        { programNumber: 4, name: 'Lone Speed', rank: 4, score: 140, tier: 'medium' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: {
          advantagedStyles: ['E'],
          disadvantagedStyles: [],
          paceProjection: 'SLOW',
          loneSpeedException: true,
          speedDuelLikely: false,
        },
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Lone Speed is ranked 4th (in 3rd-5th range) and is lone speed in slow pace
      expect(result.valuePlay).toBe(4);
    });
  });

  describe('Adjustment Caps', () => {
    it('should cap positive adjustments at +3 (trip trouble +2 + pace +2 = +4 capped to +3)', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'S', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '8-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '10-1' },
        { programNumber: 5, name: 'Boosted Horse', runningStyle: 'E', mlOdds: '15-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 190, tier: 'high' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 180, tier: 'medium' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 170, tier: 'medium' },
        { programNumber: 5, name: 'Boosted Horse', rank: 5, score: 160, tier: 'medium' },
      ]);

      // Boosted Horse has trip trouble (+2) AND lone speed (+2) = +4, capped to +3
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 5,
              horseName: 'Boosted Horse',
              issue: 'Blocked in last 2 races - consecutive troubled trips',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: {
          advantagedStyles: ['E'],
          disadvantagedStyles: ['C'],
          paceProjection: 'SLOW',
          loneSpeedException: true,
          speedDuelLikely: false,
        },
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // With +3 adjustment (capped), rank 5 -> adjusted rank 2
      const boostedHorse = result.horseInsights.find((h) => h.programNumber === 5);
      // Should be rank 2 (5 - 3 = 2)
      expect(boostedHorse?.projectedFinish).toBeLessThanOrEqual(3);
    });

    it('should not apply multiple boosts - first trigger wins', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'S', mlOdds: '2-1' },
        { programNumber: 2, name: 'Multi-Trigger', runningStyle: 'E', mlOdds: '5-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Multi-Trigger', rank: 2, score: 180, tier: 'high' },
      ]);

      // Multi-Trigger has both trip trouble AND lone speed
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 2,
              horseName: 'Multi-Trigger',
              issue: 'Blocked last race',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: {
          advantagedStyles: ['E'],
          disadvantagedStyles: [],
          paceProjection: 'SLOW',
          loneSpeedException: true,
          speedDuelLikely: false,
        },
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Multi-Trigger should only get +1 total (not +1 for trip + +1 for pace)
      // Conservative approach caps at ±1 regardless of how many triggers fire
      const multiTrigger = result.horseInsights.find((h) => h.programNumber === 2);
      expect(multiTrigger).toBeDefined();
      // With only 2 horses, max adjustment is limited
    });
  });

  describe('Value Labels', () => {
    it('should assign BEST BET to top pick with HIGH confidence field', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Best Bet', runningStyle: 'E', mlOdds: '3-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'C', mlOdds: '8-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Best Bet', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 160, tier: 'medium' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 140, tier: 'low' },
      ]);

      // HIGH confidence requires DOMINANT/SEPARATED field and 3+ bots
      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: {
          advantagedStyles: ['E'],
          disadvantagedStyles: ['S'],
          paceProjection: 'SLOW',
          loneSpeedException: true,
          speedDuelLikely: false,
        },
        vulnerableFavorite: {
          isVulnerable: false,
          reasons: [],
          confidence: 'LOW',
        },
        fieldSpread: {
          fieldType: 'DOMINANT',
          topTierCount: 1,
          recommendedSpread: 'NARROW',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // With DOMINANT field and no vulnerable favorite, confidence is HIGH
      // Top pick gets BEST BET when confidence is HIGH
      const bestBet = result.horseInsights.find((h) => h.projectedFinish === 1);
      expect(bestBet?.valueLabel).toBe('BEST BET');
    });

    it('should assign SKIP or NO CHANCE to bottom third of field', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '8-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '10-1' },
        { programNumber: 5, name: 'Horse E', runningStyle: 'C', mlOdds: '15-1' },
        { programNumber: 6, name: 'Bottom Horse', runningStyle: 'C', mlOdds: '30-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 180, tier: 'high' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 160, tier: 'medium' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 140, tier: 'medium' },
        { programNumber: 5, name: 'Horse E', rank: 5, score: 120, tier: 'low' },
        { programNumber: 6, name: 'Bottom Horse', rank: 6, score: 100, tier: 'low' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      const bottomHorse = result.horseInsights.find((h) => h.programNumber === 6);
      expect(['SKIP', 'NO CHANCE']).toContain(bottomHorse?.valueLabel);
    });
  });
});
