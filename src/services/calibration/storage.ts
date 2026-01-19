/**
 * Calibration Storage Service
 *
 * IndexedDB operations for storing and retrieving historical race data
 * used for probability calibration. Data persists indefinitely (no expiration).
 */

import { openDatabase, STORES } from '../storage/index';
import type { HistoricalRace, CalibrationDataset } from './schema';
import { createEmptyCalibrationDataset, validateHistoricalRace } from './schema';
import { logger } from '../logging';

// ============================================================================
// HISTORICAL RACE OPERATIONS
// ============================================================================

/**
 * Save a historical race to IndexedDB
 * If a race with the same ID exists, it will be updated (not duplicated)
 */
export async function saveHistoricalRace(race: HistoricalRace): Promise<void> {
  // Validate the race before saving
  const validationErrors = validateHistoricalRace(race);
  if (validationErrors.length > 0) {
    logger.logWarning('[Calibration Storage] Race validation warnings', {
      errors: validationErrors,
    });
    // Continue anyway - validation is advisory
  }

  const db = await openDatabase();
  const tx = db.transaction(STORES.HISTORICAL_RACES, 'readwrite');
  const store = tx.objectStore(STORES.HISTORICAL_RACES);

  // Ensure recordedAt is set
  const raceToSave: HistoricalRace = {
    ...race,
    recordedAt: race.recordedAt || new Date(),
  };

  return new Promise((resolve, reject) => {
    const request = store.put(raceToSave);
    request.onsuccess = () => {
      logger.logInfo('[Calibration Storage] Saved historical race', { raceId: race.id });
      resolve();
    };
    request.onerror = () => {
      logger.logError(new Error('[Calibration Storage] Failed to save race'), { raceId: race.id });
      reject(request.error);
    };
  });
}

/**
 * Save multiple historical races in a single transaction
 */
export async function saveHistoricalRaces(races: HistoricalRace[]): Promise<number> {
  if (races.length === 0) return 0;

  const db = await openDatabase();
  const tx = db.transaction(STORES.HISTORICAL_RACES, 'readwrite');
  const store = tx.objectStore(STORES.HISTORICAL_RACES);

  let savedCount = 0;

  return new Promise((resolve, reject) => {
    const now = new Date();

    races.forEach((race) => {
      const raceToSave: HistoricalRace = {
        ...race,
        recordedAt: race.recordedAt || now,
      };

      const request = store.put(raceToSave);
      request.onsuccess = () => {
        savedCount++;
      };
      request.onerror = () => {
        logger.logWarning('[Calibration Storage] Failed to save race', { raceId: race.id });
      };
    });

    tx.oncomplete = () => {
      logger.logInfo('[Calibration Storage] Saved races', {
        saved: savedCount,
        total: races.length,
      });
      resolve(savedCount);
    };

    tx.onerror = () => {
      logger.logError(new Error('[Calibration Storage] Transaction failed'));
      reject(tx.error);
    };
  });
}

/**
 * Get a historical race by ID
 */
export async function getHistoricalRace(id: string): Promise<HistoricalRace | null> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.HISTORICAL_RACES, 'readonly');
  const store = tx.objectStore(STORES.HISTORICAL_RACES);

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      resolve((request.result as HistoricalRace) ?? null);
    };
    request.onerror = () => {
      logger.logError(new Error('[Calibration Storage] Failed to get race'), { raceId: id });
      reject(request.error);
    };
  });
}

/**
 * Get all historical races
 */
export async function getAllHistoricalRaces(): Promise<HistoricalRace[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.HISTORICAL_RACES, 'readonly');
  const store = tx.objectStore(STORES.HISTORICAL_RACES);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      resolve((request.result as HistoricalRace[]) ?? []);
    };
    request.onerror = () => {
      logger.logError(new Error('[Calibration Storage] Failed to get all races'));
      reject(request.error);
    };
  });
}

/**
 * Get the count of historical races
 */
export async function getHistoricalRaceCount(): Promise<number> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.HISTORICAL_RACES, 'readonly');
  const store = tx.objectStore(STORES.HISTORICAL_RACES);

  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      logger.logError(new Error('[Calibration Storage] Failed to count races'));
      reject(request.error);
    };
  });
}

/**
 * Get historical races by track code
 */
export async function getHistoricalRacesByTrack(trackCode: string): Promise<HistoricalRace[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.HISTORICAL_RACES, 'readonly');
  const store = tx.objectStore(STORES.HISTORICAL_RACES);
  const index = store.index('trackCode');

  return new Promise((resolve, reject) => {
    const request = index.getAll(IDBKeyRange.only(trackCode.toUpperCase()));
    request.onsuccess = () => {
      resolve((request.result as HistoricalRace[]) ?? []);
    };
    request.onerror = () => {
      logger.logError(new Error('[Calibration Storage] Failed to get races by track'), {
        trackCode,
      });
      reject(request.error);
    };
  });
}

/**
 * Get historical races within a date range
 */
export async function getHistoricalRacesByDateRange(
  startDate: Date,
  endDate: Date
): Promise<HistoricalRace[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.HISTORICAL_RACES, 'readonly');
  const store = tx.objectStore(STORES.HISTORICAL_RACES);
  const index = store.index('raceDate');

  // Convert dates to ISO strings for comparison
  const startStr = startDate.toISOString().split('T')[0] ?? '';
  const endStr = endDate.toISOString().split('T')[0] ?? '';

  return new Promise((resolve, reject) => {
    const request = index.getAll(IDBKeyRange.bound(startStr, endStr));
    request.onsuccess = () => {
      resolve((request.result as HistoricalRace[]) ?? []);
    };
    request.onerror = () => {
      logger.logError(new Error('[Calibration Storage] Failed to get races by date range'), {
        start: startStr,
        end: endStr,
      });
      reject(request.error);
    };
  });
}

/**
 * Get historical races by source
 */
export async function getHistoricalRacesBySource(
  source: 'drf_parse' | 'manual' | 'bot_result'
): Promise<HistoricalRace[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.HISTORICAL_RACES, 'readonly');
  const store = tx.objectStore(STORES.HISTORICAL_RACES);
  const index = store.index('source');

  return new Promise((resolve, reject) => {
    const request = index.getAll(IDBKeyRange.only(source));
    request.onsuccess = () => {
      resolve((request.result as HistoricalRace[]) ?? []);
    };
    request.onerror = () => {
      logger.logError(new Error('[Calibration Storage] Failed to get races by source'), { source });
      reject(request.error);
    };
  });
}

/**
 * Get historical races pending results
 */
export async function getPendingResultRaces(): Promise<HistoricalRace[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.HISTORICAL_RACES, 'readonly');
  const store = tx.objectStore(STORES.HISTORICAL_RACES);
  const index = store.index('status');

  return new Promise((resolve, reject) => {
    const request = index.getAll(IDBKeyRange.only('pending_result'));
    request.onsuccess = () => {
      resolve((request.result as HistoricalRace[]) ?? []);
    };
    request.onerror = () => {
      logger.logError(new Error('[Calibration Storage] Failed to get pending races'));
      reject(request.error);
    };
  });
}

/**
 * Delete a historical race by ID
 */
export async function deleteHistoricalRace(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.HISTORICAL_RACES, 'readwrite');
  const store = tx.objectStore(STORES.HISTORICAL_RACES);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => {
      logger.logInfo('[Calibration Storage] Deleted historical race', { raceId: id });
      resolve();
    };
    request.onerror = () => {
      logger.logError(new Error('[Calibration Storage] Failed to delete race'), { raceId: id });
      reject(request.error);
    };
  });
}

/**
 * Clear all historical race data
 * USE WITH CAUTION - this deletes all calibration data
 */
export async function clearAllHistoricalData(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.HISTORICAL_RACES, 'readwrite');
  const store = tx.objectStore(STORES.HISTORICAL_RACES);

  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => {
      logger.logWarning('[Calibration Storage] Cleared all historical race data');
      resolve();
    };
    request.onerror = () => {
      logger.logError(new Error('[Calibration Storage] Failed to clear data'));
      reject(request.error);
    };
  });
}

// ============================================================================
// CALIBRATION META OPERATIONS
// ============================================================================

/**
 * Get or compute the calibration dataset statistics
 */
export async function getCalibrationDataset(): Promise<CalibrationDataset> {
  const races = await getAllHistoricalRaces();

  if (races.length === 0) {
    return createEmptyCalibrationDataset();
  }

  // Compute statistics from races
  const trackCodes = new Set<string>();
  let totalEntries = 0;
  let minDate = '';
  let maxDate = '';
  let drfCount = 0;
  let manualCount = 0;
  let botCount = 0;
  let dirtCount = 0;
  let turfCount = 0;
  let syntheticCount = 0;
  let pendingCount = 0;

  races.forEach((race) => {
    trackCodes.add(race.trackCode);
    totalEntries += race.entries.length;

    // Track date range
    if (!minDate || race.raceDate < minDate) minDate = race.raceDate;
    if (!maxDate || race.raceDate > maxDate) maxDate = race.raceDate;

    // Source breakdown
    switch (race.source) {
      case 'drf_parse':
        drfCount++;
        break;
      case 'manual':
        manualCount++;
        break;
      case 'bot_result':
        botCount++;
        break;
    }

    // Surface breakdown
    switch (race.surface) {
      case 'D':
        dirtCount++;
        break;
      case 'T':
        turfCount++;
        break;
      case 'S':
        syntheticCount++;
        break;
    }

    // Pending results
    if (race.status === 'pending_result') {
      pendingCount++;
    }
  });

  return {
    totalRaces: races.length,
    totalEntries,
    dateRange: {
      start: minDate,
      end: maxDate,
    },
    trackCodes: Array.from(trackCodes).sort(),
    lastUpdated: new Date(),
    sourceBreakdown: {
      drfParse: drfCount,
      manual: manualCount,
      botResult: botCount,
    },
    surfaceBreakdown: {
      dirt: dirtCount,
      turf: turfCount,
      synthetic: syntheticCount,
    },
    pendingResults: pendingCount,
  };
}

// ============================================================================
// EXPORT / IMPORT OPERATIONS
// ============================================================================

/**
 * Export historical data to JSON string
 */
export async function exportHistoricalData(): Promise<string> {
  const races = await getAllHistoricalRaces();
  const dataset = await getCalibrationDataset();

  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    dataset,
    races,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import historical data from JSON string
 * Returns the number of races imported
 */
export async function importHistoricalData(json: string): Promise<number> {
  let data: {
    version?: number;
    races?: HistoricalRace[];
    // Legacy format support
    historicalRaces?: HistoricalRace[];
  };

  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON format');
  }

  // Support both new and legacy formats
  const races = data.races ?? data.historicalRaces ?? [];

  if (!Array.isArray(races)) {
    throw new Error('Invalid data format: races must be an array');
  }

  if (races.length === 0) {
    return 0;
  }

  // Validate and convert dates
  const racesToSave: HistoricalRace[] = races.map((race) => ({
    ...race,
    // Convert date strings back to Date objects
    recordedAt:
      race.recordedAt instanceof Date ? race.recordedAt : new Date(race.recordedAt || Date.now()),
  }));

  return saveHistoricalRaces(racesToSave);
}

// ============================================================================
// RACE ID CHECK
// ============================================================================

/**
 * Check if a race ID already exists in the database
 */
export async function raceExists(id: string): Promise<boolean> {
  const race = await getHistoricalRace(id);
  return race !== null;
}

/**
 * Get multiple races by their IDs
 */
export async function getHistoricalRacesByIds(ids: string[]): Promise<Map<string, HistoricalRace>> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.HISTORICAL_RACES, 'readonly');
  const store = tx.objectStore(STORES.HISTORICAL_RACES);

  const results = new Map<string, HistoricalRace>();

  return new Promise((resolve, reject) => {
    let completed = 0;

    if (ids.length === 0) {
      resolve(results);
      return;
    }

    ids.forEach((id) => {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) {
          results.set(id, request.result as HistoricalRace);
        }
        completed++;
        if (completed === ids.length) {
          resolve(results);
        }
      };
      request.onerror = () => {
        completed++;
        if (completed === ids.length) {
          resolve(results);
        }
      };
    });

    tx.onerror = () => {
      reject(tx.error);
    };
  });
}

/**
 * Update an existing race (e.g., to add results)
 */
export async function updateHistoricalRace(
  id: string,
  updates: Partial<HistoricalRace>
): Promise<HistoricalRace | null> {
  const existing = await getHistoricalRace(id);
  if (!existing) {
    logger.logWarning('[Calibration Storage] Cannot update non-existent race', { raceId: id });
    return null;
  }

  const updated: HistoricalRace = {
    ...existing,
    ...updates,
    id, // Ensure ID doesn't change
  };

  await saveHistoricalRace(updated);
  return updated;
}
