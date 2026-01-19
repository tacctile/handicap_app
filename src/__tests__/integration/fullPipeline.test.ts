/**
 * Full Pipeline Integration Tests
 *
 * Tests the complete data flow from DRF parse through scoring,
 * overlay pipeline, to bet recommendations.
 *
 * Verifies:
 * - Softmax probabilities are used (not linear division)
 * - Overlay pipeline integrates with scoring
 * - Bet recommendations use pipeline output
 * - Calibration status is checked during pipeline
 */

import { describe, it, expect } from 'vitest';
import {
  calculateOverlayPipeline,
  softmaxProbabilities,
  SOFTMAX_CONFIG,
  normalizeMarketProbabilities,
  MARKET_CONFIG,
  type OverlayPipelineInput,
} from '../../lib/scoring';
import { generateBetRecommendations, DEFAULT_FILTERS } from '../../lib/betting/betRecommender';
import { isCalibrationActive } from '../../lib/scoring/probabilityConversion';

// ============================================================================
// MOCK DATA
// ============================================================================

// Morning line odds that produce realistic overround (>1.0)
// 2-1, 3-1, 4-1, 5-1, 6-1, 8-1, 10-1, 12-1 = typical 8-horse field
const REALISTIC_ODDS = ['2-1', '3-1', '4-1', '5-1', '6-1', '8-1', '10-1', '12-1'];

const createMockPipelineInput = (fieldSize: number = 8): OverlayPipelineInput => ({
  horses: Array.from({ length: fieldSize }, (_, i) => ({
    programNumber: i + 1,
    horseName: `Horse ${i + 1}`,
    baseScore: 250 - i * 15, // Scores from 250 down to 145 (for 8 horses)
    finalScore: 250 - i * 15, // Same as baseScore for pipeline
    morningLineOdds: REALISTIC_ODDS[i] || '10-1',
  })),
});

// ============================================================================
// EXPORT VERIFICATION TESTS
// ============================================================================

describe('Module Export Verification', () => {
  describe('scoring/index.ts exports', () => {
    it('should export calculateOverlayPipeline', () => {
      expect(calculateOverlayPipeline).toBeDefined();
      expect(typeof calculateOverlayPipeline).toBe('function');
    });

    it('should export softmaxProbabilities', () => {
      expect(softmaxProbabilities).toBeDefined();
      expect(typeof softmaxProbabilities).toBe('function');
    });

    it('should export SOFTMAX_CONFIG', () => {
      expect(SOFTMAX_CONFIG).toBeDefined();
      expect(SOFTMAX_CONFIG.temperature).toBeDefined();
      expect(SOFTMAX_CONFIG.minProbability).toBeDefined();
      expect(SOFTMAX_CONFIG.maxProbability).toBeDefined();
      expect(SOFTMAX_CONFIG.scoreScale).toBeDefined();
    });

    it('should export normalizeMarketProbabilities', () => {
      expect(normalizeMarketProbabilities).toBeDefined();
      expect(typeof normalizeMarketProbabilities).toBe('function');
    });

    it('should export MARKET_CONFIG', () => {
      expect(MARKET_CONFIG).toBeDefined();
      expect(MARKET_CONFIG.defaultTakeout).toBeDefined();
      expect(MARKET_CONFIG.minOverround).toBeDefined();
      expect(MARKET_CONFIG.maxOverround).toBeDefined();
    });
  });

  describe('betting/index.ts exports', () => {
    it('should export generateBetRecommendations', () => {
      expect(generateBetRecommendations).toBeDefined();
      expect(typeof generateBetRecommendations).toBe('function');
    });

    it('should export DEFAULT_FILTERS', () => {
      expect(DEFAULT_FILTERS).toBeDefined();
      expect(DEFAULT_FILTERS.minEV).toBeDefined();
      expect(DEFAULT_FILTERS.minOverlayPercent).toBeDefined();
    });
  });
});

// ============================================================================
// SOFTMAX PROBABILITY TESTS
// ============================================================================

describe('Softmax Probability Conversion', () => {
  it('should produce probabilities that sum to 1.0', () => {
    const scores = [250, 220, 190, 160, 130, 100, 80, 60];
    const probs = softmaxProbabilities(scores);

    const sum = probs.reduce((acc, p) => acc + p, 0);
    expect(sum).toBeCloseTo(1.0, 3);
  });

  it('should give higher probability to higher scores', () => {
    const scores = [250, 200, 150, 100];
    const probs = softmaxProbabilities(scores);

    // Each probability should be higher than the next
    for (let i = 0; i < probs.length - 1; i++) {
      expect(probs[i]).toBeGreaterThan(probs[i + 1]!);
    }
  });

  it('should handle equal scores with equal probabilities', () => {
    const scores = [200, 200, 200, 200];
    const probs = softmaxProbabilities(scores);

    // All should be approximately equal (0.25 each)
    for (const p of probs) {
      expect(p).toBeCloseTo(0.25, 2);
    }
  });

  it('should respect min/max probability bounds', () => {
    const scores = [300, 100, 50, 20, 10]; // Extreme spread
    const probs = softmaxProbabilities(scores);

    for (const p of probs) {
      expect(p).toBeGreaterThanOrEqual(SOFTMAX_CONFIG.minProbability);
      expect(p).toBeLessThanOrEqual(SOFTMAX_CONFIG.maxProbability);
    }
  });

  it('should differ from linear probability calculation', () => {
    const scores = [250, 200, 150, 100];
    const totalScore = scores.reduce((a, b) => a + b, 0);

    // Linear probabilities
    const linearProbs = scores.map((s) => s / totalScore);

    // Softmax probabilities
    const softmaxProbs = softmaxProbabilities(scores);

    // They should NOT be equal (softmax should be different)
    let isDifferent = false;
    for (let i = 0; i < scores.length; i++) {
      if (Math.abs(linearProbs[i]! - softmaxProbs[i]!) > 0.01) {
        isDifferent = true;
        break;
      }
    }
    expect(isDifferent).toBe(true);
  });
});

// ============================================================================
// MARKET NORMALIZATION TESTS
// ============================================================================

describe('Market Probability Normalization', () => {
  it('should normalize implied probabilities to sum to 1.0', () => {
    // Typical odds-implied probabilities with overround
    const impliedProbs = [0.33, 0.25, 0.2, 0.15, 0.12, 0.1]; // Sum = 1.15 (15% overround)

    const normalized = normalizeMarketProbabilities(impliedProbs);
    const sum = normalized.reduce((acc, p) => acc + p, 0);

    expect(sum).toBeCloseTo(1.0, 3);
  });

  it('should maintain relative ordering after normalization', () => {
    const impliedProbs = [0.35, 0.25, 0.2, 0.15, 0.1];
    const normalized = normalizeMarketProbabilities(impliedProbs);

    for (let i = 0; i < normalized.length - 1; i++) {
      expect(normalized[i]).toBeGreaterThan(normalized[i + 1]!);
    }
  });

  it('should reduce each probability proportionally', () => {
    const impliedProbs = [0.4, 0.3, 0.2, 0.1]; // Sum = 1.0 (no overround)
    const normalized = normalizeMarketProbabilities(impliedProbs);

    // With no overround, should be identical
    for (let i = 0; i < impliedProbs.length; i++) {
      expect(normalized[i]).toBeCloseTo(impliedProbs[i]!, 4);
    }
  });
});

// ============================================================================
// OVERLAY PIPELINE TESTS
// ============================================================================

describe('Overlay Pipeline Integration', () => {
  it('should produce valid pipeline output', () => {
    const input = createMockPipelineInput();
    const output = calculateOverlayPipeline(input);

    expect(output).toBeDefined();
    expect(output.horses).toBeDefined();
    expect(output.horses.length).toBe(8);
    expect(output.fieldMetrics).toBeDefined();
  });

  it('should calculate model probabilities using softmax', () => {
    const input = createMockPipelineInput();
    const output = calculateOverlayPipeline(input);

    // Sum of model probabilities should be 1.0
    const probSum = output.horses.reduce((sum, h) => sum + h.modelProbability, 0);
    expect(probSum).toBeCloseTo(1.0, 2);

    // Higher scores should have higher probabilities
    const sortedByScore = [...output.horses].sort((a, b) => b.baseScore - a.baseScore);
    for (let i = 0; i < sortedByScore.length - 1; i++) {
      expect(sortedByScore[i]!.modelProbability).toBeGreaterThanOrEqual(
        sortedByScore[i + 1]!.modelProbability
      );
    }
  });

  it('should normalize market probabilities', () => {
    const input = createMockPipelineInput();
    const output = calculateOverlayPipeline(input);

    // Sum of normalized market probabilities should be 1.0
    const marketProbSum = output.horses.reduce((sum, h) => sum + h.normalizedMarketProbability, 0);
    expect(marketProbSum).toBeCloseTo(1.0, 2);
  });

  it('should calculate expected value for each horse', () => {
    const input = createMockPipelineInput();
    const output = calculateOverlayPipeline(input);

    for (const horse of output.horses) {
      expect(horse.expectedValue).toBeDefined();
      expect(typeof horse.expectedValue).toBe('number');
    }
  });

  it('should provide value classification for each horse', () => {
    const input = createMockPipelineInput();
    const output = calculateOverlayPipeline(input);

    const validClasses = ['STRONG_VALUE', 'MODERATE_VALUE', 'SLIGHT_VALUE', 'NEUTRAL', 'UNDERLAY'];

    for (const horse of output.horses) {
      expect(horse.valueClassification).toBeDefined();
      expect(validClasses).toContain(horse.valueClassification);
    }
  });

  it('should include true overlay percentage', () => {
    const input = createMockPipelineInput();
    const output = calculateOverlayPipeline(input);

    for (const horse of output.horses) {
      expect(horse.trueOverlayPercent).toBeDefined();
      expect(typeof horse.trueOverlayPercent).toBe('number');
    }
  });

  it('should indicate calibration status', () => {
    const input = createMockPipelineInput();
    const output = calculateOverlayPipeline(input);

    expect(typeof output.calibrationApplied).toBe('boolean');
  });

  it('should calculate field metrics correctly', () => {
    const input = createMockPipelineInput();
    const output = calculateOverlayPipeline(input);

    expect(output.fieldMetrics.fieldSize).toBe(8);
    expect(output.fieldMetrics.overround).toBeGreaterThan(1.0);
    expect(output.fieldMetrics.takeoutPercent).toBeGreaterThan(0);
  });
});

// ============================================================================
// BET RECOMMENDATIONS TESTS
// ============================================================================

describe('Bet Recommendations from Pipeline Output', () => {
  it('should generate recommendations from pipeline output', () => {
    const input = createMockPipelineInput();
    const pipelineOutput = calculateOverlayPipeline(input);
    const bankroll = 500;

    const recommendations = generateBetRecommendations(pipelineOutput, bankroll);

    expect(recommendations).toBeDefined();
    expect(recommendations.recommendations).toBeDefined();
    expect(recommendations.fieldSize).toBe(8);
  });

  it('should include calibration status in recommendations', () => {
    const input = createMockPipelineInput();
    const pipelineOutput = calculateOverlayPipeline(input);
    const bankroll = 500;

    const recommendations = generateBetRecommendations(pipelineOutput, bankroll);

    expect(typeof recommendations.calibrationApplied).toBe('boolean');
  });

  it('should respect minimum EV filter', () => {
    const input = createMockPipelineInput();
    const pipelineOutput = calculateOverlayPipeline(input);
    const bankroll = 500;

    const recommendations = generateBetRecommendations(pipelineOutput, bankroll);

    // All recommendations should have positive EV
    for (const rec of recommendations.recommendations) {
      expect(rec.expectedValue).toBeGreaterThanOrEqual(0);
    }
  });

  it('should include Kelly fraction for each recommendation', () => {
    const input = createMockPipelineInput();
    const pipelineOutput = calculateOverlayPipeline(input);
    const bankroll = 500;

    const recommendations = generateBetRecommendations(pipelineOutput, bankroll);

    for (const rec of recommendations.recommendations) {
      expect(rec.kellyFraction).toBeDefined();
      expect(typeof rec.kellyFraction).toBe('number');
    }
  });

  it('should calculate total exposure', () => {
    const input = createMockPipelineInput();
    const pipelineOutput = calculateOverlayPipeline(input);
    const bankroll = 500;

    const recommendations = generateBetRecommendations(pipelineOutput, bankroll);

    expect(recommendations.totalExposure).toBeDefined();
    expect(recommendations.totalExposure).toBeLessThanOrEqual(100); // Percentage
  });

  it('should handle empty race gracefully', () => {
    const emptyPipelineOutput = calculateOverlayPipeline({
      horses: [],
    });

    const recommendations = generateBetRecommendations(emptyPipelineOutput, 500);

    expect(recommendations.passSuggested).toBe(true);
    expect(recommendations.passReason).toBeDefined();
  });
});

// ============================================================================
// CALIBRATION STATUS TESTS
// ============================================================================

describe('Calibration Status in Pipeline', () => {
  it('should expose isCalibrationActive function', () => {
    expect(isCalibrationActive).toBeDefined();
    expect(typeof isCalibrationActive).toBe('function');
  });

  it('should include calibrationApplied in pipeline output', () => {
    const input = createMockPipelineInput();
    const output = calculateOverlayPipeline(input);

    expect(typeof output.calibrationApplied).toBe('boolean');
  });

  it('should work without calibration being ready', () => {
    // Even without calibration, pipeline should work
    const input = createMockPipelineInput();
    const output = calculateOverlayPipeline(input);

    // Should produce valid results regardless of calibration status
    expect(output.horses.length).toBe(8);
    expect(output.horses[0]!.modelProbability).toBeGreaterThan(0);
  });
});

// ============================================================================
// END-TO-END FLOW TESTS
// ============================================================================

describe('End-to-End Data Flow', () => {
  it('should flow: Scores -> Overlay Pipeline -> Recommendations', () => {
    // Step 1: Create scored horse data (simulating post-DRF parse)
    const scores = [250, 235, 220, 205, 190, 175, 160, 145];
    const odds = ['4-1', '6-1', '8-1', '10-1', '12-1', '15-1', '20-1', '30-1'];

    // Step 2: Build pipeline input
    const pipelineInput: OverlayPipelineInput = {
      horses: scores.map((score, i) => ({
        programNumber: i + 1,
        horseName: `Horse ${i + 1}`,
        baseScore: score,
        finalScore: score,
        morningLineOdds: odds[i]!,
      })),
    };

    // Step 3: Run overlay pipeline
    const pipelineOutput = calculateOverlayPipeline(pipelineInput);

    // Verify pipeline output
    expect(pipelineOutput.horses.length).toBe(8);

    // Verify probabilities
    const modelProbSum = pipelineOutput.horses.reduce((sum, h) => sum + h.modelProbability, 0);
    expect(modelProbSum).toBeCloseTo(1.0, 2);

    // Step 4: Generate recommendations
    const bankroll = 1000;
    const recommendations = generateBetRecommendations(pipelineOutput, bankroll);

    // Verify recommendations format
    expect(recommendations).toBeDefined();
    expect(recommendations.fieldSize).toBe(8);

    // Step 5: Verify data is ready for UI consumption
    for (const horse of pipelineOutput.horses) {
      // These fields should be present for UI display
      expect(horse.programNumber).toBeGreaterThan(0);
      expect(horse.modelProbability).toBeGreaterThan(0);
      expect(horse.trueOverlayPercent).toBeDefined();
      expect(horse.expectedValue).toBeDefined();
      expect(horse.valueClassification).toBeDefined();
    }
  });

  it('should maintain data consistency through the pipeline', () => {
    const input = createMockPipelineInput();
    const output = calculateOverlayPipeline(input);

    // Horse order should be preserved
    for (let i = 0; i < input.horses.length; i++) {
      expect(output.horses[i]!.programNumber).toBe(input.horses[i]!.programNumber);
      expect(output.horses[i]!.baseScore).toBe(input.horses[i]!.baseScore);
    }

    // Generate recommendations
    const recommendations = generateBetRecommendations(output, 500);

    // Recommendations should reference valid horses from pipeline
    for (const rec of recommendations.recommendations) {
      const pipelineHorse = output.horses.find((h) => h.programNumber === rec.programNumber);
      expect(pipelineHorse).toBeDefined();
    }
  });
});
