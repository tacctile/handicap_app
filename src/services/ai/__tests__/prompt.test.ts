/**
 * Tests for AI Prompt Builder
 */

import { describe, it, expect } from 'vitest';
import { buildRaceAnalysisPrompt, formatHorseForPrompt, formatTrackIntelligence } from '../prompt';
import type { ParsedRace, RaceHeader, HorseEntry, PastPerformance } from '../../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../../types/drf';
import type {
  RaceScoringResult,
  HorseScoreForAI,
  RaceAnalysis,
  TrackIntelligenceForAI,
  TrainerPatternsForAI,
  PastPerformanceForAI,
  WorkoutForAI,
} from '../../../types/scoring';

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

function createMockPastPerformance(overrides: Partial<PastPerformance> = {}): PastPerformance {
  return {
    date: '2024-01-15',
    track: 'SA',
    trackName: 'Santa Anita',
    raceNumber: 5,
    distanceFurlongs: 6,
    distance: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'allowance',
    claimingPrice: null,
    purse: 75000,
    fieldSize: 8,
    finishPosition: 1,
    lengthsBehind: 0,
    lengthsAhead: 2.5,
    finalTime: 70.45,
    finalTimeFormatted: '1:10.45',
    speedFigures: {
      beyer: 85,
      timeformUS: null,
      equibase: null,
      trackVariant: null,
      dirtVariant: null,
      turfVariant: null,
    },
    runningLine: {
      start: 3,
      quarterMile: 2,
      quarterMileLengths: 1,
      halfMile: 2,
      halfMileLengths: 0.5,
      threeQuarters: null,
      threeQuartersLengths: null,
      stretch: 1,
      stretchLengths: 0,
      finish: 1,
      finishLengths: 0,
    },
    jockey: 'John Smith',
    weight: 122,
    apprenticeAllowance: 0,
    equipment: '',
    medication: '',
    winner: 'Test Horse',
    secondPlace: 'Runner Up',
    thirdPlace: 'Third Horse',
    tripComment: 'Stalked pace, drew clear',
    comment: '',
    odds: 3.5,
    favoriteRank: null,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: 21,
    earlyPace1: null,
    latePace: null,
    quarterTime: null,
    halfMileTime: null,
    sixFurlongTime: null,
    mileTime: null,
    ...overrides,
  };
}

function createMockHorseEntry(overrides: Partial<HorseEntry> = {}): HorseEntry {
  return {
    programNumber: 1,
    entryIndicator: '',
    postPosition: 1,
    horseName: 'Test Horse',
    age: 4,
    sex: 'c',
    sexFull: 'colt',
    color: 'dk b',
    breeding: {
      sire: 'Sire Name',
      sireOfSire: 'Grandsire Name',
      dam: 'Dam Name',
      damSire: 'Dam Sire',
      breeder: 'Test Breeder',
      whereBred: 'KY',
      studFee: null,
    },
    owner: 'Test Owner',
    silks: 'Blue, white stars',
    trainerName: 'Jane Doe',
    trainerStats: '20% win',
    trainerMeetStarts: 50,
    trainerMeetWins: 10,
    trainerMeetPlaces: 8,
    trainerMeetShows: 7,
    trainerCategoryStats: createDefaultTrainerCategoryStats(),
    jockeyName: 'John Smith',
    jockeyStats: '15% win',
    jockeyMeetStarts: 100,
    jockeyMeetWins: 15,
    jockeyMeetPlaces: 12,
    jockeyMeetShows: 10,
    weight: 122,
    apprenticeAllowance: 0,
    equipment: {
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
    },
    medication: {
      lasixFirstTime: false,
      lasix: true,
      lasixOff: false,
      bute: false,
      other: [],
      raw: 'L',
    },
    morningLineOdds: '5-1',
    morningLineDecimal: 5.0,
    currentOdds: null,
    lifetimeStarts: 10,
    lifetimeWins: 3,
    lifetimePlaces: 2,
    lifetimeShows: 2,
    lifetimeEarnings: 150000,
    currentYearStarts: 5,
    currentYearWins: 2,
    currentYearPlaces: 1,
    currentYearShows: 1,
    currentYearEarnings: 75000,
    previousYearStarts: 5,
    previousYearWins: 1,
    previousYearPlaces: 1,
    previousYearShows: 1,
    previousYearEarnings: 75000,
    trackStarts: 2,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 0,
    surfaceStarts: 8,
    surfaceWins: 3,
    distanceStarts: 3,
    distanceWins: 1,
    distancePlaces: 1,
    distanceShows: 1,
    turfStarts: 2,
    turfWins: 0,
    turfPlaces: 1,
    turfShows: 0,
    wetStarts: 1,
    wetWins: 0,
    wetPlaces: 0,
    wetShows: 0,
    daysSinceLastRace: 21,
    lastRaceDate: '2024-01-01',
    averageBeyer: 82,
    bestBeyer: 88,
    lastBeyer: 85,
    earlySpeedRating: 95,
    runningStyle: 'E/P',
    pedigreeRating: null,
    claimingPrice: null,
    lastClaimPrice: null,
    trainerAngle: null,
    workouts: [],
    pastPerformances: [createMockPastPerformance()],
    isScratched: false,
    scratchReason: null,
    isCoupledMain: false,
    coupledWith: [],
    rawLine: '',
    salePrice: null,
    saleLocation: null,
    ...overrides,
  };
}

function createMockRaceHeader(overrides: Partial<RaceHeader> = {}): RaceHeader {
  return {
    trackCode: 'SA',
    trackName: 'Santa Anita',
    trackLocation: 'Arcadia, CA',
    raceNumber: 5,
    raceDate: '2024-01-20',
    raceDateRaw: '20240120',
    postTime: '3:00 PM',
    distanceFurlongs: 6,
    distance: '6 Furlongs',
    distanceExact: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'claiming',
    raceType: 'CLM',
    purse: 35000,
    purseFormatted: '$35,000',
    ageRestriction: '4+',
    sexRestriction: '',
    weightConditions: 'Allowances',
    stateBred: null,
    claimingPriceMin: 25000,
    claimingPriceMax: 25000,
    allowedWeight: null,
    conditions: 'For four year olds and upward',
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
    probableFavorite: 1,
    ...overrides,
  };
}

function createMockParsedRace(overrides: Partial<ParsedRace> = {}): ParsedRace {
  return {
    header: createMockRaceHeader(),
    horses: [
      createMockHorseEntry({ programNumber: 1, horseName: 'Fast Runner' }),
      createMockHorseEntry({ programNumber: 2, horseName: 'Steady Eddie' }),
      createMockHorseEntry({ programNumber: 3, horseName: 'Longshot Larry' }),
    ],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

/**
 * Create default empty trainer patterns for AI
 */
function createDefaultTrainerPatternsForAI(): TrainerPatternsForAI {
  const defaultStat = { starts: 0, wins: 0, winPercent: 0, roi: 0 };
  return {
    firstTimeLasix: defaultStat,
    firstTimeBlinkers: defaultStat,
    blinkersOff: defaultStat,
    secondOffLayoff: defaultStat,
    days31to60: defaultStat,
    days61to90: defaultStat,
    days91to180: defaultStat,
    days181plus: defaultStat,
    sprintToRoute: defaultStat,
    routeToSprint: defaultStat,
    turfSprint: defaultStat,
    turfRoute: defaultStat,
    wetTrack: defaultStat,
    dirtSprint: defaultStat,
    dirtRoute: defaultStat,
    maidenClaiming: defaultStat,
    stakes: defaultStat,
    firstStartTrainer: defaultStat,
    afterClaim: defaultStat,
  };
}

/**
 * Create trainer patterns with significant categories (5+ starts)
 */
function createTrainerPatternsWithSignificantStats(): TrainerPatternsForAI {
  return {
    ...createDefaultTrainerPatternsForAI(),
    firstTimeBlinkers: { starts: 10, wins: 3, winPercent: 30, roi: 250 }, // Exceptional!
    dirtSprint: { starts: 50, wins: 10, winPercent: 20, roi: 120 },
    days31to60: { starts: 8, wins: 1, winPercent: 12, roi: -15 },
  };
}

function createMockPastPerformanceForAI(
  overrides: Partial<PastPerformanceForAI> = {}
): PastPerformanceForAI {
  return {
    date: '2024-01-15',
    track: 'SA',
    distance: 6,
    surface: 'dirt',
    trackCondition: 'fast',
    finishPosition: 2,
    fieldSize: 8,
    lengthsBehind: 1.5,
    beyer: 82,
    earlyPace1: 95,
    latePace: 88,
    tripComment: 'Blocked in stretch',
    odds: 4.5,
    favoriteRank: 2,
    runningLine: { start: 3, stretch: 2, finish: 2 },
    ...overrides,
  };
}

function createMockWorkoutForAI(overrides: Partial<WorkoutForAI> = {}): WorkoutForAI {
  return {
    date: '2024-01-18',
    track: 'SA',
    distanceFurlongs: 5,
    timeSeconds: 60.2,
    type: 'Handily',
    isBullet: false,
    rankNumber: 5,
    totalWorks: 25,
    ...overrides,
  };
}

function createMockHorseScore(overrides: Partial<HorseScoreForAI> = {}): HorseScoreForAI {
  return {
    programNumber: 1,
    horseName: 'Fast Runner',
    rank: 1,
    finalScore: 185,
    confidenceTier: 'high',
    breakdown: {
      speedScore: 52,
      classScore: 40,
      formScore: 30,
      paceScore: 28,
      connectionScore: 25,
    },
    positiveFactors: ['Top Beyer figure', 'Strong trainer stats'],
    negativeFactors: [],
    isScratched: false,
    pastPerformances: [],
    workouts: [],
    trainerPatterns: createDefaultTrainerPatternsForAI(),
    equipment: {
      blinkers: false,
      blinkersOff: false,
      frontBandages: false,
      tongueTie: false,
      nasalStrip: false,
      shadowRoll: false,
      barShoes: false,
      mudCaulks: false,
      firstTimeEquipment: [],
      equipmentChanges: [],
    },
    breeding: { sire: '', damSire: '', whereBred: '' },
    distanceSurfaceStats: {
      distanceStarts: 0,
      distanceWins: 0,
      distanceWinRate: 0,
      surfaceStarts: 0,
      surfaceWins: 0,
      surfaceWinRate: 0,
      turfStarts: 0,
      turfWins: 0,
      turfWinRate: 0,
      wetStarts: 0,
      wetWins: 0,
      wetWinRate: 0,
    },
    formIndicators: {
      daysSinceLastRace: null,
      averageBeyer: null,
      bestBeyer: null,
      lastBeyer: null,
      earlySpeedRating: null,
      lifetimeStarts: 0,
      lifetimeWins: 0,
      lifetimeWinRate: 0,
    },
    morningLineOdds: '5-1',
    morningLineDecimal: 5.0,
    ...overrides,
  };
}

function createMockTrackIntelligence(
  overrides: Partial<TrackIntelligenceForAI> = {}
): TrackIntelligenceForAI {
  return {
    trackCode: 'SA',
    trackName: 'Santa Anita',
    surface: 'dirt',
    distance: 6,
    isSprintOrRoute: 'sprint',
    postPositionBias: {
      winPercentByPost: [12, 14, 11, 10, 9, 8, 7, 6],
      favoredPosts: [1, 2],
      biasStrength: 'moderate',
      biasDescription: 'Inside posts favored at sprint distances',
    },
    speedBias: {
      earlySpeedWinRate: 58,
      paceAdvantageRating: 7,
      favoredStyle: 'E/P',
      biasDescription: 'Speed holds well on fast dirt',
    },
    trackCharacteristics: {
      circumference: 1.0,
      stretchLength: 990,
      playingStyle: 'speed-favoring',
      drainage: 'good',
    },
    seasonalContext: {
      currentSeason: 'winter',
      typicalCondition: 'fast',
      speedAdjustment: 0,
      favoredStyle: 'E',
      notes: 'Firm ground favors early speed',
    },
    dataQuality: 'verified',
    ...overrides,
  };
}

function createMockRaceAnalysis(overrides: Partial<RaceAnalysis> = {}): RaceAnalysis {
  return {
    paceScenario: {
      expectedPace: 'moderate',
      likelyLeader: 1,
      speedDuelProbability: 0.3,
      earlySpeedCount: 2,
    },
    fieldStrength: 'average',
    vulnerableFavorite: false,
    likelyPaceCollapse: false,
    trackIntelligence: null,
    ...overrides,
  };
}

function createMockScoringResult(overrides: Partial<RaceScoringResult> = {}): RaceScoringResult {
  return {
    scores: [
      createMockHorseScore({ programNumber: 1, horseName: 'Fast Runner', rank: 1 }),
      createMockHorseScore({
        programNumber: 2,
        horseName: 'Steady Eddie',
        rank: 2,
        finalScore: 170,
      }),
      createMockHorseScore({
        programNumber: 3,
        horseName: 'Longshot Larry',
        rank: 3,
        finalScore: 145,
      }),
    ],
    raceAnalysis: createMockRaceAnalysis(),
    ...overrides,
  };
}

// ============================================================================
// TESTS - formatTrackIntelligence
// ============================================================================

describe('formatTrackIntelligence', () => {
  it('handles null input gracefully', () => {
    const result = formatTrackIntelligence(null);

    expect(result).toContain('NOT AVAILABLE');
    expect(result).toContain('use caution on pace/position analysis');
  });

  it('formats complete track data correctly', () => {
    const trackIntel = createMockTrackIntelligence();
    const result = formatTrackIntelligence(trackIntel);

    // Track header
    expect(result).toContain('TRACK: Santa Anita (SA)');
    expect(result).toContain('6f dirt sprint');

    // Post bias
    expect(result).toContain('POST BIAS:');
    expect(result).toContain('Inside posts favored');
    expect(result).toContain('Favored Posts: 1, 2');
    expect(result).toContain('Strength: moderate');

    // Speed bias
    expect(result).toContain('SPEED BIAS:');
    expect(result).toContain('58% early speed wins');
    expect(result).toContain('Rating: 7/10');
    expect(result).toContain('Favors: E/P');

    // Track characteristics
    expect(result).toContain('TRACK PLAYS: speed-favoring');
    expect(result).toContain('Stretch: 990ft');

    // Seasonal context
    expect(result).toContain('SEASONAL: winter');
    expect(result).toContain('Style Favors: E');

    // Data quality
    expect(result).toContain('Data Quality: verified');
  });

  it('handles missing seasonal context', () => {
    const trackIntel = createMockTrackIntelligence({ seasonalContext: null });
    const result = formatTrackIntelligence(trackIntel);

    expect(result).not.toContain('SEASONAL:');
    expect(result).toContain('TRACK:'); // Other sections still present
    expect(result).toContain('POST BIAS:');
  });

  it('handles empty favored posts', () => {
    const trackIntel = createMockTrackIntelligence({
      postPositionBias: {
        winPercentByPost: [10, 10, 10, 10],
        favoredPosts: [],
        biasStrength: 'neutral',
        biasDescription: 'No significant post bias',
      },
    });
    const result = formatTrackIntelligence(trackIntel);

    expect(result).toContain('Favored Posts: None');
  });
});

// ============================================================================
// TESTS - formatHorseForPrompt
// ============================================================================

describe('formatHorseForPrompt', () => {
  it('includes all new data sections for complete data', () => {
    const horseScore = createMockHorseScore({
      programNumber: 5,
      horseName: 'Value Hunter',
      pastPerformances: [
        createMockPastPerformanceForAI({
          date: '2024-01-15',
          finishPosition: 3,
          fieldSize: 10,
          lengthsBehind: 2.5,
          beyer: 85,
          tripComment: 'Blocked, checked in stretch',
        }),
        createMockPastPerformanceForAI({
          date: '2024-01-01',
          finishPosition: 2,
          fieldSize: 8,
          lengthsBehind: 1.0,
          beyer: 82,
          tripComment: 'Bumped at start, closed well',
        }),
        createMockPastPerformanceForAI({
          date: '2023-12-15',
          finishPosition: 1,
          fieldSize: 9,
          lengthsBehind: 0,
          beyer: 88,
          tripComment: 'Drew clear, easy win',
        }),
      ],
      workouts: [
        createMockWorkoutForAI({
          date: '2024-01-18',
          isBullet: true,
          rankNumber: 1,
          totalWorks: 30,
        }),
        createMockWorkoutForAI({ date: '2024-01-11', isBullet: false }),
        createMockWorkoutForAI({ date: '2024-01-04', isBullet: false }),
      ],
      trainerPatterns: createTrainerPatternsWithSignificantStats(),
      equipment: {
        blinkers: true,
        blinkersOff: false,
        frontBandages: true,
        tongueTie: false,
        nasalStrip: false,
        shadowRoll: false,
        barShoes: false,
        mudCaulks: false,
        firstTimeEquipment: ['Blinkers'],
        equipmentChanges: ['Added blinkers'],
      },
      distanceSurfaceStats: {
        distanceStarts: 5,
        distanceWins: 2,
        distanceWinRate: 0.4,
        surfaceStarts: 10,
        surfaceWins: 3,
        surfaceWinRate: 0.3,
        turfStarts: 0,
        turfWins: 0,
        turfWinRate: 0,
        wetStarts: 2,
        wetWins: 1,
        wetWinRate: 0.5,
      },
      formIndicators: {
        daysSinceLastRace: 14,
        averageBeyer: 85,
        bestBeyer: 92,
        lastBeyer: 85,
        earlySpeedRating: 95,
        lifetimeStarts: 10,
        lifetimeWins: 3,
        lifetimeWinRate: 0.3,
      },
    });

    const result = formatHorseForPrompt(horseScore);

    // Core header
    expect(result).toContain('#5 Value Hunter');
    expect(result).toContain('Algorithm Rank: 1');
    expect(result).toContain('Score: 185/368');

    // Form indicators
    expect(result).toContain('Days Off: 14');
    expect(result).toContain('Last 85 / Best 92 / Avg 85');

    // Distance/Surface stats
    expect(result).toContain('Distance: 2/5 (40%)');
    expect(result).toContain('Surface: 3/10 (30%)');
    expect(result).toContain('Turf: [NO EXPERIENCE]');
    expect(result).toContain('Wet: 1/2 (50%)');

    // Past performances
    expect(result).toContain('Past Performances:');
    expect(result).toContain('PP1: 2024-01-15');
    expect(result).toContain('Finish: 3/10 (2.5L behind)');
    expect(result).toContain('Trip: Blocked, checked in stretch');
    expect(result).toContain('Position Flow:');

    // Workouts
    expect(result).toContain('Workouts:');
    expect(result).toContain('[BULLET]');
    expect(result).toContain('Rank: 1/30');

    // Equipment
    expect(result).toContain('Equipment: Blinkers, Front Bandages');
    expect(result).toContain('[FIRST TIME: Blinkers]');
    expect(result).toContain('Changes: Added blinkers');

    // Trainer patterns
    expect(result).toContain('Trainer Patterns:');
    expect(result).toContain('★First Blinkers: 3/10 (30%) ROI: 250%');
    expect(result).toContain('Dirt Sprint: 10/50 (20%)');
  });

  it('only shows trainer patterns with 5+ starts', () => {
    const horseScore = createMockHorseScore({
      trainerPatterns: {
        ...createDefaultTrainerPatternsForAI(),
        firstTimeBlinkers: { starts: 3, wins: 1, winPercent: 33, roi: 150 }, // < 5 starts
        dirtSprint: { starts: 10, wins: 2, winPercent: 20, roi: 100 }, // >= 5 starts
      },
    });

    const result = formatHorseForPrompt(horseScore);

    expect(result).toContain('Dirt Sprint: 2/10');
    expect(result).not.toContain('First Blinkers: 1/3');
  });

  it('shows no significant patterns message when all categories have < 5 starts', () => {
    const horseScore = createMockHorseScore({
      trainerPatterns: createDefaultTrainerPatternsForAI(), // All have 0 starts
    });

    const result = formatHorseForPrompt(horseScore);

    expect(result).toContain('No significant patterns (< 5 starts in all categories)');
  });

  it('only shows breeding for horses with < 5 lifetime starts', () => {
    // Horse with < 5 starts should show breeding
    const lightlyRacedHorse = createMockHorseScore({
      breeding: { sire: 'Into Mischief', damSire: 'Storm Cat', whereBred: 'KY' },
      formIndicators: {
        daysSinceLastRace: 21,
        averageBeyer: 80,
        bestBeyer: 85,
        lastBeyer: 80,
        earlySpeedRating: 90,
        lifetimeStarts: 3,
        lifetimeWins: 1,
        lifetimeWinRate: 0.33,
      },
    });

    const lightlyRacedResult = formatHorseForPrompt(lightlyRacedHorse);
    expect(lightlyRacedResult).toContain('Breeding: Into Mischief x Storm Cat (KY)');

    // Horse with >= 5 starts should NOT show breeding
    const experiencedHorse = createMockHorseScore({
      breeding: { sire: 'Into Mischief', damSire: 'Storm Cat', whereBred: 'KY' },
      formIndicators: {
        daysSinceLastRace: 21,
        averageBeyer: 80,
        bestBeyer: 85,
        lastBeyer: 80,
        earlySpeedRating: 90,
        lifetimeStarts: 15,
        lifetimeWins: 4,
        lifetimeWinRate: 0.27,
      },
    });

    const experiencedResult = formatHorseForPrompt(experiencedHorse);
    expect(experiencedResult).not.toContain('Breeding:');
  });

  it('handles sparse data gracefully (no PPs, no workouts)', () => {
    const sparseHorse = createMockHorseScore({
      pastPerformances: [],
      workouts: [],
      equipment: {
        blinkers: false,
        blinkersOff: false,
        frontBandages: false,
        tongueTie: false,
        nasalStrip: false,
        shadowRoll: false,
        barShoes: false,
        mudCaulks: false,
        firstTimeEquipment: [],
        equipmentChanges: [],
      },
    });

    const result = formatHorseForPrompt(sparseHorse);

    expect(result).toContain('Past Performances: No race history');
    expect(result).not.toContain('Workouts:'); // Section should be omitted
    expect(result).not.toContain('[BULLET]');
    // Should still have core sections
    expect(result).toContain('Algorithm Rank:');
    expect(result).toContain('Form:');
  });

  it('handles null values in form indicators', () => {
    const horseWithNulls = createMockHorseScore({
      formIndicators: {
        daysSinceLastRace: null,
        averageBeyer: null,
        bestBeyer: null,
        lastBeyer: null,
        earlySpeedRating: null,
        lifetimeStarts: 0,
        lifetimeWins: 0,
        lifetimeWinRate: 0,
      },
    });

    const result = formatHorseForPrompt(horseWithNulls);

    expect(result).toContain('Days Off: First start');
    expect(result).toContain('Last N/A / Best N/A / Avg N/A');
    expect(result).toContain('Early Speed Rating: N/A');
  });

  it('marks exceptional trainer patterns with star', () => {
    const horseWithExceptional = createMockHorseScore({
      trainerPatterns: {
        ...createDefaultTrainerPatternsForAI(),
        afterClaim: { starts: 20, wins: 6, winPercent: 30, roi: 250 }, // Both > 25% win AND > 200% ROI
        wetTrack: { starts: 15, wins: 4, winPercent: 27, roi: 150 }, // > 25% win only
        dirtRoute: { starts: 10, wins: 2, winPercent: 20, roi: 220 }, // > 200% ROI only
      },
    });

    const result = formatHorseForPrompt(horseWithExceptional);

    expect(result).toContain('★After Claim:');
    expect(result).toContain('★Wet Track:');
    expect(result).toContain('★Dirt Route:');
  });
});

// ============================================================================
// TESTS - buildRaceAnalysisPrompt
// ============================================================================

describe('buildRaceAnalysisPrompt', () => {
  it('returns a string', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('includes race header information', () => {
    const race = createMockParsedRace({
      header: createMockRaceHeader({
        trackName: 'Santa Anita',
        trackCode: 'SA',
        raceNumber: 5,
        distance: '6 Furlongs',
        surface: 'dirt',
        trackCondition: 'fast',
        classification: 'claiming',
        purseFormatted: '$35,000',
      }),
    });
    const scoringResult = createMockScoringResult();

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('Santa Anita');
    expect(prompt).toContain('SA');
    expect(prompt).toContain('Race 5');
    expect(prompt).toContain('6 Furlongs');
    expect(prompt).toContain('dirt');
    expect(prompt).toContain('fast');
    expect(prompt).toContain('claiming');
    expect(prompt).toContain('$35,000');
  });

  it('includes all non-scratched horses', () => {
    const race = createMockParsedRace({
      horses: [
        createMockHorseEntry({ programNumber: 1, horseName: 'Fast Runner' }),
        createMockHorseEntry({ programNumber: 2, horseName: 'Steady Eddie' }),
        createMockHorseEntry({ programNumber: 3, horseName: 'Longshot Larry' }),
      ],
    });
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({ programNumber: 1, horseName: 'Fast Runner', isScratched: false }),
        createMockHorseScore({ programNumber: 2, horseName: 'Steady Eddie', isScratched: false }),
        createMockHorseScore({ programNumber: 3, horseName: 'Longshot Larry', isScratched: false }),
      ],
    });

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('Fast Runner');
    expect(prompt).toContain('Steady Eddie');
    expect(prompt).toContain('Longshot Larry');
    expect(prompt).toContain('#1');
    expect(prompt).toContain('#2');
    expect(prompt).toContain('#3');
  });

  it('excludes scratched horses', () => {
    const race = createMockParsedRace({
      horses: [
        createMockHorseEntry({ programNumber: 1, horseName: 'Fast Runner' }),
        createMockHorseEntry({ programNumber: 2, horseName: 'Scratched Horse' }),
        createMockHorseEntry({ programNumber: 3, horseName: 'Longshot Larry' }),
      ],
    });
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({ programNumber: 1, horseName: 'Fast Runner', isScratched: false }),
        createMockHorseScore({ programNumber: 2, horseName: 'Scratched Horse', isScratched: true }),
        createMockHorseScore({ programNumber: 3, horseName: 'Longshot Larry', isScratched: false }),
      ],
    });

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('Fast Runner');
    expect(prompt).toContain('Longshot Larry');
    // Scratched horse should not appear in the HORSES section
    expect(prompt).not.toContain('Scratched Horse');
  });

  it('includes algorithm analysis information', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      raceAnalysis: createMockRaceAnalysis({
        paceScenario: {
          expectedPace: 'hot',
          likelyLeader: 1,
          speedDuelProbability: 0.75,
          earlySpeedCount: 3,
        },
        fieldStrength: 'strong',
        vulnerableFavorite: true,
        likelyPaceCollapse: true,
      }),
    });

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('hot pace expected');
    expect(prompt).toContain('#1');
    expect(prompt).toContain('75%');
    expect(prompt).toContain('strong');
    expect(prompt).toContain('Vulnerable Favorite (algo): YES');
    expect(prompt).toContain('Pace Collapse Likely: YES');
  });

  it('includes score breakdown for each horse', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          programNumber: 1,
          horseName: 'Fast Runner',
          rank: 1,
          finalScore: 185,
          confidenceTier: 'high',
          breakdown: {
            speedScore: 52,
            classScore: 40,
            formScore: 30,
            paceScore: 28,
            connectionScore: 25,
          },
        }),
      ],
    });

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('Algorithm Rank: 1');
    expect(prompt).toContain('Score: 185/368');
    expect(prompt).toContain('Tier: high');
    expect(prompt).toContain('Speed 52/60');
    expect(prompt).toContain('Class 40/48');
    expect(prompt).toContain('Form 30/36');
    expect(prompt).toContain('Pace 28/36');
    expect(prompt).toContain('Connections 25/30');
  });

  it('includes positive and negative factors', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      scores: [
        createMockHorseScore({
          programNumber: 1,
          horseName: 'Fast Runner',
          positiveFactors: ['Top Beyer figure', 'Strong trainer stats'],
          negativeFactors: ['First time at distance'],
        }),
      ],
    });

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('Top Beyer figure');
    expect(prompt).toContain('Strong trainer stats');
    expect(prompt).toContain('First time at distance');
  });

  it('includes instructions for JSON response', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('RESPOND WITH VALID JSON ONLY');
    expect(prompt).toContain('"raceNarrative"');
    expect(prompt).toContain('"horseInsights"');
    expect(prompt).toContain('"topPick"');
    expect(prompt).toContain('"valueLabel"');
  });

  it('includes track intelligence section when available', () => {
    const race = createMockParsedRace();
    const trackIntel = createMockTrackIntelligence();
    const scoringResult = createMockScoringResult({
      raceAnalysis: createMockRaceAnalysis({
        trackIntelligence: trackIntel,
      }),
    });

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('TRACK: Santa Anita (SA)');
    expect(prompt).toContain('POST BIAS:');
    expect(prompt).toContain('SPEED BIAS:');
  });

  it('shows track intelligence not available message when null', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult({
      raceAnalysis: createMockRaceAnalysis({
        trackIntelligence: null,
      }),
    });

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('NOT AVAILABLE');
    expect(prompt).toContain('use caution on pace/position analysis');
  });

  it('includes value hunting framework', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('VALUE HUNTING FRAMEWORK');
    expect(prompt).toContain('ANALYZE THE FAVORITE CRITICALLY');
    expect(prompt).toContain('HUNT FOR MASKED ABILITY');
    expect(prompt).toContain('IDENTIFY PACE ADVANTAGES');
    expect(prompt).toContain('SPOT TRAINER INTENT PATTERNS');
    expect(prompt).toContain('EVALUATE FITNESS SIGNALS');
    expect(prompt).toContain('ASSESS DISTANCE/SURFACE EXPERIENCE');
  });

  it('includes one-liner and valuePlay guidance', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    // One-liner guidance
    expect(prompt).toContain('ONE-LINER GUIDANCE');
    expect(prompt).toContain('BAD: "Nice horse, should run well"');
    expect(prompt).toContain('GOOD: "Lone speed, figures to wire field if breaks clean"');
    expect(prompt).toContain('GOOD: "Blocked last 2, hidden 85+ Beyer');

    // valuePlay guidance
    expect(prompt).toContain('VALUE PLAY GUIDANCE');
    expect(prompt).toContain('valuePlay should be a horse ranked 3rd-6th');
    expect(prompt).toContain('valuePlay should NOT be the topPick');
  });

  it('includes trainer pattern star notation in guidance', () => {
    const race = createMockParsedRace();
    const scoringResult = createMockScoringResult();

    const prompt = buildRaceAnalysisPrompt(race, scoringResult);

    expect(prompt).toContain('trainer category stats marked with ★');
    expect(prompt).toContain('>25% win or >200% ROI');
  });
});
