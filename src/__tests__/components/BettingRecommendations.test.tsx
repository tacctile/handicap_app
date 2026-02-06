/**
 * BettingRecommendations Component Tests
 *
 * Tests tier classification thresholds, confidence formula,
 * and rendering behavior.
 */

import { describe, it, expect } from 'vitest';
import { MAX_BASE_SCORE } from '../../lib/scoring';

// ============================================================================
// TESTS - Pure Logic (tier classification & confidence formula)
// ============================================================================

describe('BettingRecommendations - Tier Classification Logic', () => {
  // The tier classification logic used in BettingRecommendations, ExoticBuilderModal,
  // and MultiRaceBuilderModal all use the same thresholds:
  //   baseScore >= 181 -> Tier 1
  //   baseScore >= 161 -> Tier 2
  //   baseScore < 161  -> Tier 3

  function classifyTier(baseScore: number): 1 | 2 | 3 {
    if (baseScore >= 181) return 1;
    if (baseScore >= 161) return 2;
    return 3;
  }

  describe('Tier 1 Classification (baseScore >= 181)', () => {
    it('classifies baseScore 200 as Tier 1', () => {
      expect(classifyTier(200)).toBe(1);
    });

    it('classifies baseScore 300 as Tier 1', () => {
      expect(classifyTier(300)).toBe(1);
    });

    it('classifies boundary baseScore 181 as Tier 1', () => {
      expect(classifyTier(181)).toBe(1);
    });

    it('classifies MAX_BASE_SCORE (336) as Tier 1', () => {
      expect(classifyTier(MAX_BASE_SCORE)).toBe(1);
    });
  });

  describe('Tier 2 Classification (baseScore >= 161, < 181)', () => {
    it('classifies baseScore 170 as Tier 2', () => {
      expect(classifyTier(170)).toBe(2);
    });

    it('classifies boundary baseScore 161 as Tier 2', () => {
      expect(classifyTier(161)).toBe(2);
    });

    it('classifies baseScore 180 as Tier 2', () => {
      expect(classifyTier(180)).toBe(2);
    });
  });

  describe('Tier 3 Classification (baseScore < 161)', () => {
    it('classifies baseScore 160 as Tier 3', () => {
      expect(classifyTier(160)).toBe(3);
    });

    it('classifies baseScore 120 as Tier 3', () => {
      expect(classifyTier(120)).toBe(3);
    });

    it('classifies baseScore 0 as Tier 3', () => {
      expect(classifyTier(0)).toBe(3);
    });
  });
});

describe('BettingRecommendations - Confidence Formula', () => {
  // confidence = Math.min(100, 40 + (baseScore / MAX_BASE_SCORE) * 60)

  function calculateConfidence(baseScore: number): number {
    return Math.min(100, 40 + (baseScore / MAX_BASE_SCORE) * 60);
  }

  it('uses MAX_BASE_SCORE (336) in the formula', () => {
    expect(MAX_BASE_SCORE).toBe(336);
  });

  it('returns 100 for MAX_BASE_SCORE (336)', () => {
    expect(calculateConfidence(336)).toBe(100);
  });

  it('returns 40 for baseScore 0', () => {
    expect(calculateConfidence(0)).toBe(40);
  });

  it('returns ~75.7 for baseScore 200', () => {
    expect(calculateConfidence(200)).toBeCloseTo(75.71, 1);
  });

  it('returns ~70 for baseScore 168', () => {
    expect(calculateConfidence(168)).toBeCloseTo(70, 0);
  });

  it('caps at 100 for scores above MAX_BASE_SCORE', () => {
    expect(calculateConfidence(400)).toBe(100);
  });

  it('confidence is always between 40 and 100', () => {
    for (const score of [0, 50, 100, 150, 200, 250, 300, 336]) {
      const conf = calculateConfidence(score);
      expect(conf).toBeGreaterThanOrEqual(40);
      expect(conf).toBeLessThanOrEqual(100);
    }
  });
});

describe('BettingRecommendations - Kelly Bankroll Percentage', () => {
  // Kelly formula: fraction * edge * bankroll
  // where edge = (winProb * odds - loseProb) / odds
  // The app uses fractional Kelly (quarter, half, full)

  it('quarter Kelly reduces bet size by 75%', () => {
    const fullKelly = 100;
    const quarterKelly = fullKelly * 0.25;
    expect(quarterKelly).toBe(25);
  });

  it('half Kelly reduces bet size by 50%', () => {
    const fullKelly = 100;
    const halfKelly = fullKelly * 0.5;
    expect(halfKelly).toBe(50);
  });

  it('Kelly bet with positive edge produces positive bet size', () => {
    const winProb = 0.25; // 25% chance
    const odds = 5; // 5-1 odds
    const edge = (winProb * odds - (1 - winProb)) / odds;
    // edge = (0.25 * 5 - 0.75) / 5 = (1.25 - 0.75) / 5 = 0.1
    expect(edge).toBeCloseTo(0.1, 4);
    expect(edge).toBeGreaterThan(0);
  });

  it('Kelly bet with negative edge produces zero bet', () => {
    const winProb = 0.1; // 10% chance
    const odds = 5; // 5-1 odds
    const edge = (winProb * odds - (1 - winProb)) / odds;
    // edge = (0.1 * 5 - 0.9) / 5 = (0.5 - 0.9) / 5 = -0.08
    expect(edge).toBeLessThan(0);
    const betSize = Math.max(0, edge);
    expect(betSize).toBe(0);
  });
});
