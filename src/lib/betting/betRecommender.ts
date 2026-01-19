/**
 * Bet Recommendation Engine
 *
 * Generates betting recommendations based on overlay pipeline output,
 * Kelly criterion calculations, and configurable bet sizing rules.
 *
 * Only recommends bets when:
 * - Positive EV (> 0)
 * - True overlay > 3%
 * - Calibration is active OR high confidence score
 * - Kelly fraction > 0
 * - Tier 1, 2, or 3 (no Pass tier)
 *
 * @module betting/betRecommender
 */

import type { OverlayPipelineOutput, OverlayHorseOutput } from '../scoring/overlayPipeline';
import { isCalibrationActive } from '../scoring/probabilityConversion';
import { calculateKelly, type KellyOutput } from './kellyCalculator';
import {
  sizeBet,
  adjustForSimultaneousBets,
  type BetSizingConfig,
  type SizedBet,
  DEFAULT_BET_SIZING_CONFIG,
} from './betSizer';
import { estimatePlaceProbability, estimateShowProbability } from './placeShowEstimator';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Bet type for recommendations
 */
export type BetType = 'WIN' | 'PLACE' | 'SHOW';

/**
 * Confidence level for recommendations
 */
export type RecommendationConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Individual bet recommendation
 */
export interface BetRecommendation {
  /** Program number */
  programNumber: number;
  /** Horse name if available */
  horseName?: string;
  /** Bet type */
  betType: BetType;
  /** Suggested bet amount in dollars */
  suggestedAmount: number;
  /** Actual odds (decimal) */
  odds: number;
  /** Model probability (calibrated if available) */
  probability: number;
  /** Expected value per $1 bet */
  expectedValue: number;
  /** Kelly fraction (quarter Kelly) */
  kellyFraction: number;
  /** Recommendation confidence */
  confidence: RecommendationConfidence;
  /** Human-readable reasoning */
  reasoning: string;
  /** Full Kelly calculation result */
  kellyResult: KellyOutput;
  /** Sized bet result */
  sizedBet: SizedBet;
  /** True overlay percentage */
  trueOverlayPercent: number;
  /** Tier based on score */
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3';
}

/**
 * Race-level recommendations
 */
export interface RaceRecommendations {
  /** Race identifier */
  raceId: string;
  /** All bet recommendations for this race */
  recommendations: BetRecommendation[];
  /** Total suggested bets in dollars */
  totalSuggestedBets: number;
  /** Total exposure as percentage of bankroll */
  totalExposure: number;
  /** Whether we suggest passing this race */
  passSuggested: boolean;
  /** Reason for passing if applicable */
  passReason?: string;
  /** Whether calibration was applied */
  calibrationApplied: boolean;
  /** Field size */
  fieldSize: number;
  /** Best value horse program number */
  bestValueHorse: number | null;
}

/**
 * Filter criteria for recommendations
 */
export interface RecommendationFilters {
  /** Minimum EV to recommend (default: 0) */
  minEV: number;
  /** Minimum true overlay percent (default: 3) */
  minOverlayPercent: number;
  /** Minimum score for Tier 1 */
  tier1MinScore: number;
  /** Minimum score for Tier 2 */
  tier2MinScore: number;
  /** Minimum score for Tier 3 */
  tier3MinScore: number;
  /** Whether to include place/show bets */
  includePlaceShow: boolean;
  /** Require calibration to be active */
  requireCalibration: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default recommendation filters
 */
export const DEFAULT_FILTERS: RecommendationFilters = {
  minEV: 0, // Any positive EV
  minOverlayPercent: 3, // At least 3% overlay
  tier1MinScore: 180, // Elite tier
  tier2MinScore: 160, // Strong tier
  tier3MinScore: 140, // Value tier
  includePlaceShow: true,
  requireCalibration: false, // Don't require, but note when not active
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Generate bet recommendations for a race
 *
 * @param pipelineOutput - Output from the overlay pipeline
 * @param bankroll - Current bankroll in dollars
 * @param config - Bet sizing configuration (optional)
 * @param filters - Recommendation filters (optional)
 * @returns Race recommendations
 *
 * @example
 * const pipeline = calculateOverlayPipeline(input);
 * const recommendations = generateBetRecommendations(pipeline, 500);
 */
export function generateBetRecommendations(
  pipelineOutput: OverlayPipelineOutput,
  bankroll: number,
  config: Partial<BetSizingConfig> = {},
  filters: Partial<RecommendationFilters> = {}
): RaceRecommendations {
  const fullConfig = { ...DEFAULT_BET_SIZING_CONFIG, ...config };
  const fullFilters = { ...DEFAULT_FILTERS, ...filters };
  const calibrationApplied = isCalibrationActive() || pipelineOutput.calibrationApplied;

  // Handle empty race
  if (!pipelineOutput.horses || pipelineOutput.horses.length === 0) {
    return {
      raceId: 'unknown',
      recommendations: [],
      totalSuggestedBets: 0,
      totalExposure: 0,
      passSuggested: true,
      passReason: 'No horses in race',
      calibrationApplied,
      fieldSize: 0,
      bestValueHorse: null,
    };
  }

  // Check calibration requirement
  if (fullFilters.requireCalibration && !calibrationApplied) {
    return {
      raceId: 'unknown',
      recommendations: [],
      totalSuggestedBets: 0,
      totalExposure: 0,
      passSuggested: true,
      passReason: 'Calibration not yet active (need 500+ races)',
      calibrationApplied,
      fieldSize: pipelineOutput.fieldMetrics.fieldSize,
      bestValueHorse: null,
    };
  }

  const recommendations: BetRecommendation[] = [];
  const sizedBets: SizedBet[] = [];

  // Process each horse
  for (const horse of pipelineOutput.horses) {
    // Determine tier from base score
    const tier = determineTier(horse.baseScore, fullFilters);

    // Skip Pass tier horses (score < tier3MinScore)
    if (!tier) {
      continue;
    }

    // Check if horse meets basic criteria
    if (!meetsBasicCriteria(horse, fullFilters)) {
      continue;
    }

    // Calculate Kelly for WIN bet
    const winKelly = calculateKelly({
      probability: horse.modelProbability,
      decimalOdds: horse.actualOdds,
      bankroll,
    });

    // Only recommend if Kelly suggests betting
    if (winKelly.shouldBet && winKelly.isPositiveEV) {
      const sizedWinBet = sizeBet(winKelly, bankroll, fullConfig);

      if (sizedWinBet.finalBet > 0) {
        const confidence = determineConfidence(horse, calibrationApplied, tier);
        const reasoning = generateReasoning(horse, winKelly, tier, calibrationApplied);

        recommendations.push({
          programNumber: horse.programNumber,
          horseName: horse.horseName,
          betType: 'WIN',
          suggestedAmount: sizedWinBet.finalBet,
          odds: horse.actualOdds,
          probability: horse.modelProbability,
          expectedValue: horse.expectedValue,
          kellyFraction: winKelly.quarterKellyFraction,
          confidence,
          reasoning,
          kellyResult: winKelly,
          sizedBet: sizedWinBet,
          trueOverlayPercent: horse.trueOverlayPercent,
          tier,
        });

        sizedBets.push(sizedWinBet);
      }
    }

    // Consider place/show bets if enabled
    if (fullFilters.includePlaceShow) {
      const placeShowRecs = generatePlaceShowRecommendations(
        horse,
        bankroll,
        fullConfig,
        fullFilters,
        tier,
        calibrationApplied,
        pipelineOutput.fieldMetrics.fieldSize
      );

      for (const rec of placeShowRecs) {
        recommendations.push(rec);
        sizedBets.push(rec.sizedBet);
      }
    }
  }

  // Adjust for simultaneous exposure
  const adjustedBets = adjustForSimultaneousBets(sizedBets, bankroll, 0.1);

  // Update recommendations with adjusted amounts
  for (let i = 0; i < recommendations.length; i++) {
    const adjusted = adjustedBets[i];
    if (adjusted && adjusted.finalBet !== recommendations[i]!.suggestedAmount) {
      recommendations[i]!.suggestedAmount = adjusted.finalBet;
      recommendations[i]!.sizedBet = adjusted;
    }
  }

  // Filter out zero-amount recommendations after adjustment
  const finalRecommendations = recommendations.filter((r) => r.suggestedAmount > 0);

  // Calculate totals
  const totalSuggestedBets = finalRecommendations.reduce((sum, r) => sum + r.suggestedAmount, 0);
  const totalExposure = bankroll > 0 ? (totalSuggestedBets / bankroll) * 100 : 0;

  // Determine if we should pass this race
  const passSuggested = finalRecommendations.length === 0;
  const passReason = passSuggested ? determinePassReason(pipelineOutput, fullFilters) : undefined;

  return {
    raceId: 'unknown', // Would be set by caller
    recommendations: finalRecommendations,
    totalSuggestedBets,
    totalExposure,
    passSuggested,
    passReason,
    calibrationApplied,
    fieldSize: pipelineOutput.fieldMetrics.fieldSize,
    bestValueHorse: pipelineOutput.fieldMetrics.bestValueHorse,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine tier from base score
 */
function determineTier(
  baseScore: number,
  filters: RecommendationFilters
): 'TIER_1' | 'TIER_2' | 'TIER_3' | null {
  if (baseScore >= filters.tier1MinScore) return 'TIER_1';
  if (baseScore >= filters.tier2MinScore) return 'TIER_2';
  if (baseScore >= filters.tier3MinScore) return 'TIER_3';
  return null; // Pass tier
}

/**
 * Check if horse meets basic betting criteria
 */
function meetsBasicCriteria(horse: OverlayHorseOutput, filters: RecommendationFilters): boolean {
  // Must have positive EV
  if (horse.expectedValue <= filters.minEV) {
    return false;
  }

  // Must have sufficient overlay
  if (horse.trueOverlayPercent < filters.minOverlayPercent) {
    return false;
  }

  // Must have valid probability
  if (horse.modelProbability <= 0 || horse.modelProbability >= 1) {
    return false;
  }

  return true;
}

/**
 * Determine recommendation confidence
 */
function determineConfidence(
  horse: OverlayHorseOutput,
  calibrationApplied: boolean,
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3'
): RecommendationConfidence {
  // High confidence: Tier 1 with calibration and strong overlay
  if (tier === 'TIER_1' && calibrationApplied && horse.trueOverlayPercent >= 10) {
    return 'HIGH';
  }

  // High confidence: Strong EV with calibration
  if (calibrationApplied && horse.expectedValue >= 0.15) {
    return 'HIGH';
  }

  // Medium confidence: Tier 1-2 with moderate overlay
  if ((tier === 'TIER_1' || tier === 'TIER_2') && horse.trueOverlayPercent >= 5) {
    return 'MEDIUM';
  }

  // Medium confidence: Positive EV with calibration
  if (calibrationApplied && horse.expectedValue > 0) {
    return 'MEDIUM';
  }

  // Low confidence: Everything else
  return 'LOW';
}

/**
 * Generate human-readable reasoning for a recommendation
 */
function generateReasoning(
  horse: OverlayHorseOutput,
  kelly: KellyOutput,
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3',
  calibrationApplied: boolean
): string {
  const parts: string[] = [];

  // Tier context
  const tierName =
    tier === 'TIER_1' ? 'Top contender' : tier === 'TIER_2' ? 'Solid alternative' : 'Value play';
  parts.push(tierName);

  // Overlay value
  if (horse.trueOverlayPercent >= 15) {
    parts.push(`strong value at ${horse.trueOverlayPercent.toFixed(1)}% overlay`);
  } else if (horse.trueOverlayPercent >= 8) {
    parts.push(`good value at ${horse.trueOverlayPercent.toFixed(1)}% overlay`);
  } else {
    parts.push(`${horse.trueOverlayPercent.toFixed(1)}% overlay`);
  }

  // EV context
  if (horse.expectedValue >= 0.2) {
    parts.push(`excellent EV of ${(horse.expectedValue * 100).toFixed(1)}%`);
  } else if (horse.expectedValue >= 0.1) {
    parts.push(`solid EV of ${(horse.expectedValue * 100).toFixed(1)}%`);
  }

  // Calibration note
  if (!calibrationApplied) {
    parts.push('(uncalibrated probabilities)');
  }

  return parts.join(', ');
}

/**
 * Determine why we're passing on a race
 */
function determinePassReason(
  pipelineOutput: OverlayPipelineOutput,
  filters: RecommendationFilters
): string {
  const horses = pipelineOutput.horses;

  // Check if any horses have positive EV
  const anyPositiveEV = horses.some((h) => h.expectedValue > 0);
  if (!anyPositiveEV) {
    return 'No positive EV opportunities in this race';
  }

  // Check if any meet overlay threshold
  const anyOverlay = horses.some((h) => h.trueOverlayPercent >= filters.minOverlayPercent);
  if (!anyOverlay) {
    return `No horses with ${filters.minOverlayPercent}%+ overlay`;
  }

  // Check if any are in betting tiers
  const anyInTier = horses.some((h) => h.baseScore >= filters.tier3MinScore);
  if (!anyInTier) {
    return 'No horses meet minimum score threshold';
  }

  return 'No bets meet all criteria (EV, overlay, tier)';
}

/**
 * Generate place/show bet recommendations
 */
function generatePlaceShowRecommendations(
  horse: OverlayHorseOutput,
  bankroll: number,
  config: BetSizingConfig,
  filters: RecommendationFilters,
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3',
  calibrationApplied: boolean,
  fieldSize: number
): BetRecommendation[] {
  const recommendations: BetRecommendation[] = [];

  // Estimate place/show probabilities
  const placeEstimate = estimatePlaceProbability(horse.modelProbability, fieldSize);
  const showEstimate = estimateShowProbability(horse.modelProbability, fieldSize);

  // Place bet recommendation
  // Place bet typically pays about 40% of win odds
  const placeOdds = 1 + (horse.actualOdds - 1) * 0.4;
  const placeEV = placeEstimate.probability * placeOdds - 1;

  if (placeEV > 0 && placeEstimate.confidence !== 'LOW') {
    const placeKelly = calculateKelly({
      probability: placeEstimate.probability,
      decimalOdds: placeOdds,
      bankroll,
    });

    if (placeKelly.shouldBet) {
      const sizedPlaceBet = sizeBet(placeKelly, bankroll, {
        ...config,
        maxBetPercent: config.maxBetPercent * 0.5, // Reduce max for place bets
      });

      if (sizedPlaceBet.finalBet > 0) {
        recommendations.push({
          programNumber: horse.programNumber,
          horseName: horse.horseName,
          betType: 'PLACE',
          suggestedAmount: sizedPlaceBet.finalBet,
          odds: placeOdds,
          probability: placeEstimate.probability,
          expectedValue: placeEV,
          kellyFraction: placeKelly.quarterKellyFraction,
          confidence: placeEstimate.confidence === 'HIGH' ? 'MEDIUM' : 'LOW',
          reasoning: `Place bet: ${(placeEstimate.probability * 100).toFixed(0)}% est. probability`,
          kellyResult: placeKelly,
          sizedBet: sizedPlaceBet,
          trueOverlayPercent: horse.trueOverlayPercent,
          tier,
        });
      }
    }
  }

  // Show bet recommendation (only for conservative plays or risky win bets)
  // Show bet typically pays about 20% of win odds
  const showOdds = 1 + (horse.actualOdds - 1) * 0.2;
  const showEV = showEstimate.probability * showOdds - 1;

  // Only recommend show when win is risky or user prefers conservative
  const isHighOddsHorse = horse.actualOdds >= 6.0;

  if (showEV > 0 && showEstimate.confidence !== 'LOW' && isHighOddsHorse) {
    const showKelly = calculateKelly({
      probability: showEstimate.probability,
      decimalOdds: showOdds,
      bankroll,
    });

    if (showKelly.shouldBet) {
      const sizedShowBet = sizeBet(showKelly, bankroll, {
        ...config,
        maxBetPercent: config.maxBetPercent * 0.3, // Further reduce max for show bets
      });

      if (sizedShowBet.finalBet > 0) {
        recommendations.push({
          programNumber: horse.programNumber,
          horseName: horse.horseName,
          betType: 'SHOW',
          suggestedAmount: sizedShowBet.finalBet,
          odds: showOdds,
          probability: showEstimate.probability,
          expectedValue: showEV,
          kellyFraction: showKelly.quarterKellyFraction,
          confidence: 'LOW', // Show bets are always lower confidence
          reasoning: `Show bet: ${(showEstimate.probability * 100).toFixed(0)}% est. probability (lower risk)`,
          kellyResult: showKelly,
          sizedBet: sizedShowBet,
          trueOverlayPercent: horse.trueOverlayPercent,
          tier,
        });
      }
    }
  }

  return recommendations;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sort recommendations by priority (highest value first)
 */
export function sortRecommendationsByValue(
  recommendations: BetRecommendation[]
): BetRecommendation[] {
  return [...recommendations].sort((a, b) => {
    // Primary: Tier (Tier 1 > Tier 2 > Tier 3)
    const tierOrder = { TIER_1: 0, TIER_2: 1, TIER_3: 2 };
    const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
    if (tierDiff !== 0) return tierDiff;

    // Secondary: EV (higher is better)
    const evDiff = b.expectedValue - a.expectedValue;
    if (Math.abs(evDiff) > 0.01) return evDiff;

    // Tertiary: Overlay (higher is better)
    return b.trueOverlayPercent - a.trueOverlayPercent;
  });
}

/**
 * Filter recommendations by bet type
 */
export function filterByBetType(
  recommendations: BetRecommendation[],
  betTypes: BetType[]
): BetRecommendation[] {
  return recommendations.filter((r) => betTypes.includes(r.betType));
}

/**
 * Get top N recommendations
 */
export function getTopRecommendations(
  recommendations: BetRecommendation[],
  count: number
): BetRecommendation[] {
  return sortRecommendationsByValue(recommendations).slice(0, count);
}

/**
 * Format recommendation for display
 */
export function formatRecommendation(rec: BetRecommendation): {
  display: string;
  amount: string;
  confidence: string;
  ev: string;
} {
  const horseName = rec.horseName ?? `#${rec.programNumber}`;
  return {
    display: `${rec.betType} ${horseName}`,
    amount: `$${rec.suggestedAmount}`,
    confidence: rec.confidence,
    ev: `${rec.expectedValue >= 0 ? '+' : ''}${(rec.expectedValue * 100).toFixed(1)}% EV`,
  };
}

/**
 * Calculate total potential return for recommendations
 */
export function calculatePotentialReturn(recommendations: BetRecommendation[]): {
  totalBets: number;
  expectedReturn: number;
  bestCaseReturn: number;
} {
  const totalBets = recommendations.reduce((sum, r) => sum + r.suggestedAmount, 0);

  // Expected return = sum of (bet × (1 + EV))
  const expectedReturn = recommendations.reduce(
    (sum, r) => sum + r.suggestedAmount * (1 + r.expectedValue),
    0
  );

  // Best case = if all win bets hit
  const bestCaseReturn = recommendations.reduce((sum, r) => {
    if (r.betType === 'WIN') {
      return sum + r.suggestedAmount * r.odds;
    }
    return sum + r.suggestedAmount * r.odds;
  }, 0);

  return {
    totalBets,
    expectedReturn,
    bestCaseReturn,
  };
}
