/**
 * Diagnostics Cache Service
 *
 * Uses IndexedDB to cache diagnostics results so the heavy analysis
 * only re-runs when the underlying data files change.
 *
 * Cache invalidation uses a hash of all DRF + results filenames.
 * If the hash matches, cached results are returned instantly.
 */

import { logger } from '../logging';
import type { DiagnosticsResults, CacheMetadata } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Current cache version — bump to force re-analysis after code changes */
const CACHE_VERSION = '1.0.0';

/** IndexedDB database name for diagnostics cache */
const DIAGNOSTICS_DB_NAME = 'furlong-diagnostics-cache';

/** IndexedDB database version */
const DIAGNOSTICS_DB_VERSION = 1;

/** Store names */
const STORES = {
  RESULTS: 'diagnostics-results',
  META: 'diagnostics-meta',
} as const;

// ============================================================================
// DATABASE
// ============================================================================

let dbPromise: Promise<IDBDatabase> | null = null;

function openDiagnosticsDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DIAGNOSTICS_DB_NAME, DIAGNOSTICS_DB_VERSION);

    request.onerror = () => {
      logger.logError(request.error ?? new Error('Failed to open diagnostics DB'), {
        component: 'DiagnosticsCache',
      });
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.RESULTS)) {
        db.createObjectStore(STORES.RESULTS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'id' });
      }
    };
  });

  return dbPromise;
}

// ============================================================================
// HASH GENERATION
// ============================================================================

/**
 * Generate a simple hash from file names to detect data changes.
 * Uses a string hash of sorted filenames — if any file is added or removed,
 * the hash changes and triggers re-analysis.
 */
export function generateContentHash(drfFilenames: string[], resultsFilenames: string[]): string {
  const combined = [...drfFilenames, ...resultsFilenames].sort().join('|');
  // Simple FNV-1a-like hash for string content
  let hash = 2166136261;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `v${CACHE_VERSION}_${(hash >>> 0).toString(36)}`;
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Check if cached results exist and are still valid.
 * Returns the cached results if the content hash matches, null otherwise.
 */
export async function getCachedResults(
  currentHash: string
): Promise<{ results: DiagnosticsResults; metadata: CacheMetadata } | null> {
  try {
    const db = await openDiagnosticsDb();

    // Read metadata first to check hash
    const meta = await new Promise<CacheMetadata | undefined>((resolve, reject) => {
      const tx = db.transaction(STORES.META, 'readonly');
      const store = tx.objectStore(STORES.META);
      const request = store.get('diagnostics-meta');
      request.onsuccess = () => resolve(request.result as CacheMetadata | undefined);
      request.onerror = () => reject(request.error);
    });

    if (!meta || meta.contentHash !== currentHash || meta.version !== CACHE_VERSION) {
      return null;
    }

    // Hash matches — read cached results
    const cached = await new Promise<{ id: string; data: DiagnosticsResults } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORES.RESULTS, 'readonly');
        const store = tx.objectStore(STORES.RESULTS);
        const request = store.get('diagnostics-results');
        request.onsuccess = () =>
          resolve(request.result as { id: string; data: DiagnosticsResults } | undefined);
        request.onerror = () => reject(request.error);
      }
    );

    if (!cached) {
      return null;
    }

    logger.logInfo('Diagnostics cache hit', {
      component: 'DiagnosticsCache',
      hash: currentHash,
    });

    return { results: cached.data, metadata: meta };
  } catch (error) {
    logger.logWarning('Failed to read diagnostics cache', {
      component: 'DiagnosticsCache',
      error,
    });
    return null;
  }
}

/**
 * Store diagnostics results and metadata in IndexedDB.
 */
export async function setCachedResults(
  results: DiagnosticsResults,
  contentHash: string
): Promise<void> {
  try {
    const db = await openDiagnosticsDb();

    const metadata: CacheMetadata & { id: string } = {
      id: 'diagnostics-meta',
      contentHash,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };

    const resultsRecord = {
      id: 'diagnostics-results',
      data: results,
    };

    // Write metadata and results in parallel transactions
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.META, 'readwrite');
        const store = tx.objectStore(STORES.META);
        const request = store.put(metadata);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.RESULTS, 'readwrite');
        const store = tx.objectStore(STORES.RESULTS);
        const request = store.put(resultsRecord);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    ]);

    logger.logInfo('Diagnostics results cached', {
      component: 'DiagnosticsCache',
      hash: contentHash,
      races: results.totalRaces,
    });
  } catch (error) {
    logger.logWarning('Failed to cache diagnostics results', {
      component: 'DiagnosticsCache',
      error,
    });
  }
}

/**
 * Clear the diagnostics cache entirely.
 */
export async function clearDiagnosticsCache(): Promise<void> {
  try {
    const db = await openDiagnosticsDb();

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.META, 'readwrite');
        const request = tx.objectStore(STORES.META).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.RESULTS, 'readwrite');
        const request = tx.objectStore(STORES.RESULTS).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    ]);

    logger.logInfo('Diagnostics cache cleared', { component: 'DiagnosticsCache' });
  } catch (error) {
    logger.logWarning('Failed to clear diagnostics cache', {
      component: 'DiagnosticsCache',
      error,
    });
  }
}
