/**
 * Multi-Race Exotic Bet Module
 *
 * Provides complete functionality for multi-race exotic bets:
 * - Daily Double, Pick 3, Pick 4, Pick 5, Pick 6
 *
 * Features:
 * - Cost calculation for all bet types
 * - Ticket optimization based on budget and strategy
 * - Carryover tracking for Pick 5/6
 * - Interactive ticket building
 * - Bet slip integration
 */

// Types
export type {
  MultiRaceBetType,
  MultiRaceStrategy,
  RaceStrength,
  MultiRaceBetConfig,
  RaceSelection,
  MultiRaceHorse,
  MultiRaceRaceData,
  MultiRaceCost,
  MultiRaceOptimizationConfig,
  OptimizedTicket,
  MultiRaceOptimizationResult,
  CarryoverInfo,
  TicketBuilderState,
  LegSuggestion,
  MultiRaceTicketDisplay,
} from './multiraceTypes';

// Type configs and utilities
export {
  MULTI_RACE_BET_CONFIGS,
  CARRYOVER_THRESHOLDS,
  getBetConfig,
  getAllBetTypes,
  supportsCarryover,
  getAvailableBetTypes,
} from './multiraceTypes';

// Calculator
export {
  calculateCombinations,
  calculateBasicCost,
  generateSpreadNotation,
  calculateMultiRaceCost,
  calculateDailyDoubleCost,
  calculatePick3Cost,
  calculatePick4Cost,
  calculatePick5Cost,
  calculatePick6Cost,
  calculateWithAllOption,
  findOptimalBaseBet,
  findMaxSelectionsForBudget,
  compareSpreads,
  generateWindowInstruction,
  MAX_TICKET_COST,
  MAX_SELECTIONS_PER_RACE,
  MIN_SELECTIONS_PER_RACE,
} from './multiraceCalculator';

// Optimizer
export {
  classifyRaceStrength,
  findStandoutHorse,
  analyzeHorseStandout,
  getTopHorsesForRace,
  calculateTicketProbability,
  estimatePayoutRange,
  calculateExpectedValue,
  generateOptimalSelections,
  buildOptimizedTicket,
  optimizeMultiRaceBet,
  optimizeDailyDouble,
  optimizePick3,
  optimizePick4,
  optimizePick5,
  optimizePick6,
  getAvailableMultiRaceBets,
  analyzeRaceCard,
  type StandoutAnalysis,
} from './multiraceOptimizer';

// Carryover Tracker
export {
  classifyCarryoverValue,
  getCarryoverRecommendation,
  formatCarryoverAmount,
  createCarryoverInfo,
  parseCarryoverAmount,
  parseCarryoverFromDRF,
  calculateCarryoverAdjustedEV,
  saveCarryovers,
  loadCarryovers,
  getCarryover,
  updateCarryover,
  clearCarryovers,
  shouldAlertCarryover,
  getHighValueCarryovers,
  createCarryoverAlert,
  getCarryoverBadgeColor,
  formatCarryoverDisplay,
  HIGH_VALUE_THRESHOLD,
} from './carryoverTracker';

// Ticket Builder
export {
  createBuilderState,
  updateLegSelection,
  toggleHorseInLeg,
  toggleAllForLeg,
  updateBaseBet,
  updateBudget,
  updateStrategy,
  generateLegSuggestion,
  generateAllSuggestions,
  applySuggestion,
  applyAllSuggestions,
  autoOptimizeForBudget,
  buildTicketFromState,
  convertToTicketDisplay,
  formatTicketForWindow,
  formatTicketForClipboard,
  validateBuilderState,
  getStateSummary,
  getProbabilityColor,
  getEVColor,
  formatProbability,
  formatEV,
} from './multiraceBuilder';
