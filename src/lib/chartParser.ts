/**
 * DRF Text Chart Parser
 *
 * Parses DRF Text Chart files (comma-delimited format from DRF subscription)
 * to extract official race results for backtesting algorithm predictions.
 *
 * File format:
 * - H record: Header with track/date metadata
 * - R record: Race information
 * - S record: Starter (horse) results
 * - E record: Exotic payoffs (not parsed, informational only)
 */

import { logger } from '../services/logging';
import type {
  ChartHeader,
  ChartRace,
  ChartStarter,
  ParsedChartFile,
  ChartParseWarning,
} from '../types/chart';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Record type identifiers */
const RECORD_TYPES = {
  HEADER: 'H',
  RACE: 'R',
  STARTER: 'S',
  EXOTIC: 'E',
} as const;

/** Scratch indicator in finish position */
const SCRATCH_POSITION = 99;

/** Surface code mapping */
const SURFACE_MAP: Record<string, 'dirt' | 'turf' | 'synthetic' | 'all-weather'> = {
  D: 'dirt',
  T: 'turf',
  S: 'synthetic',
  A: 'all-weather',
};

// ============================================================================
// CSV PARSING UTILITIES
// ============================================================================

/**
 * Parse a CSV line handling quoted fields with embedded commas
 * Uses native string methods per requirements (no external dependencies)
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote (double quote)
        currentField += '"';
        i += 2;
        continue;
      }
      // Toggle quote state
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (char === ',' && !inQuotes) {
      // End of field
      fields.push(currentField.trim());
      currentField = '';
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  // Add the last field
  fields.push(currentField.trim());

  return fields;
}

/**
 * Safely get a field value, returning empty string if index is out of bounds
 */
function getField(fields: string[], index: number): string {
  // Convert to 0-based index (requirements use 1-based field numbers)
  const zeroBasedIndex = index - 1;
  return zeroBasedIndex >= 0 && zeroBasedIndex < fields.length
    ? (fields[zeroBasedIndex] ?? '')
    : '';
}

/**
 * Parse a numeric field, returning null if invalid
 */
function parseNumber(value: string): number | null {
  if (!value || value.trim() === '' || value.trim() === ' ') {
    return null;
  }
  const cleaned = value.replace(/[,$]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse an integer field, returning 0 if invalid
 */
function parseInt(value: string, defaultValue: number = 0): number {
  if (!value || value.trim() === '' || value.trim() === ' ') {
    return defaultValue;
  }
  const cleaned = value.replace(/[,$]/g, '').trim();
  const num = Number.parseInt(cleaned, 10);
  return isNaN(num) ? defaultValue : num;
}

// ============================================================================
// RECORD PARSERS
// ============================================================================

/**
 * Parse header (H) record
 */
function parseHeaderRecord(fields: string[]): ChartHeader | null {
  if (fields.length < 7) {
    return null;
  }

  const countryCode = getField(fields, 2);
  const trackCode = getField(fields, 3);
  const raceDate = getField(fields, 4);
  const numberOfRaces = parseInt(getField(fields, 5));
  const trackName = getField(fields, 7);

  // Validate required fields
  if (!trackCode || !raceDate) {
    return null;
  }

  return {
    recordType: 'H',
    countryCode,
    trackCode,
    raceDate,
    numberOfRaces,
    trackName,
  };
}

/**
 * Parse race (R) record
 */
function parseRaceRecord(fields: string[]): Omit<ChartRace, 'starters'> | null {
  if (fields.length < 43) {
    return null;
  }

  const raceNumber = parseInt(getField(fields, 2));
  if (raceNumber === 0) {
    return null;
  }

  const breedCode = getField(fields, 3);
  const raceType = getField(fields, 4);

  // Distance in feet (field 30)
  const distanceRaw = getField(fields, 30);
  const distance = parseInt(distanceRaw);
  const distanceFurlongs = distance > 0 ? distance / 660 : 0;

  // Surface (field 32): D=Dirt, T=Turf
  const surfaceCode = getField(fields, 32);
  const surface = SURFACE_MAP[surfaceCode] ?? 'dirt';

  // Track condition (field 43)
  const trackCondition = getField(fields, 43);

  return {
    recordType: 'R',
    raceNumber,
    breedCode,
    raceType,
    distance,
    distanceFurlongs,
    surfaceCode,
    surface,
    trackCondition,
  };
}

/**
 * Parse starter (S) record
 */
function parseStarterRecord(fields: string[], lineNumber: number): ChartStarter | null {
  if (fields.length < 70) {
    return null;
  }

  const raceNumber = parseInt(getField(fields, 2));
  if (raceNumber === 0) {
    return null;
  }

  const horseId = getField(fields, 3);
  const horseName = getField(fields, 4);

  if (!horseName) {
    return null;
  }

  // Post position (field 42) and program number (field 43)
  const postPosition = parseInt(getField(fields, 42));
  const programNumber = getField(fields, 43);

  // Finish position (field 51)
  const finishPositionRaw = parseInt(getField(fields, 51), SCRATCH_POSITION);
  const isScratched = finishPositionRaw === SCRATCH_POSITION || programNumber === 'SCR';
  const finishPosition = isScratched ? SCRATCH_POSITION : finishPositionRaw;

  // Odds (field 37) - may be morning line or final odds
  const oddsRaw = getField(fields, 37);
  const odds = parseNumber(oddsRaw);

  // Win/Place/Show payoffs (fields 68-70)
  const winPayoff = parseNumber(getField(fields, 68));
  const placePayoff = parseNumber(getField(fields, 69));
  const showPayoff = parseNumber(getField(fields, 70));

  // Lengths behind (field 63) - may be text for winner
  const lengthsBehindRaw = getField(fields, 63);
  // Check if it looks like a number (lengths) vs trip notes
  const lengthsBehind = /^\d/.test(lengthsBehindRaw) ? parseNumber(lengthsBehindRaw) : null;

  // Jockey name (fields 25-26 based on sample analysis)
  const jockeyFirst = getField(fields, 25);
  const jockeyLast = getField(fields, 26);
  const jockeyName = [jockeyFirst, jockeyLast].filter(Boolean).join(' ').trim();

  // Trainer name (fields 30-32 based on sample analysis)
  const trainerFirst = getField(fields, 30);
  const trainerMiddle = getField(fields, 31);
  const trainerLast = getField(fields, 32);
  const trainerName = [trainerFirst, trainerMiddle, trainerLast].filter(Boolean).join(' ').trim();

  return {
    recordType: 'S',
    raceNumber,
    horseId,
    horseName,
    programNumber,
    postPosition,
    finishPosition,
    isScratched,
    odds,
    winPayoff,
    placePayoff,
    showPayoff,
    lengthsBehind,
    jockeyName,
    trainerName,
    rawLine: lineNumber > 0 ? `Line ${lineNumber}` : undefined,
  };
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse a DRF Text Chart file content
 *
 * @param content - Raw file content
 * @param filename - Source filename for reference
 * @returns ParsedChartFile with header, races, and any warnings
 */
export function parseChartFile(content: string, filename: string): ParsedChartFile {
  const warnings: ChartParseWarning[] = [];
  const races: Map<number, ChartRace> = new Map();
  let header: ChartHeader | null = null;

  // Validate input
  if (!content || content.trim().length === 0) {
    logger.logWarning('Empty chart file content', { filename });
    return createEmptyResult(filename, [
      { lineNumber: 0, message: 'File is empty or contains no readable data' },
    ]);
  }

  // Split into lines
  const lines = content.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineNumber = lineIndex + 1;
    const line = lines[lineIndex];

    // Skip empty lines
    if (!line || line.trim().length === 0) {
      continue;
    }

    try {
      const fields = parseCSVLine(line);

      if (fields.length === 0) {
        continue;
      }

      const recordType = fields[0];

      switch (recordType) {
        case RECORD_TYPES.HEADER: {
          const parsedHeader = parseHeaderRecord(fields);
          if (parsedHeader) {
            header = parsedHeader;
          } else {
            warnings.push({
              lineNumber,
              message: 'Failed to parse header record',
              recordType: 'H',
              rawContent: line.substring(0, 100),
            });
          }
          break;
        }

        case RECORD_TYPES.RACE: {
          const raceData = parseRaceRecord(fields);
          if (raceData) {
            races.set(raceData.raceNumber, {
              ...raceData,
              starters: [],
            });
          } else {
            warnings.push({
              lineNumber,
              message: 'Failed to parse race record',
              recordType: 'R',
              rawContent: line.substring(0, 100),
            });
          }
          break;
        }

        case RECORD_TYPES.STARTER: {
          const starter = parseStarterRecord(fields, lineNumber);
          if (starter) {
            const race = races.get(starter.raceNumber);
            if (race) {
              race.starters.push(starter);
            } else {
              // Race not yet defined - create placeholder
              warnings.push({
                lineNumber,
                message: `Starter for undefined race ${starter.raceNumber}`,
                recordType: 'S',
              });
            }
          } else {
            warnings.push({
              lineNumber,
              message: 'Failed to parse starter record',
              recordType: 'S',
              rawContent: line.substring(0, 100),
            });
          }
          break;
        }

        case RECORD_TYPES.EXOTIC:
          // Exotic payoff records - skip silently (not needed for backtesting)
          break;

        default:
          // Unknown record type - skip with warning
          if (recordType && recordType.length === 1) {
            warnings.push({
              lineNumber,
              message: `Unknown record type: ${recordType}`,
              recordType,
            });
          }
          break;
      }
    } catch (error) {
      // Log and continue with next line
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      warnings.push({
        lineNumber,
        message: `Parse error: ${errorMessage}`,
        rawContent: line.substring(0, 100),
      });
      logger.logWarning('Chart line parse error', {
        filename,
        lineNumber,
        error: errorMessage,
      });
    }
  }

  // Sort races by race number
  const sortedRaces = Array.from(races.values()).sort((a, b) => a.raceNumber - b.raceNumber);

  // Sort starters by finish position within each race
  for (const race of sortedRaces) {
    race.starters.sort((a, b) => {
      // Scratches go to the end
      if (a.isScratched && !b.isScratched) return 1;
      if (!a.isScratched && b.isScratched) return -1;
      return a.finishPosition - b.finishPosition;
    });
  }

  // Create default header if not found
  if (!header) {
    // Try to infer from filename (e.g., SAR20060727.chart.txt)
    const match = filename.match(/([A-Z]{2,3})(\d{8})/);
    if (match) {
      header = {
        recordType: 'H',
        countryCode: 'USA',
        trackCode: match[1] ?? '',
        raceDate: match[2] ?? '',
        numberOfRaces: sortedRaces.length,
        trackName: match[1] ?? '',
      };
      warnings.push({
        lineNumber: 0,
        message: 'Header inferred from filename',
      });
    } else {
      header = {
        recordType: 'H',
        countryCode: '',
        trackCode: '',
        raceDate: '',
        numberOfRaces: sortedRaces.length,
        trackName: '',
      };
      warnings.push({
        lineNumber: 0,
        message: 'No header record found',
      });
    }
  }

  return {
    header,
    races: sortedRaces,
    filename,
    parsedAt: new Date().toISOString(),
    warnings,
  };
}

/**
 * Create an empty result for error cases
 */
function createEmptyResult(filename: string, warnings: ChartParseWarning[]): ParsedChartFile {
  return {
    header: {
      recordType: 'H',
      countryCode: '',
      trackCode: '',
      raceDate: '',
      numberOfRaces: 0,
      trackName: '',
    },
    races: [],
    filename,
    parsedAt: new Date().toISOString(),
    warnings,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get race by number from parsed chart
 */
export function getChartRace(chart: ParsedChartFile, raceNumber: number): ChartRace | undefined {
  return chart.races.find((r) => r.raceNumber === raceNumber);
}

/**
 * Get active (non-scratched) starters for a race
 */
export function getActiveStarters(race: ChartRace): ChartStarter[] {
  return race.starters.filter((s) => !s.isScratched);
}

/**
 * Get winner of a race
 */
export function getWinner(race: ChartRace): ChartStarter | undefined {
  return race.starters.find((s) => s.finishPosition === 1 && !s.isScratched);
}

/**
 * Get top finishers (1st, 2nd, 3rd)
 */
export function getTopFinishers(race: ChartRace, count: number = 3): ChartStarter[] {
  return race.starters
    .filter((s) => !s.isScratched && s.finishPosition <= count)
    .sort((a, b) => a.finishPosition - b.finishPosition);
}

/**
 * Calculate total payoffs for winners in a race
 */
export function getRacePayoffs(race: ChartRace): {
  win: number | null;
  place: number | null;
  show: number | null;
} {
  const winner = getWinner(race);
  const second = race.starters.find((s) => s.finishPosition === 2 && !s.isScratched);
  const third = race.starters.find((s) => s.finishPosition === 3 && !s.isScratched);

  return {
    win: winner?.winPayoff ?? null,
    place: second?.placePayoff ?? null,
    show: third?.showPayoff ?? null,
  };
}
