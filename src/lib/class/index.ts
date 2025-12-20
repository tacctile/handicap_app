/**
 * Class Analysis Module
 *
 * Provides comprehensive class level analysis including:
 * - Class level identification and comparison
 * - Class movement detection (drops, rises, lateral)
 * - Hidden class drop identification (value plays)
 * - Track tier classification
 * - Class-based scoring
 */

// Types
export {
  ClassLevel,
  CLASS_LEVEL_METADATA,
  type ClassLevelMetadata,
  type ClassMovementDirection,
  type ClassMovementMagnitude,
  type ClassMovement,
  type ClassAnalysisResult,
  type ProvenAtLevelResult,
  type HiddenClassDrop,
  type HiddenDropType,
  type TrackTier,
  type TrackTierMovement,
  // Utility functions
  getClassLevelName,
  getClassLevelAbbrev,
  getClassParBeyer,
  compareClassLevels,
  getMovementMagnitude,
  getClassMovementColor,
  getClassMovementIcon,
} from './classTypes'

// Track tiers
export {
  type TrackInfo,
  TIER_A_TRACKS,
  TIER_B_TRACKS,
  TIER_C_TRACKS,
  getTrackTier,
  getTrackInfo,
  isTierATrack,
  isTierCTrack,
  analyzeTrackTierMovement,
  getTierColor,
  getTierDisplayName,
  getTracksByTier,
  isShipperFromElite,
} from './trackTiers'

// Class extraction
export {
  extractClassFromPP,
  extractCurrentRaceClass,
  getRecentClassLevels,
  analyzeClassMovement,
  analyzeClassMovementWithClaiming,
  analyzeProvenAtLevel,
  detectHiddenClassDrops,
  analyzeClass,
  parseClassFromConditions,
} from './classExtractor'

// Class scoring
export {
  MAX_CLASS_SCORE,
  type ClassScoreResult,
  type ClassScoreBreakdownItem,
  calculateClassScore,
  getClassScoreColor,
  getClassScoreTier,
  formatClassMovement,
  getHiddenDropsSummary,
  hasSignificantHiddenValue,
  isValuePlay,
} from './classScoring'
