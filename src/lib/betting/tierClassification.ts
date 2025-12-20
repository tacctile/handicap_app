import type { HorseEntry } from '../../types/drf'
import type { HorseScore } from '../scoring'
import {
  parseOdds,
  analyzeOverlay,
  calculateTierAdjustment,
  type OverlayAnalysis,
} from '../scoring'

// Tier definitions
export type BettingTier = 'tier1' | 'tier2' | 'tier3'

export interface TierThresholds {
  minScore: number
  maxScore: number
  minConfidence: number
  maxConfidence: number
}

export const TIER_CONFIG: Record<BettingTier, TierThresholds> = {
  tier1: { minScore: 180, maxScore: 240, minConfidence: 80, maxConfidence: 100 },
  tier2: { minScore: 160, maxScore: 179, minConfidence: 60, maxConfidence: 79 },
  tier3: { minScore: 140, maxScore: 159, minConfidence: 40, maxConfidence: 59 },
}

export const TIER_NAMES: Record<BettingTier, string> = {
  tier1: 'Cover Chalk',
  tier2: 'Logical Alternatives',
  tier3: 'Value Bombs',
}

export const TIER_DESCRIPTIONS: Record<BettingTier, string> = {
  tier1: 'Top contenders with strong fundamentals. High confidence plays.',
  tier2: 'Solid value plays with good win/place potential.',
  tier3: 'Overlay opportunities. High risk, high reward lottery tickets.',
}

export const TIER_EXPECTED_HIT_RATE: Record<BettingTier, { win: number; place: number; show: number }> = {
  tier1: { win: 35, place: 55, show: 70 },
  tier2: { win: 18, place: 35, show: 50 },
  tier3: { win: 8, place: 18, show: 28 },
}

export interface ClassifiedHorse {
  horse: HorseEntry
  horseIndex: number
  score: HorseScore
  confidence: number
  odds: number
  oddsDisplay: string
  tier: BettingTier
  valueScore: number // How much overlay exists (legacy)
  /** Full overlay analysis */
  overlay: OverlayAnalysis
  /** Adjusted score considering overlay */
  adjustedScore: number
  /** Whether this is a special case (diamond in rough, fool's gold) */
  isSpecialCase: boolean
  /** Special case type if applicable */
  specialCaseType: 'diamond_in_rough' | 'fool_gold' | null
  /** Tier adjustment reasoning */
  tierAdjustmentReasoning: string
}

export interface TierGroup {
  tier: BettingTier
  name: string
  description: string
  horses: ClassifiedHorse[]
  expectedHitRate: { win: number; place: number; show: number }
}

/**
 * Calculate confidence percentage based on score
 * Max score is 240, so we scale to 100%
 */
function calculateConfidence(score: number): number {
  // Base confidence from score (0-240 maps to 40-100%)
  const baseConfidence = 40 + (score / 240) * 60
  return Math.min(100, Math.round(baseConfidence))
}

/**
 * Calculate value score - measures how much overlay exists
 * Higher value means better odds than the score suggests
 */
function calculateValueScore(score: number, odds: number): number {
  // Expected odds based on score (higher score = lower expected odds)
  const normalizedScore = score / 240
  const expectedOdds = (1 / normalizedScore) - 1

  // Value = actual odds vs expected odds
  // > 0 means overlay (good value)
  const value = ((odds - expectedOdds) / Math.max(expectedOdds, 0.5)) * 100

  return Math.round(value * 10) / 10
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
    return 'tier2'
  }

  // Special case: Fool's Gold - demote from Tier 1
  if (isSpecialCase && specialCaseType === 'fool_gold' && rawScore >= TIER_CONFIG.tier1.minScore) {
    return 'tier2'
  }

  // Use adjusted score for tier determination
  const scoreToUse = adjustedScore

  if (scoreToUse >= TIER_CONFIG.tier1.minScore && confidence >= TIER_CONFIG.tier1.minConfidence) {
    return 'tier1'
  }
  if (scoreToUse >= TIER_CONFIG.tier2.minScore && scoreToUse <= TIER_CONFIG.tier2.maxScore + 20) {
    return 'tier2'
  }
  if (scoreToUse >= TIER_CONFIG.tier3.minScore && scoreToUse <= TIER_CONFIG.tier3.maxScore + 20) {
    return 'tier3'
  }
  return null // Below threshold for betting
}

/**
 * Check if a horse has a specific overlay angle for Tier 3
 * Now uses the enhanced overlay analysis
 */
function hasOverlayAngle(overlayPercent: number): boolean {
  // For tier 3, we want horses where odds offer significant value
  // At least 25% overlay for tier 3 consideration
  return overlayPercent >= 25
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
  horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>,
): TierGroup[] {
  const classifiedHorses: ClassifiedHorse[] = []

  for (const { horse, index, score } of horses) {
    // Skip scratched horses
    if (score.isScratched) continue

    const odds = parseOdds(horse.morningLineOdds)
    const confidence = calculateConfidence(score.total)

    // Perform full overlay analysis
    const overlay = analyzeOverlay(score.total, horse.morningLineOdds)

    // Calculate tier adjustment based on overlay
    const tierAdjustment = calculateTierAdjustment(score.total, overlay.overlayPercent)

    // Determine tier using adjusted score and special case info
    const tier = determineTier(
      score.total,
      tierAdjustment.adjustedScore,
      confidence,
      tierAdjustment.isSpecialCase,
      tierAdjustment.specialCaseType
    )

    // For tier 3, also check for overlay angle (using new method)
    if (tier === 'tier3' && !hasOverlayAngle(overlay.overlayPercent)) {
      continue // Skip tier 3 horses without overlay angle
    }

    if (tier) {
      classifiedHorses.push({
        horse,
        horseIndex: index,
        score,
        confidence,
        odds,
        oddsDisplay: horse.morningLineOdds,
        tier,
        valueScore: calculateValueScore(score.total, odds),
        overlay,
        adjustedScore: tierAdjustment.adjustedScore,
        isSpecialCase: tierAdjustment.isSpecialCase,
        specialCaseType: tierAdjustment.specialCaseType,
        tierAdjustmentReasoning: tierAdjustment.reasoning,
      })
    }
  }

  // Group by tier with enhanced sorting
  const tier1Horses = classifiedHorses
    .filter(h => h.tier === 'tier1')
    .sort((a, b) => {
      // Sort by adjusted score, then by overlay for ties
      if (b.adjustedScore !== a.adjustedScore) return b.adjustedScore - a.adjustedScore
      return b.overlay.overlayPercent - a.overlay.overlayPercent
    })

  const tier2Horses = classifiedHorses
    .filter(h => h.tier === 'tier2')
    .sort((a, b) => {
      // Diamond in Rough horses first, then by overlay percentage
      if (a.isSpecialCase && a.specialCaseType === 'diamond_in_rough' && !b.isSpecialCase) return -1
      if (b.isSpecialCase && b.specialCaseType === 'diamond_in_rough' && !a.isSpecialCase) return 1
      // Then sort by overlay percentage (best value first)
      return b.overlay.overlayPercent - a.overlay.overlayPercent
    })

  const tier3Horses = classifiedHorses
    .filter(h => h.tier === 'tier3')
    .sort((a, b) => {
      // Sort by overlay percentage first (best value), then by odds
      if (b.overlay.overlayPercent !== a.overlay.overlayPercent) {
        return b.overlay.overlayPercent - a.overlay.overlayPercent
      }
      return b.odds - a.odds // Highest odds as tiebreaker
    })

  const tierGroups: TierGroup[] = []

  if (tier1Horses.length > 0) {
    tierGroups.push({
      tier: 'tier1',
      name: TIER_NAMES.tier1,
      description: TIER_DESCRIPTIONS.tier1,
      horses: tier1Horses,
      expectedHitRate: TIER_EXPECTED_HIT_RATE.tier1,
    })
  }

  if (tier2Horses.length > 0) {
    tierGroups.push({
      tier: 'tier2',
      name: TIER_NAMES.tier2,
      description: TIER_DESCRIPTIONS.tier2,
      horses: tier2Horses,
      expectedHitRate: TIER_EXPECTED_HIT_RATE.tier2,
    })
  }

  if (tier3Horses.length > 0) {
    tierGroups.push({
      tier: 'tier3',
      name: TIER_NAMES.tier3,
      description: TIER_DESCRIPTIONS.tier3,
      horses: tier3Horses,
      expectedHitRate: TIER_EXPECTED_HIT_RATE.tier3,
    })
  }

  return tierGroups
}

/**
 * Get all horses that qualify for betting recommendations
 */
export function getQualifyingHorses(
  horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>,
): ClassifiedHorse[] {
  const tierGroups = classifyHorses(horses)
  return tierGroups.flatMap(group => group.horses)
}

/**
 * Check if any horses qualify for betting recommendations
 */
export function hasQualifyingHorses(
  horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>,
): boolean {
  return classifyHorses(horses).some(group => group.horses.length > 0)
}
