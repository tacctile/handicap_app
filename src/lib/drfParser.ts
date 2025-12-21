/**
 * Comprehensive DRF (Daily Racing Form) Parser
 *
 * Parses DRF files in both CSV and fixed-width formats, extracting:
 * - Complete race header data
 * - Full horse entry information
 * - Past performance history (last 10 races)
 * - Workout data (last 5 workouts)
 * - Breeding/pedigree information
 * - Equipment and medication details
 *
 * Based on official DRF column specifications.
 *
 * Includes defensive parsing to handle:
 * - Non-text/binary files
 * - Truncated files
 * - Encoding issues
 * - Malformed CSV
 * - Missing/inconsistent field counts
 */

import { DRFParseError, FileFormatError } from '../types/errors';
import { logger } from '../services/logging';

import type {
  HorseEntry,
  ParsedRace,
  ParsedDRFFile,
  RaceHeader,
  Surface,
  TrackCondition,
  RaceClassification,
  PastPerformance,
  Workout,
  Breeding,
  Equipment,
  Medication,
  RunningLine,
  SpeedFigures,
  ParsingStep,
  DRFWorkerProgressMessage,
} from '../types/drf';

// ============================================================================
// DRF COLUMN SPECIFICATIONS
// ============================================================================

/**
 * DRF fixed-width format column definitions
 * Based on official DRF Single File format specification (DRF_FIELD_MAP.md)
 *
 * IMPORTANT: All indices are 0-based (Field 1 = index 0, Field 45 = index 44, etc.)
 *
 * Note: DRF files can have 1,435 fields per horse
 * These are the most critical fields for handicapping
 *
 * Field Groups per DRF_FIELD_MAP.md:
 * - Fields 1-27: Race Header Information
 * - Fields 28-57: Horse Identity & Connections
 * - Fields 62-101: Lifetime Performance Records
 * - Fields 102-113: Past Performance Dates
 * - Fields 114-185: PP Track & Distance Data
 * - Fields 210-225: Running Style & Race Descriptions
 * - Fields 256-325: Workout Data
 * - Fields 766-865: Speed & Pace Figures
 */
const DRF_COLUMNS = {
  // =========================================================================
  // RACE HEADER INFORMATION (Fields 1-27, indices 0-26)
  // =========================================================================
  TRACK_CODE: { index: 0, name: 'Track Code' }, // Field 1
  RACE_DATE: { index: 1, name: 'Race Date' }, // Field 2 (YYYYMMDD)
  RACE_NUMBER: { index: 2, name: 'Race Number' }, // Field 3
  POST_POSITION: { index: 3, name: 'Post Position' }, // Field 4
  RESERVED_5: { index: 4, name: 'Reserved' }, // Field 5
  POST_TIME: { index: 5, name: 'Post Time' }, // Field 6 (military)
  SURFACE: { index: 6, name: 'Surface Code' }, // Field 7 (D/T/S)
  RESERVED_8: { index: 7, name: 'Reserved' }, // Field 8
  DISTANCE_CODE: { index: 8, name: 'Distance Code' }, // Field 9 (S/R for Sprint/Route)
  RACE_TYPE: { index: 9, name: 'Race Type Code' }, // Field 10
  RACE_CONDITIONS: { index: 10, name: 'Race Name/Conditions' }, // Field 11
  PURSE: { index: 11, name: 'Purse Amount' }, // Field 12
  RESERVED_13_14: { index: 12, name: 'Reserved' }, // Fields 13-14
  DISTANCE_FURLONGS: { index: 14, name: 'Distance (furlongs)' }, // Field 15
  RACE_DESCRIPTION: { index: 15, name: 'Race Description' }, // Field 16
  TOP_PICKS: { index: 16, name: 'Top Picks/Favorites' }, // Field 17
  TRACK_CODE_2: { index: 20, name: 'Track Code (repeat)' }, // Field 21
  RACE_NUMBER_2: { index: 21, name: 'Race Number (repeat)' }, // Field 22
  BREED_CODE: { index: 22, name: 'Breed Code' }, // Field 23 (TB/QH/AR)
  FIELD_SIZE: { index: 23, name: 'Field Size' }, // Field 24

  // =========================================================================
  // HORSE IDENTITY & CONNECTIONS (Fields 28-57, indices 27-56)
  // =========================================================================
  // Trainer Information (Fields 28-32)
  TRAINER_NAME: { index: 27, name: 'Trainer Name' }, // Field 28
  TRAINER_STARTS: { index: 28, name: 'Trainer Starts (current meet)' }, // Field 29
  TRAINER_WINS: { index: 29, name: 'Trainer Wins (current meet)' }, // Field 30
  TRAINER_PLACES: { index: 30, name: 'Trainer Places (current meet)' }, // Field 31
  TRAINER_SHOWS: { index: 31, name: 'Trainer Shows (current meet)' }, // Field 32

  // Jockey Information (Fields 33-38)
  JOCKEY_NAME: { index: 32, name: 'Jockey Name' }, // Field 33
  JOCKEY_RESERVED: { index: 33, name: 'Reserved' }, // Field 34
  JOCKEY_STARTS: { index: 34, name: 'Jockey Starts (current meet)' }, // Field 35
  JOCKEY_WINS: { index: 35, name: 'Jockey Wins (current meet)' }, // Field 36
  JOCKEY_PLACES: { index: 36, name: 'Jockey Places (current meet)' }, // Field 37
  JOCKEY_SHOWS: { index: 37, name: 'Jockey Shows (current meet)' }, // Field 38

  // Ownership & Silks (Fields 39-42)
  OWNER_NAME: { index: 38, name: 'Owner Name' }, // Field 39
  SILKS_DESCRIPTION: { index: 39, name: 'Silks Description' }, // Field 40
  RESERVED_41_42: { index: 40, name: 'Reserved' }, // Fields 41-42

  // Horse Identification (Fields 43-51)
  PROGRAM_NUMBER: { index: 42, name: 'Program Number' }, // Field 43
  MORNING_LINE: { index: 43, name: 'Morning Line Odds' }, // Field 44
  HORSE_NAME: { index: 44, name: 'Horse Name' }, // Field 45
  HORSE_AGE_YEARS: { index: 45, name: 'Age (years)' }, // Field 46
  HORSE_AGE_MONTHS: { index: 46, name: 'Age (months)' }, // Field 47
  RESERVED_48: { index: 47, name: 'Reserved' }, // Field 48
  HORSE_SEX: { index: 48, name: 'Sex Code' }, // Field 49
  HORSE_COLOR: { index: 49, name: 'Color' }, // Field 50
  WEIGHT: { index: 50, name: 'Weight (assigned)' }, // Field 51

  // Breeding Information (Fields 52-57)
  SIRE: { index: 51, name: 'Sire Name' }, // Field 52
  SIRES_SIRE: { index: 52, name: "Sire's Sire" }, // Field 53
  DAM: { index: 53, name: 'Dam Name' }, // Field 54
  DAM_SIRE: { index: 54, name: "Dam's Sire" }, // Field 55
  BREEDER: { index: 55, name: 'Breeder Name' }, // Field 56
  WHERE_BRED: { index: 56, name: 'State/Country Bred' }, // Field 57

  // =========================================================================
  // LIFETIME PERFORMANCE RECORDS (Fields 62-101, indices 61-100)
  // =========================================================================
  // Overall Lifetime Record (Fields 62-69)
  LIFETIME_STARTS: { index: 61, name: 'Lifetime Starts' }, // Field 62
  LIFETIME_WINS: { index: 62, name: 'Lifetime Wins' }, // Field 63
  LIFETIME_PLACES: { index: 63, name: 'Lifetime Places' }, // Field 64
  LIFETIME_SHOWS: { index: 64, name: 'Lifetime Shows' }, // Field 65
  RESERVED_66_68: { index: 65, name: 'Reserved' }, // Fields 66-68
  LIFETIME_EARNINGS: { index: 68, name: 'Lifetime Earnings' }, // Field 69

  // Current Year Record (Fields 70-74)
  CURRENT_YEAR_STARTS: { index: 69, name: 'Current Year Starts' }, // Field 70
  CURRENT_YEAR_WINS: { index: 70, name: 'Current Year Wins' }, // Field 71
  CURRENT_YEAR_PLACES: { index: 71, name: 'Current Year Places' }, // Field 72
  CURRENT_YEAR_SHOWS: { index: 72, name: 'Current Year Shows' }, // Field 73
  CURRENT_YEAR_EARNINGS: { index: 73, name: 'Current Year Earnings' }, // Field 74 - FIXED from 43!

  // Previous Year Record (Fields 75-79)
  PREVIOUS_YEAR_STARTS: { index: 74, name: 'Previous Year Starts' }, // Field 75
  PREVIOUS_YEAR_WINS: { index: 75, name: 'Previous Year Wins' }, // Field 76
  PREVIOUS_YEAR_PLACES: { index: 76, name: 'Previous Year Places' }, // Field 77
  PREVIOUS_YEAR_SHOWS: { index: 77, name: 'Previous Year Shows' }, // Field 78
  PREVIOUS_YEAR_EARNINGS: { index: 78, name: 'Previous Year Earnings' }, // Field 79

  // Track-Specific Record (Fields 80-84)
  TRACK_STARTS: { index: 79, name: 'Track Starts' }, // Field 80
  TRACK_WINS: { index: 80, name: 'Track Wins' }, // Field 81
  TRACK_PLACES: { index: 81, name: 'Track Places' }, // Field 82
  TRACK_SHOWS: { index: 82, name: 'Track Shows' }, // Field 83
  TRACK_EARNINGS: { index: 83, name: 'Track Earnings' }, // Field 84

  // =========================================================================
  // PAST PERFORMANCE DATES (Fields 102-113, indices 101-112)
  // =========================================================================
  PP_DATE_START: 101, // Field 102 - First PP date (most recent race)

  // =========================================================================
  // PAST PERFORMANCE TRACK CODES (Fields 126-137, indices 125-136)
  // =========================================================================
  PP_TRACK_START: 125, // Field 126 - First PP track code

  // =========================================================================
  // TRACK CONDITIONS PER PP (Fields 150-161, indices 149-160)
  // =========================================================================
  PP_CONDITION_START: 149, // Field 150 - First PP track condition

  // =========================================================================
  // EQUIPMENT PER PP (Fields 162-173, indices 161-172)
  // =========================================================================
  PP_EQUIPMENT_START: 161, // Field 162 - First PP equipment

  // =========================================================================
  // RUNNING STYLE & RACE DESCRIPTIONS (Fields 210-225, indices 209-224)
  // =========================================================================
  RUNNING_STYLE: { index: 209, name: 'Running Style Code' }, // Field 210 (E/E-P/P/S/C)
  SPEED_POINTS: { index: 210, name: 'Speed Points' }, // Field 211 (Quirin-style)
  BEST_SPEED_FIGURE: { index: 223, name: 'Best Speed Figure' }, // Field 224

  // =========================================================================
  // WORKOUT DATA (Fields 256-325, indices 255-324)
  // =========================================================================
  // Workout structure per DRF_FIELD_MAP.md:
  // - Fields 256-265: Workout Dates (10 works)
  // - Fields 266-275: Days Since Each Work
  // - Fields 276-295: Workout Track Codes
  // - Fields 296-305: Workout Post Position
  // - Fields 306-315: Workout Track Condition
  // - Fields 316-325: Workout Distance
  WORKOUT_START: 255, // Field 256 - First workout date
  WORKOUT_FIELDS_PER_WORK: 7, // 7 fields per workout (date, days, track, post, condition, distance, time)
  WORKOUT_COUNT: 10, // Up to 10 workouts

  // =========================================================================
  // SPEED & PACE FIGURES (Fields 766-865, indices 765-864)
  // =========================================================================
  // Speed Figures Per PP (Fields 766-775)
  PP_BEYER_START: 765, // Field 766 - First PP Beyer speed figure

  // Variant Speed Figures (Fields 776-785)
  PP_VARIANT_START: 775, // Field 776 - First PP variant figure

  // Early Pace Figures (Fields 816-825)
  PP_EARLY_PACE_START: 815, // Field 816 - First PP early pace (EP1)

  // Late Pace Figures (Fields 846-855)
  PP_LATE_PACE_START: 845, // Field 846 - First PP late pace

  // Average Pace Figures (Fields 856-865)
  PP_AVERAGE_PACE_START: 855, // Field 856 - First PP average pace

  // =========================================================================
  // PAST PERFORMANCES (structured data starting at Field 102)
  // Each PP has data spread across multiple field ranges
  // =========================================================================
  PP_START: 101, // Field 102 - PP dates start here
  PP_FIELDS_PER_RACE: 12, // 12 races maximum
  PP_MAX_RACES: 12, // Maximum past performances

  // =========================================================================
  // TRAINER/JOCKEY PER PP (Fields 1056-1095, indices 1055-1094)
  // =========================================================================
  PP_TRAINER_START: 1055, // Field 1056 - Trainer names per PP
  PP_JOCKEY_START: 1065, // Field 1066 - Jockey names per PP

  // =========================================================================
  // TRAINER STATISTICS (Fields 1146-1221, indices 1145-1220)
  // =========================================================================
  TRAINER_STATS_START: 1145, // Field 1146 - Trainer category statistics

  // =========================================================================
  // DETAILED TRIP NOTES (Fields 1383-1392, indices 1382-1391)
  // =========================================================================
  PP_TRIP_NOTES_START: 1382, // Field 1383 - Detailed trip notes

  // =========================================================================
  // LEGACY MAPPINGS (kept for backwards compatibility)
  // These use the corrected indices from above
  // =========================================================================
  HORSE_AGE: { index: 45, name: 'Horse Age' }, // Alias for HORSE_AGE_YEARS
  ENTRY_INDICATOR: { index: 4, name: 'Entry Indicator' }, // Field 5 (reserved)
  JOCKEY_LAST: { index: 32, name: 'Jockey Name' }, // Maps to JOCKEY_NAME
  JOCKEY_FIRST: { index: 32, name: 'Jockey Name' }, // Same - full name in one field
  TRAINER_LAST: { index: 27, name: 'Trainer Name' }, // Maps to TRAINER_NAME
  TRAINER_FIRST: { index: 27, name: 'Trainer Name' }, // Same - full name in one field
  DISTANCE: { index: 14, name: 'Distance (furlongs)' }, // Maps to DISTANCE_FURLONGS
  AGE_RESTRICTION: { index: 10, name: 'Age Restriction' }, // From race conditions
  SEX_RESTRICTION: { index: 10, name: 'Sex Restriction' }, // From race conditions
  CLAIMING_PRICE: { index: 11, name: 'Claiming Price' }, // Parsed from conditions or purse
  TRACK_CONDITION: { index: 6, name: 'Track Condition' }, // From surface field
  APPRENTICE_ALLOWANCE: { index: 50, name: 'Apprentice Allowance' }, // Part of weight
  EQUIPMENT: { index: 161, name: 'Equipment' }, // PP equipment field
  MEDICATION: { index: 173, name: 'Medication' }, // PP medication field
  RACE_NAME: { index: 10, name: 'Race Name' }, // From conditions
  RACE_GRADE: { index: 10, name: 'Race Grade' }, // Parsed from conditions
  DAYS_SINCE_LAST: { index: 101, name: 'Days Since Last Race' }, // Calculated from PP date

  // Speed figure fields - using best speed figure from field 224
  BEST_BEYER: { index: 223, name: 'Best Beyer' }, // Field 224
  AVERAGE_BEYER: { index: 223, name: 'Average Beyer' }, // Calculated from PP figures
  LAST_BEYER: { index: 765, name: 'Last Beyer' }, // Field 766 (first PP Beyer)
} as const;

// ============================================================================
// FILE VALIDATION & DEFENSIVE PARSING
// ============================================================================

/** Minimum fields expected for a valid DRF CSV line */
const MIN_EXPECTED_FIELDS = 50;

/** Maximum file size we'll attempt to parse (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Common binary file signatures to detect non-text files */
const BINARY_SIGNATURES = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x50, 0x4b, 0x03, 0x04], // ZIP/XLSX/DOCX
  [0x25, 0x50, 0x44, 0x46], // PDF
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0x4d, 0x5a], // Windows executable
];

/**
 * Check if content appears to be binary (non-text)
 */
function isBinaryContent(content: string): boolean {
  // Check for null bytes which indicate binary content
  if (content.includes('\x00')) {
    return true;
  }

  // Check first few bytes against known binary signatures
  const bytes = content
    .slice(0, 8)
    .split('')
    .map((c) => c.charCodeAt(0));
  for (const sig of BINARY_SIGNATURES) {
    if (
      sig.every((byte, i) => {
        const b = bytes[i];
        return b !== undefined && b === byte;
      })
    ) {
      return true;
    }
  }

  // Check for high ratio of non-printable characters (excluding common whitespace)
  const sample = content.slice(0, 1000);
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    // Allow printable ASCII, tabs, newlines, carriage returns
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintable++;
    }
    // Disallow most control characters except for extended ASCII
    if (code > 126 && code < 160) {
      nonPrintable++;
    }
  }

  // If more than 5% non-printable, likely binary
  return sample.length > 0 && nonPrintable / sample.length > 0.05;
}

/**
 * Check if content has UTF-8 encoding issues
 */
function hasEncodingIssues(content: string): boolean {
  // Check for replacement character which indicates encoding problems
  if (content.includes('\uFFFD')) {
    return true;
  }

  // Check for common mojibake patterns (UTF-8 decoded as Latin-1, etc.)
  const mojibakePatterns = [
    /Ã©/g, // é as UTF-8 in Latin-1
    /Ã¨/g, // è
    /Ã /g, // à
    /â€/g, // various smart quotes
  ];

  const sample = content.slice(0, 2000);
  let matches = 0;
  for (const pattern of mojibakePatterns) {
    const found = sample.match(pattern);
    if (found) matches += found.length;
  }

  // A few matches might be coincidental, many indicates encoding issues
  return matches > 5;
}

/**
 * Validate file content before parsing
 * Returns null if valid, or throws appropriate error
 */
function validateFileContent(content: string, filename: string): void {
  // Check for empty content
  if (!content || content.trim().length === 0) {
    throw new DRFParseError('EMPTY_FILE', 'The file is empty or contains no readable data', {
      context: { filename },
    });
  }

  // Check file size
  const size = new Blob([content]).size;
  if (size > MAX_FILE_SIZE) {
    throw new FileFormatError(
      'FILE_TOO_LARGE',
      `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      {
        filename,
        fileSize: size,
      }
    );
  }

  // Check for binary content
  if (isBinaryContent(content)) {
    throw new FileFormatError(
      'BINARY_CONTENT',
      'The file appears to be binary, not a text-based DRF file',
      {
        filename,
        detectedType: 'binary',
      }
    );
  }

  // Check for encoding issues
  if (hasEncodingIssues(content)) {
    logger.logWarning('Potential encoding issues detected in file', { fileName: filename });
    // Don't throw - try to parse anyway with a warning
  }
}

/**
 * Validate that a line looks like valid CSV/DRF data
 */
function validateLine(
  line: string,
  lineNumber: number,
  _filename: string
): {
  isValid: boolean;
  fieldCount: number;
  warning?: string;
} {
  // Empty lines are skipped, not invalid
  if (!line.trim()) {
    return { isValid: false, fieldCount: 0 };
  }

  // Count fields (rough estimate - doesn't handle quoted commas perfectly)
  const roughFieldCount = (line.match(/,/g) || []).length + 1;

  // Check for extremely short lines (truncated)
  if (roughFieldCount < 5 && line.length > 0) {
    return {
      isValid: false,
      fieldCount: roughFieldCount,
      warning: `Line ${lineNumber}: Too few fields (${roughFieldCount}), may be truncated`,
    };
  }

  // Check for lines that are way shorter than expected for DRF
  if (roughFieldCount < MIN_EXPECTED_FIELDS && roughFieldCount > 5) {
    return {
      isValid: true,
      fieldCount: roughFieldCount,
      warning: `Line ${lineNumber}: Fewer fields than typical DRF format (${roughFieldCount} < ${MIN_EXPECTED_FIELDS})`,
    };
  }

  return { isValid: true, fieldCount: roughFieldCount };
}

/**
 * Safely parse a CSV line with error handling
 */
function safeParseCSVLine(
  line: string,
  lineNumber: number,
  filename: string
): { fields: string[]; warning?: string } | null {
  try {
    const fields = parseCSVLine(line);

    // Validate we got reasonable results
    if (fields.length === 0) {
      return null;
    }

    // Check for obviously malformed data
    if (fields.length === 1 && line.includes(',')) {
      // CSV parsing may have failed - all data in one field despite commas
      return {
        fields,
        warning: `Line ${lineNumber}: Possible CSV parsing issue - check for unbalanced quotes`,
      };
    }

    return { fields };
  } catch (error) {
    logger.logWarning(`Failed to parse CSV line ${lineNumber}`, {
      fileName: filename,
      lineNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// PARSING UTILITIES
// ============================================================================

/**
 * Parse a CSV line handling quoted fields correctly
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === undefined) continue;

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());

  return fields;
}

/**
 * Safely get a field value with fallback
 */
function getField(fields: string[], index: number, defaultValue = ''): string {
  if (index < 0 || index >= fields.length) return defaultValue;
  return fields[index]?.trim() || defaultValue;
}

/**
 * Parse an integer with fallback
 */
function parseIntSafe(value: string, defaultValue = 0): number {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse a float with fallback
 */
function parseFloatSafe(value: string, defaultValue = 0): number {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse a nullable integer
 */
function parseIntNullable(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse a nullable float
 */
function parseFloatNullable(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

// ============================================================================
// SURFACE & CONDITION PARSING
// ============================================================================

/**
 * Parse surface code to Surface type
 */
function parseSurface(code: string): Surface {
  const normalized = code.trim().toUpperCase();
  switch (normalized) {
    case 'T':
    case 'TURF':
    case 'TF':
      return 'turf';
    case 'S':
    case 'SYN':
    case 'SYNTHETIC':
    case 'A':
    case 'AW':
    case 'ALL-WEATHER':
      return 'synthetic';
    case 'AWT':
      return 'all-weather';
    case 'D':
    case 'DIRT':
    default:
      return 'dirt';
  }
}

/**
 * Parse track condition code
 */
function parseTrackCondition(code: string): TrackCondition {
  const normalized = code.trim().toUpperCase();
  switch (normalized) {
    case 'FT':
    case 'FAST':
      return 'fast';
    case 'GD':
    case 'GOOD':
      return 'good';
    case 'MY':
    case 'MUD':
    case 'MUDDY':
      return 'muddy';
    case 'SY':
    case 'SLP':
    case 'SLOPPY':
      return 'sloppy';
    case 'HY':
    case 'HEAVY':
      return 'heavy';
    case 'FM':
    case 'FIRM':
      return 'firm';
    case 'YL':
    case 'YIELDING':
      return 'yielding';
    case 'SF':
    case 'SOFT':
      return 'soft';
    default:
      return 'fast';
  }
}

/**
 * Parse race classification from race type code
 */
function parseRaceClassification(typeCode: string, conditions: string): RaceClassification {
  const code = typeCode.trim().toUpperCase();
  const condLower = conditions.toLowerCase();

  // Check for graded stakes
  if (code === 'G1' || condLower.includes('grade 1') || condLower.includes('(g1)')) {
    return 'stakes-graded-1';
  }
  if (code === 'G2' || condLower.includes('grade 2') || condLower.includes('(g2)')) {
    return 'stakes-graded-2';
  }
  if (code === 'G3' || condLower.includes('grade 3') || condLower.includes('(g3)')) {
    return 'stakes-graded-3';
  }

  // Check for stakes
  if (code === 'STK' || code === 'S' || condLower.includes('stakes')) {
    if (condLower.includes('listed')) return 'stakes-listed';
    return 'stakes';
  }

  // Check for handicap
  if (code === 'HCP' || code === 'H' || condLower.includes('handicap')) {
    return 'handicap';
  }

  // Check for allowance variants
  if (code === 'AOC' || condLower.includes('allowance optional claiming')) {
    return 'allowance-optional-claiming';
  }
  if (code === 'ALW' || code === 'A' || condLower.includes('allowance')) {
    return 'allowance';
  }

  // Check for starter allowance
  if (code === 'STA' || condLower.includes('starter allowance')) {
    return 'starter-allowance';
  }

  // Check for maiden variants
  if (code === 'MCL' || condLower.includes('maiden claiming')) {
    return 'maiden-claiming';
  }
  if (code === 'MSW' || code === 'M' || condLower.includes('maiden special weight')) {
    return 'maiden';
  }
  if (condLower.includes('maiden')) {
    return 'maiden';
  }

  // Check for claiming
  if (code === 'CLM' || code === 'C' || condLower.includes('claiming')) {
    return 'claiming';
  }

  return 'unknown';
}

// ============================================================================
// DISTANCE PARSING
// ============================================================================

/**
 * Parse distance to formatted string and furlongs
 */
function parseDistance(
  rawYards: string,
  rawFurlongs: string
): { distance: string; furlongs: number; exact: string } {
  // Try furlongs first
  let furlongs = parseFloatSafe(rawFurlongs);

  // If furlongs not available, convert from yards
  if (!furlongs && rawYards) {
    const yards = parseFloatSafe(rawYards);
    if (yards > 0) {
      furlongs = yards / 220; // 220 yards per furlong
    }
  }

  if (!furlongs) {
    return { distance: 'Unknown', furlongs: 0, exact: 'Unknown' };
  }

  // Format distance string
  let distance: string;
  let exact: string;

  if (furlongs >= 8) {
    // Convert to miles
    const miles = furlongs / 8;
    const wholeMiles = Math.floor(miles);
    const fractionalFurlongs = furlongs - wholeMiles * 8;

    if (fractionalFurlongs === 0) {
      distance = `${wholeMiles} mile${wholeMiles !== 1 ? 's' : ''}`;
      exact = distance;
    } else if (fractionalFurlongs === 1) {
      distance = `${wholeMiles} 1/16 miles`;
      exact = `${wholeMiles} 1/16 miles`;
    } else if (fractionalFurlongs === 2) {
      distance = `${wholeMiles} 1/8 miles`;
      exact = `${wholeMiles} 1/8 miles`;
    } else if (fractionalFurlongs === 3) {
      distance = `${wholeMiles} 3/16 miles`;
      exact = `${wholeMiles} 3/16 miles`;
    } else if (fractionalFurlongs === 4) {
      distance = `${wholeMiles} 1/4 miles`;
      exact = `${wholeMiles} 1/4 miles`;
    } else if (fractionalFurlongs === 5) {
      distance = `${wholeMiles} 5/16 miles`;
      exact = `${wholeMiles} 5/16 miles`;
    } else if (fractionalFurlongs === 6) {
      distance = `${wholeMiles} 3/8 miles`;
      exact = `${wholeMiles} 3/8 miles`;
    } else if (fractionalFurlongs === 7) {
      distance = `${wholeMiles} 7/16 miles`;
      exact = `${wholeMiles} 7/16 miles`;
    } else {
      distance = `${miles.toFixed(2)} miles`;
      exact = `${miles.toFixed(4)} miles`;
    }
  } else {
    // Express in furlongs
    const wholeFurlongs = Math.floor(furlongs);
    const fractional = furlongs - wholeFurlongs;

    if (fractional === 0) {
      distance = `${wholeFurlongs}f`;
      exact = distance;
    } else if (fractional === 0.5) {
      distance = `${wholeFurlongs} 1/2f`;
      exact = distance;
    } else {
      distance = `${furlongs.toFixed(1)}f`;
      exact = `${furlongs.toFixed(2)}f`;
    }
  }

  return { distance, furlongs, exact };
}

// ============================================================================
// ODDS PARSING
// ============================================================================

/**
 * Parse morning line odds to string and decimal
 *
 * Supports multiple formats found in DRF files:
 * - Fractional: "5-2", "7/2", "3-1", "9/5"
 * - Fractional with spaces: "5 - 2", "5 / 2", "5- 2", "5 -2"
 * - Decimal: "2.5", "3.5"
 * - Whole number: "5", "10" (treated as X-1 odds)
 * - Even odds: "even", "E", "EVEN"
 *
 * Returns decimal odds for internal use (e.g., 5-2 returns 2.5)
 * If odds are missing/empty, returns decimal: 0 (not an error)
 */
function parseOdds(raw: string): { odds: string; decimal: number } {
  const trimmed = raw.trim();

  // Empty or missing - return 0 (not an error, will be handled at race level)
  if (!trimmed) {
    return { odds: '', decimal: 0 };
  }

  // Normalize: remove extra spaces around dashes and slashes
  const normalized = trimmed.replace(/\s*[-/]\s*/g, '-');

  // Handle "even" or "E" or "EVEN"
  if (normalized.toLowerCase() === 'even' || normalized.toLowerCase() === 'e') {
    return { odds: '1-1', decimal: 1 };
  }

  // Handle fractional odds (e.g., "5-1", "3-2", "9-5" after normalization)
  // Also handles "7/2" → "7-2" after normalization
  const fractionalMatch = normalized.match(/^(\d+)-(\d+)$/);
  if (fractionalMatch && fractionalMatch[1] && fractionalMatch[2]) {
    const num = parseInt(fractionalMatch[1], 10);
    const den = parseInt(fractionalMatch[2], 10);
    if (den > 0) {
      const decimal = num / den;
      return { odds: `${num}-${den}`, decimal };
    }
  }

  // Handle decimal odds (e.g., "2.5", "3.5")
  // Check for decimal point to distinguish from whole numbers
  if (normalized.includes('.')) {
    const decimalValue = parseFloat(normalized);
    if (!isNaN(decimalValue) && decimalValue > 0) {
      // Convert decimal to fractional for display
      // e.g., 2.5 becomes "5-2" (2.5 = 5/2)
      // For simplicity, keep decimal display but store decimal value
      return { odds: normalized, decimal: decimalValue };
    }
  }

  // Handle whole number odds (e.g., "5", "10" = X-1 odds)
  const wholeNumber = parseInt(normalized, 10);
  if (!isNaN(wholeNumber) && wholeNumber > 0) {
    return { odds: `${wholeNumber}-1`, decimal: wholeNumber };
  }

  // Couldn't parse - return 0
  return { odds: trimmed, decimal: 0 };
}

// ============================================================================
// EQUIPMENT & MEDICATION PARSING
// ============================================================================

/**
 * Parse equipment string to structured Equipment object
 */
function parseEquipment(raw: string): Equipment {
  const normalized = raw.trim().toUpperCase();

  const equipment: Equipment = {
    blinkers: false,
    blinkersOff: false,
    frontBandages: false,
    rearBandages: false,
    barShoes: false,
    mudCaulks: false,
    tongueTie: false,
    nasalStrip: false,
    shadowRoll: false,
    cheekPieces: false,
    firstTimeEquipment: [],
    equipmentChanges: [],
    raw,
  };

  if (!normalized) return equipment;

  // Parse individual equipment codes
  equipment.blinkers = /\bB\b/.test(normalized) || normalized.includes('BLINKERS');
  equipment.blinkersOff = /\bBO\b/.test(normalized) || normalized.includes('BLINKERS OFF');
  equipment.frontBandages = /\bF\b/.test(normalized) || normalized.includes('FRONT BANDAGES');
  equipment.rearBandages = /\bR\b/.test(normalized) || normalized.includes('REAR BANDAGES');
  equipment.barShoes = /\bBAR\b/.test(normalized);
  equipment.mudCaulks = /\bMC\b/.test(normalized) || normalized.includes('MUD CAULKS');
  equipment.tongueTie = /\bTT\b/.test(normalized) || normalized.includes('TONGUE TIE');
  equipment.nasalStrip = /\bNS\b/.test(normalized) || normalized.includes('NASAL STRIP');
  equipment.shadowRoll = /\bSR\b/.test(normalized) || normalized.includes('SHADOW ROLL');
  equipment.cheekPieces = /\bCP\b/.test(normalized) || normalized.includes('CHEEK PIECES');

  // Check for first time indicators
  if (normalized.includes('1ST') || normalized.includes('FIRST')) {
    if (equipment.blinkers) equipment.firstTimeEquipment.push('blinkers');
    if (equipment.nasalStrip) equipment.firstTimeEquipment.push('nasal strip');
  }

  return equipment;
}

/**
 * Parse medication string to structured Medication object
 */
function parseMedication(raw: string): Medication {
  const normalized = raw.trim().toUpperCase();

  const medication: Medication = {
    lasixFirstTime: false,
    lasix: false,
    lasixOff: false,
    bute: false,
    other: [],
    raw,
  };

  if (!normalized) return medication;

  // Lasix indicators
  medication.lasix = /\bL\b/.test(normalized) || normalized.includes('LASIX');
  medication.lasixFirstTime = /\bL1\b/.test(normalized) || normalized.includes('FIRST TIME LASIX');
  medication.lasixOff = /\bLO\b/.test(normalized) || normalized.includes('LASIX OFF');

  // Bute
  medication.bute = /\bBU\b/.test(normalized) || normalized.includes('BUTE');

  return medication;
}

// ============================================================================
// BREEDING PARSING
// ============================================================================

/**
 * Parse breeding/pedigree information
 * Per DRF_FIELD_MAP.md:
 * - Field 52: Sire Name
 * - Field 53: Sire's Sire
 * - Field 54: Dam Name
 * - Field 55: Dam's Sire
 * - Field 56: Breeder Name
 * - Field 57: State/Country Bred
 */
function parseBreeding(fields: string[]): Breeding {
  return {
    sire: getField(fields, DRF_COLUMNS.SIRE.index, 'Unknown'),
    sireOfSire: getField(fields, DRF_COLUMNS.SIRES_SIRE.index, ''),
    dam: getField(fields, DRF_COLUMNS.DAM.index, 'Unknown'),
    damSire: getField(fields, DRF_COLUMNS.DAM_SIRE.index, 'Unknown'),
    breeder: getField(fields, DRF_COLUMNS.BREEDER.index, ''),
    whereBred: getField(fields, DRF_COLUMNS.WHERE_BRED.index, ''),
    studFee: null,
  };
}

// ============================================================================
// SEX PARSING
// ============================================================================

/**
 * Parse horse sex code to full name
 */
function parseSex(code: string): { sex: string; sexFull: string } {
  const normalized = code.trim().toLowerCase();

  switch (normalized) {
    case 'c':
      return { sex: 'c', sexFull: 'Colt' };
    case 'f':
      return { sex: 'f', sexFull: 'Filly' };
    case 'g':
      return { sex: 'g', sexFull: 'Gelding' };
    case 'h':
      return { sex: 'h', sexFull: 'Horse' };
    case 'm':
      return { sex: 'm', sexFull: 'Mare' };
    case 'r':
      return { sex: 'r', sexFull: 'Ridgling' };
    default:
      return { sex: normalized || 'u', sexFull: 'Unknown' };
  }
}

// ============================================================================
// PAST PERFORMANCE PARSING
// ============================================================================

/**
 * Create default running line
 */
function createDefaultRunningLine(): RunningLine {
  return {
    start: null,
    quarterMile: null,
    quarterMileLengths: null,
    halfMile: null,
    halfMileLengths: null,
    threeQuarters: null,
    threeQuartersLengths: null,
    stretch: null,
    stretchLengths: null,
    finish: null,
    finishLengths: null,
  };
}

/**
 * Create default speed figures
 */
function createDefaultSpeedFigures(): SpeedFigures {
  return {
    beyer: null,
    timeformUS: null,
    equibase: null,
    trackVariant: null,
    dirtVariant: null,
    turfVariant: null,
  };
}

/**
 * Parse past performance data from fields
 *
 * Per DRF_FIELD_MAP.md, PP data is spread across multiple field ranges:
 * - Fields 102-113: PP Dates (12 races, index 101-112)
 * - Fields 114-125: PP Distances in furlongs (index 113-124)
 * - Fields 126-137: PP Track Codes (index 125-136)
 * - Fields 138-149: PP Distances in feet (index 137-148)
 * - Fields 150-161: PP Track Conditions (index 149-160)
 * - Fields 162-173: PP Equipment (index 161-172)
 * - Fields 174-185: PP Medication (index 173-184)
 * - Fields 186-197: PP Field Sizes (index 185-196)
 * - Fields 198-209: PP Post Positions (index 197-208)
 * - Fields 356-365: PP Finish Positions (index 355-364)
 * - Fields 366-375: PP Finish Margins (index 365-374)
 * - Fields 516-525: PP Final Odds (index 515-524)
 * - Fields 536-545: PP Race Type Codes (index 535-544)
 * - Fields 546-555: PP Claiming Prices (index 545-554)
 * - Fields 556-565: PP Purse Values (index 555-564)
 * - Fields 566-575: PP Start Positions (index 565-574)
 * - Fields 576-585: PP First Call Positions (index 575-584)
 * - Fields 586-595: PP Second Call Positions (index 585-594)
 * - Fields 596-605: PP Third Call Positions (index 595-604)
 * - Fields 606-615: PP Stretch Positions (index 605-614)
 * - Fields 636-655: PP Lengths at 1st Call (index 635-654)
 * - Fields 656-675: PP Lengths at 2nd Call (index 655-674)
 * - Fields 676-695: PP Lengths at 3rd Call (index 675-694)
 * - Fields 696-715: PP Lengths at Stretch (index 695-714)
 * - Fields 756-765: PP Finish Margin Variants (index 755-764)
 * - Fields 766-775: PP Beyer Speed Figures (index 765-774)
 * - Fields 776-785: PP Variant Figures (index 775-784)
 * - Fields 816-825: PP Early Pace (index 815-824)
 * - Fields 846-855: PP Late Pace (index 845-854)
 * - Fields 406-415: PP Race Winners (index 405-414)
 * - Fields 416-425: PP Second Place (index 415-424)
 * - Fields 426-435: PP Third Place (index 425-434)
 * - Fields 396-405: PP Trip Comments (index 395-404)
 * - Fields 1056-1065: PP Trainer Names (index 1055-1064)
 * - Fields 1066-1075: PP Jockey Names (index 1065-1074)
 * - Fields 1383-1392: PP Detailed Trip Notes (index 1382-1391)
 */
function parsePastPerformances(fields: string[], maxRaces = 12): PastPerformance[] {
  const performances: PastPerformance[] = [];

  // Field range starting indices (0-based)
  const PP_DATE_START = 101; // Field 102
  const PP_DISTANCE_FURLONGS = 113; // Field 114
  const PP_TRACK = 125; // Field 126
  // PP_DISTANCE_FEET = 137 (Field 138) - available for future use
  const PP_CONDITION = 149; // Field 150
  const PP_EQUIPMENT = 161; // Field 162
  const PP_MEDICATION = 173; // Field 174
  const PP_FIELD_SIZE = 185; // Field 186
  // PP_POST_POSITION = 197 (Field 198) - available for future use
  const PP_FINISH_POSITION = 355; // Field 356
  const PP_FINISH_MARGIN = 365; // Field 366
  const PP_ODDS = 515; // Field 516
  const PP_RACE_TYPE = 535; // Field 536
  const PP_CLAIMING = 545; // Field 546
  const PP_PURSE = 555; // Field 556
  const PP_START_POS = 565; // Field 566
  const PP_FIRST_CALL = 575; // Field 576
  const PP_SECOND_CALL = 585; // Field 586
  const PP_THIRD_CALL = 595; // Field 596
  const PP_STRETCH = 605; // Field 606
  const PP_LENGTHS_1ST = 635; // Field 636
  const PP_LENGTHS_2ND = 655; // Field 656
  const PP_LENGTHS_3RD = 675; // Field 676
  const PP_LENGTHS_STRETCH = 695; // Field 696
  const PP_BEYER = 765; // Field 766
  const PP_VARIANT = 775; // Field 776
  const PP_EARLY_PACE = 815; // Field 816
  const PP_LATE_PACE = 845; // Field 846
  const PP_WINNER = 405; // Field 406
  const PP_SECOND = 415; // Field 416
  const PP_THIRD = 425; // Field 426
  const PP_TRIP_SHORT = 395; // Field 396
  // PP_TRAINER = 1055 (Field 1056) - available for future use
  const PP_JOCKEY = 1065; // Field 1066
  const PP_TRIP_DETAILED = 1382; // Field 1383

  for (let i = 0; i < maxRaces; i++) {
    // Check if we have data for this race by looking at the date
    const ppDate = getField(fields, PP_DATE_START + i);
    if (!ppDate) break;

    // Parse distance
    const distFurlongs = getField(fields, PP_DISTANCE_FURLONGS + i);
    const distData = parseDistance('', distFurlongs);

    // Get race type for classification
    const raceType = getField(fields, PP_RACE_TYPE + i);
    const conditions = ''; // Would need to parse from extended fields

    const pp: PastPerformance = {
      date: ppDate,
      track: getField(fields, PP_TRACK + i, 'UNK'),
      trackName: '',
      raceNumber: 0, // Not directly available per race in spec
      distanceFurlongs: distData.furlongs,
      distance: distData.distance,
      surface: parseSurface(getField(fields, PP_CONDITION + i, 'D').substring(0, 1)),
      trackCondition: parseTrackCondition(getField(fields, PP_CONDITION + i, 'FT')),
      classification: parseRaceClassification(raceType, conditions),
      claimingPrice: parseIntNullable(getField(fields, PP_CLAIMING + i)),
      purse: parseIntSafe(getField(fields, PP_PURSE + i)),
      fieldSize: parseIntSafe(getField(fields, PP_FIELD_SIZE + i)),
      finishPosition: parseIntSafe(getField(fields, PP_FINISH_POSITION + i), 99),
      lengthsBehind: parseFloatSafe(getField(fields, PP_FINISH_MARGIN + i)),
      lengthsAhead: null, // Calculated if won
      finalTime: null, // In extended fractional data
      finalTimeFormatted: '',
      speedFigures: {
        beyer: parseIntNullable(getField(fields, PP_BEYER + i)),
        timeformUS: null,
        equibase: null,
        trackVariant: parseIntNullable(getField(fields, PP_VARIANT + i)),
        dirtVariant: null,
        turfVariant: null,
      },
      runningLine: {
        start: parseIntNullable(getField(fields, PP_START_POS + i)),
        quarterMile: parseIntNullable(getField(fields, PP_FIRST_CALL + i)),
        quarterMileLengths: parseFloatNullable(getField(fields, PP_LENGTHS_1ST + i)),
        halfMile: parseIntNullable(getField(fields, PP_SECOND_CALL + i)),
        halfMileLengths: parseFloatNullable(getField(fields, PP_LENGTHS_2ND + i)),
        threeQuarters: parseIntNullable(getField(fields, PP_THIRD_CALL + i)),
        threeQuartersLengths: parseFloatNullable(getField(fields, PP_LENGTHS_3RD + i)),
        stretch: parseIntNullable(getField(fields, PP_STRETCH + i)),
        stretchLengths: parseFloatNullable(getField(fields, PP_LENGTHS_STRETCH + i)),
        finish: parseIntSafe(getField(fields, PP_FINISH_POSITION + i), 99),
        finishLengths: parseFloatSafe(getField(fields, PP_FINISH_MARGIN + i)),
      },
      jockey: getField(fields, PP_JOCKEY + i, 'Unknown'),
      weight: 0, // In weight per PP fields (436-445)
      apprenticeAllowance: 0,
      equipment: getField(fields, PP_EQUIPMENT + i),
      medication: getField(fields, PP_MEDICATION + i),
      winner: getField(fields, PP_WINNER + i),
      secondPlace: getField(fields, PP_SECOND + i),
      thirdPlace: getField(fields, PP_THIRD + i),
      tripComment: getField(fields, PP_TRIP_SHORT + i),
      comment: getField(fields, PP_TRIP_DETAILED + i),
      odds: parseFloatNullable(getField(fields, PP_ODDS + i)),
      favoriteRank: null, // Would need to calculate
      wasClaimed: false, // Would need to parse from claiming activity fields
      claimedFrom: null,
      daysSinceLast: null, // Calculated from dates
    };

    // Calculate lengths ahead if this horse won
    if (pp.finishPosition === 1 && pp.lengthsBehind === 0) {
      pp.lengthsAhead = 0; // Won, so ahead by the margin (would need winner's margin)
    }

    // Add early/late pace figures to speed figures
    const earlyPace = parseIntNullable(getField(fields, PP_EARLY_PACE + i));
    const latePace = parseIntNullable(getField(fields, PP_LATE_PACE + i));
    if (earlyPace !== null || latePace !== null) {
      // Store in extended data - could add to speedFigures type if needed
    }

    performances.push(pp);
  }

  return performances;
}

// ============================================================================
// WORKOUT PARSING
// ============================================================================

/**
 * Parse workout data from fields
 *
 * Per DRF_FIELD_MAP.md Section 9 (Fields 256-325):
 * - Fields 256-265: Workout Dates (10 works, index 255-264)
 * - Fields 266-275: Days Since Each Work (index 265-274)
 * - Fields 276-295: Workout Track Codes (index 275-294, 2 per work for track/inner)
 * - Fields 296-305: Workout Post Position (index 295-304)
 * - Fields 306-315: Workout Track Condition (index 305-314)
 * - Fields 316-325: Workout Distance (index 315-324)
 *
 * Note: Additional workout data may be in other field ranges not fully documented
 */
function parseWorkouts(fields: string[], maxWorkouts = 10): Workout[] {
  const workouts: Workout[] = [];

  // Field range starting indices (0-based)
  const WK_DATE = 255; // Field 256 - Workout dates
  const WK_DAYS_SINCE = 265; // Field 266 - Days since each work
  const WK_TRACK = 275; // Field 276 - Track codes (2 fields per work)
  const WK_POST = 295; // Field 296 - Workout post position (gate works)
  const WK_CONDITION = 305; // Field 306 - Track condition
  const WK_DISTANCE = 315; // Field 316 - Distance

  for (let i = 0; i < maxWorkouts; i++) {
    // Check if we have data for this workout by looking at the date
    const wkDate = getField(fields, WK_DATE + i);
    if (!wkDate) break;

    // Parse distance
    const rawDistance = getField(fields, WK_DISTANCE + i);
    const distData = parseDistance('', rawDistance);

    // Track code (2 fields per work: track + inner/outer indicator)
    const track = getField(fields, WK_TRACK + i * 2, 'UNK');

    // Track condition
    const conditionCode = getField(fields, WK_CONDITION + i, 'FT');

    // Days since workout (can calculate recency)
    const daysSince = parseIntNullable(getField(fields, WK_DAYS_SINCE + i));

    // Post position / gate indicator
    const postField = getField(fields, WK_POST + i);
    const fromGate = postField.toLowerCase().includes('g') || postField === '1';

    // Note: Time, type, ranking are not in the documented field ranges
    // These may be in extended workout fields or need different parsing

    const workout: Workout = {
      date: wkDate,
      track,
      distanceFurlongs: distData.furlongs,
      distance: distData.distance,
      timeSeconds: 0, // Not directly available in documented fields
      timeFormatted: '',
      type: 'unknown', // Would need extended field parsing
      trackCondition: parseTrackCondition(conditionCode),
      surface: parseSurface(conditionCode.substring(0, 1)),
      ranking: '',
      rankNumber: null,
      totalWorks: null,
      isBullet: false, // Would need ranking data
      fromGate,
      notes: daysSince !== null ? `${daysSince} days ago` : '',
    };

    workouts.push(workout);
  }

  return workouts;
}

// ============================================================================
// HORSE ENTRY PARSING
// ============================================================================

/**
 * Create a default horse entry
 */
function createDefaultHorseEntry(index: number): HorseEntry {
  return {
    programNumber: index + 1,
    entryIndicator: '',
    postPosition: index + 1,
    horseName: `Horse ${index + 1}`,
    age: 3,
    sex: 'u',
    sexFull: 'Unknown',
    color: '',
    breeding: {
      sire: 'Unknown',
      sireOfSire: '',
      dam: 'Unknown',
      damSire: 'Unknown',
      breeder: '',
      whereBred: '',
      studFee: null,
    },
    owner: '',
    silks: '',
    trainerName: 'Unknown',
    trainerStats: '',
    jockeyName: 'Unknown',
    jockeyStats: '',
    weight: 120,
    apprenticeAllowance: 0,
    equipment: parseEquipment(''),
    medication: parseMedication(''),
    morningLineOdds: '0-0',
    morningLineDecimal: 0,
    currentOdds: null,
    lifetimeStarts: 0,
    lifetimeWins: 0,
    lifetimePlaces: 0,
    lifetimeShows: 0,
    lifetimeEarnings: 0,
    currentYearStarts: 0,
    currentYearWins: 0,
    currentYearPlaces: 0,
    currentYearShows: 0,
    currentYearEarnings: 0,
    previousYearStarts: 0,
    previousYearWins: 0,
    previousYearPlaces: 0,
    previousYearShows: 0,
    previousYearEarnings: 0,
    trackStarts: 0,
    trackWins: 0,
    trackPlaces: 0,
    trackShows: 0,
    surfaceStarts: 0,
    surfaceWins: 0,
    distanceStarts: 0,
    distanceWins: 0,
    turfStarts: 0,
    turfWins: 0,
    wetStarts: 0,
    wetWins: 0,
    daysSinceLastRace: null,
    lastRaceDate: null,
    averageBeyer: null,
    bestBeyer: null,
    lastBeyer: null,
    earlySpeedRating: null,
    runningStyle: '',
    pedigreeRating: null,
    claimingPrice: null,
    lastClaimPrice: null,
    trainerAngle: null,
    workouts: [],
    pastPerformances: [],
    isScratched: false,
    scratchReason: null,
    isCoupledMain: true,
    coupledWith: [],
    rawLine: '',
  };
}

/**
 * Parse a single horse entry from CSV fields
 */
function parseHorseEntry(fields: string[], lineIndex: number): HorseEntry {
  const horse = createDefaultHorseEntry(lineIndex);

  // Basic identification
  horse.postPosition = parseIntSafe(
    getField(fields, DRF_COLUMNS.POST_POSITION.index),
    lineIndex + 1
  );
  horse.programNumber = horse.postPosition;
  horse.entryIndicator = getField(fields, DRF_COLUMNS.ENTRY_INDICATOR.index);
  horse.horseName = getField(fields, DRF_COLUMNS.HORSE_NAME.index, `Horse ${lineIndex + 1}`);

  // Age, sex, color
  horse.age = parseIntSafe(getField(fields, DRF_COLUMNS.HORSE_AGE.index), 3);
  const sexData = parseSex(getField(fields, DRF_COLUMNS.HORSE_SEX.index));
  horse.sex = sexData.sex;
  horse.sexFull = sexData.sexFull;
  horse.color = getField(fields, DRF_COLUMNS.HORSE_COLOR.index);

  // Connections - per DRF spec, names are in single fields (Field 28=trainer, Field 33=jockey)
  horse.jockeyName = getField(fields, DRF_COLUMNS.JOCKEY_NAME.index, 'Unknown');
  horse.trainerName = getField(fields, DRF_COLUMNS.TRAINER_NAME.index, 'Unknown');
  horse.owner = getField(fields, DRF_COLUMNS.OWNER_NAME.index);

  // Program number (Field 43)
  const programNum = parseIntNullable(getField(fields, DRF_COLUMNS.PROGRAM_NUMBER.index));
  if (programNum !== null) {
    horse.programNumber = programNum;
  }

  // Weight and equipment
  horse.weight = parseIntSafe(getField(fields, DRF_COLUMNS.WEIGHT.index), 120);
  horse.apprenticeAllowance = parseIntSafe(
    getField(fields, DRF_COLUMNS.APPRENTICE_ALLOWANCE.index)
  );
  horse.equipment = parseEquipment(getField(fields, DRF_COLUMNS.EQUIPMENT.index));
  horse.medication = parseMedication(getField(fields, DRF_COLUMNS.MEDICATION.index));

  // Odds
  const oddsData = parseOdds(getField(fields, DRF_COLUMNS.MORNING_LINE.index));
  horse.morningLineOdds = oddsData.odds;
  horse.morningLineDecimal = oddsData.decimal;

  // Breeding
  horse.breeding = parseBreeding(fields);

  // Statistics
  horse.lifetimeStarts = parseIntSafe(getField(fields, DRF_COLUMNS.LIFETIME_STARTS.index));
  horse.lifetimeWins = parseIntSafe(getField(fields, DRF_COLUMNS.LIFETIME_WINS.index));
  horse.lifetimePlaces = parseIntSafe(getField(fields, DRF_COLUMNS.LIFETIME_PLACES.index));
  horse.lifetimeShows = parseIntSafe(getField(fields, DRF_COLUMNS.LIFETIME_SHOWS.index));
  horse.lifetimeEarnings = parseIntSafe(getField(fields, DRF_COLUMNS.LIFETIME_EARNINGS.index));

  horse.currentYearStarts = parseIntSafe(getField(fields, DRF_COLUMNS.CURRENT_YEAR_STARTS.index));
  horse.currentYearWins = parseIntSafe(getField(fields, DRF_COLUMNS.CURRENT_YEAR_WINS.index));
  horse.currentYearPlaces = parseIntSafe(getField(fields, DRF_COLUMNS.CURRENT_YEAR_PLACES.index));
  horse.currentYearShows = parseIntSafe(getField(fields, DRF_COLUMNS.CURRENT_YEAR_SHOWS.index));
  horse.currentYearEarnings = parseIntSafe(
    getField(fields, DRF_COLUMNS.CURRENT_YEAR_EARNINGS.index)
  );

  // Previous year statistics (Fields 75-79)
  horse.previousYearStarts = parseIntSafe(getField(fields, DRF_COLUMNS.PREVIOUS_YEAR_STARTS.index));
  horse.previousYearWins = parseIntSafe(getField(fields, DRF_COLUMNS.PREVIOUS_YEAR_WINS.index));
  horse.previousYearPlaces = parseIntSafe(getField(fields, DRF_COLUMNS.PREVIOUS_YEAR_PLACES.index));
  horse.previousYearShows = parseIntSafe(getField(fields, DRF_COLUMNS.PREVIOUS_YEAR_SHOWS.index));
  horse.previousYearEarnings = parseIntSafe(
    getField(fields, DRF_COLUMNS.PREVIOUS_YEAR_EARNINGS.index)
  );

  // Track-specific statistics (Fields 80-84)
  horse.trackStarts = parseIntSafe(getField(fields, DRF_COLUMNS.TRACK_STARTS.index));
  horse.trackWins = parseIntSafe(getField(fields, DRF_COLUMNS.TRACK_WINS.index));
  horse.trackPlaces = parseIntSafe(getField(fields, DRF_COLUMNS.TRACK_PLACES.index));
  horse.trackShows = parseIntSafe(getField(fields, DRF_COLUMNS.TRACK_SHOWS.index));

  // Running style (Field 210)
  horse.runningStyle = getField(fields, DRF_COLUMNS.RUNNING_STYLE.index);

  // Speed figures
  horse.bestBeyer = parseIntNullable(getField(fields, DRF_COLUMNS.BEST_BEYER.index));
  horse.averageBeyer = parseIntNullable(getField(fields, DRF_COLUMNS.AVERAGE_BEYER.index));
  horse.lastBeyer = parseIntNullable(getField(fields, DRF_COLUMNS.LAST_BEYER.index));

  // Days since last race
  horse.daysSinceLastRace = parseIntNullable(getField(fields, DRF_COLUMNS.DAYS_SINCE_LAST.index));

  // Claiming price
  horse.claimingPrice = parseIntNullable(getField(fields, DRF_COLUMNS.CLAIMING_PRICE.index));

  // Past performances
  horse.pastPerformances = parsePastPerformances(fields);

  // Workouts
  horse.workouts = parseWorkouts(fields);

  // Store raw line for debugging
  horse.rawLine = fields.slice(0, 50).join(',');

  return horse;
}

// ============================================================================
// RACE HEADER PARSING
// ============================================================================

/**
 * Create default race header
 */
function createDefaultRaceHeader(): RaceHeader {
  return {
    trackCode: 'UNK',
    trackName: '',
    trackLocation: '',
    raceNumber: 1,
    raceDate: '',
    raceDateRaw: '',
    postTime: '',
    distanceFurlongs: 0,
    distance: 'Unknown',
    distanceExact: 'Unknown',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'unknown',
    raceType: '',
    purse: 0,
    purseFormatted: '$0',
    ageRestriction: '',
    sexRestriction: '',
    weightConditions: '',
    stateBred: null,
    claimingPriceMin: null,
    claimingPriceMax: null,
    allowedWeight: null,
    conditions: '',
    raceName: null,
    grade: null,
    isListed: false,
    isAbout: false,
    tempRail: null,
    turfCourseType: null,
    chuteStart: false,
    hasReplay: false,
    programNumber: 1,
    fieldSize: 0,
    probableFavorite: null,
  };
}

/**
 * Parse race header from first horse entry fields
 *
 * Per DRF_FIELD_MAP.md Section 1 (Fields 1-27):
 * - Field 1: Track Code
 * - Field 2: Race Date (YYYYMMDD)
 * - Field 3: Race Number
 * - Field 4: Post Position
 * - Field 6: Post Time (military)
 * - Field 7: Surface Code (D/T/S)
 * - Field 9: Distance Code (S/R)
 * - Field 10: Race Type Code
 * - Field 11: Race Name/Conditions
 * - Field 12: Purse Amount
 * - Field 15: Distance (furlongs)
 * - Field 16: Race Description
 * - Field 24: Field Size
 */
function parseRaceHeader(fields: string[]): RaceHeader {
  const header = createDefaultRaceHeader();

  // Race identification (Fields 1-3)
  header.trackCode = getField(fields, DRF_COLUMNS.TRACK_CODE.index, 'UNK').substring(0, 3);
  header.raceDate = getField(fields, DRF_COLUMNS.RACE_DATE.index);
  header.raceDateRaw = header.raceDate.replace(/\D/g, '');
  header.raceNumber = parseIntSafe(getField(fields, DRF_COLUMNS.RACE_NUMBER.index), 1);
  header.programNumber = header.raceNumber;

  // Post time (Field 6)
  header.postTime = getField(fields, DRF_COLUMNS.POST_TIME.index);

  // Distance (Field 15)
  const distData = parseDistance('', getField(fields, DRF_COLUMNS.DISTANCE_FURLONGS.index));
  header.distance = distData.distance;
  header.distanceExact = distData.exact;
  header.distanceFurlongs = distData.furlongs;

  // Surface (Field 7) and track condition
  header.surface = parseSurface(getField(fields, DRF_COLUMNS.SURFACE.index, 'D'));
  // Track condition may need to be inferred from surface field or PP data
  header.trackCondition = parseTrackCondition(getField(fields, DRF_COLUMNS.SURFACE.index, 'FT'));

  // Classification (Fields 10-11)
  const raceType = getField(fields, DRF_COLUMNS.RACE_TYPE.index);
  const conditions = getField(fields, DRF_COLUMNS.RACE_CONDITIONS.index);
  header.classification = parseRaceClassification(raceType, conditions);
  header.raceType = raceType;
  header.conditions = conditions;

  // Race description (Field 16) - parse restrictions from here
  const raceDesc = getField(fields, DRF_COLUMNS.RACE_DESCRIPTION.index);
  header.ageRestriction = extractAgeRestriction(raceDesc, conditions);
  header.sexRestriction = extractSexRestriction(raceDesc, conditions);

  // Purse (Field 12)
  header.purse = parseIntSafe(getField(fields, DRF_COLUMNS.PURSE.index));
  header.purseFormatted = `$${header.purse.toLocaleString()}`;

  // Claiming price - parse from conditions text or purse field
  const claimPrice = extractClaimingPrice(conditions, raceDesc);
  if (claimPrice) {
    header.claimingPriceMin = claimPrice;
    header.claimingPriceMax = claimPrice;
  }

  // Stakes info - parse from conditions
  const stakesInfo = extractStakesInfo(conditions, raceDesc);
  header.raceName = stakesInfo.raceName;
  header.grade = stakesInfo.grade;
  header.isListed = stakesInfo.isListed;

  // Field size (Field 24)
  header.fieldSize = parseIntSafe(getField(fields, DRF_COLUMNS.FIELD_SIZE.index));

  return header;
}

/**
 * Extract age restriction from race description/conditions
 */
function extractAgeRestriction(raceDesc: string, conditions: string): string {
  const text = `${raceDesc} ${conditions}`.toLowerCase();

  // Look for age patterns like "3yo", "3 yo", "3 year old", "3+", "4 and up"
  const patterns = [/(\d+)\s*(?:yo|year\s*old)/i, /(\d+)\s*(?:and up|\+)/i, /(\d+)-(\d+)/];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2]) {
        return `${match[1]}-${match[2]}`;
      }
      return match[0] ?? '';
    }
  }
  return '';
}

/**
 * Extract sex restriction from race description/conditions
 */
function extractSexRestriction(raceDesc: string, conditions: string): string {
  const text = `${raceDesc} ${conditions}`.toLowerCase();

  if (text.includes('fillies and mares') || text.includes('f&m')) return 'F&M';
  if (text.includes('fillies only') || text.includes(' fillies ')) return 'F';
  if (text.includes('colts and geldings') || text.includes('c&g')) return 'C&G';
  if (text.includes('mares')) return 'M';
  return '';
}

/**
 * Extract claiming price from conditions text
 */
function extractClaimingPrice(conditions: string, raceDesc: string): number | null {
  const text = `${conditions} ${raceDesc}`;

  // Look for claiming patterns like "CLM 25000", "$25,000 CLM", "25000 claiming"
  const patterns = [/\$?([\d,]+)\s*(?:clm|claiming)/i, /(?:clm|claiming)\s*\$?([\d,]+)/i];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
  }
  return null;
}

/**
 * Extract stakes info from conditions text
 */
function extractStakesInfo(
  conditions: string,
  raceDesc: string
): { raceName: string | null; grade: number | null; isListed: boolean } {
  const text = `${conditions} ${raceDesc}`;
  const result = { raceName: null as string | null, grade: null as number | null, isListed: false };

  // Extract grade
  const gradeMatch = text.match(/(?:grade|gr\.?)\s*([123])|(?:g)([123])\b/i);
  if (gradeMatch) {
    result.grade = parseInt(gradeMatch[1] || gradeMatch[2] || '0', 10);
  }

  // Check for listed stakes
  result.isListed = /listed/i.test(text);

  // Extract stakes race name (look for capitalized names or quoted text)
  const stakesMatch = text.match(/(?:the\s+)?([A-Z][A-Za-z\s']+(?:Stakes|S\.|Handicap|H\.))/);
  if (stakesMatch && stakesMatch[1]) {
    result.raceName = stakesMatch[1].trim();
  }

  return result;
}

// ============================================================================
// PROGRESS CALLBACK TYPE
// ============================================================================

export type ProgressCallback = (message: DRFWorkerProgressMessage) => void;

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse a DRF file content string into structured data.
 * Handles both comma-delimited and fixed-width formats.
 *
 * Includes defensive parsing to prevent crashes on malformed input:
 * - Validates file format before parsing
 * - Handles truncated files gracefully
 * - Catches encoding issues
 * - Validates field counts per line
 * - Never throws unhandled exceptions
 *
 * @param content - Raw file content
 * @param filename - Original filename
 * @param onProgress - Optional callback for progress updates
 * @returns Parsed DRF file data
 */
export function parseDRFFile(
  content: string,
  filename: string,
  onProgress?: ProgressCallback
): ParsedDRFFile {
  const startTime = performance.now();
  const warnings: string[] = [];
  const errors: string[] = [];

  // Send initial progress
  const sendProgress = (
    progress: number,
    step: ParsingStep,
    message: string,
    details?: DRFWorkerProgressMessage['details']
  ) => {
    if (onProgress) {
      onProgress({
        type: 'progress',
        progress,
        step,
        message,
        details,
      });
    }
  };

  // Helper to create error result
  const createErrorResult = (errorMessage: string): ParsedDRFFile => ({
    filename,
    races: [],
    format: 'unknown',
    version: null,
    parsedAt: new Date().toISOString(),
    isValid: false,
    warnings,
    errors: [errorMessage, ...errors],
    stats: {
      totalRaces: 0,
      totalHorses: 0,
      totalPastPerformances: 0,
      totalWorkouts: 0,
      parseTimeMs: performance.now() - startTime,
      linesProcessed: 0,
      linesSkipped: 0,
    },
  });

  sendProgress(0, 'initializing', 'Initializing parser...');

  // =====================================================================
  // STEP 1: Validate file content before parsing
  // =====================================================================
  try {
    validateFileContent(content, filename);
  } catch (error) {
    // Log the error and return a friendly result
    if (error instanceof DRFParseError || error instanceof FileFormatError) {
      logger.logError(error, { fileName: filename, component: 'DRFParser' });
      return createErrorResult(error.getUserMessage());
    }
    // Unknown error type
    const msg = error instanceof Error ? error.message : 'File validation failed';
    logger.logError(new Error(msg), { fileName: filename, component: 'DRFParser' });
    return createErrorResult(msg);
  }

  // Split into lines
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const totalLines = lines.length;

  if (totalLines === 0) {
    const emptyError = new DRFParseError('EMPTY_FILE', 'No data lines found in file', {
      context: { filename },
    });
    logger.logWarning('Empty file uploaded', { fileName: filename });
    return createErrorResult(emptyError.getUserMessage());
  }

  sendProgress(5, 'detecting-format', 'Detecting file format...');

  // Detect format: CSV (has commas) or fixed-width
  const firstLine = lines[0];
  if (!firstLine) {
    return createErrorResult('File contains no readable lines');
  }
  const isCSV = firstLine.includes(',');
  const format = isCSV ? 'csv' : 'fixed-width';

  sendProgress(10, 'extracting-races', 'Extracting race data...');

  // Group lines by race
  const racesMap = new Map<
    string,
    { header: RaceHeader; horses: HorseEntry[]; warnings: string[]; errors: string[] }
  >();
  let linesProcessed = 0;
  let linesSkipped = 0;
  let totalHorses = 0;
  let totalPastPerformances = 0;
  let totalWorkouts = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Update progress periodically
    if (i % 10 === 0) {
      const progress = 10 + Math.floor((i / lines.length) * 60);
      sendProgress(progress, 'parsing-horses', `Parsing horse ${i + 1} of ${lines.length}...`, {
        currentHorse: i + 1,
        totalHorses: lines.length,
      });
    }

    // =====================================================================
    // STEP 2: Validate each line before parsing
    // =====================================================================
    const currentLine = line;
    if (!currentLine) {
      linesSkipped++;
      continue;
    }
    const lineValidation = validateLine(currentLine, lineNumber, filename);
    if (lineValidation.warning) {
      warnings.push(lineValidation.warning);
    }
    if (!lineValidation.isValid) {
      linesSkipped++;
      continue;
    }

    if (isCSV) {
      // Use safe CSV parsing with error handling
      const parseResult = safeParseCSVLine(currentLine, lineNumber, filename);
      if (!parseResult) {
        linesSkipped++;
        continue;
      }

      const { fields, warning: parseWarning } = parseResult;
      if (parseWarning) {
        warnings.push(parseWarning);
      }

      if (fields.length < 5) {
        warnings.push(`Line ${lineNumber}: Insufficient fields (${fields.length}), skipping`);
        linesSkipped++;
        continue;
      }

      // Validate field count consistency
      if (lineValidation.fieldCount < MIN_EXPECTED_FIELDS) {
        // Log but continue - partial data might still be usable
        logger.logDebug(`Line ${lineNumber} has fewer fields than expected`, {
          fileName: filename,
          lineNumber,
          fieldCount: fields.length,
          expectedMin: MIN_EXPECTED_FIELDS,
        });
      }

      // Extract race key with defensive null checks
      const trackCode = getField(fields, DRF_COLUMNS.TRACK_CODE.index, 'UNK').substring(0, 3);
      const raceDate = getField(fields, DRF_COLUMNS.RACE_DATE.index);
      const raceNumber = parseIntSafe(getField(fields, DRF_COLUMNS.RACE_NUMBER.index), 0);
      const raceKey = `${trackCode}-${raceDate}-${raceNumber}`;

      if (!racesMap.has(raceKey)) {
        try {
          const header = parseRaceHeader(fields);
          racesMap.set(raceKey, {
            header,
            horses: [],
            warnings: [],
            errors: [],
          });
        } catch (headerError) {
          logger.logWarning(`Failed to parse race header at line ${lineNumber}`, {
            fileName: filename,
            lineNumber,
            error: headerError instanceof Error ? headerError.message : String(headerError),
          });
          warnings.push(`Line ${lineNumber}: Failed to parse race header`);
          linesSkipped++;
          continue;
        }
      }

      // Parse horse entry with error handling
      if (fields.length >= 6) {
        try {
          const race = racesMap.get(raceKey);
          if (race) {
            const horseEntry = parseHorseEntry(fields, race.horses.length);
            race.horses.push(horseEntry);
            totalHorses++;
            totalPastPerformances += horseEntry.pastPerformances.length;
            totalWorkouts += horseEntry.workouts.length;
          }
        } catch (horseError) {
          logger.logWarning(`Failed to parse horse entry at line ${lineNumber}`, {
            fileName: filename,
            lineNumber,
            error: horseError instanceof Error ? horseError.message : String(horseError),
          });
          warnings.push(`Line ${lineNumber}: Failed to parse horse entry`);
        }
      }

      linesProcessed++;
    } else {
      // Fixed-width format parsing (simplified)
      if (currentLine.length < 20) {
        linesSkipped++;
        continue;
      }

      // For fixed-width, parse as if it's a delimited file with spaces
      try {
        const fields = currentLine.split(/\s+/);
        const trackCode = fields[0]?.substring(0, 3) || 'UNK';
        const raceDate = fields[1] ?? '';
        const raceNumber = parseIntSafe(fields[2] ?? '1', 1);
        const raceKey = `${trackCode}-${raceDate}-${raceNumber}`;

        if (!racesMap.has(raceKey)) {
          const newRace = {
            header: createDefaultRaceHeader(),
            horses: [],
            warnings: [],
            errors: [],
          };
          newRace.header.trackCode = trackCode;
          newRace.header.raceDate = raceDate;
          newRace.header.raceNumber = raceNumber;
          racesMap.set(raceKey, newRace);
        }

        const race = racesMap.get(raceKey);
        if (race) {
          const horseEntry = createDefaultHorseEntry(race.horses.length);
          horseEntry.horseName = fields[3] ?? `Horse ${race.horses.length + 1}`;
          race.horses.push(horseEntry);
          totalHorses++;
        }

        linesProcessed++;
      } catch (fixedWidthError) {
        logger.logWarning(`Failed to parse fixed-width line ${lineNumber}`, {
          fileName: filename,
          lineNumber,
          error:
            fixedWidthError instanceof Error ? fixedWidthError.message : String(fixedWidthError),
        });
        warnings.push(`Line ${lineNumber}: Failed to parse`);
        linesSkipped++;
      }
    }
  }

  sendProgress(75, 'validating-data', 'Validating parsed data...');

  // Update field sizes and validate races
  racesMap.forEach((race) => {
    race.header.fieldSize = race.horses.length;

    // Validate minimum horses
    if (race.horses.length < 2) {
      race.warnings.push(
        `Race ${race.header.raceNumber}: Only ${race.horses.length} horse(s) found`
      );
    }

    // Track horses with missing data for consolidated warnings
    let _missingNameCount = 0;
    let missingOddsCount = 0;

    // Check for missing data
    race.horses.forEach((horse, idx) => {
      if (!horse.horseName || horse.horseName.startsWith('Horse ')) {
        _missingNameCount++;
        race.warnings.push(`Horse #${idx + 1}: Missing horse name`);
      }
      if (horse.morningLineDecimal === 0) {
        missingOddsCount++;
      }
    });

    // Consolidate morning line odds warnings (one per race, not per horse)
    if (missingOddsCount > 0 && race.horses.length > 0) {
      if (missingOddsCount === race.horses.length) {
        // ALL horses missing odds - this is an error condition
        race.errors.push(
          `Race ${race.header.raceNumber}: All ${missingOddsCount} horses missing morning line odds`
        );
      } else {
        // Some horses missing odds - just a warning
        race.warnings.push(
          `Race ${race.header.raceNumber}: ${missingOddsCount} horse(s) missing morning line odds`
        );
      }
    }
  });

  sendProgress(90, 'finalizing', 'Finalizing results...');

  // Convert map to array and sort by race number
  const races: ParsedRace[] = Array.from(racesMap.values())
    .map((race) => ({
      header: race.header,
      horses: race.horses.sort((a, b) => a.postPosition - b.postPosition),
      warnings: race.warnings,
      errors: race.errors,
    }))
    .sort((a, b) => a.header.raceNumber - b.header.raceNumber);

  const parseTimeMs = performance.now() - startTime;

  sendProgress(100, 'complete', 'Parsing complete!');

  // Collect all warnings from individual races
  races.forEach((race) => {
    warnings.push(...race.warnings);
  });

  // Final validation check
  const isValid = errors.length === 0 && races.length > 0;

  // Log parsing results
  if (isValid) {
    logger.logInfo('DRF file parsed successfully', {
      fileName: filename,
      totalRaces: races.length,
      totalHorses,
      totalPastPerformances,
      totalWorkouts,
      parseTimeMs,
      linesProcessed,
      linesSkipped,
      warningCount: warnings.length,
    });
  } else {
    logger.logWarning('DRF parsing completed with issues', {
      fileName: filename,
      isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
      racesFound: races.length,
      linesProcessed,
      linesSkipped,
    });
  }

  return {
    filename,
    races,
    format,
    version: null,
    parsedAt: new Date().toISOString(),
    isValid,
    warnings,
    errors,
    stats: {
      totalRaces: races.length,
      totalHorses,
      totalPastPerformances,
      totalWorkouts,
      parseTimeMs,
      linesProcessed,
      linesSkipped,
    },
  };
}

// ============================================================================
// EXPORTS FOR BACKWARDS COMPATIBILITY AND UTILITIES
// ============================================================================

export {
  createDefaultHorseEntry,
  createDefaultRaceHeader,
  createDefaultRunningLine,
  createDefaultSpeedFigures,
  parseOdds,
};
