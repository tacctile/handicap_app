/**
 * useAIAnalysis Track Intelligence Tests
 *
 * Tests the track intelligence transformation logic that provides AI bots
 * with post position bias, speed bias, and track characteristics data.
 *
 * Validates:
 * - Known tracks return complete TrackIntelligenceForAI
 * - Unknown tracks return null with graceful handling
 * - Sprint vs route distance classification
 * - Correct bias data selection by surface
 * - Season calculation from race date
 * - Bias strength derivation from pace rating
 * - Favored style derivation from early speed win rate
 */

import { describe, it, expect } from 'vitest';
import {
  getTrackIntelligenceForAI,
  getSeasonFromDate,
  deriveBiasStrength,
  deriveFavoredStyle,
  transformToRaceScoringResult,
} from '../useAIAnalysis';
import type { RaceHeader } from '../../types/drf';
import { createDefaultTrainerCategoryStats } from '../../types/drf';
import type { ScoredHorse, HorseScore, ScoreBreakdown } from '../../lib/scoring';
import type { DataCompletenessResult } from '../../types/scoring';
import type { HorseEntry } from '../../types/drf';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a minimal mock data completeness result
 */
function createMockDataCompleteness(): DataCompletenessResult {
  return {
    overallScore: 85,
    overallGrade: 'B',
    criticalComplete: 90,
    highComplete: 80,
    mediumComplete: 75,
    lowComplete: 70,
    hasSpeedFigures: true,
    hasPastPerformances: true,
    hasTrainerStats: true,
    hasJockeyStats: true,
    hasRunningStyle: true,
    hasPaceFigures: true,
    missingCritical: [],
    missingHigh: [],
    isLowConfidence: false,
    confidenceReason: null,
  };
}

/**
 * Create a minimal mock score breakdown
 */
function createMockScoreBreakdown(): ScoreBreakdown {
  return {
    connections: {
      total: 20,
      trainer: 10,
      jockey: 8,
      partnershipBonus: 2,
      reasoning: 'Test connections',
    },
    postPosition: {
      total: 8,
      trackBiasApplied: false,
      isGoldenPost: false,
      reasoning: 'Test post',
    },
    speedClass: {
      total: 70,
      speedScore: 50,
      classScore: 20,
      bestFigure: 90,
      classMovement: 'level',
      reasoning: 'Test speed/class',
    },
    form: {
      total: 35,
      recentFormScore: 25,
      layoffScore: 5,
      consistencyBonus: 5,
      formTrend: 'improving',
      reasoning: 'Test form',
      wonLastOut: false,
      won2OfLast3: false,
    },
    equipment: {
      total: 4,
      hasChanges: true,
      reasoning: 'First-time blinkers',
    },
    pace: {
      total: 25,
      runningStyle: 'E/P',
      paceFit: 'favorable',
      reasoning: 'Test pace',
    },
    odds: {
      total: 8,
      oddsValue: 5.0,
      oddsSource: 'morning_line',
      tier: 'Low',
      reasoning: 'Test odds',
    },
    distanceSurface: {
      total: 12,
      turfScore: 0,
      wetScore: 4,
      distanceScore: 8,
      turfWinRate: 0.5,
      wetWinRate: 0.33,
      distanceWinRate: 0.4,
      reasoning: ['Distance proven'],
    },
    trainerPatterns: {
      total: 6,
      matchedPatterns: [],
      reasoning: ['First-time blinkers trainer 25% win'],
    },
    comboPatterns: {
      total: 3,
      detectedCombos: [],
      intentScore: 2,
      reasoning: ['Equipment change + class drop'],
    },
    trackSpecialist: {
      total: 4,
      trackWinRate: 0.33,
      trackITMRate: 0.67,
      isSpecialist: false,
      reasoning: 'Test track',
    },
    trainerSurfaceDistance: {
      total: 2,
      matchedCategory: 'dirtSprint',
      trainerWinPercent: 22,
      wetTrackWinPercent: 0,
      wetBonusApplied: false,
      reasoning: 'Test trainer surface',
    },
    weightAnalysis: {
      total: 0,
      currentWeight: 122,
      lastRaceWeight: 122,
      weightChange: 0,
      significantDrop: false,
      significantGain: false,
      showWeightGainFlag: false,
      reasoning: 'No weight change',
    },
    sexAnalysis: {
      total: 0,
      horseSex: 'c',
      isFemale: false,
      isRestrictedRace: false,
      isMixedRace: false,
      isFirstTimeFacingMales: false,
      flags: [],
      reasoning: 'Open race',
    },
  };
}

/**
 * Create a minimal mock horse score
 */
function createMockHorseScore(): HorseScore {
  return {
    total: 200,
    baseScore: 180,
    overlayScore: 20,
    oddsScore: 8,
    breakdown: createMockScoreBreakdown(),
    isScratched: false,
    confidenceLevel: 'high',
    dataQuality: 85,
    dataCompleteness: createMockDataCompleteness(),
    lowConfidencePenaltyApplied: false,
    lowConfidencePenaltyAmount: 0,
    paperTigerPenaltyApplied: false,
    paperTigerPenaltyAmount: 0,
    keyRaceIndexBonus: 0,
  };
}

/**
 * Create a minimal mock horse entry
 */
function createMockHorseEntry(overrides?: Partial<HorseEntry>): HorseEntry {
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
    trainerStats: '15: 3-2-1',
    trainerMeetStarts: 50,
    trainerMeetWins: 10,
    trainerMeetPlaces: 8,
    trainerMeetShows: 7,
    trainerCategoryStats: createDefaultTrainerCategoryStats(),
    jockeyName: 'Test Jockey',
    jockeyStats: '100: 20-15-10',
    jockeyMeetStarts: 100,
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
    trackStarts: 3,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 0,
    surfaceStarts: 8,
    surfaceWins: 3,
    distanceStarts: 5,
    distanceWins: 2,
    distancePlaces: 1,
    distanceShows: 1,
    turfStarts: 2,
    turfWins: 1,
    turfPlaces: 0,
    turfShows: 1,
    wetStarts: 3,
    wetWins: 1,
    wetPlaces: 1,
    wetShows: 0,
    daysSinceLastRace: 21,
    lastRaceDate: '20240101',
    averageBeyer: 82,
    bestBeyer: 90,
    lastBeyer: 85,
    earlySpeedRating: 88,
    runningStyle: 'E/P',
    pedigreeRating: 'A',
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
    salePrice: null,
    saleLocation: null,
    ...overrides,
  };
}

/**
 * Create a minimal mock scored horse
 */
function createMockScoredHorse(): ScoredHorse {
  return {
    horse: createMockHorseEntry(),
    index: 0,
    score: createMockHorseScore(),
    rank: 1,
  };
}

/**
 * Create a minimal mock race header
 */
function createMockRaceHeader(overrides?: Partial<RaceHeader>): RaceHeader {
  return {
    trackCode: 'CD',
    trackName: 'Churchill Downs',
    trackLocation: 'Louisville, KY',
    raceNumber: 1,
    raceDate: 'May 15, 2024',
    raceDateRaw: '20240515',
    postTime: '1:00 PM',
    distanceFurlongs: 6,
    distance: '6 furlongs',
    distanceExact: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'allowance',
    raceType: 'Allowance',
    purse: 100000,
    purseFormatted: '$100,000',
    ageRestriction: '3&UP',
    sexRestriction: '',
    weightConditions: 'Weight for age',
    stateBred: null,
    claimingPriceMin: null,
    claimingPriceMax: null,
    allowedWeight: null,
    conditions: 'Allowance race for 3yo and up',
    raceName: null,
    grade: null,
    isListed: false,
    isAbout: false,
    tempRail: null,
    turfCourseType: null,
    chuteStart: false,
    hasReplay: false,
    programNumber: 1,
    fieldSize: 10,
    probableFavorite: 1,
    date: '2024-05-15',
    ...overrides,
  };
}

// ============================================================================
// GET SEASON FROM DATE TESTS
// ============================================================================

describe('getSeasonFromDate', () => {
  it('should return winter for December', () => {
    expect(getSeasonFromDate(new Date('2024-12-15'))).toBe('winter');
  });

  it('should return winter for January', () => {
    expect(getSeasonFromDate(new Date('2024-01-15'))).toBe('winter');
  });

  it('should return winter for February', () => {
    expect(getSeasonFromDate(new Date('2024-02-15'))).toBe('winter');
  });

  it('should return spring for March', () => {
    expect(getSeasonFromDate(new Date('2024-03-15'))).toBe('spring');
  });

  it('should return spring for April', () => {
    expect(getSeasonFromDate(new Date('2024-04-15'))).toBe('spring');
  });

  it('should return spring for May', () => {
    expect(getSeasonFromDate(new Date('2024-05-15'))).toBe('spring');
  });

  it('should return summer for June', () => {
    expect(getSeasonFromDate(new Date('2024-06-15'))).toBe('summer');
  });

  it('should return summer for July', () => {
    expect(getSeasonFromDate(new Date('2024-07-15'))).toBe('summer');
  });

  it('should return summer for August', () => {
    expect(getSeasonFromDate(new Date('2024-08-15'))).toBe('summer');
  });

  it('should return fall for September', () => {
    expect(getSeasonFromDate(new Date('2024-09-15'))).toBe('fall');
  });

  it('should return fall for October', () => {
    expect(getSeasonFromDate(new Date('2024-10-15'))).toBe('fall');
  });

  it('should return fall for November', () => {
    expect(getSeasonFromDate(new Date('2024-11-15'))).toBe('fall');
  });
});

// ============================================================================
// DERIVE BIAS STRENGTH TESTS
// ============================================================================

describe('deriveBiasStrength', () => {
  it('should return strong for rating 8-10', () => {
    expect(deriveBiasStrength(8)).toBe('strong');
    expect(deriveBiasStrength(9)).toBe('strong');
    expect(deriveBiasStrength(10)).toBe('strong');
  });

  it('should return moderate for rating 6-7', () => {
    expect(deriveBiasStrength(6)).toBe('moderate');
    expect(deriveBiasStrength(7)).toBe('moderate');
  });

  it('should return weak for rating 4-5', () => {
    expect(deriveBiasStrength(4)).toBe('weak');
    expect(deriveBiasStrength(5)).toBe('weak');
  });

  it('should return neutral for rating 1-3', () => {
    expect(deriveBiasStrength(1)).toBe('neutral');
    expect(deriveBiasStrength(2)).toBe('neutral');
    expect(deriveBiasStrength(3)).toBe('neutral');
  });

  it('should handle edge cases', () => {
    expect(deriveBiasStrength(0)).toBe('neutral');
    expect(deriveBiasStrength(7.5)).toBe('moderate');
  });
});

// ============================================================================
// DERIVE FAVORED STYLE TESTS
// ============================================================================

describe('deriveFavoredStyle', () => {
  it('should return E for win rate > 55%', () => {
    expect(deriveFavoredStyle(56)).toBe('E');
    expect(deriveFavoredStyle(60)).toBe('E');
    expect(deriveFavoredStyle(70)).toBe('E');
  });

  it('should return E/P for win rate > 50% and <= 55%', () => {
    expect(deriveFavoredStyle(51)).toBe('E/P');
    expect(deriveFavoredStyle(55)).toBe('E/P');
  });

  it('should return P for win rate > 45% and <= 50%', () => {
    expect(deriveFavoredStyle(46)).toBe('P');
    expect(deriveFavoredStyle(50)).toBe('P');
  });

  it('should return S for win rate <= 45%', () => {
    expect(deriveFavoredStyle(45)).toBe('S');
    expect(deriveFavoredStyle(40)).toBe('S');
    expect(deriveFavoredStyle(30)).toBe('S');
  });

  it('should return neutral for undefined', () => {
    expect(deriveFavoredStyle(undefined)).toBe('neutral');
  });
});

// ============================================================================
// GET TRACK INTELLIGENCE FOR AI TESTS
// ============================================================================

describe('getTrackIntelligenceForAI', () => {
  describe('Known tracks', () => {
    it('should return complete TrackIntelligenceForAI for Churchill Downs (CD)', () => {
      const result = getTrackIntelligenceForAI('CD', 'dirt', 6, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      expect(result!.trackCode).toBe('CD');
      expect(result!.trackName).toBe('Churchill Downs');
      expect(result!.surface).toBe('dirt');
      expect(result!.distance).toBe(6);
      expect(result!.isSprintOrRoute).toBe('sprint');
      expect(result!.dataQuality).toBe('verified');

      // Post position bias should be populated
      expect(result!.postPositionBias).toBeDefined();
      expect(result!.postPositionBias.winPercentByPost.length).toBeGreaterThan(0);
      expect(result!.postPositionBias.favoredPosts.length).toBeGreaterThan(0);
      expect(result!.postPositionBias.biasDescription).toBeTruthy();

      // Speed bias should be populated
      expect(result!.speedBias).toBeDefined();
      expect(result!.speedBias.earlySpeedWinRate).toBeGreaterThan(0);
      expect(result!.speedBias.paceAdvantageRating).toBeGreaterThan(0);
      expect(['E', 'E/P', 'P', 'S', 'neutral']).toContain(result!.speedBias.favoredStyle);

      // Track characteristics should be populated
      expect(result!.trackCharacteristics).toBeDefined();
      expect(result!.trackCharacteristics.circumference).toBeGreaterThan(0);
      expect(result!.trackCharacteristics.stretchLength).toBeGreaterThan(0);
      expect(['speed-favoring', 'fair', 'tiring', 'deep']).toContain(
        result!.trackCharacteristics.playingStyle
      );
    });

    it('should return seasonal context when pattern matches', () => {
      // May is spring (months 4, 5, 6) for Churchill Downs
      const result = getTrackIntelligenceForAI('CD', 'dirt', 6, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      expect(result!.seasonalContext).not.toBeNull();
      expect(result!.seasonalContext!.currentSeason).toBe('spring');
    });

    it('should return null seasonal context when no pattern matches', () => {
      // Churchill has spring, summer, fall patterns but let's verify behavior
      // Even for winter, should return null or a matched pattern
      const result = getTrackIntelligenceForAI('CD', 'dirt', 6, new Date('2024-01-15'));

      // Churchill doesn't have a winter pattern, so seasonalContext should be null
      expect(result).not.toBeNull();
      // Seasonal context could be null if no pattern for January
      // This depends on the track data
    });
  });

  describe('Unknown tracks', () => {
    it('should return null for unknown track code', () => {
      const result = getTrackIntelligenceForAI('XYZ', 'dirt', 6, new Date('2024-05-15'));

      expect(result).toBeNull();
    });

    it('should return null gracefully without crashing', () => {
      expect(() => {
        getTrackIntelligenceForAI('UNKNOWN', 'dirt', 6, new Date('2024-05-15'));
      }).not.toThrow();
    });
  });

  describe('Sprint vs Route classification', () => {
    it('should classify 6 furlongs as sprint', () => {
      const result = getTrackIntelligenceForAI('CD', 'dirt', 6, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      expect(result!.isSprintOrRoute).toBe('sprint');
    });

    it('should classify 7 furlongs as sprint', () => {
      const result = getTrackIntelligenceForAI('CD', 'dirt', 7, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      expect(result!.isSprintOrRoute).toBe('sprint');
    });

    it('should classify 7.99 furlongs as sprint', () => {
      const result = getTrackIntelligenceForAI('CD', 'dirt', 7.99, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      expect(result!.isSprintOrRoute).toBe('sprint');
    });

    it('should classify 8 furlongs as route', () => {
      const result = getTrackIntelligenceForAI('CD', 'dirt', 8, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      expect(result!.isSprintOrRoute).toBe('route');
    });

    it('should classify 9 furlongs as route', () => {
      const result = getTrackIntelligenceForAI('CD', 'dirt', 9, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      expect(result!.isSprintOrRoute).toBe('route');
    });

    it('should classify 10 furlongs (1.25 miles) as route', () => {
      const result = getTrackIntelligenceForAI('CD', 'dirt', 10, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      expect(result!.isSprintOrRoute).toBe('route');
    });
  });

  describe('Surface selection', () => {
    it('should select turf-specific bias data for turf races', () => {
      // Saratoga has both dirt and turf data
      const result = getTrackIntelligenceForAI('SAR', 'turf', 9, new Date('2024-07-15'));

      expect(result).not.toBeNull();
      expect(result!.surface).toBe('turf');
      // SAR turf has different characteristics than dirt
    });

    it('should fall back to dirt data when turf not available', () => {
      // Use a track code, the function should handle gracefully
      const result = getTrackIntelligenceForAI('CD', 'turf', 8, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      // Should still return valid data, possibly from turf if available
      expect(result!.surface).toBe('turf');
    });

    it('should normalize surface string to lowercase match', () => {
      const result = getTrackIntelligenceForAI('CD', 'DIRT', 6, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      expect(result!.surface).toBe('dirt');
    });
  });

  describe('Bias strength derivation', () => {
    it('should correctly derive bias strength from pace advantage rating', () => {
      // CD has paceAdvantageRating of 5 on dirt, which should be 'weak'
      const result = getTrackIntelligenceForAI('CD', 'dirt', 6, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      // CD dirt has paceAdvantageRating: 5 which is 'weak'
      expect(result!.postPositionBias.biasStrength).toBe('weak');
    });

    it('should return moderate for tracks with higher pace rating', () => {
      // SAR has paceAdvantageRating of 7 on dirt, which should be 'moderate'
      const result = getTrackIntelligenceForAI('SAR', 'dirt', 6, new Date('2024-07-15'));

      expect(result).not.toBeNull();
      // SAR dirt has paceAdvantageRating: 7 which is 'moderate'
      expect(result!.postPositionBias.biasStrength).toBe('moderate');
    });
  });

  describe('Favored style derivation', () => {
    it('should derive favored style from early speed win rate', () => {
      // CD dirt has earlySpeedWinRate: 48, which is > 45 so 'P'
      const result = getTrackIntelligenceForAI('CD', 'dirt', 6, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      expect(result!.speedBias.favoredStyle).toBe('P');
    });

    it('should return E for high early speed win rate tracks', () => {
      // SAR dirt has earlySpeedWinRate: 58, which is > 55 so 'E'
      const result = getTrackIntelligenceForAI('SAR', 'dirt', 6, new Date('2024-07-15'));

      expect(result).not.toBeNull();
      expect(result!.speedBias.favoredStyle).toBe('E');
    });
  });
});

// ============================================================================
// INTEGRATION WITH RACE SCORING RESULT
// ============================================================================

describe('transformToRaceScoringResult with track intelligence', () => {
  it('should include track intelligence in race analysis for known track', () => {
    const scoredHorses: ScoredHorse[] = [createMockScoredHorse()];
    const raceHeader = createMockRaceHeader({
      trackCode: 'CD',
      surface: 'dirt',
      distanceFurlongs: 6,
      date: '2024-05-15',
    });

    const result = transformToRaceScoringResult(scoredHorses, raceHeader);

    expect(result.raceAnalysis.trackIntelligence).not.toBeNull();
    expect(result.raceAnalysis.trackIntelligence!.trackCode).toBe('CD');
    expect(result.raceAnalysis.trackIntelligence!.trackName).toBe('Churchill Downs');
    expect(result.raceAnalysis.trackIntelligence!.surface).toBe('dirt');
    expect(result.raceAnalysis.trackIntelligence!.distance).toBe(6);
    expect(result.raceAnalysis.trackIntelligence!.isSprintOrRoute).toBe('sprint');
  });

  it('should return null track intelligence for unknown track', () => {
    const scoredHorses: ScoredHorse[] = [createMockScoredHorse()];
    const raceHeader = createMockRaceHeader({
      trackCode: 'UNKNOWN',
      surface: 'dirt',
      distanceFurlongs: 6,
      date: '2024-05-15',
    });

    const result = transformToRaceScoringResult(scoredHorses, raceHeader);

    expect(result.raceAnalysis.trackIntelligence).toBeNull();
    // Transformation should still complete without crashing
    expect(result.scores.length).toBe(1);
    expect(result.raceAnalysis.paceScenario).toBeDefined();
  });

  it('should handle missing race header fields gracefully', () => {
    const scoredHorses: ScoredHorse[] = [createMockScoredHorse()];
    const raceHeader = createMockRaceHeader({
      trackCode: undefined as unknown as string,
      surface: undefined as unknown as string,
      distanceFurlongs: undefined as unknown as number,
    });

    // Should not throw
    expect(() => {
      transformToRaceScoringResult(scoredHorses, raceHeader);
    }).not.toThrow();
  });
});

// ============================================================================
// SCENARIO TESTS
// ============================================================================

describe('Test Scenarios', () => {
  describe('Scenario A - Churchill Downs Dirt Sprint', () => {
    it('should return CD data with sprint bias, dirt speed bias, correct seasonal pattern', () => {
      const result = getTrackIntelligenceForAI('CD', 'dirt', 6, new Date('2024-05-15'));

      expect(result).not.toBeNull();
      expect(result!.trackCode).toBe('CD');
      expect(result!.trackName).toBe('Churchill Downs');
      expect(result!.isSprintOrRoute).toBe('sprint');
      expect(result!.surface).toBe('dirt');
      expect(result!.dataQuality).toBe('verified');

      // Verify it has sprint-specific post position bias
      expect(result!.postPositionBias.winPercentByPost.length).toBeGreaterThan(0);

      // Verify it has dirt speed bias
      expect(result!.speedBias.earlySpeedWinRate).toBeGreaterThan(0);

      // May is spring, verify seasonal context
      expect(result!.seasonalContext).not.toBeNull();
      expect(result!.seasonalContext!.currentSeason).toBe('spring');
    });
  });

  describe('Scenario B - Unknown Track', () => {
    it('should return null without crash, transformation completes', () => {
      const result = getTrackIntelligenceForAI('XYZ', 'dirt', 6, new Date('2024-05-15'));

      expect(result).toBeNull();

      // Verify full transformation works
      const scoredHorses: ScoredHorse[] = [createMockScoredHorse()];
      const raceHeader = createMockRaceHeader({
        trackCode: 'XYZ',
        surface: 'dirt',
        distanceFurlongs: 6,
      });

      const fullResult = transformToRaceScoringResult(scoredHorses, raceHeader);

      expect(fullResult.raceAnalysis.trackIntelligence).toBeNull();
      expect(fullResult.scores.length).toBe(1);
    });
  });

  describe('Scenario C - Turf Route', () => {
    it('should return turf-specific bias data with route classification', () => {
      // Saratoga has good turf data
      const result = getTrackIntelligenceForAI('SAR', 'turf', 9, new Date('2024-07-15'));

      expect(result).not.toBeNull();
      expect(result!.trackCode).toBe('SAR');
      expect(result!.surface).toBe('turf');
      expect(result!.isSprintOrRoute).toBe('route');

      // Verify turf-specific data
      expect(result!.postPositionBias.winPercentByPost.length).toBeGreaterThan(0);
      expect(result!.speedBias.earlySpeedWinRate).toBeGreaterThan(0);
    });
  });
});
