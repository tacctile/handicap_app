import type { HorseEntry, RaceHeader } from '../../types/drf';
import type { TrackCondition, OddsUpdate } from '../../hooks/useRaceState';
import { calculateHorseScore, type HorseScore } from '../scoring';
import { classifyHorses, type TierGroup } from '../betting/tierClassification';
import {
  generateBetRecommendations,
  type TierBetRecommendations,
} from '../betting/betRecommendations';
import {
  assessFieldQuality,
  detectFieldQualityChange,
  type FieldQualityAssessment,
  type FieldQualityChange,
  type ScoredHorseData,
} from './fieldQuality';

/**
 * Represents the complete calculated state for a race
 */
export interface RaceCalculationResult {
  // Scored horses with all calculations
  scoredHorses: Array<{
    horse: HorseEntry;
    index: number;
    score: HorseScore;
    previousScore?: number; // For change detection
  }>;
  // Tier classifications
  tierGroups: TierGroup[];
  // Betting recommendations
  recommendations: TierBetRecommendations[];
  // Win probability estimates
  winProbabilities: Map<number, number>;
  // Metadata
  calculatedAt: number;
  horsesAnalyzed: number;
  activeHorses: number;
  confidenceLevel: number; // 0-100
  // Field quality assessment
  fieldQuality: FieldQualityAssessment;
  // Field quality change (populated when comparing to previous state)
  fieldQualityChange?: FieldQualityChange;
}

/**
 * Snapshot of horse state before recalculation
 * Used for change detection and animations
 */
export interface HorseSnapshot {
  index: number;
  score: number;
  tier: string | null;
  odds: string;
}

/**
 * Calculate win probability based on score relative to field
 */
function calculateWinProbability(horseScore: number, allScores: number[]): number {
  if (horseScore === 0) return 0;

  const totalScores = allScores.reduce((sum, s) => sum + s, 0);
  if (totalScores === 0) return 0;

  // Base probability from score proportion
  const baseProbability = (horseScore / totalScores) * 100;

  // Adjust for field size (smaller fields = higher individual probabilities)
  const fieldSize = allScores.filter((s) => s > 0).length;
  const fieldAdjustment = Math.max(0.8, 1 - (fieldSize - 6) * 0.02);

  return Math.min(100, Math.round(baseProbability * fieldAdjustment * 10) / 10);
}

/**
 * Calculate overall confidence level based on score distribution
 * Higher confidence when there's clear separation between top horses
 */
function calculateConfidenceLevel(scores: number[]): number {
  const activeScores = scores.filter((s) => s > 0).sort((a, b) => b - a);

  if (activeScores.length < 2) return 50;

  const topScore = activeScores[0];
  const secondScore = activeScores[1];
  if (topScore === undefined || secondScore === undefined) return 50;

  const avgScore = activeScores.reduce((a, b) => a + b, 0) / activeScores.length;

  // Score differential bonus
  const differential = ((topScore - secondScore) / topScore) * 30;

  // Top score quality bonus (319 = max base score)
  const qualityBonus = Math.min(20, (topScore / 319) * 25);

  // Base confidence from average score (319 = max base score)
  const baseConfidence = 40 + (avgScore / 319) * 30;

  return Math.min(100, Math.round(baseConfidence + differential + qualityBonus));
}

/**
 * Check which horses have changed between calculations
 */
export function detectChanges(
  previous: HorseSnapshot[],
  current: RaceCalculationResult
): {
  scoreChanges: Map<number, { from: number; to: number }>;
  tierChanges: Map<number, { from: string | null; to: string | null }>;
  oddsChanges: Set<number>;
} {
  const scoreChanges = new Map<number, { from: number; to: number }>();
  const tierChanges = new Map<number, { from: string | null; to: string | null }>();
  const oddsChanges = new Set<number>();

  const previousMap = new Map(previous.map((p) => [p.index, p]));

  // Get current tier for each horse
  const currentTiers = new Map<number, string | null>();
  for (const group of current.tierGroups) {
    for (const horse of group.horses) {
      currentTiers.set(horse.horseIndex, group.tier);
    }
  }

  for (const { index, score } of current.scoredHorses) {
    const prev = previousMap.get(index);
    if (!prev) continue;

    // Score change detection
    if (prev.score !== score.total) {
      scoreChanges.set(index, { from: prev.score, to: score.total });
    }

    // Tier change detection
    const currentTier = currentTiers.get(index) || null;
    if (prev.tier !== currentTier) {
      tierChanges.set(index, { from: prev.tier, to: currentTier });
    }
  }

  return { scoreChanges, tierChanges, oddsChanges };
}

/**
 * Create snapshot of current horse states for change detection
 */
export function createSnapshot(
  horses: HorseEntry[],
  getOdds: (index: number, original: string) => string,
  _isScratched: (index: number) => boolean,
  tierGroups: TierGroup[]
): HorseSnapshot[] {
  // Build tier lookup
  const tierLookup = new Map<number, string>();
  for (const group of tierGroups) {
    for (const horse of group.horses) {
      tierLookup.set(horse.horseIndex, group.tier);
    }
  }

  return horses.map((horse, index) => ({
    index,
    score: 0, // Will be filled in when we have actual scores
    tier: tierLookup.get(index) || null,
    odds: getOdds(index, horse.morningLineOdds),
  }));
}

/**
 * Main recalculation function
 * Triggers when any input changes and recalculates all derived data
 *
 * @param horses - Array of horse entries
 * @param raceHeader - Race header information
 * @param trackCondition - Current track condition
 * @param scratchedHorses - Set of scratched horse indices
 * @param updatedOdds - Map of updated odds by horse index
 * @param previousScores - Optional previous scores for change detection
 * @returns Complete race calculation result
 */
export function recalculateRace(
  horses: HorseEntry[],
  raceHeader: RaceHeader,
  trackCondition: TrackCondition,
  scratchedHorses: Set<number>,
  updatedOdds: OddsUpdate,
  previousScores?: Map<number, number>
): RaceCalculationResult {
  // Helper functions for getting current state
  const getOdds = (index: number, originalOdds: string): string => {
    return updatedOdds[index] ?? originalOdds;
  };

  const isScratched = (index: number): boolean => {
    return scratchedHorses.has(index);
  };

  // Step 1: Calculate scores for all horses
  const scoredHorses = horses.map((horse, index) => {
    const currentOdds = getOdds(index, horse.morningLineOdds);
    const scratched = isScratched(index);
    const score = calculateHorseScore(horse, raceHeader, currentOdds, trackCondition, scratched);

    return {
      horse,
      index,
      score,
      previousScore: previousScores?.get(index),
    };
  });

  // Sort by score descending (scratched at bottom)
  const sortedHorses = [...scoredHorses].sort((a, b) => {
    if (a.score.isScratched && !b.score.isScratched) return 1;
    if (!a.score.isScratched && b.score.isScratched) return -1;
    return b.score.total - a.score.total;
  });

  // Step 2: Classify horses into tiers
  const tierGroups = classifyHorses(
    sortedHorses.map(({ horse, index, score }) => ({ horse, index, score }))
  );

  // Step 3: Generate betting recommendations
  const recommendations = generateBetRecommendations(tierGroups);

  // Step 4: Calculate win probabilities
  const activeScores = sortedHorses.filter((h) => !h.score.isScratched).map((h) => h.score.total);

  const winProbabilities = new Map<number, number>();
  for (const { index, score } of sortedHorses) {
    if (!score.isScratched) {
      winProbabilities.set(index, calculateWinProbability(score.total, activeScores));
    }
  }

  // Step 5: Calculate confidence level
  const confidenceLevel = calculateConfidenceLevel(activeScores);

  // Count statistics
  const horsesAnalyzed = horses.length;
  const activeHorses = horses.length - scratchedHorses.size;

  // Step 6: Assess field quality
  const scoredHorseData: ScoredHorseData[] = sortedHorses.map(({ index, score, horse }) => ({
    index,
    score,
    horseName: horse.horseName,
  }));
  const fieldQuality = assessFieldQuality(scoredHorseData, scratchedHorses);

  return {
    scoredHorses: sortedHorses,
    tierGroups,
    recommendations,
    winProbabilities,
    calculatedAt: Date.now(),
    horsesAnalyzed,
    activeHorses,
    confidenceLevel,
    fieldQuality,
  };
}

/**
 * Optimized recalculation that only updates affected horses
 * Used when a single horse's odds change (not track condition or scratches)
 */
export function recalculateAffectedHorses(
  previousResult: RaceCalculationResult,
  affectedIndices: Set<number>,
  horses: HorseEntry[],
  raceHeader: RaceHeader,
  trackCondition: TrackCondition,
  scratchedHorses: Set<number>,
  updatedOdds: OddsUpdate
): RaceCalculationResult {
  // If too many horses affected or track condition changed, do full recalc
  if (affectedIndices.size > 3) {
    return recalculateRace(horses, raceHeader, trackCondition, scratchedHorses, updatedOdds);
  }

  const getOdds = (index: number, originalOdds: string): string => {
    return updatedOdds[index] ?? originalOdds;
  };

  const isScratched = (index: number): boolean => {
    return scratchedHorses.has(index);
  };

  // Update only affected horses
  const updatedScoredHorses = previousResult.scoredHorses.map((item) => {
    if (affectedIndices.has(item.index)) {
      const horse = horses[item.index];
      if (!horse) return item;

      const currentOdds = getOdds(item.index, horse.morningLineOdds);
      const scratched = isScratched(item.index);
      const score = calculateHorseScore(horse, raceHeader, currentOdds, trackCondition, scratched);

      return {
        ...item,
        score,
        previousScore: item.score.total,
      };
    }
    return item;
  });

  // Re-sort
  const sortedHorses = [...updatedScoredHorses].sort((a, b) => {
    if (a.score.isScratched && !b.score.isScratched) return 1;
    if (!a.score.isScratched && b.score.isScratched) return -1;
    return b.score.total - a.score.total;
  });

  // Reclassify and regenerate recommendations
  const tierGroups = classifyHorses(
    sortedHorses.map(({ horse, index, score }) => ({ horse, index, score }))
  );

  const recommendations = generateBetRecommendations(tierGroups);

  // Recalculate win probabilities
  const activeScores = sortedHorses.filter((h) => !h.score.isScratched).map((h) => h.score.total);

  const winProbabilities = new Map<number, number>();
  for (const { index, score } of sortedHorses) {
    if (!score.isScratched) {
      winProbabilities.set(index, calculateWinProbability(score.total, activeScores));
    }
  }

  const confidenceLevel = calculateConfidenceLevel(activeScores);

  // Assess field quality
  const scoredHorseData: ScoredHorseData[] = sortedHorses.map(({ index, score, horse }) => ({
    index,
    score,
    horseName: horse.horseName,
  }));
  const fieldQuality = assessFieldQuality(scoredHorseData, scratchedHorses);

  // Detect field quality changes if there was a previous result
  const previousScoredHorseData: ScoredHorseData[] = previousResult.scoredHorses.map(
    ({ index, score, horse }) => ({
      index,
      score,
      horseName: horse.horseName,
    })
  );
  const fieldQualityChange = detectFieldQualityChange(
    previousScoredHorseData,
    scoredHorseData,
    scratchedHorses
  );

  return {
    scoredHorses: sortedHorses,
    tierGroups,
    recommendations,
    winProbabilities,
    calculatedAt: Date.now(),
    horsesAnalyzed: horses.length,
    activeHorses: horses.length - scratchedHorses.size,
    confidenceLevel,
    fieldQuality,
    fieldQualityChange,
  };
}

/**
 * Memoization key generator for calculation results
 */
export function createCalculationKey(
  trackCondition: TrackCondition,
  scratchedHorses: Set<number>,
  updatedOdds: OddsUpdate
): string {
  const scratched = Array.from(scratchedHorses).sort().join(',');
  const odds = Object.entries(updatedOdds)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(',');

  return `${trackCondition}|${scratched}|${odds}`;
}

/**
 * Recalculate race with explicit field quality change detection.
 * Use this when a horse is scratched to get detailed analysis of how
 * the field quality changed.
 *
 * @param horses - Array of horse entries
 * @param raceHeader - Race header information
 * @param trackCondition - Current track condition
 * @param previousScratchedHorses - Previously scratched horses (before this scratch)
 * @param newScratchedHorses - Currently scratched horses (after this scratch)
 * @param updatedOdds - Map of updated odds by horse index
 * @param previousResult - Previous calculation result for comparison
 * @returns Complete race calculation result with field quality change analysis
 */
export function recalculateWithScratchAnalysis(
  horses: HorseEntry[],
  raceHeader: RaceHeader,
  trackCondition: TrackCondition,
  previousScratchedHorses: Set<number>,
  newScratchedHorses: Set<number>,
  updatedOdds: OddsUpdate,
  previousResult?: RaceCalculationResult
): RaceCalculationResult {
  // Calculate the new result
  const newResult = recalculateRace(
    horses,
    raceHeader,
    trackCondition,
    newScratchedHorses,
    updatedOdds
  );

  // If no previous result, just return the new result
  if (!previousResult) {
    return newResult;
  }

  // Determine newly scratched indices
  const newlyScratched = new Set<number>();
  for (const index of newScratchedHorses) {
    if (!previousScratchedHorses.has(index)) {
      newlyScratched.add(index);
    }
  }

  // If no new scratches, no field quality change to detect
  if (newlyScratched.size === 0) {
    return newResult;
  }

  // Build scored horse data for comparison
  const previousScoredHorseData: ScoredHorseData[] = previousResult.scoredHorses.map(
    ({ index, score, horse }) => ({
      index,
      score,
      horseName: horse.horseName,
    })
  );

  const currentScoredHorseData: ScoredHorseData[] = newResult.scoredHorses.map(
    ({ index, score, horse }) => ({
      index,
      score,
      horseName: horse.horseName,
    })
  );

  // Detect field quality changes
  const fieldQualityChange = detectFieldQualityChange(
    previousScoredHorseData,
    currentScoredHorseData,
    newlyScratched
  );

  return {
    ...newResult,
    fieldQualityChange,
  };
}

// Re-export field quality types and utilities
export {
  assessFieldQuality,
  detectFieldQualityChange,
  getFieldStrengthDescription,
  getFieldStrengthColor,
  getQualityChangeColor,
  isSignificantScratch,
  getFieldQualitySummary,
  FIELD_STRENGTH_THRESHOLDS,
  TOP_CONTENDER_THRESHOLD,
  type FieldQualityAssessment,
  type FieldQualityChange,
  type FieldStrength,
  type QualityChangeType,
  type ScoredHorseData,
} from './fieldQuality';
