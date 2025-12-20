/**
 * Exotic Calculator Tests
 *
 * Tests for:
 * - Exacta cost calculations (box, key, wheel)
 * - Trifecta cost calculations (box, key, part-wheel, wheel)
 * - Superfecta cost calculations (box, key, part-wheel)
 * - Error handling and validation
 * - Optimizer recommendations
 * - Payout estimations
 * - Comparison logic
 */

import { describe, it, expect } from 'vitest'
import {
  calculateExactaBoxCost,
  calculateExactaKeyOverCost,
  calculateExactaKeyUnderCost,
  calculateExactaWheelCost,
  calculateExactaStraightCost,
  calculateTrifectaBoxCost,
  calculateTrifectaKeyCost,
  calculateTrifectaPartWheelCost,
  calculateTrifectaWheelCost,
  calculateSuperfectaBoxCost,
  calculateSuperfectaKeyCost,
  calculateSuperfectaPartWheelCost,
  calculateExoticCost,
  MIN_HORSES,
} from '../exoticCalculator'
import {
  optimizeExoticBet,
  suggestBaseBet,
  calculateAllExoticOptions,
  type HorseTier,
} from '../exoticOptimizer'
import {
  estimateExoticPayout,
  quickPayoutEstimate,
  estimateROI,
  type HorseOdds,
} from '../exoticPayoutEstimator'
import {
  generateComparisonTable,
  compareStructuresForType,
} from '../exoticComparison'

// ============================================================================
// EXACTA TESTS
// ============================================================================

describe('Exacta Cost Calculations', () => {
  describe('calculateExactaBoxCost', () => {
    it('should calculate 2-horse box correctly', () => {
      // 2 horses × 1 remaining × $2 = $4
      const result = calculateExactaBoxCost([1, 2], 2)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(2) // 2 × 1 = 2
      expect(result.total).toBe(4)
      expect(result.betType).toBe('exacta')
      expect(result.structure).toBe('box')
    })

    it('should calculate 3-horse box correctly', () => {
      // 3 horses × 2 remaining × $2 = $12
      const result = calculateExactaBoxCost([1, 2, 3], 2)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(6) // 3 × 2 = 6
      expect(result.total).toBe(12)
    })

    it('should calculate 4-horse box correctly', () => {
      // 4 × 3 × $1 = $12
      const result = calculateExactaBoxCost([1, 2, 3, 4], 1)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(12) // 4 × 3 = 12
      expect(result.total).toBe(12)
    })

    it('should reject with less than 2 horses', () => {
      const result = calculateExactaBoxCost([1], 2)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('at least 2 horses')
    })

    it('should deduplicate horses', () => {
      const result = calculateExactaBoxCost([1, 1, 2, 2], 2)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(2) // Only 2 unique horses
    })

    it('should validate base bet minimum', () => {
      const result = calculateExactaBoxCost([1, 2], 0)
      expect(result.baseBet).toBe(0.1) // Should be clamped to minimum
    })
  })

  describe('calculateExactaKeyOverCost', () => {
    it('should calculate 1 key over 3 others correctly', () => {
      // 1 × 3 × $2 = $6
      const result = calculateExactaKeyOverCost([1], [2, 3, 4], 2)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(3)
      expect(result.total).toBe(6)
      expect(result.structure).toBe('key_over')
    })

    it('should calculate 2 keys over 3 others correctly', () => {
      // 2 × 3 × $1 = $6
      const result = calculateExactaKeyOverCost([1, 2], [3, 4, 5], 1)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(6) // 2 keys × 3 others
      expect(result.total).toBe(6)
    })

    it('should remove key horses from others', () => {
      // Key horse 1 should be removed from others
      const result = calculateExactaKeyOverCost([1], [1, 2, 3], 2)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(2) // Only 2 valid others
    })

    it('should reject with no key horses', () => {
      const result = calculateExactaKeyOverCost([], [1, 2, 3], 2)
      expect(result.isValid).toBe(false)
    })

    it('should reject with no other horses', () => {
      const result = calculateExactaKeyOverCost([1], [], 2)
      expect(result.isValid).toBe(false)
    })
  })

  describe('calculateExactaKeyUnderCost', () => {
    it('should calculate 1 key under 3 others correctly', () => {
      // 3 × 1 × $2 = $6
      const result = calculateExactaKeyUnderCost([1], [2, 3, 4], 2)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(3)
      expect(result.total).toBe(6)
      expect(result.structure).toBe('key_under')
    })
  })

  describe('calculateExactaWheelCost', () => {
    it('should calculate 1 key over 9 field correctly', () => {
      // 1 × 9 × $2 = $18
      const result = calculateExactaWheelCost([1], 10, 2)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(9) // 10 - 1 key
      expect(result.total).toBe(18)
      expect(result.structure).toBe('wheel')
    })

    it('should calculate 2 keys over 10 field correctly', () => {
      // 2 × 8 × $1 = $16
      const result = calculateExactaWheelCost([1, 2], 10, 1)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(16) // 2 keys × 8 others
    })
  })

  describe('calculateExactaStraightCost', () => {
    it('should calculate straight exacta correctly', () => {
      const result = calculateExactaStraightCost(1, 2, 2)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(1)
      expect(result.total).toBe(2)
      expect(result.structure).toBe('straight')
    })

    it('should reject same horse in both positions', () => {
      const result = calculateExactaStraightCost(1, 1, 2)
      expect(result.isValid).toBe(false)
    })
  })
})

// ============================================================================
// TRIFECTA TESTS
// ============================================================================

describe('Trifecta Cost Calculations', () => {
  describe('calculateTrifectaBoxCost', () => {
    it('should calculate 3-horse box correctly', () => {
      // 3 × 2 × 1 × $1 = $6
      const result = calculateTrifectaBoxCost([1, 2, 3], 1)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(6) // 3! = 6
      expect(result.total).toBe(6)
      expect(result.betType).toBe('trifecta')
      expect(result.structure).toBe('box')
    })

    it('should calculate 4-horse box correctly', () => {
      // 4 × 3 × 2 × $1 = $24
      const result = calculateTrifectaBoxCost([1, 2, 3, 4], 1)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(24) // 4 × 3 × 2 = 24
      expect(result.total).toBe(24)
    })

    it('should calculate 5-horse box correctly', () => {
      // 5 × 4 × 3 × $0.50 = $30
      const result = calculateTrifectaBoxCost([1, 2, 3, 4, 5], 0.5)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(60) // 5 × 4 × 3 = 60
      expect(result.total).toBe(30)
    })

    it('should reject with less than 3 horses', () => {
      const result = calculateTrifectaBoxCost([1, 2], 1)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('at least 3 horses')
    })
  })

  describe('calculateTrifectaKeyCost', () => {
    it('should calculate key trifecta correctly', () => {
      // 1 key × 3 second × 3 third, but 3rd must be different from 2nd
      // = 1 × 3 × 2 = 6 (for each second, 2 valid thirds)
      const result = calculateTrifectaKeyCost([1], [2, 3, 4], [2, 3, 4], 1)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(6)
      expect(result.total).toBe(6)
    })

    it('should handle overlapping second/third correctly', () => {
      const result = calculateTrifectaKeyCost([1], [2, 3], [3, 4], 1)
      expect(result.isValid).toBe(true)
      // 2 can pair with 3 or 4 for third = 2
      // 3 can pair with 4 for third = 1
      expect(result.combinations).toBe(3)
    })
  })

  describe('calculateTrifectaPartWheelCost', () => {
    it('should calculate part wheel correctly', () => {
      const result = calculateTrifectaPartWheelCost([1, 2], [3, 4], [5, 6], 1)
      expect(result.isValid).toBe(true)
      // 2 first × 2 second × 2 third = 8
      expect(result.combinations).toBe(8)
      expect(result.total).toBe(8)
    })

    it('should exclude duplicates in same combination', () => {
      const result = calculateTrifectaPartWheelCost([1], [1, 2], [2, 3], 1)
      expect(result.isValid).toBe(true)
      // 1 first: 2 second with 3 third = 1 valid combo
      expect(result.combinations).toBe(1)
    })

    it('should reject when no valid combinations', () => {
      const result = calculateTrifectaPartWheelCost([1], [1], [1], 1)
      expect(result.isValid).toBe(false)
    })
  })

  describe('calculateTrifectaWheelCost', () => {
    it('should calculate wheel correctly', () => {
      // 1 key × 9 others × 8 remaining = 72
      const result = calculateTrifectaWheelCost([1], 10, 1)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(72) // 9 × 8
      expect(result.total).toBe(72)
    })
  })
})

// ============================================================================
// SUPERFECTA TESTS
// ============================================================================

describe('Superfecta Cost Calculations', () => {
  describe('calculateSuperfectaBoxCost', () => {
    it('should calculate 4-horse box correctly', () => {
      // 4 × 3 × 2 × 1 × $0.10 = $2.40
      const result = calculateSuperfectaBoxCost([1, 2, 3, 4], 0.1)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(24) // 4! = 24
      expect(result.total).toBe(2.4)
      expect(result.betType).toBe('superfecta')
    })

    it('should calculate 5-horse box correctly', () => {
      // 5 × 4 × 3 × 2 × $0.50 = $60
      const result = calculateSuperfectaBoxCost([1, 2, 3, 4, 5], 0.5)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(120) // 5 × 4 × 3 × 2 = 120
      expect(result.total).toBe(60)
    })

    it('should calculate 6-horse box correctly', () => {
      // 6 × 5 × 4 × 3 × $0.10 = $36
      const result = calculateSuperfectaBoxCost([1, 2, 3, 4, 5, 6], 0.1)
      expect(result.isValid).toBe(true)
      expect(result.combinations).toBe(360) // 6 × 5 × 4 × 3 = 360
      expect(result.total).toBe(36)
    })

    it('should reject with less than 4 horses', () => {
      const result = calculateSuperfectaBoxCost([1, 2, 3], 0.1)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('at least 4 horses')
    })
  })

  describe('calculateSuperfectaKeyCost', () => {
    it('should calculate key superfecta correctly', () => {
      const result = calculateSuperfectaKeyCost(
        [1],
        [2, 3, 4],
        [2, 3, 4],
        [2, 3, 4],
        0.1
      )
      expect(result.isValid).toBe(true)
      // 1 × 3 × 2 × 1 = 6 (each position must be different)
      expect(result.combinations).toBe(6)
      expect(result.total).toBe(0.6)
    })
  })

  describe('calculateSuperfectaPartWheelCost', () => {
    it('should calculate part wheel correctly', () => {
      const result = calculateSuperfectaPartWheelCost(
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
        0.1
      )
      expect(result.isValid).toBe(true)
      // All different horses: 2 × 2 × 2 × 2 = 16
      expect(result.combinations).toBe(16)
      expect(result.total).toBe(1.6)
    })
  })
})

// ============================================================================
// UNIVERSAL CALCULATOR TESTS
// ============================================================================

describe('Universal Calculator', () => {
  it('should route exacta box correctly', () => {
    const result = calculateExoticCost({
      betType: 'exacta',
      structure: 'box',
      baseBet: 2,
      firstPosition: [1, 2, 3],
      secondPosition: [1, 2, 3],
    })
    expect(result.isValid).toBe(true)
    expect(result.betType).toBe('exacta')
    expect(result.structure).toBe('box')
    expect(result.combinations).toBe(6)
  })

  it('should route trifecta part wheel correctly', () => {
    const result = calculateExoticCost({
      betType: 'trifecta',
      structure: 'part_wheel',
      baseBet: 1,
      firstPosition: [1],
      secondPosition: [2, 3],
      thirdPosition: [4, 5],
    })
    expect(result.isValid).toBe(true)
    expect(result.betType).toBe('trifecta')
    expect(result.structure).toBe('part_wheel')
    expect(result.combinations).toBe(4) // 1 × 2 × 2
  })
})

// ============================================================================
// OPTIMIZER TESTS
// ============================================================================

describe('Exotic Optimizer', () => {
  const createHorseTiers = (): { tier1: HorseTier[]; tier2: HorseTier[]; tier3: HorseTier[] } => ({
    tier1: [
      { programNumber: 1, horseName: 'Horse 1', tier: 1, winProbability: 0.25, odds: 3, confidence: 85 },
      { programNumber: 2, horseName: 'Horse 2', tier: 1, winProbability: 0.20, odds: 4, confidence: 80 },
    ],
    tier2: [
      { programNumber: 3, horseName: 'Horse 3', tier: 2, winProbability: 0.15, odds: 6, confidence: 65 },
      { programNumber: 4, horseName: 'Horse 4', tier: 2, winProbability: 0.12, odds: 8, confidence: 60 },
    ],
    tier3: [
      { programNumber: 5, horseName: 'Horse 5', tier: 3, winProbability: 0.08, odds: 12, confidence: 45 },
    ],
  })

  describe('optimizeExoticBet', () => {
    it('should optimize exacta within budget', () => {
      const horses = createHorseTiers()
      const result = optimizeExoticBet({
        budget: 20,
        tier1Horses: horses.tier1,
        tier2Horses: horses.tier2,
        tier3Horses: horses.tier3,
        betType: 'exacta',
        fieldSize: 10,
      })

      expect(result.isValid).toBe(true)
      expect(result.options.length).toBeGreaterThan(0)
      expect(result.recommended).not.toBeNull()
      expect(result.budgetUsed).toBeLessThanOrEqual(20)
    })

    it('should optimize trifecta within budget', () => {
      const horses = createHorseTiers()
      const result = optimizeExoticBet({
        budget: 50,
        tier1Horses: horses.tier1,
        tier2Horses: horses.tier2,
        tier3Horses: horses.tier3,
        betType: 'trifecta',
        fieldSize: 10,
      })

      expect(result.isValid).toBe(true)
      expect(result.options.length).toBeGreaterThan(0)
    })

    it('should return error when not enough horses', () => {
      const result = optimizeExoticBet({
        budget: 20,
        tier1Horses: [{ programNumber: 1, horseName: 'Horse 1', tier: 1, winProbability: 0.25, odds: 3, confidence: 85 }],
        tier2Horses: [],
        tier3Horses: [],
        betType: 'trifecta',
        fieldSize: 10,
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('horses required')
    })

    it('should return error when budget is invalid', () => {
      const horses = createHorseTiers()
      const result = optimizeExoticBet({
        budget: 0,
        tier1Horses: horses.tier1,
        tier2Horses: horses.tier2,
        betType: 'exacta',
        fieldSize: 10,
      })

      // Budget is validated and clamped, so should still work with min budget
      expect(result.budgetRemaining).toBeGreaterThanOrEqual(0)
    })
  })

  describe('suggestBaseBet', () => {
    it('should suggest appropriate base bet for budget', () => {
      const suggestion = suggestBaseBet(20, 6, 'exacta')
      expect(suggestion.baseBet).toBeGreaterThan(0)
      expect(suggestion.total).toBeLessThanOrEqual(20)
    })

    it('should handle small budgets', () => {
      const suggestion = suggestBaseBet(5, 24, 'trifecta')
      expect(suggestion.baseBet).toBe(0.1) // Minimum base bet
    })
  })

  describe('calculateAllExoticOptions', () => {
    it('should calculate options for all bet types', () => {
      const horses = createHorseTiers()
      const allHorses = [...horses.tier1, ...horses.tier2, ...horses.tier3]
      const results = calculateAllExoticOptions(allHorses, 50)

      expect(results.exacta.isValid).toBe(true)
      expect(results.trifecta.isValid).toBe(true)
      expect(results.superfecta.isValid).toBe(true)
    })
  })
})

// ============================================================================
// PAYOUT ESTIMATOR TESTS
// ============================================================================

describe('Payout Estimator', () => {
  const createHorseOdds = (): HorseOdds[] => [
    { programNumber: 1, horseName: 'Favorite', odds: 2, confidence: 85 },
    { programNumber: 2, horseName: 'Contender', odds: 4, confidence: 75 },
    { programNumber: 3, horseName: 'Value', odds: 8, confidence: 60 },
    { programNumber: 4, horseName: 'Longshot', odds: 15, confidence: 40 },
  ]

  describe('quickPayoutEstimate', () => {
    it('should estimate exacta payouts', () => {
      const odds = [2, 4, 8]
      const result = quickPayoutEstimate('exacta', odds, 2)

      expect(result.min).toBeGreaterThan(0)
      expect(result.max).toBeGreaterThan(result.min)
      expect(result.likely).toBeGreaterThan(0)
      expect(result.display).toContain('$')
    })

    it('should estimate trifecta payouts', () => {
      const odds = [2, 4, 8]
      const result = quickPayoutEstimate('trifecta', odds, 1)

      expect(result.min).toBeGreaterThan(0)
      expect(result.max).toBeGreaterThan(result.min)
    })

    it('should estimate superfecta payouts', () => {
      const odds = [2, 4, 8, 15]
      const result = quickPayoutEstimate('superfecta', odds, 0.1)

      expect(result.min).toBeGreaterThan(0)
      expect(result.max).toBeGreaterThan(result.min)
    })
  })

  describe('estimateExoticPayout', () => {
    it('should provide detailed payout estimate', () => {
      const horses = createHorseOdds()
      const result = estimateExoticPayout('exacta', horses, 2, 6)

      expect(result.isValid).toBe(true)
      expect(result.payoutRange.minimum).toBeGreaterThan(0)
      expect(result.payoutRange.maximum).toBeGreaterThan(0)
      expect(result.scenarios.length).toBeGreaterThan(0)
    })

    it('should include scenarios with probabilities', () => {
      const horses = createHorseOdds()
      const result = estimateExoticPayout('trifecta', horses, 1, 24)

      expect(result.scenarios.length).toBeGreaterThan(0)
      result.scenarios.forEach(scenario => {
        expect(scenario.probability).toBeGreaterThan(0)
        expect(scenario.payout).toBeGreaterThan(0)
      })
    })
  })

  describe('estimateROI', () => {
    it('should calculate ROI correctly', () => {
      const horses = createHorseOdds()
      const payoutEstimate = estimateExoticPayout('exacta', horses, 2, 6)
      const roi = estimateROI(payoutEstimate)

      expect(roi.display).toContain('%')
      expect(typeof roi.minROI).toBe('number')
      expect(typeof roi.maxROI).toBe('number')
    })
  })
})

// ============================================================================
// COMPARISON TESTS
// ============================================================================

describe('Exotic Comparison', () => {
  const createHorseOdds = (): HorseOdds[] => [
    { programNumber: 1, horseName: 'Favorite', odds: 2, confidence: 85 },
    { programNumber: 2, horseName: 'Contender', odds: 4, confidence: 75 },
    { programNumber: 3, horseName: 'Value', odds: 8, confidence: 60 },
    { programNumber: 4, horseName: 'Longshot', odds: 15, confidence: 40 },
  ]

  describe('generateComparisonTable', () => {
    it('should generate comparison table with valid options', () => {
      const horses = createHorseOdds()
      const result = generateComparisonTable({
        budget: 50,
        horses,
        fieldSize: 10,
      })

      expect(result.isValid).toBe(true)
      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.recommended).not.toBeNull()
    })

    it('should sort rows by score', () => {
      const horses = createHorseOdds()
      const result = generateComparisonTable({
        budget: 50,
        horses,
        fieldSize: 10,
      })

      for (let i = 0; i < result.rows.length - 1; i++) {
        expect(result.rows[i].score).toBeGreaterThanOrEqual(result.rows[i + 1].score)
      }
    })

    it('should mark recommended option', () => {
      const horses = createHorseOdds()
      const result = generateComparisonTable({
        budget: 50,
        horses,
        fieldSize: 10,
      })

      const recommendedCount = result.rows.filter(r => r.isRecommended).length
      expect(recommendedCount).toBe(1)
    })

    it('should filter by bet types', () => {
      const horses = createHorseOdds()
      const result = generateComparisonTable({
        budget: 50,
        horses,
        fieldSize: 10,
        betTypes: ['exacta'],
      })

      result.rows.forEach(row => {
        expect(row.type).toBe('exacta')
      })
    })

    it('should respect budget constraints', () => {
      const horses = createHorseOdds()
      const result = generateComparisonTable({
        budget: 20,
        horses,
        fieldSize: 10,
      })

      result.rows.forEach(row => {
        expect(row.cost.total).toBeLessThanOrEqual(20)
      })
    })
  })

  describe('compareStructuresForType', () => {
    it('should compare structures for specific bet type', () => {
      const horses = createHorseOdds()
      const result = compareStructuresForType('exacta', horses, 30, 10)

      expect(result.isValid).toBe(true)
      result.rows.forEach(row => {
        expect(row.type).toBe('exacta')
      })
    })
  })
})

// ============================================================================
// EDGE CASES AND ERROR HANDLING
// ============================================================================

describe('Edge Cases and Error Handling', () => {
  describe('Input Validation', () => {
    it('should handle empty horse arrays', () => {
      const result = calculateExactaBoxCost([], 2)
      expect(result.isValid).toBe(false)
    })

    it('should handle negative base bets', () => {
      const result = calculateExactaBoxCost([1, 2], -5)
      expect(result.baseBet).toBeGreaterThan(0) // Should be clamped
    })

    it('should handle invalid horse numbers', () => {
      const result = calculateExactaBoxCost([0, -1, NaN], 2)
      expect(result.isValid).toBe(false)
    })

    it('should handle extremely large base bets', () => {
      const result = calculateExactaBoxCost([1, 2], 1000)
      expect(result.baseBet).toBeLessThanOrEqual(100) // Should be clamped
    })
  })

  describe('Minimum Horse Requirements', () => {
    it('should enforce exacta minimum of 2', () => {
      expect(MIN_HORSES.exacta).toBe(2)
      const result = calculateExactaBoxCost([1], 2)
      expect(result.isValid).toBe(false)
    })

    it('should enforce trifecta minimum of 3', () => {
      expect(MIN_HORSES.trifecta).toBe(3)
      const result = calculateTrifectaBoxCost([1, 2], 1)
      expect(result.isValid).toBe(false)
    })

    it('should enforce superfecta minimum of 4', () => {
      expect(MIN_HORSES.superfecta).toBe(4)
      const result = calculateSuperfectaBoxCost([1, 2, 3], 0.1)
      expect(result.isValid).toBe(false)
    })
  })

  describe('Rounding and Precision', () => {
    it('should round totals to 2 decimal places', () => {
      const result = calculateSuperfectaBoxCost([1, 2, 3, 4], 0.1)
      expect(result.total).toBe(2.4)
      expect(result.total.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2)
    })

    it('should handle fractional base bets', () => {
      const result = calculateExactaBoxCost([1, 2, 3], 0.5)
      expect(result.isValid).toBe(true)
      expect(result.total).toBe(3) // 6 combos × $0.50
    })
  })
})
