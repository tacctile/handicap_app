/**
 * useDiagnostics Hook
 *
 * Manages the diagnostics analysis lifecycle:
 * - On mount, checks IndexedDB cache for valid results
 * - If cache hit: sets results immediately
 * - If cache miss: runs analysis with progress tracking
 * - Provides a rerun() function to force fresh analysis
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { runDiagnostics, clearDiagnosticsCache } from '../services/diagnostics';
import type {
  DiagnosticsResults,
  AnalysisStatus,
  AnalysisProgress,
} from '../services/diagnostics/types';
import { logger } from '../services/logging';

export interface UseDiagnosticsReturn {
  /** The analysis results (null until complete) */
  results: DiagnosticsResults | null;
  /** Current status of the analysis */
  status: AnalysisStatus;
  /** Progress information while running */
  progress: AnalysisProgress | null;
  /** When results were last computed (ISO string) */
  lastRunTimestamp: string | null;
  /** Force a fresh analysis, ignoring the cache */
  rerun: () => void;
}

export function useDiagnostics(): UseDiagnosticsReturn {
  const [results, setResults] = useState<DiagnosticsResults | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [lastRunTimestamp, setLastRunTimestamp] = useState<string | null>(null);
  const runningRef = useRef(false);

  const execute = useCallback(async (ignoreCache: boolean) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('running');
    setProgress(null);

    try {
      if (ignoreCache) {
        await clearDiagnosticsCache();
      }

      const diagnosticsResults = await runDiagnostics((p) => setProgress(p), ignoreCache);

      setResults(diagnosticsResults);
      setLastRunTimestamp(diagnosticsResults.analyzedAt);
      setStatus('complete');
    } catch (error) {
      logger.logError(error instanceof Error ? error : new Error(String(error)), {
        component: 'useDiagnostics',
      });
      setStatus('error');
    } finally {
      runningRef.current = false;
    }
  }, []);

  // Run on mount
  useEffect(() => {
    execute(false);
  }, [execute]);

  const rerun = useCallback(() => {
    execute(true);
  }, [execute]);

  return {
    results,
    status,
    progress,
    lastRunTimestamp,
    rerun,
  };
}
