/**
 * useLiveSessionAdmin Hook
 *
 * Admin-side hook for managing live session sharing.
 * Handles creating sessions, syncing updates, and ending sessions.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  createLiveSession,
  endLiveSession,
  syncAllRaces,
  updateLiveSessionRace,
  updateLiveSessionHorse,
  updateLiveSessionHorses,
  syncMultiRaceBets,
  isLiveSharingAvailable,
  type LiveSession,
} from '../lib/supabase';
import { getShareUrl } from '../lib/supabase/shareCode';
import type { DaySession } from '../lib/betting/daySession';
import type { RaceAllocation } from '../lib/betting/allocateDayBudget';
import type { MultiRaceBet } from '../lib/betting/betTypes';
import type { ScoredHorse } from '../lib/scoring';

interface UseLiveSessionAdminReturn {
  /** Whether live sharing is available (Supabase configured) */
  isAvailable: boolean;
  /** Whether sharing is currently active */
  isSharing: boolean;
  /** Current live session (if sharing) */
  liveSession: LiveSession | null;
  /** Share URL for the current session */
  shareUrl: string | null;
  /** Error message (if any) */
  error: string | null;
  /** Loading state */
  isLoading: boolean;

  /** Start sharing a day session */
  startSharing: (daySession: DaySession, trackCode?: string) => Promise<boolean>;
  /** Stop sharing */
  stopSharing: () => Promise<void>;

  /** Sync all races (call after initial setup or bulk updates) */
  syncRaces: (allocations: RaceAllocation[]) => Promise<void>;
  /** Sync a single race update */
  syncRaceUpdate: (
    raceNumber: number,
    data: {
      verdict?: string;
      confidence?: string;
      valuePlayPost?: number | null;
      valuePlayName?: string | null;
      valuePlayOdds?: string | null;
      valuePlayEdge?: number | null;
      betSuggestions?: Record<string, unknown> | null;
      trackCondition?: string | null;
      allocatedBudget?: number | null;
    }
  ) => Promise<void>;

  /** Sync horse odds update */
  syncOddsChange: (
    raceNumber: number,
    postPosition: number,
    horseName: string,
    newOdds: string,
    edge?: number | null,
    valueStatus?: string | null
  ) => Promise<void>;

  /** Sync horse scratch */
  syncScratch: (
    raceNumber: number,
    postPosition: number,
    horseName: string,
    isScratched: boolean
  ) => Promise<void>;

  /** Sync all horses for a race */
  syncHorses: (
    raceNumber: number,
    horses: Array<{
      postPosition: number;
      horseName: string;
      morningLine?: string | null;
      liveOdds?: string | null;
      fairOdds?: string | null;
      edge?: number | null;
      isScratched?: boolean;
      modelRank?: number | null;
      valueStatus?: string | null;
    }>
  ) => Promise<void>;

  /** Sync multi-race bets */
  syncMultiRace: (bets: MultiRaceBet[]) => Promise<void>;

  /** Convenience: sync from scored horses */
  syncFromScoredHorses: (
    raceNumber: number,
    scoredHorses: ScoredHorse[],
    getOdds: (index: number, defaultOdds: string) => string,
    isScratched: (index: number) => boolean
  ) => Promise<void>;
}

export function useLiveSessionAdmin(): UseLiveSessionAdminReturn {
  const [isSharing, setIsSharing] = useState(false);
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Keep track of session ID in a ref for callbacks
  const sessionIdRef = useRef<string | null>(null);

  // Update ref when session changes
  useEffect(() => {
    sessionIdRef.current = liveSession?.id ?? null;
  }, [liveSession]);

  const isAvailable = isLiveSharingAvailable();

  const shareUrl = liveSession ? getShareUrl(liveSession.shareCode) : null;

  // Start sharing a day session
  const startSharing = useCallback(
    async (daySession: DaySession, trackCode?: string): Promise<boolean> => {
      if (!isAvailable) {
        setError('Live sharing is not configured');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await createLiveSession(daySession, trackCode);
        if (!result) {
          setError('Failed to create live session');
          setIsLoading(false);
          return false;
        }

        setLiveSession(result.session);
        setIsSharing(true);
        sessionIdRef.current = result.session.id;

        // Sync all race allocations
        await syncAllRaces(result.session.id, daySession.raceAllocations);

        // Sync multi-race bets if any
        if (daySession.multiRaceBets.length > 0) {
          await syncMultiRaceBets(result.session.id, daySession.multiRaceBets);
        }

        setIsLoading(false);
        return true;
      } catch (err) {
        console.error('Error starting live session:', err);
        setError('Failed to start sharing');
        setIsLoading(false);
        return false;
      }
    },
    [isAvailable]
  );

  // Stop sharing
  const stopSharing = useCallback(async () => {
    if (!sessionIdRef.current) return;

    setIsLoading(true);
    try {
      await endLiveSession(sessionIdRef.current);
    } catch (err) {
      console.error('Error ending live session:', err);
    }

    setIsSharing(false);
    setLiveSession(null);
    sessionIdRef.current = null;
    setIsLoading(false);
  }, []);

  // Sync all races
  const syncRaces = useCallback(async (allocations: RaceAllocation[]) => {
    if (!sessionIdRef.current) return;
    await syncAllRaces(sessionIdRef.current, allocations);
  }, []);

  // Sync a single race update
  const syncRaceUpdate = useCallback(
    async (
      raceNumber: number,
      data: {
        verdict?: string;
        confidence?: string;
        valuePlayPost?: number | null;
        valuePlayName?: string | null;
        valuePlayOdds?: string | null;
        valuePlayEdge?: number | null;
        betSuggestions?: Record<string, unknown> | null;
        trackCondition?: string | null;
        allocatedBudget?: number | null;
      }
    ) => {
      if (!sessionIdRef.current) return;
      await updateLiveSessionRace(sessionIdRef.current, raceNumber, data);
    },
    []
  );

  // Sync horse odds change
  const syncOddsChange = useCallback(
    async (
      raceNumber: number,
      postPosition: number,
      horseName: string,
      newOdds: string,
      edge?: number | null,
      valueStatus?: string | null
    ) => {
      if (!sessionIdRef.current) return;
      await updateLiveSessionHorse(sessionIdRef.current, raceNumber, {
        postPosition,
        horseName,
        liveOdds: newOdds,
        edge,
        valueStatus,
      });
    },
    []
  );

  // Sync horse scratch
  const syncScratch = useCallback(
    async (
      raceNumber: number,
      postPosition: number,
      horseName: string,
      isScratched: boolean
    ) => {
      if (!sessionIdRef.current) return;
      await updateLiveSessionHorse(sessionIdRef.current, raceNumber, {
        postPosition,
        horseName,
        isScratched,
      });
    },
    []
  );

  // Sync all horses for a race
  const syncHorses = useCallback(
    async (
      raceNumber: number,
      horses: Array<{
        postPosition: number;
        horseName: string;
        morningLine?: string | null;
        liveOdds?: string | null;
        fairOdds?: string | null;
        edge?: number | null;
        isScratched?: boolean;
        modelRank?: number | null;
        valueStatus?: string | null;
      }>
    ) => {
      if (!sessionIdRef.current) return;
      await updateLiveSessionHorses(sessionIdRef.current, raceNumber, horses);
    },
    []
  );

  // Sync multi-race bets
  const syncMultiRace = useCallback(async (bets: MultiRaceBet[]) => {
    if (!sessionIdRef.current) return;
    await syncMultiRaceBets(sessionIdRef.current, bets);
  }, []);

  // Convenience: sync from scored horses
  const syncFromScoredHorses = useCallback(
    async (
      raceNumber: number,
      scoredHorses: ScoredHorse[],
      getOdds: (index: number, defaultOdds: string) => string,
      isScratched: (index: number) => boolean
    ) => {
      if (!sessionIdRef.current) return;

      const horses = scoredHorses.map((scoredHorse, index) => {
        const morningLine = scoredHorse.horse.morningLineOdds;
        const currentOdds = getOdds(index, morningLine);
        // Get edge from overlay result if available
        const edge = scoredHorse.score.overlayResult?.rawScore ?? null;
        return {
          postPosition: scoredHorse.horse.postPosition,
          horseName: scoredHorse.horse.horseName,
          morningLine,
          liveOdds: currentOdds,
          fairOdds: null, // Would need to calculate from probabilities
          edge: edge !== null ? Math.round(edge) : null,
          isScratched: isScratched(index),
          modelRank: scoredHorse.rank,
          valueStatus: getValueStatus(edge),
        };
      });

      await updateLiveSessionHorses(sessionIdRef.current, raceNumber, horses);
    },
    []
  );

  return {
    isAvailable,
    isSharing,
    liveSession,
    shareUrl,
    error,
    isLoading,
    startSharing,
    stopSharing,
    syncRaces,
    syncRaceUpdate,
    syncOddsChange,
    syncScratch,
    syncHorses,
    syncMultiRace,
    syncFromScoredHorses,
  };
}

// Helper to determine value status from edge
function getValueStatus(edge: number | null | undefined): string | null {
  if (edge === null || edge === undefined) return null;
  if (edge >= 50) return 'OVERLAY';
  if (edge >= -10) return 'FAIR';
  return 'UNDERLAY';
}

export default useLiveSessionAdmin;
