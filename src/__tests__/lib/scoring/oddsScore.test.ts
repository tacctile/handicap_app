/**
 * Odds Scoring Tests
 * Model B: Tests for morning line odds factor scoring
 *
 * Tests:
 * - Odds parsing (various formats)
 * - Odds scoring tiers (Model B: max 12 pts, reduced from 15)
 * - Integration with scoring pipeline
 * - Live odds override
 */

import { describe, it, expect } from 'vitest';
import {
  parseOddsToDecimal,
  calculateOddsPoints,
  calculateOddsScore,
  getOddsForScoring,
  getOddsTier,
  formatOdds,
  isFavorite,
  isLongshot,
  calculateOddsPointDifference,
  MAX_ODDS_SCORE,
  NEUTRAL_ODDS_SCORE,
} from '../../../lib/scoring/oddsScore';
import { createHorseEntry } from '../../fixtures/testHelpers';

describe('Odds Scoring', () => {
  describe('Odds Parsing', () => {
    it('parses "3-1" to 3.0', () => {
      expect(parseOddsToDecimal('3-1')).toBe(3.0);
    });

    it('parses "7-2" to 3.5', () => {
      expect(parseOddsToDecimal('7-2')).toBe(3.5);
    });

    it('parses "15-1" to 15.0', () => {
      expect(parseOddsToDecimal('15-1')).toBe(15.0);
    });

    it('parses "1-1" to 1.0 (even money)', () => {
      expect(parseOddsToDecimal('1-1')).toBe(1.0);
    });

    it('parses "EVEN" to 1.0', () => {
      expect(parseOddsToDecimal('EVEN')).toBe(1.0);
    });

    it('parses "EVN" to 1.0', () => {
      expect(parseOddsToDecimal('EVN')).toBe(1.0);
    });

    it('parses "5/2" slash format to 2.5', () => {
      expect(parseOddsToDecimal('5/2')).toBe(2.5);
    });

    it('parses "9/2" slash format to 4.5', () => {
      expect(parseOddsToDecimal('9/2')).toBe(4.5);
    });

    it('parses decimal string "2.5" to 2.5', () => {
      expect(parseOddsToDecimal('2.5')).toBe(2.5);
    });

    it('returns null for empty string', () => {
      expect(parseOddsToDecimal('')).toBeNull();
    });

    it('returns null for "0-0"', () => {
      expect(parseOddsToDecimal('0-0')).toBeNull();
    });

    it('returns null for null input', () => {
      expect(parseOddsToDecimal(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(parseOddsToDecimal(undefined)).toBeNull();
    });

    it('returns null for invalid format', () => {
      expect(parseOddsToDecimal('abc')).toBeNull();
    });

    it('handles whitespace', () => {
      expect(parseOddsToDecimal('  3-1  ')).toBe(3.0);
    });

    it('handles lowercase "even"', () => {
      expect(parseOddsToDecimal('even')).toBe(1.0);
    });
  });

  describe('Odds Scoring Tiers (Model B - 6-tier structure)', () => {
    // Model B: MAX_ODDS_SCORE = 12, NEUTRAL = 5
    // Tiers: Heavy Favorite (<2), Solid Favorite (2-3.5), Contender (3.5-6),
    //        Mid-Pack (6-10), Longshot (10-20), Extreme Longshot (>20)

    it('scores 1-1 (even money) as 12 pts (heavy favorite)', () => {
      expect(calculateOddsPoints(1.0)).toBe(12);
    });

    it('scores 3-2 (1.5) as 12 pts (heavy favorite)', () => {
      expect(calculateOddsPoints(1.5)).toBe(12);
    });

    it('scores 2-1 as 10 pts (solid favorite)', () => {
      expect(calculateOddsPoints(2.0)).toBe(10);
    });

    it('scores 5-2 (2.5) as 10 pts (solid favorite)', () => {
      expect(calculateOddsPoints(2.5)).toBe(10);
    });

    it('scores 3-1 as 10 pts (solid favorite)', () => {
      expect(calculateOddsPoints(3.0)).toBe(10);
    });

    it('scores 7-2 (3.5) as 10 pts (solid favorite)', () => {
      expect(calculateOddsPoints(3.5)).toBe(10);
    });

    it('scores 4-1 as 8 pts (contender)', () => {
      expect(calculateOddsPoints(4.0)).toBe(8);
    });

    it('scores 9-2 (4.5) as 8 pts (contender)', () => {
      expect(calculateOddsPoints(4.5)).toBe(8);
    });

    it('scores 5-1 as 8 pts (contender)', () => {
      expect(calculateOddsPoints(5.0)).toBe(8);
    });

    it('scores 6-1 as 8 pts (contender)', () => {
      expect(calculateOddsPoints(6.0)).toBe(8);
    });

    it('scores 7-1 as 5 pts (mid-pack)', () => {
      expect(calculateOddsPoints(7.0)).toBe(5);
    });

    it('scores 10-1 as 5 pts (mid-pack)', () => {
      expect(calculateOddsPoints(10.0)).toBe(5);
    });

    it('scores 12-1 as 2 pts (longshot)', () => {
      expect(calculateOddsPoints(12.0)).toBe(2);
    });

    it('scores 15-1 as 2 pts (longshot)', () => {
      expect(calculateOddsPoints(15.0)).toBe(2);
    });

    it('scores 20-1 as 2 pts (longshot)', () => {
      expect(calculateOddsPoints(20.0)).toBe(2);
    });

    it('scores 30-1 as 0 pts (extreme longshot)', () => {
      expect(calculateOddsPoints(30.0)).toBe(0);
    });

    it('scores 50-1 as 0 pts (extreme longshot)', () => {
      expect(calculateOddsPoints(50.0)).toBe(0);
    });

    it('scores null odds as 5 pts (neutral)', () => {
      expect(calculateOddsPoints(null)).toBe(NEUTRAL_ODDS_SCORE);
    });

    it('scores 0 odds as 5 pts (neutral)', () => {
      expect(calculateOddsPoints(0)).toBe(NEUTRAL_ODDS_SCORE);
    });

    it('scores negative odds as 5 pts (neutral)', () => {
      expect(calculateOddsPoints(-5)).toBe(NEUTRAL_ODDS_SCORE);
    });
  });

  describe('Score Spread (Model B)', () => {
    it('has 12 point spread between heavy favorite and extreme longshot', () => {
      const heavyFavorite = calculateOddsPoints(1.0); // 12 pts
      const extremeLongshot = calculateOddsPoints(30.0); // 0 pts
      expect(heavyFavorite - extremeLongshot).toBe(12);
    });

    it('has MAX_ODDS_SCORE of 12 (Model B)', () => {
      expect(MAX_ODDS_SCORE).toBe(12);
    });

    it('has NEUTRAL_ODDS_SCORE of 5 (Model B)', () => {
      expect(NEUTRAL_ODDS_SCORE).toBe(5);
    });
  });

  describe('Complete Odds Score Calculation (Model B)', () => {
    it('calculates score for horse with morning line odds', () => {
      const horse = createHorseEntry({
        morningLineOdds: '3-1',
        morningLineDecimal: 3.0,
      });

      const result = calculateOddsScore(horse);

      expect(result.total).toBe(10); // Model B: was 13
      expect(result.oddsValue).toBe(3.0);
      expect(result.oddsSource).toBe('morning_line');
      expect(result.tier).toBe('Solid Favorite');
    });

    it('calculates score for horse with 1-1 odds', () => {
      const horse = createHorseEntry({
        morningLineOdds: '1-1',
        morningLineDecimal: 1.0,
      });

      const result = calculateOddsScore(horse);

      expect(result.total).toBe(12); // Model B: was 15
      expect(result.oddsValue).toBe(1.0);
      expect(result.tier).toBe('Heavy Favorite');
    });

    it('calculates score for longshot', () => {
      const horse = createHorseEntry({
        morningLineOdds: '30-1',
        morningLineDecimal: 30.0,
      });

      const result = calculateOddsScore(horse);

      expect(result.total).toBe(0); // Model B: extreme longshot = 0 pts
      expect(result.tier).toBe('Extreme Longshot');
    });

    it('calculates neutral score for horse with no odds', () => {
      const horse = createHorseEntry({
        morningLineOdds: '',
        morningLineDecimal: 0,
      });

      const result = calculateOddsScore(horse);

      expect(result.total).toBe(5); // Model B: Neutral = 5
      expect(result.oddsValue).toBeNull();
      expect(result.oddsSource).toBe('none');
      expect(result.tier).toBe('Unknown');
    });
  });

  describe('Live Odds Override (Model B)', () => {
    it('uses live odds when provided as number', () => {
      const horse = createHorseEntry({
        morningLineOdds: '5-1',
        morningLineDecimal: 5.0,
      });

      const result = calculateOddsScore(horse, 2.0);

      expect(result.total).toBe(10); // Model B: 2-1 = 10 pts (Solid Favorite)
      expect(result.oddsValue).toBe(2.0);
      expect(result.oddsSource).toBe('live');
    });

    it('uses live odds when provided as string', () => {
      const horse = createHorseEntry({
        morningLineOdds: '10-1',
        morningLineDecimal: 10.0,
      });

      const result = calculateOddsScore(horse, '3-1');

      expect(result.total).toBe(10); // Model B: 3-1 = 10 pts (was 13)
      expect(result.oddsValue).toBe(3.0);
      expect(result.oddsSource).toBe('live');
    });

    it('falls back to morning line when live odds invalid', () => {
      const horse = createHorseEntry({
        morningLineOdds: '5-1',
        morningLineDecimal: 5.0,
      });

      const result = calculateOddsScore(horse, 'invalid');

      expect(result.total).toBe(8); // Model B: 5-1 = 8 pts (contender)
      expect(result.oddsValue).toBe(5.0);
      expect(result.oddsSource).toBe('morning_line');
    });

    it('falls back to morning line when live odds null', () => {
      const horse = createHorseEntry({
        morningLineOdds: '7-2',
        morningLineDecimal: 3.5,
      });

      const result = calculateOddsScore(horse, null);

      expect(result.total).toBe(10); // Model B: 7-2 = 10 pts (solid favorite)
      expect(result.oddsValue).toBe(3.5);
    });
  });

  describe('getOddsForScoring', () => {
    it('returns user odds when valid number provided', () => {
      const horse = createHorseEntry({
        morningLineOdds: '10-1',
        morningLineDecimal: 10.0,
      });

      expect(getOddsForScoring(horse, 3.0)).toBe(3.0);
    });

    it('returns parsed user odds when valid string provided', () => {
      const horse = createHorseEntry({
        morningLineOdds: '10-1',
        morningLineDecimal: 10.0,
      });

      expect(getOddsForScoring(horse, '5-2')).toBe(2.5);
    });

    it('returns morning line decimal when no user odds', () => {
      const horse = createHorseEntry({
        morningLineOdds: '6-1',
        morningLineDecimal: 6.0,
      });

      expect(getOddsForScoring(horse)).toBe(6.0);
    });

    it('parses morning line string when decimal is 0', () => {
      const horse = createHorseEntry({
        morningLineOdds: '4-1',
        morningLineDecimal: 0,
      });

      expect(getOddsForScoring(horse)).toBe(4.0);
    });
  });

  describe('Utility Functions', () => {
    describe('getOddsTier', () => {
      it('returns correct tier labels', () => {
        expect(getOddsTier(1.5)).toBe('Heavy Favorite');
        expect(getOddsTier(2.5)).toBe('Solid Favorite');
        expect(getOddsTier(3.5)).toBe('Solid Favorite'); // At boundary
        expect(getOddsTier(5.0)).toBe('Contender');
        expect(getOddsTier(8.0)).toBe('Mid-Pack');
        expect(getOddsTier(15.0)).toBe('Longshot');
        expect(getOddsTier(50.0)).toBe('Extreme Longshot');
        expect(getOddsTier(null)).toBe('Unknown');
      });
    });

    describe('formatOdds', () => {
      it('formats whole numbers as X-1', () => {
        expect(formatOdds(3)).toBe('3-1');
        expect(formatOdds(10)).toBe('10-1');
      });

      it('formats 1.0 as Even', () => {
        expect(formatOdds(1)).toBe('Even');
      });

      it('formats half-odds as X-2', () => {
        expect(formatOdds(2.5)).toBe('5-2');
        expect(formatOdds(3.5)).toBe('7-2');
      });

      it('returns N/A for null', () => {
        expect(formatOdds(null)).toBe('N/A');
      });
    });

    describe('isFavorite', () => {
      it('returns true for odds 6-1 or less (Contender or better)', () => {
        expect(isFavorite(1.0)).toBe(true);
        expect(isFavorite(2.0)).toBe(true);
        expect(isFavorite(3.0)).toBe(true);
        expect(isFavorite(4.0)).toBe(true);
        expect(isFavorite(5.0)).toBe(true);
        expect(isFavorite(6.0)).toBe(true);
      });

      it('returns false for odds greater than 6-1', () => {
        expect(isFavorite(7.0)).toBe(false);
        expect(isFavorite(10.0)).toBe(false);
        expect(isFavorite(20.0)).toBe(false);
      });

      it('returns false for null', () => {
        expect(isFavorite(null)).toBe(false);
      });
    });

    describe('isLongshot', () => {
      it('returns true for odds greater than 20-1', () => {
        expect(isLongshot(21.0)).toBe(true);
        expect(isLongshot(30.0)).toBe(true);
        expect(isLongshot(50.0)).toBe(true);
      });

      it('returns false for odds 20-1 or less', () => {
        expect(isLongshot(20.0)).toBe(false);
        expect(isLongshot(10.0)).toBe(false);
        expect(isLongshot(5.0)).toBe(false);
      });

      it('returns false for null', () => {
        expect(isLongshot(null)).toBe(false);
      });
    });

    describe('calculateOddsPointDifference (Model B)', () => {
      it('calculates positive difference when odds shorten', () => {
        // From 5-1 (8 pts) to 2-1 (10 pts) = gains 2 points
        expect(calculateOddsPointDifference(5.0, 2.0)).toBe(2);
      });

      it('calculates negative difference when odds lengthen', () => {
        // From 3-1 (10 pts) to 10-1 (5 pts) = loses 5 points
        expect(calculateOddsPointDifference(3.0, 10.0)).toBe(-5);
      });

      it('returns 0 when odds unchanged', () => {
        expect(calculateOddsPointDifference(5.0, 5.0)).toBe(0);
      });

      it('handles null values', () => {
        // null = 5 pts (neutral), 5-1 = 8 pts
        expect(calculateOddsPointDifference(null, 5.0)).toBe(3); // 5 to 8
        expect(calculateOddsPointDifference(5.0, null)).toBe(-3); // 8 to 5
      });
    });
  });

  describe('Integration Scenarios (Model B)', () => {
    it('Scenario A: Favorite gets credit', () => {
      // 1-1 favorite should get maximum 12 points (Model B)
      const favorite = createHorseEntry({
        morningLineOdds: '1-1',
        morningLineDecimal: 1.0,
      });

      const result = calculateOddsScore(favorite);
      expect(result.total).toBe(12);
      expect(result.tier).toBe('Heavy Favorite');
    });

    it('Scenario B: Longshot gets minimal points', () => {
      // 20-1 horse gets 2 points (Model B: Longshot tier)
      const longshot = createHorseEntry({
        morningLineOdds: '20-1',
        morningLineDecimal: 20.0,
      });

      const result = calculateOddsScore(longshot);
      expect(result.total).toBe(2);
      expect(result.tier).toBe('Longshot');
    });

    it('Scenario C: Live odds override morning line', () => {
      // Morning line 5-1 (8 pts), live odds 2-1 (10 pts) = +2 points
      const horse = createHorseEntry({
        morningLineOdds: '5-1',
        morningLineDecimal: 5.0,
      });

      const withMorningLine = calculateOddsScore(horse);
      const withLiveOdds = calculateOddsScore(horse, 2.0);

      expect(withMorningLine.total).toBe(8);
      expect(withLiveOdds.total).toBe(10);
      expect(withLiveOdds.total - withMorningLine.total).toBe(2);
    });

    it('Scenario D: Missing odds gets neutral score', () => {
      const horse = createHorseEntry({
        morningLineOdds: '',
        morningLineDecimal: 0,
      });

      const result = calculateOddsScore(horse);
      expect(result.total).toBe(5); // Model B: Neutral = 5
      expect(result.oddsSource).toBe('none');
    });
  });
});
