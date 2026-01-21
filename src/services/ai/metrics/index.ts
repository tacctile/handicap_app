/**
 * AI Metrics Module
 *
 * Exports all metrics functionality for tracking AI performance
 * against the algorithm baseline.
 */

// Types
export type {
  AIDecisionRecord,
  AIPerformanceMetrics,
  RaceResults,
  MetricsExportOptions,
} from './types';

// Storage
export {
  saveDecisionRecord,
  getDecisionRecord,
  getAllDecisionRecords,
  updateWithResults,
  clearAllRecords,
  deleteDecisionRecord,
  getFilteredRecords,
  getRecordCount,
  initializeMetricsStorage,
  resetStorageForTesting,
} from './storage';

// Calculator
export {
  calculatePerformanceMetrics,
  calculateQuickSummary,
  compareToBaseline,
} from './calculator';

// Recorder
export { recordAIDecision, buildDecisionRecord } from './recorder';
export type { RaceHeader, RecordOptions } from './recorder';

// Export
export {
  exportMetricsReport,
  exportDecisionRecords,
  exportMetricsData,
  exportDecisionRecordsCSV,
} from './export';
