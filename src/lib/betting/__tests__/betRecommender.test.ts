/**
 * Bet Recommender Tests
 *
 * Tests for bet recommendation generation.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateBetRecommendations,
  sortRecommendationsByValue,
  filterByBetType,
  getTopRecommendations,
  DEFAULT_FILTERS,
} from '../betRecommender';
import type { OverlayPipelineOutput, OverlayHorseOutput } from '../../scoring/overlayPipeline';

// Mock the calibration function
vi.mock('../../scoring/probabilityConversion', () => ({
  isCalibrationActive: vi.fn(() => true),
}));

describe('betRecommender', () => {
  // Create mock pipeline output for testing
  function createMockPipelineOutput(horses: Partial<OverlayHorseOutput>[]): OverlayPipelineOutput {
    const mockHorses = horses.map((h, i) => ({
      programNumber: h.programNumber ?? i + 1,
      horseName: h.horseName ?? `Horse ${i + 1}`,
      baseScore: h.baseScore ?? 160,
      modelProbability: h.modelProbability ?? 0.2,
      actualOdds: h.actualOdds ?? 5.0,
      expectedValue: h.expectedValue ?? 0.1,
      trueOverlayPercent: h.trueOverlayPercent ?? 10,
      tier: h.tier ?? 'TIER_2',
      calibratedProbability: h.calibratedProbability ?? 0.2,
      betRating: h.betRating ?? 'VALUE',
      impliedOdds: h.impliedOdds ?? 5.0,
      edgeAnalysis: h.edgeAnalysis ?? {
        hasPositiveEdge: true,
        edgePercent: 10,
        edgeSource: 'Model',
        confidence: 'MEDIUM',
      },
    })) as OverlayHorseOutput[];

    return {
      horses: mockHorses,
      fieldMetrics: {
        fieldSize: mockHorses.length,
        averageOdds: 5.0,
        fieldStrength: 'NORMAL' as const,
        competitiveIndex: 0.5,
        bestValueHorse: mockHorses[0]?.programNumber ?? 1,
        overlayCount: mockHorses.filter((h) => h.trueOverlayPercent > 0).length,
        totalExpectedValue: mockHorses.reduce((sum, h) => sum + h.expectedValue, 0),
      },
      calibrationApplied: true,
    };
  }

  describe('generateBetRecommendations', () => {
    it('should only recommend positive EV bets', () => {
      const output = createMockPipelineOutput([
        { programNumber: 1, expectedValue: 0.15, trueOverlayPercent: 10, baseScore: 180 },
        { programNumber: 2, expectedValue: -0.05, trueOverlayPercent: -5, baseScore: 180 },
        { programNumber: 3, expectedValue: 0.08, trueOverlayPercent: 8, baseScore: 180 },
      ]);

      const recs = generateBetRecommendations(output, 500);

      // Should not recommend horse 2 (negative EV)
      const recommendedNumbers = recs.recommendations.map((r) => r.programNumber);
      expect(recommendedNumbers).not.toContain(2);
    });

    it('should filter out Pass tier horses (score < tier3MinScore)', () => {
      const output = createMockPipelineOutput([
        { programNumber: 1, baseScore: 180, expectedValue: 0.15, trueOverlayPercent: 10 },
        { programNumber: 2, baseScore: 100, expectedValue: 0.15, trueOverlayPercent: 10 }, // Pass tier
        { programNumber: 3, baseScore: 160, expectedValue: 0.08, trueOverlayPercent: 8 },
      ]);

      const recs = generateBetRecommendations(output, 500);

      const recommendedNumbers = recs.recommendations.map((r) => r.programNumber);
      expect(recommendedNumbers).not.toContain(2);
    });

    it('should generate reasoning string', () => {
      const output = createMockPipelineOutput([
        {
          programNumber: 1,
          baseScore: 185,
          expectedValue: 0.2,
          trueOverlayPercent: 15,
          modelProbability: 0.3,
          actualOdds: 4.0,
        },
      ]);

      const recs = generateBetRecommendations(output, 500);

      expect(recs.recommendations.length).toBeGreaterThan(0);
      const rec = recs.recommendations[0];
      expect(rec?.reasoning).toBeTruthy();
      expect(rec?.reasoning.length).toBeGreaterThan(0);
    });

    it('should handle empty/no-value races', () => {
      const output = createMockPipelineOutput([]);

      const recs = generateBetRecommendations(output, 500);

      expect(recs.recommendations).toHaveLength(0);
      expect(recs.passSuggested).toBe(true);
      expect(recs.passReason).toBeTruthy();
    });

    it('should respect overlay threshold', () => {
      const output = createMockPipelineOutput([
        { programNumber: 1, trueOverlayPercent: 10, expectedValue: 0.1, baseScore: 180 },
        { programNumber: 2, trueOverlayPercent: 1, expectedValue: 0.01, baseScore: 180 }, // Below threshold
      ]);

      const recs = generateBetRecommendations(output, 500, {}, { minOverlayPercent: 5 });

      const winRecs = recs.recommendations.filter((r) => r.betType === 'WIN');
      const recommendedNumbers = winRecs.map((r) => r.programNumber);
      expect(recommendedNumbers).not.toContain(2);
    });

    it('should set passSuggested true when no recommendations', () => {
      const output = createMockPipelineOutput([
        { programNumber: 1, expectedValue: -0.1, trueOverlayPercent: -10, baseScore: 180 },
        { programNumber: 2, expectedValue: -0.05, trueOverlayPercent: -5, baseScore: 180 },
      ]);

      const recs = generateBetRecommendations(output, 500);

      expect(recs.passSuggested).toBe(true);
    });

    it('should calculate total exposure correctly', () => {
      const output = createMockPipelineOutput([
        {
          programNumber: 1,
          baseScore: 180,
          expectedValue: 0.2,
          trueOverlayPercent: 15,
          modelProbability: 0.25,
          actualOdds: 6.0,
        },
      ]);

      const recs = generateBetRecommendations(output, 500);

      expect(recs.totalSuggestedBets).toBe(
        recs.recommendations.reduce((sum, r) => sum + r.suggestedAmount, 0)
      );
      expect(recs.totalExposure).toBeCloseTo((recs.totalSuggestedBets / 500) * 100, 1);
    });

    it('should include confidence level in recommendations', () => {
      const output = createMockPipelineOutput([
        {
          programNumber: 1,
          baseScore: 185,
          expectedValue: 0.2,
          trueOverlayPercent: 15,
          modelProbability: 0.25,
          actualOdds: 6.0,
        },
      ]);

      const recs = generateBetRecommendations(output, 500);

      expect(recs.recommendations.length).toBeGreaterThan(0);
      const rec = recs.recommendations[0];
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(rec?.confidence);
    });

    it('should include tier in recommendations', () => {
      const output = createMockPipelineOutput([
        {
          programNumber: 1,
          baseScore: 185, // Tier 1
          expectedValue: 0.2,
          trueOverlayPercent: 15,
          modelProbability: 0.25,
          actualOdds: 6.0,
        },
      ]);

      const recs = generateBetRecommendations(output, 500);

      expect(recs.recommendations.length).toBeGreaterThan(0);
      expect(recs.recommendations[0]?.tier).toBe('TIER_1');
    });
  });

  describe('sortRecommendationsByValue', () => {
    it('should sort by tier first (Tier 1 > Tier 2 > Tier 3)', () => {
      const output = createMockPipelineOutput([
        {
          programNumber: 1,
          baseScore: 145,
          expectedValue: 0.3,
          trueOverlayPercent: 20,
          modelProbability: 0.2,
          actualOdds: 6.0,
        },
        {
          programNumber: 2,
          baseScore: 185,
          expectedValue: 0.1,
          trueOverlayPercent: 10,
          modelProbability: 0.25,
          actualOdds: 5.0,
        },
        {
          programNumber: 3,
          baseScore: 165,
          expectedValue: 0.2,
          trueOverlayPercent: 15,
          modelProbability: 0.22,
          actualOdds: 5.5,
        },
      ]);

      const recs = generateBetRecommendations(output, 500);
      const winRecs = recs.recommendations.filter((r) => r.betType === 'WIN');
      const sorted = sortRecommendationsByValue(winRecs);

      // Tier 1 should come first
      if (sorted.length >= 2) {
        expect(sorted[0]?.tier).toBe('TIER_1');
      }
    });

    it('should sort by EV within same tier', () => {
      const output = createMockPipelineOutput([
        {
          programNumber: 1,
          baseScore: 185,
          expectedValue: 0.1,
          trueOverlayPercent: 10,
          modelProbability: 0.25,
          actualOdds: 5.0,
        },
        {
          programNumber: 2,
          baseScore: 185,
          expectedValue: 0.3,
          trueOverlayPercent: 20,
          modelProbability: 0.35,
          actualOdds: 4.0,
        },
      ]);

      const recs = generateBetRecommendations(output, 500);
      const winRecs = recs.recommendations.filter((r) => r.betType === 'WIN');
      const sorted = sortRecommendationsByValue(winRecs);

      if (sorted.length >= 2) {
        expect(sorted[0]?.expectedValue).toBeGreaterThanOrEqual(sorted[1]?.expectedValue ?? 0);
      }
    });
  });

  describe('filterByBetType', () => {
    it('should filter to only WIN bets', () => {
      const output = createMockPipelineOutput([
        {
          programNumber: 1,
          baseScore: 185,
          expectedValue: 0.2,
          trueOverlayPercent: 15,
          modelProbability: 0.25,
          actualOdds: 6.0,
        },
      ]);

      const recs = generateBetRecommendations(output, 500);
      const winOnly = filterByBetType(recs.recommendations, ['WIN']);

      expect(winOnly.every((r) => r.betType === 'WIN')).toBe(true);
    });

    it('should filter multiple bet types', () => {
      const output = createMockPipelineOutput([
        {
          programNumber: 1,
          baseScore: 185,
          expectedValue: 0.2,
          trueOverlayPercent: 15,
          modelProbability: 0.15,
          actualOdds: 10.0,
        },
      ]);

      const recs = generateBetRecommendations(output, 500);
      const filtered = filterByBetType(recs.recommendations, ['WIN', 'PLACE']);

      expect(filtered.every((r) => r.betType === 'WIN' || r.betType === 'PLACE')).toBe(true);
    });
  });

  describe('getTopRecommendations', () => {
    it('should return top N recommendations', () => {
      const output = createMockPipelineOutput([
        {
          programNumber: 1,
          baseScore: 185,
          expectedValue: 0.3,
          trueOverlayPercent: 20,
          modelProbability: 0.3,
          actualOdds: 5.0,
        },
        {
          programNumber: 2,
          baseScore: 185,
          expectedValue: 0.2,
          trueOverlayPercent: 15,
          modelProbability: 0.25,
          actualOdds: 5.5,
        },
        {
          programNumber: 3,
          baseScore: 185,
          expectedValue: 0.1,
          trueOverlayPercent: 10,
          modelProbability: 0.2,
          actualOdds: 6.0,
        },
      ]);

      const recs = generateBetRecommendations(output, 500);
      const top2 = getTopRecommendations(recs.recommendations, 2);

      expect(top2.length).toBeLessThanOrEqual(2);
    });

    it('should handle request for more than available', () => {
      const output = createMockPipelineOutput([
        {
          programNumber: 1,
          baseScore: 185,
          expectedValue: 0.2,
          trueOverlayPercent: 15,
          modelProbability: 0.25,
          actualOdds: 6.0,
        },
      ]);

      const recs = generateBetRecommendations(output, 500);
      const top10 = getTopRecommendations(recs.recommendations, 10);

      expect(top10.length).toBeLessThanOrEqual(recs.recommendations.length);
    });
  });

  describe('DEFAULT_FILTERS', () => {
    it('should have reasonable default values', () => {
      expect(DEFAULT_FILTERS.minEV).toBe(0);
      expect(DEFAULT_FILTERS.minOverlayPercent).toBe(3);
      expect(DEFAULT_FILTERS.tier1MinScore).toBeGreaterThan(0);
      expect(DEFAULT_FILTERS.tier2MinScore).toBeLessThan(DEFAULT_FILTERS.tier1MinScore);
      expect(DEFAULT_FILTERS.tier3MinScore).toBeLessThan(DEFAULT_FILTERS.tier2MinScore);
    });
  });
});
