/**
 * useBetting Hook
 *
 * React hook that provides betting functionality based on Quarter-Kelly criterion.
 * Integrates bankroll tracking, bet recommendations, and session management.
 *
 * @module hooks/useBetting
 */

import { useState, useCallback, useMemo } from 'react';
import type { OverlayPipelineOutput } from '../lib/scoring/overlayPipeline';
import {
  BankrollTracker,
  type BankrollState,
  type BetSizingConfig,
  type RaceRecommendations,
  DEFAULT_BET_SIZING_CONFIG,
} from '../lib/betting';
import { generateBetRecommendations } from '../lib/betting/betRecommender';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Return type for the useBetting hook
 */
export interface UseBettingReturn {
  /** Current bankroll in dollars */
  bankroll: number;
  /** Set the current bankroll */
  setBankroll: (amount: number) => void;
  /** Current race recommendations */
  recommendations: RaceRecommendations | null;
  /** Generate recommendations for a race */
  generateRecommendations: (pipelineOutput: OverlayPipelineOutput) => RaceRecommendations;
  /** Record a bet being placed (deducts from bankroll) */
  placeBet: (amount: number) => void;
  /** Record a bet result (won or lost) */
  recordResult: (won: boolean, payout?: number) => void;
  /** Current bankroll state with all statistics */
  bankrollState: BankrollState;
  /** Reset the session with a new bankroll */
  resetSession: (newBankroll?: number) => void;
  /** Bet sizing configuration */
  config: BetSizingConfig;
  /** Update bet sizing configuration */
  updateConfig: (newConfig: Partial<BetSizingConfig>) => void;
  /** Whether the tracker has been initialized */
  isInitialized: boolean;
  /** Clear current recommendations */
  clearRecommendations: () => void;
  /** Save current session to localStorage */
  saveSession: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_INITIAL_BANKROLL = 250;
const STORAGE_KEY_CONFIG = 'furlong_betting_config';

/**
 * Load config from localStorage
 */
function loadConfig(): BetSizingConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_BET_SIZING_CONFIG, ...parsed };
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_BET_SIZING_CONFIG;
}

/**
 * Save config to localStorage
 */
function saveConfig(config: BetSizingConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * React hook for Quarter-Kelly betting functionality
 *
 * @param initialBankroll - Starting bankroll (default: $250)
 * @returns Betting functionality and state
 *
 * @example
 * const {
 *   bankroll,
 *   recommendations,
 *   generateRecommendations,
 *   placeBet,
 *   recordResult,
 *   bankrollState,
 * } = useBetting(500);
 *
 * // Generate recommendations for a race
 * const recs = generateRecommendations(pipelineOutput);
 *
 * // Place a bet
 * placeBet(20);
 *
 * // Record result
 * recordResult(true, 60); // Won $60 on $20 bet
 */
export function useBetting(initialBankroll: number = DEFAULT_INITIAL_BANKROLL): UseBettingReturn {
  // Create tracker once using lazy state initialization
  const [tracker] = useState(() => new BankrollTracker(initialBankroll, true));

  // State to trigger re-renders when tracker changes
  const [bankrollState, setBankrollState] = useState<BankrollState>(() => tracker.getState());
  const [recommendations, setRecommendations] = useState<RaceRecommendations | null>(null);
  const [config, setConfig] = useState<BetSizingConfig>(loadConfig);

  // Helper to update bankroll state from tracker
  const syncState = useCallback(() => {
    setBankrollState(tracker.getState());
  }, [tracker]);

  // Set bankroll
  const setBankroll = useCallback(
    (amount: number) => {
      const currentState = tracker.getState();
      const diff = amount - currentState.currentBankroll;
      tracker.adjustBankroll(diff);
      syncState();
    },
    [tracker, syncState]
  );

  // Generate recommendations
  const generateRecommendationsFn = useCallback(
    (pipelineOutput: OverlayPipelineOutput): RaceRecommendations => {
      const currentState = tracker.getState();
      const recs = generateBetRecommendations(pipelineOutput, currentState.currentBankroll, config);
      setRecommendations(recs);
      return recs;
    },
    [tracker, config]
  );

  // Place bet
  const placeBet = useCallback(
    (amount: number) => {
      tracker.placeBet(amount);
      syncState();
    },
    [tracker, syncState]
  );

  // Record result
  const recordResult = useCallback(
    (won: boolean, payout?: number) => {
      if (won && payout !== undefined) {
        tracker.recordWin(payout);
      } else {
        tracker.recordLoss();
      }
      tracker.saveState();
      syncState();
    },
    [tracker, syncState]
  );

  // Reset session
  const resetSession = useCallback(
    (newBankroll?: number) => {
      tracker.reset(newBankroll ?? initialBankroll);
      setRecommendations(null);
      syncState();
    },
    [tracker, initialBankroll, syncState]
  );

  // Update config
  const updateConfig = useCallback((newConfig: Partial<BetSizingConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      saveConfig(updated);
      return updated;
    });
  }, []);

  // Clear recommendations
  const clearRecommendations = useCallback(() => {
    setRecommendations(null);
  }, []);

  // Save session
  const saveSession = useCallback(() => {
    tracker.saveState();
  }, [tracker]);

  // Memoized return value
  return useMemo(
    () => ({
      bankroll: bankrollState.currentBankroll,
      setBankroll,
      recommendations,
      generateRecommendations: generateRecommendationsFn,
      placeBet,
      recordResult,
      bankrollState,
      resetSession,
      config,
      updateConfig,
      isInitialized: true,
      clearRecommendations,
      saveSession,
    }),
    [
      bankrollState,
      setBankroll,
      recommendations,
      generateRecommendationsFn,
      placeBet,
      recordResult,
      resetSession,
      config,
      updateConfig,
      clearRecommendations,
      saveSession,
    ]
  );
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to get just the current bankroll (for display purposes)
 */
export function useBankrollDisplay(initialBankroll: number = DEFAULT_INITIAL_BANKROLL) {
  const { bankroll, bankrollState } = useBetting(initialBankroll);

  return {
    current: bankroll,
    starting: bankrollState.startingBankroll,
    netProfit: bankrollState.netProfit,
    roi: bankrollState.roi,
    formatted: {
      current: `$${bankroll.toFixed(2)}`,
      profit:
        bankrollState.netProfit >= 0
          ? `+$${bankrollState.netProfit.toFixed(2)}`
          : `-$${Math.abs(bankrollState.netProfit).toFixed(2)}`,
      roi: `${bankrollState.roi >= 0 ? '+' : ''}${bankrollState.roi.toFixed(1)}%`,
    },
  };
}

export default useBetting;
