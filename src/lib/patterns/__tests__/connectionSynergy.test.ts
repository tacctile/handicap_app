/**
 * Connection Synergy Tests
 *
 * Tests trainer-jockey partnership detection and bonus scoring:
 * - Partnership detection
 * - Win rate calculations
 * - Recent form analysis (hot combos)
 * - Bonus point calculations
 */

import { describe, it, expect } from 'vitest';
import type {
  HorseEntry,
  PastPerformance,
  SpeedFigures,
  RunningLine,
  Equipment,
  Medication,
  Breeding,
} from '../../../types/drf';
import {
  buildPartnershipDatabase,
  getPartnershipStats,
  calculateSynergyBonus,
  getConnectionSynergy,
  hasSignificantPartnership,
} from '../connectionSynergy';

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
    jockeyStats: '',
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
    turfStarts: 2,
    turfWins: 0,
    wetStarts: 1,
    wetWins: 0,
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

// ============================================================================
// TESTS: Partnership Database Building
// ============================================================================

describe('buildPartnershipDatabase', () => {
  it('should build partnership database from horses', () => {
    const horses = [
      createMockHorse({
        trainerName: 'Baffert, B.',
        pastPerformances: [
          createMockPastPerformance({ jockey: 'Smith, J.', finishPosition: 1 }),
          createMockPastPerformance({ jockey: 'Smith, J.', finishPosition: 2 }),
          createMockPastPerformance({ jockey: 'Jones, M.', finishPosition: 1 }),
        ],
      }),
    ];

    const db = buildPartnershipDatabase(horses);

    expect(db.partnerships.size).toBeGreaterThan(0);
  });

  it('should track partnership statistics correctly', () => {
    const horses = [
      createMockHorse({
        trainerName: 'Test Trainer',
        pastPerformances: [
          createMockPastPerformance({ jockey: 'Test Jockey', finishPosition: 1 }),
          createMockPastPerformance({ jockey: 'Test Jockey', finishPosition: 2 }),
          createMockPastPerformance({ jockey: 'Test Jockey', finishPosition: 1 }),
        ],
      }),
    ];

    const db = buildPartnershipDatabase(horses);
    const stats = getPartnershipStats('Test Trainer', 'Test Jockey', db);

    expect(stats).toBeDefined();
    expect(stats!.wins).toBe(2);
    expect(stats!.starts).toBe(3);
    expect(stats!.winRate).toBeCloseTo(66.67, 1);
  });

  it('should build lookup maps by trainer and jockey', () => {
    const horses = [
      createMockHorse({
        trainerName: 'Trainer A',
        pastPerformances: [
          createMockPastPerformance({ jockey: 'Jockey 1', finishPosition: 1 }),
          createMockPastPerformance({ jockey: 'Jockey 2', finishPosition: 2 }),
        ],
      }),
    ];

    const db = buildPartnershipDatabase(horses);

    expect(db.byTrainer.has('TRAINER A')).toBe(true);
    expect(db.byJockey.has('JOCKEY 1')).toBe(true);
    expect(db.byJockey.has('JOCKEY 2')).toBe(true);
  });

  it('should track recent wins for hot combo detection', () => {
    const horses = [
      createMockHorse({
        trainerName: 'Hot Trainer',
        pastPerformances: [
          createMockPastPerformance({
            jockey: 'Hot Jockey',
            finishPosition: 1,
            date: '2024-01-15',
          }),
          createMockPastPerformance({
            jockey: 'Hot Jockey',
            finishPosition: 1,
            date: '2024-01-10',
          }),
          createMockPastPerformance({
            jockey: 'Hot Jockey',
            finishPosition: 1,
            date: '2024-01-05',
          }),
          createMockPastPerformance({
            jockey: 'Hot Jockey',
            finishPosition: 4,
            date: '2024-01-01',
          }),
        ],
      }),
    ];

    const db = buildPartnershipDatabase(horses);
    const stats = getPartnershipStats('Hot Trainer', 'Hot Jockey', db);

    expect(stats!.recentWins).toBe(3);
    expect(stats!.recentStarts).toBe(4);
  });
});

// ============================================================================
// TESTS: Synergy Bonus Calculation
// ============================================================================

describe('calculateSynergyBonus', () => {
  it('should return no bonus for null stats', () => {
    const result = calculateSynergyBonus(null);

    expect(result.bonus).toBe(0);
    expect(result.level).toBe('none');
  });

  it('should award elite bonus for 25%+ win rate with 20+ starts', () => {
    const stats = {
      trainerName: 'Elite Trainer',
      jockeyName: 'Elite Jockey',
      wins: 6,
      starts: 22,
      winRate: 27.3,
      places: 4,
      shows: 3,
      itmRate: 59.1,
      recentWins: 1,
      recentStarts: 5,
      recentWinRate: 20,
      firstStartDate: '2023-01-01',
      lastStartDate: '2024-01-15',
    };

    const result = calculateSynergyBonus(stats);

    expect(result.bonus).toBe(10); // Elite bonus
    expect(result.level).toBe('elite');
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('should award strong bonus for 20-24% win rate with 15+ starts', () => {
    const stats = {
      trainerName: 'Strong Trainer',
      jockeyName: 'Strong Jockey',
      wins: 4,
      starts: 18,
      winRate: 22.2,
      places: 3,
      shows: 2,
      itmRate: 50,
      recentWins: 1,
      recentStarts: 5,
      recentWinRate: 20,
      firstStartDate: '2023-06-01',
      lastStartDate: '2024-01-15',
    };

    const result = calculateSynergyBonus(stats);

    expect(result.bonus).toBe(6); // Strong bonus
    expect(result.level).toBe('strong');
  });

  it('should detect hot combo with 2+ recent wins', () => {
    const stats = {
      trainerName: 'Hot Trainer',
      jockeyName: 'Hot Jockey',
      wins: 2,
      starts: 12,
      winRate: 16.7,
      places: 2,
      shows: 2,
      itmRate: 50,
      recentWins: 3,
      recentStarts: 5,
      recentWinRate: 60,
      firstStartDate: '2023-10-01',
      lastStartDate: '2024-01-15',
    };

    const result = calculateSynergyBonus(stats);

    expect(result.isHotCombo).toBe(true);
    expect(result.evidence.some((e) => e.includes('Hot combo'))).toBe(true);
  });

  it('should award developing bonus for 10+ starts', () => {
    const stats = {
      trainerName: 'Developing Trainer',
      jockeyName: 'Developing Jockey',
      wins: 1,
      starts: 12,
      winRate: 8.3,
      places: 2,
      shows: 2,
      itmRate: 41.7,
      recentWins: 0,
      recentStarts: 5,
      recentWinRate: 0,
      firstStartDate: '2023-11-01',
      lastStartDate: '2024-01-15',
    };

    const result = calculateSynergyBonus(stats);

    expect(result.bonus).toBe(3); // Developing bonus
    expect(result.level).toBe('developing');
  });

  it('should return new level for fewer than 10 starts (without hot combo)', () => {
    const stats = {
      trainerName: 'New Trainer',
      jockeyName: 'New Jockey',
      wins: 1,
      starts: 5,
      winRate: 20,
      places: 1,
      shows: 1,
      itmRate: 60,
      recentWins: 1, // Less than 2, so not hot combo
      recentStarts: 5,
      recentWinRate: 20,
      firstStartDate: '2024-01-01',
      lastStartDate: '2024-01-15',
    };

    const result = calculateSynergyBonus(stats);

    expect(result.level).toBe('new');
    expect(result.bonus).toBe(0);
  });
});

// ============================================================================
// TESTS: Connection Synergy Integration
// ============================================================================

describe('getConnectionSynergy', () => {
  it('should calculate synergy for a horse', () => {
    const horses = [
      createMockHorse({
        trainerName: 'Synergy Trainer',
        jockeyName: 'Synergy Jockey',
        pastPerformances: Array(25)
          .fill(null)
          .map((_, i) =>
            createMockPastPerformance({
              jockey: 'Synergy Jockey',
              finishPosition: i < 6 ? 1 : 4, // 24% win rate
              date: `2024-01-${String(i + 1).padStart(2, '0')}`,
            })
          ),
      }),
    ];

    const firstHorse = horses[0];
    if (!firstHorse) {
      throw new Error('Test setup failed: first horse not defined');
    }
    const result = getConnectionSynergy(firstHorse, horses);

    expect(result.partnership).toBeDefined();
    expect(result.bonus).toBeGreaterThan(0);
  });

  it('should return no synergy for horse with different jockey in current race', () => {
    const horse = createMockHorse({
      trainerName: 'Some Trainer',
      jockeyName: 'New Jockey', // Current jockey
      pastPerformances: [
        createMockPastPerformance({ jockey: 'Old Jockey', finishPosition: 1 }),
        createMockPastPerformance({ jockey: 'Other Jockey', finishPosition: 2 }),
      ],
    });

    const result = getConnectionSynergy(horse, [horse]);

    // No partnership data for current trainer+jockey combo
    expect(result.partnership).toBeNull();
  });

  it('should handle empty past performances gracefully', () => {
    const horse = createMockHorse({
      trainerName: 'Empty Trainer',
      jockeyName: 'Empty Jockey',
      pastPerformances: [],
    });

    const result = getConnectionSynergy(horse, [horse]);

    expect(result.bonus).toBe(0);
    expect(result.level).toBe('none');
  });
});

// ============================================================================
// TESTS: Utility Functions
// ============================================================================

describe('hasSignificantPartnership', () => {
  it('should return true for partnerships with bonus', () => {
    const result = {
      partnership: {
        trainerName: 'T',
        jockeyName: 'J',
        wins: 5,
        starts: 20,
        winRate: 25,
        places: 3,
        shows: 2,
        itmRate: 50,
        recentWins: 1,
        recentStarts: 5,
        recentWinRate: 20,
        firstStartDate: null,
        lastStartDate: null,
      },
      bonus: 10,
      level: 'elite' as const,
      description: 'Elite partnership',
      evidence: [],
      isHotCombo: false,
      recentForm: '',
    };

    expect(hasSignificantPartnership(result)).toBe(true);
  });

  it('should return false for no partnership', () => {
    const result = {
      partnership: null,
      bonus: 0,
      level: 'none' as const,
      description: '',
      evidence: [],
      isHotCombo: false,
      recentForm: '',
    };

    expect(hasSignificantPartnership(result)).toBe(false);
  });

  it('should return true for developing partnerships even without bonus', () => {
    const result = {
      partnership: {
        trainerName: 'T',
        jockeyName: 'J',
        wins: 1,
        starts: 12,
        winRate: 8.3,
        places: 2,
        shows: 2,
        itmRate: 41.7,
        recentWins: 0,
        recentStarts: 5,
        recentWinRate: 0,
        firstStartDate: null,
        lastStartDate: null,
      },
      bonus: 3,
      level: 'developing' as const,
      description: 'Developing partnership',
      evidence: [],
      isHotCombo: false,
      recentForm: '',
    };

    expect(hasSignificantPartnership(result)).toBe(true);
  });
});

// ============================================================================
// TESTS: Edge Cases
// ============================================================================

describe('Edge cases', () => {
  it('should handle multiple horses with same trainer-jockey combo', () => {
    const horses = [
      createMockHorse({
        trainerName: 'Shared Trainer',
        pastPerformances: [
          createMockPastPerformance({ jockey: 'Shared Jockey', finishPosition: 1 }),
        ],
      }),
      createMockHorse({
        trainerName: 'Shared Trainer',
        pastPerformances: [
          createMockPastPerformance({ jockey: 'Shared Jockey', finishPosition: 1 }),
        ],
      }),
    ];

    const db = buildPartnershipDatabase(horses);
    const stats = getPartnershipStats('Shared Trainer', 'Shared Jockey', db);

    expect(stats).toBeDefined();
    expect(stats!.starts).toBe(2);
    expect(stats!.wins).toBe(2);
  });

  it('should handle special characters in names', () => {
    const horses = [
      createMockHorse({
        trainerName: "O'Brien, A.",
        pastPerformances: [
          createMockPastPerformance({ jockey: 'De Sousa, S.', finishPosition: 1 }),
        ],
      }),
    ];

    const db = buildPartnershipDatabase(horses);

    expect(db.partnerships.size).toBeGreaterThan(0);
  });
});
