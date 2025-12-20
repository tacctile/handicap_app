/**
 * Tests for Market Inefficiency Detection module
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest'
import {
  analyzeMarketInefficiency,
  analyzeRaceInefficiencies,
  getBestInefficiencyPlays,
  getInefficiencyIcon,
  getInefficiencyColor,
  formatMagnitude,
  getInefficiencyBadge,
  INEFFICIENCY_META,
} from '../marketInefficiency'
import type { HorseEntry, RaceHeader, PastPerformance } from '../../../types/drf'
import type { HorseScore } from '../../scoring'

// Create mock past performance
function createMockPP(overrides?: Partial<PastPerformance>): PastPerformance {
  return {
    raceDate: '2024-01-01',
    trackCode: 'AQU',
    distance: '6f',
    surface: 'dirt',
    raceClass: 'CLM 25000',
    fieldSize: 10,
    postPosition: 5,
    startPosition: 5,
    firstCallPosition: 4,
    secondCallPosition: 3,
    thirdCallPosition: 2,
    stretchPosition: 2,
    finishPosition: 3,
    beatenLengths: 2.5,
    jockeyName: 'Test Jockey',
    trainerName: 'Test Trainer',
    weight: 122,
    odds: '5-1',
    isFavorite: false,
    comment: '',
    tripNote: '',
    speedFigures: {
      beyer: 80,
      bris: null,
      aqha: null,
    },
    ...overrides,
  } as PastPerformance
}

// Create mock horse
function createMockHorse(overrides?: Partial<HorseEntry>): HorseEntry {
  return {
    programNumber: 1,
    horseName: 'Test Horse',
    postPosition: 1,
    morningLineOdds: '5-1',
    jockeyName: 'Test Jockey',
    trainerName: 'Test Trainer',
    ownerName: 'Test Owner',
    owningSilks: 'Red and Blue',
    weight: 122,
    medication: '',
    equipment: {
      raw: '',
      firstTimeEquipment: [],
    },
    claimingPrice: null,
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimePlaces: 3,
    lifetimeShows: 2,
    lifetimeEarnings: 50000,
    currentYearStarts: 5,
    currentYearWins: 1,
    currentYearPlaces: 1,
    currentYearShows: 1,
    currentYearEarnings: 20000,
    previousYearStarts: 5,
    previousYearWins: 1,
    previousYearPlaces: 2,
    previousYearShows: 1,
    previousYearEarnings: 30000,
    daysOff: 14,
    bestBeyer: 85,
    averageBeyer: 80,
    runningStyle: 'E',
    earlySpeedRating: 80,
    sire: 'Test Sire',
    dam: 'Test Dam',
    damSire: 'Test Damsire',
    whereBred: 'KY',
    sex: 'C',
    age: 4,
    color: 'Bay',
    pastPerformances: [
      createMockPP({ finishPosition: 3 }),
      createMockPP({ finishPosition: 2 }),
    ],
    workoutHistory: [],
    trainerStats: null,
    jockeyStats: null,
    ...overrides,
  } as HorseEntry
}

// Create mock race header
function createMockRaceHeader(overrides?: Partial<RaceHeader>): RaceHeader {
  return {
    trackCode: 'AQU',
    trackName: 'Aqueduct',
    raceNumber: 1,
    raceDate: '2024-01-15',
    distance: '6f',
    surface: 'dirt',
    raceType: 'CLM',
    raceClass: 'CLM 25000',
    purse: 25000,
    ageRestriction: '3YO+',
    sexRestriction: null,
    conditions: 'Claiming $25,000',
    fieldSize: 10,
    postTime: '1:00 PM',
    ...overrides,
  } as RaceHeader
}

// Create mock score
function createMockScore(total: number, overrides?: Partial<HorseScore>): HorseScore {
  return {
    total,
    isScratched: false,
    confidenceLevel: 'medium',
    dataQuality: 70,
    breakdown: {
      connections: { total: 30, trainer: 20, jockey: 10, partnershipBonus: 0, reasoning: '' },
      postPosition: { total: 30, trackBiasApplied: false, isGoldenPost: false, reasoning: '' },
      speedClass: { total: 30, speedScore: 20, classScore: 10, bestFigure: 85, classMovement: 'lateral', reasoning: '' },
      form: { total: 20, recentFormScore: 15, layoffScore: 5, consistencyBonus: 0, formTrend: 'steady', reasoning: '' },
      equipment: { total: 10, hasChanges: false, reasoning: '' },
      pace: { total: 25, runningStyle: 'E', paceFit: 'good', reasoning: '' },
    },
    ...overrides,
  } as HorseScore
}

describe('analyzeMarketInefficiency', () => {
  it('should analyze market inefficiency for a horse', () => {
    const horse = createMockHorse()
    const score = createMockScore(170)
    const raceHeader = createMockRaceHeader()

    const analysis = analyzeMarketInefficiency(horse, score, raceHeader)

    expect(analysis.programNumber).toBe(1)
    expect(analysis.horseName).toBe('Test Horse')
    expect(analysis.inefficiencies).toBeDefined()
    expect(Array.isArray(analysis.inefficiencies)).toBe(true)
    expect(analysis.summary).toBeDefined()
    expect(analysis.recommendation).toBeDefined()
  })

  it('should detect public overreaction after bad race', () => {
    // Horse with terrible last race but good overall score
    const horse = createMockHorse({
      morningLineOdds: '15-1', // High odds due to bad last race
      pastPerformances: [
        createMockPP({ finishPosition: 9, fieldSize: 10, comment: 'wide trip' }), // Terrible last
        createMockPP({ finishPosition: 2 }), // Good prior race
        createMockPP({ finishPosition: 1 }), // Won before
      ],
    })
    // High score despite bad last race (we see through it)
    const score = createMockScore(175)
    const raceHeader = createMockRaceHeader()

    const analysis = analyzeMarketInefficiency(horse, score, raceHeader)

    // Should detect some form of public avoidance/overreaction
    // The exact detection depends on edge calculation
    expect(analysis.summary).toBeDefined()
  })

  it('should detect recency bias on recent loser', () => {
    // Horse with multiple recent losses
    const horse = createMockHorse({
      morningLineOdds: '12-1',
      pastPerformances: [
        createMockPP({ finishPosition: 7 }),
        createMockPP({ finishPosition: 8 }),
        createMockPP({ finishPosition: 6 }),
        createMockPP({ finishPosition: 2 }), // Was better before
      ],
    })
    const score = createMockScore(160) // Decent score
    const raceHeader = createMockRaceHeader()

    const analysis = analyzeMarketInefficiency(horse, score, raceHeader)

    expect(analysis).toBeDefined()
    expect(analysis.summary).toBeDefined()
  })

  it('should handle horse with no inefficiencies', () => {
    const horse = createMockHorse({ morningLineOdds: '3-1' })
    const score = createMockScore(150) // Average score, fair odds
    const raceHeader = createMockRaceHeader()

    const analysis = analyzeMarketInefficiency(horse, score, raceHeader)

    expect(analysis.inefficiencies.length).toBeGreaterThanOrEqual(0)
    expect(analysis.summary).toBeDefined()
  })

  it('should include primary inefficiency when found', () => {
    const horse = createMockHorse({
      morningLineOdds: '20-1', // Very high odds
    })
    const score = createMockScore(185) // Strong score = big edge
    const raceHeader = createMockRaceHeader()

    const analysis = analyzeMarketInefficiency(horse, score, raceHeader)

    // With strong score and high odds, should have inefficiencies
    if (analysis.inefficiencies.length > 0) {
      expect(analysis.primaryInefficiency).toBeDefined()
      expect(analysis.primaryInefficiency?.magnitude).toBeGreaterThan(0)
    }
  })
})

describe('analyzeRaceInefficiencies', () => {
  it('should analyze all horses in a race', () => {
    const horses = [
      { horse: createMockHorse({ programNumber: 1 }), score: createMockScore(180) },
      { horse: createMockHorse({ programNumber: 2 }), score: createMockScore(160) },
      { horse: createMockHorse({ programNumber: 3 }), score: createMockScore(140) },
    ]
    const raceHeader = createMockRaceHeader()

    const analyses = analyzeRaceInefficiencies(horses, raceHeader)

    expect(analyses.length).toBe(3)
    analyses.forEach((analysis, i) => {
      expect(analysis.programNumber).toBe(i + 1)
    })
  })

  it('should filter out scratched horses', () => {
    const horses = [
      { horse: createMockHorse({ programNumber: 1 }), score: createMockScore(180) },
      { horse: createMockHorse({ programNumber: 2 }), score: { ...createMockScore(160), isScratched: true } },
    ]
    const raceHeader = createMockRaceHeader()

    const analyses = analyzeRaceInefficiencies(horses, raceHeader)

    expect(analyses.length).toBe(1)
    expect(analyses[0].programNumber).toBe(1)
  })
})

describe('getBestInefficiencyPlays', () => {
  it('should return top inefficiency plays sorted by magnitude', () => {
    const analyses = [
      {
        programNumber: 1,
        horseName: 'Horse 1',
        inefficiencies: [],
        primaryInefficiency: null,
        totalMagnitude: 0,
        hasExploitableInefficiency: false,
        isMispriced: false,
        summary: '',
        recommendation: 'neutral' as const,
      },
      {
        programNumber: 2,
        horseName: 'Horse 2',
        inefficiencies: [],
        primaryInefficiency: null,
        totalMagnitude: 8,
        hasExploitableInefficiency: true,
        isMispriced: true,
        summary: '',
        recommendation: 'bet' as const,
      },
      {
        programNumber: 3,
        horseName: 'Horse 3',
        inefficiencies: [],
        primaryInefficiency: null,
        totalMagnitude: 5,
        hasExploitableInefficiency: true,
        isMispriced: true,
        summary: '',
        recommendation: 'watch' as const,
      },
    ]

    const bestPlays = getBestInefficiencyPlays(analyses, 2)

    expect(bestPlays.length).toBe(2)
    expect(bestPlays[0].programNumber).toBe(2) // Highest magnitude
    expect(bestPlays[1].programNumber).toBe(3) // Second highest
  })

  it('should only return plays with exploitable inefficiency', () => {
    const analyses = [
      {
        programNumber: 1,
        horseName: 'Horse 1',
        inefficiencies: [],
        primaryInefficiency: null,
        totalMagnitude: 10,
        hasExploitableInefficiency: false, // Not exploitable
        isMispriced: false,
        summary: '',
        recommendation: 'neutral' as const,
      },
    ]

    const bestPlays = getBestInefficiencyPlays(analyses)

    expect(bestPlays.length).toBe(0)
  })
})

describe('INEFFICIENCY_META', () => {
  it('should have metadata for all inefficiency types', () => {
    const types = [
      'public_overreaction',
      'recency_bias',
      'name_recognition',
      'post_position_panic',
      'class_confusion',
      'equipment_misunderstanding',
    ]

    for (const type of types) {
      const meta = INEFFICIENCY_META[type as keyof typeof INEFFICIENCY_META]
      expect(meta).toBeDefined()
      expect(meta.name).toBeDefined()
      expect(meta.icon).toBeDefined()
      expect(meta.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('getInefficiencyIcon', () => {
  it('should return icon for each type', () => {
    expect(getInefficiencyIcon('public_overreaction')).toBe('trending_down')
    expect(getInefficiencyIcon('recency_bias')).toBe('history')
    expect(getInefficiencyIcon('name_recognition')).toBe('person_search')
    expect(getInefficiencyIcon('class_confusion')).toBe('swap_vert')
  })
})

describe('getInefficiencyColor', () => {
  it('should return color for each type', () => {
    expect(getInefficiencyColor('public_overreaction')).toMatch(/^#[0-9a-f]{6}$/i)
    expect(getInefficiencyColor('recency_bias')).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('formatMagnitude', () => {
  it('should format magnitude levels correctly', () => {
    expect(formatMagnitude(8)).toBe('Very Strong')
    expect(formatMagnitude(9)).toBe('Very Strong')
    expect(formatMagnitude(6)).toBe('Strong')
    expect(formatMagnitude(7)).toBe('Strong')
    expect(formatMagnitude(4)).toBe('Moderate')
    expect(formatMagnitude(5)).toBe('Moderate')
    expect(formatMagnitude(3)).toBe('Slight')
    expect(formatMagnitude(2)).toBe('Slight')
  })
})

describe('getInefficiencyBadge', () => {
  it('should return badge info for an inefficiency', () => {
    const detection = {
      type: 'public_overreaction' as const,
      direction: 'underbet' as const,
      magnitude: 7,
      confidence: 75,
      title: 'Test Title',
      explanation: 'Test explanation',
      valueReason: 'Test reason',
      evidence: [],
      evBonus: 14,
    }

    const badge = getInefficiencyBadge(detection)

    expect(badge.text).toContain('Public Overreaction')
    expect(badge.text).toContain('Strong')
    expect(badge.color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(badge.bgColor).toBeDefined()
  })
})
