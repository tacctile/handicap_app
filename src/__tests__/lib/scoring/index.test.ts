/**
 * Main Scoring Engine Tests
 * Tests calculateRaceScores, SCORE_LIMITS enforcement, and determinism
 */

import { describe, it, expect } from 'vitest';
import {
  calculateRaceScores,
  calculateHorseScore,
  calculateRaceConfidence,
  getTopHorses,
  parseOdds,
  getScoreColor,
  getScoreTier,
  MAX_SCORE,
  SCORE_LIMITS,
  SCORE_THRESHOLDS,
} from '../../../lib/scoring';
import {
  createHorseEntry,
  createRaceHeader,
  createPastPerformance,
  createTestField,
  createSpeedFigures,
} from '../../fixtures/testHelpers';

describe('Main Scoring Engine', () => {
  describe('calculateRaceScores', () => {
    it('returns scored horses for entire field', () => {
      const horses = createTestField(10);
      const header = createRaceHeader({ fieldSize: 10 });
      const getOdds = (_i: number, odds: string) => odds;
      const isScratched = () => false;

      const results = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result.horse).toBeDefined();
        expect(result.score).toBeDefined();
        expect(result.score.total).toBeGreaterThanOrEqual(0);
      });
    });

    it('sorts horses by post position', () => {
      const horses = createTestField(8);
      const header = createRaceHeader({ fieldSize: 8 });
      const getOdds = (_i: number, odds: string) => odds;
      const isScratched = () => false;

      const results = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');

      // Horses should be sorted by post position ascending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].horse.postPosition).toBeLessThanOrEqual(
          results[i].horse.postPosition
        );
      }
    });

    it('keeps scratched horses in their post position order', () => {
      const horses = createTestField(6);
      const header = createRaceHeader({ fieldSize: 6 });
      const getOdds = (_i: number, odds: string) => odds;
      const isScratched = (i: number) => i === 0 || i === 2; // Scratch positions 1 and 3

      const results = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');

      // Scratched horses should still be in their original positions
      const scratchedHorses = results.filter((r) => r.score.isScratched);
      const activeHorses = results.filter((r) => !r.score.isScratched);

      expect(scratchedHorses.length).toBe(2);
      expect(activeHorses.length).toBe(4);

      // Horses should stay in post position order (scratched included)
      expect(results[0].index).toBe(0); // Scratched horse at position 1
      expect(results[2].index).toBe(2); // Scratched horse at position 3
    });

    it('assigns correct ranks (scratched = no rank)', () => {
      const horses = createTestField(6);
      const header = createRaceHeader({ fieldSize: 6 });
      const getOdds = (_i: number, odds: string) => odds;
      const isScratched = (i: number) => i === 2;

      const results = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');

      // Active horses should have ranks 1-5 (assigned based on score, not post position order)
      const ranks = results.filter((r) => !r.score.isScratched).map((r) => r.rank);
      // Ranks should be 1-5 but may appear in any order since sorted by post position
      expect(ranks.sort()).toEqual([1, 2, 3, 4, 5]);

      // Scratched horse should have rank 0 or no rank
      const scratchedRanks = results.filter((r) => r.score.isScratched).map((r) => r.rank);
      expect(scratchedRanks.every((r) => r === 0)).toBe(true);
    });
  });

  describe('calculateHorseScore', () => {
    it('returns complete score breakdown', () => {
      const horse = createHorseEntry();
      const header = createRaceHeader();

      const result = calculateHorseScore(horse, header, '5-1', 'fast', false);

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.connections).toBeDefined();
      expect(result.breakdown.postPosition).toBeDefined();
      expect(result.breakdown.speedClass).toBeDefined();
      expect(result.breakdown.form).toBeDefined();
      expect(result.breakdown.equipment).toBeDefined();
      expect(result.breakdown.pace).toBeDefined();
    });

    it('returns zero score for scratched horse', () => {
      const horse = createHorseEntry();
      const header = createRaceHeader();

      const result = calculateHorseScore(horse, header, '5-1', 'fast', true);

      expect(result.total).toBe(0);
      expect(result.isScratched).toBe(true);
      expect(result.breakdown.connections.total).toBe(0);
    });

    it('includes confidence level in result', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 85 }) }),
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 82 }) }),
        ],
      });
      const header = createRaceHeader();

      const result = calculateHorseScore(horse, header, '5-1', 'fast', false);

      expect(['high', 'medium', 'low']).toContain(result.confidenceLevel);
    });

    it('calculates data quality score', () => {
      const horse = createHorseEntry({
        pastPerformances: Array.from({ length: 5 }, () =>
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 80 }) })
        ),
      });
      const header = createRaceHeader();

      const result = calculateHorseScore(horse, header, '5-1', 'fast', false);

      expect(result.dataQuality).toBeGreaterThan(0);
      expect(result.dataQuality).toBeLessThanOrEqual(100);
    });
  });

  describe('SCORE_LIMITS Enforcement', () => {
    it('total score is capped at MAX_SCORE (368)', () => {
      // Create a horse that would score very high in all categories
      const horse = createHorseEntry({
        postPosition: 4,
        pastPerformances: Array.from({ length: 10 }, (_, i) =>
          createPastPerformance({
            finishPosition: 1,
            speedFigures: createSpeedFigures({ beyer: 100 + i }),
          })
        ),
      });
      const header = createRaceHeader({ classification: 'maiden' });

      const result = calculateHorseScore(horse, header, '2-1', 'fast', false);

      expect(result.total).toBeLessThanOrEqual(MAX_SCORE);
      expect(result.total).toBeLessThanOrEqual(SCORE_LIMITS.total);
    });

    it('connections score does not exceed 55', () => {
      const horse = createHorseEntry({
        pastPerformances: Array.from({ length: 20 }, () =>
          createPastPerformance({ finishPosition: 1 })
        ),
      });
      const header = createRaceHeader();

      const result = calculateHorseScore(horse, header, '5-1', 'fast', false);

      expect(result.breakdown.connections.total).toBeLessThanOrEqual(SCORE_LIMITS.connections);
    });

    it('post position score does not exceed 45', () => {
      const horse = createHorseEntry({ postPosition: 4 }); // Optimal position
      const header = createRaceHeader({ fieldSize: 10 });

      const result = calculateHorseScore(horse, header, '5-1', 'fast', false);

      expect(result.breakdown.postPosition.total).toBeLessThanOrEqual(SCORE_LIMITS.postPosition);
    });

    it('speed/class score does not exceed 50', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
            finishPosition: 1,
            speedFigures: createSpeedFigures({ beyer: 110 }),
          }),
        ],
      });
      const header = createRaceHeader({ classification: 'allowance' });

      const result = calculateHorseScore(horse, header, '5-1', 'fast', false);

      expect(result.breakdown.speedClass.total).toBeLessThanOrEqual(SCORE_LIMITS.speedClass);
    });

    it('form score does not exceed 30', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        pastPerformances: Array.from({ length: 5 }, () =>
          createPastPerformance({ finishPosition: 1 })
        ),
      });
      const header = createRaceHeader();

      const result = calculateHorseScore(horse, header, '5-1', 'fast', false);

      expect(result.breakdown.form.total).toBeLessThanOrEqual(SCORE_LIMITS.form);
    });

    it('equipment score does not exceed 25', () => {
      const horse = createHorseEntry();
      const header = createRaceHeader();

      const result = calculateHorseScore(horse, header, '5-1', 'fast', false);

      expect(result.breakdown.equipment.total).toBeLessThanOrEqual(SCORE_LIMITS.equipment);
    });

    it('pace score does not exceed 40', () => {
      const horse = createHorseEntry();
      const header = createRaceHeader();

      const result = calculateHorseScore(horse, header, '5-1', 'fast', false);

      expect(result.breakdown.pace.total).toBeLessThanOrEqual(SCORE_LIMITS.pace);
    });
  });

  describe('Determinism', () => {
    it('same inputs produce same outputs', () => {
      const horse = createHorseEntry({
        horseName: 'Determinism Test',
        postPosition: 5,
        pastPerformances: [
          createPastPerformance({
            finishPosition: 2,
            speedFigures: createSpeedFigures({ beyer: 85 }),
          }),
          createPastPerformance({
            finishPosition: 3,
            speedFigures: createSpeedFigures({ beyer: 82 }),
          }),
        ],
      });
      const header = createRaceHeader();

      const result1 = calculateHorseScore(horse, header, '5-1', 'fast', false);
      const result2 = calculateHorseScore(horse, header, '5-1', 'fast', false);
      const result3 = calculateHorseScore(horse, header, '5-1', 'fast', false);

      expect(result1.total).toBe(result2.total);
      expect(result2.total).toBe(result3.total);

      expect(result1.breakdown.connections.total).toBe(result2.breakdown.connections.total);
      expect(result1.breakdown.speedClass.total).toBe(result2.breakdown.speedClass.total);
      expect(result1.breakdown.form.total).toBe(result2.breakdown.form.total);
    });

    it('race scoring is deterministic across multiple calls', () => {
      const horses = createTestField(8);
      const header = createRaceHeader({ fieldSize: 8 });
      const getOdds = (_i: number, odds: string) => odds;
      const isScratched = () => false;

      const results1 = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');
      const results2 = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');

      results1.forEach((result, i) => {
        expect(result.score.total).toBe(results2[i].score.total);
        expect(result.rank).toBe(results2[i].rank);
      });
    });
  });

  describe('calculateRaceConfidence', () => {
    it('returns confidence between 0 and 100', () => {
      const horses = createTestField(8);
      const header = createRaceHeader({ fieldSize: 8 });
      const getOdds = (_i: number, odds: string) => odds;
      const isScratched = () => false;

      const scoredHorses = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');
      const confidence = calculateRaceConfidence(scoredHorses);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(100);
    });

    it('returns 0 for empty field', () => {
      const confidence = calculateRaceConfidence([]);

      expect(confidence).toBe(0);
    });

    it('returns 0 when all horses scratched', () => {
      const horses = createTestField(4);
      const header = createRaceHeader({ fieldSize: 4 });
      const getOdds = (_i: number, odds: string) => odds;
      const isScratched = () => true;

      const scoredHorses = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');
      const confidence = calculateRaceConfidence(scoredHorses);

      expect(confidence).toBe(0);
    });

    it('higher confidence for larger score separation', () => {
      // Create horses with varied scores
      const horse1 = createHorseEntry({
        postPosition: 4,
        pastPerformances: Array.from({ length: 5 }, () =>
          createPastPerformance({
            finishPosition: 1,
            speedFigures: createSpeedFigures({ beyer: 95 }),
          })
        ),
      });
      const horse2 = createHorseEntry({
        postPosition: 12,
        pastPerformances: [],
      });

      const header = createRaceHeader({ fieldSize: 2 });
      const getOdds = () => '5-1';
      const isScratched = () => false;

      const scoredHorses = calculateRaceScores(
        [horse1, horse2],
        header,
        getOdds,
        isScratched,
        'fast'
      );
      const confidence = calculateRaceConfidence(scoredHorses);

      // Should have decent confidence with score separation
      expect(confidence).toBeGreaterThan(40);
    });
  });

  describe('getTopHorses', () => {
    it('returns top 3 horses by default', () => {
      const horses = createTestField(10);
      const header = createRaceHeader({ fieldSize: 10 });
      const getOdds = (_i: number, odds: string) => odds;
      const isScratched = () => false;

      const scoredHorses = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');
      const topHorses = getTopHorses(scoredHorses);

      expect(topHorses).toHaveLength(3);
    });

    it('excludes scratched horses', () => {
      const horses = createTestField(6);
      const header = createRaceHeader({ fieldSize: 6 });
      const getOdds = (_i: number, odds: string) => odds;
      const isScratched = (i: number) => i === 0 || i === 1;

      const scoredHorses = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');
      const topHorses = getTopHorses(scoredHorses, 3);

      topHorses.forEach((horse) => {
        expect(horse.score.isScratched).toBe(false);
      });
    });

    it('returns specified count', () => {
      const horses = createTestField(10);
      const header = createRaceHeader({ fieldSize: 10 });
      const getOdds = (_i: number, odds: string) => odds;
      const isScratched = () => false;

      const scoredHorses = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');
      const topFive = getTopHorses(scoredHorses, 5);

      expect(topFive).toHaveLength(5);
    });
  });

  describe('Utility Functions', () => {
    describe('parseOdds', () => {
      it('parses X-1 format', () => {
        expect(parseOdds('5-1')).toBe(5);
        expect(parseOdds('10-1')).toBe(10);
        expect(parseOdds('3-1')).toBe(3);
      });

      it('parses X/Y format', () => {
        expect(parseOdds('5/2')).toBe(2.5);
        expect(parseOdds('9/5')).toBe(1.8);
      });

      it('parses EVEN odds', () => {
        expect(parseOdds('EVEN')).toBe(1);
        expect(parseOdds('EVN')).toBe(1);
      });

      it('parses decimal format', () => {
        expect(parseOdds('3.5')).toBe(3.5);
      });

      it('returns default for invalid input', () => {
        expect(parseOdds('')).toBe(10);
        expect(parseOdds('invalid')).toBe(10);
      });
    });

    describe('getScoreColor', () => {
      it('returns correct colors for score thresholds', () => {
        expect(getScoreColor(200, false)).toBe('#22c55e'); // Elite - Green
        expect(getScoreColor(190, false)).toBe('#4ade80'); // Strong - Light Green
        expect(getScoreColor(170, false)).toBe('#eab308'); // Good - Yellow
        expect(getScoreColor(150, false)).toBe('#f97316'); // Fair - Orange
        expect(getScoreColor(100, false)).toBe('#ef4444'); // Weak - Red
      });

      it('returns weak color for scratched horses', () => {
        expect(getScoreColor(200, true)).toBe('#ef4444'); // Red for scratched
      });
    });

    describe('getScoreTier', () => {
      it('returns correct tier names', () => {
        expect(getScoreTier(200)).toBe('Elite');
        expect(getScoreTier(185)).toBe('Strong');
        expect(getScoreTier(165)).toBe('Good');
        expect(getScoreTier(145)).toBe('Fair');
        expect(getScoreTier(100)).toBe('Weak');
      });
    });
  });

  describe('Score Thresholds', () => {
    it('thresholds are correctly defined', () => {
      expect(SCORE_THRESHOLDS.elite).toBe(200);
      expect(SCORE_THRESHOLDS.strong).toBe(180);
      expect(SCORE_THRESHOLDS.good).toBe(160);
      expect(SCORE_THRESHOLDS.fair).toBe(140);
      expect(SCORE_THRESHOLDS.weak).toBe(0);
    });
  });
});
