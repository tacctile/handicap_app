/**
 * Exotic Bet Calculator and Optimizer Module
 *
 * Provides tools for:
 * - Calculating exotic bet costs (exacta, trifecta, superfecta)
 * - Optimizing bet structures for budget
 * - Estimating payouts based on horse odds
 * - Comparing bet structures side-by-side
 */

// Calculator exports
export {
  calculateExactaBoxCost,
  calculateExactaKeyOverCost,
  calculateExactaKeyUnderCost,
  calculateExactaWheelCost,
  calculateExactaStraightCost,
  calculateTrifectaBoxCost,
  calculateTrifectaKeyCost,
  calculateTrifectaPartWheelCost,
  calculateTrifectaWheelCost,
  calculateSuperfectaBoxCost,
  calculateSuperfectaKeyCost,
  calculateSuperfectaPartWheelCost,
  calculateSuperfectaWheelCost,
  calculateExoticCost,
  calculateTotalExoticCost,
  BASE_BET_OPTIONS,
  DEFAULT_BASE_BETS,
  MIN_HORSES,
  type ExoticBetType,
  type BetStructure,
  type ExoticCost,
  type ExoticBetConfig,
} from './exoticCalculator'

// Optimizer exports
export {
  optimizeExoticBet,
  suggestBaseBet,
  calculateAllExoticOptions,
  type HorseTier,
  type OptimizationConfig,
  type OptimizedBetOption,
  type OptimizationResult,
} from './exoticOptimizer'

// Payout estimator exports
export {
  estimateExoticPayout,
  quickPayoutEstimate,
  estimateROI,
  comparePayouts,
  parseOddsToDecimal,
  PAYOUT_MULTIPLIERS,
  TRACK_TAKEOUT,
  type HorseOdds,
  type PayoutRange,
  type PayoutEstimate,
  type PayoutScenario,
} from './exoticPayoutEstimator'

// Comparison exports
export {
  generateComparisonTable,
  formatComparisonTable,
  compareStructuresForType,
  type ComparisonRow,
  type ComparisonTable,
  type ComparisonConfig,
} from './exoticComparison'
