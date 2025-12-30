/**
 * Trainer Patterns Scoring Tests
 * Tests for situational trainer pattern bonuses based on DRF Fields 1146-1221
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTrainerPatternScore,
  hasMatchedTrainerPatterns,
} from '../../../lib/scoring/trainerPatterns';
import {
  createHorseEntry,
  createPastPerformance,
  createEquipment,
  createMedication,
  createRaceHeader,
  createTrainerCategoryStats,
  createTrainerStat,
} from '../../fixtures/testHelpers';

describe('Trainer Patterns Scoring', () => {
  describe('First Time Lasix Pattern', () => {
    it('awards 4 points for first-time Lasix with 28% trainer', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        trainerCategoryStats: createTrainerCategoryStats({
          firstTimeLasix: createTrainerStat(28, 20),
        }),
        pastPerformances: [createPastPerformance({ medication: '' })],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      // v3.0: scaled down from 4 to 3 pts (Phase 3 speed rebalance)
      expect(result.total).toBe(3);
      expect(result.matchedPatterns.length).toBe(1);
      expect(result.matchedPatterns[0]?.pattern).toBe('firstTimeLasix');
      expect(result.matchedPatterns[0]?.points).toBe(3);
    });

    it('awards 2 points for first-time Lasix with 20% trainer (good tier)', () => {
      // v3.0: good tier gets half of max (3 * 0.5 = 1.5, rounded to 2)
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        trainerCategoryStats: createTrainerCategoryStats({
          firstTimeLasix: createTrainerStat(20, 15),
        }),
        pastPerformances: [createPastPerformance({ medication: '' })],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(2); // 3 * 0.5 = 1.5, rounded to 2
      expect(result.matchedPatterns.length).toBe(1);
      expect(result.matchedPatterns[0]?.points).toBe(2);
    });

    it('awards 0 points for first-time Lasix with trainer <18%', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        trainerCategoryStats: createTrainerCategoryStats({
          firstTimeLasix: createTrainerStat(15, 20),
        }),
        pastPerformances: [createPastPerformance({ medication: '' })],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(0);
      expect(result.matchedPatterns.length).toBe(0);
    });
  });

  describe('Second Off Layoff Pattern', () => {
    it('awards 3 points for 2nd off layoff with 26% trainer', () => {
      // v3.0: scaled down from 4 to 3 pts (Phase 3 speed rebalance)
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          secondOffLayoff: createTrainerStat(26, 25),
        }),
        pastPerformances: [
          createPastPerformance({
            daysSinceLast: 60, // Last race had 60+ day gap before it
          }),
          createPastPerformance({
            daysSinceLast: 21,
          }),
        ],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(3); // v3.0: scaled from 4 to 3
      expect(result.matchedPatterns.length).toBe(1);
      expect(result.matchedPatterns[0]?.pattern).toBe('secondOffLayoff');
      expect(result.matchedPatterns[0]?.points).toBe(3);
    });

    it('awards 2 points for 2nd off layoff with 20% trainer', () => {
      // v3.0: good tier gets half of max (3 * 0.5 = 1.5, rounded to 2)
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          secondOffLayoff: createTrainerStat(20, 15),
        }),
        pastPerformances: [
          createPastPerformance({
            daysSinceLast: 45, // 45+ day gap
          }),
          createPastPerformance({
            daysSinceLast: 14,
          }),
        ],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(2); // 3 * 0.5 = 1.5, rounded to 2
      expect(result.matchedPatterns[0]?.points).toBe(2);
    });
  });

  describe('Sprint to Route Pattern', () => {
    it('awards 2 points for sprint to route with 22% trainer', () => {
      // v3.0: scaled down from 3 to 2 pts (Phase 3 speed rebalance)
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          sprintToRoute: createTrainerStat(22, 30),
        }),
        pastPerformances: [
          createPastPerformance({
            distanceFurlongs: 6, // Last race was a sprint
          }),
        ],
      });
      const header = createRaceHeader({
        distanceFurlongs: 9, // Today is a route
      });

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(2); // v3.0: scaled from 3 to 2
      expect(result.matchedPatterns.length).toBe(1);
      expect(result.matchedPatterns[0]?.pattern).toBe('sprintToRoute');
      expect(result.matchedPatterns[0]?.points).toBe(2);
    });

    it('awards 1.5 points for sprint to route with 17% trainer', () => {
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          sprintToRoute: createTrainerStat(17, 20),
        }),
        pastPerformances: [
          createPastPerformance({
            distanceFurlongs: 5.5,
          }),
        ],
      });
      const header = createRaceHeader({
        distanceFurlongs: 8,
      });

      const result = calculateTrainerPatternScore(horse, header);

      // 1.5 rounds to 2 in our implementation
      expect(result.total).toBeGreaterThan(0);
      expect(result.matchedPatterns[0]?.pattern).toBe('sprintToRoute');
    });

    it('does not apply sprint to route when not stretching out', () => {
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          sprintToRoute: createTrainerStat(30, 20),
        }),
        pastPerformances: [
          createPastPerformance({
            distanceFurlongs: 6, // Last race was a sprint
          }),
        ],
      });
      const header = createRaceHeader({
        distanceFurlongs: 6, // Today is also a sprint
      });

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(0);
      expect(result.matchedPatterns.length).toBe(0);
    });
  });

  describe('First Start for Trainer Pattern', () => {
    it('awards 3 points for first start with 30% trainer', () => {
      // v3.0: scaled down from 4 to 3 pts (Phase 3 speed rebalance)
      const horse = createHorseEntry({
        lifetimeStarts: 0, // First time starter
        trainerCategoryStats: createTrainerCategoryStats({
          firstStartTrainer: createTrainerStat(30, 40),
        }),
        pastPerformances: [],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(3); // v3.0: scaled from 4 to 3
      expect(result.matchedPatterns.length).toBe(1);
      expect(result.matchedPatterns[0]?.pattern).toBe('firstStartTrainer');
    });

    it('awards 2 points for first start with 20% trainer', () => {
      // v3.0: good tier gets half of max (3 * 0.5 = 1.5, rounded to 2)
      const horse = createHorseEntry({
        lifetimeStarts: 0,
        trainerCategoryStats: createTrainerCategoryStats({
          firstStartTrainer: createTrainerStat(20, 30),
        }),
        pastPerformances: [],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(2); // 3 * 0.5 = 1.5, rounded to 2
    });
  });

  describe('After Claim Pattern', () => {
    it('awards 3 points for after claim with 28% trainer', () => {
      // v3.0: scaled down from 4 to 3 pts (Phase 3 speed rebalance)
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          afterClaim: createTrainerStat(28, 25),
        }),
        pastPerformances: [
          createPastPerformance({
            wasClaimed: true,
          }),
        ],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(3); // v3.0: scaled from 4 to 3
      expect(result.matchedPatterns[0]?.pattern).toBe('afterClaim');
    });
  });

  describe('Multiple Patterns Stacking', () => {
    it('stacks multiple patterns: first start + first Lasix = 6 pts', () => {
      // v3.0: 3 + 3 = 6 (scaled from 4 + 4 = 8)
      const horse = createHorseEntry({
        lifetimeStarts: 0,
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        trainerCategoryStats: createTrainerCategoryStats({
          firstTimeLasix: createTrainerStat(28, 20),
          firstStartTrainer: createTrainerStat(28, 30),
        }),
        pastPerformances: [],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(6); // v3.0: scaled from 8 to 6
      expect(result.matchedPatterns.length).toBe(2);
    });

    it('caps at 8 pts when multiple patterns exceed limit', () => {
      const horse = createHorseEntry({
        lifetimeStarts: 0,
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        equipment: createEquipment({
          blinkers: true,
          firstTimeEquipment: ['blinkers'],
        }),
        daysSinceLastRace: 90,
        trainerCategoryStats: createTrainerCategoryStats({
          firstTimeLasix: createTrainerStat(30, 25), // 2 pts (v3.2: scaled from 3)
          firstTimeBlinkers: createTrainerStat(28, 20), // 2 pts (v3.2: scaled from 2)
          firstStartTrainer: createTrainerStat(30, 40), // 2 pts (v3.2: scaled from 3)
          days61to90: createTrainerStat(28, 20), // 2 pts (v3.2: scaled from 2)
          wetTrack: createTrainerStat(30, 15), // 1 pt (v3.2: scaled from 1)
        }),
        pastPerformances: [],
      });
      const header = createRaceHeader({
        trackCondition: 'muddy',
      });

      const result = calculateTrainerPatternScore(horse, header);

      // Multiple patterns but capped at 8 (v3.2: reduced from 10)
      expect(result.total).toBe(8);
      expect(result.matchedPatterns.length).toBeGreaterThan(3);
    });
  });

  describe('Pattern Does Not Apply When Situation Does Not Match', () => {
    it('does not apply first-time Lasix when horse already on Lasix', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: false, // Not first time
          lasix: true,
          raw: 'L',
        }),
        trainerCategoryStats: createTrainerCategoryStats({
          firstTimeLasix: createTrainerStat(30, 20),
        }),
        pastPerformances: [createPastPerformance({ medication: 'L' })],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(0);
      expect(result.matchedPatterns.length).toBe(0);
    });

    it('does not apply wet track when track is fast', () => {
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          wetTrack: createTrainerStat(35, 20),
        }),
      });
      const header = createRaceHeader({
        trackCondition: 'fast', // Not wet
      });

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(0);
    });

    it('does not apply stakes pattern in allowance race', () => {
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          stakes: createTrainerStat(30, 15),
        }),
      });
      const header = createRaceHeader({
        classification: 'allowance', // Not stakes
      });

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(0);
    });
  });

  describe('Insufficient Data', () => {
    it('does not award points when sample size is too small', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        trainerCategoryStats: createTrainerCategoryStats({
          firstTimeLasix: { starts: 3, wins: 1, winPercent: 33, roi: 50 }, // Only 3 starts
        }),
        pastPerformances: [createPastPerformance({ medication: '' })],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(0);
    });
  });

  describe('Surface Patterns', () => {
    it('applies turf sprint bonus for turf sprint race', () => {
      // v3.0: scaled down from 2 to 1 pt (Phase 3 speed rebalance)
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          turfSprint: createTrainerStat(28, 25),
        }),
      });
      const header = createRaceHeader({
        surface: 'turf',
        distanceFurlongs: 5, // Sprint
      });

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(1); // v3.0: scaled from 2 to 1
      expect(result.matchedPatterns[0]?.pattern).toBe('turfSprint');
    });

    it('applies turf route bonus for turf route race', () => {
      // v3.0: scaled down from 2 to 1 pt (Phase 3 speed rebalance)
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          turfRoute: createTrainerStat(26, 20),
        }),
      });
      const header = createRaceHeader({
        surface: 'turf',
        distanceFurlongs: 9, // Route
      });

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(1); // v3.0: scaled from 2 to 1
      expect(result.matchedPatterns[0]?.pattern).toBe('turfRoute');
    });

    it('applies wet track bonus for sloppy track', () => {
      // v3.0: scaled down from 2 to 1 pt (Phase 3 speed rebalance)
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          wetTrack: createTrainerStat(30, 18),
        }),
      });
      const header = createRaceHeader({
        trackCondition: 'sloppy',
      });

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(1); // v3.0: scaled from 2 to 1
      expect(result.matchedPatterns[0]?.pattern).toBe('wetTrack');
    });
  });

  describe('Class Patterns', () => {
    it('applies maiden claiming bonus', () => {
      // v3.0: scaled down from 2 to 1 pt (Phase 3 speed rebalance)
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          maidenClaiming: createTrainerStat(28, 30),
        }),
      });
      const header = createRaceHeader({
        classification: 'maiden-claiming',
      });

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(1); // v3.0: scaled from 2 to 1
      expect(result.matchedPatterns[0]?.pattern).toBe('maidenClaiming');
    });

    it('applies stakes bonus for graded stakes', () => {
      // v3.0: scaled down from 2 to 1 pt (Phase 3 speed rebalance)
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          stakes: createTrainerStat(25, 15),
        }),
      });
      const header = createRaceHeader({
        classification: 'stakes-graded-1',
      });

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(1); // v3.0: scaled from 2 to 1
      expect(result.matchedPatterns[0]?.pattern).toBe('stakes');
    });
  });

  describe('Layoff Duration Patterns', () => {
    it('applies 31-60 day layoff pattern', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 45,
        trainerCategoryStats: createTrainerCategoryStats({
          days31to60: createTrainerStat(26, 18),
        }),
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(2); // v3.0: scaled down from 3 to 2
      expect(result.matchedPatterns[0]?.pattern).toBe('days31to60');
    });

    it('applies 181+ day layoff pattern', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 200,
        trainerCategoryStats: createTrainerCategoryStats({
          days181plus: createTrainerStat(25, 12),
        }),
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(2); // v3.0: scaled down from 3 to 2
      expect(result.matchedPatterns[0]?.pattern).toBe('days181plus');
    });
  });

  describe('hasMatchedTrainerPatterns helper', () => {
    it('returns true when patterns match', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        trainerCategoryStats: createTrainerCategoryStats({
          firstTimeLasix: createTrainerStat(28, 20),
        }),
        pastPerformances: [createPastPerformance({ medication: '' })],
      });
      const header = createRaceHeader();

      expect(hasMatchedTrainerPatterns(horse, header)).toBe(true);
    });

    it('returns false when no patterns match', () => {
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats(),
      });
      const header = createRaceHeader();

      expect(hasMatchedTrainerPatterns(horse, header)).toBe(false);
    });
  });

  describe('First Time Blinkers Pattern', () => {
    it('awards 2 points for first-time blinkers with 26% trainer', () => {
      // v3.0: scaled down from 3 to 2 pts (Phase 3 speed rebalance)
      const horse = createHorseEntry({
        equipment: createEquipment({
          blinkers: true,
          firstTimeEquipment: ['blinkers'],
          raw: 'B',
        }),
        trainerCategoryStats: createTrainerCategoryStats({
          firstTimeBlinkers: createTrainerStat(26, 20),
        }),
        pastPerformances: [createPastPerformance({ equipment: '' })],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(2); // v3.0: scaled from 3 to 2
      expect(result.matchedPatterns[0]?.pattern).toBe('firstTimeBlinkers');
    });
  });

  describe('Blinkers Off Pattern', () => {
    it('awards 1 point for blinkers off with 28% trainer', () => {
      // v3.0: scaled down from 2 to 1 pt (Phase 3 speed rebalance)
      const horse = createHorseEntry({
        equipment: createEquipment({
          blinkers: false,
          blinkersOff: true,
          raw: 'BO',
        }),
        trainerCategoryStats: createTrainerCategoryStats({
          blinkersOff: createTrainerStat(28, 15),
        }),
        pastPerformances: [createPastPerformance({ equipment: 'B' })],
      });
      const header = createRaceHeader();

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(1); // v3.0: scaled from 2 to 1
      expect(result.matchedPatterns[0]?.pattern).toBe('blinkersOff');
    });
  });

  describe('Route to Sprint Pattern', () => {
    it('awards 2 points for route to sprint with 24% trainer', () => {
      // v3.0: scaled down from 3 to 2 pts (Phase 3 speed rebalance)
      const horse = createHorseEntry({
        trainerCategoryStats: createTrainerCategoryStats({
          routeToSprint: createTrainerStat(24, 22),
        }),
        pastPerformances: [
          createPastPerformance({
            distanceFurlongs: 9, // Last race was a route
          }),
        ],
      });
      const header = createRaceHeader({
        distanceFurlongs: 6, // Today is a sprint
      });

      const result = calculateTrainerPatternScore(horse, header);

      expect(result.total).toBe(2); // v3.0: scaled from 3 to 2
      expect(result.matchedPatterns[0]?.pattern).toBe('routeToSprint');
    });
  });
});
