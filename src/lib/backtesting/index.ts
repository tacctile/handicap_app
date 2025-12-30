/**
 * Backtesting Module
 *
 * Provides tools for validating algorithm predictions against
 * actual race results from DRF Text Chart files.
 */

// Chart Parser
export {
  parseChartFile,
  getChartRace,
  getActiveStarters,
  getWinner,
  getTopFinishers,
  getRacePayoffs,
} from '../chartParser';

// Prediction Matcher
export {
  matchPredictionsToResults,
  getMatchedByTier,
  getTopPredictions,
  isPredictionHit,
  didTopPredictionWin,
  didTopPredictionShow,
  isExactaHit,
  getTierWinners,
  getAverageMatchConfidence,
  type MatchOptions,
} from './predictionMatcher';

// Accuracy Calculator
export {
  analyzeRace,
  calculateAccuracy,
  calculateAccuracyFromAnalyses,
  formatAccuracyReport,
  compareAccuracy,
  type RaceAnalysis,
  type AccuracyOptions,
} from './accuracyCalculator';

// Re-export types
export type {
  ChartHeader,
  ChartRace,
  ChartStarter,
  ParsedChartFile,
  ChartParseWarning,
  MatchedResult,
  AccuracyMetrics,
} from '../../types/chart';
