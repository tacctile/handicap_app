/**
 * Test Helpers and Mock Data Factories
 * Provides utilities for creating mock horse entries and race data
 */

import type {
  HorseEntry,
  RaceHeader,
  PastPerformance,
  Equipment,
  Medication,
  Breeding,
  Workout,
  SpeedFigures,
  RunningLine,
} from '../../types/drf';

// ============================================================================
// DEFAULT FACTORIES
// ============================================================================

/**
 * Create default speed figures
 */
export function createSpeedFigures(overrides: Partial<SpeedFigures> = {}): SpeedFigures {
  return {
    beyer: null,
    timeformUS: null,
    equibase: null,
    trackVariant: null,
    dirtVariant: null,
    turfVariant: null,
    ...overrides,
  };
}

/**
 * Create default running line
 */
export function createRunningLine(overrides: Partial<RunningLine> = {}): RunningLine {
  return {
    start: null,
    quarterMile: null,
    quarterMileLengths: null,
    halfMile: null,
    halfMileLengths: null,
    threeQuarters: null,
    threeQuartersLengths: null,
    stretch: null,
    stretchLengths: null,
    finish: null,
    finishLengths: null,
    ...overrides,
  };
}

/**
 * Create a mock past performance
 */
export function createPastPerformance(overrides: Partial<PastPerformance> = {}): PastPerformance {
  return {
    date: '2024-01-15',
    track: 'CD',
    trackName: 'Churchill Downs',
    raceNumber: 5,
    distanceFurlongs: 6,
    distance: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'allowance',
    claimingPrice: null,
    purse: 50000,
    fieldSize: 10,
    finishPosition: 3,
    lengthsBehind: 2.5,
    lengthsAhead: null,
    finalTime: 68.5,
    finalTimeFormatted: '1:08.50',
    speedFigures: createSpeedFigures({ beyer: 85 }),
    runningLine: createRunningLine({ start: 4, finish: 3 }),
    jockey: 'John Smith',
    weight: 120,
    apprenticeAllowance: 0,
    equipment: 'B',
    medication: 'L',
    winner: 'Fast Horse',
    secondPlace: 'Second Horse',
    thirdPlace: 'Third Horse',
    tripComment: '',
    comment: '',
    odds: 5.5,
    favoriteRank: 3,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: 21,
    ...overrides,
  };
}

/**
 * Create mock equipment
 */
export function createEquipment(overrides: Partial<Equipment> = {}): Equipment {
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
    ...overrides,
  };
}

/**
 * Create mock medication
 */
export function createMedication(overrides: Partial<Medication> = {}): Medication {
  return {
    lasixFirstTime: false,
    lasix: false,
    lasixOff: false,
    bute: false,
    other: [],
    raw: '',
    ...overrides,
  };
}

/**
 * Create mock breeding
 */
export function createBreeding(overrides: Partial<Breeding> = {}): Breeding {
  return {
    sire: 'Quality Road',
    sireOfSire: 'Elusive Quality',
    dam: 'Speed Queen',
    damSire: 'Storm Cat',
    breeder: 'Darley',
    whereBred: 'KY',
    studFee: null,
    ...overrides,
  };
}

/**
 * Create mock workout
 */
export function createWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    date: '2024-02-01',
    track: 'CD',
    distanceFurlongs: 5,
    distance: '5f',
    timeSeconds: 60.2,
    timeFormatted: '1:00.20',
    type: 'handily',
    trackCondition: 'fast',
    surface: 'dirt',
    ranking: '2/35',
    rankNumber: 2,
    totalWorks: 35,
    isBullet: false,
    fromGate: false,
    notes: '',
    ...overrides,
  };
}

/**
 * Create a mock horse entry
 */
export function createHorseEntry(overrides: Partial<HorseEntry> = {}): HorseEntry {
  return {
    programNumber: 1,
    entryIndicator: '',
    postPosition: 1,
    horseName: 'Test Horse',
    age: 4,
    sex: 'c',
    sexFull: 'Colt',
    color: 'Bay',
    breeding: createBreeding(),
    owner: 'Test Owner',
    silks: 'Red, white stripes',
    trainerName: 'John Trainer',
    trainerStats: '15% Win',
    jockeyName: 'Jose Jockey',
    jockeyStats: '18% Win',
    weight: 120,
    apprenticeAllowance: 0,
    equipment: createEquipment(),
    medication: createMedication(),
    morningLineOdds: '5-1',
    morningLineDecimal: 5,
    currentOdds: null,
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimePlaces: 3,
    lifetimeShows: 2,
    lifetimeEarnings: 150000,
    currentYearStarts: 4,
    currentYearWins: 1,
    currentYearPlaces: 1,
    currentYearShows: 0,
    currentYearEarnings: 50000,
    previousYearStarts: 6,
    previousYearWins: 1,
    previousYearPlaces: 2,
    previousYearShows: 2,
    previousYearEarnings: 100000,
    trackStarts: 3,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 0,
    surfaceStarts: 8,
    surfaceWins: 2,
    distanceStarts: 5,
    distanceWins: 1,
    turfStarts: 2,
    turfWins: 0,
    wetStarts: 1,
    wetWins: 0,
    daysSinceLastRace: 21,
    lastRaceDate: '2024-01-15',
    averageBeyer: 83,
    bestBeyer: 88,
    lastBeyer: 85,
    earlySpeedRating: 65,
    runningStyle: 'P',
    pedigreeRating: null,
    claimingPrice: null,
    lastClaimPrice: null,
    trainerAngle: null,
    workouts: [],
    pastPerformances: [],
    isScratched: false,
    scratchReason: null,
    isCoupledMain: true,
    coupledWith: [],
    rawLine: '',
    ...overrides,
  };
}

/**
 * Create a mock race header
 */
export function createRaceHeader(overrides: Partial<RaceHeader> = {}): RaceHeader {
  return {
    trackCode: 'CD',
    trackName: 'Churchill Downs',
    trackLocation: 'Louisville, KY',
    raceNumber: 5,
    raceDate: '2024-02-15',
    raceDateRaw: '20240215',
    postTime: '3:30 PM',
    distanceFurlongs: 6,
    distance: '6f',
    distanceExact: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'allowance',
    raceType: 'ALW',
    purse: 75000,
    purseFormatted: '$75,000',
    ageRestriction: '3YO+',
    sexRestriction: '',
    weightConditions: '',
    stateBred: null,
    claimingPriceMin: null,
    claimingPriceMax: null,
    allowedWeight: null,
    conditions: 'Allowance',
    raceName: null,
    grade: null,
    isListed: false,
    isAbout: false,
    tempRail: null,
    turfCourseType: null,
    chuteStart: false,
    hasReplay: false,
    programNumber: 5,
    fieldSize: 10,
    probableFavorite: null,
    ...overrides,
  };
}

// ============================================================================
// SCENARIO FACTORIES
// ============================================================================

/**
 * Create a horse with winning trainer stats
 */
export function createWinningTrainerHorse(wins: number): HorseEntry {
  const starts = wins > 0 ? Math.ceil(wins / 0.2) : 10; // 20% win rate base
  const pastPerformances = Array.from({ length: Math.min(starts, 10) }, (_, i) =>
    createPastPerformance({
      finishPosition: i < wins ? 1 : Math.floor(Math.random() * 5) + 2,
      date: `2024-0${Math.max(1, 10 - i)}-15`,
    })
  );

  return createHorseEntry({
    trainerName: `Trainer_${wins}wins`,
    pastPerformances,
  });
}

/**
 * Create a horse with specific layoff days
 */
export function createLayoffHorse(daysSinceLastRace: number): HorseEntry {
  return createHorseEntry({
    daysSinceLastRace,
    pastPerformances: [createPastPerformance({ daysSinceLast: daysSinceLastRace })],
  });
}

/**
 * Create a first-time starter
 */
export function createFirstTimeStarter(): HorseEntry {
  return createHorseEntry({
    lifetimeStarts: 0,
    lifetimeWins: 0,
    pastPerformances: [],
    daysSinceLastRace: null,
    lastRaceDate: null,
    averageBeyer: null,
    bestBeyer: null,
    lastBeyer: null,
  });
}

/**
 * Create a speed horse (E running style)
 */
export function createSpeedHorse(): HorseEntry {
  return createHorseEntry({
    horseName: 'Speed Demon',
    runningStyle: 'E',
    earlySpeedRating: 90,
    pastPerformances: [
      createPastPerformance({
        runningLine: createRunningLine({
          start: 1,
          quarterMile: 1,
          halfMile: 1,
          stretch: 2,
          finish: 2,
        }),
        finishPosition: 2,
      }),
      createPastPerformance({
        runningLine: createRunningLine({
          start: 1,
          quarterMile: 1,
          halfMile: 1,
          stretch: 1,
          finish: 1,
        }),
        finishPosition: 1,
      }),
      createPastPerformance({
        runningLine: createRunningLine({
          start: 1,
          quarterMile: 1,
          halfMile: 2,
          stretch: 3,
          finish: 4,
        }),
        finishPosition: 4,
      }),
    ],
  });
}

/**
 * Create a closer (C running style)
 */
export function createCloser(): HorseEntry {
  return createHorseEntry({
    horseName: 'Late Rally',
    runningStyle: 'C',
    earlySpeedRating: 30,
    pastPerformances: [
      createPastPerformance({
        runningLine: createRunningLine({
          start: 8,
          quarterMile: 8,
          halfMile: 7,
          stretch: 4,
          finish: 1,
        }),
        finishPosition: 1,
      }),
      createPastPerformance({
        runningLine: createRunningLine({
          start: 9,
          quarterMile: 9,
          halfMile: 8,
          stretch: 5,
          finish: 2,
        }),
        finishPosition: 2,
      }),
    ],
  });
}

/**
 * Create a presser (P running style)
 */
export function createPresser(): HorseEntry {
  return createHorseEntry({
    horseName: 'Tactical Bob',
    runningStyle: 'P',
    earlySpeedRating: 60,
    pastPerformances: [
      createPastPerformance({
        runningLine: createRunningLine({
          start: 3,
          quarterMile: 3,
          halfMile: 2,
          stretch: 2,
          finish: 1,
        }),
        finishPosition: 1,
      }),
      createPastPerformance({
        runningLine: createRunningLine({
          start: 4,
          quarterMile: 4,
          halfMile: 3,
          stretch: 2,
          finish: 2,
        }),
        finishPosition: 2,
      }),
    ],
  });
}

/**
 * Create a horse with equipment changes
 */
export function createEquipmentChangeHorse(
  changeType: 'blinkers_on' | 'blinkers_off' | 'lasix_first'
): HorseEntry {
  const equipment = createEquipment();
  const medication = createMedication();

  if (changeType === 'blinkers_on') {
    equipment.blinkers = true;
    equipment.firstTimeEquipment = ['blinkers'];
    equipment.raw = 'B';
  } else if (changeType === 'blinkers_off') {
    equipment.blinkersOff = true;
    equipment.raw = 'BO';
  } else if (changeType === 'lasix_first') {
    medication.lasixFirstTime = true;
    medication.lasix = true;
    medication.raw = 'L1';
  }

  return createHorseEntry({
    equipment,
    medication,
    pastPerformances: [
      createPastPerformance({
        equipment: changeType === 'blinkers_on' ? '' : 'B',
        medication: changeType === 'lasix_first' ? '' : 'L',
      }),
    ],
  });
}

/**
 * Create a horse with specific speed figures
 */
export function createSpeedFigureHorse(figures: number[]): HorseEntry {
  const pastPerformances = figures.map((beyer, i) =>
    createPastPerformance({
      speedFigures: createSpeedFigures({ beyer }),
      date: `2024-0${Math.max(1, 10 - i)}-15`,
    })
  );

  return createHorseEntry({
    bestBeyer: Math.max(...figures),
    averageBeyer: Math.round(figures.reduce((a, b) => a + b, 0) / figures.length),
    lastBeyer: figures[0],
    pastPerformances,
  });
}

/**
 * Create a complete field of horses for race testing
 */
export function createTestField(count: number = 10): HorseEntry[] {
  return Array.from({ length: count }, (_, i) =>
    createHorseEntry({
      programNumber: i + 1,
      postPosition: i + 1,
      horseName: `Horse ${i + 1}`,
      morningLineOdds: `${i + 2}-1`,
      morningLineDecimal: i + 2,
      pastPerformances: [
        createPastPerformance({ finishPosition: Math.floor(Math.random() * 5) + 1 }),
        createPastPerformance({ finishPosition: Math.floor(Math.random() * 5) + 1 }),
        createPastPerformance({ finishPosition: Math.floor(Math.random() * 5) + 1 }),
      ],
    })
  );
}
