/**
 * Pace Scenario Detection Tests
 *
 * Tests for algorithmic pace scenario detection and scoring.
 * Verifies running style classification, scenario detection, and adjustments.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzePaceScenario,
  classifyRunningStyle,
  determineScenario,
  calculatePaceAdjustments,
  calculatePaceConfidence,
  generatePaceReason,
  getAverageEP1,
  getPaceAdjustmentForHorse,
  getHorseRunningStyle,
  getScenarioDisplayInfo,
  getStyleDisplayInfo,
  formatPaceScenarioSummary,
  PACE_SCENARIO_CONFIG,
  EP1_THRESHOLDS,
} from '../paceScenario';
import type { HorseEntry, PastPerformance } from '../../../types/drf';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a minimal mock past performance with specified EP1
 */
function createMockPP(ep1: number | null): PastPerformance {
  return {
    date: '20250101',
    track: 'CD',
    trackName: 'Churchill Downs',
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
    lengthsBehind: 3,
    lengthsAhead: null,
    finalTime: 71.5,
    finalTimeFormatted: '1:11.50',
    speedFigures: {
      beyer: 75,
      timeformUS: null,
      equibase: null,
      trackVariant: null,
      dirtVariant: null,
      turfVariant: null,
    },
    runningLine: {
      start: 4,
      quarterMile: 3,
      quarterMileLengths: 2,
      halfMile: 3,
      halfMileLengths: 2,
      threeQuarters: 4,
      threeQuartersLengths: 3,
      stretch: 4,
      stretchLengths: 4,
      finish: 3,
      finishLengths: 3,
    },
    jockey: 'Test Jockey',
    weight: 122,
    apprenticeAllowance: 0,
    equipment: 'L',
    medication: 'L',
    winner: 'Winner Horse',
    secondPlace: 'Second Horse',
    thirdPlace: 'Third Horse',
    tripComment: '',
    comment: '',
    odds: 5.0,
    favoriteRank: null,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: 21,
    earlyPace1: ep1,
    latePace: 85,
    quarterTime: null,
    halfMileTime: null,
    sixFurlongTime: null,
    mileTime: null,
  };
}

/**
 * Create a minimal mock horse entry with specified EP1 values
 */
function createMockHorse(
  ep1Values: (number | null)[],
  options: {
    programNumber?: number;
    horseName?: string;
    runningStyle?: string;
    isScratched?: boolean;
  } = {}
): HorseEntry {
  const pastPerformances = ep1Values.map((ep1) => createMockPP(ep1));

  return {
    programNumber: options.programNumber ?? 1,
    horseName: options.horseName ?? 'Test Horse',
    postPosition: options.programNumber ?? 1,
    morningLineOdds: '5-1',
    trainerName: 'Test Trainer',
    jockeyName: 'Test Jockey',
    age: 4,
    sex: 'C',
    color: 'B',
    weight: 122,
    medication: 'L',
    equipment: { raw: 'L', blinkers: false, firstTimeEquipment: [], blinkersOff: false },
    sire: 'Test Sire',
    dam: 'Test Dam',
    damSire: 'Test Dam Sire',
    owner: 'Test Owner',
    breeder: 'Test Breeder',
    whereBred: 'KY',
    earlySpeedRating: 5,
    runningStyle: options.runningStyle ?? null,
    bestBeyer: 80,
    averageBeyer: 75,
    daysSinceLastRace: 21,
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimePlaces: 3,
    lifetimeShows: 2,
    lifetimeEarnings: 100000,
    currentYearEarnings: 50000,
    previousYearEarnings: 50000,
    pastPerformances,
    workouts: [],
    trainerStats: null,
    jockeyStats: null,
    distanceRecord: { starts: 5, wins: 1, places: 1, shows: 1 },
    surfaceRecord: { starts: 8, wins: 2, places: 2, shows: 1 },
    trackRecord: { starts: 3, wins: 1, places: 0, shows: 1 },
    wetTrackRecord: { starts: 2, wins: 0, places: 1, shows: 0 },
    turfRecord: { starts: 0, wins: 0, places: 0, shows: 0 },
    trainerCategoryStats: null,
    salesPrice: null,
    salesLocation: null,
    siresSire: 'Test Sires Sire',
    isScratched: options.isScratched ?? false,
  } as unknown as HorseEntry;
}

// ============================================================================
// EP1 AVERAGE CALCULATION TESTS
// ============================================================================

describe('paceScenario', () => {
  describe('getAverageEP1', () => {
    it('calculates average EP1 from past performances', () => {
      const pps = [createMockPP(95), createMockPP(93), createMockPP(92)];
      const result = getAverageEP1(pps);
      expect(result).toBeCloseTo(93.3, 1);
    });

    it('returns null for no EP1 data', () => {
      const pps = [createMockPP(null), createMockPP(null)];
      const result = getAverageEP1(pps);
      expect(result).toBeNull();
    });

    it('filters out null EP1 values', () => {
      const pps = [createMockPP(95), createMockPP(null), createMockPP(91)];
      const result = getAverageEP1(pps);
      expect(result).toBeCloseTo(93, 0);
    });

    it('only uses last 3 PPs', () => {
      const pps = [
        createMockPP(95),
        createMockPP(93),
        createMockPP(91),
        createMockPP(70), // Should be ignored
        createMockPP(65), // Should be ignored
      ];
      const result = getAverageEP1(pps);
      expect(result).toBeCloseTo(93, 0);
    });
  });

  // ============================================================================
  // RUNNING STYLE CLASSIFICATION TESTS
  // ============================================================================

  describe('classifyRunningStyle', () => {
    it('classifies E (early speed) for EP1 >= 92', () => {
      const horse = createMockHorse([95, 93, 92]);
      expect(classifyRunningStyle(horse)).toBe('E');
    });

    it('classifies EP (presser) for EP1 85-91', () => {
      const horse = createMockHorse([88, 87, 86]);
      expect(classifyRunningStyle(horse)).toBe('EP');
    });

    it('classifies P (stalker) for EP1 75-84', () => {
      const horse = createMockHorse([80, 79, 78]);
      expect(classifyRunningStyle(horse)).toBe('P');
    });

    it('classifies S (closer) for EP1 < 75', () => {
      const horse = createMockHorse([70, 68, 65]);
      expect(classifyRunningStyle(horse)).toBe('S');
    });

    it('returns UNKNOWN for no EP1 data and no running style', () => {
      const horse = createMockHorse([null, null, null]);
      expect(classifyRunningStyle(horse)).toBe('UNKNOWN');
    });

    it('uses explicit running style as fallback', () => {
      const horse = createMockHorse([null, null], { runningStyle: 'E' });
      expect(classifyRunningStyle(horse)).toBe('E');
    });

    it('handles explicit "EARLY" style', () => {
      const horse = createMockHorse([null], { runningStyle: 'EARLY' });
      expect(classifyRunningStyle(horse)).toBe('E');
    });

    it('handles explicit "PRESS" style', () => {
      const horse = createMockHorse([null], { runningStyle: 'PRESS' });
      expect(classifyRunningStyle(horse)).toBe('EP');
    });

    it('handles explicit "CLOS" style', () => {
      const horse = createMockHorse([null], { runningStyle: 'CLOSER' });
      expect(classifyRunningStyle(horse)).toBe('S');
    });
  });

  // ============================================================================
  // SCENARIO DETERMINATION TESTS
  // ============================================================================

  describe('determineScenario', () => {
    it('returns LONE_SPEED for 1 E type, 0-1 EP types', () => {
      expect(determineScenario(1, 0, 3, 4)).toBe('LONE_SPEED');
      expect(determineScenario(1, 1, 3, 3)).toBe('LONE_SPEED');
    });

    it('returns SPEED_DUEL for 2 E types', () => {
      expect(determineScenario(2, 1, 2, 3)).toBe('SPEED_DUEL');
    });

    it('returns CHAOTIC for 3+ E types', () => {
      expect(determineScenario(3, 0, 2, 3)).toBe('CHAOTIC');
      expect(determineScenario(4, 1, 1, 2)).toBe('CHAOTIC');
    });

    it('returns CONTESTED for 1 E with 2+ EP', () => {
      expect(determineScenario(1, 2, 2, 3)).toBe('CONTESTED');
      expect(determineScenario(1, 3, 2, 2)).toBe('CONTESTED');
    });

    it('returns CONTESTED for 0 E with 3+ EP', () => {
      expect(determineScenario(0, 3, 2, 3)).toBe('CONTESTED');
    });

    it('returns SLOW for no E and 0-1 EP', () => {
      expect(determineScenario(0, 0, 4, 4)).toBe('SLOW');
      expect(determineScenario(0, 1, 3, 4)).toBe('SLOW');
    });

    it('returns HONEST for balanced pace', () => {
      expect(determineScenario(0, 2, 3, 3)).toBe('HONEST');
    });
  });

  // ============================================================================
  // PACE ADJUSTMENTS TESTS
  // ============================================================================

  describe('calculatePaceAdjustments', () => {
    it('gives +8 bonus to E type in LONE_SPEED', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Speed Horse', style: 'E' as const, ep1Average: 95 },
        { programNumber: 2, horseName: 'Closer', style: 'S' as const, ep1Average: 70 },
      ];
      const { beneficiaries } = calculatePaceAdjustments(horseStyles, 'LONE_SPEED');

      const speedBenefit = beneficiaries.find((b) => b.programNumber === 1);
      expect(speedBenefit?.adjustment).toBe(PACE_SCENARIO_CONFIG.LONE_SPEED_BONUS);
    });

    it('gives -3 penalty to S type in LONE_SPEED', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Speed Horse', style: 'E' as const, ep1Average: 95 },
        { programNumber: 2, horseName: 'Closer', style: 'S' as const, ep1Average: 70 },
      ];
      const { disadvantaged } = calculatePaceAdjustments(horseStyles, 'LONE_SPEED');

      const closerPenalty = disadvantaged.find((d) => d.programNumber === 2);
      expect(closerPenalty?.adjustment).toBe(PACE_SCENARIO_CONFIG.LONE_SPEED_CLOSER_PENALTY);
    });

    it('gives -4 penalty to E types in SPEED_DUEL', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Speed 1', style: 'E' as const, ep1Average: 95 },
        { programNumber: 2, horseName: 'Speed 2', style: 'E' as const, ep1Average: 93 },
        { programNumber: 3, horseName: 'Closer', style: 'S' as const, ep1Average: 70 },
      ];
      const { disadvantaged } = calculatePaceAdjustments(horseStyles, 'SPEED_DUEL');

      const speedPenalties = disadvantaged.filter(
        (d) => d.adjustment === PACE_SCENARIO_CONFIG.SPEED_DUEL_PENALTY
      );
      expect(speedPenalties.length).toBe(2);
    });

    it('gives +4 bonus to S and P types in SPEED_DUEL', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Speed 1', style: 'E' as const, ep1Average: 95 },
        { programNumber: 2, horseName: 'Speed 2', style: 'E' as const, ep1Average: 93 },
        { programNumber: 3, horseName: 'Closer', style: 'S' as const, ep1Average: 70 },
        { programNumber: 4, horseName: 'Stalker', style: 'P' as const, ep1Average: 78 },
      ];
      const { beneficiaries } = calculatePaceAdjustments(horseStyles, 'SPEED_DUEL');

      const closerBonus = beneficiaries.find((b) => b.programNumber === 3);
      const stalkerBonus = beneficiaries.find((b) => b.programNumber === 4);
      expect(closerBonus?.adjustment).toBe(PACE_SCENARIO_CONFIG.SPEED_DUEL_CLOSER_BONUS);
      expect(stalkerBonus?.adjustment).toBe(PACE_SCENARIO_CONFIG.SPEED_DUEL_CLOSER_BONUS);
    });

    it('gives -6 penalty to E types in CHAOTIC', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Speed 1', style: 'E' as const, ep1Average: 95 },
        { programNumber: 2, horseName: 'Speed 2', style: 'E' as const, ep1Average: 93 },
        { programNumber: 3, horseName: 'Speed 3', style: 'E' as const, ep1Average: 92 },
      ];
      const { disadvantaged } = calculatePaceAdjustments(horseStyles, 'CHAOTIC');

      expect(disadvantaged.length).toBe(3);
      expect(disadvantaged[0]?.adjustment).toBe(PACE_SCENARIO_CONFIG.CHAOTIC_SPEED_PENALTY);
    });

    it('gives +5 bonus to S types in CHAOTIC', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Closer', style: 'S' as const, ep1Average: 70 },
      ];
      const { beneficiaries } = calculatePaceAdjustments(horseStyles, 'CHAOTIC');

      expect(beneficiaries[0]?.adjustment).toBe(PACE_SCENARIO_CONFIG.CHAOTIC_CLOSER_BONUS);
    });

    it('gives +3 bonus to P types in CHAOTIC', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Stalker', style: 'P' as const, ep1Average: 78 },
      ];
      const { beneficiaries } = calculatePaceAdjustments(horseStyles, 'CHAOTIC');

      expect(beneficiaries[0]?.adjustment).toBe(PACE_SCENARIO_CONFIG.CHAOTIC_STALKER_BONUS);
    });

    it('gives -4 penalty to S types in SLOW', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Closer', style: 'S' as const, ep1Average: 70 },
      ];
      const { disadvantaged } = calculatePaceAdjustments(horseStyles, 'SLOW');

      expect(disadvantaged[0]?.adjustment).toBe(PACE_SCENARIO_CONFIG.SLOW_CLOSER_PENALTY);
    });

    it('gives +3 bonus to EP and P types in SLOW', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Presser', style: 'EP' as const, ep1Average: 87 },
        { programNumber: 2, horseName: 'Stalker', style: 'P' as const, ep1Average: 78 },
      ];
      const { beneficiaries } = calculatePaceAdjustments(horseStyles, 'SLOW');

      expect(beneficiaries.length).toBe(2);
      expect(beneficiaries[0]?.adjustment).toBe(PACE_SCENARIO_CONFIG.SLOW_PRESSER_BONUS);
    });

    it('gives no adjustments in HONEST pace', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Speed', style: 'E' as const, ep1Average: 95 },
        { programNumber: 2, horseName: 'Closer', style: 'S' as const, ep1Average: 70 },
      ];
      const { beneficiaries, disadvantaged } = calculatePaceAdjustments(horseStyles, 'HONEST');

      expect(beneficiaries.length).toBe(0);
      expect(disadvantaged.length).toBe(0);
    });

    it('ignores UNKNOWN style horses', () => {
      const horseStyles = [
        {
          programNumber: 1,
          horseName: 'Unknown Horse',
          style: 'UNKNOWN' as const,
          ep1Average: null,
        },
      ];
      const { beneficiaries, disadvantaged } = calculatePaceAdjustments(horseStyles, 'LONE_SPEED');

      expect(beneficiaries.length).toBe(0);
      expect(disadvantaged.length).toBe(0);
    });
  });

  // ============================================================================
  // CONFIDENCE CALCULATION TESTS
  // ============================================================================

  describe('calculatePaceConfidence', () => {
    it('returns HIGH for LONE_SPEED with < 10% unknown', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Speed', style: 'E' as const, ep1Average: 95 },
        ...Array(9)
          .fill(null)
          .map((_, i) => ({
            programNumber: i + 2,
            horseName: `Horse ${i + 2}`,
            style: 'S' as const,
            ep1Average: 70,
          })),
      ];
      const confidence = calculatePaceConfidence(horseStyles, 'LONE_SPEED');
      expect(confidence).toBe('HIGH');
    });

    it('returns MEDIUM for moderate unknown percentage', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Speed', style: 'E' as const, ep1Average: 95 },
        { programNumber: 2, horseName: 'Unknown', style: 'UNKNOWN' as const, ep1Average: null },
        ...Array(6)
          .fill(null)
          .map((_, i) => ({
            programNumber: i + 3,
            horseName: `Horse ${i + 3}`,
            style: 'S' as const,
            ep1Average: 70,
          })),
      ];
      const confidence = calculatePaceConfidence(horseStyles, 'HONEST');
      expect(confidence).toBe('MEDIUM');
    });

    it('returns LOW for > 30% unknown', () => {
      const horseStyles = [
        { programNumber: 1, horseName: 'Unknown 1', style: 'UNKNOWN' as const, ep1Average: null },
        { programNumber: 2, horseName: 'Unknown 2', style: 'UNKNOWN' as const, ep1Average: null },
        { programNumber: 3, horseName: 'Unknown 3', style: 'UNKNOWN' as const, ep1Average: null },
        { programNumber: 4, horseName: 'Unknown 4', style: 'UNKNOWN' as const, ep1Average: null },
        ...Array(6)
          .fill(null)
          .map((_, i) => ({
            programNumber: i + 5,
            horseName: `Horse ${i + 5}`,
            style: 'S' as const,
            ep1Average: 70,
          })),
      ];
      const confidence = calculatePaceConfidence(horseStyles, 'HONEST');
      expect(confidence).toBe('LOW');
    });
  });

  // ============================================================================
  // REASON GENERATION TESTS
  // ============================================================================

  describe('generatePaceReason', () => {
    it('generates correct reason for LONE_SPEED', () => {
      const reason = generatePaceReason('LONE_SPEED', 1, 1);
      expect(reason).toContain('Lone speed');
      expect(reason).toContain('unchallenged');
    });

    it('generates correct reason for SPEED_DUEL', () => {
      const reason = generatePaceReason('SPEED_DUEL', 2, 1);
      expect(reason).toContain('Speed duel');
      expect(reason).toContain('2 E-types');
    });

    it('generates correct reason for CHAOTIC', () => {
      const reason = generatePaceReason('CHAOTIC', 4, 0);
      expect(reason).toContain('Chaotic');
      expect(reason).toContain('4 E-types');
    });

    it('generates correct reason for SLOW', () => {
      const reason = generatePaceReason('SLOW', 0, 1);
      expect(reason).toContain('Slow pace');
      expect(reason).toContain('no early speed');
    });
  });

  // ============================================================================
  // MAIN ANALYSIS FUNCTION TESTS
  // ============================================================================

  describe('analyzePaceScenario', () => {
    it('detects LONE_SPEED with 1 E type horse', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, horseName: 'Speed Horse' }),
        createMockHorse([70, 68, 65], { programNumber: 2, horseName: 'Closer 1' }),
        createMockHorse([72, 70, 68], { programNumber: 3, horseName: 'Closer 2' }),
        createMockHorse([75, 73, 71], { programNumber: 4, horseName: 'Stalker' }),
      ];

      const result = analyzePaceScenario(horses);
      expect(result.scenario).toBe('LONE_SPEED');
      expect(result.earlySpeedCount).toBe(1);
      expect(result.likelyLeader).toBe(1);
    });

    it('detects SPEED_DUEL with 2 E type horses', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, horseName: 'Speed 1' }),
        createMockHorse([94, 92, 93], { programNumber: 2, horseName: 'Speed 2' }),
        createMockHorse([70, 68, 65], { programNumber: 3, horseName: 'Closer' }),
      ];

      const result = analyzePaceScenario(horses);
      expect(result.scenario).toBe('SPEED_DUEL');
      expect(result.earlySpeedCount).toBe(2);
      expect(result.speedDuelParticipants).toContain(1);
      expect(result.speedDuelParticipants).toContain(2);
    });

    it('detects CHAOTIC with 3 E type horses', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, horseName: 'Speed 1' }),
        createMockHorse([94, 92, 93], { programNumber: 2, horseName: 'Speed 2' }),
        createMockHorse([96, 94, 95], { programNumber: 3, horseName: 'Speed 3' }),
        createMockHorse([70, 68, 65], { programNumber: 4, horseName: 'Closer' }),
      ];

      const result = analyzePaceScenario(horses);
      expect(result.scenario).toBe('CHAOTIC');
      expect(result.earlySpeedCount).toBe(3);
    });

    it('detects SLOW with no E types and few EP types', () => {
      const horses = [
        createMockHorse([70, 68, 65], { programNumber: 1, horseName: 'Closer 1' }),
        createMockHorse([72, 70, 68], { programNumber: 2, horseName: 'Closer 2' }),
        createMockHorse([75, 73, 71], { programNumber: 3, horseName: 'Stalker' }),
        createMockHorse([78, 76, 74], { programNumber: 4, horseName: 'Stalker 2' }),
      ];

      const result = analyzePaceScenario(horses);
      expect(result.scenario).toBe('SLOW');
      expect(result.earlySpeedCount).toBe(0);
    });

    it('correctly identifies beneficiaries and disadvantaged', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, horseName: 'Speed Horse' }),
        createMockHorse([70, 68, 65], { programNumber: 2, horseName: 'Closer' }),
      ];

      const result = analyzePaceScenario(horses);

      // Speed horse should be beneficiary in LONE_SPEED
      expect(result.beneficiaries.some((b) => b.programNumber === 1)).toBe(true);
      // Closer should be disadvantaged in LONE_SPEED
      expect(result.disadvantaged.some((d) => d.programNumber === 2)).toBe(true);
    });

    it('excludes scratched horses', () => {
      const horses = [
        createMockHorse([95, 93, 92], {
          programNumber: 1,
          horseName: 'Speed Horse',
          isScratched: true,
        }),
        createMockHorse([70, 68, 65], { programNumber: 2, horseName: 'Closer 1' }),
        createMockHorse([72, 70, 68], { programNumber: 3, horseName: 'Closer 2' }),
      ];

      const result = analyzePaceScenario(horses);
      expect(result.earlySpeedCount).toBe(0);
      expect(result.scenario).toBe('SLOW');
    });

    it('sets likelyLeader to highest EP1 among speed types', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, horseName: 'Speed 1' }),
        createMockHorse([98, 97, 96], { programNumber: 2, horseName: 'Speed 2' }), // Higher EP1
      ];

      const result = analyzePaceScenario(horses);
      expect(result.likelyLeader).toBe(2); // Horse 2 has higher EP1
    });
  });

  // ============================================================================
  // UTILITY FUNCTION TESTS
  // ============================================================================

  describe('getPaceAdjustmentForHorse', () => {
    it('returns positive adjustment for beneficiary', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, horseName: 'Speed Horse' }),
        createMockHorse([70, 68, 65], { programNumber: 2, horseName: 'Closer' }),
      ];

      const result = analyzePaceScenario(horses);
      const adjustment = getPaceAdjustmentForHorse(result, 1);
      expect(adjustment).toBe(PACE_SCENARIO_CONFIG.LONE_SPEED_BONUS);
    });

    it('returns negative adjustment for disadvantaged', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, horseName: 'Speed Horse' }),
        createMockHorse([70, 68, 65], { programNumber: 2, horseName: 'Closer' }),
      ];

      const result = analyzePaceScenario(horses);
      const adjustment = getPaceAdjustmentForHorse(result, 2);
      expect(adjustment).toBe(PACE_SCENARIO_CONFIG.LONE_SPEED_CLOSER_PENALTY);
    });

    it('returns 0 for horse not in beneficiaries or disadvantaged', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, horseName: 'Speed Horse' }),
        createMockHorse([87, 86, 85], { programNumber: 2, horseName: 'Presser' }), // EP type - no adjustment in LONE_SPEED
      ];

      const result = analyzePaceScenario(horses);
      const adjustment = getPaceAdjustmentForHorse(result, 2);
      expect(adjustment).toBe(0);
    });
  });

  describe('getHorseRunningStyle', () => {
    it('returns correct running style for horse', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, horseName: 'Speed Horse' }),
      ];

      const result = analyzePaceScenario(horses);
      const style = getHorseRunningStyle(result, 1);
      expect(style).toBe('E');
    });

    it('returns UNKNOWN for non-existent horse', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, horseName: 'Speed Horse' }),
      ];

      const result = analyzePaceScenario(horses);
      const style = getHorseRunningStyle(result, 999);
      expect(style).toBe('UNKNOWN');
    });
  });

  describe('getScenarioDisplayInfo', () => {
    it('returns correct display info for LONE_SPEED', () => {
      const info = getScenarioDisplayInfo('LONE_SPEED');
      expect(info.name).toBe('Lone Speed');
      expect(info.color).toBe('#22c55e');
    });

    it('returns correct display info for CHAOTIC', () => {
      const info = getScenarioDisplayInfo('CHAOTIC');
      expect(info.name).toBe('Chaotic');
      expect(info.color).toBe('#ef4444');
    });
  });

  describe('getStyleDisplayInfo', () => {
    it('returns correct display info for E style', () => {
      const info = getStyleDisplayInfo('E');
      expect(info.name).toBe('Early Speed');
      expect(info.shortName).toBe('E');
    });

    it('returns correct display info for UNKNOWN style', () => {
      const info = getStyleDisplayInfo('UNKNOWN');
      expect(info.name).toBe('Unknown');
      expect(info.shortName).toBe('?');
    });
  });

  describe('formatPaceScenarioSummary', () => {
    it('formats summary correctly', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, horseName: 'Speed Horse' }),
        createMockHorse([70, 68, 65], { programNumber: 2, horseName: 'Closer' }),
      ];

      const result = analyzePaceScenario(horses);
      const summary = formatPaceScenarioSummary(result);

      expect(summary).toContain('Lone Speed');
      expect(summary).toContain('horses affected');
    });
  });

  // ============================================================================
  // CONFIGURATION TESTS
  // ============================================================================

  describe('PACE_SCENARIO_CONFIG', () => {
    it('has correct EP1 thresholds', () => {
      expect(PACE_SCENARIO_CONFIG.EP1_EARLY_SPEED).toBe(92);
      expect(PACE_SCENARIO_CONFIG.EP1_PRESSER).toBe(85);
      expect(PACE_SCENARIO_CONFIG.EP1_STALKER).toBe(75);
    });

    it('has correct adjustment values', () => {
      expect(PACE_SCENARIO_CONFIG.LONE_SPEED_BONUS).toBe(8);
      expect(PACE_SCENARIO_CONFIG.LONE_SPEED_CLOSER_PENALTY).toBe(-3);
      expect(PACE_SCENARIO_CONFIG.SPEED_DUEL_PENALTY).toBe(-4);
      expect(PACE_SCENARIO_CONFIG.SPEED_DUEL_CLOSER_BONUS).toBe(4);
      expect(PACE_SCENARIO_CONFIG.CHAOTIC_SPEED_PENALTY).toBe(-6);
      expect(PACE_SCENARIO_CONFIG.CHAOTIC_CLOSER_BONUS).toBe(5);
      expect(PACE_SCENARIO_CONFIG.CHAOTIC_STALKER_BONUS).toBe(3);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('handles empty horse array', () => {
      const result = analyzePaceScenario([]);
      expect(result.scenario).toBe('SLOW'); // Default for no speed
      expect(result.earlySpeedCount).toBe(0);
    });

    it('handles all scratched horses', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, isScratched: true }),
        createMockHorse([70, 68, 65], { programNumber: 2, isScratched: true }),
      ];

      const result = analyzePaceScenario(horses);
      expect(result.earlySpeedCount).toBe(0);
    });

    it('handles mixed valid and null EP1 data', () => {
      const horses = [
        createMockHorse([95, null, 92], { programNumber: 1, horseName: 'Speed Horse' }),
        createMockHorse([null, null, null], { programNumber: 2, horseName: 'Unknown' }),
      ];

      const result = analyzePaceScenario(horses);
      expect(result.earlySpeedCount).toBe(1);
      expect(result.unknownCount).toBe(1);
    });

    it('correctly counts all style types', () => {
      const horses = [
        createMockHorse([95, 93, 92], { programNumber: 1, horseName: 'E Type' }), // E
        createMockHorse([88, 86, 85], { programNumber: 2, horseName: 'EP Type' }), // EP
        createMockHorse([80, 78, 77], { programNumber: 3, horseName: 'P Type' }), // P
        createMockHorse([70, 68, 65], { programNumber: 4, horseName: 'S Type' }), // S
        createMockHorse([null, null, null], { programNumber: 5, horseName: 'Unknown' }), // UNKNOWN
      ];

      const result = analyzePaceScenario(horses);
      expect(result.earlySpeedCount).toBe(1);
      expect(result.presserCount).toBe(1);
      expect(result.stalkerCount).toBe(1);
      expect(result.closerCount).toBe(1);
      expect(result.unknownCount).toBe(1);
    });
  });

  // ============================================================================
  // STATIC EP1_THRESHOLDS TESTS
  // ============================================================================

  describe('EP1_THRESHOLDS', () => {
    it('has correct static thresholds', () => {
      expect(EP1_THRESHOLDS.E).toBe(92);
      expect(EP1_THRESHOLDS.EP).toBe(85);
      expect(EP1_THRESHOLDS.P).toBe(75);
    });
  });
});
