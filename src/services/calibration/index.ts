/**
 * Calibration Service
 *
 * Provides infrastructure for storing historical race outcomes
 * and calibrating probability predictions via Platt scaling.
 *
 * Target: 500+ races for statistically significant calibration.
 *
 * Usage:
 * ```typescript
 * import {
 *   // Schema types
 *   type HistoricalRace,
 *   type HistoricalEntry,
 *   type CalibrationDataset,
 *
 *   // Storage operations
 *   saveHistoricalRace,
 *   getAllHistoricalRaces,
 *   getCalibrationDataset,
 *
 *   // DRF extraction
 *   extractHistoricalRaces,
 *
 *   // Prediction logging
 *   logPredictions,
 *
 *   // Results recording
 *   recordRaceResult,
 *
 *   // Dataset management
 *   isCalibrationReady,
 *   getEntriesByProbabilityBucket,
 * } from '@/services/calibration';
 * ```
 */

// ============================================================================
// SCHEMA TYPES & HELPERS
// ============================================================================

export {
  // Types
  type HistoricalEntry,
  type HistoricalRace,
  type HistoricalRaceSource,
  type CalibrationDataset,
  type SurfaceCode,
  type DataConfidence,
  // Helper functions
  generateRaceId,
  parseRaceId,
  normalizeDate,
  toSurfaceCode,
  calculateImpliedProbability,
  validateHistoricalRace,
  createEmptyCalibrationDataset,
} from './schema';

// ============================================================================
// CALIBRATION TYPES
// ============================================================================

export {
  // Probability bucket types
  type ProbabilityBucket,
  type CalibrationMetrics,
  type ReliabilityPoint,
  // Tier calibration types
  type TierCalibrationMetrics,
  type TierMetrics,
  // Score calibration types
  type ScoreBucket,
  type ScoreCalibration,
  // Analysis result types
  type CalibrationAnalysisResult,
  type PlattScalingParams,
  // Utility types
  type BucketOptions,
  type CalibrationFilterOptions,
  // Helper functions
  createDefaultBucketBoundaries,
  getBucketIndex,
  calculateStandardError,
  calculateConfidenceInterval,
  isCalibrationReliable,
} from './types';

// ============================================================================
// STORAGE OPERATIONS
// ============================================================================

export {
  // Basic CRUD
  saveHistoricalRace,
  saveHistoricalRaces,
  getHistoricalRace,
  getAllHistoricalRaces,
  getHistoricalRaceCount,
  deleteHistoricalRace,
  clearAllHistoricalData,
  // Query operations
  getHistoricalRacesByTrack,
  getHistoricalRacesByDateRange,
  getHistoricalRacesBySource,
  getHistoricalRacesByIds,
  getPendingResultRaces,
  // Utilities
  raceExists,
  updateHistoricalRace,
  getCalibrationDataset,
  // Import/Export
  exportHistoricalData,
  importHistoricalData,
} from './storage';

// ============================================================================
// DRF EXTRACTION
// ============================================================================

export {
  // Main extraction
  extractHistoricalRaces,
  extractFromMultipleFiles,
  // Single race extraction (for prediction logging)
  extractRaceForPredictionLogging,
  // Utilities
  estimateExtractableRaces,
  // Types
  type ExtractorOptions,
  type ExtractionResult,
} from './drfExtractor';

// ============================================================================
// PREDICTION LOGGING
// ============================================================================

export {
  // Main logging
  logPredictions,
  logMultiplePredictions,
  logSimplePredictions,
  // Query
  hasPredictionsLogged,
  getPredictions,
  // Probability utilities
  scoreToProbability,
  normalizeProbabilities,
  determineTier,
  // Types
  type RaceScoringResult,
  type PredictionLogResult,
  type PredictionLogOptions,
} from './predictionLogger';

// ============================================================================
// RESULTS RECORDING
// ============================================================================

export {
  // Main recording
  recordRaceResult,
  recordMultipleRaceResults,
  // Scratches
  recordScratch,
  recordScratches,
  // Utilities
  parseFinishResultsSimple,
  createWinnerOnlyResult,
  // Types
  type FinishResult,
  type RecordResultOutcome,
} from './resultsRecorder';

// ============================================================================
// DATASET MANAGEMENT
// ============================================================================

export {
  // Status checks
  isCalibrationReady,
  hasMinimumData,
  getRacesNeeded,
  getDatasetStats,
  // Queries
  getRacesByTrack,
  getRacesByDateRange,
  getFilteredRaces,
  // Entry grouping
  getAllCompletedEntries,
  getEntriesByProbabilityBucket,
  getEntriesByScoreBucket,
  getEntriesByTier,
  // Statistics
  calculateBucketWinRates,
  calculateTierStats,
  getSurfaceStats,
  // Utilities
  getDataQualitySummary,
  getRandomSample,
  validateDataset,
  // Constants
  CALIBRATION_THRESHOLD,
  MINIMUM_CALIBRATION_RACES,
} from './datasetManager';
