/**
 * useCalibrationData Hook
 *
 * React hook for managing calibration data, including:
 * - Extracting historical races from DRF files
 * - Recording race results
 * - Tracking calibration dataset status
 *
 * Target: 500+ races for Platt scaling calibration.
 */

import { useState, useCallback, useEffect } from 'react';
import type { ParsedDRFFile, ParsedRace } from '../types/drf';
import type { CalibrationDataset, FinishResult, RaceScoringResult } from '../services/calibration';
import {
  // Dataset management
  getDatasetStats,
  isCalibrationReady,
  CALIBRATION_THRESHOLD,
  // DRF extraction
  extractHistoricalRaces,
  type ExtractionResult,
  // Storage
  saveHistoricalRaces,
  getHistoricalRaceCount,
  // Prediction logging
  logPredictions,
  type PredictionLogResult,
  // Results recording
  recordRaceResult,
  type RecordResultOutcome,
} from '../services/calibration';
import { logger } from '../services/logging';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Hook state interface
 */
export interface CalibrationDataState {
  /** Total number of races in the dataset */
  totalRaces: number;
  /** Whether we have 500+ races for calibration */
  isCalibrationReady: boolean;
  /** Current dataset statistics */
  datasetStats: CalibrationDataset | null;
  /** Whether the hook is loading data */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Last extraction result */
  lastExtraction: ExtractionResult | null;
}

/**
 * Hook actions interface
 */
export interface CalibrationDataActions {
  /** Extract and add historical races from a parsed DRF file */
  addRaceFromDRF: (parsedFile: ParsedDRFFile, autoExtract?: boolean) => Promise<number>;
  /** Record actual results for a race */
  recordResult: (raceId: string, results: FinishResult[]) => Promise<RecordResultOutcome>;
  /** Log predictions for a race before results */
  logRacePredictions: (
    race: ParsedRace,
    scoringResult: RaceScoringResult
  ) => Promise<PredictionLogResult>;
  /** Refresh dataset statistics */
  refreshStats: () => Promise<void>;
  /** Clear error state */
  clearError: () => void;
}

/**
 * Complete hook return type
 */
export type UseCalibrationDataReturn = CalibrationDataState & CalibrationDataActions;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for managing calibration data
 *
 * @example
 * ```tsx
 * const {
 *   totalRaces,
 *   isCalibrationReady,
 *   addRaceFromDRF,
 *   recordResult,
 *   loading,
 *   error
 * } = useCalibrationData();
 *
 * // When a DRF file is parsed
 * const racesAdded = await addRaceFromDRF(parsedFile);
 * console.log(`Added ${racesAdded} historical races`);
 *
 * // When race results come in
 * await recordResult('SAR-2024-08-15-R5', [
 *   { programNumber: 3, finishPosition: 1, finalOdds: 4.5 },
 *   { programNumber: 7, finishPosition: 2, finalOdds: 8.2 },
 *   // ...
 * ]);
 * ```
 */
export function useCalibrationData(): UseCalibrationDataReturn {
  // State
  const [totalRaces, setTotalRaces] = useState<number>(0);
  const [ready, setReady] = useState<boolean>(false);
  const [datasetStats, setDatasetStats] = useState<CalibrationDataset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastExtraction, setLastExtraction] = useState<ExtractionResult | null>(null);

  // Load initial stats
  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      try {
        setLoading(true);
        const [count, isReady, stats] = await Promise.all([
          getHistoricalRaceCount(),
          isCalibrationReady(),
          getDatasetStats(),
        ]);

        if (mounted) {
          setTotalRaces(count);
          setReady(isReady);
          setDatasetStats(stats);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load calibration data';
          setError(message);
          logger.logError(err instanceof Error ? err : new Error('Failed to load stats'), {
            component: 'useCalibrationData',
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      mounted = false;
    };
  }, []);

  // Refresh stats
  const refreshStats = useCallback(async () => {
    try {
      setLoading(true);
      const [count, isReady, stats] = await Promise.all([
        getHistoricalRaceCount(),
        isCalibrationReady(),
        getDatasetStats(),
      ]);

      setTotalRaces(count);
      setReady(isReady);
      setDatasetStats(stats);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh stats';
      setError(message);
      logger.logError(err instanceof Error ? err : new Error('Failed to refresh stats'), {
        component: 'useCalibrationData',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Add races from DRF file
  const addRaceFromDRF = useCallback(
    async (parsedFile: ParsedDRFFile, autoExtract: boolean = true): Promise<number> => {
      if (!autoExtract) return 0;

      try {
        setError(null);

        // Extract historical races from past performances
        const result = extractHistoricalRaces(parsedFile);
        setLastExtraction(result);

        if (result.races.length === 0) {
          logger.logInfo('[useCalibrationData] No races extracted from DRF file');
          return 0;
        }

        // Save to IndexedDB
        const savedCount = await saveHistoricalRaces(result.races);

        logger.logInfo('[useCalibrationData] Extracted and saved races', {
          extracted: result.races.length,
          saved: savedCount,
        });

        // Refresh stats
        await refreshStats();

        return savedCount;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to extract races from DRF';
        setError(message);
        logger.logError(err instanceof Error ? err : new Error('Failed to add races from DRF'), {
          component: 'useCalibrationData',
        });
        return 0;
      }
    },
    [refreshStats]
  );

  // Record race results
  const recordResult = useCallback(
    async (raceId: string, results: FinishResult[]): Promise<RecordResultOutcome> => {
      try {
        setError(null);

        const outcome = await recordRaceResult(raceId, results);

        if (outcome.success) {
          // Refresh stats after recording results
          await refreshStats();
        } else if (outcome.error) {
          setError(outcome.error);
        }

        return outcome;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to record race result';
        setError(message);
        logger.logError(err instanceof Error ? err : new Error('Failed to record result'), {
          component: 'useCalibrationData',
        });

        return {
          success: false,
          raceId,
          entriesUpdated: 0,
          winner: null,
          error: message,
        };
      }
    },
    [refreshStats]
  );

  // Log predictions for a race
  const logRacePredictions = useCallback(
    async (race: ParsedRace, scoringResult: RaceScoringResult): Promise<PredictionLogResult> => {
      try {
        setError(null);

        const result = await logPredictions(race, scoringResult);

        if (result.isNew) {
          // Refresh stats after logging new predictions
          await refreshStats();
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to log predictions';
        setError(message);
        logger.logError(err instanceof Error ? err : new Error('Failed to log predictions'), {
          component: 'useCalibrationData',
        });

        return {
          raceId: '',
          isNew: false,
          entriesLogged: 0,
          warnings: [message],
        };
      }
    },
    [refreshStats]
  );

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    totalRaces,
    isCalibrationReady: ready,
    datasetStats,
    loading,
    error,
    lastExtraction,
    // Actions
    addRaceFromDRF,
    recordResult,
    logRacePredictions,
    refreshStats,
    clearError,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook that only tracks calibration readiness
 * Lighter weight than full useCalibrationData
 */
export function useCalibrationStatus(): {
  isReady: boolean;
  racesNeeded: number;
  loading: boolean;
} {
  const [isReady, setIsReady] = useState(false);
  const [racesNeeded, setRacesNeeded] = useState(CALIBRATION_THRESHOLD);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const [ready, count] = await Promise.all([isCalibrationReady(), getHistoricalRaceCount()]);

        if (mounted) {
          setIsReady(ready);
          setRacesNeeded(Math.max(0, CALIBRATION_THRESHOLD - count));
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    check();

    return () => {
      mounted = false;
    };
  }, []);

  return { isReady, racesNeeded, loading };
}

export default useCalibrationData;
