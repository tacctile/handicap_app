/**
 * Unit tests for the combineMultiBotResults function
 *
 * Tests the targeted aggression changes:
 * 1. Vulnerable favorite HIGH confidence drops ranking by 1
 * 2. Trip trouble HIGH confidence (2+ races) gets +2 boost
 * 3. Field spread doesn't influence contender count (always top 4)
 * 4. Max adjustment is ±2
 * 5. Override/confirm narratives work correctly
 */

import { describe, it, expect } from 'vitest';
import { combineMultiBotResults } from '../../../services/ai';
import type { ParsedRace } from '../../../types/drf';
import type { RaceScoringResult } from '../../../types/scoring';
import type { MultiBotRawResults } from '../../../services/ai/types';

// Helper to create minimal test data
function createTestRace(
  raceNumber: number,
  horses: Array<{
    programNumber: number;
    horseName: string;
    morningLineOdds?: string;
    runningStyle?: string;
  }>
): ParsedRace {
  return {
    header: {
      raceNumber,
      trackCode: 'TEST',
      date: '2024-01-01',
      surface: 'D',
      distance: 1100,
      purse: 50000,
      condition: 'fast',
      raceType: 'CLM',
      claimingPrice: 10000,
      horsesInRace: horses.length,
      ageRestriction: '',
      sexRestriction: '',
    },
    horses: horses.map(
      (h) =>
        ({
          programNumber: h.programNumber,
          horseName: h.horseName,
          morningLineOdds: h.morningLineOdds || '5-1',
          postPosition: h.programNumber,
          runningStyle: h.runningStyle || 'P',
          isScratched: false,
          pastPerformances: [],
          workouts: [],
        }) as unknown as ParsedRace['horses'][0]
    ),
  } as ParsedRace;
}

function createTestScoringResult(
  horses: Array<{ programNumber: number; horseName: string; rank: number; score: number }>
): RaceScoringResult {
  return {
    scores: horses.map((h) => ({
      programNumber: h.programNumber,
      horseName: h.horseName,
      rank: h.rank,
      finalScore: h.score,
      confidenceTier: 'medium' as const,
      breakdown: {
        speedScore: 80,
        classScore: 30,
        formScore: 35,
        paceScore: 25,
        connectionScore: 18,
      },
      positiveFactors: ['Strong speed figures'],
      negativeFactors: [],
      isScratched: false,
    })),
    raceAnalysis: {
      paceScenario: {
        expectedPace: 'honest',
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

describe('combineMultiBotResults', () => {
  describe('PART 1: Vulnerable Favorite Ranking Drop (Conservative Mode)', () => {
    it('should drop favorite when HIGH confidence vulnerable AND 2+ vulnerability flags', () => {
      const race = createTestRace(1, [
        { programNumber: 1, horseName: 'Favorite Horse', morningLineOdds: '2-1' },
        { programNumber: 2, horseName: 'Second Horse', morningLineOdds: '5-1' },
        { programNumber: 3, horseName: 'Third Horse', morningLineOdds: '8-1' },
        { programNumber: 4, horseName: 'Fourth Horse', morningLineOdds: '10-1' },
      ]);

      const scoring = createTestScoringResult([
        { programNumber: 1, horseName: 'Favorite Horse', rank: 1, score: 220 },
        { programNumber: 2, horseName: 'Second Horse', rank: 2, score: 200 },
        { programNumber: 3, horseName: 'Third Horse', rank: 3, score: 180 },
        { programNumber: 4, horseName: 'Fourth Horse', rank: 4, score: 160 },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: { horsesWithTripTrouble: [] },
        paceScenario: {
          advantagedStyles: [],
          disadvantagedStyles: [],
          paceProjection: 'MODERATE',
          loneSpeedException: false,
          speedDuelLikely: false,
        },
        vulnerableFavorite: {
          isVulnerable: true,
          // CONSERVATIVE: Needs 2+ flags AND HIGH confidence for penalty
          reasons: ['Poor track record at this distance', 'Class drop concern'],
          confidence: 'HIGH',
        },
        fieldSpread: {
          fieldType: 'MIXED',
          topTierCount: 4,
          recommendedSpread: 'MEDIUM',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Algorithm's #1 pick (Favorite Horse) should be dropped, #2 should be new top pick
      expect(result.topPick).toBe(2);
      expect(result.raceNarrative).toContain('OVERRIDE');
      expect(result.raceNarrative).toContain('Vulnerable favorite:');
    });

    it('should NOT drop favorite when HIGH confidence but only 1 flag (conservative mode)', () => {
      const race = createTestRace(1, [
        { programNumber: 1, horseName: 'Favorite Horse', morningLineOdds: '2-1' },
        { programNumber: 2, horseName: 'Second Horse', morningLineOdds: '5-1' },
        { programNumber: 3, horseName: 'Third Horse', morningLineOdds: '8-1' },
        { programNumber: 4, horseName: 'Fourth Horse', morningLineOdds: '10-1' },
      ]);

      const scoring = createTestScoringResult([
        { programNumber: 1, horseName: 'Favorite Horse', rank: 1, score: 220 },
        { programNumber: 2, horseName: 'Second Horse', rank: 2, score: 200 },
        { programNumber: 3, horseName: 'Third Horse', rank: 3, score: 180 },
        { programNumber: 4, horseName: 'Fourth Horse', rank: 4, score: 160 },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: { horsesWithTripTrouble: [] },
        paceScenario: {
          advantagedStyles: [],
          disadvantagedStyles: [],
          paceProjection: 'MODERATE',
          loneSpeedException: false,
          speedDuelLikely: false,
        },
        vulnerableFavorite: {
          isVulnerable: true,
          // CONSERVATIVE: Only 1 flag = no penalty, just flagged
          reasons: ['Poor track record at this distance'],
          confidence: 'HIGH',
        },
        fieldSpread: {
          fieldType: 'MIXED',
          topTierCount: 4,
          recommendedSpread: 'MEDIUM',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // CONSERVATIVE: HIGH confidence with 1 flag = flag only, no rank change
      expect(result.topPick).toBe(1);
      expect(result.vulnerableFavorite).toBe(true); // Still flagged
      expect(result.raceNarrative).toContain('CONFIRM'); // No override with weak signal
    });

    it('should NOT drop favorite when MEDIUM confidence (conservative mode)', () => {
      const race = createTestRace(1, [
        { programNumber: 1, horseName: 'Favorite Horse', morningLineOdds: '2-1' },
        { programNumber: 2, horseName: 'Second Horse', morningLineOdds: '5-1' },
        { programNumber: 3, horseName: 'Third Horse', morningLineOdds: '8-1' },
        { programNumber: 4, horseName: 'Fourth Horse', morningLineOdds: '10-1' },
      ]);

      const scoring = createTestScoringResult([
        { programNumber: 1, horseName: 'Favorite Horse', rank: 1, score: 220 },
        { programNumber: 2, horseName: 'Second Horse', rank: 2, score: 200 },
        { programNumber: 3, horseName: 'Third Horse', rank: 3, score: 180 },
        { programNumber: 4, horseName: 'Fourth Horse', rank: 4, score: 160 },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: { horsesWithTripTrouble: [] },
        paceScenario: {
          advantagedStyles: [],
          disadvantagedStyles: [],
          paceProjection: 'MODERATE',
          loneSpeedException: false,
          speedDuelLikely: false,
        },
        vulnerableFavorite: {
          isVulnerable: true,
          reasons: ['Some concern', 'Another concern'],
          confidence: 'MEDIUM', // CONSERVATIVE: MEDIUM confidence = no penalty
        },
        fieldSpread: {
          fieldType: 'MIXED',
          topTierCount: 4,
          recommendedSpread: 'MEDIUM',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // CONSERVATIVE: MEDIUM confidence = flag only, no rank change
      expect(result.topPick).toBe(1);
      expect(result.vulnerableFavorite).toBe(true); // Still flagged
    });
  });

  describe('PART 2: Trip Trouble HIGH/MEDIUM Confidence (Conservative Mode)', () => {
    it('should apply +2 boost for HIGH confidence trip trouble (2+ troubled races)', () => {
      const race = createTestRace(1, [
        { programNumber: 1, horseName: 'Top Horse', morningLineOdds: '2-1' },
        { programNumber: 2, horseName: 'Second Horse', morningLineOdds: '5-1' },
        { programNumber: 3, horseName: 'Trip Trouble Horse', morningLineOdds: '8-1' },
        { programNumber: 4, horseName: 'Fourth Horse', morningLineOdds: '10-1' },
      ]);

      const scoring = createTestScoringResult([
        { programNumber: 1, horseName: 'Top Horse', rank: 1, score: 220 },
        { programNumber: 2, horseName: 'Second Horse', rank: 2, score: 200 },
        { programNumber: 3, horseName: 'Trip Trouble Horse', rank: 3, score: 180 },
        { programNumber: 4, horseName: 'Fourth Horse', rank: 4, score: 160 },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 3,
              horseName: 'Trip Trouble Horse',
              // Issue indicates 2+ troubled races - HIGH confidence
              issue: 'Blocked in 2 of last 3 races, finished 5th both times despite clear ability',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: {
          advantagedStyles: [],
          disadvantagedStyles: [],
          paceProjection: 'MODERATE',
          loneSpeedException: false,
          speedDuelLikely: false,
        },
        vulnerableFavorite: {
          isVulnerable: false,
          reasons: [],
          confidence: 'LOW',
        },
        fieldSpread: {
          fieldType: 'MIXED',
          topTierCount: 4,
          recommendedSpread: 'MEDIUM',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Horse #3 with +2 boost should move from rank 3 to rank 1
      expect(result.topPick).toBe(3);
      expect(result.raceNarrative).toContain('OVERRIDE');
      expect(result.raceNarrative).toContain('trip trouble');
    });

    it('should NOT apply boost for MEDIUM confidence trip trouble (1 troubled race) in conservative mode', () => {
      const race = createTestRace(1, [
        { programNumber: 1, horseName: 'Top Horse', morningLineOdds: '2-1' },
        { programNumber: 2, horseName: 'Trip Trouble Horse', morningLineOdds: '5-1' },
        { programNumber: 3, horseName: 'Third Horse', morningLineOdds: '8-1' },
        { programNumber: 4, horseName: 'Fourth Horse', morningLineOdds: '10-1' },
      ]);

      const scoring = createTestScoringResult([
        { programNumber: 1, horseName: 'Top Horse', rank: 1, score: 220 },
        { programNumber: 2, horseName: 'Trip Trouble Horse', rank: 2, score: 200 },
        { programNumber: 3, horseName: 'Third Horse', rank: 3, score: 180 },
        { programNumber: 4, horseName: 'Fourth Horse', rank: 4, score: 160 },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 2,
              horseName: 'Trip Trouble Horse',
              // Issue indicates only 1 troubled race (MEDIUM confidence)
              issue: 'Blocked at the quarter pole in last race, finished 4th despite good position',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: {
          advantagedStyles: [],
          disadvantagedStyles: [],
          paceProjection: 'MODERATE',
          loneSpeedException: false,
          speedDuelLikely: false,
        },
        vulnerableFavorite: {
          isVulnerable: false,
          reasons: [],
          confidence: 'LOW',
        },
        fieldSpread: {
          fieldType: 'MIXED',
          topTierCount: 4,
          recommendedSpread: 'MEDIUM',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // CONSERVATIVE: MEDIUM confidence trip trouble = flag only, no boost
      // Horse #1 stays as top pick
      expect(result.topPick).toBe(1);
    });
  });

  describe('PART 3: Field Spread - Always Top 4 Contenders', () => {
    it('should always mark top 4 as contenders regardless of field spread recommendation', () => {
      const race = createTestRace(1, [
        { programNumber: 1, horseName: 'Horse 1', morningLineOdds: '2-1' },
        { programNumber: 2, horseName: 'Horse 2', morningLineOdds: '3-1' },
        { programNumber: 3, horseName: 'Horse 3', morningLineOdds: '5-1' },
        { programNumber: 4, horseName: 'Horse 4', morningLineOdds: '8-1' },
        { programNumber: 5, horseName: 'Horse 5', morningLineOdds: '10-1' },
        { programNumber: 6, horseName: 'Horse 6', morningLineOdds: '15-1' },
      ]);

      const scoring = createTestScoringResult([
        { programNumber: 1, horseName: 'Horse 1', rank: 1, score: 220 },
        { programNumber: 2, horseName: 'Horse 2', rank: 2, score: 210 },
        { programNumber: 3, horseName: 'Horse 3', rank: 3, score: 200 },
        { programNumber: 4, horseName: 'Horse 4', rank: 4, score: 190 },
        { programNumber: 5, horseName: 'Horse 5', rank: 5, score: 180 },
        { programNumber: 6, horseName: 'Horse 6', rank: 6, score: 160 },
      ]);

      // Even with NARROW spread recommendation, we should still have 4 contenders
      const rawResults: MultiBotRawResults = {
        tripTrouble: { horsesWithTripTrouble: [] },
        paceScenario: {
          advantagedStyles: [],
          disadvantagedStyles: [],
          paceProjection: 'MODERATE',
          loneSpeedException: false,
          speedDuelLikely: false,
        },
        vulnerableFavorite: {
          isVulnerable: false,
          reasons: [],
          confidence: 'LOW',
        },
        fieldSpread: {
          fieldType: 'SEPARATED',
          topTierCount: 2,
          recommendedSpread: 'NARROW', // Would normally suggest 3 contenders
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Should have exactly 4 contenders regardless of NARROW spread
      const contenders = result.horseInsights.filter((h) => h.isContender);
      expect(contenders.length).toBe(4);
    });
  });

  describe('PART 4: Safeguards', () => {
    it('should cap maximum adjustment at +2', () => {
      const race = createTestRace(1, [
        { programNumber: 1, horseName: 'Horse 1', morningLineOdds: '2-1' },
        { programNumber: 2, horseName: 'Horse 2', morningLineOdds: '3-1' },
        { programNumber: 3, horseName: 'Horse 3', morningLineOdds: '5-1' },
        { programNumber: 4, horseName: 'Horse 4', morningLineOdds: '8-1' },
        { programNumber: 5, horseName: 'Horse 5', morningLineOdds: '10-1' },
      ]);

      const scoring = createTestScoringResult([
        { programNumber: 1, horseName: 'Horse 1', rank: 1, score: 220 },
        { programNumber: 2, horseName: 'Horse 2', rank: 2, score: 210 },
        { programNumber: 3, horseName: 'Horse 3', rank: 3, score: 200 },
        { programNumber: 4, horseName: 'Horse 4', rank: 4, score: 190 },
        { programNumber: 5, horseName: 'Horse 5', rank: 5, score: 180 },
      ]);

      // Horse at rank 5 with trip trouble - even with +2 boost, can't go below rank 3
      const rawResults: MultiBotRawResults = {
        tripTrouble: {
          horsesWithTripTrouble: [
            {
              programNumber: 5,
              horseName: 'Horse 5',
              issue: 'Blocked in 2 of last 3 races, finished 5th both times',
              maskedAbility: true,
            },
          ],
        },
        paceScenario: {
          advantagedStyles: [],
          disadvantagedStyles: [],
          paceProjection: 'MODERATE',
          loneSpeedException: false,
          speedDuelLikely: false,
        },
        vulnerableFavorite: {
          isVulnerable: false,
          reasons: [],
          confidence: 'LOW',
        },
        fieldSpread: {
          fieldType: 'MIXED',
          topTierCount: 4,
          recommendedSpread: 'MEDIUM',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Horse 5 with +2 boost should be at rank 3 (5 - 2 = 3)
      const horse5 = result.horseInsights.find((h) => h.programNumber === 5);
      expect(horse5?.projectedFinish).toBe(3);
    });
  });

  describe('PART 5: Override/Confirm Narratives', () => {
    it('should generate CONFIRM narrative when AI agrees with algorithm', () => {
      const race = createTestRace(1, [
        { programNumber: 1, horseName: 'Top Horse', morningLineOdds: '2-1' },
        { programNumber: 2, horseName: 'Second Horse', morningLineOdds: '5-1' },
        { programNumber: 3, horseName: 'Third Horse', morningLineOdds: '8-1' },
        { programNumber: 4, horseName: 'Fourth Horse', morningLineOdds: '10-1' },
      ]);

      const scoring = createTestScoringResult([
        { programNumber: 1, horseName: 'Top Horse', rank: 1, score: 220 },
        { programNumber: 2, horseName: 'Second Horse', rank: 2, score: 200 },
        { programNumber: 3, horseName: 'Third Horse', rank: 3, score: 180 },
        { programNumber: 4, horseName: 'Fourth Horse', rank: 4, score: 160 },
      ]);

      const rawResults: MultiBotRawResults = {
        tripTrouble: { horsesWithTripTrouble: [] },
        paceScenario: {
          advantagedStyles: [],
          disadvantagedStyles: [],
          paceProjection: 'MODERATE',
          loneSpeedException: false,
          speedDuelLikely: false,
        },
        vulnerableFavorite: {
          isVulnerable: false,
          reasons: [],
          confidence: 'LOW',
        },
        fieldSpread: {
          fieldType: 'MIXED',
          topTierCount: 4,
          recommendedSpread: 'MEDIUM',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      expect(result.raceNarrative).toContain('CONFIRM');
      expect(result.raceNarrative).toContain('Top Horse');
    });
  });
});
