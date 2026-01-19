// Tier classification
export * from './tierClassification';

// Legacy bet recommendations (for backward compatibility)
export * from './betRecommendations';

// Original Kelly criterion (full featured)
export * from './kellyCriterion';
export * from './kellyValidator';
export * from './kellySettings';

// ============================================================================
// QUARTER-KELLY BETTING MODULE (New)
// ============================================================================

// Quarter-Kelly Calculator - Core Kelly calculations with Quarter-Kelly default
export {
  calculateKelly as calculateQuarterKelly,
  calculateFractionalKelly,
  parseOddsToDecimal as parseOddsToDecimalKelly,
  decimalOddsToDisplay,
  isCalibrationReady,
  formatKellyResult as formatQuarterKellyResult,
  validateKellyInput,
  KELLY_FRACTION_MULTIPLIERS,
  KELLY_FRACTION_LABELS as QUARTER_KELLY_LABELS,
  type KellyInput as QuarterKellyInput,
  type KellyOutput as QuarterKellyOutput,
  type KellyFraction as QuarterKellyFraction,
} from './kellyCalculator';

// Bet Sizer - Applies practical constraints to Kelly recommendations
export {
  sizeBet,
  adjustForSimultaneousBets,
  calculateTotalExposure,
  calculateExposurePercent,
  createConfigFromRiskTolerance,
  validateBetSizingConfig,
  formatSizedBet,
  getRecommendedConfig,
  DEFAULT_BET_SIZING_CONFIG,
  AGGRESSIVE_BET_SIZING_CONFIG,
  CONSERVATIVE_BET_SIZING_CONFIG,
  type BetSizingConfig,
  type SizedBet,
  type AdjustedBet,
} from './betSizer';

// Bet Recommender - Generates race-level betting recommendations
export {
  generateBetRecommendations as generateKellyBetRecommendations,
  sortRecommendationsByValue,
  filterByBetType,
  getTopRecommendations,
  formatRecommendation as formatKellyRecommendation,
  calculatePotentialReturn,
  DEFAULT_FILTERS,
  type BetRecommendation as KellyBetRecommendation,
  type RaceRecommendations,
  type RecommendationFilters,
  type RecommendationConfidence,
  type BetType as KellyBetType,
} from './betRecommender';

// Place/Show Estimator - Probability estimation for place and show bets
export {
  estimatePlaceProbability,
  estimateShowProbability,
  estimatePlaceShowOdds,
  calculatePlaceShowEV,
  recommendPlaceShowVsWin,
  formatPlaceShowEstimate,
  type PlaceShowEstimate,
  type EstimateConfidence,
} from './placeShowEstimator';

// Exotic Calculator - Exacta, trifecta, superfecta key calculations
export {
  calculateExactaKey,
  calculateTrifectaKey,
  calculateSuperfectaKey,
  recommendExoticKeys,
  formatExoticBet,
  calculateBoxCombinations,
  calculateBoxCost,
  validateExoticBet,
  getExoticBetInfo,
  type ExoticBetType,
  type ExoticKeyBet,
  type ExoticRecommendations,
} from './exoticCalculator';

// Bankroll Tracker - Session tracking and persistence
export {
  BankrollTracker,
  saveBankrollState,
  loadBankrollState,
  clearBankrollState,
  formatBankrollState,
  getSessionDuration,
  calculateSessionRisk,
  type BankrollState,
  type BetRecord,
} from './bankrollTracker';

// ============================================================================
// LEGACY EXPORTS (unchanged)
// ============================================================================

// Bet types - selectively export to avoid conflicts with betRecommendations
export type {
  MultiRaceBetType,
  LegStrategy,
  MultiRaceQuality,
  MultiRaceConfidence,
  MultiRaceLeg,
  MultiRaceBet,
  MultiRaceOpportunity,
  MultiRaceBetTypeInfo,
} from './betTypes';
export {
  MULTI_RACE_BET_CONFIGS,
  isMultiRaceBetAvailable,
  getAvailableMultiRaceBetTypes,
} from './betTypes';

// Day session management
export * from './daySession';

// Budget allocation
export * from './allocateDayBudget';

// Multi-race betting
export * from './multiRaceBets';
export * from './multiRaceTickets';
export * from './multiRacePayouts';
