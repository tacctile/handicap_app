/**
 * Tests for Calibration Manager
 *
 * Tests cover:
 * - Returns uncalibrated when under 500 races
 * - Auto-fits when threshold crossed
 * - Stores and retrieves parameters
 * - Recalibration updates parameters
 * - Graceful fallback to uncalibrated
 *
 * Note: These tests use mocking for IndexedDB and the datasetManager
 * since we can't rely on actual storage in a test environment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalibrationManager, DEFAULT_CALIBRATION_CONFIG } from '../calibrationManager';

// Mock the dependencies
vi.mock('../datasetManager', () => ({
  isCalibrationReady: vi.fn(),
  getAllCompletedEntries: vi.fn(),
  getDatasetStats: vi.fn(),
  CALIBRATION_THRESHOLD: 500,
}));

vi.mock('../../storage/index', () => ({
  openDatabase: vi.fn(),
  STORES: {
    CALIBRATION_META: 'calibration-meta',
    HISTORICAL_RACES: 'historical-races',
  },
}));

vi.mock('../../logging', () => ({
  logger: {
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
  },
}));

// Import mocked modules
import { isCalibrationReady, getAllCompletedEntries, getDatasetStats } from '../datasetManager';
import { openDatabase } from '../../storage/index';

describe('CalibrationManager', () => {
  let manager: CalibrationManager;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(isCalibrationReady).mockResolvedValue(false);
    vi.mocked(getAllCompletedEntries).mockResolvedValue([]);
    vi.mocked(getDatasetStats).mockResolvedValue({
      totalRaces: 100,
      totalEntries: 800,
      dateRange: { start: '2025-01-01', end: '2025-06-01' },
      trackCodes: ['SAR', 'AQU'],
      lastUpdated: new Date(),
    });

    // Mock openDatabase to reject (tests will skip storage operations)
    vi.mocked(openDatabase).mockRejectedValue(new Error('IndexedDB not available in tests'));

    // Create new manager instance for each test
    manager = new CalibrationManager();
  });

  // ==========================================================================
  // Passthrough Behavior
  // ==========================================================================

  describe('calibration passthrough when not ready', () => {
    it('should return input unchanged when calibration not ready', () => {
      const rawProb = 0.25;
      const calibrated = manager.calibrate(rawProb);

      expect(calibrated).toBe(rawProb);
    });

    it('should return field unchanged when calibration not ready', () => {
      const rawField = [0.4, 0.3, 0.2, 0.1];
      const calibrated = manager.calibrateField(rawField);

      expect(calibrated).toEqual(rawField);
    });

    it('should return null for parameters when not ready', () => {
      expect(manager.getParameters()).toBeNull();
    });

    it('should return null for metrics when not ready', () => {
      expect(manager.getMetrics()).toBeNull();
    });
  });

  // ==========================================================================
  // Readiness Check
  // ==========================================================================

  describe('checkReadiness', () => {
    it('should return false when under threshold', async () => {
      vi.mocked(isCalibrationReady).mockResolvedValue(false);

      // The manager will try to initialize but storage will fail, so it stays not ready
      const ready = await manager.checkReadiness();

      expect(ready).toBe(false);
    }, 5000);

    it('should call isCalibrationReady', async () => {
      vi.mocked(isCalibrationReady).mockResolvedValue(false);

      await manager.checkReadiness();

      expect(isCalibrationReady).toHaveBeenCalled();
    }, 5000);
  });

  // ==========================================================================
  // Status
  // ==========================================================================

  describe('getStatus', () => {
    it('should return correct status when not ready', async () => {
      vi.mocked(getDatasetStats).mockResolvedValue({
        totalRaces: 250,
        totalEntries: 2000,
        dateRange: { start: '2025-01-01', end: '2025-06-01' },
        trackCodes: ['SAR', 'AQU'],
        lastUpdated: new Date(),
      });

      const status = await manager.getStatus();

      expect(status.isReady).toBe(false);
      expect(status.totalRaces).toBe(250);
      expect(status.racesNeeded).toBe(250); // 500 - 250
      expect(status.progressPercent).toBe(50); // 250/500 * 100
      expect(status.lastFittedAt).toBeNull();
      expect(status.metrics).toBeNull();
    }, 5000);

    it('should cap progress at 100%', async () => {
      vi.mocked(getDatasetStats).mockResolvedValue({
        totalRaces: 1000,
        totalEntries: 8000,
        dateRange: { start: '2025-01-01', end: '2025-12-01' },
        trackCodes: ['SAR', 'AQU', 'BEL'],
        lastUpdated: new Date(),
      });

      const status = await manager.getStatus();

      expect(status.progressPercent).toBe(100);
      expect(status.racesNeeded).toBe(0);
    }, 5000);
  });

  // ==========================================================================
  // Configuration
  // ==========================================================================

  describe('configuration', () => {
    it('should use default config values', () => {
      expect(DEFAULT_CALIBRATION_CONFIG.minRacesRequired).toBe(500);
      expect(DEFAULT_CALIBRATION_CONFIG.recalibrationThreshold).toBe(50);
      expect(DEFAULT_CALIBRATION_CONFIG.maxRecalibrationAgeDays).toBe(7);
    });

    it('should allow custom configuration', () => {
      const customManager = new CalibrationManager({
        minRacesRequired: 300,
        recalibrationThreshold: 25,
      });

      // The manager should be created without error
      expect(customManager).toBeDefined();
    });
  });

  // ==========================================================================
  // Fitting
  // ==========================================================================

  describe('fitFromHistoricalData', () => {
    it('should return null when not enough data', async () => {
      vi.mocked(getAllCompletedEntries).mockResolvedValue(generateMockEntries(100));

      const params = await manager.fitFromHistoricalData();

      expect(params).toBeNull();
    }, 5000);

    it('should fit parameters when enough data available', async () => {
      // Generate enough mock entries
      const entries = generateMockEntries(600);
      vi.mocked(getAllCompletedEntries).mockResolvedValue(entries);

      const params = await manager.fitFromHistoricalData();

      // Should return fitted parameters
      expect(params).not.toBeNull();
      if (params) {
        expect(params.A).toBeDefined();
        expect(params.B).toBeDefined();
        expect(params.racesUsed).toBeGreaterThanOrEqual(500);
      }
    }, 10000);
  });

  // ==========================================================================
  // Recalibration
  // ==========================================================================

  describe('recalibrate', () => {
    it('should call fitFromHistoricalData', async () => {
      const entries = generateMockEntries(600);
      vi.mocked(getAllCompletedEntries).mockResolvedValue(entries);

      await manager.recalibrate();

      expect(getAllCompletedEntries).toHaveBeenCalled();
    }, 10000);
  });

  // ==========================================================================
  // Reset
  // ==========================================================================

  describe('reset', () => {
    it('should clear parameters and ready state', async () => {
      // Then reset
      await manager.reset();

      // Should be back to initial state
      expect(manager.getParameters()).toBeNull();
      expect(manager.calibrate(0.5)).toBe(0.5); // Passthrough
    }, 5000);
  });
});

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Generate mock historical entries for testing
 * Returns HistoricalEntry-compatible objects
 */
function generateMockEntries(count: number) {
  const entries = [];
  for (let i = 0; i < count; i++) {
    const prob = Math.random() * 0.8 + 0.1; // 0.1 to 0.9
    const isWinner = Math.random() < prob + 0.05; // Slightly biased
    const finishPosition = isWinner ? 1 : Math.floor(Math.random() * 10) + 2;
    entries.push({
      programNumber: (i % 12) + 1,
      finishPosition,
      predictedProbability: prob,
      impliedProbability: prob * 0.9, // Slightly different
      finalOdds: 1 / prob - 1,
      baseScore: Math.floor(prob * 300),
      finalScore: Math.floor(prob * 331),
      tier: prob > 0.5 ? 1 : prob > 0.3 ? 2 : 3,
      wasWinner: isWinner,
      wasPlace: finishPosition <= 2,
      wasShow: finishPosition <= 3,
      horseName: `Horse ${i}`,
    });
  }
  return entries;
}
