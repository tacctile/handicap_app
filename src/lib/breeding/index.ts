/**
 * Breeding Analysis Module
 *
 * Exports for breeding data extraction and analysis.
 * Part 1: Data extraction and display
 * Part 2: Scoring (to be implemented)
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
  calculateBreedingScore,
} from './breedingExtractor'
