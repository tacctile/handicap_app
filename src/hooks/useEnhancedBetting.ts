/**
 * useEnhancedBetting Hook
 *
 * Unified hook that integrates the overlay pipeline with betting recommendations.
 * This provides the full data flow from scored horses to bet recommendations
 * using softmax probabilities and calibration when available.
 *
 * Data Flow:
 * ScoredHorses → OverlayPipeline → BetRecommendations → UI
 *
 * @module hooks/useEnhancedBetting
 */

import { useMemo, useCallback, useState } from 'react';
import type { ScoredHorse } from '../lib/scoring';
import type { RaceHeader } from '../types/drf';
import {
  calculateOverlayPipeline,
  type OverlayPipelineInput,
  type OverlayPipelineOutput,
} from '../lib/scoring/overlayPipeline';
import {
  generateBetRecommendations,
  type RaceRecommendations,
} from '../lib/betting/betRecommender';
import { type BetSizingConfig, DEFAULT_BET_SIZING_CONFIG } from '../lib/betting/betSizer';
import { BankrollTracker, type BankrollState } from '../lib/betting/bankrollTracker';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input for the enhanced betting hook
 */
export interface UseEnhancedBettingInput {
  /** Scored horses from race analysis */
  scoredHorses: ScoredHorse[] | null | undefined;
  /** Race header information */
  raceHeader: RaceHeader | null | undefined;
  /** Race number for display */
  raceNumber: number;
  /** Function to get current odds for a horse (returns morning line by default) */
  getOdds?: (index: number, originalOdds: string) => string;
  /** Function to check if a horse is scratched */
  isScratched?: (index: number) => boolean;
  /** Initial bankroll amount */
  initialBankroll?: number;
}

/**
 * Enhanced horse data combining scoring with overlay pipeline output
 */
export interface EnhancedHorseData {
  /** Program number */
  programNumber: number;
  /** Horse name */
  horseName: string;
  /** Base score from algorithm */
  baseScore: number;
  /** Softmax-based model probability (0-1) */
  modelProbability: number;
  /** Model probability as percentage (0-100) */
  confidencePercent: number;
  /** Normalized market probability from odds (0-1) */
  marketProbability: number;
  /** True overlay percentage (model - market, normalized) */
  trueOverlayPercent: number;
  /** Expected value per $1 bet */
  expectedValue: number;
  /** Value classification */
  valueClass: 'STRONG_VALUE' | 'MODERATE_VALUE' | 'SLIGHT_VALUE' | 'NEUTRAL' | 'UNDERLAY';
  /** Current decimal odds */
  decimalOdds: number;
  /** Whether this horse is a value bet */
  isValueBet: boolean;
  /** Whether calibration was applied to probability */
  calibrationApplied: boolean;
  /** Horse index in original array */
  index: number;
}

/**
 * Return type for the enhanced betting hook
 */
export interface UseEnhancedBettingResult {
  /** Enhanced horse data with overlay calculations */
  enhancedHorses: EnhancedHorseData[];
  /** Raw overlay pipeline output */
  pipelineOutput: OverlayPipelineOutput | null;
  /** Kelly-based bet recommendations */
  recommendations: RaceRecommendations | null;
  /** Whether data is being processed */
  isProcessing: boolean;
  /** Error message if any */
  error: string | null;
  /** Current bankroll */
  bankroll: number;
  /** Set the bankroll */
  setBankroll: (amount: number) => void;
  /** Bankroll state with statistics */
  bankrollState: BankrollState;
  /** Bet sizing configuration */
  config: BetSizingConfig;
  /** Update bet sizing configuration */
  updateConfig: (newConfig: Partial<BetSizingConfig>) => void;
  /** Whether calibration is active */
  calibrationActive: boolean;
  /** Field metrics from overlay pipeline */
  fieldMetrics: {
    fieldSize: number;
    overround: number;
    takeoutPercent: number;
    bestValueHorse: number | null;
  };
  /** Generate fresh recommendations (manual trigger) */
  refreshRecommendations: () => RaceRecommendations | null;
  /** Reset session */
  resetSession: (newBankroll?: number) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_BANKROLL = 250;
const STORAGE_KEY_CONFIG = 'furlong_enhanced_betting_config';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function loadConfig(): BetSizingConfig {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (stored) {
        return { ...DEFAULT_BET_SIZING_CONFIG, ...JSON.parse(stored) };
      }
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_BET_SIZING_CONFIG;
}

function saveConfig(config: BetSizingConfig): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    }
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook that integrates overlay pipeline with betting recommendations.
 *
 * This hook:
 * 1. Calculates softmax probabilities for all horses
 * 2. Normalizes market probabilities from odds
 * 3. Calculates true overlay percentages
 * 4. Generates Kelly-based bet recommendations
 * 5. Tracks bankroll state
 *
 * @example
 * const {
 *   enhancedHorses,
 *   recommendations,
 *   bankroll,
 *   calibrationActive,
 * } = useEnhancedBetting({
 *   scoredHorses,
 *   raceHeader,
 *   raceNumber,
 *   getOdds,
 *   isScratched,
 * });
 *
 * // Display enhanced horse data
 * {enhancedHorses.map(horse => (
 *   <div key={horse.programNumber}>
 *     {horse.horseName}: {horse.confidencePercent.toFixed(1)}% confidence
 *     {horse.isValueBet && ` (+${horse.trueOverlayPercent.toFixed(1)}% overlay)`}
 *   </div>
 * ))}
 */
export function useEnhancedBetting(input: UseEnhancedBettingInput): UseEnhancedBettingResult {
  const {
    scoredHorses,
    raceHeader,
    raceNumber: _raceNumber, // Available for future use
    getOdds = (_, original) => original,
    isScratched = () => false,
    initialBankroll = DEFAULT_BANKROLL,
  } = input;

  // State for bankroll tracking
  const [tracker] = useState(() => new BankrollTracker(initialBankroll, true));
  const [bankrollState, setBankrollState] = useState<BankrollState>(() => tracker.getState());
  const [config, setConfig] = useState<BetSizingConfig>(loadConfig);

  // Sync bankroll state
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

  // Update config
  const updateConfig = useCallback((newConfig: Partial<BetSizingConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      saveConfig(updated);
      return updated;
    });
  }, []);

  // Reset session
  const resetSession = useCallback(
    (newBankroll?: number) => {
      tracker.reset(newBankroll ?? initialBankroll);
      syncState();
    },
    [tracker, initialBankroll, syncState]
  );

  // Calculate overlay pipeline and recommendations
  const result = useMemo(() => {
    // Default empty result
    const emptyResult: Omit<
      UseEnhancedBettingResult,
      | 'setBankroll'
      | 'updateConfig'
      | 'refreshRecommendations'
      | 'resetSession'
      | 'bankroll'
      | 'bankrollState'
      | 'config'
    > = {
      enhancedHorses: [],
      pipelineOutput: null,
      recommendations: null,
      isProcessing: false,
      error: null,
      calibrationActive: false,
      fieldMetrics: {
        fieldSize: 0,
        overround: 0,
        takeoutPercent: 0,
        bestValueHorse: null,
      },
    };

    // Validate inputs
    if (!scoredHorses || scoredHorses.length === 0) {
      return { ...emptyResult, error: 'No scored horses provided' };
    }

    if (!raceHeader) {
      return { ...emptyResult, error: 'No race header provided' };
    }

    // Filter active horses
    const activeHorses = scoredHorses.filter((h) => !isScratched(h.index) && !h.score.isScratched);

    if (activeHorses.length < 2) {
      return { ...emptyResult, error: 'Not enough active horses' };
    }

    try {
      // Build pipeline input
      const pipelineInput: OverlayPipelineInput = {
        horses: activeHorses.map((sh) => ({
          programNumber: sh.horse.programNumber,
          horseName: sh.horse.horseName,
          baseScore: sh.score.baseScore,
          finalScore: sh.score.totalScore || sh.score.baseScore,
          morningLineOdds: getOdds(sh.index, sh.horse.morningLineOdds),
        })),
      };

      // Calculate overlay pipeline
      const pipelineOutput = calculateOverlayPipeline(pipelineInput);

      // Build enhanced horse data
      const enhancedHorses: EnhancedHorseData[] = pipelineOutput.horses.map((horse) => {
        const originalHorse = activeHorses.find(
          (sh) => sh.horse.programNumber === horse.programNumber
        );

        return {
          programNumber: horse.programNumber,
          horseName: horse.horseName || `#${horse.programNumber}`,
          baseScore: horse.baseScore,
          modelProbability: horse.modelProbability,
          confidencePercent: horse.modelProbability * 100,
          marketProbability: horse.normalizedMarketProbability,
          trueOverlayPercent: horse.trueOverlayPercent,
          expectedValue: horse.expectedValue,
          valueClass: horse.valueClassification,
          decimalOdds: horse.actualOdds,
          isValueBet:
            horse.valueClassification !== 'NEUTRAL' && horse.valueClassification !== 'UNDERLAY',
          calibrationApplied: pipelineOutput.calibrationApplied,
          index: originalHorse?.index ?? 0,
        };
      });

      // Generate bet recommendations
      const recommendations = generateBetRecommendations(
        pipelineOutput,
        bankrollState.currentBankroll,
        config
      );

      return {
        enhancedHorses,
        pipelineOutput,
        recommendations,
        isProcessing: false,
        error: null,
        calibrationActive: pipelineOutput.calibrationApplied,
        fieldMetrics: {
          fieldSize: pipelineOutput.fieldMetrics.fieldSize,
          overround: pipelineOutput.fieldMetrics.overround,
          takeoutPercent: pipelineOutput.fieldMetrics.takeoutPercent,
          bestValueHorse: pipelineOutput.fieldMetrics.bestValueHorse,
        },
      };
    } catch (error) {
      return {
        ...emptyResult,
        error: error instanceof Error ? error.message : 'Processing failed',
      };
    }
  }, [scoredHorses, raceHeader, getOdds, isScratched, bankrollState.currentBankroll, config]);

  // Manual refresh function
  const refreshRecommendations = useCallback(() => {
    if (result.pipelineOutput) {
      return generateBetRecommendations(
        result.pipelineOutput,
        bankrollState.currentBankroll,
        config
      );
    }
    return null;
  }, [result.pipelineOutput, bankrollState.currentBankroll, config]);

  return {
    ...result,
    bankroll: bankrollState.currentBankroll,
    setBankroll,
    bankrollState,
    config,
    updateConfig,
    refreshRecommendations,
    resetSession,
  };
}

export default useEnhancedBetting;
