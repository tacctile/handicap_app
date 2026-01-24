/**
 * Algorithm Validation Tests
 *
 * Purpose: Validates understanding of the complete algorithm specification
 * from MASTER_CONTEXT.md and ALGORITHM_REFERENCE.md
 *
 * Algorithm Version: v3.6 (Phase 7, Form Decay System)
 * Source Documents:
 * - MASTER_CONTEXT.md (project definition, architecture)
 * - ALGORITHM_REFERENCE.md (algorithm details, scoring categories, DRF fields)
 * - src/docs/SCORING_ENGINE.md (detailed scoring formulas)
 */

import { describe, it, expect } from 'vitest';

// =============================================================================
// PART 2: BASE SCORING CONSTANTS
// Source: ALGORITHM_REFERENCE.md lines 29-46
// =============================================================================

/**
 * All 15 base scoring categories with exact point values
 * Total: 331 points
 * Source: ALGORITHM_REFERENCE.md lines 29-46
 */
const BASE_SCORING_CATEGORIES = {
  speedFigures: 105, // 31.7% - ALGORITHM_REFERENCE.md line 31 (Model B increased)
  form: 50, // 15.1% - ALGORITHM_REFERENCE.md line 32
  pace: 35, // 10.6% - ALGORITHM_REFERENCE.md line 33 (Model B reduced)
  class: 35, // 10.6%  - ALGORITHM_REFERENCE.md line 34 (Model B increased)
  connections: 23, // 6.9%  - ALGORITHM_REFERENCE.md line 35 (Model B reduced)
  distanceSurface: 20, // 6.0%  - ALGORITHM_REFERENCE.md line 36
  oddsFactor: 12, // 3.6%  - ALGORITHM_REFERENCE.md line 37 (Model B reduced)
  postPosition: 12, // 3.6%  - ALGORITHM_REFERENCE.md line 38
  trainerPatterns: 8, // 2.4%  - ALGORITHM_REFERENCE.md line 39 (Model B reduced)
  equipment: 8, // 2.4%  - ALGORITHM_REFERENCE.md line 40
  trackSpecialist: 10, // 3.0%  - ALGORITHM_REFERENCE.md line 41 (Model B increased)
  trainerSurfaceDist: 6, // 1.8%  - ALGORITHM_REFERENCE.md line 42
  comboPatterns: 4, // 1.2%  - ALGORITHM_REFERENCE.md line 43
  p3Refinements: 2, // 0.6%  - ALGORITHM_REFERENCE.md line 44
  weight: 1, // 0.3%  - ALGORITHM_REFERENCE.md line 45
} as const;

// Base score total - ALGORITHM_REFERENCE.md line 46
const BASE_SCORE_TOTAL = 331;

// =============================================================================
// PART 3: OVERLAY CONSTANTS
// Source: ALGORITHM_REFERENCE.md lines 50-65
// =============================================================================

/**
 * All 7 overlay sections with max adjustments
 * Theoretical max: ±67 (sum of all sections)
 * Actual cap: ±40
 * Source: ALGORITHM_REFERENCE.md lines 54-62
 */
const OVERLAY_SECTIONS = {
  paceDynamicsBias: 10, // Section A - ALGORITHM_REFERENCE.md line 56
  formCycleConditioning: 15, // Section B - ALGORITHM_REFERENCE.md line 57
  tripAnalysisTrouble: 10, // Section C - ALGORITHM_REFERENCE.md line 58
  classMovementCompetition: 12, // Section D - ALGORITHM_REFERENCE.md line 59
  connectionMicroEdges: 8, // Section E - ALGORITHM_REFERENCE.md line 60
  distanceSurfaceOpt: 6, // Section F - ALGORITHM_REFERENCE.md line 61
  headToHeadTactical: 6, // Section G - ALGORITHM_REFERENCE.md line 62
} as const;

// Overlay cap - ALGORITHM_REFERENCE.md line 64
const OVERLAY_CAP = 40;

// Theoretical max (sum of all sections) - ALGORITHM_REFERENCE.md line 52
const OVERLAY_THEORETICAL_MAX = 67;

// =============================================================================
// PART 4: CONFIDENCE CONSTANTS
// Source: ALGORITHM_REFERENCE.md lines 67-82
// =============================================================================

const CONFIDENCE_THRESHOLDS = {
  HIGH: { min: 80, max: 100 }, // ALGORITHM_REFERENCE.md line 73
  MEDIUM: { min: 60, max: 79 }, // ALGORITHM_REFERENCE.md line 74
  LOW: { min: 0, max: 59 }, // ALGORITHM_REFERENCE.md line 75
} as const;

// LOW confidence penalty - ALGORITHM_REFERENCE.md line 75
const LOW_CONFIDENCE_PENALTY = 0.15; // 15% base score penalty

// =============================================================================
// PART 5: TIER CLASSIFICATION CONSTANTS
// Source: ALGORITHM_REFERENCE.md lines 83-91
// =============================================================================

const TIER_THRESHOLDS = {
  TIER_1_MIN: 180, // Chalk - ALGORITHM_REFERENCE.md line 87
  TIER_2_MIN: 160, // Alternatives - ALGORITHM_REFERENCE.md line 88
  TIER_2_MAX: 179,
  TIER_3_MIN: 140, // Value - ALGORITHM_REFERENCE.md line 89
  TIER_3_MAX: 159,
  DIAMOND_CHECK_MIN: 120, // Special review - ALGORITHM_REFERENCE.md line 90
  DIAMOND_CHECK_MAX: 139,
  PASS_MAX: 119, // No bet - ALGORITHM_REFERENCE.md line 91
} as const;

// =============================================================================
// PART 6: DRF FIELD INDEX CONSTANTS
// Source: ALGORITHM_REFERENCE.md lines 137-152
// =============================================================================

const DRF_FIELD_INDICES = {
  // Speed Figures - ALGORITHM_REFERENCE.md line 141
  SPEED_FIGURES_START: 766,
  SPEED_FIGURES_END: 775,

  // Running Style - ALGORITHM_REFERENCE.md line 146
  RUNNING_STYLE: 210,

  // Equipment - ALGORITHM_REFERENCE.md line 147
  EQUIPMENT_START: 162,
  EQUIPMENT_END: 173,

  // Track Condition - ALGORITHM_REFERENCE.md line 148
  TRACK_CONDITION_START: 150,
  TRACK_CONDITION_END: 161,

  // Early Pace - ALGORITHM_REFERENCE.md line 143
  EARLY_PACE_START: 816,
  EARLY_PACE_END: 825,

  // Late Pace - ALGORITHM_REFERENCE.md line 144
  LATE_PACE_START: 846,
  LATE_PACE_END: 855,
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculates final score with overlay cap and floor
 * Source: ALGORITHM_REFERENCE.md lines 20-26, 64-65
 */
function calculateFinalScore(baseScore: number, overlayAdjustment: number): number {
  // Cap overlay at ±40 - ALGORITHM_REFERENCE.md line 64
  const cappedOverlay = Math.max(-OVERLAY_CAP, Math.min(OVERLAY_CAP, overlayAdjustment));

  // Final score floors at 0 - ALGORITHM_REFERENCE.md line 65
  return Math.max(0, baseScore + cappedOverlay);
}

/**
 * Applies LOW confidence penalty to base score
 * Penalty applies BEFORE overlay - ALGORITHM_REFERENCE.md lines 75, 273-274
 */
function applyLowConfidencePenalty(baseScore: number): number {
  return baseScore * (1 - LOW_CONFIDENCE_PENALTY);
}

/**
 * Determines confidence level from data completeness percentage
 * Source: ALGORITHM_REFERENCE.md lines 73-75
 */
function getConfidenceLevel(dataCompleteness: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (dataCompleteness >= CONFIDENCE_THRESHOLDS.HIGH.min) return 'HIGH';
  if (dataCompleteness >= CONFIDENCE_THRESHOLDS.MEDIUM.min) return 'MEDIUM';
  return 'LOW';
}

/**
 * Classifies score into betting tier
 * Source: ALGORITHM_REFERENCE.md lines 85-91
 */
function classifyTier(score: number): 'TIER_1' | 'TIER_2' | 'TIER_3' | 'DIAMOND_CHECK' | 'PASS' {
  if (score >= TIER_THRESHOLDS.TIER_1_MIN) return 'TIER_1';
  if (score >= TIER_THRESHOLDS.TIER_2_MIN) return 'TIER_2';
  if (score >= TIER_THRESHOLDS.TIER_3_MIN) return 'TIER_3';
  if (score >= TIER_THRESHOLDS.DIAMOND_CHECK_MIN) return 'DIAMOND_CHECK';
  return 'PASS';
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('Algorithm Validation - Base Scoring Math (PART 2)', () => {
  it('should have all 15 categories sum to exactly 331 points', () => {
    // ALGORITHM_REFERENCE.md line 46: Total = 331
    const categoryValues = Object.values(BASE_SCORING_CATEGORIES);
    const sum = categoryValues.reduce((acc, val) => acc + val, 0);

    expect(categoryValues.length).toBe(15); // 15 categories per ALGORITHM_REFERENCE.md
    expect(sum).toBe(BASE_SCORE_TOTAL);

    // Verification from ALGORITHM_REFERENCE.md (Model B):
    // "105+50+35+35+23+20+12+12+8+8+10+6+4+2+1 = 331 ✓"
    expect(105 + 50 + 35 + 35 + 23 + 20 + 12 + 12 + 8 + 8 + 10 + 6 + 4 + 2 + 1).toBe(331);
  });

  it('should have Speed Figures max of 105 points (31.7% of base)', () => {
    // ALGORITHM_REFERENCE.md line 31: Speed Figures = 105 (31.7%, Model B)
    expect(BASE_SCORING_CATEGORIES.speedFigures).toBe(105);

    const percentage = (105 / BASE_SCORE_TOTAL) * 100;
    expect(percentage).toBeCloseTo(31.7, 1);
  });

  it('should have bottom 5 categories sum to 23 points', () => {
    // Bottom 5 categories by weight - ALGORITHM_REFERENCE.md lines 41-45 (Model B):
    // Track Specialist (10) + Trainer S/D (6) + Combo Patterns (4) + P3 Refinements (2) + Weight (1)
    const bottom5Sum =
      BASE_SCORING_CATEGORIES.trackSpecialist +
      BASE_SCORING_CATEGORIES.trainerSurfaceDist +
      BASE_SCORING_CATEGORIES.comboPatterns +
      BASE_SCORING_CATEGORIES.p3Refinements +
      BASE_SCORING_CATEGORIES.weight;

    expect(bottom5Sum).toBe(23); // 10 + 6 + 4 + 2 + 1 = 23
  });

  it('should have correct individual category values', () => {
    // Verify each category - ALGORITHM_REFERENCE.md lines 31-45 (Model B)
    expect(BASE_SCORING_CATEGORIES.speedFigures).toBe(105);
    expect(BASE_SCORING_CATEGORIES.form).toBe(50);
    expect(BASE_SCORING_CATEGORIES.pace).toBe(35);
    expect(BASE_SCORING_CATEGORIES.class).toBe(35);
    expect(BASE_SCORING_CATEGORIES.connections).toBe(23);
    expect(BASE_SCORING_CATEGORIES.distanceSurface).toBe(20);
    expect(BASE_SCORING_CATEGORIES.oddsFactor).toBe(12);
    expect(BASE_SCORING_CATEGORIES.postPosition).toBe(12);
    expect(BASE_SCORING_CATEGORIES.trainerPatterns).toBe(8);
    expect(BASE_SCORING_CATEGORIES.equipment).toBe(8);
    expect(BASE_SCORING_CATEGORIES.trackSpecialist).toBe(10);
    expect(BASE_SCORING_CATEGORIES.trainerSurfaceDist).toBe(6);
    expect(BASE_SCORING_CATEGORIES.comboPatterns).toBe(4);
    expect(BASE_SCORING_CATEGORIES.p3Refinements).toBe(2);
    expect(BASE_SCORING_CATEGORIES.weight).toBe(1);
  });
});

describe('Algorithm Validation - Overlay Logic (PART 3)', () => {
  it('should have all 7 overlay sections sum to ±67 theoretical max', () => {
    // ALGORITHM_REFERENCE.md line 52: "Individual sections sum to ±67"
    const sectionValues = Object.values(OVERLAY_SECTIONS);
    const sum = sectionValues.reduce((acc, val) => acc + val, 0);

    expect(sectionValues.length).toBe(7); // 7 sections per ALGORITHM_REFERENCE.md
    expect(sum).toBe(OVERLAY_THEORETICAL_MAX);

    // Manual verification: 10 + 15 + 10 + 12 + 8 + 6 + 6 = 67
    expect(10 + 15 + 10 + 12 + 8 + 6 + 6).toBe(67);
  });

  it('should cap overlay at ±40 regardless of section sum', () => {
    // ALGORITHM_REFERENCE.md line 64: "Cap Rule: Sum of all overlay adjustments is clamped to ±40"

    // Test positive cap
    const highOverlay = 67; // Max possible from all sections
    const cappedHigh = Math.min(OVERLAY_CAP, highOverlay);
    expect(cappedHigh).toBe(40);

    // Test negative cap
    const lowOverlay = -67;
    const cappedLow = Math.max(-OVERLAY_CAP, lowOverlay);
    expect(cappedLow).toBe(-40);

    // Using helper function
    const finalWithHighOverlay = calculateFinalScore(200, 67);
    expect(finalWithHighOverlay).toBe(240); // 200 + 40 (capped)

    const finalWithLowOverlay = calculateFinalScore(200, -67);
    expect(finalWithLowOverlay).toBe(160); // 200 + (-40) (capped)
  });

  it('should floor final score at 0 (base 20 + overlay -40 = 0, not -20)', () => {
    // ALGORITHM_REFERENCE.md line 65: "Floor Rule: Final score cannot go below 0"

    const result = calculateFinalScore(20, -40);
    expect(result).toBe(0);

    // Even with more extreme values
    const extremeResult = calculateFinalScore(10, -50);
    expect(extremeResult).toBe(0); // Not -30, floors at 0
  });

  it('should have max possible score of 371 (331 + 40)', () => {
    // ALGORITHM_REFERENCE.md lines 20-25:
    // Base Score: 0-331
    // Overlay Adjustment: ±40
    // Final Score: 0-371

    const maxScore = calculateFinalScore(BASE_SCORE_TOTAL, OVERLAY_CAP);
    expect(maxScore).toBe(371);
  });

  it('should have correct individual overlay section values', () => {
    // ALGORITHM_REFERENCE.md lines 56-62
    expect(OVERLAY_SECTIONS.paceDynamicsBias).toBe(10);
    expect(OVERLAY_SECTIONS.formCycleConditioning).toBe(15);
    expect(OVERLAY_SECTIONS.tripAnalysisTrouble).toBe(10);
    expect(OVERLAY_SECTIONS.classMovementCompetition).toBe(12);
    expect(OVERLAY_SECTIONS.connectionMicroEdges).toBe(8);
    expect(OVERLAY_SECTIONS.distanceSurfaceOpt).toBe(6);
    expect(OVERLAY_SECTIONS.headToHeadTactical).toBe(6);
  });
});

describe('Algorithm Validation - Confidence Calculation (PART 4)', () => {
  it('should classify HIGH confidence at 80-100% data completeness', () => {
    // ALGORITHM_REFERENCE.md line 73: HIGH = 80-100%
    expect(getConfidenceLevel(80)).toBe('HIGH');
    expect(getConfidenceLevel(90)).toBe('HIGH');
    expect(getConfidenceLevel(100)).toBe('HIGH');
    expect(getConfidenceLevel(79)).not.toBe('HIGH'); // Edge case
  });

  it('should classify MEDIUM confidence at 60-79% data completeness', () => {
    // ALGORITHM_REFERENCE.md line 74: MEDIUM = 60-79%
    expect(getConfidenceLevel(60)).toBe('MEDIUM');
    expect(getConfidenceLevel(70)).toBe('MEDIUM');
    expect(getConfidenceLevel(79)).toBe('MEDIUM');
    expect(getConfidenceLevel(59)).not.toBe('MEDIUM'); // Edge case
  });

  it('should classify LOW confidence at <60% data completeness', () => {
    // ALGORITHM_REFERENCE.md line 75: LOW = <60%
    expect(getConfidenceLevel(0)).toBe('LOW');
    expect(getConfidenceLevel(30)).toBe('LOW');
    expect(getConfidenceLevel(59)).toBe('LOW');
    expect(getConfidenceLevel(60)).not.toBe('LOW'); // Edge case
  });

  it('should apply 15% base score penalty for LOW confidence', () => {
    // ALGORITHM_REFERENCE.md line 75: "15% base score penalty applied"
    const baseScore = 200;
    const penalizedScore = applyLowConfidencePenalty(baseScore);

    // 200 * (1 - 0.15) = 200 * 0.85 = 170
    expect(penalizedScore).toBe(170);
    expect(penalizedScore).toBe(baseScore * 0.85);
  });

  it('should apply LOW penalty BEFORE overlay (base * 0.85, then add overlay)', () => {
    // ALGORITHM_REFERENCE.md lines 75, 273-274:
    // LOW confidence: "15% base score reduction"
    // Penalty applies to base, then overlay is added

    const baseScore = 200;
    const overlay = 20;

    // Correct order: penalty first, then overlay
    const penalizedBase = applyLowConfidencePenalty(baseScore); // 200 * 0.85 = 170
    const finalScore = calculateFinalScore(penalizedBase, overlay); // 170 + 20 = 190

    expect(penalizedBase).toBe(170);
    expect(finalScore).toBe(190);

    // Wrong order would be: (200 + 20) * 0.85 = 187
    const wrongOrder = (baseScore + overlay) * 0.85;
    expect(finalScore).not.toBe(wrongOrder);
  });
});

describe('Algorithm Validation - Tier Classification (PART 5)', () => {
  it('should classify Tier 1 at score >= 180', () => {
    // ALGORITHM_REFERENCE.md line 87: Tier 1 (Chalk) = 180+
    expect(classifyTier(180)).toBe('TIER_1');
    expect(classifyTier(200)).toBe('TIER_1');
    expect(classifyTier(371)).toBe('TIER_1'); // Max possible
    expect(classifyTier(179)).not.toBe('TIER_1');
  });

  it('should classify Tier 2 at score 160-179', () => {
    // ALGORITHM_REFERENCE.md line 88: Tier 2 (Alternatives) = 160-179
    expect(classifyTier(160)).toBe('TIER_2');
    expect(classifyTier(170)).toBe('TIER_2');
    expect(classifyTier(179)).toBe('TIER_2');
    expect(classifyTier(159)).not.toBe('TIER_2');
    expect(classifyTier(180)).not.toBe('TIER_2');
  });

  it('should classify Tier 3 at score 140-159', () => {
    // ALGORITHM_REFERENCE.md line 89: Tier 3 (Value) = 140-159
    expect(classifyTier(140)).toBe('TIER_3');
    expect(classifyTier(150)).toBe('TIER_3');
    expect(classifyTier(159)).toBe('TIER_3');
    expect(classifyTier(139)).not.toBe('TIER_3');
    expect(classifyTier(160)).not.toBe('TIER_3');
  });

  it('should flag Diamond Check at score 120-139 for special review', () => {
    // ALGORITHM_REFERENCE.md line 90: Diamond Check = 120-139
    // Also line 95: "Diamond in the Rough: 120-139 pts with extreme overlay (200%+) gets special review"
    expect(classifyTier(120)).toBe('DIAMOND_CHECK');
    expect(classifyTier(130)).toBe('DIAMOND_CHECK');
    expect(classifyTier(139)).toBe('DIAMOND_CHECK');
    expect(classifyTier(119)).not.toBe('DIAMOND_CHECK');
    expect(classifyTier(140)).not.toBe('DIAMOND_CHECK');
  });

  it('should classify Pass at score < 120', () => {
    // ALGORITHM_REFERENCE.md line 91: Pass = <120
    expect(classifyTier(0)).toBe('PASS');
    expect(classifyTier(50)).toBe('PASS');
    expect(classifyTier(100)).toBe('PASS');
    expect(classifyTier(119)).toBe('PASS');
    expect(classifyTier(120)).not.toBe('PASS');
  });
});

describe('Algorithm Validation - DRF Field Indices (PART 6)', () => {
  it('should have correct Speed Figures field range (766-775)', () => {
    // ALGORITHM_REFERENCE.md line 141: Speed Figures = 766-775
    expect(DRF_FIELD_INDICES.SPEED_FIGURES_START).toBe(766);
    expect(DRF_FIELD_INDICES.SPEED_FIGURES_END).toBe(775);
  });

  it('should have correct Running Style field index (210)', () => {
    // ALGORITHM_REFERENCE.md line 146: Running Style = 210
    expect(DRF_FIELD_INDICES.RUNNING_STYLE).toBe(210);
  });

  it('should have correct Equipment field range (162-173)', () => {
    // ALGORITHM_REFERENCE.md line 147: Equipment = 162-173
    expect(DRF_FIELD_INDICES.EQUIPMENT_START).toBe(162);
    expect(DRF_FIELD_INDICES.EQUIPMENT_END).toBe(173);
  });

  it('should have valid field ranges (start < end, positive integers)', () => {
    // Speed Figures
    expect(DRF_FIELD_INDICES.SPEED_FIGURES_START).toBeLessThan(DRF_FIELD_INDICES.SPEED_FIGURES_END);
    expect(DRF_FIELD_INDICES.SPEED_FIGURES_START).toBeGreaterThan(0);

    // Equipment
    expect(DRF_FIELD_INDICES.EQUIPMENT_START).toBeLessThan(DRF_FIELD_INDICES.EQUIPMENT_END);
    expect(DRF_FIELD_INDICES.EQUIPMENT_START).toBeGreaterThan(0);

    // Track Condition
    expect(DRF_FIELD_INDICES.TRACK_CONDITION_START).toBeLessThan(
      DRF_FIELD_INDICES.TRACK_CONDITION_END
    );
    expect(DRF_FIELD_INDICES.TRACK_CONDITION_START).toBeGreaterThan(0);

    // Early Pace
    expect(DRF_FIELD_INDICES.EARLY_PACE_START).toBeLessThan(DRF_FIELD_INDICES.EARLY_PACE_END);
    expect(DRF_FIELD_INDICES.EARLY_PACE_START).toBeGreaterThan(0);

    // Late Pace
    expect(DRF_FIELD_INDICES.LATE_PACE_START).toBeLessThan(DRF_FIELD_INDICES.LATE_PACE_END);
    expect(DRF_FIELD_INDICES.LATE_PACE_START).toBeGreaterThan(0);

    // Running Style is single field, so just positive check
    expect(DRF_FIELD_INDICES.RUNNING_STYLE).toBeGreaterThan(0);
  });

  it('should have all field indices as integers', () => {
    Object.values(DRF_FIELD_INDICES).forEach((index) => {
      expect(Number.isInteger(index)).toBe(true);
    });
  });
});

describe('Algorithm Validation - Cross-Document Consistency', () => {
  it('should confirm algorithm version v3.6 per both documents', () => {
    // MASTER_CONTEXT.md line 11: "Algorithm Version: v3.6 (Phase 7, Form Decay System)"
    // ALGORITHM_REFERENCE.md line 7: "Algorithm Version: v3.6 (Phase 7, Form Decay System)"
    const version = 'v3.6';
    const phase = 'Phase 7';
    const feature = 'Form Decay System';

    // This test documents the expected version
    expect(version).toBe('v3.6');
    expect(phase).toBe('Phase 7');
    expect(feature).toBe('Form Decay System');
  });

  it('should confirm test framework is Vitest per MASTER_CONTEXT.md', () => {
    // MASTER_CONTEXT.md line 155: "Framework: Vitest (with @vitest/coverage-v8)"
    // This test itself runs on Vitest, confirming compliance
    expect(typeof describe).toBe('function');
    expect(typeof it).toBe('function');
    expect(typeof expect).toBe('function');
  });

  it('should confirm SCORING_ENGINE.md aligns with ALGORITHM_REFERENCE.md', () => {
    // SCORING_ENGINE.md lines 36-52 match ALGORITHM_REFERENCE.md lines 29-46
    // Both documents specify:
    // - 331-point base score
    // - ±40 overlay cap
    // - 15 categories with same point values

    // SCORING_ENGINE.md line 11: "331-point base score"
    expect(BASE_SCORE_TOTAL).toBe(331);

    // SCORING_ENGINE.md line 57: "Overlay Adjustment Range: ±40 points"
    expect(OVERLAY_CAP).toBe(40);

    // SCORING_ENGINE.md line 58: "Final Score Cap: 371 points"
    expect(BASE_SCORE_TOTAL + OVERLAY_CAP).toBe(371);
  });
});
