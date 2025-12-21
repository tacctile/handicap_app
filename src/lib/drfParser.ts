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

import {
  DRFParseError,
  FileFormatError,
} from '../types/errors'
import { logger } from '../services/logging'

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
  WorkoutType,
  Breeding,
  Equipment,
  Medication,
  RunningLine,
  SpeedFigures,
  ParsingStep,
  DRFWorkerProgressMessage,
} from '../types/drf'

// ============================================================================
// DRF COLUMN SPECIFICATIONS
// ============================================================================

/**
 * DRF fixed-width format column definitions
 * Based on official DRF Single File format specification
 *
 * Note: DRF files can have 1400+ fields per horse
 * These are the most critical fields for handicapping
 */
const DRF_COLUMNS = {
  // Race identification (fields 1-10)
  TRACK_CODE: { index: 0, name: 'Track Code' },
  RACE_DATE: { index: 1, name: 'Race Date' },
  RACE_NUMBER: { index: 2, name: 'Race Number' },
  POST_POSITION: { index: 3, name: 'Post Position' },
  ENTRY_INDICATOR: { index: 4, name: 'Entry Indicator' },

  // Horse identification (fields 5-15)
  HORSE_NAME: { index: 5, name: 'Horse Name' },
  HORSE_AGE: { index: 47, name: 'Horse Age' },
  HORSE_SEX: { index: 48, name: 'Horse Sex' },
  HORSE_COLOR: { index: 49, name: 'Horse Color' },

  // Connections (fields 15-25)
  JOCKEY_LAST: { index: 6, name: 'Jockey Last Name' },
  JOCKEY_FIRST: { index: 7, name: 'Jockey First Name' },
  TRAINER_LAST: { index: 8, name: 'Trainer Last Name' },
  TRAINER_FIRST: { index: 9, name: 'Trainer First Name' },
  OWNER_NAME: { index: 28, name: 'Owner Name' },

  // Race conditions (fields 25-50)
  DISTANCE: { index: 10, name: 'Distance (yards)' },
  DISTANCE_FURLONGS: { index: 11, name: 'Distance (furlongs)' },
  SURFACE: { index: 12, name: 'Surface' },
  RACE_TYPE: { index: 13, name: 'Race Type Code' },
  AGE_RESTRICTION: { index: 14, name: 'Age Restriction' },
  SEX_RESTRICTION: { index: 15, name: 'Sex Restriction' },
  PURSE: { index: 16, name: 'Purse' },
  CLAIMING_PRICE: { index: 17, name: 'Claiming Price' },
  TRACK_CONDITION: { index: 18, name: 'Track Condition' },
  RACE_CONDITIONS: { index: 19, name: 'Race Conditions Text' },

  // Weight and equipment (fields 50-70)
  WEIGHT: { index: 20, name: 'Weight' },
  APPRENTICE_ALLOWANCE: { index: 21, name: 'Apprentice Allowance' },
  MORNING_LINE: { index: 22, name: 'Morning Line Odds' },
  EQUIPMENT: { index: 23, name: 'Equipment' },
  MEDICATION: { index: 24, name: 'Medication' },

  // Breeding (fields 70-85)
  SIRE: { index: 29, name: 'Sire' },
  DAM: { index: 30, name: 'Dam' },
  DAM_SIRE: { index: 31, name: 'Dam Sire' },
  BREEDER: { index: 32, name: 'Breeder' },
  WHERE_BRED: { index: 33, name: 'Where Bred' },

  // Statistics (fields 85-150)
  LIFETIME_STARTS: { index: 34, name: 'Lifetime Starts' },
  LIFETIME_WINS: { index: 35, name: 'Lifetime Wins' },
  LIFETIME_PLACES: { index: 36, name: 'Lifetime Places' },
  LIFETIME_SHOWS: { index: 37, name: 'Lifetime Shows' },
  LIFETIME_EARNINGS: { index: 38, name: 'Lifetime Earnings' },
  CURRENT_YEAR_STARTS: { index: 39, name: 'Current Year Starts' },
  CURRENT_YEAR_WINS: { index: 40, name: 'Current Year Wins' },
  CURRENT_YEAR_PLACES: { index: 41, name: 'Current Year Places' },
  CURRENT_YEAR_SHOWS: { index: 42, name: 'Current Year Shows' },
  CURRENT_YEAR_EARNINGS: { index: 43, name: 'Current Year Earnings' },
  BEST_BEYER: { index: 44, name: 'Best Beyer' },
  AVERAGE_BEYER: { index: 45, name: 'Average Beyer' },
  LAST_BEYER: { index: 46, name: 'Last Beyer' },

  // Stakes/grade info
  RACE_NAME: { index: 25, name: 'Race Name' },
  RACE_GRADE: { index: 26, name: 'Race Grade' },
  POST_TIME: { index: 27, name: 'Post Time' },

  // Days since last race
  DAYS_SINCE_LAST: { index: 50, name: 'Days Since Last Race' },

  // Past performances start at index 100+ (10 races × multiple fields each)
  PP_START: 100,
  PP_FIELDS_PER_RACE: 50,

  // Workouts start at index 600+ (5 workouts × multiple fields each)
  WORKOUT_START: 600,
  WORKOUT_FIELDS_PER_WORK: 10,
} as const

// ============================================================================
// FILE VALIDATION & DEFENSIVE PARSING
// ============================================================================

/** Minimum fields expected for a valid DRF CSV line */
const MIN_EXPECTED_FIELDS = 50

/** Maximum file size we'll attempt to parse (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/** Common binary file signatures to detect non-text files */
const BINARY_SIGNATURES = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff],       // JPEG
  [0x50, 0x4b, 0x03, 0x04], // ZIP/XLSX/DOCX
  [0x25, 0x50, 0x44, 0x46], // PDF
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0x4d, 0x5a],             // Windows executable
]

/**
 * Check if content appears to be binary (non-text)
 */
function isBinaryContent(content: string): boolean {
  // Check for null bytes which indicate binary content
  if (content.includes('\x00')) {
    return true
  }

  // Check first few bytes against known binary signatures
  const bytes = content.slice(0, 8).split('').map(c => c.charCodeAt(0))
  for (const sig of BINARY_SIGNATURES) {
    if (sig.every((byte, i) => bytes[i] === byte)) {
      return true
    }
  }

  // Check for high ratio of non-printable characters (excluding common whitespace)
  const sample = content.slice(0, 1000)
  let nonPrintable = 0
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i)
    // Allow printable ASCII, tabs, newlines, carriage returns
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintable++
    }
    // Disallow most control characters except for extended ASCII
    if (code > 126 && code < 160) {
      nonPrintable++
    }
  }

  // If more than 5% non-printable, likely binary
  return sample.length > 0 && (nonPrintable / sample.length) > 0.05
}

/**
 * Check if content has UTF-8 encoding issues
 */
function hasEncodingIssues(content: string): boolean {
  // Check for replacement character which indicates encoding problems
  if (content.includes('\uFFFD')) {
    return true
  }

  // Check for common mojibake patterns (UTF-8 decoded as Latin-1, etc.)
  const mojibakePatterns = [
    /Ã©/g, // é as UTF-8 in Latin-1
    /Ã¨/g, // è
    /Ã /g, // à
    /â€/g, // various smart quotes
  ]

  const sample = content.slice(0, 2000)
  let matches = 0
  for (const pattern of mojibakePatterns) {
    const found = sample.match(pattern)
    if (found) matches += found.length
  }

  // A few matches might be coincidental, many indicates encoding issues
  return matches > 5
}

/**
 * Validate file content before parsing
 * Returns null if valid, or throws appropriate error
 */
function validateFileContent(
  content: string,
  filename: string
): void {
  // Check for empty content
  if (!content || content.trim().length === 0) {
    throw new DRFParseError('EMPTY_FILE', 'The file is empty or contains no readable data', {
      context: { filename },
    })
  }

  // Check file size
  const size = new Blob([content]).size
  if (size > MAX_FILE_SIZE) {
    throw new FileFormatError('FILE_TOO_LARGE', `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`, {
      filename,
      fileSize: size,
    })
  }

  // Check for binary content
  if (isBinaryContent(content)) {
    throw new FileFormatError('BINARY_CONTENT', 'The file appears to be binary, not a text-based DRF file', {
      filename,
      detectedType: 'binary',
    })
  }

  // Check for encoding issues
  if (hasEncodingIssues(content)) {
    logger.logWarning('Potential encoding issues detected in file', { fileName: filename })
    // Don't throw - try to parse anyway with a warning
  }
}

/**
 * Validate that a line looks like valid CSV/DRF data
 */
function validateLine(line: string, lineNumber: number, _filename: string): {
  isValid: boolean
  fieldCount: number
  warning?: string
} {
  // Empty lines are skipped, not invalid
  if (!line.trim()) {
    return { isValid: false, fieldCount: 0 }
  }

  // Count fields (rough estimate - doesn't handle quoted commas perfectly)
  const roughFieldCount = (line.match(/,/g) || []).length + 1

  // Check for extremely short lines (truncated)
  if (roughFieldCount < 5 && line.length > 0) {
    return {
      isValid: false,
      fieldCount: roughFieldCount,
      warning: `Line ${lineNumber}: Too few fields (${roughFieldCount}), may be truncated`,
    }
  }

  // Check for lines that are way shorter than expected for DRF
  if (roughFieldCount < MIN_EXPECTED_FIELDS && roughFieldCount > 5) {
    return {
      isValid: true,
      fieldCount: roughFieldCount,
      warning: `Line ${lineNumber}: Fewer fields than typical DRF format (${roughFieldCount} < ${MIN_EXPECTED_FIELDS})`,
    }
  }

  return { isValid: true, fieldCount: roughFieldCount }
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
    const fields = parseCSVLine(line)

    // Validate we got reasonable results
    if (fields.length === 0) {
      return null
    }

    // Check for obviously malformed data
    if (fields.length === 1 && line.includes(',')) {
      // CSV parsing may have failed - all data in one field despite commas
      return {
        fields,
        warning: `Line ${lineNumber}: Possible CSV parsing issue - check for unbalanced quotes`,
      }
    }

    return { fields }
  } catch (error) {
    logger.logWarning(`Failed to parse CSV line ${lineNumber}`, {
      fileName: filename,
      lineNumber,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// ============================================================================
// PARSING UTILITIES
// ============================================================================

/**
 * Parse a CSV line handling quoted fields correctly
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current.trim())

  return fields
}

/**
 * Safely get a field value with fallback
 */
function getField(fields: string[], index: number, defaultValue = ''): string {
  if (index < 0 || index >= fields.length) return defaultValue
  return fields[index]?.trim() || defaultValue
}

/**
 * Parse an integer with fallback
 */
function parseIntSafe(value: string, defaultValue = 0): number {
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Parse a float with fallback
 */
function parseFloatSafe(value: string, defaultValue = 0): number {
  const parsed = parseFloat(value)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Parse a nullable integer
 */
function parseIntNullable(value: string): number | null {
  if (!value || value.trim() === '') return null
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? null : parsed
}

/**
 * Parse a nullable float
 */
function parseFloatNullable(value: string): number | null {
  if (!value || value.trim() === '') return null
  const parsed = parseFloat(value)
  return isNaN(parsed) ? null : parsed
}

// ============================================================================
// SURFACE & CONDITION PARSING
// ============================================================================

/**
 * Parse surface code to Surface type
 */
function parseSurface(code: string): Surface {
  const normalized = code.trim().toUpperCase()
  switch (normalized) {
    case 'T':
    case 'TURF':
    case 'TF':
      return 'turf'
    case 'S':
    case 'SYN':
    case 'SYNTHETIC':
    case 'A':
    case 'AW':
    case 'ALL-WEATHER':
      return 'synthetic'
    case 'AWT':
      return 'all-weather'
    case 'D':
    case 'DIRT':
    default:
      return 'dirt'
  }
}

/**
 * Parse track condition code
 */
function parseTrackCondition(code: string): TrackCondition {
  const normalized = code.trim().toUpperCase()
  switch (normalized) {
    case 'FT':
    case 'FAST':
      return 'fast'
    case 'GD':
    case 'GOOD':
      return 'good'
    case 'MY':
    case 'MUD':
    case 'MUDDY':
      return 'muddy'
    case 'SY':
    case 'SLP':
    case 'SLOPPY':
      return 'sloppy'
    case 'HY':
    case 'HEAVY':
      return 'heavy'
    case 'FM':
    case 'FIRM':
      return 'firm'
    case 'YL':
    case 'YIELDING':
      return 'yielding'
    case 'SF':
    case 'SOFT':
      return 'soft'
    default:
      return 'fast'
  }
}

/**
 * Parse race classification from race type code
 */
function parseRaceClassification(typeCode: string, conditions: string): RaceClassification {
  const code = typeCode.trim().toUpperCase()
  const condLower = conditions.toLowerCase()

  // Check for graded stakes
  if (code === 'G1' || condLower.includes('grade 1') || condLower.includes('(g1)')) {
    return 'stakes-graded-1'
  }
  if (code === 'G2' || condLower.includes('grade 2') || condLower.includes('(g2)')) {
    return 'stakes-graded-2'
  }
  if (code === 'G3' || condLower.includes('grade 3') || condLower.includes('(g3)')) {
    return 'stakes-graded-3'
  }

  // Check for stakes
  if (code === 'STK' || code === 'S' || condLower.includes('stakes')) {
    if (condLower.includes('listed')) return 'stakes-listed'
    return 'stakes'
  }

  // Check for handicap
  if (code === 'HCP' || code === 'H' || condLower.includes('handicap')) {
    return 'handicap'
  }

  // Check for allowance variants
  if (code === 'AOC' || condLower.includes('allowance optional claiming')) {
    return 'allowance-optional-claiming'
  }
  if (code === 'ALW' || code === 'A' || condLower.includes('allowance')) {
    return 'allowance'
  }

  // Check for starter allowance
  if (code === 'STA' || condLower.includes('starter allowance')) {
    return 'starter-allowance'
  }

  // Check for maiden variants
  if (code === 'MCL' || condLower.includes('maiden claiming')) {
    return 'maiden-claiming'
  }
  if (code === 'MSW' || code === 'M' || condLower.includes('maiden special weight')) {
    return 'maiden'
  }
  if (condLower.includes('maiden')) {
    return 'maiden'
  }

  // Check for claiming
  if (code === 'CLM' || code === 'C' || condLower.includes('claiming')) {
    return 'claiming'
  }

  return 'unknown'
}

// ============================================================================
// DISTANCE PARSING
// ============================================================================

/**
 * Parse distance to formatted string and furlongs
 */
function parseDistance(rawYards: string, rawFurlongs: string): { distance: string; furlongs: number; exact: string } {
  // Try furlongs first
  let furlongs = parseFloatSafe(rawFurlongs)

  // If furlongs not available, convert from yards
  if (!furlongs && rawYards) {
    const yards = parseFloatSafe(rawYards)
    if (yards > 0) {
      furlongs = yards / 220 // 220 yards per furlong
    }
  }

  if (!furlongs) {
    return { distance: 'Unknown', furlongs: 0, exact: 'Unknown' }
  }

  // Format distance string
  let distance: string
  let exact: string

  if (furlongs >= 8) {
    // Convert to miles
    const miles = furlongs / 8
    const wholeMiles = Math.floor(miles)
    const fractionalFurlongs = furlongs - wholeMiles * 8

    if (fractionalFurlongs === 0) {
      distance = `${wholeMiles} mile${wholeMiles !== 1 ? 's' : ''}`
      exact = distance
    } else if (fractionalFurlongs === 1) {
      distance = `${wholeMiles} 1/16 miles`
      exact = `${wholeMiles} 1/16 miles`
    } else if (fractionalFurlongs === 2) {
      distance = `${wholeMiles} 1/8 miles`
      exact = `${wholeMiles} 1/8 miles`
    } else if (fractionalFurlongs === 3) {
      distance = `${wholeMiles} 3/16 miles`
      exact = `${wholeMiles} 3/16 miles`
    } else if (fractionalFurlongs === 4) {
      distance = `${wholeMiles} 1/4 miles`
      exact = `${wholeMiles} 1/4 miles`
    } else if (fractionalFurlongs === 5) {
      distance = `${wholeMiles} 5/16 miles`
      exact = `${wholeMiles} 5/16 miles`
    } else if (fractionalFurlongs === 6) {
      distance = `${wholeMiles} 3/8 miles`
      exact = `${wholeMiles} 3/8 miles`
    } else if (fractionalFurlongs === 7) {
      distance = `${wholeMiles} 7/16 miles`
      exact = `${wholeMiles} 7/16 miles`
    } else {
      distance = `${miles.toFixed(2)} miles`
      exact = `${miles.toFixed(4)} miles`
    }
  } else {
    // Express in furlongs
    const wholeFurlongs = Math.floor(furlongs)
    const fractional = furlongs - wholeFurlongs

    if (fractional === 0) {
      distance = `${wholeFurlongs}f`
      exact = distance
    } else if (fractional === 0.5) {
      distance = `${wholeFurlongs} 1/2f`
      exact = distance
    } else {
      distance = `${furlongs.toFixed(1)}f`
      exact = `${furlongs.toFixed(2)}f`
    }
  }

  return { distance, furlongs, exact }
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
  const trimmed = raw.trim()

  // Empty or missing - return 0 (not an error, will be handled at race level)
  if (!trimmed) {
    return { odds: '', decimal: 0 }
  }

  // Normalize: remove extra spaces around dashes and slashes
  const normalized = trimmed.replace(/\s*[-\/]\s*/g, '-')

  // Handle "even" or "E" or "EVEN"
  if (normalized.toLowerCase() === 'even' || normalized.toLowerCase() === 'e') {
    return { odds: '1-1', decimal: 1 }
  }

  // Handle fractional odds (e.g., "5-1", "3-2", "9-5" after normalization)
  // Also handles "7/2" → "7-2" after normalization
  const fractionalMatch = normalized.match(/^(\d+)-(\d+)$/)
  if (fractionalMatch) {
    const num = parseInt(fractionalMatch[1], 10)
    const den = parseInt(fractionalMatch[2], 10)
    if (den > 0) {
      const decimal = num / den
      return { odds: `${num}-${den}`, decimal }
    }
  }

  // Handle decimal odds (e.g., "2.5", "3.5")
  // Check for decimal point to distinguish from whole numbers
  if (normalized.includes('.')) {
    const decimalValue = parseFloat(normalized)
    if (!isNaN(decimalValue) && decimalValue > 0) {
      // Convert decimal to fractional for display
      // e.g., 2.5 becomes "5-2" (2.5 = 5/2)
      // For simplicity, keep decimal display but store decimal value
      return { odds: normalized, decimal: decimalValue }
    }
  }

  // Handle whole number odds (e.g., "5", "10" = X-1 odds)
  const wholeNumber = parseInt(normalized, 10)
  if (!isNaN(wholeNumber) && wholeNumber > 0) {
    return { odds: `${wholeNumber}-1`, decimal: wholeNumber }
  }

  // Couldn't parse - return 0
  return { odds: trimmed, decimal: 0 }
}

// ============================================================================
// EQUIPMENT & MEDICATION PARSING
// ============================================================================

/**
 * Parse equipment string to structured Equipment object
 */
function parseEquipment(raw: string): Equipment {
  const normalized = raw.trim().toUpperCase()

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
  }

  if (!normalized) return equipment

  // Parse individual equipment codes
  equipment.blinkers = /\bB\b/.test(normalized) || normalized.includes('BLINKERS')
  equipment.blinkersOff = /\bBO\b/.test(normalized) || normalized.includes('BLINKERS OFF')
  equipment.frontBandages = /\bF\b/.test(normalized) || normalized.includes('FRONT BANDAGES')
  equipment.rearBandages = /\bR\b/.test(normalized) || normalized.includes('REAR BANDAGES')
  equipment.barShoes = /\bBAR\b/.test(normalized)
  equipment.mudCaulks = /\bMC\b/.test(normalized) || normalized.includes('MUD CAULKS')
  equipment.tongueTie = /\bTT\b/.test(normalized) || normalized.includes('TONGUE TIE')
  equipment.nasalStrip = /\bNS\b/.test(normalized) || normalized.includes('NASAL STRIP')
  equipment.shadowRoll = /\bSR\b/.test(normalized) || normalized.includes('SHADOW ROLL')
  equipment.cheekPieces = /\bCP\b/.test(normalized) || normalized.includes('CHEEK PIECES')

  // Check for first time indicators
  if (normalized.includes('1ST') || normalized.includes('FIRST')) {
    if (equipment.blinkers) equipment.firstTimeEquipment.push('blinkers')
    if (equipment.nasalStrip) equipment.firstTimeEquipment.push('nasal strip')
  }

  return equipment
}

/**
 * Parse medication string to structured Medication object
 */
function parseMedication(raw: string): Medication {
  const normalized = raw.trim().toUpperCase()

  const medication: Medication = {
    lasixFirstTime: false,
    lasix: false,
    lasixOff: false,
    bute: false,
    other: [],
    raw,
  }

  if (!normalized) return medication

  // Lasix indicators
  medication.lasix = /\bL\b/.test(normalized) || normalized.includes('LASIX')
  medication.lasixFirstTime = /\bL1\b/.test(normalized) || normalized.includes('FIRST TIME LASIX')
  medication.lasixOff = /\bLO\b/.test(normalized) || normalized.includes('LASIX OFF')

  // Bute
  medication.bute = /\bBU\b/.test(normalized) || normalized.includes('BUTE')

  return medication
}

// ============================================================================
// BREEDING PARSING
// ============================================================================

/**
 * Parse breeding/pedigree information
 */
function parseBreeding(fields: string[]): Breeding {
  return {
    sire: getField(fields, DRF_COLUMNS.SIRE.index, 'Unknown'),
    sireOfSire: '',
    dam: getField(fields, DRF_COLUMNS.DAM.index, 'Unknown'),
    damSire: getField(fields, DRF_COLUMNS.DAM_SIRE.index, 'Unknown'),
    breeder: getField(fields, DRF_COLUMNS.BREEDER.index, ''),
    whereBred: getField(fields, DRF_COLUMNS.WHERE_BRED.index, ''),
    studFee: null,
  }
}

// ============================================================================
// SEX PARSING
// ============================================================================

/**
 * Parse horse sex code to full name
 */
function parseSex(code: string): { sex: string; sexFull: string } {
  const normalized = code.trim().toLowerCase()

  switch (normalized) {
    case 'c':
      return { sex: 'c', sexFull: 'Colt' }
    case 'f':
      return { sex: 'f', sexFull: 'Filly' }
    case 'g':
      return { sex: 'g', sexFull: 'Gelding' }
    case 'h':
      return { sex: 'h', sexFull: 'Horse' }
    case 'm':
      return { sex: 'm', sexFull: 'Mare' }
    case 'r':
      return { sex: 'r', sexFull: 'Ridgling' }
    default:
      return { sex: normalized || 'u', sexFull: 'Unknown' }
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
  }
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
  }
}

/**
 * Parse past performance data from fields
 */
function parsePastPerformances(fields: string[], maxRaces = 10): PastPerformance[] {
  const performances: PastPerformance[] = []
  const ppStart = DRF_COLUMNS.PP_START
  const fieldsPerRace = DRF_COLUMNS.PP_FIELDS_PER_RACE

  for (let i = 0; i < maxRaces; i++) {
    const baseIndex = ppStart + i * fieldsPerRace

    // Check if we have data for this race
    const ppDate = getField(fields, baseIndex)
    if (!ppDate) break

    // Parse the race data
    const rawDistance = getField(fields, baseIndex + 2)
    const distData = parseDistance('', rawDistance)

    const pp: PastPerformance = {
      date: ppDate,
      track: getField(fields, baseIndex + 1, 'UNK'),
      trackName: '',
      raceNumber: parseIntSafe(getField(fields, baseIndex + 3), 0),
      distanceFurlongs: distData.furlongs,
      distance: distData.distance,
      surface: parseSurface(getField(fields, baseIndex + 4, 'D')),
      trackCondition: parseTrackCondition(getField(fields, baseIndex + 5, 'FT')),
      classification: parseRaceClassification(
        getField(fields, baseIndex + 6),
        getField(fields, baseIndex + 7)
      ),
      claimingPrice: parseIntNullable(getField(fields, baseIndex + 8)),
      purse: parseIntSafe(getField(fields, baseIndex + 9)),
      fieldSize: parseIntSafe(getField(fields, baseIndex + 10)),
      finishPosition: parseIntSafe(getField(fields, baseIndex + 11), 99),
      lengthsBehind: parseFloatSafe(getField(fields, baseIndex + 12)),
      lengthsAhead: parseFloatNullable(getField(fields, baseIndex + 13)),
      finalTime: parseFloatNullable(getField(fields, baseIndex + 14)),
      finalTimeFormatted: getField(fields, baseIndex + 15, ''),
      speedFigures: {
        beyer: parseIntNullable(getField(fields, baseIndex + 16)),
        timeformUS: parseIntNullable(getField(fields, baseIndex + 17)),
        equibase: parseIntNullable(getField(fields, baseIndex + 18)),
        trackVariant: parseIntNullable(getField(fields, baseIndex + 19)),
        dirtVariant: null,
        turfVariant: null,
      },
      runningLine: {
        start: parseIntNullable(getField(fields, baseIndex + 20)),
        quarterMile: parseIntNullable(getField(fields, baseIndex + 21)),
        quarterMileLengths: parseFloatNullable(getField(fields, baseIndex + 22)),
        halfMile: parseIntNullable(getField(fields, baseIndex + 23)),
        halfMileLengths: parseFloatNullable(getField(fields, baseIndex + 24)),
        threeQuarters: parseIntNullable(getField(fields, baseIndex + 25)),
        threeQuartersLengths: parseFloatNullable(getField(fields, baseIndex + 26)),
        stretch: parseIntNullable(getField(fields, baseIndex + 27)),
        stretchLengths: parseFloatNullable(getField(fields, baseIndex + 28)),
        finish: parseIntSafe(getField(fields, baseIndex + 11), 99),
        finishLengths: parseFloatSafe(getField(fields, baseIndex + 12)),
      },
      jockey: getField(fields, baseIndex + 29, 'Unknown'),
      weight: parseIntSafe(getField(fields, baseIndex + 30), 120),
      apprenticeAllowance: parseIntSafe(getField(fields, baseIndex + 31)),
      equipment: getField(fields, baseIndex + 32),
      medication: getField(fields, baseIndex + 33),
      winner: getField(fields, baseIndex + 34),
      secondPlace: getField(fields, baseIndex + 35),
      thirdPlace: getField(fields, baseIndex + 36),
      tripComment: getField(fields, baseIndex + 37),
      comment: getField(fields, baseIndex + 38),
      odds: parseFloatNullable(getField(fields, baseIndex + 39)),
      favoriteRank: parseIntNullable(getField(fields, baseIndex + 40)),
      wasClaimed: getField(fields, baseIndex + 41).toLowerCase() === 'y',
      claimedFrom: getField(fields, baseIndex + 42) || null,
      daysSinceLast: parseIntNullable(getField(fields, baseIndex + 43)),
    }

    performances.push(pp)
  }

  return performances
}

// ============================================================================
// WORKOUT PARSING
// ============================================================================

/**
 * Parse workout type code
 */
function parseWorkoutType(code: string): WorkoutType {
  const normalized = code.trim().toLowerCase()
  switch (normalized) {
    case 'b':
    case 'breeze':
    case 'breezing':
      return 'breeze'
    case 'h':
    case 'handily':
      return 'handily'
    case 'd':
    case 'driving':
      return 'driving'
    case 'e':
    case 'easy':
      return 'easy'
    default:
      return 'unknown'
  }
}

/**
 * Parse workout data from fields
 */
function parseWorkouts(fields: string[], maxWorkouts = 5): Workout[] {
  const workouts: Workout[] = []
  const wkStart = DRF_COLUMNS.WORKOUT_START
  const fieldsPerWork = DRF_COLUMNS.WORKOUT_FIELDS_PER_WORK

  for (let i = 0; i < maxWorkouts; i++) {
    const baseIndex = wkStart + i * fieldsPerWork

    // Check if we have data for this workout
    const wkDate = getField(fields, baseIndex)
    if (!wkDate) break

    const rawDistance = getField(fields, baseIndex + 2)
    const distData = parseDistance('', rawDistance)
    const ranking = getField(fields, baseIndex + 6)

    // Parse ranking (e.g., "2/35" means 2nd of 35)
    const rankMatch = ranking.match(/(\d+)\/(\d+)/)
    const rankNumber = rankMatch ? parseInt(rankMatch[1], 10) : null
    const totalWorks = rankMatch ? parseInt(rankMatch[2], 10) : null

    const workout: Workout = {
      date: wkDate,
      track: getField(fields, baseIndex + 1, 'UNK'),
      distanceFurlongs: distData.furlongs,
      distance: distData.distance,
      timeSeconds: parseFloatSafe(getField(fields, baseIndex + 3)),
      timeFormatted: getField(fields, baseIndex + 4, ''),
      type: parseWorkoutType(getField(fields, baseIndex + 5)),
      trackCondition: parseTrackCondition(getField(fields, baseIndex + 7, 'FT')),
      surface: parseSurface(getField(fields, baseIndex + 8, 'D')),
      ranking,
      rankNumber,
      totalWorks,
      isBullet: rankNumber === 1,
      fromGate: getField(fields, baseIndex + 9).toLowerCase().includes('g'),
      notes: '',
    }

    workouts.push(workout)
  }

  return workouts
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
  }
}

/**
 * Parse a single horse entry from CSV fields
 */
function parseHorseEntry(fields: string[], lineIndex: number): HorseEntry {
  const horse = createDefaultHorseEntry(lineIndex)

  // Basic identification
  horse.postPosition = parseIntSafe(
    getField(fields, DRF_COLUMNS.POST_POSITION.index),
    lineIndex + 1
  )
  horse.programNumber = horse.postPosition
  horse.entryIndicator = getField(fields, DRF_COLUMNS.ENTRY_INDICATOR.index)
  horse.horseName = getField(fields, DRF_COLUMNS.HORSE_NAME.index, `Horse ${lineIndex + 1}`)

  // Age, sex, color
  horse.age = parseIntSafe(getField(fields, DRF_COLUMNS.HORSE_AGE.index), 3)
  const sexData = parseSex(getField(fields, DRF_COLUMNS.HORSE_SEX.index))
  horse.sex = sexData.sex
  horse.sexFull = sexData.sexFull
  horse.color = getField(fields, DRF_COLUMNS.HORSE_COLOR.index)

  // Connections
  const jockeyLast = getField(fields, DRF_COLUMNS.JOCKEY_LAST.index)
  const jockeyFirst = getField(fields, DRF_COLUMNS.JOCKEY_FIRST.index)
  horse.jockeyName = jockeyFirst ? `${jockeyFirst} ${jockeyLast}`.trim() : jockeyLast || 'Unknown'

  const trainerLast = getField(fields, DRF_COLUMNS.TRAINER_LAST.index)
  const trainerFirst = getField(fields, DRF_COLUMNS.TRAINER_FIRST.index)
  horse.trainerName = trainerFirst
    ? `${trainerFirst} ${trainerLast}`.trim()
    : trainerLast || 'Unknown'

  horse.owner = getField(fields, DRF_COLUMNS.OWNER_NAME.index)

  // Weight and equipment
  horse.weight = parseIntSafe(getField(fields, DRF_COLUMNS.WEIGHT.index), 120)
  horse.apprenticeAllowance = parseIntSafe(
    getField(fields, DRF_COLUMNS.APPRENTICE_ALLOWANCE.index)
  )
  horse.equipment = parseEquipment(getField(fields, DRF_COLUMNS.EQUIPMENT.index))
  horse.medication = parseMedication(getField(fields, DRF_COLUMNS.MEDICATION.index))

  // Odds
  const oddsData = parseOdds(getField(fields, DRF_COLUMNS.MORNING_LINE.index))
  horse.morningLineOdds = oddsData.odds
  horse.morningLineDecimal = oddsData.decimal

  // Breeding
  horse.breeding = parseBreeding(fields)

  // Statistics
  horse.lifetimeStarts = parseIntSafe(getField(fields, DRF_COLUMNS.LIFETIME_STARTS.index))
  horse.lifetimeWins = parseIntSafe(getField(fields, DRF_COLUMNS.LIFETIME_WINS.index))
  horse.lifetimePlaces = parseIntSafe(getField(fields, DRF_COLUMNS.LIFETIME_PLACES.index))
  horse.lifetimeShows = parseIntSafe(getField(fields, DRF_COLUMNS.LIFETIME_SHOWS.index))
  horse.lifetimeEarnings = parseIntSafe(getField(fields, DRF_COLUMNS.LIFETIME_EARNINGS.index))

  horse.currentYearStarts = parseIntSafe(getField(fields, DRF_COLUMNS.CURRENT_YEAR_STARTS.index))
  horse.currentYearWins = parseIntSafe(getField(fields, DRF_COLUMNS.CURRENT_YEAR_WINS.index))
  horse.currentYearPlaces = parseIntSafe(getField(fields, DRF_COLUMNS.CURRENT_YEAR_PLACES.index))
  horse.currentYearShows = parseIntSafe(getField(fields, DRF_COLUMNS.CURRENT_YEAR_SHOWS.index))
  horse.currentYearEarnings = parseIntSafe(
    getField(fields, DRF_COLUMNS.CURRENT_YEAR_EARNINGS.index)
  )

  // Speed figures
  horse.bestBeyer = parseIntNullable(getField(fields, DRF_COLUMNS.BEST_BEYER.index))
  horse.averageBeyer = parseIntNullable(getField(fields, DRF_COLUMNS.AVERAGE_BEYER.index))
  horse.lastBeyer = parseIntNullable(getField(fields, DRF_COLUMNS.LAST_BEYER.index))

  // Days since last race
  horse.daysSinceLastRace = parseIntNullable(getField(fields, DRF_COLUMNS.DAYS_SINCE_LAST.index))

  // Claiming price
  horse.claimingPrice = parseIntNullable(getField(fields, DRF_COLUMNS.CLAIMING_PRICE.index))

  // Past performances
  horse.pastPerformances = parsePastPerformances(fields)

  // Workouts
  horse.workouts = parseWorkouts(fields)

  // Store raw line for debugging
  horse.rawLine = fields.slice(0, 50).join(',')

  return horse
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
  }
}

/**
 * Parse race header from first horse entry fields
 */
function parseRaceHeader(fields: string[]): RaceHeader {
  const header = createDefaultRaceHeader()

  header.trackCode = getField(fields, DRF_COLUMNS.TRACK_CODE.index, 'UNK').substring(0, 3)
  header.raceDate = getField(fields, DRF_COLUMNS.RACE_DATE.index)
  header.raceDateRaw = header.raceDate.replace(/\D/g, '')
  header.raceNumber = parseIntSafe(getField(fields, DRF_COLUMNS.RACE_NUMBER.index), 1)
  header.programNumber = header.raceNumber

  // Distance
  const distData = parseDistance(
    getField(fields, DRF_COLUMNS.DISTANCE.index),
    getField(fields, DRF_COLUMNS.DISTANCE_FURLONGS.index)
  )
  header.distance = distData.distance
  header.distanceExact = distData.exact
  header.distanceFurlongs = distData.furlongs

  // Surface and conditions
  header.surface = parseSurface(getField(fields, DRF_COLUMNS.SURFACE.index, 'D'))
  header.trackCondition = parseTrackCondition(
    getField(fields, DRF_COLUMNS.TRACK_CONDITION.index, 'FT')
  )

  // Classification
  const raceType = getField(fields, DRF_COLUMNS.RACE_TYPE.index)
  const conditions = getField(fields, DRF_COLUMNS.RACE_CONDITIONS.index)
  header.classification = parseRaceClassification(raceType, conditions)
  header.raceType = raceType
  header.conditions = conditions

  // Restrictions
  header.ageRestriction = getField(fields, DRF_COLUMNS.AGE_RESTRICTION.index)
  header.sexRestriction = getField(fields, DRF_COLUMNS.SEX_RESTRICTION.index)

  // Purse
  header.purse = parseIntSafe(getField(fields, DRF_COLUMNS.PURSE.index))
  header.purseFormatted = `$${header.purse.toLocaleString()}`

  // Claiming price
  const claimPrice = parseIntNullable(getField(fields, DRF_COLUMNS.CLAIMING_PRICE.index))
  if (claimPrice) {
    header.claimingPriceMin = claimPrice
    header.claimingPriceMax = claimPrice
  }

  // Stakes info
  header.raceName = getField(fields, DRF_COLUMNS.RACE_NAME.index) || null
  const grade = parseIntNullable(getField(fields, DRF_COLUMNS.RACE_GRADE.index))
  if (grade && grade >= 1 && grade <= 3) {
    header.grade = grade
  }

  // Post time
  header.postTime = getField(fields, DRF_COLUMNS.POST_TIME.index)

  return header
}

// ============================================================================
// PROGRESS CALLBACK TYPE
// ============================================================================

export type ProgressCallback = (message: DRFWorkerProgressMessage) => void

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
  const startTime = performance.now()
  const warnings: string[] = []
  const errors: string[] = []

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
      })
    }
  }

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
  })

  sendProgress(0, 'initializing', 'Initializing parser...')

  // =====================================================================
  // STEP 1: Validate file content before parsing
  // =====================================================================
  try {
    validateFileContent(content, filename)
  } catch (error) {
    // Log the error and return a friendly result
    if (error instanceof DRFParseError || error instanceof FileFormatError) {
      logger.logError(error, { fileName: filename, component: 'DRFParser' })
      return createErrorResult(error.getUserMessage())
    }
    // Unknown error type
    const msg = error instanceof Error ? error.message : 'File validation failed'
    logger.logError(new Error(msg), { fileName: filename, component: 'DRFParser' })
    return createErrorResult(msg)
  }

  // Split into lines
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const totalLines = lines.length

  // =========================================================================
  // DIAGNOSTIC LOGGING - TEMPORARY DEBUG CODE
  // Purpose: Identify correct morning line odds column position
  // =========================================================================
  if (totalLines > 0) {
    // Part 1: Log first raw CSV line (unsplit)
    console.log('\n========== DRF DIAGNOSTIC: RAW DATA DUMP ==========')
    console.log('First row (raw, unsplit):')
    console.log(lines[0].substring(0, 500) + '...[truncated]')
    console.log('')

    // Parse first line to get column data
    const firstLineFields = parseCSVLine(lines[0])

    // Part 2: Log columns 20-50 for first horse
    console.log('Columns 20-50 for first horse:')
    for (let colIdx = 20; colIdx <= 50 && colIdx < firstLineFields.length; colIdx++) {
      const value = firstLineFields[colIdx] || '[empty]'
      console.log(`Col ${colIdx}: [${value}]`)
    }
    console.log('')

    // Part 3: Log column 22 value for first 3 horses
    console.log('Column 22 (current morning line index) for first 3 horses:')
    for (let horseIdx = 0; horseIdx < Math.min(3, lines.length); horseIdx++) {
      const horseFields = parseCSVLine(lines[horseIdx])
      const horseName = horseFields[5] || 'Unknown'
      const col22Value = horseFields[22] || '[empty]'
      console.log(`Horse ${horseIdx + 1} (${horseName}): Col 22 = [${col22Value}]`)
    }
    console.log('')

    // Part 4: Search columns 0-100 for odds-like patterns
    // Odds patterns: "5-2", "3-1", "7/2", "10-1", "4-5", etc.
    const oddsPattern = /^\d{1,3}[-\/]\d{1,2}$/
    console.log('Searching columns 0-100 for odds-like values (X-X or X/X pattern):')
    let foundOddsColumns: { col: number; value: string }[] = []

    for (let colIdx = 0; colIdx < Math.min(100, firstLineFields.length); colIdx++) {
      const value = (firstLineFields[colIdx] || '').trim()
      if (value && oddsPattern.test(value)) {
        foundOddsColumns.push({ col: colIdx, value })
        console.log(`Possible odds found at column ${colIdx}: [${value}]`)
      }
    }

    if (foundOddsColumns.length === 0) {
      console.log('No odds-like values found in columns 0-100 with pattern X-X or X/X')

      // Also check for decimal odds or whole numbers that could be odds
      console.log('\nExpanded search for decimal/whole number odds patterns:')
      const expandedPattern = /^(\d{1,2}(\.\d+)?|even|e)$/i
      for (let colIdx = 0; colIdx < Math.min(100, firstLineFields.length); colIdx++) {
        const value = (firstLineFields[colIdx] || '').trim()
        if (value && expandedPattern.test(value) && parseFloat(value) > 0 && parseFloat(value) < 100) {
          console.log(`Possible decimal/whole odds at column ${colIdx}: [${value}]`)
        }
      }
    }

    console.log('\n========== END DRF DIAGNOSTIC ==========\n')
  }
  // =========================================================================
  // END DIAGNOSTIC LOGGING
  // =========================================================================

  if (totalLines === 0) {
    const emptyError = new DRFParseError('EMPTY_FILE', 'No data lines found in file', {
      context: { filename },
    })
    logger.logWarning('Empty file uploaded', { fileName: filename })
    return createErrorResult(emptyError.getUserMessage())
  }

  sendProgress(5, 'detecting-format', 'Detecting file format...')

  // Detect format: CSV (has commas) or fixed-width
  const isCSV = lines[0].includes(',')
  const format = isCSV ? 'csv' : 'fixed-width'

  sendProgress(10, 'extracting-races', 'Extracting race data...')

  // Group lines by race
  const racesMap = new Map<string, { header: RaceHeader; horses: HorseEntry[]; warnings: string[]; errors: string[] }>()
  let linesProcessed = 0
  let linesSkipped = 0
  let totalHorses = 0
  let totalPastPerformances = 0
  let totalWorkouts = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    // Update progress periodically
    if (i % 10 === 0) {
      const progress = 10 + Math.floor((i / lines.length) * 60)
      sendProgress(progress, 'parsing-horses', `Parsing horse ${i + 1} of ${lines.length}...`, {
        currentHorse: i + 1,
        totalHorses: lines.length,
      })
    }

    // =====================================================================
    // STEP 2: Validate each line before parsing
    // =====================================================================
    const lineValidation = validateLine(line, lineNumber, filename)
    if (lineValidation.warning) {
      warnings.push(lineValidation.warning)
    }
    if (!lineValidation.isValid) {
      linesSkipped++
      continue
    }

    if (isCSV) {
      // Use safe CSV parsing with error handling
      const parseResult = safeParseCSVLine(line, lineNumber, filename)
      if (!parseResult) {
        linesSkipped++
        continue
      }

      const { fields, warning: parseWarning } = parseResult
      if (parseWarning) {
        warnings.push(parseWarning)
      }

      if (fields.length < 5) {
        warnings.push(`Line ${lineNumber}: Insufficient fields (${fields.length}), skipping`)
        linesSkipped++
        continue
      }

      // Validate field count consistency
      if (lineValidation.fieldCount < MIN_EXPECTED_FIELDS) {
        // Log but continue - partial data might still be usable
        logger.logDebug(`Line ${lineNumber} has fewer fields than expected`, {
          fileName: filename,
          lineNumber,
          fieldCount: fields.length,
          expectedMin: MIN_EXPECTED_FIELDS,
        })
      }

      // Extract race key with defensive null checks
      const trackCode = getField(fields, DRF_COLUMNS.TRACK_CODE.index, 'UNK').substring(0, 3)
      const raceDate = getField(fields, DRF_COLUMNS.RACE_DATE.index)
      const raceNumber = parseIntSafe(getField(fields, DRF_COLUMNS.RACE_NUMBER.index), 0)
      const raceKey = `${trackCode}-${raceDate}-${raceNumber}`

      if (!racesMap.has(raceKey)) {
        try {
          const header = parseRaceHeader(fields)
          racesMap.set(raceKey, {
            header,
            horses: [],
            warnings: [],
            errors: [],
          })
        } catch (headerError) {
          logger.logWarning(`Failed to parse race header at line ${lineNumber}`, {
            fileName: filename,
            lineNumber,
            error: headerError instanceof Error ? headerError.message : String(headerError),
          })
          warnings.push(`Line ${lineNumber}: Failed to parse race header`)
          linesSkipped++
          continue
        }
      }

      // Parse horse entry with error handling
      if (fields.length >= 6) {
        try {
          const race = racesMap.get(raceKey)!
          const horseEntry = parseHorseEntry(fields, race.horses.length)
          race.horses.push(horseEntry)
          totalHorses++
          totalPastPerformances += horseEntry.pastPerformances.length
          totalWorkouts += horseEntry.workouts.length
        } catch (horseError) {
          logger.logWarning(`Failed to parse horse entry at line ${lineNumber}`, {
            fileName: filename,
            lineNumber,
            error: horseError instanceof Error ? horseError.message : String(horseError),
          })
          warnings.push(`Line ${lineNumber}: Failed to parse horse entry`)
        }
      }

      linesProcessed++
    } else {
      // Fixed-width format parsing (simplified)
      if (line.length < 20) {
        linesSkipped++
        continue
      }

      // For fixed-width, parse as if it's a delimited file with spaces
      try {
        const fields = line.split(/\s+/)
        const trackCode = fields[0]?.substring(0, 3) || 'UNK'
        const raceDate = fields[1] || ''
        const raceNumber = parseIntSafe(fields[2] || '1', 1)
        const raceKey = `${trackCode}-${raceDate}-${raceNumber}`

        if (!racesMap.has(raceKey)) {
          racesMap.set(raceKey, {
            header: createDefaultRaceHeader(),
            horses: [],
            warnings: [],
            errors: [],
          })
          const race = racesMap.get(raceKey)!
          race.header.trackCode = trackCode
          race.header.raceDate = raceDate
          race.header.raceNumber = raceNumber
        }

        const race = racesMap.get(raceKey)!
        const horseEntry = createDefaultHorseEntry(race.horses.length)
        horseEntry.horseName = fields[3] || `Horse ${race.horses.length + 1}`
        race.horses.push(horseEntry)
        totalHorses++

        linesProcessed++
      } catch (fixedWidthError) {
        logger.logWarning(`Failed to parse fixed-width line ${lineNumber}`, {
          fileName: filename,
          lineNumber,
          error: fixedWidthError instanceof Error ? fixedWidthError.message : String(fixedWidthError),
        })
        warnings.push(`Line ${lineNumber}: Failed to parse`)
        linesSkipped++
      }
    }
  }

  sendProgress(75, 'validating-data', 'Validating parsed data...')

  // Update field sizes and validate races
  racesMap.forEach((race) => {
    race.header.fieldSize = race.horses.length

    // Validate minimum horses
    if (race.horses.length < 2) {
      race.warnings.push(`Race ${race.header.raceNumber}: Only ${race.horses.length} horse(s) found`)
    }

    // Track horses with missing data for consolidated warnings
    let missingNameCount = 0
    let missingOddsCount = 0

    // Check for missing data
    race.horses.forEach((horse, idx) => {
      if (!horse.horseName || horse.horseName.startsWith('Horse ')) {
        missingNameCount++
        race.warnings.push(`Horse #${idx + 1}: Missing horse name`)
      }
      if (horse.morningLineDecimal === 0) {
        missingOddsCount++
      }
    })

    // Consolidate morning line odds warnings (one per race, not per horse)
    if (missingOddsCount > 0 && race.horses.length > 0) {
      if (missingOddsCount === race.horses.length) {
        // ALL horses missing odds - this is an error condition
        race.errors.push(`Race ${race.header.raceNumber}: All ${missingOddsCount} horses missing morning line odds`)
      } else {
        // Some horses missing odds - just a warning
        race.warnings.push(`Race ${race.header.raceNumber}: ${missingOddsCount} horse(s) missing morning line odds`)
      }
    }
  })

  sendProgress(90, 'finalizing', 'Finalizing results...')

  // Convert map to array and sort by race number
  const races: ParsedRace[] = Array.from(racesMap.values())
    .map((race) => ({
      header: race.header,
      horses: race.horses.sort((a, b) => a.postPosition - b.postPosition),
      warnings: race.warnings,
      errors: race.errors,
    }))
    .sort((a, b) => a.header.raceNumber - b.header.raceNumber)

  const parseTimeMs = performance.now() - startTime

  sendProgress(100, 'complete', 'Parsing complete!')

  // Collect all warnings from individual races
  races.forEach((race) => {
    warnings.push(...race.warnings)
  })

  // Final validation check
  const isValid = errors.length === 0 && races.length > 0

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
    })
  } else {
    logger.logWarning('DRF parsing completed with issues', {
      fileName: filename,
      isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
      racesFound: races.length,
      linesProcessed,
      linesSkipped,
    })
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
  }
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
}
