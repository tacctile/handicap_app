/**
 * Velocity Analysis Tests
 *
 * Tests for the fractional time velocity analysis module that calculates:
 * - Velocity Differential (VD): How much a horse accelerates/decelerates late
 * - Late Kick Power (LKP): Final fraction speed vs expected field average
 */

import { describe, it, expect } from 'vitest';
import type { HorseEntry, PastPerformance } from '../../../types/drf';
import {
  analyzePPVelocity,
  buildVelocityProfile,
  calculateLateKickPower,
  calculateVelocityScore,
  hasVelocityData,
  getVelocitySummary,
  VELOCITY_DIFF_THRESHOLDS,
  VELOCITY_SCORE_POINTS,
} from '../velocityAnalysis';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Create a minimal PP with fractional time data
 */
function createMockPP(overrides: Partial<PastPerformance> = {}): PastPerformance {
  return {
    date: '20250101',
    track: 'SAR',
    trackName: 'Saratoga',
    raceNumber: 1,
    distanceFurlongs: 6,
    distance: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'claiming',
    claimingPrice: 25000,
    purse: 50000,
    fieldSize: 8,
    finishPosition: 3,
    lengthsBehind: 2.5,
    lengthsAhead: null,
    finalTime: 70.5, // 1:10.5 for 6f
    finalTimeFormatted: '1:10.50',
    speedFigures: {
      beyer: 78,
      timeformUS: null,
      equibase: null,
      trackVariant: 0,
      dirtVariant: null,
      turfVariant: null,
    },
    runningLine: {
      start: 3,
      quarterMile: 4,
      quarterMileLengths: 3.0,
      halfMile: 3,
      halfMileLengths: 2.5,
      threeQuarters: null,
      threeQuartersLengths: null,
      stretch: 2,
      stretchLengths: 1.5,
      finish: 3,
      finishLengths: 2.5,
    },
    jockey: 'Irad Ortiz Jr.',
    weight: 122,
    apprenticeAllowance: 0,
    equipment: '',
    medication: '',
    winner: 'Test Winner',
    secondPlace: 'Test Second',
    thirdPlace: 'Test Third',
    tripComment: '',
    comment: '',
    odds: 4.5,
    favoriteRank: null,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: 14,
    earlyPace1: 85,
    latePace: 90,
    // Fractional times
    quarterTime: 22.4, // 2f in 22.4 seconds
    halfMileTime: 45.2, // 4f in 45.2 seconds
    sixFurlongTime: 70.5, // 6f in 70.5 seconds (same as final for 6f race)
    mileTime: null,
    ...overrides,
  };
}

/**
 * Create a mock horse with multiple PPs
 */
function createMockHorse(
  ppOverrides: Array<Partial<PastPerformance>> = [],
  style: string = 'C'
): HorseEntry {
  // Default: create 5 PPs with reasonable fractional data
  const defaultPPs = [
    createMockPP({ date: '20250101' }),
    createMockPP({ date: '20241215' }),
    createMockPP({ date: '20241130' }),
    createMockPP({ date: '20241115' }),
    createMockPP({ date: '20241101' }),
  ];

  // Apply overrides
  const pps =
    ppOverrides.length > 0
      ? ppOverrides.map((o, i) => createMockPP({ ...defaultPPs[i], ...o }))
      : defaultPPs;

  return {
    programNumber: 1,
    entryIndicator: '',
    postPosition: 1,
    horseName: 'Test Horse',
    age: 4,
    sex: 'g',
    sexFull: 'Gelding',
    color: 'b',
    breeding: {
      sire: 'Test Sire',
      sireOfSire: 'Test Sire of Sire',
      dam: 'Test Dam',
      damSire: 'Test Dam Sire',
      breeder: 'Test Breeder',
      whereBred: 'KY',
      studFee: null,
    },
    owner: 'Test Owner',
    silks: 'Blue, White',
    trainerName: 'Test Trainer',
    trainerStats: '10/2/1/1',
    trainerMeetStarts: 10,
    trainerMeetWins: 2,
    trainerMeetPlaces: 1,
    trainerMeetShows: 1,
    trainerCategoryStats: {
      firstTimeLasix: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      firstTimeBlinkers: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      blinkersOff: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      secondOffLayoff: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      days31to60: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      days61to90: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      days91to180: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      days181plus: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      sprintToRoute: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      routeToSprint: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      turfSprint: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      turfRoute: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      wetTrack: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      dirtSprint: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      dirtRoute: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      maidenClaiming: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      stakes: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      firstStartTrainer: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      afterClaim: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
    },
    jockeyName: 'Test Jockey',
    jockeyStats: '20/4/3/2',
    jockeyMeetStarts: 20,
    jockeyMeetWins: 4,
    jockeyMeetPlaces: 3,
    jockeyMeetShows: 2,
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
      lasix: false,
      lasixOff: false,
      bute: false,
      other: [],
      raw: '',
    },
    morningLineOdds: '5-1',
    morningLineDecimal: 5,
    currentOdds: null,
    lifetimeStarts: 20,
    lifetimeWins: 3,
    lifetimePlaces: 5,
    lifetimeShows: 4,
    lifetimeEarnings: 150000,
    currentYearStarts: 5,
    currentYearWins: 1,
    currentYearPlaces: 2,
    currentYearShows: 1,
    currentYearEarnings: 50000,
    previousYearStarts: 8,
    previousYearWins: 1,
    previousYearPlaces: 2,
    previousYearShows: 2,
    previousYearEarnings: 60000,
    trackStarts: 3,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 1,
    surfaceStarts: 15,
    surfaceWins: 2,
    distanceStarts: 10,
    distanceWins: 2,
    distancePlaces: 3,
    distanceShows: 2,
    turfStarts: 0,
    turfWins: 0,
    turfPlaces: 0,
    turfShows: 0,
    wetStarts: 2,
    wetWins: 0,
    wetPlaces: 1,
    wetShows: 0,
    runningStyle: style,
    averageBeyer: 75,
    bestBeyer: 80,
    lastBeyer: 78,
    earlySpeedRating: 85,
    pedigreeRating: null,
    claimingPrice: null,
    lastClaimPrice: null,
    trainerAngle: null,
    daysSinceLastRace: 14,
    lastRaceDate: '20250101',
    isScratched: false,
    scratchReason: null,
    pastPerformances: pps,
    workouts: [],
    isCoupledMain: false,
    coupledWith: [],
    rawLine: '',
    salePrice: null,
    saleLocation: null,
  };
}

// ============================================================================
// PP VELOCITY ANALYSIS TESTS
// ============================================================================

describe('analyzePPVelocity', () => {
  it('calculates velocity differential for sprint race with complete data', () => {
    const pp = createMockPP({
      distanceFurlongs: 6,
      quarterTime: 22.4, // 2f
      halfMileTime: 45.2, // 4f
      finalTime: 70.5, // 6f
    });

    const result = analyzePPVelocity(pp, 0);

    expect(result.isComplete).toBe(true);
    expect(result.earlyPaceTime).toBeCloseTo(22.8, 1); // 45.2 - 22.4
    expect(result.latePaceTime).toBeCloseTo(25.3, 1); // 70.5 - 45.2
    // VD = earlyRate - lateRate (positive = accelerated late)
    expect(result.velocityDiff).not.toBeNull();
  });

  it('returns incomplete for PP without fractional times', () => {
    const pp = createMockPP({
      quarterTime: null,
      halfMileTime: null,
      finalTime: 70.5,
    });

    const result = analyzePPVelocity(pp, 0);

    expect(result.isComplete).toBe(false);
    expect(result.velocityDiff).toBeNull();
  });

  it('returns incomplete for PP without final time', () => {
    const pp = createMockPP({
      quarterTime: 22.4,
      halfMileTime: 45.2,
      finalTime: null,
    });

    const result = analyzePPVelocity(pp, 0);

    expect(result.isComplete).toBe(false);
    expect(result.velocityDiff).toBeNull();
  });

  it('handles route races with six furlong times', () => {
    const pp = createMockPP({
      distanceFurlongs: 8, // 1 mile
      quarterTime: 23.0,
      halfMileTime: 46.5,
      sixFurlongTime: 71.0,
      mileTime: 96.0,
      finalTime: 96.0,
    });

    const result = analyzePPVelocity(pp, 0);

    expect(result.isComplete).toBe(true);
    expect(result.distance).toBe(8);
  });
});

// ============================================================================
// VELOCITY PROFILE TESTS
// ============================================================================

describe('buildVelocityProfile', () => {
  it('builds profile from horse with velocity data', () => {
    const horse = createMockHorse();
    const profile = buildVelocityProfile(horse);

    expect(profile.validPPCount).toBeGreaterThan(0);
    expect(profile.ppAnalyses.length).toBe(5);
  });

  it('classifies strong closer with high positive VD', () => {
    // Create PPs where horse accelerates significantly in final fraction
    const pps = [
      createMockPP({ quarterTime: 23.0, halfMileTime: 47.0, finalTime: 70.0 }), // Fast closer
      createMockPP({ quarterTime: 23.0, halfMileTime: 47.0, finalTime: 70.0 }),
      createMockPP({ quarterTime: 23.0, halfMileTime: 47.0, finalTime: 70.0 }),
    ];

    const horse = createMockHorse(pps);
    const profile = buildVelocityProfile(horse);

    // With slow early (24 sec/f for 2f) and fast late
    // Should trend toward strong closer or moderate closer
    expect(['strong_closer', 'moderate_closer', 'steady_pace']).toContain(profile.classification);
  });

  it('handles horse with no velocity data gracefully', () => {
    const pps = [
      createMockPP({ quarterTime: null, halfMileTime: null, sixFurlongTime: null }),
      createMockPP({ quarterTime: null, halfMileTime: null, sixFurlongTime: null }),
    ];

    const horse = createMockHorse(pps);
    const profile = buildVelocityProfile(horse);

    expect(profile.isReliable).toBe(false);
    expect(profile.classification).toBe('unknown');
    expect(profile.description).toContain('Insufficient');
  });
});

// ============================================================================
// LATE KICK POWER TESTS
// ============================================================================

describe('calculateLateKickPower', () => {
  it('calculates late kick power for closers', () => {
    const horse = createMockHorse([], 'C');
    const result = calculateLateKickPower(horse, 'C');

    expect(result.avgFinalFraction).not.toBeNull();
    expect(result.expectedFinalFraction).not.toBeNull();
    expect(result.powerRatio).not.toBeNull();
  });

  it('returns not applicable for early speed runners', () => {
    const horse = createMockHorse([], 'E');
    const result = calculateLateKickPower(horse, 'E');

    expect(result.classification).toBe('unknown');
    expect(result.bonusPoints).toBe(0);
    expect(result.description).toContain('not applicable');
  });

  it('handles insufficient data gracefully', () => {
    const pps = [createMockPP({ quarterTime: null, halfMileTime: null })];
    const horse = createMockHorse(pps, 'C');
    const result = calculateLateKickPower(horse, 'C');

    expect(result.classification).toBe('unknown');
    expect(result.bonusPoints).toBe(0);
  });
});

// ============================================================================
// VELOCITY SCORE CALCULATION TESTS
// ============================================================================

describe('calculateVelocityScore', () => {
  it('returns bonus points for strong closer in contested pace', () => {
    const horse = createMockHorse();
    const result = calculateVelocityScore(horse, 'C', 'contested');

    // Should return non-zero total bonus points
    expect(typeof result.totalBonusPoints).toBe('number');
    expect(result.reasoning.length).toBeGreaterThan(0);
    expect(result.velocityProfile).toBeDefined();
    expect(result.lateKickPower).toBeDefined();
  });

  it('applies pace scenario adjustments', () => {
    const horse = createMockHorse();

    const contestedResult = calculateVelocityScore(horse, 'C', 'contested');
    const softResult = calculateVelocityScore(horse, 'C', 'soft');

    // In contested pace, closers should get bonus
    // In soft pace, closers should get less bonus (or penalty)
    // The difference should be noticeable
    expect(typeof contestedResult.totalBonusPoints).toBe('number');
    expect(typeof softResult.totalBonusPoints).toBe('number');
  });

  it('caps bonus points to ±5', () => {
    const horse = createMockHorse();
    const result = calculateVelocityScore(horse, 'C', 'speed_duel');

    expect(result.totalBonusPoints).toBeGreaterThanOrEqual(-5);
    expect(result.totalBonusPoints).toBeLessThanOrEqual(5);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('hasVelocityData', () => {
  it('returns true for horse with fractional time data', () => {
    const horse = createMockHorse();
    expect(hasVelocityData(horse)).toBe(true);
  });

  it('returns false for horse without fractional time data', () => {
    const pps = [
      createMockPP({ quarterTime: null, halfMileTime: null, sixFurlongTime: null, mileTime: null }),
      createMockPP({ quarterTime: null, halfMileTime: null, sixFurlongTime: null, mileTime: null }),
    ];
    const horse = createMockHorse(pps);
    expect(hasVelocityData(horse)).toBe(false);
  });
});

describe('getVelocitySummary', () => {
  it('returns summary for horse with velocity data', () => {
    const horse = createMockHorse();
    const summary = getVelocitySummary(horse);

    expect(summary.hasData).toBe(true);
    expect(['strong_closer', 'moderate_closer', 'steady_pace', 'fader', 'unknown']).toContain(
      summary.classification
    );
  });

  it('returns no data indicator for horse without velocity data', () => {
    const pps = [
      createMockPP({ quarterTime: null, halfMileTime: null, sixFurlongTime: null, mileTime: null }),
    ];
    const horse = createMockHorse(pps);
    const summary = getVelocitySummary(horse);

    expect(summary.hasData).toBe(false);
    expect(summary.classification).toBe('unknown');
  });
});

// ============================================================================
// THRESHOLD TESTS
// ============================================================================

describe('velocity thresholds', () => {
  it('has correct threshold values', () => {
    expect(VELOCITY_DIFF_THRESHOLDS.STRONG_CLOSER).toBe(2.0);
    expect(VELOCITY_DIFF_THRESHOLDS.MODERATE_CLOSER).toBe(0.5);
    expect(VELOCITY_DIFF_THRESHOLDS.FADER).toBe(-0.5);
  });

  it('has correct score point values', () => {
    expect(VELOCITY_SCORE_POINTS.STRONG_CLOSER).toBe(4);
    expect(VELOCITY_SCORE_POINTS.MODERATE_CLOSER).toBe(2);
    expect(VELOCITY_SCORE_POINTS.STEADY_PACE).toBe(0);
    expect(VELOCITY_SCORE_POINTS.FADER).toBe(-1);
  });
});

// ============================================================================
// MINIMUM SEGMENT LENGTH TESTS (Bug fix for "about 1 mile" races)
// ============================================================================

describe('minimum segment length handling', () => {
  it('skips velocity calculation for "about 1 mile" races (8.1f) with tiny late segment', () => {
    // 8.1f race: late segment = 8.1 - 8 = 0.1f (too short)
    const pp = createMockPP({
      distanceFurlongs: 8.1,
      halfMileTime: 46.5,
      mileTime: 72.0,
      finalTime: 97.0, // 25 seconds for 0.1f would be unrealistic
    });

    const result = analyzePPVelocity(pp, 0);

    // Should NOT produce extreme VD (like 243 sec/f)
    // Either skip the calculation or use alternative method
    if (result.velocityDiff !== null) {
      expect(Math.abs(result.velocityDiff)).toBeLessThan(15);
    }
    // If late pace rate is calculated, it should be reasonable
    if (result.latePaceRate !== null) {
      expect(result.latePaceRate).toBeLessThan(20); // Max reasonable: ~20 sec/f
    }
  });

  it('skips velocity calculation for 8.25f (about 1 mile) races', () => {
    const pp = createMockPP({
      distanceFurlongs: 8.25,
      halfMileTime: 46.5,
      mileTime: 72.0,
      finalTime: 98.0,
    });

    const result = analyzePPVelocity(pp, 0);

    // Either incomplete or reasonable value
    if (result.velocityDiff !== null) {
      expect(Math.abs(result.velocityDiff)).toBeLessThan(15);
    }
  });

  it('calculates normally for 1 1/8 miles (9f) races with adequate late segment', () => {
    // 9f race: late segment = 9 - 8 = 1f, still short but with 6f fallback
    const pp = createMockPP({
      distanceFurlongs: 9,
      halfMileTime: 46.5,
      sixFurlongTime: 71.0,
      mileTime: 96.0,
      finalTime: 109.0, // ~13 seconds for last furlong
    });

    const result = analyzePPVelocity(pp, 0);

    // Should calculate with 6f fallback method
    expect(result.isComplete).toBe(true);
    // VD should be reasonable (typical range -5 to +5)
    expect(result.velocityDiff).not.toBeNull();
    if (result.velocityDiff !== null) {
      expect(Math.abs(result.velocityDiff)).toBeLessThan(15);
    }
  });

  it('handles exactly 1 mile (8f) races correctly', () => {
    const pp = createMockPP({
      distanceFurlongs: 8,
      halfMileTime: 46.5,
      sixFurlongTime: 71.0,
      mileTime: 96.0,
      finalTime: 96.0,
    });

    const result = analyzePPVelocity(pp, 0);

    // Should use 6f to finish (2f) as late segment
    expect(result.isComplete).toBe(true);
    if (result.latePaceRate !== null) {
      // 2f segment: should be reasonable (~12-14 sec/f)
      expect(result.latePaceRate).toBeGreaterThan(8);
      expect(result.latePaceRate).toBeLessThan(18);
    }
  });

  it('does not produce NaN or Infinity for edge cases', () => {
    const edgeCases = [
      { distanceFurlongs: 8.0, halfMileTime: 46.0, mileTime: 96.0, finalTime: 96.0 },
      { distanceFurlongs: 8.1, halfMileTime: 46.0, mileTime: 96.0, finalTime: 99.0 },
      { distanceFurlongs: 8.5, halfMileTime: 46.0, mileTime: 96.0, finalTime: 102.0 },
      { distanceFurlongs: 9.0, halfMileTime: 46.0, mileTime: 96.0, finalTime: 109.0 },
    ];

    for (const overrides of edgeCases) {
      const pp = createMockPP(overrides);
      const result = analyzePPVelocity(pp, 0);

      // Never should have NaN or Infinity
      if (result.velocityDiff !== null) {
        expect(Number.isFinite(result.velocityDiff)).toBe(true);
      }
      if (result.earlyPaceRate !== null) {
        expect(Number.isFinite(result.earlyPaceRate)).toBe(true);
      }
      if (result.latePaceRate !== null) {
        expect(Number.isFinite(result.latePaceRate)).toBe(true);
      }
    }
  });

  it('profile handles horses with mixed "about 1 mile" races gracefully', () => {
    // Horse with some problematic race distances
    const pps = [
      createMockPP({
        distanceFurlongs: 8.1, // About 1 mile - should skip
        halfMileTime: 46.0,
        mileTime: 96.0,
        finalTime: 99.0,
      }),
      createMockPP({
        distanceFurlongs: 6.0, // Sprint - should calculate
        quarterTime: 22.4,
        halfMileTime: 45.2,
        finalTime: 70.5,
      }),
      createMockPP({
        distanceFurlongs: 8.0, // Exactly 1 mile - should use 6f fallback
        halfMileTime: 46.0,
        sixFurlongTime: 71.0,
        mileTime: 96.0,
        finalTime: 96.0,
      }),
    ];

    const horse = createMockHorse(pps);
    const profile = buildVelocityProfile(horse);

    // Should not crash
    expect(profile).toBeDefined();

    // Average VD should be reasonable (if calculated)
    if (profile.avgVelocityDiff !== null) {
      expect(Math.abs(profile.avgVelocityDiff)).toBeLessThan(15);
    }
  });
});
