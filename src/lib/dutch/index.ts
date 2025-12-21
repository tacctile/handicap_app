/**
 * Dutch Booking Module
 *
 * Implements Dutch booking strategy for distributing risk across multiple horses
 * while guaranteeing profit if any selected horse wins.
 *
 * @module dutch
 */

// Core calculator
export {
  calculateDutchBook,
  calculateDutchForTargetProfit,
  calculateDutchForTargetReturn,
  calculateDutchEdge,
  findMaxViableStake,
  calculateImpliedProbability,
  parseOddsToDecimal,
  roundToNearest,
  MINIMUM_TOTAL_STAKE,
  MAX_DUTCH_HORSES,
  RECOMMENDED_MAX_HORSES,
  DEFAULT_MINIMUM_BET,
  DEFAULT_ROUND_TO_NEAREST,
  type DutchHorse,
  type DutchBet,
  type DutchResult,
  type DutchConfig,
} from './dutchCalculator';

// Validator
export {
  validateDutchBook,
  validateHorse,
  validateDutchResult,
  analyzeEdge,
  classifyEdge,
  canFormProfitableDutch,
  calculateMinimumViableStake,
  EDGE_THRESHOLDS,
  RECOMMENDED_MIN_EDGE,
  EDGE_COLORS,
  EDGE_ICONS,
  type DutchValidationInput,
  type DutchValidationResult,
  type EdgeAnalysis,
  type EdgeClassification,
} from './dutchValidator';

// Optimizer
export {
  findOptimalDutchCombinations,
  findQuickBestDutch,
  hasProfitableDutch,
  getTopDutchOpportunities,
  convertToDutchCandidates,
  filterDutchCandidates,
  type DutchCandidateHorse,
  type DutchCombination,
  type OptimizationResult,
  type OptimizationConfig,
  type HorseTierForDutch,
} from './dutchOptimizer';

// Display
export {
  generateDutchSummary,
  generateBetInstruction,
  generateFullDutchDisplay,
  generateDutchExplanation,
  generateCompactExplanation,
  formatDutchCombination,
  generateDutchRankingDisplay,
  formatWindowInstruction,
  formatAllWindowInstructions,
  formatDutchForCopy,
  formatLiveCalculation,
  formatHorseOption,
  formatCurrency,
  formatCurrencyForWindow,
  formatPercent,
  formatROI,
  EDGE_CLASS_LABELS,
  type DutchDisplaySummary,
  type DutchBetInstruction,
  type DutchFullDisplay,
} from './dutchDisplay';

// Settings
export {
  loadDutchSettings,
  saveDutchSettings,
  resetDutchSettings,
  mergeDutchSettings,
  validateDutchSettings,
  getDutchPresetForRisk,
  DEFAULT_DUTCH_SETTINGS,
  DUTCH_EDGE_OPTIONS,
  DUTCH_MAX_HORSES_OPTIONS,
  DUTCH_EDUCATION,
  type DutchSettings,
  type DutchRiskPreset,
} from './dutchSettings';
