/**
 * Nuclear Longshot Detection System
 *
 * Identifies horses at 25/1+ odds with specific upset angles
 * that create logical scenarios for massive upsets.
 *
 * @module longshots
 */

// Types
export {
  type UpsetAngleCategory,
  type DetectedUpsetAngle,
  type LongshotClassification,
  type LongshotAnalysisResult,
  type UpsetAngleDefinition,
  MIN_LONGSHOT_ODDS_DECIMAL,
  MIN_LONGSHOT_ODDS_RATIO,
  MIN_BASE_SCORE,
  MIN_ANGLE_POINTS_LIVE,
  MIN_ANGLE_POINTS_NUCLEAR,
  UPSET_ANGLE_NAMES,
  UPSET_ANGLE_ICONS,
  UPSET_ANGLE_COLORS,
  UPSET_ANGLE_BASE_POINTS,
  UPSET_ANGLE_DEFINITIONS,
  LONGSHOT_CLASSIFICATION_META,
  parseOddsToDecimal,
  formatOddsDisplay,
  isLongshotOdds,
  getClassificationFromPoints,
  calculateUpsetProbability,
  calculateExpectedValue,
  getClassificationColor,
  getClassificationIcon,
} from './longshotTypes'

// Detector
export {
  detectPaceDevastation,
  detectClassRelief,
  detectEquipmentRescue,
  detectTrainerPattern,
  detectTrackBiasFit,
  detectHiddenForm,
  detectAllUpsetAngles,
} from './longshotDetector'

// Scoring
export {
  type RaceLongshotSummary,
  calculateTotalAnglePoints,
  analyzeLongshot,
  analyzeRaceLongshots,
  getBestAngle,
  formatExpectedValue,
  formatUpsetProbability,
  formatROIPotential,
  getClassificationDisplayColor,
  sortLongshotsByQuality,
} from './longshotScoring'

// Validator
export {
  type EvidenceValidation,
  type AngleValidationResult,
  validatePaceScenarioData,
  validateRunningStyleData,
  validateClassMovement,
  validateProvenAtLevel,
  validateEquipmentChange,
  validateTrainerPattern,
  validateWorkoutPattern,
  validateTripExcuse,
  validateAngle,
  validateAllAngles,
  getValidatedAngles,
} from './longshotValidator'
