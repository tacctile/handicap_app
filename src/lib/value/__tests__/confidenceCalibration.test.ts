/**
 * Tests for Confidence Calibration module
 *
 * @vitest
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDefaultCalibration,
  scoreToWinProbability,
  probabilityToScoreRange,
  calculateBrierScore,
  calculateLogLoss,
  calculateCalibrationError,
  calculateTierMetrics,
  calculateCalibrationMetrics,
  generateCalibrationSummary,
  suggestAdjustedProbabilities,
  saveCalibrationResult,
  loadCalibrationResults,
  saveCalibrationProfile,
  loadCalibrationProfile,
  clearCalibrationData,
  DEFAULT_TIERS,
  BRIER_THRESHOLDS,
  MIN_CALIBRATION_SAMPLES,
  type CalibrationResult,
  type CalibrationProfile,
} from '../confidenceCalibration';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('getDefaultCalibration', () => {
  it('should return a valid calibration profile', () => {
    const calibration = getDefaultCalibration();

    expect(calibration.name).toBe('Default Calibration');
    expect(calibration.tiers).toBeDefined();
    expect(calibration.tiers.length).toBeGreaterThan(0);
    expect(calibration.isDefault).toBe(true);
  });

  it('should have tiers covering full score range', () => {
    const calibration = getDefaultCalibration();

    // Verify tiers cover full score range (0-330)
    const minScore = Math.min(...calibration.tiers.map((t) => t.minScore));
    const maxScore = Math.max(...calibration.tiers.map((t) => t.maxScore));

    expect(minScore).toBe(0);
    expect(maxScore).toBeGreaterThanOrEqual(320); // Covers top tier
  });
});

describe('DEFAULT_TIERS', () => {
  it('should have correct tier probabilities', () => {
    const eliteTier = DEFAULT_TIERS.find((t) => t.minScore >= 200);
    expect(eliteTier?.winProbability).toBe(75);

    const strongTier = DEFAULT_TIERS.find((t) => t.minScore === 178);
    expect(strongTier?.winProbability).toBe(65);

    const poorTier = DEFAULT_TIERS.find((t) => t.maxScore <= 98);
    expect(poorTier?.winProbability).toBe(15);
  });

  it('should have non-overlapping tiers', () => {
    // Tiers are sorted from high score to low score
    // Each tier's minScore should equal the next tier's maxScore
    for (let i = 0; i < DEFAULT_TIERS.length - 1; i++) {
      const currentTier = DEFAULT_TIERS[i];
      const nextTier = DEFAULT_TIERS[i + 1];
      expect(currentTier).toBeDefined();
      expect(nextTier).toBeDefined();
      if (currentTier && nextTier) {
        expect(currentTier.minScore).toBe(nextTier.maxScore);
      }
    }
  });
});

describe('scoreToWinProbability', () => {
  it('should use default calibration when none provided', () => {
    const prob = scoreToWinProbability(180);
    expect(prob).toBeGreaterThan(0);
    expect(prob).toBeLessThanOrEqual(100);
  });

  it('should respect calibration profile', () => {
    const customCalibration: CalibrationProfile = {
      name: 'Custom',
      tiers: [
        // Create a tier that covers our test score with no interpolation
        { minScore: 145, maxScore: 155, winProbability: 50, label: 'Test Range' },
        { minScore: 0, maxScore: 145, winProbability: 30, label: 'Low' },
      ],
      lastUpdated: new Date().toISOString(),
      sampleSize: 100,
      isDefault: false,
    };

    const prob = scoreToWinProbability(150, customCalibration);
    // Should be around 50% (within interpolation)
    expect(prob).toBeGreaterThanOrEqual(40);
    expect(prob).toBeLessThanOrEqual(60);
  });

  it('should interpolate within tiers', () => {
    const lowProb = scoreToWinProbability(180);
    const midProb = scoreToWinProbability(190);
    const highProb = scoreToWinProbability(199);

    // Probability should increase as score increases within tier
    expect(midProb).toBeGreaterThanOrEqual(lowProb);
    expect(highProb).toBeGreaterThanOrEqual(midProb);
  });

  it('should handle edge cases', () => {
    expect(scoreToWinProbability(0)).toBeGreaterThan(0);
    expect(scoreToWinProbability(240)).toBeLessThanOrEqual(85);
    expect(scoreToWinProbability(-10)).toBeGreaterThan(0);
    expect(scoreToWinProbability(300)).toBeLessThanOrEqual(85);
  });
});

describe('probabilityToScoreRange', () => {
  it('should return score range for probability', () => {
    const range = probabilityToScoreRange(65);

    expect(range.min).toBeDefined();
    expect(range.max).toBeDefined();
    expect(range.max).toBeGreaterThan(range.min);
    expect(range.label).toBeDefined();
  });

  it('should return unknown for unusual probabilities', () => {
    const range = probabilityToScoreRange(99);
    // Should still return a valid range
    expect(range.min).toBeDefined();
    expect(range.max).toBeDefined();
  });
});

describe('calculateBrierScore', () => {
  it('should return 0 for perfect predictions', () => {
    const results: CalibrationResult[] = [
      { score: 200, predictedProb: 100, actualOutcome: 1, odds: '1-1', timestamp: '' },
      { score: 100, predictedProb: 0, actualOutcome: 0, odds: '10-1', timestamp: '' },
    ];

    const brier = calculateBrierScore(results);
    expect(brier).toBe(0);
  });

  it('should return ~0.25 for 50% predictions on random outcomes', () => {
    // With enough 50/50 predictions, Brier should approach 0.25
    const results: CalibrationResult[] = [];
    for (let i = 0; i < 100; i++) {
      results.push({
        score: 150,
        predictedProb: 50,
        actualOutcome: i % 2 === 0 ? 1 : 0,
        odds: '1-1',
        timestamp: '',
      });
    }

    const brier = calculateBrierScore(results);
    expect(brier).toBeCloseTo(0.25, 1);
  });

  it('should return higher score for worse predictions', () => {
    const goodPredictions: CalibrationResult[] = [
      { score: 180, predictedProb: 80, actualOutcome: 1, odds: '1-1', timestamp: '' },
      { score: 120, predictedProb: 20, actualOutcome: 0, odds: '5-1', timestamp: '' },
    ];

    const badPredictions: CalibrationResult[] = [
      { score: 180, predictedProb: 80, actualOutcome: 0, odds: '1-1', timestamp: '' },
      { score: 120, predictedProb: 20, actualOutcome: 1, odds: '5-1', timestamp: '' },
    ];

    expect(calculateBrierScore(badPredictions)).toBeGreaterThan(
      calculateBrierScore(goodPredictions)
    );
  });

  it('should return 0.25 for empty results', () => {
    expect(calculateBrierScore([])).toBe(0.25);
  });
});

describe('calculateLogLoss', () => {
  it('should return lower loss for better predictions', () => {
    const goodPredictions: CalibrationResult[] = [
      { score: 180, predictedProb: 80, actualOutcome: 1, odds: '1-1', timestamp: '' },
    ];

    const badPredictions: CalibrationResult[] = [
      { score: 180, predictedProb: 80, actualOutcome: 0, odds: '1-1', timestamp: '' },
    ];

    expect(calculateLogLoss(badPredictions)).toBeGreaterThan(calculateLogLoss(goodPredictions));
  });

  it('should return 1 for empty results', () => {
    expect(calculateLogLoss([])).toBe(1);
  });
});

describe('calculateCalibrationError', () => {
  it('should return 0 for well-calibrated predictions', () => {
    // Create predictions where actual matches predicted
    const results: CalibrationResult[] = [];

    // 50% predictions, 50% actual
    for (let i = 0; i < 20; i++) {
      results.push({
        score: 150,
        predictedProb: 50,
        actualOutcome: i < 10 ? 1 : 0,
        odds: '1-1',
        timestamp: '',
      });
    }

    const error = calculateCalibrationError(results);
    expect(error).toBeLessThan(0.1);
  });

  it('should return 0 for too few results', () => {
    const results: CalibrationResult[] = [
      { score: 180, predictedProb: 80, actualOutcome: 1, odds: '1-1', timestamp: '' },
    ];

    expect(calculateCalibrationError(results)).toBe(0);
  });
});

describe('calculateTierMetrics', () => {
  it('should calculate metrics for a tier', () => {
    const results: CalibrationResult[] = [
      { score: 185, predictedProb: 65, actualOutcome: 1, odds: '3-1', timestamp: '' },
      { score: 190, predictedProb: 68, actualOutcome: 0, odds: '3-1', timestamp: '' },
      { score: 195, predictedProb: 70, actualOutcome: 1, odds: '3-1', timestamp: '' },
    ];

    const metrics = calculateTierMetrics('Strong (180-199)', results, 65);

    expect(metrics.tierLabel).toBe('Strong (180-199)');
    expect(metrics.sampleCount).toBe(3);
    expect(metrics.predictedWinRate).toBeCloseTo(67.67, 0);
    expect(metrics.actualWinRate).toBeCloseTo(66.67, 0);
  });

  it('should return zero metrics for empty results', () => {
    const metrics = calculateTierMetrics('Test', [], 50);

    expect(metrics.sampleCount).toBe(0);
    expect(metrics.actualWinRate).toBe(0);
    expect(metrics.roiPercent).toBe(0);
  });
});

describe('calculateCalibrationMetrics', () => {
  it('should calculate full calibration metrics', () => {
    const results: CalibrationResult[] = [
      { score: 185, predictedProb: 65, actualOutcome: 1, odds: '3-1', timestamp: '' },
      { score: 145, predictedProb: 45, actualOutcome: 0, odds: '5-1', timestamp: '' },
      { score: 105, predictedProb: 25, actualOutcome: 0, odds: '10-1', timestamp: '' },
    ];

    const metrics = calculateCalibrationMetrics(results);

    expect(metrics.brierScore).toBeDefined();
    expect(metrics.logLoss).toBeDefined();
    expect(metrics.calibrationError).toBeDefined();
    expect(metrics.predictionCount).toBe(3);
    expect(metrics.tierMetrics).toBeDefined();
  });
});

describe('generateCalibrationSummary', () => {
  it('should generate summary with recommendations', () => {
    const results: CalibrationResult[] = [];
    for (let i = 0; i < 50; i++) {
      results.push({
        score: 150,
        predictedProb: 50,
        actualOutcome: i % 2 === 0 ? 1 : 0,
        odds: '2-1',
        timestamp: '',
      });
    }

    const metrics = calculateCalibrationMetrics(results);
    const summary = generateCalibrationSummary(metrics);

    expect(summary.overallAccuracy).toBeDefined();
    expect(summary.brierInterpretation).toBeDefined();
    expect(Array.isArray(summary.adjustments)).toBe(true);
    expect(Array.isArray(summary.suggestions)).toBe(true);
  });

  it('should suggest more samples when insufficient data', () => {
    const results: CalibrationResult[] = [
      { score: 180, predictedProb: 65, actualOutcome: 1, odds: '3-1', timestamp: '' },
    ];

    const metrics = calculateCalibrationMetrics(results);
    const summary = generateCalibrationSummary(metrics);

    const needsMoreSamples = summary.suggestions.some(
      (s) => s.toLowerCase().includes('need') && s.toLowerCase().includes('more')
    );
    expect(needsMoreSamples).toBe(true);
  });
});

describe('suggestAdjustedProbabilities', () => {
  it('should suggest adjustments based on actual outcomes', () => {
    // Create results where actual significantly differs from predicted
    const results: CalibrationResult[] = [];

    // 65% predicted, 80% actual
    for (let i = 0; i < 50; i++) {
      results.push({
        score: 185,
        predictedProb: 65,
        actualOutcome: i < 40 ? 1 : 0, // 80% wins
        odds: '3-1',
        timestamp: '',
      });
    }

    const metrics = calculateCalibrationMetrics(results);
    const currentCalibration = getDefaultCalibration();
    const adjusted = suggestAdjustedProbabilities(metrics, currentCalibration);

    expect(adjusted.isDefault).toBe(false);
    expect(adjusted.name).toBe('Adjusted Calibration');
  });

  it('should not adjust tiers with insufficient samples', () => {
    const results: CalibrationResult[] = [
      { score: 185, predictedProb: 65, actualOutcome: 1, odds: '3-1', timestamp: '' },
    ];

    const metrics = calculateCalibrationMetrics(results);
    const currentCalibration = getDefaultCalibration();
    const adjusted = suggestAdjustedProbabilities(metrics, currentCalibration);

    // With insufficient samples, probabilities should remain unchanged
    const strongTier = adjusted.tiers.find((t) => t.minScore === 180);
    const originalTier = currentCalibration.tiers.find((t) => t.minScore === 180);

    expect(strongTier?.winProbability).toBe(originalTier?.winProbability);
  });
});

describe('Storage Functions', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    clearCalibrationData();
  });

  describe('saveCalibrationResult and loadCalibrationResults', () => {
    it('should save and load results', () => {
      const result: CalibrationResult = {
        score: 180,
        predictedProb: 65,
        actualOutcome: 1,
        odds: '3-1',
        timestamp: new Date().toISOString(),
      };

      saveCalibrationResult(result);
      const loaded = loadCalibrationResults();

      expect(loaded.length).toBe(1);
      const firstResult = loaded[0];
      expect(firstResult).toBeDefined();
      expect(firstResult?.score).toBe(180);
    });

    it('should limit stored results to 1000', () => {
      for (let i = 0; i < 1005; i++) {
        saveCalibrationResult({
          score: 150,
          predictedProb: 50,
          actualOutcome: 1,
          odds: '2-1',
          timestamp: '',
        });
      }

      const loaded = loadCalibrationResults();
      expect(loaded.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('saveCalibrationProfile and loadCalibrationProfile', () => {
    it('should save and load profile', () => {
      const profile: CalibrationProfile = {
        name: 'Custom Profile',
        tiers: DEFAULT_TIERS,
        lastUpdated: new Date().toISOString(),
        sampleSize: 500,
        isDefault: false,
      };

      saveCalibrationProfile(profile);
      const loaded = loadCalibrationProfile();

      expect(loaded.name).toBe('Custom Profile');
      expect(loaded.sampleSize).toBe(500);
    });

    it('should return default when no profile saved', () => {
      const loaded = loadCalibrationProfile();
      expect(loaded.isDefault).toBe(true);
    });
  });

  describe('clearCalibrationData', () => {
    it('should clear all calibration data', () => {
      saveCalibrationResult({
        score: 180,
        predictedProb: 65,
        actualOutcome: 1,
        odds: '3-1',
        timestamp: '',
      });

      clearCalibrationData();

      expect(loadCalibrationResults().length).toBe(0);
      expect(loadCalibrationProfile().isDefault).toBe(true);
    });
  });
});

describe('BRIER_THRESHOLDS', () => {
  it('should have correct threshold values', () => {
    expect(BRIER_THRESHOLDS.excellent).toBeLessThan(BRIER_THRESHOLDS.good);
    expect(BRIER_THRESHOLDS.good).toBeLessThan(BRIER_THRESHOLDS.fair);
    expect(BRIER_THRESHOLDS.fair).toBeLessThan(BRIER_THRESHOLDS.poor);
  });
});

describe('MIN_CALIBRATION_SAMPLES', () => {
  it('should be a reasonable value', () => {
    expect(MIN_CALIBRATION_SAMPLES).toBeGreaterThanOrEqual(20);
    expect(MIN_CALIBRATION_SAMPLES).toBeLessThanOrEqual(200);
  });
});
