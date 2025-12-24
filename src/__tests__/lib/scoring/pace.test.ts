/**
 * Pace Scoring Tests
 * Tests pace scenario fit calculations and running style classifications
 * NOTE: v2.0 rescaled from 40 max to 45 max (scale factor: 45/40 = 1.125)
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePaceScore,
  analyzeFieldPace,
  getPaceSummary,
  calculateRacePaceScores,
  parseRunningStyle,
  analyzePaceScenario,
  calculateTacticalAdvantage,
  // New pace figure exports
  getAverageEarlyPace,
  getAverageLatePace,
  getFieldPacePressure,
  analyzePaceFigures,
  calculatePaceFigureAdjustment,
  EP1_THRESHOLDS,
} from '../../../lib/scoring/pace';
import {
  createHorseEntry,
  createRaceHeader,
  createPastPerformance,
  createRunningLine,
  createSpeedHorse,
  createCloser,
  createPresser,
  createTestField,
} from '../../fixtures/testHelpers';

describe('Pace Scoring', () => {
  describe('Running Style Classification', () => {
    it('classifies E (Early Speed) correctly', () => {
      const horse = createSpeedHorse();

      const profile = parseRunningStyle(horse);

      expect(profile.style).toBe('E');
      expect(profile.styleName).toContain('Speed');
    });

    it('classifies C (Closer) correctly', () => {
      const horse = createCloser();

      const profile = parseRunningStyle(horse);

      expect(profile.style).toBe('C');
      expect(profile.styleName).toContain('Clos');
    });

    it('classifies P (Presser) correctly', () => {
      const horse = createPresser();

      const profile = parseRunningStyle(horse);

      expect(profile.style).toBe('P');
    });

    it('returns U (Unknown) for insufficient data', () => {
      const horse = createHorseEntry({
        runningStyle: '',
        pastPerformances: [],
      });

      const profile = parseRunningStyle(horse);

      expect(profile.style).toBe('U');
    });

    it('uses past performances to determine style when runningStyle field alone is insufficient', () => {
      // parseRunningStyle relies heavily on past performance data for accurate classification
      const horse = createHorseEntry({
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
        ],
      });

      const profile = parseRunningStyle(horse);

      // Style classification is based on actual running lines from PPs
      expect(['E', 'P', 'U']).toContain(profile.style);
    });
  });

  describe('Pace Scenario Analysis', () => {
    it('detects soft pace (lone speed)', () => {
      // Only one speed horse in field
      const horses = [
        createSpeedHorse(),
        createCloser(),
        createCloser(),
        createCloser(),
        createPresser(),
      ];

      const analysis = analyzePaceScenario(horses);

      expect(['soft', 'moderate']).toContain(analysis.scenario);
    });

    it('detects contested pace (multiple speed)', () => {
      // Multiple speed horses
      const horses = [
        createSpeedHorse(),
        createSpeedHorse(),
        createSpeedHorse(),
        createCloser(),
        createPresser(),
      ];

      const analysis = analyzePaceScenario(horses);

      expect(['contested', 'speed_duel', 'moderate']).toContain(analysis.scenario);
    });

    it('calculates pace pressure index (PPI)', () => {
      const horses = createTestField(8);

      const analysis = analyzePaceScenario(horses);

      expect(analysis.ppi).toBeGreaterThanOrEqual(0);
      expect(analysis.ppi).toBeLessThanOrEqual(100);
    });

    it('provides style breakdown counts', () => {
      const horses = [createSpeedHorse(), createCloser(), createPresser(), createPresser()];

      const analysis = analyzePaceScenario(horses);

      expect(analysis.styleBreakdown).toBeDefined();
    });
  });

  describe('Tactical Advantage', () => {
    it('gives excellent advantage to lone speed in soft pace', () => {
      const advantage = calculateTacticalAdvantage('E', 'soft');

      expect(advantage.level).toBe('excellent');
      expect(advantage.points).toBeGreaterThanOrEqual(20);
    });

    it('gives poor advantage to closer in soft pace', () => {
      const advantage = calculateTacticalAdvantage('C', 'soft');

      expect(['poor', 'neutral']).toContain(advantage.level);
      expect(advantage.points).toBeLessThan(15);
    });

    it('gives good advantage to closer in contested pace', () => {
      const advantage = calculateTacticalAdvantage('C', 'contested');

      expect(['good', 'excellent']).toContain(advantage.level);
      expect(advantage.points).toBeGreaterThan(10);
    });

    it('gives poor advantage to speed in speed duel', () => {
      const advantage = calculateTacticalAdvantage('E', 'speed_duel');

      expect(['poor', 'terrible']).toContain(advantage.level);
    });

    it('gives appropriate advantage for unknown scenarios', () => {
      const advantage = calculateTacticalAdvantage('U', 'unknown');

      // Unknown scenarios may return poor or neutral depending on implementation
      expect(['neutral', 'poor']).toContain(advantage.level);
    });
  });

  describe('Field Pace Analysis', () => {
    it('returns legacy format with all required fields', () => {
      const horses = createTestField(8);

      const analysis = analyzeFieldPace(horses);

      expect(analysis.scenario).toBeDefined();
      expect(analysis.scenarioDescription).toBeDefined();
      expect(analysis.speedCount).toBeGreaterThanOrEqual(0);
      expect(analysis.presserCount).toBeGreaterThanOrEqual(0);
      expect(analysis.closerCount).toBeGreaterThanOrEqual(0);
      expect(analysis.pacePressureIndex).toBeGreaterThanOrEqual(0);
      expect(['fast', 'moderate', 'slow']).toContain(analysis.expectedPace);
    });

    it('filters scratched horses from analysis', () => {
      const horses = [
        createSpeedHorse(),
        { ...createSpeedHorse(), isScratched: true },
        createCloser(),
      ];

      const analysis = analyzeFieldPace(horses);

      // Scratched horse should not be counted
      expect(analysis.speedCount).toBeLessThan(2);
    });
  });

  describe('calculatePaceScore', () => {
    it('returns score between 5 and 45', () => {
      const horse = createPresser();
      const header = createRaceHeader();
      const field = createTestField(8);

      const result = calculatePaceScore(horse, header, field);

      expect(result.total).toBeGreaterThanOrEqual(5);
      expect(result.total).toBeLessThanOrEqual(45);
    });

    it('includes profile in result', () => {
      const horse = createSpeedHorse();
      const header = createRaceHeader();
      const field = [horse, createCloser(), createPresser()];

      const result = calculatePaceScore(horse, header, field);

      expect(result.profile).toBeDefined();
      expect(result.profile.style).toBe('E');
    });

    it('includes field analysis in result', () => {
      const horse = createCloser();
      const header = createRaceHeader();
      const field = createTestField(6);

      const result = calculatePaceScore(horse, header, field);

      expect(result.fieldAnalysis).toBeDefined();
      expect(result.fieldAnalysis.scenario).toBeDefined();
    });

    it('includes pace fit classification', () => {
      const horse = createSpeedHorse();
      const header = createRaceHeader();
      const field = [horse, createCloser(), createCloser()]; // Lone speed

      const result = calculatePaceScore(horse, header, field);

      expect(['perfect', 'good', 'neutral', 'poor', 'terrible']).toContain(result.paceFit);
    });

    it('provides reasoning string', () => {
      const horse = createPresser();
      const header = createRaceHeader();
      const field = createTestField(8);

      const result = calculatePaceScore(horse, header, field);

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('uses pre-calculated field analysis when provided', () => {
      const horse = createCloser();
      const header = createRaceHeader();
      const field = createTestField(8);
      const preCalculated = analyzeFieldPace(field);

      const result = calculatePaceScore(horse, header, field, preCalculated);

      expect(result.fieldAnalysis).toBeDefined();
    });
  });

  describe('Track Bias Integration', () => {
    it('adjusts score for speed-favoring track', () => {
      const speedHorse = createSpeedHorse();
      const header = createRaceHeader({ trackCode: 'CD' });
      const field = createTestField(8);

      const result = calculatePaceScore(speedHorse, header, field);

      // Track bias should be considered
      expect(result.trackSpeedBias).toBeDefined();
    });
  });

  describe('getPaceSummary', () => {
    it('returns style, scenario, and fit', () => {
      const horse = createPresser();
      const field = createTestField(8);

      const summary = getPaceSummary(horse, field);

      expect(summary.style).toBeDefined();
      expect(summary.scenario).toBeDefined();
      expect(summary.fit).toBeDefined();
    });
  });

  describe('calculateRacePaceScores', () => {
    it('calculates scores for all horses efficiently', () => {
      const horses = createTestField(10);
      const header = createRaceHeader({ fieldSize: 10 });

      const scores = calculateRacePaceScores(horses, header);

      expect(scores.size).toBe(10);
      expect(scores.get(0)).toBeDefined();
      expect(scores.get(9)).toBeDefined();
    });

    it('shares field analysis calculation', () => {
      const horses = createTestField(8);
      const header = createRaceHeader({ fieldSize: 8 });

      const scores = calculateRacePaceScores(horses, header);

      // All horses should have the same field analysis
      const firstAnalysis = scores.get(0)?.fieldAnalysis;
      const lastAnalysis = scores.get(7)?.fieldAnalysis;

      expect(firstAnalysis?.scenario).toBe(lastAnalysis?.scenario);
      expect(firstAnalysis?.pacePressureIndex).toBe(lastAnalysis?.pacePressureIndex);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty field', () => {
      const horse = createHorseEntry();
      const header = createRaceHeader();

      // Should not throw
      const result = calculatePaceScore(horse, header, [horse]);

      expect(result.total).toBeGreaterThan(0);
    });

    it('handles all scratched horses except one', () => {
      const activeHorse = createHorseEntry();
      const scratchedHorses = Array.from({ length: 5 }, () => ({
        ...createHorseEntry(),
        isScratched: true,
      }));

      const field = [activeHorse, ...scratchedHorses];
      const header = createRaceHeader();

      const result = calculatePaceScore(activeHorse, header, field);

      expect(result.total).toBeGreaterThan(0);
    });

    it('handles horse with no past performance data', () => {
      const horse = createHorseEntry({
        runningStyle: '',
        pastPerformances: [],
      });
      const header = createRaceHeader();
      const field = createTestField(6);

      const result = calculatePaceScore(horse, header, field);

      expect(result.profile.style).toBe('U');
      expect(result.total).toBeGreaterThanOrEqual(5);
    });
  });

  // ==========================================================================
  // NEW PACE FIGURE INTEGRATION TESTS
  // ==========================================================================

  describe('Pace Figure Analysis (EP1 & LP)', () => {
    describe('getAverageEarlyPace', () => {
      it('calculates average EP1 from last 3-5 races', () => {
        const horse = createHorseEntry({
          pastPerformances: [
            createPastPerformance({ earlyPace1: 88 }),
            createPastPerformance({ earlyPace1: 92 }),
            createPastPerformance({ earlyPace1: 85 }),
          ],
        });

        const avgEP1 = getAverageEarlyPace(horse);

        expect(avgEP1).toBeCloseTo(88.3, 1);
      });

      it('returns null if fewer than 2 races have EP1 data', () => {
        const horse = createHorseEntry({
          pastPerformances: [
            createPastPerformance({ earlyPace1: 88 }),
            createPastPerformance({ earlyPace1: null }),
            createPastPerformance({ earlyPace1: null }),
          ],
        });

        const avgEP1 = getAverageEarlyPace(horse);

        expect(avgEP1).toBeNull();
      });

      it('ignores zero values', () => {
        const horse = createHorseEntry({
          pastPerformances: [
            createPastPerformance({ earlyPace1: 88 }),
            createPastPerformance({ earlyPace1: 0 }),
            createPastPerformance({ earlyPace1: 82 }),
          ],
        });

        const avgEP1 = getAverageEarlyPace(horse);

        expect(avgEP1).toBeCloseTo(85, 1);
      });
    });

    describe('getAverageLatePace', () => {
      it('calculates average LP from last 3-5 races', () => {
        const horse = createHorseEntry({
          pastPerformances: [
            createPastPerformance({ latePace: 95 }),
            createPastPerformance({ latePace: 92 }),
            createPastPerformance({ latePace: 90 }),
          ],
        });

        const avgLP = getAverageLatePace(horse);

        expect(avgLP).toBeCloseTo(92.3, 1);
      });

      it('returns null if fewer than 2 races have LP data', () => {
        const horse = createHorseEntry({
          pastPerformances: [
            createPastPerformance({ latePace: 95 }),
            createPastPerformance({ latePace: null }),
          ],
        });

        const avgLP = getAverageLatePace(horse);

        expect(avgLP).toBeNull();
      });
    });

    describe('analyzePaceFigures', () => {
      it('identifies confirmed early speed from high EP1', () => {
        const horse = createHorseEntry({
          pastPerformances: [
            createPastPerformance({ earlyPace1: 90, latePace: 80 }),
            createPastPerformance({ earlyPace1: 88, latePace: 78 }),
            createPastPerformance({ earlyPace1: 92, latePace: 82 }),
          ],
        });

        const analysis = analyzePaceFigures(horse);

        expect(analysis.isConfirmedSpeed).toBe(true);
        expect(analysis.avgEarlyPace).toBeGreaterThanOrEqual(EP1_THRESHOLDS.HIGH);
      });

      it('identifies confirmed closer from low EP1', () => {
        const horse = createHorseEntry({
          pastPerformances: [
            createPastPerformance({ earlyPace1: 65, latePace: 92 }),
            createPastPerformance({ earlyPace1: 62, latePace: 95 }),
            createPastPerformance({ earlyPace1: 68, latePace: 90 }),
          ],
        });

        const analysis = analyzePaceFigures(horse);

        expect(analysis.isConfirmedCloser).toBe(true);
        expect(analysis.avgEarlyPace).toBeLessThan(EP1_THRESHOLDS.LOW);
      });

      it('identifies closing kick (LP significantly > EP1)', () => {
        const horse = createHorseEntry({
          pastPerformances: [
            createPastPerformance({ earlyPace1: 75, latePace: 92 }),
            createPastPerformance({ earlyPace1: 72, latePace: 95 }),
            createPastPerformance({ earlyPace1: 78, latePace: 88 }),
          ],
        });

        const analysis = analyzePaceFigures(horse);

        expect(analysis.hasClosingKick).toBe(true);
        expect(analysis.closingKickDifferential).toBeGreaterThanOrEqual(5);
      });

      it('detects LP trend improving', () => {
        const horse = createHorseEntry({
          pastPerformances: [
            createPastPerformance({ latePace: 95 }), // Most recent - high
            createPastPerformance({ latePace: 88 }),
            createPastPerformance({ latePace: 85 }),
          ],
        });

        const analysis = analyzePaceFigures(horse);

        expect(analysis.lpTrend).toBe('improving');
      });
    });

    describe('getFieldPacePressure', () => {
      it('projects contested pace when multiple high-EP1 horses present', () => {
        // Create horses with high EP1 (requires at least 2 PPs with valid EP1)
        const speedHorse1 = createHorseEntry({
          programNumber: 1,
          pastPerformances: [
            createPastPerformance({ earlyPace1: 92 }),
            createPastPerformance({ earlyPace1: 90 }),
            createPastPerformance({ earlyPace1: 88 }),
          ],
        });
        const speedHorse2 = createHorseEntry({
          programNumber: 2,
          pastPerformances: [
            createPastPerformance({ earlyPace1: 88 }),
            createPastPerformance({ earlyPace1: 90 }),
            createPastPerformance({ earlyPace1: 86 }),
          ],
        });
        const speedHorse3 = createHorseEntry({
          programNumber: 3,
          pastPerformances: [
            createPastPerformance({ earlyPace1: 86 }),
            createPastPerformance({ earlyPace1: 88 }),
            createPastPerformance({ earlyPace1: 90 }),
          ],
        });
        const closer = createHorseEntry({
          programNumber: 4,
          pastPerformances: [
            createPastPerformance({ earlyPace1: 68 }),
            createPastPerformance({ earlyPace1: 65 }),
            createPastPerformance({ earlyPace1: 70 }),
          ],
        });

        const pressure = getFieldPacePressure([speedHorse1, speedHorse2, speedHorse3, closer]);

        // With 3 high EP1 horses, expect contested or duel
        expect(['contested', 'duel']).toContain(pressure.pressure);
        expect(pressure.highEP1Count).toBeGreaterThanOrEqual(2);
      });

      it('projects soft pace when only one speed horse', () => {
        const speedHorse = createHorseEntry({
          programNumber: 1,
          pastPerformances: [
            createPastPerformance({ earlyPace1: 92 }),
            createPastPerformance({ earlyPace1: 90 }),
          ],
        });
        const closer1 = createHorseEntry({
          programNumber: 2,
          pastPerformances: [
            createPastPerformance({ earlyPace1: 68 }),
            createPastPerformance({ earlyPace1: 70 }),
          ],
        });
        const closer2 = createHorseEntry({
          programNumber: 3,
          pastPerformances: [
            createPastPerformance({ earlyPace1: 65 }),
            createPastPerformance({ earlyPace1: 72 }),
          ],
        });
        const closer3 = createHorseEntry({
          programNumber: 4,
          pastPerformances: [
            createPastPerformance({ earlyPace1: 70 }),
            createPastPerformance({ earlyPace1: 68 }),
          ],
        });

        const pressure = getFieldPacePressure([speedHorse, closer1, closer2, closer3]);

        expect(['soft', 'moderate']).toContain(pressure.pressure);
        expect(pressure.highEP1Count).toBeLessThanOrEqual(1);
      });

      it('returns low confidence when insufficient EP1 data', () => {
        const horse1 = createHorseEntry({
          programNumber: 1,
          pastPerformances: [createPastPerformance({ earlyPace1: null })],
        });
        const horse2 = createHorseEntry({
          programNumber: 2,
          pastPerformances: [createPastPerformance({ earlyPace1: null })],
        });

        const pressure = getFieldPacePressure([horse1, horse2]);

        expect(pressure.dataConfidence).toBeLessThan(50);
      });
    });

    describe('calculatePaceFigureAdjustment', () => {
      it('gives bonus to high EP1 speed horse in soft pace', () => {
        const paceFigures = {
          avgEarlyPace: 92,
          avgLatePace: 80,
          ep1RaceCount: 3,
          lpRaceCount: 3,
          ep1Trend: 'stable' as const,
          lpTrend: 'stable' as const,
          isConfirmedSpeed: true,
          isConfirmedCloser: false,
          hasClosingKick: false,
          closingKickDifferential: null,
        };

        const fieldPressure = {
          pressure: 'soft' as const,
          avgFieldEP1: 75,
          totalFieldEP1: 300,
          highEP1Count: 1,
          validHorsesCount: 4,
          confirmedSpeedHorses: [1],
          dataConfidence: 80,
          description: 'Soft pace',
        };

        const adjustment = calculatePaceFigureAdjustment(paceFigures, fieldPressure, 'E');

        expect(adjustment.points).toBeGreaterThanOrEqual(3);
        expect(adjustment.reasoning).toContain('soft pace');
      });

      it('gives bonus to high LP closer in contested pace', () => {
        const paceFigures = {
          avgEarlyPace: 68,
          avgLatePace: 95,
          ep1RaceCount: 3,
          lpRaceCount: 3,
          ep1Trend: 'stable' as const,
          lpTrend: 'stable' as const,
          isConfirmedSpeed: false,
          isConfirmedCloser: true,
          hasClosingKick: true,
          closingKickDifferential: 27,
        };

        const fieldPressure = {
          pressure: 'contested' as const,
          avgFieldEP1: 85,
          totalFieldEP1: 425,
          highEP1Count: 3,
          validHorsesCount: 5,
          confirmedSpeedHorses: [1, 2, 3],
          dataConfidence: 80,
          description: 'Contested pace',
        };

        const adjustment = calculatePaceFigureAdjustment(paceFigures, fieldPressure, 'C');

        expect(adjustment.points).toBeGreaterThanOrEqual(3);
        expect(adjustment.reasoning).toContain('contested');
      });

      it('returns no adjustment when no pace figures available', () => {
        const paceFigures = {
          avgEarlyPace: null,
          avgLatePace: null,
          ep1RaceCount: 0,
          lpRaceCount: 0,
          ep1Trend: 'unknown' as const,
          lpTrend: 'unknown' as const,
          isConfirmedSpeed: false,
          isConfirmedCloser: false,
          hasClosingKick: false,
          closingKickDifferential: null,
        };

        const fieldPressure = {
          pressure: 'moderate' as const,
          avgFieldEP1: null,
          totalFieldEP1: 0,
          highEP1Count: 0,
          validHorsesCount: 0,
          confirmedSpeedHorses: [],
          dataConfidence: 0,
          description: 'No data',
        };

        const adjustment = calculatePaceFigureAdjustment(paceFigures, fieldPressure, 'U');

        expect(adjustment.points).toBe(0);
        expect(adjustment.reasoning).toContain('No pace figures');
      });

      it('gives penalty to closer in soft pace with moderate LP', () => {
        const paceFigures = {
          avgEarlyPace: 65,
          avgLatePace: 72, // Below LP_THRESHOLDS.MODERATE (75)
          ep1RaceCount: 3,
          lpRaceCount: 3,
          ep1Trend: 'stable' as const,
          lpTrend: 'stable' as const,
          isConfirmedSpeed: false,
          isConfirmedCloser: true,
          hasClosingKick: false,
          closingKickDifferential: 7,
        };

        const fieldPressure = {
          pressure: 'soft' as const,
          avgFieldEP1: 70,
          totalFieldEP1: 280,
          highEP1Count: 0,
          validHorsesCount: 4,
          confirmedSpeedHorses: [],
          dataConfidence: 80,
          description: 'Soft pace',
        };

        const adjustment = calculatePaceFigureAdjustment(paceFigures, fieldPressure, 'C');

        expect(adjustment.points).toBeLessThan(0);
      });
    });

    describe('Integration: parseRunningStyle with pace figures', () => {
      it('uses EP1 to validate early speed classification', () => {
        const horse = createHorseEntry({
          runningStyle: 'P',
          pastPerformances: [
            createPastPerformance({
              earlyPace1: 92,
              latePace: 78,
              runningLine: createRunningLine({ start: 3, quarterMile: 2, finish: 3 }),
              finishPosition: 3,
            }),
            createPastPerformance({
              earlyPace1: 90,
              latePace: 80,
              runningLine: createRunningLine({ start: 2, quarterMile: 2, finish: 2 }),
              finishPosition: 2,
            }),
            createPastPerformance({
              earlyPace1: 88,
              latePace: 82,
              runningLine: createRunningLine({ start: 2, quarterMile: 3, finish: 4 }),
              finishPosition: 4,
            }),
          ],
        });

        const profile = parseRunningStyle(horse);

        // High EP1 (avg 90) should confirm as early speed
        expect(profile.paceFigures).toBeDefined();
        expect(profile.paceFigures?.isConfirmedSpeed).toBe(true);
        expect(profile.style).toBe('E'); // Overridden by EP1
      });

      it('includes pace figures in profile description', () => {
        const horse = createHorseEntry({
          pastPerformances: [
            createPastPerformance({ earlyPace1: 92, latePace: 85 }),
            createPastPerformance({ earlyPace1: 90, latePace: 82 }),
          ],
        });

        const profile = parseRunningStyle(horse);

        expect(profile.description).toContain('EP1');
        expect(profile.description).toContain('LP');
      });

      it('falls back to running style logic when no EP1/LP data', () => {
        const horse = createSpeedHorse(); // No EP1/LP data in default helper

        const profile = parseRunningStyle(horse);

        expect(profile.style).toBe('E');
        expect(profile.paceFigures?.avgEarlyPace).toBeNull();
      });
    });

    describe('Integration: analyzePaceScenario includes pacePressure', () => {
      it('includes EP1-based pace pressure in scenario analysis', () => {
        const horses = [
          createHorseEntry({
            programNumber: 1,
            pastPerformances: [
              createPastPerformance({ earlyPace1: 90 }),
              createPastPerformance({ earlyPace1: 88 }),
            ],
          }),
          createHorseEntry({
            programNumber: 2,
            pastPerformances: [
              createPastPerformance({ earlyPace1: 70 }),
              createPastPerformance({ earlyPace1: 72 }),
            ],
          }),
        ];

        const scenario = analyzePaceScenario(horses);

        expect(scenario.pacePressure).toBeDefined();
      });
    });

    describe('Integration: calculatePaceScore includes pace figures', () => {
      it('includes paceFigures in result', () => {
        const horse = createHorseEntry({
          pastPerformances: [
            createPastPerformance({
              earlyPace1: 88,
              latePace: 85,
              runningLine: createRunningLine({ start: 1, quarterMile: 1, finish: 2 }),
              finishPosition: 2,
            }),
            createPastPerformance({
              earlyPace1: 90,
              latePace: 82,
              runningLine: createRunningLine({ start: 1, quarterMile: 1, finish: 1 }),
              finishPosition: 1,
            }),
          ],
        });
        const header = createRaceHeader();
        const field = [horse, createCloser(), createPresser()];

        const result = calculatePaceScore(horse, header, field);

        expect(result.paceFigures).toBeDefined();
      });

      it('includes paceFigureAdjustment when applicable', () => {
        // Create a field with enough EP1 data for adjustment calculation
        const speedHorse = createHorseEntry({
          programNumber: 1,
          pastPerformances: [
            createPastPerformance({ earlyPace1: 92, latePace: 80 }),
            createPastPerformance({ earlyPace1: 90, latePace: 78 }),
            createPastPerformance({ earlyPace1: 88, latePace: 82 }),
          ],
        });
        const closer1 = createHorseEntry({
          programNumber: 2,
          pastPerformances: [
            createPastPerformance({ earlyPace1: 68, latePace: 92 }),
            createPastPerformance({ earlyPace1: 70, latePace: 90 }),
          ],
        });
        const closer2 = createHorseEntry({
          programNumber: 3,
          pastPerformances: [
            createPastPerformance({ earlyPace1: 65, latePace: 88 }),
            createPastPerformance({ earlyPace1: 68, latePace: 85 }),
          ],
        });

        const header = createRaceHeader();
        const field = [speedHorse, closer1, closer2];

        const result = calculatePaceScore(speedHorse, header, field);

        // With valid pace figure data, adjustment should be calculated
        if (result.paceFigures?.avgEarlyPace !== null) {
          expect(result.paceFigureAdjustment).toBeDefined();
        }
      });
    });
  });
});
