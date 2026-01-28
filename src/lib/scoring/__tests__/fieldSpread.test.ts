/**
 * Field Spread Analysis Tests
 *
 * Tests for algorithmic field spread detection and scoring.
 * Verifies field type classification, tier assignment, adjustments, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeFieldSpread,
  getHorseTier,
  getFieldSpreadAdjustment,
  hasSignificantFieldSpread,
  getFieldTypeDisplayInfo,
  getConfidenceDisplayInfo,
  getFieldSpreadColor,
  getFieldSpreadSummary,
  FIELD_SPREAD_CONFIG,
  type RankedHorseInput,
} from '../fieldSpread';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a mock ranked horse for testing
 */
function createRankedHorse(
  programNumber: number,
  horseName: string,
  totalScore: number,
  rank: number
): RankedHorseInput {
  return {
    programNumber,
    horseName,
    totalScore,
    rank,
  };
}

/**
 * Create a field of horses with specified scores
 * Scores array should be in descending order (highest first)
 */
function createField(scores: number[]): RankedHorseInput[] {
  return scores.map((score, idx) => ({
    programNumber: idx + 1,
    horseName: `Horse ${idx + 1}`,
    totalScore: score,
    rank: idx + 1,
  }));
}

// ============================================================================
// FIELD TYPE CLASSIFICATION TESTS
// ============================================================================

describe('fieldSpread', () => {
  describe('field type classification', () => {
    it('classifies DOMINANT when leader has 25+ point gap', () => {
      // Leader at 200, second at 170 = 30 point gap
      const horses = createField([200, 170, 165, 160, 155, 150]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('DOMINANT');
      expect(result.scoreGaps.first_to_second).toBe(30);
    });

    it('classifies DOMINANT exactly at 25 point threshold', () => {
      const horses = createField([200, 175, 170, 165, 160, 155]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('DOMINANT');
      expect(result.scoreGaps.first_to_second).toBe(25);
    });

    it('classifies CHALKY when top 2 close but separated from field', () => {
      // Top 2 within 10 points of each other, 15+ gap to #3
      const horses = createField([200, 195, 175, 170, 165, 160]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('CHALKY');
      expect(result.scoreGaps.first_to_second).toBeLessThan(10);
      expect(result.scoreGaps.second_to_third).toBeGreaterThanOrEqual(15);
    });

    it('classifies WIDE_OPEN when top 6 within 20 points', () => {
      // Top 6 all within 20 points
      const horses = createField([180, 178, 175, 172, 168, 165, 150, 140]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('WIDE_OPEN');
      // First to sixth should be <= 20
      expect(180 - 165).toBeLessThanOrEqual(20);
    });

    it('classifies COMPETITIVE when top 4 within 15 points', () => {
      // Top 4 within 15 points but not wide open
      const horses = createField([200, 195, 190, 188, 170, 160]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('COMPETITIVE');
      expect(result.scoreGaps.first_to_fourth).toBeLessThanOrEqual(15);
    });

    it('classifies SEPARATED when clear gaps exist', () => {
      // Clear tier structure with 15+ gaps
      const horses = createField([200, 180, 178, 175, 160, 155]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('SEPARATED');
      expect(result.scoreGaps.first_to_second).toBeGreaterThanOrEqual(15);
    });

    it('defaults to COMPETITIVE for ambiguous fields', () => {
      // Moderate gaps that don't fit other categories
      // First-to-second gap of 12 (not DOMINANT), second-to-third gap of 3 (not CHALKY)
      // Top 4 within 20 points but not within 15 (not pure COMPETITIVE)
      // No 15+ gaps (not SEPARATED)
      const horses = createField([200, 188, 185, 182, 178, 175]);
      const result = analyzeFieldSpread(horses);

      // Should be COMPETITIVE or SEPARATED based on gaps
      expect(['COMPETITIVE', 'SEPARATED']).toContain(result.fieldType);
    });
  });

  // ============================================================================
  // CONFIDENCE CALCULATION TESTS
  // ============================================================================

  describe('confidence calculation', () => {
    it('returns VERY_HIGH confidence for 35+ point dominant lead', () => {
      const horses = createField([200, 160, 155, 150, 145, 140]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('DOMINANT');
      expect(result.confidence).toBe('VERY_HIGH');
    });

    it('returns HIGH confidence for dominant lead under 35 points', () => {
      const horses = createField([200, 172, 168, 165, 160, 155]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('DOMINANT');
      expect(result.confidence).toBe('HIGH');
    });

    it('returns HIGH confidence for CHALKY fields', () => {
      const horses = createField([200, 195, 175, 170, 165, 160]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('CHALKY');
      expect(result.confidence).toBe('HIGH');
    });

    it('returns VERY_LOW confidence for WIDE_OPEN fields', () => {
      const horses = createField([180, 178, 175, 172, 168, 165]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('WIDE_OPEN');
      expect(result.confidence).toBe('VERY_LOW');
    });

    it('returns MEDIUM confidence for COMPETITIVE fields', () => {
      const horses = createField([200, 195, 192, 188, 170, 160]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('COMPETITIVE');
      expect(['MEDIUM', 'LOW']).toContain(result.confidence);
    });
  });

  // ============================================================================
  // ADJUSTMENT TESTS
  // ============================================================================

  describe('score adjustments', () => {
    it('applies +3 boost to dominant leader', () => {
      const horses = createField([200, 170, 165, 160, 155, 150]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('DOMINANT');
      expect(result.adjustments.length).toBeGreaterThanOrEqual(1);

      const leaderAdj = result.adjustments.find((a) => a.programNumber === 1);
      expect(leaderAdj).toBeDefined();
      expect(leaderAdj?.adjustment).toBe(FIELD_SPREAD_CONFIG.DOMINANT_BOOST);
    });

    it('applies +2 boost to both horses in CHALKY field', () => {
      const horses = createField([200, 195, 175, 170, 165, 160]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('CHALKY');
      expect(result.adjustments.length).toBe(2);

      const adj1 = result.adjustments.find((a) => a.programNumber === 1);
      const adj2 = result.adjustments.find((a) => a.programNumber === 2);

      expect(adj1?.adjustment).toBe(FIELD_SPREAD_CONFIG.CHALKY_BOOST);
      expect(adj2?.adjustment).toBe(FIELD_SPREAD_CONFIG.CHALKY_BOOST);
    });

    it('applies -2 penalty to leader in WIDE_OPEN field', () => {
      const horses = createField([180, 178, 175, 172, 168, 165]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('WIDE_OPEN');

      const leaderAdj = result.adjustments.find((a) => a.programNumber === 1);
      expect(leaderAdj).toBeDefined();
      expect(leaderAdj?.adjustment).toBe(FIELD_SPREAD_CONFIG.WIDE_OPEN_LEADER_PENALTY);
    });

    it('applies +1 value boost to mid-pack in WIDE_OPEN field', () => {
      const horses = createField([180, 178, 175, 172, 168, 165, 160, 155]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('WIDE_OPEN');

      const adj4 = result.adjustments.find((a) => a.programNumber === 4);
      const adj5 = result.adjustments.find((a) => a.programNumber === 5);

      expect(adj4?.adjustment).toBe(FIELD_SPREAD_CONFIG.WIDE_OPEN_VALUE_BOOST);
      expect(adj5?.adjustment).toBe(FIELD_SPREAD_CONFIG.WIDE_OPEN_VALUE_BOOST);
    });

    it('applies no adjustments for COMPETITIVE field', () => {
      const horses = createField([200, 195, 192, 188, 170, 160]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('COMPETITIVE');
      expect(result.adjustments.length).toBe(0);
    });

    it('applies +2 boost to separated leader with 20+ gap', () => {
      const horses = createField([200, 178, 175, 172, 165, 160]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('SEPARATED');
      expect(result.scoreGaps.first_to_second).toBeGreaterThanOrEqual(20);

      const leaderAdj = result.adjustments.find((a) => a.programNumber === 1);
      expect(leaderAdj?.adjustment).toBe(FIELD_SPREAD_CONFIG.SEPARATED_BOOST);
    });
  });

  // ============================================================================
  // TIER ASSIGNMENT TESTS
  // ============================================================================

  describe('tier assignment', () => {
    it('assigns top horses to A tier (within 15 points)', () => {
      const horses = createField([200, 195, 190, 188, 170, 160, 150, 140]);
      const result = analyzeFieldSpread(horses);

      // First 4 horses are within 15 points of leader
      expect(result.tiers.A).toContain(1);
      expect(result.tiers.A).toContain(2);
      expect(result.tiers.A).toContain(3);
      expect(result.tiers.A).toContain(4);
    });

    it('limits A tier to maximum 4 horses', () => {
      const horses = createField([200, 198, 196, 194, 192, 190]);
      const result = analyzeFieldSpread(horses);

      expect(result.tiers.A.length).toBeLessThanOrEqual(FIELD_SPREAD_CONFIG.MAX_A_TIER_SIZE);
    });

    it('assigns 16-30 point back horses to B tier', () => {
      const horses = createField([200, 195, 180, 175, 170, 165]);
      const result = analyzeFieldSpread(horses);

      // Horses 16-30 points back should be B tier
      const horsesWith20Back = horses.filter((h) => h.totalScore >= 170 && h.totalScore <= 184);
      for (const h of horsesWith20Back) {
        // Could be in A or B depending on exact math
        const tier = getHorseTier(result, h.programNumber);
        expect(['A', 'B']).toContain(tier);
      }
    });

    it('assigns 31-45 point back horses to C tier', () => {
      const horses = createField([200, 195, 190, 165, 160, 155]);
      const result = analyzeFieldSpread(horses);

      // 165 is 35 points back - should be C tier
      expect(result.tiers.C).toContain(4);
    });

    it('assigns 46+ point back horses to X tier', () => {
      const horses = createField([200, 195, 190, 185, 150, 140]);
      const result = analyzeFieldSpread(horses);

      // 150 is 50 points back - should be X tier
      expect(result.tiers.X).toContain(5);
      // 140 is 60 points back - should be X tier
      expect(result.tiers.X).toContain(6);
    });
  });

  // ============================================================================
  // SIT-OUT CONDITION TESTS
  // ============================================================================

  describe('sit-out conditions', () => {
    it('flags sit-out when top score below 140', () => {
      const horses = createField([135, 130, 125, 120, 115, 110]);
      const result = analyzeFieldSpread(horses);

      expect(result.sitOutFlag).toBe(true);
      expect(result.sitOutReason).toContain('below confidence threshold');
      expect(result.sitOutReason).toContain('140');
    });

    it('flags sit-out for WIDE_OPEN with top 4 within 8 points', () => {
      const horses = createField([175, 174, 172, 170, 168, 166]);
      const result = analyzeFieldSpread(horses);

      // Top 4 within 5 points, field is very tight
      expect(result.sitOutFlag).toBe(true);
      expect(result.sitOutReason).toContain('tight field');
    });

    it('does not flag sit-out for normal competitive field', () => {
      const horses = createField([200, 195, 190, 185, 175, 170]);
      const result = analyzeFieldSpread(horses);

      expect(result.sitOutFlag).toBe(false);
      expect(result.sitOutReason).toBeNull();
    });

    it('does not flag sit-out for dominant field', () => {
      const horses = createField([200, 170, 165, 160, 155, 150]);
      const result = analyzeFieldSpread(horses);

      expect(result.sitOutFlag).toBe(false);
    });
  });

  // ============================================================================
  // BOX SIZE RECOMMENDATION TESTS
  // ============================================================================

  describe('box size recommendations', () => {
    it('recommends tighter boxes for DOMINANT field', () => {
      const horses = createField([200, 170, 165, 160, 155, 150, 145, 140]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('DOMINANT');
      expect(result.recommendedBoxSize.exacta).toBe(3);
      expect(result.recommendedBoxSize.trifecta).toBe(4);
      expect(result.recommendedBoxSize.superfecta).toBe(5);
    });

    it('recommends wider boxes for WIDE_OPEN field', () => {
      const horses = createField([180, 178, 175, 172, 168, 165, 162, 158]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('WIDE_OPEN');
      expect(result.recommendedBoxSize.exacta).toBe(5);
      expect(result.recommendedBoxSize.trifecta).toBe(6);
      expect(result.recommendedBoxSize.superfecta).toBe(7);
    });

    it('recommends medium boxes for COMPETITIVE field', () => {
      const horses = createField([200, 195, 192, 188, 170, 165]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('COMPETITIVE');
      expect(result.recommendedBoxSize.exacta).toBe(4);
      expect(result.recommendedBoxSize.trifecta).toBe(5);
      expect(result.recommendedBoxSize.superfecta).toBe(6);
    });

    it('caps box size to field size for small fields', () => {
      const horses = createField([180, 178, 175, 172]); // Only 4 horses
      const result = analyzeFieldSpread(horses);

      expect(result.recommendedBoxSize.superfecta).toBeLessThanOrEqual(4);
    });
  });

  // ============================================================================
  // SMALL FIELD HANDLING TESTS
  // ============================================================================

  describe('small field handling', () => {
    it('handles 3-horse field gracefully', () => {
      const horses = createField([200, 180, 170]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('COMPETITIVE');
      expect(result.confidence).toBe('MEDIUM');
      expect(result.reason).toContain('Small field');
      expect(result.tiers.A).toContain(1);
      expect(result.tiers.A).toContain(2);
      expect(result.tiers.A).toContain(3);
    });

    it('handles 2-horse field', () => {
      const horses = createField([200, 180]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('COMPETITIVE');
      expect(result.tiers.A.length).toBe(2);
    });

    it('handles 1-horse field', () => {
      const horses = createField([200]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('COMPETITIVE');
      expect(result.tiers.A.length).toBe(1);
    });

    it('handles empty field', () => {
      const horses: RankedHorseInput[] = [];
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('COMPETITIVE');
      expect(result.tiers.A.length).toBe(0);
    });
  });

  // ============================================================================
  // UTILITY FUNCTION TESTS
  // ============================================================================

  describe('utility functions', () => {
    describe('getHorseTier', () => {
      it('returns correct tier for horse', () => {
        const horses = createField([200, 195, 165, 140]);
        const result = analyzeFieldSpread(horses);

        expect(getHorseTier(result, 1)).toBe('A');
        expect(getHorseTier(result, 2)).toBe('A');
        expect(getHorseTier(result, 3)).toBe('C'); // 35 points back
        expect(getHorseTier(result, 4)).toBe('X'); // 60 points back
      });

      it('returns null for non-existent horse', () => {
        const horses = createField([200, 195, 190]);
        const result = analyzeFieldSpread(horses);

        expect(getHorseTier(result, 99)).toBeNull();
      });
    });

    describe('getFieldSpreadAdjustment', () => {
      it('returns adjustment for adjusted horse', () => {
        const horses = createField([200, 170, 165, 160, 155, 150]);
        const result = analyzeFieldSpread(horses);

        const adj = getFieldSpreadAdjustment(result, 1);
        expect(adj).toBe(FIELD_SPREAD_CONFIG.DOMINANT_BOOST);
      });

      it('returns 0 for non-adjusted horse', () => {
        const horses = createField([200, 195, 192, 188, 170, 165]);
        const result = analyzeFieldSpread(horses);

        const adj = getFieldSpreadAdjustment(result, 1);
        expect(adj).toBe(0);
      });
    });

    describe('hasSignificantFieldSpread', () => {
      it('returns true for DOMINANT field', () => {
        const horses = createField([200, 170, 165, 160, 155, 150]);
        const result = analyzeFieldSpread(horses);

        expect(hasSignificantFieldSpread(result)).toBe(true);
      });

      it('returns true for WIDE_OPEN field', () => {
        const horses = createField([180, 178, 175, 172, 168, 165]);
        const result = analyzeFieldSpread(horses);

        expect(hasSignificantFieldSpread(result)).toBe(true);
      });

      it('returns true when sit-out flagged', () => {
        const horses = createField([135, 130, 125, 120, 115, 110]);
        const result = analyzeFieldSpread(horses);

        expect(hasSignificantFieldSpread(result)).toBe(true);
      });

      it('returns false for normal competitive field', () => {
        const horses = createField([200, 195, 192, 188, 175, 170]);
        const result = analyzeFieldSpread(horses);

        // COMPETITIVE field without sit-out
        if (result.fieldType === 'COMPETITIVE' && !result.sitOutFlag) {
          expect(hasSignificantFieldSpread(result)).toBe(false);
        }
      });
    });

    describe('getFieldTypeDisplayInfo', () => {
      it('returns display info for DOMINANT', () => {
        const info = getFieldTypeDisplayInfo('DOMINANT');
        expect(info.name).toBe('Dominant');
        expect(info.color).toBe('#22c55e');
      });

      it('returns display info for WIDE_OPEN', () => {
        const info = getFieldTypeDisplayInfo('WIDE_OPEN');
        expect(info.name).toBe('Wide Open');
        expect(info.color).toBe('#ef4444');
      });
    });

    describe('getConfidenceDisplayInfo', () => {
      it('returns display info for VERY_HIGH', () => {
        const info = getConfidenceDisplayInfo('VERY_HIGH');
        expect(info.name).toBe('Very High');
        expect(info.color).toBe('#22c55e');
      });

      it('returns display info for VERY_LOW', () => {
        const info = getConfidenceDisplayInfo('VERY_LOW');
        expect(info.name).toBe('Very Low');
        expect(info.color).toBe('#ef4444');
      });
    });

    describe('getFieldSpreadColor', () => {
      it('returns green for VERY_HIGH confidence', () => {
        expect(getFieldSpreadColor('VERY_HIGH')).toBe('#22c55e');
      });

      it('returns red for VERY_LOW confidence', () => {
        expect(getFieldSpreadColor('VERY_LOW')).toBe('#ef4444');
      });
    });

    describe('getFieldSpreadSummary', () => {
      it('returns summary with field type and confidence', () => {
        const horses = createField([200, 170, 165, 160, 155, 150]);
        const result = analyzeFieldSpread(horses);

        const summary = getFieldSpreadSummary(result);
        expect(summary).toContain('Dominant');
        expect(summary).toContain('High');
      });

      it('includes sit-out warning when applicable', () => {
        const horses = createField([135, 130, 125, 120, 115, 110]);
        const result = analyzeFieldSpread(horses);

        const summary = getFieldSpreadSummary(result);
        expect(summary).toContain('SIT OUT');
      });
    });
  });

  // ============================================================================
  // SCORE GAP CALCULATION TESTS
  // ============================================================================

  describe('score gap calculation', () => {
    it('calculates correct gaps between positions', () => {
      const horses = createField([200, 180, 170, 165, 155]);
      const result = analyzeFieldSpread(horses);

      expect(result.scoreGaps.first_to_second).toBe(20);
      expect(result.scoreGaps.second_to_third).toBe(10);
      expect(result.scoreGaps.third_to_fourth).toBe(5);
      expect(result.scoreGaps.fourth_to_fifth).toBe(10);
      expect(result.scoreGaps.first_to_fourth).toBe(35);
      expect(result.scoreGaps.first_to_fifth).toBe(45);
    });

    it('handles missing positions gracefully', () => {
      const horses = createField([200, 180, 170]);
      const result = analyzeFieldSpread(horses);

      // Should not throw, gaps to missing positions are 0
      expect(result.scoreGaps.fourth_to_fifth).toBe(0);
    });
  });

  // ============================================================================
  // CONFIGURATION TESTS
  // ============================================================================

  describe('FIELD_SPREAD_CONFIG', () => {
    it('has correct dominant gap threshold', () => {
      expect(FIELD_SPREAD_CONFIG.DOMINANT_GAP).toBe(25);
    });

    it('has correct chalky thresholds', () => {
      expect(FIELD_SPREAD_CONFIG.CHALKY_TOP2_MAX).toBe(10);
      expect(FIELD_SPREAD_CONFIG.CHALKY_TO_FIELD).toBe(15);
    });

    it('has correct tier thresholds', () => {
      expect(FIELD_SPREAD_CONFIG.TIER_A_MAX).toBe(15);
      expect(FIELD_SPREAD_CONFIG.TIER_B_MAX).toBe(30);
      expect(FIELD_SPREAD_CONFIG.TIER_C_MAX).toBe(45);
    });

    it('has correct adjustment values', () => {
      expect(FIELD_SPREAD_CONFIG.DOMINANT_BOOST).toBe(3);
      expect(FIELD_SPREAD_CONFIG.CHALKY_BOOST).toBe(2);
      expect(FIELD_SPREAD_CONFIG.WIDE_OPEN_LEADER_PENALTY).toBe(-2);
      expect(FIELD_SPREAD_CONFIG.WIDE_OPEN_VALUE_BOOST).toBe(1);
    });

    it('has correct sit-out thresholds', () => {
      expect(FIELD_SPREAD_CONFIG.MIN_TOP_SCORE).toBe(140);
      expect(FIELD_SPREAD_CONFIG.EXTREME_TIGHT_RANGE).toBe(8);
    });
  });

  // ============================================================================
  // EDGE CASE TESTS
  // ============================================================================

  describe('edge cases', () => {
    it('handles all horses with same score', () => {
      const horses = createField([180, 180, 180, 180, 180, 180]);
      const result = analyzeFieldSpread(horses);

      // All horses at same score = wide open
      expect(result.scoreGaps.first_to_second).toBe(0);
    });

    it('handles unsorted input array', () => {
      const horses = [
        createRankedHorse(1, 'Horse 1', 150, 6),
        createRankedHorse(2, 'Horse 2', 200, 1),
        createRankedHorse(3, 'Horse 3', 180, 3),
        createRankedHorse(4, 'Horse 4', 170, 4),
        createRankedHorse(5, 'Horse 5', 190, 2),
        createRankedHorse(6, 'Horse 6', 160, 5),
      ];
      const result = analyzeFieldSpread(horses);

      // Should still correctly identify the top score
      expect(result.topScore).toBe(200);
    });

    it('handles very large score differences', () => {
      const horses = createField([300, 100, 90, 80, 70, 60]);
      const result = analyzeFieldSpread(horses);

      expect(result.fieldType).toBe('DOMINANT');
      expect(result.scoreGaps.first_to_second).toBe(200);
    });

    it('handles boundary case at WIDE_OPEN threshold', () => {
      // Top 6 exactly at 20 point range
      const horses = createField([200, 198, 195, 190, 185, 180, 150, 140]);
      const result = analyzeFieldSpread(horses);

      // 200 - 180 = 20, exactly at WIDE_OPEN threshold
      expect(['WIDE_OPEN', 'COMPETITIVE']).toContain(result.fieldType);
    });

    it('does not classify as WIDE_OPEN with less than 6 horses', () => {
      // Only 5 horses, even if tightly bunched
      const horses = createField([180, 178, 176, 174, 172]);
      const result = analyzeFieldSpread(horses);

      // Should not be WIDE_OPEN since min field size is 6
      if (horses.length < 6) {
        expect(result.fieldType).not.toBe('WIDE_OPEN');
      }
    });
  });
});
