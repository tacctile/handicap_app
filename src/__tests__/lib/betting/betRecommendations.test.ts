/**
 * Bet Recommendations Tests
 * Tests bet sizing calculations and recommendation generation
 */

import { describe, it, expect } from 'vitest'
import {
  generateBetRecommendations,
  calculateBetSize,
  formatCurrency,
} from '../../../lib/betting/betRecommendations'
import type { TierGroup, ClassifiedHorse } from '../../../lib/betting/tierClassification'
import { createHorseEntry } from '../../fixtures/testHelpers'

// Helper to create a mock classified horse
function createClassifiedHorse(
  overrides: Partial<ClassifiedHorse> = {}
): ClassifiedHorse {
  const horse = createHorseEntry({
    programNumber: 1,
    horseName: 'Test Horse',
    morningLineOdds: '5-1',
    ...overrides.horse,
  })

  return {
    horse,
    horseIndex: 0,
    score: {
      total: 180,
      breakdown: {
        connections: { total: 22, trainer: 15, jockey: 7, partnershipBonus: 0, reasoning: '' },
        postPosition: { total: 24, trackBiasApplied: false, isGoldenPost: false, reasoning: '' },
        speedClass: { total: 25, speedScore: 15, classScore: 10, bestFigure: 85, classMovement: 'level', reasoning: '' },
        form: { total: 15, recentFormScore: 8, layoffScore: 5, consistencyBonus: 2, formTrend: 'steady', reasoning: '' },
        equipment: { total: 10, hasChanges: false, reasoning: '' },
        pace: { total: 20, runningStyle: 'P', paceFit: 'neutral', reasoning: '' },
      },
      isScratched: false,
      confidenceLevel: 'high',
      dataQuality: 75,
    },
    confidence: 85,
    odds: 5,
    oddsDisplay: '5-1',
    tier: 'tier1',
    valueScore: 15,
    overlay: {
      overlayPercent: 10,
      isOverlay: true,
      expectedWinPercent: 15,
      impliedWinPercent: 16.7,
      fairOdds: '5-1',
      recommendation: 'fair_value',
      reasoning: 'Fair value bet',
    },
    adjustedScore: 180,
    isSpecialCase: false,
    specialCaseType: null,
    tierAdjustmentReasoning: 'Strong play',
    ...overrides,
  }
}

// Helper to create a tier group
function createTierGroup(
  tier: 'tier1' | 'tier2' | 'tier3',
  horses: ClassifiedHorse[]
): TierGroup {
  const tierNames = {
    tier1: 'Cover Chalk',
    tier2: 'Logical Alternatives',
    tier3: 'Value Bombs',
  }

  const tierDescriptions = {
    tier1: 'Top contenders with strong fundamentals',
    tier2: 'Solid value plays with good win/place potential',
    tier3: 'Overlay opportunities. High risk, high reward',
  }

  const expectedHitRates = {
    tier1: { win: 35, place: 55, show: 70 },
    tier2: { win: 18, place: 35, show: 50 },
    tier3: { win: 8, place: 18, show: 28 },
  }

  return {
    tier,
    name: tierNames[tier],
    description: tierDescriptions[tier],
    horses,
    expectedHitRate: expectedHitRates[tier],
  }
}

describe('Bet Recommendations', () => {
  describe('generateBetRecommendations', () => {
    it('generates recommendations for Tier 1 horses', () => {
      const horse1 = createClassifiedHorse({
        tier: 'tier1',
        horseIndex: 0,
        horse: createHorseEntry({ programNumber: 1, horseName: 'Favorite' }),
        confidence: 85,
      })
      const horse2 = createClassifiedHorse({
        tier: 'tier1',
        horseIndex: 1,
        horse: createHorseEntry({ programNumber: 2, horseName: 'Second Choice' }),
        confidence: 80,
      })

      const tierGroups = [createTierGroup('tier1', [horse1, horse2])]
      const recommendations = generateBetRecommendations(tierGroups)

      expect(recommendations.length).toBe(1)
      expect(recommendations[0].tier).toBe('tier1')
      expect(recommendations[0].bets.length).toBeGreaterThan(0)
    })

    it('generates recommendations for Tier 2 horses', () => {
      const tier1Horse = createClassifiedHorse({
        tier: 'tier1',
        horseIndex: 0,
        horse: createHorseEntry({ programNumber: 1 }),
      })
      const tier2Horse = createClassifiedHorse({
        tier: 'tier2',
        horseIndex: 1,
        horse: createHorseEntry({ programNumber: 2 }),
        confidence: 70,
        score: { ...createClassifiedHorse().score, total: 170 },
      })

      const tierGroups = [
        createTierGroup('tier1', [tier1Horse]),
        createTierGroup('tier2', [tier2Horse]),
      ]
      const recommendations = generateBetRecommendations(tierGroups)

      const tier2Recs = recommendations.find(r => r.tier === 'tier2')
      expect(tier2Recs).toBeDefined()
      expect(tier2Recs?.bets.length).toBeGreaterThan(0)
    })

    it('generates recommendations for Tier 3 horses', () => {
      const tier3Horse = createClassifiedHorse({
        tier: 'tier3',
        horseIndex: 0,
        horse: createHorseEntry({ programNumber: 5, morningLineOdds: '20-1' }),
        confidence: 55,
        odds: 20,
        oddsDisplay: '20-1',
        score: { ...createClassifiedHorse().score, total: 150 },
      })

      const tierGroups = [createTierGroup('tier3', [tier3Horse])]
      const recommendations = generateBetRecommendations(tierGroups)

      expect(recommendations.length).toBe(1)
      expect(recommendations[0].tier).toBe('tier3')
      expect(recommendations[0].bets.length).toBeGreaterThan(0)
    })

    it('includes win bet in all tier recommendations', () => {
      const horse = createClassifiedHorse()
      const tierGroups = [createTierGroup('tier1', [horse])]
      const recommendations = generateBetRecommendations(tierGroups)

      const winBet = recommendations[0].bets.find(b => b.type === 'win')
      expect(winBet).toBeDefined()
      expect(winBet?.amount).toBeGreaterThan(0)
    })

    it('includes exotic bets for multiple horses', () => {
      const horses = [
        createClassifiedHorse({
          horseIndex: 0,
          horse: createHorseEntry({ programNumber: 1 }),
        }),
        createClassifiedHorse({
          horseIndex: 1,
          horse: createHorseEntry({ programNumber: 2 }),
        }),
        createClassifiedHorse({
          horseIndex: 2,
          horse: createHorseEntry({ programNumber: 3 }),
        }),
      ]

      const tierGroups = [createTierGroup('tier1', horses)]
      const recommendations = generateBetRecommendations(tierGroups)

      const exactaBet = recommendations[0].bets.find(b => b.type === 'exacta_box')
      expect(exactaBet).toBeDefined()
    })

    it('calculates total investment correctly', () => {
      const horse = createClassifiedHorse()
      const tierGroups = [createTierGroup('tier1', [horse])]
      const recommendations = generateBetRecommendations(tierGroups)

      const totalCost = recommendations[0].bets.reduce((sum, bet) => sum + bet.totalCost, 0)
      expect(recommendations[0].totalInvestment).toBe(Math.round(totalCost * 100) / 100)
    })

    it('calculates potential return range', () => {
      const horse = createClassifiedHorse()
      const tierGroups = [createTierGroup('tier1', [horse])]
      const recommendations = generateBetRecommendations(tierGroups)

      expect(recommendations[0].potentialReturnRange).toBeDefined()
      expect(recommendations[0].potentialReturnRange.min).toBeGreaterThanOrEqual(0)
      expect(recommendations[0].potentialReturnRange.max).toBeGreaterThanOrEqual(
        recommendations[0].potentialReturnRange.min
      )
    })

    it('returns empty array for empty tier groups', () => {
      const recommendations = generateBetRecommendations([])

      expect(recommendations).toEqual([])
    })

    it('handles tier group with no horses', () => {
      const tierGroups = [createTierGroup('tier1', [])]
      const recommendations = generateBetRecommendations(tierGroups)

      expect(recommendations[0].bets).toHaveLength(0)
      expect(recommendations[0].totalInvestment).toBe(0)
    })
  })

  describe('Bet Sizing', () => {
    it('includes correct amount in bet recommendations', () => {
      const horse = createClassifiedHorse()
      const tierGroups = [createTierGroup('tier1', [horse])]
      const recommendations = generateBetRecommendations(tierGroups)

      recommendations[0].bets.forEach(bet => {
        expect(bet.amount).toBeGreaterThan(0)
        expect(bet.totalCost).toBeGreaterThan(0)
      })
    })

    it('Tier 1 has higher base amounts than Tier 3', () => {
      const tier1Horse = createClassifiedHorse({
        tier: 'tier1',
        confidence: 85,
      })
      const tier3Horse = createClassifiedHorse({
        tier: 'tier3',
        confidence: 55,
        odds: 20,
        score: { ...createClassifiedHorse().score, total: 150 },
      })

      const tier1Recs = generateBetRecommendations([createTierGroup('tier1', [tier1Horse])])
      const tier3Recs = generateBetRecommendations([createTierGroup('tier3', [tier3Horse])])

      const tier1WinBet = tier1Recs[0].bets.find(b => b.type === 'win')
      const tier3WinBet = tier3Recs[0].bets.find(b => b.type === 'win')

      expect(tier1WinBet?.amount).toBeGreaterThan(tier3WinBet?.amount ?? 0)
    })
  })

  describe('calculateBetSize', () => {
    it('returns higher bet size for higher confidence', () => {
      const lowConfidence = calculateBetSize(60)
      const highConfidence = calculateBetSize(100)

      expect(highConfidence).toBeGreaterThan(lowConfidence)
    })

    it('returns minimum 1 unit for low confidence', () => {
      const result = calculateBetSize(60, 10, 5)

      expect(result).toBeGreaterThanOrEqual(10)
    })

    it('returns maximum units for 100% confidence', () => {
      const result = calculateBetSize(100, 10, 5)

      expect(result).toBe(50) // 5 units * $10 base
    })

    it('uses custom base unit', () => {
      const result = calculateBetSize(80, 25, 3)

      expect(result).toBeGreaterThanOrEqual(25)
      expect(result).toBeLessThanOrEqual(75)
    })

    it('handles confidence below 60%', () => {
      const result = calculateBetSize(50, 10, 5)

      // Should return minimum
      expect(result).toBe(10)
    })
  })

  describe('Window Instructions', () => {
    it('generates correct win bet instruction', () => {
      const horse = createClassifiedHorse({
        horse: createHorseEntry({ programNumber: 5 }),
      })
      const tierGroups = [createTierGroup('tier1', [horse])]
      const recommendations = generateBetRecommendations(tierGroups)

      const winBet = recommendations[0].bets.find(b => b.type === 'win')
      expect(winBet?.windowInstruction).toContain('WIN')
      expect(winBet?.windowInstruction).toContain('5')
    })

    it('generates correct exacta box instruction', () => {
      const horses = [
        createClassifiedHorse({
          horseIndex: 0,
          horse: createHorseEntry({ programNumber: 1 }),
        }),
        createClassifiedHorse({
          horseIndex: 1,
          horse: createHorseEntry({ programNumber: 3 }),
        }),
      ]

      const tierGroups = [createTierGroup('tier1', horses)]
      const recommendations = generateBetRecommendations(tierGroups)

      const exactaBet = recommendations[0].bets.find(b => b.type === 'exacta_box')
      expect(exactaBet?.windowInstruction).toContain('EXACTA BOX')
    })

    it('includes dollar amount in instruction', () => {
      const horse = createClassifiedHorse()
      const tierGroups = [createTierGroup('tier1', [horse])]
      const recommendations = generateBetRecommendations(tierGroups)

      const winBet = recommendations[0].bets.find(b => b.type === 'win')
      expect(winBet?.windowInstruction).toMatch(/\$\d+/)
    })
  })

  describe('Potential Returns', () => {
    it('calculates higher returns for higher odds', () => {
      const lowOddsHorse = createClassifiedHorse({
        odds: 2,
        oddsDisplay: '2-1',
      })
      const highOddsHorse = createClassifiedHorse({
        odds: 20,
        oddsDisplay: '20-1',
      })

      const lowOddsRecs = generateBetRecommendations([createTierGroup('tier1', [lowOddsHorse])])
      const highOddsRecs = generateBetRecommendations([createTierGroup('tier3', [highOddsHorse])])

      const lowWin = lowOddsRecs[0].bets.find(b => b.type === 'win')
      const highWin = highOddsRecs[0].bets.find(b => b.type === 'win')

      // Per dollar, high odds should return more
      const lowReturnPerDollar = (lowWin?.potentialReturn.max ?? 0) / (lowWin?.totalCost ?? 1)
      const highReturnPerDollar = (highWin?.potentialReturn.max ?? 0) / (highWin?.totalCost ?? 1)

      expect(highReturnPerDollar).toBeGreaterThan(lowReturnPerDollar)
    })

    it('returns zero for empty horses array', () => {
      const tierGroups = [createTierGroup('tier1', [])]
      const recommendations = generateBetRecommendations(tierGroups)

      expect(recommendations[0].potentialReturnRange.min).toBe(0)
      expect(recommendations[0].potentialReturnRange.max).toBe(0)
    })
  })

  describe('formatCurrency', () => {
    it('formats whole dollars without cents', () => {
      expect(formatCurrency(10)).toBe('$10')
      expect(formatCurrency(100)).toBe('$100')
    })

    it('formats cents with two decimal places', () => {
      expect(formatCurrency(0.10)).toBe('$0.10')
      expect(formatCurrency(0.50)).toBe('$0.50')
    })

    it('formats large amounts with commas', () => {
      expect(formatCurrency(1000)).toBe('$1,000')
      expect(formatCurrency(10000)).toBe('$10,000')
    })
  })

  describe('Bet Types', () => {
    it('generates win bets', () => {
      const horse = createClassifiedHorse()
      const recs = generateBetRecommendations([createTierGroup('tier1', [horse])])
      const winBet = recs[0].bets.find(b => b.type === 'win')

      expect(winBet).toBeDefined()
      expect(winBet?.typeName).toBe('Win')
    })

    it('generates place bets', () => {
      const horse = createClassifiedHorse()
      const recs = generateBetRecommendations([createTierGroup('tier1', [horse])])
      const placeBet = recs[0].bets.find(b => b.type === 'place')

      expect(placeBet).toBeDefined()
      expect(placeBet?.typeName).toBe('Place')
    })

    it('generates trifecta bets for 3+ horses', () => {
      const horses = [
        createClassifiedHorse({ horseIndex: 0, horse: createHorseEntry({ programNumber: 1 }) }),
        createClassifiedHorse({ horseIndex: 1, horse: createHorseEntry({ programNumber: 2 }) }),
        createClassifiedHorse({ horseIndex: 2, horse: createHorseEntry({ programNumber: 3 }) }),
      ]
      const recs = generateBetRecommendations([createTierGroup('tier1', horses)])
      const triBet = recs[0].bets.find(b => b.type === 'trifecta_box')

      expect(triBet).toBeDefined()
    })
  })

  describe('All Scratched Scenario', () => {
    it('handles all horses scratched gracefully', () => {
      // Empty tier group simulates all scratched
      const tierGroups: TierGroup[] = []
      const recommendations = generateBetRecommendations(tierGroups)

      expect(recommendations).toEqual([])
    })
  })
})
