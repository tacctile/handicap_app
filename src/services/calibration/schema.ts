/**
 * Calibration Database Schema
 *
 * Defines the data structures for storing historical race outcomes
 * used to calibrate probability predictions via Platt scaling.
 *
 * Target: 500+ races for statistical significance in calibration.
 */

// ============================================================================
// HISTORICAL ENTRY
// ============================================================================

/**
 * A single horse entry within a historical race
 * Contains both our predictions and the actual outcome
 */
export interface HistoricalEntry {
  /** Program number / post position for this entry */
  programNumber: number;

  /** Actual finish position (1, 2, 3... or 0 if scratched) */
  finishPosition: number;

  /** Our model's win probability (0-1) - computed from score */
  predictedProbability: number;

  /** Implied probability from final odds (0-1) */
  impliedProbability: number;

  /** Final decimal odds at post time */
  finalOdds: number;

  /** Our base score (0-328 scale) */
  baseScore: number;

  /** Our final score with overlay (0-368 scale) */
  finalScore: number;

  /** Betting tier classification (1, 2, 3, or 0 for pass) */
  tier: number;

  /** Whether this entry won the race */
  wasWinner: boolean;

  /** Whether this entry finished 1st or 2nd */
  wasPlace: boolean;

  /** Whether this entry finished 1st, 2nd, or 3rd */
  wasShow: boolean;

  /** Horse name (for display/debugging) */
  horseName?: string;

  /** Morning line odds (for comparison to final odds) */
  morningLineOdds?: number;
}

// ============================================================================
// HISTORICAL RACE
// ============================================================================

/**
 * Source of the historical race data
 */
export type HistoricalRaceSource =
  | 'drf_parse' // Extracted from DRF past performances
  | 'manual' // Manually entered results
  | 'bot_result'; // Recorded from our own analysis

/**
 * Surface type code
 */
export type SurfaceCode = 'D' | 'T' | 'S'; // Dirt, Turf, Synthetic

/**
 * Confidence level for extracted data
 */
export type DataConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * A complete historical race record with all entries and outcomes
 */
export interface HistoricalRace {
  /** Unique identifier: "{trackCode}-{date}-{raceNumber}" */
  id: string;

  /** Track code (e.g., "SAR", "CD", "GP") */
  trackCode: string;

  /** Race date in ISO format (YYYY-MM-DD) */
  raceDate: string;

  /** Race number on the card */
  raceNumber: number;

  /** Distance in furlongs */
  distance: number;

  /** Surface type */
  surface: SurfaceCode;

  /** Number of horses in the field (non-scratched) */
  fieldSize: number;

  /** All entries in this race with predictions and results */
  entries: HistoricalEntry[];

  /** When this record was stored */
  recordedAt: Date;

  /** Source of this data */
  source: HistoricalRaceSource;

  /** Confidence level in the extracted data */
  confidence?: DataConfidence;

  /** Race classification (e.g., "claiming", "allowance", "stakes") */
  classification?: string;

  /** Purse amount if available */
  purse?: number;

  /** Track condition (e.g., "fast", "good", "muddy") */
  trackCondition?: string;

  /** Any notes or warnings about the data */
  notes?: string;

  /** Status for prediction tracking */
  status?: 'pending_result' | 'complete';
}

// ============================================================================
// CALIBRATION DATASET
// ============================================================================

/**
 * Statistics about the calibration dataset
 */
export interface CalibrationDataset {
  /** Total number of races in the dataset */
  totalRaces: number;

  /** Total number of individual entries across all races */
  totalEntries: number;

  /** Date range of races in the dataset */
  dateRange: {
    start: string; // ISO date
    end: string; // ISO date
  };

  /** List of track codes represented */
  trackCodes: string[];

  /** When the dataset was last updated */
  lastUpdated: Date;

  /** Breakdown by source */
  sourceBreakdown?: {
    drfParse: number;
    manual: number;
    botResult: number;
  };

  /** Breakdown by surface */
  surfaceBreakdown?: {
    dirt: number;
    turf: number;
    synthetic: number;
  };

  /** Number of races pending results */
  pendingResults?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique race ID from components
 */
export function generateRaceId(trackCode: string, raceDate: string, raceNumber: number): string {
  // Normalize the date to YYYY-MM-DD format
  const normalizedDate = normalizeDate(raceDate);
  return `${trackCode.toUpperCase()}-${normalizedDate}-R${raceNumber}`;
}

/**
 * Parse a race ID into its components
 */
export function parseRaceId(id: string): {
  trackCode: string;
  raceDate: string;
  raceNumber: number;
} | null {
  const match = id.match(/^([A-Z]+)-(\d{4}-\d{2}-\d{2})-R(\d+)$/);
  if (!match) return null;

  const trackCode = match[1];
  const raceDate = match[2];
  const raceNumberStr = match[3];

  if (!trackCode || !raceDate || !raceNumberStr) return null;

  return {
    trackCode,
    raceDate,
    raceNumber: parseInt(raceNumberStr, 10),
  };
}

/**
 * Normalize a date string to YYYY-MM-DD format
 * Handles various DRF date formats (YYYYMMDD, MMDDYY, etc.)
 */
export function normalizeDate(dateStr: string): string {
  // Already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // YYYYMMDD format (common in DRF)
  if (/^\d{8}$/.test(dateStr)) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  // MMDDYY format
  if (/^\d{6}$/.test(dateStr)) {
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const yearShort = dateStr.substring(4, 6);
    const year = parseInt(yearShort, 10) > 50 ? `19${yearShort}` : `20${yearShort}`;
    return `${year}-${month}-${day}`;
  }

  // Fallback: try to parse as Date and format
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0] ?? dateStr;
    }
  } catch {
    // Ignore parse errors
  }

  // Return as-is if we can't parse it
  return dateStr;
}

/**
 * Create an empty calibration dataset
 */
export function createEmptyCalibrationDataset(): CalibrationDataset {
  return {
    totalRaces: 0,
    totalEntries: 0,
    dateRange: {
      start: '',
      end: '',
    },
    trackCodes: [],
    lastUpdated: new Date(),
    sourceBreakdown: {
      drfParse: 0,
      manual: 0,
      botResult: 0,
    },
    surfaceBreakdown: {
      dirt: 0,
      turf: 0,
      synthetic: 0,
    },
    pendingResults: 0,
  };
}

/**
 * Convert surface string to surface code
 */
export function toSurfaceCode(surface: string): SurfaceCode {
  const s = surface.toLowerCase();
  if (s === 'turf' || s === 't') return 'T';
  if (s === 'synthetic' || s === 'all-weather' || s === 's') return 'S';
  return 'D'; // Default to dirt
}

/**
 * Calculate implied probability from decimal odds
 * Removes the vig/overround by normalizing
 */
export function calculateImpliedProbability(decimalOdds: number): number {
  if (decimalOdds <= 0) return 0;
  // Implied probability = 1 / (decimal odds + 1)
  // For US-style odds that have been converted to decimal multiplier
  return 1 / (decimalOdds + 1);
}

/**
 * Validate a historical race record
 */
export function validateHistoricalRace(race: HistoricalRace): string[] {
  const errors: string[] = [];

  if (!race.id) errors.push('Missing race ID');
  if (!race.trackCode) errors.push('Missing track code');
  if (!race.raceDate) errors.push('Missing race date');
  if (!race.raceNumber || race.raceNumber < 1) errors.push('Invalid race number');
  if (!race.distance || race.distance <= 0) errors.push('Invalid distance');
  if (!race.surface) errors.push('Missing surface');
  if (!race.entries || race.entries.length === 0) errors.push('No entries');

  // Validate entries
  const programNumbers = new Set<number>();
  race.entries.forEach((entry, i) => {
    if (programNumbers.has(entry.programNumber)) {
      errors.push(`Duplicate program number ${entry.programNumber} at index ${i}`);
    }
    programNumbers.add(entry.programNumber);

    if (entry.predictedProbability < 0 || entry.predictedProbability > 1) {
      errors.push(`Invalid predicted probability for entry ${entry.programNumber}`);
    }
  });

  // Check that exactly one winner exists (if race is complete)
  if (race.status !== 'pending_result') {
    const winners = race.entries.filter((e) => e.wasWinner);
    if (winners.length !== 1) {
      errors.push(`Expected exactly 1 winner, found ${winners.length}`);
    }
  }

  return errors;
}
