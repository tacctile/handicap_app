/**
 * Session Persistence Hook
 *
 * Provides automatic persistence of user changes to IndexedDB.
 * Each DRF file is stored as an independent session.
 * Changes are debounced to avoid excessive writes.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  loadSession,
  saveSession,
  createNewSession,
  extractFilenameKey,
  resetRaceState as resetRaceStateStorage,
  resetAllRaceStates as resetAllRaceStatesStorage,
  isSessionStorageAvailable,
  type SavedSession,
  type PersistedRaceState,
} from '../services/storage/sessions';
import type { ParsedDRFFile } from '../types/drf';
import type { TrackCondition } from '../types/drf';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Debounce delay for auto-save in milliseconds */
const SAVE_DEBOUNCE_MS = 300;

// ============================================================================
// TYPES
// ============================================================================

export interface RaceStateUpdate {
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  scratches?: number[];
  oddsOverrides?: Record<number, string>;
  trackCondition?: TrackCondition;
}

export interface SessionPersistenceState {
  /** Whether storage is available */
  isStorageAvailable: boolean;
  /** The current filename key (e.g., "PEN0821") */
  currentFilenameKey: string | null;
  /** Whether a previous session was restored */
  wasRestored: boolean;
  /** Whether there are pending saves */
  isSaving: boolean;
  /** The current session data */
  session: SavedSession | null;
}

export interface SessionPersistenceActions {
  /**
   * Loads or creates a session for the given parsed data.
   * If a previous session exists for this file, restores it.
   * Otherwise, creates a new session.
   *
   * @returns Object with restored session info or null if new session
   */
  loadOrCreateSession: (
    parsedData: ParsedDRFFile
  ) => Promise<{ wasRestored: boolean; session: SavedSession }>;

  /**
   * Updates state for a specific race.
   * Changes are debounced automatically.
   */
  updateRaceState: (raceIndex: number, updates: RaceStateUpdate) => void;

  /**
   * Gets the current state for a specific race.
   */
  getRaceState: (raceIndex: number) => PersistedRaceState | null;

  /**
   * Resets a specific race to default state.
   */
  resetRace: (raceIndex: number) => Promise<void>;

  /**
   * Resets all races to default state.
   */
  resetAllRaces: () => Promise<void>;

  /**
   * Clears the current session (removes from memory, not from storage).
   */
  clearSession: () => void;

  /**
   * Forces an immediate save (bypasses debounce).
   */
  forceSave: () => Promise<void>;
}

export type UseSessionPersistenceReturn = SessionPersistenceState & SessionPersistenceActions;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSessionPersistence(): UseSessionPersistenceReturn {
  // State
  const [isStorageAvailable] = useState(() => isSessionStorageAvailable());
  const [currentFilenameKey, setCurrentFilenameKey] = useState<string | null>(null);
  const [wasRestored, setWasRestored] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [session, setSession] = useState<SavedSession | null>(null);

  // Refs for debouncing
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<Map<number, RaceStateUpdate>>(new Map());

  // ============================================================================
  // SAVE LOGIC
  // ============================================================================

  /**
   * Performs the actual save to IndexedDB.
   * Merges all pending updates into the session before saving.
   */
  const performSave = useCallback(async () => {
    if (!session || !isStorageAvailable) return;

    setIsSaving(true);

    try {
      // Apply any pending updates
      const updatedSession = { ...session };
      updatedSession.lastAccessedAt = new Date().toISOString();

      // Merge pending updates into race states
      pendingUpdatesRef.current.forEach((updates, raceIndex) => {
        if (!updatedSession.raceStates[raceIndex]) {
          updatedSession.raceStates[raceIndex] = {
            sortColumn: 'POST',
            sortDirection: 'asc',
            scratches: [],
            oddsOverrides: {},
            trackCondition: 'fast',
          };
        }

        // Apply updates
        if (updates.sortColumn !== undefined) {
          updatedSession.raceStates[raceIndex].sortColumn = updates.sortColumn;
        }
        if (updates.sortDirection !== undefined) {
          updatedSession.raceStates[raceIndex].sortDirection = updates.sortDirection;
        }
        if (updates.scratches !== undefined) {
          updatedSession.raceStates[raceIndex].scratches = updates.scratches;
        }
        if (updates.oddsOverrides !== undefined) {
          updatedSession.raceStates[raceIndex].oddsOverrides = updates.oddsOverrides;
        }
        if (updates.trackCondition !== undefined) {
          updatedSession.raceStates[raceIndex].trackCondition = updates.trackCondition;
        }
      });

      // Clear pending updates
      pendingUpdatesRef.current.clear();

      // Save to IndexedDB
      await saveSession(updatedSession);

      // Update local state
      setSession(updatedSession);
    } catch (error) {
      console.error('[SessionPersistence] Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [session, isStorageAvailable]);

  /**
   * Schedules a debounced save.
   */
  const scheduleSave = useCallback(() => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule new save
    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, SAVE_DEBOUNCE_MS);
  }, [performSave]);

  /**
   * Forces an immediate save, bypassing debounce.
   */
  const forceSave = useCallback(async () => {
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    await performSave();
  }, [performSave]);

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Loads an existing session or creates a new one for the given parsed data.
   */
  const loadOrCreateSession = useCallback(
    async (
      parsedData: ParsedDRFFile
    ): Promise<{ wasRestored: boolean; session: SavedSession }> => {
      if (!isStorageAvailable) {
        // If storage not available, create in-memory session
        const newSession = createNewSession(parsedData);
        setSession(newSession);
        setCurrentFilenameKey(newSession.filename);
        setWasRestored(false);
        return { wasRestored: false, session: newSession };
      }

      const filenameKey = extractFilenameKey(parsedData.filename);

      try {
        // Try to load existing session
        const existingSession = await loadSession(filenameKey);

        if (existingSession) {
          // Restore existing session
          // Update lastAccessedAt
          existingSession.lastAccessedAt = new Date().toISOString();

          // Save the updated timestamp
          await saveSession(existingSession);

          setSession(existingSession);
          setCurrentFilenameKey(filenameKey);
          setWasRestored(true);

          console.log('[SessionPersistence] Restored existing session:', filenameKey);
          return { wasRestored: true, session: existingSession };
        }
      } catch (error) {
        console.error('[SessionPersistence] Error loading session:', error);
      }

      // Create new session
      const newSession = createNewSession(parsedData);

      try {
        await saveSession(newSession);
      } catch (error) {
        console.error('[SessionPersistence] Error saving new session:', error);
      }

      setSession(newSession);
      setCurrentFilenameKey(filenameKey);
      setWasRestored(false);

      console.log('[SessionPersistence] Created new session:', filenameKey);
      return { wasRestored: false, session: newSession };
    },
    [isStorageAvailable]
  );

  /**
   * Updates state for a specific race with debounced save.
   */
  const updateRaceState = useCallback(
    (raceIndex: number, updates: RaceStateUpdate) => {
      if (!session) return;

      // Update local session state immediately for responsive UI
      setSession((prev) => {
        if (!prev) return prev;

        const updatedSession = { ...prev };
        if (!updatedSession.raceStates[raceIndex]) {
          updatedSession.raceStates[raceIndex] = {
            sortColumn: 'POST',
            sortDirection: 'asc',
            scratches: [],
            oddsOverrides: {},
            trackCondition: 'fast',
          };
        }

        // Apply updates
        if (updates.sortColumn !== undefined) {
          updatedSession.raceStates[raceIndex] = {
            ...updatedSession.raceStates[raceIndex],
            sortColumn: updates.sortColumn,
          };
        }
        if (updates.sortDirection !== undefined) {
          updatedSession.raceStates[raceIndex] = {
            ...updatedSession.raceStates[raceIndex],
            sortDirection: updates.sortDirection,
          };
        }
        if (updates.scratches !== undefined) {
          updatedSession.raceStates[raceIndex] = {
            ...updatedSession.raceStates[raceIndex],
            scratches: updates.scratches,
          };
        }
        if (updates.oddsOverrides !== undefined) {
          updatedSession.raceStates[raceIndex] = {
            ...updatedSession.raceStates[raceIndex],
            oddsOverrides: updates.oddsOverrides,
          };
        }
        if (updates.trackCondition !== undefined) {
          updatedSession.raceStates[raceIndex] = {
            ...updatedSession.raceStates[raceIndex],
            trackCondition: updates.trackCondition,
          };
        }

        return updatedSession;
      });

      // Queue update for debounced save
      const existingUpdates = pendingUpdatesRef.current.get(raceIndex) || {};
      pendingUpdatesRef.current.set(raceIndex, { ...existingUpdates, ...updates });

      // Schedule debounced save
      scheduleSave();
    },
    [session, scheduleSave]
  );

  /**
   * Gets the current state for a specific race.
   */
  const getRaceState = useCallback(
    (raceIndex: number): PersistedRaceState | null => {
      if (!session) return null;
      return session.raceStates[raceIndex] || null;
    },
    [session]
  );

  /**
   * Resets a specific race to default state.
   */
  const resetRace = useCallback(
    async (raceIndex: number) => {
      if (!session || !currentFilenameKey) return;

      // Clear pending updates for this race
      pendingUpdatesRef.current.delete(raceIndex);

      // Reset in storage
      if (isStorageAvailable) {
        await resetRaceStateStorage(currentFilenameKey, raceIndex);
      }

      // Update local state
      setSession((prev) => {
        if (!prev) return prev;

        const updatedSession = { ...prev };
        updatedSession.raceStates[raceIndex] = {
          sortColumn: 'POST',
          sortDirection: 'asc',
          scratches: [],
          oddsOverrides: {},
          trackCondition: 'fast',
        };
        updatedSession.lastAccessedAt = new Date().toISOString();

        return updatedSession;
      });
    },
    [session, currentFilenameKey, isStorageAvailable]
  );

  /**
   * Resets all races to default state.
   */
  const resetAllRaces = useCallback(async () => {
    if (!session || !currentFilenameKey) return;

    // Clear all pending updates
    pendingUpdatesRef.current.clear();

    // Reset in storage
    if (isStorageAvailable) {
      await resetAllRaceStatesStorage(currentFilenameKey);
    }

    // Update local state
    setSession((prev) => {
      if (!prev) return prev;

      const updatedSession = { ...prev };
      const raceCount = updatedSession.parsedData.races.length;

      updatedSession.raceStates = {};
      for (let i = 0; i < raceCount; i++) {
        updatedSession.raceStates[i] = {
          sortColumn: 'POST',
          sortDirection: 'asc',
          scratches: [],
          oddsOverrides: {},
          trackCondition: 'fast',
        };
      }
      updatedSession.lastAccessedAt = new Date().toISOString();

      return updatedSession;
    });
  }, [session, currentFilenameKey, isStorageAvailable]);

  /**
   * Clears the current session from memory.
   */
  const clearSession = useCallback(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingUpdatesRef.current.clear();

    setSession(null);
    setCurrentFilenameKey(null);
    setWasRestored(false);
  }, []);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Save any pending changes when the window is about to unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Perform synchronous save of pending updates
      if (session && pendingUpdatesRef.current.size > 0) {
        // Note: IndexedDB operations are async, but we do our best
        // The debounced save should have already captured most changes
        forceSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [session, forceSave]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return useMemo(
    () => ({
      // State
      isStorageAvailable,
      currentFilenameKey,
      wasRestored,
      isSaving,
      session,
      // Actions
      loadOrCreateSession,
      updateRaceState,
      getRaceState,
      resetRace,
      resetAllRaces,
      clearSession,
      forceSave,
    }),
    [
      isStorageAvailable,
      currentFilenameKey,
      wasRestored,
      isSaving,
      session,
      loadOrCreateSession,
      updateRaceState,
      getRaceState,
      resetRace,
      resetAllRaces,
      clearSession,
      forceSave,
    ]
  );
}

// ============================================================================
// UTILITY HOOK FOR RACE-SPECIFIC STATE
// ============================================================================

/**
 * Hook to get and update state for a specific race.
 * Convenience wrapper around useSessionPersistence for single-race usage.
 */
export function usePersistedRaceState(
  sessionPersistence: UseSessionPersistenceReturn,
  raceIndex: number
): {
  state: PersistedRaceState | null;
  updateState: (updates: RaceStateUpdate) => void;
  resetState: () => Promise<void>;
} {
  const state = sessionPersistence.getRaceState(raceIndex);

  const updateState = useCallback(
    (updates: RaceStateUpdate) => {
      sessionPersistence.updateRaceState(raceIndex, updates);
    },
    [sessionPersistence, raceIndex]
  );

  const resetState = useCallback(async () => {
    await sessionPersistence.resetRace(raceIndex);
  }, [sessionPersistence, raceIndex]);

  return { state, updateState, resetState };
}
