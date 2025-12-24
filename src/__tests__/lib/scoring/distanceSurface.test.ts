/**
 * Distance & Surface Affinity Scoring Tests
 * Tests turf, wet track, and distance affinity scoring
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDistanceSurfaceScore,
  hasDistanceSurfaceAdvantage,
  getDistanceSurfaceSummary,
  DISTANCE_SURFACE_LIMITS,
} from '../../../lib/scoring/distanceSurface';
import { createHorseEntry, createRaceHeader } from '../../fixtures/testHelpers';

describe('Distance & Surface Affinity Scoring', () => {
  describe('Turf Scoring', () => {
    it('returns 8 points (max) for 30%+ turf win rate on turf race', () => {
      const horse = createHorseEntry({
        turfStarts: 10,
        turfWins: 4, // 40% win rate
      });
      const header = createRaceHeader({ surface: 'turf' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.turfScore).toBe(8);
      expect(result.turfWinRate).toBeCloseTo(0.4, 2);
    });

    it('returns 6 points for 20-29% turf win rate', () => {
      const horse = createHorseEntry({
        turfStarts: 10,
        turfWins: 2, // 20% win rate
      });
      const header = createRaceHeader({ surface: 'turf' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.turfScore).toBe(6);
    });

    it('returns 4 points for 15-19% turf win rate', () => {
      const horse = createHorseEntry({
        turfStarts: 20,
        turfWins: 3, // 15% win rate
      });
      const header = createRaceHeader({ surface: 'turf' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.turfScore).toBe(4);
    });

    it('returns 2 points for 10-14% turf win rate', () => {
      const horse = createHorseEntry({
        turfStarts: 10,
        turfWins: 1, // 10% win rate
      });
      const header = createRaceHeader({ surface: 'turf' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.turfScore).toBe(2);
    });

    it('returns 0 points for <10% turf win rate', () => {
      const horse = createHorseEntry({
        turfStarts: 20,
        turfWins: 1, // 5% win rate
      });
      const header = createRaceHeader({ surface: 'turf' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.turfScore).toBe(0);
    });

    it('returns 0 points for horse with no turf starts on turf race (not penalized)', () => {
      const horse = createHorseEntry({
        turfStarts: 0,
        turfWins: 0,
      });
      const header = createRaceHeader({ surface: 'turf' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.turfScore).toBe(0);
      expect(result.reasoning).toContain('No turf starts (unproven)');
    });

    it('returns 0 points on dirt race regardless of turf record', () => {
      const horse = createHorseEntry({
        turfStarts: 10,
        turfWins: 5, // 50% turf specialist
      });
      const header = createRaceHeader({ surface: 'dirt' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.turfScore).toBe(0);
      expect(result.reasoning).not.toContain('turf');
    });

    it('applies half credit for small sample size (1-2 starts)', () => {
      const horse = createHorseEntry({
        turfStarts: 2,
        turfWins: 1, // 50% win rate but small sample
      });
      const header = createRaceHeader({ surface: 'turf' });

      const result = calculateDistanceSurfaceScore(horse, header);

      // Would be 8 points for 50% but capped at half for 2 starts
      expect(result.turfScore).toBe(4);
      expect(result.reasoning[0]).toContain('small sample');
    });
  });

  describe('Wet Track Scoring', () => {
    it('returns 6 points (max) for 25%+ wet win rate on muddy track', () => {
      const horse = createHorseEntry({
        wetStarts: 8,
        wetWins: 3, // 37.5% win rate
      });
      const header = createRaceHeader({ trackCondition: 'muddy' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.wetScore).toBe(6);
      expect(result.wetWinRate).toBeCloseTo(0.375, 2);
    });

    it('returns 4 points for 15-24% wet win rate on sloppy track', () => {
      const horse = createHorseEntry({
        wetStarts: 10,
        wetWins: 2, // 20% win rate
      });
      const header = createRaceHeader({ trackCondition: 'sloppy' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.wetScore).toBe(4);
    });

    it('returns 2 points for 10-14% wet win rate', () => {
      const horse = createHorseEntry({
        wetStarts: 10,
        wetWins: 1, // 10% win rate
      });
      const header = createRaceHeader({ trackCondition: 'muddy' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.wetScore).toBe(2);
    });

    it('returns 0 points on dry track regardless of wet record', () => {
      const horse = createHorseEntry({
        wetStarts: 10,
        wetWins: 5, // Great mudder
      });
      const header = createRaceHeader({ trackCondition: 'fast' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.wetScore).toBe(0);
    });

    it('applies half credit for small sample size (1-2 starts)', () => {
      const horse = createHorseEntry({
        wetStarts: 2,
        wetWins: 1, // 50% win rate but small sample
      });
      const header = createRaceHeader({ trackCondition: 'muddy' });

      const result = calculateDistanceSurfaceScore(horse, header);

      // Would be 6 points for 50% but capped at half for 2 starts
      expect(result.wetScore).toBe(3);
      expect(result.reasoning[0]).toContain('small sample');
    });

    it('works with turf wet conditions (yielding, soft, heavy)', () => {
      const horse = createHorseEntry({
        wetStarts: 8,
        wetWins: 3, // 37.5% win rate
      });
      const header = createRaceHeader({ surface: 'turf', trackCondition: 'yielding' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.wetScore).toBe(6);
    });
  });

  describe('Distance Scoring', () => {
    it('returns 6 points (max) for 25%+ distance win rate', () => {
      const horse = createHorseEntry({
        distanceStarts: 10,
        distanceWins: 3, // 30% win rate
      });
      const header = createRaceHeader();

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.distanceScore).toBe(6);
      expect(result.distanceWinRate).toBeCloseTo(0.3, 2);
    });

    it('returns 4 points for 15-24% distance win rate', () => {
      const horse = createHorseEntry({
        distanceStarts: 10,
        distanceWins: 2, // 20% win rate
      });
      const header = createRaceHeader();

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.distanceScore).toBe(4);
    });

    it('returns 2 points for 10-14% distance win rate', () => {
      const horse = createHorseEntry({
        distanceStarts: 10,
        distanceWins: 1, // 10% win rate
      });
      const header = createRaceHeader();

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.distanceScore).toBe(2);
    });

    it('returns 0 points for no distance starts (unproven, not penalized)', () => {
      const horse = createHorseEntry({
        distanceStarts: 0,
        distanceWins: 0,
      });
      const header = createRaceHeader();

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.distanceScore).toBe(0);
      expect(result.reasoning).toContain('No starts at distance (unproven)');
    });

    it('applies half credit for small sample size (1-2 starts)', () => {
      const horse = createHorseEntry({
        distanceStarts: 1,
        distanceWins: 1, // 100% win rate but only 1 start
      });
      const header = createRaceHeader();

      const result = calculateDistanceSurfaceScore(horse, header);

      // Would be 6 points for 100% but capped at half for 1 start
      expect(result.distanceScore).toBe(3);
      expect(result.reasoning[0]).toContain('small sample');
    });

    it('distance score always applies regardless of surface/condition', () => {
      const horse = createHorseEntry({
        distanceStarts: 10,
        distanceWins: 3, // 30% win rate
      });
      // Dirt fast race
      const dirtFast = createRaceHeader({ surface: 'dirt', trackCondition: 'fast' });
      // Turf yielding race
      const turfYielding = createRaceHeader({ surface: 'turf', trackCondition: 'yielding' });

      const result1 = calculateDistanceSurfaceScore(horse, dirtFast);
      const result2 = calculateDistanceSurfaceScore(horse, turfYielding);

      expect(result1.distanceScore).toBe(6);
      expect(result2.distanceScore).toBe(6);
    });
  });

  describe('Combined Scoring', () => {
    it('correctly sums turf, wet, and distance scores', () => {
      const horse = createHorseEntry({
        turfStarts: 10,
        turfWins: 4, // 40% = 8 pts
        wetStarts: 8,
        wetWins: 3, // 37.5% = 6 pts
        distanceStarts: 10,
        distanceWins: 3, // 30% = 6 pts
      });
      const header = createRaceHeader({ surface: 'turf', trackCondition: 'yielding' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.turfScore).toBe(8);
      expect(result.wetScore).toBe(6);
      expect(result.distanceScore).toBe(6);
      expect(result.total).toBe(20); // Max score
    });

    it('caps total at 20 points', () => {
      const horse = createHorseEntry({
        turfStarts: 10,
        turfWins: 5, // 50% = 8 pts
        wetStarts: 10,
        wetWins: 5, // 50% = 6 pts
        distanceStarts: 10,
        distanceWins: 5, // 50% = 6 pts
      });
      const header = createRaceHeader({ surface: 'turf', trackCondition: 'soft' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.total).toBe(20); // Capped at max
    });

    it('returns only distance score on dry dirt race', () => {
      const horse = createHorseEntry({
        turfStarts: 10,
        turfWins: 4, // Would be 8 pts on turf
        wetStarts: 8,
        wetWins: 3, // Would be 6 pts on wet
        distanceStarts: 10,
        distanceWins: 3, // 30% = 6 pts
      });
      const header = createRaceHeader({ surface: 'dirt', trackCondition: 'fast' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.turfScore).toBe(0);
      expect(result.wetScore).toBe(0);
      expect(result.distanceScore).toBe(6);
      expect(result.total).toBe(6);
    });
  });

  describe('Track Condition Override', () => {
    it('uses override condition instead of header condition', () => {
      const horse = createHorseEntry({
        wetStarts: 8,
        wetWins: 3, // 37.5% = 6 pts
      });
      // Header says fast, but user overrides to muddy
      const header = createRaceHeader({ trackCondition: 'fast' });

      const result = calculateDistanceSurfaceScore(horse, header, 'muddy');

      expect(result.wetScore).toBe(6);
    });

    it('ignores wet bonus when override is dry condition', () => {
      const horse = createHorseEntry({
        wetStarts: 8,
        wetWins: 3, // 37.5% = 6 pts
      });
      // Header says muddy, but user overrides to fast
      const header = createRaceHeader({ trackCondition: 'muddy' });

      const result = calculateDistanceSurfaceScore(horse, header, 'fast');

      expect(result.wetScore).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    it('hasDistanceSurfaceAdvantage returns true for 10+ points', () => {
      const horse = createHorseEntry({
        turfStarts: 10,
        turfWins: 4, // 8 pts
        distanceStarts: 10,
        distanceWins: 2, // 4 pts
      });
      const header = createRaceHeader({ surface: 'turf' });

      const hasAdvantage = hasDistanceSurfaceAdvantage(horse, header);

      expect(hasAdvantage).toBe(true);
    });

    it('hasDistanceSurfaceAdvantage returns false for <10 points', () => {
      const horse = createHorseEntry({
        turfStarts: 10,
        turfWins: 1, // 2 pts
        distanceStarts: 10,
        distanceWins: 1, // 2 pts
      });
      const header = createRaceHeader({ surface: 'turf' });

      const hasAdvantage = hasDistanceSurfaceAdvantage(horse, header);

      expect(hasAdvantage).toBe(false);
    });

    it('getDistanceSurfaceSummary formats correctly', () => {
      const horse = createHorseEntry({
        turfStarts: 10,
        turfWins: 4, // 8 pts
        distanceStarts: 10,
        distanceWins: 2, // 4 pts
      });
      const header = createRaceHeader({ surface: 'turf' });

      const summary = getDistanceSurfaceSummary(horse, header);

      expect(summary).toContain('Turf: +8');
      expect(summary).toContain('Distance: +4');
      expect(summary).toContain('Total: +12');
    });

    it('getDistanceSurfaceSummary handles zero score', () => {
      const horse = createHorseEntry({
        turfStarts: 0,
        turfWins: 0,
        wetStarts: 0,
        wetWins: 0,
        distanceStarts: 0,
        distanceWins: 0,
      });
      const header = createRaceHeader({ surface: 'dirt', trackCondition: 'fast' });

      const summary = getDistanceSurfaceSummary(horse, header);

      expect(summary).toBe('No distance/surface bonus');
    });
  });

  describe('Constants', () => {
    it('exports correct score limits', () => {
      expect(DISTANCE_SURFACE_LIMITS.turf).toBe(8);
      expect(DISTANCE_SURFACE_LIMITS.wet).toBe(6);
      expect(DISTANCE_SURFACE_LIMITS.distance).toBe(6);
      expect(DISTANCE_SURFACE_LIMITS.total).toBe(20);
    });
  });

  describe('Edge Cases', () => {
    it('handles null/undefined stats gracefully', () => {
      const horse = createHorseEntry({});
      // Use type assertion to set null values for testing edge case
      (horse as Record<string, unknown>).turfStarts = null;
      (horse as Record<string, unknown>).wetStarts = null;
      (horse as Record<string, unknown>).distanceStarts = null;

      const header = createRaceHeader({ surface: 'turf', trackCondition: 'muddy' });

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.turfScore).toBe(0);
      expect(result.wetScore).toBe(0);
      expect(result.distanceScore).toBe(0);
      expect(result.total).toBe(0);
    });

    it('handles negative wins gracefully', () => {
      const horse = createHorseEntry({
        distanceStarts: 10,
        distanceWins: -1, // Invalid but should handle gracefully
      });
      const header = createRaceHeader();

      const result = calculateDistanceSurfaceScore(horse, header);

      expect(result.distanceScore).toBe(0);
    });

    it('handles wins greater than starts gracefully', () => {
      const horse = createHorseEntry({
        distanceStarts: 5,
        distanceWins: 10, // Invalid: more wins than starts
      });
      const header = createRaceHeader();

      const result = calculateDistanceSurfaceScore(horse, header);

      // Should calculate based on the rate, even if data is invalid
      // 10/5 = 200% which is > 25% so should get max points
      expect(result.distanceScore).toBe(6);
    });
  });
});
