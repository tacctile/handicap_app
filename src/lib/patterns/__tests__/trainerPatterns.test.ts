/**
 * Trainer Patterns Tests
 *
 * Tests dynamic trainer pattern extraction and scoring:
 * - Name normalization
 * - Pattern extraction from past performances
 * - Win rate calculations
 * - Scoring thresholds
 * - Minimum sample size requirements
 */

import { describe, it, expect } from 'vitest'
import type { HorseEntry, PastPerformance, RaceHeader } from '../../../types/drf'
import {
  normalizeTrainerName,
  extractTrainerPatternsFromHorse,
  buildTrainerProfile,
  calculateTrainerPatternScore,
  MIN_STARTS_FOR_CREDIBILITY,
} from '../trainerPatterns'

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockPastPerformance(overrides: Partial<PastPerformance> = {}): PastPerformance {
  return {
    date: '2024-01-15',
    track: 'CD',
    trackName: 'Churchill Downs',
    raceNumber: 5,
    distance: '6f',
    distanceFurlongs: 6,
    surface: 'dirt',
    condition: 'fast',
    classification: 'claiming',
    purse: 25000,
    claimingPrice: 25000,
    finishPosition: 3,
    fieldSize: 8,
    odds: 5.0,
    jockey: 'Smith, J.',
    weight: 122,
    speedFigures: { beyer: 78 },
    runningLine: {
      start: 4,
      quarterMile: 3,
      halfMile: 2,
      stretch: 2,
      finish: 3,
    },
    ...overrides,
  }
}

function createMockHorse(overrides: Partial<HorseEntry> = {}): HorseEntry {
  return {
    programNumber: '1',
    horseName: 'Test Horse',
    jockeyName: 'Smith, J.',
    trainerName: 'Baffert, B.',
    morningLineOdds: '5-1',
    weight: 122,
    postPosition: 1,
    age: 4,
    sex: 'C',
    sire: 'Test Sire',
    dam: 'Test Dam',
    damSire: 'Test Damsire',
    equipment: '',
    medication: '',
    pastPerformances: [],
    ...overrides,
  }
}

function createMockRaceHeader(overrides: Partial<RaceHeader> = {}): RaceHeader {
  return {
    trackCode: 'CD',
    trackName: 'Churchill Downs',
    raceNumber: 5,
    raceDate: 'January 15, 2024',
    raceDateRaw: '2024-01-15',
    distance: '6f',
    distanceFurlongs: 6,
    surface: 'dirt',
    classification: 'claiming',
    raceType: 'CLM',
    purse: 25000,
    purseFormatted: '$25,000',
    claimingPrice: 25000,
    restrictions: '',
    ageRestriction: '3+',
    sexRestriction: '',
    ...overrides,
  }
}

// ============================================================================
// TESTS: Name Normalization
// ============================================================================

describe('normalizeTrainerName', () => {
  it('should convert to uppercase', () => {
    expect(normalizeTrainerName('Smith, John')).toBe('SMITH JOHN')
  })

  it('should remove periods and commas', () => {
    expect(normalizeTrainerName('Smith, J.')).toBe('SMITH J')
    expect(normalizeTrainerName('O\'Brien, A.')).toBe("O'BRIEN A")
  })

  it('should collapse multiple spaces', () => {
    expect(normalizeTrainerName('Smith   John')).toBe('SMITH JOHN')
  })

  it('should trim whitespace', () => {
    expect(normalizeTrainerName('  Smith John  ')).toBe('SMITH JOHN')
  })

  it('should handle empty strings', () => {
    expect(normalizeTrainerName('')).toBe('')
  })
})

// ============================================================================
// TESTS: Pattern Extraction
// ============================================================================

describe('extractTrainerPatternsFromHorse', () => {
  it('should extract overall pattern', () => {
    const horse = createMockHorse({
      pastPerformances: [
        createMockPastPerformance({ finishPosition: 1 }),
        createMockPastPerformance({ finishPosition: 2 }),
        createMockPastPerformance({ finishPosition: 3 }),
      ],
    })

    const patterns = extractTrainerPatternsFromHorse(horse)
    const overall = patterns.get('overall')

    expect(overall).toBeDefined()
    expect(overall!.wins).toBe(1)
    expect(overall!.starts).toBe(3)
    expect(overall!.places).toBe(1)
    expect(overall!.shows).toBe(1)
    expect(overall!.winRate).toBeCloseTo(33.33, 1)
    expect(overall!.itmRate).toBe(100)
  })

  it('should extract track-specific patterns', () => {
    const horse = createMockHorse({
      pastPerformances: [
        createMockPastPerformance({ track: 'CD', finishPosition: 1 }),
        createMockPastPerformance({ track: 'CD', finishPosition: 1 }),
        createMockPastPerformance({ track: 'SA', finishPosition: 4 }),
      ],
    })

    const patterns = extractTrainerPatternsFromHorse(horse)
    const cdPattern = patterns.get('track:CD')
    const saPattern = patterns.get('track:SA')

    expect(cdPattern).toBeDefined()
    expect(cdPattern!.wins).toBe(2)
    expect(cdPattern!.starts).toBe(2)
    expect(cdPattern!.winRate).toBe(100)

    expect(saPattern).toBeDefined()
    expect(saPattern!.wins).toBe(0)
    expect(saPattern!.starts).toBe(1)
  })

  it('should extract surface patterns', () => {
    const horse = createMockHorse({
      pastPerformances: [
        createMockPastPerformance({ surface: 'dirt', finishPosition: 1 }),
        createMockPastPerformance({ surface: 'turf', finishPosition: 5 }),
      ],
    })

    const patterns = extractTrainerPatternsFromHorse(horse)
    const dirtPattern = patterns.get('surface:dirt')
    const turfPattern = patterns.get('surface:turf')

    expect(dirtPattern).toBeDefined()
    expect(dirtPattern!.wins).toBe(1)
    expect(dirtPattern!.winRate).toBe(100)

    expect(turfPattern).toBeDefined()
    expect(turfPattern!.wins).toBe(0)
  })

  it('should extract distance category patterns', () => {
    const horse = createMockHorse({
      pastPerformances: [
        createMockPastPerformance({ distanceFurlongs: 6, finishPosition: 1 }),
        createMockPastPerformance({ distanceFurlongs: 10, finishPosition: 3 }),
      ],
    })

    const patterns = extractTrainerPatternsFromHorse(horse)
    const sprintPattern = patterns.get('dist:sprint')
    const routePattern = patterns.get('dist:route')

    expect(sprintPattern).toBeDefined()
    expect(sprintPattern!.wins).toBe(1)
    expect(sprintPattern!.description).toContain('sprint')

    expect(routePattern).toBeDefined()
    expect(routePattern!.wins).toBe(0)
    expect(routePattern!.description).toContain('route')
  })

  it('should extract combined patterns', () => {
    const horse = createMockHorse({
      pastPerformances: [
        createMockPastPerformance({
          track: 'CD',
          surface: 'turf',
          distanceFurlongs: 10,
          finishPosition: 1,
        }),
      ],
    })

    const patterns = extractTrainerPatternsFromHorse(horse)
    const comboPattern = patterns.get('combo:CD:turf:route')

    expect(comboPattern).toBeDefined()
    expect(comboPattern!.wins).toBe(1)
    expect(comboPattern!.description).toContain('turf')
    // Description uses full track name when available
    expect(comboPattern!.description).toContain('Churchill Downs')
  })

  it('should handle empty past performances', () => {
    const horse = createMockHorse({ pastPerformances: [] })
    const patterns = extractTrainerPatternsFromHorse(horse)

    expect(patterns.size).toBe(1) // Just overall
    const overall = patterns.get('overall')
    expect(overall!.starts).toBe(0)
  })
})

// ============================================================================
// TESTS: Trainer Profile Building
// ============================================================================

describe('buildTrainerProfile', () => {
  it('should build profile from multiple horses', () => {
    const horses = [
      createMockHorse({
        trainerName: 'Baffert, B.',
        pastPerformances: [
          createMockPastPerformance({ finishPosition: 1 }),
          createMockPastPerformance({ finishPosition: 1 }),
        ],
      }),
      createMockHorse({
        trainerName: 'Baffert, B.',
        pastPerformances: [
          createMockPastPerformance({ finishPosition: 2 }),
        ],
      }),
      createMockHorse({
        trainerName: 'Pletcher, T.', // Different trainer
        pastPerformances: [
          createMockPastPerformance({ finishPosition: 1 }),
        ],
      }),
    ]

    const profile = buildTrainerProfile('Baffert, B.', horses)

    expect(profile.trainerName).toBe('BAFFERT B')
    expect(profile.overall.wins).toBe(2)
    expect(profile.overall.starts).toBe(3)
    expect(profile.overall.winRate).toBeCloseTo(66.67, 1)
  })

  it('should identify best pattern with credible sample', () => {
    const pps: PastPerformance[] = []
    // Create 20 PPs at CD with 5 wins (25% win rate)
    for (let i = 0; i < 20; i++) {
      pps.push(createMockPastPerformance({
        track: 'CD',
        finishPosition: i < 5 ? 1 : 4,
      }))
    }

    const horse = createMockHorse({
      trainerName: 'Test Trainer',
      pastPerformances: pps,
    })

    const profile = buildTrainerProfile('Test Trainer', [horse])

    expect(profile.bestPattern).toBeDefined()
    expect(profile.bestPattern!.starts).toBeGreaterThanOrEqual(MIN_STARTS_FOR_CREDIBILITY)
  })

  it('should return null bestPattern when no credible patterns', () => {
    const horse = createMockHorse({
      trainerName: 'Test Trainer',
      pastPerformances: [
        createMockPastPerformance({ finishPosition: 1 }),
        createMockPastPerformance({ finishPosition: 1 }),
      ],
    })

    const profile = buildTrainerProfile('Test Trainer', [horse])

    expect(profile.bestPattern).toBeNull()
    expect(profile.overall.starts).toBe(2)
  })
})

// ============================================================================
// TESTS: Scoring
// ============================================================================

describe('calculateTrainerPatternScore', () => {
  it('should score elite trainer (25%+ win rate, 15+ starts)', () => {
    const pps: PastPerformance[] = []
    // 5 wins in 18 starts = 27.8% win rate
    for (let i = 0; i < 18; i++) {
      pps.push(createMockPastPerformance({
        track: 'CD',
        finishPosition: i < 5 ? 1 : 4,
      }))
    }

    const horse = createMockHorse({
      trainerName: 'Elite Trainer',
      pastPerformances: pps,
    })
    const header = createMockRaceHeader({ trackCode: 'CD' })

    const result = calculateTrainerPatternScore(horse, header, [horse])

    expect(result.score).toBe(35) // Elite score
    expect(result.profile.tier).toBe('elite')
  })

  it('should score strong trainer (20-24% win rate)', () => {
    const pps: PastPerformance[] = []
    // 4 wins in 18 starts = 22.2% win rate
    for (let i = 0; i < 18; i++) {
      pps.push(createMockPastPerformance({
        track: 'CD',
        finishPosition: i < 4 ? 1 : 4,
      }))
    }

    const horse = createMockHorse({
      trainerName: 'Strong Trainer',
      pastPerformances: pps,
    })
    const header = createMockRaceHeader({ trackCode: 'CD' })

    const result = calculateTrainerPatternScore(horse, header, [horse])

    expect(result.score).toBe(28) // Strong score
    expect(result.profile.tier).toBe('strong')
  })

  it('should return default score with insufficient data', () => {
    const horse = createMockHorse({
      trainerName: 'Unknown Trainer',
      pastPerformances: [
        createMockPastPerformance({ finishPosition: 1 }),
      ],
    })
    const header = createMockRaceHeader()

    const result = calculateTrainerPatternScore(horse, header, [horse])

    expect(result.score).toBe(10) // Default score
    expect(result.relevantPattern).toBeNull()
  })

  it('should prefer track-specific pattern when available', () => {
    const pps: PastPerformance[] = []
    // 8 wins at CD in 20 starts = 40% win rate at CD
    for (let i = 0; i < 20; i++) {
      pps.push(createMockPastPerformance({
        track: 'CD',
        finishPosition: i < 8 ? 1 : 4,
      }))
    }
    // 0 wins at other tracks
    for (let i = 0; i < 10; i++) {
      pps.push(createMockPastPerformance({
        track: 'SA',
        finishPosition: 5,
      }))
    }

    const horse = createMockHorse({
      trainerName: 'CD Specialist',
      pastPerformances: pps,
    })
    const header = createMockRaceHeader({ trackCode: 'CD' })

    const result = calculateTrainerPatternScore(horse, header, [horse])

    expect(result.relevantPattern).toBeDefined()
    expect(result.relevantPattern!.context.trackCode).toBe('CD')
    expect(result.relevantPattern!.winRate).toBeCloseTo(40, 0)
  })

  it('should include evidence strings', () => {
    const pps: PastPerformance[] = []
    for (let i = 0; i < 20; i++) {
      pps.push(createMockPastPerformance({
        track: 'CD',
        finishPosition: i < 4 ? 1 : 4,
      }))
    }

    const horse = createMockHorse({
      trainerName: 'Evidence Trainer',
      pastPerformances: pps,
    })
    const header = createMockRaceHeader({ trackCode: 'CD' })

    const result = calculateTrainerPatternScore(horse, header, [horse])

    expect(result.evidence.length).toBeGreaterThan(0)
    expect(result.evidence[0]).toContain('20%')
    expect(result.evidence[0]).toContain('20 starts')
  })
})

// ============================================================================
// TESTS: Minimum Sample Size
// ============================================================================

describe('Minimum sample size requirements', () => {
  it('should respect MIN_STARTS_FOR_CREDIBILITY constant', () => {
    expect(MIN_STARTS_FOR_CREDIBILITY).toBe(15)
  })

  it('should not give elite score with fewer than 15 starts', () => {
    const pps: PastPerformance[] = []
    // 4 wins in 10 starts = 40% win rate (elite level)
    for (let i = 0; i < 10; i++) {
      pps.push(createMockPastPerformance({
        track: 'CD',
        finishPosition: i < 4 ? 1 : 4,
      }))
    }

    const horse = createMockHorse({
      trainerName: 'Small Sample Trainer',
      pastPerformances: pps,
    })
    const header = createMockRaceHeader({ trackCode: 'CD' })

    const result = calculateTrainerPatternScore(horse, header, [horse])

    // Should not get elite 35 pts despite high win rate
    expect(result.score).toBe(10) // Default score
    expect(result.profile.tier).toBe('average')
  })
})
