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
  } as ParsedRace;
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
    },
  };
}

// ============================================================================
// TEST CASES
// ============================================================================

describe('combineMultiBotResults', () => {
  describe('Trip Trouble Bot Integration', () => {
    it('should boost horse with HIGH confidence masked ability by 2 positions', () => {
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

      // Horse E (rank 5) has trip trouble with HIGH confidence (multiple trips)
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 5,
              horseName: 'Horse E',
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

      // Horse E should move from rank 5 to rank 3 (boost of 2)
      const horseE = result.horseInsights.find((h) => h.programNumber === 5);
      expect(horseE?.projectedFinish).toBe(3);
      expect(horseE?.oneLiner).toContain('Trip trouble masked true ability');
    });

    it('should boost horse with MEDIUM confidence masked ability by 1 position', () => {
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

      // Horse C (rank 3) has single trip trouble - MEDIUM confidence
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 3,
              horseName: 'Horse C',
              issue: 'Checked in stretch last race',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: null,
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Horse C should move from rank 3 to rank 2 (boost of 1)
      const horseC = result.horseInsights.find((h) => h.programNumber === 3);
      expect(horseC?.projectedFinish).toBe(2);
      expect(horseC?.oneLiner).toContain('Recent trip trouble');
    });
  });

  describe('Pace Scenario Bot Integration', () => {
    it('should boost horse with advantaged running style by 1 position', () => {
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

      // Closers advantaged due to HOT pace
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

      // Closer should move up, Speed horse should move down
      const closer = result.horseInsights.find((h) => h.programNumber === 3);
      const speedHorse = result.horseInsights.find((h) => h.programNumber === 1);

      expect(closer?.projectedFinish).toBeLessThan(3); // Should have improved
      expect(closer?.keyStrength).toContain('Pace scenario favors');

      expect(speedHorse?.projectedFinish).toBeGreaterThan(1); // Should have dropped
      expect(speedHorse?.keyWeakness).toContain('Pace scenario works against');
    });

    it('should boost lone speed horse by 2 positions', () => {
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
          loneSpeedException: true, // Key flag
          speedDuelLikely: false,
        },
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Lone Speed should become #1
      const loneSpeed = result.horseInsights.find((h) => h.programNumber === 3);
      expect(loneSpeed?.projectedFinish).toBe(1);
      expect(loneSpeed?.keyStrength).toBe('Lone speed - major advantage');

      // AI pick should now be the lone speed horse
      expect(result.topPick).toBe(3);
    });
  });

  describe('Vulnerable Favorite Bot Integration', () => {
    it('should drop vulnerable favorite by 1 position with HIGH confidence', () => {
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

      // Favorite should drop from 1 to 2
      const favorite = result.horseInsights.find((h) => h.programNumber === 1);
      expect(favorite?.projectedFinish).toBe(2);
      expect(favorite?.keyWeakness).toBe('Class rise from claiming to allowance');
      expect(favorite?.valueLabel).toBe('TOO SHORT');

      // Global flag should be set
      expect(result.vulnerableFavorite).toBe(true);
    });

    it('should keep ranking but add weakness with MEDIUM confidence', () => {
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

      // Favorite should stay at 1 but have weakness noted
      const favorite = result.horseInsights.find((h) => h.programNumber === 1);
      expect(favorite?.projectedFinish).toBe(1);
      expect(favorite?.keyWeakness).toBe('Coming off layoff');
    });
  });

  describe('Field Spread Bot Integration', () => {
    it('should set contender count based on NARROW spread', () => {
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

      // Only top 2-3 should be marked as contenders
      const contenders = result.horseInsights.filter((h) => h.isContender);
      expect(contenders.length).toBeLessThanOrEqual(3);
    });

    it('should set contender count based on WIDE spread', () => {
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

      // Top 5-6 should be marked as contenders
      const contenders = result.horseInsights.filter((h) => h.isContender);
      expect(contenders.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Narrative Generation', () => {
    it('should generate OVERRIDE narrative when AI pick differs from algorithm', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Algo Pick', runningStyle: 'S', mlOdds: '2-1' }, // Stalker - not a speed horse
        { programNumber: 2, name: 'AI Pick', runningStyle: 'E', mlOdds: '5-1' }, // Early speed - will be lone speed
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Algo Pick', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'AI Pick', rank: 2, score: 180, tier: 'high' },
      ]);

      // Make AI Pick become #1 via lone speed - AI Pick (#2) is the only E runner
      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: {
          advantagedStyles: ['E'],
          disadvantagedStyles: ['S', 'C'], // Stalker disadvantaged
          paceProjection: 'SLOW',
          loneSpeedException: true,
          speedDuelLikely: false,
        },
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // AI Pick (#2) gets +2 for lone speed, Algo Pick (#1) gets -1 for disadvantaged
      // AI Pick: 2 - 2 = 0 adjusted, Algo Pick: 1 - (-1) = 2 adjusted
      // So AI Pick should now be #1
      expect(result.topPick).toBe(2);
      expect(result.raceNarrative).toContain('OVERRIDE');
      expect(result.raceNarrative).toContain('AI Pick');
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
    it('should identify value play as horse that moved up 2+ positions', () => {
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

      // Value Horse has HIGH confidence trip trouble (moves from 5 to 3)
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

      // Value Horse moved +2 positions but isn't #1, so should be value play
      expect(result.valuePlay).toBe(5);
    });
  });

  describe('Adjustment Caps', () => {
    it('should cap positive adjustments at +3 positions', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Horse A', runningStyle: 'E', mlOdds: '2-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
        { programNumber: 3, name: 'Horse C', runningStyle: 'S', mlOdds: '8-1' },
        { programNumber: 4, name: 'Horse D', runningStyle: 'C', mlOdds: '10-1' },
        { programNumber: 5, name: 'Horse E', runningStyle: 'C', mlOdds: '12-1' },
        { programNumber: 6, name: 'Horse F', runningStyle: 'C', mlOdds: '15-1' },
        { programNumber: 7, name: 'Boosted Horse', runningStyle: 'E', mlOdds: '20-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Horse A', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 190, tier: 'high' },
        { programNumber: 3, name: 'Horse C', rank: 3, score: 180, tier: 'medium' },
        { programNumber: 4, name: 'Horse D', rank: 4, score: 170, tier: 'medium' },
        { programNumber: 5, name: 'Horse E', rank: 5, score: 160, tier: 'medium' },
        { programNumber: 6, name: 'Horse F', rank: 6, score: 150, tier: 'low' },
        { programNumber: 7, name: 'Boosted Horse', rank: 7, score: 140, tier: 'low' },
      ]);

      // Boosted Horse has trip trouble (+2) AND lone speed (+2) = +4, but capped at +3
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 7,
              horseName: 'Boosted Horse',
              issue: 'Blocked in last 2 races',
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

      // Boosted Horse should be at rank 4 (7 - 3 = 4), not rank 3 (7 - 4 = 3)
      const boostedHorse = result.horseInsights.find((h) => h.programNumber === 7);
      expect(boostedHorse?.projectedFinish).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Value Labels', () => {
    it('should assign BEST BET to top pick with positive bot flags', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Best Bet', runningStyle: 'E', mlOdds: '3-1' },
        { programNumber: 2, name: 'Horse B', runningStyle: 'S', mlOdds: '5-1' },
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Best Bet', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Horse B', rank: 2, score: 160, tier: 'medium' },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: null,
        paceScenario: {
          advantagedStyles: ['E'],
          disadvantagedStyles: ['S'],
          paceProjection: 'SLOW',
          loneSpeedException: true,
          speedDuelLikely: false,
        },
        vulnerableFavorite: null,
        fieldSpread: null,
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      const bestBet = result.horseInsights.find((h) => h.programNumber === 1);
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
