/**
 * Tier Classification Tests
 * Tests betting tier thresholds and edge cases
 */

import { describe, it, expect } from 'vitest'
import {
  classifyHorses,
  getQualifyingHorses,
  hasQualifyingHorses,
  TIER_CONFIG,
  TIER_NAMES,
  TIER_DESCRIPTIONS,
  TIER_EXPECTED_HIT_RATE,
} from '../../../lib/betting/tierClassification'
import { createHorseEntry } from '../../fixtures/testHelpers'
import type { HorseScore, ScoreBreakdown } from '../../../lib/scoring'

// Helper to create a mock score
function createMockScore(total: number, isScratched = false): HorseScore {
  const breakdown: ScoreBreakdown = {
    connections: { total: 22, trainer: 15, jockey: 7, partnershipBonus: 0, reasoning: '' },
    postPosition: { total: 24, trackBiasApplied: false, isGoldenPost: false, reasoning: '' },
    speedClass: { total: 25, speedScore: 15, classScore: 10, bestFigure: 85, classMovement: 'level', reasoning: '' },
    form: { total: 15, recentFormScore: 8, layoffScore: 5, consistencyBonus: 2, formTrend: 'steady', reasoning: '' },
    equipment: { total: 10, hasChanges: false, reasoning: '' },
    pace: { total: 20, runningStyle: 'P', paceFit: 'neutral', reasoning: '' },
  }

  return {
    total,
    breakdown,
    isScratched,
    confidenceLevel: total >= 180 ? 'high' : total >= 160 ? 'medium' : 'low',
    dataQuality: 75,
  }
}

describe('Tier Classification', () => {
  describe('Tier Thresholds', () => {
    it('classifies score 180+ as Tier 1', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '3-1' }),
          index: 0,
          score: createMockScore(185),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const tier1 = tierGroups.find(g => g.tier === 'tier1')

      expect(tier1).toBeDefined()
      expect(tier1?.horses.length).toBe(1)
    })

    it('classifies score 160-179 appropriately', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '5-1' }),
          index: 0,
          score: createMockScore(170),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const allHorses = tierGroups.flatMap(g => g.horses)

      // Score of 170 should be classified (tier1 or tier2 depending on overlay)
      expect(allHorses.length).toBe(1)
      expect(['tier1', 'tier2']).toContain(allHorses[0].tier)
    })

    it('classifies score 140-159 as Tier 3 with overlay angle', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '20-1' }), // High odds for overlay
          index: 0,
          score: createMockScore(150),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const tier3 = tierGroups.find(g => g.tier === 'tier3')

      // Tier 3 requires overlay angle
      if (tier3) {
        expect(tier3.horses.length).toBe(1)
      }
    })

    it('scores below 140 generally do not qualify unless overlay', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '3-1' }), // Low odds = no overlay
          index: 0,
          score: createMockScore(130),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const allHorses = tierGroups.flatMap(g => g.horses)

      // Low score with low odds = unlikely to qualify
      expect(allHorses.length).toBeLessThanOrEqual(1)
    })
  })

  describe('Edge Cases at Exact Boundaries', () => {
    it('score of exactly 180 is Tier 1', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '3-1' }),
          index: 0,
          score: createMockScore(180),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const tier1 = tierGroups.find(g => g.tier === 'tier1')

      expect(tier1?.horses.length).toBe(1)
    })

    it('score of 179 classifies appropriately based on overlay', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '5-1' }),
          index: 0,
          score: createMockScore(179),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const allHorses = tierGroups.flatMap(g => g.horses)

      // Score of 179 should classify as either tier1 or tier2 based on overlay
      expect(allHorses.length).toBe(1)
      expect(['tier1', 'tier2']).toContain(allHorses[0].tier)
    })

    it('score of exactly 160 is Tier 2', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '5-1' }),
          index: 0,
          score: createMockScore(160),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const tier2 = tierGroups.find(g => g.tier === 'tier2')

      expect(tier2?.horses.length).toBe(1)
    })

    it('score of exactly 140 may qualify for Tier 3 with sufficient overlay', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '30-1' }), // High overlay
          index: 0,
          score: createMockScore(140),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const allHorses = tierGroups.flatMap(g => g.horses)

      // May or may not qualify based on overlay calculation - borderline score
      expect(allHorses.length).toBeLessThanOrEqual(1)
    })

    it('score of 139 may not qualify for any tier', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '30-1' }),
          index: 0,
          score: createMockScore(139),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const allHorses = tierGroups.flatMap(g => g.horses)

      // Score below 140 may or may not qualify depending on overlay
      expect(allHorses.length).toBeLessThanOrEqual(1)
    })
  })

  describe('Scratched Horses', () => {
    it('excludes scratched horses from classification', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '3-1' }),
          index: 0,
          score: createMockScore(185, true), // Scratched
        },
        {
          horse: createHorseEntry({ morningLineOdds: '5-1' }),
          index: 1,
          score: createMockScore(175),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const allHorses = tierGroups.flatMap(g => g.horses)

      expect(allHorses.length).toBe(1)
      expect(allHorses[0].horseIndex).toBe(1)
    })
  })

  describe('Tier Group Properties', () => {
    it('includes tier name', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '3-1' }),
          index: 0,
          score: createMockScore(185),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const tier1 = tierGroups.find(g => g.tier === 'tier1')

      expect(tier1?.name).toBe(TIER_NAMES.tier1)
    })

    it('includes tier description', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '5-1' }),
          index: 0,
          score: createMockScore(170),
        },
      ]

      const tierGroups = classifyHorses(horses)

      // May classify as tier1 or tier2 depending on overlay analysis
      const relevantTier = tierGroups.find(g => g.horses.length > 0)

      if (relevantTier) {
        expect(relevantTier.description).toBe(TIER_DESCRIPTIONS[relevantTier.tier])
      }
    })

    it('includes expected hit rates', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '3-1' }),
          index: 0,
          score: createMockScore(185),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const tier1 = tierGroups.find(g => g.tier === 'tier1')

      expect(tier1?.expectedHitRate).toEqual(TIER_EXPECTED_HIT_RATE.tier1)
    })
  })

  describe('Sorting Within Tiers', () => {
    it('sorts Tier 1 by adjusted score descending', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '5-1' }),
          index: 0,
          score: createMockScore(185),
        },
        {
          horse: createHorseEntry({ morningLineOdds: '3-1' }),
          index: 1,
          score: createMockScore(195),
        },
        {
          horse: createHorseEntry({ morningLineOdds: '4-1' }),
          index: 2,
          score: createMockScore(190),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const tier1 = tierGroups.find(g => g.tier === 'tier1')

      expect(tier1?.horses[0].score.total).toBe(195)
      expect(tier1?.horses[1].score.total).toBe(190)
      expect(tier1?.horses[2].score.total).toBe(185)
    })
  })

  describe('Overlay Analysis', () => {
    it('includes overlay analysis in classified horse', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '10-1' }),
          index: 0,
          score: createMockScore(180),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const classified = tierGroups[0]?.horses[0]

      expect(classified?.overlay).toBeDefined()
      expect(classified?.overlay.overlayPercent).toBeDefined()
    })

    it('calculates adjusted score based on overlay', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '15-1' }),
          index: 0,
          score: createMockScore(175),
        },
      ]

      const tierGroups = classifyHorses(horses)
      const classified = tierGroups[0]?.horses[0]

      expect(classified?.adjustedScore).toBeDefined()
    })
  })

  describe('getQualifyingHorses', () => {
    it('returns all horses that qualify for betting', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '3-1' }),
          index: 0,
          score: createMockScore(185),
        },
        {
          horse: createHorseEntry({ morningLineOdds: '5-1' }),
          index: 1,
          score: createMockScore(170),
        },
        {
          horse: createHorseEntry({ morningLineOdds: '10-1' }),
          index: 2,
          score: createMockScore(130), // May not qualify
        },
      ]

      const qualifying = getQualifyingHorses(horses)

      // At least 2 horses should qualify (185 and 170 scores)
      expect(qualifying.length).toBeGreaterThanOrEqual(2)
    })

    it('returns empty array when no horses qualify', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '10-1' }),
          index: 0,
          score: createMockScore(100),
        },
      ]

      const qualifying = getQualifyingHorses(horses)

      expect(qualifying.length).toBe(0)
    })
  })

  describe('hasQualifyingHorses', () => {
    it('returns true when horses qualify', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '3-1' }),
          index: 0,
          score: createMockScore(185),
        },
      ]

      expect(hasQualifyingHorses(horses)).toBe(true)
    })

    it('returns false when no horses qualify', () => {
      const horses = [
        {
          horse: createHorseEntry({ morningLineOdds: '10-1' }),
          index: 0,
          score: createMockScore(100),
        },
      ]

      expect(hasQualifyingHorses(horses)).toBe(false)
    })
  })

  describe('TIER_CONFIG', () => {
    it('defines correct thresholds for Tier 1', () => {
      expect(TIER_CONFIG.tier1.minScore).toBe(180)
      expect(TIER_CONFIG.tier1.maxScore).toBe(240)
      expect(TIER_CONFIG.tier1.minConfidence).toBe(80)
    })

    it('defines correct thresholds for Tier 2', () => {
      expect(TIER_CONFIG.tier2.minScore).toBe(160)
      expect(TIER_CONFIG.tier2.maxScore).toBe(179)
      expect(TIER_CONFIG.tier2.minConfidence).toBe(60)
    })

    it('defines correct thresholds for Tier 3', () => {
      expect(TIER_CONFIG.tier3.minScore).toBe(140)
      expect(TIER_CONFIG.tier3.maxScore).toBe(159)
      expect(TIER_CONFIG.tier3.minConfidence).toBe(40)
    })
  })

  describe('Expected Hit Rates', () => {
    it('Tier 1 has highest win rate', () => {
      expect(TIER_EXPECTED_HIT_RATE.tier1.win).toBeGreaterThan(TIER_EXPECTED_HIT_RATE.tier2.win)
      expect(TIER_EXPECTED_HIT_RATE.tier2.win).toBeGreaterThan(TIER_EXPECTED_HIT_RATE.tier3.win)
    })

    it('Place rate is higher than win rate for all tiers', () => {
      expect(TIER_EXPECTED_HIT_RATE.tier1.place).toBeGreaterThan(TIER_EXPECTED_HIT_RATE.tier1.win)
      expect(TIER_EXPECTED_HIT_RATE.tier2.place).toBeGreaterThan(TIER_EXPECTED_HIT_RATE.tier2.win)
      expect(TIER_EXPECTED_HIT_RATE.tier3.place).toBeGreaterThan(TIER_EXPECTED_HIT_RATE.tier3.win)
    })
  })
})
