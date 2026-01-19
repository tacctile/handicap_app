/**
 * Odds Parser Module
 *
 * Comprehensive parser for various odds formats commonly used in horse racing.
 * Handles fractional (5-1, 5/1), American (+400, -150), decimal (5.00),
 * and special cases (even).
 *
 * @module scoring/oddsParser
 */

import {
  fractionalToDecimalOdds,
  americanToDecimalOdds,
  decimalToFractional,
  decimalToAmerican,
} from './marketNormalization';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Supported odds formats
 */
export type OddsFormat = 'decimal' | 'fractional' | 'american';

/**
 * Parsed odds result
 */
export interface ParsedOdds {
  /** Decimal odds value (primary internal format) */
  decimalOdds: number;
  /** Whether parsing was successful */
  isValid: boolean;
  /** Original input string */
  originalInput: string;
  /** Detected format of the input */
  detectedFormat: OddsFormat | 'unknown';
  /** Error message if parsing failed */
  error?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Minimum valid decimal odds (just over even money - 1/100)
 */
const MIN_ODDS = 1.01;

/**
 * Maximum valid decimal odds (reasonable cap for horse racing)
 */
const MAX_ODDS = 500;

/**
 * Validate decimal odds are within acceptable range.
 *
 * @param decimalOdds - Odds to validate
 * @returns True if odds are valid
 *
 * @example
 * validateOdds(4.0)   // Returns true
 * validateOdds(1.01)  // Returns true
 * validateOdds(0.5)   // Returns false (below 1.0)
 * validateOdds(600)   // Returns false (above 500)
 */
export function validateOdds(decimalOdds: number): boolean {
  if (!Number.isFinite(decimalOdds)) {
    return false;
  }

  return decimalOdds >= MIN_ODDS && decimalOdds <= MAX_ODDS;
}

// ============================================================================
// PARSING
// ============================================================================

/**
 * Parse an odds string in any common format to decimal odds.
 *
 * Handles:
 * - Fractional: "5-1", "5/1", "5:1"
 * - Decimal: "5.00", "6.0"
 * - American: "+400", "-150"
 * - Special: "even", "evn", "EVEN"
 *
 * @param oddsStr - Odds string in any format
 * @returns Decimal odds, or 2.0 (even money) if parsing fails
 *
 * @example
 * parseOddsString("5-1")    // Returns 6.0
 * parseOddsString("5/1")    // Returns 6.0
 * parseOddsString("5:1")    // Returns 6.0
 * parseOddsString("6.0")    // Returns 6.0
 * parseOddsString("+400")   // Returns 5.0
 * parseOddsString("-150")   // Returns 1.667
 * parseOddsString("even")   // Returns 2.0
 */
export function parseOddsString(oddsStr: string): number {
  const result = parseOddsWithDetails(oddsStr);
  return result.decimalOdds;
}

/**
 * Parse odds string with detailed result including validation info.
 *
 * @param oddsStr - Odds string in any format
 * @returns ParsedOdds object with full details
 */
export function parseOddsWithDetails(oddsStr: string): ParsedOdds {
  // Handle null/undefined/empty
  if (!oddsStr || typeof oddsStr !== 'string') {
    return {
      decimalOdds: 2.0,
      isValid: false,
      originalInput: String(oddsStr ?? ''),
      detectedFormat: 'unknown',
      error: 'Empty or invalid input',
    };
  }

  const cleaned = oddsStr.trim().toUpperCase();

  // Handle empty after trim
  if (!cleaned) {
    return {
      decimalOdds: 2.0,
      isValid: false,
      originalInput: oddsStr,
      detectedFormat: 'unknown',
      error: 'Empty input after trimming',
    };
  }

  // Handle "EVEN" / "EVN" / "EV"
  if (cleaned === 'EVEN' || cleaned === 'EVN' || cleaned === 'EV') {
    return {
      decimalOdds: 2.0,
      isValid: true,
      originalInput: oddsStr,
      detectedFormat: 'fractional',
    };
  }

  // Try American format first (+XXX or -XXX)
  if (cleaned.startsWith('+') || (cleaned.startsWith('-') && !cleaned.includes('/'))) {
    const americanResult = tryParseAmerican(cleaned, oddsStr);
    if (americanResult) return americanResult;
  }

  // Try fractional format (X-Y, X/Y, X:Y)
  const fractionalMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*[-/:]\s*(\d+(?:\.\d+)?)$/);
  if (fractionalMatch) {
    const num = parseFloat(fractionalMatch[1] ?? '0');
    const denom = parseFloat(fractionalMatch[2] ?? '1');

    if (Number.isFinite(num) && Number.isFinite(denom) && denom > 0) {
      const decimal = fractionalToDecimalOdds(num, denom);

      if (validateOdds(decimal)) {
        return {
          decimalOdds: decimal,
          isValid: true,
          originalInput: oddsStr,
          detectedFormat: 'fractional',
        };
      }
    }
  }

  // Try plain number (could be decimal or shorthand for X-1)
  const plainNum = parseFloat(cleaned);
  if (Number.isFinite(plainNum)) {
    // If it's already a valid decimal odds format (>= 1.01)
    if (plainNum >= 1.01 && plainNum <= MAX_ODDS) {
      // Heuristic: if >= 2.0, treat as decimal; otherwise, treat as X-1
      if (plainNum >= 2.0) {
        return {
          decimalOdds: plainNum,
          isValid: true,
          originalInput: oddsStr,
          detectedFormat: 'decimal',
        };
      }
    }

    // If it's a small integer (1-99), likely meant as X-1 odds
    if (plainNum >= 1 && plainNum < 100) {
      const decimal = plainNum + 1; // Convert X-1 shorthand to decimal
      if (validateOdds(decimal)) {
        return {
          decimalOdds: decimal,
          isValid: true,
          originalInput: oddsStr,
          detectedFormat: 'fractional', // Interpreted as fractional shorthand
        };
      }
    }

    // If larger than 100, might already be decimal
    if (plainNum > 1.0 && plainNum <= MAX_ODDS) {
      return {
        decimalOdds: plainNum,
        isValid: true,
        originalInput: oddsStr,
        detectedFormat: 'decimal',
      };
    }
  }

  // If all parsing fails, return default
  return {
    decimalOdds: 2.0,
    isValid: false,
    originalInput: oddsStr,
    detectedFormat: 'unknown',
    error: 'Could not parse odds format',
  };
}

/**
 * Try to parse as American odds format
 */
function tryParseAmerican(cleaned: string, originalInput: string): ParsedOdds | null {
  // +XXX format (underdog)
  if (cleaned.startsWith('+')) {
    const value = parseFloat(cleaned.substring(1));
    if (Number.isFinite(value) && value > 0) {
      const decimal = americanToDecimalOdds(value);
      if (validateOdds(decimal)) {
        return {
          decimalOdds: decimal,
          isValid: true,
          originalInput,
          detectedFormat: 'american',
        };
      }
    }
  }

  // -XXX format (favorite)
  if (cleaned.startsWith('-')) {
    const value = parseFloat(cleaned.substring(1));
    if (Number.isFinite(value) && value > 0) {
      const decimal = americanToDecimalOdds(-value);
      if (validateOdds(decimal)) {
        return {
          decimalOdds: decimal,
          isValid: true,
          originalInput,
          detectedFormat: 'american',
        };
      }
    }
  }

  return null;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format decimal odds for display in specified format.
 *
 * @param decimalOdds - Decimal odds to format
 * @param format - Target format ('decimal', 'fractional', or 'american')
 * @returns Formatted odds string
 *
 * @example
 * formatOddsDisplay(6.0, 'fractional')  // Returns "5-1"
 * formatOddsDisplay(6.0, 'decimal')     // Returns "6.00"
 * formatOddsDisplay(6.0, 'american')    // Returns "+500"
 * formatOddsDisplay(1.67, 'american')   // Returns "-150"
 */
export function formatOddsDisplay(decimalOdds: number, format: OddsFormat): string {
  if (!Number.isFinite(decimalOdds) || decimalOdds < 1.0) {
    return 'N/A';
  }

  switch (format) {
    case 'decimal':
      return decimalOdds.toFixed(2);

    case 'fractional':
      return decimalToFractional(decimalOdds);

    case 'american':
      return decimalToAmerican(decimalOdds);

    default:
      return decimalOdds.toFixed(2);
  }
}

/**
 * Format odds with all three formats for comprehensive display.
 *
 * @param decimalOdds - Decimal odds to format
 * @returns Object with all format strings
 */
export function formatAllOddsFormats(decimalOdds: number): {
  decimal: string;
  fractional: string;
  american: string;
} {
  return {
    decimal: formatOddsDisplay(decimalOdds, 'decimal'),
    fractional: formatOddsDisplay(decimalOdds, 'fractional'),
    american: formatOddsDisplay(decimalOdds, 'american'),
  };
}

// ============================================================================
// BATCH PARSING
// ============================================================================

/**
 * Parse an array of odds strings to decimal odds.
 *
 * @param oddsStrings - Array of odds strings
 * @returns Array of decimal odds (invalid entries become 2.0)
 */
export function parseOddsArray(oddsStrings: string[]): number[] {
  return oddsStrings.map(parseOddsString);
}

/**
 * Parse odds array with validation results.
 *
 * @param oddsStrings - Array of odds strings
 * @returns Array of ParsedOdds objects
 */
export function parseOddsArrayWithDetails(oddsStrings: string[]): ParsedOdds[] {
  return oddsStrings.map(parseOddsWithDetails);
}

// ============================================================================
// DRF-SPECIFIC PARSING
// ============================================================================

/**
 * Parse DRF morning line format.
 *
 * DRF typically uses fractional format like "5-1" or "3-2".
 * May also include decimal points like "7.5-1".
 *
 * @param drfMorningLine - Morning line string from DRF file
 * @returns Decimal odds
 */
export function parseDrfMorningLine(drfMorningLine: string): number {
  // DRF morning line is typically fractional format
  return parseOddsString(drfMorningLine);
}

/**
 * Parse DRF tote odds format.
 *
 * Similar to morning line but may have different formatting.
 *
 * @param drfToteOdds - Tote odds string from DRF file
 * @returns Decimal odds
 */
export function parseDrfToteOdds(drfToteOdds: string): number {
  // Same parsing logic - DRF uses consistent fractional format
  return parseOddsString(drfToteOdds);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if an odds string looks like it needs parsing.
 *
 * Useful for determining if a value is already decimal.
 *
 * @param oddsStr - Value to check
 * @returns True if it appears to need parsing (contains non-numeric chars)
 */
export function needsParsing(oddsStr: string): boolean {
  if (!oddsStr || typeof oddsStr !== 'string') {
    return true;
  }

  const trimmed = oddsStr.trim();

  // If it contains separators or +/-, needs parsing
  if (/[-/+:]/.test(trimmed)) {
    return true;
  }

  // If it's "even", needs parsing
  if (/^(even|evn|ev)$/i.test(trimmed)) {
    return true;
  }

  // If it's just a number, might not need parsing
  const num = parseFloat(trimmed);
  return !Number.isFinite(num);
}

/**
 * Convert between odds formats.
 *
 * @param oddsStr - Odds string in any format
 * @param targetFormat - Desired output format
 * @returns Odds string in target format
 */
export function convertOddsFormat(oddsStr: string, targetFormat: OddsFormat): string {
  const decimal = parseOddsString(oddsStr);
  return formatOddsDisplay(decimal, targetFormat);
}

/**
 * Get implied probability from odds string.
 *
 * @param oddsStr - Odds string in any format
 * @returns Implied probability (0-1)
 */
export function oddsStringToImpliedProb(oddsStr: string): number {
  const decimal = parseOddsString(oddsStr);
  if (decimal <= 0) return 0;
  return 1 / decimal;
}
