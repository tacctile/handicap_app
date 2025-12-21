/**
 * Connections Scoring Tests
 * Tests trainer, jockey, and partnership scoring logic
 */

import { describe, it, expect } from 'vitest';
import {
  calculateConnectionsScore,
  buildConnectionsDatabase,
} from '../../../lib/scoring/connections';
import { createHorseEntry, createPastPerformance } from '../../fixtures/testHelpers';

describe('Connections Scoring', () => {
  describe('Trainer Scoring', () => {
    it('returns neutral score (15) for trainer with insufficient data (<3 starts)', () => {
      const horse = createHorseEntry({
        trainerName: 'New Trainer',
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
        ],
      });

      const result = calculateConnectionsScore(horse);

      expect(result.trainer).toBe(15);
      expect(result.reasoning).toContain('Limited data');
    });

    it('returns 5 points for trainer with <5% win rate', () => {
      // Create horse with 0 wins in 10 starts
      const horse = createHorseEntry({
        trainerName: 'Low Win Trainer',
        pastPerformances: Array.from(
          { length: 10 },
          (_, i) => createPastPerformance({ finishPosition: i + 2 }) // All 2nd or worse
        ),
      });

      const result = calculateConnectionsScore(horse);

      expect(result.trainer).toBe(5);
    });

    it('returns 12 points for trainer with 5-9% win rate', () => {
      // 1 win in 15 starts = ~6.7% win rate
      const pastPerformances = Array.from({ length: 15 }, (_, i) =>
        createPastPerformance({ finishPosition: i === 0 ? 1 : 5 })
      );

      const horse = createHorseEntry({
        trainerName: 'Average Trainer',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      expect(result.trainer).toBe(12);
    });

    it('returns 20 points for trainer with 10-14% win rate', () => {
      // 2 wins in 15 starts = ~13.3% win rate
      const pastPerformances = Array.from({ length: 15 }, (_, i) =>
        createPastPerformance({ finishPosition: i < 2 ? 1 : 5 })
      );

      const horse = createHorseEntry({
        trainerName: 'Good Trainer',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      expect(result.trainer).toBe(20);
    });

    it('returns 28 points for trainer with 15-19% win rate', () => {
      // 3 wins in 18 starts = ~16.7% win rate
      const pastPerformances = Array.from({ length: 18 }, (_, i) =>
        createPastPerformance({ finishPosition: i < 3 ? 1 : 5 })
      );

      const horse = createHorseEntry({
        trainerName: 'Very Good Trainer',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      expect(result.trainer).toBe(28);
    });

    it('returns 35 points (max) for trainer with 20%+ win rate', () => {
      // 5 wins in 20 starts = 25% win rate
      const pastPerformances = Array.from({ length: 20 }, (_, i) =>
        createPastPerformance({ finishPosition: i < 5 ? 1 : 5 })
      );

      const horse = createHorseEntry({
        trainerName: 'Elite Trainer',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      expect(result.trainer).toBe(35);
    });

    it('handles null/undefined trainer name gracefully', () => {
      const horse = createHorseEntry({
        trainerName: '',
        pastPerformances: [],
      });

      const result = calculateConnectionsScore(horse);

      expect(result.trainer).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Jockey Scoring', () => {
    it('returns neutral score (7) for jockey with insufficient data', () => {
      const horse = createHorseEntry({
        jockeyName: 'New Jockey',
        pastPerformances: [createPastPerformance({ jockey: 'New Jockey', finishPosition: 1 })],
      });

      const result = calculateConnectionsScore(horse);

      expect(result.jockey).toBe(7);
    });

    it('returns 15 points (max) for elite jockey with 20%+ win rate', () => {
      const pastPerformances = Array.from({ length: 10 }, (_, i) =>
        createPastPerformance({
          jockey: 'Elite Jockey',
          finishPosition: i < 3 ? 1 : 5, // 30% win rate
        })
      );

      const horse = createHorseEntry({
        jockeyName: 'Elite Jockey',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      expect(result.jockey).toBe(15);
    });

    it('returns 3 points for jockey with <5% win rate', () => {
      const pastPerformances = Array.from({ length: 10 }, (_, i) =>
        createPastPerformance({
          jockey: 'Poor Jockey',
          finishPosition: i + 4, // No wins
        })
      );

      const horse = createHorseEntry({
        jockeyName: 'Poor Jockey',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      expect(result.jockey).toBe(3);
    });
  });

  describe('Partnership Bonus', () => {
    it('returns 5 point bonus for elite partnership (25%+ win rate with 5+ starts)', () => {
      const trainerName = 'Bob Baffert';
      const jockeyName = 'Mike Smith';

      // Create multiple horses to build database with partnership data
      const horses = [
        createHorseEntry({
          trainerName,
          jockeyName,
          pastPerformances: Array.from({ length: 5 }, (_, i) =>
            createPastPerformance({
              jockey: jockeyName,
              finishPosition: i < 2 ? 1 : 3, // 40% win rate
            })
          ),
        }),
      ];

      const database = buildConnectionsDatabase(horses);
      const result = calculateConnectionsScore(horses[0], database);

      expect(result.partnershipBonus).toBe(5);
      expect(result.reasoning).toContain('Elite combo');
    });

    it('returns 0 bonus for partnership with <25% win rate', () => {
      const trainerName = 'Average Trainer';
      const jockeyName = 'Average Jockey';

      const horses = [
        createHorseEntry({
          trainerName,
          jockeyName,
          pastPerformances: Array.from({ length: 10 }, (_, i) =>
            createPastPerformance({
              jockey: jockeyName,
              finishPosition: i < 2 ? 1 : 5, // 20% win rate
            })
          ),
        }),
      ];

      const database = buildConnectionsDatabase(horses);
      const result = calculateConnectionsScore(horses[0], database);

      expect(result.partnershipBonus).toBe(0);
    });

    it('returns 0 bonus for partnership with insufficient starts (<5)', () => {
      const trainerName = 'New Trainer';
      const jockeyName = 'New Jockey';

      const horses = [
        createHorseEntry({
          trainerName,
          jockeyName,
          pastPerformances: Array.from({ length: 3 }, () =>
            createPastPerformance({
              jockey: jockeyName,
              finishPosition: 1, // 100% win rate but only 3 starts
            })
          ),
        }),
      ];

      const database = buildConnectionsDatabase(horses);
      const result = calculateConnectionsScore(horses[0], database);

      expect(result.partnershipBonus).toBe(0);
    });
  });

  describe('Combined Scoring', () => {
    it('total score is sum of trainer + jockey + partnership bonus', () => {
      const horse = createHorseEntry({
        trainerName: 'Test Trainer',
        jockeyName: 'Test Jockey',
        pastPerformances: Array.from({ length: 5 }, (_, i) =>
          createPastPerformance({
            jockey: 'Test Jockey',
            finishPosition: i < 2 ? 1 : 3,
          })
        ),
      });

      const result = calculateConnectionsScore(horse);

      expect(result.total).toBe(result.trainer + result.jockey + result.partnershipBonus);
    });

    it('total score stays within limit of 55 points', () => {
      const horse = createHorseEntry({
        trainerName: 'Elite Trainer',
        jockeyName: 'Elite Jockey',
        pastPerformances: Array.from({ length: 20 }, (_, i) =>
          createPastPerformance({
            jockey: 'Elite Jockey',
            finishPosition: i < 8 ? 1 : 3, // 40% win rate
          })
        ),
      });

      const result = calculateConnectionsScore(horse);

      expect(result.total).toBeLessThanOrEqual(55);
    });

    it('handles missing past performances gracefully', () => {
      const horse = createHorseEntry({
        trainerName: 'Test Trainer',
        jockeyName: 'Test Jockey',
        pastPerformances: [],
      });

      const result = calculateConnectionsScore(horse);

      expect(result.total).toBeGreaterThan(0); // Returns neutral scores
      expect(result.trainer).toBe(15); // Neutral trainer
      expect(result.jockey).toBe(7); // Neutral jockey
    });
  });

  describe('Connections Database', () => {
    it('builds database from multiple horses', () => {
      const horses = [
        createHorseEntry({
          trainerName: 'Trainer A',
          jockeyName: 'Jockey A',
          pastPerformances: [createPastPerformance({ jockey: 'Jockey A', finishPosition: 1 })],
        }),
        createHorseEntry({
          trainerName: 'Trainer B',
          jockeyName: 'Jockey B',
          pastPerformances: [createPastPerformance({ jockey: 'Jockey B', finishPosition: 2 })],
        }),
      ];

      const database = buildConnectionsDatabase(horses);

      expect(database.trainers.size).toBe(2);
      expect(database.jockeys.size).toBeGreaterThanOrEqual(2);
    });

    it('normalizes trainer names (case-insensitive)', () => {
      const horses = [
        createHorseEntry({
          trainerName: 'BOB BAFFERT',
          pastPerformances: [createPastPerformance({ finishPosition: 1 })],
        }),
        createHorseEntry({
          trainerName: 'bob baffert',
          pastPerformances: [createPastPerformance({ finishPosition: 1 })],
        }),
      ];

      const database = buildConnectionsDatabase(horses);

      // Both should map to same trainer
      expect(database.trainers.size).toBe(1);
    });
  });
});
