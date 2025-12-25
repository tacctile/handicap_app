/**
 * Sex-Based Race Restriction Analysis
 *
 * Provides subtle adjustments when fillies/mares compete against males vs their own sex.
 * This is a minor refinement factor (max -1 pt) based on historical performance patterns.
 *
 * Key Concepts:
 * - Fillies/mares running in restricted (own sex) races: baseline (0 pts)
 * - Fillies/mares stepping up to face males in open races: -1 pt (historically tougher)
 * - Males in open races: baseline (0 pts)
 * - First-time facing opposite sex: flagged for awareness
 *
 * Sex codes from DRF:
 * - c = Colt (young male, typically under 5)
 * - f = Filly (young female, typically under 5)
 * - g = Gelding (castrated male)
 * - h = Horse (intact male, 5+)
 * - m = Mare (female, 5+)
 * - r = Ridgling (cryptorchid)
 */

import type { HorseEntry, RaceHeader, PastPerformance } from '../../types/drf';
import { logger } from '../../services/logging';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum adjustment (penalty) for sex-based analysis */
export const MAX_SEX_ADJUSTMENT = 1; // -1 pt max

/** Female sex codes */
const FEMALE_SEX_CODES = ['f', 'm'];

/** Male sex codes */
const MALE_SEX_CODES = ['c', 'g', 'h', 'r'];

/** Restricted race indicators in sexRestriction field */
const FILLIES_MARES_RESTRICTIONS = ['F&M', 'F', 'M'];

// ============================================================================
// TYPES
// ============================================================================

export interface SexRestrictionAnalysis {
  /** Horse's sex code (c/f/g/h/m/r) */
  horseSex: string;
  /** Horse's sex full name */
  horseSexFull: string;
  /** Whether horse is female (filly or mare) */
  isFemale: boolean;
  /** Whether race is restricted to fillies/mares only */
  isRestrictedRace: boolean;
  /** Whether race is open/mixed (both sexes) */
  isMixedRace: boolean;
  /** Restriction type from race header */
  raceRestriction: string;
  /** Detected restriction method */
  detectionMethod: 'header' | 'field_composition' | 'conditions_text' | 'none';
  /** Whether this is horse's first time facing opposite sex */
  isFirstTimeFacingMales: boolean;
  /** Count of past races against males (for females only) */
  pastRacesVsMales: number;
  /** Score adjustment (-1 to 0) */
  adjustment: number;
  /** Human-readable reasoning */
  reasoning: string;
  /** Additional flags for awareness */
  flags: string[];
}

export interface SexRestrictionScoreResult {
  /** Total points (always 0 or negative, max -1) */
  total: number;
  /** Full analysis details */
  analysis: SexRestrictionAnalysis;
  /** Summary reasoning for display */
  reasoning: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a sex code represents a female horse
 */
function isFemaleHorse(sex: string): boolean {
  return FEMALE_SEX_CODES.includes(sex.toLowerCase());
}

/**
 * Check if a sex code represents a male horse
 */
function isMaleHorse(sex: string): boolean {
  return MALE_SEX_CODES.includes(sex.toLowerCase());
}

/**
 * Check if race restriction indicates fillies/mares only
 */
function isFillyMareRestriction(sexRestriction: string): boolean {
  const normalized = sexRestriction.toUpperCase().trim();
  return FILLIES_MARES_RESTRICTIONS.includes(normalized);
}

/**
 * Detect race restriction from conditions text as fallback
 */
function detectFromConditions(conditions: string): boolean {
  const text = conditions.toLowerCase();
  return (
    text.includes('fillies') ||
    text.includes('mares') ||
    text.includes('f&m') ||
    text.includes('fillies and mares')
  );
}

/**
 * Check field composition to determine if all horses are female
 * Used as fallback when race header doesn't have restriction info
 */
function isAllFemaleField(fieldHorses: HorseEntry[]): boolean {
  if (fieldHorses.length === 0) return false;

  // All horses in field must be female
  return fieldHorses.every((horse) => isFemaleHorse(horse.sex));
}

/**
 * Check if field is mixed (has both male and female horses)
 */
function isMixedField(fieldHorses: HorseEntry[]): boolean {
  if (fieldHorses.length === 0) return false;

  const hasFemale = fieldHorses.some((horse) => isFemaleHorse(horse.sex));
  const hasMale = fieldHorses.some((horse) => isMaleHorse(horse.sex));

  return hasFemale && hasMale;
}

/**
 * Analyze past performances to count races against males
 * Looks for clues in race conditions/description from PPs
 */
function countRacesAgainstMales(pastPerformances: PastPerformance[]): number {
  // This is a simplified heuristic since we don't have sex restriction
  // info in past performances. We look for patterns in comments/conditions.
  // A more accurate approach would require additional PP data.

  let racesVsMales = 0;

  for (const pp of pastPerformances) {
    const conditions = (pp.comment || '').toLowerCase();
    const tripComment = (pp.tripComment || '').toLowerCase();
    const text = `${conditions} ${tripComment}`;

    // If PP mentions fillies/mares race, it was restricted
    // Otherwise, assume it was open (conservative approach)
    const wasRestricted =
      text.includes('fillies') || text.includes('mares') || text.includes('f&m');

    if (!wasRestricted) {
      racesVsMales++;
    }
  }

  return racesVsMales;
}

/**
 * Determine if this is the horse's first time facing males
 * Only relevant for female horses
 */
function isFirstTimeFacingOpposite(
  horse: HorseEntry,
  isRestrictedRace: boolean,
  pastRacesVsMales: number
): boolean {
  // Only applies to females in open races
  if (!isFemaleHorse(horse.sex)) return false;
  if (isRestrictedRace) return false;

  // If no past races against males and now facing them
  return pastRacesVsMales === 0 && horse.lifetimeStarts > 0;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze sex-based race restrictions and calculate adjustment
 *
 * @param horse - The horse entry to analyze
 * @param raceHeader - Race header with restriction info
 * @param fieldHorses - All horses in the field (for composition analysis)
 * @returns Analysis with adjustment and reasoning
 */
export function analyzeSexRestriction(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  fieldHorses: HorseEntry[]
): SexRestrictionAnalysis {
  try {
    const horseSex = (horse.sex || 'u').toLowerCase();
    const horseSexFull = horse.sexFull || 'Unknown';
    const isFemale = isFemaleHorse(horseSex);
    const raceRestriction = raceHeader.sexRestriction || '';

    // Determine if race is restricted (fillies/mares only)
    let isRestrictedRace = false;
    let detectionMethod: SexRestrictionAnalysis['detectionMethod'] = 'none';

    // Method 1: Check race header sexRestriction field
    if (isFillyMareRestriction(raceRestriction)) {
      isRestrictedRace = true;
      detectionMethod = 'header';
    }
    // Method 2: Check conditions text
    else if (detectFromConditions(raceHeader.conditions || '')) {
      isRestrictedRace = true;
      detectionMethod = 'conditions_text';
    }
    // Method 3: Check field composition (all females = restricted)
    else if (isAllFemaleField(fieldHorses)) {
      isRestrictedRace = true;
      detectionMethod = 'field_composition';
    }

    // Determine if race is mixed (open to both sexes)
    // Only consider it mixed if we can actually detect males in the field
    // If field is empty, we can't determine - be conservative
    const isMixedRace = !isRestrictedRace && fieldHorses.length > 0 && isMixedField(fieldHorses);

    // Analyze past races against males (for females only)
    const pastRacesVsMales = isFemale
      ? countRacesAgainstMales(horse.pastPerformances.slice(0, 10))
      : 0;

    // Check if first time facing males
    const isFirstTimeFacingMales = isFirstTimeFacingOpposite(
      horse,
      isRestrictedRace,
      pastRacesVsMales
    );

    // Calculate adjustment
    let adjustment = 0;
    const flags: string[] = [];
    let reasoning = '';

    if (isFemale) {
      if (isRestrictedRace) {
        // Filly/mare in fillies-only race: baseline (0 pts)
        adjustment = 0;
        reasoning = `${horseSexFull} in restricted race (${raceRestriction || 'fillies/mares only'}) - baseline`;
      } else if (isMixedRace) {
        // Filly/mare in open/mixed race: -1 pt (historically tougher)
        adjustment = -1;
        reasoning = `${horseSexFull} facing males in open race - historically tougher competition`;

        if (isFirstTimeFacingMales) {
          flags.push('First time facing male competition');
        }

        if (pastRacesVsMales === 0 && horse.lifetimeStarts > 3) {
          flags.push(`Has raced ${horse.lifetimeStarts} times, all in restricted company`);
        }
      } else {
        // Can't determine race type
        adjustment = 0;
        reasoning = `${horseSexFull} - race type undetermined`;
      }
    } else {
      // Male horse
      if (isRestrictedRace) {
        // This shouldn't happen (male in fillies-only race) but handle gracefully
        adjustment = 0;
        reasoning = `${horseSexFull} - unusual: male in restricted race`;
        flags.push('Unexpected: male entered in fillies/mares race');
      } else {
        // Male in open race: baseline (0 pts)
        adjustment = 0;
        reasoning = `${horseSexFull} in open race - baseline`;
      }
    }

    return {
      horseSex,
      horseSexFull,
      isFemale,
      isRestrictedRace,
      isMixedRace,
      raceRestriction,
      detectionMethod,
      isFirstTimeFacingMales,
      pastRacesVsMales,
      adjustment,
      reasoning,
      flags,
    };
  } catch (err) {
    logger.logError(err instanceof Error ? err : new Error(String(err)), {
      operation: 'analyzeSexRestriction',
      horseName: horse.horseName,
    });
    return {
      horseSex: horse.sex || 'u',
      horseSexFull: horse.sexFull || 'Unknown',
      isFemale: false,
      isRestrictedRace: false,
      isMixedRace: false,
      raceRestriction: '',
      detectionMethod: 'none',
      isFirstTimeFacingMales: false,
      pastRacesVsMales: 0,
      adjustment: 0,
      reasoning: 'Unable to analyze sex restriction',
      flags: [],
    };
  }
}

// ============================================================================
// SCORE CALCULATION
// ============================================================================

/**
 * Calculate sex restriction score for a horse
 *
 * @param horse - The horse entry
 * @param raceHeader - Race header info
 * @param fieldHorses - All horses in the field
 * @returns Score result with breakdown
 */
export function calculateSexRestrictionScore(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  fieldHorses: HorseEntry[]
): SexRestrictionScoreResult {
  const analysis = analyzeSexRestriction(horse, raceHeader, fieldHorses);

  // Score is the adjustment (0 or -1)
  // This is a penalty, so total is always 0 or negative
  const total = Math.max(-MAX_SEX_ADJUSTMENT, Math.min(0, analysis.adjustment));

  // Build concise reasoning
  let reasoning = analysis.reasoning;
  if (analysis.flags.length > 0) {
    reasoning += ` [${analysis.flags.join('; ')}]`;
  }

  return {
    total,
    analysis,
    reasoning,
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Check if horse is female (filly or mare)
 */
export function isHorseFemale(horse: HorseEntry): boolean {
  return isFemaleHorse(horse.sex);
}

/**
 * Check if horse is male (colt, gelding, horse, ridgling)
 */
export function isHorseMale(horse: HorseEntry): boolean {
  return isMaleHorse(horse.sex);
}

/**
 * Get a summary of sex restriction impact for display
 */
export function getSexRestrictionSummary(analysis: SexRestrictionAnalysis): string {
  if (!analysis.isFemale) {
    return 'Male - no adjustment';
  }

  if (analysis.isRestrictedRace) {
    return 'Restricted race (own sex)';
  }

  if (analysis.isMixedRace) {
    const flags = analysis.flags.length > 0 ? ` (${analysis.flags[0]})` : '';
    return `Facing males${flags}`;
  }

  return 'Race type unknown';
}

/**
 * Check if horse has any sex-based flags worth noting
 */
export function hasSexFlags(analysis: SexRestrictionAnalysis): boolean {
  return analysis.flags.length > 0 || analysis.isFirstTimeFacingMales;
}

/**
 * Check if a score adjustment was applied
 */
export function hasAdjustment(analysis: SexRestrictionAnalysis): boolean {
  return analysis.adjustment !== 0;
}
