/**
 * Breeding Data Extraction and Parsing
 *
 * Utilities for extracting and parsing breeding information from DRF data.
 * Handles various formats and edge cases including incomplete data.
 */

import type { BreedingParseResult } from './types';

// ============================================================================
// BREEDING STRING PARSING
// ============================================================================

/**
 * Parse a breeding line in DRF format
 *
 * Common DRF formats:
 * - "Horse Name (Sire - Dam, by Damsire)"
 * - "Sire - Dam, by Damsire"
 * - "Sire -- Dam"
 * - Various edge cases with missing components
 *
 * @param breedingLine - Raw breeding string from DRF
 * @returns Parsed breeding result with components
 */
export function parseBreedingLine(breedingLine: string): BreedingParseResult {
  const result: BreedingParseResult = {
    sire: null,
    dam: null,
    damsire: null,
    success: false,
    warnings: [],
    original: breedingLine,
  };

  if (!breedingLine || breedingLine.trim() === '') {
    result.warnings.push('Empty breeding line');
    return result;
  }

  const trimmed = breedingLine.trim();

  // Try to extract content from parentheses if present
  // Format: "Horse Name (Sire - Dam, by Damsire)"
  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  const content = parenMatch ? parenMatch[1] : trimmed;

  // Parse the breeding content
  return parseBreedingContent(content, result);
}

/**
 * Parse the breeding content (already extracted from parentheses if applicable)
 */
function parseBreedingContent(content: string, result: BreedingParseResult): BreedingParseResult {
  // Common patterns for breeding strings:
  // 1. "Sire - Dam, by Damsire"
  // 2. "Sire - Dam by Damsire"
  // 3. "Sire--Dam, by Damsire"
  // 4. "Sire - Dam"
  // 5. "Sire"

  // Normalize separators
  const normalized = content
    .replace(/\s*[-–—]+\s*/g, ' - ') // Normalize dashes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Try pattern 1 & 2: "Sire - Dam, by Damsire" or "Sire - Dam by Damsire"
  const fullPattern = /^(.+?)\s*-\s*(.+?)(?:,\s*by|\s+by)\s+(.+)$/i;
  const fullMatch = normalized.match(fullPattern);

  if (fullMatch) {
    result.sire = cleanName(fullMatch[1]);
    result.dam = cleanName(fullMatch[2]);
    result.damsire = cleanName(fullMatch[3]);
    result.success = true;
    return result;
  }

  // Try pattern 4: "Sire - Dam" (no damsire)
  const sireDamPattern = /^(.+?)\s*-\s*(.+)$/;
  const sireDamMatch = normalized.match(sireDamPattern);

  if (sireDamMatch) {
    result.sire = cleanName(sireDamMatch[1]);
    result.dam = cleanName(sireDamMatch[2]);
    result.warnings.push('No damsire found in breeding line');
    result.success = true;
    return result;
  }

  // Try pattern 5: Just sire name
  if (normalized.length > 0 && !normalized.includes('-')) {
    result.sire = cleanName(normalized);
    result.warnings.push('Only sire found in breeding line');
    result.success = true;
    return result;
  }

  result.warnings.push(`Unable to parse breeding line: "${content}"`);
  return result;
}

/**
 * Clean up a name extracted from breeding data
 */
function cleanName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[()[\]]/g, '')
    .replace(/^\d+\s*/, '') // Remove leading numbers
    .trim();
}

// ============================================================================
// COMMON SIRE DETECTION
// ============================================================================

/**
 * List of commonly known "unknown" or placeholder sire names
 */
const UNKNOWN_SIRE_NAMES = [
  'unknown',
  'unk',
  'unraced',
  'not recorded',
  'n/a',
  'na',
  '--',
  '-',
  '',
];

/**
 * Check if a sire name indicates unknown parentage
 */
export function isUnknownSire(sireName: string | null): boolean {
  if (!sireName) return true;
  const normalized = sireName.toLowerCase().trim();
  return UNKNOWN_SIRE_NAMES.includes(normalized) || normalized.length === 0;
}

/**
 * Check if a dam name indicates unknown parentage
 */
export function isUnknownDam(damName: string | null): boolean {
  if (!damName) return true;
  const normalized = damName.toLowerCase().trim();
  return UNKNOWN_SIRE_NAMES.includes(normalized) || normalized.length === 0;
}

// ============================================================================
// BREEDING INFO COMPLETENESS
// ============================================================================

/**
 * Check if breeding information is complete (has sire, dam, and damsire)
 */
export function isBreedingComplete(parseResult: BreedingParseResult): boolean {
  return (
    !isUnknownSire(parseResult.sire) &&
    !isUnknownDam(parseResult.dam) &&
    parseResult.damsire !== null &&
    parseResult.damsire.trim() !== ''
  );
}

/**
 * Check if breeding has at least sire and dam
 */
export function hasBasicBreeding(parseResult: BreedingParseResult): boolean {
  return !isUnknownSire(parseResult.sire) && !isUnknownDam(parseResult.dam);
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format breeding info for display
 */
export function formatBreedingDisplay(
  sire: string | null,
  dam: string | null,
  damsire: string | null
): string {
  const sireDisplay = sire && !isUnknownSire(sire) ? sire : 'Unknown';
  const damDisplay = dam && !isUnknownDam(dam) ? dam : 'Unknown';
  const damsireDisplay = damsire && damsire.trim() !== '' ? damsire : null;

  if (damsireDisplay) {
    return `${sireDisplay} - ${damDisplay}, by ${damsireDisplay}`;
  }
  return `${sireDisplay} - ${damDisplay}`;
}

/**
 * Format a name with proper capitalization
 */
export function formatProperName(name: string | null): string {
  if (!name) return 'Unknown';
  return name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// EXPERIENCE LEVEL UTILITIES
// ============================================================================

import { EXPERIENCE_THRESHOLDS, type ExperienceLevel } from './types';

/**
 * Determine experience level based on lifetime starts
 */
export function getExperienceLevel(lifetimeStarts: number): ExperienceLevel {
  if (lifetimeStarts === EXPERIENCE_THRESHOLDS.DEBUT) {
    return 'debut';
  }
  if (lifetimeStarts <= EXPERIENCE_THRESHOLDS.LIGHTLY_RACED_MAX) {
    return 'lightly_raced';
  }
  return 'experienced';
}

/**
 * Get a human-readable label for experience level
 */
export function getExperienceLabel(level: ExperienceLevel): string {
  switch (level) {
    case 'debut':
      return 'First-Time Starter';
    case 'lightly_raced':
      return 'Lightly Raced';
    case 'experienced':
      return 'Experienced';
  }
}

/**
 * Get detailed experience description
 */
export function getExperienceDescription(lifetimeStarts: number): string {
  if (lifetimeStarts === 0) {
    return 'Making career debut - no race experience';
  }
  if (lifetimeStarts === 1) {
    return 'Second lifetime start - limited data';
  }
  if (lifetimeStarts <= 3) {
    return `Only ${lifetimeStarts} lifetime starts - breeding analysis valuable`;
  }
  if (lifetimeStarts <= 7) {
    return `${lifetimeStarts} lifetime starts - still developing`;
  }
  return `${lifetimeStarts} lifetime starts - experienced runner`;
}

/**
 * Check if a horse qualifies for breeding analysis (lightly raced)
 */
export function qualifiesForBreedingAnalysis(lifetimeStarts: number): boolean {
  return lifetimeStarts <= EXPERIENCE_THRESHOLDS.LIGHTLY_RACED_MAX;
}

/**
 * Calculate breeding analysis weight based on experience
 * Returns a multiplier (0-1) for how much to weight breeding data
 */
export function getBreedingWeight(lifetimeStarts: number): number {
  if (lifetimeStarts === 0) {
    return 1.0; // 100% weight for debut horses
  }
  if (lifetimeStarts === 1) {
    return 0.85; // 85% weight after one start
  }
  if (lifetimeStarts <= 3) {
    return 0.7; // 70% weight for 2-3 starts
  }
  if (lifetimeStarts <= 5) {
    return 0.5; // 50% weight for 4-5 starts
  }
  if (lifetimeStarts <= 7) {
    return 0.3; // 30% weight for 6-7 starts
  }
  return 0; // No breeding weight for experienced horses
}
