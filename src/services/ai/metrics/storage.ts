/**
 * AI Metrics Storage
 *
 * In-memory storage with IndexedDB persistence for AI decision records.
 * Falls back to localStorage if IndexedDB is unavailable.
 */

import type { AIDecisionRecord, RaceResults } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const DB_NAME = 'ai_metrics';
const DB_VERSION = 1;
const STORE_NAME = 'ai_decisions';
const LOCALSTORAGE_KEY = 'ai_decisions_fallback';

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

/** In-memory cache for fast access */
const memoryCache = new Map<string, AIDecisionRecord>();

/** Queue for writes when IndexedDB is unavailable */
const writeQueue: AIDecisionRecord[] = [];

/** Flag indicating if IndexedDB is available */
let indexedDBAvailable: boolean | null = null;

// ============================================================================
// INDEXEDDB HELPERS
// ============================================================================

/**
 * Check if IndexedDB is available
 */
function checkIndexedDBAvailable(): boolean {
  if (indexedDBAvailable !== null) {
    return indexedDBAvailable;
  }

  try {
    if (typeof window === 'undefined' || !window.indexedDB) {
      indexedDBAvailable = false;
      return false;
    }
    indexedDBAvailable = true;
    return true;
  } catch {
    indexedDBAvailable = false;
    return false;
  }
}

/**
 * Open the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!checkIndexedDBAvailable()) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'raceId' });

        // Create indexes for common queries
        store.createIndex('trackCode', 'trackCode', { unique: false });
        store.createIndex('raceDate', 'raceDate', { unique: false });
        store.createIndex('resultRecorded', 'resultRecorded', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Execute a transaction on the database
 */
async function withTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error(`Transaction failed: ${request.error?.message}`));
    };

    transaction.oncomplete = () => {
      db.close();
    };

    transaction.onerror = () => {
      db.close();
      reject(new Error(`Transaction error: ${transaction.error?.message}`));
    };
  });
}

// ============================================================================
// LOCALSTORAGE FALLBACK
// ============================================================================

/**
 * Save records to localStorage as fallback
 */
function saveToLocalStorage(records: AIDecisionRecord[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn('[Metrics] Failed to save to localStorage:', error);
  }
}

/**
 * Load records from localStorage fallback
 */
function loadFromLocalStorage(): AIDecisionRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const data = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as AIDecisionRecord[];
  } catch (error) {
    console.warn('[Metrics] Failed to load from localStorage:', error);
    return [];
  }
}

// ============================================================================
// STORAGE INITIALIZATION
// ============================================================================

/** Flag to track if storage has been initialized */
let initialized = false;

/**
 * Initialize the storage system
 * Loads existing records from IndexedDB or localStorage into memory cache
 */
export async function initializeMetricsStorage(): Promise<void> {
  if (initialized) return;

  try {
    if (checkIndexedDBAvailable()) {
      // Load all records from IndexedDB into memory
      const records = await getAllFromIndexedDB();
      for (const record of records) {
        memoryCache.set(record.raceId, record);
      }

      // Process any queued writes
      if (writeQueue.length > 0) {
        for (const record of writeQueue) {
          await saveToIndexedDB(record);
        }
        writeQueue.length = 0;
      }
    } else {
      // Load from localStorage fallback
      const records = loadFromLocalStorage();
      for (const record of records) {
        memoryCache.set(record.raceId, record);
      }
    }

    initialized = true;
  } catch (error) {
    console.warn('[Metrics] Failed to initialize storage, using memory only:', error);
    initialized = true;
  }
}

/**
 * Get all records from IndexedDB
 */
async function getAllFromIndexedDB(): Promise<AIDecisionRecord[]> {
  return withTransaction('readonly', (store) => store.getAll());
}

/**
 * Save a single record to IndexedDB
 */
async function saveToIndexedDB(record: AIDecisionRecord): Promise<void> {
  await withTransaction('readwrite', (store) => store.put(record));
}

/**
 * Delete a record from IndexedDB
 */
async function deleteFromIndexedDB(raceId: string): Promise<void> {
  await withTransaction('readwrite', (store) => store.delete(raceId));
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Save a decision record
 *
 * @param record - The decision record to save
 */
export async function saveDecisionRecord(record: AIDecisionRecord): Promise<void> {
  // Ensure storage is initialized
  await initializeMetricsStorage();

  // Always update memory cache first
  memoryCache.set(record.raceId, record);

  try {
    if (checkIndexedDBAvailable()) {
      // Persist to IndexedDB
      await saveToIndexedDB(record);
    } else {
      // Queue write and save to localStorage
      writeQueue.push(record);
      const allRecords = Array.from(memoryCache.values());
      saveToLocalStorage(allRecords);
    }
  } catch (error) {
    console.warn('[Metrics] Failed to persist record, kept in memory:', error);
    // Record is still in memory cache, so operation is not lost
    writeQueue.push(record);
  }
}

/**
 * Get a decision record by race ID
 *
 * @param raceId - The race ID to look up
 * @returns The decision record or null if not found
 */
export async function getDecisionRecord(raceId: string): Promise<AIDecisionRecord | null> {
  // Ensure storage is initialized
  await initializeMetricsStorage();

  // Check memory cache first
  const cached = memoryCache.get(raceId);
  if (cached) {
    return cached;
  }

  // If not in cache and IndexedDB is available, try there
  if (checkIndexedDBAvailable()) {
    try {
      const record = await withTransaction('readonly', (store) => store.get(raceId));
      if (record) {
        memoryCache.set(raceId, record);
        return record;
      }
    } catch (error) {
      console.warn('[Metrics] Failed to fetch from IndexedDB:', error);
    }
  }

  return null;
}

/**
 * Get all decision records
 *
 * @returns Array of all decision records
 */
export async function getAllDecisionRecords(): Promise<AIDecisionRecord[]> {
  // Ensure storage is initialized
  await initializeMetricsStorage();

  return Array.from(memoryCache.values());
}

/**
 * Update a decision record with race results
 *
 * @param raceId - The race ID to update
 * @param results - The race results
 */
export async function updateWithResults(raceId: string, results: RaceResults): Promise<void> {
  // Ensure storage is initialized
  await initializeMetricsStorage();

  const record = await getDecisionRecord(raceId);
  if (!record) {
    throw new Error(`Decision record not found: ${raceId}`);
  }

  // Update the record with results
  const updatedRecord: AIDecisionRecord = {
    ...record,
    actualWinner: results.winner,
    actualExacta: results.exacta,
    actualTrifecta: results.trifecta,
    resultRecorded: true,
  };

  // Save the updated record
  await saveDecisionRecord(updatedRecord);
}

/**
 * Clear all decision records
 */
export async function clearAllRecords(): Promise<void> {
  // Clear memory cache
  memoryCache.clear();
  writeQueue.length = 0;

  try {
    if (checkIndexedDBAvailable()) {
      // Clear IndexedDB
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(new Error(`Failed to clear store: ${request.error?.message}`));
        };

        transaction.oncomplete = () => {
          db.close();
        };
      });
    } else {
      // Clear localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LOCALSTORAGE_KEY);
      }
    }
  } catch (error) {
    console.warn('[Metrics] Failed to clear persistent storage:', error);
  }
}

/**
 * Delete a specific decision record
 *
 * @param raceId - The race ID to delete
 */
export async function deleteDecisionRecord(raceId: string): Promise<void> {
  // Ensure storage is initialized
  await initializeMetricsStorage();

  // Remove from memory cache
  memoryCache.delete(raceId);

  try {
    if (checkIndexedDBAvailable()) {
      await deleteFromIndexedDB(raceId);
    } else {
      // Update localStorage
      const allRecords = Array.from(memoryCache.values());
      saveToLocalStorage(allRecords);
    }
  } catch (error) {
    console.warn('[Metrics] Failed to delete from persistent storage:', error);
  }
}

/**
 * Get records filtered by criteria
 *
 * @param filter - Filter criteria
 * @returns Filtered array of decision records
 */
export async function getFilteredRecords(filter: {
  trackCode?: string;
  startDate?: string;
  endDate?: string;
  resultRecordedOnly?: boolean;
}): Promise<AIDecisionRecord[]> {
  // Ensure storage is initialized
  await initializeMetricsStorage();

  let records = Array.from(memoryCache.values());

  if (filter.trackCode) {
    records = records.filter((r) => r.trackCode === filter.trackCode);
  }

  if (filter.startDate) {
    records = records.filter((r) => r.raceDate >= filter.startDate!);
  }

  if (filter.endDate) {
    records = records.filter((r) => r.raceDate <= filter.endDate!);
  }

  if (filter.resultRecordedOnly) {
    records = records.filter((r) => r.resultRecorded);
  }

  return records;
}

/**
 * Get count of records
 *
 * @returns Total count of records
 */
export async function getRecordCount(): Promise<number> {
  await initializeMetricsStorage();
  return memoryCache.size;
}

/**
 * Reset storage for testing purposes
 * This clears the memory cache and resets initialization flag
 */
export function resetStorageForTesting(): void {
  memoryCache.clear();
  writeQueue.length = 0;
  initialized = false;
  indexedDBAvailable = null;
}
