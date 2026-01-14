import { useState, useCallback, useMemo, useEffect } from 'react';
import type { TrackCondition } from '../types/drf';
import type { PersistedRaceState } from '../services/storage/sessions';

// Re-export for convenience
export type { TrackCondition };

export interface TrackConditionOption {
  value: TrackCondition;
  label: string;
  surface: 'dirt' | 'turf' | 'both';
}

// Complete track conditions for dirt and turf surfaces
// Dirt: fast → good → slow → muddy → sloppy → heavy
// Turf: firm → good → yielding → soft → heavy
export const TRACK_CONDITIONS: TrackConditionOption[] = [
  // Dirt conditions (best to worst)
  { value: 'fast', label: 'Fast', surface: 'dirt' },
  { value: 'good', label: 'Good', surface: 'both' },
  { value: 'slow', label: 'Slow', surface: 'dirt' },
  { value: 'muddy', label: 'Muddy', surface: 'dirt' },
  { value: 'sloppy', label: 'Sloppy', surface: 'dirt' },
  // Turf conditions (best to worst)
  { value: 'firm', label: 'Firm', surface: 'turf' },
  { value: 'yielding', label: 'Yielding', surface: 'turf' },
  { value: 'soft', label: 'Soft', surface: 'turf' },
  // Heavy applies to both surfaces
  { value: 'heavy', label: 'Heavy', surface: 'both' },
];

// Updated odds mapping: horse index -> new odds string
export type OddsUpdate = Record<number, string>;

export interface RaceState {
  trackCondition: TrackCondition;
  scratchedHorses: Set<number>;
  updatedOdds: OddsUpdate;
}

// Calculation state for real-time updates
export interface CalculationState {
  isCalculating: boolean;
  lastCalculatedAt: number | null;
  calculationVersion: number;
  changedHorseIndices: Set<number>;
  changedTierIndices: Set<number>;
  changedOddsIndices: Set<number>;
}

// History entry for undo functionality
export interface HistoryEntry {
  timestamp: number;
  trackCondition: TrackCondition;
  scratchedHorses: Set<number>;
  updatedOdds: OddsUpdate;
  description: string;
}

export interface RaceStateActions {
  setTrackCondition: (condition: TrackCondition) => void;
  toggleScratch: (horseIndex: number) => void;
  setScratch: (horseIndex: number, scratched: boolean) => void;
  updateOdds: (horseIndex: number, newOdds: string) => void;
  resetOdds: (horseIndex: number) => void;
  resetAll: () => void;
  storeOriginalOdds: (originalOdds: Record<number, string>) => void;
  clearChangeHighlights: () => void;
  /** Initialize state from persisted data (for session restoration) */
  initializeFromPersisted: (state: PersistedRaceState) => void;
  /** Get current state for serialization (for session saving) */
  getSerializableState: () => Pick<PersistedRaceState, 'scratches' | 'oddsOverrides' | 'trackCondition'>;
}

export interface UseRaceStateReturn extends RaceState, RaceStateActions {
  isScratched: (horseIndex: number) => boolean;
  getOdds: (horseIndex: number, originalOdds: string) => string;
  hasOddsChanged: (horseIndex: number) => boolean;
  // Calculation state
  calculationState: CalculationState;
  // History
  history: HistoryEntry[];
  canUndo: boolean;
  // Original state for reset
  originalOdds: Record<number, string>;
  hasChanges: boolean;
}

const initialState: RaceState = {
  trackCondition: 'fast',
  scratchedHorses: new Set(),
  updatedOdds: {},
};

const initialCalculationState: CalculationState = {
  isCalculating: false,
  lastCalculatedAt: null,
  calculationVersion: 0,
  changedHorseIndices: new Set(),
  changedTierIndices: new Set(),
  changedOddsIndices: new Set(),
};

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useRaceState(): UseRaceStateReturn {
  const [trackCondition, setTrackConditionState] = useState<TrackCondition>(
    initialState.trackCondition
  );
  const [scratchedHorses, setScratchedHorses] = useState<Set<number>>(initialState.scratchedHorses);
  const [updatedOdds, setUpdatedOdds] = useState<OddsUpdate>(initialState.updatedOdds);

  // Original odds storage for reset functionality
  const [originalOdds, setOriginalOdds] = useState<Record<number, string>>({});

  // Calculation state
  const [calculationState, setCalculationState] =
    useState<CalculationState>(initialCalculationState);

  // History for undo
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const maxHistoryLength = 50;

  // Debounced state version for triggering recalculation
  const stateVersion = useMemo(
    () => ({
      trackCondition,
      scratchedCount: scratchedHorses.size,
      oddsCount: Object.keys(updatedOdds).length,
      version: calculationState.calculationVersion,
    }),
    [trackCondition, scratchedHorses.size, updatedOdds, calculationState.calculationVersion]
  );

  const debouncedStateVersion = useDebounce(stateVersion, 300);

  // Effect to handle debounced recalculation trigger
  useEffect(() => {
    if (debouncedStateVersion.version !== calculationState.calculationVersion) {
      // Mark calculation as complete and update timestamp
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing debounced state
      setCalculationState((prev) => ({
        ...prev,
        isCalculating: false,
        lastCalculatedAt: Date.now(),
      }));
    }
  }, [debouncedStateVersion, calculationState.calculationVersion]);

  // Add to history helper
  const addToHistory = useCallback(
    (description: string) => {
      setHistory((prev) => {
        const entry: HistoryEntry = {
          timestamp: Date.now(),
          trackCondition,
          scratchedHorses: new Set(scratchedHorses),
          updatedOdds: { ...updatedOdds },
          description,
        };
        const newHistory = [entry, ...prev].slice(0, maxHistoryLength);
        return newHistory;
      });
    },
    [trackCondition, scratchedHorses, updatedOdds]
  );

  // Trigger recalculation
  const triggerRecalculation = useCallback(
    (changedIndices?: Set<number>, changeType?: 'score' | 'tier' | 'odds') => {
      setCalculationState((prev) => ({
        ...prev,
        isCalculating: true,
        calculationVersion: prev.calculationVersion + 1,
        changedHorseIndices:
          changeType === 'score' && changedIndices ? changedIndices : prev.changedHorseIndices,
        changedTierIndices:
          changeType === 'tier' && changedIndices ? changedIndices : prev.changedTierIndices,
        changedOddsIndices:
          changeType === 'odds' && changedIndices ? changedIndices : prev.changedOddsIndices,
      }));
    },
    []
  );

  // Clear change highlights (called after animation completes)
  const clearChangeHighlights = useCallback(() => {
    setCalculationState((prev) => ({
      ...prev,
      changedHorseIndices: new Set(),
      changedTierIndices: new Set(),
      changedOddsIndices: new Set(),
    }));
  }, []);

  // Set track condition with history
  const setTrackCondition = useCallback(
    (condition: TrackCondition) => {
      addToHistory(`Track condition changed to ${condition}`);
      setTrackConditionState(condition);
      triggerRecalculation(undefined, 'score');
    },
    [addToHistory, triggerRecalculation]
  );

  // Toggle scratch status for a horse
  const toggleScratch = useCallback(
    (horseIndex: number) => {
      setScratchedHorses((prev) => {
        const next = new Set(prev);
        const willBeScratched = !next.has(horseIndex);
        if (willBeScratched) {
          next.add(horseIndex);
        } else {
          next.delete(horseIndex);
        }
        return next;
      });
      addToHistory(
        `Horse ${horseIndex} ${scratchedHorses.has(horseIndex) ? 'unscratched' : 'scratched'}`
      );
      triggerRecalculation(new Set([horseIndex]), 'score');
    },
    [addToHistory, triggerRecalculation, scratchedHorses]
  );

  // Set scratch status explicitly
  const setScratch = useCallback(
    (horseIndex: number, scratched: boolean) => {
      setScratchedHorses((prev) => {
        const next = new Set(prev);
        if (scratched) {
          next.add(horseIndex);
        } else {
          next.delete(horseIndex);
        }
        return next;
      });
      addToHistory(`Horse ${horseIndex} ${scratched ? 'scratched' : 'unscratched'}`);
      triggerRecalculation(new Set([horseIndex]), 'score');
    },
    [addToHistory, triggerRecalculation]
  );

  // Update odds for a horse
  const updateOdds = useCallback(
    (horseIndex: number, newOdds: string) => {
      setUpdatedOdds((prev) => ({
        ...prev,
        [horseIndex]: newOdds,
      }));
      // Mark this horse as having odds change for highlight
      setCalculationState((prev) => ({
        ...prev,
        changedOddsIndices: new Set([...prev.changedOddsIndices, horseIndex]),
      }));
      triggerRecalculation(new Set([horseIndex]), 'odds');
    },
    [triggerRecalculation]
  );

  // Reset odds for a horse to original
  const resetOdds = useCallback(
    (horseIndex: number) => {
      setUpdatedOdds((prev) => {
        const next = { ...prev };
        delete next[horseIndex];
        return next;
      });
      triggerRecalculation(new Set([horseIndex]), 'odds');
    },
    [triggerRecalculation]
  );

  // Store original odds when race data is loaded
  const storeOriginalOdds = useCallback((odds: Record<number, string>) => {
    setOriginalOdds(odds);
  }, []);

  // Reset all state to initial
  const resetAll = useCallback(() => {
    addToHistory('Reset all changes');
    setTrackConditionState(initialState.trackCondition);
    setScratchedHorses(new Set());
    setUpdatedOdds({});
    setCalculationState(initialCalculationState);
  }, [addToHistory]);

  // Initialize state from persisted data (for session restoration)
  const initializeFromPersisted = useCallback((state: PersistedRaceState) => {
    // Set track condition
    setTrackConditionState(state.trackCondition);

    // Set scratched horses
    setScratchedHorses(new Set(state.scratches));

    // Set odds overrides
    setUpdatedOdds(state.oddsOverrides);

    // Reset calculation state
    setCalculationState(initialCalculationState);

    // Clear history for restored session
    setHistory([]);
  }, []);

  // Get current state for serialization (for session saving)
  const getSerializableState = useCallback((): Pick<PersistedRaceState, 'scratches' | 'oddsOverrides' | 'trackCondition'> => {
    return {
      scratches: Array.from(scratchedHorses),
      oddsOverrides: { ...updatedOdds },
      trackCondition,
    };
  }, [scratchedHorses, updatedOdds, trackCondition]);

  // Check if a horse is scratched
  const isScratched = useCallback(
    (horseIndex: number): boolean => {
      return scratchedHorses.has(horseIndex);
    },
    [scratchedHorses]
  );

  // Get current odds for a horse (updated or original)
  const getOdds = useCallback(
    (horseIndex: number, originalOdds: string): string => {
      return updatedOdds[horseIndex] ?? originalOdds;
    },
    [updatedOdds]
  );

  // Check if odds have been changed from original
  const hasOddsChanged = useCallback(
    (horseIndex: number): boolean => {
      return horseIndex in updatedOdds;
    },
    [updatedOdds]
  );

  // Check if there are any changes from original state
  const hasChanges = useMemo(() => {
    return (
      trackCondition !== initialState.trackCondition ||
      scratchedHorses.size > 0 ||
      Object.keys(updatedOdds).length > 0
    );
  }, [trackCondition, scratchedHorses.size, updatedOdds]);

  // Check if undo is available
  const canUndo = history.length > 0;

  return useMemo(
    () => ({
      // State
      trackCondition,
      scratchedHorses,
      updatedOdds,
      // Actions
      setTrackCondition,
      toggleScratch,
      setScratch,
      updateOdds,
      resetOdds,
      resetAll,
      storeOriginalOdds,
      clearChangeHighlights,
      initializeFromPersisted,
      getSerializableState,
      // Helpers
      isScratched,
      getOdds,
      hasOddsChanged,
      // Calculation state
      calculationState,
      // History
      history,
      canUndo,
      // Original state
      originalOdds,
      hasChanges,
    }),
    [
      trackCondition,
      scratchedHorses,
      updatedOdds,
      setTrackCondition,
      toggleScratch,
      setScratch,
      updateOdds,
      resetOdds,
      resetAll,
      storeOriginalOdds,
      clearChangeHighlights,
      initializeFromPersisted,
      getSerializableState,
      isScratched,
      getOdds,
      hasOddsChanged,
      calculationState,
      history,
      canUndo,
      originalOdds,
      hasChanges,
    ]
  );
}
