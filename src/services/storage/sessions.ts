/**
 * IndexedDB Session Persistence Service
 *
 * Provides persistent storage for user race sessions including:
 * - Scratches
 * - Odds overrides
 * - Sort preferences
 * - Track conditions
 *
 * Each DRF file (e.g., PEN0821.DRF) has its own session.
 * Each race within a file maintains independent state.
 */

import type { ParsedDRFFile } from '../../types/drf';
import type { TrackCondition } from '../../types/drf';

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

const DB_NAME = 'furlong_db';
const DB_VERSION = 1;
const STORE_NAME = 'race_sessions';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Per-race state that is persisted
 */
export interface PersistedRaceState {
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  scratches: number[];
  oddsOverrides: Record<number, string>;
  trackCondition: TrackCondition;
}

/**
 * Complete saved session for a DRF file
 */
export interface SavedSession {
  filename: string;
  uploadedAt: string;
  lastAccessedAt: string;
  parsedData: ParsedDRFFile;
  raceStates: Record<number, PersistedRaceState>;
}

/**
 * Summary info for listing saved sessions
 */
export interface SessionInfo {
  filename: string;
  uploadedAt: string;
  lastAccessedAt: string;
  trackCode: string;
  raceDate: string;
  raceCount: number;
}

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens the IndexedDB database, creating it if necessary.
 * Uses singleton pattern to avoid multiple connections.
 */
function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[SessionStorage] Failed to open database:', request.error);
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create race_sessions object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'filename' });
        store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extracts the filename key from a full DRF filename.
 * Removes extension and normalizes to uppercase.
 *
 * @param filename - Full filename like "PEN0821.DRF" or "pen0821.drf"
 * @returns Normalized key like "PEN0821"
 */
export function extractFilenameKey(filename: string): string {
  // Remove path if present
  const basename = filename.split('/').pop() || filename;
  const withoutPath = basename.split('\\').pop() || basename;

  // Remove extension
  const parts = withoutPath.split('.');
  if (parts.length > 1) {
    parts.pop();
  }

  // Normalize to uppercase
  return parts.join('.').toUpperCase();
}

/**
 * Creates default race state for a new race
 */
export function createDefaultRaceState(): PersistedRaceState {
  return {
    sortColumn: 'POST',
    sortDirection: 'asc',
    scratches: [],
    oddsOverrides: {},
    trackCondition: 'fast',
  };
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

/**
 * Saves a session to IndexedDB.
 * Creates new session or updates existing one.
 *
 * @param session - The session data to save
 */
export async function saveSession(session: SavedSession): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.put(session);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('[SessionStorage] Failed to save session:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[SessionStorage] Error saving session:', error);
    throw error;
  }
}

/**
 * Loads a session from IndexedDB by filename key.
 *
 * @param filenameKey - The normalized filename key (e.g., "PEN0821")
 * @returns The saved session or null if not found
 */
export async function loadSession(filenameKey: string): Promise<SavedSession | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(filenameKey);

      request.onsuccess = () => {
        const result = request.result as SavedSession | undefined;
        resolve(result ?? null);
      };

      request.onerror = () => {
        console.error('[SessionStorage] Failed to load session:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[SessionStorage] Error loading session:', error);
    return null;
  }
}

/**
 * Updates the lastAccessedAt timestamp for a session.
 *
 * @param filenameKey - The normalized filename key
 */
export async function touchSession(filenameKey: string): Promise<void> {
  try {
    const session = await loadSession(filenameKey);
    if (session) {
      session.lastAccessedAt = new Date().toISOString();
      await saveSession(session);
    }
  } catch (error) {
    console.error('[SessionStorage] Error touching session:', error);
  }
}

/**
 * Deletes a session from IndexedDB.
 *
 * @param filenameKey - The normalized filename key
 */
export async function deleteSession(filenameKey: string): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(filenameKey);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('[SessionStorage] Failed to delete session:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[SessionStorage] Error deleting session:', error);
    throw error;
  }
}

/**
 * Lists all saved sessions with summary info.
 *
 * @returns Array of session summaries sorted by last accessed time
 */
export async function listSessions(): Promise<SessionInfo[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = (request.result as SavedSession[]).map((session) => ({
          filename: session.filename,
          uploadedAt: session.uploadedAt,
          lastAccessedAt: session.lastAccessedAt,
          trackCode: session.parsedData.races[0]?.header?.trackCode || 'UNK',
          raceDate: session.parsedData.races[0]?.header?.raceDateRaw || '',
          raceCount: session.parsedData.races.length,
        }));

        // Sort by last accessed, most recent first
        sessions.sort(
          (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
        );

        resolve(sessions);
      };

      request.onerror = () => {
        console.error('[SessionStorage] Failed to list sessions:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[SessionStorage] Error listing sessions:', error);
    return [];
  }
}

/**
 * Clears all saved sessions from IndexedDB.
 * Use with caution - this is destructive.
 */
export async function clearAllSessions(): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('[SessionStorage] Failed to clear sessions:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[SessionStorage] Error clearing sessions:', error);
    throw error;
  }
}

// ============================================================================
// RACE STATE OPERATIONS
// ============================================================================

/**
 * Updates the state for a specific race within a session.
 * Creates the race state if it doesn't exist.
 *
 * @param filenameKey - The normalized filename key
 * @param raceIndex - The race index (0-based)
 * @param updates - Partial race state updates to apply
 */
export async function updateRaceState(
  filenameKey: string,
  raceIndex: number,
  updates: Partial<PersistedRaceState>
): Promise<void> {
  try {
    const session = await loadSession(filenameKey);
    if (!session) {
      console.warn('[SessionStorage] Cannot update race state - session not found:', filenameKey);
      return;
    }

    // Initialize race state if needed
    if (!session.raceStates[raceIndex]) {
      session.raceStates[raceIndex] = createDefaultRaceState();
    }

    // Apply updates
    session.raceStates[raceIndex] = {
      ...session.raceStates[raceIndex],
      ...updates,
    };

    // Update lastAccessedAt
    session.lastAccessedAt = new Date().toISOString();

    await saveSession(session);
  } catch (error) {
    console.error('[SessionStorage] Error updating race state:', error);
  }
}

/**
 * Gets the state for a specific race within a session.
 *
 * @param filenameKey - The normalized filename key
 * @param raceIndex - The race index (0-based)
 * @returns The race state or default if not found
 */
export async function getRaceState(
  filenameKey: string,
  raceIndex: number
): Promise<PersistedRaceState> {
  try {
    const session = await loadSession(filenameKey);
    if (session?.raceStates[raceIndex]) {
      return session.raceStates[raceIndex];
    }
  } catch (error) {
    console.error('[SessionStorage] Error getting race state:', error);
  }

  return createDefaultRaceState();
}

/**
 * Resets a specific race to default state within a session.
 *
 * @param filenameKey - The normalized filename key
 * @param raceIndex - The race index (0-based)
 */
export async function resetRaceState(filenameKey: string, raceIndex: number): Promise<void> {
  await updateRaceState(filenameKey, raceIndex, createDefaultRaceState());
}

/**
 * Resets all race states for a session to defaults.
 * Preserves the parsed data but clears all user modifications.
 *
 * @param filenameKey - The normalized filename key
 */
export async function resetAllRaceStates(filenameKey: string): Promise<void> {
  try {
    const session = await loadSession(filenameKey);
    if (!session) {
      return;
    }

    // Reset all race states to defaults
    const raceCount = session.parsedData.races.length;
    session.raceStates = {};
    for (let i = 0; i < raceCount; i++) {
      session.raceStates[i] = createDefaultRaceState();
    }

    // Update lastAccessedAt
    session.lastAccessedAt = new Date().toISOString();

    await saveSession(session);
  } catch (error) {
    console.error('[SessionStorage] Error resetting all race states:', error);
  }
}

// ============================================================================
// SESSION CREATION
// ============================================================================

/**
 * Creates a new session from parsed DRF data.
 * Initializes all races with default state.
 *
 * @param parsedData - The parsed DRF file data
 * @returns The newly created session
 */
export function createNewSession(parsedData: ParsedDRFFile): SavedSession {
  const filenameKey = extractFilenameKey(parsedData.filename);
  const now = new Date().toISOString();

  // Initialize race states for all races
  const raceStates: Record<number, PersistedRaceState> = {};
  for (let i = 0; i < parsedData.races.length; i++) {
    raceStates[i] = createDefaultRaceState();
  }

  return {
    filename: filenameKey,
    uploadedAt: now,
    lastAccessedAt: now,
    parsedData,
    raceStates,
  };
}

/**
 * Checks if a session exists for a given filename.
 *
 * @param filename - The DRF filename (with or without extension)
 * @returns True if session exists
 */
export async function sessionExists(filename: string): Promise<boolean> {
  const filenameKey = extractFilenameKey(filename);
  const session = await loadSession(filenameKey);
  return session !== null;
}

// ============================================================================
// STORAGE AVAILABILITY CHECK
// ============================================================================

/**
 * Checks if IndexedDB is available in the current environment.
 *
 * @returns True if IndexedDB is available
 */
export function isSessionStorageAvailable(): boolean {
  try {
    return 'indexedDB' in window && indexedDB !== null;
  } catch {
    return false;
  }
}
