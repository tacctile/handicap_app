/**
 * Recommendations Module
 *
 * Comprehensive bet recommendation system integrating all Phase 2 scoring modules.
 * Generates actionable bet recommendations with proper sizing, window instructions,
 * and detailed explanations.
 *
 * @module recommendations
 */

// Bet Generator - Main entry point
export {
  generateRecommendations,
  type GeneratorInput,
  type GeneratedBet,
  type GeneratedTierBets,
  type SpecialCategoryBets,
  type BetGeneratorResult,
} from './betGenerator'

// Bet Sizing
export {
  calculateBetAmount,
  calculateKellyBetAmount,
  scaleBetsByBankroll,
  getBetSizingConfig,
  getTierAllocation,
  getConfidenceMultiplier,
  validateBudget,
  getRemainingBudget,
  optimizeBetDistribution,
  SIMPLE_MODE_ALLOCATIONS,
  MODERATE_MODE_ALLOCATIONS,
  TIER_MULTIPLIERS,
  CONFIDENCE_MULTIPLIERS,
  RISK_MULTIPLIERS,
  BET_LIMITS,
  type BetSizingConfig,
  type TierAllocation,
} from './betSizing'

// Window Instructions
export {
  generateWindowInstruction,
  generateFullInstruction,
  formatBetSlip,
  formatBetSlipSimple,
  formatSingleBet,
  formatAmount,
  formatDisplayAmount,
  formatCurrency,
  formatHorseNumbers,
  formatHorseNumbersComma,
  generatePartWheelInstruction,
  generateSuperfectaWithAllInstruction,
  generateMultiRaceInstruction,
  validateInstruction,
  type WindowInstruction,
  type BetSlipEntry,
  type FormattedBetSlip,
} from './windowInstructions'

// Bet Explanations
export {
  generateBetExplanation,
  generateBetNarrative,
  generateFullBetExplanation,
  getScoringSources,
  formatExplanationForDisplay,
  type ExplanationSection,
  type BetExplanation,
} from './betExplanations'

// Re-export commonly used types from other modules
export type {
  BetRecommendation,
  TierBetRecommendations,
  ClassifiedHorse,
  TierGroup,
  BettingTier,
} from '../betting'

export type { ScoredHorse, HorseScore, ScoreBreakdown } from '../scoring'
export type { UseBankrollReturn, BettingStyle, ComplexityMode } from '../../hooks/useBankroll'
