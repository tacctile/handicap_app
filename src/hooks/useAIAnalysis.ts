/**
 * useAIAnalysis Hook
 *
 * Automatically triggers AI analysis when scoring completes and caches results.
 * Provides loading/error states and graceful degradation when AI is unavailable.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getMultiBotAnalysis, checkAIServiceStatus, type AIRaceAnalysis } from '../services/ai';
import type { ParsedRace, RaceHeader } from '../types/drf';
import type { RaceScoringResult, HorseScoreForAI } from '../types/scoring';
import type { ScoredHorse } from '../lib/scoring';

// ============================================================================
// TYPES
// ============================================================================

export interface UseAIAnalysisReturn {
  /** AI analysis result (null if not yet loaded or unavailable) */
  aiAnalysis: AIRaceAnalysis | null;
  /** Whether AI analysis is currently loading */
  aiLoading: boolean;
  /** Error message if AI analysis failed (null if no error) */
  aiError: string | null;
  /** Whether the AI service is available (API key present) */
  isAIAvailable: boolean;
  /** Manually retry the AI analysis */
  retryAnalysis: () => void;
}

interface CacheEntry {
  analysis: AIRaceAnalysis;
  raceNumber: number;
  timestamp: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Debounce delay to prevent rapid re-triggers (ms) */
const DEBOUNCE_DELAY = 1500;

/** Cache TTL - keep cached results for 30 minutes */
const CACHE_TTL = 30 * 60 * 1000;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Transform ScoredHorse[] to RaceScoringResult format for AI service
 */
function transformToRaceScoringResult(
  scoredHorses: ScoredHorse[],
  _raceHeader: RaceHeader // Reserved for future use
): RaceScoringResult {
  // Transform scored horses to HorseScoreForAI format
  const scores: HorseScoreForAI[] = scoredHorses
    .filter((sh) => !sh.score.isScratched)
    .sort((a, b) => a.rank - b.rank)
    .map((sh) => {
      // Derive positive/negative factors from breakdown data
      const positiveFactors: string[] = [];
      const negativeFactors: string[] = [];

      // Speed factors
      const speedScore = sh.score.breakdown.speedClass?.speedScore ?? 0;
      if (speedScore >= 50) positiveFactors.push('Strong speed figures');
      else if (speedScore <= 20) negativeFactors.push('Weak speed figures');

      // Class factors
      const classScore = sh.score.breakdown.speedClass?.classScore ?? 0;
      if (classScore >= 40) positiveFactors.push('Class advantage');
      else if (classScore <= 10) negativeFactors.push('Class disadvantage');

      // Form factors
      const formScore = sh.score.breakdown.form?.total ?? 0;
      if (formScore >= 40) positiveFactors.push('Strong recent form');
      else if (formScore <= 15) negativeFactors.push('Poor recent form');

      // Connection factors
      const connectionScore = sh.score.breakdown.connections?.total ?? 0;
      if (connectionScore >= 30) positiveFactors.push('Elite connections');

      // Pace factors
      const paceScore = sh.score.breakdown.pace?.total ?? 0;
      if (paceScore >= 15) positiveFactors.push('Pace advantage');

      return {
        programNumber: sh.horse.programNumber,
        horseName: sh.horse.horseName,
        rank: sh.rank,
        finalScore: sh.score.total,
        confidenceTier: sh.score.confidenceLevel,
        breakdown: {
          speedScore,
          classScore,
          formScore,
          paceScore,
          connectionScore,
        },
        positiveFactors,
        negativeFactors,
        isScratched: sh.score.isScratched,
      };
    });

  // Calculate pace scenario analysis from the field
  const activeHorses = scoredHorses.filter((sh) => !sh.score.isScratched);
  const earlySpeedCount = activeHorses.filter(
    (sh) => (sh.score.breakdown.pace?.total ?? 0) > 15
  ).length;

  // Determine pace scenario based on early speed count
  let expectedPace: 'hot' | 'moderate' | 'slow' | 'contested';
  if (earlySpeedCount >= 4) {
    expectedPace = 'hot';
  } else if (earlySpeedCount === 3) {
    expectedPace = 'contested';
  } else if (earlySpeedCount === 1) {
    expectedPace = 'slow';
  } else {
    expectedPace = 'moderate';
  }

  // Find likely leader (highest pace score)
  const likelyLeader = activeHorses.reduce<number | null>((leader, horse) => {
    if (!leader) return horse.horse.programNumber;
    const currentLeaderHorse = activeHorses.find((h) => h.horse.programNumber === leader);
    const currentPace = currentLeaderHorse?.score.breakdown.pace?.total ?? 0;
    const horsePace = horse.score.breakdown.pace?.total ?? 0;
    return horsePace > currentPace ? horse.horse.programNumber : leader;
  }, null);

  // Calculate field strength based on average score
  const avgScore = activeHorses.reduce((sum, h) => sum + h.score.total, 0) / activeHorses.length;
  let fieldStrength: 'elite' | 'strong' | 'average' | 'weak';
  if (avgScore > 200) {
    fieldStrength = 'elite';
  } else if (avgScore > 150) {
    fieldStrength = 'strong';
  } else if (avgScore > 100) {
    fieldStrength = 'average';
  } else {
    fieldStrength = 'weak';
  }

  // Check if favorite appears vulnerable (top-ranked horse has low data quality)
  const topRanked = activeHorses.find((h) => h.rank === 1);
  const vulnerableFavorite =
    topRanked?.score.confidenceLevel === 'low' || (topRanked?.score.total ?? 0) < 120;

  const raceAnalysis = {
    paceScenario: {
      expectedPace,
      likelyLeader,
      speedDuelProbability: earlySpeedCount >= 3 ? 0.7 : earlySpeedCount >= 2 ? 0.4 : 0.1,
      earlySpeedCount,
    },
    fieldStrength,
    vulnerableFavorite,
    likelyPaceCollapse: expectedPace === 'hot',
  };

  return { scores, raceAnalysis };
}

/**
 * Generate a cache key for a race
 */
function getCacheKey(raceNumber: number, trackCode?: string): string {
  return `${trackCode || 'unknown'}-R${raceNumber}`;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for automatic AI analysis after scoring completes
 *
 * @param currentRace - The current race data (ParsedRace or null)
 * @param scoredHorses - Array of scored horses from the scoring engine
 * @returns AI analysis state and controls
 */
export function useAIAnalysis(
  currentRace: ParsedRace | null | undefined,
  scoredHorses: ScoredHorse[]
): UseAIAnalysisReturn {
  // State
  const [aiAnalysis, setAiAnalysis] = useState<AIRaceAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAIAvailable, setIsAIAvailable] = useState(false);

  // Refs for tracking
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentAnalysisRef = useRef<{ raceNumber: number; aborted: boolean } | null>(null);

  // Check AI service availability on mount and when environment might change
  useEffect(() => {
    const status = checkAIServiceStatus();
    setIsAIAvailable(status === 'ready');
  }, []);

  // Memoize race info to detect changes
  const raceInfo = useMemo(() => {
    if (!currentRace?.header) return null;
    return {
      raceNumber: currentRace.header.raceNumber,
      trackCode: currentRace.header.trackCode,
    };
  }, [currentRace?.header?.raceNumber, currentRace?.header?.trackCode]);

  // Check if we have valid inputs
  const hasValidInputs = useMemo(() => {
    return (
      currentRace &&
      currentRace.header &&
      currentRace.horses &&
      currentRace.horses.length > 0 &&
      scoredHorses &&
      scoredHorses.length > 0 &&
      scoredHorses.some((h) => !h.score.isScratched)
    );
  }, [currentRace, scoredHorses]);

  /**
   * Perform the AI analysis
   */
  const performAnalysis = useCallback(async () => {
    if (!currentRace || !currentRace.header || !hasValidInputs) {
      return;
    }

    const raceNumber = currentRace.header.raceNumber;
    const trackCode = currentRace.header.trackCode;
    const cacheKey = getCacheKey(raceNumber, trackCode);

    // Check cache first
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setAiAnalysis(cached.analysis);
      setAiLoading(false);
      setAiError(null);
      return;
    }

    // Mark this analysis as current
    currentAnalysisRef.current = { raceNumber, aborted: false };

    setAiLoading(true);
    setAiError(null);

    try {
      // Check service status
      const status = checkAIServiceStatus();
      if (status === 'offline') {
        throw new Error('AI_KEY_MISSING');
      }

      // Transform data for AI service
      const scoringResult = transformToRaceScoringResult(scoredHorses, currentRace.header);

      // Call the AI service
      const analysis = await getMultiBotAnalysis(currentRace, scoringResult);

      // Check if this analysis is still current (user might have switched races)
      if (
        currentAnalysisRef.current?.raceNumber !== raceNumber ||
        currentAnalysisRef.current?.aborted
      ) {
        return;
      }

      // Cache the result
      cacheRef.current.set(cacheKey, {
        analysis,
        raceNumber,
        timestamp: Date.now(),
      });

      setAiAnalysis(analysis);
      setAiError(null);
    } catch (error) {
      // Check if still current
      if (
        currentAnalysisRef.current?.raceNumber !== raceNumber ||
        currentAnalysisRef.current?.aborted
      ) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Handle specific error types
      if (errorMessage === 'AI_KEY_MISSING' || errorMessage.includes('API key')) {
        setAiError('API_KEY_MISSING');
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        setAiError('RATE_LIMITED');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
        setAiError('TIMEOUT');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setAiError('NETWORK_ERROR');
      } else {
        setAiError(errorMessage);
        console.error('AI Analysis error:', error);
      }

      setAiAnalysis(null);
    } finally {
      // Only update loading state if still current
      if (
        currentAnalysisRef.current?.raceNumber === raceNumber &&
        !currentAnalysisRef.current?.aborted
      ) {
        setAiLoading(false);
      }
    }
  }, [currentRace, hasValidInputs, scoredHorses]);

  /**
   * Retry analysis manually
   */
  const retryAnalysis = useCallback(() => {
    // Clear any cached error state
    setAiError(null);
    setAiAnalysis(null);

    // Clear cache for current race to force refresh
    if (currentRace?.header) {
      const cacheKey = getCacheKey(currentRace.header.raceNumber, currentRace.header.trackCode);
      cacheRef.current.delete(cacheKey);
    }

    // Trigger analysis immediately
    performAnalysis();
  }, [currentRace, performAnalysis]);

  // Effect to trigger AI analysis when race or scores change
  useEffect(() => {
    // Abort any in-progress analysis for previous race
    if (currentAnalysisRef.current) {
      currentAnalysisRef.current.aborted = true;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Skip if AI is not available or inputs are invalid
    if (!isAIAvailable || !hasValidInputs || !raceInfo) {
      setAiLoading(false);
      // Don't clear analysis on race change - we might have cached data
      return;
    }

    const raceNumber = raceInfo.raceNumber;
    const trackCode = raceInfo.trackCode;
    const cacheKey = getCacheKey(raceNumber, trackCode);

    // Check cache immediately
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setAiAnalysis(cached.analysis);
      setAiLoading(false);
      setAiError(null);
      return;
    }

    // Set loading state before debounce
    setAiLoading(true);

    // Debounce the actual API call
    debounceTimerRef.current = setTimeout(() => {
      performAnalysis();
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isAIAvailable, hasValidInputs, raceInfo, performAnalysis]);

  // Reset state when race changes
  useEffect(() => {
    if (!raceInfo) {
      setAiAnalysis(null);
      setAiLoading(false);
      setAiError(null);
      return;
    }

    // Check cache for the new race
    const cacheKey = getCacheKey(raceInfo.raceNumber, raceInfo.trackCode);
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setAiAnalysis(cached.analysis);
      setAiError(null);
    } else {
      // Clear analysis but keep error state if no cache
      setAiAnalysis(null);
    }
  }, [raceInfo?.raceNumber, raceInfo?.trackCode]);

  return {
    aiAnalysis,
    aiLoading,
    aiError,
    isAIAvailable,
    retryAnalysis,
  };
}

export default useAIAnalysis;
