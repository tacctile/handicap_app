/**
 * Calibration Auto-Logger
 *
 * Automatically logs historical race data and predictions for calibration
 * when DRF files are parsed. This runs in the background without blocking UI.
 *
 * @module calibration/autoLogger
 */

import type { ParsedDRFFile, ParsedRace } from '../../types/drf';
import type { ScoredHorse } from '../../lib/scoring';
import { extractHistoricalRaces, type ExtractionResult } from './drfExtractor';
import { logPredictions, type RaceScoringResult } from './predictionLogger';
import { saveHistoricalRaces, getHistoricalRaceCount } from './storage';
import { isCalibrationReady } from './datasetManager';
import { calibrationManager } from './calibrationManager';
import { logger } from '../logging';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result from auto-logging process
 */
export interface AutoLogResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Number of historical races extracted */
  historicalRacesExtracted: number;
  /** Number of predictions logged */
  predictionsLogged: number;
  /** Current total races in calibration dataset */
  totalRacesInDataset: number;
  /** Whether calibration is now ready */
  calibrationReady: boolean;
  /** Races needed until calibration is ready */
  racesNeededForCalibration: number;
  /** Any errors that occurred */
  errors: string[];
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Options for auto-logging
 */
export interface AutoLogOptions {
  /** Whether to extract historical races from past performances */
  extractHistorical: boolean;
  /** Whether to log predictions for current races */
  logPredictions: boolean;
  /** Callback when logging starts */
  onStart?: () => void;
  /** Callback when logging completes */
  onComplete?: (result: AutoLogResult) => void;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

const DEFAULT_OPTIONS: AutoLogOptions = {
  extractHistorical: true,
  logPredictions: true,
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Auto-log calibration data after DRF file parse.
 *
 * This function:
 * 1. Extracts historical race outcomes from past performances
 * 2. Logs predictions for the current races being analyzed
 * 3. Triggers recalibration if thresholds are met
 *
 * All operations are async and don't block UI.
 *
 * @param parsedData - The parsed DRF file
 * @param scoredRaces - Optional array of scored races (for prediction logging)
 * @param options - Auto-logging options
 * @returns Promise resolving to the logging result
 *
 * @example
 * // After DRF parse completes:
 * autoLogCalibrationData(parsedData).then(result => {
 *   console.log(`Logged ${result.historicalRacesExtracted} historical races`);
 * });
 */
export async function autoLogCalibrationData(
  parsedData: ParsedDRFFile,
  scoredRaces?: Array<{ race: ParsedRace; scoredHorses: ScoredHorse[] }>,
  options: Partial<AutoLogOptions> = {}
): Promise<AutoLogResult> {
  const startTime = performance.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];

  opts.onStart?.();
  opts.onProgress?.('Starting calibration data logging...');

  let historicalRacesExtracted = 0;
  let predictionsLogged = 0;

  // Step 1: Extract historical races from past performances
  if (opts.extractHistorical) {
    try {
      opts.onProgress?.('Extracting historical race data from past performances...');

      const extractionResult: ExtractionResult = extractHistoricalRaces(parsedData, {
        maxPPsPerHorse: 10,
        minFieldSize: 4,
      });

      // Save extracted races to storage
      if (extractionResult.races.length > 0) {
        await saveHistoricalRaces(extractionResult.races);
        historicalRacesExtracted = extractionResult.races.length;
      }

      logger.logInfo('Historical races extracted for calibration', {
        component: 'autoLogger',
        racesExtracted: historicalRacesExtracted,
        stats: extractionResult.stats,
        filename: parsedData.filename,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown extraction error';
      errors.push(`Historical extraction failed: ${message}`);
      logger.logError(error instanceof Error ? error : new Error(message), {
        component: 'autoLogger',
      });
    }
  }

  // Step 2: Log predictions for current races if scored data is provided
  if (opts.logPredictions && scoredRaces && scoredRaces.length > 0) {
    try {
      opts.onProgress?.('Logging predictions for current races...');

      for (const { race, scoredHorses } of scoredRaces) {
        try {
          // Create RaceScoringResult from scored horses
          const scoringResult: RaceScoringResult = {
            scoredHorses,
          };

          const logResult = await logPredictions(race, scoringResult, {
            overwriteExisting: false,
          });

          // Check if predictions were logged (entriesLogged > 0 means success)
          if (logResult.entriesLogged > 0) {
            predictionsLogged++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Prediction logging for race ${race.header?.raceNumber}: ${message}`);
        }
      }

      logger.logInfo('Predictions logged for calibration', {
        component: 'autoLogger',
        predictionsLogged,
        racesProcessed: scoredRaces.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown prediction logging error';
      errors.push(`Prediction logging failed: ${message}`);
      logger.logError(error instanceof Error ? error : new Error(message), {
        component: 'autoLogger',
      });
    }
  }

  // Step 3: Check calibration status and trigger recalibration if needed
  opts.onProgress?.('Checking calibration status...');

  const totalRacesInDataset = await getHistoricalRaceCount();
  const calibrationReady = await isCalibrationReady();
  const CALIBRATION_THRESHOLD = 500;
  const racesNeededForCalibration = Math.max(0, CALIBRATION_THRESHOLD - totalRacesInDataset);

  // Step 4: Trigger recalibration if we have enough data
  if (calibrationReady) {
    try {
      opts.onProgress?.('Checking if recalibration is needed...');

      // checkReadiness returns Promise<boolean>
      const isReady = await calibrationManager.checkReadiness();

      if (isReady) {
        opts.onProgress?.('Triggering model recalibration...');
        // Use recalibrate() for forcing recalibration
        await calibrationManager.recalibrate();

        logger.logInfo('Calibration triggered after auto-logging', {
          component: 'autoLogger',
          totalRaces: totalRacesInDataset,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown calibration error';
      errors.push(`Calibration check failed: ${message}`);
      logger.logWarning('Calibration check failed', { error });
    }
  }

  const durationMs = performance.now() - startTime;

  const result: AutoLogResult = {
    success: errors.length === 0,
    historicalRacesExtracted,
    predictionsLogged,
    totalRacesInDataset,
    calibrationReady,
    racesNeededForCalibration,
    errors,
    durationMs,
  };

  opts.onComplete?.(result);

  logger.logInfo('Auto-logging completed', {
    component: 'autoLogger',
    ...result,
    durationMs: Math.round(durationMs),
  });

  return result;
}

/**
 * Schedule calibration auto-logging to run in the background.
 *
 * Uses requestIdleCallback to avoid blocking UI.
 *
 * @param parsedData - The parsed DRF file
 * @param options - Auto-logging options
 */
export function scheduleAutoLog(
  parsedData: ParsedDRFFile,
  options?: Partial<AutoLogOptions>
): void {
  // Use requestIdleCallback if available, otherwise use setTimeout
  const schedule =
    typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 100);

  schedule(() => {
    autoLogCalibrationData(parsedData, undefined, options).catch((error) => {
      logger.logError(error instanceof Error ? error : new Error(String(error)), {
        component: 'autoLogger.scheduleAutoLog',
      });
    });
  });
}

/**
 * Get calibration progress for display
 */
export async function getCalibrationProgress(): Promise<{
  currentRaces: number;
  targetRaces: number;
  percentComplete: number;
  isReady: boolean;
}> {
  const currentRaces = await getHistoricalRaceCount();
  const targetRaces = 500;
  const percentComplete = Math.min(100, Math.round((currentRaces / targetRaces) * 100));
  const isReady = currentRaces >= targetRaces;

  return {
    currentRaces,
    targetRaces,
    percentComplete,
    isReady,
  };
}
