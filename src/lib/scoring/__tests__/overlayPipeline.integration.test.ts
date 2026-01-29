/**
 * Integration Tests for Overlay Pipeline Module
 *
 * Tests the full integration flow including:
 * - Integration with existing scoring system
 * - Tier recalculation with adjustments
 * - Calibration logging
 * - Edge cases with missing odds
 *
 * @module scoring/__tests__/overlayPipeline.integration.test
 */

import { describe, test, expect } from 'vitest';
import {
  calculateOverlayPipeline,
  enhanceScoringWithOverlay,
  logForCalibration,
  type OverlayPipelineInput,
} from '../overlayPipeline';
import type { HorseScore, ScoreBreakdown } from '../index';

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

/**
 * Create a mock HorseScore for testing
 */
function createMockHorseScore(overrides: Partial<HorseScore> = {}): HorseScore {
  const mockBreakdown: ScoreBreakdown = {
    connections: {
      total: 15,
      trainer: 8,
      jockey: 5,
      partnershipBonus: 2,
      reasoning: 'Test connections',
    },
    postPosition: {
      total: 6,
      trackBiasApplied: false,
      isGoldenPost: false,
      reasoning: 'Test post',
    },
    speedClass: {
      total: 100,
      speedScore: 75,
      classScore: 25,
      bestFigure: 85,
      classMovement: 'lateral',
      reasoning: 'Test speed/class',
    },
    form: {
      total: 35,
      recentFormScore: 20,
      layoffScore: 10,
      consistencyBonus: 5,
      formTrend: 'improving',
      reasoning: 'Test form',
      wonLastOut: false,
      won2OfLast3: false,
    },
    equipment: {
      total: 4,
      hasChanges: true,
      reasoning: 'First-time blinkers',
    },
    pace: {
      total: 25,
      runningStyle: 'E/P',
      paceFit: 'favorable',
      reasoning: 'Test pace',
    },
    // NOTE: odds removed from breakdown (circular logic elimination)
    distanceSurface: {
      total: 12,
      turfScore: 6,
      wetScore: 2,
      distanceScore: 4,
      turfWinRate: 0.25,
      wetWinRate: 0.15,
      distanceWinRate: 0.2,
      reasoning: ['Good turf record'],
    },
    trainerPatterns: {
      total: 5,
      matchedPatterns: [],
      reasoning: ['Test pattern'],
    },
    comboPatterns: {
      total: 3,
      detectedCombos: [],
      intentScore: 2,
      reasoning: ['Test combo'],
    },
    trackSpecialist: {
      total: 4,
      trackWinRate: 0.22,
      trackITMRate: 0.45,
      isSpecialist: true,
      reasoning: 'Test specialist',
    },
    trainerSurfaceDistance: {
      total: 3,
      matchedCategory: 'turf_route',
      trainerWinPercent: 18,
      wetTrackWinPercent: 12,
      wetBonusApplied: false,
      reasoning: 'Test trainer surface',
    },
    weightAnalysis: {
      total: 1,
      currentWeight: 120,
      lastRaceWeight: 122,
      weightChange: -2,
      significantDrop: true,
      significantGain: false,
      showWeightGainFlag: false,
      reasoning: 'Test weight',
    },
    sexAnalysis: {
      total: 0,
      horseSex: 'C',
      isFemale: false,
      isRestrictedRace: false,
      isMixedRace: false,
      isFirstTimeFacingMales: false,
      flags: [],
      reasoning: 'Test sex',
    },
    // NOTE: workouts removed from base scoring (v4.1 reverted due to regression)
  };

  return {
    total: 210,
    baseScore: 200,
    overlayScore: 10,
    // NOTE: oddsScore removed from base scoring (circular logic elimination)
    breakdown: mockBreakdown,
    isScratched: false,
    confidenceLevel: 'high',
    dataQuality: 85,
    dataCompleteness: {
      overallScore: 85,
      overallGrade: 'B',
      criticalComplete: 90,
      highComplete: 80,
      mediumComplete: 75,
      lowComplete: 60,
      hasSpeedFigures: true,
      hasPastPerformances: true,
      hasTrainerStats: true,
      hasJockeyStats: true,
      hasRunningStyle: true,
      hasPaceFigures: true,
      missingCritical: [],
      missingHigh: [],
      isLowConfidence: false,
      confidenceReason: null,
    },
    lowConfidencePenaltyApplied: false,
    lowConfidencePenaltyAmount: 0,
    paperTigerPenaltyApplied: false,
    paperTigerPenaltyAmount: 0,
    keyRaceIndexBonus: 0,
    fieldSpreadAdjustment: 0,
    ...overrides,
  };
}

/**
 * Create field data for testing
 */
function createMockFieldData() {
  return [
    { programNumber: 1, baseScore: 200, finalScore: 210 },
    { programNumber: 2, baseScore: 180, finalScore: 190 },
    { programNumber: 3, baseScore: 160, finalScore: 170 },
    { programNumber: 4, baseScore: 140, finalScore: 150 },
  ];
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Overlay Pipeline Integration', () => {
  describe('Full flow from scores to enhanced result', () => {
    test('should enhance scoring result with overlay pipeline data', () => {
      const scoringResult = createMockHorseScore();
      const marketOdds = new Map<number, number>([
        [1, 3.0], // 2-1
        [2, 4.0], // 3-1
        [3, 6.0], // 5-1
        [4, 9.0], // 8-1
      ]);
      const fieldData = createMockFieldData();

      const enhanced = enhanceScoringWithOverlay(scoringResult, 1, marketOdds, fieldData);

      // Original fields preserved
      expect(enhanced.originalScore).toBe(scoringResult);
      expect(enhanced.originalScore.baseScore).toBe(200);
      expect(enhanced.originalScore.total).toBe(210);

      // New fields added
      expect(enhanced.overlayPipeline).toBeDefined();
      expect(enhanced.overlayPipeline.modelProbability).toBeGreaterThan(0);
      expect(enhanced.overlayPipeline.normalizedMarketProbability).toBeGreaterThan(0);
      expect(enhanced.enhancedFinalScore).toBeDefined();
      expect(enhanced.enhancedTier).toBeDefined();
      expect(enhanced.programNumber).toBe(1);
    });

    test('should preserve all original scoring fields', () => {
      const scoringResult = createMockHorseScore();
      const marketOdds = new Map<number, number>([
        [1, 3.0],
        [2, 4.0],
      ]);
      const fieldData = [
        { programNumber: 1, baseScore: 200, finalScore: 210 },
        { programNumber: 2, baseScore: 180, finalScore: 190 },
      ];

      const enhanced = enhanceScoringWithOverlay(scoringResult, 1, marketOdds, fieldData);

      // Check all original fields are accessible
      expect(enhanced.originalScore.baseScore).toBe(200);
      expect(enhanced.originalScore.overlayScore).toBe(10);
      // NOTE: oddsScore removed from base scoring (circular logic elimination)
      expect(enhanced.originalScore.confidenceLevel).toBe('high');
      expect(enhanced.originalScore.dataQuality).toBe(85);
      expect(enhanced.originalScore.breakdown.speedClass.total).toBe(100);
      expect(enhanced.originalScore.breakdown.form.total).toBe(35);
    });

    test('should add all new overlay pipeline fields', () => {
      const scoringResult = createMockHorseScore();
      const marketOdds = new Map<number, number>([[1, 4.0]]);
      const fieldData = [{ programNumber: 1, baseScore: 200, finalScore: 210 }];

      const enhanced = enhanceScoringWithOverlay(scoringResult, 1, marketOdds, fieldData);

      // Check new overlay pipeline fields
      expect(typeof enhanced.overlayPipeline.modelProbability).toBe('number');
      expect(typeof enhanced.overlayPipeline.rawImpliedProbability).toBe('number');
      expect(typeof enhanced.overlayPipeline.normalizedMarketProbability).toBe('number');
      expect(typeof enhanced.overlayPipeline.trueOverlayPercent).toBe('number');
      expect(typeof enhanced.overlayPipeline.rawOverlayPercent).toBe('number');
      expect(typeof enhanced.overlayPipeline.fairOdds).toBe('number');
      expect(typeof enhanced.overlayPipeline.expectedValue).toBe('number');
      expect(typeof enhanced.overlayPipeline.overlayAdjustment).toBe('number');
      expect(enhanced.overlayPipeline.valueClassification).toBeDefined();
      expect(enhanced.overlayPipeline.evClassification).toBeDefined();
    });
  });

  describe('Tier recalculation with adjustments', () => {
    test('should recalculate tier based on base score', () => {
      const eliteScore = createMockHorseScore({ baseScore: 280 });
      const strongScore = createMockHorseScore({ baseScore: 230 });
      const contenderScore = createMockHorseScore({ baseScore: 180 });
      const fairScore = createMockHorseScore({ baseScore: 130 });
      const weakScore = createMockHorseScore({ baseScore: 80 });

      const marketOdds = new Map<number, number>([[1, 3.0]]);
      const fieldData = [{ programNumber: 1, baseScore: 200, finalScore: 200 }];

      const eliteEnhanced = enhanceScoringWithOverlay(eliteScore, 1, marketOdds, fieldData);
      const strongEnhanced = enhanceScoringWithOverlay(strongScore, 1, marketOdds, fieldData);
      const contenderEnhanced = enhanceScoringWithOverlay(contenderScore, 1, marketOdds, fieldData);
      const fairEnhanced = enhanceScoringWithOverlay(fairScore, 1, marketOdds, fieldData);
      const weakEnhanced = enhanceScoringWithOverlay(weakScore, 1, marketOdds, fieldData);

      expect(eliteEnhanced.enhancedTier).toBe('Elite');
      expect(strongEnhanced.enhancedTier).toBe('Strong');
      expect(contenderEnhanced.enhancedTier).toBe('Contender');
      expect(fairEnhanced.enhancedTier).toBe('Fair');
      expect(weakEnhanced.enhancedTier).toBe('Weak');
    });

    test('should calculate enhanced final score with overlay adjustment', () => {
      const scoringResult = createMockHorseScore({
        baseScore: 200,
        overlayScore: 10,
        total: 210,
      });

      const marketOdds = new Map<number, number>([
        [1, 15.0], // Value horse - high odds but high score
        [2, 2.0],
      ]);
      const fieldData = [
        { programNumber: 1, baseScore: 200, finalScore: 210 },
        { programNumber: 2, baseScore: 100, finalScore: 100 },
      ];

      const enhanced = enhanceScoringWithOverlay(scoringResult, 1, marketOdds, fieldData);

      // Enhanced score should include value overlay adjustment
      expect(enhanced.enhancedFinalScore).toBeDefined();
      // If value adjustment is positive, enhanced should reflect it
      if (enhanced.overlayPipeline.overlayAdjustment > 0) {
        expect(enhanced.valueOverlayApplied).toBe(true);
      }
    });

    test('should respect ±40 total cap for overlay adjustments', () => {
      const scoringResult = createMockHorseScore({
        baseScore: 200,
        overlayScore: 35, // Already near cap
        total: 235,
      });

      // Create extreme value scenario
      const marketOdds = new Map<number, number>([
        [1, 50.0], // Extreme value
        [2, 1.5],
      ]);
      const fieldData = [
        { programNumber: 1, baseScore: 250, finalScore: 285 },
        { programNumber: 2, baseScore: 100, finalScore: 100 },
      ];

      const enhanced = enhanceScoringWithOverlay(scoringResult, 1, marketOdds, fieldData);

      // Total overlay (existing + value) should not exceed ±40
      const totalOverlay = enhanced.enhancedFinalScore - enhanced.originalScore.baseScore;
      expect(totalOverlay).toBeLessThanOrEqual(40);
      expect(totalOverlay).toBeGreaterThanOrEqual(-40);
    });
  });

  describe('Calibration logging', () => {
    test('should call calibration logging when enabled', async () => {
      const input: OverlayPipelineInput = {
        horses: [
          { programNumber: 1, baseScore: 200, finalScore: 210, morningLineOdds: '3-1' },
          { programNumber: 2, baseScore: 180, finalScore: 190, morningLineOdds: '5-1' },
        ],
      };

      const pipelineOutput = calculateOverlayPipeline(input);
      const records = await logForCalibration(pipelineOutput, 'TEST-RACE-001', true);

      expect(records).toHaveLength(2);
      expect(records[0]!.raceId).toBe('TEST-RACE-001');
      expect(records[0]!.modelProbability).toBeGreaterThan(0);
    });

    test('should not create records when logging disabled', async () => {
      const input: OverlayPipelineInput = {
        horses: [{ programNumber: 1, baseScore: 200, finalScore: 210, morningLineOdds: '3-1' }],
      };

      const pipelineOutput = calculateOverlayPipeline(input);
      const records = await logForCalibration(pipelineOutput, 'TEST-RACE-002', false);

      expect(records).toHaveLength(0);
    });
  });

  describe('Missing odds fallback', () => {
    test('should use morning line fallback for missing odds', () => {
      const input: OverlayPipelineInput = {
        horses: [
          { programNumber: 1, baseScore: 200, finalScore: 210, morningLineOdds: '3-1' },
          { programNumber: 2, baseScore: 180, finalScore: 190, morningLineOdds: '5-1' },
        ],
      };

      // No live odds provided - should use morning line
      const result = calculateOverlayPipeline(input);

      expect(result.horses).toHaveLength(2);
      // First horse at 3-1 should have implied prob ~25%
      expect(result.horses[0]!.rawImpliedProbability).toBeCloseTo(0.25, 1);
      // Second horse at 5-1 should have implied prob ~16.7%
      expect(result.horses[1]!.rawImpliedProbability).toBeCloseTo(0.167, 1);
    });

    test('should handle numeric odds correctly', () => {
      const input: OverlayPipelineInput = {
        horses: [
          { programNumber: 1, baseScore: 200, finalScore: 210, morningLineOdds: 4.0 }, // Decimal
          { programNumber: 2, baseScore: 180, finalScore: 190, morningLineOdds: 6.0 }, // Decimal
        ],
      };

      const result = calculateOverlayPipeline(input);

      // 4.0 decimal = 25% implied
      expect(result.horses[0]!.rawImpliedProbability).toBeCloseTo(0.25, 2);
      // 6.0 decimal = 16.67% implied
      expect(result.horses[1]!.rawImpliedProbability).toBeCloseTo(0.167, 2);
    });

    test('should handle various odds string formats', () => {
      const input: OverlayPipelineInput = {
        horses: [
          { programNumber: 1, baseScore: 200, finalScore: 200, morningLineOdds: 'EVEN' },
          { programNumber: 2, baseScore: 180, finalScore: 180, morningLineOdds: '5/2' },
          { programNumber: 3, baseScore: 160, finalScore: 160, morningLineOdds: '3-1' },
        ],
      };

      const result = calculateOverlayPipeline(input);

      // EVEN = 2.0 decimal = 50% implied
      expect(result.horses[0]!.rawImpliedProbability).toBeCloseTo(0.5, 2);
      // 5/2 = 3.5 decimal = 28.6% implied
      expect(result.horses[1]!.rawImpliedProbability).toBeCloseTo(0.286, 2);
      // 3-1 = 4.0 decimal = 25% implied
      expect(result.horses[2]!.rawImpliedProbability).toBeCloseTo(0.25, 2);
    });
  });

  describe('Edge cases', () => {
    test('should handle horse not found in field data', () => {
      const scoringResult = createMockHorseScore();
      const marketOdds = new Map<number, number>([[5, 4.0]]); // Different program number
      const fieldData = [
        { programNumber: 5, baseScore: 180, finalScore: 190 }, // Different horse
      ];

      // Looking for program number 1 which doesn't exist
      const enhanced = enhanceScoringWithOverlay(scoringResult, 1, marketOdds, fieldData);

      // Should return fallback values
      expect(enhanced.programNumber).toBe(1);
      expect(enhanced.overlayPipeline.valueClassification).toBe('NEUTRAL');
      expect(enhanced.overlayPipeline.overlayAdjustment).toBe(0);
      expect(enhanced.valueOverlayApplied).toBe(false);
    });

    test('should handle single horse field', () => {
      const input: OverlayPipelineInput = {
        horses: [{ programNumber: 1, baseScore: 200, finalScore: 210, morningLineOdds: '3-1' }],
      };

      const result = calculateOverlayPipeline(input);

      expect(result.horses).toHaveLength(1);
      // Single horse gets 100% model probability
      expect(result.horses[0]!.modelProbability).toBe(1);
      expect(result.fieldMetrics.probsValidated).toBe(true);
    });

    test('should handle extreme score differences', () => {
      const input: OverlayPipelineInput = {
        horses: [
          { programNumber: 1, baseScore: 300, finalScore: 300, morningLineOdds: '2-1' },
          { programNumber: 2, baseScore: 50, finalScore: 50, morningLineOdds: '50-1' },
        ],
      };

      const result = calculateOverlayPipeline(input);

      // Should handle gracefully
      expect(result.horses).toHaveLength(2);
      expect(result.horses[0]!.modelProbability).toBeGreaterThan(
        result.horses[1]!.modelProbability
      );
    });
  });
});

describe('Scenario D - Enhanced Scoring Integration', () => {
  test('should complete full integration flow', () => {
    // Step 1: Create mock scoring results
    const horse1Score = createMockHorseScore({
      baseScore: 200,
      overlayScore: 10,
      total: 210,
    });

    const horse2Score = createMockHorseScore({
      baseScore: 180,
      overlayScore: 5,
      total: 185,
    });

    // Step 2: Set up market odds
    const marketOdds = new Map<number, number>([
      [1, 4.0], // 3-1
      [2, 5.0], // 4-1
    ]);

    // Step 3: Set up field data
    const fieldData = [
      { programNumber: 1, baseScore: 200, finalScore: 210 },
      { programNumber: 2, baseScore: 180, finalScore: 185 },
    ];

    // Step 4: Enhance both horses
    const enhanced1 = enhanceScoringWithOverlay(horse1Score, 1, marketOdds, fieldData);
    const enhanced2 = enhanceScoringWithOverlay(horse2Score, 2, marketOdds, fieldData);

    // Step 5: Verify original fields preserved
    expect(enhanced1.originalScore.baseScore).toBe(200);
    expect(enhanced2.originalScore.baseScore).toBe(180);

    // Step 6: Verify new fields added
    expect(enhanced1.overlayPipeline.modelProbability).toBeGreaterThan(
      enhanced2.overlayPipeline.modelProbability
    );

    // Step 7: Verify final score reflects overlay adjustment
    expect(enhanced1.enhancedFinalScore).toBeDefined();
    expect(enhanced2.enhancedFinalScore).toBeDefined();

    // Step 8: Verify tier potentially shifts based on adjustment
    expect(['Elite', 'Strong', 'Contender', 'Fair', 'Weak']).toContain(enhanced1.enhancedTier);
    expect(['Elite', 'Strong', 'Contender', 'Fair', 'Weak']).toContain(enhanced2.enhancedTier);
  });
});
