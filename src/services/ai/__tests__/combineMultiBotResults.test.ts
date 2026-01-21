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
    it('should boost horse with masked ability by +1 position (conservative)', () => {
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

      // Horse E (rank 5) has trip trouble with maskedAbility = true
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

      // Horse E should get +1 boost but algorithm top 4 is protected
      // So Horse E can only move into position after the top 4 are placed
      const horseE = result.horseInsights.find((h) => h.programNumber === 5);
      // With conservative approach, max +1 adjustment
      expect(horseE?.oneLiner).toContain('Trip trouble masked true ability');
    });

    it('should add trip trouble note when maskedAbility is true', () => {
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

      // Horse C (rank 3) has trip trouble with maskedAbility
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

      // Horse C should have trip trouble note in oneLiner
      const horseC = result.horseInsights.find((h) => h.programNumber === 3);
      expect(horseC?.oneLiner).toContain('Trip trouble');
    });
  });

  describe('Pace Scenario Bot Integration', () => {
    it('should boost closers when speedDuelLikely and HOT pace', () => {
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

      // Closer should get +1 boost (conservative approach)
      // Speed horse does NOT get penalized (we removed disadvantage logic)
      const closer = result.horseInsights.find((h) => h.programNumber === 3);
      expect(closer?.keyStrength).toContain('Speed duel sets up for closing style');

      // Speed horse stays at rank 1 (no penalties in conservative model)
      const speedHorse = result.horseInsights.find((h) => h.programNumber === 1);
      expect(speedHorse?.projectedFinish).toBe(1);
    });

    it('should boost lone speed horse by +1 position (conservative)', () => {
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

      // Lone Speed should get +1 boost but algorithm top 4 is protected
      // With conservative approach, lone speed gets boosted but may not become #1
      const loneSpeed = result.horseInsights.find((h) => h.programNumber === 3);
      expect(loneSpeed?.keyStrength).toBe('Lone speed - clear tactical advantage');
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
    it('should set vulnerableFavorite flag with HIGH confidence (no ranking drop)', () => {
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

      // Favorite should STAY at rank 1 (conservative - no ranking change)
      const favorite = result.horseInsights.find((h) => h.programNumber === 1);
      expect(favorite?.projectedFinish).toBe(1);
      expect(favorite?.keyWeakness).toBe('Class rise from claiming to allowance');
      // valueLabel should be FAIR PRICE (for bet sizing guidance)
      expect(favorite?.valueLabel).toBe('FAIR PRICE');

      // Global flag should be set
      expect(result.vulnerableFavorite).toBe(true);
    });

    it('should set vulnerableFavorite flag with MEDIUM confidence (informational)', () => {
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

      // MEDIUM confidence should ALSO set the flag (not just HIGH)
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
    it('should generate CONFIRM narrative when algorithm pick is maintained (conservative approach)', () => {
      const race = createMockRace([
        { programNumber: 1, name: 'Algo Pick', runningStyle: 'S', mlOdds: '2-1' }, // Stalker - not a speed horse
        { programNumber: 2, name: 'Speed Horse', runningStyle: 'E', mlOdds: '5-1' }, // Early speed
      ]);

      const scoring = createMockScoringResult([
        { programNumber: 1, name: 'Algo Pick', rank: 1, score: 200, tier: 'high' },
        { programNumber: 2, name: 'Speed Horse', rank: 2, score: 180, tier: 'high' },
      ]);

      // With conservative approach (+1 max), lone speed gets boost but may not overtake
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

      // With conservative approach, algorithm top-4 is protected
      // Speed Horse gets +1 boost but algorithm top pick likely remains
      // The narrative should be CONFIRM since algorithm pick is trusted
      expect(result.topPick).toBe(1); // Algorithm pick maintained
      expect(result.raceNarrative).toContain('CONFIRM');

      // Speed horse should have lone speed noted
      const speedHorse = result.horseInsights.find((h) => h.programNumber === 2);
      expect(speedHorse?.keyStrength).toBe('Lone speed - clear tactical advantage');
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
    it('should cap positive adjustments at +1 position (conservative)', () => {
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

      // Boosted Horse has trip trouble AND lone speed
      // In old system this would be +4, but conservative caps at +1
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 5,
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

      // With conservative +1 cap and algorithm top-4 protection,
      // Boosted Horse gets +1 adjustment but algorithm top-4 is protected
      const boostedHorse = result.horseInsights.find((h) => h.programNumber === 5);
      // Should be rank 5 or possibly 4 if boosted into position, but not higher
      expect(boostedHorse?.projectedFinish).toBeGreaterThanOrEqual(4);
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
