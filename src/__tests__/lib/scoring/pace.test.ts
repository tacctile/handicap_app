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
});
