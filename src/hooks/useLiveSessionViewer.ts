/**
 * useLiveSessionViewer Hook
 *
 * Viewer-side hook for watching a live session.
 * Handles loading session data, real-time subscriptions, and viewer count.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getLiveSessionByCode,
  getLiveSessionRaces,
  getLiveSessionHorses,
  getLiveSessionMultiRaceBets,
  subscribeToLiveSession,
  incrementViewerCount,
  decrementViewerCount,
  type LiveSession,
  type LiveSessionRace,
  type LiveSessionHorse,
  type LiveSessionMultiRace,
} from '../lib/supabase';

interface UseLiveSessionViewerReturn {
  /** The live session (null if not found or expired) */
  session: LiveSession | null;
  /** All races in the session */
  races: LiveSessionRace[];
  /** Horses grouped by race number */
  horsesByRace: Record<number, LiveSessionHorse[]>;
  /** Multi-race bets */
  multiRaceBets: LiveSessionMultiRace[];
  /** Loading state */
  isLoading: boolean;
  /** Error message (if any) */
  error: string | null;
  /** Last update timestamp */
  lastUpdated: Date | null;
  /** Current viewer count */
  viewerCount: number;

  /** Refresh all data from the server */
  refresh: () => Promise<void>;

  /** Get race by number */
  getRace: (raceNumber: number) => LiveSessionRace | undefined;
  /** Get horses for a race */
  getHorsesForRace: (raceNumber: number) => LiveSessionHorse[];
}

export function useLiveSessionViewer(shareCode: string): UseLiveSessionViewerReturn {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [races, setRaces] = useState<LiveSessionRace[]>([]);
  const [horsesByRace, setHorsesByRace] = useState<Record<number, LiveSessionHorse[]>>({});
  const [multiRaceBets, setMultiRaceBets] = useState<LiveSessionMultiRace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewerCount, setViewerCount] = useState(0);

  // Track if we've registered as a viewer
  const registeredAsViewerRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  // Load session data
  const loadSession = useCallback(async () => {
    if (!shareCode) {
      setError('Invalid share code');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const sessionData = await getLiveSessionByCode(shareCode);
      if (!sessionData) {
        setError('Session not found or has expired');
        setIsLoading(false);
        return;
      }

      setSession(sessionData);
      setViewerCount(sessionData.viewerCount);
      sessionIdRef.current = sessionData.id;

      // Load races, horses, and multi-race bets in parallel
      const [racesData, horsesData, multiRaceData] = await Promise.all([
        getLiveSessionRaces(sessionData.id),
        getLiveSessionHorses(sessionData.id),
        getLiveSessionMultiRaceBets(sessionData.id),
      ]);

      setRaces(racesData);
      setMultiRaceBets(multiRaceData);

      // Group horses by race number
      const groupedHorses: Record<number, LiveSessionHorse[]> = {};
      horsesData.forEach((horse) => {
        if (!groupedHorses[horse.raceNumber]) {
          groupedHorses[horse.raceNumber] = [];
        }
        groupedHorses[horse.raceNumber]!.push(horse);
      });
      setHorsesByRace(groupedHorses);

      setLastUpdated(new Date());
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading session:', err);
      setError('Failed to load session');
      setIsLoading(false);
    }
  }, [shareCode]);

  // Initial load
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Register as viewer and set up real-time subscription
  useEffect(() => {
    if (!session) return;

    const sessionId = session.id;

    // Register as a viewer
    if (!registeredAsViewerRef.current) {
      incrementViewerCount(sessionId);
      registeredAsViewerRef.current = true;
    }

    // Subscribe to real-time updates
    const unsubscribe = subscribeToLiveSession(sessionId, {
      onSessionUpdate: (updatedSession) => {
        setSession(updatedSession);
        setViewerCount(updatedSession.viewerCount);
        setLastUpdated(new Date());
      },
      onRaceUpdate: (race) => {
        setRaces((prev) => {
          const index = prev.findIndex((r) => r.raceNumber === race.raceNumber);
          if (index >= 0) {
            const newRaces = [...prev];
            newRaces[index] = race;
            return newRaces;
          }
          return [...prev, race].sort((a, b) => a.raceNumber - b.raceNumber);
        });
        setLastUpdated(new Date());
      },
      onHorseUpdate: (horse) => {
        setHorsesByRace((prev) => {
          const raceHorses = prev[horse.raceNumber] || [];
          const index = raceHorses.findIndex(
            (h) => h.postPosition === horse.postPosition
          );
          if (index >= 0) {
            const newHorses = [...raceHorses];
            newHorses[index] = horse;
            return { ...prev, [horse.raceNumber]: newHorses };
          }
          return {
            ...prev,
            [horse.raceNumber]: [...raceHorses, horse].sort(
              (a, b) => a.postPosition - b.postPosition
            ),
          };
        });
        setLastUpdated(new Date());
      },
      onMultiRaceUpdate: (bets) => {
        setMultiRaceBets(bets);
        setLastUpdated(new Date());
      },
    });

    // Cleanup: unsubscribe and decrement viewer count
    return () => {
      unsubscribe();
      if (registeredAsViewerRef.current && sessionIdRef.current) {
        decrementViewerCount(sessionIdRef.current);
        registeredAsViewerRef.current = false;
      }
    };
  }, [session?.id]);

  // Handle page unload - decrement viewer count
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (registeredAsViewerRef.current && sessionIdRef.current) {
        // Use sendBeacon for reliable delivery on page unload
        // Note: sendBeacon doesn't support our Supabase client, so we just try the normal way
        decrementViewerCount(sessionIdRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Refresh all data
  const refresh = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  // Get race by number
  const getRace = useCallback(
    (raceNumber: number): LiveSessionRace | undefined => {
      return races.find((r) => r.raceNumber === raceNumber);
    },
    [races]
  );

  // Get horses for a race
  const getHorsesForRace = useCallback(
    (raceNumber: number): LiveSessionHorse[] => {
      return horsesByRace[raceNumber] || [];
    },
    [horsesByRace]
  );

  return {
    session,
    races,
    horsesByRace,
    multiRaceBets,
    isLoading,
    error,
    lastUpdated,
    viewerCount,
    refresh,
    getRace,
    getHorsesForRace,
  };
}

export default useLiveSessionViewer;
