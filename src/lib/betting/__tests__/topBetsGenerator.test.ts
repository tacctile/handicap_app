/**
 * Top Bets Generator Tests
 *
 * Tests for the new wheel bets and extended box depths added in this expansion.
 * Tests cover:
 * - Exacta Box 4/5/6 combinations and costs
 * - Trifecta Box 5/6 combinations and costs
 * - Superfecta Box 6 combinations and costs
 * - Exacta/Trifecta/Superfecta Wheel costs
 * - Field size guards (bets not generated when field too small)
 */

import { describe, it, expect } from 'vitest';
import { generateTopBets } from '../topBetsGenerator';
import type { ScoredHorse, HorseScore, ScoreBreakdown } from '../../scoring';
import type { HorseEntry, RaceHeader } from '../../../types/drf';

// ============================================================================
// TEST DATA FACTORIES (aligned with betGenerator.test.ts patterns)
// ============================================================================

function createMockHorse(overrides: Partial<HorseEntry> = {}): HorseEntry {
  return {
    programNumber: 1,
    horseName: 'Test Horse',
    postPosition: 1,
    morningLineOdds: '5-1',
    trainerName: 'Test Trainer',
    jockeyName: 'Test Jockey',
    weight: 122,
    equipment: { raw: '', firstTimeEquipment: [], changes: [] },
    medication: { lasix: false, bute: false },
    breeding: { sire: 'Test Sire', dam: 'Test Dam', damSire: 'Test Damsire' },
    pastPerformances: [],
    workouts: [],
    bestBeyer: 85,
    averageBeyer: 80,
    runningStyle: 'E',
    earlySpeedRating: 90,
    lifetimeStarts: 10,
    isScratched: false,
    ...overrides,
  } as HorseEntry;
}

function createMockScoreBreakdown(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    connections: {
      total: 30,
      trainer: 20,
      jockey: 8,
      partnershipBonus: 2,
      reasoning: 'Good connections',
    },
    postPosition: {
      total: 25,
      trackBiasApplied: false,
      isGoldenPost: false,
      reasoning: 'Good post',
    },
    speedClass: {
      total: 35,
      speedScore: 20,
      classScore: 15,
      bestFigure: 85,
      classMovement: 'lateral',
      reasoning: 'Solid speed',
    },
    form: {
      total: 20,
      recentFormScore: 15,
      layoffScore: 5,
      consistencyBonus: 0,
      formTrend: 'consistent',
      reasoning: 'Good form',
      wonLastOut: false,
      won2OfLast3: false,
    },
    equipment: { total: 10, hasChanges: false, reasoning: 'Standard equipment' },
    pace: { total: 30, runningStyle: 'Stalker', paceFit: 'favorable', reasoning: 'Good pace fit' },
    odds: {
      total: 7,
      oddsValue: 5.0,
      oddsSource: 'morning_line' as const,
      tier: 'Live Price',
      reasoning: '5-1 morning line',
    },
    distanceSurface: {
      total: 0,
      turfScore: 0,
      wetScore: 0,
      distanceScore: 0,
      turfWinRate: 0,
      wetWinRate: 0,
      distanceWinRate: 0,
      reasoning: ['No distance/surface bonus'],
    },
    trainerPatterns: {
      total: 0,
      matchedPatterns: [],
      reasoning: ['No trainer pattern bonus'],
    },
    comboPatterns: {
      total: 0,
      detectedCombos: [],
      intentScore: 0,
      reasoning: [],
    },
    trackSpecialist: {
      total: 0,
      trackWinRate: 0,
      trackITMRate: 0,
      isSpecialist: false,
      reasoning: 'First time at track',
    },
    trainerSurfaceDistance: {
      total: 0,
      matchedCategory: null,
      trainerWinPercent: 0,
      wetTrackWinPercent: 0,
      wetBonusApplied: false,
      reasoning: 'No trainer surface/distance data',
    },
    weightAnalysis: {
      total: 0,
      currentWeight: 120,
      lastRaceWeight: null,
      weightChange: null,
      significantDrop: false,
      significantGain: false,
      showWeightGainFlag: false,
      reasoning: 'No weight history available',
    },
    sexAnalysis: {
      total: 0,
      horseSex: 'c',
      isFemale: false,
      isRestrictedRace: false,
      isMixedRace: false,
      isFirstTimeFacingMales: false,
      flags: [],
      reasoning: 'Colt in open race - baseline',
    },
    ...overrides,
  };
}

function createMockHorseScore(total: number, overrides: Partial<HorseScore> = {}): HorseScore {
  return {
    total,
    baseScore: total,
    overlayScore: 0,
    oddsScore: 7,
    breakdown: createMockScoreBreakdown(overrides.breakdown),
    isScratched: false,
    confidenceLevel: total >= 180 ? 'high' : total >= 160 ? 'medium' : 'low',
    dataQuality: 80,
    dataCompleteness: {
      overallScore: 85,
      overallGrade: 'B',
      criticalComplete: 100,
      highComplete: 80,
      mediumComplete: 75,
      lowComplete: 50,
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
    },
    lowConfidencePenaltyApplied: false,
    lowConfidencePenaltyAmount: 0,
    paperTigerPenaltyApplied: false,
    paperTigerPenaltyAmount: 0,
    keyRaceIndexBonus: 0,
    ...overrides,
  };
}

function createMockScoredHorse(
  programNumber: number,
  total: number,
  odds: string = '5-1'
): ScoredHorse {
  return {
    horse: createMockHorse({
      programNumber,
      horseName: `Horse ${programNumber}`,
      morningLineOdds: odds,
      postPosition: programNumber,
    }),
    index: programNumber - 1,
    score: createMockHorseScore(total),
    rank: programNumber,
  };
}

// Helper to create mock scored horses for tests
function createMockScoredHorses(count: number): ScoredHorse[] {
  const horses: ScoredHorse[] = [];
  for (let i = 0; i < count; i++) {
    horses.push(createMockScoredHorse(i + 1, 200 - i * 10, `${5 + i}-1`));
  }
  return horses;
}

function createMockRaceHeader(): RaceHeader {
  return {
    trackCode: 'CD',
    trackName: 'Churchill Downs',
    trackLocation: 'Louisville, KY',
    raceNumber: 5,
    raceDate: 'January 15, 2024',
    raceDateRaw: '20240115',
    postTime: '2:30 PM',
    distanceFurlongs: 6,
    distance: '6 furlongs',
    distanceExact: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'claiming',
    raceType: 'Claiming',
    purse: 25000,
    purseFormatted: '$25,000',
    ageRestriction: '3&UP',
    sexRestriction: '',
    weightConditions: '124 lbs',
    stateBred: null,
    claimingPriceMin: 25000,
    claimingPriceMax: 25000,
    allowedWeight: null,
    conditions: 'For 3 year olds and upward',
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
  };
}

const mockRaceHeader = createMockRaceHeader();

// ============================================================================
// TEST SUITES
// ============================================================================

describe('topBetsGenerator - New Bet Types', () => {
  describe('Exacta Box Extended Depths', () => {
    it('should generate Exacta Box 4 with 12 combinations and $12 cost', () => {
      const horses = createMockScoredHorses(6);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const exactaBox4Bets = result.topBets.filter((b) => b.internalType === 'EXACTA_BOX_4');
      expect(exactaBox4Bets.length).toBeGreaterThan(0);

      // First Exacta Box 4 should have 12 combinations (P(4,2) = 4×3 = 12)
      const firstBox4 = exactaBox4Bets[0];
      expect(firstBox4?.combinationsInvolved).toBe(12);
      expect(firstBox4?.cost).toBe(12);
    });

    it('should generate Exacta Box 5 with 20 combinations and $20 cost', () => {
      const horses = createMockScoredHorses(6);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const exactaBox5Bets = result.topBets.filter((b) => b.internalType === 'EXACTA_BOX_5');
      expect(exactaBox5Bets.length).toBeGreaterThan(0);

      // Exacta Box 5 should have 20 combinations (P(5,2) = 5×4 = 20)
      const firstBox5 = exactaBox5Bets[0];
      expect(firstBox5?.combinationsInvolved).toBe(20);
      expect(firstBox5?.cost).toBe(20);
    });

    it('should generate Exacta Box 6 with 30 combinations and $30 cost', () => {
      const horses = createMockScoredHorses(8);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const exactaBox6Bets = result.topBets.filter((b) => b.internalType === 'EXACTA_BOX_6');
      expect(exactaBox6Bets.length).toBeGreaterThan(0);

      // Exacta Box 6 should have 30 combinations (P(6,2) = 6×5 = 30)
      const firstBox6 = exactaBox6Bets[0];
      expect(firstBox6?.combinationsInvolved).toBe(30);
      expect(firstBox6?.cost).toBe(30);
    });
  });

  describe('Trifecta Box Extended Depths', () => {
    it('should generate Trifecta Box 5 with 60 combinations and $60 cost', () => {
      const horses = createMockScoredHorses(6);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const trifectaBox5Bets = result.topBets.filter((b) => b.internalType === 'TRIFECTA_BOX_5');
      expect(trifectaBox5Bets.length).toBeGreaterThan(0);

      // Trifecta Box 5 should have 60 combinations (P(5,3) = 5×4×3 = 60)
      const firstBox5 = trifectaBox5Bets[0];
      expect(firstBox5?.combinationsInvolved).toBe(60);
      expect(firstBox5?.cost).toBe(60);
    });

    it('should generate Trifecta Box 6 with 120 combinations and $120 cost', () => {
      const horses = createMockScoredHorses(8);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const trifectaBox6Bets = result.topBets.filter((b) => b.internalType === 'TRIFECTA_BOX_6');
      expect(trifectaBox6Bets.length).toBeGreaterThan(0);

      // Trifecta Box 6 should have 120 combinations (P(6,3) = 6×5×4 = 120)
      const firstBox6 = trifectaBox6Bets[0];
      expect(firstBox6?.combinationsInvolved).toBe(120);
      expect(firstBox6?.cost).toBe(120);
    });
  });

  describe('Superfecta Box Extended Depth', () => {
    it('should generate Superfecta Box 6 with 360 combinations and $360 cost', () => {
      const horses = createMockScoredHorses(8);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const superfectaBox6Bets = result.topBets.filter(
        (b) => b.internalType === 'SUPERFECTA_BOX_6'
      );
      expect(superfectaBox6Bets.length).toBeGreaterThan(0);

      // Superfecta Box 6 should have 360 combinations (P(6,4) = 6×5×4×3 = 360)
      const firstBox6 = superfectaBox6Bets[0];
      expect(firstBox6?.combinationsInvolved).toBe(360);
      expect(firstBox6?.cost).toBe(360);
    });
  });

  describe('Wheel Bets', () => {
    it('should generate Exacta Wheel with cost = (fieldSize - 1) × $1', () => {
      const fieldSize = 8;
      const horses = createMockScoredHorses(fieldSize);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const exactaWheelBets = result.topBets.filter((b) => b.internalType === 'EXACTA_WHEEL');
      expect(exactaWheelBets.length).toBeGreaterThan(0);

      // Exacta Wheel cost = (fieldSize - 1) × $1 = 7
      const firstWheel = exactaWheelBets[0];
      expect(firstWheel?.cost).toBe(fieldSize - 1);
      expect(firstWheel?.combinationsInvolved).toBe(fieldSize - 1);
    });

    it('should generate Trifecta Wheel with cost = (fieldSize - 1) × (fieldSize - 2) × $1', () => {
      const fieldSize = 8;
      const horses = createMockScoredHorses(fieldSize);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const trifectaWheelBets = result.topBets.filter((b) => b.internalType === 'TRIFECTA_WHEEL');
      expect(trifectaWheelBets.length).toBeGreaterThan(0);

      // Trifecta Wheel cost = (fieldSize - 1) × (fieldSize - 2) × $1 = 7 × 6 = 42
      const expectedCost = (fieldSize - 1) * (fieldSize - 2);
      const firstWheel = trifectaWheelBets[0];
      expect(firstWheel?.cost).toBe(expectedCost);
      expect(firstWheel?.combinationsInvolved).toBe(expectedCost);
    });

    it('should generate Superfecta Wheel with cost = (fieldSize - 1) × (fieldSize - 2) × (fieldSize - 3) × $1', () => {
      const fieldSize = 8;
      const horses = createMockScoredHorses(fieldSize);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const superfectaWheelBets = result.topBets.filter(
        (b) => b.internalType === 'SUPERFECTA_WHEEL'
      );
      expect(superfectaWheelBets.length).toBeGreaterThan(0);

      // Superfecta Wheel cost = (fieldSize - 1) × (fieldSize - 2) × (fieldSize - 3) × $1 = 7 × 6 × 5 = 210
      const expectedCost = (fieldSize - 1) * (fieldSize - 2) * (fieldSize - 3);
      const firstWheel = superfectaWheelBets[0];
      expect(firstWheel?.cost).toBe(expectedCost);
      expect(firstWheel?.combinationsInvolved).toBe(expectedCost);
    });
  });

  describe('Field Size Guards', () => {
    it('should NOT generate Exacta Box 6 with 5-horse field', () => {
      const horses = createMockScoredHorses(5);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const exactaBox6Bets = result.topBets.filter((b) => b.internalType === 'EXACTA_BOX_6');
      expect(exactaBox6Bets.length).toBe(0);
    });

    it('should NOT generate Trifecta Box 6 with 5-horse field', () => {
      const horses = createMockScoredHorses(5);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const trifectaBox6Bets = result.topBets.filter((b) => b.internalType === 'TRIFECTA_BOX_6');
      expect(trifectaBox6Bets.length).toBe(0);
    });

    it('should NOT generate Superfecta Box 6 with 5-horse field', () => {
      const horses = createMockScoredHorses(5);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const superfectaBox6Bets = result.topBets.filter(
        (b) => b.internalType === 'SUPERFECTA_BOX_6'
      );
      expect(superfectaBox6Bets.length).toBe(0);
    });

    it('should NOT generate Exacta Box 4 with 3-horse field', () => {
      const horses = createMockScoredHorses(3);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const exactaBox4Bets = result.topBets.filter((b) => b.internalType === 'EXACTA_BOX_4');
      expect(exactaBox4Bets.length).toBe(0);
    });

    it('should NOT generate Trifecta Box 5 with 4-horse field', () => {
      const horses = createMockScoredHorses(4);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const trifectaBox5Bets = result.topBets.filter((b) => b.internalType === 'TRIFECTA_BOX_5');
      expect(trifectaBox5Bets.length).toBe(0);
    });

    it('should NOT generate Superfecta Wheel with 4-horse field', () => {
      const horses = createMockScoredHorses(4);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const superfectaWheelBets = result.topBets.filter(
        (b) => b.internalType === 'SUPERFECTA_WHEEL'
      );
      expect(superfectaWheelBets.length).toBe(0);
    });

    it('should generate Exacta Wheel with 3+ horse field', () => {
      const horses = createMockScoredHorses(3);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const exactaWheelBets = result.topBets.filter((b) => b.internalType === 'EXACTA_WHEEL');
      expect(exactaWheelBets.length).toBeGreaterThan(0);
    });

    it('should generate Trifecta Wheel with 4+ horse field', () => {
      const horses = createMockScoredHorses(4);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const trifectaWheelBets = result.topBets.filter((b) => b.internalType === 'TRIFECTA_WHEEL');
      expect(trifectaWheelBets.length).toBeGreaterThan(0);
    });

    it('should generate Superfecta Wheel with 5+ horse field', () => {
      const horses = createMockScoredHorses(5);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const superfectaWheelBets = result.topBets.filter(
        (b) => b.internalType === 'SUPERFECTA_WHEEL'
      );
      expect(superfectaWheelBets.length).toBeGreaterThan(0);
    });
  });

  describe('Window Instructions', () => {
    it('should generate correct window instruction for Exacta Wheel', () => {
      const horses = createMockScoredHorses(6);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const exactaWheelBets = result.topBets.filter((b) => b.internalType === 'EXACTA_WHEEL');
      expect(exactaWheelBets.length).toBeGreaterThan(0);

      const firstWheel = exactaWheelBets[0];
      expect(firstWheel?.whatToSay).toContain('EXACTA');
      expect(firstWheel?.whatToSay).toContain('WITH ALL');
    });

    it('should generate correct window instruction for Trifecta Wheel', () => {
      const horses = createMockScoredHorses(6);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const trifectaWheelBets = result.topBets.filter((b) => b.internalType === 'TRIFECTA_WHEEL');
      expect(trifectaWheelBets.length).toBeGreaterThan(0);

      const firstWheel = trifectaWheelBets[0];
      expect(firstWheel?.whatToSay).toContain('TRIFECTA');
      expect(firstWheel?.whatToSay).toContain('WITH ALL WITH ALL');
    });

    it('should generate correct window instruction for Superfecta Wheel', () => {
      const horses = createMockScoredHorses(6);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const superfectaWheelBets = result.topBets.filter(
        (b) => b.internalType === 'SUPERFECTA_WHEEL'
      );
      expect(superfectaWheelBets.length).toBeGreaterThan(0);

      const firstWheel = superfectaWheelBets[0];
      expect(firstWheel?.whatToSay).toContain('SUPERFECTA');
      expect(firstWheel?.whatToSay).toContain('WITH ALL WITH ALL WITH ALL');
    });
  });

  describe('Bet Type Names', () => {
    it('should have correct display names for new bet types when they appear', () => {
      const horses = createMockScoredHorses(8);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      // Helper to check bet type name if bet exists
      const checkBetTypeName = (internalType: string, expectedName: string) => {
        const bet = result.topBets.find((b) => b.internalType === internalType);
        if (bet) {
          expect(bet.betType).toBe(expectedName);
        }
      };

      // Check Exacta Box extended depths
      checkBetTypeName('EXACTA_BOX_4', 'EXACTA BOX 4');
      checkBetTypeName('EXACTA_BOX_5', 'EXACTA BOX 5');
      checkBetTypeName('EXACTA_BOX_6', 'EXACTA BOX 6');

      // Check Trifecta Box extended depths
      checkBetTypeName('TRIFECTA_BOX_5', 'TRIFECTA BOX 5');
      checkBetTypeName('TRIFECTA_BOX_6', 'TRIFECTA BOX 6');

      // Check Superfecta Box extended depth
      checkBetTypeName('SUPERFECTA_BOX_6', 'SUPERFECTA BOX 6');

      // Check Wheel bets - these should definitely appear as they're in separate categories
      const exactaWheel = result.topBets.find((b) => b.internalType === 'EXACTA_WHEEL');
      expect(exactaWheel).toBeDefined();
      expect(exactaWheel?.betType).toBe('EXACTA WHEEL');

      const trifectaWheel = result.topBets.find((b) => b.internalType === 'TRIFECTA_WHEEL');
      expect(trifectaWheel).toBeDefined();
      expect(trifectaWheel?.betType).toBe('TRIFECTA WHEEL');

      const superfectaWheel = result.topBets.find((b) => b.internalType === 'SUPERFECTA_WHEEL');
      expect(superfectaWheel).toBeDefined();
      expect(superfectaWheel?.betType).toBe('SUPERFECTA WHEEL');
    });
  });

  describe('Wheel Bet Key Position', () => {
    it('should mark first horse as Key and others as With for wheel bets', () => {
      const horses = createMockScoredHorses(6);
      const result = generateTopBets(horses, mockRaceHeader, 1);

      const exactaWheel = result.topBets.find((b) => b.internalType === 'EXACTA_WHEEL');
      expect(exactaWheel?.horses[0]?.position).toBe('Key');
      // With horses should have position 'With'
      for (let i = 1; i < (exactaWheel?.horses.length || 0); i++) {
        expect(exactaWheel?.horses[i]?.position).toBe('With');
      }
    });
  });
});
