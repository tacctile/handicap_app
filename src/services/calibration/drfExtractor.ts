/**
 * DRF Historical Race Extractor
 *
 * Extracts historical race results from parsed DRF past performance data.
 * Each horse's PPs contain information about races they've run, which can
 * be aggregated and deduplicated to build a historical race dataset.
 *
 * DRF FIELD INDICES USED (from DRF_FIELD_MAP.md):
 * - PP Dates: Fields 102-113 (up to 12 PPs)
 * - PP Finish Positions: Fields 356-365 or 616-625
 * - PP Final Odds: Fields 516-525
 * - PP Track Codes: Fields 126-137
 * - PP Field Sizes: Fields 186-197
 * - PP Surface: Fields 326-335
 * - PP Distances: Fields 114-125
 * - PP Track Conditions: Fields 150-161
 *
 * Note: The parser already extracts these into PastPerformance objects,
 * so we work with the parsed data structures.
 */

import type { ParsedDRFFile, ParsedRace, PastPerformance } from '../../types/drf';
import type { HistoricalRace, HistoricalEntry, SurfaceCode, DataConfidence } from './schema';
import {
  generateRaceId,
  normalizeDate,
  toSurfaceCode,
  calculateImpliedProbability,
} from './schema';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Intermediate structure for collecting PP data from multiple horses
 */
interface ExtractedPPEntry {
  horseName: string;
  programNumber: number;
  finishPosition: number;
  odds: number | null;
  beyer: number | null;
}

/**
 * Race key for deduplication (track-date-race combination)
 */
interface RaceKey {
  trackCode: string;
  raceDate: string;
  raceNumber: number;
  distance: number;
  surface: SurfaceCode;
  fieldSize: number;
  trackCondition?: string;
  classification?: string;
  purse?: number;
}

/**
 * Options for extraction
 */
export interface ExtractorOptions {
  /** Maximum PPs to examine per horse (default: 10) */
  maxPPsPerHorse?: number;
  /** Minimum field size to include (default: 4) */
  minFieldSize?: number;
  /** Whether to include races without odds data (default: true) */
  includeWithoutOdds?: boolean;
  /** Skip races older than this date (YYYY-MM-DD) */
  minDate?: string;
}

/**
 * Extraction result with statistics
 */
export interface ExtractionResult {
  /** Extracted historical races */
  races: HistoricalRace[];
  /** Statistics about the extraction */
  stats: {
    totalPPsExamined: number;
    uniqueRacesFound: number;
    duplicatesSkipped: number;
    incompleteSkipped: number;
    racesWithFullOdds: number;
    avgEntriesPerRace: number;
  };
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract historical race results from a parsed DRF file
 * Aggregates past performances from all horses and deduplicates by race
 */
export function extractHistoricalRaces(
  parsedFile: ParsedDRFFile,
  options: ExtractorOptions = {}
): ExtractionResult {
  const { maxPPsPerHorse = 10, minFieldSize = 4, includeWithoutOdds = true, minDate } = options;

  // Map to collect entries by race key
  const raceMap = new Map<string, { key: RaceKey; entries: ExtractedPPEntry[] }>();

  // Statistics
  let totalPPsExamined = 0;
  let incompleteSkipped = 0;

  // Process each race in the file
  for (const race of parsedFile.races) {
    // Process each horse's past performances
    for (const horse of race.horses) {
      if (horse.isScratched) continue;

      const ppsToProcess = horse.pastPerformances.slice(0, maxPPsPerHorse);

      for (const pp of ppsToProcess) {
        totalPPsExamined++;

        // Skip incomplete PPs
        if (!pp.track || !pp.date || pp.finishPosition === undefined) {
          incompleteSkipped++;
          continue;
        }

        // Skip if before min date
        const normalizedPPDate = normalizeDate(pp.date);
        if (minDate && normalizedPPDate < minDate) {
          continue;
        }

        // Skip small fields
        if (pp.fieldSize < minFieldSize) {
          continue;
        }

        // Create race key
        const raceKey = createRaceKey(pp);
        const raceKeyString = raceKeyToString(raceKey);

        // Get or create race entry
        let raceData = raceMap.get(raceKeyString);
        if (!raceData) {
          raceData = { key: raceKey, entries: [] };
          raceMap.set(raceKeyString, raceData);
        }

        // Add this horse's entry
        raceData.entries.push({
          horseName: horse.horseName,
          programNumber: horse.programNumber,
          finishPosition: pp.finishPosition,
          odds: pp.odds,
          beyer: pp.speedFigures.beyer,
        });
      }
    }
  }

  // Convert to HistoricalRace objects
  const races: HistoricalRace[] = [];
  let duplicatesSkipped = 0;
  let racesWithFullOdds = 0;

  for (const [, raceData] of raceMap) {
    // Skip if not enough entries (suggests incomplete data)
    if (raceData.entries.length < 2) {
      incompleteSkipped++;
      continue;
    }

    // Deduplicate entries by finish position (same horse might appear multiple times)
    const uniqueEntries = deduplicateEntries(raceData.entries);
    duplicatesSkipped += raceData.entries.length - uniqueEntries.length;

    // Check if we have odds data
    const hasOddsData = uniqueEntries.some((e) => e.odds !== null && e.odds > 0);
    if (!hasOddsData && !includeWithoutOdds) {
      continue;
    }
    if (hasOddsData) {
      racesWithFullOdds++;
    }

    // Convert to HistoricalRace
    const historicalRace = createHistoricalRace(raceData.key, uniqueEntries);
    races.push(historicalRace);
  }

  // Sort races by date (newest first)
  races.sort((a, b) => b.raceDate.localeCompare(a.raceDate));

  // Calculate stats
  const totalEntries = races.reduce((sum, r) => sum + r.entries.length, 0);
  const avgEntriesPerRace = races.length > 0 ? totalEntries / races.length : 0;

  return {
    races,
    stats: {
      totalPPsExamined,
      uniqueRacesFound: races.length,
      duplicatesSkipped,
      incompleteSkipped,
      racesWithFullOdds,
      avgEntriesPerRace: Math.round(avgEntriesPerRace * 10) / 10,
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a race key from a past performance
 */
function createRaceKey(pp: PastPerformance): RaceKey {
  return {
    trackCode: pp.track.toUpperCase(),
    raceDate: normalizeDate(pp.date),
    raceNumber: pp.raceNumber,
    distance: pp.distanceFurlongs,
    surface: toSurfaceCode(pp.surface),
    fieldSize: pp.fieldSize,
    trackCondition: pp.trackCondition,
    classification: pp.classification,
    purse: pp.purse,
  };
}

/**
 * Convert race key to string for map key
 */
function raceKeyToString(key: RaceKey): string {
  return `${key.trackCode}-${key.raceDate}-R${key.raceNumber}`;
}

/**
 * Deduplicate entries, keeping the most complete data for each position
 */
function deduplicateEntries(entries: ExtractedPPEntry[]): ExtractedPPEntry[] {
  // Group by finish position
  const byPosition = new Map<number, ExtractedPPEntry[]>();

  for (const entry of entries) {
    const existing = byPosition.get(entry.finishPosition) || [];
    existing.push(entry);
    byPosition.set(entry.finishPosition, existing);
  }

  // For each position, keep the entry with the most data
  const result: ExtractedPPEntry[] = [];

  for (const [, positionEntries] of byPosition) {
    if (positionEntries.length === 1) {
      const entry = positionEntries[0];
      if (entry) result.push(entry);
    } else {
      // Pick the entry with odds and beyer if available
      const best = positionEntries.reduce((best, current) => {
        const bestScore = (best.odds ? 1 : 0) + (best.beyer ? 1 : 0);
        const currentScore = (current.odds ? 1 : 0) + (current.beyer ? 1 : 0);
        return currentScore > bestScore ? current : best;
      });
      result.push(best);
    }
  }

  return result.sort((a, b) => a.finishPosition - b.finishPosition);
}

/**
 * Create a HistoricalRace from extracted data
 */
function createHistoricalRace(key: RaceKey, entries: ExtractedPPEntry[]): HistoricalRace {
  // Convert entries to HistoricalEntry format
  const historicalEntries: HistoricalEntry[] = entries.map((entry) => {
    const odds = entry.odds ?? 0;
    const impliedProb = odds > 0 ? calculateImpliedProbability(odds) : 0;

    return {
      programNumber: entry.programNumber,
      finishPosition: entry.finishPosition,
      // For DRF-extracted data, we don't have our predictions
      // These will be 0 until we match with our own analysis
      predictedProbability: 0,
      impliedProbability: impliedProb,
      finalOdds: odds,
      baseScore: 0,
      finalScore: 0,
      tier: 0,
      wasWinner: entry.finishPosition === 1,
      wasPlace: entry.finishPosition <= 2,
      wasShow: entry.finishPosition <= 3,
      horseName: entry.horseName,
    };
  });

  // Determine data confidence
  const hasOdds = historicalEntries.some((e) => e.finalOdds > 0);
  const hasFullField = historicalEntries.length >= key.fieldSize * 0.6; // At least 60% of field
  let confidence: DataConfidence = 'HIGH';
  if (!hasOdds) confidence = 'LOW';
  else if (!hasFullField) confidence = 'MEDIUM';

  return {
    id: generateRaceId(key.trackCode, key.raceDate, key.raceNumber),
    trackCode: key.trackCode,
    raceDate: key.raceDate,
    raceNumber: key.raceNumber,
    distance: key.distance,
    surface: key.surface,
    fieldSize: key.fieldSize,
    entries: historicalEntries,
    recordedAt: new Date(),
    source: 'drf_parse',
    confidence,
    trackCondition: key.trackCondition,
    classification: key.classification,
    purse: key.purse,
    status: 'complete', // DRF PPs are completed races
  };
}

// ============================================================================
// EXTRACTION FROM SINGLE RACE (for current card analysis)
// ============================================================================

/**
 * Extract a single race's horses for logging predictions
 * This is used when we analyze a race and want to store our predictions
 */
export function extractRaceForPredictionLogging(
  race: ParsedRace,
  _trackCondition: string = 'fast'
): {
  raceKey: string;
  trackCode: string;
  raceDate: string;
  raceNumber: number;
  distance: number;
  surface: SurfaceCode;
  fieldSize: number;
  horses: {
    programNumber: number;
    horseName: string;
    morningLineOdds: number;
  }[];
} {
  const header = race.header;
  const activeHorses = race.horses.filter((h) => !h.isScratched);

  return {
    raceKey: generateRaceId(header.trackCode, header.raceDateRaw, header.raceNumber),
    trackCode: header.trackCode,
    raceDate: normalizeDate(header.raceDateRaw),
    raceNumber: header.raceNumber,
    distance: header.distanceFurlongs,
    surface: toSurfaceCode(header.surface),
    fieldSize: activeHorses.length,
    horses: activeHorses.map((h) => ({
      programNumber: h.programNumber,
      horseName: h.horseName,
      morningLineOdds: h.morningLineDecimal,
    })),
  };
}

// ============================================================================
// BATCH EXTRACTION UTILITIES
// ============================================================================

/**
 * Extract from multiple DRF files and deduplicate across files
 */
export function extractFromMultipleFiles(
  files: ParsedDRFFile[],
  options: ExtractorOptions = {}
): ExtractionResult {
  const allRaces = new Map<string, HistoricalRace>();
  const stats = {
    totalPPsExamined: 0,
    uniqueRacesFound: 0,
    duplicatesSkipped: 0,
    incompleteSkipped: 0,
    racesWithFullOdds: 0,
    avgEntriesPerRace: 0,
  };

  for (const file of files) {
    const result = extractHistoricalRaces(file, options);

    // Aggregate stats
    stats.totalPPsExamined += result.stats.totalPPsExamined;
    stats.incompleteSkipped += result.stats.incompleteSkipped;

    // Deduplicate races
    for (const race of result.races) {
      if (!allRaces.has(race.id)) {
        allRaces.set(race.id, race);
      } else {
        stats.duplicatesSkipped++;
        // Merge entries if the existing race has fewer
        const existing = allRaces.get(race.id)!;
        if (race.entries.length > existing.entries.length) {
          allRaces.set(race.id, race);
        }
      }
    }
  }

  const races = Array.from(allRaces.values());
  races.sort((a, b) => b.raceDate.localeCompare(a.raceDate));

  // Calculate final stats
  stats.uniqueRacesFound = races.length;
  stats.racesWithFullOdds = races.filter((r) => r.entries.some((e) => e.finalOdds > 0)).length;
  const totalEntries = races.reduce((sum, r) => sum + r.entries.length, 0);
  stats.avgEntriesPerRace =
    races.length > 0 ? Math.round((totalEntries / races.length) * 10) / 10 : 0;

  return { races, stats };
}

/**
 * Get estimated unique races from a parsed file without full extraction
 * Useful for UI preview
 */
export function estimateExtractableRaces(parsedFile: ParsedDRFFile): {
  estimatedRaces: number;
  estimatedEntries: number;
  dateRange: { earliest: string; latest: string } | null;
} {
  const raceKeys = new Set<string>();
  let earliest = '';
  let latest = '';
  let totalEntries = 0;

  for (const race of parsedFile.races) {
    for (const horse of race.horses) {
      for (const pp of horse.pastPerformances.slice(0, 10)) {
        if (pp.track && pp.date && pp.raceNumber) {
          const key = `${pp.track}-${normalizeDate(pp.date)}-R${pp.raceNumber}`;
          if (!raceKeys.has(key)) {
            raceKeys.add(key);
            totalEntries += pp.fieldSize || 8; // Estimate if not available

            const ppDate = normalizeDate(pp.date);
            if (!earliest || ppDate < earliest) earliest = ppDate;
            if (!latest || ppDate > latest) latest = ppDate;
          }
        }
      }
    }
  }

  return {
    estimatedRaces: raceKeys.size,
    estimatedEntries: Math.round(totalEntries / Math.max(1, raceKeys.size)) * raceKeys.size,
    dateRange: earliest ? { earliest, latest } : null,
  };
}
