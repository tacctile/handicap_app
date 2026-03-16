/**
 * TwinSpires Polling Hook
 *
 * Manages polling the TwinSpires entries API every 10 seconds
 * for all races in a parsed DRF session. Provides live odds,
 * scratch updates, and edge delta calculations.
 */

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { logger } from '../services/logging';
import { fetchTwinSpiresEntries } from '../services/twinspires/client';
import {
  mapTwinSpiresEntriesToOdds,
  mapTwinSpiresEntriesToScratches,
  validateTrackMatch,
  extractTrackInfoFromUrl,
} from '../services/twinspires/mapper';
import type { ParsedDRFFile } from '../types/drf';
import type { TwinSpiresConnectionStatus } from '../services/twinspires/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Polling interval in milliseconds */
const POLL_INTERVAL_MS = 10_000;

// ============================================================================
// HOOK TYPES
// ============================================================================

export interface UseTwinSpiresPollingOptions {
  parsedData: ParsedDRFFile;
  onOddsUpdate: (raceIndex: number, oddsMap: Record<string, string>) => void;
  onScratchUpdate: (raceIndex: number, scratchedPrograms: Set<string>) => void;
  onEdgeUpdate: (
    raceIndex: number,
    previousEdges: Record<string, number>,
    newEdges: Record<string, number>
  ) => void;
}

export interface UseTwinSpiresPollingReturn {
  connect: (url: string) => void;
  disconnect: () => void;
  status: TwinSpiresConnectionStatus;
  lastUpdated: number | null;
  error: string | null;
}

// ============================================================================
// HELPER: EXTRACT EDGE DATA
// ============================================================================

/**
 * Convert an odds map to numeric edge values for delta calculation.
 * Parses fractional odds like "5-2" to numeric 2.5.
 */
function oddsToEdgeMap(oddsMap: Record<string, string>): Record<string, number> {
  const edges: Record<string, number> = {};
  for (const [prog, oddsStr] of Object.entries(oddsMap)) {
    const parts = oddsStr.split('-');
    if (parts.length === 2 && parts[0] !== undefined && parts[1] !== undefined) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den > 0) {
        edges[prog] = num / den;
      }
    } else {
      const val = parseFloat(oddsStr);
      if (!isNaN(val)) {
        edges[prog] = val;
      }
    }
  }
  return edges;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useTwinSpiresPolling(
  options: UseTwinSpiresPollingOptions
): UseTwinSpiresPollingReturn {
  const { parsedData, onOddsUpdate, onScratchUpdate, onEdgeUpdate } = options;

  const [status, setStatus] = useState<TwinSpiresConnectionStatus>('disconnected');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs for mutable state that shouldn't trigger re-renders
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const trackInfoRef = useRef<{ trackCode: string; raceType: string } | null>(null);
  const isFirstPollRef = useRef(true);
  const previousOddsRef = useRef<Map<number, Record<string, string>>>(new Map());

  // Store latest callbacks and data in refs to avoid stale closures.
  // useLayoutEffect runs synchronously before paint, so refs are always
  // current before any user event handlers or intervals can read them.
  const onOddsUpdateRef = useRef(onOddsUpdate);
  const onScratchUpdateRef = useRef(onScratchUpdate);
  const onEdgeUpdateRef = useRef(onEdgeUpdate);
  const parsedDataRef = useRef(parsedData);

  useLayoutEffect(() => {
    onOddsUpdateRef.current = onOddsUpdate;
    onScratchUpdateRef.current = onScratchUpdate;
    onEdgeUpdateRef.current = onEdgeUpdate;
    parsedDataRef.current = parsedData;
  });

  /**
   * Clean up interval and abort controller.
   */
  const cleanupPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Poll all races simultaneously using Promise.allSettled.
   */
  const pollAllRaces = useCallback(async () => {
    const trackInfo = trackInfoRef.current;
    const currentParsedData = parsedDataRef.current;
    if (!trackInfo) return;

    const raceCount = currentParsedData.races.length;
    const signal = abortControllerRef.current?.signal;

    if (raceCount === 0) {
      logger.logWarning('[TwinSpires] pollAllRaces called with 0 races — skipping', {
        component: 'TwinSpiresPolling',
      });
      return;
    }

    logger.logInfo(
      `[TwinSpires] Polling ${raceCount} races for ${trackInfo.trackCode}/${trackInfo.raceType}`,
      {
        component: 'TwinSpiresPolling',
      }
    );

    const racePromises = Array.from({ length: raceCount }, (_, raceIndex) => {
      const race = currentParsedData.races[raceIndex];
      if (!race) return Promise.reject(new Error(`Race ${raceIndex} not found`));
      const raceNumber = race.header.raceNumber;

      return fetchTwinSpiresEntries(
        trackInfo.trackCode,
        trackInfo.raceType,
        raceNumber,
        signal
      ).then((entries) => ({ raceIndex, entries, raceNumber }));
    });

    const results = await Promise.allSettled(racePromises);

    // Check if we were aborted during the poll
    if (signal?.aborted) return;

    let anySuccess = false;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { raceIndex, entries } = result.value;

        // Validate track match on first successful poll
        if (isFirstPollRef.current) {
          const isValid = validateTrackMatch(entries, currentParsedData, raceIndex);
          if (!isValid) {
            logger.logWarning('[TwinSpires] Track mismatch detected — disconnecting', {
              component: 'TwinSpiresPolling',
            });
            setStatus('error');
            setError('TRACK_MISMATCH: Horse names do not match between TwinSpires and DRF data');
            // Disconnect on mismatch
            cleanupPolling();
            return;
          }
          isFirstPollRef.current = false;
        }

        // Map odds and scratches
        const oddsMap = mapTwinSpiresEntriesToOdds(entries);
        const scratchedPrograms = mapTwinSpiresEntriesToScratches(entries);

        // Calculate edge deltas
        const previousOdds = previousOddsRef.current.get(raceIndex) ?? {};
        const previousEdges = oddsToEdgeMap(previousOdds);
        const newEdges = oddsToEdgeMap(oddsMap);

        // Store current odds for next delta calculation
        previousOddsRef.current.set(raceIndex, { ...oddsMap });

        // Fire callbacks
        onOddsUpdateRef.current(raceIndex, oddsMap);
        onScratchUpdateRef.current(raceIndex, scratchedPrograms);
        onEdgeUpdateRef.current(raceIndex, previousEdges, newEdges);

        anySuccess = true;
      } else {
        logger.logWarning(`[TwinSpires] Race poll failed: ${result.reason?.message ?? 'Unknown'}`, {
          component: 'TwinSpiresPolling',
        });
      }
    }

    if (anySuccess) {
      setLastUpdated(Date.now());
      setStatus('polling');
    }
  }, [cleanupPolling]);

  /**
   * Connect to TwinSpires and begin polling.
   */
  const connect = useCallback(
    (url: string) => {
      // Parse URL to extract track info
      const trackInfo = extractTrackInfoFromUrl(url);
      if (!trackInfo) {
        logger.logWarning('[TwinSpires] Failed to parse URL', {
          component: 'TwinSpiresPolling',
        });
        setStatus('error');
        setError('Invalid TwinSpires URL format');
        return;
      }

      // Clean up any existing polling
      cleanupPolling();

      const currentRaceCount = parsedDataRef.current.races.length;
      logger.logInfo(
        `[TwinSpires] Connecting: track=${trackInfo.trackCode}, type=${trackInfo.raceType}, races=${currentRaceCount}`,
        { component: 'TwinSpiresPolling' }
      );

      if (currentRaceCount === 0) {
        logger.logWarning('[TwinSpires] parsedData has 0 races at connect time — cannot poll', {
          component: 'TwinSpiresPolling',
        });
        setStatus('error');
        setError('No race data loaded — upload a DRF file first');
        return;
      }

      // Store track info
      trackInfoRef.current = {
        trackCode: trackInfo.trackCode,
        raceType: trackInfo.raceType,
      };
      isFirstPollRef.current = true;
      previousOddsRef.current.clear();

      // Set up abort controller
      abortControllerRef.current = new AbortController();

      setStatus('connecting');
      setError(null);

      // Initial poll immediately
      pollAllRaces()
        .then(() => {
          // Set up interval for subsequent polls (only if not errored)
          if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
            intervalRef.current = setInterval(() => {
              pollAllRaces();
            }, POLL_INTERVAL_MS);
          }
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Unknown polling error';
          logger.logError(
            err instanceof Error ? err : new Error(`[TwinSpires] Poll cycle failed: ${message}`),
            { component: 'TwinSpiresPolling' }
          );
          setStatus('error');
          setError(message);
        });
    },
    [cleanupPolling, pollAllRaces]
  );

  /**
   * Disconnect and stop polling.
   */
  const disconnect = useCallback(() => {
    logger.logInfo('[TwinSpires] Disconnecting', { component: 'TwinSpiresPolling' });
    cleanupPolling();
    trackInfoRef.current = null;
    setStatus('disconnected');
    setError(null);
  }, [cleanupPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPolling();
    };
  }, [cleanupPolling]);

  return {
    connect,
    disconnect,
    status,
    lastUpdated,
    error,
  };
}
