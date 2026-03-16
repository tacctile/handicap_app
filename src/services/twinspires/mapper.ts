/**
 * TwinSpires Data Mapper
 *
 * Maps TwinSpires API response data to internal data structures.
 * Handles odds mapping, scratch detection, track validation,
 * and URL parsing.
 */

import type { ParsedDRFFile } from '../../types/drf';
import type { TwinSpiresEntry } from './types';

// ============================================================================
// ODDS MAPPING
// ============================================================================

/**
 * Map TwinSpires entries to a programNumber -> liveOdds record.
 * Skips entries with null liveOdds.
 *
 * @param entries - Array of TwinSpires entries
 * @returns Record mapping programNumber string to liveOdds string
 */
export function mapTwinSpiresEntriesToOdds(entries: TwinSpiresEntry[]): Record<string, string> {
  const oddsMap: Record<string, string> = {};

  for (const entry of entries) {
    if (entry.liveOdds !== null) {
      oddsMap[entry.programNumber] = entry.liveOdds;
    }
  }

  return oddsMap;
}

// ============================================================================
// SCRATCH DETECTION
// ============================================================================

/**
 * Extract program numbers of scratched horses from TwinSpires entries.
 *
 * @param entries - Array of TwinSpires entries
 * @returns Set of programNumber strings for scratched horses
 */
export function mapTwinSpiresEntriesToScratches(entries: TwinSpiresEntry[]): Set<string> {
  const scratched = new Set<string>();

  for (const entry of entries) {
    if (entry.scratched) {
      scratched.add(entry.programNumber);
    }
  }

  return scratched;
}

// ============================================================================
// TRACK VALIDATION
// ============================================================================

/**
 * Normalize a horse name for loose matching.
 * Lowercases, trims whitespace, removes common suffixes/punctuation.
 */
function normalizeHorseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Validate that TwinSpires data matches the DRF parsed data for a given race.
 * Confirms at least 60% of horse names loosely match between the two sources.
 * This prevents applying the wrong track's data.
 *
 * @param twinSpiresData - Array of TwinSpires entries for the race
 * @param parsedDRF - The full parsed DRF file
 * @param raceIndex - Index of the race within parsedDRF.races
 * @returns true if at least 60% of names match
 */
export function validateTrackMatch(
  twinSpiresData: TwinSpiresEntry[],
  parsedDRF: ParsedDRFFile,
  raceIndex: number
): boolean {
  const race = parsedDRF.races[raceIndex];
  if (!race || !race.horses.length || !twinSpiresData.length) {
    return false;
  }

  // Build normalized name set from TwinSpires data
  const tsNames = new Set(twinSpiresData.map((entry) => normalizeHorseName(entry.name)));

  // Count matches from DRF horses
  let matchCount = 0;
  for (const horse of race.horses) {
    const normalizedDrfName = normalizeHorseName(horse.horseName);
    if (tsNames.has(normalizedDrfName)) {
      matchCount++;
    }
  }

  // Use the smaller dataset as the denominator to be fair
  const denominator = Math.min(race.horses.length, twinSpiresData.length);
  if (denominator === 0) return false;

  const matchRatio = matchCount / denominator;
  return matchRatio >= 0.6;
}

// ============================================================================
// URL PARSING
// ============================================================================

/**
 * URL pattern for TwinSpires race entries.
 * Example: https://www.twinspires.com/adw/todays-tracks/CD/T/races/3/entries?affid=2800
 */
const TWINSPIRES_URL_REGEX = /\/todays-tracks\/([^/]+)\/([^/]+)\/races\/(\d+)\/entries/;

/**
 * Parse a TwinSpires race URL and extract the variable segments.
 *
 * @param url - TwinSpires entries URL
 * @returns Extracted trackCode, raceType, raceNumber or null if parsing fails
 */
export function extractTrackInfoFromUrl(
  url: string
): { trackCode: string; raceType: string; raceNumber: number } | null {
  const match = url.match(TWINSPIRES_URL_REGEX);
  if (!match) return null;

  const trackCode = decodeURIComponent(match[1]);
  const raceType = decodeURIComponent(match[2]);
  const raceNumber = parseInt(match[3], 10);

  if (isNaN(raceNumber)) return null;

  return { trackCode, raceType, raceNumber };
}
