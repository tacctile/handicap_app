/**
 * Calibration Manager
 *
 * Singleton service that manages Platt scaling calibration lifecycle:
 * - Checks if calibration is ready (500+ races)
 * - Fits parameters from historical data
 * - Stores and retrieves fitted parameters
 * - Applies calibration to probability predictions
 * - Triggers recalibration when needed
 *
 * Usage:
 * ```typescript
 * import { calibrationManager } from '@/services/calibration/calibrationManager';
 *
 * // Check if ready
 * const ready = await calibrationManager.checkReadiness();
 *
 * // Calibrate a probability
 * const calibrated = calibrationManager.calibrate(0.25);
 *
 * // Calibrate entire field
 * const calibratedField = calibrationManager.calibrateField([0.4, 0.3, 0.2, 0.1]);
 * ```
 *
 * @module calibration/calibrationManager
 */

import type { PlattParameters, StorablePlattParameters } from './plattScaling';
import {
  calibrateProbability,
  calibrateField,
  serializePlattParameters,
  deserializePlattParameters,
  validatePlattParameters,
} from './plattScaling';
import { fitPlattGradientDescent, crossValidatePlatt, evaluateUncalibrated } from './plattFitter';
import { calculateAllMetrics, type ComprehensiveMetrics } from './metrics';
import {
  isCalibrationReady,
  getAllCompletedEntries,
  CALIBRATION_THRESHOLD,
  getDatasetStats,
} from './datasetManager';
import { openDatabase, STORES } from '../storage/index';
import { logger } from '../logging';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Calibration manager configuration
 */
export interface CalibrationManagerConfig {
  /** Minimum races required for calibration (default: 500) */
  minRacesRequired: number;
  /** Number of new races before triggering recalibration (default: 50) */
  recalibrationThreshold: number;
  /** Maximum days before forcing recalibration (default: 7) */
  maxRecalibrationAgeDays: number;
  /** Fitting algorithm configuration */
  fittingConfig: {
    learningRate: number;
    maxIterations: number;
    convergenceThreshold: number;
    regularization: number;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_CALIBRATION_CONFIG: CalibrationManagerConfig = {
  minRacesRequired: CALIBRATION_THRESHOLD,
  recalibrationThreshold: 50,
  maxRecalibrationAgeDays: 7,
  fittingConfig: {
    learningRate: 0.01,
    maxIterations: 1000,
    convergenceThreshold: 1e-6,
    regularization: 0.001,
  },
};

/**
 * Calibration status information
 */
export interface CalibrationStatus {
  /** Whether calibration is active */
  isReady: boolean;
  /** Total races in dataset */
  totalRaces: number;
  /** Races needed to reach threshold */
  racesNeeded: number;
  /** Percentage progress towards threshold */
  progressPercent: number;
  /** Whether recalibration is recommended */
  needsRecalibration: boolean;
  /** When parameters were last fitted */
  lastFittedAt: Date | null;
  /** Number of races used in current calibration */
  racesUsedInCalibration: number;
  /** Quality metrics of current calibration */
  metrics: {
    brierScore: number;
    logLoss: number;
  } | null;
}

/**
 * Calibration history entry for tracking improvements
 */
export interface CalibrationHistoryEntry {
  fittedAt: Date;
  racesUsed: number;
  brierScore: number;
  logLoss: number;
  parameters: PlattParameters;
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEY_PARAMETERS = 'platt_parameters';
const STORAGE_KEY_HISTORY = 'calibration_history';
const STORAGE_KEY_LAST_RACE_COUNT = 'last_calibration_race_count';

// ============================================================================
// CALIBRATION MANAGER CLASS
// ============================================================================

/**
 * Singleton class managing Platt scaling calibration
 */
export class CalibrationManager {
  private params: PlattParameters | null = null;
  private isReady: boolean = false;
  private config: CalibrationManagerConfig;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private lastRaceCountAtCalibration: number = 0;

  constructor(config: Partial<CalibrationManagerConfig> = {}) {
    this.config = { ...DEFAULT_CALIBRATION_CONFIG, ...config };
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize the manager by loading stored parameters
   * This is called automatically on first use
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    await this.initPromise;
    this.initialized = true;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Load stored parameters
      const stored = await this.loadStoredParameters();
      if (stored) {
        const errors = validatePlattParameters(stored);
        if (errors.length === 0) {
          this.params = stored;
          this.isReady = true;
          logger.logInfo('[CalibrationManager] Loaded stored parameters', {
            A: stored.A.toFixed(4),
            B: stored.B.toFixed(4),
            racesUsed: stored.racesUsed,
          });
        } else {
          logger.logWarning('[CalibrationManager] Stored parameters invalid', { errors });
        }
      }

      // Load last race count
      this.lastRaceCountAtCalibration = await this.loadLastRaceCount();

      // Check if we should auto-fit
      await this.checkAndTriggerAutoFit();
    } catch (error) {
      logger.logError(error as Error, { component: 'CalibrationManager.initialize' });
    }
  }

  // ==========================================================================
  // READINESS CHECK
  // ==========================================================================

  /**
   * Check if calibration is ready (500+ races accumulated)
   * Also triggers auto-fit if threshold is newly crossed
   *
   * @returns True if calibration is active
   */
  async checkReadiness(): Promise<boolean> {
    await this.initialize();

    try {
      const ready = await isCalibrationReady();

      // If we just crossed the threshold, auto-fit
      if (ready && !this.isReady) {
        await this.fitFromHistoricalData();
      }

      return this.isReady;
    } catch (error) {
      logger.logError(error as Error, { component: 'CalibrationManager.checkReadiness' });
      return false;
    }
  }

  /**
   * Check and trigger auto-fit if conditions are met
   */
  private async checkAndTriggerAutoFit(): Promise<void> {
    const stats = await getDatasetStats();
    const currentRaceCount = stats.totalRaces;

    // Check if we've crossed the threshold
    const shouldFitInitial = currentRaceCount >= this.config.minRacesRequired && !this.params;

    // Check if we have enough new races since last calibration
    const newRacesSinceCalibration = currentRaceCount - this.lastRaceCountAtCalibration;
    const shouldRecalibrateNewData =
      this.params && newRacesSinceCalibration >= this.config.recalibrationThreshold;

    // Check if calibration is too old
    const shouldRecalibrateAge =
      this.params &&
      this.params.fittedAt &&
      Date.now() - this.params.fittedAt.getTime() >
        this.config.maxRecalibrationAgeDays * 24 * 60 * 60 * 1000;

    if (shouldFitInitial || shouldRecalibrateNewData || shouldRecalibrateAge) {
      logger.logInfo('[CalibrationManager] Auto-triggering calibration', {
        shouldFitInitial,
        shouldRecalibrateNewData,
        shouldRecalibrateAge,
        currentRaceCount,
        lastRaceCount: this.lastRaceCountAtCalibration,
      });

      // Don't await - let it run in background
      this.fitFromHistoricalData().catch((error) => {
        logger.logError(error as Error, { component: 'CalibrationManager.autoFit' });
      });
    }
  }

  // ==========================================================================
  // PARAMETER FITTING
  // ==========================================================================

  /**
   * Fit or refit Platt parameters from stored historical data
   *
   * @returns Fitted parameters or null if fitting fails
   */
  async fitFromHistoricalData(): Promise<PlattParameters | null> {
    await this.initialize();

    try {
      // Get all completed entries
      const entries = await getAllCompletedEntries();

      if (entries.length < this.config.minRacesRequired) {
        logger.logInfo('[CalibrationManager] Not enough data for calibration', {
          entries: entries.length,
          required: this.config.minRacesRequired,
        });
        return null;
      }

      // Extract predictions and outcomes
      const predictions: number[] = [];
      const outcomes: boolean[] = [];

      for (const entry of entries) {
        if (
          entry.predictedProbability > 0 &&
          entry.predictedProbability < 1 &&
          Number.isFinite(entry.predictedProbability)
        ) {
          predictions.push(entry.predictedProbability);
          outcomes.push(entry.wasWinner);
        }
      }

      if (predictions.length < this.config.minRacesRequired) {
        logger.logInfo('[CalibrationManager] Not enough valid predictions', {
          predictions: predictions.length,
          required: this.config.minRacesRequired,
        });
        return null;
      }

      // Evaluate uncalibrated baseline
      const baselineMetrics = evaluateUncalibrated(predictions, outcomes);
      logger.logInfo('[CalibrationManager] Baseline metrics (uncalibrated)', {
        brierScore: baselineMetrics.brierScore.toFixed(4),
        logLoss: baselineMetrics.logLoss.toFixed(4),
      });

      // Fit parameters
      const result = fitPlattGradientDescent(predictions, outcomes, this.config.fittingConfig);

      if (!result) {
        logger.logWarning('[CalibrationManager] Fitting failed');
        return null;
      }

      // Validate results show improvement
      if (result.parameters.brierScore > baselineMetrics.brierScore) {
        logger.logWarning('[CalibrationManager] Calibration did not improve Brier score', {
          baseline: baselineMetrics.brierScore.toFixed(4),
          calibrated: result.parameters.brierScore.toFixed(4),
        });
        // Still use the parameters - they may improve other metrics
      }

      // Store parameters
      this.params = result.parameters;
      this.isReady = true;

      await this.saveParameters(this.params);
      await this.saveLastRaceCount(entries.length);
      await this.saveToHistory(this.params);

      this.lastRaceCountAtCalibration = entries.length;

      logger.logInfo('[CalibrationManager] Calibration complete', {
        A: this.params.A.toFixed(4),
        B: this.params.B.toFixed(4),
        brierScore: this.params.brierScore.toFixed(4),
        improvement:
          (
            ((baselineMetrics.brierScore - this.params.brierScore) / baselineMetrics.brierScore) *
            100
          ).toFixed(1) + '%',
        racesUsed: this.params.racesUsed,
      });

      return this.params;
    } catch (error) {
      logger.logError(error as Error, { component: 'CalibrationManager.fitFromHistoricalData' });
      return null;
    }
  }

  // ==========================================================================
  // CALIBRATION APPLICATION
  // ==========================================================================

  /**
   * Get current parameters (null if not ready)
   */
  getParameters(): PlattParameters | null {
    return this.params;
  }

  /**
   * Calibrate a single probability
   * Returns the input unchanged if calibration is not ready
   *
   * @param rawProbability - Raw model probability (0-1)
   * @returns Calibrated probability (or original if not ready)
   */
  calibrate(rawProbability: number): number {
    if (!this.isReady || !this.params) {
      return rawProbability; // Passthrough when not ready
    }

    return calibrateProbability(rawProbability, this.params);
  }

  /**
   * Calibrate an entire field with re-normalization
   * Returns the input unchanged if calibration is not ready
   *
   * @param rawProbabilities - Array of raw model probabilities
   * @returns Array of calibrated probabilities (sum to ~1.0)
   */
  calibrateField(rawProbabilities: number[]): number[] {
    if (!this.isReady || !this.params) {
      return rawProbabilities; // Passthrough when not ready
    }

    return calibrateField(rawProbabilities, this.params);
  }

  // ==========================================================================
  // METRICS & STATUS
  // ==========================================================================

  /**
   * Get current calibration quality metrics
   *
   * @returns Metrics or null if not calibrated
   */
  getMetrics(): { brierScore: number; logLoss: number; racesUsed: number } | null {
    if (!this.isReady || !this.params) {
      return null;
    }

    return {
      brierScore: this.params.brierScore,
      logLoss: this.params.logLoss,
      racesUsed: this.params.racesUsed,
    };
  }

  /**
   * Get comprehensive calibration status
   */
  async getStatus(): Promise<CalibrationStatus> {
    await this.initialize();

    const stats = await getDatasetStats();
    const totalRaces = stats.totalRaces;
    const racesNeeded = Math.max(0, this.config.minRacesRequired - totalRaces);
    const progressPercent = Math.min(100, (totalRaces / this.config.minRacesRequired) * 100);

    // Determine if recalibration is needed
    const newRacesSinceCalibration = totalRaces - this.lastRaceCountAtCalibration;
    const needsRecalibration =
      this.isReady &&
      (newRacesSinceCalibration >= this.config.recalibrationThreshold ||
        Boolean(
          this.params &&
          Date.now() - this.params.fittedAt.getTime() >
            this.config.maxRecalibrationAgeDays * 24 * 60 * 60 * 1000
        ));

    return {
      isReady: this.isReady,
      totalRaces,
      racesNeeded,
      progressPercent,
      needsRecalibration,
      lastFittedAt: this.params?.fittedAt ?? null,
      racesUsedInCalibration: this.params?.racesUsed ?? 0,
      metrics: this.params
        ? {
            brierScore: this.params.brierScore,
            logLoss: this.params.logLoss,
          }
        : null,
    };
  }

  /**
   * Run cross-validation on current data
   *
   * @param folds - Number of folds (default: 5)
   * @returns Cross-validation results
   */
  async runCrossValidation(folds: number = 5): Promise<{
    avgBrierScore: number;
    avgLogLoss: number;
    stdDev: number;
  } | null> {
    try {
      const entries = await getAllCompletedEntries();
      const predictions = entries
        .filter((e) => e.predictedProbability > 0 && e.predictedProbability < 1)
        .map((e) => e.predictedProbability);
      const outcomes = entries
        .filter((e) => e.predictedProbability > 0 && e.predictedProbability < 1)
        .map((e) => e.wasWinner);

      if (predictions.length < this.config.minRacesRequired) {
        return null;
      }

      const cvResult = crossValidatePlatt(predictions, outcomes, folds);

      return {
        avgBrierScore: cvResult.avgBrierScore,
        avgLogLoss: cvResult.avgLogLoss,
        stdDev: cvResult.brierStdDev,
      };
    } catch (error) {
      logger.logError(error as Error, { component: 'CalibrationManager.runCrossValidation' });
      return null;
    }
  }

  /**
   * Get comprehensive metrics for the current calibration
   */
  async getComprehensiveMetrics(): Promise<ComprehensiveMetrics | null> {
    try {
      const entries = await getAllCompletedEntries();

      if (entries.length === 0) {
        return null;
      }

      // Get calibrated predictions if calibration is ready
      const predictions: number[] = [];
      const outcomes: boolean[] = [];

      for (const entry of entries) {
        if (entry.predictedProbability > 0 && entry.predictedProbability < 1) {
          const calibrated = this.calibrate(entry.predictedProbability);
          predictions.push(calibrated);
          outcomes.push(entry.wasWinner);
        }
      }

      return calculateAllMetrics(predictions, outcomes);
    } catch (error) {
      logger.logError(error as Error, { component: 'CalibrationManager.getComprehensiveMetrics' });
      return null;
    }
  }

  // ==========================================================================
  // RECALIBRATION
  // ==========================================================================

  /**
   * Force recalibration (ignores thresholds)
   */
  async recalibrate(): Promise<void> {
    logger.logInfo('[CalibrationManager] Force recalibration requested');
    await this.fitFromHistoricalData();
  }

  /**
   * Reset calibration (clears stored parameters)
   */
  async reset(): Promise<void> {
    this.params = null;
    this.isReady = false;
    this.lastRaceCountAtCalibration = 0;

    try {
      const db = await openDatabase();
      const tx = db.transaction(STORES.CALIBRATION_META, 'readwrite');
      const store = tx.objectStore(STORES.CALIBRATION_META);

      await new Promise<void>((resolve, reject) => {
        store.delete(STORAGE_KEY_PARAMETERS);
        store.delete(STORAGE_KEY_LAST_RACE_COUNT);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      logger.logInfo('[CalibrationManager] Reset complete');
    } catch (error) {
      logger.logError(error as Error, { component: 'CalibrationManager.reset' });
    }
  }

  // ==========================================================================
  // STORAGE OPERATIONS
  // ==========================================================================

  /**
   * Load stored parameters from IndexedDB
   */
  private async loadStoredParameters(): Promise<PlattParameters | null> {
    try {
      const db = await openDatabase();
      const tx = db.transaction(STORES.CALIBRATION_META, 'readonly');
      const store = tx.objectStore(STORES.CALIBRATION_META);

      return new Promise((resolve, reject) => {
        const request = store.get(STORAGE_KEY_PARAMETERS);
        request.onsuccess = () => {
          const result = request.result as
            | { key: string; value: StorablePlattParameters }
            | undefined;
          if (result?.value) {
            resolve(deserializePlattParameters(result.value));
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.logError(error as Error, { component: 'CalibrationManager.loadStoredParameters' });
      return null;
    }
  }

  /**
   * Save parameters to IndexedDB
   */
  private async saveParameters(params: PlattParameters): Promise<void> {
    try {
      const db = await openDatabase();
      const tx = db.transaction(STORES.CALIBRATION_META, 'readwrite');
      const store = tx.objectStore(STORES.CALIBRATION_META);

      const storable = serializePlattParameters(params);

      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          key: STORAGE_KEY_PARAMETERS,
          value: storable,
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.logError(error as Error, { component: 'CalibrationManager.saveParameters' });
    }
  }

  /**
   * Load last race count from storage
   */
  private async loadLastRaceCount(): Promise<number> {
    try {
      const db = await openDatabase();
      const tx = db.transaction(STORES.CALIBRATION_META, 'readonly');
      const store = tx.objectStore(STORES.CALIBRATION_META);

      return new Promise((resolve, reject) => {
        const request = store.get(STORAGE_KEY_LAST_RACE_COUNT);
        request.onsuccess = () => {
          const result = request.result as { key: string; value: number } | undefined;
          resolve(result?.value ?? 0);
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      return 0;
    }
  }

  /**
   * Save last race count to storage
   */
  private async saveLastRaceCount(count: number): Promise<void> {
    try {
      const db = await openDatabase();
      const tx = db.transaction(STORES.CALIBRATION_META, 'readwrite');
      const store = tx.objectStore(STORES.CALIBRATION_META);

      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          key: STORAGE_KEY_LAST_RACE_COUNT,
          value: count,
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.logError(error as Error, { component: 'CalibrationManager.saveLastRaceCount' });
    }
  }

  /**
   * Save calibration to history
   */
  private async saveToHistory(params: PlattParameters): Promise<void> {
    try {
      const db = await openDatabase();
      const tx = db.transaction(STORES.CALIBRATION_META, 'readwrite');
      const store = tx.objectStore(STORES.CALIBRATION_META);

      // Load existing history
      const existingResult = await new Promise<CalibrationHistoryEntry[]>((resolve, reject) => {
        const request = store.get(STORAGE_KEY_HISTORY);
        request.onsuccess = () => {
          const result = request.result as
            | { key: string; value: CalibrationHistoryEntry[] }
            | undefined;
          resolve(result?.value ?? []);
        };
        request.onerror = () => reject(request.error);
      });

      // Add new entry (keep last 20)
      const history = [
        ...existingResult,
        {
          fittedAt: params.fittedAt,
          racesUsed: params.racesUsed,
          brierScore: params.brierScore,
          logLoss: params.logLoss,
          parameters: params,
        },
      ].slice(-20);

      // Save updated history
      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          key: STORAGE_KEY_HISTORY,
          value: history,
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.logError(error as Error, { component: 'CalibrationManager.saveToHistory' });
    }
  }

  /**
   * Get calibration history
   */
  async getHistory(): Promise<CalibrationHistoryEntry[]> {
    try {
      const db = await openDatabase();
      const tx = db.transaction(STORES.CALIBRATION_META, 'readonly');
      const store = tx.objectStore(STORES.CALIBRATION_META);

      return new Promise((resolve, reject) => {
        const request = store.get(STORAGE_KEY_HISTORY);
        request.onsuccess = () => {
          const result = request.result as
            | { key: string; value: CalibrationHistoryEntry[] }
            | undefined;
          resolve(result?.value ?? []);
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      return [];
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton calibration manager instance
 */
export const calibrationManager = new CalibrationManager();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Save Platt parameters to storage (convenience function)
 */
export async function savePlattParameters(params: PlattParameters): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.CALIBRATION_META, 'readwrite');
  const store = tx.objectStore(STORES.CALIBRATION_META);

  const storable = serializePlattParameters(params);

  await new Promise<void>((resolve, reject) => {
    const request = store.put({
      key: STORAGE_KEY_PARAMETERS,
      value: storable,
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get Platt parameters from storage (convenience function)
 */
export async function getPlattParameters(): Promise<PlattParameters | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORES.CALIBRATION_META, 'readonly');
    const store = tx.objectStore(STORES.CALIBRATION_META);

    return new Promise((resolve, reject) => {
      const request = store.get(STORAGE_KEY_PARAMETERS);
      request.onsuccess = () => {
        const result = request.result as
          | { key: string; value: StorablePlattParameters }
          | undefined;
        if (result?.value) {
          resolve(deserializePlattParameters(result.value));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/**
 * Save calibration history entry (convenience function)
 */
export async function saveCalibrationHistory(entry: CalibrationHistoryEntry): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.CALIBRATION_META, 'readwrite');
  const store = tx.objectStore(STORES.CALIBRATION_META);

  // Load existing history
  const existingResult = await new Promise<CalibrationHistoryEntry[]>((resolve, reject) => {
    const request = store.get(STORAGE_KEY_HISTORY);
    request.onsuccess = () => {
      const result = request.result as
        | { key: string; value: CalibrationHistoryEntry[] }
        | undefined;
      resolve(result?.value ?? []);
    };
    request.onerror = () => reject(request.error);
  });

  // Add new entry (keep last 20)
  const history = [...existingResult, entry].slice(-20);

  // Save updated history
  await new Promise<void>((resolve, reject) => {
    const request = store.put({
      key: STORAGE_KEY_HISTORY,
      value: history,
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
