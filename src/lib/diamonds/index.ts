/**
 * Diamond in Rough Detection Module
 *
 * Exports all diamond-related functionality for detecting and validating
 * "hidden gems" - horses with moderate scores but massive overlays and
 * multiple supporting factors for upset potential.
 */

// Types
export type {
  PerfectStormFactorType,
  DetectedFactor,
  DiamondAnalysis,
  RaceDiamondSummary,
} from './diamondTypes'

// Constants
export {
  DIAMOND_SCORE_MIN,
  DIAMOND_SCORE_MAX,
  DIAMOND_MIN_OVERLAY_PERCENT,
  DIAMOND_MIN_FACTORS,
  CONFIDENCE_PER_FACTOR,
  FACTOR_NAMES,
  FACTOR_ICONS,
  FACTOR_COLORS,
} from './diamondTypes'

// Utility Functions
export {
  isScoreInDiamondRange,
  meetsMinimumOverlay,
  meetsMinimumFactors,
  calculateConfidence,
  getDiamondColor,
  getDiamondBgColor,
  getDiamondBorderColor,
} from './diamondTypes'

// Detector Functions
export {
  analyzeDiamondCandidate,
  analyzeRaceDiamonds,
  mightBeDiamond,
} from './diamondDetector'

// Validator Functions and Types
export {
  validateDiamond,
  validateDiamonds,
  getValidatedDiamonds,
  isDiamondValid,
  type FactorValidationResult,
  type DiamondValidationResult,
} from './diamondValidator'
