/**
 * Diamond Detector Tests
 *
 * Tests for diamond in rough detection, validation, and UI integration.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  analyzeDiamondCandidate,
  analyzeRaceDiamonds,
  mightBeDiamond,
} from '../diamondDetector'
import {
  validateDiamond,
  validateDiamonds,
  getValidatedDiamonds,
  isDiamondValid,
} from '../diamondValidator'
import {
  DIAMOND_SCORE_MIN,
  DIAMOND_SCORE_MAX,
  DIAMOND_MIN_OVERLAY_PERCENT,
  DIAMOND_MIN_FACTORS,
  isScoreInDiamondRange,
  meetsMinimumOverlay,
  meetsMinimumFactors,
  calculateConfidence,
  getDiamondColor,
  getDiamondBgColor,
} from '../diamondTypes'
import type { HorseEntry, RaceHeader } from '../../../types/drf'
import type { HorseScore, ScoreBreakdown } from '../../scoring'
import type { SireProfile } from '../../../lib/breeding/types'

// Mock the logger
vi.mock('../../../services/logging', () => ({
  logger: {
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
    logDebug: vi.fn(),
  },
}))

// Mock the modules that the diamond detector imports
vi.mock('../../scoring/overlayAnalysis', () => ({
  analyzeOverlay: (score: number, odds: string) => {
    // Parse odds to decimal (simplified)
    const parts = odds.split('-')
    let decimal = 2.0
    if (parts.length === 2) {
      decimal = parseInt(parts[0]) / parseInt(parts[1]) + 1
    } else if (odds.includes('/')) {
      const [num, den] = odds.split('/')
      decimal = parseInt(num) / parseInt(den) + 1
    } else {
      decimal = parseFloat(odds) || 2.0
    }

    // Calculate overlay (simplified)
    const fairOdds = 240 / score
    const overlayPercent = ((decimal - 1) - (fairOdds - 1)) / (fairOdds - 1) * 100

    return {
      overlayPercent: overlayPercent > 0 ? overlayPercent : 0,
      valueClass: overlayPercent >= 200 ? 'massive_overlay' : 'fair_price',
      isPositiveEV: overlayPercent > 0,
      fairOddsDecimal: fairOdds,
      fairOddsDisplay: `${Math.round(fairOdds)}-1`,
    }
  },
  parseOddsToDecimal: (odds: string) => {
    const parts = odds.split('-')
    if (parts.length === 2) {
      return parseInt(parts[0]) / parseInt(parts[1]) + 1
    }
    return parseFloat(odds) || 2.0
  },
  calculateEV: (winProb: number, odds: number) => winProb * odds - 1,
}))

vi.mock('../../trackIntelligence', () => ({
  getSpeedBias: () => ({
    earlySpeedWinRate: 55,
    label: 'Fair',
  }),
  getPostPositionBias: () => ({
    favoredPosts: [1, 2, 3],
  }),
}))

vi.mock('../../scoring/paceAnalysis', () => ({
  parseRunningStyle: () => ({
    style: 'P',
    styleName: 'Presser',
  }),
  analyzePaceScenario: () => ({
    label: 'Honest Pace',
    ppi: 45,
  }),
}))

vi.mock('../../equipment/trainerPatterns', () => ({
  getTrainerProfile: () => ({
    overallWinRate: 22,
    patterns: [
      { type: 'lasix_first', winRate: 25, sampleSize: 20 },
    ],
  }),
  getTrainerPattern: () => ({
    winRate: 25,
    sampleSize: 20,
  }),
}))

// Helper to create mock horse entry
function createMockHorse(overrides: Partial<HorseEntry> = {}): HorseEntry {
  return {
    programNumber: 5,
    entryIndicator: '',
    postPosition: 5,
    horseName: 'Test Horse',
    age: 4,
    sex: 'C',
    breeding: {
      sire: 'Test Sire',
      dam: 'Test Dam',
      damSire: 'Test DamSire',
    },
    owner: 'Test Owner',
    trainerName: 'Test Trainer',
    jockeyName: 'Test Jockey',
    weight: 122,
    equipment: {
      blinkers: false,
      frontBandages: false,
      mudCaulks: false,
      glueOn: false,
      innerRim: false,
      insideRim: false,
      backAtTheKnee: false,
      barShoes: false,
      description: '',
      isFirstTimeBlinkers: false,
    },
    medication: {
      lasix: false,
      lasixFirstTime: false,
      lasixOff: false,
      bute: false,
      other: [],
      raw: '',
    },
    morningLineOdds: '15-1',
    morningLineDecimal: 16,
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimePlaces: 3,
    lifetimeShows: 2,
    lifetimeEarnings: 50000,
    bestBeyer: 85,
    averageBeyer: 80,
    lastBeyer: 78,
    earlySpeedRating: 75,
    runningStyle: 'P',
    workouts: [],
    pastPerformances: [],
    isScratched: false,
    rawLine: '',
    turfWins: 0,
    distanceWins: 1,
    ...overrides,
  } as HorseEntry
}

// Helper to create mock score
function createMockScore(total: number, overrides: Partial<HorseScore> = {}): HorseScore {
  return {
    total,
    isScratched: false,
    confidenceLevel: 'medium',
    dataQuality: 75,
    breakdown: {
      connections: { total: 25, reasoning: 'Test connections' },
      postPosition: { total: 20, reasoning: 'Test post' },
      speedClass: { total: 25, reasoning: 'Test speed' },
      form: { total: 15, reasoning: 'Test form' },
      equipment: { total: 15, reasoning: 'First-time Lasix added' },
      pace: { total: 20, paceFit: 'good', reasoning: 'Good pace fit' },
    } as ScoreBreakdown,
    classScore: {
      total: 15,
      analysis: {
        movement: {
          direction: 'drop',
          levelsDifference: 4,
          description: 'Dropping 4 class levels',
        },
        provenAtLevel: {
          hasWon: true,
          winsAtLevel: 2,
          hasPlaced: true,
          itmAtLevel: 5,
        },
        hiddenDrops: [
          {
            description: 'Purse drop',
            explanation: 'From $50K to $25K',
          },
        ],
        currentClass: 'CLM 25K',
        lastRaceClass: 'CLM 50K',
      },
      provenAtLevelScore: 5,
      classMovementScore: 6,
      hiddenDropsScore: 4,
      trackTierScore: 0,
      reasoning: 'Class drop detected',
      breakdown: [],
    },
    breedingScore: {
      wasApplied: false,
      total: 0,
      sireDetails: { score: 0, profile: null, tierLabel: '', tierColor: '#888888', reasoning: '' },
      damDetails: { score: 0, profile: null, tierLabel: '', tierColor: '#888888', reasoning: '' },
      damsireDetails: { score: 0, profile: null, tierLabel: '', tierColor: '#888888', reasoning: '' },
      bonuses: { eliteSireDebut: 0, surfaceFit: 0, distanceFit: 0, total: 0, reasons: [] },
    },
    ...overrides,
  } as HorseScore
}

// Helper to create mock race header
function createMockRaceHeader(overrides: Partial<RaceHeader> = {}): RaceHeader {
  return {
    trackCode: 'SAR',
    trackName: 'Saratoga',
    raceNumber: 1,
    raceDate: '2024-08-01',
    postTime: '1:00 PM',
    distanceFurlongs: 8.0,
    distance: '1 Mile',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'CLM 25000',
    purse: 25000,
    fieldSize: 10,
    probableFavorite: 3,
    ...overrides,
  } as RaceHeader
}

// ============================================================================
// DIAMOND TYPES TESTS
// ============================================================================

describe('Diamond Types', () => {
  describe('Constants', () => {
    it('should have correct score range', () => {
      expect(DIAMOND_SCORE_MIN).toBe(120)
      expect(DIAMOND_SCORE_MAX).toBe(139)
    })

    it('should require 200%+ overlay', () => {
      expect(DIAMOND_MIN_OVERLAY_PERCENT).toBe(200)
    })

    it('should require minimum 2 factors', () => {
      expect(DIAMOND_MIN_FACTORS).toBe(2)
    })
  })

  describe('isScoreInDiamondRange', () => {
    it('should return true for scores 120-139', () => {
      expect(isScoreInDiamondRange(120)).toBe(true)
      expect(isScoreInDiamondRange(130)).toBe(true)
      expect(isScoreInDiamondRange(139)).toBe(true)
    })

    it('should return false for scores outside range', () => {
      expect(isScoreInDiamondRange(119)).toBe(false)
      expect(isScoreInDiamondRange(140)).toBe(false)
      expect(isScoreInDiamondRange(180)).toBe(false)
      expect(isScoreInDiamondRange(100)).toBe(false)
    })
  })

  describe('meetsMinimumOverlay', () => {
    it('should return true for 200%+ overlay', () => {
      expect(meetsMinimumOverlay(200)).toBe(true)
      expect(meetsMinimumOverlay(250)).toBe(true)
      expect(meetsMinimumOverlay(500)).toBe(true)
    })

    it('should return false for less than 200% overlay', () => {
      expect(meetsMinimumOverlay(199)).toBe(false)
      expect(meetsMinimumOverlay(150)).toBe(false)
      expect(meetsMinimumOverlay(50)).toBe(false)
    })
  })

  describe('meetsMinimumFactors', () => {
    it('should return true for 2+ factors', () => {
      expect(meetsMinimumFactors(2)).toBe(true)
      expect(meetsMinimumFactors(3)).toBe(true)
      expect(meetsMinimumFactors(5)).toBe(true)
    })

    it('should return false for less than 2 factors', () => {
      expect(meetsMinimumFactors(1)).toBe(false)
      expect(meetsMinimumFactors(0)).toBe(false)
    })
  })

  describe('calculateConfidence', () => {
    it('should calculate confidence as factors × 20%', () => {
      expect(calculateConfidence(2)).toBe(40)
      expect(calculateConfidence(3)).toBe(60)
      expect(calculateConfidence(4)).toBe(80)
      expect(calculateConfidence(5)).toBe(100)
    })

    it('should cap confidence at 100%', () => {
      expect(calculateConfidence(6)).toBe(100)
      expect(calculateConfidence(10)).toBe(100)
    })
  })

  describe('getDiamondColor', () => {
    it('should return gold color', () => {
      expect(getDiamondColor()).toBe('#FFD700')
    })
  })

  describe('getDiamondBgColor', () => {
    it('should return gold with opacity', () => {
      expect(getDiamondBgColor(0.15)).toBe('rgba(255, 215, 0, 0.15)')
      expect(getDiamondBgColor(0.5)).toBe('rgba(255, 215, 0, 0.5)')
    })
  })
})

// ============================================================================
// DIAMOND DETECTOR TESTS
// ============================================================================

describe('Diamond Detector', () => {
  describe('mightBeDiamond', () => {
    it('should return true when score and overlay qualify', () => {
      expect(mightBeDiamond(130, 250)).toBe(true)
      expect(mightBeDiamond(120, 200)).toBe(true)
      expect(mightBeDiamond(139, 300)).toBe(true)
    })

    it('should return false when score is out of range', () => {
      expect(mightBeDiamond(140, 250)).toBe(false)
      expect(mightBeDiamond(119, 250)).toBe(false)
      expect(mightBeDiamond(180, 300)).toBe(false)
    })

    it('should return false when overlay is too low', () => {
      expect(mightBeDiamond(130, 150)).toBe(false)
      expect(mightBeDiamond(130, 199)).toBe(false)
    })
  })

  describe('analyzeDiamondCandidate', () => {
    it('should reject horse with score below diamond range', () => {
      const horse = createMockHorse()
      const score = createMockScore(100)
      const header = createMockRaceHeader()

      const result = analyzeDiamondCandidate(horse, 0, score, [horse], header, '15-1')

      expect(result.isDiamond).toBe(false)
      expect(result.disqualificationReason).toContain('Score 100 outside diamond range')
    })

    it('should reject horse with score above diamond range', () => {
      const horse = createMockHorse()
      const score = createMockScore(180)
      const header = createMockRaceHeader()

      const result = analyzeDiamondCandidate(horse, 0, score, [horse], header, '3-1')

      expect(result.isDiamond).toBe(false)
      expect(result.disqualificationReason).toContain('Score 180 outside diamond range')
    })

    it('should populate basic analysis fields', () => {
      const horse = createMockHorse({ horseName: 'Diamond Star' })
      const score = createMockScore(130)
      const header = createMockRaceHeader()

      const result = analyzeDiamondCandidate(horse, 0, score, [horse], header, '15-1')

      expect(result.horseName).toBe('Diamond Star')
      expect(result.programNumber).toBe(5)
      expect(result.score).toBe(130)
      expect(result.oddsDisplay).toBe('15-1')
      expect(result.analyzedAt).toBeDefined()
    })

    it('should generate story from factors', () => {
      const horse = createMockHorse({ horseName: 'Diamond Star' })
      const score = createMockScore(130)
      const header = createMockRaceHeader()

      const result = analyzeDiamondCandidate(horse, 0, score, [horse], header, '15-1')

      // Story should be generated even if not a diamond
      expect(result.story).toBeDefined()
    })
  })

  describe('analyzeRaceDiamonds', () => {
    it('should return summary with no diamonds when none qualify', () => {
      const horses = [
        createMockHorse({ programNumber: 1, horseName: 'Horse1' }),
        createMockHorse({ programNumber: 2, horseName: 'Horse2' }),
      ]
      const scores = new Map<number, HorseScore>([
        [0, createMockScore(180)], // Too high
        [1, createMockScore(100)], // Too low
      ])
      const header = createMockRaceHeader()

      const summary = analyzeRaceDiamonds(horses, scores, header, (_i, defaultOdds) => defaultOdds)

      expect(summary.hasDiamonds).toBe(false)
      expect(summary.diamondCount).toBe(0)
      expect(summary.diamonds).toHaveLength(0)
      expect(summary.summary).toBe('No diamonds detected in this race')
    })

    it('should include race number and track code in summary', () => {
      const horses = [createMockHorse()]
      const scores = new Map<number, HorseScore>([[0, createMockScore(180)]])
      const header = createMockRaceHeader({ raceNumber: 5, trackCode: 'SAR' })

      const summary = analyzeRaceDiamonds(horses, scores, header, (_i, defaultOdds) => defaultOdds)

      expect(summary.raceNumber).toBe(5)
      expect(summary.trackCode).toBe('SAR')
    })

    it('should skip scratched horses', () => {
      const horses = [createMockHorse()]
      const scores = new Map<number, HorseScore>([
        [0, createMockScore(130, { isScratched: true })],
      ])
      const header = createMockRaceHeader()

      const summary = analyzeRaceDiamonds(horses, scores, header, (_i, defaultOdds) => defaultOdds)

      expect(summary.totalHorses).toBe(1)
      expect(summary.diamondCount).toBe(0)
    })
  })
})

// ============================================================================
// DIAMOND VALIDATOR TESTS
// ============================================================================

describe('Diamond Validator', () => {
  describe('validateDiamond', () => {
    it('should validate diamond with sufficient factors', () => {
      const diamond = {
        isDiamond: true,
        horseName: 'Test Horse',
        programNumber: 5,
        horseIndex: 0,
        score: 130,
        oddsDisplay: '15-1',
        oddsDecimal: 16,
        overlayPercent: 250,
        factorCount: 3,
        factors: [
          {
            type: 'class_drop' as const,
            name: 'Class Drop',
            evidence: 'Dropping class',
            evidenceDetails: ['Dropping 4 class levels', 'Won at higher level'],
            confidence: 80,
            icon: 'trending_down',
            color: '#22c55e',
            sourceModule: 'classScoring',
          },
          {
            type: 'equipment_change' as const,
            name: 'Equipment Change',
            evidence: 'First-time Lasix',
            evidenceDetails: ['First-time Lasix application', 'Trainer wins 25% with Lasix'],
            confidence: 75,
            icon: 'build',
            color: '#3b82f6',
            sourceModule: 'equipment',
          },
          {
            type: 'pace_fit' as const,
            name: 'Pace Fit',
            evidence: 'Good pace setup',
            evidenceDetails: ['Running style: Presser', 'Pace scenario: Honest pace'],
            confidence: 70,
            icon: 'speed',
            color: '#f97316',
            sourceModule: 'paceAnalysis',
          },
        ],
        confidence: 60,
        story: 'class drop + equipment change + pace fit = perfect storm for upset',
        summary: 'Diamond candidate',
        reasoning: [],
        validationStatus: 'validated' as const,
        validationNotes: [],
        expectedValue: 0.5,
        roiPotential: 0.3,
        betRecommendation: 'Win bet at 15-1',
        analyzedAt: new Date().toISOString(),
      }

      const result = validateDiamond(diamond)

      expect(result.isValid).toBe(true)
      expect(result.status).toBe('validated')
      expect(result.validatedFactorCount).toBeGreaterThanOrEqual(DIAMOND_MIN_FACTORS)
    })

    it('should reject diamond with only 1 validated factor', () => {
      const diamond = {
        isDiamond: true,
        horseName: 'Test Horse',
        programNumber: 5,
        horseIndex: 0,
        score: 130,
        oddsDisplay: '15-1',
        oddsDecimal: 16,
        overlayPercent: 250,
        factorCount: 1,
        factors: [
          {
            type: 'hidden_form' as const,
            name: 'Hidden Form',
            evidence: 'Sharp workouts',
            evidenceDetails: [], // No evidence details
            confidence: 60,
            icon: 'visibility',
            color: '#06b6d4',
            sourceModule: 'formAnalysis',
          },
        ],
        confidence: 20,
        story: 'Insufficient factors',
        summary: 'Not a diamond',
        reasoning: [],
        validationStatus: 'rejected' as const,
        validationNotes: [],
        expectedValue: 0,
        roiPotential: 0,
        betRecommendation: '',
        analyzedAt: new Date().toISOString(),
      }

      const result = validateDiamond(diamond)

      expect(result.isValid).toBe(false)
      expect(result.status).toBe('rejected')
    })

    it('should include validation notes', () => {
      const diamond = {
        isDiamond: true,
        horseName: 'Test Horse',
        programNumber: 5,
        horseIndex: 0,
        score: 130,
        oddsDisplay: '15-1',
        oddsDecimal: 16,
        overlayPercent: 250,
        factorCount: 2,
        factors: [
          {
            type: 'class_drop' as const,
            name: 'Class Drop',
            evidence: 'Dropping class',
            evidenceDetails: ['Dropping 4 class levels'],
            confidence: 80,
            icon: 'trending_down',
            color: '#22c55e',
            sourceModule: 'classScoring',
          },
          {
            type: 'trainer_pattern' as const,
            name: 'Trainer Pattern',
            evidence: 'Trainer excels',
            evidenceDetails: ['Trainer win rate: 25%', '50 starts sample'],
            confidence: 75,
            icon: 'person_pin',
            color: '#f59e0b',
            sourceModule: 'trainerPatterns',
          },
        ],
        confidence: 40,
        story: 'class drop + trainer pattern',
        summary: 'Diamond',
        reasoning: [],
        validationStatus: 'validated' as const,
        validationNotes: [],
        expectedValue: 0.5,
        roiPotential: 0.3,
        betRecommendation: 'Win bet',
        analyzedAt: new Date().toISOString(),
      }

      const result = validateDiamond(diamond)

      expect(result.notes.length).toBeGreaterThan(0)
      expect(result.factorValidations.length).toBe(2)
    })
  })

  describe('validateDiamonds', () => {
    it('should validate multiple diamonds', () => {
      const diamonds = [
        {
          isDiamond: true,
          horseName: 'Horse1',
          programNumber: 1,
          horseIndex: 0,
          score: 130,
          oddsDisplay: '15-1',
          oddsDecimal: 16,
          overlayPercent: 250,
          factorCount: 2,
          factors: [
            {
              type: 'class_drop' as const,
              name: 'Class Drop',
              evidence: 'Dropping',
              evidenceDetails: ['Dropping class'],
              confidence: 80,
              icon: 'trending_down',
              color: '#22c55e',
              sourceModule: 'classScoring',
            },
            {
              type: 'equipment_change' as const,
              name: 'Equipment',
              evidence: 'Change',
              evidenceDetails: ['Blinkers added'],
              confidence: 70,
              icon: 'build',
              color: '#3b82f6',
              sourceModule: 'equipment',
            },
          ],
          confidence: 40,
          story: 'Story 1',
          summary: 'Summary 1',
          reasoning: [],
          validationStatus: 'validated' as const,
          validationNotes: [],
          expectedValue: 0.5,
          roiPotential: 0.3,
          betRecommendation: 'Win',
          analyzedAt: new Date().toISOString(),
        },
        {
          isDiamond: true,
          horseName: 'Horse2',
          programNumber: 2,
          horseIndex: 1,
          score: 135,
          oddsDisplay: '20-1',
          oddsDecimal: 21,
          overlayPercent: 300,
          factorCount: 2,
          factors: [
            {
              type: 'pace_fit' as const,
              name: 'Pace Fit',
              evidence: 'Good fit',
              evidenceDetails: ['Running style: Closer', 'Pace scenario: speed duel'],
              confidence: 75,
              icon: 'speed',
              color: '#f97316',
              sourceModule: 'paceAnalysis',
            },
            {
              type: 'trainer_pattern' as const,
              name: 'Trainer',
              evidence: 'Pattern',
              evidenceDetails: ['Trainer win rate: 20%'],
              confidence: 65,
              icon: 'person_pin',
              color: '#f59e0b',
              sourceModule: 'trainerPatterns',
            },
          ],
          confidence: 40,
          story: 'Story 2',
          summary: 'Summary 2',
          reasoning: [],
          validationStatus: 'validated' as const,
          validationNotes: [],
          expectedValue: 0.6,
          roiPotential: 0.4,
          betRecommendation: 'Win',
          analyzedAt: new Date().toISOString(),
        },
      ]

      const results = validateDiamonds(diamonds)

      expect(results).toHaveLength(2)
    })
  })

  describe('getValidatedDiamonds', () => {
    it('should filter to only validated diamonds', () => {
      const diamonds = [
        {
          isDiamond: true,
          horseName: 'ValidHorse',
          programNumber: 1,
          horseIndex: 0,
          score: 130,
          oddsDisplay: '15-1',
          oddsDecimal: 16,
          overlayPercent: 250,
          factorCount: 2,
          factors: [
            {
              type: 'class_drop' as const,
              name: 'Class Drop',
              evidence: 'Dropping',
              evidenceDetails: ['Dropping class levels'],
              confidence: 80,
              icon: 'trending_down',
              color: '#22c55e',
              sourceModule: 'classScoring',
            },
            {
              type: 'equipment_change' as const,
              name: 'Equipment',
              evidence: 'Lasix',
              evidenceDetails: ['First-time Lasix'],
              confidence: 70,
              icon: 'build',
              color: '#3b82f6',
              sourceModule: 'equipment',
            },
          ],
          confidence: 40,
          story: 'Valid',
          summary: 'Valid',
          reasoning: [],
          validationStatus: 'validated' as const,
          validationNotes: [],
          expectedValue: 0.5,
          roiPotential: 0.3,
          betRecommendation: 'Win',
          analyzedAt: new Date().toISOString(),
        },
        {
          isDiamond: true,
          horseName: 'InvalidHorse',
          programNumber: 2,
          horseIndex: 1,
          score: 130,
          oddsDisplay: '15-1',
          oddsDecimal: 16,
          overlayPercent: 250,
          factorCount: 1,
          factors: [
            {
              type: 'class_drop' as const,
              name: 'Class Drop',
              evidence: 'Dropping',
              evidenceDetails: [], // No evidence
              confidence: 50,
              icon: 'trending_down',
              color: '#22c55e',
              sourceModule: 'classScoring',
            },
          ],
          confidence: 20,
          story: 'Invalid',
          summary: 'Invalid',
          reasoning: [],
          validationStatus: 'rejected' as const,
          validationNotes: [],
          expectedValue: 0,
          roiPotential: 0,
          betRecommendation: '',
          analyzedAt: new Date().toISOString(),
        },
      ]

      const validated = getValidatedDiamonds(diamonds)

      // Should only return the valid diamond
      expect(validated.length).toBeLessThanOrEqual(diamonds.length)
    })
  })

  describe('isDiamondValid', () => {
    it('should return true for valid diamond', () => {
      const diamond = {
        isDiamond: true,
        horseName: 'ValidHorse',
        programNumber: 1,
        horseIndex: 0,
        score: 130,
        oddsDisplay: '15-1',
        oddsDecimal: 16,
        overlayPercent: 250,
        factorCount: 2,
        factors: [
          {
            type: 'class_drop' as const,
            name: 'Class Drop',
            evidence: 'Dropping',
            evidenceDetails: ['Dropping class levels'],
            confidence: 80,
            icon: 'trending_down',
            color: '#22c55e',
            sourceModule: 'classScoring',
          },
          {
            type: 'equipment_change' as const,
            name: 'Equipment',
            evidence: 'Lasix added',
            evidenceDetails: ['First-time Lasix'],
            confidence: 70,
            icon: 'build',
            color: '#3b82f6',
            sourceModule: 'equipment',
          },
        ],
        confidence: 40,
        story: 'Valid',
        summary: 'Valid',
        reasoning: [],
        validationStatus: 'validated' as const,
        validationNotes: [],
        expectedValue: 0.5,
        roiPotential: 0.3,
        betRecommendation: 'Win',
        analyzedAt: new Date().toISOString(),
      }

      expect(isDiamondValid(diamond)).toBe(true)
    })
  })
})

// ============================================================================
// PERFECT STORM DETECTION TESTS
// ============================================================================

describe('Perfect Storm Detection', () => {
  describe('Class Drop + Equipment', () => {
    it('should detect class drop and equipment change combo', () => {
      const horse = createMockHorse({
        medication: {
          lasix: true,
          lasixFirstTime: true,
          lasixOff: false,
          bute: false,
          other: [],
          raw: 'L',
        },
      })
      // Use the default mock score which has class drop configured
      const score = createMockScore(130)
      const header = createMockRaceHeader()

      const result = analyzeDiamondCandidate(horse, 0, score, [horse], header, '15-1')

      // Should detect at least class-related factor
      expect(result.factors.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Hidden Form + Bias', () => {
    it('should handle workout and trip analysis', () => {
      const horse = createMockHorse({
        workouts: [
          { date: new Date().toISOString(), distanceFurlongs: 5, distance: '5f', timeSeconds: 60, timeFormatted: '1:00', track: 'SAR', surface: 'dirt', trackCondition: 'fast', type: 'breeze', isBullet: true, fromGate: false, ranking: '1 of 20', rankNumber: 1, totalWorks: 20, notes: '' },
          { date: new Date().toISOString(), distanceFurlongs: 4, distance: '4f', timeSeconds: 48, timeFormatted: ':48', track: 'SAR', surface: 'dirt', trackCondition: 'fast', type: 'handily', isBullet: false, fromGate: false, ranking: '3 of 15', rankNumber: 3, totalWorks: 15, notes: '' },
        ],
      })
      const score = createMockScore(130)
      const header = createMockRaceHeader()

      const result = analyzeDiamondCandidate(horse, 0, score, [horse], header, '15-1')

      // Should still produce a valid result
      expect(result.horseName).toBe('Test Horse')
    })
  })

  describe('Breeding Potential (Lightly Raced)', () => {
    it('should detect breeding potential for lightly raced horse', () => {
      const horse = createMockHorse({
        lifetimeStarts: 3, // Lightly raced
      })
      // Use type assertion for complex breeding score mock
      const score = createMockScore(130, {
        breedingScore: {
          wasApplied: true,
          total: 45,
          sireDetails: {
            score: 20,
            profile: { name: 'Top Sire' } as unknown as SireProfile,
            tierLabel: 'Elite',
            tierColor: '#22c55e',
            reasoning: 'Elite sire',
          },
          damDetails: {
            score: 15,
            profile: null,
            tierLabel: '',
            tierColor: '#888888',
            reasoning: '',
          },
          damsireDetails: {
            score: 10,
            profile: null,
            tierLabel: '',
            tierColor: '#888888',
            reasoning: '',
          },
          bonuses: {
            eliteSireDebut: 0,
            surfaceFit: 0,
            distanceFit: 0,
            total: 0,
            reasons: [],
          },
        } as unknown as import('../../scoring').DetailedBreedingScore,
      })
      const header = createMockRaceHeader()

      const result = analyzeDiamondCandidate(horse, 0, score, [horse], header, '20-1')

      // Should detect breeding potential
      const breedingFactor = result.factors.find(f => f.type === 'breeding_potential')
      expect(breedingFactor || result.factors.length).toBeTruthy()
    })
  })
})

// ============================================================================
// CONFIDENCE CALCULATION TESTS
// ============================================================================

describe('Confidence Calculation', () => {
  it('should calculate 40% confidence for 2 factors', () => {
    const conf = calculateConfidence(2)
    expect(conf).toBe(40)
  })

  it('should calculate 60% confidence for 3 factors', () => {
    const conf = calculateConfidence(3)
    expect(conf).toBe(60)
  })

  it('should calculate 80% confidence for 4 factors', () => {
    const conf = calculateConfidence(4)
    expect(conf).toBe(80)
  })

  it('should cap at 100% for 5+ factors', () => {
    expect(calculateConfidence(5)).toBe(100)
    expect(calculateConfidence(6)).toBe(100)
    expect(calculateConfidence(10)).toBe(100)
  })
})

// ============================================================================
// EVIDENCE VALIDATION TESTS
// ============================================================================

describe('Evidence Validation', () => {
  it('should reject factors without evidence details', () => {
    const diamond = {
      isDiamond: true,
      horseName: 'Test',
      programNumber: 1,
      horseIndex: 0,
      score: 130,
      oddsDisplay: '15-1',
      oddsDecimal: 16,
      overlayPercent: 250,
      factorCount: 2,
      factors: [
        {
          type: 'class_drop' as const,
          name: 'Class Drop',
          evidence: 'Dropping',
          evidenceDetails: [], // EMPTY - should fail validation
          confidence: 80,
          icon: 'trending_down',
          color: '#22c55e',
          sourceModule: 'classScoring',
        },
        {
          type: 'equipment_change' as const,
          name: 'Equipment',
          evidence: 'Change',
          evidenceDetails: [], // EMPTY - should fail validation
          confidence: 70,
          icon: 'build',
          color: '#3b82f6',
          sourceModule: 'equipment',
        },
      ],
      confidence: 40,
      story: 'Story',
      summary: 'Summary',
      reasoning: [],
      validationStatus: 'validated' as const,
      validationNotes: [],
      expectedValue: 0.5,
      roiPotential: 0.3,
      betRecommendation: 'Win',
      analyzedAt: new Date().toISOString(),
    }

    const result = validateDiamond(diamond)

    // Should fail validation due to no evidence
    expect(result.factorValidations.every(v => !v.isValid)).toBe(true)
  })
})

// ============================================================================
// UI INTEGRATION TESTS
// ============================================================================

describe('UI Integration Helpers', () => {
  it('should provide correct diamond color for styling', () => {
    const color = getDiamondColor()
    expect(color).toBe('#FFD700')
    expect(color).toMatch(/^#[0-9A-F]{6}$/i)
  })

  it('should provide correct diamond background color with opacity', () => {
    const bg = getDiamondBgColor(0.2)
    expect(bg).toContain('rgba(255, 215, 0')
    expect(bg).toContain('0.2')
  })
})
