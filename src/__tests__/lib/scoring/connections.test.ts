/**
 * Connections Scoring Tests (Rebalanced)
 * Tests trainer, jockey, and partnership scoring logic
 *
 * FIX: v2.1 - Now uses actual DRF trainer/jockey stats (Fields 29-32, 35-38)
 * instead of building stats from the horse's own past performances.
 *
 * Rebalanced Connections Updates:
 * - Jockey max score: 5 → 12 (academic studies show 8-12% outcome variance)
 * - Trainer max score: 16 → 10
 * - Partnership max: 2 (unchanged)
 * - Total connections max: 23 → 24 pts (Jockey 12 + Trainer 10 + Partnership 2)
 *
 * Jockey Tiers (0-12 pts):
 * - ≥25% with 20+ starts: 12 pts
 * - ≥22% with 15+ starts: 10 pts
 * - ≥20% with 10+ starts: 8 pts
 * - ≥17% with 10+ starts: 6 pts
 * - ≥15% with 5+ starts: 5 pts
 * - ≥12% with 5+ starts: 4 pts
 * - ≥10%: 3 pts
 * - <10%: 1 pt
 *
 * Trainer Tiers (0-10 pts):
 * - ≥25% with 20+ starts: 10 pts
 * - ≥22% with 15+ starts: 8 pts
 * - ≥20% with 10+ starts: 7 pts
 * - ≥17% with 10+ starts: 5 pts
 * - ≥15% with 5+ starts: 4 pts
 * - ≥12% with 5+ starts: 3 pts
 * - ≥10%: 2 pts
 * - <10%: 1 pt
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
// NOTE: Rebalanced to 24 max (Jockey 12 + Trainer 10 + Partnership 2)
describe('Connections Scoring', () => {
  describe('Trainer Scoring', () => {
    it('returns penalized baseline (1) for trainer with insufficient data (<3 starts)', () => {
      const horse = createHorseEntry({
        trainerName: 'New Trainer',
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
        ],
      });

      const result = calculateConnectionsScore(horse);

      // Rebalanced: Penalized baseline is 1 for trainers with insufficient data
      expect(result.trainer).toBe(1);
      expect(result.reasoning).toContain('Limited data');
    });

    it('returns 1 point for trainer with <10% win rate', () => {
      // Create horse with 0 wins in 10 starts
      const horse = createHorseEntry({
        trainerName: 'Low Win Trainer',
        pastPerformances: Array.from(
          { length: 10 },
          (_, i) => createPastPerformance({ finishPosition: i + 2 }) // All 2nd or worse
        ),
      });

      const result = calculateConnectionsScore(horse);

      // Rebalanced: <10% win rate = 1 pt
      expect(result.trainer).toBe(1);
    });

    it('returns 1 point for trainer with 5-9% win rate', () => {
      // 1 win in 15 starts = ~6.7% win rate
      const pastPerformances = Array.from({ length: 15 }, (_, i) =>
        createPastPerformance({ finishPosition: i === 0 ? 1 : 5 })
      );

      const horse = createHorseEntry({
        trainerName: 'Average Trainer',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      // Rebalanced: <10% win rate = 1 pt
      expect(result.trainer).toBe(1);
    });

    it('returns 3 points for trainer with 12-14% win rate with 5+ starts', () => {
      // 2 wins in 15 starts = ~13.3% win rate
      const pastPerformances = Array.from({ length: 15 }, (_, i) =>
        createPastPerformance({ finishPosition: i < 2 ? 1 : 5 })
      );

      const horse = createHorseEntry({
        trainerName: 'Good Trainer',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      // Rebalanced: 12%+ with 5+ starts = 3 pts (shipper cap at 7)
      expect(result.trainer).toBe(3);
    });

    it('returns 4 points (shipper cap) for trainer with 15-19% win rate from PP stats', () => {
      // 3 wins in 18 starts = ~16.7% win rate
      // Rebalanced: PP-based stats (shipper) capped at 7 points
      // But 16.7% with only 18 starts = 4 pts (15%+ with 5+ starts tier)
      const pastPerformances = Array.from({ length: 18 }, (_, i) =>
        createPastPerformance({ finishPosition: i < 3 ? 1 : 5 })
      );

      const horse = createHorseEntry({
        trainerName: 'Very Good Trainer',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      // Rebalanced: 15%+ with 5+ starts = 4 pts
      expect(result.trainer).toBe(4);
    });

    it('returns 7 points (shipper cap) for trainer with 20%+ win rate from PP stats', () => {
      // 5 wins in 20 starts = 25% win rate
      // Rebalanced: PP-based stats (shipper) capped at 7 points
      const pastPerformances = Array.from({ length: 20 }, (_, i) =>
        createPastPerformance({ finishPosition: i < 5 ? 1 : 5 })
      );

      const horse = createHorseEntry({
        trainerName: 'Elite Trainer',
        pastPerformances,
      });

      const result = calculateConnectionsScore(horse);

      // Rebalanced: 25% with 20+ starts = 10 pts, but shipper cap at 7
      expect(result.trainer).toBe(7);
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
    it('returns penalized baseline (1) for jockey with insufficient data (Model B)', () => {
      const horse = createHorseEntry({
        jockeyName: 'New Jockey',
        pastPerformances: [createPastPerformance({ jockey: 'New Jockey', finishPosition: 1 })],
      });

      const result = calculateConnectionsScore(horse);

      // Model B: Penalized baseline is 1 for jockeys with insufficient data (MIN_JOCKEY_SCORE_NO_CAREER)
      expect(result.jockey).toBe(1);
    });

    it('returns 8 points (shipper cap) for elite jockey with 20%+ win rate from PP stats', () => {
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

      // Rebalanced: Shipper stats capped at 8 (MAX_JOCKEY_SCORE_SHIPPER)
      // 30% with 10 starts = 8 pts (20%+ with 10+ starts tier), capped at 8
      expect(result.jockey).toBe(8);
    });

    it('returns 1 point for jockey with <10% win rate', () => {
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

      // Rebalanced: <10% win rate = 1 pt
      expect(result.jockey).toBe(1);
    });
  });

  describe('Partnership Bonus (Model B)', () => {
    // Model B partnership scoring tiers:
    // - Elite: 30%+ win rate, 8+ starts = 2 pts (was 4)
    // - Strong: 25-29% win rate, 5+ starts = 1 pt (was 3)
    // - Good: 20-24% win rate, 5+ starts = 0 pts (was 2)
    // - Regular: 15-19% win rate, 5+ starts = 0 pts (was 1)
    // - New/weak: 0 pts

    it('returns 2 point bonus for elite partnership (30%+ win rate with 8+ starts) (Model B)', () => {
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

    it('returns 1 point bonus for strong partnership (25-29% win rate with 5+ starts) (Model B)', () => {
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

      expect(result.partnershipBonus).toBe(1);
      expect(result.reasoning).toContain('Strong combo');
    });

    it('returns 0 point bonus for good partnership (20-24% win rate with 5+ starts) (Model B)', () => {
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

      expect(result.partnershipBonus).toBe(0);
      expect(result.reasoning).toContain('Good combo');
    });

    it('returns 0 point bonus for regular partnership (15-19% win rate with 5+ starts) (Model B)', () => {
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

      expect(result.partnershipBonus).toBe(0);
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

    it('total score stays within limit of 24 points (Rebalanced)', () => {
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

      // Rebalanced Max: 10 (trainer) + 12 (jockey) + 2 (elite partnership) = 24
      expect(result.total).toBeLessThanOrEqual(24);
    });

    it('handles missing past performances gracefully', () => {
      const horse = createHorseEntry({
        trainerName: 'Test Trainer',
        jockeyName: 'Test Jockey',
        pastPerformances: [],
      });

      const result = calculateConnectionsScore(horse);

      expect(result.total).toBeGreaterThan(0); // Returns baseline scores
      // Rebalanced: Penalized baselines are 1 for trainer, 1 for jockey (no career data)
      expect(result.trainer).toBe(1);
      expect(result.jockey).toBe(1);
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
      // but elite DRF trainer stats (22% win rate at meet with 50 starts)
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

      // Rebalanced: 22% with 15+ starts = 8 pts
      expect(result.trainer).toBe(8);
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

      // Rebalanced: 25% with 20+ starts = 12 pts
      expect(result.jockey).toBe(12);
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

      // Should use PP-based stats (shipper) - capped at 7 pts
      expect(result.trainer).toBe(7); // Rebalanced: Shipper cap at 7
      expect(result.trainerStats?.source).toBe('pp');
    });

    it('poor PP record with elite trainer DRF stats scores high', () => {
      // CRITICAL TEST: This is the exact bug case from the audit
      // A horse with only 2 PP wins should still score high if trainer has 22% meet win rate
      const horse = createHorseEntry({
        trainerName: 'Todd Pletcher',
        // Elite trainer stats: 22% win rate with 100 starts
        trainerMeetStarts: 100,
        trainerMeetWins: 22,
        trainerMeetPlaces: 18,
        trainerMeetShows: 15,
        jockeyName: 'John Velazquez',
        // Elite jockey stats: 20% win rate with 150 starts
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

      // Should score based on DRF stats, not PP record
      // Rebalanced: 22% with 15+ starts = 8 pts trainer
      // Rebalanced: 20% with 10+ starts = 8 pts jockey
      expect(result.trainer).toBe(8);
      expect(result.jockey).toBe(8);
      expect(result.trainerStats?.source).toBe('drf');
      expect(result.jockeyStats?.source).toBe('drf');

      // Rebalanced: Total should be at least 16 (8 + 8) without partnership bonus
      expect(result.total).toBeGreaterThanOrEqual(16);
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

    it('handles edge case of 0 trainer wins with positive starts', () => {
      const horse = createHorseEntry({
        trainerName: 'Winless Trainer',
        trainerMeetStarts: 20,
        trainerMeetWins: 0,
        trainerMeetPlaces: 3,
        trainerMeetShows: 5,
        pastPerformances: [],
      });

      const result = calculateConnectionsScore(horse);

      // Rebalanced: 0% win rate = 1 pt
      expect(result.trainer).toBe(1);
      expect(result.trainerStats?.winRate).toBe(0);
      expect(result.trainerStats?.source).toBe('drf');
    });
  });
});
