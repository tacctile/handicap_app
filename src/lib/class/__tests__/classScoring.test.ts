/**
 * Class Scoring Tests
 *
 * Tests for class-based scoring including class drops/rises,
 * proven at level bonuses, and hidden class drop detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateClassScore,
  getClassScoreColor,
  getClassScoreTier,
  formatClassMovement,
  getHiddenDropsSummary,
  hasSignificantHiddenValue,
  isValuePlay,
  MAX_CLASS_SCORE,
} from '../classScoring'
import { ClassLevel, CLASS_LEVEL_METADATA } from '../classTypes'
import {
  createHorseEntry,
  createRaceHeader,
  createPastPerformance,
} from '../../../__tests__/fixtures/testHelpers'

// Mock the class extractor
vi.mock('../classExtractor', () => ({
  analyzeClass: vi.fn((horse, raceHeader) => {
    // Return default analysis that can be overridden via test data
    const mockData = (horse as { __mockClassData?: unknown }).__mockClassData

    if (mockData) {
      return mockData
    }

    // Default: no movement, no proven form
    return {
      currentClass: ClassLevel.ALLOWANCE,
      lastRaceClass: ClassLevel.ALLOWANCE,
      recentClassLevels: [ClassLevel.ALLOWANCE],
      movement: {
        direction: 'lateral' as const,
        magnitude: 'minor' as const,
        levelsDifference: 0,
        description: 'Same class',
        fromLevel: ClassLevel.ALLOWANCE,
        toLevel: ClassLevel.ALLOWANCE,
        claimingPriceDrop: null,
      },
      provenAtLevel: {
        hasWon: false,
        winsAtLevel: 0,
        hasPlaced: false,
        itmAtLevel: 0,
        wasCompetitive: false,
        competitiveRacesAtLevel: 0,
        bestFinish: null,
        bestBeyerAtLevel: null,
      },
      hiddenDrops: [],
      trackTierMovement: null,
      classScore: 0,
      reasoning: [],
    }
  }),
}))

// Mock track tiers
vi.mock('../trackTiers', () => ({
  analyzeTrackTierMovement: vi.fn((prevTrack, currTrack) => {
    // Simulate track tier drops
    if (prevTrack === 'SAR' && currTrack === 'PEN') {
      return {
        fromTier: 'A' as const,
        toTier: 'C' as const,
        fromTrack: prevTrack,
        toTrack: currTrack,
        description: 'Major track tier drop (A→C)',
        pointsAdjustment: 8,
      }
    }
    if (prevTrack === 'CD' && currTrack === 'PEN') {
      return {
        fromTier: 'A' as const,
        toTier: 'C' as const,
        fromTrack: prevTrack,
        toTrack: currTrack,
        description: 'Major track tier drop (A→C)',
        pointsAdjustment: 8,
      }
    }
    if (prevTrack === 'GP' && currTrack === 'TAM') {
      return {
        fromTier: 'A' as const,
        toTier: 'B' as const,
        fromTrack: prevTrack,
        toTrack: currTrack,
        description: 'Track tier drop (A→B)',
        pointsAdjustment: 4,
      }
    }
    return null
  }),
}))

// Helper to create horse with mock class data
function createHorseWithClassData(
  classData: Record<string, unknown>,
  horseOverrides = {}
) {
  const horse = createHorseEntry(horseOverrides)
  ;(horse as { __mockClassData: unknown }).__mockClassData = classData
  return horse
}

describe('Class Scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Class Drop Scoring (1/2/3+ Levels)', () => {
    it('scores 1-level drop with proven winner positively', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.ALLOWANCE_N2X,
        lastRaceClass: ClassLevel.ALLOWANCE,
        recentClassLevels: [ClassLevel.ALLOWANCE],
        movement: {
          direction: 'drop',
          magnitude: 'minor',
          levelsDifference: -5, // 1 level
          description: 'Dropping from ALW to ALW-N2X',
          fromLevel: ClassLevel.ALLOWANCE,
          toLevel: ClassLevel.ALLOWANCE_N2X,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: true,
          winsAtLevel: 2,
          hasPlaced: true,
          itmAtLevel: 4,
          wasCompetitive: true,
          competitiveRacesAtLevel: 6,
          bestFinish: 1,
          bestBeyerAtLevel: 92,
        },
        hiddenDrops: [],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      }, {
        pastPerformances: [
          createPastPerformance({ finishPosition: 2, classification: 'allowance' }),
          createPastPerformance({ finishPosition: 1, classification: 'allowance' }),
        ],
      })

      const raceHeader = createRaceHeader({ classification: 'allowance' })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.provenAtLevelScore).toBe(20) // Proven winner
      expect(result.classMovementScore).toBeGreaterThan(0) // Positive for drop + proven
      expect(result.total).toBeGreaterThanOrEqual(15)
      expect(result.total).toBeLessThanOrEqual(MAX_CLASS_SCORE)
    })

    it('scores 2-level drop positively', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.CLAIMING_25K_TO_49K,
        lastRaceClass: ClassLevel.ALLOWANCE_N1X,
        recentClassLevels: [ClassLevel.ALLOWANCE_N1X, ClassLevel.ALLOWANCE_N2X],
        movement: {
          direction: 'drop',
          magnitude: 'moderate',
          levelsDifference: -10, // ~2 levels (normalized)
          description: 'Dropping from ALW-N1X to CLM25-49K',
          fromLevel: ClassLevel.ALLOWANCE_N1X,
          toLevel: ClassLevel.CLAIMING_25K_TO_49K,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: false,
          itmAtLevel: 0,
          wasCompetitive: false,
          competitiveRacesAtLevel: 0,
          bestFinish: 5,
          bestBeyerAtLevel: 78,
        },
        hiddenDrops: [],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      })

      const raceHeader = createRaceHeader({ classification: 'claiming', claimingPriceMax: 40000 })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.classMovementScore).toBeGreaterThan(0) // 2-level drop gives positive score
    })

    it('scores 3+ level drop positively but with skepticism', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.CLAIMING_UNDER_10K,
        lastRaceClass: ClassLevel.ALLOWANCE,
        recentClassLevels: [ClassLevel.ALLOWANCE],
        movement: {
          direction: 'drop',
          magnitude: 'extreme',
          levelsDifference: -45, // ~9 levels (extreme drop)
          description: 'Major class drop from ALW to CLM<10K',
          fromLevel: ClassLevel.ALLOWANCE,
          toLevel: ClassLevel.CLAIMING_UNDER_10K,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: false,
          itmAtLevel: 0,
          wasCompetitive: false,
          competitiveRacesAtLevel: 0,
          bestFinish: 8,
          bestBeyerAtLevel: null,
        },
        hiddenDrops: [],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      })

      const raceHeader = createRaceHeader({ classification: 'claiming', claimingPriceMax: 8000 })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.classMovementScore).toBeGreaterThan(0) // Major drop still scores positive
    })
  })

  describe('Class Rise Penalty', () => {
    it('gives small bonus for rising after win', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.ALLOWANCE_N2X,
        lastRaceClass: ClassLevel.ALLOWANCE_N3X,
        recentClassLevels: [ClassLevel.ALLOWANCE_N3X],
        movement: {
          direction: 'rise',
          magnitude: 'minor',
          levelsDifference: 5, // 1 level rise
          description: 'Rising from ALW-N3X to ALW-N2X',
          fromLevel: ClassLevel.ALLOWANCE_N3X,
          toLevel: ClassLevel.ALLOWANCE_N2X,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: false,
          itmAtLevel: 0,
          wasCompetitive: false,
          competitiveRacesAtLevel: 0,
          bestFinish: null,
          bestBeyerAtLevel: null,
        },
        hiddenDrops: [],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      }, {
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }), // Won last
        ],
      })

      const raceHeader = createRaceHeader({ classification: 'allowance' })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.classMovementScore).toBeGreaterThanOrEqual(0) // Won last, small rise is ok
    })

    it('penalizes ambitious 2+ level rise', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.STAKES_GRADE_3,
        lastRaceClass: ClassLevel.ALLOWANCE_N1X,
        recentClassLevels: [ClassLevel.ALLOWANCE_N1X],
        movement: {
          direction: 'rise',
          magnitude: 'major',
          levelsDifference: 25, // ~5 levels
          description: 'Rising from ALW-N1X to G3',
          fromLevel: ClassLevel.ALLOWANCE_N1X,
          toLevel: ClassLevel.STAKES_GRADE_3,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: false,
          itmAtLevel: 0,
          wasCompetitive: false,
          competitiveRacesAtLevel: 0,
          bestFinish: null,
          bestBeyerAtLevel: null,
        },
        hiddenDrops: [],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      }, {
        pastPerformances: [
          createPastPerformance({ finishPosition: 3 }), // Did not win
        ],
      })

      const raceHeader = createRaceHeader({
        classification: 'stakes',
        grade: 3,
      })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.classMovementScore).toBeLessThanOrEqual(0) // Ambitious rise penalty (0 or negative)
    })
  })

  describe('Proven at Level Bonuses', () => {
    it('gives +20 pts for proven winner at class', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.CLAIMING_50K_TO_99K,
        lastRaceClass: ClassLevel.CLAIMING_50K_TO_99K,
        recentClassLevels: [ClassLevel.CLAIMING_50K_TO_99K],
        movement: {
          direction: 'lateral',
          magnitude: 'minor',
          levelsDifference: 0,
          description: 'Same class',
          fromLevel: ClassLevel.CLAIMING_50K_TO_99K,
          toLevel: ClassLevel.CLAIMING_50K_TO_99K,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: true,
          winsAtLevel: 3,
          hasPlaced: true,
          itmAtLevel: 5,
          wasCompetitive: true,
          competitiveRacesAtLevel: 7,
          bestFinish: 1,
          bestBeyerAtLevel: 88,
        },
        hiddenDrops: [],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      })

      const raceHeader = createRaceHeader({
        classification: 'claiming',
        claimingPriceMax: 75000,
      })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.provenAtLevelScore).toBe(20)
      expect(result.breakdown).toContainEqual(expect.objectContaining({
        label: 'Proven Winner',
        points: 20,
      }))
    })

    it('gives +15 pts for proven placer at class', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.ALLOWANCE_N1X,
        lastRaceClass: ClassLevel.ALLOWANCE_N1X,
        recentClassLevels: [ClassLevel.ALLOWANCE_N1X],
        movement: {
          direction: 'lateral',
          magnitude: 'minor',
          levelsDifference: 0,
          description: 'Same class',
          fromLevel: ClassLevel.ALLOWANCE_N1X,
          toLevel: ClassLevel.ALLOWANCE_N1X,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: true,
          itmAtLevel: 4,
          wasCompetitive: true,
          competitiveRacesAtLevel: 5,
          bestFinish: 2,
          bestBeyerAtLevel: 85,
        },
        hiddenDrops: [],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      })

      const raceHeader = createRaceHeader({ classification: 'allowance' })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.provenAtLevelScore).toBe(15)
      expect(result.breakdown).toContainEqual(expect.objectContaining({
        label: 'Proven Placer',
        points: 15,
      }))
    })

    it('gives +10 pts for competitive at class', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.ALLOWANCE,
        lastRaceClass: ClassLevel.ALLOWANCE,
        recentClassLevels: [ClassLevel.ALLOWANCE],
        movement: {
          direction: 'lateral',
          magnitude: 'minor',
          levelsDifference: 0,
          description: 'Same class',
          fromLevel: ClassLevel.ALLOWANCE,
          toLevel: ClassLevel.ALLOWANCE,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: false,
          itmAtLevel: 0,
          wasCompetitive: true,
          competitiveRacesAtLevel: 3,
          bestFinish: 4,
          bestBeyerAtLevel: 82,
        },
        hiddenDrops: [],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      })

      const raceHeader = createRaceHeader({ classification: 'allowance' })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.provenAtLevelScore).toBe(10)
    })
  })

  describe('Hidden Class Drops', () => {
    it('detects track tier drop (A→C = +8 pts)', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.ALLOWANCE,
        lastRaceClass: ClassLevel.ALLOWANCE,
        recentClassLevels: [ClassLevel.ALLOWANCE],
        movement: {
          direction: 'lateral',
          magnitude: 'minor',
          levelsDifference: 0,
          description: 'Same class on paper',
          fromLevel: ClassLevel.ALLOWANCE,
          toLevel: ClassLevel.ALLOWANCE,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: false,
          itmAtLevel: 0,
          wasCompetitive: false,
          competitiveRacesAtLevel: 0,
          bestFinish: null,
          bestBeyerAtLevel: null,
        },
        hiddenDrops: [
          {
            type: 'track_tier_drop' as const,
            description: 'Shipping from Saratoga to Penn National',
            pointsBonus: 8,
            explanation: 'Racing at weaker track today',
          },
        ],
        trackTierMovement: {
          fromTier: 'A' as const,
          toTier: 'C' as const,
          fromTrack: 'SAR',
          toTrack: 'PEN',
          description: 'Major track tier drop (A→C)',
          pointsAdjustment: 8,
        },
        classScore: 0,
        reasoning: [],
      }, {
        pastPerformances: [
          createPastPerformance({ track: 'SAR' }),
        ],
      })

      const raceHeader = createRaceHeader({ trackCode: 'PEN' })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.hiddenDropsScore).toBe(8)
      expect(result.breakdown).toContainEqual(expect.objectContaining({
        label: expect.stringContaining('Track Tier'),
        points: 8,
      }))
    })

    it('detects claiming price drop ($50K→$25K)', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.CLAIMING_25K_TO_49K,
        lastRaceClass: ClassLevel.CLAIMING_50K_TO_99K,
        recentClassLevels: [ClassLevel.CLAIMING_50K_TO_99K],
        movement: {
          direction: 'drop',
          magnitude: 'moderate',
          levelsDifference: -5,
          description: 'Dropping from $50K to $25K claiming',
          fromLevel: ClassLevel.CLAIMING_50K_TO_99K,
          toLevel: ClassLevel.CLAIMING_25K_TO_49K,
          claimingPriceDrop: 25000, // $50K to $25K
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: false,
          itmAtLevel: 0,
          wasCompetitive: false,
          competitiveRacesAtLevel: 0,
          bestFinish: null,
          bestBeyerAtLevel: null,
        },
        hiddenDrops: [
          {
            type: 'claiming_price_drop' as const,
            description: '$25K claiming price drop',
            pointsBonus: 10,
            explanation: 'Significant claiming drop',
          },
        ],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      }, {
        claimingPrice: 25000,
        pastPerformances: [
          createPastPerformance({
            claimingPrice: 50000,
            classification: 'claiming',
          }),
        ],
      })

      const raceHeader = createRaceHeader({
        classification: 'claiming',
        claimingPriceMax: 25000,
      })

      const result = calculateClassScore(horse, raceHeader)

      // Should get class movement + claiming drop bonus
      expect(result.classMovementScore).toBeGreaterThan(0)
      expect(result.hiddenDropsScore).toBe(10)
    })

    it('detects purse drop as hidden value', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.ALLOWANCE,
        lastRaceClass: ClassLevel.ALLOWANCE,
        recentClassLevels: [ClassLevel.ALLOWANCE],
        movement: {
          direction: 'lateral',
          magnitude: 'minor',
          levelsDifference: 0,
          description: 'Same class',
          fromLevel: ClassLevel.ALLOWANCE,
          toLevel: ClassLevel.ALLOWANCE,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: false,
          itmAtLevel: 0,
          wasCompetitive: false,
          competitiveRacesAtLevel: 0,
          bestFinish: null,
          bestBeyerAtLevel: null,
        },
        hiddenDrops: [
          {
            type: 'purse_drop' as const,
            description: 'Purse drop from $100K to $40K',
            pointsBonus: 6,
            explanation: 'Facing weaker field (lower purse)',
          },
        ],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      }, {
        pastPerformances: [
          createPastPerformance({ purse: 100000 }),
        ],
      })

      const raceHeader = createRaceHeader({ purse: 40000 })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.hiddenDropsScore).toBe(6)
    })
  })

  describe('Score Cap at 20 Points', () => {
    it('caps total class score at 20 points maximum', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.CLAIMING_25K_TO_49K,
        lastRaceClass: ClassLevel.STAKES_GRADE_2,
        recentClassLevels: [ClassLevel.STAKES_GRADE_2],
        movement: {
          direction: 'drop',
          magnitude: 'extreme',
          levelsDifference: -60, // Massive drop
          description: 'Extreme class drop from G2 to CLM25K',
          fromLevel: ClassLevel.STAKES_GRADE_2,
          toLevel: ClassLevel.CLAIMING_25K_TO_49K,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: true,
          winsAtLevel: 5,
          hasPlaced: true,
          itmAtLevel: 10,
          wasCompetitive: true,
          competitiveRacesAtLevel: 15,
          bestFinish: 1,
          bestBeyerAtLevel: 105,
        },
        hiddenDrops: [
          {
            type: 'track_tier_drop' as const,
            description: 'Track tier drop',
            pointsBonus: 8,
            explanation: 'Shipper from elite track',
          },
          {
            type: 'purse_drop' as const,
            description: 'Purse drop',
            pointsBonus: 6,
            explanation: 'Lower purse',
          },
        ],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      })

      const raceHeader = createRaceHeader({
        classification: 'claiming',
        claimingPriceMax: 35000,
      })

      const result = calculateClassScore(horse, raceHeader)

      // Should have massive raw score but capped at 20
      expect(result.total).toBe(MAX_CLASS_SCORE)
      expect(result.total).toBe(20)
    })
  })

  describe('Edge Cases', () => {
    it('handles unknown class levels gracefully', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.UNKNOWN,
        lastRaceClass: ClassLevel.UNKNOWN,
        recentClassLevels: [],
        movement: {
          direction: 'unknown' as const,
          magnitude: 'minor' as const,
          levelsDifference: 0,
          description: 'Unable to determine class',
          fromLevel: ClassLevel.UNKNOWN,
          toLevel: ClassLevel.UNKNOWN,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: false,
          itmAtLevel: 0,
          wasCompetitive: false,
          competitiveRacesAtLevel: 0,
          bestFinish: null,
          bestBeyerAtLevel: null,
        },
        hiddenDrops: [],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      })

      const raceHeader = createRaceHeader()

      const result = calculateClassScore(horse, raceHeader)

      expect(result.total).toBeGreaterThanOrEqual(0)
      expect(result.total).toBeLessThanOrEqual(MAX_CLASS_SCORE)
    })

    it('handles missing purse data gracefully', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.ALLOWANCE,
        lastRaceClass: ClassLevel.ALLOWANCE,
        recentClassLevels: [ClassLevel.ALLOWANCE],
        movement: {
          direction: 'lateral',
          magnitude: 'minor',
          levelsDifference: 0,
          description: 'Same class',
          fromLevel: ClassLevel.ALLOWANCE,
          toLevel: ClassLevel.ALLOWANCE,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: false,
          itmAtLevel: 0,
          wasCompetitive: false,
          competitiveRacesAtLevel: 0,
          bestFinish: null,
          bestBeyerAtLevel: null,
        },
        hiddenDrops: [],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      }, {
        pastPerformances: [
          createPastPerformance({ purse: undefined as unknown as number }),
        ],
      })

      const raceHeader = createRaceHeader({ purse: undefined as unknown as number })

      // Should not throw
      const result = calculateClassScore(horse, raceHeader)

      expect(result.total).toBeGreaterThanOrEqual(0)
    })

    it('handles first-time starter with no past performances', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.MAIDEN_SPECIAL_WEIGHT,
        lastRaceClass: null,
        recentClassLevels: [],
        movement: {
          direction: 'unknown' as const,
          magnitude: 'minor' as const,
          levelsDifference: 0,
          description: 'First start',
          fromLevel: ClassLevel.UNKNOWN,
          toLevel: ClassLevel.MAIDEN_SPECIAL_WEIGHT,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: false,
          itmAtLevel: 0,
          wasCompetitive: false,
          competitiveRacesAtLevel: 0,
          bestFinish: null,
          bestBeyerAtLevel: null,
        },
        hiddenDrops: [],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      }, {
        lifetimeStarts: 0,
        pastPerformances: [],
      })

      const raceHeader = createRaceHeader({ classification: 'maiden_special_weight' })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.total).toBeGreaterThanOrEqual(0)
      expect(result.reasoning).toBeDefined()
    })
  })

  describe('Display Helpers', () => {
    describe('getClassScoreColor', () => {
      it('returns green for excellent scores (16+)', () => {
        expect(getClassScoreColor(20)).toBe('#22c55e')
        expect(getClassScoreColor(16)).toBe('#22c55e')
      })

      it('returns light green for good scores (12-15)', () => {
        expect(getClassScoreColor(12)).toBe('#84cc16')
        expect(getClassScoreColor(14)).toBe('#84cc16')
      })

      it('returns yellow for neutral scores (8-11)', () => {
        expect(getClassScoreColor(8)).toBe('#eab308')
        expect(getClassScoreColor(10)).toBe('#eab308')
      })

      it('returns orange for concerning scores (4-7)', () => {
        expect(getClassScoreColor(4)).toBe('#f97316')
        expect(getClassScoreColor(6)).toBe('#f97316')
      })

      it('returns red for poor scores (0-3)', () => {
        expect(getClassScoreColor(0)).toBe('#ef4444')
        expect(getClassScoreColor(3)).toBe('#ef4444')
      })
    })

    describe('getClassScoreTier', () => {
      it('returns Excellent for 16+ scores', () => {
        expect(getClassScoreTier(18)).toBe('Excellent')
      })

      it('returns Good for 12-15 scores', () => {
        expect(getClassScoreTier(14)).toBe('Good')
      })

      it('returns Neutral for 8-11 scores', () => {
        expect(getClassScoreTier(10)).toBe('Neutral')
      })

      it('returns Concerning for 4-7 scores', () => {
        expect(getClassScoreTier(6)).toBe('Concerning')
      })

      it('returns Poor for 0-3 scores', () => {
        expect(getClassScoreTier(2)).toBe('Poor')
      })
    })

    describe('formatClassMovement', () => {
      it('formats class drop correctly', () => {
        const analysis = {
          currentClass: ClassLevel.CLAIMING_25K_TO_49K,
          lastRaceClass: ClassLevel.ALLOWANCE,
          recentClassLevels: [],
          movement: {
            direction: 'drop' as const,
            magnitude: 'moderate' as const,
            levelsDifference: -35,
            description: 'Dropping from ALW to CLM25K',
            fromLevel: ClassLevel.ALLOWANCE,
            toLevel: ClassLevel.CLAIMING_25K_TO_49K,
            claimingPriceDrop: null,
          },
          provenAtLevel: {} as any,
          hiddenDrops: [],
          trackTierMovement: null,
          classScore: 0,
          reasoning: [],
        }

        const formatted = formatClassMovement(analysis)

        expect(formatted).toContain('↓')
        expect(formatted).toContain('ALW')
        expect(formatted).toContain('CLM25-49')
      })

      it('formats class rise correctly', () => {
        const analysis = {
          currentClass: ClassLevel.STAKES_GRADE_3,
          lastRaceClass: ClassLevel.ALLOWANCE,
          recentClassLevels: [],
          movement: {
            direction: 'rise' as const,
            magnitude: 'major' as const,
            levelsDifference: 20,
            description: 'Rising from ALW to G3',
            fromLevel: ClassLevel.ALLOWANCE,
            toLevel: ClassLevel.STAKES_GRADE_3,
            claimingPriceDrop: null,
          },
          provenAtLevel: {} as any,
          hiddenDrops: [],
          trackTierMovement: null,
          classScore: 0,
          reasoning: [],
        }

        const formatted = formatClassMovement(analysis)

        expect(formatted).toContain('↑')
        expect(formatted).toContain('ALW')
        expect(formatted).toContain('G3')
      })

      it('formats lateral movement correctly', () => {
        const analysis = {
          currentClass: ClassLevel.ALLOWANCE,
          lastRaceClass: ClassLevel.ALLOWANCE,
          recentClassLevels: [],
          movement: {
            direction: 'lateral' as const,
            magnitude: 'minor' as const,
            levelsDifference: 0,
            description: 'Same class',
            fromLevel: ClassLevel.ALLOWANCE,
            toLevel: ClassLevel.ALLOWANCE,
            claimingPriceDrop: null,
          },
          provenAtLevel: {} as any,
          hiddenDrops: [],
          trackTierMovement: null,
          classScore: 0,
          reasoning: [],
        }

        const formatted = formatClassMovement(analysis)

        expect(formatted).toContain('→')
        expect(formatted).toContain('ALW')
      })
    })

    describe('getHiddenDropsSummary', () => {
      it('returns empty string for no hidden drops', () => {
        const result = getHiddenDropsSummary([])
        expect(result).toBe('')
      })

      it('formats single hidden drop', () => {
        const drops = [
          {
            type: 'track_tier_drop' as const,
            description: 'SAR to PEN',
            pointsBonus: 8,
            explanation: 'Track tier drop',
          },
        ]

        const result = getHiddenDropsSummary(drops)

        expect(result).toBe('Track drop')
      })

      it('formats multiple hidden drops', () => {
        const drops = [
          {
            type: 'track_tier_drop' as const,
            description: 'Track drop',
            pointsBonus: 8,
            explanation: '',
          },
          {
            type: 'purse_drop' as const,
            description: 'Purse drop',
            pointsBonus: 6,
            explanation: '',
          },
        ]

        const result = getHiddenDropsSummary(drops)

        expect(result).toContain('Track drop')
        expect(result).toContain('Purse drop')
        expect(result).toContain(', ')
      })
    })
  })

  describe('Value Play Detection', () => {
    describe('hasSignificantHiddenValue', () => {
      it('returns true for 8+ hidden drop points', () => {
        const scoreResult = {
          total: 12,
          provenAtLevelScore: 0,
          classMovementScore: 0,
          hiddenDropsScore: 10,
          trackTierScore: 0,
          analysis: {} as any,
          reasoning: '',
          breakdown: [],
        }

        expect(hasSignificantHiddenValue(scoreResult)).toBe(true)
      })

      it('returns true for 2+ hidden drops', () => {
        const scoreResult = {
          total: 10,
          provenAtLevelScore: 0,
          classMovementScore: 0,
          hiddenDropsScore: 6,
          trackTierScore: 0,
          analysis: {
            hiddenDrops: [
              { type: 'track_tier_drop' as const, description: '', pointsBonus: 3, explanation: '' },
              { type: 'purse_drop' as const, description: '', pointsBonus: 3, explanation: '' },
            ],
          } as any,
          reasoning: '',
          breakdown: [],
        }

        expect(hasSignificantHiddenValue(scoreResult)).toBe(true)
      })

      it('returns false for low hidden value', () => {
        const scoreResult = {
          total: 5,
          provenAtLevelScore: 0,
          classMovementScore: 0,
          hiddenDropsScore: 3,
          trackTierScore: 0,
          analysis: {
            hiddenDrops: [
              { type: 'purse_drop' as const, description: '', pointsBonus: 3, explanation: '' },
            ],
          } as any,
          reasoning: '',
          breakdown: [],
        }

        expect(hasSignificantHiddenValue(scoreResult)).toBe(false)
      })
    })

    describe('isValuePlay', () => {
      it('identifies value play with drop + hidden edges', () => {
        const scoreResult = {
          total: 15,
          provenAtLevelScore: 0,
          classMovementScore: 8,
          hiddenDropsScore: 7,
          trackTierScore: 0,
          analysis: {
            movement: { direction: 'drop' as const },
            hiddenDrops: [],
          } as any,
          reasoning: '',
          breakdown: [],
        }

        expect(isValuePlay(scoreResult)).toBe(true)
      })

      it('identifies value play with proven + movement', () => {
        const scoreResult = {
          total: 18,
          provenAtLevelScore: 15,
          classMovementScore: 3,
          hiddenDropsScore: 0,
          trackTierScore: 0,
          analysis: {
            movement: { direction: 'drop' as const },
            hiddenDrops: [],
          } as any,
          reasoning: '',
          breakdown: [],
        }

        expect(isValuePlay(scoreResult)).toBe(true)
      })

      it('identifies value play with massive hidden drops', () => {
        const scoreResult = {
          total: 14,
          provenAtLevelScore: 0,
          classMovementScore: 4,
          hiddenDropsScore: 10,
          trackTierScore: 0,
          analysis: {
            movement: { direction: 'lateral' as const },
            hiddenDrops: [],
          } as any,
          reasoning: '',
          breakdown: [],
        }

        expect(isValuePlay(scoreResult)).toBe(true)
      })

      it('rejects non-value play', () => {
        const scoreResult = {
          total: 8,
          provenAtLevelScore: 0,
          classMovementScore: 5,
          hiddenDropsScore: 3,
          trackTierScore: 0,
          analysis: {
            movement: { direction: 'lateral' as const },
            hiddenDrops: [],
          } as any,
          reasoning: '',
          breakdown: [],
        }

        expect(isValuePlay(scoreResult)).toBe(false)
      })
    })
  })

  describe('Real-World Racing Scenarios', () => {
    it('scores Penn National shipper from Saratoga as value play', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.ALLOWANCE_N2X,
        lastRaceClass: ClassLevel.ALLOWANCE_N2X,
        recentClassLevels: [ClassLevel.ALLOWANCE_N2X, ClassLevel.ALLOWANCE],
        movement: {
          direction: 'lateral',
          magnitude: 'minor',
          levelsDifference: 0,
          description: 'Same class but different track tier',
          fromLevel: ClassLevel.ALLOWANCE_N2X,
          toLevel: ClassLevel.ALLOWANCE_N2X,
          claimingPriceDrop: null,
        },
        provenAtLevel: {
          hasWon: true,
          winsAtLevel: 1,
          hasPlaced: true,
          itmAtLevel: 3,
          wasCompetitive: true,
          competitiveRacesAtLevel: 5,
          bestFinish: 1,
          bestBeyerAtLevel: 88,
        },
        hiddenDrops: [
          {
            type: 'track_tier_drop' as const,
            description: 'Saratoga (A) to Penn National (C)',
            pointsBonus: 8,
            explanation: 'Hidden class edge - weaker track',
          },
        ],
        trackTierMovement: {
          fromTier: 'A' as const,
          toTier: 'C' as const,
          fromTrack: 'SAR',
          toTrack: 'PEN',
          description: 'Major track tier drop',
          pointsAdjustment: 8,
        },
        classScore: 0,
        reasoning: [],
      }, {
        horseName: 'Saratoga Shipper',
        pastPerformances: [
          createPastPerformance({ track: 'SAR', finishPosition: 1 }),
          createPastPerformance({ track: 'SAR', finishPosition: 3 }),
        ],
      })

      const raceHeader = createRaceHeader({
        trackCode: 'PEN',
        classification: 'allowance',
      })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.provenAtLevelScore).toBe(20) // Winner
      expect(result.hiddenDropsScore).toBe(8) // Track tier
      expect(result.total).toBe(MAX_CLASS_SCORE) // Capped at 20
      expect(hasSignificantHiddenValue(result)).toBe(true)
    })

    it('scores big claiming price drop ($50K → $25K) correctly', () => {
      const horse = createHorseWithClassData({
        currentClass: ClassLevel.CLAIMING_25K_TO_49K,
        lastRaceClass: ClassLevel.CLAIMING_50K_TO_99K,
        recentClassLevels: [ClassLevel.CLAIMING_50K_TO_99K, ClassLevel.CLAIMING_50K_TO_99K],
        movement: {
          direction: 'drop',
          magnitude: 'minor',
          levelsDifference: -5,
          description: 'Dropping from $50K to $25K claiming',
          fromLevel: ClassLevel.CLAIMING_50K_TO_99K,
          toLevel: ClassLevel.CLAIMING_25K_TO_49K,
          claimingPriceDrop: 25000,
        },
        provenAtLevel: {
          hasWon: false,
          winsAtLevel: 0,
          hasPlaced: true,
          itmAtLevel: 2,
          wasCompetitive: true,
          competitiveRacesAtLevel: 4,
          bestFinish: 2,
          bestBeyerAtLevel: 82,
        },
        hiddenDrops: [],
        trackTierMovement: null,
        classScore: 0,
        reasoning: [],
      }, {
        horseName: 'Claimer Drop',
        claimingPrice: 25000,
        pastPerformances: [
          createPastPerformance({
            claimingPrice: 50000,
            finishPosition: 2,
          }),
        ],
      })

      const raceHeader = createRaceHeader({
        classification: 'claiming',
        claimingPriceMax: 25000,
      })

      const result = calculateClassScore(horse, raceHeader)

      expect(result.provenAtLevelScore).toBe(15) // Placer at higher level
      // Class movement should include claiming price bonus
      expect(result.classMovementScore).toBeGreaterThan(0)
      expect(result.total).toBeGreaterThan(15)
    })
  })
})
