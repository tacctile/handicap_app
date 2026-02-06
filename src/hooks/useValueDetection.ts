/**
 * Value Detection Hook
 *
 * Identifies live longshots the public is undervaluing by:
 * 1. Converting scores to win probabilities
 * 2. Comparing model probabilities to current/morning line odds
 * 3. Flagging value betting opportunities
 * 4. Providing bet type suggestions
 *
 * Strategy: Find horses the PUBLIC UNDERVALUES
 * - A 15-1 shot that our model ranks #3 is a value bet
 * - A 2-1 favorite that our model ranks #1 is NOT a bet (no edge, chalk)
 */

import { useMemo } from 'react';
import { formatEdge as _formatEdge, getEdgeColor as _getEdgeColor } from '../utils/formatters';
import type { ScoredHorse } from '../lib/scoring';

// ============================================================================
// CONFIGURATION
// ============================================================================

export const VALUE_THRESHOLDS = {
  /** Minimum odds (decimal, e.g., 6 = 6-1) to consider for value */
  minOddsForValue: 6,
  /** Minimum edge percentage to flag as value play */
  minEdgePercent: 50,
  /** Horse must be in model's Top N to be value play */
  minRankForValue: 4,
  /** Edge threshold for high confidence (BET verdict) */
  highConfidenceEdge: 75,
  /** Minimum odds for high confidence BET verdict */
  highConfidenceMinOdds: 8,
  /** Edge threshold for WIN bet recommendation */
  winBetEdge: 100,
  /** Edge threshold for PLACE bet */
  placeBetEdge: 75,
  /** Edge threshold for SHOW bet */
  showBetEdge: 50,
} as const;

// ============================================================================
// TYPES
// ============================================================================

export type RaceVerdict = 'BET' | 'CAUTION' | 'PASS';
export type BetTypeSuggestion = 'WIN' | 'PLACE' | 'SHOW' | 'TRIFECTA_KEY' | 'PASS';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';

export interface ValuePlay {
  /** Horse name */
  horseName: string;
  /** Program/post position number */
  programNumber: number;
  /** Index in the horses array */
  horseIndex: number;
  /** Model rank (1 = best) based on base score */
  modelRank: number;
  /** Horse's base score */
  baseScore: number;
  /** Total score (base + overlay) */
  totalScore: number;
  /** Model's calculated win probability (%) */
  modelWinProb: number;
  /** Model's Top 3 probability (%) */
  modelTop3Prob: number;
  /** Current odds string (e.g., "15-1") */
  currentOdds: string;
  /** Current odds as decimal (e.g., 15 for 15-1) */
  currentOddsDecimal: number;
  /** Implied probability from odds (%) */
  impliedProb: number;
  /** Value edge percentage ((modelProb - impliedProb) / impliedProb * 100) */
  valueEdge: number;
  /** Suggested bet type */
  betType: BetTypeSuggestion;
  /** Confidence level for this play */
  confidence: ConfidenceLevel;
  /** Whether this is the primary value play */
  isPrimary: boolean;
}

/** Info about horse closest to meeting value threshold (for PASS races) */
export interface ClosestToThreshold {
  /** Horse name */
  horseName: string;
  /** Program/post position number */
  programNumber: number;
  /** Horse index in array */
  horseIndex: number;
  /** Current odds string */
  currentOdds: string;
  /** Fair odds string (model's valuation) */
  fairOdds: string;
  /** Edge percentage (below 50% threshold) */
  edge: number;
  /** Model rank */
  modelRank: number;
}

export interface RaceValueAnalysis {
  /** Race verdict: BET, CAUTION, or PASS */
  verdict: RaceVerdict;
  /** Confidence level for the race analysis */
  confidence: ConfidenceLevel;
  /** Reason for the verdict */
  verdictReason: string;
  /** All value plays in this race (sorted by edge descending) */
  valuePlays: ValuePlay[];
  /** Primary value play (highest edge, if any) */
  primaryValuePlay: ValuePlay | null;
  /** Secondary value plays */
  secondaryValuePlays: ValuePlay[];
  /** Whether this race has any value plays */
  hasValuePlay: boolean;
  /** Top pick info (regardless of value) */
  topPick: {
    name: string;
    rank: number;
    score: number;
    odds: string;
    oddsDecimal: number;
    isChalk: boolean;
  } | null;
  /** Total field base score (for probability calculations) */
  totalFieldScore: number;
  /** Number of active (non-scratched) horses */
  activeHorseCount: number;
  /** For PASS races: the horse closest to meeting the value threshold */
  closestToThreshold: ClosestToThreshold | null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse odds string to decimal number
 * "5-1" -> 5, "3/2" -> 1.5, "EVEN" -> 1
 */
export function parseOddsToNumber(oddsStr: string): number {
  const cleaned = oddsStr.trim().toUpperCase();

  if (cleaned === 'EVEN' || cleaned === 'EVN') {
    return 1.0;
  }

  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const num = parseFloat(parts[0] || '10');
    const denom = parseFloat(parts[1] || '1');
    return num / denom;
  }

  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const num = parseFloat(parts[0] || '10');
    const denom = parseFloat(parts[1] || '1');
    return num / denom;
  }

  return parseFloat(cleaned) || 10;
}

/**
 * Convert odds to implied probability
 * 5-1 = 1/(5+1) = 16.67%
 */
export function oddsToImpliedProbability(oddsDecimal: number): number {
  return (1 / (oddsDecimal + 1)) * 100;
}

/**
 * Calculate value edge percentage
 * Edge = (ModelProb - ImpliedProb) / ImpliedProb * 100
 */
export function calculateValueEdge(modelProb: number, impliedProb: number): number {
  if (impliedProb <= 0) return 0;
  return ((modelProb - impliedProb) / impliedProb) * 100;
}

/**
 * Calculate Top 3 probability based on model rank and score gap
 */
function calculateTop3Probability(rank: number, scoreGap: number, fieldSize: number): number {
  // Base probabilities by rank
  const baseProbs: Record<number, number> = {
    1: 80,
    2: 70,
    3: 55,
    4: 45,
    5: 35,
    6: 25,
    7: 18,
    8: 12,
    9: 8,
    10: 5,
  };

  let prob = baseProbs[rank] || Math.max(3, 50 - rank * 5);

  // Adjust for score gap (larger gap = more confident)
  if (scoreGap > 30) prob += 10;
  else if (scoreGap > 20) prob += 5;
  else if (scoreGap < 10) prob -= 5;

  // Adjust for field size (smaller field = higher probability)
  if (fieldSize <= 6) prob += 10;
  else if (fieldSize <= 8) prob += 5;
  else if (fieldSize >= 12) prob -= 5;

  return Math.max(5, Math.min(95, prob));
}

/**
 * Determine bet type based on rank, edge, and odds
 */
function determineBetType(
  rank: number,
  edge: number,
  top3Prob: number,
  oddsDecimal: number
): BetTypeSuggestion {
  // Must be in Top 4 to be actionable
  if (rank > 4) return 'PASS';

  // Minimum odds threshold (must be 6-1 or higher for value)
  if (oddsDecimal < VALUE_THRESHOLDS.minOddsForValue) return 'PASS';

  // WIN bet: Rank #1-2 with 100%+ edge
  if (rank <= 2 && edge >= VALUE_THRESHOLDS.winBetEdge) {
    return 'WIN';
  }

  // PLACE bet: Rank #2-3 with 75%+ edge and high Top 3 probability
  if (rank <= 3 && edge >= VALUE_THRESHOLDS.placeBetEdge && top3Prob >= 60) {
    return 'PLACE';
  }

  // SHOW bet: Rank #3-4 with 50%+ edge and solid Top 3 probability
  if (rank <= 4 && edge >= VALUE_THRESHOLDS.showBetEdge && top3Prob >= 50) {
    return 'SHOW';
  }

  // TRIFECTA KEY: Value horse in Top 4 at big odds
  if (rank <= 4 && edge >= VALUE_THRESHOLDS.showBetEdge && oddsDecimal >= 8) {
    return 'TRIFECTA_KEY';
  }

  return 'PASS';
}

/**
 * Determine confidence level for a value play
 * - HIGH: edge >= 75% AND rank <= 3
 * - MEDIUM: edge >= 50%
 * - LOW: edge >= 25% AND rank <= 4
 * - MINIMAL: edge < 25% OR rank > 4 with weak edge
 */
function determinePlayConfidence(rank: number, edge: number): ConfidenceLevel {
  if (edge >= VALUE_THRESHOLDS.highConfidenceEdge && rank <= 3) {
    return 'HIGH';
  }
  if (edge >= VALUE_THRESHOLDS.minEdgePercent) {
    return 'MEDIUM';
  }
  // Weak edge cases
  if (edge >= 25 && rank <= 4) {
    return 'LOW';
  }
  // Very weak edge or poor rank
  return 'MINIMAL';
}

/**
 * Determine race verdict based on value plays
 */
function determineRaceVerdict(
  valuePlays: ValuePlay[],
  topPickIsChalk: boolean
): { verdict: RaceVerdict; confidence: ConfidenceLevel; reason: string } {
  // No value plays = PASS
  if (valuePlays.length === 0) {
    if (topPickIsChalk) {
      return {
        verdict: 'PASS',
        confidence: 'LOW',
        reason: 'All contenders are chalk (top picks all under 6-1 odds)',
      };
    }
    return {
      verdict: 'PASS',
      confidence: 'LOW',
      reason: 'No value plays identified in this race',
    };
  }

  const bestPlay = valuePlays[0];
  if (!bestPlay) {
    return {
      verdict: 'PASS',
      confidence: 'LOW',
      reason: 'No valid plays found',
    };
  }

  // HIGH confidence BET: Clear value play with 75%+ edge at 8-1+ odds
  if (
    bestPlay.valueEdge >= VALUE_THRESHOLDS.highConfidenceEdge &&
    bestPlay.currentOddsDecimal >= VALUE_THRESHOLDS.highConfidenceMinOdds &&
    bestPlay.modelRank <= 4
  ) {
    return {
      verdict: 'BET',
      confidence: 'HIGH',
      reason: `Clear value: ${bestPlay.horseName} at ${bestPlay.currentOdds} with +${Math.round(bestPlay.valueEdge)}% edge`,
    };
  }

  // CAUTION: Value exists but smaller edge or tighter odds
  if (bestPlay.valueEdge >= VALUE_THRESHOLDS.minEdgePercent) {
    return {
      verdict: 'CAUTION',
      confidence: 'MEDIUM',
      reason:
        valuePlays.length >= 3
          ? 'Multiple value plays - harder to choose'
          : `Moderate edge: +${Math.round(bestPlay.valueEdge)}%`,
    };
  }

  return {
    verdict: 'PASS',
    confidence: 'LOW',
    reason: 'Only marginal value available',
  };
}

// Re-export from canonical source (precision 0 matches original integer rounding)
export const formatEdge = _formatEdge;

// Re-export from canonical source
export const getEdgeColor = _getEdgeColor;

/**
 * Get verdict color
 */
export function getVerdictColor(verdict: RaceVerdict): string {
  switch (verdict) {
    case 'BET':
      return '#10b981'; // Green
    case 'CAUTION':
      return '#f59e0b'; // Amber/Yellow
    case 'PASS':
      return '#ef4444'; // Red
  }
}

/**
 * Get verdict background color - SOLID opaque colors (no transparency)
 * These are the rgba values pre-blended with the dark background #0f0f10
 */
export function getVerdictBgColor(verdict: RaceVerdict): string {
  switch (verdict) {
    case 'BET':
      return '#0f2921'; // Solid dark green (was rgba(16, 185, 129, 0.15))
    case 'CAUTION':
      return '#2e240f'; // Solid dark amber (was rgba(245, 158, 11, 0.15))
    case 'PASS':
      return '#2e1010'; // Solid dark red (was rgba(239, 68, 68, 0.15))
  }
}

/**
 * Get bet type display name
 */
export function getBetTypeDisplay(betType: BetTypeSuggestion): string {
  switch (betType) {
    case 'WIN':
      return 'WIN';
    case 'PLACE':
      return 'PLACE';
    case 'SHOW':
      return 'SHOW';
    case 'TRIFECTA_KEY':
      return 'TRIFECTA KEY';
    case 'PASS':
      return '—';
  }
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Analyze a race for value betting opportunities
 *
 * @param scoredHorses - Array of scored horses from calculateRaceScores
 * @param getOdds - Function to get current odds for a horse index
 * @param isScratched - Function to check if a horse is scratched
 * @returns Race value analysis with verdict, value plays, and recommendations
 */
export function analyzeRaceValue(
  scoredHorses: ScoredHorse[],
  getOdds: (index: number, originalOdds: string) => string,
  isScratched: (index: number) => boolean
): RaceValueAnalysis {
  // Filter active (non-scratched) horses and sort by rank
  const activeHorses = scoredHorses
    .filter((h) => !isScratched(h.index) && !h.score.isScratched)
    .sort((a, b) => a.rank - b.rank);

  if (activeHorses.length === 0) {
    return {
      verdict: 'PASS',
      confidence: 'LOW',
      verdictReason: 'No active horses in the race',
      valuePlays: [],
      primaryValuePlay: null,
      secondaryValuePlays: [],
      hasValuePlay: false,
      topPick: null,
      totalFieldScore: 0,
      activeHorseCount: 0,
      closestToThreshold: null,
    };
  }

  // Calculate total field score for probability calculations
  const totalFieldScore = activeHorses.reduce((sum, h) => sum + h.score.baseScore, 0);

  // Analyze each horse for value
  const valuePlays: ValuePlay[] = [];

  // Track horses that didn't meet the value threshold (for PASS race display)
  const nearMissHorses: Array<{
    horseName: string;
    programNumber: number;
    horseIndex: number;
    currentOdds: string;
    oddsDecimal: number;
    edge: number;
    modelRank: number;
    modelWinProb: number;
  }> = [];

  for (const scoredHorse of activeHorses) {
    const horse = scoredHorse.horse;
    const rank = scoredHorse.rank;

    // Only consider Top 6 for value opportunities
    if (rank > 6) continue;

    const currentOdds = getOdds(scoredHorse.index, horse.morningLineOdds);
    const oddsDecimal = parseOddsToNumber(currentOdds);

    // Calculate probabilities regardless of odds threshold (for near-miss tracking)
    const modelWinProb =
      totalFieldScore > 0 ? (scoredHorse.score.baseScore / totalFieldScore) * 100 : 0;
    const impliedProb = oddsToImpliedProbability(oddsDecimal);
    const valueEdge = calculateValueEdge(modelWinProb, impliedProb);

    // Track horses at 6-1 or higher that have positive edge but below threshold
    if (
      oddsDecimal >= VALUE_THRESHOLDS.minOddsForValue &&
      valueEdge > 0 &&
      valueEdge < VALUE_THRESHOLDS.minEdgePercent
    ) {
      nearMissHorses.push({
        horseName: horse.horseName,
        programNumber: horse.programNumber,
        horseIndex: scoredHorse.index,
        currentOdds,
        oddsDecimal,
        edge: valueEdge,
        modelRank: rank,
        modelWinProb,
      });
    }

    // Skip chalk horses (under 6-1) for value plays
    if (oddsDecimal < VALUE_THRESHOLDS.minOddsForValue) continue;

    // Skip if edge is below threshold for value plays
    if (valueEdge < VALUE_THRESHOLDS.minEdgePercent) continue;

    // Calculate Top 3 probability
    const nextHorseScore = activeHorses[rank]?.score.baseScore || 0;
    const scoreGap = scoredHorse.score.baseScore - nextHorseScore;
    const top3Prob = calculateTop3Probability(rank, scoreGap, activeHorses.length);

    // Determine bet type
    const betType = determineBetType(rank, valueEdge, top3Prob, oddsDecimal);

    // Skip if no actionable bet type
    if (betType === 'PASS') continue;

    // Determine confidence
    const confidence = determinePlayConfidence(rank, valueEdge);

    valuePlays.push({
      horseName: horse.horseName,
      programNumber: horse.programNumber,
      horseIndex: scoredHorse.index,
      modelRank: rank,
      baseScore: scoredHorse.score.baseScore,
      totalScore: scoredHorse.score.total,
      modelWinProb,
      modelTop3Prob: top3Prob,
      currentOdds,
      currentOddsDecimal: oddsDecimal,
      impliedProb,
      valueEdge,
      betType,
      confidence,
      isPrimary: false,
    });
  }

  // Sort value plays by edge (best first)
  valuePlays.sort((a, b) => b.valueEdge - a.valueEdge);

  // Mark primary value play
  if (valuePlays.length > 0 && valuePlays[0]) {
    valuePlays[0].isPrimary = true;
  }

  // Get top pick info (regardless of value)
  const topPickHorse = activeHorses[0];
  const topPickOdds = topPickHorse
    ? parseOddsToNumber(getOdds(topPickHorse.index, topPickHorse.horse.morningLineOdds))
    : 10;
  const topPickIsChalk = topPickOdds < VALUE_THRESHOLDS.minOddsForValue;

  const topPick = topPickHorse
    ? {
        name: topPickHorse.horse.horseName,
        rank: 1,
        score: topPickHorse.score.baseScore,
        odds: getOdds(topPickHorse.index, topPickHorse.horse.morningLineOdds),
        oddsDecimal: topPickOdds,
        isChalk: topPickIsChalk,
      }
    : null;

  // Determine race verdict
  const { verdict, confidence, reason } = determineRaceVerdict(valuePlays, topPickIsChalk);

  // Find the closest horse to threshold for PASS races
  let closestToThreshold: ClosestToThreshold | null = null;
  if (valuePlays.length === 0 && nearMissHorses.length > 0) {
    // Sort by edge descending to find the horse closest to threshold
    nearMissHorses.sort((a, b) => b.edge - a.edge);
    const closest = nearMissHorses[0];
    if (closest) {
      // Calculate fair odds from model win probability
      const fairOddsDecimal =
        closest.modelWinProb > 0 ? Math.round(100 / closest.modelWinProb - 1) : 10;
      closestToThreshold = {
        horseName: closest.horseName,
        programNumber: closest.programNumber,
        horseIndex: closest.horseIndex,
        currentOdds: closest.currentOdds,
        fairOdds: `${fairOddsDecimal}-1`,
        edge: closest.edge,
        modelRank: closest.modelRank,
      };
    }
  }

  return {
    verdict,
    confidence,
    verdictReason: reason,
    valuePlays,
    primaryValuePlay: valuePlays[0] || null,
    secondaryValuePlays: valuePlays.slice(1),
    hasValuePlay: valuePlays.length > 0,
    topPick,
    totalFieldScore,
    activeHorseCount: activeHorses.length,
    closestToThreshold,
  };
}

/**
 * Hook to analyze a race for value betting opportunities
 * Re-calculates when scored horses, odds, or scratches change
 */
export function useValueDetection(
  scoredHorses: ScoredHorse[],
  getOdds: (index: number, originalOdds: string) => string,
  isScratched: (index: number) => boolean
): RaceValueAnalysis {
  return useMemo(() => {
    return analyzeRaceValue(scoredHorses, getOdds, isScratched);
  }, [scoredHorses, getOdds, isScratched]);
}

export default useValueDetection;
