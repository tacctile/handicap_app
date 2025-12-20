/**
 * Breeding Information Extractor
 *
 * Extracts and structures breeding information from DRF horse data.
 * Main entry point for breeding analysis in the handicapping system.
 */

import type { HorseEntry, Breeding } from '../../types/drf'
import type {
  BreedingInfo,
  BreedingDisplayInfo,
  ExperienceLevel,
  BreedingScore,
  EMPTY_BREEDING_SCORE,
} from './types'
import {
  parseBreedingLine,
  isUnknownSire,
  isUnknownDam,
  formatBreedingDisplay,
  getExperienceLevel,
  getExperienceLabel,
  qualifiesForBreedingAnalysis,
} from './breedingData'

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract breeding information from a HorseEntry
 *
 * This is the main function for getting structured breeding data.
 * It handles the existing Breeding interface from DRF data.
 *
 * @param horse - The horse entry from DRF parsing
 * @returns Structured BreedingInfo object
 */
export function extractBreedingInfo(horse: HorseEntry): BreedingInfo {
  const breeding = horse.breeding
  const lifetimeStarts = horse.lifetimeStarts ?? 0

  // Extract from the existing Breeding interface
  const sire = normalizeBreedingName(breeding.sire)
  const dam = normalizeBreedingName(breeding.dam)
  const damsire = normalizeBreedingName(breeding.damSire)
  const whereBred = breeding.whereBred?.trim() || 'Unknown'

  // Determine completeness
  const hasSire = !isUnknownSire(sire)
  const hasDam = !isUnknownDam(dam)
  const hasDamsire = damsire !== null && damsire !== '' && damsire.toLowerCase() !== 'unknown'

  return {
    sire: sire || 'Unknown',
    dam: dam || 'Unknown',
    damsire: damsire || 'Unknown',
    lifetimeStarts,
    isLightlyRaced: lifetimeStarts < 8,
    isDebut: lifetimeStarts === 0,
    isComplete: hasSire && hasDam && hasDamsire,
    whereBred,
  }
}

/**
 * Normalize a breeding name (handle empty/null values)
 */
function normalizeBreedingName(name: string | undefined | null): string | null {
  if (!name) return null
  const trimmed = name.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '--') return null
  return trimmed
}

// ============================================================================
// DISPLAY INFO EXTRACTION
// ============================================================================

/**
 * Get display-ready breeding information for UI components
 *
 * @param horse - The horse entry from DRF parsing
 * @returns BreedingDisplayInfo for UI rendering
 */
export function getBreedingDisplayInfo(horse: HorseEntry): BreedingDisplayInfo {
  const info = extractBreedingInfo(horse)
  const experienceLevel = getExperienceLevel(info.lifetimeStarts)

  return {
    sire: info.sire,
    dam: info.dam,
    damsire: info.damsire,
    starts: info.lifetimeStarts,
    experienceLabel: getExperienceLabel(experienceLevel),
    experienceLevel,
    showBreedingScore: qualifiesForBreedingAnalysis(info.lifetimeStarts),
    whereBred: info.whereBred,
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Check if a horse is lightly raced (< 8 starts)
 */
export function isLightlyRaced(horse: HorseEntry): boolean {
  return (horse.lifetimeStarts ?? 0) < 8
}

/**
 * Check if a horse is making its debut (0 starts)
 */
export function isDebutRunner(horse: HorseEntry): boolean {
  return (horse.lifetimeStarts ?? 0) === 0
}

/**
 * Get the experience level for a horse
 */
export function getHorseExperienceLevel(horse: HorseEntry): ExperienceLevel {
  return getExperienceLevel(horse.lifetimeStarts ?? 0)
}

/**
 * Check if breeding data is available for analysis
 */
export function hasBreedingData(horse: HorseEntry): boolean {
  const info = extractBreedingInfo(horse)
  return !isUnknownSire(info.sire) || !isUnknownDam(info.dam)
}

/**
 * Get a formatted breeding string for display
 */
export function getBreedingString(horse: HorseEntry): string {
  const info = extractBreedingInfo(horse)
  return formatBreedingDisplay(info.sire, info.dam, info.damsire)
}

/**
 * Get experience badge text and color
 */
export function getExperienceBadge(
  horse: HorseEntry
): { text: string; color: string; bgColor: string } {
  const level = getHorseExperienceLevel(horse)

  switch (level) {
    case 'debut':
      return {
        text: 'DEBUT',
        color: '#22c55e',
        bgColor: '#22c55e20',
      }
    case 'lightly_raced':
      return {
        text: `${horse.lifetimeStarts ?? 0} STARTS`,
        color: '#3b82f6',
        bgColor: '#3b82f620',
      }
    case 'experienced':
      return {
        text: 'EXPERIENCED',
        color: '#6b7280',
        bgColor: '#6b728020',
      }
  }
}

// ============================================================================
// RACE-LEVEL UTILITIES
// ============================================================================

/**
 * Count lightly raced horses in a race
 */
export function countLightlyRacedHorses(horses: HorseEntry[]): number {
  return horses.filter((h) => isLightlyRaced(h) && !h.isScratched).length
}

/**
 * Count debut horses in a race
 */
export function countDebutHorses(horses: HorseEntry[]): number {
  return horses.filter((h) => isDebutRunner(h) && !h.isScratched).length
}

/**
 * Get all lightly raced horses in a race
 */
export function getLightlyRacedHorses(horses: HorseEntry[]): HorseEntry[] {
  return horses.filter((h) => isLightlyRaced(h) && !h.isScratched)
}

/**
 * Check if race has significant number of lightly raced horses
 * (more than 30% of the field)
 */
export function isLightlyRacedRace(horses: HorseEntry[]): boolean {
  const activeHorses = horses.filter((h) => !h.isScratched)
  const lightlyRaced = countLightlyRacedHorses(horses)
  return lightlyRaced / activeHorses.length > 0.3
}

// ============================================================================
// PLACEHOLDER FOR PART 2: SCORING
// ============================================================================

/**
 * Placeholder for breeding score calculation
 * Will be implemented in Part 2
 */
export function calculateBreedingScore(_horse: HorseEntry): BreedingScore {
  // Return empty score for now - scoring will be implemented in Part 2
  return {
    total: 0,
    breakdown: {
      sireScore: 0,
      damScore: 0,
      damsireScore: 0,
      fitScore: 0,
    },
    confidence: 'none',
    summary: 'Breeding scoring not yet implemented',
    wasApplied: false,
    notAppliedReason: 'Part 2: Scoring system not yet implemented',
  }
}
