/**
 * Data Completeness Penalties Tests (Phase 2/3)
 *
 * Tests the penalty system for horses with incomplete data:
 * - Speed figure penalties (no figures → 22.5 pts, 1 fig → 33.75 max, etc.) [v3.0: 90 max]
 * - Form penalties (0 PPs → 10 max, 1 PP → 20 max, etc.)
 * - Connection penalties (shipper with no career → half baseline)
 * - Pace penalties (no EP1/LP or running style → reduced score)
 * - Low confidence penalty (criticalComplete < 75% → 15% base score reduction)
 *
 * v3.0: Speed max increased from 48 to 90
 */

import { describe, it, expect } from 'vitest';
import { getSpeedConfidenceMultiplier } from '../speedClass';
import { getFormConfidenceMultiplier } from '../form';
import { getPaceConfidenceMultiplier } from '../pace';
import type { HorseEntry, PastPerformance } from '../../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../../types/drf';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a minimal mock horse entry
 */
function createMockHorse(options: {
  pastPerformances?: PastPerformance[];
  trainerMeetStarts?: number;
  jockeyMeetStarts?: number;
  runningStyle?: string | null;
}): HorseEntry {
  return {
    programNumber: 1,
    entryIndicator: '',
    postPosition: 1,
    horseName: 'Test Horse',
    age: 4,
    sex: 'c',
    sexFull: 'Colt',
    color: 'b',
    breeding: {
      sire: 'Test Sire',
      sireOfSire: 'Test Grandsire',
      dam: 'Test Dam',
      damSire: 'Test Damsire',
      breeder: 'Test Breeder',
      whereBred: 'KY',
      studFee: null,
    },
    owner: 'Test Owner',
    silks: 'Red, White',
    trainerName: 'Test Trainer',
    trainerStats: '',
    trainerMeetStarts: options.trainerMeetStarts ?? 50,
    trainerMeetWins: 10,
    trainerMeetPlaces: 8,
    trainerMeetShows: 7,
    trainerCategoryStats: createDefaultTrainerCategoryStats(),
    jockeyName: 'Test Jockey',
    jockeyStats: '',
    jockeyMeetStarts: options.jockeyMeetStarts ?? 100,
    jockeyMeetWins: 20,
    jockeyMeetPlaces: 18,
    jockeyMeetShows: 15,
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
    morningLineDecimal: 5.0,
    currentOdds: null,
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimePlaces: 3,
    lifetimeShows: 2,
    lifetimeEarnings: 100000,
    currentYearStarts: 5,
    currentYearWins: 1,
    currentYearPlaces: 2,
    currentYearShows: 1,
    currentYearEarnings: 50000,
    previousYearStarts: 5,
    previousYearWins: 1,
    previousYearPlaces: 1,
    previousYearShows: 1,
    previousYearEarnings: 50000,
    trackStarts: 3,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 0,
    surfaceStarts: 8,
    surfaceWins: 2,
    distanceStarts: 5,
    distanceWins: 1,
    distancePlaces: 2,
    distanceShows: 1,
    turfStarts: 2,
    turfWins: 0,
    turfPlaces: 1,
    turfShows: 1,
    wetStarts: 1,
    wetWins: 0,
    wetPlaces: 0,
    wetShows: 1,
    daysSinceLastRace: options.pastPerformances?.length ? 21 : null,
    lastRaceDate: options.pastPerformances?.length ? '20240101' : null,
    averageBeyer: null,
    bestBeyer: null,
    lastBeyer: null,
    earlySpeedRating: 85,
    runningStyle: options.runningStyle ?? 'E/P',
    pedigreeRating: null,
    claimingPrice: null,
    lastClaimPrice: null,
    trainerAngle: null,
    workouts: [],
    pastPerformances: options.pastPerformances ?? [],
    isScratched: false,
    scratchReason: null,
    isCoupledMain: false,
    coupledWith: [],
    rawLine: '',
    salePrice: null,
    saleLocation: null,
  };
}

// ============================================================================
// SPEED CONFIDENCE MULTIPLIER TESTS
// ============================================================================

describe('Speed Confidence Multiplier (Phase 2)', () => {
  it('should return 1.0 for 3+ figures in last 3 races', () => {
    expect(getSpeedConfidenceMultiplier(3)).toBe(1.0);
    expect(getSpeedConfidenceMultiplier(4)).toBe(1.0);
    expect(getSpeedConfidenceMultiplier(5)).toBe(1.0);
  });

  it('should return 0.75 for exactly 2 figures', () => {
    expect(getSpeedConfidenceMultiplier(2)).toBe(0.75);
  });

  it('should return 0.375 for exactly 1 figure', () => {
    expect(getSpeedConfidenceMultiplier(1)).toBe(0.375);
  });

  it('should return 0.25 for 0 figures (penalized baseline)', () => {
    expect(getSpeedConfidenceMultiplier(0)).toBe(0.25);
  });

  it('should cap max speed score based on figure count', () => {
    // v3.0: Max speed score is 90 pts
    // 3+ figures → 90 max
    expect(90 * getSpeedConfidenceMultiplier(3)).toBe(90);
    // 2 figures → 67.5 max
    expect(90 * getSpeedConfidenceMultiplier(2)).toBe(67.5);
    // 1 figure → 33.75 max
    expect(90 * getSpeedConfidenceMultiplier(1)).toBe(33.75);
    // 0 figures → 22.5 max
    expect(90 * getSpeedConfidenceMultiplier(0)).toBe(22.5);
  });
});

// ============================================================================
// FORM CONFIDENCE MULTIPLIER TESTS
// ============================================================================

describe('Form Confidence Multiplier (Phase 2)', () => {
  it('should return 1.0 for 3+ past performances', () => {
    expect(getFormConfidenceMultiplier(3)).toBe(1.0);
    expect(getFormConfidenceMultiplier(4)).toBe(1.0);
    expect(getFormConfidenceMultiplier(10)).toBe(1.0);
  });

  it('should return 0.6 for exactly 2 PPs', () => {
    expect(getFormConfidenceMultiplier(2)).toBe(0.6);
  });

  it('should return 0.4 for exactly 1 PP', () => {
    expect(getFormConfidenceMultiplier(1)).toBe(0.4);
  });

  it('should return 0.2 for 0 PPs (first-time starter, penalized)', () => {
    expect(getFormConfidenceMultiplier(0)).toBe(0.2);
  });

  it('should cap max form score based on PP count', () => {
    // Max form score is 50 pts
    // 3+ PPs → 50 max
    expect(50 * getFormConfidenceMultiplier(3)).toBe(50);
    // 2 PPs → 30 max
    expect(50 * getFormConfidenceMultiplier(2)).toBe(30);
    // 1 PP → 20 max
    expect(50 * getFormConfidenceMultiplier(1)).toBe(20);
    // 0 PPs → 10 max
    expect(50 * getFormConfidenceMultiplier(0)).toBe(10);
  });
});

// ============================================================================
// PACE CONFIDENCE MULTIPLIER TESTS
// ============================================================================

describe('Pace Confidence Multiplier (Phase 2)', () => {
  it('should return 1.0 when both EP1/LP and running style present', () => {
    expect(getPaceConfidenceMultiplier(true, true)).toBe(1.0);
  });

  it('should return 0.75 when EP1/LP present but running style unknown', () => {
    expect(getPaceConfidenceMultiplier(true, false)).toBe(0.75);
  });

  it('should return 0.5 when running style confirmed but no EP1/LP', () => {
    expect(getPaceConfidenceMultiplier(false, true)).toBe(0.5);
  });

  it('should return 0.35 when neither EP1/LP nor running style present', () => {
    expect(getPaceConfidenceMultiplier(false, false)).toBe(0.35);
  });

  it('should cap max pace score based on data availability', () => {
    // Max pace score is 45 pts
    // Both present → 45 max
    expect(45 * getPaceConfidenceMultiplier(true, true)).toBe(45);
    // Only EP1/LP → ~34 max
    expect(Math.round(45 * getPaceConfidenceMultiplier(true, false))).toBe(34);
    // Only style → ~23 max
    expect(Math.round(45 * getPaceConfidenceMultiplier(false, true))).toBe(23);
    // Neither → ~16 max
    expect(Math.round(45 * getPaceConfidenceMultiplier(false, false))).toBe(16);
  });
});

// ============================================================================
// COMBINED PENALTY SCENARIO TESTS
// ============================================================================

describe('Combined Missing Data Penalty Scenarios', () => {
  describe('First-Time Starter (FTS) Penalties', () => {
    it('should heavily penalize FTS with no data', () => {
      // FTS gets:
      // - Speed: 22.5 pts (25% of 90, no figures) [v3.0: was 12 pts]
      // - Form: 10 pts max (20% of 50, no PPs)
      // - Pace: ~16 pts max (35% of 45, no EP1/LP or style)
      // Total max from these categories: ~48.5 pts vs ~185 for proven horse [v3.0: increased spread]

      const speedMultiplier = getSpeedConfidenceMultiplier(0); // 0.25
      const formMultiplier = getFormConfidenceMultiplier(0); // 0.2
      const paceMultiplier = getPaceConfidenceMultiplier(false, false); // 0.35

      // Verify significant penalties
      expect(speedMultiplier).toBeLessThan(0.3);
      expect(formMultiplier).toBeLessThan(0.3);
      expect(paceMultiplier).toBeLessThan(0.4);

      // Combined impact should be severe
      // v3.0: Speed max is now 90
      const combinedMaxPenalty = 90 * speedMultiplier + 50 * formMultiplier + 45 * paceMultiplier;
      const fullScoreMax = 90 + 50 + 45;
      expect(combinedMaxPenalty).toBeLessThan(fullScoreMax * 0.3); // Less than 30% of max
    });
  });

  describe('Shipper Penalties', () => {
    it('should create horse with 0 meet starts for shipper scenarios', () => {
      const shipper = createMockHorse({
        trainerMeetStarts: 0,
        jockeyMeetStarts: 0,
        pastPerformances: [], // No PPs to build career stats from
      });

      expect(shipper.trainerMeetStarts).toBe(0);
      expect(shipper.jockeyMeetStarts).toBe(0);
      expect(shipper.pastPerformances).toHaveLength(0);
    });
  });

  describe('Proven Horse vs FTS Score Spread', () => {
    it('should show significant score spread between proven and FTS', () => {
      // Proven horse with full data:
      // v3.0: Speed: 3 figures → 1.0 multiplier, can get up to 90 pts
      // Form: 5 PPs → 1.0 multiplier, can get up to 50 pts
      // Pace: EP1/LP + style → 1.0 multiplier, can get up to 45 pts
      const provenMaxFromCategories = 90 + 50 + 45;

      // FTS with no data:
      const ftsSpeedMax = Math.round(90 * getSpeedConfidenceMultiplier(0));
      const ftsFormMax = Math.round(50 * getFormConfidenceMultiplier(0));
      const ftsPaceMax = Math.round(45 * getPaceConfidenceMultiplier(false, false));
      const ftsMaxFromCategories = ftsSpeedMax + ftsFormMax + ftsPaceMax;

      // v3.0: Score gap should be 100+ points just from these three categories
      // (was 60+ with old 48 max, now 185 - ~49 = ~136)
      const scoreGap = provenMaxFromCategories - ftsMaxFromCategories;
      expect(scoreGap).toBeGreaterThan(100);
    });
  });
});

// ============================================================================
// DATA COMPLETENESS PENALTY VERIFICATION
// ============================================================================

describe('Penalty Amount Verification', () => {
  it('should apply correct speed figure penalty for no figures', () => {
    // v3.0: 25% of 90 = 22.5, rounded to 23
    const noFigureScore = Math.round(90 * getSpeedConfidenceMultiplier(0));
    expect(noFigureScore).toBe(23); // 25% of 90
  });

  it('should apply correct speed figure penalty for 1 figure', () => {
    const oneFigureMultiplier = getSpeedConfidenceMultiplier(1);
    // v3.0: A horse with 95 Beyer (which would normally score ~90 pts)
    // should be capped at ~34 pts with only 1 figure (37.5% of 90)
    const cappedScore = Math.round(90 * oneFigureMultiplier);
    expect(cappedScore).toBe(34);
  });

  it('should apply correct form penalty for first-time starter', () => {
    const ftsScore = Math.round(50 * getFormConfidenceMultiplier(0));
    expect(ftsScore).toBe(10); // 20% of 50
  });

  it('should apply correct form penalty for 1 PP', () => {
    const onePPScore = Math.round(50 * getFormConfidenceMultiplier(1));
    expect(onePPScore).toBe(20); // 40% of 50
  });

  it('should apply correct form penalty for 2 PPs', () => {
    const twoPPScore = Math.round(50 * getFormConfidenceMultiplier(2));
    expect(twoPPScore).toBe(30); // 60% of 50
  });

  it('should apply correct pace penalty for missing all pace data', () => {
    const noPaceScore = Math.round(45 * getPaceConfidenceMultiplier(false, false));
    expect(noPaceScore).toBe(16); // 35% of 45, rounded
  });
});
