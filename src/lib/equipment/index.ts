/**
 * Equipment Impact Calculator Module
 *
 * Exports all equipment analysis functionality including:
 * - Equipment type definitions and codes
 * - Equipment extraction from DRF data
 * - Trainer-specific equipment patterns
 * - Equipment impact scoring
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  EquipmentCode,
  EquipmentCategory,
  EquipmentChangeDirection,
  ImpactClassification,
  EquipmentTypeDefinition,
  DetectedEquipmentChange,
  EquipmentAnalysis,
  EquipmentHistoryEntry,
} from './equipmentTypes'

export type {
  EquipmentExtractionResult,
} from './equipmentExtractor'

export type {
  EquipmentChangeType,
  TrainerEquipmentPattern,
  TrainerProfile,
} from './trainerPatterns'

export type {
  EquipmentScoreResult,
} from './equipmentScoring'

// ============================================================================
// EQUIPMENT TYPES
// ============================================================================

export {
  EQUIPMENT_CODES,
  EQUIPMENT_TYPES,
  getEquipmentType,
  equipmentCodeToName,
  getImpactClassification,
  getImpactColor,
  getImpactIcon,
  getCategoryIcon,
} from './equipmentTypes'

// ============================================================================
// EQUIPMENT EXTRACTION
// ============================================================================

export {
  extractEquipmentInfo,
  getEquipmentChangeSummary,
  analyzeEquipmentHistory,
  hasEquipment,
  hasUsedEquipmentBefore,
} from './equipmentExtractor'

// ============================================================================
// TRAINER PATTERNS
// ============================================================================

export {
  MIN_SAMPLE_SIZE,
  BASE_RATES,
  normalizeTrainerName,
  getTrainerProfile,
  getTrainerPattern,
  hasCrediblePattern,
  equipmentIdToChangeType,
  calculateTrainerAdjustedPoints,
  getTrainersForChangeType,
  getTopLasixTrainers,
  getTopBlinkersTrainers,
  compareToBaseRate,
} from './trainerPatterns'

// ============================================================================
// EQUIPMENT SCORING
// ============================================================================

export {
  BASE_EQUIPMENT_SCORE,
  MAX_EQUIPMENT_SCORE,
  MIN_EQUIPMENT_SCORE,
  calculateEquipmentImpactScore,
  getEquipmentImpactSummary,
  hasSignificantEquipmentImpact,
  getEquipmentScoreColor,
  formatEquipmentChange,
  getHorsesWithEquipmentChanges,
  countEquipmentChanges,
} from './equipmentScoring'
