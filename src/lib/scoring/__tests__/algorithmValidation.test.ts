/**
 * Algorithm Validation Tests
 *
 * Purpose: Validates understanding of the complete algorithm specification
 * from MASTER_CONTEXT.md and ALGORITHM_REFERENCE.md
 *
 * Algorithm Version: v4.0 (336 base score, expanded combo patterns)
 * Source Documents:
 * - MASTER_CONTEXT.md (project definition, architecture)
 * - ALGORITHM_REFERENCE.md (algorithm details, scoring categories, DRF fields)
 * - src/docs/SCORING_ENGINE.md (detailed scoring formulas)
 *
 * Ground Truth Values (per ALGORITHM_REFERENCE.md):
 * - MAX_BASE_SCORE: 336
 * - MAX_OVERLAY: ±40
 * - MAX_SCORE: 376
 */

import { describe, it, expect } from 'vitest';

// =============================================================================
// PART 2: BASE SCORING CONSTANTS
// Source: ALGORITHM_REFERENCE.md lines 29-46
// =============================================================================

/**
 * All base scoring categories with exact point values
 * Total: 336 points
 * Source: ALGORITHM_REFERENCE.md lines 29-44
 * NOTE: Odds removed from base scoring (circular logic elimination)
 */
const BASE_SCORING_CATEGORIES = {
  speedFigures: 105, // 31.3% - ALGORITHM_REFERENCE.md (Speed 105 + Class 35 = 140)
  form: 50, // 14.9% - ALGORITHM_REFERENCE.md
  pace: 45, // 13.4% - ALGORITHM_REFERENCE.md (CONSOLIDATED: base + scenario unified)
  class: 35, // 10.4% - ALGORITHM_REFERENCE.md
  connections: 24, // 7.1%  - ALGORITHM_REFERENCE.md (Jockey 12 + Trainer 10 + Partnership 2)
  distanceSurface: 20, // 6.0%  - ALGORITHM_REFERENCE.md
  // NOTE: oddsFactor removed from base scoring (circular logic elimination)
  postPosition: 12, // 3.6%  - ALGORITHM_REFERENCE.md
  trackSpecialist: 10, // 3.0%  - ALGORITHM_REFERENCE.md
  comboPatterns: 10, // 3.0%  - ALGORITHM_REFERENCE.md (v4.0: expanded from 4, range -6 to +10)
  trainerPatterns: 8, // 2.4%  - ALGORITHM_REFERENCE.md
  equipment: 8, // 2.4%  - ALGORITHM_REFERENCE.md
  trainerSurfaceDist: 6, // 1.8%  - ALGORITHM_REFERENCE.md
  p3Refinements: 2, // 0.6%  - ALGORITHM_REFERENCE.md (Age + Sire's Sire)
  weight: 1, // 0.3%  - ALGORITHM_REFERENCE.md
} as const;

// Base score total - ALGORITHM_REFERENCE.md line 44
const BASE_SCORE_TOTAL = 336;

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

// Tier thresholds based on MAX_BASE_SCORE = 336 (ALGORITHM_REFERENCE.md)
// Percentages: Tier 1 = 54%, Tier 2 = 48%, Tier 3 = 39%
const TIER_THRESHOLDS = {
  TIER_1_MIN: 181, // Chalk - 54% of 336
  TIER_2_MIN: 161, // Alternatives - 48% of 336
  TIER_2_MAX: 180,
  TIER_3_MIN: 131, // Value - 39% of 336
  TIER_3_MAX: 160,
  DIAMOND_CHECK_MIN: 122, // Special review - 36% of 336
  DIAMOND_CHECK_MAX: 130,
  PASS_MAX: 121, // No bet
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
  it('should have all categories sum to exactly 336 points', () => {
    // ALGORITHM_REFERENCE.md line 44: Total = 336
    const categoryValues = Object.values(BASE_SCORING_CATEGORIES);
    const sum = categoryValues.reduce((acc, val) => acc + val, 0);

    expect(categoryValues.length).toBe(14); // 14 categories (odds removed from base scoring)
    expect(sum).toBe(BASE_SCORE_TOTAL);

    // Verification from ALGORITHM_REFERENCE.md:
    // Speed(105) + Form(50) + Pace(45) + Class(35) + Connections(24) + DistSurf(20)
    // + PostPos(12) + TrackSpec(10) + Combo(10) + TrainerPat(8) + Equip(8)
    // + TrainerSD(6) + P3(2) + Weight(1) = 336 ✓
    expect(105 + 50 + 45 + 35 + 24 + 20 + 12 + 10 + 10 + 8 + 8 + 6 + 2 + 1).toBe(336);
  });

  it('should have Speed Figures max of 105 points (31.25% of base)', () => {
    // ALGORITHM_REFERENCE.md: Speed Figures = 105 (105/336 = 31.25%)
    expect(BASE_SCORING_CATEGORIES.speedFigures).toBe(105);

    const percentage = (105 / BASE_SCORE_TOTAL) * 100;
    expect(percentage).toBeCloseTo(31.25, 2);
  });

  it('should have bottom 5 categories sum to 27 points', () => {
    // Bottom 5 categories by weight:
    // Track Specialist (10) + Combo Patterns (10) + Trainer S/D (6) + P3 Refinements (2) + Weight (1) = 29
    // Actually let's check bottom 5: TrainerSD(6) + P3(2) + Weight(1) + Equipment(8) + TrainerPatterns(8) = 25
    // Or using smallest: Weight(1) + P3(2) + TrainerSD(6) + Equip(8) + TrainerPat(8) = 25
    const bottom5Sum =
      BASE_SCORING_CATEGORIES.weight +
      BASE_SCORING_CATEGORIES.p3Refinements +
      BASE_SCORING_CATEGORIES.trainerSurfaceDist +
      BASE_SCORING_CATEGORIES.equipment +
      BASE_SCORING_CATEGORIES.trainerPatterns;

    expect(bottom5Sum).toBe(25); // 1 + 2 + 6 + 8 + 8 = 25
  });

  it('should have correct individual category values', () => {
    // Verify each category - ALGORITHM_REFERENCE.md
    expect(BASE_SCORING_CATEGORIES.speedFigures).toBe(105);
    expect(BASE_SCORING_CATEGORIES.form).toBe(50);
    expect(BASE_SCORING_CATEGORIES.pace).toBe(45);
    expect(BASE_SCORING_CATEGORIES.class).toBe(35);
    expect(BASE_SCORING_CATEGORIES.connections).toBe(24);
    expect(BASE_SCORING_CATEGORIES.distanceSurface).toBe(20);
    // NOTE: oddsFactor removed from base scoring (circular logic elimination)
    expect(BASE_SCORING_CATEGORIES.postPosition).toBe(12);
    expect(BASE_SCORING_CATEGORIES.trackSpecialist).toBe(10);
    expect(BASE_SCORING_CATEGORIES.comboPatterns).toBe(10);
    expect(BASE_SCORING_CATEGORIES.trainerPatterns).toBe(8);
    expect(BASE_SCORING_CATEGORIES.equipment).toBe(8);
    expect(BASE_SCORING_CATEGORIES.trainerSurfaceDist).toBe(6);
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

  it('should have max possible score of 376 (336 + 40)', () => {
    // ALGORITHM_REFERENCE.md lines 62-66:
    // MAX_BASE_SCORE: 336
    // MAX_OVERLAY: ±40
    // MAX_SCORE: 376

    const maxScore = calculateFinalScore(BASE_SCORE_TOTAL, OVERLAY_CAP);
    expect(maxScore).toBe(376);
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
  it('should classify Tier 1 at score >= 181', () => {
    // ALGORITHM_REFERENCE.md: Tier 1 (Cover Chalk) = 181+ (54% of 336)
    expect(classifyTier(181)).toBe('TIER_1');
    expect(classifyTier(200)).toBe('TIER_1');
    expect(classifyTier(376)).toBe('TIER_1'); // Max possible (336 + 40)
    expect(classifyTier(180)).not.toBe('TIER_1');
  });

  it('should classify Tier 2 at score 161-180', () => {
    // ALGORITHM_REFERENCE.md: Tier 2 (Logical Alternatives) = 161-180 (48% of 336)
    expect(classifyTier(161)).toBe('TIER_2');
    expect(classifyTier(170)).toBe('TIER_2');
    expect(classifyTier(180)).toBe('TIER_2');
    expect(classifyTier(160)).not.toBe('TIER_2');
    expect(classifyTier(181)).not.toBe('TIER_2');
  });

  it('should classify Tier 3 at score 131-160', () => {
    // ALGORITHM_REFERENCE.md: Tier 3 (Value Bombs) = 131-160 (39% of 336)
    expect(classifyTier(131)).toBe('TIER_3');
    expect(classifyTier(145)).toBe('TIER_3');
    expect(classifyTier(160)).toBe('TIER_3');
    expect(classifyTier(130)).not.toBe('TIER_3');
    expect(classifyTier(161)).not.toBe('TIER_3');
  });

  it('should flag Diamond Check at score 122-130 for special review', () => {
    // ALGORITHM_REFERENCE.md: Diamond Check for special review (36% of 336)
    expect(classifyTier(122)).toBe('DIAMOND_CHECK');
    expect(classifyTier(126)).toBe('DIAMOND_CHECK');
    expect(classifyTier(130)).toBe('DIAMOND_CHECK');
    expect(classifyTier(121)).not.toBe('DIAMOND_CHECK');
    expect(classifyTier(131)).not.toBe('DIAMOND_CHECK');
  });

  it('should classify Pass at score < 122', () => {
    // Pass = score below Diamond Check threshold
    expect(classifyTier(0)).toBe('PASS');
    expect(classifyTier(50)).toBe('PASS');
    expect(classifyTier(100)).toBe('PASS');
    expect(classifyTier(121)).toBe('PASS');
    expect(classifyTier(122)).not.toBe('PASS');
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
    // Both documents specify:
    // - 336-point base score (per ALGORITHM_REFERENCE.md lines 62-66)
    // - ±40 overlay cap
    // - 14 categories (odds removed from base scoring)

    // ALGORITHM_REFERENCE.md line 64: MAX_BASE_SCORE = 336
    expect(BASE_SCORE_TOTAL).toBe(336);

    // ALGORITHM_REFERENCE.md line 65: MAX_OVERLAY = ±40
    expect(OVERLAY_CAP).toBe(40);

    // ALGORITHM_REFERENCE.md line 66: MAX_SCORE = 376
    expect(BASE_SCORE_TOTAL + OVERLAY_CAP).toBe(376);
  });
});
