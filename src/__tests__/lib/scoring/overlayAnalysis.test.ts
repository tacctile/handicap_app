/**
 * Overlay Analysis Tests
 * Tests overlay/underlay calculations and tier adjustments
 *
 * FIX v2.1: Added underlay penalty threshold gate
 * Horses with base score >= 160 do NOT receive underlay penalties
 * to prevent circular logic: good horse → public bets → low odds → penalty
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTierAdjustment,
  scoreToWinProbability,
  probabilityToDecimalOdds,
  calculateOverlayPercent,
  classifyValue,
  analyzeOverlay,
  UNDERLAY_PENALTY_THRESHOLD,
} from '../../../lib/scoring/overlayAnalysis';

describe('Overlay Analysis', () => {
  describe('scoreToWinProbability', () => {
    it('converts score 160 to approximately 55% win probability', () => {
      const prob = scoreToWinProbability(160);
      expect(prob).toBeCloseTo(55, 0);
    });

    it('converts score 200 to approximately 75% win probability', () => {
      const prob = scoreToWinProbability(200);
      expect(prob).toBe(75);
    });

    it('clamps probability to minimum 2%', () => {
      const prob = scoreToWinProbability(0);
      expect(prob).toBe(2);
    });

    it('clamps probability to maximum 80%', () => {
      const prob = scoreToWinProbability(300);
      expect(prob).toBe(80);
    });
  });

  describe('probabilityToDecimalOdds', () => {
    it('converts 50% probability to 2.0 decimal odds (even money)', () => {
      const odds = probabilityToDecimalOdds(50);
      expect(odds).toBe(2);
    });

    it('converts 25% probability to 4.0 decimal odds (3-1)', () => {
      const odds = probabilityToDecimalOdds(25);
      expect(odds).toBe(4);
    });
  });

  describe('calculateOverlayPercent', () => {
    it('calculates positive overlay when actual odds exceed fair odds', () => {
      // Fair odds 4.0, actual odds 6.0 = 50% overlay
      const overlay = calculateOverlayPercent(4.0, 6.0);
      expect(overlay).toBe(50);
    });

    it('calculates negative overlay (underlay) when actual odds are below fair', () => {
      // Fair odds 4.0, actual odds 2.0 = -50% overlay
      const overlay = calculateOverlayPercent(4.0, 2.0);
      expect(overlay).toBe(-50);
    });
  });

  describe('classifyValue', () => {
    it('classifies 150%+ as massive overlay', () => {
      expect(classifyValue(150)).toBe('massive_overlay');
      expect(classifyValue(200)).toBe('massive_overlay');
    });

    it('classifies 50-149% as strong overlay', () => {
      expect(classifyValue(50)).toBe('strong_overlay');
      expect(classifyValue(100)).toBe('strong_overlay');
    });

    it('classifies negative percentages as underlay', () => {
      expect(classifyValue(-20)).toBe('underlay');
      expect(classifyValue(-50)).toBe('underlay');
    });
  });

  // ==========================================================================
  // UNDERLAY PENALTY THRESHOLD TESTS (v2.1 FIX)
  // ==========================================================================

  describe('Underlay Penalty Threshold Gate', () => {
    it('exports UNDERLAY_PENALTY_THRESHOLD constant as 160', () => {
      expect(UNDERLAY_PENALTY_THRESHOLD).toBe(160);
    });

    describe('scores above threshold (>= 160) - penalty waived', () => {
      it('does NOT apply penalty for score 180 with -30% underlay', () => {
        const result = calculateTierAdjustment(180, -30);

        // Score should remain unchanged (no -25 penalty)
        expect(result.adjustedScore).toBe(180);
        expect(result.tierShift).toBe(0);
        expect(result.reasoning).toContain('penalty waived');
        expect(result.reasoning).toContain('180');
        expect(result.reasoning).toContain('exceeds threshold');
      });

      it('does NOT apply penalty for score 175 with -28% underlay', () => {
        const result = calculateTierAdjustment(175, -28);

        // -28% is between -15% and -30%, so -15 penalty tier
        // But score 175 >= 160 so penalty should be waived
        expect(result.adjustedScore).toBe(175);
        expect(result.tierShift).toBe(0);
        expect(result.reasoning).toContain('penalty waived');
      });

      it('does NOT apply penalty for score 160 (exactly at threshold) with -25% underlay', () => {
        const result = calculateTierAdjustment(160, -25);

        // Exactly at threshold - penalty should be waived
        expect(result.adjustedScore).toBe(160);
        expect(result.tierShift).toBe(0);
        expect(result.reasoning).toContain('penalty waived');
      });

      it('does NOT apply penalty for score 200 with -40% underlay', () => {
        const result = calculateTierAdjustment(200, -40);

        // Even severe underlays don't penalize high-scoring horses
        expect(result.adjustedScore).toBe(200);
        expect(result.tierShift).toBe(0);
        expect(result.reasoning).toContain('penalty waived');
      });
    });

    describe('scores below threshold (< 160) - penalty applies', () => {
      it('applies -25 penalty for score 150 with -30% underlay', () => {
        const result = calculateTierAdjustment(150, -30);

        // Score below threshold, penalty should apply
        expect(result.adjustedScore).toBe(125); // 150 - 25
        expect(result.tierShift).toBe(-2);
        expect(result.reasoning).toContain('-25 effective points');
      });

      it('applies -15 penalty for score 159 (just below threshold) with -25% underlay', () => {
        const result = calculateTierAdjustment(159, -25);

        // Just below threshold - penalty should apply
        expect(result.adjustedScore).toBe(144); // 159 - 15
        expect(result.tierShift).toBe(-1);
        expect(result.reasoning).toContain('-15 effective points');
      });

      it('applies -15 penalty for score 140 with -18% underlay', () => {
        const result = calculateTierAdjustment(140, -18);

        expect(result.adjustedScore).toBe(125); // 140 - 15
        expect(result.tierShift).toBe(-1);
      });

      it('applies -25 penalty for score 130 with -35% underlay', () => {
        const result = calculateTierAdjustment(130, -35);

        expect(result.adjustedScore).toBe(105); // 130 - 25
        expect(result.tierShift).toBe(-2);
      });
    });

    describe('overlay bonuses still apply regardless of score', () => {
      it('applies +30 bonus for 150%+ overlay with any score', () => {
        // Low score with overlay
        const low = calculateTierAdjustment(120, 160);
        expect(low.adjustedScore).toBe(150); // 120 + 30

        // High score with overlay
        const high = calculateTierAdjustment(180, 160);
        expect(high.adjustedScore).toBe(210); // 180 + 30

        expect(low.tierShift).toBe(2);
        expect(high.tierShift).toBe(2);
      });

      it('applies +20 bonus for 80-149% overlay with any score', () => {
        const low = calculateTierAdjustment(130, 90);
        expect(low.adjustedScore).toBe(150); // 130 + 20

        const high = calculateTierAdjustment(170, 90);
        expect(high.adjustedScore).toBe(190); // 170 + 20
      });

      it('applies +10 bonus for 40-79% overlay with any score', () => {
        const result = calculateTierAdjustment(150, 50);
        expect(result.adjustedScore).toBe(160); // 150 + 10
      });

      it('applies +5 bonus for 15-39% overlay with any score', () => {
        const result = calculateTierAdjustment(155, 20);
        expect(result.adjustedScore).toBe(160); // 155 + 5
      });
    });

    describe('special case: diamond in rough', () => {
      it('detects diamond in rough for score 140-169 with 150%+ overlay', () => {
        const result = calculateTierAdjustment(155, 200);

        expect(result.isSpecialCase).toBe(true);
        expect(result.specialCaseType).toBe('diamond_in_rough');
        expect(result.reasoning).toContain('DIAMOND IN ROUGH');
      });

      it('does not trigger diamond in rough for score >= 170', () => {
        const result = calculateTierAdjustment(170, 200);

        // Score too high for "diamond" designation
        expect(result.specialCaseType).not.toBe('diamond_in_rough');
      });
    });

    describe('special case: fools gold disabled for high scores', () => {
      it('does NOT flag score 180 with -30% underlay as fools gold', () => {
        // Previously this would be flagged, but now high scores are legitimately identified by market
        const result = calculateTierAdjustment(180, -30);

        expect(result.specialCaseType).not.toBe('fool_gold');
        expect(result.reasoning).toContain('penalty waived');
      });

      it('does NOT flag score 200 with -40% underlay as fools gold', () => {
        const result = calculateTierAdjustment(200, -40);

        expect(result.specialCaseType).not.toBe('fool_gold');
      });
    });

    describe('edge cases', () => {
      it('handles exactly -15% underlay threshold correctly', () => {
        // Score below threshold with exactly -15%
        const below = calculateTierAdjustment(159, -15);
        expect(below.adjustedScore).toBe(144); // 159 - 15

        // Score at threshold with exactly -15%
        const at = calculateTierAdjustment(160, -15);
        expect(at.adjustedScore).toBe(160); // No penalty
      });

      it('handles exactly -30% underlay threshold correctly', () => {
        // Score below threshold with exactly -30%
        const below = calculateTierAdjustment(159, -30);
        expect(below.adjustedScore).toBe(134); // 159 - 25

        // Score at threshold with exactly -30%
        const at = calculateTierAdjustment(160, -30);
        expect(at.adjustedScore).toBe(160); // No penalty
      });

      it('handles -14% underlay (just above -15%) - no penalty for anyone', () => {
        // -14% is not severe enough to trigger penalty even below threshold
        const result = calculateTierAdjustment(140, -14);
        expect(result.adjustedScore).toBe(140);
        expect(result.tierShift).toBe(0);
      });

      it('clamps adjusted score to 0-250 range', () => {
        // Very low score with overlay
        const low = calculateTierAdjustment(10, 160);
        expect(low.adjustedScore).toBe(40); // 10 + 30

        // Very high score with overlay
        const high = calculateTierAdjustment(240, 160);
        expect(high.adjustedScore).toBe(250); // Clamped at max
      });
    });
  });

  describe('analyzeOverlay integration', () => {
    it('performs complete overlay analysis', () => {
      const result = analyzeOverlay(180, '5-1');

      expect(result.winProbability).toBeDefined();
      expect(result.fairOddsDecimal).toBeDefined();
      expect(result.overlayPercent).toBeDefined();
      expect(result.valueClass).toBeDefined();
      expect(result.recommendation).toBeDefined();
    });

    it('identifies positive overlay correctly', () => {
      // Score 150 = 50% probability = 2.0 fair odds
      // Actual 5-1 = 6.0 decimal = 200% overlay
      const result = analyzeOverlay(150, '5-1');

      expect(result.overlayPercent).toBeGreaterThan(0);
      expect(result.isPositiveEV).toBe(true);
    });
  });
});
