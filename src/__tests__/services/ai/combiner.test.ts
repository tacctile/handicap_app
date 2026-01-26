/**
 * Unit tests for the combineMultiBotResults function
 *
 * Tests the Three-Template System (v3):
 * 1. Template A: Solid favorite + value horse identified
 * 2. Template B: Vulnerable favorite (HIGH confidence, 2+ flags)
 * 3. Template C: Wide open field
 * 4. PASS: Solid favorite with no value horse (MINIMAL tier)
 *
 * Key principles:
 * - Algorithm ranks are SACRED (never reordered by AI)
 * - Template selection determines betting strategy
 * - Narratives use template format (no OVERRIDE/CONFIRM)
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
  describe('PART 1: Template Selection Based on Favorite Vulnerability', () => {
    it('should select Template B when HIGH confidence vulnerable AND 2+ vulnerability flags', () => {
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
          // 2+ flags AND HIGH confidence triggers Template B
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

      // Template B: topPick = algorithm rank 2 (favorite demoted from win position)
      expect(result.topPick).toBe(2);
      expect(result.ticketConstruction?.template).toBe('B');
      expect(result.vulnerableFavorite).toBe(true);
      expect(result.raceNarrative).toContain('TEMPLATE B');
      expect(result.raceNarrative).toContain('Vulnerable Favorite');
    });

    it('should select PASS template when HIGH confidence but only 1 vulnerability flag', () => {
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
          // Only 1 flag = favoriteStatus stays SOLID → PASS template (no value horse)
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

      // PASS template: topPick = algorithm rank 1, favoriteStatus = SOLID
      expect(result.topPick).toBe(1);
      expect(result.ticketConstruction?.template).toBe('PASS');
      expect(result.vulnerableFavorite).toBe(false); // Not marked as vulnerable (only 1 flag)
      expect(result.raceNarrative).toContain('MINIMAL TIER');
    });

    it('should select PASS template when MEDIUM confidence even with 2 flags', () => {
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
          // MEDIUM confidence with 2 flags = favoriteStatus stays SOLID
          confidence: 'MEDIUM',
        },
        fieldSpread: {
          fieldType: 'MIXED',
          topTierCount: 4,
          recommendedSpread: 'MEDIUM',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // PASS template: 2 flags but MEDIUM confidence = not vulnerable enough
      expect(result.topPick).toBe(1);
      expect(result.ticketConstruction?.template).toBe('PASS');
      expect(result.vulnerableFavorite).toBe(false); // Requires HIGH confidence for 2 flags
    });
  });

  describe('PART 2: Algorithm Ranks Are Sacred', () => {
    // NOTE: Tests for ranking changes via trip trouble boosts have been REMOVED
    // because algorithm ranks are now SACRED and never reordered by AI.
    // Trip trouble flags are captured in horse insights but don't affect rankings.

    it('should preserve algorithm ranks even when trip trouble is detected', () => {
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

      // Algorithm rank 1 stays as top pick (ranks are SACRED)
      expect(result.topPick).toBe(1);

      // Horse #3's projectedFinish should remain at algorithm rank 3
      const horse3 = result.horseInsights.find((h) => h.programNumber === 3);
      expect(horse3?.projectedFinish).toBe(3);

      // Trip trouble info should still be in the one-liner (for insights)
      expect(horse3?.oneLiner).toBeDefined();
    });

    it('should preserve algorithm rank in projectedFinish for all horses', () => {
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

      // Trip trouble on horse 5 - should NOT change projectedFinish
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

      // ALL horses should have projectedFinish = their algorithm rank
      const horse5 = result.horseInsights.find((h) => h.programNumber === 5);
      expect(horse5?.projectedFinish).toBe(5); // Algorithm rank preserved (was 5, stays 5)

      // Verify all horses maintain their algorithm ranks
      for (let i = 1; i <= 5; i++) {
        const horse = result.horseInsights.find((h) => h.programNumber === i);
        expect(horse?.projectedFinish).toBe(i);
      }
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
          recommendedSpread: 'NARROW', // Would normally suggest fewer contenders
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Should have exactly 4 contenders regardless of NARROW spread
      const contenders = result.horseInsights.filter((h) => h.isContender);
      expect(contenders.length).toBe(4);
    });
  });

  describe('PART 4: Template C Selection (Wide Open)', () => {
    it('should select Template C for wide open field and include 5 contenders', () => {
      const race = createTestRace(1, [
        { programNumber: 1, horseName: 'Horse 1', morningLineOdds: '4-1' },
        { programNumber: 2, horseName: 'Horse 2', morningLineOdds: '5-1' },
        { programNumber: 3, horseName: 'Horse 3', morningLineOdds: '5-1' },
        { programNumber: 4, horseName: 'Horse 4', morningLineOdds: '6-1' },
        { programNumber: 5, horseName: 'Horse 5', morningLineOdds: '6-1' },
        { programNumber: 6, horseName: 'Horse 6', morningLineOdds: '8-1' },
      ]);

      const scoring = createTestScoringResult([
        { programNumber: 1, horseName: 'Horse 1', rank: 1, score: 200 },
        { programNumber: 2, horseName: 'Horse 2', rank: 2, score: 195 },
        { programNumber: 3, horseName: 'Horse 3', rank: 3, score: 192 },
        { programNumber: 4, horseName: 'Horse 4', rank: 4, score: 190 },
        { programNumber: 5, horseName: 'Horse 5', rank: 5, score: 188 },
        { programNumber: 6, horseName: 'Horse 6', rank: 6, score: 175 },
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
          fieldType: 'WIDE_OPEN', // Triggers Template C
          topTierCount: 5,
          recommendedSpread: 'WIDE',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Template C selected for wide open field
      expect(result.ticketConstruction?.template).toBe('C');
      expect(result.raceNarrative).toContain('TEMPLATE C');
      expect(result.raceNarrative).toContain('Wide Open');

      // Template C includes 5 contenders
      const contenders = result.horseInsights.filter((h) => h.isContender);
      expect(contenders.length).toBe(5);

      // topPick is still algorithm rank 1 (Template C uses rank 1)
      expect(result.topPick).toBe(1);
    });
  });

  describe('PART 5: Narrative Format (Template-Based)', () => {
    it('should generate MINIMAL TIER narrative when no value edge identified', () => {
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

      // No signals that would identify a value edge
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

      // PASS template with MINIMAL TIER narrative
      expect(result.ticketConstruction?.template).toBe('PASS');
      expect(result.raceNarrative).toContain('MINIMAL TIER');
      expect(result.raceNarrative).toContain('Top Horse'); // Algorithm top pick named
      expect(result.raceNarrative).toContain('No AI bet recommendation');

      // Algorithm rank 1 is still top pick
      expect(result.topPick).toBe(1);
    });

    it('should generate Template B narrative with vulnerability info', () => {
      const race = createTestRace(1, [
        { programNumber: 1, horseName: 'Vulnerable Fav', morningLineOdds: '2-1' },
        { programNumber: 2, horseName: 'New Leader', morningLineOdds: '5-1' },
        { programNumber: 3, horseName: 'Third Horse', morningLineOdds: '8-1' },
        { programNumber: 4, horseName: 'Fourth Horse', morningLineOdds: '10-1' },
      ]);

      const scoring = createTestScoringResult([
        { programNumber: 1, horseName: 'Vulnerable Fav', rank: 1, score: 220 },
        { programNumber: 2, horseName: 'New Leader', rank: 2, score: 200 },
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
          reasons: ['Class drop with poor form', 'Distance concern'],
          confidence: 'HIGH',
        },
        fieldSpread: {
          fieldType: 'MIXED',
          topTierCount: 4,
          recommendedSpread: 'MEDIUM',
        },
      };

      const result = combineMultiBotResults(rawResults, race, scoring, 100);

      // Template B narrative format
      expect(result.ticketConstruction?.template).toBe('B');
      expect(result.raceNarrative).toContain('TEMPLATE B');
      expect(result.raceNarrative).toContain('Vulnerable Favorite');
      expect(result.raceNarrative).toContain('Demote #1');
      expect(result.raceNarrative).toContain('Key #2');
    });
  });
});
