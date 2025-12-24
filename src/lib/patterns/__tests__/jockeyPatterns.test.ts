/**
 * Jockey Patterns Tests
 *
 * Tests dynamic jockey pattern extraction and scoring:
 * - Name normalization
 * - Running style detection
 * - Pattern extraction from past performances
 * - Win rate calculations
 * - Scoring thresholds
 * - Minimum sample size requirements
 */

import { describe, it, expect } from 'vitest';
import type {
  HorseEntry,
  PastPerformance,
  RaceHeader,
  SpeedFigures,
  RunningLine,
  Equipment,
  Medication,
  Breeding,
} from '../../../types/drf';
import {
  normalizeJockeyName,
  determineRunningStyle,
  extractJockeyPatternsFromHorses,
  buildJockeyProfile,
  calculateJockeyPatternScore,
  getRunningStyleLabel,
  MIN_JOCKEY_STARTS_FOR_CREDIBILITY,
} from '../jockeyPatterns';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockSpeedFigures(beyer: number | null = 78): SpeedFigures {
  return {
    beyer,
    timeformUS: null,
    equibase: null,
    trackVariant: null,
    dirtVariant: null,
    turfVariant: null,
  };
}

function createMockRunningLine(overrides: Partial<RunningLine> = {}): RunningLine {
  return {
    start: 4,
    quarterMile: 3,
    quarterMileLengths: 2,
    halfMile: 2,
    halfMileLengths: 1.5,
    threeQuarters: null,
    threeQuartersLengths: null,
    stretch: 2,
    stretchLengths: 1,
    finish: 3,
    finishLengths: 2,
    ...overrides,
  };
}

function createMockEquipment(): Equipment {
  return {
    blinkers: false,
    blinkersOff: false,
    frontBandages: false,
    rearBandages: false,
    barShoes: false,
    mudCaulks: false,
    tongueTie: false,
    nasalStrip: false,
    shadowRoll: false,
    cheekPieces: false,
    firstTimeEquipment: [],
    equipmentChanges: [],
    raw: '',
  };
}

function createMockMedication(): Medication {
  return {
    lasixFirstTime: false,
    lasix: false,
    lasixOff: false,
    bute: false,
    other: [],
    raw: '',
  };
}

function createMockBreeding(): Breeding {
  return {
    sire: 'Test Sire',
    sireOfSire: 'Test Sire of Sire',
    dam: 'Test Dam',
    damSire: 'Test Damsire',
    breeder: 'Test Breeder',
    whereBred: 'KY',
    studFee: null,
  };
}

function createMockPastPerformance(overrides: Partial<PastPerformance> = {}): PastPerformance {
  return {
    date: '2024-01-15',
    track: 'CD',
    trackName: 'Churchill Downs',
    raceNumber: 5,
    distance: '6f',
    distanceFurlongs: 6,
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'claiming',
    purse: 25000,
    claimingPrice: 25000,
    finishPosition: 3,
    fieldSize: 8,
    odds: 5.0,
    jockey: 'Smith, J.',
    weight: 122,
    apprenticeAllowance: 0,
    speedFigures: createMockSpeedFigures(),
    runningLine: createMockRunningLine(),
    lengthsBehind: 2,
    lengthsAhead: null,
    finalTime: 70.5,
    finalTimeFormatted: '1:10.50',
    winner: 'Winner Horse',
    secondPlace: 'Second Horse',
    thirdPlace: 'Third Horse',
    tripComment: '',
    comment: '',
    favoriteRank: null,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: null,
    equipment: '',
    medication: '',
    ...overrides,
  };
}

function createMockHorse(overrides: Partial<HorseEntry> = {}): HorseEntry {
  return {
    programNumber: 1,
    entryIndicator: '',
    horseName: 'Test Horse',
    jockeyName: 'Smith, J.',
    trainerName: 'Baffert, B.',
    morningLineOdds: '5-1',
    morningLineDecimal: 5.0,
    currentOdds: null,
    weight: 122,
    apprenticeAllowance: 0,
    postPosition: 1,
    age: 4,
    sex: 'c',
    sexFull: 'Colt',
    color: 'Bay',
    breeding: createMockBreeding(),
    owner: 'Test Owner',
    silks: 'Red and White',
    trainerStats: '',
    trainerMeetStarts: 0,
    trainerMeetWins: 0,
    trainerMeetPlaces: 0,
    trainerMeetShows: 0,
    jockeyStats: '',
    jockeyMeetStarts: 0,
    jockeyMeetWins: 0,
    jockeyMeetPlaces: 0,
    jockeyMeetShows: 0,
    equipment: createMockEquipment(),
    medication: createMockMedication(),
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimePlaces: 3,
    lifetimeShows: 2,
    lifetimeEarnings: 100000,
    currentYearStarts: 5,
    currentYearWins: 1,
    currentYearPlaces: 1,
    currentYearShows: 1,
    currentYearEarnings: 50000,
    previousYearStarts: 5,
    previousYearWins: 1,
    previousYearPlaces: 2,
    previousYearShows: 1,
    previousYearEarnings: 50000,
    trackStarts: 3,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 1,
    surfaceStarts: 8,
    surfaceWins: 2,
    distanceStarts: 5,
    distanceWins: 1,
    distancePlaces: 1,
    distanceShows: 1,
    turfStarts: 2,
    turfWins: 0,
    turfPlaces: 0,
    turfShows: 1,
    wetStarts: 1,
    wetWins: 0,
    wetPlaces: 0,
    wetShows: 0,
    daysSinceLastRace: 30,
    lastRaceDate: '2023-12-15',
    averageBeyer: 78,
    bestBeyer: 85,
    lastBeyer: 78,
    earlySpeedRating: 75,
    runningStyle: 'E',
    pedigreeRating: null,
    claimingPrice: null,
    lastClaimPrice: null,
    trainerAngle: null,
    workouts: [],
    pastPerformances: [],
    isScratched: false,
    scratchReason: null,
    isCoupledMain: false,
    coupledWith: [],
    rawLine: '',
    ...overrides,
  };
}

function createMockRaceHeader(overrides: Partial<RaceHeader> = {}): RaceHeader {
  return {
    trackCode: 'CD',
    trackName: 'Churchill Downs',
    trackLocation: 'Louisville, KY',
    raceNumber: 5,
    raceDate: 'January 15, 2024',
    raceDateRaw: '2024-01-15',
    postTime: '2:00 PM',
    distance: '6f',
    distanceExact: '6 furlongs',
    distanceFurlongs: 6,
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'claiming',
    raceType: 'CLM',
    purse: 25000,
    purseFormatted: '$25,000',
    claimingPriceMin: 25000,
    claimingPriceMax: 25000,
    allowedWeight: null,
    ageRestriction: '3+',
    sexRestriction: '',
    weightConditions: '',
    stateBred: null,
    conditions: '',
    raceName: null,
    grade: null,
    isListed: false,
    isAbout: false,
    tempRail: null,
    turfCourseType: null,
    chuteStart: false,
    hasReplay: false,
    programNumber: 5,
    fieldSize: 8,
    probableFavorite: null,
    ...overrides,
  };
}

// ============================================================================
// TESTS: Name Normalization
// ============================================================================

describe('normalizeJockeyName', () => {
  it('should convert to uppercase', () => {
    expect(normalizeJockeyName('Smith, John')).toBe('SMITH JOHN');
  });

  it('should remove periods and commas', () => {
    expect(normalizeJockeyName('Smith, J.')).toBe('SMITH J');
  });

  it('should handle first and last name formats', () => {
    expect(normalizeJockeyName('John Smith')).toBe('JOHN SMITH');
    expect(normalizeJockeyName('J. Smith')).toBe('J SMITH');
  });

  it('should trim whitespace', () => {
    expect(normalizeJockeyName('  Smith John  ')).toBe('SMITH JOHN');
  });
});

// ============================================================================
// TESTS: Running Style Detection
// ============================================================================

describe('determineRunningStyle', () => {
  it('should detect Early (E) style when leading at first call', () => {
    const pp = createMockPastPerformance({
      runningLine: createMockRunningLine({
        start: 1,
        quarterMile: 1,
        halfMile: 2,
        stretch: 2,
        finish: 2,
      }),
    });

    expect(determineRunningStyle(pp)).toBe('E');
  });

  it('should detect Early/Presser (E/P) style', () => {
    const pp = createMockPastPerformance({
      runningLine: createMockRunningLine({
        start: 3,
        quarterMile: 3,
        halfMile: 2,
        stretch: 1,
        finish: 1,
      }),
    });

    expect(determineRunningStyle(pp)).toBe('E/P');
  });

  it('should detect Presser (P) style', () => {
    const pp = createMockPastPerformance({
      runningLine: createMockRunningLine({
        start: 6,
        quarterMile: 6,
        halfMile: 4,
        stretch: 2,
        finish: 1,
      }),
    });

    expect(determineRunningStyle(pp)).toBe('P');
  });

  it('should detect Closer (C) style', () => {
    const pp = createMockPastPerformance({
      runningLine: createMockRunningLine({
        start: 10,
        quarterMile: 10,
        halfMile: 8,
        stretch: 4,
        finish: 2,
      }),
      finishPosition: 2,
    });

    expect(determineRunningStyle(pp)).toBe('C');
  });

  it('should return unknown when no running line', () => {
    const pp = createMockPastPerformance();
    // Override runningLine to be undefined
    const ppWithNoRunningLine = { ...pp, runningLine: undefined as unknown as RunningLine };

    expect(determineRunningStyle(ppWithNoRunningLine)).toBe('unknown');
  });
});

describe('getRunningStyleLabel', () => {
  it('should return correct labels', () => {
    expect(getRunningStyleLabel('E')).toBe('on speed horses');
    expect(getRunningStyleLabel('E/P')).toBe('on early speed');
    expect(getRunningStyleLabel('P')).toBe('on pressers');
    expect(getRunningStyleLabel('C')).toBe('on closers');
    expect(getRunningStyleLabel('S')).toBe('on sustained runners');
    expect(getRunningStyleLabel('unknown')).toBe('');
  });
});

// ============================================================================
// TESTS: Pattern Extraction
// ============================================================================

describe('extractJockeyPatternsFromHorses', () => {
  it('should extract jockey patterns from past performances', () => {
    const horses = [
      createMockHorse({
        pastPerformances: [
          createMockPastPerformance({ jockey: 'Smith, J.', finishPosition: 1 }),
          createMockPastPerformance({ jockey: 'Smith, J.', finishPosition: 2 }),
          createMockPastPerformance({ jockey: 'Jones, M.', finishPosition: 1 }),
        ],
      }),
    ];

    const profiles = extractJockeyPatternsFromHorses(horses);

    expect(profiles.size).toBe(2);

    const smithProfile = profiles.get('SMITH J');
    expect(smithProfile).toBeDefined();
    expect(smithProfile!.overall.wins).toBe(1);
    expect(smithProfile!.overall.starts).toBe(2);

    const jonesProfile = profiles.get('JONES M');
    expect(jonesProfile).toBeDefined();
    expect(jonesProfile!.overall.wins).toBe(1);
    expect(jonesProfile!.overall.starts).toBe(1);
  });

  it('should extract track-specific patterns', () => {
    const horses = [
      createMockHorse({
        pastPerformances: [
          createMockPastPerformance({ jockey: 'Smith, J.', track: 'CD', finishPosition: 1 }),
          createMockPastPerformance({ jockey: 'Smith, J.', track: 'CD', finishPosition: 1 }),
          createMockPastPerformance({ jockey: 'Smith, J.', track: 'SA', finishPosition: 4 }),
        ],
      }),
    ];

    const profiles = extractJockeyPatternsFromHorses(horses);
    const smithProfile = profiles.get('SMITH J')!;

    const cdPattern = smithProfile.byTrack.get('CD');
    expect(cdPattern).toBeDefined();
    expect(cdPattern!.wins).toBe(2);
    expect(cdPattern!.winRate).toBe(100);

    const saPattern = smithProfile.byTrack.get('SA');
    expect(saPattern).toBeDefined();
    expect(saPattern!.wins).toBe(0);
  });

  it('should extract surface patterns', () => {
    const horses = [
      createMockHorse({
        pastPerformances: [
          createMockPastPerformance({ jockey: 'Smith, J.', surface: 'dirt', finishPosition: 1 }),
          createMockPastPerformance({ jockey: 'Smith, J.', surface: 'turf', finishPosition: 5 }),
        ],
      }),
    ];

    const profiles = extractJockeyPatternsFromHorses(horses);
    const smithProfile = profiles.get('SMITH J')!;

    const dirtPattern = smithProfile.bySurface.get('dirt');
    expect(dirtPattern!.wins).toBe(1);

    const turfPattern = smithProfile.bySurface.get('turf');
    expect(turfPattern!.wins).toBe(0);
  });

  it('should extract running style patterns', () => {
    const horses = [
      createMockHorse({
        pastPerformances: [
          createMockPastPerformance({
            jockey: 'Speed Jockey',
            finishPosition: 1,
            runningLine: createMockRunningLine({
              start: 1,
              quarterMile: 1,
              halfMile: 1,
              stretch: 1,
              finish: 1,
            }),
          }),
          createMockPastPerformance({
            jockey: 'Speed Jockey',
            finishPosition: 1,
            runningLine: createMockRunningLine({
              start: 1,
              quarterMile: 2,
              halfMile: 1,
              stretch: 1,
              finish: 1,
            }),
          }),
        ],
      }),
    ];

    const profiles = extractJockeyPatternsFromHorses(horses);
    const profile = profiles.get('SPEED JOCKEY')!;

    expect(profile.byRunningStyle.has('E')).toBe(true);
    const earlyPattern = profile.byRunningStyle.get('E')!;
    expect(earlyPattern.wins).toBe(2);
  });
});

// ============================================================================
// TESTS: Jockey Profile Building
// ============================================================================

describe('buildJockeyProfile', () => {
  it('should build profile for specific jockey', () => {
    const horses = [
      createMockHorse({
        pastPerformances: [
          createMockPastPerformance({ jockey: 'Smith, J.', finishPosition: 1 }),
          createMockPastPerformance({ jockey: 'Smith, J.', finishPosition: 1 }),
          createMockPastPerformance({ jockey: 'Smith, J.', finishPosition: 3 }),
        ],
      }),
    ];

    const profile = buildJockeyProfile('Smith, J.', horses);

    expect(profile.jockeyName).toBe('SMITH J');
    expect(profile.overall.wins).toBe(2);
    expect(profile.overall.starts).toBe(3);
    expect(profile.overall.winRate).toBeCloseTo(66.67, 1);
  });

  it('should return empty profile for unknown jockey', () => {
    const horses = [
      createMockHorse({
        pastPerformances: [createMockPastPerformance({ jockey: 'Smith, J.', finishPosition: 1 })],
      }),
    ];

    const profile = buildJockeyProfile('Unknown Jockey', horses);

    expect(profile.overall.starts).toBe(0);
    expect(profile.bestPattern).toBeNull();
  });

  it('should identify best pattern with credible sample', () => {
    const pps: PastPerformance[] = [];
    // Create 25 PPs with 5 wins (20% win rate)
    for (let i = 0; i < 25; i++) {
      pps.push(
        createMockPastPerformance({
          jockey: 'Credible Jockey',
          track: 'CD',
          finishPosition: i < 5 ? 1 : 4,
        })
      );
    }

    const horses = [createMockHorse({ pastPerformances: pps })];
    const profile = buildJockeyProfile('Credible Jockey', horses);

    expect(profile.bestPattern).toBeDefined();
    expect(profile.bestPattern!.starts).toBeGreaterThanOrEqual(MIN_JOCKEY_STARTS_FOR_CREDIBILITY);
  });
});

// ============================================================================
// TESTS: Scoring
// ============================================================================

describe('calculateJockeyPatternScore', () => {
  it('should score elite jockey (20%+ win rate, 20+ starts)', () => {
    const pps: PastPerformance[] = [];
    // 5 wins in 20 starts = 25% win rate
    for (let i = 0; i < 20; i++) {
      pps.push(
        createMockPastPerformance({
          jockey: 'Smith, J.',
          track: 'CD',
          finishPosition: i < 5 ? 1 : 4,
        })
      );
    }

    const horse = createMockHorse({
      jockeyName: 'Smith, J.',
      pastPerformances: pps,
    });
    const header = createMockRaceHeader({ trackCode: 'CD' });

    const result = calculateJockeyPatternScore(horse, header, [horse]);

    expect(result.score).toBe(15); // Elite jockey score
    expect(result.profile.tier).toBe('elite');
  });

  it('should score strong jockey (15-19% win rate)', () => {
    const pps: PastPerformance[] = [];
    // 4 wins in 24 starts = 16.7% win rate
    for (let i = 0; i < 24; i++) {
      pps.push(
        createMockPastPerformance({
          jockey: 'Smith, J.',
          track: 'CD',
          finishPosition: i < 4 ? 1 : 4,
        })
      );
    }

    const horse = createMockHorse({
      jockeyName: 'Smith, J.',
      pastPerformances: pps,
    });
    const header = createMockRaceHeader({ trackCode: 'CD' });

    const result = calculateJockeyPatternScore(horse, header, [horse]);

    expect(result.score).toBe(12); // Strong jockey score
    expect(result.profile.tier).toBe('strong');
  });

  it('should score average jockey (10-14% win rate)', () => {
    const pps: PastPerformance[] = [];
    // 3 wins in 24 starts = 12.5% win rate
    for (let i = 0; i < 24; i++) {
      pps.push(
        createMockPastPerformance({
          jockey: 'Smith, J.',
          track: 'CD',
          finishPosition: i < 3 ? 1 : 4,
        })
      );
    }

    const horse = createMockHorse({
      jockeyName: 'Smith, J.',
      pastPerformances: pps,
    });
    const header = createMockRaceHeader({ trackCode: 'CD' });

    const result = calculateJockeyPatternScore(horse, header, [horse]);

    expect(result.score).toBe(8); // Average jockey score
    expect(result.profile.tier).toBe('average');
  });

  it('should return default score with insufficient data', () => {
    const horse = createMockHorse({
      jockeyName: 'Unknown Jockey',
      pastPerformances: [
        createMockPastPerformance({ jockey: 'Unknown Jockey', finishPosition: 1 }),
      ],
    });
    const header = createMockRaceHeader();

    const result = calculateJockeyPatternScore(horse, header, [horse]);

    expect(result.score).toBe(7); // Default jockey score
    expect(result.relevantPattern).toBeNull();
  });

  it('should prefer track-specific pattern when available', () => {
    const pps: PastPerformance[] = [];
    // 10 wins at CD in 25 starts = 40% win rate at CD
    for (let i = 0; i < 25; i++) {
      pps.push(
        createMockPastPerformance({
          jockey: 'CD Specialist',
          track: 'CD',
          finishPosition: i < 10 ? 1 : 4,
        })
      );
    }
    // 0 wins elsewhere
    for (let i = 0; i < 15; i++) {
      pps.push(
        createMockPastPerformance({
          jockey: 'CD Specialist',
          track: 'SA',
          finishPosition: 5,
        })
      );
    }

    const horse = createMockHorse({
      jockeyName: 'CD Specialist',
      pastPerformances: pps,
    });
    const header = createMockRaceHeader({ trackCode: 'CD' });

    const result = calculateJockeyPatternScore(horse, header, [horse]);

    expect(result.relevantPattern).toBeDefined();
    expect(result.relevantPattern!.context.trackCode).toBe('CD');
    expect(result.relevantPattern!.winRate).toBeCloseTo(40, 0);
  });
});

// ============================================================================
// TESTS: Minimum Sample Size
// ============================================================================

describe('Minimum sample size requirements for jockeys', () => {
  it('should respect MIN_JOCKEY_STARTS_FOR_CREDIBILITY constant', () => {
    expect(MIN_JOCKEY_STARTS_FOR_CREDIBILITY).toBe(20);
  });

  it('should not give elite score with fewer than 20 starts', () => {
    const pps: PastPerformance[] = [];
    // 4 wins in 15 starts = 26.7% win rate (elite level)
    for (let i = 0; i < 15; i++) {
      pps.push(
        createMockPastPerformance({
          jockey: 'Small Sample Jockey',
          track: 'CD',
          finishPosition: i < 4 ? 1 : 4,
        })
      );
    }

    const horse = createMockHorse({
      jockeyName: 'Small Sample Jockey',
      pastPerformances: pps,
    });
    const header = createMockRaceHeader({ trackCode: 'CD' });

    const result = calculateJockeyPatternScore(horse, header, [horse]);

    // Should not get elite 15 pts despite high win rate
    expect(result.score).toBe(7); // Default score
    expect(result.profile.tier).toBe('average');
  });
});

// ============================================================================
// TESTS: Edge Cases
// ============================================================================

describe('Edge cases', () => {
  it('should handle jockey with no past performances', () => {
    const horse = createMockHorse({
      jockeyName: 'New Jockey',
      pastPerformances: [],
    });
    const header = createMockRaceHeader();

    const result = calculateJockeyPatternScore(horse, header, [horse]);

    expect(result.score).toBe(7); // Default
    expect(result.reasoning).toContain('Limited data');
  });

  it('should handle horse with different jockey in each PP', () => {
    const horse = createMockHorse({
      jockeyName: 'Current Jockey',
      pastPerformances: [
        createMockPastPerformance({ jockey: 'Jockey A', finishPosition: 1 }),
        createMockPastPerformance({ jockey: 'Jockey B', finishPosition: 2 }),
        createMockPastPerformance({ jockey: 'Jockey C', finishPosition: 3 }),
      ],
    });

    const profiles = extractJockeyPatternsFromHorses([horse]);

    expect(profiles.has('JOCKEY A')).toBe(true);
    expect(profiles.has('JOCKEY B')).toBe(true);
    expect(profiles.has('JOCKEY C')).toBe(true);
    expect(profiles.has('CURRENT JOCKEY')).toBe(false); // Not in PPs
  });
});
