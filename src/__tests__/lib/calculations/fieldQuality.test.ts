/**
 * Field Quality Assessment Tests
 *
 * Tests for field quality assessment and change detection when horses scratch.
 */

import { describe, it, expect } from 'vitest';
import {
  assessFieldQuality,
  detectFieldQualityChange,
  getFieldStrengthDescription,
  getFieldStrengthColor,
  getQualityChangeColor,
  isSignificantScratch,
  getFieldQualitySummary,
  FIELD_STRENGTH_THRESHOLDS,
  TOP_CONTENDER_THRESHOLD,
  type ScoredHorseData,
  type FieldQualityAssessment,
} from '../../../lib/calculations/fieldQuality';
import type { HorseScore, ScoreBreakdown } from '../../../lib/scoring';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a minimal score breakdown for testing
 */
function createMockBreakdown(): ScoreBreakdown {
  return {
    connections: { total: 20, trainer: 12, jockey: 8, partnershipBonus: 0, reasoning: 'Test' },
    postPosition: { total: 15, trackBiasApplied: false, isGoldenPost: false, reasoning: 'Test' },
    speedClass: {
      total: 40,
      speedScore: 25,
      classScore: 15,
      bestFigure: 85,
      classMovement: 'stable',
      reasoning: 'Test',
    },
    form: {
      total: 20,
      recentFormScore: 12,
      layoffScore: 5,
      consistencyBonus: 3,
      formTrend: 'stable',
      reasoning: 'Test',
    },
    equipment: { total: 5, hasChanges: false, reasoning: 'Test' },
    pace: { total: 25, runningStyle: 'P', paceFit: 'favorable', reasoning: 'Test' },
    distanceSurface: {
      total: 10,
      turfScore: 4,
      wetScore: 2,
      distanceScore: 4,
      turfWinRate: 0.25,
      wetWinRate: 0.2,
      distanceWinRate: 0.3,
      reasoning: ['Test'],
    },
    trainerPatterns: { total: 5, matchedPatterns: [], reasoning: ['Test'] },
    comboPatterns: { total: 3, detectedCombos: [], intentScore: 0, reasoning: ['Test'] },
    trackSpecialist: {
      total: 2,
      trackWinRate: 0.15,
      trackITMRate: 0.4,
      isSpecialist: false,
      reasoning: 'Test',
    },
    trainerSurfaceDistance: {
      total: 2,
      matchedCategory: null,
      trainerWinPercent: 0,
      wetTrackWinPercent: 0,
      wetBonusApplied: false,
      reasoning: 'Test',
    },
    weightAnalysis: {
      total: 0,
      currentWeight: 120,
      lastRaceWeight: 120,
      weightChange: 0,
      significantDrop: false,
      significantGain: false,
      showWeightGainFlag: false,
      reasoning: 'Test',
    },
  };
}

/**
 * Create a mock horse score
 */
function createMockScore(total: number, isScratched: boolean = false): HorseScore {
  return {
    total,
    baseScore: total,
    overlayScore: 0,
    breakdown: createMockBreakdown(),
    isScratched,
    confidenceLevel: 'medium',
    dataQuality: 70,
  };
}

/**
 * Create a scored horse data object
 */
function createScoredHorse(
  index: number,
  total: number,
  isScratched: boolean = false,
  horseName?: string
): ScoredHorseData {
  return {
    index,
    score: createMockScore(total, isScratched),
    horseName: horseName ?? `Horse ${index + 1}`,
  };
}

// ============================================================================
// TESTS: assessFieldQuality
// ============================================================================

describe('assessFieldQuality', () => {
  describe('basic calculations', () => {
    it('calculates average score correctly', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 180),
        createScoredHorse(1, 160),
        createScoredHorse(2, 140),
      ];

      const result = assessFieldQuality(horses, new Set());

      expect(result.averageScore).toBe(160);
    });

    it('identifies top score correctly', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 220),
        createScoredHorse(1, 180),
        createScoredHorse(2, 160),
      ];

      const result = assessFieldQuality(horses, new Set());

      expect(result.topScore).toBe(220);
    });

    it('calculates score spread correctly', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 200),
        createScoredHorse(1, 180),
        createScoredHorse(2, 140),
      ];

      const result = assessFieldQuality(horses, new Set());

      expect(result.scoreSpread).toBe(60); // 200 - 140
    });

    it('counts active horses correctly', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 180),
        createScoredHorse(1, 160),
        createScoredHorse(2, 140),
        createScoredHorse(3, 120),
      ];

      const result = assessFieldQuality(horses, new Set());

      expect(result.activeHorseCount).toBe(4);
    });
  });

  describe('field strength classification', () => {
    it('classifies elite field (avg >= 190)', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 210),
        createScoredHorse(1, 190),
        createScoredHorse(2, 180),
      ];

      const result = assessFieldQuality(horses, new Set());

      expect(result.fieldStrength).toBe('elite');
    });

    it('classifies strong field (avg >= 170)', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 190),
        createScoredHorse(1, 175),
        createScoredHorse(2, 160),
      ];

      const result = assessFieldQuality(horses, new Set());

      expect(result.fieldStrength).toBe('strong');
    });

    it('classifies average field (avg >= 150)', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 170),
        createScoredHorse(1, 155),
        createScoredHorse(2, 140),
      ];

      const result = assessFieldQuality(horses, new Set());

      expect(result.fieldStrength).toBe('average');
    });

    it('classifies weak field (avg < 150)', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 150),
        createScoredHorse(1, 130),
        createScoredHorse(2, 110),
      ];

      const result = assessFieldQuality(horses, new Set());

      expect(result.fieldStrength).toBe('weak');
    });
  });

  describe('top contenders', () => {
    it('counts horses within 15 points of leader as top contenders', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 200), // Leader
        createScoredHorse(1, 190), // Within 15 pts
        createScoredHorse(2, 185), // Within 15 pts
        createScoredHorse(3, 180), // NOT within 15 pts (20 behind)
        createScoredHorse(4, 160), // NOT within 15 pts
      ];

      const result = assessFieldQuality(horses, new Set());

      expect(result.topContenderCount).toBe(3); // Horses at 200, 190, 185
    });

    it('returns 1 when only leader is in contention range', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 220), // Leader
        createScoredHorse(1, 180), // 40 pts behind - not a contender
        createScoredHorse(2, 160),
      ];

      const result = assessFieldQuality(horses, new Set());

      expect(result.topContenderCount).toBe(1);
    });
  });

  describe('scratched horses handling', () => {
    it('excludes scratched horses from calculations', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 220), // Will be scratched
        createScoredHorse(1, 180),
        createScoredHorse(2, 160),
      ];

      const result = assessFieldQuality(horses, new Set([0]));

      expect(result.topScore).toBe(180); // Not 220
      expect(result.averageScore).toBe(170); // (180 + 160) / 2
      expect(result.activeHorseCount).toBe(2);
    });

    it('handles isScratched flag in score', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 220, true), // isScratched = true
        createScoredHorse(1, 180),
        createScoredHorse(2, 160),
      ];

      const result = assessFieldQuality(horses, new Set());

      expect(result.topScore).toBe(180);
      expect(result.activeHorseCount).toBe(2);
    });

    it('returns empty assessment when all horses scratched', () => {
      const horses: ScoredHorseData[] = [createScoredHorse(0, 180), createScoredHorse(1, 160)];

      const result = assessFieldQuality(horses, new Set([0, 1]));

      expect(result.averageScore).toBe(0);
      expect(result.topScore).toBe(0);
      expect(result.fieldStrength).toBe('weak');
      expect(result.activeHorseCount).toBe(0);
    });
  });

  describe('statistical measures', () => {
    it('calculates standard deviation', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 200),
        createScoredHorse(1, 180),
        createScoredHorse(2, 160),
        createScoredHorse(3, 140),
      ];

      const result = assessFieldQuality(horses, new Set());

      // Mean is 170, variance is average of (30^2, 10^2, 10^2, 30^2) = 500
      // Standard deviation is sqrt(500) ≈ 22.36
      expect(result.standardDeviation).toBeCloseTo(22.36, 1);
    });

    it('calculates median score', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 200),
        createScoredHorse(1, 180),
        createScoredHorse(2, 160),
        createScoredHorse(3, 140),
      ];

      const result = assessFieldQuality(horses, new Set());

      // Median of [140, 160, 180, 200] = (160 + 180) / 2 = 170
      expect(result.medianScore).toBe(170);
    });
  });
});

// ============================================================================
// TESTS: detectFieldQualityChange
// ============================================================================

describe('detectFieldQualityChange', () => {
  describe('top horse scratches', () => {
    it('detects when leader is scratched', () => {
      const beforeScores: ScoredHorseData[] = [
        createScoredHorse(0, 220, false, 'Top Horse'),
        createScoredHorse(1, 180),
        createScoredHorse(2, 160),
        createScoredHorse(3, 140),
        createScoredHorse(4, 130),
        createScoredHorse(5, 120),
      ];

      const afterScores = beforeScores; // Same horses, but one will be scratched

      const result = detectFieldQualityChange(beforeScores, afterScores, new Set([0]));

      expect(result.leaderScratched).toBe(true);
      expect(result.topScoreDrop).toBe(40); // 220 - 180
      expect(result.qualityChange).toBe('weakened');
      expect(result.newLeaderIndex).toBe(1);
    });

    it('assigns field weakening boost for significant drops', () => {
      const beforeScores: ScoredHorseData[] = [
        createScoredHorse(0, 220),
        createScoredHorse(1, 180),
        createScoredHorse(2, 160),
      ];

      const result = detectFieldQualityChange(beforeScores, beforeScores, new Set([0]));

      // Top score dropped by 40 points (220 -> 180), should get 2 pt boost
      expect(result.fieldWeakeningBoost).toBe(2);
    });

    it('assigns moderate boost for moderate drops (20-35 pts)', () => {
      const beforeScores: ScoredHorseData[] = [
        createScoredHorse(0, 200),
        createScoredHorse(1, 175), // 25 pts behind
        createScoredHorse(2, 160),
      ];

      const result = detectFieldQualityChange(beforeScores, beforeScores, new Set([0]));

      expect(result.fieldWeakeningBoost).toBe(1);
    });

    it('assigns no boost for small drops (<20 pts)', () => {
      const beforeScores: ScoredHorseData[] = [
        createScoredHorse(0, 195),
        createScoredHorse(1, 185), // Only 10 pts behind
        createScoredHorse(2, 175),
      ];

      const result = detectFieldQualityChange(beforeScores, beforeScores, new Set([0]));

      expect(result.fieldWeakeningBoost).toBe(0);
    });
  });

  describe('bottom horse scratches', () => {
    it('detects minimal change when bottom horse scratches', () => {
      const beforeScores: ScoredHorseData[] = [
        createScoredHorse(0, 200),
        createScoredHorse(1, 180),
        createScoredHorse(2, 160),
        createScoredHorse(3, 120), // Bottom horse
      ];

      const result = detectFieldQualityChange(beforeScores, beforeScores, new Set([3]));

      expect(result.leaderScratched).toBe(false);
      expect(result.topScoreDrop).toBe(0);
      // Average goes up when worst horse is removed
      // Before: (200 + 180 + 160 + 120) / 4 = 165
      // After: (200 + 180 + 160) / 3 = 180
      expect(result.avgScoreChange).toBeGreaterThan(0);
      expect(result.fieldWeakeningBoost).toBe(0);
    });

    it('may detect field improvement when weak horse removed', () => {
      const beforeScores: ScoredHorseData[] = [
        createScoredHorse(0, 200),
        createScoredHorse(1, 190),
        createScoredHorse(2, 100), // Very weak horse
      ];

      const result = detectFieldQualityChange(beforeScores, beforeScores, new Set([2]));

      // Average before: (200 + 190 + 100) / 3 = 163.33
      // Average after: (200 + 190) / 2 = 195
      // Change = 195 - 163.33 = 31.67
      expect(result.qualityChange).toBe('improved');
    });
  });

  describe('multiple scratches', () => {
    it('handles multiple scratches correctly', () => {
      const beforeScores: ScoredHorseData[] = [
        createScoredHorse(0, 220),
        createScoredHorse(1, 200),
        createScoredHorse(2, 180),
        createScoredHorse(3, 160),
        createScoredHorse(4, 140),
        createScoredHorse(5, 120),
      ];

      // Scratch horses 0, 1, and 2
      const result = detectFieldQualityChange(beforeScores, beforeScores, new Set([0, 1, 2]));

      expect(result.leaderScratched).toBe(true);
      expect(result.topScoreDrop).toBe(60); // 220 - 160
      expect(result.newLeaderIndex).toBe(3);
      expect(result.fieldWeakeningBoost).toBe(2); // Significant drop
    });
  });

  describe('no scratches', () => {
    it('returns unchanged when no scratches', () => {
      const scores: ScoredHorseData[] = [createScoredHorse(0, 200), createScoredHorse(1, 180)];

      const result = detectFieldQualityChange(scores, scores, new Set());

      expect(result.qualityChange).toBe('unchanged');
      expect(result.avgScoreChange).toBe(0);
      expect(result.topScoreDrop).toBe(0);
      expect(result.fieldWeakeningBoost).toBe(0);
    });
  });

  describe('reasoning generation', () => {
    it('includes scratch count in reasoning', () => {
      const beforeScores: ScoredHorseData[] = [
        createScoredHorse(0, 200),
        createScoredHorse(1, 180),
        createScoredHorse(2, 160),
      ];

      const result = detectFieldQualityChange(beforeScores, beforeScores, new Set([0, 1]));

      expect(result.reasoning).toContain('2 horses scratched');
    });

    it('mentions leader scratch in reasoning', () => {
      const beforeScores: ScoredHorseData[] = [
        createScoredHorse(0, 220),
        createScoredHorse(1, 180),
      ];

      const result = detectFieldQualityChange(beforeScores, beforeScores, new Set([0]));

      expect(result.reasoning).toContain('race favorite');
    });

    it('mentions field weakening boost in reasoning', () => {
      const beforeScores: ScoredHorseData[] = [
        createScoredHorse(0, 220),
        createScoredHorse(1, 170), // 50 pts behind
        createScoredHorse(2, 160),
      ];

      const result = detectFieldQualityChange(beforeScores, beforeScores, new Set([0]));

      expect(result.reasoning).toContain('advisory boost');
    });
  });
});

// ============================================================================
// TESTS: Utility Functions
// ============================================================================

describe('Utility Functions', () => {
  describe('getFieldStrengthDescription', () => {
    it('returns correct description for each strength level', () => {
      expect(getFieldStrengthDescription('elite')).toContain('Elite');
      expect(getFieldStrengthDescription('strong')).toContain('Strong');
      expect(getFieldStrengthDescription('average')).toContain('Average');
      expect(getFieldStrengthDescription('weak')).toContain('Weak');
    });
  });

  describe('getFieldStrengthColor', () => {
    it('returns correct color for each strength level', () => {
      expect(getFieldStrengthColor('elite')).toBe('#8b5cf6'); // Purple
      expect(getFieldStrengthColor('strong')).toBe('#22c55e'); // Green
      expect(getFieldStrengthColor('average')).toBe('#f97316'); // Orange
      expect(getFieldStrengthColor('weak')).toBe('#ef4444'); // Red
    });
  });

  describe('getQualityChangeColor', () => {
    it('returns correct color for each change type', () => {
      expect(getQualityChangeColor('improved')).toBe('#22c55e'); // Green
      expect(getQualityChangeColor('unchanged')).toBe('#6b7280'); // Gray
      expect(getQualityChangeColor('weakened')).toBe('#ef4444'); // Red
    });
  });

  describe('isSignificantScratch', () => {
    it('returns true when leader scratched', () => {
      const change = {
        qualityChange: 'weakened' as const,
        avgScoreChange: -10,
        topContenderChange: -1,
        reasoning: 'Test',
        leaderScratched: true,
        newLeaderIndex: 1,
        topScoreDrop: 30,
        fieldWeakeningBoost: 1,
      };

      expect(isSignificantScratch(change)).toBe(true);
    });

    it('returns true when top score drops significantly', () => {
      const change = {
        qualityChange: 'weakened' as const,
        avgScoreChange: -5,
        topContenderChange: 0,
        reasoning: 'Test',
        leaderScratched: false,
        newLeaderIndex: 0,
        topScoreDrop: 25, // >= 20 threshold
        fieldWeakeningBoost: 1,
      };

      expect(isSignificantScratch(change)).toBe(true);
    });

    it('returns true when average changes significantly', () => {
      const change = {
        qualityChange: 'improved' as const,
        avgScoreChange: 15, // > 10 threshold
        topContenderChange: 0,
        reasoning: 'Test',
        leaderScratched: false,
        newLeaderIndex: 0,
        topScoreDrop: 0,
        fieldWeakeningBoost: 0,
      };

      expect(isSignificantScratch(change)).toBe(true);
    });

    it('returns false for minor scratches', () => {
      const change = {
        qualityChange: 'unchanged' as const,
        avgScoreChange: 2,
        topContenderChange: 0,
        reasoning: 'Test',
        leaderScratched: false,
        newLeaderIndex: 0,
        topScoreDrop: 5,
        fieldWeakeningBoost: 0,
      };

      expect(isSignificantScratch(change)).toBe(false);
    });
  });

  describe('getFieldQualitySummary', () => {
    it('returns meaningful summary for single leader', () => {
      const assessment: FieldQualityAssessment = {
        averageScore: 175,
        topScore: 210,
        scoreSpread: 50,
        fieldStrength: 'strong',
        topContenderCount: 1,
        activeHorseCount: 6,
        standardDeviation: 20,
        medianScore: 170,
      };

      const summary = getFieldQualitySummary(assessment);

      expect(summary).toContain('Strong');
      expect(summary).toContain('1 clear leader');
    });

    it('returns meaningful summary for multiple contenders', () => {
      const assessment: FieldQualityAssessment = {
        averageScore: 185,
        topScore: 200,
        scoreSpread: 30,
        fieldStrength: 'strong',
        topContenderCount: 4,
        activeHorseCount: 8,
        standardDeviation: 15,
        medianScore: 180,
      };

      const summary = getFieldQualitySummary(assessment);

      expect(summary).toContain('4 top contenders');
    });
  });

  describe('Constants', () => {
    it('exports correct field strength thresholds', () => {
      expect(FIELD_STRENGTH_THRESHOLDS.elite).toBe(190);
      expect(FIELD_STRENGTH_THRESHOLDS.strong).toBe(170);
      expect(FIELD_STRENGTH_THRESHOLDS.average).toBe(150);
      expect(FIELD_STRENGTH_THRESHOLDS.weak).toBe(0);
    });

    it('exports correct top contender threshold', () => {
      expect(TOP_CONTENDER_THRESHOLD).toBe(15);
    });
  });
});

// ============================================================================
// TESTS: Integration Scenarios
// ============================================================================

describe('Integration Scenarios', () => {
  describe('6-horse field with top horse scratch', () => {
    it('correctly handles top horse (220) scratching from 6-horse field', () => {
      // Sample: 6-horse field with clear leader
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 220, false, 'Star Runner'), // Leader
        createScoredHorse(1, 185, false, 'Strong Second'),
        createScoredHorse(2, 170, false, 'Third Choice'),
        createScoredHorse(3, 155, false, 'Mid Tier'),
        createScoredHorse(4, 140, false, 'Long Shot'),
        createScoredHorse(5, 130, false, 'Outsider'),
      ];

      // Before scratch assessment
      // avg = (220+185+170+155+140+130)/6 = 166.67
      const beforeAssessment = assessFieldQuality(horses, new Set());
      expect(beforeAssessment.topScore).toBe(220);
      expect(beforeAssessment.topContenderCount).toBe(1); // Only 220 (185 is 35 pts behind)
      expect(beforeAssessment.fieldStrength).toBe('average'); // avg = 166.67 (< 170 threshold for strong)

      // After scratch assessment - leader scratched
      const afterAssessment = assessFieldQuality(horses, new Set([0]));
      expect(afterAssessment.topScore).toBe(185);
      expect(afterAssessment.topContenderCount).toBe(2); // 185 and 170 are within 15 pts
      expect(afterAssessment.activeHorseCount).toBe(5);

      // Detect the change
      const change = detectFieldQualityChange(horses, horses, new Set([0]));
      expect(change.leaderScratched).toBe(true);
      expect(change.topScoreDrop).toBe(35); // 220 - 185
      expect(change.qualityChange).toBe('weakened');
      expect(change.fieldWeakeningBoost).toBe(1); // 20-35 pt drop = 1 pt boost
      expect(change.newLeaderIndex).toBe(1);
    });
  });

  describe('Full race scenario', () => {
    it('tracks field quality through multiple scratches', () => {
      const horses: ScoredHorseData[] = [
        createScoredHorse(0, 200),
        createScoredHorse(1, 195),
        createScoredHorse(2, 180),
        createScoredHorse(3, 165),
        createScoredHorse(4, 150),
        createScoredHorse(5, 135),
      ];

      // Initial assessment
      const initial = assessFieldQuality(horses, new Set());
      expect(initial.averageScore).toBeCloseTo(170.83, 1);
      expect(initial.fieldStrength).toBe('strong');

      // Scratch horse at index 5 (weakest)
      const afterFirst = assessFieldQuality(horses, new Set([5]));
      expect(afterFirst.averageScore).toBeCloseTo(178, 0); // (200+195+180+165+150)/5 = 178

      // Scratch horse at index 0 (leader)
      const afterSecond = assessFieldQuality(horses, new Set([0, 5]));
      expect(afterSecond.topScore).toBe(195);
      expect(afterSecond.activeHorseCount).toBe(4);

      // Detect change from first to second scratch
      const change = detectFieldQualityChange(
        horses.filter((_, i) => i !== 5), // Before: without horse 5
        horses, // After: with scratched indices
        new Set([0]) // Newly scratched
      );
      expect(change.leaderScratched).toBe(true);
    });
  });
});
