/**
 * Multi-Race Bet Opportunity Detection
 *
 * Analyzes sequences of races to identify optimal multi-race betting opportunities.
 * Detects Daily Doubles, Pick 3s, Pick 4s, Pick 5s, and Pick 6s based on:
 * - Value plays in the sequence
 * - Confidence levels for each race
 * - Potential for singling horses
 * - Overall sequence quality
 */

import type { ScoredHorse } from '../scoring';
import type { RaceValueAnalysis } from '../../hooks/useValueDetection';
import type {
  MultiRaceBetType,
  MultiRaceOpportunity,
  MultiRaceQuality,
  ExperienceLevel,
} from './betTypes';
import {
  MULTI_RACE_BET_CONFIGS,
  getAvailableMultiRaceBetTypes,
} from './betTypes';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Race data needed for multi-race analysis
 */
export interface RaceAnalysisData {
  raceNumber: number;
  scoredHorses: ScoredHorse[];
  valueAnalysis: RaceValueAnalysis;
  trackName: string;
  postTime?: string;
}

/**
 * Sequence quality criteria
 */
interface SequenceQualityCriteria {
  valuePlaysCount: number;
  singleableRacesCount: number;
  estimatedCombinations: number;
  hasHighConfidenceRace: boolean;
  averageFieldConfidence: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Thresholds for quality ratings
 */
const QUALITY_THRESHOLDS = {
  /** Minimum value plays for PRIME rating */
  PRIME_VALUE_PLAYS: 2,
  /** Minimum singleable races for PRIME */
  PRIME_SINGLEABLE: 1,
  /** Maximum combinations for PRIME */
  PRIME_MAX_COMBOS: 50,
  /** Minimum value plays for GOOD rating */
  GOOD_VALUE_PLAYS: 1,
  /** Maximum combinations for GOOD */
  GOOD_MAX_COMBOS: 100,
  /** Minimum edge to consider a race "singleable" */
  SINGLEABLE_MIN_EDGE: 100,
  /** Minimum edge for a value play to count */
  MIN_VALUE_EDGE: 50,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a race can be singled (one horse with very high confidence)
 */
function canSingleRace(analysis: RaceValueAnalysis): boolean {
  // Must have a value play with strong edge
  if (!analysis.primaryValuePlay) return false;

  // Value play must have >= 100% edge to be singleable
  return analysis.primaryValuePlay.valueEdge >= QUALITY_THRESHOLDS.SINGLEABLE_MIN_EDGE;
}

/**
 * Check if a race has a valid value play
 */
function hasValidValuePlay(analysis: RaceValueAnalysis): boolean {
  return (
    analysis.hasValuePlay &&
    analysis.primaryValuePlay !== null &&
    analysis.primaryValuePlay.valueEdge >= QUALITY_THRESHOLDS.MIN_VALUE_EDGE
  );
}

/**
 * Estimate the number of combinations for a sequence
 */
function estimateCombinations(races: RaceAnalysisData[]): number {
  return races.reduce((combos, race) => {
    // For each race, estimate horses we'd use based on value analysis
    const analysis = race.valueAnalysis;

    if (canSingleRace(analysis)) {
      // Single = 1 horse
      return combos * 1;
    } else if (analysis.verdict === 'BET' || analysis.verdict === 'CAUTION') {
      // Spread top 2-3 contenders
      return combos * 2.5;
    } else {
      // PASS race = spread more (3-4 horses)
      return combos * 3.5;
    }
  }, 1);
}

/**
 * Calculate sequence quality criteria
 */
function calculateQualityCriteria(races: RaceAnalysisData[]): SequenceQualityCriteria {
  let valuePlaysCount = 0;
  let singleableRacesCount = 0;
  let totalConfidence = 0;
  let hasHighConfidenceRace = false;

  for (const race of races) {
    const analysis = race.valueAnalysis;

    if (hasValidValuePlay(analysis)) {
      valuePlaysCount++;
    }

    if (canSingleRace(analysis)) {
      singleableRacesCount++;
    }

    if (analysis.confidence === 'HIGH') {
      hasHighConfidenceRace = true;
    }

    // Convert confidence to numeric
    const confScore = analysis.confidence === 'HIGH' ? 3 : analysis.confidence === 'MEDIUM' ? 2 : 1;
    totalConfidence += confScore;
  }

  return {
    valuePlaysCount,
    singleableRacesCount,
    estimatedCombinations: Math.round(estimateCombinations(races)),
    hasHighConfidenceRace,
    averageFieldConfidence: totalConfidence / races.length,
  };
}

/**
 * Determine quality rating based on criteria
 */
function determineQuality(criteria: SequenceQualityCriteria): MultiRaceQuality {
  // PRIME: 2+ value plays, at least 1 singleable race, manageable combos
  if (
    criteria.valuePlaysCount >= QUALITY_THRESHOLDS.PRIME_VALUE_PLAYS &&
    criteria.singleableRacesCount >= QUALITY_THRESHOLDS.PRIME_SINGLEABLE &&
    criteria.estimatedCombinations <= QUALITY_THRESHOLDS.PRIME_MAX_COMBOS
  ) {
    return 'PRIME';
  }

  // GOOD: 1+ value play, reasonable combos
  if (
    criteria.valuePlaysCount >= QUALITY_THRESHOLDS.GOOD_VALUE_PLAYS &&
    criteria.estimatedCombinations <= QUALITY_THRESHOLDS.GOOD_MAX_COMBOS
  ) {
    return 'GOOD';
  }

  // Everything else is MARGINAL
  return 'MARGINAL';
}

/**
 * Generate reasoning text for an opportunity
 */
function generateReasoning(
  _type: MultiRaceBetType,
  races: RaceAnalysisData[],
  criteria: SequenceQualityCriteria
): string {
  const parts: string[] = [];

  // Value plays
  if (criteria.valuePlaysCount > 1) {
    parts.push(`${criteria.valuePlaysCount} value plays in sequence`);
  } else if (criteria.valuePlaysCount === 1) {
    const valueRace = races.find(r => hasValidValuePlay(r.valueAnalysis));
    if (valueRace) {
      parts.push(`Value play in R${valueRace.raceNumber}`);
    }
  }

  // Singleable races
  if (criteria.singleableRacesCount > 0) {
    const singleableRaces = races
      .filter(r => canSingleRace(r.valueAnalysis))
      .map(r => `R${r.raceNumber}`);
    parts.push(`Can single ${singleableRaces.join(', ')}`);
  }

  // Combinations estimate
  parts.push(`~${criteria.estimatedCombinations} combos`);

  return parts.join('. ') + '.';
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect all multi-race opportunities in a set of races
 *
 * @param races - Array of race analysis data for consecutive races
 * @param experienceLevel - User's experience level (filters available bet types)
 * @returns Array of detected opportunities sorted by quality
 */
export function detectMultiRaceOpportunities(
  races: RaceAnalysisData[],
  experienceLevel: ExperienceLevel
): MultiRaceOpportunity[] {
  // Beginners don't see multi-race bets
  if (experienceLevel === 'beginner') {
    return [];
  }

  const opportunities: MultiRaceOpportunity[] = [];
  const availableTypes = getAvailableMultiRaceBetTypes(experienceLevel);
  const totalRaces = races.length;

  // Check each available bet type
  for (const betType of availableTypes) {
    const config = MULTI_RACE_BET_CONFIGS[betType];
    const raceCount = config.raceCount;

    // Skip if not enough races
    if (totalRaces < raceCount) continue;

    // Check all possible starting positions for this bet type
    for (let startIdx = 0; startIdx <= totalRaces - raceCount; startIdx++) {
      const sequenceRaces = races.slice(startIdx, startIdx + raceCount);
      const criteria = calculateQualityCriteria(sequenceRaces);
      const quality = determineQuality(criteria);

      // Skip MARGINAL opportunities for Standard users
      if (quality === 'MARGINAL' && experienceLevel !== 'expert') {
        continue;
      }

      // Find races with value plays
      const valuePlayRaces = sequenceRaces
        .filter(r => hasValidValuePlay(r.valueAnalysis))
        .map(r => r.raceNumber);

      // Find singleable races
      const singleableRaces = sequenceRaces
        .filter(r => canSingleRace(r.valueAnalysis))
        .map(r => r.raceNumber);

      const opportunity: MultiRaceOpportunity = {
        type: betType,
        races: sequenceRaces.map(r => r.raceNumber),
        quality,
        valuePlaysInSequence: criteria.valuePlaysCount,
        valuePlayRaces,
        singleableRaces,
        reasoning: generateReasoning(betType, sequenceRaces, criteria),
      };

      opportunities.push(opportunity);
    }
  }

  // Sort by quality (PRIME first), then by value plays count
  opportunities.sort((a, b) => {
    const qualityOrder = { PRIME: 0, GOOD: 1, MARGINAL: 2 };
    const qualityDiff = qualityOrder[a.quality] - qualityOrder[b.quality];
    if (qualityDiff !== 0) return qualityDiff;

    // Within same quality, prefer more value plays
    return b.valuePlaysInSequence - a.valuePlaysInSequence;
  });

  // Remove overlapping opportunities of the same type (keep the best one)
  const filteredOpportunities = filterOverlappingOpportunities(opportunities);

  return filteredOpportunities;
}

/**
 * Filter out overlapping opportunities of the same type
 * Keeps the higher quality opportunity when two overlap
 */
function filterOverlappingOpportunities(
  opportunities: MultiRaceOpportunity[]
): MultiRaceOpportunity[] {
  const filtered: MultiRaceOpportunity[] = [];
  const usedRacesByType: Map<MultiRaceBetType, Set<number>> = new Map();

  for (const opp of opportunities) {
    const usedRaces = usedRacesByType.get(opp.type) || new Set();

    // Check if any race in this opportunity is already used
    const hasOverlap = opp.races.some(r => usedRaces.has(r));

    if (!hasOverlap) {
      filtered.push(opp);
      // Mark these races as used for this bet type
      opp.races.forEach(r => usedRaces.add(r));
      usedRacesByType.set(opp.type, usedRaces);
    }
  }

  return filtered;
}

/**
 * Get the best multi-race opportunity (if any)
 */
export function getBestOpportunity(
  opportunities: MultiRaceOpportunity[]
): MultiRaceOpportunity | null {
  if (opportunities.length === 0) return null;

  // Already sorted by quality, so first is best
  return opportunities[0] || null;
}

/**
 * Get opportunities by type
 */
export function getOpportunitiesByType(
  opportunities: MultiRaceOpportunity[],
  type: MultiRaceBetType
): MultiRaceOpportunity[] {
  return opportunities.filter(o => o.type === type);
}

/**
 * Get PRIME opportunities only
 */
export function getPrimeOpportunities(
  opportunities: MultiRaceOpportunity[]
): MultiRaceOpportunity[] {
  return opportunities.filter(o => o.quality === 'PRIME');
}

/**
 * Get quality icon for display
 */
export function getQualityIcon(quality: MultiRaceQuality): string {
  switch (quality) {
    case 'PRIME':
      return '⭐';
    case 'GOOD':
      return '✓';
    case 'MARGINAL':
      return '○';
  }
}

/**
 * Get quality color for display
 */
export function getQualityColor(quality: MultiRaceQuality): string {
  switch (quality) {
    case 'PRIME':
      return '#10b981'; // Green
    case 'GOOD':
      return '#3b82f6'; // Blue
    case 'MARGINAL':
      return '#6B7280'; // Gray
  }
}

/**
 * Get quality background color for display
 */
export function getQualityBgColor(quality: MultiRaceQuality): string {
  switch (quality) {
    case 'PRIME':
      return 'rgba(16, 185, 129, 0.15)';
    case 'GOOD':
      return 'rgba(59, 130, 246, 0.15)';
    case 'MARGINAL':
      return 'rgba(107, 114, 128, 0.15)';
  }
}

/**
 * Format race range for display (e.g., "Races 3-6")
 */
export function formatRaceRange(races: number[]): string {
  if (races.length === 0) return '';
  const min = Math.min(...races);
  const max = Math.max(...races);
  return `Races ${min}-${max}`;
}

/**
 * Get summary of opportunities for display
 */
export function getOpportunitiesSummary(opportunities: MultiRaceOpportunity[]): {
  total: number;
  prime: number;
  good: number;
  marginal: number;
  bestType: MultiRaceBetType | null;
} {
  const prime = opportunities.filter(o => o.quality === 'PRIME').length;
  const good = opportunities.filter(o => o.quality === 'GOOD').length;
  const marginal = opportunities.filter(o => o.quality === 'MARGINAL').length;

  return {
    total: opportunities.length,
    prime,
    good,
    marginal,
    bestType: opportunities.length > 0 ? (opportunities[0]?.type ?? null) : null,
  };
}
