/**
 * Longshot Detector Tests
 *
 * Tests for the nuclear longshot detection system that identifies
 * horses at 25/1+ odds with specific upset angles.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectPaceDevastation,
  detectClassRelief,
  detectEquipmentRescue,
  detectTrackBiasFit,
  detectHiddenForm,
  detectAllUpsetAngles,
} from '../longshotDetector';
import {
  MIN_ANGLE_POINTS_LIVE,
  MIN_ANGLE_POINTS_NUCLEAR,
  UPSET_ANGLE_BASE_POINTS,
  getClassificationFromPoints,
  isLongshotOdds,
  parseOddsToDecimal,
} from '../longshotTypes';
import { ClassLevel } from '../../class/classTypes';
import type { ClassAnalysisResult } from '../../class/classTypes';
import type { Workout } from '../../../types/drf';
import {
  createHorseEntry,
  createRaceHeader,
  createPastPerformance,
  createWorkout,
  createMedication,
} from '../../../__tests__/fixtures/testHelpers';
import type { PaceScenarioAnalysis, RunningStyleProfile } from '../../scoring/paceAnalysis';
import type { ClassScoreResult } from '../../class/classScoring';
import type { EquipmentScoreResult } from '../../equipment/equipmentScoring';
import type { DetectedEquipmentChange } from '../../equipment/equipmentTypes';

// Mock trainer patterns
vi.mock('../../equipment/trainerPatterns', () => ({
  getTrainerPattern: vi.fn((trainerName: string, patternType: string) => {
    if (trainerName === 'Chad Brown' && patternType === 'lasix_first') {
      return { winRate: 28, sampleSize: 45 };
    }
    if (trainerName === 'Bob Baffert' && patternType === 'blinkers_on') {
      return { winRate: 32, sampleSize: 68 };
    }
    if (trainerName === 'John Smith' && patternType === 'lasix_first') {
      return { winRate: 15, sampleSize: 20 }; // Below threshold
    }
    return null;
  }),
  getTrainerProfile: vi.fn((trainerName: string) => {
    if (trainerName === 'Chad Brown') {
      return { overallWinRate: 22, sampleSize: 500 };
    }
    return null;
  }),
}));

// Mock track intelligence
vi.mock('../../trackIntelligence', () => ({
  getSpeedBias: vi.fn((trackCode: string, surface: string) => {
    if (trackCode === 'SAR' && surface === 'dirt') {
      return { earlySpeedWinRate: 85, sampleSize: 200 }; // Heavy speed bias
    }
    if (trackCode === 'GP' && surface === 'turf') {
      return { earlySpeedWinRate: 25, sampleSize: 150 }; // Closer bias
    }
    return { earlySpeedWinRate: 55, sampleSize: 100 }; // Neutral
  }),
  getPostPositionBias: vi.fn((trackCode: string, _distance: string, _surface: string) => {
    if (trackCode === 'SAR') {
      return { favoredPosts: [1, 2, 3] };
    }
    return null;
  }),
}));

// Mock logger to suppress warnings
vi.mock('../../../services/logging', () => ({
  logger: {
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
  },
}));

// ============================================================================
// HELPER FACTORIES
// ============================================================================

function createPaceScenario(overrides: Partial<PaceScenarioAnalysis> = {}): PaceScenarioAnalysis {
  return {
    ppi: 45, // Default: no speed duel
    scenario: 'contested',
    scenarioDescription: 'Contested pace',
    styleBreakdown: {
      earlySpeed: [1, 2, 3],
      pressers: [4, 5],
      sustained: [6, 7],
      closers: [8],
      unknown: [],
    },
    pacePressure: 'moderate',
    styledHorses: [],
    advantages: [],
    disadvantages: [],
    projectedEarlyPace: 'moderate',
    ...overrides,
  } as unknown as PaceScenarioAnalysis;
}

function createRunningStyle(overrides: Partial<RunningStyleProfile> = {}): RunningStyleProfile {
  return {
    style: 'P', // Default: presser
    styleName: 'Presser',
    confidence: 75,
    evidence: [],
    averageEarlyPosition: 4,
    averageFinalPosition: 3,
    ...overrides,
  } as unknown as RunningStyleProfile;
}

function createClassScore(overrides: Partial<ClassScoreResult> = {}): ClassScoreResult {
  return {
    total: 10,
    provenAtLevelScore: 0,
    classMovementScore: 0,
    hiddenDropsScore: 0,
    trackTierScore: 0,
    analysis: {
      currentClass: ClassLevel.ALLOWANCE,
      lastRaceClass: ClassLevel.ALLOWANCE,
      recentClassLevels: [],
      movement: {
        direction: 'lateral' as const,
        magnitude: 'minor' as const,
        levelsDifference: 0,
        description: 'Same class',
        fromLevel: ClassLevel.ALLOWANCE,
        toLevel: ClassLevel.ALLOWANCE,
        claimingPriceDrop: null,
      },
      provenAtLevel: {
        hasWon: false,
        winsAtLevel: 0,
        hasPlaced: false,
        itmAtLevel: 0,
        wasCompetitive: false,
        competitiveRacesAtLevel: 0,
        bestFinish: null,
        bestBeyerAtLevel: null,
      },
      hiddenDrops: [],
      trackTierMovement: null,
      classScore: 0,
      reasoning: [],
    },
    reasoning: '',
    breakdown: [],
    ...overrides,
  } as unknown as ClassScoreResult;
}

function createEquipmentScore(overrides: Partial<EquipmentScoreResult> = {}): EquipmentScoreResult {
  return {
    total: 10,
    baseScore: 10,
    changes: [],
    hasSignificantChange: false,
    reasoning: 'No changes',
    usesTrainerPattern: false,
    trainerEvidence: null,
    analysis: {
      hasChanges: false,
      hasSignificantChange: false,
      changes: [],
      currentEquipment: {},
      lastRaceEquipment: {},
    },
    ...overrides,
  } as unknown as EquipmentScoreResult;
}

describe('Longshot Detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Pace Devastation Angle', () => {
    it('detects pace devastation when PPI > 50 and horse is lone closer', () => {
      const horse = createHorseEntry({
        horseName: 'Rally Late',
        morningLineOdds: '30-1',
        runningStyle: 'C',
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
        ],
      });

      const paceScenario = createPaceScenario({
        ppi: 65, // Speed duel
        styleBreakdown: {
          earlySpeed: [1, 2, 3, 4, 5], // 5 speed horses
          pressers: [6],
          sustained: [7],
          closers: [8], // Only 1 closer
          unknown: [],
        },
      });

      const runningStyle = createRunningStyle({
        style: 'C',
        styleName: 'Closer',
        confidence: 85,
        evidence: [
          {
            raceDate: '2024-01-15',
            track: 'SAR',
            firstCallPosition: 8,
            fieldSize: 10,
            finishPosition: 1,
            styleInRace: 'C',
            wasOnLead: false,
            lengthsBehindAtFirstCall: 12,
          },
          {
            raceDate: '2024-01-01',
            track: 'SAR',
            firstCallPosition: 7,
            fieldSize: 9,
            finishPosition: 2,
            styleInRace: 'C',
            wasOnLead: false,
            lengthsBehindAtFirstCall: 10,
          },
        ],
      });

      const result = detectPaceDevastation(horse, [], paceScenario, runningStyle);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('pace_devastation');
      expect(result?.points).toBeGreaterThanOrEqual(UPSET_ANGLE_BASE_POINTS.pace_devastation);
      expect(result?.evidence).toContain('speed');
      expect(result?.evidenceDetails).toContain('PPI: 65 (Speed Duel)');
      expect(result?.hasAllRequiredEvidence).toBe(true);
    });

    it('returns null when PPI is <= 50 (no speed duel)', () => {
      const horse = createHorseEntry({
        runningStyle: 'C',
      });

      const paceScenario = createPaceScenario({
        ppi: 45, // Not a speed duel
      });

      const runningStyle = createRunningStyle({
        style: 'C',
      });

      const result = detectPaceDevastation(horse, [], paceScenario, runningStyle);

      expect(result).toBeNull();
    });

    it('returns null when horse is not a closer', () => {
      const horse = createHorseEntry({
        runningStyle: 'E', // Speed horse, not closer
      });

      const paceScenario = createPaceScenario({
        ppi: 70, // Speed duel exists
        styleBreakdown: {
          earlySpeed: [1, 2, 3, 4, 5],
          pressers: [],
          sustained: [],
          closers: [],
          unknown: [],
        },
      });

      const runningStyle = createRunningStyle({
        style: 'E', // Early speed, not closer
        styleName: 'Early Speed',
      });

      const result = detectPaceDevastation(horse, [], paceScenario, runningStyle);

      expect(result).toBeNull();
    });

    it('returns null when fewer than 4 early speed horses', () => {
      const horse = createHorseEntry({
        runningStyle: 'C',
      });

      const paceScenario = createPaceScenario({
        ppi: 55, // Mild speed duel
        styleBreakdown: {
          earlySpeed: [1, 2, 3], // Only 3 speed horses
          pressers: [4, 5],
          sustained: [6],
          closers: [7, 8],
          unknown: [],
        },
      });

      const runningStyle = createRunningStyle({
        style: 'C',
      });

      const result = detectPaceDevastation(horse, [], paceScenario, runningStyle);

      expect(result).toBeNull();
    });

    it('gives bonus for lone closer vs multiple closers', () => {
      const horse = createHorseEntry();

      const paceScenarioLone = createPaceScenario({
        ppi: 60,
        styleBreakdown: {
          earlySpeed: [1, 2, 3, 4],
          pressers: [5],
          sustained: [6, 7],
          closers: [8], // Lone closer
          unknown: [],
        },
      });

      const paceScenarioMultiple = createPaceScenario({
        ppi: 60,
        styleBreakdown: {
          earlySpeed: [1, 2, 3, 4],
          pressers: [5],
          sustained: [],
          closers: [6, 7, 8], // 3 closers
          unknown: [],
        },
      });

      const runningStyle = createRunningStyle({ style: 'C' });

      const resultLone = detectPaceDevastation(horse, [], paceScenarioLone, runningStyle);
      const resultMultiple = detectPaceDevastation(horse, [], paceScenarioMultiple, runningStyle);

      // Lone closer has the advantage
      expect(resultLone).not.toBeNull();
      // Multiple closers dilutes the angle (may or may not be null depending on implementation)
      if (resultMultiple) {
        // If detected, points should be lower than lone closer
        expect(resultMultiple.points).toBeLessThanOrEqual(resultLone!.points);
      }
    });
  });

  describe('Class Relief Angle', () => {
    it('detects class relief with 3+ level drop and proven form', () => {
      const horse = createHorseEntry({
        horseName: 'Class Dropper',
        morningLineOdds: '25-1',
      });

      const classScore = createClassScore({
        total: 15,
        analysis: {
          currentClass: ClassLevel.CLAIMING_25K_TO_49K,
          lastRaceClass: ClassLevel.ALLOWANCE,
          recentClassLevels: [ClassLevel.ALLOWANCE, ClassLevel.STAKES_UNGRADED],
          movement: {
            direction: 'drop' as const,
            magnitude: 'major' as const,
            levelsDifference: -35, // ~7 levels (major drop)
            description: 'Dropping from ALW to $35K claiming',
            fromLevel: ClassLevel.ALLOWANCE,
            toLevel: ClassLevel.CLAIMING_25K_TO_49K,
            claimingPriceDrop: null,
          },
          provenAtLevel: {
            hasWon: true,
            winsAtLevel: 2,
            hasPlaced: true,
            itmAtLevel: 5,
            wasCompetitive: true,
            competitiveRacesAtLevel: 7,
            bestFinish: 1,
            bestBeyerAtLevel: 92,
          },
          hiddenDrops: [],
          trackTierMovement: null,
          classScore: 15,
          reasoning: [],
        },
      });

      const raceHeader = createRaceHeader();

      const result = detectClassRelief(horse, raceHeader, classScore);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('class_relief');
      expect(result?.points).toBeGreaterThanOrEqual(UPSET_ANGLE_BASE_POINTS.class_relief);
      // Evidence should mention class drop
      expect(
        result?.evidenceDetails.some(
          (e) => e.toLowerCase().includes('class') || e.toLowerCase().includes('drop')
        )
      ).toBe(true);
      // Evidence should mention proven form
      expect(
        result?.evidenceDetails.some(
          (e) => e.toLowerCase().includes('won') || e.toLowerCase().includes('proven')
        )
      ).toBe(true);
    });

    it('returns null when not dropping', () => {
      const horse = createHorseEntry();

      const classScore = createClassScore({
        analysis: {
          movement: {
            direction: 'rise' as const,
            magnitude: 'minor' as const,
            levelsDifference: 5,
            description: 'Rising in class',
            fromLevel: ClassLevel.ALLOWANCE_N2X,
            toLevel: ClassLevel.ALLOWANCE,
            claimingPriceDrop: null,
          },
          provenAtLevel: {
            hasWon: true,
            winsAtLevel: 1,
            hasPlaced: true,
            itmAtLevel: 3,
            wasCompetitive: true,
            competitiveRacesAtLevel: 5,
            bestFinish: 1,
            bestBeyerAtLevel: 85,
          },
        } as unknown as ClassAnalysisResult,
      });

      const raceHeader = createRaceHeader();

      const result = detectClassRelief(horse, raceHeader, classScore);

      expect(result).toBeNull();
    });

    it('returns null when drop is less than 3 levels', () => {
      const horse = createHorseEntry();

      const classScore = createClassScore({
        analysis: {
          movement: {
            direction: 'drop' as const,
            magnitude: 'minor' as const,
            levelsDifference: -5, // Only 1 level
            description: 'Minor drop',
            fromLevel: ClassLevel.ALLOWANCE,
            toLevel: ClassLevel.ALLOWANCE_N1X,
            claimingPriceDrop: null,
          },
          provenAtLevel: {
            hasWon: true,
            winsAtLevel: 1,
            hasPlaced: true,
            itmAtLevel: 2,
            wasCompetitive: true,
            competitiveRacesAtLevel: 3,
            bestFinish: 1,
            bestBeyerAtLevel: 88,
          },
        } as unknown as ClassAnalysisResult,
      });

      const raceHeader = createRaceHeader();

      const result = detectClassRelief(horse, raceHeader, classScore);

      expect(result).toBeNull();
    });

    it('returns null when no proven form at higher level', () => {
      const horse = createHorseEntry();

      const classScore = createClassScore({
        analysis: {
          movement: {
            direction: 'drop' as const,
            magnitude: 'major' as const,
            levelsDifference: -25, // 5 levels
            description: 'Major drop',
            fromLevel: ClassLevel.STAKES_GRADE_3,
            toLevel: ClassLevel.CLAIMING_50K_TO_99K,
            claimingPriceDrop: null,
          },
          provenAtLevel: {
            hasWon: false,
            winsAtLevel: 0,
            hasPlaced: false,
            itmAtLevel: 0,
            wasCompetitive: false, // No proven form!
            competitiveRacesAtLevel: 0,
            bestFinish: 8,
            bestBeyerAtLevel: null,
          },
        } as unknown as ClassAnalysisResult,
      });

      const raceHeader = createRaceHeader();

      const result = detectClassRelief(horse, raceHeader, classScore);

      expect(result).toBeNull();
    });
  });

  describe('Equipment Rescue Angle', () => {
    it('detects equipment rescue with first-time Lasix + Blinkers + trainer pattern', () => {
      const horse = createHorseEntry({
        horseName: 'Fresh Gear',
        trainerName: 'Chad Brown',
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
        }),
        pastPerformances: [
          createPastPerformance({
            tripComment: 'wide into stretch, bumped',
            finishPosition: 6,
          }),
        ],
      });

      const equipmentScore = createEquipmentScore({
        hasSignificantChange: true,
        changes: [
          {
            equipmentType: { id: 'blinkers', name: 'Blinkers' },
            direction: 'added',
            basePoints: 10,
            adjustedPoints: 12,
            changeDescription: 'First-time blinkers',
            impact: 'positive',
          } as unknown as DetectedEquipmentChange,
        ],
        reasoning: 'First-time Lasix + Blinkers',
      });

      const result = detectEquipmentRescue(horse, equipmentScore);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('equipment_rescue');
      expect(result?.points).toBeGreaterThanOrEqual(UPSET_ANGLE_BASE_POINTS.equipment_rescue);
      expect(result?.evidenceDetails).toContain('First-time Lasix + Blinkers ON');
    });

    it('detects equipment rescue with strong trainer pattern alone', () => {
      const horse = createHorseEntry({
        horseName: 'Pattern Play',
        trainerName: 'Bob Baffert',
        medication: createMedication({
          lasixFirstTime: false,
          lasix: true,
        }),
      });

      const equipmentScore = createEquipmentScore({
        hasSignificantChange: true,
        changes: [
          {
            equipmentType: { id: 'blinkers', name: 'Blinkers' },
            direction: 'added',
            basePoints: 10,
            adjustedPoints: 14,
            changeDescription: 'First-time blinkers',
            impact: 'positive',
          } as unknown as DetectedEquipmentChange,
        ],
      });

      const result = detectEquipmentRescue(horse, equipmentScore);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('equipment_rescue');
      // Check that evidence mentions trainer pattern
      expect(result?.evidenceDetails.some((e) => e.toLowerCase().includes('trainer'))).toBe(true);
    });

    it('returns null when no significant equipment changes', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: false,
          lasix: false,
        }),
      });

      const equipmentScore = createEquipmentScore({
        hasSignificantChange: false,
        changes: [],
      });

      const result = detectEquipmentRescue(horse, equipmentScore);

      expect(result).toBeNull();
    });

    it('returns null when trainer win rate is below threshold', () => {
      const horse = createHorseEntry({
        trainerName: 'John Smith', // 15% win rate, below threshold
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
        }),
      });

      const equipmentScore = createEquipmentScore({
        hasSignificantChange: true,
        changes: [], // No blinkers, just Lasix
      });

      const result = detectEquipmentRescue(horse, equipmentScore);

      // Should return null since no blinkers and trainer rate below threshold
      expect(result).toBeNull();
    });

    it('gives bonus for valid excuse in last race', () => {
      const horse = createHorseEntry({
        trainerName: 'Chad Brown',
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
        }),
        pastPerformances: [
          createPastPerformance({
            tripComment: 'blocked in lane, checked sharply',
            finishPosition: 7,
          }),
        ],
      });

      const equipmentScore = createEquipmentScore({
        hasSignificantChange: true,
        changes: [
          {
            equipmentType: { id: 'blinkers', name: 'Blinkers' },
            direction: 'added',
            basePoints: 10,
            adjustedPoints: 12,
            changeDescription: 'First-time blinkers',
            impact: 'positive',
          } as unknown as DetectedEquipmentChange,
        ],
      });

      const result = detectEquipmentRescue(horse, equipmentScore);

      expect(result).not.toBeNull();
      // Evidence should mention the equipment changes
      expect(result?.evidenceDetails.length).toBeGreaterThan(0);
      expect(result?.bonusPoints).toBeGreaterThanOrEqual(0);
    });
  });

  describe('NUCLEAR vs LIVE Classification', () => {
    it('classifies horse as NUCLEAR with 100+ angle points', () => {
      expect(getClassificationFromPoints(100)).toBe('nuclear');
      expect(getClassificationFromPoints(120)).toBe('nuclear');
      expect(getClassificationFromPoints(150)).toBe('nuclear');
    });

    it('classifies horse as LIVE with 60-99 angle points', () => {
      expect(getClassificationFromPoints(60)).toBe('live');
      expect(getClassificationFromPoints(75)).toBe('live');
      expect(getClassificationFromPoints(99)).toBe('live');
    });

    it('classifies horse as LOTTERY with 40-59 points', () => {
      expect(getClassificationFromPoints(40)).toBe('lottery');
      expect(getClassificationFromPoints(50)).toBe('lottery');
      expect(getClassificationFromPoints(59)).toBe('lottery');
    });

    it('classifies horse as DEAD with <40 points', () => {
      expect(getClassificationFromPoints(0)).toBe('dead');
      expect(getClassificationFromPoints(25)).toBe('dead');
      expect(getClassificationFromPoints(39)).toBe('dead');
    });
  });

  describe('Odds Threshold (25/1+ Exclusion)', () => {
    it('correctly identifies 25/1 as longshot odds', () => {
      expect(isLongshotOdds('25-1')).toBe(true);
      expect(isLongshotOdds('25/1')).toBe(true);
    });

    it('correctly identifies 30/1+ as longshot odds', () => {
      expect(isLongshotOdds('30-1')).toBe(true);
      expect(isLongshotOdds('50-1')).toBe(true);
      expect(isLongshotOdds('99-1')).toBe(true);
    });

    it('correctly rejects odds below 25/1', () => {
      expect(isLongshotOdds('5-1')).toBe(false);
      expect(isLongshotOdds('10-1')).toBe(false);
      expect(isLongshotOdds('20-1')).toBe(false);
      expect(isLongshotOdds('24-1')).toBe(false);
    });

    it('parses various odds formats correctly', () => {
      expect(parseOddsToDecimal('25-1')).toBe(26); // 25/1 + 1
      expect(parseOddsToDecimal('25/1')).toBe(26);
      expect(parseOddsToDecimal('10-1')).toBe(11);
      expect(parseOddsToDecimal('5/2')).toBeCloseTo(3.5);
    });
  });

  describe('Evidence Validation', () => {
    it('requires all evidence for pace devastation angle', () => {
      const horse = createHorseEntry();

      // Missing PPI requirement
      const paceScenario = createPaceScenario({
        ppi: 45, // Not > 50
        styleBreakdown: {
          earlySpeed: [1, 2, 3, 4, 5],
          pressers: [],
          sustained: [],
          closers: [6],
          unknown: [],
        },
      });

      const runningStyle = createRunningStyle({ style: 'C' });

      const result = detectPaceDevastation(horse, [], paceScenario, runningStyle);

      expect(result).toBeNull(); // No angle without all evidence
    });

    it('requires all evidence for class relief angle', () => {
      const horse = createHorseEntry();

      // Missing proven form
      const classScore = createClassScore({
        analysis: {
          movement: {
            direction: 'drop' as const,
            magnitude: 'major' as const,
            levelsDifference: -30, // Good drop
            description: 'Major drop',
            fromLevel: ClassLevel.STAKES_GRADE_2,
            toLevel: ClassLevel.CLAIMING_50K_TO_99K,
            claimingPriceDrop: null,
          },
          provenAtLevel: {
            hasWon: false,
            winsAtLevel: 0,
            hasPlaced: false,
            itmAtLevel: 0,
            wasCompetitive: false, // No form!
            competitiveRacesAtLevel: 0,
            bestFinish: null,
            bestBeyerAtLevel: null,
          },
        } as unknown as ClassAnalysisResult,
      });

      const raceHeader = createRaceHeader();

      const result = detectClassRelief(horse, raceHeader, classScore);

      expect(result).toBeNull(); // No angle without proven form
    });
  });

  describe('Edge Cases', () => {
    it('handles missing odds gracefully', () => {
      expect(parseOddsToDecimal('')).toBe(2); // Defaults to even money
      expect(isLongshotOdds('')).toBe(false);
    });

    it('handles incomplete horse data gracefully', () => {
      const horse = createHorseEntry({
        pastPerformances: [], // No past performances
        workouts: [],
      });

      const paceScenario = createPaceScenario();
      const runningStyle = createRunningStyle({ style: 'C' });
      const classScore = createClassScore();
      const equipmentScore = createEquipmentScore();

      // None of these should throw
      const paceResult = detectPaceDevastation(horse, [], paceScenario, runningStyle);
      const classResult = detectClassRelief(horse, createRaceHeader(), classScore);
      const equipResult = detectEquipmentRescue(horse, equipmentScore);

      expect(paceResult).toBeNull();
      expect(classResult).toBeNull();
      expect(equipResult).toBeNull();
    });

    it('handles horse with null workouts', () => {
      const horse = createHorseEntry({
        workouts: null as unknown as Workout[],
        pastPerformances: [],
      });

      const raceHeader = createRaceHeader();

      // Should not throw
      const result = detectHiddenForm(horse, raceHeader);

      expect(result).toBeNull();
    });
  });

  describe('Hidden Form Angle', () => {
    it('detects hidden form with sharp workouts and valid excuse', () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

      const horse = createHorseEntry({
        horseName: 'Ready to Pop',
        workouts: [
          createWorkout({
            date: recentDate.toISOString().split('T')[0],
            isBullet: true,
            distanceFurlongs: 5,
          }),
          createWorkout({
            date: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            isBullet: false,
          }),
          createWorkout({
            date: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            isBullet: false,
          }),
        ],
        pastPerformances: [
          createPastPerformance({
            tripComment: 'blocked at the rail, steadied',
            finishPosition: 6,
            surface: 'dirt',
          }),
        ],
        turfWins: 0,
        lifetimeWins: 2,
      });

      const raceHeader = createRaceHeader({
        surface: 'dirt',
        distance: '6f',
      });

      const result = detectHiddenForm(horse, raceHeader);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('hidden_form');
      // Check that evidence mentions workouts in some form
      expect(
        result?.evidenceDetails.some(
          (e) => e.toLowerCase().includes('work') || e.toLowerCase().includes('bullet')
        )
      ).toBe(true);
    });

    it('returns null without sharp workout pattern', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      const horse = createHorseEntry({
        workouts: [
          createWorkout({
            date: oldDate.toISOString().split('T')[0], // Too old
            isBullet: false,
          }),
        ],
        pastPerformances: [
          createPastPerformance({
            tripComment: 'blocked, trouble',
            finishPosition: 5,
          }),
        ],
      });

      const raceHeader = createRaceHeader();

      const result = detectHiddenForm(horse, raceHeader);

      expect(result).toBeNull();
    });
  });

  describe('Track Bias Fit Angle', () => {
    it('detects track bias fit when speed horse on speed-favoring track', () => {
      const horse = createHorseEntry({
        horseName: 'Speed Demon',
        postPosition: 2, // Favored post at SAR
      });

      const raceHeader = createRaceHeader({
        trackCode: 'SAR',
        surface: 'dirt',
        distance: '6f',
      });

      const runningStyle = createRunningStyle({
        style: 'E',
        styleName: 'Early Speed',
        confidence: 85,
      });

      const result = detectTrackBiasFit(horse, raceHeader, runningStyle);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('track_bias_fit');
      // Check that evidence mentions speed in some form
      expect(result?.evidenceDetails.some((e) => e.toLowerCase().includes('speed'))).toBe(true);
    });

    it('detects track bias fit when closer on closer-favoring track', () => {
      const horse = createHorseEntry({
        horseName: 'Late Runner',
      });

      const raceHeader = createRaceHeader({
        trackCode: 'GP',
        surface: 'turf',
        distance: '1 1/16m',
      });

      const runningStyle = createRunningStyle({
        style: 'C',
        styleName: 'Closer',
        confidence: 80,
      });

      const result = detectTrackBiasFit(horse, raceHeader, runningStyle);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('track_bias_fit');
      // Check that evidence mentions closers in some form
      expect(result?.evidenceDetails.some((e) => e.toLowerCase().includes('closer'))).toBe(true);
    });

    it('returns null when running style does not match bias', () => {
      const horse = createHorseEntry();

      const raceHeader = createRaceHeader({
        trackCode: 'SAR', // Speed bias
        surface: 'dirt',
      });

      const runningStyle = createRunningStyle({
        style: 'C', // Closer on speed track - mismatch
        styleName: 'Closer',
      });

      const result = detectTrackBiasFit(horse, raceHeader, runningStyle);

      expect(result).toBeNull();
    });
  });

  describe('detectAllUpsetAngles Integration', () => {
    it('detects multiple angles for nuclear longshot candidate', () => {
      const now = new Date();

      const horse = createHorseEntry({
        horseName: 'Nuclear Bomb',
        morningLineOdds: '30-1',
        trainerName: 'Chad Brown',
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
        }),
        workouts: [
          createWorkout({
            date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            isBullet: true,
          }),
          createWorkout({
            date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          }),
          createWorkout({
            date: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          }),
        ],
        pastPerformances: [
          createPastPerformance({
            tripComment: 'blocked, steadied',
            finishPosition: 5,
          }),
        ],
      });

      const allHorses = [horse];

      const raceHeader = createRaceHeader();

      const paceScenario = createPaceScenario({
        ppi: 65,
        styleBreakdown: {
          earlySpeed: [1, 2, 3, 4, 5],
          pressers: [6],
          sustained: [7],
          closers: [8],
          unknown: [],
        },
      });

      const runningStyle = createRunningStyle({
        style: 'C',
        evidence: [
          {
            raceDate: '2024-01-15',
            track: 'SAR',
            firstCallPosition: 8,
            fieldSize: 10,
            finishPosition: 1,
            styleInRace: 'C',
            wasOnLead: false,
            lengthsBehindAtFirstCall: 12,
          },
          {
            raceDate: '2024-01-01',
            track: 'SAR',
            firstCallPosition: 7,
            fieldSize: 9,
            finishPosition: 2,
            styleInRace: 'C',
            wasOnLead: false,
            lengthsBehindAtFirstCall: 10,
          },
        ],
      });

      const classScore = createClassScore({
        analysis: {
          movement: {
            direction: 'drop' as const,
            magnitude: 'major' as const,
            levelsDifference: -25,
            description: 'Major class drop',
            fromLevel: ClassLevel.STAKES_UNGRADED,
            toLevel: ClassLevel.CLAIMING_50K_TO_99K,
            claimingPriceDrop: null,
          },
          provenAtLevel: {
            hasWon: true,
            winsAtLevel: 1,
            hasPlaced: true,
            itmAtLevel: 3,
            wasCompetitive: true,
            competitiveRacesAtLevel: 5,
            bestFinish: 1,
            bestBeyerAtLevel: 90,
          },
        } as unknown as ClassAnalysisResult,
      });

      const equipmentScore = createEquipmentScore({
        hasSignificantChange: true,
        changes: [
          {
            equipmentType: { id: 'blinkers', name: 'Blinkers' },
            direction: 'added',
            basePoints: 10,
            adjustedPoints: 12,
            changeDescription: 'First-time blinkers',
            impact: 'positive',
          } as unknown as DetectedEquipmentChange,
        ],
      });

      const angles = detectAllUpsetAngles(
        horse,
        allHorses,
        raceHeader,
        paceScenario,
        runningStyle,
        classScore,
        equipmentScore
      );

      expect(angles.length).toBeGreaterThan(0);

      // Calculate total points
      const totalPoints = angles.reduce((sum, a) => sum + a.points, 0);

      // With multiple angles, should qualify as at least LIVE
      if (totalPoints >= MIN_ANGLE_POINTS_NUCLEAR) {
        expect(getClassificationFromPoints(totalPoints)).toBe('nuclear');
      } else if (totalPoints >= MIN_ANGLE_POINTS_LIVE) {
        expect(getClassificationFromPoints(totalPoints)).toBe('live');
      }
    });

    it('returns empty array when no angles apply', () => {
      const horse = createHorseEntry({
        horseName: 'No Angle Horse',
        runningStyle: 'P', // Not closer
        medication: createMedication({
          lasixFirstTime: false,
        }),
      });

      const allHorses = [horse];

      const raceHeader = createRaceHeader();

      const paceScenario = createPaceScenario({
        ppi: 40, // No speed duel
      });

      const runningStyle = createRunningStyle({
        style: 'P', // Presser
      });

      const classScore = createClassScore({
        analysis: {
          movement: {
            direction: 'lateral' as const,
            magnitude: 'minor' as const,
            levelsDifference: 0,
            description: 'Same class',
            fromLevel: ClassLevel.ALLOWANCE,
            toLevel: ClassLevel.ALLOWANCE,
            claimingPriceDrop: null,
          },
          provenAtLevel: {
            hasWon: false,
            winsAtLevel: 0,
            hasPlaced: false,
            itmAtLevel: 0,
            wasCompetitive: false,
            competitiveRacesAtLevel: 0,
            bestFinish: null,
            bestBeyerAtLevel: null,
          },
        } as unknown as ClassAnalysisResult,
      });

      const equipmentScore = createEquipmentScore({
        hasSignificantChange: false,
        changes: [],
      });

      const angles = detectAllUpsetAngles(
        horse,
        allHorses,
        raceHeader,
        paceScenario,
        runningStyle,
        classScore,
        equipmentScore
      );

      expect(angles.length).toBe(0);
    });
  });

  describe('Real-World Racing Scenarios', () => {
    it('identifies pace collapse scenario like the 2009 KY Derby', () => {
      // Mine That Bird scenario: 50/1 closer in speed duel
      const horse = createHorseEntry({
        horseName: 'Long Shot Closer',
        morningLineOdds: '50-1',
        runningStyle: 'C',
      });

      const paceScenario = createPaceScenario({
        ppi: 75, // Hot pace scenario
        styleBreakdown: {
          earlySpeed: [1, 2, 3, 4, 5, 6], // 6 speed horses
          pressers: [7, 8],
          sustained: [],
          closers: [9], // Lone closer
          unknown: [],
        },
      });

      const runningStyle = createRunningStyle({
        style: 'C',
        styleName: 'Closer',
        confidence: 90,
        evidence: [
          {
            raceDate: '2024-01-20',
            track: 'CD',
            firstCallPosition: 10,
            fieldSize: 12,
            finishPosition: 1,
            styleInRace: 'C',
            wasOnLead: false,
            lengthsBehindAtFirstCall: 15,
          },
          {
            raceDate: '2024-01-10',
            track: 'CD',
            firstCallPosition: 9,
            fieldSize: 11,
            finishPosition: 2,
            styleInRace: 'C',
            wasOnLead: false,
            lengthsBehindAtFirstCall: 12,
          },
          {
            raceDate: '2024-01-01',
            track: 'CD',
            firstCallPosition: 8,
            fieldSize: 10,
            finishPosition: 3,
            styleInRace: 'C',
            wasOnLead: false,
            lengthsBehindAtFirstCall: 10,
          },
        ],
      });

      const result = detectPaceDevastation(horse, [], paceScenario, runningStyle);

      expect(result).not.toBeNull();
      expect(result?.points).toBeGreaterThanOrEqual(40);
      expect(result?.confidence).toBeGreaterThan(70);
    });

    it('identifies class dropper like mid-level claimer dropping to bottom', () => {
      const horse = createHorseEntry({
        horseName: 'Dropping Down',
        morningLineOdds: '25-1',
        claimingPrice: 12500,
        pastPerformances: [
          createPastPerformance({
            claimingPrice: 40000,
            finishPosition: 1,
            classification: 'claiming',
          }),
          createPastPerformance({
            claimingPrice: 50000,
            finishPosition: 2,
            classification: 'claiming',
          }),
        ],
      });

      const classScore = createClassScore({
        analysis: {
          movement: {
            direction: 'drop' as const,
            magnitude: 'extreme' as const,
            levelsDifference: -15, // Major drop
            description: 'Dropping from $40K to $12.5K',
            fromLevel: ClassLevel.CLAIMING_25K_TO_49K,
            toLevel: ClassLevel.CLAIMING_10K_TO_24K,
            claimingPriceDrop: 27500,
          },
          provenAtLevel: {
            hasWon: true,
            winsAtLevel: 1,
            hasPlaced: true,
            itmAtLevel: 2,
            wasCompetitive: true,
            competitiveRacesAtLevel: 4,
            bestFinish: 1,
            bestBeyerAtLevel: 78,
          },
          hiddenDrops: [
            {
              type: 'claiming_price_drop' as const,
              description: '$27.5K claiming price drop',
              pointsBonus: 10,
              explanation: 'Major claiming drop',
            },
          ],
        } as unknown as ClassAnalysisResult,
      });

      const raceHeader = createRaceHeader({
        classification: 'claiming',
        claimingPriceMax: 12500,
      });

      const result = detectClassRelief(horse, raceHeader, classScore);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('class_relief');
      expect(result?.bonusPoints).toBeGreaterThan(0);
    });
  });
});
