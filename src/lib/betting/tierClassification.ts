import type { HorseEntry } from '../../types/drf';
import type { HorseScore } from '../scoring';
import {
  parseOdds,
  analyzeOverlayWithField,
  calculateTierAdjustment,
  type OverlayAnalysis,
  // Field-relative scoring imports
  calculateFieldContext,
  calculateFieldRelativeScore,
  type FieldContext,
  type FieldRelativeResult,
} from '../scoring';
import { isFieldRelativeScoringEnabled } from '../config/featureFlags';

// Tier definitions
export type BettingTier = 'tier1' | 'tier2' | 'tier3';

export interface TierThresholds {
  minScore: number;
  maxScore: number;
  minConfidence: number;
  maxConfidence: number;
}

export const TIER_CONFIG: Record<BettingTier, TierThresholds> = {
  // v3.1: Adjusted minConfidence to be achievable with MAX_BASE_SCORE=328
  // Confidence formula: 40 + (baseScore/328) * 60
  // Score 180 → confidence ~73%, Score 220 → confidence ~80%
  tier1: { minScore: 180, maxScore: 240, minConfidence: 70, maxConfidence: 100 },
  tier2: { minScore: 160, maxScore: 179, minConfidence: 60, maxConfidence: 79 },
  tier3: { minScore: 130, maxScore: 159, minConfidence: 40, maxConfidence: 59 },
};

export const TIER_NAMES: Record<BettingTier, string> = {
  tier1: 'Cover Chalk',
  tier2: 'Logical Alternatives',
  tier3: 'Value Bombs',
};

export const TIER_DESCRIPTIONS: Record<BettingTier, string> = {
  tier1: 'Top contenders with strong fundamentals. High confidence plays.',
  tier2: 'Solid value plays with good win/place potential.',
  tier3: 'Overlay opportunities. High risk, high reward lottery tickets.',
};

export const TIER_EXPECTED_HIT_RATE: Record<
  BettingTier,
  { win: number; place: number; show: number }
> = {
  tier1: { win: 35, place: 55, show: 70 },
  tier2: { win: 18, place: 35, show: 50 },
  tier3: { win: 8, place: 18, show: 28 },
};

export interface ClassifiedHorse {
  horse: HorseEntry;
  horseIndex: number;
  score: HorseScore;
  confidence: number;
  odds: number;
  oddsDisplay: string;
  tier: BettingTier;
  valueScore: number; // How much overlay exists (legacy)
  /** Full overlay analysis */
  overlay: OverlayAnalysis;
  /** Adjusted score considering overlay */
  adjustedScore: number;
  /** Whether this is a special case (diamond in rough, fool's gold) */
  isSpecialCase: boolean;
  /** Special case type if applicable */
  specialCaseType: 'diamond_in_rough' | 'fool_gold' | null;
  /** Tier adjustment reasoning */
  tierAdjustmentReasoning: string;
  /** Field-relative analysis (advisory only, does not affect tier) */
  fieldRelative?: FieldRelativeResult;
}

export interface TierGroup {
  tier: BettingTier;
  name: string;
  description: string;
  horses: ClassifiedHorse[];
  expectedHitRate: { win: number; place: number; show: number };
  /** Field context for this race (advisory, shared across all horses) */
  fieldContext?: FieldContext;
}

/**
 * Calculate confidence percentage based on BASE score
 * Max base score is 328, so we scale to 100%
 */
function calculateConfidence(baseScore: number): number {
  // Base confidence from score (0-328 maps to 40-100%)
  const baseConfidence = 40 + (baseScore / 328) * 60;
  return Math.min(100, Math.round(baseConfidence));
}

/**
 * Calculate value score - measures how much overlay exists
 * Higher value means better odds than the score suggests
 * NOTE: This is a legacy function kept for compatibility
 */
function calculateValueScore(baseScore: number, odds: number): number {
  // Expected odds based on base score (higher score = lower expected odds)
  const normalizedScore = baseScore / 328; // Use 328-point scale
  const expectedOdds = 1 / normalizedScore - 1;

  // Value = actual odds vs expected odds
  // > 0 means overlay (good value)
  const value = ((odds - expectedOdds) / Math.max(expectedOdds, 0.5)) * 100;

  return Math.round(value * 10) / 10;
}

/**
 * Determine which tier a horse belongs to based on score
 * Uses adjusted score (considering overlay) for tier assignment
 *
 * Enhanced logic:
 * - High score + overlay = bump up tier
 * - High score + underlay = bump down tier
 * - Diamond in Rough (score 140-170 + 150%+ overlay) = Tier 2 with special flag
 */
function determineTier(
  rawScore: number,
  adjustedScore: number,
  confidence: number,
  isSpecialCase: boolean,
  specialCaseType: 'diamond_in_rough' | 'fool_gold' | null
): BettingTier | null {
  // Special case: Diamond in Rough - force into Tier 2 (value play)
  if (isSpecialCase && specialCaseType === 'diamond_in_rough') {
    return 'tier2';
  }

  // Special case: Fool's Gold - demote from Tier 1
  if (isSpecialCase && specialCaseType === 'fool_gold' && rawScore >= TIER_CONFIG.tier1.minScore) {
    return 'tier2';
  }

  // Use adjusted score for tier determination
  const scoreToUse = adjustedScore;

  if (scoreToUse >= TIER_CONFIG.tier1.minScore && confidence >= TIER_CONFIG.tier1.minConfidence) {
    return 'tier1';
  }
  if (scoreToUse >= TIER_CONFIG.tier2.minScore && scoreToUse <= TIER_CONFIG.tier2.maxScore + 20) {
    return 'tier2';
  }
  if (scoreToUse >= TIER_CONFIG.tier3.minScore && scoreToUse <= TIER_CONFIG.tier3.maxScore + 20) {
    return 'tier3';
  }
  return null; // Below threshold for betting
}

/**
 * Check if a horse has a specific overlay angle for Tier 3
 * Now uses the enhanced overlay analysis
 */
function hasOverlayAngle(overlayPercent: number): boolean {
  // For tier 3, we want horses where odds offer significant value
  // At least 25% overlay for tier 3 consideration
  return overlayPercent >= 25;
}

/**
 * Classify horses into betting tiers
 *
 * Enhanced with overlay analysis:
 * - Uses adjusted scores for tier determination
 * - Identifies special cases (Diamond in Rough, Fool's Gold)
 * - Includes full overlay analysis in classified horse data
 *
 * @param horses Array of horse entries
 * @param scores Map of horse index to score
 * @param getOdds Function to get current odds for a horse
 * @returns Array of tier groups with classified horses
 */
export function classifyHorses(
  horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>
): TierGroup[] {
  const classifiedHorses: ClassifiedHorse[] = [];

  // Collect all non-scratched BASE scores for field-relative calculations
  // IMPORTANT: Use baseScore (not total) for proper overlay calculation
  const activeHorses = horses.filter((h) => !h.score.isScratched);
  const allBaseScores = activeHorses.map((h) => h.score.baseScore);
  const allScores = activeHorses.map((h) => h.score.total); // For field context

  // Calculate field context if enabled and we have enough horses
  let fieldContext: FieldContext | undefined;
  if (isFieldRelativeScoringEnabled() && allScores.length >= 2) {
    fieldContext = calculateFieldContext(allScores);
  }

  for (const { horse, index, score } of horses) {
    // Skip scratched horses
    if (score.isScratched) continue;

    const odds = parseOdds(horse.morningLineOdds);
    const confidence = calculateConfidence(score.baseScore); // Use baseScore

    // Perform full overlay analysis with field context
    // Uses BASE scores for proper field-relative win probability
    const overlay = analyzeOverlayWithField(score.baseScore, allBaseScores, horse.morningLineOdds);

    // Calculate tier adjustment based on overlay
    // Pass BASE score for both calculations (proper tier determination)
    const tierAdjustment = calculateTierAdjustment(
      score.baseScore, // Use baseScore for adjustment calculations
      score.baseScore, // Use baseScore for threshold checks
      overlay.overlayPercent
    );

    // Determine tier using BASE score and adjusted score
    const tier = determineTier(
      score.baseScore, // Use baseScore as raw score
      tierAdjustment.adjustedScore,
      confidence,
      tierAdjustment.isSpecialCase,
      tierAdjustment.specialCaseType
    );

    // For tier 3, also check for overlay angle (using new method)
    if (tier === 'tier3' && !hasOverlayAngle(overlay.overlayPercent)) {
      continue; // Skip tier 3 horses without overlay angle
    }

    if (tier) {
      // Calculate field-relative metrics (advisory only, does not affect tier)
      let fieldRelative: FieldRelativeResult | undefined;
      if (fieldContext) {
        fieldRelative = calculateFieldRelativeScore(score.total, allScores, fieldContext);
      }

      classifiedHorses.push({
        horse,
        horseIndex: index,
        score,
        confidence,
        odds,
        oddsDisplay: horse.morningLineOdds,
        tier,
        valueScore: calculateValueScore(score.baseScore, odds),
        overlay,
        adjustedScore: tierAdjustment.adjustedScore,
        isSpecialCase: tierAdjustment.isSpecialCase,
        specialCaseType: tierAdjustment.specialCaseType,
        tierAdjustmentReasoning: tierAdjustment.reasoning,
        fieldRelative,
      });
    }
  }

  // Group by tier with enhanced sorting
  const tier1Horses = classifiedHorses
    .filter((h) => h.tier === 'tier1')
    .sort((a, b) => {
      // Sort by adjusted score, then by overlay for ties
      if (b.adjustedScore !== a.adjustedScore) return b.adjustedScore - a.adjustedScore;
      return b.overlay.overlayPercent - a.overlay.overlayPercent;
    });

  const tier2Horses = classifiedHorses
    .filter((h) => h.tier === 'tier2')
    .sort((a, b) => {
      // Diamond in Rough horses first, then by overlay percentage
      if (a.isSpecialCase && a.specialCaseType === 'diamond_in_rough' && !b.isSpecialCase)
        return -1;
      if (b.isSpecialCase && b.specialCaseType === 'diamond_in_rough' && !a.isSpecialCase) return 1;
      // Then sort by overlay percentage (best value first)
      return b.overlay.overlayPercent - a.overlay.overlayPercent;
    });

  const tier3Horses = classifiedHorses
    .filter((h) => h.tier === 'tier3')
    .sort((a, b) => {
      // Sort by overlay percentage first (best value), then by odds
      if (b.overlay.overlayPercent !== a.overlay.overlayPercent) {
        return b.overlay.overlayPercent - a.overlay.overlayPercent;
      }
      return b.odds - a.odds; // Highest odds as tiebreaker
    });

  const tierGroups: TierGroup[] = [];

  if (tier1Horses.length > 0) {
    tierGroups.push({
      tier: 'tier1',
      name: TIER_NAMES.tier1,
      description: TIER_DESCRIPTIONS.tier1,
      horses: tier1Horses,
      expectedHitRate: TIER_EXPECTED_HIT_RATE.tier1,
      fieldContext,
    });
  }

  if (tier2Horses.length > 0) {
    tierGroups.push({
      tier: 'tier2',
      name: TIER_NAMES.tier2,
      description: TIER_DESCRIPTIONS.tier2,
      horses: tier2Horses,
      expectedHitRate: TIER_EXPECTED_HIT_RATE.tier2,
      fieldContext,
    });
  }

  if (tier3Horses.length > 0) {
    tierGroups.push({
      tier: 'tier3',
      name: TIER_NAMES.tier3,
      description: TIER_DESCRIPTIONS.tier3,
      horses: tier3Horses,
      expectedHitRate: TIER_EXPECTED_HIT_RATE.tier3,
      fieldContext,
    });
  }

  return tierGroups;
}

/**
 * Get all horses that qualify for betting recommendations
 */
export function getQualifyingHorses(
  horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>
): ClassifiedHorse[] {
  const tierGroups = classifyHorses(horses);
  return tierGroups.flatMap((group) => group.horses);
}

/**
 * Check if any horses qualify for betting recommendations
 */
export function hasQualifyingHorses(
  horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>
): boolean {
  return classifyHorses(horses).some((group) => group.horses.length > 0);
}
