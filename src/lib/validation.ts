import type { ParsedDRFFile, ParsedRace, HorseEntry } from '../types/drf'

export interface ValidationWarning {
  type: 'missing' | 'invalid' | 'incomplete'
  field: string
  message: string
  horseIndex?: number
  raceIndex?: number
}

export interface ValidationResult {
  isValid: boolean
  warnings: ValidationWarning[]
  errors: ValidationWarning[]
  stats: {
    totalRaces: number
    totalHorses: number
    horsesWithMissingData: number
    completeHorses: number
  }
}

// Validate odds format and value
function isValidOdds(odds: string): boolean {
  if (!odds) return false

  // Handle fractional odds (e.g., "5-2", "3/1")
  const fractionalMatch = odds.match(/^(\d+)[-\/](\d+)$/)
  if (fractionalMatch) {
    const numerator = parseInt(fractionalMatch[1], 10)
    const denominator = parseInt(fractionalMatch[2], 10)
    return numerator > 0 && denominator > 0
  }

  // Handle decimal odds (e.g., "2.5", "10")
  const decimalValue = parseFloat(odds)
  return !isNaN(decimalValue) && decimalValue > 0
}

// Convert odds string to decimal for comparison
export function oddsToDecimal(odds: string): number {
  if (!odds) return 0

  // Handle fractional odds
  const fractionalMatch = odds.match(/^(\d+)[-\/](\d+)$/)
  if (fractionalMatch) {
    const numerator = parseInt(fractionalMatch[1], 10)
    const denominator = parseInt(fractionalMatch[2], 10)
    return numerator / denominator
  }

  // Handle decimal odds
  const decimalValue = parseFloat(odds)
  return isNaN(decimalValue) ? 0 : decimalValue
}

// Validate a single horse entry
function validateHorse(horse: HorseEntry, horseIndex: number, raceIndex: number): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // Check horse name
  if (!horse.horseName || horse.horseName.trim() === '') {
    warnings.push({
      type: 'missing',
      field: 'horseName',
      message: `Race ${raceIndex + 1}, Horse #${horse.programNumber}: Missing horse name`,
      horseIndex,
      raceIndex,
    })
  }

  // Check trainer name
  if (!horse.trainerName || horse.trainerName.trim() === '') {
    warnings.push({
      type: 'missing',
      field: 'trainerName',
      message: `Race ${raceIndex + 1}, ${horse.horseName || 'Unknown'}: Missing trainer name`,
      horseIndex,
      raceIndex,
    })
  }

  // Check jockey name
  if (!horse.jockeyName || horse.jockeyName.trim() === '') {
    warnings.push({
      type: 'missing',
      field: 'jockeyName',
      message: `Race ${raceIndex + 1}, ${horse.horseName || 'Unknown'}: Missing jockey name`,
      horseIndex,
      raceIndex,
    })
  }

  // Check odds
  if (!horse.morningLineOdds || !isValidOdds(horse.morningLineOdds)) {
    warnings.push({
      type: 'invalid',
      field: 'morningLineOdds',
      message: `Race ${raceIndex + 1}, ${horse.horseName || 'Unknown'}: Invalid or missing odds`,
      horseIndex,
      raceIndex,
    })
  }

  // Check post position
  if (horse.postPosition < 1 || horse.postPosition > 20) {
    warnings.push({
      type: 'invalid',
      field: 'postPosition',
      message: `Race ${raceIndex + 1}, ${horse.horseName || 'Unknown'}: Invalid post position (${horse.postPosition})`,
      horseIndex,
      raceIndex,
    })
  }

  // Check program number
  if (horse.programNumber < 1) {
    warnings.push({
      type: 'invalid',
      field: 'programNumber',
      message: `Race ${raceIndex + 1}, ${horse.horseName || 'Unknown'}: Invalid program number`,
      horseIndex,
      raceIndex,
    })
  }

  return warnings
}

// Validate a single race
function validateRace(race: ParsedRace, raceIndex: number): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // Check race header
  if (!race.header.trackCode) {
    warnings.push({
      type: 'missing',
      field: 'trackCode',
      message: `Race ${raceIndex + 1}: Missing track code`,
      raceIndex,
    })
  }

  if (!race.header.distance) {
    warnings.push({
      type: 'missing',
      field: 'distance',
      message: `Race ${raceIndex + 1}: Missing distance`,
      raceIndex,
    })
  }

  // Check for minimum horses
  if (race.horses.length < 2) {
    warnings.push({
      type: 'incomplete',
      field: 'horses',
      message: `Race ${raceIndex + 1}: Only ${race.horses.length} horse(s) - need at least 2`,
      raceIndex,
    })
  }

  // Validate each horse
  race.horses.forEach((horse, horseIndex) => {
    const horseWarnings = validateHorse(horse, horseIndex, raceIndex)
    warnings.push(...horseWarnings)
  })

  return warnings
}

// Main validation function
export function validateParsedData(data: ParsedDRFFile | null): ValidationResult {
  if (!data) {
    return {
      isValid: false,
      warnings: [],
      errors: [{
        type: 'missing',
        field: 'data',
        message: 'No data provided',
      }],
      stats: {
        totalRaces: 0,
        totalHorses: 0,
        horsesWithMissingData: 0,
        completeHorses: 0,
      },
    }
  }

  const warnings: ValidationWarning[] = []
  const errors: ValidationWarning[] = []

  // Check for races
  if (!data.races || data.races.length === 0) {
    errors.push({
      type: 'missing',
      field: 'races',
      message: 'No races found in file',
    })
    return {
      isValid: false,
      warnings: [],
      errors,
      stats: {
        totalRaces: 0,
        totalHorses: 0,
        horsesWithMissingData: 0,
        completeHorses: 0,
      },
    }
  }

  // Validate each race
  let totalHorses = 0
  let horsesWithMissingData = 0

  data.races.forEach((race, raceIndex) => {
    const raceWarnings = validateRace(race, raceIndex)
    warnings.push(...raceWarnings)
    totalHorses += race.horses.length

    // Count horses with missing data
    race.horses.forEach((horse, horseIndex) => {
      const horseWarnings = validateHorse(horse, horseIndex, raceIndex)
      if (horseWarnings.length > 0) {
        horsesWithMissingData++
      }
    })
  })

  // Separate critical errors from warnings
  const criticalErrors = warnings.filter(w =>
    w.field === 'horses' && w.type === 'incomplete' &&
    (data.races[w.raceIndex!]?.horses.length ?? 0) < 1
  )

  errors.push(...criticalErrors)
  const nonCriticalWarnings = warnings.filter(w => !criticalErrors.includes(w))

  return {
    isValid: errors.length === 0,
    warnings: nonCriticalWarnings,
    errors,
    stats: {
      totalRaces: data.races.length,
      totalHorses,
      horsesWithMissingData,
      completeHorses: totalHorses - horsesWithMissingData,
    },
  }
}

// Get summary of validation warnings
export function getValidationSummary(result: ValidationResult): string[] {
  const summary: string[] = []

  if (result.stats.horsesWithMissingData > 0) {
    summary.push(
      `${result.stats.horsesWithMissingData} of ${result.stats.totalHorses} horses have incomplete data`
    )
  }

  // Group warnings by type
  const missingTrainers = result.warnings.filter(w => w.field === 'trainerName').length
  const missingJockeys = result.warnings.filter(w => w.field === 'jockeyName').length
  const invalidOdds = result.warnings.filter(w => w.field === 'morningLineOdds').length

  if (missingTrainers > 0) {
    summary.push(`${missingTrainers} horses missing trainer information`)
  }
  if (missingJockeys > 0) {
    summary.push(`${missingJockeys} horses missing jockey information`)
  }
  if (invalidOdds > 0) {
    summary.push(`${invalidOdds} horses with invalid odds`)
  }

  return summary
}

// Check if data is usable despite warnings
export function isDataUsable(result: ValidationResult): boolean {
  // Data is usable if we have at least one valid race with at least 2 horses
  return result.isValid || (
    result.stats.totalRaces > 0 &&
    result.stats.completeHorses >= 2
  )
}
