import { describe, it, expect } from 'vitest';
import {
  ODDS_SEQUENCE,
  oddsToDecimal,
  findClosestOddsIndex,
  incrementOdds,
  decrementOdds,
  canIncrementOdds,
  canDecrementOdds,
  normalizeOddsFormat,
} from '../oddsStepper';

describe('oddsStepper', () => {
  describe('oddsToDecimal', () => {
    it('converts standard odds to decimal', () => {
      expect(oddsToDecimal('5-1')).toBe(5);
      expect(oddsToDecimal('3-2')).toBe(1.5);
      expect(oddsToDecimal('1-2')).toBe(0.5);
      expect(oddsToDecimal('2-1')).toBe(2);
      expect(oddsToDecimal('1-1')).toBe(1);
    });

    it('handles plain numbers as X-1 odds', () => {
      expect(oddsToDecimal('5')).toBe(5);
      expect(oddsToDecimal('10')).toBe(10);
    });
  });

  describe('findClosestOddsIndex', () => {
    it('finds exact matches', () => {
      expect(ODDS_SEQUENCE[findClosestOddsIndex('5-1')]).toBe('5-1');
      expect(ODDS_SEQUENCE[findClosestOddsIndex('3-2')]).toBe('3-2');
      expect(ODDS_SEQUENCE[findClosestOddsIndex('10-1')]).toBe('10-1');
    });

    it('finds closest match for non-standard odds', () => {
      // 4.5-1 should map closest to 9-2 (4.5) or 5-1 (5)
      const idx = findClosestOddsIndex('4.5-1');
      expect(['9-2', '5-1']).toContain(ODDS_SEQUENCE[idx]);
    });
  });

  describe('incrementOdds', () => {
    it('increments through the sequence', () => {
      expect(incrementOdds('3-1')).toBe('7-2');
      expect(incrementOdds('7-2')).toBe('4-1');
      expect(incrementOdds('4-1')).toBe('9-2');
      expect(incrementOdds('9-2')).toBe('5-1');
      expect(incrementOdds('5-1')).toBe('6-1');
    });

    it('stays at max when already at maximum', () => {
      expect(incrementOdds('99-1')).toBe('99-1');
    });

    it('handles lower odds correctly', () => {
      expect(incrementOdds('1-2')).toBe('3-5');
      expect(incrementOdds('1-1')).toBe('6-5');
    });
  });

  describe('decrementOdds', () => {
    it('decrements through the sequence', () => {
      expect(decrementOdds('5-1')).toBe('9-2');
      expect(decrementOdds('9-2')).toBe('4-1');
      expect(decrementOdds('4-1')).toBe('7-2');
      expect(decrementOdds('7-2')).toBe('3-1');
    });

    it('stays at min when already at minimum', () => {
      expect(decrementOdds('1-9')).toBe('1-9');
    });
  });

  describe('canIncrementOdds / canDecrementOdds', () => {
    it('returns true for middle of sequence', () => {
      expect(canIncrementOdds('5-1')).toBe(true);
      expect(canDecrementOdds('5-1')).toBe(true);
    });

    it('returns false at boundaries', () => {
      expect(canIncrementOdds('99-1')).toBe(false);
      expect(canDecrementOdds('1-9')).toBe(false);
    });
  });

  describe('normalizeOddsFormat', () => {
    it('normalizes different separators', () => {
      expect(normalizeOddsFormat('5/1')).toBe('5-1');
      expect(normalizeOddsFormat('5:1')).toBe('5-1');
      expect(normalizeOddsFormat('5-1')).toBe('5-1');
    });

    it('handles plain numbers', () => {
      expect(normalizeOddsFormat('5')).toBe('5-1');
      expect(normalizeOddsFormat('10')).toBe('10-1');
    });
  });

  describe('ODDS_SEQUENCE ordering', () => {
    it('is ordered from lowest to highest decimal value', () => {
      for (let i = 0; i < ODDS_SEQUENCE.length - 1; i++) {
        const currentOdds = ODDS_SEQUENCE[i];
        const nextOdds = ODDS_SEQUENCE[i + 1];
        if (!currentOdds || !nextOdds) continue;
        const current = oddsToDecimal(currentOdds);
        const next = oddsToDecimal(nextOdds);
        expect(current).toBeLessThan(next);
      }
    });
  });
});
