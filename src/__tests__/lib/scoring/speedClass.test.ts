/**
 * Speed & Class Scoring Tests
 * Tests speed figure and class level evaluation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSpeedClassScore,
  getParFigures,
  getClassHierarchy,
} from '../../../lib/scoring/speedClass';
import {
  createHorseEntry,
  createRaceHeader,
  createPastPerformance,
  createSpeedFigures,
  createSpeedFigureHorse,
} from '../../fixtures/testHelpers';

describe('Speed & Class Scoring', () => {
  describe('Speed Figure Scoring', () => {
    it('returns 30 points (max) for speed figure 10+ above par', () => {
      const header = createRaceHeader({ classification: 'allowance' }); // Par = 82
      const horse = createSpeedFigureHorse([95, 92, 90]); // Best = 95, 13 above par

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(30);
    });

    it('returns 25 points for speed figure 5-9 above par', () => {
      const header = createRaceHeader({ classification: 'allowance' }); // Par = 82
      const horse = createSpeedFigureHorse([88, 86, 85]); // Best = 88, 6 above par

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(25);
    });

    it('returns 20 points for speed figure at par (0-4 above)', () => {
      const header = createRaceHeader({ classification: 'allowance' }); // Par = 82
      const horse = createSpeedFigureHorse([84, 82, 80]); // Best = 84, 2 above par

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(20);
    });

    it('returns 15 points for speed figure 1-5 below par', () => {
      const header = createRaceHeader({ classification: 'allowance' }); // Par = 82
      const horse = createSpeedFigureHorse([80, 78, 77]); // Best = 80, 2 below par

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(15);
    });

    it('returns 10 points for speed figure 6-10 below par', () => {
      const header = createRaceHeader({ classification: 'allowance' }); // Par = 82
      const horse = createSpeedFigureHorse([75, 73, 72]); // Best = 75, 7 below par

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(10);
    });

    it('returns 5 points for speed figure significantly below par', () => {
      const header = createRaceHeader({ classification: 'allowance' }); // Par = 82
      const horse = createSpeedFigureHorse([65, 63, 60]); // Best = 65, 17 below par

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(5);
    });

    it('returns neutral 15 for missing speed figures', () => {
      const header = createRaceHeader({ classification: 'allowance' });
      const horse = createHorseEntry({
        bestBeyer: null,
        averageBeyer: null,
        lastBeyer: null,
        pastPerformances: [
          createPastPerformance({
            speedFigures: createSpeedFigures({ beyer: null }),
          }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(15);
      expect(result.speedReasoning).toContain('No speed figures');
    });

    it('uses best of last 3 races for scoring', () => {
      const header = createRaceHeader({ classification: 'maiden' }); // Par = 72
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 75 }) }),
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 85 }) }), // Best
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 70 }) }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.bestRecentFigure).toBe(85);
    });
  });

  describe('Class Level Scoring', () => {
    it('returns 20 points (max) for proven winner at level', () => {
      const header = createRaceHeader({ classification: 'allowance' });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ classification: 'allowance', finishPosition: 1 }),
          createPastPerformance({ classification: 'allowance', finishPosition: 3 }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.classScore).toBe(20);
      expect(result.classReasoning).toContain('Proven winner');
    });

    it('returns 15 points for competitive at level (placed)', () => {
      const header = createRaceHeader({ classification: 'allowance' });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ classification: 'allowance', finishPosition: 2 }),
          createPastPerformance({ classification: 'allowance', finishPosition: 3 }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.classScore).toBe(15);
      expect(result.classReasoning).toContain('Competitive');
    });

    it('returns 10 points for first-time starter (unknown class)', () => {
      const header = createRaceHeader({ classification: 'maiden' });
      const horse = createHorseEntry({
        lifetimeStarts: 0,
        pastPerformances: [],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.classScore).toBe(10);
      expect(result.classReasoning).toContain('First-time starter');
    });

    it('detects class drop and returns 16+ points', () => {
      const header = createRaceHeader({ classification: 'claiming' }); // Lower class
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ classification: 'allowance', finishPosition: 5 }), // Higher class
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.classMovement).toBe('drop');
      expect(result.classScore).toBeGreaterThanOrEqual(16);
    });

    it('detects class rise', () => {
      const header = createRaceHeader({ classification: 'stakes' }); // Higher class
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ classification: 'allowance', finishPosition: 1 }), // Lower class
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.classMovement).toBe('rise');
    });

    it('returns higher score for class drop with valid excuse', () => {
      const header = createRaceHeader({ classification: 'claiming' });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
            finishPosition: 6,
            tripComment: 'Wide on both turns, bumped at start',
          }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.classScore).toBe(18);
      expect(result.classReasoning).toContain('excuse');
    });
  });

  describe('Combined Score', () => {
    it('total is sum of speed and class scores', () => {
      const header = createRaceHeader({ classification: 'allowance' });
      const horse = createSpeedFigureHorse([85, 83, 80]);

      // Add class history
      horse.pastPerformances = horse.pastPerformances.map((pp) => ({
        ...pp,
        classification: 'allowance' as const,
        finishPosition: 2,
      }));

      const result = calculateSpeedClassScore(horse, header);

      expect(result.total).toBe(result.speedScore + result.classScore);
    });

    it('total score is capped at 50 points', () => {
      const header = createRaceHeader({ classification: 'maiden' });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            classification: 'maiden',
            finishPosition: 1,
            speedFigures: createSpeedFigures({ beyer: 95 }),
          }),
          createPastPerformance({
            classification: 'maiden',
            finishPosition: 1,
            speedFigures: createSpeedFigures({ beyer: 90 }),
          }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.total).toBeLessThanOrEqual(50);
    });
  });

  describe('Par Figures', () => {
    it('returns par figures for all class levels', () => {
      const pars = getParFigures();

      expect(pars['maiden-claiming']).toBe(65);
      expect(pars['maiden']).toBe(72);
      expect(pars['claiming']).toBe(75);
      expect(pars['allowance']).toBe(82);
      expect(pars['stakes-graded-1']).toBe(105);
    });
  });

  describe('Class Hierarchy', () => {
    it('returns correct class hierarchy rankings', () => {
      const hierarchy = getClassHierarchy();

      expect(hierarchy['maiden-claiming']).toBeLessThan(hierarchy['maiden']);
      expect(hierarchy['maiden']).toBeLessThan(hierarchy['claiming']);
      expect(hierarchy['claiming']).toBeLessThan(hierarchy['allowance']);
      expect(hierarchy['allowance']).toBeLessThan(hierarchy['stakes']);
      expect(hierarchy['stakes']).toBeLessThan(hierarchy['stakes-graded-1']);
    });
  });

  describe('Edge Cases', () => {
    it('handles horse with only one past performance', () => {
      const header = createRaceHeader({ classification: 'claiming' });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            speedFigures: createSpeedFigures({ beyer: 78 }),
            finishPosition: 4,
          }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.total).toBeGreaterThan(0);
      expect(result.speedScore).toBeGreaterThan(0);
    });

    it('handles unknown classification gracefully', () => {
      const header = createRaceHeader({ classification: 'unknown' });
      const horse = createSpeedFigureHorse([80, 78, 75]);

      const result = calculateSpeedClassScore(horse, header);

      expect(result.parForClass).toBe(75); // Default for unknown
      expect(result.total).toBeGreaterThan(0);
    });

    it('uses TimeformUS if Beyer not available', () => {
      const header = createRaceHeader({ classification: 'allowance' });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            speedFigures: createSpeedFigures({ beyer: null, timeformUS: 90 }),
          }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.bestRecentFigure).toBe(90);
    });
  });
});
