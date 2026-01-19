/**
 * Results Recorder Service
 *
 * Records actual race results and merges them with our stored predictions.
 * This completes the calibration loop by connecting predictions to outcomes.
 */

import { getHistoricalRace, updateHistoricalRace } from './storage';
import type { HistoricalEntry } from './schema';
import { calculateImpliedProbability } from './schema';
import { logger } from '../logging';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single finish result to record
 */
export interface FinishResult {
  /** Program number (saddle cloth number) */
  programNumber: number;
  /** Actual finish position (1, 2, 3, etc.) */
  finishPosition: number;
  /** Final odds at post time (decimal format, e.g., 5.0 for 5-1) */
  finalOdds: number;
}

/**
 * Result of recording race results
 */
export interface RecordResultOutcome {
  success: boolean;
  raceId: string;
  entriesUpdated: number;
  winner: {
    programNumber: number;
    horseName?: string;
    finalOdds: number;
    wasCorrectPick: boolean;
    predictedProbability: number;
  } | null;
  error?: string;
}

// ============================================================================
// MAIN RECORDING FUNCTION
// ============================================================================

/**
 * Record race results for a previously logged prediction
 * Updates the historical race with actual outcomes
 *
 * @param raceId - The race ID (format: "TRACK-DATE-RN")
 * @param results - Array of finish results
 * @returns Recording outcome with statistics
 */
export async function recordRaceResult(
  raceId: string,
  results: FinishResult[]
): Promise<RecordResultOutcome> {
  // Get the existing race record
  const race = await getHistoricalRace(raceId);

  if (!race) {
    logger.logWarning('[Results Recorder] Race not found', { raceId });
    return {
      success: false,
      raceId,
      entriesUpdated: 0,
      winner: null,
      error: `Race ${raceId} not found in database. Must log predictions first.`,
    };
  }

  // Check if results are valid
  const validationError = validateResults(results);
  if (validationError) {
    logger.logWarning('[Results Recorder] Invalid results', { error: validationError });
    return {
      success: false,
      raceId,
      entriesUpdated: 0,
      winner: null,
      error: validationError,
    };
  }

  // Create a map of results by program number
  const resultsMap = new Map<number, FinishResult>();
  for (const result of results) {
    resultsMap.set(result.programNumber, result);
  }

  // Update entries with results
  let entriesUpdated = 0;
  let winner: RecordResultOutcome['winner'] = null;

  const updatedEntries: HistoricalEntry[] = race.entries.map((entry) => {
    const result = resultsMap.get(entry.programNumber);

    if (result) {
      entriesUpdated++;

      const updatedEntry: HistoricalEntry = {
        ...entry,
        finishPosition: result.finishPosition,
        finalOdds: result.finalOdds,
        impliedProbability: calculateImpliedProbability(result.finalOdds),
        wasWinner: result.finishPosition === 1,
        wasPlace: result.finishPosition <= 2,
        wasShow: result.finishPosition <= 3,
      };

      // Track winner
      if (result.finishPosition === 1) {
        const wasCorrectPick = entry.tier === 1 || entry.baseScore >= 180;
        winner = {
          programNumber: entry.programNumber,
          horseName: entry.horseName,
          finalOdds: result.finalOdds,
          wasCorrectPick,
          predictedProbability: entry.predictedProbability,
        };
      }

      return updatedEntry;
    }

    // Entry not in results - might be a scratch
    if (entry.finishPosition === 0) {
      // Already marked as scratch, keep as is
      return entry;
    }

    // Mark as scratch (position 0)
    return {
      ...entry,
      finishPosition: 0,
      wasWinner: false,
      wasPlace: false,
      wasShow: false,
    };
  });

  // Update the race record
  const updated = await updateHistoricalRace(raceId, {
    entries: updatedEntries,
    status: 'complete',
    fieldSize: results.length, // Update field size to actual starters
  });

  if (!updated) {
    return {
      success: false,
      raceId,
      entriesUpdated: 0,
      winner: null,
      error: 'Failed to update race record',
    };
  }

  logger.logInfo('[Results Recorder] Recorded results', {
    raceId,
    entriesUpdated,
    winner: winner?.programNumber,
  });

  return {
    success: true,
    raceId,
    entriesUpdated,
    winner,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate race results
 */
function validateResults(results: FinishResult[]): string | null {
  if (!results || results.length === 0) {
    return 'No results provided';
  }

  // Check for exactly one winner
  const winners = results.filter((r) => r.finishPosition === 1);
  if (winners.length !== 1) {
    return `Expected exactly 1 winner, found ${winners.length}`;
  }

  // Check for unique finish positions
  const positions = new Set<number>();
  for (const result of results) {
    if (result.finishPosition > 0) {
      if (positions.has(result.finishPosition)) {
        return `Duplicate finish position: ${result.finishPosition}`;
      }
      positions.add(result.finishPosition);
    }
  }

  // Check for unique program numbers
  const programNumbers = new Set<number>();
  for (const result of results) {
    if (programNumbers.has(result.programNumber)) {
      return `Duplicate program number: ${result.programNumber}`;
    }
    programNumbers.add(result.programNumber);
  }

  // Check for valid odds
  for (const result of results) {
    if (result.finalOdds < 0) {
      return `Invalid odds for program ${result.programNumber}: ${result.finalOdds}`;
    }
  }

  return null;
}

// ============================================================================
// BATCH RECORDING
// ============================================================================

/**
 * Record results for multiple races
 */
export async function recordMultipleRaceResults(
  raceResults: { raceId: string; results: FinishResult[] }[]
): Promise<{
  successful: number;
  failed: number;
  outcomes: RecordResultOutcome[];
}> {
  const outcomes: RecordResultOutcome[] = [];
  let successful = 0;
  let failed = 0;

  for (const { raceId, results } of raceResults) {
    const outcome = await recordRaceResult(raceId, results);
    outcomes.push(outcome);

    if (outcome.success) {
      successful++;
    } else {
      failed++;
    }
  }

  return { successful, failed, outcomes };
}

// ============================================================================
// RESULT HELPERS
// ============================================================================

/**
 * Parse finish results from a simple format
 * Format: "1:5.20,2:3.40,3:12.00,..." (position:odds pairs by program number)
 */
export function parseFinishResultsSimple(
  programNumbers: number[],
  finishOrder: number[],
  finalOdds: number[]
): FinishResult[] {
  if (programNumbers.length !== finishOrder.length || finishOrder.length !== finalOdds.length) {
    throw new Error('Arrays must have equal length');
  }

  return programNumbers.map((pn, i) => ({
    programNumber: pn,
    finishPosition: finishOrder[i] ?? 0,
    finalOdds: finalOdds[i] ?? 0,
  }));
}

/**
 * Create finish results from a winner-only input
 * Useful for quick winner recording without full field
 */
export function createWinnerOnlyResult(
  winnerProgramNumber: number,
  winnerOdds: number,
  otherEntries?: { programNumber: number; odds: number }[]
): FinishResult[] {
  const results: FinishResult[] = [
    {
      programNumber: winnerProgramNumber,
      finishPosition: 1,
      finalOdds: winnerOdds,
    },
  ];

  // Add other entries with position 0 (unknown but not winner)
  if (otherEntries) {
    otherEntries.forEach((entry, index) => {
      if (entry.programNumber !== winnerProgramNumber) {
        results.push({
          programNumber: entry.programNumber,
          finishPosition: index + 2, // Just assign sequential non-winning positions
          finalOdds: entry.odds,
        });
      }
    });
  }

  return results;
}

// ============================================================================
// SCRATCHES
// ============================================================================

/**
 * Record a scratch for a race
 */
export async function recordScratch(
  raceId: string,
  programNumber: number
): Promise<{ success: boolean; error?: string }> {
  const race = await getHistoricalRace(raceId);

  if (!race) {
    return { success: false, error: `Race ${raceId} not found` };
  }

  const updatedEntries = race.entries.map((entry) => {
    if (entry.programNumber === programNumber) {
      return {
        ...entry,
        finishPosition: 0, // 0 indicates scratch
        wasWinner: false,
        wasPlace: false,
        wasShow: false,
      };
    }
    return entry;
  });

  // Update field size
  const newFieldSize = updatedEntries.filter((e) => e.finishPosition !== 0).length;

  await updateHistoricalRace(raceId, {
    entries: updatedEntries,
    fieldSize: newFieldSize,
  });

  logger.logInfo('[Results Recorder] Recorded scratch', { raceId, programNumber });

  return { success: true };
}

/**
 * Record multiple scratches
 */
export async function recordScratches(
  raceId: string,
  programNumbers: number[]
): Promise<{ success: boolean; error?: string }> {
  for (const pn of programNumbers) {
    const result = await recordScratch(raceId, pn);
    if (!result.success) {
      return result;
    }
  }
  return { success: true };
}
