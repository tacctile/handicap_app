/**
 * Connections Scoring Tests
 * Tests trainer, jockey, and partnership scoring logic
 *
 * FIX: v2.1 - Now uses actual DRF trainer/jockey stats (Fields 29-32, 35-38)
 * instead of building stats from the horse's own past performances.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateConnectionsScore,
  buildConnectionsDatabase,
} from '../../../lib/scoring/connections';
import { createHorseEntry, createPastPerformance } from '../../fixtures/testHelpers';

// NOTE: v2.0 rescaled from 55 max to 25 max (scale factor: 25/55 ≈ 0.455)
// NOTE: v2.1 uses DRF stats (trainerMeetStarts, etc.) as primary source
// NOTE: v2.2 enhanced partnership scoring (0-4 pts based on tiers)
describe('Connections Scoring', () => {
  describe('Trainer Scoring', () => {
    it('returns penalized baseline (4) for trainer with insufficient data (<3 starts)', () => {
      const horse = createHorseEntry({
        trainerName: 'New Trainer',
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
        ],
      });

      const result = calculateConnectionsScore(horse);

      // Phase 2: Penalized baseline is 4 for trainers with insufficient data
      expect(result.trainer).toBe(4);
      expect(result.reasoning).toContain('Limited data');
    });

    it('returns 7 points (minimum baseline) for trainer with <5% win rate (v3.2)', () => {
      // Create horse with 0 wins in 10 starts
      const horse = createHorseEntry({
        trainerName: 'Low Win Trainer',
        pastPerformances: Array.from(
          { length: 10 },
          (_, i) => createPastPerformance({ finishPosition: i + 2 }) // All 2nd or worse
        ),
      });

      const result = calculateConnectionsScore(horse);

      // v3.2: Minimum baseline is 7 for any trainer (scaled from 8)
      expect(result.trainer).toBe(7);
    });

    it('returns 7 points (minimum baseline) for trainer with 5-9% win rate (v3.2)', () => {
      // 1 win in 15 starts = ~6.7% win rate
      const pastPerformances = Array.from({ length: 15 }, (_, i) =>
        createPastPerformance({ finishPosition: i === 0 ? 1 : 5 })
      );

      const horse = createHorseEntry({
        trainerName: 'Average Trainer',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      // v3.2: All trainers get minimum baseline of 7 (scaled from 8)
      expect(result.trainer).toBe(7);
    });

    it('returns 8 points for trainer with 10-14% win rate (v3.2)', () => {
      // 2 wins in 15 starts = ~13.3% win rate
      const pastPerformances = Array.from({ length: 15 }, (_, i) =>
        createPastPerformance({ finishPosition: i < 2 ? 1 : 5 })
      );

      const horse = createHorseEntry({
        trainerName: 'Good Trainer',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      // v3.2: scaled from 9 to 8
      expect(result.trainer).toBe(8);
    });

    it('returns 11 points (shipper cap) for trainer with 15-19% win rate from PP stats (v3.2)', () => {
      // 3 wins in 18 starts = ~16.7% win rate
      // v3.2: PP-based stats (shipper) capped at 11 points (scaled from 12)
      const pastPerformances = Array.from({ length: 18 }, (_, i) =>
        createPastPerformance({ finishPosition: i < 3 ? 1 : 5 })
      );

      const horse = createHorseEntry({
        trainerName: 'Very Good Trainer',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      // v3.2: Shipper stats capped at 11 (scaled from 12)
      expect(result.trainer).toBe(11);
    });

    it('returns 11 points (shipper cap) for trainer with 20%+ win rate from PP stats (v3.2)', () => {
      // 5 wins in 20 starts = 25% win rate
      // v3.2: PP-based stats (shipper) capped at 11 points (scaled from 12)
      const pastPerformances = Array.from({ length: 20 }, (_, i) =>
        createPastPerformance({ finishPosition: i < 5 ? 1 : 5 })
      );

      const horse = createHorseEntry({
        trainerName: 'Elite Trainer',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      // v3.2: Shipper stats capped at 11 (scaled from 12)
      expect(result.trainer).toBe(11);
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
    it('returns penalized baseline (2) for jockey with insufficient data', () => {
      const horse = createHorseEntry({
        jockeyName: 'New Jockey',
        pastPerformances: [createPastPerformance({ jockey: 'New Jockey', finishPosition: 1 })],
      });

      const result = calculateConnectionsScore(horse);

      // Phase 2: Penalized baseline is 2 for jockeys with insufficient data
      expect(result.jockey).toBe(2);
    });

    it('returns 5 points (shipper cap) for elite jockey with 20%+ win rate from PP stats', () => {
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

      // Phase 2: Shipper stats capped at 5 (was 7)
      expect(result.jockey).toBe(5);
    });

    it('returns 4 points (minimum baseline) for jockey with <5% win rate (v2.5)', () => {
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

      // v2.5: Minimum baseline is 4 for any jockey
      expect(result.jockey).toBe(4);
    });
  });

  describe('Partnership Bonus (v3.2 capped)', () => {
    // v3.2: Partnership scoring tiers capped at 2 pts max:
    // - Elite: 30%+ win rate, 8+ starts = 2 pts (was 4)
    // - Strong: 25-29% win rate, 5+ starts = 2 pts (was 3)
    // - Good: 20-24% win rate, 5+ starts = 1 pt (was 2)
    // - Regular: 15-19% win rate, 5+ starts = 1 pt
    // - New/weak: 0 pts

    it('returns 2 point bonus for elite partnership (30%+ win rate with 8+ starts)', () => {
      const trainerName = 'Bob Baffert';
      const jockeyName = 'Mike Smith';

      // 4 wins in 10 starts = 40% win rate (elite tier, 8+ starts)
      const horses = [
        createHorseEntry({
          trainerName,
          jockeyName,
          pastPerformances: Array.from({ length: 10 }, (_, i) =>
            createPastPerformance({
              jockey: jockeyName,
              finishPosition: i < 4 ? 1 : 3, // 40% win rate
            })
          ),
        }),
      ];

      const database = buildConnectionsDatabase(horses);
      const result = calculateConnectionsScore(horses[0], database);

      expect(result.partnershipBonus).toBe(2);
      expect(result.reasoning).toContain('Elite combo');
    });

    it('returns 2 point bonus for strong partnership (25-29% win rate with 5+ starts)', () => {
      const trainerName = 'Chad Brown';
      const jockeyName = 'Irad Ortiz Jr';

      // 2 wins in 8 starts = 25% win rate (strong tier)
      const horses = [
        createHorseEntry({
          trainerName,
          jockeyName,
          pastPerformances: Array.from({ length: 8 }, (_, i) =>
            createPastPerformance({
              jockey: jockeyName,
              finishPosition: i < 2 ? 1 : 4, // 25% win rate
            })
          ),
        }),
      ];

      const database = buildConnectionsDatabase(horses);
      const result = calculateConnectionsScore(horses[0], database);

      expect(result.partnershipBonus).toBe(2);
      expect(result.reasoning).toContain('Strong combo');
    });

    it('returns 1 point bonus for good partnership (20-24% win rate with 5+ starts)', () => {
      const trainerName = 'Average Trainer';
      const jockeyName = 'Average Jockey';

      // 2 wins in 10 starts = 20% win rate (good tier)
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

      expect(result.partnershipBonus).toBe(1);
      expect(result.reasoning).toContain('Good combo');
    });

    it('returns 1 point bonus for regular partnership (15-19% win rate with 5+ starts)', () => {
      const trainerName = 'Decent Trainer';
      const jockeyName = 'Decent Jockey';

      // 1 win in 6 starts = ~16.7% win rate (regular tier)
      const horses = [
        createHorseEntry({
          trainerName,
          jockeyName,
          pastPerformances: Array.from({ length: 6 }, (_, i) =>
            createPastPerformance({
              jockey: jockeyName,
              finishPosition: i === 0 ? 1 : 5, // ~16.7% win rate
            })
          ),
        }),
      ];

      const database = buildConnectionsDatabase(horses);
      const result = calculateConnectionsScore(horses[0], database);

      expect(result.partnershipBonus).toBe(1);
      expect(result.reasoning).toContain('Regular combo');
    });

    it('returns 0 bonus for weak partnership (<15% win rate)', () => {
      const trainerName = 'Poor Trainer';
      const jockeyName = 'Poor Jockey';

      // 1 win in 8 starts = 12.5% win rate (below threshold)
      const horses = [
        createHorseEntry({
          trainerName,
          jockeyName,
          pastPerformances: Array.from({ length: 8 }, (_, i) =>
            createPastPerformance({
              jockey: jockeyName,
              finishPosition: i === 0 ? 1 : 5, // 12.5% win rate
            })
          ),
        }),
      ];

      const database = buildConnectionsDatabase(horses);
      const result = calculateConnectionsScore(horses[0], database);

      expect(result.partnershipBonus).toBe(0);
      expect(result.reasoning).toContain('Limited combo');
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

    it('detects first time with jockey', () => {
      const trainerName = 'Test Trainer';
      const jockeyName = 'New Jockey';

      // Past performances have different jockey
      const horses = [
        createHorseEntry({
          trainerName,
          jockeyName, // Current jockey is different
          pastPerformances: Array.from({ length: 5 }, () =>
            createPastPerformance({
              jockey: 'Different Jockey',
              finishPosition: 1,
            })
          ),
        }),
      ];

      const database = buildConnectionsDatabase(horses);
      const result = calculateConnectionsScore(horses[0], database);

      expect(result.partnershipBonus).toBe(0);
      expect(result.reasoning).toContain('First time with this jockey');
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

    it('total score stays within limit of 23 points (v3.2 capped partnership)', () => {
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

      // v3.2 Max: 14 (trainer) + 7 (jockey) + 2 (elite partnership) = 23
      expect(result.total).toBeLessThanOrEqual(23);
    });

    it('handles missing past performances gracefully', () => {
      const horse = createHorseEntry({
        trainerName: 'Test Trainer',
        jockeyName: 'Test Jockey',
        pastPerformances: [],
      });

      const result = calculateConnectionsScore(horse);

      expect(result.total).toBeGreaterThan(0); // Returns baseline scores
      // Phase 2: Penalized baselines are 4 for trainer, 2 for jockey (no career data)
      expect(result.trainer).toBe(4);
      expect(result.jockey).toBe(2);
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

  // ============================================================================
  // DRF STATS INTEGRATION TESTS (v2.1)
  // These tests verify the fix: using actual DRF trainer/jockey statistics
  // instead of building stats from the horse's own past performances.
  // ============================================================================
  describe('DRF Stats Integration', () => {
    it('uses DRF trainer stats instead of PP-based stats', () => {
      // Horse with poor PP record (0 wins in 5 starts)
      // but elite DRF trainer stats (22% win rate at meet)
      const horse = createHorseEntry({
        trainerName: 'Elite Trainer',
        // DRF stats: 22% win rate (11 wins / 50 starts)
        trainerMeetStarts: 50,
        trainerMeetWins: 11,
        trainerMeetPlaces: 10,
        trainerMeetShows: 8,
        // Poor PP record for the horse itself
        pastPerformances: Array.from(
          { length: 5 },
          () => createPastPerformance({ finishPosition: 5 }) // No wins
        ),
      });

      const result = calculateConnectionsScore(horse);

      // v3.2: Should score 14 points (20%+ win rate) based on DRF stats - trainer max reduced from 16 to 14
      // NOT 2 points (0% win rate) based on PP record
      expect(result.trainer).toBe(14);
      expect(result.trainerStats?.source).toBe('drf');
      expect(result.trainerStats?.winRate).toBeCloseTo(22, 0);
    });

    it('uses DRF jockey stats instead of PP-based stats', () => {
      // Horse with poor PP record with this jockey
      // but elite DRF jockey stats (25% win rate at meet)
      const horse = createHorseEntry({
        jockeyName: 'Elite Jockey',
        // DRF stats: 25% win rate (25 wins / 100 starts)
        jockeyMeetStarts: 100,
        jockeyMeetWins: 25,
        jockeyMeetPlaces: 20,
        jockeyMeetShows: 15,
        // Poor PP record
        pastPerformances: Array.from(
          { length: 5 },
          () => createPastPerformance({ jockey: 'Elite Jockey', finishPosition: 6 }) // No wins
        ),
      });

      const result = calculateConnectionsScore(horse);

      // Should score 7 points (20%+ win rate) based on DRF stats
      // NOT 1 point (0% win rate) based on PP record
      expect(result.jockey).toBe(7);
      expect(result.jockeyStats?.source).toBe('drf');
      expect(result.jockeyStats?.winRate).toBe(25);
    });

    it('falls back to PP-based calculation when DRF stats are missing', () => {
      // Horse with no DRF stats (0 starts) but good PP record
      const horse = createHorseEntry({
        trainerName: 'PP Only Trainer',
        trainerMeetStarts: 0, // No DRF stats
        trainerMeetWins: 0,
        trainerMeetPlaces: 0,
        trainerMeetShows: 0,
        // Good PP record (3 wins in 10 starts = 30%)
        pastPerformances: Array.from({ length: 10 }, (_, i) =>
          createPastPerformance({ finishPosition: i < 3 ? 1 : 5 })
        ),
      });

      const result = calculateConnectionsScore(horse);

      // v3.2: Should use PP-based stats (shipper) - capped at 11 pts (scaled from 12)
      expect(result.trainer).toBe(11);
      expect(result.trainerStats?.source).toBe('pp');
    });

    it('poor PP record with elite trainer DRF stats scores high', () => {
      // CRITICAL TEST: This is the exact bug case from the audit
      // A horse with only 2 PP wins should still score high if trainer has 22% meet win rate
      const horse = createHorseEntry({
        trainerName: 'Todd Pletcher',
        // Elite trainer stats: 22% win rate
        trainerMeetStarts: 100,
        trainerMeetWins: 22,
        trainerMeetPlaces: 18,
        trainerMeetShows: 15,
        jockeyName: 'John Velazquez',
        // Elite jockey stats: 20% win rate
        jockeyMeetStarts: 150,
        jockeyMeetWins: 30,
        jockeyMeetPlaces: 25,
        jockeyMeetShows: 20,
        // Horse's own PP record: poor (2 wins in 10 starts)
        pastPerformances: Array.from({ length: 10 }, (_, i) =>
          createPastPerformance({
            jockey: 'John Velazquez',
            finishPosition: i < 2 ? 1 : 4 + i, // 2 wins, rest worse
          })
        ),
      });

      const result = calculateConnectionsScore(horse);

      // v3.2: Should score based on DRF stats - trainer max reduced from 16 to 14
      expect(result.trainer).toBe(14); // 22% = 20%+ tier = 14 pts (v3.2 cap)
      expect(result.jockey).toBe(7); // 20% = 20%+ tier = 7 pts
      expect(result.trainerStats?.source).toBe('drf');
      expect(result.jockeyStats?.source).toBe('drf');

      // Total should be at least 21 (14 + 7) without partnership bonus
      expect(result.total).toBeGreaterThanOrEqual(21);
    });

    it('marks stats source correctly in reasoning', () => {
      const horseWithDRF = createHorseEntry({
        trainerMeetStarts: 50,
        trainerMeetWins: 10,
        trainerMeetPlaces: 8,
        trainerMeetShows: 7,
        jockeyMeetStarts: 0, // No jockey DRF stats
        pastPerformances: [createPastPerformance({ finishPosition: 1 })],
      });

      const result = calculateConnectionsScore(horseWithDRF);

      // Trainer should NOT have [PP] tag (using DRF)
      expect(result.reasoning).toContain('T: 20%');
      expect(result.reasoning).not.toMatch(/T:.*\[PP\]/);

      // Jockey should have [PP] tag (fallback)
      // Note: With only 1 PP, it shows as "Limited data"
    });

    it('handles edge case of 0 trainer wins with positive starts (v3.2)', () => {
      const horse = createHorseEntry({
        trainerName: 'Winless Trainer',
        trainerMeetStarts: 20,
        trainerMeetWins: 0,
        trainerMeetPlaces: 3,
        trainerMeetShows: 5,
        pastPerformances: [],
      });

      const result = calculateConnectionsScore(horse);

      // v3.2: All trainers get minimum baseline of 7 (scaled down from 8)
      expect(result.trainer).toBe(7);
      expect(result.trainerStats?.winRate).toBe(0);
      expect(result.trainerStats?.source).toBe('drf');
    });
  });
});
