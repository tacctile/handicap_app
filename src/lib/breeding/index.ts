/**
 * Breeding Analysis Module
 *
 * Exports for breeding data extraction and analysis.
 * Part 1: Data extraction and display
 * Part 2: Sire/Dam/Damsire databases and scoring
 */

// Types
export type {
  BreedingInfo,
  BreedingScore,
  BreedingScoreBreakdown,
  BreedingConfidence,
  BreedingDisplayInfo,
  BreedingAnalysis,
  BreedingParseResult,
  SireProfile,
  DamProfile,
  DamsireProfile,
  SurfacePreference,
  DistancePreference,
  ExperienceLevel,
} from './types'

export {
  EXPERIENCE_THRESHOLDS,
  BREEDING_SCORE_LIMITS,
  EMPTY_BREEDING_SCORE,
  DEFAULT_SIRE_PROFILE,
  DEFAULT_DAM_PROFILE,
  DEFAULT_DAMSIRE_PROFILE,
} from './types'

// Data extraction utilities
export {
  parseBreedingLine,
  isUnknownSire,
  isUnknownDam,
  isBreedingComplete,
  hasBasicBreeding,
  formatBreedingDisplay,
  formatProperName,
  getExperienceLevel,
  getExperienceLabel,
  getExperienceDescription,
  qualifiesForBreedingAnalysis,
  getBreedingWeight,
} from './breedingData'

// Main extraction functions
export {
  extractBreedingInfo,
  getBreedingDisplayInfo,
  isLightlyRaced,
  isDebutRunner,
  getHorseExperienceLevel,
  hasBreedingData,
  getBreedingString,
  getExperienceBadge,
  countLightlyRacedHorses,
  countDebutHorses,
  getLightlyRacedHorses,
  isLightlyRacedRace,
} from './breedingExtractor'

// ============================================================================
// PART 2: BREEDING DATABASES AND SCORING
// ============================================================================

// Sire database
export {
  SIRE_DATABASE,
  SIRE_TIER_THRESHOLDS,
  lookupSire,
  getAllSireNames,
  getSiresByTier,
  calculateSireScore,
  getSireTierLabel,
  getSireTierColor,
  normalizeSireName,
  type ExtendedSireProfile,
  type SireTier,
} from './sireDatabase'

// Dam database
export {
  DAM_DATABASE,
  DAM_TIER_THRESHOLDS,
  lookupDam,
  getAllDamNames,
  calculateDamScore,
  getDamTierLabel,
  getDamTierColor,
  normalizeDamName,
  estimateDamScoreFromClass,
  type ExtendedDamProfile,
  type DamTier,
} from './damDatabase'

// Damsire database
export {
  DAMSIRE_DATABASE,
  DAMSIRE_TIER_THRESHOLDS,
  lookupDamsire,
  getAllDamsireNames,
  calculateDamsireScore,
  getDamsireTierLabel,
  getDamsireTierColor,
  normalizeDamsireName,
  type ExtendedDamsireProfile,
  type DamsireTier,
} from './damsireDatabase'

// Breeding scoring
export {
  calculateDetailedBreedingScore,
  calculateBreedingScoreForHorse,
  shouldShowBreedingAnalysis,
  getBreedingScoreWeight,
  calculateBreedingContribution,
  getBreedingScoreDisplay,
  MAX_STARTS_FOR_BREEDING,
  BREEDING_CATEGORY_LIMITS,
  type DetailedBreedingScore,
  type BreedingScoreContext,
} from './breedingScoring'
