/**
 * Comprehensive DRF Data Validation
 *
 * Validates parsed DRF data for:
 * - File-level validation (before parsing)
 * - Required field presence
 * - Value range checks
 * - Data consistency
 * - Cross-field validation
 *
 * Never throws unhandled exceptions - returns clear error messages.
 */

import type { ParsedDRFFile, ParsedRace, HorseEntry, PastPerformance, Workout } from '../types/drf';
// Error types available for use if needed
// import { FileFormatError, DRFParseError, ValidationError } from '../types/errors'
import { logger } from '../services/logging';

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationWarning {
  type: 'missing' | 'invalid' | 'incomplete' | 'approximated' | 'suspicious';
  field: string;
  message: string;
  horseIndex?: number;
  raceIndex?: number;
  severity: 'low' | 'medium' | 'high';
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  warnings: ValidationWarning[];
  errors: ValidationWarning[];
  stats: {
    totalRaces: number;
    totalHorses: number;
    totalPastPerformances: number;
    totalWorkouts: number;
    horsesWithMissingData: number;
    completeHorses: number;
    validationScore: number; // 0-100
  };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if odds format is valid
 */
function isValidOdds(odds: string): boolean {
  if (!odds) return false;

  // Handle fractional odds (e.g., "5-2", "3/1")
  const fractionalMatch = odds.match(/^(\d+)[-/](\d+)$/);
  if (fractionalMatch) {
    const numerator = parseInt(fractionalMatch[1], 10);
    const denominator = parseInt(fractionalMatch[2], 10);
    return numerator > 0 && denominator > 0;
  }

  // Handle decimal odds (e.g., "2.5", "10")
  const decimalValue = parseFloat(odds);
  return !isNaN(decimalValue) && decimalValue > 0;
}

/**
 * Convert odds string to decimal for comparison
 */
export function oddsToDecimal(odds: string): number {
  if (!odds) return 0;

  // Handle fractional odds
  const fractionalMatch = odds.match(/^(\d+)[-/](\d+)$/);
  if (fractionalMatch) {
    const numerator = parseInt(fractionalMatch[1], 10);
    const denominator = parseInt(fractionalMatch[2], 10);
    return numerator / denominator;
  }

  // Handle decimal odds
  const decimalValue = parseFloat(odds);
  return isNaN(decimalValue) ? 0 : decimalValue;
}

/**
 * Check if a string is non-empty
 */
function isNonEmpty(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if a number is within a valid range
 */
function isInRange(value: number | null | undefined, min: number, max: number): boolean {
  if (value === null || value === undefined) return false;
  return value >= min && value <= max;
}

// ============================================================================
// FILE-LEVEL VALIDATION
// ============================================================================

/**
 * Result of file validation
 */
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: {
    name: string;
    size: number;
    type: string;
    extension: string;
  };
}

/**
 * Validate a file before parsing (pre-parse validation)
 * Checks file type, extension, size, and basic content
 */
export function validateFileBeforeParsing(file: File): FileValidationResult {
  const result: FileValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type,
      extension: file.name.split('.').pop()?.toLowerCase() || '',
    },
  };

  // Check file extension
  const validExtensions = ['drf', 'csv', 'txt'];
  if (!validExtensions.includes(result.fileInfo.extension)) {
    result.warnings.push(
      `Unusual file extension: .${result.fileInfo.extension}. Expected .drf, .csv, or .txt`
    );
    // Don't fail - some DRF files may have different extensions
  }

  // Check file size limits
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const MIN_SIZE = 100; // 100 bytes - anything smaller is likely not valid

  if (file.size > MAX_SIZE) {
    result.isValid = false;
    result.errors.push(
      `File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.`
    );
  }

  if (file.size < MIN_SIZE) {
    result.isValid = false;
    result.errors.push(
      `File is too small (${file.size} bytes). The file may be empty or corrupted.`
    );
  }

  // Check MIME type - warn but don't fail (browsers may not always detect correctly)
  const validTypes = ['text/plain', 'text/csv', 'application/csv', 'application/octet-stream', ''];
  if (!validTypes.includes(file.type)) {
    result.warnings.push(
      `Unusual file type detected: ${file.type}. DRF files should be text/CSV format.`
    );
  }

  // Log validation result
  if (!result.isValid) {
    logger.logWarning('File validation failed', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      errors: result.errors,
    });
  }

  return result;
}

/**
 * Validate file content structure (post-read, pre-parse validation)
 * Returns validation result without throwing
 */
export function validateFileContent(content: string, filename: string): FileValidationResult {
  const result: FileValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    fileInfo: {
      name: filename,
      size: new Blob([content]).size,
      type: 'text/plain',
      extension: filename.split('.').pop()?.toLowerCase() || '',
    },
  };

  // Check for empty content
  if (!content || content.trim().length === 0) {
    result.isValid = false;
    result.errors.push('The file is empty or contains no readable data.');
    return result;
  }

  // Check for binary content (null bytes indicate binary)
  if (content.includes('\x00')) {
    result.isValid = false;
    result.errors.push('The file contains binary data and is not a valid text file.');
    return result;
  }

  // Split into lines for analysis
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    result.isValid = false;
    result.errors.push('The file contains no data lines.');
    return result;
  }

  // Analyze first line to detect format
  const firstLine = lines[0];
  const isCSVFormat = firstLine.includes(',');

  if (!isCSVFormat && firstLine.length < 50) {
    result.warnings.push('File format may not be standard DRF CSV format.');
  }

  // Count fields in first line to check for DRF format
  if (isCSVFormat) {
    const fieldCount = (firstLine.match(/,/g) || []).length + 1;
    if (fieldCount < 20) {
      result.warnings.push(
        `First line has only ${fieldCount} fields. Standard DRF files have 50+ fields.`
      );
    }
    if (fieldCount < 5) {
      result.isValid = false;
      result.errors.push('The file does not appear to be in DRF format (too few fields).');
    }
  }

  // Check for consistent field counts (sample first 10 lines)
  if (isCSVFormat && lines.length > 1) {
    const fieldCounts = lines.slice(0, 10).map((line) => (line.match(/,/g) || []).length + 1);
    const uniqueCounts = [...new Set(fieldCounts)];
    if (uniqueCounts.length > 2) {
      result.warnings.push('Lines have inconsistent field counts. Some data may be malformed.');
    }
  }

  // Check for potential encoding issues
  const hasReplacementChar = content.includes('\uFFFD');
  if (hasReplacementChar) {
    result.warnings.push(
      'File may have encoding issues. Some characters could not be read correctly.'
    );
  }

  // Log validation result
  if (!result.isValid) {
    logger.logWarning('File content validation failed', {
      fileName: filename,
      errors: result.errors,
      warnings: result.warnings,
      lineCount: lines.length,
    });
  } else if (result.warnings.length > 0) {
    logger.logInfo('File content validated with warnings', {
      fileName: filename,
      warnings: result.warnings,
      lineCount: lines.length,
    });
  }

  return result;
}

/**
 * Comprehensive file validation combining pre-read and post-read checks
 * Use this for complete validation before parsing
 */
export async function validateFile(file: File): Promise<FileValidationResult> {
  // First validate the file object
  const fileResult = validateFileBeforeParsing(file);
  if (!fileResult.isValid) {
    return fileResult;
  }

  // Read and validate content
  try {
    const content = await file.text();
    const contentResult = validateFileContent(content, file.name);

    // Merge results
    return {
      isValid: contentResult.isValid,
      errors: [...fileResult.errors, ...contentResult.errors],
      warnings: [...fileResult.warnings, ...contentResult.warnings],
      fileInfo: contentResult.fileInfo,
    };
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      fileName: file.name,
      component: 'FileValidation',
    });

    return {
      isValid: false,
      errors: ['Failed to read file content. The file may be corrupted or inaccessible.'],
      warnings: fileResult.warnings,
      fileInfo: fileResult.fileInfo,
    };
  }
}

/**
 * Create a user-friendly error message from validation result
 */
export function getValidationErrorMessage(result: FileValidationResult): string {
  if (result.isValid) {
    return '';
  }

  if (result.errors.length === 1) {
    return result.errors[0];
  }

  return `Multiple issues found:\n${result.errors.map((e) => `- ${e}`).join('\n')}`;
}

// ============================================================================
// HORSE VALIDATION
// ============================================================================

/**
 * Validate a single horse entry
 */
function validateHorse(
  horse: HorseEntry,
  horseIndex: number,
  raceIndex: number
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const horseName = horse.horseName || `Horse #${horse.programNumber}`;

  // ===== CRITICAL FIELDS =====

  // Horse name
  if (!isNonEmpty(horse.horseName) || horse.horseName.startsWith('Horse ')) {
    warnings.push({
      type: 'missing',
      field: 'horseName',
      message: `Race ${raceIndex + 1}, Entry #${horse.programNumber}: Missing horse name`,
      horseIndex,
      raceIndex,
      severity: 'high',
      suggestion: 'Horse name is required for accurate handicapping',
    });
  }

  // Trainer name
  if (!isNonEmpty(horse.trainerName) || horse.trainerName === 'Unknown') {
    warnings.push({
      type: 'missing',
      field: 'trainerName',
      message: `Race ${raceIndex + 1}, ${horseName}: Missing trainer name`,
      horseIndex,
      raceIndex,
      severity: 'medium',
      suggestion: 'Trainer statistics will not be available',
    });
  }

  // Jockey name
  if (!isNonEmpty(horse.jockeyName) || horse.jockeyName === 'Unknown') {
    warnings.push({
      type: 'missing',
      field: 'jockeyName',
      message: `Race ${raceIndex + 1}, ${horseName}: Missing jockey name`,
      horseIndex,
      raceIndex,
      severity: 'medium',
      suggestion: 'Jockey statistics will not be available',
    });
  }

  // ===== ODDS VALIDATION =====

  if (!isValidOdds(horse.morningLineOdds)) {
    warnings.push({
      type: 'invalid',
      field: 'morningLineOdds',
      message: `Race ${raceIndex + 1}, ${horseName}: Invalid or missing morning line odds`,
      horseIndex,
      raceIndex,
      severity: 'high',
      suggestion: 'Enter odds manually before analyzing',
    });
  } else {
    // Check for suspicious odds (too low or too high)
    const decimalOdds = horse.morningLineDecimal;
    if (decimalOdds < 0.1) {
      warnings.push({
        type: 'suspicious',
        field: 'morningLineOdds',
        message: `Race ${raceIndex + 1}, ${horseName}: Odds seem unusually low (${horse.morningLineOdds})`,
        horseIndex,
        raceIndex,
        severity: 'low',
      });
    } else if (decimalOdds > 99) {
      warnings.push({
        type: 'suspicious',
        field: 'morningLineOdds',
        message: `Race ${raceIndex + 1}, ${horseName}: Odds seem unusually high (${horse.morningLineOdds})`,
        horseIndex,
        raceIndex,
        severity: 'low',
      });
    }
  }

  // ===== POSITION VALIDATION =====

  if (!isInRange(horse.postPosition, 1, 24)) {
    warnings.push({
      type: 'invalid',
      field: 'postPosition',
      message: `Race ${raceIndex + 1}, ${horseName}: Invalid post position (${horse.postPosition})`,
      horseIndex,
      raceIndex,
      severity: 'medium',
      suggestion: 'Post position should be between 1 and 24',
    });
  }

  if (!isInRange(horse.programNumber, 1, 99)) {
    warnings.push({
      type: 'invalid',
      field: 'programNumber',
      message: `Race ${raceIndex + 1}, ${horseName}: Invalid program number (${horse.programNumber})`,
      horseIndex,
      raceIndex,
      severity: 'medium',
    });
  }

  // ===== WEIGHT VALIDATION =====

  if (!isInRange(horse.weight, 100, 140)) {
    if (horse.weight === 0 || horse.weight === 120) {
      // Default value, might be missing
      warnings.push({
        type: 'missing',
        field: 'weight',
        message: `Race ${raceIndex + 1}, ${horseName}: Weight may be missing or defaulted`,
        horseIndex,
        raceIndex,
        severity: 'low',
      });
    } else {
      warnings.push({
        type: 'invalid',
        field: 'weight',
        message: `Race ${raceIndex + 1}, ${horseName}: Unusual weight (${horse.weight} lbs)`,
        horseIndex,
        raceIndex,
        severity: 'low',
        suggestion: 'Weight typically ranges from 112-130 lbs',
      });
    }
  }

  // ===== AGE VALIDATION =====

  if (!isInRange(horse.age, 2, 15)) {
    warnings.push({
      type: 'invalid',
      field: 'age',
      message: `Race ${raceIndex + 1}, ${horseName}: Invalid age (${horse.age})`,
      horseIndex,
      raceIndex,
      severity: 'low',
      suggestion: 'Age should be between 2 and 15 years',
    });
  }

  // ===== SPEED FIGURE VALIDATION =====

  if (horse.lastBeyer !== null && !isInRange(horse.lastBeyer, 0, 130)) {
    warnings.push({
      type: 'invalid',
      field: 'lastBeyer',
      message: `Race ${raceIndex + 1}, ${horseName}: Unusual Beyer figure (${horse.lastBeyer})`,
      horseIndex,
      raceIndex,
      severity: 'low',
      suggestion: 'Beyer figures typically range from 0-120',
    });
  }

  // ===== BREEDING VALIDATION =====

  if (!isNonEmpty(horse.breeding?.sire) || horse.breeding?.sire === 'Unknown') {
    warnings.push({
      type: 'missing',
      field: 'breeding.sire',
      message: `Race ${raceIndex + 1}, ${horseName}: Missing sire information`,
      horseIndex,
      raceIndex,
      severity: 'low',
    });
  }

  if (!isNonEmpty(horse.breeding?.dam) || horse.breeding?.dam === 'Unknown') {
    warnings.push({
      type: 'missing',
      field: 'breeding.dam',
      message: `Race ${raceIndex + 1}, ${horseName}: Missing dam information`,
      horseIndex,
      raceIndex,
      severity: 'low',
    });
  }

  // ===== PAST PERFORMANCE VALIDATION =====

  if (horse.pastPerformances.length === 0) {
    warnings.push({
      type: 'missing',
      field: 'pastPerformances',
      message: `Race ${raceIndex + 1}, ${horseName}: No past performances available`,
      horseIndex,
      raceIndex,
      severity: 'medium',
      suggestion: 'May be a first-time starter or maiden',
    });
  } else {
    // Validate each past performance
    horse.pastPerformances.forEach((pp, ppIndex) => {
      const ppWarnings = validatePastPerformance(pp, ppIndex, horseIndex, raceIndex, horseName);
      warnings.push(...ppWarnings);
    });
  }

  // ===== WORKOUT VALIDATION =====

  if (horse.workouts.length === 0 && horse.pastPerformances.length === 0) {
    warnings.push({
      type: 'missing',
      field: 'workouts',
      message: `Race ${raceIndex + 1}, ${horseName}: No workouts or past performances available`,
      horseIndex,
      raceIndex,
      severity: 'high',
      suggestion: 'Limited data for analysis - may be debut starter',
    });
  } else if (horse.workouts.length > 0) {
    horse.workouts.forEach((workout, wkIndex) => {
      const wkWarnings = validateWorkout(workout, wkIndex, horseIndex, raceIndex, horseName);
      warnings.push(...wkWarnings);
    });
  }

  return warnings;
}

// ============================================================================
// PAST PERFORMANCE VALIDATION
// ============================================================================

/**
 * Validate a single past performance record
 */
function validatePastPerformance(
  pp: PastPerformance,
  ppIndex: number,
  horseIndex: number,
  raceIndex: number,
  horseName: string
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Date validation
  if (!isNonEmpty(pp.date)) {
    warnings.push({
      type: 'missing',
      field: `pastPerformances[${ppIndex}].date`,
      message: `Race ${raceIndex + 1}, ${horseName}: PP #${ppIndex + 1} missing date`,
      horseIndex,
      raceIndex,
      severity: 'low',
    });
  }

  // Finish position validation
  if (!isInRange(pp.finishPosition, 1, 20)) {
    warnings.push({
      type: 'invalid',
      field: `pastPerformances[${ppIndex}].finishPosition`,
      message: `Race ${raceIndex + 1}, ${horseName}: PP #${ppIndex + 1} invalid finish position`,
      horseIndex,
      raceIndex,
      severity: 'low',
    });
  }

  // Beyer validation if present
  if (pp.speedFigures.beyer !== null && !isInRange(pp.speedFigures.beyer, 0, 130)) {
    warnings.push({
      type: 'suspicious',
      field: `pastPerformances[${ppIndex}].speedFigures.beyer`,
      message: `Race ${raceIndex + 1}, ${horseName}: PP #${ppIndex + 1} unusual Beyer (${pp.speedFigures.beyer})`,
      horseIndex,
      raceIndex,
      severity: 'low',
    });
  }

  return warnings;
}

// ============================================================================
// WORKOUT VALIDATION
// ============================================================================

/**
 * Validate a single workout record
 */
function validateWorkout(
  workout: Workout,
  wkIndex: number,
  horseIndex: number,
  raceIndex: number,
  horseName: string
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Date validation
  if (!isNonEmpty(workout.date)) {
    warnings.push({
      type: 'missing',
      field: `workouts[${wkIndex}].date`,
      message: `Race ${raceIndex + 1}, ${horseName}: Workout #${wkIndex + 1} missing date`,
      horseIndex,
      raceIndex,
      severity: 'low',
    });
  }

  // Time validation
  if (workout.timeSeconds <= 0) {
    warnings.push({
      type: 'missing',
      field: `workouts[${wkIndex}].timeSeconds`,
      message: `Race ${raceIndex + 1}, ${horseName}: Workout #${wkIndex + 1} missing time`,
      horseIndex,
      raceIndex,
      severity: 'low',
    });
  }

  // Distance validation
  if (!isInRange(workout.distanceFurlongs, 2, 12)) {
    warnings.push({
      type: 'invalid',
      field: `workouts[${wkIndex}].distanceFurlongs`,
      message: `Race ${raceIndex + 1}, ${horseName}: Workout #${wkIndex + 1} unusual distance`,
      horseIndex,
      raceIndex,
      severity: 'low',
    });
  }

  return warnings;
}

// ============================================================================
// RACE VALIDATION
// ============================================================================

/**
 * Validate a single race
 */
function validateRace(race: ParsedRace, raceIndex: number): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const header = race.header;

  // ===== TRACK VALIDATION =====

  if (!isNonEmpty(header.trackCode) || header.trackCode === 'UNK') {
    warnings.push({
      type: 'missing',
      field: 'trackCode',
      message: `Race ${raceIndex + 1}: Missing track code`,
      raceIndex,
      severity: 'high',
    });
  }

  // ===== DISTANCE VALIDATION =====

  if (!isNonEmpty(header.distance) || header.distance === 'Unknown') {
    warnings.push({
      type: 'missing',
      field: 'distance',
      message: `Race ${raceIndex + 1}: Missing distance`,
      raceIndex,
      severity: 'high',
    });
  } else if (!isInRange(header.distanceFurlongs, 2, 16)) {
    warnings.push({
      type: 'invalid',
      field: 'distanceFurlongs',
      message: `Race ${raceIndex + 1}: Unusual distance (${header.distanceFurlongs}f)`,
      raceIndex,
      severity: 'medium',
      suggestion: 'Distance should be between 2 and 16 furlongs',
    });
  }

  // ===== FIELD SIZE VALIDATION =====

  if (race.horses.length < 2) {
    warnings.push({
      type: 'incomplete',
      field: 'horses',
      message: `Race ${raceIndex + 1}: Only ${race.horses.length} horse(s) - need at least 2 for a race`,
      raceIndex,
      severity: 'high',
      suggestion: 'Check if file is complete or if entries were scratched',
    });
  } else if (race.horses.length > 20) {
    warnings.push({
      type: 'suspicious',
      field: 'horses',
      message: `Race ${raceIndex + 1}: Large field size (${race.horses.length} horses)`,
      raceIndex,
      severity: 'low',
    });
  }

  // ===== PURSE VALIDATION =====

  if (header.purse <= 0) {
    warnings.push({
      type: 'missing',
      field: 'purse',
      message: `Race ${raceIndex + 1}: Missing purse amount`,
      raceIndex,
      severity: 'low',
    });
  }

  // ===== VALIDATE EACH HORSE =====

  race.horses.forEach((horse, horseIndex) => {
    const horseWarnings = validateHorse(horse, horseIndex, raceIndex);
    warnings.push(...horseWarnings);
  });

  // ===== CHECK FOR DUPLICATE POST POSITIONS =====

  const postPositions = race.horses.map((h) => h.postPosition);
  const duplicates = postPositions.filter((pos, idx) => postPositions.indexOf(pos) !== idx);
  if (duplicates.length > 0) {
    warnings.push({
      type: 'invalid',
      field: 'postPositions',
      message: `Race ${raceIndex + 1}: Duplicate post positions found: ${[...new Set(duplicates)].join(', ')}`,
      raceIndex,
      severity: 'medium',
      suggestion: 'May indicate coupled entries or data error',
    });
  }

  return warnings;
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate complete parsed DRF data
 */
export function validateParsedData(data: ParsedDRFFile | null): ValidationResult {
  // Handle null/missing data
  if (!data) {
    return {
      isValid: false,
      warnings: [],
      errors: [
        {
          type: 'missing',
          field: 'data',
          message: 'No data provided for validation',
          severity: 'high',
        },
      ],
      stats: {
        totalRaces: 0,
        totalHorses: 0,
        totalPastPerformances: 0,
        totalWorkouts: 0,
        horsesWithMissingData: 0,
        completeHorses: 0,
        validationScore: 0,
      },
    };
  }

  // Handle malformed data structure (not a valid ParsedDRFFile)
  if (typeof data !== 'object' || data === null) {
    return {
      isValid: false,
      warnings: [],
      errors: [
        {
          type: 'invalid',
          field: 'data',
          message: 'Invalid data structure - expected parsed DRF file object',
          severity: 'high',
          suggestion: 'The file format may not be recognized',
        },
      ],
      stats: {
        totalRaces: 0,
        totalHorses: 0,
        totalPastPerformances: 0,
        totalWorkouts: 0,
        horsesWithMissingData: 0,
        completeHorses: 0,
        validationScore: 0,
      },
    };
  }

  // Handle missing races property (malformed structure)
  if (!('races' in data)) {
    return {
      isValid: false,
      warnings: [],
      errors: [
        {
          type: 'invalid',
          field: 'races',
          message: 'Malformed DRF structure - missing races data',
          severity: 'high',
          suggestion: 'The file does not contain recognizable race data',
        },
      ],
      stats: {
        totalRaces: 0,
        totalHorses: 0,
        totalPastPerformances: 0,
        totalWorkouts: 0,
        horsesWithMissingData: 0,
        completeHorses: 0,
        validationScore: 0,
      },
    };
  }

  // Handle empty races array
  if (!data.races || !Array.isArray(data.races) || data.races.length === 0) {
    return {
      isValid: false,
      warnings: [],
      errors: [
        {
          type: 'missing',
          field: 'races',
          message: 'No races found in file',
          severity: 'high',
          suggestion: 'The file may not be a valid DRF file or may be corrupted',
        },
      ],
      stats: {
        totalRaces: 0,
        totalHorses: 0,
        totalPastPerformances: 0,
        totalWorkouts: 0,
        horsesWithMissingData: 0,
        completeHorses: 0,
        validationScore: 0,
      },
    };
  }

  // Collect all warnings
  const allWarnings: ValidationWarning[] = [];
  let totalHorses = 0;
  let totalPastPerformances = 0;
  let totalWorkouts = 0;
  let horsesWithMissingData = 0;
  let racesWithEnoughHorses = 0;

  // Validate each race
  data.races.forEach((race, raceIndex) => {
    const raceWarnings = validateRace(race, raceIndex);
    allWarnings.push(...raceWarnings);

    // Track races with enough horses for analysis
    if (race.horses && race.horses.length >= 2) {
      racesWithEnoughHorses++;
    }

    // Count horses and data
    race.horses.forEach((horse) => {
      totalHorses++;
      totalPastPerformances += horse.pastPerformances?.length || 0;
      totalWorkouts += horse.workouts?.length || 0;

      // Check for missing critical data
      const hasMissingData =
        !isNonEmpty(horse.horseName) ||
        horse.horseName.startsWith('Horse ') ||
        !isValidOdds(horse.morningLineOdds) ||
        horse.trainerName === 'Unknown' ||
        horse.jockeyName === 'Unknown';

      if (hasMissingData) {
        horsesWithMissingData++;
      }
    });
  });

  // Add error if no races have enough horses
  if (racesWithEnoughHorses === 0) {
    allWarnings.push({
      type: 'incomplete',
      field: 'races',
      message: `All ${data.races.length} race(s) have fewer than 2 horses - cannot analyze`,
      severity: 'high',
      suggestion: 'Each race needs at least 2 horses for handicapping analysis',
    });
  }

  // Add error if we have races but no horses at all
  if (totalHorses === 0) {
    allWarnings.push({
      type: 'missing',
      field: 'horses',
      message: 'No horse entries found in any race',
      severity: 'high',
      suggestion: 'The DRF file may be empty or improperly formatted',
    });
  }

  // Separate errors from warnings
  const errors = allWarnings.filter((w) => w.severity === 'high');
  const warnings = allWarnings.filter((w) => w.severity !== 'high');

  // Calculate validation score (0-100)
  const completeHorses = totalHorses - horsesWithMissingData;
  const dataCompleteness = totalHorses > 0 ? (completeHorses / totalHorses) * 100 : 0;
  const errorPenalty = Math.min(errors.length * 10, 50);
  const warningPenalty = Math.min(warnings.length * 2, 30);
  const validationScore = Math.max(0, Math.round(dataCompleteness - errorPenalty - warningPenalty));

  // Determine if data is valid (no critical errors)
  const criticalErrors = errors.filter(
    (e) =>
      e.field === 'races' || e.field === 'data' || (e.field === 'horses' && e.type === 'incomplete')
  );
  const isValid = criticalErrors.length === 0 && data.races.length > 0;

  return {
    isValid,
    warnings,
    errors,
    stats: {
      totalRaces: data.races.length,
      totalHorses,
      totalPastPerformances,
      totalWorkouts,
      horsesWithMissingData,
      completeHorses,
      validationScore,
    },
  };
}

// ============================================================================
// SUMMARY FUNCTIONS
// ============================================================================

/**
 * Get human-readable summary of validation warnings
 */
export function getValidationSummary(result: ValidationResult): string[] {
  const summary: string[] = [];

  // Data completeness
  if (result.stats.horsesWithMissingData > 0) {
    summary.push(
      `${result.stats.horsesWithMissingData} of ${result.stats.totalHorses} horses have incomplete data`
    );
  }

  // Group warnings by type
  const missingTrainers = result.warnings.filter((w) => w.field === 'trainerName').length;
  const missingJockeys = result.warnings.filter((w) => w.field === 'jockeyName').length;
  const invalidOdds = result.warnings.filter((w) => w.field === 'morningLineOdds').length;
  const missingPPs = result.warnings.filter((w) => w.field === 'pastPerformances').length;

  if (missingTrainers > 0) {
    summary.push(`${missingTrainers} horses missing trainer information`);
  }
  if (missingJockeys > 0) {
    summary.push(`${missingJockeys} horses missing jockey information`);
  }
  if (invalidOdds > 0) {
    summary.push(`${invalidOdds} horses with invalid odds`);
  }
  if (missingPPs > 0) {
    summary.push(`${missingPPs} horses with no past performances`);
  }

  // Critical errors
  result.errors.forEach((error) => {
    summary.push(`Error: ${error.message}`);
  });

  return summary;
}

/**
 * Check if data is usable despite warnings
 */
export function isDataUsable(result: ValidationResult): boolean {
  // Data is usable if we have at least one valid race with at least 2 complete horses
  return result.isValid || (result.stats.totalRaces > 0 && result.stats.completeHorses >= 2);
}

/**
 * Get suggestions for fixing common issues
 */
export function getFixSuggestions(result: ValidationResult): string[] {
  const suggestions: string[] = [];
  const seenSuggestions = new Set<string>();

  // Collect unique suggestions
  [...result.errors, ...result.warnings].forEach((item) => {
    if (item.suggestion && !seenSuggestions.has(item.suggestion)) {
      seenSuggestions.add(item.suggestion);
      suggestions.push(item.suggestion);
    }
  });

  return suggestions;
}

/**
 * Get validation score color
 */
export function getValidationScoreColor(score: number): string {
  if (score >= 80) return '#36d1da'; // Green/teal
  if (score >= 60) return '#19abb5'; // Accent
  if (score >= 40) return '#f59e0b'; // Warning yellow
  return '#ef4444'; // Error red
}

/**
 * Get validation score label
 */
export function getValidationScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical Issues';
}
