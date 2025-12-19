import { useState, useCallback, useMemo } from 'react'

// Track condition options
export type TrackCondition =
  | 'fast'
  | 'good'
  | 'muddy'
  | 'sloppy'
  | 'yielding'
  | 'firm'

export interface TrackConditionOption {
  value: TrackCondition
  label: string
  surface: 'dirt' | 'turf' | 'both'
}

export const TRACK_CONDITIONS: TrackConditionOption[] = [
  { value: 'fast', label: 'Fast', surface: 'dirt' },
  { value: 'good', label: 'Good', surface: 'both' },
  { value: 'muddy', label: 'Muddy', surface: 'dirt' },
  { value: 'sloppy', label: 'Sloppy', surface: 'dirt' },
  { value: 'yielding', label: 'Yielding (Turf)', surface: 'turf' },
  { value: 'firm', label: 'Firm (Turf)', surface: 'turf' },
]

// Updated odds mapping: horse index -> new odds string
export type OddsUpdate = Record<number, string>

export interface RaceState {
  trackCondition: TrackCondition
  scratchedHorses: Set<number>
  updatedOdds: OddsUpdate
}

export interface RaceStateActions {
  setTrackCondition: (condition: TrackCondition) => void
  toggleScratch: (horseIndex: number) => void
  setScratch: (horseIndex: number, scratched: boolean) => void
  updateOdds: (horseIndex: number, newOdds: string) => void
  resetOdds: (horseIndex: number) => void
  resetAll: () => void
}

export interface UseRaceStateReturn extends RaceState, RaceStateActions {
  isScratched: (horseIndex: number) => boolean
  getOdds: (horseIndex: number, originalOdds: string) => string
  hasOddsChanged: (horseIndex: number) => boolean
}

const initialState: RaceState = {
  trackCondition: 'fast',
  scratchedHorses: new Set(),
  updatedOdds: {},
}

export function useRaceState(): UseRaceStateReturn {
  const [trackCondition, setTrackCondition] = useState<TrackCondition>(initialState.trackCondition)
  const [scratchedHorses, setScratchedHorses] = useState<Set<number>>(initialState.scratchedHorses)
  const [updatedOdds, setUpdatedOdds] = useState<OddsUpdate>(initialState.updatedOdds)

  // Toggle scratch status for a horse
  const toggleScratch = useCallback((horseIndex: number) => {
    setScratchedHorses(prev => {
      const next = new Set(prev)
      if (next.has(horseIndex)) {
        next.delete(horseIndex)
      } else {
        next.add(horseIndex)
      }
      return next
    })
  }, [])

  // Set scratch status explicitly
  const setScratch = useCallback((horseIndex: number, scratched: boolean) => {
    setScratchedHorses(prev => {
      const next = new Set(prev)
      if (scratched) {
        next.add(horseIndex)
      } else {
        next.delete(horseIndex)
      }
      return next
    })
  }, [])

  // Update odds for a horse
  const updateOdds = useCallback((horseIndex: number, newOdds: string) => {
    setUpdatedOdds(prev => ({
      ...prev,
      [horseIndex]: newOdds,
    }))
  }, [])

  // Reset odds for a horse to original
  const resetOdds = useCallback((horseIndex: number) => {
    setUpdatedOdds(prev => {
      const next = { ...prev }
      delete next[horseIndex]
      return next
    })
  }, [])

  // Reset all state to initial
  const resetAll = useCallback(() => {
    setTrackCondition(initialState.trackCondition)
    setScratchedHorses(new Set())
    setUpdatedOdds({})
  }, [])

  // Check if a horse is scratched
  const isScratched = useCallback((horseIndex: number): boolean => {
    return scratchedHorses.has(horseIndex)
  }, [scratchedHorses])

  // Get current odds for a horse (updated or original)
  const getOdds = useCallback((horseIndex: number, originalOdds: string): string => {
    return updatedOdds[horseIndex] ?? originalOdds
  }, [updatedOdds])

  // Check if odds have been changed from original
  const hasOddsChanged = useCallback((horseIndex: number): boolean => {
    return horseIndex in updatedOdds
  }, [updatedOdds])

  return useMemo(() => ({
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
    // Helpers
    isScratched,
    getOdds,
    hasOddsChanged,
  }), [
    trackCondition,
    scratchedHorses,
    updatedOdds,
    toggleScratch,
    setScratch,
    updateOdds,
    resetOdds,
    resetAll,
    isScratched,
    getOdds,
    hasOddsChanged,
  ])
}
